# Spec — NRR Bruto (sem abonos) na mensagem dos líderes

- **Data:** 2026-07-14
- **Arquivo-alvo:** `server/services/resumoLideres.ts` (+ `server/services/resumoLideres.test.ts`)
- **Branch:** `feature/resumo-lideres-nrr-bruto`

## Contexto

A mensagem diária de métricas para o grupo dos líderes (WhatsApp via Evolution API,
`resumoLideres.ts`, modelo v2) já apresenta, no bloco de churn recorrente:

- **Churn MRR TOTAL** — `SUM(valor_r)` do mês, todos os motivos, **inclui abonados**.
- **Churn MRR Ajustado** — idem, **exclui os 3 motivos operacionais**
  (`Erro na Venda`, `Não começou`, `Inadimplente 1º Mês`), mas **ainda inclui abonados**.
- **Net Churn** = Churn Ajustado − Cross Total, com % sobre o MRR do mês anterior.

O pedido é acrescentar uma terceira régua de churn recorrente e o NRR correspondente,
usando a dimensão de **abono** (não a de motivos).

## Objetivo

Adicionar à mensagem:

1. Uma linha nova de churn recorrente: **Churn MRR bruto (sem abonos)**.
2. Um bloco de cálculo novo: **NRR Bruto** = Churn Bruto s/ abonos − Cross Total, com %.

Sem alterar nenhuma linha/bloco existente (Total, Ajustado, Net Churn permanecem iguais).

## Definição das métricas (régua confirmada)

Convenção escolhida: **perda líquida** (quanto MENOR, melhor), a mesma leitura do Net Churn atual.

| Métrica | Fórmula | Observação |
|---|---|---|
| **Churn Bruto s/ abonos** | `SUM(valor_r)` do mês onde `COALESCE(abonar_churn,'') <> 'Sim'` | **Todos os motivos** — só remove os abonados. Não toca em `motivo_cancelamento`. |
| **NRR Bruto** | Churn Bruto s/ abonos − Cross Total | Cross Total = Cross R + Cross P/5 (já existente) |
| **NRR Bruto %** | NRR Bruto ÷ MRR mês anterior × 100 | Mesma base (`mrrMesAnterior`) das demais linhas |

**Abono** = coluna `abonar_churn` em `"Clickup".cup_churn`; abonado quando `= 'Sim'`.

## Validação de dados (por que não é redundante com o Ajustado)

Rodado em `"Clickup".cup_churn` (banco local, 2026-07-14). A hipótese de que "abono" e
"3 motivos operacionais" seriam o mesmo conjunto **não se confirma**:

Matriz de contingência (histórico completo):

| | 3 motivos operacionais | outros motivos |
|---|---|---|
| **Abonado** (`abonar_churn='Sim'`) | 61 reg · R$ 84.495 | 23 reg · R$ 53.037 |
| **Não abonado** | 185 reg · R$ 228.428 | 4.163 reg · R$ 3.862.655 |

- 185 churns com os 3 motivos **não** foram abonados (R$ 228k) → o "bruto s/ abonos" mantém esses.
- 23 abonados têm outros motivos → o "ajustado" mantém esses, o "bruto s/ abonos" remove.
- Total de abonados no histórico: 84. A coluna só passou a ser preenchida de fato a partir de mar/2026.

Réguas por mês de 2026 (R$):

| Mês | Total | Ajustado (−3 mot.) | **Bruto s/ abonos** | n_abonados |
|---|---|---|---|---|
| 01 | 162.431 | 162.431 | 162.431 | 0 |
| 02 | 101.656 | 96.409 | 101.656 | 0 |
| 03 | 151.063 | 115.178 | **146.063** | 1 |
| 04 | 178.762 | 134.830 | **166.412** | 8 |
| 05 | 184.823 | 151.538 | **128.345** | 34 |
| 06 | 186.662 | 150.174 | **146.177** | 27 |
| 07* | 38.701 | 17.982 | 17.982 | 12 |

`Bruto s/ abonos` diverge do `Ajustado` na maioria dos meses (mar/abr bem maior; mai menor;
jun/jul quase coincidem). Métrica traz informação nova. (*jul parcial no banco local.)

## Mudanças na mensagem (layout)

Bloco de churn recorrente — adicionar a 3ª linha logo após o Ajustado:

```
Churn MRR TOTAL: R$ 186.662,00 - *X,XX%*
Churn MRR (sem erro de venda, não começou e inadimplente 1 mês): R$ 150.174,00 - *X,XX%*
Churn MRR bruto (sem abonos): R$ 146.177,00 - *X,XX%*        ← NOVA LINHA
```

Após o bloco do Net Churn — adicionar o bloco do NRR Bruto:

```
Net Churn = Churn Ajustado − Cross Total
= R$ 150.174,00 − R$ 1.260,00 = *R$ 148.914,00*
% = R$ 148.914,00 ÷ MRR <mês anterior> (R$ ...)
= *X,XX%*

NRR Bruto = Churn Bruto s/ abonos − Cross Total             ← BLOCO NOVO
= R$ 146.177,00 − R$ 1.260,00 = *R$ 144.917,00*
% = R$ 144.917,00 ÷ MRR <mês anterior> (R$ ...)
= *X,XX%*
```

O % do churn bruto s/ abonos usa a mesma base das demais linhas de churn recorrente
(`mrrMesAnterior`).

## Componentes técnicos

Tudo em `server/services/resumoLideres.ts`:

1. **`getChurnMes()`** — adicionar ao SELECT um terceiro agregado:
   ```sql
   COALESCE(SUM(valor_r) FILTER (WHERE COALESCE(abonar_churn,'') <> 'Sim'), 0) AS bruto_sem_abono
   ```
   Retorno passa a `{ total, ajustado, brutoSemAbono }`.

2. **`MetricasResumo`** — 4 campos novos:
   - `churnBrutoSemAbono: number`
   - `churnBrutoSemAbonoPct: number` (0-100)
   - `nrrBruto: number` (= churnBrutoSemAbono − crossTotal)
   - `nrrBrutoPct: number` (0-100)

3. **`calcularMetricasResumo()`** — computar os 4 campos:
   - `churnBrutoSemAbono = churn.brutoSemAbono`
   - `churnBrutoSemAbonoPct = (churn.brutoSemAbono / mrrMesAnterior) * 100`
   - `nrrBruto = churn.brutoSemAbono - crossTotal`
   - `nrrBrutoPct = (nrrBruto / mrrMesAnterior) * 100`

4. **`formatarMensagemResumo()`** — inserir a linha no bloco de churn e o bloco do NRR Bruto
   após o Net Churn, usando os formatadores `formatarMoedaBR` / `formatarPercentBR` já existentes.

## Testes

`server/services/resumoLideres.test.ts`:

- Completar o objeto `METRICAS` com os 4 campos novos (valores coerentes com a base do teste).
- Atualizar `MENSAGEM_ESPERADA` com a linha nova e o bloco do NRR Bruto.
- Validar (`npx tsc --noEmit` / `npm run check`) e rodar o teste (vitest) do arquivo.

## Fora de escopo

- Não alterar Churn Total, Churn Ajustado nem o Net Churn existentes.
- Não mexer na régua de churn **pontual** (só recorrente).
- Não criar nova view/tabela; usa `"Clickup".cup_churn` direto, como o código atual.
- Não alterar cadência de envio nem a interface de envio manual.

## Premissas a confirmar na implementação

- A coluna `abonar_churn` existe em `"Clickup".cup_churn` (confirmado: valores `Sim`/`Não`/`null`).
- Validar os números no **prod** antes do primeiro envio real (banco local pode estar defasado).
