export interface AutoReportCliente {
  rowIndex: number;
  gerar: boolean;
  cliente: string;
  categoria: 'ecommerce' | 'lead_com_site' | 'lead_sem_site' | '';
  linkPainel: string;
  linkPasta: string;
  idGoogleAds: string;
  idMetaAds: string;
  idGa4: string;
  gestor: string;
  squad: string;
  status: string;
  ultimaGeracao: string;
}

export interface AutoReportJob {
  id: string;
  clienteNome: string;
  categoria: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  mensagem?: string;
  presentationId?: string;
  presentationUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  criadoEm: string;
  concluidoEm?: string;
}

export interface PageSelection {
  cover: boolean;
  executiveSummary: boolean;
  investmentChannels: boolean;
  funnelTraffic: boolean;
  campaignsRecommendations: boolean;
}

export type OutputFormat = 'pdf' | 'slides';
export type StatusTab = 'todos' | 'pendentes' | 'gerados' | 'com_erro';
export type SortColumn = 'nome' | 'gestor' | 'squad' | 'ultimaGeracao' | null;
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export const DEFAULT_PAGE_SELECTION: PageSelection = {
  cover: true,
  executiveSummary: true,
  investmentChannels: true,
  funnelTraffic: true,
  campaignsRecommendations: true,
};

export const PAGE_OPTIONS: { key: keyof PageSelection; label: string; description: string }[] = [
  { key: 'investmentChannels', label: 'Investimento & Canais', description: 'Google Ads + Meta Ads' },
  { key: 'funnelTraffic', label: 'Funil & Trafego', description: 'Metricas GA4' },
  { key: 'campaignsRecommendations', label: 'Campanhas & Recomendacoes', description: 'Detalhes + Insights' },
];
