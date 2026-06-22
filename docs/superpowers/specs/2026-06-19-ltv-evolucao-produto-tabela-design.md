# Sub-aba: Tabela de Evolução de LT/LTV por produto

**Data:** 2026-06-19
**Tela:** `/lt-ltv-churn` ("LTV por Contrato")
**Branch:** `feature/ltv-evolucao-produto-tabela`

## Objetivo

Adicionar uma **sub-aba em formato de tabela** dentro do card *"Evolução de LT/LTV por
produto"*, mostrando a evolução mensal de **LT (meses)** e **LTV (R$)** por produto ao
longo do período coberto pelos snapshots, com um **filtro de status**: Ativos /
Cancelados / Todos.

Hoje esse card só tem um gráfico de linha (`EvolucaoProduto.tsx`) que cobre apenas a
carteira ativa. A sub-aba reaproveita a mesma ideia, mas em tabela e com os três recortes
de status.

## Posicionamento

O card `EvolucaoProduto` vira um container com `Tabs` (componente `@/components/ui/tabs`):

- **Aba "Gráfico"** — o gráfico atual, **sem alterações funcionais**.
- **Aba "Tabela"** — a nova `TabelaEvolucaoProduto`.

Os selects de **métrica** (LT/LTV) e **agregador** (Média/Mediana) que já vivem no header
do card passam a valer para as duas abas. A aba Tabela acrescenta um **select de status**
(Ativos / Cancelados / Todos). Nenhuma outra seção da tela `/lt-ltv-churn` é tocada.

## Semântica de cada filtro de status

`LT` em meses = `dias / 30.44`. `LTV = valorr × LT`. Todos os recortes só consideram
contratos **recorrentes** (`valorr > 0`).

| Filtro | Conjunto de contratos por mês M | LT de cada contrato |
|--------|--------------------------------|---------------------|
| **Ativos** | Snapshot de M, `status IN ('ativo','onboarding','triagem')` | `(data_snapshot − data_inicio)` — idade (cresce no tempo) |
| **Cancelados** | Coorte: encerrados **em M** (`data_fim` cai em M), recorrentes, LT válido | `(data_fim − data_inicio)` — vida realizada (fixa) |
| **Todos** | **União** de Ativos(M) ∪ Cancelados(M) | conforme o estado de cada linha |

- **Ativos** replica exatamente o filtro do endpoint `evolucao-produto` atual (snapshot do
  início do mês via `cup_data_hist`).
- **Cancelados** é uma **coorte por mês de encerramento**: cada contrato cancelado aparece
  **uma única vez**, no mês do seu `data_fim`, com o LT/LTV realizado. Fonte:
  `cortex_core.vw_lt_contratos` (que já calcula `lt_meses` e `ltv_recorrente` para
  churned, com o guard de `data_inconsistente`).
- **Todos** = soma coerente dos dois acima. Um contrato contribui para o mês M ou como
  ativo no snapshot de M (idade), ou — se foi encerrado em M — uma vez com a vida
  realizada. Não acumula "pilha de mortos".

## Guards de qualidade de dados (validados em prod 2026-06-19)

- **LT negativo:** 22% dos cancelados têm `data_encerramento < data_inicio`. Excluir via
  `NOT data_inconsistente` (cancelados) e `data_snapshot >= data_inicio` (ativos).
- **`valorr` sobrevive ao churn:** 100% dos 1.168 cancelados recorrentes mantêm
  `valorr > 0` → LTV realizado é calculável.
- **`produto` vazio em snapshots antigos:** manter o guard de cobertura `≥ 0.5` por mês no
  lado snapshot (Ativos/Todos), como no gráfico atual.
- **Status sempre minúsculo** em `cup_data_hist`; igualdade exata (nunca `ILIKE '%ativo%'`,
  que captura `'cancelado/inativo'`).

## Layout da tabela

- **Linhas = produtos:** `Performance`, `Social Media`, `Creators`, **`Outros`** (cauda
  agregada: Broadcast, Sustentação, CRM de Vendas, etc.) e **`Total`**.
- **Colunas = meses** (esquerda → direita), no período **nov/2025 → mês anterior ao
  atual** (meses com snapshot disponível). O conjunto de meses é igual para os três
  filtros (células sem dado ficam em branco / "—").
