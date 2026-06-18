const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const EXAMPLE_CONFIG_PATH = path.join(ROOT, 'config.json.example');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    if (fs.existsSync(EXAMPLE_CONFIG_PATH)) {
      fs.copyFileSync(EXAMPLE_CONFIG_PATH, CONFIG_PATH);
    } else {
      throw new Error('config.json not found. Copy config.json.example to config.json');
    }
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed.mysql && !parsed.database) {
    parsed.database = { file: 'data/tiktok_mod.db' };
    delete parsed.mysql;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(parsed, null, 2), 'utf8');
  }
  return parsed;
}

const config = loadConfig();

function getSessionDir(accountId) {
  const dir = path.join(ROOT, 'sessions', accountId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getStorageStatePath(accountId) {
  return path.join(getSessionDir(accountId), 'state.json');
}

function getTelegramBotToken() {
  const token = config.telegram?.botToken;
  if (!token || token === 'your_bot_token_here') {
    throw new Error('Set telegram.botToken in config.json');
  }
  return token;
}

function getDatabasePath() {
  const file = config.database?.file || 'data/tiktok_mod.db';
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

module.exports = {
  config,
  ROOT,
  CONFIG_PATH,
  getSessionDir,
  getStorageStatePath,
  getTelegramBotToken,
  getDatabasePath,
  env: {
    get telegramBotToken() {
      return getTelegramBotToken();
    },
    get databaseFile() {
      return getDatabasePath();
    },
  },
};
