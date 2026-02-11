import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
});

pool.on('error', (err) => {
  console.error('[database] Pool error occurred');
  if (process.env.NODE_ENV !== 'production') {
    console.error('[database] Details:', err.message);
  }
});

export const db = drizzle(pool, { schema });
export { pool, schema };

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
        titulo VARCHAR(100),
        ordem INTEGER NOT NULL,
        descricao TEXT,
        responsavel_padrao VARCHAR(100),
        prazo_dias INTEGER
      )
    `);
    
    await db.execute(sql`
      ALTER TABLE onboarding_etapas 
      ADD COLUMN IF NOT EXISTS titulo VARCHAR(100)
    `);
    
    const hasNomeColumn = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'onboarding_etapas' AND column_name = 'nome'
    `);
    
    if (hasNomeColumn.rows.length > 0) {
      await db.execute(sql`
        UPDATE onboarding_etapas 
        SET titulo = nome 
        WHERE (titulo IS NULL OR titulo = '') AND nome IS NOT NULL
      `);
    }
    
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
// CORTEX_CORE SCHEMA - Canonical layer for catalogs and system fields
// ============================================================================

export async function initializeSysSchema(): Promise<void> {
  try {
    // Create cortex_core schema if not exists
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS cortex_core`);
    console.log('[database] cortex_core schema created');

    // 1. cortex_core.catalogs - catalog definitions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.catalogs (
        catalog_key VARCHAR(100) PRIMARY KEY,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. cortex_core.catalog_items - items within catalogs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.catalog_items (
        catalog_key VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (catalog_key, slug),
        FOREIGN KEY (catalog_key) REFERENCES cortex_core.catalogs(catalog_key)
      )
    `);

    // 3. cortex_core.catalog_aliases - aliases for mapping raw values to slugs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.catalog_aliases (
        catalog_key VARCHAR(100) NOT NULL,
        alias VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (catalog_key, alias),
        FOREIGN KEY (catalog_key, slug) REFERENCES cortex_core.catalog_items(catalog_key, slug)
      )
    `);

    // 4. cortex_core.system_fields - field definitions for entities
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.system_fields (
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

    // 5. cortex_core.validation_rules - business validation rules
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.validation_rules (
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

    // 6. cortex_core.credentials - client access credentials
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID,
        platform VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        password VARCHAR(255),
        access_url TEXT,
        observations TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 7. cortex_core.unavailability_requests - PJ unavailability period requests with dual approval
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.unavailability_requests (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL,
        colaborador_nome VARCHAR(255) NOT NULL,
        colaborador_email VARCHAR(255),
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        motivo TEXT,
        data_admissao DATE,
        status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'reprovado')),
        status_rh VARCHAR(20) DEFAULT 'pendente',
        status_lider VARCHAR(20) DEFAULT 'pendente',
        aprovador_email VARCHAR(255),
        aprovador_nome VARCHAR(255),
        data_aprovacao TIMESTAMP,
        observacao_aprovador TEXT,
        aprovador_rh_email VARCHAR(255),
        aprovador_rh_nome VARCHAR(255),
        data_aprovacao_rh TIMESTAMP,
        observacao_rh TEXT,
        aprovador_lider_email VARCHAR(255),
        aprovador_lider_nome VARCHAR(255),
        data_aprovacao_lider TIMESTAMP,
        observacao_lider TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_max_days CHECK ((data_fim - data_inicio) <= 7)
      )
    `);
    
    // Add dual approval columns if they don't exist (for existing databases)
    await db.execute(sql`
      ALTER TABLE cortex_core.unavailability_requests 
      ADD COLUMN IF NOT EXISTS status_rh VARCHAR(20) DEFAULT 'pendente',
      ADD COLUMN IF NOT EXISTS status_lider VARCHAR(20) DEFAULT 'pendente',
      ADD COLUMN IF NOT EXISTS aprovador_rh_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS aprovador_rh_nome VARCHAR(255),
      ADD COLUMN IF NOT EXISTS data_aprovacao_rh TIMESTAMP,
      ADD COLUMN IF NOT EXISTS observacao_rh TEXT,
      ADD COLUMN IF NOT EXISTS aprovador_lider_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS aprovador_lider_nome VARCHAR(255),
      ADD COLUMN IF NOT EXISTS data_aprovacao_lider TIMESTAMP,
      ADD COLUMN IF NOT EXISTS observacao_lider TEXT
    `);

    console.log('[database] cortex_core schema tables created');

    // Apply spec - UPSERT catalogs
    await applySysCatalogs();
    
    // Generate aliases
    await generateSysAliases();
    
    // Apply system fields to cortex_core schema
    await applySysSystemFields();
    
    // Apply validation rules
    await applySysValidationRules();
    
    // Create canonical view
    await createCanonicalContractsView();

    console.log('[database] cortex_core schema fully initialized');
  } catch (error) {
    console.error('[database] Error initializing cortex_core schema:', error);
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
      INSERT INTO cortex_core.catalogs (catalog_key, description, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, meta, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, meta, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, meta, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, updated_at)
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
      INSERT INTO cortex_core.catalog_items (catalog_key, slug, name, sort_order, updated_at)
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
    SELECT catalog_key, slug, name FROM cortex_core.catalog_items WHERE active = true
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
    for (const alias of Array.from(aliases)) {
      if (alias && alias.length > 0) {
        await db.execute(sql`
          INSERT INTO cortex_core.catalog_aliases (catalog_key, alias, slug)
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
      INSERT INTO cortex_core.catalog_aliases (catalog_key, alias, slug)
      VALUES (${a.catalog_key}, ${a.alias}, ${a.slug})
      ON CONFLICT (catalog_key, alias) DO UPDATE SET slug = EXCLUDED.slug
    `);
  }
  
  console.log('[database] sys aliases generated');
}

async function applySysSystemFields(): Promise<void> {
  // UPSERT system fields into cortex_core.system_fields
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
      INSERT INTO cortex_core.system_fields (field_key, label, entity, field_type, required, enum_catalog, help_text, sort_order, updated_at)
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
  // UPSERT validation rules into cortex_core.validation_rules
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
      INSERT INTO cortex_core.validation_rules (rule_id, name, entity, when_condition, action, message, updated_at)
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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.metric_targets_monthly (
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
      CREATE TABLE IF NOT EXISTS cortex_core.metrics_registry_extended (
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
      CREATE TABLE IF NOT EXISTS cortex_core.metric_actuals_monthly (
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
    
    console.log('[database] BP tables initialized (cortex_core.metric_targets_monthly, cortex_core.metrics_registry_extended, cortex_core.metric_actuals_monthly)');
  } catch (error) {
    console.error('[database] Error initializing BP tables:', error);
  }
}

async function createCanonicalContractsView(): Promise<void> {
  // Create or replace the canonical view for contracts
  // Maps raw cup_contratos data to canonical slugs via cortex_core.catalog_aliases
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
    FROM "Clickup".cup_contratos c
    LEFT JOIN cortex_core.catalog_aliases pa ON pa.catalog_key = 'catalog_products' 
      AND LOWER(TRIM(c.produto)) = pa.alias
    LEFT JOIN cortex_core.catalog_aliases sa ON sa.catalog_key = 'catalog_squads' 
      AND LOWER(TRIM(c.squad)) = sa.alias
    LEFT JOIN cortex_core.catalog_aliases sta ON sta.catalog_key = 'catalog_contract_status' 
      AND LOWER(TRIM(c.status)) = sta.alias
  `);
  
  console.log('[database] vw_contratos_canon view created');
}

export async function initializeDashboardTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dashboard_views (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dashboard_cards (
        id SERIAL PRIMARY KEY,
        view_key VARCHAR(50) NOT NULL,
        metric_key VARCHAR(100) NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        size VARCHAR(10) NOT NULL DEFAULT 'md',
        show_trend BOOLEAN NOT NULL DEFAULT true,
        trend_months INTEGER NOT NULL DEFAULT 6,
        show_ytd BOOLEAN NOT NULL DEFAULT true,
        show_variance BOOLEAN NOT NULL DEFAULT true,
        show_status BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS metric_actual_overrides_monthly (
        id SERIAL PRIMARY KEY,
        metric_key VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        month VARCHAR(7) NOT NULL,
        dimension_key VARCHAR(50),
        dimension_value VARCHAR(100),
        actual_value NUMERIC(18, 2) NOT NULL,
        notes TEXT,
        updated_by VARCHAR(100),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (metric_key, year, month, dimension_key, dimension_value)
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kr_checkins (
        id SERIAL PRIMARY KEY,
        kr_id VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        period_type VARCHAR(10) NOT NULL,
        period_value VARCHAR(10) NOT NULL,
        confidence INTEGER NOT NULL DEFAULT 50,
        commentary TEXT,
        blockers TEXT,
        next_actions TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('[database] Dashboard and KR check-in tables initialized');
  } catch (error) {
    console.error('[database] Error initializing dashboard tables:', error);
  }
}

export async function initializeTurboEventosTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.turbo_eventos (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        tipo VARCHAR(50) NOT NULL DEFAULT 'outro',
        data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
        data_fim TIMESTAMP WITH TIME ZONE,
        local VARCHAR(255),
        organizador_id INTEGER,
        organizador_nome VARCHAR(255),
        cor VARCHAR(20),
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        criado_por VARCHAR(255)
      )
    `);
    console.log('[database] Turbo eventos table initialized');
  } catch (error) {
    console.error('[database] Error initializing turbo eventos table:', error);
  }
}

export async function seedDefaultDashboardViews(): Promise<void> {
  try {
    const views = [
      { key: 'overview', name: 'Visão Geral', description: 'KPIs principais do negócio' },
      { key: 'financeiro', name: 'Financeiro', description: 'Métricas financeiras detalhadas' },
      { key: 'pessoas', name: 'Pessoas', description: 'Métricas de headcount e produtividade' },
      { key: 'comercial', name: 'Comercial', description: 'Métricas de vendas e MRR' },
    ];
    
    for (const v of views) {
      await db.execute(sql`
        INSERT INTO dashboard_views (key, name, description)
        VALUES (${v.key}, ${v.name}, ${v.description})
        ON CONFLICT (key) DO UPDATE SET 
          name = EXCLUDED.name,
          description = EXCLUDED.description
      `);
    }
    
    console.log('[database] Default dashboard views seeded');
  } catch (error) {
    console.error('[database] Error seeding dashboard views:', error);
  }
}

export async function initializeRhPagamentosTable(): Promise<void> {
  try {
    // Criar tabela de pagamentos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.rh_pagamentos (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL,
        mes_referencia INTEGER NOT NULL,
        ano_referencia INTEGER NOT NULL,
        valor_bruto DECIMAL NOT NULL,
        valor_liquido DECIMAL,
        data_pagamento DATE,
        status VARCHAR(50) DEFAULT 'pendente',
        observacoes TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Criar tabela de notas fiscais
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.rh_notas_fiscais (
        id SERIAL PRIMARY KEY,
        pagamento_id INTEGER NOT NULL,
        colaborador_id INTEGER NOT NULL,
        numero_nf VARCHAR(50),
        valor_nf DECIMAL,
        arquivo_path TEXT,
        arquivo_nome TEXT,
        data_emissao DATE,
        status VARCHAR(50) DEFAULT 'pendente',
        criado_em TIMESTAMP DEFAULT NOW(),
        criado_por VARCHAR(100)
      )
    `);
    
    // Criar índices
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_rh_pagamentos_colaborador ON staging.rh_pagamentos(colaborador_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_rh_pagamentos_periodo ON staging.rh_pagamentos(ano_referencia, mes_referencia)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_rh_notas_fiscais_pagamento ON staging.rh_notas_fiscais(pagamento_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_rh_notas_fiscais_colaborador ON staging.rh_notas_fiscais(colaborador_id)
    `);
    
    console.log('[database] RH Pagamentos and Notas Fiscais tables initialized');
  } catch (error) {
    console.error('[database] Error initializing RH Pagamentos tables:', error);
  }
}

