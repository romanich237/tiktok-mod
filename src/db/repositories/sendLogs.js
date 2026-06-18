const { getDb } = require('../connection');

function addLog(chatId, emoji, status, error = null) {
  getDb()
    .prepare('INSERT INTO send_logs (chat_id, emoji, status, error) VALUES (?, ?, ?, ?)')
    .run(chatId, emoji, status, error);
}

function getRecentLogs(accountId, limit = 10) {
  return getDb()
    .prepare(
      `SELECT sl.*, c.tiktok_username, c.display_name
       FROM send_logs sl
       JOIN chats c ON c.id = sl.chat_id
       WHERE c.account_id = ?
       ORDER BY sl.sent_at DESC
       LIMIT ?`
    )
    .all(accountId, limit);
}

module.exports = {
  addLog,
  getRecentLogs,
};
