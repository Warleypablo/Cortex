# CEO Dashboard — Design

**Data:** 2026-07-04
**Autor:** Warleypablo + Claude
**Status:** Aprovado (aguardando review do spec)

## Objetivo

Uma tela executiva de **snapshot único** para a cúpula (CEO), com uma grade de KPI cards
cobrindo as 11 métricas-chave do negócio. Cada card mostra o valor do mês, comparação
com a **meta do BP 2026** (onde houver orçado) e uma mini-tendência (sparkline 12 meses).
Não é uma tela analítica com drill-down — é para "bater o olho" e entender a saúde da empresa.

## Decisões travadas (brainstorming)

1. **Formato:** snapshot de 1 tela — grade de KPI cards (valor + sparkline + badge). Sem drill-down.
2. **NPS de clientes:** card placeholder "em breve" — não há fonte de dados; sem backend novo.
3. **Comparação:** realizado **vs meta do BP 2026** (% de atingimento). **7 métricas têm meta no BP**
   (Receita, Custos, Lucro/EBITDA, CAC, Headcount, Receita/Cabeça e **Saldo de Caixa** — este último
   descoberto na investigação: o BP tem a linha `saldo_caixa` com orçado×realizado). As **3 sem meta**
   (Inadimplência, LTV, E-NPS) mostram valor + sparkline + MoM discreto (variação vs mês anterior).
4. **Acesso:** apenas admin / perfil `CONTROL_TOWER`.
5. **Fonte financeira:** dados financeiros vêm do **BP 2026** (`computarBpReceitas`), **NÃO** do
   Investors Report. Isso garante reconciliação com o BP.

## Arquitetura

**Abordagem escolhida: endpoint consolidado (Abordagem B do brainstorming).**

Um novo endpoint fino que, server-side, chama as **funções de cálculo já existentes** e devolve
um array normalizado de KPIs. Frontend faz **1 chamada** e renderiza genérico.

Motivos: (1) uma única chamada, payload desenhado sob medida; (2) o "vs meta" fica onde a lógica
do BP já vive (reconciliação garantida); (3) chamar as funções internamente contorna o gating
por-aba do BP e resolve o acesso com um único check `CONTROL_TOWER`; (4) sparkline de 12m
calculado no servidor uma vez.

### Backend

**Arquivo novo:** `server/routes/ceoDashboard.ts`
**Registro:** `registerCeoDashboardRoutes(app, db)` chamado em `server/routes.ts` (junto aos demais
`registerXRoutes`).

**Rota:** `GET /api/ceo-dashboard?mes=YYYY-MM`
- `mes` opcional; default = mês corrente.
- Auth: middleware `isAuthenticated` (já global em `/api`) **+ guard de acesso**: só passa se
  `req.user.role === 'admin'` **ou** o perfil de acesso do usuário for `CONTROL_TOWER`
  (mesma checagem que o `ROUTE_TO_PERMISSION` faria; ver seção Acesso). Caso contrário, `403`.

**Contrato de resposta:**

```ts
interface CeoKpi {
  key: string;                 // "receita" | "custos" | "lucro" | "caixa" | ...
  label: string;               // "Receita", "Saldo de Caixa", ...
  valor: number | null;        // valor do mês selecionado (null = sem realizado ainda)
  unidade: "brl" | "pct" | "int" | "score";
  meta: number | null;         // orçado do BP no mês; null = métrica sem meta
  atingimentoPct: number | null; // realizado/meta * 100 (respeitando direção); null se sem meta
  direcao: "maior_melhor" | "menor_melhor" | "neutro"; // p/ colorir o badge
  mom: number | null;          // variação % vs mês anterior (usado quando não há meta)
  sparkline: number[] | null;  // até 12 pontos (mais antigo → mais recente); null se indisponível
  status: "ok" | "sem_meta" | "em_breve";
  nota?: string;               // tooltip curto (ex: origem/limitação do dado)
}

interface CeoDashboardResponse {
  mes: string;                 // "2026-06"
  kpis: CeoKpi[];              // ordem fixa = ordem da grade
}
```

