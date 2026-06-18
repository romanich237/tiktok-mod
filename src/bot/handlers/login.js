const { Markup } = require('telegraf');
const loginAutomation = require('../../automation/login');
const loginSession = require('../loginSession');
const { mainMenuKeyboard } = require('../keyboards/inline');
const logger = require('../../logger');

let loginInProgress = false;

const methodKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('📷 QR-код', 'login_method:qr'),
    Markup.button.callback('📱 Телефон', 'login_method:phone'),
  ],
  [Markup.button.callback('✉️ Email', 'login_method:email')],
  [Markup.button.callback('❌ Отмена', 'login_cancel')],
]);

function registerLogin(bot) {
  bot.command('login', startLogin);
  bot.command('login_cancel', cancelLogin);
  bot.hears('🔐 Войти', startLogin);

  bot.action('start_auth', async (ctx) => {
    await ctx.answerCbQuery();
    await beginQrLogin(ctx);
  });

  bot.action('login_method:qr', async (ctx) => {
    await ctx.answerCbQuery();
    await beginQrLogin(ctx);
  });

  bot.action('login_method:phone', async (ctx) => {
    await ctx.answerCbQuery();
    await beginPhoneLogin(ctx);
  });

  bot.action('login_method:email', async (ctx) => {
    await ctx.answerCbQuery();
    await beginEmailLogin(ctx);
  });

  bot.action('login_cancel', async (ctx) => {
    await ctx.answerCbQuery('Отменено');
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
      await ctx.reply(`❌ ${err.message}`);
      await cleanupLogin(ctx.from.id);
    }
  });

  async function startLogin(ctx) {
    if (loginInProgress) {
      await ctx.reply('⏳ Вход уже выполняется. /login_cancel — отменить');
      return;
    }

    loginInProgress = true;
    loginSession.set(ctx.from.id, { step: 'choose_method' });

    await ctx.reply(
      '🔐 Вход в TikTok\n\nВыберите способ входа.\nВсе данные вводятся здесь, в боте.',
      methodKeyboard
    );
  }

  async function beginQrLogin(ctx) {
    if (loginInProgress) {
      await ctx.reply('⏳ Вход уже выполняется. /login_cancel — отменить');
      return;
    }

    loginInProgress = true;
    const userId = ctx.from.id;
    try {
      loginSession.update(userId, { step: 'qr_waiting', method: 'qr' });
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
      await ctx.reply(`❌ ${err.message}`);
    }
  }

  async function beginPhoneLogin(ctx) {
    const userId = ctx.from.id;
    await ctx.reply('📱 Введите номер телефона (например: +79001234567):');
    loginSession.update(userId, { step: 'phone_number', method: 'phone' });
  }

  async function beginEmailLogin(ctx) {
    const userId = ctx.from.id;
    await ctx.reply('✉️ Введите email или username:');
    loginSession.update(userId, { step: 'email_username', method: 'email' });
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
    await ctx.reply('Вход отменён.');
  }

  async function cleanupLogin(userId) {
    loginSession.clear(userId);
    loginInProgress = false;
    await loginAutomation.cancelLogin(userId).catch(() => {});
  }
}

module.exports = { registerLogin };
