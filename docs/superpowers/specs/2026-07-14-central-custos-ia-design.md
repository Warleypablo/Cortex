# Central de Custos de IA — Design

**Data:** 2026-07-14
**Status:** Aprovado (aguardando review do spec escrito)
**Rota:** `/central-custos`
**Menu:** Admin

---

## 1. Objetivo

Criar um ambiente único no Cortex para **controlar o gasto com infraestrutura de IA** da Turbo, consolidando quatro pilares de custo numa só tela, com evolução mês a mês e valores em USD original + BRL convertido:

1. **Assinaturas do Claude / ferramentas de IA** (registro manual)
2. **API da Anthropic** (custo automático via Admin API)
3. **Infraestrutura GCP** (custo automático via BigQuery Billing Export)
4. **Custos do Synapse** (o novo sistema integrado) — modelado como uma **dimensão** que atravessa os custos, não como um pilar isolado. Compõe-se da fatia de GCP do Synapse + ferramentas/serviços dedicados a ele.

## 2. Decisões de brainstorming (registro)

| Tema | Decisão |
|------|---------|
| Faseamento | **Spec único** cobrindo os 4 pilares + automações |
| GCP | Automático via **BigQuery Billing Export** (temos admin do billing) |
| API Anthropic | Automático via **Admin API Cost Report** (temos owner da org) |
| "Quem usa" (assinaturas) | **Vinculado às pessoas do RH** (`rh_pessoal`), vários usuários por assinatura |
| Synapse | **Dimensão** (projeto) = fatia GCP do Synapse + ferramentas dedicadas. Sem horas de dev, sem separar IA do build |
| Moeda | **USD original + BRL convertido** |
| Câmbio | **Automático (AwesomeAPI) + override manual** |
| Temporal | **Evolução mês a mês** |
| Arquitetura | **Abordagem C — Híbrido** (séries automáticas no shape natural + cadastros CRUD + camada de consolidação) |
| Menu | **Admin** |

## 3. Arquitetura (Abordagem C — Híbrido)

- **Dados automáticos** (GCP e Anthropic) ficam no seu **shape natural** — séries diárias em tabelas-cache, populadas por jobs de sync (mesmo padrão que o repo já usa para Meta/Google Ads).
- **Cadastros manuais** (assinaturas e ferramentas) são **CRUD limpos**.
- Uma **camada de consolidação no backend** normaliza tudo para um formato comum e alimenta a tela. A dimensão `projeto` (Synapse/Cortex/Geral) atravessa todas as fontes.

```
[custo_gcp_diario]      ─┐
[custo_anthropic_diario]─┤
[custo_assinaturas]     ─┼─► consolidacao.ts ─► { mes, pilar, fornecedor, projeto, moeda, valorUSD, valorBRL } ─► tela
[custo_itens_manuais]   ─┘        ▲
[custo_cambio_mensal]  ───────────┘ (conversão USD→BRL)
```

## 4. Modelo de dados (schema `cortex_core`)

Todas as tabelas em `shared/schema.ts` via `cortexCoreSchema.table(...)`, com os dois `type` (`$inferSelect`/`$inferInsert`) e, quando fizer sentido, `insertXSchema` Zod. Migration idempotente `migrations/2026-07-14-central-custos.sql` (`CREATE TABLE IF NOT EXISTS`), aplicada local com `npm run db:push` e em prod com runner `tsx` (molde: `scripts/apply-content-migration.ts`).

### 4.1 `custo_assinaturas` (CRUD)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial PK | |
| `fornecedor` | varchar(80) | ex: 'Anthropic'. Genérico p/ outras ferramentas de IA |
| `plano` | varchar(120) | ex: 'Claude Max', 'Claude Team 5 seats' |
| `valor` | decimal(18,2) | valor da assinatura no ciclo |
| `moeda` | varchar(3) | default 'USD' |
| `ciclo` | varchar(10) | 'mensal' \| 'anual' (anual é rateado ÷12 no custo mensal) |
| `data_assinatura` | date | |
| `data_cancelamento` | date null | quando inativou |
| `status` | varchar(10) | 'ativo' \| 'inativo' |
| `responsavel_pessoa_id` | integer null | → `rh_pessoal` (quem gerencia/paga) |
| `projeto` | varchar(20) | 'Synapse' \| 'Cortex' \| 'Geral' (default 'Geral') |
| `observacoes` | text null | |
| `created_at` / `updated_at` | timestamp | |

