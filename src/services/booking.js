const supabase = require('./supabase');

async function getServices() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, duration_min, price')
    .order('name');
  if (error) throw error;
  return data;
}

async function getMasters(serviceId) {
  const { data, error } = await supabase
    .from('masters')
    .select('id, name, specialization');
  if (error) throw error;
  return data;
}

async function getAvailableSlots(serviceId, masterId, date) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_service_id: serviceId,
    p_master_id:  masterId,
    p_date:       date
  });
  if (error) throw error;
  return data;
}

async function getClient(telegramId) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function saveClient({ telegramId, firstName, phone }) {
  const { error } = await supabase
    .from('clients')
    .upsert({
      telegram_id: telegramId,
      first_name:  firstName,
      phone:       phone
    }, { onConflict: 'telegram_id' });
  if (error) throw error;
}

// Автоматически добавляет расписание на 14 дней вперёд
async function ensureSchedule() {
  const { data: masters, error } = await supabase
    .from('masters')
    .select('id');
  if (error) throw error;

  for (const master of masters) {
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);

      await supabase
        .from('master_schedule')
        .upsert({
          master_id:  master.id,
          work_date:  dateStr,
          start_time: '10:00',
          end_time:   '19:00'
        }, { onConflict: 'master_id,work_date' });
    }
  }
}

async function createAppointment({ masterId, serviceId, clientName, clientPhone, date, time, telegramId }) {
  const timeWithSeconds = time.length === 5 ? time + ':00' : time;

  const slots = await getAvailableSlots(serviceId, masterId, date);
  const isAvailable = slots.some(s => {
    const slotTime = s.slot_start.slice(11, 16);
    return slotTime === time;
  });

  if (!isAvailable) {
    return { success: false, reason: 'taken' };
  }

  if (telegramId) {
    await saveClient({ telegramId, firstName: clientName, phone: clientPhone });
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      master_id:    masterId,
      service_id:   serviceId,
      client_name:  clientName,
      client_phone: clientPhone,
      appt_date:    date,
      appt_time:    timeWithSeconds,
      status:       'booked'
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return { success: false, reason: 'taken' };
    throw error;
  }

  return { success: true, appointment: data };
}

module.exports = { getServices, getMasters, getAvailableSlots, getClient, saveClient, ensureSchedule, createAppointment };