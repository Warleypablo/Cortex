# Capacity por clientes — Cap. Clientes, Δ Clientes e % Clientes

**Data:** 2026-07-20
**Tela:** `/capacity-times` (`client/src/pages/CapacityTimes.tsx`)
**Status:** aprovado, aguardando plano de implementação

## Problema

A tela mede capacity em duas réguas: faturamento (`Cap. FAT ($)`, `Δ FAT`, `% FAT`) e
contagem (`Contratos`, `Cap. Contratos`, `Δ Contratos`, `% Contratos`). Falta a régua de
**clientes** — quantos clientes distintos a pessoa atende, contra uma meta própria.

Um operador com 30 contratos concentrados em 12 clientes tem carga de relacionamento
muito diferente de outro com 30 contratos em 30 clientes, e hoje os dois aparecem
idênticos na tela.

Há ainda uma inconsistência: no grupo **Black**, a coluna rotulada "Contratos" já conta
clientes distintos (`COUNT(DISTINCT cup_clientes.task_id)`), não subtasks — divergindo do
significado que a mesma coluna tem em todas as outras abas.

## Escopo

Adicionar o trio `Cap. Clientes` / `Δ Clientes` / `% Clientes` (mais a contagem `Clientes`)
em **todas as quatro abas** da tela: Squadra + CXCS, Black, squads de CS e Selva. São três
componentes de tabela, porque `ComercialTable` serve Squadra, CXCS e Black; `CsTable`
serve os squads; `SelvaTable` serve a Selva.

Fora de escopo: mudar as réguas de faturamento e de contratos existentes (exceto a
correção do Black descrita abaixo), e alterar a tela `/capacity`.

## Decisões

### 1. Fonte da meta: nova coluna no banco

Adicionar `cap_clientes INTEGER NULL` em `cortex_core.capacity_metas`, editável na aba
Configurar ao lado de `Cap. Contratos`.

Meta própria e independente do cap de contratos — reaproveitar `cap_contas` para as duas
réguas foi descartado porque a mesma meta produziria leituras contraditórias (100% numa
régua e 40% na outra para a mesma pessoa).

A migration deve ser aplicada em **local e produção**. `NULL` é o estado inicial de todas
as linhas: sem meta configurada, as colunas `Cap.`, `Δ` e `%` exibem "—".

### 2. Definição de "cliente" por aba

Sempre `COUNT(DISTINCT` do cliente do ClickUp `)` sobre a carteira que a aba já monta,
**herdando os filtros de status que cada query usa hoje** — nenhum filtro novo é
introduzido:

| Aba | Carteira | Status considerados | Clientes (novo) |
|---|---|---|---|
| Squadra / CXCS | subtasks via `responsavel` / `cs_responsavel` | `ativo`, `onboarding`, `em cancelamento` | clientes distintos dessas subtasks |
| CS (Pulse, Olimpo) | subtasks via `responsavel ILIKE match_responsavel` | `ativo`, `onboarding`, `em cancelamento` | clientes distintos dessas subtasks |
| Selva | contas rec + pontual via responsável da subtask | igual à query atual da aba | clientes distintos dessas contas |
| Black | clientes via `cup_clientes.responsavel_geral` | `ativo`, `em cancelamento` | clientes distintos da carteira |

### 3. Correção do Black

O Black passa a contar **contratos reais** (subtasks das carteiras) na coluna `Contratos`,
como todas as outras abas, e o número que hoje aparece ali migra para a coluna `Clientes`,
que é o que ele sempre foi.

Consequência aceita: os valores de "Contratos" do Black mudam em relação ao que a tela
exibe hoje. É correção de rótulo enganoso, não regressão.

### 4. Cálculo

Reusa os helpers puros de `server/routes/capacityTimes.helpers.ts`, mantendo a convenção
já aplicada a contratos e faturamento:

- `dif_clientes = diff(cap_clientes, clientes)` — positivo = folga (verde), negativo =
  estouro (vermelho), `null` quando não há cap
