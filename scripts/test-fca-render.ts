// Smoke test do módulo server/fca/aprofundadoImage.ts — confirma que gera PNG.
import { writeFileSync } from "fs";
import { renderAprofundadoImage, type FcaSection } from "../server/fca/aprofundadoImage";

const sections: FcaSection[] = [
  { title: "Growth — Mídia", metrics: [
    { name: "Investimento", fmt: "currency", kind: "abs", r: 17334, o: 113500 },
    { name: "CPM", fmt: "currency", kind: "rate", r: 89.09, o: 70, inv: true },
    { name: "Tx Conversão da Página — Visualização de Página", fmt: "percent", kind: "pct", r: 0.17, o: 0.15 },
    { name: "MQL", fmt: "percent", kind: "pct", r: 0.082, o: null, indent: true },
    { name: "Não-MQL", fmt: "percent", kind: "pct", r: 0.088, o: null, indent: true },
    { name: "CPMQL", fmt: "currency", kind: "rate", r: 159.03, o: 182.18, inv: true },
  ]},
  { title: "Pré-vendas — MQL", metrics: [
    { name: "%RA MQL", fmt: "percent", kind: "pct", r: 0.138, o: 0.30 },
    { name: "% No-show MQL", fmt: "percent", kind: "pct", r: 0.067, o: 0.05, inv: true },
  ]},
];

const png = await renderAprofundadoImage({
  titulo: "Orçado × Realizado — Aprofundado · Creators × Meta Ads",
  subtitulo: "Smoke test do módulo server",
  sections, propDias: 5 / 31, diasMes: 31, diasRestantes: 26,
});
const out = "/private/tmp/claude-501/-Users-ichino-Projects-Cortex-Cortex/3641c4cb-0caa-4c53-a635-c86e29bea92a/scratchpad/fca-module-test.png";
writeFileSync(out, png);
console.log("OK módulo →", out, `(${(png.length / 1024).toFixed(0)} KB)`);
