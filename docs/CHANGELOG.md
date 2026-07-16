# Changelog

## 2026-07-16 | feat(ads): scripts pareados GENÉRICOS + lote "UGC x Anúncios Tradicionais - Victor" (TP1855-1874) — 4 conjuntos + 20 ads PAUSED

**O que foi feito:**
- **Novo: scripts pareados genéricos** `subir-pareado-{planilha,upload,ads}.ts` que recebem `--data <lote>.data.ts` (em vez de duplicar por lote). Trazem retry por vídeo no upload + `fixTargeting` (par explore/explore_home). Reutilizáveis pra qualquer lote pareado 9x16+4x5.
- **UGC Victor:** 20 pares (b1/b2 × h1-10), funil Creators. Upload 40/40 (~110MB), 0 falhas, 35,8min. **4 conjuntos (9-12)** na camp QUENTE Creators `120252335029070450` (irmã dos lotes Esther/Lucas UGC), 20 ads pareados, copy clonada do irmão Esther (conjunto 1 `120252808697040450`). **TUDO PAUSED.**
- Data files: `ugc-victor.data.ts` + `crm-victor.data.ts` (CRM Victor com upload em andamento — arquivos de 400MB).

**Por que:** os 2 batches do Victor que faltavam (UGC Tradicionais + CRM Cliente Novo). Caio mandou as pastas.

**Arquivos alterados:** `scripts/ads/subir-pareado-{planilha,upload,ads}.ts` + `ugc-victor.data.ts` + `crm-victor.data.ts` (novos).

**Impacto arquitetural:** scripts CLI genéricos reutilizáveis (passo na direção da automação); nenhum runtime.

## 2026-07-13 | feat(ads): lote "Areia Movediça" (Victor Peixoto, TP1843-1854) — 3 conjuntos + 12 ads single-format PAUSED

**O que foi feito:**
- **Biblioteca:** 12 criativos single-format (TP1843-1854), persona Peixoto, hooks 1-12, funil Creators.
- **Upload:** 12 vídeos (~220MB cada) via API — MUITO flaky (vídeos grandes, ~7 passadas idempotentes com retry por vídeo; o h12 resistiu ~6× até subir). Fechou 12/12.
- **Meta:** 3 conjuntos na campanha de teste CBO Creators `120249141209100450` (existente, PAUSED): **174** `120253080726800450` [h01-05, 5 ads], **175** `120253080746030450` [h06-10, 5], **176** `120253080758610450` [h11-12, 2] — **12 ads single-video, TUDO PAUSED.** Copy clonada do irmão 173 (`120252947833910450`, Creators UGC "A Turbo entrega os anúncios UGCs...", link `/creators/`) — a pedido do Caio ("aproveita a copy dos que já estão no Gerenciador").
- Scripts com o mesmo padrão single-format do Ismael/João + `fixTargeting` (par explore/explore_home) + retry no upload.

**Por que:** Caio pediu a subida do lote Areia Movediça (Victor); a task estava "complete" no ClickUp mas os ads nunca tinham subido.

**Arquivos alterados:**
- `scripts/ads/areia-movedica.data.ts` (novo) + `subir-areia-movedica-{planilha,upload,ads}.ts` (novos)

**Impacto arquitetural:** Nenhum em runtime — scripts CLI avulsos (tsx), idempotentes.

## 2026-07-13 | feat(ads): CONCLUI lote CRM "Cliente Novo x Base" (Lucas, TP1825-1842) — 4 conjuntos + 18 ads PAUSED

**O que foi feito:**
- Retomado quando a rede do ambiente voltou (07-10→07-12 estava caindo com `fetch failed`). Upload completou **36/36 vídeos** em passadas idempotentes; adicionei **retry por vídeo** no upload p/ a flakiness ("There was a problem uploading your video"). `b2h9_4x5` subiu 2× (vídeo "processing" não aparece no índice `/advideos` → re-upload); duplicata resolvida por id determinístico.
- **Meta:** 4 conjuntos criados na campanha CBO CRM `120252008224000450` (existente, PAUSED): **159** [b1 h01-05, 5 ads], **160** `120253070383810450` [b1 h06-09, 4], **161** `120253070647620450` [b2 h01-05, 5], **162** `120253070664840450` [b2 h06-09, 4] — **18 ads pareados 9x16+4x5, TUDO PAUSED.** Copy/config clonados do irmão 151.
- **Fix:** o targeting clonado tinha `instagram_positions` com `explore_home` SEM `explore` → POST /adsets 400 code=100; `fixTargeting` adiciona `explore` (mesmo gotcha do lote Summit Empresário; o template `subir-lote-ads.ts` não tinha esse fix). Conta bateu 124% de cota no meio — backoff segurou e completou.

**Por que:** conclusão do lote CRM Lucas que ficou parcial em 07-10 (throttle de upload do dev-tier).

**Arquivos alterados:**
- `scripts/ads/subir-crm-clientenovo-upload.ts` - retry por vídeo (erro transiente de upload)
- `scripts/ads/subir-crm-clientenovo-ads.ts` - `fixTargeting` (par explore/explore_home)

**Impacto arquitetural:** Nenhum em runtime — scripts CLI avulsos (tsx), idempotentes.

## 2026-07-10 | feat(ads): lote "Cliente Novo x Base" (Lucas, CRM) TP1825-1842 — PARCIAL/PAUSADO (throttle de upload dev-tier)

**O que foi feito:**
- **Biblioteca:** 18 criativos PAREADOS cadastrados (TP1825-1842): Lucas, 2 bodies × 9 hooks (b1/b2 h1-9), bases `CRM_ClienteNovo_Lucas_b{b}h{h}` (9x16 primário + 4x5 na observação).
- **Upload:** só **11/36 vídeos** subiram (~150MB cada). Os 25 restantes falharam com **throttle SOFT de upload** da Meta (`"There was a problem uploading your video"` / Request Timeout — NÃO é o 80004). A conta dev-tier apanhou dos lotes do dia (Ismael/João + esse) e 36 vídeos de uma vez estourou; insistir piora (passada 1 = 11 ok, passada 2 = 0).
- **Meta:** NADA criado ainda (0 conjuntos/0 ads). A trava `totalAds` do script de ads impede criar lote incompleto.
- **Scripts:** `crm-clientenovo.data.ts` + `subir-crm-clientenovo-{planilha,upload,ads}.ts` (pareado, split b1/b2 × h01-05/h06-09, CBO-safe, idempotentes).

**Plano (padrão CRM Recompra):** campanha CBO teste CRM `120252008224000450` (existente, PAUSED), 4 conjuntos, 18 ads pareados, copy clonada do irmão 151, tudo PAUSED.

**Runbook pra retomar (quando a cota de upload esfriar):** (1) `subir-crm-clientenovo-upload.ts --go` (completa os 25 → 36/36); (2) `subir-crm-clientenovo-ads.ts` DRY→`--go`.

**Por que:** Caio pediu a subida do lote CRM Lucas; PAUSADO a pedido dele até a cota de upload da Meta resetar.

**Impacto arquitetural:** Nenhum em runtime — scripts CLI avulsos (tsx), idempotentes.

## 2026-07-10 | feat(ads): lote "Captação Creators - Ismael/João" (TP1819-1824) — campanha CBO NOVA + 6 ads single-format via API

**O que foi feito:**
- **Biblioteca:** 6 criativos cadastrados (TP1819-1824): Ismael h1-3, João h1-3. single-format (1 vídeo 9x16 por criativo).
- **Upload:** 6 vídeos (~62-88MB cada) baixados do Drive e subidos via `metaUploadVideo` chunked em 3,7min, 0 falhas. Título no Meta = `${base}_9x16`.
- **Meta:** campanha CBO **NOVA** `[TP] [Leads] [CBO] [Teste] [Creators] - Captação Ismael/João` (`120252987708910450`), OUTCOME_LEADS, **R$30/dia (orçamento na CAMPANHA — CBO)**, config/otimização/pixel (`1375902709765726`) clonados do conjunto-irmão Broad Creators (`120252947833910450`). 2 conjuntos: **1 [Ismael]** (`120252987709480450`, 3 ads) + **2 [João]** (`120252987735860450`, 3 ads). Link `creators-turbo.lovable.app`, CTA LEARN_MORE. **TUDO PAUSED — campanha, conjuntos E ads.**
- **Copy POR CREATOR:** o Doc trazia legenda distinta por creator (Ismael 40-50 / João 25-35) → preenchidas em `COPY_ISMAEL` / `COPY_JOAO` (não a copy compartilhada). Ads single-video usam `object_story_spec.video_data` clássico (evita rejeição de Dynamic Creative).

**Por que:**
- O lote estava "engatilhado" (commit `be3d2d54`) travado só na copy; Caio mandou o Doc e liberou. 1º uso do caminho full-auto (Drive→upload→**campanha nova**) numa CBO single-format.

**Arquivos alterados:**
- `scripts/ads/creators-cbo.data.ts` - copy preenchida (`COPY_ISMAEL` / `COPY_JOAO`)

**Impacto arquitetural:** Nenhum em runtime — scripts CLI avulsos (tsx), idempotentes.

## 2026-07-09 | feat(ads): lote "5 - Creators Summit - Camila/Jaque + Quebra de Objeções" (TP1799-1818) — 1º lote single-format via API

**O que foi feito:**
- **Biblioteca:** 20 criativos cadastrados (TP1799-1818): Camila h1-4, Jaque h1-4, Quebra de Objeções CAIXA 01-06 × CTA 01/02. **single-format** — 1 vídeo 9x16 por criativo (corte "Editado" vertical), diferente dos lotes anteriores que vinham pareados 9x16+4x5.
- **Upload:** 20 vídeos (~1.9GB) baixados do Drive e subidos via `metaUploadVideo` chunked em 10,4min, 0 falhas. Título no Meta = `${base}_9x16`.
- **Meta:** 4 conjuntos novos na camp `[TP] [Vendas] [CBO] [Quente] [Summit] - Teste de criativos` (`120251818147660450`): **18 [Camila]** (`120252946752660450`, 4 ads), **19 [Jaque]** (`120252946929760450`, 4 ads), **20 [Quebra de Objeções] CTA 01** (`120252946955780450`, 6 ads), **21 CTA 02** (`120252946996450450`, 6 ads). Config+copy/link/UTM/pixel clonados do conjunto 12 Empresário. **TUDO PAUSED — conjuntos E ads.**
- Scripts do lote (`subir-summit-cjo-{planilha,upload,ads}.ts`) + inventário compartilhado (`summit-cjo.data.ts`), DRY por padrão e idempotentes.

