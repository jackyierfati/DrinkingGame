/*
 * 词条数据库 + 优先级选择逻辑
 * ------------------------------------------------------------------
 * 数据库：词条由生成器产出，优先级持久化在 localStorage（id -> priority）。
 *         这样刷新页面/关闭重开，「哪些词条已经出现过」的记忆还在。
 *
 * 防重复核心：
 *   - 每个词条初始 priority = 0
 *   - 被抽中一次 priority -= 1
 *   - 抽签权重 = base * 2^priority
 *       priority  0  -> 2^0  = 1     （还没出现，最容易被抽）
 *       priority -1  -> 2^-1 = 0.5   （出现过一次，概率减半）
 *       priority -2  -> 2^-2 = 0.25
 *   于是没出现过的词条总是优先被抽，天然轮换、不易重复。
 */

const STORAGE_KEY = 'drinkinggame.priorities.v1';
const CUSTOM_KEY = 'drinkinggame.custom.v1';

/*
 * 自定义词条覆盖层（custom overlay）
 * ------------------------------------------------------------------
 * 基础词库来自代码（entries-data.js + 扩写），是只读的。
 * 用户在手机上的增/删/改都存成一层「覆盖」：
 *   { added:[{id,text,category}], edited:{id:{text,category}}, deleted:[id] }
 * 优先存服务端（/api/custom，全场共享），没有服务端时退回 localStorage。
 * 最终词库 = 基础词库 去掉deleted、套用edited、再拼上added。
 */
function emptyCustom() {
  return { added: [], edited: {}, deleted: [] };
}
function normalizeCustom(c) {
  return {
    added: Array.isArray(c && c.added) ? c.added : [],
    edited: (c && typeof c.edited === 'object' && c.edited) || {},
    deleted: Array.isArray(c && c.deleted) ? c.deleted : [],
  };
}

class EntryDB {
  constructor(includeExpanded = true) {
    this.base = window.EntryGen.generateEntries(includeExpanded);
    this.custom = emptyCustom();
    this.serverOk = false;
    this.entries = [];
    this.index = new Map();
    this._rebuild();
  }

  /** 异步加载自定义覆盖层：优先服务端，失败退回 localStorage */
  async loadCustom() {
    try {
      const r = await fetch('/api/custom', { cache: 'no-store' });
      if (!r.ok) throw new Error('no api');
      this.custom = normalizeCustom(await r.json());
      this.serverOk = true;
    } catch (_) {
      this.serverOk = false;
      try {
        const raw = localStorage.getItem(CUSTOM_KEY);
        if (raw) this.custom = normalizeCustom(JSON.parse(raw));
      } catch (e) { /* ignore */ }
    }
    this._rebuild();
    return this.serverOk;
  }

