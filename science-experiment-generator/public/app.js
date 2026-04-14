const form = document.getElementById('experiment-form');
const submitBtn = document.getElementById('submit-btn');
const btnLabel = document.getElementById('btn-label');
const btnSpinner = document.getElementById('btn-spinner');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const resultsSection = document.getElementById('results-section');
const resultsContent = document.getElementById('results-content');
const suppliesInput = document.getElementById('supplies');
const suppliesError = document.getElementById('supplies-error');
const apiKeyInput = document.getElementById('api-key-input');
const keyStatus = document.getElementById('key-status');
const keyDot = document.getElementById('key-dot');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');

const HISTORY_KEY = 'sciexp_history';
const MAX_HISTORY = 10;

// API key stored in memory only — never persisted
let apiKey = '';

function setKey() {
  const val = apiKeyInput.value.trim();
  if (!val) return;
  apiKey = val;
  apiKeyInput.value = '';
  keyStatus.textContent = 'key set';
  keyStatus.classList.add('key-set');
  keyDot.classList.add('active');
}

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); setKey(); }
});

// ── System prompt ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are a creative and experienced science educator. When given a grade level and a list of available materials, you generate one or more safe, engaging, grade-appropriate science experiments.

For each experiment, include the following sections in this order:
1. A clear title (as a Markdown heading)
2. **Difficulty:** Easy, Medium, or Hard — with a one-sentence explanation of why
3. Learning objectives aligned to the grade level
4. A full materials list (only using what was provided)
5. Step-by-step instructions
6. Expected results and the science behind them
7. Optional extension ideas for advanced students

Format your entire response in Markdown. Separate multiple experiments with a horizontal rule (---).`;

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const gradeLevel = document.getElementById('grade-level').value;
  const supplies = suppliesInput.value.trim();

  if (!supplies) {
    suppliesError.hidden = false;
    suppliesInput.focus();
    return;
  }
  suppliesError.hidden = true;

  if (!apiKey) {
    showError('Please enter your OpenAI API key at the top of the page first.');
    return;
  }

  setLoading(true);
  hideError();

  const userMessage = `Grade level: ${gradeLevel}\nAvailable supplies: ${supplies}\n\nPlease suggest one or more science experiments I can do with these materials at this grade level.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data?.error?.message || `OpenAI error (${res.status})`);
      return;
    }

    const result = data.choices?.[0]?.message?.content || '';
    renderResults(result);
    saveToHistory({ gradeLevel, supplies, result, timestamp: Date.now() });
  } catch (err) {
    console.error(err);
    showError('Network error — could not reach OpenAI. Check your connection.');
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnLabel.textContent = isLoading ? 'Generating…' : 'Generate Experiment';
  btnSpinner.hidden = !isLoading;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.hidden = false;
}

function hideError() {
  errorBanner.hidden = true;
  errorMessage.textContent = '';
}

function renderResults(markdown) {
  resultsContent.innerHTML = marked.parse(markdown);
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function dismissError() {
  hideError();
}

function resetForm() {
  form.reset();
  suppliesError.hidden = true;
  hideError();
  resultsSection.hidden = true;
  resultsContent.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── History ───────────────────────────────────────────────

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveToHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function renderHistory() {
  const history = loadHistory();

  if (history.length === 0) {
    historySection.hidden = true;
    return;
  }

  historySection.hidden = false;
  historyList.innerHTML = '';

  history.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const suppliesPreview = entry.supplies.length > 60
      ? entry.supplies.slice(0, 60) + '…'
      : entry.supplies;

    item.innerHTML = `
      <button class="history-toggle" onclick="toggleHistory(this)" aria-expanded="false">
        <span class="history-meta">
          <span class="history-grade">${entry.gradeLevel}</span>
          <span class="history-supplies">${suppliesPreview}</span>
        </span>
        <span class="history-right">
          <span class="history-date">${formatDate(entry.timestamp)}</span>
          <span class="history-chevron">▾</span>
        </span>
      </button>
      <div class="history-body" hidden>
        <div class="markdown-body">${marked.parse(entry.result)}</div>
      </div>
    `;
    historyList.appendChild(item);
  });
}

function toggleHistory(btn) {
  const body = btn.nextElementSibling;
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', !expanded);
  body.hidden = expanded;
  btn.querySelector('.history-chevron').textContent = expanded ? '▾' : '▴';
}

// Load history on page start
renderHistory();
