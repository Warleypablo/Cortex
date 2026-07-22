// Derivação pura das métricas de uma semana, a partir das entradas cruas das
// queries. Sem I/O, para que as fórmulas — Net Churn sobre o cross de MRR,
// MRR Ativo vs Operando, bases dos percentuais — sejam testáveis sem banco.
// Mesmo desenho de `derivarMetricas` em services/resumoLideres.ts.
import type { Semana } from "./semanas";
import type { VendasPorChannel } from "../crm/expansao";

export interface EntradaSemana {
  semana: Semana;
  vendas: VendasPorChannel;
  carteira: { triagemOnboarding: number; ativo: number; emCancelamento: number };
  /** MRR (triagem+onboarding+ativo) no último snapshot ANTES da segunda-feira */
  baseMrr: number;
  /** valorp em aberto no mesmo snapshot de abertura */
  basePontual: number;
  entregaPontual: number;
  churnMrr: { total: number; ajustado: number };
  churnPontual: { total: number; ajustado: number };
}

export interface SemanaMetricas {
  inicio: string;
  fim: string;
  label: string;
  parcial: boolean;

  mrrAdicionado: number;
  pontualVendido: number;

  carteiraTriagemOnboarding: number;
  carteiraAtivo: number;
  carteiraEmCancelamento: number;
  mrrAtivo: number;
  mrrOperando: number;
  entregaPontual: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrTotalPct: number;
  churnMrrAjustado: number;
  churnMrrAjustadoPct: number;
  churnPontualTotal: number;
  churnPontualTotalPct: number;
  churnPontualAjustado: number;
  churnPontualAjustadoPct: number;

  crossMrr: number;
  crossPontual: number;
  crossTotal: number;

  netChurnAjustado: number;
  netChurnAjustadoPct: number;
  netChurnBruto: number;
  netChurnBrutoPct: number;

  /** true quando a query de vendas falhou: os zeros não significam "sem vendas" */
  vendasIndisponivel: boolean;
}

function pct(valor: number, base: number): number {
  return base > 0 ? (valor / base) * 100 : 0;
}

export function derivarSemana(e: EntradaSemana): SemanaMetricas {
  const mrrAtivo = e.carteira.triagemOnboarding + e.carteira.ativo;
  const mrrOperando = mrrAtivo + e.carteira.emCancelamento;

  // Net Churn subtrai só o cross de MRR (crossMrr), nunca o crossTotal: somar
  // pontual ao numerador de uma taxa cuja base é MRR mistura duas grandezas.
  // Mesma régua da mensagem diária desde a v3.
  const netChurnAjustado = e.churnMrr.ajustado - e.vendas.crossMrr;
  const netChurnBruto = e.churnMrr.total - e.vendas.crossMrr;

  return {
    inicio: e.semana.inicio,
    fim: e.semana.fim,
    label: e.semana.label,
    parcial: e.semana.parcial,

    mrrAdicionado: e.vendas.novoMrr,
    pontualVendido: e.vendas.novoPontual,

    carteiraTriagemOnboarding: e.carteira.triagemOnboarding,
    carteiraAtivo: e.carteira.ativo,
    carteiraEmCancelamento: e.carteira.emCancelamento,
    mrrAtivo,
    mrrOperando,
    entregaPontual: e.entregaPontual,

    baseMrr: e.baseMrr,
    basePontual: e.basePontual,

    churnMrrTotal: e.churnMrr.total,
    churnMrrTotalPct: pct(e.churnMrr.total, e.baseMrr),
    churnMrrAjustado: e.churnMrr.ajustado,
    churnMrrAjustadoPct: pct(e.churnMrr.ajustado, e.baseMrr),
    churnPontualTotal: e.churnPontual.total,
    churnPontualTotalPct: pct(e.churnPontual.total, e.basePontual),
    churnPontualAjustado: e.churnPontual.ajustado,
    churnPontualAjustadoPct: pct(e.churnPontual.ajustado, e.basePontual),

    crossMrr: e.vendas.crossMrr,
    crossPontual: e.vendas.crossPontual,
    crossTotal: e.vendas.crossMrr + e.vendas.crossPontual,

    netChurnAjustado,
    netChurnAjustadoPct: pct(netChurnAjustado, e.baseMrr),
    netChurnBruto,
    netChurnBrutoPct: pct(netChurnBruto, e.baseMrr),

    vendasIndisponivel: e.vendas.erro === true,
  };
}
