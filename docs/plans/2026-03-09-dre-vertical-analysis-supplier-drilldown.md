# DRE Vertical Analysis + Supplier Drill-down Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change DRE's AV% base to Faturamento Bruto (receita_bruta_operacional) and add inline supplier drill-down for expense categories in grouped view.

**Architecture:** Two changes — (1) Frontend-only AV% base swap, (2) Backend adds supplier data via JOIN with caz_clientes, frontend adds expandable supplier rows under child expense categories.

**Tech Stack:** TypeScript, React, Express, Drizzle ORM (raw SQL), Tailwind CSS

---

### Task 1: Change AV% base from Receita Líquida Total to Receita Bruta Operacional

**Files:**
- Modify: `client/src/pages/DRE.tsx:283-292`

**Step 1: Update the AV% base variables**

Replace lines 283-292:

```tsx
// AV% base: Faturamento Bruto (Receita Bruta Operacional)
const receitaBruta = useMemo(() => {
  if (!data) return emptyMonthsRecord();
  return data.subtotais.receita_bruta_operacional;
}, [data]);

const receitaBrutaAcum = useMemo(() => {
  if (!data) return 0;
  return computeAccumulated(data.subtotais.receita_bruta_operacional);
}, [data]);
```

**Step 2: Rename all references**

Find and replace throughout DRE.tsx:
- `receitaLiquidaTotal[mk]` → `receitaBruta[mk]`
- `receitaLiquidaTotalAcum` → `receitaBrutaAcum`

These appear at lines: 518, 523, 625, 630, 670, 682.

**Step 3: Verify visually**

Run the app and check that AV% values now use Receita Bruta as denominator.

**Step 4: Commit**

```bash
git add client/src/pages/DRE.tsx
git commit -m "feat(dre): change AV% base from Receita Líquida Total to Faturamento Bruto"
```

---

### Task 2: Backend — Add supplier data to DRE response

**Files:**
- Modify: `server/routes/dre.ts:5-14` (DRELineItem interface)
- Modify: `server/routes/dre.ts:68-92` (SQL query)
- Modify: `server/routes/dre.ts:109-153` (processing loop)

**Step 1: Add fornecedor interface and extend DRELineItem**

Add after line 14 (after DRELineItem interface closing brace):

```typescript
interface DREFornecedor {
  nome: string;
  valores: Record<string, number>; // mes_01..mes_12 + acumulado
}
```

Add to DRELineItem interface (after `valores` field, line 13):

```typescript
  fornecedores?: DREFornecedor[];
```

**Step 2: Add a second query to fetch supplier-level data for expenses**

After the main query result processing (after line 153, after `const linhas = ...`), add a new query:

```typescript
// Fetch supplier-level detail for expense categories
const fornecedorResult = await db.execute(sql`
  WITH categorias_expandidas AS (
    SELECT DISTINCT ON (p.id, REGEXP_REPLACE(TRIM(cat.categoria), '\s+', ' ', 'g'))
      p.id,
      REGEXP_REPLACE(TRIM(cat.categoria), '\s+', ' ', 'g') AS categoria_nome,
      p.tipo_evento,
      p.empresa,
      EXTRACT(MONTH FROM p.data_quitacao::date)::int AS mes,
      COALESCE(p.valor_bruto::numeric, 0) AS valor_bruto,
      COALESCE(c.nome, c.empresa, 'Não identificado') AS fornecedor
    FROM "Conta Azul".caz_parcelas p
    LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = COALESCE(c.ids, c.id::text),
         regexp_split_to_table(p.categoria_nome, ';') AS cat(categoria)
    WHERE p.status = 'QUITADO'
      AND EXTRACT(YEAR FROM p.data_quitacao::date) = ${ano}
      ${empresaFilter}
      AND p.categoria_nome IS NOT NULL
      AND p.categoria_nome != ''
      AND p.tipo_evento = 'DESPESA'
  )
  SELECT
    categoria_nome,
    fornecedor,
    mes,
    SUM(valor_bruto) AS total
  FROM categorias_expandidas
  GROUP BY categoria_nome, fornecedor, mes
  ORDER BY categoria_nome, fornecedor, mes
`);

// Build fornecedor map: categoria_nome -> fornecedor_nome -> { valores }
const fornecedorMap = new Map<string, Map<string, Record<string, number>>>();
for (const row of fornecedorResult.rows) {
  const catNome = (row.categoria_nome as string).trim();
  const fornNome = (row.fornecedor as string);
  const mes = parseInt(row.mes as string);
  const total = parseFloat(row.total as string) || 0;

  if (!fornecedorMap.has(catNome)) {
    fornecedorMap.set(catNome, new Map());
  }
  const catMap = fornecedorMap.get(catNome)!;
  if (!catMap.has(fornNome)) {
    catMap.set(fornNome, emptyMonths());
  }
  const fornValores = catMap.get(fornNome)!;
  const mesKey = `mes_${String(mes).padStart(2, '0')}`;
  fornValores[mesKey] += total;
  fornValores.acumulado += total;
}

// Attach fornecedores to linhas (only expenses)
for (const linha of linhas) {
  const DESPESA_GRUPOS = new Set(['05', '06', '07', '08', 'DD']);
  if (DESPESA_GRUPOS.has(linha.grupo)) {
    const catFornecedores = fornecedorMap.get(linha.categoria_nome);
    if (catFornecedores) {
      linha.fornecedores = Array.from(catFornecedores.entries())
        .map(([nome, valores]) => ({ nome, valores }))
        .sort((a, b) => b.valores.acumulado - a.valores.acumulado);
    }
  }
}
```

