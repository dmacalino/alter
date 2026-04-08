const express = require('express');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index_v4.html'));
});

app.post('/api/agent', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    console.log('Proxying to Anthropic, model:', req.body?.model);
    console.log('Request body received:', JSON.stringify(req.body, null, 2));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const rawText = await response.text();
    console.log('Anthropic status:', response.status);
    console.log('Anthropic raw response:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Anthropic returned non-JSON:', parseErr.message);
      return res.status(500).json({
        error: 'Anthropic returned non-JSON response',
        raw: rawText
      });
    }

    if (!response.ok) {
      console.error('Anthropic HTTP error:', response.status, data);
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({
      error: err.message || 'Unknown server error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`ALTER server running on port ${PORT}`);
});