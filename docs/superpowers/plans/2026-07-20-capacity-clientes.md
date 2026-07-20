# Capacity por Clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar a régua de clientes distintos (`Clientes`, `Cap. Clientes`, `Δ Clientes`, `% Clientes`) às quatro abas de `/capacity-times`, com meta própria editável.

**Architecture:** O endpoint `GET /api/capacity-times` monta quatro queries SQL independentes (Squadra+Selva, CXCS, Black, squads de CS) e converte as linhas cruas em rows tipadas através de helpers puros em `capacityTimes.helpers.ts`. Cada query passa a expor `clientes_*` (`COUNT(DISTINCT c.id_task)`) e `cap_clientes`; os helpers derivam `dif_clientes` e `util_clientes_pct` reusando `diff()`/`utilPct()`; a página renderiza as quatro colunas novas. A meta vem de uma coluna nova em `cortex_core.capacity_metas`, criada de forma idempotente no boot.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`\`)`), PostgreSQL, React + React Query, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-capacity-clientes-design.md`

## Global Constraints

- Cliente = `"Clickup".cup_contratos.id_task`, que casa com `"Clickup".cup_clientes.task_id`. Contagem sempre `COUNT(DISTINCT c.id_task)`.
- Nenhum filtro de status novo: cada query herda os status que já usa hoje.
- Convenção de sinal preservada: `dif = cap - atual` (positivo = folga = verde; negativo = estouro = vermelho); `null` renderiza `"—"`, nunca `0` nem `NaN`.
- Dark/light mode obrigatório em toda classe Tailwind nova (`dark:` variant).
- Migration idempotente via `ADD COLUMN IF NOT EXISTS` em `server/db.ts`, seguindo o padrão do projeto (roda no boot em local e prod).
- Commits em Conventional Commits, com `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Rodar testes com `npx vitest run <arquivo>`; typecheck com `npm run check` (a baseline de `server/storage.ts` já tem erros pré-existentes — ignore-os, garanta apenas que nenhum erro cite `capacity`).

---

### Task 1: Restaurar a suíte de helpers ao verde

`server/routes/capacityTimes.helpers.test.ts` está **vermelho na baseline**: 12 de 22 testes falham porque importam `parseAggRow`, `buildResponse` e `CapacityAggRow`, que não existem mais no módulo, e porque `toCsRow` não devolve mais `util_mrr_pct`. Sem essa limpeza não há TDD possível nas tasks seguintes.

**Files:**
- Modify: `server/routes/capacityTimes.helpers.test.ts`

- [ ] **Step 1: Confirmar a baseline vermelha**

Run: `npx vitest run server/routes/capacityTimes.helpers.test.ts`
Expected: FAIL — 12 testes falhando, com erros do tipo `parseAggRow is not a function` e `expected undefined to be null`.

- [ ] **Step 2: Corrigir o import do topo do arquivo**

Substitua o bloco de import (linhas 1-5) por:

```typescript
import { describe, it, expect } from "vitest";
import { utilPct, diff, num, numOrNull, toCsRow } from "./capacityTimes.helpers";
```

Importe apenas o que os testes remanescentes usam — a Task 3 acrescenta `toComercialRow` e `toSelvaRow` ao import quando passar a precisar deles.

- [ ] **Step 3: Remover os blocos de teste de APIs mortas**

Apague inteiramente os blocos `describe("parseAggRow", ...)` e `describe("buildResponse", ...)`. Eles testam funções que não existem mais no módulo.

- [ ] **Step 4: Corrigir o teste de toCsRow que espera util_mrr_pct**

`toCsRow` devolve `util_fat_pct` (preenchido depois por `finalizeSquad`), não `util_mrr_pct`. Substitua o teste que hoje falha na linha ~131 por:

```typescript
  it("util_fat_pct nasce null (preenchido por finalizeSquad) e util_contas_pct é null sem cap", () => {
    const r = toCsRow({ nome: "Brenda", op_recorrente: 10, op_pontual: 2, mrr_operando: 5000, cap_contratos: null });
    expect(r.util_fat_pct).toBeNull();
    expect(r.util_contas_pct).toBeNull();
  });
```

