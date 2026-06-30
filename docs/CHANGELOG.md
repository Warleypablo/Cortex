# Changelog

## 2026-06-30 | fix(gestao): corrige dupla contagem do pontual e conversões enganosas

**O que foi feito:**
- Venda pontual por produto agora deduplica por jornada (entregas 1ª/2ª/3ª… do mesmo cliente repetiam o valor do pacote) — Creators jun caiu de 35 entregas/R$357k para 22 jornadas/R$197k; o total passa a bater com a venda do Bitrix. Alinhado à régua do BP (data_criado, exclui status 'não usar').
- Removidas as conversões reunião→venda (closer) e lead→reunião (SDR) que passavam de 100% por contarem janelas de data diferentes; substituídas por notas explicativas.
- CAC por contrato/cliente passa a usar a contagem deduplicada.

**Por que:** revisão apontou números inflados/enganosos na aba Micro e Pessoas.

**Arquivos alterados:**
- `server/routes/gestaoReceita.ts` - query de produto (CTE de dedup por jornada) e CAC.
- `client/src/pages/gestao/GestaoReceita.tsx` - remoção das conversões e notas.

**Impacto arquitetural:** Nenhum.

---

## 2026-06-30 | feat(gestao): painel Gestão de Receita (orçado × realizado comercial)

**O que foi feito:**
- Novo endpoint `GET /api/gestao/receita?mes=YYYY-MM` que agrega, por mês: venda nova (Bitrix), metas (BP 2026) e custos em regime caixa (Conta Azul), reusando `somaDespesaCaixaPorMes` + predicados do BP.
- Nova página `/gestao/receita` com 5 seções em abas (Pessoas, Macro, Micro, Funil, Qualidade): venda MRR/Pontual orçado×realizado, top/bottom closers e SDRs, canais de aquisição, CAC por contrato/cliente, funil Lead→RA→RR→Venda, composição MQL/NMQL, churn por motivo/vendedor.
- Item no menu Gestão, rota protegida e nova permission `gestao.receita`.

**Por que:**
- Dar ao comercial uma visão única de orçado×realizado com dados reais (antes era um mockup com dados fictícios).

**Arquivos alterados:**
- `server/routes/gestaoReceita.ts` - endpoint agregador (novo).
- `server/routes.ts` - registro do endpoint.
- `client/src/pages/gestao/GestaoReceita.tsx` - página em componentes do Cortex + dark mode (novo).
- `client/src/App.tsx` - rota lazy.
- `shared/nav-config.ts` - permission, label e item de menu.

**Impacto arquitetural:** Nenhum — reusa infraestrutura existente (padrão `db.execute`, predicados/custos do BP, React Query). Visão por produto (ClickUp) pode divergir da venda (Bitrix) por design; MQL/source refletem o preenchimento ralo do CRM.

---

## 2026-06-25 | feat(organico): painel operador (3 visões + Soltar agora/Agendar) + engine do worker

**O que foi feito:**
- **Redesenho do painel Orgânico** pro fluxo do operador: 3 visões do dia (**Aprovados / Agendados / Publicados**) e, por post aprovado, ações **"Soltar agora"** (confirmação) e **"Agendar"** (date-picker). Substitui o read-only "Saúde/Fila/Histórico".
- **Modelo de dados** (migration aditiva `2026-06-25-content-publish-operador.sql`, aplicada): `state` += `aprovado`; coluna `content_posts.scheduled_at`; unique `(platform, clickup_task_id)` (tolera aprovado sem data); `command.action` += `schedule|cancel_schedule`.
- **Backend** (`server/routes/organico.ts`): `/overview` em 3 visões; `POST /commands` + `POST /settings` (operador, pós-auth); `GET /commands/pending` + `POST /commands/:id/ack` + `GET /posts/due` (máquina, token); ingest com upsert por task e `scheduled_at` chave-presente.
- **Engine do worker** (monorepo `automacoes/instagram-turbo/agente/`): `main_poller.py` (reporta aprovados + consome fila + publica vencidos; `--once` p/ cron), `commands.py` (consumidor; DRY_RUN não publica), `panel_client.py` (HTTP de máquina fail-soft), `state_sink` (emite `aprovado` + `report_posts`).

**Por que:**
- O painel só observava; o time precisa **operar** (soltar/agendar) sem terminal. Os cards aprovados costumam estar sem "Data de Postagem" e não saíam sozinhos — o operador passa a comandar a publicação pela fila `content_publish_commands`.

**Arquivos alterados:**
- `shared/schema.ts`, `migrations/2026-06-25-content-publish-operador.sql` - modelo de dados.
- `server/routes/organico.ts` - 3 visões + comandos + endpoints de máquina.
- `client/src/pages/GrowthOrganico.tsx` - UI operador (botões + date-picker).
- `automacoes/instagram-turbo/agente/{main_poller,commands,panel_client,state_sink}.py` + `tests/test_commands.py` - engine + 12 testes.

**Impacto arquitetural:** Backend continua só lendo/escrevendo Postgres; o worker fala HTTP (pull/ack/ingest/due), nunca toca o banco direto. Engine vive só no monorepo (cópia de referência); ativar exige portar pro repo de prod `automacao-insta` + tokens + launchd recorrente + merge→main. Tudo dry-run + integração testado; nada publicado.

---

## 2026-06-25 | feat(publicacao): telemetria do worker → painel Orgânico (ingest + hooks)

**O que foi feito:**
- **Cortex:** endpoint `POST /api/growth/organico/ingest` (token-auth via `ORGANICO_INGEST_TOKEN`, registrado PRÉ-`isAuthenticated`): insere 1 `content_publish_runs` + faz upsert dos `content_posts` (chave platform+task+data). Upsert validado contra a prod (transação com rollback).
- **Worker (instagram-turbo, stdlib):** `agente/state_sink.py` — POST fail-soft (urllib) do estado de cada ciclo; `panel_post`/`panel_state` mapeiam `PlannedAction` → estado do painel (agendado/aguardando_ia/publicado/falhou/pulado). Hooks em `main.py` (IG) e `main_tiktok.py` coletam o estado por task e chamam `report_cycle` no fim. Config nova: `CORTEX_INGEST_URL` + `ORGANICO_INGEST_TOKEN` (opcionais — sem elas o agente roda igual e só não atualiza o painel).

**Por que:**
- Fecha a Fase 1: o painel sai do vazio. Worker continua **zero-dependência** (só urllib) e **sem credencial de banco** — POSTa pro Cortex, que escreve. Reusa o padrão de endpoint-com-token (FCA).

**Arquivos alterados:**
- `server/routes/organico.ts` (+ `registerOrganicoIngestRoutes`), `server/routes.ts` (registro pré-auth).
- `automacoes/instagram-turbo/agente/state_sink.py` (novo) + `config.py` + `.env.example` + `main.py` + `main_tiktok.py`.

**Impacto arquitetural:** Refinamento do plano — em vez de o worker escrever direto no Postgres, ele reporta via HTTP pro Cortex (preserva zero-dep do worker, não espalha creds do banco). Pra ficar LIVE: setar `ORGANICO_INGEST_TOKEN` no Cortex (Render) + `CORTEX_INGEST_URL`/token no `.env` do worker. PROD do worker roda do repo separado `automacao-insta` → essa cópia precisa ser sincronizada lá.

---

## 2026-06-25 | chore(publicacao): script p/ aplicar a migration content_*

Script `scripts/apply-content-migration.ts`: aplica `migrations/2026-06-24-content-publish.sql` reusando a conexão do app (DATABASE_URL ou DB_*). Idempotente — caminho de 1 comando pra criar as tabelas `content_*` sem psql/GUI. **Impacto arquitetural:** Nenhum (helper).

---

## 2026-06-24 | feat(publicacao): página Orgânico (Growth) + endpoint read-only

**O que foi feito:**
- Nova página **Orgânico** em Growth (`/growth/organico`, permissão `growth.organico`): painel **somente leitura** com Saúde do agente (por plataforma), Fila de publicação e Histórico, filtro por rede (IG/TikTok/…) e refetch a cada 20s. Lê das tabelas `content_*`.
- Endpoint `GET /api/growth/organico/overview` (`server/routes/organico.ts`): retorna settings + último ciclo por plataforma + fila (hoje/futuro não publicado) + histórico (publicados).
- Fiação: `nav-config` (permission key + rota + item "Orgânico" + label), `App.tsx` (rota lazy), `app-sidebar` (ícone `Sprout` no mapa).

**Por que:**
- Fatia visível da Fase 1: o time enxerga fila/status/saúde da automação sem terminal. Read-only de propósito (botões de ação = Fase 3). Platform-aware desde já.

**Arquivos alterados:**
- `client/src/pages/GrowthOrganico.tsx` (novo) — a página.
- `server/routes/organico.ts` (novo) — endpoint de leitura.
- `server/routes.ts` — import + registro **pós-auth**.
- `shared/nav-config.ts` — permissão/rota/nav/label de `growth.organico`.
- `client/src/App.tsx` — rota `/growth/organico`.
- `client/src/components/app-sidebar.tsx` — ícone `Sprout` no mapa.

**Impacto arquitetural:** Endpoint registrado intencionalmente DEPOIS de `app.use("/api", isAuthenticated)` (linha 479) — registrar junto do Instagram (pré-auth por causa do OAuth) deixaria a rota sem autenticação. Sem dado real até a migration `content_*` ser aplicada e o worker popular as tabelas (painel mostra estados vazios). Não typechecado localmente (worktree sem node_modules) — validar no build/CI.

---

## 2026-06-24 | feat(publicacao): slot da tarde às 17h30 (granularidade de minutos)

**O que foi feito:**
- Move o slot vespertino do publicador de **18h para 17h30 cravado**: `SLOTS = ((12, 0), (17, 30))` em `agente/main.py`.
- Refatora `current_slot` / `slot_status_human` pra operar em **minutos do dia** (antes era hora cheia, não conseguia representar `:30`). Agora é genérico pra N slots e o rótulo vira `"17h30"` quando há minutos.
- Tolerância passa a ser `SLOT_TOLERANCE_MINUTES = 60` → janela efetiva 17:30–18:29 (garante que a rodada do cron pegue o slot mesmo sem cair no segundo exato).
- Teste `agente/tests/test_slots.py` trava o comportamento: 17:29 não abre, 17:30 abre, 18:29 ainda abre, 18:30 fecha.

**Por que:**
- O conteúdo programado pras 17h30 não saía porque o agente só tinha slots fixos de 12h e 18h — 17h30 caía na zona morta "entre slots" e o `execute_plan` se recusava a publicar. A correção alinha o horário de publicação ao que o time planejou.

**Arquivos alterados:**
- `automacoes/instagram-turbo/agente/main.py` - novo modelo de slot (hora, minuto) + helpers `_slot_label`/`_mins`/`_hhmm`; texto do `--force-now` atualizado p/ "12h/17h30".
- `automacoes/instagram-turbo/agente/tests/test_slots.py` - cobertura nova do slot 17h30 e das mensagens de fora-de-slot.

**Impacto arquitetural:** Nenhum. Mudança confinada ao adaptador/orquestrador do Instagram; núcleo agnóstico (`plan_task`, drive, docs) intocado. `slot` continua cabendo em `VARCHAR(8)` no schema `content_posts`.

---

## 2026-06-24 | feat(publicacao): fundação do painel "Orgânico" — skill + schema content_*

**O que foi feito:**
- Nova skill `.claude/skills/subir-conteudo-organico/SKILL.md`: blueprint do publicador multiplataforma (núcleo agnóstico `plan_task` + adaptador por plataforma) com checklist de "adicionar plataforma" para replicar IG → TikTok/YouTube/LinkedIn.
- Schema `content_*` no `cortex_core` (fonte da verdade do painel operador, platform-aware): `content_publish_runs` (saúde/heartbeat), `content_posts` (fila/status por task/dia), `content_publish_commands` (fila painel→worker) e `content_publish_settings` (toggle pausar/dry-run por plataforma). Definido em `shared/schema.ts` + migration SQL idempotente, com seed em dry-run ligado.

**Por que:**
- Início da Fase 1 do painel **Orgânico** (Growth): dar ao time de conteúdo (Esther + editores) visão de fila/status/saúde e operação da automação `instagram-turbo` sem terminal/Claude. Tabelas genéricas (`content_*`, não `instagram_*`) porque o mesmo painel/worker servirá IG, TikTok, YouTube e LinkedIn.

**Arquivos alterados:**
- `shared/schema.ts` - 4 tabelas `content_*` + tipos `$inferSelect/$inferInsert`.
- `migrations/2026-06-24-content-publish.sql` - DDL idempotente espelhando o schema + seed das settings (instagram, tiktok).
- `.claude/skills/subir-conteudo-organico/SKILL.md` - skill nova (blueprint + checklist por plataforma).

**Impacto arquitetural:** Estabelece o Postgres do Cortex como fonte da verdade entre o worker Python e o painel (o backend Express só lê/escreve as tabelas, nunca chama o Python). Aditivo — nenhuma tabela existente alterada. Migration ainda **não aplicada** no banco (pendente `drizzle-kit push` ou rodar o SQL).

---

## 2026-06-29 | fix(encurtador): UTM única (dedup) — não cria link duplicado

**O que foi feito:**
- `server/routes/utm.ts` — `POST /api/utm/generate` agora é **idempotente**: se a `full_url` exata já existe, reusa a linha existente (não cria duplicata). Clicar "Copiar e salvar" 2-3x na mesma UTM devolve sempre o mesmo registro.
- `server/routes/shortener.ts` — `POST /api/links/shorten` dedup por `target_url`: se o destino já tem um link curto, reusa o mesmo slug (e garante o KV) em vez de criar outro.
- `client/src/pages/UtmBuilder.tsx` — toast avisa "Essa UTM já existia — reutilizada" quando bate na dedup.

