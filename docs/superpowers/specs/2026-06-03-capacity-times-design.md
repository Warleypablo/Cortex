# Capacity por Times — Design

**Data:** 2026-06-03
**Branch:** `feature/capacity-times`
**Autor:** Warleypablo + Claude

## 1. Objetivo

Transformar a planilha manual de *capacity* (ocupação atual vs. capacidade-alvo por
pessoa) em uma view ao vivo no Cortex, cobrindo os times **CS**, **Vendedores/Closers**,
**Accounts** e **Gestores**. O "operando" (carga atual) é calculado dos contratos;
as metas de capacity são fixas, importadas da planilha.

> Não confundir com a página `/capacity` existente, que cobre **apenas Gestores de
> Performance** com meta de MRR derivada do nível. Essa página fica **intacta**.

## 2. Decisões (alinhadas com o solicitante)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Estrutura | **Nova página separada** `/capacity-times` (não mexe na `/capacity`) |
| 2 | Origem das metas | **Fixas, importadas da planilha** (seed em tabela) |
| 3 | Período | **Foto atual** (snapshot de hoje, sem histórico) |
| 4 | Layout | **Unificado por categoria** (CS, Vendedores, Accounts, Gestores) |

## 3. Achados de dados (investigação validada em `cortex_dev`)

- **Toda atribuição pessoa→contrato é via `"Clickup".cup_contratos.responsavel`** (texto).
  As colunas `cs_responsavel` e `vendedor` estão **vazias** e não são usadas.
  `responsavel` raramente tem múltiplos nomes (`;`) — 5 de 309 contratos operando.
- **O papel (CS/Vendedor/Account/Gestor) não é derivável do banco.** Em `"Inhire".rh_pessoal`,
  Brenda é "Analista de Comunicação" e Taufner/Moises/Jônatas/Renan/Allan/Arpini são todos
  "Gestor de Performance". Logo a categorização é **manual** (vem do seed).
- **Nomes divergem** entre planilha (1º nome), `responsavel` ("Brenda Federici") e
  `rh_pessoal` ("Brenda Federici Vieira"); há 3 "Victor". → o seed guarda a **string de
  match exata** por pessoa.

### Definições validadas (batem com a planilha)

| Métrica | Filtro SQL sobre `cup_contratos` casando `responsavel ILIKE '%<match>%'` |
|---------|--------------------------------------------------------------------------|
| **Operando recorrente** (count) | `valorr > 0 AND status IN ('ativo','onboarding','em cancelamento')` |
| **MRR Operando** (soma `valorr`) | mesmo filtro acima |
| **MRR por status** | mesmo filtro, separado em `ativo` / `onboarding` / `em cancelamento` |
| **Operando pontual** (count) | `valorp > 0 AND status IN ('ativo','onboarding')` |
| **Contas ativas** (comercial) | = Operando recorrente (count) |

Validação (operando recorrente / MRR): Brenda 10/R$30.238, Mariana R$36.488 (planilha R$36.488),
Debora R$58.094 (planilha R$58.094), Lara 11. Pontual: Brenda 0, Lara 5, Larissa 12, Julia 8
(exatos); demais off-by-1 por diferença de data do snapshot.

## 4. Modelo de dados

Nova tabela **`cortex_core.capacity_metas`** (criar em **local + produção** — ver
[[feedback_db_prod_sync]]). Definida em `server/db.ts` (bloco de `CREATE TABLE IF NOT EXISTS`).

```sql
CREATE TABLE IF NOT EXISTS cortex_core.capacity_metas (
  id                 SERIAL PRIMARY KEY,
  nome               TEXT NOT NULL,           -- exibição (planilha)
  match_responsavel  TEXT NOT NULL,           -- string p/ ILIKE em cup_contratos.responsavel
  categoria          TEXT NOT NULL,           -- 'cs' | 'vendedor' | 'account' | 'gestor'
  cap_recorrente     INTEGER,                 -- meta nº contas recorrentes (CS)
  cap_mrr            NUMERIC,                  -- meta MRR
  cap_pontual        INTEGER,                 -- meta nº pontuais (CS)
  cap_contas         INTEGER,                 -- meta nº contas (comercial)
  ordem              INTEGER DEFAULT 0,        -- ordenação dentro da categoria
  ativo              BOOLEAN DEFAULT TRUE,
  atualizado_em      TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_responsavel, categoria)
);
```

