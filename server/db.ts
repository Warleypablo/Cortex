import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('[database] Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });
export { schema };

export async function initializeNotificationsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.notifications (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        priority TEXT DEFAULT 'medium',
        read BOOLEAN DEFAULT false,
        dismissed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        unique_key TEXT UNIQUE
      )
    `);
    
    // Add priority column if not exists (for existing tables)
    await db.execute(sql`
      ALTER TABLE staging.notifications 
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    `);
    
    console.log('[database] Notifications table initialized');
  } catch (error) {
    console.error('[database] Error initializing notifications table:', error);
  }
}

export async function initializeSystemFieldOptionsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_field_options (
        id SERIAL PRIMARY KEY,
        field_type TEXT NOT NULL,
        value TEXT NOT NULL,
        label TEXT NOT NULL,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(field_type, value)
      )
    `);
    console.log('[database] System field options table initialized');
  } catch (error) {
    console.error('[database] Error initializing system field options table:', error);
  }
}

export async function initializeNotificationRulesTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_rules (
        id SERIAL PRIMARY KEY,
        rule_type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_enabled BOOLEAN DEFAULT true,
        config TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[database] Notification rules table initialized');
    
    // Seed default rules if table is empty
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM notification_rules`);
    const count = Number((countResult.rows[0] as any)?.count || 0);
    
    if (count === 0) {
      const defaultRules = [
        {
          ruleType: 'inadimplencia',
          name: 'Inadimplência (+7 dias)',
          description: 'Alerta quando um cliente está com pagamento em atraso por mais de 7 dias',
          config: JSON.stringify({ minDaysOverdue: 7, minValue: 0 })
        },
        {
          ruleType: 'contrato_vencendo',
          name: 'Contrato Vencendo (30 dias)',
          description: 'Alerta quando um contrato está próximo do vencimento (30 dias)',
          config: JSON.stringify({ daysBeforeExpiry: 30 })
        },
        {
          ruleType: 'aniversario',
          name: 'Aniversário de Colaborador',
          description: 'Alerta quando é aniversário de um colaborador',
          config: JSON.stringify({ enabled: true })
        }
      ];
      
      for (const rule of defaultRules) {
        await db.execute(sql`
          INSERT INTO notification_rules (rule_type, name, description, is_enabled, config)
          VALUES (${rule.ruleType}, ${rule.name}, ${rule.description}, true, ${rule.config})
        `);
      }
      console.log('[database] Default notification rules seeded');
    }
  } catch (error) {
    console.error('[database] Error initializing notification rules table:', error);
  }
}

export async function initializeOnboardingTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS onboarding_templates (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        descricao TEXT,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS onboarding_etapas (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL,
        nome VARCHAR(100) NOT NULL,
        ordem INTEGER NOT NULL,
        descricao TEXT,
        responsavel_padrao VARCHAR(100),
        prazo_dias INTEGER
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS onboarding_colaborador (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        data_inicio DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS onboarding_progresso (
        id SERIAL PRIMARY KEY,
        onboarding_colaborador_id INTEGER NOT NULL,
        etapa_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        responsavel_id INTEGER,
        data_conclusao TIMESTAMP,
        observacoes TEXT
      )
    `);
    
    console.log('[database] Onboarding tables initialized');
  } catch (error) {
    console.error('[database] Error initializing onboarding tables:', error);
  }
}

