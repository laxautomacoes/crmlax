const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  console.log("Updating max_funnels for business and enterprise plans...");
  
  const { error: err1 } = await supabase.from('plan_limits').update({ max_funnels: 999 }).eq('plan_type', 'enterprise');
  if (err1) console.error("Error updating enterprise:", err1);
  else console.log("Enterprise plan max_funnels updated to 999.");
  
  const { error: err2 } = await supabase.from('plan_limits').update({ max_funnels: 999 }).eq('plan_type', 'business');
  if (err2) console.error("Error updating business:", err2);
  else console.log("Business plan max_funnels updated to 999.");
  
  // Reload schema cache just in case, though not needed for data updates
  await supabase.rpc('exec_migration_sql', { query: "NOTIFY pgrst, 'reload schema';" });
}
run();