Campos de capacity são **nullable**: cada categoria preenche os relevantes; o que faltar
aparece como "—" na UI.

### Decisão registrada — capacity de CS (confirmar no review)

A planilha tem **dois formatos de capacity de CS**:
- Grupo 1 (Brenda, Fernanda, Karla, Iasmim, Victor): metas separadas
  `cap_recorrente` + `cap_mrr` + `cap_pontual`.
- Grupos 2/3 (Mariana, Lara, Julia, Debora, Larissa, Ana): **um único** "Capacity"
  (20/25) que representa o **total de contas** (recorrente+pontual).

Decisão para manter o layout unificado: o seed preenche `cap_recorrente`/`cap_mrr`/`cap_pontual`
quando existem; para os grupos 2/3 grava o número único em `cap_recorrente` e deixa
`cap_mrr`/`cap_pontual` nulos. A UI mostra "—" onde não houver meta. *Recomenda-se padronizar
a definição de capacity de CS depois.*

## 5. Seed (valores da planilha)

`server/seed/capacity-metas.ts` (ou bloco no boot) faz `INSERT ... ON CONFLICT DO UPDATE`.
As strings de `match_responsavel` foram derivadas da forma real em `responsavel`.

### CS — `categoria='cs'` (cap_recorrente, cap_mrr, cap_pontual)

| nome | match_responsavel | cap_rec | cap_mrr | cap_pont |
|------|-------------------|--------:|--------:|---------:|
| Brenda | Brenda Federici | 15 | 45000 | 0 |
| Fernanda | Fernanda Almeida | 16 | 40000 | 0 |
| Karla | Karla Pin | 14 | 30000 | 0 |
| Iasmim | Iasmim Torres | 15 | 45000 | 0 |
| Victor (CS) | Victor Klein | 12 | 45000 | 10 |
| Mariana Dalto | Mariana Dalto | 20 | — | — |
| Lara Grobério | Lara Grobério | 20 | — | — |
| Julia Manhães | Julia Manhães | 20 | — | — |
| Debora | Debora Mund | 25 | — | — |
| Larissa | Larissa Farias | 25 | — | — |
| Ana | Ana Clara Cordeiro | 20 | — | — |

### Vendedores — `categoria='vendedor'` (cap_mrr, cap_contas)

| nome | match_responsavel | cap_mrr | cap_contas |
|------|-------------------|--------:|-----------:|
| Gabriel Taufner | Gabriel Taufner | 107510 | 30 |
| Bruno da Silva | Bruno Da Silva | 100077.69 | 30 |
| José Neto | José Neto | 73446.43 | 30 |
| Gabriel Magno | Gabriel Magno | 54330.91 | 20 |
| Felipe Almeida | Felipe Almeida | 65812.50 | 20 |
| Richard Meira | Richard Meira | 59980 | 20 |

### Accounts — `categoria='account'` (cap_mrr, cap_contas)

| nome | match_responsavel | cap_mrr | cap_contas |
|------|-------------------|--------:|-----------:|
| Moises | Moises Silva Fernandes | 76085.63 | 30 |
| Pedro | Pedro Antonio | 86685 | 30 |
| Leonardo Acc | Leonardo | 104650 | 25 |
| Breno Acc | Breno Carmo | 60376.56 | 25 |

### Gestores — `categoria='gestor'` (cap_mrr, cap_contas)

| nome | match_responsavel | cap_mrr | cap_contas |
|------|-------------------|--------:|-----------:|
| Victor Arpini (Account Prime) | Victor Arpini | 57411.76 | 10 |
| Jonatas (Account) | Jônatas Cavalcante | 67396.88 | 25 |
| Renan (Account) | Renan Fortunato | 70126.04 | 25 |
| Thiago Andrey (Gestor Prime) | Thiago Andrey | 77085 | 15 |
| Thiago Martins (Gestor Prime) | Thiago Martins | 81794.06 | 15 |
| Allan (Gestor) | Allan | 84151.25 | 30 |
| Victor Matsushita (Gestor) | Victor Matsushita | 81652.11 | 30 |

