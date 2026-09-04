const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/supabase/database.types.ts');
let content = fs.readFileSync(file, 'utf8');

const funnelsDef = `      funnels: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_index?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }\n`;

if (!content.includes('funnels: {')) {
  content = content.replace('      integrations: {', funnelsDef + '      integrations: {');
}

content = content.replace(
  'name: string\n          order_index: number\n          tenant_id: string | null',
  'funnel_id: string | null\n          name: string\n          order_index: number\n          tenant_id: string | null'
);
content = content.replace(
  'name: string\n          order_index?: number\n          tenant_id?: string | null',
  'funnel_id?: string | null\n          name: string\n          order_index?: number\n          tenant_id?: string | null'
);
content = content.replace(
  'name?: string\n          order_index?: number\n          tenant_id?: string | null',
  'funnel_id?: string | null\n          name?: string\n          order_index?: number\n          tenant_id?: string | null'
);

const relStr = `          {
            foreignKeyName: "lead_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },`;
const newRelStr = `          {
            foreignKeyName: "lead_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },\n` + relStr;

if (!content.includes('lead_stages_funnel_id_fkey')) {
  content = content.replace(relStr, newRelStr);
}

content = content.replace(
  'is_highlighted: boolean | null\n          max_assets: number | null',
  'is_highlighted: boolean | null\n          max_assets: number | null\n          max_funnels: number | null'
);
content = content.replace(
  'is_highlighted?: boolean | null\n          max_assets?: number | null',
  'is_highlighted?: boolean | null\n          max_assets?: number | null\n          max_funnels?: number | null'
);

fs.writeFileSync(file, content);
console.log('patched');
