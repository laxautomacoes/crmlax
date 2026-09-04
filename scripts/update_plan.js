const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('*').ilike('name', '%leoacosta%');
  console.log("Tenants found:", tenants);
  
  if (tenants && tenants.length > 0) {
    const tenantId = tenants[0].id;
    console.log("Updating tenant plan for ID:", tenantId);
    
    // Check if tenants table has a plan_type or something similar
    const { error: updateErr } = await supabase.from('tenants').update({ plan: 'pro' }).eq('id', tenantId);
    if (updateErr) {
        console.log("Could not update plan directly on tenants:", updateErr.message);
        // Let's try plan_type
        const { error: updateErr2 } = await supabase.from('tenants').update({ plan_type: 'pro' }).eq('id', tenantId);
        if (updateErr2) console.log("Also could not update plan_type:", updateErr2.message);
    } else {
        console.log("Updated tenant plan to 'pro'.");
    }
    
    // Let's see the plan_limits table
    const { data: limits } = await supabase.from('plan_limits').select('*');
    console.log("Plan limits:", limits);
  } else {
    // try to find by profile email
    console.log("Trying to find profile by email");
    const { data: profiles } = await supabase.from('profiles').select('*').ilike('email', '%leoacosta%');
    console.log("Profiles found:", profiles);
    if (profiles && profiles.length > 0) {
        const tenantId = profiles[0].tenant_id;
        console.log("Updating tenant plan for ID:", tenantId, "via profile");
        const { error: updateErr } = await supabase.from('tenants').update({ plan: 'pro' }).eq('id', tenantId);
        if (updateErr) {
            console.log("Error updating tenant plan:", updateErr.message);
        } else {
            console.log("Updated tenant plan to 'pro'.");
        }
    }
  }
}
run();