export async function initializeRhPesquisasTables(): Promise<void> {
  try {
    // Criar tabela de e-NPS (pesquisa completa)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "Inhire".rh_enps (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL REFERENCES "Inhire".rh_pessoal(id),
        score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
        comentario TEXT,
        data DATE DEFAULT CURRENT_DATE,
        criado_em TIMESTAMP DEFAULT NOW(),
        criado_por VARCHAR(200),
        motivo_permanencia VARCHAR(200),
        comentario_empresa TEXT,
        score_lider INTEGER CHECK (score_lider >= 0 AND score_lider <= 10),
        comentario_lider TEXT,
        score_produtos INTEGER CHECK (score_produtos >= 0 AND score_produtos <= 10),
        comentario_produtos TEXT,
        feedback_geral TEXT
      )
    `);
    
    // Adicionar colunas novas se tabela já existe (migração)
    const columns = ['criado_por', 'motivo_permanencia', 'comentario_empresa', 'score_lider', 
                     'comentario_lider', 'score_produtos', 'comentario_produtos', 'feedback_geral'];
    for (const col of columns) {
      try {
        if (col.startsWith('score_')) {
          await db.execute(sql.raw(`ALTER TABLE "Inhire".rh_enps ADD COLUMN IF NOT EXISTS ${col} INTEGER`));
        } else {
          await db.execute(sql.raw(`ALTER TABLE "Inhire".rh_enps ADD COLUMN IF NOT EXISTS ${col} TEXT`));
        }
      } catch (e) {
        // Coluna já existe, ignorar
      }
    }
    
    // Criar tabela de 1x1
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "Inhire".rh_one_on_one (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL REFERENCES "Inhire".rh_pessoal(id),
        lider_id INTEGER REFERENCES "Inhire".rh_pessoal(id),
        data DATE NOT NULL,
        tipo VARCHAR(50) DEFAULT 'regular',
        anotacoes TEXT,
        proximos_passos TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        pdf_object_key VARCHAR(500),
        pdf_filename VARCHAR(300),
        transcript_url VARCHAR(1000),
        transcript_text TEXT,
        uploaded_by VARCHAR(200)
      )
    `);
    
    // Migração para adicionar colunas de anexos se tabela já existe
    const oneOnOneColumns = ['pdf_object_key', 'pdf_filename', 'transcript_url', 'transcript_text', 'uploaded_by'];
    for (const col of oneOnOneColumns) {
      try {
        await db.execute(sql.raw(`ALTER TABLE "Inhire".rh_one_on_one ADD COLUMN IF NOT EXISTS ${col} ${col.includes('text') ? 'TEXT' : 'VARCHAR(1000)'}`));
      } catch (e) {
        // Coluna já existe, ignorar
      }
    }
    
    // Migração para adicionar colunas de análise de IA
    try {
      await db.execute(sql`ALTER TABLE "Inhire".rh_one_on_one ADD COLUMN IF NOT EXISTS ai_analysis TEXT`);
      await db.execute(sql`ALTER TABLE "Inhire".rh_one_on_one ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP`);
    } catch (e) {
      // Colunas já existem, ignorar
    }
    
    // Criar tabela de PDI
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "Inhire".rh_pdi (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL REFERENCES "Inhire".rh_pessoal(id),
        titulo VARCHAR(200) NOT NULL,
        descricao TEXT,
        status VARCHAR(50) DEFAULT 'em_andamento',
        progresso INTEGER DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
        data_inicio DATE DEFAULT CURRENT_DATE,
        data_alvo DATE,
        data_conclusao DATE,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Criar índices
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_enps_colaborador ON "Inhire".rh_enps(colaborador_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_enps_data ON "Inhire".rh_enps(data)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_one_on_one_colaborador ON "Inhire".rh_one_on_one(colaborador_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_one_on_one_data ON "Inhire".rh_one_on_one(data)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_pdi_colaborador ON "Inhire".rh_pdi(colaborador_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_pdi_status ON "Inhire".rh_pdi(status)`);
    
    console.log('[database] RH Pesquisas tables (e-NPS, 1x1, PDI) initialized');
  } catch (error) {
    console.error('[database] Error initializing RH Pesquisas tables:', error);
  }
}

export async function initializeRhNpsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "Inhire".rh_nps (
        id SERIAL PRIMARY KEY,
        mes_referencia VARCHAR(7) NOT NULL,
        area VARCHAR(100) NOT NULL,
        motivo_permanencia TEXT NOT NULL,
        score_empresa INTEGER NOT NULL CHECK (score_empresa >= 0 AND score_empresa <= 10),
        comentario_empresa TEXT NOT NULL,
        score_lider INTEGER NOT NULL CHECK (score_lider >= 0 AND score_lider <= 10),
        comentario_lider TEXT NOT NULL,
        score_produtos INTEGER NOT NULL CHECK (score_produtos >= 0 AND score_produtos <= 10),
        comentario_produtos TEXT NOT NULL,
        feedback_geral TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_nps_mes ON "Inhire".rh_nps(mes_referencia)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_nps_area ON "Inhire".rh_nps(area)`);

    console.log('[database] RH NPS table initialized');
  } catch (error) {
    console.error('[database] Error initializing RH NPS table:', error);
  }
}

export async function initializeRhNpsConfigTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "Inhire".rh_nps_config (
        id SERIAL PRIMARY KEY,
        mes_referencia VARCHAR(7) NOT NULL UNIQUE,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[database] RH NPS Config table initialized');
  } catch (error) {
    console.error('[database] Error initializing RH NPS Config table:', error);
  }
}

