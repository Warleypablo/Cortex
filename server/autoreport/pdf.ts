import PDFDocument from 'pdfkit';
import type { 
  AutoReportCliente, 
  MetricasGA4, 
  MetricasGoogleAds, 
  MetricasMetaAds,
  PeriodoReferencia 
} from './types';

const COLORS = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  secondary: '#1A1A2E',
  accent: '#16213E',
  background: '#FFFFFF',
  cardBg: '#F8FAFC',
  cardBorder: '#E2E8F0',
  text: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  success: '#10B981',
  successLight: '#D1FAE5',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  googleBlue: '#4285F4',
  metaBlue: '#1877F2',
  divider: '#E2E8F0',
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1).replace('.', ',') + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace('.', ',') + 'K';
  }
  return value.toLocaleString('pt-BR');
}

function formatNumberFull(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function calcularVariacao(atual: number, anterior: number): { texto: string; cor: string; bgCor: string; positivo: boolean } {
  if (anterior === 0) {
    const positivo = atual > 0;
    return { 
      texto: atual > 0 ? '+100%' : '0%', 
      cor: positivo ? COLORS.success : COLORS.textMuted,
      bgCor: positivo ? COLORS.successLight : COLORS.cardBg,
      positivo
    };
  }
  const variacao = ((atual - anterior) / anterior) * 100;
  const positivo = variacao >= 0;
  const sinal = positivo ? '+' : '';
  return { 
    texto: `${sinal}${variacao.toFixed(1).replace('.', ',')}%`,
    cor: positivo ? COLORS.success : COLORS.danger,
    bgCor: positivo ? COLORS.successLight : COLORS.dangerLight,
    positivo
  };
}

interface ReportData {
  cliente: AutoReportCliente;
  periodos: { atual: PeriodoReferencia; anterior: PeriodoReferencia };
  ga4Atual: MetricasGA4;
  ga4Anterior: MetricasGA4;
  googleAds: MetricasGoogleAds;
  metaAds: MetricasMetaAds;
}

export async function generatePdfReport(data: ReportData): Promise<{ buffer: Buffer; fileName: string }> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 40, left: 0, right: 0 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const fileName = `Relatorio_${data.cliente.cliente.replace(/\s+/g, '_')}_${dateStr}.pdf`;
        resolve({ buffer, fileName });
      });
      doc.on('error', reject);

      renderReport(doc, data);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function renderReport(doc: PDFKit.PDFDocument, data: ReportData): void {
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 80;
  
  renderCoverPage(doc, data, pageWidth, contentWidth);
  
  doc.addPage();
  renderExecutiveSummary(doc, data, pageWidth, contentWidth);
  
  doc.addPage();
  renderGA4Page(doc, data, pageWidth, contentWidth);
  
  doc.addPage();
  renderGoogleAdsPage(doc, data, pageWidth, contentWidth);
  
  doc.addPage();
  renderMetaAdsPage(doc, data, pageWidth, contentWidth);
  
  renderFooters(doc);
}

function renderCoverPage(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, contentWidth: number): void {
  doc.rect(0, 0, pageWidth, doc.page.height)
     .fill(COLORS.secondary);
  
  doc.rect(0, 0, 8, doc.page.height)
     .fill(COLORS.primary);
  
  doc.rect(0, doc.page.height - 180, pageWidth, 180)
     .fill(COLORS.accent);
  
  const logoY = 280;
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(56)
     .text('TURBO', 60, logoY);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(56)
     .text('PARTNERS', 60, logoY + 60);
  
  doc.moveTo(60, logoY + 140)
     .lineTo(200, logoY + 140)
     .lineWidth(4)
     .strokeColor(COLORS.primary)
     .stroke();
  
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(14)
     .text('RELATÓRIO SEMANAL DE PERFORMANCE', 60, logoY + 170);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(32)
     .text(data.cliente.cliente.toUpperCase(), 60, logoY + 210);
  
  const infoY = doc.page.height - 150;
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text('PERÍODO ANALISADO', 60, infoY);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(16)
     .text(data.periodos.atual.label, 60, infoY + 15);
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text('GESTOR', 60, infoY + 50);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(14)
     .text(data.cliente.gestor || 'N/A', 60, infoY + 65);
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text('SQUAD', 250, infoY + 50);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(14)
     .text(data.cliente.squad || 'N/A', 250, infoY + 65);
  
  const dataRelatorio = new Date().toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text('GERADO EM', pageWidth - 200, infoY + 50);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.regular)
     .fontSize(12)
     .text(dataRelatorio, pageWidth - 200, infoY + 65);
}

