# Resumo dos Líderes — Novo Modelo de Mensagem (v3)

**Data:** 2026-07-20
**Status:** Aprovado (design)
**Arquivo principal:** `server/services/resumoLideres.ts`
**Specs anteriores:** `2026-07-02-resumo-lideres-whatsapp-design.md`, `2026-07-14-resumo-lideres-nrr-bruto-design.md`

## Contexto

O modelo atual da mensagem (v2, com o adendo de NRR Bruto de 14/jul) é uma lista corrida de
linhas sem agrupamento visual. O novo modelo, definido pela liderança, reorganiza a mensagem
em blocos temáticos separados por réguas (`━━━`), com emojis como hierarquia visual, e
introduz cinco métricas que hoje não existem no serviço.

Três réguas de cálculo mudam. Elas não são cosméticas e afetam números já divulgados.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Amortização do Cross Sell Pontual (÷5) | **Removida.** Bloco exibe valores cheios; `crossTotal = crossR + crossP` |
| Base do Net Churn | **Só o Cross Sell MRR** (`crossR`) — é métrica de MRR |
| Definição de MRR Operando | ativo + onboarding + triagem + em cancelamento |
| Definição de "venda nova" | Deal ganho de CNPJ cujo primeiro contrato começa no mês ou depois (aquisição pura) |
| Linha "Churn MRR sem abonos" | **Sai do texto**, permanece calculada no backend |
| Negrito do WhatsApp (`*`) | Removido — os emojis dão a hierarquia |

## Mudanças no backend

### Interface `MetricasResumo`

**Renomeações (evitam inversão semântica):** o modelo novo usa "Ativo" para o status ativo e
"MRR Ativo" para a soma dos três status. Manter os nomes atuais faria `mrrAtivo` significar o
oposto do rótulo exibido.

| Antes | Depois | Significado |
|---|---|---|
| `mrrAtivo` | `carteiraAtivo` | só `status = 'ativo'` |
| `mrrTotal` | `mrrAtivo` | triagem + onboarding + ativo |
| `crossTotal` (com ÷5) | `crossTotal` | `crossR + crossP`, sem amortização |
| `nrrBruto` / `nrrBrutoPct` | `netChurnBruto` / `netChurnBrutoPct` | `churnTotal − crossR` |

**Campos novos:**

| Campo | Origem |
|---|---|
| `mrrAdicionado` | `"Bitrix".crm_deal`, `valor_recorrente` de vendas novas do mês |
| `pontualVendido` | idem, `valor_pontual` |
| `carteiraTriagemOnboarding` | `cup_contratos`, `SUM(valorr)` com `status IN ('triagem','onboarding')` |
| `carteiraEmCancelamento` | `cup_contratos`, `SUM(valorr)` com `status = 'em cancelamento'` |
| `mrrOperando` | `mrrAtivo + carteiraEmCancelamento` |

**Campos removidos:** `crossPAmortizado`.

**Campos preservados sem exibição:** `churnBrutoSemAbono`, `churnBrutoSemAbonoPct` — continuam
no cálculo e no payload de `/preview`, apenas não entram no texto. Voltam a aparecer com uma
linha de template se pedirem.

### Query da carteira MRR

Uma única query substitui `getMrrAtivo()` (do `metricsAdapter`) e `getMrrSoAtivo()` dentro
deste serviço, devolvendo os quatro recortes de uma vez:

```sql
SELECT
  COALESCE(SUM(valorr) FILTER (WHERE status = 'ativo'), 0)             AS ativo,
  COALESCE(SUM(valorr) FILTER (WHERE status IN ('triagem','onboarding')), 0) AS triagem_onboarding,
  COALESCE(SUM(valorr) FILTER (WHERE status = 'em cancelamento'), 0)   AS em_cancelamento
FROM "Clickup".cup_contratos
```

