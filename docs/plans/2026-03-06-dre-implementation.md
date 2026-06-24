# DRE Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full DRE (Income Statement) page with 12-month annual view, subcategory drill-down, and company filter.

**Architecture:** Query-based DRE over `caz_parcelas` (cash basis, `status = 'QUITADO'`). Categories grouped by plan-of-accounts prefix (03.xx–07.xx). Single API endpoint returns all 12 months + YTD. Frontend renders a collapsible spreadsheet-style table.

**Tech Stack:** React + TypeScript + Tailwind (dark mode), Recharts, React Query, Express + Drizzle SQL, PostgreSQL.

---

### Task 1: Add permission key and navigation entry

**Files:**
- Modify: `shared/nav-config.ts`

**Step 1: Add DRE permission key**

In `PERMISSION_KEYS.FIN` block (around line 32), add:

```ts
DRE: 'fin.dre',
```

**Step 2: Add route-to-permission mapping**

In `ROUTE_TO_PERMISSION` (around line 188), add:

```ts
'/dashboard/dre': PERMISSION_KEYS.FIN.DRE,
```

**Step 3: Add nav item to Financeiro sidebar**

In `setores[0].items` (Financeiro section, around line 388), add after DFC:

```ts
{ title: 'DRE', url: '/dashboard/dre', icon: 'FileBarChart', permissionKey: PERMISSION_KEYS.FIN.DRE },
```

**Step 4: Commit**

