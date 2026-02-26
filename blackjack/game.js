// ============================================================
// BLACKJACK — game.js  (complete rewrite, async/await)
// ============================================================
'use strict';

// ── Constants ─────────────────────────────────────────────────
const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const PHASE = {
  IDLE:'IDLE', BETTING:'BETTING', DEALING:'DEALING',
  PLAYER_TURN:'PLAYER_TURN', SPLIT_TURN:'SPLIT_TURN',
  DEALER_TURN:'DEALER_TURN', SETTLEMENT:'SETTLEMENT'
};

// ── Mutable state ─────────────────────────────────────────────
let phase       = PHASE.IDLE;
let deck        = [];
let pCards      = [];     // player main hand
let dCards      = [];     // dealer hand
let sHands      = null;   // split: { hands, bets, idx, results }
let balance     = 500;
let bet         = 0;
let insBet      = 0;
let isAnim      = false;
let roundNum    = 0;
let history     = [];
let h17         = true;   // dealer hits soft 17
let sessionStart = Date.now();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Animation timing ──────────────────────────────────────────
const T = {
  deal:    reducedMotion ? 0 : 220,
  flip:    reducedMotion ? 0 : 350,
  stagger: reducedMotion ? 0 : 250,
  pause:   reducedMotion ? 0 : 300,
  dealer:  reducedMotion ? 0 : 400,
};

// ── Deck & shuffle ────────────────────────────────────────────
function buildDeck() {
  return SUITS.flatMap(s => RANKS.map(r => ({ suit: s, rank: r })));
}
function shuffle(arr) {
  if (!window.crypto || !window.crypto.getRandomValues) {
    document.getElementById('gameTable').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:60vh;text-align:center;padding:32px">' +
      '<div><div style="font-family:\'Bodoni Moda\',serif;font-size:1.4rem;color:var(--blood-red);margin-bottom:12px">Secure Randomness Unavailable</div>' +
      '<p style="color:var(--ash-white)">Please use a modern browser to play.</p></div></div>';
    return [];
  }
  const a = [...arr];
  const rng = new Uint32Array(a.length);
  crypto.getRandomValues(rng);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Safe card draw (reshuffles if deck runs out) ──────────────
function drawCard() {
  if (deck.length === 0) deck = shuffle(buildDeck());
  return deck.shift();
}

// ── Hand evaluation ───────────────────────────────────────────
function calcHand(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if      (c.rank === 'A')             { aces++; total += 11; }
    else if ('JQK'.includes(c.rank[0])) total += 10;
    else                                 total += +c.rank;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return {
    total,
    isSoft:      aces > 0 && total <= 21,
    isBust:      total > 21,
    isBlackjack: cards.length === 2 && total === 21,
  };
}
function handLabel(cards, n = cards.length) {
  const { total, isSoft, isBlackjack } = calcHand(cards.slice(0, n));
  if (isBlackjack) return 'Blackjack!';
  if (isSoft)      return `${total - 10}/${total}`;
  return String(total);
}
function handStr(cards) {
  return cards.map(c => c.rank + c.suit).join(' ') + ` (${calcHand(cards).total})`;
}

// ── DOM helpers ───────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showStatus(msg, cls = '') {
  const el = $('statusText');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'status-text' + (cls ? ' ' + cls : '');
}
function wait(ms) { return new Promise(r => setTimeout(r, Math.max(0, ms))); }

// ── Card rendering ────────────────────────────────────────────
function suitClass(s) {
  return { '♠':'suit-spade', '♣':'suit-club', '♥':'suit-heart', '♦':'suit-diamond' }[s] || 'suit-spade';
}
function suitName(s) {
  return { '♠':'Spades', '♣':'Clubs', '♥':'Hearts', '♦':'Diamonds' }[s] || s;
}
function makeCard(card, faceDown = false) {
  const { rank, suit } = card;
  const sc = suitClass(suit);
  let center;
  if      (['J','Q','K'].includes(rank)) center = `<div class="face-card-center"><div class="face-monogram">${rank}</div><div class="face-suit ${sc}">${suit}</div></div>`;
  else if (rank === 'A')                 center = `<div class="ace-center"><div class="ace-rule"></div><div class="ace-pip ${sc}">${suit}</div><div class="ace-rule"></div></div>`;
  else                                   center = `<div class="center-pip ${sc}">${suit}</div>`;

  const face = `
    <div class="card-face" aria-label="${rank} of ${suitName(suit)}">
      <div class="corner corner-tl"><div class="corner-rank">${rank}</div><div class="corner-suit ${sc}">${suit}</div></div>
      <div class="card-center">${center}</div>
      <div class="corner corner-br"><div class="corner-rank">${rank}</div><div class="corner-suit ${sc}">${suit}</div></div>
    </div>
    <div class="card-back" aria-hidden="true"></div>`;

  const el = document.createElement('div');
  el.className = 'card';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', faceDown ? 'Face-down card' : `${rank} of ${suitName(suit)}`);
  el.innerHTML = `<div class="card-inner">${face}</div>`;
  if (!faceDown) el.querySelector('.card-inner').classList.add('face-up');
  return el;
}

