// Matriz mês a mês do CEO Dashboard — lógica pura (sem IO), testável.
// Transpõe as linhas do BP (que já trazem série mensal) para uma tabela
// indicador × mês. Fonte única com os cards → mesmos números.

import type { BpLinha, CeoUnidade, CeoDirecao } from "./ceoDashboard.helpers";
import type { MovimentoReceita } from "./ceoDashboard.movimentoReceita";

export interface CeoMatrizCelula {
  mes: number;
  valor: number | null;
  meta: number | null;
  atingimentoPct: number | null; // já *100, 1 casa (mesma régua do card)
}

export interface CeoMatrizLinha {
  key: string;
  tipo?: "secao" | "dado"; // "secao" = linha de cabeçalho de agrupamento (sem células)
  label: string;
  unidade: CeoUnidade;
  direcao: CeoDirecao;
  semMeta: boolean; // inadimplência, ltv_fat, ltv_dfc, enps, nps
  semCompacto?: boolean; // valor cheio (R$ 4.290) em vez de compacto (R$ 4K) — p/ razões na casa dos milhares
  nota?: string;
  celulas: CeoMatrizCelula[]; // uma por mês, alinhada a `meses`
}

export interface CeoMatrizResponse {
  ate: string; // "2026-07"
  mesFechado: number; // último mês fechado; colunas com mes > mesFechado são parciais
  meses: { mes: number; label: string }[];
  linhas: CeoMatrizLinha[];
}

export interface CeoMatrizSources {
  mesNum: number; // última coluna (colunas = 1..mesNum)
  mesFechado: number; // último mês com dados completos (mês corrente é parcial)
  bpLinhas: BpLinha[];
  bpMetricas: BpLinha[];
  // Linhas já reconstruídas em regime de caixa (recebido/DFC) — ver *FromBp helpers.
  receitaRecebida: BpLinha;
  receitaCabecaCaixa: BpLinha;
  // Séries mensais sem meta (valor por mês; mês ausente → célula "—").
  inadimplenciaSeriePorMes: Record<number, number>; // por mês de vencimento
  ltvFatSeriePorMes: Record<number, number>; // LTV faturável mediano dos ativos (ClickUp: valorr × meses + pontual entregue)
  ltvDfcSeriePorMes: Record<number, number>; // LTV caixa mediano dos ativos (pago real Conta Azul + teórico pré-out/2025)
  enpsSeriePorMes: Record<number, number>; // NPS interno por mês da pesquisa (gap em meses sem onda)
  // Linhas de eficiência de aquisição já calculadas pelo BP (bp.cacDetalhe) — CAC total ÷ unidade.
  // Trazem meses[] com orçado/realizado/atingimento (mesmo formato das linhas do BP) → têm meta.
  cacPorClienteLinha?: BpLinha; // CAC total ÷ deals ganhos no Bitrix
  cacPorContratoLinha?: BpLinha; // CAC total ÷ serviços vendidos no Bitrix
  movimento?: MovimentoReceita["linhas"]; // as 8 linhas do bloco de movimento de receita (opcional)
}

const MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Transpõe uma linha do BP (meses[]) em células mês 1..mesNum.
// Mês sem realizado → valor null, mas a meta (orçado) segue visível.
function celulasDoBp(linha: BpLinha | undefined, mesNum: number): CeoMatrizCelula[] {
  const byMes = new Map((linha?.meses ?? []).map((m) => [m.mes, m]));
  const out: CeoMatrizCelula[] = [];
  for (let mes = 1; mes <= mesNum; mes++) {
    const m = byMes.get(mes);
    out.push({
      mes,
      valor: m?.realizado ?? null,
      meta: m?.orcado ?? null,
      // *100 p/ razão→%; round(...*1000)/10 evita ruído de float (ex.: 1.1*100).
      atingimentoPct: m?.atingimento != null ? Math.round(m.atingimento * 1000) / 10 : null,
    });
  }
  return out;
}

