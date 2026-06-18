const { getPool } = require('../connection');

async function addLog(chatId, emoji, status, error = null) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO send_logs (chat_id, emoji, status, error) VALUES (?, ?, ?, ?)`,
    [chatId, emoji, status, error]
  );
}

async function getRecentLogs(accountId, limit = 10) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT sl.*, c.tiktok_username, c.display_name
     FROM send_logs sl
     JOIN chats c ON c.id = sl.chat_id
     WHERE c.account_id = ?
     ORDER BY sl.sent_at DESC
     LIMIT ?`,
    [accountId, limit]
  );
  return rows;
}

module.exports = {
  addLog,
  getRecentLogs,
};
