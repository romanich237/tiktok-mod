const loginAutomation = require('../../automation/login');
const { formatBrowserError } = require('../../automation/pageUtils');
const loginSession = require('../loginSession');
const { mainMenuKeyboard, loginMethodsKeyboard } = require('../keyboards/inline');
const { isAccountAuthorized } = require('../auth');
const logger = require('../logger');

let loginInProgress = false;

const LOGIN_METHODS_TEXT =
  '🔐 Вход в TikTok\n\nВыберите способ входа.\nВсе данные вводятся здесь, в боте.';

function armLoginChoice(userId) {
  loginSession.set(userId, { step: 'choose_method', armedAt: Date.now() });
}

async function promptLoginMethods(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;

  await resetLoginState(userId);
  armLoginChoice(userId);
  await ctx.reply(LOGIN_METHODS_TEXT, loginMethodsKeyboard());
}

function registerLogin(bot) {
  loginInProgress = false;
  loginAutomation.cancelAllLogins().catch(() => {});

  bot.command('login', promptLoginMethods);
  bot.command('login_cancel', cancelLogin);
  bot.hears('🔐 Войти', promptLoginMethods);

  bot.action('start_auth', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await promptLoginMethods(ctx);
  });

  bot.action('login_method:qr', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!ensureLoginChoice(ctx)) return;
    void runQrLoginFlow(ctx);
  });

  bot.action('login_method:phone', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!ensureLoginChoice(ctx)) return;
    await beginPhoneLogin(ctx);
  });

  bot.action('login_method:email', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!ensureLoginChoice(ctx)) return;
    await beginEmailLogin(ctx);
  });

  bot.action('login_cancel', async (ctx) => {
    await ctx.answerCbQuery('Отменено').catch(() => {});
    await cancelLogin(ctx);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !loginSession.isActive(userId)) {
      return next();
    }

    const session = loginSession.get(userId);
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/')) {
      return next();
    }

    try {
      if (session.step === 'phone_number') {
        await handlePhoneNumber(ctx, text);
      } else if (session.step === 'phone_code') {
        await handlePhoneCode(ctx, text);
      } else if (session.step === 'email_username') {
        await handleEmailUsername(ctx, text);
      } else if (session.step === 'email_password') {
        await handleEmailPassword(ctx, text);
      } else {
        return next();
      }
    } catch (err) {
      logger.error('Login step failed', err);
      await ctx.reply(`❌ ${formatBrowserError(err)}`);
      await cleanupLogin(ctx.from.id);
    }
  });

  function ensureLoginChoice(ctx) {
    const userId = ctx.from?.id;
    if (!userId) return false;

    if (loginSession.get(userId)?.step === 'choose_method') {
      return true;
    }

    void promptLoginMethods(ctx);
    return false;
  }

  async function resetLoginState(userId) {
    if (loginInProgress) {
      await loginAutomation.cancelLogin(userId).catch(() => {});
    }
    loginInProgress = false;
    loginSession.clear(userId);
  }

  async function runQrLoginFlow(ctx) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (loginInProgress) {
      await ctx.reply('⏳ Вход уже выполняется. /login_cancel — отменить');
      return;
    }

    loginInProgress = true;
    loginSession.update(userId, { step: 'qr_waiting', method: 'qr' });

    try {
      await ctx.reply('📷 Открываю страницу QR-кода...');
      await loginAutomation.startQrLogin(userId);

      await loginAutomation.completeQrLogin(userId, async (buffer, number) => {
        await ctx.replyWithPhoto(
          { source: buffer },
          {
            caption:
              `📱 QR-код #${number}\n\n` +
              '1. Откройте TikTok на телефоне\n' +
              '2. Профиль → ☰ → Scan\n' +
              '3. Наведите камеру на код\n\n' +
              'QR обновляется каждые 30 сек. Ожидаю сканирование...',
          }
        );
      });

      await cleanupLogin(userId);
      await ctx.reply('✅ Вход по QR выполнен! Сессия сохранена.', mainMenuKeyboard());
    } catch (err) {
      logger.error('QR login failed', err);
      await cleanupLogin(userId);
      const message = formatBrowserError(err);
      if (!isAccountAuthorized()) {
        armLoginChoice(userId);
        await ctx.reply(`❌ ${message}`, loginMethodsKeyboard());
      } else {
        await ctx.reply(`❌ ${message}`, mainMenuKeyboard());
      }
    }
  }

  async function beginPhoneLogin(ctx) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (loginInProgress) {
      await ctx.reply('⏳ Вход уже выполняется. /login_cancel — отменить');
      return;
    }

    loginInProgress = true;
    loginSession.update(userId, { step: 'phone_number', method: 'phone' });
    await ctx.reply('📱 Введите номер телефона (например: +79001234567):');
  }

  async function beginEmailLogin(ctx) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (loginInProgress) {
      await ctx.reply('⏳ Вход уже выполняется. /login_cancel — отменить');
      return;
    }

    loginInProgress = true;
    loginSession.update(userId, { step: 'email_username', method: 'email' });
    await ctx.reply('✉️ Введите email или username:');
  }

  async function handlePhoneNumber(ctx, phone) {
    const userId = ctx.from.id;
    try {
      await ctx.reply('🌐 Открываю браузер и отправляю SMS-код...');
      await loginAutomation.startPhoneLogin(userId);
      await loginAutomation.loginPhoneSendCode(userId, phone);
      loginSession.update(userId, { step: 'phone_code', phone });
      await ctx.reply('📩 Введите 6-значный код из SMS:');
    } catch (err) {
      await cleanupLogin(userId);
      throw err;
    }
  }

  async function handlePhoneCode(ctx, code) {
    const userId = ctx.from.id;
    try {
      await ctx.reply('⏳ Проверяю код...');
      await loginAutomation.loginPhoneComplete(userId, code);
      await cleanupLogin(userId);
      await ctx.reply('✅ Вход выполнен! Сессия сохранена.', mainMenuKeyboard());
    } catch (err) {
      await cleanupLogin(userId);
      throw err;
    }
  }

  async function handleEmailUsername(ctx, username) {
    loginSession.update(ctx.from.id, { step: 'email_password', username });
    await ctx.reply('🔑 Введите пароль:');
  }

  async function handleEmailPassword(ctx, password) {
    const userId = ctx.from.id;
    const session = loginSession.get(userId);
    try {
      await ctx.reply('🌐 Открываю браузер и вхожу...');
      await loginAutomation.startEmailLogin(userId);
      await loginAutomation.loginEmailComplete(userId, session.username, password);
      await cleanupLogin(userId);
      await ctx.reply('✅ Вход выполнен! Сессия сохранена.', mainMenuKeyboard());
    } catch (err) {
      await cleanupLogin(userId);
      throw err;
    }
  }

  async function cancelLogin(ctx) {
    const userId = ctx.from?.id;
    if (userId) await cleanupLogin(userId);
    if (!isAccountAuthorized()) {
      armLoginChoice(userId);
      await ctx.reply('Вход отменён.', loginMethodsKeyboard());
    } else {
      await ctx.reply('Вход отменён.', mainMenuKeyboard());
    }
  }

  async function cleanupLogin(userId) {
    loginSession.clear(userId);
    loginInProgress = false;
    await loginAutomation.cancelLogin(userId).catch(() => {});
  }
}

module.exports = { registerLogin, promptLoginMethods, armLoginChoice };
