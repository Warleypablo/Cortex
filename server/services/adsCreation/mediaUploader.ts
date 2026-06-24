/**
 * Faz upload das mídias baixadas do Drive para a conta de anúncio.
 * Imagens: síncrono — retorna image_hash imediatamente.
 * Vídeos: assíncrono — sobe + polling até status "ready" antes de retornar video_id.
 */

import pLimit from "p-limit";
import { metaUploadImage, metaUploadVideo, pollVideoUntilReady, MetaRateLimitError } from "./metaApi";
import type { DriveFile, UploadedMedia } from "./types";

/**
 * Concorrência de uploads simultâneos (vídeos + imagens compartilham o mesmo limit).
 * 3 é conservador: triplica vazão sem estressar muito o rate limit do Meta.
 */
const UPLOAD_CONCURRENCY = 3;

/**
 * Upload incremental com suporte a bookmark.
 *
 * Se `alreadyUploaded` for fornecido, arquivos com nome presente nele são pulados (já subiram em
 * uma execução anterior). Se rate limit (MetaRateLimitError) bater no meio, o erro é re-lançado
 * com `partial` populado pra o caller persistir o bookmark.
 */
export class MediaUploadInterrupted extends Error {
  readonly partial: UploadedMedia[];
  readonly cause: MetaRateLimitError;
  constructor(partial: UploadedMedia[], cause: MetaRateLimitError) {
    super(`Upload interrompido por rate limit após ${partial.length} mídias`);
    this.name = "MediaUploadInterrupted";
    this.partial = partial;
    this.cause = cause;
  }
}

export async function uploadMediaBatch(
  adAccountId: string,
  files: DriveFile[],
  alreadyUploaded: UploadedMedia[] = [],
  onFileUploaded?: (uploaded: UploadedMedia[]) => Promise<void> | void,
): Promise<UploadedMedia[]> {
  // Mapa de nomes já enviados (do bookmark) — pula esses arquivos.
  const doneByName = new Map<string, UploadedMedia>();
  for (const u of alreadyUploaded) doneByName.set(u.fileName, u);

  // Array compartilhado entre tasks paralelas — Node single-thread garante atomicidade dos pushes.
  const uploaded: UploadedMedia[] = [...alreadyUploaded];
  const errors: string[] = [];
  // Captura primeiro rate-limit pra propagar como MediaUploadInterrupted após Promise.all.
  let rateLimitErr: MetaRateLimitError | null = null;

  // Lista de arquivos que ainda precisam subir (filtrando os já presentes no bookmark)
  const filesPending = files.filter((f) => !doneByName.has(f.name));
  if (filesPending.length === 0) return uploaded;

  console.log(
    `[uploader] processando ${filesPending.length} arquivo(s) em paralelo (concorrência=${UPLOAD_CONCURRENCY})`,
  );

  const limit = pLimit(UPLOAD_CONCURRENCY);
  const tasks = filesPending.map((file) =>
    limit(async () => {
      // Se outro upload já hit rate limit, abortar os pendentes sem tocar na API.
      if (rateLimitErr) return;
      if (!file.buffer) {
        errors.push(`${file.name}: buffer ausente`);
        return;
      }
      try {
        if (file.kind === "video") {
          const videoId = await metaUploadVideo(adAccountId, file.name, file.buffer);
          await pollVideoUntilReady(videoId);
          uploaded.push({ fileName: file.name, kind: "video", videoId });
        } else {
          const hash = await metaUploadImage(adAccountId, file.name, file.buffer);
          uploaded.push({ fileName: file.name, kind: "image", imageHash: hash });
        }
        // Notifica progresso após cada arquivo concluído
        if (onFileUploaded) {
          try {
            await onFileUploaded(uploaded);
          } catch (e: any) {
            console.warn("[uploader] onFileUploaded falhou:", e?.message ?? e);
          }
        }
      } catch (err: any) {
        if (err instanceof MetaRateLimitError) {
          // Marca rate limit — outras tasks que ainda não começaram saem cedo.
          // Tasks já em execução vão completar ou também tomar 80004 (qualquer cenário ok).
          if (!rateLimitErr) rateLimitErr = err;
          return;
        }
        errors.push(`${file.name}: ${err?.message ?? "falha no upload"}`);
      }
    }),
  );

  await Promise.all(tasks);

  // Se houve rate limit, devolve o que conseguiu subir como bookmark
  if (rateLimitErr) {
    throw new MediaUploadInterrupted(uploaded, rateLimitErr);
  }

  if (uploaded.length === 0) {
    throw new Error(
      `Nenhuma mídia foi enviada com sucesso. Erros: ${errors.join("; ") || "desconhecidos"}`,
    );
  }

  return uploaded;
}
