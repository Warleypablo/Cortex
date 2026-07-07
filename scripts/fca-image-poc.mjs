// PoC v2 — Aprofundado como imagem (FCA v5) · TEMA ESCURO + paleta/thresholds reais do Cortex
// Cores e regra de status extraídas de client/src/pages/GrowthOrcadoRealizado.tsx:
//   normal  → %ating >=100 emerald · >=80 amber · else red
//   invertida (custo/no-show) → <=100 emerald · <=120 amber · else red
// Barra de % Atingido = o "percentual" que faz o constraint saltar aos olhos.
// Números reais da run Creators × Meta (MTD 1-5/jul). Uso: node scripts/fca-image-poc.mjs
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const OUT = '/private/tmp/claude-501/-Users-ichino-Projects-Cortex-Cortex/3641c4cb-0caa-4c53-a635-c86e29bea92a/scratchpad/fca-creators-meta-7d.png';

const diasMTD = 5, diasMes = 31;
const propDias = diasMTD / diasMes;
const diasRestantes = diasMes - diasMTD;

// inv = invertida (menor é melhor). kind: abs|rate|pct
const SECTIONS = [
  { title: 'Growth — Mídia', metrics: [
    { name: 'Investimento',                              fmt: 'currency', kind: 'abs',  r: 17334,  o: 113500 },
    { name: 'CPM',                                       fmt: 'currency', kind: 'rate', r: 89.09,  o: 70,     inv: true },
    { name: 'CTR de saída',                              fmt: 'percent',  kind: 'pct',  r: 0.0078, o: 0.0080 },
    { name: 'Visualizações de Página',                   fmt: 'number',   kind: 'abs',  r: 6420,   o: 41000 },
    { name: 'Sessões',                                   fmt: 'number',   kind: 'abs',  r: 5980,   o: 38000 },
    { name: 'Tx Conversão da Página — Visualização de Página', fmt: 'percent', kind: 'pct', r: 0.170, o: 0.150 },
    { name: 'MQL',                                       fmt: 'percent',  kind: 'pct',  r: 0.082,  o: null, indent: true },
    { name: 'Não-MQL',                                   fmt: 'percent',  kind: 'pct',  r: 0.088,  o: null, indent: true },
    { name: 'Tx Conversão da Página — Sessões',          fmt: 'percent',  kind: 'pct',  r: 0.126,  o: null },
    { name: 'MQL',                                       fmt: 'percent',  kind: 'pct',  r: 0.061,  o: null, indent: true },
    { name: 'Não-MQL',                                   fmt: 'percent',  kind: 'pct',  r: 0.065,  o: null, indent: true },
    { name: 'Leads',                                     fmt: 'number',   kind: 'abs',  r: 226,    o: 1557 },
    { name: 'CPL',                                       fmt: 'currency', kind: 'rate', r: 76.70,  o: 72.90,  inv: true },
    { name: 'MQLs',                                      fmt: 'number',   kind: 'abs',  r: 109,    o: 623 },
    { name: '% MQLs',                                    fmt: 'percent',  kind: 'pct',  r: 0.482,  o: 0.40 },
    { name: 'CPMQL',                                     fmt: 'currency', kind: 'rate', r: 159.03, o: 182.18, inv: true },
  ]},
  { title: 'Pré-vendas — MQL', metrics: [
    { name: '%RA MQL',                fmt: 'percent',  kind: 'pct',  r: 0.138,  o: 0.30 },
    { name: '% No-show MQL',          fmt: 'percent',  kind: 'pct',  r: 0.067,  o: 0.05, inv: true },
    { name: 'RR→Venda MQL',           fmt: 'percent',  kind: 'pct',  r: 0.214,  o: 0.30 },
  ]},
  { title: 'Pré-vendas — Não-MQL', metrics: [
    { name: '%RA Não-MQL',            fmt: 'percent',  kind: 'pct',  r: 0.085,  o: 0.14 },
    { name: '% No-show Não-MQL',      fmt: 'percent',  kind: 'pct',  r: 0.40,   o: 0.05, inv: true },
    { name: 'RR→Venda Não-MQL',       fmt: 'percent',  kind: 'pct',  r: 0.167,  o: 0.25 },
  ]},
  { title: 'Resultado', metrics: [
    { name: 'Negócios Ganhos',        fmt: 'number',   kind: 'abs',  r: 4,      o: null },
    { name: 'Contratos Ganhos',       fmt: 'number',   kind: 'abs',  r: 4,      o: null },
    { name: 'CAC - Negócio',          fmt: 'currency', kind: 'rate', r: 4333,   o: null, inv: true },
    { name: 'CAC - Contrato',         fmt: 'currency', kind: 'rate', r: 4333,   o: null, inv: true },
    { name: 'Ticket Médio',           fmt: 'currency', kind: 'rate', r: 6449,   o: null },
    { name: 'Faturamento Total',      fmt: 'currency', kind: 'abs',  r: 25797,  o: null },
  ]},
];

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtVal = (v, fmt) => v == null ? '—'
  : fmt === 'currency' ? 'R$ ' + nf2.format(v)
  : fmt === 'percent'  ? nf2.format(v * 100).replace('.', ',') + '%'
  : nf0.format(v);
