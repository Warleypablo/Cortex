// Funções puras do scorecard: status vs. meta, delta M/M-1 e formatação de valor.
// Sem I/O, sem React — só lógica testável isoladamente (ver logica.test.ts).

import { formatCurrencyNoDecimals, formatPercent, formatDecimal } from "@/lib/utils";
import type { ScorecardDirection, ScorecardFormato, ScorecardRow, ScorecardSeriePonto } from "./tipos";
import type { EvolucaoProdutoTabelaData } from "@/components/lt-ltv-churn/types";

export type ScorecardStatus = "good" | "warn" | "bad" | null;

/**
 * Compara o valor atual com a meta e devolve o "farol" do scorecard.
 * - direction="up" (maior é melhor): good se atual>=meta, warn se atual>=90% da meta, senão bad.
 * - direction="down" (menor é melhor, ex. churn): good se atual<=meta, warn se atual<=110% da meta, senão bad.
 * - meta ausente (null/undefined) ou atual null → sem status (null).
 */
export function calcStatus(
  atual: number | null,
  meta: number | null | undefined,
  direction: ScorecardDirection,
): ScorecardStatus {
  if (atual === null || atual === undefined || meta === null || meta === undefined) return null;

  if (direction === "up") {
    if (atual >= meta) return "good";
    if (atual >= meta * 0.9) return "warn";
    return "bad";
  }

  // direction === "down"
  if (atual <= meta) return "good";
  if (atual <= meta * 1.1) return "warn";
  return "bad";
}

export interface DeltaM1Ponto {
  valor: number | null;
}

export interface DeltaM1Result {
  pct: number;
  dir: "up" | "down" | "flat";
}

/**
 * Compara os 2 últimos pontos VÁLIDOS (valor não-nulo) de uma série mensal ordenada
 * e devolve a variação percentual + direção. `flat` quando a variação é desprezível
 * (|pct| < 0.05) ou quando o ponto-base é 0 (evita divisão por zero / infinito).
 * null se a série tiver menos de 2 pontos válidos.
 */
export function deltaM1(serie?: DeltaM1Ponto[] | null): DeltaM1Result | null {
  if (!serie) return null;

  const validos = serie.filter((p) => p.valor !== null && p.valor !== undefined);
  if (validos.length < 2) return null;

  const [base, atual] = validos.slice(-2).map((p) => p.valor as number);

  if (base === 0) return { pct: 0, dir: "flat" };

  const pct = ((atual - base) / base) * 100;
  if (Math.abs(pct) < 0.05) return { pct, dir: "flat" };
  return { pct, dir: pct > 0 ? "up" : "down" };
}

/** Ponto cru de uma série mensal por dimensão — mesmo shape devolvido por
   GET /api/scorecard/series (server/routes/scorecard.helpers.ts: `SeriePonto`). Sem `label`
   (o backend só manda `month`) — quem consome decide como abreviar o mês. `valor` aceita
   `null` (ex: `leadTimePorProduto`, onde mês sem entrega não deve virar 0 — ver
   `rowsParaSeriesNullFill`); séries que nunca têm null (churn/mrr/entregas) continuam
   compatíveis, `number` é atribuível a `number | null`. */
export interface SerieDimPonto {
  month: string;
  valor: number | null;
}

/**
 * Ponto de uma série ÚNICA (sem dimensão) no mês selecionado — mesma regra de seleção usada por
 * `linhasPorDimensao` abaixo (mês exato, senão o último ponto <= mes, senão null): garante que o
 * `atual` de uma linha "geral" reconcilie com o último ponto que o modo Evolução mostra para a
 * MESMA série, em vez de vir de uma fonte/população diferente (ex: overview cohort-based vs.
 * série event-based, ou whitelist vs. blacklist canônica — ver usos em SecaoChurn.tsx/
 * SecaoReceita.tsx). Quem chama decide o fallback quando a série inteira não estiver disponível
 * (loading/erro): normalmente mantém o `atual` antigo (`series ? atualDaSerie(...) : atualAntigo`).
 */
