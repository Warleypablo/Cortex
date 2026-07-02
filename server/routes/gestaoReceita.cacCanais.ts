// server/routes/gestaoReceita.cacCanais.ts
// Seção "CAC por canal — variáveis de custo" (aba Macro da Gestão de Receita).
// CAC GERENCIAL: custos informados à mão por mês (gestao_receita_metas, chaves
// cac_canal:<canal>:<item>) + incentivos automáticos por cliente (unitário editável
// via cac_canal_unit:<canal>, default R$ 1.000). Clientes = deals ganhos Bitrix
// agrupados por source → macro-canal. Não confundir com o card "CAC — custo de
// aquisição" (Conta Azul, regime caixa): não batem por design.
import { sql } from "drizzle-orm";

const STAGE_GANHO = "Negócio Ganho";

export interface CacCanalDef {
  id: string;
  label: string;
  sources: string[]; // códigos crus de crm_deal.source (ver bitrixSources.ts)
  itens: { id: string; label: string }[];
  incentivo?: { label: string; unitDefault: number };
}

// Catálogo fixo (spec 2026-07-02). Parceria ainda não tem source no CRM → clientes 0.
export const CAC_CANAIS: CacCanalDef[] = [
  { id: "inbound_pago", label: "Inbound pago", sources: ["WEBFORM", "ADVERTISING", "OTHER", "STORE"], itens: [{ id: "anuncios", label: "Investimento em anúncios" }] },
  { id: "inbound_organico", label: "Inbound orgânico", sources: ["WEB", "CALL", "BOOKING", "EMAIL", "TRADE_SHOW", "instagram_organic"], itens: [] },
  { id: "outbound", label: "Outbound", sources: ["UC_YWZVA2"], itens: [{ id: "time", label: "Custo de time" }, { id: "ferramentas", label: "Ferramentas (Lemlist, Intexfy...)" }] },
  { id: "social_selling", label: "Social Selling", sources: ["UC_4VCKGM"], itens: [{ id: "anuncios_dist", label: "Anúncios p/ distribuição" }] },
  { id: "reativacao", label: "Reativação", sources: ["UC_HIBVO6", "UC_8HI30Y"], itens: [{ id: "broadcast", label: "Disparos de broadcast" }, { id: "time", label: "Custo de time" }] },
  { id: "recomendacao", label: "Recomendação", sources: ["UC_PTYW1Y", "CALLBACK"], itens: [] },
  { id: "indique_ganhe", label: "Indique e ganhe", sources: ["RC_GENERATOR"], itens: [], incentivo: { label: "Incentivo", unitDefault: 1000 } },
  { id: "evento", label: "Evento", sources: ["RECOMMENDATION", "UC_KYOYOW"], itens: [{ id: "custo_evento", label: "Custo do evento (manual)" }] },
  { id: "parceria", label: "Parceria", sources: [], itens: [{ id: "time_resp", label: "Custo de time responsável" }], incentivo: { label: "Comissão", unitDefault: 1000 } },
  { id: "expansao", label: "Expansão de conta (Crossell)", sources: ["PARTNER", "UC_7WV0LW", "REPEAT_SALE"], itens: [{ id: "time", label: "Custo de time" }] },
];

export interface DealsSourceMes { source: string; mes: number; clientes: number }
export interface MetaMesRow { chave: string; mes: number; valor: number }
export interface CacCanalOut {
  id: string; label: string; clientes: number; custoTotal: number; cacCliente: number | null;
  itens: { id: string; label: string; valor: number }[];
  incentivo?: { label: string; unit: number; qtd: number; total: number };
}
export interface CacCanaisOut {
  geral: { cac: number | null; clientes: number; custoTotal: number };
  canais: CacCanalOut[];
}