**Dois aprendizados (gotchas) do dia, resolvidos:**
- **Drive 404 no download:** as pastas novas (Camila/Jaque/quebra de objeções, num Drive Compartilhado) NÃO estavam compartilhadas com a conta de serviço que o script usa pra baixar (`report-job-sa@auto-report-turbo.iam.gserviceaccount.com`) → 404 nos 20. Lotes anteriores já vinham com o robô liberado; estes não. Fix: compartilhar as pastas-mãe (`Criativos - UGC` e `TURBO_quebradeobjecoes`) como Leitor com o robô. Não há API/MCP pra setar permissão — foi manual.
- **Criativo single-video:** um `asset_feed_spec` "pelado" (1 vídeo, sem `asset_customization_rules`) a Meta trata como **Dynamic Creative** e recusa em conjunto não-dinâmico (`code=100 Dynamic Creative ads can only be created under Dynamic Creative Ad Sets`). Fix: usar `object_story_spec.video_data` clássico + `image_url` (thumbnail via `getVideoThumbnail`), mesmo padrão da produção (`creator.ts`).

**Por que:**
- Caio pediu a subida completa das 4 pastas do Drive na camp de teste CBO do Summit. É o 1º lote 100% single-format e valida esse caminho pro futuro pipeline automático.

**Arquivos alterados:**
- `scripts/ads/summit-cjo.data.ts` - inventário compartilhado dos 20 criativos + estrutura dos 4 conjuntos (novo)
- `scripts/ads/subir-summit-cjo-{planilha,upload,ads}.ts` - os 3 passos do lote (novos)

**Impacto arquitetural:** Nenhum em runtime — scripts CLI avulsos (tsx), DRY por padrão, idempotentes.

## 2026-07-07 | feat(ads): lote "4 - Creators Summit - Creator" (TP1793-1798) — planilha + upload via API + ads na camp Teste de criativos Summit

**O que foi feito:**
- **Biblioteca:** 6 hooks pareados (Victor h1-3 = TP1793-1795, Lucas h1-3 = TP1796-1798) cadastrados, 1 linha/TP, produto=Creators, primário 9x16 + 4x5 na observação.
- **Upload:** 12 vídeos GRANDES (~580-760MB cada, ~7,7GB total) baixados do Drive e subidos via `metaUploadVideo` chunked em 36,1min, 0 falhas — valida o fluxo 100% API também pra arquivos de +700MB (Esther/Lucas UGC eram ~125MB).
- **Meta:** 2 conjuntos novos na camp `[TP] [Vendas] [CBO] [Quente] [Summit] - Teste de criativos` (`120251818147660450`, a MESMA do lote Empresário — campanha escolhida pelo Caio via pergunta): **16 [Victor]** (`120252865990690450`) e **17 [Lucas]** (`120252866012040450`), 6 ads pareados 9x16+4x5 via asset_feed_spec. Config+copy/link/UTM clonados do conjunto 12 do Empresário (copy real Summit ES, pixel PURCHASE, IG-only). **TUDO PAUSED — conjuntos E ads.**

**Por que:**
- A pasta do lote Creator tem estrutura idêntica à do Empresário e nunca tinha passado pelo fluxo (confirmado pelo `checa-summit-creator.ts`). Caio pediu a subida completa: planilha + Gerenciador.

**Arquivos alterados:**
- `scripts/ads/subir-summit-creator-{planilha,upload,ads}.ts` - os 3 passos do lote (novos)

**Impacto arquitetural:** Nenhum em runtime — scripts CLI avulsos (tsx), DRY por padrão, idempotentes.

## 2026-07-07 | chore(ads): checagem read-only do lote "Creators Summit - Creator" — NÃO subido

**O que foi feito:**
- `scripts/ads/checa-summit-creator.ts` (novo, read-only): cruza o lote Drive `4 - Creators Summit - Creator` (Victor h1-3 + Lucas h1-3, `Summit_Creator_*`, 12 vídeos pareados 9x16+4x5) com a Biblioteca (por `driveFileId` e por nome) e com o Gerenciador (`/advideos` com early-exit por data de criação).
- Resultado: **0 linhas na Biblioteca e 0/12 vídeos no Gerenciador** — o lote Creator nunca passou pelo fluxo (não confundir com o lote 3 "Empresário", TP1745-1750, subido em 03/07).

**Por que:**
- Caio pediu confirmação se o lote da pasta já tinha sido subido antes de decidir o próximo passo. A pasta tem a MESMA estrutura do Empresário (Victor/Lucas × 9x16/4x5 × Body 1 Cta 1), fácil de confundir.

**Arquivos alterados:**
- `scripts/ads/checa-summit-creator.ts` - checagem read-only (novo)

**Impacto arquitetural:** Nenhum — script CLI avulso (tsx), só leitura.

## 2026-07-06 | feat(ads): lotes Esther UGCs (TP1751-1770) e Lucas UGC (TP1771-1792) — 1º fluxo 100% via API, do Drive ao ad ativo

**O que foi feito:**
- **Lote Esther "UGCs x Anúncios"**: 20 hooks pareados (b1/b2 × h1-h10) cadastrados na Biblioteca (TP1751-1770), 40 vídeos (~125MB) baixados do Drive e subidos pro Gerenciador via `metaUploadVideo` chunked (40,8min, 0 falhas) e 4 conjuntos (1-4, split h01-05/h06-10 por body) com 20 ads pareados 9x16+4x5 na campanha CBO QUENTE Creators (`120252335029070450`).
- **Lote Lucas "UGC x Anúncios"**: 22 hooks pareados (b1/b2 × h1-h11) na Biblioteca (TP1771-1792), 44 vídeos subidos (27,6min, 0 falhas) e 4 conjuntos (5-8, split 5+6: h01-05/h06-11) com 22 ads na mesma campanha.
- Scripts por lote (`subir-{esther-ugcs,lucas-ugc}-{planilha,upload,ads}.ts`): campanha resolvida PELO NOME (não por ID fixo), copy/config clonados do conjunto irmão de maior NN com ads, posições do criativo derivadas do targeting clonado (IG-only vs FB+IG), tudo DRY por padrão e idempotente (re-run pula o que existe).
- **Regra nova no `--activate`: ativa SÓ os ads — conjunto NUNCA é ativado por script** (ligar conjunto é decisão manual do Caio no Gerenciador). Estado final dos dois lotes: 42 ads ACTIVE dentro de 8 conjuntos PAUSED.

**Por que:**
- Primeira vez que o fluxo completo (planilha → upload de vídeo → conjuntos/ads → ativação) roda 100% via API, sem upload manual no Gerenciador. Upload de vídeo em produção valida o `metaUploadVideo` chunked pro pipeline automático semanal.
- A regra do conjunto pausado nasceu de incidente real: o primeiro `--activate` ligou os 4 conjuntos da Esther junto com os ads e o gasto começou sem aprovação manual.

**Arquivos alterados:**
- `scripts/ads/subir-esther-ugcs-{planilha,upload,ads}.ts` - lote Esther (novos)
- `scripts/ads/subir-lucas-ugc-{planilha,upload,ads}.ts` - lote Lucas (novos)

**Impacto arquitetural:** Nenhum em runtime — scripts CLIs avulsos (tsx). Padrão novo pros próximos lotes: upload via API + ativação só de ads.

## 2026-06-30 | chore(scripts): move 42 scripts one-off de ads da raiz p/ scripts/ads/

**O que foi feito:**
- Movidos 42 scripts operacionais de ads (`subir-*`, `reestruturar-*`, `renumerar-*`, `reordenar-*`, `checar-*`, `inspecionar-*`, `limpa-*`, `verificar-*`, `smoke-upload`, `status-meta-api`, `pipeline-clickup-ads`) da raiz do repo para `scripts/ads/`, via `git mv` (histórico preservado).
- Imports relativos `./server/...` reescritos para `../../server/...` (estáticos + um `import()` dinâmico no `reestruturar-crm-flash.ts`). Aliases `@shared/*`/`@/*` são absolutos (baseUrl `.`) → intocados.
- Exemplos de uso (`npx tsx ...`) atualizados nas duas ferramentas vivas (`subir-lote-ads.ts`, `pipeline-clickup-ads.ts`) para o novo caminho.

**Por que:**
- A raiz estava poluída com ~42 scripts "rode uma vez" (snapshots de lote), misturados aos configs do projeto. Não são load-bearing (não estão no `package.json`, ninguém importa, fora do `tsconfig`/build). Agora a raiz só tem configs e os scripts seguem a convenção da pasta `scripts/` que já existia.

**Arquivos alterados:**
- `scripts/ads/*.ts` - 42 scripts movidos + imports corrigidos
- raiz: removidos os 42 (mantidos só `*.config.ts` + `vitest.setup.ts`)

**Impacto arquitetural:** Nenhum em runtime — scripts são CLIs avulsos (tsx), fora do app/build. Invocação muda de `npx tsx subir-x.ts` para `npx tsx scripts/ads/subir-x.ts`.

## 2026-06-30 | feat(ads-automation): agente semanal de subida de ads + painel read-only

**O que foi feito:**
- Novo job in-process `server/services/adsAutomationJob.ts` que roda toda segunda (≥8h, TZ do processo): planeja os lotes das subtasks "Subir ad" em `to do` no ClickUp, cria o conjunto (PAUSED) clonando o template com a nomenclatura certa, descobre os vídeos já no Gerenciador e cria os anúncios pareados (PAUSED). Vídeo faltando / cota dev-tier → `awaiting_manual_upload` (retoma no próximo run).
- Trigger do `adsPipeline` adaptado: status real `to do`, campos lidos da **task mãe** (subtasks "Subir ad" vêm vazias), dedup por mãe, gatilho por nome (`/subir/i`) OU assignee Caio (111964992); `executeLote` ganhou flags p/ a automação controlar o ClickUp (status só vai p/ `upado` quando o lote fecha).
- Tabelas `cortex_core.ads_automation_runs` (1/semana, `week_of` UNIQUE) e `ads_automation_steps` (1/lote, `plan_snapshot`+`bookmark` p/ retomar) + migration idempotente.
- API read-only `GET /api/ads-automation/{runs, runs/:id, next}` + disparo admin `POST /api/admin/ads-automation/run`.
- Painel `/growth/ads-automacao` (seção Growth): "Agora / Vai fazer / Já fez" do run + histórico, polling, dark/light. Só visualização (sem botões de operar).
- Agendamento in-process (guarda horária + `recoverOnStartup`) no padrão dos snapshots de inadimplência/saldo; idempotência semanal.

**Por que:**
- A subida de ads toda segunda era 100% manual (biblioteca → baixar → subir no Gerenciador → nomear). Automatiza o fluxo reaproveitando o pipeline existente e dá visibilidade do agente dentro do Cortex.

**Arquivos alterados:**
- `server/services/adsAutomationJob.ts` - novo job/orquestrador semanal
- `server/services/adsPipeline/{config,clickupClient,pipeline}.ts` - trigger `to do` + mãe + dedup + `planAutomationLotes`
- `server/routes/adsAutomation.ts` + `server/routes.ts` - API read-only
- `server/index.ts` - wiring do job
- `shared/schema.ts` + `migrations/2026-06-30-ads-automation.sql` - tabelas de rastreamento
- `client/src/pages/AdsAutomationRuns.tsx`, `client/src/App.tsx`, `shared/nav-config.ts` - painel + rota + permissão

**Impacto arquitetural:** Adiciona um job agendado in-process e duas tabelas em `cortex_core`; reusa o pipeline ClickUp→Meta existente. Execução real fica atrás de `ADS_PIPELINE_DRY_RUN=0` (default seguro) e requer `TZ=America/Sao_Paulo` + tokens Meta/ClickUp.

