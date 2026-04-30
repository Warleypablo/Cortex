# Treinamento Interno — Design

**Data:** 2026-04-29
**Autor:** Warley Pablo (com brainstorming via Claude)
**Status:** Design aprovado, aguardando plano de implementação

---

## Contexto e objetivo

A página `Conhecimentos` hoje tem duas abas: **Cursos** (catálogo de cursos externos contratados, com URL/login/senha) e **Benefícios** (cupons de empresas parceiras). Queremos uma terceira aba — **Treinamento Interno** — para os cursos gravados internamente pela equipe Cortex, que estão hospedados no Google Drive em `Compartilhados comigo / TREINAMENTOS`.

A pasta tem 9 subpastas que representam áreas/squads: `Performance`, `IA`, `Tech`, `CX/CS`, `Designer`, `Comercial`, `Pré-vendas`, `Social media`, `Creators`. Cada subpasta contém os vídeos daquela área.

Diferente dos cursos externos, o conteúdo é próprio e a aba precisa funcionar como um mini-portal de aprendizagem interno: assistir, marcar como concluído, curtir, comentar.

## Decisões tomadas no brainstorming

| Item | Decisão |
|---|---|
| Player | Embed dentro do Cortex (iframe Drive `/preview`) |
| Origem dos vídeos | Sync automático com a pasta `TREINAMENTOS` no Drive |
| Estrutura | Subpastas (9 áreas) viram trilhas no Cortex |
| Progresso | Manual ("Marcar como concluído") + contador X/Y por trilha |
| Acesso | Todo usuário autenticado vê todas as trilhas |
| Metadados | Apenas o que o Drive expõe; sem edição manual no Cortex |
| Camada social | Comentários (lista cronológica simples, sem replies) + like no vídeo todo |
| Frescor | Cron a cada 1h + botão "Sincronizar agora" visível para todos |
| Permissão Drive | Vídeos com permissão "Qualquer pessoa com o link" para o iframe funcionar |

## Arquitetura geral

```
┌──────────────────────┐         ┌──────────────────────────┐
│  Google Drive        │  pull   │  Cron 1h + manual        │
│  TREINAMENTOS/       │ ◄───────│  internalTrainingsSync   │
│   ├─ Performance/    │         │  (server/services)       │
│   ├─ IA/             │         │                          │
│   └─ ... 9 áreas     │         │                          │
└──────────────────────┘         └─────────┬────────────────┘
                                            │ upsert
                                            ▼
                                  ┌──────────────────────────┐
                                  │  Postgres (cortex_core)  │
                                  │  internal_video_tracks   │
                                  │  internal_videos         │
                                  │  internal_video_completions
                                  │  internal_video_likes    │
                                  │  internal_video_comments │
                                  └─────────┬────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────┐
│  Frontend                                                 │
│   Conhecimentos.tsx                                       │
│    ├─ Aba "Cursos"           ← já existe                  │
│    ├─ Aba "Benefícios"       ← já existe                  │
│    └─ Aba "Treinamento Interno"  ← NOVA                   │
│         ├─ Lista de trilhas (cards expansíveis)           │
│         └─ Rota /conhecimentos/treinamentos/:videoId      │
│              ├─ Player embed Drive                        │
│              ├─ Botões Marcar concluído / Like            │
│              └─ Thread de comentários                     │
└──────────────────────────────────────────────────────────┘
```

### Componentes com responsabilidades isoladas

1. **`server/services/internalTrainingsSync.ts`** — único responsável por falar com Drive API. Reutiliza auth de `server/autoreport/credentials.ts` (já configurado com escopo `drive`). Exporta `syncInternalTrainings(): Promise<SyncReport>`.
2. **`server/routes/internalTrainings.ts`** — endpoints REST sob `/api/treinamentos-internos`.
3. **`shared/schema.ts`** — definição Drizzle das 5 tabelas novas.
4. **Frontend** em `client/src/pages/TreinamentoInternoVideo.tsx` + `client/src/components/treinamento-interno/`.

## Modelo de dados

