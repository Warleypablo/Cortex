/**
 * Reprocessa o SENTIMENTO de respostas já gravadas em broadcast_lead_events
 * aplicando a regra determinística atual (classificarPorRegra) COM o contexto do
 * disparo (origem_body) — pega, por exemplo, quem respondeu a palavra-chave do CTA
 * (ex.: "UGC") e estava contado como "neutra".
 *
 * Escopo seguro: só corrige linhas hoje 'neutra' cuja REGRA (sem IA, alta precisão)
 * dá um rótulo mais informativo (positiva/negativa/opt_out). Não mexe em quem já
 * está classificado com intenção. O reprocessamento por IA das ambíguas restantes
 * acontece pela atribuição normal (self-heal) quando desejado.
 *
 * Uso:
 *   DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/reclassify-broadcast-sentiment.ts           # dry-run
 *   DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/reclassify-broadcast-sentiment.ts --apply    # grava
 *   ... --from=2026-06-01 --to=2026-06-30                                                                 # janela opcional
 *   ... --ia                                                                                              # ambíguas passam de novo pela IA (custa tokens)
 *
 * --ia: onde a regra não decide (null), chama classificarResposta (IA com o prompt
 * atual) em vez de manter 'neutra'. Use com janela (--from/--to) pra limitar custo.
 */

import { pool } from "../server/db";
import { classificarPorRegra, classificarResposta } from "../server/services/replyClassifier";

const APPLY = process.argv.includes("--apply");
const USE_IA = process.argv.includes("--ia");
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const FROM = arg("from");
const TO = arg("to");

async function main() {
  const cond: string[] = ["e.sentiment = 'neutra'"];
  const params: any[] = [];
  if (FROM) { params.push(FROM); cond.push(`e.reply_at >= $${params.length}`); }
  if (TO) { params.push(TO + " 23:59:59"); cond.push(`e.reply_at <= $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT e.reply_message_id, e.reply_body,
       (SELECT o.body FROM cortex_core.ghl_messages o
         WHERE o.conversation_id = e.conversation_id AND o.direction='outbound'
           AND o.source IN ('workflow','bulk_actions','campaign') AND o.date_added < e.reply_at
         ORDER BY o.date_added DESC LIMIT 1) AS origem_body
     FROM cortex_core.broadcast_lead_events e
     WHERE ${cond.join(" AND ")}`,
    params,
  );

  const flips: Record<string, number> = {};
  let changed = 0;
  for (const r of rows as any[]) {
    let cls = classificarPorRegra(r.reply_body || "", r.origem_body);
    if (!cls && USE_IA) {
      cls = await classificarResposta(r.reply_body || "", r.origem_body);
    }
    if (!cls || cls.sentiment === "neutra") continue;
    flips[cls.sentiment] = (flips[cls.sentiment] ?? 0) + 1;
    changed++;
    if (USE_IA) console.log(`  ${JSON.stringify(r.reply_body)} → ${cls.sentiment} (${cls.fonte}: ${cls.motivo})`);
    if (APPLY) {
      await pool.query(
        `UPDATE cortex_core.broadcast_lead_events
         SET sentiment = $2, sentiment_motivo = $3, sentiment_fonte = $4
         WHERE reply_message_id = $1`,
        [r.reply_message_id, cls.sentiment, cls.motivo, cls.fonte],
      );
    }
  }

  console.log(`'neutra' avaliadas: ${rows.length} | modo: ${APPLY ? "APLICAR" : "DRY-RUN"}`);
  console.log(`reclassificadas (neutra → intenção): ${changed}`);
  console.log("por novo sentimento:", flips);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
