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

// Allow pressing Enter in the key input
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); setKey(); }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const gradeLevel = document.getElementById('grade-level').value;
  const supplies = suppliesInput.value.trim();

  // Client-side validation
  if (!supplies) {
    suppliesError.hidden = false;
    suppliesInput.focus();
    return;
  }
  suppliesError.hidden = true;

  setLoading(true);
  hideError();

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeLevel, supplies, apiKey: apiKey || undefined }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      showError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    renderResults(data.result);
  } catch (err) {
    console.error(err);
    showError('Network error — could not reach the server. Is it running?');
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
