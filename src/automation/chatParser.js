const logger = require('../logger');
const selectors = require('./selectors');
const { safeWait, dismissCookieBanner } = require('./pageUtils');

function extractStreakDays(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:day|дн|d\b)/i) || text.match(/🔥\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (/🔥|streak|огон/i.test(text)) return 0;
  return null;
}

function slugFromDisplayName(displayName) {
  return displayName
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0400-\u04FF._-]/g, '');
}

async function scrollChatList(page) {
  const listLocator = page.locator('[data-e2e="dm-new-conversation-list"]').first();
  if ((await listLocator.count()) === 0) return;

  for (let i = 0; i < 6; i++) {
    await listLocator.evaluate((el) => {
      el.scrollTop += 500;
    }).catch(() => {});
    await safeWait(page, 350);
  }

  await listLocator.evaluate((el) => {
    el.scrollTop = 0;
  }).catch(() => {});
  await safeWait(page, 500);
}

async function waitForChatList(page) {
  const waitTargets = [
    '[data-e2e="dm-new-conversation-list"]',
    '[data-e2e="dm-new-conversation-item"]',
    '[data-e2e="dm-new-conversation-nickname"]',
    ...selectors.messages.chatList,
    ...selectors.messages.chatItem,
  ];

  for (const selector of waitTargets) {
    try {
      await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20000 });
      return;
    } catch {
      // try next selector
    }
  }

  logger.warn('Chat list selectors not visible, parsing with fallback');
}

async function parseChatList(page) {
  await scrollChatList(page);

  const items = page.locator('[data-e2e="dm-new-conversation-item"]');
  const count = await items.count();
  const parsed = [];
  const seen = new Set();

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const displayName =
      (
        await item
          .locator('[data-e2e="dm-new-conversation-nickname"]')
          .first()
          .innerText()
          .catch(() => '')
      ).trim() || (await item.innerText().catch(() => '')).split('\n')[0]?.trim();

    if (!displayName) continue;

    const href = await item
      .locator('a[href*="/@"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
    const tiktokUsername = href?.match(/@([^/?#]+)/)?.[1] || slugFromDisplayName(displayName);
    const key = tiktokUsername.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const text = await item.innerText().catch(() => '');
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const streakLine = lines.find((line) => /🔥|streak|огон|\d+\s*(day|дн)/i.test(line)) || '';
    const avatarUrl = await item.locator('img').first().getAttribute('src').catch(() => null);

    parsed.push({
      tiktokUsername,
      displayName,
      streakDays: extractStreakDays(streakLine),
      avatarUrl,
    });
  }

  if (parsed.length === 0) {
    const nicknames = page.locator('[data-e2e="dm-new-conversation-nickname"]');
    const nickCount = await nicknames.count();

    for (let i = 0; i < nickCount; i++) {
      const displayName = (await nicknames.nth(i).innerText().catch(() => '')).trim();
      if (!displayName) continue;

      const key = displayName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      parsed.push({
        tiktokUsername: slugFromDisplayName(displayName),
        displayName,
        streakDays: null,
        avatarUrl: null,
      });
    }
  }

  logger.info(`Parsed ${parsed.length} chats from TikTok messages page`);

  if (parsed.length === 0) {
    const debug = await page.evaluate(() => ({
      url: location.href,
      itemCount: document.querySelectorAll('[data-e2e="dm-new-conversation-item"]').length,
      nickCount: document.querySelectorAll('[data-e2e="dm-new-conversation-nickname"]').length,
      listVisible: !!document.querySelector('[data-e2e="dm-new-conversation-list"]'),
      title: document.title,
      bodyPreview: (document.body?.innerText || '').slice(0, 200),
    }));
    logger.warn('Chat list empty after parse', debug);
  }

  return parsed;
}

async function parseAndReturn(page) {
  const messagesUrl = 'https://www.tiktok.com/messages';

  if (!page.url().includes('/messages')) {
    await page.goto(messagesUrl, { waitUntil: 'domcontentloaded' });
    await safeWait(page, 3000);
  }

  await dismissCookieBanner(page);
  await waitForChatList(page);
  await safeWait(page, 1500);

  return parseChatList(page);
}

module.exports = {
  parseChatList,
  parseAndReturn,
  extractStreakDays,
  slugFromDisplayName,
};
