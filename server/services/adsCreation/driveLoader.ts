/**
 * Lê uma pasta do Google Drive e baixa os arquivos de mídia (imagem/vídeo).
 *
 * A pasta precisa estar compartilhada com o e-mail da Service Account
 * configurada em GOOGLE_SERVICE_ACCOUNT_JSON.
 *
 * Suporta dois modos:
 *  - single: pasta-mãe contém arquivos de mídia direto → 1 conjunto
 *  - bulk:   pasta-mãe contém subpastas (cada subpasta = 1 conjunto), e cada
 *            subpasta pode ter sub-subpastas `9x16` / `4x5` para pareamento
 *            de formatos no mesmo anúncio.
 */

import pLimit from "p-limit";
import { getDriveClient } from "../../autoreport/credentials";
import type { DriveFile } from "./types";
// @ts-ignore — heic-convert não tem tipos
import heicConvert from "heic-convert";

const FOLDER_ID_REGEX = /\/folders\/([a-zA-Z0-9_-]+)/;
const MIME_FOLDER = "application/vnd.google-apps.folder";

/**
 * Concorrência de downloads simultâneos do Drive.
 * Evita pico de memória ao baixar muitos arquivos grandes (ex: 12 vídeos × 600MB = 7GB).
 */
const DRIVE_DOWNLOAD_CONCURRENCY = 3;

function isHeic(file: { mimeType?: string; name: string }): boolean {
  const mime = (file.mimeType ?? "").toLowerCase();
  if (mime === "image/heic" || mime === "image/heif" || mime === "application/octet-stream") {
    if (mime.includes("heic") || mime.includes("heif")) return true;
  }
  return /\.(heic|heif)$/i.test(file.name);
}

async function maybeConvertHeic(file: DriveFile): Promise<DriveFile> {
  if (!file.buffer) return file;
  if (!isHeic(file)) return file;
  const jpgBuffer = (await heicConvert({
    buffer: file.buffer,
    format: "JPEG",
    quality: 0.95,
  })) as Buffer;
  return {
    ...file,
    buffer: Buffer.from(jpgBuffer),
    mimeType: "image/jpeg",
    name: file.name.replace(/\.(heic|heif)$/i, ".jpg"),
  };
}

export function extractFolderId(driveUrl: string): string {
  const trimmed = driveUrl.trim();
  const match = trimmed.match(FOLDER_ID_REGEX);
  if (match) return match[1];
  // Aceita também passagem direta do ID
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  throw new Error(`URL de pasta do Drive inválida: ${driveUrl}`);
}

function classifyMime(mimeType: string, name = ""): "image" | "video" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (/\.(heic|heif)$/i.test(name)) return "image";
  return null;
}

interface DriveSubfolder {
  id: string;
  name: string;
}

interface FolderContents {
  files: DriveFile[];
  subfolders: DriveSubfolder[];
}

/**
 * Lista os filhos imediatos de uma pasta: arquivos de mídia E subpastas.
 * Não baixa conteúdo binário.
 */
async function listFolderContents(folderId: string): Promise<FolderContents> {
  const drive = getDriveClient();
  const result = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files: DriveFile[] = [];
  const subfolders: DriveSubfolder[] = [];
  for (const f of result.data.files ?? []) {
    if (f.mimeType === MIME_FOLDER) {
      subfolders.push({ id: f.id!, name: f.name ?? "" });
      continue;
    }
    const kind = classifyMime(f.mimeType ?? "", f.name ?? "");
    if (!kind) continue;
    files.push({
      id: f.id!,
      name: f.name ?? "untitled",
      mimeType: f.mimeType ?? "",
      kind,
    });
  }
  return { files, subfolders };
}

// ============== Contexto da pasta: roteiro (Doc) + produto (pela linhagem) ==============
// Em vez de a skill empurrar esses dados, o Cortex puxa do próprio Drive na ingestão:
// - roteiro = o Google Doc que mora na pasta do ad (criado pela skill no PASSO 3)
// - produto = inferido pela pasta-pai do ad (raízes por produto, do turbo-ads-workflow)

const DOC_MIME = "application/vnd.google-apps.document";

