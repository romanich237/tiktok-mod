const logger = require('../logger');

function extractStreakDays(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:day|дн|d\b)/i) || text.match(/🔥\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (/🔥|streak|огон/i.test(text)) return 0;
  return null;
}

async function parseChatList(page) {
  await page.waitForTimeout(2000);

  const chats = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    const listItems = document.querySelectorAll(
      '[data-e2e="conversation-item"], [data-e2e="chat-list-item"], [class*="conversationConversationItem"], [class*="ConversationItem"], div[role="listitem"]'
    );

    const items = listItems.length ? listItems : document.querySelectorAll('a[href*="/messages"]');

    items.forEach((item, index) => {
      const text = (item.innerText || '').trim();
      if (!text || text.length < 2) return;

      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const displayName = lines[0] || `chat_${index}`;
      const usernameMatch =
        item.querySelector('a[href*="/@"]')?.getAttribute('href')?.match(/@([^/?#]+)/);
      const tiktokUsername = usernameMatch
        ? usernameMatch[1]
        : displayName.replace(/^@/, '').toLowerCase().replace(/\s+/g, '_');

      const key = tiktokUsername.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const streakLine = lines.find((l) => /🔥|streak|огон|\d+\s*(day|дн)/i.test(l)) || '';
      const avatarEl = item.querySelector('img');
      const avatarUrl = avatarEl?.src || null;

      results.push({
        tiktokUsername,
        displayName,
        streakText: streakLine,
        avatarUrl,
        rawText: text,
      });
    });

    return results;
  });

  const parsed = chats.map((chat) => ({
    tiktokUsername: chat.tiktokUsername,
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
    await page.waitForTimeout(3000);
  }

  return parseChatList(page);
}

module.exports = {
  parseChatList,
  parseAndReturn,
  extractStreakDays,
};