Schema `cortex_core`. Definido em `shared/schema.ts`.

### `internal_video_tracks` — trilhas (subpastas do Drive)

```ts
internalVideoTracks = pgTable("internal_video_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driveFolderId: text("drive_folder_id").notNull().unique(),
  nome: text("nome").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
```

### `internal_videos` — vídeos individuais

```ts
internalVideos = pgTable("internal_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackId: varchar("track_id").references(() => internalVideoTracks.id).notNull(),
  driveFileId: text("drive_file_id").notNull().unique(),
  nome: text("nome").notNull(),
  mimeType: text("mime_type"),
  thumbnailUrl: text("thumbnail_url"),
  duracaoMs: bigint("duracao_ms", { mode: "number" }),
  driveModifiedTime: timestamp("drive_modified_time"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
// Índice: (track_id, is_active) para listar vídeos de uma trilha
```

### `internal_video_completions` — quem assistiu o quê

```ts
internalVideoCompletions = pgTable("internal_video_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").references(() => internalVideos.id, { onDelete: "cascade" }).notNull(),
  userEmail: varchar("user_email", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqueUserVideo: unique().on(t.videoId, t.userEmail),
}))
```

Toggle: criar registro = marca concluído; deletar registro = desmarca.

### `internal_video_likes` — likes

```ts
internalVideoLikes = pgTable("internal_video_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").references(() => internalVideos.id, { onDelete: "cascade" }).notNull(),
  userEmail: varchar("user_email", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqueUserVideo: unique().on(t.videoId, t.userEmail),
}))
```

### `internal_video_comments` — comentários

```ts
internalVideoComments = pgTable("internal_video_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").references(() => internalVideos.id, { onDelete: "cascade" }).notNull(),
  userEmail: varchar("user_email", { length: 100 }).notNull(),
  userNome: text("user_nome").notNull(),
  conteudo: text("conteudo").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
// Índice: (video_id, created_at DESC) para listar comentários ordenados
```

### Decisões de modelo

- **`userEmail` como chave do usuário** — bate com o padrão atual do projeto (`(req as any).user?.email` em todos os endpoints existentes). Sem FK rígida com tabela de usuários para evitar acoplamento com auth.
- **`userNome` é cache** no comentário — se o nome mudar depois, comentários antigos mantêm o nome de quando foram escritos.
- **Sync nunca deleta** — vídeos/trilhas que somem do Drive viram `is_active = false`. Comentários e likes ficam preservados (caso a pasta seja restaurada).
- **`ON DELETE CASCADE`** em likes/completions/comments — rede de segurança caso um dia precise hard-delete um vídeo do banco.
- **Cor/ícone de cada trilha não fica no banco** — fica em `client/src/components/treinamento-interno/trackThemes.ts` mapeando por nome exato da subpasta (string match). Inclui fallback default para nomes não mapeados (cor cinza + ícone genérico de pasta), evitando crash se subir trilha nova no Drive antes do front ser atualizado.
- **`userNome` no comentário** — preenchido a partir do nome do usuário no auth do Cortex no momento da criação. Fallback: se auth não expuser nome, usar prefixo do email (parte antes do `@`).

## API

