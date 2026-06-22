# Spec: View de Churns Abonados

**Data:** 2026-06-08  
**Status:** Aprovado

---

## Objetivo

Criar uma página dedicada para análise de churns abonados, permitindo entender padrões por motivo, operacional (squad/responsável) e evolução temporal. Hoje os abonados são excluídos das métricas regulares e aparecem apenas como um card âmbar no Detalhamento de Churn.

---

## Definição de "Abonado"

Um contrato é abonado quando:
- `abonar_churn = 'Sim'` (abono manual), **ou**
- `motivo_cancelamento` é um dos automáticos: `'Inadimplente 1º Mês'`, `'Não começou'`, `'Erro na Venda'`

Essa lógica já existe em `server/routes.ts` (`isAbonado`) e no frontend (`ChurnDetalhamento.tsx`).

---

## Arquitetura

### Fonte de dados
- **Endpoint:** `/api/churn-detalhamento?ano=X&mes=X&squad=X` (existente)
- **Filtragem:** 100% no frontend — `contratos.filter(c => c.is_abonado === true)`
- Nenhum endpoint novo é necessário

### Componente
- **Arquivo:** `client/src/pages/ChurnAbonados.tsx`
- **Rota:** `/dashboard/churn-abonados`
- **Registro:** nova `<Route>` em `App.tsx` + entrada no menu lateral (sidebar)

---

## Layout e Seções

### Filtros (topo)
- Seletor de período: ano + mês (igual ao Detalhamento atual)
- Seletor de Squad: multi-select com opção "Todos"

### Hero Cards (4 cards)
| Card | Valor |
|------|-------|
| Contratos Abonados | count total no período |
| MRR Abonado | soma de `valorr` |
| Ticket Médio | MRR / count |
| Maior Motivo | motivo com mais ocorrências no período |

### Seção 1 — Análise por Motivo
**Card: Distribuição por Motivo**
- Bar chart horizontal ordenado por MRR desc
- Eixo Y: `motivo_cancelamento`
- Toggle "Volume" / "MRR" para alternar a métrica exibida
- Tooltip: count + MRR

**Card: Detalhamento por Submotivo** (renderizado condicionalmente)
- Exibido apenas quando há `submotivo_cancelamento` preenchido nos abonados do período
- Tabela: Submotivo | Count | MRR total

### Seção 2 — Análise Operacional
**Card: Abonados por Squad**
- Bar chart vertical, ordenado por MRR desc
- Tooltip: squad + count + MRR

**Card: Top 10 Responsáveis**
- Bar chart horizontal, top 10 por count
- Tooltip: nome + count + MRR total

### Seção 3 — Evolução Temporal
**Card: Evolução Mês a Mês (últimos 12 meses)**
- Area chart com duas séries empilhadas:
  - Série "Abono Manual" (`abonar_churn = 'Sim'`) — cor âmbar (`#f59e0b`)
  - Série "Abono Automático" (motivo automático) — cor laranja claro (`#fb923c`)
- Eixo X: 12 meses anteriores ao mês de referência selecionado no filtro
- Toggle "Volume" / "MRR"
- O filtro de Squad aplica-se normalmente

---

## Detalhes de Implementação

### Dados já disponíveis no endpoint existente
Cada contrato abonado retornado já contém:
- `is_abonado`, `motivo_cancelamento`, `submotivo`, `squad`, `responsavel`
- `valorr`, `data_encerramento`, `abonar_churn`

### Lógica de série no gráfico temporal
```ts
const isAbonoPorMotivo = ['Inadimplente 1º Mês', 'Não começou', 'Erro na Venda']
  .includes(c.motivo_cancelamento);
const isAbonoManual = c.abonar_churn === 'Sim' && !isAbonoPorMotivo;
```

### Período "12 meses" no gráfico temporal
- Calcula `subMonths(refDate, 11)` até `refDate` (inclusive)
- `refDate` = primeiro dia do mês selecionado nos filtros

---

## Estilo e Temas
- Dark/light mode obrigatório (`dark:` Tailwind variants)
- Cor primária dos abonados: âmbar (`amber-500` / `#f59e0b`)
- Cor dos abonos automáticos: laranja (`orange-400` / `#fb923c`)
- Seguir padrão visual das demais páginas de churn

---

## Fora do Escopo
- Lista operacional de contratos individuais (não é o foco desta view)
- Filtros adicionais além de Período + Squad
- Novo endpoint de backend
