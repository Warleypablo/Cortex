# BP 2026 — Orçado × Realizado (Parte 8: sub-aba Revenue)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Parte 7 (mesma branch `feature/bp2026-metricas-gerais`, PR #248). Terceira sub-aba da `/bp-2026`.

## Escopo

Sub-aba **"Revenue"**: o MRR aberto por linha de serviço, espelhando a aba Revenue da planilha. 5 grupos na ordem da planilha — Performance, Creators, Social, Gestão de Comunidade (GC), Others — cada um com 4 linhas (20 no total):

| Linha do grupo | Unidade | Direção | Realizado |
|---|---|---|---|
| MRR <linha> (**destaque**) | brl | maior | `cup_data_hist` snapshot fim do mês, `SUM(valorr)` por mapeamento de produto |
| Contratos <linha> | int | maior | idem, `COUNT(DISTINCT id_subtask)` |
| AOV <linha> | brl | maior | derivado: MRR ÷ contratos (YTD = razão das posições no mês fechado) |
| Churn <linha> | pct | menor | churn R$ do produto no mês (`vw_cup_churn_ajustado`, filtros padrão) ÷ MRR da linha no snapshot do **fim do mês anterior** |

## Decisões (aprovadas)

- **Mapeamento por produto exato** (`TRIM(produto)`): Performance→'Performance'; Creators→'Creators'; Social→'Social Media'; GC→'Gestão de Comunidade'; **Others = todos os demais** (Broadcast, Sustentação, CRM de Vendas, TikTok Shop, Consultoria de Performance, sem produto, …). Soma das 5 linhas de MRR = MRR total da matriz por construção. Nota na linha MRR Others listando os principais componentes.
- **Churn % com denominador do mês anterior** (conceito da planilha: churn sobre a base que entrou no mês). Snapshots existem desde 2025-11-17 — janeiro usa dez/2025. Mapeamento de produto idêntico nas duas pontas (mesma expressão CASE).
- **Mesma branch/PR** da Parte 7 (#248).
- Sem drill nesta sub-aba (mesma regra da aba Métricas Gerais).

## Validação executada (produção, 2026-06-10, snapshot 2026-05-31)

| Produto | Contratos | MRR |
|---|---|---|
| Performance | 166 | 472.823 |
| Creators | 171 | 279.395 |
| Social Media | 67 | 144.807 |
| Gestão de Comunidade | 5 | 43.500 |
| (demais → Others) | ~120 | ~89.704 |

Churn 2026 por produto (mesmos filtros do BP): Performance 333.096, Social 123.526, Creators 74.756, Broadcast 40.597, GC 38.000, … — view tem `produto` ✓.

## Mudanças

### Seed (`scripts/seed-bp2026-orcado.py`)
- Suporte a **coluna inicial por entrada**: tupla vira `(aba, linha, metrica)` ou `(aba, linha, metrica, col_inicial)`; default 3 (C, Overview). A aba Revenue começa os meses na coluna D (col_inicial=4; C é o "Bookado" de dezembro).
- +20 métricas: `mrr_performance`, `aov_performance`, `contratos_performance`, `churn_pct_performance` (linhas 7–10), idem `_creators` (12–15), `_social` (17–20), `_gc` (22–25), `_others` (27–30). Anti-drift (somas extraídas em 2026-06-10): mrr_performance 7426334.8933, aov_performance 34141.465714, contratos_performance 2604.204968, churn_pct_performance 1.08; mrr_creators 5004613.2318, aov_creators 56074.061264, contratos_creators 1063.612613, churn_pct_creators 1.08; mrr_social 4014651.4263, aov_social 26732.128216, contratos_social 1795.775497, churn_pct_social 1.08; mrr_gc 2634209.6604, aov_gc 108740.581448, contratos_gc 286.346478, churn_pct_gc 1.08; mrr_others 1918268.8799, aov_others 20565.197133, contratos_others 1112.449569, churn_pct_others 1.08. (As 4 somas de churn são idênticas por desenho da planilha — 9%/mês.)
- Total no seed: 52 métricas × 12.

### API
- `server/routes/bp2026.revenue.ts` (novo, padrão do `bp2026.metricas.ts`): `montarRevenue(db, orcado, mesCorrente, mesFechado)` → `LinhaReceita[]` (20 linhas, com `destaque: true` nas 5 de MRR).
  - Query 1: `cup_data_hist` — snapshots fim de mês de **dez/2025 a dez/2026** (o dez/2025 alimenta o denominador do churn de janeiro), `CASE TRIM(produto)` → linha, devolvendo MRR e contratos por linha/mês.
  - Query 2: `vw_cup_churn_ajustado` 2026 com o mesmo CASE, churn R$ por linha/mês.
  - Churn % mês m = churnR$[linha][m] ÷ MRR[linha][m−1]; janeiro usa dez/2025. Denominador 0/ausente → null.
  - AOV = MRR ÷ contratos por mês; YTDs: MRR/contratos estoque; AOV razão das posições; churn % YTD = Σ churnR$ jan..mesFechado ÷ Σ dos denominadores (MRR fim do mês anterior, jan..mesFechado) — taxa média mensal ponderada; orçado YTD = Σ(pct_orc(m) × mrr_orc(m)) ÷ Σ mrr_orc(m), ponderada pelo MRR orçado da linha.
- `bp2026.ts`: payload ganha `revenue: LinhaReceita[]`; `LinhaReceita`/`DefLinha` ganham `destaque?: boolean`.

### Frontend
- Terceira `TabsTrigger` "Revenue"; `BPDreTable` com `linhas={data.revenue}`, sem onCellClick.
- `BPLinha.destaque?: boolean`; `ehTotal` vira `linha.destaque ?? (lista atual de métricas)` — generaliza sem alterar o DRE.

## Erros e casos-limite
- Linha sem contratos no mês (GC tem 5) → AOV null se contratos 0; churn % null se denominador 0.
- Snapshot ausente no fim do mês → mesma resolução MAX(d) das partes anteriores.
- Mês corrente parcial: MRR/contratos posição atual; churn % parcial sobre denominador cheio do mês anterior.

## Workflow
Mesma branch/worktree; subagent-driven; PR #248 atualizado; validação visual dark/light.