- **Célula** = LT (ex.: `5.3`) ou LTV (ex.: `R$ 14.076`) conforme o toggle de métrica;
  Média ou Mediana conforme o toggle de agregador.
- Dark/light mode obrigatório (classes `dark:` Tailwind). Cabeçalho de mês sticky se a
  tabela tiver scroll horizontal.

## Backend

Novo endpoint:

```
GET /api/lt-ltv-churn/evolucao-produto-tabela?status=ativos|cancelados|todos
```

Resposta (pivot pronto para render):

```jsonc
{
  "meses": ["2025-11", "2025-12", ...],
  "produtos": ["Performance", "Social Media", "Creators", "Outros", "Total"],
  "celulas": {
    "Performance": {
      "2025-11": { "lt": 5.3, "ltv": 14076, "lt_mediana": 5.0, "ltv_mediana": 12000, "n": 23 },
      ...
    },
    ...
  }
}
```

O frontend escolhe o campo a exibir (`lt` / `ltv` / `lt_mediana` / `ltv_mediana`) conforme
os toggles — sem novo request ao trocar métrica/agregador. Troca de **status** dispara
novo request (React Query keyed por status).

### Construção da query

1. **`ativos_rows`** (snapshot): mesma base do `evolucao-produto` —
   `generate_series` de meses → snapshot de referência por mês → `cup_data_hist` com
   `status IN ('ativo','onboarding','triagem') AND valorr>0 AND data_snapshot>=data_inicio`,
   guard de cobertura `≥0.5`. Cada linha: `(mes, produto, lt, valorr)`.
2. **`cancelados_rows`** (coorte): `vw_lt_contratos` com
   `tipo_receita='recorrente' AND is_churned AND NOT data_inconsistente AND data_fim NOT NULL`,
   `mes = date_trunc('month', data_fim)`. Cada linha: `(mes, produto, lt_meses, valorr)`.
3. Aplicar o filtro: `ativos` → só (1); `cancelados` → só (2); `todos` → `UNION ALL` de (1) e (2).
4. Mapear `produto` para o bucket de linha: 3 principais mantêm o nome; o resto vira
   `'Outros'`. Agregar também um bucket `'Total'` (todos os produtos).
5. Agregar por `(mes, bucket)`: `AVG(lt)`, `AVG(valorr*lt)` (LTV),
   `PERCENTILE_CONT(0.5)` para as medianas, `COUNT(*)` como `n`.

## Frontend

- `EvolucaoProduto.tsx`: refatorar para hospedar `Tabs`. Os states `metrica`/`agregador`
  sobem para o container e são passados às duas abas. Extrair o gráfico atual para um
  subcomponente `GraficoEvolucaoProduto` (corpo inalterado) para manter os arquivos
  focados (< 500 linhas).
- `TabelaEvolucaoProduto.tsx` (novo): select de status + `useQuery` no novo endpoint +
  render da matriz. Recebe `metrica` e `agregador` por props.
- `types.ts`: novo tipo `EvolucaoProdutoTabelaData` para a resposta do endpoint.

## Fora de escopo (YAGNI)

- Drill-down por contrato dentro da célula.
- Exportar para CSV/Excel.
- Filtro por squad/vendedor na tabela (a tela já tem filtro de produto global; aqui o
  recorte é por status).
- Persistir preferências de filtro do usuário.

## Critérios de aceite

1. Sub-aba "Tabela" aparece no card "Evolução de LT/LTV por produto"; "Gráfico" continua
   idêntico ao atual.
2. Filtro de status alterna entre Ativos / Cancelados / Todos e os números mudam
   coerentemente (Cancelados de mai/2026 em Performance ≈ LT 5.3 / LTV R$ 14.076, batendo
   com a validação em prod).
3. Toggles LT/LTV e Média/Mediana refletem na tabela sem recarregar dados.
4. Linhas Performance / Social Media / Creators / Outros / Total; colunas por mês.
5. Cancelados com LT negativo são excluídos; produto vazio não polui (cobertura ≥0.5).
6. Dark e light mode corretos.
