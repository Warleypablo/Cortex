import { db } from "../db";
import { sql } from "drizzle-orm";

async function updateAssinfyConfig() {
  try {
    const apiKey = process.env.ASSINAFY_API_KEY;
    const accountId = process.env.ASSINAFY_ACCOUNT_ID;
    if (!apiKey || !accountId) {
      throw new Error('ASSINAFY_API_KEY and ASSINAFY_ACCOUNT_ID environment variables are required');
    }
    await db.execute(sql`
      UPDATE cortex_core.assinafy_config
      SET api_key = ${apiKey},
          account_id = ${accountId},
          data_atualizacao = CURRENT_TIMESTAMP
      WHERE ativo = true
    `);
    console.log('Credenciais Assinafy atualizadas com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar:', error);
  }
  process.exit(0);
}

updateAssinfyConfig();