export function atualDaSerie(serie: SerieDimPonto[] | undefined | null, mes: string): number | null {
  if (!serie || serie.length === 0) return null;
  const ordenados = [...serie].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  const ponto = ordenados.find((p) => p.month === mes) ?? [...ordenados].reverse().find((p) => p.month <= mes);
  return ponto ? ponto.valor : null;
}

export interface LinhasPorDimensaoOpts {
  /** Monta o `key` estável da linha a partir do nome da dimensão (produto/operador/squad) —
     cada seção usa seu próprio `slug` + prefixo (ex: `churn_produto_${slug(dim)}`). */
  keyFn: (dim: string) => string;
  formato: ScorecardFormato;
  /** "YYYY-MM" → label curto (ex: "Jan") — cada seção já tem seu próprio `labelMesCurto`. */
  labelMes: (mes: string) => string;
  /** Limita a quantidade de linhas (após ordenar por atual desc). Omitido = todas as dimensões. */
  top?: number;
  /** Sub-texto opcional por linha (ex: motivo top casado por nome, ou % do total) — recebe o
     `atual` já resolvido desta MESMA série (nunca de uma fonte externa, para não descasar
     com a série exibida). */
  sub?: (dim: string, atual: number | null) => string | undefined;
  /** Quando true, marca o dono automático da linha como a própria dimensão (ex: operador). */
  responsavelAuto?: boolean;
  /** Propagado para `ScorecardRow.ytdAgg` de cada linha gerada — ex: "ultimo" para dimensões de
     ESTOQUE (MRR por squad/operador), onde somar os meses no YTD não faz sentido. Omitido = usa
     o default de `calcYtd` (por `formato`). */
  ytdAgg?: "soma" | "ultimo" | "media";
}

/**
 * Constrói linhas de Scorecard (`ScorecardRow[]`) a partir de uma série mensal por dimensão —
 * o shape `Record<dim, {month,valor}[]>` devolvido por GET /api/scorecard/series. O `atual` de
 * cada linha vem do ponto da série no mês selecionado (ou do último ponto <= mes, defensivo,
 * caso a janela não inclua `mes` exatamente) — NUNCA de uma fonte diferente da série, para que
 * o valor do mês e a linha do tempo do modo Evolução sempre reconciliem (mesma regra já seguida
 * pelo "Churn R$" geral em SecaoChurn.tsx). Ordena por atual desc; `top` (se informado) limita
 * a quantidade de linhas exibidas.
 */
export function linhasPorDimensao(
  series: Record<string, SerieDimPonto[]> | undefined,
  mes: string,
  opts: LinhasPorDimensaoOpts,
): ScorecardRow[] {
  if (!series) return [];

  const linhas = Object.entries(series).map(([dim, pontosCrus]) => {
    const ordenados = [...pontosCrus].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
    const pontoAtual = ordenados.find((p) => p.month === mes) ?? [...ordenados].reverse().find((p) => p.month <= mes);
    const atual = pontoAtual ? pontoAtual.valor : null;
    const serie: ScorecardSeriePonto[] = ordenados.map((p) => ({ month: p.month, label: opts.labelMes(p.month), valor: p.valor }));
    return { dim, atual, serie };
  });

  linhas.sort((a, b) => (b.atual ?? -Infinity) - (a.atual ?? -Infinity));
  const limitadas = typeof opts.top === "number" ? linhas.slice(0, opts.top) : linhas;

  return limitadas.map(({ dim, atual, serie }) => ({
    key: opts.keyFn(dim),
    metrica: dim,
    sub: opts.sub?.(dim, atual),
    atual,
    formato: opts.formato,
    serie,
    temporalidade: "mes",
    responsavelAuto: opts.responsavelAuto ? dim : undefined,
    ytdAgg: opts.ytdAgg,
  }));
}