// Série própria por mês (inadimplência): valor onde há dado, sem meta.
function celulasDaSerie(seriePorMes: Record<number, number>, mesNum: number): CeoMatrizCelula[] {
  const out: CeoMatrizCelula[] = [];
  for (let mes = 1; mes <= mesNum; mes++) {
    const v = seriePorMes[mes];
    out.push({ mes, valor: v ?? null, meta: null, atingimentoPct: null });
  }
  return out;
}

export function montarMatrizCeo(s: CeoMatrizSources): CeoMatrizResponse {
  const mesNum = s.mesNum;
  const find = (arr: BpLinha[], metrica: string) => arr.find((l) => l.metrica === metrica);

  const bpLinha = (
    arr: BpLinha[], metrica: string, key: string, label: string, direcao: CeoDirecao, unidade: CeoUnidade
  ): CeoMatrizLinha => ({
    key, label, unidade, direcao, semMeta: false, celulas: celulasDoBp(find(arr, metrica), mesNum),
  });

  const secao = (key: string, label: string): CeoMatrizLinha => ({
    key, label, tipo: "secao", unidade: "brl", direcao: "neutro", semMeta: true, celulas: [],
  });
  const movLinha = (
    linha: BpLinha | undefined, key: string, label: string,
    direcao: CeoDirecao, unidade: CeoUnidade, semMeta: boolean, nota?: string
  ): CeoMatrizLinha => ({
    key, label, unidade, direcao, semMeta, nota, celulas: celulasDoBp(linha, mesNum),
  });

  const linhas: CeoMatrizLinha[] = [
    { key: "receita", label: "Receita", unidade: "brl", direcao: "maior_melhor", semMeta: false,
      celulas: celulasDoBp(s.receitaRecebida, mesNum) },
    bpLinha(s.bpMetricas, "despesa_total", "custos", "Custos & Despesas", "menor_melhor", "brl"),
    bpLinha(s.bpLinhas, "ebitda", "lucro", "Lucro (EBITDA)", "maior_melhor", "brl"),
    { key: "geracao_caixa", label: "Geração de Caixa", unidade: "brl", direcao: "maior_melhor", semMeta: false,
      nota: "Geração de Caixa (DFC) = entradas − saídas quitadas no mês (caixa dos dois lados) — a linha Fluxo de Caixa do BP. Meta = geração de caixa orçada no BP. ≠ Receita − Custos da tabela (lá os custos são competência).",
      celulas: celulasDoBp(find(s.bpLinhas, "dfc_real"), mesNum) },
    bpLinha(s.bpMetricas, "saldo_caixa", "caixa", "Saldo de Caixa", "maior_melhor", "brl"),
    { key: "inadimplencia", label: "Inadimplência Total", unidade: "brl", direcao: "menor_melhor",
      semMeta: true, nota: "Por mês de vencimento das parcelas em aberto.",
      celulas: celulasDaSerie(s.inadimplenciaSeriePorMes, mesNum) },
    { key: "nps", label: "NPS Clientes", unidade: "score", direcao: "maior_melhor", semMeta: true,
      nota: "Sem fonte de dados de NPS de clientes ainda.", celulas: celulasDaSerie({}, mesNum) },
    bpLinha(s.bpLinhas, "cac", "cac", "CAC", "menor_melhor", "brl"),
    { key: "cac_por_cliente", label: "CAC por cliente", unidade: "brl", direcao: "menor_melhor", semMeta: false, semCompacto: true,
      nota: "CAC total do mês ÷ deals ganhos no Bitrix (proxy de clientes adquiridos). Mesma régua da aba CAC do BP 2026.",
      celulas: celulasDoBp(s.cacPorClienteLinha, mesNum) },
    { key: "cac_por_contrato", label: "CAC por contrato", unidade: "brl", direcao: "menor_melhor", semMeta: false, semCompacto: true,
      nota: "CAC total do mês ÷ serviços vendidos no Bitrix (campo servicos_vendidos: cada serviço = 1 contrato). Mesma régua da aba CAC do BP 2026.",
      celulas: celulasDoBp(s.cacPorContratoLinha, mesNum) },
    { key: "ltv_fat", label: "LTV FAT", unidade: "brl", direcao: "maior_melhor", semMeta: true,
      nota: "LTV faturável mediano dos clientes ativos no mês (ClickUp): Valor R × meses de vida + pontual entregue.",
      celulas: celulasDaSerie(s.ltvFatSeriePorMes, mesNum) },
    { key: "ltv_dfc", label: "LTV DFC", unidade: "brl", direcao: "maior_melhor", semMeta: true,
      nota: "LTV caixa mediano dos clientes ativos no mês: pago real no Conta Azul desde out/2025 + faturável teórico antes disso (sem CNPJ casado, usa o faturável).",
      celulas: celulasDaSerie(s.ltvDfcSeriePorMes, mesNum) },
    bpLinha(s.bpMetricas, "colaboradores", "headcount", "Headcount", "menor_melhor", "int"),
    { key: "enps", label: "E-NPS", unidade: "score", direcao: "maior_melhor", semMeta: true,
      nota: "NPS interno por mês da pesquisa; meses sem onda de pesquisa ficam vazios.",
      celulas: celulasDaSerie(s.enpsSeriePorMes, mesNum) },
    { key: "receita_cabeca", label: "Receita / Cabeça", unidade: "brl", direcao: "maior_melhor",
      semMeta: false, celulas: celulasDoBp(s.receitaCabecaCaixa, mesNum) },
    ...(s.movimento ? [
      secao("mov_secao_mrr", "Movimento de Receita — Recorrente (MRR)"),
      movLinha(s.movimento.vendaMrr, "venda_mrr", "Venda MRR", "maior_melhor", "brl", false),
      movLinha(s.movimento.churnMrr, "churn_mrr", "Churn MRR", "menor_melhor", "brl", false),
      movLinha(s.movimento.crossMrr, "cross_mrr", "Venda de Cross-sell/Upsell MRR", "maior_melhor", "brl", true,
        "Deals de cross-sell/upsell recorrente (source PARTNER, cliente pré-existente). Sem meta no BP."),
      movLinha(s.movimento.nrr, "nrr", "NRR", "menor_melhor", "pct", true,
        "Erosão líquida da base recorrente = (Churn − Cross-sell) ÷ MRR do início do mês. Menor é melhor; sem meta no BP."),
      secao("mov_secao_pontual", "Movimento de Receita — Pontual"),
      movLinha(s.movimento.vendaPontual, "venda_pontual", "Venda Pontual", "maior_melhor", "brl", false),
      movLinha(s.movimento.churnPontual, "churn_pontual", "Churn Pontual", "menor_melhor", "brl", true,
        "Churn pontual por data de cancelamento (cup_contratos). Sem meta no BP."),
      movLinha(s.movimento.crossPontual, "cross_pontual", "Venda de Cross-sell/Upsell Pontual", "maior_melhor", "brl", true,
        "Parte pontual dos deals de cross-sell/upsell. Sem meta no BP."),
      movLinha(s.movimento.nrrPontual, "nrr_pontual", "NRR Pontual", "menor_melhor", "pct", true,
        "Erosão do estoque pontual = (Churn pontual − Cross-sell pontual) ÷ estoque pontual inicial. Menor é melhor; sem meta no BP."),
    ] : []),
  ];

  const meses = Array.from({ length: mesNum }, (_, i) => ({ mes: i + 1, label: MESES_LABEL[i] }));
  return { ate: `2026-${String(mesNum).padStart(2, "0")}`, mesFechado: s.mesFechado, meses, linhas };
}
