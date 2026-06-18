const { getDb } = require('../connection');
const { getStorageStatePath } = require('../../config');

function ensureAccount(accountId) {
  const sessionPath = getStorageStatePath(accountId);
  getDb()
    .prepare(
      `INSERT INTO accounts (id, session_path, is_logged_in)
       VALUES (?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET
         session_path = excluded.session_path,
         updated_at = datetime('now')`
    )
    .run(accountId, sessionPath);
}

function setLoggedIn(accountId, isLoggedIn) {
  ensureAccount(accountId);
  getDb()
    .prepare(
      `UPDATE accounts
       SET is_logged_in = ?,
           last_login_at = CASE WHEN ? THEN datetime('now') ELSE last_login_at END,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(isLoggedIn ? 1 : 0, isLoggedIn ? 1 : 0, accountId);
}

function getAccount(accountId) {
  ensureAccount(accountId);
  return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) || null;
}

module.exports = {
  ensureAccount,
  setLoggedIn,
  getAccount,
};
