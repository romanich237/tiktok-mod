const { config } = require('../../config');
const accountsRepo = require('../../db/repositories/accounts');
const { getAccountLabel } = require('../../db/repositories/accounts');
const chatsRepo = require('../../db/repositories/chats');
const schedulerRepo = require('../../db/repositories/scheduler');
const { getUpdaterStatus } = require('../../updater/autoUpdate');

function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
}

function registerStatus(bot) {
  const showStatus = async (ctx) => {
    const accountId = config.tiktok.accountId;
    const account = await accountsRepo.getAccount(accountId);
    const accountLabel = getAccountLabel(account, accountId);
    const chats = await chatsRepo.getChatsByAccount(accountId);
    const enabled = chats.filter((c) => c.enabled).length;
    const sched = await schedulerRepo.getSchedulerState(accountId);
    const updater = getUpdaterStatus();

    const updaterLine = updater.enabled
      ? updater.lastError
        ? `❌ ${updater.lastError}`
        : updater.local && updater.remote
          ? updater.local === updater.remote
            ? `✅ актуально (${updater.local})`
            : `⏳ есть обновление ${updater.local}→${updater.remote}`
          : '✅ вкл'
      : '❌ выкл';

    const text =
      `📊 Статус TikTok Mod\n\n` +
      `Аккаунт: ${accountLabel}\n` +
      `Сессия: ${account?.is_logged_in ? '✅ активна' : '❌ не авторизован'}\n` +
      `Чатов в базе: ${chats.length}\n` +
      `Выбрано для отправки: ${enabled}\n` +
      `Планировщик: ${config.scheduler?.enabled ? '✅ вкл' : '❌ выкл'}\n` +
      `Интервал: ${config.scheduler?.minHours}–${config.scheduler?.maxHours} ч\n` +
      `След. отправка: ${formatDateTime(sched?.next_run_at)}\n` +
      `Последняя отправка: ${formatDateTime(sched?.last_run_at)}\n` +
      `GitHub: ${updaterLine}`;

    await ctx.reply(text);
  };

  bot.command('status', showStatus);
  bot.hears('📊 Статус', showStatus);
}

module.exports = { registerStatus, formatDateTime };
