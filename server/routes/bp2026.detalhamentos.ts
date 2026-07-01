// server/routes/bp2026.detalhamentos.ts
// Sub-abas SG&A (detalhe por sub-linha, visão da aba SG&A da planilha) e
// Outras Receitas (detalhe por categoria). Mesmos regimes do DRE:
// despesas em caixa (QUITADO), receitas por competência.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";
import { PREDICADOS_DESPESA, PREDICADOS_SGA_SUB, PREDICADOS_OUTRAS_SUB, PREDICADOS_CAC_SUB } from "./bp2026.predicados";
import { somaDespesaCaixaPorMes } from "./bp2026";
import { participacaoPct, razaoYtd } from "./bp2026.cac.helpers";
import { SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS, SLUG } from "../okr2026/servicosBitrix";

interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec"; nota?: string; destaque?: boolean;
  grupo?: string; subItem?: boolean; semDetalhe?: boolean;
  expansivel?: boolean; paiMetrica?: string;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_SGA_TOTAL =
  "Visão da aba SG&A da planilha — difere da linha SG&A do DRE: aqui o Caju " +
  "entra integral (no DRE é rateado com CSV) e Software entra aqui (no DRE " +
  "está em CSV Stack).";

const NOTA_PREMIACOES = "A categoria do Conta Azul inclui uniformes e brindes.";
const NOTA_EVENTOS = "Mapeado para a categoria Confraternizações (06.10.06).";
const NOTA_DEMAIS =
  "Mentoria, Infoproduto e Turbooh não têm categorias próprias no Conta Azul — " +
  "agrupados com rendimentos e demais receitas (04.x).";

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  // séries de vendas do handler (Bitrix) — denominadores das linhas de eficiência do CAC
  vendasMrrPorMes: Record<number, number>;
  pontualPorMes: Record<number, number>;
  ganhosPorMes: Record<number, number>; // deals ganhos (MRR ou pontual) — proxy de clientes adquiridos
  // realizado de contratos recorrentes vendidos por produto (slug -> série 12 meses, null no futuro)
  contratosVendidosRec: Record<string, (number | null)[]>;
  // realizado do total de serviços vendidos no mês (campo servicos_vendidos do Bitrix) —
  // denom. do CAC por contrato (régua: 1 serviço = 1 contrato)
  servicosVendidosTotalPorMes: (number | null)[];
  // faturamento recebido no mês (entradas de RECEITA quitadas, regime caixa) — denom. do % do faturamento no SG&A
  faturamentoCaixaPorMes: Record<number, number>;
  mesCorrente: number;
  mesFechado: number;
}

interface DefSub {
  metrica: string;            // chave do orçado (bp2026_orcado)
  titulo: string;
  predicado: keyof typeof PREDICADOS_SGA_SUB | "sga_caju";
  nota?: string;
}

const NOTA_CAC_TOTAL =
  "Soma das sub-linhas comerciais — deve bater com a linha CAC do DRE " +
  "(mesmos prefixos de categoria).";
const NOTA_COMISSOES = "Inclui Indique e Ganhe (06.04.05).";
const NOTA_CAC_OUTRAS =
  "Categorias que entram no CAC do DRE mas não têm linha no BP " +
  "(Outras Despesas Comerciais, Patrocínios).";

// derivado da fonte única (servicosBitrix): produtos das sub-linhas de CAC por contrato
const PRODUTOS_CAC: { slug: string; titulo: string }[] =
  SEGMENTOS_RECORRENTES.map((seg) => ({ slug: SLUG[seg], titulo: seg }));

