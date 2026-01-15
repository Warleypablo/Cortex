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

export interface PeriodoReferencia {
  inicio: Date;
  fim: Date;
  label: string;
}

export interface MetricasGA4 {
  sessoes: number;
  usuarios: number;
  novoUsuarios: number;
  taxaRejeicao: number;
  duracaoMedia: number;
  conversoes: number;
  receita: number;
  canais: {
    nome: string;
    sessoes: number;
    conversoes: number;
  }[];
}

export interface MetricasGoogleAds {
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  custo: number;
  conversoes: number;
  custoPorConversao: number;
  roas: number;
  campanhas: {
    nome: string;
    impressoes: number;
    cliques: number;
    custo: number;
    conversoes: number;
  }[];
}

export interface MetricasMetaAds {
  impressoes: number;
  alcance: number;
  cliques: number;
  ctr: number;
  cpc: number;
  cpm: number;
  custo: number;
  conversoes: number;
  custoPorConversao: number;
  roas: number;
  campanhas: {
    nome: string;
    impressoes: number;
    alcance: number;
    cliques: number;
    custo: number;
    conversoes: number;
  }[];
  criativas: {
    id: string;
    nome: string;
    imageUrl: string;
    impressoes: number;
    cliques: number;
  }[];
}

export interface PlaceholderMap {
  [key: string]: string | number;
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
  criadoEm: Date;
  concluidoEm?: Date;
}

export interface AutoReportConfig {
  centralSheetUrl: string;
  centralTabName: string;
  templateRelatorioId: string;
  relatorioFolderId: string;
  templateEcommerce: string;
  templateLeadSemSite: string;
  templateLeadComSite: string;
}

export const TEMPLATE_IDS: Record<string, string> = {
  'ecommerce': process.env.TEMPLATE_ECOMMERCE || '',
  'lead_com_site': process.env.TEMPLATE_LEAD_COM_SITE || '',
  'lead_sem_site': process.env.TEMPLATE_LEAD_SEM_SITE || '',
};