export async function initializeRhComentariosTables(): Promise<void> {
  try {
    // Criar tabela de comentários sobre colaboradores
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "Inhire".rh_comentarios (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL REFERENCES "Inhire".rh_pessoal(id),
        autor_id INTEGER REFERENCES "Inhire".rh_pessoal(id),
        autor_nome VARCHAR(200),
        autor_email VARCHAR(200),
        comentario TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'geral',
        visibilidade VARCHAR(50) DEFAULT 'lider',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Criar índices
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_comentarios_colaborador ON "Inhire".rh_comentarios(colaborador_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_comentarios_autor ON "Inhire".rh_comentarios(autor_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rh_comentarios_criado ON "Inhire".rh_comentarios(criado_em)`);
    
    console.log('[database] RH Comentarios table initialized');
  } catch (error) {
    console.error('[database] Error initializing RH Comentarios table:', error);
  }
}

export async function initializeBpSnapshotsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.bp_snapshots (
        id SERIAL PRIMARY KEY,
        mes_ano VARCHAR(7) NOT NULL,
        data_snapshot TIMESTAMP NOT NULL DEFAULT NOW(),
        metricas JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(mes_ano)
      )
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_bp_snapshots_mes_ano 
      ON cortex_core.bp_snapshots(mes_ano)
    `);
    
    console.log('[database] BP Snapshots table initialized');
  } catch (error) {
    console.error('[database] Error initializing BP Snapshots table:', error);
  }
}

export async function seedBpSnapshotJaneiro2026(): Promise<void> {
  try {
    const existing = await db.execute(sql`SELECT 1 FROM cortex_core.bp_snapshots WHERE mes_ano = '2026-01' LIMIT 1`);
    if (existing.rows.length > 0) {
      console.log('[bp-snapshot] Snapshot de janeiro 2026 já existe');
      return;
    }
    
    const startStr = '2026-01-01';
    const endStr = '2026-01-31';
    
    const mrrResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valorr), 0) as mrr
      FROM "Clickup".cup_contratos
      WHERE status IN ('ativo', 'onboarding', 'triagem')
        AND (data_inicio IS NULL OR data_inicio <= '${endStr}')
        AND (data_encerramento IS NULL OR data_encerramento > '${endStr}')
    `));
    const mrrAtivo = parseFloat((mrrResult.rows[0] as any)?.mrr || "0");
    
    const vendasResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valor_recorrente::numeric), 0) as vendas_mrr
      FROM "Bitrix".crm_deal
      WHERE stage_name = 'Negócio Ganho'
        AND data_fechamento IS NOT NULL
        AND data_fechamento >= '${startStr}'
        AND data_fechamento <= '${endStr}'
        AND valor_recorrente IS NOT NULL
        AND valor_recorrente > 0
    `));
    const vendasMrr = parseFloat((vendasResult.rows[0] as any)?.vendas_mrr || "0");
    
    const receitaPontualResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valor_pontual::numeric), 0) as receita_pontual
      FROM "Bitrix".crm_deal
      WHERE stage_name = 'Negócio Ganho'
        AND data_fechamento IS NOT NULL
        AND data_fechamento >= '${startStr}'
        AND data_fechamento <= '${endStr}'
        AND valor_pontual IS NOT NULL
        AND valor_pontual > 0
    `));
    const receitaPontual = parseFloat((receitaPontualResult.rows[0] as any)?.receita_pontual || "0");
    
    const outrasReceitasResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valor_liquido::numeric), 0) as total
      FROM "Conta Azul".caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND (
          categoria_nome LIKE '03.02%' 
          OR categoria_nome LIKE '03.03%' 
          OR categoria_nome LIKE '04.01%' 
          OR categoria_nome LIKE '04.03%'
        )
        AND data_quitacao::date >= '${startStr}'::date
        AND data_quitacao::date <= '${endStr}'::date
    `));
    const outrasReceitas = parseFloat((outrasReceitasResult.rows[0] as any)?.total || "0");
    
    const inadResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(nao_pago::numeric), 0) as inadimplencia
      FROM "Conta Azul".caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento >= '${startStr}'
        AND data_vencimento <= '${endStr}'
        AND nao_pago::numeric > 0
    `));
    const inadimplencia = parseFloat((inadResult.rows[0] as any)?.inadimplencia || "0");
    
    const impostosResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valor_pago::numeric), 0) as impostos
      FROM "Conta Azul".caz_parcelas
      WHERE status = 'QUITADO'
        AND categoria_nome LIKE '06.13%'
        AND data_quitacao::date >= '${startStr}'::date
        AND data_quitacao::date <= '${endStr}'::date
    `));
    const impostos = parseFloat((impostosResult.rows[0] as any)?.impostos || "0");
    
    const geracaoCaixaResult = await db.execute(sql.raw(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as saidas
      FROM "Conta Azul".caz_parcelas
      WHERE data_quitacao::date >= '${startStr}'::date
        AND data_quitacao::date <= '${endStr}'::date
        AND status = 'QUITADO'
    `));
    const entradas = parseFloat((geracaoCaixaResult.rows[0] as any)?.entradas || "0");
    const saidas = parseFloat((geracaoCaixaResult.rows[0] as any)?.saidas || "0");
    const geracaoCaixa = entradas - saidas;
    const margemGeracaoCaixa = entradas > 0 ? geracaoCaixa / entradas : 0;
    
    const csvResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valor_pago::numeric), 0) as csv
      FROM "Conta Azul".caz_parcelas
      WHERE status = 'QUITADO'
        AND categoria_nome LIKE '06.%'
        AND categoria_nome NOT LIKE '06.13%'
        AND data_quitacao::date >= '${startStr}'::date
        AND data_quitacao::date <= '${endStr}'::date
    `));
    const csv = parseFloat((csvResult.rows[0] as any)?.csv || "0");
    
    const sgaResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valor_pago::numeric), 0) as sga
      FROM "Conta Azul".caz_parcelas
      WHERE status = 'QUITADO'
        AND (categoria_nome LIKE '06.10%' OR categoria_nome LIKE '06.11%' OR categoria_nome LIKE '06.12%')
        AND data_quitacao::date >= '${startStr}'::date
        AND data_quitacao::date <= '${endStr}'::date
    `));
    const sga = parseFloat((sgaResult.rows[0] as any)?.sga || "0");
    
    const cacResult = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(valor_pago::numeric), 0) as cac
      FROM "Conta Azul".caz_parcelas
      WHERE status = 'QUITADO'
        AND (categoria_nome LIKE '06.03%' OR categoria_nome LIKE '06.04%')
        AND data_quitacao::date >= '${startStr}'::date
        AND data_quitacao::date <= '${endStr}'::date
    `));
    const cac = parseFloat((cacResult.rows[0] as any)?.cac || "0");
    
    const receitaTotalFaturavel = mrrAtivo + receitaPontual + outrasReceitas;
    const receitaLiquida = receitaTotalFaturavel - inadimplencia - impostos;
    const margemBruta = receitaLiquida - csv;
    const ebitda = margemBruta - cac - sga;
    
    const metricas = {
      mrr_active: mrrAtivo,
      sales_mrr: vendasMrr,
      revenue_one_time: receitaPontual,
      revenue_other: outrasReceitas,
      revenue_billable_total: receitaTotalFaturavel,
      bad_debt: inadimplencia,
      taxes_on_revenue: impostos,
      net_revenue: receitaLiquida,
      csv: csv,
      gross_margin: margemBruta,
      cac: cac,
      sga: sga,
      ebitda: ebitda,
      cash_generation: geracaoCaixa,
      cash_generation_margin_pct: margemGeracaoCaixa,
      receitas_dfc: entradas,
      despesas_dfc: saidas,
    };
    
    await db.execute(sql`
      INSERT INTO cortex_core.bp_snapshots (mes_ano, data_snapshot, metricas)
      VALUES ('2026-01', NOW(), ${JSON.stringify(metricas)}::jsonb)
    `);
    
    console.log('[bp-snapshot] Snapshot de janeiro 2026 criado:', metricas);
  } catch (error) {
    console.error('[bp-snapshot] Erro ao criar snapshot de janeiro 2026:', error);
  }
}

