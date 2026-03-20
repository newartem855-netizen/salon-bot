require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const handlers = require('./handlers');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Сессия хранит состояние диалога каждого пользователя
bot.use(session({ defaultSession: () => ({}) }));

// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
  ctx.reply('⚠️ Что-то пошло не так. Напишите /start чтобы начать заново.');
});

// Регистрируем все хендлеры
handlers.register(bot);

// Запуск
bot.launch().then(() => {
  console.log('✅ Бот запущен');
});

// Graceful stop
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
