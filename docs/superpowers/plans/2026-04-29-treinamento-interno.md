# Treinamento Interno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma terceira aba "Treinamento Interno" à página `Conhecimentos`, com vídeos sincronizados automaticamente da pasta `TREINAMENTOS` no Google Drive, player embed, marcação manual de conclusão, likes e comentários.

**Architecture:** Cron a cada 1h (+ botão manual) sincroniza pasta do Drive → 5 tabelas em `cortex_core` (trilhas, vídeos, conclusões, likes, comentários). Frontend lê só do banco; player é iframe `drive.google.com/file/d/{ID}/preview`. Sync nunca deleta — usa soft-delete (`is_active = false`) para preservar comentários/likes.

**Tech Stack:** Drizzle ORM + Postgres (`cortex_core` schema), Express, googleapis (já configurado em `server/autoreport/credentials.ts`), Vitest, React + React Query, Tailwind, shadcn/ui (Card, Tabs, Dialog, AlertDialog), wouter para roteamento.

**Spec:** `docs/superpowers/specs/2026-04-29-treinamento-interno-design.md`

---

## File Structure

### Backend
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `migrations/2026-04-29-internal-trainings.sql` | CREATE | Migration SQL idempotente das 5 tabelas + índices |
| `shared/schema.ts` | MODIFY | Adicionar definições Drizzle das 5 tabelas |
| `server/services/internalTrainingsSync.ts` | CREATE | Sync com Drive (única fonte de comunicação com googleapis) |
| `server/services/internalTrainingsSync.test.ts` | CREATE | Testes do sync (mock googleapis) |
| `server/routes/internalTrainings.ts` | CREATE | Endpoints REST `/api/treinamentos-internos/*` |
| `server/routes/internalTrainings.test.ts` | CREATE | Testes dos endpoints (toggle, autorização, 404) |
| `server/routes.ts` | MODIFY | Registrar rotas via `registerInternalTrainingsRoutes(app)` |
| `server/index.ts` | MODIFY | Cron a cada 1h chamando o sync |

### Frontend
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `client/src/components/treinamento-interno/trackThemes.ts` | CREATE | Map `{ "Performance": { color, icon }, ... }` + fallback default |
| `client/src/components/treinamento-interno/VideoPlayer.tsx` | CREATE | Wrapper do iframe Drive + fallback "Abrir no Drive" |
| `client/src/components/treinamento-interno/ComentarioItem.tsx` | CREATE | Render de um comentário (com botão excluir condicional) |
| `client/src/components/treinamento-interno/ComentariosThread.tsx` | CREATE | Form + lista (via ComentarioItem) |
| `client/src/components/treinamento-interno/VideoCard.tsx` | CREATE | Card de vídeo com thumbnail, duração, ✓ |
| `client/src/components/treinamento-interno/TrilhaCard.tsx` | CREATE | Card expansível de trilha com progresso |
| `client/src/components/treinamento-interno/TreinamentoInternoTab.tsx` | CREATE | Conteúdo da 3ª aba |
| `client/src/pages/TreinamentoInternoVideo.tsx` | CREATE | Página `/conhecimentos/treinamentos/:videoId` |
| `client/src/pages/Conhecimentos.tsx` | MODIFY | Adicionar 3ª `TabsTrigger`/`TabsContent` |
| `client/src/App.tsx` | MODIFY | Registrar rota `/conhecimentos/treinamentos/:videoId` |

### Operacional
| Item | Local | Valor |
|---|---|---|
| `INTERNAL_TRAININGS_DRIVE_FOLDER_ID` | `.env` local + produção | ID da pasta `TREINAMENTOS` (provavelmente `126AbwLea-me3aeQRKxl3Y9pIYnztY438`) |
| Compartilhamento da pasta | Google Drive (manual) | Service account como Leitor |
| Permissão dos vídeos | Google Drive (manual) | "Qualquer pessoa com o link → Leitor" |

---

## Convenções a seguir

- **DB access:** `db.execute(sql\`...\`)` (padrão do `server/routes.ts:8511+` para conhecimentos atual). Importar `db` de `./db` e `sql` de `drizzle-orm`.
- **Auth user:** `(req as any).user?.email` para `userEmail` e `(req as any).user?.name || req.user?.email?.split('@')[0]` para `userNome`. `app.use("/api", isAuthenticated)` já protege todas as rotas (`server/routes.ts:438`).
- **Logs:** prefixo `[treinamentos-internos]` em todos os `console.log`/`console.error` de backend.
- **Testes:** Vitest com `vi.mock`, `describe`/`it`/`expect`. Padrão em `server/services/sendgrid-notification.test.ts`. Rodar com `npm test`.
- **Server reinicia manual** após mudanças no backend (`tsx` sem watch). Comando: `lsof -ti:3000 | xargs kill -9 ; npm run dev`.
- **Migrations** aplicadas local **e** em produção (regra do projeto).
- **Commits:** Conventional Commits + `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.

---

## Task 1: Schema e migration

**Files:**
- Create: `migrations/2026-04-29-internal-trainings.sql`
- Modify: `shared/schema.ts` (adicionar definições no fim do arquivo, antes de quaisquer `// ===` separadores que estejam ao final)

- [ ] **Step 1: Criar migration SQL idempotente**

Criar arquivo `migrations/2026-04-29-internal-trainings.sql`:

```sql
-- Treinamento Interno — 5 tabelas: trilhas, vídeos, conclusões, likes, comentários

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_tracks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_folder_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.internal_videos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id VARCHAR NOT NULL REFERENCES cortex_core.internal_video_tracks(id),
  drive_file_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  mime_type TEXT,
  thumbnail_url TEXT,
  duracao_ms BIGINT,
  drive_modified_time TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_videos_track_active
  ON cortex_core.internal_videos(track_id, is_active);

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_completions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR NOT NULL REFERENCES cortex_core.internal_videos(id) ON DELETE CASCADE,
  user_email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_completion_user_video UNIQUE (video_id, user_email)
);

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_likes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR NOT NULL REFERENCES cortex_core.internal_videos(id) ON DELETE CASCADE,
  user_email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_like_user_video UNIQUE (video_id, user_email)
);

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR NOT NULL REFERENCES cortex_core.internal_videos(id) ON DELETE CASCADE,
  user_email VARCHAR(100) NOT NULL,
  user_nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_comments_video_created
  ON cortex_core.internal_video_comments(video_id, created_at DESC);
```

- [ ] **Step 2: Aplicar migration no banco local**

Run:
```bash
psql "$DATABASE_URL_LOCAL" -f migrations/2026-04-29-internal-trainings.sql
```
Expected: `CREATE TABLE` x5, `CREATE INDEX` x2 (sem erros).

Se variável de ambiente do banco local for diferente, usar `cat migrations/2026-04-29-internal-trainings.sql | psql -h localhost -U <user> -d cortex_dev`.

- [ ] **Step 3: Aplicar migration no banco de produção**

Run (substituindo credenciais conforme `reference_databases.md` na memory do projeto):
```bash
psql "postgresql://<USER>:<PASS>@34.95.249.110:5432/dados_turbo" -f migrations/2026-04-29-internal-trainings.sql
```
Expected: mesmo output local.

- [ ] **Step 4: Adicionar definições Drizzle em `shared/schema.ts`**

Localizar o final do arquivo (logo após o último `pgTable` definido, perto da linha do export final ou de outro separador `// ===`). Adicionar bloco abaixo. Importar `bigint, boolean, unique` do `drizzle-orm/pg-core` se ainda não estiverem importados (verificar imports no topo do arquivo e ajustar):

```ts
// ============================================
// Treinamento Interno Module
// ============================================

export const internalVideoTracks = pgTable("internal_video_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driveFolderId: text("drive_folder_id").notNull().unique(),
  nome: text("nome").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const internalVideos = pgTable("internal_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackId: varchar("track_id").notNull().references(() => internalVideoTracks.id),
  driveFileId: text("drive_file_id").notNull().unique(),
  nome: text("nome").notNull(),
  mimeType: text("mime_type"),
  thumbnailUrl: text("thumbnail_url"),
  duracaoMs: bigint("duracao_ms", { mode: "number" }),
  driveModifiedTime: timestamp("drive_modified_time"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const internalVideoCompletions = pgTable("internal_video_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => internalVideos.id, { onDelete: "cascade" }),
  userEmail: varchar("user_email", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueUserVideo: unique("uq_completion_user_video").on(t.videoId, t.userEmail),
}));

export const internalVideoLikes = pgTable("internal_video_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => internalVideos.id, { onDelete: "cascade" }),
  userEmail: varchar("user_email", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueUserVideo: unique("uq_like_user_video").on(t.videoId, t.userEmail),
}));

export const internalVideoComments = pgTable("internal_video_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => internalVideos.id, { onDelete: "cascade" }),
  userEmail: varchar("user_email", { length: 100 }).notNull(),
  userNome: text("user_nome").notNull(),
  conteudo: text("conteudo").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InternalVideoTrack = typeof internalVideoTracks.$inferSelect;
export type InternalVideo = typeof internalVideos.$inferSelect;
export type InternalVideoCompletion = typeof internalVideoCompletions.$inferSelect;
export type InternalVideoLike = typeof internalVideoLikes.$inferSelect;
export type InternalVideoComment = typeof internalVideoComments.$inferSelect;
```

