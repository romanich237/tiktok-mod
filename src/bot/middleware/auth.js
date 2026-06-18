const { config } = require('../../config');

function authMiddleware() {
  const allowed = new Set(config.telegram?.allowedUserIds || []);

  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !allowed.has(userId)) {
      await ctx.reply('⛔ Доступ запрещён. Добавьте свой Telegram ID в config.json → telegram.allowedUserIds');
      return;
    }
    return next();
  };
}

module.exports = { authMiddleware };
