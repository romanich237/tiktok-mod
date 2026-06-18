/**
 * TikTok web selectors — updated via @Browser DOM research (2026-06-18).
 * Login page confirmed: data-e2e="login-title", "channel-item", "tiktok-logo".
 * Messages page variants: data-e2e="conversation-item", "msg-item-content".
 */
module.exports = {
  loggedInIndicators: [
    '[data-e2e="profile-icon"]',
    '[data-e2e="nav-messages"]',
    'a[href*="/messages"]',
    '[data-e2e="tiktok-logo"]',
    'div[id="header-more-menu-icon"]',
  ],

  loginPageIndicators: [
    '[data-e2e="login-title"]',
    'h2[data-e2e="login-title"]',
    'text=Log in to TikTok',
    'text=Войти',
  ],

  login: {
    phoneEmailChannel: [
      '[data-e2e="channel-item"]:has-text("phone / email / username")',
      '[data-e2e="channel-item"]:has-text("phone")',
      'div[data-e2e="channel-item"][role="link"]',
      'div.tiktok-vmu50-DivBoxContainer[data-e2e="channel-item"]',
    ],
    qrChannel: [
      '[data-e2e="channel-item"]:has-text("QR code")',
      '[data-e2e="channel-item"]:has-text("QR")',
      '[data-e2e="channel-item"]:has-text("код")',
      'div.tiktok-vmu50-DivBoxContainer[data-e2e="channel-item"]',
    ],
    qrCode: [
      '[data-e2e="qr-code"]',
      '[data-e2e="qr-code"] canvas',
      'canvas',
    ],
    qrLoginUrl: 'https://www.tiktok.com/login/qrcode',
    emailOrUsernameLink: [
      'a:has-text("Log in with email or username")',
      'a:has-text("email or username")',
      'a:has-text("Войти с помощью эл. почты")',
      'a:has-text("почты или имени")',
    ],
    usernameInput: [
      'input[name="username"]',
      'input[placeholder*="Email or username"]',
      'input[placeholder*="почты"]',
    ],
    passwordInput: [
      'input[type="password"]',
      'input[placeholder*="Password"]',
      'input[placeholder*="Пароль"]',
    ],
    submitButton: [
      '[data-e2e="login-button"]',
      'button:has-text("Log in")',
      'button:has-text("Войти")',
    ],
    emailLoginUrl: 'https://www.tiktok.com/login/phone-or-email/email',
    phoneLoginUrl: 'https://www.tiktok.com/login/phone-or-email/phone',
    phoneLink: [
      'a[href="/login/phone-or-email/phone"]',
      'a:has-text("Log in with phone")',
      'a:has-text("Войти с помощью телефона")',
    ],
    phoneInput: [
      'input[name="mobile"]',
      'input[placeholder*="Phone number"]',
      'input[placeholder*="Номер телефона"]',
    ],
    smsCodeInput: [
      'input[placeholder*="6-digit"]',
      'input[placeholder*="6-значный"]',
      'input[placeholder*="код"]',
    ],
    sendCodeButton: [
      '[data-e2e="send-code-button"]',
      'button:has-text("Send code")',
      'button:has-text("Отправить код")',
    ],
  },

  messages: {
    chatList: [
      '[data-e2e="chat-list"]',
      '[class*="messageMessageListlist"]',
      '[class*="ConversationList"]',
      'div[role="list"]',
    ],
    chatItem: [
      '[data-e2e="conversation-item"]',
      '[data-e2e="chat-list-item"]',
      '[class*="conversationConversationItem"]',
      '[class*="ConversationItem"]',
      'div[role="listitem"]',
    ],
    chatName: [
      '[data-e2e="chat-username"]',
      '[class*="PInfoNickname"]',
      '[class*="Nickname"]',
      'p[class*="title"]',
    ],
    streakBadge: [
      '[data-e2e="streak-badge"]',
      '[class*="Streak"]',
      '[class*="streak"]',
    ],
    messageInput: [
      'div[contenteditable="true"]',
      '[data-e2e="message-input"]',
      'div[role="textbox"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Сообщение"]',
    ],
    sendButton: [
      '[data-e2e="message-send"]',
      'button[type="submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="Отправить"]',
    ],
    messageContent: [
      '[data-e2e="msg-item-content"]',
      'pre',
    ],
  },
};

async function findFirst(page, selectors, options = {}) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (options.visible) {
        await locator.waitFor({ state: 'visible', timeout: options.timeout || 5000 });
      }
      const count = await locator.count();
      if (count > 0) return locator;
    } catch {
      // try next selector
    }
  }
  return null;
}

async function findAll(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count > 0) return locator;
  }
  return page.locator('__never__');
}

module.exports.findFirst = findFirst;
module.exports.findAll = findAll;
