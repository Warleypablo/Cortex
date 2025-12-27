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

// ============================================================================
// SYS SCHEMA - Canonical layer for catalogs and system fields
// ============================================================================

export async function initializeSysSchema(): Promise<void> {
  try {
    // Create sys schema if not exists
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS sys`);
    console.log('[database] sys schema created');

    // 1. sys.catalogs - catalog definitions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sys.catalogs (
        catalog_key VARCHAR(100) PRIMARY KEY,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. sys.catalog_items - items within catalogs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sys.catalog_items (
        catalog_key VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (catalog_key, slug),
        FOREIGN KEY (catalog_key) REFERENCES sys.catalogs(catalog_key)
      )
    `);

    // 3. sys.catalog_aliases - aliases for mapping raw values to slugs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sys.catalog_aliases (
        catalog_key VARCHAR(100) NOT NULL,
        alias VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (catalog_key, alias),
        FOREIGN KEY (catalog_key, slug) REFERENCES sys.catalog_items(catalog_key, slug)
      )
    `);

    // 4. sys.system_fields - field definitions for entities
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sys.system_fields (
        field_key VARCHAR(100) PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        required BOOLEAN DEFAULT false,
        default_value JSONB,
        enum_catalog VARCHAR(100),
        validation JSONB DEFAULT '{}',
        help_text TEXT,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 5. sys.validation_rules - business validation rules
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sys.validation_rules (
        rule_id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        when_condition JSONB DEFAULT '{}',
        action JSONB DEFAULT '{}',
        message TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('[database] sys schema tables created');

    // Apply spec - UPSERT catalogs
    await applySysCatalogs();
    
    // Generate aliases
    await generateSysAliases();
    
    // Apply system fields to sys schema
    await applySysSystemFields();
    
    // Apply validation rules
    await applySysValidationRules();
    
    // Create canonical view
    await createCanonicalContractsView();

    console.log('[database] sys schema fully initialized');
  } catch (error) {
    console.error('[database] Error initializing sys schema:', error);
  }
}

async function applySysCatalogs(): Promise<void> {
  // Define catalogs
  const catalogs = [
    { catalog_key: 'catalog_products', description: 'Produtos/serviços oferecidos' },
    { catalog_key: 'catalog_plans', description: 'Planos de contrato' },
    { catalog_key: 'catalog_squads', description: 'Squads de atendimento' },
    { catalog_key: 'catalog_clusters', description: 'Clusters de clientes' },
    { catalog_key: 'catalog_contract_status', description: 'Status de contrato' },
    { catalog_key: 'catalog_account_health', description: 'Saúde da conta' },
    { catalog_key: 'catalog_roi_bucket', description: 'Faixas de ROI' },
    { catalog_key: 'catalog_churn_reason', description: 'Motivos de churn' },
  ];

  for (const c of catalogs) {
    await db.execute(sql`
      INSERT INTO sys.catalogs (catalog_key, description, updated_at)
      VALUES (${c.catalog_key}, ${c.description}, NOW())
      ON CONFLICT (catalog_key) DO UPDATE SET 
        description = EXCLUDED.description,
        updated_at = NOW()
    `);
  }

  // Products
  const products = [
    { slug: 'performance', name: 'Performance', meta: { bp_segment: 'performance' } },
    { slug: 'creators', name: 'Creators', meta: { bp_segment: 'creators' } },
    { slug: 'social_media', name: 'Social Media', meta: { bp_segment: 'social' } },
    { slug: 'gestao_comunidade', name: 'Gestão de Comunidade', meta: { bp_segment: 'community' } },
    { slug: 'agente_ia', name: 'Agente IA', meta: { bp_segment: 'others' } },
    { slug: 'blog_post', name: 'Blog Post', meta: { bp_segment: 'others' } },
    { slug: 'broadcast', name: 'Broadcast', meta: { bp_segment: 'others' } },
    { slug: 'crm_vendas', name: 'CRM de Vendas', meta: { bp_segment: 'others' } },
    { slug: 'cro_alteracao', name: 'CRO & Alteração', meta: { bp_segment: 'others' } },
    { slug: 'dashboard', name: 'Dashboard', meta: { bp_segment: 'others' } },
    { slug: 'ecommerce', name: 'Ecommerce', meta: { bp_segment: 'others' } },
    { slug: 'estruturacao_comercial', name: 'Estruturação Comercial', meta: { bp_segment: 'others' } },
    { slug: 'estruturacao_estrategica', name: 'Estruturação Estratégica', meta: { bp_segment: 'others' } },
    { slug: 'gameplan', name: 'Gameplan', meta: { bp_segment: 'others' } },
    { slug: 'gestao_atendimento', name: 'Gestão & Atendimento', meta: { bp_segment: 'others' } },
    { slug: 'id_visual', name: 'ID Visual', meta: { bp_segment: 'others' } },
    { slug: 'landing_page', name: 'Landing Page', meta: { bp_segment: 'others' } },
    { slug: 'pacote_artes_rotulos', name: 'Pacote Artes / Rótulos', meta: { bp_segment: 'others' } },
    { slug: 'regua_automacao', name: 'Régua de Automação', meta: { bp_segment: 'others' } },
    { slug: 'seo_full', name: 'SEO Full', meta: { bp_segment: 'others' } },
    { slug: 'site', name: 'Site', meta: { bp_segment: 'others' } },
    { slug: 'sustentacao', name: 'Sustentação', meta: { bp_segment: 'others' } },
  ];
  let sortOrder = 10;
  for (const p of products) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, meta, updated_at)
      VALUES ('catalog_products', ${p.slug}, ${p.name}, ${sortOrder}, ${JSON.stringify(p.meta)}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        meta = EXCLUDED.meta,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  // Plans
  const plans = [
    { slug: 'starter', name: 'Starter' },
    { slug: 'scale', name: 'Scale' },
    { slug: 'enterprise', name: 'Enterprise' },
    { slug: 'personalizado', name: 'Personalizado' },
    { slug: 'projeto_pontual', name: 'Projeto Pontual' },
    { slug: 'antigo', name: 'Antigo (Legado)' },
  ];
  sortOrder = 10;
  for (const p of plans) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, updated_at)
      VALUES ('catalog_plans', ${p.slug}, ${p.name}, ${sortOrder}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  // Squads
  const squads = [
    { slug: 'squadra', name: 'Squadra', meta: { is_off: false } },
    { slug: 'makers', name: 'Makers', meta: { is_off: false } },
    { slug: 'pulse', name: 'Pulse', meta: { is_off: false } },
    { slug: 'tech', name: 'Tech', meta: { is_off: false } },
    { slug: 'selva', name: 'Selva', meta: { is_off: false } },
    { slug: 'hunters', name: 'Hunters', meta: { is_off: false } },
    { slug: 'supreme', name: 'Supreme', meta: { is_off: false } },
    { slug: 'squad_x', name: 'Squad X', meta: { is_off: false } },
    { slug: 'aurea', name: 'Aurea', meta: { is_off: false } },
    { slug: 'chama', name: 'Chama', meta: { is_off: false } },
    { slug: 'turbo_interno', name: 'Turbo Interno', meta: { is_off: false } },
    { slug: 'bloomfield', name: 'Bloomfield', meta: { is_off: false } },
  ];
  sortOrder = 10;
  for (const s of squads) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, meta, updated_at)
      VALUES ('catalog_squads', ${s.slug}, ${s.name}, ${sortOrder}, ${JSON.stringify(s.meta)}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        meta = EXCLUDED.meta,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  // Clusters
  const clusters = [
    { slug: 'regulares', name: 'Regulares' },
    { slug: 'imperdiveis', name: 'Imperdíveis' },
    { slug: 'chaves', name: 'Chaves' },
    { slug: 'nfnc', name: 'NFNC' },
    { slug: 'empty', name: 'Empty' },
  ];
  sortOrder = 10;
  for (const c of clusters) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, updated_at)
      VALUES ('catalog_clusters', ${c.slug}, ${c.name}, ${sortOrder}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  // Contract Status
  const statuses = [
    { slug: 'triagem', name: 'TRIAGEM', meta: { counts_as_operating: false } },
    { slug: 'onboarding', name: 'ONBOARDING', meta: { counts_as_operating: false } },
    { slug: 'ativo', name: 'ATIVO', meta: { counts_as_operating: true } },
    { slug: 'pausado', name: 'PAUSADO', meta: { counts_as_operating: false } },
    { slug: 'em_cancelamento', name: 'EM CANCELAMENTO', meta: { counts_as_operating: true } },
    { slug: 'entregue', name: 'ENTREGUE', meta: { counts_as_operating: false } },
    { slug: 'cancelado', name: 'CANCELADO', meta: { counts_as_operating: false } },
  ];
  sortOrder = 10;
  for (const s of statuses) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, meta, updated_at)
      VALUES ('catalog_contract_status', ${s.slug}, ${s.name}, ${sortOrder}, ${JSON.stringify(s.meta)}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        meta = EXCLUDED.meta,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  // Account Health
  const healthOptions = [
    { slug: 'saudavel', name: 'Saudável' },
    { slug: 'atencao', name: 'Atenção' },
    { slug: 'insatisfeito', name: 'Insatisfeito' },
  ];
  sortOrder = 10;
  for (const h of healthOptions) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, updated_at)
      VALUES ('catalog_account_health', ${h.slug}, ${h.name}, ${sortOrder}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  // ROI Bucket
  const roiBuckets = [
    { slug: 'lt_2', name: 'ROI < 2' },
    { slug: 'btw_2_4', name: 'ROI 2-4' },
    { slug: 'gt_4', name: 'ROI > 4' },
    { slug: 'no_data', name: 'Sem dado' },
  ];
  sortOrder = 10;
  for (const r of roiBuckets) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, updated_at)
      VALUES ('catalog_roi_bucket', ${r.slug}, ${r.name}, ${sortOrder}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  // Churn Reasons
  const churnReasons = [
    { slug: 'resultado_fraco', name: 'Resultado fraco / ROI' },
    { slug: 'falta_verba', name: 'Falta de verba' },
    { slug: 'in_house', name: 'Contratou in-house / troca interna' },
    { slug: 'concorrente', name: 'Troca por concorrente' },
    { slug: 'qualidade_entrega', name: 'Problemas de entrega / qualidade' },
    { slug: 'comunicacao', name: 'Problemas de comunicação' },
    { slug: 'timing', name: 'Timing / pausa estratégica' },
    { slug: 'inadimplencia', name: 'Inadimplência' },
    { slug: 'outros', name: 'Outros' },
  ];
  sortOrder = 10;
  for (const c of churnReasons) {
    await db.execute(sql`
      INSERT INTO sys.catalog_items (catalog_key, slug, name, sort_order, updated_at)
      VALUES ('catalog_churn_reason', ${c.slug}, ${c.name}, ${sortOrder}, NOW())
      ON CONFLICT (catalog_key, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  console.log('[database] sys catalogs applied');
}

