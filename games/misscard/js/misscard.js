/*
 * 小姐牌 · 扑克喝酒游戏
 * ------------------------------------------------------------------
 * 单机主持模式：一台设备发牌，全场围观。App 负责发牌、显示谁抽到什么、
 * 自动判定确定性规则（左右喝/自己喝/公杯/K计数），并追踪状态
 * （小姐、神经病、各人手牌、公杯）。口头类玩法（三园/PK/跳7/照相机/摸鼻子）
 * 只弹规则提示，输赢由玩家自行认定。
 *
 * 牌值：A=1，2~10，J=11，Q=12，K=13（大小王暂不做）。
 */
(function () {
  // —— DOM ——
  const $ = (id) => document.getElementById(id);
  const setup = $('setup');
  const game = $('game');
  const countNum = $('count-num');
  const nameInputs = $('name-inputs');
  const turnHint = $('turn-hint');
  const cardEl = $('card');
  const cardRank = $('card-rank');
  const cardName = $('card-name');
  const promptEl = $('prompt');
  const drawBtn = $('draw');
  const cameraTimerBtn = $('camera-timer');
  const pMiss = $('p-miss');
  const pNeuro = $('p-neuro');
  const clearNeuroBtn = $('clear-neuro');
  const pCup = $('p-cup');
  const pHands = $('p-hands');
  const countdownEl = $('countdown');
  const countdownNum = $('countdown-num');

  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const rankLabel = (v) => RANK_LABEL[v] || String(v);

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
      names,
      n: names.length,
      deck: shuffle(buildDeck()),
      drawer: 0,          // 当前摸牌者下标
      miss: null,         // { idx, doubled }
      neuro: null,        // idx
      hands: names.map(() => []), // 每人手牌标签
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
    resetCardDisplay();
    renderPanel();
    updateTurnHint();
  });

  $('restart').addEventListener('click', () => {
    if (state && !state.over && !confirm('重开游戏？当前进度会清空。')) return;
    state = null;
    game.classList.add('hidden');
    setup.classList.remove('hidden');
  });

  // —— 摸牌 ——
  function resetCardDisplay() {
    cardRank.textContent = '🃏';
    cardName.textContent = '点「摸牌」开始';
    promptEl.innerHTML = '';
  }
  function updateTurnHint() {
    if (!state) return;
    if (state.over) { turnHint.innerHTML = '🎉 游戏结束'; return; }
    turnHint.innerHTML = `轮到 <b>${state.names[state.drawer]}</b> 摸牌`;
  }

  drawBtn.addEventListener('click', () => {
    if (!state || state.over) return;
    if (state.deck.length === 0) { endGame('牌摸完了'); return; }
    const v = state.deck.pop();
    const drawer = state.drawer;
    const res = resolve(v, drawer);

    // 展示卡面
    cardRank.textContent = rankLabel(v);
    cardName.textContent = res.title;
    cardEl.classList.remove('flip'); void cardEl.offsetWidth; cardEl.classList.add('flip');
    promptEl.innerHTML = res.lines.map((l) => `<div class="pline">${l}</div>`).join('');

    renderPanel();

    // 轮到下一家（除非结束）
    if (!state.over) {
      state.drawer = (state.drawer + 1) % state.n;
    }
    updateTurnHint();
    updateDeckCount();
  });

  function updateDeckCount() {
    // 把剩余牌数附在摸牌按钮上
    drawBtn.textContent = state.over ? '游戏结束' : `摸 牌（剩 ${state.deck.length}）`;
    drawBtn.disabled = state.over;
  }

  // —— 逐张牌的规则解析 ——
  function name(idx) { return state.names[idx]; }
  function leftOf(idx) { return name((idx - 1 + state.n) % state.n); }   // 左边＝上一家
  function rightOf(idx) { return name((idx + 1) % state.n); }           // 右边＝下一家

  function missReminder(canCall) {
    if (!state.miss) return null;
    if (!canCall) return '🏷 此时<b>不能</b>叫小姐（9 / K 除外规则）';
    const x2 = state.miss.doubled ? '（小姐喝量 ×2）' : '';
    return `🏷 可叫小姐：小姐何在 → 大爷吃好喝好 → 谢谢${x2}<br><span class="dim">大爷不说「谢谢」，这次小姐免喝</span>`;
  }

  function resolve(v, drawer) {
    const who = name(drawer);
    switch (v) {
      case 1: // 挡酒牌
        addHand(drawer, '挡酒');
        return { title: 'A · 挡酒牌', lines: [
          `🖐 <b>${who}</b> 得到【挡酒牌】`,
          '该自己喝时，可指定在场任一人代喝。<b>一次性</b>。',
          '<span class="dim">自己是小姐时无效，且不能指定小姐。</span>',
        ] };

      case 2: // 小姐牌
        if (state.miss && state.miss.idx === drawer) {
          state.miss.doubled = true;
          return { title: '2 · 小姐牌', lines: [
            `🏷 <b>${who}</b> 又摸到小姐！<b>小姐喝量 ×2</b>`,
          ] };
        }
        state.miss = { idx: drawer, doubled: false };
        return { title: '2 · 小姐牌', lines: [
          `🏷 <b>${who}</b> 成为【小姐】`,
          '之后任何人喝酒都可叫：小姐何在 → 大爷吃好喝好 → 谢谢。',
          '大爷喝多少，小姐喝多少。<b>大爷不说谢谢，这次小姐免喝。</b>',
          '<span class="dim">不能提醒在场有小姐！新的小姐出现后接替。</span>',
        ] };

      case 3: // 逛三园
        return { title: '3 · 逛三园', lines: [
          `💬 <b>${who}</b> 指定一个品类开逛`,
          `品类成员数必须 ≥ 在场人数（${state.n} 个），轮流说，`,
          '卡壳或重复的喝。',
        ] };

      case 4: // PK
        return { title: '4 · PK', lines: [
          `💬 <b>${who}</b> 找任意一人 PK 任意游戏`,
          '输家喝。',
        ] };

      case 5: // 照相机
        addHand(drawer, '照相机');
        return { title: '5 · 照相机', lines: [
          `🖐 <b>${who}</b> 得到【照相机】`,
          '随时喊「照相机」→ 全场 10 秒定格，动/笑者喝；没人动则你喝。',
          '<span class="dim">可点下方「📸 10秒」帮忙计时。下张照相机出现前没用掉 → 你喝。</span>',
        ] };

      case 6: // 摸鼻子
        addHand(drawer, '摸鼻子');
        return { title: '6 · 摸鼻子', lines: [
          `🖐 <b>${who}</b> 得到【摸鼻子】`,
          '随时摸鼻子 → 大家跟着摸，最慢的喝。',
          '<span class="dim">下张摸鼻子出现前没用掉 → 你喝。</span>',
        ] };

      case 7: { // 跳7
        const lines = [
          `💬 从 <b>${who}</b> 开始报数`,
          '数到 7 及 7 的倍数（7/14/17/21…）要拍手或喊「过」，说错的喝。',
        ];
        if (state.n === 7) lines.push('<b>7 人局特别规则：拍手/过 ＝ 报数方向反转！</b>');
        return { title: '7 · 跳7', lines };
      }

      case 8: { // 厕所牌
        if (state.hands[drawer].includes('厕所')) {
          removeHand(drawer, '厕所');
          return { title: '8 · 厕所牌', lines: [
            `🚽 <b>${who}</b> 手上已有厕所牌，两张 8 <b>作废</b>`,
            '<span class="dim">两张都收走了。</span>',
          ] };
        }
        addHand(drawer, '厕所');
        return { title: '8 · 厕所牌', lines: [
          `🖐 <b>${who}</b> 得到【厕所牌】`,
          '游戏中有此牌才能上厕所。<span class="dim">同一人两张 8 作废。</span>',
        ] };
      }

      case 9: // 自己喝
        return { title: '9 · 自己喝', lines: [
          `⚡ <b>${who}</b> 自己喝一口！`,
          missReminder(false),
        ].filter(Boolean) };

      case 10: // 神经病
        state.neuro = drawer;
        return { title: '10 · 神经病', lines: [
          `🤪 <b>${who}</b> 大声宣布「我是神经病」`,
          '接下来谁和 TA 说话/互动，谁喝！互动一次后解除。',
          '<span class="dim">对小姐无效。可点面板「解除」。</span>',
        ] };

      case 11: // 左边喝
        return { title: 'J · 左边喝', lines: [
          `⚡ <b>${who}</b> 左边的 <b>${leftOf(drawer)}</b> 喝！`,
          missReminder(true),
        ].filter(Boolean) };

      case 12: // 右边喝
        return { title: 'Q · 右边喝', lines: [
          `⚡ <b>${who}</b> 右边的 <b>${rightOf(drawer)}</b> 喝！`,
          missReminder(true),
        ].filter(Boolean) };

      case 13: { // 公杯 K
        state.kCount++;
        if (state.kCount < 4) {
          return { title: `K · 公杯（第 ${state.kCount} 张）`, lines: [
            `🍶 <b>${who}</b> 往公杯里随意加酒`,
            `<span class="dim">已出 ${state.kCount}/4 张 K，第 4 张要喝掉整杯。</span>`,
          ] };
        }
        endGame(`${who} 喝掉整个公杯`);
        return { title: 'K · 终局！', lines: [
          `🍶 第 4 张 K！<b>${who}</b> 喝掉整个公杯 🍻`,
          '<b>游戏结束！</b>',
          missReminder(false),
        ].filter(Boolean) };
      }

      default:
        return { title: rankLabel(v), lines: ['—'] };
    }
  }

  function addHand(idx, label) { state.hands[idx].push(label); }
  function removeHand(idx, label) {
    const i = state.hands[idx].indexOf(label);
    if (i >= 0) state.hands[idx].splice(i, 1);
  }

  function endGame(reason) {
    state.over = true;
    turnHint.innerHTML = `🎉 游戏结束 · ${reason}`;
  }

  // —— 状态面板 ——
  const HAND_EMOJI = { '挡酒': '🛡', '照相机': '📸', '摸鼻子': '👃', '厕所': '🚽' };

  function renderPanel() {
    // 小姐
    if (state.miss) {
      pMiss.innerHTML = name(state.miss.idx) + (state.miss.doubled ? ' <b>(×2)</b>' : '');
    } else pMiss.textContent = '无';

    // 神经病
    if (state.neuro != null) {
      pNeuro.textContent = name(state.neuro);
      clearNeuroBtn.classList.remove('hidden');
    } else {
      pNeuro.textContent = '无';
      clearNeuroBtn.classList.add('hidden');
    }

    // 公杯
    pCup.textContent = state.kCount === 0
      ? `空 · 出K 0/4`
      : `已加酒 ${Math.min(state.kCount, 3)} 次 · 出K ${state.kCount}/4`;

    // 手牌
    pHands.innerHTML = '';
    state.names.forEach((nm, idx) => {
      if (state.hands[idx].length === 0) return;
      const row = document.createElement('div');
      row.className = 'hand-row';
      const nameEl = document.createElement('span');
      nameEl.className = 'hand-name';
      nameEl.textContent = nm;
      row.appendChild(nameEl);
      state.hands[idx].forEach((label) => {
        const chip = document.createElement('span');
        chip.className = 'hand-chip';
        chip.innerHTML = `${HAND_EMOJI[label] || ''}${label}`;
        const x = document.createElement('button');
        x.className = 'chip-x';
        x.textContent = '✕';
        x.title = '用掉/移除';
        x.addEventListener('click', () => { removeHand(idx, label); renderPanel(); });
        chip.appendChild(x);
        row.appendChild(chip);
      });
      pHands.appendChild(row);
    });
    if (pHands.innerHTML === '') {
      pHands.innerHTML = '<div class="hand-empty">暂无手牌（挡酒/照相机/摸鼻子/厕所）</div>';
    }
  }

  clearNeuroBtn.addEventListener('click', () => {
    state.neuro = null;
    renderPanel();
  });

  // —— 照相机 10 秒倒计时 ——
  let cdTimer = null;
  cameraTimerBtn.addEventListener('click', () => {
    if (cdTimer) return;
    let n = 10;
    countdownNum.textContent = n;
    countdownEl.classList.remove('hidden');
    cdTimer = setInterval(() => {
      n--;
      countdownNum.textContent = n > 0 ? n : '📸';
      if (n <= 0) {
        clearInterval(cdTimer); cdTimer = null;
        setTimeout(() => countdownEl.classList.add('hidden'), 700);
      }
    }, 1000);
  });
  countdownEl.addEventListener('click', () => {
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    countdownEl.classList.add('hidden');
  });
})();
