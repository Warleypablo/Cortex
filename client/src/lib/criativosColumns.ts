// Registro central das colunas de métrica da tabela de Criativos.
// Fonte única para: render data-driven, configuração de visibilidade/ordem,
// larguras (resize) e visualizações salvas (persistidas no navegador).

import type { CriativoData } from "@/lib/criativosMetrics";

export type ColumnFormat = "currency" | "percent" | "number" | "days" | "roas";

export interface ColumnDef {
  key: keyof CriativoData;
  label: string;
  group: string;
  format: ColumnFormat;
  color?: boolean; // aplica colorização condicional (getCellColor)
  colorKey?: string; // metricKey usado na colorização (default = key)
  invert?: boolean; // na comparação, menor é melhor
  defaultVisible: boolean;
  defaultWidth: number;
  // Plataformas que possuem essa métrica NATIVA. undefined = universal (vale p/ todas;
  // ex.: métricas do Bitrix — leads, MQL, RA, RR, vendas — e CPM/CTR comuns a todas).
  // Quando definido, a coluna só aparece se a plataforma selecionada estiver na lista
  // (ou se nenhuma plataforma específica estiver selecionada — visão "Todas").
  platforms?: string[];
}

// Rótulos de plataforma usados nas tags de coluna e no filtro.
export const PLAT_META = "Meta Ads";
export const PLAT_GOOGLE = "Google Ads";
export const PLAT_TIKTOK = "TikTok Ads";

// Largura especial da coluna de nome (congelada, redimensionável).
export const NAME_COL_KEY = "__name__";
export const NAME_DEFAULT_WIDTH = 280;

const C = (
  key: keyof CriativoData,
  label: string,
  group: string,
  format: ColumnFormat,
  opts: Partial<ColumnDef> = {},
): ColumnDef => ({
  key,
  label,
  group,
  format,
  defaultVisible: true,
  defaultWidth: format === "currency" ? 100 : format === "percent" ? 88 : 92,
  ...opts,
});

export const ALL_COLUMNS: ColumnDef[] = [
  // Investimento
  C("investimento", "Invest", "Investimento", "currency", { defaultWidth: 104 }),
  C("orcamentoDiario", "Orçamento", "Investimento", "currency", { defaultWidth: 116 }),
  C("cpm", "CPM", "Investimento", "currency", { color: true, invert: true }),
  // Vídeo
  // Hook/Hold são nativas do Meta (3s / thruplay sobre impressões).
  C("videoHook", "Video hook", "Vídeo", "percent", { color: true, platforms: [PLAT_META] }),
  C("videoHold", "Video hold", "Vídeo", "percent", { color: true, platforms: [PLAT_META] }),
  // Video views: contador nativo do Google e do TikTok.
  C("videoViews", "Video views", "Vídeo", "number", { platforms: [PLAT_GOOGLE, PLAT_TIKTOK] }),
  // Tráfego
  C("ctr", "CTR de saída", "Tráfego", "percent", { color: true }),
  // CTR de saída único = cliques de saída únicos / alcance. Só o Meta expõe o dado;
  // demais plataformas mostram "—".
  C("ctrUnico", "CTR de saída único", "Tráfego", "percent", { color: true, defaultWidth: 116 }),
  // Connect rate depende de landing_page_views (só Meta reporta) → nativa do Meta.
  C("connectRate", "Connect rate", "Tráfego", "percent", { color: true, defaultWidth: 104, platforms: [PLAT_META] }),
  C("taxaConversao", "Taxa conv.", "Tráfego", "percent", { color: true, defaultWidth: 96 }),
  // Conversões reportadas pela própria plataforma (pixel/tag) — Google e TikTok.
  C("conversions", "Conv. plat.", "Tráfego", "number", { platforms: [PLAT_GOOGLE, PLAT_TIKTOK], defaultWidth: 96 }),
  C("conversionValue", "Valor conv.", "Tráfego", "currency", { platforms: [PLAT_GOOGLE], defaultVisible: false, defaultWidth: 104 }),
  // Leads
  C("leads", "Leads", "Leads", "number"),
  C("cpl", "CPL", "Leads", "currency", { color: true, invert: true }),
  // MQL
  C("mql", "MQL", "MQL", "number"),
  C("cpmql", "CPMQL", "MQL", "currency", { color: true, invert: true }),
  C("percMql", "%MQL", "MQL", "percent", { color: true }),
  // Descarte
  C("descartadoPerc", "Desc. %", "Descarte", "percent", { defaultVisible: true }),
  C("descartadoMqlPerc", "Desc. MQL %", "Descarte", "percent", { defaultVisible: false, defaultWidth: 100 }),
  C("descartadoNmqlPerc", "Desc. NMQL %", "Descarte", "percent", { defaultVisible: false, defaultWidth: 104 }),
  // Reunião agendada (RA)
  C("percRa", "RA %", "Reunião agendada", "percent", { color: true }),
  C("percRaMql", "RA MQL %", "Reunião agendada", "percent", { color: true, defaultVisible: false }),
  C("percRaNmql", "RA NMQL %", "Reunião agendada", "percent", { color: true, defaultVisible: false }),
  C("cpra", "CPRA", "Reunião agendada", "currency", { color: true, colorKey: "cpmql", invert: true }),
  C("cpraMql", "CPRA MQL", "Reunião agendada", "currency", { color: true, colorKey: "cpmql", invert: true, defaultVisible: false }),
  C("cpraNmql", "CPRA NMQL", "Reunião agendada", "currency", { color: true, colorKey: "cpmql", invert: true, defaultVisible: false }),
  // Reunião realizada (RR)
  C("percRr", "RR %", "Reunião realizada", "percent", { color: true }),
  C("percRrMql", "RR MQL %", "Reunião realizada", "percent", { color: true, defaultVisible: false }),
  C("percRrNmql", "RR NMQL %", "Reunião realizada", "percent", { color: true, defaultVisible: false }),
  C("cprr", "CPRR", "Reunião realizada", "currency", { color: true, colorKey: "cpmql", invert: true }),
  C("cprrMql", "CPRR MQL", "Reunião realizada", "currency", { color: true, colorKey: "cpmql", invert: true, defaultVisible: false }),
  C("cprrNmql", "CPRR NMQL", "Reunião realizada", "currency", { color: true, colorKey: "cpmql", invert: true, defaultVisible: false }),
  // RR → Venda
  C("percRrVendas", "RR→V %", "RR → Venda", "percent", { color: true }),
  C("percRrMqlVendas", "RR MQL→V %", "RR → Venda", "percent", { color: true, defaultVisible: false, defaultWidth: 104 }),
  C("percRrNmqlVendas", "RR NMQL→V %", "RR → Venda", "percent", { color: true, defaultVisible: false, defaultWidth: 108 }),
  // Vendas & Receita
  C("clientesUnicos", "Neg. ganho", "Vendas & Receita", "number", { defaultWidth: 96 }),
  C("leadTime", "Lead Time", "Vendas & Receita", "days", { defaultWidth: 96 }),
  C("aov", "AOV", "Vendas & Receita", "currency"),
  C("receita", "Receita", "Vendas & Receita", "currency"),
  C("receitaPontual", "Rec. pontual", "Vendas & Receita", "currency", { defaultVisible: false, defaultWidth: 110 }),
  C("receitaRecorrente", "Rec. recorrente", "Vendas & Receita", "currency", { defaultVisible: false, defaultWidth: 120 }),
  // CAC
  C("cacGeral", "CAC", "CAC", "currency", { invert: true }),
  C("cacUnico", "CAC único", "CAC", "currency", { color: true, invert: true, defaultVisible: false, defaultWidth: 100 }),
  C("cacContrato", "CAC contrato", "CAC", "currency", { color: true, invert: true, defaultVisible: false, defaultWidth: 112 }),
  C("roas", "ROAS", "CAC", "roas", { defaultWidth: 84 }),
];

