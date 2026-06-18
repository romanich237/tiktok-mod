const { getPool } = require('../connection');

async function upsertChat(accountId, chat) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO chats (account_id, tiktok_username, display_name, streak_days, avatar_url, last_parsed_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       streak_days = VALUES(streak_days),
       avatar_url = VALUES(avatar_url),
       last_parsed_at = NOW()`,
    [
      accountId,
      chat.tiktokUsername,
      chat.displayName || chat.tiktokUsername,
      chat.streakDays ?? null,
      chat.avatarUrl || null,
    ]
  );
}

async function upsertChats(accountId, chats) {
  for (const chat of chats) {
    await upsertChat(accountId, chat);
  }
}

async function getChatsByAccount(accountId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM chats WHERE account_id = ? ORDER BY display_name ASC`,
    [accountId]
  );
  return rows;
}

async function getEnabledChats(accountId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM chats WHERE account_id = ? AND enabled = 1 ORDER BY display_name ASC`,
    [accountId]
  );
  return rows;
}

async function toggleChat(chatId, enabled) {
  const pool = getPool();
  await pool.query('UPDATE chats SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, chatId]);
}

async function setAllChatsEnabled(accountId, enabled) {
  const pool = getPool();
  await pool.query('UPDATE chats SET enabled = ? WHERE account_id = ?', [enabled ? 1 : 0, accountId]);
}

async function getChatById(chatId) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM chats WHERE id = ?', [chatId]);
  return rows[0] || null;
}

module.exports = {
  upsertChat,
  upsertChats,
  getChatsByAccount,
  getEnabledChats,
  toggleChat,
  setAllChatsEnabled,
  getChatById,
};
