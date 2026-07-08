// server/routes/scorecard.detalhe.composicoes.ts
// Composições do Capacity (Fase 2C-i) — razões/derivados do dispatcher de detalhe do Scorecard
// (server/routes/scorecard.detalhe.ts): `receita_cabeca`, `geracao_liquida`, `conversao_caixa`.
// Extraído para cá (em vez de scorecard.detalhe.helpers.ts) para nenhum dos dois arquivos passar
// de 500 linhas. Mesmo padrão de composição de `churn_pct` (scorecard.detalhe.ts): sem `total`
// (é uma razão, não uma soma) — a tabela lista os COMPONENTES do cálculo, com `formula` exibida
// acima. Cada `montar*Detalhe` REUSA os builders SOMÁVEIS já existentes (Fase 2A, em
// scorecard.detalhe.helpers.ts) em vez de duplicar query — ver docstring de cada função.
import { fetchPessoasPorSquad } from "./scorecard";
import { montarMrrAtivoDetalhe, montarEntregueDetalhe, montarGeracaoCaixaDetalhe } from "./scorecard.detalhe.helpers";
import type { DrillDetalhe } from "./scorecard.detalhe";

/** "R$ 1.234" — mesmo padrão de `brl` em gestaoReceita.detalhe.ts (duplicado localmente, não há
   util de formatação compartilhado entre os arquivos de detalhe). Usado só nos `subtitulo` das
   composições abaixo (a tabela em si formata via `DrillSheet`/`tipo: "brl"` no client). */
