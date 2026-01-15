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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.5;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 0;
      background: white;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    /* Cover Page */
    .cover {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 0;
    }
    
    .cover-accent {
      position: absolute;
      top: 0;
      left: 0;
      width: 8px;
      height: 100%;
      background: linear-gradient(180deg, #f97316 0%, #ea580c 100%);
    }
    
    .cover-pattern {
      position: absolute;
      top: 0;
      right: 0;
      width: 50%;
      height: 100%;
      background: radial-gradient(circle at 80% 20%, rgba(249, 115, 22, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 60% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 40%);
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
    
    .logo {
      margin-bottom: 60px;
    }
    
    .logo-text {
      font-size: 42px;
      font-weight: 800;
      letter-spacing: -1px;
    }
    
    .logo-turbo {
      color: #f97316;
    }
    
    .logo-partners {
      color: white;
      margin-left: 10px;
    }
    
    .cover-divider {
      width: 80px;
      height: 4px;
      background: linear-gradient(90deg, #f97316, #ea580c);
      margin: 30px 0;
      border-radius: 2px;
    }
    
    .cover-subtitle {
      font-size: 13px;
      font-weight: 500;
      color: #f97316;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 20px;
    }
    
    .cover-title {
      font-size: 36px;
      font-weight: 700;
      color: white;
      line-height: 1.2;
    }
    
    .cover-footer {
      position: relative;
      z-index: 1;
      padding: 40px 50px;
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .cover-info {
      display: flex;
      gap: 50px;
    }
    
    .info-block {
      color: white;
    }
    
    .info-label {
      font-size: 10px;
      font-weight: 500;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    
    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: white;
    }
    
    /* Content Pages */
    .content-page {
      padding: 0;
    }
    
    .page-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 30px 40px;
      position: relative;
    }
    
    .header-accent {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
    }
    
    .header-accent.orange { background: linear-gradient(90deg, #f97316, #ea580c); }
    .header-accent.blue { background: linear-gradient(90deg, #3b82f6, #2563eb); }
    .header-accent.meta { background: linear-gradient(90deg, #0ea5e9, #0284c7); }
    
    .page-title {
      font-size: 26px;
      font-weight: 700;
      color: white;
    }
    
    .page-brand {
      font-size: 11px;
      font-weight: 500;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .page-content {
      padding: 30px 40px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }
    
    /* Metric Cards */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .metrics-grid-4 {
      grid-template-columns: repeat(4, 1fr);
    }
    
    .metric-card {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      position: relative;
      overflow: hidden;
    }
    
    .metric-card.highlight {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: none;
    }
    
    .metric-card.highlight .metric-label,
    .metric-card.highlight .metric-value {
      color: white;
    }
    
    .metric-card.google {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    
    .metric-card.meta {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    }
    
    .metric-card.google .metric-label,
    .metric-card.google .metric-value,
    .metric-card.meta .metric-label,
    .metric-card.meta .metric-value {
      color: white;
    }
    
    .metric-label {
      font-size: 11px;
      font-weight: 500;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    
    .metric-value {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
    }
    
    .metric-change {
      font-size: 12px;
      font-weight: 600;
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .metric-change.positive { color: #22c55e; }
    .metric-change.negative { color: #ef4444; }
    
    /* Hero Stats */
    .hero-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 30px;
    }
    
    .hero-stat {
      background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e5e5e5;
    }
    
    .hero-stat-label {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .hero-stat-value {
      font-size: 32px;
      font-weight: 800;
      color: #0f172a;
      margin: 8px 0;
    }
    
    .hero-stat-value.green { color: #22c55e; }
    
    .hero-stat-sub {
      font-size: 12px;
      color: #64748b;
    }
    
    .hero-stat-sub.positive { color: #22c55e; }
    .hero-stat-sub.negative { color: #ef4444; }
    
    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    
    .data-table th {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      font-weight: 600;
      text-align: left;
      padding: 14px 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 10px;
    }
    
    .data-table th:first-child {
      border-radius: 8px 0 0 0;
    }
    
    .data-table th:last-child {
      border-radius: 0 8px 0 0;
    }
    
    .data-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    
    .data-table tr:nth-child(even) {
      background: #fafafa;
    }
    
    .data-table tr:last-child td:first-child {
      border-radius: 0 0 0 8px;
    }
    
    .data-table tr:last-child td:last-child {
      border-radius: 0 0 8px 0;
    }
    
    .variation {
      font-weight: 600;
    }
    
    .variation.positive { color: #22c55e; }
    .variation.negative { color: #ef4444; }
    
    /* Investment Bar */
    .investment-section {
      margin-top: 24px;
    }
    
    .investment-bar {
      height: 32px;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .investment-bar-google {
      background: linear-gradient(90deg, #3b82f6, #2563eb);
    }
    
    .investment-bar-meta {
      background: linear-gradient(90deg, #0ea5e9, #0284c7);
    }
    
    .investment-legend {
      display: flex;
      gap: 40px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .legend-dot.google { background: #3b82f6; }
    .legend-dot.meta { background: #0ea5e9; }
    
    .legend-label {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    
    .legend-value {
      font-size: 12px;
      color: #64748b;
    }
    
    /* Page Footer */
    .page-footer {
      position: absolute;
      bottom: 20px;
      left: 40px;
      right: 40px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
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
      <div class="header-accent orange"></div>
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
        <div class="section-title">Comparativo com Período Anterior</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Período Atual</th>
              <th>Período Anterior</th>
              <th>Variação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Sessões</strong></td>
              <td>${formatNumber(data.ga4Atual.sessoes)}</td>
              <td>${formatNumber(data.ga4Anterior.sessoes)}</td>
              <td><span class="variation ${sessoesVar.isPositive ? 'positive' : 'negative'}">${sessoesVar.text}</span></td>
            </tr>
            <tr>
              <td><strong>Usuários</strong></td>
              <td>${formatNumber(data.ga4Atual.usuarios)}</td>
              <td>${formatNumber(data.ga4Anterior.usuarios)}</td>
              <td><span class="variation ${usuariosVar.isPositive ? 'positive' : 'negative'}">${usuariosVar.text}</span></td>
            </tr>
            <tr>
              <td><strong>Conversões</strong></td>
              <td>${formatNumber(data.ga4Atual.conversoes)}</td>
              <td>${formatNumber(data.ga4Anterior.conversoes)}</td>
              <td><span class="variation ${convVar.isPositive ? 'positive' : 'negative'}">${convVar.text}</span></td>
            </tr>
            <tr>
              <td><strong>Receita</strong></td>
              <td>${formatCurrency(data.ga4Atual.receita)}</td>
              <td>${formatCurrency(data.ga4Anterior.receita)}</td>
              <td><span class="variation ${receitaVar.isPositive ? 'positive' : 'negative'}">${receitaVar.text}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section investment-section">
        <div class="section-title">Distribuição de Investimento</div>
        <div class="investment-bar">
          <div class="investment-bar-google" style="width: ${googlePct}%"></div>
          <div class="investment-bar-meta" style="width: ${metaPct}%"></div>
        </div>
        <div class="investment-legend">
          <div class="legend-item">
            <div class="legend-dot google"></div>
            <div>
              <div class="legend-label">Google Ads</div>
              <div class="legend-value">${formatCurrency(data.googleAds.custo)} (${googlePct.toFixed(0)}%)</div>
            </div>
          </div>
          <div class="legend-item">
            <div class="legend-dot meta"></div>
            <div>
              <div class="legend-label">Meta Ads</div>
              <div class="legend-value">${formatCurrency(data.metaAds.custo)} (${metaPct.toFixed(0)}%)</div>
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
      <div class="header-accent orange"></div>
    </div>
    
    <div class="page-content">
      <div class="section">
        <div class="section-title">Métricas de Tráfego</div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Sessões</div>
            <div class="metric-value">${formatNumber(data.ga4Atual.sessoes)}</div>
            <div class="metric-change ${sessoesVar.isPositive ? 'positive' : 'negative'}">${sessoesVar.text}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Usuários</div>
            <div class="metric-value">${formatNumber(data.ga4Atual.usuarios)}</div>
            <div class="metric-change ${usuariosVar.isPositive ? 'positive' : 'negative'}">${usuariosVar.text}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Novos Usuários</div>
            <div class="metric-value">${formatNumber(data.ga4Atual.novoUsuarios)}</div>
            <div class="metric-change ${calcVariation(data.ga4Atual.novoUsuarios, data.ga4Anterior.novoUsuarios).isPositive ? 'positive' : 'negative'}">${calcVariation(data.ga4Atual.novoUsuarios, data.ga4Anterior.novoUsuarios).text}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Taxa de Rejeição</div>
            <div class="metric-value">${formatPercent(data.ga4Atual.taxaRejeicao * 100)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Duração Média</div>
            <div class="metric-value">${formatDuration(data.ga4Atual.duracaoMedia)}</div>
          </div>
          <div class="metric-card highlight">
            <div class="metric-label">Conversões</div>
            <div class="metric-value">${formatNumber(data.ga4Atual.conversoes)}</div>
            <div class="metric-change ${convVar.isPositive ? 'positive' : 'negative'}" style="color: ${convVar.isPositive ? '#86efac' : '#fca5a5'}">${convVar.text}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Receita</div>
        <div class="hero-stats" style="margin-bottom: 0;">
          <div class="hero-stat" style="grid-column: span 2;">
            <div class="hero-stat-label">Receita Total do Período</div>
            <div class="hero-stat-value green">${formatCurrency(data.ga4Atual.receita)}</div>
            <div class="hero-stat-sub ${receitaVar.isPositive ? 'positive' : 'negative'}">
              ${receitaVar.text} vs período anterior (${formatCurrency(data.ga4Anterior.receita)})
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Top Canais de Aquisição</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Canal</th>
              <th>Sessões</th>
              <th>Conversões</th>
            </tr>
          </thead>
          <tbody>
            ${data.ga4Atual.canais.slice(0, 5).map(c => `
            <tr>
              <td><strong>${c.nome || 'Direto'}</strong></td>
              <td>${formatNumber(c.sessoes)}</td>
              <td>${formatNumber(c.conversoes)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
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
