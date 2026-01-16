import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { 
  PlaceholderMap, 
  AutoReportCliente, 
  MetricasGA4, 
  MetricasGoogleAds, 
  MetricasMetaAds,
  PeriodoReferencia 
} from './types';

const LOCAL_PPTX_TEMPLATES: Record<string, string> = {
  'ecommerce': 'attached_assets/[ECOM_TEMPLATE]_Auto_Report_Semanal_1768573133921.pptx',
  'lead_com_site': '',
  'lead_sem_site': '',
};

function formatCurrency(value: number): string {
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace('.', ',') + '%';
}

function calcVariation(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

function formatVariation(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1).replace('.', ',') + '%';
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function getCategoriaLabel(categoria: string): string {
  switch (categoria) {
    case 'ecommerce': return 'E-commerce';
    case 'lead_com_site': return 'Lead (Com Site)';
    case 'lead_sem_site': return 'Lead (Sem Site)';
    default: return categoria;
  }
}

interface PptxReportData {
  cliente: AutoReportCliente;
  periodos: { atual: PeriodoReferencia; anterior: PeriodoReferencia };
  ga4Atual: MetricasGA4;
  ga4Anterior: MetricasGA4;
  googleAds: MetricasGoogleAds;
  metaAds: MetricasMetaAds;
}

export async function generatePptxReport(data: PptxReportData): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const { cliente, periodos, ga4Atual, ga4Anterior, googleAds, metaAds } = data;
  
  const categoria = cliente.categoria || 'ecommerce';
  const templatePath = LOCAL_PPTX_TEMPLATES[categoria];
  
  if (!templatePath || !fs.existsSync(templatePath)) {
    throw new Error(`Template PPTX não encontrado para categoria: ${categoria}`);
  }
  
  console.log(`[AutoReport PPTX] Gerando relatório usando template: ${templatePath}`);
  
  const templateContent = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateContent);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });
  
  const investTotal = googleAds.custo + metaAds.custo;
  const convTotal = googleAds.conversoes + metaAds.conversoes;
  const roas = investTotal > 0 ? ga4Atual.receita / investTotal : 0;
  const cpa = convTotal > 0 ? investTotal / convTotal : 0;
  
  const receitaVar = calcVariation(ga4Atual.receita, ga4Anterior.receita);
  const sessoesVar = calcVariation(ga4Atual.sessoes, ga4Anterior.sessoes);
  const usuariosVar = calcVariation(ga4Atual.usuarios, ga4Anterior.usuarios);
  const convVar = calcVariation(ga4Atual.conversoes, ga4Anterior.conversoes);
  
  const googlePct = investTotal > 0 ? (googleAds.custo / investTotal) * 100 : 50;
  const metaPct = investTotal > 0 ? (metaAds.custo / investTotal) * 100 : 50;
  
  const placeholders: PlaceholderMap = {
    cliente: cliente.cliente,
    periodo: periodos.atual.label,
    periodo_atual: periodos.atual.label,
    periodo_anterior: periodos.anterior.label,
    
    investimento_total: formatCurrency(investTotal),
    receita: formatCurrency(ga4Atual.receita),
    roas: roas.toFixed(2).replace('.', ','),
    cpa: formatCurrency(cpa),
    
    receita_variacao: formatVariation(receitaVar),
    
    sessoes: formatNumber(ga4Atual.sessoes),
    sessoes_variacao: formatVariation(sessoesVar),
    usuarios: formatNumber(ga4Atual.usuarios),
    usuarios_variacao: formatVariation(usuariosVar),
    conversoes: formatNumber(ga4Atual.conversoes),
    conversoes_variacao: formatVariation(convVar),
    
    taxa_rejeicao: formatPercent(ga4Atual.taxaRejeicao),
    duracao_media: formatDuration(ga4Atual.duracaoMedia),
    
    google_ads_custo: formatCurrency(googleAds.custo),
    google_ads_impressoes: formatNumber(googleAds.impressoes),
    google_ads_cliques: formatNumber(googleAds.cliques),
    google_ads_ctr: formatPercent(googleAds.ctr),
    google_ads_cpc: formatCurrency(googleAds.cpc),
    google_ads_conversoes: formatNumber(googleAds.conversoes),
    google_ads_roas: googleAds.roas.toFixed(2).replace('.', ','),
    google_ads_percentual: googlePct.toFixed(0) + '%',
    
    meta_ads_custo: formatCurrency(metaAds.custo),
    meta_ads_impressoes: formatNumber(metaAds.impressoes),
    meta_ads_alcance: formatNumber(metaAds.alcance),
    meta_ads_cliques: formatNumber(metaAds.cliques),
    meta_ads_ctr: formatPercent(metaAds.ctr),
    meta_ads_cpc: formatCurrency(metaAds.cpc),
    meta_ads_cpm: formatCurrency(metaAds.cpm),
    meta_ads_conversoes: formatNumber(metaAds.conversoes),
    meta_ads_roas: metaAds.roas.toFixed(2).replace('.', ','),
    meta_ads_percentual: metaPct.toFixed(0) + '%',
    
    gestor: cliente.gestor || '',
    squad: cliente.squad || '',
    categoria: getCategoriaLabel(cliente.categoria),
    
    data_geracao: new Date().toLocaleDateString('pt-BR'),
  };
  
  doc.render(placeholders);
  
  const buffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
  const fileName = `Relatorio_${cliente.cliente.replace(/\s+/g, '_')}_${dateStr}.pptx`;
  
  console.log(`[AutoReport PPTX] Relatório gerado: ${fileName} (${buffer.length} bytes)`);
  
  return { buffer, fileName };
}