---

## 2026-06-30 | chore(distribuicao): clona 4 conjuntos (74-77) lote 30/06 na camp Distribuição de Conteúdo

**O que foi feito:**
- `subir-distribuicao-conjuntos.ts`: atualizado o `CONTENTS` p/ o lote de 30/06 (4 tasks "Impulsionar conteúdo" do Caio, due hoje) e clonados 4 conjuntos na camp `Distribuição de Conteúdo` (`120211269781870450`): **74** Afiliado Tiktok (`120252593100580450`), **75** Como criar um perfil no tiktok do zero (`120252593102800450`), **76** Roas alto? Travou nos 50k? (`120252593104100450`), **77** O maior evento sobre criação de conteúdo do ES (`120252593105420450`) — todos PAUSED
- Clone shallow do Bali (`120243474649070450`, só config, sem ad) via `/copies deep_copy:false`; nome `{NN} - [IG] [Aberto] {conteúdo}`

**Por que:**
- Fluxo recorrente de impulsionar conteúdo orgânico; conteúdo de cada conjunto vem da task-mãe (parent) de cada subtask no ClickUp (lista Instagram 📷)
- ⚠️ O **ad** (selecionar o post orgânico do IG) continua sendo feito na UI pelo Caio — o token Meta segue só com `ads_management`/`business_management` (sem `instagram_basic`/`pages_read_engagement`), então puxar/selecionar post orgânico falha por API

**Arquivos alterados:**
- `subir-distribuicao-conjuntos.ts` - lista `CONTENTS` do lote 30/06

**Impacto arquitetural:** Nenhum — só atualização de dados de input do script existente.

---

## 2026-06-29 | feat(ads-creation): módulo lotUploader (batch + thumb + descoberta estrita) p/ lotes manuais

**O que foi feito:**
- `server/services/adsCreation/lotUploader.ts`: helpers reutilizáveis pro fluxo "sobe esses ads" (vídeos subidos à mão no Gerenciador), trazendo-o pro mesmo padrão saudável da produção (`creator.ts`) — objetivo: **menos chamadas + taxa de erro ~0** (saúde pro upgrade de tier):
  - **Descoberta ESTRITA** por nome exato (`<base>_9x16`/`<base>_4x5`) com **EARLY-EXIT** na paginação de `advideos` (para na 1ª página quando os vídeos são recentes) — não confunde famílias parecidas (`*_react_*` sem `_v2`, `creators_summit_lucas_h10_b*`, etc.) e escolhe id determinístico em duplicatas
  - **Criação em BATCH** (`[creative, ad]` por ad via `metaBatch`) em vez de 2 calls/ad
  - **Pré-busca de thumbnail** + `thumbnail_url` no creative → previne o `code=100` "problem uploading your video thumbnail" (que tomamos no lote Summit React); + **retry transitório** (regex inclui "please try again") + **fallback de Instagram**
  - Lógica pura (index/match/montagem de batch) separada e **testada** (17 testes)
- `test/services/lotUploader.test.ts`: 17 testes (match estrito ignora famílias parecidas, dedup determinístico, par faltando, early-exit set, thumbnail_url, montagem de batch com `{result=...}`+`depends_on`, chunking ≤25 ads, regex transitório/rate-limit) — **todos passando**, `tsc` limpo
- `subir-lote-ads.ts`: **template config-driven** (edita só faixa de TP + campanha + tema) que consolida os `subir-*-ads.ts` soltos usando o módulo, com DRY padrão e idempotência

**Por que:**
- Usuário quer subir o tier da Marketing API de forma saudável e rápida; o gate é a taxa de erro (já <1%) + volume de chamadas. A produção já batcheia, mas os scripts soltos de lote faziam call-por-ad e não pré-buscavam thumb (causa do único erro do dia). Este módulo fecha essa lacuna

**Não testado ao vivo nesta sessão:** API estava em ~106% (recuperando); validação por `tsc` + 17 testes unitários. O caminho de rede reusa o padrão de `metaBatch` já comprovado em `creator.ts`. DRY ao vivo pendente pra quando a janela de rate-limit limpar.

**Arquivos novos:**
- `server/services/adsCreation/lotUploader.ts` - helpers de descoberta + criação em batch
- `test/services/lotUploader.test.ts` - 17 testes unitários
- `subir-lote-ads.ts` - template de subida de lote

**Impacto arquitetural:** Novo módulo de serviço reutilizável; não altera o pipeline de produção existente. Scripts de lote passam a ter um caminho único, testado e econômico em quota.

---

## 2026-06-29 | feat(ads-creation): sobe 5 ads Estratégia Peculiar React V2 (Lucas) no conjunto 173 na CBO Creators

**O que foi feito:**
- `subir-react-v2-ads.ts`: cria **1 conjunto** na camp CBO Creators teste (`120249141209100450`), **PAUSED**, com 5 ads pareados 9x16+4x5 via `asset_feed_spec`:
  - **173** `120252544356900450` — [Lucas] Estratégia Peculiar React V2 (5 ads): TP1740 (`…360480450`), TP1741 (`…364760450`), TP1742 (`…367090450`), TP1743 (`…371860450`), TP1744 (`…375970450`)
- **Match de vídeo ESTRITO** pelo nome exato (`<base>_9x16`/`<base>_4x5`) — crítico porque o Gerenciador tem `Estrategia_peculiar_react_*` SEM o `_v2` (outro lote); **paginação com EARLY-EXIT** (achou os 10 vídeos em 1 página) pra poupar rate-limit
- Clona config (otim/billing/pixel/atribuição/targeting/destination_type) + copy/link/CTA/UTM do irmão **142** (placeholder Creators, link `pages.turbopartners.com.br/creators/`); idempotente por sufixo do conjunto + TP do ad
- **Rate-limit:** conta foi de 92%→**110%** durante o run; as escritas passaram mesmo assim (confirma "writes passam"), mas ao final ficou throttled com `estimated_time_to_regain_access=17min`

**Por que:**
- Usuário avisou que os vídeos do React V2 já estavam no Gerenciador e pediu pra subir os ads (pausados)

**Arquivos novos:**
- `subir-react-v2-ads.ts` - criação do conjunto + 5 ads pareados (DRY por padrão, `--go`, idempotente, match estrito, early-exit na busca de vídeo)

**Impacto arquitetural:** Nenhum — script standalone na raiz, mesmo padrão do `subir-summit-react-ads.ts`.

---

## 2026-06-29 | feat(ads-creation): cadastra 5 hooks Estratégia Peculiar React V2 (TP1740-1744) na Biblioteca

**O que foi feito:**
- `subir-react-v2-planilha.ts`: cadastra na Biblioteca os 5 hooks do lote `60 - Estratégia Peculiar React V2 / 01 - Editados` — persona **Lucas** (h1–h5), b1c1, **1 linha/TP por hook pareado** (9x16 stories + 4x5 feed) → **TP1740–TP1744**
- Cada linha: `nome_drive` = base do arquivo (`Estrategia_peculiar_react_v2_Lucas_hNb1c1`), `produto=Creators`, `plataforma=Meta`, `tipo=Vídeo`, `personagem=Lucas`, funil vazio; primário (`drive_file_id`+`link_drive`) = o **9x16**, e o **4x5** (link + file_id) na `observacao`
- `status-meta-api.ts`: ferramenta read-only de status da Marketing API (1 GET barato lendo `x-business-use-case-usage` / `x-ad-account-usage` + status/saldo da conta). No momento: conta ativa (status=1), uso `ads_management` em **92%** (time), liberar em 0min

**Por que:**
- Usuário pediu pra cadastrar o lote na planilha (vídeos já subindo no Gerenciador) e perguntou o status da API do Meta

**Arquivos novos:**
- `subir-react-v2-planilha.ts` - cadastro dos 5 hooks (DRY por padrão, `--go`, idempotente por `drive_file_id`)
- `status-meta-api.ts` - status/uso da Marketing API (read-only, 1 chamada)

**Impacto arquitetural:** Nenhum — scripts standalone na raiz, mesmo padrão dos `subir-*-planilha.ts`.

---

## 2026-06-29 | feat(ads-creation): sobe 9 ads Creators Summit React em 2 conjuntos (Esther/Lucas) na CBO Creators

**O que foi feito:**
- `subir-summit-react-ads.ts`: cria **2 conjuntos** na camp CBO Creators teste (`120249141209100450`), **1 por persona** (máx 5 ads/conjunto), com ads pareados 9x16+4x5 via `asset_feed_spec`, tudo **PAUSED**:
  - **171** `120252543545770450` — [Esther] Creator Summit React (4 ads): TP1731 (`…550390450`), TP1732 (`…555160450`), TP1733 (`…561880450`), TP1734 (`…568540450`)
  - **172** `120252543570290450` — [Lucas] Creator Summit React (5 ads): TP1735 (`…572930450`), TP1736 (`…580280450`), TP1737 (`…611760450`), TP1738 (`…618280450`), TP1739 (`…636100450`)
- **Match de vídeo ESTRITO** pelo nome EXATO do arquivo (`<base>_9x16` / `<base>_4x5`): o Gerenciador tinha várias famílias parecidas (`creators_summit_lucas_h1..h10_b1..b3_c1`, `Estrategia_peculiar_react_*`, `Mockup_caprichado_react_*`, `vv-creatorssummit-*`) que um match permissivo casava errado (h10→h1, b2/b3). Duplicatas do mesmo nome (os 4x5 da Esther estavam subidos 3×) → escolhe id determinístico (menor)
- Clona config (otim/billing/pixel/atribuição/targeting/destination_type) + copy/link/CTA/UTM do irmão **142 Processo Bready** (placeholder Creators, link `pages.turbopartners.com.br/creators/`); idempotente por sufixo do nome do conjunto + TP do ad
- **Erro transitório** code=100 "problem uploading your video thumbnail" no TP1737 no 1º run (Meta gerando thumb do vídeo) → re-run idempotente completou os 3 ads restantes. Conta chegou a 91% de uso, sem travar

**Por que:**
- Usuário pediu pra subir os ads (vídeos já no Gerenciador) pausados; estrutura = máx 5 ads/conjunto → 1 conjunto por persona (Esther 4, Lucas 5); pediu pra VERIFICAR contra Drive+planilha antes de subir (o que pegou o match permissivo errado)

**Arquivos novos:**
- `subir-summit-react-ads.ts` - criação dos 2 conjuntos + 9 ads pareados (DRY por padrão, `--go`, idempotente, match estrito)
- `inspecionar-summit-react.ts` - verify read-only (cruza planilha × Gerenciador com match estrito + reporte de duplicatas)

**Impacto arquitetural:** Nenhum — scripts standalone na raiz, mesmo padrão do `subir-caio-roteiros-ads.ts` / `subir-victor-ads.ts`.

---

## 2026-06-29 | feat(ads-creation): cadastra 9 hooks Creators Summit React (TP1731-1739) na Biblioteca