- [ ] **Step 5: Rodar a suíte inteira e verificar verde**

Run: `npx vitest run server/routes/capacityTimes.helpers.test.ts`
Expected: PASS — 0 falhas. Se algum teste remanescente ainda falhar, ajuste-o à API real do módulo (leia `capacityTimes.helpers.ts` para conferir os nomes de campo) — não altere o código de produção nesta task.

- [ ] **Step 6: Commit**

```bash
git add server/routes/capacityTimes.helpers.test.ts
git commit -m "test(capacity): alinha suíte de helpers à API atual

Remove testes de parseAggRow/buildResponse (funções que não existem
mais) e corrige a expectativa de util_fat_pct em toCsRow. Baseline
volta ao verde para permitir TDD das colunas de clientes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Coluna cap_clientes no banco e no CRUD

**Files:**
- Modify: `server/db.ts:2520-2542` (função `initializeCapacityMetasTable`)
- Modify: `server/routes/capacity.ts:30-40` (`capacityMetaSchema`), `:450-464` (`normalizeMetaRow`), `:469-474` (GET), `:516-522` (POST), `:543-548` (PUT)

**Interfaces:**
- Produces: coluna `cortex_core.capacity_metas.cap_clientes INTEGER NULL`; o campo `cap_clientes: number | null` no payload de `/api/capacity-metas` (GET/POST/PUT).

- [ ] **Step 1: Adicionar o ALTER idempotente no boot**

Em `server/db.ts`, dentro de `initializeCapacityMetasTable`, logo após o `CREATE TABLE IF NOT EXISTS` e antes do `console.log`, insira:

```typescript
    // Meta de clientes distintos (régua separada da de contratos). Idempotente:
    // roda em todo boot, cria a coluna onde ainda não existe (local e prod).
    await db.execute(sql`
      ALTER TABLE cortex_core.capacity_metas
      ADD COLUMN IF NOT EXISTS cap_clientes INTEGER
    `);
```

- [ ] **Step 2: Adicionar cap_clientes ao schema de validação**

Em `server/routes/capacity.ts`, no `capacityMetaSchema`, adicione a linha após `cap_contas`:

```typescript
  cap_clientes: z.number().int().nonnegative().nullable(),
```

- [ ] **Step 3: Expor cap_clientes no normalizeMetaRow e no GET**

Em `normalizeMetaRow`, após a linha `cap_contas: numOrNull(r.cap_contas),`, adicione:

```typescript
      cap_clientes: numOrNull(r.cap_clientes),
```

No `SELECT` do `GET /api/capacity-metas`, troque a lista de colunas por:

```sql
        SELECT id, nome, match_responsavel, categoria,
               cap_recorrente, cap_mrr, cap_pontual, cap_contas, cap_clientes, ordem, ativo
        FROM cortex_core.capacity_metas
        ORDER BY ordem, nome
```

- [ ] **Step 4: Gravar cap_clientes no POST**

No `INSERT` do `POST /api/capacity-metas`, troque as duas linhas de colunas e valores por:

```sql
        INSERT INTO cortex_core.capacity_metas
          (nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, cap_clientes, ordem, ativo)
        VALUES (${m.nome}, ${m.match_responsavel}, ${m.categoria}, ${m.cap_recorrente},
                ${m.cap_mrr}, ${m.cap_pontual}, ${m.cap_contas}, ${m.cap_clientes}, ${m.ordem}, ${m.ativo})
        RETURNING id
```

- [ ] **Step 5: Gravar cap_clientes no PUT**

No `UPDATE` do `PUT /api/capacity-metas/:id`, na linha que hoje termina com `cap_contas = ${m.cap_contas},`, deixe:

```sql
          cap_pontual = ${m.cap_pontual}, cap_contas = ${m.cap_contas},
          cap_clientes = ${m.cap_clientes},
