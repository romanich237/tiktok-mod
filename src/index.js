const { createBot, registerBotCommands } = require('./bot');
const { initScheduler, stopScheduler, registerSendNow } = require('./scheduler/emojiJob');
const { initAutoUpdater, stopAutoUpdater } = require('./updater/autoUpdate');
const { getTelegramBotToken } = require('./config');
const logger = require('./logger');

async function main() {
  getTelegramBotToken();

  const bot = createBot();
  registerSendNow(bot);

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
