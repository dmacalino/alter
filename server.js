const express = require('express');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

app.post('/api/speak', async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ElevenLabs key not configured' });

  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || '21m00Tcm4TlvDq8ikWAM'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err });
    }

    // Stream audio back to client
    res.setHeader('Content-Type', 'audio/mpeg');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/imagine', async (req, res) => {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) return res.status(500).json({ error: 'Replicate key not configured' });

  const { manifestation } = req.body;

  const prompt = `Abstract painterly tarot card illustration. ${manifestation}. Moody atmospheric. No people, no faces, no hands, no text. Muted gold and dark tones. Feels like a place not a scene. Style contemporary tarot editorial illustration.`;

  try {
    // Start the prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
        input: {
          prompt: prompt,
          negative_prompt: "people, faces, hands, text, words, letters, photorealistic, ugly, blurry",
          width: 512,
          height: 768,
          num_inference_steps: 30,
          guidance_scale: 7.5
        }
      })
    });

    const prediction = await response.json();

    // Poll until done
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise(r => setTimeout(r, 1000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Token ${apiKey}` }
      });
      result = await poll.json();
    }

    if (result.status === 'failed') {
      return res.status(500).json({ error: 'Image generation failed' });
    }

    res.json({ imageUrl: result.output[0] });

  } catch (err) {
    console.error('Imagine error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`ALTER server running on port ${PORT}`);
});