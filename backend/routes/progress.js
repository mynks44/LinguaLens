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
    const result = await session.run(
      `
      MERGE (u:User {userId: $userId})
      MERGE (l:Language {code: $lang})
      MERGE (w:Word {text: $word, lang: $lang})
      MERGE (u)-[r:ENCOUNTER]->(w)
      ON CREATE SET r.timesSeen = 0, r.timesKnown = 0, r.timesHeard = 0, r.confidence = 0.0, r.lastSeen = $ts

      WITH u, w, r, l, $ts AS ts
      WITH u, w, r, l, ts, (r.lastSeen IS NULL OR r.lastSeen = 0) AS noPrev
      WITH u, w, r, l, ts, CASE WHEN noPrev THEN 0 ELSE toInteger( (ts - r.lastSeen) / (1000*60*60*24) ) END AS days

      SET r.confidence =
        CASE WHEN days <= 0 THEN r.confidence
             ELSE r.confidence * toFloat(pow(0.995, days))
        END

      SET r.${'times'+(type.charAt(0).toUpperCase()+type.slice(1))} =
          coalesce(r.${'times'+(type.charAt(0).toUpperCase()+type.slice(1))},0) + 1

      SET r.confidence = CASE WHEN r.confidence IS NULL THEN $delta ELSE r.confidence + $delta END
      SET r.confidence = CASE WHEN r.confidence > 1.0 THEN 1.0 ELSE r.confidence END
      SET r.lastSeen = ts

      RETURN u.userId AS userId, w.text AS word, w.lang AS lang, r.confidence AS confidence,
             r.timesSeen AS timesSeen, r.timesKnown AS timesKnown, r.timesHeard AS timesHeard, r.lastSeen AS lastSeen
      `,
      { userId, word, lang, ts, delta }
    );

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
router.get('/top-words', async (req, res, next) => {
  const userId = req.query.userId;
  const lang = req.query.lang || null;

  // sanitize order & limit
  const order = (req.query.order || 'low').toString().toLowerCase() === 'high' ? 'high' : 'low';
  const limitParsed = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Number.isFinite(limitParsed) ? Math.max(1, Math.min(limitParsed, 100)) : 20;

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const session = driver.session();
  try {
    const cypher = `
      MATCH (u:User {userId:$userId})-[r:ENCOUNTER]->(w:Word)
      ${lang ? 'WHERE w.lang = $lang' : ''}
      RETURN w.text AS word, w.lang AS lang, r.confidence AS confidence,
             r.timesSeen AS timesSeen, r.timesKnown AS timesKnown
      ORDER BY ${order === 'high' ? 'r.confidence DESC' : 'r.confidence ASC'}
      LIMIT toInteger($limit)          // <<--- cast to integer in Cypher
    `;

    const result = await session.run(cypher, { userId, lang, limit: Math.trunc(limit) });
    res.json(result.records.map(rec => rec.toObject()));
  } catch (e) {
    next(e);
  } finally {
    await session.close();
  }
});


module.exports = router;
