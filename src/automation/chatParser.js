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
  const slug = displayName
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0400-\u04FF._-]/g, '');
  return slug || null;
}

function usernameFromItemId(itemId) {
  if (!itemId) return null;
  const parts = itemId.split(':');
  const tail = parts[parts.length - 1];
  if (tail && /^\d+$/.test(tail)) return `id_${tail}`;
  return `id_${itemId.replace(/\W/g, '_').slice(0, 48)}`;
}

function resolveTiktokUsername(displayName, hrefUser, itemId) {
  if (hrefUser) return hrefUser;

  const slug = slugFromDisplayName(displayName);
  if (slug) return slug;

  const fromItem = usernameFromItemId(itemId);
  if (fromItem) return fromItem;

  return `chat_${displayName.length}_${[...displayName].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)}`;
}

async function scrollChatList(page) {
  const scrollSelectors = [
    '[data-e2e="dm-new-conversation-list"]',
    '[class*="DivListContent"]',
    '[class*="ConversationListContainer"]',
  ];

  for (const selector of scrollSelectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;

    for (let i = 0; i < 8; i++) {
      await locator
        .evaluate((el) => {
          el.scrollTop += 500;
        })
        .catch(() => {});
      await safeWait(page, 300);
    }

    await locator
      .evaluate((el) => {
        el.scrollTop = 0;
      })
      .catch(() => {});
    await safeWait(page, 400);
    return;
  }
}

async function ensureMessagesView(page) {
  if (!page.url().includes('/messages')) {
    const nav = page.locator('[data-e2e="nav-messages"], a[href="/messages"], a[href*="/messages"]').first();
    if (await nav.count()) {
      await nav.click().catch(() => {});
      await safeWait(page, 1500);
    }
  }

  if (!page.url().includes('/messages')) {
    await page.goto('https://www.tiktok.com/messages', { waitUntil: 'domcontentloaded' });
    await safeWait(page, 3000);
  }
}

async function waitForChatList(page) {
  const waitTargets = [
    '[data-e2e="dm-new-conversation-nickname"]',
    '[data-e2e="dm-new-conversation-item"]',
    '[data-e2e="dm-new-conversation-list"]',
    '[class*="DivListContent"]',
    ...selectors.messages.chatList,
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const selector of waitTargets) {
      try {
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15000 });
        const nickCount = await page.locator('[data-e2e="dm-new-conversation-nickname"]').count();
        if (nickCount > 0) return;
      } catch {
        // try next selector
      }
    }
    await scrollChatList(page);
    await safeWait(page, 1500);
  }

  logger.warn('Chat nicknames not visible yet, attempting parse anyway');
}

async function parseChatListFromDom(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();

    const nickEls = document.querySelectorAll('[data-e2e="dm-new-conversation-nickname"]');
    nickEls.forEach((nickEl) => {
      const displayName = (nickEl.textContent || '').replace(/\s+/g, ' ').trim();
      if (!displayName) return;

      const item =
        nickEl.closest('[data-e2e="dm-new-conversation-item"]') ||
        nickEl.closest('[class*="DivItemWrapper"]') ||
        nickEl.closest('[id^="more-action-icon"]');

      const itemId = item?.id || '';
      const text = (item?.textContent || '').replace(/\s+/g, ' ').trim();
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
      const streakLine = lines.find((line) => /🔥|streak|огон|\d+\s*(day|дн)/i.test(line)) || '';

      const href = item?.querySelector('a[href*="/@"]')?.getAttribute('href') || '';
      const hrefUser = href.match(/@([^/?#]+)/)?.[1] || null;

      const avatarEl =
        item?.querySelector('[data-e2e="dm-new-conversation-avatar"] img') ||
        item?.querySelector('img');

      const key = (hrefUser || itemId || displayName).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      results.push({
        displayName,
        tiktokUsername: hrefUser,
        itemId,
        streakText: streakLine,
        avatarUrl: avatarEl?.src || null,
      });
    });

    return results;
  });
}

async function parseChatList(page) {
  await scrollChatList(page);

  const chats = await parseChatListFromDom(page);
  const parsed = chats.map((chat) => ({
    tiktokUsername: resolveTiktokUsername(chat.displayName, chat.tiktokUsername, chat.itemId),
    displayName: chat.displayName,
    streakDays: extractStreakDays(chat.streakText),
    avatarUrl: chat.avatarUrl,
    itemId: chat.itemId,
  }));

  logger.info(`Parsed ${parsed.length} chats from TikTok messages page`);

  if (parsed.length === 0) {
    const debug = await page.evaluate(() => ({
      url: location.href,
      itemCount: document.querySelectorAll('[data-e2e="dm-new-conversation-item"]').length,
      nickCount: document.querySelectorAll('[data-e2e="dm-new-conversation-nickname"]').length,
      listVisible: !!document.querySelector('[data-e2e="dm-new-conversation-list"]'),
      listContentVisible: !!document.querySelector('[class*="DivListContent"]'),
      title: document.title,
      bodyPreview: (document.body?.innerText || '').slice(0, 200),
    }));
    logger.warn('Chat list empty after parse', debug);
  }

  return parsed;
}

async function parseAndReturn(page) {
  await ensureMessagesView(page);
  await dismissCookieBanner(page);
  await waitForChatList(page);

  for (let attempt = 0; attempt < 3; attempt++) {
    const parsed = await parseChatList(page);
    if (parsed.length > 0) return parsed;

    logger.info(`Chat parse retry ${attempt + 1}/3`);
    await scrollChatList(page);
    await safeWait(page, 2000);
  }

  return parseChatList(page);
}

module.exports = {
  parseChatList,
  parseAndReturn,
  parseChatListFromDom,
  extractStreakDays,
  slugFromDisplayName,
  resolveTiktokUsername,
};
