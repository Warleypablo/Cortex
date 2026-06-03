import { sql } from "drizzle-orm";
import { db } from "../db";
import type { Categoria } from "../routes/capacityTimes.helpers";

export interface CapacityMetaSeed {
  nome: string;
  match_responsavel: string;
  categoria: Categoria;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  ordem: number;
}

export const CAPACITY_METAS_SEED: CapacityMetaSeed[] = [
  // ── CS ──
  { nome: "Brenda",        match_responsavel: "Brenda Federici",    categoria: "cs", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0,  cap_contas: null, ordem: 1 },
  { nome: "Fernanda",      match_responsavel: "Fernanda Almeida",   categoria: "cs", cap_recorrente: 16, cap_mrr: 40000, cap_pontual: 0,  cap_contas: null, ordem: 2 },
  { nome: "Karla",         match_responsavel: "Karla Pin",          categoria: "cs", cap_recorrente: 14, cap_mrr: 30000, cap_pontual: 0,  cap_contas: null, ordem: 3 },
  { nome: "Iasmim",        match_responsavel: "Iasmim Torres",      categoria: "cs", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0,  cap_contas: null, ordem: 4 },
  { nome: "Victor (CS)",   match_responsavel: "Victor Klein",       categoria: "cs", cap_recorrente: 12, cap_mrr: 45000, cap_pontual: 10, cap_contas: null, ordem: 5 },
  { nome: "Mariana Dalto", match_responsavel: "Mariana Dalto",      categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 6 },
  { nome: "Lara Grobério", match_responsavel: "Lara Grobério",      categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 7 },
  { nome: "Julia Manhães", match_responsavel: "Julia Manhães",      categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 8 },
  { nome: "Debora",        match_responsavel: "Debora Mund",        categoria: "cs", cap_recorrente: 25, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 9 },
  { nome: "Larissa",       match_responsavel: "Larissa Farias",     categoria: "cs", cap_recorrente: 25, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 10 },
  { nome: "Ana",           match_responsavel: "Ana Clara Cordeiro", categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 11 },

  // ── Vendedores / Closers ──
  { nome: "Gabriel Taufner", match_responsavel: "Gabriel Taufner", categoria: "vendedor", cap_recorrente: null, cap_mrr: 107510,    cap_pontual: null, cap_contas: 30, ordem: 1 },
  { nome: "Bruno da Silva",  match_responsavel: "Bruno Da Silva",  categoria: "vendedor", cap_recorrente: null, cap_mrr: 100077.69, cap_pontual: null, cap_contas: 30, ordem: 2 },
  { nome: "José Neto",       match_responsavel: "José Neto",       categoria: "vendedor", cap_recorrente: null, cap_mrr: 73446.43,  cap_pontual: null, cap_contas: 30, ordem: 3 },
  { nome: "Gabriel Magno",   match_responsavel: "Gabriel Magno",   categoria: "vendedor", cap_recorrente: null, cap_mrr: 54330.91,  cap_pontual: null, cap_contas: 20, ordem: 4 },
  { nome: "Felipe Almeida",  match_responsavel: "Felipe Almeida",  categoria: "vendedor", cap_recorrente: null, cap_mrr: 65812.50,  cap_pontual: null, cap_contas: 20, ordem: 5 },
  { nome: "Richard Meira",   match_responsavel: "Richard Meira",   categoria: "vendedor", cap_recorrente: null, cap_mrr: 59980,     cap_pontual: null, cap_contas: 20, ordem: 6 },

  // ── Accounts ──
  { nome: "Moises",       match_responsavel: "Moises Silva Fernandes", categoria: "account", cap_recorrente: null, cap_mrr: 76085.63, cap_pontual: null, cap_contas: 30, ordem: 1 },
  { nome: "Pedro",        match_responsavel: "Pedro Antonio",          categoria: "account", cap_recorrente: null, cap_mrr: 86685,    cap_pontual: null, cap_contas: 30, ordem: 2 },
  { nome: "Leonardo Acc", match_responsavel: "Leonardo Soares Ferreira", categoria: "account", cap_recorrente: null, cap_mrr: 104650,   cap_pontual: null, cap_contas: 25, ordem: 3 },
  { nome: "Breno Acc",    match_responsavel: "Breno Carmo",            categoria: "account", cap_recorrente: null, cap_mrr: 60376.56, cap_pontual: null, cap_contas: 25, ordem: 4 },

  // ── Gestores / Accounts Prime ──
  { nome: "Victor Arpini (Account Prime)", match_responsavel: "Victor Arpini",      categoria: "gestor", cap_recorrente: null, cap_mrr: 57411.76, cap_pontual: null, cap_contas: 10, ordem: 1 },
  { nome: "Jonatas (Account)",             match_responsavel: "Jônatas Cavalcante", categoria: "gestor", cap_recorrente: null, cap_mrr: 67396.88, cap_pontual: null, cap_contas: 25, ordem: 2 },
  { nome: "Renan (Account)",               match_responsavel: "Renan Fortunato",    categoria: "gestor", cap_recorrente: null, cap_mrr: 70126.04, cap_pontual: null, cap_contas: 25, ordem: 3 },
  { nome: "Thiago Andrey (Gestor Prime)",  match_responsavel: "Thiago Andrey",      categoria: "gestor", cap_recorrente: null, cap_mrr: 77085,    cap_pontual: null, cap_contas: 15, ordem: 4 },
  { nome: "Thiago Martins (Gestor Prime)", match_responsavel: "Thiago Martins",     categoria: "gestor", cap_recorrente: null, cap_mrr: 81794.06, cap_pontual: null, cap_contas: 15, ordem: 5 },
  { nome: "Allan (Gestor)",                match_responsavel: "Allan Gestor",       categoria: "gestor", cap_recorrente: null, cap_mrr: 84151.25, cap_pontual: null, cap_contas: 30, ordem: 6 },
  { nome: "Victor Matsushita (Gestor)",    match_responsavel: "Victor Matsushita",  categoria: "gestor", cap_recorrente: null, cap_mrr: 81652.11, cap_pontual: null, cap_contas: 30, ordem: 7 },
];

export async function seedCapacityMetas(): Promise<void> {
  try {
    // Remove stale rows whose (nome, categoria) exists in seed but with a different
    // match_responsavel — happens when match_responsavel is renamed between deploys.
    for (const m of CAPACITY_METAS_SEED) {
      await db.execute(sql`
        DELETE FROM cortex_core.capacity_metas
        WHERE nome = ${m.nome}
          AND categoria = ${m.categoria}
          AND match_responsavel <> ${m.match_responsavel}
      `);
    }

    for (const m of CAPACITY_METAS_SEED) {
      await db.execute(sql`
        INSERT INTO cortex_core.capacity_metas
          (nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem)
        VALUES (${m.nome}, ${m.match_responsavel}, ${m.categoria}, ${m.cap_recorrente},
                ${m.cap_mrr}, ${m.cap_pontual}, ${m.cap_contas}, ${m.ordem})
        ON CONFLICT (match_responsavel, categoria) DO UPDATE SET
          nome = EXCLUDED.nome,
          cap_recorrente = EXCLUDED.cap_recorrente,
          cap_mrr = EXCLUDED.cap_mrr,
          cap_pontual = EXCLUDED.cap_pontual,
          cap_contas = EXCLUDED.cap_contas,
          ordem = EXCLUDED.ordem,
          atualizado_em = NOW()
      `);
    }
    console.log(`[database] capacity_metas seeded (${CAPACITY_METAS_SEED.length} rows)`);
  } catch (error) {
    console.error('[database] Error seeding capacity_metas:', error);
  }
}
