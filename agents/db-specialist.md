# Agente: Especialista em Banco de Dados

## Quando usar

Use este agente como contexto quando precisar:
- Criar queries SQL para novas features
- Adicionar novas tabelas ou colunas
- Entender relacionamentos entre tabelas
- Criar views ou funcoes
- Debugar queries existentes
- Planejar migracoes de dados

## Conexao

- **Engine:** PostgreSQL (Google Cloud SQL)
- **ORM:** Drizzle ORM (`drizzle-orm/node-postgres`)
- **Pool config:** `server/db.ts` (max 20 conexoes, SSL)
- **Schema Drizzle:** `shared/schema.ts`
- **Documentacao completa:** `DATABASE.md` (raiz do projeto)

## Schemas do Banco

| Schema | Prefixo | Fonte | Descricao |
|--------|---------|-------|-----------|
| `"Bitrix"` | `crm_` | Bitrix24 | CRM comercial (deals, closers, users) |
| `"Clickup"` | `cup_` | ClickUp | Operacoes (clientes, contratos, tasks, tech) |
| `"Conta Azul"` | `caz_` | Conta Azul | Financeiro (parcelas, receber, pagar, vendas) |
| `"Inhire"` | `rh_` | Interno | RH/People (pessoal, patrimonio, vagas, NPS) |
| `cortex_core` | variado | Interno | Core do app (auth, catalogs, metricas, contratos) |
| `google_ads` | - | Google Ads | Campanhas e metricas Google Ads |
| `meta_ads` | `meta_` | Meta | Campanhas e metricas Meta/Facebook |

**IMPORTANTE:** Schemas com espaco precisam de aspas duplas nas queries:
```sql
SELECT * FROM "Conta Azul".caz_parcelas LIMIT 10;
SELECT * FROM "Clickup".cup_contratos WHERE status = 'ATIVO';
```

## Tabelas Principais (as que mais usamos)

### Clientes
```sql
-- Clientes do ClickUp (operacional)
"Clickup".cup_clientes (cnpj, nome, status, responsavel, cluster, status_conta)

-- Clientes do Conta Azul (financeiro)
"Conta Azul".caz_clientes (id, nome, cnpj, email, endereco, ids)

-- JOIN entre os dois via CNPJ:
SELECT cup.nome, cup.status, caz.endereco
FROM "Clickup".cup_clientes cup
LEFT JOIN "Conta Azul".caz_clientes caz ON cup.cnpj = caz.cnpj::text;
```

### Contratos
```sql
-- Contratos ativos com MRR
"Clickup".cup_contratos (id_subtask PK, id_task FK->cliente, servico, status, valorr, valorp, data_inicio, data_encerramento, squad, produto, vendedor)

-- Historico diario de contratos (snapshots)
"Clickup".cup_data_hist (id, data_snapshot, ...mesmas colunas de cup_contratos)
```

### Financeiro
```sql
-- TABELA MAIS IMPORTANTE do financeiro
"Conta Azul".caz_parcelas (id, status, valor_pago, valor_bruto, data_vencimento, data_quitacao, tipo_evento, categoria_nome, empresa, id_cliente)

-- CUIDADO: categoria_nome pode ter multiplos valores separados por ";"
-- Use regexp_split_to_table() para expandir

-- Contas a receber / pagar
"Conta Azul".caz_receber (id, status, total, data_vencimento, cliente_nome)
"Conta Azul".caz_pagar (id, status, total, data_vencimento, fornecedor)
```

### RH
```sql
-- Colaboradores
"Inhire".rh_pessoal (id, nome, status, admissao, demissao, setor, squad, cargo, nivel, salario)

-- Promocoes
"Inhire".rh_promocoes (id, colaborador_id FK->rh_pessoal.id, data_promocao, cargo_anterior, cargo_novo)
```

## Chaves de Relacionamento Cross-Schema

```
"Clickup".cup_clientes.cnpj  <-->  "Conta Azul".caz_clientes.cnpj
"Conta Azul".caz_parcelas.id_cliente  <-->  "Conta Azul".caz_clientes.ids
"Clickup".cup_contratos.id_task  <-->  "Clickup".cup_clientes.task_id
```

