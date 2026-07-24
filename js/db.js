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

class EntryDB {
  constructor(includeExpanded = true) {
    this.entries = window.EntryGen.generateEntries(includeExpanded);
    this.index = new Map(this.entries.map((e) => [e.id, e]));
    this._loadPriorities();
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
