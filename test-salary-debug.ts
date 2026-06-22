import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const r = await db.execute(sql`
      SELECT id, nome, salario, squad, status 
      FROM "Inhire".rh_pessoal 
      WHERE LOWER(TRIM(COALESCE(status, ''))) = 'ativo' 
      AND salario IS NOT NULL 
      ORDER BY squad, nome 
      LIMIT 10
    `);
    
    console.log("=== RAW DATA ===");
    for (const row of r.rows as any[]) {
      console.log(JSON.stringify({
        nome: row.nome,
        salario: row.salario,
        salario_type: typeof row.salario,
        squad: row.squad
      }));
    }
  } catch (e: any) {
    console.error("ERROR:", e.message, e.stack);
  }
  process.exit(0);
}
main();