Todos os endpoints sob `/api/treinamentos-internos`, atrás de `isAuthenticated` (já configurado em `app.use("/api", isAuthenticated)`).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/trilhas` | Lista trilhas ativas + contagem total/concluídos do usuário |
| `GET` | `/videos?trackId=:id` | Vídeos de uma trilha (lazy load ao expandir trilha) |
| `GET` | `/videos/:id` | Detalhe + comentários ordenados |
| `POST` | `/videos/:id/concluir` | Toggle conclusão. Retorna `{ concluido: boolean }` |
| `POST` | `/videos/:id/like` | Toggle like. Retorna `{ curtiu: boolean, totalLikes: number }` |
| `POST` | `/videos/:id/comentarios` | Body `{ conteudo: string }`. Retorna comentário criado |
| `DELETE` | `/comentarios/:id` | Apaga (verifica `userEmail` = email do dono; senão 403) |
| `POST` | `/sync` | Dispara sync manual. Retorna report do sync |

### Resposta de `GET /trilhas`

```json
[
  {
    "id": "uuid-1",
    "nome": "Performance",
    "totalVideos": 12,
    "videosConcluidos": 4,
    "ultimoVideoModificadoEm": "2026-04-25T10:00:00Z"
  }
]
```

### Resposta de `GET /videos/:id`

```json
{
  "video": {
    "id": "uuid",
    "nome": "Aula 2 — Pixel & UTMs",
    "driveFileId": "1abc...",
    "thumbnailUrl": "https://drive.google.com/thumbnail?id=1abc&sz=w400",
    "duracaoMs": 1690000,
    "driveModifiedTime": "2026-04-25T10:00:00Z"
  },
  "trilha": { "id": "uuid", "nome": "Performance" },
  "userConcluiu": true,
  "userCurtiu": false,
  "totalLikes": 7,
  "comentarios": [
    {
      "id": "uuid",
      "userEmail": "warley@cortex.com",
      "userNome": "Warley Pablo",
      "conteudo": "Massa demais...",
      "createdAt": "2026-04-29T12:00:00Z",
      "isOwner": true
    }
  ]
}
```

### Validações

- `POST /comentarios` — body validado com Zod. `conteudo` obrigatório, max 5000 caracteres.
- `DELETE /comentarios/:id` — só o dono pode apagar (não há admin override no MVP).

## Sync com Drive

### Função principal: `syncInternalTrainings(): Promise<SyncReport>`

Em `server/services/internalTrainingsSync.ts`. Reutiliza auth do `server/autoreport/credentials.ts`.

```ts
type SyncReport = {
  ok: boolean;
  trilhasAtivas: number;
  videosAtivos: number;
  trilhasDesativadas: number;
  videosDesativados: number;
  erros: Array<{ contexto: string; mensagem: string }>;
  alreadyRunning?: boolean;
}
```

### Algoritmo

1. **Lock em memória** — variável `isSyncing: boolean` no módulo. Se já rodando, retorna `{ ok: true, alreadyRunning: true }` imediatamente.
2. **Listar subpastas de TREINAMENTOS_FOLDER_ID:**
   ```
   drive.files.list({
     q: "'<TREINAMENTOS_ID>' in parents and
         mimeType='application/vnd.google-apps.folder' and
         trashed=false"
   })
   ```
3. **Para cada subpasta:** upsert em `internal_video_tracks` por `drive_folder_id`, marcar `is_active = true`.
4. **Listar vídeos dentro de cada subpasta:**
   ```
   drive.files.list({
     q: "'<subpasta_id>' in parents and
         mimeType contains 'video/' and
         trashed=false",
     fields: "files(id, name, mimeType, thumbnailLink,
                     videoMediaMetadata(durationMillis),
                     modifiedTime), nextPageToken",
     pageSize: 1000
   })
   ```
   - Paginar com `nextPageToken` se necessário.
   - Filtra `mimeType` começando com `video/`. Outros tipos (PDF, doc) ignorados.
   - **Não recursa em sub-subpastas.** Apenas 1 nível de profundidade.
5. **Para cada vídeo:** upsert em `internal_videos` por `drive_file_id`, atualiza `nome`, `thumbnailUrl`, `duracaoMs`, `driveModifiedTime`, marca `is_active = true`.
6. **Reconciliação (soft-delete):**
   - Trilhas cujo `drive_folder_id` não veio do Drive → `is_active = false`.
   - Vídeos cujo `drive_file_id` não veio → `is_active = false`.
   - Comentários, likes, conclusões ficam intactos.
7. **Erros parciais:** `try/catch` por trilha/vídeo. Falha individual é registrada em `report.erros`, sync continua.

### Detalhes técnicos

- **ID da pasta TREINAMENTOS** — variável de ambiente `INTERNAL_TRAININGS_DRIVE_FOLDER_ID`. Confirmar se é `126AbwLea-me3aeQRKxl3Y9pIYnztY438`.
- **Thumbnail** — usar URL estável `https://drive.google.com/thumbnail?id={driveFileId}&sz=w400` em vez de `thumbnailLink` retornado pela API (que pode expirar/exigir auth no `<img>`).
- **Player embed** — iframe `https://drive.google.com/file/d/{driveFileId}/preview` com `allow="autoplay; fullscreen"`. **Requer permissão "Qualquer pessoa com o link" nos arquivos** (ver Pré-requisitos).

