const { createBot, registerBotCommands } = require('./bot');
const { initScheduler, stopScheduler, registerSendNow } = require('./scheduler/emojiJob');
const { initAutoUpdater, stopAutoUpdater } = require('./updater/autoUpdate');
const { getTelegramBotToken } = require('./config');
const browserManager = require('./automation/browser');
const { version } = require('../package.json');
const logger = require('./logger');

async function main() {
  getTelegramBotToken();

  const bot = createBot();
  registerSendNow(bot);

  logger.info(`TikTok Mod v${version} starting...`);
  logger.info('Registering Telegram bot commands...');
  await registerBotCommands(bot);

  logger.info('Starting Telegram bot...');
  await bot.launch({ dropPendingUpdates: true });

  logger.info('Initializing scheduler...');
  await initScheduler();

  initAutoUpdater();

  logger.info('TikTok Mod is running');

  const shutdown = async (signal) => {
    logger.info(`Shutting down (${signal})...`);
    stopAutoUpdater();
    stopScheduler();
    await browserManager.closeBrowser({ saveSession: true }).catch((err) => {
      logger.warn('Failed to save session on shutdown', err);
    });
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal error', err);
  process.exit(1);
});