const COLUMN_BY_KEY = new Map(ALL_COLUMNS.map((c) => [c.key as string, c]));

// Ordem dos grupos (para o painel de configuração)
export const COLUMN_GROUP_ORDER: string[] = [];
for (const c of ALL_COLUMNS) {
  if (!COLUMN_GROUP_ORDER.includes(c.group)) COLUMN_GROUP_ORDER.push(c.group);
}

export interface ColumnConfig {
  order: string[]; // ordem das colunas de métrica (keys)
  visible: string[]; // subconjunto visível
  widths: Record<string, number>; // key -> largura (inclui NAME_COL_KEY)
}

export interface SavedView {
  id: string;
  name: string;
  config: ColumnConfig;
}

export function defaultConfig(): ColumnConfig {
  return {
    order: ALL_COLUMNS.map((c) => c.key as string),
    visible: ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key as string),
    widths: {},
  };
}

/** Garante que a config cobre exatamente as colunas conhecidas (robusto a adição/remoção). */
export function normalizeConfig(cfg: Partial<ColumnConfig> | null | undefined): ColumnConfig {
  const base = defaultConfig();
  if (!cfg) return base;
  const known = new Set(ALL_COLUMNS.map((c) => c.key as string));
  // ordem: mantém a salva (válida) + acrescenta novas ao final
  const order = (cfg.order || []).filter((k) => known.has(k));
  for (const k of base.order) if (!order.includes(k)) order.push(k);
  // visível: interseção com conhecidas; se vazio, usa default
  const visible = (cfg.visible || base.visible).filter((k) => known.has(k));
  return {
    order,
    visible: visible.length ? visible : base.visible,
    widths: { ...(cfg.widths || {}) },
  };
}

/** Lista ordenada de ColumnDef visíveis, conforme a config. */
export function resolveColumns(cfg: ColumnConfig): ColumnDef[] {
  return cfg.order
    .map((k) => COLUMN_BY_KEY.get(k))
    .filter((c): c is ColumnDef => !!c && cfg.visible.includes(c.key as string));
}

/**
 * Decide se uma coluna se aplica às plataformas selecionadas.
 * - Coluna universal (sem `platforms`) → sempre aplica.
 * - Nenhuma plataforma selecionada (visão "Todas") → mostra todas as nativas.
 * - Plataforma(s) selecionada(s) → só aparece se houver interseção.
 */
export function columnAppliesToPlatforms(def: ColumnDef, selected: string[]): boolean {
  if (!def.platforms || def.platforms.length === 0) return true;
  if (!selected || selected.length === 0) return true;
  return def.platforms.some((p) => selected.includes(p));
}

export function columnWidth(cfg: ColumnConfig, key: string, fallback: number): number {
  const w = cfg.widths[key];
  return typeof w === "number" && w > 0 ? w : fallback;
}

// ───────────── Persistência (localStorage) ─────────────
const CONFIG_KEY = "criativos:colconfig:v1";
const VIEWS_KEY = "criativos:colviews:v1";

export function loadConfig(): ColumnConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return normalizeConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultConfig();
  }
}

export function persistConfig(cfg: ColumnConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function persistViews(views: SavedView[]): void {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    /* ignore */
  }
}
