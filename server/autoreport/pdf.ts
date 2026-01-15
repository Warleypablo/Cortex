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
  dark: '#1E1E2E',
  white: '#FFFFFF',
  gray: '#F5F5F7',
  text: '#1E1E2E',
  textLight: '#6B7280',
  green: '#22C55E',
  red: '#EF4444',
  googleBlue: '#4285F4',
  metaBlue: '#0866FF',
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function calcVariation(atual: number, anterior: number): { text: string; isPositive: boolean } {
  if (anterior === 0) {
    return { text: atual > 0 ? '+100%' : '0%', isPositive: atual >= 0 };
  }
  const variation = ((atual - anterior) / anterior) * 100;
  const sign = variation >= 0 ? '+' : '';
  return { 
    text: `${sign}${variation.toFixed(1).replace('.', ',')}%`,
    isPositive: variation >= 0
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
        margin: 50,
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

      const margin = 50;
      const pageWidth = doc.page.width - (margin * 2);

      drawCoverPage(doc, data, pageWidth, margin);
      
      doc.addPage();
      drawSummaryPage(doc, data, pageWidth, margin);
      
      doc.addPage();
      drawGA4Page(doc, data, pageWidth, margin);
      
      doc.addPage();
      drawGoogleAdsPage(doc, data, pageWidth, margin);
      
      doc.addPage();
      drawMetaAdsPage(doc, data, pageWidth, margin);

      addPageNumbers(doc);
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawCoverPage(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, margin: number): void {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.dark);
  
  doc.rect(0, 0, 8, doc.page.height).fill(COLORS.primary);
  
  doc.fontSize(42).font('Helvetica-Bold')
     .fillColor(COLORS.primary).text('TURBO', margin + 20, 200)
     .fillColor(COLORS.white).text('PARTNERS', margin + 20, 250);
  
  doc.moveTo(margin + 20, 310).lineTo(margin + 120, 310)
     .strokeColor(COLORS.primary).lineWidth(3).stroke();
  
  doc.fontSize(12).font('Helvetica')
     .fillColor(COLORS.primary).text('RELATÓRIO SEMANAL DE PERFORMANCE', margin + 20, 340);
  
  doc.fontSize(28).font('Helvetica-Bold')
     .fillColor(COLORS.white).text(data.cliente.cliente, margin + 20, 380);
  
  const infoY = doc.page.height - 180;
  
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
     .text('PERÍODO', margin + 20, infoY);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.white)
     .text(data.periodos.atual.label, margin + 20, infoY + 15);
  
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
     .text('GESTOR', margin + 20, infoY + 50);
  doc.fontSize(12).font('Helvetica').fillColor(COLORS.white)
     .text(data.cliente.gestor || 'N/A', margin + 20, infoY + 65);
  
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
     .text('SQUAD', margin + 200, infoY + 50);
  doc.fontSize(12).font('Helvetica').fillColor(COLORS.white)
     .text(data.cliente.squad || 'N/A', margin + 200, infoY + 65);
  
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
     .text('GERADO EM', pageWidth - 50, infoY + 50);
  doc.fontSize(12).font('Helvetica').fillColor(COLORS.white)
     .text(today, pageWidth - 50, infoY + 65);
}

