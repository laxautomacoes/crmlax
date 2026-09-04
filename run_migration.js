const https = require('https');
const fs = require('fs');

const SUPABASE_URL = 'https://vkrpmxratnkywywqoecv.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = fs.readFileSync('./supabase/migrations/20260901145700_add_funnels_support.sql', 'utf8');

const url = new URL(SUPABASE_URL + '/rest/v1/rpc/');

// Use the pg_net or direct SQL approach via supabase-js
// Actually, let's use the Management API approach via fetch

async function runSQL() {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        db: { schema: 'public' },
        auth: { persistSession: false }
    });

    // Split SQL into individual statements and run them
    // First, let's try using the Supabase SQL endpoint directly
    const response = await fetch(`${SUPABASE_URL}/pg`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
        console.log('pg endpoint failed, trying alternative...');
        // Try the sql endpoint
        const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'apikey': SERVICE_ROLE_KEY
            },
            body: JSON.stringify({ query: sql })
        });
        console.log('Alt status:', resp2.status, await resp2.text());
    } else {
        const data = await response.json();
        console.log('Success:', JSON.stringify(data).slice(0, 500));
    }
}

runSQL().catch(e => console.error('Error:', e.message));
