const router = require('express').Router();

router.post('/', async (req, res) => {
  const { knownWords = [], newWords = [], length = 120, topic = 'daily life' } = req.body || {};
  const clean = a => (a || []).map(w => String(w || '').toLowerCase()).filter(Boolean);

  const known = clean(knownWords);
  const fresh = clean(newWords);
  if (!known.length || !fresh.length) return res.status(400).json({ error: 'need_known_and_new' });

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const newUseCounts = Object.fromEntries(fresh.map(w => [w, 0]));

  const sentences = [];
  const targetSentences = Math.max(6, Math.min(12, Math.round(length / 15)));

  for (let i = 0; i < targetSentences; i++) {
    const parts = [];
    const slots = 8;
    const sprinkleNewAt = new Set([2, 5].filter(() => Math.random() < 0.8));

    for (let j = 0; j < slots; j++) {
      let word;
      if (sprinkleNewAt.has(j)) {
        const candidates = fresh.filter(w => newUseCounts[w] < 2);
        word = candidates.length ? pick(candidates) : pick(fresh);
        newUseCounts[word] = (newUseCounts[word] || 0) + 1;
      } else {
        word = pick(known);
      }
      parts.push(word);
    }
    if (Math.random() < 0.5) parts.push(pick(known));
    if (i % 2 === 0 && topic) parts.splice(1, 0, topic.toLowerCase());
    sentences.push(cap(parts.join(' ').replace(/\s+/g, ' ')) + '.');
  }

  const paragraph = sentences.join(' ');
  const usedNew = Object.entries(newUseCounts).filter(([,c]) => c > 0).map(([w]) => w);
  res.json({ paragraph, usedNew });
});

module.exports = router;
