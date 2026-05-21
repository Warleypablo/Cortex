import { config } from 'dotenv';
config({ path: '.env' });
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

function arg(name: string, fallback?: string) {
  const f = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(f));
  return found ? found.slice(f.length) : fallback;
}

function print(title: string, rows: any[]) {
  console.log(`\n=== ${title} ===`);
  if (!rows || rows.length === 0) { console.log('(sem resultados)'); return; }
  console.table(rows);
}

async function main() {
  const startDate = arg('start') || '2026-04-01';
  const endDate = arg('end') || '2026-05-05';
  console.log(`\n📊 Auditoria de UTMs no Bitrix — ${startDate} → ${endDate}`);

  // 0) Quais colunas UTM/atribuição existem em crm_deal?
  const cols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'Bitrix' AND table_name = 'crm_deal'
      AND (column_name ILIKE '%utm%' OR column_name ILIKE '%source%'
           OR column_name ILIKE '%origem%' OR column_name ILIKE '%canal%'
           OR column_name ILIKE '%traffic%' OR column_name ILIKE '%campanha%'
           OR column_name ILIKE '%campaign%')
    ORDER BY column_name
  `);
  print('0) Colunas relacionadas a atribuição em "Bitrix".crm_deal', cols.rows);

  // 1) Distribuição de utm_source (top 30)
  const utmSource = await pool.query(`
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(utm_source)), ''), '(VAZIO)') as utm_source,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
    GROUP BY 1 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('1) utm_source — top 30 valores recebidos no período', utmSource.rows);

  // 2) Distribuição de utm_campaign
  const utmCampaign = await pool.query(`
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(utm_campaign)), ''), '(VAZIO)') as utm_campaign,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
    GROUP BY 1 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('2) utm_campaign — top 30', utmCampaign.rows);

  // 3) Distribuição de utm_content
  const utmContent = await pool.query(`
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(utm_content)), ''), '(VAZIO)') as utm_content,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
    GROUP BY 1 ORDER BY leads DESC LIMIT 30
  `, [startDate, endDate]);
  print('3) utm_content — top 30', utmContent.rows);

  // 4) Combinação (source, campaign) — pra entender mapeamento Meta/IG
  const combo = await pool.query(`
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(utm_source)), ''), '(VAZIO)') as utm_source,
      COALESCE(NULLIF(LOWER(TRIM(utm_campaign)), ''), '(VAZIO)') as utm_campaign,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
    GROUP BY 1, 2 ORDER BY leads DESC LIMIT 40
  `, [startDate, endDate]);
  print('4) Combinações (utm_source × utm_campaign) — top 40', combo.rows);

  // 5) Campo "source" do Bitrix (não é UTM, é a origem cadastrada no CRM)
  const sourceCrm = await pool.query(`
    SELECT
      COALESCE(NULLIF(source, ''), '(VAZIO)') as source,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
    GROUP BY 1 ORDER BY leads DESC
  `, [startDate, endDate]);
  print('5) source do Bitrix (não confundir com utm_source) — distribuição', sourceCrm.rows);

  // 6) Existe utm_content/utm_term? (campos auxiliares)
  const extras = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE utm_content IS NOT NULL AND utm_content <> '') as com_utm_content,
      COUNT(*) FILTER (WHERE utm_term IS NOT NULL AND utm_term <> '') as com_utm_term,
      COUNT(*) as total_leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
  `, [startDate, endDate]);
  print('6) Preenchimento de utm_content / utm_term', extras.rows);

  // 7) Termos suspeitos para Instagram em qualquer campo UTM
  const igMatch = await pool.query(`
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(utm_source)), ''), '(VAZIO)') as utm_source,
      COALESCE(NULLIF(LOWER(TRIM(utm_medium)), ''), '(VAZIO)') as utm_medium,
      COALESCE(NULLIF(LOWER(TRIM(utm_campaign)), ''), '(VAZIO)') as utm_campaign,
      COALESCE(NULLIF(LOWER(TRIM(utm_content)), ''), '(VAZIO)') as utm_content,
      COUNT(*) as leads
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
      AND (
        LOWER(COALESCE(utm_source, ''))   LIKE '%instagram%' OR LOWER(COALESCE(utm_source, ''))   = 'ig' OR
        LOWER(COALESCE(utm_campaign, '')) LIKE '%instagram%' OR LOWER(COALESCE(utm_campaign, '')) = 'ig' OR
        LOWER(COALESCE(utm_content, ''))  LIKE '%instagram%' OR LOWER(COALESCE(utm_content, ''))  = 'ig' OR
        LOWER(COALESCE(utm_term, ''))     LIKE '%instagram%' OR LOWER(COALESCE(utm_term, ''))     = 'ig' OR
        LOWER(COALESCE(utm_source, ''))   LIKE '%linktree%' OR LOWER(COALESCE(utm_campaign, '')) LIKE '%linktree%' OR
        LOWER(COALESCE(utm_source, ''))   LIKE '%bio%' OR LOWER(COALESCE(utm_campaign, '')) LIKE '%bio%' OR
        LOWER(COALESCE(utm_source, ''))   LIKE '%lnk%' OR LOWER(COALESCE(utm_campaign, '')) LIKE '%lnk%'
      )
    GROUP BY 1,2,3,4 ORDER BY leads DESC LIMIT 50
  `, [startDate, endDate]);
  print('7) Leads que mencionam "instagram", "ig", "linktree" ou "bio" em QUALQUER UTM', igMatch.rows);

  // 8) Qual % de leads tem utm_source preenchido? Diagnóstico de cobertura
  const cob = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE utm_source IS NULL OR TRIM(utm_source) = '') as leads_sem_utm_source,
      COUNT(*) FILTER (WHERE utm_source IS NOT NULL AND TRIM(utm_source) <> '') as leads_com_utm_source,
      COUNT(*) as total
    FROM "Bitrix".crm_deal
    WHERE created_at >= $1::date AND created_at <= $2::date + INTERVAL '1 day'
  `, [startDate, endDate]);
  print('8) Cobertura de utm_source no período', cob.rows);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
