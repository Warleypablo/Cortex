#!/usr/bin/env npx tsx
/**
 * calc-regimes.ts — comparativo determinístico de carga tributária
 * Simples Nacional (anexos I–V, Fator R, sublimite) × Lucro Presumido × Lucro Real (estimado)
 *
 * Uso:
 *   npx tsx calc-regimes.ts input.json     # roda o comparativo
 *   npx tsx calc-regimes.ts --exemplo      # imprime um input de exemplo
 *
 * Tabelas vigentes conforme LC 123/2006 (red. LC 155/2016). Valores anuais (12 meses).
 * A saída inclui a memória de cálculo — colar no Anexo 10 do relatório.
 */

import { readFileSync } from "node:fs";

type Anexo = "I" | "II" | "III" | "IV" | "V";
type PerfilPresumido = "servicos32" | "comercio8" | "transporte16" | "combustiveis16dec";

interface Atividade {
  nome: string;
  receita12m: number;
  anexoSimples: Anexo;
  sujeitaFatorR?: boolean; // atividade do Anexo V que migra p/ III com Fator R >= 28%
  presumido: PerfilPresumido;
  issAliquota?: number; // ex.: 0.05 (só serviços)
}

interface Input {
  empresa: string;
  atividades: Atividade[];
  folhaClt12m: number; // salários + encargos + FGTS (12m)
  prolabore12m: number;
  inssPatronalCltRate?: number; // default 0.268 (20% + RAT + terceiros)
  despesasDedutiveis12m: number; // p/ Lucro Real (inclui folha)
  baseCreditosPisCofins12m: number; // compras/despesas creditáveis (Lucro Real)
}

const FAIXAS = [180_000, 360_000, 720_000, 1_800_000, 3_600_000, 4_800_000];
const TABELAS: Record<Anexo, { nominal: number; pd: number }[]> = {
  I: [
    { nominal: 0.04, pd: 0 }, { nominal: 0.073, pd: 5_940 }, { nominal: 0.095, pd: 13_860 },
    { nominal: 0.107, pd: 22_500 }, { nominal: 0.143, pd: 87_300 }, { nominal: 0.19, pd: 378_000 },
  ],
  II: [
    { nominal: 0.045, pd: 0 }, { nominal: 0.078, pd: 5_940 }, { nominal: 0.10, pd: 13_860 },
    { nominal: 0.112, pd: 22_500 }, { nominal: 0.147, pd: 85_500 }, { nominal: 0.30, pd: 720_000 },
  ],
  III: [
    { nominal: 0.06, pd: 0 }, { nominal: 0.112, pd: 9_360 }, { nominal: 0.135, pd: 17_640 },
    { nominal: 0.16, pd: 35_640 }, { nominal: 0.21, pd: 125_640 }, { nominal: 0.33, pd: 648_000 },
  ],
  IV: [
    { nominal: 0.045, pd: 0 }, { nominal: 0.09, pd: 8_100 }, { nominal: 0.102, pd: 12_420 },
    { nominal: 0.14, pd: 39_780 }, { nominal: 0.22, pd: 183_780 }, { nominal: 0.33, pd: 828_000 },
  ],
  V: [
    { nominal: 0.155, pd: 0 }, { nominal: 0.18, pd: 4_500 }, { nominal: 0.195, pd: 9_900 },
    { nominal: 0.205, pd: 17_100 }, { nominal: 0.23, pd: 62_100 }, { nominal: 0.305, pd: 540_000 },
  ],
};

const fmt = (v: number) =>
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => (v * 100).toFixed(2).replace(".", ",") + "%";

function faixaIndex(rbt12: number): number {
  const i = FAIXAS.findIndex((limite) => rbt12 <= limite);
  return i === -1 ? 5 : i;
}

function aliquotaEfetiva(anexo: Anexo, rbt12: number) {
  const f = faixaIndex(rbt12);
  const { nominal, pd } = TABELAS[anexo][f];
  return { faixa: f + 1, nominal, pd, efetiva: (rbt12 * nominal - pd) / rbt12 };
}

