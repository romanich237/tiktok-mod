const { getPool } = require('../connection');

async function getSchedulerState(accountId) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT * FROM scheduler_state WHERE account_id = ?',
    [accountId]
  );
  return rows[0] || null;
}

async function setNextRun(accountId, nextRunAt, lastRunAt = null) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO scheduler_state (account_id, next_run_at, last_run_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       next_run_at = VALUES(next_run_at),
       last_run_at = COALESCE(VALUES(last_run_at), last_run_at)`,
    [accountId, nextRunAt, lastRunAt]
  );
}

module.exports = {
  getSchedulerState,
  setNextRun,
};