const SUB_CAC: { metrica: string; titulo: string; predicado: keyof typeof PREDICADOS_CAC_SUB; nota?: string; semOrcado?: boolean }[] = [
  { metrica: "cac_pre_vendas", titulo: "Pré Vendas", predicado: "cac_pre_vendas" },
  { metrica: "cac_vendas", titulo: "Vendas", predicado: "cac_vendas" },
  { metrica: "cac_gerencia", titulo: "Gerência", predicado: "cac_gerencia" },
  { metrica: "cac_comissoes", titulo: "Comissões", predicado: "cac_comissoes", nota: NOTA_COMISSOES },
  { metrica: "cac_growth", titulo: "Growth", predicado: "cac_growth" },
  { metrica: "cac_ads", titulo: "ADs", predicado: "cac_ads" },
  { metrica: "cac_eventos", titulo: "Eventos", predicado: "cac_eventos" },
  { metrica: "cac_brindes", titulo: "Brindes", predicado: "cac_brindes" },
  { metrica: "cac_viagens", titulo: "Viagens", predicado: "cac_viagens" },
  { metrica: "cac_outras_sub", titulo: "Outras comerciais (não orçadas)", predicado: "cac_outras_sub", nota: NOTA_CAC_OUTRAS, semOrcado: true },
];

const SUB_SGA: DefSub[] = [
  { metrica: "sga_uzk", titulo: "UZK", predicado: "sga_uzk" },
  { metrica: "sga_backoffice", titulo: "Backoffice", predicado: "sga_backoffice" },
  { metrica: "sga_software", titulo: "Software", predicado: "sga_software" },
  { metrica: "sga_ocupacao", titulo: "Ocupação", predicado: "sga_ocupacao" },
  { metrica: "beneficio_total_empresa", titulo: "Benefício Caju", predicado: "sga_caju" },
  { metrica: "sga_premiacoes", titulo: "Premiações", predicado: "sga_premiacoes", nota: NOTA_PREMIACOES },
  { metrica: "sga_eventos", titulo: "Eventos e Brindes Internos", predicado: "sga_eventos", nota: NOTA_EVENTOS },
  { metrica: "sga_outras", titulo: "Outras despesas", predicado: "sga_outras_sub" },
];

