# CEO Dashboard — Células Auditáveis (drill-down) — Design

**Data:** 2026-07-04
**Autor:** Warleypablo + Claude
**Status:** Aprovado (aguardando review do spec)
**Depende de:** `2026-07-04-ceo-dashboard-design.md` (CEO Dashboard já implementado)

## Objetivo

Tornar cada card do CEO Dashboard **auditável**, no mesmo padrão do BP 2026: clicar no card
abre um **painel lateral (Sheet)** na própria tela, mostrando a **composição** do número (as
sub-métricas que somam) e, dentro de cada grupo, as **linhas brutas** individuais (cada parcela do
Conta Azul, cada contrato do ClickUp, cada deal do Bitrix, cada resposta de E-NPS). Objetivo: o CEO
consegue rastrear qualquer número do dashboard até a origem, sem sair da tela.

## Decisões travadas (brainstorming)

1. **Mecanismo:** drawer **no próprio CEO Dashboard** (Sheet lateral), igual ao BP — sem navegar para fora.
2. **Profundidade:** **composição + linhas brutas** (igual BP) — topo com os componentes, cada um expande nas linhas individuais.
3. **Abrangência:** **os 10 cards** (Receita, Custos, Lucro, Saldo de Caixa, Inadimplência, CAC, LTV, Headcount, E-NPS, Receita/Cabeça). O card **NPS de clientes** (placeholder "em breve") fica sem drill.
4. **Arquitetura (Abordagem A):** novo endpoint `/api/ceo-dashboard/detalhe` + **extrair `montarDetalheBp` da rota `/api/bp2026/detalhe`** (a rota do BP vira wrapper fino, sem mudar comportamento). Garante drill **idêntico** ao do BP (fonte única) e usa o gate certo (`canAccessCeo`, não o gate por-aba do BP).

## Arquitetura

### Passo 1 — Extrair `montarDetalheBp` (refactor mecânico da rota do BP)

Hoje `server/routes/bp2026.detalhe.ts` tem a rota `GET /api/bp2026/detalhe` com: gate (linhas ~466-492)
→ montagem de `grupos`/`orcado`/`realizado`/`rateio`/`notaDinamica` num `if/else` grande (~514-911) →
`res.json({ metrica, mes, titulo, orcado, realizado, grupos, rateio, nota, notaDinamica })` (~914).

Extrair todo o trecho **pós-gate** para uma função exportada:

```ts
export interface DetalheBpResult {
  metrica: string; mes: number; titulo: string;
  orcado: number | null; realizado: number | null;
  grupos: GrupoDetalhe[];
  rateio?: { fracao: number; totalBruto: number; totalRateado: number };
  nota?: string; notaDinamica?: string;
}
export async function montarDetalheBp(
  db: any, opts: { metrica: string; mes: number; segmento?: string }
): Promise<DetalheBpResult>
```

A rota passa a ser: gate (inalterado) → `const r = await montarDetalheBp(db, { metrica, mes, segmento })`
→ `res.json(r)`. **Comportamento do BP não muda** (mesma saída, só reorganizada). Mês futuro
(`mes > mesCorrente`) continua devolvendo `grupos: []` — essa lógica vai para dentro da função.

### Passo 2 — Endpoint do CEO

**Arquivo novo:** `server/routes/ceoDashboard.detalhe.ts` → `registerCeoDashboardDetalheRoutes(app, db)`,
registrado em `server/routes.ts` junto de `registerCeoDashboardRoutes`.

**Rota:** `GET /api/ceo-dashboard/detalhe?kpi=<key>&mes=YYYY-MM`
- Guard: `canAccessCeo(req.user)` → 403 (mesmo guard do dashboard; **não** usa o gate por-aba do BP).
- `mes` → `mesNum` (mesmo `parseMesNum` do `ceoDashboard.ts`, extrair para `ceoDashboard.helpers.ts` e reusar).
- Roteia por `kpi` (ver mapa abaixo), montando `grupos` e devolvendo a **mesma forma do BP**:

```ts
interface CeoDetalheResponse {
  kpi: string; titulo: string; mes: number;
  orcado: number | null; realizado: number | null; atingimentoPct: number | null;
  grupos: GrupoDetalhe[];   // reusa o tipo de bp2026.helpers.ts
  nota?: string;
}
// GrupoDetalhe = { titulo, total, sinal?: "+"|"-", itens: ItemDetalhe[], itensOmitidos? }
// ItemDetalhe  = { nome, detalhe, data: string|null, valor, url? }
```