  /** 持久化覆盖层：服务端可用就写服务端，否则写 localStorage */
  async saveCustom() {
    if (this.serverOk) {
      try {
        await fetch('/api/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.custom),
        });
        return;
      } catch (_) { /* 落到本地兜底 */ }
    }
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(this.custom));
    } catch (e) {
      console.warn('保存自定义词条失败', e);
    }
  }

  /** 由 base + custom 重建 this.entries，并套用已保存的优先级 */
  _rebuild() {
    const deleted = new Set(this.custom.deleted);
    const edited = this.custom.edited;
    const list = [];
    for (const e of this.base) {
      if (deleted.has(e.id)) continue;
      const ov = edited[e.id];
      list.push(ov ? { ...e, text: ov.text, category: ov.category } : { ...e });
    }
    for (const a of this.custom.added) {
      list.push({ id: a.id, text: a.text, category: a.category, priority: 0, base: 1.0 });
    }
    // 按 id 去重（先到先得）
    const seen = new Set();
    this.entries = list.filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
    this.index = new Map(this.entries.map((e) => [e.id, e]));
    this._loadPriorities();
  }

  // —— 增删改 ——

  /** 新增词条，返回新 id（若文本重复则返回已存在的 id，不重复添加） */
  addEntry(text, category) {
    text = (text || '').trim();
    if (!text) return null;
    const id = window.EntryGen.hashId(text);
    if (this.index.has(id)) return id; // 已存在
    this.custom.added.push({ id, text, category: category || '其他' });
    this._rebuild();
    this.saveCustom();
    return id;
  }

  /** 修改词条（自动区分是自建的还是基础词条） */
  editEntry(id, text, category) {
    text = (text || '').trim();
    if (!text) return;
    const a = this.custom.added.find((x) => x.id === id);
    if (a) {
      a.text = text;
      a.category = category || a.category;
    } else {
      this.custom.edited[id] = { text, category: category || '其他' };
    }
    this._rebuild();
    this.saveCustom();
  }

  /** 删除词条（自建的直接移除；基础词条加入 deleted 隐藏） */
  deleteEntry(id) {
    const ai = this.custom.added.findIndex((x) => x.id === id);
    if (ai >= 0) {
      this.custom.added.splice(ai, 1);
    } else {
      if (!this.custom.deleted.includes(id)) this.custom.deleted.push(id);
      delete this.custom.edited[id];
    }
    this._rebuild();
    this.saveCustom();
  }

  /** 某条是否为用户自建 */
  isCustom(id) {
    return this.custom.added.some((x) => x.id === id);
  }

  /** 从 localStorage 恢复优先级，合并到当前词库 */
  _loadPriorities() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      for (const [id, p] of Object.entries(saved)) {
        const e = this.index.get(id);
        if (e) e.priority = p;
      }
    } catch (err) {
      console.warn('读取优先级失败，使用默认值', err);
    }
  }

  /** 只保存被改动过（priority !== 0）的词条，省空间 */
  _savePriorities() {
    const out = {};
    for (const e of this.entries) {
      if (e.priority !== 0) out[e.id] = e.priority;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch (err) {
      console.warn('保存优先级失败', err);
    }
  }

  // 防重复强度：数值越大，出现过的词条被再次抽中的概率下降越快。
  // 权重 = base * 2^(priority * ANTI_REPEAT)
  //   priority 0  -> 1
  //   priority -1 -> 2^-6 ≈ 0.0156（几乎不会在下一轮再被抽到）
  weightOf(entry) {
    return entry.base * Math.pow(2, entry.priority * EntryDB.ANTI_REPEAT);
  }

  /**
   * 按优先级加权、无放回地抽出 count 个候选词条（用于铺满转盘盘面）。
   * @param {number} count 需要的候选数
   * @param {string|null} category 可选，限定分类
   */
  drawCandidates(count, category = null) {
    let pool = this.entries;
    if (category) pool = pool.filter((e) => e.category === category);
    pool = pool.slice(); // 拷贝，避免破坏原数组

    const picked = [];
    for (let n = 0; n < count && pool.length > 0; n++) {
      const total = pool.reduce((s, e) => s + this.weightOf(e), 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        r -= this.weightOf(pool[idx]);
        if (r <= 0) break;
      }
      if (idx >= pool.length) idx = pool.length - 1;
      picked.push(pool[idx]);
      pool.splice(idx, 1); // 无放回
    }
    return picked;
  }

  /** 记录某词条被选中：优先级 -1 并持久化 */
  markUsed(entry) {
    const e = this.index.get(entry.id);
    if (!e) return;
    e.priority -= 1;
    this._savePriorities();
  }

  /** 重置全部优先级（新的一局/换一批人时用） */
  resetPriorities() {
    for (const e of this.entries) e.priority = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  get categories() {
    return [...new Set(this.entries.map((e) => e.category))];
  }

  get size() {
    return this.entries.length;
  }

  /** 统计信息，便于调试/展示 */
  stats() {
    const used = this.entries.filter((e) => e.priority < 0).length;
    return { total: this.size, used, fresh: this.size - used };
  }
}

EntryDB.ANTI_REPEAT = 6;

window.EntryDB = EntryDB;
