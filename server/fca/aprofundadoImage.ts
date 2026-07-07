// FCA v5 — render das colunas do Aprofundado como imagem (PNG) + upload inline no ClickUp.
// Espelha a aba Orçado × Realizado do Cortex: 7 colunas, paleta/thresholds emerald/amber/red,
// barra de % Atingido (faz o constraint saltar), quebras MQL/Não-MQL indentadas.
// Reaproveita a resolução de Chromium de server/autoreport/pdf.ts (prod-safe).
import puppeteer from "puppeteer";
import * as fs from "fs";
import { execSync } from "child_process";

export type MetricFmt = "currency" | "number" | "percent";
export type MetricKind = "abs" | "rate" | "pct"; // abs prorrateia; rate/pct não

export interface FcaMetric {
  name: string;
  fmt: MetricFmt;
  kind: MetricKind;
  r: number | null;   // realizado
  o: number | null;   // orçado (null = sem meta → 🔘)
  inv?: boolean;       // invertida (custo/no-show): menor é melhor
  indent?: boolean;    // sub-linha (MQL / Não-MQL)
}
export interface FcaSection { title: string; metrics: FcaMetric[]; }
export interface RenderInput {
  titulo: string;
  subtitulo: string;
  sections: FcaSection[];
  propDias: number;      // dias decorridos / dias do período (prorrateio das absolutas)
  diasMes: number;
  diasRestantes: number;
}

function findChromiumPath(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const p of candidates) if (p && fs.existsSync(p)) return p;
  try {
    const nix = execSync(
      "which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null",
      { encoding: "utf8" },
    ).trim();
    if (nix && fs.existsSync(nix)) return nix;
  } catch { /* ignore */ }
  try { const bundled = puppeteer.executablePath(); if (bundled && fs.existsSync(bundled)) return bundled; } catch { /* ignore */ }
  return undefined;
}

const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtVal = (v: number | null, fmt: MetricFmt): string =>
  v == null ? "—"
    : fmt === "currency" ? "R$ " + nf2.format(v)
    : fmt === "percent" ? nf2.format(v * 100).replace(".", ",") + "%"
    : nf0.format(v);
