import { db } from "../db";
import { sql } from "drizzle-orm";

async function importAssinafy() {
  try {
    // Create table if not exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.assinafy_config (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(255),
        api_key VARCHAR(255),
        api_url VARCHAR(255),
        webhook_url VARCHAR(255),
        webhook_secret VARCHAR(255),
        ativo BOOLEAN DEFAULT true,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[assinafy] Table created');

    // Insert data
    await db.execute(sql`
      INSERT INTO cortex_core.assinafy_config (id, account_id, api_key, api_url, webhook_url, webhook_secret, ativo, data_cadastro, data_atualizacao)
      VALUES (
        1,
        'ffaee2469fa51a647e2f2796e4a',
        'Uo3ew1It7z-GyxjXftmqp8XEy0cgGV243R8YfBIvNhv4zR1Q5odhx2hhXP7roOxs',
        'https://api.assinafy.com.br/v1',
        'https://contratos.turbopartners.com.br/api/assinafy_webhook.php',
        NULL,
        true,
        '2025-09-25 15:36:43',
        '2025-09-25 23:04:34'
      )
      ON CONFLICT (id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        api_key = EXCLUDED.api_key,
        api_url = EXCLUDED.api_url,
        webhook_url = EXCLUDED.webhook_url,
        webhook_secret = EXCLUDED.webhook_secret,
        ativo = EXCLUDED.ativo,
        data_cadastro = EXCLUDED.data_cadastro,
        data_atualizacao = EXCLUDED.data_atualizacao
    `);
    console.log('[assinafy] Data imported successfully');

    // Verify
    const result = await db.execute(sql`SELECT * FROM cortex_core.assinafy_config`);
    console.log('[assinafy] Records:', result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('[assinafy] Error:', error);
    process.exit(1);
  }
}

importAssinafy();