function drawSummaryPage(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, margin: number): void {
  drawPageHeader(doc, 'Resumo Executivo', COLORS.primary, margin, pageWidth);
  
  let y = 130;
  
  const investTotal = data.googleAds.custo + data.metaAds.custo;
  const convTotal = data.googleAds.conversoes + data.metaAds.conversoes;
  const receitaVar = calcVariation(data.ga4Atual.receita, data.ga4Anterior.receita);
  
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.textLight)
     .text('INVESTIMENTO TOTAL', margin, y);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.text)
     .text(formatCurrency(investTotal), margin, y + 15);
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
     .text('Google Ads + Meta Ads', margin, y + 50);
  
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.textLight)
     .text('RECEITA TOTAL (GA4)', margin + 260, y);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.green)
     .text(formatCurrency(data.ga4Atual.receita), margin + 260, y + 15);
  doc.fontSize(10).font('Helvetica').fillColor(receitaVar.isPositive ? COLORS.green : COLORS.red)
     .text(receitaVar.text + ' vs semana anterior', margin + 260, y + 50);
  
  y += 100;
  
  drawSectionTitle(doc, 'Métricas Principais', margin, y);
  y += 30;
  
  const metrics = [
    { label: 'Sessões', value: formatNumber(data.ga4Atual.sessoes), var: calcVariation(data.ga4Atual.sessoes, data.ga4Anterior.sessoes) },
    { label: 'Conversões Totais', value: formatNumber(convTotal), var: null },
    { label: 'Custo/Conversão', value: formatCurrency(convTotal > 0 ? investTotal / convTotal : 0), var: null },
  ];
  
  const cardWidth = (pageWidth - 40) / 3;
  metrics.forEach((m, i) => {
    const x = margin + (i * (cardWidth + 20));
    drawMetricCard(doc, x, y, cardWidth, 70, m.label, m.value, m.var);
  });
  
  y += 100;
  
  drawSectionTitle(doc, 'Comparativo Semanal', margin, y);
  y += 30;
  
  const compHeaders = ['Métrica', 'Semana Atual', 'Semana Anterior', 'Variação'];
  const compData = [
    ['Sessões', formatNumber(data.ga4Atual.sessoes), formatNumber(data.ga4Anterior.sessoes), calcVariation(data.ga4Atual.sessoes, data.ga4Anterior.sessoes)],
    ['Usuários', formatNumber(data.ga4Atual.usuarios), formatNumber(data.ga4Anterior.usuarios), calcVariation(data.ga4Atual.usuarios, data.ga4Anterior.usuarios)],
    ['Conversões', formatNumber(data.ga4Atual.conversoes), formatNumber(data.ga4Anterior.conversoes), calcVariation(data.ga4Atual.conversoes, data.ga4Anterior.conversoes)],
    ['Receita', formatCurrency(data.ga4Atual.receita), formatCurrency(data.ga4Anterior.receita), calcVariation(data.ga4Atual.receita, data.ga4Anterior.receita)],
  ];
  
  drawComparisonTable(doc, margin, y, pageWidth, compHeaders, compData);
  
  y += 180;
  
  drawSectionTitle(doc, 'Distribuição de Investimento', margin, y);
  y += 30;
  
  const googlePct = investTotal > 0 ? (data.googleAds.custo / investTotal) * 100 : 0;
  const metaPct = investTotal > 0 ? (data.metaAds.custo / investTotal) * 100 : 0;
  
  drawInvestmentBar(doc, margin, y, pageWidth, [
    { label: 'Google Ads', value: data.googleAds.custo, pct: googlePct, color: COLORS.googleBlue },
    { label: 'Meta Ads', value: data.metaAds.custo, pct: metaPct, color: COLORS.metaBlue },
  ]);
}

