const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { config, getSessionDir, getStorageStatePath } = require('../config');
const logger = require('../logger');

let browserInstance = null;
let contextInstance = null;

function storageExists(accountId) {
  const statePath = getStorageStatePath(accountId);
  return fs.existsSync(statePath);
}

async function launchBrowser({ headless } = {}) {
  const useHeadless = headless ?? config.automation?.headless ?? true;

  if (browserInstance) {
    await closeBrowser();
  }

  browserInstance = await chromium.launch({
    headless: useHeadless,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  return browserInstance;
}

async function createContext(accountId, options = {}) {
  const browser = options.browser || browserInstance || (await launchBrowser(options));
  const statePath = getStorageStatePath(accountId);
  const contextOptions = {
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
  };

  if (storageExists(accountId)) {
    contextOptions.storageState = statePath;
  }

  contextInstance = await browser.newContext(contextOptions);
  return contextInstance;
}

async function saveStorageState(accountId) {
  if (!contextInstance) return;
  const statePath = getStorageStatePath(accountId);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await contextInstance.storageState({ path: statePath });
  logger.info(`Session saved to ${statePath}`);
}

async function newPage(accountId, options = {}) {
  const context = options.context || contextInstance || (await createContext(accountId, options));
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  return page;
}

async function closeBrowser() {
  if (contextInstance) {
    await contextInstance.close().catch(() => {});
    contextInstance = null;
  }
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
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
  newPage,
  closeBrowser,
  randomDelay,
  get browser() {
    return browserInstance;
  },
  get context() {
    return contextInstance;
  },
};
