const { driver } = require('./neo4j');

(async () => {
  const session = driver.session();
  try {
    await session.run(`
      CREATE CONSTRAINT user_id IF NOT EXISTS
      FOR (u:User) REQUIRE u.userId IS UNIQUE;
    `);
    await session.run(`
      CREATE CONSTRAINT word_key IF NOT EXISTS
      FOR (w:Word) REQUIRE (w.text, w.lang) IS NODE KEY;
    `);
    await session.run(`
      CREATE CONSTRAINT lang_code IF NOT EXISTS
      FOR (l:Language) REQUIRE l.code IS UNIQUE;
    `);
    console.log('[Neo4j] Constraints ensured');
  } catch (e) {
    console.error('[Neo4j] init error', e);
  } finally {
    await session.close();
    process.exit(0);
  }
})();
