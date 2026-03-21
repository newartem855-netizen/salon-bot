const { createClient } = require('@supabase/supabase-js');

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'MISSING');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'OK' : 'MISSING');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'OK' : 'MISSING');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = supabase;