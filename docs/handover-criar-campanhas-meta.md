# Handoff — Feature "Subir Campanhas no Meta Ads"

**Branch:** `feature/criar-campanhas-meta-ads`
**Derivada de:** `feature/otimizacao-de-ads`
**Estratégia de merge:** ambas vão num **único PR pra `main`** (não mergear separado).
**Plano original:** `/Users/ichino/.claude/plans/quero-a-sua-ajuda-glimmering-island.md`

---

## 🎯 Objetivo da feature

Permitir ao usuário criar **campanha + conjunto + anúncios** no Meta Ads a partir de um briefing curto + link do Drive com criativos. Tudo é criado em status `PAUSED` para revisão manual no Gerenciador antes da ativação.

---

## ✅ O QUE JÁ ESTÁ PRONTO

### Backend (`server/`)

- **`shared/schema.ts`** — tabela `meta_creation_drafts` adicionada (briefing + result + status).
- **`scripts/create-meta-creation-drafts-table.ts`** — migration idempotente (já rodada em prod).
- **`server/services/adsCreation/`** (módulo da feature):
  - `types.ts` — tipos (`Briefing`, `BudgetMode`, `CampaignMode`, `Placement`, `CreativeMode`, etc.)
  - `metaApi.ts` — cliente HTTP da Meta Marketing API com **Batch API**, retry/backoff inteligente, polling de vídeo, header `x-business-use-case-usage` logando uso quando >75%.
  - `driveLoader.ts` — lê pasta do Drive via Service Account, baixa arquivos, **converte HEIC→JPG** automaticamente.
  - `audienceResolver.ts` — lista custom audiences + saved audiences. **Cache 5min em memória.**
  - `mediaUploader.ts` — upload de imagem (síncrono) e vídeo (async + polling).
  - `sheetReader.ts` — lê o Sheet "Criativos", faz match com arquivos do Drive (por File ID ou nome).
  - `creator.ts` — orquestra a criação completa via Batch API + nomenclatura + IG fallback.
  - `index.ts` — entry point `createCampaignFromBriefing()`.
- **`server/routes/ads-creation.ts`** — endpoints `/whoami`, `/audiences`, `/campaigns`, `/preview-drive`, `/draft`, `/draft/:id`, `/status/:id`, `/execute/:id`. Protegido por `requireEmail`.
- **`server/middleware/requireEmail.ts`** — usado pra restringir aos approvers.
- **`server/routes.ts`** — registro do `registerAdsCreationRoutes`.

### Frontend (`client/`)

- **`client/src/hooks/useAdsCreation.ts`** — hooks React Query (whoami, audiences, campaigns, draft, execute, status, preview-drive).
- **`client/src/components/criativos/criar-campanha/NovaCampanhaSheet.tsx`** — diálogo único com formulário multi-seção.
- **`client/src/pages/Criativos.tsx`** — botão "Subir nova campanha" ao lado do "Otimizar com IA".

### Configuração (`.env`)

Variáveis adicionadas (e já preenchidas em local):

```
META_DEFAULT_AD_ACCOUNT_ID=act_1331413260627780
META_DEFAULT_PAGE_ID=111691498031338
META_DEFAULT_PIXEL_ID=1375902709765726
META_DEFAULT_INSTAGRAM_ACTOR_ID=17841423555147969
```

⚠️ **Pendente em produção (Replit/qualquer ambiente além de local):** replicar essas 4 variáveis no `.env` do ambiente de produção.

### Service Account do Drive

- E-mail: `report-job-sa@auto-report-turbo.iam.gserviceaccount.com`
- Pra cada pasta de criativos no Drive, precisa **compartilhar com esse e-mail** (Leitor) — ou compartilhar a pasta-pai e herdar.
- O Sheet de Criativos **também precisa estar compartilhado com a SA**.

---

## 🏗️ DECISÕES DE ARQUITETURA IMPORTANTES

