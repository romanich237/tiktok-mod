const { Markup } = require('telegraf');

function mainMenuKeyboard() {
  return Markup.keyboard([
    ['🔐 Войти', '💬 Чаты'],
    ['🔥 Огоньки', '📊 Статус'],
    ['📤 Отправить сейчас', '📋 Логи'],
    ['⚙️ Настройки'],
  ]).resize();
}

function chatsKeyboard(chats) {
  const rows = chats.map((chat) => {
    const icon = chat.enabled ? '✅' : '❌';
    const streak = chat.streak_days != null ? ` 🔥${chat.streak_days}` : '';
    const label = `${icon} ${chat.display_name || chat.tiktok_username}${streak}`;
    return [Markup.button.callback(label, `toggle_chat:${chat.id}`)];
  });

  rows.push([
    Markup.button.callback('✅ Выбрать все', 'chats_select_all'),
    Markup.button.callback('❌ Снять все', 'chats_deselect_all'),
  ]);
  rows.push([Markup.button.callback('🔄 Обновить список', 'chats_refresh')]);

  return Markup.inlineKeyboard(rows);
}

function settingsKeyboard(config) {
  const sched = config.scheduler?.enabled ? '✅ Вкл' : '❌ Выкл';
  const onSend = config.notifications?.onSend ? '✅' : '❌';
  const onError = config.notifications?.onError ? '✅' : '❌';
  const daily = config.notifications?.dailyStreakReport ? '✅' : '❌';

  return Markup.inlineKeyboard([
    [Markup.button.callback(`Планировщик: ${sched}`, 'settings_toggle_scheduler')],
    [
      Markup.button.callback(`Уведомления отправки: ${onSend}`, 'settings_toggle_on_send'),
      Markup.button.callback(`Уведомления ошибок: ${onError}`, 'settings_toggle_on_error'),
    ],
    [Markup.button.callback(`Ежедневный отчёт огоньков: ${daily}`, 'settings_toggle_daily')],
  ]);
}

function streaksKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Обновить огоньки', 'streaks_refresh')],
  ]);
}

module.exports = {
  mainMenuKeyboard,
  chatsKeyboard,
  settingsKeyboard,
  streaksKeyboard,
};
