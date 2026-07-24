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

  const db = new EntryDB(3);
  const wheel = new Wheel(canvas, { onResult });

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
  resetBtn.addEventListener('click', () => {
    if (confirm('重置所有词条优先级？（新的一局用）')) {
      db.resetPriorities();
      refillWheel();
      updateStats();
      resultEl.textContent = '已重置，开转吧！';
      resultCat.textContent = '';
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
