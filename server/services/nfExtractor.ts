/**
 * NF Value Extraction Engine
 * Ported from attached_assets/2026/extrair_notas.py
 * Extracts monetary values from PDF invoice text using regex patterns.
 */
import * as pdfParse from "pdf-parse";
const pdf = (pdfParse as any).default || pdfParse;

const CAMBIO_USD_BRL = 6.0;

// ---- Value Parsers ----

export function parseBRL(valueStr: string): number | null {
  if (!valueStr) return null;
  let cleaned = valueStr.trim().replace(/\s/g, "");
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts[parts.length - 1].length > 2) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }
  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 0) return null;
  return val;
}

export function parseUSD(valueStr: string): number | null {
  if (!valueStr) return null;
  const cleaned = valueStr.trim().replace(/[\s,$]/g, "");
  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 0) return null;
  return val;
}

function smartParseValue(raw: string): number | null {
  if (!raw) return null;
  if (raw.includes(",") && raw.includes(".")) {
    const commaPos = raw.lastIndexOf(",");
    const dotPos = raw.lastIndexOf(".");
    return commaPos < dotPos ? parseUSD(raw) : parseBRL(raw);
  }
  return parseBRL(raw);
}

// ---- Regex Patterns ----
type PatternEntry = [RegExp, string, string];