const fmtSigned = (v, s) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}${s}`;

function cols(m) {
  const { r, o, kind } = m;
  const pctAting = (o == null || o === 0) ? null : (r / o) * 100;
  let desvio, previsao, recalc, recSuf;
  if (kind === 'pct') {
    desvio = (o == null || o === 0) ? null : ((r - o) / o) * 100;
    previsao = null; recalc = o == null ? null : (o - r) * 100; recSuf = 'pp';
  } else if (kind === 'rate') {
    desvio = (o == null || o === 0) ? null : ((r - o) / o) * 100;
    previsao = r; recalc = (o == null || o === 0) ? null : ((o - r) / o) * 100; recSuf = '%';
  } else {
    const esp = o == null ? null : o * propDias;
    desvio = (esp == null || esp === 0) ? null : ((r - esp) / esp) * 100;
    previsao = r / propDias;
    if (o == null || o === 0 || diasRestantes <= 0) recalc = null;
    else { const falta = o - r, espRest = o * (diasRestantes / diasMes);
      recalc = falta <= 0 ? 0 : (espRest === 0 ? null : (falta / espRest - 1) * 100); }
    recSuf = '%';
  }
  return { pctAting, desvio, previsao, recalc, recSuf };
}

// Regra de status IDÊNTICA ao código do Aprofundado
function statusOf(pct, inv) {
  if (pct == null) return 'none';
  if (inv) return pct <= 100 ? 'green' : pct <= 120 ? 'amber' : 'red';
  return pct >= 100 ? 'green' : pct >= 80 ? 'amber' : 'red';
}
// Paleta dark (Tailwind 400/500)
const C = {
  green: { txt: '#34d399', bar: '#10b981' },
  amber: { txt: '#fbbf24', bar: '#f59e0b' },
  red:   { txt: '#f87171', bar: '#ef4444' },
  none:  { txt: '#64748b', bar: '#334155' },
};

function bar(pct, st) {
  if (pct == null) return '<div class="bartrack"></div>';
  const w = Math.max(3, Math.min(100, pct));
  return `<div class="bartrack"><div class="barfill" style="width:${w}%;background:${C[st].bar}"></div></div>`;
}

function rowsHtml() {
  let html = '';
  for (const sec of SECTIONS) {
    html += `<tr class="sec"><td colspan="8">${sec.title}</td></tr>`;
    for (const m of sec.metrics) {
      const c = cols(m);
      const st = statusOf(c.pctAting, m.inv);
      const col = C[st].txt;
      const desvioGood = m.inv ? (c.desvio != null && c.desvio <= 0) : (c.desvio != null && c.desvio >= 0);
      const desvioCol = c.desvio == null ? C.none.txt : (desvioGood ? C.green.txt : C.red.txt);
      html += `<tr>
        <td class="metric${m.indent ? ' sub' : ''}">${m.indent ? '↳ ' : ''}${m.name}</td>
        <td class="num dim">${fmtVal(m.o, m.fmt)}</td>
        <td class="num" style="color:${col};font-weight:600">${fmtVal(m.r, m.fmt)}</td>
        <td class="pcell">
          <div class="prow"><span class="pval" style="color:${col}">${c.pctAting == null ? '—' : nf0.format(c.pctAting) + '%'}</span></div>
          ${bar(c.pctAting, st)}
        </td>
        <td class="num" style="color:${desvioCol}">${fmtSigned(c.desvio, '%')}</td>
        <td class="num dim">${fmtVal(c.previsao, m.fmt)}</td>
        <td class="num dim">${fmtSigned(c.recalc, c.recSuf)}</td>
      </tr>`;
    }
  }
  return html;
}

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Poppins', -apple-system, sans-serif; background: #020617; padding: 28px; }
  .card { width: 1000px; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; background: #0f172a; }
  .head { padding: 20px 24px; background: linear-gradient(135deg,#111c34,#0b1327); border-bottom: 1px solid #1e293b; }
  .head h1 { font-size: 17px; font-weight: 700; color: #f1f5f9; letter-spacing: -.2px; }
  .head .sub { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; font-weight: 600;
       text-align: right; padding: 12px 16px; background: #0b1327; border-bottom: 1px solid #1e293b; }
  th.l { text-align: left; }
  td { font-size: 12.5px; padding: 10px 16px; border-bottom: 1px solid #172033; color: #e2e8f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th { white-space: nowrap; }
  td.dim { color: #94a3b8; }
  td.metric { font-weight: 500; color: #f1f5f9; }
  td.metric.sub { padding-left: 40px; font-weight: 400; color: #94a3b8; font-size: 11.5px; }
  tr.sec td { background: #172033; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
              letter-spacing: .6px; color: #94a3b8; padding: 7px 16px; }
  tr:last-child td { border-bottom: none; }
  .pcell { width: 190px; }
  .prow { text-align: right; margin-bottom: 5px; }
  .pval { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .bartrack { height: 6px; background: #1e293b; border-radius: 4px; overflow: hidden; }
  .barfill { height: 100%; border-radius: 4px; }
</style></head>
<body><div class="card">
  <div class="head">
    <h1>Orçado × Realizado — Aprofundado · Creators × Meta Ads</h1>
    <div class="sub">Últimos 7 dias · 23–29/jun/2026 &nbsp;•&nbsp; PoC de layout (números da run MTD)</div>
  </div>
  <table>
    <thead><tr>
      <th class="l">Métrica</th><th>Orçado</th><th>Realizado</th><th>% Atingido</th>
      <th>Desvio Meta</th><th>Previsão As Is</th><th>Recálculo Meta</th>
    </tr></thead>
    <tbody>${rowsHtml()}</tbody>
  </table>
</div></body></html>`;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: puppeteer.executablePath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1120, height: 900, deviceScaleFactor: 2 });
  await page.setContent(HTML, { waitUntil: 'networkidle0' });
  const el = await page.$('.card');
  const buf = await el.screenshot({ type: 'png' });
  writeFileSync(OUT, buf);
  console.log('OK →', OUT, `(${(buf.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
