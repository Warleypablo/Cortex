/**
 * Resolve nome de saved audience para o ID que a Meta API espera.
 *
 * Usa /act_X/customaudiences (tradicional + saved) e /act_X/saved_audiences
 * para cobrir os dois tipos de público que aparecem no Gerenciador.
 */

import { metaGet } from "./metaApi";
import type { SavedAudience } from "./types";

interface ListedAudience {
  id: string;
  name: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  subtype?: string;
}

async function paginateList(path: string, fields: string): Promise<ListedAudience[]> {
  const all: ListedAudience[] = [];
  let nextPath: string | null = path;
  let nextParams: Record<string, string> | undefined = { fields, limit: "100" };
  let safety = 0;

  while (nextPath && safety < 20) {
    const data: any = await metaGet(nextPath, nextParams ?? {});
    if (Array.isArray(data.data)) all.push(...data.data);
    const paging = data.paging?.next as string | undefined;
    if (!paging) break;
    // O .next é uma URL completa; extrai pathname relativo + querystring
    try {
      const u = new URL(paging);
      nextPath = u.pathname.replace(/^\/v\d+\.\d+\//, "");
      nextParams = Object.fromEntries(u.searchParams.entries());
      delete nextParams.access_token;
    } catch {
      break;
    }
    safety++;
  }
  return all;
}

// Cache em memória pra evitar bater na Meta toda vez que o diálogo abre.
// Cada chamada paginada custa N requests (até 100 audiences/página). Com 108 audiences
// e cache desligado, abrir o diálogo 5x = 10+ calls de paginação.
const AUDIENCE_CACHE_TTL_MS = 5 * 60 * 1000;
const audienceCache = new Map<string, { at: number; data: SavedAudience[] }>();

async function fetchAudiencesUncached(adAccountId: string): Promise<SavedAudience[]> {
  const [customs, saved] = await Promise.all([
    paginateList(`${adAccountId}/customaudiences`, "id,name,subtype").catch(() => []),
    paginateList(`${adAccountId}/saved_audiences`, "id,name").catch(() => []),
  ]);

  const seen = new Set<string>();
  const out: SavedAudience[] = [];
  for (const a of [...customs, ...saved]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push({
      id: a.id,
      name: a.name,
      approximateCount: a.approximate_count_upper_bound ?? a.approximate_count_lower_bound,
      subtype: a.subtype,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function listAudiences(adAccountId: string, forceRefresh = false): Promise<SavedAudience[]> {
  const cached = audienceCache.get(adAccountId);
  if (!forceRefresh && cached && Date.now() - cached.at < AUDIENCE_CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetchAudiencesUncached(adAccountId);
  audienceCache.set(adAccountId, { at: Date.now(), data });
  return data;
}

export function clearAudienceCache(adAccountId?: string): void {
  if (adAccountId) audienceCache.delete(adAccountId);
  else audienceCache.clear();
}

export async function resolveAudienceByName(
  adAccountId: string,
  name: string,
): Promise<SavedAudience> {
  const audiences = await listAudiences(adAccountId);
  const target = name.trim().toLowerCase();

  const exact = audiences.find((a) => a.name.trim().toLowerCase() === target);
  if (exact) return exact;

  const partial = audiences.filter((a) => a.name.toLowerCase().includes(target));
  if (partial.length === 1) return partial[0];

  if (partial.length > 1) {
    const names = partial.slice(0, 5).map((a) => `"${a.name}"`).join(", ");
    throw new Error(`Múltiplos públicos contêm "${name}": ${names}. Seja mais específico.`);
  }

  throw new Error(`Público salvo "${name}" não encontrado na conta ${adAccountId}.`);
}
