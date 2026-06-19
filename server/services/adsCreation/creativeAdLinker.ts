/**
 * Linker tpId ↔ ad_id.
 *
 * Toda criação de ad batiza o anúncio com `nomeFinal`, que começa com o `tpId` (TP01, TP02…).
 * Esse mesmo prefixo é o que liga o anúncio do Meta de volta à linha da Biblioteca — e funciona
 * para os DOIS caminhos de publicação:
 *   - via Cortex ("Criar Campanhas")  → chamado pós-criação com source="creation"
 *   - manual no Gerenciador do Meta    → chamado no sync de métricas com source="name_match"
 *
 * Idempotente: UNIQUE(creative_id, ad_id) + onConflictDoNothing. Re-rodar não duplica e
 * preserva a `source` da primeira vez que o vínculo foi visto.
 */

import { and, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  creativesLibrary,
  creativeAdLinks,
  type InsertCreativeAdLink,
} from "@shared/schema";

const TP_PREFIX = /^(TP\d+)/i;

/** Extrai o tpId (TP##) do início do nome do anúncio, se houver. */
export function extractTpId(adName: string | null | undefined): string | null {
  if (!adName) return null;
  const m = adName.trim().match(TP_PREFIX);
  return m ? m[1].toUpperCase() : null;
}

export interface LinkableAd {
  adId: string;
  adName?: string | null;
  tpId?: string | null; // opcional — quando o chamador já sabe o tpId (ex: criação)
}

export interface LinkResult {
  linked: number; // vínculos novos criados
  skipped: number; // ads sem tpId resolvido ou já vinculados
  unmatchedTpIds: string[]; // tpIds que não existem na Biblioteca
}

export async function linkAdsByName(
  ads: LinkableAd[],
  opts: { source: "creation" | "name_match" },
): Promise<LinkResult> {
  // Resolve o tpId de cada ad: campo explícito tem prioridade, senão o prefixo do nome.
  const resolved = ads
    .map((a) => ({
      adId: a.adId ? String(a.adId) : "",
      tpId: a.tpId ? a.tpId.toUpperCase() : extractTpId(a.adName),
    }))
    .filter((a): a is { adId: string; tpId: string } => Boolean(a.adId && a.tpId));

  if (resolved.length === 0) {
    return { linked: 0, skipped: ads.length, unmatchedTpIds: [] };
  }

  // Mapa tpId -> creativeId numa query só.
  const tpIds = Array.from(new Set(resolved.map((a) => a.tpId)));
  const rows = await db
    .select({ id: creativesLibrary.id, tpId: creativesLibrary.tpId })
    .from(creativesLibrary)
    .where(and(isNull(creativesLibrary.deletedAt), inArray(creativesLibrary.tpId, tpIds)));
  const byTp = new Map(rows.map((r) => [r.tpId.toUpperCase(), r.id]));

  const values: InsertCreativeAdLink[] = [];
  const unmatched = new Set<string>();
  const seen = new Set<string>(); // dedup intra-lote por (creativeId|adId)
  for (const a of resolved) {
    const creativeId = byTp.get(a.tpId);
    if (!creativeId) {
      unmatched.add(a.tpId);
      continue;
    }
    const key = `${creativeId}|${a.adId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    values.push({ creativeId, tpId: a.tpId, adId: a.adId, source: opts.source });
  }

  if (values.length === 0) {
    return { linked: 0, skipped: ads.length, unmatchedTpIds: Array.from(unmatched) };
  }

  const inserted = await db
    .insert(creativeAdLinks)
    .values(values)
    .onConflictDoNothing({
      target: [creativeAdLinks.creativeId, creativeAdLinks.adId],
    })
    .returning({ id: creativeAdLinks.id });

  return {
    linked: inserted.length,
    skipped: ads.length - inserted.length,
    unmatchedTpIds: Array.from(unmatched),
  };
}
