import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getDriveClient } from '../autoreport/credentials';

export type SyncReport = {
  ok: boolean;
  trilhasAtivas: number;
  videosAtivos: number;
  trilhasDesativadas: number;
  videosDesativados: number;
  erros: Array<{ contexto: string; mensagem: string }>;
  alreadyRunning?: boolean;
};

let isSyncing = false;

// Apenas para uso em testes
export function _resetSyncLockForTest() {
  isSyncing = false;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export async function syncInternalTrainings(): Promise<SyncReport> {
  if (isSyncing) {
    return {
      ok: true,
      alreadyRunning: true,
      trilhasAtivas: 0,
      videosAtivos: 0,
      trilhasDesativadas: 0,
      videosDesativados: 0,
      erros: [],
    };
  }

  const rootFolderId = process.env.INTERNAL_TRAININGS_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    return {
      ok: false,
      trilhasAtivas: 0,
      videosAtivos: 0,
      trilhasDesativadas: 0,
      videosDesativados: 0,
      erros: [{ contexto: 'config', mensagem: 'INTERNAL_TRAININGS_DRIVE_FOLDER_ID não configurada' }],
    };
  }

  isSyncing = true;
  const erros: Array<{ contexto: string; mensagem: string }> = [];
  const seenFolderIds = new Set<string>();
  const seenFileIds = new Set<string>();
  const erroredFolderIds = new Set<string>();
  let trilhasAtivas = 0;
  let videosAtivos = 0;
  let trilhasDesativadas = 0;
  let videosDesativados = 0;

  try {
    const drive = getDriveClient();

    // 1. Listar subpastas (com paginação).
    // supportsAllDrives + includeItemsFromAllDrives são necessários porque a
    // pasta TREINAMENTOS vive num Shared Drive (Drive de Equipe). Sem isso, a
    // API retorna "File not found" / lista vazia mesmo com permissão.
    const folders: Array<{ id?: string | null; name?: string | null }> = [];
    let folderPageToken: string | undefined = undefined;
    do {
      const foldersResp: any = await drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken: folderPageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      folders.push(...(foldersResp.data.files || []));
      folderPageToken = foldersResp.data.nextPageToken || undefined;
    } while (folderPageToken);

    // 2. Para cada subpasta: upsert track + listar vídeos
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue;
      try {
        // Upsert track (volta o ID via RETURNING)
        const upsertResult = await db.execute(sql`
          INSERT INTO cortex_core.internal_video_tracks (drive_folder_id, nome, is_active)
          VALUES (${folder.id}, ${folder.name}, TRUE)
          ON CONFLICT (drive_folder_id) DO UPDATE
            SET nome = EXCLUDED.nome,
                is_active = TRUE,
                updated_at = NOW()
          RETURNING id
        `);
        const trackId = (upsertResult.rows[0] as { id: string }).id;
        seenFolderIds.add(folder.id);
        trilhasAtivas++;

        // Listar vídeos da subpasta (com paginação)
        let pageToken: string | undefined = undefined;
        do {
          const filesResp: any = await drive.files.list({
            q: `'${folder.id}' in parents and mimeType contains 'video/' and trashed=false`,
            fields: 'nextPageToken, files(id, name, mimeType, videoMediaMetadata(durationMillis), modifiedTime)',
            pageSize: 1000,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          const files = filesResp.data.files || [];

          for (const file of files) {
            if (!file.id || !file.name) continue;
            // Defensive: garantir que é mesmo um vídeo (filtro do Drive é server-side
            // mas blindamos contra leaks)
            if (!file.mimeType?.startsWith('video/')) continue;
            try {
              const duracaoMs = file.videoMediaMetadata?.durationMillis
                ? Number(file.videoMediaMetadata.durationMillis)
                : null;
              const modifiedTime = file.modifiedTime ? new Date(file.modifiedTime) : null;
              const thumbnailUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;

              await db.execute(sql`
                INSERT INTO cortex_core.internal_videos
                  (track_id, drive_file_id, nome, mime_type, thumbnail_url, duracao_ms, drive_modified_time, is_active)
                VALUES
                  (${trackId}, ${file.id}, ${file.name}, ${file.mimeType || null},
                   ${thumbnailUrl}, ${duracaoMs}, ${modifiedTime}, TRUE)
                ON CONFLICT (drive_file_id) DO UPDATE
                  SET track_id = EXCLUDED.track_id,
                      nome = EXCLUDED.nome,
                      mime_type = EXCLUDED.mime_type,
                      thumbnail_url = EXCLUDED.thumbnail_url,
                      duracao_ms = EXCLUDED.duracao_ms,
                      drive_modified_time = EXCLUDED.drive_modified_time,
                      is_active = TRUE,
                      updated_at = NOW()
              `);
              seenFileIds.add(file.id);
              videosAtivos++;
            } catch (e: any) {
              erros.push({
                contexto: `vídeo "${file.name}" em "${folder.name}"`,
                mensagem: e.message || String(e),
              });
            }
          }
          pageToken = filesResp.data.nextPageToken || undefined;
        } while (pageToken);
      } catch (e: any) {
        if (folder.id) erroredFolderIds.add(folder.id);
        erros.push({ contexto: `trilha "${folder.name}"`, mensagem: e.message || String(e) });
      }
    }

    // 3. Reconciliação de trilhas (soft-delete)
    // Excluímos trilhas que erraram durante o sync para evitar perda transitória de dados.
    try {
      const allTracksResult = await db.execute(sql`
        SELECT id, drive_folder_id FROM cortex_core.internal_video_tracks WHERE is_active = TRUE
      `);
      const tracksToDeactivate = (allTracksResult.rows as Array<{ id: string; drive_folder_id: string }>)
        .filter((t) => !seenFolderIds.has(t.drive_folder_id) && !erroredFolderIds.has(t.drive_folder_id))
        .map((t) => t.id);

      if (tracksToDeactivate.length > 0) {
        await db.execute(sql`
          UPDATE cortex_core.internal_video_tracks
          SET is_active = FALSE, updated_at = NOW()
          WHERE id = ANY(${tracksToDeactivate})
        `);
        trilhasDesativadas = tracksToDeactivate.length;
      }
    } catch (e: any) {
      erros.push({ contexto: 'reconciliação trilhas', mensagem: e.message || String(e) });
    }

    // 4. Reconciliação de vídeos (soft-delete)
    // Excluímos vídeos cujo track corresponde a folder que errou no sync.
    try {
      let videosFromErroredFolders = new Set<string>();
      if (erroredFolderIds.size > 0) {
        const erroredArr = Array.from(erroredFolderIds);
        const result = await db.execute(sql`
          SELECT v.id
          FROM cortex_core.internal_videos v
          JOIN cortex_core.internal_video_tracks t ON t.id = v.track_id
          WHERE t.drive_folder_id = ANY(${erroredArr}) AND v.is_active = TRUE
        `);
        videosFromErroredFolders = new Set((result.rows as Array<{ id: string }>).map((r) => r.id));
      }

      const allVideosResult = await db.execute(sql`
        SELECT id, drive_file_id FROM cortex_core.internal_videos WHERE is_active = TRUE
      `);
      const videosToDeactivate = (allVideosResult.rows as Array<{ id: string; drive_file_id: string }>)
        .filter((v) => !seenFileIds.has(v.drive_file_id) && !videosFromErroredFolders.has(v.id))
        .map((v) => v.id);

      if (videosToDeactivate.length > 0) {
        await db.execute(sql`
          UPDATE cortex_core.internal_videos
          SET is_active = FALSE, updated_at = NOW()
          WHERE id = ANY(${videosToDeactivate})
        `);
        videosDesativados = videosToDeactivate.length;
      }
    } catch (e: any) {
      erros.push({ contexto: 'reconciliação vídeos', mensagem: e.message || String(e) });
    }

    return { ok: true, trilhasAtivas, videosAtivos, trilhasDesativadas, videosDesativados, erros };
  } catch (e: any) {
    erros.push({ contexto: 'sync raiz', mensagem: e.message || String(e) });
    return { ok: false, trilhasAtivas, videosAtivos, trilhasDesativadas: 0, videosDesativados: 0, erros };
  } finally {
    isSyncing = false;
  }
}