```

- [ ] **Step 6: Verificar que a coluna existe e o endpoint responde**

Reinicie o dev server (`PORT=3002 npm run dev`) e rode:

```bash
psql "$DATABASE_URL" -c "\d cortex_core.capacity_metas" | grep cap_clientes
```

Expected: uma linha mostrando `cap_clientes | integer`.

Se `psql` não estiver disponível, confirme pelo log de boot a ausência de `Error initializing capacity_metas table` e chame `curl -s localhost:3002/api/capacity-metas | head -c 300` (autenticado pela sessão do browser; se retornar 401, valide direto no banco).

- [ ] **Step 7: Typecheck e commit**

Run: `npm run check 2>&1 | grep -i capacity`
Expected: nenhuma saída.

```bash
git add server/db.ts server/routes/capacity.ts
git commit -m "feat(capacity): coluna cap_clientes em capacity_metas

Meta de clientes distintos, separada da meta de contratos, criada de
forma idempotente no boot e exposta no CRUD de /api/capacity-metas.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Campos de clientes nos helpers (TDD)

**Files:**
- Modify: `server/routes/capacityTimes.helpers.ts:28-68` (`ComercialRow`/`toComercialRow`), `:72-100` (`SelvaRow`/`toSelvaRow`), `:104-158` (`CsRow`/`toCsRow`/`finalizeSquad`)
- Test: `server/routes/capacityTimes.helpers.test.ts`

**Interfaces:**
- Consumes: `diff(cap, atual)` e `utilPct(atual, cap)` já existentes no módulo.
- Produces: em `ComercialRow`, `SelvaRow` e `CsRow`, os campos `clientes: number`, `cap_clientes: number | null`, `dif_clientes: number | null`, `util_clientes_pct: number | null`. Remove `util_pct` de `ComercialRow` e `CsRow` (permanece em `SelvaRow`). Chaves cruas lidas do pg: `clientes_rec` (Comercial/Cs), `clientes_total` (Selva), `cap_clientes` (todas).

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao fim de `server/routes/capacityTimes.helpers.test.ts`:

```typescript
describe("régua de clientes", () => {
  const baseComercial = {
    nome: "Ana", mrr_operando: 30000, cap_mrr: 40000,
    contas_rec: 18, cap_contas: 20, clientes_rec: 12, cap_clientes: 15,
  };

  it("toComercialRow deriva dif e % de clientes", () => {
    const r = toComercialRow(baseComercial);
    expect(r.clientes).toBe(12);
    expect(r.cap_clientes).toBe(15);
    expect(r.dif_clientes).toBe(3);
    expect(r.util_clientes_pct).toBe(80);
  });

  it("toComercialRow devolve null quando não há cap_clientes", () => {
    const r = toComercialRow({ ...baseComercial, cap_clientes: null });
    expect(r.clientes).toBe(12);
    expect(r.dif_clientes).toBeNull();
    expect(r.util_clientes_pct).toBeNull();
  });

  it("toComercialRow marca estouro com dif negativo", () => {
    const r = toComercialRow({ ...baseComercial, clientes_rec: 20 });
    expect(r.dif_clientes).toBe(-5);
    expect(r.util_clientes_pct).toBe(133.3);
  });

  it("toCsRow expõe a régua de clientes", () => {
    const r = toCsRow({
      nome: "Brenda", op_recorrente: 10, op_pontual: 2, mrr_operando: 5000,
      cap_contratos: 12, clientes_rec: 8, cap_clientes: 10,
    });
    expect(r.clientes).toBe(8);
    expect(r.dif_clientes).toBe(2);
    expect(r.util_clientes_pct).toBe(80);
  });

  it("toSelvaRow conta clientes da carteira (rec + pontual)", () => {
    const r = toSelvaRow({
      nome: "Caio", contas_total: 9, mrr_operando: 18000, pontual_operando: 2000,
      clientes_total: 6, cap_clientes: 8,
    }, 12);
    expect(r.clientes).toBe(6);
    expect(r.dif_clientes).toBe(2);
    expect(r.util_clientes_pct).toBe(75);
  });

  it("cap_clientes zero não divide por zero", () => {
    const r = toComercialRow({ ...baseComercial, cap_clientes: 0 });
    expect(r.util_clientes_pct).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e verificar que falham**

Run: `npx vitest run server/routes/capacityTimes.helpers.test.ts`
Expected: FAIL — os 6 testes novos falham com `expected undefined to be 12` (os campos ainda não existem); os testes da Task 1 continuam passando.

- [ ] **Step 3: Estender ComercialRow**

Em `capacityTimes.helpers.ts`, na interface `ComercialRow`, após `dif_contas`, adicione os campos e **remova** a linha `util_pct`:

```typescript
  clientes: number; // clientes distintos da carteira
  cap_clientes: number | null;
  dif_clientes: number | null;