function drawGA4Page(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, margin: number): void {
  drawPageHeader(doc, 'Google Analytics 4', COLORS.primary, margin, pageWidth);
  
  let y = 130;
  
  const metrics = [
    { label: 'Sessões', value: formatNumber(data.ga4Atual.sessoes), var: calcVariation(data.ga4Atual.sessoes, data.ga4Anterior.sessoes) },
    { label: 'Usuários', value: formatNumber(data.ga4Atual.usuarios), var: calcVariation(data.ga4Atual.usuarios, data.ga4Anterior.usuarios) },
    { label: 'Novos Usuários', value: formatNumber(data.ga4Atual.novoUsuarios), var: calcVariation(data.ga4Atual.novoUsuarios, data.ga4Anterior.novoUsuarios) },
    { label: 'Taxa de Rejeição', value: formatPercent(data.ga4Atual.taxaRejeicao * 100), var: calcVariation(data.ga4Anterior.taxaRejeicao, data.ga4Atual.taxaRejeicao) },
    { label: 'Duração Média', value: formatDuration(data.ga4Atual.duracaoMedia), var: calcVariation(data.ga4Atual.duracaoMedia, data.ga4Anterior.duracaoMedia) },
    { label: 'Conversões', value: formatNumber(data.ga4Atual.conversoes), var: calcVariation(data.ga4Atual.conversoes, data.ga4Anterior.conversoes) },
  ];
  
  const cardWidth = (pageWidth - 40) / 3;
  metrics.forEach((m, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = margin + (col * (cardWidth + 20));
    const cardY = y + (row * 85);
    drawMetricCard(doc, x, cardY, cardWidth, 70, m.label, m.value, m.var);
  });
  
  y += 200;
  
  drawSectionTitle(doc, 'Receita', margin, y);
  y += 30;
  
  const receitaVar = calcVariation(data.ga4Atual.receita, data.ga4Anterior.receita);
  doc.fontSize(32).font('Helvetica-Bold').fillColor(COLORS.green)
     .text(formatCurrency(data.ga4Atual.receita), margin, y);
  doc.fontSize(12).font('Helvetica').fillColor(receitaVar.isPositive ? COLORS.green : COLORS.red)
     .text(`${receitaVar.text} vs semana anterior (${formatCurrency(data.ga4Anterior.receita)})`, margin, y + 40);
  
  y += 90;
  
  drawSectionTitle(doc, 'Top Canais de Aquisição', margin, y);
  y += 30;
  
  const channelHeaders = ['Canal', 'Sessões', 'Conversões'];
  const channelData = data.ga4Atual.canais.slice(0, 5).map(c => [
    c.nome || 'Direto',
    formatNumber(c.sessoes),
    formatNumber(c.conversoes)
  ]);
  
  drawSimpleTable(doc, margin, y, pageWidth, channelHeaders, channelData, [0.5, 0.25, 0.25]);
}

function drawGoogleAdsPage(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, margin: number): void {
  drawPageHeader(doc, 'Google Ads', COLORS.googleBlue, margin, pageWidth);
  
  let y = 130;
  
  const metrics = [
    { label: 'Impressões', value: formatNumber(data.googleAds.impressoes) },
    { label: 'Cliques', value: formatNumber(data.googleAds.cliques) },
    { label: 'CTR', value: formatPercent(data.googleAds.ctr) },
    { label: 'CPC Médio', value: formatCurrency(data.googleAds.cpc) },
    { label: 'Custo Total', value: formatCurrency(data.googleAds.custo), highlight: true },
    { label: 'Conversões', value: formatNumber(data.googleAds.conversoes), highlight: true },
    { label: 'Custo/Conversão', value: formatCurrency(data.googleAds.custoPorConversao) },
    { label: 'ROAS', value: data.googleAds.roas.toFixed(2).replace('.', ',') + 'x' },
  ];
  
  const cardWidth = (pageWidth - 60) / 4;
  metrics.forEach((m, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = margin + (col * (cardWidth + 20));
    const cardY = y + (row * 80);
    drawSimpleCard(doc, x, cardY, cardWidth, 65, m.label, m.value, m.highlight ? COLORS.googleBlue : undefined);
  });
  
  y += 190;
  
  drawSectionTitle(doc, 'Top Campanhas', margin, y);
  y += 30;
  
  const campHeaders = ['Campanha', 'Impressões', 'Cliques', 'Custo', 'Conv.'];
  const campData = data.googleAds.campanhas.slice(0, 5).map(c => [
    c.nome.length > 25 ? c.nome.substring(0, 25) + '...' : c.nome,
    formatNumber(c.impressoes),
    formatNumber(c.cliques),
    formatCurrency(c.custo),
    formatNumber(c.conversoes)
  ]);
  
  drawSimpleTable(doc, margin, y, pageWidth, campHeaders, campData, [0.35, 0.16, 0.14, 0.2, 0.15]);
}