**O que foi feito:**
- `subir-summit-react-planilha.ts`: cadastra na Biblioteca os 9 hooks do lote `1 - Creators Summit React / 01 - Editados` — personas **Esther** (h1–h4) e **Lucas** (h1–h5), b1c1, **1 linha/TP por hook pareado** (9x16 stories + 4x5 feed), na ordem Esther h1..h4 → Lucas h1..h5 → **TP1731–TP1739**
- Cada linha: `nome_drive` = base do arquivo (ex.: `Creator_Summit_React_Esther_h1b1c1`), `produto=Creators`, `plataforma=Meta`, `tipo=Vídeo`, `personagem`=Esther/Lucas, funil vazio; primário (`drive_file_id`+`link_drive`) = o **9x16**, e o **4x5** (link + file_id) na `observacao` (com tema "Creator Summit React")

**Por que:**
- Usuário pediu pra preencher a planilha (Biblioteca) com os dois personagens (Esther e Lucas) do lote Creators Summit React, antes de subir os ads

**Arquivos novos:**
- `subir-summit-react-planilha.ts` - cadastro dos 9 hooks (DRY por padrão, `--go` pra gravar, idempotente via dedup por `drive_file_id`)

**Impacto arquitetural:** Nenhum — script standalone na raiz, mesmo padrão do `subir-caio-roteiros-planilha.ts`.

---

## 2026-06-29 | feat(ads-creation): sobe 9 ads Caio pareados em 3 conjuntos (Roteiro 1-3) na CBO Creators

**O que foi feito:**
- `subir-caio-roteiros-ads.ts`: cria **3 conjuntos** na camp CBO Creators teste (`120249141209100450`), **1 roteiro por conjunto**, cada um com **3 ads pareados 9x16+4x5** via `asset_feed_spec`+`asset_customization_rules`, tudo **PAUSED**:
  - **168** `120252533645760450` — Roteiro 1 → TP1722 (`…654800450`), TP1723 (`…660490450`), TP1724 (`…679910450`)
  - **169** `120252533687400450` — Roteiro 2 → TP1725 (`…697720450`), TP1726 (`…755680450`), TP1727 (`…794650450`)
  - **170** `120252533808570450` — Roteiro 3 → TP1728 (`…820500450`), TP1729 (`…842000450`), TP1730 (`…884570450`)
- Auto-descobre os 18 `video_id` no Gerenciador (`R#H#-Caio-(9x16|4x5)`) e pareia por hook; cruza com a Biblioteca (TP1722–1730) por R#H# pra usar o `nome_final` como nome do ad
- Clona config (otimização/billing/pixel/atribuição/targeting/destination_type) do conjunto irmão **142 Processo Bready** e reaproveita copy/link/CTA/UTM de um ad dele (placeholder Creators, link `pages.turbopartners.com.br/creators/`, CTA LEARN_MORE, UTM dinâmico) — refinar a legenda depois já que sobem pausados
- Idempotente: reusa conjunto pelo sufixo do nome (`[Caio] - … - Roteiro N`) e pula ad cujo TP já existe; backoff de rate-limit (writes passaram sem travar)

**Por que:**
- Usuário pediu pra subir os ads (já com os vídeos no Gerenciador) pausados, **um roteiro por conjunto** → 3 conjuntos diferentes

**Arquivos novos:**
- `subir-caio-roteiros-ads.ts` - criação dos 3 conjuntos + 9 ads pareados (DRY por padrão, `--go`, idempotente)
- `inspecionar-caio-roteiros.ts` - sondagem read-only (match dos 18 vídeos + NN/estrutura da campanha)

**Impacto arquitetural:** Nenhum — scripts standalone na raiz, mesmo padrão do `subir-victor-ads.ts` (vídeo pareado) e demais `subir-*-ads.ts`.

---

## 2026-06-29 | feat(ads-creation): cadastra 9 hooks Caio (TP1722-1730) na Biblioteca

**O que foi feito:**
- `subir-caio-roteiros-planilha.ts`: cadastra na Biblioteca os 9 hooks do lote `59 - 3x ads validados re-escritos` (apresentador **Caio**) — roteiros 1–3 × hooks 1–3, **1 linha/TP por hook pareado** (9x16 stories + 4x5 feed), na ordem **R1H1 … R3H3** → **TP1722–TP1730**
- Cada linha: `nome_drive` = base do hook (ex.: `R1H1-Caio`), `produto=Creators`, `plataforma=Meta`, `tipo=Vídeo`, `personagem=Caio`, funil vazio; primário (`drive_file_id`+`link_drive`) = o **9x16**, e o **4x5** (link + file_id) registrado na `observacao` pra não perder o match
- `checar-caio-roteiros.ts`: check read-only que confirmou próximo TP livre (TP1722) e dedup por `drive_file_id` (0/18 já cadastrados)

**Por que:**
- Usuário subindo os vídeos no Gerenciador manualmente e pediu pra preencher a planilha (Biblioteca) em paralelo, com TP correto e na ordem por roteiro→hook

**Arquivos novos:**
- `subir-caio-roteiros-planilha.ts` - cadastro dos 9 hooks (DRY por padrão, `--go` pra gravar, idempotente via dedup por `drive_file_id`)
- `checar-caio-roteiros.ts` - check read-only de próximo TP + dedup

**Impacto arquitetural:** Nenhum — scripts standalone na raiz, mesmo padrão dos `subir-*-planilha.ts` existentes; reusam `createCreative`/`generateNextTpId`.

---

## 2026-06-26 | test(ads-creation): valida metaUploadVideo (Drive → Gerenciador) com smoke test real

**O que foi feito:**
- Auditoria adversarial (workflow multi-agente) do `metaUploadVideo` e cadeia de deps em `server/services/adsCreation/metaApi.ts` antes de qualquer chamada real — veredito **GO**, zero blockers em 5 dimensões (chunked, direto/imagem, retry/rate-limit, config/env, pós-upload)
- `smoke-upload.ts`: smoke test ponta-a-ponta — baixou `vv-naturaltech-esther-1.mp4` (34MB) do Drive, subiu via `metaUploadVideo` (caminho direto, <100MB), `pollVideoUntilReady` confirmou `ready` em ~7s, thumbnail OK (`video_id=27205498122478229`)

**Por que:**
- Provar o passo de upload da pipeline de automação (Drive → Gerenciador) antes de codificar o fluxo completo; até então os vídeos sempre chegavam já no Gerenciador

**Achado não-bloqueante (pra produção):** o caminho **chunked** (vídeos >100MB) só faz retry em `TRANSIENT_HTTP` e não embrulha rate-limit em `MetaRateLimitError` — um 429/code 17 no meio dos chunks não é retriado. Resolver antes de confiar em uploads grandes. Smoke test não afetado (caminho direto).

**Arquivos novos:**
- `smoke-upload.ts` - smoke test de upload de vídeo (DRY por padrão, `--go`, `--cleanup`)

**Impacto arquitetural:** Nenhum — script de teste standalone; reusa helpers existentes (`metaUploadVideo`/`pollVideoUntilReady`/`getVideoThumbnail`) e o Drive client.

---

## 2026-06-25 | feat(ads-creation): sobe 17 estaticos pareados Creator Summit (TP1705-1721) no conjunto 10