function calcSimples(inp: Input, out: string[]) {
  const rbt12 = inp.atividades.reduce((s, a) => s + a.receita12m, 0);
  const folhaFatorR = inp.folhaClt12m + inp.prolabore12m;
  const fatorR = rbt12 > 0 ? folhaFatorR / rbt12 : 0;
  const patronalRate = inp.inssPatronalCltRate ?? 0.268;

  out.push(`\n== SIMPLES NACIONAL ==`);
  out.push(`RBT12 total: ${fmt(rbt12)} (faixa ${faixaIndex(rbt12) + 1})`);
  out.push(`Fator R = folha 12m (${fmt(inp.folhaClt12m)} CLT+encargos + ${fmt(inp.prolabore12m)} pró-labore) / RBT12 = ${pct(fatorR)} ${fatorR >= 0.28 ? "≥ 28% → atividades do Anexo V migram para o Anexo III" : "< 28% → Anexo V permanece"}`);
  if (rbt12 > 4_800_000) out.push(`⚠️ RBT12 acima do TETO de R$ 4,8 mi — Simples inviável (exclusão).`);
  else if (rbt12 > 3_600_000) out.push(`⚠️ RBT12 acima do SUBLIMITE de R$ 3,6 mi — ISS/ICMS saem do DAS e são apurados por fora (não incluídos abaixo; somar ISS ao comparar).`);

  let total = 0;
  let cppForaDas = 0;
  for (const a of inp.atividades) {
    let anexo = a.anexoSimples;
    if (anexo === "V" && a.sujeitaFatorR !== false && fatorR >= 0.28) anexo = "III";
    const e = aliquotaEfetiva(anexo, rbt12);
    const das = a.receita12m * e.efetiva;
    total += das;
    out.push(`  ${a.nome}: Anexo ${anexo}${anexo !== a.anexoSimples ? ` (era ${a.anexoSimples}, Fator R)` : ""} — efetiva = (${fmt(rbt12)} × ${pct(e.nominal)} − ${fmt(e.pd)}) / ${fmt(rbt12)} = ${pct(e.efetiva)} → DAS ${fmt(das)}`);
    if (anexo === "IV") cppForaDas = 1;
  }
  if (cppForaDas) {
    const cpp = patronalRate * inp.folhaClt12m + 0.20 * inp.prolabore12m;
    total += cpp;
    out.push(`  Anexo IV: CPP (INSS patronal) FORA do DAS: ${pct(patronalRate)} × folha CLT + 20% × pró-labore = ${fmt(cpp)}`);
  } else {
    out.push(`  INSS patronal: DENTRO do DAS (anexos I, II, III e V).`);
  }
  out.push(`TOTAL Simples: ${fmt(total)} (${pct(rbt12 > 0 ? total / rbt12 : 0)} da receita)`);
  return { total, fatorR, rbt12 };
}

function calcPresumido(inp: Input, out: string[]) {
  const receita = inp.atividades.reduce((s, a) => s + a.receita12m, 0);
  const patronalRate = inp.inssPatronalCltRate ?? 0.268;
  const basePres: Record<PerfilPresumido, { irpj: number; csll: number }> = {
    servicos32: { irpj: 0.32, csll: 0.32 },
    comercio8: { irpj: 0.08, csll: 0.12 },
    transporte16: { irpj: 0.16, csll: 0.12 },
    combustiveis16dec: { irpj: 0.016, csll: 0.12 },
  };

  out.push(`\n== LUCRO PRESUMIDO ==`);
  let baseIrpj = 0, baseCsll = 0, iss = 0;
  for (const a of inp.atividades) {
    const b = basePres[a.presumido];
    baseIrpj += a.receita12m * b.irpj;
    baseCsll += a.receita12m * b.csll;
    const issA = a.receita12m * (a.issAliquota ?? 0);
    iss += issA;
    out.push(`  ${a.nome}: base IRPJ ${pct(b.irpj)} = ${fmt(a.receita12m * b.irpj)} · base CSLL ${pct(b.csll)} = ${fmt(a.receita12m * b.csll)}${issA ? ` · ISS ${pct(a.issAliquota!)} = ${fmt(issA)}` : ""}`);
  }
  const irpj = 0.15 * baseIrpj + 0.10 * Math.max(0, baseIrpj - 240_000);
  const csll = 0.09 * baseCsll;
  const pisCofins = 0.0365 * receita;
  const patronal = patronalRate * inp.folhaClt12m + 0.20 * inp.prolabore12m;
  out.push(`  IRPJ: 15% × ${fmt(baseIrpj)} + 10% × max(0, base − R$ 240.000) = ${fmt(irpj)}`);
  out.push(`  CSLL: 9% × ${fmt(baseCsll)} = ${fmt(csll)}`);
  out.push(`  PIS/COFINS cumulativo: 3,65% × ${fmt(receita)} = ${fmt(pisCofins)} (SEM créditos)`);
  out.push(`  ISS: ${fmt(iss)}`);
  out.push(`  INSS patronal: ${pct(patronalRate)} × ${fmt(inp.folhaClt12m)} + 20% × ${fmt(inp.prolabore12m)} = ${fmt(patronal)}`);
  const total = irpj + csll + pisCofins + iss + patronal;
  out.push(`TOTAL Presumido: ${fmt(total)} (${pct(receita > 0 ? total / receita : 0)} da receita)`);
  return { total };
}

