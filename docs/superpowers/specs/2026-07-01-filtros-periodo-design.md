# Filtros rápidos de período (Mês / Trimestre / Semestre / Ano / YTD)

**Data:** 2026-07-01 · **Status:** aprovado · Entrega **por fases**

## Decisões
- Períodos: Mês (jan–dez), Q1–Q4, S1/S2, Ano, YTD. Todos dentro de um ano (sem cross-year).
- Param nos endpoints: `?de=YYYY-MM&ate=YYYY-MM` (mês único = de=ate). `mes=YYYY-MM` mantido como atalho compatível.
- Componente `PeriodoSelector` compartilhado; adoção **tela por tela** (cada endpoint precisa agregar por intervalo).

## Fase 1 — componente + Gestão de Receita (piloto)
### Componente `client/src/components/PeriodoSelector.tsx`
- Props: `value: { de: string; ate: string }`, `onChange: (v: {de; ate; label}) => void`, `ano?: number` (default 2026).
- UI: dropdown de Mês (jan–dez) + chips de atalho `Q1 Q2 Q3 Q4 · S1 S2 · Ano · YTD`. Chip ativo destacado (compara de/ate com presets).
- Presets (ano A): mês N = `A-0N`..`A-0N`; Q1=01–03, Q2=04–06, Q3=07–09, Q4=10–12; S1=01–06, S2=07–12; Ano=01–12; YTD=01–mês corrente.

### Backend `server/routes/gestaoReceita.ts`
- `parseMes` → `parsePeriodo(query)`: aceita `de`/`ate` (ou `mes`). Retorna `{ dIni, dFim, mesesNums: number[], ano, label }`. `dIni`=1º dia de `de`; `dFim`=1º dia do mês seguinte a `ate`.
- **Orçado**: `bp2026_orcado WHERE mes = ANY(mesesNums)`, somado por métrica (métricas usadas são fluxo: vendas_mrr/pontual, cac, cac_sub, contratos_vendidos_* → soma correta).
- **Custos** (caixa): `somaDespesaCaixaPorMes` retorna por mês → somar `mesesNums`.
- **Venda/funil/churn/produto/ticket/conversão**: já usam `dIni/dFim` → range funciona direto.
- `mesParcial` = true se o período inclui o mês/ano corrente.
- Endpoint `/detalhe` idem (usa `parsePeriodo`); label do drill = período.

### Frontend `GestaoReceita.tsx`
- Troca o `<Select mes>` pelo `<PeriodoSelector>`. Estado vira `{ de, ate }`. queryKey inclui de/ate. Mutation de metas usa o mês do início (metas são mensais — editar meta em período multi-mês: desabilita edição ou edita o 1º mês; v1 = edição só quando de=ate).

## Fase 2+ (depois)
Aplicar `PeriodoSelector` nas telas de Comercial e Growth, adaptando cada endpoint para `de/ate`. Uma por vez.

## Notas
- Metas editáveis só fazem sentido em mês único (bp2026_orcado é mensal) → em período multi-mês, esconder o botão "Editar metas".
- Conversão por coorte e ticket médio agregam no range naturalmente.