export interface LinhasReceitaCabecaOpts {
  /** Monta o `key` estável da linha a partir do nome da dimensão (squad/operador). */
  keyFn: (dim: string) => string;
  /** "YYYY-MM" → label curto (ex: "Jan"). */
  labelMes: (mes: string) => string;
  /** Resolve o headcount (denominador) de cada dimensão — para squad, o headcount RH casado
     (`pessoasPorSquad` do backend); para operador, sempre 1 (o próprio operador é a "cabeça").
     Retorno falsy (0/null/undefined) → a dimensão inteira (atual E todos os pontos da série)
     fica `null` — guarda contra divisão por zero/Infinity/NaN em vez de mentir um valor. */
  pessoasPorDim: (dim: string) => number | null | undefined;
  /** Limita a quantidade de linhas (após ordenar por atual desc). Omitido = todas as dimensões. */
  top?: number;
  /** Quando true, marca o dono automático da linha como a própria dimensão (ex: operador). */
  responsavelAuto?: boolean;
}

/**
 * Constrói linhas de "Receita por Cabeça" por dimensão (squad ou operador) — Onda C2: combina
 * MRR + entregas pontuais (deploy) da MESMA dimensão/mês e divide pelo headcount resolvido via
 * `pessoasPorDim`. Como `linhasPorDimensao`, mas para uma métrica DERIVADA de duas séries (MRR e
 * entregas) em vez de uma só — por isso não reaproveita aquela função diretamente.
 *
 * `entregasSeries` pode não ter a dimensão (squad/operador sem entrega no período) — tratado
 * como 0 em cada mês, sem quebrar a série de MRR. `formato` é sempre "brl" e `metaKey` sempre
 * "receita_cabeca" (a meta fixa de R$ 20.000 — ver OVERRIDES em server/routes/scorecard.ts):
 * esta função só serve para esta métrica.
 */
export function linhasReceitaCabeca(
  mrrSeries: Record<string, SerieDimPonto[]> | undefined,
  entregasSeries: Record<string, SerieDimPonto[]> | undefined,
  mes: string,
  opts: LinhasReceitaCabecaOpts,
): ScorecardRow[] {
  if (!mrrSeries) return [];

  const linhas = Object.entries(mrrSeries).map(([dim, mrrPontos]) => {
    const pessoas = opts.pessoasPorDim(dim);
    const entregasPorMes = new Map((entregasSeries?.[dim] ?? []).map((p) => [p.month, p.valor ?? 0]));

    const ordenados = [...mrrPontos].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
    const serie: ScorecardSeriePonto[] = ordenados.map((p) => {
      const bruto = (p.valor ?? 0) + (entregasPorMes.get(p.month) ?? 0);
      const valor = pessoas ? bruto / pessoas : null;
      return { month: p.month, label: opts.labelMes(p.month), valor };
    });

    const pontoAtual = serie.find((p) => p.month === mes) ?? [...serie].reverse().find((p) => p.month! <= mes);
    const atual = pontoAtual ? pontoAtual.valor : null;
    return { dim, atual, serie };
  });

  linhas.sort((a, b) => (b.atual ?? -Infinity) - (a.atual ?? -Infinity));
  const limitadas = typeof opts.top === "number" ? linhas.slice(0, opts.top) : linhas;

  return limitadas.map(({ dim, atual, serie }) => ({
    key: opts.keyFn(dim),
    metrica: dim,
    atual,
    formato: "brl",
    serie,
    metaKey: "receita_cabeca",
    temporalidade: "mes",
    responsavelAuto: opts.responsavelAuto ? dim : undefined,
    // Razão (receita ÷ headcount) medida a cada mês — YTD = último ponto, não soma. Esta função
    // só serve para esta métrica (ver docstring acima), por isso hardcoded em vez de opt.
    ytdAgg: "ultimo",
  }));
}

export interface OverviewSeriePonto {
  month: string;
  valor: number;
}

export interface SerieOverviewLtLtv {
  lt: OverviewSeriePonto[];
  ltv: OverviewSeriePonto[];
  totalRecorrentes: OverviewSeriePonto[];
}

