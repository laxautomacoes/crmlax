-- Migration: Add support for multiple funnels (Kanbans) per tenant

-- 1. Create the funnels table
CREATE TABLE IF NOT EXISTS public.funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS and add policies
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funnels are tenant isolated" ON public.funnels
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 3. Add max_funnels to plan_limits
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS max_funnels INTEGER DEFAULT 1;

-- Set specific limits based on plan type
UPDATE public.plan_limits SET max_funnels = 2 WHERE plan_type = 'freemium' OR display_name ILIKE '%free%';
UPDATE public.plan_limits SET max_funnels = 5 WHERE plan_type = 'starter' OR display_name ILIKE '%starter%';
UPDATE public.plan_limits SET max_funnels = 10 WHERE plan_type = 'pro' OR display_name ILIKE '%pro%';

-- 4. Add funnel_id to lead_stages
ALTER TABLE public.lead_stages ADD COLUMN IF NOT EXISTS funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE;

-- 5. Data Migration: Create default funnels and assign existing stages
DO $$
DECLARE
    t RECORD;
    new_funnel_id UUID;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        -- Check if tenant already has a default funnel to prevent duplicates if migration is rerun
        SELECT id INTO new_funnel_id FROM public.funnels WHERE tenant_id = t.id AND name = 'Funil Padrão' LIMIT 1;
        
        IF new_funnel_id IS NULL THEN
            INSERT INTO public.funnels (tenant_id, name, order_index)
            VALUES (t.id, 'Funil Padrão', 0)
            RETURNING id INTO new_funnel_id;
        END IF;

        -- Update lead_stages to belong to this new funnel if they don't have one
        UPDATE public.lead_stages SET funnel_id = new_funnel_id WHERE tenant_id = t.id AND funnel_id IS NULL;
    END LOOP;
END $$;
