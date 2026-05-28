/**
 * Classifica cada disparo de WhatsApp por:
 *  - PADRÃO DE COPY (Contraste, Loss Aversion, Hook Provocativo…) — via Claude haiku,
 *    sobre o texto da mensagem. Cacheado em cortex_core.broadcast_classification.
 *  - BASE/SEGMENTO — inferida pelas TAGS dos destinatários (base-tag-map), sem IA.
 *
 * Isso destrava "Performance por padrão de copy", Top 5 e a aba Inteligência:
 * cruzar padrão × base × performance real (abertura, reunião, venda atribuída).
 */

import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db, pool } from "../db";
import { PADROES_COPY_LABEL, type PadraoKey } from "../../shared/ghl-broadcast/types";
import { BASES_DISPONIVEIS, getBaseFiltroComAliases, contatoSatisfazBase } from "../../shared/ghl-broadcast/base-tag-map";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
const MODEL = "claude-haiku-4-5-20251001";

const PADRAO_KEYS = Object.keys(PADROES_COPY_LABEL) as PadraoKey[];

export interface PadraoClassificado {
  padrao: PadraoKey | null;
  motivo: string;
}

function buildPrompt(body: string): string {
  const opcoes = PADRAO_KEYS.map((k) => `- ${k}: ${PADROES_COPY_LABEL[k]}`).join("\n");
  return `Você classifica o PADRÃO DE COPY de uma mensagem de WhatsApp marketing (B2B, mercado brasileiro).

Escolha exatamente UM padrão da lista (use a CHAVE em maiúsculas):
${opcoes}

Responda APENAS um JSON válido, sem texto antes ou depois:
{ "padrao": "<CHAVE>", "motivo": "<frase curta justificando>" }

Mensagem:
${body}`;
}

/** Classifica o padrão de copy de um texto (Claude). Degrada pra null se IA indisponível. */
export async function classificarPadrao(body: string): Promise<PadraoClassificado> {
  if (!body?.trim() || !process.env.ANTHROPIC_API_KEY) {
    return { padrao: null, motivo: "Sem texto ou IA indisponível." };
  }
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });
    const block = response.content[0];
    const raw = block.type === "text" ? block.text : "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { padrao?: string; motivo?: string };
    const padrao = PADRAO_KEYS.includes(parsed.padrao as PadraoKey) ? (parsed.padrao as PadraoKey) : null;
    return { padrao, motivo: parsed.motivo || "Classificado por IA." };
  } catch (err: any) {
    console.error("[broadcastClassifier] IA falhou:", err.message);
    return { padrao: null, motivo: "Falha na classificação IA." };
  }
}

/** Infere a base do disparo pela tag dos destinatários: a base que mais contatos satisfazem. */
export function inferirBase(recipientTags: (string[] | null)[]): { base: string | null; matchPct: number } {
  const total = recipientTags.length;
  if (total === 0) return { base: null, matchPct: 0 };
  let melhor: { base: string; count: number } | null = null;
  for (const base of BASES_DISPONIVEIS) {
    const filtro = getBaseFiltroComAliases(base);
    if (!filtro) continue;
    let count = 0;
    for (const tags of recipientTags) if (contatoSatisfazBase(tags, filtro)) count++;
    if (!melhor || count > melhor.count) melhor = { base, count };
  }
  if (!melhor || melhor.count === 0) return { base: null, matchPct: 0 };
  return { base: melhor.base, matchPct: +(melhor.count / total).toFixed(3) };
}

interface GrupoDisparo {
  id: string;
  source: string;
  day: string; // YYYY-MM-DD
  hash: string;
  sample_body: string | null;
}

/**
 * Enriquece os disparos do período: classifica padrão (cache, pula os já feitos) + infere base.
 * Retorna quantos foram classificados nesta execução.
 */
export async function enrichBroadcasts(opts: { from: Date; to: Date; reclassify?: boolean }): Promise<{ classificados: number; total: number }> {
  const { from, to, reclassify } = opts;

  const grupos = await db.execute(sql`
    SELECT
      'wa-' || TO_CHAR(DATE_TRUNC('day', date_added), 'YYYYMMDD') || '-' || source || '-' || SUBSTR(MD5(COALESCE(body, '')), 1, 8) AS id,
      source,
      TO_CHAR(DATE_TRUNC('day', date_added), 'YYYY-MM-DD') AS day,
      SUBSTR(MD5(COALESCE(body, '')), 1, 8) AS hash,
      MIN(body) AS sample_body
    FROM cortex_core.ghl_messages
    WHERE direction = 'outbound' AND source IN ('workflow', 'bulk_actions', 'campaign')
      AND date_added BETWEEN ${from} AND ${to} AND body IS NOT NULL AND body <> ''
    GROUP BY DATE_TRUNC('day', date_added), source, SUBSTR(MD5(COALESCE(body, '')), 1, 8)
    HAVING COUNT(DISTINCT contact_id) >= 10
  `);
  const lista = ((grupos as any).rows ?? []) as GrupoDisparo[];

  let already = new Set<string>();
  if (!reclassify) {
    const ex = await pool.query(`SELECT broadcast_id FROM cortex_core.broadcast_classification WHERE broadcast_id = ANY($1::text[])`, [lista.map((g) => g.id)]);
    already = new Set((ex.rows ?? []).map((r: any) => r.broadcast_id));
  }

  let classificados = 0;
  for (const g of lista) {
    if (already.has(g.id)) continue;

    // tags dos destinatários do disparo
    const tagsRes = await pool.query(
      `SELECT c.tags FROM cortex_core.ghl_messages m
       JOIN cortex_core.ghl_contacts c ON c.id = m.contact_id
       WHERE m.direction = 'outbound' AND m.source = $1
         AND DATE_TRUNC('day', m.date_added) = $2::date
         AND SUBSTR(MD5(COALESCE(m.body, '')), 1, 8) = $3`,
      [g.source, g.day, g.hash],
    );
    const recipientTags = (tagsRes.rows ?? []).map((r: any) => r.tags as string[] | null);
    const { base, matchPct } = inferirBase(recipientTags);
    const { padrao, motivo } = await classificarPadrao(g.sample_body || "");

    await pool.query(
      `INSERT INTO cortex_core.broadcast_classification (broadcast_id, padrao, padrao_motivo, base, base_match_pct, classified_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (broadcast_id) DO UPDATE SET
         padrao = EXCLUDED.padrao, padrao_motivo = EXCLUDED.padrao_motivo,
         base = EXCLUDED.base, base_match_pct = EXCLUDED.base_match_pct, classified_at = NOW()`,
      [g.id, padrao, motivo, base, matchPct],
    );
    classificados++;
  }

  return { classificados, total: lista.length };
}