**Step 3: Restart server and test endpoint**

```bash
curl "http://localhost:3000/api/financeiro/dre?ano=2026" | jq '.linhas[0].fornecedores'
```

Expected: expense categories have `fornecedores` array with `nome` and `valores`.

**Step 4: Commit**

```bash
git add server/routes/dre.ts
git commit -m "feat(dre): add supplier detail data for expense categories via caz_clientes JOIN"
```

---

### Task 3: Frontend — Add supplier drill-down rows in grouped view

**Files:**
- Modify: `client/src/pages/DRE.tsx:19-28` (DRELineItem interface)
- Modify: `client/src/pages/DRE.tsx:261-264` (state)
- Modify: `client/src/pages/DRE.tsx:597-608` (child rendering in renderGroupSection)

**Step 1: Update frontend DRELineItem interface**

Add to DRELineItem interface (line 28, before closing brace):

```tsx
  fornecedores?: { nome: string; valores: Record<string, number> }[];
```

**Step 2: Add expandedChildren state**

After line 264 (`expandedParents` state), add:

```tsx
const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());
```

Add toggle function after `toggleParent` (after line 345):

```tsx
const toggleChild = (key: string) => {
  setExpandedChildren((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
};
```

**Step 3: Modify child rendering in renderGroupSection to support expansion**

Replace lines 598-608 (the child rendering block inside renderGroupSection):

```tsx
{/* Level 3: Child categories (e.g., "05.01.01 Lider de Squad") */}
{isParentOpen &&
  children.map((child) => {
    const hasFornecedores = child.fornecedores && child.fornecedores.length > 0;
    const isChildOpen = expandedChildren.has(child.categoria_id);
    return (
      <Fragment key={`child-${child.categoria_id}`}>
        {renderLineRow(
          child,
          "child",
          "pl-12 text-gray-500 dark:text-zinc-400",
          "bg-gray-50/50 dark:bg-zinc-900/50",
          hasFornecedores ? {
            clickable: true,
            onClick: () => toggleChild(child.categoria_id),
            chevron: isChildOpen ? "expanded" : "collapsed",
          } : undefined
        )}
        {/* Level 4: Fornecedores (inline expansion) */}
        {isChildOpen && child.fornecedores?.map((forn) => {
          const fornAccum = computeAccumulated(forn.valores);
          return (
            <tr
              key={`forn-${child.categoria_id}-${forn.nome}`}
              className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors bg-gray-50/30 dark:bg-zinc-950/30"
            >
              <td className="px-3 py-1 pl-16 text-[11px] text-gray-400 dark:text-zinc-500 sticky left-0 z-10 whitespace-nowrap border-r border-gray-200 dark:border-zinc-700 bg-gray-50/30 dark:bg-zinc-950/30 italic">
                {forn.nome}
              </td>
              {MONTH_KEYS.map((mk) => {
                const val = forn.valores[mk] ?? 0;
                const isEmptyMonth = !mesesComDados.has(mk) && val === 0;
                return (
                  <Fragment key={`forn-${child.categoria_id}-${forn.nome}-${mk}-wrap`}>
                    <td className={`px-2 py-1 text-right text-[11px] tabular-nums whitespace-nowrap ${isEmptyMonth ? "text-gray-300 dark:text-zinc-600" : getValueClass(val)}`}>
                      {isEmptyMonth ? "—" : formatCurrencyNoDecimals(val)}
                    </td>
                    {showAV && renderAVCell(val, receitaBruta[mk] ?? 0, `forn-${child.categoria_id}-${forn.nome}-av-${mk}`, mk)}
                  </Fragment>
                );
              })}
              <td className={`px-2 py-1 text-right text-[11px] tabular-nums whitespace-nowrap font-semibold bg-gray-50 dark:bg-zinc-800/50 ${getValueClass(fornAccum)}`}>
                {formatCurrencyNoDecimals(fornAccum)}
              </td>
              {showAV && renderAVCell(fornAccum, receitaBrutaAcum, `forn-${child.categoria_id}-${forn.nome}-av-acum`)}
              <td className="px-1 py-1" />
            </tr>
          );
        })}
      </Fragment>
    );
  })
}
```

**Step 4: Verify visually**

Run the app, open DRE in grouped view, expand a despesa group → parent → child. The child expense categories with fornecedores should show a chevron, and clicking should expand to show supplier rows.

**Step 5: Commit**

```bash
git add client/src/pages/DRE.tsx
git commit -m "feat(dre): add inline supplier drill-down for expense categories in grouped view"
```

---

### Task 4: Final verification and push

**Step 1: Test all features**
- Toggle AV% → verify percentages use Receita Bruta as base
- Grouped view → expand despesa group → parent → child → fornecedores appear
- Expanded view → verify no regressions
- Dark mode → verify supplier rows have correct styling
- Export CSV/Excel → verify still works

**Step 2: Push**

```bash
git push
```