function renderExecutiveSummary(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, contentWidth: number): void {
  renderPageHeader(doc, pageWidth, 'Resumo Executivo', COLORS.primary);
  
  doc.y = 120;
  
  const investimentoTotal = data.googleAds.custo + data.metaAds.custo;
  const conversaoTotal = data.googleAds.conversoes + data.metaAds.conversoes;
  const receitaTotal = data.ga4Atual.receita;
  const roasGeral = investimentoTotal > 0 ? receitaTotal / investimentoTotal : 0;
  
  const bigCardWidth = (contentWidth - 30) / 2;
  const startX = 40;
  
  renderBigMetricCard(doc, startX, doc.y, bigCardWidth, 100, 
    'Investimento Total', formatCurrency(investimentoTotal), 
    'Google Ads + Meta Ads', COLORS.secondary);
  
  renderBigMetricCard(doc, startX + bigCardWidth + 30, doc.y, bigCardWidth, 100, 
    'Receita Total (GA4)', formatCurrency(receitaTotal), 
    calcularVariacao(data.ga4Atual.receita, data.ga4Anterior.receita).texto + ' vs semana anterior', 
    COLORS.success);
  
  doc.y += 120;
  
  const smallCardWidth = (contentWidth - 60) / 4;
  
  const summaryCards = [
    { label: 'Sessões', value: formatNumber(data.ga4Atual.sessoes), var: calcularVariacao(data.ga4Atual.sessoes, data.ga4Anterior.sessoes) },
    { label: 'Conversões', value: formatNumber(conversaoTotal), var: { texto: 'Total', cor: COLORS.textSecondary, bgCor: COLORS.cardBg, positivo: true } },
    { label: 'ROAS Geral', value: roasGeral.toFixed(2).replace('.', ',') + 'x', var: { texto: 'Retorno', cor: COLORS.textSecondary, bgCor: COLORS.cardBg, positivo: true } },
    { label: 'Custo/Conv.', value: formatCurrency(conversaoTotal > 0 ? investimentoTotal / conversaoTotal : 0), var: { texto: 'Média', cor: COLORS.textSecondary, bgCor: COLORS.cardBg, positivo: true } },
  ];
  
  summaryCards.forEach((card, i) => {
    const x = startX + (i * (smallCardWidth + 20));
    renderSmallMetricCard(doc, x, doc.y, smallCardWidth, 80, card.label, card.value, card.var);
  });
  
  doc.y += 110;
  
  renderSectionTitle(doc, 'Comparativo Semanal');
  
  doc.y += 20;
  
  const compData = [
    { label: 'Sessões', atual: data.ga4Atual.sessoes, anterior: data.ga4Anterior.sessoes, format: formatNumberFull },
    { label: 'Usuários', atual: data.ga4Atual.usuarios, anterior: data.ga4Anterior.usuarios, format: formatNumberFull },
    { label: 'Conversões', atual: data.ga4Atual.conversoes, anterior: data.ga4Anterior.conversoes, format: formatNumberFull },
    { label: 'Receita', atual: data.ga4Atual.receita, anterior: data.ga4Anterior.receita, format: formatCurrency },
  ];
  
  renderComparisonTable(doc, startX, doc.y, contentWidth, compData);
  
  doc.y += 180;
  
  renderSectionTitle(doc, 'Distribuição de Investimento');
  
  doc.y += 20;
  
  const googlePercent = investimentoTotal > 0 ? (data.googleAds.custo / investimentoTotal) * 100 : 0;
  const metaPercent = investimentoTotal > 0 ? (data.metaAds.custo / investimentoTotal) * 100 : 0;
  
  renderHorizontalBar(doc, startX, doc.y, contentWidth, 
    [
      { label: 'Google Ads', value: data.googleAds.custo, percent: googlePercent, color: COLORS.googleBlue },
      { label: 'Meta Ads', value: data.metaAds.custo, percent: metaPercent, color: COLORS.metaBlue },
    ]
  );
}