### 1. Meta Batch API — comportamento dos `{result=...}`
**Descoberta crítica que custou várias horas de debug:**

> Quando um sub-request do batch usa `{result=NOME:$.id}` para referenciar outro item, o item **referenciado retorna `body: null`** mesmo em sucesso, **independente de `omit_response_on_success`**.

**Solução implementada em `creator.ts`:**
- **3 chamadas HTTP** por criação (em vez de 4-12 sem batch):
  1. `POST /campaigns` (sozinho — precisamos do ID).
  2. `POST /adsets` (sozinho — precisamos do ID; ads vão referenciar via `{result=}`, então tem que vir sozinho).
  3. **Batch** com `[creative_0, ad_0, creative_1, ad_1, ...]` — creatives ficam null (esperado), ads voltam com ID.

### 2. Optimization de Rate Limit
Após bater rate limit em testes em ráfaga, foram aplicadas:
- **Cache server-side de audiences (5min)** — antes era ~3 calls por abertura do diálogo.
- **Fail-fast em `code=80004`** — não fazer retry quando é rate limit duro (retry piora a quota).
- **Header `x-business-use-case-usage`** logado quando uso >75%.
- **Polling de vídeo escalonado**: 5s → 10s → 15s → 20s.
- **Batch API**: -75% das chamadas de criação.

### 3. Nomenclatura padrão Turbo
Todos os nomes seguem padrão fixo, gerado automaticamente:

| Nível | Padrão |
|---|---|
| Campanha (modo "new") | `[TP] [{Objetivo}] [{ABO/CBO}] [{Produto}] - {Nome livre}` |
| Conjunto | `[{NN}] - {Posicionamentos} {Público} {Personagem} - {Nome do ad}` |
| Anúncio | `Nome Final` extraído do Sheet |

- **`[NN]` é sequencial por campanha** — `getNextAdSetSequence()` lista adsets existentes e pega o próximo número.
- **Personagem + Nome do ad** vêm do Sheet "Criativos" (não do formulário).

### 4. URL Tags fixos
Hardcoded em `creator.ts` (constante `TURBO_URL_TAGS`):
```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}
```
Não há campo no formulário pra editar isso.

### 5. Modo "Adicionar a existente"
Toggle no topo do diálogo. Quando o usuário escolhe "existente":
- Combobox lista campanhas ativas/pausadas da conta (endpoint `/campaigns`).
- Pula a criação de campanha; apenas cria conjunto + ads dentro dela.
- Esconde campos de produto/objetivo/budgetMode (vêm da existente).
- Numeração `[NN]` continua sequencial dentro da campanha escolhida.

### 6. Opt-outs aplicados em todo creative
Em `creator.ts`:
- **Multi-advertiser ads**: `contextual_multi_ads: { enroll_status: "OPT_OUT" }`
- **Advantage+ Creative**: 20+ features setadas com `enroll_status: "OPT_OUT"` em `degrees_of_freedom_spec.creative_features_spec`.

### 7. IG Fallback automático
Se o batch falhar com erro de `instagram_actor_id` (BM mal configurado), retenta phase 2 sem IG (publica só FB). Sem intervenção do usuário.

---

## 🔌 BIBLIOTECA DE CRIATIVOS — fonte de verdade dentro do Cortex

> ⚠️ **Migrado em 2026-05-02** do Google Sheet para uma tabela no banco do Cortex.
> O Sheet **deixou de ser fonte de verdade**. A nova fonte é a tabela
> `cortex_core.creatives_library`, gerenciada pela página `/growth/criativos/biblioteca`.

### Por que migrou
- Volume +1.000 linhas, preenchimento manual, frágil pra automação.
- Decisão alinhada com usuário: Cortex vira fonte da verdade, automação prioritária dos campos básicos (ID, Nome Drive, Link, Data, Nome Final).

