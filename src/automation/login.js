const { config } = require('../config');
const accountsRepo = require('../db/repositories/accounts');
const browserManager = require('./browser');
const selectors = require('./selectors');
const { safeWait, isPageOpen, formatBrowserError, dismissCookieBanner, safeClick } = require('./pageUtils');
const logger = require('../logger');

const activePages = new Map();
const cancelledLogins = new Set();

async function pause(page, ms, userId) {
  await safeWait(page, ms, { userId, cancelledLogins });
}

async function isLoggedIn(page) {
  if (!isPageOpen(page)) return false;

  try {
    for (const selector of selectors.loggedInIndicators) {
      try {
        const visible = await page.locator(selector).first().isVisible({ timeout: 1500 });
        if (visible) return true;
      } catch {
        // continue
      }
    }

    for (const selector of selectors.loginPageIndicators) {
      try {
        const visible = await page.locator(selector).first().isVisible({ timeout: 1000 });
        if (visible) return false;
      } catch {
        // continue
      }
    }

    const qrVisible = await page
      .locator('[data-e2e="qr-code"]')
      .first()
      .isVisible({ timeout: 800 })
      .catch(() => false);
    if (qrVisible) return false;

    const url = page.url();
    if (url.includes('/messages') || url.includes('/@')) return true;

    return !url.includes('/login');
  } catch {
    return false;
  }
}

