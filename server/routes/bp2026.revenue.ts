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
  "Taxa do mês = churn bruto do produto ÷ MRR da linha no fim do mês anterior (alinhado ao ClickUp).";

const NOTA_CHURN_RS =
  "Valor absoluto de churn bruto por produto, alinhado ao gráfico do ClickUp (inclui abonados e todos os motivos). " +
  "Orçado derivado de churn% × MRR orçado do mesmo mês (igual à planilha Revenue).";

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
  vendasMrrPorMes: Record<number, number>;
  mesCorrente: number;
  mesFechado: number;
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

export async function montarRevenue({ db, orcado, vendasMrrPorMes, mesCorrente, mesFechado }: Deps): Promise<Linha[]> {
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
           -- contratos = só os que geram MRR (valorr>0). Contratos pontuais de Creators
           -- (valorp>0, valorr=0) em status ativo/onboarding/triagem inflavam o denominador
           -- do AOV (e a própria contagem), derrubando o AOV. Alinha à aba Vendas por Produto.
           COUNT(DISTINCT h.id_subtask) FILTER (WHERE COALESCE(h.valorr::numeric, 0) > 0) AS contratos
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
    -- churn BRUTO (alinhado ao gráfico "Churn Commerce MoM" do ClickUp): inclui abonados e todos os motivos,
    -- mas conta só status de churn real (cancelado/inativo + em cancelamento); 'entregue' (pontual concluído)
    -- e 'pausado' (pausa, não cancelamento) NÃO são churn e ficam de fora.
    WHERE data_solicitacao_encerramento >= '2026-01-01' AND data_solicitacao_encerramento < '2027-01-01'
      AND valor_r > 0
      AND status IN ('cancelado/inativo', 'em cancelamento')
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

    // Churn R$ por produto: meses construídos manualmente para que o orçado mensal
    // seja derivado (churn_pct_orc × mrr_orc do MESMO mês, como na planilha Revenue) em vez de buscado no banco.
    const mesesChurnRs: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const mrrOrcMes = orcado[`mrr_${chave}`]?.[mes] ?? 0;
      const o = (orcado[`churn_pct_${chave}`]?.[mes] ?? 0) * mrrOrcMes;
      const r = mes <= mesCorrente ? (c[mes] ?? 0) : null;
      return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const vChurnRs = calcYtd(mesesChurnRs, mesFechado, "fluxo");

    linhas.push(
      fazLinha({ metrica: `mrr_${chave}`, titulo: `MRR — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "brl", destaque: true, ...(chave === "others" ? { nota: NOTA_OTHERS } : {}) }, mrrSerie),
      fazLinha({ metrica: `contratos_${chave}`, titulo: `Contratos — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, contratosSerie),
      fazLinha({ metrica: `aov_${chave}`, titulo: `AOV — ${titulo}`, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, aovSerie, aovYtd),
      fazLinha({ metrica: `churn_pct_${chave}`, titulo: `Churn — ${titulo}`, tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "pct", nota: NOTA_CHURN }, churnPctSerie, churnYtd),
      {
        metrica: `churn_rs_${chave}`, titulo: `Churn R$ — ${titulo}`,
        tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "brl", nota: NOTA_CHURN_RS,
        meses: mesesChurnRs,
        ytd: mesFechado === 0
          ? { orcado: 0, realizado: null, atingimento: null }
          : { ...vChurnRs, atingimento: calcAtingimento(vChurnRs.orcado, vChurnRs.realizado) },
      }
    );
  }

  // Churn R$ consolidado inserido antes de mrr_ativo (unshift é LIFO: mrr_ativo ficará primeiro)
  const mesesChurnTotal: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const real = mes <= mesCorrente
      ? LINHAS_SERVICO.reduce((acc, { chave: ch }) => acc + (churnRs[ch]?.[mes] ?? 0), 0)
      : null;
    const orc = LINHAS_SERVICO.reduce((acc, { chave: ch }) => {
      const mrrOrcMes = orcado[`mrr_${ch}`]?.[mes] ?? 0; // MESMO mês (igual à planilha Revenue, linha "Churn Total")
      return acc + (orcado[`churn_pct_${ch}`]?.[mes] ?? 0) * mrrOrcMes;
    }, 0);
    return { mes, orcado: orc, realizado: real, atingimento: calcAtingimento(orc, real) };
  });
  const vChurnTot = calcYtd(mesesChurnTotal, mesFechado, "fluxo");

  // "Churn % Total" = Churn R$ Total do mês ÷ MRR Ativo do fim do mês ANTERIOR
  // (mesma régua canônica do churn% por produto — assim o total reconcilia com as
  // linhas "Churn — <produto>"). Orçado = Churn R$ orçado ÷ MRR orçado do MESMO mês,
  // coerente com a derivação do Churn R$ Total orçado (pct × MRR = R$).
  // Unshift ANTES do churn_rs_total p/ ficar logo ABAIXO dele no resultado (LIFO).
  const mrrRealTot = (m: number) => LINHAS_SERVICO.reduce((a, { chave }) => a + (snap[chave]?.[m]?.mrr ?? 0), 0);
  const mrrOrcTot = (m: number) => LINHAS_SERVICO.reduce((a, { chave }) => a + (orcado[`mrr_${chave}`]?.[m] ?? 0), 0);
  const mesesChurnPctTotal: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const r = razao(mesesChurnTotal[i].realizado, mrrRealTot(mes - 1)); // base = fim do mês anterior (mes-1; jan → dez/2025)
    const denOrc = mrrOrcTot(mes);
    const o = denOrc ? mesesChurnTotal[i].orcado / denOrc : 0;
    return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
  });
  // YTD: taxa média mensal ponderada (Σ churn ÷ Σ base anterior); orçado idem sobre MRR orçado do mês
  let churnPctTotYtd: { orcado: number; realizado: number | null } | undefined;
  if (mesFechado > 0) {
    let cReal = 0, dReal = 0, cOrc = 0, dOrc = 0;
    for (let m = 1; m <= mesFechado; m++) {
      cReal += mesesChurnTotal[m - 1].realizado ?? 0;
      dReal += mrrRealTot(m - 1);
      cOrc += mesesChurnTotal[m - 1].orcado;
      dOrc += mrrOrcTot(m);
    }
    churnPctTotYtd = { orcado: dOrc ? cOrc / dOrc : 0, realizado: dReal ? cReal / dReal : null };
  }
  linhas.unshift({
    metrica: "churn_pct_total",
    titulo: "Churn % Total",
    tipoAgregacao: "fluxo",
    direcao: "menor_melhor",
    unidade: "pct",
    nota: "Churn R$ Total do mês ÷ MRR Ativo do fim do mês anterior (mesma régua do churn % por produto; base = fechamento anterior). Orçado = Churn R$ orçado ÷ MRR orçado do mesmo mês.",
    meses: mesesChurnPctTotal,
    ytd: mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : { ...churnPctTotYtd!, atingimento: calcAtingimento(churnPctTotYtd!.orcado, churnPctTotYtd!.realizado) },
  });

  linhas.unshift({
    metrica: "churn_rs_total",
    titulo: "Churn R$ Total",
    tipoAgregacao: "fluxo",
    direcao: "menor_melhor",
    unidade: "brl",
    nota: "Soma do churn bruto de todos os produtos, alinhado ao gráfico do ClickUp (inclui abonados e todos os motivos). Orçado derivado de churn% × MRR orçado do mesmo mês (igual à planilha Revenue).",
    meses: mesesChurnTotal,
    ytd: mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : { ...vChurnTot, atingimento: calcAtingimento(vChurnTot.orcado, vChurnTot.realizado) },
  });

  // Linha "MRR Ativo" = soma dos 5 produtos; fica no topo após o segundo unshift
  const mesesTotal: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const orc = LINHAS_SERVICO.reduce((acc, { chave }) => acc + (orcado[`mrr_${chave}`]?.[mes] ?? 0), 0);
    const real = mes <= mesCorrente
      ? LINHAS_SERVICO.reduce((acc, { chave }) => acc + (snap[chave]?.[mes]?.mrr ?? 0), 0)
      : null;
    return { mes, orcado: orc, realizado: real, atingimento: calcAtingimento(orc, real) };
  });
  const vTot = calcYtd(mesesTotal, mesFechado, "estoque");
  linhas.unshift({
    metrica: "mrr_ativo", titulo: "MRR Ativo", tipoAgregacao: "estoque",
    direcao: "maior_melhor", unidade: "brl", destaque: true, meses: mesesTotal,
    ytd: mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : { ...vTot, atingimento: calcAtingimento(vTot.orcado, vTot.realizado) },
  });

  return linhas;
}