- [ ] **Step 5: Verificar typecheck**

Run: `npm run check`
Expected: PASS sem erros relacionados a `internalVideo*` ou `shared/schema.ts`.

Se faltar import (ex: `bigint`, `boolean`, `unique`), adicionar no topo do `shared/schema.ts`:
```ts
import { ..., bigint, boolean, unique, ... } from "drizzle-orm/pg-core";
```

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-04-29-internal-trainings.sql shared/schema.ts
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): adicionar schema e migration de 5 tabelas

Schema cortex_core ganha tabelas para sync com Drive (tracks, videos),
progresso (completions), likes e comentários. Migration aplicada local
e em produção.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sync service (com testes)

**Files:**
- Create: `server/services/internalTrainingsSync.ts`
- Test: `server/services/internalTrainingsSync.test.ts`

- [ ] **Step 1: Criar arquivo de testes com cenário básico (que vai falhar)**

Criar `server/services/internalTrainingsSync.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de googleapis
const mockFilesList = vi.fn();
vi.mock('../autoreport/credentials', () => ({
  getDriveClient: () => ({
    files: { list: (...args: any[]) => mockFilesList(...args) },
  }),
}));

// Mock do db
const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import { syncInternalTrainings, _resetSyncLockForTest } from './internalTrainingsSync';

describe('syncInternalTrainings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_TRAININGS_DRIVE_FOLDER_ID = 'root-folder-id';
    _resetSyncLockForTest();

    // db.execute padrão: retorna { rows: [] }
    mockExecute.mockResolvedValue({ rows: [] });
  });

  it('lista subpastas e vídeos, fazendo upsert nas trilhas e vídeos', async () => {
    // 1ª chamada: listar subpastas de TREINAMENTOS
    mockFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'folder-perf', name: 'Performance' },
          { id: 'folder-ia', name: 'IA' },
        ],
      },
    });
    // 2ª chamada: vídeos de Performance
    mockFilesList.mockResolvedValueOnce({
      data: {
        files: [
          {
            id: 'vid-1',
            name: 'Aula 1.mp4',
            mimeType: 'video/mp4',
            videoMediaMetadata: { durationMillis: '600000' },
            modifiedTime: '2026-04-25T10:00:00Z',
          },
        ],
      },
    });
    // 3ª chamada: vídeos de IA (vazio)
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });

    const report = await syncInternalTrainings();

    expect(report.ok).toBe(true);
    expect(report.trilhasAtivas).toBe(2);
    expect(report.videosAtivos).toBe(1);
    // db.execute foi chamado para upserts e reconciliação
    expect(mockExecute).toHaveBeenCalled();
  });

  it('ignora arquivos com mimeType que não começa com video/', async () => {
    mockFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'folder-perf', name: 'Performance' }] },
    });
    mockFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'vid-1', name: 'aula.mp4', mimeType: 'video/mp4' },
          { id: 'pdf-1', name: 'apostila.pdf', mimeType: 'application/pdf' },
        ],
      },
    });

    const report = await syncInternalTrainings();

    // Filtragem deve acontecer no lado do query 'mimeType contains video/' OU
    // como segurança extra no código. Aqui validamos pelo query enviado.
    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("mimeType contains 'video/'"),
      })
    );
    expect(report.videosAtivos).toBe(2); // mock retornou 2 já filtrados pelo Drive
  });

  it('continua processando outras trilhas quando uma falha', async () => {
    mockFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'folder-perf', name: 'Performance' },
          { id: 'folder-ia', name: 'IA' },
        ],
      },
    });
    // Performance falha
    mockFilesList.mockRejectedValueOnce(new Error('Quota exceeded'));
    // IA sucede
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });

    const report = await syncInternalTrainings();

    expect(report.ok).toBe(true);
    expect(report.erros).toHaveLength(1);
    expect(report.erros[0].contexto).toContain('Performance');
  });

  it('retorna alreadyRunning se sync já está em andamento', async () => {
    // Primeira chamada nunca resolve (mantém lock)
    mockFilesList.mockReturnValueOnce(new Promise(() => {}));
    const inflight = syncInternalTrainings();

    const second = await syncInternalTrainings();

    expect(second.ok).toBe(true);
    expect(second.alreadyRunning).toBe(true);
    // Não consumimos o inflight para o teste não esperar para sempre
    void inflight;
  });

  it('falha cedo se INTERNAL_TRAININGS_DRIVE_FOLDER_ID não estiver setada', async () => {
    delete process.env.INTERNAL_TRAININGS_DRIVE_FOLDER_ID;

    const report = await syncInternalTrainings();

    expect(report.ok).toBe(false);
    expect(report.erros[0].mensagem).toMatch(/INTERNAL_TRAININGS_DRIVE_FOLDER_ID/);
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

Run: `npm test -- internalTrainingsSync`
Expected: 5 testes falhando com `Cannot find module './internalTrainingsSync'` ou similar.

- [ ] **Step 3: Implementar `internalTrainingsSync.ts`**

Criar `server/services/internalTrainingsSync.ts`:

```ts
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
  let trilhasAtivas = 0;
  let videosAtivos = 0;

  try {
    const drive = getDriveClient();

    // 1. Listar subpastas
    const foldersResp = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1000,
    });
    const folders = foldersResp.data.files || [];

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
          });
          const files = filesResp.data.files || [];

          for (const file of files) {
            if (!file.id || !file.name) continue;
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
        erros.push({ contexto: `trilha "${folder.name}"`, mensagem: e.message || String(e) });
      }
    }

    // 3. Reconciliação (soft-delete)
    const allTracksResult = await db.execute(sql`
      SELECT id, drive_folder_id FROM cortex_core.internal_video_tracks WHERE is_active = TRUE
    `);
    const tracksToDeactivate = (allTracksResult.rows as Array<{ id: string; drive_folder_id: string }>)
      .filter((t) => !seenFolderIds.has(t.drive_folder_id))
      .map((t) => t.id);

    let trilhasDesativadas = 0;
    if (tracksToDeactivate.length > 0) {
      await db.execute(sql`
        UPDATE cortex_core.internal_video_tracks
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = ANY(${tracksToDeactivate})
      `);
      trilhasDesativadas = tracksToDeactivate.length;
    }

    const allVideosResult = await db.execute(sql`
      SELECT id, drive_file_id FROM cortex_core.internal_videos WHERE is_active = TRUE
    `);
    const videosToDeactivate = (allVideosResult.rows as Array<{ id: string; drive_file_id: string }>)
      .filter((v) => !seenFileIds.has(v.drive_file_id))
      .map((v) => v.id);

    let videosDesativados = 0;
    if (videosToDeactivate.length > 0) {
      await db.execute(sql`
        UPDATE cortex_core.internal_videos
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = ANY(${videosToDeactivate})
      `);
      videosDesativados = videosToDeactivate.length;
    }

    return { ok: true, trilhasAtivas, videosAtivos, trilhasDesativadas, videosDesativados, erros };
  } catch (e: any) {
    erros.push({ contexto: 'sync raiz', mensagem: e.message || String(e) });
    return { ok: false, trilhasAtivas, videosAtivos, trilhasDesativadas: 0, videosDesativados: 0, erros };
  } finally {
    isSyncing = false;
  }
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `npm test -- internalTrainingsSync`
Expected: 5 PASS.

Se algum teste falhar, ajustar implementação até passar (não ajustar testes para acomodar bug).

- [ ] **Step 5: Commit**