### Fontes por métrica (reaproveitamento)

**Investigação concluída (sourcing definitivo).** Uma **única** chamada a `computarBpReceitas(db)`
devolve `payload = { linhas[], metricasGerais[], mesCorrente, mesFechado }`. Cada linha (em ambos os
arrays) tem `{ metrica, titulo, direcao, unidade, meses: [{ mes, orcado, realizado, atingimento }] }`
— o `atingimento` **já vem calculado** pelo BP. Seleciona-se `meses[mesNum-1]`; sparkline = série de
`realizado` dos meses 1..mesNum.

**7 métricas saem dessa única chamada ao BP:**

| key | label | Array | metrica | direcao (BP) | unidade |
|---|---|---|---|---|---|
| `receita` | Receita | `metricasGerais` | `receita_total` | maior_melhor | brl |
| `custos` | Custos & Despesas | `metricasGerais` | `despesa_total` | menor_melhor | brl |
| `lucro` | Lucro (EBITDA) | `linhas` | `ebitda` | maior_melhor | brl |
| `cac` | CAC | `linhas` | `cac` | menor_melhor | brl |
| `headcount` | Headcount | `metricasGerais` | `colaboradores` | menor_melhor | int |
| `receita_cabeca` | Receita / Cabeça | `metricasGerais` | `receita_cabeca` | maior_melhor | brl |
| `caixa` | Saldo de Caixa | `metricasGerais` | `saldo_caixa` | maior_melhor | brl |

**3 métricas de fontes próprias (sem meta no BP):**

| key | label | Fonte | direcao | unidade | Comparação |
|---|---|---|---|---|---|
| `inadimplencia` | Inadimplência Total | `storage.getInadimplenciaResumo()` → `.totalInadimplente`; sparkline+MoM de `.evolucaoMensal[].valor` | menor_melhor | brl | MoM |
| `ltv` | LTV | SQL direto em `cortex_core.vw_lt_contratos` (`AVG(ltv_recorrente+valorp)` por `id_task`) | maior_melhor | brl | — (sem série) |
| `enps` | E-NPS | `storage.getRhNpsDashboard()` → `.empresa.nps` | maior_melhor | score | — (sem série) |

**1 placeholder:** `nps` (NPS Clientes) → `status: "em_breve"`, `valor: null`, sem backend.

**Regras:** métricas sem meta **nunca** recebem `atingimentoPct` (evita "comparação dupla"); só `mom`
quando há série. Meses futuros → `realizado` null → card mostra "—". `mesNum` derivado de `mes` (YYYY-MM);
BP é fixo em ANO=2026, então mês fora de 2026 cai no `mesCorrente` do payload.

### Frontend

**Arquivo novo:** `client/src/pages/CeoDashboard.tsx` — rota `/ceo-dashboard`.
- Lazy-load em `client/src/App.tsx` (`lazyWithRetry`) + `<Route path="/ceo-dashboard">` dentro do
  `ProtectedRouter`, com `<ProtectedRoute path="/ceo-dashboard" component={CeoDashboard} />`.
- React Query: `useQuery(["ceo-dashboard", mes], ...)` numa única chamada.
- Header: título + dropdown de mês (default = mês corrente; componente `@/components/ui/select`).
- Grade responsiva de cards (`grid`, ~4 colunas em desktop, 2 em tablet, 1 em mobile).

**Componente novo:** `client/src/components/ceo/CeoKpiCard.tsx`
- Props: uma `CeoKpi`.
- Layout: label (topo), valor formatado por `unidade` (formatadores de moeda existentes p/ `brl`),
  badge de comparação, sparkline mini (Recharts `AreaChart`, sem eixos).
- Badge:
  - Com meta → "% da meta" colorido por atingimento **respeitando direção**
    (verde ≥100% do "bom lado", âmbar 80–99%, vermelho <80%; para `menor_melhor`, inverter a lógica
    reusando `calcAtingimento`/`direcao` do BP).
  - Sem meta → MoM discreto (▲/▼ x%) em tom neutro no subtítulo.
  - `em_breve` → card em estado apagado (opacidade reduzida) com selo "Em breve".