**O que foi feito:**
- `subir-summit-estaticos.ts`: sobe os 33 estáticos do Creator Summit (já no Gerenciador) como **17 ads pareados** feed 4x5 + stories 9x16, PAUSED, no conjunto `10` (`120252239374870450`) da camp `[TP] [Vendas] [Quente] [ES] [CBO] [Summit]`
- Pareamento: **palestrantes 1–7** (a #2 sobe só com stories, falta o feed "4_5 2") + **lote numérico A** (arquivos sem "(1)") + **lote numérico B** (arquivos com "(1)") — variantes `(1)` têm hash distinto, são imagens diferentes
- Copy/link/CTA = **padrão da campanha** (body "O maior evento da creator economy do ES", link `pages.turbopartners.com.br/creators-summit-es/`, CTA `LEARN_MORE`, descrição e url_tags herdados dos ads existentes)
- Cada ad registrado na Biblioteca com **TP sequencial** (TP1705–1721); nome do ad no Gerenciador = `nome_final` (`TPxxxx - <base>`)

**Por que:**
- Usuário pediu pra subir os 33 estáticos no conjunto '10' já criado, pareando feed+stories, com TP correto no nome, tudo pausado
- Imagem única (stories órfã) precisou ir como `object_story_spec.link_data` — `asset_feed_spec` de 1 asset sem `asset_customization_rules` é tratado como Dynamic Creative e quebra em conjunto normal (erro `code=100`, mesmo gotcha do lote Natural tech)

**Arquivos novos:**
- `subir-summit-estaticos.ts` - upload dos estáticos pareados (DRY por padrão, `--go` pra criar, idempotente via tag de hashes na observacao + nome TP no conjunto, backoff de rate-limit)

**Impacto arquitetural:** Nenhum — script standalone na raiz, mesmo padrão dos `subir-*-ads.ts` existentes.

---

## 2026-06-25 | feat(ads-creation): sobe lote Natural tech (Esther/Ichino/Musso) na camp CBO Creators

**O que foi feito:**
- `subir-naturaltech-ads.ts`: sobe os 12 clipes Natural tech (TP1693–1704) como ads de **vídeo único**, PAUSED, na camp CBO Creators teste (`120249141209100450`)
- 3 conjuntos por persona: **165 Esther**, **166 Ichino** (tema "Estratégia peculiar natural tech") e **167 Musso** (tema "Natural tech")
- Cruza Biblioteca × `video_id` no Gerenciador por nome normalizado (12/12 casaram); clona config (otimização OFFSITE_CONVERSIONS, pixel MQL, atribuição 7d/1d, targeting) e copy/link/CTA do conjunto `109 - Roberto - Natural Tech`
- UTMs `hsa_grp`/`hsa_ad` trocados por macros dinâmicos (`{{adset.id}}`/`{{ad.id}}`) em vez de herdar os IDs fixos do Roberto
- `limpa-naturaltech.ts`: deleta o adset órfão vazio gerado na 1ª tentativa e renomeia 166/167/168 → 165/166/167

**Por que:**
- Lote Natural tech estava só na Biblioteca; o usuário pediu pra subir todos os clipes na camp CBO Creators, pausados
- Clipes soltos (sem h/b/c, sem 9x16+4x5) exigem creative clássico `object_story_spec.video_data` — `asset_feed_spec` sem `asset_customization_rules` viraria Dynamic Creative e exigiria adset DCO (erro `code=100`)

**Arquivos novos:**
- `subir-naturaltech-ads.ts` - script de upload dos ads (DRY por padrão, `--go` pra criar, idempotente, backoff de rate-limit)
- `limpa-naturaltech.ts` - cleanup do órfão + renomeação dos conjuntos

**Impacto arquitetural:** Nenhum — scripts standalone na raiz, mesmo padrão dos `subir-*-ads.ts`/`reordenar-crm.ts` existentes.

---

## 2026-06-24 | chore(ads-creation): cadastra clipes Natural tech na Biblioteca (TP1693–1704)

**O que foi feito:**
- `subir-naturaltech-planilha.ts`: cadastra os 12 clipes "Natural tech" das 2 pastas de editados
  - Esther (TP1693–1695) + Ichino (TP1696–1698) — pasta "56 - Estratégia peculiar natural tech"
  - Musso (TP1699–1704) — pasta "57 - Natural tech"
- São clipes soltos **sem h/b/c e sem formato 9x16/4x5** — cadastrados como estão (1 linha/clipe), persona do nome do arquivo, tema da pasta
- TP sequencial (max+1), dedup por driveFileId

**Por que:**
- O usuário confirmou que os links estavam certos e pediu pra cadastrar o Natural tech mesmo sem a estrutura padrão (h/b/c)

**Arquivos novos:**
- `subir-naturaltech-planilha.ts` - cadastro dos clipes Natural tech na Biblioteca

**Impacto arquitetural:** Nenhum — cadastro na Biblioteca (sem Meta API); primeiro lote sem h/b/c/formato.

---

## 2026-06-24 | feat(ads-creation): sobe lote Victor "Bready" na camp CBO Creators (159–164)

**O que foi feito:**
- `subir-victor-ads.ts`: cria os ads do lote Victor "Bready" (TP1666–1692, b1/b2/b3 × h1–h9) na camp CBO Creators teste, padrão Turbo
  - 6 conjuntos (**159–164**), 5 ads/conjunto, split h01–h05 / h06–h09, pareados 9x16+4x5, PAUSED, cta no nome = c1
  - auto-discovery dos video_id no Gerenciador + cruzamento com a Biblioteca (hook/body → TP)
  - clona config do conjunto irmão 142 (Processo Bready) e reaproveita copy/link/UTM do criativo irmão (fallback `object_story_spec.video_data.message` p/ criativos antigos que não usam asset_feed_spec)
  - NN corrido com piso 158 (não colide com 151–158 do CRM); idempotente + backoff
- Validado via DRY (pegou copy vazia na 1ª tentativa → corrigido o fallback antes de escrever)

**Por que:**
- Novo lote (Victor), reaproveitando a copy/link dos Bready que já estão no ar (escolha do usuário)

**Arquivos novos:**
- `subir-victor-ads.ts` - cria os 6 conjuntos + 27 ads do Victor

**Impacto arquitetural:** Nenhum — script one-off de criação de ads via Meta API.

---

## 2026-06-23 | chore(ads-creation): cadastra lote Victor "Bready" na Biblioteca (TP1666–1692)

**O que foi feito:**
- `subir-victor-planilha.ts`: cadastra na Biblioteca os 27 criativos 9x16 do lote "Bready" do Victor (Body1/2/3 × h1–h9), da pasta 9x16 do Drive
- TP1666–TP1692, ordem body→hook, TP sequencial (max+1), persona Victor, tema Bready, sem cta no naming
- Só 9x16 entra na planilha (padrão de sempre)

**Por que:**
- Próximo lote (Victor) — preparar a Biblioteca antes de criar os ads no Meta (que dependem dos vídeos no Gerenciador + campanha alvo)

**Arquivos novos:**
- `subir-victor-planilha.ts` - cadastro do lote Victor na Biblioteca

**Impacto arquitetural:** Nenhum — script one-off de cadastro na Biblioteca (sem Meta API).

---

## 2026-06-23 | feat(ads-creation): sobe lote CRM Recompra b2c2 (h1–h9) — fecha o lote CRM

**O que foi feito:**
- `subir-crm-b2c2.ts` (variante BODY=2,CTA=2 do script com auto-discovery): cria o lote **b2c2** (TP1657–TP1665) na camp CBO FLASH CRM
  - conjunto **157** = `… - CRM Recompra - h01 a h05 | b2 | c2` (TP1657–1661)
  - conjunto **158** = `… - CRM Recompra - h06 a h09 | b2 | c2` (TP1662–1665)
  - ads pareados 9x16+4x5, PAUSED; config clonada do 151; validado via DRY antes do `--go`
- Com isso o lote CRM Recompra fica completo: b1c1, b1c2, b2c1, b2c2 (conjuntos 151–158, 36 ads)

**Por que:**
- Último dos 4 sub-lotes do CRM Recompra (vídeos b2c2 entraram no Gerenciador)

**Arquivos novos:**
- `subir-crm-b2c2.ts` - cria os 2 conjuntos + 9 ads do b2c2

**Impacto arquitetural:** Nenhum — script one-off de criação de ads via Meta API.

---

## 2026-06-23 | feat(ads-creation): sobe lote CRM Recompra b1c2 (h1–h9) com auto-discovery

**O que foi feito:**
- `subir-crm-b1c2.ts`: cria os ads do lote **b1c2** (TP1639–TP1647) na camp CBO FLASH CRM, no padrão Turbo
  - **auto-descobre** os video_id b1c2 no Gerenciador (por título), cruza com a Biblioteca (hook→TP) e calcula o NN sozinho (max dos conjuntos + 1)
  - conjunto **155** = `… - CRM Recompra - h01 a h05 | b1 | c2` (TP1639–1643)
  - conjunto **156** = `… - CRM Recompra - h06 a h09 | b1 | c2` (TP1644–1647)
  - ads pareados 9x16+4x5, PAUSED; config clonada do 151; idempotente + backoff de rate-limit
- Validado via DRY (descobre e imprime o plano sem escrever) antes do `--go`

**Por que:**
- Continuação do lote CRM (b1c2 entrou no Gerenciador); auto-discovery reduz hardcode de IDs e erro de digitação

**Arquivos novos:**
- `subir-crm-b1c2.ts` - cria os 2 conjuntos + 9 ads do b1c2 (com auto-discovery)

**Impacto arquitetural:** Nenhum — script one-off de criação de ads via Meta API.

---

## 2026-06-23 | feat(ads-creation): sobe lote CRM Recompra b2c1 (h1–h9) em 2 conjuntos

**O que foi feito:**
- `subir-crm-b2c1.ts`: cria os ads do lote **b2c1** (TP1648–TP1656, h1–h9) na camp CBO FLASH CRM, no padrão Turbo (5 ads/conjunto)
  - conjunto **153** = `… - CRM Recompra - h01 a h05 | b2 | c1` (TP1648–1652)
  - conjunto **154** = `… - CRM Recompra - h06 a h09 | b2 | c1` (TP1653–1656)
  - ads pareados 9x16+4x5, PAUSED; config clonada do conjunto 151; vídeos b2c1 já no Meta (subidos 23/06)
- Idempotente (reusa conjunto pelo nome, pula ad existente) + backoff de rate-limit (quota dev-tier saturada, ~300%)

**Por que:**
- O usuário pediu pra subir o b2c1 (já estava na Biblioteca; só faltava criar os ads no padrão de conjuntos)

**Arquivos novos:**
- `subir-crm-b2c1.ts` - cria os 2 conjuntos + 9 ads do b2c1

**Impacto arquitetural:** Nenhum — script one-off de criação de ads via Meta API.

---

## 2026-06-23 | feat(ads-creation): reestrutura CRM Recompra b1c1 p/ 5 ads/conjunto (padrão ABO Creators)

**O que foi feito:**
- `inspecionar-abo-creators.ts` (read-only): mapeou a estrutura/nomenclatura da camp ABO Creators teste — split por hook (h01–h05 / h06–h09), `[IG] [Aberto] [Stories & Feed & Reels] [Personagem] - Tema - hooks | bN | cN`, NN como contador corrido (último = 150)
- `reestruturar-crm-flash.ts`: corrige a estrutura na camp CBO FLASH CRM (antes tudo num conjunto só) p/ **5 ads por conjunto**:
  - conjunto **151** = reaproveita o pré-setado renomeado, mantém TP1630–1634 (h1–h5)
  - conjunto **152** = novo (clona a config do pré-setado), recebe TP1635–1638 (h6–h9)
  - como a API da Meta não move ad entre conjuntos, recria no destino e deleta da origem (cria-antes-de-deletar); idempotente + backoff de rate-limit

**Por que:**
- A primeira subida pôs os 9 ads num conjunto único, fora do padrão Turbo. O padrão é 5 ads/conjunto com a nomenclatura da ABO Creators teste

**Arquivos novos:**
- `inspecionar-abo-creators.ts` - read-only da estrutura da ABO Creators teste
- `reestruturar-crm-flash.ts` - split do lote b1c1 em 2 conjuntos no padrão

**Impacto arquitetural:** Nenhum — scripts one-off de leitura/criação via Meta API.

---

## 2026-06-22 | feat(ads-creation): lote completo b1c1 (h1–h9) do CRM Recompra na camp FLASH CRM

**O que foi feito:**
- `subir-crm-flash.ts` generalizado de 1 ad p/ o lote **b1c1 inteiro** (TP1630–TP1638, hooks h1–h9), todos pareados 9x16+4x5 e PAUSED no mesmo conjunto pré-setado da campanha CBO FLASH CRM
- Idempotente (pula ads que já existem pelo TP/nome) + resiliente à quota dev-tier: em rate-limit duro (80004/80014) espera 5min e tenta de novo (até 8x/ad), re-rodar continua de onde parou
- Vídeos referenciados por `video_id` (mapa TP→{9x16,4x5} embutido, das subidas manuais do Gerenciador)

**Por que:**
- O usuário pediu pra subir TODOS os ads de CRM Recompra que já estão no Gerenciador, no mesmo padrão do h1b1c1. Hoje só o conjunto b1c1 (h1–h9) está com vídeo no Meta

**Arquivos alterados:**
- `subir-crm-flash.ts` - vira lote (loop TP1630–1638) com backoff de rate-limit

**Impacto arquitetural:** Nenhum — script one-off de criação de ads via Meta API.

---

## 2026-06-22 | chore(ads-creation): script one-off do ad CRM Recompra h1b1c1 na camp FLASH CRM (CBO)

**O que foi feito:**
- `subir-crm-flash.ts`: cria o ad **TP1630** (`Crm_Recompra_Lucas_h1b1c1`) pareado 9x16+4x5, **PAUSED**, dentro do conjunto pré-setado (`120252008223980450`) da campanha CBO `[TP] [LEADS] [CBO] [FLASH CRM]` (`120252008224000450`)
- Vídeos já no Meta (referência por `video_id`: 9x16 `1373715248001174`, 4x5 `1509680107621231`); pareamento via `asset_feed_spec` (9x16 → story/reels, 4x5 → feed)
- Copy do CRM Recompra + CTA "Saiba mais" (LEARN_MORE) + UTM dinâmica padrão da Turbo
- Como é CBO, o ad entra no conjunto existente sem budget no nível do conjunto (verba na campanha)

**Por que:**
- Subir o primeiro criativo do lote CRM na campanha de teste recém-criada pelo usuário, deixando pausado pra revisão antes de publicar

**Pendências registradas (antes de publicar):**
- Link real da página de destino (hoje placeholder `turbopartners.com.br`) — recriar criativo ou editar no Gerenciador
- UTMs específicas da landing (se houver, além da dinâmica padrão)
- Posicionamentos do conjunto + `destination_type` (hoje UNDEFINED) + nome do conjunto + resto da config

**Arquivos novos:**
- `subir-crm-flash.ts` - cria o ad h1b1c1 pareado PAUSED na camp FLASH CRM (idempotente por nome do ad)

**Impacto arquitetural:** Nenhum — script one-off de criação de ad via Meta API, sem mudança de schema.

---

## 2026-06-22 | chore(biblioteca): cadastro + reordenação CRM Recompra (body→cta→hook)

**O que foi feito:**
- Cadastro dos 36 criativos 9x16 do lote CRM Recompra (Lucas) na Biblioteca como TP1630–TP1665, via `createCreative` (TP sequencial, sem gap-fill)
- Reordenação de TP1630–TP1665 pra ordem **body → cta → hook**: todos os hooks de b1c1 (h1..h9), depois b1c2, b2c1, b2c2 — UPDATE in-place em 2 fases (tp_id temporário → final, casado por `driveFileId`) pra não colidir no unique constraint
- `subir-crm-planilha.ts` atualizado pra usar a ordenação body→cta→hook como padrão das próximas subidas
- `verificar-utm.ts`: utilitário só-leitura que confere o `url_tags` dos ads criados na sessão contra a UTM padrão da Turbo

**Por que:**
- O usuário definiu a ordem de preenchimento da planilha como body→cta→hook (preencher todos os h1..h10 de b1c1, depois b1c2, etc.), substituindo a ordem hook→body→cta usada na primeira subida
- Manter os TPs sequenciais e agrupados por body/cta facilita a leitura da Biblioteca e o pareamento na criação dos ads

**Arquivos novos:**
- `subir-crm-planilha.ts` - cadastra o lote CRM 9x16 na Biblioteca
- `reordenar-crm.ts` - reordena TP1630–1665 pra body→cta→hook
- `verificar-utm.ts` - confere UTM dos ads criados (só leitura)

**Impacto arquitetural:** Nenhum — scripts one-off + reordenação de dados na Biblioteca, sem mudança de schema.

---

## 2026-06-17 | chore(ads-creation): script one-off de upload de criativos Ana (Bastidores)

**O que foi feito:**
- Cadastro do lote Ana "Bastidores" (9x16, hooks h1–h3, b1/c1) na Biblioteca de Criativos como TP1616–TP1618
- `subir-ana-bastidores.ts`: cria um conjunto único (148) na campanha Creators ABO teste e os 3 ads dentro, todos PAUSED, R$20/dia
- Variante do fluxo Bready: referencia os `video_id` 9x16 já subidos manualmente no Meta (sem download do Drive / sem re-upload)
- Config do conjunto clonada do Ana 115 (OFFSITE_CONVERSIONS/LEAD, pixel, targeting BR aberto); copy completa Ana/Creators + UTM dinâmica limpa

**Por que:**
- Registrar o one-off de subida da Ana, espelhando os scripts do Bready (`subir-bready*.ts`)
- Garantir consistência da copy/UTM com os ads Ana existentes (o ad antigo carregava o typo "tum_term =")

**Arquivos novos:**
- `subir-ana-bastidores.ts` - script one-off de criação dos ads da Ana

## 2026-05-19 | feat(utm): UTM Builder + Constituição UTM Turbo v1.1

**O que foi feito:**
- Página `/utm-builder` com 3 abas: Gerar link, Histórico, Configurar valores
- Geração de links com vocabulário fechado de medium/source + dropdowns dependentes de campaign/term
- Sanitização ao vivo (lowercase, hífen, sem acento) + sanitização final no submit
- Tabela `cortex_core.utm_vocabulary` (vocabulário oficial de campaign/term) e `cortex_core.generated_utm_links` (auditoria)
- Aba Histórico mostra todos os links gerados pelo time, com filtros (medium, busca, só não-oficializados) e paginação
- Aba Configurar valores (admin only) com sub-tabs por medium, edição de label, switch ativo/inativo, oficializar e dispensar valores ad-hoc
- Documento `docs/utm-constituicao.md` (Constituição UTM Turbo v1.1) — fonte normativa do padrão de UTMs da Turbo

**Por que:**
- Padronizar 100% da criação de links pelo time, evitando voltar ao caos de 16 variantes de `utm_source` que motivou a auditoria de 07/05/2026
- Bloquear erros na origem (UI) em vez de tentar consertar no banco depois
- Dar autonomia ao admin pra cadastrar valores novos (campaign/term) sem PR — só medium/source ficam fixos no código

**Arquivos novos:**
- `migrations/2026-05-19-utm-builder.sql` - schema + seed v1.1
- `shared/utm-vocabulary.ts` - vocabulário fechado de medium+source (Constituição)
- `shared/utm-sanitize.ts` - sanitização e construção de URL
- `server/routes/utm.ts` - 9 endpoints (geração, histórico, vocabulário, admin)
- `client/src/pages/UtmBuilder.tsx` - página com 3 abas
- `scripts/run-utm-builder-migration.ts` - aplica migration em ambientes novos
- `docs/utm-constituicao.md` - documento normativo v1.1

**Arquivos alterados:**
- `shared/schema.ts` - tabelas `utmVocabulary` e `generatedUtmLinks` no Drizzle
- `shared/nav-config.ts` - permission key `growth.utm_builder` + entrada de menu
- `server/routes.ts` - registro de `registerUtmRoutes`
- `client/src/App.tsx` - rota `/utm-builder`
- `client/src/components/app-sidebar.tsx` - ícone `Link2` no menu

**Impacto arquitetural:**
- Cria 2 tabelas em `cortex_core` (não toca em `Bitrix.crm_deal`)
- Sem dependência da branch `feature/utm-constituicao-v1` (que cuida do map de normalização legado→canônico) — as 2 features são complementares: gerador (input) + map (output)

---

## 2026-03-18 | feat(pagamentos): highlight overdue cards in red when delivery deadline exceeded

**O que foi feito:**
- Cards na etapa "Conteúdo em Produção" ficam vermelhos quando `assinado_em + prazo_entrega_dias` é excedido
- Badge "Xd atrasado" com ícone de alerta no card e no sheet de detalhes
- Prazo de entrega visível no sheet com data calculada e indicação de atraso

**Por que:**
- Facilitar identificação visual de conteúdos com prazo de entrega vencido

**Arquivos alterados:**
- `server/routes/creators.ts` - Incluído `prazo_entrega_dias` na query de pagamentos
- `client/src/pages/PagamentoFreelancers.tsx` - Helpers isAtrasado/diasAtraso, visual vermelho no card e sheet

**Impacto arquitetural:** Nenhum

---

## 2026-03-18 | feat(social): add Kanban board for freelancer payment tracking

**O que foi feito:**
- Nova coluna `etapa_pagamento` em `contratos_creators` com backfill automático de contratos assinados
- Automação em 4 pontos de sync (polling, webhook, manual) para setar `etapa_pagamento='producao'` ao assinar
- Endpoints GET `/api/creators/pagamentos` e PATCH `/api/creators/contratos/:id/etapa-pagamento`
- Permission key `social.pagamentos_creators`, nav item e rota `/social/pagamentos`
- Página Kanban `PagamentoFreelancers.tsx` com 4 etapas: Produção → Aguardando Aprovação → Aprovado → Pago
- KPI cards com contagem e valor por etapa, busca client-side, Sheet de detalhes com ação de mover

**Por que:**
- Contratos freelancers já tinham fluxo de assinatura mas faltava acompanhamento pós-assinatura para pagamento

**Arquivos alterados:**
- `server/routes/creators.ts` - Migration etapa_pagamento + backfill + 2 novos endpoints + sync fix
- `server/index.ts` - Adicionado etapa_pagamento nos 2 pontos de polling de assinatura
- `server/routes/contratos.ts` - Adicionado etapa_pagamento no webhook handler
- `shared/nav-config.ts` - Permission key, rota, nav item e label para pagamentos
- `client/src/App.tsx` - Lazy import e route para PagamentoFreelancers
- `client/src/pages/PagamentoFreelancers.tsx` - Nova página Kanban completa

**Impacto arquitetural:** Nova página e fluxo de dados independente. Coluna adicionada com DDL IF NOT EXISTS (não-destrutiva).

---

## 2026-03-17 | feat(squads): make salários row expandable with individual employee breakdown

**O que foi feito:**
- Adicionado `salariosDetalhes` na resposta da API com nome e salário de cada colaborador
- Linha "Salários" agora é clicável com chevron, expandindo para mostrar colaboradores individuais
- Funciona tanto na seção por squad quanto no footer TOTAL

**Por que:**
- Permitir visibilidade granular dos custos de salários por colaborador dentro da contribuição por squad

**Arquivos alterados:**
- `server/routes.ts` - Incluído array `salariosDetalhes` no response do endpoint bulk
- `client/src/pages/ContribuicaoSquad.tsx` - Adicionado state `expandedSalarios`, interface `SalarioDetalhe`, e lógica de expansão nas sub-linhas de Salários

**Impacto arquitetural:** Nenhum

---

## 2026-03-15 | feat(contribuicao): show resultado when collapsed and add contrib % column

**O que foi feito:**
- Exibir valores de resultado (margem) nas células de mês quando squad está colapsado
- Adicionada coluna "Contrib %" com percentual de contribuição anual de cada squad
- Footer TOTAL mostra 100% na coluna de contribuição

**Por que:**
- Permitir visão rápida dos resultados sem precisar expandir cada squad
- Mostrar peso relativo de cada squad na receita total

**Arquivos alterados:**
- `client/src/pages/ContribuicaoSquad.tsx` - Adicionada coluna contrib % e resultado no estado colapsado

**Impacto arquitetural:** Nenhum.

---

## 2026-03-15 | refactor(contribuicao): replace cluttered UI with clean contribution table

**O que foi feito:**
- Removido Hero Ranking, Resumo Anual, Tabela Mês a Mês, KPI Cards e DFC detalhado
- Criada tabela única e limpa com squads agrupados mostrando Receita/Despesas/Margem/Margem% por mês
- Cada squad é colapsável (expandido por padrão)
- Footer TOTAL com valores agregados de todos os squads
- Mantida lógica de rateio proporcional de despesas

**Por que:**
- Tela estava muito poluída com muitas seções redundantes
- Usuário queria visão limpa e objetiva: receitas, despesas e margem por squad mês a mês

**Arquivos alterados:**
- `client/src/pages/ContribuicaoSquad.tsx` - Reescrita completa: 828 linhas removidas, 317 adicionadas

**Impacto arquitetural:** Nenhum — apenas reestruturação visual do componente, sem mudanças no backend ou API.

---

## 2026-03-13 | feat(tech): implement Performance section with deploy metrics

**O que foi feito:**
- Implementado componente TechPerformance completo com toggle Geral/Por PO
- Seletor de periodo (6/12/24 meses) para filtrar dados
- KPI cards: tempo medio deploy, entregas no trimestre, gargalo principal, fases monitoradas
- Graficos de barras para tempo de deploy e entregas por trimestre (Recharts)
- Grafico horizontal de tempo de deploy por PO (modo por-po)
- Phase cards (design/dev/review/qa/deploy) com destaque de gargalo

**Por que:**
- Secao Performance do TechHub necessaria para visualizar metricas de deploy e identificar gargalos no pipeline

**Arquivos alterados:**
- `client/src/pages/tech/TechPerformance.tsx` - Substituido placeholder por componente completo com charts, KPIs e phase cards

**Impacto arquitetural:** Nenhum

---

## 2026-03-13 | feat(tech): create ProjectCard and PrazoStatusBar components

**O que foi feito:**
- Criado componente `ProjectCard` com borda de urgência, badges de status/fase/tipo, barra de progresso do prazo e tags de alerta
- Criado componente `PrazoStatusBar` com segmentos proporcionais coloridos mostrando tempo em cada fase de status

**Por que:**
- Componentes reutilizáveis necessários para as views Board (Kanban) e Projetos do TechHub

**Arquivos alterados:**
- `client/src/components/tech/ProjectCard.tsx` - Componente de card de projeto com visual rico e suporte dark/light mode
- `client/src/components/tech/PrazoStatusBar.tsx` - Barra horizontal empilhada com tempo por status

**Impacto arquitetural:** Nenhum — novos componentes isolados em `components/tech/`

---

## 2026-03-11 | fix(growth): show last 12 months in orcado-realizado month selector

**O que foi feito:**
- Endpoint de meses agora gera últimos 12 meses automaticamente, além dos meses com budgets salvos

**Por que:**
- Fevereiro sumiu do seletor porque não tinha budget salvo na tabela `growth_budgets`

**Arquivos alterados:**
- `server/routes/growth.ts` - Gerar últimos 12 meses no endpoint `/budgets/months`

**Impacto arquitetural:** Nenhum

---

## 2026-03-11 | fix(growth): correct crm_deal column name from data_criacao to created_at

**O que foi feito:**
- Corrigido nome da coluna `d.data_criacao` para `d.created_at` na query de leads do endpoint orcado-realizado/ads
- Adicionado `INTERVAL '1 day'` para consistência com demais queries

**Por que:**
- A coluna `data_criacao` não existe na tabela `crm_deal`, causando erro 500 — o endpoint inteiro falhava

**Arquivos alterados:**
- `server/routes/growth.ts` - Corrigido nome da coluna na query de leads do Bitrix

**Impacto arquitetural:** Nenhum

---

## 2026-03-11 | fix(growth): include Google Ads data in orcado-realizado investment metric

**O que foi feito:**
- Endpoint `/api/growth/orcado-realizado/ads` agora consulta Google Ads além de Meta Ads
- Investimento, impressões e cliques são combinados de ambas as fontes
- CPM e CTR recalculados a partir dos totais combinados

**Por que:**
- O card "Investimento" na aba Orçado x Realizado mostrava R$ 0,00 porque o endpoint só consultava Meta Ads, ignorando gastos no Google Ads

**Arquivos alterados:**
- `server/routes/growth.ts` - Adicionada query Google Ads ao endpoint orcado-realizado/ads e combinação dos totais

**Impacto arquitetural:** Nenhum

---

## 2026-03-10 | feat(chamados): integrate Cortex chamados with Obsidian Tasks

**O que foi feito:**
- Adicionado campo `detalhes` JSONB ao schema de chamados para dados estruturados por categoria
- Criada funcao `writeObsidianTask` que gera arquivo .md no vault Obsidian para chamados Cortex
- Criada funcao `updateObsidianTaskStatus` que sincroniza status no frontmatter do Obsidian
- Adicionados campos dinamicos no formulario por categoria (Bug, Nova Feature, Melhoria, Relatorio/Dashboard, Integracao, Outros)
- Criado `Tasks/_overview.md` no Obsidian com queries Dataview

**Por que:**
- Permitir que chamados abertos na area Cortex alimentem automaticamente tasks no Obsidian vault para gestao de desenvolvimento

**Arquivos alterados:**
- `server/middleware/schemas.ts` - Adicionado campo `detalhes` ao createChamadoSchema
- `server/routes/chamados.ts` - Salvar detalhes JSONB, writeObsidianTask no POST, updateObsidianTaskStatus no PATCH
- `client/src/pages/Chamados.tsx` - Campos dinamicos por categoria quando area=cortex

**Impacto arquitetural:** Integracao file-system entre backend e Obsidian vault local via fs.writeFileSync. Sem dependencia externa.

---

## 2026-03-10 | fix(security): hardening Phase 2 - SQL injection deep fixes

**O que foi feito:**
- **churnRiskEngine.ts**: Substituída concatenação de string com `sql.raw()` por queries parametrizadas usando `sql` template + `sql.join()` para filtros dinâmicos
- **dfcAnalysis.ts**: Hardened `executeSecureQuery()` - regex-based pattern blocking, table blacklist, forced LIMIT 500, transação read-only, log truncado
- **juridico.ts**: Substituído escape manual de SQL (IN clause com `replace(/'/g, "''")`) por `ANY()` parametrizado
- **comercial.ts**: Substituída query inteira em `sql.raw()` por `sql.join()` para colunas dinâmicas do SELECT

**110 sql.raw() restantes** são todos server-computed (datas de `new Date().toISOString()`, nomes de tabela hardcoded, scripts de migração) - nenhum com interpolação de input de usuário.

**Impacto arquitetural:** Eliminadas todas as vulnerabilidades de SQL injection com input de usuário

---

## 2026-03-10 | refactor(routes): modularize routes.ts - Phase 3 refactoring

**O que foi feito:**
- Extraídos 7 módulos de rotas de `routes.ts` (21k linhas → 11k linhas, **-47%**)
- Módulos criados: `inadimplencia.ts`, `geg.ts`, `comercial.ts`, `okr2026.ts`, `juridico.ts`, `clientes.ts`, `colaboradores.ts`
- Total de ~177 rotas extraídas para arquivos dedicados
- Adicionada validação Zod (middleware) em 9 endpoints críticos (auth, chamados, inadimplência, user management)
- Configurados Vitest (24 tests), ESLint + Prettier

**Arquivos criados:**
- `server/routes/inadimplencia.ts` (1310 linhas, 18 rotas)
- `server/routes/geg.ts` (958 linhas, 30 rotas)
- `server/routes/comercial.ts` (2356 linhas, 41 rotas)
- `server/routes/okr2026.ts` (1784 linhas, 30 rotas)
- `server/routes/juridico.ts` (1760 linhas, 17 rotas)
- `server/routes/clientes.ts` (976 linhas, 26 rotas)
- `server/routes/colaboradores.ts` (964 linhas, 15 rotas)
- `server/middleware/validate.ts`, `server/middleware/schemas.ts`

**Impacto arquitetural:** Manutenibilidade significativamente melhorada - cada domínio em arquivo dedicado

---

## 2026-03-09 | fix(security): hardening Phase 1 - endpoints, SQL injection, rate limiting

**O que foi feito:**
- Removidos 10 endpoints `/debug-*` não protegidos (~360 linhas) que estavam antes do middleware `isAuthenticated`
- Substituídos ~30 `sql.raw()` com interpolação de input de usuário por queries parametrizadas (Drizzle `sql` template)
- Adicionado `express-rate-limit`: 200 req/min geral em `/api`, 20 req/15min em login/OAuth
- Validação fail-fast de `SESSION_SECRET` em produção
- Corrigido error handler que fazia re-throw após responder (crash com ERR_HTTP_HEADERS_SENT)
- Adicionados `process.on('unhandledRejection')` e `process.on('uncaughtException')` handlers
- Adicionados `credentials/`, `*.key`, `*.pem` ao `.gitignore`

**Arquivos alterados:**
- `server/routes.ts` - Remoção de debug endpoints
- `server/storage.ts` - Parametrização de queries (inadimplência, métricas, busca)
- `server/auth/routes.ts` - Parametrização de UUID array e name matching
- `server/routes/chamados.ts` - Parametrização de list/update
- `server/routes/juridico-assistente.ts` - Parametrização de LIMIT
- `server/index.ts` - Rate limiting, SESSION_SECRET, error handler, process guards
- `.gitignore` - Secrets patterns

**Impacto arquitetural:** Segurança reforçada em múltiplas camadas

---

## 2026-03-09 | fix(contribuicao-squad): fix resultado liquido calculation to include all expenses

**O que foi feito:**
- Corrigido cálculo do Resultado Líquido no ranking de squads para incluir todas as despesas (impostos + salários + CXCS + freelancers) rateadas proporcionalmente à receita
- Anteriormente só deduzia a taxa de imposto, resultando em margem artificialmente alta

**Por que:**
- O valor da margem estava muito baixo/errado - mostrava apenas dedução de imposto em vez de todas as despesas

**Arquivos alterados:**
- `client/src/pages/ContribuicaoSquad.tsx` - Corrigido squadRanking.resultadoLiquido e coluna de despesas na tabela

**Impacto arquitetural:** Nenhum

---

## 2026-03-09 | refactor(inadimplencia): improve dashboard UX with compact filters, KPI deltas, and chart enhancements

**O que foi feito:**
- Removido ~200 linhas de dead code (imports, interfaces, queries, PDF handlers não utilizados)
- Substituída barra de filtros com gradiente por filtros inline compactos (Período + Squad + Vendedor + Faixa)
- Adicionados deltas de tendência nos KPI cards comparando mês atual vs anterior
- Melhorada tipografia dos KPIs (text-xl, uppercase tracking-wider)
- Substituído ComposedChart dual-axis por BarChart com toggle Valor/Parcelas
- Gráficos de barras agora ordenados por valor decrescente, com labels mais largos (120px) e truncação inteligente de nomes
- Adicionado LabelList nos gráficos de barras com valores compactos
- Tooltips ricos customizados mostrando nome completo, valor, parcelas, clientes e % do total
- Badge de urgência na tab Clientes mostrando contagem de 90+ dias
- Empty states melhorados com ícones e textos descritivos

**Por que:**
- Melhorar a experiência do usuário na análise de inadimplência: mais técnica, mais bonita, mais intuitiva

**Arquivos alterados:**
- `client/src/pages/DashboardInadimplencia.tsx` - Refatoração completa da UX do dashboard

**Impacto arquitetural:** Nenhum

---

## 2026-03-07 | feat(juridico): add legal knowledge markdowns for AI assistant

**O que foi feito:**
- Criado `agents/legal-cobranca.md` com procedimentos de cobranca, escalonamento por dias de atraso, juros/multa, prescricao
- Criado `agents/legal-contratos.md` com tipos de contrato, clausulas essenciais (SLA, NDA, PI, LGPD), checklist de analise
- Criado `agents/legal-trabalhista.md` com modalidades CLT/PJ/estagio, tipos de rescisao, documentacao e prazos

**Por que:**
- Base de conhecimento necessaria para o assistente juridico com IA que sera integrado ao Cortex
- Markdowns servem como contexto de sistema (system prompt) para orientar respostas juridicas

**Arquivos alterados:**
- `agents/legal-cobranca.md` - Novo arquivo: conhecimento sobre cobranca e inadimplencia empresarial
- `agents/legal-contratos.md` - Novo arquivo: conhecimento sobre contratos empresariais
- `agents/legal-trabalhista.md` - Novo arquivo: conhecimento sobre direito trabalhista brasileiro

**Impacto arquitetural:** Nenhum. Arquivos de conhecimento (markdown) sem impacto em codigo.

---

## 2026-03-07 | feat(dre): reclassifica deduções e adiciona receita líquida, LAIR, IR/CSLL no backend

**O que foi feito:**
- Adiciona grupo 08 (IR E CONTRIBUIÇÃO SOCIAL) e grupo virtual DD (DEDUÇÕES DA RECEITA BRUTA) ao GRUPO_MAP
- Reclassifica categorias 05.05/05.06 (ISS, PIS, COFINS) de custos operacionais para deduções da receita bruta
- Adiciona novos subtotais: deducoes_receita_bruta, receita_operacional_liquida, receita_liquida_total, lair, ir_csll
- Atualiza cálculos derivados seguindo estrutura contábil: Receita Bruta - Deduções = Receita Líquida - Custos = Lucro Bruto - Despesas = LAIR - IR/CSLL = Resultado Líquido

**Por que:**
- Categorias 05.05 (ISS) e 05.06 (PIS/COFINS) são deduções tributárias sobre receita, não custos operacionais
- A DRE precisa separar Receita Bruta de Receita Líquida para análise correta
- LAIR (Lucro Antes do IR) e IR/CSLL são obrigatórios numa DRE completa
- Grupo 08 já existia no plano de contas mas não era processado

**Arquivos alterados:**
- `server/routes/dre.ts` - GRUPO_MAP expandido, DREResponse com novos subtotais, reclassificação 05.05/05.06→DD, cálculos derivados atualizados

**Impacto arquitetural:** Mudança no contrato da API /api/financeiro/dre — subtotais renomeados (receita_bruta_total→receita_liquida_total) e novos campos adicionados. Frontend precisará ser atualizado para consumir os novos subtotais.

---

## 2026-03-06 | feat(squad): overhaul completo da página Contribuição por Squad

**O que foi feito:**
- [BACKEND] Novo campo `resumoPorSquad` no endpoint bulk com totais por squad, breakdown mensal e contagem de contratos
- [HERO] Ranking de Squads no topo: cards ordenados por contribuição %, sparklines de tendência, clicáveis para filtrar
- [TABELA] Resumo Anual com colunas: Squad, Receita Bruta, Impostos, Líquido, Contribuição %, Tendência
- [TAXA] Alíquota de imposto configurável (input no header, default 18%) — remove todo hardcode 0.18/0.82
- [DETAIL] Detalhamento mensal colapsável (começa fechado para visão executiva rápida)
- [UX] Empty state, botão "Voltar para todos", loading skeletons adequados
- KPI cards só aparecem no modo squad individual; ranking + tabela resumo no modo "Todos"

**Por que:**
- CEO precisa ver contribuição % líquida de cada squad imediatamente, sem scroll horizontal em tabela de 12 colunas

**Arquivos alterados:**
- `server/routes.ts` - resumoPorSquad no endpoint bulk
- `client/src/pages/ContribuicaoSquad.tsx` - redesign completo (hero, tabela resumo, detail colapsável, taxa configurável)

**Impacto arquitetural:** Campo additive na API (não breaking)

---

## 2026-03-06 | feat(metas): overhaul completo da página Metas de Receita

**O que foi feito:**
- [ALTA] Atingimento da Meta movido para hero section no topo com badges de status (Abaixo/Em progresso/Meta atingida)
- [ALTA] KPI cards reorganizados: 3 grandes (Total a Receber, Recebido, Pendente) + 3 compactos (Inadimplente, Projeção, Média Diária)
- [ALTA] Sistema de cores semântico padronizado: verde=recebido, amarelo=pendente, vermelho=inadimplente, azul=projeções
- [MÉDIA] Badges CRÍTICO/ATENÇÃO/OK nos cards de inadimplência baseados em thresholds
- [MÉDIA] Labels nos eixos Y do gráfico (R$ Diário / R$ Acumulado) e legenda separada por tipo
- [BAIXA] Hover micro-interactions (shadow, scale) em todos os cards
- [BAIXA] Renomeado "Revenue Goals" → "Metas de Receita" no nav e page info
- Ticket médio: ícones menores (w-5), padding compacto, fonte ajustada

**Arquivos alterados:**
- `client/src/pages/RevenueGoals.tsx` - layout completo, KPICard compact prop, hero section, status badges, chart labels
- `shared/nav-config.ts` - título e label de permissão renomeados

**Impacto arquitetural:** Nenhum — apenas frontend, sem alteração de API

---

## 2026-03-06 | feat(dfc): exportação CSV/Excel nos modos Diário e Mensal

**O que foi feito:**
- Dropdown "Exportar" com opções CSV e Excel no card do gráfico principal
- CSV com BOM para acentuação correta, Excel com colunas auto-dimensionadas
- Disponível nos modos Diário e Mensal (Semanal já tinha exportação própria)

**Arquivos alterados:**
- `client/src/pages/FluxoCaixa.tsx` - funções exportFluxoCSV/exportFluxoXLSX, DropdownMenu

**Impacto arquitetural:** Nenhum — usa xlsx já instalado

---

## 2026-03-06 | feat(dfc): marcação do dia atual no gráfico diário

**O que foi feito:**
- Linha vertical tracejada com label "Hoje" no gráfico diário usando ReferenceLine do recharts
- Só aparece quando o dia atual está dentro do período selecionado

**Arquivos alterados:**
- `client/src/pages/FluxoCaixa.tsx` - hojeFormatado useMemo, ReferenceLine component

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dfc): colunas ordenáveis na tabela Maiores Inadimplentes