## Views Prontas (usar em vez de recriar)

| View | Schema | O que faz |
|------|--------|-----------|
| `cortex_core.clientes` | cortex_core | JOIN cup_clientes + caz_clientes via CNPJ |
| `cortex_core.dfc_completa` | cortex_core | Fluxo de caixa com classificacao Entrada/Saida |
| `cortex_core.dfc_mensal` | cortex_core | DFC agrupado por mes de quitacao |
| `cortex_core.vw_cohort_contratos` | cortex_core | Analise de cohort de contratos |
| `gold_views.clientes` | gold_views | Visao unificada gold layer |
| `public.vw_contratos_canon` | public | Contratos com slugs canonizados |

## Hierarquia de Categorias (Plano de Contas)

```
03.xx = Receitas Operacionais
  03.01 = Receita Commerce
  03.02 = Receita Variavel
  03.03 = Receita Stack Digital
  03.04 = Receita de Curso e Treinamentos
  03.05 = Receita Ventures
04.xx = Receitas Nao Operacionais
05.xx = Custos Operacionais
06.xx = Despesas Operacionais
07.xx = Despesas Nao Operacionais
```

## Queries Uteis de Referencia

```sql
-- MRR total ativo
SELECT SUM(valorr) as mrr_total
FROM "Clickup".cup_contratos
WHERE status IN ('ATIVO', 'EM CANCELAMENTO');

-- Clientes por squad
SELECT squad, COUNT(DISTINCT id_task) as clientes, SUM(valorr) as mrr
FROM "Clickup".cup_contratos
WHERE status = 'ATIVO'
GROUP BY squad ORDER BY mrr DESC;

-- Inadimplencia (parcelas vencidas nao pagas)
SELECT c.nome, p.valor_bruto, p.data_vencimento,
       CURRENT_DATE - p.data_vencimento::date as dias_atraso
FROM "Conta Azul".caz_parcelas p
JOIN "Conta Azul".caz_clientes c ON p.id_cliente = c.ids
WHERE p.tipo_evento = 'receita'
  AND p.data_vencimento < CURRENT_DATE
  AND p.data_quitacao IS NULL
ORDER BY dias_atraso DESC;

-- Churn mensal (contratos encerrados por mes)
SELECT DATE_TRUNC('month', data_encerramento) as mes,
       COUNT(*) as churned, SUM(valorr) as mrr_perdido
FROM "Clickup".cup_contratos
WHERE data_encerramento IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC;

-- Colaboradores ativos por squad
SELECT squad, COUNT(*) as total
FROM "Inhire".rh_pessoal
WHERE status = 'Ativo'
GROUP BY squad ORDER BY total DESC;
```

## Padroes ao Criar Novas Tabelas

1. **Schema:** Novas tabelas internas vao em `cortex_core`
2. **Nomenclatura:** snake_case, prefixo por dominio quando fizer sentido
3. **PK:** Usar `SERIAL PRIMARY KEY` ou UUID
4. **Timestamps:** Sempre incluir `created_at TIMESTAMP DEFAULT NOW()`
5. **Drizzle:** Definir a tabela em `shared/schema.ts` usando `cortexCoreSchema.table()`
6. **Inicializacao:** Criar funcao `initializeXxxTable()` em `server/db.ts` com `CREATE TABLE IF NOT EXISTS`

### Exemplo de nova tabela:

```typescript
// shared/schema.ts
export const minhaTabela = cortexCoreSchema.table("minha_tabela", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  ativo: boolean("ativo").default(true),
  criadoEm: timestamp("criado_em").defaultNow(),
});
```

## Seguranca

- **NUNCA** expor queries diretas ao usuario final
- Queries de leitura: sempre validar que comeca com SELECT
- Queries de escrita: usar ORM (Drizzle) com parametros tipados
- **NUNCA** usar `sql.raw()` com input do usuario sem sanitizacao
