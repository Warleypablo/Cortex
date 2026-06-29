# Controle de acesso por aba — Orçado x Realizado (BP 2026)

**Data:** 2026-06-26
**Status:** Design aprovado (decisões fechadas) — aguardando review do spec antes do plano de implementação

## Contexto

O módulo "Orçado x Realizado" (BP 2026) hoje expõe **11 abas** para qualquer usuário
autenticado, sem nenhuma restrição. Queremos conceder acesso a **abas específicas para
pessoas específicas**, com **confidencialidade real** (o dado não pode vazar nem via API).

### Terreno atual (investigado)

**Autenticação/autorização:**
- OAuth Google + Passport; middleware `isAuthenticated` global em `/api/*`
  (`server/auth/middleware.ts`, `server/routes.ts:470`).
- Tabela `cortex_core.auth_users` (`shared/schema.ts:19-29`): `id`, `googleId`, `email`,
  `name`, `picture`, `role` (`'admin'|'user'`), `allowedRoutes: text[]`, `department`.
- `isAdmin` (role === 'admin') protege endpoints admin (`server/routes.ts:256-261`).
- Já existe controle **por rota/página** via `allowedRoutes[]` + `shared/nav-config.ts`
  (`ROUTE_TO_PERMISSION` / `PERMISSION_TO_ROUTES`), `useAuth().hasAccess(path)` no front
  (`client/src/contexts/AuthContext.tsx`), endpoint `GET /api/auth/me`.
- **Não existe** controle por aba dentro de uma página. Este é o gap.

**Abas do BP 2026** (`client/src/pages/BP2026.tsx:101-114`) e a chave do payload que cada
uma consome (de `GET /api/bp2026/receitas`):

| Aba (id)           | Rótulo              | Chave do payload          |
|--------------------|---------------------|---------------------------|
| `dre`              | Overview            | `linhas`                  |
| `metricas`         | Métricas Gerais     | `metricasGerais`          |
| `revenue`          | Revenue             | `revenue`                 |
| `funil`            | Funil Comercial     | `funil`                   |
| `vendasProduto`    | Vendas por Produto  | `vendasProduto`           |
| `capacity`         | Capacity            | `capacity`                |
| `sga`              | SG&A                | `sgaDetalhe`              |
| `cac`              | CAC                 | `cacDetalhe`              |
| `outras`           | Outras Receitas     | `outrasDetalhe`           |
| `pontual`          | Pontual             | `pontual`                 |
| `pontual-creators` | Pontual · Creators  | endpoint separado `/api/bp2026/pontual-creators` |

**Endpoints do BP 2026:**
- `GET /api/bp2026/receitas` — devolve todas as abas num payload só (`server/routes/bp2026.ts:593`).
- `GET /api/bp2026/pontual-creators` (`server/routes/bp2026.ts:602`).
- `GET /api/bp2026/detalhe?metrica=&mes=&segmento=` — drill de célula (`server/routes/bp2026.detalhe.ts:462`).
- `GET /api/bp2026/reconciliacao?produto=&mes=` — pertence à aba `revenue` (`server/routes/bp2026.reconciliacao.ts:40`).

Todos só usam `isAuthenticated`, sem filtro por aba.

## Decisões (fechadas com o usuário)

1. **Confidencialidade real** — reforço no backend; o dado de uma aba não permitida não
   trafega para o cliente. Não é só esconder no front.
2. **Granularidade por pessoa** — cada usuário tem sua própria lista de abas liberadas.
3. **Whitelist (nega por padrão)** — sem grant explícito, o usuário não vê nenhuma aba.
4. **Modelagem por coluna dedicada** — `allowedBpTabs: text[]` em `auth_users`
   (abordagem B; A=string em allowedRoutes e C=tabela genérica foram descartadas).
5. **Abas-resumo (DRE e Métricas Gerais) são sensíveis** — elas mostram a linha-total e
   permitem drill de áreas sensíveis (CAC, SG&A); portanto entram na mesma whitelist.
   Redação linha-a-linha dentro do DRE fica **fora de escopo**.
6. **Admin vê tudo** — `role === 'admin'` ignora a whitelist (bypass), para não se trancar
   pra fora e simplificar a gestão.
7. **Escopo: feature completa** — backend (enforcement) + frontend (esconder abas) +
   tela de admin (liberar abas por pessoa).

## Arquitetura

### 1. Modelo de dados

- **Fonte única de abas** — `shared/bp2026-tabs.ts`:
  ```ts
  export const BP2026_TABS = [
    { id: 'dre', label: 'Overview' },
    { id: 'metricas', label: 'Métricas Gerais' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'funil', label: 'Funil Comercial' },
    { id: 'vendasProduto', label: 'Vendas por Produto' },
    { id: 'capacity', label: 'Capacity' },
    { id: 'sga', label: 'SG&A' },
    { id: 'cac', label: 'CAC' },
    { id: 'outras', label: 'Outras Receitas' },
    { id: 'pontual', label: 'Pontual' },
    { id: 'pontual-creators', label: 'Pontual · Creators' },
  ] as const;
  export type Bp2026TabId = typeof BP2026_TABS[number]['id'];
  ```
  Usada por front, back e admin — lista fechada, sem string mágica.

- **Coluna** em `cortex_core.auth_users`: `allowedBpTabs text[] not null default '{}'`.
  Vazio = nenhuma aba (whitelist). Atualizar `shared/schema.ts` e o tipo `AuthUser`.

