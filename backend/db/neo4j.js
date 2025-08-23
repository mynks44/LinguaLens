const neo4j = require('neo4j-driver');

const uri  = process.env.NEO4J_URI;        
const user = process.env.NEO4J_USER;       
const pass = process.env.NEO4J_PASSWORD;   
const dbName = process.env.NEO4J_DATABASE || 'neo4j';

if (!uri || !user || !pass) {
  console.warn('[neo4j] Missing env vars NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD');
}

const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));

module.exports = { driver, dbName };