```

E na lista de percentuais, após `util_contas_pct`:

```typescript
  util_clientes_pct: number | null; // clientes / cap_clientes
```

Em `toComercialRow`, após a linha `const cap_contas = numOrNull(raw.cap_contas);`:

```typescript
  const clientes = num(raw.clientes_rec ?? raw.clientes);
  const cap_clientes = numOrNull(raw.cap_clientes);
```

E no objeto retornado, após `dif_contas`, adicione as três linhas e **apague** a linha `util_pct: util_mrr_pct ?? utilPct(contas_ativas, cap_contas),` junto do comentário "Legado p/ alertas" acima dela:

```typescript
    clientes,
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
```

e, junto dos demais percentuais:

```typescript
    util_clientes_pct: utilPct(clientes, cap_clientes),
```

- [ ] **Step 4: Estender SelvaRow**

Na interface `SelvaRow`, após `cap_fat`, adicione (aqui `util_pct` **permanece**, é a coluna "% Ocupação"):

```typescript
  clientes: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_clientes_pct: number | null;
```

Em `toSelvaRow`, após `const cap_fat = ...;`:

```typescript
  const clientes = num(raw.clientes_total);
  const cap_clientes = numOrNull(raw.cap_clientes);
```

E no objeto retornado, antes de `util_pct`:

```typescript
    clientes,
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
    util_clientes_pct: utilPct(clientes, cap_clientes),
```

- [ ] **Step 5: Estender CsRow**

Na interface `CsRow`, após `cap_contratos`, adicione os três campos; junto dos percentuais adicione `util_clientes_pct`; e **remova** a linha `util_pct: number | null; // legado p/ alertas = util_fat_pct`:

```typescript
  clientes: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
```

```typescript
  util_clientes_pct: number | null; // clientes / cap_clientes
```

Em `toCsRow`, após `const cap_contratos = numOrNull(raw.cap_contratos);`:

```typescript
  const clientes = num(raw.clientes_rec);
  const cap_clientes = numOrNull(raw.cap_clientes);
```

No objeto retornado, adicione os campos e **apague** a linha `util_pct: null,`:

```typescript
    clientes,
    cap_clientes,
    dif_clientes: diff(cap_clientes, clientes),
```

```typescript
    util_clientes_pct: utilPct(clientes, cap_clientes),
```

Em `finalizeSquad`, **apague** a linha `r.util_pct = r.util_fat_pct;` (o campo não existe mais).

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run server/routes/capacityTimes.helpers.test.ts`
Expected: PASS — todos verdes, incluindo os 6 novos.

- [ ] **Step 7: Typecheck**

Run: `npm run check 2>&1 | grep -i capacity`
Expected: apenas erros em `client/src/pages/CapacityTimes.tsx` reclamando de `util_pct` — eles somem na Task 6. Nenhum erro nos arquivos de `server/routes/`.

- [ ] **Step 8: Commit**

```bash
git add server/routes/capacityTimes.helpers.ts server/routes/capacityTimes.helpers.test.ts
git commit -m "feat(capacity): régua de clientes nos helpers

Adiciona clientes, cap_clientes, dif_clientes e util_clientes_pct a
ComercialRow, SelvaRow e CsRow, reusando diff/utilPct. Remove o campo
util_pct de ComercialRow/CsRow, que só servia aos cards de alerta.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Contagem de clientes nas quatro queries

**Files:**
- Modify: `server/routes/capacity.ts:152-210` (Squadra + Selva), `:213-263` (CXCS), `:268-313` (Black), `:318-339` (squads de CS)

**Interfaces:**
- Produces: as colunas cruas que a Task 3 consome — `clientes_rec` (Squadra, CXCS, Black, CS), `clientes_total` (Selva) e `cap_clientes` (todas). No Black, `contas_rec` passa a ser a contagem de **subtasks**, não de clientes.

