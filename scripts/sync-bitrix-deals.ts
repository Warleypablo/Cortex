/**
 * Refresh incremental dos deals do Bitrix24 → "Bitrix".crm_deal (campos do funil).
 *
 * Por quê: o espelho completo do crm_deal é mantido por um processo externo com
 * cadência ~diária. O funil de broadcast (reunião marcada / compareceu / venda)
 * lê esse espelho — sem este refresh, o que o SDR faz hoje só aparece amanhã.
 * Este job traz os deals modificados desde a última marca d'água (MAX(date_modify)
 * do próprio espelho) e atualiza SOMENTE os campos que o funil usa; as demais
 * colunas continuam sendo responsabilidade do sync externo.
 *
 * Mapeamento de campos (validado empiricamente contra os deals 39656/40568/8222
 * em 2026-06-11; o webhook não expõe os títulos dos UF):
 *   STAGE_ID               → stage_name (via crm.dealcategory.stage.list por categoria)
 *   CLOSEDATE              → data_fechamento
 *   UF_CRM_1753386683      → data_reuniao_agendada
 *   UF_CRM_1755642298      → data_reuniao_realizada
 *   UF_CRM_1752256871802   → valor_recorrente  (money "20000|BRL")
 *   UF_CRM_1752256743002   → valor_pontual     (money "6997|BRL")
 *
 * Timestamps: o espelho guarda date_create/date_modify como wall-clock do portal
 * (UTC+3), sem timezone — mantemos a mesma convenção.
 *
 * Usa BITRIX_WEBHOOK_URL (escopo crm). Idempotente.
 * Uso: npx tsx scripts/sync-bitrix-deals.ts
 */

import "dotenv/config";
import { pool } from "../server/db";

const PAGE_SIZE = 50; // Bitrix default

const F_REUNIAO_AGENDADA = "UF_CRM_1753386683";
const F_REUNIAO_REALIZADA = "UF_CRM_1755642298";
const F_VALOR_RECORRENTE = "UF_CRM_1752256871802";
const F_VALOR_PONTUAL = "UF_CRM_1752256743002";
// Campos comerciais (closer/sdr/funil/mql/origem) — sem eles, deals novos entram
// sem responsável e quebram os rankings/funil das telas de Comercial e Gestão de Receita.
const F_SDR = "UF_CRM_1752257983";
const F_CLOSER = "UF_CRM_1753386868";
const F_FNL_NGC = "UF_CRM_1753388612";
const F_MQL = "UF_CRM_1753387697";
const F_FONTE = "UF_CRM_1753388753";
const F_SEGMENTO = "UF_CRM_1753447931";

const SELECT_FIELDS = [
  "ID", "TITLE", "DATE_CREATE", "DATE_MODIFY", "CATEGORY_ID", "STAGE_ID",
  "CONTACT_ID", "COMPANY_ID", "CLOSEDATE", "SOURCE_ID", "ASSIGNED_BY_ID",
  F_REUNIAO_AGENDADA, F_REUNIAO_REALIZADA, F_VALOR_RECORRENTE, F_VALOR_PONTUAL,
  F_SDR, F_CLOSER, F_FNL_NGC, F_MQL, F_FONTE, F_SEGMENTO,
];

// valor de campo string do Bitrix → string truncada ou null
const str = (v: unknown, max = 255): string | null => {
  if (v == null || v === "") return null;
  return String(v).slice(0, max);
};

async function bx<T = any>(base: string, method: string, body: unknown): Promise<T> {
  const r = await fetch(`${base}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} failed: ${r.status}`);
  const data: any = await r.json();
  if (data.error) throw new Error(`${method}: ${data.error_description || data.error}`);
  return data as T;
}

/** "2026-06-11T04:01:23+03:00" → "2026-06-11 04:01:23" (wall-clock do portal, padrão do espelho). */
function wallClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : null;
}

/** Data (YYYY-MM-DD) de um date/datetime Bitrix; "" → null. */
function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Money Bitrix "20000|BRL" → 20000; ""/null → null. */
function money(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(String(v).split("|")[0]);
  return Number.isFinite(n) ? n : null;
}

/** STAGE_ID→nome por categoria: "" e "C{id}:" usam mapas distintos. */
async function fetchStageMaps(base: string): Promise<{ stages: Map<string, string>; categories: Map<string, string> }> {
  const stages = new Map<string, string>();
  const categories = new Map<string, string>([["0", ""]]);

  const cats = await bx<{ result: Array<{ ID: string; NAME: string }> }>(base, "crm.dealcategory.list", {});
  for (const c of cats.result || []) categories.set(String(c.ID), c.NAME);

  const catIds = ["0", ...(cats.result || []).map((c) => String(c.ID))];
  for (const id of catIds) {
    const st = await bx<{ result: Array<{ STATUS_ID: string; NAME: string }> }>(
      base, "crm.dealcategory.stage.list", { id: Number(id) },
    );
    for (const s of st.result || []) {
      // Categorias custom já vêm com STATUS_ID prefixado ("C4:NEW"); a default vem sem.
      const key = s.STATUS_ID.includes(":") || id === "0" ? s.STATUS_ID : `C${id}:${s.STATUS_ID}`;
      stages.set(key, s.NAME);
    }
  }
  return { stages, categories };
}

