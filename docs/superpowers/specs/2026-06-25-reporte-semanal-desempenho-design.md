# Reporte Semanal de Desempenho — Design

**Data:** 2026-06-25
**Autor:** Ichino + Claude
**Status:** Aprovado (aguardando review do spec)

## Objetivo

Criar uma tela ao vivo no Cortex para o reporte semanal de desempenho da
empresa, consolidando 4 indicadores-chave com leitura de 5 segundos:
**MRR Ativo, Churn, Entregas Pontuais e Churn Pontual**.

A tela é usada na reunião semanal para responder rapidamente "como fomos
essa semana?" — cada KPI mostra o número da semana corrente e a variação
contra a semana anterior.

## Decisões validadas (brainstorming)

| Tema | Decisão |
|------|---------|
| Onde vive | Nova tela ao vivo no Cortex (rota `/reports/semanal`) |
| Comparação | Semana atual vs semana anterior (número + variação ▲/▼) |
| Definição de semana | Corrente em andamento: **segunda desta semana → hoje**, comparada com **segunda da semana passada → mesmo dia da semana** (comparação justa de trecho) |
| Nível de detalhe | Apenas os 4 KPIs headline (sem drill-down, sem export nesta v1) |
| "Entregas Pontuais" | Itens pontuais **entregues** (flip de status → "entregue") na janela: qtd + R$ |

## Escopo

**Inclui (v1):**
- Tela `/reports/semanal` com 4 cards de KPI (grid 2×2 desktop, 1 coluna mobile)
- Endpoint consolidado `GET /api/reports/semanal?ate=YYYY-MM-DD`
- Variação semântica por direção (churn subindo = ruim/vermelho; MRR subindo = bom/verde)
- Dark/light mode
- Loading skeleton + tolerância a falha por KPI

**Não inclui (fica para depois):**
- Drill-down (quais clientes/entregas) — futura v2
- Export para imagem/PDF/Slack
- Mini-tendência / sparkline de várias semanas
- Modo apresentação fullscreen

## Arquitetura

### Backend — endpoint consolidado

Novo arquivo `server/routes/relatorioSemanal.ts`, registrado em
`server/routes.ts`.

```
GET /api/reports/semanal?ate=YYYY-MM-DD   (default ate = hoje)
```

**Por que um endpoint único e não compor os existentes:**
os endpoints atuais (`estoquePontual`, `churnPontorrente`, etc.) não
compartilham a mesma régua de janela "segunda→hoje". Concentrar a lógica de
datas num só lugar evita 4 fontes de divergência e deixa o frontend apenas
renderizando. Reaproveitamos a *lógica de query* de cada indicador (já
validada em outras telas), mas a janela temporal é definida uma vez só.

**Cálculo da janela (módulo isolado e testável):**
- `semanaAtual`: `{ inicio: segunda(ate), fim: ate }`
- `semanaAnterior`: `{ inicio: segunda(ate) - 7d, fim: ate - 7d }`
- `segunda(d)` = retrocede `d` até a segunda-feira daquela semana (timezone
  America/Sao_Paulo)

**Os 4 KPIs (cada um calculado para as 2 janelas, em paralelo):**

| KPI | Fonte | Cálculo | Direção boa |
|-----|-------|---------|-------------|
| MRR Ativo | `"Clickup".cup_data_hist` | `SUM(valorr)` do snapshot do `fim` da janela, status ativo/onboarding/triagem. Compara snapshot de hoje vs snapshot de 7 dias atrás | ↑ maior |
| Churn | `"Clickup".cup_churn` | `SUM(valor_r)` por data do pedido/encerramento dentro da janela | ↓ menor |
| Entregas Pontuais | `"Clickup".cup_data_hist` (delta de status) | itens com `valorp > 0` que passaram a status "entregue" dentro da janela: `COUNT` + `SUM(valorp)` | ↑ maior |
| Churn Pontual | lógica `churnPontorrente` | R$ pontorrente perdido (drop-off entre entregas) na janela | ↓ menor |

> As definições exatas de coluna/filtro de cada fonte serão confirmadas na
> fase de INVESTIGAR (rodar queries reais), seguindo `agents/db-specialist.md`
> e as memórias de churn/MRR/pontual antes de escrever a query final.

**Robustez:** os 8 cálculos (4 KPIs × 2 janelas) rodam em paralelo com
tolerância a falha — um KPI que falhar retorna `null` em vez de derrubar a
resposta inteira (`Promise.allSettled` ou try/catch por KPI).