**Por que:**
- Ichino criou 3 UTMs idênticas sem querer (3 cliques no botão). A UTM tem que ser única e centralizadora — todos os cliques/MQL/venda de um destino ficam num link só, não espalhados em cópias.

**Arquivos alterados:**
- `server/routes/utm.ts` - dedup por full_url no generate.
- `server/routes/shortener.ts` - dedup por target_url no shorten.
- `client/src/pages/UtmBuilder.tsx` - toast de reutilização.

**Impacto arquitetural:** Nenhum. Dedup é só leitura-antes-de-inserir. Linhas duplicadas já existentes (criadas antes do fix) não são removidas automaticamente — limpeza é opcional/manual.

---

## 2026-06-29 | feat(encurtador): Fase 3 — Cloudflare Worker (redirect na borda + ingestão de clique)

**O que foi feito:**
- `cloudflare/shortener-worker/` (nova pasta, deploy separado via wrangler — fora do build do Cortex):
  - `src/index.ts` — Worker que responde em `marketing.turbopartners.com.br/<slug>`: lê o slug no KV (`LINKS`), faz 302 pro destino com UTM intacta, e via `ctx.waitUntil` dispara `POST /api/clicks` pro Cortex (header `x-click-secret`, com country/ipHash SHA-256/userAgent/referrer) sem atrasar o redirect. Slug inexistente ou raiz → `FALLBACK_URL` (o site), nunca 404.
  - `wrangler.toml` — rota `marketing.turbopartners.com.br/*`, binding KV `LINKS`, vars `CORTEX_CLICKS_URL`/`FALLBACK_URL` (secret fica via `wrangler secret put`).
  - `package.json` (wrangler + @cloudflare/workers-types), `tsconfig.json` (isolado, types do Cloudflare — não entra no tsconfig do app, que só inclui client/shared/server).
  - `README.md` — passo a passo da infra (KV namespace, secret, DNS AAAA `marketing`→`100::` proxied, `wrangler deploy`) + vars do Render no Cortex.
- `.gitignore` — `.wrangler`.

**Por que:**
- Fase 3 do encurtador: a peça que faz o link **de fato redirecionar e contar o clique**. Fecha o ciclo criar (Cortex) → redirecionar (Worker) → clique no Postgres → cruzar com Bitrix.

**Arquivos alterados:**
- `cloudflare/shortener-worker/{src/index.ts,wrangler.toml,package.json,tsconfig.json,README.md}` (novos).
- `.gitignore` - `.wrangler`.

**Impacto arquitetural:** Nenhum no app (pasta isolada, deploy separado). Código validado por `esbuild` (sintaxe OK). **Ativação depende da infra do Ichino** (login Cloudflare, criar KV, secret, DNS, `wrangler deploy`, vars no Render) — passo a passo no README. Sem isso, o Cortex segue criando/listando links com `kvSynced:false`.

---

## 2026-06-29 | feat(encurtador): Fase 4 revisão + Fase 5 — auto-encurtar + atribuição no Histórico

**O que foi feito:**
- **Auto-encurtar (decisão Ichino):** todo link gerado no UTM Builder já nasce com um link curto. `server/routes/shortener.ts` — `POST /api/links/shorten` aceita slug vazio e gera um aleatório (8 hex, com retry até achar livre); slug digitado mantém a guarda de unicidade (409 se ocupado).
- **Frontend (`client/src/pages/UtmBuilder.tsx`):** campo opcional "Nome do link curto" **antes** do botão; ao clicar "Copiar e salvar", gera a UTM **e** o link curto num passo só (auto-chama o shorten). Mostra o link curto resultante com copiar. Botão de retry "Encurtar" só aparece se o nome custom estava em uso.
- **Atribuição no Histórico (Fase 5, Caminho A — por UTM):** `GET /api/utm/history` ganhou CTEs `click_agg` (cliques por slug) e `deal_agg` (cruza `"Bitrix".crm_deal` por tupla UTM source+medium+campaign+content) com as **mesmas regras do Orçado x Realizado** (`growth.ts:232-269`): MQL = `mql '1'/'true'`, Reunião marcada = `data_reuniao_agendada`, realizada = `data_reuniao_realizada`, Venda = `stage_name 'Negócio Ganho'`. A tabela do Histórico ganhou colunas: Link curto, Cliques, MQL, Reun. marc., Reun. real., Vendas.
- **Removida a página `/links` separada** (decisão Ichino: tudo no Histórico): deletado `client/src/pages/LinkShortener.tsx`, rota + lazy import em `App.tsx`, botão "Links curtos" no UTM Builder.

**Por que:**
- Ichino pediu: (1) todo link já encurtado por padrão; (2) MQL/reunião/venda por link junto do histórico, "igual ao Orçado x Realizado", em vez de aba separada. Atribuição por UTM (Caminho A) — granularidade = unicidade da UTM.

**Arquivos alterados:**
- `server/routes/shortener.ts` - slug aleatório quando vazio (retry).
- `server/routes/utm.ts` - history com cliques + funil cruzando crm_deal por UTM.
- `client/src/pages/UtmBuilder.tsx` - fluxo gera+encurta; colunas de funil no Histórico; remove botão/import de /links.
- `client/src/App.tsx` - remove rota /links.
- `client/src/pages/LinkShortener.tsx` - **deletado**.

**Impacto arquitetural:** Nenhum estrutural. Validado: `esbuild` (server) e `vite build` passam; a query nova do Histórico foi executada direto no banco local (roda sem erro de permissão na `"Bitrix".crm_deal`; local tem 19.509 deals / 3.645 MQLs / 793 vendas, confirmando que a atribuição produz números reais). Atribuição por UTM: links de UTM idêntica compartilham os mesmos números (limitação aceita do Caminho A). Redirect real ainda depende da Fase 3 (Cloudflare).

---

## 2026-06-29 | feat(encurtador): Fase 4 — frontend (botão "Encurtar" no UTM Builder + página /links)

**O que foi feito:**
- `client/src/pages/UtmBuilder.tsx` — depois de gerar a UTM, aparece um bloco **"Encurtar este link"**: input de slug (prefixo `marketing.turbopartners.com.br/`, sanitizado ao digitar, Enter envia) + botão que chama `POST /api/links/shorten` (passa `targetUrl` = URL gerada e `generatedUtmLinkId`). Mostra o link curto resultante com botão copiar. Toast informa se já redireciona (`kvSynced`) ou se está só no banco. Botão **"Links curtos"** no topo (ao lado das tabs) leva pra `/links`.
- `client/src/pages/LinkShortener.tsx` (novo) — página `/links`: tabela dos links curtos (slug, destino, campanha/UTM, **cliques**, criador, data) via `GET /api/links`, com copiar e estado vazio. Dark/light mode (tokens `muted`/`foreground`).
- `client/src/App.tsx` — lazy import + rota `/links` (ProtectedRoute, mesmo padrão do UTM Builder).
- `.env.example` — documentadas as vars do encurtador (`SHORTENER_BASE_URL`, `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN`, `CLICK_INGEST_SECRET`) com nota de que em local roda sem elas.

**Por que:**
- Fase 4 do encurtador (plano em `docs/encurtador-links-plano.md`): a UI que fecha o fluxo de criar e gerir links curtos a partir do UTM Builder, testável no preview mesmo sem o Cloudflare (Fase 3) configurado.

**Arquivos alterados:**
- `client/src/pages/UtmBuilder.tsx` - bloco "Encurtar" na aba Gerar + botão "Links curtos" + import do `Link` (wouter).
- `client/src/pages/LinkShortener.tsx` (novo) - página de gestão.
- `client/src/App.tsx` - lazy import + rota `/links`.
- `.env.example` - vars do encurtador.

**Impacto arquitetural:** Nenhum estrutural. Validado: `vite build` passa (chunk `LinkShortener-*.js` gerado, `UtmBuilder-*.js` rebuildado), sem erro de import/sintaxe. Fluxo end-to-end de redirect depende da Fase 3 (Cloudflare Worker + KV) e das env vars de prod; em local o link é criado e listado, e o clique pode ser simulado via `POST /api/clicks`.

---

## 2026-06-29 | feat(encurtador): Fase 2 — backend (rotas + criação das tabelas no boot)

**O que foi feito:**
- `server/db.ts` — função `initializeShortLinksTables()` cria `cortex_core.short_links` e `short_link_clicks` (CREATE TABLE IF NOT EXISTS + índices), seguindo o padrão das demais `initialize*Table()` do repo. Idempotente; roda no boot (local e prod), sem precisar de `db:push`.
- `server/index.ts` — `initializeShortLinksTables()` adicionada ao `Promise.all` de inicialização + import.
- `server/routes/shortener.ts` (novo) — três rotas:
  - `POST /api/links/shorten` (Growth + admins): valida/sanitiza o slug (estrito `[a-z0-9-]`, reservados bloqueados), extrai a UTM do `targetUrl`, grava em `short_links` com guarda de unicidade (`ON CONFLICT (slug)` → 409) e escreve `slug→targetUrl` no KV do Cloudflare (best-effort: sem `CF_*` em local, pula o KV e retorna `kvSynced:false`).
  - `GET /api/links` (Growth + admins): lista links + contagem de cliques (LEFT JOIN agregado) + nome do criador.
  - `POST /api/clicks`: ingestão de clique do Worker, protegida por header secreto `x-click-secret` (`CLICK_INGEST_SECRET`); grava em `short_link_clicks`.
- `server/routes.ts` — registro de `registerShortenerRoutes(app)` + import.

**Por que:**
- Fase 2 do encurtador (plano em `docs/encurtador-links-plano.md`): a camada de servidor pra criar/gerir links e receber cliques, pronta pra ser consumida pelo frontend (Fase 4) e pelo Worker (Fase 3).

**Arquivos alterados:**
- `server/db.ts` - função de init das duas tabelas.
- `server/index.ts` - wiring no boot.
- `server/routes/shortener.ts` (novo) - rotas shorten/links/clicks.
- `server/routes.ts` - import + registro.

**Impacto arquitetural:** Nenhum estrutural. Tabelas criadas pela convenção `initialize*Table()` existente (não usa `db:push`, evitando diff do schema inteiro). Validado: `tsc` não acusa erro novo nos arquivos tocados (erros restantes são pré-existentes no `routes.ts`); `esbuild` bundla o server limpo (exit 0). KV e auth de clique são best-effort sem `CF_*`/`CLICK_INGEST_SECRET`, então o backend roda no preview local. Falta env de prod: `SHORTENER_BASE_URL`, `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN`, `CLICK_INGEST_SECRET`.

---

## 2026-06-29 | feat(encurtador): Fase 1 — tabelas short_links e short_link_clicks

**O que foi feito:**
- `shared/schema.ts` — duas tabelas novas no schema `cortex_core` para o encurtador de links da Turbo (`marketing.turbopartners.com.br/<slug>`):
  - `short_links`: cadastro do link curto (slug único personalizado, target_url com UTM, UTM desmembrada, FK lógica p/ generated_utm_links, created_by, expires_at). Índices em created_by e utm_campaign.
  - `short_link_clicks`: um registro por clique (slug, clicked_at, country ISO-2, ip_hash, user_agent, referrer) para cruzar clique → lead (Bitrix) → venda por UTM. Índices em slug e clicked_at.
- Tipos `ShortLink`/`InsertShortLink`/`ShortLinkClick`/`InsertShortLinkClick` exportados.
- Plano completo do encurtador documentado em `docs/encurtador-links-plano.md`.

**Por que:**
- Base (Fase 1) do encurtador próprio: redirect via Cloudflare Worker na borda, mas cadastro + cliques no Postgres do Cortex para atribuição cruzada com Bitrix/Meta (nível "contar + cruzar"). Arquitetura e decisões em `docs/encurtador-links-plano.md`.

**Arquivos alterados:**
- `shared/schema.ts` - tabelas `short_links` e `short_link_clicks` + tipos (schema `cortex_core`).
- `docs/encurtador-links-plano.md` (novo) - plano de implementação (5 fases) e decisões travadas.

**Impacto arquitetural:** Nenhum estrutural. Só definição de schema (Drizzle); `tsc --noEmit` não acusa erros no schema. Criação física das tabelas (`npm run db:push`) é passo separado, ainda não executado.

## 2026-06-29 | feat(churn): histórico mensal de churn por motivo na tela Detalhamento

**O que foi feito:**
- Novo gráfico na tela /detalhamento-churn (abaixo dos KPIs): barras empilhadas por mês × motivo de cancelamento + linha tracejada com a meta de churn do BP 2026.
- Novo endpoint `GET /api/analytics/churn-historico-mensal?ano&filterAbono` retornando a série mensal pivotada por motivo.
- Novo componente `client/src/components/churn/ChurnHistoricoMensal.tsx` (Recharts ComposedChart), eixo de jan até o mês atual.

**Por que:**
- Faltava a visão histórica do ano na tela; o pedido foi reproduzir o estilo do gráfico "Churn Squad Mês" do ClickUp, mas com a régua da própria tela (consistência com o card MRR Perdido).

**Arquivos alterados:**
- `server/routes.ts` - endpoint do histórico mensal (mesma régua da tela: exclui os 3 motivos "não-base", aplica abono via filterAbono).
- `client/src/components/churn/ChurnHistoricoMensal.tsx` - componente do gráfico.
- `client/src/pages/ChurnDetalhamento.tsx` - integração (passa filterAbono e BP_CHURN_MRR_TARGETS).

**Impacto arquitetural:** Nenhum — endpoint e componente novos, isolados; o histórico acompanha o toggle de abono da tela.

---

## 2026-06-29 | fix(churn): alinhar Detalhamento de Churn ao ClickUp (abonados contam por padrão)

