import { sql } from "drizzle-orm";
import { db } from "../db";

export interface CapacityMetaSeed {
  nome: string;
  match_responsavel: string;
  categoria: string;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  ordem: number;
}

export const CAPACITY_METAS_SEED: CapacityMetaSeed[] = [
  // ── Squad Pulse (operacional) ──
  { nome: "Brenda",        match_responsavel: "Brenda Federici",    categoria: "Pulse", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0,  cap_contas: null, ordem: 1 },
  { nome: "Fernanda",      match_responsavel: "Fernanda Almeida",   categoria: "Pulse", cap_recorrente: 16, cap_mrr: 40000, cap_pontual: 0,  cap_contas: null, ordem: 2 },
  { nome: "Karla",         match_responsavel: "Karla Pin",          categoria: "Pulse", cap_recorrente: 14, cap_mrr: 30000, cap_pontual: 0,  cap_contas: null, ordem: 3 },
  { nome: "Iasmim",        match_responsavel: "Iasmim Torres",      categoria: "Pulse", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0,  cap_contas: null, ordem: 4 },
  { nome: "Victor",        match_responsavel: "Victor Klein",       categoria: "Pulse", cap_recorrente: 12, cap_mrr: 45000, cap_pontual: 10, cap_contas: null, ordem: 5 },
  // Aura foi descontinuada (2026-06-09) — colaboradores migrados para Pulse
  { nome: "Mariana Dalto", match_responsavel: "Mariana Dalto",      categoria: "Pulse", cap_recorrente: 20, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 6 },
  { nome: "Lara Grobério", match_responsavel: "Lara Grobério",      categoria: "Pulse", cap_recorrente: 20, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 7 },
  { nome: "Julia Manhães", match_responsavel: "Julia Manhães",      categoria: "Pulse", cap_recorrente: 20, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 8 },
  // Olimpo foi descontinuada (2026-07-20) — colaboradores migrados para Pulse
  { nome: "Debora",        match_responsavel: "Debora Mund",        categoria: "Pulse", cap_recorrente: 25, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 9 },
  { nome: "Larissa",       match_responsavel: "Larissa Farias",     categoria: "Pulse", cap_recorrente: 25, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 10 },
  { nome: "Ana",           match_responsavel: "Ana Clara Cordeiro", categoria: "Pulse", cap_recorrente: 20, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 11 },
  { nome: "Geiziele",      match_responsavel: "Geiziele Izidorio Oliveira", categoria: "Pulse", cap_recorrente: 15, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 12 },

  // ── Vendedores / Closers ──
  { nome: "Gabriel Taufner", match_responsavel: "Gabriel Taufner", categoria: "vendedor", cap_recorrente: null, cap_mrr: 107510,    cap_pontual: null, cap_contas: 30, ordem: 13 },
  { nome: "Bruno da Silva",  match_responsavel: "Bruno Da Silva",  categoria: "vendedor", cap_recorrente: null, cap_mrr: 100077.69, cap_pontual: null, cap_contas: 30, ordem: 14 },
  { nome: "José Neto",       match_responsavel: "José Neto",       categoria: "vendedor", cap_recorrente: null, cap_mrr: 73446.43,  cap_pontual: null, cap_contas: 30, ordem: 15 },
  { nome: "Gabriel Magno",   match_responsavel: "Gabriel Magno",   categoria: "vendedor", cap_recorrente: null, cap_mrr: 54330.91,  cap_pontual: null, cap_contas: 20, ordem: 16 },
  { nome: "Felipe Almeida",  match_responsavel: "Felipe Almeida",  categoria: "vendedor", cap_recorrente: null, cap_mrr: 65812.50,  cap_pontual: null, cap_contas: 20, ordem: 17 },
  { nome: "Richard Meira",   match_responsavel: "Richard Meira",   categoria: "vendedor", cap_recorrente: null, cap_mrr: 59980,     cap_pontual: null, cap_contas: 20, ordem: 18 },

  // ── Accounts ──
  { nome: "Moises",       match_responsavel: "Moises Silva Fernandes",   categoria: "account", cap_recorrente: null, cap_mrr: 76085.63, cap_pontual: null, cap_contas: 30, ordem: 19 },
  { nome: "Pedro",        match_responsavel: "Pedro Antonio",            categoria: "account", cap_recorrente: null, cap_mrr: 86685,    cap_pontual: null, cap_contas: 30, ordem: 20 },
  { nome: "Leonardo Acc", match_responsavel: "Leonardo Soares Ferreira", categoria: "account", cap_recorrente: null, cap_mrr: 104650,   cap_pontual: null, cap_contas: 25, ordem: 21 },
  { nome: "Breno Acc",    match_responsavel: "Breno Carmo",              categoria: "account", cap_recorrente: null, cap_mrr: 60376.56, cap_pontual: null, cap_contas: 25, ordem: 22 },

  // ── Gestores / Accounts Prime ──
  { nome: "Victor Arpini (Account Prime)", match_responsavel: "Victor Arpini",      categoria: "gestor", cap_recorrente: null, cap_mrr: 57411.76, cap_pontual: null, cap_contas: 10, ordem: 23 },
  { nome: "Jonatas (Account)",             match_responsavel: "Jônatas Cavalcante", categoria: "gestor", cap_recorrente: null, cap_mrr: 67396.88, cap_pontual: null, cap_contas: 25, ordem: 24 },
  { nome: "Renan (Account)",               match_responsavel: "Renan Fortunato",    categoria: "gestor", cap_recorrente: null, cap_mrr: 70126.04, cap_pontual: null, cap_contas: 25, ordem: 25 },
  { nome: "Thiago Andrey (Gestor Prime)",  match_responsavel: "Thiago Andrey",      categoria: "gestor", cap_recorrente: null, cap_mrr: 77085,    cap_pontual: null, cap_contas: 15, ordem: 26 },
  { nome: "Thiago Martins (Gestor Prime)", match_responsavel: "Thiago Martins",     categoria: "gestor", cap_recorrente: null, cap_mrr: 81794.06, cap_pontual: null, cap_contas: 15, ordem: 27 },
  { nome: "Allan (Gestor)",                match_responsavel: "Allan Gestor",       categoria: "gestor", cap_recorrente: null, cap_mrr: 84151.25, cap_pontual: null, cap_contas: 30, ordem: 28 },
  { nome: "Victor Matsushita (Gestor)",    match_responsavel: "Victor Matsushita",  categoria: "gestor", cap_recorrente: null, cap_mrr: 81652.11, cap_pontual: null, cap_contas: 30, ordem: 29 },
];

export async function seedCapacityMetas(): Promise<void> {
  try {
    // Bootstrap idempotente: a edição manual via UI é a fonte de verdade.
    // O seed só popula a tabela na primeira vez (quando está vazia).
    const { rows } = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM cortex_core.capacity_metas`
    );
    const n = Number((rows[0] as any)?.n ?? 0);
    if (n > 0) {
      console.log(`[database] capacity_metas já populada (${n} linhas) — bootstrap pulado`);
      return;
    }

    for (const m of CAPACITY_METAS_SEED) {
      await db.execute(sql`
        INSERT INTO cortex_core.capacity_metas
          (nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem)
        VALUES (${m.nome}, ${m.match_responsavel}, ${m.categoria}, ${m.cap_recorrente},
                ${m.cap_mrr}, ${m.cap_pontual}, ${m.cap_contas}, ${m.ordem})
      `);
    }

    console.log(`[database] capacity_metas bootstrap (${CAPACITY_METAS_SEED.length} linhas)`);
  } catch (error) {
    console.error('[database] Error seeding capacity_metas:', error);
  }
}