- **Dark/light mode obrigatório** (`dark:` variants em todas as cores; nunca hardcodar cor).
- Estados: skeleton (loading), erro (mensagem + retry), valor null → "—".

**Reuso de UI:** avaliar `StatsCard.tsx`/`HeroMetric.tsx` existentes; `CeoKpiCard` pode compor sobre
o estilo deles, mas precisa do sparkline + badge de atingimento, que não existem prontos.

### Acesso / Navegação

`shared/nav-config.ts`:
- Nova chave em `PERMISSION_KEYS` (ex.: `GOVERNANCA.CEO_DASHBOARD = "governanca.ceo_dashboard"`),
  ou uma nova seção "Executivo" se fizer mais sentido no menu.
- `ROUTE_TO_PERMISSION["/ceo-dashboard"] = <a nova chave>`.
- Item no `NAV_CONFIG` (categoria a confirmar; sugestão: topo/"Governança" com ícone de destaque).
- **Não** adicionar a chave às listas `BASE`/`TIME`/`LIDER` em `ACCESS_PROFILES` → assim a rota fica
  automaticamente só em `CONTROL_TOWER` (= `ALL_PERMISSION_KEYS`) + admin (bypass).
- O guard do backend (`GET /api/ceo-dashboard`) replica a checagem para não depender só do frontend.

## Fluxo de dados

```
Browser (CeoDashboard.tsx)
   └─ GET /api/ceo-dashboard?mes=2026-06
        └─ ceoDashboard.ts (guard: admin OU allowedRoutes inclui /ceo-dashboard)
             ├─ computarBpReceitas(db) ........ receita, custos, lucro, cac,
             │                                   headcount, receita/cabeça, caixa (7)
             ├─ storage.getInadimplenciaResumo() . inadimplência
             ├─ SQL vw_lt_contratos ........... ltv
             └─ storage.getRhNpsDashboard() ... enps (.empresa.nps)
        → assembleCeoKpis(...) → CeoKpi[] (11, ordem fixa) → 1 payload
```

## Testes

- **Backend (mínimo, lógica de negócio — funções puras):**
  - `bpLinhaToKpi` seleciona o mês certo, copia `orcado`/`realizado`/`atingimento` do BP e monta a
    sparkline (série de `realizado` até o mês pedido).
  - Coloração do badge respeita `direcao` (`menor_melhor`: realizado abaixo da meta = verde).
  - `momFromSerie` calcula variação vs ponto anterior; retorna null com <2 pontos.
  - Métrica sem meta nunca retorna `atingimentoPct` (só `mom`).
  - `canAccessCeo(user)`: true para admin ou allowedRoutes com `/ceo-dashboard`; senão false (→403).
- **Frontend:** smoke render da grade com dados mockados; verificar dark e light mode; card
  `em_breve` renderiza apagado; card sem meta mostra MoM, card com meta mostra badge de atingimento.

## Fora de escopo (YAGNI)

- Drill-down por card / navegação para telas detalhadas.
- Coleta real de NPS de clientes (segue placeholder "em breve").
- Edição de metas (metas vêm do BP 2026 como está; sem override nesta tela).
- Seletor de período custom além do dropdown de mês.
- Export PDF (o Investors Report já cobre relatório executivo exportável).

## Riscos / Pontos de atenção

- **Reconciliação:** valores financeiros devem bater com o BP 2026 (mesma fonte). Validar no browser
  contra `/bp-2026` no fechamento.
- **Meses futuros:** `realizado` pode ser `null` → card mostra "—", sem badge quebrado.
- **Direção do atingimento** (`menor_melhor` p/ Custos e CAC) precisa colorir corretamente:
  gastar **menos** que a meta é verde.
- **Sparklines caras:** para métricas cujo histórico mensal não é barato, retornar `null` e o card
  simplesmente não desenha sparkline (sem erro).
