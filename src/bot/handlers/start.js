const { mainMenuKeyboard } = require('../keyboards/inline');
const { isAccountAuthorized } = require('../auth');
const { promptLoginMethods } = require('./login');

function registerStart(bot) {
  bot.command('start', async (ctx) => {
    if (!isAccountAuthorized()) {
      await ctx.reply(
        '👋 TikTok Mod\n\nДля начала работы войдите в TikTok.\nПока вход не выполнен — остальные функции недоступны.'
      );
      await promptLoginMethods(ctx);
      return;
    }

    await ctx.reply('👋 TikTok Mod\n\nВыберите действие:', mainMenuKeyboard());
  });
}

module.exports = { registerStart };
