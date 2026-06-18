const logger = require('../logger');
const { dismissCookieBanner } = require('./pageUtils');
const {
  ensureMessagesView,
  waitForNicknames,
  scrollChatList,
  parseChats,
  slugFromDisplayName,
  resolveTiktokUsername,
  extractStreakDays,
} = require('./dmDom');

async function parseChatList(page) {
  const parsed = await parseChats(page);
  logger.info(`Parsed ${parsed.length} chats from TikTok messages page`);

  if (parsed.length === 0) {
    const debug = await page.evaluate(() => ({
      url: location.href,
      itemCount: document.querySelectorAll('[data-e2e="dm-new-conversation-item"]').length,
      nickCount: document.querySelectorAll('[data-e2e="dm-new-conversation-nickname"]').length,
      listVisible: !!document.querySelector('[data-e2e="dm-new-conversation-list"]'),
      title: document.title,
    }));
    logger.warn('Chat list empty after parse', debug);
  }

  return parsed;
}

async function parseAndReturn(page) {
  await ensureMessagesView(page);
  await dismissCookieBanner(page);
  await waitForNicknames(page, 20000);

  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = await parseChatList(page);
    if (parsed.length > 0) return parsed;

    logger.info(`Chat parse retry ${attempt + 1}/2`);
    await scrollChatList(page, 6);
    await page.waitForTimeout(1500);
  }

  return parseChatList(page);
}

module.exports = {
  parseChatList,
  parseAndReturn,
  extractStreakDays,
  slugFromDisplayName,
  resolveTiktokUsername,
};
