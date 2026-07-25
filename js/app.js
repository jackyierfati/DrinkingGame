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
  const manageSearch = document.getElementById('manage-search');
  const manageAdd = document.getElementById('manage-add');
  const editSheet = document.getElementById('edit-sheet');
  const editTitle = document.getElementById('edit-title');
  const editText = document.getElementById('edit-text');
  const editCat = document.getElementById('edit-cat');
  const editDel = document.getElementById('edit-del');
  const editCancel = document.getElementById('edit-cancel');
  const editSave = document.getElementById('edit-save');
  const FIXED_CATS = ['习惯', '经历', '才艺', '爱好', '感情', '饮食', '外形', '性格', '互动', '其他'];

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

  // 分类下拉（词条增删后分类可能变化，需可重建）
  function buildCategorySelect() {
    const prev = catSelect.value;
    catSelect.innerHTML = '';
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
    // 尽量保持原选择
    if ([...catSelect.options].some((o) => o.value === prev)) catSelect.value = prev;
  }
  buildCategorySelect();

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

  // —— 词条管理 弹窗 ——
  let searchTerm = '';

  function renderManageList() {
    const q = searchTerm.trim();
    const matched = q ? db.entries.filter((e) => e.text.includes(q)) : db.entries;
    browseTitle.textContent = q
      ? `搜索到 ${matched.length} 条`
      : `词条管理（${db.size} 条）`;

    // 按分类分组
    const byCat = {};
    for (const e of matched) (byCat[e.category] = byCat[e.category] || []).push(e);

    browseList.innerHTML = '';
    if (matched.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'browse-empty';
      empty.textContent = '没有匹配的词条';
      browseList.appendChild(empty);
      return;
    }
    for (const cat of db.categories) {
      const list = byCat[cat];
      if (!list || list.length === 0) continue;
      const h = document.createElement('div');
      h.className = 'browse-cat';
      h.textContent = `${cat} · ${list.length}`;
      browseList.appendChild(h);
      for (const e of list) {
        const item = document.createElement('div');
        item.className = 'browse-item' + (e.priority < 0 ? ' used' : '');

        const txt = document.createElement('span');
        txt.className = 'browse-text';
        txt.textContent = e.text;
        if (db.isCustom(e.id)) {
          const tag = document.createElement('span');
          tag.className = 'browse-tag';
          tag.textContent = '自建';
          txt.appendChild(tag);
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'row-btn';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', () => openEdit(e));

        item.appendChild(txt);
        item.appendChild(editBtn);
        browseList.appendChild(item);
      }
    }
  }

  function openManage() {
    searchTerm = '';
    manageSearch.value = '';
    closeEdit();
    renderManageList();
    browseModal.classList.remove('hidden');
  }

  // —— 新增/编辑 表单 ——
  let editingId = null; // null = 新增

  function fillEditCats(selected) {
    editCat.innerHTML = '';
    for (const c of FIXED_CATS) {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      editCat.appendChild(o);
    }
    if (selected) editCat.value = selected;
  }

  function openEdit(entry) {
    editingId = entry ? entry.id : null;
    editTitle.textContent = entry ? '编辑词条' : '新增词条';
    editText.value = entry ? entry.text : '';
    fillEditCats(entry ? entry.category : '其他');
    editDel.style.display = entry ? '' : 'none';
    editSheet.classList.remove('hidden');
    editText.focus();
  }
  function closeEdit() {
    editSheet.classList.add('hidden');
    editingId = null;
  }

  function afterChange() {
    buildCategorySelect();
    refillWheel();
    updateStats();
    renderManageList();
  }

  editSave.addEventListener('click', () => {
    const text = editText.value.trim();
    if (!text) { editText.focus(); return; }
    const cat = editCat.value;
    if (editingId) db.editEntry(editingId, text, cat);
    else db.addEntry(text, cat);
    closeEdit();
    afterChange();
  });
  editDel.addEventListener('click', () => {
    if (editingId && confirm('删除这条词条？')) {
      db.deleteEntry(editingId);
      closeEdit();
      afterChange();
    }
  });
  editCancel.addEventListener('click', closeEdit);

  manageAdd.addEventListener('click', () => openEdit(null));
  manageSearch.addEventListener('input', () => {
    searchTerm = manageSearch.value;
    renderManageList();
  });

  browseBtn.addEventListener('click', openManage);
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

  // 异步加载共享的自定义词条（服务端优先），加载完重建界面
  db.loadCustom().then(() => {
    buildCategorySelect();
    refillWheel();
    updateStats();
  });
})();
