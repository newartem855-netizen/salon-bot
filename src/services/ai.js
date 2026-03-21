const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Ты — AI-администратор салона красоты. Твоя задача — отвечать на вопросы клиентов как опытный менеджер.

Информация о салоне:
- Название: Салон красоты
- Время работы: 10:00 - 19:00, ежедневно
- Запись: через этого бота или по телефону

Что ты умеешь:
- Рассказывать об услугах и ценах
- Отвечать на вопросы о мастерах
- Объяснять как записаться
- Отвечать на частые вопросы клиентов

Правила:
- Отвечай вежливо и по-человечески
- Если не знаешь ответа — скажи "уточню у администратора"
- Не отвечай на вопросы не связанные с салоном
- Если клиент хочет записаться — скажи что нужно нажать /start`;

async function askAI(userMessage, history = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 500,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

module.exports = { askAI };