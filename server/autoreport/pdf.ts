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
  secondary: '#1E1E1E',
  background: '#FFFFFF',
  cardBg: '#F8F9FA',
  text: '#1E1E1E',
  textMuted: '#6C757D',
  success: '#28A745',
  danger: '#DC3545',
  border: '#DEE2E6',
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function calcularVariacao(atual: number, anterior: number): { texto: string; cor: string } {
  if (anterior === 0) {
    return { texto: atual > 0 ? '+100%' : '0%', cor: atual > 0 ? COLORS.success : COLORS.textMuted };
  }
  const variacao = ((atual - anterior) / anterior) * 100;
  const sinal = variacao >= 0 ? '+' : '';
  return { 
    texto: `${sinal}${variacao.toFixed(1).replace('.', ',')}%`,
    cor: variacao >= 0 ? COLORS.success : COLORS.danger
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
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
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
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  
  renderHeader(doc, data, pageWidth);
  renderOverview(doc, data, pageWidth);
  
  doc.addPage();
  renderGA4Section(doc, data, pageWidth);
  
  doc.addPage();
  renderGoogleAdsSection(doc, data, pageWidth);
  
  doc.addPage();
  renderMetaAdsSection(doc, data, pageWidth);
  
  renderFooter(doc);
}

function renderHeader(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number): void {
  doc.rect(0, 0, doc.page.width, 120)
     .fill(COLORS.secondary);
  
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(28)
     .text('TURBO', 40, 35);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.bold)
     .fontSize(28)
     .text('PARTNERS', 130, 35);
  
  doc.fillColor('#FFFFFF')
     .font(FONTS.regular)
     .fontSize(14)
     .text('Relatório Semanal de Performance', 40, 75);
  
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(20)
     .text(data.cliente.cliente, 40, 95);
  
  const dataRelatorio = new Date().toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  doc.fillColor('#FFFFFF')
     .font(FONTS.regular)
     .fontSize(10)
     .text(dataRelatorio, doc.page.width - 150, 40, { width: 110, align: 'right' });
  
  doc.y = 140;
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text(`Período: ${data.periodos.atual.label}`, 40);
  
  doc.fillColor(COLORS.textMuted)
     .text(`Gestor: ${data.cliente.gestor} | Squad: ${data.cliente.squad}`, 40);
  
  doc.y = 180;
}

function renderOverview(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number): void {
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(16)
     .text('Visão Geral', 40);
  
  doc.y += 15;
  
  const cardWidth = (pageWidth - 30) / 4;
  const cardHeight = 70;
  const startX = 40;
  const startY = doc.y;
  
  const investimentoTotal = data.googleAds.custo + data.metaAds.custo;
  const conversaoTotal = data.googleAds.conversoes + data.metaAds.conversoes;
  
  const overviewCards = [
    { label: 'Sessões', value: formatNumber(data.ga4Atual.sessoes), color: COLORS.primary },
    { label: 'Conversões', value: formatNumber(conversaoTotal), color: COLORS.success },
    { label: 'Investimento', value: formatCurrency(investimentoTotal), color: COLORS.secondary },
    { label: 'Receita GA4', value: formatCurrency(data.ga4Atual.receita), color: COLORS.success },
  ];
  
  overviewCards.forEach((card, i) => {
    const x = startX + (i * (cardWidth + 10));
    
    doc.roundedRect(x, startY, cardWidth, cardHeight, 5)
       .fill(COLORS.cardBg);
    
    doc.roundedRect(x, startY, cardWidth, cardHeight, 5)
       .stroke(COLORS.border);
    
    doc.rect(x, startY, 4, cardHeight)
       .fill(card.color);
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(9)
       .text(card.label, x + 12, startY + 12, { width: cardWidth - 20 });
    
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(14)
       .text(card.value, x + 12, startY + 30, { width: cardWidth - 20 });
  });
  
  doc.y = startY + cardHeight + 30;
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(14)
     .text('Comparativo Semanal', 40);
  
  doc.y += 10;
  
  const compY = doc.y;
  const compWidth = (pageWidth - 20) / 3;
  
  const comparativos = [
    { 
      label: 'Sessões', 
      atual: data.ga4Atual.sessoes, 
      anterior: data.ga4Anterior.sessoes,
      format: formatNumber
    },
    { 
      label: 'Conversões', 
      atual: data.ga4Atual.conversoes, 
      anterior: data.ga4Anterior.conversoes,
      format: formatNumber
    },
    { 
      label: 'Receita', 
      atual: data.ga4Atual.receita, 
      anterior: data.ga4Anterior.receita,
      format: formatCurrency
    },
  ];
  
  comparativos.forEach((comp, i) => {
    const x = 40 + (i * (compWidth + 10));
    const variacao = calcularVariacao(comp.atual, comp.anterior);
    
    doc.roundedRect(x, compY, compWidth, 55, 5)
       .fill(COLORS.cardBg);
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(9)
       .text(comp.label, x + 10, compY + 8);
    
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(12)
       .text(comp.format(comp.atual), x + 10, compY + 22);
    
    doc.fillColor(variacao.cor)
       .font(FONTS.bold)
       .fontSize(11)
       .text(variacao.texto, x + 10, compY + 38);
  });
  
  doc.y = compY + 75;
}

