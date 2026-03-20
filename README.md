# Salon Bot — инструкция по запуску

## 1. Supabase — запустить SQL

Откройте Supabase SQL Editor и выполните файл `database/function.sql`

## 2. Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```
BOT_TOKEN=      токен от BotFather
SUPABASE_URL=   https://xxxxxxxx.supabase.co
SUPABASE_KEY=   anon key из Settings → API
ADMIN_CHAT_ID=  ваш Telegram ID (узнать у @userinfobot)
```

## 3. Локальный запуск (для теста)

```bash
npm install
npm run dev
```

## 4. Деплой на Railway

1. Залейте папку на GitHub (новый репозиторий)
2. Зайдите на railway.app → New Project → Deploy from GitHub
3. Выберите репозиторий
4. В разделе Variables добавьте все переменные из .env
5. Railway сам запустит `npm start`

## Как работает бот

```
/start
  → список услуг (кнопки)
  → список мастеров
  → выбор даты (7 дней вперёд)
  → свободные слоты (из Supabase)
  → ввод имени
  → ввод телефона
  → подтверждение
  → запись в appointments
  → уведомление админу
```

## Защита от двойной записи

- Перед записью бот повторно проверяет слот
- Уникальный индекс на (master_id, appt_date, appt_time)
- Если слот занят — бот показывает актуальные свободные слоты