> ⚠️ **Conciliação pendente:** Alguns comerciais não batem com `responsavel` (Jônatas: 12
> contratos no banco vs. 24 na planilha; Victor Arpini: 3 vs. 17). Como `cs_responsavel`/
> `vendedor` estão vazias, a única atribuição disponível é `responsavel`. Durante a
> implementação: validar/ajustar a `match_responsavel` de cada pessoa; se não reconciliar,
> exibir o que o banco mostra e sinalizar ao solicitante que a atribuição de Accounts pode
> exigir outra fonte. **Não inventar números.**

## 6. Backend

`GET /api/capacity-times` em `server/routes/capacity.ts` (já registrado após
`app.use("/api", isAuthenticated)`). Padrão Drizzle `db.execute(sql\`...\`)`.

**Abordagem de query:** um único `WITH`:
1. `metas` — lê `capacity_metas` (ativo).
2. `contratos_match` — junta cada meta aos contratos via
   `cup_contratos.responsavel ILIKE '%' || m.match_responsavel || '%'`.
3. Agrega por pessoa: recorrente count, MRR total e por status, pontual count, contas.

**Resposta** (agrupada por categoria):
```ts
{
  cs: [{
    nome, match_responsavel,
    op_recorrente, cap_recorrente,
    mrr_operando, mrr_ativo, mrr_onboarding, mrr_cancelamento, cap_mrr,
    op_pontual, cap_pontual,
    util_recorrente_pct, util_mrr_pct
  }],
  vendedor: [{ nome, mrr_atual, cap_mrr, dif_mrr, contas_ativas, cap_contas, dif_contas, util_pct }],
  account:  [ ...mesmo shape... ],
  gestor:   [ ...mesmo shape... ]
}
```
Diferenças = `cap - atual`; utilização = `atual / cap * 100` (null-safe).

## 7. Frontend

`client/src/pages/CapacityTimes.tsx`, espelhando padrões de `Capacity.tsx`:
React Query (`useQuery(["/api/capacity-times"])`), shadcn `Table`, dark/light com `dark:`,
`formatCurrency` de `@/lib/utils`, `useSetPageInfo` + `usePageTitle`.

- **Abas** (shadcn `Tabs`) por categoria: CS · Vendedores · Accounts · Gestores.
- **Cards de resumo** por aba (total operando, total capacity, % médio de utilização).
- **Tabela CS:** Nome · Op. Rec. / Cap · MRR (mini stacked bar Ativo/Onb./Cancel.) / Cap MRR
  · Op. Pontual / Cap · barra de % utilização.
- **Tabela Vendedores/Accounts/Gestores** (mesmo layout): Nome · MRR Atual / Cap · Δ MRR
  · Contas / Cap · Δ Contas · barra de % utilização.
- **Cores de utilização:** verde `<70%`, amarelo `70–90%`, vermelho `>90%` (mesma regra
  de `Capacity.tsx`).
- Wrapper `overflow-x-auto`; valores monetários formatados; `Skeleton` no loading.

### Registro / navegação
- `App.tsx`: `lazyWithRetry(() => import("@/pages/CapacityTimes"))` + rota `/capacity-times`
  com `ProtectedRoute`.
- `shared/nav-config.ts`: item em **Gestão** → `{ title: 'Capacity Times', url: '/capacity-times',
  icon: 'Gauge', permissionKey: PERMISSION_KEYS.GESTAO.CAPACITY_TIMES }`.
- Nova permissão `gestao.capacity_times` em `PERMISSION_KEYS` + mapa `ROUTE_TO_PERMISSION`.

## 8. Fora de escopo (YAGNI)

- Edição das metas pela UI (metas são fixas via seed nesta entrega).
- Histórico por mês / navegação temporal.
- Colunas "Capacity com Account" e "Capacity Modelo Atual" da planilha de vendedores.
- Reconciliação automática de atribuição quando `responsavel` não bate (apenas sinalizar).

## 9. Testes

- Backend: query retorna shape correto; null-safe quando pessoa sem contratos; diferenças/%
  corretas. Conferir 3-4 pessoas contra a planilha (Brenda, Debora, Mariana, Lara).
- Frontend: render das 4 abas, dark + light, estados loading/empty.
- Validar seed aplicado em local **e** produção.

## 10. Itens a confirmar no review do spec

1. Capacity de CS dos grupos 2/3 gravado em `cap_recorrente` (total de contas) — ok?
2. 4 categorias separadas (CS/Vendedores/Accounts/Gestores) vs. juntar Accounts+Gestores.
3. Plano para a conciliação pendente de Jônatas/Arpini.
