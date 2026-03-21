const booking = require('../services/booking');
const kb      = require('../keyboards');
const sheets  = require('../services/sheets');
const ai      = require('../services/ai');

function register(bot) {

  // ─── /start ──────────────────────────────────────────────
  bot.start(async ctx => {
    console.log('Telegram ID:', ctx.from.id);
    ctx.session = {};

    await booking.ensureSchedule();

    const client = await booking.getClient(ctx.from.id);
    if (client) {
      ctx.session.clientName  = client.first_name;
      ctx.session.clientPhone = client.phone;
    }

    const services = await booking.getServices();
    const greeting = client
      ? `👋 С возвращением, ${client.first_name}!\n\nВыберите услугу:`
      : '👋 Добро пожаловать в салон!\n\nВыберите услугу:';

    await ctx.reply(greeting, kb.servicesKeyboard(services));
  });

  // ─── Выбор услуги ────────────────────────────────────────
  bot.action(/^service:(\d+):(\d+)$/, async ctx => {
    const [, serviceId, duration] = ctx.match;
    ctx.session.serviceId = parseInt(serviceId);
    ctx.session.duration  = parseInt(duration);

    const masters = await booking.getMasters(ctx.session.serviceId);
    if (!masters.length) {
      return ctx.reply('😔 Нет доступных мастеров. Попробуйте позже.');
    }

    await ctx.editMessageText('👩 Выберите мастера:', kb.mastersKeyboard(masters));
  });

  // ─── Выбор мастера ───────────────────────────────────────
  bot.action(/^master:(\d+)$/, async ctx => {
    ctx.session.masterId = parseInt(ctx.match[1]);
    await ctx.editMessageText('📅 Выберите дату:', kb.datesKeyboard());
  });

  // ─── Выбор даты ──────────────────────────────────────────
  bot.action(/^date:(\d{4}-\d{2}-\d{2})$/, async ctx => {
    ctx.session.date = ctx.match[1];
    await ctx.answerCbQuery('Ищем свободные слоты...');

    const slots = await booking.getAvailableSlots(
      ctx.session.serviceId,
      ctx.session.masterId,
      ctx.session.date
    );

    if (!slots || !slots.length) {
      return ctx.editMessageText(
        '😔 На эту дату нет свободного времени.\n\nВыберите другую дату:',
        kb.datesKeyboard()
      );
    }

    await ctx.editMessageText(
      `🕐 Свободное время на ${formatDate(ctx.session.date)}:`,
      kb.slotsKeyboard(slots)
    );
  });

  // ─── Выбор слота ─────────────────────────────────────────
  bot.action(/^slot:(\d{2}:\d{2})$/, async ctx => {
    ctx.session.time = ctx.match[1];

    if (ctx.session.clientName && ctx.session.clientPhone) {
      ctx.session.step = 'confirming';
      return ctx.editMessageText(
        `Подтвердите запись:\n\n${buildSummary(ctx.session)}`,
        kb.confirmKeyboard()
      );
    }

    ctx.session.step = 'awaiting_name';
    await ctx.editMessageText('📝 Введите ваше имя:');
  });

  // ─── Ввод текста ─────────────────────────────────────────
  bot.on('text', async ctx => {
    if (ctx.session.step === 'awaiting_name') {
      ctx.session.clientName = ctx.message.text.trim();
      ctx.session.step = 'awaiting_phone';
      return ctx.reply('📞 Введите ваш номер телефона:');
    }

    if (ctx.session.step === 'awaiting_phone') {
      ctx.session.clientPhone = ctx.message.text.trim();
      ctx.session.step = 'confirming';
      return ctx.reply(
        `Подтвердите запись:\n\n${buildSummary(ctx.session)}`,
        kb.confirmKeyboard()
      );
    }

    // AI-ассистент — отвечает на все остальные вопросы
    try {
      await ctx.sendChatAction('typing');
      if (!ctx.session.aiHistory) ctx.session.aiHistory = [];
      const answer = await ai.askAI(ctx.message.text, ctx.session.aiHistory);
      ctx.session.aiHistory.push({ role: 'user', content: ctx.message.text });
      ctx.session.aiHistory.push({ role: 'assistant', content: answer });
      if (ctx.session.aiHistory.length > 20) {
        ctx.session.aiHistory = ctx.session.aiHistory.slice(-20);
      }
      await ctx.reply(answer);
    } catch (e) {
      console.error('Ошибка AI:', e.message);
      await ctx.reply('⚠️ Не могу ответить прямо сейчас. Напишите /start чтобы записаться.');
    }
  });

  // ─── Подтверждение ───────────────────────────────────────
  bot.action('confirm:yes', async ctx => {
    await ctx.answerCbQuery('Записываем...');

    const result = await booking.createAppointment({
      masterId:    ctx.session.masterId,
      serviceId:   ctx.session.serviceId,
      clientName:  ctx.session.clientName,
      clientPhone: ctx.session.clientPhone,
      date:        ctx.session.date,
      time:        ctx.session.time,
      telegramId:  ctx.from.id,
    });

    if (!result.success) {
      const slots = await booking.getAvailableSlots(
        ctx.session.serviceId,
        ctx.session.masterId,
        ctx.session.date
      );

      if (!slots.length) {
        await ctx.editMessageText(
          '⚠️ Это время только что заняли, и других слотов нет.\n\nВыберите другую дату:',
          kb.datesKeyboard()
        );
      } else {
        await ctx.editMessageText(
          '⚠️ Это время только что заняли. Выберите другое:',
          kb.slotsKeyboard(slots)
        );
      }
      ctx.session.step = null;
      return;
    }

    await ctx.editMessageText(
      `✅ Вы записаны!\n\n${buildSummary(ctx.session)}\n\nДо встречи! 💅`
    );

    await notifyAdmin(bot, ctx.session);

    // Записываем в Google Sheets
    try {
      const allServices = await booking.getServices();
      const allMasters  = await booking.getMasters();
      const service = allServices.find(s => s.id === ctx.session.serviceId);
      const master  = allMasters.find(m => m.id === ctx.session.masterId);

      await sheets.appendRow({
        clientName:  ctx.session.clientName,
        clientPhone: ctx.session.clientPhone,
        date:        ctx.session.date,
        time:        ctx.session.time,
        serviceName: service ? service.name : '',
        masterName:  master  ? master.name  : '',
      });
    } catch (e) {
      console.error('Ошибка Google Sheets:', e.message);
    }

    ctx.session = {};
  });

  // ─── Отмена ──────────────────────────────────────────────
  bot.action('confirm:no', async ctx => {
    ctx.session = {};
    const services = await booking.getServices();
    await ctx.editMessageText(
      '❌ Запись отменена.\n\nВыберите услугу, чтобы начать заново:',
      kb.servicesKeyboard(services)
    );
  });
}

// ─── Хелперы ─────────────────────────────────────────────

function buildSummary(session) {
  return (
    '━━━━━━━━━━━━━━\n' +
    `📅 Дата: ${formatDate(session.date)}\n` +
    `🕐 Время: ${session.time}\n` +
    `👤 Имя: ${session.clientName}\n` +
    `📞 Телефон: ${session.clientPhone}\n` +
    '━━━━━━━━━━━━━━'
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

async function notifyAdmin(bot, session) {
  const adminId = process.env.ADMIN_CHAT_ID;
  if (!adminId) return;

  const text =
    '🔔 <b>Новая запись!</b>\n\n' +
    `👤 ${session.clientName}\n` +
    `📞 ${session.clientPhone}\n` +
    `📅 ${formatDate(session.date)}, ${session.time}`;

  await bot.telegram.sendMessage(adminId, text, { parse_mode: 'HTML' });
}

module.exports = { register };