// IDs das pastas-raiz por produto (turbo-ads-workflow → PASSO 1). vídeo e imagem mapeiam pro mesmo produto.
const PRODUTO_BY_ROOT: Record<string, string> = {
  "1uYCpqUUk_kUhiGLqxeG-T489xIK_4yXQ": "creators",       // Creators vídeo
  "1xEV4TUWE_mmnDOlT4S2-glPrRpigJVP-": "creators",       // Creators imagem
  "1-YyoW8UNo6MaTdy_lhxYqlw_gDfk18cH": "ecommerce",      // E-Commerce vídeo
  "1GSnXmN5ZV6UY5zD590M9GaFdA05t-U7I": "ecommerce",      // E-Commerce imagem
  "1d3JjYzwMFSXtPACUXNtJfRLnB1Ect0p2": "estruturacao",  // Estruturação vídeo
  "1--jZ5VkBRZ2drH2Lhpy3NWk1ljUZlOFX": "estruturacao",  // Estruturação imagem
};

async function getParentId(folderId: string): Promise<string | null> {
  const drive = getDriveClient();
  const r = await drive.files.get({ fileId: folderId, fields: "parents", supportsAllDrives: true });
  return r.data.parents?.[0] ?? null;
}

async function findRoteiroDoc(folderId: string): Promise<string | null> {
  const drive = getDriveClient();
  const r = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = '${DOC_MIME}' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const doc = r.data.files?.[0];
  return doc?.id ? `https://docs.google.com/document/d/${doc.id}/edit` : null;
}

/**
 * Resolve roteiroUrl + produto a partir da pasta colada — subindo a linhagem (pasta, pai, avô)
 * pra cobrir o caso de colarem a subpasta "01 - Editados".
 */
export async function resolveFolderContext(
  folderUrl: string,
): Promise<{ roteiroUrl: string | null; produto: string | null }> {
  const folderId = extractFolderId(folderUrl);
  const parent = await getParentId(folderId).catch(() => null);
  const grandparent = parent ? await getParentId(parent).catch(() => null) : null;

  let produto: string | null = null;
  for (const id of [folderId, parent, grandparent]) {
    if (id && PRODUTO_BY_ROOT[id]) { produto = PRODUTO_BY_ROOT[id]; break; }
  }

  let roteiroUrl = await findRoteiroDoc(folderId).catch(() => null);
  if (!roteiroUrl && parent) roteiroUrl = await findRoteiroDoc(parent).catch(() => null);

  return { roteiroUrl, produto };
}

/**
 * Lista arquivos de mídia (imagem/vídeo) na pasta. Não baixa o conteúdo.
 * Compat: continua existindo pra fluxo single mode antigo.
 */
export async function listDriveFolder(folderUrl: string): Promise<DriveFile[]> {
  const folderId = extractFolderId(folderUrl);
  const { files } = await listFolderContents(folderId);
  return files;
}

/**
 * Baixa o conteúdo binário de um arquivo do Drive.
 */
export async function downloadDriveFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Lista + baixa em uma chamada só. Retorna os DriveFile com buffer preenchido.
 */
export async function loadDriveFolder(folderUrl: string): Promise<DriveFile[]> {
  const files = await listDriveFolder(folderUrl);
  if (files.length === 0) {
    throw new Error("Pasta do Drive vazia ou sem arquivos de imagem/vídeo");
  }
  const withBuffers = await Promise.all(
    files.map(async (f) => {
      const buffer = await downloadDriveFile(f.id);
      return maybeConvertHeic({ ...f, buffer });
    }),
  );
  return withBuffers;
}

// ============== Bulk mode (múltiplos conjuntos por execução) ==============

export type FormatTag = "9x16" | "4x5";

export interface ConjuntoFolder {
  /** Nome literal da subpasta no Drive (apenas pra display, não vira nome do ad set). */
  folderName: string;
  /**
   * Pares (formato → arquivos) para o conjunto.
   * Cada chave (`9x16` / `4x5`) só aparece se a subpasta correspondente existir.
   * Se o conjunto não tem subpastas de formato, fica `{ default: [...] }`.
   */
  formats: Partial<Record<FormatTag, DriveFile[]>> & { default?: DriveFile[] };
}

export type DriveTree =
  | { mode: "single"; files: DriveFile[] }
  | { mode: "bulk"; conjuntos: ConjuntoFolder[] };

