import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  const r = await db.execute(sql`SELECT id, nome, salario, squad, status FROM "Inhire".rh_pessoal WHERE LOWER(TRIM(COALESCE(status, ''))) = 'ativo' AND salario IS NOT NULL ORDER BY squad, nome LIMIT 15`);
  console.log(JSON.stringify(r.rows, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