// ── Animation helpers (always resolve — no hang risk) ─────────
function animDeal(cardEl) {
  if (T.deal === 0) return Promise.resolve();
  const inner = cardEl.querySelector('.card-inner');
  inner.classList.add('dealing');
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; inner.classList.remove('dealing'); resolve(); };
    setTimeout(finish, T.deal + 150);
    inner.addEventListener('animationend', finish, { once: true });
  });
}
function animFlip(inner) {
  if (!inner) return Promise.resolve();
  if (T.flip === 0) { inner.classList.add('face-up'); return Promise.resolve(); }
  inner.classList.add('revealing');
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      inner.classList.remove('revealing');
      inner.classList.add('face-up');
      resolve();
    };
    setTimeout(finish, T.flip + 150);
    inner.addEventListener('animationend', finish, { once: true });
  });
}
async function dealCardTo(card, containerId, faceUp = true) {
  const container = $(containerId);
  if (!container) return;
  const el = makeCard(card, true);
  container.appendChild(el);
  await animDeal(el);
  if (faceUp) await animFlip(el.querySelector('.card-inner'));
}

// ── Balance display ───────────────────────────────────────────
function animBalance(from, to) {
  const el = $('balanceDisplay');
  if (!el) return;
  if (reducedMotion || from === to) { el.textContent = '$' + to; return; }
  el.style.color = to > from ? 'var(--gold-bright)' : 'var(--blood-red)';
  const dur = 600, t0 = performance.now();
  const step = now => {
    const t = Math.min((now - t0) / dur, 1);
    el.textContent = '$' + Math.round(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(step);
    else { el.textContent = '$' + to; el.style.color = ''; }
  };
  requestAnimationFrame(step);
}
function refreshDisplays() {
  const bd = $('betDisplay');      if (bd)  bd.textContent  = '$' + bet;
  const bz = $('betZoneBalance');  if (bz)  bz.textContent  = '$' + balance;
  const bl = $('balanceDisplay');  if (bl)  bl.textContent  = '$' + balance;
  renderChipStack();
}
function renderChipStack() {
  const vis = $('chipStackVisual');
  if (!vis) return;
  vis.innerHTML = '';
  if (bet <= 0) return;
  let rem = bet;
  const tiers = [
    { v:50, bg:'radial-gradient(circle at 40% 40%, #e0dcd0, var(--chip-ivory))' },
    { v:25, bg:'radial-gradient(circle at 40% 40%, #e8b850, var(--chip-gold))' },
    { v:10, bg:'radial-gradient(circle at 40% 40%, #a02020, var(--chip-crimson))' },
    { v: 5, bg:'radial-gradient(circle at 40% 40%, #2c2c2c, var(--chip-obsidian))' },
  ];
  const chips = [];
  for (const { v, bg } of tiers) while (rem >= v && chips.length < 8) { chips.push(bg); rem -= v; }
  chips.forEach((bg, i) => {
    const c = document.createElement('div');
    c.className = 'chip-visual';
    c.style.cssText = `background:${bg};z-index:${i}`;
    vis.appendChild(c);
  });
}
function updateChipBtns() {
  [5,10,25,50].forEach(v => { const el = $('chip'+v); if (el) el.disabled = balance < v; });
  const cb = $('clearBetBtn'); if (cb) cb.disabled = bet === 0;
  const db = $('dealBtn');     if (db) db.disabled  = bet === 0;
}

// ── Bet actions ───────────────────────────────────────────────
function placeBet(amount) {
  if (phase !== PHASE.BETTING && phase !== PHASE.IDLE) return;
  if (phase === PHASE.IDLE) setPhase(PHASE.BETTING);
  if (balance < amount) {
    const btn = $('chip' + amount);
    if (btn) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); }
    return;
  }
  balance -= amount;
  bet     += amount;
  refreshDisplays();
  updateChipBtns();
}
function clearBet() {
  if (phase !== PHASE.BETTING) return;
  balance += bet; bet = 0;
  refreshDisplays();
  updateChipBtns();
}

// ── Deal sequence ─────────────────────────────────────────────
async function deal() {
  if (phase !== PHASE.BETTING || bet <= 0 || isAnim) return;
  setPhase(PHASE.DEALING);
  isAnim = true;

  deck = shuffle(buildDeck());
  if (!deck.length) { isAnim = false; return; }

  pCards = []; dCards = []; sHands = null; insBet = 0;
  $('dealerHand').innerHTML = '';
  $('playerHandsContainer').innerHTML = '<div class="hand" id="playerHand"></div>';
  $('dealerTotal').classList.add('hidden');
  $('playerTotal').classList.add('hidden');
  $$('.bust-stamp').forEach(e => e.remove());
  showStatus('Dealing…');

  // Draw four cards: P D P D
  pCards.push(drawCard()); dCards.push(drawCard());
  pCards.push(drawCard()); dCards.push(drawCard());

  // Animate face-down arrivals (staggered)
  const p1 = makeCard(pCards[0], true);
  const d1 = makeCard(dCards[0], true);
  const p2 = makeCard(pCards[1], true);
  const d2 = makeCard(dCards[1], true);

  $('playerHand').appendChild(p1); await animDeal(p1); await wait(T.stagger);
  $('dealerHand').appendChild(d1); await animDeal(d1); await wait(T.stagger);
  $('playerHand').appendChild(p2); await animDeal(p2); await wait(T.stagger);
  $('dealerHand').appendChild(d2); await animDeal(d2); await wait(T.pause);

  // Sequential reveal: P1 → P2 → D upcard (hole stays down)
  await animFlip(p1.querySelector('.card-inner')); await wait(200);
  await animFlip(p2.querySelector('.card-inner')); await wait(200);
  await animFlip(d1.querySelector('.card-inner')); await wait(200);

  // Show totals
  const ptEl = $('playerTotal');
  if (ptEl) { ptEl.textContent = handLabel(pCards); ptEl.classList.remove('hidden'); }
  const dtEl = $('dealerTotal');
  if (dtEl) { dtEl.textContent = handLabel(dCards, 1); dtEl.classList.remove('hidden'); }

  isAnim = false;

  // Insurance?
  if (dCards[0].rank === 'A') {
    const maxIns = Math.floor(bet / 2);
    if (maxIns > 0 && balance >= maxIns) { offerInsurance(); return; }
  }
  continueAfterInsurance();
}

