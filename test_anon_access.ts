import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function test() {
  const { data, error } = await supabase
    .from('ticket_profiles')
    .select(`
      id, name, price,
      tickets!inner(count)
    `)
    .limit(1);
  console.log('Error:', error);
}
test();