**O que foi feito:**
- A tela /detalhamento-churn passou a contar contratos abonados (`abonar_churn='Sim'`) como churn por padrão; o toggle "Todos/Não abonados/Abonados" virou o único controle de exclusão de abono.
- Mantida a exclusão dos motivos "nunca virou base" (Inadimplente 1º Mês / Não começou / Erro na Venda) na query do endpoint, que é o que o ClickUp também desconta.
- `isAbonado` no backend agora é apenas o flag manual; removido o `!is_abonado` redundante de ChurnKpisHero, RitmoDiario, ChurnPorDimensao, DrawerTiming e do `filteredMetricas`.

**Por que:**
- O "Churn MRR" do ClickUp (jun/2026 = R$ 161.468) não batia com o "MRR Perdido" do Cortex (R$ 139.080). A diferença de R$ 22.388 eram 4 contratos marcados `abonar_churn='Sim'` que o ClickUp conta e o Cortex escondia. Validado no banco de prod: régua nova → "Todos" = R$ 161.468 (bate), "Não abonados" = R$ 139.080, "Abonados" = R$ 22.388.

**Arquivos alterados:**
- `server/routes.ts` - endpoint `/api/analytics/churn-detalhamento`: exclui os 3 motivos no WHERE, `isAbonado` = só flag, métricas usam `allContratos`.
- `client/src/pages/ChurnDetalhamento.tsx` - `filteredMetricas` usa a lista já filtrada pelo toggle.
- `client/src/components/churn/{ChurnKpisHero,RitmoDiario,ChurnPorDimensao,drawer/DrawerTiming}.tsx` - removido o filtro `!is_abonado` interno.

**Impacto arquitetural:** Nenhum — escopo restrito à tela Detalhamento de Churn; BP 2026, OKR, NRR e slides não foram tocados (continuam com a régua de churn líquido).

---

## 2026-06-24 | feat(bp-copilot): UI do chat (Fase 2)

**O que foi feito:**
- `client/src/pages/BpCopilot.tsx` — página de chat no padrão Growth AI (sidebar de conversas + chat com ReactMarkdown + cards de sugestão + input), tema azul, dark/light, modelo "Claude Opus 4.8".
- Cards de sugestão específicos do BP: fechamento do ano, maior gargalo, what-if de churn (+2pp), queima de caixa, atingimento por produto, linhas fora da meta.
- Rota `/bp-2026/copilot` registrada em `App.tsx` (lazy + ProtectedRoute).
- Botão **"BP Copilot"** no header do BP 2026; botão "Voltar ao BP 2026" na sidebar do chat.

**Por que:**
- Fase 2 do BP Copilot (spec em `docs/superpowers/specs/2026-06-24-bp-copilot-design.md`): a interface sobre o backend da Fase 1.

**Arquivos alterados:**
- `client/src/pages/BpCopilot.tsx` (novo) - página do chat.
- `client/src/App.tsx` - lazy import + rota `/bp-2026/copilot`.
- `client/src/pages/BP2026.tsx` - botão de acesso ao Copilot no header.

**Impacto arquitetural:** Nenhum estrutural. Validado: `vite build` passa e a página é bundleada (chunk `BpCopilot-*.js`); typecheck não introduz erros novos (delta 0). Fluxo real depende da chave Anthropic válida (Fase 1).

---

## 2026-06-24 | feat(bp-copilot): backend núcleo (Fase 1) — tools, agentic loop, histórico

**O que foi feito:**
- `computarBpReceitas(db)` extraída da rota `/api/bp2026/receitas` em `bp2026.ts` (handler virou wrapper) — mesmo cálculo e cache de 10min, agora reutilizável.
- `bp-copilot.tools.ts`: 7 ferramentas read-only que fatiam o payload do BP (overview, revenue, vendas-produto, funil, capacity, detalhamentos, pontual) + `montarResumoBp()` (snapshot textual do estado do BP p/ o contexto).
- `bp-copilot.ts`: endpoint do chat (Anthropic `claude-opus-4-8`, adaptive thinking, prompt caching na skill) com agentic loop (tools + code execution server-side p/ projeções), histórico em `bp_copilot_conversas`/`mensagens`, logging em `bp_copilot_usage`, auth restrita a admin/sócios. Registrado em `routes.ts`.

**Por que:**
- Fase 1 do BP Copilot (spec em `docs/superpowers/specs/2026-06-24-bp-copilot-design.md`): o "corpo" do agente. UI, streaming e ações registráveis vêm nas fases 2-4.

**Arquivos alterados:**
- `server/routes/bp2026.ts` - extraída `computarBpReceitas`; rota vira wrapper (comportamento idêntico).
- `server/routes/bp-copilot.tools.ts` (novo) - ferramentas read-only + resumo do BP.
- `server/routes/bp-copilot.ts` (novo) - endpoint, agentic loop, histórico, auth.
- `server/routes.ts` - registro de `registerBpCopilotRoutes`.

**Impacto arquitetural:** Reaproveita os módulos `bp2026.*` (agente vê os mesmos números da tela). Validado: camada de dados roda contra dados reais (smoke local OK); typecheck não introduz erros novos (delta 0). End-to-end com Anthropic não validado localmente — chave `ANTHROPIC_API_KEY` do .env local retorna 401 (expirada); em produção usa a mesma var do SDR Assistant.

---

## 2026-06-24 | feat(bp-copilot): skill/persona do BP Copilot (system prompt)

**O que foi feito:**
- Criado `agents/bp-copilot-SKILL.md` — system prompt do **BP Copilot**, o copiloto de decisão do BP (Anthropic `claude-opus-4-8`).
- 7 blocos: identidade/postura (copiloto consultivo híbrido, C-level), princípios de comportamento (BLUF, número real ou nada, faixa não ponto), domínio do negócio com **os gotchas críticos do BP embutidos** (churn bruto, produto×servico jan corrompido, AOV só valorr>0, venda-estoque×receita-pontual com lag, regime caixa×competência), estrutura do BP (abas + YTD fluxo/estoque), ferramentas (drill bp2026.* + code execution + ações registráveis), capacidades (diagnóstico/gargalo/predição), formato executivo.

**Por que:**
- Primeira etapa da feature "chat especialista de tomada de decisão no BP". A persona é o que impede o agente de confundir artefato de dados com tendência e garante recomendações ancoradas em número real.

**Arquivos alterados:**
- `agents/bp-copilot-SKILL.md` (novo) - persona e habilidades do agente.

**Impacto arquitetural:** Nenhum ainda — artefato de prompt; backend/UI/tools virão nas próximas etapas. Design em `docs/superpowers/specs/` (a seguir).

---

## 2026-06-24 | feat(comercial): exibir só os 7 closers ativos nas telas de comercial

**O que foi feito:**
- A coluna `"Bitrix".crm_closers.active` passou a ser a whitelist de closers ativos. Marcados `active=true` apenas os 7: Arthur Zon, Fabio Richard, Daniel Basilio, Matheus Scalfoni, Ramon Reis, Roberto Fachetti, Rodrigo Pimenta.
- Inserido **Rodrigo Pimenta** (id 1154) na `crm_closers` — não existia, por isso era excluído dos rankings com `INNER JOIN`.
- **Dropdowns/filtros** (`/api/closers/list`, `/api/comercial/funil/filtros`) passam a retornar só `active=true`.
- **Rankings** (`chart-receita`, `chart-reunioes-negocios`, `mrr-por-closer`, `detalhamento/por-closer`) trocaram `INNER`→`LEFT JOIN` e agregam os não-ativos (e deals sem closer) sob **"Outros"**, preservando os totais.
- **Ranking de slides do Reporte Mensal** mostra só os 7 (sem "Outros", por ser ranking com fotos).

**Por que:**
- As telas de comercial mostravam ~30 nomes (ex-funcionários, SDRs, closers antigos). A pedido, restringir a exibição de closers aos 7 atuais, sem alterar os totais de vendas.

**Arquivos alterados:**
- `server/routes/comercial.ts` - filtro `active` nos dropdowns; `LEFT JOIN` + bucket "Outros" nos 4 endpoints de ranking.
- `server/routes/relatorioMensalSlides.ts` - ranking de closers do mês filtra `c.active = true`.
- Dados (fora do git): `INSERT` Rodrigo Pimenta + `UPDATE active` aplicados em **local + produção**.

**Impacto arquitetural:** Nenhum estrutural. Validado no banco: soma das linhas (7 + "Outros") = total geral (R$ 1.639.418 / 441 deals em 2026), totais preservados.

---

## 2026-06-24 | fix(bp2026): AOV/Contratos por produto contam só contratos com MRR>0

**O que foi feito:**
- Na aba **Revenue** do BP 2026 (`bp2026.revenue.ts`), o `COUNT(DISTINCT id_subtask)` por produto passou a aplicar `FILTER (WHERE COALESCE(valorr,0) > 0)`.
- Afeta as linhas **"Contratos — <produto>"** e **"AOV — <produto>"** (AOV = MRR ÷ contratos).
- Validado em produção (abril): Creators AOV 1.408 → 5.951 (contratos 186 → 44); Others 895 → 2.229; Performance/Social/GC praticamente inalterados.

**Por que:**
- Contratos pontuais (têm `valorp`, `valorr = 0`) em status ativo/onboarding/triagem entravam no denominador do AOV sem somar nada no numerador, diluindo o indicador — gritante em Creators, que virou majoritariamente pontual a partir de abril.
- Alinha o tratamento à aba **Vendas por Produto**, que já filtrava `valorr > 0`.

**Arquivos alterados:**
- `server/routes/bp2026.revenue.ts` - filtro `valorr > 0` no COUNT de contratos do snapshot por produto.

**Impacto arquitetural:** Nenhum — mudança isolada na query do snapshot; numerador (MRR), churn% e MRR Ativo permanecem idênticos.

---

## 2026-06-23 | feat(creators): adicionar ticket médio na evolução LT/LTV Recorrente × Pontual

**O que foi feito:**
- Nova linha **"Ticket médio"** na tabela "Evolução mensal — LT & LTV Recorrente × Pontual" (aba Creators da tela `/lt-ltv-churn`).
- **Recorrente** = MRR do mês ÷ clientes ativos faturando (mensalidade média). Backend: novo `COUNT(*) FILTER (WHERE mrr > 0)` em `rec_agg`.
- **Pontual** = valor entregue no mês ÷ nº de entregas do mês (preço médio por entrega). Backend: novo `COUNT(*)` em `pont_fat`.
- Ticket calculado no map do endpoint (`null` quando o denominador é 0); nota do card atualizada explicando a definição por modelo.

**Por que:**
- A pedido: comparar o ticket médio entre os modelos de receita de Creators. O denominador "limpo" (só quem fatura/entrega) evita diluição — usar o total de clientes (com cancelados) subestimaria a mensalidade recorrente.

**Arquivos alterados:**
- `server/routes/creatorsModelo.ts` - expõe `rec_cli_fat`/`pont_ent` na query do endpoint `/api/creators-modelo/evolucao` e calcula `ticket` por modelo.
- `client/src/components/creators-modelo/EvolucaoLtLtv.tsx` - campo `ticket` no tipo `ModMetric`, linha na tabela e nota explicativa.

**Impacto arquitetural:** Nenhum — reaproveita o pipeline e o padrão de renderização já existentes.

---

## 2026-06-23 | feat(bp2026): linha "CAC por contrato" na aba CAC

**O que foi feito:**
- Nova métrica `cac_por_contrato` na aba CAC do BP 2026, logo abaixo de "CAC por cliente adquirido".
- Denominador = total de contratos vendidos no mês (recorrentes + pontuais, todos os segmentos), derivado do mesmo `agg` do Bitrix que alimenta o bloco "CAC por Produto". Um deal com N produtos/naturezas conta N contratos.
- Orçado = CAC orçado ÷ contratos vendidos orçados (`contratos_vendidos_mrr_*` + `contratos_vendidos_pontual_*`); YTD = Σ numerador ÷ Σ denominador.
- Linha marcada como `semDetalhe` (sem drill-down).
- Verificado contra o banco real: CAC/contrato fica ≤ CAC/cliente em todos os meses (jan–jun), pois contratos ≥ deals ganhos.

**Por que:**
- "CAC por cliente" usa CAC total ÷ deals ganhos; faltava a visão por contrato. Como um cliente pode fechar mais de um contrato, o custo por contrato é menor e mais granular. Usar rec+pontual no denominador deixa a métrica apples-to-apples com a de "por cliente" (mesmo numerador, denominador análogo).

**Arquivos alterados:**
- `server/routes/bp2026.detalhamentos.ts` - cálculo da linha `cac_por_contrato` (série, orçado, YTD, `semDetalhe`) e import de `SEGMENTOS_PONTUAIS`.
- `server/routes/bp2026.ts` - série `contratosVendidosTotalPorMes` (Σ contratosRec + contratosPont do `agg`) passada ao `montarDetalhamentos`.
- `server/routes/bp2026.info.ts` - documentação (definição/fonte/cálculo) da nova métrica.

**Impacto arquitetural:** Nenhum — nova linha derivada reusa fontes existentes; frontend (`BPDreTable`) renderiza automaticamente.

---

## 2026-06-21 | refactor(sync-jobs): job único 12h roda todas as plataformas de ads juntas

**O que foi feito:**
- Consolidados os jobs de sync de mídia paga num **único job a cada 12h** que roda **Meta + Google + TikTok + LinkedIn juntos**, em paralelo e isolados (`Promise.allSettled` — uma plataforma falhar não derruba as outras). Antes eram 5 jobs separados (Meta 6h + 3 escalonados).
- Novo `server/services/adsSyncAll.ts` (`syncAllAdsPlatforms`) — orquestrador reusável pelo job agendado e pelo runner manual.
- `scripts/run-all-ads-sync.ts` passou a reusar o orquestrador (uma fonte da verdade).
- Preserva `__metaSyncStatus` para o endpoint `/api/meta-ads/sync-status`.

**Por que:**
- A pedido: todas as plataformas no mesmo ciclo; 12h é suficiente para dado diário e mais gentil com o rate-limit das APIs. O job de keywords da agência (schema `google_ads`) fica à parte.

