const { config } = require('../config');
const browserManager = require('./browser');
const selectors = require('./selectors');
const { safeWait } = require('./pageUtils');
const logger = require('../logger');

const EMOJI_SHORTCODES = {
  '🔥': 'fire',
  '❤️': 'heart',
  '❤': 'heart',
  '💕': 'two_hearts',
  '😊': 'blush',
  '😀': 'grinning',
  '😂': 'joy',
  '👍': '+1',
  '✨': 'sparkles',
  '💯': '100',
  '🙏': 'pray',
  '😍': 'heart_eyes',
  '🥰': 'smiling_face_with_three_hearts',
  '😘': 'kissing_heart',
  '🎉': 'tada',
  '💪': 'muscle',
  '🤣': 'rofl',
  '😭': 'sob',
};

function pickRandomEmoji() {
  const pool = config.emoji?.pool || ['🔥'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function normalize(value) {
  return (value || '').replace(/^@/, '').trim().toLowerCase();
}

async function openChatByUsername(page, username, displayName) {
  const normalized = normalize(username);
  const display = (displayName || username || '').trim();

  const nicks = page.locator('[data-e2e="dm-new-conversation-nickname"]');
  const nickCount = await nicks.count();

  for (let i = 0; i < nickCount; i++) {
    const nick = nicks.nth(i);
    const text = ((await nick.textContent()) || '').trim();
    const textNorm = normalize(text);

    if (
      text === display ||
      textNorm === normalized ||
      textNorm === normalize(display) ||
      (display && text.includes(display))
    ) {
      const item = nick.locator('xpath=ancestor::*[@data-e2e="dm-new-conversation-item"][1]');
      if (await item.count()) {
        await item.click();
      } else {
        await nick.click();
      }
      await safeWait(page, 2000);
      return true;
    }
  }

  const chatLink = page.locator(`a[href*="@${normalized}"]`).first();
  if (await chatLink.count()) {
    await chatLink.click();
    await safeWait(page, 2000);
    return true;
  }

  const chatItems = page.locator('[data-e2e="dm-new-conversation-item"]');
  let count = await chatItems.count();

  if (!count) {
    const fallback = await selectors.findAll(page, selectors.messages.chatItem);
    count = await fallback.count();
    for (let i = 0; i < count; i++) {
      const item = fallback.nth(i);
      const text = await item.innerText().catch(() => '');
      if (
        text.toLowerCase().includes(normalized) ||
        (display && text.includes(display))
      ) {
        await item.click();
        await safeWait(page, 2000);
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < count; i++) {
    const item = chatItems.nth(i);
    const nick = await item
      .locator('[data-e2e="dm-new-conversation-nickname"]')
      .innerText()
      .catch(() => '');
    const text = await item.innerText().catch(() => '');
    const nickNorm = normalize(nick);
    const displayNorm = normalize(display);

    if (
      nick === display ||
      nickNorm === normalized ||
      nickNorm === displayNorm ||
      text.toLowerCase().includes(normalized) ||
      (display && text.includes(display))
    ) {
      await item.click();
      await safeWait(page, 2000);
      return true;
    }
  }

  return false;
}

async function clickSendButton(page) {
  const sendBtn = page.getByRole('button', { name: 'Send', exact: true });
  await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
  await sendBtn.click();
}

async function pickEmojiFromPanel(page, emoji) {
  const shortcode = EMOJI_SHORTCODES[emoji];
  const emojiBtn = await selectors.findFirst(page, selectors.messages.emojiButton, {
    visible: true,
    timeout: 5000,
  });

  if (!emojiBtn) {
    throw new Error('Emoji picker button not found');
  }

  await emojiBtn.click();
  await safeWait(page, 500);

  if (shortcode) {
    const target = page.locator(`button[aria-label="${shortcode}"]`).first();
    for (let attempt = 0; attempt < 12; attempt++) {
      if (await target.count()) {
        await target.scrollIntoViewIfNeeded().catch(() => {});
        await target.click();
        return;
      }
      await page
        .locator('#emoji-suggestion-container, [id="emoji-suggestion-container"]')
        .evaluate((el) => {
          el.scrollTop += 240;
        })
        .catch(() => {});
      await safeWait(page, 150);
    }
  }

  const fallback = page.locator('#emoji-suggestion-container button[aria-label], button[aria-label]').filter({
    hasNotText: 'Send',
  });
  const first = fallback.first();
  if (await first.count()) {
    await first.click();
    logger.warn(`Emoji ${emoji} not found in picker, used fallback`);
    return;
  }

  throw new Error(`Emoji not found in picker: ${emoji}`);
}

async function sendEmojiInOpenChat(page, emoji) {
  await page
    .locator('[data-e2e="dm-new-chatbox"], [data-e2e="message-input-area"]')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});

  await pickEmojiFromPanel(page, emoji);
  await safeWait(page, 300);
  await clickSendButton(page);
  await safeWait(page, 1500);
  return emoji;
}

async function sendEmojiToChat(page, chat, emoji = null) {
  const chosenEmoji = emoji || pickRandomEmoji();
  const username = chat.tiktok_username || chat.tiktokUsername;
  const displayName = chat.display_name || chat.displayName;

  const opened = await openChatByUsername(page, username, displayName);

  if (!opened) {
    throw new Error(`Chat not found: ${displayName || username}`);
  }

  await sendEmojiInOpenChat(page, chosenEmoji);
  logger.info(`Sent ${chosenEmoji} to ${displayName || username}`);
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
