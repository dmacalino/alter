const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve index_v4.html as the root page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index_v4.html'));
});

// Proxy endpoint for Anthropic API — keeps the key server-side
app.post('/api/agent', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    console.log('Proxying to Anthropic, model:', req.body.model);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    if (data.error) console.error('Anthropic API error:', JSON.stringify(data.error));
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`ALTER server running on port ${PORT}`));
