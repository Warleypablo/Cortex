# Contribuição por Squad — Foco em Despesas + Salários Proporcionais

**Data:** 2026-04-10
**Status:** Aprovado, pronto para plano de implementação
**Escopo:** `client/src/pages/ContribuicaoSquad.tsx` + endpoint `/api/contribuicao-squad/dfc/bulk` em `server/routes.ts`

---

## Contexto

A aba **Contribuição por Squad** mostra hoje uma tabela com receitas, despesas (Impostos, Salários, CXCs, Freelancers) e margem por squad/mês. Dois problemas:

1. **Impostos e CXCs deixam de ser foco.** O usuário quer simplificar a visão de despesas para os componentes que realmente importam: salários (CLT/PJ) e freelancers.
2. **Salários são lineares.** O backend devolve `salarioTotal` (soma dos colaboradores ativos hoje) e replica esse valor em todos os 12 meses do ano, ignorando completamente as datas de admissão e demissão. Na prática, o salário de março nunca é igual ao de abril — pessoas entram e saem.

Este design corrige os dois problemas em uma única passagem.

---

## Decisões tomadas no brainstorm

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Como tratar admissão/demissão no meio do mês? | **Proporcional por dias corridos** (`dias_ativos / dias_no_mes`). |
| 2 | Como definir se colaborador estava ativo no mês? | **Só datas** — `admissao <= fim_mes AND (demissao IS NULL OR demissao >= inicio_mes)`. Ignora `status` para preservar histórico fiel. |
| 3 | Como remover Impostos/CXCs? | **Remover totalmente** — UI, estado, cálculo, query. Sem feature flag. |
| 4 | Considerar promoções/mudanças de salário no ano? | **Não** — usa salário atual de `rh_pessoal.salario`. Limitação documentada. |
| 5 | Como tratar mudanças de squad no ano? | **Não reconstrói** — usa squad atual de `rh_pessoal.squad`. Limitação documentada. |
| Abordagem | SQL vs JS para a proporcionalidade? | **SQL** — `generate_series` + `GREATEST/LEAST`. Mantém routes.ts mais leve e centraliza a regra de datas no banco. |

---

## Mudanças no Frontend (`client/src/pages/ContribuicaoSquad.tsx`)

### Remoções
1. Linhas **"Impostos"** e **"CXCs"** das duas tabelas de drilldown de Despesas (linhas ~487-490 e ~676-679 — array `[{ label: "Impostos" }, { label: "Salários" }, { label: "CXCs" }, { label: "Freelancers" }]`).
2. Estado `taxaImposto` e derivado `taxaDecimal` (linhas 74-75).
3. `<Input>` de alíquota no header (linhas 291-302).
4. Cálculos em `tableData`: `impostosPorMes`, `cxcsPorMes` (linhas 195-197).
5. Uso de `taxaDecimal` no cálculo de despesa total (`receitaMes * taxaDecimal` deixa de existir).
6. `cxcs` nos cálculos de `despesaTotalPorMes` e no `squadRanking` (linhas 163, 186).

### Atualizações
7. **Subtitle do hero "Total Despesas"** (linha 310): de `"Despesas rateadas (impostos + salários + CXCs + freelancers)"` para `"Despesas rateadas (salários + freelancers)"`.
8. **Tipo `SalarioDetalhe`** (linhas 43-46):
   ```diff
    interface SalarioDetalhe {
      nome: string;
   -  salario: number;
   +  porMes: number[];   // 12 posições, índice 0 = jan
   +  total: number;
    }
   ```
9. **Tipo `DespesasMensais`** (linhas 35-41):
   ```diff
    interface DespesasMensais {
      [mes: string]: {
        salarios: number;
   -    cxcs: number;
        freelancers: number;
      };
    }
   ```
10. **Drilldown de Salários** — colaborador (linha 521-535 e 706-721): cada coluna mensal passa a ler `colab.porMes[i]` em vez do `colab.salario` repetido. Total da linha vira `colab.total`.
11. **Ordenação do drilldown total** (linha 706): `.sort((a, b) => b.salario - a.salario)` vira `.sort((a, b) => b.total - a.total)`.

### O que continua igual
- Estrutura de squad collapse, expansão de Receita/Despesas/Salários.
- `formatCurrencyNoDecimals`, dark mode, sticky columns.
- Filtro de squad e filtro de ano.
- Linhas Receita, Margem, Margem %.

---

## Mudanças no Backend (`server/routes.ts`, endpoint `/api/contribuicao-squad/dfc/bulk` ~linha 5341)

### Query nova de salários proporcionais

Substitui as DUAS queries atuais (`salarioResult` ~5577 e `salDetalhesResult` ~5745). Uma única query passa a servir tanto `despesasMensais.salarios` quanto `salariosDetalhesPorSquad`.

