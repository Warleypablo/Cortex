# Contribuição por Squad — Receita via Itens de Venda — Design Spec

**Data:** 2026-04-13
**Status:** Aprovado — aguardando implementação
**Substitui parcialmente:** `docs/superpowers/specs/2026-04-10-receitas-pontuais-reconciliacao-design.md` (simulador A3)

---

## 1. Motivação

Hoje a aba **Contribuição por Squad** atribui receita via um simulador de reconciliação cumulativa (A3) que **infere** qual contrato do ClickUp gerou cada pagamento do Conta Azul. Problemas:

1. Cliente com múltiplos contratos em squads diferentes tem a divisão decidida por heurística FIFO, não pelo que foi realmente vendido.
2. Receita recorrente é atribuída pelo valor cheio do contrato do mês — sobras/diferenças alimentam pontuais por ordem cronológica.
3. Overpayment residual é descartado silenciosamente.
4. Qualquer desatualização no ClickUp (valor do contrato, data de encerramento, status) vira viés na atribuição.

Com a nova tabela `caz_vendas_itens` e as colunas `venda_id`/`venda_origem` em `caz_parcelas`, passamos a ter o **detalhamento real** de cada venda que originou uma parcela: cada linha traz produto/serviço vendido + valor + quantidade. Isso elimina a inferência para as parcelas que têm `venda_id` populado.

## 2. Escopo

**Dentro:**
- Nova fonte primária de receita por squad usando `caz_vendas_itens` para parcelas com `venda_id` (`venda_origem IN ('VENDA','VENDA_AGENDADA')`).
- Pipeline de match item↔squad via `cup_contratos` com normalização + token + tabela de aliases curada.
- Fallback para o simulador A3 atual quando a parcela não tem `venda_id` (`RENEGOCIACAO`, `LANCAMENTO_FINANCEIRO`).
- Exposição explícita de bucket "Sem Squad" no frontend (Opção B decidida na brainstorm).
- Indicador de fonte dos dados no dashboard (% via itens vs % via fallback A3).

**Fora:**
- Qualquer alteração no cálculo de despesas por squad (mantém lógica atual).
- Carga histórica de `caz_vendas_itens` para anos anteriores a 2026.
- UI administrativa para gerenciar aliases (fica como follow-up; nesta entrega, aliases são gerenciados via SQL direto + seed).
- Ajuste do endpoint `/api/contribuicao-squad/totais-por-squad` e `/ranking` — virão em segunda fase após validação do bulk.

## 3. Decisões de design

### 3.1 Pipeline de match item → squad

Para cada linha de `caz_vendas_itens` relacionada a uma parcela com `venda_id`:

1. **Normalização dos nomes** em duas versões:
   - `norm`: lowercase + unaccent + remove pontuação para espaço + collapse whitespace (usado para tokens e fuzzy).
   - `compact`: lowercase + unaccent + remove **tudo** que não é alfanumérico (usado para substring — garante que "E-commerce" case com "Ecommerce").

2. **Match escopado pelo CNPJ do cliente** (via `caz_parcelas.id_cliente → caz_clientes.cnpj → cup_clientes.cnpj → cup_contratos`).

3. **Cadeia de estratégias, na ordem:**
   - a) `contrato.norm = item.norm` → **exato**
   - b) `contrato.compact LIKE '%' || item.compact || '%'` ou inverso → **substring**
   - c) Token significativo compartilhado (arrays de tokens filtrados por stopwords) → **token**
   - d) Match via `item_alias_map` (item normalizado → target_token) → **alias**
   - e) `similarity(contrato.norm, item.norm) >= 0.4` → **fuzzy**
   - f) Nada casa → **"Sem Squad"**

4. **Atribuição do valor:** o valor do item (`quantidade * valor`) é atribuído ao squad do contrato que casou. Se múltiplos contratos casam com o mesmo item, prioridade é: exato > substring > alias > token > fuzzy. Em empate, escolhe o contrato com maior valor recorrente (`valorr`).

### 3.2 Stopwords (não contam como token significativo)