function renderGA4Section(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number): void {
  doc.fillColor(COLORS.primary)
     .font(FONTS.bold)
     .fontSize(18)
     .text('Google Analytics 4', 40, 50);
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text(`Período: ${data.periodos.atual.label}`, 40);
  
  doc.y += 20;
  
  const metricsY = doc.y;
  const cardWidth = (pageWidth - 20) / 3;
  const cardHeight = 60;
  
  const ga4Metrics = [
    { label: 'Sessões', value: formatNumber(data.ga4Atual.sessoes), 
      var: calcularVariacao(data.ga4Atual.sessoes, data.ga4Anterior.sessoes) },
    { label: 'Usuários', value: formatNumber(data.ga4Atual.usuarios),
      var: calcularVariacao(data.ga4Atual.usuarios, data.ga4Anterior.usuarios) },
    { label: 'Novos Usuários', value: formatNumber(data.ga4Atual.novoUsuarios),
      var: calcularVariacao(data.ga4Atual.novoUsuarios, data.ga4Anterior.novoUsuarios) },
    { label: 'Taxa de Rejeição', value: formatPercent(data.ga4Atual.taxaRejeicao * 100),
      var: calcularVariacao(data.ga4Atual.taxaRejeicao, data.ga4Anterior.taxaRejeicao) },
    { label: 'Duração Média', value: formatDuration(data.ga4Atual.duracaoMedia),
      var: calcularVariacao(data.ga4Atual.duracaoMedia, data.ga4Anterior.duracaoMedia) },
    { label: 'Conversões', value: formatNumber(data.ga4Atual.conversoes),
      var: calcularVariacao(data.ga4Atual.conversoes, data.ga4Anterior.conversoes) },
  ];
  
  ga4Metrics.forEach((metric, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 40 + (col * (cardWidth + 10));
    const y = metricsY + (row * (cardHeight + 10));
    
    doc.roundedRect(x, y, cardWidth, cardHeight, 5)
       .fill(COLORS.cardBg);
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(9)
       .text(metric.label, x + 10, y + 10);
    
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(14)
       .text(metric.value, x + 10, y + 25);
    
    doc.fillColor(metric.var.cor)
       .font(FONTS.regular)
       .fontSize(10)
       .text(metric.var.texto, x + 10, y + 42);
  });
  
  doc.y = metricsY + (2 * (cardHeight + 10)) + 30;
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(14)
     .text('Top Canais de Tráfego', 40);
  
  doc.y += 15;
  
  renderTable(doc, pageWidth, 
    ['Canal', 'Sessões', 'Conversões'],
    data.ga4Atual.canais.slice(0, 5).map(canal => [
      canal.nome,
      formatNumber(canal.sessoes),
      formatNumber(canal.conversoes)
    ]),
    [0.5, 0.25, 0.25]
  );
}

function renderGoogleAdsSection(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number): void {
  doc.fillColor('#4285F4')
     .font(FONTS.bold)
     .fontSize(18)
     .text('Google Ads', 40, 50);
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text(`Período: ${data.periodos.atual.label}`, 40);
  
  doc.y += 20;
  
  const metricsY = doc.y;
  const cardWidth = (pageWidth - 30) / 4;
  const cardHeight = 55;
  
  const gadsMetrics = [
    { label: 'Impressões', value: formatNumber(data.googleAds.impressoes) },
    { label: 'Cliques', value: formatNumber(data.googleAds.cliques) },
    { label: 'CTR', value: formatPercent(data.googleAds.ctr) },
    { label: 'CPC Médio', value: formatCurrency(data.googleAds.cpc) },
    { label: 'Custo Total', value: formatCurrency(data.googleAds.custo) },
    { label: 'Conversões', value: formatNumber(data.googleAds.conversoes) },
    { label: 'Custo/Conv.', value: formatCurrency(data.googleAds.custoPorConversao) },
    { label: 'ROAS', value: data.googleAds.roas.toFixed(2).replace('.', ',') + 'x' },
  ];
  
  gadsMetrics.forEach((metric, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = 40 + (col * (cardWidth + 10));
    const y = metricsY + (row * (cardHeight + 10));
    
    doc.roundedRect(x, y, cardWidth, cardHeight, 5)
       .fill(COLORS.cardBg);
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(8)
       .text(metric.label, x + 8, y + 10);
    
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(12)
       .text(metric.value, x + 8, y + 28);
  });
  
  doc.y = metricsY + (2 * (cardHeight + 10)) + 30;
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(14)
     .text('Top Campanhas', 40);
  
  doc.y += 15;
  
  renderTable(doc, pageWidth,
    ['Campanha', 'Impressões', 'Cliques', 'Custo', 'Conv.'],
    data.googleAds.campanhas.slice(0, 5).map(camp => [
      camp.nome.length > 30 ? camp.nome.substring(0, 30) + '...' : camp.nome,
      formatNumber(camp.impressoes),
      formatNumber(camp.cliques),
      formatCurrency(camp.custo),
      formatNumber(camp.conversoes)
    ]),
    [0.35, 0.17, 0.13, 0.2, 0.15]
  );
}

