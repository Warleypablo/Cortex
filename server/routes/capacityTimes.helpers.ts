// Helpers da aba Capacity por função (Selva / Black / Squadra).
// As pessoas vêm de "Inhire".rh_pessoal por cargo; a carteira é calculada via
// `responsavel` (GPs/accounts) ou via squad de CS (designers).

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function utilPct(atual: number, cap: number | null | undefined): number | null {
  if (cap === null || cap === undefined || cap === 0) return null;
  return Math.round((atual / cap) * 1000) / 10;
}

export function diff(cap: number | null | undefined, atual: number): number | null {
  if (cap === null || cap === undefined) return null;
  return cap - atual;
}

// ── Black / Squadra (carteira via responsavel) ──

export interface ComercialRow {
  nome: string;
  mrr_atual: number;
  mrr_ativo: number;
  mrr_onboarding: number;
  mrr_cancelamento: number;
  cap_mrr: number | null;
  dif_mrr: number | null;
  contas_ativas: number;
  cap_contas: number | null;
  dif_contas: number | null;
  util_mrr_pct: number | null; // mrr_atual / cap_mrr
  util_contas_pct: number | null; // contas_ativas / cap_contas
  util_pct: number | null; // legado p/ alertas: igual a util_mrr_pct
}

export function toComercialRow(raw: any): ComercialRow {
  const mrr_atual = num(raw.mrr_operando);
  const cap_mrr = numOrNull(raw.cap_mrr);
  const contas_ativas = num(raw.contas_rec ?? raw.contas_ativas);
  const cap_contas = numOrNull(raw.cap_contas);
  const util_mrr_pct = utilPct(mrr_atual, cap_mrr);
  return {
    nome: String(raw.nome),
    mrr_atual,
    mrr_ativo: num(raw.mrr_ativo),
    mrr_onboarding: num(raw.mrr_onboarding),
    mrr_cancelamento: num(raw.mrr_cancelamento),
    cap_mrr,
    dif_mrr: diff(cap_mrr, mrr_atual),
    contas_ativas,
    cap_contas,
    dif_contas: diff(cap_contas, contas_ativas),
    util_mrr_pct,
    util_contas_pct: utilPct(contas_ativas, cap_contas),
    util_pct: util_mrr_pct,
  };
}

// ── Selva (designers): carteira via responsavel da subtask, régua por faturamento ──

export interface SelvaRow {
  nome: string;
  contas: number; // contas (rec + pontual) onde o designer é responsável
  fat_recorrente: number;
  fat_pontual: number;
  faturamento: number; // rec + pont
  ticket_medio: number | null; // faturamento / contas
  cap_fat: number | null; // ticket_medio * meta_contas_designer
  util_pct: number | null; // faturamento / cap_fat
}

export function toSelvaRow(raw: any, metaContasDesigner: number): SelvaRow {
  const contas = num(raw.contas_total);
  const fat_recorrente = num(raw.mrr_operando);
  const fat_pontual = num(raw.pontual_operando);
  const faturamento = fat_recorrente + fat_pontual;
  const ticket_medio = contas > 0 ? faturamento / contas : null;
  const cap_fat = ticket_medio !== null ? ticket_medio * metaContasDesigner : null;
  return {
    nome: String(raw.nome),
    contas,
    fat_recorrente,
    fat_pontual,
    faturamento,
    ticket_medio,
    cap_fat,
    util_pct: utilPct(faturamento, cap_fat),
  };
}

export interface CapacityTimesResponse {
  selva: SelvaRow[];
  black: ComercialRow[];
  squadra: ComercialRow[];
  metaContasDesigner: number;
}
