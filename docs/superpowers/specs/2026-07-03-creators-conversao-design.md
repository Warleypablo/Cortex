# Creators Conversão — Pontual → Recorrente (jan–jun/2026)

**Data:** 2026-07-03
**Status:** Aprovado (design)

## Objetivo

Tela auxiliar para responder: **quais clientes eram pontuais em Creators e se tornaram
recorrentes?** Período de análise default: janeiro a junho de 2026.

Números validados em produção (2026-07-03): 181 clientes com pontual de Creators criado
no período; 9 converteram para recorrente (3 em Creators Recorrente — Doctors Group,
Creamy, Meliuz — e 6 em outros produtos: Social Media / Performance). Taxa ~5%.

## Definições (régua)

- **Cliente pontual de Creators:** teve contrato com
  `(produto ILIKE '%creator%' OR servico ILIKE '%creator%') AND valorp > 0`
  **criado** (`data_criado`) dentro do período filtrado.
  - Usa `%creator%` (sem "s") para captar variações/compostos, conforme
    aprendizado da tela `/creators-pontual`.
- **Converteu:** primeiro contrato **recorrente** (`valorr > 0`, qualquer produto)
  com `data_criado` **posterior** ao primeiro pontual do período.
  - Flag `recEmCreators` distingue conversão para **Creators Recorrente**
    (produto/serviço ILIKE '%creator%') vs **outro produto**.
- Grão: **cliente** (`id_task`), não contrato. Nome via `"Clickup".cup_clientes`
  (`task_id = id_task`).

## Backend

Arquivo novo: `server/routes/creatorsConversao.ts`, registrado em `server/routes.ts`
(atrás do `isAuthenticated` global de `/api`).

`GET /api/creators-conversao?de=2026-01&ate=2026-06`

- `de`/`ate` no formato `YYYY-MM`; default `2026-01` / `2026-06`.
  Validação Zod; período interpretado como [1º dia de `de`, 1º dia do mês seguinte a `ate`).
- Query SQL parametrizada (pool do `server/db.ts`), estrutura:
  1. CTE `pontual`: clientes com pontual de Creators criado no período —
     `MIN(data_criado)` (1º pontual), `COUNT(*)`, `SUM(valorp)`.
  2. CTE `rec`: por cliente, primeiro contrato recorrente (`valorr > 0`) —
     `MIN(data_criado)`, `BOOL_OR(creators)`, MRR e serviços dos recorrentes.
  3. Join: convertido quando `rec.primeiro_rec > pontual.primeiro_pontual`.
- Resposta:

```json
{
  "resumo": {
    "totalPontuais": 181,
    "convertidos": 9,
    "convertidosCreators": 3,
    "taxa": 0.0497
  },
  "clientes": [
    {
      "idTask": "86...",
      "nome": "Creamy",
      "nPontuais": 3,
      "valorPontual": 32997,
      "primeiroPontual": "2026-04-08",
      "primeiroRecorrente": "2026-06-23",
      "diasAteConverter": 76,
      "mrr": 150000,
      "servicosRecorrentes": "Creators Recorrente - Enterprise",
      "recEmCreators": true
    }
  ]
}
```

- `clientes` traz **apenas os convertidos** (os 181 aparecem só no resumo),
  ordenados por `primeiroRecorrente` desc.

## Frontend

Página única: `client/src/pages/CreatorsConversao.tsx` (sem subcomponentes; alvo < 500
linhas). React Query (`useQuery`) contra o endpoint.

- **4 cards no topo:** Pontuais no período · Converteram · p/ Creators Rec. · Taxa de
  conversão (%).
- **Tabela** dos convertidos: Cliente (link para task do ClickUp via `idTask`),
  1º pontual, nº/valor dos pontuais, data da conversão, dias até converter, MRR,
  serviço(s) recorrente(s), badge **"Creators Rec."** (destaque, ex. verde) vs
  **"Outro produto"** (neutro).
- **Filtros:** seletor de mês início/fim (default jan–jun/2026) + toggle
  "só Creators Rec." (filtro client-side sobre `recEmCreators`; cards não mudam).
- Formatação de moeda com formatador existente; dark/light mode com variantes
  `dark:` desde o início.
- Estados de loading (skeleton) e vazio ("Nenhuma conversão no período").

## Navegação / Permissão

- `shared/nav-config.ts`:
  - `PERMISSION_KEYS.GESTAO.CREATORS_CONVERSAO = 'gestao.creators_conversao'`
  - `ROUTE_PERMISSIONS['/creators-conversao']`
  - Item no grupo **Gestão**: título "Creators Conversão", ícone `Clapperboard`
  - Label no mapa de nomes de permissão
- `client/src/App.tsx`: rota lazy `/creators-conversao` com `ProtectedRoute`.

## Fora de escopo (YAGNI)

- Drill-down por contrato (drawer) — a tabela já mostra o agregado por cliente.
- Lista dos 172 não-convertidos.
- Export CSV.
- Sincronizar com `cup_data_hist` (snapshot) — fonte é o live `cup_contratos`.

## Testes

- Teste mínimo da lógica de negócio no backend: casos da query/shape via teste do
  helper de montagem de resposta (seguindo padrão `creatorsModelo.test.ts`) —
  conversão exige recorrente estritamente posterior ao 1º pontual; flag
  `recEmCreators`; taxa com divisão por zero (0 pontuais → taxa 0).
- Validação manual no browser (dark + light) comparando cards com os números
  validados em prod.

## Erros

- Params inválidos → 400 com mensagem Zod.
- Falha de banco → 500 padrão; frontend mostra estado de erro do React Query.