```sql
WITH meses AS (
  SELECT generate_series(
    ${dataInicio}::date,
    (${dataInicio}::date + INTERVAL '11 months')::date,
    INTERVAL '1 month'
  )::date AS mes_inicio
),
meses_calc AS (
  SELECT
    mes_inicio,
    (mes_inicio + INTERVAL '1 month - 1 day')::date AS mes_fim,
    EXTRACT(DAY FROM (mes_inicio + INTERVAL '1 month - 1 day'))::int AS dias_no_mes
  FROM meses
),
colaboradores AS (
  SELECT
    rp.id,
    rp.nome AS colaborador_nome,
    COALESCE(NULLIF(TRIM(rp.squad), ''), 'Sem Squad') AS squad,
    rp.admissao,
    rp.demissao,
    CASE
      WHEN rp.salario IS NULL OR TRIM(rp.salario::text) = '' THEN NULL
      WHEN rp.salario::text LIKE '%,%' THEN
        NULLIF(REPLACE(REGEXP_REPLACE(rp.salario::text, '[^0-9,]', '', 'g'), ',', '.'), '')::numeric
      WHEN rp.salario::text ~ '\.[0-9]{1,2}$' THEN
        NULLIF(REGEXP_REPLACE(rp.salario::text, '[^0-9.]', '', 'g'), '')::numeric
      ELSE
        NULLIF(REGEXP_REPLACE(rp.salario::text, '[^0-9]', '', 'g'), '')::numeric
    END AS salario
  FROM "Inhire".rh_pessoal rp
  WHERE rp.admissao IS NOT NULL
)
SELECT
  c.id,
  c.colaborador_nome,
  c.squad,
  TO_CHAR(m.mes_inicio, 'YYYY-MM') AS mes,
  ROUND(
    c.salario
    * (LEAST(m.mes_fim, COALESCE(c.demissao, m.mes_fim))::date
       - GREATEST(m.mes_inicio, c.admissao)::date + 1)::numeric
    / m.dias_no_mes,
    2
  ) AS salario_proporcional
FROM colaboradores c
CROSS JOIN meses_calc m
WHERE c.salario IS NOT NULL
  AND c.salario > 0
  AND LEAST(m.mes_fim, COALESCE(c.demissao, m.mes_fim))
      >= GREATEST(m.mes_inicio, c.admissao)
  AND (
    ${squadFilter}::text IS NULL
    OR COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad') = ${squadFilter}
    OR COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad')
       ILIKE '%' || REGEXP_REPLACE(${squadFilter || ''}, '^[^a-zA-Z]+', '', 'g')
    OR ${squadFilter || ''}
       ILIKE '%' || REGEXP_REPLACE(COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad'), '^[^a-zA-Z]+', '', 'g')
  )
ORDER BY c.squad, c.colaborador_nome, mes;
```

**Observação importante sobre o filtro de squad:** o filtro deve ser aplicado na query de detalhes apenas quando há filtro ativo (`squadFilter !== null`), assim como hoje. Quando `squadFilter` é null, todos os colaboradores entram e o JS distribui para os squads via `findRevenueSquad`.

### Agregação no JS

```ts
// 1. Inicializar despesasMensais (sem cxcs)
const despesasMensais: Record<string, { salarios: number; freelancers: number }> = {};
for (let m = 0; m < 12; m++) {
  const mesKey = `${ano}-${String(m + 1).padStart(2, '0')}`;
  despesasMensais[mesKey] = {
    salarios: 0,
    freelancers: freelaPorMes.get(mesKey) || 0,
  };
}

// 2. Agregar por colaborador (porMes) e por mês (total despesasMensais)
type ColabAgg = { nome: string; squad: string; porMes: number[]; total: number };
const salariosPorColab = new Map<number, ColabAgg>();

for (const row of salarioRows) {
  const id = Number(row.id);
  const mes = row.mes as string;
  const valor = Number(row.salario_proporcional) || 0;

  // Total mensal de salários
  if (despesasMensais[mes]) {
    despesasMensais[mes].salarios += valor;
  }

  // Detalhe por colaborador
  if (!salariosPorColab.has(id)) {
    salariosPorColab.set(id, {
      nome: row.colaborador_nome,
      squad: row.squad || 'Sem Squad',
      porMes: new Array(12).fill(0),
      total: 0,
    });
  }
  const entry = salariosPorColab.get(id)!;
  const monthIdx = parseInt(mes.split('-')[1]) - 1;
  entry.porMes[monthIdx] = valor;
  entry.total += valor;
}

// 3. Distribuir colaboradores por squad de receita (mantém findRevenueSquad)
const salariosDetalhesPorSquad: Record<string, { nome: string; porMes: number[]; total: number }[]> = {};
for (const colab of salariosPorColab.values()) {
  const normKey = stripEmoji(colab.squad);
  const matchedSquad = findRevenueSquad(normKey) || colab.squad;
  if (!salariosDetalhesPorSquad[matchedSquad]) salariosDetalhesPorSquad[matchedSquad] = [];
  salariosDetalhesPorSquad[matchedSquad].push({
    nome: colab.nome,
    porMes: colab.porMes,
    total: colab.total,
  });
}
// Ordenar por total desc
for (const sq of Object.keys(salariosDetalhesPorSquad)) {
  salariosDetalhesPorSquad[sq].sort((a, b) => b.total - a.total);
}
```

