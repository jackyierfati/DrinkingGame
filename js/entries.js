/*
 * 词条生成器 (Entry Generator)
 * ------------------------------------------------------------------
 * 核心思路：不手写几千条词条，而是用【模板 × 主语 × 动作】组合批量生成，
 * 再去重。视频转盘的 4000 条，本质就是这些维度的排列组合。
 *
 * 每条词条 (entry) 结构：
 *   { id, text, category, priority, base }
 *   - id       : 由文本生成的稳定哈希，用于持久化优先级
 *   - text     : 展示文案，例如「年纪最大的 喝一口」
 *   - category : 分类，方便筛选
 *   - priority : 优先级，初始 0，出现一次 -1（越高越容易被抽中）
 *   - base     : 基础权重，用于给「全体喝」这类高频词条略微调权（可选）
 */

// —— 动作 / 酒量 ——
const ACTIONS = [
  { text: '喝一口', w: 1.0 },
  { text: '喝两口', w: 0.8 },
  { text: '喝三口', w: 0.5 },
  { text: '喝半杯', w: 0.6 },
  { text: '干了这杯', w: 0.3 },
  { text: '罚一杯', w: 0.4 },
  { text: '被罚酒', w: 0.5 },
];

// —— 主语：位置类 ——
const POSITION = [
  '转盘右边的人',
  '转盘左边的人',
  '转盘对面的人',
  '你右手边第二个人',
  '你左手边第二个人',
  '上一个转转盘的人',
  '下一个转转盘的人',
  '本轮的庄家',
  '坐在角落的人',
  '离门最近的人',
];

// —— 主语：属性类 ——
const ATTRIBUTE = [
  '年纪最大的人',
  '年纪最小的人',
  '个子最高的人',
  '个子最矮的人',
  '头发最长的人',
  '今天穿黑色衣服的人',
  '今天穿白色衣服的人',
  '戴眼镜的人',
  '手机壳最花的人',
  '手机电量最低的人',
  '钱包里现金最多的人',
  '微信步数最多的人',
  '微信步数最少的人',
  '生日离今天最近的人',
  '来得最晚的人',
  '来得最早的人',
  '名字笔画最多的人',
  '属相最小的人',
];

// —— 主语：感情 / 身份类 ——
const IDENTITY = [
  '单身的人',
  '有对象的人',
  '谈过恋爱次数最多的人',
  '最近脱单的人',
  '今天最忙的人',
  '开车来的人',
  '离家最远的人',
  '在场学历最高的人',
];

// —— 群体类（整句，不接动作，自带动作）——
const GROUP = [
  '所有人一起干杯',
  '所有男生喝一口',
  '所有女生喝一口',
  '所有单身的人喝一口',
  '所有有对象的人喝一口',
  '你左右两边的人一起喝',
  '除了你以外所有人喝一口',
  '戴眼镜的所有人喝一口',
  '本轮所有输过的人再喝一口',
  '过去一小时笑过的人都喝一口',
];

// —— 挑战 / 大冒险类（整句）——
const CHALLENGE = [
  '说出三个明星的名字，说不出就喝',
  '5 秒内说出一种水果，卡壳就喝',
  '模仿一种动物叫，不做就喝两口',
  '讲一个笑话，没人笑就自己喝',
  '和右边的人猜拳，输的喝一口',
  '和左边的人猜拳，输的喝一口',
  '真心话或大冒险，选大冒险否则喝一口',
  '说一个在场没人知道的你的秘密，不说就喝',
  '30 秒不许笑，笑了就喝一口',
  '用方言说一句「我爱喝酒」，不会就喝',
  '指定一个人陪你喝一口',
  '接下来一轮不许说「你」字，说了就喝',
  '报出在场所有人的名字，漏一个喝一口',
  '单脚站立 10 秒，站不稳就喝',
  '说出上一条词条内容，说错就喝',
  '闭眼指一个人，那个人喝一口',
];

// —— 反转 / 规则类（整句）——
const RULE = [
  '恭喜！这一轮你可以指定任何人喝酒',
  '免死金牌，本轮你不用喝',
  '你自己喝一口',
  '你和最喜欢的人一起喝一口',
  '从现在起「喝酒」要说成「加油」，说错的人喝',
  '接下来每次有人笑，你就喝一口，持续一轮',
  '大赦天下，所有人这一轮都不用喝',
  '你成为「酒司令」，下一轮由你指定谁喝',
];

/** 简单稳定哈希：字符串 -> 短 id */
function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return 'e' + h.toString(36);
}

/** 组合「主语 + 动作」，为每个主语挑选 2~3 个动作，避免爆炸也保证多样 */
function combine(subjects, category, actionsPerSubject) {
  const out = [];
  subjects.forEach((subj, si) => {
    // 用主语下标错位选取动作，保证分布均匀且可复现
    for (let k = 0; k < actionsPerSubject; k++) {
      const act = ACTIONS[(si + k) % ACTIONS.length];
      out.push(makeEntry(`${subj}${act.text}`, category, act.w));
    }
  });
  return out;
}

function makeEntry(text, category, base = 1.0) {
  return { id: hashId(text), text, category, priority: 0, base };
}

/**
 * 生成完整词库。返回去重后的词条数组。
 * @param {number} actionsPerSubject 每个「主语类」主语搭配多少个动作
 */
function generateEntries(actionsPerSubject = 3) {
  let all = [];

  all = all.concat(combine(POSITION, '位置', actionsPerSubject));
  all = all.concat(combine(ATTRIBUTE, '属性', actionsPerSubject));
  all = all.concat(combine(IDENTITY, '身份', actionsPerSubject));

  GROUP.forEach((t) => all.push(makeEntry(t, '群体', 0.9)));
  CHALLENGE.forEach((t) => all.push(makeEntry(t, '挑战', 1.0)));
  RULE.forEach((t) => all.push(makeEntry(t, '规则', 0.8)));

  // 去重（按 id）
  const seen = new Set();
  const deduped = [];
  for (const e of all) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      deduped.push(e);
    }
  }
  return deduped;
}

// 供浏览器全局使用
if (typeof window !== 'undefined') {
  window.EntryGen = { generateEntries, ACTIONS };
}
// 供 Node 测试使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateEntries, hashId };
}
