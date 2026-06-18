/**
 * TikTok DM DOM helpers — verified via @Browser (2026-06-18).
 * List: dm-new-conversation-list / dm-new-conversation-item / dm-new-conversation-nickname
 * Chat: dm-new-chatbox / dm-new-input-editor / dm-new-emoji-btn / chat-uniqueid
 */
const { safeWait } = require('./pageUtils');

const SEL = {
  nick: '[data-e2e="dm-new-conversation-nickname"]',
  item: '[data-e2e="dm-new-conversation-item"]',
  list: '[data-e2e="dm-new-conversation-list"]',
  listContent: '[class*="DivListContent"]',
  avatar: '[data-e2e="dm-new-conversation-avatar"]',
  chatbox: '[data-e2e="dm-new-chatbox"]',
  input: '[data-e2e="dm-new-input-editor"]',
  inputEditable: '[data-e2e="dm-new-input-editor"] [contenteditable="true"]',
  emojiBtn: '[data-e2e="dm-new-emoji-btn"]',
  uniqueId: '[data-e2e="chat-uniqueid"]',
  chatNick: '[data-e2e="dm-new-chat-nickname"]',
  chatBottom: '[data-e2e="dm-new-chat-bottom"]',
  emojiPanel: '#emoji-suggestion-container',
  navProfile: '[data-e2e="nav-profile"]',
  navMessages: '[data-e2e="nav-messages"]',
};

const MESSAGES_URL = 'https://www.tiktok.com/messages';

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
  const hash = [...displayName].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `chat_${displayName.length}_${hash}`;
}

function extractStreakDays(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:day|дн|d\b)/i) || text.match(/🔥\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (/🔥|streak|огон/i.test(text)) return 0;
  return null;
}

async function ensureMessagesView(page) {
  if (!page.url().includes('/messages')) {
    const nav = page.locator(`${SEL.navMessages}, a[href="/messages"]`).first();
    if (await nav.count()) {
      await nav.click().catch(() => {});
      await safeWait(page, 1200);
    }
  }

  if (!page.url().includes('/messages')) {
    await page.goto(MESSAGES_URL, { waitUntil: 'domcontentloaded' });
    await safeWait(page, 2000);
  }
}

async function scrollChatList(page, steps = 4) {
  const locator = page.locator(`${SEL.list}, ${SEL.listContent}`).first();
  if (!(await locator.count())) return;

  for (let i = 0; i < steps; i++) {
    await locator.evaluate((el) => {
      el.scrollTop += 600;
    }).catch(() => {});
    await safeWait(page, 200);
  }

  await locator.evaluate((el) => {
    el.scrollTop = 0;
  }).catch(() => {});
  await safeWait(page, 300);
}

async function waitForNicknames(page, timeout = 20000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const count = await page.locator(SEL.nick).count();
    if (count > 0) return count;
    await scrollChatList(page, 2);
    await safeWait(page, 800);
  }

  return page.locator(SEL.nick).count();
}

function parseChatsInPage() {
  const results = [];
  const seen = new Set();

  document.querySelectorAll('[data-e2e="dm-new-conversation-nickname"]').forEach((nickEl) => {
    const displayName = (nickEl.textContent || '').replace(/\s+/g, ' ').trim();
    if (!displayName) return;

    const item =
      nickEl.closest('[data-e2e="dm-new-conversation-item"]') ||
      nickEl.closest('[id^="more-action-icon"]');

    const itemId = item?.id || '';
    const text = (item?.textContent || '').replace(/\s+/g, ' ').trim();
    const streakLine =
      text
        .split('\n')
        .map((line) => line.trim())
        .find((line) => /🔥|streak|огон|\d+\s*(day|дн)/i.test(line)) || '';

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
}

async function parseChats(page) {
  await scrollChatList(page);
  const raw = await page.evaluate(parseChatsInPage);
  return raw.map((chat) => ({
    tiktokUsername: resolveTiktokUsername(chat.displayName, chat.tiktokUsername, chat.itemId),
    displayName: chat.displayName,
    streakDays: extractStreakDays(chat.streakText),
    avatarUrl: chat.avatarUrl,
    itemId: chat.itemId,
  }));
}

async function openChatByDisplayName(page, displayName) {
  const target = (displayName || '').trim();
  if (!target) return false;

  const opened = await page.evaluate(
    ({ nickSel, itemSel, name }) => {
      const nick = [...document.querySelectorAll(nickSel)].find(
        (el) => el.textContent.trim() === name
      );
      if (!nick) return false;
      const item = nick.closest(itemSel);
      (item || nick).click();
      return true;
    },
    { nickSel: SEL.nick, itemSel: '[data-e2e="dm-new-conversation-item"]', name: target }
  );

  if (!opened) return false;

  await page
    .locator(`${SEL.input}, ${SEL.uniqueId}, ${SEL.chatNick}`)
    .first()
    .waitFor({ state: 'visible', timeout: 12000 })
    .catch(() => {});

  await safeWait(page, 600);
  return true;
}

async function readNavProfile(page) {
  return page.evaluate((navSel) => {
    const href = document.querySelector(navSel)?.getAttribute('href') || '';
    const match = href.match(/@([^/?#]+)/);
    return match ? { username: match[1], displayName: null } : null;
  }, SEL.navProfile);
}

module.exports = {
  SEL,
  MESSAGES_URL,
  slugFromDisplayName,
  usernameFromItemId,
  resolveTiktokUsername,
  extractStreakDays,
  ensureMessagesView,
  scrollChatList,
  waitForNicknames,
  parseChatsInPage,
  parseChats,
  openChatByDisplayName,
  readNavProfile,
};
