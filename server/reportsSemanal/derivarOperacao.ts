// Derivação pura da tela /reports/operacao a partir das entradas cruas das
// queries. Sem I/O, para que as fórmulas — churn líquido, percentuais sobre a
// base de abertura, métricas por cabeça, pareamento de produtos e motivos —
// sejam testáveis sem banco. Mesmo desenho de ./derivar.ts.
import type { Semana } from "./semanas";
import type { Carteira, Base, ChurnValores } from "./queries";
import type { LinhaProduto, LinhaMotivo } from "./queriesOperacao";

export interface EntradaOperacao {
  semana: Semana;
  /** foto do último snapshot <= domingo */
  carteira: Carteira;
  /** último snapshot ANTES da segunda: a carteira que a semana recebeu */
  base: Base;
  entregaPontual: number;
  /** estoque em aberto na foto do FIM da semana */
  estoquePontual: number;
  estoquePorProduto: LinhaProduto[];
  churnMrr: ChurnValores;
  churnPontual: ChurnValores;
  churnPorMotivo: LinhaMotivo[];
  headcountOperacao: number;
  /** Receita Total Faturável do mês; null quando indisponível */
  faturavelMes: number | null;
  /** true quando o mês da semana ainda está aberto (payload.mesFechado < mês pedido) */
  faturavelMesParcial: boolean;
}

export interface SemanaOperacao {
  inicio: string;
  fim: string;
  label: string;

  mrrAtivo: number;
  mrrOperando: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrAbonado: number;
  churnMrrLiquido: number;
  churnMrrLiquidoPct: number;
  churnPontualTotal: number;
  churnPontualAbonado: number;
  churnPontualLiquido: number;
  churnPontualLiquidoPct: number;

  entregaPontual: number;
  estoquePontual: number;

  headcountOperacao: number;
  /** null quando não há headcount: '—' na tela, nunca Infinity */
  mrrPorCabeca: number | null;
  /** null quando o faturável do mês está indisponível: zero se leria como 'faturou nada' */
  faturamentoPorCabeca: number | null;
  /** true quando o mês da semana ainda está em curso: valor incompleto, não comparável */
  faturamentoPorCabecaParcial: boolean;

  estoquePorProduto: LinhaProduto[];
  churnPorMotivo: LinhaMotivo[];
}

export interface ProdutoComparado {
  chave: string;
  atual: number;
  anterior: number;
  qtdAtual: number;
  qtdAnterior: number;
}

export interface MotivoComparado {
  chave: string;
  atual: number;
  anterior: number;
  pontualAtual: number;
  pontualAnterior: number;
}

export interface Comparativo {
  atual: SemanaOperacao;
  anterior: SemanaOperacao;
  produtos: ProdutoComparado[];
  motivos: MotivoComparado[];
}

function pct(valor: number, base: number): number {
  return base > 0 ? (valor / base) * 100 : 0;
}

function porCabeca(valor: number | null, headcount: number): number | null {
  if (valor === null || headcount <= 0) return null;
  return valor / headcount;
}