```bash
git add server/services/internalTrainingsSync.ts server/services/internalTrainingsSync.test.ts
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): adicionar serviço de sync com Google Drive

Sync lê pasta raiz TREINAMENTOS, percorre subpastas (trilhas) e seus
vídeos, faz upsert nas tabelas. Reconciliação por soft-delete preserva
comentários/likes. Lock em memória previne sync paralelo. Erros por
trilha não interrompem outras trilhas.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Endpoints REST de leitura

**Files:**
- Create: `server/routes/internalTrainings.ts`
- Test: `server/routes/internalTrainings.test.ts`
- Modify: `server/routes.ts` (registrar via `registerInternalTrainingsRoutes`)

- [ ] **Step 1: Criar arquivo de rotas com endpoints de leitura**

Criar `server/routes/internalTrainings.ts`:

```ts
import type { Express, Request } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

function getUserEmail(req: Request): string | null {
  const user = (req as any).user;
  return user?.email || null;
}

function getUserNome(req: Request): string {
  const user = (req as any).user;
  if (user?.name) return user.name;
  if (user?.email) return user.email.split('@')[0];
  return 'Usuário';
}

export function registerInternalTrainingsRoutes(app: Express) {
  // GET /api/treinamentos-internos/trilhas
  app.get('/api/treinamentos-internos/trilhas', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const result = await db.execute(sql`
        SELECT
          t.id,
          t.nome,
          COALESCE(v.total_videos, 0)::int AS "totalVideos",
          COALESCE(c.videos_concluidos, 0)::int AS "videosConcluidos",
          v.ultimo_modificado_em AS "ultimoVideoModificadoEm"
        FROM cortex_core.internal_video_tracks t
        LEFT JOIN (
          SELECT track_id,
                 COUNT(*) AS total_videos,
                 MAX(drive_modified_time) AS ultimo_modificado_em
          FROM cortex_core.internal_videos
          WHERE is_active = TRUE
          GROUP BY track_id
        ) v ON v.track_id = t.id
        LEFT JOIN (
          SELECT iv.track_id, COUNT(*) AS videos_concluidos
          FROM cortex_core.internal_video_completions ic
          JOIN cortex_core.internal_videos iv ON iv.id = ic.video_id
          WHERE ic.user_email = ${userEmail} AND iv.is_active = TRUE
          GROUP BY iv.track_id
        ) c ON c.track_id = t.id
        WHERE t.is_active = TRUE
        ORDER BY t.nome
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error('[treinamentos-internos] GET /trilhas error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/treinamentos-internos/videos?trackId=:id
  app.get('/api/treinamentos-internos/videos', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { trackId } = req.query;
      if (!trackId || typeof trackId !== 'string') {
        return res.status(400).json({ error: 'trackId é obrigatório' });
      }

      const result = await db.execute(sql`
        SELECT
          v.id,
          v.nome,
          v.drive_file_id AS "driveFileId",
          v.thumbnail_url AS "thumbnailUrl",
          v.duracao_ms AS "duracaoMs",
          v.drive_modified_time AS "driveModifiedTime",
          (c.id IS NOT NULL) AS "userConcluiu",
          (l.id IS NOT NULL) AS "userCurtiu",
          (SELECT COUNT(*)::int FROM cortex_core.internal_video_likes WHERE video_id = v.id) AS "totalLikes",
          (SELECT COUNT(*)::int FROM cortex_core.internal_video_comments WHERE video_id = v.id) AS "totalComentarios"
        FROM cortex_core.internal_videos v
        LEFT JOIN cortex_core.internal_video_completions c
          ON c.video_id = v.id AND c.user_email = ${userEmail}
        LEFT JOIN cortex_core.internal_video_likes l
          ON l.video_id = v.id AND l.user_email = ${userEmail}
        WHERE v.track_id = ${trackId} AND v.is_active = TRUE
        ORDER BY v.nome
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error('[treinamentos-internos] GET /videos error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/treinamentos-internos/videos/:id
  app.get('/api/treinamentos-internos/videos/:id', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const videoResult = await db.execute(sql`
        SELECT
          v.id,
          v.nome,
          v.drive_file_id AS "driveFileId",
          v.thumbnail_url AS "thumbnailUrl",
          v.duracao_ms AS "duracaoMs",
          v.drive_modified_time AS "driveModifiedTime",
          v.track_id AS "trackId",
          t.nome AS "trackNome"
        FROM cortex_core.internal_videos v
        JOIN cortex_core.internal_video_tracks t ON t.id = v.track_id
        WHERE v.id = ${id} AND v.is_active = TRUE
      `);

      if (videoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vídeo não encontrado' });
      }

      const row = videoResult.rows[0] as any;

      const [concluiuResult, curtiuResult, likesResult, comentariosResult] = await Promise.all([
        db.execute(sql`
          SELECT 1 FROM cortex_core.internal_video_completions
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `),
        db.execute(sql`
          SELECT 1 FROM cortex_core.internal_video_likes
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `),
        db.execute(sql`
          SELECT COUNT(*)::int AS total FROM cortex_core.internal_video_likes
          WHERE video_id = ${id}
        `),
        db.execute(sql`
          SELECT id, user_email AS "userEmail", user_nome AS "userNome",
                 conteudo, created_at AS "createdAt"
          FROM cortex_core.internal_video_comments
          WHERE video_id = ${id}
          ORDER BY created_at DESC
          LIMIT 100
        `),
      ]);

      res.json({
        video: {
          id: row.id,
          nome: row.nome,
          driveFileId: row.driveFileId,
          thumbnailUrl: row.thumbnailUrl,
          duracaoMs: row.duracaoMs,
          driveModifiedTime: row.driveModifiedTime,
        },
        trilha: { id: row.trackId, nome: row.trackNome },
        userConcluiu: concluiuResult.rows.length > 0,
        userCurtiu: curtiuResult.rows.length > 0,
        totalLikes: (likesResult.rows[0] as any).total,
        comentarios: (comentariosResult.rows as any[]).map((c) => ({
          ...c,
          isOwner: c.userEmail === userEmail,
        })),
      });
    } catch (error: any) {
      console.error('[treinamentos-internos] GET /videos/:id error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
```

- [ ] **Step 2: Registrar rotas em `server/routes.ts`**

Em `server/routes.ts`, próximo aos outros `import { register*Routes }` (linhas ~21-30), adicionar:

```ts
import { registerInternalTrainingsRoutes } from "./routes/internalTrainings";
```

Depois encontrar onde outras rotas são registradas (procurar por `registerFavoritesRoutes(app)` ou similar — devem estar logo após `app.use("/api", isAuthenticated)`). Adicionar:

```ts
registerInternalTrainingsRoutes(app);
```

**ATENÇÃO:** colocar **depois** de `app.use("/api", isAuthenticated)` para que os endpoints fiquem protegidos.

- [ ] **Step 3: Reiniciar dev server e testar manualmente**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Esperar boot completar (mensagem `[express] serving on port 3000` ou similar).

Em outro terminal, autenticar via browser e pegar cookie de sessão. Ou usar `curl` com cookie. Validar:
```bash
# Substituir COOKIE pelo valor do cookie de sessão real
curl -s 'http://localhost:3000/api/treinamentos-internos/trilhas' \
  -H "Cookie: connect.sid=COOKIE" | jq .
```
Expected: `[]` (array vazio — banco ainda sem dados).

Se retornar 401, ajustar autenticação. Se retornar 500, conferir logs.

- [ ] **Step 4: Criar arquivo de testes para os endpoints de leitura**

Criar `server/routes/internalTrainings.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import { registerInternalTrainingsRoutes } from './internalTrainings';

function buildApp(userEmail = 'warley@cortex.com', userName = 'Warley Pablo') {
  const app = express();
  app.use(express.json());
  // Middleware fake de auth
  app.use((req, _res, next) => {
    (req as any).user = { email: userEmail, name: userName };
    next();
  });
  registerInternalTrainingsRoutes(app);
  return app;
}

describe('GET /api/treinamentos-internos/trilhas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista agregada de trilhas com progresso do usuário', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 'tr-1', nome: 'Performance', totalVideos: 12, videosConcluidos: 4, ultimoVideoModificadoEm: null },
      ],
    });

    const res = await request(buildApp()).get('/api/treinamentos-internos/trilhas');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].videosConcluidos).toBe(4);
  });
});

