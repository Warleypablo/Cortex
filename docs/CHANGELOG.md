# Changelog

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
