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
  match?: string; // nome alternativo p/ o drawer (ex.: Black usa responsavel_geral)
  mrr_atual: number;
  mrr_ativo: number;
  mrr_onboarding: number;
  mrr_cancelamento: number;
  cap_mrr: number | null; // exibida como "Cap. FAT ($)" — mesmo campo que a Configurar grava (capacity_metas.cap_mrr)
  dif_mrr: number | null;
  contas_ativas: number;
  cap_contas: number | null;
  dif_contas: number | null;
  clientes: number; // clientes distintos da carteira
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_mrr_pct: number | null; // mrr_atual / cap_mrr
  util_contas_pct: number | null; // contas_ativas / cap_contas
  util_clientes_pct: number | null; // clientes / cap_clientes
}

export function toComercialRow(raw: any): ComercialRow {
  const mrr_atual = num(raw.mrr_operando);
  const cap_mrr = numOrNull(raw.cap_mrr);
  const contas_ativas = num(raw.contas_rec ?? raw.contas_ativas);
  const cap_contas = numOrNull(raw.cap_contas);
  const clientes = num(raw.clientes_rec ?? raw.clientes);
  const cap_clientes = numOrNull(raw.cap_clientes);
  const util_mrr_pct = utilPct(mrr_atual, cap_mrr);
  return {
    nome: String(raw.nome),
    ...(raw.match ? { match: String(raw.match) } : {}),
    mrr_atual,
    mrr_ativo: num(raw.mrr_ativo),
    mrr_onboarding: num(raw.mrr_onboarding),
    mrr_cancelamento: num(raw.mrr_cancelamento),
    cap_mrr,
    dif_mrr: diff(cap_mrr, mrr_atual),
    contas_ativas,
    cap_contas,
    dif_contas: diff(cap_contas, contas_ativas),
    clientes,
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
    util_mrr_pct,
    util_contas_pct: utilPct(contas_ativas, cap_contas),
    util_clientes_pct: utilPct(clientes, cap_clientes),
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
  clientes: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_clientes_pct: number | null;
  util_pct: number | null; // faturamento / cap_fat
}

export function toSelvaRow(raw: any, metaContasDesigner: number): SelvaRow {
  const contas = num(raw.contas_total);
  const fat_recorrente = num(raw.mrr_operando);
  const fat_pontual = num(raw.pontual_operando);
  const faturamento = fat_recorrente + fat_pontual;
  const ticket_medio = contas > 0 ? faturamento / contas : null;
  const cap_fat = ticket_medio !== null ? ticket_medio * metaContasDesigner : null;
  const clientes = num(raw.clientes_total);
  const cap_clientes = numOrNull(raw.cap_clientes);
  return {
    nome: String(raw.nome),
    contas,
    fat_recorrente,
    fat_pontual,
    faturamento,
    ticket_medio,
    cap_fat,
    clientes,
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
    util_clientes_pct: utilPct(clientes, cap_clientes),
    util_pct: utilPct(faturamento, cap_fat),
  };
}

// ── Squads de comunicação (Pulse, Olimpo): CS via capacity_metas, régua rec+pontual ──

export interface CsRow {
  nome: string;
  op_recorrente: number;
  cap_contratos: number | null; // capacity de contratos (cap_contas, fallback cap_recorrente)
  clientes: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  op_pontual: number;
  op_total: number;
  mrr_operando: number;
  mrr_ativo: number;
  mrr_onboarding: number;
  mrr_cancelamento: number;
  cap_fat: number | null; // ticket médio da equipe × capacity de contratos (preenchido no route)
  util_fat_pct: number | null; // mrr_operando / cap_fat
  util_contas_pct: number | null; // op_recorrente / cap_contratos
  util_clientes_pct: number | null; // clientes / cap_clientes
}

export interface SquadGroup {
  squad: string;
  rows: CsRow[];
}

export function toCsRow(raw: any): CsRow {
  const op_recorrente = num(raw.op_recorrente);
  const op_pontual = num(raw.op_pontual);
  const op_total = op_recorrente + op_pontual;
  const cap_contratos = numOrNull(raw.cap_contratos);
  const mrr_operando = num(raw.mrr_operando);
  const clientes = num(raw.clientes_rec);
  const cap_clientes = numOrNull(raw.cap_clientes);
  return {
    nome: String(raw.nome),
    op_recorrente,
    cap_contratos,
    clientes,
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
    op_pontual,
    op_total,
    mrr_operando,
    mrr_ativo: num(raw.mrr_ativo),
    mrr_onboarding: num(raw.mrr_onboarding),
    mrr_cancelamento: num(raw.mrr_cancelamento),
    cap_fat: null,
    util_fat_pct: null,
    util_contas_pct: utilPct(op_recorrente, cap_contratos),
    util_clientes_pct: utilPct(clientes, cap_clientes),
  };
}

// Preenche cap_fat/util por squad: Cap. FAT = ticket médio da equipe × capacity de contratos.
export function finalizeSquad(group: SquadGroup): void {
  const totMrr = group.rows.reduce((s, r) => s + r.mrr_operando, 0);
  const totRec = group.rows.reduce((s, r) => s + r.op_recorrente, 0);
  const ticketMedio = totRec > 0 ? totMrr / totRec : 0;
  for (const r of group.rows) {
    r.cap_fat = r.cap_contratos !== null ? Math.round(ticketMedio * r.cap_contratos) : null;
    r.util_fat_pct = utilPct(r.mrr_operando, r.cap_fat);
  }
}

export interface CapacityTimesResponse {
  selva: SelvaRow[];
  black: ComercialRow[];
  squadra: ComercialRow[];
  cxcs: ComercialRow[];
  squads: SquadGroup[];
  metaContasDesigner: number;
}
