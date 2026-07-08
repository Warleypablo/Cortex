// ===========================================================================
// Orçado × Realizado — Aprofundado: FONTE ÚNICA de verdade (pura, sem React)
// ===========================================================================
// Este módulo é a ÚNICA implementação das linhas do Aprofundado por funil × canal.
// Consumido por DOIS lados que antes duplicavam a lógica e divergiam:
//   1) A UI (client/src/pages/GrowthOrcadoRealizado.tsx) — a tela.
//   2) O FCA (server/routes/fca.ts) — a imagem/relatório.
// Regra de ouro: qualquer número que o FCA mostra tem que ser IDÊNTICO ao da tela
// POR CONSTRUÇÃO — porque ambos chamam exatamente estes builders com os mesmos
// payloads (mesmos endpoints /orcado-realizado/*). Não recalcule métricas fora daqui.
//
// Framework-free de propósito: nada de React/hooks. Orçado entra como PARÂMETRO
// explícito (na UI vinha de closure ORCADO_*; aqui é argumento) pra rodar no server.

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type MetricType = 'manual' | 'formula';

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  orcado: number | string | null;
  realizado: number | string | null;
  realizadoAnterior?: number | null;
  percentual: number | null;
  format: 'currency' | 'number' | 'percent';
  isHeader?: boolean;
  indent?: number;
  emoji?: string;
  // Aviso de qualidade do dado (ex: pixel do Meta sub-capturando). Quando presente,
  // a linha mostra um ⚠️ com este texto em tooltip.
  warning?: string;
}

export interface MetaAdsDetailMetrics {
  investimento: number; impressoes: number; alcance: number; frequencia: number;
  cpm: number; ctr: number; ctrUnico?: number; videoHook: number; videoHold: number;
  videoP75: number; videoP100: number; visualizacoesPagina: number;
  sessoes: number;
  // Base pixel Meta (landing_page_views) — usada em Connect Rate e Tx Conversão da Página,
  // que devem ser calculadas a partir do Meta Ads, não do GA4.
  connectRatePixel?: number; visualizacoesPaginaPixel?: number;
}

export interface GoogleAdsDetailMetrics {
  investimento: number; impressoes: number; cliques: number;
  cpm: number; cpc: number; ctr: number;
  visualizacoesPagina: number; connectRate: number;
  conversoes: number; valorConversoes: number; custoConversao: number;
  sessoes: number;
}

export interface TiktokAdsDetailMetrics {
  investimento: number; impressoes: number; cliques: number; conversoes: number;
  cpm: number; ctr: number;
  visualizacoesPagina: number; sessoes: number; connectRate: number;
  hasConnection: boolean;
}

export interface PlatformFunnelData {
  leads: number; mqls: number; cpl: number | null; cpmql: number | null; percMqls: number;
  ra: number; raMql: number; raNmql: number;
  rr: number; rrMql: number; rrNmql: number;
  percRa: number; percRaMql: number; percRaNmql: number;
  percRr: number; percRrMql: number; percRrNmql: number;
  percRrVendas: number; percRrMqlVendas: number; percRrNmqlVendas: number;
  negocioGanho: number; leadTime: number | null; aov: number | null;
  receita: number | null; receitaPontual: number | null; receitaRecorrente: number | null;
  cac: number | null; cacUnico: number | null; cacContrato: number | null;
  clientesUnicos: number; contratos: number;
}

export interface MQLMetrics {
  totalMqls: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  novosClientes: number;
  contratosAceleracao: number;
  contratosImplantacao: number;
  faturamentoAceleracao: number;
  faturamentoImplantacao: number;
  faturamentoAceleracaoTrafego: number;
  faturamentoImplantacaoTrafego: number;
  percReuniaoAgendada: number;
  percNoShow: number;
  taxaVendas: number;
  txContratosRecorrentes: number;
  txContratosImplantacao: number;
  ticketMedioAceleracao: number;
  ticketMedioImplantacao: number;
  dealsGanhos: number;
  contratosGanhos: number;
}

export interface NaoMQLMetrics {
  totalNaoMqls: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  novosClientes: number;
  contratosAceleracao: number;
  contratosImplantacao: number;
  faturamentoAceleracao: number;
  faturamentoImplantacao: number;
  faturamentoAceleracaoTrafego: number;
  faturamentoImplantacaoTrafego: number;
  percReuniaoAgendada: number;
  percNoShow: number;
  taxaVendas: number;
  txContratosRecorrentes: number;
  txContratosImplantacao: number;
  ticketMedioAceleracao: number;
  ticketMedioImplantacao: number;
  dealsGanhos: number;
  contratosGanhos: number;
}

