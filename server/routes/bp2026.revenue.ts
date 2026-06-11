// server/routes/bp2026.revenue.ts
// Sub-aba Revenue: MRR/Contratos/AOV/Churn% por linha de serviço.
// Mapeamento por produto exato com fallback por serviço (produto vazio até jan/2026);
// Others = demais — soma das 5 = MRR total da matriz por construção.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";

interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct"; nota?: string; destaque?: boolean;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const LINHAS_SERVICO = [
  { chave: "performance", titulo: "Performance" },
  { chave: "creators", titulo: "Creators" },
  { chave: "social", titulo: "Social" },
  { chave: "gc", titulo: "Gestão de Comunidade" },
  { chave: "others", titulo: "Others" },
] as const;

const NOTA_OTHERS =
  "Agrega os demais produtos recorrentes do ClickUp (Broadcast, Sustentação, " +
  "CRM de Vendas, TikTok Shop, Consultoria de Performance, sem produto, etc.). " +
  "Até jan/2026 o campo produto não era preenchido — nesses meses a classificação usa o nome do serviço.";

const NOTA_CHURN =
  "Taxa do mês = churn (não abonado) do produto ÷ MRR da linha no fim do mês anterior.";

// mapeamento: produto exato; quando vazio (snapshots até jan/2026), fallback pelo nome do serviço
export const CASE_PRODUTO = sql`CASE
  WHEN TRIM(COALESCE(produto, '')) = 'Performance' THEN 'performance'
  WHEN TRIM(COALESCE(produto, '')) = 'Creators' THEN 'creators'
  WHEN TRIM(COALESCE(produto, '')) = 'Social Media' THEN 'social'
  WHEN TRIM(COALESCE(produto, '')) = 'Gestão de Comunidade' THEN 'gc'
  WHEN TRIM(COALESCE(produto, '')) != '' THEN 'others'
  WHEN servico ILIKE '%performance%' THEN 'performance'
  WHEN servico ILIKE '%creator%' THEN 'creators'
  WHEN servico ILIKE '%social%' THEN 'social'
  WHEN servico ILIKE '%comunidade%' THEN 'gc'
  ELSE 'others' END`;

// vw_cup_churn_ajustado não tem coluna servico (cup_churn só tem produto);
// churn de 2026 já tem produto preenchido, então o CASE por produto é suficiente.
export const CASE_PRODUTO_CHURN = sql`CASE
  WHEN TRIM(COALESCE(produto, '')) = 'Performance' THEN 'performance'
  WHEN TRIM(COALESCE(produto, '')) = 'Creators' THEN 'creators'
  WHEN TRIM(COALESCE(produto, '')) = 'Social Media' THEN 'social'
  WHEN TRIM(COALESCE(produto, '')) = 'Gestão de Comunidade' THEN 'gc'
  ELSE 'others' END`;

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  mesCorrente: number;
  mesFechado: number;
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

