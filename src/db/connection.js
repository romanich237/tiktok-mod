const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { getDatabasePath, ROOT } = require('../config');

let db;
let schemaReady = false;

function initSchema() {
  if (schemaReady) return;

  const sqlPath = path.join(ROOT, 'sql', '001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    db.exec(statement);
  }
  schemaReady = true;
}

function getDb() {
  if (!db) {
    const dbPath = getDatabasePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

module.exports = { getDb };