### Mapa de drill por KPI

Cada componente que é uma métrica do BP é obtido por `montarDetalheBp(db, {metrica: slug, mes})`.
Para virar **um grupo do CEO**, achata-se os `itens` dos grupos daquele componente e re-aplica-se
`agruparItens(itens, LIMITE)` (de `bp2026.helpers.ts`), com `total = componente.realizado`.

| kpi | Grupos (composição) | Origem de cada grupo |
|---|---|---|
| `receita` | MRR Ativo (+) · Venda Pontual (+) · Outras Receitas (+) | `montarDetalheBp` para `mrr_ativo`, `receita_pontual`, `outras_receitas` |
| `custos` | CSV Salários · Benefício (Caju) · Stack · CAC · SG&A · Bônus | `montarDetalheBp` para `csv_salarios`, `csv_beneficio`, `csv_stack`, `cac`, `sga`, `bonus` |
| `lucro` | Margem Bruta (+, valor) · CAC (−) · SG&A (−) · Bônus (−) | Margem Bruta = valor de `computarBpReceitas().linhas[margem_bruta]` (grupo só-valor + nota "= Receita Líquida − CSV"); CAC/SG&A/Bônus via `montarDetalheBp` |
| `cac` | sub-linhas do CAC (pré-vendas, vendas, ads…) | `montarDetalheBp('cac')` → devolve seus `grupos` diretamente |
| `headcount` | por setor | `montarDetalheBp('colaboradores')` → `grupos` diretamente |
| `receita_cabeca` | Receita (valor) · Headcount (valor) + nota "Receita ÷ Headcount = R$ X" | valores de `computarBpReceitas().metricasGerais` (`receita_total`, `colaboradores`); só-valor (sem drawer-in-drawer) |
| `caixa` | Contas bancárias | query nova: `SELECT nmbanco, empresa, balance FROM "Conta Azul".caz_bancos ORDER BY balance DESC` — item por conta |
| `inadimplencia` | Clientes inadimplentes | `storage.getInadimplenciaClientes()` — item por cliente (nome, valor vencido, `url` p/ cliente), `agruparItens` cap 50 |
| `ltv` | Clientes (LTV) | query em `cortex_core.vw_lt_contratos` por `id_task` (nome, ltv_total) desc; nota "card = média; abaixo, LTV por cliente" |
| `enps` | Promotores · Neutros · Detratores | `storage.getRhNpsRespostas(mesRef?)` — item por resposta (área, comentário, `score_empresa`); classificação ≥9 / 7-8 / ≤6 |

Regras:
- `LIMITE_ITENS` por grupo = 50 (mesmo do BP); excedente vira `itensOmitidos: {qtd, valor}` via `agruparItens`.
- `orcado`/`realizado`/`atingimentoPct` do topo vêm dos mesmos valores que o card já mostra
  (reaproveita a lógica do `/api/ceo-dashboard`; para os 7 do BP há orçado, para os 3 próprios é null).
- `caixa`, `inadimplencia`, `ltv`, `enps` **não têm orçado** → `orcado: null` no header do drawer.
- Meses futuros: componentes do BP já devolvem `grupos: []`; o CEO herda (drawer mostra vazio).

### Frontend

- **`CeoKpiCard`** (`client/src/components/ceo/CeoKpiCard.tsx`): adicionar `onClick?` + `cursor-pointer`
  e `role="button"`; **não** clicável quando `status === "em_breve"`. Hover sutil (dark/light).
- **`CeoDashboard`** (`client/src/pages/CeoDashboard.tsx`): estado `detalhe: { kpiKey: string } | null`;
  `onClick` do card grava `{ kpiKey }`; passa `mes` (o do seletor) ao drawer.