function detectFormatTag(name: string): FormatTag | null {
  const n = name.trim().toLowerCase();
  if (n === "9x16" || n === "9:16" || /^9.?x.?16$/i.test(n)) return "9x16";
  if (n === "4x5" || n === "4:5" || /^4.?x.?5$/i.test(n)) return "4x5";
  return null;
}

/**
 * Basename canônico pra pareamento bulk entre `9x16/` e `4x5/`.
 *
 * Quando o nome do arquivo carrega o formato no próprio basename
 * (ex.: `vv-novosclientes-marina-h1-b2-cta1-9x16-v01.mp4`
 *  ou  `Mockup_caprichado_react_Esther_Hook3_9x16_1.mp4`),
 * removemos o segmento de formato pra permitir o pareamento. Aceita os dois
 * separadores comuns (`-` e `_`).
 *
 * Também removemos um sufixo de versão opcional no final (`_1`, `-01`, `_v02`)
 * porque versões são geralmente exportadas só num dos formatos.
 *
 * Pra arquivos sem nenhum desses segmentos, retorna o basename literal.
 */
export function canonicalBasename(filename: string): string {
  let s = filename.replace(/\.[^.]+$/, "");
  // remove segmento de formato em qualquer posição
  s = s.replace(/[-_](9x16|4x5|1x1|16x9)(?=[-_]|$)/i, "");
  // remove sufixo de versão no final (ex.: _1, -01, _v02)
  s = s.replace(/[-_]v?\d+$/i, "");
  return s;
}

/**
 * Lê a pasta-mãe e detecta automaticamente single vs bulk.
 *
 * Modo bulk: quando a pasta-mãe contém apenas subpastas (zero arquivos de mídia
 * direto). Cada subpasta vira 1 conjunto. Dentro de cada subpasta, sub-subpastas
 * `9x16` / `4x5` são lidas como variantes de formato; se não houver, os arquivos
 * direto da subpasta-conjunto são tratados como formato único.
 *
 * Modo single: pasta-mãe contém arquivos de mídia direto (compat com fluxo antigo).
 *
 * Mistura (arquivos + subpastas no root) é rejeitada para evitar ambiguidade.
 */
