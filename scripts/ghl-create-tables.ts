/**
 * Migration: cria tabelas GHL em cortex_core (mesmo padrão Instagram/YouTube).
 *
 * Idempotente — pode rodar várias vezes sem efeito colateral.
 *
 * Tabelas criadas (todas em cortex_core):
 *  - ghl_contacts             — contatos do GHL (~48k)
 *  - ghl_conversations        — conversas (~46k, filtráveis por tipo)
 *  - ghl_messages             — mensagens individuais
 *  - ghl_email_campaigns      — campanhas de email (~191)
 *  - ghl_email_events         — eventos via webhook (open/click/bounce)
 *  - ghl_tags_snapshot        — snapshot diário de tags
 *  - ghl_sync_runs            — audit das execuções de sync
 *
 * Uso:
 *   npx tsx scripts/ghl-create-tables.ts
 *
 * Documentação: docs/handover-ghl-integracao.md
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  console.log('Criando tabelas ghl_* em cortex_core...\n');

  const sql = readFileSync(
    join(process.cwd(), 'migrations', '2026-05-22-ghl-schema.sql'),
    'utf8',
  );

  try {
    await pool.query(sql);
    console.log('✅ Schema GHL aplicado com sucesso');
  } catch (e: any) {
    console.log(`❌ ${e.message}`);
    throw e;
  }

  // Confirma quais tabelas existem
  const result = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'cortex_core' AND table_name LIKE 'ghl_%'
    ORDER BY table_name
  `);
  console.log(`\nTabelas criadas (${result.rows.length}):`);
  for (const row of result.rows) {
    console.log(`  • cortex_core.${row.table_name}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
