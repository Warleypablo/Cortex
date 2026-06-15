// Categorias comerciais (papel). Para operacionais, a categoria é o nome da squad (ex.: "Pulse").
export const COMMERCIAL_CATEGORIAS = ["vendedor", "account", "gestor"] as const;
export type CommercialCategoria = (typeof COMMERCIAL_CATEGORIAS)[number];
export type Categoria = CommercialCategoria | string;

export interface CapacityAggRow {
  nome: string;
  categoria: Categoria;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  op_recorrente: number;
  mrr_operando: number;
  mrr_ativo: number;
  mrr_onboarding: number;
  mrr_cancelamento: number;
  op_pontual: number;
}

export interface CsRow {
  nome: string;
  op_recorrente: number;
  cap_recorrente: number | null;
  op_pontual: number;
  cap_pontual: number | null;
  op_total: number;
  mrr_operando: number;
  mrr_ativo: number;
  mrr_onboarding: number;
  mrr_cancelamento: number;
  cap_mrr: number | null;
  util_mrr_pct: number | null;    // mrr_operando / cap_mrr
  util_contas_pct: number | null; // (rec+pont) / (cap rec + cap pont)
  util_pct: number | null;        // legado: MRR quando há cap, senão contas/cap_recorrente
}

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
  util_mrr_pct: number | null;    // mrr_atual / cap_mrr
  util_contas_pct: number | null; // contas_ativas / cap_contas
  util_pct: number | null;        // legado: igual a util_mrr_pct
}

export interface SquadGroup {
  squad: string;
  rows: CsRow[];
}

export interface CapacityTimesResponse {
  squads: SquadGroup[];
  vendedor: ComercialRow[];
  account: ComercialRow[];
  gestor: ComercialRow[];
}

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

export function parseAggRow(raw: any): CapacityAggRow {
  return {
    nome: String(raw.nome),
    categoria: raw.categoria as Categoria,
    cap_recorrente: numOrNull(raw.cap_recorrente),
    cap_mrr: numOrNull(raw.cap_mrr),
    cap_pontual: numOrNull(raw.cap_pontual),
    cap_contas: numOrNull(raw.cap_contas),
    op_recorrente: num(raw.op_recorrente),
    mrr_operando: num(raw.mrr_operando),
    mrr_ativo: num(raw.mrr_ativo),
    mrr_onboarding: num(raw.mrr_onboarding),
    mrr_cancelamento: num(raw.mrr_cancelamento),
    op_pontual: num(raw.op_pontual),
  };
}

export function toCsRow(r: CapacityAggRow): CsRow {
  const op_total = r.op_recorrente + r.op_pontual;
  // Capacity por MRR e por contas lado a lado.
  // Contas do CS = (rec + pont) sobre a soma dos caps de contas (rec + pont).
  const cap_contas_total = (r.cap_recorrente ?? 0) + (r.cap_pontual ?? 0);
  const util_mrr_pct = utilPct(r.mrr_operando, r.cap_mrr);
  const util_contas_pct = utilPct(op_total, cap_contas_total > 0 ? cap_contas_total : null);
  // Legado (% único): cap_mrr null OU 0 = sem meta de MRR (CS de capacity único) → contas (rec+pont) / cap_recorrente
  const util_pct = (r.cap_mrr !== null && r.cap_mrr !== 0)
    ? util_mrr_pct
    : utilPct(op_total, r.cap_recorrente);
  return {
    nome: r.nome,
    op_recorrente: r.op_recorrente,
    cap_recorrente: r.cap_recorrente,
    op_pontual: r.op_pontual,
    cap_pontual: r.cap_pontual,
    op_total,
    mrr_operando: r.mrr_operando,
    mrr_ativo: r.mrr_ativo,
    mrr_onboarding: r.mrr_onboarding,
    mrr_cancelamento: r.mrr_cancelamento,
    cap_mrr: r.cap_mrr,
    util_mrr_pct,
    util_contas_pct,
    util_pct,
  };
}

export function toComercialRow(r: CapacityAggRow): ComercialRow {
  const util_mrr_pct = utilPct(r.mrr_operando, r.cap_mrr);
  return {
    nome: r.nome,
    mrr_atual: r.mrr_operando,
    mrr_ativo: r.mrr_ativo,
    mrr_onboarding: r.mrr_onboarding,
    mrr_cancelamento: r.mrr_cancelamento,
    cap_mrr: r.cap_mrr,
    dif_mrr: diff(r.cap_mrr, r.mrr_operando),
    contas_ativas: r.op_recorrente,
    cap_contas: r.cap_contas,
    dif_contas: diff(r.cap_contas, r.op_recorrente),
    util_mrr_pct,
    util_contas_pct: utilPct(r.op_recorrente, r.cap_contas),
    util_pct: util_mrr_pct,
  };
}

export function buildResponse(rows: CapacityAggRow[]): CapacityTimesResponse {
  const out: CapacityTimesResponse = { squads: [], vendedor: [], account: [], gestor: [] };
  const squadIndex = new Map<string, SquadGroup>();
  for (const r of rows) {
    if (r.categoria === "vendedor") out.vendedor.push(toComercialRow(r));
    else if (r.categoria === "account") out.account.push(toComercialRow(r));
    else if (r.categoria === "gestor") out.gestor.push(toComercialRow(r));
    else {
      // Operacional: agrupa por squad (categoria), preservando a ordem de primeira aparição.
      let group = squadIndex.get(r.categoria);
      if (!group) {
        group = { squad: r.categoria, rows: [] };
        squadIndex.set(r.categoria, group);
        out.squads.push(group);
      }
      group.rows.push(toCsRow(r));
    }
  }
  return out;
}
