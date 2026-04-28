# Design: Análise Preditiva — Dashboard Executivo

**Data**: 2026-04-02
**Público**: C-Level / Diretoria
**Abordagem**: Predictive Engine no Backend (cache diário + simulação client-side)

---

## Resumo

Dashboard de análise preditiva com 5 abas temáticas, projeções calculadas diariamente por motor estatístico no backend, simulação "what-if" instantânea no frontend, e validação automática de acurácia.

- **Horizonte**: Flexível (3/6/12 meses, default 6)
- **Atualização**: Cron diário às 06:00
- **Simulação**: Completa, com sliders em tempo real no browser

---

## Arquitetura de Dados

### Tabela: `cortex_core.predictions_cache`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | |
| tipo | VARCHAR | 'mrr_forecast', 'churn_forecast', 'nrr_projection', 'inadimplencia_forecast', 'revenue_at_risk' |
| horizonte_meses | INTEGER | 3, 6 ou 12 |
| data_referencia | DATE | Data base do cálculo |
| data_alvo | DATE | Mês sendo projetado |
| valor_otimista | NUMERIC | Cenário P10 |
| valor_realista | NUMERIC | Cenário P50 |
| valor_pessimista | NUMERIC | Cenário P90 |
| metadata | JSONB | Breakdowns por squad, fatores, detalhes |
| criado_em | TIMESTAMP | DEFAULT NOW() |

### Tabela: `cortex_core.predictions_accuracy`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | |
| prediction_id | INTEGER FK | Referência ao cache original |
| tipo | VARCHAR | Tipo da predição |
| data_alvo | DATE | Mês avaliado |
| valor_previsto | NUMERIC | O que previmos (realista) |
| valor_real | NUMERIC | O que aconteceu |
| erro_percentual | NUMERIC | Desvio % |
| criado_em | TIMESTAMP | DEFAULT NOW() |

### Motor: `server/services/predictiveEngine.ts`

5 módulos independentes:

| Módulo | Input | Algoritmo | Output |
|--------|-------|-----------|--------|
| MRR Forecast | cup_data_hist (12 meses, mensal) | Holt-Winters aditivo (α=0.3, β=0.1, γ=0.2) | 3 cenários MRR/mês |
| Churn Forecast | cup_contratos + churnRiskEngine | Sobrevivência por tier calibrado | Contratos + MRR projetados para churn |
| NRR Projection | MRR Forecast + Churn + expansão | Composição: MRR_inicio + expansão - churn | NRR % por mês |
| Inadimplência | caz_parcelas (12 meses aging) | Matriz de transição + regressão linear | Valor em risco por faixa |
| Revenue at Risk | churnRiskEngine + MRR/contrato | Agregação ponderada por P(churn) | MRR por tier de risco |

---

## Algoritmos

### 1. MRR Forecast — Holt-Winters Aditivo

- **Nível** (α=0.3): média ponderada valor observado vs previsão anterior
- **Tendência** (β=0.1): captura subida/descida
- **Sazonalidade** (γ=0.2): padrão 12 meses
- **Cenários**: Realista (P50) ± 1.28 × erro padrão (P10/P90)
- **Confiança**: ±5% (3m), ±12% (6m), ±20% (12m)

### 2. Churn Forecast — Sobrevivência Simplificada

Para cada contrato:
1. Score de risco → probabilidade mensal de churn (calibrada por tier)
2. P(ativo mês N) = (1 - P_mensal)^N
3. Churn esperado = Σ(MRR × P(churn no mês N))

Taxas históricas por tier (auto-calibrantes):
- Crítico: ~18%/mês | Alto: ~8% | Moderado: ~3% | Baixo: ~1%

### 3. NRR — Composição

```
MRR_fim = MRR_inicio + Expansão - Contração
NRR% = MRR_fim / MRR_inicio × 100
```

Expansão = média de crescimento orgânico (últimos 6 meses, excluindo novos).

### 4. Inadimplência — Matriz de Transição

- Taxa de migração entre faixas (1-30d → 31-60d → 61-90d → 90d+)
- Taxa de recuperação por faixa
- Novos inadimplentes = regressão linear da tendência

### 5. Revenue at Risk — Agregação

```
Revenue_at_risk = Σ(MRR_contrato × P(churn_90_dias))
```

Armazenado como série temporal para evolução.