export async function initializeDfcSnapshotsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.dfc_snapshots (
        id SERIAL PRIMARY KEY,
        mes_ano VARCHAR(7) NOT NULL,
        data_snapshot TIMESTAMP NOT NULL DEFAULT NOW(),
        saldo_inicial NUMERIC(15,2) NOT NULL,
        dados_diarios JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(mes_ano)
      )
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_dfc_snapshots_mes_ano 
      ON staging.dfc_snapshots(mes_ano)
    `);
    
    console.log('[database] DFC Snapshots table initialized');
  } catch (error) {
    console.error('[database] Error initializing DFC Snapshots table:', error);
  }
}

export async function initializeSalesGoalsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.sales_goals (
        id SERIAL PRIMARY KEY,
        goal_type VARCHAR(50) NOT NULL,
        goal_key VARCHAR(100) NOT NULL,
        goal_value NUMERIC(15,2) NOT NULL,
        period_month INTEGER,
        period_year INTEGER,
        updated_by VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(goal_type, goal_key, period_month, period_year)
      )
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sales_goals_type_key 
      ON cortex_core.sales_goals(goal_type, goal_key)
    `);
    
    console.log('[database] Sales Goals table initialized');
  } catch (error) {
    console.error('[database] Error initializing Sales Goals table:', error);
  }
}

