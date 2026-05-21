/**
 * Concede a permissão `growth.criativos_biblioteca` aos 3 approvers da
 * feature de Biblioteca de Criativos.
 *
 * Uso:
 *   npx tsx scripts/grant-creatives-library.ts
 *
 * Idempotente: pode rodar múltiplas vezes.
 */

import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const PERMISSION = "growth.criativos_biblioteca";
const TARGET_EMAILS = [
  "vinicius.ichino@turbopartners.com.br",
  "warleyreserva4@gmail.com",
  "ferramentas@turbopartners.com.br",
];

async function main() {
  for (const email of TARGET_EMAILS) {
    const r = await db.execute(sql`
      SELECT email, name, allowed_routes
      FROM cortex_core.auth_users
      WHERE LOWER(email) = LOWER(${email})
    `);

    if (r.rows.length === 0) {
      console.warn(`⚠️  Usuário ${email} não encontrado — pulando`);
      continue;
    }

    const user = r.rows[0] as {
      email: string;
      name: string;
      allowed_routes: string[] | null;
    };
    const current = user.allowed_routes || [];
    if (current.includes(PERMISSION)) {
      console.log(`ℹ️  ${user.name} (${user.email}) já tem ${PERMISSION}`);
      continue;
    }

    await db.execute(sql`
      UPDATE cortex_core.auth_users
      SET allowed_routes = array_append(allowed_routes, ${PERMISSION})
      WHERE LOWER(email) = LOWER(${email})
    `);
    console.log(`✅ ${PERMISSION} liberada para ${user.name} (${user.email})`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
