/**
 * TikTok web selectors — verified via @Browser DOM research (2026-06-18).
 * DM list: dm-new-conversation-{list,item,nickname,avatar}
 * DM chat: dm-new-{chatbox,input-editor,emoji-btn}, chat-uniqueid
 * Profile nav: nav-profile → /@username
 */
const { SEL: DM } = require('./dmDom');

module.exports = {
  dm: DM,

  loggedInIndicators: [
    DM.navMessages,
    DM.list,
    DM.chatbox,
    DM.navProfile,
    '[data-e2e="profile-icon"]',
    'a[href="/upload"]',
    '[data-e2e="tiktok-logo"]',
  ],

  loginPageIndicators: [
    '[data-e2e="login-title"]',
    'h2[data-e2e="login-title"]',
    'text=Log in to TikTok',
    'text=Войти',
  ],

  login: {
    qrCode: ['[data-e2e="qr-code"]', '[data-e2e="qr-code"] canvas'],
    qrLoginUrl: 'https://www.tiktok.com/login/qrcode',
    emailLoginUrl: 'https://www.tiktok.com/login/phone-or-email/email',
    phoneLoginUrl: 'https://www.tiktok.com/login/phone-or-email/phone',
    usernameInput: ['input[name="username"]', 'input[placeholder*="Email or username"]'],
    passwordInput: ['input[type="password"]', 'input[placeholder*="Password"]'],
    submitButton: ['[data-e2e="login-button"]', 'button:has-text("Log in")', 'button:has-text("Войти")'],
    phoneInput: ['input[name="mobile"]', 'input[placeholder*="Phone number"]'],
    smsCodeInput: ['input[placeholder*="6-digit"]', 'input[placeholder*="6-значный"]'],
    sendCodeButton: ['[data-e2e="send-code-button"]', 'button:has-text("Send code")'],
  },

  profile: {
    title: '[data-e2e="user-title"]',
    subtitle: '[data-e2e="user-subtitle"]',
    navLink: DM.navProfile,
  },

  messages: {
    chatList: [DM.list, DM.listContent, '[class*="ConversationListContainer"]'],
    chatItem: [DM.item, '[id^="more-action-icon"]', '[class*="DivItemWrapper"]'],
    chatNickname: [DM.nick, '[class*="PInfoNickname"]'],
    chatAvatar: [`${DM.avatar} img`, 'img'],
    openChatUsername: [DM.uniqueId, DM.chatNick],
    chatPanel: [DM.chatbox, '[data-e2e="message-input-area"]'],
    messageInput: [DM.inputEditable, DM.input, '[aria-label="Send a message..."]'],
    emojiButton: [DM.emojiBtn, '[aria-label="Click to add emojis"]'],
    sendButton: ['button[aria-label="Send"]', '[data-e2e="message-send"]'],
    messageContent: ['[data-e2e="dm-new-chat-item"]', '[data-e2e="msg-item-content"]'],
    moreAction: ['[data-e2e="conversation-more-action"]'],
  },
};

async function findFirst(page, selectorList, options = {}) {
  for (const selector of selectorList) {
    try {
      const locator = page.locator(selector).first();
      if (options.visible) {
        await locator.waitFor({ state: 'visible', timeout: options.timeout || 5000 });
      }
      if ((await locator.count()) > 0) return locator;
    } catch {
      // try next
    }
  }
  return null;
}

async function findAll(page, selectorList) {
  for (const selector of selectorList) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) return locator;
  }
  return page.locator('__never__');
}

module.exports.findFirst = findFirst;
module.exports.findAll = findAll;
