# Whitelist de closers nas telas de comercial

**Data:** 2026-06-24
**Autor:** Warley + Claude
**Status:** Aprovado para implementação (pendente review do spec)

## Objetivo

No Cortex, em **todas as abas de comercial**, exibir como closers somente os 7 closers
ativos: **Zon, Fabio, Daniel, Matheus, Ramon, Roberto, Rodrigo Pimenta**. Hoje as telas
mostram ~30 nomes (ex-funcionários, SDRs atribuídos como responsáveis, closers antigos),
poluindo dropdowns e rankings.

## Identificação dos 7 closers

Fonte canônica de "quem fechou" = `crm_deal.closer` (id numérico) → JOIN `"Bitrix".crm_closers` → `c.nome`.

| Closer (pedido) | id `crm_closers` | nome na tabela | em `crm_closers` hoje? |
|---|---|---|---|
| Zon | 82 | Arthur Zon | sim |
| Fabio | 36 | Fabio Richard Salgado de oliveira | sim |
| Matheus | 18 | Matheus Scalfoni | sim |
| Daniel | 34 | Daniel Basilio Giestas | sim |
| Ramon | 40 | Ramon Reis | sim |
| Roberto | 72 | Roberto Fachetti | sim |
| Rodrigo Pimenta | 1154 | Rodrigo Pimenta | **NÃO — inserir** |

`crm_deal.closer = '1154'` (e `assigned_by_id = 1154`) já é usado nos deals do Rodrigo Pimenta;
ele só não tem linha na `crm_closers`, por isso é silenciosamente excluído dos rankings que usam `INNER JOIN`.

## Decisões de design (validadas com o usuário)

1. **Fonte de verdade = coluna `active` da `crm_closers`** (já existe; hoje todos `false`).
   Editar a lista no futuro = 1 UPDATE no banco, sem deploy.
2. **Escopo:** os não-7 somem de dropdowns/rankings, mas os **totais permanecem** —
   nos rankings os demais são agregados sob **"Outros"**.
3. **Cross-sell fica de fora** (usa `cup_clientes.vendedor`, base de texto livre diferente). SDRs também.

## Mudanças

### A. Dados (local + produção)
```sql
-- 1. inserir Rodrigo Pimenta se não existir
INSERT INTO "Bitrix".crm_closers (id, nome, active)
VALUES (1154, 'Rodrigo Pimenta', true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 2. marcar só os 7 como ativos
UPDATE "Bitrix".crm_closers SET active = (id IN (18,34,36,40,72,82,1154));
```

### B. Dropdowns / filtros → `WHERE active = true`
- `GET /api/closers/list` (`comercial.ts:10`) — adicionar `WHERE active = true`.
- `GET /api/comercial/funil/filtros` (`comercial.ts:2380`) — `... FROM crm_closers WHERE active = true ORDER BY nome`.

Consumidores (filtram automático): DashboardClosers, DetailClosers, FunilVendas.

### C. Rankings / distribuições → `LEFT JOIN` + bucket "Outros"
Trocar `INNER JOIN crm_closers` por `LEFT JOIN` e usar
`CASE WHEN c.active THEN c.nome ELSE 'Outros' END` como nome/agrupamento (e id `NULL`/0 p/ "Outros"):
- `GET /api/closers/chart-receita` (`comercial.ts:302`) — query principal + query de reuniões.
- `GET /api/closers/chart-reunioes-negocios` (`comercial.ts:204`) — ambas as queries.
- `GET /api/vendas/mrr-por-closer` (`comercial.ts:1554`).
- `GET /api/vendas/detalhamento/por-closer` (`comercial.ts:1958`).
- Ranking dos slides em `relatorioMensalSlides.ts:298-318` (deals won do mês) — mesma regra.

Consumidores: DashboardClosers (gráficos), AnaliseVendas, DetalhamentoVendas,
PresentationMode, SlideRankingClosers.

### D. Detalhamento individual → sem mudança
`/api/closers/detail/*` recebe `closerId`; o dropdown já restringe aos 7.

## Riscos / validação

- Trocar `INNER`→`LEFT JOIN` faz deals **sem closer** entrarem em "Outros" (hoje excluídos).
  É o esperado por "manter total intacto", mas muda números exibidos. **Validar antes/depois no banco** (somar MRR/negócios por endpoint, conferir que total = soma das linhas incl. "Outros").
- Garantir que o frontend renderize "Outros" sem quebrar (ex.: cor/cabeçalho de ranking, key React).
- `/api/closers/list` já tem leitura dinâmica de colunas; manter compatível.

## Fora de escopo
- Cross-sell, SDRs, mudanças de UI além de exibir "Outros".
