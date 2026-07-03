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
import { BASES_DISPONIVEIS, getBaseFiltro, contatoSatisfazBase, type BaseFiltro } from "../../shared/ghl-broadcast/base-tag-map";

const MODEL = "claude-haiku-4-5-20251001";

// Lazy: só instancia o cliente quando a classificação por IA é chamada (evita
// efeito colateral no import — quebra em ambiente de teste e é desnecessário
// para inferirBase, que não usa IA).
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return _anthropic;
}

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
    const response = await getAnthropic().messages.create({
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

/**
 * Cobertura mínima (fração de destinatários que satisfazem a base) para um disparo
 * ser rotulado numa sub-base específica em vez da base "- Todos" guarda-chuva.
 */
export const COBERTURA_MIN_BASE = 0.9;

/**
 * Piso do fallback: se nenhuma base atinge COBERTURA_MIN_BASE, só rotula com a
 * base dominante se ela cobrir pelo menos a MAIORIA dos destinatários. Abaixo
 * disso o disparo é misto/sem segmento claro → base null (não inventa um rótulo
 * que representa 2% da lista).
 */
export const COBERTURA_MIN_FALLBACK = 0.5;

/**
 * Especificidade de um filtro de base: nº de restrições que precisam valer.
 * As sub-bases (MQLs, faixas de faturamento) adicionam tagsAll/tagsNot sobre a
 * "- Todos" (que só tem tagsAny), então pontuam mais alto — são "mais específicas".
 * Usa o filtro CANÔNICO (sem expandir aliases, que inflaria as contagens).
 */
function especificidade(filtro: BaseFiltro): number {
  return (
    (filtro.tagsAll?.length ?? 0) +
    (filtro.tagsNot?.length ?? 0) +
    ((filtro.tagsAny?.length ?? 0) > 0 ? 1 : 0)
  );
}

/**
 * Infere a base de um disparo pelas tags dos destinatários.
 *
 * As bases "- Todos" (Creators/Geral/IA/CRM) são SUPERCONJUNTOS das sub-bases
 * (MQLs, faixas de faturamento). O argmax antigo ("base que mais contatos
 * satisfazem") portanto sempre elegia a "- Todos" e zerava as sub-bases.
 *
 * Agora: entre as bases cuja COBERTURA (fração de destinatários que satisfazem) é
 * >= COBERTURA_MIN_BASE, escolhe a MAIS ESPECÍFICA. Assim um disparo segmentado
 * (ex.: Creators <30k) cai na sub-base e um disparo amplo (todos os Creators) fica
 * na "- Todos". Se nenhuma base atinge a cobertura mínima (blast misto), rotula a
 * base dominante desde que ela cubra a maioria (COBERTURA_MIN_FALLBACK); senão null.
 *
 * Usa o filtro canônico + contatoSatisfazBase (que já resolve aliases legacy por
 * dentro). Passar o filtro com aliases expandidos quebra o tagsAll das sub-bases
 * (cada alias vira uma tag obrigatória no every()).
 */
export function inferirBase(recipientTags: (string[] | null)[]): { base: string | null; matchPct: number } {
  const total = recipientTags.length;
  if (total === 0) return { base: null, matchPct: 0 };

  const scored: { base: string; cobertura: number; espec: number }[] = [];
  for (const base of BASES_DISPONIVEIS) {
    const filtro = getBaseFiltro(base);
    if (!filtro) continue;
    let count = 0;
    for (const tags of recipientTags) if (contatoSatisfazBase(tags, filtro)) count++;
    if (count === 0) continue;
    scored.push({ base, cobertura: count / total, espec: especificidade(filtro) });
  }
  if (scored.length === 0) return { base: null, matchPct: 0 };

  const candidatas = scored.filter((s) => s.cobertura >= COBERTURA_MIN_BASE);
  const usarEspecificidade = candidatas.length > 0;
  const pool = usarEspecificidade ? candidatas : scored;
  pool.sort((a, b) => {
    if (usarEspecificidade) {
      // Com cobertura suficiente: a mais específica ganha (empate → maior cobertura).
      if (b.espec !== a.espec) return b.espec - a.espec;
      return b.cobertura - a.cobertura;
    }
    // Fallback (blast misto): base dominante = maior cobertura. Empate → a MENOS
    // específica (guarda-chuva), o rótulo mais honesto quando não há segmento claro.
    if (b.cobertura !== a.cobertura) return b.cobertura - a.cobertura;
    return a.espec - b.espec;
  });
  const melhor = pool[0];
  // Fallback com cobertura irrisória (blast misto/sem tags) → não rotula.
  if (!usarEspecificidade && melhor.cobertura < COBERTURA_MIN_FALLBACK) {
    return { base: null, matchPct: +melhor.cobertura.toFixed(3) };
  }
  return { base: melhor.base, matchPct: +melhor.cobertura.toFixed(3) };
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
