// Fonte única de verdade dos PRODUTOS das abas de Growth.
//
// Existem DOIS "tracks" porque as fontes de dados são diferentes — forçar uma
// única engine nos dois quebra as abas do Bitrix:
//
//  - Track 1 (aba Criativos): o produto vem do NOME da campanha (Meta/Google/TikTok).
//    Classificação por palavra-chave no nome → ver classificarProdutoCampanha().
//
//  - Track 2 (abas do Bitrix: Orçado×Realizado, Evolução Temporal, Planejamento Metas):
//    o produto vem da coluna fnl_ngc do CRM. O mapa fnl_ngc → bucket vive no backend
//    (server/routes/growth.ts: FNL_NGC_BUCKETS), porque depende dos valores reais do banco.
//
// Os LABELS canônicos são compartilhados pra UI ficar consistente entre as abas.

export const PRODUTO_OUTROS = "Outros";

// ---- Track 1: classificação por NOME de campanha (aba Criativos) ----
// ORDEM IMPORTA: o primeiro match vence. "Summit" vem antes de "Creators" pra
// "Creator Summit" não cair em Creators.
export interface ProdutoKeywordRule {
  label: string;
  keywords: string[]; // substring, case-insensitive
}

export const PRODUTO_CAMPANHA_RULES: ProdutoKeywordRule[] = [
  { label: "Summit", keywords: ["summit"] },
  { label: "Creators", keywords: ["creators"] },
  { label: "Ecommerce", keywords: ["ecommerce", "e-commerce", "commerce"] },
  { label: "Comercial", keywords: ["comercial"] },
  { label: "CRM", keywords: ["crm"] },
  { label: "Turbo", keywords: ["turbo"] },
];

// Labels exibidos no filtro da aba Criativos (na ordem desejada) + Outros no fim.
export const PRODUTOS_CRIATIVOS: string[] = [
  ...PRODUTO_CAMPANHA_RULES.map((r) => r.label),
  PRODUTO_OUTROS,
];

/** Classifica o NOME de uma campanha num produto canônico (ou "Outros"). */
export function classificarProdutoCampanha(nome: string | null | undefined): string {
  if (!nome) return PRODUTO_OUTROS;
  const n = nome.toLowerCase();
  for (const rule of PRODUTO_CAMPANHA_RULES) {
    if (rule.keywords.some((k) => n.includes(k))) return rule.label;
  }
  return PRODUTO_OUTROS;
}

// ---- Track 2: buckets por coluna fnl_ngc do CRM (abas do Bitrix) ----
// Mapa BUCKET canônico → valores reais em fnl_ngc (comparação case-insensitive / ILIKE).
// Selecionar um bucket no dropdown expande para os valores reais do banco.
// Creator Summit fica DE FORA de propósito (outra iniciativa) — ver bucketForFnlNgc().
export const FNL_NGC_BUCKETS: Record<string, string[]> = {
  Creators: ["Creators"],
  Ecommerce: ["Ecommerce", "E-commerce", "ecommerce"],
  Comercial: ["Comercial"],
  CRM: ["CRM"],
  Geral: ["Geral"],
  Outros: ["Bootcamp Performance", "Bootcamp Vendas", "Indicação", "Odonto", "IFV", "Lead", "Cross sell"],
};

// Ordem de exibição no dropdown (sem "(Vazio)", tratado à parte nos endpoints).
export const FNL_NGC_BUCKET_ORDER = ["Creators", "Ecommerce", "Comercial", "CRM", "Geral", "Outros"];

/**
 * Classifica um valor cru de fnl_ngc no seu bucket. Retorna null quando o valor
 * deve ser ESCONDIDO do filtro (Creator Summit → outra iniciativa).
 */
export function bucketForFnlNgc(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith("creator summit")) return null;
  for (const label of FNL_NGC_BUCKET_ORDER) {
    if (label === PRODUTO_OUTROS) continue;
    if (FNL_NGC_BUCKETS[label].some((x) => x.toLowerCase() === lower)) return label;
  }
  return PRODUTO_OUTROS;
}

/**
 * Expande os buckets selecionados (Creators, Ecommerce, Outros, ...) para os
 * valores reais de fnl_ngc que representam. Valor desconhecido passa direto.
 */
export function expandFunilValues(values: string[]): string[] {
  const expanded: string[] = [];
  for (const v of values) {
    const key = Object.keys(FNL_NGC_BUCKETS).find((k) => k.toLowerCase() === v.toLowerCase());
    if (key) expanded.push(...FNL_NGC_BUCKETS[key]);
    else expanded.push(v);
  }
  return expanded;
}
