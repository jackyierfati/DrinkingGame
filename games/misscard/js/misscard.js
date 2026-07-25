/*
 * 小姐牌 · 扑克喝酒游戏（圆桌版）
 * ------------------------------------------------------------------
 * 单机主持模式：一台设备发牌，全场围观。玩家围成圆桌，状态直接标在座位上。
 * App 自动判定确定性规则（左右喝/自己喝/公杯/K计数），追踪状态
 * （小姐/神经病/手牌/公杯），并强制单张（照相机/摸鼻子/神经病同时只能有一张待用，
 * 出新的就判上一个没用掉→罚酒+毒舌吐槽）。口头玩法只弹提示，输赢玩家自认。
 * 牌值：A=1，2~10，J=11，Q=12，K=13（大小王暂不做）。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const setup = $('setup');
  const game = $('game');
  const countNum = $('count-num');
  const nameInputs = $('name-inputs');
  const turnHint = $('turn-hint');
  const table = $('table');
  const cardRank = $('card-rank');
  const cardEl = $('card');
  const cardTitle = $('card-title');
  const promptEl = $('prompt');
  const drawBtn = $('draw');
  const cameraTimerBtn = $('camera-timer');
  const clearNeuroBtn = $('clear-neuro');
  const cupMini = $('cup-mini');
  const toastEl = $('toast');
  const countdownEl = $('countdown');
  const countdownNum = $('countdown-num');

  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const rankLabel = (v) => RANK_LABEL[v] || String(v);

  // —— 毒舌吐槽（每类 5 条，%name% 会替换成被点名的玩家）——
  const ROASTS = {
    camera: [
      '哎哟哟，%name%，手机不会用啊？照相机在手里焐热了都不喊，自己喝一口冷静下！',
      '%name% 的照相机怕是坏了吧，等半天不出片，罚酒一口！',
      '全场都等 %name% 喊照相机呢，结果人忘了自己有牌……这口替你记性喝！',
      '摄影师 %name% 临阵脱逃，胶卷都过期了，罚一口！',
      '%name%，你这照相机是当装饰品挂着的？没用掉，喝！',
    ],
    nose: [
      '%name%，鼻子长脸上是摆设吗？摸鼻子牌都没使出去，喝一口醒醒！',
      '等了半天没等到 %name% 摸鼻子，你手是被绑住了？喝！',
      '%name% 的摸鼻子牌自己先睡着了，罚酒一口叫醒它！',
      '摸鼻子大师 %name% 全程零动作，鼻子表示很失望，罚一口！',
      '%name%，牌都捂馊了还不摸鼻子，这口是你欠大家的！',
    ],
    neuro: [
      '%name% 这神经病没人搭理，尴尬不？自己喝一口压压惊！',
      '新神经病上任，前任 %name% 光荣下岗，喝一口交个班！',
      '%name%，你这神经病装得没人信啊，罚酒一口重新做人！',
      '全场没一个被 %name% 的神经病带跑，演技拙劣，罚一口！',
      '%name% 的神经病还没发作完就被顶替了，喝口酒办个离职手续！',
    ],
  };
  function pickRoast(type, playerName) {
    const arr = ROASTS[type];
    return arr[Math.floor(Math.random() * arr.length)].replaceAll('%name%', playerName);
  }

  // —— 设置界面 ——
  let count = 4;
  const MIN = 2, MAX = 12;
  function renderNameInputs() {
    const prev = [...nameInputs.querySelectorAll('input')].map((i) => i.value);
    nameInputs.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = `玩家 ${i + 1}`;
      inp.value = prev[i] || '';
      inp.maxLength = 8;
      nameInputs.appendChild(inp);
    }
  }
  countNum.textContent = count;
  renderNameInputs();
  $('count-minus').addEventListener('click', () => {
    if (count > MIN) { count--; countNum.textContent = count; renderNameInputs(); }
  });
  $('count-plus').addEventListener('click', () => {
    if (count < MAX) { count++; countNum.textContent = count; renderNameInputs(); }
  });

  // —— 游戏状态 ——
  let state = null;
  function newState(names) {
    return {
      names, n: names.length,
      deck: shuffle(buildDeck()),
      drawer: 0,        // 当前该摸牌的人
      miss: null,       // { idx, doubled }
      neuro: null,      // idx
      hands: names.map(() => []),
      kCount: 0,
      over: false,
    };
  }
  function buildDeck() {
    const d = [];
    for (let v = 1; v <= 13; v++) for (let s = 0; s < 4; s++) d.push(v);
    return d;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  $('start-game').addEventListener('click', () => {
    const names = [...nameInputs.querySelectorAll('input')].map((i, idx) =>
      (i.value.trim() || `玩家${idx + 1}`)
    );
    state = newState(names);
    setup.classList.add('hidden');
    game.classList.remove('hidden');
    cardRank.textContent = '🃏';
    cardTitle.textContent = '点「摸牌」开始';
    promptEl.innerHTML = '';
    renderTable();
    updateTurnHint();
    updateDrawBtn();
  });

  $('restart').addEventListener('click', () => {
    if (state && !state.over && !confirm('重开游戏？当前进度会清空。')) return;
    state = null;
    game.classList.add('hidden');
    setup.classList.remove('hidden');
  });

  // —— 摸牌 ——
  function updateTurnHint() {
    if (!state) return;
    turnHint.innerHTML = state.over
      ? '🎉 游戏结束'
      : `轮到 <b>${state.names[state.drawer]}</b> 摸牌`;
  }
  function updateDrawBtn() {
    drawBtn.textContent = state.over ? '游戏结束' : `摸 牌（剩 ${state.deck.length}）`;
    drawBtn.disabled = state.over;
  }

  drawBtn.addEventListener('click', () => {
    if (!state || state.over) return;
    if (state.deck.length === 0) { endGame('牌摸完了'); renderTable(); updateTurnHint(); updateDrawBtn(); return; }
    const v = state.deck.pop();
    const drawer = state.drawer;
    const res = resolve(v, drawer);

    cardRank.textContent = rankLabel(v);
    cardTitle.textContent = res.title;
    cardEl.classList.remove('flip'); void cardEl.offsetWidth; cardEl.classList.add('flip');
    promptEl.innerHTML = (res.detail || []).map((l) => `<div class="pline">${l}</div>`).join('');
    if (res.toast) showToast(res.toast.text, res.toast.cls);

    if (!state.over) state.drawer = (state.drawer + 1) % state.n;
    renderTable();
    updateTurnHint();
    updateDrawBtn();
  });

  // —— 规则解析 ——
  const name = (idx) => state.names[idx];
  const leftOf = (idx) => name((idx - 1 + state.n) % state.n);   // 左＝上一家
  const rightOf = (idx) => name((idx + 1) % state.n);            // 右＝下一家
  const holderOf = (label) => state.hands.findIndex((h) => h.includes(label));

  function missLine(canCall) {
    if (!state.miss) return null;
    if (!canCall) return '🚫 此时<b>不能</b>叫小姐';
    const x2 = state.miss.doubled ? '（老鸨喝量 ×2）' : '';
    return `💋 可叫小姐：小姐何在 → 大爷吃好喝好 → 谢谢${x2}　<span class="dim">大爷不说谢谢则免喝</span>`;
  }

  function resolve(v, drawer) {
    const who = name(drawer);
    switch (v) {
      case 1:
        addHand(drawer, '挡酒');
        return { title: 'A · 挡酒牌', detail: [
          `🛡 <b>${who}</b> 得到【挡酒牌】，该自己喝时可指定他人代喝，<b>一次性</b>。`,
          '<span class="dim">自己是小姐时无效，且不能指定小姐。</span>',
        ] };

      case 2: {
        if (state.miss && state.miss.idx === drawer) {
          state.miss.doubled = true;
          return { title: '2 · 小姐牌', toast: { text: `👑 ${who} 荣封「万年老鸨」！喝量 ×2`, cls: 'gold' },
            detail: [`👑 <b>${who}</b> 又摸到小姐，晋升<b>万年老鸨</b>，之后喝量 ×2！`] };
        }
        const prev = state.miss ? name(state.miss.idx) : null;
        state.miss = { idx: drawer, doubled: false };
        const detail = [
          `💋 <b>${who}</b> 成为【小姐】。此后任何人喝酒可叫：小姐何在 → 大爷吃好喝好 → 谢谢。`,
          '大爷喝多少小姐喝多少；<b>大爷不说谢谢，这次小姐免喝</b>。',
          '<span class="dim">不能提醒在场有小姐！</span>',
        ];
        return { title: '2 · 小姐牌',
          toast: prev ? { text: `🎉 ${prev} 成功下岗！`, cls: 'good' } : { text: `💋 ${who} 上任小姐`, cls: 'pink' },
          detail };
      }

      case 3:
        return { title: '3 · 逛三园', detail: [
          `💬 <b>${who}</b> 指定一个品类，成员数须 ≥ 在场人数（${state.n} 个）。`,
          '轮流说，卡壳或重复的喝。',
        ] };

      case 4:
        return { title: '4 · PK', detail: [`💬 <b>${who}</b> 找任意一人 PK 任意游戏，输家喝。`] };

      case 5: {
        const detail = [`📸 <b>${who}</b> 得到【照相机】，随时喊「照相机」→ 全场 10 秒定格，动/笑者喝；没人动则你喝。`];
        const prev = holderOf('照相机');
        let toast = null;
        if (prev >= 0) { const r = pickRoast('camera', name(prev)); removeHand(prev, '照相机'); detail.unshift(`⚠️ ${r}`); toast = { text: r, cls: 'roast' }; }
        addHand(drawer, '照相机');
        return { title: '5 · 照相机', detail, toast };
      }

      case 6: {
        const detail = [`👃 <b>${who}</b> 得到【摸鼻子】，随时摸鼻子 → 大家跟摸，最慢的喝。`];
        const prev = holderOf('摸鼻子');
        let toast = null;
        if (prev >= 0) { const r = pickRoast('nose', name(prev)); removeHand(prev, '摸鼻子'); detail.unshift(`⚠️ ${r}`); toast = { text: r, cls: 'roast' }; }
        addHand(drawer, '摸鼻子');
        return { title: '6 · 摸鼻子', detail, toast };
      }

      case 7: {
        const detail = [
          `💬 从 <b>${who}</b> 开始报数，7 及 7 的倍数要拍手或喊「过」，说错的喝。`,
        ];
        if (state.n === 7) detail.push('<b>7 人局：拍手/过 ＝ 报数方向反转！</b>');
        return { title: '7 · 跳7', detail };
      }

      case 8: {
        if (state.hands[drawer].includes('厕所')) {
          removeHand(drawer, '厕所');
          return { title: '8 · 厕所牌', detail: [`🚽 <b>${who}</b> 手上已有厕所牌，两张 8 <b>作废</b>（都收走）。`] };
        }
        addHand(drawer, '厕所');
        return { title: '8 · 厕所牌', detail: [
          `🚽 <b>${who}</b> 得到【厕所牌】，游戏中有此牌才能上厕所。`,
          '<span class="dim">同一人两张 8 作废。</span>',
        ] };
      }

      case 9:
        return { title: '9 · 自己喝', detail: [`⚡ <b>${who}</b> 自己喝一口！`, missLine(false)].filter(Boolean) };

      case 10: {
        const detail = [`🤪 <b>${who}</b> 大声宣布「我是神经病」，谁跟 TA 互动谁喝，互动一次后解除。`,
          '<span class="dim">对小姐无效。</span>'];
        let toast = null;
        if (state.neuro != null) { const r = pickRoast('neuro', name(state.neuro)); detail.unshift(`⚠️ ${r}`); toast = { text: r, cls: 'roast' }; }
        state.neuro = drawer;
        return { title: '10 · 神经病', detail, toast };
      }

      case 11:
        return { title: 'J · 左边喝', detail: [`⚡ <b>${who}</b> 左边的 <b>${leftOf(drawer)}</b> 喝！`, missLine(true)].filter(Boolean) };

      case 12:
        return { title: 'Q · 右边喝', detail: [`⚡ <b>${who}</b> 右边的 <b>${rightOf(drawer)}</b> 喝！`, missLine(true)].filter(Boolean) };

      case 13: {
        state.kCount++;
        if (state.kCount < 4) {
          return { title: `K · 公杯（第 ${state.kCount} 张）`, detail: [
            `🍶 <b>${who}</b> 往公杯里随意加酒。<span class="dim">已出 ${state.kCount}/4 张 K。</span>`,
          ] };
        }
        endGame(`${who} 喝掉整个公杯`);
        return { title: 'K · 终局！',
          toast: { text: `🍻 ${who} 喝掉整杯，游戏结束！`, cls: 'gold' },
          detail: [`🍶 第 4 张 K！<b>${who}</b> 喝掉整个公杯，<b>游戏结束</b>！`, missLine(false)].filter(Boolean) };
      }

      default:
        return { title: rankLabel(v), detail: ['—'] };
    }
  }

  function addHand(idx, label) { state.hands[idx].push(label); }
  function removeHand(idx, label) {
    const i = state.hands[idx].indexOf(label);
    if (i >= 0) state.hands[idx].splice(i, 1);
  }
  function endGame(reason) { state.over = true; turnHint.innerHTML = `🎉 游戏结束 · ${reason}`; }

  // —— 圆桌渲染 ——
  const HAND_EMOJI = { '挡酒': '🛡', '照相机': '📸', '摸鼻子': '👃', '厕所': '🚽' };

  function renderTable() {
    // 公杯
    cupMini.textContent = state.kCount === 0
      ? '🍶 出K 0/4'
      : `🍶 加酒 ${Math.min(state.kCount, 3)} 次 · K ${state.kCount}/4`;

    // 清掉旧座位（保留 center）
    table.querySelectorAll('.seat').forEach((s) => s.remove());

    const R = 43; // 座位半径（%）
    for (let i = 0; i < state.n; i++) {
      const ang = (-90 + (360 * i) / state.n) * Math.PI / 180;
      const x = 50 + R * Math.cos(ang);
      const y = 50 + R * Math.sin(ang);

      const seat = document.createElement('div');
      seat.className = 'seat' + (i === state.drawer && !state.over ? ' current' : '');
      seat.style.left = x + '%';
      seat.style.top = y + '%';

      const badges = [];
      if (state.miss && state.miss.idx === i) badges.push(state.miss.doubled ? '👑' : '💋');
      if (state.neuro === i) badges.push('🤪');

      const hands = state.hands[i].map((h) => HAND_EMOJI[h] || '').join('');

      seat.innerHTML = `
        <div class="seat-badges">${badges.join('')}</div>
        <div class="seat-name">${escapeHtml(state.names[i])}</div>
        ${state.miss && state.miss.idx === i && state.miss.doubled ? '<div class="seat-title">万年老鸨</div>' : ''}
        <div class="seat-hands">${hands}</div>
      `;
      table.appendChild(seat);
    }

    // 神经病解除按钮
    clearNeuroBtn.classList.toggle('hidden', state.neuro == null);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  clearNeuroBtn.addEventListener('click', () => {
    if (state) { state.neuro = null; renderTable(); }
  });

  // —— 飘字 toast ——
  let toastTimer = null;
  function showToast(text, cls) {
    toastEl.textContent = text;
    toastEl.className = 'toast ' + (cls || '');
    toastEl.classList.remove('hidden');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.classList.add('hidden'), 300);
    }, 2800);
  }

  // —— 照相机 10 秒倒计时 ——
  let cdTimer = null;
  cameraTimerBtn.addEventListener('click', () => {
    if (cdTimer) return;
    let nleft = 10;
    countdownNum.textContent = nleft;
    countdownEl.classList.remove('hidden');
    cdTimer = setInterval(() => {
      nleft--;
      countdownNum.textContent = nleft > 0 ? nleft : '📸';
      if (nleft <= 0) { clearInterval(cdTimer); cdTimer = null; setTimeout(() => countdownEl.classList.add('hidden'), 700); }
    }, 1000);
  });
  countdownEl.addEventListener('click', () => {
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    countdownEl.classList.add('hidden');
  });
})();
