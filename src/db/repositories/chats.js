const { getDb } = require('../connection');

function upsertChat(accountId, chat) {
  getDb()
    .prepare(
      `INSERT INTO chats (account_id, tiktok_username, display_name, streak_days, avatar_url, tiktok_item_id, last_parsed_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(account_id, tiktok_username) DO UPDATE SET
         display_name = excluded.display_name,
         streak_days = excluded.streak_days,
         avatar_url = excluded.avatar_url,
         tiktok_item_id = excluded.tiktok_item_id,
         last_parsed_at = datetime('now'),
         updated_at = datetime('now')`
    )
    .run(
      accountId,
      chat.tiktokUsername,
      chat.displayName || chat.tiktokUsername,
      chat.streakDays ?? null,
      chat.avatarUrl || null,
      chat.itemId || null
    );
}

async function upsertChats(accountId, chats) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO chats (account_id, tiktok_username, display_name, streak_days, avatar_url, tiktok_item_id, last_parsed_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(account_id, tiktok_username) DO UPDATE SET
       display_name = excluded.display_name,
       streak_days = excluded.streak_days,
       avatar_url = excluded.avatar_url,
       tiktok_item_id = excluded.tiktok_item_id,
       last_parsed_at = datetime('now'),
       updated_at = datetime('now')`
  );
  const tx = db.transaction((items) => {
    for (const chat of items) {
      stmt.run(
        accountId,
        chat.tiktokUsername,
        chat.displayName || chat.tiktokUsername,
        chat.streakDays ?? null,
        chat.avatarUrl || null,
        chat.itemId || null
      );
    }
  });
  tx(chats);
}

function getChatsByAccount(accountId) {
  return getDb()
    .prepare('SELECT * FROM chats WHERE account_id = ? ORDER BY display_name ASC')
    .all(accountId);
}

function getEnabledChats(accountId) {
  return getDb()
    .prepare('SELECT * FROM chats WHERE account_id = ? AND enabled = 1 ORDER BY display_name ASC')
    .all(accountId);
}

function toggleChat(chatId, enabled) {
  getDb().prepare('UPDATE chats SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    enabled ? 1 : 0,
    chatId
  );
}

function setAllChatsEnabled(accountId, enabled) {
  getDb()
    .prepare('UPDATE chats SET enabled = ?, updated_at = datetime(\'now\') WHERE account_id = ?')
    .run(enabled ? 1 : 0, accountId);
}

function getChatById(chatId) {
  return getDb().prepare('SELECT * FROM chats WHERE id = ?').get(chatId) || null;
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
