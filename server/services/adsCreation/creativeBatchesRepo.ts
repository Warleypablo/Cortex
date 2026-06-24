/**
 * Repositório dos "cabeçalhos de batch" (creative_batches) e do vocabulário controlado
 * (creative_vocab) da Biblioteca de Criativos.
 *
 * O batch é escrito pela skill turbo-ads-workflow no DIA do roteiro (keyed por pasta do Drive).
 * Quando os arquivos editados sobem, os stubs HERDAM os campos comuns do batch e resolvem
 * angulo/bodyTipo/ctaTipo via os códigos hNN/bNN/cNN do nome do arquivo contra `batch.modules`.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  creativeBatches,
  creativeVocab,
  type CreativeBatch,
  type InsertCreativeBatch,
  type CreativeVocabItem,
} from "@shared/schema";
import type { ParsedConvention } from "./creativesRepo";

// ============== Drive folder id ==============

/** Extrai o id da pasta de uma URL do Google Drive (.../folders/{id}) ou aceita o id cru. */
export function extractDriveFolderId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  const s = urlOrId.trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Sem barra/escape → provavelmente já é o id
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return null;
}

// ============== Batches ==============

export interface UpsertBatchInput {
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  nomeAd?: string | null;
  produto?: string | null;
  roteiroUrl?: string | null;
  clickupTaskId?: string | null;
  modules?: unknown;
  createdBy?: string | null;
}

/** Cria ou atualiza o cabeçalho de batch pela pasta do Drive (idempotente). */
export async function upsertBatch(input: UpsertBatchInput): Promise<CreativeBatch | null> {
  const driveFolderId =
    input.driveFolderId || extractDriveFolderId(input.driveFolderUrl);
  if (!driveFolderId) return null;

  const values: InsertCreativeBatch = {
    driveFolderId,
    nomeAd: input.nomeAd ?? null,
    produto: input.produto ?? null,
    roteiroUrl: input.roteiroUrl ?? null,
    clickupTaskId: input.clickupTaskId ?? null,
    modules: (input.modules as any) ?? null,
    createdBy: input.createdBy ?? null,
  };

  const [row] = await db
    .insert(creativeBatches)
    .values(values)
    .onConflictDoUpdate({
      target: creativeBatches.driveFolderId,
      set: {
        nomeAd: values.nomeAd,
        produto: values.produto,
        roteiroUrl: values.roteiroUrl,
        clickupTaskId: values.clickupTaskId,
        modules: values.modules,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row ?? null;
}

export async function getBatchByFolderId(
  driveFolderId: string | null | undefined,
): Promise<CreativeBatch | null> {
  if (!driveFolderId) return null;
  const [row] = await db
    .select()
    .from(creativeBatches)
    .where(eq(creativeBatches.driveFolderId, driveFolderId))
    .limit(1);
  return row ?? null;
}

/**
 * Resolve o ângulo (única dimensão semântica) do hook (h##) contra o `modules.hooks` do batch.
 * Body e CTA (b##/c##) são só identificadores — não viram campo semântico.
 * Degrada de boa: sem código de hook ou sem o mapa → vazio.
 */
// Normaliza códigos pra casar mesmo com padding diferente: "h03" e "h3" → "h3".
function normCode(code: string): string {
  return code.toLowerCase().replace(/^([a-z]+)0*(\d+)$/, "$1$2");
}

export function resolveModuleFields(
  parsed: Pick<ParsedConvention, "hookCode"> | null,
  batch: CreativeBatch | null,
): { angulo?: string } {
  const hooks = (batch?.modules as any)?.hooks as Record<string, any> | undefined;
  if (!parsed?.hookCode || !hooks) return {};
  const want = normCode(parsed.hookCode);
  for (const [k, v] of Object.entries(hooks)) {
    if (normCode(k) === want && v?.angulo) return { angulo: v.angulo as string };
  }
  return {};
}

// ============== Vocabulário controlado ==============

export async function listVocab(kind?: string): Promise<CreativeVocabItem[]> {
  const conds = [eq(creativeVocab.active, true)];
  if (kind) conds.push(eq(creativeVocab.kind, kind));
  return db
    .select()
    .from(creativeVocab)
    .where(and(...conds))
    .orderBy(asc(creativeVocab.kind), asc(creativeVocab.sortOrder), asc(creativeVocab.label));
}

export interface UpsertVocabInput {
  kind: string;
  value: string;
  label: string;
  sortOrder?: number;
  active?: boolean;
}

export async function upsertVocab(input: UpsertVocabInput): Promise<CreativeVocabItem> {
  const [row] = await db
    .insert(creativeVocab)
    .values({
      kind: input.kind,
      value: input.value,
      label: input.label,
      sortOrder: input.sortOrder ?? 0,
      active: input.active ?? true,
    })
    .onConflictDoUpdate({
      target: [creativeVocab.kind, creativeVocab.value],
      set: {
        label: input.label,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    })
    .returning();
  return row;
}
