/**
 * Ponto de entrada da feature de criação de campanhas.
 *
 * Pipeline:
 *   1. Resolve audience id pelo nome
 *   2. Lê pasta do Drive (single ou bulk com subpastas)
 *   3. Faz match dos arquivos com a Biblioteca de Criativos (cortex_core.creatives_library)
 *   4. Sobe mídias para a ad account (image_hash / video_id)
 *   5. Constrói ConjuntoBatch[] (1 no single, N no bulk) com pareamento de formatos
 *   6. Cria Campaign + AdSet(s) + Ads em PAUSED via orchestrateCreation
 *   7. Retorna IDs + link pro Gerenciador
 */

import { resolveAudienceByName } from "./audienceResolver";
import {
  loadDriveFolderTree,
  canonicalBasename,
  type ConjuntoFolder,
  type DriveTree,
  type FormatTag,
} from "./driveLoader";
import { uploadMediaBatch, MediaUploadInterrupted } from "./mediaUploader";
import { orchestrateCreation } from "./creator";
import { listAllForMatching, type CreativeRow } from "./creativesRepo";
import type {
  Briefing,
  ConjuntoBatch,
  CreationResult,
  DriveFile,
  PairedAdMedia,
  UploadedMedia,
} from "./types";

/**
 * Bookmark de progresso para retomada após rate limit / falha transiente.
 * Persistido em meta_creation_drafts.result.bookmark.
 */
export interface CreationBookmark {
  uploadedMedia: UploadedMedia[];
  // Futuro: campaignId, adsetIds[], adIds[] pra resumir create-phase também
}

/**
 * Erro que indica "trabalho parcial — pausar e retomar depois".
 * O caller (route handler) deve salvar o bookmark e agendar nova tentativa.
 */
export class CreationInterrupted extends Error {
  readonly reason: "rate_limit";
  readonly bookmark: CreationBookmark;
  readonly metaCode?: number;
  constructor(message: string, bookmark: CreationBookmark, metaCode?: number) {
    super(message);
    this.name = "CreationInterrupted";
    this.reason = "rate_limit";
    this.bookmark = bookmark;
    this.metaCode = metaCode;
  }
}

