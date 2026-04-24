/* ── Constants ─────────────────────────────────────────────────── */
const RACE_DATE = new Date('2026-10-11T10:00:00-05:00');
const GOAL      = 25000;
const DATA_URL  = './data/race-data.json';

/* ── Utilities ─────────────────────────────────────────────────── */
function formatMoneyFull(n) {
  return '$' + Math.round(n).toLocaleString();
}

function daysUntilRace() {
  const diff = RACE_DATE - new Date();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

/* ── Stat counter animation ─────────────────────────────────────── */
const animatedIds = new Set();

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) runCounter(e.target); });
}, { threshold: 0.3 });

function runCounter(el) {
  const target   = parseFloat(el.dataset.target) || 0;
  const prefix   = el.dataset.prefix || '';
  const suffix   = el.dataset.suffix || '';
  const duration = 1100;
  const start    = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = Math.round(target * eased);
    el.textContent = prefix + current.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = prefix + target.toLocaleString() + suffix;
  }
  requestAnimationFrame(step);
}

function animateCounter(id, target, prefix, suffix) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.target = target;
  el.dataset.prefix = prefix || '';
  el.dataset.suffix = suffix || '';
  if (!animatedIds.has(id)) {
    animatedIds.add(id);
    counterObserver.observe(el);
  } else {
    runCounter(el);
  }
}

/* ── DOM updates ────────────────────────────────────────────────── */
function updateHero(raised) {
  const pct  = Math.min((raised / GOAL) * 100, 100);
  const fill  = document.getElementById('hero-fill');
  const track = document.getElementById('hero-track');
  document.getElementById('hero-raised').textContent = formatMoneyFull(raised);
  document.getElementById('hero-pct').textContent    = pct.toFixed(1) + '%';
  fill.style.width = pct + '%';
  track.setAttribute('aria-valuenow', Math.round(pct));
}

function updateStats(data) {
  const raised   = data.total_raised      || 0;
  const runners  = data.participant_count || 0;
  const tributes = data.tribute_count     || 0;

  animateCounter('stat-raised',   raised,   '$', '');
  animateCounter('stat-runners',  runners,  '',  '');
  animateCounter('stat-tributes', tributes, '',  '');

  document.getElementById('stat-days').textContent    = daysUntilRace();
  document.getElementById('tribute-count').textContent = tributes.toLocaleString();
}

function updateProgress(raised) {
  const pct = Math.min((raised / GOAL) * 100, 100);
  document.getElementById('therm-fill').style.height = pct + '%';
  document.getElementById('prog-raised').textContent  = formatMoneyFull(raised);
  document.getElementById('prog-pct').textContent     = pct.toFixed(1) + '%';

  ['5k', '10k', '15k', '20k', '25k'].forEach(id => {
    const el = document.getElementById('ms-' + id);
    if (el && raised >= parseFloat(el.dataset.goal)) el.classList.add('reached');
  });
}