- [ ] **Step 1: Query Squadra + Selva — propagar id_task**

Na CTE `contratos_expanded`, inclua `c.id_task` no SELECT:

```sql
          SELECT c.id_subtask, c.id_task, TRIM(rp.part) AS responsavel_part,
                 COALESCE(c.valorr, 0) AS valorr, COALESCE(c.valorp, 0) AS valorp, c.status
```

Na CTE `best`, propague a coluna:

```sql
            p.nome AS pessoa, p.grupo, ce.id_subtask, ce.id_task, ce.valorr, ce.valorp, ce.status
```

- [ ] **Step 2: Query Squadra + Selva — contar clientes e ler o cap**

Na CTE `agg`, após a linha de `contas_rec`, adicione:

```sql
            COUNT(DISTINCT id_task) FILTER (WHERE valorr > 0 OR valorp > 0) AS clientes_total,
            COUNT(DISTINCT id_task) FILTER (WHERE valorr > 0) AS clientes_rec,
```

No `SELECT` final, troque a linha `cap.cap_mrr, cap.cap_contas` por:

```sql
          COALESCE(a.clientes_total, 0)    AS clientes_total,
          COALESCE(a.clientes_rec, 0)      AS clientes_rec,
          cap.cap_mrr, cap.cap_contas, cap.cap_clientes
```

E no `LEFT JOIN LATERAL`, troque o SELECT interno por:

```sql
          SELECT m.cap_mrr, m.cap_contas, m.cap_clientes
```

- [ ] **Step 3: Query CXCS — mesmas quatro mudanças**

Em `contratos_expanded`: `SELECT c.id_subtask, c.id_task, TRIM(rp.part) AS cs_part,`.
Em `best`: `p.nome AS pessoa, ce.id_subtask, ce.id_task, ce.valorr, ce.status`.
Em `agg`, após `contas_rec`: `COUNT(DISTINCT id_task) FILTER (WHERE valorr > 0) AS clientes_rec,`.
No `SELECT` final e no `LATERAL`, exponha `clientes_rec` e `cap_clientes`:

```sql
          COALESCE(a.clientes_rec, 0)     AS clientes_rec,
          cap.cap_mrr, cap.cap_contas, cap.cap_clientes
```

```sql
          SELECT m.cap_mrr, m.cap_contas, m.cap_clientes
```

- [ ] **Step 4: Query Black — separar contratos de clientes**

Hoje `contas_rec` recebe a contagem de clientes. Passa a receber subtasks reais, e a contagem de clientes vai para `clientes_rec`.

Na CTE `subs`, inclua o id da subtask:

```sql
          SELECT cda.label, c.id_subtask, COALESCE(c.valorr, 0) AS vr, c.status
```

Na CTE `agg`, adicione a contagem de contratos:

```sql
            COUNT(DISTINCT id_subtask) AS contratos,
```

No `SELECT` final, troque a linha `COALESCE(cli.clientes, 0) AS contas_rec,` e o bloco de caps por:

```sql
          COALESCE(ag.contratos, 0)        AS contas_rec,
          COALESCE(cli.clientes, 0)        AS clientes_rec,
          cap.cap_mrr,
          cap.cap_contas,
          COALESCE(cap.cap_clientes, ${CAP_CONTAS_ACCOUNT}) AS cap_clientes
```

O default `CAP_CONTAS_ACCOUNT` **migra de `cap_contas` para `cap_clientes`**: essa constante sempre foi a meta de clientes por account. `cap_contas` do Black fica sem default (exibe "—" até ser configurado na aba Configurar).

No `LEFT JOIN LATERAL`, exponha a coluna nova:

```sql
          SELECT m.cap_mrr, m.cap_contas, m.cap_clientes
```

- [ ] **Step 5: Query squads de CS**

Na CTE `m`, inclua a coluna:

```sql
          SELECT nome, categoria, match_responsavel,
                 COALESCE(cap_contas, cap_recorrente) AS cap_contratos, cap_clientes, ordem
```

