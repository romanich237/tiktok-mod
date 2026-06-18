const { config } = require('../config');
const logger = require('../logger');

const DEFAULT_COMMANDS = [
  { command: 'start', description: 'Главное меню' },
  { command: 'login', description: 'Вход в TikTok через бота' },
  { command: 'login_cancel', description: 'Отменить вход' },
  { command: 'chats', description: 'Список чатов и выбор получателей' },
  { command: 'streaks', description: 'Огоньки по чатам' },
  { command: 'status', description: 'Статус сессии и планировщика' },
  { command: 'send_now', description: 'Отправить эмодзи сейчас' },
  { command: 'logs', description: 'Последние отправки' },
  { command: 'settings', description: 'Настройки' },
];

function getCommands() {
  const commands = config.commands?.length ? config.commands : DEFAULT_COMMANDS;
  return commands.map(({ command, description }) => ({
    command: command.replace(/^\//, ''),
    description,
  }));
}

function formatCommandsHelp() {
  return getCommands()
    .map(({ command, description }) => `/${command} — ${description}`)
    .join('\n');
}

async function registerBotCommands(bot) {
  const commands = getCommands();
  await bot.telegram.setMyCommands(commands);
  logger.info(`Registered ${commands.length} Telegram bot commands`);
  return commands;
}

module.exports = {
  getCommands,
  formatCommandsHelp,
  registerBotCommands,
  DEFAULT_COMMANDS,
};