/**
 * Agrega a matriz de `evolucao-produto-tabela` (produto × mês, já usada por
 * "LTV por produto (evolução)") numa série mensal para o "overview" (LT médio, LTV médio,
 * total de recorrentes) — ponderada por `n` de cada produto no mês.
 *
 * IMPORTANTE: `evolucaoProduto.produtos` inclui o bucket agregado "Total" (BUCKETS_ORDER em
 * server/routes/ltLtvChurn.helpers.ts:buildMatrizEvolucaoProduto), que já soma TODOS os outros
 * produtos (Performance/Social Media/Creators/Outros). Somar `n` sobre TODOS os produtos
 * incluindo "Total" dobraria a contagem (usada como valor direto em "Total recorrentes", não só
 * como peso de média) — por isso este helper EXCLUI "Total" da agregação e reconstrói o total a
 * partir dos buckets individuais.
 *
 * Meses sem nenhum produto com dado são omitidos (não entram como ponto 0/null).
 */
export function serieOverviewLtLtv(evolucaoProduto: EvolucaoProdutoTabelaData | undefined): SerieOverviewLtLtv {
  if (!evolucaoProduto) return { lt: [], ltv: [], totalRecorrentes: [] };

  const produtos = evolucaoProduto.produtos.filter((p) => p !== "Total");
  const lt: OverviewSeriePonto[] = [];
  const ltv: OverviewSeriePonto[] = [];
  const totalRecorrentes: OverviewSeriePonto[] = [];

  for (const mes of evolucaoProduto.meses) {
    let totalN = 0;
    let ltNumerador = 0;
    let ltvNumerador = 0;
    for (const produto of produtos) {
      const cel = evolucaoProduto.celulas[produto]?.[mes];
      if (!cel) continue;
      totalN += cel.n;
      ltNumerador += cel.lt * cel.n;
      ltvNumerador += cel.ltv * cel.n;
    }
    if (totalN === 0) continue;
    lt.push({ month: mes, valor: ltNumerador / totalN });
    ltv.push({ month: mes, valor: ltvNumerador / totalN });
    totalRecorrentes.push({ month: mes, valor: totalN });
  }

  return { lt, ltv, totalRecorrentes };
}

// ── Onda E (Capacity): série mensal de Margem de Contribuição a partir do bulk ─────────────────
// GET /api/contribuicao-squad/dfc/bulk?ano=YYYY devolve receita/despesa CRU por squad×mês para o
// ano inteiro, mas não fecha a fórmula de contribuição — fechamos aqui com a MESMA fórmula do
// ranking (server/routes.ts:6610-6613): resultadoBruto = receita − despesa (despesa já SEM
// impostos: folha + freelancers + iFood); impostos = receita × 18%; contribuicao = resultadoBruto
// − impostos; margem% = contribuicao/receita (guard receita>0, senão null — evita 0% enganoso).
const IMPOSTOS_PCT_RECEITA = 0.18;

export interface ContribuicaoBulkDespesaMes {
  salarios: number;
  freelancers: number;
  ifood: number;
}
export interface ContribuicaoSquadBulkResumo {
  squad: string;
  porMes: number[]; // 12 posições, index 0 = janeiro
}
export interface ContribuicaoSquadBulkMesTotal {
  mes: string; // YYYY-MM
  data: { totais: { receitaTotal: number } } | null;
}
export interface ContribuicaoSquadBulkFonte {
  ano: number;
  meses: ContribuicaoSquadBulkMesTotal[];
  resumoPorSquad: ContribuicaoSquadBulkResumo[];
  despesasMensais: Record<string, ContribuicaoBulkDespesaMes>;
  despesasPorSquadMensais: Record<string, Record<string, ContribuicaoBulkDespesaMes>>;
}

export interface ContribuicaoMesCalc {
  month: string;
  receita: number;
  despesa: number;
  contribuicao: number;
  margem: number | null;
}

function somaDespesaSemImpostos(d: ContribuicaoBulkDespesaMes | undefined): number {
  if (!d) return 0;
  return (d.salarios || 0) + (d.freelancers || 0) + (d.ifood || 0);
}

