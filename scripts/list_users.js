const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('*');
  console.log("All Tenants:", tenants);
  
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log("All Profiles:", profiles);
  
  const { data: limits } = await supabase.from('plan_limits').select('*');
  console.log("Plan limits:", limits);
}
run();
