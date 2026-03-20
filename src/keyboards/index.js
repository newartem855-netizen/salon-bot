const { Markup } = require('telegraf');

function servicesKeyboard(services) {
  const buttons = services.map(s =>
    [Markup.button.callback(
      `${s.name} — ${s.price} ₽ (${s.duration_min} мин)`,
      `service:${s.id}:${s.duration_min}`
    )]
  );
  return Markup.inlineKeyboard(buttons);
}

function mastersKeyboard(masters) {
  const buttons = masters.map(m =>
    [Markup.button.callback(
      `${m.name} — ${m.specialization}`,
      `master:${m.id}`
    )]
  );
  return Markup.inlineKeyboard(buttons);
}

function datesKeyboard() {
  const buttons = [];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('ru-RU', {
      weekday: 'short', day: 'numeric', month: 'long'
    });
    buttons.push([Markup.button.callback(label, `date:${dateStr}`)]);
  }
  return Markup.inlineKeyboard(buttons);
}

function slotsKeyboard(slots) {
  if (!slots.length) return null;
  // Группируем по 3 кнопки в ряд
  const buttons = [];
  const row = [];
  slots.forEach((s, i) => {
    const time = s.slot_start.slice(11, 16); // "HH:MM"
    row.push(Markup.button.callback(time, `slot:${time}`));
    if (row.length === 3 || i === slots.length - 1) {
      buttons.push([...row]);
      row.length = 0;
    }
  });
  return Markup.inlineKeyboard(buttons);
}

function confirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Подтвердить', 'confirm:yes'),
      Markup.button.callback('❌ Отменить',    'confirm:no')
    ]
  ]);
}

module.exports = { servicesKeyboard, mastersKeyboard, datesKeyboard, slotsKeyboard, confirmKeyboard };