export async function initializeCupDataHistTable(): Promise<void> {
  try {
    // Verificar se a tabela existe
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'Clickup' 
        AND table_name = 'cup_data_hist'
      )
    `);
    
    const exists = (tableExists.rows[0] as any)?.exists;
    
    if (!exists) {
      // Criar tabela nova com estrutura alinhada com cup_contratos
      await db.execute(sql`
        CREATE TABLE "Clickup".cup_data_hist (
          id SERIAL PRIMARY KEY,
          data_snapshot TIMESTAMP NOT NULL DEFAULT NOW(),
          servico TEXT,
          status TEXT,
          valorr TEXT,
          valorp TEXT,
          id_task TEXT,
          id_subtask TEXT,
          data_inicio TEXT,
          data_encerramento TEXT,
          data_pausa TEXT,
          squad TEXT,
          produto TEXT,
          responsavel TEXT,
          cs_responsavel TEXT,
          vendedor TEXT
        )
      `);
      
      await db.execute(sql`
        CREATE INDEX idx_cup_data_hist_snapshot 
        ON "Clickup".cup_data_hist(DATE(data_snapshot))
      `);
      
      await db.execute(sql`
        CREATE INDEX idx_cup_data_hist_snapshot_status 
        ON "Clickup".cup_data_hist(DATE(data_snapshot), status)
      `);
      
      console.log('[database] Cup Data Hist table created');
    } else {
      // Tabela existe - garantir colunas necessárias existem
      const requiredColumns = [
        { name: 'data_snapshot', type: 'TIMESTAMP DEFAULT NOW()' },
        { name: 'servico', type: 'TEXT' },
        { name: 'status', type: 'TEXT' },
        { name: 'valorr', type: 'TEXT' },
        { name: 'valorp', type: 'TEXT' },
        { name: 'id_task', type: 'TEXT' },
        { name: 'id_subtask', type: 'TEXT' },
        { name: 'data_inicio', type: 'TEXT' },
        { name: 'data_encerramento', type: 'TEXT' },
        { name: 'data_pausa', type: 'TEXT' },
        { name: 'squad', type: 'TEXT' },
        { name: 'produto', type: 'TEXT' },
        { name: 'responsavel', type: 'TEXT' },
        { name: 'cs_responsavel', type: 'TEXT' },
        { name: 'vendedor', type: 'TEXT' }
      ];
      
      for (const col of requiredColumns) {
        try {
          await db.execute(sql.raw(`
            ALTER TABLE "Clickup".cup_data_hist 
            ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
          `));
        } catch (e) {
          // Ignorar se coluna já existe
        }
      }
      
      console.log('[database] Cup Data Hist table columns ensured');
    }
  } catch (error) {
    console.error('[database] Error initializing Cup Data Hist table:', error);
  }
}

export async function createPerformanceIndexes(): Promise<void> {
  try {
    const indexes = [
      { name: 'idx_cup_contratos_id_task', table: '"Clickup".cup_contratos', column: 'id_task' },
      { name: 'idx_cup_contratos_id_subtask', table: '"Clickup".cup_contratos', column: 'id_subtask' },
      { name: 'idx_cup_contratos_status', table: '"Clickup".cup_contratos', column: 'status' },
      { name: 'idx_cup_clientes_task_id', table: '"Clickup".cup_clientes', column: 'task_id' },
      { name: 'idx_cup_clientes_cnpj', table: '"Clickup".cup_clientes', column: 'cnpj' },
      { name: 'idx_caz_clientes_cnpj', table: '"Conta Azul".caz_clientes', column: 'cnpj' },
      { name: 'idx_caz_clientes_ids', table: '"Conta Azul".caz_clientes', column: 'ids' },
    ];

    for (const idx of indexes) {
      try {
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})`));
      } catch (e) {
        // Ignorar se índice já existe
      }
    }
    
    console.log('[database] Performance indexes created/verified');
  } catch (error) {
    console.error('[database] Error creating performance indexes:', error);
  }
}
