/**
 * In-memory login wizard sessions (per Telegram user).
 */
const sessions = new Map();

function get(userId) {
  return sessions.get(userId) || null;
}

function set(userId, data) {
  sessions.set(userId, { ...data, updatedAt: Date.now() });
}

function update(userId, patch) {
  const current = get(userId) || {};
  set(userId, { ...current, ...patch });
}

function clear(userId) {
  sessions.delete(userId);
}

function isActive(userId) {
  return sessions.has(userId);
}

module.exports = { get, set, update, clear, isActive };