### 4.2 `custo_assinatura_usuarios` (junção — "quem usa")
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial PK | |
| `assinatura_id` | integer | → `custo_assinaturas.id` (ON DELETE CASCADE) |
| `pessoa_id` | integer | → `rh_pessoal` (PK a confirmar na investigação) |
| unique | (`assinatura_id`, `pessoa_id`) | |

### 4.3 `custo_itens_manuais` (CRUD — ferramentas/serviços dedicados)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial PK | |
| `descricao` | varchar(160) | ex: 'Banco gerenciado Synapse' |
| `fornecedor` | varchar(80) | |
| `categoria` | varchar(40) | ex: 'SaaS', 'Infra', 'Domínio', 'Outro' |
| `valor` | decimal(18,2) | |
| `moeda` | varchar(3) | default 'USD' |
| `ciclo` | varchar(10) | 'mensal' \| 'anual' \| 'pontual' |
| `data_inicio` | date | |
| `data_fim` | date null | |
| `status` | varchar(10) | 'ativo' \| 'inativo' |
| `projeto` | varchar(20) | 'Synapse' \| 'Cortex' \| 'Geral' |
| `responsavel_pessoa_id` | integer null | → `rh_pessoal` |
| `observacoes` | text null | |
| `created_at` / `updated_at` | timestamp | |

### 4.4 `custo_gcp_diario` (cache do BigQuery Billing Export)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial PK | |
| `data` | date | dia do custo |
| `gcp_project_id` | varchar(120) | projeto GCP de origem |
| `servico` | varchar(120) | ex: 'Cloud SQL', 'BigQuery', 'Compute Engine' |
| `custo` | decimal(18,4) | valor na moeda do billing |
| `moeda` | varchar(3) | moeda do billing export (ex: 'USD' ou 'BRL') |
| `projeto_interno` | varchar(20) | derivado via `custo_gcp_projeto_map` |
| `synced_at` | timestamp | |
| unique | (`data`, `gcp_project_id`, `servico`) | idempotência do upsert |

### 4.5 `custo_anthropic_diario` (cache do Cost Report)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial PK | |
| `data` | date | |
| `workspace` | varchar(120) null | workspace da org Anthropic |
| `modelo` | varchar(80) null | se o report detalhar por modelo |
| `custo_usd` | decimal(18,4) | Cost Report é em USD |
| `tokens_input` | bigint null | do usage report (opcional) |
| `tokens_output` | bigint null | opcional |
| `projeto_interno` | varchar(20) | derivado de mapa workspace→projeto |
| `synced_at` | timestamp | |
| unique | (`data`, `workspace`, `modelo`) | |

### 4.6 `custo_gcp_projeto_map` (config editável)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial PK | |
| `gcp_project_id` | varchar(120) unique | |
| `projeto_interno` | varchar(20) | 'Synapse' \| 'Cortex' \| 'Geral' |

### 4.7 `custo_cambio_mensal` (suporte)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial PK | |
| `ano_mes` | varchar(7) unique | 'YYYY-MM' |
| `taxa_usd_brl` | decimal(10,4) | |
| `fonte` | varchar(10) | 'auto' \| 'manual' |
| `updated_at` | timestamp | |

## 5. Camada de consolidação