### Trigger

1. **Cron a cada 1h** — verificar mecanismo existente em `server/maintenance.ts` ou `server/scripts/`. Se não houver, adicionar `setInterval` em `server/index.ts` durante boot. Backoff exponencial em caso de rate limit (próxima rodada em 2h em vez de 1h).
2. **Botão manual "Sincronizar agora"** na aba — chama `POST /api/treinamentos-internos/sync` e mostra toast com resultado. Visível para todos os usuários autenticados.

## Frontend

### Estrutura de arquivos

```
client/src/
├── pages/
│   ├── Conhecimentos.tsx          ← MODIFICAR (adicionar 3ª aba)
│   └── TreinamentoInternoVideo.tsx ← NOVO (rota /conhecimentos/treinamentos/:videoId)
└── components/treinamento-interno/
    ├── TreinamentoInternoTab.tsx   ← conteúdo da 3ª aba
    ├── TrilhaCard.tsx              ← card expansível de trilha
    ├── VideoCard.tsx               ← card de vídeo dentro da trilha
    ├── VideoPlayer.tsx             ← wrapper do iframe Drive
    ├── ComentariosThread.tsx       ← lista + form de comentários
    ├── ComentarioItem.tsx          ← um comentário
    └── trackThemes.ts              ← mapeamento { "Performance": { color, icon }, ... }
```

### Rota nova

`App.tsx`:
```tsx
<Route path="/conhecimentos/treinamentos/:videoId" component={TreinamentoInternoVideo} />
```

### Tela 1 — Aba "Treinamento Interno"

```
┌─ Cursos ──── Benefícios ──── Treinamento Interno ──┐
│                                                     │
│  [🔄 Sincronizar agora]              [🔍 Buscar]    │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🎯 Performance        ▮▮▮▮░░░░░░░░ 4/12      │  │  ← TrilhaCard
│  │ ──────────────────────────────────────────── │  │     (expansível)
│  │ [thumb] Aula 1 — Boas-vindas       12:34  ✓  │  │
│  │ [thumb] Aula 2 — Pixel & UTMs      28:10  ✓  │  │
│  │ [thumb] Aula 3 — CBO vs ABO        15:22     │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🤖 IA                ░░░░░░░░░░░░ 0/8        │  │
│  └──────────────────────────────────────────────┘  │
│  (... 9 trilhas)                                    │
└─────────────────────────────────────────────────────┘
```

- **Cards expansíveis** (igual padrão do projeto). Múltiplas podem ficar abertas ao mesmo tempo.
- **Barra de progresso** mostra `videosConcluidos/totalVideos`.
- **VideoCard** tem thumbnail, título, duração formatada, ✓ se concluído. Click navega para `/conhecimentos/treinamentos/:videoId`.
- **Busca** filtra por nome do vídeo dentro de todas as trilhas.

