import { db } from "../db";
import { sql } from "drizzle-orm";

async function updateAssinfyConfig() {
  try {
    await db.execute(sql`
      UPDATE staging.assinafy_config 
      SET api_key = 'pIk49OAyZEmKphJL-Dcsg3J93tPVGCte8gs3j3Q0pF0abFRBXdbOQGCr6byFhzaX',
          account_id = '101532935facd18fad5c29ac398e',
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