**Arquivos alterados:**
- `server/services/adsSyncAll.ts` (novo) · `server/index.ts` (Meta 6h → job unificado 12h; remove os 3 blocos por plataforma) · `scripts/run-all-ads-sync.ts` (reusa o serviço).

**Impacto arquitetural:** Um ponto único de orquestração dos 4 canais de ads.

---

## 2026-06-21 | feat(sync-jobs): syncs de Google/TikTok/LinkedIn agendados + fix Google Ads API v21

**O que foi feito:**
- **Fix Google Ads API:** `googleSync.ts` usava a API v20, que o Google descontinuou → o sync da Turbo falhava com `UNSUPPORTED_VERSION` e os dados pararam em 11/jun. Subido para **v21** (sondado: v21..v24 ativas; v21 é a mais antiga ativa, minimiza breaking changes nas GAQL). Validado: voltou a puxar (dado fresco, gasto de junho saltou de R$1.291 → R$2.413).
- **Agendadores em produção** (no `server/index.ts`, espelhando o job do Meta de 6h): Google Turbo, TikTok Ads e LinkedIn Ads passam a rodar no boot (escalonados 75s/105s/135s) e a cada **12h**. Antes só o Meta era agendado; os outros tinham serviço pronto mas ninguém disparava.
- `scripts/run-tiktok-ads-sync.ts`: runner manual do sync de TikTok Ads.

**Por que:**
- Sem isso, Google/TikTok/LinkedIn nunca ficavam frescos (Google parou em 11/jun por causa da API morta; TikTok estava zerado por nunca ter rodado). Agora os 4 canais atualizam sozinhos como o Meta.

**Descobertas de diagnóstico (não-código):**
- A credencial `advertiser` do TikTok já está conectada (3 contas desde 05/jun); a `INSTAGRAM_ENCRYPTION_KEY` correta é hex de 64 chars (a local estava corrompida — corrigida no .env local, que é gitignored).
- Em produção o app conecta como `postgres` (superuser) → não há barreira de permissão; o `permission denied` em tiktok/linkedin é só do role local `growth_dev`.

**Arquivos alterados:**
- `server/services/googleSync.ts` - API_VERSION v20 → v21.
- `server/index.ts` - 3 novos jobs de sync agendados (12h).
- `scripts/run-tiktok-ads-sync.ts` - runner manual (novo).

**Impacto arquitetural:** Paridade de automação entre as 4 plataformas de mídia paga. Cada job isola erros (try/catch + status em globalThis) — uma plataforma falhando não derruba as outras nem o boot.

---

## 2026-06-21 | feat(orcamento-campanhas): multi-plataforma (TikTok/LinkedIn) + projeção conta hoje

**O que foi feito:**
- **Projeção (As Is)** passou a considerar o gasto de **hoje** ao decidir se uma campanha "está entregando". Antes a janela era os 3 dias *anteriores* (excluindo hoje), então campanhas criadas/iniciadas hoje não tinham o orçamento extrapolado na projeção — só o gasto já realizado. Agora `date <= CURRENT_DATE`.
- **Suporte multi-plataforma** na aba: além de Meta e Google, agora há blocos de fetch para **TikTok** (`tiktok.ad_campaigns` / `ad_metrics_daily`) e **LinkedIn** (`linkedin.*`). Cada plataforma tem `try/catch`: se o schema não existir ou faltar permissão, é ignorada sem quebrar as demais.
- Constante `PLATFORMS` (meta|google|tiktok|linkedin) com type derivado; `ACTIVE_STATUSES` cobre os enums de status de cada canal. Endpoints `/tag` e `/stage` validam contra `PLATFORMS`; removido o CHECK de `platform` em `campaign_tags`.
- Front: rótulos/ordem/cores/ícones para as 4 plataformas (Meta azul, Google âmbar, TikTok rosa, LinkedIn ciano) e sub-agrupamento por plataforma já genérico.

**Por que:**
- A aba será usada com todos os canais de mídia paga. Deixar a estrutura pronta faz adicionar um canal ser "só plugar" (constante + bloco de fetch). A correção da projeção evita subestimar o investimento ao subir campanhas novas no meio do mês.

**Arquivos alterados:**
- `server/routes/orcamentoCampanhas.ts` - janela de entrega inclui hoje; PLATFORMS/ACTIVE_STATUSES; blocos TikTok/LinkedIn; validação de plataforma nos endpoints.
- `server/db.ts` + `scripts/create_campaign_tags.sql` - remove CHECK de platform em campaign_tags.
- `client/src/pages/GrowthOrcamentoCampanhas.tsx` - 4 plataformas (type/labels/cores/ícones); remove flag SHOW_GOOGLE.

**Impacto arquitetural:** Adiciona plataformas como dimensão extensível. Em prod, TikTok/LinkedIn só aparecem se o role do app tiver SELECT nos schemas `tiktok`/`linkedin` (localmente o `growth_dev` não tem — queries validadas por sintaxe, mas permission denied).

---

## 2026-06-20 | feat(orcamento-campanhas): planejamento top-down por etapa do funil

**O que foi feito:**
- O planejamento de investimento deixou de ser por campanha individual e passou a ser por **etapa do funil**. Define-se o total mensal do pool e distribui-se entre as etapas (Descoberta, Relacionamento, Conversão, Remarketing, Institucional).
- Alvo de cada etapa em modo **híbrido**: % do total do pool ou valor R$ travado, com **barra de fechamento** ao vivo (mostra distribuído vs total: "fecha 100%", "faltam X" ou "passou X").
- Tabela reagrupada por etapa dentro da aba (pool). O cabeçalho de cada etapa mostra alvo, orç. diário atual, projeção, investido, % atingido e o ritmo R$/dia necessário para bater o alvo.
- Campanhas viram execução: só somam o gasto real ao balde da etapa, sem alvo individual. Select de etapa por campanha (manual).
- DB: `campaign_tags` ganhou coluna `stage` (e `tag` virou nullable); novas tabelas `budget_pool_plan` (total por pool/mês) e `budget_stage_plan` (alvo por etapa, value+unit).
- Backend: GET retorna `stage` por campanha e `plans` por pool; novos endpoints `PUT /stage`, `/plan/total` e `/plan/stage`.

**Por que:**
- Calcular meta R$ campanha a campanha era inviável e impreciso. Planejar por etapa (com % do total) deixa o replanejamento instantâneo — mudou o total, todas as etapas em % reescalam sozinhas.

**Arquivos alterados:**
- `server/db.ts` - coluna stage + tabelas de plano no bootstrap.
- `server/routes/orcamentoCampanhas.ts` - constante CAMPAIGN_STAGES, stage/plans no GET, endpoints de stage e plano.
- `client/src/pages/GrowthOrcamentoCampanhas.tsx` - reestruturação por etapa, editores de plano (total + alvo híbrido), barra de fechamento, select de etapa.
- `scripts/create_campaign_tags.sql` - stage + migração de tag nullable.
- `scripts/create_budget_plan.sql` - tabelas de plano (referência).

**Impacto arquitetural:** Muda a unidade de planejamento (campanha → etapa). A `campaign_monthly_budget` e o endpoint `/meta` ficam órfãos (não usados na UI nova), preservados por ora; podem ser removidos depois.

---

## 2026-06-20 | feat(orcamento-campanhas): tags/grupos por campanha com abas de filtro

**O que foi feito:**
- Nova tabela `cortex_core.campaign_tags` (tag única por campanha, sem coluna `month` — a classificação persiste entre meses).
- Coluna "Grupo" editável inline na tela /growth/orcamento-campanhas (dropdown Inbound/Evento/Sem tag), restrita aos editores autorizados.
- Abas de filtro no topo (Todas / Inbound / Evento / Sem tag) com contagem por aba; cards de resumo, subtotais e tabela passam a refletir a aba ativa.
- Endpoint `PUT /api/growth/orcamento-campanhas/tag` para salvar/limpar a tag, validando contra a constante `CAMPAIGN_TAGS`.

**Por que:**
- A conta de Meta Ads é compartilhada por times com produtos/orçamentos distintos (ex: funis principais vs. campanhas de evento de outro time), o que polui a visão de orçamento. As abas permitem isolar e somar o orçamento de cada grupo separadamente.

**Arquivos alterados:**
- `server/db.ts` - criação da tabela `campaign_tags` no bootstrap.
- `server/routes/orcamentoCampanhas.ts` - constante `CAMPAIGN_TAGS`, anexa `tag` em cada campanha no GET, novo endpoint PUT de tag.
- `client/src/pages/GrowthOrcamentoCampanhas.tsx` - abas de filtro, coluna Grupo com `TagSelect` inline, filtro/contagem por aba.
- `scripts/create_campaign_tags.sql` - script de referência da tabela.

**Impacto arquitetural:** Nenhum — segue o mesmo padrão da tabela `campaign_monthly_budget` e dos endpoints existentes da mesma tela.

---

## 2026-06-19 | feat(tiktok): agendar sync orgânico + script de disparo manual

**O que foi feito:**
- Adicionado o job `runTiktokOrganicSync` ao scheduler em `server/index.ts` (12h em 12h, primeiro disparo ~105s após o boot), espelhando o padrão de Meta/Instagram. O job é gated em `TIKTOK_APP_ID`/`TIKTOK_APP_SECRET`: sem as credenciais do app ele apenas loga "pulando", sem poluir `tiktok.sync_runs`.
- Criado `scripts/sync-tiktok-organic.ts` para disparo manual do sync (`npx tsx scripts/sync-tiktok-organic.ts`).

**Por que:**
- O pipeline de métricas orgânicas do TikTok já existia ponta a ponta (OAuth → tabelas `tiktok.*` → `tiktokOrganicSync` → endpoint `/api/growth/orcado-realizado/tiktok` → tela Orçado x Realizado), mas o sync **nunca rodava sozinho** (não estava no scheduler) — por isso a tela exibia tudo zerado. Agendar o sync + ter um disparo manual destrava o abastecimento assim que as credenciais forem confirmadas no ambiente (prod/Render).

**Arquivos alterados:**
- `server/index.ts` - novo bloco do job `runTiktokOrganicSync` (setTimeout inicial + setInterval 12h) com gate de env.
- `scripts/sync-tiktok-organic.ts` - runner manual do sync orgânico (reusa o `pool` de `server/db`).

**Impacto arquitetural:** Nenhum — reusa o serviço `syncTiktokOrganic` e o padrão de scheduler já existentes; nenhuma tabela nem contrato de API novo.

---

## 2026-06-18 | style(relatorio-mensal): slide Pontual preenche o espaço após remoção do bloco

**O que foi feito:**
- A "Linha 2" do slide Pontual (gráfico "Entregas por Produto × Mês" + lista "Em Aberto por Serviço") passou de altura fixa (`260px`) para `flex-1 min-h-0` + `grid-rows-1`, ocupando o espaço que sobrou após a remoção do bloco "Tempo Médio de Entrega por Produto".

**Por que:**
- Sem o bloco removido, a tela ficava com um vazio grande embaixo; agora os dois gráficos enquadram e preenchem o slide.

**Arquivos alterados:**
- `client/src/pages/relatorio-mensal/SlidePontual.tsx`

**Impacto arquitetural:** Nenhum — ajuste de layout.

## 2026-06-18 | feat(relatorio-mensal): remove "Tempo Médio de Entrega por Produto" do slide Pontual

**O que foi feito:**
- Removido o bloco "Tempo Médio de Entrega por Produto (últimos 6 meses)" do slide Pontual (`SlidePontual.tsx`).
- Limpeza dos órfãos: variáveis `tempoMedioEntrega`/`topTempoMedio`/`maxDias` e import `Clock` removidos do componente.
- Backend/tipo `PontualData.tempoMedioEntrega` mantido intacto (apenas a exibição foi removida).

**Por que:**
- Solicitado: a métrica não é mais necessária na tela de Pontual.

**Arquivos alterados:**
- `client/src/pages/relatorio-mensal/SlidePontual.tsx`

**Impacto arquitetural:** Nenhum — remoção de bloco de UI.

## 2026-06-18 | feat(relatorio-mensal): Vendas YTD e Vendas CX & Upsell após a Capa Comercial

**O que foi feito:**
- Reordenados os slides do Reporte Mensal: "Vendas YTD" e "Vendas CX & Upsell" movidos para **depois** da "Capa Comercial" (antes vinham antes dela).
- Nova ordem da seção: Faturamento YTD → Capa Comercial → Vendas YTD → Vendas CX & Upsell → Ranking Closers.
- Ajustado `FIXED_SLIDE_NAMES` e o switch de render (`case 5`→Capa Comercial, `6`→Vendas YTD, `7`→Vendas CX & Upsell) em `RelatorioMensal.tsx`. Sem mudança na contagem total de slides.

**Por que:**
- Os slides de vendas pertencem à seção Comercial e devem aparecer após a capa da seção.

**Arquivos alterados:**
- `client/src/pages/RelatorioMensal.tsx` - reorder do array e do switch

**Impacto arquitetural:** Nenhum — apenas reordenação.

## 2026-06-18 | feat(relatorio-mensal): remove slide "Tópicos de Discussão"

**O que foi feito:**
- Removido o slide `SlideTopicosDiscussao` do Reporte Mensal: tirado de `FIXED_SLIDE_NAMES`, removido o `case` do switch de render e o import; componente `SlideTopicosDiscussao.tsx` deletado (não usado em mais nenhum lugar).
- Switch reajustado: Turbo Store → `case 22`, Frase → `23`, Q&A → `24`. Deck passa de 32 para 31 slides; Turbo Store fica logo antes do fechamento.

**Por que:**
- Solicitado: a aba de tópicos de discussão não é mais necessária no reporte.

**Arquivos alterados:**
- `client/src/pages/RelatorioMensal.tsx` - removido do array, switch e import
- `client/src/pages/relatorio-mensal/SlideTopicosDiscussao.tsx` (deletado)

**Impacto arquitetural:** Nenhum.

