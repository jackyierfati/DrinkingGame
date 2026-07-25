/*
 * 开Bus · Ride the Bus（自动裁判版）
 * ------------------------------------------------------------------
 * 单机主持模式。App 真发一副带花色的牌并自动判定。三环节：
 *  ① 猜牌：每人 4 张，逐张猜（vs7 / vs第一张 / 之间之外 / 花色见过），
 *     猜错自己喝1口，相等「不大不小」喝双倍；4 张留作筹码。
 *  ② 牌阵：台面 人数×2 张扣牌，分 人数 组（上/下）。逐组翻开，
 *     手里有同点数的牌可打出：上牌→自己喝、下牌→指定喝，喝 组号 口，牌消耗。
 *  ③ 开Bus：牌阵后剩牌点数最大者（并列都上）开 7 张牌，逐张猜大小
 *     （首张 vs7，之后 vs 上一张），猜错喝1口并从头再来，牌留明；通关下车。
 * 点数：A=1 … K=13。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const SUITS = ['♠', '♥', '♣', '♦'];
  const RED = new Set([1, 3]); // ♥♦ 红色
  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const rankLabel = (r) => RANK_LABEL[r] || String(r);

  // —— 牌 & 牌堆 ——
  function buildDeck() {
    const d = [];
    for (let r = 1; r <= 13; r++) for (let s = 0; s < 4; s++) d.push({ rank: r, suit: s });
    return shuffle(d);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function cardEl(card, faceDown) {
    const el = document.createElement('div');
    el.className = 'pcard' + (faceDown ? ' back' : (RED.has(card.suit) ? ' red' : ' black'));
    if (!faceDown) el.innerHTML = `<span class="pc-rank">${rankLabel(card.rank)}</span><span class="pc-suit">${SUITS[card.suit]}</span>`;
    return el;
  }

  // —— 设置 ——
  let count = 4;
  const MIN = 2, MAX = 8;
  const nameInputs = $('name-inputs');
  function renderNameInputs() {
    const prev = [...nameInputs.querySelectorAll('input')].map((i) => i.value);
    nameInputs.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.placeholder = `玩家 ${i + 1}`; inp.value = prev[i] || ''; inp.maxLength = 8;
      nameInputs.appendChild(inp);
    }
  }
  $('count-num').textContent = count;
  renderNameInputs();
  $('count-minus').addEventListener('click', () => { if (count > MIN) { count--; $('count-num').textContent = count; renderNameInputs(); } });
  $('count-plus').addEventListener('click', () => { if (count < MAX) { count++; $('count-num').textContent = count; renderNameInputs(); } });

  // —— 状态 ——
  let S = null;

  $('start-game').addEventListener('click', () => {
    const names = [...nameInputs.querySelectorAll('input')].map((i, idx) => (i.value.trim() || `玩家${idx + 1}`));
    S = {
      names, n: names.length,
      deck: buildDeck(),
      hands: names.map(() => []),
    };
    showScreen('phase1');
    startPhase1();
  });
  $('restart').addEventListener('click', () => {
    if (S && !confirm('重开游戏？当前进度会清空。')) return;
    S = null; showScreen('setup');
  });
  $('over-again').addEventListener('click', () => { S = null; showScreen('setup'); });

  function showScreen(id) {
    ['setup', 'phase1', 'phase2', 'phase3', 'over'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
  }

  // ============ 第一环节 · 猜牌 ============
  function startPhase1() {
    S.p1 = { player: 0, step: 0 };
    renderP1();
  }
  function renderP1() {
    const { player, step } = S.p1;
    $('p1-who').innerHTML = `<b>${S.names[player]}</b> 的第 ${step + 1}/4 张`;
    // 已发的牌
    const cardsBox = $('p1-cards');
    cardsBox.innerHTML = '';
    S.hands[player].forEach((c) => cardsBox.appendChild(cardEl(c, false)));
    for (let k = S.hands[player].length; k < 4; k++) { const ph = document.createElement('div'); ph.className = 'pcard slot'; cardsBox.appendChild(ph); }

    $('p1-result').textContent = '';
    $('p1-next').classList.add('hidden');
    $('p1-choices').innerHTML = '';

    const Q = ['比 7 大，还是小？', '比第①张大，还是小？', '在①②之间，还是之外？', '花色在前 3 张出现过吗？'];
    $('p1-question').textContent = Q[step];

    const choices = [
      [['大（＞7）', 'big'], ['小（＜7）', 'small']],
      [['大', 'big'], ['小', 'small']],
      [['之间', 'in'], ['之外', 'out']],
      [['出现过', 'seen'], ['没出现', 'unseen']],
    ][step];
    choices.forEach(([label, val]) => {
      const b = document.createElement('button');
      b.className = 'choice'; b.textContent = label;
      b.addEventListener('click', () => guessP1(val));
      $('p1-choices').appendChild(b);
    });
  }

  function guessP1(choice) {
    const { player, step } = S.p1;
    const card = S.deck.pop();
    const hand = S.hands[player];
    let outcome; // 'right' | 'wrong' | 'tie'
    let truth = '';

    if (step === 0) {
      if (card.rank === 7) outcome = 'tie';
      else { const big = card.rank > 7; truth = big ? '大' : '小'; outcome = (choice === (big ? 'big' : 'small')) ? 'right' : 'wrong'; }
    } else if (step === 1) {
      const f = hand[0].rank;
      if (card.rank === f) outcome = 'tie';
      else { const big = card.rank > f; truth = big ? '大' : '小'; outcome = (choice === (big ? 'big' : 'small')) ? 'right' : 'wrong'; }
    } else if (step === 2) {
      const lo = Math.min(hand[0].rank, hand[1].rank), hi = Math.max(hand[0].rank, hand[1].rank);
      if (card.rank === lo || card.rank === hi) outcome = 'tie';
      else { const inside = card.rank > lo && card.rank < hi; truth = inside ? '之间' : '之外'; outcome = (choice === (inside ? 'in' : 'out')) ? 'right' : 'wrong'; }
    } else {
      const seen = hand.slice(0, 3).some((c) => c.suit === card.suit);
      truth = seen ? '出现过' : '没出现'; outcome = (choice === (seen ? 'seen' : 'unseen')) ? 'right' : 'wrong';
    }

    hand.push(card);
    // 展示
    $('p1-choices').innerHTML = '';
    const cardsBox = $('p1-cards');
    cardsBox.innerHTML = '';
    hand.forEach((c) => cardsBox.appendChild(cardEl(c, false)));
    for (let k = hand.length; k < 4; k++) { const ph = document.createElement('div'); ph.className = 'pcard slot'; cardsBox.appendChild(ph); }

    const res = $('p1-result');
    if (outcome === 'tie') {
      res.className = 'result gold';
      res.innerHTML = `🎯 运气真好，不大不小！<b>${S.names[player]}</b> 喝双倍（2 口）`;
      toast('🎯 不大不小，喝双倍！', 'gold');
    } else if (outcome === 'right') {
      res.className = 'result good';
      res.innerHTML = `✅ 猜对了（${truth}），不用喝`;
    } else {
      res.className = 'result bad';
      res.innerHTML = `❌ 猜错了（实际是 ${truth}），<b>${S.names[player]}</b> 喝 1 口`;
    }
    $('p1-next').classList.remove('hidden');
  }

  $('p1-next').addEventListener('click', () => {
    S.p1.step++;
    if (S.p1.step >= 4) {
      S.p1.step = 0; S.p1.player++;
      if (S.p1.player >= S.n) { startPhase2(); return; }
    }
    renderP1();
  });

  // ============ 第二环节 · 牌阵 ============
  function startPhase2() {
    const groups = [];
    for (let g = 0; g < S.n; g++) groups.push({ top: S.deck.pop(), bottom: S.deck.pop(), topRev: false, botRev: false });
    S.p2 = { groups, flip: 0 }; // flip: 0..2n-1
    showScreen('phase2');
    $('p2-info').textContent = '点「翻开下一张」开始';
    $('p2-matches').innerHTML = '';
    $('p2-flip').classList.remove('hidden');
    renderPyramid(); renderP2Hands();
  }

  function renderPyramid() {
    const box = $('p2-pyramid'); box.innerHTML = '';
    S.p2.groups.forEach((grp, g) => {
      const col = document.createElement('div'); col.className = 'pcol';
      const lbl = document.createElement('div'); lbl.className = 'pcol-label'; lbl.textContent = `${g + 1}组·${g + 1}口`;
      col.appendChild(cardEl(grp.top, !grp.topRev));
      col.appendChild(cardEl(grp.bottom, !grp.botRev));
      col.appendChild(lbl);
      box.appendChild(col);
    });
  }

  function renderP2Hands() {
    const box = $('p2-hands'); box.innerHTML = '';
    S.names.forEach((nm, i) => {
      const row = document.createElement('div'); row.className = 'hp-row';
      const nameEl = document.createElement('span'); nameEl.className = 'hp-name'; nameEl.textContent = nm;
      row.appendChild(nameEl);
      if (S.hands[i].length === 0) { const e = document.createElement('span'); e.className = 'hp-empty'; e.textContent = '（无牌）'; row.appendChild(e); }
      else S.hands[i].forEach((c) => { const mini = cardEl(c, false); mini.classList.add('mini'); row.appendChild(mini); });
      box.appendChild(row);
    });
  }

  $('p2-flip').addEventListener('click', onFlip);

  function onFlip() {
    const { groups, flip } = S.p2;
    if (flip >= groups.length * 2) { startPhase3(); return; }

    const g = Math.floor(flip / 2), isTop = flip % 2 === 0;
    const grp = groups[g];
    const card = isTop ? grp.top : grp.bottom;
    if (isTop) grp.topRev = true; else grp.botRev = true;
    const shots = g + 1;
    renderPyramid();

    $('p2-info').innerHTML = `翻开：<b>${rankLabel(card.rank)}${SUITS[card.suit]}</b>　${g + 1}组 · ${isTop ? '上（自己喝）' : '下（指定喝）'} · ${shots} 口`;
    renderMatches(card, isTop, shots);

    S.p2.flip++;
    if (S.p2.flip >= groups.length * 2) $('p2-flip').textContent = '进入第三环节 →';
  }

  // 根据当前手牌渲染「可打出」按钮（同点数可多人/多张，打一张刷新一次）
  function renderMatches(card, isTop, shots) {
    const area = $('p2-matches'); area.innerHTML = '';
    const matches = [];
    S.names.forEach((nm, i) => { if (S.hands[i].some((c) => c.rank === card.rank)) matches.push(i); });
    if (matches.length === 0) {
      area.innerHTML = '<div class="no-match">没有同点数的牌可打，翻下一张～</div>';
      return;
    }
    matches.forEach((player) => {
      const b = document.createElement('button');
      b.className = 'match-btn';
      b.textContent = isTop
        ? `${S.names[player]} 打出 ${rankLabel(card.rank)} → 自己喝 ${shots} 口`
        : `${S.names[player]} 打出 ${rankLabel(card.rank)} → 指定人喝 ${shots} 口`;
      b.addEventListener('click', () => {
        if (isTop) {
          playCard(player, card.rank);
          toast(`${S.names[player]} 自己喝 ${shots} 口`, 'pink');
          renderMatches(card, isTop, shots);
        } else {
          pick(`指定谁喝 ${shots} 口`, S.names.map((nm, j) => ({ label: nm, val: j })), (j) => {
            playCard(player, card.rank);
            toast(`${S.names[player]} 指定 ${S.names[j]} 喝 ${shots} 口`, 'pink');
            renderMatches(card, isTop, shots);
          });
        }
      });
      area.appendChild(b);
    });
  }

  // 打出一张指定点数的手牌
  function playCard(player, rank) {
    const idx = S.hands[player].findIndex((c) => c.rank === rank);
    if (idx >= 0) S.hands[player].splice(idx, 1);
    renderP2Hands(); renderPyramid();
  }

  // ============ 第三环节 · 开Bus ============
  function startPhase3() {
    // 找剩牌点数最大者（并列都上）
    let max = 0;
    S.names.forEach((nm, i) => S.hands[i].forEach((c) => { if (c.rank > max) max = c.rank; }));
    const losers = [];
    S.names.forEach((nm, i) => { if (S.hands[i].some((c) => c.rank === max)) losers.push(i); });

    if (max === 0 || losers.length === 0) { // 无人剩牌
      $('over-info').innerHTML = '🎉 所有筹码都打光了，无人开 Bus，本局平安收场！';
      showScreen('over'); return;
    }
    S.p3 = { losers, li: 0, deck: buildDeck(), slots: [], pos: 0, maxRank: max };
    showScreen('phase3');
    startRider();
  }

  // 每个位置一张牌：暗牌(null)参照 7，明牌参照它自己那张牌。
  // 每次猜都重抽一张放到当前位置：猜对→替换并前进；猜错/相等→回第 1 张。
  function startRider() {
    const p3 = S.p3;
    p3.deck = buildDeck();      // 每位输家一副新牌，牌用完也能下车
    p3.slots = new Array(7).fill(null); // null = 暗牌
    p3.pos = 0;
    p3.owed = 0;                // 累计要喝多少口（不立刻喝）
    const loser = p3.losers[p3.li];
    $('p3-who').innerHTML = `🚌 <b>${S.names[loser]}</b> 开 Bus（剩牌最大 ${rankLabel(p3.maxRank)}）`;
    $('p3-result').textContent = '';
    $('p3-next').classList.add('hidden');
    renderBus(); renderP3Question(); updateP3Status();
  }

  function updateP3Status() {
    const p3 = S.p3;
    $('p3-status').innerHTML = `🂠 剩余 <b>${p3.deck.length}</b> 张　·　🍺 已记 <b>${p3.owed}</b> 口`;
  }

  function renderBus() {
    const row = $('p3-row'); row.innerHTML = '';
    S.p3.slots.forEach((c, k) => {
      const el = c ? cardEl(c, false) : cardEl(null, true);
      if (k === S.p3.pos) el.classList.add('active');
      row.appendChild(el);
    });
  }

  function renderP3Question() {
    const p3 = S.p3;
    $('p3-choices').innerHTML = '';
    const slot = p3.slots[p3.pos];
    const refLabel = slot ? rankLabel(slot.rank) : '7';
    $('p3-question').innerHTML = `第 ${p3.pos + 1}/7 张：比 <b>${refLabel}</b> 大还是小？`;
    [['大', 'big'], ['小', 'small']].forEach(([label, val]) => {
      const b = document.createElement('button'); b.className = 'choice'; b.textContent = label;
      b.addEventListener('click', () => guessP3(val));
      $('p3-choices').appendChild(b);
    });
  }

  function guessP3(choice) {
    const p3 = S.p3;
    if (p3.deck.length < 1) { getOff('deckout'); return; }
    const ref = p3.slots[p3.pos] ? p3.slots[p3.pos].rank : 7;
    const card = p3.deck.pop();
    p3.slots[p3.pos] = card; // 抽到的牌放到当前位置（明牌）
    renderBus();
    const res = $('p3-result');
    $('p3-choices').innerHTML = '';

    let backToStart = false;
    if (card.rank === ref) {
      p3.owed += 2; // 不大不小，记双倍
      res.className = 'result gold';
      res.innerHTML = `🎯 不大不小（都是 ${rankLabel(ref)}）！记 <b>+2</b> 口，回第 1 张`;
      toast('🎯 不大不小，+2 口！', 'gold');
      backToStart = true;
    } else {
      const big = card.rank > ref;
      const right = choice === (big ? 'big' : 'small');
      if (right) {
        p3.pos++;
        if (p3.pos >= 7) { updateP3Status(); getOff('cleared'); return; }
        res.className = 'result good';
        res.innerHTML = `✅ 对（${big ? '大' : '小'}）！继续下一张`;
      } else {
        p3.owed += 1; // 猜错，记 1 口
        res.className = 'result bad';
        res.innerHTML = `❌ 错（实际 ${big ? '大' : '小'}）！记 <b>+1</b> 口，从第 1 张重来`;
        toast('❌ 猜错，+1 口，回起点！', 'roast');
        backToStart = true;
      }
    }
    if (backToStart) p3.pos = 0;
    updateP3Status();

    // 牌用完也可以下车
    if (p3.deck.length < 1) { setTimeout(() => getOff('deckout'), 900); return; }
    setTimeout(() => { $('p3-result').textContent = ''; renderBus(); renderP3Question(); }, backToStart ? 1000 : 650);
  }

  // 下车结算：cleared=七张全过；deckout=牌用完
  function getOff(reason) {
    const p3 = S.p3;
    const loser = p3.losers[p3.li];
    $('p3-choices').innerHTML = '';
    updateP3Status();
    const res = $('p3-result');
    if (reason === 'cleared') {
      res.className = 'result good';
      res.innerHTML = p3.owed === 0
        ? `🎉 <b>${S.names[loser]}</b> 七张全过、一口没喝，完美下车！`
        : `🎉 <b>${S.names[loser]}</b> 七张全过，下车！本次共喝 <b>${p3.owed}</b> 口`;
    } else {
      res.className = 'result bad';
      res.innerHTML = `🂠 牌用完了，<b>${S.names[loser]}</b> 下车！本次共喝 <b>${p3.owed}</b> 口`;
    }
    toast(`${S.names[loser]} 下车，喝 ${p3.owed} 口`, p3.owed === 0 ? 'good' : 'pink');
    $('p3-next').classList.remove('hidden');
    $('p3-next').textContent = (p3.li + 1 < p3.losers.length) ? '下一位开Bus →' : '结束本局';
  }

  $('p3-next').addEventListener('click', () => {
    const p3 = S.p3;
    p3.li++;
    if (p3.li < p3.losers.length) startRider();
    else {
      const names = p3.losers.map((i) => S.names[i]).join('、');
      $('over-info').innerHTML = `🚌 开Bus 的：<b>${names}</b>　都平安下车啦！`;
      showScreen('over');
    }
  });

  // —— 通用选择弹窗 ——
  function pick(title, options, cb) {
    $('picker-title').textContent = title;
    const list = $('picker-list'); list.innerHTML = '';
    options.forEach((o) => {
      const b = document.createElement('button'); b.className = 'picker-item'; b.textContent = o.label;
      b.addEventListener('click', () => { $('picker').classList.add('hidden'); cb(o.val); });
      list.appendChild(b);
    });
    $('picker').classList.remove('hidden');
  }
  $('picker-cancel').addEventListener('click', () => $('picker').classList.add('hidden'));

  // —— 飘字 ——
  let tt = null;
  function toast(text, cls) {
    const el = $('toast');
    el.textContent = text; el.className = 'toast ' + (cls || '');
    el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('show');
    if (tt) clearTimeout(tt);
    tt = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 300); }, 2400);
  }
})();
