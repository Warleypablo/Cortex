# Banco Cortex — queries prontas para o intake (SOMENTE LEITURA)

Regras: apenas `SELECT`; schemas com espaço exigem aspas duplas; antes de query nova,
ler `agents/db-specialist.md` e `DATABASE.md` do repo. Local: `PGPASSWORD=dev123 psql -h localhost
-U cortex -d cortex_dev`. Produção: credenciais no `.env` da raiz (host GCP) — preferir o local
(espelho) e avisar que pode estar defasado.

## Gotchas que invalidam análise (aprendidos a caro)

- `tipo_evento` em caz_parcelas é MAIÚSCULO: `'RECEITA'` / `'DESPESA'`.
- **caz_parcelas/caz_receber só têm dados desde set–out/2025.** Receita histórica (2023+) = `caz_vendas` (regime EMITIDO, não caixa).
- **caz_receber NÃO contém a TURBO FILIAL** (sync externo não a traz) — para visão do grupo, usar caz_parcelas.
- **caz_bancos tem contas-fantasma da TURBO FILIAL** espelhando saldos da PARTNERS ao centavo — não somar saldo por aí sem deduplicar.
- CNPJ cross-schema: normalizar `regexp_replace(cnpj, '\D', '', 'g')` + filtrar `LENGTH IN (11,14)`; caz tem ~529 placeholders "SEM-DOC".
- `categoria_nome` pode ter múltiplos valores separados por `;` → `regexp_split_to_table()`.
- Espelho local pode estar defasado vs produção — dizer a data-limite dos dados no relatório.

## Receita mensal por entidade — regime de caixa/vencimento (desde set/2025)

```sql
SELECT empresa,
       TO_CHAR(DATE_TRUNC('month', data_vencimento), 'YYYY-MM') AS mes,
       ROUND(SUM(valor_bruto)) AS receita_bruta,
       ROUND(SUM(valor_pago) FILTER (WHERE data_quitacao IS NOT NULL)) AS recebido
FROM "Conta Azul".caz_parcelas
WHERE tipo_evento = 'RECEITA'
  AND data_vencimento >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'
GROUP BY 1, 2 ORDER BY 2, 1;
```

## Receita histórica por entidade — regime emitido (2023+)

```sql
SELECT empresa,
       TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mes,
       ROUND(SUM(total)) AS faturamento_emitido
FROM "Conta Azul".caz_vendas
GROUP BY 1, 2 ORDER BY 2, 1;
```

RBT12 por entidade = soma dos últimos 12 meses fechados desta query.

## Receita por produto (contratos ClickUp — grão operacional)

```sql
-- MRR ativo por produto
SELECT produto, COUNT(*) AS contratos, SUM(valorr) AS mrr
FROM "Clickup".cup_contratos
WHERE status IN ('ativo', 'em cancelamento')   -- status é minúsculo
GROUP BY 1 ORDER BY 3 DESC NULLS LAST;

-- Venda pontual por produto/mês
SELECT produto, TO_CHAR(DATE_TRUNC('month', data_criado), 'YYYY-MM') AS mes, SUM(valorp) AS pontual
FROM "Clickup".cup_contratos
WHERE valorp > 0
GROUP BY 1, 2 ORDER BY 2 DESC, 3 DESC;
```

Nota: ClickUp classifica recorrente×pontual pelo nome do serviço; o valor "oficial" financeiro é o
Conta Azul. Usar ClickUp para quebra por produto, Conta Azul para totais.

## Folha (RH) — insumo do Fator R (aproximação; confirmar com a folha oficial)

```sql
SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM') AS ref,
       COUNT(*) AS ativos, SUM(salario) AS folha_bruta_mensal
FROM "Inhire".rh_pessoal
WHERE status = 'Ativo';
```

Atenção: rh_pessoal mistura CLT e PJ — **PJ não conta no Fator R**; pedir a segregação no intake
(campo de modalidade, se existir, ou confirmação do RH).