## 2026-06-18 | feat(relatorio-mensal): slide "Turbo Store" antes do fechamento

**O que foi feito:**
- Novo slide `SlideTurboStore.tsx` no Reporte Mensal, posicionado logo antes do bloco de fechamento (Frase + Q&A).
- Layout: screenshot do site da loja em moldura de navegador à esquerda + QR code de acesso à direita ("Escaneie para acessar a loja"), tema commerce (ciano), dark mode.
- Inserido `"Turbo Store"` em `FIXED_SLIDE_NAMES` (índice 23) e ajustado o switch de render (`case 23`→Store, `24`→Frase, `25`→Q&A) em `RelatorioMensal.tsx`. Deck passa de 31 para 32 slides.
- Imagens adicionadas em `client/src/assets/`: `turbo-store.png` (print do site) e `turbo-store-qr.jpeg` (QR da loja).

**Por que:**
- Divulgar a Turbo Store no reporte mensal, com QR para acesso direto à loja.

**Arquivos alterados:**
- `client/src/pages/relatorio-mensal/SlideTurboStore.tsx` (novo)
- `client/src/pages/RelatorioMensal.tsx` - ordem dos slides + render
- `client/src/assets/turbo-store.png`, `client/src/assets/turbo-store-qr.jpeg` (novos)

**Impacto arquitetural:** Nenhum — slide estático adicional.

## 2026-06-17 | fix(bp2026): churn conta só status cancelado/em cancelamento, exclui entregue/pausado

**O que foi feito:**
- Adicionado filtro `status IN ('cancelado/inativo', 'em cancelamento')` nas 3 queries de churn do BP 2026: `montarRevenue` (`bp2026.revenue.ts`, "Churn R$ Total" e por produto), churn do mês em `bp2026.metricas.ts`, e o detalhamento `detChurn` em `bp2026.detalhe.ts`.
- Atualizado o tooltip `FONTE_CHURN` (`bp2026.info.ts`) explicando que só contam status de churn real.

**Por que:**
- A linha "Churn R$ Total" da aba Revenue somava todos os registros de `vw_cup_churn_ajustado` com `valor_r > 0`, incluindo contratos com status `entregue` (projeto pontual concluído — não é churn) e `pausado` (pausa ≠ cancelamento). Isso inflava o churn: Mai/2026 exibia 184.823 quando o gráfico "Churn Commerce MoM" do ClickUp (fonte de verdade) mostra 172.826. Diferenças também em Fev (+1.997), Abr (+2.997) e Jun (+8.997).
- Com o filtro, os 6 meses de 2026 batem exatamente com o ClickUp (validado via SQL em produção).

**Arquivos alterados:**
- `server/routes/bp2026.revenue.ts` - filtro de status na query de churn por produto
- `server/routes/bp2026.metricas.ts` - filtro de status na query de churn do mês
- `server/routes/bp2026.detalhe.ts` - filtro de status no detalhamento de churn
- `server/routes/bp2026.info.ts` - tooltip FONTE_CHURN atualizado

**Impacto arquitetural:** Nenhum — apenas predicado adicional nas queries existentes. A view `vw_cup_churn_ajustado` permanece intacta para os demais dashboards.

---

## 2026-06-17 | fix(investors-report): margem/faturamento em base única de competência (caz_receber+caz_pagar)

**O que foi feito:**
- `faturamentoResult` (`server/routes.ts`): a série mensal de faturamento/despesa/margem passa a usar `caz_receber` + `caz_pagar`. Receita = `caz_receber.total` (faturado/competência, por `data_vencimento`); despesa = `caz_pagar.pago` (CAIXA, por data de pagamento). Substitui o modelo híbrido anterior (receita emitida `caz_vendas` + despesa paga `caz_pagar`).
- A série começa no 1º mês de `caz_receber` (`bounds.inicio`) para não gerar meses só-despesa (margem -∞); estende-se sozinha para trás quando o histórico de `caz_receber`/`caz_pagar` é repopulado.
- `faturamentoAnoResult` (KPIs YTD): alinhado à mesma fonte para o card "Margem (Ano)" não divergir do gráfico. Removido `valor_bruto_ano`; taxa de inadimplência passa a usar o faturamento do ano como base.
- Tooltip dos gráficos de Margem e Faturamento: a `Area` decorativa recebe `tooltipType="none"`/`legendType="none"`, removendo a entrada duplicada (antes "Margem" aparecia 2x no tooltip).

**Por que:**
- A margem mensal exibia picos falsos (set/25 39,3%, abr/25 34,2%) porque misturava receita por EMISSÃO (`caz_vendas` lança o valor cheio da nota no mês da emissão) com despesa por CAIXA (`caz_pagar`) — regimes temporais incompatíveis.
- **Receita usa `.total`** (faturado) e não `.pago` (recebido) porque na receita há inadimplência/atraso — `.pago` subnotaria os meses recentes.
- **Despesa usa `.pago`** (caixa) e não `.total` porque o `caz_pagar.total` inclui provisões/parcelamentos a pagar (ex.: "6/24 - comissão", "9/10 - COFINS", pró-labore parcelado) que não saíram do caixa — inflavam o mês (mai/26: total R$1,44M vs pago R$1,18M). O `.pago` por data de pagamento bate com a DFC (`caz_parcelas`). Como as despesas são pagas no mês, competência≈caixa, então usar o pago não distorce.

**Arquivos alterados:**
- `server/routes.ts` - queries `faturamentoResult` e `faturamentoAnoResult`
- `client/src/pages/InvestorsReport.tsx` - `tooltipType`/`legendType` nas Areas de Margem e Faturamento

**Impacto arquitetural:** Enquanto `caz_receber`/`caz_pagar` só tiverem histórico desde out/2025, a série exibe out/2025→presente; repopular o histórico estende a série sem mudança de código.

---

## 2026-06-16 | fix(bp2026-revenue): churn R$ orçado usa MRR do mesmo mês

**O que foi feito:**
- Corrigida a derivação do orçado nominal de Churn R$ (total e por produto) em `bp2026.revenue.ts`: de `churn% × MRR orçado do mês ANTERIOR` (`mrr_orc[mes-1]`) para `churn% × MRR orçado do MESMO mês` (`mrr_orc[mes]`).
- Resultado bate com a planilha "BP 2026 - Turbo - Financials.xlsx", aba Revenue, linha "Churn Total": jan=104.117, fev=114.096, mar=123.177, abr=133.691, mai=143.259, jun=151.966.

**Por que:**
- O orçado de Churn R$ de janeiro aparecia como "não orç." porque o "mês anterior" seria dez/2025, que não está seedado na `cortex_core.bp2026_orcado` (só meses 1-12) → derivava 0. Além disso, todos os meses ficavam deslocados uma casa (o orçado de fev mostrava o valor de janeiro da planilha). A planilha calcula churn do mês = churn% × MRR do mesmo mês.

**Arquivos alterados:**
- `server/routes/bp2026.revenue.ts` - índice de mês na derivação do churn R$ orçado (2 lugares) + notas

**Impacto arquitetural:** Nenhum. Só corrige o índice de mês na derivação; não altera fonte de dados nem schema.

---

## 2026-06-16 | fix(criativos): filtro de Produto por nome de campanha (cross-plataforma)

**O que foi feito:**
- O filtro de Produto passa a casar pelo **nome da campanha** (padrão `[Produto]`) em **todas as plataformas** (Meta/Google/TikTok), via novo param `produtos` no `/api/growth/criativos` e `/criativos/kpis`
- Seleção **manual** de campanha continua por ID (`campanhaIds`, Meta)

**Por que:**
- O filtro de Produto derivava os IDs de campanha **só do Meta** (`/criativos/campanhas`), então selecionar um produto **zerava Google e TikTok** (IDs não batiam). Verificado: filtrar produto derrubava o Google de 274 → 0 linhas
- As campanhas de Google já usam o mesmo padrão `[Produto]` no nome (`[Creators]`, `[UGC]`, `[Commerce]`…), então o match por nome funciona cross-plataforma (ex.: `[TP]` mantém 268/274 linhas do Google)

**Arquivos alterados:**
- `client/src/pages/Criativos.tsx` - `appendScopeParams`: produto → `produtos` (nomes); campanha manual → `campanhaIds` (IDs)
- `server/routes/growth.ts` - `matchProduto()` aplicado aos 3 builds (Meta/Google/TikTok) e aos KPIs (join em `meta_campaigns` p/ o nome)

---

## 2026-06-16 | feat(criativos): métricas nativas por plataforma + TikTok ad-level na aba Criativos

**O que foi feito:**
- A aba Criativos agora mostra **métricas nativas específicas de cada plataforma** ao selecionar o filtro de Plataforma: ao escolher Google/TikTok somem as métricas exclusivas do Meta (Video hook/hold, Connect rate) e aparecem as nativas da plataforma (Video views, Conv. plataforma, Valor conv.). As métricas de pré-vendas/vendas (leads, MQL, RA, RR, vendas, CAC) continuam vindo do Bitrix, iguais para todas as plataformas
- **TikTok Ads** entra na aba a nível de anúncio (espelhando Meta/Google): novo `buildTiktokCriativos` casa o CRM por anúncio via `utm_content = __CID__ = ad_id` (padrão de UTM pago do TikTok da Turbo) e plugado no endpoint `/api/growth/criativos`
- **Google**: `buildGoogleCriativos` passa a expor os contadores nativos do Google por anúncio (conversões, valor de conversão, video views) que já existiam no banco
- Pipeline ad-level do TikTok: nova migration (`tiktok.ad_groups`, `tiktok.ads`, `tiktok.ad_insights_daily`) + `syncTiktokAds` expandido para puxar adgroups, anúncios e métricas por anúncio (`data_level=AUCTION_AD`)

**Por que:**
- Pedido do Ichino: cada plataforma tem métricas de marketing próprias (hook/hold do Meta ≠ video views do Google/TikTok), mas o funil de pré-vendas/vendas é uniforme via Bitrix. Google e TikTok começaram a receber investimento agora e precisam aparecer por anúncio

**Arquivos alterados:**
- `client/src/lib/criativosColumns.ts` - campo `platforms` no registry + colunas nativas (videoViews/conversions/conversionValue) + helper `columnAppliesToPlatforms`
- `client/src/lib/criativosMetrics.ts` - novos contadores somáveis (conversions/conversionValue/videoViews)
- `client/src/pages/Criativos.tsx` - filtro dinâmico de colunas por plataforma + opção TikTok Ads
- `server/routes/growth.ts` - `buildTiktokCriativos`, contadores nativos no Google, `wantsTiktok` no endpoint
- `server/services/tiktokAdsSync.ts` - sync de adgroups/ads/métricas por anúncio
- `scripts/create-tiktok-ads-adlevel-tables.ts` - migration das tabelas ad-level do TikTok (idempotente)

**Impacto arquitetural:** Novas tabelas em `tiktok.*` (rodar a migration em prod com usuário privilegiado). Casamento de vendas por anúncio do TikTok/Google fica pronto e "liga sozinho" quando o tracking de UTM (`{creative}` no Google; macro `__CID__` no TikTok) começar a popular o Bitrix.

---

## 2026-06-16 | fix(bp2026-revenue): alinha Churn R$ ao ClickUp usando churn bruto

**O que foi feito:**
- Removidos os filtros de exclusão (`abonar_churn = 'Sim'` e `motivo_cancelamento NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')`) das 3 queries de churn do BP 2026: agregação por produto (`bp2026.revenue.ts`), "Churn do Mês" (`bp2026.metricas.ts`) e drill-down `detChurn` (`bp2026.detalhe.ts`). Mantido `valor_r > 0`.
- O "Churn R$ Total", churn por produto, churn % e "Churn do Mês" passam a refletir o churn BRUTO, batendo com o gráfico "Churn Commerce MoM" do ClickUp (jan e mar exatos; resíduo dos demais meses = drift de snapshot do print).
- Abonados saem da "ponte do MRR" (MRR vazado) e passam a ser churn explícito.
- Notas/tooltips e `bp2026.info.ts` atualizados para "churn bruto".

**Por que:**
- O BP usava a definição de churn ajustado/oficial (`vw_cup_churn_ajustado` com exclusões), enquanto o ClickUp mostra churn bruto. A divergência crescia mês a mês (jan = R$0 excluído; mai ≈ R$56k excluído), gerando desconfiança no número. Decisão do solicitante: alinhar ao ClickUp (bruto).

**Arquivos alterados:**
- `server/routes/bp2026.revenue.ts` - query de churn por produto sem exclusões; notas atualizadas
- `server/routes/bp2026.metricas.ts` - query de "Churn do Mês" sem exclusões; nota da ponte do MRR
- `server/routes/bp2026.detalhe.ts` - drill-down `detChurn` sem exclusões; comentário
- `server/routes/bp2026.info.ts` - textos de fonte/cálculo do churn e do MRR vazado

**Impacto arquitetural:** Nenhum. A view `vw_cup_churn_ajustado` não foi alterada, preservando os demais dashboards (ex.: evolução mensal de churn) que dependem da definição ajustada.

---

## 2026-06-16 | fix(investors-report): contratos pontuais conta só os ativos

**O que foi feito:**
- "Tipos de Contrato" (card + pizza): pontuais passa a contar apenas `valorp>0 AND status IN ('ativo','onboarding','triagem')`, igual aos recorrentes

**Por que:**
- A contagem antiga (`valorp>0` sem status) somava 1.121 incluindo 742 entregues + 98 cancelados, gerando um mix falso de 20/80; o mix real de contratos ativos é ~51/49 (274 recorrentes / 262 pontuais)

**Arquivos alterados:**
- `server/routes.ts` — filtro de status em `contratos_pontuais` nos endpoints da página e do PDF

**Impacto arquitetural:** Nenhum.

---

## 2026-06-16 | fix(investors-report): gráficos de evolução só com meses fechados (remove distorções)

