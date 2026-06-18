const logger = require('../logger');
const { safeWait } = require('./pageUtils');

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

async function parseChatList(page) {
  await safeWait(page, 2000);

  const chats = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    const listItems = document.querySelectorAll(
      '[data-e2e="dm-new-conversation-item"], [data-e2e="conversation-item"], [data-e2e="chat-list-item"], [class*="conversationConversationItem"], div[role="listitem"]'
    );

    listItems.forEach((item, index) => {
      const nickEl = item.querySelector('[data-e2e="dm-new-conversation-nickname"]');
      const displayName = (nickEl?.innerText || item.innerText || '').split('\n')[0]?.trim();
      if (!displayName || displayName.length < 1) return;

      const usernameMatch =
        item.querySelector('a[href*="/@"]')?.getAttribute('href')?.match(/@([^/?#]+)/);
      const tiktokUsername = usernameMatch ? usernameMatch[1] : null;

      const key = (tiktokUsername || displayName).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const text = (item.innerText || '').trim();
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const streakLine = lines.find((l) => /🔥|streak|огон|\d+\s*(day|дн)/i.test(l)) || '';
      const avatarEl =
        item.querySelector('[data-e2e="dm-new-conversation-avatar"] img') ||
        item.querySelector('img');

      results.push({
        tiktokUsername,
        displayName,
        streakText: streakLine,
        avatarUrl: avatarEl?.src || null,
        rawText: text,
      });
    });

    return results;
  });

  const parsed = chats.map((chat) => ({
    tiktokUsername: chat.tiktokUsername || slugFromDisplayName(chat.displayName) || `chat_${Date.now()}`,
    displayName: chat.displayName,
    streakDays: extractStreakDays(chat.streakText),
    avatarUrl: chat.avatarUrl,
  }));

  logger.info(`Parsed ${parsed.length} chats from TikTok messages page`);
  return parsed;
}

async function parseAndReturn(page) {
  const currentUrl = page.url();
  if (!currentUrl.includes('/messages')) {
    await page.goto('https://www.tiktok.com/messages', { waitUntil: 'domcontentloaded' });
    await safeWait(page, 3000);
  }

  await page
    .locator('[data-e2e="dm-new-conversation-list"], [data-e2e="conversation-item"]')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});

  return parseChatList(page);
}

module.exports = {
  parseChatList,
  parseAndReturn,
  extractStreakDays,
  slugFromDisplayName,
};