// ── Insurance ─────────────────────────────────────────────────
function offerInsurance() {
  const ai = $('insuranceAmount');
  if (ai) ai.textContent = Math.floor(bet / 2);
  $('insuranceModal').classList.add('open');
}
function takeInsurance(take) {
  $('insuranceModal').classList.remove('open');
  if (take) {
    insBet   = Math.floor(bet / 2);
    balance -= insBet;
    refreshDisplays();
  }
  continueAfterInsurance();
}
function continueAfterInsurance() {
  const p = calcHand(pCards);
  const d = calcHand(dCards);
  if (p.isBlackjack || d.isBlackjack) { handleBlackjacks(p, d); return; }
  setPhase(PHASE.PLAYER_TURN);
  showStatus('Your turn.');
}
async function handleBlackjacks(p, d) {
  await revealHole();
  const dtEl = $('dealerTotal');
  if (dtEl) dtEl.textContent = handLabel(dCards);

  if (insBet > 0) {
    const prev = balance;
    if (d.isBlackjack) {
      balance += insBet * 3;      // 2:1 pays back stake + 2×
      animBalance(prev, balance);
      refreshDisplays();
      showStatus('Insurance pays 2:1!', 'win');
    } else {
      showStatus('No Blackjack — insurance lost.', 'loss');
    }
    await wait(900);
  }

  if      (p.isBlackjack && d.isBlackjack) settle('PUSH',      0);
  else if (p.isBlackjack)                  settle('BLACKJACK', Math.floor(bet * 1.5));
  else                                     settle('LOSS',      -bet);
}

// ── Player actions ────────────────────────────────────────────
function playerHit() {
  if ((phase !== PHASE.PLAYER_TURN && phase !== PHASE.SPLIT_TURN) || isAnim) return;
  isAnim = true;
  const hand = currentHand();
  const card = drawCard();
  hand.push(card);
  const cId = phase === PHASE.SPLIT_TURN ? 'splitHand' + sHands.idx : 'playerHand';
  (async () => {
    await dealCardTo(card, cId, true);
    isAnim = false;
    refreshHandTotals();
    lockSpecialActions();
    const res = calcHand(hand);
    if (res.isBust) {
      markBust(phase === PHASE.SPLIT_TURN ? sHands.idx : -1);
      if (phase === PHASE.SPLIT_TURN) { advanceSplit(); return; }
      settle('LOSS', -bet);
      return;
    }
    if (res.total === 21) {
      if (phase === PHASE.SPLIT_TURN) { advanceSplit(); return; }
      startDealerTurn();
    }
  })();
}

function playerStand() {
  if ((phase !== PHASE.PLAYER_TURN && phase !== PHASE.SPLIT_TURN) || isAnim) return;
  if (phase === PHASE.SPLIT_TURN) { advanceSplit(); return; }
  startDealerTurn();
}

function playerDouble() {
  if (phase !== PHASE.PLAYER_TURN || isAnim || pCards.length !== 2 || balance < bet) return;
  isAnim = true;
  const prev = balance;
  balance -= bet;
  bet     *= 2;
  animBalance(prev, balance);
  refreshDisplays();
  const card = drawCard();
  pCards.push(card);
  (async () => {
    await dealCardTo(card, 'playerHand', true);
    isAnim = false;
    refreshHandTotals();
    const res = calcHand(pCards);
    if (res.isBust) { markBust(-1); settle('LOSS', -bet); return; }
    startDealerTurn();
  })();
}

function playerSplit() {
  if (phase !== PHASE.PLAYER_TURN || isAnim || pCards.length !== 2) return;
  if (pCards[0].rank !== pCards[1].rank || balance < bet) return;
  const prev = balance;
  balance -= bet;
  animBalance(prev, balance);
  refreshDisplays();
  const h1 = [pCards[0], drawCard()];
  const h2 = [pCards[1], drawCard()];
  sHands = { hands: [h1, h2], bets: [bet, bet], idx: 0, results: [] };
  renderSplitHands();
  setPhase(PHASE.SPLIT_TURN);
  showStatus('Hand 1 — your turn.');
  if (pCards[0].rank === 'A') setTimeout(() => advanceSplit(), (T.pause || 0) + 100);
}

function playerSurrender() {
  if (phase !== PHASE.PLAYER_TURN || isAnim || pCards.length !== 2) return;
  settle('SURRENDER', -Math.floor(bet / 2));
}

// ── Split helpers ─────────────────────────────────────────────
function currentHand() { return sHands ? sHands.hands[sHands.idx] : pCards; }

function advanceSplit() {
  const hand = sHands.hands[sHands.idx];
  sHands.results.push({ hand: handStr(hand), total: calcHand(hand).total });
  if (sHands.idx < sHands.hands.length - 1) {
    sHands.idx++;
    $$('.split-hand-label').forEach((el, i) => el.classList.toggle('active', i === sHands.idx));
    showStatus(`Hand ${sHands.idx + 1} — your turn.`);
    if (sHands.hands[0][0].rank === 'A') setTimeout(() => advanceSplit(), (T.pause || 0) + 100);
  } else {
    startDealerTurn();
  }
}