**O que foi feito:**
- Colunas Valor Total, Parcelas e Dias Atraso clicáveis para ordenação asc/desc
- Ícone ArrowUpDown nos headers para indicar que são clicáveis

**Arquivos alterados:**
- `client/src/pages/RelatorioSemanalFinanceiro.tsx` - inadimSort state, sortedInadimClientes, headers clicáveis

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dfc): tooltip de contexto nas variações semanais

**O que foi feito:**
- VariationBadge nos KPI cards do relatório semanal agora mostra tooltip "vs. semana anterior (dd/MM - dd/MM)"
- KpiCard aceita prop `deltaTooltip` opcional

**Arquivos alterados:**
- `client/src/pages/RelatorioSemanalFinanceiro.tsx` - KpiCard deltaTooltip prop, TooltipUI wrapper, prevWeekLabel

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dfc): filtro por conta financeira no modo Diário

**O que foi feito:**
- Novo endpoint `/api/fluxo-caixa/contas-financeiras` retorna contas distintas
- Parâmetro `contaFinanceira` no endpoint diario-completo filtra por nome_conta_financeira
- Select dropdown no card do gráfico para selecionar conta específica

**Arquivos alterados:**
- `server/routes.ts` - novo endpoint, filtro SQL em ambos os branches
- `server/storage.ts` - parâmetro contasFinanceiras na query principal
- `client/src/pages/FluxoCaixa.tsx` - Select dropdown, query state

