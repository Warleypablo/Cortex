/**
 * Constantes e utilitários compartilhados entre Gestão de Metas, Planejamento de Metas e Criativos.
 * Centraliza: mapeamento de métricas ↔ budgets, defaults, tipos e funções de cálculo.
 */

// ===== Types =====

export type MetricType = 'manual' | 'formula';

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  orcado: number | string | null;
  realizado: number | string | null;
  percentual: number | null;
  format: 'currency' | 'number' | 'percent';
  isHeader?: boolean;
  indent?: number;
  emoji?: string;
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
}

export interface AdsMetrics {
  investimento: number;
  impressoes: number;
  cliques: number;
  cpm: number;
  ctr: number;
  videoHook: number;
  videoHold: number;
  connectRate: number;
  visualizacoesPagina: number;
  leads: number;
  mqls: number;
  cpl: number;
  cpmql: number;
  percMqls: number;
}

// ===== Utility Functions =====

export function formatValue(value: number | string | null, fmt: 'currency' | 'number' | 'percent'): string {
  if (value === null || value === '') return '-';
  if (typeof value === 'string') return value;

  switch (fmt) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    case 'percent':
      return `${(value * 100).toFixed(2)}%`;
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(value);
    default:
      return String(value);
  }
}

export function getVarianceColor(percentual: number | null): string {
  if (percentual === null) return '';
  if (percentual >= 100) return 'text-green-500';
  if (percentual >= 80) return 'text-yellow-500';
  return 'text-red-500';
}

export function calcPercentual(orcado: number | null, realizado: number | null): number | null {
  if (orcado === null || realizado === null || orcado === 0) return null;
  return (realizado / orcado) * 100;
}

export function calcDesvioMeta(orcado: number | null, realizado: number | null, propDias: number): number | null {
  if (orcado === null || realizado === null || orcado === 0 || propDias === 0) return null;
  const esperado = orcado * propDias;
  return ((realizado - esperado) / esperado) * 100;
}

export function calcPrevisaoAsIs(realizado: number | null, propDias: number): number | null {
  if (realizado === null || propDias === 0) return null;
  return realizado / propDias;
}

export function calcRecalculoMeta(orcado: number | null, realizado: number | null, diasRestantes: number, totalDias: number): number | null {
  if (orcado === null || realizado === null || diasRestantes <= 0 || totalDias === 0) return null;
  const falta = orcado - realizado;
  if (falta <= 0) return 0;
  return (falta / diasRestantes) * totalDias;
}

// ===== Platform Config =====

