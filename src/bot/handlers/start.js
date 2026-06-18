const { Markup } = require('telegraf');
const { mainMenuKeyboard } = require('../keyboards/inline');
const { isAccountAuthorized, authKeyboard } = require('../auth');

function registerStart(bot) {
  bot.command('start', async (ctx) => {
    if (!isAccountAuthorized()) {
      await ctx.reply(
        '👋 TikTok Mod\n\nДля начала работы войдите в TikTok.\nПока вход не выполнен — остальные функции недоступны.',
        authKeyboard()
      );
      return;
    }

    await ctx.reply('👋 TikTok Mod\n\nВыберите действие:', mainMenuKeyboard());
  });
}

module.exports = { registerStart };
