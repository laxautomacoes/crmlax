import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ROTA TEMPORÁRIA PARA MIGRATIONS — REMOVER APÓS USO
export async function POST(request: Request) {
  const secret = request.headers.get('x-migration-secret');
  if (secret !== 'crmlax-migration-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const results: { step: string; success: boolean; error?: string }[] = [];

  const steps = [
    {
      step: 'create_funnels_table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.funnels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          order_index INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    },
    {
      step: 'enable_rls',
      sql: `ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY`,
    },
    {
      step: 'create_policy',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'funnels' AND policyname = 'Funnels are tenant isolated'
          ) THEN
            CREATE POLICY "Funnels are tenant isolated" ON public.funnels
              FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
          END IF;
        END $$
      `,
    },
    {
      step: 'add_max_funnels_column',
      sql: `ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS max_funnels INTEGER DEFAULT 1`,
    },
    {
      step: 'update_plan_limits_freemium',
      sql: `UPDATE public.plan_limits SET max_funnels = 2 WHERE plan_type = 'freemium' OR display_name ILIKE '%free%'`,
    },
    {
      step: 'update_plan_limits_starter',
      sql: `UPDATE public.plan_limits SET max_funnels = 5 WHERE plan_type = 'starter' OR display_name ILIKE '%starter%'`,
    },
    {
      step: 'update_plan_limits_pro',
      sql: `UPDATE public.plan_limits SET max_funnels = 10 WHERE plan_type = 'pro' OR display_name ILIKE '%pro%'`,
    },
    {
      step: 'add_funnel_id_to_lead_stages',
      sql: `ALTER TABLE public.lead_stages ADD COLUMN IF NOT EXISTS funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE`,
    },
    {
      step: 'migrate_existing_data',
      sql: `
        DO $$
        DECLARE
          t RECORD;
          new_funnel_id UUID;
        BEGIN
          FOR t IN SELECT id FROM public.tenants LOOP
            SELECT id INTO new_funnel_id FROM public.funnels WHERE tenant_id = t.id AND name = 'Funil Padrão' LIMIT 1;
            IF new_funnel_id IS NULL THEN
              INSERT INTO public.funnels (tenant_id, name, order_index)
              VALUES (t.id, 'Funil Padrão', 0)
              RETURNING id INTO new_funnel_id;
            END IF;
            UPDATE public.lead_stages SET funnel_id = new_funnel_id WHERE tenant_id = t.id AND funnel_id IS NULL;
          END LOOP;
        END $$
      `,
    },
  ];

  for (const { step, sql } of steps) {
    const { error } = await supabaseAdmin.rpc('exec_migration_sql', { query: sql }).single();
    
    // Se rpc não existir, tentar via from com raw query
    if (error && error.message?.includes('exec_migration_sql')) {
      // Tentar via fetch direto ao endpoint SQL
      const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_migration_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
        body: JSON.stringify({ query: sql }),
      });
      const text = await resp.text();
      results.push({ step, success: resp.ok, error: resp.ok ? undefined : text });
    } else if (error) {
      results.push({ step, success: false, error: error.message });
    } else {
      results.push({ step, success: true });
    }
  }

  return NextResponse.json({ results });
}