function renderSplitHands() {
  const container = $('playerHandsContainer');
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'split-hands';
  sHands.hands.forEach((hand, i) => {
    const col  = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px';
    const hDiv = document.createElement('div');
    hDiv.className = 'hand'; hDiv.id = 'splitHand' + i;
    hand.forEach(c => hDiv.appendChild(makeCard(c, false)));
    const lbl  = document.createElement('div');
    lbl.className   = 'split-hand-label' + (i === 0 ? ' active' : '');
    lbl.id          = 'splitLabel' + i;
    lbl.textContent = 'Hand ' + (i + 1);
    const badge = document.createElement('div');
    badge.className   = 'hand-total-badge';
    badge.id          = 'splitTotal' + i;
    badge.style.cssText = 'position:relative;right:auto;top:auto;margin-top:4px';
    badge.textContent = handLabel(hand);
    col.append(hDiv, lbl, badge);
    wrapper.appendChild(col);
  });
  container.appendChild(wrapper);
  $('playerTotal').classList.add('hidden');
}

function refreshHandTotals() {
  if (sHands) {
    sHands.hands.forEach((hand, i) => {
      const b = $('splitTotal' + i);
      if (b) b.textContent = handLabel(hand);
    });
  } else {
    const el = $('playerTotal');
    if (el) el.textContent = handLabel(pCards);
  }
}

function lockSpecialActions() {
  ['doubleBtn','splitBtn','surrenderBtn'].forEach(id => {
    const el = $(id);
    if (el) { el.disabled = true; el.setAttribute('aria-disabled','true'); }
  });
  const dt = $('doubleTip');    if (dt) dt.textContent = 'Double requires your first two cards.';
  const st = $('splitTip');     if (st) st.textContent = 'Split requires your first two cards.';
  const sr = $('surrenderTip'); if (sr) sr.textContent = 'Surrender is only available on your initial two cards.';
}

function markBust(splitIdx) {
  const target = splitIdx >= 0 ? $('splitHand' + splitIdx) : $('playerHand');
  if (!target) return;
  target.style.position = 'relative';
  const stamp = document.createElement('div');
  stamp.className = 'bust-stamp'; stamp.textContent = 'BUST';
  target.appendChild(stamp);
  target.querySelectorAll('.card').forEach(c => c.classList.add('dim'));
}

// ── Dealer turn ───────────────────────────────────────────────
async function startDealerTurn() {
  setPhase(PHASE.DEALER_TURN);
  showStatus('Dealer reveals…');
  $('dealerTurnStatus').classList.remove('hidden');
  isAnim = true;

  await revealHole();
  const dtEl = $('dealerTotal');
  if (dtEl) dtEl.textContent = handLabel(dCards);
  await wait(T.pause);

  // Dealer draws until standing or bust
  while (true) {
    const res = calcHand(dCards);
    const shouldHit = res.total < 17 || (h17 && res.isSoft && res.total === 17);
    if (!shouldHit || res.isBust) break;
    showStatus('Dealer draws…');
    const card = drawCard();
    dCards.push(card);
    await dealCardTo(card, 'dealerHand', true);
    if (dtEl) dtEl.textContent = handLabel(dCards);
    await wait(T.dealer);
  }

  isAnim = false;
  $('dealerTurnStatus').classList.add('hidden');
  resolveRound();
}

async function revealHole() {
  const els  = $('dealerHand')?.querySelectorAll('.card-inner');
  const hole = els?.[1];
  if (!hole) return;
  hole.closest('.card')?.setAttribute('aria-label', `${dCards[1].rank} of ${suitName(dCards[1].suit)}`);
  await animFlip(hole);
}

// ── Settlement ────────────────────────────────────────────────
function resolveRound() {
  const dRes = calcHand(dCards);

  if (sHands) {
    let net = 0;
    const subResults = [];
    sHands.hands.forEach((hand, i) => {
      const hRes = calcHand(hand);
      const hBet = sHands.bets[i];
      let outcome, payout;
      if      (hRes.isBust)             { outcome='LOSS'; payout=-hBet; }
      else if (dRes.isBust)             { outcome='WIN';  payout= hBet; }
      else if (hRes.total > dRes.total) { outcome='WIN';  payout= hBet; }
      else if (hRes.total < dRes.total) { outcome='LOSS'; payout=-hBet; }
      else                              { outcome='PUSH'; payout=0;     }
      net += payout;
      subResults.push({ outcome, payout, hand: handStr(hand), total: hRes.total });
      const badge = $('splitTotal' + i);
      if (badge) badge.style.color = outcome==='WIN' ? 'var(--gold-bright)' : outcome==='LOSS' ? 'var(--blood-red)' : 'var(--whiskey-amber)';
    });

    const totalBet = sHands.bets.reduce((a,b) => a+b, 0);
    const prev     = balance;
    balance += totalBet + net;   // return both stakes ± net win/loss
    animBalance(prev, balance);
    refreshDisplays();

    const wins  = subResults.filter(r => r.outcome === 'WIN').length;
    const loses = subResults.filter(r => r.outcome === 'LOSS').length;
    const overall = loses === 2 ? 'LOSS' : wins > 0 ? 'WIN' : 'PUSH';
    showStatus(overall==='WIN' ? 'You win!' : overall==='LOSS' ? 'Dealer wins.' : 'Push.', overall.toLowerCase());
    if (wins > 0) fireParticles(false);
    recordRound(overall, net, totalBet, subResults);
    showSettlement();
    return;
  }

  // Normal hand
  const pRes = calcHand(pCards);
  let outcome, payout;
  if      (pRes.isBust)             { outcome='LOSS'; payout=-bet; }
  else if (dRes.isBust)             { outcome='WIN';  payout= bet; }
  else if (pRes.total > dRes.total) { outcome='WIN';  payout= bet; }
  else if (pRes.total < dRes.total) { outcome='LOSS'; payout=-bet; }
  else                              { outcome='PUSH'; payout=0;    }
  settle(outcome, payout);
}