function renderGA4Page(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, contentWidth: number): void {
  renderPageHeader(doc, pageWidth, 'Google Analytics 4', COLORS.primary);
  
  doc.y = 120;
  const startX = 40;
  
  const cardWidth = (contentWidth - 40) / 3;
  const cardHeight = 85;
  
  const ga4Metrics = [
    { label: 'Sessões', value: formatNumber(data.ga4Atual.sessoes), var: calcularVariacao(data.ga4Atual.sessoes, data.ga4Anterior.sessoes), icon: '📊' },
    { label: 'Usuários', value: formatNumber(data.ga4Atual.usuarios), var: calcularVariacao(data.ga4Atual.usuarios, data.ga4Anterior.usuarios), icon: '👥' },
    { label: 'Novos Usuários', value: formatNumber(data.ga4Atual.novoUsuarios), var: calcularVariacao(data.ga4Atual.novoUsuarios, data.ga4Anterior.novoUsuarios), icon: '✨' },
    { label: 'Taxa de Rejeição', value: formatPercent(data.ga4Atual.taxaRejeicao * 100), var: calcularVariacao(data.ga4Anterior.taxaRejeicao, data.ga4Atual.taxaRejeicao), icon: '↩️' },
    { label: 'Duração Média', value: formatDuration(data.ga4Atual.duracaoMedia), var: calcularVariacao(data.ga4Atual.duracaoMedia, data.ga4Anterior.duracaoMedia), icon: '⏱️' },
    { label: 'Conversões', value: formatNumber(data.ga4Atual.conversoes), var: calcularVariacao(data.ga4Atual.conversoes, data.ga4Anterior.conversoes), icon: '🎯' },
  ];
  
  ga4Metrics.forEach((metric, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = startX + (col * (cardWidth + 20));
    const y = doc.y + (row * (cardHeight + 15));
    
    renderMetricCardWithVariation(doc, x, y, cardWidth, cardHeight, metric.label, metric.value, metric.var);
  });
  
  doc.y += (2 * (cardHeight + 15)) + 30;
  
  renderSectionTitle(doc, 'Receita');
  
  doc.y += 15;
  
  renderBigMetricCard(doc, startX, doc.y, contentWidth, 80,
    'Receita Total', formatCurrency(data.ga4Atual.receita),
    `${calcularVariacao(data.ga4Atual.receita, data.ga4Anterior.receita).texto} vs semana anterior | Semana passada: ${formatCurrency(data.ga4Anterior.receita)}`,
    COLORS.success);
  
  doc.y += 110;
  
  renderSectionTitle(doc, 'Top Canais de Aquisição');
  
  doc.y += 15;
  
  renderModernTable(doc, startX, doc.y, contentWidth,
    ['Canal', 'Sessões', 'Conversões', 'Taxa Conv.'],
    data.ga4Atual.canais.slice(0, 5).map(canal => [
      canal.nome || 'Direto',
      formatNumberFull(canal.sessoes),
      formatNumberFull(canal.conversoes),
      formatPercent(canal.sessoes > 0 ? (canal.conversoes / canal.sessoes) * 100 : 0)
    ]),
    [0.4, 0.2, 0.2, 0.2]
  );
}