function drawMetaAdsPage(doc: PDFKit.PDFDocument, data: ReportData, pageWidth: number, margin: number): void {
  drawPageHeader(doc, 'Meta Ads', COLORS.metaBlue, margin, pageWidth);
  
  let y = 130;
  
  const metrics = [
    { label: 'Impressões', value: formatNumber(data.metaAds.impressoes) },
    { label: 'Alcance', value: formatNumber(data.metaAds.alcance) },
    { label: 'Cliques', value: formatNumber(data.metaAds.cliques) },
    { label: 'CTR', value: formatPercent(data.metaAds.ctr) },
    { label: 'CPC', value: formatCurrency(data.metaAds.cpc) },
    { label: 'CPM', value: formatCurrency(data.metaAds.cpm) },
    { label: 'Custo Total', value: formatCurrency(data.metaAds.custo), highlight: true },
    { label: 'Conversões', value: formatNumber(data.metaAds.conversoes), highlight: true },
    { label: 'Custo/Conv.', value: formatCurrency(data.metaAds.custoPorConversao) },
    { label: 'ROAS', value: data.metaAds.roas.toFixed(2).replace('.', ',') + 'x' },
  ];
  
  const cardWidth = (pageWidth - 80) / 5;
  metrics.forEach((m, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = margin + (col * (cardWidth + 20));
    const cardY = y + (row * 75);
    drawSimpleCard(doc, x, cardY, cardWidth, 60, m.label, m.value, m.highlight ? COLORS.metaBlue : undefined);
  });
  
  y += 180;
  
  drawSectionTitle(doc, 'Top Campanhas', margin, y);
  y += 30;
  
  const campHeaders = ['Campanha', 'Alcance', 'Cliques', 'Custo', 'Conv.'];
  const campData = data.metaAds.campanhas.slice(0, 5).map(c => [
    c.nome.length > 25 ? c.nome.substring(0, 25) + '...' : c.nome,
    formatNumber(c.alcance),
    formatNumber(c.cliques),
    formatCurrency(c.custo),
    formatNumber(c.conversoes)
  ]);
  
  drawSimpleTable(doc, margin, y, pageWidth, campHeaders, campData, [0.35, 0.16, 0.14, 0.2, 0.15]);
}

function drawPageHeader(doc: PDFKit.PDFDocument, title: string, color: string, margin: number, pageWidth: number): void {
  doc.rect(0, 0, doc.page.width, 100).fill(COLORS.dark);
  doc.rect(0, 95, doc.page.width, 5).fill(color);
  
  doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.white)
     .text(title, margin, 40);
  
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
     .text('TURBO PARTNERS', doc.page.width - margin - 100, 45);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number): void {
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.text)
     .text(title, x, y);
  doc.moveTo(x, y + 18).lineTo(x + 80, y + 18)
     .strokeColor(COLORS.primary).lineWidth(2).stroke();
}

function drawMetricCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, label: string, value: string, variation: { text: string; isPositive: boolean } | null): void {
  doc.rect(x, y, width, height).fill(COLORS.gray);
  doc.rect(x, y, width, height).strokeColor('#E5E5E5').stroke();
  
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
     .text(label, x + 12, y + 12, { width: width - 24 });
  
  doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.text)
     .text(value, x + 12, y + 28, { width: width - 24 });
  
  if (variation) {
    doc.fontSize(11).font('Helvetica-Bold')
       .fillColor(variation.isPositive ? COLORS.green : COLORS.red)
       .text(variation.text, x + 12, y + 52, { width: width - 24 });
  }
}

function drawSimpleCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, label: string, value: string, highlightColor?: string): void {
  if (highlightColor) {
    doc.rect(x, y, width, height).fill(highlightColor);
    doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.8)')
       .text(label, x + 10, y + 10, { width: width - 20 });
    doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.white)
       .text(value, x + 10, y + 28, { width: width - 20 });
  } else {
    doc.rect(x, y, width, height).fill(COLORS.gray);
    doc.rect(x, y, width, height).strokeColor('#E5E5E5').stroke();
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight)
       .text(label, x + 10, y + 10, { width: width - 20 });
    doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.text)
       .text(value, x + 10, y + 28, { width: width - 20 });
  }
}