function updateLeaderboard(teams) {
  const list = document.getElementById('leaderboard');
  if (!teams || teams.length === 0) {
    list.innerHTML = '<li class="leaderboard__placeholder">No teams yet — be the first to start a fundraising team!</li>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  list.innerHTML = teams.slice(0, 10).map((t, i) => `
    <li class="leaderboard__item">
      <span class="leaderboard__rank">${medals[i] || '#' + (i + 1)}</span>
      <span class="leaderboard__name">${escHtml(t.name)}</span>
      <span class="leaderboard__amount">${formatMoneyFull(t.amount_raised)}</span>
    </li>
  `).join('');
}

function setLastUpdated(timestamp) {
  const el = document.getElementById('last-updated');
  if (!timestamp) { el.textContent = '—'; return; }
  el.textContent = new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium', timeStyle: 'short'
  });
}

/* ── Sponsor rendering ──────────────────────────────────────────── */
function renderSponsors() {
  const grid = document.getElementById('sponsors-grid');
  if (!grid || typeof SPONSORS === 'undefined') return;

  const byTier = {
    'fairy-godmother': [],
    'king-queen':      [],
    'superhero':       [],
    'prince-princess': [],
    'sidekick':        [],
  };
  SPONSORS.forEach(s => { if (byTier[s.tier]) byTier[s.tier].push(s); });

  const tierMeta = {
    'fairy-godmother': { label: '🧚 Fairy Godmother', benefit: '$3,000+ · Large logo on banner & t-shirts, 10 free registrations' },
    'king-queen':      { label: '👑 King / Queen',     benefit: '$2,000–$2,999 · Medium logo on banner & t-shirts, 5 free registrations' },
    'superhero':       { label: '🦸 Superhero',         benefit: '$1,000–$1,999 · Small logo on banner & t-shirts, 3 free registrations' },
    'prince-princess': { label: '🤴 Prince / Princess', benefit: '$500–$999 · Recognition on Memories for Kids website' },
    'sidekick':        { label: '🦸 Sidekick',          benefit: '$100–$499 · Recognition on Memories for Kids website' },
  };

  function cardHtml(sponsor, tierKey) {
    const meta  = tierMeta[tierKey];
    const empty = !sponsor;
    const inner = empty
      ? `<span class="sponsor-card__name">${escHtml(meta.label)} — Spot Available</span>`
      : sponsor.logo
        ? `<img src="${escHtml(sponsor.logo)}" alt="${escHtml(sponsor.name)} logo" class="sponsor-card__logo">`
        : `<span class="sponsor-card__name">${escHtml(sponsor.name)}</span>`;
    return `<div class="sponsor-card sponsor-card--${tierKey}${empty ? ' sponsor-card--empty' : ''}">
      <span class="sponsor-card__tier-label">${escHtml(meta.label)}</span>
      ${inner}
      <span class="sponsor-card__benefit">${escHtml(meta.benefit)}</span>
    </div>`;
  }

  function rowCards(tierKey) {
    const list = byTier[tierKey];
    return list.length > 0
      ? list.map(s => cardHtml(s, tierKey)).join('')
      : cardHtml(null, tierKey);
  }

  let html = '';

  // Row 1: Fairy Godmother (full width)
  html += rowCards('fairy-godmother');

  // Row 2: King/Queen + Superhero
  html += `<div class="sponsors-row-2">${rowCards('king-queen')}${rowCards('superhero')}</div>`;

  // Row 3: Prince/Princess + Sidekick
  html += `<div class="sponsors-row-3">${rowCards('prince-princess')}${rowCards('sidekick')}</div>`;

  grid.innerHTML = html;
}

/* ── Data fetching ──────────────────────────────────────────────── */
async function loadData() {
  try {
    const res = await fetch(DATA_URL + '?_=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    applyData(data);
  } catch (err) {
    console.warn(
      'Could not load race-data.json:', err.message,
      '\nIf running locally, serve via HTTP: python3 -m http.server 8000'
    );
    showDataError();
  }
}

function applyData(data) {
  const raised = data.total_raised || 0;
  updateHero(raised);
  updateStats(data);
  updateProgress(raised);
  updateLeaderboard(data.top_fundraisers || []);
  setLastUpdated(data.fetched_at);
}

function showDataError() {
  document.getElementById('hero-raised').textContent   = '—';
  document.getElementById('last-updated').textContent  = 'unavailable';
  document.getElementById('leaderboard').innerHTML =
    '<li class="leaderboard__placeholder">Live data unavailable. Visit <a href="https://runsignup.com/Race/204626">RunSignup</a> for current information.</li>';
}

/* ── Init ───────────────────────────────────────────────────────── */
document.getElementById('stat-days').textContent = daysUntilRace();

document.getElementById('refresh-btn').addEventListener('click', () => {
  document.getElementById('last-updated').textContent = 'refreshing…';
  loadData();
});

renderSponsors();
loadData();
