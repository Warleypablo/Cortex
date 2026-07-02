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