export async function initializeCatalogTables(): Promise<void> {
  try {
    // catalog_products
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_products (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        bp_segment VARCHAR(50),
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // catalog_plans
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_plans (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // catalog_squads
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_squads (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_off BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // catalog_clusters
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_clusters (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // catalog_contract_status
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_contract_status (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        counts_as_operating BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // catalog_account_health
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_account_health (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // catalog_roi_bucket
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_roi_bucket (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // catalog_churn_reason
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_churn_reason (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('[database] Catalog tables created');

    // Seed catalog_products
    const products = [
      { slug: 'performance', name: 'Performance', bp_segment: 'performance', sort_order: 10 },
      { slug: 'creators', name: 'Creators', bp_segment: 'creators', sort_order: 20 },
      { slug: 'social_media', name: 'Social Media', bp_segment: 'social', sort_order: 30 },
      { slug: 'gestao_comunidade', name: 'Gestão de Comunidade', bp_segment: 'community', sort_order: 40 },
      { slug: 'agente_ia', name: 'Agente IA', bp_segment: 'others', sort_order: 100 },
      { slug: 'blog_post', name: 'Blog Post', bp_segment: 'others', sort_order: 110 },
      { slug: 'broadcast', name: 'Broadcast', bp_segment: 'others', sort_order: 120 },
      { slug: 'crm_vendas', name: 'CRM de Vendas', bp_segment: 'others', sort_order: 130 },
      { slug: 'cro_alteracao', name: 'CRO & Alteração', bp_segment: 'others', sort_order: 140 },
      { slug: 'dashboard', name: 'Dashboard', bp_segment: 'others', sort_order: 150 },
      { slug: 'ecommerce', name: 'Ecommerce', bp_segment: 'others', sort_order: 160 },
      { slug: 'estruturacao_comercial', name: 'Estruturação Comercial', bp_segment: 'others', sort_order: 170 },
      { slug: 'estruturacao_estrategica', name: 'Estruturação Estratégica', bp_segment: 'others', sort_order: 180 },
      { slug: 'gameplan', name: 'Gameplan', bp_segment: 'others', sort_order: 190 },
      { slug: 'gestao_atendimento', name: 'Gestão & Atendimento', bp_segment: 'others', sort_order: 200 },
      { slug: 'id_visual', name: 'ID Visual', bp_segment: 'others', sort_order: 210 },
      { slug: 'landing_page', name: 'Landing Page', bp_segment: 'others', sort_order: 220 },
      { slug: 'pacote_artes_rotulos', name: 'Pacote Artes / Rótulos', bp_segment: 'others', sort_order: 230 },
      { slug: 'regua_automacao', name: 'Régua de Automação', bp_segment: 'others', sort_order: 240 },
      { slug: 'seo_full', name: 'SEO Full', bp_segment: 'others', sort_order: 250 },
      { slug: 'site', name: 'Site', bp_segment: 'others', sort_order: 260 },
      { slug: 'sustentacao', name: 'Sustentação', bp_segment: 'others', sort_order: 270 },
    ];
    for (const p of products) {
      await db.execute(sql`
        INSERT INTO catalog_products (slug, name, bp_segment, sort_order)
        VALUES (${p.slug}, ${p.name}, ${p.bp_segment}, ${p.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    // Seed catalog_plans
    const plans = [
      { slug: 'starter', name: 'Starter', sort_order: 10 },
      { slug: 'scale', name: 'Scale', sort_order: 20 },
      { slug: 'enterprise', name: 'Enterprise', sort_order: 30 },
      { slug: 'personalizado', name: 'Personalizado', sort_order: 40 },
      { slug: 'projeto_pontual', name: 'Projeto Pontual', sort_order: 50 },
      { slug: 'antigo', name: 'Antigo (Legado)', sort_order: 999 },
    ];
    for (const p of plans) {
      await db.execute(sql`
        INSERT INTO catalog_plans (slug, name, sort_order)
        VALUES (${p.slug}, ${p.name}, ${p.sort_order})
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      `);
    }

    // Seed catalog_squads
    const squads = [
      { slug: 'squadra', name: 'Squadra', is_off: false, sort_order: 10 },
      { slug: 'makers', name: 'Makers', is_off: false, sort_order: 20 },
      { slug: 'pulse', name: 'Pulse', is_off: false, sort_order: 30 },
      { slug: 'tech', name: 'Tech', is_off: false, sort_order: 40 },
      { slug: 'selva', name: 'Selva', is_off: false, sort_order: 50 },
      { slug: 'hunters', name: 'Hunters', is_off: false, sort_order: 60 },
      { slug: 'supreme', name: 'Supreme', is_off: false, sort_order: 70 },
      { slug: 'squad_x', name: 'Squad X', is_off: false, sort_order: 80 },
      { slug: 'aurea', name: 'Aurea', is_off: false, sort_order: 90 },
      { slug: 'chama', name: 'Chama', is_off: false, sort_order: 100 },
      { slug: 'turbo_interno', name: 'Turbo Interno', is_off: false, sort_order: 110 },
      { slug: 'bloomfield', name: 'Bloomfield', is_off: false, sort_order: 120 },
    ];
    for (const s of squads) {
      await db.execute(sql`
        INSERT INTO catalog_squads (slug, name, is_off, sort_order)
        VALUES (${s.slug}, ${s.name}, ${s.is_off}, ${s.sort_order})
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      `);
    }

    // Seed catalog_clusters
    const clusters = [
      { slug: 'regulares', name: 'Regulares', sort_order: 10 },
      { slug: 'imperdiveis', name: 'Imperdíveis', sort_order: 20 },
      { slug: 'chaves', name: 'Chaves', sort_order: 30 },
      { slug: 'nfnc', name: 'NFNC', sort_order: 40 },
      { slug: 'empty', name: 'Empty', sort_order: 999 },
    ];
    for (const c of clusters) {
      await db.execute(sql`
        INSERT INTO catalog_clusters (slug, name, sort_order)
        VALUES (${c.slug}, ${c.name}, ${c.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    // Seed catalog_contract_status
    const statuses = [
      { slug: 'triagem', name: 'TRIAGEM', counts_as_operating: false, sort_order: 10 },
      { slug: 'onboarding', name: 'ONBOARDING', counts_as_operating: false, sort_order: 20 },
      { slug: 'ativo', name: 'ATIVO', counts_as_operating: true, sort_order: 30 },
      { slug: 'pausado', name: 'PAUSADO', counts_as_operating: false, sort_order: 40 },
      { slug: 'em_cancelamento', name: 'EM CANCELAMENTO', counts_as_operating: true, sort_order: 50 },
      { slug: 'entregue', name: 'ENTREGUE', counts_as_operating: false, sort_order: 60 },
      { slug: 'cancelado', name: 'CANCELADO', counts_as_operating: false, sort_order: 70 },
    ];
    for (const s of statuses) {
      await db.execute(sql`
        INSERT INTO catalog_contract_status (slug, name, counts_as_operating, sort_order)
        VALUES (${s.slug}, ${s.name}, ${s.counts_as_operating}, ${s.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    // Seed catalog_account_health
    const healthOptions = [
      { slug: 'saudavel', name: 'Saudável', sort_order: 10 },
      { slug: 'atencao', name: 'Atenção', sort_order: 20 },
      { slug: 'insatisfeito', name: 'Insatisfeito', sort_order: 30 },
    ];
    for (const h of healthOptions) {
      await db.execute(sql`
        INSERT INTO catalog_account_health (slug, name, sort_order)
        VALUES (${h.slug}, ${h.name}, ${h.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    // Seed catalog_roi_bucket
    const roiBuckets = [
      { slug: 'lt_2', name: 'ROI < 2', sort_order: 10 },
      { slug: 'btw_2_4', name: 'ROI 2–4', sort_order: 20 },
      { slug: 'gt_4', name: 'ROI > 4', sort_order: 30 },
      { slug: 'no_data', name: 'Sem dado', sort_order: 999 },
    ];
    for (const r of roiBuckets) {
      await db.execute(sql`
        INSERT INTO catalog_roi_bucket (slug, name, sort_order)
        VALUES (${r.slug}, ${r.name}, ${r.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    // Seed catalog_churn_reason
    const churnReasons = [
      { slug: 'resultado_fraco', name: 'Resultado fraco / ROI', sort_order: 10 },
      { slug: 'falta_verba', name: 'Falta de verba', sort_order: 20 },
      { slug: 'in_house', name: 'Contratou in-house / troca interna', sort_order: 30 },
      { slug: 'concorrente', name: 'Troca por concorrente', sort_order: 40 },
      { slug: 'qualidade_entrega', name: 'Problemas de entrega / qualidade', sort_order: 50 },
      { slug: 'comunicacao', name: 'Problemas de comunicação', sort_order: 60 },
      { slug: 'timing', name: 'Timing / pausa estratégica', sort_order: 70 },
      { slug: 'inadimplencia', name: 'Inadimplência', sort_order: 80 },
      { slug: 'outros', name: 'Outros', sort_order: 999 },
    ];
    for (const c of churnReasons) {
      await db.execute(sql`
        INSERT INTO catalog_churn_reason (slug, name, sort_order)
        VALUES (${c.slug}, ${c.name}, ${c.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    console.log('[database] Catalog tables initialized and seeded');
  } catch (error) {
    console.error('[database] Error initializing catalog tables:', error);
  }
}

export async function initializeSystemFieldsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_fields (
        id SERIAL PRIMARY KEY,
        field_key VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        required BOOLEAN DEFAULT false,
        default_value TEXT,
        enum_catalog VARCHAR(100),
        validation_rules JSONB,
        help_text TEXT,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[database] System fields table created');

    const clientFields = [
      { field_key: 'client.name', label: 'Nome do Cliente', entity: 'client', field_type: 'string', required: true, default_value: null, enum_catalog: null, help_text: 'Nome oficial do cliente', sort_order: 10 },
      { field_key: 'client.cluster_slug', label: 'Cluster', entity: 'client', field_type: 'enum', required: true, default_value: 'regulares', enum_catalog: 'catalog_clusters', help_text: null, sort_order: 20 },
      { field_key: 'client.health_status_slug', label: 'Status da Conta', entity: 'client', field_type: 'enum', required: false, default_value: 'atencao', enum_catalog: 'catalog_account_health', help_text: null, sort_order: 30 },
      { field_key: 'client.cnpj', label: 'CNPJ', entity: 'client', field_type: 'string', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 40 },
      { field_key: 'client.contact_name', label: 'Pessoa de Contato', entity: 'client', field_type: 'string', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 50 },
      { field_key: 'client.contact_phone', label: 'Telefone de Contato', entity: 'client', field_type: 'string', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 60 },
      { field_key: 'client.email', label: 'E-mail', entity: 'client', field_type: 'string', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 70 },
      { field_key: 'client.instagram', label: 'Instagram', entity: 'client', field_type: 'string', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 80 },
      { field_key: 'client.site', label: 'Site', entity: 'client', field_type: 'string', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 90 },
      { field_key: 'client.notes', label: 'Observações', entity: 'client', field_type: 'text', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 100 },
    ];

    const contractFields = [
      { field_key: 'contract.client_id', label: 'Cliente', entity: 'contract', field_type: 'string', required: true, default_value: null, enum_catalog: null, help_text: 'FK para client.id', sort_order: 10 },
      { field_key: 'contract.product_slug', label: 'Produto', entity: 'contract', field_type: 'enum', required: true, default_value: null, enum_catalog: 'catalog_products', help_text: null, sort_order: 20 },
      { field_key: 'contract.plan_slug', label: 'Plano', entity: 'contract', field_type: 'enum', required: true, default_value: null, enum_catalog: 'catalog_plans', help_text: null, sort_order: 30 },
      { field_key: 'contract.squad_slug', label: 'Squad', entity: 'contract', field_type: 'enum', required: true, default_value: null, enum_catalog: 'catalog_squads', help_text: null, sort_order: 40 },
      { field_key: 'contract.status_slug', label: 'Status do Contrato', entity: 'contract', field_type: 'enum', required: true, default_value: null, enum_catalog: 'catalog_contract_status', help_text: null, sort_order: 50 },
      { field_key: 'contract.mrr_value_cents', label: 'Valor Recorrente (MRR)', entity: 'contract', field_type: 'currency_cents', required: false, default_value: '0', enum_catalog: null, help_text: null, sort_order: 60 },
      { field_key: 'contract.one_time_value_cents', label: 'Valor Pontual', entity: 'contract', field_type: 'currency_cents', required: false, default_value: '0', enum_catalog: null, help_text: null, sort_order: 70 },
      { field_key: 'contract.first_payment_at', label: 'Data 1º Pagamento', entity: 'contract', field_type: 'date', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 80 },
      { field_key: 'contract.cancel_request_at', label: 'Data Solicitação de Encerramento', entity: 'contract', field_type: 'date', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 90 },
      { field_key: 'contract.last_operation_day', label: 'Último Dia de Operação', entity: 'contract', field_type: 'date', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 100 },
      { field_key: 'contract.pause_at', label: 'Data de Pausa', entity: 'contract', field_type: 'date', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 110 },
      { field_key: 'contract.resume_at', label: 'Data de Retorno', entity: 'contract', field_type: 'date', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 120 },
      { field_key: 'contract.delivered_at', label: 'Data de Entrega (Pontual)', entity: 'contract', field_type: 'date', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 130 },
      { field_key: 'contract.sales_owner_user_id', label: 'Vendedor', entity: 'contract', field_type: 'user_ref', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 140 },
      { field_key: 'contract.cs_owner_user_id', label: 'CS Responsável', entity: 'contract', field_type: 'user_ref', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 150 },
      { field_key: 'contract.delivery_owner_user_id', label: 'Responsável Entrega', entity: 'contract', field_type: 'user_ref', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 160 },
      { field_key: 'contract.designer_owner_user_id', label: 'Designer Responsável', entity: 'contract', field_type: 'user_ref', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 170 },
      { field_key: 'contract.ads_investment_cents_monthly', label: 'Investimento ADS (Mensal)', entity: 'contract', field_type: 'currency_cents', required: false, default_value: '0', enum_catalog: null, help_text: null, sort_order: 180 },
      { field_key: 'contract.client_revenue_cents_monthly', label: 'Faturamento Cliente (Mensal)', entity: 'contract', field_type: 'currency_cents', required: false, default_value: '0', enum_catalog: null, help_text: null, sort_order: 190 },
      { field_key: 'contract.churn_reason_slug', label: 'Motivo do Cancelamento', entity: 'contract', field_type: 'enum', required: false, default_value: null, enum_catalog: 'catalog_churn_reason', help_text: null, sort_order: 200 },
      { field_key: 'contract.churn_subreason', label: 'Submotivo do Cancelamento', entity: 'contract', field_type: 'text', required: false, default_value: null, enum_catalog: null, help_text: null, sort_order: 210 },
    ];

    const allFields = [...clientFields, ...contractFields];

    for (const f of allFields) {
      await db.execute(sql`
        INSERT INTO system_fields (field_key, label, entity, field_type, required, default_value, enum_catalog, help_text, sort_order)
        VALUES (${f.field_key}, ${f.label}, ${f.entity}, ${f.field_type}, ${f.required}, ${f.default_value}, ${f.enum_catalog}, ${f.help_text}, ${f.sort_order})
        ON CONFLICT (field_key) DO NOTHING
      `);
    }

    console.log('[database] System fields table initialized and seeded');
  } catch (error) {
    console.error('[database] Error initializing system fields table:', error);
  }
}
