const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Free translation via MyMemory (no API key).
 * Docs: https://mymemory.translated.net/doc/spec.php
 * We keep it simple and return translatedText only.
 */
router.post('/', async (req, res) => {
  try {
    const { text, from, to } = req.body || {};
    if (!text || !from || !to) {
      return res.status(400).json({ error: 'bad_request', detail: 'text, from, to are required' });
    }

    // MyMemory expects langpair like "en|fr"
    const langpair = `${from}|${to}`;

    const r = await axios.get('https://api.mymemory.translated.net/get', {
      params: { q: text, langpair },
      timeout: 8000,
      headers: { 'User-Agent': 'language-coach/1.0' }
    });

    // Best match is in responseData.translatedText
    const translated = r.data?.responseData?.translatedText;

    if (translated) {
      return res.json({ translatedText: translated });
    }

    // Fallback: check first match in matches array
    const alt = Array.isArray(r.data?.matches) && r.data.matches[0]?.translation;
    if (alt) {
      return res.json({ translatedText: alt });
    }

    return res.status(502).json({ error: 'translate_unavailable' });
  } catch (e) {
    console.error('[translate error]', e.response?.status, e.message);
    return res.status(502).json({ error: 'translate_failed' });
  }
});

module.exports = router;
