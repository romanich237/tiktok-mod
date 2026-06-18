CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  session_path TEXT NOT NULL,
  is_logged_in INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  tiktok_username TEXT NOT NULL,
  display_name TEXT NULL,
  streak_days INTEGER NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT NULL,
  last_parsed_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, tiktok_username),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error TEXT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scheduler_state (
  account_id TEXT PRIMARY KEY,
  next_run_at TEXT NULL,
  last_run_at TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
