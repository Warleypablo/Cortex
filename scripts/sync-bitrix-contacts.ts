/**
 * Sincroniza contatos do Bitrix24 para a tabela "Bitrix".crm_contact.
 *
 * Por quê: a tabela "Bitrix".crm_deal (já espelhada) tem contact_id e company_name,
 * mas NÃO tem telefone. O dashboard de broadcast precisa ligar um respondedor do
 * WhatsApp (identificado por telefone) ao deal do Bitrix. Este sync traz o telefone
 * do contato pra fechar esse elo: respondedor.telefone → crm_contact.phone_normalized
 * → crm_contact.id → crm_deal.contact_id.
 *
 * Usa o BITRIX_WEBHOOK_URL (escopo `crm` já confirmado). Idempotente.
 *
 * Uso:
 *   npx tsx scripts/sync-bitrix-contacts.ts
 */

import "dotenv/config";
import { pool } from "../server/db";
import { normalizePhoneBR } from "../shared/ghl-broadcast/phone";

const PAGE_SIZE = 50; // Bitrix default

/** Extrai o primeiro VALUE de um multifield Bitrix (PHONE/EMAIL vêm como array de {VALUE, VALUE_TYPE}). */
function firstMultifield(field: any): string | null {
  if (!field) return null;
  if (Array.isArray(field)) {
    const v = field.find((x) => x && x.VALUE)?.VALUE;
    return v ? String(v) : null;
  }
  if (typeof field === "string") return field;
  return null;
}

async function ensureTable(): Promise<void> {
  // O schema "Bitrix" já existe (crm_deal etc.) — não recriamos (CREATE SCHEMA exigiria
  // privilégio de CREATE no database, que o usuário da app não tem).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Bitrix".crm_contact (
      id               INTEGER PRIMARY KEY,
      name             TEXT,
      phone_raw        TEXT,
      phone_normalized VARCHAR(20),
      email            TEXT,
      company_name     TEXT,
      raw              JSONB,
      synced_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS crm_contact_phone_norm_idx ON "Bitrix".crm_contact (phone_normalized)`,
  );
}

async function fetchContactsPage(
  webhookBase: string,
  start: number,
): Promise<{ rows: any[]; next: number | null; total: number }> {
  const r = await fetch(`${webhookBase}/crm.contact.list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      select: ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL", "COMPANY_TITLE"],
      start,
      order: { ID: "ASC" },
    }),
  });
  if (!r.ok) throw new Error(`crm.contact.list failed: ${r.status}`);
  const data: any = await r.json();
  return {
    rows: data.result || [],
    next: typeof data.next === "number" ? data.next : null,
    total: data.total || 0,
  };
}

export async function syncBitrixContacts(
  opts: { verbose?: boolean } = {},
): Promise<{ totalSynced: number; totalSeen: number; semTelefone: number }> {
  const log = opts.verbose ? (m: string) => console.log(m) : () => {};
  const base = (process.env.BITRIX_WEBHOOK_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("BITRIX_WEBHOOK_URL não configurada");

  await ensureTable();

  log("→ Sincronizando contatos do Bitrix...");
  let start = 0;
  let totalSynced = 0;
  let totalSeen = 0;
  let semTelefone = 0;
  let pageNum = 0;
  const client = await pool.connect();
  try {
    while (true) {
      const { rows, next, total } = await fetchContactsPage(base, start);
      if (pageNum === 0) log(`  Total estimado: ${total} contatos`);
      pageNum++;
      if (rows.length === 0) break;

      await client.query("BEGIN");
      for (const c of rows) {
        const id = parseInt(c.ID, 10);
        if (!Number.isFinite(id)) continue;
        const nome = [c.NAME, c.LAST_NAME].filter(Boolean).join(" ").trim() || null;
        const phoneRaw = firstMultifield(c.PHONE);
        const phoneNorm = normalizePhoneBR(phoneRaw);
        const email = firstMultifield(c.EMAIL);
        const company = c.COMPANY_TITLE ? String(c.COMPANY_TITLE) : null;
        if (!phoneNorm) semTelefone++;

        await client.query(
          `INSERT INTO "Bitrix".crm_contact (id, name, phone_raw, phone_normalized, email, company_name, raw, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone_raw = EXCLUDED.phone_raw,
             phone_normalized = EXCLUDED.phone_normalized,
             email = EXCLUDED.email,
             company_name = EXCLUDED.company_name,
             raw = EXCLUDED.raw,
             synced_at = NOW()`,
          [id, nome, phoneRaw, phoneNorm, email, company, JSON.stringify(c)],
        );
        totalSynced++;
      }
      await client.query("COMMIT");
      totalSeen += rows.length;
      if (pageNum % 10 === 0) log(`  ... ${totalSeen}/${total} contatos processados`);
      if (next == null) break;
      start = next;
    }
  } finally {
    client.release();
  }

  return { totalSynced, totalSeen, semTelefone };
}

// CLI entrypoint
const isDirectRun =
  process.argv[1]?.endsWith("sync-bitrix-contacts.ts") || process.argv[1]?.endsWith("sync-bitrix-contacts.js");
if (isDirectRun) {
  syncBitrixContacts({ verbose: true })
    .then(({ totalSynced, totalSeen, semTelefone }) => {
      console.log(
        `✅ ${totalSynced} contatos sincronizados (de ${totalSeen} vistos). ${semTelefone} sem telefone normalizável.`,
      );
      return pool.end();
    })
    .catch((err) => {
      console.error("❌", err);
      process.exit(1);
    });
}