### Validação Automática (dia 1 de cada mês)

- Compara previsões de 1/3/6 meses atrás com valores reais
- Registra erro% em predictions_accuracy
- Se erro > 25% por 2 meses → recalibra parâmetros

---

## API Endpoints

```
GET /api/predictions/summary?horizonte=6
GET /api/predictions/mrr-forecast?horizonte=6
GET /api/predictions/churn-forecast?horizonte=6
GET /api/predictions/nrr-projection?horizonte=6
GET /api/predictions/inadimplencia-forecast?horizonte=6
GET /api/predictions/revenue-at-risk?horizonte=6
GET /api/predictions/accuracy
```

Todos consomem dados pré-calculados de `predictions_cache`. Simulação é 100% client-side.

---

## Data Flow

```
CRON DIÁRIO (06:00)
       │
       ▼
cup_data_hist + cup_contratos + caz_parcelas + churnRiskEngine
       │
       ▼
predictiveEngine.ts (5 módulos)
       │
       ▼
predictions_cache (DB)
       │
       ▼
API Endpoints (GET, leitura de cache)
       │
       ▼
React Query (staleTime: 5min)
       │
       ▼
Charts + KPIs + Simulador (client-side math)
```

---

## Frontend

### Rota e Navegação

- **Rota**: `/dashboard/analise-preditiva`
- **Permissão**: `gestao.analise_preditiva`
- **Menu**: Gestão → após "Predição de Churn"
- **Ícone**: TrendingUp (lucide-react)

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Header: "Análise Preditiva"     [Horizonte: 3|6|12]│
├─────────────────────────────────────────────────────┤
│  3 Hero KPIs: MRR Projetado | Churn Projetado | NRR │
├─────────────────────────────────────────────────────┤
│  Tabs: MRR | Churn | NRR | Inadimplência | Risk    │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────┬──────────────────────┐    │
│  │  Gráfico (70%)       │  Simulador (30%)     │    │
│  └──────────────────────┴──────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │  Breakdown complementar                     │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Abas

**MRR Forecast**: AreaChart cone de incerteza (3 áreas) + linha "hoje" + simulação tracejada
- Sliders: novos contratos/mês, ticket médio, taxa de churn

**Churn Forecast**: ComposedChart barras por tier + linha MRR perdido acumulado
- Sliders: retenção de críticos, retenção de alto risco
- Breakdown: top 10 contratos em risco

**NRR Projection**: AreaChart NRR% com ref line 100% + decomposição expansão/contração
- Sliders: taxa expansão, taxa churn
- Breakdown: NRR por squad

**Inadimplência Forecast**: BarChart empilhado por faixa de aging projetado
- Sliders: taxa de recuperação, novos inadimplentes/mês
- Breakdown: valor por faixa + tendência

**Revenue at Risk**: BarChart horizontal MRR por tier
- Slider: efetividade de intervenção CS
- Breakdown: evolução últimos 6 meses

### Componentes

```
client/src/pages/gestao/AnalisePreditiva.tsx
client/src/components/predictions/
  MrrForecastTab.tsx
  ChurnForecastTab.tsx
  NrrProjectionTab.tsx
  InadimplenciaForecastTab.tsx
  RevenueAtRiskTab.tsx
  SimulationPanel.tsx           -- Sliders reutilizáveis
  ForecastChart.tsx             -- AreaChart cone de incerteza
  AccuracyBadge.tsx             -- Indicador de confiança (verde/amarelo/vermelho)
```

### Simulação Client-Side

```typescript
function simularMRR(baseline, novosContratos, ticketMedio, churnRate) {
  return baseline.projecao.map((mes, i) => {
    const mesesAcumulados = i + 1;
    const ganho = novosContratos * ticketMedio * mesesAcumulados;
    const perdaExtra = mes.valor_realista * (churnRate - baseline.churnRateBase);
    return { ...mes, valor_simulado: mes.valor_realista + ganho - perdaExtra };
  });
}
```

### Responsividade

- Desktop (>1024px): gráfico 70% + simulador 30% lado a lado
- Mobile (<1024px): gráfico 100% + simulador colapsável

### AccuracyBadge

- Verde: erro < 10% ("Alta confiança")
- Amarelo: 10-20% ("Média confiança")
- Vermelho: > 20% ("Baixa confiança — calibrando")
