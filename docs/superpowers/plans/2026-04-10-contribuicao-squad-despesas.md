# Contribuição por Squad — Despesas + Salários Proporcionais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover Impostos e CXCs da aba "Contribuição por Squad" e tornar o cálculo de salários proporcional às datas de admissão/demissão de cada colaborador.

**Architecture:** Uma única query SQL com `generate_series` + `GREATEST/LEAST` substitui as duas queries de salários atuais e devolve `(colaborador_id × mes) → salario_proporcional`. O JS agrega em duas estruturas: total mensal de salários (para `despesasMensais`) e detalhe por colaborador com array de 12 meses (para `salariosDetalhesPorSquad`). Frontend remove input de alíquota, linhas Impostos/CXCs e passa a ler `colab.porMes[i]` no drilldown.

**Tech Stack:** PostgreSQL (`generate_series`, CTEs), Drizzle ORM (`db.execute(sql\`...\`)`), Express, React + TypeScript, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-04-10-contribuicao-squad-despesas-design.md`

---

## File Structure

| Arquivo | O que faz no plano |
|---------|---------------------|
| `server/routes.ts` (~5341–5828) | Endpoint `/api/contribuicao-squad/dfc/bulk`. Substituir 2 queries de salário por 1, remover query de CXCs, ajustar agregação JS, mudar shape da resposta. |
| `client/src/pages/ContribuicaoSquad.tsx` (782 linhas) | Remover estado de imposto, input de alíquota, linhas Impostos/CXCs do drilldown, atualizar tipos, atualizar drilldown de salários para usar `porMes[]`. |

Sem novos arquivos. Toda a mudança vive nesses dois.

---

## Pré-validação (antes de codar)

### Task 0: Validar query SQL no banco de produção

**Files:**
- Nenhum (validação manual via psql)

- [ ] **Step 1: Conectar no banco de produção**

```bash
PGPASSWORD='<senha_prod>' psql -h 34.95.249.110 -U <user> -d dados_turbo
```

> Credenciais em `memory/reference_databases.md`. Se não conseguir conectar, usar localhost/cortex_dev como fallback.

- [ ] **Step 2: Rodar a query proporcional para 2026 e validar shape**

```sql
WITH meses AS (
  SELECT generate_series(
    '2026-01-01'::date,
    ('2026-01-01'::date + INTERVAL '11 months')::date,
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
ORDER BY c.squad, c.colaborador_nome, mes
LIMIT 30;
```

**Esperado:** rows com colunas `id, colaborador_nome, squad, mes ('2026-01' a '2026-12'), salario_proporcional`. Para colaboradores admitidos antes de 2026 e ainda ativos, o `salario_proporcional` deve ser igual ao salário cheio em todos os 12 meses.

- [ ] **Step 3: Validar 1 colaborador admitido em meio do ano**

Encontrar um caso real:

```sql
SELECT id, nome, admissao, demissao, salario
FROM "Inhire".rh_pessoal
WHERE admissao >= '2026-01-01' AND admissao <= '2026-12-31'
  AND status ILIKE 'ativo'
ORDER BY admissao
LIMIT 5;
```

Pegar o `id` e rodar a query principal com `WHERE c.id = <id>`. Conferir que:
- Meses anteriores ao mês de admissão **não aparecem** no resultado.
- Mês da admissão tem `salario_proporcional ≈ salario × (dias_restantes / dias_no_mes)`. Calcular à mão.
- Meses posteriores têm `salario_proporcional = salario` (cheio).

- [ ] **Step 4: Validar 1 colaborador demitido em meio do ano**

```sql
SELECT id, nome, admissao, demissao, salario
FROM "Inhire".rh_pessoal
WHERE demissao >= '2026-01-01' AND demissao <= '2026-12-31'
ORDER BY demissao DESC
LIMIT 5;
```

Mesma validação, espelhada: meses anteriores cheios, mês da demissão proporcional, meses posteriores ausentes.

- [ ] **Step 5: Comparar soma proporcional vs soma linear atual**

```sql
-- Soma anual proporcional (nova lógica)
WITH ... (mesma CTE)
SELECT SUM(salario_proporcional) AS soma_proporcional
FROM ...;

-- Soma linear atual (12x salário ativo)
SELECT SUM(
  CASE
    WHEN salario IS NULL OR TRIM(salario::text) = '' THEN 0
    WHEN salario::text LIKE '%,%' THEN
      COALESCE(NULLIF(REPLACE(REGEXP_REPLACE(salario::text, '[^0-9,]', '', 'g'), ',', '.'), '')::numeric, 0)
    WHEN salario::text ~ '\.[0-9]{1,2}$' THEN
      COALESCE(NULLIF(REGEXP_REPLACE(salario::text, '[^0-9.]', '', 'g'), '')::numeric, 0)
    ELSE
      COALESCE(NULLIF(REGEXP_REPLACE(salario::text, '[^0-9]', '', 'g'), '')::numeric, 0)
  END
) * 12 AS soma_linear
FROM "Inhire".rh_pessoal
WHERE LOWER(TRIM(status)) = 'ativo';
```

**Esperado:** `soma_proporcional ≤ soma_linear` (a diferença vem de demitidos no ano e admitidos no meio do ano que não pegaram 12 meses cheios). Anotar os dois números para usar no checkpoint da Task 6.

- [ ] **Step 6: Contar colaboradores sem admissão**

```sql
SELECT COUNT(*) FROM "Inhire".rh_pessoal
WHERE admissao IS NULL AND LOWER(TRIM(status)) = 'ativo';
```

Anotar o número. Se >0, esses casos vão gerar warning no boot da query (Task 3).

---

## Backend

### Task 1: Substituir query de salários por versão proporcional

**Files:**
- Modify: `server/routes.ts:5577-5618` (remover `salarioResult` antiga, `salariosPorColab` antigo, `salarioTotal`)
- Modify: `server/routes.ts:5577` (inserir nova query)

- [ ] **Step 1: Localizar o bloco a substituir**

Abrir `server/routes.ts` e localizar o trecho que começa em `// Salários ativos do squad (rh_pessoal)` (~linha 5576) e vai até o fim do `for (const row of salarioResult.rows ...)` (~linha 5618).

- [ ] **Step 2: Substituir pela query proporcional + agregação**

Substituir todo o bloco identificado por:

```typescript
      // ──── DESPESAS: Salários proporcionais por admissão/demissão ────────────
      // Warning para colaboradores sem data de admissão (não entram no cálculo)
      const semAdmissaoResult = await db.execute(sql`
        SELECT COUNT(*)::int AS qtd
        FROM "Inhire".rh_pessoal
        WHERE admissao IS NULL AND LOWER(TRIM(status)) = 'ativo'
      `);
      const qtdSemAdmissao = Number((semAdmissaoResult.rows[0] as any)?.qtd) || 0;
      if (qtdSemAdmissao > 0) {
        console.warn(
          `[contribuicao-squad] ${qtdSemAdmissao} colaborador(es) ativo(s) sem data de admissão — não entram no cálculo proporcional.`
        );
      }

      // Query única: salário proporcional por (colaborador × mês) usando datas de admissão/demissão
      const salarioResult = await db.execute(sql`
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
        ORDER BY c.squad, c.colaborador_nome, mes
      `);

      // Agregar por colaborador (para detalhe) e por mês (para despesasMensais.salarios)
      type ColabAgg = { nome: string; squad: string; porMes: number[]; total: number };
      const salariosPorColab = new Map<number, ColabAgg>();
      const salariosPorMesMap = new Map<string, number>();

      for (const row of salarioResult.rows as any[]) {
        const id = Number(row.id);
        const mes = row.mes as string;
        const valor = Number(row.salario_proporcional) || 0;

        salariosPorMesMap.set(mes, (salariosPorMesMap.get(mes) || 0) + valor);

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
```

- [ ] **Step 3: Compilar (verificar erros TS)**

Run: `npx tsc --noEmit 2>&1 | grep -E "(routes\.ts|error)" | head -20`
Expected: nenhum erro novo em `server/routes.ts`. Erros pré-existentes em outros arquivos podem ser ignorados.

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "$(cat <<'EOF'
feat(contribuicao-squad): query de salário proporcional por admissão/demissão

Substitui as duas queries de salário (linear + detalhes) por uma única
query que devolve salário proporcional por (colaborador × mês) usando
generate_series e GREATEST/LEAST nas datas de admissão/demissão.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Remover query de CXCs e atualizar `despesasMensais`

**Files:**
- Modify: `server/routes.ts:5621-5628` (remover `cxcsResult` e `mediaCxcs`)
- Modify: `server/routes.ts:5683-5692` (ajustar montagem de `despesasMensais`)

- [ ] **Step 1: Remover query de CXCs**

Localizar e **deletar completamente** este bloco:

```typescript
      // CXCS (média salarial dos CXCS ativos)
      const cxcsResult = await db.execute(sql`
        SELECT AVG(salario::numeric) as media_cxcs
        FROM "Inhire".rh_pessoal
        WHERE UPPER(TRIM(cargo)) = 'CXCS'
          AND UPPER(TRIM(status)) = 'ATIVO'
          AND salario IS NOT NULL AND salario::numeric > 0
      `);
      const mediaCxcs = Number((cxcsResult.rows[0] as any)?.media_cxcs) || 0;
```

- [ ] **Step 2: Atualizar montagem de `despesasMensais`**

Localizar:

```typescript
      // Montar objeto de despesas mensais
      const despesasMensais: Record<string, { salarios: number; cxcs: number; freelancers: number }> = {};
      for (let m = 0; m < 12; m++) {
        const mesKey = `${ano}-${String(m + 1).padStart(2, '0')}`;
        despesasMensais[mesKey] = {
          salarios: salarioTotal,
          cxcs: mediaCxcs,
          freelancers: freelaPorMes.get(mesKey) || 0,
        };
      }
```

Substituir por:

```typescript
      // Montar objeto de despesas mensais
      const despesasMensais: Record<string, { salarios: number; freelancers: number }> = {};
      for (let m = 0; m < 12; m++) {
        const mesKey = `${ano}-${String(m + 1).padStart(2, '0')}`;
        despesasMensais[mesKey] = {
          salarios: salariosPorMesMap.get(mesKey) || 0,
          freelancers: freelaPorMes.get(mesKey) || 0,
        };
      }
```

- [ ] **Step 3: Compilar**

Run: `npx tsc --noEmit 2>&1 | grep -E "(routes\.ts|error)" | head -20`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "$(cat <<'EOF'
refactor(contribuicao-squad): remove cálculo de CXCs e linearização de salários

despesasMensais.salarios passa a vir do agregado proporcional por mês.
Campo cxcs removido do shape.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Substituir `salDetalhesResult` antiga e ajustar `salariosDetalhesPorSquad`

**Files:**
- Modify: `server/routes.ts:5744-5812` (remover query e loop antigos)

- [ ] **Step 1: Remover a query duplicada de salários**

Localizar o bloco que começa com `// Detalhes individuais de salários — query separada sem filtro de squad` (~5744) e vai até o final do `for (const row of salDetalhesResult.rows ...)` (~5812). Esse bloco inteiro vai ser substituído.

- [ ] **Step 2: Substituir pelo loop que reaproveita `salariosPorColab`**

Substituir o bloco identificado por:

```typescript
      // Detalhes individuais de salários — agregados a partir de salariosPorColab (Task 1)
      // Normalizar nome de squad removendo emojis/símbolos para match
      const stripEmoji = (s: string) =>
        s.replace(/[^\p{L}\p{N}\s.&+]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

      // Mapa: nome normalizado → nome original da receita
      const revenueSquadMap = new Map<string, string>();
      for (const s of resumoPorSquad) {
        revenueSquadMap.set(stripEmoji(s.squad), s.squad);
      }

      // Fallback: match parcial (um nome contém o outro) para squads como "Black" vs "Black Sheep"
      const findRevenueSquad = (normKey: string): string | null => {
        if (revenueSquadMap.has(normKey)) return revenueSquadMap.get(normKey)!;
        let bestMatch: string | null = null;
        let bestLen = 0;
        for (const [revNorm, revName] of revenueSquadMap) {
          if (normKey.startsWith(revNorm) || revNorm.startsWith(normKey)) {
            const matchLen = Math.min(normKey.length, revNorm.length);
            if (matchLen > bestLen) {
              bestLen = matchLen;
              bestMatch = revName;
            }
          }
        }
        return bestMatch;
      };

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
      // Ordenar por total desc dentro de cada squad
      for (const sq of Object.keys(salariosDetalhesPorSquad)) {
        salariosDetalhesPorSquad[sq].sort((a, b) => b.total - a.total);
      }
```

- [ ] **Step 3: Verificar que o `res.json` no final do handler ainda compila**

O response no final (`res.json({ ... salariosDetalhesPorSquad, ... })`) não muda de chave, só de shape. Não precisa editar.

Run: `npx tsc --noEmit 2>&1 | grep -E "(routes\.ts|error)" | head -20`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "$(cat <<'EOF'
refactor(contribuicao-squad): unifica detalhes de salário com agregação proporcional

Remove a segunda query de salários (salDetalhesResult) e reaproveita
salariosPorColab da Task 1 para construir salariosDetalhesPorSquad
com porMes[] em vez de salário único.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Smoke test do endpoint

**Files:**
- Nenhum (validação manual)

- [ ] **Step 1: Restart do dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Esperar 3-5s para o servidor estar pronto.

- [ ] **Step 2: Hit no endpoint via curl**

```bash
curl -s -b cookies.txt "http://localhost:3000/api/contribuicao-squad/dfc/bulk?ano=2026" | head -c 2000
```

> Se não tiver `cookies.txt`, fazer login primeiro pelo browser e exportar os cookies (ou autenticar via Postman/Thunder Client).

- [ ] **Step 3: Validar shape da resposta**

A resposta deve ter:
- `despesasMensais['2026-01']` com chaves `salarios` e `freelancers` (sem `cxcs`).
- `salariosDetalhesPorSquad` onde cada item tem `nome`, `porMes` (array de 12), `total`.

```bash
curl -s -b cookies.txt "http://localhost:3000/api/contribuicao-squad/dfc/bulk?ano=2026" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('despesasMensais keys:', list(d['despesasMensais']['2026-01'].keys())); print('detalhes sample:', list(d['salariosDetalhesPorSquad'].values())[0][0] if d['salariosDetalhesPorSquad'] else 'EMPTY')"
```

Expected:
```
despesasMensais keys: ['salarios', 'freelancers']
detalhes sample: {'nome': '...', 'porMes': [...12 numbers...], 'total': ...}
```

- [ ] **Step 4: Comparar soma com o que foi anotado na Task 0**

```bash
curl -s -b cookies.txt "http://localhost:3000/api/contribuicao-squad/dfc/bulk?ano=2026" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); total=sum(m['salarios'] for m in d['despesasMensais'].values()); print(f'Soma anual de salários: {total:.2f}')"
```

Expected: bate (±R$ 0,01) com `soma_proporcional` anotada na Task 0 Step 5. Se divergir, investigar antes de continuar.

- [ ] **Step 5: Sem commit (apenas validação)**

---

## Frontend

### Task 5: Atualizar tipos TypeScript

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx:35-46`

- [ ] **Step 1: Atualizar `DespesasMensais`**

Localizar (linhas 35-41):

```typescript
interface DespesasMensais {
  [mes: string]: {
    salarios: number;
    cxcs: number;
    freelancers: number;
  };
}
```

Substituir por:

```typescript
interface DespesasMensais {
  [mes: string]: {
    salarios: number;
    freelancers: number;
  };
}
```

- [ ] **Step 2: Atualizar `SalarioDetalhe`**

Localizar (linhas 43-46):

```typescript
interface SalarioDetalhe {
  nome: string;
  salario: number;
}
```

Substituir por:

```typescript
interface SalarioDetalhe {
  nome: string;
  porMes: number[];
  total: number;
}
```

- [ ] **Step 3: Compilar**

Run: `npx tsc --noEmit 2>&1 | grep "ContribuicaoSquad" | head -30`
Expected: vai mostrar erros de uso de `cxcs` e `colab.salario` que serão corrigidos nas próximas tasks. Anotar quantos.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "$(cat <<'EOF'
refactor(contribuicao-squad): atualiza tipos para salário proporcional

DespesasMensais perde campo cxcs.
SalarioDetalhe ganha porMes[] e total no lugar de salario único.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Remover estado e UI de imposto

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx:74-75` (remover `taxaImposto`, `taxaDecimal`)
- Modify: `client/src/pages/ContribuicaoSquad.tsx:291-303` (remover `<Input>` de alíquota)

- [ ] **Step 1: Remover estado de imposto**

Localizar:

```typescript
  const [taxaImposto, setTaxaImposto] = useState(18);
  const taxaDecimal = taxaImposto / 100;
```

**Deletar essas duas linhas.**

- [ ] **Step 2: Remover input do header**

Localizar o bloco `<div className="flex items-center gap-1.5">` que envolve o `<Input type="number" ... title="Alíquota de imposto (%)">`. **Deletar a div inteira.**

Antes:

```tsx
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={taxaImposto}
              onChange={(e) => setTaxaImposto(Number(e.target.value) || 0)}
              className="w-[70px] h-9 text-sm text-center"
              title="Alíquota de imposto (%)"
            />
          </div>
```

Depois: linha removida.

- [ ] **Step 3: Verificar import órfão de `Input`**

Run: `grep -c "<Input" client/src/pages/ContribuicaoSquad.tsx`
Se retornar `0`, remover a linha `import { Input } from "@/components/ui/input";` no topo do arquivo.

- [ ] **Step 4: Compilar**

Run: `npx tsc --noEmit 2>&1 | grep "ContribuicaoSquad" | head -30`
Expected: ainda há erros (uso de `taxaDecimal` e `cxcs`) que serão removidos na Task 7.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "$(cat <<'EOF'
refactor(contribuicao-squad): remove input e estado de alíquota de imposto

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Remover Impostos e CXCs dos cálculos e do drilldown

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx:151-176` (squadRanking)
- Modify: `client/src/pages/ContribuicaoSquad.tsx:179-234` (tableData)
- Modify: `client/src/pages/ContribuicaoSquad.tsx:308-312` (hero subtitle)
- Modify: `client/src/pages/ContribuicaoSquad.tsx:486-490` (array de despesas no drilldown por squad)
- Modify: `client/src/pages/ContribuicaoSquad.tsx:675-679` (array de despesas no drilldown total)

- [ ] **Step 1: Atualizar `squadRanking`**

Localizar:

```typescript
    let totalDespAnual = 0;
    for (const m of monthlyResults) {
      const receitaMes = bulkData.resumoPorSquad.reduce((acc, sq) => {
        const idx = monthlyResults.indexOf(m);
        return acc + (sq.porMes[idx] || 0);
      }, 0);
      const desp = bulkData.despesasMensais?.[m.mes];
      totalDespAnual += receitaMes * taxaDecimal + (desp?.salarios || 0) + (desp?.cxcs || 0) + (desp?.freelancers || 0);
    }
```

Substituir por:

```typescript
    let totalDespAnual = 0;
    for (const m of monthlyResults) {
      const desp = bulkData.despesasMensais?.[m.mes];
      totalDespAnual += (desp?.salarios || 0) + (desp?.freelancers || 0);
    }
```

> **Nota:** o loop interno que calculava `receitaMes` não é mais necessário porque imposto saiu.

- [ ] **Step 2: Atualizar `tableData` — `despesaTotalPorMes`**

Localizar:

```typescript
    // Despesa total por mês (impostos + salários + cxcs + freelancers)
    const despesaTotalPorMes = monthlyResults.map((m, i) => {
      const receitaMes = squadRanking.reduce((acc, sq) => acc + (sq.porMes[i] || 0), 0);
      const desp = bulkData?.despesasMensais?.[m.mes];
      return receitaMes * taxaDecimal + (desp?.salarios || 0) + (desp?.cxcs || 0) + (desp?.freelancers || 0);
    });
```

Substituir por:

```typescript
    // Despesa total por mês (salários + freelancers)
    const despesaTotalPorMes = monthlyResults.map((m) => {
      const desp = bulkData?.despesasMensais?.[m.mes];
      return (desp?.salarios || 0) + (desp?.freelancers || 0);
    });
```

- [ ] **Step 3: Remover `impostosPorMes` e `cxcsPorMes`**

Localizar e **deletar** estas duas linhas:

```typescript
    const impostosPorMes = monthlyResults.map((_, i) => receitaTotalPorMes[i] * taxaDecimal);
    const cxcsPorMes = monthlyResults.map((m) => bulkData?.despesasMensais?.[m.mes]?.cxcs || 0);
```

E remover do `return`:

```typescript
    return {
      despesaTotalPorMes,
      receitaTotalPorMes,
      despesaSquadMes,
      despesaComponenteSquadMes,
-     impostosPorMes,
      salariosPorMes,
-     cxcsPorMes,
      freelancersPorMes,
      ...
    };
```

- [ ] **Step 4: Atualizar subtitle do hero**

Localizar:

```typescript
{ label: "Total Despesas", value: formatCurrencyNoDecimals(tableData.totalDespesa), subtitle: "Despesas rateadas (impostos + salários + CXCs + freelancers)" },
```

Substituir o subtitle:

```typescript
{ label: "Total Despesas", value: formatCurrencyNoDecimals(tableData.totalDespesa), subtitle: "Despesas rateadas (salários + freelancers)" },
```

- [ ] **Step 5: Remover Impostos e CXCs do drilldown por squad**

Localizar (linhas ~486-490):

```typescript
                                  {[
                                    { label: "Impostos", data: tableData.impostosPorMes, expandable: false },
                                    { label: "Salários", data: tableData.salariosPorMes, expandable: true },
                                    { label: "CXCs", data: tableData.cxcsPorMes, expandable: false },
                                    { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
                                  ].map(({ label, data, expandable }) => {
```

Substituir por:

```typescript
                                  {[
                                    { label: "Salários", data: tableData.salariosPorMes, expandable: true },
                                    { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
                                  ].map(({ label, data, expandable }) => {
```

- [ ] **Step 6: Remover Impostos e CXCs do drilldown total (rodapé)**

Localizar (linhas ~675-679):

```typescript
                        {[
                          { label: "Impostos", data: tableData.impostosPorMes, expandable: false },
                          { label: "Salários", data: tableData.salariosPorMes, expandable: true },
                          { label: "CXCs", data: tableData.cxcsPorMes, expandable: false },
                          { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
                        ].map(({ label, data, expandable }) => {
```

Substituir por:

```typescript
                        {[
                          { label: "Salários", data: tableData.salariosPorMes, expandable: true },
                          { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
                        ].map(({ label, data, expandable }) => {
```

- [ ] **Step 7: Compilar**

Run: `npx tsc --noEmit 2>&1 | grep "ContribuicaoSquad" | head -30`
Expected: erros restantes só sobre `colab.salario` (próxima task).

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "$(cat <<'EOF'
refactor(contribuicao-squad): remove Impostos e CXCs do cálculo e drilldown

Despesa total = salários + freelancers. Drilldown reduzido a 2 linhas.
Subtitle do hero ajustado.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Drilldown de salários usar `porMes[]` e `total`

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx:520-535` (drilldown por squad)
- Modify: `client/src/pages/ContribuicaoSquad.tsx:706-721` (drilldown total)

- [ ] **Step 1: Atualizar drilldown por squad**

Localizar (linhas ~520-535):

```tsx
                                        {isExpanded && (bulkData?.salariosDetalhesPorSquad?.[sq.squad] || []).map((colab, idx) => (
                                          <tr key={`${colab.nome}-${idx}`} className="border-b border-border/10">
                                            <td className="py-0.5 px-3 pl-[72px] text-[10px] text-red-400/50 dark:text-red-400/35 sticky left-0 z-10 bg-background truncate max-w-[160px]" title={colab.nome}>
                                              {colab.nome}
                                            </td>
                                            {monthlyResults.map((_, i) => (
                                              <td key={i} className="py-0.5 px-2 text-right text-[10px] text-red-400/50 dark:text-red-400/35">
                                                {colab.salario > 0 ? formatCurrencyNoDecimals(colab.salario) : "-"}
                                              </td>
                                            ))}
                                            <td className="py-0.5 px-3 text-right text-[10px] font-medium text-red-400/50 dark:text-red-400/35">
                                              {formatCurrencyNoDecimals(colab.salario)}
                                            </td>
                                            <td />
                                          </tr>
                                        ))}
```

Substituir por:

```tsx
                                        {isExpanded && (bulkData?.salariosDetalhesPorSquad?.[sq.squad] || []).map((colab, idx) => (
                                          <tr key={`${colab.nome}-${idx}`} className="border-b border-border/10">
                                            <td className="py-0.5 px-3 pl-[72px] text-[10px] text-red-400/50 dark:text-red-400/35 sticky left-0 z-10 bg-background truncate max-w-[160px]" title={colab.nome}>
                                              {colab.nome}
                                            </td>
                                            {monthlyResults.map((_, i) => (
                                              <td key={i} className="py-0.5 px-2 text-right text-[10px] text-red-400/50 dark:text-red-400/35">
                                                {colab.porMes[i] > 0 ? formatCurrencyNoDecimals(colab.porMes[i]) : "-"}
                                              </td>
                                            ))}
                                            <td className="py-0.5 px-3 text-right text-[10px] font-medium text-red-400/50 dark:text-red-400/35">
                                              {formatCurrencyNoDecimals(colab.total)}
                                            </td>
                                            <td />
                                          </tr>
                                        ))}
```

- [ ] **Step 2: Atualizar drilldown total (rodapé)**

Localizar (linhas ~706-721):

```tsx
                              {isExpanded && Object.values(bulkData?.salariosDetalhesPorSquad || {}).flat().sort((a, b) => b.salario - a.salario).map((colab, idx) => (
                                <tr key={`${colab.nome}-${idx}`} className="border-b border-border/10 bg-muted">
                                  <td className="py-0.5 px-3 pl-[72px] text-[10px] text-red-400/50 dark:text-red-400/35 font-medium sticky left-0 z-10 bg-muted truncate max-w-[160px]" title={colab.nome}>
                                    {colab.nome}
                                  </td>
                                  {monthlyResults.map((_, i) => (
                                    <td key={i} className="py-0.5 px-2 text-right text-[10px] text-red-400/50 dark:text-red-400/35">
                                      {colab.salario > 0 ? formatCurrencyNoDecimals(colab.salario) : "-"}
                                    </td>
                                  ))}
                                  <td className="py-0.5 px-3 text-right text-[10px] font-medium text-red-400/50 dark:text-red-400/35">
                                    {formatCurrencyNoDecimals(colab.salario)}
                                  </td>
                                  <td />
                                </tr>
                              ))}
```

Substituir por:

```tsx
                              {isExpanded && Object.values(bulkData?.salariosDetalhesPorSquad || {}).flat().sort((a, b) => b.total - a.total).map((colab, idx) => (
                                <tr key={`${colab.nome}-${idx}`} className="border-b border-border/10 bg-muted">
                                  <td className="py-0.5 px-3 pl-[72px] text-[10px] text-red-400/50 dark:text-red-400/35 font-medium sticky left-0 z-10 bg-muted truncate max-w-[160px]" title={colab.nome}>
                                    {colab.nome}
                                  </td>
                                  {monthlyResults.map((_, i) => (
                                    <td key={i} className="py-0.5 px-2 text-right text-[10px] text-red-400/50 dark:text-red-400/35">
                                      {colab.porMes[i] > 0 ? formatCurrencyNoDecimals(colab.porMes[i]) : "-"}
                                    </td>
                                  ))}
                                  <td className="py-0.5 px-3 text-right text-[10px] font-medium text-red-400/50 dark:text-red-400/35">
                                    {formatCurrencyNoDecimals(colab.total)}
                                  </td>
                                  <td />
                                </tr>
                              ))}
```

- [ ] **Step 3: Compilar — esperar zero erros**

Run: `npx tsc --noEmit 2>&1 | grep "ContribuicaoSquad"`
Expected: nenhum output (zero erros no arquivo).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "$(cat <<'EOF'
feat(contribuicao-squad): drilldown de salários por mês usando porMes[]

Cada coluna mensal exibe o salário proporcional do colaborador
naquele mês. Total da linha vira soma anual proporcional.
Ordenação do total agora por colab.total desc.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Validação final

### Task 9: Validação manual no browser

**Files:**
- Nenhum (validação manual)

- [ ] **Step 1: Restart do dev server e abrir a aba**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Abrir `http://localhost:3000`, fazer login, navegar até **Contribuição por Squad**.

- [ ] **Step 2: Hero "Total Despesas" tem novo valor**

Comparar mentalmente com o valor antigo (que incluía impostos + CXCs). O novo valor deve ser **menor**. Subtitle deve dizer "Despesas rateadas (salários + freelancers)".

- [ ] **Step 3: Input de alíquota sumiu do header**

Confirmar que não há mais campo numérico de imposto ao lado dos selects.

- [ ] **Step 4: Linha "Salários" no rodapé tem valores diferentes mês a mês**

Expandir Despesas no rodapé (TOTAL). A linha "Salários" não pode mais exibir o mesmo número em todos os 12 meses. Deve haver variação (mesmo que pequena) refletindo admissões/demissões do ano.

- [ ] **Step 5: Linhas Impostos e CXCs sumiram**

No drilldown de Despesas (em qualquer squad e no rodapé), só devem aparecer as linhas **Salários** e **Freelancers**.

- [ ] **Step 6: Drilldown de colaborador admitido em meio do ano**

Expandir um squad → expandir Despesas → expandir Salários. Procurar um colaborador que sabidamente foi admitido em 2026 (usar o que foi identificado na Task 0 Step 3).

Verificar:
- Meses anteriores ao mês de admissão: `-` ou zero.
- Mês de admissão: valor proporcional (menor que salário cheio).
- Meses posteriores: valor cheio.

- [ ] **Step 7: Drilldown de colaborador demitido em meio do ano**

Mesma validação espelhada com o caso da Task 0 Step 4.

- [ ] **Step 8: Dark mode + light mode**

Alternar tema. Confirmar que todas as linhas continuam legíveis (cores `dark:` ainda aplicadas).

- [ ] **Step 9: Margem bate**

Para 1 squad qualquer, conferir mentalmente: `Receita - Despesa = Margem` em pelo menos 1 mês. A margem mostrada deve ser consistente com `receita - (salarios + freelancers)` rateados.

- [ ] **Step 10: Filtro por squad continua funcionando**

Selecionar um squad específico no dropdown do header. A página deve recarregar mostrando só esse squad. Salários proporcionais devem aparecer só dos colaboradores daquele squad.

- [ ] **Step 11: Sem commit (apenas validação)**

Se algum passo falhar, voltar à task correspondente. Se tudo passar, prosseguir para Task 10.

---

### Task 10: Atualizar Obsidian + Cortex DB (workflow obrigatório pós-task)

**Files:**
- Conforme `memory/MEMORY.md` (workflow pós-conclusão)

- [ ] **Step 1: Push final**

```bash
git push
```

- [ ] **Step 2: Verificar se há chamado vinculado no Cortex**

Esta tarefa veio de pedido direto do usuário (não de chamado). Pular update de chamado.

- [ ] **Step 3: Sem commit adicional**

Plano completo.

---

## Resumo de commits esperados

| # | Task | Mensagem |
|---|------|----------|
| 1 | Task 1 | feat(contribuicao-squad): query de salário proporcional por admissão/demissão |
| 2 | Task 2 | refactor(contribuicao-squad): remove cálculo de CXCs e linearização de salários |
| 3 | Task 3 | refactor(contribuicao-squad): unifica detalhes de salário com agregação proporcional |
| 4 | Task 5 | refactor(contribuicao-squad): atualiza tipos para salário proporcional |
| 5 | Task 6 | refactor(contribuicao-squad): remove input e estado de alíquota de imposto |
| 6 | Task 7 | refactor(contribuicao-squad): remove Impostos e CXCs do cálculo e drilldown |
| 7 | Task 8 | feat(contribuicao-squad): drilldown de salários por mês usando porMes[] |

Tasks 0, 4, 9 e 10 não geram commit (validação/operacional).