export const PLATFORM_OPTIONS = [
  { key: 'todos', label: 'Todas as Plataformas' },
  { key: 'meta_ads', label: 'Meta Ads' },
  { key: 'google_ads', label: 'Google Ads' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
] as const;

export const CANAL_OPTIONS = [
  { key: 'meta_ads', label: 'Meta Ads' },
  { key: 'google_ads', label: 'Google Ads' },
  { key: 'instagram', label: 'Instagram' },
] as const;

export const PLATFORM_MULTISELECT_OPTIONS = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

export const PLATFORM_TO_UTM: Record<string, string> = {
  meta_ads: 'facebook',
  google_ads: 'google',
  instagram: 'instagram',
  youtube: 'youtube',
  linkedin: 'linkedin',
};

// ===== Default Orçado Values =====

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

export const DEFAULT_ORCADO_ADS = {
  investimento: 95500,
  impressoes: 955000,
  ctr: 0.009,
  cliques: 89843,
  cpm: 100,
  videoHook: 0,
  videoHold: 0,
  visualizacoesPagina: 0,
  taxaConversaoPagina: 0,
  connectRate: 0,
  leads: 0,
  mqls: 0,
  cpl: 0,
  cpmql: 0,
  percMqls: 0,
};

export const DEFAULT_ORCADO_META_ADS = {
  investimento: 0, cpm: 0, ctr: 0, videoHook: 0, videoHold: 0, videoP75: 0, videoP100: 0,
  visualizacoesPagina: 0, taxaConversaoPagina: 0, connectRate: 0,
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
  visualizacoesPagina: 0, taxaConversaoPagina: 0, connectRate: 0,
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

export const DEFAULT_ORCADO_INSTAGRAM = {
  comecaramSeguir: 0, deixaramSeguir: 0, percPerdaSeguidores: 0,
  deltaSeguidores: 0, totalSeguidores: 0, percCrescimentoSeguidores: 0,
  visualizacoesTotais: 0, percVisualizacoesOrganicas: 0, visualizacoesOrganicas: 0,
  percVisualizacoesPagas: 0, visualizacoesPagas: 0,
  alcanceTotal: 0, alcanceOrganico: 0, alcancePago: 0,
  frequenciaAlcance: 0, ctrAlcanceVisitas: 0, visitasPerfil: 0,
  percEngajamento: 0, interacoes: 0, ctrAlcanceCliques: 0,
  ctrVisitasCliques: 0, cliquesLinkBio: 0,
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

export const DEFAULT_ORCADO_YOUTUBE = {
  inscritos: 0, crescimentoInscritos: 0, visualizacoes: 0, horasAssistidas: 0,
  ctrImpressoes: 0, retencaoMedia: 0, curtidas: 0, comentarios: 0,
  compartilhamentos: 0, videosPublicados: 0,
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

export const DEFAULT_ORCADO_LINKEDIN = {
  seguidores: 0, crescimentoSeguidores: 0, impressoes: 0, cliquesPost: 0,
  taxaEngajamento: 0, postsPublicados: 0, reacoes: 0, comentarios: 0,
  compartilhamentos: 0,
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

// ===== Metric Budget Map =====
// Maps metric.id → { segment, key } for database persistence

export const METRIC_BUDGET_MAP: Record<string, { segment: string; key: string }> = {
  // MQL
  mql_ra_perc: { segment: 'mql', key: 'percReuniaoAgendada' },
  mql_ra_num: { segment: 'mql', key: 'reunioesAgendadas' },
  mql_rr_num: { segment: 'mql', key: 'reunioesRealizadas' },
  mql_noshow: { segment: 'mql', key: 'percNoShow' },
  mql_taxa_vendas: { segment: 'mql', key: 'taxaVendas' },
  mql_novos_clientes: { segment: 'mql', key: 'novosClientes' },
  mql_tx_recorrente: { segment: 'mql', key: 'txContratosRecorrentes' },
  mql_tx_implantacao: { segment: 'mql', key: 'txContratosImplantacao' },
  mql_contratos_acel: { segment: 'mql', key: 'contratosAceleracao' },
  mql_ticket_acel: { segment: 'mql', key: 'ticketMedioAceleracao' },
  mql_fat_acel: { segment: 'mql', key: 'faturamentoAceleracao' },
  mql_contratos_impl: { segment: 'mql', key: 'contratosImplantacao' },
  mql_ticket_impl: { segment: 'mql', key: 'ticketMedioImplantacao' },
  mql_fat_impl: { segment: 'mql', key: 'faturamentoImplantacao' },
  // Não-MQL
  nmql_ra_perc: { segment: 'nao_mql', key: 'percReuniaoAgendada' },
  nmql_ra_num: { segment: 'nao_mql', key: 'reunioesAgendadas' },
  nmql_rr_num: { segment: 'nao_mql', key: 'reunioesRealizadas' },
  nmql_noshow: { segment: 'nao_mql', key: 'percNoShow' },
  nmql_taxa_vendas: { segment: 'nao_mql', key: 'taxaVendas' },
  nmql_novos_clientes: { segment: 'nao_mql', key: 'novosClientes' },
  nmql_tx_recorrente: { segment: 'nao_mql', key: 'txContratosRecorrentes' },
  nmql_tx_implantacao: { segment: 'nao_mql', key: 'txContratosImplantacao' },
  nmql_contratos_acel: { segment: 'nao_mql', key: 'contratosAceleracao' },
  nmql_ticket_acel: { segment: 'nao_mql', key: 'ticketMedioAceleracao' },
  nmql_fat_acel: { segment: 'nao_mql', key: 'faturamentoAceleracao' },
  nmql_contratos_impl: { segment: 'nao_mql', key: 'contratosImplantacao' },
  nmql_ticket_impl: { segment: 'nao_mql', key: 'ticketMedioImplantacao' },
  nmql_fat_impl: { segment: 'nao_mql', key: 'faturamentoImplantacao' },
  // Ads (consolidated)
  investimento: { segment: 'ads', key: 'investimento' },
  cpm: { segment: 'ads', key: 'cpm' },
  impressoes: { segment: 'ads', key: 'impressoes' },
  ctr: { segment: 'ads', key: 'ctr' },
  video_hook: { segment: 'ads', key: 'videoHook' },
  video_hold: { segment: 'ads', key: 'videoHold' },
  visualizacoes_pagina: { segment: 'ads', key: 'visualizacoesPagina' },
  taxa_conversao_pagina: { segment: 'ads', key: 'taxaConversaoPagina' },
  connect_rate: { segment: 'ads', key: 'connectRate' },
  leads: { segment: 'ads', key: 'leads' },
  mqls: { segment: 'ads', key: 'mqls' },
  cpl: { segment: 'ads', key: 'cpl' },
  cpmql: { segment: 'ads', key: 'cpmql' },
  perc_mqls: { segment: 'ads', key: 'percMqls' },
  // Meta Ads (platform-specific)
  ...Object.fromEntries(['investimento','cpm','ctr','videoHook','videoHold','videoP75','videoP100','visualizacoesPagina','taxaConversaoPagina','connectRate','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`meta_${k}`, { segment: 'meta_ads', key: k }])),
  // Google Ads (platform-specific)
  ...Object.fromEntries(['investimento','cpm','ctr','visualizacoesPagina','taxaConversaoPagina','connectRate','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`gads_${k}`, { segment: 'google_ads', key: k }])),
  // Instagram (platform-specific)
  ...Object.fromEntries(['comecaramSeguir','deixaramSeguir','percPerdaSeguidores','deltaSeguidores','totalSeguidores','percCrescimentoSeguidores','visualizacoesTotais','percVisualizacoesOrganicas','visualizacoesOrganicas','percVisualizacoesPagas','visualizacoesPagas','alcanceTotal','alcanceOrganico','alcancePago','frequenciaAlcance','ctrAlcanceVisitas','visitasPerfil','percEngajamento','interacoes','ctrAlcanceCliques','ctrVisitasCliques','cliquesLinkBio','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`ig_${k}`, { segment: 'instagram', key: k }])),
  // YouTube (platform-specific)
  ...Object.fromEntries(['inscritos','crescimentoInscritos','visualizacoes','horasAssistidas','ctrImpressoes','retencaoMedia','curtidas','comentarios','compartilhamentos','videosPublicados','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`yt_${k}`, { segment: 'youtube', key: k }])),
  // LinkedIn (platform-specific)
  ...Object.fromEntries(['seguidores','crescimentoSeguidores','impressoes','cliquesPost','taxaEngajamento','postsPublicados','reacoes','comentarios','compartilhamentos','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`li_${k}`, { segment: 'linkedin', key: k }])),
};

// ===== Percent Metrics =====
// Metrics stored as decimals (0.15 = 15%) that need *100 for display/editing

export const PERCENT_METRICS = new Set([
  'mql_ra_perc', 'mql_noshow', 'mql_taxa_vendas', 'mql_rr_perc', 'mql_taxa_conversao',
  'nmql_ra_perc', 'nmql_noshow', 'nmql_taxa_vendas', 'nmql_rr_perc', 'nmql_taxa_conversao',
  'ctr', 'perc_mqls',
  // Meta Ads
  'meta_ctr', 'meta_videoHook', 'meta_videoHold', 'meta_videoP75', 'meta_videoP100',
  'meta_taxaConversaoPagina', 'meta_connectRate', 'meta_percMqls',
  'meta_percRa', 'meta_percRaMql', 'meta_percRaNmql', 'meta_percRr', 'meta_percRrMql', 'meta_percRrNmql',
  'meta_percRrVendas', 'meta_percRrMqlVendas', 'meta_percRrNmqlVendas',
  // Google Ads
  'gads_ctr', 'gads_taxaConversaoPagina', 'gads_connectRate', 'gads_percMqls',
  'gads_percRa', 'gads_percRaMql', 'gads_percRaNmql', 'gads_percRr', 'gads_percRrMql', 'gads_percRrNmql',
  'gads_percRrVendas', 'gads_percRrMqlVendas', 'gads_percRrNmqlVendas',
  // Instagram
  'ig_percPerdaSeguidores', 'ig_percCrescimentoSeguidores',
  'ig_percVisualizacoesOrganicas', 'ig_percVisualizacoesPagas',
  'ig_ctrAlcanceVisitas', 'ig_percEngajamento', 'ig_ctrAlcanceCliques', 'ig_ctrVisitasCliques',
  'ig_percMqls', 'ig_percRa', 'ig_percRaMql', 'ig_percRaNmql',
  'ig_percRr', 'ig_percRrMql', 'ig_percRrNmql',
  'ig_percRrVendas', 'ig_percRrMqlVendas', 'ig_percRrNmqlVendas',
  // YouTube
  'yt_ctrImpressoes', 'yt_retencaoMedia', 'yt_percMqls',
  'yt_percRa', 'yt_percRaMql', 'yt_percRaNmql', 'yt_percRr', 'yt_percRrMql', 'yt_percRrNmql',
  'yt_percRrVendas', 'yt_percRrMqlVendas', 'yt_percRrNmqlVendas',
  // LinkedIn
  'li_taxaEngajamento', 'li_percMqls',
  'li_percRa', 'li_percRaMql', 'li_percRaNmql', 'li_percRr', 'li_percRrMql', 'li_percRrNmql',
  'li_percRrVendas', 'li_percRrMqlVendas', 'li_percRrNmqlVendas',
]);

// ===== Yellow Metric IDs (Key metrics for Consolidado view) =====

export const YELLOW_METRIC_IDS = new Set([
  'investimento', 'visualizacoes_pagina', 'taxa_conversao_pagina', 'leads', 'mqls', 'cpl', 'cpmql', 'perc_mqls',
  // MQL
  'mql_ra_perc', 'mql_noshow', 'mql_taxa_vendas', 'mql_novos_clientes', 'mql_ticket_acel', 'mql_ticket_impl',
  // Não-MQL
  'nmql_ra_perc', 'nmql_noshow', 'nmql_taxa_vendas', 'nmql_novos_clientes', 'nmql_ticket_acel', 'nmql_ticket_impl',
  // Total
  'total_perc_ra', 'total_conv_rrv', 'total_novos_clientes', 'total_cac_ads', 'total_ticket_acel', 'total_ticket_impl',
  // Platform-specific key metrics
  ...['meta', 'gads', 'ig', 'yt', 'li'].flatMap(p => [
    `${p}_investimento`, `${p}_visualizacoesPagina`, `${p}_taxaConversaoPagina`,
    `${p}_leads`, `${p}_mqls`, `${p}_cpl`, `${p}_cpmql`, `${p}_percMqls`,
  ]),
  // Instagram-specific key metrics
  'ig_totalSeguidores', 'ig_deltaSeguidores', 'ig_alcanceTotal', 'ig_visualizacoesTotais',
  'ig_percEngajamento', 'ig_interacoes', 'ig_visitasPerfil', 'ig_cliquesLinkBio',
]);

// ===== Segment to Default Map =====
// Helper to get the default orçado object for a given segment

export const SEGMENT_DEFAULTS: Record<string, Record<string, number>> = {
  mql: DEFAULT_ORCADO_MQL,
  nao_mql: DEFAULT_ORCADO_NAO_MQL,
  ads: DEFAULT_ORCADO_ADS,
  meta_ads: DEFAULT_ORCADO_META_ADS,
  google_ads: DEFAULT_ORCADO_GOOGLE_ADS,
  instagram: DEFAULT_ORCADO_INSTAGRAM,
  youtube: DEFAULT_ORCADO_YOUTUBE,
  linkedin: DEFAULT_ORCADO_LINKEDIN,
};

// ===== Metric Display Config for Planejamento =====
// Organizes metrics by section with display names for the spreadsheet view

export interface MetricDisplayConfig {
  id: string;
  name: string;
  format: 'currency' | 'number' | 'percent';
  isSubHeader?: boolean; // When true, renders as a sub-section separator row
  tier?: 1 | 2 | 3; // 1=user fills, 2=auto-calculated, 3=tracking only
}

// ===== Platform Scope =====
// Determines whether a platform's goals are per-product or company-level
export const PLATFORM_SCOPE: Record<string, 'product' | 'company'> = {
  meta_ads: 'product',
  google_ads: 'product',
  instagram: 'company',
  youtube: 'company',
  linkedin: 'company',
};

export const SECTION_METRICS: Record<string, { label: string; metrics: MetricDisplayConfig[] }> = {
  inbound: {
    label: 'Inbound',
    metrics: [
      // — Marketing
      { id: '_header_marketing', name: 'Marketing', format: 'number', isSubHeader: true },
      { id: 'investimento', name: 'Investimento', format: 'currency' },
      { id: 'visualizacoes_pagina', name: 'Visualizações de Página', format: 'number' },
      { id: 'taxa_conversao_pagina', name: 'Tx Conversão da Página', format: 'percent' },
      { id: 'connect_rate', name: 'Connect Rate', format: 'percent' },
      { id: 'leads', name: 'Leads', format: 'number' },
      { id: 'mqls', name: 'MQLs', format: 'number' },
      { id: 'cpl', name: 'CPL', format: 'currency' },
      { id: 'cpmql', name: 'CPMQL', format: 'currency' },
      { id: 'perc_mqls', name: '% MQLs', format: 'percent' },
      // — Vendas MQL
      { id: '_header_mql', name: 'Vendas MQL', format: 'number', isSubHeader: true },
      { id: 'mql_ra_perc', name: '%RA MQL', format: 'percent' },
      { id: 'mql_noshow', name: '%No-show MQL', format: 'percent' },
      { id: 'mql_rr_perc', name: '%RR MQL', format: 'percent' },
      { id: 'mql_taxa_vendas', name: 'RR→V% MQL', format: 'percent' },
      { id: 'mql_novos_clientes', name: 'Negócios Ganhos MQL', format: 'number' },
      { id: 'mql_aov', name: 'AOV MQL', format: 'currency' },
      { id: 'mql_ticket_impl', name: 'AOV Pontual MQL', format: 'currency' },
      { id: 'mql_ticket_acel', name: 'AOV Recorrente MQL', format: 'currency' },
      { id: 'mql_faturamento', name: 'Faturamento MQL', format: 'currency' },
      { id: 'mql_fat_impl', name: 'Faturamento Pontual MQL', format: 'currency' },
      { id: 'mql_fat_acel', name: 'Faturamento Recorrente MQL', format: 'currency' },
      { id: 'mql_taxa_conversao', name: 'Taxa de Conversão MQL', format: 'percent' },
      // — Vendas Não-MQL
      { id: '_header_nmql', name: 'Vendas Não-MQL', format: 'number', isSubHeader: true },
      { id: 'nmql_ra_perc', name: '%RA NMQL', format: 'percent' },
      { id: 'nmql_noshow', name: '%No-show NMQL', format: 'percent' },
      { id: 'nmql_rr_perc', name: '%RR NMQL', format: 'percent' },
      { id: 'nmql_taxa_vendas', name: 'RR→V% NMQL', format: 'percent' },
      { id: 'nmql_novos_clientes', name: 'Negócios Ganhos NMQL', format: 'number' },
      { id: 'nmql_aov', name: 'AOV NMQL', format: 'currency' },
      { id: 'nmql_ticket_impl', name: 'AOV Pontual NMQL', format: 'currency' },
      { id: 'nmql_ticket_acel', name: 'AOV Recorrente NMQL', format: 'currency' },
      { id: 'nmql_faturamento', name: 'Faturamento NMQL', format: 'currency' },
      { id: 'nmql_fat_impl', name: 'Faturamento Pontual NMQL', format: 'currency' },
      { id: 'nmql_fat_acel', name: 'Faturamento Recorrente NMQL', format: 'currency' },
      { id: 'nmql_taxa_conversao', name: 'Taxa de Conversão NMQL', format: 'percent' },
    ],
  },
  meta_ads: {
    label: 'Meta Ads',
    metrics: [
      // Ordem do funil: Invest → CPM → Impressões → CTR → Cliques → Video → ConnectRate → VizPágina → TxConv → Leads → CPL → MQLs → CPMQL → %MQLs → Funil vendas → Receita → CAC
      { id: 'meta_investimento', name: 'Investimento', format: 'currency', tier: 1 },
      { id: 'meta_cpm', name: 'CPM', format: 'currency', tier: 1 },
      { id: 'meta_ctr', name: 'CTR', format: 'percent', tier: 1 },
      { id: 'meta_videoHook', name: 'Vídeo Hook', format: 'percent', tier: 1 },
      { id: 'meta_videoHold', name: 'Vídeo Hold', format: 'percent', tier: 1 },
      { id: 'meta_connectRate', name: 'Connect Rate', format: 'percent', tier: 1 },
      { id: 'meta_visualizacoesPagina', name: 'Visualizações de Página', format: 'number', tier: 2 },
      { id: 'meta_taxaConversaoPagina', name: 'Tx Conversão da Página', format: 'percent', tier: 1 },
      { id: 'meta_leads', name: 'Leads', format: 'number', tier: 2 },
      { id: 'meta_cpl', name: 'CPL', format: 'currency', tier: 2 },
      { id: 'meta_percMqls', name: '% MQLs', format: 'percent', tier: 1 },
      { id: 'meta_mqls', name: 'MQLs', format: 'number', tier: 2 },
      { id: 'meta_cpmql', name: 'CPMQL', format: 'currency', tier: 2 },
      { id: 'meta_percRa', name: '% RA', format: 'percent', tier: 1 },
      { id: 'meta_percRr', name: '% RR', format: 'percent', tier: 2 },
      { id: 'meta_percRrVendas', name: '% RR→Vendas', format: 'percent', tier: 1 },
      { id: 'meta_negocioGanho', name: 'Negócios Ganhos', format: 'number', tier: 2 },
      { id: 'meta_leadTime', name: 'Lead Time (dias)', format: 'number', tier: 1 },
      { id: 'meta_aov', name: 'AOV', format: 'currency', tier: 1 },
      { id: 'meta_receita', name: 'Receita', format: 'currency', tier: 2 },
      { id: 'meta_cacUnico', name: 'CAC Único', format: 'currency', tier: 2 },
      { id: 'meta_cacContrato', name: 'CAC Contrato', format: 'currency', tier: 2 },
    ],
  },
  google_ads: {
    label: 'Google Ads',
    metrics: [
      // Ordem do funil: Invest → CPM → CTR → ConnectRate → VizPágina → TxConv → Leads → CPL → %MQLs → MQLs → CPMQL → Funil vendas → Receita → CAC
      { id: 'gads_investimento', name: 'Investimento', format: 'currency', tier: 1 },
      { id: 'gads_cpm', name: 'CPM', format: 'currency', tier: 1 },
      { id: 'gads_ctr', name: 'CTR', format: 'percent', tier: 1 },
      { id: 'gads_connectRate', name: 'Connect Rate', format: 'percent', tier: 1 },
      { id: 'gads_visualizacoesPagina', name: 'Visualizações de Página', format: 'number', tier: 2 },
      { id: 'gads_taxaConversaoPagina', name: 'Tx Conversão da Página', format: 'percent', tier: 1 },
      { id: 'gads_leads', name: 'Leads', format: 'number', tier: 2 },
      { id: 'gads_cpl', name: 'CPL', format: 'currency', tier: 2 },
      { id: 'gads_percMqls', name: '% MQLs', format: 'percent', tier: 1 },
      { id: 'gads_mqls', name: 'MQLs', format: 'number', tier: 2 },
      { id: 'gads_cpmql', name: 'CPMQL', format: 'currency', tier: 2 },
      { id: 'gads_percRa', name: '% RA', format: 'percent', tier: 1 },
      { id: 'gads_percRr', name: '% RR', format: 'percent', tier: 2 },
      { id: 'gads_percRrVendas', name: '% RR→Vendas', format: 'percent', tier: 1 },
      { id: 'gads_negocioGanho', name: 'Negócios Ganhos', format: 'number', tier: 2 },
      { id: 'gads_leadTime', name: 'Lead Time (dias)', format: 'number', tier: 1 },
      { id: 'gads_aov', name: 'AOV', format: 'currency', tier: 1 },
      { id: 'gads_receita', name: 'Receita', format: 'currency', tier: 2 },
      { id: 'gads_cacUnico', name: 'CAC Único', format: 'currency', tier: 2 },
      { id: 'gads_cacContrato', name: 'CAC Contrato', format: 'currency', tier: 2 },
    ],
  },
  instagram: {
    label: 'Instagram',
    metrics: [
      // Ordem: Seguidores → Engajamento → Alcance → Visitas → Cliques → Leads → MQLs
      { id: 'ig_totalSeguidores', name: 'Total Seguidores', format: 'number', tier: 1 },
      { id: 'ig_comecaramSeguir', name: 'Começaram a Seguir', format: 'number', tier: 2 },
      { id: 'ig_deixaramSeguir', name: 'Deixaram de Seguir', format: 'number', tier: 3 },
      { id: 'ig_deltaSeguidores', name: 'Delta Seguidores', format: 'number', tier: 2 },
      { id: 'ig_alcanceTotal', name: 'Alcance Total', format: 'number', tier: 3 },
      { id: 'ig_visualizacoesTotais', name: 'Visualizações Totais', format: 'number', tier: 3 },
      { id: 'ig_percEngajamento', name: '% Engajamento', format: 'percent', tier: 1 },
      { id: 'ig_interacoes', name: 'Interações', format: 'number', tier: 2 },
      { id: 'ig_ctrAlcanceVisitas', name: 'CTR Alcance > Visitas', format: 'percent', tier: 1 },
      { id: 'ig_ctrAlcanceCliques', name: 'CTR Alcance > Cliques', format: 'percent', tier: 1 },
      { id: 'ig_ctrVisitasCliques', name: 'CTR Visitas > Cliques', format: 'percent', tier: 1 },
      { id: 'ig_cliquesLinkBio', name: 'Cliques Link Bio', format: 'number', tier: 1 },
      { id: 'ig_leads', name: 'Leads', format: 'number', tier: 1 },
      { id: 'ig_percMqls', name: '% MQLs', format: 'percent', tier: 2 },
      { id: 'ig_mqls', name: 'MQLs', format: 'number', tier: 1 },
      { id: 'ig_cpl', name: 'CPL', format: 'currency', tier: 2 },
      { id: 'ig_cpmql', name: 'CPMQL', format: 'currency', tier: 2 },
    ],
  },
  youtube: {
    label: 'YouTube',
    metrics: [
      // Ordem: Inscritos → Crescimento → Visualizações → Horas → CTR → Retenção → Leads → MQLs
      { id: 'yt_inscritos', name: 'Inscritos', format: 'number', tier: 1 },
      { id: 'yt_crescimentoInscritos', name: 'Crescimento Inscritos', format: 'number', tier: 2 },
      { id: 'yt_visualizacoes', name: 'Visualizações', format: 'number', tier: 3 },
      { id: 'yt_horasAssistidas', name: 'Horas Assistidas', format: 'number', tier: 3 },
      { id: 'yt_ctrImpressoes', name: 'CTR Impressões', format: 'percent', tier: 1 },
      { id: 'yt_retencaoMedia', name: 'Retenção Média', format: 'percent', tier: 1 },
      { id: 'yt_leads', name: 'Leads', format: 'number', tier: 1 },
      { id: 'yt_mqls', name: 'MQLs', format: 'number', tier: 1 },
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    metrics: [
      // Ordem: Seguidores → Crescimento → Impressões → Engajamento → Leads → MQLs
      { id: 'li_seguidores', name: 'Seguidores', format: 'number', tier: 1 },
      { id: 'li_crescimentoSeguidores', name: 'Crescimento Seguidores', format: 'number', tier: 2 },
      { id: 'li_impressoes', name: 'Impressões', format: 'number', tier: 3 },
      { id: 'li_taxaEngajamento', name: 'Taxa de Engajamento', format: 'percent', tier: 1 },
      { id: 'li_leads', name: 'Leads', format: 'number', tier: 1 },
      { id: 'li_mqls', name: 'MQLs', format: 'number', tier: 1 },
    ],
  },
};

// ===== Channel Derived Formulas =====
// Functions that take Tier 1 inputs (using JSONB keys) and return Tier 2 derived values.
// Used by PlanejamentoMetas to auto-calculate derived metrics in real-time.

function deriveAdsFunnel(inputs: Record<string, number>): Record<string, number> {
  const investimento = inputs.investimento || 0;
  const cpm = inputs.cpm || 0;
  const ctr = inputs.ctr || 0;
  const connectRate = inputs.connectRate || 0;
  const taxaConversaoPagina = inputs.taxaConversaoPagina || 0;
  const percMqls = inputs.percMqls || 0;
  const percRa = inputs.percRa || 0;
  const percRrVendas = inputs.percRrVendas || 0;
  const aov = inputs.aov || 0;

  const impressoes = cpm > 0 ? (investimento / cpm) * 1000 : 0;
  const cliques = Math.round(impressoes * ctr);
  const visualizacoesPagina = Math.round(cliques * connectRate);
  const leads = Math.round(visualizacoesPagina * taxaConversaoPagina);
  const mqls = Math.round(leads * percMqls);
  const cpl = leads > 0 ? investimento / leads : 0;
  const cpmql = mqls > 0 ? investimento / mqls : 0;
  // Simplified funnel: leads → %RA → RA, then RA × %RR→Vendas → negócios
  const ra = Math.round(leads * percRa);
  const negocioGanho = Math.round(ra * percRrVendas);
  const receita = negocioGanho * aov;
  const cacUnico = negocioGanho > 0 ? investimento / negocioGanho : 0;
  const cacContrato = cacUnico;
  const percRr = percRa; // At platform level, %RR ≈ %RA (no separate noshow)

  return {
    visualizacoesPagina, leads, mqls, cpl, cpmql,
    percRr, negocioGanho, receita,
    receitaPontual: 0, receitaRecorrente: receita,
    cacUnico, cacContrato, cac: cacUnico,
  };
}

export const CHANNEL_DERIVED_FORMULAS: Record<string, (inputs: Record<string, number>) => Record<string, number>> = {
  meta_ads: deriveAdsFunnel,
  google_ads: deriveAdsFunnel,
  // Instagram/YouTube/LinkedIn have simpler derivations (no ads funnel chain)
  instagram: (inputs) => {
    const leads = inputs.leads || 0;
    const mqls = inputs.mqls || 0;
    return {
      percMqls: leads > 0 ? mqls / leads : 0,
      deltaSeguidores: 0, // Needs previous month data, not derivable from inputs alone
      comecaramSeguir: 0,
      cpl: 0, // No investment for organic Instagram
      cpmql: 0,
      interacoes: 0, // Needs alcance data
    };
  },
  youtube: (inputs) => ({
    crescimentoInscritos: 0, // Needs previous month data
  }),
  linkedin: (inputs) => ({
    crescimentoSeguidores: 0, // Needs previous month data
  }),
};

// ===== Tier 3 Metric IDs =====
// Metrics that are tracking-only (no budget). Used by OxR to show "—" instead of 0.

export const TIER3_METRIC_IDS = new Set<string>([
  // Meta Ads
  'meta_videoP75', 'meta_videoP100',
  // Instagram
  'ig_deixaramSeguir', 'ig_percPerdaSeguidores',
  'ig_visualizacoesTotais', 'ig_percVisualizacoesOrganicas', 'ig_visualizacoesOrganicas',
  'ig_percVisualizacoesPagas', 'ig_visualizacoesPagas',
  'ig_alcanceTotal', 'ig_alcanceOrganico', 'ig_alcancePago',
  'ig_frequenciaAlcance', 'ig_percCrescimentoSeguidores', 'ig_visitasPerfil',
  // YouTube
  'yt_visualizacoes', 'yt_horasAssistidas', 'yt_curtidas', 'yt_comentarios',
  'yt_compartilhamentos', 'yt_videosPublicados',
  // LinkedIn
  'li_impressoes', 'li_cliquesPost', 'li_postsPublicados',
  'li_reacoes', 'li_comentarios', 'li_compartilhamentos',
]);

// ===== Simulation Engine =====
// Defines which metrics are user inputs vs derived (auto-calculated),
// and the formulas to compute derived metrics from inputs.

/**
 * Metrics the user sets directly in simulation mode.
 * All other Inbound metrics are derived from these.
 */
export const SIMULATION_INPUT_METRICS = new Set([
  // Marketing inputs
  'investimento', 'visualizacoes_pagina', 'connect_rate', 'taxa_conversao_pagina', 'perc_mqls',
  // MQL funnel inputs (rates & tickets)
  'mql_ra_perc', 'mql_noshow', 'mql_taxa_vendas',
  'mql_ticket_acel', 'mql_ticket_impl',
  // Não-MQL funnel inputs (rates & tickets)
  'nmql_ra_perc', 'nmql_noshow', 'nmql_taxa_vendas',
  'nmql_ticket_acel', 'nmql_ticket_impl',
]);

type SimFormulaFn = (v: Record<string, number>) => number;

/**
 * Evaluation order matters — each formula can reference metrics computed before it.
 * The array defines [metricId, formulaFn] in topological order.
 */
export const SIMULATION_EVAL_ORDER: Array<[string, SimFormulaFn]> = [
  // Marketing derived
  ['leads', (v) => Math.round(v.visualizacoes_pagina * v.taxa_conversao_pagina)],
  ['mqls', (v) => Math.round(v.leads * v.perc_mqls)],
  ['cpl', (v) => v.leads > 0 ? v.investimento / v.leads : 0],
  ['cpmql', (v) => v.mqls > 0 ? v.investimento / v.mqls : 0],

  // MQL funnel derived
  ['mql_ra_num', (v) => Math.round(v.mqls * v.mql_ra_perc)],
  ['mql_rr_num', (v) => Math.round(v.mql_ra_num * (1 - v.mql_noshow))],
  ['mql_rr_perc', (v) => 1 - v.mql_noshow],
  ['mql_novos_clientes', (v) => Math.round(v.mql_rr_num * v.mql_taxa_vendas)],
  ['mql_fat_acel', (v) => v.mql_novos_clientes * v.mql_ticket_acel],
  ['mql_fat_impl', (v) => v.mql_novos_clientes * v.mql_ticket_impl],
  ['mql_faturamento', (v) => v.mql_fat_acel + v.mql_fat_impl],
  ['mql_aov', (v) => v.mql_novos_clientes > 0 ? v.mql_faturamento / v.mql_novos_clientes : 0],
  ['mql_taxa_conversao', (v) => v.mqls > 0 ? v.mql_novos_clientes / v.mqls : 0],

  // Não-MQL funnel derived (input = leads - mqls)
  ['nmql_ra_num', (v) => {
    const naoMqls = Math.max(0, v.leads - v.mqls);
    return Math.round(naoMqls * v.nmql_ra_perc);
  }],
  ['nmql_rr_num', (v) => Math.round(v.nmql_ra_num * (1 - v.nmql_noshow))],
  ['nmql_rr_perc', (v) => 1 - v.nmql_noshow],
  ['nmql_novos_clientes', (v) => Math.round(v.nmql_rr_num * v.nmql_taxa_vendas)],
  ['nmql_fat_acel', (v) => v.nmql_novos_clientes * v.nmql_ticket_acel],
  ['nmql_fat_impl', (v) => v.nmql_novos_clientes * v.nmql_ticket_impl],
  ['nmql_faturamento', (v) => v.nmql_fat_acel + v.nmql_fat_impl],
  ['nmql_aov', (v) => v.nmql_novos_clientes > 0 ? v.nmql_faturamento / v.nmql_novos_clientes : 0],
  ['nmql_taxa_conversao', (v) => {
    const naoMqls = Math.max(0, v.leads - v.mqls);
    return naoMqls > 0 ? v.nmql_novos_clientes / naoMqls : 0;
  }],
];

/** Set of all derived metric IDs (for quick lookup) */
export const SIMULATION_DERIVED_METRICS = new Set(
  SIMULATION_EVAL_ORDER.map(([id]) => id)
);

/**
 * Given a flat map of metric values for one month, recalculate all derived metrics.
 * Mutates and returns the same object for efficiency.
 */
export function simulateMonth(values: Record<string, number>): Record<string, number> {
  for (const [metricId, formula] of SIMULATION_EVAL_ORDER) {
    values[metricId] = formula(values);
  }
  return values;
}

// ===== Month Names =====

export const MONTH_NAMES: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

export const MONTH_NAMES_FULL: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};