### Estrutura da tabela `cortex_core.creatives_library`
- Schema em `shared/schema.ts` → `creativesLibrary` (também exportado como tipo `CreativeLibraryItem`).
- Colunas espelham o Sheet original: `tp_id` (unique), `nome_drive`, `link_drive`, `drive_file_id`, `angulo`, `hook`, `corpo`, `cta`, `etapa_funil`, `data_postagem`, `produto`, `plataforma`, `personagem`, `formato`, `tipo_ad`, `id_copy`, `observacao`, `nome_final`, `ad_validado`.
- Auditoria: `created_by` (email), `created_at`, `updated_at`, `deleted_at` (**soft delete** — UI esconde rows não nulas).
- Índices: `tp_id` (unique), `drive_file_id`, `nome_drive`, `deleted_at`.

### Migration + backfill
```bash
# 1. Cria a tabela e migra todos os rows do Sheet (idempotente)
npx tsx scripts/create-creatives-library-table.ts

# 2. Libera a permissão `growth.criativos_biblioteca` pros 3 approvers
npx tsx scripts/grant-creatives-library.ts
```
- Backfill em lotes de 200, dedup por `drive_file_id` (preferido) ou `nome_drive`.
- Sequência `TP{NN}` continua a partir do maior TP existente no Sheet.

### Fórmula de Nome Final (mantida)
```
Nome Final = {tpId} - {nomeDrive} - {idCopy} - {DD/MM/AA}
```
Ex: `TP01 - img-novosclientes - adc1 - 01/07/23`. Implementada em `creativesRepo.ts → buildNomeFinal()` e regenerada automaticamente em `updateCreative()` quando `nomeDrive`/`idCopy`/`dataPostagem` mudam.

### Match Drive ↔ Biblioteca
Mesma lógica do `sheetReader` (preservada em `creativesRepo.ts → matchDriveFilesToRows()`):
1. Tenta por File ID extraído de `link_drive`.
2. Fallback: por `nome_drive` normalizado (lowercase, sem extensão).
3. Arquivos sem cadastro na biblioteca falham com lista clara — usuário cadastra antes de subir a campanha.

### Endpoints REST (todos restritos via `requireEmail`)
| Método | Rota | Uso |
|---|---|---|
| `GET` | `/api/growth/creatives` | List paginada com filtros (q, personagem, produto, etapaFunil, adValidado) |
| `GET` | `/api/growth/creatives/options` | Distinct values pros dropdowns (autocomplete) |
| `GET` | `/api/growth/creatives/:id` | Get one |
| `POST` | `/api/growth/creatives` | Cria (backend gera tpId + nomeFinal) |
| `PATCH` | `/api/growth/creatives/:id` | Edita (regera nomeFinal se preciso) |
| `DELETE` | `/api/growth/creatives/:id` | Soft delete |
| `POST` | `/api/growth/creatives/match` | Match Drive ↔ biblioteca pra fluxo de criação |
| `GET` | `/api/growth/creatives/whoami` | Frontend gate |

### UI
- **Rota:** `/growth/criativos/biblioteca` (item separado no menu Growth, ícone `BookOpen`).
- **Permissão:** `growth.criativos_biblioteca` (separada de `growth.criativos`).
- **Página** `client/src/pages/CriativosBiblioteca.tsx`: tabela com search/filtros/paginação 50/página.
- **Form** `client/src/components/criativos/biblioteca/CreativeFormSheet.tsx`: Dialog de criar/editar com auto-extração de Drive File ID do link, dropdowns autocomplete (opção "+ Novo valor"), preview live de Nome Final, botão soft delete.
- **Hook** `client/src/hooks/useCreatives.ts`.

### O que sumiu da feature de "Subir Campanha"
- Campo "Link do Sheet de Criativos" removido do `NovaCampanhaSheet` (substituído por aviso linkando pra biblioteca).
- `Briefing.sheetUrl` removido de `types.ts`, validação no backend e payload do client.
- `server/services/adsCreation/index.ts` agora chama `listAllForMatching()` (banco) em vez de `readCreativesSheet()`.

