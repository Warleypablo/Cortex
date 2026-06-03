import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { ProductTarget } from "./types";

/**
 * Lê targets de Growth do mês corrente diretamente de
 * `meta_ads.growth_budgets`. Esta tabela é a mesma editada pela página
 * `PlanejamentoMetas.tsx` — então o agente sempre opera contra os números
 * mais recentes que o time de Growth definiu.
 *
 * Mapeamento: produto (token extraído do nome da campanha, ex: "Creators")
 *  ↔ funil (coluna no banco). Hoje os nomes batem 1:1.
 *
 * A JSONB `metricas` tem chaves: `cpmql`, `cpl`, `percMqls`, etc.
 * Usamos `funil = 'todos'` como default; se houver linhas mais específicas
 * por segmento agrupamos médias.
 */

const TOLERANCIA_PCT_DEFAULT = 10;

interface CachedTargets {
  monthKey: string;
  targets: Record<string, ProductTarget>;
  loadedAt: number;
}

let cache: CachedTargets | null = null;
const CACHE_TTL_MS = 60_000;

function currentMonthKey(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export async function loadTargetsForCurrentMonth(): Promise<
  Record<string, ProductTarget>
> {
  const monthKey = currentMonthKey();
  if (
    cache &&
    cache.monthKey === monthKey &&
    Date.now() - cache.loadedAt < CACHE_TTL_MS
  ) {
    return cache.targets;
  }

  const rows: any = await db.execute(sql`
    SELECT funil, segmento, metricas
    FROM meta_ads.growth_budgets
    WHERE mes = ${monthKey}
      AND funil <> 'todos'
  `);

  const byFunil: Record<string, Array<Record<string, any>>> = {};
  for (const row of rows.rows ?? rows) {
    const funil = String(row.funil ?? "").trim();
    if (!funil) continue;
    const metricas = (row.metricas ?? {}) as Record<string, any>;
    if (!byFunil[funil]) byFunil[funil] = [];
    byFunil[funil].push(metricas);
  }

  const targets: Record<string, ProductTarget> = {};
  for (const [funil, metricasList] of Object.entries(byFunil)) {
    const cpmql = avgNumber(metricasList, "cpmql");
    const percMql = avgNumber(metricasList, "percMqls");
    const cpl = avgNumber(metricasList, "cpl");
    if (cpmql === null) continue;
    targets[funil] = {
      produto: funil,
      cpmqlAlvo: cpmql,
      mqlMinPct: percMql,
      cplAlvo: cpl,
      toleranciaPct: TOLERANCIA_PCT_DEFAULT,
    };
  }

  cache = { monthKey, targets, loadedAt: Date.now() };
  return targets;
}

function avgNumber(
  rows: Array<Record<string, any>>,
  key: string,
): number | null {
  const values: number[] = [];
  for (const row of rows) {
    const raw = row[key];
    if (raw === undefined || raw === null) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) values.push(n);
  }
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function knownProdutos(targets: Record<string, ProductTarget>): string[] {
  return Object.keys(targets);
}

export function clearTargetsCache(): void {
  cache = null;
}