**O que foi feito:**
- Série de evolução (4 gráficos + tabelas + YoY) passa a terminar no último mês fechado (exclui o mês corrente parcial) e a começar no 1º mês cheio de `caz_vendas` (mar/23, não fev/23 parcial)

**Por que:**
- O mês corrente parcial aparecia como crash no faturamento, pico falso na margem (+63%) e salto falso no caixa acumulado; fev/23 (caz_vendas começou em 13/02) dava margem de −222% e achatava o eixo do gráfico de margem
- Bônus: o YoY deixa de ser puxado para baixo pelo mês parcial

**Arquivos alterados:**
- `server/routes.ts` — `hist_start` = 1º mês cheio de caz_vendas; janela de `dados_recentes` termina em `< DATE_TRUNC('month', CURRENT_DATE)`

**Impacto arquitetural:** Nenhum. KPIs de faturamento/inadimplência seguem incluindo o mês corrente (realizado até o momento); apenas a série temporal usa meses fechados.

---

## 2026-06-16 | fix(investors-report): Fat./Cabeça passa a ser mensal

**O que foi feito:**
- "Fat. / Cabeça" deixa de ser YTD acumulado (R$ 72k) e passa a ser o **faturamento médio mensal** dos meses fechados ÷ headcount (~R$ 13k/mês)

**Por que:**
- Para casar com "MRR / Cabeça" (mensal) e ser comparável; o acumulado anual no mesmo card confundia

**Arquivos alterados:**
- `server/routes.ts` — conta `meses_fechados` e calcula faturamento médio mensal por cabeça
- `client/src/pages/InvestorsReport.tsx` — subtítulo "realizado / mês (média)"

**Impacto arquitetural:** Nenhum.

---

## 2026-06-16 | feat(investors-report): Fat./Cabeça (YTD) ao lado de MRR/Cabeça

**O que foi feito:**
- "Receita/Cabeça" renomeado para "MRR / Cabeça" (recorrente/mês = MRR ativo ÷ headcount)
- Novo card "Fat. / Cabeça" = faturamento realizado no ano (YTD) ÷ headcount
- Row de KPIs secundários passa de 4 para 5 colunas

**Por que:**
- A pedido: exibir produtividade tanto pela carteira recorrente (MRR) quanto pelo faturamento realizado

**Arquivos alterados:**
- `server/routes.ts` — novo campo `equipe.faturamentoPorCabeca`
- `client/src/pages/InvestorsReport.tsx` — card novo + relabel + grid de 5 colunas

**Impacto arquitetural:** Nenhum.

---

## 2026-06-16 | fix(investors-report): margem do ano ignora mês corrente (parcial)

**O que foi feito:**
- A "Margem (Ano)" passa a considerar apenas meses fechados (jan → mês anterior); faturamento e inadimplência seguem incluindo o mês corrente

**Por que:**
- O mês corrente é parcial — suas despesas ainda não entraram por completo, inflando a margem (18,7% com junho vs 13,7% real só com meses fechados)

**Arquivos alterados:**
- `server/routes.ts` — `margemAno` calculada a partir de `faturamento_fechado`/`despesas_fechado` (corte em `DATE_TRUNC('month', CURRENT_DATE)`)

**Impacto arquitetural:** Nenhum.

---

## 2026-06-16 | feat(investors-report): faturamento, inadimplência e margem em base anual (YTD)

**O que foi feito:**
- Card "Fat. Mês Atual" → "Faturamento (Ano)": soma realizada de jan até o mês corrente
- "Inadimplência (Ano)": acumulada do ano corrente (jan→mês atual), não só do mês vigente
- "Margem (Ano)": mesma janela YTD, margem ponderada (Σ geração ÷ Σ faturamento), calculada no backend
- Uma única query `caz_parcelas` (jan→mês atual) alimenta os três KPIs

**Por que:**
- Métricas de um único mês oscilavam demais (mês parcial inflava inadimplência, subestimava faturamento); a visão anual é mais estável e adequada para investidores

**Arquivos alterados:**
- `server/routes.ts` — query YTD (`faturamentoAnoResult`) e novos campos `faturamentoAno`/`margemAno`; `taxaInadimplencia` agora YTD
- `client/src/pages/InvestorsReport.tsx` — cards e linha de referência da margem consomem os campos anuais

**Impacto arquitetural:** Nenhum.

---

## 2026-06-16 | fix(investors-report): margem média ponderada (corrige −2,6% espúrio)

**O que foi feito:**
- KPI "Margem Média" e a linha de referência do gráfico de margem agora usam margem **ponderada** (Σ geração de caixa ÷ Σ faturamento) em vez de média aritmética simples dos %s mensais

**Por que:**
- A média simples era dominada por meses de receita baixa (ex.: fev/23 com margem de −222% sobre R$ 30k), exibindo −2,6% quando a margem real ponderada é ~+7,8%

**Arquivos alterados:**
- `client/src/pages/InvestorsReport.tsx` — `avgMargem` recalculado como ponderado

**Impacto arquitetural:** Nenhum.

---

## 2026-06-16 | fix(investors-report): corrige receita histórica zerada (caz_receber → caz_vendas)

**O que foi feito:**
- Trocada a fonte de receita histórica do Investors Report de `caz_receber` para `caz_vendas` (faturamento emitido), pois `caz_receber`/`caz_parcelas` não têm dados de caixa antes de set/out-2025
- Corte dinâmico entre base "emitido" (histórico, `caz_vendas`) e "caixa" (recente, `caz_parcelas`) no 1º mês cheio de parcelas (out/2025)
- Removidos meses futuros (notas/parcelas agendadas até 2031) e o buraco de jul/ago-2025
- Adicionado campo `fonte` ('emitido' | 'caixa') na série; frontend marca a transição no gráfico de faturamento e o período passa a iniciar em 2023

**Por que:**
- Todo o bloco histórico do relatório (gráficos de faturamento/margem/receita×despesas/caixa acumulado + tabelas anual e mensal + KPIs YoY e Margem Média) mostrava faturamento R$ 0 de 2023 a 2025 contra despesas reais, gerando "geração de caixa" de −90k a −950k/mês — dados incorretos para investidores

**Arquivos alterados:**
- `server/routes.ts` — reescrita da query `evolucaoFaturamento` no endpoint `/api/investors-report` (modelo híbrido emitido/caixa) e inclusão de `fonte` no payload
- `client/src/pages/InvestorsReport.tsx` — campo `fonte` na interface, marcador de transição (`ReferenceLine`) + nota no gráfico, período inicia em 2023

**Impacto arquitetural:** Nenhum — mudança contida no endpoint e na página. Endpoint de PDF (`/api/investors-report/pdf`) usa só `caz_parcelas` (apenas meses recentes) e não foi alterado; fica como follow-up se quiserem histórico no PDF.

---

## 2026-06-16 | feat(revenue-goals): histórico de inadimplência dinâmico (substitui hardcode)

**O que foi feito:**
- Novo endpoint `GET /api/financeiro/revenue-goals/historico-inadimplencia` que calcula a inadimplência por mês a partir de `"Conta Azul".caz_receber`, para os meses já fechados do ano corrente
- O card "Inadimplência" da tela Metas de Receita agora consome o endpoint (com loading/empty state) em vez dos valores hardcoded
- Meses rolam automaticamente: em junho mostra Jan–Mai; em julho, Jan–Jun; vira o ano e recomeça
- Removida a linha estática "Mês Corrente" (mês aberto infla o número; o atual já aparece ao vivo no card grande "Inadimplente")

**Por que:**
- A versão anterior tinha os valores fixos no código; o solicitante pediu que fosse dinâmico de acordo com os meses
- A fórmula foi validada contra produção e reproduz exatamente os números de referência (Jan–Mar idênticos; Abr/Mai mais baixos porque clientes pagaram desde o print original) — dinâmico = sempre atualizado

**Arquivos alterados:**
- `server/storage.ts` - novo método `getHistoricoInadimplencia()` (mesma definição de inadimplência de `getRevenueGoals`, agrupada por mês)
- `server/routes.ts` - nova rota do histórico
- `client/src/pages/RevenueGoals.tsx` - consome o endpoint via React Query; remove o array estático e a linha de mês corrente

**Impacto arquitetural:** Nenhum (novo endpoint isolado, sem mudança de schema)

---

## 2026-06-16 | feat(revenue-goals): card de histórico de inadimplência

**O que foi feito:**
- Novo card "Inadimplência" na tela Metas de Receita (`/dashboard/revenue-goals`), com tabela compacta do histórico mensal (valor + % sobre o previsto)
- Linha "Mês Corrente" em destaque (R$ 177K, valor de referência fixo) no topo, seguida dos meses fechados (Jan–Mai)
- Percentuais coloridos: verde até a meta ideal (4%) e vermelho acima
- Posicionado logo acima do bloco "Metas de Inadimplência", agrupando todo o conteúdo de inadimplência

**Por que:**
- Pedido do Rodrigo: ter na própria tela de Revenue Goal uma visão rápida do histórico de inadimplência mês a mês para acompanhamento
- Dados estáticos (sem mudança de backend); o "Mês Corrente" usa valor de referência fixo porque o cálculo ao vivo de um mês ainda aberto infla o número (tudo não pago entra como inadimplente)

**Arquivos alterados:**
- `client/src/pages/RevenueGoals.tsx` - adiciona constante `historicoInadimplencia`, importa `formatCurrencyCompact` e renderiza o card de tabela

**Impacto arquitetural:** Nenhum

---

## 2026-06-14 | feat(criativos): exibe o motivo real da falha nos toasts de ação em massa

**O que foi feito:**
- Os toasts de pausar/ativar e de ajuste de orçamento em massa agora exibem a mensagem de erro retornada pela Meta para os itens que falharam, em vez de apenas "N não aplicaram"
- Novo helper `summarizeErrors` que deduplica e resume os erros por item (mostra os 2 principais + contagem dos demais)

**Por que:**
- Ao tentar pausar conjuntos a ação falhava ("0/7 pausados · 7 não aplicaram") sem informar a causa, impossibilitando o diagnóstico do problema na Meta Ads

**Arquivos alterados:**
- `client/src/pages/Criativos.tsx` - `summarizeErrors` e descrição dos toasts de massa passando a incluir o erro real (ReactNode em 2 linhas)

**Impacto arquitetural:** Nenhum — apenas feedback de UI; o backend já retornava o erro por item em `results[].error`.

---

## 2026-06-14 | feat(criativos): seleção persistente por nível com drill-down derivado

**O que foi feito:**
- Cada aba da página Criativos (campanha/conjunto/anúncio) agora mantém a própria seleção ao trocar de aba; antes a seleção era apagada a cada navegação
- O drill-down (filtro de escopo) passou a ser **derivado** da seleção dos níveis ancestrais: selecionar um conjunto e abrir "Anúncios" mostra só os anúncios daquele conjunto, e voltar para "Conjuntos" mantém o conjunto marcado
- Badge "N selecionado" passa a aparecer em qualquer aba com seleção (não só na ativa), para deixar a seleção persistida visível
- Chip "Filtrando por…" e os labels das abas refletem a cadeia de seleção persistente
- Removidos o estado manual `scope` e o mapa `LEVEL_DEPTH` (agora derivados de `selByLevel`)

**Por que:**
- O usuário precisava navegar entre níveis (campanha → conjunto → anúncio) sem perder o que havia selecionado, como no Meta Ads Manager — antes era preciso reselecionar a cada troca de aba

**Arquivos alterados:**
- `client/src/pages/Criativos.tsx` - seleção por nível (`selByLevel`), `scope` derivado dos ancestrais, handlers de seleção/limpeza ajustados e badges/labels persistentes

**Impacto arquitetural:** Nenhum — mudança de estado/UI local na página; sem alterações de API, dados ou contrato de componentes.

---

## 2026-06-14 | feat(criativos): toast persistente de confirmação para ações no Meta Ads

**O que foi feito:**
- Toasts de pausar/ativar (individual e em massa) e de orçamento na aba Criativos agora ficam fixos na tela até o usuário fechar (`duration: Infinity`), em vez de sumirem sozinhos em ~5s
- Adicionada variante `success` (verde) ao componente Toast; erros continuam vermelhos (`destructive`)
- Ação em massa com falha parcial passa a ser sinalizada como aviso vermelho (com `X/Y aplicados`), não mais como sucesso
- Botão de fechar (X) do toast agora fica sempre visível, não só ao passar o mouse

**Por que:**
- Ao pausar anúncios, o feedback de conclusão sumia rápido demais e o usuário não tinha certeza se a mudança foi de fato aplicada na Meta Ads (inclusive em casos do bug de Erro 500 em produção)

**Arquivos alterados:**
- `client/src/components/ui/toast.tsx` - nova variante `success` e botão de fechar sempre visível
- `client/src/pages/Criativos.tsx` - toasts das ações do Meta agora persistentes, com variante por resultado e detecção de falha parcial

**Impacto arquitetural:** Nenhum — apenas feedback de UI; nenhuma mudança em API ou dados.

---

## 2026-06-12 | feat(capacity): dois percentuais — Capacity por MRR e por quantidade de contas

**O que foi feito:**
- Backend (`/api/capacity-times`) passou a retornar `util_mrr_pct` (MRR operando / cap. MRR) e `util_contas_pct` separados para todas as linhas; `util_pct` legado mantido (MRR quando há cap, senão contas).
- CS/squads: % contas = (contas recorrentes + pontuais) / (cap. recorrente + cap. pontual). Comerciais: % contas = contas ativas / cap. contas.
- Tabelas (squads, comerciais e comparativo da Visão Geral) trocam a coluna única "Utilização" por **% MRR** e **% Contas**, cada uma com barra e cores por faixa.
- Cards dos times mostram "Capacity MRR (média)" e "Capacity Contas (média)".
- Gráficos "Utilização por pessoa" e "Utilização média por time" viram barras agrupadas MRR × Contas com legenda.

