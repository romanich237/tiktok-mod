const { getPool } = require('../connection');
const { getStorageStatePath } = require('../../config');

async function ensureAccount(accountId) {
  const pool = getPool();
  const sessionPath = getStorageStatePath(accountId);
  await pool.query(
    `INSERT INTO accounts (id, session_path, is_logged_in)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE session_path = VALUES(session_path)`,
    [accountId, sessionPath]
  );
}

async function setLoggedIn(accountId, isLoggedIn) {
  const pool = getPool();
  await ensureAccount(accountId);
  await pool.query(
    `UPDATE accounts
     SET is_logged_in = ?, last_login_at = IF(?, NOW(), last_login_at)
     WHERE id = ?`,
    [isLoggedIn ? 1 : 0, isLoggedIn ? 1 : 0, accountId]
  );
}

async function getAccount(accountId) {
  const pool = getPool();
  await ensureAccount(accountId);
  const [rows] = await pool.query('SELECT * FROM accounts WHERE id = ?', [accountId]);
  return rows[0] || null;
}

module.exports = {
  ensureAccount,
  setLoggedIn,
  getAccount,
};