function settle(outcome, payout) {
  const prev = balance;

  if      (outcome === 'SURRENDER') {
    balance += bet - Math.floor(bet / 2);     // return half bet
    showStatus('Surrendered — half bet returned.', 'push');
  } else if (outcome === 'BLACKJACK') {
    balance += bet + payout;
    showStatus('Blackjack! 3:2 payout!', 'blackjack');
    $$('#playerHand .card-inner').forEach(c => c.classList.add('win-glow'));
    fireParticles(true);
  } else if (outcome === 'WIN') {
    balance += bet + payout;
    showStatus('You win!', 'win');
    $$('#playerHand .card-inner').forEach(c => c.classList.add('win-glow'));
    fireParticles(false);
  } else if (outcome === 'LOSS') {
    // balance unchanged — bet was deducted at placement
    showStatus(calcHand(pCards).isBust ? 'Bust! You lose.' : 'Dealer wins.', 'loss');
    $$('#playerHand .card').forEach(c => c.classList.add('dim'));
  } else if (outcome === 'PUSH') {
    balance += bet;
    showStatus('Push — bet returned.', 'push');
  }

  animBalance(prev, balance);
  refreshDisplays();

  // Show full dealer total if dealer played
  if (outcome !== 'SURRENDER' && !calcHand(pCards).isBust) {
    const dtEl = $('dealerTotal');
    if (dtEl) { dtEl.textContent = handLabel(dCards); dtEl.classList.remove('hidden'); }
  }

  recordRound(outcome, payout, bet);
  showSettlement();
}

function showSettlement() {
  setPhase(PHASE.SETTLEMENT);
  if (balance <= 0) {
    balance = 500;
    refreshDisplays();
    setTimeout(() => showStatus("Out of chips! Here's a fresh stack — keep practicing.", ''), 600);
  }
}

// ── Deal again ────────────────────────────────────────────────
function dealAgain() {
  if (phase !== PHASE.SETTLEMENT) return;
  bet = 0; sHands = null; pCards = []; dCards = [];
  $('dealerHand').innerHTML = '';
  $('playerHandsContainer').innerHTML = '<div class="hand" id="playerHand"></div>';
  $('dealerTotal').classList.add('hidden');
  $('playerTotal').classList.add('hidden');
  $$('.bust-stamp').forEach(e => e.remove());
  refreshDisplays();
  updateChipBtns();
  setPhase(PHASE.BETTING);
  showStatus('Place your bet to begin.');
}

// ── UI state machine ──────────────────────────────────────────
function setPhase(p) {
  phase = p;
  const bc = $('bettingControls');
  const pc = $('playerControls');
  const sc = $('settlementControls');
  const dt = $('dealerTurnStatus');
  [bc, pc, sc, dt].forEach(el => el?.classList.add('hidden'));

  if (phase === PHASE.IDLE || phase === PHASE.BETTING) {
    bc?.classList.remove('hidden');
    updateChipBtns();
  } else if (phase === PHASE.PLAYER_TURN || phase === PHASE.SPLIT_TURN) {
    pc?.classList.remove('hidden');
    refreshActionBtns();
  } else if (phase === PHASE.DEALER_TURN) {
    dt?.classList.remove('hidden');
  } else if (phase === PHASE.SETTLEMENT) {
    sc?.classList.remove('hidden');
  }
  // DEALING: all hidden
}

function refreshActionBtns() {
  const isSplit = phase === PHASE.SPLIT_TURN;
  const hand    = currentHand();
  const res     = calcHand(hand);

  const hitBtn = $('hitBtn');
  if (hitBtn) hitBtn.disabled = res.total >= 21;

  const canDbl = !isSplit && hand.length === 2 && balance >= bet;
  const dblBtn = $('doubleBtn');
  if (dblBtn) {
    dblBtn.disabled = !canDbl;
    dblBtn.setAttribute('aria-disabled', String(!canDbl));
    const tip = $('doubleTip');
    if (tip) tip.textContent = canDbl
      ? 'Double your bet and receive exactly one more card.'
      : hand.length !== 2 ? 'Double requires your first two cards.' : 'Insufficient chips to double.';
  }

  const canSpl = !isSplit && hand.length === 2 && hand[0]?.rank === hand[1]?.rank && balance >= bet;
  const splBtn = $('splitBtn');
  if (splBtn) {
    splBtn.disabled = !canSpl;
    splBtn.setAttribute('aria-disabled', String(!canSpl));
    const tip = $('splitTip');
    if (tip) tip.textContent = canSpl
      ? 'Split into two hands.'
      : hand[0]?.rank !== hand[1]?.rank ? 'Cards must match to split.' : 'Insufficient chips to split.';
  }

  const canSur = !isSplit && hand.length === 2;
  const surBtn = $('surrenderBtn');
  if (surBtn) {
    surBtn.disabled = !canSur;
    surBtn.setAttribute('aria-disabled', String(!canSur));
    const tip = $('surrenderTip');
    if (tip) tip.textContent = canSur
      ? 'Forfeit half your bet and end the round.'
      : 'Surrender is only available on your initial two cards.';
  }
}