**Shape da resposta:**

```jsonc
{
  "periodo": {
    "atual":    { "inicio": "2026-06-22", "fim": "2026-06-25" },
    "anterior": { "inicio": "2026-06-15", "fim": "2026-06-18" }
  },
  "kpis": {
    "mrrAtivo":         { "atual": 1420000, "anterior": 1390000, "betterDirection": "up" },
    "churn":            { "atual": 38500,   "anterior": 34200,   "betterDirection": "down" },
    "entregasPontuais": { "atual": 92000,   "anterior": 76000,   "qtdAtual": 18, "qtdAnterior": 15, "betterDirection": "up" },
    "churnPontual":     { "atual": 11300,   "anterior": 12300,   "betterDirection": "down" }
  }
}
```

Cada KPI nulo (falha) vem como `{ "atual": null, "anterior": null, ... }`.

### Frontend — página

- `client/src/pages/RelatorioSemanal.tsx`
- `client/src/pages/relatorio-semanal/useRelatorioSemanal.ts` (hook React Query,
  mesmo padrão de `useRelatorioMensal`)
- Rota lazy em `client/src/App.tsx` (`/reports/semanal`), seguindo o padrão de
  `RelatorioMensal`

**Componentes reaproveitados:** `HeroMetric` / `StatsCard`, `Card`,
`ThemeProvider`/`useTheme`, utilitários de formatação de moeda.

## Layout

```
┌────────────────────────────────────────────────────────────┐
│  Reporte Semanal                    Semana 22–25/jun        │
│  Desempenho da empresa              vs 15–18/jun            │
├──────────────────────────┬─────────────────────────────────┤
│  💚 MRR ATIVO            │  🔻 CHURN                       │
│  R$ 1.42M               │  R$ 38.500                      │
│  ▲ +2,1%  (vs 1.39M)    │  ▲ +12%  (vs 34.200)  🔴        │
├──────────────────────────┼─────────────────────────────────┤
│  📦 ENTREGAS PONTUAIS   │  ⚠️ CHURN PONTUAL               │
│  18 itens · R$ 92.000   │  R$ 11.300                      │
│  ▲ +20%  (vs 15)  🟢    │  ▼ −8%  (vs 12.300)  🟢         │
└──────────────────────────┴─────────────────────────────────┘
```

- Grid `2×2` desktop / `1 coluna` mobile.
- Header: título + período no formato `Semana DD–DD/mês · vs DD–DD/mês`.
- Cada card: ícone + label + valor grande + badge de variação + subtítulo
  cinza com o valor da semana anterior (referência).
- **Cor da variação é semântica pela `betterDirection`**, não por "subiu/desceu":
  - `betterDirection: "up"` → variação positiva = verde, negativa = vermelho
  - `betterDirection: "down"` → variação positiva = vermelho, negativa = verde
- KPI nulo: card mostra `—` no valor e oculta a variação.
- Estados: skeleton enquanto carrega; mensagem de erro amigável se a chamada
  inteira falhar.

## Testes (mínimos)

- **Lógica de janela de datas** (maior risco): `segunda(d)`, cálculo de
  `semanaAtual`/`semanaAnterior`, virada de mês/ano, timezone São Paulo.
- **Shape do endpoint**: resposta com as 4 chaves de KPI e o bloco `periodo`.
- Cálculo de variação % e mapeamento de cor por `betterDirection`.

## Riscos e pontos de atenção

- **Churn — fonte de data:** confirmar a coluna de data correta em `cup_churn`
  (data do pedido vs encerramento) na fase de investigação. As memórias do BP
  alertam para diferenças entre contar por data do pedido vs flip de status.
- **MRR via snapshot:** `cup_data_hist` tem snapshots diários, mas houve
  período com pipeline de snapshot falho (jan/26). Validar que os snapshots do
  `fim` de cada janela existem; se faltar o dia exato, usar o snapshot mais
  recente ≤ `fim`.
- **Entregas Pontuais (delta de status):** depende de comparar 2 snapshots;
  reusar o conceito de `estoque-pontual/fluxo` que já faz entradas/entregas.
- **Semana incompleta:** a semana corrente está em andamento (seg→hoje), então
  os números crescem ao longo da semana — isso é esperado e a comparação com o
  mesmo trecho da semana anterior mantém a leitura justa.