- **Componente novo `CeoKpiDetail.tsx`** (`client/src/components/ceo/`): clone enxuto do `BPCellDetail`.
  - `Sheet` lateral (`@/components/ui/sheet`), `w-full sm:max-w-xl`, scroll.
  - `aberto = kpiKey !== null`; `useQuery(["/api/ceo-dashboard/detalhe", { kpi: kpiKey, mes }])`
    (o fetcher default de `queryClient.ts` monta a querystring).
  - Header: `titulo · mês 2026` + linha `Orçado X · Realizado Y · Z% da meta` (ou só Realizado quando sem orçado).
  - Corpo: `data.grupos` como `<details>` expansíveis — título + total (com sinal +/−), cada item
    `nome`, `detalhe · data`, `valor` (link se `url`), e `itensOmitidos` ("+ N itens · R$ …").
  - Estados: loading (skeleton), erro, grupos vazios ("Sem detalhamento para este mês").
  - Dark/light obrigatório. Tipos `ItemDet`/`GrupoDet` re-declarados no client (como `CeoKpi`).

## Fluxo de dados

```
Card clicado (kpiKey) → CeoKpiDetail (Sheet)
   └─ GET /api/ceo-dashboard/detalhe?kpi=custos&mes=2026-06
        └─ ceoDashboard.detalhe.ts (guard canAccessCeo)
             ├─ kpi BP-composto → montarDetalheBp(slug, mes) por componente → grupos
             ├─ kpi fórmula (lucro, receita_cabeca) → computarBpReceitas() p/ valores + montarDetalheBp p/ componentes drilláveis
             └─ kpi próprio → getInadimplenciaClientes / vw_lt_contratos / getRhNpsRespostas / caz_bancos
        → { kpi, titulo, orcado, realizado, atingimentoPct, grupos } → drawer renderiza
```

## Testes

- **Backend (puro/orquestração):**
  - Mapa `kpi → componentes` (quais slugs cada KPI compõe) — snapshot do config.
  - Achatamento: montar um grupo do CEO a partir de um `DetalheBpResult` fake (grupos com itens) →
    total = `realizado`, itens = união achatada, cap por `agruparItens`.
  - Fórmulas: Lucro (Margem − CAC − SG&A − Bônus, valores fake) e Receita/Cabeça (nota formatada).
  - Guard: não-admin/não-CONTROL_TOWER → 403.
  - `parseMesNum` extraído e reusado (já testado indiretamente; adicionar teste direto).
- **Refactor `montarDetalheBp`:** teste de caracterização mínimo — para um `metrica/mes` conhecido,
  a função retorna o mesmo objeto que a rota retornava (mesma forma). O grosso valida no browser.
- **Frontend:** smoke render do drawer com `grupos` mockados (grupo com itens, grupo com `itensOmitidos`,
  grupo só-valor); dark e light; card `em_breve` não abre drawer.
- **Reconciliação no browser:** para Custos/CAC/Headcount, o drill do CEO deve mostrar **os mesmos itens**
  que o drill do BP na métrica equivalente (mesma fonte via `montarDetalheBp`).

## Fora de escopo (YAGNI)

- Editar/abonar dentro do drawer (o BP também não faz no detalhe).
- Export do drawer (PDF/CSV).
- Drill do card NPS de clientes (segue "em breve").
- "Drawer dentro de drawer": Receita/Cabeça mostra os dois números + fórmula (sem abrir o drill de
  Receita/Headcount de dentro dele; o usuário clica nos cards de Receita e Headcount para isso).
- Reconciliação de MRR contrato-a-contrato (o `/api/bp2026/reconciliacao` continua exclusivo do BP).

## Riscos / Pontos de atenção

- **Extração do `montarDetalheBp`:** é refactor mecânico, mas a rota é grande. Garantir saída idêntica
  (teste de caracterização + revisar o diff). Não alterar o gate nem os handlers, só mover o corpo.
- **`margem_bruta` é derivada** → não tem drill de linhas brutas; no card Lucro vira grupo só-valor
  com nota. As linhas brutas dos custos aparecem nos grupos CAC/SG&A/Bônus (drilláveis).
- **LTV**: o total do grupo (soma dos LTV) ≠ valor do card (média) — deixar claro na nota do grupo.
- **Achatamento de componentes agregados (CAC/SG&A):** ao virar um único grupo do CEO, perde-se a
  sub-estrutura interna; os itens ficam sendo as parcelas de todas as sub-linhas (ainda auditável,
  cap 50). O card **CAC** (que abre `montarDetalheBp('cac')` direto) preserva a sub-estrutura.