**Impacto arquitetural:** Novo endpoint de API (não breaking)

---

## 2026-03-06 | feat(dfc): tooltip de metodologia no Saldo Projetado

**O que foi feito:**
- Ícone Info (i) ao lado do label "Saldo Projetado" com tooltip explicando o cálculo

**Arquivos alterados:**
- `client/src/pages/FluxoCaixa.tsx` - TooltipUI com Info icon no card Saldo Projetado

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): sparklines de tendência nas linhas principais

**O que foi feito:**
- Coluna "Tendência" com mini gráficos AreaChart (recharts) para Receita Bruta Total, Lucro Bruto e Resultado Líquido
- Verde para valor positivo, vermelho para negativo, apenas meses com dados são plotados

**Por que:**
- Facilitar visualização rápida da evolução sem precisar ler todos os números

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - componente Sparkline, coluna Tendência no header e linhas derivadas

**Impacto arquitetural:** Nenhum — usa recharts já instalado

---

## 2026-03-06 | style(dre): responsividade com borda na coluna sticky

**O que foi feito:**
- Borda direita na coluna "Conta" em todos os níveis para separação visual ao scrollar horizontalmente
- Aumenta min-width das colunas de meses para 100px

**Por que:**
- Ao scrollar horizontalmente, não havia separação visual entre coluna fixa e colunas que scrollam

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - border-r em todas as td sticky

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): exportação Excel (.xlsx) com cabeçalho e separadores