### Arquivos relevantes
**Novos:**
- `shared/schema.ts` (+ `creativesLibrary`)
- `scripts/create-creatives-library-table.ts`
- `scripts/grant-creatives-library.ts`
- `server/services/adsCreation/creativesRepo.ts`
- `server/routes/creatives.ts`
- `client/src/hooks/useCreatives.ts`
- `client/src/pages/CriativosBiblioteca.tsx`
- `client/src/components/criativos/biblioteca/CreativeFormSheet.tsx`

**Modificados:**
- `server/services/adsCreation/index.ts` (troca de fonte)
- `server/services/adsCreation/types.ts` (drop `sheetUrl`)
- `server/routes/ads-creation.ts` (drop `sheetUrl` da validação)
- `server/routes.ts` (registrar `registerCreativesRoutes`)
- `client/src/App.tsx` (rota nova)
- `client/src/components/criativos/criar-campanha/NovaCampanhaSheet.tsx` (drop input de Sheet)
- `client/src/hooks/useAdsCreation.ts` (drop `sheetUrl` do payload)
- `shared/nav-config.ts` (permissão + item de menu novos)

### Pendência da migração
- [x] Schema + backfill + UI prontos.
- [ ] **Validar end-to-end com criação real de campanha** — depois disso, deletar `server/services/adsCreation/sheetReader.ts` (sem referências externas hoje, confirmado por grep).

---

## 📐 Convenção de nome de arquivo + auto-cadastro

**Adicionado em 2026-05-04.** Padrão interno do time pra que o Cortex cadastre criativos automaticamente na Biblioteca quando o usuário cola uma pasta do Drive na hora de subir a campanha.

### Padrão
```
{tipo}-{nomeAd}-{personagem}-h{N}-b{N}-cta{N}-{formato}-v{NN}.{ext}
```

| Campo | Valores | Vai pra (Biblioteca) |
|---|---|---|
| `tipo` | `vv` (vídeo), `img` (imagem), `car` (carrossel) | `formato` ("Vídeo"/"Imagem"/"Carrossel") |
| `nomeAd` | kebab-case livre | `angulo` + `idCopy` (default) |
| `personagem` | lowercase | `personagem` |
| `h{N}` / `b{N}` / `cta{N}` | ids do hook, body, CTA | `hook` / `corpo` / `cta` |
| `formato` | `9x16`, `4x5`, `1x1`, `16x9` | (info de placement, não persiste) |
| `v{NN}` | variação 2 dígitos | (info de variação) |
| `ext` | `mp4`, `mov`, `jpg`, `jpeg`, `png` | — |

**Exemplo:** `vv-novosclientes-marina-h1-b2-cta1-9x16-v01.mp4`

### Fluxo automático
1. Usuário cola pasta do Drive em "Subir nova campanha" → "Listar".
2. Backend (`/preview-drive`) classifica cada arquivo em 3 grupos:
   - 🟢 **Já cadastrado** — match por `drive_file_id` ou `nome_drive` na biblioteca.
   - 🔵 **Auto-cadastro** — nome bate com a convenção, parser preenche `formato`/`personagem`/`hook`/`corpo`/`cta`/`angulo`/`idCopy`.
   - 🟡 **Fora do padrão** — entra como stub mínimo (só `nome_drive` + `link_drive` + `drive_file_id`). User completa depois manualmente se quiser.
3. UI mostra os 3 grupos com contadores e detalhes expansíveis.
4. Ao clicar **"Criar em PAUSED no Meta"**, o backend (`/execute/:id`) chama `bulkInsertStubs(autoStubs + unparseableStubs)` antes de subir a campanha — dedup por `drive_file_id`, gera `tpId` sequencial. Cancelar não deixa stubs órfãos.