// Orçado por canal (superset — cada builder lê os campos que usa).
export type OrcadoAds = Record<string, number | null | undefined>;
export type OrcadoMql = typeof DEFAULT_ORCADO_MQL & Record<string, number | null | undefined>;
export type OrcadoNaoMql = typeof DEFAULT_ORCADO_NAO_MQL & Record<string, number | null | undefined>;

// ---------------------------------------------------------------------------
// Defaults de orçado (fallback quando não há dados no banco). Mantidos idênticos
// aos de GrowthOrcadoRealizado.tsx — a UI faz {...DEFAULT, ...budgets[segmento]}.
// ---------------------------------------------------------------------------
export const DEFAULT_ORCADO_MQL = {
  percReuniaoAgendada: 0.30,
  reunioesAgendadas: 69,
  reunioesRealizadas: 65,
  percNoShow: 0.05,
  taxaVendas: 0.30,
  novosClientes: 19,
  txContratosRecorrentes: 0.60,
  txContratosImplantacao: 0.45,
  contratosAceleracao: 11,
  ticketMedioAceleracao: 4000,
  faturamentoAceleracao: 44641,
  contratosImplantacao: 8,
  ticketMedioImplantacao: 8500,
  faturamentoImplantacao: 71147,
};

export const DEFAULT_ORCADO_NAO_MQL = {
  percReuniaoAgendada: 0.14,
  reunioesAgendadas: 152,
  reunioesRealizadas: 144,
  percNoShow: 0.05,
  taxaVendas: 0.25,
  novosClientes: 34,
  txContratosRecorrentes: 0.65,
  txContratosImplantacao: 0.45,
  contratosAceleracao: 22,
  ticketMedioAceleracao: 4000,
  faturamentoAceleracao: 89193.34,
  contratosImplantacao: 15,
  ticketMedioImplantacao: 8500,
  faturamentoImplantacao: 131217.12,
};

