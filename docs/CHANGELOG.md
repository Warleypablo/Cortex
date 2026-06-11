# Changelog

## 2026-06-11 | fix(capacity): renomeia Selca para Selva e remove squad Aura (virou Pulse)

**O que foi feito:**
- Tab e título do time de vendedores renomeados de "Selca" para "Selva" (CapacityTimes + label do dialog de operador).
- "Aura" removida das categorias base do dialog de operador — a squad foi absorvida pela Pulse.
- Banco local atualizado (`UPDATE capacity_metas SET categoria='Pulse' WHERE categoria='Aura'`, 3 operadores) para espelhar prod, que já estava migrado.

**Por que:**
- O nome correto do time comercial é Selva, e a squad Aura deixou de existir ("tudo o que era Aura virou Pulse"). Prod já tinha os 8 operadores em Pulse; o local ainda mostrava a tab Aura.

**Arquivos alterados:**
- `client/src/pages/CapacityTimes.tsx` - labels Selca → Selva (overview, tab e conteúdo).
- `client/src/components/capacity-times/CapacityMetaDialog.tsx` - label "Selva (vendedor)" e CATEGORIAS_BASE sem "Aura".

**Impacto arquitetural:** Nenhum.

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
