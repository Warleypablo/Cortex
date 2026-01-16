import puppeteer from 'puppeteer';
import type { 
  AutoReportCliente, 
  MetricasGA4, 
  MetricasGoogleAds, 
  MetricasMetaAds,
  PeriodoReferencia,
  PageSelection
} from './types';
import { DEFAULT_PAGE_SELECTION } from './types';

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
  pageSelection?: PageSelection;
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
    await page.emulateMediaType('screen');
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
  const pages = data.pageSelection || DEFAULT_PAGE_SELECTION;
  const investTotal = data.googleAds.custo + data.metaAds.custo;
  const convTotal = data.googleAds.conversoes + data.metaAds.conversoes;
  const receitaVar = calcVariation(data.ga4Atual.receita, data.ga4Anterior.receita);
  const sessoesVar = calcVariation(data.ga4Atual.sessoes, data.ga4Anterior.sessoes);
  const usuariosVar = calcVariation(data.ga4Atual.usuarios, data.ga4Anterior.usuarios);
  const convVar = calcVariation(data.ga4Atual.conversoes, data.ga4Anterior.conversoes);
  
  const googlePct = investTotal > 0 ? (data.googleAds.custo / investTotal) * 100 : 50;
  const metaPct = investTotal > 0 ? (data.metaAds.custo / investTotal) * 100 : 50;
  
  const roas = investTotal > 0 ? data.ga4Atual.receita / investTotal : 0;
  const cpa = convTotal > 0 ? investTotal / convTotal : 0;
  
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  
  // Calculate total pages and dynamic page numbers
  const totalPages = 2 + // Cover + Executive Summary (always included)
    (pages.investmentChannels ? 1 : 0) +
    (pages.funnelTraffic ? 1 : 0) +
    (pages.campaignsRecommendations ? 1 : 0);
  
  let currentPage = 2; // Start at 2 (after cover)
  const pageNum = {
    executiveSummary: '02',
    investmentChannels: pages.investmentChannels ? String(++currentPage).padStart(2, '0') : '',
    funnelTraffic: pages.funnelTraffic ? String(++currentPage).padStart(2, '0') : '',
    campaignsRecommendations: pages.campaignsRecommendations ? String(++currentPage).padStart(2, '0') : '',
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório - ${data.cliente.cliente}</title>
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" as="style">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #00D4FF;
      --primary-dark: #0099FF;
      --primary-darker: #0066FF;
      --success: #10B981;
      --success-light: #34D399;
      --danger: #EF4444;
      --danger-light: #F87171;
      --warning: #F59E0B;
      --bg-dark: #0A0A0A;
      --bg-card: #111111;
      --bg-elevated: #1A1A1A;
      --border: rgba(255,255,255,0.08);
      --text-primary: #FFFFFF;
      --text-secondary: #A1A1AA;
      --text-muted: #71717A;
      --google: #4285F4;
      --meta: #0084FF;
      --spacing-xs: 4px;
      --spacing-sm: 8px;
      --spacing-md: 16px;
      --spacing-lg: 24px;
      --spacing-xl: 32px;
      --spacing-2xl: 48px;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-dark);
      color: var(--text-primary);
      line-height: 1.5;
      font-size: 12px;
    }
    
    @page {
      size: A4;
      margin: 0;
    }
    
    .page {
      width: 210mm;
      height: 297mm;
      padding: 0;
      background: var(--bg-dark);
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }

    /* ========== COVER PAGE ========== */
    .cover {
      background: linear-gradient(135deg, #0A0A0A 0%, #111111 50%, #0A0A0A 100%);
      display: flex;
      flex-direction: column;
    }
    
    .cover-sidebar {
      position: absolute;
      left: 0;
      top: 0;
      width: 8px;
      height: 100%;
      background: linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 50%, var(--primary-darker) 100%);
    }
    
    .cover-pattern {
      position: absolute;
      top: 0;
      right: 0;
      width: 50%;
      height: 100%;
      background: 
        radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.12) 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, rgba(0,153,255,0.08) 0%, transparent 40%);
    }
    
    .cover-grid {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: 
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 40px 40px;
    }
    
    .cover-content {
      position: relative;
      z-index: 1;
      padding: 60px 50px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .cover-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(0,212,255,0.1);
      border: 1px solid rgba(0,212,255,0.3);
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 32px;
      width: fit-content;
    }
    
    .cover-badge::before {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .cover-title {
      font-size: 48px;
      font-weight: 800;
      color: white;
      line-height: 1.1;
      margin-bottom: 16px;
      letter-spacing: -1px;
    }
    
    .cover-subtitle {
      font-size: 18px;
      font-weight: 400;
      color: var(--text-secondary);
      margin-bottom: 48px;
    }
    
    .cover-meta {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      padding: 24px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-radius: 16px;
    }
    
    .cover-meta-item {
      text-align: center;
    }
    
    .cover-meta-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    
    .cover-meta-value {
      font-size: 14px;
      font-weight: 600;
      color: white;
    }
    
    .cover-footer {
      position: absolute;
      bottom: 40px;
      left: 50px;
      right: 50px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .cover-logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .logo-icon svg {
      width: 24px;
      height: 24px;
      fill: white;
    }
    
    .logo-text {
      font-size: 20px;
      font-weight: 700;
    }
    
    .logo-text span:first-child { color: white; }
    .logo-text span:last-child { color: var(--primary); }
    
    .cover-date {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* ========== CONTENT PAGES ========== */
    .content-page {
      display: flex;
      flex-direction: column;
    }
    
    .page-header {
      padding: 24px 40px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .page-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .page-number {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: white;
    }
    
    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: white;
    }
    
    .page-brand {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .page-body {
      flex: 1;
      padding: 32px 40px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    
    .page-footer {
      padding: 16px 40px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: var(--text-muted);
    }

    /* ========== SECTION STYLES ========== */
    .section {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .section-icon {
      width: 36px;
      height: 36px;
      background: rgba(0,212,255,0.1);
      border: 1px solid rgba(0,212,255,0.2);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: white;
    }
    
    .section-subtitle {
      font-size: 11px;
      color: var(--text-muted);
    }
    
    .section-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--border) 0%, transparent 100%);
    }

    /* ========== KPI CARDS ========== */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    
    .kpi-grid-3 {
      grid-template-columns: repeat(3, 1fr);
    }
    
    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      position: relative;
      overflow: hidden;
      page-break-inside: avoid;
    }
    
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--primary-dark));
    }
    
    .kpi-card.success::before { background: linear-gradient(90deg, var(--success), var(--success-light)); }
    .kpi-card.warning::before { background: linear-gradient(90deg, var(--warning), #FBBF24); }
    .kpi-card.google::before { background: linear-gradient(90deg, var(--google), #5A95F5); }
    .kpi-card.meta::before { background: linear-gradient(90deg, var(--meta), #00A3FF); }
    
    .kpi-icon {
      width: 40px;
      height: 40px;
      background: rgba(0,212,255,0.1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-bottom: 12px;
    }
    
    .kpi-card.success .kpi-icon { background: rgba(16,185,129,0.1); }
    .kpi-card.google .kpi-icon { background: rgba(66,133,244,0.1); }
    .kpi-card.meta .kpi-icon { background: rgba(0,132,255,0.1); }
    
    .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .kpi-value {
      font-size: 24px;
      font-weight: 800;
      color: white;
      line-height: 1.2;
    }
    
    .kpi-value.small { font-size: 20px; }
    .kpi-value.success { color: var(--success); }
    
    .kpi-change {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 8px;
      padding: 4px 8px;
      border-radius: 6px;
    }
    
    .kpi-change.positive {
      background: rgba(16,185,129,0.15);
      color: var(--success);
    }
    
    .kpi-change.negative {
      background: rgba(239,68,68,0.15);
      color: var(--danger);
    }
    
    .kpi-change svg {
      width: 12px;
      height: 12px;
    }

    /* ========== COMPARISON CHART ========== */
    .comparison-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }
    
    .comparison-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .comparison-title {
      font-size: 13px;
      font-weight: 600;
      color: white;
    }
    
    .comparison-legend {
      display: flex;
      gap: 16px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: var(--text-secondary);
    }
    
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }
    
    .legend-dot.current { background: var(--primary); }
    .legend-dot.previous { background: #444; }
    
    .comparison-rows {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .comparison-row {
      display: grid;
      grid-template-columns: 100px 1fr 80px;
      align-items: center;
      gap: 16px;
    }
    
    .comparison-label {
      font-size: 12px;
      font-weight: 600;
      color: white;
    }
    
    .comparison-bars {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .bar-track {
      height: 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
      overflow: hidden;
    }
    
    .bar-fill {
      height: 100%;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      font-size: 10px;
      font-weight: 600;
      color: white;
      min-width: 50px;
    }
    
    .bar-fill.current {
      background: linear-gradient(90deg, var(--primary), var(--primary-dark));
    }
    
    .bar-fill.previous {
      background: linear-gradient(90deg, #555, #444);
    }
    
    .comparison-change {
      text-align: right;
      font-size: 12px;
      font-weight: 700;
    }
    
    .comparison-change.positive { color: var(--success); }
    .comparison-change.negative { color: var(--danger); }

    /* ========== DONUT CHART ========== */
    .chart-container {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 32px;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }
    
    .donut-wrapper {
      position: relative;
      width: 140px;
      height: 140px;
    }
    
    .donut-wrapper svg {
      transform: rotate(-90deg);
    }
    
    .donut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    
    .donut-value {
      font-size: 18px;
      font-weight: 800;
      color: white;
    }
    
    .donut-label {
      font-size: 9px;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    
    .chart-legend {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .chart-legend-item {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .chart-legend-color {
      width: 12px;
      height: 12px;
      border-radius: 4px;
    }
    
    .chart-legend-color.google { background: var(--google); }
    .chart-legend-color.meta { background: var(--meta); }
    
    .chart-legend-info {
      flex: 1;
    }
    
    .chart-legend-name {
      font-size: 12px;
      font-weight: 600;
      color: white;
    }
    
    .chart-legend-value {
      font-size: 11px;
      color: var(--text-muted);
    }
    
    .chart-legend-percent {
      font-size: 16px;
      font-weight: 700;
      color: white;
    }

    /* ========== FUNNEL CHART ========== */
    .funnel-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }
    
    .funnel-stages {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      height: 180px;
    }
    
    .funnel-stage {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    
    .funnel-bar-container {
      flex: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    
    .funnel-bar {
      width: 100%;
      border-radius: 8px 8px 0 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 12px;
      font-size: 14px;
      font-weight: 700;
      color: white;
      position: relative;
    }
    
    .funnel-bar.impressions { background: linear-gradient(180deg, #6366F1, #4F46E5); }
    .funnel-bar.clicks { background: linear-gradient(180deg, #00D4FF, #0099FF); }
    .funnel-bar.sessions { background: linear-gradient(180deg, #10B981, #059669); }
    .funnel-bar.conversions { background: linear-gradient(180deg, #F59E0B, #D97706); }
    
    .funnel-info {
      text-align: center;
      padding: 12px;
      background: var(--bg-elevated);
      border-radius: 8px;
      width: 100%;
    }
    
    .funnel-stage-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .funnel-rate {
      font-size: 11px;
      color: var(--primary);
      margin-top: 4px;
    }

    /* ========== DATA TABLE ========== */
    .data-table-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .data-table th {
      background: var(--bg-elevated);
      padding: 12px 16px;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    
    .data-table td {
      padding: 12px 16px;
      font-size: 12px;
      color: white;
      border-bottom: 1px solid var(--border);
    }
    
    .data-table tr:last-child td {
      border-bottom: none;
    }
    
    .data-table tr:hover {
      background: rgba(255,255,255,0.02);
    }
    
    .table-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
    }
    
    .table-badge.positive {
      background: rgba(16,185,129,0.15);
      color: var(--success);
    }
    
    .table-badge.negative {
      background: rgba(239,68,68,0.15);
      color: var(--danger);
    }

    /* ========== INSIGHTS BOX ========== */
    .insights-box {
      background: linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(0,153,255,0.04) 100%);
      border: 1px solid rgba(0,212,255,0.2);
      border-radius: 12px;
      padding: 20px;
    }
    
    .insights-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 12px;
    }
    
    .insights-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .insight-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 11px;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    
    .insight-bullet {
      width: 6px;
      height: 6px;
      background: var(--primary);
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }

    /* ========== GAUGE CHART ========== */
    .gauge-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    
    .gauge-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .gauge-wrapper {
      position: relative;
      width: 100px;
      height: 60px;
      margin: 0 auto 12px;
      overflow: hidden;
    }
    
    .gauge-wrapper svg {
      position: absolute;
      top: 0;
      left: 0;
    }
    
    .gauge-value {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      font-size: 18px;
      font-weight: 800;
      color: white;
    }
    
    .gauge-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ========== PROGRESS BAR ========== */
    .progress-container {
      margin-top: 8px;
    }
    
    .progress-track {
      height: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, var(--primary), var(--primary-dark));
    }
    
    .progress-fill.success { background: linear-gradient(90deg, var(--success), var(--success-light)); }
    .progress-fill.google { background: linear-gradient(90deg, var(--google), #5A95F5); }
    .progress-fill.meta { background: linear-gradient(90deg, var(--meta), #00A3FF); }
  </style>
</head>
<body>
  <!-- ==================== PAGE 1: COVER ==================== -->
  <div class="page cover">
    <div class="cover-sidebar"></div>
    <div class="cover-pattern"></div>
    <div class="cover-grid"></div>
    
    <div class="cover-content">
      <div class="cover-badge">Performance Report</div>
      
      <h1 class="cover-title">${data.cliente.cliente}</h1>
      <p class="cover-subtitle">Relatório de Performance Digital | ${data.periodos.atual.label}</p>
      
      <div class="cover-meta">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Período Analisado</div>
          <div class="cover-meta-value">${data.periodos.atual.label}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Gestor de Contas</div>
          <div class="cover-meta-value">${data.cliente.gestor || 'N/A'}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Squad</div>
          <div class="cover-meta-value">${data.cliente.squad || 'Growth'}</div>
        </div>
      </div>
    </div>
    
    <div class="cover-footer">
      <div class="cover-logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <div class="logo-text">
          <span>TURBO</span><span>PARTNERS</span>
        </div>
      </div>
      <div class="cover-date">${today}</div>
    </div>
  </div>

  <!-- ==================== PAGE 2: EXECUTIVE SUMMARY ==================== -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-number">02</div>
        <div class="page-title">Resumo Executivo</div>
      </div>
      <div class="page-brand">Turbo Partners</div>
    </div>
    
    <div class="page-body">
      <div class="section">
        <div class="section-header">
          <div class="section-icon">📊</div>
          <div>
            <div class="section-title">Indicadores Principais</div>
            <div class="section-subtitle">Visão consolidada do período</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">💰</div>
            <div class="kpi-label">Investimento Total</div>
            <div class="kpi-value small">${formatCurrency(investTotal)}</div>
          </div>
          <div class="kpi-card success">
            <div class="kpi-icon">📈</div>
            <div class="kpi-label">Receita (GA4)</div>
            <div class="kpi-value small success">${formatCurrency(data.ga4Atual.receita)}</div>
            <div class="kpi-change ${receitaVar.isPositive ? 'positive' : 'negative'}">
              ${receitaVar.isPositive ? '↑' : '↓'} ${receitaVar.text}
            </div>
          </div>
          <div class="kpi-card warning">
            <div class="kpi-icon">🎯</div>
            <div class="kpi-label">ROAS</div>
            <div class="kpi-value small">${roas.toFixed(2)}x</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">💵</div>
            <div class="kpi-label">CPA Médio</div>
            <div class="kpi-value small">${formatCurrency(cpa)}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <div class="section-icon">📈</div>
          <div>
            <div class="section-title">Comparativo de Períodos</div>
            <div class="section-subtitle">Evolução das métricas principais</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="comparison-container">
          <div class="comparison-header">
            <div class="comparison-title">Performance GA4</div>
            <div class="comparison-legend">
              <div class="legend-item"><div class="legend-dot current"></div>Atual</div>
              <div class="legend-item"><div class="legend-dot previous"></div>Anterior</div>
            </div>
          </div>
          
          <div class="comparison-rows">
            ${[
              { label: 'Sessões', atual: data.ga4Atual.sessoes, anterior: data.ga4Anterior.sessoes },
              { label: 'Usuários', atual: data.ga4Atual.usuarios, anterior: data.ga4Anterior.usuarios },
              { label: 'Conversões', atual: data.ga4Atual.conversoes, anterior: data.ga4Anterior.conversoes }
            ].map(item => {
              const max = Math.max(item.atual, item.anterior, 1);
              const currentPct = (item.atual / max) * 100;
              const previousPct = (item.anterior / max) * 100;
              const variation = calcVariation(item.atual, item.anterior);
              return `
              <div class="comparison-row">
                <div class="comparison-label">${item.label}</div>
                <div class="comparison-bars">
                  <div class="bar-track">
                    <div class="bar-fill current" style="width: ${currentPct}%">${formatNumber(item.atual)}</div>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill previous" style="width: ${previousPct}%">${formatNumber(item.anterior)}</div>
                  </div>
                </div>
                <div class="comparison-change ${variation.isPositive ? 'positive' : 'negative'}">${variation.text}</div>
              </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="insights-box">
          <div class="insights-title">
            <span>💡</span> Principais Insights
          </div>
          <div class="insights-list">
            <div class="insight-item">
              <div class="insight-bullet"></div>
              <div>${receitaVar.isPositive ? 'Crescimento' : 'Redução'} de receita de ${receitaVar.text} comparado ao período anterior, ${receitaVar.isPositive ? 'superando as expectativas' : 'indicando necessidade de otimização'}.</div>
            </div>
            <div class="insight-item">
              <div class="insight-bullet"></div>
              <div>ROAS de ${roas.toFixed(2)}x representa um retorno de R$ ${roas.toFixed(2)} para cada R$ 1,00 investido em mídia.</div>
            </div>
            <div class="insight-item">
              <div class="insight-bullet"></div>
              <div>${sessoesVar.isPositive ? 'Aumento' : 'Queda'} de ${sessoesVar.text} no tráfego do site, ${sessoesVar.isPositive ? 'demonstrando efetividade das campanhas' : 'sugerindo revisão de estratégia de aquisição'}.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <div>Turbo Partners | Relatório de Performance</div>
      <div>Página 2 de ${totalPages}</div>
    </div>
  </div>

  ${pages.investmentChannels ? `
  <!-- ==================== PAGE 3: INVESTMENT & CHANNELS ==================== -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-number">${pageNum.investmentChannels}</div>
        <div class="page-title">Investimento & Canais</div>
      </div>
      <div class="page-brand">Turbo Partners</div>
    </div>
    
    <div class="page-body">
      <div class="section">
        <div class="section-header">
          <div class="section-icon">💎</div>
          <div>
            <div class="section-title">Distribuição do Investimento</div>
            <div class="section-subtitle">Alocação por plataforma de mídia</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="chart-container">
          <div class="donut-wrapper">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="54" fill="none" stroke="#222" stroke-width="16"/>
              <circle cx="70" cy="70" r="54" fill="none" stroke="${googlePct > 0 ? 'var(--google)' : '#222'}" stroke-width="16" 
                stroke-dasharray="${(googlePct / 100) * 339.3} 339.3" stroke-linecap="round"/>
              <circle cx="70" cy="70" r="54" fill="none" stroke="${metaPct > 0 ? 'var(--meta)' : '#222'}" stroke-width="16" 
                stroke-dasharray="${(metaPct / 100) * 339.3} 339.3" 
                stroke-dashoffset="${-(googlePct / 100) * 339.3}" stroke-linecap="round"/>
            </svg>
            <div class="donut-center">
              <div class="donut-value">${formatCurrency(investTotal)}</div>
              <div class="donut-label">Total</div>
            </div>
          </div>
          
          <div class="chart-legend">
            <div class="chart-legend-item">
              <div class="chart-legend-color google"></div>
              <div class="chart-legend-info">
                <div class="chart-legend-name">Google Ads</div>
                <div class="chart-legend-value">${formatCurrency(data.googleAds.custo)}</div>
              </div>
              <div class="chart-legend-percent">${googlePct.toFixed(0)}%</div>
            </div>
            <div class="chart-legend-item">
              <div class="chart-legend-color meta"></div>
              <div class="chart-legend-info">
                <div class="chart-legend-name">Meta Ads</div>
                <div class="chart-legend-value">${formatCurrency(data.metaAds.custo)}</div>
              </div>
              <div class="chart-legend-percent">${metaPct.toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <div class="section-icon">📊</div>
          <div>
            <div class="section-title">Performance por Plataforma</div>
            <div class="section-subtitle">Métricas detalhadas de cada canal</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="kpi-grid kpi-grid-3">
          <div class="kpi-card google">
            <div class="kpi-icon">🔍</div>
            <div class="kpi-label">Cliques Google</div>
            <div class="kpi-value small">${formatNumber(data.googleAds.cliques)}</div>
            <div class="progress-container">
              <div class="progress-track">
                <div class="progress-fill google" style="width: ${Math.min(100, (data.googleAds.cliques / Math.max(data.googleAds.cliques, data.metaAds.cliques, 1)) * 100)}%"></div>
              </div>
            </div>
          </div>
          <div class="kpi-card meta">
            <div class="kpi-icon">📱</div>
            <div class="kpi-label">Cliques Meta</div>
            <div class="kpi-value small">${formatNumber(data.metaAds.cliques)}</div>
            <div class="progress-container">
              <div class="progress-track">
                <div class="progress-fill meta" style="width: ${Math.min(100, (data.metaAds.cliques / Math.max(data.googleAds.cliques, data.metaAds.cliques, 1)) * 100)}%"></div>
              </div>
            </div>
          </div>
          <div class="kpi-card success">
            <div class="kpi-icon">🎯</div>
            <div class="kpi-label">Conversões Totais</div>
            <div class="kpi-value small">${formatNumber(convTotal)}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <div class="section-icon">⚡</div>
          <div>
            <div class="section-title">Métricas de Eficiência</div>
            <div class="section-subtitle">Indicadores de custo e performance</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="gauge-grid">
          <div class="gauge-card">
            <div class="gauge-wrapper">
              <svg width="100" height="60" viewBox="0 0 100 60">
                <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#222" stroke-width="8" stroke-linecap="round"/>
                <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="var(--google)" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${Math.min(126 * 0.8, 126)} 126"/>
              </svg>
              <div class="gauge-value">${formatCurrency(data.googleAds.cliques > 0 ? data.googleAds.custo / data.googleAds.cliques : 0)}</div>
            </div>
            <div class="gauge-label">CPC Google</div>
          </div>
          <div class="gauge-card">
            <div class="gauge-wrapper">
              <svg width="100" height="60" viewBox="0 0 100 60">
                <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#222" stroke-width="8" stroke-linecap="round"/>
                <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="var(--meta)" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${Math.min(126 * 0.7, 126)} 126"/>
              </svg>
              <div class="gauge-value">${formatCurrency(data.metaAds.cliques > 0 ? data.metaAds.custo / data.metaAds.cliques : 0)}</div>
            </div>
            <div class="gauge-label">CPC Meta</div>
          </div>
          <div class="gauge-card">
            <div class="gauge-wrapper">
              <svg width="100" height="60" viewBox="0 0 100 60">
                <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#222" stroke-width="8" stroke-linecap="round"/>
                <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="var(--success)" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${Math.min(126 * Math.min(roas / 5, 1), 126)} 126"/>
              </svg>
              <div class="gauge-value">${roas.toFixed(2)}x</div>
            </div>
            <div class="gauge-label">ROAS Geral</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <div>Turbo Partners | Relatório de Performance</div>
      <div>Página ${pageNum.investmentChannels} de ${totalPages}</div>
    </div>
  </div>
  ` : ''}

  ${pages.funnelTraffic ? `
  <!-- ==================== PAGE 4: FUNNEL & TRAFFIC ==================== -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-number">${pageNum.funnelTraffic}</div>
        <div class="page-title">Funil & Tráfego</div>
      </div>
      <div class="page-brand">Turbo Partners</div>
    </div>
    
    <div class="page-body">
      <div class="section">
        <div class="section-header">
          <div class="section-icon">🔄</div>
          <div>
            <div class="section-title">Funil de Conversão</div>
            <div class="section-subtitle">Jornada do usuário desde impressão até conversão</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="funnel-container">
          <div class="funnel-stages">
            ${(() => {
              const impressions = data.googleAds.impressoes + data.metaAds.impressoes;
              const clicks = data.googleAds.cliques + data.metaAds.cliques;
              const sessions = data.ga4Atual.sessoes;
              const conversions = data.ga4Atual.conversoes;
              const max = Math.max(impressions, 1);
              
              const stages = [
                { label: 'Impressões', value: impressions, pct: 100, class: 'impressions' },
                { label: 'Cliques', value: clicks, pct: (clicks / max) * 100, class: 'clicks', rate: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0' },
                { label: 'Sessões', value: sessions, pct: (sessions / max) * 100, class: 'sessions', rate: clicks > 0 ? ((sessions / clicks) * 100).toFixed(2) : '0' },
                { label: 'Conversões', value: conversions, pct: Math.max((conversions / max) * 100, 5), class: 'conversions', rate: sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : '0' }
              ];
              
              return stages.map((stage, i) => `
                <div class="funnel-stage">
                  <div class="funnel-bar-container">
                    <div class="funnel-bar ${stage.class}" style="height: ${Math.max(stage.pct, 15)}%">
                      ${formatNumber(stage.value)}
                    </div>
                  </div>
                  <div class="funnel-info">
                    <div class="funnel-stage-label">${stage.label}</div>
                    ${stage.rate ? `<div class="funnel-rate">Taxa: ${stage.rate}%</div>` : ''}
                  </div>
                </div>
              `).join('');
            })()}
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <div class="section-icon">📱</div>
          <div>
            <div class="section-title">Métricas de Tráfego (GA4)</div>
            <div class="section-subtitle">Comportamento dos usuários no site</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">👥</div>
            <div class="kpi-label">Usuários</div>
            <div class="kpi-value small">${formatNumber(data.ga4Atual.usuarios)}</div>
            <div class="kpi-change ${usuariosVar.isPositive ? 'positive' : 'negative'}">
              ${usuariosVar.isPositive ? '↑' : '↓'} ${usuariosVar.text}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🆕</div>
            <div class="kpi-label">Novos Usuários</div>
            <div class="kpi-value small">${formatNumber(data.ga4Atual.novoUsuarios)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">⏱️</div>
            <div class="kpi-label">Duração Média</div>
            <div class="kpi-value small">${formatDuration(data.ga4Atual.duracaoMedia)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">↩️</div>
            <div class="kpi-label">Taxa de Rejeição</div>
            <div class="kpi-value small">${formatPercent(data.ga4Atual.taxaRejeicao * 100)}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <div class="section-icon">🌐</div>
          <div>
            <div class="section-title">Top Canais de Aquisição</div>
            <div class="section-subtitle">Origem do tráfego por canal</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px">#</th>
                <th>Canal</th>
                <th style="text-align: right">Sessões</th>
                <th style="text-align: right">Conversões</th>
                <th style="text-align: right">Taxa Conv.</th>
              </tr>
            </thead>
            <tbody>
              ${data.ga4Atual.canais.slice(0, 5).map((c, i) => {
                const taxa = c.sessoes > 0 ? (c.conversoes / c.sessoes) * 100 : 0;
                return `
                <tr>
                  <td style="font-weight: 700; color: var(--primary)">${i + 1}</td>
                  <td style="font-weight: 600">${c.nome || 'Direto'}</td>
                  <td style="text-align: right">${formatNumber(c.sessoes)}</td>
                  <td style="text-align: right">${formatNumber(c.conversoes)}</td>
                  <td style="text-align: right">
                    <span class="table-badge ${taxa > 2 ? 'positive' : taxa > 0 ? '' : 'negative'}">${taxa.toFixed(2)}%</span>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <div>Turbo Partners | Relatório de Performance</div>
      <div>Página ${pageNum.funnelTraffic} de ${totalPages}</div>
    </div>
  </div>
  ` : ''}

  ${pages.campaignsRecommendations ? `
  <!-- ==================== PAGE 5: CAMPAIGNS & RECOMMENDATIONS ==================== -->
  <div class="page content-page">
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-number">${pageNum.campaignsRecommendations}</div>
        <div class="page-title">Campanhas & Próximos Passos</div>
      </div>
      <div class="page-brand">Turbo Partners</div>
    </div>
    
    <div class="page-body">
      <div class="section">
        <div class="section-header">
          <div class="section-icon">🎯</div>
          <div>
            <div class="section-title">Top Campanhas Google Ads</div>
            <div class="section-subtitle">Campanhas com melhor performance</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th style="text-align: right">Custo</th>
                <th style="text-align: right">Cliques</th>
                <th style="text-align: right">Conv.</th>
                <th style="text-align: right">CPA</th>
              </tr>
            </thead>
            <tbody>
              ${data.googleAds.campanhas.slice(0, 4).map(c => {
                const cpaVal = c.conversoes > 0 ? c.custo / c.conversoes : 0;
                return `
                <tr>
                  <td style="font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.nome}</td>
                  <td style="text-align: right">${formatCurrency(c.custo)}</td>
                  <td style="text-align: right">${formatNumber(c.cliques)}</td>
                  <td style="text-align: right; font-weight: 700; color: var(--success)">${c.conversoes}</td>
                  <td style="text-align: right">${formatCurrency(cpaVal)}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <div class="section-icon">📱</div>
          <div>
            <div class="section-title">Top Campanhas Meta Ads</div>
            <div class="section-subtitle">Campanhas com melhor performance</div>
          </div>
          <div class="section-line"></div>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th style="text-align: right">Custo</th>
                <th style="text-align: right">Cliques</th>
                <th style="text-align: right">Conv.</th>
                <th style="text-align: right">CPA</th>
              </tr>
            </thead>
            <tbody>
              ${data.metaAds.campanhas.slice(0, 4).map(c => {
                const cpaVal = c.conversoes > 0 ? c.custo / c.conversoes : 0;
                return `
                <tr>
                  <td style="font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.nome}</td>
                  <td style="text-align: right">${formatCurrency(c.custo)}</td>
                  <td style="text-align: right">${formatNumber(c.cliques)}</td>
                  <td style="text-align: right; font-weight: 700; color: var(--success)">${c.conversoes}</td>
                  <td style="text-align: right">${formatCurrency(cpaVal)}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="section">
        <div class="insights-box">
          <div class="insights-title">
            <span>🚀</span> Próximos Passos Recomendados
          </div>
          <div class="insights-list">
            <div class="insight-item">
              <div class="insight-bullet"></div>
              <div>${roas >= 3 ? 'Manter a estratégia atual e considerar aumento gradual de investimento nas campanhas de melhor performance.' : 'Otimizar campanhas com baixo ROAS e realocar budget para as de melhor desempenho.'}</div>
            </div>
            <div class="insight-item">
              <div class="insight-bullet"></div>
              <div>${data.ga4Atual.taxaRejeicao > 0.5 ? 'Revisar landing pages para reduzir taxa de rejeição e melhorar experiência do usuário.' : 'Expandir testes A/B em landing pages para potencializar taxa de conversão.'}</div>
            </div>
            <div class="insight-item">
              <div class="insight-bullet"></div>
              <div>Implementar remarketing para usuários que visitaram o site mas não converteram no período.</div>
            </div>
            <div class="insight-item">
              <div class="insight-bullet"></div>
              <div>Revisar segmentação de audiência para aumentar qualificação do tráfego e reduzir CPA.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <div>Turbo Partners | Relatório de Performance</div>
      <div>Página ${pageNum.campaignsRecommendations} de ${totalPages}</div>
    </div>
  </div>
  ` : ''}
</body>
</html>`;
}
