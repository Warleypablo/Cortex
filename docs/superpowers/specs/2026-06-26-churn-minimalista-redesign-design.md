# Redesign Minimalista da Tela de Detalhamento de Churn

**Data:** 2026-06-26
**Rota:** `/dashboard/churn-detalhamento`
**Contexto:** evolução da reconstrução de 2026-06-25 (scroll narrativo) — agora reduzindo densidade.

## Objetivo

A tela atual (4 seções densas) ficou pesada. Reduzir densidade radicalmente:
**tela principal = só o panorama; todo o detalhamento vai para o drawer ao clicar.**
Informação principal "na cara", melhor aproveitamento de espaço, coerência visual.

## Decisões de produto (aprovadas)

- **Layout:** "Resumo + seletor de dimensão" (o mais minimalista). 3 blocos na tela.
- **Cores:** semântica por **severidade** — escala única emerald→amber→red (pior = mais vermelho). Aplicada a taxa, ritmo diário (dias piores) e ranking (itens maiores).
- **Tipografia:** escala única em toda a tela (não é sobre fontes de dados).
- **NRR vira KPI** no topo; resto do "Painel Executivo Detalhado" sai da tela principal (cross-sell removido da tela; ranking de squad vira a dimensão "Squad").
- **Timing** (lifetime/cohort/curva de sobrevivência) sai da tela principal → só no drawer.
- **Voz do Cliente (IA)** sai da tela principal → carrega **sob demanda** no drawer (tira o custo de IA do load inicial).
- **Taxa de churn % adaptável ao seletor de meses.**

## Layout da tela principal (scroll curto)

1. **Controles** (enxutos) — período · filtro de abono · painel de filtros colapsado. (Componente `ChurnControls` atual, mantido.)
2. **KPIs grandes** (números "na cara", cor por severidade):
   `Taxa de churn %` (recalcula conforme período) · `MRR perdido` · `Logos perdidos` · `% evitável` · `NRR`.
3. **Ritmo diário** (destaque): gráfico por **dia** do período selecionado. Toggle de métrica
   (Churn R$ / nº de logos / taxa) e recorte por equipe (Total ou por squad). Dias piores
   mais vermelhos. Clique num dia → drawer com os churns daquele dia.
4. **Churn por [dimensão ▾]**: UM bloco com seletor de dimensão —
   **Motivo · Produto · Cluster · Pessoa · Squad**. Ranking horizontal com **% e R$ por item**,
   barra colorida por severidade. Clique num item → drawer daquele recorte.

## Drawer = todo o detalhamento

`ChurnDrillDrawer` enriquecido. Ao clicar em qualquer item (um dia, um motivo, um produto…),
o drawer abre com, daquele recorte:
- **Contratos** do recorte (lista, com abonar inline) — já existe.
- **Sub-quebra contextual** — motivo→submotivo e evitabilidade do recorte.
- **Voz do Cliente / IA** — sentimento + temas + mensagens (carrega sob demanda neste ponto).
- **Timing** — lifetime / cohort / curva de sobrevivência do recorte.

## Sistema visual

- **Cores (`severity` tokens):** função util que mapeia um valor normalizado (0–1, pior→1) para
  a escala emerald→amber→red. Um único helper em `@/lib/churnColors` (ou `components/churn/severity.ts`),
  usado por KPIs, ritmo diário e ranking. Dark/light compatível.
- **Tipografia (escala única):** números KPI `text-3xl font-bold tabular-nums`; títulos de bloco
  `text-sm font-semibold`; subtítulos/labels `text-xs text-muted-foreground`. Aplicada
  consistentemente em todos os componentes da tela.

## Abordagem técnica

**Evolutiva, reaproveitando os cálculos existentes.** Os `useMemo` de distribuição
(squad, produto, cluster, responsável/pessoa, motivo), de Voz IA, de Timing e de evitabilidade
já existem nos componentes `Secao*`. Eles são reaproveitados:
- `ChurnPorDimensao` consome distribuição por squad/produto/cluster/pessoa/motivo.
- `RitmoDiario` precisa de um novo cálculo de churn por **dia** (a partir de `data_encerramento`).
- O drawer enriquecido reaproveita o conteúdo de `SecaoVozCliente` e `SecaoTiming` (que deixam de
  ser renderizados na tela principal e viram conteúdo do drawer).

### Arquitetura de componentes

```
client/src/components/churn/
  severity.ts            (novo) helper de cores por severidade
  ChurnControls.tsx      (mantido) controles
  ChurnKpisHero.tsx      (evolui) 5 KPIs grandes incl. NRR + taxa adaptável + cor severidade + tipografia
  RitmoDiario.tsx        (novo) gráfico diário + toggle métrica + recorte squad
  ChurnPorDimensao.tsx   (novo) seletor de dimensão + ranking % e R$
  ChurnDrillDrawer.tsx   (evolui) detalhamento rico: contratos + sub-quebra + Voz IA + Timing
  drawer/
    DrawerVozCliente.tsx (novo, do SecaoVozCliente) Voz IA sob demanda no drawer
    DrawerTiming.tsx     (novo, do SecaoTiming) lifetime/cohort no drawer
    DrawerSubMotivo.tsx  (novo, do SecaoMotivos) submotivo + evitabilidade do recorte
```
Os `Secao*` antigos deixam de ser usados na tela principal; sua lógica de cálculo migra para os
componentes acima. Componentes não mais referenciados são removidos na fase de limpeza.

## Plano de fases (incremental, cada fase testável)

- **Fase 1 — Sistema visual:** `severity.ts` (cores) + tokens de tipografia; aplicar nos KPIs.
- **Fase 2 — KPIs:** evoluir `ChurnKpisHero` (taxa adaptável ao período, + NRR, cor severidade, tipografia grande).
- **Fase 3 — Ritmo diário:** `RitmoDiario` (série diária + toggle métrica + recorte squad), liga ao drawer.
- **Fase 4 — Churn por dimensão:** `ChurnPorDimensao` (seletor + ranking % e R$), liga ao drawer.
- **Fase 5 — Drawer rico:** enriquecer `ChurnDrillDrawer` com sub-quebra + Voz IA (sob demanda) + Timing.
- **Fase 6 — Limpeza:** remover Painel Executivo da tela, remover `Secao*` órfãos, garantir dark/light + tipografia + cores coerentes em tudo.

## Riscos / atenção

- Cálculo de churn por dia: derivar de `data_encerramento` (e `data_pausa` p/ pausados), respeitando
  o período/filtros atuais. Não inventar dados.
- Voz IA sob demanda: a query de IA (`POST /api/analytics/churn-mensagens-ai`) deve disparar só quando
  o drawer abre (não no load da tela).
- Dark/light em todos os componentes novos.
- Não alterar backend/SQL (reorganização de frontend; reusa endpoints existentes).
- Taxa adaptável: validar a fórmula da taxa de churn no recorte de período (denominador = base do período).

## Fora de escopo

- Mudanças no backend / queries SQL.
- Predição de churn, churn por produto (tela própria), pontorrente, abonados (telas separadas).
- Cross-sell detalhado (sai da tela; permanece em outras telas/Investors).
