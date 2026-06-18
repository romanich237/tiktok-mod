const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { config, getSessionDir, getStorageStatePath } = require('../config');
const logger = require('../logger');

let browserInstance = null;
let contextInstance = null;
let activeAccountId = null;
let autosaveTimer = null;

function storageExists(accountId) {
  const statePath = getStorageStatePath(accountId);
  return fs.existsSync(statePath);
}

function resolveAccountId(accountId) {
  return accountId || activeAccountId || config.tiktok?.accountId || 'default';
}

async function saveStorageState(accountId) {
  const accountIdResolved = resolveAccountId(accountId);
  if (!contextInstance) return false;

  const statePath = getStorageStatePath(accountIdResolved);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await contextInstance.storageState({ path: statePath });
  logger.info(`Session saved to ${statePath}`);
  return true;
}

async function persistSession(accountId) {
  try {
    return await saveStorageState(accountId);
  } catch (err) {
    logger.warn('Failed to persist session', err);
    return false;
  }
}

function startSessionAutosave(accountId, intervalMs = 120000) {
  stopSessionAutosave();
  const accountIdResolved = resolveAccountId(accountId);

  autosaveTimer = setInterval(() => {
    if (!contextInstance) return;
    persistSession(accountIdResolved).catch((err) => {
      logger.warn('Session autosave failed', err);
    });
  }, intervalMs);

  if (typeof autosaveTimer.unref === 'function') {
    autosaveTimer.unref();
  }
}

function stopSessionAutosave() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

async function launchBrowser({ headless, accountId } = {}) {
  const useHeadless = headless ?? config.automation?.headless ?? true;

  if (browserInstance) {
    await closeBrowser({ saveSession: true, accountId });
  }

  browserInstance = await chromium.launch({
    headless: useHeadless,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  return browserInstance;
}

async function createContext(accountId, options = {}) {
  const accountIdResolved = resolveAccountId(accountId);
  activeAccountId = accountIdResolved;

  const browser = options.browser || browserInstance || (await launchBrowser({ ...options, accountId: accountIdResolved }));
  const statePath = getStorageStatePath(accountIdResolved);
  const contextOptions = {
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
  };

  if (storageExists(accountIdResolved)) {
    contextOptions.storageState = statePath;
  }

  contextInstance = await browser.newContext(contextOptions);
  startSessionAutosave(accountIdResolved);
  return contextInstance;
}

async function newPage(accountId, options = {}) {
  const context = options.context || contextInstance || (await createContext(accountId, options));
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  return page;
}

async function closeBrowser(options = {}) {
  const accountId = resolveAccountId(options.accountId);
  const saveSession = options.saveSession === true;

  stopSessionAutosave();

  if (saveSession && contextInstance) {
    await persistSession(accountId);
  }

  if (contextInstance) {
    await contextInstance.close().catch(() => {});
    contextInstance = null;
  }
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }

  activeAccountId = null;
}

function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  storageExists,
  launchBrowser,
  createContext,
  saveStorageState,
  persistSession,
  newPage,
  closeBrowser,
  randomDelay,
  get browser() {
    return browserInstance;
  },
  get context() {
    return contextInstance;
  },
  get activeAccountId() {
    return activeAccountId;
  },
};
