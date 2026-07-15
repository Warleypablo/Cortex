import { sql } from "drizzle-orm";

/** Busca a cotação USD→BRL atual na AwesomeAPI (sem key). */
export async function buscarTaxaAwesomeAPI(): Promise<number> {
  const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
  if (!res.ok) throw new Error(`AwesomeAPI status ${res.status}`);
  const json: any = await res.json();
  const bid = parseFloat(json?.USDBRL?.bid);
  if (!bid || Number.isNaN(bid)) throw new Error("AwesomeAPI: cotação inválida");
  return bid;
}

/** Grava/atualiza a taxa de um mês. fonte='manual' não é sobrescrita pelo job automático. */
export async function upsertTaxaMes(
  db: any, anoMes: string, taxa: number, fonte: "auto" | "manual",
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.custo_cambio_mensal (ano_mes, taxa_usd_brl, fonte, updated_at)
    VALUES (${anoMes}, ${taxa}, ${fonte}, NOW())
    ON CONFLICT (ano_mes) DO UPDATE SET
      taxa_usd_brl = EXCLUDED.taxa_usd_brl,
      fonte = EXCLUDED.fonte,
      updated_at = NOW()
  `);
}

/** Taxa do mês; se ausente usa a última conhecida (estimada=true); se não houver nenhuma, busca on-demand. */
export async function getTaxaMes(db: any, anoMes: string): Promise<{ taxa: number; estimada: boolean }> {
  const r = await db.execute(sql`
    SELECT taxa_usd_brl FROM cortex_core.custo_cambio_mensal WHERE ano_mes = ${anoMes}
  `);
  if (r.rows.length) return { taxa: parseFloat(r.rows[0].taxa_usd_brl), estimada: false };

  const last = await db.execute(sql`
    SELECT taxa_usd_brl FROM cortex_core.custo_cambio_mensal ORDER BY ano_mes DESC LIMIT 1
  `);
  if (last.rows.length) return { taxa: parseFloat(last.rows[0].taxa_usd_brl), estimada: true };

  try {
    const taxa = await buscarTaxaAwesomeAPI();
    await upsertTaxaMes(db, anoMes, taxa, "auto");
    return { taxa, estimada: false };
  } catch {
    return { taxa: 0, estimada: true };
  }
}

/** Atualiza a taxa do mês corrente com a cotação atual, exceto se o mês estiver marcado como 'manual'. */
export async function syncCambioMesAtual(db: any): Promise<number> {
  const anoMes = new Date().toISOString().slice(0, 7);
  const existing = await db.execute(sql`
    SELECT fonte FROM cortex_core.custo_cambio_mensal WHERE ano_mes = ${anoMes}
  `);
  if (existing.rows.length && existing.rows[0].fonte === "manual") {
    return parseFloat((await getTaxaMes(db, anoMes)).taxa.toString());
  }
  const taxa = await buscarTaxaAwesomeAPI();
  await upsertTaxaMes(db, anoMes, taxa, "auto");
  return taxa;
}
