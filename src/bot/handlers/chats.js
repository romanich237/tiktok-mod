const { config } = require('../../config');
const loginAutomation = require('../../automation/login');
const chatParser = require('../../automation/chatParser');
const browserManager = require('../../automation/browser');
const chatsRepo = require('../../db/repositories/chats');
const { chatsKeyboard } = require('../keyboards/inline');
const logger = require('../../logger');

let parseInProgress = false;

async function showChatsList(ctx) {
  const accountId = config.tiktok.accountId;
  const chats = await chatsRepo.getChatsByAccount(accountId);

  if (!chats.length) {
    await ctx.reply(
      'Список чатов пуст. Нажмите «Обновить список» для парсинга с TikTok.',
      chatsKeyboard([])
    );
    return;
  }

  const enabledCount = chats.filter((c) => c.enabled).length;
  await ctx.reply(
    `💬 Чаты (${enabledCount}/${chats.length} выбрано):\n` +
      'Нажмите на чат, чтобы включить/выключить отправку эмодзи.',
    chatsKeyboard(chats)
  );
}

async function refreshChats(ctx) {
  if (parseInProgress) {
    await ctx.answerCbQuery?.('Парсинг уже выполняется...');
    return;
  }

  parseInProgress = true;
  const accountId = config.tiktok.accountId;

  try {
    await ctx.reply?.('🔄 Парсинг чатов с TikTok...');
    await ctx.answerCbQuery?.('Обновляю список...');

    const page = await loginAutomation.ensureSession(accountId);
    const parsed = await chatParser.parseAndReturn(page);
    await chatsRepo.upsertChats(accountId, parsed);
    await page.close();
    await browserManager.closeBrowser();

    const chats = await chatsRepo.getChatsByAccount(accountId);
    const text = `✅ Найдено ${parsed.length} чатов`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(
        `${text}\nВыберите получателей:`,
        chatsKeyboard(chats)
      );
    } else {
      await ctx.reply(`${text}\nВыберите получателей:`, chatsKeyboard(chats));
    }
  } catch (err) {
    logger.error('Chat parse failed', err);
    const msg =
      err.message === 'SESSION_EXPIRED'
        ? '❌ Сессия истекла. Выполните /login'
        : `❌ Ошибка парсинга: ${err.message}`;
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(msg);
      await ctx.reply(msg);
    } else {
      await ctx.reply(msg);
    }
  } finally {
    parseInProgress = false;
  }
}

function registerChats(bot) {
  bot.command('chats', showChatsList);
  bot.hears('💬 Чаты', showChatsList);

  bot.action('chats_refresh', refreshChats);

  bot.action(/^toggle_chat:(\d+)$/, async (ctx) => {
    const chatId = parseInt(ctx.match[1], 10);
    const chat = await chatsRepo.getChatById(chatId);
    if (!chat) {
      await ctx.answerCbQuery('Чат не найден');
      return;
    }

    await chatsRepo.toggleChat(chatId, !chat.enabled);
    const chats = await chatsRepo.getChatsByAccount(config.tiktok.accountId);
    await ctx.editMessageReplyMarkup(chatsKeyboard(chats).reply_markup);
    await ctx.answerCbQuery(chat.enabled ? 'Выключено' : 'Включено');
  });

  bot.action('chats_select_all', async (ctx) => {
    await chatsRepo.setAllChatsEnabled(config.tiktok.accountId, true);
    const chats = await chatsRepo.getChatsByAccount(config.tiktok.accountId);
    await ctx.editMessageReplyMarkup(chatsKeyboard(chats).reply_markup);
    await ctx.answerCbQuery('Все чаты выбраны');
  });

  bot.action('chats_deselect_all', async (ctx) => {
    await chatsRepo.setAllChatsEnabled(config.tiktok.accountId, false);
    const chats = await chatsRepo.getChatsByAccount(config.tiktok.accountId);
    await ctx.editMessageReplyMarkup(chatsKeyboard(chats).reply_markup);
    await ctx.answerCbQuery('Выбор снят');
  });
}

module.exports = { registerChats, refreshChats, showChatsList };