export const DEFAULT_ORCADO_META_ADS = {
  investimento: 0, cpm: 0, ctr: 0, videoHook: 0, videoHold: 0, videoP75: 0, videoP100: 0,
  visualizacoesPagina: 0, sessoes: 0, taxaConversaoPagina: 0, connectRate: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

export const DEFAULT_ORCADO_GOOGLE_ADS = {
  investimento: 0, cpm: 0, ctr: 0,
  visualizacoesPagina: 0, sessoes: 0, taxaConversaoPagina: 0, connectRate: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

export const DEFAULT_ORCADO_TIKTOK_ADS = {
  investimento: 0, cpm: 0, ctr: 0, impressoes: 0, cliques: 0,
  visualizacoesPagina: 0, sessoes: 0, taxaConversaoPagina: 0, connectRate: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function calcPercentual(orcado: number | null, realizado: number | null): number | null {
  if (orcado === null || realizado === null || orcado === 0) return null;
  return (realizado / orcado) * 100;
}

export function mergePrevRealizado(cur: Metric[], prev: Metric[]): Metric[] {
  const prevMap = new Map<string, number | null>();
  for (const m of prev) {
    prevMap.set(m.id, typeof m.realizado === 'number' ? m.realizado : null);
  }
  return cur.map(m => ({
    ...m,
    realizadoAnterior: prevMap.has(m.id) ? prevMap.get(m.id)! : null,
  }));
}

// ---------------------------------------------------------------------------
// Adapter FCA: classifica cada Metric nas colunas extras da imagem (kind/inv).
// ---------------------------------------------------------------------------
// A imagem do FCA (server/fca/aprofundadoImage.ts) precisa de `kind` (abs prorrateia,
// rate/pct não) e `inv` (menor é melhor) além do orçado/realizado. São traços de
// APRESENTAÇÃO — o dado (r/o) vem 100% dos builders acima. Classificação derivada
// do format + id, então nunca diverge linha a linha.
//   - abs  → absolutos (Investimento, Visualizações, Sessões, Leads, MQLs) e valores
//            de faturamento/negócios.
//   - rate → custos por unidade (CPM/CPL/CPMQL/CPRA/CPRR/CAC/Ticket).
//   - pct  → taxas e percentuais.
//   - inv  → custos e No-show (menor é melhor).
const RATE_ID = /(cpm|cpl|cpmql|cpra|cprr|cac|ticket)/i;
const INV_ID = /(cpm|cpl|cpmql|cpra|cprr|cac|noshow|no_show)/i;
export function fcaKindInv(m: Metric): { kind: 'abs' | 'rate' | 'pct'; inv: boolean } {
  const inv = INV_ID.test(m.id);
  if (m.format === 'percent') return { kind: 'pct', inv };
  if (m.format === 'currency' && RATE_ID.test(m.id)) return { kind: 'rate', inv };
  // currency de faturamento/investimento e todos os 'number' → absolutos.
  return { kind: 'abs', inv };
}

// ---------------------------------------------------------------------------
// Builders — funil (Leads/MQLs/CPL/CPMQL/%MQLs)
// ---------------------------------------------------------------------------
// Leads/MQLs vêm do funnel-by-platform (mesma fonte da tela). CPL/CPMQL derivam
// do investimento (só faz sentido em canais pagos). CPRA/CPRR e splits ficam nas
// seções de vendas (MQL/Não-MQL/Total), não aqui.
export function buildFunnelMetrics(
  prefix: string,
  funnel: PlatformFunnelData | undefined,
  orcado: OrcadoAds,
  investimento: number | null,
  includeInvestimento = false,
): Metric[] {
  const f = funnel || {} as PlatformFunnelData;
  const invest = investimento !== null && investimento > 0 ? investimento : 0;
  const cpl = invest > 0 && (f.leads || 0) > 0 ? invest / f.leads : null;
  const cpmql = invest > 0 && (f.mqls || 0) > 0 ? invest / f.mqls : null;
  const investimentoRow: Metric[] = includeInvestimento ? [
    { id: `${prefix}_investimento`, name: 'Investimento', type: 'manual', orcado: (orcado.investimento ?? null) as any, realizado: investimento ?? 0, percentual: calcPercentual((orcado.investimento ?? null) as any, investimento), format: 'currency' },
  ] : [];
  return [
    ...investimentoRow,
    { id: `${prefix}_leads`, name: 'Leads', type: 'formula', orcado: (orcado.leads ?? null) as any, realizado: f.leads ?? 0, percentual: calcPercentual((orcado.leads ?? null) as any, f.leads), format: 'number' },
    { id: `${prefix}_mqls`, name: 'MQLs', type: 'formula', orcado: (orcado.mqls ?? null) as any, realizado: f.mqls ?? 0, percentual: calcPercentual((orcado.mqls ?? null) as any, f.mqls), format: 'number' },
    { id: `${prefix}_cpl`, name: 'CPL', type: 'formula', orcado: (orcado.cpl ?? null) as any, realizado: cpl, percentual: calcPercentual((orcado.cpl ?? null) as any, cpl), format: 'currency' },
    { id: `${prefix}_cpmql`, name: 'CPMQL', type: 'formula', orcado: (orcado.cpmql ?? null) as any, realizado: cpmql, percentual: calcPercentual((orcado.cpmql ?? null) as any, cpmql), format: 'currency' },
    { id: `${prefix}_percMqls`, name: '% MQLs', type: 'formula', orcado: (orcado.percMqls ?? null) as any, realizado: f.percMqls ?? null, percentual: calcPercentual((orcado.percMqls ?? null) as any, f.percMqls), format: 'percent' },
  ];
}

// ---------------------------------------------------------------------------
// Builder — Meta Ads (pixel Meta: Connect Rate e Tx Conversão por Visualização)
// ---------------------------------------------------------------------------
export function buildMetaAdsMetrics(
  d: MetaAdsDetailMetrics,
  funnel: PlatformFunnelData | undefined,
  orcado: OrcadoAds,
): Metric[] {
  const O = orcado;
  // Connect Rate e Tx Conversão da Página calculadas a partir do Meta Ads (pixel),
  // não do GA4: Connect Rate = landing_page_views ÷ cliques de saída (connectRatePixel),
  // Tx Conversão = Leads ÷ landing_page_views (pixel).
  const lpvPixel = d.visualizacoesPaginaPixel ?? 0;
  const taxaConversaoPagina = lpvPixel > 0 ? ((funnel?.leads ?? 0) / lpvPixel) : 0;
  const sessoes = d.sessoes ?? 0;
  const taxaConversaoPaginaSessoes = sessoes > 0 ? ((funnel?.leads ?? 0) / sessoes) : 0;
  // Saúde do pixel: o landing_page_views do Meta deveria acompanhar as Sessões do GA4
  // (~67% na conta toda). Muito abaixo disso com volume relevante = pixel sub-capturando.
  const pixelHealthRatio = sessoes > 0 ? lpvPixel / sessoes : null;
  const pixelSubcaptura = sessoes >= 30 && pixelHealthRatio !== null && pixelHealthRatio < 0.4;
  const pixelWarning = pixelSubcaptura
    ? `Pixel do Meta sub-capturando: registrou ${lpvPixel} visualizações de página, mas o GA4 viu ${sessoes} sessões (${Math.round((pixelHealthRatio ?? 0) * 100)}% — o normal na conta é ~67%). Connect Rate e Tx Conversão por Visualização de Página estão subestimados; provável problema de instalação/tagueamento do pixel nessas campanhas.`
    : undefined;
  const topMetrics: Metric[] = [
    { id: 'meta_investimento', name: 'Investimento', type: 'manual', orcado: (O.investimento ?? null) as any, realizado: d.investimento ?? 0, percentual: calcPercentual((O.investimento ?? null) as any, d.investimento), format: 'currency' },
    { id: 'meta_cpm', name: 'CPM', type: 'formula', orcado: (O.cpm ?? null) as any, realizado: d.cpm ?? null, percentual: calcPercentual((O.cpm ?? null) as any, d.cpm), format: 'currency' },
    { id: 'meta_ctr', name: 'CTR de saída', type: 'manual', orcado: (O.ctr ?? null) as any, realizado: d.ctr ?? null, percentual: calcPercentual((O.ctr ?? null) as any, d.ctr), format: 'percent' },
    { id: 'meta_ctrUnico', name: 'CTR de saída único', type: 'formula', orcado: null, realizado: d.ctrUnico ?? null, percentual: null, format: 'percent' },
    { id: 'meta_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: (O.visualizacoesPagina ?? null) as any, realizado: lpvPixel, percentual: calcPercentual((O.visualizacoesPagina ?? null) as any, lpvPixel), format: 'number', warning: pixelWarning },
    { id: 'meta_sessoes', name: 'Sessões', type: 'formula', orcado: (O.sessoes ?? null) as any, realizado: d.sessoes ?? 0, percentual: calcPercentual((O.sessoes ?? null) as any, d.sessoes), format: 'number' },
    { id: 'meta_connectRate', name: 'Connect Rate', type: 'formula', orcado: (O.connectRate ?? null) as any, realizado: d.connectRatePixel ?? 0, percentual: calcPercentual((O.connectRate ?? null) as any, d.connectRatePixel ?? null), format: 'percent', warning: pixelWarning },
    { id: 'meta_taxaConversaoPagina', name: 'Tx Conversão da Página - Visualização de Página', type: 'formula', orcado: (O.taxaConversaoPagina ?? null) as any, realizado: taxaConversaoPagina, percentual: calcPercentual((O.taxaConversaoPagina ?? null) as any, taxaConversaoPagina), format: 'percent', warning: pixelWarning },
    { id: 'meta_taxaConversaoPagina_mql', name: 'MQL', type: 'formula', indent: 1, orcado: null, realizado: lpvPixel > 0 ? (funnel?.mqls ?? 0) / lpvPixel : 0, percentual: null, format: 'percent' },
    { id: 'meta_taxaConversaoPagina_nmql', name: 'Não-MQL', type: 'formula', indent: 1, orcado: null, realizado: lpvPixel > 0 ? ((funnel?.leads ?? 0) - (funnel?.mqls ?? 0)) / lpvPixel : 0, percentual: null, format: 'percent' },
    { id: 'meta_taxaConversaoPaginaSessoes', name: 'Tx Conversão da Página - Sessões', type: 'formula', orcado: null, realizado: taxaConversaoPaginaSessoes, percentual: null, format: 'percent' },
    { id: 'meta_taxaConversaoPaginaSessoes_mql', name: 'MQL', type: 'formula', indent: 1, orcado: null, realizado: sessoes > 0 ? (funnel?.mqls ?? 0) / sessoes : 0, percentual: null, format: 'percent' },
    { id: 'meta_taxaConversaoPaginaSessoes_nmql', name: 'Não-MQL', type: 'formula', indent: 1, orcado: null, realizado: sessoes > 0 ? ((funnel?.leads ?? 0) - (funnel?.mqls ?? 0)) / sessoes : 0, percentual: null, format: 'percent' },
  ];
  return [...topMetrics, ...buildFunnelMetrics('meta', funnel, O, d.investimento ?? null)];
}

// ---------------------------------------------------------------------------
// Builder — Google Ads (sem pixel; Tx Conversão por Sessões)
// ---------------------------------------------------------------------------
export function buildGoogleAdsMetrics(
  d: GoogleAdsDetailMetrics,
  funnel: PlatformFunnelData | undefined,
  orcado: OrcadoAds,
): Metric[] {
  const O = orcado;
  const taxaConversaoPagina = (d.sessoes ?? 0) > 0
    ? ((funnel?.leads ?? 0) / (d.sessoes ?? 1)) : 0;
  const topMetrics: Metric[] = [
    { id: 'gads_investimento', name: 'Investimento', type: 'manual', orcado: (O.investimento ?? null) as any, realizado: d.investimento ?? 0, percentual: calcPercentual((O.investimento ?? null) as any, d.investimento), format: 'currency' },
    { id: 'gads_cpm', name: 'CPM', type: 'formula', orcado: (O.cpm ?? null) as any, realizado: d.cpm ?? null, percentual: calcPercentual((O.cpm ?? null) as any, d.cpm), format: 'currency' },
    { id: 'gads_ctr', name: 'CTR de saída', type: 'manual', orcado: (O.ctr ?? null) as any, realizado: d.ctr ?? null, percentual: calcPercentual((O.ctr ?? null) as any, d.ctr), format: 'percent' },
    { id: 'gads_ctrUnico', name: 'CTR de saída único', type: 'formula', orcado: null, realizado: null, percentual: null, format: 'percent' },
    { id: 'gads_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: (O.visualizacoesPagina ?? null) as any, realizado: d.visualizacoesPagina ?? 0, percentual: calcPercentual((O.visualizacoesPagina ?? null) as any, d.visualizacoesPagina), format: 'number' },
    { id: 'gads_sessoes', name: 'Sessões', type: 'formula', orcado: (O.sessoes ?? null) as any, realizado: d.sessoes ?? 0, percentual: calcPercentual((O.sessoes ?? null) as any, d.sessoes), format: 'number' },
    { id: 'gads_taxaConversaoPagina', name: 'Tx Conversão da Página - Sessões', type: 'formula', orcado: (O.taxaConversaoPagina ?? null) as any, realizado: taxaConversaoPagina, percentual: calcPercentual((O.taxaConversaoPagina ?? null) as any, taxaConversaoPagina), format: 'percent' },
  ];
  return [...topMetrics, ...buildFunnelMetrics('gads', funnel, O, d.investimento ?? null)];
}

// ---------------------------------------------------------------------------
// Builder — TikTok Ads (Connect Rate nativo do TikTok; Tx Conversão por Sessões)
// ---------------------------------------------------------------------------
export function buildTiktokAdsMetrics(
  d: TiktokAdsDetailMetrics,
  funnel: PlatformFunnelData | undefined,
  orcado: OrcadoAds,
): Metric[] {
  const O = orcado;
  const taxaConversaoPagina = (d.sessoes ?? 0) > 0
    ? ((funnel?.leads ?? 0) / (d.sessoes ?? 1)) : 0;
  const topMetrics: Metric[] = [
    { id: 'tta_investimento', name: 'Investimento', type: 'manual', orcado: (O.investimento ?? null) as any, realizado: d.investimento ?? 0, percentual: calcPercentual((O.investimento ?? null) as any, d.investimento), format: 'currency' },
    { id: 'tta_cpm', name: 'CPM', type: 'formula', orcado: (O.cpm ?? null) as any, realizado: d.cpm ?? null, percentual: calcPercentual((O.cpm ?? null) as any, d.cpm), format: 'currency' },
    { id: 'tta_ctr', name: 'CTR de saída', type: 'formula', orcado: (O.ctr ?? null) as any, realizado: d.ctr ?? null, percentual: calcPercentual((O.ctr ?? null) as any, d.ctr), format: 'percent' },
    { id: 'tta_ctrUnico', name: 'CTR de saída único', type: 'formula', orcado: null, realizado: null, percentual: null, format: 'percent' },
    { id: 'tta_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: (O.visualizacoesPagina ?? null) as any, realizado: d.visualizacoesPagina ?? 0, percentual: calcPercentual((O.visualizacoesPagina ?? null) as any, d.visualizacoesPagina), format: 'number' },
    { id: 'tta_sessoes', name: 'Sessões', type: 'formula', orcado: (O.sessoes ?? null) as any, realizado: d.sessoes ?? 0, percentual: calcPercentual((O.sessoes ?? null) as any, d.sessoes), format: 'number' },
    { id: 'tta_connectRate', name: 'Connect Rate', type: 'formula', orcado: (O.connectRate ?? null) as any, realizado: d.connectRate ?? 0, percentual: calcPercentual((O.connectRate ?? null) as any, d.connectRate ?? null), format: 'percent' },
    { id: 'tta_taxaConversaoPagina', name: 'Tx Conversão da Página - Sessões', type: 'formula', orcado: (O.taxaConversaoPagina ?? null) as any, realizado: taxaConversaoPagina, percentual: calcPercentual((O.taxaConversaoPagina ?? null) as any, taxaConversaoPagina), format: 'percent' },
  ];
  return [...topMetrics, ...buildFunnelMetrics('tta', funnel, O, d.investimento ?? null)];
}

// ---------------------------------------------------------------------------
// Builder — Pré-vendas MQL
// ---------------------------------------------------------------------------
export function buildMqlMetrics(
  data: MQLMetrics,
  orcado: OrcadoMql,
  investimento: number | null = null,
): Metric[] {
  const ORCADO_MQL = orcado;
  const invest = investimento ?? 0;
  const raCount = data.reunioesAgendadas ?? 0;
  const rrCount = data.reunioesRealizadas ?? 0;
  const cpraMql = invest > 0 && raCount > 0 ? invest / raCount : null;
  const cprrMql = invest > 0 && rrCount > 0 ? invest / rrCount : null;
  return [
    { id: 'mql_ra_perc', name: '%RA MQL', type: 'manual', orcado: ORCADO_MQL.percReuniaoAgendada, realizado: data.percReuniaoAgendada ?? null, percentual: calcPercentual(ORCADO_MQL.percReuniaoAgendada, data.percReuniaoAgendada), format: 'percent' },
    { id: 'mql_ra_num', name: 'Nº RA MQL', type: 'formula', orcado: ORCADO_MQL.reunioesAgendadas, realizado: data.reunioesAgendadas ?? 0, percentual: calcPercentual(ORCADO_MQL.reunioesAgendadas, data.reunioesAgendadas), format: 'number' },
    { id: 'mql_cpra', name: 'CPRA MQL', type: 'formula', orcado: (ORCADO_MQL as any).cpraMql ?? null, realizado: cpraMql, percentual: calcPercentual((ORCADO_MQL as any).cpraMql ?? null, cpraMql), format: 'currency' },
    { id: 'mql_rr_num', name: 'Nº RR MQL', type: 'formula', orcado: ORCADO_MQL.reunioesRealizadas, realizado: data.reunioesRealizadas ?? 0, percentual: calcPercentual(ORCADO_MQL.reunioesRealizadas, data.reunioesRealizadas), format: 'number' },
    { id: 'mql_cprr', name: 'CPRR MQL', type: 'formula', orcado: (ORCADO_MQL as any).cprrMql ?? null, realizado: cprrMql, percentual: calcPercentual((ORCADO_MQL as any).cprrMql ?? null, cprrMql), format: 'currency' },
    { id: 'mql_noshow', name: '% No-show', type: 'manual', orcado: ORCADO_MQL.percNoShow, realizado: data.percNoShow ?? null, percentual: calcPercentual(ORCADO_MQL.percNoShow, data.percNoShow), format: 'percent' },
    { id: 'mql_rr_perc', name: '%RR MQL', type: 'formula', orcado: (ORCADO_MQL as any).percRr ?? null, realizado: data.totalMqls > 0 ? data.reunioesRealizadas / data.totalMqls : null, percentual: calcPercentual((ORCADO_MQL as any).percRr ?? null, data.totalMqls > 0 ? data.reunioesRealizadas / data.totalMqls : null), format: 'percent' },
    { id: 'mql_taxa_vendas', name: 'RR→V% MQL', type: 'manual', orcado: ORCADO_MQL.taxaVendas, realizado: data.taxaVendas ?? null, percentual: calcPercentual(ORCADO_MQL.taxaVendas, data.taxaVendas), format: 'percent' },
    { id: 'mql_novos_clientes', name: 'Negócios Ganhos MQL', type: 'formula', orcado: ORCADO_MQL.novosClientes, realizado: data.dealsGanhos ?? 0, percentual: calcPercentual(ORCADO_MQL.novosClientes, data.dealsGanhos), format: 'number' },
    { id: 'mql_contratos_ganhos', name: 'Contratos Ganhos MQL', type: 'formula', orcado: null, realizado: data.contratosGanhos ?? 0, percentual: null, format: 'number' },
    { id: 'mql_tx_recorrente', name: 'Tx de Contratos Recorrentes', type: 'manual', orcado: ORCADO_MQL.txContratosRecorrentes, realizado: data.txContratosRecorrentes ?? null, percentual: calcPercentual(ORCADO_MQL.txContratosRecorrentes, data.txContratosRecorrentes), format: 'percent' },
    { id: 'mql_tx_implantacao', name: 'Tx de Contratos Implantação', type: 'manual', orcado: ORCADO_MQL.txContratosImplantacao, realizado: data.txContratosImplantacao ?? null, percentual: calcPercentual(ORCADO_MQL.txContratosImplantacao, data.txContratosImplantacao), format: 'percent' },
    { id: 'mql_contratos_acel', name: 'Nº Novos Contratos Aceleração MQL', type: 'formula', orcado: ORCADO_MQL.contratosAceleracao, realizado: data.contratosAceleracao ?? 0, percentual: calcPercentual(ORCADO_MQL.contratosAceleracao, data.contratosAceleracao), format: 'number', emoji: '🏎️' },
    { id: 'mql_ticket_acel', name: 'Ticket Médio Aceleração MQL', type: 'manual', orcado: ORCADO_MQL.ticketMedioAceleracao, realizado: data.ticketMedioAceleracao ?? null, percentual: calcPercentual(ORCADO_MQL.ticketMedioAceleracao, data.ticketMedioAceleracao), format: 'currency', emoji: '🏎️' },
    { id: 'mql_fat_acel', name: 'Faturamento Aceleração (MRR novo) de MQL', type: 'formula', orcado: ORCADO_MQL.faturamentoAceleracao, realizado: data.faturamentoAceleracao ?? 0, percentual: calcPercentual(ORCADO_MQL.faturamentoAceleracao, data.faturamentoAceleracao), format: 'currency', emoji: '🏎️' },
    { id: 'mql_contratos_impl', name: 'Nº Novos Contratos Implantação MQL', type: 'formula', orcado: ORCADO_MQL.contratosImplantacao, realizado: data.contratosImplantacao ?? 0, percentual: calcPercentual(ORCADO_MQL.contratosImplantacao, data.contratosImplantacao), format: 'number', emoji: '🔧' },
    { id: 'mql_ticket_impl', name: 'Ticket Médio Implantação MQL', type: 'manual', orcado: ORCADO_MQL.ticketMedioImplantacao, realizado: data.ticketMedioImplantacao ?? null, percentual: calcPercentual(ORCADO_MQL.ticketMedioImplantacao, data.ticketMedioImplantacao), format: 'currency', emoji: '🔧' },
    { id: 'mql_fat_impl', name: 'Faturamento Implantação MQL', type: 'formula', orcado: ORCADO_MQL.faturamentoImplantacao, realizado: data.faturamentoImplantacao ?? 0, percentual: calcPercentual(ORCADO_MQL.faturamentoImplantacao, data.faturamentoImplantacao), format: 'currency', emoji: '🔧' },
    { id: 'mql_fat_total', name: 'Faturamento Total MQL', type: 'formula', orcado: ORCADO_MQL.faturamentoAceleracao + ORCADO_MQL.faturamentoImplantacao, realizado: (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0), percentual: calcPercentual(ORCADO_MQL.faturamentoAceleracao + ORCADO_MQL.faturamentoImplantacao, (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0)), format: 'currency' },
  ];
}

// ---------------------------------------------------------------------------
// Builder — Pré-vendas Não-MQL
// ---------------------------------------------------------------------------
export function buildNaoMqlMetrics(
  data: NaoMQLMetrics,
  orcado: OrcadoNaoMql,
  investimento: number | null = null,
): Metric[] {
  const ORCADO_NAO_MQL = orcado;
  const invest = investimento ?? 0;
  const raCount = data.reunioesAgendadas ?? 0;
  const rrCount = data.reunioesRealizadas ?? 0;
  const cpraNmql = invest > 0 && raCount > 0 ? invest / raCount : null;
  const cprrNmql = invest > 0 && rrCount > 0 ? invest / rrCount : null;
  return [
    { id: 'nmql_ra_perc', name: '%RA não-MQL', type: 'manual', orcado: ORCADO_NAO_MQL.percReuniaoAgendada, realizado: data.percReuniaoAgendada ?? null, percentual: calcPercentual(ORCADO_NAO_MQL.percReuniaoAgendada, data.percReuniaoAgendada), format: 'percent' },
    { id: 'nmql_ra_num', name: 'Nº RA não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.reunioesAgendadas, realizado: data.reunioesAgendadas ?? 0, percentual: calcPercentual(ORCADO_NAO_MQL.reunioesAgendadas, data.reunioesAgendadas), format: 'number' },
    { id: 'nmql_cpra', name: 'CPRA não-MQL', type: 'formula', orcado: (ORCADO_NAO_MQL as any).cpraNmql ?? null, realizado: cpraNmql, percentual: calcPercentual((ORCADO_NAO_MQL as any).cpraNmql ?? null, cpraNmql), format: 'currency' },
    { id: 'nmql_rr_num', name: 'Nº RR não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.reunioesRealizadas, realizado: data.reunioesRealizadas ?? 0, percentual: calcPercentual(ORCADO_NAO_MQL.reunioesRealizadas, data.reunioesRealizadas), format: 'number' },
    { id: 'nmql_cprr', name: 'CPRR não-MQL', type: 'formula', orcado: (ORCADO_NAO_MQL as any).cprrNmql ?? null, realizado: cprrNmql, percentual: calcPercentual((ORCADO_NAO_MQL as any).cprrNmql ?? null, cprrNmql), format: 'currency' },
    { id: 'nmql_noshow', name: '% No-show', type: 'manual', orcado: ORCADO_NAO_MQL.percNoShow, realizado: data.percNoShow ?? null, percentual: calcPercentual(ORCADO_NAO_MQL.percNoShow, data.percNoShow), format: 'percent' },
    { id: 'nmql_rr_perc', name: '%RR não-MQL', type: 'formula', orcado: (ORCADO_NAO_MQL as any).percRr ?? null, realizado: data.totalNaoMqls > 0 ? data.reunioesRealizadas / data.totalNaoMqls : null, percentual: calcPercentual((ORCADO_NAO_MQL as any).percRr ?? null, data.totalNaoMqls > 0 ? data.reunioesRealizadas / data.totalNaoMqls : null), format: 'percent' },
    { id: 'nmql_taxa_vendas', name: 'RR→V% não-MQL', type: 'manual', orcado: ORCADO_NAO_MQL.taxaVendas, realizado: data.taxaVendas ?? null, percentual: calcPercentual(ORCADO_NAO_MQL.taxaVendas, data.taxaVendas), format: 'percent' },
    { id: 'nmql_novos_clientes', name: 'Negócios Ganhos não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.novosClientes, realizado: data.dealsGanhos ?? 0, percentual: calcPercentual(ORCADO_NAO_MQL.novosClientes, data.dealsGanhos), format: 'number' },
    { id: 'nmql_contratos_ganhos', name: 'Contratos Ganhos não-MQL', type: 'formula', orcado: null, realizado: data.contratosGanhos ?? 0, percentual: null, format: 'number' },
    { id: 'nmql_tx_recorrente', name: 'Tx de Contratos Recorrentes', type: 'manual', orcado: ORCADO_NAO_MQL.txContratosRecorrentes, realizado: data.txContratosRecorrentes ?? null, percentual: calcPercentual(ORCADO_NAO_MQL.txContratosRecorrentes, data.txContratosRecorrentes), format: 'percent' },
    { id: 'nmql_tx_implantacao', name: 'Tx de Contratos Implantação', type: 'manual', orcado: ORCADO_NAO_MQL.txContratosImplantacao, realizado: data.txContratosImplantacao ?? null, percentual: calcPercentual(ORCADO_NAO_MQL.txContratosImplantacao, data.txContratosImplantacao), format: 'percent' },
    { id: 'nmql_contratos_acel', name: 'Nº Novos Contratos Aceleração não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.contratosAceleracao, realizado: data.contratosAceleracao ?? 0, percentual: calcPercentual(ORCADO_NAO_MQL.contratosAceleracao, data.contratosAceleracao), format: 'number', emoji: '🏎️' },
    { id: 'nmql_ticket_acel', name: 'Ticket Médio Aceleração não-MQL', type: 'manual', orcado: ORCADO_NAO_MQL.ticketMedioAceleracao, realizado: data.ticketMedioAceleracao ?? null, percentual: calcPercentual(ORCADO_NAO_MQL.ticketMedioAceleracao, data.ticketMedioAceleracao), format: 'currency', emoji: '🏎️' },
    { id: 'nmql_fat_acel', name: 'Faturamento Aceleração (MRR novo) de não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.faturamentoAceleracao, realizado: data.faturamentoAceleracao ?? 0, percentual: calcPercentual(ORCADO_NAO_MQL.faturamentoAceleracao, data.faturamentoAceleracao), format: 'currency', emoji: '🏎️' },
    { id: 'nmql_contratos_impl', name: 'Nº Novos Contratos Implantação não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.contratosImplantacao, realizado: data.contratosImplantacao ?? 0, percentual: calcPercentual(ORCADO_NAO_MQL.contratosImplantacao, data.contratosImplantacao), format: 'number', emoji: '🔧' },
    { id: 'nmql_ticket_impl', name: 'Ticket Médio Implantação não-MQL', type: 'manual', orcado: ORCADO_NAO_MQL.ticketMedioImplantacao, realizado: data.ticketMedioImplantacao ?? null, percentual: calcPercentual(ORCADO_NAO_MQL.ticketMedioImplantacao, data.ticketMedioImplantacao), format: 'currency', emoji: '🔧' },
    { id: 'nmql_fat_impl', name: 'Faturamento Implantação não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.faturamentoImplantacao, realizado: data.faturamentoImplantacao ?? 0, percentual: calcPercentual(ORCADO_NAO_MQL.faturamentoImplantacao, data.faturamentoImplantacao), format: 'currency', emoji: '🔧' },
    { id: 'nmql_fat_total', name: 'Faturamento Total não-MQL', type: 'formula', orcado: ORCADO_NAO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoImplantacao, realizado: (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0), percentual: calcPercentual(ORCADO_NAO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoImplantacao, (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0)), format: 'currency' },
  ];
}
