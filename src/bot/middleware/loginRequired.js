const loginSession = require('../loginSession');
const { promptLoginMethods } = require('../handlers/login');
const { isAccountAuthorized } = require('../auth');

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

    await promptLoginMethods(ctx);
  };
}

module.exports = { loginRequiredMiddleware };