function brl(n: number): string {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

// ---------------------------------------------------------------------------
// receita_cabeca — (MRR ativo + Entregas deploy) ÷ nº de pessoas, mesma fórmula de
// `linhasReceitaCabeca` (client/src/pages/painel-executivo/scorecard/logica.ts), que alimenta as
// seções "Receita por Cabeça — por squad/operador" do Capacity.
// ---------------------------------------------------------------------------

const DIM_LABEL_RECEITA_CABECA: Record<"squad" | "operador", string> = { squad: "Squad", operador: "Operador" };

/** Monta o payload de composição a partir dos 3 componentes já calculados — pura/testável sem
   banco (mesmo padrão de `montarChurnPctDrillDetalhe` em scorecard.detalhe.ts). `pessoas` null
   (headcount não resolvido, ex: squad de receita sem par de RH casado) propaga como `null` no
   "Nº de pessoas" e na razão final — o `DrillSheet` renderiza "—" em vez de mentir uma divisão
   por zero. */
export function montarReceitaCabecaDrillDetalhe(
  dim: "squad" | "operador",
  valorDim: string,
  mrr: number,
  entregas: number,
  pessoas: number | null,
): DrillDetalhe {
  const bruto = mrr + entregas;
  const receitaPorCabeca = pessoas ? bruto / pessoas : null;

  return {
    titulo: `Receita por Cabeça — ${DIM_LABEL_RECEITA_CABECA[dim]}: ${valorDim}`,
    subtitulo: receitaPorCabeca != null ? brl(receitaPorCabeca) : undefined,
    formula: "Receita/Cabeça = (MRR ativo + Entregas deploy) ÷ nº de pessoas",
    colunas: [
      { chave: "componente", label: "Componente", tipo: "text" },
      { chave: "valor", label: "Valor", tipo: "brl" },
    ],
    linhas: [
      { componente: `MRR ativo (${valorDim})`, valor: mrr },
      { componente: `Entregas deploy (${valorDim})`, valor: entregas },
      { componente: "Nº de pessoas", valor: pessoas, valorTipo: "int" },
      { componente: "= Receita por cabeça", valor: receitaPorCabeca },
    ],
  };
}

/** `dim`/`valor` são OBRIGATÓRIOS aqui — ao contrário dos tipos SOMÁVEIS (mrr_ativo/entregue), que
   têm um total geral sem dimensão, "Receita por Cabeça" só existe quebrada por squad ou operador
   (mesma regra de `montarContribuicaoSquadDetalhe` em scorecard.detalhe.helpers.ts, que também
   exige `valor`). */
export async function montarReceitaCabecaDetalhe(mes: string, dim?: string, valor?: string): Promise<DrillDetalhe> {
  if ((dim !== "squad" && dim !== "operador") || !valor) {
    return {
      titulo: "Receita por Cabeça",
      subtitulo: "Parâmetros 'dim' (squad|operador) e 'valor' são obrigatórios para este tipo.",
      formula: "Receita/Cabeça = (MRR ativo + Entregas deploy) ÷ nº de pessoas",
      colunas: [
        { chave: "componente", label: "Componente", tipo: "text" },
        { chave: "valor", label: "Valor", tipo: "brl" },
      ],
      linhas: [],
    };
  }

  // MRR/Entregas reusam os MESMOS builders SOMÁVEIS já expostos como tipos próprios
  // (mrr_ativo/entregue, Fase 2A, scorecard.detalhe.helpers.ts) — mesma fonte/exclusões de
  // `fetchMrrPorDimensao`/`fetchEntregasPorOperador`/`fetchEntregasPorSquad` (scorecard.ts): ambos
  // os pares consultam "Clickup".cup_data_hist (snapshot de fim de mês)/cup_contratos com as
  // MESMAS condições de status/data, só filtrando dim/valor de formas equivalentes
  // (COALESCE(NULLIF(TRIM(...)))) — o `.total` de cada um já é exatamente a soma que apareceria na
  // série do card. Reusar os builders de drill (que já recebem mes/dim/valor direto) evita
  // duplicar a query e evita rodar a janela de 12 meses das funções de série só para descartar 11
  // pontos.
  const [mrrDetalhe, entregueDetalhe, pessoasPorSquad] = await Promise.all([
    montarMrrAtivoDetalhe(mes, dim, valor),
    montarEntregueDetalhe(mes, dim, valor),
    dim === "squad" ? fetchPessoasPorSquad([valor]) : Promise.resolve<Record<string, number>>({}),
  ]);
  const pessoas = dim === "operador" ? 1 : pessoasPorSquad[valor] ?? null;

  return montarReceitaCabecaDrillDetalhe(dim, valor, mrrDetalhe.total ?? 0, entregueDetalhe.total ?? 0, pessoas);
}

// ---------------------------------------------------------------------------
// geracao_liquida / conversao_caixa — Geração de caixa = Receita (caixa) − Despesas (DFC);
// Conversão % = Geração ÷ Receita. Mesma fonte/exclusões de `geracao_caixa_receita`/
// `geracao_caixa_despesa` (scorecard.detalhe.helpers.ts): "Conta Azul".caz_parcelas QUITADO por
// `data_quitacao` no mês — reusa o próprio builder (`montarGeracaoCaixaDetalhe`) para não
// duplicar a query; o `.total` de cada chamada já é a soma que reconcilia com as linhas "Receita
// (caixa)"/"(−) Despesas (DFC)" do card (ligadas na Fase 2B).
// ---------------------------------------------------------------------------

async function fetchGeracaoCaixaTotais(mes: string): Promise<{ receita: number; despesa: number }> {
  const [receitaDetalhe, despesaDetalhe] = await Promise.all([
    montarGeracaoCaixaDetalhe(mes, "RECEITA"),
    montarGeracaoCaixaDetalhe(mes, "DESPESA"),
  ]);
  return { receita: receitaDetalhe.total ?? 0, despesa: despesaDetalhe.total ?? 0 };
}

/** Pura/testável sem banco (mesmo padrão de `montarChurnPctDrillDetalhe`/
   `montarReceitaCabecaDrillDetalhe`). Despesa aparece com valor POSITIVO na linha "(−) Despesas
   (DFC)" — o sinal de subtração já está no rótulo, não no número (mesma convenção do card, que
   também mostra a despesa como um valor positivo com o rótulo "(−) Despesas"). */
export function montarGeracaoLiquidaDrillDetalhe(receita: number, despesa: number): DrillDetalhe {
  const liquida = receita - despesa;
  return {
    titulo: "Geração de Caixa — Composição",
    subtitulo: brl(liquida),
    formula: "Geração de caixa = Receita recebida − Despesas (DFC)",
    colunas: [
      { chave: "componente", label: "Componente", tipo: "text" },
      { chave: "valor", label: "Valor", tipo: "brl" },
    ],
    linhas: [
      { componente: "Receita (caixa)", valor: receita },
      { componente: "(−) Despesas (DFC)", valor: despesa },
      { componente: "= Geração de caixa", valor: liquida },
    ],
  };
}

export async function montarGeracaoLiquidaDetalhe(mes: string): Promise<DrillDetalhe> {
  const { receita, despesa } = await fetchGeracaoCaixaTotais(mes);
  return montarGeracaoLiquidaDrillDetalhe(receita, despesa);
}

/** Pura/testável sem banco. `receita <= 0` → conversão `null` (guarda divisão por zero/Infinity,
   mesma regra de `calcAtingimento`/`fecharContribuicaoMes` no client: não mentir um "0%" quando o
   divisor é inválido). */
export function montarConversaoCaixaDrillDetalhe(receita: number, despesa: number): DrillDetalhe {
  const liquida = receita - despesa;
  const conversao = receita > 0 ? (liquida / receita) * 100 : null;
  return {
    titulo: "Conversão em Caixa % — Composição",
    subtitulo: conversao != null ? `${conversao.toFixed(1)}%` : undefined,
    formula: "Conversão em caixa % = Geração de caixa ÷ Receita (caixa)",
    colunas: [
      { chave: "componente", label: "Componente", tipo: "text" },
      { chave: "valor", label: "Valor", tipo: "brl" },
    ],
    linhas: [
      { componente: "Geração de caixa", valor: liquida, valorTipo: "brl" },
      { componente: "Receita (caixa)", valor: receita, valorTipo: "brl" },
      { componente: "= Conversão", valor: conversao, valorTipo: "pct" },
    ],
  };
}

export async function montarConversaoCaixaDetalhe(mes: string): Promise<DrillDetalhe> {
  const { receita, despesa } = await fetchGeracaoCaixaTotais(mes);
  return montarConversaoCaixaDrillDetalhe(receita, despesa);
}
