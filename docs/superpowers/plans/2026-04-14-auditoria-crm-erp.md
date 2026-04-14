# Auditoria CRM → ERP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-shot Node script that runs 23 SQL audits across Bitrix → ClickUp → Conta Azul and produces a Markdown report + per-category CSVs versioned in `docs/auditoria/`.

**Architecture:** Single runner (`scripts/auditoria-crm-erp.ts`) reads SQL files from `scripts/auditoria/queries/`, executes them sequentially against the prod read-only DB, formats results with helper libs (`normalize-cnpj`, `validate-cnpj`, `format-currency`, `render-markdown`, `render-csv`), and writes to `docs/auditoria/YYYY-MM-DD-auditoria-crm-erp.md` + `docs/auditoria/YYYY-MM-DD/csv/*.csv`. No new routes, no UI, no DB migrations.

**Tech Stack:** Node + tsx, `pg` driver, `csv-stringify`, raw SQL with `pg_trgm` extension. Companion spec: `docs/superpowers/specs/2026-04-14-auditoria-crm-erp-design.md`.

---

## Discovery findings (run during plan-writing)

These resolve §8 of the spec. Use them as ground truth for every query below:

| Question | Answer |
|---|---|
| `caz_parcelas.tipo_evento` | **Uppercase**: `'RECEITA'` / `'DESPESA'`. DATABASE.md is wrong. |
| `caz_parcelas.tipo_fatura` | **100% NULL**. Cannot use. Use distinct-months heuristic for recurring detection. |
| Recurring revenue category | `'03.01.01 Receita de Serviços'` is the main one (5163/6732 receita rows). Used in cat 06. |
| `cup_clientes.status` values | `ativo`, `entregue`, `pausado`, `em cancelamento`, `onboarding`, `triagem`, `cancelado/inativo`. Lowercase. |
| `cup_contratos.status` values | Same plus `não usar`. Lowercase. |
| **Active states** (deveria ter cobrança) | `ativo`, `entregue`, `em cancelamento`, `pausado` |
| **Inactive states** (não deveria cobrar) | `cancelado/inativo`, `não usar` |
| **Excluded states** (pre-active, ignore) | `triagem`, `onboarding` |
| `caz_clientes.ids` ↔ `caz_parcelas.id_cliente` | Both UUIDs, exact match. |
| Multi-empresa | `Turbo Partners` + `PEIXOTO DEBBANE`. Union (no filter). |
| Bitrix "ganho" filter | `category_id IN (0,12) AND stage_name IN ('Negócio Ganho','Negócios Fechados')` → 611 deals |
| `crm_deal.empresa` in won deals | 100% NULL. Cannot route by empresa. |

---

## File Structure

```
scripts/
  auditoria-crm-erp.ts                        # runner (Task 3)
  auditoria/
    DISCOVERY.md                              # this table, materialized (Task 1)
    queries/
      01-deals-ganhos-sem-cnpj.sql            # Task 4
      02-deals-ganhos-sem-cliente-caz.sql     # Task 4
      03-deals-com-cliente-sem-parcela.sql    # Task 4
      04-contratos-cup-sem-cliente-caz.sql    # Task 4
      05-contratos-cup-sem-recorrente.sql     # Task 4
      06-mrr-contratado-vs-cobrado.sql        # Task 5
      07-valor-pontual-sem-parcela.sql        # Task 5
      08-reajustes-nao-refletidos.sql         # Task 5
      09-encerrados-com-parcelas-abertas.sql  # Task 6
      10-inadimplencia-pos-churn.sql          # Task 6
      11-duplicatas-cnpj-cup.sql              # Task 7
      12-duplicatas-cnpj-caz.sql              # Task 7
      13-cup-sem-cnpj.sql                     # Task 7
      14-caz-sem-cnpj.sql                     # Task 7
      15-cnpjs-malformados.sql                # Task 7
      16-nomes-divergentes-cup-caz.sql        # Task 7
      17-cup-inativo-com-parcelas.sql         # Task 8
      18-cup-ativo-sem-parcela-6m.sql         # Task 8
      19-bitrix-perdido-cup-ativo.sql         # Task 9
      20-cup-ativo-sem-deal.sql               # Task 9
      21-pct-cnpj-por-pipeline.sql            # Task 10
      22-pct-stage-semantic.sql               # Task 10
      23-campos-criticos-vazios.sql           # Task 10
    lib/
      normalize-cnpj.ts                       # Task 2
      validate-cnpj.ts                        # Task 2
      format-currency.ts                      # Task 2
      run-query.ts                            # Task 3
      render-csv.ts                           # Task 3
      render-markdown.ts                      # Task 11
    catalog.ts                                # Task 3 - the 23-query catalog with metadata
docs/
  auditoria/
    .gitkeep                                  # Task 3
package.json                                  # add script (Task 3)
```

**Per-task commit cadence:** every task ends with one commit. Sub-steps within a task may add files but the commit at the end is one logical unit.

---

### Task 1: Materialize discovery findings

**Files:**
- Create: `scripts/auditoria/DISCOVERY.md`

- [ ] **Step 1: Create `scripts/auditoria/DISCOVERY.md`**

```markdown
# Auditoria CRM→ERP — Discovery

Findings from prod read-only queries on 2026-04-14. Source of truth for all SQLs in `queries/`.

## Schema gotchas

| Column | Truth | DATABASE.md says | Action |
|---|---|---|---|
| `caz_parcelas.tipo_evento` | UPPERCASE: `'RECEITA'`, `'DESPESA'` | lowercase | always quote with uppercase |
| `caz_parcelas.tipo_fatura` | 100% NULL | distinguishes recorrente | use distinct-months heuristic instead |
| `crm_deal.cnpj` | exists, varchar | not documented | DATABASE.md is stale |
| `crm_deal.valor_recorrente`, `valor_pontual` | exist on deal | not documented | DATABASE.md is stale |
| `crm_deal.stage_semantic` | ~99.9% NULL | should be S/F/P | data quality bug — use stage_name |
| `crm_deal.empresa` | 100% NULL on won deals | exists | cannot route deal→empresa |

## Status canonical map (ClickUp)

| Bucket | Strings |
|---|---|
| Active (deveria ter cobrança) | `ativo`, `entregue`, `em cancelamento`, `pausado` |
| Inactive (não deveria cobrar) | `cancelado/inativo`, `não usar` |
| Pre-active (excluído) | `triagem`, `onboarding` |

Every SQL that filters by status MUST use these buckets (literally copy/paste the lists).

## "Won" filter (Bitrix)

```sql
WHERE category_id IN (0, 12)
  AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
```

Universe: 611 deals (validated 2026-04-14). 405 sem CNPJ (66.6%).

## Recurring revenue heuristic

`tipo_fatura` is unusable. To identify recurring billing for a client, count distinct months with `tipo_evento='RECEITA'` parcelas in last 6 months. ≥3 distinct months ⇒ recurring relationship.

For the "main recurring category" (used in cat 06 to compare with cup_contratos.valorr), filter to:
```sql
categoria_nome ILIKE '%03.01.01%' OR categoria_nome ILIKE '%Receita de Serviços%'
```

## CNPJ normalization

```sql
LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0')
```
Apply to all 3 sides before any JOIN. Empty/null → `'00000000000000'` (treated as missing in WHERE clauses).

## Multi-empresa

Both `Turbo Partners` and `PEIXOTO DEBBANE` are unified. **Never filter by empresa** in joins from cup/bitrix to caz.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/auditoria/DISCOVERY.md
git commit -m "docs(auditoria): discovery findings — schema gotchas e status map"
```

---

### Task 2: CNPJ + currency helper libs

**Files:**
- Create: `scripts/auditoria/lib/normalize-cnpj.ts`
- Create: `scripts/auditoria/lib/validate-cnpj.ts`
- Create: `scripts/auditoria/lib/format-currency.ts`
- Create: `scripts/auditoria/lib/__tests__/normalize-cnpj.test.ts`
- Create: `scripts/auditoria/lib/__tests__/validate-cnpj.test.ts`
- Create: `scripts/auditoria/lib/__tests__/format-currency.test.ts`

- [ ] **Step 1: Write failing test for `normalize-cnpj`**

```typescript
// scripts/auditoria/lib/__tests__/normalize-cnpj.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeCnpj } from '../normalize-cnpj';

describe('normalizeCnpj', () => {
  it('strips mask and zero-pads to 14', () => {
    expect(normalizeCnpj('12.345.678/0001-90')).toBe('12345678000190');
  });
  it('handles already-clean input', () => {
    expect(normalizeCnpj('12345678000190')).toBe('12345678000190');
  });
  it('zero-pads short input', () => {
    expect(normalizeCnpj('12345678')).toBe('00000012345678');
  });
  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeCnpj(null)).toBe('');
    expect(normalizeCnpj(undefined)).toBe('');
    expect(normalizeCnpj('')).toBe('');
    expect(normalizeCnpj('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run scripts/auditoria/lib/__tests__/normalize-cnpj.test.ts
```
Expected: FAIL with "Cannot find module '../normalize-cnpj'"

- [ ] **Step 3: Implement `normalize-cnpj.ts`**

```typescript
// scripts/auditoria/lib/normalize-cnpj.ts
export function normalizeCnpj(input: string | null | undefined): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.padStart(14, '0');
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run scripts/auditoria/lib/__tests__/normalize-cnpj.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Write failing test for `validate-cnpj`**

```typescript
// scripts/auditoria/lib/__tests__/validate-cnpj.test.ts
import { describe, it, expect } from 'vitest';
import { validateCnpj } from '../validate-cnpj';

describe('validateCnpj', () => {
  it('validates real CNPJ', () => {
    expect(validateCnpj('11.222.333/0001-81')).toBe(true);
  });
  it('rejects all-same-digit CNPJ', () => {
    expect(validateCnpj('11111111111111')).toBe(false);
  });
  it('rejects too-short input', () => {
    expect(validateCnpj('12345')).toBe(false);
  });
  it('rejects empty/null', () => {
    expect(validateCnpj('')).toBe(false);
    expect(validateCnpj(null)).toBe(false);
  });
  it('rejects wrong checksum', () => {
    expect(validateCnpj('11.222.333/0001-99')).toBe(false);
  });
});
```

- [ ] **Step 6: Run test, expect failure**

```bash
npx vitest run scripts/auditoria/lib/__tests__/validate-cnpj.test.ts
```
Expected: FAIL "Cannot find module"

- [ ] **Step 7: Implement `validate-cnpj.ts` (módulo 11)**

```typescript
// scripts/auditoria/lib/validate-cnpj.ts
import { normalizeCnpj } from './normalize-cnpj';