**O que foi feito:**
- Dropdown "Exportar" com opções CSV e Excel (.xlsx) substituindo botão único
- Exportação inclui título com empresa/período e linhas separadoras entre seções
- Colunas auto-dimensionadas no Excel

**Por que:**
- Exportação apenas CSV era limitada; Excel é mais comum no contexto financeiro

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - funções buildExportRows, exportXLSX, DropdownMenu

**Impacto arquitetural:** Nenhum — usa xlsx já instalado, import dinâmico

---

## 2026-03-06 | fix(dre): corrige duplicidade de categorias

**O que foi feito:**
- Normaliza whitespace com REGEXP_REPLACE na query SQL
- DISTINCT ON (p.id, categoria_nome) evita contar parcela duplicada

**Por que:**
- Categorias como "05.01.09 Analista de Comunicação" apareciam duplicadas por diferenças de espaço no nome

**Arquivos alterados:**
- `server/routes/dre.ts` - query SQL do CTE categorias_expandidas

**Impacto arquitetural:** Nenhum — apenas normalização de dados

---

## 2026-03-06 | style(dre): melhora visual do AV%

**O que foi feito:**
- AV% usa text-[10px] italic para se distinguir dos valores monetários
- Headers de AV% mostram "AV%" em vez de apenas "%"

**Por que:**
- AV% precisa ser visível mas não competir visualmente com os valores principais

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderAVCell e headers

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): indicadores de variação mês a mês

**O que foi feito:**
- Tooltip no hover mostra variação % vs mês anterior (ex: "+5.2% vs Jan")
- Setas TrendingUp/TrendingDown nas linhas de Lucro Bruto, Resultado Operacional e Resultado Líquido

**Por que:**
- Permitir análise rápida de tendência sem cálculo manual

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderValueCell com prevValue, showBadge, TooltipProvider

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): destaque visual da coluna Acumulado (YTD)

**O que foi feito:**
- Células de acumulado recebem background diferenciado e font-semibold

**Por que:**
- Diferenciar visualmente coluna de totalização das colunas mensais

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderValueCell com isAccum

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | fix(dre): substitui R$ 0 por traço em meses sem dados

**O que foi feito:**
- Backend envia array mesesComDados indicando quais meses têm lançamentos
- Frontend mostra "—" em vez de "R$ 0" para meses sem dados, com cor mais sutil

**Por que:**
- Meses futuros mostrando R$ 0 em todas as linhas era confuso e poluído visualmente

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderValueCell e renderAVCell com lógica de isEmptyMonth
- `server/routes/dre.ts` - campo mesesComDados na resposta

**Impacto arquitetural:** Nenhum — novo campo na API sem breaking change

---
