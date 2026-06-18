const { config } = require('../config');
const browserManager = require('./browser');
const selectors = require('./selectors');
const logger = require('../logger');

function pickRandomEmoji() {
  const pool = config.emoji?.pool || ['🔥'];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function openChatByUsername(page, username) {
  const normalized = username.replace(/^@/, '');

  const chatLink = page.locator(`a[href*="@${normalized}"]`).first();
  if (await chatLink.count()) {
    await chatLink.click();
    await page.waitForTimeout(2000);
    return true;
  }

  const chatItems = await selectors.findAll(page, selectors.messages.chatItem);
  const count = await chatItems.count();

  for (let i = 0; i < count; i++) {
    const item = chatItems.nth(i);
    const text = await item.innerText().catch(() => '');
    if (text.toLowerCase().includes(normalized.toLowerCase())) {
      await item.click();
      await page.waitForTimeout(2000);
      return true;
    }
  }

  return false;
}

async function sendEmojiInOpenChat(page, emoji) {
  const input = await selectors.findFirst(page, selectors.messages.messageInput, {
    visible: true,
    timeout: 10000,
  });

  if (!input) {
    throw new Error('Message input not found');
  }

  await input.click();
  await input.fill('');
  await page.keyboard.type(emoji, { delay: 50 });
  await page.waitForTimeout(500);

  const sendBtn = await selectors.findFirst(page, selectors.messages.sendButton, {
    timeout: 3000,
  });

  if (sendBtn) {
    await sendBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(1500);
  return emoji;
}

async function sendEmojiToChat(page, chat, emoji = null) {
  const chosenEmoji = emoji || pickRandomEmoji();
  const opened = await openChatByUsername(page, chat.tiktok_username || chat.tiktokUsername);

  if (!opened) {
    throw new Error(`Chat not found: ${chat.tiktok_username || chat.tiktokUsername}`);
  }

  await sendEmojiInOpenChat(page, chosenEmoji);
  logger.info(`Sent ${chosenEmoji} to ${chat.tiktok_username || chat.tiktokUsername}`);
  return chosenEmoji;
}

async function sendEmojisToChats(page, chats) {
  const minDelay = config.automation?.chatDelayMinMs || 3000;
  const maxDelay = config.automation?.chatDelayMaxMs || 8000;
  const results = [];

  for (const chat of chats) {
    try {
      const emoji = await sendEmojiToChat(page, chat);
      results.push({
        chatId: chat.id,
        username: chat.tiktok_username,
        displayName: chat.display_name,
        emoji,
        status: 'success',
      });
    } catch (err) {
      results.push({
        chatId: chat.id,
        username: chat.tiktok_username,
        displayName: chat.display_name,
        emoji: null,
        status: 'error',
        error: err.message,
      });
    }

    await browserManager.randomDelay(minDelay, maxDelay);
  }

  return results;
}

module.exports = {
  pickRandomEmoji,
  openChatByUsername,
  sendEmojiInOpenChat,
  sendEmojiToChat,
  sendEmojisToChats,
};