function renderMetaAdsSection(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number): void {
  doc.fillColor('#1877F2')
     .font(FONTS.bold)
     .fontSize(18)
     .text('Meta Ads (Facebook / Instagram)', 40, 50);
  
  doc.fillColor(COLORS.textMuted)
     .font(FONTS.regular)
     .fontSize(10)
     .text(`Período: ${data.periodos.atual.label}`, 40);
  
  doc.y += 20;
  
  const metricsY = doc.y;
  const cardWidth = (pageWidth - 40) / 5;
  const cardHeight = 50;
  
  const metaMetrics = [
    { label: 'Impressões', value: formatNumber(data.metaAds.impressoes) },
    { label: 'Alcance', value: formatNumber(data.metaAds.alcance) },
    { label: 'Cliques', value: formatNumber(data.metaAds.cliques) },
    { label: 'CTR', value: formatPercent(data.metaAds.ctr) },
    { label: 'CPC', value: formatCurrency(data.metaAds.cpc) },
    { label: 'CPM', value: formatCurrency(data.metaAds.cpm) },
    { label: 'Custo Total', value: formatCurrency(data.metaAds.custo) },
    { label: 'Conversões', value: formatNumber(data.metaAds.conversoes) },
    { label: 'Custo/Conv.', value: formatCurrency(data.metaAds.custoPorConversao) },
    { label: 'ROAS', value: data.metaAds.roas.toFixed(2).replace('.', ',') + 'x' },
  ];
  
  metaMetrics.forEach((metric, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = 40 + (col * (cardWidth + 10));
    const y = metricsY + (row * (cardHeight + 8));
    
    doc.roundedRect(x, y, cardWidth, cardHeight, 4)
       .fill(COLORS.cardBg);
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(7)
       .text(metric.label, x + 6, y + 8);
    
    doc.fillColor(COLORS.text)
       .font(FONTS.bold)
       .fontSize(10)
       .text(metric.value, x + 6, y + 24);
  });
  
  doc.y = metricsY + (2 * (cardHeight + 8)) + 25;
  
  doc.fillColor(COLORS.text)
     .font(FONTS.bold)
     .fontSize(14)
     .text('Top Campanhas', 40);
  
  doc.y += 15;
  
  renderTable(doc, pageWidth,
    ['Campanha', 'Alcance', 'Cliques', 'Custo', 'Conv.'],
    data.metaAds.campanhas.slice(0, 5).map(camp => [
      camp.nome.length > 28 ? camp.nome.substring(0, 28) + '...' : camp.nome,
      formatNumber(camp.alcance),
      formatNumber(camp.cliques),
      formatCurrency(camp.custo),
      formatNumber(camp.conversoes)
    ]),
    [0.35, 0.17, 0.13, 0.2, 0.15]
  );
}

function renderTable(
  doc: PDFKit.PDFDocument, 
  pageWidth: number,
  headers: string[], 
  rows: string[][],
  colWidths: number[]
): void {
  const tableWidth = pageWidth;
  const rowHeight = 24;
  const startX = 40;
  const startY = doc.y;
  
  doc.rect(startX, startY, tableWidth, rowHeight)
     .fill(COLORS.secondary);
  
  let xPos = startX;
  headers.forEach((header, i) => {
    const colWidth = tableWidth * colWidths[i];
    doc.fillColor('#FFFFFF')
       .font(FONTS.bold)
       .fontSize(9)
       .text(header, xPos + 8, startY + 7, { width: colWidth - 16 });
    xPos += colWidth;
  });
  
  rows.forEach((row, rowIndex) => {
    const y = startY + rowHeight + (rowIndex * rowHeight);
    const bgColor = rowIndex % 2 === 0 ? COLORS.background : COLORS.cardBg;
    
    doc.rect(startX, y, tableWidth, rowHeight)
       .fill(bgColor);
    
    doc.rect(startX, y, tableWidth, rowHeight)
       .stroke(COLORS.border);
    
    let xPos = startX;
    row.forEach((cell, colIndex) => {
      const colWidth = tableWidth * colWidths[colIndex];
      doc.fillColor(COLORS.text)
         .font(FONTS.regular)
         .fontSize(8)
         .text(cell, xPos + 8, y + 7, { width: colWidth - 16 });
      xPos += colWidth;
    });
  });
  
  doc.y = startY + rowHeight + (rows.length * rowHeight) + 20;
}

function renderFooter(doc: PDFKit.PDFDocument): void {
  const pageCount = doc.bufferedPageRange().count;
  
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    
    const footerY = doc.page.height - 30;
    
    doc.fillColor(COLORS.textMuted)
       .font(FONTS.regular)
       .fontSize(8)
       .text(
         `Turbo Partners | Relatório gerado automaticamente | Página ${i + 1} de ${pageCount}`,
         40,
         footerY,
         { align: 'center', width: doc.page.width - 80 }
       );
  }
}
