/*
 * 应用主逻辑：把数据库、转盘、随机闪现、音乐、观看词条连起来
 */
(function () {
  const SEG_COUNT = 8; // 转盘盘面显示几格候选

  const canvas = document.getElementById('wheel');
  const spinBtn = document.getElementById('spin');
  const resultEl = document.getElementById('result');
  const resultCat = document.getElementById('result-cat');
  const resultAmount = document.getElementById('result-amount');
  const catSelect = document.getElementById('category');
  const statsEl = document.getElementById('stats');
  const resetBtn = document.getElementById('reset');
  const amountToggle = document.getElementById('amount-toggle');
  const modeSwitch = document.getElementById('mode-switch');
  const stageWheel = document.getElementById('stage-wheel');
  const stageFlash = document.getElementById('stage-flash');
  const flashText = document.getElementById('flash-text');
  const musicBtn = document.getElementById('music-btn');
  const browseBtn = document.getElementById('browse-btn');
  const browseModal = document.getElementById('browse-modal');
  const browseClose = document.getElementById('browse-close');
  const browseList = document.getElementById('browse-list');
  const browseTitle = document.getElementById('browse-title');

  // —— 随机喝多少 ——
  const AMOUNTS = [
    { text: '喝一口', w: 3 },
    { text: '喝两口', w: 2.5 },
    { text: '喝三口', w: 1.5 },
    { text: '喝半杯', w: 1 },
    { text: '随意抿一口', w: 1 },
    { text: '干了这杯！', w: 0.4 },
  ];
  const AMOUNT_KEY = 'drinkinggame.randomAmount.v1';
  const MODE_KEY = 'drinkinggame.mode.v1';

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
  const flash = new Flash(flashText, { onResult });
  const music = new Music();

  amountToggle.checked = localStorage.getItem(AMOUNT_KEY) === '1';
  let mode = localStorage.getItem(MODE_KEY) || 'wheel';

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
    flash.setPool(candidates); // 闪现模式用同一批候选做视觉跳动
  }

  function updateStats() {
    const s = db.stats();
    statsEl.textContent = `词库 ${s.total} 条 · 已出现 ${s.used} · 未出现 ${s.fresh}`;
  }

  function onResult(entry) {
    db.markUsed(entry);
    resultEl.textContent = entry.text;
    resultCat.textContent = entry.category;
    resultAmount.textContent = amountToggle.checked ? '🍺 ' + pickAmount() : '';
    resultEl.classList.remove('pop');
    void resultEl.offsetWidth;
    resultEl.classList.add('pop');
    updateStats();
    refillWheel(); // 下一把换一批候选
  }

  // —— 开始（按当前模式触发）——
  function start() {
    if (mode === 'wheel') {
      wheel.spin();
    } else {
      if (flash.running) return;
      // 按优先级抽一条作为最终结果，动画只是视觉
      const pick = db.drawCandidates(1, currentCategory())[0];
      if (pick) flash.run(pick);
    }
  }

  // —— 模式切换 ——
  function applyMode() {
    const wheelOn = mode === 'wheel';
    stageWheel.classList.toggle('hidden', !wheelOn);
    stageFlash.classList.toggle('hidden', wheelOn);
    spinBtn.textContent = wheelOn ? '转 起 来' : '开 始';
    modeSwitch.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (wheelOn) requestAnimationFrame(fitCanvas); // 切回转盘时重算画布尺寸
  }

  modeSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    mode = btn.dataset.mode;
    localStorage.setItem(MODE_KEY, mode);
    applyMode();
  });

  // —— 观看词条 弹窗 ——
  function openBrowse() {
    const byCat = {};
    for (const e of db.entries) {
      (byCat[e.category] = byCat[e.category] || []).push(e);
    }
    browseTitle.textContent = `全部词条（${db.size} 条）`;
    browseList.innerHTML = '';
    for (const cat of db.categories) {
      const list = byCat[cat] || [];
      const h = document.createElement('div');
      h.className = 'browse-cat';
      h.textContent = `${cat} · ${list.length}`;
      browseList.appendChild(h);
      for (const e of list) {
        const item = document.createElement('div');
        item.className = 'browse-item' + (e.priority < 0 ? ' used' : '');
        item.textContent = e.text;
        browseList.appendChild(item);
      }
    }
    browseModal.classList.remove('hidden');
  }
  browseBtn.addEventListener('click', openBrowse);
  browseClose.addEventListener('click', () => browseModal.classList.add('hidden'));
  browseModal.addEventListener('click', (e) => {
    if (e.target === browseModal) browseModal.classList.add('hidden');
  });

  // —— 音乐 ——
  musicBtn.addEventListener('click', () => {
    const on = music.toggle();
    musicBtn.textContent = on ? '🔊 音乐' : '🔇 音乐';
    musicBtn.classList.toggle('active', on);
  });

  // —— 其余交互 ——
  spinBtn.addEventListener('click', start);
  canvas.addEventListener('click', start);
  catSelect.addEventListener('change', refillWheel);
  amountToggle.addEventListener('change', () => {
    localStorage.setItem(AMOUNT_KEY, amountToggle.checked ? '1' : '0');
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

  // —— 画布自适应 ——
  function fitCanvas() {
    const size = Math.min(canvas.parentElement.clientWidth, 420);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    wheel.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wheel.logicalSize = size;
    wheel.draw();
  }
  window.addEventListener('resize', () => { if (mode === 'wheel') fitCanvas(); });

  // —— 启动 ——
  applyMode();
  fitCanvas();
  refillWheel();
  updateStats();
})();