async function generateSysAliases(): Promise<void> {
  // Get all catalog items and generate automatic aliases
  const items = await db.execute(sql`
    SELECT catalog_key, slug, name FROM sys.catalog_items WHERE active = true
  `);
  
  for (const item of items.rows as any[]) {
    const { catalog_key, slug, name } = item;
    
    // Auto-generate aliases: lowercase name, trimmed
    const aliases = new Set<string>();
    
    // Lowercase name
    aliases.add(name.toLowerCase().trim());
    
    // Original name (case-sensitive)
    aliases.add(name.trim());
    
    // Slug itself as alias
    aliases.add(slug);
    
    // Name without special chars (replace & with e, etc.)
    const normalized = name
      .replace(/&/g, 'e')
      .replace(/[\/\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (normalized !== name.toLowerCase().trim()) {
      aliases.add(normalized);
    }
    
    // Insert aliases
    for (const alias of aliases) {
      if (alias && alias.length > 0) {
        await db.execute(sql`
          INSERT INTO sys.catalog_aliases (catalog_key, alias, slug)
          VALUES (${catalog_key}, ${alias}, ${slug})
          ON CONFLICT (catalog_key, alias) DO UPDATE SET slug = EXCLUDED.slug
        `);
      }
    }
  }
  
  // Manual aliases
  const manualAliases = [
    // Status aliases
    { catalog_key: 'catalog_contract_status', alias: 'cancelado/inativo', slug: 'cancelado' },
    { catalog_key: 'catalog_contract_status', alias: 'inativo', slug: 'cancelado' },
    { catalog_key: 'catalog_contract_status', alias: 'em cancelamento', slug: 'em_cancelamento' },
    { catalog_key: 'catalog_contract_status', alias: 'active', slug: 'ativo' },
    { catalog_key: 'catalog_contract_status', alias: 'cancelled', slug: 'cancelado' },
    
    // Product aliases
    { catalog_key: 'catalog_products', alias: 'sm', slug: 'social_media' },
    { catalog_key: 'catalog_products', alias: 'perf', slug: 'performance' },
    { catalog_key: 'catalog_products', alias: 'trafego pago', slug: 'performance' },
    { catalog_key: 'catalog_products', alias: 'tráfego pago', slug: 'performance' },
    { catalog_key: 'catalog_products', alias: 'inbound', slug: 'performance' },
    { catalog_key: 'catalog_products', alias: 'social', slug: 'social_media' },
    
    // Squad aliases with emoji versions that might come from ClickUp
    { catalog_key: 'catalog_squads', alias: '⚓️ squadra', slug: 'squadra' },
    { catalog_key: 'catalog_squads', alias: '⚡ makers', slug: 'makers' },
    { catalog_key: 'catalog_squads', alias: '💠 pulse', slug: 'pulse' },
    { catalog_key: 'catalog_squads', alias: '🖥️ tech', slug: 'tech' },
    { catalog_key: 'catalog_squads', alias: '🪖 selva', slug: 'selva' },
    { catalog_key: 'catalog_squads', alias: '🏹 hunters', slug: 'hunters' },
    { catalog_key: 'catalog_squads', alias: '👑 supreme', slug: 'supreme' },
    { catalog_key: 'catalog_squads', alias: '👾 squad x', slug: 'squad_x' },
    { catalog_key: 'catalog_squads', alias: '🌟 aurea', slug: 'aurea' },
    { catalog_key: 'catalog_squads', alias: '🔥 chama', slug: 'chama' },
    { catalog_key: 'catalog_squads', alias: '🚀 turbo interno', slug: 'turbo_interno' },
    { catalog_key: 'catalog_squads', alias: '🗝️ bloomfield', slug: 'bloomfield' },
  ];
  
  for (const a of manualAliases) {
    await db.execute(sql`
      INSERT INTO sys.catalog_aliases (catalog_key, alias, slug)
      VALUES (${a.catalog_key}, ${a.alias}, ${a.slug})
      ON CONFLICT (catalog_key, alias) DO UPDATE SET slug = EXCLUDED.slug
    `);
  }
  
  console.log('[database] sys aliases generated');
}

async function applySysSystemFields(): Promise<void> {
  // UPSERT system fields into sys.system_fields
  const clientFields = [
    { field_key: 'client.name', label: 'Nome do Cliente', entity: 'client', field_type: 'string', required: true, enum_catalog: null, help_text: 'Nome oficial do cliente' },
    { field_key: 'client.cluster_slug', label: 'Cluster', entity: 'client', field_type: 'enum', required: true, enum_catalog: 'catalog_clusters', help_text: null },
    { field_key: 'client.health_status_slug', label: 'Status da Conta', entity: 'client', field_type: 'enum', required: false, enum_catalog: 'catalog_account_health', help_text: null },
    { field_key: 'client.cnpj', label: 'CNPJ', entity: 'client', field_type: 'string', required: false, enum_catalog: null, help_text: null },
    { field_key: 'client.contact_name', label: 'Pessoa de Contato', entity: 'client', field_type: 'string', required: false, enum_catalog: null, help_text: null },
    { field_key: 'client.contact_phone', label: 'Telefone de Contato', entity: 'client', field_type: 'string', required: false, enum_catalog: null, help_text: null },
    { field_key: 'client.email', label: 'E-mail', entity: 'client', field_type: 'string', required: false, enum_catalog: null, help_text: null },
    { field_key: 'client.instagram', label: 'Instagram', entity: 'client', field_type: 'string', required: false, enum_catalog: null, help_text: null },
    { field_key: 'client.site', label: 'Site', entity: 'client', field_type: 'string', required: false, enum_catalog: null, help_text: null },
    { field_key: 'client.notes', label: 'Observações', entity: 'client', field_type: 'text', required: false, enum_catalog: null, help_text: null },
  ];

  const contractFields = [
    { field_key: 'contract.client_id', label: 'Cliente', entity: 'contract', field_type: 'string', required: true, enum_catalog: null, help_text: 'FK para client.id' },
    { field_key: 'contract.product_slug', label: 'Produto', entity: 'contract', field_type: 'enum', required: true, enum_catalog: 'catalog_products', help_text: null },
    { field_key: 'contract.squad_slug', label: 'Squad', entity: 'contract', field_type: 'enum', required: true, enum_catalog: 'catalog_squads', help_text: null },
    { field_key: 'contract.status_slug', label: 'Status do Contrato', entity: 'contract', field_type: 'enum', required: true, enum_catalog: 'catalog_contract_status', help_text: null },
    { field_key: 'contract.mrr_value_cents', label: 'Valor Recorrente (MRR)', entity: 'contract', field_type: 'currency_cents', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.one_time_value_cents', label: 'Valor Pontual', entity: 'contract', field_type: 'currency_cents', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.first_payment_at', label: 'Data 1º Pagamento', entity: 'contract', field_type: 'date', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.cancel_request_at', label: 'Data Solicitação de Encerramento', entity: 'contract', field_type: 'date', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.last_operation_day', label: 'Último Dia de Operação', entity: 'contract', field_type: 'date', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.pause_at', label: 'Data de Pausa', entity: 'contract', field_type: 'date', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.sales_owner_user_id', label: 'Vendedor', entity: 'contract', field_type: 'user_ref', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.cs_owner_user_id', label: 'CS Responsável', entity: 'contract', field_type: 'user_ref', required: false, enum_catalog: null, help_text: null },
    { field_key: 'contract.churn_reason_slug', label: 'Motivo do Cancelamento', entity: 'contract', field_type: 'enum', required: false, enum_catalog: 'catalog_churn_reason', help_text: null },
    { field_key: 'contract.churn_subreason', label: 'Submotivo do Cancelamento', entity: 'contract', field_type: 'text', required: false, enum_catalog: null, help_text: null },
  ];

  const allFields = [...clientFields, ...contractFields];
  let sortOrder = 10;

  for (const f of allFields) {
    await db.execute(sql`
      INSERT INTO sys.system_fields (field_key, label, entity, field_type, required, enum_catalog, help_text, sort_order, updated_at)
      VALUES (${f.field_key}, ${f.label}, ${f.entity}, ${f.field_type}, ${f.required}, ${f.enum_catalog}, ${f.help_text}, ${sortOrder}, NOW())
      ON CONFLICT (field_key) DO UPDATE SET 
        label = EXCLUDED.label,
        entity = EXCLUDED.entity,
        field_type = EXCLUDED.field_type,
        required = EXCLUDED.required,
        enum_catalog = EXCLUDED.enum_catalog,
        help_text = EXCLUDED.help_text,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `);
    sortOrder += 10;
  }

  console.log('[database] sys system_fields applied');
}

async function applySysValidationRules(): Promise<void> {
  // UPSERT validation rules into sys.validation_rules
  const rules = [
    {
      rule_id: 'contract.require_product',
      name: 'Produto obrigatório',
      entity: 'contract',
      when_condition: { always: true },
      action: { validate: 'product_slug IS NOT NULL' },
      message: 'Todo contrato deve ter um produto definido'
    },
    {
      rule_id: 'contract.require_squad',
      name: 'Squad obrigatório',
      entity: 'contract',
      when_condition: { always: true },
      action: { validate: 'squad_slug IS NOT NULL' },
      message: 'Todo contrato deve ter um squad atribuído'
    },
    {
      rule_id: 'contract.require_status',
      name: 'Status obrigatório',
      entity: 'contract',
      when_condition: { always: true },
      action: { validate: 'status_slug IS NOT NULL' },
      message: 'Todo contrato deve ter um status definido'
    },
    {
      rule_id: 'contract.churn_requires_reason',
      name: 'Motivo de churn obrigatório',
      entity: 'contract',
      when_condition: { field: 'status_slug', equals: 'cancelado' },
      action: { validate: 'churn_reason_slug IS NOT NULL' },
      message: 'Contratos cancelados devem ter motivo de churn informado'
    },
    {
      rule_id: 'contract.mrr_positive',
      name: 'MRR deve ser positivo',
      entity: 'contract',
      when_condition: { field: 'mrr_value_cents', operator: 'exists' },
      action: { validate: 'mrr_value_cents >= 0' },
      message: 'Valor recorrente não pode ser negativo'
    },
    {
      rule_id: 'client.require_name',
      name: 'Nome do cliente obrigatório',
      entity: 'client',
      when_condition: { always: true },
      action: { validate: 'name IS NOT NULL AND name != ""' },
      message: 'Todo cliente deve ter um nome'
    },
    {
      rule_id: 'client.require_cluster',
      name: 'Cluster obrigatório',
      entity: 'client',
      when_condition: { always: true },
      action: { validate: 'cluster_slug IS NOT NULL' },
      message: 'Todo cliente deve estar em um cluster'
    },
  ];

  for (const r of rules) {
    await db.execute(sql`
      INSERT INTO sys.validation_rules (rule_id, name, entity, when_condition, action, message, updated_at)
      VALUES (${r.rule_id}, ${r.name}, ${r.entity}, ${JSON.stringify(r.when_condition)}, ${JSON.stringify(r.action)}, ${r.message}, NOW())
      ON CONFLICT (rule_id) DO UPDATE SET 
        name = EXCLUDED.name,
        entity = EXCLUDED.entity,
        when_condition = EXCLUDED.when_condition,
        action = EXCLUDED.action,
        message = EXCLUDED.message,
        updated_at = NOW()
    `);
  }

  console.log('[database] sys validation_rules applied');
}

export async function initializeBPTables(): Promise<void> {
  try {
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS plan`);
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS kpi`);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plan.metric_targets_monthly (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        metric_key VARCHAR(100) NOT NULL,
        dimension_key VARCHAR(100) DEFAULT NULL,
        dimension_value VARCHAR(255) DEFAULT NULL,
        target_value NUMERIC(18, 6) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (year, month, metric_key, dimension_key, dimension_value)
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kpi.metrics_registry_extended (
        id SERIAL PRIMARY KEY,
        metric_key VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        period_type VARCHAR(20) NOT NULL,
        direction VARCHAR(10) NOT NULL,
        is_derived BOOLEAN DEFAULT false,
        formula_expr TEXT,
        tolerance NUMERIC(10, 4) DEFAULT 0.10,
        dimension_key VARCHAR(100),
        dimension_value VARCHAR(255),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kpi.metric_actuals_monthly (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        metric_key VARCHAR(100) NOT NULL,
        dimension_key VARCHAR(100) DEFAULT NULL,
        dimension_value VARCHAR(255) DEFAULT NULL,
        actual_value NUMERIC(18, 6),
        calculated_at TIMESTAMP DEFAULT NOW(),
        source VARCHAR(100),
        UNIQUE (year, month, metric_key, dimension_key, dimension_value)
      )
    `);
    
    console.log('[database] BP tables initialized (plan.metric_targets_monthly, kpi.metrics_registry_extended, kpi.metric_actuals_monthly)');
  } catch (error) {
    console.error('[database] Error initializing BP tables:', error);
  }
}

async function createCanonicalContractsView(): Promise<void> {
  // Create or replace the canonical view for contracts
  // Maps raw cup_contratos data to canonical slugs via sys.catalog_aliases
  // 
  // NOTE: The source table cup_contratos does NOT contain a 'plano' field.
  // Available fields are: servico, status, valorr, valorp, squad, produto, etc.
  // Plan normalization will be added when/if plan data becomes available in the source.
  await db.execute(sql`
    CREATE OR REPLACE VIEW public.vw_contratos_canon AS
    SELECT 
      c.id_task,
      c.id_subtask,
      c.servico,
      c.produto,
      COALESCE(pa.slug, LOWER(TRIM(c.produto))) AS product_slug,
      c.squad,
      COALESCE(sa.slug, LOWER(TRIM(c.squad))) AS squad_slug,
      c.status,
      COALESCE(sta.slug, LOWER(TRIM(c.status))) AS status_slug,
      c.valorr,
      CAST(COALESCE(c.valorr, 0) * 100 AS BIGINT) AS mrr_value_cents,
      c.valorp,
      CAST(COALESCE(c.valorp, 0) * 100 AS BIGINT) AS one_time_value_cents,
      c.responsavel,
      c.cs_responsavel,
      c.vendedor,
      c.data_inicio,
      c.data_encerramento,
      c.data_solicitacao_encerramento,
      c.data_pausa
    FROM public.cup_contratos c
    LEFT JOIN sys.catalog_aliases pa ON pa.catalog_key = 'catalog_products' 
      AND LOWER(TRIM(c.produto)) = pa.alias
    LEFT JOIN sys.catalog_aliases sa ON sa.catalog_key = 'catalog_squads' 
      AND LOWER(TRIM(c.squad)) = sa.alias
    LEFT JOIN sys.catalog_aliases sta ON sta.catalog_key = 'catalog_contract_status' 
      AND LOWER(TRIM(c.status)) = sta.alias
  `);
  
  console.log('[database] vw_contratos_canon view created');
}