async function probeMessagesSession(page, userId) {
  const returnUrl = page.url();
  try {
    await page.goto(config.tiktok.messagesUrl, { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await pause(page, 2500, userId);
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn && returnUrl.includes('/login')) {
      await page.goto(returnUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await pause(page, 1000, userId);
    }
    return loggedIn;
  } catch {
    return false;
  }
}

async function gotoLoginPage(page, url) {
  logger.info(`Opening login page: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await pause(page, 800);
}

async function openQrLoginForm(page) {
  await gotoLoginPage(page, selectors.login.qrLoginUrl);
  await page.waitForSelector('[data-e2e="qr-code"]', { timeout: 20000 });
  await waitForQrCanvasReady(page);
  logger.info('QR-код загружен');
  return page;
}

async function waitForQrCanvasReady(page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('[data-e2e="qr-code"] canvas');
      if (!canvas || canvas.width < 50 || canvas.height < 50) return false;

      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let darkPixels = 0;
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r < 180 && g < 180 && b < 180) darkPixels += 1;
      }
      return darkPixels > 30;
    },
    null,
    { timeout: 30000 }
  );
}

async function screenshotQrCode(page) {
  if (!isPageOpen(page)) {
    const err = new Error('LOGIN_CANCELLED');
    err.code = 'LOGIN_CANCELLED';
    throw err;
  }

  await page.locator('[data-e2e="qr-code"]').first().waitFor({ state: 'visible', timeout: 10000 });
  await waitForQrCanvasReady(page);

  const dataUrl = await page.evaluate(() => {
    const container = document.querySelector('[data-e2e="qr-code"]');
    const canvas = container?.querySelector('canvas');
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  });

  if (dataUrl?.startsWith('data:image/png;base64,')) {
    return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  }

  const canvas = page.locator('[data-e2e="qr-code"] canvas').first();
  if ((await canvas.count()) > 0) {
    return canvas.screenshot({ type: 'png' });
  }

  const img = page.locator('[data-e2e="qr-code"] img').first();
  if ((await img.count()) > 0) {
    return img.screenshot({ type: 'png' });
  }

  throw new Error('QR-код не найден на странице');
}

async function openEmailLoginForm(page) {
  await gotoLoginPage(page, selectors.login.emailLoginUrl);

  const usernameInput = await selectors.findFirst(page, selectors.login.usernameInput, {
    visible: true,
    timeout: 15000,
  });

  if (!usernameInput) {
    throw new Error('Форма входа (email/username) не найдена');
  }

  logger.info('Форма email/username открыта');
  return page;
}

async function openPhoneLoginForm(page) {
  await gotoLoginPage(page, selectors.login.phoneLoginUrl);

  const phoneInput = await selectors.findFirst(page, selectors.login.phoneInput, {
    visible: true,
    timeout: 15000,
  });

  if (!phoneInput) {
    throw new Error('Форма входа по телефону не найдена');
  }

  logger.info('Форма входа по телефону открыта');
  return page;
}

async function submitCredentials(page, username, password) {
  const usernameInput = await selectors.findFirst(page, selectors.login.usernameInput, {
    visible: true,
    timeout: 10000,
  });
  const passwordInput = await selectors.findFirst(page, selectors.login.passwordInput, {
    visible: true,
    timeout: 10000,
  });

  if (!usernameInput || !passwordInput) {
    throw new Error('Поля логина или пароля не найдены');
  }

  await usernameInput.fill(username);
  await pause(page,500);
  await passwordInput.fill(password);
  await pause(page,500);

  const submitBtn = await selectors.findFirst(page, selectors.login.submitButton, {
    visible: true,
    timeout: 5000,
  });

  if (submitBtn) {
    await safeClick(page, submitBtn);
  } else {
    await page.keyboard.press('Enter');
  }

  logger.info('Email/username отправлен');
  await pause(page, 3000);
}

async function submitPhoneNumber(page, phone) {
  const phoneInput = await selectors.findFirst(page, selectors.login.phoneInput, {
    visible: true,
    timeout: 10000,
  });

  if (!phoneInput) {
    throw new Error('Поле номера телефона не найдено');
  }

  const normalized = phone.replace(/\s+/g, '').replace(/^\+/, '');
  await phoneInput.fill(normalized);
  await pause(page,800);

  const sendBtn = await selectors.findFirst(page, selectors.login.sendCodeButton, {
    visible: true,
    timeout: 5000,
  });

  if (!sendBtn) {
    throw new Error('Кнопка «Send code» не найдена');
  }

  await safeClick(page, sendBtn);
  logger.info(`SMS-код запрошен для ${normalized}`);
  await pause(page, 2000);
}

async function submitPhoneCode(page, code) {
  const codeInput = await selectors.findFirst(page, selectors.login.smsCodeInput, {
    visible: true,
    timeout: 10000,
  });

  if (!codeInput) {
    throw new Error('Поле SMS-кода не найдено');
  }

  await codeInput.fill(code.replace(/\s+/g, ''));
  await pause(page,500);

  const submitBtn = await selectors.findFirst(page, selectors.login.submitButton, {
    visible: true,
    timeout: 5000,
  });

  if (submitBtn) {
    await safeClick(page, submitBtn);
  } else {
    await page.keyboard.press('Enter');
  }

  logger.info('SMS-код отправлен');
  await pause(page, 3000);
}

async function waitForLoginComplete(page, accountId, userId) {
  const timeout = config.automation?.loginTimeoutMs || 300000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (cancelledLogins.has(userId) || !isPageOpen(page)) {
      const err = new Error('LOGIN_CANCELLED');
      err.code = 'LOGIN_CANCELLED';
      throw err;
    }

    if (await isLoggedIn(page)) {
      await browserManager.saveStorageState(accountId);
      await accountsRepo.setLoggedIn(accountId, true);
      return true;
    }
    await pause(page, 3000, userId);
  }

  throw new Error('Время входа истекло (капча, неверный код или 2FA)');
}

async function prepareBrowser(accountId) {
  const accountIdResolved = accountId || config.tiktok.accountId;
  const useHeadless = config.automation?.loginHeadless ?? false;

  await accountsRepo.ensureAccount(accountIdResolved);
  await browserManager.launchBrowser({ headless: useHeadless });
  await browserManager.createContext(accountIdResolved);
  const page = await browserManager.newPage(accountIdResolved);

  return { page, accountId: accountIdResolved };
}

async function finalizeLogin(page, accountId, userId) {
  await waitForLoginComplete(page, accountId, userId);
  await page.close();
  activePages.delete(userId);
  await browserManager.closeBrowser();
  return { success: true, accountId };
}

async function cancelLogin(userId) {
  cancelledLogins.add(userId);

  const page = activePages.get(userId);
  if (page && isPageOpen(page)) {
    await page.close().catch(() => {});
  }
  activePages.delete(userId);
  await browserManager.closeBrowser();
  cancelledLogins.delete(userId);
}

async function cancelAllLogins() {
  const userIds = [...activePages.keys()];
  for (const userId of userIds) {
    cancelledLogins.add(userId);
  }
  for (const userId of userIds) {
    const page = activePages.get(userId);
    if (page && isPageOpen(page)) {
      await page.close().catch(() => {});
    }
    activePages.delete(userId);
    cancelledLogins.delete(userId);
  }
  await browserManager.closeBrowser().catch(() => {});
}

async function startEmailLogin(userId) {
  const { page, accountId } = await prepareBrowser();
  activePages.set(userId, page);
  await openEmailLoginForm(page);
  return { page, accountId };
}

async function startPhoneLogin(userId) {
  const { page, accountId } = await prepareBrowser();
  activePages.set(userId, page);
  await openPhoneLoginForm(page);
  return { page, accountId };
}

async function loginEmailComplete(userId, username, password) {
  const page = activePages.get(userId);
  if (!page) throw new Error('Сессия входа не найдена. Начните заново: /login');

  const accountId = config.tiktok.accountId;
  await submitCredentials(page, username, password);
  return finalizeLogin(page, accountId, userId);
}

async function loginPhoneSendCode(userId, phone) {
  const page = activePages.get(userId);
  if (!page) throw new Error('Сессия входа не найдена. Начните заново: /login');

  await submitPhoneNumber(page, phone);
  return { waitingCode: true };
}

async function startQrLogin(userId) {
  const { page, accountId } = await prepareBrowser();
  activePages.set(userId, page);
  await openQrLoginForm(page);
  return { page, accountId };
}

async function completeQrLogin(userId, onQrImage) {
  const page = activePages.get(userId);
  if (!page) throw new Error('Сессия входа не найдена. Начните заново: /login');

  const accountId = config.tiktok.accountId;
  const timeout = config.automation?.loginTimeoutMs || 300000;
  const refreshMs = config.automation?.qrRefreshMs || 30000;
  const start = Date.now();
  let lastSent = 0;
  let photoCount = 0;
  let lastProbe = 0;

  while (Date.now() - start < timeout) {
    if (cancelledLogins.has(userId) || !isPageOpen(page)) {
      const err = new Error('LOGIN_CANCELLED');
      err.code = 'LOGIN_CANCELLED';
      throw err;
    }

    if (await isLoggedIn(page)) {
      await browserManager.saveStorageState(accountId);
      await accountsRepo.setLoggedIn(accountId, true);
      await page.close();
      activePages.delete(userId);
      await browserManager.closeBrowser();
      return { success: true, accountId, photoCount };
    }

    if (photoCount > 0 && Date.now() - lastProbe >= 6000) {
      lastProbe = Date.now();
      if (await probeMessagesSession(page, userId)) {
        await browserManager.saveStorageState(accountId);
        await accountsRepo.setLoggedIn(accountId, true);
        await page.close();
        activePages.delete(userId);
        await browserManager.closeBrowser();
        return { success: true, accountId, photoCount };
      }
    }

    if (photoCount === 0 || Date.now() - lastSent >= refreshMs) {
      try {
        const buffer = await screenshotQrCode(page);
        photoCount += 1;
        if (onQrImage) await onQrImage(buffer, photoCount);
        lastSent = Date.now();
      } catch (err) {
        if (cancelledLogins.has(userId) || !isPageOpen(page)) {
          const cancelErr = new Error('LOGIN_CANCELLED');
          cancelErr.code = 'LOGIN_CANCELLED';
          throw cancelErr;
        }
        throw err;
      }
    }

    await pause(page, 2000, userId);
  }

  throw new Error('Время входа по QR истекло — отсканируйте код быстрее или начните заново: /login');
}

async function loginPhoneComplete(userId, code) {
  const page = activePages.get(userId);
  if (!page) throw new Error('Сессия входа не найдена. Начните заново: /login');

  const accountId = config.tiktok.accountId;
  await submitPhoneCode(page, code);
  return finalizeLogin(page, accountId, userId);
}

async function ensureSession(accountId) {
  const accountIdResolved = accountId || config.tiktok.accountId;
  const account = await accountsRepo.getAccount(accountIdResolved);

  if (!account?.is_logged_in && !browserManager.storageExists(accountIdResolved)) {
    throw new Error('SESSION_EXPIRED');
  }

  await browserManager.launchBrowser({ headless: config.automation?.headless ?? true });
  await browserManager.createContext(accountIdResolved);
  const page = await browserManager.newPage(accountIdResolved);

  await page.goto(config.tiktok.messagesUrl, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await pause(page, 3000);

  if (!(await isLoggedIn(page))) {
    await accountsRepo.setLoggedIn(accountIdResolved, false);
    throw new Error('SESSION_EXPIRED');
  }

  return page;
}

module.exports = {
  isLoggedIn,
  openEmailLoginForm,
  openPhoneLoginForm,
  submitCredentials,
  submitPhoneNumber,
  submitPhoneCode,
  openQrLoginForm,
  screenshotQrCode,
  startQrLogin,
  completeQrLogin,
  startEmailLogin,
  startPhoneLogin,
  loginEmailComplete,
  loginPhoneSendCode,
  loginPhoneComplete,
  cancelLogin,
  cancelAllLogins,
  ensureSession,
  formatBrowserError,
};
