const { config } = require('../config');
const browserManager = require('./browser');
const { SEL, openChatByDisplayName, openChatByItemId } = require('./dmDom');
const { safeWait, safeClick, dismissUiOverlays } = require('./pageUtils');
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

async function openChatByUsername(page, username, displayName, itemId = null) {
  await dismissUiOverlays(page);

  if (itemId && (await openChatByItemId(page, itemId))) {
    return true;
  }

  const display = (displayName || username || '').trim();
  if (display && (await openChatByDisplayName(page, display))) {
    return true;
  }

  const normalized = normalize(username);
  if (!normalized) return false;

  const opened = await page.evaluate(
    ({ nickSel, itemSel, needle }) => {
      const nick = [...document.querySelectorAll(nickSel)].find((el) => {
        const text = el.textContent.trim().toLowerCase();
        return text === needle || text.includes(needle);
      });
      if (!nick) return false;
      nick.closest(itemSel)?.click();
      return true;
    },
    { nickSel: SEL.nick, itemSel: '[data-e2e="dm-new-conversation-item"]', needle: normalized }
  );

  if (!opened) return false;

  await page
    .locator(`${SEL.input}, ${SEL.uniqueId}`)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
  await safeWait(page, 600);
  return true;
}

async function clickSendButton(page) {
  const sendBtn = page.getByRole('button', { name: 'Send', exact: true });
  await sendBtn.waitFor({ state: 'visible', timeout: 6000 });
  await safeClick(page, sendBtn);
}

async function pickEmojiFromPanel(page, emoji) {
  const shortcode = EMOJI_SHORTCODES[emoji];
  const emojiBtn = page.locator(SEL.emojiBtn).first();
  await emojiBtn.waitFor({ state: 'visible', timeout: 6000 });
  await safeClick(page, emojiBtn);
  await safeWait(page, 400);

  if (shortcode) {
    const target = page.locator(`button[aria-label="${shortcode}"]`).first();
    for (let attempt = 0; attempt < 10; attempt++) {
      if (await target.count()) {
        await safeClick(page, target);
        return;
      }
      await page
        .locator(SEL.emojiPanel)
        .evaluate((el) => {
          el.scrollTop += 280;
        })
        .catch(() => {});
      await safeWait(page, 120);
    }
  }

  const fallback = page.locator(`${SEL.emojiPanel} button[aria-label]`).first();
  if (await fallback.count()) {
    await safeClick(page, fallback);
    logger.warn(`Emoji ${emoji} not found in picker, used fallback`);
    return;
  }

  throw new Error(`Emoji not found in picker: ${emoji}`);
}

async function sendEmojiInOpenChat(page, emoji) {
  await page.locator(SEL.chatbox).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

  await pickEmojiFromPanel(page, emoji);
  await safeWait(page, 250);
  await clickSendButton(page);
  await safeWait(page, 1000);
  return emoji;
}

async function sendEmojiToChat(page, chat, emoji = null) {
  const chosenEmoji = emoji || pickRandomEmoji();
  const username = chat.tiktok_username || chat.tiktokUsername;
  const displayName = chat.display_name || chat.displayName;
  const itemId = chat.tiktok_item_id || chat.itemId;

  const opened = await openChatByUsername(page, username, displayName, itemId);
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
