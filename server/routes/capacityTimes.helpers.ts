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
  contratos: number; // subtasks distintas (recorrente OU pontual)
  contratos_rec: number; // subtasks com valorr > 0
  contratos_pont: number; // subtasks com valorp > 0
  cap_contas: number | null;
  dif_contas: number | null;
  clientes: number; // clientes distintos da carteira (recorrente OU pontual)
  clientes_rec: number; // clientes com contrato recorrente (valorr > 0)
  clientes_pont: number; // clientes com contrato pontual (valorp > 0)
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_mrr_pct: number | null; // mrr_atual / cap_mrr
  util_contas_pct: number | null; // contas_ativas / cap_contas
  util_clientes_pct: number | null; // clientes / cap_clientes
}

export function toComercialRow(raw: any): ComercialRow {
  // "Faturamento (R+P)": recorrente + pontual, como a Selva já fazia.
  const mrr_atual = num(raw.mrr_operando) + num(raw.pontual_operando);
  const cap_mrr = numOrNull(raw.cap_mrr);
  const contas_ativas = num(raw.contas_rec ?? raw.contas_ativas);
  const cap_contas = numOrNull(raw.cap_contas);
  const clientes = num(raw.clientes_total ?? raw.clientes_rec ?? raw.clientes);
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
    contratos: num(raw.contas_total ?? raw.contas_rec),
    contratos_rec: num(raw.contas_rec),
    contratos_pont: num(raw.contas_pont),
    cap_contas,
    dif_contas: diff(cap_contas, contas_ativas),
    clientes,
    clientes_rec: num(raw.clientes_rec),
    clientes_pont: num(raw.clientes_pont),
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
    util_mrr_pct,
    util_contas_pct: utilPct(contas_ativas, cap_contas),
    util_clientes_pct: utilPct(clientes, cap_clientes),
  };
}

// Preenche a Cap. FAT de quem não tem meta cadastrada em cap_mrr:
//   Cap. FAT = ticket médio da equipe (FAT total ÷ clientes da equipe) × Cap. Clientes.
// Quem TEM cap_mrr configurada na aba Configurar mantém o valor manual — ele vence.
export function finalizeComercial(rows: ComercialRow[]): void {
  const totFat = rows.reduce((s, r) => s + r.mrr_atual, 0);
  const totClientes = rows.reduce((s, r) => s + r.clientes, 0);
  if (totClientes === 0) return;
  const ticketEquipe = totFat / totClientes;
  for (const r of rows) {
    if (r.cap_mrr !== null || r.cap_clientes === null) continue;
    r.cap_mrr = Math.round(ticketEquipe * r.cap_clientes);
    r.dif_mrr = diff(r.cap_mrr, r.mrr_atual);
    r.util_mrr_pct = utilPct(r.mrr_atual, r.cap_mrr);
  }
}

// ── Selva (designers): carteira via responsavel da subtask, régua por faturamento ──

export interface SelvaRow {
  nome: string;
  contas: number; // contas (rec + pontual) onde o designer é responsável
  contratos: number;
  contratos_rec: number;
  contratos_pont: number;
  fat_recorrente: number;
  fat_pontual: number;
  faturamento: number; // rec + pont
  ticket_medio: number | null; // faturamento / contas
  cap_fat: number | null; // ticket_medio * meta_contas_designer
  clientes: number;
  clientes_rec: number;
  clientes_pont: number;
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
    contratos: contas,
    contratos_rec: num(raw.contas_rec),
    contratos_pont: num(raw.contas_pont),
    fat_recorrente,
    fat_pontual,
    faturamento,
    ticket_medio,
    cap_fat,
    clientes,
    clientes_rec: num(raw.clientes_rec),
    clientes_pont: num(raw.clientes_pont),
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
    util_clientes_pct: utilPct(clientes, cap_clientes),
    util_pct: utilPct(faturamento, cap_fat),
  };
}

// ── Squads de comunicação (hoje só o Pulse): CS via capacity_metas, régua rec+pontual ──

export interface CsRow {
  nome: string;
  op_recorrente: number;
  contratos: number;
  contratos_rec: number;
  contratos_pont: number;
  cap_contratos: number | null; // capacity de contratos (cap_contas, fallback cap_recorrente)
  clientes: number;
  clientes_rec: number;
  clientes_pont: number;
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
  const mrr_operando = num(raw.mrr_operando) + num(raw.pontual_operando); // Faturamento (R+P)
  const clientes = num(raw.clientes_total ?? raw.clientes_rec);
  const cap_clientes = numOrNull(raw.cap_clientes);
  return {
    nome: String(raw.nome),
    op_recorrente,
    contratos: num(raw.contas_total ?? raw.op_recorrente),
    contratos_rec: num(raw.contas_rec ?? op_recorrente),
    contratos_pont: num(raw.contas_pont ?? op_pontual),
    cap_contratos,
    clientes,
    clientes_rec: num(raw.clientes_rec),
    clientes_pont: num(raw.clientes_pont),
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

// Cap. FAT por squad, mesma fórmula das demais abas:
//   ticket médio da equipe (FAT total ÷ clientes da equipe) × Cap. Clientes da pessoa.
// Sem cap_clientes, cai na régua antiga (ticket por contrato × capacity de contratos).
export function finalizeSquad(group: SquadGroup): void {
  const totFat = group.rows.reduce((s, r) => s + r.mrr_operando, 0);
  const totClientes = group.rows.reduce((s, r) => s + r.clientes, 0);
  const totRec = group.rows.reduce((s, r) => s + r.op_recorrente, 0);
  const ticketCliente = totClientes > 0 ? totFat / totClientes : 0;
  const ticketContrato = totRec > 0 ? totFat / totRec : 0;
  for (const r of group.rows) {
    r.cap_fat = r.cap_clientes !== null
      ? Math.round(ticketCliente * r.cap_clientes)
      : r.cap_contratos !== null ? Math.round(ticketContrato * r.cap_contratos) : null;
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