```bash
git add shared/nav-config.ts
git commit -m "feat(fin): add DRE permission key and navigation entry

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: Create DRE backend route

**Files:**
- Create: `server/routes/dre.ts`
- Modify: `server/routes.ts` (import + register)

**Step 1: Create `server/routes/dre.ts`**

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";

interface DRELineItem {
  categoria_id: string;
  categoria_nome: string;
  grupo: string;
  grupo_nome: string;
  tipo: 'receita' | 'despesa';
  valores: Record<string, number>; // mes_01..mes_12 + acumulado
}

interface DREResponse {
  ano: number;
  empresa: string;
  linhas: DRELineItem[];
  subtotais: {
    receita_bruta_operacional: Record<string, number>;
    receitas_nao_operacionais: Record<string, number>;
    receita_bruta_total: Record<string, number>;
    custos_operacionais: Record<string, number>;
    lucro_bruto: Record<string, number>;
    despesas_operacionais: Record<string, number>;
    resultado_operacional: Record<string, number>;
    despesas_nao_operacionais: Record<string, number>;
    resultado_liquido: Record<string, number>;
  };
}

const GRUPO_MAP: Record<string, { nome: string; tipo: 'receita' | 'despesa' }> = {
  '03': { nome: 'RECEITA BRUTA OPERACIONAL', tipo: 'receita' },
  '04': { nome: 'RECEITAS NÃO OPERACIONAIS', tipo: 'receita' },
  '05': { nome: 'CUSTOS OPERACIONAIS', tipo: 'despesa' },
  '06': { nome: 'DESPESAS OPERACIONAIS', tipo: 'despesa' },
  '07': { nome: 'DESPESAS NÃO OPERACIONAIS', tipo: 'despesa' },
};

function emptyMonths(): Record<string, number> {
  const m: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) {
    m[`mes_${String(i).padStart(2, '0')}`] = 0;
  }
  m.acumulado = 0;
  return m;
}

export function registerDRERoutes(app: Express, db: any, storage: IStorage) {

  app.get("/api/financeiro/dre", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      const empresa = (req.query.empresa as string) || 'todas';

      const empresaFilter = empresa !== 'todas'
        ? sql` AND p.empresa = ${empresa}`
        : sql``;

      const result = await db.execute(sql`
        WITH categorias_expandidas AS (
          SELECT
            p.id,
            TRIM(cat.categoria) AS categoria_nome,
            p.tipo_evento,
            p.empresa,
            EXTRACT(MONTH FROM p.data_quitacao::date)::int AS mes,
            COALESCE(p.valor_categoria::numeric, p.valor_pago::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p,
               regexp_split_to_table(p.categoria_nome, ';') AS cat(categoria)
          WHERE p.status = 'QUITADO'
            AND EXTRACT(YEAR FROM p.data_quitacao::date) = ${ano}
            ${empresaFilter}
            AND p.categoria_nome IS NOT NULL
            AND p.categoria_nome != ''
        )
        SELECT
          categoria_nome,
          mes,
          SUM(valor) AS total
        FROM categorias_expandidas
        GROUP BY categoria_nome, mes
        ORDER BY categoria_nome, mes
      `);

      // Build line items grouped by category
      const categoriaMap = new Map<string, DRELineItem>();

      for (const row of result.rows) {
        const catNome = (row.categoria_nome as string).trim();
        const mes = parseInt(row.mes as string);
        const total = parseFloat(row.total as string) || 0;

        // Derive grupo from categoria prefix (e.g., "03.01" -> "03")
        const prefixMatch = catNome.match(/^(\d{2})\./);
        const grupoKey = prefixMatch ? prefixMatch[1] : '99';
        const grupoInfo = GRUPO_MAP[grupoKey];

        if (!grupoInfo) continue; // Skip categories outside 03-07

        if (!categoriaMap.has(catNome)) {
          categoriaMap.set(catNome, {
            categoria_id: grupoKey + '.' + catNome,
            categoria_nome: catNome,
            grupo: grupoKey,
            grupo_nome: grupoInfo.nome,
            tipo: grupoInfo.tipo,
            valores: emptyMonths(),
          });
        }

        const item = categoriaMap.get(catNome)!;
        const mesKey = `mes_${String(mes).padStart(2, '0')}`;
        item.valores[mesKey] = total;
        item.valores.acumulado += total;
      }

      const linhas = Array.from(categoriaMap.values()).sort((a, b) =>
        a.categoria_nome.localeCompare(b.categoria_nome)
      );

      // Calculate subtotals
      const subtotais = {
        receita_bruta_operacional: emptyMonths(),
        receitas_nao_operacionais: emptyMonths(),
        receita_bruta_total: emptyMonths(),
        custos_operacionais: emptyMonths(),
        lucro_bruto: emptyMonths(),
        despesas_operacionais: emptyMonths(),
        resultado_operacional: emptyMonths(),
        despesas_nao_operacionais: emptyMonths(),
        resultado_liquido: emptyMonths(),
      };

      for (const linha of linhas) {
        const keys = Object.keys(linha.valores);
        for (const k of keys) {
          if (linha.grupo === '03') subtotais.receita_bruta_operacional[k] += linha.valores[k];
          if (linha.grupo === '04') subtotais.receitas_nao_operacionais[k] += linha.valores[k];
          if (linha.grupo === '05') subtotais.custos_operacionais[k] += linha.valores[k];
          if (linha.grupo === '06') subtotais.despesas_operacionais[k] += linha.valores[k];
          if (linha.grupo === '07') subtotais.despesas_nao_operacionais[k] += linha.valores[k];
        }
      }

      // Derived subtotals
      const keys = Object.keys(emptyMonths());
      for (const k of keys) {
        subtotais.receita_bruta_total[k] =
          subtotais.receita_bruta_operacional[k] + subtotais.receitas_nao_operacionais[k];
        subtotais.lucro_bruto[k] =
          subtotais.receita_bruta_total[k] - subtotais.custos_operacionais[k];
        subtotais.resultado_operacional[k] =
          subtotais.lucro_bruto[k] - subtotais.despesas_operacionais[k];
        subtotais.resultado_liquido[k] =
          subtotais.resultado_operacional[k] - subtotais.despesas_nao_operacionais[k];
      }

      // Get available empresas for filter
      const empresasResult = await db.execute(sql`
        SELECT DISTINCT empresa
        FROM "Conta Azul".caz_parcelas
        WHERE empresa IS NOT NULL AND empresa != ''
        ORDER BY empresa
      `);

      const response: DREResponse & { empresas: string[] } = {
        ano,
        empresa,
        linhas,
        subtotais,
        empresas: empresasResult.rows.map((r: any) => r.empresa as string),
      };

      res.json(response);
    } catch (error) {
      console.error("[api] Error fetching DRE:", error);
      res.status(500).json({ error: "Failed to fetch DRE data" });
    }
  });
}
```

**Step 2: Register route in `server/routes.ts`**

Add import (around line 25, with other route imports):

```ts
import { registerDRERoutes } from "./routes/dre";
```

Add registration call (around line 14910, with other route registrations):

```ts
registerDRERoutes(app, db, storage);
```

**Step 3: Commit**

```bash
git add server/routes/dre.ts server/routes.ts
git commit -m "feat(fin): add DRE backend endpoint with category hierarchy and subtotals

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Register client route in App.tsx

**Files:**
- Modify: `client/src/App.tsx`

**Step 1: Add lazy import (around line 67, with other lazy imports)**

```ts
const DRE = lazyWithRetry(() => import("@/pages/DRE"));
```

**Step 2: Add route (around line 290, in Financeiro section)**

```tsx
<Route path="/dashboard/dre">{() => <ProtectedRoute path="/dashboard/dre" component={DRE} />}</Route>
```

**Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(fin): register DRE client route

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Create DRE page component

**Files:**
- Create: `client/src/pages/DRE.tsx`

**Step 1: Create the full DRE page component**

Build `client/src/pages/DRE.tsx` with:

- `usePageTitle("DRE")` and `useSetPageInfo("DRE", "Demonstração do Resultado do Exercício")`
- State: `ano` (current year), `empresa` ("todas"), `expandedGroups` (Set of group keys)
- `useQuery` to `GET /api/financeiro/dre?ano=${ano}&empresa=${empresa}`
- **Filters bar:** Year dropdown (current year ± 2 years), Company dropdown (from `data.empresas`)
- **Spreadsheet table:**
  - Fixed left column: account name (indented for subcategories)
  - 12 monthly columns (Jan–Dez) + Acumulado YTD
  - Group header rows (collapsible, bold, bg-gray-100 dark:bg-zinc-800)
  - Subtotal rows (bold, border-top, bg-gray-50 dark:bg-zinc-850)
  - Subcategory rows (indented, normal weight, hidden when group collapsed)
  - Red text for negative values, default for positive
  - Format all values with `formatCurrency` (no decimals)
- **AV% toggle:** Optional column showing % of each line vs Receita Líquida
- **Export button:** Download CSV with same structure
- **Loading:** Skeleton while fetching
- **Dark mode:** All elements use `dark:` Tailwind variants

**Key UI structure:**

```tsx
// Render order for the table body:
// For each DRE section:
//   1. Group header row (clickable to toggle collapse)
//   2. Subcategory rows (visible only when expanded)
//   3. Subtotal row

// Sections in order:
// (+) RECEITA BRUTA OPERACIONAL (grupo 03) → subcategories → subtotal
// (+) RECEITAS NÃO OPERACIONAIS (grupo 04) → subcategories → subtotal
// (=) RECEITA BRUTA TOTAL (derived subtotal)
// (-) CUSTOS OPERACIONAIS (grupo 05) → subcategories → subtotal
// (=) LUCRO BRUTO (derived subtotal)
// (-) DESPESAS OPERACIONAIS (grupo 06) → subcategories → subtotal
// (=) RESULTADO OPERACIONAL (derived subtotal)
// (-) DESPESAS NÃO OPERACIONAIS (grupo 07) → subcategories → subtotal
// (=) RESULTADO LÍQUIDO (derived subtotal - final line, highlighted)
```

**Step 2: Commit**

```bash
git add client/src/pages/DRE.tsx
git commit -m "feat(fin): create DRE page with 12-month spreadsheet view and category drill-down

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Test and polish

**Step 1: Start dev server and verify**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

**Step 2: Manual verification checklist**

- [ ] Navigate to `/dashboard/dre` — page loads without errors
- [ ] Year filter works (changes data)
- [ ] Company filter shows all empresas + "Consolidada"
- [ ] Group headers expand/collapse subcategories
- [ ] Subtotals calculate correctly (Receita - Custos = Lucro Bruto, etc.)
- [ ] Negative values show in red
- [ ] Dark mode renders correctly
- [ ] Loading skeleton appears while fetching
- [ ] CSV export downloads correct data
- [ ] Sidebar shows "DRE" under Financeiro

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(fin): polish DRE page after testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```