```
para, com, por, sem, dos, das, mes, fee, uma,
starter, scale, enterprise, standard, premium,
pontual, recorrente, mensal, entrega, implantacao
```

Tokens com length < 3 também são descartados.

### 3.3 Tabela de aliases

Nova tabela `cortex_core.item_alias_map`:

```sql
CREATE TABLE cortex_core.item_alias_map (
  id SERIAL PRIMARY KEY,
  item_pattern VARCHAR(255) NOT NULL,  -- normalizado, lowercase + unaccent
  target_token VARCHAR(100) NOT NULL,  -- token esperado no contrato (normalizado)
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_item_alias_map_pattern ON cortex_core.item_alias_map (item_pattern) WHERE active = true;
```

**Seed inicial (9 entradas validadas):**

| item_pattern | target_token | notes |
|---|---|---|
| aceleracao | performance | Aceleração Scale/Enterprise são variantes de Performance |
| trafego pago | performance | Nome alternativo no CAZ |
| trafego | performance | Idem |
| referente a aceleracao mensal | performance | Texto livre recorrente |
| contrato personalizado | performance | Fallback — ~100% é Grupo Tommasi que só tem squads de Performance |
| variavel mensal | performance | Tipo de cobrança — sempre squad Performance em 2026 |
| gameplan | gameplan | Mantém o termo; só serve pra desambiguar caso apareça |
| desenvolvimento de e commerce | ecommerce | Mesma coisa no Tech |
| sustentacao de site e ecommerce | ecommerce | Idem |

### 3.4 Fallback para parcelas sem `venda_id`

Parcelas com `venda_origem IN ('LANCAMENTO_FINANCEIRO','RENEGOCIACAO')` ou sem `venda_id` continuam passando pelo simulador A3 atual (`server/contribuicaoSquad/simulator.ts`). O handler unifica os dois resultados.

**Ordem de processamento:**
1. Roda pipeline novo → produz `receitasNovas[]` (com info de método de match).
2. Identifica CNPJs+meses que já foram cobertos pelo pipeline novo.
3. Roda simulador A3 só nos CNPJs que **não** foram cobertos, OU para os meses em que o total pago não foi 100% explicado pelos itens.

**Regra de cobertura:** uma parcela é considerada "coberta pelo novo pipeline" se o somatório dos itens da sua venda for ≥ 99% do valor pago da parcela (tolerância para float).

### 3.5 "Sem Squad" no frontend

Quando um item cai no bucket "Sem Squad" (nenhuma estratégia casou):
- A receita continua contando no total do mês (não some).
- Aparece como um "squad" fictício chamado `⚠️ Sem Squad` na lista de squads, com destaque visual (badge amarelo).
- Tooltip mostra o nome do item, cliente e valor — deixa óbvio o que precisa de curadoria.
- Detalhes do "Sem Squad" listam os itens órfãos por cliente, facilitando adicionar no alias map.

### 3.6 Indicador de fonte dos dados

Adicionar no response do endpoint um campo `fonteDados`:

```typescript
{
  fonteDados: {
    totalParcelas: number;
    viaItens: number;       // parcelas atribuídas via caz_vendas_itens
    viaSimuladorA3: number; // parcelas atribuídas via simulador A3 (fallback)
    pctViaItens: number;    // 0-100
  }
}
```

O frontend exibe isso como um badge discreto no header do dashboard: "93% via itens de venda • 7% via simulador (fallback)".

## 4. Modelo de dados completo

### 4.1 Query principal (receita por squad via itens)

