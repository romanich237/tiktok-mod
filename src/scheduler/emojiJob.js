const { config } = require('../config');
const { isAccountAuthorized } = require('../bot/auth');
const loginAutomation = require('../automation/login');
const emojiSender = require('../automation/emojiSender');
const browserManager = require('../automation/browser');
const chatsRepo = require('../db/repositories/chats');
const sendLogsRepo = require('../db/repositories/sendLogs');
const schedulerRepo = require('../db/repositories/scheduler');
const { notify } = require('../bot');
const logger = require('../logger');

let schedulerTimer = null;
let dailyCron = null;
let jobRunning = false;

function randomHoursMs() {
  const min = config.scheduler?.minHours || 6;
  const max = config.scheduler?.maxHours || 12;
  const hours = Math.random() * (max - min) + min;
  return Math.floor(hours * 60 * 60 * 1000);
}

function scheduleNextRun() {
  if (schedulerTimer) clearTimeout(schedulerTimer);

  if (!config.scheduler?.enabled) {
    logger.info('Scheduler disabled');
    return;
  }

  const delay = randomHoursMs();
  const nextRunAt = new Date(Date.now() + delay);

  schedulerRepo.setNextRun(config.tiktok.accountId, nextRunAt).catch((err) => {
    logger.error('Failed to save next run', err);
  });

  logger.info(`Next emoji job scheduled at ${nextRunAt.toISOString()} (in ${Math.round(delay / 3600000)}h)`);

  schedulerTimer = setTimeout(() => {
    runEmojiJob().catch((err) => logger.error('Scheduled job failed', err));
  }, delay);
}

async function runEmojiJob({ force = false } = {}) {
  if (jobRunning) {
    logger.warn('Emoji job already running, skipping');
    return { skipped: true };
  }

  if (!isAccountAuthorized()) {
    logger.info('Emoji job skipped: TikTok not authorized');
    return { skipped: true, reason: 'not_authorized' };
  }

  if (!force && !config.scheduler?.enabled) {
    return { skipped: true, reason: 'scheduler disabled' };
  }

  jobRunning = true;
  const accountId = config.tiktok.accountId;
  const results = [];

  try {
    const enabledChats = await chatsRepo.getEnabledChats(accountId);
    if (!enabledChats.length) {
      const msg = '⚠️ Нет выбранных чатов для отправки эмодзи. Используйте /chats';
      logger.warn(msg);
      if (config.notifications?.onError) await notify(msg);
      return { skipped: true, reason: 'no chats' };
    }

    const page = await loginAutomation.ensureSession(accountId);
    const sendResults = await emojiSender.sendEmojisToChats(page, enabledChats);
    await page.close();
    await browserManager.closeBrowser();

    for (const result of sendResults) {
      if (result.status === 'success') {
        await sendLogsRepo.addLog(result.chatId, result.emoji, 'success');
      } else {
        await sendLogsRepo.addLog(result.chatId, result.emoji || '—', 'error', result.error);
      }
      results.push(result);
    }

    const success = sendResults.filter((r) => r.status === 'success');
    const failed = sendResults.filter((r) => r.status === 'error');

    if (config.notifications?.onSend && success.length) {
      const lines = success.map((r) => `• ${r.displayName || r.username} ${r.emoji}`).join('\n');
      await notify(`📤 Отправлено ${success.length} эмодзи:\n${lines}`);
    }

    if (config.notifications?.onError && failed.length) {
      const lines = failed.map((r) => `• ${r.displayName || r.username}: ${r.error}`).join('\n');
      await notify(`❌ Ошибки отправки (${failed.length}):\n${lines}`);
    }

    await schedulerRepo.setNextRun(accountId, null, new Date());
    scheduleNextRun();

    return { success: success.length, failed: failed.length, results };
  } catch (err) {
    logger.error('Emoji job failed', err);
    await browserManager.closeBrowser();

    if (err.message === 'SESSION_EXPIRED') {
      if (config.notifications?.onError) {
        await notify('❌ Сессия TikTok истекла. Выполните /login для повторного входа.');
      }
    } else if (config.notifications?.onError) {
      await notify(`❌ Ошибка планировщика: ${err.message}`);
    }

    scheduleNextRun();
    throw err;
  } finally {
    jobRunning = false;
  }
}

async function initScheduler() {
  if (!isAccountAuthorized()) {
    logger.info('Scheduler disabled until TikTok login');
    return;
  }

  const accountId = config.tiktok.accountId;
  const state = await schedulerRepo.getSchedulerState(accountId);

  if (state?.next_run_at && new Date(state.next_run_at) > new Date()) {
    const delay = new Date(state.next_run_at).getTime() - Date.now();
    logger.info(`Resuming scheduler, next run in ${Math.round(delay / 60000)} min`);
    schedulerTimer = setTimeout(() => {
      runEmojiJob().catch((err) => logger.error('Scheduled job failed', err));
    }, delay);
  } else {
    scheduleNextRun();
  }

  if (config.notifications?.dailyStreakReport) {
    const cron = require('node-cron');
    const hour = config.scheduler?.dailyStreakReportHour ?? 9;
    dailyCron = cron.schedule(`0 ${hour} * * *`, async () => {
      try {
        const { formatStreaksMessage } = require('../bot/handlers/streaks');
        const chats = await chatsRepo.getChatsByAccount(accountId);
        await notify(formatStreaksMessage(chats));
      } catch (err) {
        logger.error('Daily streak report failed', err);
      }
    });
    logger.info(`Daily streak report scheduled at ${hour}:00`);
  }
}

function stopScheduler() {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  if (dailyCron) dailyCron.stop();
}

function registerSendNow(bot) {
  bot.command('send_now', async (ctx) => {
    await ctx.reply('📤 Запускаю отправку эмодзи...');
    try {
      const result = await runEmojiJob({ force: true });
      if (result.skipped) {
        await ctx.reply(`⚠️ Пропущено: ${result.reason || 'уже выполняется'}`);
      } else {
        await ctx.reply(`✅ Готово: успешно ${result.success}, ошибок ${result.failed}`);
      }
    } catch (err) {
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  });

  bot.hears('📤 Отправить сейчас', async (ctx) => {
    await ctx.reply('📤 Запускаю отправку эмодзи...');
    try {
      const result = await runEmojiJob({ force: true });
      if (result.skipped) {
        await ctx.reply(`⚠️ Пропущено: ${result.reason || 'уже выполняется'}`);
      } else {
        await ctx.reply(`✅ Готово: успешно ${result.success}, ошибок ${result.failed}`);
      }
    } catch (err) {
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  });
}

module.exports = {
  runEmojiJob,
  initScheduler,
  stopScheduler,
  registerSendNow,
  scheduleNextRun,
};
