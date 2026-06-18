function isPageOpen(page) {
  return page && typeof page.isClosed === 'function' && !page.isClosed();
}

function isLoginCancelled(userId, cancelledLogins) {
  return Boolean(userId && cancelledLogins?.has(userId));
}

async function safeWait(page, ms, { userId, cancelledLogins } = {}) {
  const step = 400;
  let elapsed = 0;

  while (elapsed < ms) {
    if (isLoginCancelled(userId, cancelledLogins)) {
      const err = new Error('LOGIN_CANCELLED');
      err.code = 'LOGIN_CANCELLED';
      throw err;
    }
    if (page && !isPageOpen(page)) {
      const err = new Error('LOGIN_CANCELLED');
      err.code = 'LOGIN_CANCELLED';
      throw err;
    }

    const chunk = Math.min(step, ms - elapsed);
    await new Promise((resolve) => setTimeout(resolve, chunk));
    elapsed += chunk;
  }
}

function formatBrowserError(err) {
  const msg = err?.message || String(err);
  if (err?.code === 'LOGIN_CANCELLED') return 'Вход отменён';
  if (
    msg.includes('Target page') ||
    msg.includes('has been closed') ||
    msg.includes('Browser has been closed') ||
    msg.includes('Context closed')
  ) {
    return 'Вход отменён';
  }
  return msg;
}

module.exports = {
  isPageOpen,
  safeWait,
  formatBrowserError,
};