Na CTE `agg`, adicione a contagem ao SELECT e a coluna ao `GROUP BY`:

```sql
            COUNT(DISTINCT c.id_task) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')) AS clientes_rec,
```

```sql
          GROUP BY m.nome, m.categoria, m.ordem, m.cap_contratos, m.cap_clientes
```

A primeira linha do `SELECT` do `agg` também precisa carregar a coluna — troque

```sql
          SELECT m.nome, m.categoria, m.ordem, m.cap_contratos,
```

por

```sql
          SELECT m.nome, m.categoria, m.ordem, m.cap_contratos, m.cap_clientes,
```

O `SELECT * FROM agg` do fim da query propaga `cap_clientes` e `clientes_rec` automaticamente.

- [ ] **Step 6: Validar o endpoint com dados reais**

Reinicie o dev server e chame o endpoint:

```bash
curl -s localhost:3002/api/capacity-times | python3 -m json.tool | head -60
```

Expected: cada row traz `clientes`, `cap_clientes`, `dif_clientes` e `util_clientes_pct`. Confira duas invariantes:

- em `squadra[0]`: `clientes` ≤ `contas_ativas` (um cliente pode ter várias subtasks)
- em `black[0]`: `contas_ativas` ≥ `clientes` e `cap_clientes` = valor de `CAP_CONTAS_ACCOUNT`

Se o endpoint retornar 401, autentique pelo browser em `localhost:3002` e repita, ou inspecione o payload pela aba Network.

- [ ] **Step 7: Commit**

```bash
git add server/routes/capacity.ts
git commit -m "feat(capacity): conta clientes distintos nas 4 queries

Cada query passa a expor clientes_rec/clientes_total (COUNT DISTINCT
id_task) e cap_clientes. No Black, Contratos passa a contar subtasks
reais e a contagem de clientes migra para a coluna própria, levando
junto o default CAP_CONTAS_ACCOUNT.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Campo Cap. Clientes na aba Configurar

**Files:**
- Modify: `client/src/components/capacity-times/CapacityMetaDialog.tsx:34-43` (tipo + `EMPTY`), `:85-91` (hidratação do form), `:181-184` (campos numéricos)
- Modify: `client/src/components/capacity-times/CapacityMetasConfig.tsx:16-27` (`CapacityMeta`), `:95` (cabeçalho), `:111` (célula)

**Interfaces:**
- Consumes: o campo `cap_clientes: number | null` do payload de `/api/capacity-metas` (Task 2).

- [ ] **Step 1: Adicionar cap_clientes ao tipo do dialog**

Em `CapacityMetaDialog.tsx`, na interface do form (junto de `cap_contas`, linha ~36):

```typescript
  cap_clientes: number | null;
```

E no objeto `EMPTY` (linha ~43), deixe:

```typescript
  cap_recorrente: null, cap_mrr: null, cap_pontual: null, cap_contas: null, cap_clientes: null,
```

- [ ] **Step 2: Hidratar o campo ao editar**

No bloco que copia a meta para o form (linha ~89-90), deixe:

```typescript
        cap_pontual: meta.cap_pontual, cap_contas: meta.cap_contas,
        cap_clientes: meta.cap_clientes,
```

- [ ] **Step 3: Renderizar o input**

Logo após a linha do campo `Cap. Contratos` (~184), adicione:

```tsx
            {numField(form.cap_clientes, (n) => setForm({ ...form, cap_clientes: n }), "Cap. Clientes", "meta-cap-clientes")}
```

- [ ] **Step 4: Adicionar a coluna na tabela de metas**

Em `CapacityMetasConfig.tsx`, na interface `CapacityMeta`, após `cap_contas`:

```typescript
  cap_clientes: number | null;
```

No cabeçalho, logo após `<TableHead className="text-right">Cap. Contas</TableHead>`:

```tsx
              <TableHead className="text-right">Cap. Clientes</TableHead>
```

E na linha do corpo, após a célula de `cap_contas`:

```tsx
                <TableCell className="text-right">{fmtCap(m.cap_clientes)}</TableCell>
