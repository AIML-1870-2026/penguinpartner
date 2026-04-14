require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `You are a creative and experienced science educator. When given a grade level and a list of available materials, you generate one or more safe, engaging, grade-appropriate science experiments. For each experiment, include:
- A clear title
- Learning objectives aligned to the grade level
- A full materials list (only using what was provided)
- Step-by-step instructions
- Expected results and the science behind them
- Optional extension ideas for advanced students

Format your entire response in Markdown.`;

app.post('/api/generate', async (req, res) => {
  const { gradeLevel, supplies, apiKey } = req.body;

  if (!gradeLevel || !supplies) {
    return res.status(400).json({ error: 'Both gradeLevel and supplies are required.' });
  }

  const keyToUse = apiKey || OPENAI_API_KEY;
  if (!keyToUse || keyToUse === 'sk-...') {
    return res.status(500).json({ error: 'No API key found. Enter your OpenAI key using the field at the top of the page.' });
  }

  const userMessage = `Grade level: ${gradeLevel}\nAvailable supplies: ${supplies}\n\nPlease suggest one or more science experiments I can do with these materials at this grade level.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `OpenAI returned status ${response.status}`;
      return res.status(response.status).json({ error: message });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';
    return res.json({ result });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach OpenAI. Check your network connection.' });
  }
});

app.listen(PORT, () => {
  console.log(`Science Experiment Generator running at http://localhost:${PORT}`);
});
