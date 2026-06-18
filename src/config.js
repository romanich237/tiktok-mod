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
  return JSON.parse(raw);
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

function getMysqlConfig() {
  const mysql = config.mysql || {};
  return {
    host: mysql.host || 'localhost',
    port: Number(mysql.port || 3306),
    user: mysql.user || 'tiktok',
    password: mysql.password || 'tiktokpass',
    database: mysql.database || 'tiktok_mod',
  };
}

module.exports = {
  config,
  ROOT,
  CONFIG_PATH,
  getSessionDir,
  getStorageStatePath,
  getTelegramBotToken,
  getMysqlConfig,
  env: {
    get telegramBotToken() {
      return getTelegramBotToken();
    },
    get mysql() {
      return getMysqlConfig();
    },
  },
};