function fecharContribuicaoMes(month: string, receita: number, despesa: number): ContribuicaoMesCalc {
  const resultadoBruto = receita - despesa;
  const impostos = receita * IMPOSTOS_PCT_RECEITA;
  const contribuicao = resultadoBruto - impostos;
  const margem = receita > 0 ? (contribuicao / receita) * 100 : null;
  return { month, receita, despesa, contribuicao, margem };
}

/**
 * Série mensal (12 meses do ano do bulk) da Margem de Contribuição GERAL — soma receita/despesa
 * de TODOS os squads por mês. Usa os totais JÁ globais do bulk (`meses[].data.totais.receitaTotal`
 * e `despesasMensais`) em vez de somar squad a squad: `despesasMensais` conta TODO colaborador/
 * freela do período (mesmo os de squads de RH sem par de squad de receita, que por isso ficam de
 * fora de `despesasPorSquadMensais` — ver `findRevenueSquad` no backend), então é o total mais
 * fiel de "TODOS os squads". Mês sem dado (`data: null`, squad zerado no ano) vira receita=0.
 */
export function serieContribuicaoGeral(bulk: ContribuicaoSquadBulkFonte | undefined): ContribuicaoMesCalc[] {
  if (!bulk) return [];
  return bulk.meses.map((m) => {
    const receita = m.data?.totais.receitaTotal ?? 0;
    const despesa = somaDespesaSemImpostos(bulk.despesasMensais[m.mes]);
    return fecharContribuicaoMes(m.mes, receita, despesa);
  });
}

/**
 * Série mensal de Margem de Contribuição POR SQUAD a partir do bulk. Squad sem despesa casada
 * num mês (colaborador de RH sem squad de receita correspondente naquele mês) fica com despesa=0
 * nesse ponto — subestima custo, mas preserva a receita real do squad (mesma degradação aceita
 * no backend para squads de RH sem par de receita).
 */
export function serieContribuicaoPorSquad(
  bulk: ContribuicaoSquadBulkFonte | undefined,
): Record<string, ContribuicaoMesCalc[]> {
  if (!bulk) return {};
  const resultado: Record<string, ContribuicaoMesCalc[]> = {};
  for (const { squad, porMes } of bulk.resumoPorSquad) {
    const despesasSquad = bulk.despesasPorSquadMensais[squad];
    resultado[squad] = porMes.map((receita, idx) => {
      const mesKey = `${bulk.ano}-${String(idx + 1).padStart(2, "0")}`;
      const despesa = somaDespesaSemImpostos(despesasSquad?.[mesKey]);
      return fecharContribuicaoMes(mesKey, receita, despesa);
    });
  }
  return resultado;
}

/**
 * Ponto de uma série de contribuição no mês selecionado (ou o último <= mes, defensivo) — mesma
 * regra de seleção de `linhasPorDimensao` acima, reaproveitada para reconciliar `atual`/`sub` com
 * o ponto exibido no modo Evolução. null se a série estiver vazia ou não tiver ponto <= mes.
 */
export function pontoContribuicaoNoMes(serie: ContribuicaoMesCalc[], mes: string): ContribuicaoMesCalc | null {
  if (serie.length === 0) return null;
  const ordenados = [...serie].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  return ordenados.find((p) => p.month === mes) ?? [...ordenados].reverse().find((p) => p.month <= mes) ?? null;
}

/**
 * Normaliza um nome de squad para comparação cross-fonte: remove emoji/acentos/espaços e
 * lowercase — mesma ideia do `stripEmoji` do backend (server/routes.ts, matching squad de RH →
 * squad de receita). Necessário porque o ranking (`getContribuicaoSquadDfc`, pipeline direto de
 * `caz_parcelas`) usa o literal "Sem Squad", enquanto o bulk (pipeline de itens) usa
 * `SEM_SQUAD_LABEL = '⚠️ Sem Squad'` (server/contribuicaoSquad/receitaPorItens.ts) — os dois
 * normalizam para a mesma chave.
 */