### Tela 2 — Página do vídeo

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Voltar para Treinamento Interno                                  │
│                                                                     │
│  Performance / Aula 2 — Pixel & UTMs                                │
│                                                                     │
│  ┌───────────────────────────────────────────────┐                  │
│  │      [iframe drive.google.com/preview]        │                  │
│  └───────────────────────────────────────────────┘                  │
│                                                                     │
│  Aula 2 — Pixel & UTMs                          28:10 · há 3 dias  │
│  [✓ Marcar como concluído]   [♥ 7 likes]                            │
│                                                                     │
│  ───────────────── 4 comentários ──────────────────────             │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │ [escrever comentário...]                    │                   │
│  │                              [Comentar]     │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
│  👤 Warley Pablo · há 2 horas                       [excluir]       │
│  Massa demais essa parte do CBO, ajudou pra caramba                 │
│                                                                     │
│  👤 Karol Tognere · há 1 dia                                        │
│  Anotando aqui, valeu                                               │
└────────────────────────────────────────────────────────────────────┘
```

- **Player**: iframe ~70% largura desktop, full-width mobile. `allow="autoplay; fullscreen"`.
- **Botões de ação** abaixo do player com optimistic update (React Query).
- **Form de comentário** acima da lista (padrão YouTube). Enter envia, Shift+Enter quebra linha.
- **"Excluir"** só aparece em comentários do próprio usuário, com confirmação via `AlertDialog`.
- **Avatar/nome** vem do auth do Cortex. Inicial em círculo se não tiver foto.
- **Fallback** "Abrir no Drive" abaixo do player, caso o iframe não consiga renderizar (cross-origin, não dá pra detectar).

### Estado/dados (React Query)

| Query key | Conteúdo |
|---|---|
| `["/api/treinamentos-internos/trilhas"]` | lista da aba |
| `["/api/treinamentos-internos/videos", { trackId }]` | vídeos de uma trilha (lazy ao expandir) |
| `["/api/treinamentos-internos/videos", videoId]` | detalhe + comentários |

Mutations: concluir, like, criar comentário, excluir comentário, sync. Todas invalidam queries relevantes.

### Tema e acessibilidade

- Dark/light usando `dark:` Tailwind (regra do projeto).
- `data-testid` nos elementos interativos (padrão do projeto).
- `<title>` no iframe.
- `aria-label` em botões só com ícone.

## Erros e edge cases

### Drive API

| Cenário | Tratamento |
|---|---|
| Pasta TREINAMENTOS inacessível (404, 403) | Sync retorna `{ ok: false, error }`. Toast no botão manual. Cron loga e tenta de novo. |
| Quota Drive excedida | `lastSyncStatus = "rate_limited"`. Cron faz backoff exponencial (próxima em 2h). |
| Subpasta individual falha | `try/catch` por trilha. Erro vai para `report.erros`, sync continua. |
| Token expirado | `googleapis` renova sozinho (já configurado). |

### Sincronização

- **Vídeo renomeado** — `drive_file_id` igual, atualiza só `nome`. Comentários/likes preservados.
- **Vídeo movido entre subpastas** — atualiza `track_id`. Comentários/likes seguem o vídeo.
- **Subpasta deletada** — trilha vira `is_active = false`, vídeos junto. Frontend deixa de listar.
- **Vídeo com nome duplicado** — banco permite, frontend mostra os dois.
- **Trilha vazia** — frontend mostra "Nenhum vídeo nesta trilha ainda".
- **Arquivos não-vídeo na pasta** — ignorados pelo filtro de `mimeType`.
- **Sub-subpastas** — ignoradas (apenas 1 nível). Documentar para usuários: "estruture vídeos diretamente dentro de cada subpasta de área".
- **Sync paralelo** (cron + manual) — lock em memória previne; segundo trigger retorna `{ alreadyRunning: true }`.

### UX

- **Aba sem sync ainda** — estado vazio: "Nenhuma trilha sincronizada ainda. Clique em Sincronizar agora."
- **Iframe falha por permissão** — sem detecção possível (cross-origin). Mostrar link "Abrir no Drive" como fallback.
- **Comentário muito longo** — limite 5000 chars no backend. Frontend mostra contador a partir de 4500.
- **XSS** — texto puro, escape automático do React. Sem markdown nem HTML. Links viram `<a>` por regex `https?://...`.
- **Vídeo desativado depois de comentar** — `GET /videos/:id` retorna 404 se `is_active = false`. Frontend redireciona para a aba com toast.

## Segurança

