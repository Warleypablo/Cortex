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

function formatCurrencyShort(value: number): string {
  if (value >= 1000000) {
    return 'R$ ' + (value / 1000000).toFixed(2).replace('.', ',') + 'M';
  } else if (value >= 1000) {
    return 'R$ ' + (value / 1000).toFixed(2).replace('.', ',') + 'K';
  }
  return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace('.', ',') + '%';
}

function formatPercentShort(value: number): string {
  return value.toFixed(1).replace('.', ',') + '%';
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
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  
  // Verificar disponibilidade das fontes de dados
  const ga4Disponivel = ga4Atual.disponivel !== false;
  const googleAdsDisponivel = googleAds.disponivel !== false;
  const metaAdsDisponivel = metaAds.disponivel !== false;
  
  // Debug: mostrar métricas recebidas e status de disponibilidade
  console.log(`[AutoReport PPTX] Status das fontes:`);
  console.log(`  - GA4: ${ga4Disponivel ? 'DISPONÍVEL' : 'INDISPONÍVEL - ' + (ga4Atual.erro || 'Sem permissão')}`);
  console.log(`  - Google Ads: ${googleAdsDisponivel ? 'DISPONÍVEL' : 'INDISPONÍVEL - ' + (googleAds.erro || 'Sem permissão')}`);
  console.log(`  - Meta Ads: ${metaAdsDisponivel ? 'DISPONÍVEL' : 'INDISPONÍVEL - ' + (metaAds.erro || 'Sem permissão')}`);
  
  console.log(`[AutoReport PPTX] Métricas recebidas:`);
  console.log(`  - GA4 Atual: sessoes=${ga4Atual.sessoes}, receita=${ga4Atual.receita}, conversoes=${ga4Atual.conversoes}, canais=${ga4Atual.canais?.length || 0}`);
  console.log(`  - GA4 Anterior: sessoes=${ga4Anterior.sessoes}, receita=${ga4Anterior.receita}`);
  console.log(`  - Meta Ads: custo=${metaAds.custo}, conversoes=${metaAds.conversoes}, roas=${metaAds.roas}, campanhas=${metaAds.campanhas?.length || 0}`);
  console.log(`  - Google Ads: custo=${googleAds.custo}, conversoes=${googleAds.conversoes}, campanhas=${googleAds.campanhas?.length || 0}`);
  console.log(`  - Metas: fat=${cliente.metaFaturamento}, inv=${cliente.metaInvestimento}`);
  console.log(`  - Meta Ads detalhes: cliques=${metaAds.cliques}, impressoes=${metaAds.impressoes}, ctr=${metaAds.ctr}`);
  
  const templateContent = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateContent);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });
  
  // Cálculos gerais - usar dados disponíveis
  const investTotal = googleAds.custo + metaAds.custo;
  const convTotal = googleAds.conversoes + metaAds.conversoes;
  
  // Calcular faturamento: priorizar GA4, senão usar ROAS do Meta + Google Ads
  const fatMeta = metaAds.roas * metaAds.custo;
  const fatGoogle = googleAds.roas * googleAds.custo;
  const receita = ga4Disponivel && ga4Atual.receita > 0 ? ga4Atual.receita : (fatMeta + fatGoogle);
  const receitaFonte = ga4Disponivel && ga4Atual.receita > 0 ? 'GA4' : 'Estimado (ROAS * Investimento)';
  
  // ROAS consolidado: usar receita calculada / investimento total
  const roas = investTotal > 0 ? receita / investTotal : 0;
  const cpa = convTotal > 0 ? investTotal / convTotal : 0;
  
  // Taxa de conversão: usar GA4 se disponível, senão estimar baseado nas plataformas
  const taxaConv = ga4Disponivel && ga4Atual.sessoes > 0 
    ? (ga4Atual.conversoes / ga4Atual.sessoes) * 100 
    : (metaAds.cliques > 0 ? (metaAds.conversoes / metaAds.cliques) * 100 : 0);
  
  const ticketMedio = convTotal > 0 ? receita / convTotal : 0;
  
  // CPS: usar GA4 se disponível, senão usar cliques do Meta
  const totalCliques = metaAds.cliques + googleAds.cliques;
  const cps = ga4Disponivel && ga4Atual.sessoes > 0 
    ? investTotal / ga4Atual.sessoes 
    : (totalCliques > 0 ? investTotal / totalCliques : 0);
    
  console.log(`[AutoReport PPTX] Cálculos consolidados:`);
  console.log(`  - Receita: R$ ${receita.toFixed(2)} (fonte: ${receitaFonte})`);
  console.log(`  - Investimento Total: R$ ${investTotal.toFixed(2)}`);
  console.log(`  - ROAS: ${roas.toFixed(2)}`);
  console.log(`  - Conversões: ${convTotal}`);
  console.log(`  - CPA: R$ ${cpa.toFixed(2)}`);
  console.log(`  - Ticket Médio: R$ ${ticketMedio.toFixed(2)}`);
  
  // Variações (assumindo anterior = 0 se não disponível)
  const varFat = formatVariation(calcVariation(receita, ga4Anterior.receita));
  const varInv = formatVariation(calcVariation(investTotal, 0)); // Sem dado anterior
  const varVendas = formatVariation(calcVariation(convTotal, ga4Anterior.conversoes));
  const varRoas = formatVariation(0); // Sem dado anterior
  const varTaxaConv = formatVariation(calcVariation(taxaConv, ga4Anterior.sessoes > 0 ? (ga4Anterior.conversoes / ga4Anterior.sessoes) * 100 : 0));
  const varCpa = formatVariation(0);
  const varCps = formatVariation(0);
  const varTckMed = formatVariation(0);
  
  // Meta Ads (Facebook)
  const metaCampanhas = metaAds.campanhas || [];
  
  // Google Ads
  const googleCampanhas = googleAds.campanhas || [];
  
  // GA4 Canais
  const ga4Canais = ga4Atual.canais || [];
  
  // Mapeamento de placeholders conforme o template
  const placeholders: PlaceholderMap = {
    // Slide 1 - Capa
    freq: 'Semanal',
    cliente: cliente.cliente,
    periodo: periodos.atual.label,
    
    // Slide 2 - Resumo Executivo
    periodo_comp: periodos.anterior.label,
    
    // Faturamento e Investimento
    fat_sem: formatCurrencyShort(receita),
    fat_sem_comp: formatCurrencyShort(ga4Anterior.receita),
    inv_sem: formatCurrencyShort(investTotal),
    inv_sem_comp: '-',
    var_fat_sem: varFat,
    var_inv_sem: varInv,
    
    // KPIs principais
    roas: roas.toFixed(2).replace('.', ','),
    roas_comp: '-',
    var_roas: varRoas,
    
    taxa_conv: formatPercentShort(taxaConv),
    taxa_conv_comp: '-',
    var_taxa_conv: varTaxaConv,
    
    vendas: formatNumber(convTotal),
    vendas_comp: formatNumber(ga4Anterior.conversoes),
    var_vendas: varVendas,
    
    cps: formatCurrency(cps),
    cps_comp: '-',
    var_cps: varCps,
    
    tck_med: formatCurrency(ticketMedio),
    tck_med_comp: '-',
    var_tck_med: varTckMed,
    
    cpa: formatCurrency(cpa),
    cpa_comp: '-',
    var_cpa: varCpa,
    
    // Metas mensais
    fat_mes: formatCurrencyShort(receita),
    meta_fat: cliente.metaFaturamento ? formatCurrencyShort(cliente.metaFaturamento) : '-',
    per_meta_fat: cliente.metaFaturamento ? formatPercentShort((receita / cliente.metaFaturamento) * 100) : '-',
    inv_mes: formatCurrencyShort(investTotal),
    meta_inv: cliente.metaInvestimento ? formatCurrencyShort(cliente.metaInvestimento) : '-',
    per_meta_inv: cliente.metaInvestimento ? formatPercentShort((investTotal / cliente.metaInvestimento) * 100) : '-',
    
    // Slide 3 - Meta Ads (Facebook)
    fat_face: formatCurrencyShort(metaAds.roas * metaAds.custo),
    fat_face_comp: '-',
    inv_face: formatCurrencyShort(metaAds.custo),
    inv_face_comp: '-',
    roas_face: metaAds.roas.toFixed(2).replace('.', ','),
    roas_face_comp: '-',
    vendas_face: formatNumber(metaAds.conversoes),
    vendas_face_comp: '-',
    cpa_face: formatCurrency(metaAds.conversoes > 0 ? metaAds.custo / metaAds.conversoes : 0),
    cpa_face_comp: '-',
    var_fat_face: '-',
    var_inv_face: '-',
    var_vendas_face: '-',
    var_roas_face: '-',
    var_cpa_face: '-',
    
    // Campanhas Meta Ads (adf1-5)
    nome_adf1: metaCampanhas[0]?.nome || '-',
    conv_adf1: formatNumber(metaCampanhas[0]?.conversoes || 0),
    cpa_adf1: formatCurrency(metaCampanhas[0]?.conversoes ? metaCampanhas[0].custo / metaCampanhas[0].conversoes : 0),
    inv_adf1: formatCurrencyShort(metaCampanhas[0]?.custo || 0),
    roas_adf1: '-',
    fat_adf1: '-',
    imp_adf1: formatNumber(metaCampanhas[0]?.impressoes || 0),
    
    nome_adf2: metaCampanhas[1]?.nome || '-',
    conv_adf2: formatNumber(metaCampanhas[1]?.conversoes || 0),
    cpa_adf2: formatCurrency(metaCampanhas[1]?.conversoes ? metaCampanhas[1].custo / metaCampanhas[1].conversoes : 0),
    inv_adf2: formatCurrencyShort(metaCampanhas[1]?.custo || 0),
    roas_adf2: '-',
    fat_adf2: '-',
    imp_adf2: formatNumber(metaCampanhas[1]?.impressoes || 0),
    
    nome_adf3: metaCampanhas[2]?.nome || '-',
    conv_adf3: formatNumber(metaCampanhas[2]?.conversoes || 0),
    cpa_adf3: formatCurrency(metaCampanhas[2]?.conversoes ? metaCampanhas[2].custo / metaCampanhas[2].conversoes : 0),
    inv_adf3: formatCurrencyShort(metaCampanhas[2]?.custo || 0),
    roas_adf3: '-',
    fat_adf3: '-',
    imp_adf3: formatNumber(metaCampanhas[2]?.impressoes || 0),
    
    nome_adf4: metaCampanhas[3]?.nome || '-',
    conv_adf4: formatNumber(metaCampanhas[3]?.conversoes || 0),
    cpa_adf4: formatCurrency(metaCampanhas[3]?.conversoes ? metaCampanhas[3].custo / metaCampanhas[3].conversoes : 0),
    inv_adf4: formatCurrencyShort(metaCampanhas[3]?.custo || 0),
    roas_adf4: '-',
    fat_adf4: '-',
    imp_adf4: formatNumber(metaCampanhas[3]?.impressoes || 0),
    
    nome_adf5: metaCampanhas[4]?.nome || '-',
    conv_adf5: formatNumber(metaCampanhas[4]?.conversoes || 0),
    cpa_adf5: formatCurrency(metaCampanhas[4]?.conversoes ? metaCampanhas[4].custo / metaCampanhas[4].conversoes : 0),
    inv_adf5: formatCurrencyShort(metaCampanhas[4]?.custo || 0),
    roas_adf5: '-',
    fat_adf5: '-',
    imp_adf5: formatNumber(metaCampanhas[4]?.impressoes || 0),
    
    // Slide 4 - Google Ads
    fat_goog: formatCurrencyShort(googleAds.roas * googleAds.custo),
    fat_goog_comp: '-',
    inv_goog: formatCurrencyShort(googleAds.custo),
    inv_goog_comp: '-',
    roas_goog: googleAds.roas.toFixed(2).replace('.', ','),
    roas_goog_comp: '-',
    vendas_goog: formatNumber(googleAds.conversoes),
    vendas_goog_comp: '-',
    cpa_goog: formatCurrency(googleAds.conversoes > 0 ? googleAds.custo / googleAds.conversoes : 0),
    cpa_goog_comp: '-',
    var_fat_goog: '-',
    var_inv_goog: '-',
    var_vendas_goog: '-',
    var_roas_goog: '-',
    var_cpa_goog: '-',
    
    // Campanhas Google Ads (adg1-5)
    nome_adg1: googleCampanhas[0]?.nome || '-',
    conv_adg1: formatNumber(googleCampanhas[0]?.conversoes || 0),
    cpa_adg1: formatCurrency(googleCampanhas[0]?.conversoes ? googleCampanhas[0].custo / googleCampanhas[0].conversoes : 0),
    inv_adg1: formatCurrencyShort(googleCampanhas[0]?.custo || 0),
    roas_adg1: '-',
    fat_adg1: '-',
    imp_adg1: formatNumber(googleCampanhas[0]?.impressoes || 0),
    
    nome_adg2: googleCampanhas[1]?.nome || '-',
    conv_adg2: formatNumber(googleCampanhas[1]?.conversoes || 0),
    cpa_adg2: formatCurrency(googleCampanhas[1]?.conversoes ? googleCampanhas[1].custo / googleCampanhas[1].conversoes : 0),
    inv_adg2: formatCurrencyShort(googleCampanhas[1]?.custo || 0),
    roas_adg2: '-',
    fat_adg2: '-',
    imp_adg2: formatNumber(googleCampanhas[1]?.impressoes || 0),
    
    nome_adg3: googleCampanhas[2]?.nome || '-',
    conv_adg3: formatNumber(googleCampanhas[2]?.conversoes || 0),
    cpa_adg3: formatCurrency(googleCampanhas[2]?.conversoes ? googleCampanhas[2].custo / googleCampanhas[2].conversoes : 0),
    inv_adg3: formatCurrencyShort(googleCampanhas[2]?.custo || 0),
    roas_adg3: '-',
    fat_adg3: '-',
    imp_adg3: formatNumber(googleCampanhas[2]?.impressoes || 0),
    
    nome_adg4: googleCampanhas[3]?.nome || '-',
    conv_adg4: formatNumber(googleCampanhas[3]?.conversoes || 0),
    cpa_adg4: formatCurrency(googleCampanhas[3]?.conversoes ? googleCampanhas[3].custo / googleCampanhas[3].conversoes : 0),
    inv_adg4: formatCurrencyShort(googleCampanhas[3]?.custo || 0),
    roas_adg4: '-',
    fat_adg4: '-',
    imp_adg4: formatNumber(googleCampanhas[3]?.impressoes || 0),
    
    nome_adg5: googleCampanhas[4]?.nome || '-',
    conv_adg5: formatNumber(googleCampanhas[4]?.conversoes || 0),
    cpa_adg5: formatCurrency(googleCampanhas[4]?.conversoes ? googleCampanhas[4].custo / googleCampanhas[4].conversoes : 0),
    inv_adg5: formatCurrencyShort(googleCampanhas[4]?.custo || 0),
    roas_adg5: '-',
    fat_adg5: '-',
    imp_adg5: formatNumber(googleCampanhas[4]?.impressoes || 0),
    
    // Slide 5 - GA4 Canais
    ses_ga: formatNumber(ga4Atual.sessoes),
    ses_ga_comp: formatNumber(ga4Anterior.sessoes),
    ses_eng_ga: formatNumber(ga4Atual.usuarios),
    ses_eng_ga_comp: formatNumber(ga4Anterior.usuarios),
    temp_med_ga: formatDuration(ga4Atual.duracaoMedia),
    temp_med_ga_comp: formatDuration(ga4Anterior.duracaoMedia),
    taxa_eng_ga: formatPercentShort(100 - ga4Atual.taxaRejeicao),
    taxa_eng_ga_comp: formatPercentShort(100 - ga4Anterior.taxaRejeicao),
    var_ses_ga: formatVariation(calcVariation(ga4Atual.sessoes, ga4Anterior.sessoes)),
    var_ses_eng_ga: formatVariation(calcVariation(ga4Atual.usuarios, ga4Anterior.usuarios)),
    var_taxa_eng_ga: '-',
    var_temp_med_ga: formatVariation(calcVariation(ga4Atual.duracaoMedia, ga4Anterior.duracaoMedia)),
    
    // Canais GA4 (ca1-5)
    canal_ca1: ga4Canais[0]?.nome || '-',
    desc_ca1: '',
    ses_ca1: formatNumber(ga4Canais[0]?.sessoes || 0),
    ses_eng_ca1: '-',
    taxa_eng_ca1: '-',
    temp_med_ca1: '-',
    event_ca1: '-',
    receit_ca1: formatCurrencyShort(0),
    
    canal_ca2: ga4Canais[1]?.nome || '-',
    desc_ca2: '',
    ses_ca2: formatNumber(ga4Canais[1]?.sessoes || 0),
    ses_eng_ca2: '-',
    taxa_eng_ca2: '-',
    temp_med_ca2: '-',
    event_ca2: '-',
    receit_ca2: formatCurrencyShort(0),
    
    canal_ca3: ga4Canais[2]?.nome || '-',
    desc_ca3: '',
    ses_ca3: formatNumber(ga4Canais[2]?.sessoes || 0),
    ses_eng_ca3: '-',
    taxa_eng_ca3: '-',
    temp_med_ca3: '-',
    event_ca3: '-',
    receit_ca3: formatCurrencyShort(0),
    
    canal_ca4: ga4Canais[3]?.nome || '-',
    desc_ca4: '',
    ses_ca4: formatNumber(ga4Canais[3]?.sessoes || 0),
    ses_eng_ca4: '-',
    taxa_eng_ca4: '-',
    temp_med_ca4: '-',
    event_ca4: '-',
    receit_ca4: formatCurrencyShort(0),
    
    canal_ca5: ga4Canais[4]?.nome || '-',
    desc_ca5: '',
    ses_ca5: formatNumber(ga4Canais[4]?.sessoes || 0),
    ses_eng_ca5: '-',
    taxa_eng_ca5: '-',
    temp_med_ca5: '-',
    event_ca5: '-',
    receit_ca5: formatCurrencyShort(0),
  };
  
  try {
    doc.render(placeholders);
  } catch (error: any) {
    console.error('[AutoReport PPTX] Erro ao renderizar template:', error);
    throw error;
  }
  
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
