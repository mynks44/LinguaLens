const router = require('express').Router();
const { driver } = require('../db/neo4j');

function nowMs() { return Date.now(); }

// ----- POST /progress/event ---------------------------------------------------
router.post('/event', async (req, res, next) => {
  const { userId, word, lang, type } = req.body || {};
  if (!userId || !word || !lang || !['seen','known','heard'].includes(type)) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  const ts = nowMs();
  const delta = type === 'seen' ? 0.05 : type === 'known' ? 0.2 : 0.03;

  const session = driver.session();
  try {
const result = await session.run(`
  // Ensure nodes
  MERGE (u:User {userId: $userId})
  MERGE (l:Language {code: $lang})
  MERGE (w:Word {text: $word, lang: $lang})
  MERGE (u)-[r:ENCOUNTER]->(w)
  ON CREATE SET r.timesSeen = 0, r.timesKnown = 0, r.timesHeard = 0, r.confidence = 0.0, r.lastSeen = $ts

  // compute full days since lastSeen
  WITH u, w, r, l, $ts AS ts
  WITH u, w, r, l, ts, (r.lastSeen IS NULL OR r.lastSeen = 0) AS noPrev
  WITH u, w, r, l, ts,
       CASE WHEN noPrev THEN 0 ELSE toInteger( (ts - r.lastSeen) / (1000*60*60*24) ) END AS days

  // decay without pow(): multiply by 0.995^days using reduce()
  WITH u, w, r, l, ts, days,
       CASE
         WHEN days <= 0 THEN r.confidence
         ELSE r.confidence * reduce(f = 1.0, _ IN range(1, days) | f * 0.995)
       END AS decayed

  SET r.confidence = decayed

  // counters & confidence delta
  SET r.${'times'+(type.charAt(0).toUpperCase()+type.slice(1))} = coalesce(r.${'times'+(type.charAt(0).toUpperCase()+type.slice(1))},0) + 1
  SET r.confidence = CASE WHEN r.confidence IS NULL THEN $delta ELSE r.confidence + $delta END
  SET r.confidence = CASE WHEN r.confidence > 1.0 THEN 1.0 ELSE r.confidence END
  SET r.lastSeen = ts

  RETURN u.userId AS userId, w.text AS word, w.lang AS lang, r.confidence AS confidence,
         r.timesSeen AS timesSeen, r.timesKnown AS timesKnown, r.timesHeard AS timesHeard, r.lastSeen AS lastSeen
`, { userId, word, lang, ts, delta });


    const row = result.records[0]?.toObject() || null;
    res.json(row);
  } catch (e) {
    next(e);
  } finally {
    await session.close();
  }
});

// ----- GET /progress/overview -------------------------------------------------
router.get('/overview', async (req, res, next) => {
  const userId = req.query.userId;
  const lang = req.query.lang || null;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (u:User {userId:$userId})-[r:ENCOUNTER]->(w:Word)
      ${lang ? 'WHERE w.lang = $lang' : ''}
      WITH count(r) AS totalWords,
           sum(CASE WHEN r.confidence >= 0.8 THEN 1 ELSE 0 END) AS strong,
           sum(CASE WHEN r.confidence >= 0.5 AND r.confidence < 0.8 THEN 1 ELSE 0 END) AS medium,
           sum(CASE WHEN r.confidence < 0.5 THEN 1 ELSE 0 END) AS weak,
           sum(r.timesSeen) AS seenSum, sum(r.timesKnown) AS knownSum, sum(r.timesHeard) AS heardSum
      RETURN totalWords, strong, medium, weak, seenSum, knownSum, heardSum
      `,
      { userId, lang }
    );

    const r = result.records[0]?.toObject() || {
      totalWords: 0, strong: 0, medium: 0, weak: 0, seenSum: 0, knownSum: 0, heardSum: 0
    };
    res.json(r);
  } catch (e) {
    next(e);
  } finally {
    await session.close();
  }
});

// ----- GET /progress/top-words -----------------------------------------------
// ----- GET /progress/top-words -----------------------------------------------
// /progress/top-words?userId=...&lang=fr&metric=confidence|seen|known|heard&order=high|low&limit=10
router.get('/top-words', async (req, res, next) => {
  const userId = String(req.query.userId || '');
  const lang   = req.query.lang ? String(req.query.lang) : null;

  // sanitize metric and order
  const metricParam = String(req.query.metric || 'confidence').toLowerCase();
  const allowedMetrics = new Set(['confidence', 'seen', 'known', 'heard']);
  const metric = allowedMetrics.has(metricParam) ? metricParam : 'confidence';

  const orderParam = String(req.query.order || 'high').toLowerCase();
  const orderDir = orderParam === 'low' ? 'ASC' : 'DESC';

  // sanitize limit
  const limitParsed = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Number.isFinite(limitParsed) ? Math.max(1, Math.min(limitParsed, 100)) : 20;

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const session = driver.session();
  try {
    const cypher = `
      MATCH (u:User {userId:$userId})-[r:ENCOUNTER]->(w:Word)
      ${lang ? 'WHERE w.lang = $lang' : ''}
      WITH w,
           COALESCE(r.confidence, 0.0) AS confidence,
           COALESCE(r.timesSeen,  0)   AS seen,
           COALESCE(r.timesKnown, 0)   AS known,
           COALESCE(r.timesHeard, 0)   AS heard,
           COALESCE(r.lastSeen,  0)    AS lastSeen,
           $metric AS metricName
      // choose the sort metric based on requested metricName
      WITH w, confidence, seen, known, heard, lastSeen,
           CASE metricName
             WHEN 'seen'  THEN seen
             WHEN 'known' THEN known
             WHEN 'heard' THEN heard
             ELSE confidence
           END AS metric
      RETURN
        w.text  AS text,
        w.lang  AS lang,
        confidence,
        seen     AS timesSeen,
        known    AS timesKnown,
        heard    AS timesHeard,
        lastSeen
      ORDER BY metric ${orderDir}, text ASC
      LIMIT $limit
    `;

    const result = await session.run(cypher, { userId, lang, limit, metric });
    const data = result.records.map(r => r.toObject());
    res.json({ data });
  } catch (e) {
    console.error('top-words error:', e);
    next(e);
  } finally {
    await session.close();
  }
});



module.exports = router;