const PATTERNS_BRL: PatternEntry[] = [
  // GRUPO 1: Valor Liquido (prioridade maxima)
  [/Valor\s+L[ií]quido\s+da\s+NFS-?e\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Liquido da NFS-e (mesma linha)"],
  [/Valor\s+L[ií]quido\s+da\s+NFS-?e\s*[-\s]*R\$([\d.,]+)/i, "BRL", "Valor Liquido da NFS-e (prox linha)"],
  [/VALOR\s+L[IÍ]QUIDO\s+DA\s+NOTA\s+FISCAL\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Liquido da Nota Fiscal"],
  [/VALOR\s+L[IÍ]QUIDO\s*[:=]\s*R\$\s*([\d.,]+)/i, "BRL", "VALOR LIQUIDO"],
  [/Valor\s+l[ií]quido\s*=\s*R\$\s*([\d.,]+)/i, "BRL", "Valor liquido = R$"],
  [/Vl\.\s*L[ií]quido\s+(?:da\s+)?Nota\s+Fiscal\s*R?\$?\s*([\d.,]+)/i, "BRL", "Vl. Liquido da Nota Fiscal"],
  [/Valor\s+L[ií]quido\s+([\d][\d.,]*)/i, "BRL", "Valor Liquido (sem R$)"],

  // GRUPO 2: Valor Total da Nota / NFS-e
  [/VALOR\s+TOTAL\s+RECEBIDO\s*=?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total Recebido"],
  [/VALOR\s+TOTAL\s+DA\s+NOTA\s+FISCAL\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total da Nota Fiscal"],
  [/Valor\s+Total\s+dos\s+Servi[çc]os\s*\n\s*([\d.,]+)/i, "BRL", "Valor Total dos Servicos (prox linha)"],
  [/Valor\s+Total\s+da\s+Nota\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total da Nota (com R$)"],
  [/Valor\s+Total\s+da\s+Nota\s*[:=]\s*([\d][\d.,]*)/i, "BRL", "Valor Total da Nota (sem R$)"],
  [/Valor\s+Total\s+da\s+NFS-?e\s+([\d.,]+)/i, "BRL", "Valor Total da NFS-e (inline)"],
  [/VALOR\s+TOTAL\s+DO\s+SERVI[CÇ]O\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total do Servico"],
  [/Valor\s+Total\s+do\s+Documento\s*[:=]?\s*R?\$?\s*([\d.,]+)/i, "BRL", "Valor Total do Documento"],

  // GRUPO 3: Formatos concatenados (Vitoria)
  [/VALORTOTALDANFS-?E[\s\S]*?R\$([\d.,]+)/i, "BRL", "VALORTOTALDANFS-E (Vitoria)"],
  [/Valordoservi[çc]o[\s\S]*?R\$([\d.,]+)/i, "BRL", "ValordoServico (Vitoria)"],

  // GRUPO 4: NFS-e Vila Velha / Cariacica
  [/VALOR\s+TOTAL\s+DA\s+NFS-?E[\s\S]*?R\$([\d.,]+)/i, "BRL", "VALOR TOTAL DA NFS-E (espacos)"],
  [/Valor\s+do\s+Servi[çc]o\s+Desconto\s+Condicionado[\s\S]*?R\$([\d.,]+)/i, "BRL", "Valor do Servico (Vila Velha)"],

  // GRUPO 5: Faturas e contas
  [/Valor\s+fatura\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor fatura"],
  [/Valor\s+devido\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor devido"],
  [/Total\s+a\s+Pagar\s*[-:=]?\s*R?\$?\s*([\d.,]+)/i, "BRL", "Total a Pagar"],
  [/Total\s+a\s+Recolher\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Total a Recolher"],
  [/TOTAL\s+A\s+PAGAR\s*([\d.,]+)/i, "BRL", "TOTAL A PAGAR"],
  [/Valor\s+Total\s*[:=]\s*R?\$?\s*([\d.,]+)/i, "BRL", "Valor Total"],
  [/\nValor:\s*([\d.,]+)/i, "BRL", "Valor: (boleto)"],

  // GRUPO 6: EDP energia
  [/(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+R\$\s*([\d.,]+)/i, "BRL", "EDP Energia"],

  // GRUPO 8: Boleto (quantidade + R$)
  [/\n1\s+R\$\s*([\d.,]+)/i, "BRL", "Boleto (1 R$)"],
];

const PATTERNS_USD: PatternEntry[] = [
  [/Amount\s+due\s*\$?\s*([\d.,]+)/i, "USD", "Amount due (USD)"],
  [/Total\s+amount\s*([\d.,]+)\s*USD/i, "USD", "Total amount USD"],
];

// ---- Main Extraction ----

export function extractValueFromText(text: string): { valor: number | null; moeda: string; padrao: string } {
  if (!text) return { valor: null, moeda: "", padrao: "" };

  // Try BRL patterns first
  for (const [pattern, _currency, desc] of PATTERNS_BRL) {
    const match = pattern.exec(text);
    if (match) {
      const value = smartParseValue(match[1]);
      if (value !== null && value > 0) {
        return { valor: value, moeda: "BRL", padrao: desc };
      }
    }
  }

  // Try USD patterns
  for (const [pattern, _currency, desc] of PATTERNS_USD) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseUSD(match[1]);
      if (value !== null && value > 0) {
        return { valor: Math.round(value * CAMBIO_USD_BRL * 100) / 100, moeda: "USD", padrao: desc };
      }
    }
  }

  // Fallback: Valor Liquido in table header, value in data line
  const vlHeader = /Valor\s+L[ií]quido\s*\n([\d.,\s]+)/i.exec(text);
  if (vlHeader) {
    const numbers = vlHeader[1].trim().match(/[\d.,]+/g);
    if (numbers) {
      const value = smartParseValue(numbers[numbers.length - 1]);
      if (value !== null && value > 0) return { valor: value, moeda: "BRL", padrao: "Valor Liquido (tabela, ultimo)" };
    }
  }

  // Fallback: NFe - VALOR TOTAL DA NOTA followed by multiple R$
  const nfeMatch = /VALOR\s+TOTAL\s+DA\s+NOTA\s*\n(.*)/i.exec(text);
  if (nfeMatch) {
    const allValues: string[] = [];
    const rePat = /R\$\s*([\d.,]+)/g;
    let mm;
    while ((mm = rePat.exec(nfeMatch[1])) !== null) allValues.push(mm[1]);
    if (allValues.length > 0) {
      const value = smartParseValue(allValues[allValues.length - 1]);
      if (value !== null && value > 0) return { valor: value, moeda: "BRL", padrao: "VALOR TOTAL DA NOTA (NFe ultimo)" };
    }
  }

  // Fallback: Valor Total do Documento on next line
  const dasMatch = /Valor\s+Total\s+do\s+Documento\s*\n\s*([\d.,]+)/i.exec(text);
  if (dasMatch) {
    const value = smartParseValue(dasMatch[1]);
    if (value !== null && value > 0) return { valor: value, moeda: "BRL", padrao: "Valor Total do Documento (prox linha)" };
  }

  // Fallback: largest R$ in text (excluding tributo/multa/juros lines)
  let bestVal = 0;
  for (const line of text.split("\n")) {
    const ll = line.toLowerCase();
    if (["tributo", "multa", "juros", "aproximado", "vencimento"].some(k => ll.includes(k))) continue;
    const reVal = /R\$\s*([\d.]+,\d{2})/g;
    let mv;
    while ((mv = reVal.exec(line)) !== null) {
      const v = smartParseValue(mv[1]);
      if (v && v > bestVal) bestVal = v;
    }
  }
  if (bestVal > 0) return { valor: bestVal, moeda: "BRL", padrao: "Maior R$ encontrado (fallback)" };

  return { valor: null, moeda: "", padrao: "" };
}

// ---- PDF Processing ----

export async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; status: string }> {
  try {
    const data = await pdf(buffer);
    if (data.text && data.text.trim().length > 0) {
      return { text: data.text, status: "OK" };
    }
    return { text: "", status: "SEM_TEXTO" };
  } catch (e: any) {
    const msg = String(e.message || "").toLowerCase();
    if (msg.includes("password") || msg.includes("encrypt")) {
      return { text: "", status: "PROTEGIDO" };
    }
    return { text: "", status: `ERRO: ${e.message}` };
  }
}

export function extractPrestadorFromFilename(filename: string): string {
  const match = filename.match(/^(.+?)\s*-\s*/);
  return match ? match[1].trim() : filename.replace(/\.pdf$/i, "").trim();
}
