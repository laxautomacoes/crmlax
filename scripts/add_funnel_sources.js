const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  console.log('Adicionando colunas allowed_sources e owner_user_id na tabela funnels...\n');

  const sql = `
    ALTER TABLE public.funnels 
    ADD COLUMN IF NOT EXISTS allowed_sources TEXT[] DEFAULT '{}';

    ALTER TABLE public.funnels 
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  `;

  const { error } = await supabase.rpc('exec_migration_sql', { query: sql });

  if (error) {
    console.error('❌ Erro:', error.message);
    return;
  }

  // Recarregar schema cache
  await supabase.rpc('exec_migration_sql', { query: "NOTIFY pgrst, 'reload schema';" });
  console.log('✅ Colunas adicionadas com sucesso!');
}
run();
