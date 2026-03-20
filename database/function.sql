-- Запустите этот SQL в Supabase SQL Editor
-- Создаёт функцию которую вызывает бот

CREATE OR REPLACE FUNCTION get_available_slots(
  p_service_id INT,
  p_master_id  INT,
  p_date       DATE
)
RETURNS TABLE(slot_start TIMESTAMP, slot_end TIMESTAMP) AS $$
WITH
svc AS (
  SELECT duration_min FROM services WHERE id = p_service_id
),
slots AS (
  SELECT DISTINCT
    ms.master_id,
    slot::timestamp AS slot_start,
    slot::timestamp + (svc.duration_min || ' minutes')::interval AS slot_end
  FROM master_schedule ms
  CROSS JOIN svc
  CROSS JOIN LATERAL generate_series(
    (p_date || ' ' || ms.start_time)::timestamp,
    (p_date || ' ' || ms.end_time)::timestamp
      - (svc.duration_min || ' minutes')::interval,
    '30 minutes'
  ) AS slot
  WHERE ms.work_date = p_date
    AND ms.master_id = p_master_id
)
SELECT s.slot_start, s.slot_end
FROM slots s
WHERE NOT EXISTS (
  SELECT 1
  FROM appointments a
  JOIN services sv ON sv.id = a.service_id
  WHERE a.master_id  = p_master_id
    AND a.appt_date  = p_date
    AND a.status    != 'cancelled'
    AND s.slot_start < a.appt_time::timestamp + (sv.duration_min || ' minutes')::interval
    AND s.slot_end   > a.appt_time::timestamp
)
ORDER BY s.slot_start;
$$ LANGUAGE sql STABLE;


-- Уникальный индекс — защита от гонки
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS uq_master_slot;

ALTER TABLE appointments
  ADD CONSTRAINT uq_master_slot
  UNIQUE (master_id, appt_date, appt_time);


-- Индексы для скорости
CREATE INDEX IF NOT EXISTS idx_appointments_master_date
  ON appointments (master_id, appt_date)
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_schedule_master_date
  ON master_schedule (master_id, work_date);
