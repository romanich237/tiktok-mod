const { config } = require('../../config');
const chatsRepo = require('../../db/repositories/chats');
const { refreshChats } = require('./chats');
const { streaksKeyboard } = require('../keyboards/inline');

function formatStreaksMessage(chats) {
  if (!chats.length) {
    return '🔥 Огоньки\n\nСписок пуст. Сначала обновите чаты через /chats';
  }

  const lines = chats.map((chat) => {
    const streak =
      chat.streak_days != null ? `🔥 ${chat.streak_days} дн.` : '— нет данных';
    const enabled = chat.enabled ? '✅' : '❌';
    return `${enabled} ${chat.display_name || chat.tiktok_username}: ${streak}`;
  });

  return `🔥 Огоньки по чатам:\n\n${lines.join('\n')}`;
}

function registerStreaks(bot) {
  bot.command('streaks', async (ctx) => {
    const chats = await chatsRepo.getChatsByAccount(config.tiktok.accountId);
    await ctx.reply(formatStreaksMessage(chats), streaksKeyboard());
  });

  bot.hears('🔥 Огоньки', async (ctx) => {
    const chats = await chatsRepo.getChatsByAccount(config.tiktok.accountId);
    await ctx.reply(formatStreaksMessage(chats), streaksKeyboard());
  });

  bot.action('streaks_refresh', async (ctx) => {
    await ctx.answerCbQuery('Обновляю огоньки...');
    await refreshChats(ctx);
    const chats = await chatsRepo.getChatsByAccount(config.tiktok.accountId);
    await ctx.reply(formatStreaksMessage(chats), streaksKeyboard());
  });
}

module.exports = { registerStreaks, formatStreaksMessage };