### Implementação técnica
- Parser: `server/services/adsCreation/creativesRepo.ts → parseFileNameConvention()`. De trás pra frente, robusto a hífens dentro de `nomeAd`.
- Insert em batch: `server/services/adsCreation/creativesRepo.ts → bulkInsertStubs()`.
- Pareamento bulk: `server/services/adsCreation/driveLoader.ts → canonicalBasename()` remove o segmento `-(9x16|4x5|1x1|16x9)-` do basename antes de comparar (assim `9x16-v01.mp4` pareia com `4x5-v01.mp4`).

### Pasta no Drive (convenção)
**Bulk:**
```
[Campanha] {Produto} - {NomeLivre}/
  Conj 01 - {ResumoCurto}/
    9x16/ vv-x-marina-h1-b2-cta1-9x16-v01.mp4
    4x5/  vv-x-marina-h1-b2-cta1-4x5-v01.mp4
  Conj 02/...
```

**Single:**
```
[Campanha] {Produto} - {NomeLivre}/
  vv-novosclientes-marina-h1-b2-cta1-9x16-v01.mp4
```

---

## ⚠️ PENDÊNCIAS PRA PRÓXIMA SESSÃO

Salvas em memória (`/Users/ichino/.claude/projects/-Users-ichino-Documents-Turbo-Cortex/memory/project_criar_campanhas_pendencias.md`):

### 1. Agrupar posicionamentos no nome do conjunto
- **Hoje:** lista cada placement individualmente (`IG-Feed/IG-Perfil/IG-Stories/IG-Reels`).
- **Usuário pediu:** agrupar em **Feed / Reels / Stories** (na prática "Perfil" = "Feed" para eles).
- **Decisão pendente:** o que fazer com placements que não cabem nos 3 grupos (Marketplace, Search, In-stream, Explore, Right Column).

### 2. Abreviar nome do público no nome do conjunto
- **Hoje:** cabe o nome inteiro (`[50%] - video view-creators - 30D - 14.11`).
- **Usuário pediu:** abreviação automática.
- **Decisão pendente:** regra. Opções:
  - Pegar primeiros N caracteres
  - Pegar só último segmento separado por `-`
  - Cadastro manual de aliases curtos por audience
  - "DE-PARA" vindo de uma planilha

### 3. Validar integração com o Sheet end-to-end
- Implementação está pronta mas **ainda não foi testada com o Sheet real**.
- Próximo passo: testar com a aba `Criativos` real e validar matching.

### 4. Em produção (`.env` do Replit)
Replicar as 4 variáveis novas:
```
META_DEFAULT_AD_ACCOUNT_ID=act_1331413260627780
META_DEFAULT_PAGE_ID=111691498031338
META_DEFAULT_PIXEL_ID=1375902709765726
META_DEFAULT_INSTAGRAM_ACTOR_ID=17841423555147969
```

### 5. Limites da Meta API
- Limite atual da conta = ~tier "Development". Pode bater rate limit em uso intenso.
- **Caminhos pra escalar (não código):**
  - **App Review** pra elevar tier (Standard → Advanced → Premium): 10x-100x mais quota cada nível, 1-3 semanas cada.
  - **Marketing API Partner Program**: top tier, processo formal, faz sentido se Turbo virar plataforma pra terceiros.
  - **Crescimento natural**: spend + idade da conta aumentam quota com tempo.
- **Caminhos por código (já planejados):**
  - Queue interna com rate limiter (token bucket) — pra subir N campanhas controladamente.
  - Webhook de vídeo em vez de polling.

### 6. Upload em massa (múltiplos conjuntos numa execução) ✅ IMPLEMENTADO (2026-05-02)
- **Plano:** `/Users/ichino/.claude/plans/para-a-a-feature-adaptive-yao.md`
- **Estrutura no Drive (bulk):**
  ```
  Campanha XPTO/
    Conj 01/
      9x16/  ad1.mp4 ad2.mp4 ad3.mp4
      4x5/   ad1.mp4 ad2.mp4 ad3.mp4
    Conj 02/ ...
  ```