function drawComparisonTable(doc: PDFKit.PDFDocument, x: number, y: number, width: number, headers: string[], data: any[][]): void {
  const rowHeight = 30;
  const headerHeight = 35;
  
  doc.rect(x, y, width, headerHeight).fill(COLORS.dark);
  
  const cols = [0.28, 0.24, 0.24, 0.24];
  let xPos = x;
  headers.forEach((h, i) => {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.white)
       .text(h, xPos + 10, y + 12, { width: width * cols[i] - 20 });
    xPos += width * cols[i];
  });
  
  data.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + (rowIndex * rowHeight);
    const bgColor = rowIndex % 2 === 0 ? COLORS.gray : COLORS.white;
    doc.rect(x, rowY, width, rowHeight).fill(bgColor);
    
    let xPos = x;
    row.forEach((cell, colIndex) => {
      if (colIndex === 3 && typeof cell === 'object') {
        doc.fontSize(10).font('Helvetica-Bold')
           .fillColor(cell.isPositive ? COLORS.green : COLORS.red)
           .text(cell.text, xPos + 10, rowY + 10, { width: width * cols[colIndex] - 20 });
      } else {
        doc.fontSize(10).font(colIndex === 0 ? 'Helvetica-Bold' : 'Helvetica')
           .fillColor(COLORS.text)
           .text(String(cell), xPos + 10, rowY + 10, { width: width * cols[colIndex] - 20 });
      }
      xPos += width * cols[colIndex];
    });
  });
}

function drawSimpleTable(doc: PDFKit.PDFDocument, x: number, y: number, width: number, headers: string[], data: string[][], colWidths: number[]): void {
  const rowHeight = 28;
  const headerHeight = 32;
  
  doc.rect(x, y, width, headerHeight).fill(COLORS.dark);
  
  let xPos = x;
  headers.forEach((h, i) => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white)
       .text(h, xPos + 8, y + 10, { width: width * colWidths[i] - 16 });
    xPos += width * colWidths[i];
  });
  
  data.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + (rowIndex * rowHeight);
    const bgColor = rowIndex % 2 === 0 ? COLORS.gray : COLORS.white;
    doc.rect(x, rowY, width, rowHeight).fill(bgColor);
    
    let xPos = x;
    row.forEach((cell, colIndex) => {
      doc.fontSize(9).font(colIndex === 0 ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(COLORS.text)
         .text(cell, xPos + 8, rowY + 9, { width: width * colWidths[colIndex] - 16 });
      xPos += width * colWidths[colIndex];
    });
  });
}

function drawInvestmentBar(doc: PDFKit.PDFDocument, x: number, y: number, width: number, data: { label: string; value: number; pct: number; color: string }[]): void {
  const barHeight = 25;
  
  doc.rect(x, y, width, barHeight).fill('#E5E5E5');
  
  let currentX = x;
  data.forEach((item) => {
    const itemWidth = (width * item.pct) / 100;
    if (itemWidth > 0) {
      doc.rect(currentX, y, itemWidth, barHeight).fill(item.color);
      currentX += itemWidth;
    }
  });
  
  let legendX = x;
  data.forEach((item) => {
    doc.circle(legendX + 6, y + 45, 5).fill(item.color);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text)
       .text(item.label, legendX + 16, y + 40);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
       .text(`${formatCurrency(item.value)} (${item.pct.toFixed(0)}%)`, legendX + 16, y + 55);
    legendX += 200;
  });
}

function addPageNumbers(doc: PDFKit.PDFDocument): void {
  const pageCount = doc.bufferedPageRange().count;
  
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    
    if (i === 0) continue;
    
    const footerY = doc.page.height - 30;
    
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.textLight)
       .text('Turbo Partners | Relatório Semanal', 50, footerY);
    
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.textLight)
       .text(`Página ${i + 1} de ${pageCount}`, doc.page.width - 100, footerY);
  }
}
