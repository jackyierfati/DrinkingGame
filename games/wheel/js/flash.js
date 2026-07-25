/*
 * 随机闪现模式
 * ------------------------------------------------------------------
 * 词条在大屏区域飞速跳动、逐渐减速，最后定格在选中的那条。
 * 视觉上比转盘更「老虎机」——快速闪动 + 变色 + 心跳缩放。
 *
 * 用法：flash.run(finalEntry)  —— finalEntry 由外部按优先级抽好传进来，
 * 动画结束后回调 onResult(finalEntry)。
 */
class Flash {
  constructor(el, opts = {}) {
    this.el = el; // 显示文字的元素
    this.onResult = opts.onResult || function () {};
    this.pool = opts.pool || []; // 用来做闪动的随机文字池
    this.running = false;
    this.colors = [
      '#ff5c8a', '#7c5cff', '#42d4f4', '#3cb44b',
      '#ffe119', '#f58231', '#f032e6',
    ];
  }

  setPool(entries) {
    this.pool = entries;
  }

  run(finalEntry) {
    if (this.running || this.pool.length === 0) return;
    this.running = true;

    const duration = 2600; // 总时长
    const startTime = performance.now();
    this.el.classList.remove('flash-final');

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        // 闪动：随机文字 + 随机颜色 + 心跳
        const r = this.pool[Math.floor(Math.random() * this.pool.length)];
        this.el.textContent = r.text;
        this.el.style.color = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.el.classList.remove('flash-beat');
        void this.el.offsetWidth;
        this.el.classList.add('flash-beat');

        // 减速：间隔随进度平方增长（越接近结束跳得越慢）
        const delay = 45 + progress * progress * 260;
        this._timer = setTimeout(tick, delay);
      } else {
        // 定格
        this.el.textContent = finalEntry.text;
        this.el.style.color = '';
        this.el.classList.remove('flash-beat');
        void this.el.offsetWidth;
        this.el.classList.add('flash-final');
        this.running = false;
        this.onResult(finalEntry);
      }
    };
    tick();
  }
}

window.Flash = Flash;