function renderGoogleAdsPage(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, contentWidth: number): void {
  renderPageHeader(doc, pageWidth, 'Google Ads', COLORS.googleBlue);
  
  doc.y = 120;
  const startX = 40;
  
  const cardWidth = (contentWidth - 60) / 4;
  const cardHeight = 75;
  
  const row1 = [
    { label: 'Impressões', value: formatNumber(data.googleAds.impressoes) },
    { label: 'Cliques', value: formatNumber(data.googleAds.cliques) },
    { label: 'CTR', value: formatPercent(data.googleAds.ctr) },
    { label: 'CPC Médio', value: formatCurrency(data.googleAds.cpc) },
  ];
  
  row1.forEach((metric, i) => {
    const x = startX + (i * (cardWidth + 20));
    renderSimpleMetricCard(doc, x, doc.y, cardWidth, cardHeight, metric.label, metric.value, COLORS.googleBlue);
  });
  
  doc.y += cardHeight + 20;
  
  const row2 = [
    { label: 'Custo Total', value: formatCurrency(data.googleAds.custo), highlight: true },
    { label: 'Conversões', value: formatNumber(data.googleAds.conversoes), highlight: true },
    { label: 'Custo/Conversão', value: formatCurrency(data.googleAds.custoPorConversao) },
    { label: 'ROAS', value: data.googleAds.roas.toFixed(2).replace('.', ',') + 'x' },
  ];
  
  row2.forEach((metric, i) => {
    const x = startX + (i * (cardWidth + 20));
    if (metric.highlight) {
      renderHighlightMetricCard(doc, x, doc.y, cardWidth, cardHeight, metric.label, metric.value, COLORS.googleBlue);
    } else {
      renderSimpleMetricCard(doc, x, doc.y, cardWidth, cardHeight, metric.label, metric.value, COLORS.googleBlue);
    }
  });
  
  doc.y += cardHeight + 40;
  
  renderSectionTitle(doc, 'Performance por Campanha');
  
  doc.y += 15;
  
  renderModernTable(doc, startX, doc.y, contentWidth,
    ['Campanha', 'Impressões', 'Cliques', 'Custo', 'Conv.', 'ROAS'],
    data.googleAds.campanhas.slice(0, 6).map(camp => {
      const roas = camp.custo > 0 ? (camp.conversoes * 100 / camp.custo) : 0;
      return [
        camp.nome.length > 25 ? camp.nome.substring(0, 25) + '...' : camp.nome,
        formatNumber(camp.impressoes),
        formatNumber(camp.cliques),
        formatCurrency(camp.custo),
        formatNumber(camp.conversoes),
        roas.toFixed(1).replace('.', ',') + 'x'
      ];
    }),
    [0.3, 0.14, 0.12, 0.18, 0.12, 0.14]
  );
}