### Remoções no backend
1. Query `cxcsResult` e variável `mediaCxcs` (~5621-5628). **Remover totalmente.**
2. Query `salarioResult` antiga (~5577-5606) — substituída pela proporcional acima.
3. Query `salDetalhesResult` (~5745-5768) — agora é a mesma query proporcional (sem `squadFilter`).
4. Loop `salariosPorColab` antigo (~5609-5618).
5. Variável `salarioTotal` — não existe mais como conceito (cada mês tem seu próprio total).
6. Campo `cxcs` em `despesasMensais`.

### Logging
Adicionar `console.warn` quando houver colaboradores com `admissao IS NULL` para detectar dados sujos sem quebrar o relatório:

```ts
const semAdmissao = await db.execute(sql`
  SELECT COUNT(*)::int AS qtd FROM "Inhire".rh_pessoal
  WHERE admissao IS NULL AND status ILIKE 'ativo'
`);
const qtdSemAdmissao = (semAdmissao.rows[0] as any)?.qtd || 0;
if (qtdSemAdmissao > 0) {
  console.warn(`[contribuicao-squad] ${qtdSemAdmissao} colaborador(es) ativo(s) sem data de admissão — não entram no cálculo proporcional.`);
}
```

---

## Edge cases tratados

| Caso | Comportamento |
|------|---------------|
| `admissao IS NULL` | Colaborador descartado no CTE. Logado via warn. |
| `demissao IS NULL` | Tratado como ativo até `mes_fim` via `COALESCE`. |
| `admissao > demissao` (dado inválido) | Subtração negativa, filtro `WHERE LEAST >= GREATEST` exclui. |
| Admissão em dezembro do ano | Só dezembro devolve linha proporcional. Jan-nov ausentes (somam zero). |
| Demissão antes do ano selecionado | Nenhuma linha devolvida — colaborador some do ano. |
| Admissão depois do ano selecionado | Nenhuma linha devolvida. |
| Salário em formato sujo (vírgula, R$, etc.) | Reaproveita normalização `CASE` existente. |
| Squad em branco | `COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')`. |
| Match RH↔Receita com emojis | Mantém `findRevenueSquad` existente. |
| Filtro de squad no dropdown | Aplicado dentro da CTE de colaboradores. |

---

## Limitações conhecidas (não resolvidas neste ciclo)

1. **Mudanças de squad no meio do ano não são reconstruídas.** Usamos sempre `rh_pessoal.squad` atual. Se um colaborador migrou de squad em jul/2026, jan-jun aparecem já no squad novo.
2. **Promoções não são reconstruídas.** Usamos sempre `rh_pessoal.salario` atual. Se houve aumento em jul/2026, jan-jun usam o salário novo.
3. **Dias corridos, não dias úteis.** A base é 30/31/28/29 dias do calendário, não dias úteis com feriados.

Caso futuramente seja necessário corrigir (1) ou (2), a fonte natural seria reconstruir o histórico via `rh_promocoes` (que tem `data_promocao`, `salario_anterior`, `salario_novo`) e/ou criar uma tabela `rh_squad_historico`. Fora do escopo agora.

---

## Plano de validação

Antes de considerar feito:

1. **Sanity check no banco de produção:**
   ```sql
   -- Soma anual proporcional
   SELECT SUM(salario_proporcional) FROM (<query nova>) x;
   -- vs soma linear atual (12x salário ativo)
   SELECT SUM(salario_normalizado) * 12 FROM "Inhire".rh_pessoal WHERE status='ativo';
   ```
   A soma proporcional deve ser **menor ou próxima** da linear (a diferença vem de demitidos no ano e admitidos no meio do ano).

2. **Validação manual de 2 colaboradores conhecidos** (1 admitido em meio do ano, 1 demitido em meio do ano): calcular à mão `salario × dias_ativos / dias_no_mes` no mês do evento e bater com a query.

3. **Frontend (browser, dark + light):**
   - Hero "Total Despesas" tem novo valor coerente (sem impostos, sem CXCs).
   - Linha "Salários" no rodapé tem valores **diferentes mês a mês** (não constante).
   - Drilldown de colaborador admitido em meio do ano: zeros nos meses anteriores, proporcional no mês de admissão, valor cheio depois.
   - Drilldown de colaborador demitido: valor cheio antes, proporcional no mês de demissão, zeros depois.
   - Linhas "Impostos" e "CXCs" sumiram do drilldown de Despesas.
   - Input de alíquota sumiu do header.
   - Total de Despesas e Margem batem com soma das linhas visíveis.

4. **Restart do dev server** (`npm run dev`) é obrigatório por mudança de backend.

Sem testes automatizados — toda a lógica vive em SQL e a validação é manual. Criar vitest para isso seria over-engineering.

---

## Próximos passos

Plano de implementação detalhado em `docs/superpowers/plans/2026-04-10-contribuicao-squad-despesas.md`.
