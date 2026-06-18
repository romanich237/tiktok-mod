const { Markup } = require('telegraf');
const { mainMenuKeyboard } = require('../keyboards/inline');
const { isAccountAuthorized } = require('../auth');

function authKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('🔐 Авторизация', 'start_auth')]]);
}

function registerStart(bot) {
  bot.command('start', async (ctx) => {
    if (!isAccountAuthorized()) {
      await ctx.reply(
        '👋 TikTok Mod\n\nДля начала работы войдите в TikTok.',
        authKeyboard()
      );
      return;
    }

    await ctx.reply('👋 TikTok Mod\n\nВыберите действие:', mainMenuKeyboard());
  });
}

module.exports = { registerStart, authKeyboard };
