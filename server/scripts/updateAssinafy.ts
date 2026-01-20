import { db } from "../db";
import { sql } from "drizzle-orm";

async function updateAssinfyConfig() {
  try {
    await db.execute(sql`
      UPDATE cortex_core.assinafy_config 
      SET api_key = '***REMOVED***',
          account_id = '***REMOVED***',
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