// ── Settings ──────────────────────────────────────────────────
function toggleH17() {
  h17 = !h17;
  const btn = $('settingsBtn');
  if (btn) btn.style.opacity = h17 ? '1' : '0.5';
  showStatus(`Dealer ${h17 ? 'hits' : 'stands'} on soft 17.`);
  setTimeout(() => {
    if (phase === PHASE.IDLE || phase === PHASE.BETTING || phase === PHASE.SETTLEMENT)
      showStatus('Place your bet to begin.');
  }, 2000);
}

// ── Panels ────────────────────────────────────────────────────
function openPanel(which) {
  closeAllPanels();
  $('panelScrim')?.classList.add('open');
  const map = { history:'historyPanel', stats:'statsPanel', help:'helpPanel' };
  $(map[which])?.classList.add('open');
  if (which === 'history') renderHistory();
  if (which === 'stats')   renderStats();
}
function closeAllPanels() {
  ['historyPanel','statsPanel','helpPanel'].forEach(id => $(id)?.classList.remove('open'));
  $('panelScrim')?.classList.remove('open');
}
function switchPanel(which) { closeAllPanels(); setTimeout(() => openPanel(which), 50); }

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAllPanels(); $('insuranceModal')?.classList.remove('open'); return; }
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
  if ((phase === PHASE.PLAYER_TURN || phase === PHASE.SPLIT_TURN) && !isAnim) {
    if (e.key === 'h') { e.preventDefault(); playerHit(); }
    if (e.key === 's') { e.preventDefault(); playerStand(); }
    if (e.key === 'd') { e.preventDefault(); playerDouble(); }
    if (e.key === 'r') { e.preventDefault(); playerSurrender(); }
  }
});

// ── Onboarding ────────────────────────────────────────────────
let obPage = 0;
function obNav(dir) {
  const panels = $$('.onboarding-panel');
  const dots   = $$('.onboarding-dot');
  if (!panels.length) return;
  panels[obPage].classList.remove('active');
  dots[obPage]?.classList.remove('active');
  obPage = Math.max(0, Math.min(panels.length - 1, obPage + dir));
  panels[obPage].classList.add('active');
  dots[obPage]?.classList.add('active');
  $('ob-prev').style.visibility = obPage === 0 ? 'hidden' : 'visible';
  const isLast = obPage === panels.length - 1;
  $('ob-next').textContent = isLast ? 'Play' : 'Next';
  $('ob-next').onclick = isLast
    ? () => { $('onboarding').classList.remove('open'); setPhase(PHASE.BETTING); showStatus('Place your bet to begin.'); }
    : () => obNav(1);
}

// ── History recording ─────────────────────────────────────────
function recordRound(outcome, payout, betAmt, splitResults = null) {
  roundNum++;
  history.unshift({
    roundNumber:  roundNum,
    timestamp:    Date.now(),
    bet:          betAmt,
    outcome,
    payout,
    balanceAfter: balance,
    playerHand:   sHands ? sHands.hands.map(handStr).join(' | ') : handStr(pCards),
    dealerHand:   handStr(dCards),
    playerTotal:  sHands ? calcHand(sHands.hands[0]).total : calcHand(pCards).total,
    dealerTotal:  calcHand(dCards).total,
    wasBlackjack: outcome === 'BLACKJACK',
    wasSplit:     !!splitResults,
    wasSurrender: outcome === 'SURRENDER',
    splitResults,
  });
  if ($('historyPanel')?.classList.contains('open')) renderHistory();
  if ($('statsPanel')?.classList.contains('open'))   renderStats();
}

// ── History panel ─────────────────────────────────────────────
function renderHistory() {
  const body = $('historyBody');
  if (!body) return;
  if (!history.length) {
    body.innerHTML = '<div class="history-empty"><p>No rounds played yet.</p><p>Good luck at the table.</p></div>';
    return;
  }
  const dur    = Math.floor((Date.now() - sessionStart) / 60000);
  const footer = $('historyFooter');
  if (footer) footer.textContent = `Session: ${dur} min · ${history.length} rounds`;

  body.innerHTML = history.map(r => {
    const sign  = r.payout > 0 ? '+' : '';
    const pcls  = r.payout > 0 ? 'h-payout-pos' : r.payout < 0 ? 'h-payout-neg' : 'h-payout-zero';
    const label = r.wasBlackjack ? 'BLACKJACK' : r.wasSurrender ? 'SURRENDER' : r.outcome;
    const subs  = (r.splitResults || []).map((sr, i) =>
      `<div class="split-subrow">
         <span class="h-outcome-${sr.outcome}">Hand ${i+1}: ${sr.outcome}</span>
         <span class="${sr.payout >= 0 ? 'h-payout-pos' : 'h-payout-neg'}">${sr.payout > 0 ? '+' : ''}$${Math.abs(sr.payout)}</span>
         <div class="history-row-cards">${sr.hand}</div>
       </div>`
    ).join('');
    return `<div class="history-row" role="listitem">
      <div class="history-row-top">
        <span>#${r.roundNumber} <span class="h-outcome-${label}">${label}</span></span>
        <span><span class="${pcls}">${sign}$${Math.abs(r.payout)}</span> <span class="h-balance">$${r.balanceAfter}</span></span>
      </div>
      <div class="history-row-cards">${r.playerHand} vs ${r.dealerHand}</div>
      ${subs}
    </div>`;
  }).join('');
}