- Detecção automática single vs bulk em `listDriveFolderTree()` (driveLoader.ts).
- Loop de conjuntos em `orchestrateCreation()` com sequência `[NN]` incremental local; erro num conjunto não aborta os demais.
- Mesmo público/copy/orçamento aplicados a todos os conjuntos da execução. Variação de público por conjunto fica como próxima iteração.

### 7. Múltiplos formatos no mesmo creative (4x5 + 9x16) ✅ IMPLEMENTADO (2026-05-02)
- Implementado via `asset_feed_spec` + `asset_customization_rules` em `creator.ts → buildPairedCreativeParams()`.
- Pareamento por basename dentro das subpastas `9x16/` e `4x5/` (validação de pares incompletos).
- Quando há só 1 formato (subpasta default ou só 1 dos lados), volta pro `object_story_spec` clássico.

### 8. Aceleração de upload de vídeo
Ideias listadas, **nenhuma implementada**:
- Compressão antes do upload (ffmpeg, ~50-80% menor)
- Upload chunked paralelo
- Pre-warm (começar upload ao colar link do Drive)
- Cache por hash MD5
- Webhook em vez de polling

---

## 🧪 COMO TESTAR

### Setup local
```bash
# 1. Garantir tabela criada (idempotente)
npx tsx scripts/create-meta-creation-drafts-table.ts

# 2. Conferir variáveis no .env
grep META_DEFAULT .env

# 3. Subir o servidor
npm run dev
# (porta 3000 por padrão)
```

### Pré-requisitos no Drive/Sheets
- Pasta com criativos compartilhada com SA `report-job-sa@auto-report-turbo.iam.gserviceaccount.com`
- Sheet de Criativos compartilhado com a SA, aba `Criativos` com colunas `Nome Drive`, `Personagem`, `Nome Final`

### Fluxo no browser
1. Login com `vinicius.ichino@turbopartners.com.br`, `warleyreserva4@gmail.com` ou `ferramentas@turbopartners.com.br` (são os approvers).
2. Página `Criativos`.
3. Botão "Subir nova campanha".
4. Toggle: Nova ou Existente.
5. Preencher campos.
6. Listar Drive para ver arquivos. Listar Sheet para validar match (TODO: adicionar botão).
7. Clicar "Criar em PAUSED no Meta".
8. Polling acontece. Quando termina: link "Abrir no Gerenciador".
9. Conferir no Gerenciador. Deletar manualmente se for teste.

### Diagnósticos rápidos via terminal
```bash
# Ver e-mail da SA
npx tsx -e "import 'dotenv/config'; import { getGoogleAuth } from './server/autoreport/credentials'; getGoogleAuth();" 2>&1 | grep "Service account"

# Listar audiences da conta
npx tsx -e "import 'dotenv/config'; import { listAudiences } from './server/services/adsCreation/audienceResolver'; listAudiences('act_1331413260627780').then(a => console.log(a.length, 'audiences'))"

# Conferir contagem da Biblioteca de Criativos (deve bater com o Sheet)
npx tsx -e "import 'dotenv/config'; import { listCreatives } from './server/services/adsCreation/creativesRepo'; listCreatives({ pageSize: 1 }).then(r => console.log(r.total, 'criativos no banco'))"

# Conferir maior tpId existente
npx tsx -e "import 'dotenv/config'; import { generateNextTpId } from './server/services/adsCreation/creativesRepo'; generateNextTpId().then(t => console.log('próximo TP será', t))"
```

### Limpeza pós-teste
Campanhas de teste ficam com nome contendo o que você digitou + status PAUSED. **Sempre deletar manualmente no Gerenciador depois de testar** pra não acumular órfãs (cada teste = 1 campanha + 1 conjunto + N ads).

