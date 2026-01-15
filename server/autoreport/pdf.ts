import puppeteer from 'puppeteer';
import type { 
  AutoReportCliente, 
  MetricasGA4, 
  MetricasGoogleAds, 
  MetricasMetaAds,
  PeriodoReferencia 
} from './types';

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

function calcVariation(atual: number, anterior: number): { value: number; text: string; isPositive: boolean } {
  if (anterior === 0) {
    return { value: atual > 0 ? 100 : 0, text: atual > 0 ? '+100%' : '0%', isPositive: atual >= 0 };
  }
  const variation = ((atual - anterior) / anterior) * 100;
  const sign = variation >= 0 ? '+' : '';
  return { 
    value: variation,
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
  const html = generateReportHtml(data);
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const fileName = `Relatorio_${data.cliente.cliente.replace(/\s+/g, '_')}_${dateStr}.pdf`;
    
    return { buffer: Buffer.from(pdfBuffer), fileName };
  } finally {
    await browser.close();
  }
}

function generateReportHtml(data: ReportData): string {
  const investTotal = data.googleAds.custo + data.metaAds.custo;
  const convTotal = data.googleAds.conversoes + data.metaAds.conversoes;
  const receitaVar = calcVariation(data.ga4Atual.receita, data.ga4Anterior.receita);
  const sessoesVar = calcVariation(data.ga4Atual.sessoes, data.ga4Anterior.sessoes);
  const usuariosVar = calcVariation(data.ga4Atual.usuarios, data.ga4Anterior.usuarios);
  const convVar = calcVariation(data.ga4Atual.conversoes, data.ga4Anterior.conversoes);
  
  const googlePct = investTotal > 0 ? (data.googleAds.custo / investTotal) * 100 : 50;
  const metaPct = investTotal > 0 ? (data.metaAds.custo / investTotal) * 100 : 50;
  
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório - ${data.cliente.cliente}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0a0a;
      color: #ffffff;
      line-height: 1.5;
    }
    
    @page {
      size: A4;
      margin: 0;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 0;
      background: #0a0a0a;
      page-break-after: always;
      position: relative;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    /* Page Break Control */
    .section,
    .hero-stats,
    .hero-stat,
    .metrics-grid,
    .metric-card,
    .donut-container,
    .comparison-chart,
    .chart-row,
    .kpi-visual-grid,
    .kpi-visual-card,
    .sparkline-row,
    .gauge-grid,
    .gauge-card,
    .data-table,
    table,
    thead,
    tbody tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .section-title {
      page-break-after: avoid;
      break-after: avoid;
    }
    
    /* Prevent orphaned titles */
    h1, h2, h3, .section-title {
      page-break-after: avoid;
      break-after: avoid;
    }
    
    /* Cover Page */
    .cover {
      background: linear-gradient(160deg, #0a0a0a 0%, #111111 40%, #0a0a0a 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 0;
    }
    
    .cover-accent {
      position: absolute;
      top: 0;
      left: 0;
      width: 6px;
      height: 100%;
      background: linear-gradient(180deg, #00D4FF 0%, #0099FF 50%, #0066FF 100%);
    }
    
    .cover-pattern {
      position: absolute;
      top: 0;
      right: 0;
      width: 60%;
      height: 100%;
      background: 
        radial-gradient(ellipse at 90% 10%, rgba(0, 212, 255, 0.15) 0%, transparent 40%),
        radial-gradient(ellipse at 70% 90%, rgba(0, 153, 255, 0.08) 0%, transparent 35%),
        radial-gradient(ellipse at 50% 50%, rgba(0, 102, 255, 0.05) 0%, transparent 50%);
    }
    
    .cover-glow {
      position: absolute;
      top: 30%;
      right: 10%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 70%);
      filter: blur(60px);
    }
    
    .cover-content {
      position: relative;
      z-index: 1;
      padding: 70px 55px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .logo {
      margin-bottom: 80px;
    }
    
    .logo-text {
      font-size: 48px;
      font-weight: 800;
      letter-spacing: -2px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-turbo {
      color: #00D4FF;
      text-shadow: 0 0 40px rgba(0, 212, 255, 0.4);
    }
    
    .logo-partners {
      color: white;
      font-weight: 600;
    }
    
    .cover-divider {
      width: 100px;
      height: 5px;
      background: linear-gradient(90deg, #00D4FF, #0099FF, #0066FF);
      margin: 40px 0;
      border-radius: 3px;
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
    }
    
    .cover-subtitle {
      font-size: 14px;
      font-weight: 600;
      color: #00D4FF;
      text-transform: uppercase;
      letter-spacing: 4px;
      margin-bottom: 16px;
    }
    
    .cover-title {
      font-size: 42px;
      font-weight: 700;
      color: white;
      line-height: 1.15;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    
    .cover-footer {
      position: relative;
      z-index: 1;
      padding: 45px 55px;
      background: linear-gradient(90deg, rgba(0, 212, 255, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%);
      border-top: 1px solid rgba(0, 212, 255, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .cover-info {
      display: flex;
      gap: 60px;
    }
    
    .info-block {
      color: white;
    }
    
    .info-label {
      font-size: 10px;
      font-weight: 600;
      color: #00D4FF;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
    }
    
    .info-value {
      font-size: 15px;
      font-weight: 600;
      color: white;
    }
    
    /* Content Pages */
    .content-page {
      padding: 0;
      background: #0a0a0a;
    }
    
    .page-header {
      background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%);
      padding: 35px 45px;
      position: relative;
      border-bottom: 1px solid rgba(0, 212, 255, 0.2);
    }
    
    .header-accent {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
    }
    
    .header-accent.orange { background: linear-gradient(90deg, #00D4FF, #0099FF); }
    .header-accent.blue { background: linear-gradient(90deg, #4285F4, #5A95F5); }
    .header-accent.meta { background: linear-gradient(90deg, #0084FF, #00A3FF); }
    
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
    }
    
    .page-brand {
      font-size: 11px;
      font-weight: 600;
      color: #00D4FF;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    
    .page-content {
      padding: 25px 40px 30px;
    }
    
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .section:last-child {
      margin-bottom: 0;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #00D4FF;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(0, 212, 255, 0.3) 0%, transparent 100%);
    }
    
    /* Metric Cards */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .metrics-grid-4 {
      grid-template-columns: repeat(4, 1fr);
    }
    
    .metric-card {
      background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px;
      position: relative;
      overflow: hidden;
    }
    
    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.3), transparent);
    }
    
    .metric-card.highlight {
      background: linear-gradient(135deg, #00D4FF 0%, #0099FF 100%);
      border: none;
    }
    
    .metric-card.highlight .metric-label {
      color: rgba(255, 255, 255, 0.9);
    }
    
    .metric-card.highlight .metric-value {
      color: white;
    }
    
    .metric-card.google {
      background: linear-gradient(135deg, #4285F4 0%, #3367D6 100%);
      border: none;
    }
    
    .metric-card.meta {
      background: linear-gradient(135deg, #0084FF 0%, #0066CC 100%);
      border: none;
    }
    
    .metric-card.google .metric-label,
    .metric-card.google .metric-value,
    .metric-card.meta .metric-label,
    .metric-card.meta .metric-value {
      color: white;
    }
    
    .metric-label {
      font-size: 10px;
      font-weight: 600;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .metric-value {
      font-size: 24px;
      font-weight: 700;
      color: white;
    }
    
    .metric-change {
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .metric-change.positive { color: #4ADE80; }
    .metric-change.negative { color: #F87171; }
    
    /* Hero Stats */
    .hero-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .hero-stat {
      background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
      overflow: hidden;
    }
    
    .hero-stat::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, #00D4FF, #0099FF);
    }
    
    .hero-stat-label {
      font-size: 11px;
      font-weight: 600;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .hero-stat-value {
      font-size: 28px;
      font-weight: 800;
      color: white;
      margin: 6px 0;
    }
    
    .hero-stat-value.green { color: #4ADE80; }
    
    .hero-stat-sub {
      font-size: 12px;
      color: #888888;
    }
    
    .hero-stat-sub.positive { color: #4ADE80; }
    .hero-stat-sub.negative { color: #F87171; }
    
    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      border-radius: 12px;
      overflow: hidden;
    }
    
    .data-table th {
      background: linear-gradient(135deg, #1a1a1a 0%, #111111 100%);
      color: #00D4FF;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 10px;
      border-bottom: 2px solid rgba(0, 212, 255, 0.3);
    }
    
    .data-table th:first-child {
      border-radius: 10px 0 0 0;
    }
    
    .data-table th:last-child {
      border-radius: 0 10px 0 0;
    }
    
    .data-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: white;
    }
    
    .data-table tr {
      background: #141414;
    }
    
    .data-table tr:nth-child(even) {
      background: #1a1a1a;
    }
    
    .data-table tr:last-child td:first-child {
      border-radius: 0 0 0 10px;
    }
    
    .data-table tr:last-child td:last-child {
      border-radius: 0 0 10px 0;
    }
    
    .data-table strong {
      color: white;
    }
    
    .variation {
      font-weight: 600;
    }
    
    .variation.positive { color: #4ADE80; }
    .variation.negative { color: #F87171; }
    
    /* Investment Bar */
    .investment-section {
      margin-top: 24px;
    }
    
    .investment-bar {
      height: 36px;
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .investment-bar-google {
      background: linear-gradient(90deg, #4285F4, #3367D6);
    }
    
    .investment-bar-meta {
      background: linear-gradient(90deg, #0084FF, #0066CC);
    }
    
    .investment-legend {
      display: flex;
      gap: 50px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .legend-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    
    .legend-dot.google { background: linear-gradient(135deg, #4285F4, #3367D6); }
    .legend-dot.meta { background: linear-gradient(135deg, #0084FF, #0066CC); }
    
    .legend-label {
      font-size: 13px;
      font-weight: 600;
      color: white;
    }
    
    .legend-value {
      font-size: 12px;
      color: #888888;
    }
    
    /* Comparison Bar Charts */
    .comparison-chart {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 24px;
    }
    
    .chart-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .chart-label {
      width: 100px;
      font-size: 12px;
      font-weight: 600;
      color: white;
      text-align: right;
    }
    
    .chart-bars {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .bar-container {
      height: 24px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
    }
    
    .bar-fill {
      height: 100%;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 12px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      min-width: 60px;
      transition: width 0.3s ease;
    }
    
    .bar-fill.current {
      background: linear-gradient(90deg, #00D4FF, #0099FF);
    }
    
    .bar-fill.previous {
      background: linear-gradient(90deg, #444444, #555555);
    }
    
    .chart-legend-inline {
      display: flex;
      gap: 8px;
      margin-left: 8px;
    }
    
    .legend-badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }
    
    .legend-badge.current {
      background: rgba(0, 212, 255, 0.2);
      color: #00D4FF;
    }
    
    .legend-badge.previous {
      background: rgba(255, 255, 255, 0.1);
      color: #888888;
    }
    
    /* Donut Chart */
    .donut-container {
      display: flex;
      align-items: center;
      gap: 40px;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .donut-chart {
      position: relative;
      width: 140px;
      height: 140px;
    }
    
    .donut-chart svg {
      transform: rotate(-90deg);
    }
    
    .donut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    
    .donut-center-value {
      font-size: 24px;
      font-weight: 800;
      color: white;
    }
    
    .donut-center-label {
      font-size: 10px;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .donut-legend {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .donut-legend-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .donut-legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }
    
    .donut-legend-color.google { background: linear-gradient(135deg, #4285F4, #3367D6); }
    .donut-legend-color.meta { background: linear-gradient(135deg, #0084FF, #0066CC); }
    .donut-legend-color.primary { background: linear-gradient(135deg, #00D4FF, #0099FF); }
    .donut-legend-color.secondary { background: linear-gradient(135deg, #4ADE80, #22C55E); }
    
    .donut-legend-info {
      flex: 1;
    }
    
    .donut-legend-name {
      font-size: 13px;
      font-weight: 600;
      color: white;
    }
    
    .donut-legend-value {
      font-size: 12px;
      color: #888888;
    }
    
    .donut-legend-percent {
      font-size: 16px;
      font-weight: 700;
      color: white;
    }
    
    /* Progress Gauge */
    .gauge-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    .gauge-card {
      background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
    }
    
    .gauge-circle {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto 16px;
    }
    
    .gauge-circle svg {
      transform: rotate(-90deg);
    }
    
    .gauge-value {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      font-weight: 800;
      color: white;
    }
    
    .gauge-label {
      font-size: 12px;
      font-weight: 600;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .gauge-sublabel {
      font-size: 11px;
      color: #666666;
      margin-top: 4px;
    }
    
    /* Sparkline Mini Charts */
    .sparkline-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
      border-radius: 12px;
      margin-bottom: 12px;
    }
    
    .sparkline-info {
      flex: 1;
    }
    
    .sparkline-label {
      font-size: 11px;
      font-weight: 600;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .sparkline-value {
      font-size: 22px;
      font-weight: 700;
      color: white;
      margin-top: 4px;
    }
    
    .sparkline-change {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      margin-top: 6px;
    }
    
    .sparkline-change.positive {
      background: rgba(74, 222, 128, 0.15);
      color: #4ADE80;
    }
    
    .sparkline-change.negative {
      background: rgba(248, 113, 113, 0.15);
      color: #F87171;
    }
    
    .sparkline-chart {
      width: 120px;
      height: 50px;
    }
    
    /* KPI Cards with Visual */
    .kpi-visual-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    .kpi-visual-card {
      background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }
    
    .kpi-visual-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, #00D4FF, #0099FF);
    }
    
    .kpi-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      font-size: 24px;
    }
    
    .kpi-icon.blue { background: rgba(0, 212, 255, 0.15); }
    .kpi-icon.green { background: rgba(74, 222, 128, 0.15); }
    .kpi-icon.purple { background: rgba(168, 85, 247, 0.15); }
    .kpi-icon.yellow { background: rgba(250, 204, 21, 0.15); }
    
    .kpi-visual-label {
      font-size: 11px;
      font-weight: 600;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .kpi-visual-value {
      font-size: 28px;
      font-weight: 800;
      color: white;
      margin: 8px 0;
    }
    
    .kpi-visual-footer {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .kpi-visual-change {
      font-size: 12px;
      font-weight: 600;
    }
    
    .kpi-visual-change.positive { color: #4ADE80; }
    .kpi-visual-change.negative { color: #F87171; }
    
    .kpi-visual-period {
      font-size: 11px;
      color: #666666;
    }

    /* Page Footer */
    .page-footer {
      position: absolute;
      bottom: 25px;
      left: 45px;
      right: 45px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #666666;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 15px;
    }
    
    .page-footer span:first-child {
      color: #00D4FF;
      font-weight: 500;
    }
    
    @media print {
      .page {
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="page cover">
    <div class="cover-accent"></div>
    <div class="cover-pattern"></div>
    <div class="cover-glow"></div>
    
    <div class="cover-content">
      <div class="logo">
        <span class="logo-text">
          <span class="logo-turbo">TURBO</span>
          <span class="logo-partners">PARTNERS</span>
        </span>
      </div>
      
      <div class="cover-divider"></div>
      
      <div class="cover-subtitle">Relatório de Performance</div>
      <div class="cover-title">${data.cliente.cliente}</div>
    </div>
    
    <div class="cover-footer">
      <div class="cover-info">
        <div class="info-block">
          <div class="info-label">Período</div>
          <div class="info-value">${data.periodos.atual.label}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Gestor</div>
          <div class="info-value">${data.cliente.gestor || 'N/A'}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Squad</div>
          <div class="info-value">${data.cliente.squad || 'N/A'}</div>
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Gerado em</div>
        <div class="info-value">${today}</div>
      </div>
    </div>
  </div>
  
  <!-- Executive Summary -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-brand">Turbo Partners</div>
      <div class="page-title">Resumo Executivo</div>
      <div class="header-accent blue"></div>
    </div>
    
    <div class="page-content">
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">Investimento Total</div>
          <div class="hero-stat-value">${formatCurrency(investTotal)}</div>
          <div class="hero-stat-sub">Google Ads + Meta Ads</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">Receita Total (GA4)</div>
          <div class="hero-stat-value green">${formatCurrency(data.ga4Atual.receita)}</div>
          <div class="hero-stat-sub ${receitaVar.isPositive ? 'positive' : 'negative'}">${receitaVar.text} vs período anterior</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Métricas Principais</div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Sessões</div>
            <div class="metric-value">${formatNumber(data.ga4Atual.sessoes)}</div>
            <div class="metric-change ${sessoesVar.isPositive ? 'positive' : 'negative'}">${sessoesVar.text}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Conversões Totais</div>
            <div class="metric-value">${formatNumber(convTotal)}</div>
          </div>
          <div class="metric-card highlight">
            <div class="metric-label">Custo por Conversão</div>
            <div class="metric-value">${formatCurrency(convTotal > 0 ? investTotal / convTotal : 0)}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Comparativo Visual</div>
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <span class="legend-badge current">Período Atual</span>
          <span class="legend-badge previous">Período Anterior</span>
        </div>
        <div class="comparison-chart">
          <div class="chart-row">
            <div class="chart-label">Sessões</div>
            <div class="chart-bars">
              <div class="bar-container">
                <div class="bar-fill current" style="width: ${Math.min(100, (data.ga4Atual.sessoes / Math.max(data.ga4Atual.sessoes, data.ga4Anterior.sessoes)) * 100)}%">${formatNumber(data.ga4Atual.sessoes)}</div>
              </div>
              <div class="bar-container">
                <div class="bar-fill previous" style="width: ${Math.min(100, (data.ga4Anterior.sessoes / Math.max(data.ga4Atual.sessoes, data.ga4Anterior.sessoes)) * 100)}%">${formatNumber(data.ga4Anterior.sessoes)}</div>
              </div>
            </div>
            <div class="sparkline-change ${sessoesVar.isPositive ? 'positive' : 'negative'}">${sessoesVar.text}</div>
          </div>
          <div class="chart-row">
            <div class="chart-label">Usuários</div>
            <div class="chart-bars">
              <div class="bar-container">
                <div class="bar-fill current" style="width: ${Math.min(100, (data.ga4Atual.usuarios / Math.max(data.ga4Atual.usuarios, data.ga4Anterior.usuarios)) * 100)}%">${formatNumber(data.ga4Atual.usuarios)}</div>
              </div>
              <div class="bar-container">
                <div class="bar-fill previous" style="width: ${Math.min(100, (data.ga4Anterior.usuarios / Math.max(data.ga4Atual.usuarios, data.ga4Anterior.usuarios)) * 100)}%">${formatNumber(data.ga4Anterior.usuarios)}</div>
              </div>
            </div>
            <div class="sparkline-change ${usuariosVar.isPositive ? 'positive' : 'negative'}">${usuariosVar.text}</div>
          </div>
          <div class="chart-row">
            <div class="chart-label">Conversões</div>
            <div class="chart-bars">
              <div class="bar-container">
                <div class="bar-fill current" style="width: ${Math.min(100, (data.ga4Atual.conversoes / Math.max(data.ga4Atual.conversoes, data.ga4Anterior.conversoes, 1)) * 100)}%">${formatNumber(data.ga4Atual.conversoes)}</div>
              </div>
              <div class="bar-container">
                <div class="bar-fill previous" style="width: ${Math.min(100, (data.ga4Anterior.conversoes / Math.max(data.ga4Atual.conversoes, data.ga4Anterior.conversoes, 1)) * 100)}%">${formatNumber(data.ga4Anterior.conversoes)}</div>
              </div>
            </div>
            <div class="sparkline-change ${convVar.isPositive ? 'positive' : 'negative'}">${convVar.text}</div>
          </div>
          <div class="chart-row">
            <div class="chart-label">Receita</div>
            <div class="chart-bars">
              <div class="bar-container">
                <div class="bar-fill current" style="width: ${Math.min(100, (data.ga4Atual.receita / Math.max(data.ga4Atual.receita, data.ga4Anterior.receita, 1)) * 100)}%">${formatCurrency(data.ga4Atual.receita)}</div>
              </div>
              <div class="bar-container">
                <div class="bar-fill previous" style="width: ${Math.min(100, (data.ga4Anterior.receita / Math.max(data.ga4Atual.receita, data.ga4Anterior.receita, 1)) * 100)}%">${formatCurrency(data.ga4Anterior.receita)}</div>
              </div>
            </div>
            <div class="sparkline-change ${receitaVar.isPositive ? 'positive' : 'negative'}">${receitaVar.text}</div>
          </div>
        </div>
      </div>
      
      <div class="section investment-section">
        <div class="section-title">Distribuição de Investimento</div>
        <div class="donut-container">
          <div class="donut-chart">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="55" fill="none" stroke="#222" stroke-width="20"/>
              <circle cx="70" cy="70" r="55" fill="none" stroke="url(#googleGrad)" stroke-width="20" 
                stroke-dasharray="${(googlePct / 100) * 345.6} 345.6" stroke-linecap="round"/>
              <circle cx="70" cy="70" r="55" fill="none" stroke="url(#metaGrad)" stroke-width="20" 
                stroke-dasharray="${(metaPct / 100) * 345.6} 345.6" 
                stroke-dashoffset="${-(googlePct / 100) * 345.6}" stroke-linecap="round"/>
              <defs>
                <linearGradient id="googleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#4285F4"/>
                  <stop offset="100%" style="stop-color:#3367D6"/>
                </linearGradient>
                <linearGradient id="metaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#0084FF"/>
                  <stop offset="100%" style="stop-color:#0066CC"/>
                </linearGradient>
              </defs>
            </svg>
            <div class="donut-center">
              <div class="donut-center-value">${formatCurrency(investTotal)}</div>
              <div class="donut-center-label">Total</div>
            </div>
          </div>
          <div class="donut-legend">
            <div class="donut-legend-item">
              <div class="donut-legend-color google"></div>
              <div class="donut-legend-info">
                <div class="donut-legend-name">Google Ads</div>
                <div class="donut-legend-value">${formatCurrency(data.googleAds.custo)}</div>
              </div>
              <div class="donut-legend-percent">${googlePct.toFixed(0)}%</div>
            </div>
            <div class="donut-legend-item">
              <div class="donut-legend-color meta"></div>
              <div class="donut-legend-info">
                <div class="donut-legend-name">Meta Ads</div>
                <div class="donut-legend-value">${formatCurrency(data.metaAds.custo)}</div>
              </div>
              <div class="donut-legend-percent">${metaPct.toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>Turbo Partners | Relatório de Performance</span>
      <span>Página 2</span>
    </div>
  </div>
  
  <!-- Google Analytics Page -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-brand">Turbo Partners</div>
      <div class="page-title">Google Analytics 4</div>
      <div class="header-accent blue"></div>
    </div>
    
    <div class="page-content">
      <div class="section">
        <div class="section-title">Métricas de Tráfego</div>
        <div class="kpi-visual-grid">
          <div class="kpi-visual-card">
            <div class="kpi-icon blue">📊</div>
            <div class="kpi-visual-label">Sessões</div>
            <div class="kpi-visual-value">${formatNumber(data.ga4Atual.sessoes)}</div>
            <div class="kpi-visual-footer">
              <span class="kpi-visual-change ${sessoesVar.isPositive ? 'positive' : 'negative'}">${sessoesVar.text}</span>
              <span class="kpi-visual-period">vs anterior</span>
            </div>
          </div>
          <div class="kpi-visual-card">
            <div class="kpi-icon green">👥</div>
            <div class="kpi-visual-label">Usuários</div>
            <div class="kpi-visual-value">${formatNumber(data.ga4Atual.usuarios)}</div>
            <div class="kpi-visual-footer">
              <span class="kpi-visual-change ${usuariosVar.isPositive ? 'positive' : 'negative'}">${usuariosVar.text}</span>
              <span class="kpi-visual-period">vs anterior</span>
            </div>
          </div>
          <div class="kpi-visual-card">
            <div class="kpi-icon purple">🆕</div>
            <div class="kpi-visual-label">Novos Usuários</div>
            <div class="kpi-visual-value">${formatNumber(data.ga4Atual.novoUsuarios)}</div>
            <div class="kpi-visual-footer">
              <span class="kpi-visual-change ${calcVariation(data.ga4Atual.novoUsuarios, data.ga4Anterior.novoUsuarios).isPositive ? 'positive' : 'negative'}">${calcVariation(data.ga4Atual.novoUsuarios, data.ga4Anterior.novoUsuarios).text}</span>
              <span class="kpi-visual-period">vs anterior</span>
            </div>
          </div>
          <div class="kpi-visual-card">
            <div class="kpi-icon yellow">⏱️</div>
            <div class="kpi-visual-label">Duração Média</div>
            <div class="kpi-visual-value">${formatDuration(data.ga4Atual.duracaoMedia)}</div>
            <div class="kpi-visual-footer">
              <span class="kpi-visual-period">Tempo por sessão</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Receita e Conversões</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="sparkline-row" style="margin-bottom: 0;">
            <div class="sparkline-info">
              <div class="sparkline-label">💰 Receita Total</div>
              <div class="sparkline-value" style="color: #4ADE80;">${formatCurrency(data.ga4Atual.receita)}</div>
              <div class="sparkline-change ${receitaVar.isPositive ? 'positive' : 'negative'}">${receitaVar.text}</div>
            </div>
          </div>
          <div class="sparkline-row" style="margin-bottom: 0;">
            <div class="sparkline-info">
              <div class="sparkline-label">🎯 Conversões</div>
              <div class="sparkline-value" style="color: #00D4FF;">${formatNumber(data.ga4Atual.conversoes)}</div>
              <div class="sparkline-change ${convVar.isPositive ? 'positive' : 'negative'}">${convVar.text}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Top Canais de Aquisição</div>
        ${(() => {
          const maxSessoes = Math.max(...data.ga4Atual.canais.slice(0, 5).map(c => c.sessoes), 1);
          return data.ga4Atual.canais.slice(0, 5).map((c, i) => `
          <div class="sparkline-row">
            <div style="width: 24px; height: 24px; border-radius: 6px; background: linear-gradient(135deg, #00D4FF, #0099FF); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #000;">${i + 1}</div>
            <div class="sparkline-info" style="flex: 1;">
              <div class="sparkline-label">${c.nome || 'Direto'}</div>
              <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
                <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${(c.sessoes / maxSessoes) * 100}%; background: linear-gradient(90deg, #00D4FF, #0099FF); border-radius: 4px;"></div>
                </div>
                <span style="font-size: 13px; font-weight: 600; color: white; min-width: 70px;">${formatNumber(c.sessoes)} sessões</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 700; color: #4ADE80;">${formatNumber(c.conversoes)}</div>
              <div style="font-size: 10px; color: #888;">conversões</div>
            </div>
          </div>
          `).join('');
        })()}
      </div>
    </div>
    
    <div class="page-footer">
      <span>Turbo Partners | Relatório de Performance</span>
      <span>Página 3</span>
    </div>
  </div>
  
  <!-- Google Ads Page -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-brand">Turbo Partners</div>
      <div class="page-title">Google Ads</div>
      <div class="header-accent blue"></div>
    </div>
    
    <div class="page-content">
      <div class="section">
        <div class="section-title">Performance Geral</div>
        <div class="metrics-grid metrics-grid-4">
          <div class="metric-card">
            <div class="metric-label">Impressões</div>
            <div class="metric-value">${formatNumber(data.googleAds.impressoes)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Cliques</div>
            <div class="metric-value">${formatNumber(data.googleAds.cliques)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">CTR</div>
            <div class="metric-value">${formatPercent(data.googleAds.ctr)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">CPC Médio</div>
            <div class="metric-value">${formatCurrency(data.googleAds.cpc)}</div>
          </div>
          <div class="metric-card google">
            <div class="metric-label">Custo Total</div>
            <div class="metric-value">${formatCurrency(data.googleAds.custo)}</div>
          </div>
          <div class="metric-card google">
            <div class="metric-label">Conversões</div>
            <div class="metric-value">${formatNumber(data.googleAds.conversoes)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Custo/Conversão</div>
            <div class="metric-value">${formatCurrency(data.googleAds.custoPorConversao)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">ROAS</div>
            <div class="metric-value">${data.googleAds.roas.toFixed(2).replace('.', ',')}x</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Top Campanhas</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Impressões</th>
              <th>Cliques</th>
              <th>Custo</th>
              <th>Conversões</th>
            </tr>
          </thead>
          <tbody>
            ${data.googleAds.campanhas.slice(0, 6).map(c => `
            <tr>
              <td><strong>${c.nome.length > 30 ? c.nome.substring(0, 30) + '...' : c.nome}</strong></td>
              <td>${formatNumber(c.impressoes)}</td>
              <td>${formatNumber(c.cliques)}</td>
              <td>${formatCurrency(c.custo)}</td>
              <td>${formatNumber(c.conversoes)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="page-footer">
      <span>Turbo Partners | Relatório de Performance</span>
      <span>Página 4</span>
    </div>
  </div>
  
  <!-- Meta Ads Page -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-brand">Turbo Partners</div>
      <div class="page-title">Meta Ads</div>
      <div class="header-accent meta"></div>
    </div>
    
    <div class="page-content">
      <div class="section">
        <div class="section-title">Performance Geral</div>
        <div class="metrics-grid metrics-grid-4">
          <div class="metric-card">
            <div class="metric-label">Impressões</div>
            <div class="metric-value">${formatNumber(data.metaAds.impressoes)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Alcance</div>
            <div class="metric-value">${formatNumber(data.metaAds.alcance)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Cliques</div>
            <div class="metric-value">${formatNumber(data.metaAds.cliques)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">CTR</div>
            <div class="metric-value">${formatPercent(data.metaAds.ctr)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">CPC</div>
            <div class="metric-value">${formatCurrency(data.metaAds.cpc)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">CPM</div>
            <div class="metric-value">${formatCurrency(data.metaAds.cpm)}</div>
          </div>
          <div class="metric-card meta">
            <div class="metric-label">Custo Total</div>
            <div class="metric-value">${formatCurrency(data.metaAds.custo)}</div>
          </div>
          <div class="metric-card meta">
            <div class="metric-label">Conversões</div>
            <div class="metric-value">${formatNumber(data.metaAds.conversoes)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Custo/Conversão</div>
            <div class="metric-value">${formatCurrency(data.metaAds.custoPorConversao)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">ROAS</div>
            <div class="metric-value">${data.metaAds.roas.toFixed(2).replace('.', ',')}x</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Top Campanhas</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Alcance</th>
              <th>Cliques</th>
              <th>Custo</th>
              <th>Conversões</th>
            </tr>
          </thead>
          <tbody>
            ${data.metaAds.campanhas.slice(0, 6).map(c => `
            <tr>
              <td><strong>${c.nome.length > 30 ? c.nome.substring(0, 30) + '...' : c.nome}</strong></td>
              <td>${formatNumber(c.alcance)}</td>
              <td>${formatNumber(c.cliques)}</td>
              <td>${formatCurrency(c.custo)}</td>
              <td>${formatNumber(c.conversoes)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="page-footer">
      <span>Turbo Partners | Relatório de Performance</span>
      <span>Página 5</span>
    </div>
  </div>
</body>
</html>`;
}