describe('GET /api/treinamentos-internos/videos/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 404 para vídeo inativo (is_active = false)', async () => {
    // Query do vídeo retorna vazio porque WHERE is_active = TRUE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).get('/api/treinamentos-internos/videos/abc-123');

    expect(res.status).toBe(404);
  });

  it('marca isOwner=true em comentários do próprio usuário', async () => {
    // Vídeo
    mockExecute.mockResolvedValueOnce({
      rows: [{
        id: 'vid-1', nome: 'Aula 1', driveFileId: '1abc', thumbnailUrl: '...',
        duracaoMs: 600000, driveModifiedTime: null, trackId: 'tr-1', trackNome: 'Performance',
      }],
    });
    // Promise.all: concluiu, curtiu, likes, comentários
    mockExecute.mockResolvedValueOnce({ rows: [] });
    mockExecute.mockResolvedValueOnce({ rows: [] });
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 'c1', userEmail: 'warley@cortex.com', userNome: 'Warley', conteudo: 'meu', createdAt: '2026-04-29T12:00:00Z' },
        { id: 'c2', userEmail: 'outro@cortex.com', userNome: 'Outro', conteudo: 'alheio', createdAt: '2026-04-29T11:00:00Z' },
      ],
    });

    const res = await request(buildApp('warley@cortex.com')).get('/api/treinamentos-internos/videos/vid-1');

    expect(res.status).toBe(200);
    expect(res.body.comentarios[0].isOwner).toBe(true);
    expect(res.body.comentarios[1].isOwner).toBe(false);
  });
});
```

- [ ] **Step 5: Verificar se `supertest` está instalado**

Run: `npm ls supertest`
Expected: lista a versão instalada.

Se não estiver: `npm install --save-dev supertest @types/supertest`. Adicionar como dependência de dev.

- [ ] **Step 6: Rodar testes**

Run: `npm test -- internalTrainings`
Expected: testes existentes (`internalTrainingsSync`) e novos (`internalTrainings`) PASS.

- [ ] **Step 7: Commit**

```bash
git add server/routes/internalTrainings.ts server/routes/internalTrainings.test.ts server/routes.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): endpoints REST de leitura (trilhas, videos)

GET /trilhas com agregação de progresso do usuário, GET /videos por
trilha (lazy load), GET /videos/:id com comentários e flags
isOwner/userConcluiu/userCurtiu. Soft-deleted retorna 404.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Endpoints de toggle (concluir, like)

**Files:**
- Modify: `server/routes/internalTrainings.ts` (adicionar 2 endpoints)
- Modify: `server/routes/internalTrainings.test.ts` (adicionar testes)

- [ ] **Step 1: Adicionar testes para toggle**

Em `server/routes/internalTrainings.test.ts`, adicionar dentro do mesmo arquivo:

```ts
describe('POST /api/treinamentos-internos/videos/:id/concluir', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria registro de conclusão na primeira chamada', async () => {
    // SELECT 1 FROM completions: vazio → vai inserir
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // INSERT
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'comp-1' }] });

    const res = await request(buildApp()).post('/api/treinamentos-internos/videos/vid-1/concluir');

    expect(res.status).toBe(200);
    expect(res.body.concluido).toBe(true);
  });

  it('deleta registro na segunda chamada (toggle off)', async () => {
    // SELECT 1: já existe
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'comp-1' }] });
    // DELETE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).post('/api/treinamentos-internos/videos/vid-1/concluir');

    expect(res.status).toBe(200);
    expect(res.body.concluido).toBe(false);
  });
});

describe('POST /api/treinamentos-internos/videos/:id/like', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggle like e retorna totalLikes', async () => {
    // SELECT 1: vazio → insere
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // INSERT
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'l-1' }] });
    // SELECT count
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 7 }] });

    const res = await request(buildApp()).post('/api/treinamentos-internos/videos/vid-1/like');

    expect(res.status).toBe(200);
    expect(res.body.curtiu).toBe(true);
    expect(res.body.totalLikes).toBe(7);
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

Run: `npm test -- internalTrainings`
Expected: 3 testes novos (concluir x2 + like) FAIL com 404.

- [ ] **Step 3: Implementar endpoints toggle em `server/routes/internalTrainings.ts`**

No fim de `registerInternalTrainingsRoutes`, antes do `}` final, adicionar:

```ts
  // POST /api/treinamentos-internos/videos/:id/concluir (toggle)
  app.post('/api/treinamentos-internos/videos/:id/concluir', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const existsResult = await db.execute(sql`
        SELECT id FROM cortex_core.internal_video_completions
        WHERE video_id = ${id} AND user_email = ${userEmail}
      `);

      if (existsResult.rows.length > 0) {
        await db.execute(sql`
          DELETE FROM cortex_core.internal_video_completions
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `);
        return res.json({ concluido: false });
      }

      await db.execute(sql`
        INSERT INTO cortex_core.internal_video_completions (video_id, user_email)
        VALUES (${id}, ${userEmail})
      `);
      res.json({ concluido: true });
    } catch (error: any) {
      console.error('[treinamentos-internos] POST /concluir error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/treinamentos-internos/videos/:id/like (toggle)
  app.post('/api/treinamentos-internos/videos/:id/like', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const existsResult = await db.execute(sql`
        SELECT id FROM cortex_core.internal_video_likes
        WHERE video_id = ${id} AND user_email = ${userEmail}
      `);

      let curtiu: boolean;
      if (existsResult.rows.length > 0) {
        await db.execute(sql`
          DELETE FROM cortex_core.internal_video_likes
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `);
        curtiu = false;
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.internal_video_likes (video_id, user_email)
          VALUES (${id}, ${userEmail})
        `);
        curtiu = true;
      }

      const totalResult = await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM cortex_core.internal_video_likes
        WHERE video_id = ${id}
      `);

      res.json({ curtiu, totalLikes: (totalResult.rows[0] as any).total });
    } catch (error: any) {
      console.error('[treinamentos-internos] POST /like error:', error);
      res.status(500).json({ error: error.message });
    }
  });
```

- [ ] **Step 4: Rodar testes**

Run: `npm test -- internalTrainings`
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add server/routes/internalTrainings.ts server/routes/internalTrainings.test.ts
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): endpoints toggle de conclusão e like

POST /videos/:id/concluir e POST /videos/:id/like com semântica de
toggle (cria registro na primeira chamada, deleta na segunda).
Endpoint de like também retorna o totalLikes atualizado.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Endpoints de comentários (POST + DELETE com autorização)

**Files:**
- Modify: `server/routes/internalTrainings.ts`
- Modify: `server/routes/internalTrainings.test.ts`

- [ ] **Step 1: Adicionar testes**

Em `server/routes/internalTrainings.test.ts`, adicionar:

```ts
describe('POST /api/treinamentos-internos/videos/:id/comentarios', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria comentário com userNome do auth', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        id: 'c-1',
        userEmail: 'warley@cortex.com',
        userNome: 'Warley Pablo',
        conteudo: 'massa demais',
        createdAt: '2026-04-29T12:00:00Z',
      }],
    });

    const res = await request(buildApp('warley@cortex.com', 'Warley Pablo'))
      .post('/api/treinamentos-internos/videos/vid-1/comentarios')
      .send({ conteudo: 'massa demais' });

    expect(res.status).toBe(201);
    expect(res.body.userNome).toBe('Warley Pablo');
    expect(res.body.isOwner).toBe(true);
  });

  it('rejeita conteúdo vazio', async () => {
    const res = await request(buildApp())
      .post('/api/treinamentos-internos/videos/vid-1/comentarios')
      .send({ conteudo: '' });

    expect(res.status).toBe(400);
  });

  it('rejeita conteúdo > 5000 chars', async () => {
    const res = await request(buildApp())
      .post('/api/treinamentos-internos/videos/vid-1/comentarios')
      .send({ conteudo: 'x'.repeat(5001) });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/treinamentos-internos/comentarios/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('apaga comentário do próprio usuário', async () => {
    // SELECT do comentário: userEmail bate
    mockExecute.mockResolvedValueOnce({
      rows: [{ user_email: 'warley@cortex.com' }],
    });
    // DELETE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp('warley@cortex.com')).delete('/api/treinamentos-internos/comentarios/c-1');

    expect(res.status).toBe(200);
  });

  it('retorna 403 ao tentar apagar comentário de outro', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ user_email: 'outro@cortex.com' }],
    });

    const res = await request(buildApp('warley@cortex.com')).delete('/api/treinamentos-internos/comentarios/c-1');

    expect(res.status).toBe(403);
  });

  it('retorna 404 se comentário não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).delete('/api/treinamentos-internos/comentarios/inexistente');

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar falha**

Run: `npm test -- internalTrainings`
Expected: testes novos FAIL.

- [ ] **Step 3: Implementar endpoints**

No fim de `registerInternalTrainingsRoutes` em `server/routes/internalTrainings.ts`, antes do `}` final, adicionar:

```ts
  // POST /api/treinamentos-internos/videos/:id/comentarios
  app.post('/api/treinamentos-internos/videos/:id/comentarios', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const userNome = getUserNome(req);
      const { id } = req.params;
      const { conteudo } = req.body || {};

      if (!conteudo || typeof conteudo !== 'string' || conteudo.trim().length === 0) {
        return res.status(400).json({ error: 'Conteúdo obrigatório' });
      }
      if (conteudo.length > 5000) {
        return res.status(400).json({ error: 'Conteúdo excede 5000 caracteres' });
      }

      const result = await db.execute(sql`
        INSERT INTO cortex_core.internal_video_comments (video_id, user_email, user_nome, conteudo)
        VALUES (${id}, ${userEmail}, ${userNome}, ${conteudo})
        RETURNING id, user_email AS "userEmail", user_nome AS "userNome",
                  conteudo, created_at AS "createdAt"
      `);

      const row = result.rows[0] as any;
      res.status(201).json({ ...row, isOwner: true });
    } catch (error: any) {
      console.error('[treinamentos-internos] POST /comentarios error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/treinamentos-internos/comentarios/:id
  app.delete('/api/treinamentos-internos/comentarios/:id', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const existsResult = await db.execute(sql`
        SELECT user_email FROM cortex_core.internal_video_comments WHERE id = ${id}
      `);

      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Comentário não encontrado' });
      }

      const ownerEmail = (existsResult.rows[0] as any).user_email;
      if (ownerEmail !== userEmail) {
        return res.status(403).json({ error: 'Sem permissão para apagar comentário de outro usuário' });
      }

      await db.execute(sql`
        DELETE FROM cortex_core.internal_video_comments WHERE id = ${id}
      `);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[treinamentos-internos] DELETE /comentarios error:', error);
      res.status(500).json({ error: error.message });
    }
  });
```

- [ ] **Step 4: Rodar testes**

Run: `npm test -- internalTrainings`
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add server/routes/internalTrainings.ts server/routes/internalTrainings.test.ts
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): endpoints de comentários (POST/DELETE)

