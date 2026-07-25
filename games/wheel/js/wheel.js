/*
 * 转盘 (Canvas Wheel)
 * ------------------------------------------------------------------
 * 盘面上显示 N 个候选词条（由 EntryDB 按优先级抽出）。点击旋转，
 * 缓动停在随机一格。停下后回调 onResult(entry)。
 */

class Wheel {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.segments = []; // [{ entry, label }]
    this.angle = 0; // 当前旋转角（弧度）
    this.spinning = false;
    this.onResult = opts.onResult || function () {};
    this.logicalSize = canvas.width; // 逻辑绘制尺寸（app.js 会按 DPR 更新）
    this.colors = opts.colors || [
      '#e6194B', '#f58231', '#ffe119', '#3cb44b',
      '#42d4f4', '#4363d8', '#911eb4', '#f032e6',
    ];
  }

  setSegments(entries) {
    this.segments = entries.map((e) => ({ entry: e, label: e.text }));
    this.draw();
  }

  /** 截断过长文案，避免盘面塞不下 */
  _short(text, max = 10) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  draw() {
    const { ctx, segments } = this;
    const W = this.logicalSize;
    const H = this.logicalSize;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 6;
    ctx.clearRect(0, 0, W, H);
    if (segments.length === 0) return;

    const arc = (2 * Math.PI) / segments.length;

    for (let i = 0; i < segments.length; i++) {
      const start = this.angle + i * arc;
      const end = start + arc;

      // 扇形
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 文字
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `${Math.max(11, r * 0.055)}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillText(this._short(this.segments[i].label), r - 12, 0);
      ctx.restore();
    }

    // 中心圆
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.13, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  spin() {
    if (this.spinning || this.segments.length === 0) return;
    this.spinning = true;

    const n = this.segments.length;
    const arc = (2 * Math.PI) / n;
    const winner = Math.floor(Math.random() * n);

    // 指针固定在正上方（-90°）。让 winner 扇形中心停在指针处。
    const pointer = -Math.PI / 2;
    const targetMid = winner * arc + arc / 2;
    const extraTurns = 5 + Math.floor(Math.random() * 3); // 5~7 圈
    // 求终止角，使 (angle + targetMid) 对齐 pointer（模 2π）
    let finalAngle = pointer - targetMid;
    const current = this.angle % (2 * Math.PI);
    let delta = (finalAngle - current) % (2 * Math.PI);
    if (delta < 0) delta += 2 * Math.PI;
    const total = extraTurns * 2 * Math.PI + delta;

    const duration = 4200;
    const startAngle = this.angle;
    const startTime = performance.now();

    const easeOut = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      this.angle = startAngle + total * easeOut(t);
      this.draw();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.spinning = false;
        this.onResult(this.segments[winner].entry);
      }
    };
    requestAnimationFrame(step);
  }
}

window.Wheel = Wheel;
