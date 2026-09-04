/**
 * Script para aplicar a migration de funnels diretamente no Supabase
 * Usa a Supabase Management API com o service role key
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const migrationPath = path.join(__dirname, '../supabase/migrations/20260901145700_add_funnels_support.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('Aplicando migration: add_funnels_support...\n');

  // Verificar se a tabela já existe
  const { error: tableError } = await supabase.from('funnels').select('id').limit(1);

  if (!tableError) {
    console.log('✅ Tabela funnels já existe! Migration não é necessária.');
    // Apenas garante que o cache de schemas está atualizado
    await supabase.rpc('exec_migration_sql', { query: "NOTIFY pgrst, 'reload schema';" });
    return;
  }

  console.log('Tabela não encontrada, executando script SQL via RPC...');

  // Tentar executar via RPC
  const { error: rpcError } = await supabase.rpc('exec_migration_sql', { query: sql });

  if (rpcError) {
    if (rpcError.message.includes('Could not find the function') || rpcError.message.includes('exec_migration_sql')) {
      console.log('\n❌ ERRO: A função RPC "exec_migration_sql" não existe no seu banco de dados.');
      console.log('\n======================================================');
      console.log('⚠️  AÇÃO ÚNICA NECESSÁRIA NO SUPABASE DASHBOARD ⚠️');
      console.log('======================================================');
      console.log('Para nunca mais ter que inserir SQL manualmente, você precisa');
      console.log('criar uma função RPC (uma única vez) que permita que scripts');
      console.log('rodem SQL de forma segura usando a chave de Service Role.\n');
      console.log('Acesse: https://supabase.com/dashboard/project/vkrpmxratnkywywqoecv/editor');
      console.log('E rode o seguinte comando UMA ÚNICA VEZ:\n');
      console.log(`CREATE OR REPLACE FUNCTION exec_migration_sql(query text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE query;
END;
$$;

REVOKE EXECUTE ON FUNCTION exec_migration_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION exec_migration_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION exec_migration_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION exec_migration_sql(text) TO service_role;`);
      console.log('\n======================================================');
      console.log('Após rodar isso no painel, execute este script novamente e ele aplicará a migration automaticamente!');
    } else {
      console.error('❌ Erro ao rodar a migration:', rpcError);
    }
    return;
  }

  // Recarregar o cache do schema
  await supabase.rpc('exec_migration_sql', { query: "NOTIFY pgrst, 'reload schema';" });
  console.log('✅ Migration aplicada com sucesso!');
}

runMigration().catch(e => {
  console.error('Erro:', e.message);
});