function calcReal(inp: Input, out: string[]) {
  const receita = inp.atividades.reduce((s, a) => s + a.receita12m, 0);
  const patronalRate = inp.inssPatronalCltRate ?? 0.268;
  out.push(`\n== LUCRO REAL (estimado) ==`);
  const lucro = receita - inp.despesasDedutiveis12m;
  out.push(`  Lucro antes de IRPJ/CSLL: ${fmt(receita)} − ${fmt(inp.despesasDedutiveis12m)} (despesas dedutíveis) = ${fmt(lucro)}`);
  const irpj = lucro > 0 ? 0.15 * lucro + 0.10 * Math.max(0, lucro - 240_000) : 0;
  const csll = lucro > 0 ? 0.09 * lucro : 0;
  const basePisCofins = Math.max(0, receita - inp.baseCreditosPisCofins12m);
  const pisCofins = 0.0925 * basePisCofins;
  const iss = inp.atividades.reduce((s, a) => s + a.receita12m * (a.issAliquota ?? 0), 0);
  const patronal = patronalRate * inp.folhaClt12m + 0.20 * inp.prolabore12m;
  out.push(`  IRPJ: 15% + adicional 10% acima de R$ 240 mil/ano = ${fmt(irpj)}${lucro <= 0 ? " (prejuízo — sem IRPJ/CSLL; prejuízo fiscal compensável, trava 30%)" : ""}`);
  out.push(`  CSLL: 9% = ${fmt(csll)}`);
  out.push(`  PIS/COFINS não cumulativo: 9,25% × (${fmt(receita)} − ${fmt(inp.baseCreditosPisCofins12m)} base creditável) = ${fmt(pisCofins)}`);
  out.push(`  ISS: ${fmt(iss)} · INSS patronal: ${fmt(patronal)}`);
  const total = irpj + csll + pisCofins + iss + patronal;
  out.push(`TOTAL Real: ${fmt(total)} (${pct(receita > 0 ? total / receita : 0)} da receita)`);
  return { total };
}

const EXEMPLO: Input = {
  empresa: "EXEMPLO LTDA",
  atividades: [
    { nome: "Serviços de marketing (recorrente)", receita12m: 2_400_000, anexoSimples: "V", sujeitaFatorR: true, presumido: "servicos32", issAliquota: 0.05 },
    { nome: "Produção de conteúdo/audiovisual", receita12m: 800_000, anexoSimples: "III", sujeitaFatorR: false, presumido: "servicos32", issAliquota: 0.05 },
  ],
  folhaClt12m: 300_000,
  prolabore12m: 120_000,
  despesasDedutiveis12m: 2_500_000,
  baseCreditosPisCofins12m: 400_000,
};

function main() {
  const arg = process.argv[2];
  if (!arg || arg === "--help") {
    console.log("Uso: npx tsx calc-regimes.ts <input.json> | --exemplo");
    process.exit(1);
  }
  if (arg === "--exemplo") {
    console.log(JSON.stringify(EXEMPLO, null, 2));
    return;
  }
  const inp: Input = JSON.parse(readFileSync(arg, "utf-8"));
  const out: string[] = [];
  out.push(`MEMÓRIA DE CÁLCULO — ${inp.empresa} — comparativo de regimes (12 meses)`);
  out.push(`Gerado por calc-regimes.ts; tabelas LC 123/2006 (LC 155/2016). Estimativas anuais.`);

  const simples = calcSimples(inp, out);
  const presumido = calcPresumido(inp, out);
  const real = calcReal(inp, out);

  out.push(`\n== COMPARATIVO ==`);
  const linhas: [string, number][] = [
    ["Simples Nacional", simples.total],
    ["Lucro Presumido", presumido.total],
    ["Lucro Real (estimado)", real.total],
  ];
  linhas.sort((a, b) => a[1] - b[1]);
  for (const [nome, v] of linhas) out.push(`  ${nome}: ${fmt(v)}`);
  out.push(`Melhor cenário: ${linhas[0][0]} — economia de ${fmt(linhas[1][1] - linhas[0][1])} vs 2º colocado.`);
  out.push(`\nPremissas/limitações: Lucro Real depende da qualidade de 'despesasDedutiveis12m' e`);
  out.push(`'baseCreditosPisCofins12m'; ICMS/IPI não modelados (incluir à parte se houver comércio/indústria);`);
  out.push(`no Simples acima do sublimite (R$ 3,6 mi) somar ISS/ICMS por fora. Validar com o contador.`);

  console.log(out.join("\n"));
}

main();