- Todos endpoints atrás de `isAuthenticated`.
- `DELETE /comentarios/:id` valida `userEmail` do comentário === email do usuário autenticado. Diferente = 403. Sem admin override no MVP.
- Vídeos no Drive precisam de "Qualquer pessoa com o link" para o iframe funcionar. **Risco aceito**: se o link direto do Drive vazar, qualquer um vê. Conteúdo é treinamento interno operacional, não dados sensíveis.
- Sem rate limit explícito no MVP. Se virar problema (spam), adicionar depois.

## Testes

### Backend (Vitest, padrão do projeto)

`server/services/__tests__/internalTrainingsSync.test.ts`:
1. Mock `googleapis` retornando 2 trilhas com 5 vídeos cada.
2. Verifica upserts corretos.
3. Reconciliação: vídeo que sumiu vira `is_active = false`.
4. Comentários/likes preservados em vídeos desativados.
5. Arquivos não-vídeo são ignorados.
6. Sub-subpastas são ignoradas.
7. Erros em uma trilha não afetam as outras.

`server/routes/__tests__/internalTrainings.routes.test.ts`:
1. Toggle like/concluir cria registro na primeira chamada, deleta na segunda.
2. `DELETE /comentarios/:id` de outro usuário retorna 403.
3. `GET /trilhas` agrega `videosConcluidos` corretamente.
4. `GET /videos/:id` retorna 404 se `is_active = false`.

### Frontend (smoke test manual no browser, dark e light)

- Aba carrega trilhas com progresso correto.
- Expandir trilha mostra vídeos.
- Click em vídeo navega para a página.
- Player carrega.
- Comentário aparece imediatamente (optimistic).
- Like toggle.
- Marcar concluído toggle, atualiza progresso da trilha após voltar.
- Excluir comentário próprio funciona (com confirmação).
- Botão "Sincronizar agora" mostra toast.
- Dark e light mode OK.

## Performance

- Listagem da aba: 1 query agregada para todas trilhas (~50ms). React Query cache de 1 min.
- Vídeos por trilha: lazy load ao expandir.
- Comentários: limite de 100 por página, ordenado por `created_at DESC`.

## Migração e deploy

1. **Migration** cria as 5 tabelas + índices em `cortex_core`. Próximo número em `migrations/` (verificar antes).
2. Aplicar **local e produção** (regra do projeto, está na memória `feedback_db_prod_sync.md`).
3. Adicionar `INTERNAL_TRAININGS_DRIVE_FOLDER_ID` em `.env` local e em produção.
4. Compartilhar pasta `TREINAMENTOS` com a service account do Cortex (Leitor).
5. Configurar permissão "Qualquer pessoa com o link" nos arquivos de vídeo dentro das subpastas.
6. Deploy backend → deploy frontend → primeiro sync manual via botão.

## Pré-requisitos operacionais

Antes da implementação começar a valer, alguém precisa fazer manualmente:

1. **Confirmar ID** da pasta `TREINAMENTOS` (provavelmente `126AbwLea-me3aeQRKxl3Y9pIYnztY438`).
2. **Compartilhar a pasta** `TREINAMENTOS` com a service account do Cortex como **Leitor** (email da service account está em `server/autoreport/credentials.ts`).
3. **Configurar permissão "Qualquer pessoa com o link → Leitor"** nos arquivos de vídeo dentro das subpastas. Pode aplicar nas subpastas inteiras (herança) para não precisar repetir por arquivo.
4. **Definir `INTERNAL_TRAININGS_DRIVE_FOLDER_ID`** no `.env` local e em produção.

## Fora de escopo (futuras iterações)

- Replies em comentários (threading).
- @menções e notificações.
- Markdown em comentários.
- Editar comentário.
- Materiais de apoio (PDFs, slides) anexos ao vídeo.
- Suporte a sub-subpastas (módulos dentro de trilhas).
- Player nativo com proxy (em vez de iframe Drive).
- Progresso automático por tempo de vídeo assistido.
- Restrição de visibilidade por área/squad.
- Edição de metadados (descrição, instrutor, ordem) pelo Cortex.
- Esconder/desabilitar vídeos via UI.
- Métricas de engajamento (mais vistos, mais curtidos).