POST /videos/:id/comentarios cria comentário (validação Zod inline para
conteúdo vazio ou >5000 chars). DELETE /comentarios/:id valida que
userEmail bate com o dono — 403 para outros, 404 se não existe.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Endpoint de sync manual + cron a cada 1h

**Files:**
- Modify: `server/routes/internalTrainings.ts` (adicionar `POST /sync`)
- Modify: `server/index.ts` (adicionar setInterval)

- [ ] **Step 1: Adicionar endpoint `POST /sync` em `server/routes/internalTrainings.ts`**

No topo do arquivo, adicionar import:

```ts
import { syncInternalTrainings } from '../services/internalTrainingsSync';
```

Dentro de `registerInternalTrainingsRoutes`, adicionar:

```ts
  // POST /api/treinamentos-internos/sync (manual trigger)
  app.post('/api/treinamentos-internos/sync', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const report = await syncInternalTrainings();
      res.json(report);
    } catch (error: any) {
      console.error('[treinamentos-internos] POST /sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });
```

- [ ] **Step 2: Adicionar cron em `server/index.ts`**

Localizar o bloco onde outros `setInterval` estão registrados (procurar `META_SYNC_INTERVAL` ou `IG_SYNC_INTERVAL` — linhas ~250-540). Adicionar bloco análogo, perto dos outros cron jobs:

```ts
  // Internal Trainings auto-sync a cada 1 hora
  const INTERNAL_TRAININGS_SYNC_INTERVAL = 60 * 60 * 1000; // 1h
  const runInternalTrainingsSync = async () => {
    try {
      console.log("[internal-trainings-sync-job] Starting scheduled sync...");
      const { syncInternalTrainings } = await import('./services/internalTrainingsSync');
      const report = await syncInternalTrainings();
      console.log(
        `[internal-trainings-sync-job] Done: ${report.trilhasAtivas} trilhas, ` +
        `${report.videosAtivos} vídeos, ${report.erros.length} erros`
      );
      (globalThis as any).__internalTrainingsSyncStatus = {
        lastSync: new Date().toISOString(),
        report,
      };
    } catch (err: any) {
      console.error("[internal-trainings-sync-job] Failed:", err.message);
      (globalThis as any).__internalTrainingsSyncStatus = {
        lastSync: new Date().toISOString(),
        status: "error",
        error: err.message,
      };
    }
  };
  // Primeira execução 60s após startup, depois a cada 1h
  setTimeout(() => runInternalTrainingsSync(), 60000);
  setInterval(() => runInternalTrainingsSync(), INTERNAL_TRAININGS_SYNC_INTERVAL);
  console.log(`[internal-trainings-sync-job] Scheduled every ${INTERNAL_TRAININGS_SYNC_INTERVAL / 60000} min`);
```

- [ ] **Step 3: Reiniciar dev server e validar logs**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Esperar boot e procurar nos logs:
- `[internal-trainings-sync-job] Scheduled every 60 min`
- 60 segundos depois: `[internal-trainings-sync-job] Starting scheduled sync...`

Se `INTERNAL_TRAININGS_DRIVE_FOLDER_ID` não estiver definido no `.env`, o sync vai retornar `{ ok: false, ... }` — esperado por ora.

- [ ] **Step 4: Commit**

```bash
git add server/routes/internalTrainings.ts server/index.ts
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): endpoint manual de sync e cron de 1h

POST /api/treinamentos-internos/sync dispara sync sob demanda. Cron em
server/index.ts roda a cada 1 hora (primeira execução 60s após boot).
Status do último sync exposto em globalThis.__internalTrainingsSyncStatus.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend — themes + VideoPlayer

**Files:**
- Create: `client/src/components/treinamento-interno/trackThemes.ts`
- Create: `client/src/components/treinamento-interno/VideoPlayer.tsx`

- [ ] **Step 1: Criar `trackThemes.ts`**

Criar `client/src/components/treinamento-interno/trackThemes.ts`:

```ts
import {
  TrendingUp, Sparkles, Cpu, Headphones, Palette,
  Briefcase, PhoneCall, Hash, Camera, Folder,
  type LucideIcon,
} from 'lucide-react';

export type TrackTheme = {
  color: string;          // gradient classes (Tailwind)
  bgIcon: string;         // background da pílula do ícone
  textIcon: string;       // cor do ícone
  icon: LucideIcon;
};

export const TRACK_THEMES: Record<string, TrackTheme> = {
  'Performance':  { color: 'from-orange-500 to-amber-400', bgIcon: 'bg-orange-500/20', textIcon: 'text-orange-600 dark:text-orange-400', icon: TrendingUp },
  'IA':           { color: 'from-purple-500 to-violet-400', bgIcon: 'bg-purple-500/20', textIcon: 'text-purple-600 dark:text-purple-400', icon: Sparkles },
  'Tech':         { color: 'from-blue-500 to-cyan-400',     bgIcon: 'bg-blue-500/20',   textIcon: 'text-blue-600 dark:text-blue-400',   icon: Cpu },
  'CX/CS':        { color: 'from-emerald-500 to-green-400', bgIcon: 'bg-emerald-500/20',textIcon: 'text-emerald-600 dark:text-emerald-400', icon: Headphones },
  'Designer':     { color: 'from-pink-500 to-rose-400',     bgIcon: 'bg-pink-500/20',   textIcon: 'text-pink-600 dark:text-pink-400',   icon: Palette },
  'Comercial':    { color: 'from-indigo-500 to-blue-400',   bgIcon: 'bg-indigo-500/20', textIcon: 'text-indigo-600 dark:text-indigo-400', icon: Briefcase },
  'Pré-vendas':   { color: 'from-teal-500 to-cyan-400',     bgIcon: 'bg-teal-500/20',   textIcon: 'text-teal-600 dark:text-teal-400',   icon: PhoneCall },
  'Social media': { color: 'from-fuchsia-500 to-pink-400',  bgIcon: 'bg-fuchsia-500/20',textIcon: 'text-fuchsia-600 dark:text-fuchsia-400', icon: Hash },
  'Creators':     { color: 'from-amber-500 to-yellow-400',  bgIcon: 'bg-amber-500/20',  textIcon: 'text-amber-600 dark:text-amber-400', icon: Camera },
};

export const DEFAULT_TRACK_THEME: TrackTheme = {
  color: 'from-gray-500 to-slate-400',
  bgIcon: 'bg-gray-500/20',
  textIcon: 'text-gray-600 dark:text-gray-400',
  icon: Folder,
};

