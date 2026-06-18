const { loginMethodsKeyboard } = require('../keyboards/inline');
const loginSession = require('../loginSession');
const { armLoginChoice } = require('../handlers/login');

const ALLOWED_COMMANDS = new Set(['/start', '/login', '/login_cancel']);

function isLoginFlowUpdate(ctx) {
  const text = ctx.message?.text?.trim() || '';
  const command = text.split('@')[0];
  if (ALLOWED_COMMANDS.has(command) || text === '🔐 Войти') return true;

  const data = ctx.callbackQuery?.data || '';
  if (data === 'start_auth' || data === 'login_cancel' || data.startsWith('login_method:')) {
    return true;
  }

  return loginSession.isActive(ctx.from?.id);
}

function loginRequiredMiddleware() {
  return async (ctx, next) => {
    if (isAccountAuthorized() || isLoginFlowUpdate(ctx)) {
      return next();
    }

    const userId = ctx.from?.id;
    if (userId) armLoginChoice(userId);

    await ctx.reply(
      '🔐 Сначала войдите в TikTok.\n\nВыберите способ входа:',
      loginMethodsKeyboard()
    );
  };
}

module.exports = { loginRequiredMiddleware };