- **Catálogo de enforcement** — `server/routes/bp2026.catalogo.ts`: `METRICA_POR_ABA`,
  mapeando cada métrica (e os padrões dinâmicos) à sua aba. Resolver via
  `resolverAbaDeMetrica(metrica): Bp2026TabId | null`. Prefixos consistentes facilitam:
  - `revenue`: `mrr_<produto>`, `contratos_<produto>`, `aov_<produto>`, `churn_pct_<produto>`, `churn_rs_*` (produtos: performance, creators, social, gc, others)
  - `funil`: `funil_*`, `contratos_vendidos_mrr|pontual`, `aov_venda_*`, `reunioes`, `taxa_conversao`
  - `vendasProduto`: `vendas_mrr_*`, `vendas_pontual_*`, `contratos_vendidos_<medida>_<segmento>`
  - `capacity`: `cap_*`, `gestores_*`, `designers_*`, `necessidade_*`, `contratos_por_*`, `contas_por_*`
  - `sga`: `sga_*`, `beneficio_total_empresa`
  - `cac`: `cac_*`
  - `outras`: `or_*`
  - `pontual` / `pontual-creators`: `pontual_*` (a aba creators usa o endpoint dedicado com filtro `produtoLike='%creators%'`)
  - `dre` e `metricas`: conjuntos enumerados (métricas heterogêneas; catalogar explicitamente).

  **Ambiguidade conhecida:** algumas métricas-agregadas (`cac`, `sga`, `mrr_ativo`, …)
  pertencem à aba `dre`/`metricas` **e** têm contraparte detalhada em outra aba. Por isso o
  enforcement do drill usa a **aba de origem** enviada pelo front + validação anti-spoof
  (ver §2), em vez de adivinhar a aba só pela métrica.

### 2. Backend — enforcement

Helper `abasPermitidas(user): Set<Bp2026TabId>` — se `role==='admin'`, retorna todas;
senão, `new Set(user.allowedBpTabs)`.

- `GET /api/bp2026/receitas`: monta o payload e **omite as chaves** cujas abas não estão
  liberadas (`cacDetalhe`, `sgaDetalhe`, `revenue`, `linhas`, `metricasGerais`, …).
  - v1: computa tudo e omite na serialização (suficiente para confidencialidade — o dado
    não trafega). Otimização futura: computar seletivamente (refactor de
    `computarBpReceitas`, `server/routes/bp2026.ts:553`).
- `GET /api/bp2026/pontual-creators`: `403` sem a aba `pontual-creators`.
- `GET /api/bp2026/detalhe`: passa a aceitar `?aba=<id>`. Valida:
  1. `aba` ∈ `abasPermitidas(user)` → senão `403`;
  2. `resolverAbaDeMetrica(metrica) === aba` (anti-spoof) → senão `400/403`.
- `GET /api/bp2026/reconciliacao`: exige aba `revenue` → senão `403`.

### 3. Frontend

- `GET /api/auth/me` passa a devolver `allowedBpTabs`; `AuthContext` expõe `bpTabs`
  (resolvendo admin → todas no próprio backend, então o front só consome a lista pronta).
- `client/src/pages/BP2026.tsx` renderiza apenas as `TabsTrigger`/`TabsContent` cujas abas
  estão em `bpTabs`. `defaultValue` = primeira aba liberada. Nenhuma aba → estado vazio
  ("Você não tem acesso a nenhuma aba do BP 2026").
- Os handlers de drill enviam `?aba=<id da aba ativa>`.
- Dark/light mode mantido (padrão do projeto).

### 4. Administração

- Estender a tela de permissões existente com uma seção **"Abas do BP 2026"**: 11 checkboxes
  por usuário (de `BP2026_TABS`).
- Endpoint `PUT /api/users/:id/bp-tabs` (`isAuthenticated` + `isAdmin`): recebe array de ids,
  valida contra `BP2026_TABS`, grava em `allowedBpTabs`.

### 5. Migração / rollout

- Migration adiciona `allowedBpTabs` em **local + prod** (regra de sync de schema).
- **Seed antes de ligar o enforcement:** como whitelist começa negando todos, definir a
  lista de quem mantém acesso no dia 1 (admins já passam pelo bypass; demais pessoas da
  diretoria a confirmar) e popular `allowedBpTabs` com as 11 abas para elas.

### 6. Testes (mínimos)

- **Cobertura do catálogo:** toda métrica produzida pelo payload tem `resolverAbaDeMetrica`
  != null (trava de regressão — métrica nova sem catalogar quebra o teste).
- **Enforcement:** usuário sem a aba X → chave X ausente no payload; drill de métrica de X →
  `403`; `reconciliacao` sem `revenue` → `403`.
- **Anti-spoof:** `cac_vendas` com `?aba=dre` → rejeitado.
- **Admin bypass:** `role='admin'` recebe todas as chaves.

## Fora de escopo

- Redação linha-a-linha dentro do DRE / Métricas Gerais (esconder linhas específicas
  mantendo a aba visível). Caso vire necessidade, é um projeto à parte.
- Controle por aba de outros módulos (a coluna dedicada é específica do BP 2026; se um 2º
  módulo precisar, migrar para uma tabela genérica `module_tab_permissions`).

## Arquivos afetados (referência para o plano)

- `shared/bp2026-tabs.ts` (novo) · `shared/schema.ts` (coluna) · `server/routes/bp2026.catalogo.ts` (novo)
- `server/routes/bp2026.ts` (filtro do payload + `pontual-creators`) · `server/routes/bp2026.detalhe.ts` (param `aba` + validação) · `server/routes/bp2026.reconciliacao.ts` (gate revenue)
- `server/auth/userDb.ts` / `GET /api/auth/me` (expor `allowedBpTabs`) · endpoint `PUT /api/users/:id/bp-tabs`
- `client/src/contexts/AuthContext.tsx` (tipo + `bpTabs`) · `client/src/pages/BP2026.tsx` (render condicional + `?aba`) · tela de admin de permissões
- Migration (local + prod) · testes do catálogo e do enforcement