---

## 📁 ARQUIVOS MODIFICADOS/CRIADOS NESTA BRANCH

### Novos
```
scripts/create-meta-creation-drafts-table.ts
server/services/adsCreation/types.ts
server/services/adsCreation/metaApi.ts
server/services/adsCreation/driveLoader.ts
server/services/adsCreation/audienceResolver.ts
server/services/adsCreation/mediaUploader.ts
server/services/adsCreation/sheetReader.ts
server/services/adsCreation/creator.ts
server/services/adsCreation/index.ts
server/routes/ads-creation.ts
client/src/hooks/useAdsCreation.ts
client/src/components/criativos/criar-campanha/NovaCampanhaSheet.tsx
docs/handover-criar-campanhas-meta.md  ← este arquivo
```

### Modificados
```
shared/schema.ts                 (+ tabela meta_creation_drafts)
server/routes.ts                 (+ registerAdsCreationRoutes)
.env                             (+ META_DEFAULT_*)
.env.example                     (+ docs das envs novas)
client/src/pages/Criativos.tsx   (+ botão "Subir nova campanha")
package.json                     (+ heic-convert)
```

### Carregados da branch base (`feature/otimizacao-de-ads`)
- `server/middleware/requireEmail.ts` (reusado)
- `server/services/adsOptimization/executor.ts` (referência do padrão de retry)

---

## 🔑 CONTEXTOS DO USUÁRIO IMPORTANTES

- **Usuário** (Ichino): pouca experiência com dev, pede pra explicar coisas técnicas em linguagem simples.
- **Sempre pedir permissão antes de commit/push** (mesmo com auto-push no CLAUDE.md).
- **Atalho "preview"** quando ele digitar = `npm run dev` e retornar URL.
- Trabalham com **muitas campanhas** — escala importa.
- **Padrão de fluxo:** raramente criam campanha nova; **adicionam conjuntos+ads em campanhas existentes** (por isso o modo "existente" é prioridade).
- Dois aprovadores: `vinicius.ichino@turbopartners.com.br` e `warleyreserva4@gmail.com`. `ferramentas@turbopartners.com.br` (Ichino) também tem acesso.

---

## 📌 PRÓXIMOS PASSOS RECOMENDADOS

Em ordem de prioridade:

1. **Validar Biblioteca de Criativos end-to-end** — rodar migration + grant, conferir contagem total bater com Sheet, criar+editar+apagar criativo de teste, subir uma campanha PAUSED real e confirmar Nome Final.
2. **Apagar `server/services/adsCreation/sheetReader.ts`** após item 1 — sem referências externas hoje, espera só a validação E2E.
3. **Resolver pendência (agrupar posicionamentos Feed/Reels/Stories)** — ajuste pequeno em `creator.ts`.
4. **Resolver pendência (abreviação de público no nome do conjunto)** — definir regra com usuário.
5. **Replicar variáveis no `.env` de produção** (Replit) — `META_DEFAULT_*` ainda só em local.
6. **Rodar migration e grant em produção** depois do item 1 passar local.
7. **Implementar upload em massa** (plano em `upload-massa-meta-ads.md`) — agora muito mais simples já que toda a referência de Nome Final está no banco.
8. **Submeter App Review na Meta** — burocracia, mas multiplica quota por 10x.
9. **Considerar queue interna** quando upload em massa estiver pronto.

---

## 💬 COMO RETOMAR ESTA TAREFA

Numa nova conversa, basta dizer algo como:

> Continuando feature de subir campanhas Meta Ads. Branch `feature/criar-campanhas-meta-ads`. Confere o handoff em `docs/handover-criar-campanhas-meta.md` e me ajuda com [próximo passo].

A memória do projeto também tem entradas relevantes em `MEMORY.md`:
- `project_criar_campanhas_meta.md`
- `project_criar_campanhas_pendencias.md`