```

- [ ] **Step 5: Testar o CRUD no browser**

Com o dev server rodando, abra `localhost:3002/capacity-times`, vá à aba Configurar, edite um operador, preencha **Cap. Clientes = 15** e salve. Verifique que a coluna "Cap. Clientes" da tabela mostra `15`, e recarregue a página para confirmar que persistiu. Confira em dark **e** light mode.

- [ ] **Step 6: Typecheck e commit**

Run: `npm run check 2>&1 | grep -i "CapacityMeta"`
Expected: nenhuma saída.

```bash
git add client/src/components/capacity-times/CapacityMetaDialog.tsx client/src/components/capacity-times/CapacityMetasConfig.tsx
git commit -m "feat(capacity): campo Cap. Clientes na aba Configurar

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Colunas de clientes nas tabelas da tela

**Files:**
- Modify: `client/src/pages/CapacityTimes.tsx` — interfaces (`:19-50`), `StatCards` (`:152-165`), `ComercialTable` (`:169-218`), `SelvaTable` (`:220-259`), `CsTable` (`:347-394`), e os `cards` de `ComercialTab` (`:269-277`), `SelvaTab` (`:296-303`) e `SquadTab` (`:404-412`)

**Interfaces:**
- Consumes: `clientes`, `cap_clientes`, `dif_clientes`, `util_clientes_pct` de cada row (Task 3); helpers locais já existentes `numOrDash`, `pctText`, `avgOf`, `UtilBar`.

- [ ] **Step 1: Espelhar os campos nas interfaces do client**

Em `ComercialRow` (`:19-28`), adicione após `dif_contas` e **remova** a linha `util_pct: number | null;`:

```typescript
  clientes: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_clientes_pct: number | null;
```

Em `SelvaRow` (`:30-37`), adicione (mantendo `util_pct`, usado em "% Ocupação"):

```typescript
  clientes: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_clientes_pct: number | null;
```

Em `CsRow` (`:40-50`), adicione os mesmos quatro campos e **remova** a linha `util_pct: number | null;`.

- [ ] **Step 2: Acomodar 8 cards no StatCards**

Em `StatCards` (`:152`), troque a expressão do grid por:

```tsx
    <div className={cn(
      "grid grid-cols-2 sm:grid-cols-3 gap-3",
      cards.length >= 8 ? "lg:grid-cols-8" : cards.length >= 7 ? "lg:grid-cols-7" : "lg:grid-cols-6",
    )}>
```

- [ ] **Step 3: Colunas na ComercialTable**

No `TableHeader`, após `<TableHead ...>Δ Contratos</TableHead>`:

```tsx
            <TableHead className={th("text-right")} title="Clientes distintos da carteira">Clientes</TableHead>
            <TableHead className={th("text-right")} title="Meta de clientes configurada na aba Configurar">Cap. Clientes</TableHead>
            <TableHead className={th("text-right")}>Δ Clientes</TableHead>
```

E após `<TableHead ...>% Contratos</TableHead>`:

```tsx
            <TableHead className={th("text-right")} title="Clientes / Cap. Clientes">% Clientes</TableHead>
```

No `TableBody`, após a célula de `dif_contas`:

```tsx
              <TableCell className={td("text-right")}>{r.clientes}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_clientes)}</TableCell>
              <TableCell className={cn("text-right", r.dif_clientes === null ? "text-gray-400 dark:text-zinc-500" : r.dif_clientes < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{numOrDash(r.dif_clientes)}</TableCell>
```

E após a célula de `util_contas_pct`:

```tsx
              <TableCell className="text-right"><UtilBar pct={r.util_clientes_pct} /></TableCell>
```

- [ ] **Step 4: Colunas na CsTable**

No `TableHeader`, após `<TableHead ...>Pontual</TableHead>`:

```tsx
            <TableHead className={th("text-right")} title="Clientes distintos da carteira">Clientes</TableHead>
            <TableHead className={th("text-right")} title="Meta de clientes configurada na aba Configurar">Cap. Clientes</TableHead>
            <TableHead className={th("text-right")}>Δ Clientes</TableHead>
```

E após `<TableHead ...>% Contratos</TableHead>`:

```tsx
            <TableHead className={th("text-right")} title="Clientes / Cap. Clientes">% Clientes</TableHead>
```

