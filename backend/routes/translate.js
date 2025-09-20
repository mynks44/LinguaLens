const express = require('express');
const axios = require('axios');
const router = express.Router();

/* ---------- config ---------- */
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL || ''; // optional
const MYMEMORY_KEY   = process.env.MYMEMORY_KEY   || ''; // optional
const LIBRE_URL      = process.env.LIBRE_URL      || ''; // optional fallback, e.g. "http://localhost:5000"

const mymem = axios.create({
  baseURL: 'https://api.mymemory.translated.net',
  timeout: 12000,
  headers: { 'User-Agent': 'language-coach/1.0' }
});

const libre = LIBRE_URL
  ? axios.create({
      baseURL: LIBRE_URL.replace(/\/+$/, ''),
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    })
  : null;

/* ---------- helpers ---------- */

function chunkText(s, max = 200) {
  const text = String(s || '').trim();
  if (!text) return [];
  if (text.length <= max) return [text];

  const parts = text.match(/[^.!?]+[.!?]+|\S+/g) || [text];
  const out = [];
  let cur = '';

  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (!cur) { cur = p; continue; }
    if ((cur + ' ' + p).length <= max) cur = cur + ' ' + p;
    else { out.push(cur); cur = p.length > max ? p.slice(0, max) : p; }
  }
  if (cur) out.push(cur);
  return out;
}

/** One MyMemory request. Retries small, throws QuotaExceeded on 429. */
async function myMemoryOnce(text, from, to) {
  const params = { q: text, langpair: `${from}|${to}` };
  if (MYMEMORY_EMAIL) params.de = MYMEMORY_EMAIL;
  if (MYMEMORY_KEY)   params.key = MYMEMORY_KEY;

  let attempt = 0;
  while (true) {
    try {
      const r = await mymem.get('/get', { params });
      const body = r.data || {};
      const status = body?.responseStatus;

      if (status === 429) {
        const msg = body?.responseDetails || 'Quota exceeded (MyMemory 429)';
        const err = new Error(msg);
        err.name = 'QuotaExceeded';
        throw err;
      }

      const primary = body?.responseData?.translatedText;
      if (primary) return String(primary);

      const alt = Array.isArray(body?.matches) && body.matches[0]?.translation;
      if (alt) return String(alt);

      throw new Error('no_translation_in_response');
    } catch (e) {
      const retriable =
        e?.name !== 'QuotaExceeded' &&
        (e?.response?.status === 429 || (e?.response?.status >= 500 && e?.response?.status < 600));
      if (retriable && attempt < 2) {
        attempt += 1;
        await new Promise(r => setTimeout(r, 250 * attempt)); // 250ms, 500ms
        continue;
      }
      throw e;
    }
  }
}

/** Optional LibreTranslate fallback. */
async function libreOnce(text, from, to) {
  if (!libre) throw new Error('Libre not configured');
  const r = await libre.post('/translate', {
    q: text, source: from, target: to, format: 'text'
  });
  const t = r.data?.translatedText || r.data?.translated || '';
  if (!t) throw new Error('libre_no_translation');
  return String(t);
}

/** Long text: chunk → sequential translate (MyMemory; fallback to Libre on quota) → join. */
async function translateLong(text, from, to) {
  const chunks = chunkText(text, 200);
  const out = [];

  for (const c of chunks) {
    let piece = '';
    try {
      piece = await myMemoryOnce(c, from, to);
    } catch (e) {
      if (e?.name === 'QuotaExceeded' && libre) {
        piece = await libreOnce(c, from, to);
      } else {
        throw e;
      }
    }
    out.push(piece.trim());
    await new Promise(r => setTimeout(r, 200));
  }

  return out.join(' ').trim();
}

/* ---------- route ---------- */

router.post('/', async (req, res) => {
  try {
    const { text, from, to } = req.body || {};
    if (typeof text !== 'string' || !from || !to) {
      return res.status(400).json({ error: 'bad_request', detail: 'text, from, to are required' });
    }
    const clean = text.trim();
    if (!clean) return res.json({ translatedText: '' });

    const translatedText = await translateLong(clean, from, to);
    return res.json({ translatedText });
  } catch (e) {
    if (e?.name === 'QuotaExceeded') {
      return res.status(429).json({
        error: 'quota_exceeded',
        detail: e.message || 'Daily free quota exceeded. Try again later or configure a provider key.'
      });
    }
    const status = e?.response?.status || 0;
    const data = e?.response?.data;
    console.error('[translate error]', status, e?.message || e, data);
    return res.status(502).json({ error: 'translate_failed', providerStatus: status, providerData: data });
  }
});

module.exports = router;