export function normalizarChaveSquad(squad: string): string {
  // Sem \p{L}/flag u (exige target es6+ no tsc deste projeto — mesmo motivo documentado em
  // squadColor() de ChurnAbonados.tsx): NFKD decompõe acentos em base+combining mark, removida
  // pelo range ̀-ͯ — o que sobra depois é ASCII puro (letras/dígitos), então
  // [^A-Za-z0-9]+ é suficiente para varrer emoji/espaço/pontuação sem o flag u.
  return squad
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

/**
 * Busca a série de contribuição de um squad (nome vindo do ranking) dentro do mapa por squad do
 * bulk, tolerando pequenas diferenças de rótulo (ver `normalizarChaveSquad`). Os dois endpoints
 * usam pipelines de receita DIFERENTES (ranking: `caz_parcelas` direto; bulk: pipeline de itens),
 * então o match é por NOME normalizado — não garante que os valores batam entre si, só que é o
 * mesmo squad. Sem match → undefined (fallback sem série, degradação graciosa).
 */
export function encontrarSerieSquad(
  porSquad: Record<string, ContribuicaoMesCalc[]>,
  squad: string,
): ContribuicaoMesCalc[] | undefined {
  if (porSquad[squad]) return porSquad[squad];
  const chaveAlvo = normalizarChaveSquad(squad);
  const match = Object.keys(porSquad).find((k) => normalizarChaveSquad(k) === chaveAlvo);
  return match ? porSquad[match] : undefined;
}

/**
 * Detecta squad DESATIVADO pelo marcador "(OFF)" no nome (ex: "✨ Aura (OFF)", "🐭 Makers (OFF)")
 * — usado para ocultar a linha desse squad nas seções cujo grão é squad (Ranking de squads,
 * Churn por squad, Capacity/Contribuição por squad etc.), sem mexer nos totais/agregados gerais
 * (o histórico do squad enquanto esteve ativo continua neles). Case/espaço-insensitive: casa
 * "(OFF)", "(off)", "( Off )" etc., independente do emoji que precede o nome.
 */
export function ehSquadOff(nome: string): boolean {
  return /\(\s*off\s*\)/i.test(nome);
}

// ── Geração de Caixa (regime de CAIXA) — GET /api/investors-report/geracao-caixa ───────────────
// Substitui, na Capacity, a antiga "Margem de Contribuição — Geral" (que somava só custos
// DIRETOS/parciais de squad): aqui receita/despesa já vêm fechadas do backend como TODAS as
// despesas pagas da DFC (folha + estrutura + impostos + sócios etc). Tipo local mirror da resposta
// do endpoint (mesmo padrão de `ContribuicaoSquadBulkFonte` acima) — mantém a lógica pura
// testável sem depender do shape exato do hook (`GeracaoCaixaResponse` em hooks.ts).
export interface GeracaoCaixaMesFonte {
  mes: string; // YYYY-MM
  receita: number;
  despesa: number;
  geracaoMes: number;
  caixaAcumulado: number;
}
export interface GeracaoCaixaFonte {
  series: GeracaoCaixaMesFonte[];
}

export interface GeracaoCaixaMesCalc {
  month: string;
  receita: number;
  despesa: number;
  geracaoMes: number;
  caixaAcumulado: number;
  /** null quando receita<=0 no mês (guard) — evita 0%/Infinity enganoso. */
  conversaoPct: number | null;
}

/**
 * Série mensal de Geração de Caixa a partir do endpoint — só deriva `conversaoPct`
 * (geracaoMes/receita), o resto já vem fechado do backend.
 */
export function serieGeracaoCaixa(fonte: GeracaoCaixaFonte | undefined): GeracaoCaixaMesCalc[] {
  if (!fonte) return [];
  return fonte.series.map((p) => ({
    month: p.mes,
    receita: p.receita,
    despesa: p.despesa,
    geracaoMes: p.geracaoMes,
    caixaAcumulado: p.caixaAcumulado,
    conversaoPct: p.receita > 0 ? (p.geracaoMes / p.receita) * 100 : null,
  }));
}

/**
 * Ponto da série de Geração de Caixa no mês selecionado (ou o último <= mes, defensivo) — mesma
 * regra de seleção de `pontoContribuicaoNoMes` acima. null se a série estiver vazia (loading/erro
 * do hook) — quem chama degrada para "—" (ScorecardRow.atual = null → formatValor).
 */
export function pontoGeracaoCaixaNoMes(serie: GeracaoCaixaMesCalc[], mes: string): GeracaoCaixaMesCalc | null {
  if (serie.length === 0) return null;
  const ordenados = [...serie].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  return ordenados.find((p) => p.month === mes) ?? [...ordenados].reverse().find((p) => p.month <= mes) ?? null;
}

/** Ano de planejamento do painel — o modo Evolução (e a coluna YTD) exibem SÓ meses deste ano
   (2026). Fonte única desta janela: reusada por `truncarSerie` em Scorecard.tsx e por `calcYtd`
   abaixo, para que a janela YTD e a janela de colunas mensais NUNCA divirjam. */
export const ANO_MIN_EVOLUCAO = "2026-01";

/**
 * Acumulado do ano (YTD) de uma linha do modo Evolução — janela jan/2026 até `mes` (mesma regra
 * de `truncarSerie` em Scorecard.tsx: `month >= ANO_MIN_EVOLUCAO && month <= mes`), MAS pontos
 * sem `month` são descartados aqui (diferente de `truncarSerie`, que os mantém como fallback para
 * séries antigas sem essa info — sem `month` não há como saber se o ponto pertence ao ano YTD).
 *
 * Resolve o modo de acumulação: `ytdAgg` explícito da linha vence; senão o default depende do
 * `formato` — "pct" acumula por MÉDIA (ex: churn % do ano não é a soma dos churns mensais),
 * qualquer outro formato acumula por SOMA (fluxo: nova receita, churn R$, entregas etc.).
 * "ultimo" (uso explícito, nunca default) pega o valor do ponto mais recente da janela — para
 * linhas de ESTOQUE/saldo (MRR ativo, LTV médio, estoque pontual), onde somar os meses não faz
 * sentido.
 *
 * Pontos com `valor` null/undefined são ignorados em qualquer modo. Janela vazia (sem pontos
 * dentro do ano corrente até `mes`, ou nenhum ponto com `valor` válido) → null (UI mostra "—").
 */
export function calcYtd(
  serie: ScorecardSeriePonto[] | undefined,
  mes: string,
  ytdAgg?: "soma" | "ultimo" | "media",
  formato?: ScorecardFormato,
): number | null {
  if (!serie) return null;

  const janela = serie.filter((p) => p.month && p.month >= ANO_MIN_EVOLUCAO && p.month <= mes);
  if (janela.length === 0) return null;

  const validos = janela.filter((p) => p.valor !== null && p.valor !== undefined) as { month?: string; valor: number }[];
  if (validos.length === 0) return null;

  const modo = ytdAgg ?? (formato === "pct" ? "media" : "soma");

  if (modo === "ultimo") {
    const ordenados = [...validos].sort((a, b) => (a.month! < b.month! ? -1 : a.month! > b.month! ? 1 : 0));
    return ordenados[ordenados.length - 1].valor;
  }

  const soma = validos.reduce((acc, p) => acc + p.valor, 0);
  return modo === "media" ? soma / validos.length : soma;
}

/** Formata um valor numérico conforme o formato do scorecard. null/undefined/NaN → "—". */
export function formatValor(v: number | null | undefined, formato: ScorecardFormato): string {
  if (v === null || v === undefined || isNaN(v)) return "—";

  switch (formato) {
    case "brl":
      return formatCurrencyNoDecimals(v);
    case "pct":
      return formatPercent(v, 1);
    case "int":
      return new Intl.NumberFormat("pt-BR").format(Math.round(v));
    case "meses":
      return `${formatDecimal(v, 1)} meses`;
    default:
      return String(v);
  }
}