const fmtSigned = (v: number | null, s: string): string =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}${s}`;

function cols(m: FcaMetric, propDias: number, diasMes: number, diasRestantes: number) {
  const { r, o, kind } = m;
  const pctAting = (o == null || o === 0 || r == null) ? null : (r / o) * 100;
  let desvio: number | null, previsao: number | null, recalc: number | null, recSuf: string;
  if (kind === "pct") {
    desvio = (o == null || o === 0 || r == null) ? null : ((r - o) / o) * 100;
    previsao = null; recalc = (o == null || r == null) ? null : (o - r) * 100; recSuf = "pp";
  } else if (kind === "rate") {
    desvio = (o == null || o === 0 || r == null) ? null : ((r - o) / o) * 100;
    previsao = r; recalc = (o == null || o === 0 || r == null) ? null : ((o - r) / o) * 100; recSuf = "%";
  } else {
    const esp = o == null ? null : o * propDias;
    desvio = (esp == null || esp === 0 || r == null) ? null : ((r - esp) / esp) * 100;
    previsao = r == null || propDias === 0 ? null : r / propDias;
    if (o == null || o === 0 || diasRestantes <= 0 || r == null) recalc = null;
    else { const falta = o - r, espRest = o * (diasRestantes / diasMes);
      recalc = falta <= 0 ? 0 : (espRest === 0 ? null : (falta / espRest - 1) * 100); }
    recSuf = "%";
  }
  return { pctAting, desvio, previsao, recalc, recSuf };
}

// Regra de status idêntica ao Aprofundado (GrowthOrcadoRealizado.tsx)
function statusOf(pct: number | null, inv?: boolean): "green" | "amber" | "red" | "none" {
  if (pct == null) return "none";
  if (inv) return pct <= 100 ? "green" : pct <= 120 ? "amber" : "red";
  return pct >= 100 ? "green" : pct >= 80 ? "amber" : "red";
}
const C = {
  green: { txt: "#34d399", bar: "#10b981" },
  amber: { txt: "#fbbf24", bar: "#f59e0b" },
  red: { txt: "#f87171", bar: "#ef4444" },
  none: { txt: "#64748b", bar: "#334155" },
};
const barHtml = (pct: number | null, st: keyof typeof C) =>
  pct == null ? '<div class="bartrack"></div>'
    : `<div class="bartrack"><div class="barfill" style="width:${Math.max(3, Math.min(100, pct))}%;background:${C[st].bar}"></div></div>`;

function buildHtml(input: RenderInput): string {
  const { sections, propDias, diasMes, diasRestantes } = input;
  let rows = "";
  for (const sec of sections) {
    rows += `<tr class="sec"><td colspan="7">${sec.title}</td></tr>`;
    for (const m of sec.metrics) {
      const c = cols(m, propDias, diasMes, diasRestantes);
      const st = statusOf(c.pctAting, m.inv);
      const col = C[st].txt;
      const desvioGood = m.inv ? (c.desvio != null && c.desvio <= 0) : (c.desvio != null && c.desvio >= 0);
      const desvioCol = c.desvio == null ? C.none.txt : (desvioGood ? C.green.txt : C.red.txt);
      rows += `<tr>
        <td class="metric${m.indent ? " sub" : ""}">${m.indent ? "↳ " : ""}${m.name}</td>
        <td class="num dim">${fmtVal(m.o, m.fmt)}</td>
        <td class="num" style="color:${col};font-weight:600">${fmtVal(m.r, m.fmt)}</td>
        <td class="pcell"><div class="prow"><span class="pval" style="color:${col}">${c.pctAting == null ? "—" : nf0.format(c.pctAting) + "%"}</span></div>${barHtml(c.pctAting, st)}</td>
        <td class="num" style="color:${desvioCol}">${fmtSigned(c.desvio, "%")}</td>
        <td class="num dim">${fmtVal(c.previsao, m.fmt)}</td>
        <td class="num dim">${fmtSigned(c.recalc, c.recSuf)}</td>
      </tr>`;
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Poppins', -apple-system, sans-serif; background: #020617; padding: 28px; }
  .card { width: 1000px; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; background: #0f172a; }
  .head { padding: 20px 24px; background: linear-gradient(135deg,#111c34,#0b1327); border-bottom: 1px solid #1e293b; }
  .head h1 { font-size: 17px; font-weight: 700; color: #f1f5f9; letter-spacing: -.2px; }
  .head .sub { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; font-weight: 600; text-align: right; padding: 12px 16px; background: #0b1327; border-bottom: 1px solid #1e293b; white-space: nowrap; }
  th.l { text-align: left; }
  td { font-size: 12.5px; padding: 10px 16px; border-bottom: 1px solid #172033; color: #e2e8f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.dim { color: #94a3b8; }
  td.metric { font-weight: 500; color: #f1f5f9; }
  td.metric.sub { padding-left: 40px; font-weight: 400; color: #94a3b8; font-size: 11.5px; }
  tr.sec td { background: #172033; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #94a3b8; padding: 7px 16px; }
  tr:last-child td { border-bottom: none; }
  .pcell { width: 190px; }
  .prow { text-align: right; margin-bottom: 5px; }
  .pval { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .bartrack { height: 6px; background: #1e293b; border-radius: 4px; overflow: hidden; }
  .barfill { height: 100%; border-radius: 4px; }
</style></head>
<body><div class="card">
  <div class="head"><h1>${input.titulo}</h1><div class="sub">${input.subtitulo}</div></div>
  <table>
    <thead><tr>
      <th class="l">Métrica</th><th>Orçado</th><th>Realizado</th><th>% Atingido</th>
      <th>Desvio Meta</th><th>Previsão As Is</th><th>Recálculo Meta</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div></body></html>`;
}

export async function renderAprofundadoImage(input: RenderInput): Promise<Buffer> {
  const chromiumPath = findChromiumPath();
  if (!chromiumPath) throw new Error("Chromium não encontrado para render do FCA.");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 900, deviceScaleFactor: 2 });
    await page.setContent(buildHtml(input), { waitUntil: "networkidle0" });
    const el = await page.$(".card");
    if (!el) throw new Error("Card não renderizado.");
    return Buffer.from(await el.screenshot({ type: "png" }));
  } finally {
    await browser.close();
  }
}

// Sobe o PNG no ClickUp (REST multipart) e devolve a URL clickup-attachments.com pra embutir inline.
export async function uploadFcaImage(taskId: string, png: Buffer, apiKey: string, fileName = "fca-aprofundado.png"): Promise<string> {
  const fd = new FormData();
  fd.append("attachment", new Blob([png], { type: "image/png" }), fileName);
  const r = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
    method: "POST",
    headers: { Authorization: apiKey },
    body: fd,
  });
  if (!r.ok) throw new Error(`ClickUp attachment error ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { url: string };
  return j.url;
}