```sql
WITH
-- 1. Parcelas 2026 com venda_id
parcelas_2026 AS (
  SELECT
    p.id AS parcela_id,
    p.id_cliente,
    p.venda_id,
    p.empresa,
    p.valor_pago::numeric AS valor_pago,
    TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
    cc.nome AS cliente_nome,
    REPLACE(REPLACE(REPLACE(COALESCE(cc.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo
  FROM "Conta Azul".caz_parcelas p
  JOIN "Conta Azul".caz_clientes cc
    ON TRIM(p.id_cliente::text) = TRIM(cc.ids::text)
  WHERE p.tipo_evento = 'RECEITA'
    AND p.status = 'QUITADO'
    AND p.venda_origem IN ('VENDA','VENDA_AGENDADA')
    AND p.venda_id IS NOT NULL
    AND EXTRACT(YEAR FROM p.data_quitacao) = 2026
    AND cc.cnpj IS NOT NULL AND TRIM(cc.cnpj) != ''
),
-- 2. Itens dessas parcelas com normalizações
itens AS (
  SELECT
    p.parcela_id, p.cnpj_limpo, p.cliente_nome, p.mes, p.valor_pago,
    i.id AS item_id,
    i.nome AS item_raw,
    i.valor * i.quantidade AS item_total,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) AS item_norm,
    REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9]', '', 'g') AS item_compact
  FROM parcelas_2026 p
  JOIN "Conta Azul".caz_vendas_itens i
    ON CAST(i.venda_id AS text) = CAST(p.venda_id AS text)
   AND i.empresa = p.empresa
),
-- 3. Tokens significativos por item
itens_tokens AS (
  SELECT i.*,
    COALESCE((
      SELECT array_agg(t)
      FROM unnest(string_to_array(i.item_norm, ' ')) AS t
      WHERE LENGTH(t) >= 3
        AND t NOT IN ('para','com','por','sem','dos','das','mes','fee','uma',
                      'starter','scale','enterprise','standard','premium',
                      'pontual','recorrente','mensal','entrega','implantacao')
    ), ARRAY[]::text[]) AS item_tokens
  FROM itens i
),
-- 4. Contratos com normalizações e tokens
contratos AS (
  SELECT
    REPLACE(REPLACE(REPLACE(COALESCE(cl.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo,
    ct.id_subtask,
    ct.servico AS contrato_raw,
    COALESCE(NULLIF(TRIM(ct.squad), ''), 'Sem Squad') AS squad,
    GREATEST(COALESCE(ct.valorr::numeric, 0), COALESCE(ct.valorp::numeric, 0)) AS valor,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) AS contrato_norm,
    REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9]', '', 'g') AS contrato_compact
  FROM "Clickup".cup_clientes cl
  JOIN "Clickup".cup_contratos ct ON cl.task_id = ct.id_task
  WHERE ct.servico IS NOT NULL AND TRIM(ct.servico) != ''
    AND (COALESCE(ct.valorr::numeric,0) > 0 OR COALESCE(ct.valorp::numeric,0) > 0)
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) != ''
),
contratos_tokens AS (
  SELECT c.*,
    COALESCE((
      SELECT array_agg(t)
      FROM unnest(string_to_array(c.contrato_norm, ' ')) AS t
      WHERE LENGTH(t) >= 3
        AND t NOT IN ('para','com','por','sem','dos','das','mes','fee','uma',
                      'starter','scale','enterprise','standard','premium',
                      'pontual','recorrente','mensal','entrega','implantacao')
    ), ARRAY[]::text[]) AS contrato_tokens
  FROM contratos c
),
-- 5. Aliases ativos
aliases AS (
  SELECT item_pattern, target_token
  FROM cortex_core.item_alias_map
  WHERE active = true
),
-- 6. Match: para cada item, ranqueia contratos por prioridade
candidatos AS (
  SELECT
    i.parcela_id, i.item_id, i.cliente_nome, i.mes, i.item_raw, i.item_total,
    c.id_subtask, c.squad, c.contrato_raw, c.valor AS contrato_valor,
    CASE
      WHEN c.contrato_norm = i.item_norm THEN 1                                                          -- exato
      WHEN c.contrato_compact LIKE '%' || i.item_compact || '%' 
        OR i.item_compact LIKE '%' || c.contrato_compact || '%' THEN 2                                   -- substring
      WHEN EXISTS (
             SELECT 1 FROM aliases a
             WHERE i.item_norm LIKE '%' || a.item_pattern || '%'
               AND a.target_token = ANY(c.contrato_tokens)
           ) THEN 3                                                                                       -- alias
      WHEN c.contrato_tokens && i.item_tokens THEN 4                                                      -- token
      WHEN similarity(c.contrato_norm, i.item_norm) >= 0.4 THEN 5                                         -- fuzzy
      ELSE NULL
    END AS prioridade
  FROM itens_tokens i
  LEFT JOIN contratos_tokens c ON c.cnpj_limpo = i.cnpj_limpo
),
-- 7. Melhor candidato por item
melhor AS (
  SELECT DISTINCT ON (parcela_id, item_id)
    parcela_id, item_id, cliente_nome, mes, item_raw, item_total,
    id_subtask, squad, contrato_raw, prioridade
  FROM candidatos
  WHERE prioridade IS NOT NULL
  ORDER BY parcela_id, item_id, prioridade ASC, contrato_valor DESC NULLS LAST
),
-- 8. Itens órfãos (sem candidato)
orfaos AS (
  SELECT DISTINCT
    i.parcela_id, i.item_id, i.cliente_nome, i.mes, i.item_raw, i.item_total,
    NULL::text AS id_subtask,
    '⚠️ Sem Squad'::text AS squad,
    NULL::text AS contrato_raw,
    NULL::int AS prioridade
  FROM itens_tokens i
  WHERE NOT EXISTS (
    SELECT 1 FROM candidatos c
    WHERE c.parcela_id = i.parcela_id
      AND c.item_id = i.item_id
      AND c.prioridade IS NOT NULL
  )
)
SELECT * FROM melhor
UNION ALL
SELECT * FROM orfaos;
```