**Por que:**
- Um percentual único escondia visões diferentes de lotação: alguém pode estar estourado em MRR e com folga em contas (ex.: Victor/Pulse 118% MRR × 95% contas) ou vice-versa.

**Arquivos alterados:**
- `server/routes/capacityTimes.helpers.ts` - campos `util_mrr_pct`/`util_contas_pct` em CsRow e ComercialRow
- `server/routes/capacityTimes.helpers.test.ts` - cobertura dos dois percentuais
- `client/src/pages/CapacityTimes.tsx` - colunas, cards e gráficos agrupados

**Impacto arquitetural:** Nenhum — novos campos na API sem breaking change

---

## 2026-06-12 | feat(relatorio-mensal): NRR por squad — expansão abatida do churn

**O que foi feito:**
- Slide "Detalhes por Squad" passou a calcular **NRR** = churn s/ abonados − expansão (upsell/cross-sell) do mês.
- Expansões configuradas por mês/squad em `EXPANSAO_NRR_POR_MES` (backend). Maio/2026: Selva R$ 9.000 ÷ 5, Squadra R$ 8.000 ÷ 5 (contratos em 5x entram com 1/5 do valor no mês), Pulse R$ 4.497 integral.
- Todo squad exibe sempre os cards **Total de Vendas** (valor cheio vendido no mês), **Churn s/ Abonados** e **NRR**, mesmo zerados — squads sem expansão mostram Vendas R$ 0 e NRR = churn s/ abonados.
- Tooltip do card NRR mostra a linha "Expansão (abatida)" em verde junto da lista de clientes churnados.
- Layout do card de squad com 8 KPIs: densidade média em 2 linhas de 4 (grid de 8 colunas); compacto (5+ squads) em 3 colunas sem ícones, com labels sem quebra de linha.

**Por que:**
- O churn bruto não refletia a retenção líquida dos squads — expansões fechadas no mês compensam parte do MRR perdido (ex.: Pulse maio/2026 cai de 17,5% para 14,8%).

**Arquivos alterados:**
- `server/routes/relatorioMensalSlides.ts` - constante `EXPANSAO_NRR_POR_MES` + campos `expansaoNrr`/`nrrBrl`/`nrrPct` em `squadDetails`
- `client/src/pages/relatorio-mensal/types.ts` - novos campos em `SquadDetail`
- `client/src/pages/relatorio-mensal/SlideSquadSingle.tsx` - card NRR condicional + linha de expansão no tooltip

**Impacto arquitetural:** Nenhum — novos campos na API sem breaking change

---

## 2026-06-11 | fix(capacity): renomeia Selca para Selva e remove squad Aura (virou Pulse)

**O que foi feito:**
- Tab e título do time de vendedores renomeados de "Selca" para "Selva" (CapacityTimes + label do dialog de operador).
- "Aura" removida das categorias base do dialog de operador — a squad foi absorvida pela Pulse.
- Banco local atualizado (`UPDATE capacity_metas SET categoria='Pulse' WHERE categoria='Aura'`, 3 operadores) para espelhar prod, que já estava migrado.
- Indicador de cobertura de cap: linha do time mostra "X/Y com cap" quando só parte das pessoas tem cap de MRR (Pulse pós-fusão: 5/8), Espaço MRR vira "—" para time sem nenhuma cap (Olimpo), e os cards do topo indicam "cobre X de Y pessoas" / "só de quem tem cap de MRR". Resolve a aparente contradição de MRR Operando > Cap. MRR com Espaço positivo.

**Por que:**
- O nome correto do time comercial é Selva, e a squad Aura deixou de existir ("tudo o que era Aura virou Pulse"). Prod já tinha os 8 operadores em Pulse; o local ainda mostrava a tab Aura.

**Arquivos alterados:**
- `client/src/pages/CapacityTimes.tsx` - labels Selca → Selva (overview, tab e conteúdo).
- `client/src/components/capacity-times/CapacityMetaDialog.tsx` - label "Selva (vendedor)" e CATEGORIAS_BASE sem "Aura".

**Impacto arquitetural:** Nenhum.

---

## 2026-06-11 | feat(relatorio-mensal): cards de churn total e s/ abonados por squad

**O que foi feito:**
- Seção "Detalhes por Squad" do Relatório Mensal passou a exibir dois cards de churn: **Churn Total** (todos os churns do mês) e **Churn s/ Abonados** (desconta apenas `abonar_churn = 'Sim'`).
- A query de churn por squad deixou de excluir os motivos "artificiais" (`Inadimplente 1º Mês`, `Não começou`, `Erro na Venda`) — a coluna `abonar_churn` de `cup_churn` é o único critério de abono nessa seção.
- Layout do card de squad reorganizado para caber na altura do slide: MRR / Pontual / Evolução na primeira linha, os dois churns na segunda (R$ base inline); com 5+ squads usa densidade compacta.
- Tooltip no hover dos cards de churn lista os clientes churnados (nome via `cup_clientes`, valor exato, badge "abonado"); "Churn s/ Abonados" filtra os abonados da lista.
- Card de **Faturamento Total** por squad (MRR ativo + pontual entregue) e valor monetário do churn visível em todas as densidades (antes o compacto mostrava só o %).
- Lookups por squad (churn, pontual, MRR anterior) normalizados por nome — squads renomeados com sufixo "(OFF)" voltam a casar entre as fontes (corrigiu Aura zerada).

**Por que:**
- Dar visibilidade do churn bruto vs. churn líquido de abonos no reporte mensal, com critério único e auditável (coluna de abono), em vez de heurística por motivo de cancelamento.

**Arquivos alterados:**
- `server/routes/relatorioMensalSlides.ts` - query 16 com `FILTER` calculando total e sem abonados; `squadDetails` ganhou `churnTotalPct`/`churnTotalBrl`
- `client/src/pages/relatorio-mensal/types.ts` - novos campos em `SquadDetail`
- `client/src/pages/relatorio-mensal/SlideSquadSingle.tsx` - dois cards de churn + Evolução MRR em `col-span-2`
- `docs/superpowers/specs/2026-06-11-relatorio-mensal-churn-squad-abonados-design.md` - design doc

**Impacto arquitetural:** Nenhum

---

## 2026-06-11 | feat(youtube): start/callback do OAuth públicos (sem login no Cortex)

**O que foi feito:**
- `registerYoutubeOAuthRoutes` foi dividida em `registerYoutubeOAuthPublicRoutes` (`/start` + `/callback`) e `registerYoutubeOAuthStatusRoute` (`/status`).
- `/start` e `/callback` passaram a ser registrados **antes** do `app.use("/api", isAuthenticated)`, igual ao módulo Instagram. `/status` segue protegido.

**Por que:**
- Donos de canal externos (ex.: Victor, sem conta no Cortex) precisam conseguir autorizar com a própria conta Google. Com a rota atrás do login, eles travariam.

**Arquivos alterados:**
- `server/routes/youtubeOAuth.ts` - split em função pública (start/callback) e protegida (status).
- `server/routes.ts` - registra a pública antes do gate de auth e a de status depois.

**Impacto arquitetural:** `/api/oauth/youtube/start` e `/callback` agora são públicos (não expõem dados; só iniciam o consent e gravam credencial). `/status` continua autenticado.

---

## 2026-06-11 | fix(youtube): credencial OAuth por canal (1 conta → N Brand Accounts)

**O que foi feito:**
- `youtube.credentials` deixou de ser `UNIQUE(google_user_id)` e passou a ser chaveada por `channel_id` (uma credencial por canal).
- O callback OAuth agora descobre o canal (`channels.list`) **antes** de gravar a credencial e cria/atualiza uma credencial por canal com `ON CONFLICT (channel_id)`.
- Migração idempotente em `scripts/create-youtube-tables.ts` (adiciona `channel_id`, remove o unique antigo, cria `uq_yt_credentials_channel`).
- Schema Drizzle (`shared/schema.ts`) atualizado para refletir o novo modelo.

**Por que:**
- A conta `ferramentas@turbopartners.com.br` vai gerenciar **4 canais** (Brand Accounts). Cada autorização traz o **mesmo** `google_user_id` mas um `refresh_token` diferente, válido só para o canal selecionado. Com o `UNIQUE(google_user_id)` antigo, a Nª autorização sobrescrevia o token das anteriores e o sync puxava todos os canais com o token do último → os demais retornavam 403.

**Arquivos alterados:**
- `server/routes/youtubeOAuth.ts` - reordena o callback e grava 1 credencial por canal.
- `scripts/create-youtube-tables.ts` - DDL base + migração idempotente da credencial.
- `shared/schema.ts` - `youtubeCredentials` sem unique em `google_user_id`, com `channel_id` unique.

**Impacto arquitetural:** Modelo de credenciais YouTube passa de 1-por-conta para 1-por-canal. Requer rodar `npx tsx scripts/create-youtube-tables.ts` em prod (idempotente) antes de autorizar os canais.

---

## 2026-06-11 | docs(youtube): passo-a-passo de acesso via Conta de Marca (client Interno)

**O que foi feito:**
- Reescreve `docs/youtube-acesso-canais.md` do caminho External para o caminho Conta de Marca (Brand Account).
- Adiciona Passo 0 obrigatório: validar a pipeline inteira num canal de teste não-monetizado antes de mexer nos canais reais.
- Esclarece que "Conta de Marca" não é uma marca-guarda-chuva da Turbo — cada canal continua do dono e o acesso da Turbo é leitura revogável.
- Registra a pendência técnica do `UNIQUE(google_user_id)` para múltiplos canais na mesma conta Turbo.

**Por que:**
- Os canais dos sócios são contas pessoais; canal comum não aceita adicionar usuários e conta pessoal não vira `@turbopartners`. Conta de Marca permite adicionar a Turbo como proprietária e autorizar com o client Interno atual — eliminando a verificação do Google e a expiração de token de 7 dias do caminho External.

**Arquivos alterados:**
- `docs/youtube-acesso-canais.md` - substitui o procedimento External pelo procedimento Brand Account (Passos 0–4 + pendência técnica + diagrama do fluxo).

**Impacto arquitetural:** Nenhum (apenas documentação). Define o caminho que tornará desnecessário o projeto GCP External dedicado.

---

## 2026-06-09 | docs(utm): content por tipo de destino (site-/lp-) + bio multi-link na Constituição v1.4

**O que foi feito:**
- `utm_content` ganhou **duas lógicas** (§4.2): **link fixo** (bio/linktree/banner/sobre) → `content={tipo-de-destino}` — `site-{pagina}` (site institucional), `lp-{slug}` (landing page), `whatsapp` —, sem data; **post** (feed/stories/reels/descrição/DM) → `content={nome-do-post}-{aaaa-mm-dd}`.
- Prefixo `link-` **descontinuado** e substituído por `site-`/`lp-`, que carregam o tipo real de destino (permite agrupar "LP vs site institucional" no relatório).
- Documentado o caso de **bio com múltiplos links nativos** (até 5 no Instagram): todos usam `term=bio`, diferenciados por `content` (tipo de destino, sem data). `campaign` muda só quando o botão pertence a iniciativa específica.
- Adicionada nota sobre WhatsApp: UTM em `wa.me`/`api.whatsapp.com` não é capturada; rastrear via página de redirect tracked (`/wpp`).
- Constituição versionada para v1.4; exemplos do guia de links e da aba Guia do `/utm-builder` alinhados.

**Por que:**
- Surgiu na prática: bio do Instagram passou a permitir 5 links e o time não sabia como diferenciar cada botão no relatório (resposta: via `content`). O prefixo `link-` era redundante (o `term` já dizia que era link); `site-`/`lp-` carregam informação útil (tipo de destino), permitindo separar tráfego de LP vs site no relatório.

**Arquivos alterados:**
- `docs/utm-constituicao.md` - nova regra de content por tipo de destino (§4.2), seção de bio multi-link, nota WhatsApp, versão v1.4 + histórico.
- `docs/utm-links-canais.md` - links fixos → `content=site-home`, observações reescritas (tipo de destino + bio multi-link), referência v1.4.
- `client/src/pages/UtmBuilder.tsx` - exemplos da aba Guia alinhados (link fixo `lp-`/`site-`, post nome+data); só texto, sem mudança de lógica.

**Impacto arquitetural:** Nenhum. Mudança de convenção/documentação; nenhuma alteração de schema, rota ou lógica de geração de UTM.

---

## 2026-06-08 | feat(youtube): rotas admin de sync + status (destrava métricas)

**O que foi feito:**
- Criado `server/routes/youtubeAdmin.ts` com `POST /api/admin/youtube/sync` (snapshot de canais + vídeos + métricas diárias de canal/vídeo) e `GET /api/admin/youtube/status` (canais autorizados, range das métricas diárias e últimas execuções).
- Registrado `registerYoutubeAdminRoutes(app, db)` em `server/routes.ts`, logo após o OAuth do YouTube.

**Por que:**
- O serviço `youtubeSync.ts` (`syncAllChannels`) já estava pronto, mas era órfão: só o OAuth do YouTube estava registrado, sem nenhuma rota ou cron que disparasse o sync. Resultado: dava pra autorizar os canais, mas as métricas nunca entravam no banco. Todos os outros canais (LinkedIn, TikTok, Google, Google Ads) já tinham rota admin equivalente.

**Arquivos alterados:**
- `server/routes/youtubeAdmin.ts` - novo: endpoints admin de sync e status do YouTube (usa `db`/Drizzle, pois `syncAllChannels` faz queries via `db.execute`).
- `server/routes.ts` - import + registro de `registerYoutubeAdminRoutes`.

**Impacto arquitetural:** Nenhum — espelha o padrão admin já existente dos outros canais; nenhuma mudança de schema.

---

## 2026-06-11 | feat(criativos): orçamento editável (CBO/ABO), split MQL×NMQL e escrita por allowlist

