const { mainMenuKeyboard } = require('../keyboards/inline');
const { isAccountAuthorized } = require('../auth');
const { promptLoginMethods, armLoginChoice } = require('./login');

function registerStart(bot) {
  bot.command('start', async (ctx) => {
    if (!isAccountAuthorized()) {
      const userId = ctx.from?.id;
      if (userId) armLoginChoice(userId);
      await ctx.reply(
        '👋 TikTok Mod\n\nДля начала работы войдите в TikTok.\nПока вход не выполнен — остальные функции недоступны.\n\nВыберите способ входа:',
        require('../keyboards/inline').loginMethodsKeyboard()
      );
      return;
    }

    await ctx.reply('👋 TikTok Mod\n\nВыберите действие:', mainMenuKeyboard());
  });
}

module.exports = { registerStart };
