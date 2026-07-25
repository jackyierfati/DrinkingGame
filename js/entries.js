/*
 * 词条构建器
 * ------------------------------------------------------------------
 * 词库 = 【视频扒下来的真实词条 ENTRIES_DATA】 + 【同风格扩写生成的更多词条】
 *
 * 视频里的词条是「…的人」这种经历/习惯类条件，符合的人就喝。
 * 我们照着同样的句式，用「模板 × 词槽」扩写出更多，量能上去、风格还统一。
 *
 * 输出每条：{ id, text, category, priority, base }
 *   priority 初始 0，出现一次 -1（在 db.js 里维护，用于防重复）
 */

/* ============ 扩写用的词槽（都是精挑的，保证读起来自然）============ */

// 每天{X}的人
const DAILY = [
  '必须喝一杯奶茶', '睡前刷手机超过一小时', '要午睡一会儿', '吃两顿以上外卖',
  '走不到一万步', '早上赖床超过十分钟', '照三次以上镜子', '忍不住吃甜食',
  '要喝一瓶饮料', '追剧超过两集',
];
// 每周{X}的人
const WEEKLY = [
  '熬夜超过两次', '逛两次以上超市', '健身不到一次', '和家人视频一次',
  '吃两次以上火锅', '点五杯以上奶茶', '追两档以上综艺', '睡懒觉超过两天',
];
// 看过{N}部{类型}的人
const SEEN = [
  '五部爱情片', '三部动作片', '十部动画片', '五部悬疑剧', '三部韩剧',
  '五部喜剧片', '十部国产剧',
];
// 被{X}过的人
const PASSIVE = [
  '朋友放鸽子', '父母翻旧账', '快递电话催', '同事甩过锅', '闹钟吵醒又睡回去',
  '陌生人问过路', '朋友借钱不还', '广告词洗脑',
];
// 能{X}的人
const ABLE = [
  '一口气报出十个明星', '徒手开啤酒瓶', '连说十个绕口令', '默写乘法口诀',
  '空腹喝一杯白酒', '单脚站十秒', '一分钟做二十个深蹲', '闻味道认出菜名',
];
// 会{X}的人
const CAN = [
  '打麻将', '用左手写字', '骑车放双手', '吹口哨', '折千纸鹤', '变一个魔术',
  '弹一种乐器', '说一段脱口秀',
];
// {X}过的人（做过/去过/收到过…）
const DONE = [
  '网购退货超过三次', '半夜点过外卖', '追星追到线下', '给主播刷过礼物',
  '通宵打过游戏', '一个人看过电影', '养过多肉植物', '拼过乐高',
];

/* ============ 工具 ============ */

/** 简单稳定哈希：字符串 -> 短 id */
function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return 'e' + h.toString(36);
}

function makeEntry(text, category, base = 1.0) {
  return { id: hashId(text), text, category, priority: 0, base };
}

/** 扩写：把词槽套进句式，产出同风格词条 */
function expandEntries() {
  const out = [];
  DAILY.forEach((x) => out.push(makeEntry(`每天${x}的人`, '习惯')));
  WEEKLY.forEach((x) => out.push(makeEntry(`每周${x}的人`, '习惯')));
  SEEN.forEach((x) => out.push(makeEntry(`看过${x}的人`, '爱好')));
  PASSIVE.forEach((x) => out.push(makeEntry(`被${x}的人`, '经历')));
  ABLE.forEach((x) => out.push(makeEntry(`能${x}的人`, '才艺')));
  CAN.forEach((x) => out.push(makeEntry(`会${x}的人`, '才艺')));
  DONE.forEach((x) => out.push(makeEntry(`${x}的人`, '经历')));
  return out;
}

/**
 * 生成完整词库：真实词条 + 扩写词条，按文本去重。
 * @param {boolean} includeExpanded 是否加入扩写词条（默认加，量更大）
 */
function generateEntries(includeExpanded = true) {
  const authentic = (window.ENTRIES_DATA || []).map((e) =>
    makeEntry(e.text, e.category, e.base || 1.0)
  );
  const all = includeExpanded ? authentic.concat(expandEntries()) : authentic;

  // 按 id（即文本）去重，真实词条优先保留
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

// 浏览器全局
if (typeof window !== 'undefined') {
  window.EntryGen = { generateEntries, hashId };
}
// Node 测试
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateEntries, hashId, expandEntries };
}