`mrrAtivo = ativo + triagem_onboarding`; `mrrOperando = mrrAtivo + em_cancelamento`.

`getMrrAtivo()` do `metricsAdapter` continua existindo — é usado por outras telas (OKR) e não
deve ser alterado. Este serviço apenas deixa de consumi-lo.

### Vendas novas

Nova função `getVendasNovasBreakdown(startDate?, endDate?)` em `server/okr2026/metricsAdapter.ts`,
reaproveitando a CTE `cliente_inicio` que já existe em `buildVendasMrrQuery()`:

```sql
-- venda nova = CNPJ sem contrato anterior ao mês do fechamento do deal
(ci.primeiro_contrato IS NULL
 OR ci.primeiro_contrato >= date_trunc('month', d.data_fechamento)::date) AS is_novo
```

Retorna `{ mrr, pontual }` com `SUM(valor_recorrente)` e `SUM(valor_pontual)` filtrados por
`is_novo`, sobre deals com `stage_name = 'Negócio Ganho'` no mês corrente.

O cross-sell mantém a régua atual (`source = 'PARTNER'` + cliente pré-existente) — ela já é
usada em outras telas e não entra no escopo desta mudança. Consequência conhecida e aceita:
deals de cliente pré-existente com outro `source` não entram nem em "venda nova" nem em
"cross sell". São os upsells, que o disclaimer da mensagem exclui explicitamente.

### Fórmulas alteradas

```
crossTotal      = crossR + crossP                    (era crossR + crossP/5)
netChurn        = churnAjustado − crossR             (era churnAjustado − crossTotal)
netChurnBruto   = churnTotal   − crossR              (era churnTotal − crossTotal)
```

Denominadores inalterados: percentuais de MRR sobre `mrrMesAnterior`; percentuais de pontual
sobre `estoquePontualInicioMes`.

### Guard rail

`calcularMetricasResumo()` continua abortando o envio se `mrrAtivo <= 0 || mrrMesAnterior <= 0`.
As métricas novas **não** entram no guard: `mrrAdicionado` e `pontualVendido` podem ser
legitimamente zero (início de mês), e `carteiraEmCancelamento` zero é um estado saudável.

## Template

`MESES` passa de caixa alta (`JULHO`) para capitalização de título (`Julho`), como no modelo.

Saudação dinâmica preservada, agora com emoji: `< 12h` → `🌞 Bom dia`; `< 18h` → `☀️ Boa tarde`;
resto → `🌙 Boa noite`.

```
{saudacao}, líderes!

Atualização das principais métricas
{dataFmt} • {horaFmt}

━━━━━━━━━━━━━━━

💰 Receita ({mes})

Novas Vendas
📈 MRR Adicionado: {mrrAdicionado}
📦 Pontual Vendido: {pontualVendido}

📌 Considera apenas vendas novas (sem Cross Sell e Upsell).

Carteira MRR
🟡 Triagem / Onboarding: {carteiraTriagemOnboarding}
🟢 Ativo: {carteiraAtivo}
🟠 Em Cancelamento: {carteiraEmCancelamento}

📌 MRR Ativo: {mrrAtivo}
🚀 MRR Operando: {mrrOperando}

📦 Entrega Pontual: {entregaPontual}

📌 MRR Base {mesAnterior}: {mrrMesAnterior}

💡 Legenda
•  MRR Ativo: Triagem + Onboarding + Ativo.
•  MRR Operando: Todos os status, exceto Pausado e Cancelado.

━━━━━━━━━━━━━━━

📉 Churn

💰 MRR
🔴 Total: {churnTotal} ({churnTotalPct})
🟢 Ajustado: {churnAjustado} ({churnAjustadoPct})

📦 Pontual
🔴 Total: {churnPontual} ({churnPontualPct})
🟢 Ajustado: {churnPontualAjustado} ({churnPontualAjustadoPct})

━━━━━━━━━━━━━━━

🔄 Cross Sell

💰 MRR: {crossR}
📦 Pontual: {crossP}

🏆 Total: {crossTotal}

━━━━━━━━━━━━━━━

🎯 Net Churn (MRR)

🟢 Ajustado

Churn Ajustado: {churnAjustado}
➖ Cross Sell: {crossR}
🟰 {netChurn} ({netChurnPct})

🔴 Bruto

Churn Total: {churnTotal}
➖ Cross Sell: {crossR}
🟰 {netChurnBruto} ({netChurnBrutoPct})

━━━━━━━━━━━━━━━

💡 Disclaimers

•  MRR Adicionado e Pontual Vendido consideram apenas vendas novas, sem Cross Sell e Upsell.
•  Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de até 1 mês.
•  O percentual do Churn Pontual é calculado sobre o estoque pontual em aberto no início do mês ({estoquePontualInicioMes}).
•  Net Churn = Churn − Cross Sell.
•  MRR Ativo = Triagem + Onboarding + Ativo.
•  MRR Operando = Todos os status, exceto Pausado e Cancelado.

👀 Seguimos acompanhando diariamente os indicadores e atuando rapidamente sobre os principais desvios.
```