export function getTrackTheme(nome: string): TrackTheme {
  return TRACK_THEMES[nome] || DEFAULT_TRACK_THEME;
}
```

- [ ] **Step 2: Criar `VideoPlayer.tsx`**

Criar `client/src/components/treinamento-interno/VideoPlayer.tsx`:

```tsx
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPlayerProps {
  driveFileId: string;
  titulo: string;
}

export function VideoPlayer({ driveFileId, titulo }: VideoPlayerProps) {
  const driveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
  const embedUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;

  return (
    <div className="space-y-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700 bg-black">
        <iframe
          src={embedUrl}
          title={titulo}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="w-full h-full"
          data-testid="video-player-iframe"
        />
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-drive">
            <ExternalLink className="w-3 h-3 mr-1" />
            Abrir no Drive
          </a>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run check`
Expected: PASS sem erros nesses arquivos.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/treinamento-interno/
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): tema das trilhas e componente VideoPlayer

trackThemes.ts mapeia cor/ícone das 9 trilhas com fallback default.
VideoPlayer wrappa iframe Drive embed e expõe link "Abrir no Drive"
como fallback se permissão do iframe falhar.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend — comentários (item + thread)

**Files:**
- Create: `client/src/components/treinamento-interno/ComentarioItem.tsx`
- Create: `client/src/components/treinamento-interno/ComentariosThread.tsx`

- [ ] **Step 1: Criar `ComentarioItem.tsx`**

Criar `client/src/components/treinamento-interno/ComentarioItem.tsx`:

```tsx
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface Comentario {
  id: string;
  userEmail: string;
  userNome: string;
  conteudo: string;
  createdAt: string;
  isOwner: boolean;
}

interface ComentarioItemProps {
  comentario: Comentario;
  videoId: string;
}

// Linkifica URLs http(s) simples mantendo o resto como texto.
function renderConteudo(text: string) {
  const parts = text.split(/(\bhttps?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export function ComentarioItem({ comentario, videoId }: ComentarioItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/treinamentos-internos/comentarios/${comentario.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos', videoId] });
      setConfirmOpen(false);
      toast({ title: 'Comentário excluído' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    },
  });

  const inicial = (comentario.userNome || 'U').charAt(0).toUpperCase();
  const tempo = formatDistanceToNow(new Date(comentario.createdAt), { addSuffix: true, locale: ptBR });

  return (
    <div className="flex gap-3 py-3" data-testid={`comentario-${comentario.id}`}>
      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium shrink-0">
        {inicial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-medium">{comentario.userNome}</span>
            <span className="text-muted-foreground ml-2">{tempo}</span>
          </div>
          {comentario.isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              data-testid={`button-delete-comentario-${comentario.id}`}
              aria-label="Excluir comentário"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="text-sm mt-1 whitespace-pre-wrap break-words">
          {renderConteudo(comentario.conteudo)}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-comentario"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>
              ) : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Criar `ComentariosThread.tsx`**

Criar `client/src/components/treinamento-interno/ComentariosThread.tsx`:

```tsx
import { useState, type KeyboardEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ComentarioItem, type Comentario } from './ComentarioItem';

interface ComentariosThreadProps {
  videoId: string;
  comentarios: Comentario[];
}

const MAX_LEN = 5000;

export function ComentariosThread({ videoId, comentarios }: ComentariosThreadProps) {
  const [conteudo, setConteudo] = useState('');
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (texto: string) => {
      const res = await apiRequest('POST', `/api/treinamentos-internos/videos/${videoId}/comentarios`, { conteudo: texto });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos', videoId] });
      setConteudo('');
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao comentar', description: err.message, variant: 'destructive' });
    },
  });

  const submit = () => {
    const texto = conteudo.trim();
    if (!texto) return;
    if (texto.length > MAX_LEN) {
      toast({ title: `Limite de ${MAX_LEN} caracteres ultrapassado`, variant: 'destructive' });
      return;
    }
    createMutation.mutate(texto);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const restantes = MAX_LEN - conteudo.length;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">
        {comentarios.length === 0 ? 'Sem comentários ainda' : `${comentarios.length} comentário${comentarios.length === 1 ? '' : 's'}`}
      </h3>

      <div className="space-y-2">
        <Textarea
          placeholder="Escreva um comentário..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          maxLength={MAX_LEN}
          data-testid="textarea-comentario"
        />
        <div className="flex justify-between items-center">
          {conteudo.length > 4500 ? (
            <span className={`text-xs ${restantes < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {restantes} caracteres restantes
            </span>
          ) : <span />}
          <Button
            onClick={submit}
            disabled={!conteudo.trim() || createMutation.isPending}
            size="sm"
            data-testid="button-enviar-comentario"
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Comentar</>
            )}
          </Button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-zinc-700">
        {comentarios.map((c) => (
          <ComentarioItem key={c.id} comentario={c} videoId={videoId} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/treinamento-interno/
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): componentes de comentários (Item + Thread)

ComentarioItem renderiza um comentário com avatar (inicial), tempo
relativo em pt-BR, linkifica URLs, e expõe botão de excluir só para o
dono (com AlertDialog). ComentariosThread tem form com Enter para
enviar (Shift+Enter quebra linha), contador de caracteres e lista.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Frontend — VideoCard + TrilhaCard

**Files:**
- Create: `client/src/components/treinamento-interno/VideoCard.tsx`
- Create: `client/src/components/treinamento-interno/TrilhaCard.tsx`

- [ ] **Step 1: Criar `VideoCard.tsx`**

Criar `client/src/components/treinamento-interno/VideoCard.tsx`:

```tsx
import { Link } from 'wouter';
import { Check, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VideoSummary {
  id: string;
  nome: string;
  driveFileId: string;
  thumbnailUrl: string | null;
  duracaoMs: number | null;
  userConcluiu: boolean;
}

function formatarDuracao(ms: number | null): string {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface VideoCardProps {
  video: VideoSummary;
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Link
      href={`/conhecimentos/treinamentos/${video.id}`}
      data-testid={`video-card-${video.id}`}
      className={cn(
        'group flex gap-3 p-3 rounded-lg border border-transparent',
        'hover:border-gray-200 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50',
        'transition-colors cursor-pointer'
      )}
    >
      <div className="relative w-32 aspect-video shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-zinc-800">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.nome}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        {video.duracaoMs && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-xs bg-black/70 text-white rounded">
            {formatarDuracao(video.duracaoMs)}
          </span>
        )}
        {video.userConcluiu && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center">
            <Check className="w-3 h-3" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center">
        <div className="text-sm font-medium line-clamp-2 group-hover:text-primary">
          {video.nome}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Criar `TrilhaCard.tsx`**

Criar `client/src/components/treinamento-interno/TrilhaCard.tsx`:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getTrackTheme } from './trackThemes';
import { VideoCard, type VideoSummary } from './VideoCard';

export interface TrilhaSummary {
  id: string;
  nome: string;
  totalVideos: number;
  videosConcluidos: number;
  ultimoVideoModificadoEm: string | null;
}

interface TrilhaCardProps {
  trilha: TrilhaSummary;
  filtroBusca?: string;
}

export function TrilhaCard({ trilha, filtroBusca = '' }: TrilhaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = getTrackTheme(trilha.nome);
  const Icon = theme.icon;
  const pct = trilha.totalVideos > 0 ? (trilha.videosConcluidos / trilha.totalVideos) * 100 : 0;

  const { data: videos = [], isLoading } = useQuery<VideoSummary[]>({
    queryKey: ['/api/treinamentos-internos/videos', { trackId: trilha.id }],
    queryFn: async () => {
      const res = await fetch(`/api/treinamentos-internos/videos?trackId=${trilha.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar vídeos');
      return await res.json();
    },
    enabled: expanded,
  });

  const filtrados = filtroBusca
    ? videos.filter((v) => v.nome.toLowerCase().includes(filtroBusca.toLowerCase()))
    : videos;

  return (
    <Card className="overflow-hidden" data-testid={`trilha-card-${trilha.id}`}>
      <div className={`h-1 bg-gradient-to-r ${theme.color}`} />
      <CardHeader
        className="cursor-pointer hover-elevate pb-3"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`trilha-header-${trilha.id}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${theme.bgIcon}`}>
            <Icon className={`w-5 h-5 ${theme.textIcon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold truncate">{trilha.nome}</h3>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {trilha.videosConcluidos}/{trilha.totalVideos}
              </span>
            </div>
            <Progress value={pct} className="h-1.5 mt-2" />
          </div>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              {filtroBusca ? 'Nenhum vídeo bate com a busca.' : 'Nenhum vídeo nesta trilha ainda.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtrados.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/treinamento-interno/
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): VideoCard e TrilhaCard

VideoCard mostra thumbnail, duração formatada (mm:ss) e badge ✓ se
concluído. Click navega para a página do vídeo. TrilhaCard é
expansível com progresso visual, lazy-load dos vídeos ao expandir e
suporte a filtro de busca recebido via prop.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Frontend — TreinamentoInternoTab + 3ª aba em Conhecimentos

**Files:**
- Create: `client/src/components/treinamento-interno/TreinamentoInternoTab.tsx`
- Modify: `client/src/pages/Conhecimentos.tsx`

- [ ] **Step 1: Criar `TreinamentoInternoTab.tsx`**

Criar `client/src/components/treinamento-interno/TreinamentoInternoTab.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, RefreshCw, GraduationCap, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { TrilhaCard, type TrilhaSummary } from './TrilhaCard';

interface SyncReport {
  ok: boolean;
  trilhasAtivas: number;
  videosAtivos: number;
  trilhasDesativadas: number;
  videosDesativados: number;
  erros: Array<{ contexto: string; mensagem: string }>;
  alreadyRunning?: boolean;
}

export function TreinamentoInternoTab() {
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const { data: trilhas = [], isLoading } = useQuery<TrilhaSummary[]>({
    queryKey: ['/api/treinamentos-internos/trilhas'],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/treinamentos-internos/sync');
      return (await res.json()) as SyncReport;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/trilhas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos'] });
      if (report.alreadyRunning) {
        toast({ title: 'Sincronização já em andamento' });
      } else if (!report.ok) {
        toast({
          title: 'Falha na sincronização',
          description: report.erros[0]?.mensagem || 'Erro desconhecido',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sincronizado!',
          description: `${report.trilhasAtivas} trilhas, ${report.videosAtivos} vídeos`
            + (report.erros.length > 0 ? ` (${report.erros.length} erros parciais)` : ''),
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-trilhas">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vídeo..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            data-testid="input-buscar-treinamento"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-treinamentos"
        >
          {syncMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sincronizando...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" />Sincronizar agora</>
          )}
        </Button>
      </div>

      {trilhas.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-trilhas">
          <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Nenhuma trilha sincronizada ainda</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Sincronizar agora" para puxar os vídeos do Drive.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trilhas.map((t) => (
            <TrilhaCard key={t.id} trilha={t} filtroBusca={busca} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar 3ª aba em `client/src/pages/Conhecimentos.tsx`**

Localizar `<TabsList>` (perto da linha 1142). Atualizar para 3 colunas:

```tsx
<TabsList className="grid w-full sm:w-auto grid-cols-3 h-11">
  <TabsTrigger value="cursos" className="flex items-center gap-2 px-6" data-testid="tab-cursos">
    <GraduationCap className="w-4 h-4" />
    Cursos
  </TabsTrigger>
  <TabsTrigger value="beneficios" className="flex items-center gap-2 px-6" data-testid="tab-beneficios">
    <Gift className="w-4 h-4" />
    Benefícios
  </TabsTrigger>
  <TabsTrigger value="treinamento-interno" className="flex items-center gap-2 px-6" data-testid="tab-treinamento-interno">
    <PlayCircle className="w-4 h-4" />
    Treinamento Interno
  </TabsTrigger>
</TabsList>
```

Importar `PlayCircle` no topo do arquivo (junto com os outros ícones lucide):

```tsx
import { ..., PlayCircle } from "lucide-react";
```

Logo após `<TabsContent value="beneficios" className="mt-0">...</TabsContent>` (perto da linha 1491), adicionar:

```tsx
<TabsContent value="treinamento-interno" className="mt-0">
  <TreinamentoInternoTab />
</TabsContent>
```

E importar o componente no topo do arquivo:

```tsx
import { TreinamentoInternoTab } from "@/components/treinamento-interno/TreinamentoInternoTab";
```

- [ ] **Step 3: Reiniciar dev server e validar visualmente**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Abrir browser em `http://localhost:3000/conhecimentos`. Validar:
- 3 abas aparecem com ícones.
- Click em "Treinamento Interno" mostra estado vazio (banco sem dados).
- Botão "Sincronizar agora" presente.
- Layout funciona em **dark e light mode** (toggle via TopBar).

Se aparecer erro no console ou layout quebrado, corrigir antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/treinamento-interno/TreinamentoInternoTab.tsx client/src/pages/Conhecimentos.tsx
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): adicionar terceira aba em Conhecimentos

TreinamentoInternoTab combina busca, botão de sync manual e listagem
de trilhas. Conhecimentos.tsx agora tem 3 abas (Cursos, Benefícios,
Treinamento Interno) com ícones na TabsList.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Frontend — página do vídeo + rota

**Files:**
- Create: `client/src/pages/TreinamentoInternoVideo.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Criar `TreinamentoInternoVideo.tsx`**

Criar `client/src/pages/TreinamentoInternoVideo.tsx`:

```tsx
import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, Heart, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useSetPageInfo } from '@/contexts/PageContext';
import { usePageTitle } from '@/hooks/use-page-title';
import { VideoPlayer } from '@/components/treinamento-interno/VideoPlayer';
import { ComentariosThread } from '@/components/treinamento-interno/ComentariosThread';
import type { Comentario } from '@/components/treinamento-interno/ComentarioItem';

interface VideoDetail {
  video: {
    id: string;
    nome: string;
    driveFileId: string;
    thumbnailUrl: string | null;
    duracaoMs: number | null;
    driveModifiedTime: string | null;
  };
  trilha: { id: string; nome: string };
  userConcluiu: boolean;
  userCurtiu: boolean;
  totalLikes: number;
  comentarios: Comentario[];
}

function formatarDuracao(ms: number | null): string {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function TreinamentoInternoVideo() {
  const { videoId } = useParams<{ videoId: string }>();
  const { toast } = useToast();
  usePageTitle('Treinamento Interno');
  useSetPageInfo('Treinamento Interno', 'Vídeos internos da equipe');

  const { data, isLoading, error } = useQuery<VideoDetail>({
    queryKey: ['/api/treinamentos-internos/videos', videoId],
    queryFn: async () => {
      const res = await fetch(`/api/treinamentos-internos/videos/${videoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(res.status === 404 ? 'Vídeo não disponível' : 'Falha ao carregar vídeo');
      return await res.json();
    },
  });

  const concluirMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/treinamentos-internos/videos/${videoId}/concluir`);
      return (await res.json()) as { concluido: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos', videoId] });
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/trilhas'] });
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/treinamentos-internos/videos/${videoId}/like`);
      return (await res.json()) as { curtiu: boolean; totalLikes: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos', videoId] });
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-video">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Button variant="ghost" asChild>
          <Link href="/conhecimentos" data-testid="link-voltar">
            <ChevronLeft className="w-4 h-4 mr-1" />Voltar
          </Link>
        </Button>
        <div className="mt-12 text-center">
          <h2 className="text-xl font-semibold">Vídeo não disponível</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Este vídeo pode ter sido removido do Drive.
          </p>
        </div>
      </div>
    );
  }

  const { video, trilha, userConcluiu, userCurtiu, totalLikes, comentarios } = data;
  const modifiedDate = video.driveModifiedTime ? format(new Date(video.driveModifiedTime), "d 'de' MMM yyyy", { locale: ptBR }) : null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/conhecimentos" data-testid="link-voltar">
            <ChevronLeft className="w-4 h-4 mr-1" />Voltar para Treinamento Interno
          </Link>
        </Button>
        <div className="text-sm text-muted-foreground">
          <Link href="/conhecimentos" className="hover:text-primary">{trilha.nome}</Link>
          {' / '}
          <span className="text-foreground">{video.nome}</span>
        </div>
      </div>

      <VideoPlayer driveFileId={video.driveFileId} titulo={video.nome} />

      <div>
        <h1 className="text-2xl font-bold">{video.nome}</h1>
        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {video.duracaoMs && <span>{formatarDuracao(video.duracaoMs)}</span>}
          {modifiedDate && <span>· Atualizado em {modifiedDate}</span>}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant={userConcluiu ? 'default' : 'outline'}
            onClick={() => concluirMutation.mutate()}
            disabled={concluirMutation.isPending}
            data-testid="button-concluir"
          >
            <Check className={cn('w-4 h-4 mr-2', userConcluiu ? 'opacity-100' : 'opacity-50')} />
            {userConcluiu ? 'Concluído' : 'Marcar como concluído'}
          </Button>
          <Button
            variant={userCurtiu ? 'default' : 'outline'}
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
            data-testid="button-like"
          >
            <Heart className={cn('w-4 h-4 mr-2', userCurtiu && 'fill-current')} />
            {totalLikes} like{totalLikes === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      <hr className="border-gray-200 dark:border-zinc-700" />

      <ComentariosThread videoId={video.id} comentarios={comentarios} />
    </div>
  );
}
```

- [ ] **Step 2: Adicionar rota em `client/src/App.tsx`**

Após o lazyWithRetry de `Conhecimentos` (linha ~123), adicionar:

```tsx
const TreinamentoInternoVideo = lazyWithRetry(() => import("@/pages/TreinamentoInternoVideo"));
```

Após `<Route path="/conhecimentos">` (linha ~293), adicionar:

```tsx
<Route path="/conhecimentos/treinamentos/:videoId">
  {() => <ProtectedRoute path="/conhecimentos/treinamentos/:videoId" component={TreinamentoInternoVideo} />}
</Route>
```

**Atenção**: a rota nova precisa estar **antes** da rota mais genérica `/conhecimentos` se houver conflito. Verificar visualmente que `/conhecimentos/treinamentos/:videoId` aparece **logo abaixo** ou **antes** de `/conhecimentos`.

- [ ] **Step 3: Validar no browser**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

No browser:
- Sem dados ainda, navegação para `/conhecimentos/treinamentos/qualquer-id` deve mostrar "Vídeo não disponível".
- Voltar para `/conhecimentos`, botão Voltar funciona.
- Dark/light mode funcionam na nova página.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/TreinamentoInternoVideo.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(treinamento-interno): página do vídeo com player, ações e comentários

Rota /conhecimentos/treinamentos/:videoId. Mostra breadcrumb da
trilha, player embed, botões de Concluído (toggle) e Like (toggle com
contador) e thread de comentários abaixo. 404 vira tela amigável de
"vídeo não disponível".

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Pré-requisitos operacionais + smoke test E2E

Esta task **não é código**. É a checklist operacional que precisa ser feita por uma pessoa com acesso à conta Google da empresa e ao painel de produção, mais o smoke test final.

**Files:**
- Modify: `.env` local (manual)
- Modify: `.env` de produção (via painel de deploy)

- [ ] **Step 1: Pegar email da service account do Cortex**

Run:
```bash
node -e 'const fs=require("fs");const v=process.env.GOOGLE_SERVICE_ACCOUNT_JSON;const s=v.endsWith(".json")||v.startsWith("credentials/")?JSON.parse(fs.readFileSync(v,"utf-8")):JSON.parse(v);console.log(s.client_email)'
```
Expected: email no formato `xxx@yyy.iam.gserviceaccount.com`. **Anotar este email**.

Se o comando falhar, abrir o JSON da service account e pegar o campo `client_email` manualmente.

- [ ] **Step 2: Compartilhar pasta `TREINAMENTOS` com a service account**

No Google Drive, abrir a pasta `Compartilhados comigo / TREINAMENTOS` (link: https://drive.google.com/drive/u/0/folders/126AbwLea-me3aeQRKxl3Y9pIYnztY438). Compartilhar com o email da service account (Step 1) com permissão **Leitor**.

**Confirmar:** o ID da pasta no link é `126AbwLea-me3aeQRKxl3Y9pIYnztY438` (estava no spec).

- [ ] **Step 3: Aplicar permissão "Qualquer pessoa com o link" nos vídeos**

Para cada subpasta dentro de `TREINAMENTOS` (Performance, IA, Tech, CX/CS, Designer, Comercial, Pré-vendas, Social media, Creators):
1. Click direito → Compartilhar.
2. Em "Acesso geral" mudar de "Restrito" para "Qualquer pessoa com o link" → **Leitor**.
3. Salvar. Os arquivos dentro herdam a permissão.

Sem esse passo, o iframe do player vai mostrar "Você não tem permissão" para colaboradores que não tiverem acesso direto ao arquivo.

- [ ] **Step 4: Adicionar variável de ambiente local**

Editar `.env` na raiz do projeto e adicionar:
```
INTERNAL_TRAININGS_DRIVE_FOLDER_ID=126AbwLea-me3aeQRKxl3Y9pIYnztY438
```

Reiniciar dev server.

- [ ] **Step 5: Adicionar variável de ambiente em produção**

No painel de deploy do projeto (Replit/Cloud Run/qualquer que esteja em uso), adicionar:
```
INTERNAL_TRAININGS_DRIVE_FOLDER_ID=126AbwLea-me3aeQRKxl3Y9pIYnztY438
```

Redeploy se necessário para a variável fazer efeito.

- [ ] **Step 6: Smoke test E2E local**

Com dev server rodando, abrir browser em `http://localhost:3000/conhecimentos`:

1. **Aba Treinamento Interno** carrega e mostra estado vazio (ainda sem sync).
2. Clicar em **"Sincronizar agora"**. Esperar toast "Sincronizado! 9 trilhas, N vídeos" (N depende de quantos arquivos existem).
3. **Trilhas aparecem** (Performance, IA, Tech, CX/CS, Designer, Comercial, Pré-vendas, Social media, Creators), cada uma com ícone, cor e contador `0/N`.
4. **Expandir uma trilha** com vídeos. Lista de vídeos aparece com thumbnails. Se thumbnail estiver quebrada, validar permissão "Qualquer pessoa com o link" do arquivo.
5. **Click num vídeo** navega para `/conhecimentos/treinamentos/:videoId`. Player carrega o vídeo.
6. **"Marcar como concluído"** vira botão preenchido. Voltar para a aba: contador da trilha foi de 0/N para 1/N.
7. **Like** incrementa contador.
8. **Adicionar comentário** "teste" com Enter. Aparece imediatamente na lista.
9. **Excluir comentário próprio** (com confirmação). Some da lista.
10. **Tentar excluir comentário de outro usuário**: botão excluir nem aparece.
11. **Toggle dark/light** via TopBar. Toda a aba e a página do vídeo continuam legíveis.
12. **Voltar com botão "← Voltar"** retorna para `/conhecimentos` na aba correta.

Documentar quaisquer bugs encontrados, criar issues e/ou corrigir antes de declarar feito.

- [ ] **Step 7: Smoke test em produção**

Após deploy:
1. Acessar URL de produção, ir em Conhecimentos.
2. Verificar que aba Treinamento Interno está lá.
3. Cron de 1h ainda não rodou? Clicar em "Sincronizar agora".
4. Repetir testes principais (assistir um vídeo, comentar, excluir comentário próprio).
5. Confirmar com outro colaborador que ele consegue ver os mesmos vídeos.

- [ ] **Step 8: Commit final (se houver fixes do smoke test)**

Se durante o smoke test encontrou bugs e ajustou, fazer um commit:

```bash
git commit -m "$(cat <<'EOF'
fix(treinamento-interno): ajustes pós smoke-test E2E

[descrever ajustes feitos]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

Se nada precisou ajustar, pular.

---

## Resumo do plano

| Task | Responsabilidade | Testes |
|---|---|---|
| 1 | Schema + migration | typecheck |
| 2 | Sync service | Vitest (5 cenários) |
| 3 | API leitura | Vitest (3 cenários) + manual |
| 4 | API toggle | Vitest (3 cenários) |
| 5 | API comentários | Vitest (5 cenários, incluindo 403) |
| 6 | Sync endpoint + cron | manual via dev server |
| 7 | Frontend: themes + player | typecheck |
| 8 | Frontend: comentários | typecheck |
| 9 | Frontend: cards | typecheck |
| 10 | Frontend: aba | smoke manual |
| 11 | Frontend: página do vídeo | smoke manual |
| 12 | Operacional + E2E | smoke E2E completo |

**Estimativa:** ~12 horas para um engenheiro com contexto, mais ~30min de operações manuais (compartilhar pasta, configurar env vars).

**Ordem de dependências:** Tasks 1-6 são backend e podem ser feitas em sequência. Tasks 7-9 são frontend independentes (podem ser feitas em paralelo após Task 1, mas isolados do backend). Tasks 10-11 dependem de 7-9. Task 12 depende de tudo.

**Pontos de revisão críticos:**
- Após Task 2: confirmar testes do sync passando antes de seguir.
- Após Task 6: dev server boota com cron registrado, sem warnings.
- Após Task 10: aba aparece visualmente correta em dark e light.
- Antes de Task 12: production deploy validado em staging primeiro (se possível).