// ── Statistics panel ──────────────────────────────────────────
function renderStats() {
  const body = $('statsBody');
  if (!body) return;
  if (!history.length) {
    body.innerHTML = '<div class="stats-empty"><p>Play a round to see your session statistics here.</p><p>Good luck at the table.</p></div>';
    return;
  }
  const N    = history.length;
  const wins = history.filter(r => r.outcome==='WIN' || r.outcome==='BLACKJACK').length;
  const loss = history.filter(r => r.outcome==='LOSS').length;
  const push = history.filter(r => r.outcome==='PUSH').length;
  const surr = history.filter(r => r.outcome==='SURRENDER').length;
  const bjs  = history.filter(r => r.wasBlackjack).length;
  const pct  = n => N > 0 ? (n / N * 100).toFixed(1) + '%' : '—';

  const net     = history.reduce((s,r) => s+r.payout, 0);
  const bigWin  = history.reduce((m,r) => Math.max(m,r.payout), 0);
  const bigLoss = history.reduce((m,r) => Math.min(m,r.payout), 0);
  const wagered = history.reduce((s,r) => s+r.bet, 0);
  const avgBet  = N > 0 ? Math.round(wagered / N) : 0;
  const dur     = Math.floor((Date.now() - sessionStart) / 60000);
  const rpm     = dur > 0 ? (N / dur).toFixed(1) : '—';

  // Streak calculation
  let longestW=0, longestL=0, curW=0, curL=0;
  for (const r of [...history].reverse()) {
    const w = r.outcome==='WIN'||r.outcome==='BLACKJACK';
    const l = r.outcome==='LOSS'||r.outcome==='SURRENDER';
    if      (w) { curW++; curL=0; longestW=Math.max(longestW,curW); }
    else if (l) { curL++; curW=0; longestL=Math.max(longestL,curL); }
  }
  let sType='NONE', sCount=0;
  for (const r of history) {
    const w = r.outcome==='WIN'||r.outcome==='BLACKJACK';
    const l = r.outcome==='LOSS'||r.outcome==='SURRENDER';
    if      (sCount===0)           { if(w){sType='WIN';sCount=1;} else if(l){sType='LOSS';sCount=1;} }
    else if (sType==='WIN'  && w)  sCount++;
    else if (sType==='LOSS' && l)  sCount++;
    else if (r.outcome !== 'PUSH') break;
  }
  const streak     = sType==='NONE' ? '—' : `${sType==='WIN'&&sCount>=3?'🔥 ':''}${sType[0]}${sCount}`;
  const compassion = longestL >= 5 ? '<p class="stats-compassion">Variance is natural in Blackjack. Every hand is independent.</p>' : '';

  const footer = $('statsFooter');
  if (footer) footer.textContent = `Session: ${dur} min · ${rpm} rounds/min`;

  body.innerHTML = `
    <div class="stats-section">
      <div class="rounds-display">ROUNDS PLAYED: ${N}</div>
      <div class="stats-bar-container">
        <div class="stats-bar">
          <div class="stats-bar-win"  style="width:${N>0?wins/N*100:0}%"></div>
          <div class="stats-bar-loss" style="width:${N>0?loss/N*100:0}%"></div>
          <div class="stats-bar-push" style="width:${N>0?push/N*100:0}%"></div>
        </div>
        <div class="stats-bar-legend">
          <div class="stats-legend-row"><span><span class="dot dot-win"></span>Wins</span><span style="color:var(--gold-bright)">${pct(wins)}</span></div>
          <div class="stats-legend-row"><span><span class="dot dot-loss"></span>Losses</span><span style="color:var(--blood-red)">${pct(loss)}</span></div>
          <div class="stats-legend-row"><span><span class="dot dot-push"></span>Pushes</span><span style="color:var(--whiskey-amber)">${pct(push)}</span></div>
        </div>
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-row"><span class="stats-label">NET PROFIT</span><span class="stats-val ${net>=0?'stats-val-pos':'stats-val-neg'}">${net>=0?'+':''}$${Math.abs(net)}</span></div>
      <div class="stats-row"><span class="stats-label">Total Wagered</span><span class="stats-val stats-val-neu">$${wagered.toLocaleString()}</span></div>
      <div class="stats-row"><span class="stats-label">Average Bet</span><span class="stats-val stats-val-neu">${N>0?'$'+avgBet:'—'}</span></div>
    </div>
    <div class="stats-section">
      <div class="stats-row"><span class="stats-label">BIGGEST WIN</span><span class="stats-val stats-val-pos">+$${bigWin}</span></div>
      <div class="stats-row"><span class="stats-label">BIGGEST LOSS</span><span class="stats-val stats-val-neg">${bigLoss<0?'-':''}$${Math.abs(bigLoss)}</span></div>
    </div>
    <div class="stats-section">
      <div class="stats-row"><span class="stats-label">CURRENT STREAK</span><span class="stats-val stats-val-neu">${streak}</span></div>
      <div class="stats-row"><span class="stats-label">Best Win Streak</span><span class="stats-val stats-val-pos">W${longestW}</span></div>
      <div class="stats-row"><span class="stats-label">Worst Loss Streak</span><span class="stats-val stats-val-neg">L${longestL}</span></div>
      ${compassion}
    </div>
    <div class="stats-section">
      <div class="stats-row"><span class="stats-label">BLACKJACKS</span><span class="stats-val stats-val-pos">${bjs} (${pct(bjs)})</span></div>
      <div class="stats-row"><span class="stats-label">SURRENDERS</span><span class="stats-val stats-val-neu">${surr}</span></div>
    </div>`;
}

