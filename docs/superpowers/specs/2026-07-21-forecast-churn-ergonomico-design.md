# Forecast de Churn ergonômico — agrupado por temperatura

**Data:** 2026-07-21
**Tela:** `/detalhamento-churn` (`client/src/pages/ChurnDetalhamento.tsx`)
**Componente:** `client/src/components/churn/ChurnForecast.tsx`

## Problema

O bloco Forecast de Churn renderiza os **106 contratos** em risco numa tabela
única de 8 colunas, posicionada logo abaixo do hero de KPIs. Consequências:

1. Domina o meio da página — o usuário precisa rolar ~100 linhas para chegar ao
   Ritmo Diário e ao Churn por Dimensão.
2. A coluna **Risco** está quase toda vazia: `cortex_core.churn_risk_scores` foi
   calculada uma única vez, em **19/02/2026**. Nenhum contrato novo desde então
   tem score.
3. Ordenação só por MRR desc — um contrato de R$ 3.997 já **em negociação de
   saída** aparece abaixo de um de R$ 20.000 apenas "Requer Atenção".

Distribuição real por tier hoje (query em 21/07/2026):

| Faixa | Contratos | MRR exposto |
|---|---:|---:|
| Sem score | 68 | R$ 116.449 |
| Baixo | 21 | R$ 70.520 |
| Moderado | 17 | R$ 36.561 |
| Alto / Crítico | 0 | R$ 0 |

Por isso o eixo de agrupamento **não** pode ser o tier: 64% da exposição cairia
no balde menos acionável e nenhum grupo quente apareceria.

## Decisões

### 1. Posição — fim da página

`<ChurnForecast />` sai de `ChurnDetalhamento.tsx:437` e passa para depois de
`<ChurnHistoricoMensal />`, como último bloco de conteúdo (antes dos drawers).
Sem props novas: o componente já busca o próprio dado.

### 2. Régua de temperatura

Nova função pura `agruparPorTemperatura(contratos)` em `churnAggregations.ts`.
Cada contrato cai na **primeira** faixa que casa (ordem = urgência):

| # | Faixa | Critério | Tom |
|---|---|---|---|
| 1 | Em negociação de saída | `status_cancelamento` preenchido e ≠ `Retido` | vermelho |
| 2 | Insatisfeito | `status_conta = 'Insatisfeito'` | laranja |
| 3 | Requer atenção | `status_conta = 'Requer Atenção'` | âmbar |
| 4 | Sinal fraco | resto (só `possibilidade_retencao`, ou `Retido`) | cinza |

A faixa 1 usa **blacklist** (`≠ Retido`), não whitelist de valores conhecidos:
se o ClickUp ganhar um valor novo de `status_cancelamento`, ele entra como
quente automaticamente em vez de vazar silenciosamente para "Sinal fraco".

Valores atuais de `status_cancelamento` na base: `Não retido` (400),
`Em negociação` (25), `Aguardando contexto` (13), `Contato sem sucesso` (13),
`Recuperação (Futuro)` (3), `Retido` (1).

Dentro da faixa, contratos ordenam por MRR desc.

### 3. Layout — accordion por faixa

```
⚠ Forecast de Churn                    ⚠︎ score defasado · calculado em 19/02/26
Contratos em risco que ainda não pediram para sair · indicador antecedente
106 contratos · 72 clientes · MRR R$ 255.167 · Pontual R$ 237.476

▾ 🔴 Em negociação de saída      13 contratos    R$ 27.260   ██░░░░░░ 11%
   Cliente        Responsável     MRR      Retenção     Possib.  Risco
   Juice Protein  Julia Manhães   7.500    Não retido   Baixa      —
   ...
▸ 🟠 Insatisfeito                11 contratos    R$ 20.488   ██░░░░░░  8%
▸ 🟡 Requer atenção              76 contratos    R$168.088   ██████░░ 66%
▸ ⚪ Sinal fraco                   5 contratos    R$  6.694   ░░░░░░░░  3%
```

- Só a **faixa 1 abre por padrão**; as demais ficam fechadas. Fechado, o bloco
  ocupa ~7 linhas em vez de 106.
- Barra de participação = MRR da faixa ÷ MRR exposto total. Dá a leitura de
  concentração sem introduzir gráfico novo.
- Faixa sem contratos não é renderizada.
- Múltiplas faixas podem ficar abertas ao mesmo tempo (estado por faixa, não
  accordion exclusivo).

### 4. Tabela dentro da faixa

Colunas: Cliente · Responsável · MRR · Retenção · Possib. · Risco.
A coluna que **define** a faixa some (dentro de "Insatisfeito" não se repete
"Insatisfeito" 11 vezes na coluna Saúde). A linha expansível com
`contexto_risco` ("O que pode gerar churn") permanece igual.

Faixa com mais de **15 contratos** corta em 15 + botão "ver os outros N".

### 5. Aviso de score defasado

`riscoCalculadoEm` com mais de **30 dias** → o carimbo do canto superior direito
ganha tom âmbar e o texto "score defasado". Hoje exibiria *"⚠︎ score defasado ·
calculado em 19/02/26"*.

**Fora de escopo:** recalcular o `churnRiskEngine`. Esta mudança apenas impede
que a tela apresente um score de 5 meses atrás como se fosse fresco.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `client/src/components/churn/churnAggregations.ts` | + `FaixaTemperatura`, `agruparPorTemperatura()` |
| `client/src/components/churn/churnAggregations.test.ts` | + testes da régua (prioridade, blacklist `Retido`, faixa vazia, ordenação) |
| `client/src/components/churn/ChurnForecast.tsx` | reescrita do corpo: accordion por faixa + tabela enxuta + aviso de defasagem |
| `client/src/pages/ChurnDetalhamento.tsx` | move `<ChurnForecast />` para o fim |

## Testes

Unitários sobre `agruparPorTemperatura` (função pura, sem rede):

1. Contrato com `status_cancelamento='Não retido'` **e** `status_conta='Saudável'`
   cai na faixa 1 — a régua de cancelamento vence a de conta.
2. `status_cancelamento='Retido'` **não** cai na faixa 1; desce para a régua de
   `status_conta`.
3. Valor desconhecido de `status_cancelamento` cai na faixa 1 (blacklist).
4. Faixas sem contratos saem do resultado.
5. Dentro da faixa, ordenação por MRR desc.
6. Soma de contratos das faixas = total de entrada (nenhum contrato perdido).
