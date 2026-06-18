const { Telegraf } = require('telegraf');
const { env } = require('../config');
const { authMiddleware } = require('./middleware/auth');
const { loginRequiredMiddleware } = require('./middleware/loginRequired');
const { registerStart } = require('./handlers/start');
const { registerLogin } = require('./handlers/login');
const { registerChats } = require('./handlers/chats');
const { registerStreaks } = require('./handlers/streaks');
const { registerStatus } = require('./handlers/status');
const { registerSettings, registerLogs } = require('./handlers/settings');
const { registerBotCommands } = require('./setupCommands');
const logger = require('../logger');

let botInstance = null;
let notifyFn = null;

function createBot() {
  const token = env.telegramBotToken;
  if (!token) {
    throw new Error('telegram.botToken is not set in config.json');
  }

  const bot = new Telegraf(token);
  bot.use(authMiddleware());
  bot.use(loginRequiredMiddleware());

  registerStart(bot);
  registerLogin(bot);
  registerChats(bot);
  registerStreaks(bot);
  registerStatus(bot);
  registerSettings(bot);
  registerLogs(bot);

  bot.catch((err, ctx) => {
    logger.error(`Telegram error for ${ctx.updateType}`, err);
  });

  botInstance = bot;
  notifyFn = async (text) => {
    const { config } = require('../config');
    for (const userId of config.telegram.allowedUserIds || []) {
      try {
        await bot.telegram.sendMessage(userId, text);
      } catch (err) {
        logger.error(`Failed to notify user ${userId}`, err);
      }
    }
  };

  return bot;
}

function getBot() {
  return botInstance;
}

async function notify(text) {
  if (notifyFn) await notifyFn(text);
}

module.exports = { createBot, getBot, notify, registerBotCommands };