export async function syncBitrixDeals(opts: { verbose?: boolean; sinceHours?: number } = {}): Promise<{ totalSynced: number; totalSeen: number }> {
  const log = opts.verbose ? (m: string) => console.log(m) : () => {};
  const base = (process.env.BITRIX_WEBHOOK_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("BITRIX_WEBHOOK_URL não configurada");

  // Marca d'água do espelho (wall-clock do portal), com 15 min de margem.
  // Formatada como texto direto no SQL pra evitar conversão de timezone do driver
  // (a coluna é timestamp sem tz guardando hora do portal, UTC+3).
  // opts.sinceHours força uma janela maior (ex.: reprocesso após correção).
  const hw = opts.sinceHours
    ? await pool.query(
        `SELECT TO_CHAR(NOW() AT TIME ZONE 'UTC' + INTERVAL '3 hours' - ($1 || ' hours')::interval, 'YYYY-MM-DD HH24:MI:SS') AS hw`,
        [opts.sinceHours],
      )
    : await pool.query(
        `SELECT TO_CHAR(MAX(date_modify) - INTERVAL '15 minutes', 'YYYY-MM-DD HH24:MI:SS') AS hw FROM "Bitrix".crm_deal`,
      );
  const sinceStr: string =
    hw.rows?.[0]?.hw ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
  log(`→ Deals modificados desde ${sinceStr} (wall-clock do portal)`);

  const { stages, categories } = await fetchStageMaps(base);
  log(`  ${stages.size} estágios em ${categories.size} categorias`);

  let start = 0;
  let totalSeen = 0;
  let totalSynced = 0;
  while (true) {
    const page = await bx<{ result: any[]; next?: number; total?: number }>(base, "crm.deal.list", {
      filter: { ">=DATE_MODIFY": sinceStr },
      select: SELECT_FIELDS,
      order: { DATE_MODIFY: "ASC" },
      start,
    });
    const rows = page.result || [];
    if (!rows.length) break;

    for (const d of rows) {
      totalSeen++;
      const stageName = stages.get(String(d.STAGE_ID)) ?? null;
      const categoryName = categories.get(String(d.CATEGORY_ID ?? "0")) || null;
      const contactId = d.CONTACT_ID && Number(d.CONTACT_ID) > 0 ? Number(d.CONTACT_ID) : null;
      const companyId = d.COMPANY_ID && Number(d.COMPANY_ID) > 0 ? Number(d.COMPANY_ID) : null;

      await pool.query(
        `INSERT INTO "Bitrix".crm_deal (
           id, title, date_create, date_modify, category_id, category_name,
           stage_name, contact_id, company_id, data_fechamento,
           data_reuniao_agendada, data_reuniao_realizada,
           valor_recorrente, valor_pontual,
           sdr, closer, fnl_ngc, mql, source, fonte,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           date_modify = EXCLUDED.date_modify,
           stage_name = EXCLUDED.stage_name,
           category_id = EXCLUDED.category_id,
           category_name = EXCLUDED.category_name,
           contact_id = EXCLUDED.contact_id,
           company_id = EXCLUDED.company_id,
           data_fechamento = EXCLUDED.data_fechamento,
           data_reuniao_agendada = EXCLUDED.data_reuniao_agendada,
           data_reuniao_realizada = EXCLUDED.data_reuniao_realizada,
           valor_recorrente = EXCLUDED.valor_recorrente,
           valor_pontual = EXCLUDED.valor_pontual,
           sdr = COALESCE(EXCLUDED.sdr, "Bitrix".crm_deal.sdr),
           closer = COALESCE(EXCLUDED.closer, "Bitrix".crm_deal.closer),
           fnl_ngc = COALESCE(EXCLUDED.fnl_ngc, "Bitrix".crm_deal.fnl_ngc),
           mql = COALESCE(EXCLUDED.mql, "Bitrix".crm_deal.mql),
           source = COALESCE(EXCLUDED.source, "Bitrix".crm_deal.source),
           fonte = COALESCE(EXCLUDED.fonte, "Bitrix".crm_deal.fonte),
           updated_at = NOW()`,
        [
          Number(d.ID), d.TITLE ?? null, wallClock(d.DATE_CREATE), wallClock(d.DATE_MODIFY),
          d.CATEGORY_ID != null ? Number(d.CATEGORY_ID) : null, categoryName,
          stageName, contactId, companyId, dateOnly(d.CLOSEDATE),
          dateOnly(d[F_REUNIAO_AGENDADA]), dateOnly(d[F_REUNIAO_REALIZADA]),
          money(d[F_VALOR_RECORRENTE]), money(d[F_VALOR_PONTUAL]),
          str(d[F_SDR]), str(d[F_CLOSER]), str(d[F_FNL_NGC]), str(d[F_MQL]), str(d.SOURCE_ID), str(d[F_FONTE]),
        ],
      );
      totalSynced++;
    }

    log(`  página start=${start}: ${rows.length} deals (total visto: ${totalSeen}/${page.total ?? "?"})`);
    if (typeof page.next !== "number") break;
    start = page.next;
  }

  log(`✓ ${totalSynced} deals atualizados`);
  return { totalSynced, totalSeen };
}

// Execução direta via CLI (aceita --since-hours=N pra reprocessar janela maior)
if (process.argv[1] && /sync-bitrix-deals/.test(process.argv[1])) {
  const sinceArg = process.argv.find((a) => a.startsWith("--since-hours="));
  const sinceHours = sinceArg ? parseInt(sinceArg.split("=")[1], 10) : undefined;
  syncBitrixDeals({ verbose: true, sinceHours })
    .then(({ totalSynced, totalSeen }) => {
      console.log(`FIM: ${totalSynced}/${totalSeen} deals sincronizados`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("FATAL:", err);
      process.exit(1);
    });
}
