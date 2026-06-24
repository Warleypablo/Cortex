# Design: Churn Nominal em Revenue (BP 2026)

## Contexto

A aba Revenue do BP 2026 já exibe Churn % por linha de serviço. Falta o valor monetário (Churn R$) orçado × realizado, tanto por produto quanto consolidado.

## Objetivo

Adicionar linhas de **Churn R$** na aba Revenue:
- Uma por linha de serviço: Performance, Creators, Social, GC, Others
- Uma consolidada (`churn_rs_total`) somando os 5 produtos

## Arquitetura

Mudança exclusivamente em `server/routes/bp2026.revenue.ts`. Nenhuma alteração de banco, nenhuma query nova, nenhuma mudança de frontend.

## Dados

### Realizado
Já coletado em `churnRs[chave][mes]` (query existente na `vw_cup_churn_ajustado`).

### Orçado (derivado)
```
churn_rs_orc(chave, m) = churn_pct_orc(chave, m) × mrr_orc(chave, m-1)
```
Onde `m-1 = 0` usa `mrr_orc(chave, 0)` — não existe no banco (dez/2025 não é orçado), então vale `0`. Na prática janeiro terá orçado 0 para o churn_rs, o que é aceitável.

### YTD
- Tipo: `fluxo` (soma acumulada dos meses fechados)
- Atingimento: `realizado / orçado` padrão

## Novas linhas por produto (ordem na tabela)

Antes: `mrr → contratos → aov → churn_pct`
Depois: `mrr → contratos → aov → churn_pct → churn_rs`

Metrica slug: `churn_rs_${chave}` (ex: `churn_rs_performance`)

## Linha consolidada

Slug: `churn_rs_total`  
Posição: logo após `mrr_ativo` no topo da aba Revenue  
Orçado = Σ `churn_rs_orc(chave, m)` para os 5 produtos  
Realizado = Σ `c[m]` para os 5 produtos  
Direção: `menor_melhor` | Unidade: `brl` | tipoAgregacao: `fluxo`

## Nota da linha
`"Valor absoluto de churn não abonado (cancelamentos reais) por produto. Orçado derivado de churn% × MRR orçado do mês anterior."`

## Impacto

| Camada | Arquivo | Mudança |
|--------|---------|---------|
| Backend | `server/routes/bp2026.revenue.ts` | +6 linhas de churn_rs (5 por produto + 1 total) |
| Frontend | — | Nenhuma |
| Banco | — | Nenhuma |
| Testes | — | Nenhuma alteração nos helpers |