export async function listDriveFolderTree(folderUrl: string): Promise<DriveTree> {
  const rootId = extractFolderId(folderUrl);
  const root = await listFolderContents(rootId);

  if (root.files.length === 0 && root.subfolders.length === 0) {
    throw new Error("Pasta do Drive vazia");
  }

  if (root.files.length > 0 && root.subfolders.length > 0) {
    throw new Error(
      "Mistura de arquivos e subpastas na pasta-mãe não é suportada. " +
        "Use ou só arquivos (single) ou só subpastas (bulk).",
    );
  }

  if (root.files.length > 0) {
    return { mode: "single", files: root.files };
  }

  // bulk: lê cada subpasta como 1 conjunto. Subpastas vazias são puladas (não bloqueiam o resto).
  const conjuntos: ConjuntoFolder[] = [];
  const skippedEmpty: string[] = [];
  for (const sub of root.subfolders) {
    const conjuntoContents = await listFolderContents(sub.id);
    const formats: ConjuntoFolder["formats"] = {};

    // Filtra subpastas que são tags de formato; resto é ignorado com warning
    const formatSubs = conjuntoContents.subfolders
      .map((s) => ({ ...s, tag: detectFormatTag(s.name) }))
      .filter((s) => s.tag !== null) as Array<DriveSubfolder & { tag: FormatTag }>;
    const unknownSubs = conjuntoContents.subfolders.filter(
      (s) => detectFormatTag(s.name) === null,
    );
    if (unknownSubs.length > 0) {
      console.warn(
        `[adsCreation] Conjunto "${sub.name}" tem subpastas não-formato ignoradas: ${unknownSubs
          .map((s) => s.name)
          .join(", ")}`,
      );
    }

    if (formatSubs.length > 0) {
      // Modo multi-formato: ler arquivos de cada subpasta de formato (pula formatos vazios)
      for (const fs of formatSubs) {
        const inner = await listFolderContents(fs.id);
        if (inner.files.length === 0) {
          console.warn(
            `[adsCreation] Conjunto "${sub.name}" / formato "${fs.name}" está vazio — formato pulado.`,
          );
          continue;
        }
        formats[fs.tag] = inner.files;
      }
      // Se nenhum formato sobrou com conteúdo, conjunto inteiro é pulado
      if (Object.keys(formats).length === 0) {
        console.warn(
          `[adsCreation] Conjunto "${sub.name}" pulado — todas as subpastas de formato estavam vazias.`,
        );
        skippedEmpty.push(sub.name);
        continue;
      }
      // Pareamento por basename canônico — arquivos sem par viram ads single-format
      // (lógica do usuário: "mesmo nome = mesmo ad com 2 formatos; nome diferente = ads separados").
      if (formats["9x16"] && formats["4x5"]) {
        const baseSet9x16 = new Set(formats["9x16"]!.map((f) => canonicalBasename(f.name)));
        const baseSet4x5 = new Set(formats["4x5"]!.map((f) => canonicalBasename(f.name)));
        const onlyIn9x16 = Array.from(baseSet9x16).filter((b) => !baseSet4x5.has(b));
        const onlyIn4x5 = Array.from(baseSet4x5).filter((b) => !baseSet9x16.has(b));
        if (onlyIn9x16.length > 0 || onlyIn4x5.length > 0) {
          console.warn(
            `[adsCreation] Conjunto "${sub.name}": ${onlyIn9x16.length + onlyIn4x5.length} arquivo(s) ` +
              `sem par entre 9x16/4x5 — vão virar ads single-format. ` +
              `Sem par no 4x5: [${onlyIn9x16.join(", ")}]. Sem par no 9x16: [${onlyIn4x5.join(", ")}]`,
          );
        }
      }
    } else if (conjuntoContents.files.length > 0) {
      // Conjunto sem subpastas de formato: arquivos vão no formato default (1 placement)
      formats.default = conjuntoContents.files;
    } else {
      // Conjunto totalmente vazio — pula em vez de quebrar o batch inteiro.
      console.warn(`[adsCreation] Conjunto "${sub.name}" pulado — pasta vazia.`);
      skippedEmpty.push(sub.name);
      continue;
    }

    conjuntos.push({ folderName: sub.name, formats });
  }

  if (conjuntos.length === 0) {
    throw new Error(
      `Nenhum conjunto utilizável foi encontrado. ${
        skippedEmpty.length > 0 ? `Pastas vazias puladas: ${skippedEmpty.join(", ")}.` : ""
      }`,
    );
  }
  if (skippedEmpty.length > 0) {
    console.warn(
      `[adsCreation] ${skippedEmpty.length} conjunto(s) pulado(s) por estarem vazios: ${skippedEmpty.join(", ")}`,
    );
  }

  return { mode: "bulk", conjuntos };
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/**
 * Baixa todos os buffers de um DriveTree retornado por listDriveFolderTree.
 * Mantém a forma da árvore — apenas anexa `buffer` em cada DriveFile.
 */
export async function loadDriveFolderTree(folderUrl: string): Promise<DriveTree> {
  const tree = await listDriveFolderTree(folderUrl);

  // Limit de concorrência no download — evita pico de memória com muitos arquivos grandes.
  // Mesma concorrência usada nos uploads pra simetria operacional.
  const dlLimit = pLimit(DRIVE_DOWNLOAD_CONCURRENCY);
  const fetchOne = (f: DriveFile) =>
    dlLimit(async () => {
      const buffer = await downloadDriveFile(f.id);
      return maybeConvertHeic({ ...f, buffer });
    });

  if (tree.mode === "single") {
    const filesWithBuf = await Promise.all(tree.files.map(fetchOne));
    return { mode: "single", files: filesWithBuf };
  }
  const conjuntos: ConjuntoFolder[] = [];
  for (const c of tree.conjuntos) {
    const out: ConjuntoFolder = { folderName: c.folderName, formats: {} };
    for (const [tag, files] of Object.entries(c.formats) as Array<
      [FormatTag | "default", DriveFile[]]
    >) {
      const withBufs = await Promise.all(files.map(fetchOne));
      (out.formats as any)[tag] = withBufs;
    }
    conjuntos.push(out);
  }
  return { mode: "bulk", conjuntos };
}