export interface CreateCampaignArgs {
  briefing: Briefing;
  adAccountId: string;
  pageId: string;
  instagramActorId?: string;
  pixelId?: string;
  /** Bookmark de uma execução anterior interrompida (ex.: rate limit). */
  bookmark?: CreationBookmark;
  /** Callback opcional chamado a cada mudança de progresso por conjunto. */
  onProgress?: (snapshot: CreationResult) => Promise<void> | void;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function indexCreatives(rows: CreativeRow[]): {
  byFileId: Map<string, CreativeRow>;
  byNomeDrive: Map<string, CreativeRow>;
} {
  const byFileId = new Map<string, CreativeRow>();
  const byNomeDrive = new Map<string, CreativeRow>();
  for (const r of rows) {
    if (r.linkDoDrive) {
      const m = r.linkDoDrive.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const id = m ? m[1] : r.linkDoDrive.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
      if (id) byFileId.set(id, r);
    }
    if (r.nomeDrive) byNomeDrive.set(r.nomeDrive.trim().toLowerCase(), r);
  }
  return { byFileId, byNomeDrive };
}

function lookupCreative(
  file: { id: string; name: string },
  byFileId: Map<string, CreativeRow>,
  byNomeDrive: Map<string, CreativeRow>,
): CreativeRow | null {
  return (
    byFileId.get(file.id) ??
    byNomeDrive.get(stripExtension(file.name).trim().toLowerCase()) ??
    null
  );
}

interface FlatFileRef {
  file: DriveFile;
  conjuntoIdx: number; // -1 no modo single
  formatTag: FormatTag | "default";
}

function flattenTree(tree: DriveTree): FlatFileRef[] {
  if (tree.mode === "single") {
    return tree.files.map((file) => ({ file, conjuntoIdx: -1, formatTag: "default" }));
  }
  const flat: FlatFileRef[] = [];
  tree.conjuntos.forEach((c, idx) => {
    for (const [tag, files] of Object.entries(c.formats) as Array<
      [FormatTag | "default", DriveFile[]]
    >) {
      for (const file of files) flat.push({ file, conjuntoIdx: idx, formatTag: tag });
    }
  });
  return flat;
}

function buildConjuntoBatches(
  tree: DriveTree,
  uploadedByName: Map<string, UploadedMedia>,
  byFileId: Map<string, CreativeRow>,
  byNomeDrive: Map<string, CreativeRow>,
): ConjuntoBatch[] {
  if (tree.mode === "single") {
    const ads: PairedAdMedia[] = [];
    let firstRow: CreativeRow | null = null;
    let firstName = "";
    for (const f of tree.files) {
      const u = uploadedByName.get(f.name);
      if (!u) continue;
      const row = lookupCreative(f, byFileId, byNomeDrive);
      if (!row) continue;
      if (!firstRow) { firstRow = row; firstName = stripExtension(f.name); }
      ads.push({
        baseName: stripExtension(f.name),
        default: u,
        finalAdName: row.nomeFinal || stripExtension(f.name),
        primaryFileName: f.name,
      });
    }
    if (ads.length === 0) {
      throw new Error("Nenhum arquivo do Drive encontrado na Biblioteca de Criativos.");
    }
    return [
      {
        personagem: firstRow?.personagem || "Sem-Personagem",
        adNameBase: firstRow?.nomeDrive || firstName,
        ads,
      },
    ];
  }

  const batches: ConjuntoBatch[] = [];
  for (const folder of tree.conjuntos) {
    const byFormatBasename: Partial<Record<FormatTag | "default", Map<string, UploadedMedia>>> = {};
    for (const [tag, files] of Object.entries(folder.formats) as Array<
      [FormatTag | "default", DriveFile[]]
    >) {
      const map = new Map<string, UploadedMedia>();
      for (const f of files) {
        const u = uploadedByName.get(f.name);
        if (u) map.set(canonicalBasename(f.name), u);
      }
      byFormatBasename[tag] = map;
    }

    const baseSet = new Set<string>();
    for (const map of Object.values(byFormatBasename)) {
      if (!map) continue;
      Array.from(map.keys()).forEach((k) => baseSet.add(k));
    }
    const basenames = Array.from(baseSet).sort();

    const ads: PairedAdMedia[] = [];
    let firstRow: CreativeRow | null = null;
    const personagens = new Set<string>();

    for (const base of basenames) {
      let primaryFile: DriveFile | undefined;
      for (const [, files] of Object.entries(folder.formats) as Array<
        [FormatTag | "default", DriveFile[]]
      >) {
        const f = files.find((x) => canonicalBasename(x.name) === base);
        if (f) { primaryFile = f; break; }
      }
      if (!primaryFile) continue;
      const row = lookupCreative(primaryFile, byFileId, byNomeDrive);
      if (!row) continue;
      if (!firstRow) firstRow = row;
      if (row.personagem) personagens.add(row.personagem);

      ads.push({
        baseName: base,
        format9x16: byFormatBasename["9x16"]?.get(base),
        format4x5: byFormatBasename["4x5"]?.get(base),
        default: byFormatBasename["default"]?.get(base),
        finalAdName: row.nomeFinal || base,
        primaryFileName: primaryFile.name,
      });
    }

    if (ads.length === 0) {
      throw new Error(
        `Conjunto "${folder.folderName}": nenhum arquivo cadastrado na Biblioteca de Criativos.`,
      );
    }
    if (personagens.size > 1) {
      console.warn(
        `[ads-creation] Conjunto "${folder.folderName}": personagens distintos ${Array.from(personagens).join(", ")}. Usando "${firstRow?.personagem}".`,
      );
    }

    batches.push({
      personagem: firstRow?.personagem || "Sem-Personagem",
      adNameBase: firstRow?.nomeDrive || basenames[0],
      ads,
      folderName: folder.folderName,
    });
  }
  return batches;
}

export async function createCampaignFromBriefing(
  args: CreateCampaignArgs,
): Promise<CreationResult> {
  const { briefing, adAccountId, pageId, instagramActorId, pixelId, onProgress, bookmark } = args;

  // 1. Resolve audience principal (se vazio → Advantage+ Audience, sem público específico)
  const audience = briefing.audienceName?.trim()
    ? await resolveAudienceByName(adAccountId, briefing.audienceName)
    : { id: "", name: "" }; // marcador "sem público — Advantage+"
  const excludedAudienceIds: string[] = [];
  if (briefing.excludedAudienceNames && briefing.excludedAudienceNames.length > 0) {
    const resolved = await Promise.all(
      briefing.excludedAudienceNames.map((n) =>
        resolveAudienceByName(adAccountId, n).catch((err) => {
          throw new Error(`Público a excluir "${n}" não encontrado: ${err.message ?? err}`);
        }),
      ),
    );
    excludedAudienceIds.push(...resolved.map((a) => a.id));
  }

  // 2. Lê o Drive (single ou bulk) com download dos buffers
  const tree = await loadDriveFolderTree(briefing.driveFolderUrl);

  // 3. Match com a Biblioteca de Criativos
  const libraryRows = await listAllForMatching();
  const { byFileId, byNomeDrive } = indexCreatives(libraryRows);

  // Validação: todos os arquivos têm entry na biblioteca
  const flat = flattenTree(tree);
  const unmatchedFiles: string[] = [];
  for (const ref of flat) {
    if (!lookupCreative(ref.file, byFileId, byNomeDrive)) unmatchedFiles.push(ref.file.name);
  }
  if (unmatchedFiles.length > 0) {
    throw new Error(
      `Arquivos sem cadastro na Biblioteca de Criativos: ${unmatchedFiles.join(", ")}. Cadastre em /criativos antes de subir.`,
    );
  }

  // 4. Upload em batch (com retomada via bookmark se rate limit interrompeu antes)
  const filesToUpload = flat.map((ref) => ref.file);
  const totalConjuntos = tree.mode === "bulk" ? tree.conjuntos.length : 1;

  // Reporta totals + fase upload pro banner antes de começar
  if (onProgress) {
    try {
      await onProgress({
        adsetIds: [], adIds: [], errors: [], conjuntos: [],
        // @ts-expect-error: campos estendidos vão direto no JSONB (não no tipo público)
        totals: { files: filesToUpload.length, conjuntos: totalConjuntos },
        progress: { phase: "upload", filesDone: bookmark?.uploadedMedia?.length ?? 0, conjuntosDone: 0 },
      });
    } catch {}
  }

  let uploaded: UploadedMedia[];
  try {
    uploaded = await uploadMediaBatch(
      adAccountId,
      filesToUpload,
      bookmark?.uploadedMedia ?? [],
      async (partial) => {
        if (!onProgress) return;
        try {
          await onProgress({
            adsetIds: [], adIds: [], errors: [], conjuntos: [],
            // @ts-expect-error: campos estendidos
            totals: { files: filesToUpload.length, conjuntos: totalConjuntos },
            progress: { phase: "upload", filesDone: partial.length, conjuntosDone: 0 },
          });
        } catch {}
      },
    );
  } catch (err: any) {
    if (err instanceof MediaUploadInterrupted) {
      // Persiste bookmark com o que já subiu — caller agenda retomada
      throw new CreationInterrupted(
        `Upload pausado por rate limit após ${err.partial.length}/${filesToUpload.length} mídias.`,
        { uploadedMedia: err.partial },
        err.cause.code,
      );
    }
    throw err;
  }
  const uploadedByName = new Map(uploaded.map((u) => [u.fileName, u]));

  // 5. Constrói ConjuntoBatch[]
  const batches = buildConjuntoBatches(tree, uploadedByName, byFileId, byNomeDrive);

  // 5.1 Aplica overrides por conjunto (público/orçamento diferente por conjunto, modo bulk)
  if (tree.mode === "bulk" && briefing.conjuntoOverrides && briefing.conjuntoOverrides.length > 0) {
    const overridesByFolder = new Map(
      briefing.conjuntoOverrides.map((o) => [o.folderName, o]),
    );
    // Resolve audiences override em paralelo, dedup por nome
    const uniqueAudienceNames = Array.from(
      new Set(
        briefing.conjuntoOverrides
          .map((o) => o.audienceName)
          .filter((n): n is string => Boolean(n) && n !== briefing.audienceName),
      ),
    );
    const resolvedMap = new Map<string, string>([[briefing.audienceName, audience.id]]);
    if (uniqueAudienceNames.length > 0) {
      const resolved = await Promise.all(
        uniqueAudienceNames.map((n) =>
          resolveAudienceByName(adAccountId, n).then((a) => [n, a.id] as const),
        ),
      );
      for (const [name, id] of resolved) resolvedMap.set(name, id);
    }
    for (const batch of batches) {
      if (!batch.folderName) continue;
      const ov = overridesByFolder.get(batch.folderName);
      if (!ov) continue;
      if (ov.audienceName && ov.audienceName !== briefing.audienceName) {
        batch.audienceIdOverride = resolvedMap.get(ov.audienceName);
      }
      if (ov.dailyBudgetCents && ov.dailyBudgetCents !== briefing.dailyBudgetCents) {
        batch.dailyBudgetCentsOverride = ov.dailyBudgetCents;
      }
    }
  }

  // 6. Marca transição pra fase de criação (banner mostra "criando ads...")
  if (onProgress) {
    try {
      await onProgress({
        adsetIds: [], adIds: [], errors: [], conjuntos: [],
        // @ts-expect-error: campos estendidos
        totals: { files: filesToUpload.length, conjuntos: totalConjuntos },
        progress: { phase: "create", filesDone: uploaded.length, conjuntosDone: 0 },
      });
    } catch {}
  }

  // Orquestra criação no Meta — orchestrateCreation fará flush por conjunto via onProgress
  return orchestrateCreation(
    { adAccountId, pageId, instagramActorId, pixelId },
    briefing,
    audience.id,
    batches,
    excludedAudienceIds,
    async (snapshot) => {
      if (!onProgress) return;
      try {
        await onProgress({
          ...snapshot,
          // @ts-expect-error: campos estendidos
          totals: { files: filesToUpload.length, conjuntos: totalConjuntos },
          progress: { phase: "create", filesDone: uploaded.length, conjuntosDone: snapshot.adsetIds.length },
        });
      } catch {}
    },
  );
}

export { listAudiences, resolveAudienceByName } from "./audienceResolver";
export { listDriveFolder, listDriveFolderTree } from "./driveLoader";