### 4.2 Estruturas do response (sem breaking change)

Mantém o contrato atual (`ano`, `squads`, `meses`, `resumoPorSquad`, `despesasMensais`, etc). Adiciona:

```typescript
{
  // ... campos existentes ...
  fonteDados: {
    totalParcelas: number;
    viaItens: number;
    viaSimuladorA3: number;
    pctViaItens: number;
  };
  // "⚠️ Sem Squad" aparece dentro de squads[] e resumoPorSquad[] como squad normal
}
```

## 5. Testes

### 5.1 Unitários (TS)

Novo arquivo `server/contribuicaoSquad/matchItemToSquad.test.ts`:

- `normalizeNome()` — lowercase, unaccent, strip pontuação, variações
- `compactNome()` — variações "E-commerce" / "e commerce" / "ecommerce"
- `tokenizeNome()` — stopwords filtradas, length < 3 filtrado
- `matchItem()` — casos exato, substring, alias, token, fuzzy, órfão

### 5.2 Integração

Script `scripts/compareSquadReceita.ts` que roda os dois métodos (simulador A3 antigo e pipeline novo) para o ano 2026 e imprime tabela comparativa: squad, receita_antigo, receita_novo, delta, %. Usado para validação manual antes do switchover.

## 6. Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Query grande ficar lenta (JOIN 2k itens × 2k contratos com LIKE) | Média | Índices em `cnpj` + `empresa`. Já temos `idx_caz_vendas_itens_venda_id`. Se passar de 3s, materializar em view. |
| Alias map crescer descontrolado | Baixa | Cap visual no dashboard ("Sem Squad" bucket força curadoria). |
| Novo pipeline divergir muito do A3 e gerar percepção de erro | Média | Script de comparação (5.2) + período de 1 semana com os dois lados visíveis via indicador de fonte. |
| Parcela com `venda_id` mas sem itens em `caz_vendas_itens` (venda de ano anterior) | Baixa | LEFT JOIN cai no fallback A3 naturalmente. |

## 7. Follow-ups (próximas entregas, fora deste escopo)

1. UI admin para gerenciar `item_alias_map` (listar/criar/editar/desativar).
2. Aplicar o mesmo pipeline nos endpoints `/totais-por-squad` e `/ranking`.
3. Automação: quando um item cai em "Sem Squad" 3+ vezes no mês, criar alert para curadoria.
4. Extensão para outros contextos (não só squad — também produto, categoria, centro de custo).