function renderMetaAdsPage(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, contentWidth: number): void {
  renderPageHeader(doc, pageWidth, 'Meta Ads', COLORS.metaBlue);
  
  doc.y = 120;
  const startX = 40;
  
  const cardWidth = (contentWidth - 80) / 5;
  const cardHeight = 70;
  
  const row1 = [
    { label: 'Impressões', value: formatNumber(data.metaAds.impressoes) },
    { label: 'Alcance', value: formatNumber(data.metaAds.alcance) },
    { label: 'Cliques', value: formatNumber(data.metaAds.cliques) },
    { label: 'CTR', value: formatPercent(data.metaAds.ctr) },
    { label: 'CPC', value: formatCurrency(data.metaAds.cpc) },
  ];
  
  row1.forEach((metric, i) => {
    const x = startX + (i * (cardWidth + 20));
    renderSimpleMetricCard(doc, x, doc.y, cardWidth, cardHeight, metric.label, metric.value, COLORS.metaBlue);
  });
  
  doc.y += cardHeight + 20;
  
  const row2 = [
    { label: 'CPM', value: formatCurrency(data.metaAds.cpm) },
    { label: 'Custo Total', value: formatCurrency(data.metaAds.custo), highlight: true },
    { label: 'Conversões', value: formatNumber(data.metaAds.conversoes), highlight: true },
    { label: 'Custo/Conv.', value: formatCurrency(data.metaAds.custoPorConversao) },
    { label: 'ROAS', value: data.metaAds.roas.toFixed(2).replace('.', ',') + 'x' },
  ];
  
  row2.forEach((metric, i) => {
    const x = startX + (i * (cardWidth + 20));
    if (metric.highlight) {
      renderHighlightMetricCard(doc, x, doc.y, cardWidth, cardHeight, metric.label, metric.value, COLORS.metaBlue);
    } else {
      renderSimpleMetricCard(doc, x, doc.y, cardWidth, cardHeight, metric.label, metric.value, COLORS.metaBlue);
    }
  });
  
  doc.y += cardHeight + 40;
  
  renderSectionTitle(doc, 'Performance por Campanha');
  
  doc.y += 15;
  
  renderModernTable(doc, startX, doc.y, contentWidth,
    ['Campanha', 'Alcance', 'Cliques', 'Custo', 'Conv.'],
    data.metaAds.campanhas.slice(0, 6).map(camp => [
      camp.nome.length > 28 ? camp.nome.substring(0, 28) + '...' : camp.nome,
      formatNumber(camp.alcance),
      formatNumber(camp.cliques),
      formatCurrency(camp.custo),
      formatNumber(camp.conversoes)
    ]),
    [0.36, 0.16, 0.14, 0.2, 0.14]
  );
}

function renderPageHeader(doc: PDFKit.PDFDocument, pageWidth: number, title: string, accentColor: string): void {
  doc.rect(0, 0, pageWidth, 90)
     .fill(COLORS.secondary);
  
  doc.rect(0, 0, 6, 90)
     .fill(accentColor);
  
  doc.rect(0, 85, pageWidth, 5)
     .fill(accentColor);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(24)
     .text(title, 40, 35);
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text('TURBO PARTNERS', pageWidth - 150, 40);
}

function renderSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(14)
     .text(title, 40);
  
  doc.moveTo(40, doc.y + 5)
     .lineTo(140, doc.y + 5)
     .lineWidth(2)
     .strokeColor(COLORS.primary)
     .stroke();
  
  doc.y += 10;
}

function renderBigMetricCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, label: string, value: string, subtitle: string, accentColor: string): void {
  doc.roundedRect(x, y, width, height, 8)
     .fill(COLORS.cardBg);
  
  doc.roundedRect(x, y, width, height, 8)
     .strokeColor(COLORS.cardBorder)
     .stroke();
  
  doc.rect(x, y, 5, height)
     .fill(accentColor);
  
  doc.fillColor(COLORS.textSecondary)
     .font(FONTS.regular)
     .fontSize(11)
     .text(label.toUpperCase(), x + 20, y + 15);
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(28)
     .text(value, x + 20, y + 35);
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text(subtitle, x + 20, y + height - 25);
}

function renderSmallMetricCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, label: string, value: string, variation: { texto: string; cor: string; bgCor: string; positivo: boolean }): void {
  doc.roundedRect(x, y, width, height, 6)
     .fill(COLORS.cardBg);
  
  doc.roundedRect(x, y, width, height, 6)
     .strokeColor(COLORS.cardBorder)
     .stroke();
  
  doc.fillColor(COLORS.textSecondary)
     .font(FONTS.regular)
     .fontSize(9)
     .text(label.toUpperCase(), x + 12, y + 12);
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(18)
     .text(value, x + 12, y + 28);
  
  doc.roundedRect(x + 12, y + height - 25, 50, 18, 3)
     .fill(variation.bgCor);
  
  doc.fillColor(variation.cor)
     .font(FONTS.bold)
     .fontSize(9)
     .text(variation.texto, x + 15, y + height - 21, { width: 44, align: 'center' });
}

