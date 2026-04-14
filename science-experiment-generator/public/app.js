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

  if (!apiKey) {
    showError('Please enter your OpenAI API key at the top of the page first.');
    setLoading(false);
    return;
  }

  const systemPrompt = `You are a creative and experienced science educator. When given a grade level and a list of available materials, you generate one or more safe, engaging, grade-appropriate science experiments. For each experiment, include:
- A clear title
- Learning objectives aligned to the grade level
- A full materials list (only using what was provided)
- Step-by-step instructions
- Expected results and the science behind them
- Optional extension ideas for advanced students

Format your entire response in Markdown.`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || `OpenAI error (${res.status})`;
      showError(msg);
      return;
    }

    const result = data.choices?.[0]?.message?.content || '';
    renderResults(result);
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