**O que foi feito:**
- Taxa de conversão agora expande por **MQL × NMQL** (cada faixa = leads da faixa ÷ visualizações da LP), com barra proporcional — em todos os níveis (conta/campanha/conjunto/anúncio).
- Nova coluna **Orçamento** espelhando o Meta Ads: mostra valor + "Diário" onde o orçamento mora (campanha CBO / conjunto ABO) e a mensagem "Usando o orçamento do conjunto/da campanha" (clicável, leva pra aba dona) caso contrário.
- **Edição de orçamento pelo Cortex**: inline (lápis) com atalhos +10/+20/+30%, e ajuste **em massa por %** na barra de ações (seleciona linhas → "Orçamento %" → Aplicar). Escreve no Meta via `updateDailyBudget`/`increaseDailyBudgetByPct`, com guard-rails de ±30% e teto diário.
- **Permissão de escrita** (pausar/selecionar/editar orçamento) restrita a uma allowlist por e-mail (`META_WRITE_ALLOWED_EMAILS`): Caio Malini, Vinicius Ichino e a conta admin. Demais usuários ficam read-only, inclusive admins.
- Backend: rotas de execução do `/api/meta/actions/*` passam a usar `requireMetaWriter` (allowlist) no lugar de `isAdmin`; nova rota `POST /bulk-budget`.
- Fix: linha **Total** soma o orçamento apenas de campanhas/conjuntos **ativos** (pausados têm budget configurado mas gastam R$0/dia, inflavam o total).

**Por que:**
- Permitir gerir verba (ajuste fino e escala por %) e ligar/desligar criativos direto do Cortex, com controle de quem pode escrever e trilha de auditoria, sem depender do Gerenciador do Meta.

**Arquivos alterados:**
- `shared/constants.ts` - allowlist `META_WRITE_ALLOWED_EMAILS` + helper `canWriteMeta()`.
- `server/routes/metaActions.ts` - gate `requireMetaWriter` nas escritas + rota `/bulk-budget`.
- `server/services/metaAdsWrite.ts` - `increaseDailyBudgetByPct()` (ajuste por % com guard-rails).
- `server/routes/growth.ts` - expõe daily/lifetime budget de campanha e conjunto na query de criativos.
- `client/src/lib/criativosMetrics.ts` - lógica de orçamento por nível (CBO/ABO/own/usa_*), total só ativos, campos MQL/NMQL.
- `client/src/lib/criativosColumns.ts` - coluna "Orçamento".
- `client/src/components/criativos/CriativosTable.tsx` - sub-linhas MQL/NMQL, célula de orçamento (valor/mensagem/edição/% atalhos).
- `client/src/pages/Criativos.tsx` - `canEditMeta`, handlers de edição e ajuste em massa, navegação entre abas.

**Impacto arquitetural:** Permissão de escrita no Meta deixa de ser por role admin e passa a ser por allowlist de e-mail (decisão de produto). Pendência de infra: o usuário de banco `growth_dev` precisa de GRANT (SELECT/INSERT/UPDATE) em `cortex_core.meta_actions_log` para a auditoria — sem isso, as escritas falham antes de tocar o Meta.

---

## 2026-06-09 | feat(churn-abonados): redesign visual — paleta azul, visão 12m, cores por squad

**O que foi feito:**
- Substitui o tema âmbar/amarelo monocromático pela identidade azul do app (header e KPIs neutros, azul primário só como acento)
- Visão de 12 meses vira o padrão; o mês passa a ser drill opcional, com banner de fallback quando o mês selecionado não tem abonados — elimina os cards vazios ao abrir
- Gráfico por squad colorido via `getSquadColor`, normalizando o prefixo de emoji vindo do ClickUp (`🪖 Selva` → `Selva`); adiciona `Aura` e `Olimpo` ao mapa central de cores
- Distinção manual×automático no gráfico temporal passa de âmbar/laranja (quase iguais) para azul/roxo, com cores fixas que funcionam em dark e light
- Empty states compactos e `isAnimationActive={false}` nos gráficos
- Card "Distribuição por Motivo" ocupa a largura total quando não há submotivos, eliminando a coluna vazia ao lado

**Por que:**
- A tela destoava do resto do app ("amarelo aleatório") e abria praticamente vazia no mês corrente sem abonados ("buracos vazios")

**Arquivos alterados:**
- `client/src/pages/ChurnAbonados.tsx` - recolorido para a paleta do app, visão 12m como padrão + banner de mês vazio, cores por squad, distinção manual/automático, empty states compactos
- `client/src/lib/squadColors.ts` - adiciona cores canônicas para os squads `Aura` (teal) e `Olimpo` (laranja)

**Impacto arquitetural:** Nenhum — apenas camada de apresentação; lógica de dados e endpoint inalterados. A adição de 2 squads ao mapa de cores beneficia todas as telas que usam `getSquadColor`.

---

## 2026-06-08 | chore(criativos): pausa o agente de IA (Analisar com IA / Propostas)

**O que foi feito:**
- Remove da UI os botões "Analisar com IA" e "Propostas" + o drawer de propostas e todo o código cliente do agente
- Desmonta a rota `/api/criativos/agent` e remove `server/routes/criativosAgent.ts`
- Mantém `metaActions` (pausar/ativar/budget manual + bulk) e `growthAiTools` (compartilhado com a rota growth-ai), pois o pause/ativar manual depende deles

**Por que:**
- A feature de IA fica pausada por ora; o PR entrega o revamp da aba Criativos (tabs, colunas/views, resize, pausar/ativar manual, drill-down, busca) sem o agente

**Impacto arquitetural:** Nenhum — agente desativado de forma reversível; backend compartilhado preservado.

---

## 2026-06-08 | fix(criativos): scroll lateral (sticky) + tabs full-width

**O que foi feito:**
- Corrige o scroll horizontal "bugado" (vãos/transparência nas colunas fixas): tabela passa de `border-collapse` para `border-separate border-spacing-0` — `position: sticky` em células não funciona bem com border-collapse
- Tabs redesenhados full-width (4 abas distribuídas, estilo abas com destaque azul na ativa), conforme referência

**Arquivos alterados:**
- `client/src/components/criativos/CriativosTable.tsx` - border-separate + bordas nas células
- `client/src/pages/Criativos.tsx` - tabs full-width; ações movidas para a linha de filtros

**Impacto arquitetural:** Nenhum.

---

## 2026-06-08 | feat(criativos): config de colunas (views), resize e layout reorganizado

**O que foi feito:**
- **Engrenagem de configurações** (uma só) com abas **Colunas** e **Cores**: escolher quais colunas aparecem, reordenar (arraste), e **visualizações salvas** (presets nomeados no navegador)
- **Redimensionar colunas** arrastando a borda do cabeçalho (nome + métricas); largura salva no navegador
- **Layout reorganizado**: KPI cards no topo; filtros (busca/status/plataforma/produto/campanha/data) + Analisar IA + Propostas + engrenagem movidos para dentro do card, junto das tabs (estilo Meta Ads)
- Tabela migrada para `table-layout: fixed` + `<colgroup>` e renderização data-driven (registro central de colunas) — elimina de vez o drift das colunas fixas e habilita resize previsível

**Por que:**
- Há ~40 métricas; mostrar todas ocupa muito espaço. O usuário precisa montar a própria visão (como no Meta Ads) e ajustar larguras

**Arquivos alterados:**
- `client/src/lib/criativosColumns.ts` (novo) - registro de colunas, config, views, persistência
- `client/src/components/criativos/CriativosSettingsSheet.tsx` (novo) - engrenagem com abas Colunas/Cores
- `client/src/components/criativos/CriativosTable.tsx` - reescrita data-driven + colgroup + resize
- `client/src/components/MetricFormattingSheet.tsx` - extrai `MetricFormattingContent` (reuso na aba Cores)
- `client/src/pages/Criativos.tsx` - estado de config/views, wiring, reorganização do layout

**Impacto arquitetural:** Tabela passa a ser data-driven a partir de um registro único de colunas; preferências (colunas/larguras/views) ficam no localStorage do usuário.

---

## 2026-06-08 | feat(criativos): 4 tabs (Conta/Campanha/Conjunto/Anúncio) + pausar/ativar

**O que foi feito:**
- Aba Criativos agora tem 4 visualizações em tabs: **Conta**, **Campanhas**, **Conjuntos**, **Anúncios** — mesmas métricas agregadas por nível (agregação client-side a partir das linhas de anúncio; derivados recalculados por soma/soma)
- Coluna de **toggle** (liga/desliga) por linha — pausa/ativa ad/conjunto/campanha direto na Meta Ads (reusa `POST /api/meta/actions/{pause,resume}` em modo manual)
- Coluna de **checkbox** + barra de **ação em massa** (Ativar/Pausar selecionados) com confirmação — usa `POST /api/meta/actions/bulk`
- Override otimista de status na sessão (a tabela lê do DB que sincroniza com a Meta a cada 6h)
- Tabela extraída para `CriativosTable.tsx` (page caiu de ~1399 → ~990 linhas) e métricas para `lib/criativosMetrics.ts`
- Linha de totais passou a usar soma/soma (antes média simples, conceitualmente errada)

**Por que:**
- O gestor pedia visão por conta/campanha/conjunto além de anúncio, e poder pausar/ativar em massa sem sair do Cortex (estilo Meta Ads Manager)

**Arquivos alterados:**
- `client/src/pages/Criativos.tsx` - tabs, agregação por nível, seleção/toggle/bulk, remoção da tabela inline
- `client/src/components/criativos/CriativosTable.tsx` (novo) - tabela reutilizável parametrizada por nível, colunas congeladas dinâmicas, toggle + checkbox
- `client/src/lib/criativosMetrics.ts` (novo) - tipos + agregação + cálculo de derivados
- `server/routes/growth.ts` - adset + status reais + contadores brutos no payload
- `server/routes/metaActions.ts` - endpoint `/bulk`

**Impacto arquitetural:** Agregação client-side a partir de uma única fonte (`/api/growth/criativos`) — totais batem entre níveis por construção; sem novos endpoints de leitura.

---

## 2026-06-08 | chore(criativos): remove impl ANTIGA órfã de otimização de ads

**O que foi feito:**
- Removida a implementação ANTIGA de otimização de Meta Ads (não roteada/órfã, vinda de stash): `server/services/adsOptimization/`, `server/routes/ads-optimization.ts`, `server/playbooks/ads-optimization.md`, `client/src/components/criativos/AdsOptimizationDialog.tsx`, `client/src/components/criativos/EditProposalSheet.tsx`, `client/src/hooks/useAdsOptimization.ts`, `docs/handover-otimizacao-ads.md`
- Removida a tabela Drizzle `metaOptimizationProposals` (+ types) de `shared/schema.ts`

**Por que:**
- Existiam DUAS implementações do agente de otimização convivendo. A NOVA (`criativosAgent` + `metaActions` + `metaActionsLog`) está integrada e funcional; a ANTIGA estava órfã. Limpeza decidida para seguir só com a nova.

**Arquivos alterados:**
- `shared/schema.ts` - removida tabela `meta_optimization_proposals` e seus types
- (deleções acima)

**Impacto arquitetural:** Nenhum — código removido não estava roteado nem importado. `tsc` sem novos erros nos arquivos da feature.
## 2026-06-08 | feat(growth): quebra Tx Conversão da Página em MQL × Não-MQL

**O que foi feito:**
- Adicionadas 2 linhas novas abaixo de "Tx Conversão da Página": "Tx Conversão Página — MQL" (mqls ÷ visualizações de página) e "Tx Conversão Página — Não-MQL" ((leads − mqls) ÷ visualizações de página)
- Aplicado na Evolução Temporal (seção Métricas de Marketing) e no Orçado x Realizado (Consolidado + Aprofundado/Meta Ads, este usando a base do pixel)
- Soma das duas reconstrói a taxa de conversão de página total já existente

**Por que:**
- Permitir comparar de onde vêm as conversões da página (parcela MQL vs Não-MQL), sem precisar abrir outras telas

**Arquivos alterados:**
- `client/src/pages/GrowthEvolucaoTemporal.tsx` - 2 novos MetricDef na seção marketing (sem orçado)
- `client/src/pages/GrowthOrcadoRealizado.tsx` - 2 linhas em buildAdsMetrics (consolidado) e em buildMetaAdsMetrics (aprofundado, base pixel)

**Impacto arquitetural:** Nenhum — apenas frontend, sem mudança de backend/SQL (dados leads/mqls/visualizacoesPagina já vinham na API)

**Atualização (visual):** As sub-taxas foram aninhadas visualmente sob "Tx Conversão da Página" — indentação + marcador `└` + cor suave (`text-muted-foreground`), e renomeadas para "MQL" / "Não-MQL". Reusa o campo `indent` do tipo `Metric` (Orçado x Realizado) e um novo flag `sub` no `MetricDef` (Evolução Temporal).

---

## 2026-06-08 | feat(growth): seed do Planejamento de Metas — Creators × Meta Ads × Junho/2026

**O que foi feito:**
- Script `scripts/seed-metas-creators-meta-junho.ts` que grava em `meta_ads.growth_budgets` (mes `2026-06`, segmento `meta_ads`, funil `Creators`) o plano de mídia de junho.
- Tier-1 (Investimento R$113.500, CPM R$70, CTR 0,80%, Connect Rate 80%, Tx Conversão 15%, %MQL 40%) reproduz a cascata de marketing 1:1: Leads 1.557, MQLs 623, CPL R$73, CPMQL R$182.
- Funil de vendas gravado com taxas **mescladas** (%RA 13,68%, RR→V% 18,78%, AOV R$9.480) → 40 negócios, receita R$379.200, CAC R$2.838.

**Inconsistência conhecida:** a aba modela uma cadeia única de vendas (`deriveAdsFunnel`), enquanto o plano separa MQL/N-MQL com taxas distintas. As taxas mescladas reproduzem o total de vendas, mas perdem a separação MQL/N-MQL.

## 2026-06-01 | style(nps): renomeia área "Comunicação" para "Social Media" no formulário — Sem impacto.

---

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