function renderMetricCardWithVariation(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, label: string, value: string, variation: { texto: string; cor: string; bgCor: string; positivo: boolean }): void {
  doc.roundedRect(x, y, width, height, 6)
     .fill(COLORS.cardBg);
  
  doc.roundedRect(x, y, width, height, 6)
     .strokeColor(COLORS.cardBorder)
     .stroke();
  
  doc.fillColor(COLORS.textSecondary)
     .font(FONTS.regular)
     .fontSize(10)
     .text(label, x + 15, y + 15);
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(22)
     .text(value, x + 15, y + 32);
  
  doc.roundedRect(x + 15, y + height - 28, 55, 20, 4)
     .fill(variation.bgCor);
  
  doc.fillColor(variation.cor)
     .font(FONTS.bold)
     .fontSize(10)
     .text(variation.texto, x + 18, y + height - 24, { width: 49, align: 'center' });
}

function renderSimpleMetricCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, label: string, value: string, accentColor: string): void {
  doc.roundedRect(x, y, width, height, 6)
     .fill(COLORS.cardBg);
  
  doc.roundedRect(x, y, width, height, 6)
     .strokeColor(COLORS.cardBorder)
     .stroke();
  
  doc.fillColor(COLORS.textSecondary)
     .font(FONTS.regular)
     .fontSize(9)
     .text(label.toUpperCase(), x + 12, y + 12);
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(16)
     .text(value, x + 12, y + 32);
}

function renderHighlightMetricCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, label: string, value: string, accentColor: string): void {
  doc.roundedRect(x, y, width, height, 6)
     .fill(accentColor);
  
  doc.fillColor('rgba(255,255,255,0.7)')
     .font(FONTS.regular)
     .fontSize(9)
     .text(label.toUpperCase(), x + 12, y + 12);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(16)
     .text(value, x + 12, y + 32);
}

function renderComparisonTable(doc: PDFKit.PDFDocument, x: number, y: number, width: number, data: { label: string; atual: number; anterior: number; format: (n: number) => string }[]): void {
  const rowHeight = 35;
  const headerHeight = 30;
  
  doc.roundedRect(x, y, width, headerHeight + (data.length * rowHeight), 6)
     .fill(COLORS.cardBg);
  
  doc.roundedRect(x, y, width, headerHeight + (data.length * rowHeight), 6)
     .strokeColor(COLORS.cardBorder)
     .stroke();
  
  doc.rect(x, y, width, headerHeight)
     .fill(COLORS.secondary);
  
  const cols = [0.3, 0.25, 0.25, 0.2];
  const headers = ['Métrica', 'Semana Atual', 'Semana Anterior', 'Variação'];
  
  let xPos = x;
  headers.forEach((header, i) => {
    doc.fillColor('#FFFFFF')
       .font(FONTS.bold)
       .fontSize(10)
       .text(header, xPos + 15, y + 10, { width: width * cols[i] - 30 });
    xPos += width * cols[i];
  });
  
  data.forEach((row, i) => {
    const rowY = y + headerHeight + (i * rowHeight);
    const variacao = calcularVariacao(row.atual, row.anterior);
    
    if (i % 2 === 1) {
      doc.rect(x + 1, rowY, width - 2, rowHeight)
         .fill('#FFFFFF');
    }
    
    let xPos = x;
    
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(11)
       .text(row.label, xPos + 15, rowY + 12);
    xPos += width * cols[0];
    
    doc.fillColor(COLORS.text)
       .font(FONTS.regular)
       .fontSize(11)
       .text(row.format(row.atual), xPos + 15, rowY + 12);
    xPos += width * cols[1];
    
    doc.fillColor(COLORS.textSecondary)
       .font(FONTS.regular)
       .fontSize(11)
       .text(row.format(row.anterior), xPos + 15, rowY + 12);
    xPos += width * cols[2];
    
    doc.roundedRect(xPos + 10, rowY + 8, 55, 20, 4)
       .fill(variacao.bgCor);
    
    doc.fillColor(variacao.cor)
       .font(FONTS.bold)
       .fontSize(10)
       .text(variacao.texto, xPos + 13, rowY + 13, { width: 49, align: 'center' });
  });
}

