const { mainMenuKeyboard } = require('../keyboards/inline');
const { formatCommandsHelp } = require('../setupCommands');

function registerStart(bot) {
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `👋 TikTok Mod Bot\n\nКоманды:\n${formatCommandsHelp()}`,
      mainMenuKeyboard()
    );
  });
}

module.exports = { registerStart };