// ── Particle effects ──────────────────────────────────────────
const pCvs = $('particle-canvas');
const pCtx = pCvs.getContext('2d');
let pList  = [], pRAF = null;

function resizeCanvas() { pCvs.width = window.innerWidth; pCvs.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function fireParticles(isBJ) {
  if (reducedMotion) return;
  const cfg = isBJ
    ? { count:70, spread:Math.PI*1.2, minV:3,maxV:8, grav:0.06, minL:60,maxL:120,
        colors:['#D4A843','#8B7332','#D4D0C8','#B8860B'], shapes:['circle','diamond','star'] }
    : { count:35, spread:Math.PI*0.8, minV:2,maxV:6, grav:0.08, minL:40,maxL:80,
        colors:['#D4A843','#8B7332','#D4D0C8'], shapes:['circle','diamond'] };
  const el = $('playerHand');
  const r  = el?.getBoundingClientRect();
  const ox = r ? r.left + r.width/2  : window.innerWidth/2;
  const oy = r ? r.top  + r.height/2 : window.innerHeight*0.65;
  spawnBurst(cfg, ox, oy);
  if (isBJ) setTimeout(() => spawnBurst({...cfg, count:30, minV:1, maxV:4}, ox, oy), 300);
  if (!pRAF) animParticles();
}
function spawnBurst(cfg, ox, oy) {
  for (let i=0; i<cfg.count; i++) {
    const angle = -Math.PI/2 - cfg.spread/2 + Math.random()*cfg.spread;
    const speed = cfg.minV + Math.random()*(cfg.maxV-cfg.minV);
    const life  = Math.floor(cfg.minL + Math.random()*(cfg.maxL-cfg.minL));
    pList.push({
      x:ox, y:oy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
      grav:cfg.grav, life, max:life, opacity:1,
      size:3+Math.random()*5,
      color:cfg.colors[Math.floor(Math.random()*cfg.colors.length)],
      shape:cfg.shapes[Math.floor(Math.random()*cfg.shapes.length)],
      rot:Math.random()*360, rotV:(Math.random()-.5)*8,
    });
  }
}
function animParticles() {
  pCtx.clearRect(0, 0, pCvs.width, pCvs.height);
  pList = pList.filter(p => {
    p.x+=p.vx; p.y+=p.vy; p.vy+=p.grav; p.rot+=p.rotV; p.life--;
    if (p.life < p.max*0.3) p.opacity = p.life/(p.max*0.3);
    return p.life > 0 && p.y < pCvs.height+50;
  });
  for (const p of pList) {
    pCtx.save();
    pCtx.globalAlpha = Math.max(0, p.opacity);
    pCtx.fillStyle   = p.color;
    pCtx.translate(p.x, p.y);
    pCtx.rotate(p.rot * Math.PI/180);
    if (p.shape === 'circle') {
      pCtx.beginPath(); pCtx.arc(0,0,p.size,0,Math.PI*2); pCtx.fill();
    } else if (p.shape === 'diamond') {
      pCtx.beginPath();
      pCtx.moveTo(0,-p.size); pCtx.lineTo(p.size,0); pCtx.lineTo(0,p.size); pCtx.lineTo(-p.size,0);
      pCtx.closePath(); pCtx.fill();
    } else if (p.shape === 'star') {
      pCtx.beginPath();
      for (let i=0; i<5; i++) {
        const a  = (i*Math.PI*2/5)-Math.PI/2;
        const ia = ((i+.5)*Math.PI*2/5)-Math.PI/2;
        i===0 ? pCtx.moveTo(Math.cos(a)*p.size, Math.sin(a)*p.size)
              : pCtx.lineTo(Math.cos(a)*p.size, Math.sin(a)*p.size);
        pCtx.lineTo(Math.cos(ia)*p.size*.4, Math.sin(ia)*p.size*.4);
      }
      pCtx.closePath(); pCtx.fill();
    }
    pCtx.restore();
  }
  if (pList.length > 0) pRAF = requestAnimationFrame(animParticles);
  else { pRAF = null; pCtx.clearRect(0,0,pCvs.width,pCvs.height); }
}

// ── Visibility — pause card animations when tab hidden ────────
document.addEventListener('visibilitychange', () => {
  $$('.card-inner').forEach(c => c.style.animationPlayState = document.hidden ? 'paused' : '');
});

// ── 30-min responsible gaming reminder ───────────────────────
setInterval(() => {
  if (Math.floor((Date.now()-sessionStart)/60000) >= 30) {
    const b = $('respBanner');
    if (b && !b.classList.contains('shown')) b.classList.add('open','shown');
  }
}, 30000);

// ── Init ──────────────────────────────────────────────────────
function init() {
  if (!window.crypto || !window.crypto.getRandomValues) {
    document.getElementById('gameTable').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:60vh;text-align:center;padding:32px">' +
      '<div><div style="font-family:\'Bodoni Moda\',serif;font-size:1.4rem;color:var(--blood-red);margin-bottom:12px">Secure Randomness Unavailable</div>' +
      '<p style="color:var(--ash-white)">Please use a modern browser to play.</p></div></div>';
    return;
  }
  setPhase(PHASE.IDLE);
  refreshDisplays();
  updateChipBtns();
  $('onboarding').classList.add('open');
}

init();