// Agregação pura (testável sem banco). Incentivo calculado MÊS A MÊS (unit do mês ×
// clientes do mês) para range multi-mês somar certo mesmo se o unitário mudou no meio;
// o campo `unit` retornado é o do primeiro mês do período (exibição).
export function agregarCacCanais(deals: DealsSourceMes[], metas: MetaMesRow[], mesesNums: number[]): CacCanaisOut {
  const sourceToCanal: Record<string, string> = {};
  for (const c of CAC_CANAIS) for (const s of c.sources) sourceToCanal[s] = c.id;

  const clientesCanalMes: Record<string, Record<number, number>> = {};
  for (const d of deals) {
    const canal = sourceToCanal[d.source];
    if (!canal) continue; // sources fora do catálogo ficam fora da seção (nota na UI)
    (clientesCanalMes[canal] ??= {})[d.mes] = (clientesCanalMes[canal]?.[d.mes] || 0) + (Number(d.clientes) || 0);
  }
  const metaMes: Record<string, Record<number, number>> = {};
  for (const m of metas) (metaMes[m.chave] ??= {})[m.mes] = Number(m.valor) || 0;

  const canais = CAC_CANAIS.map((def) => {
    const porMes = clientesCanalMes[def.id] || {};
    const clientes = mesesNums.reduce((a, m) => a + (porMes[m] || 0), 0);
    const itens = def.itens.map((it) => ({
      id: it.id,
      label: it.label,
      valor: mesesNums.reduce((a, m) => a + (metaMes[`cac_canal:${def.id}:${it.id}`]?.[m] || 0), 0),
    }));
    let incentivo: CacCanalOut["incentivo"];
    if (def.incentivo) {
      const unitDe = (m: number) => metaMes[`cac_canal_unit:${def.id}`]?.[m] ?? def.incentivo!.unitDefault;
      const total = mesesNums.reduce((a, m) => a + unitDe(m) * (porMes[m] || 0), 0);
      incentivo = { label: def.incentivo.label, unit: unitDe(mesesNums[0]), qtd: clientes, total };
    }
    const custoTotal = itens.reduce((a, i) => a + i.valor, 0) + (incentivo?.total || 0);
    return {
      id: def.id, label: def.label, clientes, custoTotal,
      cacCliente: clientes > 0 ? Math.round(custoTotal / clientes) : null,
      itens, incentivo,
    };
  });

  const totClientes = canais.reduce((a, c) => a + c.clientes, 0);
  const totCusto = canais.reduce((a, c) => a + c.custoTotal, 0);
  return {
    geral: { cac: totClientes > 0 ? Math.round(totCusto / totClientes) : null, clientes: totClientes, custoTotal: totCusto },
    canais,
  };
}

// db tipado frouxo de propósito (method shorthand = bivariante, aceita o db do drizzle)
type DbLike = { execute(q: any): Promise<{ rows: any[] }> };

export async function computeCacCanais(
  db: DbLike,
  { dIni, dFim, ano, mesesNums }: { dIni: string; dFim: string; ano: number; mesesNums: number[] },
): Promise<CacCanaisOut> {
  const mesesInSql = sql.join(mesesNums.map((m) => sql`${m}`), sql`, `);
  const [dealsRows, metasRows] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS source,
             EXTRACT(MONTH FROM data_fechamento)::int AS mes,
             COUNT(*)::int AS clientes
      FROM "Bitrix".crm_deal
      WHERE stage_name = ${STAGE_GANHO}
        AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
      GROUP BY 1, 2
    `),
    db.execute(sql`
      SELECT chave, mes, valor::numeric AS valor
      FROM cortex_core.gestao_receita_metas
      WHERE ano = ${ano} AND mes IN (${mesesInSql})
        AND (chave LIKE 'cac_canal:%' OR chave LIKE 'cac_canal_unit:%')
    `),
  ]);
  return agregarCacCanais(
    (dealsRows.rows as any[]).map((r) => ({ source: r.source, mes: Number(r.mes), clientes: Number(r.clientes) || 0 })),
    (metasRows.rows as any[]).map((r) => ({ chave: r.chave, mes: Number(r.mes), valor: Number(r.valor) || 0 })),
    mesesNums,
  );
}