`server/services/custos/consolidacao.ts` — dado um `mes` (YYYY-MM):
1. **Assinaturas**: ativas no mês; custo mensal = `valor` se ciclo mensal, `valor/12` se anual. Converte p/ BRL pela taxa do mês.
2. **Itens manuais**: ativos no mês; mesma lógica de rateio; `pontual` conta só no mês do `data_inicio`.
3. **GCP**: soma `custo_gcp_diario` do mês, agrupado por `projeto_interno`/`servico`. Converte se moeda ≠ BRL.
4. **Anthropic**: soma `custo_anthropic_diario` do mês. Converte USD→BRL.
5. Devolve linhas normalizadas `{ mes, pilar, fornecedor, projeto, moeda, valorUSD, valorBRL }` + agregados por pilar, por fornecedor e por projeto (Synapse/Cortex/Geral).

**Regras de câmbio**: usa `custo_cambio_mensal.taxa_usd_brl` do mês; se ausente, usa a última disponível e sinaliza `cambioEstimado: true`.

**Alvo dos testes** (business logic crítica, TDD): rateio anual÷12, conversão USD→BRL, atribuição correta ao projeto Synapse, item pontual no mês certo, assinatura ativa/inativa por janela de datas.

## 6. Integrações automáticas

### 6.1 GCP — BigQuery Billing Export
- **Pré-requisito manual (uma vez):** ativar "BigQuery export" no console de Billing → cria dataset com tabela `gcp_billing_export_v1_XXXX`. Service account com `BigQuery Data Viewer` + `BigQuery Job User`. Credencial via env (padrão do `@google-cloud/storage` já existente).
- `server/services/custos/gcpBillingSync.ts`: query agregando por `usage_date × project.id × service.description` nos últimos N dias, upsert em `custo_gcp_diario`, resolve `projeto_interno` via `custo_gcp_projeto_map`.
- Gatilhos: job diário (padrão de scheduler a confirmar na investigação) + `POST /api/custos/gcp/sync` manual.
- **Nota**: o export pode levar até ~24h para começar a popular após ativado.

### 6.2 Anthropic — Cost Report
- **Pré-requisito manual:** gerar Admin API key (`sk-ant-admin…`, só o owner consegue) → env `ANTHROPIC_ADMIN_KEY`.
- `server/services/custos/anthropicCostSync.ts`: GET no Cost Report (e opcionalmente Usage Report p/ tokens) por dia, upsert em `custo_anthropic_diario`.
- Gatilhos: job diário + `POST /api/custos/anthropic/sync`.

### 6.3 Câmbio
- `server/services/custos/cambioSync.ts`: busca `USD-BRL` da AwesomeAPI (`economia.awesomeapi.com.br/last/USD-BRL`), upsert em `custo_cambio_mensal` com `fonte='auto'`.
- Override manual: `PUT /api/custos/cambio/:anoMes` grava `fonte='manual'` (não sobrescrito pelo job).

## 7. Endpoints (`server/routes/custos.ts`)

