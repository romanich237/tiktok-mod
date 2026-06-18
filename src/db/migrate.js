const fs = require('fs');
const path = require('path');
const { getPool } = require('./connection');
const { ROOT } = require('../config');
const logger = require('../logger');

async function migrate() {
  const sqlPath = path.join(ROOT, 'sql', '001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const pool = getPool();
  for (const statement of statements) {
    await pool.query(statement);
  }
  logger.info('Database migration completed');
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}

module.exports = { migrate };