function renderHorizontalBar(doc: PDFKit.PDFDocument, x: number, y: number, width: number, data: { label: string; value: number; percent: number; color: string }[]): void {
  const barHeight = 30;
  const totalHeight = 80;
  
  doc.roundedRect(x, y, width, totalHeight, 6)
     .fill(COLORS.cardBg);
  
  doc.roundedRect(x, y, width, totalHeight, 6)
     .strokeColor(COLORS.cardBorder)
     .stroke();
  
  let barX = x + 15;
  const barWidth = width - 30;
  const barY = y + 15;
  
  doc.roundedRect(barX, barY, barWidth, barHeight, 4)
     .fill(COLORS.divider);
  
  let currentX = barX;
  data.forEach((item, i) => {
    const itemWidth = (barWidth * item.percent) / 100;
    if (itemWidth > 0) {
      if (i === 0) {
        doc.roundedRect(currentX, barY, itemWidth, barHeight, 4)
           .fill(item.color);
      } else {
        doc.rect(currentX, barY, itemWidth, barHeight)
           .fill(item.color);
      }
      currentX += itemWidth;
    }
  });
  
  const legendY = y + 55;
  let legendX = x + 15;
  
  data.forEach((item) => {
    doc.circle(legendX + 5, legendY + 5, 5)
       .fill(item.color);
    
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(10)
       .text(item.label, legendX + 15, legendY);
    
    doc.fillColor(COLORS.textSecondary)
       .font(FONTS.regular)
       .fontSize(10)
       .text(`${formatCurrency(item.value)} (${item.percent.toFixed(1)}%)`, legendX + 85, legendY);
    
    legendX += 220;
  });
}

function renderModernTable(doc: PDFKit.PDFDocument, x: number, y: number, width: number, headers: string[], rows: string[][], colWidths: number[]): void {
  const headerHeight = 32;
  const rowHeight = 28;
  const totalHeight = headerHeight + (rows.length * rowHeight);
  
  doc.roundedRect(x, y, width, totalHeight, 6)
     .fill(COLORS.cardBg);
  
  doc.roundedRect(x, y, width, totalHeight, 6)
     .strokeColor(COLORS.cardBorder)
     .stroke();
  
  doc.rect(x, y, width, headerHeight)
     .fill(COLORS.secondary);
  
  let xPos = x;
  headers.forEach((header, i) => {
    doc.fillColor('#FFFFFF')
       .font(FONTS.bold)
       .fontSize(9)
       .text(header, xPos + 10, y + 11, { width: width * colWidths[i] - 20 });
    xPos += width * colWidths[i];
  });
  
  rows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + (rowIndex * rowHeight);
    
    if (rowIndex % 2 === 1) {
      doc.rect(x + 1, rowY, width - 2, rowHeight)
         .fill('#FFFFFF');
    }
    
    let xPos = x;
    row.forEach((cell, colIndex) => {
      doc.fillColor(colIndex === 0 ? COLORS.text : COLORS.textSecondary)
         .font(colIndex === 0 ? FONTS.bold : FONTS.regular)
         .fontSize(9)
         .text(cell, xPos + 10, rowY + 9, { width: width * colWidths[colIndex] - 20 });
      xPos += width * colWidths[colIndex];
    });
  });
  
  doc.y = y + totalHeight + 20;
}

function renderFooters(doc: PDFKit.PDFDocument): void {
  const pageCount = doc.bufferedPageRange().count;
  
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    
    const footerY = doc.page.height - 25;
    
    if (i > 0) {
      doc.moveTo(40, footerY - 10)
         .lineTo(doc.page.width - 40, footerY - 10)
         .lineWidth(0.5)
         .strokeColor(COLORS.divider)
         .stroke();
    }
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(8)
       .text(
         `Turbo Partners | Relatório gerado automaticamente`,
         40,
         footerY
       );
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(8)
       .text(
         `Página ${i + 1} de ${pageCount}`,
         doc.page.width - 100,
         footerY
       );
  }
}
