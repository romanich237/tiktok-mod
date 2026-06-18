const { getDb } = require('../connection');

function getSchedulerState(accountId) {
  return getDb().prepare('SELECT * FROM scheduler_state WHERE account_id = ?').get(accountId) || null;
}

function setNextRun(accountId, nextRunAt, lastRunAt = null) {
  getDb()
    .prepare(
      `INSERT INTO scheduler_state (account_id, next_run_at, last_run_at)
       VALUES (?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         next_run_at = excluded.next_run_at,
         last_run_at = COALESCE(excluded.last_run_at, last_run_at),
         updated_at = datetime('now')`
    )
    .run(accountId, nextRunAt, lastRunAt);
}

module.exports = {
  getSchedulerState,
  setNextRun,
};
