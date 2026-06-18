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

async function dismissCookieBanner(page) {
  if (!isPageOpen(page)) return false;

  const bannerVisible = await page
    .locator('tiktok-cookie-banner')
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  if (!bannerVisible) return false;

  const acceptSelectors = [
    'button:has-text("Разрешить все")',
    'button:has-text("Принять все")',
    'button:has-text("Allow all")',
    'button:has-text("Accept all")',
    'button:has-text("Accept")',
    'button:has-text("Agree")',
    'button:has-text("OK")',
    '[data-e2e="cookie-banner-accept"]',
  ];

  for (const selector of acceptSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
      await btn.click({ timeout: 5000 }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 400));
      return true;
    }
  }

  const dismissed = await page
    .evaluate(() => {
      const banner = document.querySelector('tiktok-cookie-banner');
      if (!banner) return false;

      const tryClickAccept = (root) => {
        const buttons = Array.from(root.querySelectorAll('button'));
        const accept = buttons.find((button) => {
          const text = (button.innerText || button.textContent || '').toLowerCase();
          return /разреш|accept|allow|agree|соглас|принять|все|ok/.test(text);
        });
        if (accept) {
          accept.click();
          return true;
        }
        return false;
      };

      if (banner.shadowRoot && tryClickAccept(banner.shadowRoot)) return true;
      if (tryClickAccept(banner)) return true;
      if (tryClickAccept(document)) return true;

      banner.style.setProperty('display', 'none', 'important');
      banner.style.setProperty('pointer-events', 'none', 'important');
      banner.remove();
      return true;
    })
    .catch(() => false);

  if (dismissed) {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return dismissed;
}

async function preparePage(page) {
  await dismissCookieBanner(page);
}

async function safeClick(page, locator, options = {}) {
  const timeout = options.timeout ?? 15000;
  await dismissCookieBanner(page);

  try {
    await locator.click({ timeout });
    return;
  } catch (err) {
    const msg = err?.message || '';
    if (!msg.includes('intercepts pointer events') && !msg.includes('cookie-banner')) {
      throw err;
    }
  }

  await dismissCookieBanner(page);
  await locator.click({ timeout, force: true });
}

function formatBrowserError(err) {
  const raw = err?.message || String(err);
  const msg = raw.split('Call log:')[0].trim();

  if (err?.code === 'LOGIN_CANCELLED') return 'Вход отменён';
  if (
    msg.includes('Target page') ||
    msg.includes('has been closed') ||
    msg.includes('Browser has been closed') ||
    msg.includes('Context closed')
  ) {
    return 'Вход отменён';
  }
  if (msg.includes('cookie-banner') || msg.includes('intercepts pointer events')) {
    return 'TikTok показал окно cookies — не удалось продолжить вход. Попробуйте снова.';
  }
  if (/Timeout \d+ms exceeded/.test(msg)) {
    if (msg.includes('click')) {
      return 'Не удалось нажать элемент на странице TikTok. Попробуйте снова.';
    }
    if (msg.includes('waitForSelector') || msg.includes('locator')) {
      return 'Страница TikTok загрузилась слишком долго. Попробуйте снова.';
    }
    return 'Превышено время ожидания TikTok. Попробуйте снова.';
  }
  if (msg.length > 200) {
    return `${msg.slice(0, 200)}…`;
  }
  return msg;
}

module.exports = {
  isPageOpen,
  safeWait,
  dismissCookieBanner,
  preparePage,
  safeClick,
  formatBrowserError,
};