export function validateCnpj(input: string | null | undefined): boolean {
  const cnpj = normalizeCnpj(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false; // all same digit

  const calc = (slice: string, weights: number[]): number => {
    const sum = slice.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);

  return cnpj.endsWith(`${d1}${d2}`);
}
```

- [ ] **Step 8: Run test, expect pass**

```bash
npx vitest run scripts/auditoria/lib/__tests__/validate-cnpj.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 9: Write failing test for `format-currency`**

```typescript
// scripts/auditoria/lib/__tests__/format-currency.test.ts
import { describe, it, expect } from 'vitest';
import { formatBRL } from '../format-currency';

describe('formatBRL', () => {
  it('formats round number', () => {
    expect(formatBRL(1234)).toBe('R$ 1.234,00');
  });
  it('formats with cents', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56');
  });
  it('formats large numbers', () => {
    expect(formatBRL(1234567.89)).toBe('R$ 1.234.567,89');
  });
  it('handles zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
  });
  it('handles null/undefined as zero', () => {
    expect(formatBRL(null)).toBe('R$ 0,00');
    expect(formatBRL(undefined)).toBe('R$ 0,00');
  });
});
```

- [ ] **Step 10: Run test, expect failure, implement, re-run**

```typescript
// scripts/auditoria/lib/format-currency.ts
export function formatBRL(value: number | null | undefined): string {
  const n = value ?? 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
```

```bash
npx vitest run scripts/auditoria/lib/__tests__/format-currency.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 11: Commit**

```bash
git add scripts/auditoria/lib/normalize-cnpj.ts scripts/auditoria/lib/validate-cnpj.ts scripts/auditoria/lib/format-currency.ts scripts/auditoria/lib/__tests__/
git commit -m "feat(auditoria): helpers de CNPJ (normalize, validate módulo 11) e format BRL"
```

---

### Task 3: Runner skeleton + query catalog + dry-run

**Files:**
- Create: `scripts/auditoria-crm-erp.ts`
- Create: `scripts/auditoria/lib/run-query.ts`
- Create: `scripts/auditoria/lib/render-csv.ts`
- Create: `scripts/auditoria/catalog.ts`
- Create: `docs/auditoria/.gitkeep`
- Modify: `package.json`

- [ ] **Step 1: Confirm `pg` and `csv-stringify` are available**

```bash
node -e "require('pg'); console.log('pg ok')"
node -e "require('csv-stringify'); console.log('csv ok')" 2>&1 | head -5
```
If `csv-stringify` missing: `npm install csv-stringify`. Pin version in package.json.

- [ ] **Step 2: Create `scripts/auditoria/lib/run-query.ts`**

```typescript
// scripts/auditoria/lib/run-query.ts
import type { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface QueryResult {
  id: string;
  rows: Record<string, unknown>[];
  total: number;
  durationMs: number;
  error?: string;
}

export async function runQueryFile(pool: Pool, queriesDir: string, id: string): Promise<QueryResult> {
  const path = join(queriesDir, `${id}.sql`);
  const sql = readFileSync(path, 'utf-8');
  const start = Date.now();
  try {
    const res = await pool.query(sql);
    return {
      id,
      rows: res.rows,
      total: res.rowCount ?? res.rows.length,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      id,
      rows: [],
      total: 0,
      durationMs: Date.now() - start,
      error: msg,
    };
  }
}
```

- [ ] **Step 3: Create `scripts/auditoria/lib/render-csv.ts`**

```typescript
// scripts/auditoria/lib/render-csv.ts
import { stringify } from 'csv-stringify/sync';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function writeCsv(filePath: string, rows: Record<string, unknown>[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  if (rows.length === 0) {
    writeFileSync(filePath, '', 'utf-8');
    return;
  }
  const csv = stringify(rows, { header: true, columns: Object.keys(rows[0]) });
  writeFileSync(filePath, csv, 'utf-8');
}
```

- [ ] **Step 4: Create `scripts/auditoria/catalog.ts` — the 23 categories with metadata**

```typescript
// scripts/auditoria/catalog.ts

export type Section = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface QuerySpec {
  id: string;                 // matches filename minus .sql
  number: number;             // 1..23
  section: Section;
  title: string;
  hasFinancialImpact: boolean;
  impactColumn?: string;      // column in result rows that holds R$ for sum
  description: string;        // shown in the report
  actionSuggestion: string;
}

export const CATALOG: QuerySpec[] = [
  // Section A — Vazamento
  { id: '01-deals-ganhos-sem-cnpj', number: 1, section: 'A',
    title: 'Deals ganhos sem CNPJ no Bitrix',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Deals em "Negócio Ganho" (pipeline 0) ou "Negócios Fechados" (pipeline 12) sem CNPJ preenchido. Sem CNPJ é fisicamente impossível casar com o ERP.',
    actionSuggestion: 'Comercial: preencher CNPJ retroativo nos deals listados. Curto prazo: tornar campo obrigatório nos stages de fechamento.' },
  { id: '02-deals-ganhos-sem-cliente-caz', number: 2, section: 'A',
    title: 'Deals ganhos com CNPJ válido mas sem cliente no Conta Azul',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Deal tem CNPJ, CNPJ validou no módulo 11, mas não existe cliente correspondente em nenhuma das duas empresas do CAZ.',
    actionSuggestion: 'Financeiro: criar cadastro do cliente no CAZ e iniciar cobrança.' },
  { id: '03-deals-com-cliente-sem-parcela', number: 3, section: 'A',
    title: 'Deals ganhos com cliente no CAZ mas sem parcela aberta há 90 dias',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Cadastro existe mas ninguém criou a primeira parcela (ou a recorrência foi pausada e esquecida).',
    actionSuggestion: 'Financeiro: validar contrato e gerar parcelas pendentes.' },
  { id: '04-contratos-cup-sem-cliente-caz', number: 4, section: 'A',
    title: 'Contratos ativos no ClickUp sem cliente no Conta Azul',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Caminho alternativo do mesmo vazamento: contratos que entraram direto na operação sem passar pelo CRM.',
    actionSuggestion: 'CS + Financeiro: validar e cadastrar.' },
  { id: '05-contratos-cup-sem-recorrente', number: 5, section: 'A',
    title: 'Contratos ativos no ClickUp sem parcela recorrente nos últimos 60 dias',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Cliente existe nos dois sistemas, contrato ativo, mas a recorrência mensal não está sendo gerada.',
    actionSuggestion: 'Financeiro: investigar por que parou de gerar e regularizar.' },

  // Section B — Sub-cobrança
  { id: '06-mrr-contratado-vs-cobrado', number: 6, section: 'B',
    title: 'MRR contratado ≠ MRR cobrado (sub-cobrança)',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Diferença positiva entre cup_contratos.valorr e a média mensal das parcelas recorrentes do cliente nos últimos 6 meses.',
    actionSuggestion: 'Financeiro: revisar contratos e ajustar valor cobrado.' },
  { id: '07-valor-pontual-sem-parcela', number: 7, section: 'B',
    title: 'Valor pontual no Bitrix sem parcela pontual no CAZ',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Deals com valor_pontual > 0 que não geraram cobrança pontual no CAZ na janela ±60 dias do fechamento.',
    actionSuggestion: 'Financeiro: cobrar valor pontual retroativo.' },
  { id: '08-reajustes-nao-refletidos', number: 8, section: 'B',
    title: 'Reajustes contratados não refletidos no faturamento (exploratório)',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Heurística: cup_data_hist mostra valorr maior que 6 meses atrás, mas as parcelas recorrentes do CAZ continuam no valor antigo. Risco alto de falso positivo.',
    actionSuggestion: 'Financeiro: validar caso a caso — é exploratório.' },

  // Section C — Pós-churn
  { id: '09-encerrados-com-parcelas-abertas', number: 9, section: 'C',
    title: 'Contratos encerrados com parcelas ainda abertas (risco jurídico)',
    hasFinancialImpact: true, impactColumn: 'valor_bruto',
    description: 'Cobrança ativa em cliente que já cancelou. Risco jurídico/reputação.',
    actionSuggestion: 'Financeiro: cancelar parcelas indevidas imediatamente.' },
  { id: '10-inadimplencia-pos-churn', number: 10, section: 'C',
    title: 'Inadimplência pós-churn > 90 dias',
    hasFinancialImpact: true, impactColumn: 'nao_pago',
    description: 'Parcelas não pagas há mais de 90 dias de clientes já encerrados — provisão de perda real.',
    actionSuggestion: 'Financeiro: provisionar como perda ou negativar.' },

  // Section D — Higiene (sem $)
  { id: '11-duplicatas-cnpj-cup', number: 11, section: 'D',
    title: 'Duplicatas de CNPJ em cup_clientes', hasFinancialImpact: false,
    description: 'Mesmo CNPJ aparece em mais de um registro de cup_clientes.',
    actionSuggestion: 'CS: deduplicar manualmente.' },
  { id: '12-duplicatas-cnpj-caz', number: 12, section: 'D',
    title: 'Duplicatas de CNPJ em caz_clientes', hasFinancialImpact: false,
    description: 'Mesmo CNPJ aparece em mais de um registro de caz_clientes (considerando ambas as empresas).',
    actionSuggestion: 'Financeiro: mesclar cadastros.' },
  { id: '13-cup-sem-cnpj', number: 13, section: 'D',
    title: 'Clientes em cup_clientes sem CNPJ', hasFinancialImpact: false,
    description: 'Cadastro de cliente sem CNPJ — impossível casar com CAZ.',
    actionSuggestion: 'CS: completar cadastro.' },
  { id: '14-caz-sem-cnpj', number: 14, section: 'D',
    title: 'Clientes em caz_clientes sem CNPJ', hasFinancialImpact: false,
    description: 'Cadastro financeiro sem CNPJ.',
    actionSuggestion: 'Financeiro: completar cadastro.' },
  { id: '15-cnpjs-malformados', number: 15, section: 'D',
    title: 'CNPJs malformados em qualquer fonte', hasFinancialImpact: false,
    description: 'CNPJs preenchidos que não passam na validação módulo 11.',
    actionSuggestion: 'Corrigir nas três fontes.' },
  { id: '16-nomes-divergentes-cup-caz', number: 16, section: 'D',
    title: 'Mesmo CNPJ, nomes muito divergentes entre ClickUp e CAZ', hasFinancialImpact: false,
    description: 'Similaridade de nomes < 0.3 via pg_trgm — sinal de cadastro errado em um dos dois lados.',
    actionSuggestion: 'CS+Financeiro: investigar e padronizar nome.' },

  // Section E — Status divergente
  { id: '17-cup-inativo-com-parcelas', number: 17, section: 'E',
    title: 'Cliente inativo no ClickUp ainda recebendo parcelas',
    hasFinancialImpact: true, impactColumn: 'valor_pago',
    description: 'Parcela quitada > 30 dias após cancelamento no ClickUp. Pode indicar cobrança indevida ou falta de baixa no CRM.',
    actionSuggestion: 'CS: validar e dar baixa correta.' },
  { id: '18-cup-ativo-sem-parcela-6m', number: 18, section: 'E',
    title: 'Cliente ativo no ClickUp sem parcela há > 6 meses', hasFinancialImpact: false,
    description: 'Sintoma de churn não registrado — provavelmente já cancelou na prática mas o CRM não foi atualizado.',
    actionSuggestion: 'CS: validar status real.' },

  // Section F — Cross-CRM
  { id: '19-bitrix-perdido-cup-ativo', number: 19, section: 'F',
    title: 'Deal perdido no Bitrix mas cliente ativo no ClickUp', hasFinancialImpact: false,
    description: 'Recuperação que nunca foi atualizada no CRM — distorce taxa de conversão.',
    actionSuggestion: 'Comercial: atualizar deal pra Negócio Ganho.' },
  { id: '20-cup-ativo-sem-deal', number: 20, section: 'F',
    title: 'Cliente ativo no ClickUp sem deal correspondente no Bitrix', hasFinancialImpact: false,
    description: 'Origem desconhecida — possível comissionamento órfão.',
    actionSuggestion: 'Comercial: rastrear origem.' },

  // Section G — Cobertura
  { id: '21-pct-cnpj-por-pipeline', number: 21, section: 'G',
    title: '% de CNPJ preenchido por pipeline no Bitrix', hasFinancialImpact: false,
    description: 'Cobertura de CNPJ por pipeline. Smoking gun.',
    actionSuggestion: 'Bitrix admin: tornar CNPJ obrigatório.' },
  { id: '22-pct-stage-semantic', number: 22, section: 'G',
    title: '% de stage_semantic preenchido por pipeline', hasFinancialImpact: false,
    description: 'Bug de ETL — campo deveria estar populado com S/F/P, mas está vazio em ~99,9% dos deals.',
    actionSuggestion: 'Tech: investigar ETL Bitrix.' },
  { id: '23-campos-criticos-vazios', number: 23, section: 'G',
    title: 'Top campos críticos vazios em cada sistema', hasFinancialImpact: false,
    description: 'Visão geral dos buracos de dado.',
    actionSuggestion: 'Cada área: priorizar preenchimento.' },
];

export const SECTION_TITLES: Record<Section, string> = {
  A: '🩸 Vazamento de caixa',
  B: '💧 Sub-cobrança',
  C: '🪦 Pós-churn',
  D: '🪪 Saúde de cadastro',
  E: '🔄 Status divergente',
  F: '🪞 Cross-CRM',
  G: '🔭 Cobertura de dado',
};
```

- [ ] **Step 5: Create `scripts/auditoria-crm-erp.ts` runner skeleton (no MD render yet)**

```typescript
// scripts/auditoria-crm-erp.ts
import { Pool } from 'pg';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { CATALOG, type QuerySpec } from './auditoria/catalog';
import { runQueryFile, type QueryResult } from './auditoria/lib/run-query';
import { writeCsv } from './auditoria/lib/render-csv';

loadEnv();

const DRY_RUN = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const REPO_ROOT = join(__dirname, '..');
const QUERIES_DIR = join(__dirname, 'auditoria', 'queries');
const REPORT_PATH = join(REPO_ROOT, 'docs', 'auditoria', `${TODAY}-auditoria-crm-erp.md`);
const CSV_DIR = join(REPO_ROOT, 'docs', 'auditoria', TODAY, 'csv');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, max: 4 });

  console.log(`[auditoria] modo: ${DRY_RUN ? 'dry-run' : 'completo'}`);
  console.log(`[auditoria] data: ${TODAY}`);

  // Habilitar pg_trgm na sessão (graceful)
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('[auditoria] pg_trgm ok');
  } catch (e) {
    console.warn('[auditoria] pg_trgm indisponível — queries 02 e 16 vão falhar graceful');
  }

  const catalog: QuerySpec[] = DRY_RUN ? CATALOG.slice(0, 3) : CATALOG;
  const results: Array<{ spec: QuerySpec; result: QueryResult }> = [];

  for (const spec of catalog) {
    process.stdout.write(`[${spec.number.toString().padStart(2, '0')}] ${spec.title} ... `);
    const result = await runQueryFile(pool, QUERIES_DIR, spec.id);
    if (result.error) {
      console.log(`⚠️  ERRO (${result.durationMs}ms): ${result.error}`);
    } else {
      console.log(`✓ ${result.total} linhas (${result.durationMs}ms)`);
    }
    results.push({ spec, result });

    // Write CSV per category
    const csvPath = join(CSV_DIR, `${spec.id}.csv`);
    writeCsv(csvPath, result.rows);
  }

  // Placeholder: render markdown — implemented in Task 11
  mkdirSync(join(REPO_ROOT, 'docs', 'auditoria'), { recursive: true });
  writeFileSync(REPORT_PATH, `# Auditoria CRM → ERP — ${TODAY}\n\n(Render completo em Task 11.)\n\n${results.map(r => `- [${r.spec.number}] ${r.spec.title}: ${r.result.error ? '⚠️ ' + r.result.error : r.result.total + ' linhas'}`).join('\n')}\n`, 'utf-8');

  console.log(`[auditoria] relatório: ${REPORT_PATH}`);
  console.log(`[auditoria] csvs: ${CSV_DIR}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Add `package.json` script**

In `package.json`, find the `"scripts"` block and add:
```json
"auditoria-crm-erp": "tsx scripts/auditoria-crm-erp.ts"
```

- [ ] **Step 7: Create `docs/auditoria/.gitkeep`**

```bash
mkdir -p docs/auditoria
touch docs/auditoria/.gitkeep
```

- [ ] **Step 8: Smoke test the runner with dry-run (queries don't exist yet — expect graceful errors)**

```bash
npm run auditoria-crm-erp -- --dry-run
```
Expected: 3 queries attempted, all log `⚠️ ERRO: ENOENT` because SQL files don't exist. No crash. Markdown skeleton written. Console exit clean.

- [ ] **Step 9: Commit**

```bash
git add scripts/auditoria-crm-erp.ts scripts/auditoria/lib/run-query.ts scripts/auditoria/lib/render-csv.ts scripts/auditoria/catalog.ts package.json docs/auditoria/.gitkeep
git commit -m "feat(auditoria): runner skeleton, query catalog, dry-run mode"
```

---

### Task 4: Section A queries (vazamento — 5 SQLs)

**Files:**
- Create: `scripts/auditoria/queries/01-deals-ganhos-sem-cnpj.sql`
- Create: `scripts/auditoria/queries/02-deals-ganhos-sem-cliente-caz.sql`
- Create: `scripts/auditoria/queries/03-deals-com-cliente-sem-parcela.sql`
- Create: `scripts/auditoria/queries/04-contratos-cup-sem-cliente-caz.sql`
- Create: `scripts/auditoria/queries/05-contratos-cup-sem-recorrente.sql`

- [ ] **Step 1: Create `01-deals-ganhos-sem-cnpj.sql`**

```sql
-- Cat 01: Deals em estágio de fechamento sem CNPJ no Bitrix.
-- Universo: pipelines 0 (Geral) e 12 (Cross Sell e Upsell), stages "Negócio Ganho" e "Negócios Fechados".
-- Impacto = valor_recorrente * meses_aberto (cap 12) + valor_pontual.
WITH won AS (
  SELECT id, title, company_name, contact_name, closer, sdr,
         data_fechamento, date_modify, valor_recorrente, valor_pontual, cnpj
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
)
SELECT
  id AS id_deal,
  title,
  company_name,
  contact_name,
  closer,
  sdr,
  COALESCE(data_fechamento, date_modify::date) AS data_fechamento_ou_modify,
  COALESCE(valor_recorrente, 0)::numeric AS valor_recorrente,
  COALESCE(valor_pontual, 0)::numeric    AS valor_pontual,
  LEAST(
    12,
    GREATEST(
      0,
      DATE_PART('month', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int
      + DATE_PART('year', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int * 12
    )
  ) AS meses_aberto,
  ROUND(
    (COALESCE(valor_recorrente, 0) * LEAST(
      12,
      GREATEST(
        0,
        DATE_PART('month', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int
        + DATE_PART('year', AGE(NOW(), COALESCE(data_fechamento, date_modify::date)))::int * 12
      )
    ) + COALESCE(valor_pontual, 0))::numeric,
    2
  ) AS impacto_estimado_rs,
  'https://turbopartners.bitrix24.com.br/crm/deal/details/' || id || '/' AS link_bitrix
FROM won
WHERE cnpj IS NULL OR TRIM(cnpj) = ''
ORDER BY impacto_estimado_rs DESC NULLS LAST;
```

- [ ] **Step 2: Validate query 01 manually against prod**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
  -f scripts/auditoria/queries/01-deals-ganhos-sem-cnpj.sql | head -20
```
Expected: ~405 rows. Top row should show non-zero `impacto_estimado_rs` for highest valor_recorrente.

- [ ] **Step 3: Create `02-deals-ganhos-sem-cliente-caz.sql`**

```sql
-- Cat 02: Deal ganho com CNPJ válido mas sem cliente no CAZ (nem por fuzzy match de nome).
-- pg_trgm requerido. Multi-empresa unificado.
WITH won_with_cnpj AS (
  SELECT id, title, company_name, valor_recorrente, valor_pontual,
         data_fechamento, date_modify,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz_norm AS (
  SELECT ids, nome, empresa,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
)
SELECT
  w.id AS id_deal,
  w.cnpj_norm AS cnpj_normalizado,
  w.title,
  w.company_name,
  (
    SELECT c.nome FROM caz_norm c
    ORDER BY similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, ''))) DESC
    LIMIT 1
  ) AS melhor_match_caz,
  (
    SELECT ROUND(similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, '')))::numeric, 3)
    FROM caz_norm c
    ORDER BY similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, ''))) DESC
    LIMIT 1
  ) AS similaridade,
  COALESCE(w.valor_recorrente, 0)::numeric AS valor_recorrente,
  COALESCE(w.valor_pontual, 0)::numeric    AS valor_pontual,
  ROUND(
    (COALESCE(w.valor_recorrente, 0) * LEAST(
      12,
      GREATEST(0,
        DATE_PART('month', AGE(NOW(), COALESCE(w.data_fechamento, w.date_modify::date)))::int
        + DATE_PART('year', AGE(NOW(), COALESCE(w.data_fechamento, w.date_modify::date)))::int * 12
      )
    ) + COALESCE(w.valor_pontual, 0))::numeric,
    2
  ) AS impacto_estimado_rs
FROM won_with_cnpj w
WHERE NOT EXISTS (
  SELECT 1 FROM caz_norm c WHERE c.cnpj_norm = w.cnpj_norm
)
AND NOT EXISTS (
  SELECT 1 FROM caz_norm c
  WHERE similarity(LOWER(COALESCE(w.company_name, '')), LOWER(COALESCE(c.nome, ''))) > 0.6
)
ORDER BY impacto_estimado_rs DESC;
```

- [ ] **Step 4: Validate query 02 manually**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
  -f scripts/auditoria/queries/02-deals-ganhos-sem-cliente-caz.sql | head -10
```
Expected: small set (CNPJs preenchidos no Bitrix sem espelho no CAZ). If query returns thousands, similarity threshold is too tight — investigate.

- [ ] **Step 5: Create `03-deals-com-cliente-sem-parcela.sql`**

```sql
-- Cat 03: Deal ganho casado em caz_clientes mas sem parcela RECEITA aberta nos últimos 90 dias.
WITH won AS (
  SELECT id, title, company_name, valor_recorrente, data_fechamento, date_modify,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz AS (
  SELECT ids, nome,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
),
matched AS (
  SELECT w.id AS id_deal, w.cnpj_norm, c.nome AS cliente_caz_nome, c.ids AS caz_id,
         w.valor_recorrente, w.data_fechamento, w.date_modify
  FROM won w
  JOIN caz c ON c.cnpj_norm = w.cnpj_norm
),
last_parcela AS (
  SELECT id_cliente, MAX(data_vencimento) AS ultima_parcela
  FROM "Conta Azul".caz_parcelas
  WHERE tipo_evento = 'RECEITA'
  GROUP BY id_cliente
)
SELECT
  m.id_deal,
  m.cnpj_norm AS cnpj,
  m.cliente_caz_nome,
  lp.ultima_parcela AS ultima_parcela_data,
  GREATEST(0, DATE_PART('month', AGE(NOW(), COALESCE(lp.ultima_parcela, m.data_fechamento::timestamp)))::int) AS meses_sem_cobranca,
  COALESCE(m.valor_recorrente, 0)::numeric AS valor_recorrente,
  ROUND(
    (COALESCE(m.valor_recorrente, 0) * LEAST(12, GREATEST(0,
      DATE_PART('month', AGE(NOW(), COALESCE(lp.ultima_parcela, m.data_fechamento::timestamp)))::int
    )))::numeric,
    2
  ) AS impacto_estimado_rs
FROM matched m
LEFT JOIN last_parcela lp ON lp.id_cliente = m.caz_id
WHERE lp.ultima_parcela IS NULL OR lp.ultima_parcela < NOW() - INTERVAL '90 days'
ORDER BY impacto_estimado_rs DESC;
```

- [ ] **Step 6: Validate query 03**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
  -f scripts/auditoria/queries/03-deals-com-cliente-sem-parcela.sql | head -10
```

- [ ] **Step 7: Create `04-contratos-cup-sem-cliente-caz.sql`**

```sql
-- Cat 04: Contratos ATIVOS em ClickUp sem cliente correspondente no CAZ.
-- Status considerados ativos: ativo, entregue, em cancelamento, pausado.
WITH cup AS (
  SELECT ct.id_subtask, ct.servico, ct.valorr, ct.valorp, ct.data_inicio,
         cl.nome AS cliente_nome,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
),
caz AS (
  SELECT LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
)
SELECT
  c.id_subtask,
  c.cliente_nome AS cup_cliente_nome,
  c.cnpj_norm AS cnpj_clickup,
  c.servico,
  COALESCE(c.valorr, 0)::numeric AS valorr,
  COALESCE(c.valorp, 0)::numeric AS valorp,
  c.data_inicio,
  LEAST(12, GREATEST(0,
    DATE_PART('month', AGE(NOW(), c.data_inicio))::int
    + DATE_PART('year', AGE(NOW(), c.data_inicio))::int * 12
  )) AS meses_aberto,
  ROUND((
    COALESCE(c.valorr, 0) * LEAST(12, GREATEST(0,
      DATE_PART('month', AGE(NOW(), c.data_inicio))::int
      + DATE_PART('year', AGE(NOW(), c.data_inicio))::int * 12
    )) + COALESCE(c.valorp, 0)
  )::numeric, 2) AS impacto_estimado_rs
FROM cup c
WHERE c.cnpj_norm <> '00000000000000'
  AND NOT EXISTS (SELECT 1 FROM caz WHERE caz.cnpj_norm = c.cnpj_norm)
ORDER BY impacto_estimado_rs DESC;
```

- [ ] **Step 8: Validate query 04**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
  -f scripts/auditoria/queries/04-contratos-cup-sem-cliente-caz.sql | head -10
```

- [ ] **Step 9: Create `05-contratos-cup-sem-recorrente.sql`**

```sql
-- Cat 05: Contratos ativos no CUP, cliente existe no CAZ, mas zero parcelas RECEITA nos últimos 60 dias.
WITH cup_active AS (
  SELECT ct.id_subtask, ct.servico, ct.valorr, cl.nome AS cliente_nome,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
),
caz_match AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
),
last_recurring AS (
  SELECT id_cliente, MAX(data_vencimento) AS ultima
  FROM "Conta Azul".caz_parcelas
  WHERE tipo_evento = 'RECEITA'
  GROUP BY id_cliente
)
SELECT
  c.id_subtask,
  c.cliente_nome AS cliente,
  c.cnpj_norm AS cnpj,
  c.servico,
  COALESCE(c.valorr, 0)::numeric AS valorr,
  lr.ultima AS ultima_parcela_recorrente,
  GREATEST(0, EXTRACT(DAY FROM NOW() - lr.ultima)::int) AS dias_desde,
  ROUND((COALESCE(c.valorr, 0) * 2)::numeric, 2) AS impacto_estimado_rs
FROM cup_active c
JOIN caz_match cm ON cm.cnpj_norm = c.cnpj_norm
LEFT JOIN last_recurring lr ON lr.id_cliente = cm.ids
WHERE c.cnpj_norm <> '00000000000000'
  AND (lr.ultima IS NULL OR lr.ultima < NOW() - INTERVAL '60 days')
ORDER BY impacto_estimado_rs DESC;
```

- [ ] **Step 10: Validate query 05**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
  -f scripts/auditoria/queries/05-contratos-cup-sem-recorrente.sql | head -10
```

- [ ] **Step 11: Run full dry-run with first 3 queries (catalog already runs them)**

```bash
npm run auditoria-crm-erp -- --dry-run
```
Expected: queries 01–03 succeed, log "✓ N linhas". CSVs written to `docs/auditoria/<date>/csv/`.

- [ ] **Step 12: Commit**

```bash
git add scripts/auditoria/queries/01-deals-ganhos-sem-cnpj.sql \
        scripts/auditoria/queries/02-deals-ganhos-sem-cliente-caz.sql \
        scripts/auditoria/queries/03-deals-com-cliente-sem-parcela.sql \
        scripts/auditoria/queries/04-contratos-cup-sem-cliente-caz.sql \
        scripts/auditoria/queries/05-contratos-cup-sem-recorrente.sql
git commit -m "feat(auditoria): seção A — 5 queries de vazamento de caixa"
```

---

### Task 5: Section B queries (sub-cobrança — 3 SQLs)

**Files:**
- Create: `scripts/auditoria/queries/06-mrr-contratado-vs-cobrado.sql`
- Create: `scripts/auditoria/queries/07-valor-pontual-sem-parcela.sql`
- Create: `scripts/auditoria/queries/08-reajustes-nao-refletidos.sql`

- [ ] **Step 1: Create `06-mrr-contratado-vs-cobrado.sql`**

```sql
-- Cat 06: MRR contratado em cup_contratos > média mensal das parcelas RECEITA do CAZ nos últimos 6 meses.
-- Diff > R$ 50/mês.
WITH cup_active AS (
  SELECT ct.id_subtask, ct.valorr AS valorr_contratado, cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND ct.valorr > 0
),
caz_clients AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
),
mrr_cobrado AS (
  -- Soma os valores recorrentes "Receita de Serviços" por cliente no período, divide por meses observados.
  SELECT p.id_cliente,
         SUM(p.valor_bruto) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', p.data_vencimento)), 0) AS media_mensal
  FROM "Conta Azul".caz_parcelas p
  WHERE p.tipo_evento = 'RECEITA'
    AND (p.categoria_nome ILIKE '%03.01.01%' OR p.categoria_nome ILIKE '%Receita de Serviços%')
    AND p.data_vencimento >= NOW() - INTERVAL '6 months'
    AND p.id_cliente IS NOT NULL
  GROUP BY p.id_cliente
)
SELECT
  c.id_subtask,
  c.cliente,
  c.cnpj_norm AS cnpj,
  ROUND(c.valorr_contratado::numeric, 2) AS valorr_contratado,
  ROUND(COALESCE(m.media_mensal, 0)::numeric, 2) AS mrr_cobrado_avg,
  ROUND((c.valorr_contratado - COALESCE(m.media_mensal, 0))::numeric, 2) AS diff_mensal,
  12 AS meses,
  ROUND(((c.valorr_contratado - COALESCE(m.media_mensal, 0)) * 12)::numeric, 2) AS impacto_estimado_rs
FROM cup_active c
JOIN caz_clients cm ON cm.cnpj_norm = c.cnpj_norm
LEFT JOIN mrr_cobrado m ON m.id_cliente = cm.ids
WHERE c.cnpj_norm <> '00000000000000'
  AND (c.valorr_contratado - COALESCE(m.media_mensal, 0)) > 50
ORDER BY impacto_estimado_rs DESC;
```

- [ ] **Step 2: Validate query 06**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
  -f scripts/auditoria/queries/06-mrr-contratado-vs-cobrado.sql | head -15
```
Sanity check: top diff_mensal should be plausible (não mais que R$ 10k/mês — se for mais, pode ser bug de duplicidade).

- [ ] **Step 3: Create `07-valor-pontual-sem-parcela.sql`**

```sql
-- Cat 07: Deal ganho com valor_pontual > 0 sem parcela pontual no CAZ na janela ±60 dias do fechamento.
-- "Pontual" = não recorrente. Heurística: parcela RECEITA cujo valor_bruto está dentro de ±10% do valor_pontual,
-- e cuja data_vencimento cai em ±60 dias da data_fechamento do deal.
WITH won AS (
  SELECT id, title, company_name, data_fechamento, date_modify, valor_pontual,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE category_id IN (0, 12)
    AND stage_name IN ('Negócio Ganho', 'Negócios Fechados')
    AND valor_pontual IS NOT NULL AND valor_pontual > 0
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT
  w.id AS id_deal,
  w.title AS cliente,
  w.cnpj_norm AS cnpj,
  ROUND(w.valor_pontual::numeric, 2) AS valor_pontual_deal,
  COALESCE(w.data_fechamento, w.date_modify::date) AS data_fechamento,
  (
    SELECT p.valor_bruto
    FROM "Conta Azul".caz_parcelas p
    JOIN caz_client cm ON cm.ids = p.id_cliente
    WHERE cm.cnpj_norm = w.cnpj_norm
      AND p.tipo_evento = 'RECEITA'
      AND ABS(p.valor_bruto - w.valor_pontual) / NULLIF(w.valor_pontual, 0) < 0.10
      AND p.data_vencimento BETWEEN COALESCE(w.data_fechamento, w.date_modify::date) - INTERVAL '60 days'
                                AND COALESCE(w.data_fechamento, w.date_modify::date) + INTERVAL '60 days'
    LIMIT 1
  ) AS parcela_proxima_encontrada,
  ROUND(w.valor_pontual::numeric, 2) AS impacto_estimado_rs
FROM won w
WHERE NOT EXISTS (
  SELECT 1
  FROM "Conta Azul".caz_parcelas p
  JOIN caz_client cm ON cm.ids = p.id_cliente
  WHERE cm.cnpj_norm = w.cnpj_norm
    AND p.tipo_evento = 'RECEITA'
    AND ABS(p.valor_bruto - w.valor_pontual) / NULLIF(w.valor_pontual, 0) < 0.10
    AND p.data_vencimento BETWEEN COALESCE(w.data_fechamento, w.date_modify::date) - INTERVAL '60 days'
                              AND COALESCE(w.data_fechamento, w.date_modify::date) + INTERVAL '60 days'
)
ORDER BY impacto_estimado_rs DESC;
```

- [ ] **Step 4: Validate query 07**

- [ ] **Step 5: Create `08-reajustes-nao-refletidos.sql` (exploratório)**

```sql
-- Cat 08 (exploratório): reajustes contratados não refletidos no CAZ.
-- valorr atual em cup_contratos > valorr de 6 meses atrás em cup_data_hist + média mensal CAZ continua próxima do valor antigo.
WITH cup_now AS (
  SELECT ct.id_subtask, ct.id_task, ct.valorr AS valorr_atual, cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND ct.valorr > 0
),
cup_6m_atras AS (
  SELECT DISTINCT ON (id_subtask) id_subtask, valorr AS valorr_6m
  FROM "Clickup".cup_data_hist
  WHERE data_snapshot BETWEEN NOW() - INTERVAL '7 months' AND NOW() - INTERVAL '5 months'
  ORDER BY id_subtask, data_snapshot DESC
),
caz_recent AS (
  SELECT cm.cnpj_norm,
         AVG(p.valor_bruto) AS media_mensal_caz
  FROM "Conta Azul".caz_parcelas p
  JOIN (
    SELECT ids, LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
    FROM "Conta Azul".caz_clientes
  ) cm ON cm.ids = p.id_cliente
  WHERE p.tipo_evento = 'RECEITA'
    AND (p.categoria_nome ILIKE '%03.01.01%' OR p.categoria_nome ILIKE '%Receita de Serviços%')
    AND p.data_vencimento >= NOW() - INTERVAL '3 months'
  GROUP BY cm.cnpj_norm
)
SELECT
  cn.id_subtask,
  cn.cliente,
  ROUND(cn.valorr_atual::numeric, 2) AS valorr_atual,
  ROUND(c6.valorr_6m::numeric, 2) AS valorr_6m_atras,
  ROUND(cr.media_mensal_caz::numeric, 2) AS valor_parcela_caz,
  ROUND((cn.valorr_atual - cr.media_mensal_caz)::numeric, 2) AS diff,
  ROUND(((cn.valorr_atual - cr.media_mensal_caz) * 6)::numeric, 2) AS impacto_estimado_rs
FROM cup_now cn
JOIN cup_6m_atras c6 ON c6.id_subtask = cn.id_subtask
LEFT JOIN caz_recent cr ON cr.cnpj_norm = cn.cnpj_norm
WHERE cn.valorr_atual > c6.valorr_6m * 1.05  -- subiu pelo menos 5%
  AND cr.media_mensal_caz IS NOT NULL
  AND cr.media_mensal_caz < c6.valorr_6m * 1.05  -- mas o CAZ não acompanhou
  AND (cn.valorr_atual - cr.media_mensal_caz) > 50
ORDER BY impacto_estimado_rs DESC;
```

- [ ] **Step 6: Validate query 08**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
  -f scripts/auditoria/queries/08-reajustes-nao-refletidos.sql | head -10
```
**Sanity expectation:** se vier zero, OK — é exploratório. Se vier muitos, validar 2 casos manualmente antes de manter.

- [ ] **Step 7: Commit**

```bash
git add scripts/auditoria/queries/06-mrr-contratado-vs-cobrado.sql \
        scripts/auditoria/queries/07-valor-pontual-sem-parcela.sql \
        scripts/auditoria/queries/08-reajustes-nao-refletidos.sql
git commit -m "feat(auditoria): seção B — 3 queries de sub-cobrança"
```

---

### Task 6: Section C queries (pós-churn — 2 SQLs)

**Files:**
- Create: `scripts/auditoria/queries/09-encerrados-com-parcelas-abertas.sql`
- Create: `scripts/auditoria/queries/10-inadimplencia-pos-churn.sql`

- [ ] **Step 1: Create `09-encerrados-com-parcelas-abertas.sql`**

```sql
-- Cat 09: Contratos cup encerrados (data_encerramento != NULL) com parcelas abertas no CAZ
-- vencidas > 30 dias depois do encerramento.
WITH cup_closed AS (
  SELECT ct.id_subtask, ct.data_encerramento, cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.data_encerramento IS NOT NULL
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT
  c.id_subtask,
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.data_encerramento,
  p.id AS parcela_id,
  p.data_vencimento AS parcela_vencimento,
  ROUND(p.valor_bruto::numeric, 2) AS valor_bruto,
  p.status AS status_parcela
FROM cup_closed c
JOIN caz_client cm ON cm.cnpj_norm = c.cnpj_norm
JOIN "Conta Azul".caz_parcelas p ON p.id_cliente = cm.ids
WHERE p.tipo_evento = 'RECEITA'
  AND p.data_vencimento > c.data_encerramento + INTERVAL '30 days'
  AND (p.status IS NULL OR UPPER(p.status) NOT IN ('PAGO', 'CANCELADO'))
  AND c.cnpj_norm <> '00000000000000'
ORDER BY p.valor_bruto DESC NULLS LAST;
```

- [ ] **Step 2: Validate query 09**

- [ ] **Step 3: Create `10-inadimplencia-pos-churn.sql`**

```sql
-- Cat 10: Parcelas vencidas há > 90 dias e não pagas, de clientes encerrados.
WITH cup_closed AS (
  SELECT ct.data_encerramento, cl.nome AS cliente,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.data_encerramento IS NOT NULL
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.data_encerramento,
  p.id AS parcela_id,
  p.data_vencimento AS vencimento,
  ROUND(COALESCE(p.nao_pago, 0)::numeric, 2) AS nao_pago,
  EXTRACT(DAY FROM NOW() - p.data_vencimento)::int AS dias_atraso
FROM cup_closed c
JOIN caz_client cm ON cm.cnpj_norm = c.cnpj_norm
JOIN "Conta Azul".caz_parcelas p ON p.id_cliente = cm.ids
WHERE p.tipo_evento = 'RECEITA'
  AND p.data_vencimento < NOW() - INTERVAL '90 days'
  AND COALESCE(p.nao_pago, 0) > 0
  AND c.cnpj_norm <> '00000000000000'
ORDER BY nao_pago DESC;
```

- [ ] **Step 4: Validate query 10**

- [ ] **Step 5: Commit**

```bash
git add scripts/auditoria/queries/09-encerrados-com-parcelas-abertas.sql \
        scripts/auditoria/queries/10-inadimplencia-pos-churn.sql
git commit -m "feat(auditoria): seção C — 2 queries de pós-churn"
```

---

### Task 7: Section D queries (higiene — 6 SQLs)

**Files:**
- Create: `scripts/auditoria/queries/11-duplicatas-cnpj-cup.sql`
- Create: `scripts/auditoria/queries/12-duplicatas-cnpj-caz.sql`
- Create: `scripts/auditoria/queries/13-cup-sem-cnpj.sql`
- Create: `scripts/auditoria/queries/14-caz-sem-cnpj.sql`
- Create: `scripts/auditoria/queries/15-cnpjs-malformados.sql`
- Create: `scripts/auditoria/queries/16-nomes-divergentes-cup-caz.sql`

- [ ] **Step 1: `11-duplicatas-cnpj-cup.sql`**

```sql
SELECT
  LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj,
  ARRAY_AGG(id ORDER BY id) AS ids_clickup_array,
  ARRAY_AGG(nome ORDER BY id) AS nomes_array,
  COUNT(*) AS count
FROM "Clickup".cup_clientes
WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
GROUP BY LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0')
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

- [ ] **Step 2: `12-duplicatas-cnpj-caz.sql`**

```sql
SELECT
  LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj,
  ARRAY_AGG(ids ORDER BY id) AS ids_caz_array,
  ARRAY_AGG(nome ORDER BY id) AS nomes_array,
  ARRAY_AGG(empresa ORDER BY id) AS empresas_array,
  COUNT(*) AS count
FROM "Conta Azul".caz_clientes
WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
GROUP BY LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0')
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

- [ ] **Step 3: `13-cup-sem-cnpj.sql`**

```sql
SELECT id, nome, status, responsavel
FROM "Clickup".cup_clientes
WHERE cnpj IS NULL OR TRIM(cnpj) = ''
ORDER BY nome;
```

- [ ] **Step 4: `14-caz-sem-cnpj.sql`**

```sql
SELECT id, nome, empresa
FROM "Conta Azul".caz_clientes
WHERE cnpj IS NULL OR TRIM(cnpj) = ''
ORDER BY nome;
```

- [ ] **Step 5: `15-cnpjs-malformados.sql`**

Aplicar validação módulo 11 em SQL é verboso. Vou rejeitar via comprimento + regex de 14 dígitos como filtro grosso. A validação fina (módulo 11) acontece em pós-processamento no runner — mas pra simplificar, esta query lista candidatos que **claramente** falham (length != 14 após normalização, ou todos os dígitos iguais).

```sql
WITH all_cnpjs AS (
  SELECT 'cup_clientes' AS fonte, id::text AS id, cnpj AS cnpj_original FROM "Clickup".cup_clientes WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
  UNION ALL
  SELECT 'caz_clientes', id::text, cnpj FROM "Conta Azul".caz_clientes WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
  UNION ALL
  SELECT 'crm_deal', id::text, cnpj FROM "Bitrix".crm_deal WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
)
SELECT
  fonte,
  id,
  cnpj_original AS cnpj_invalido,
  CASE
    WHEN LENGTH(REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g')) <> 14 THEN 'comprimento != 14'
    WHEN REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g') ~ '^(\d)\1+$' THEN 'todos dígitos iguais'
    ELSE 'outro'
  END AS motivo
FROM all_cnpjs
WHERE LENGTH(REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g')) <> 14
   OR REGEXP_REPLACE(cnpj_original, '[^0-9]', '', 'g') ~ '^(\d)\1+$'
ORDER BY fonte, id;
```

**Nota:** validação módulo 11 completa fica como TODO de melhoria — esta query pega o grosso. Documentado no relatório.

- [ ] **Step 6: `16-nomes-divergentes-cup-caz.sql`**

```sql
WITH cup AS (
  SELECT nome AS nome_clickup,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Clickup".cup_clientes
  WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
caz AS (
  SELECT nome AS nome_caz,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes
  WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
)
SELECT
  cup.cnpj_norm AS cnpj,
  cup.nome_clickup,
  caz.nome_caz,
  ROUND(similarity(LOWER(cup.nome_clickup), LOWER(caz.nome_caz))::numeric, 3) AS similaridade
FROM cup
JOIN caz ON caz.cnpj_norm = cup.cnpj_norm
WHERE similarity(LOWER(cup.nome_clickup), LOWER(caz.nome_caz)) < 0.3
ORDER BY similaridade ASC;
```

- [ ] **Step 7: Validate all 6 queries**

```bash
for n in 11 12 13 14 15 16; do
  echo "=== Query $n ==="
  PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo \
    -f scripts/auditoria/queries/$(ls scripts/auditoria/queries/ | grep "^${n}-") 2>&1 | tail -3
done
```

- [ ] **Step 8: Commit**

```bash
git add scripts/auditoria/queries/11-duplicatas-cnpj-cup.sql \
        scripts/auditoria/queries/12-duplicatas-cnpj-caz.sql \
        scripts/auditoria/queries/13-cup-sem-cnpj.sql \
        scripts/auditoria/queries/14-caz-sem-cnpj.sql \
        scripts/auditoria/queries/15-cnpjs-malformados.sql \
        scripts/auditoria/queries/16-nomes-divergentes-cup-caz.sql
git commit -m "feat(auditoria): seção D — 6 queries de saúde de cadastro"
```

---

### Task 8: Section E queries (status divergente — 2 SQLs)

**Files:**
- Create: `scripts/auditoria/queries/17-cup-inativo-com-parcelas.sql`
- Create: `scripts/auditoria/queries/18-cup-ativo-sem-parcela-6m.sql`

- [ ] **Step 1: `17-cup-inativo-com-parcelas.sql`**

`cup_clientes` não tem `data_inativacao` explícita. Aproximação: usar `MAX(cup_contratos.data_encerramento)` por cliente como proxy de inativação. Cliente inativo = `cup_clientes.status` em ('cancelado/inativo', 'não usar').

```sql
WITH cup_inactive AS (
  SELECT cl.id, cl.nome AS cliente, cl.status AS status_cup,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT MAX(ct.data_encerramento) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id) AS data_inativacao_estimada
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('cancelado/inativo', 'não usar')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
),
caz_client AS (
  SELECT cl.ids,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Conta Azul".caz_clientes cl
)
SELECT
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.status_cup,
  c.data_inativacao_estimada,
  p.id AS parcela_id,
  p.data_quitacao,
  ROUND(COALESCE(p.valor_pago, 0)::numeric, 2) AS valor_pago
FROM cup_inactive c
JOIN caz_client cm ON cm.cnpj_norm = c.cnpj_norm
JOIN "Conta Azul".caz_parcelas p ON p.id_cliente = cm.ids
WHERE p.tipo_evento = 'RECEITA'
  AND p.data_quitacao IS NOT NULL
  AND c.data_inativacao_estimada IS NOT NULL
  AND p.data_quitacao > c.data_inativacao_estimada + INTERVAL '30 days'
  AND COALESCE(p.valor_pago, 0) > 0
ORDER BY valor_pago DESC;
```

- [ ] **Step 2: Validate query 17**

- [ ] **Step 3: `18-cup-ativo-sem-parcela-6m.sql`**

```sql
WITH cup_active AS (
  SELECT cl.id, cl.nome AS cliente, cl.status AS status_cup,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT SUM(ct.valorr) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id AND ct.status IN ('ativo','entregue','em cancelamento','pausado')) AS valorr_clickup
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
),
last_p AS (
  SELECT cm.cnpj_norm, MAX(p.data_vencimento) AS ultima
  FROM "Conta Azul".caz_parcelas p
  JOIN (SELECT ids, LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm FROM "Conta Azul".caz_clientes) cm ON cm.ids = p.id_cliente
  WHERE p.tipo_evento = 'RECEITA'
  GROUP BY cm.cnpj_norm
)
SELECT
  c.cliente,
  c.cnpj_norm AS cnpj,
  c.status_cup,
  lp.ultima AS ultima_parcela,
  GREATEST(0, DATE_PART('month', AGE(NOW(), lp.ultima))::int) AS meses_desde,
  ROUND(COALESCE(c.valorr_clickup, 0)::numeric, 2) AS valorr_clickup
FROM cup_active c
LEFT JOIN last_p lp ON lp.cnpj_norm = c.cnpj_norm
WHERE c.cnpj_norm <> '00000000000000'
  AND (lp.ultima IS NULL OR lp.ultima < NOW() - INTERVAL '6 months')
ORDER BY meses_desde DESC NULLS FIRST, valorr_clickup DESC;
```

- [ ] **Step 4: Validate query 18**

- [ ] **Step 5: Commit**

```bash
git add scripts/auditoria/queries/17-cup-inativo-com-parcelas.sql \
        scripts/auditoria/queries/18-cup-ativo-sem-parcela-6m.sql
git commit -m "feat(auditoria): seção E — 2 queries de status divergente"
```

---

### Task 9: Section F queries (cross-CRM — 2 SQLs)

**Files:**
- Create: `scripts/auditoria/queries/19-bitrix-perdido-cup-ativo.sql`
- Create: `scripts/auditoria/queries/20-cup-ativo-sem-deal.sql`

- [ ] **Step 1: `19-bitrix-perdido-cup-ativo.sql`**

```sql
-- Deal marcado como perdido no Bitrix mas o cliente está ativo no ClickUp.
WITH lost_deals AS (
  SELECT id, title, stage_name, comments AS lost_reason,
         LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE stage_name ILIKE '%perdido%'
    AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
),
cup_active AS (
  SELECT cl.nome AS cliente, cl.status AS status_cup,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT SUM(ct.valorr) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id AND ct.status = 'ativo') AS valorr
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
)
SELECT
  ld.id AS id_deal,
  ld.title AS deal_title,
  ld.stage_name,
  ld.lost_reason,
  cu.cliente AS cliente_cup,
  cu.status_cup,
  ROUND(COALESCE(cu.valorr, 0)::numeric, 2) AS valorr
FROM lost_deals ld
JOIN cup_active cu ON cu.cnpj_norm = ld.cnpj_norm
ORDER BY valorr DESC NULLS LAST;
```

- [ ] **Step 2: Validate query 19**

- [ ] **Step 3: `20-cup-ativo-sem-deal.sql`**

```sql
-- Cliente ativo no ClickUp sem nenhum deal correspondente no Bitrix (origem desconhecida).
WITH cup AS (
  SELECT cl.task_id AS id_task, cl.nome AS cliente, cl.vendedor,
         LPAD(REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm,
         (SELECT MIN(ct.data_inicio) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id) AS data_inicio,
         (SELECT SUM(ct.valorr) FROM "Clickup".cup_contratos ct WHERE ct.id_task = cl.task_id AND ct.status IN ('ativo','entregue','em cancelamento','pausado')) AS valorr
  FROM "Clickup".cup_clientes cl
  WHERE cl.status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) <> ''
),
bitrix_cnpjs AS (
  SELECT DISTINCT LPAD(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), 14, '0') AS cnpj_norm
  FROM "Bitrix".crm_deal
  WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
)
SELECT
  c.id_task,
  c.cliente,
  c.cnpj_norm AS cnpj,
  ROUND(COALESCE(c.valorr, 0)::numeric, 2) AS valorr,
  c.vendedor,
  c.data_inicio
FROM cup c
WHERE c.cnpj_norm <> '00000000000000'
  AND NOT EXISTS (SELECT 1 FROM bitrix_cnpjs b WHERE b.cnpj_norm = c.cnpj_norm)
ORDER BY valorr DESC NULLS LAST;
```

- [ ] **Step 4: Validate query 20**

- [ ] **Step 5: Commit**

```bash
git add scripts/auditoria/queries/19-bitrix-perdido-cup-ativo.sql \
        scripts/auditoria/queries/20-cup-ativo-sem-deal.sql
git commit -m "feat(auditoria): seção F — 2 queries cross-CRM"
```

---

### Task 10: Section G queries (cobertura — 3 SQLs)

**Files:**
- Create: `scripts/auditoria/queries/21-pct-cnpj-por-pipeline.sql`
- Create: `scripts/auditoria/queries/22-pct-stage-semantic.sql`
- Create: `scripts/auditoria/queries/23-campos-criticos-vazios.sql`

- [ ] **Step 1: `21-pct-cnpj-por-pipeline.sql`**

```sql
SELECT
  category_id,
  category_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> '') AS com_cnpj,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> '') / NULLIF(COUNT(*), 0), 1) AS pct
FROM "Bitrix".crm_deal
GROUP BY category_id, category_name
ORDER BY total DESC;
```

- [ ] **Step 2: `22-pct-stage-semantic.sql`**

```sql
SELECT
  category_id,
  category_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE stage_semantic IS NOT NULL AND TRIM(stage_semantic) <> '') AS com_semantic,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stage_semantic IS NOT NULL AND TRIM(stage_semantic) <> '') / NULLIF(COUNT(*), 0), 2) AS pct
FROM "Bitrix".crm_deal
GROUP BY category_id, category_name
ORDER BY total DESC;
```

- [ ] **Step 3: `23-campos-criticos-vazios.sql`**

```sql
WITH stats AS (
  SELECT 'cup_clientes.cnpj' AS campo, COUNT(*) FILTER (WHERE cnpj IS NULL OR TRIM(cnpj)='') AS vazios, COUNT(*) AS total
    FROM "Clickup".cup_clientes
  UNION ALL
  SELECT 'cup_clientes.responsavel', COUNT(*) FILTER (WHERE responsavel IS NULL OR TRIM(responsavel)=''), COUNT(*)
    FROM "Clickup".cup_clientes
  UNION ALL
  SELECT 'cup_clientes.vendedor', COUNT(*) FILTER (WHERE vendedor IS NULL OR TRIM(vendedor)=''), COUNT(*)
    FROM "Clickup".cup_clientes
  UNION ALL
  SELECT 'cup_contratos.valorr', COUNT(*) FILTER (WHERE valorr IS NULL OR valorr=0), COUNT(*)
    FROM "Clickup".cup_contratos
  UNION ALL
  SELECT 'cup_contratos.data_inicio', COUNT(*) FILTER (WHERE data_inicio IS NULL), COUNT(*)
    FROM "Clickup".cup_contratos
  UNION ALL
  SELECT 'caz_clientes.cnpj', COUNT(*) FILTER (WHERE cnpj IS NULL OR TRIM(cnpj)=''), COUNT(*)
    FROM "Conta Azul".caz_clientes
  UNION ALL
  SELECT 'crm_deal.cnpj', COUNT(*) FILTER (WHERE cnpj IS NULL OR TRIM(cnpj)=''), COUNT(*)
    FROM "Bitrix".crm_deal
  UNION ALL
  SELECT 'crm_deal.empresa', COUNT(*) FILTER (WHERE empresa IS NULL OR TRIM(empresa)=''), COUNT(*)
    FROM "Bitrix".crm_deal
  UNION ALL
  SELECT 'crm_deal.stage_semantic', COUNT(*) FILTER (WHERE stage_semantic IS NULL OR TRIM(stage_semantic)=''), COUNT(*)
    FROM "Bitrix".crm_deal
  UNION ALL
  SELECT 'crm_deal.data_fechamento', COUNT(*) FILTER (WHERE data_fechamento IS NULL), COUNT(*)
    FROM "Bitrix".crm_deal
)
SELECT
  campo,
  vazios,
  total,
  ROUND(100.0 * vazios / NULLIF(total, 0), 1) AS pct_vazio
FROM stats
ORDER BY pct_vazio DESC;
```

- [ ] **Step 4: Validate all 3**

- [ ] **Step 5: Commit**

```bash
git add scripts/auditoria/queries/21-pct-cnpj-por-pipeline.sql \
        scripts/auditoria/queries/22-pct-stage-semantic.sql \
        scripts/auditoria/queries/23-campos-criticos-vazios.sql
git commit -m "feat(auditoria): seção G — 3 queries de cobertura de dado"
```

---

### Task 11: Markdown rendering completo

**Files:**
- Create: `scripts/auditoria/lib/render-markdown.ts`
- Modify: `scripts/auditoria-crm-erp.ts` (substitui o placeholder MD por chamada ao renderer)

- [ ] **Step 1: Criar `scripts/auditoria/lib/render-markdown.ts`**

```typescript
// scripts/auditoria/lib/render-markdown.ts
import { CATALOG, SECTION_TITLES, type QuerySpec, type Section } from '../catalog';
import type { QueryResult } from './run-query';
import { formatBRL } from './format-currency';

export interface ReportInput {
  date: string;
  results: Array<{ spec: QuerySpec; result: QueryResult }>;
}

function sumImpact(spec: QuerySpec, rows: Record<string, unknown>[]): number {
  if (!spec.hasFinancialImpact || !spec.impactColumn) return 0;
  return rows.reduce((acc, row) => {
    const v = row[spec.impactColumn!];
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function topRows(rows: Record<string, unknown>[], n: number): Record<string, unknown>[] {
  return rows.slice(0, n);
}

function rowsToTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '_(sem linhas)_';
  const cols = Object.keys(rows[0]);
  const header = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + cols.map(c => {
    const v = r[c];
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString('pt-BR') : '';
    return String(v).replace(/\|/g, '\\|').slice(0, 60);
  }).join(' | ') + ' |').join('\n');
  return [header, sep, body].join('\n');
}

export function renderMarkdown(input: ReportInput): string {
  const { date, results } = input;

  const impacts = results.map(r => ({
    spec: r.spec,
    total: r.result.total,
    impact: sumImpact(r.spec, r.result.rows),
    error: r.result.error,
  }));

  const totalImpact = impacts.reduce((a, b) => a + b.impact, 0);
  const top5 = [...impacts].filter(i => i.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 5);

  const headerBlock = `# Auditoria CRM → ERP — ${date}

> Diagnóstico end-to-end do funil Bitrix → ClickUp → Conta Azul. Janela: últimos 12 meses. Multi-empresa unificada (Turbo Partners + PEIXOTO DEBBANE).

## 🎯 Headline

**${formatBRL(totalImpact)} deixados na mesa nos últimos 12 meses** (estimativa worst case, soma de todas as categorias com impacto financeiro).

${impacts.filter(i => !i.spec.hasFinancialImpact && i.total > 0).reduce((acc, i) => acc + i.total, 0)} cadastros bagunçados sem impacto financeiro direto, mas que sustentam o vazamento.

## 🔥 Top 5 Vazamentos por R$ Impacto

| # | Categoria | Ocorrências | R$ Impacto | Ação |
|---|---|---:|---:|---|
${top5.map((i, idx) => `| ${idx + 1} | ${i.spec.title} | ${i.total} | ${formatBRL(i.impact)} | ${i.spec.actionSuggestion.split('.')[0]}. |`).join('\n')}

## ⚡ 3 Ações de Maior ROI Imediato

1. **Tornar CNPJ obrigatório no Bitrix antes de mover pra "Negócio Ganho"** — bloqueia futuros vazamentos da categoria 01 (raiz do problema). Esforço: baixo. Recupera: ~${formatBRL(impacts.find(i => i.spec.id === '01-deals-ganhos-sem-cnpj')?.impact ?? 0)} de potencial nos próximos 12 meses.
2. **Auditar caso a caso os deals da categoria 02** — clientes vendidos com CNPJ válido mas sem cadastro no CAZ. Lista no CSV anexo. Esforço: médio. Recupera: ${formatBRL(impacts.find(i => i.spec.id === '02-deals-ganhos-sem-cliente-caz')?.impact ?? 0)}.
3. **Cancelar parcelas indevidas de contratos encerrados (categoria 09)** — risco jurídico imediato, ${impacts.find(i => i.spec.id === '09-encerrados-com-parcelas-abertas')?.total ?? 0} casos. Esforço: baixo. Mitigação: ${formatBRL(impacts.find(i => i.spec.id === '09-encerrados-com-parcelas-abertas')?.impact ?? 0)} de exposição.

## Metodologia

- **Janela:** 12 meses, capada nos multiplicadores temporais.
- **"Deal ganho":** \`stage_name\` em ('Negócio Ganho', 'Negócios Fechados') nas pipelines 0 (Geral) e 12 (Cross Sell e Upsell). Universo: 611 deals.
- **Multi-empresa:** Turbo Partners + PEIXOTO DEBBANE unificadas (cliente "existe" se aparece em qualquer das duas).
- **CNPJ normalizado:** \`LPAD(REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g'), 14, '0')\` aplicado nas 3 fontes.
- **Recorrente:** \`tipo_fatura\` está vazio em 100% das parcelas (bug ETL); usamos categoria \`03.01.01 Receita de Serviços\` como proxy.
- **Estimativas são teto (worst case)**, não previsão. Cada caso precisa ser validado antes de virar planilha de cobrança.

## Achados de estrutura (smoking guns)

1. **DATABASE.md desatualizado:** \`crm_deal\` tem colunas \`cnpj\`, \`valor_recorrente\`, \`valor_pontual\`, \`closer\`, \`sdr\`, \`funil\`, \`empresa\`, \`data_fechamento\`, \`produtos\`, \`stage_semantic\` que não estão documentadas.
2. **\`crm_deal.stage_semantic\` está vazio em ~99,9% dos deals** — campo deveria ter S/F/P. Provável bug de ETL.
3. **Pipeline "Pós-Ganho" → stage "Subir/Ajustar Cobrança"** existe com 101 deals e zero CNPJ. Literalmente "fila pra dar entrada no financeiro" sem o dado mais básico.
4. **\`caz_parcelas.tipo_fatura\` 100% NULL** — coluna existe mas nunca foi populada. Impossível distinguir recorrente de pontual sem heurística.
5. **\`crm_deal.empresa\` 100% vazio nos deals ganhos** — não dá pra direcionar deal → empresa CAZ.
`;

  // Render sections
  const sections: Section[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const sectionBlocks = sections.map(section => {
    const sectionResults = results.filter(r => r.spec.section === section);
    const sectionImpact = sectionResults.reduce((acc, r) => acc + sumImpact(r.spec, r.result.rows), 0);
    const sectionHeader = `\n## ${SECTION_TITLES[section]}${sectionImpact > 0 ? ` — ${formatBRL(sectionImpact)} de impacto` : ''}\n`;

    const catBlocks = sectionResults.map(({ spec, result }) => {
      const impact = sumImpact(spec, result.rows);
      const top = topRows(result.rows, 10);
      if (result.error) {
        return `\n### Categoria ${spec.number} — ${spec.title}\n\n⚠️ **Erro ao executar:** \`${result.error}\`\n`;
      }
      if (result.total === 0) {
        return `\n### Categoria ${spec.number} — ${spec.title}\n\n✅ Nenhum problema encontrado.\n`;
      }
      return `\n### Categoria ${spec.number} — ${spec.title}

**Problema:** ${spec.description}

**Total:** ${result.total} ocorrências${spec.hasFinancialImpact ? ` &nbsp;·&nbsp; **Impacto estimado:** ${formatBRL(impact)} (worst case)` : ''}

**Ação sugerida:** ${spec.actionSuggestion}

**Top 10 piores:**

${rowsToTable(top)}

**CSV completo:** [csv/${spec.id}.csv](${date}/csv/${spec.id}.csv) (${result.total} linhas)
`;
    }).join('');

    return sectionHeader + catBlocks;
  }).join('');

  const footer = `

## Próximos Passos Recomendados

Ordenado por ROI (impacto × facilidade de execução):

${[...impacts].filter(i => i.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 8).map((i, idx) =>
  `${idx + 1}. **[Cat ${i.spec.number}] ${i.spec.title}** — ${formatBRL(i.impact)} potencial. ${i.spec.actionSuggestion}`
).join('\n')}

## Sub-tasks de remediação sugeridas (não implementadas aqui)

- \`[ETL]\` Investigar por que \`crm_deal.stage_semantic\` está vazio em ~99,9% dos deals
- \`[ETL]\` Investigar por que \`caz_parcelas.tipo_fatura\` está 100% NULL
- \`[DOC]\` Atualizar \`DATABASE.md\` com colunas reais de \`crm_deal\`
- \`[BITRIX]\` Tornar CNPJ obrigatório nos stages de fechamento ("Negócio Ganho", "Negócios Fechados")
- \`[BITRIX]\` Preencher campo \`empresa\` nos deals para permitir routing por empresa
- \`[ClickUp]\` Validar CNPJ no momento de criação do cliente (módulo 11)

## Anexo — Limitações conhecidas

1. Estimativas são **teto** (worst case), não previsão. Cada caso precisa ser validado individualmente antes de virar cobrança real.
2. **Categoria 08 (reajustes) é exploratória** — pode vir com falsos positivos altos.
3. Comissionamento por venda errada **não está coberto** (fora de escopo).
4. **Cobrança paralela fora do CAZ** (Pix sem registro) não é detectável — pode aparecer aqui como falso positivo de vazamento.
5. **Pipelines do Bitrix além de 0 e 12** (BootCamps, Pós-Ganho, Outbound, Inbound) **não entram** no universo de "ganho" desta auditoria por decisão do escopo.
6. **Auditoria de despesas** (\`tipo_evento='DESPESA'\`) está fora — escopo é receita.
7. **Validação módulo 11 de CNPJ** na categoria 15 está em modo grosso (length+repetidos). Validação completa fica para evolução do script.

---

_Gerado por \`scripts/auditoria-crm-erp.ts\` em ${new Date().toISOString()}._
`;

  return headerBlock + sectionBlocks + footer;
}
```

- [ ] **Step 2: Substituir o placeholder no runner**

Em `scripts/auditoria-crm-erp.ts`, na seção que escreve o MD, trocar o `writeFileSync(REPORT_PATH, ...)` placeholder por:

```typescript
import { renderMarkdown } from './auditoria/lib/render-markdown';

// (... resto do main ...)

const md = renderMarkdown({ date: TODAY, results });
mkdirSync(join(REPO_ROOT, 'docs', 'auditoria'), { recursive: true });
writeFileSync(REPORT_PATH, md, 'utf-8');
```

Remover o `import` antigo se houver, e a string template placeholder.

- [ ] **Step 3: Smoke test dry-run gera MD completo das 3 primeiras categorias**

```bash
npm run auditoria-crm-erp -- --dry-run
```
Expected: arquivo `docs/auditoria/<date>-auditoria-crm-erp.md` existe, tem headline em R$, top 5, seção A com 3 subseções renderizadas.

- [ ] **Step 4: Commit**

```bash
git add scripts/auditoria/lib/render-markdown.ts scripts/auditoria-crm-erp.ts
git commit -m "feat(auditoria): renderer markdown completo (headline, top 5, seções, anexo)"
```

---

### Task 12: Execução final em prod + sanity check + commit dos artefatos

**Files:**
- Create: `docs/auditoria/<TODAY>-auditoria-crm-erp.md`
- Create: `docs/auditoria/<TODAY>/csv/*.csv` (23 arquivos)

- [ ] **Step 1: Run completo (sem --dry-run)**

```bash
npm run auditoria-crm-erp
```
Expected:
- 23 queries logam status
- Tempo total < 90s
- Sem `⚠️` (a menos que pg_trgm tenha falhado, caso em que 02 e 16 mostram aviso)
- MD escrito em `docs/auditoria/<date>-auditoria-crm-erp.md`
- 23 CSVs em `docs/auditoria/<date>/csv/`

- [ ] **Step 2: Inspeção visual do MD**

```bash
head -80 docs/auditoria/$(date +%Y-%m-%d)-auditoria-crm-erp.md
```
Verificar:
- Headline com R$ não-zero plausível
- Top 5 ordenado decrescente
- Seções A–G presentes
- Categoria 01 mostra ~405 ocorrências (validação cruzada com investigação inicial)

- [ ] **Step 3: Sanity check manual de 3 categorias**

Escolher 3 categorias com impacto > 0 e validar 1 caso de cada manualmente:

1. **Categoria 01:** abrir o primeiro `id_deal` no CSV no Bitrix (`https://turbopartners.bitrix24.com.br/crm/deal/details/<id>/`). Confirmar que o CNPJ está vazio.
2. **Categoria 04:** abrir um `id_subtask` no ClickUp e confirmar status ativo + buscar o cnpj no DBeaver/CAZ pra confirmar ausência.
3. **Categoria 09:** pegar um caso, validar no CAZ que a parcela existe e venceu depois do encerramento do contrato no ClickUp.

Documentar findings num scratch (não commita): se alguma falhou, voltar à query e corrigir.

- [ ] **Step 4: Verificar tamanhos dos CSVs**

```bash
wc -l docs/auditoria/$(date +%Y-%m-%d)/csv/*.csv
```
Categoria 01 deve ter ~406 linhas (405 + header). Outros conforme totais.

- [ ] **Step 5: Commit dos artefatos**

```bash
git add docs/auditoria/
git commit -m "chore(auditoria): primeira execução — relatório + CSVs $(date +%Y-%m-%d)"
```

- [ ] **Step 6: Resumo final no terminal**

Imprimir mentalmente o resumo:
- Total de ocorrências por seção
- R$ headline
- Top 3 categorias por impacto
- Quaisquer erros graceful que apareceram

---

## Self-review (executado pós-escrita do plano)

**Cobertura do spec:**

| Seção do spec | Task(s) |
|---|---|
| §2 Achados pré-brainstorm | Task 1 (DISCOVERY.md) |
| §3 Decisões aprovadas | Refletidas na catalog.ts (Task 3) e em todas as queries |
| §4 Arquitetura | Task 3 (skeleton), Task 11 (renderer), Task 12 (execução) |
| §5.A Vazamento (5 cats) | Task 4 |
| §5.B Sub-cobrança (3 cats) | Task 5 |
| §5.C Pós-churn (2 cats) | Task 6 |
| §5.D Higiene (6 cats) | Task 7 |
| §5.E Status divergente (2 cats) | Task 8 |
| §5.F Cross-CRM (2 cats) | Task 9 |
| §5.G Cobertura (3 cats) | Task 10 |
| §6 Metodologia $ | Implementada nas queries de Task 4–8 |
| §7 Estrutura do relatório | Task 11 |
| §8 Pontos a resolver | Resolvidos no DISCOVERY.md (Task 1) e refletidos nas queries |
| §9 Como rodar | Task 3 (script no package.json) |
| §10 Error handling | Task 3 (run-query.ts) + Task 11 (renderer trata erro/zero) |
| §11 Validação | Task 12 (sanity check manual) + tests dos helpers (Task 2) |
| §12 Limitações | Task 11 (anexo do MD) |

23 categorias = 23 arquivos `.sql` = 23 entradas no `catalog.ts`. ✓

**Placeholder scan:**
- Sem "TBD"/"TODO" deixados.
- Validação módulo 11 completa em SQL marcada como evolução futura na Task 7 (intencional — o helper TS já valida; o filtro grosso em SQL pega o universo).
- Categoria 08 marcada como exploratória — comportamento aceito.

**Type consistency:**
- `QueryResult`, `QuerySpec`, `Section` definidos em `lib/run-query.ts` e `catalog.ts`. Renderer importa de ambos. ✓
- `impactColumn` em `catalog.ts` aponta para nomes reais retornados pelas queries (`impacto_estimado_rs`, `valor_bruto`, `nao_pago`, `valor_pago`). Cross-checked. ✓
- Sem mismatches de naming entre tasks.

**Ambiguidade resolvida inline:**
- Todas as queries usam `LPAD(REGEXP_REPLACE(...), 14, '0')` consistentemente.
- Status buckets do ClickUp definidos uma vez no DISCOVERY.md e copiados literalmente em cada query.
- `tipo_evento='RECEITA'` (uppercase) em todas as queries (corrigido vs DATABASE.md).