Registrado em `registerRoutes` (routes.ts). `app.use("/api", isAuthenticated)` já cobre auth; escrita exige guard `isAdmin` (molde `server/routes/metas.ts`).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/custos/consolidado?mes=YYYY-MM` | KPIs + split por pilar/fornecedor/projeto |
| GET | `/api/custos/evolucao?de=YYYY-MM&ate=YYYY-MM` | série mensal p/ gráfico |
| GET/POST/PUT/DELETE | `/api/custos/assinaturas[/:id]` | CRUD assinaturas |
| PUT | `/api/custos/assinaturas/:id/usuarios` | define usuários (lista de `pessoa_id`) |
| GET/POST/PUT/DELETE | `/api/custos/itens[/:id]` | CRUD ferramentas/serviços |
| GET | `/api/custos/gcp?mes=YYYY-MM` | detalhe GCP por projeto/serviço |
| POST | `/api/custos/gcp/sync` | trigger sync GCP |
| GET | `/api/custos/anthropic?mes=YYYY-MM` | detalhe API Anthropic |
| POST | `/api/custos/anthropic/sync` | trigger sync Anthropic |
| GET | `/api/custos/cambio` | taxas por mês |
| PUT | `/api/custos/cambio/:anoMes` | override manual da taxa |
| GET | `/api/custos/synapse?mes=YYYY-MM` | visão filtrada projeto=Synapse |
| GET | `/api/custos/pessoas` | lista de `rh_pessoal` p/ o multi-select |

## 8. UX da tela (`client/src/pages/CentralCustos.tsx`)

Template base: `CeoDashboard.tsx`. Componentes em `client/src/components/custos/`. Dark/light obrigatório (`dark:` variants). React Query + Recharts.

- **Header**: título + seletor de mês + toggle USD/BRL.
- **KPIs (topo)**: Total do mês (BRL) + variação vs. mês anterior; cards por pilar (Assinaturas · API Anthropic · GCP · Ferramentas); card **Synapse** (% e valor do total que é Synapse).
- **Gráfico de evolução** mês a mês (stacked bar/area por pilar).
- **Seções/abas**:
  - **Assinaturas Claude** — tabela CRUD (responsável, plano, valor+moeda, ciclo, data assinatura, status, usuários) + modal add/edit com multi-select de pessoas do RH.
  - **API Anthropic** — série do Cost Report (workspace/modelo), total do mês, botão "Sincronizar agora".
  - **GCP** — detalhe por projeto/serviço, destaque da fatia Synapse, botão sincronizar, edição do mapa projeto→interno.
  - **Ferramentas/Serviços** — tabela CRUD manual com flag de projeto.
  - **Synapse** — visão consolidada de tudo marcado como Synapse.

## 9. Acesso

- Nova `PERMISSION_KEYS.ADMIN.CENTRAL_CUSTOS = 'admin.central_custos'` em `shared/nav-config.ts`.
- Entrada em `ROUTE_TO_PERMISSION` (`/central-custos`), item em `NAV_CONFIG.admin` (`{ title:'Central de Custos', url:'/central-custos', icon:'…', permissionKey }`), label em `PERMISSION_LABELS`.
- Rota lazy + `<Route>` em `App.tsx`. Admin bypassa; liberar a CEO/financeiro via `allowed_routes`.

## 10. Ordem de construção (dentro do spec único)

1. **Fundação**: `schema.ts` (7 tabelas) + migration + camada de consolidação + `GET /consolidado` e `/evolucao` (com dados de teste).
2. **Assinaturas**: CRUD + junção RH + `GET /pessoas` + tela + testes de consolidação.
3. **Itens manuais**: CRUD + tela.
4. **Câmbio**: sync auto + override + integração na consolidação.
5. **GCP**: service account + `gcpBillingSync` + endpoints + tela GCP + mapa de projeto.
6. **Anthropic**: admin key + `anthropicCostSync` + endpoints + tela API.
7. **Synapse + KPIs + gráfico de evolução**.
8. **Permissão + menu + polish dark/light**.

## 11. Pré-requisitos do usuário (fora do código)

- [ ] Ativar **BigQuery Billing Export** no console de Billing do GCP.
- [ ] Prover **service account** com acesso ao dataset de billing (JSON de credencial).
- [ ] Gerar **Admin API key** da Anthropic (`sk-ant-admin…`) → env `ANTHROPIC_ADMIN_KEY`.

## 12. Pontos a investigar antes de codar (etapa INVESTIGAR)

- Schema real de `rh_pessoal` (PK e coluna de nome) para a junção e o multi-select.
- Como o projeto agenda jobs recorrentes (cron/scheduler existente — há sync do Instagram e de deals Bitrix).
- Teste real com **curl** do Cost Report da Anthropic e de uma query no BigQuery com credenciais reais, **antes** de escrever os syncs.
- Moeda do billing export (USD vs BRL) — decide se GCP precisa de conversão.

## 13. Riscos / gaps conhecidos

- Billing export leva até ~24h para popular após ativado → primeiros dias podem vir vazios.
- `rh_pessoal` pode não ter todas as pessoas que usam Claude (ex: terceiros) → avaliar fallback de nome livre se a investigação mostrar buracos.
- Cost Report da Anthropic pode não detalhar por API key individual dependendo do plano → o design tolera `workspace`/`modelo` nulos.
- Aplicar schema **em prod também** (não só local) — regra do projeto.

---

**Co-Authored-By:** Claude Opus 4.8 (1M context)
