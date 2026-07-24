/*
 * 应用主逻辑：把数据库、转盘、界面连起来
 */
(function () {
  const SEG_COUNT = 8; // 盘面显示几格候选

  const canvas = document.getElementById('wheel');
  const spinBtn = document.getElementById('spin');
  const resultEl = document.getElementById('result');
  const resultCat = document.getElementById('result-cat');
  const catSelect = document.getElementById('category');
  const statsEl = document.getElementById('stats');
  const resetBtn = document.getElementById('reset');
  const amountToggle = document.getElementById('amount-toggle');
  const resultAmount = document.getElementById('result-amount');

  // 「随机喝多少」的候选与权重（w 越大越常出现）
  const AMOUNTS = [
    { text: '喝一口', w: 3 },
    { text: '喝两口', w: 2.5 },
    { text: '喝三口', w: 1.5 },
    { text: '喝半杯', w: 1 },
    { text: '随意抿一口', w: 1 },
    { text: '干了这杯！', w: 0.4 },
  ];
  const AMOUNT_KEY = 'drinkinggame.randomAmount.v1';

  function pickAmount() {
    const total = AMOUNTS.reduce((s, a) => s + a.w, 0);
    let r = Math.random() * total;
    for (const a of AMOUNTS) {
      r -= a.w;
      if (r <= 0) return a.text;
    }
    return AMOUNTS[0].text;
  }

  const db = new EntryDB(true);
  const wheel = new Wheel(canvas, { onResult });

  // 恢复开关状态
  amountToggle.checked = localStorage.getItem(AMOUNT_KEY) === '1';

  // 分类下拉
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = '全部分类';
  catSelect.appendChild(optAll);
  for (const c of db.categories) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    catSelect.appendChild(o);
  }

  function currentCategory() {
    return catSelect.value || null;
  }

  function refillWheel() {
    const candidates = db.drawCandidates(SEG_COUNT, currentCategory());
    wheel.setSegments(candidates);
  }

  function updateStats() {
    const s = db.stats();
    statsEl.textContent = `词库 ${s.total} 条 · 已出现 ${s.used} · 未出现 ${s.fresh}`;
  }

  function onResult(entry) {
    db.markUsed(entry);
    resultEl.textContent = entry.text;
    resultCat.textContent = entry.category;
    // 开关打开：随机决定喝多少；关闭：只显示条件，喝多少自己定
    resultAmount.textContent = amountToggle.checked ? '🍺 ' + pickAmount() : '';
    resultEl.classList.remove('pop');
    void resultEl.offsetWidth; // 触发重绘以重放动画
    resultEl.classList.add('pop');
    updateStats();
    // 下一把换一批候选（用上刚更新的优先级）
    refillWheel();
  }

  spinBtn.addEventListener('click', () => wheel.spin());
  canvas.addEventListener('click', () => wheel.spin());
  catSelect.addEventListener('change', refillWheel);
  amountToggle.addEventListener('change', () => {
    localStorage.setItem(AMOUNT_KEY, amountToggle.checked ? '1' : '0');
    // 关掉时立即清掉已显示的酒量
    if (!amountToggle.checked) resultAmount.textContent = '';
  });
  resetBtn.addEventListener('click', () => {
    if (confirm('重置所有词条优先级？（新的一局用）')) {
      db.resetPriorities();
      refillWheel();
      updateStats();
      resultEl.textContent = '已重置，开转吧！';
      resultCat.textContent = '';
      resultAmount.textContent = '';
    }
  });

  // 自适应画布分辨率（用 devicePixelRatio 提升清晰度）
  function fitCanvas() {
    const size = Math.min(canvas.parentElement.clientWidth, 420);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    // 物理像素分辨率
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    // 用 CSS 变量记录逻辑尺寸，绘制按逻辑尺寸进行
    wheel.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wheel.logicalSize = size;
    wheel.draw();
  }
  window.addEventListener('resize', fitCanvas);

  fitCanvas();
  refillWheel();
  updateStats();
})();
