# Investors Report — Regime de Caixa (2026+) com histórico em Competência

**Data:** 2026-06-17
**Status:** Aprovado (design)

## Problema

O Investors Report mostra Faturamento, Margem e Receita vs Despesas em regime de
**competência** (receita devida por `caz_receber.total` na `data_vencimento`). Os
investidores querem ver o resultado em **regime de caixa** (o que efetivamente
entrou/saiu) a partir de 2026. Dados de caixa (`caz_parcelas` por `data_quitacao`)
só existem desde set/out-2025, então o histórico pré-2026 permanece em competência,
sinalizado claramente.

## Decisões (aprovadas)

- **Corte:** `2026-01-01`. Meses `< 2026-01` = competência (fonte atual intacta);
  meses `>= 2026-01` = caixa (`caz_parcelas`).
- **Escopo:** 3 gráficos mensais (Faturamento, Margem, Receita vs Despesas) **+**
  KPIs anuais Faturamento (Ano) e Margem (Ano) recalculados em caixa (YTD 2026, que
  é 100% caixa). **Inadimplência (Ano) permanece em competência** (`caz_receber.nao_pago`)
  — conceito que não existe em caixa.
- **Fonte de caixa:** direto de `caz_parcelas` por `tipo_evento`
  (`valor_pago` por `data_quitacao`), **sem** o ajuste artificial de R$10k da DFC.
  A geração-de-caixa é alinhada à mesma base → os gráficos reconciliam por construção.

## Arquitetura

### Módulo `server/investorsReport/regime.ts` (padrão de `churn.ts`)

```ts
export const REGIME_CUTOVER = '2026-01-01'; // 1º mês em regime de caixa

export type Fonte = 'competencia' | 'caixa';

export interface MesRegime {
  mes: string;          // 'YYYY-MM'
  faturamento: number;  // competência: caz_receber.total | caixa: caz_parcelas RECEITA valor_pago
  despesas: number;     // competência: caz_pagar.pago    | caixa: caz_parcelas DESPESA valor_pago
  margem: number;       // % = (faturamento - despesas) / faturamento (0 se faturamento=0)
  fonte: Fonte;
}

export interface RegimeYTD {
  faturamentoAno: number;      // soma caixa jan..mês corrente (inclui mês parcial)
  faturamentoFechado: number;  // soma caixa jan..último mês fechado
  despesasFechado: number;     // soma caixa despesa meses fechados
  margemAno: number;           // (faturamentoFechado - despesasFechado) / faturamentoFechado
  mesesFechados: number;
}

export interface RegimeResult {
  series: MesRegime[];      // ordenado por mês asc
  ytd: RegimeYTD;
  transicaoMes: string | null; // primeiro mês 'caixa' da série (null se não há transição)
}

export async function computeRegimeHibrido(
  db: Database,
  opts?: { inicio?: string; fim?: string }
): Promise<RegimeResult>;
```

**Lógica:**
1. Query competência (meses `< REGIME_CUTOVER`): mantém exatamente as queries atuais
   (`caz_receber.total` por `data_vencimento`; `caz_pagar.pago` por data de pagamento).
2. Query caixa (meses `>= REGIME_CUTOVER`): `caz_parcelas`, `SUM(valor_pago)` agrupado por
   `TO_CHAR(data_quitacao,'YYYY-MM')`, separando `tipo_evento` RECEITA/DESPESA.
3. Merge por mês (ordenado), calcula margem por mês, tag `fonte`.
4. YTD: agrega só os meses caixa do ano corrente; margem usa apenas meses **fechados**
   (exclui o mês corrente parcial — regra atual mantida).
5. `transicaoMes` = primeiro mês com `fonte='caixa'`.

### Backend `server/routes.ts`

- `GET /api/investors-report`: substitui os blocos `faturamentoResult` e
  `faturamentoAnoResult` por uma chamada a `computeRegimeHibrido`. A resposta passa a
  incluir `fonte` em cada ponto mensal e um campo `transicaoMes`. **Inadimplência (Ano)
  permanece** com a query atual de `caz_receber.nao_pago` (competência).
- `GET /api/investors-report/geracao-caixa`: usa a mesma série caixa do módulo
  (receita/despesa por mês) para `geracaoMes = receita - despesa` e acumulado, em vez de
  `storage.getDfc()`. Elimina o ajuste artificial de R$10k.

### Frontend `client/src/pages/InvestorsReport.tsx`

- Tipo do ponto: `fonte: 'caixa' | 'emitido'` → `fonte: 'caixa' | 'competencia'`.
- `transicaoFonte` (acha o 1º `fonte==='caixa'`) — **lógica inalterada**, passa a refletir
  o corte competência→caixa.
- Rótulos: marca `'emitido → caixa'` → `'competência → caixa'`; legenda
  "Até a marca: faturamento emitido (notas) • Após: receita em caixa" →
  "Até a marca: competência (faturado) • Após: caixa (recebido)".
- Sublabels dos KPIs: Faturamento (Ano) → "recebido no ano (YTD)"; Inadimplência (Ano)
  → "competência". (Margem segue sem sublabel novo.)

## Testes — `server/investorsReport/regime.test.ts`

- Mês `2025-12` → `fonte='competencia'`; `2026-01` → `fonte='caixa'`.
- Margem calculada corretamente; `faturamento=0` ⇒ margem `0` (sem divisão por zero).
- YTD agrega só meses caixa; margem YTD exclui mês corrente parcial.
- Reconciliação: para cada mês caixa, `geracaoMes == faturamento - despesas`.

## Edge cases / riscos

- Mês corrente parcial (ex.: jun/2026) aparece na série, mas fora da margem YTD.
- Pré-2026 usa as queries atuais sem alteração → zero risco no histórico.
- Reconciliação Receita vs Despesas ↔ Geração de Caixa garantida (mesma função).
- Validável no localhost:3000 (tabelas já sincronizadas: `caz_parcelas`, `caz_receber`,
  `caz_pagar`).

## Fora de escopo

- Não alterar Inadimplência (Ano) (segue competência).
- Não migrar o histórico pré-2026 para caixa (dado não existe em `caz_parcelas`).
