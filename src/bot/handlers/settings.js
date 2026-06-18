const fs = require('fs');
const { config, CONFIG_PATH } = require('../../config');
const sendLogsRepo = require('../../db/repositories/sendLogs');
const { settingsKeyboard } = require('../keyboards/inline');

function saveConfig(newConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf8');
  Object.assign(config, newConfig);
}

function registerSettings(bot) {
  const showSettings = async (ctx) => {
    await ctx.reply(
      `⚙️ Настройки\n\n` +
        `Планировщик: ${config.scheduler?.enabled ? 'вкл' : 'выкл'}\n` +
        `Интервал: ${config.scheduler?.minHours}–${config.scheduler?.maxHours} ч\n` +
        `Эмодзи: ${(config.emoji?.pool || []).join(' ')}`,
      settingsKeyboard(config)
    );
  };

  bot.command('settings', showSettings);
  bot.hears('⚙️ Настройки', showSettings);

  bot.action('settings_toggle_scheduler', async (ctx) => {
    config.scheduler.enabled = !config.scheduler.enabled;
    saveConfig(config);
    await ctx.editMessageReplyMarkup(settingsKeyboard(config).reply_markup);
    await ctx.answerCbQuery(`Планировщик: ${config.scheduler.enabled ? 'вкл' : 'выкл'}`);
  });

  bot.action('settings_toggle_on_send', async (ctx) => {
    config.notifications.onSend = !config.notifications.onSend;
    saveConfig(config);
    await ctx.editMessageReplyMarkup(settingsKeyboard(config).reply_markup);
    await ctx.answerCbQuery('Обновлено');
  });

  bot.action('settings_toggle_on_error', async (ctx) => {
    config.notifications.onError = !config.notifications.onError;
    saveConfig(config);
    await ctx.editMessageReplyMarkup(settingsKeyboard(config).reply_markup);
    await ctx.answerCbQuery('Обновлено');
  });

  bot.action('settings_toggle_daily', async (ctx) => {
    config.notifications.dailyStreakReport = !config.notifications.dailyStreakReport;
    saveConfig(config);
    await ctx.editMessageReplyMarkup(settingsKeyboard(config).reply_markup);
    await ctx.answerCbQuery('Обновлено');
  });
}

function registerLogs(bot) {
  const showLogs = async (ctx) => {
    const logs = await sendLogsRepo.getRecentLogs(config.tiktok.accountId, 10);

    if (!logs.length) {
      await ctx.reply('📋 Логи пусты — отправок ещё не было.');
      return;
    }

    const lines = logs.map((log) => {
      const time = new Date(log.sent_at).toLocaleString('ru-RU');
      const name = log.display_name || log.tiktok_username;
      if (log.status === 'success') {
        return `✅ ${time} — ${name}: ${log.emoji}`;
      }
      return `❌ ${time} — ${name}: ${log.error}`;
    });

    await ctx.reply(`📋 Последние отправки:\n\n${lines.join('\n')}`);
  };

  bot.command('logs', showLogs);
  bot.hears('📋 Логи', showLogs);
}

module.exports = { registerSettings, registerLogs, saveConfig };