export function derivarOperacao(e: EntradaOperacao): SemanaOperacao {
  const mrrAtivo = e.carteira.triagemOnboarding + e.carteira.ativo;
  const mrrOperando = mrrAtivo + e.carteira.emCancelamento;

  // Líquido desconta o ABONADO (abonar_churn), não os três motivos operacionais
  // do 'ajustado' do BP 2026. As duas réguas andam coladas mas não são o mesmo
  // conjunto — a escolha aqui é a que faz Total − Abonado = Líquido fechar na
  // tela. Ver a spec para os números que medem a divergência.
  const churnMrrLiquido = e.churnMrr.total - e.churnMrr.abonado;
  const churnPontualLiquido = e.churnPontual.total - e.churnPontual.abonado;

  return {
    inicio: e.semana.inicio,
    fim: e.semana.fim,
    label: e.semana.label,

    mrrAtivo,
    mrrOperando,

    baseMrr: e.base.mrr,
    basePontual: e.base.pontual,

    churnMrrTotal: e.churnMrr.total,
    churnMrrAbonado: e.churnMrr.abonado,
    churnMrrLiquido,
    // Percentuais dividem pela base de ABERTURA da semana, nunca pela carteira
    // do fim (mrrAtivo): a carteira do fim já perdeu o churn, então dividir a
    // perda por ela subestimaria a taxa.
    churnMrrLiquidoPct: pct(churnMrrLiquido, e.base.mrr),
    churnPontualTotal: e.churnPontual.total,
    churnPontualAbonado: e.churnPontual.abonado,
    churnPontualLiquido,
    churnPontualLiquidoPct: pct(churnPontualLiquido, e.base.pontual),

    entregaPontual: e.entregaPontual,
    estoquePontual: e.estoquePontual,

    headcountOperacao: e.headcountOperacao,
    mrrPorCabeca: porCabeca(mrrAtivo, e.headcountOperacao),
    faturamentoPorCabeca: porCabeca(e.faturavelMes, e.headcountOperacao),
    faturamentoPorCabecaParcial: e.faturavelMesParcial,

    estoquePorProduto: e.estoquePorProduto,
    churnPorMotivo: e.churnPorMotivo,
  };
}

/**
 * União das chaves das duas semanas, ordenada pelo valor atual desc.
 *
 * A união importa: uma chave que existe só na semana anterior precisa aparecer
 * com atual = 0. Sumir da tabela esconderia exatamente o caso interessante —
 * o produto que zerou o estoque, o motivo de churn que parou de acontecer.
 */
export function parearLinhas<T>(
  atuais: T[],
  anteriores: T[],
  chaveDe: (x: T) => string,
  valorDe: (x: T) => number,
): { chave: string; atual: T | undefined; anterior: T | undefined }[] {
  const mapaAtual = new Map(atuais.map((x) => [chaveDe(x), x]));
  const mapaAnterior = new Map(anteriores.map((x) => [chaveDe(x), x]));
  const chaves = Array.from(
    new Set([...Array.from(mapaAtual.keys()), ...Array.from(mapaAnterior.keys())]),
  );
  return chaves
    .map((chave) => ({ chave, atual: mapaAtual.get(chave), anterior: mapaAnterior.get(chave) }))
    .sort((a, b) => {
      const va = a.atual ? valorDe(a.atual) : 0;
      const vb = b.atual ? valorDe(b.atual) : 0;
      if (vb !== va) return vb - va;
      const pa = a.anterior ? valorDe(a.anterior) : 0;
      const pb = b.anterior ? valorDe(b.anterior) : 0;
      return pb - pa;
    });
}

export function compararOperacao(atual: SemanaOperacao, anterior: SemanaOperacao): Comparativo {
  const produtos: ProdutoComparado[] = parearLinhas(
    atual.estoquePorProduto,
    anterior.estoquePorProduto,
    (p) => p.produto,
    (p) => p.valor,
  ).map((l) => ({
    chave: l.chave,
    atual: l.atual?.valor ?? 0,
    anterior: l.anterior?.valor ?? 0,
    qtdAtual: l.atual?.qtd ?? 0,
    qtdAnterior: l.anterior?.qtd ?? 0,
  }));

  const motivos: MotivoComparado[] = parearLinhas(
    atual.churnPorMotivo,
    anterior.churnPorMotivo,
    (m) => m.motivo,
    (m) => m.mrr,
  ).map((l) => ({
    chave: l.chave,
    atual: l.atual?.mrr ?? 0,
    anterior: l.anterior?.mrr ?? 0,
    pontualAtual: l.atual?.pontual ?? 0,
    pontualAnterior: l.anterior?.pontual ?? 0,
  }));

  return { atual, anterior, produtos, motivos };
}