Todos os valores monetários usam `formatarMoedaBR` e todos os percentuais `formatarPercentBR`,
já existentes. O tratamento especial `"ZERO"` do Cross Sell é removido: valores zerados saem
como `R$ 0,00`.

## Fora de escopo

- Client (`AdminResumoLideres.tsx`) — renderiza `preview.mensagem` do server, não muda.
- Rotas, cron (10h/19h SP), idempotência e envio via Evolution API — inalterados.
- Régua do cross-sell no `metricsAdapter` — preservada.

## Testes

`server/services/resumoLideres.test.ts` compara o template inteiro por string; quebra por
construção e é reescrito junto. Casos a cobrir:

1. **Template completo** — mock de `MetricasResumo` com os valores do modelo de referência
   (18/07), asserção sobre a string inteira.
2. **`crossTotal` sem amortização** — `crossR = 5997`, `crossP = 10300` ⟹ `16297`.
3. **Net Churn subtrai só `crossR`** — `43314 − 5997 = 37317`, e `3,28%` sobre `1137868`.
4. **Net Churn Bruto** — `67030 − 5997 = 61033`, `5,36%`.
5. **`mrrOperando`** — soma dos quatro status, conferindo que pausado e cancelado ficam fora.
6. **Saudação por faixa horária** — 9h, 13h e 20h devolvem os três emojis corretos.
7. **Cross Sell zerado** — sai `R$ 0,00`, não `"ZERO"`.

Validação manual antes do merge: `GET /api/resumo-lideres/preview` em `/admin/resumo-lideres`,
conferindo se a carteira fecha (`Triagem/Onb + Ativo = MRR Ativo`, `MRR Ativo + Em Cancelamento
= MRR Operando`) e se os percentuais batem com a base do mês anterior.

## Riscos

- **Inversão de nomenclatura.** "MRR Ativo" muda de significado entre v2 e v3: antes era só o
  status ativo, agora é a soma dos três. Quem comparar mensagens antigas com novas vai ver o
  número "subir" sem que nada tenha acontecido. Mitigado no código pela renomeação dos campos,
  mas vale um aviso na primeira mensagem enviada no formato novo.
- **Cross Sell sem ÷5 muda o Net Churn divulgado.** Com a régua antiga o Net Churn de julho
  seria `43.314 − (5.997 + 2.060) = 35.257`; com a nova, `37.317`. A série histórica fica com
  um degrau.
- **Upsell não identificado.** Sem campo de upsell no Bitrix, vendas para clientes
  pré-existentes fora de `source = 'PARTNER'` não aparecem em nenhum dos dois blocos. O
  disclaimer cobre isso, mas o "MRR Adicionado" não é o total vendido no mês.