No `TableBody`, após a célula de `op_pontual`:

```tsx
              <TableCell className={td("text-right")}>{r.clientes}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_clientes)}</TableCell>
              <TableCell className={cn("text-right", r.dif_clientes === null ? "text-gray-400 dark:text-zinc-500" : r.dif_clientes < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{numOrDash(r.dif_clientes)}</TableCell>
```

E após a célula de `util_contas_pct`:

```tsx
              <TableCell className="text-right"><UtilBar pct={r.util_clientes_pct} /></TableCell>
```

- [ ] **Step 5: Colunas na SelvaTable**

A Selva não tem colunas de contratos e continua sem elas. No `TableHeader`, após `<TableHead ...>Contas</TableHead>`:

```tsx
            <TableHead className={th("text-right")} title="Clientes distintos da carteira">Clientes</TableHead>
            <TableHead className={th("text-right")} title="Meta de clientes configurada na aba Configurar">Cap. Clientes</TableHead>
            <TableHead className={th("text-right")}>Δ Clientes</TableHead>
```

E após `<TableHead ...>% Ocupação</TableHead>`:

```tsx
            <TableHead className={th("text-right")} title="Clientes / Cap. Clientes">% Clientes</TableHead>
```

No `TableBody`, após a célula de `r.contas`:

```tsx
              <TableCell className={td("text-right")}>{r.clientes}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_clientes)}</TableCell>
              <TableCell className={cn("text-right", r.dif_clientes === null ? "text-gray-400 dark:text-zinc-500" : r.dif_clientes < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{numOrDash(r.dif_clientes)}</TableCell>
```

E, como última célula da linha (após a `UtilBar` de `util_pct`):

```tsx
              <TableCell className="text-right"><UtilBar pct={r.util_clientes_pct} /></TableCell>
```

- [ ] **Step 6: Card "Capacity Clientes (média)" nas três abas**

Em `ComercialTab`, após `const mediaContas = ...`:

```typescript
  const mediaClientes = avgOf(rows.map((r) => r.util_clientes_pct));
```

e ao fim do array `cards`:

```typescript
    { label: "Capacity Clientes (média)", value: pctText(mediaClientes), tone: utilColor(mediaClientes) },
```

Repita exatamente o mesmo par em `SquadTab` (após `const mediaContas = ...`) e em `SelvaTab` (após `const mediaOcup = ...`).

- [ ] **Step 7: Typecheck**

Run: `npm run check 2>&1 | grep -i capacity`
Expected: nenhuma saída — os erros de `util_pct` da Task 3 desaparecem aqui.

- [ ] **Step 8: Validar as quatro abas no browser**

Com o dev server rodando, abra `localhost:3002/capacity-times` e percorra Squadra, CXCS, Black, cada squad de CS e Selva. Confira:

- as colunas `Clientes`, `Cap. Clientes`, `Δ Clientes` e `% Clientes` aparecem em todas
- sem meta configurada, `Cap.`, `Δ` e `%` mostram `"—"` (nunca `0` ou `NaN`)
- no Black, `Contratos` ≥ `Clientes`
- Δ negativo em vermelho, positivo em verde
- dark **e** light mode

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/CapacityTimes.tsx
git commit -m "feat(capacity): colunas Clientes, Cap./Δ/% Clientes nas tabelas

Adiciona a régua de clientes às quatro abas, com card de média por aba
e grid de 8 colunas no StatCards. Remove o util_pct órfão das
interfaces de ComercialRow/CsRow.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verificação final

- [ ] `npx vitest run server/routes/capacityTimes.helpers.test.ts server/routes/capacityTimes.contratos.test.ts` → verde
- [ ] `npm run check 2>&1 | grep -i capacity` → sem saída
- [ ] As quatro abas conferidas em dark e light mode
- [ ] Deploy: a coluna `cap_clientes` é criada no boot pelo `ADD COLUMN IF NOT EXISTS`, então basta o deploy rodar `initializeCapacityMetasTable`. Confirmar no log de produção antes de anunciar a tela.
- [ ] Comunicar ao time que os valores de "Contratos" do Black mudaram de significado.