export async function montarDetalhamentos(deps: Deps): Promise<{ sga: Linha[]; cac: Linha[]; outrasReceitas: Linha[] }> {
  const { db, orcado, vendasMrrPorMes, pontualPorMes, ganhosPorMes, contratosVendidosRec, servicosVendidosTotalPorMes, faturamentoCaixaPorMes, mesCorrente, mesFechado } = deps;

  const mensal = (porMes: Record<number, number>) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? porMes[i + 1] ?? 0 : null));

  const fazLinha = (
    def: { metrica: string; titulo: string; direcao: Linha["direcao"]; unidade?: Linha["unidade"]; nota?: string; destaque?: boolean },
    serie: (number | null)[],
    orcadoMes: (m: number) => number,
    ytdOverride?: { orcado: number; realizado: number | null }
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const o = orcadoMes(mes);
      const r = serie[i];
      return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const ytd = mesFechado === 0
      ? { orcado: 0, realizado: null as number | null, atingimento: null as number | null }
      : ytdOverride
        ? { ...ytdOverride, atingimento: calcAtingimento(ytdOverride.orcado, ytdOverride.realizado) }
        : (() => { const v = calcYtd(meses, mesFechado, "fluxo"); return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) }; })();
    return { ...def, tipoAgregacao: "fluxo", unidade: def.unidade ?? "brl", meses, ytd };
  };

  // ---- SG&A: caixa por predicado de sub-linha ----
  const sgaLinhas: Linha[] = [];
  const sgaSeries: (number | null)[][] = [];
  for (const def of SUB_SGA) {
    // sga_caju: reutiliza PREDICADOS_DESPESA.beneficio_total (06.10.04%) — total sem rateio,
    // conforme visão da aba SG&A da planilha (difere do DRE onde o Caju é rateado entre CSV e SG&A).
    const predicado = def.predicado === "sga_caju"
      ? PREDICADOS_DESPESA.beneficio_total
      : PREDICADOS_SGA_SUB[def.predicado as keyof typeof PREDICADOS_SGA_SUB];
    const porMes = await somaDespesaCaixaPorMes(db, predicado);
    const serie = mensal(porMes);
    sgaSeries.push(serie);
    sgaLinhas.push(fazLinha(
      { metrica: def.metrica, titulo: def.titulo, direcao: "menor_melhor", nota: def.nota },
      serie,
      (m) => orcado[def.metrica]?.[m] ?? 0
    ));
  }
  const somaSeries = (series: (number | null)[][]) =>
    Array.from({ length: 12 }, (_, i) =>
      series.some((s) => s[i] === null) ? null : series.reduce((acc, s) => acc + (s[i] ?? 0), 0)
    );
  const sgaTotal = fazLinha(
    { metrica: "sga_total_detalhe", titulo: "SG&A (soma das sub-linhas)", direcao: "menor_melhor", nota: NOTA_SGA_TOTAL, destaque: true },
    somaSeries(sgaSeries),
    (m) => SUB_SGA.reduce((acc, d) => acc + (orcado[d.metrica]?.[m] ?? 0), 0)
  );

  // ---- CAC: caixa por predicado de sub-linha (mesma mecânica do SG&A) ----
  const cacLinhas: Linha[] = [];
  const cacSeries: (number | null)[][] = [];
  for (const def of SUB_CAC) {
    const porMes = await somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB[def.predicado]);
    const serie = mensal(porMes);
    cacSeries.push(serie);
    cacLinhas.push(fazLinha(
      { metrica: def.metrica, titulo: def.titulo, direcao: "menor_melhor", nota: def.nota },
      serie,
      (m) => def.semOrcado ? 0 : orcado[def.metrica]?.[m] ?? 0
    ));
  }
  const cacTotal = fazLinha(
    { metrica: "cac_total_detalhe", titulo: "CAC (soma das sub-linhas)", direcao: "menor_melhor", nota: NOTA_CAC_TOTAL, destaque: true },
    somaSeries(cacSeries),
    (m) => SUB_CAC.reduce((acc, d) => acc + (d.semOrcado ? 0 : orcado[d.metrica]?.[m] ?? 0), 0)
  );

  // ---- eficiência da aquisição: despesa CAC ÷ o que ela comprou no mês ----
  const cacTotalSerie = somaSeries(cacSeries);
  const cacOrcMes = (m: number) => SUB_CAC.reduce((acc, d) => acc + (d.semOrcado ? 0 : orcado[d.metrica]?.[m] ?? 0), 0);
  const razao = (num: number | null, den: number | null) =>
    num === null || den === null || !den ? null : num / den;
  const receitaAdquirida = (m: number) => (vendasMrrPorMes[m] ?? 0) + (pontualPorMes[m] ?? 0);
  const receitaAdqOrc = (m: number) => (orcado["vendas_mrr"]?.[m] ?? 0) + (orcado["vendas_pontual"]?.[m] ?? 0);

  const pctSerie = Array.from({ length: 12 }, (_, i) =>
    i + 1 <= mesCorrente ? razao(cacTotalSerie[i], receitaAdquirida(i + 1)) : null
  );
  const paybackSerie = Array.from({ length: 12 }, (_, i) =>
    i + 1 <= mesCorrente ? razao(cacTotalSerie[i], vendasMrrPorMes[i + 1] ?? 0) : null
  );
  // YTDs de razão: Σ numerador ÷ Σ denominador (não média de razões)
  const somaAte = (f: (m: number) => number) =>
    Array.from({ length: mesFechado }, (_, i) => f(i + 1)).reduce((a, b) => a + b, 0);
  const cacYtdReal = mesFechado === 0 ? null :
    cacTotalSerie.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const cacPctReceita = fazLinha(
    { metrica: "cac_pct_receita", titulo: "CAC % receita adquirida", direcao: "menor_melhor", unidade: "pct",
      nota: "Despesa CAC do mês ÷ vendas do mês (MRR + pontual, Bitrix) — quanto de cada real novo foi consumido para adquiri-lo." },
    pctSerie,
    (m) => razao(cacOrcMes(m), receitaAdqOrc(m)) ?? 0,
    mesFechado === 0 ? undefined : {
      orcado: razao(somaAte(cacOrcMes), somaAte(receitaAdqOrc)) ?? 0,
      realizado: razao(cacYtdReal, somaAte(receitaAdquirida)),
    }
  );
  // CAC monetário: despesa ÷ deals ganhos (proxy de clientes adquiridos);
  // orçado ÷ deals esperados pelo BP (reuniões necessárias × taxa de conversão)
  const ganhosOrc = (m: number) =>
    (orcado["reunioes_necessarias"]?.[m] ?? 0) * (orcado["taxa_conversao"]?.[m] ?? 0);
  const porClienteSerie = Array.from({ length: 12 }, (_, i) =>
    i + 1 <= mesCorrente ? razao(cacTotalSerie[i], ganhosPorMes[i + 1] ?? 0) : null
  );
  const cacPorCliente = fazLinha(
    { metrica: "cac_por_cliente", titulo: "CAC por cliente adquirido", direcao: "menor_melhor", unidade: "brl",
      nota: "Despesa CAC do mês ÷ deals ganhos no Bitrix — proxy de clientes adquiridos (o CRM não separa cliente novo de cross-sell). Orçado ÷ deals esperados pelo BP (reuniões × conversão). Base para LTV/CAC." },
    porClienteSerie,
    (m) => razao(cacOrcMes(m), ganhosOrc(m)) ?? 0,
    mesFechado === 0 ? undefined : {
      orcado: razao(somaAte(cacOrcMes), somaAte(ganhosOrc)) ?? 0,
      realizado: razao(cacYtdReal, somaAte((m) => ganhosPorMes[m] ?? 0)),
    }
  );

  // CAC por contrato: despesa CAC ÷ contratos vendidos no mês.
  // Régua de contrato = nº de serviços vendidos no deal (campo servicos_vendidos do Bitrix):
  // cada serviço = 1 contrato (um deal com N serviços conta N). Numerador = CAC total (cobre a
  // aquisição de rec E pontual). Como serviços ≥ deals ganhos, fica ≤ CAC por cliente — apples-
  // to-apples com aquela linha (que usa o mesmo CAC ÷ deals). Orçado ÷ contratos orçados.
  const contratosOrcMes = (m: number) =>
    SEGMENTOS_RECORRENTES.reduce((s, seg) => s + (orcado[`contratos_vendidos_mrr_${SLUG[seg]}`]?.[m] ?? 0), 0) +
    SEGMENTOS_PONTUAIS.reduce((s, seg) => s + (orcado[`contratos_vendidos_pontual_${SLUG[seg]}`]?.[m] ?? 0), 0);
  const porContratoSerie = Array.from({ length: 12 }, (_, i) =>
    i + 1 <= mesCorrente ? razao(cacTotalSerie[i], servicosVendidosTotalPorMes[i]) : null
  );
  // sub-linhas por produto: CAC total ÷ contratos do produto (mesma premissa de CAC)
  const cacPorContratoFilhos: Linha[] = PRODUTOS_CAC.map((p) => {
    const serie = Array.from({ length: 12 }, (_, i) => {
      if (i + 1 > mesCorrente) return null;
      const cont = contratosVendidosRec[p.slug]?.[i] ?? 0;
      return cont > 0 ? razao(cacTotalSerie[i], cont) : null;
    });
    return {
      ...fazLinha(
        { metrica: `cac_contrato_produto_${p.slug}`, titulo: p.titulo,
          direcao: "menor_melhor", unidade: "brl" },
        serie,
        (m) => {
          const cont = orcado[`contratos_vendidos_mrr_${p.slug}`]?.[m] ?? 0;
          return cont > 0 ? razao(cacOrcMes(m), cont) ?? 0 : 0;
        },
      ),
      subItem: true,
      paiMetrica: "cac_por_contrato",
    };
  });

  const cacPorContrato: Linha = {
    ...fazLinha(
      { metrica: "cac_por_contrato", titulo: "CAC por contrato", direcao: "menor_melhor", unidade: "brl",
        nota: "Despesa CAC do mês ÷ serviços vendidos no Bitrix (campo servicos_vendidos: cada serviço do deal = 1 contrato). Comparável ao CAC por cliente: fica menor que ele quando um deal traz mais de um serviço. Orçado ÷ contratos vendidos orçados." },
      porContratoSerie,
      (m) => razao(cacOrcMes(m), contratosOrcMes(m)) ?? 0,
      mesFechado === 0 ? undefined : {
        orcado: razao(somaAte(cacOrcMes), somaAte(contratosOrcMes)) ?? 0,
        realizado: razao(cacYtdReal, somaAte((m) => servicosVendidosTotalPorMes[m - 1] ?? 0)),
      }
    ),
    semDetalhe: true,
    expansivel: true,
  };

  const cacPayback = fazLinha(
    { metrica: "cac_payback_mrr", titulo: "Payback em MRR (meses)", direcao: "menor_melhor", unidade: "dec",
      nota: "Despesa CAC do mês ÷ MRR vendido no mês — quantos meses do MRR adquirido pagam a aquisição." },
    paybackSerie,
    (m) => razao(cacOrcMes(m), orcado["vendas_mrr"]?.[m] ?? 0) ?? 0,
    mesFechado === 0 ? undefined : {
      orcado: razao(somaAte(cacOrcMes), somaAte((m) => orcado["vendas_mrr"]?.[m] ?? 0)) ?? 0,
      realizado: razao(cacYtdReal, somaAte((m) => vendasMrrPorMes[m] ?? 0)),
    }
  );

  // ---- Outras Receitas: competência, 3 agregações condicionais (mesmo regime do DRE) ----
  const outrasResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_competencia)::int AS mes,
           SUM(valor_liquido::numeric) FILTER (WHERE ${PREDICADOS_OUTRAS_SUB.or_variavel}) AS variavel,
           SUM(valor_liquido::numeric) FILTER (WHERE ${PREDICADOS_OUTRAS_SUB.or_stack}) AS stack,
           SUM(valor_liquido::numeric) FILTER (WHERE ${PREDICADOS_OUTRAS_SUB.or_demais}) AS demais
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = 'RECEITA'
      AND data_competencia >= '2026-01-01' AND data_competencia < '2027-01-01'
      AND (${PREDICADOS_OUTRAS_SUB.or_variavel} OR ${PREDICADOS_OUTRAS_SUB.or_stack} OR ${PREDICADOS_OUTRAS_SUB.or_demais})
    GROUP BY 1 ORDER BY 1
  `);
  const orPorMes: Record<number, { variavel: number; stack: number; demais: number }> = {};
  for (const row of outrasResult.rows as any[]) {
    orPorMes[Number(row.mes)] = {
      variavel: parseFloat(row.variavel ?? 0), stack: parseFloat(row.stack ?? 0), demais: parseFloat(row.demais ?? 0),
    };
  }
  const orSerie = (k: "variavel" | "stack" | "demais") =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? orPorMes[i + 1]?.[k] ?? 0 : null));

  const orcDemais = (m: number) =>
    (orcado["outras_receitas"]?.[m] ?? 0) - (orcado["or_receita_variavel"]?.[m] ?? 0) - (orcado["or_stack_digital"]?.[m] ?? 0);

  const variavelL = fazLinha({ metrica: "or_receita_variavel", titulo: "Receita Variável", direcao: "maior_melhor" }, orSerie("variavel"), (m) => orcado["or_receita_variavel"]?.[m] ?? 0);
  const stackL = fazLinha({ metrica: "or_stack_digital", titulo: "Stack Digital", direcao: "maior_melhor" }, orSerie("stack"), (m) => orcado["or_stack_digital"]?.[m] ?? 0);
  const demaisL = fazLinha({ metrica: "or_demais", titulo: "Demais (Mentoria, Infoproduto, Turbooh…)", direcao: "maior_melhor", nota: NOTA_DEMAIS }, orSerie("demais"), orcDemais);
  const orTotal = fazLinha(
    { metrica: "or_total_detalhe", titulo: "Outras Receitas (total)", direcao: "maior_melhor", destaque: true },
    somaSeries([orSerie("variavel"), orSerie("stack"), orSerie("demais")]),
    (m) => orcado["outras_receitas"]?.[m] ?? 0
  );

  // ---- linha-filha "% do CAC total" sob cada sub-linha de custo ----
  const cacOrcSerie = Array.from({ length: 12 }, (_, i) => cacOrcMes(i + 1));
  const subOrcSerie = (def: typeof SUB_CAC[number]) =>
    Array.from({ length: 12 }, (_, i) => (def.semOrcado ? 0 : orcado[def.metrica]?.[i + 1] ?? 0));

  const cacLinhasComPct: Linha[] = [];
  SUB_CAC.forEach((def, k) => {
    cacLinhasComPct.push(cacLinhas[k]);
    const pctReal = participacaoPct(cacSeries[k], cacTotalSerie);
    const orcDoMes = subOrcSerie(def);
    const pctChild: Linha = {
      ...fazLinha(
        { metrica: `${def.metrica}_pct_total`, titulo: "↳ % do CAC total", direcao: "neutro", unidade: "pct" },
        pctReal,
        (m) => razao(orcDoMes[m - 1], cacOrcSerie[m - 1]) ?? 0,
        mesFechado === 0 ? undefined : {
          orcado: razaoYtd(orcDoMes, cacOrcSerie, mesFechado) ?? 0,
          realizado: razaoYtd(cacSeries[k], cacTotalSerie, mesFechado),
        },
      ),
      subItem: true,
      semDetalhe: true,
    };
    // linha de composição: sem semântica de meta
    pctChild.meses = pctChild.meses.map((m) => ({ ...m, atingimento: null }));
    pctChild.ytd = { ...pctChild.ytd, atingimento: null };
    cacLinhasComPct.push(pctChild);
  });

  // ---- sub-linha "% do faturamento" sob o total de SG&A ----
  // SG&A do mês (caixa) ÷ faturamento recebido no mês (entradas de RECEITA quitadas, mesma base de caixa da DFC).
  const sgaTotalSerie = somaSeries(sgaSeries);
  const sgaOrcMes = (m: number) => SUB_SGA.reduce((acc, d) => acc + (orcado[d.metrica]?.[m] ?? 0), 0);
  const fatCaixaMes = (m: number) => faturamentoCaixaPorMes[m] ?? 0;
  const fatOrcMes = (m: number) =>
    (orcado["mrr_ativo"]?.[m] ?? 0) + (orcado["receita_pontual"]?.[m] ?? 0) + (orcado["outras_receitas"]?.[m] ?? 0);
  const sgaPctFatSerie = Array.from({ length: 12 }, (_, i) =>
    i + 1 <= mesCorrente ? razao(sgaTotalSerie[i], fatCaixaMes(i + 1)) : null
  );
  const sgaTotalYtdReal = mesFechado === 0 ? null :
    sgaTotalSerie.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const sgaPctFaturamento: Linha = {
    ...fazLinha(
      { metrica: "sga_pct_faturamento", titulo: "↳ % do faturamento", direcao: "menor_melhor", unidade: "pct",
        nota: "SG&A do mês (caixa) ÷ faturamento recebido no mês — entradas de RECEITA quitadas (mesma base de caixa da DFC). Orçado ÷ plano de receita do BP (MRR ativo + pontual + outras)." },
      sgaPctFatSerie,
      (m) => razao(sgaOrcMes(m), fatOrcMes(m)) ?? 0,
      mesFechado === 0 ? undefined : {
        orcado: razao(somaAte(sgaOrcMes), somaAte(fatOrcMes)) ?? 0,
        realizado: razao(sgaTotalYtdReal, somaAte(fatCaixaMes)),
      }
    ),
    subItem: true,
    semDetalhe: true,
  };

  return {
    sga: [sgaTotal, sgaPctFaturamento, ...sgaLinhas],
    cac: [cacTotal, ...cacLinhasComPct, cacPorCliente, cacPorContrato, ...cacPorContratoFilhos, cacPctReceita, cacPayback],
    outrasReceitas: [orTotal, variavelL, stackL, demaisL],
  };
}