export async function montarRevenue({ db, orcado, mesCorrente, mesFechado }: Deps): Promise<Linha[]> {
  // snapshots fim de mês: índice 0 = dez/2025 (denominador do churn de janeiro), 1..12 = 2026
  const snapResult = await db.execute(sql`
    WITH alvo AS (
      SELECT gs.mes, MAX(h.data_snapshot::date) AS d
      FROM generate_series(0, 12) AS gs(mes)
      JOIN "Clickup".cup_data_hist h
        ON h.data_snapshot::date >= (make_date(2025, 12, 1) + (gs.mes || ' months')::interval)::date
       AND h.data_snapshot::date < (make_date(2025, 12, 1) + ((gs.mes + 1) || ' months')::interval)::date
      GROUP BY gs.mes
    )
    SELECT a.mes, ${CASE_PRODUTO} AS linha,
           SUM(h.valorr::numeric) AS mrr,
           COUNT(DISTINCT h.id_subtask) AS contratos
    FROM alvo a
    JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
    WHERE h.status IN ('ativo', 'onboarding', 'triagem')
    GROUP BY 1, 2
    ORDER BY 1
  `);
  const snap: Record<string, Record<number, { mrr: number; contratos: number }>> = {};
  for (const row of snapResult.rows as any[]) {
    const linha = row.linha as string;
    if (!snap[linha]) snap[linha] = {};
    snap[linha][Number(row.mes)] = { mrr: parseFloat(row.mrr), contratos: parseInt(row.contratos) };
  }

  const churnResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_solicitacao_encerramento)::int AS mes,
           ${CASE_PRODUTO_CHURN} AS linha,
           SUM(valor_r) AS total
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE data_solicitacao_encerramento >= '2026-01-01' AND data_solicitacao_encerramento < '2027-01-01'
      AND COALESCE(abonar_churn, '') != 'Sim'
      AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
      AND valor_r > 0
    GROUP BY 1, 2
    ORDER BY 1
  `);
  const churnRs: Record<string, Record<number, number>> = {};
  for (const row of churnResult.rows as any[]) {
    const linha = row.linha as string;
    if (!churnRs[linha]) churnRs[linha] = {};
    churnRs[linha][Number(row.mes)] = parseFloat(row.total);
  }

  const linhas: Linha[] = [];
  for (const { chave, titulo } of LINHAS_SERVICO) {
    const s = snap[chave] ?? {};
    const c = churnRs[chave] ?? {};
    const mrrSerie = Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? s[i + 1]?.mrr ?? null : null));
    const contratosSerie = Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? s[i + 1]?.contratos ?? null : null));
    const aovSerie = Array.from({ length: 12 }, (_, i) => razao(mrrSerie[i], contratosSerie[i]));
    const churnPctSerie = Array.from({ length: 12 }, (_, i) =>
      i + 1 <= mesCorrente ? razao(c[i + 1] ?? 0, s[i]?.mrr ?? null) : null
    );

    const fazLinha = (
      def: { metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque"; direcao: Linha["direcao"]; unidade: NonNullable<Linha["unidade"]>; nota?: string; destaque?: boolean },
      serie: (number | null)[],
      ytdOverride?: { orcado: number; realizado: number | null }
    ): Linha => {
      const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const o = orcado[def.metrica]?.[mes] ?? 0;
        const r = serie[i];
        return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
      });
      let ytd: Linha["ytd"];
      if (mesFechado === 0) {
        ytd = { orcado: 0, realizado: null, atingimento: null };
      } else if (ytdOverride) {
        ytd = { ...ytdOverride, atingimento: calcAtingimento(ytdOverride.orcado, ytdOverride.realizado) };
      } else {
        const v = calcYtd(meses, mesFechado, def.tipoAgregacao);
        ytd = { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) };
      }
      return { ...def, meses, ytd };
    };

    // YTD do AOV: razão das posições no mês fechado (orçado idem)
    const aovYtd = mesFechado === 0 ? undefined : {
      orcado: razao(orcado[`mrr_${chave}`]?.[mesFechado] ?? 0, orcado[`contratos_${chave}`]?.[mesFechado] ?? 0) ?? 0,
      realizado: razao(mrrSerie[mesFechado - 1], contratosSerie[mesFechado - 1]),
    };

    // YTD do churn %: Σ churn R$ ÷ Σ denominadores (taxa média mensal ponderada);
    // orçado = Σ(pct_orc(m) × mrr_orc(m)) ÷ Σ mrr_orc(m)
    let churnYtd: { orcado: number; realizado: number | null } | undefined;
    if (mesFechado > 0) {
      let somaChurn = 0;
      let somaDen = 0;
      for (let m = 1; m <= mesFechado; m++) {
        somaChurn += c[m] ?? 0;
        somaDen += s[m - 1]?.mrr ?? 0;
      }
      let numOrc = 0;
      let denOrc = 0;
      for (let m = 1; m <= mesFechado; m++) {
        const mrrOrc = orcado[`mrr_${chave}`]?.[m] ?? 0;
        numOrc += (orcado[`churn_pct_${chave}`]?.[m] ?? 0) * mrrOrc;
        denOrc += mrrOrc;
      }
      churnYtd = { orcado: denOrc ? numOrc / denOrc : 0, realizado: somaDen ? somaChurn / somaDen : null };
    }

    linhas.push(
      fazLinha({ metrica: `mrr_${chave}`, titulo: `MRR — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "brl", destaque: true, ...(chave === "others" ? { nota: NOTA_OTHERS } : {}) }, mrrSerie),
      fazLinha({ metrica: `contratos_${chave}`, titulo: `Contratos — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, contratosSerie),
      fazLinha({ metrica: `aov_${chave}`, titulo: `AOV — ${titulo}`, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, aovSerie, aovYtd),
      fazLinha({ metrica: `churn_pct_${chave}`, titulo: `Churn — ${titulo}`, tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "pct", nota: NOTA_CHURN }, churnPctSerie, churnYtd)
    );
  }
  return linhas;
}