- `util_clientes_pct = utilPct(clientes, cap_clientes)` — `null` quando o cap é ausente ou
  zero; renderizado como "—"

### 5. UI

Nas quatro tabelas, o bloco `Clientes | Cap. Clientes | Δ Clientes` entra logo após o
bloco de Contratos; `% Clientes` entra no fim, junto das outras percentagens, usando
`UtilBar` com as mesmas faixas de cor (verde < 70, amarelo 70–89, vermelho ≥ 90).

Ordem final de colunas na `ComercialTable`:

```
Nome | MRR Atual | Cap. FAT ($) | Δ FAT | Ticket Médio | % Time |
Contratos | Cap. Contratos | Δ Contratos |
Clientes | Cap. Clientes | Δ Clientes |
% FAT | % Contratos | % Clientes
```

As tabelas já têm `overflow-x-auto`, então a largura extra rola na horizontal.

A `SelvaTable` não tem hoje colunas de contagem de contratos e **não passa a ter**: ela
recebe apenas `Clientes | Cap. Clientes | Δ Clientes` e `% Clientes`, mantendo suas
colunas de faturamento intactas. A `CsTable` mantém `Cap. Contratos` onde já está e
recebe o bloco de clientes logo depois de `Pontual`.

Os `StatCards` de cada aba ganham **"Capacity Clientes (média)"** (média dos
`util_clientes_pct` não nulos, via `avgOf`), totalizando 8 cards — o grid do `StatCards`
precisa acomodar 8 colunas no breakpoint `lg`.

### 6. Cleanup adjacente

O campo `util_pct` de `ComercialRow` e `CsRow` existia apenas para alimentar os cards de
alerta ("Sobrecarregados" / "Com folga"), removidos no commit `5619313b`. Remover o campo
dessas duas interfaces e de seus construtores. Em `SelvaRow` o `util_pct` é usado de
verdade (coluna "% Ocupação") e permanece.

## Componentes afetados

| Arquivo | Mudança |
|---|---|
| migration SQL (local + prod) | `ALTER TABLE cortex_core.capacity_metas ADD COLUMN cap_clientes INTEGER` |
| `server/routes/capacity.ts` | 4 queries expõem `clientes` e `cap_clientes`; Black passa a contar subtasks em `contas_rec`; CRUD de `capacity_metas` lê/grava `cap_clientes` |
| `server/routes/capacityTimes.helpers.ts` | interfaces e construtores ganham `clientes`, `cap_clientes`, `dif_clientes`, `util_clientes_pct`; removem `util_pct` de `ComercialRow`/`CsRow` |
| `server/routes/capacityTimes.helpers.test.ts` | casos para o trio novo: cap nulo, cap zero, folga, estouro |
| `client/src/pages/CapacityTimes.tsx` | interfaces espelhadas; 4 colunas em cada tabela; card de média; grid de 8 |
| `client/src/components/capacity-times/CapacityMetasConfig.tsx` | campo `Cap. Clientes` |

## Testes

- Unitários nos helpers (já existe suíte pura): `diff` e `utilPct` para cap nulo, cap
  zero, contagem acima e abaixo da meta
- Validação manual no dev server: as quatro abas em dark e light mode, conferindo que sem
  `cap_clientes` configurado as colunas exibem "—" em vez de `0` ou `NaN`
- Conferir no Black que `Contratos` ≥ `Clientes` (um cliente pode ter várias subtasks)

## Riscos

- **Dados do Black mudam de valor.** Quem acompanha o número de "Contratos" do Black vai
  ver uma alteração; comunicar a mudança.
- **Migration em produção.** Sem ela, o endpoint quebra ao selecionar uma coluna
  inexistente. A migration precede o deploy.
- **Custo das queries.** O `COUNT(DISTINCT)` extra roda sobre CTEs já materializadas pelas
  queries atuais; se houver degradação perceptível, medir antes de otimizar.
