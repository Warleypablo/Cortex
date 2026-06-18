# Capacity Times — Drawer de Contratos por Operador

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar no nome de um operador em qualquer tabela do Capacity Times, abrir um drawer lateral mostrando seus clientes e contratos ativos.

**Architecture:** Novo endpoint `GET /api/capacity-times/contratos?nome=<nome>` busca contratos via join `capacity_metas → cup_contratos → cup_clientes`. Um componente `OperadorDrawer` (Sheet do Radix UI) consome o endpoint via React Query. O estado `selectedOperador` vive na página `CapacityTimes` e é propagado para `CsTable` e `ComercialTable` via prop `onOperadorClick`.

**Tech Stack:** Express + Drizzle ORM (sql template), React Query, Radix UI Sheet, Tailwind CSS, Vitest + Supertest.

---

### Task 1: Endpoint `GET /api/capacity-times/contratos`

**Files:**
- Modify: `server/routes/capacity.ts` (após o endpoint `/api/capacity-times` existente, ~linha 171)
- Create: `server/routes/capacityTimes.contratos.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `server/routes/capacityTimes.contratos.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerCapacityRoutes } from "./capacity";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCapacityRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/capacity-times/contratos", () => {
  it("retorna contratos do operador", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { cliente: "Skyfit", produto: "Social Media", status: "ativo", valorr: "6000", valorp: "0", id_subtask: "abc123" },
        { cliente: "LaudoPsi", produto: "Social Media", status: "onboarding", valorr: "3897", valorp: "0", id_subtask: "def456" },
      ],
    });
    const res = await request(makeApp()).get("/api/capacity-times/contratos?nome=Brenda");
    expect(res.status).toBe(200);
    expect(res.body.contratos).toHaveLength(2);
    expect(res.body.contratos[0]).toEqual({
      cliente: "Skyfit",
      produto: "Social Media",
      status: "ativo",
      valorr: 6000,
      valorp: 0,
      id_subtask: "abc123",
    });
  });

  it("retorna 400 quando nome não fornecido", async () => {
    const res = await request(makeApp()).get("/api/capacity-times/contratos");
    expect(res.status).toBe(400);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/capacity-times/contratos?nome=Brenda");
    expect(res.status).toBe(500);
  });

  it("substitui cliente null por '—'", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ cliente: null, produto: "Performance", status: "ativo", valorr: "5000", valorp: "0", id_subtask: "x1" }],
    });
    const res = await request(makeApp()).get("/api/capacity-times/contratos?nome=Victor");
    expect(res.body.contratos[0].cliente).toBe("—");
  });
});
```

- [ ] **Passo 2: Rodar o teste e verificar que falha**

```bash
npx vitest run server/routes/capacityTimes.contratos.test.ts
```

Esperado: FAIL com `Cannot find route GET /api/capacity-times/contratos`.

- [ ] **Passo 3: Implementar o endpoint em `server/routes/capacity.ts`**

Adicionar logo após o bloco `// GET /api/capacity-times` existente (após a linha `res.json(buildResponse(rows));` do endpoint anterior), antes de `// ── Endpoints legados`:

```typescript
  // GET /api/capacity-times/contratos?nome=<nome>
  app.get("/api/capacity-times/contratos", async (req, res) => {
    const nome = (req.query.nome as string | undefined)?.trim();
    if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
    try {
      const rows = (await db.execute(sql`
        SELECT
          cl.nome AS cliente,
          c.produto,
          c.status,
          COALESCE(c.valorr, 0) AS valorr,
          COALESCE(c.valorp, 0) AS valorp,
          c.id_subtask
        FROM cortex_core.capacity_metas m
        JOIN "Clickup".cup_contratos c
          ON c.responsavel ILIKE '%' || m.match_responsavel || '%'
          AND c.status IN ('ativo','onboarding','em cancelamento')
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE m.nome = ${nome}
          AND m.ativo = TRUE
        ORDER BY
          CASE c.status WHEN 'ativo' THEN 1 WHEN 'onboarding' THEN 2 ELSE 3 END,
          COALESCE(c.valorr, 0) DESC
      `)).rows as any[];

      res.json({
        contratos: rows.map((r) => ({
          cliente: r.cliente || "—",
          produto: r.produto || "—",
          status: r.status as string,
          valorr: Number(r.valorr) || 0,
          valorp: Number(r.valorp) || 0,
          id_subtask: r.id_subtask as string,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching capacity-times contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });
```

- [ ] **Passo 4: Rodar o teste e verificar que passa**

```bash
npx vitest run server/routes/capacityTimes.contratos.test.ts
```

Esperado: 4 testes PASS.

- [ ] **Passo 5: Commit**

```bash
git add server/routes/capacity.ts server/routes/capacityTimes.contratos.test.ts
git commit -m "feat(capacity-times): add GET /api/capacity-times/contratos endpoint"
```

---

### Task 2: Componente `OperadorDrawer`

**Files:**
- Create: `client/src/components/capacity-times/OperadorDrawer.tsx`

- [ ] **Passo 1: Criar o arquivo `client/src/components/capacity-times/OperadorDrawer.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface Contrato {
  cliente: string;
  produto: string;
  status: string;
  valorr: number;
  valorp: number;
  id_subtask: string;
}

interface Props {
  operador: string | null;
  onClose: () => void;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ativo"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400"
      : status === "onboarding"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400";
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", cls)}>
      {status}
    </span>
  );
}

export function OperadorDrawer({ operador, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<{ contratos: Contrato[] }>({
    queryKey: ["/api/capacity-times/contratos", operador],
    queryFn: async () => {
      const res = await fetch(`/api/capacity-times/contratos?nome=${encodeURIComponent(operador!)}`);
      if (!res.ok) throw new Error("Erro ao buscar contratos");
      return res.json();
    },
    enabled: !!operador,
  });

  const contratos = data?.contratos ?? [];
  const totalMrr = contratos.reduce((s, c) => s + c.valorr, 0);

  return (
    <Sheet open={!!operador} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-gray-900 dark:text-white text-lg">
            {operador}
          </SheetTitle>
          {!isLoading && (
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {contratos.length} contrato{contratos.length !== 1 ? "s" : ""} · MRR total{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totalMrr)}
              </span>
            </p>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : contratos.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-zinc-400 py-12">
            Nenhum contrato ativo encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 dark:border-zinc-700">
                <TableHead className="text-gray-600 dark:text-zinc-400">Cliente</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Produto</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Status</TableHead>
                <TableHead className="text-right text-gray-600 dark:text-zinc-400">MRR</TableHead>
                <TableHead className="text-right text-gray-600 dark:text-zinc-400">Pontual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((c) => (
                <TableRow key={c.id_subtask} className="border-gray-200 dark:border-zinc-700">
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {c.cliente}
                  </TableCell>
                  <TableCell className="text-gray-700 dark:text-zinc-300">{c.produto}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right text-gray-900 dark:text-white">
                    {c.valorr > 0 ? formatCurrency(c.valorr) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-gray-500 dark:text-zinc-400">
                    {c.valorp > 0 ? formatCurrency(c.valorp) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Passo 2: Commit**

```bash
git add client/src/components/capacity-times/OperadorDrawer.tsx
git commit -m "feat(capacity-times): add OperadorDrawer component"
```

---

### Task 3: Conectar drawer à página `CapacityTimes`

**Files:**
- Modify: `client/src/pages/CapacityTimes.tsx`

- [ ] **Passo 1: Adicionar import do `OperadorDrawer` e estado `selectedOperador`**

No topo do arquivo, adicionar o import após os outros imports:

```tsx
import { OperadorDrawer } from "@/components/capacity-times/OperadorDrawer";
```

Na função `CapacityTimes` (linha ~463), adicionar estado logo após o `useQuery`:

```tsx
const [selectedOperador, setSelectedOperador] = useState<string | null>(null);
```

Adicionar import de `useState` se não estiver presente (já está no import `from "react"`).

- [ ] **Passo 2: Adicionar prop `onOperadorClick` em `CsTable`**

Alterar a assinatura da função `CsTable`:

```tsx
function CsTable({ rows, onOperadorClick }: { rows: CsRow[]; onOperadorClick: (nome: string) => void }) {
```

Na célula de nome (linha da `TableCell` com `{r.nome}`), torná-la clicável:

```tsx
<TableCell
  className={cn(td("font-medium"), "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline")}
  onClick={() => onOperadorClick(r.nome)}
>
  {r.nome}
</TableCell>
```

- [ ] **Passo 3: Adicionar prop `onOperadorClick` em `ComercialTable`**

Alterar a assinatura da função `ComercialTable`:

```tsx
function ComercialTable({ rows, onOperadorClick }: { rows: ComercialRow[]; onOperadorClick: (nome: string) => void }) {
```

Na célula de nome de `ComercialTable` (linha com `{r.nome}`), torná-la clicável:

```tsx
<TableCell
  className={cn(td("font-medium"), "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline")}
  onClick={() => onOperadorClick(r.nome)}
>
  {r.nome}
</TableCell>
```

- [ ] **Passo 4: Passar `onOperadorClick` nos pontos de uso**

Nos dois locais onde `CsTable` é renderizado (dentro de `SquadTab`):

```tsx
<CsTable rows={rows} onOperadorClick={setSelectedOperador} />
```

Onde `ComercialTable` é renderizado (dentro de `ComercialTab` e nos outros locais de uso):

```tsx
<ComercialTable rows={rows} onOperadorClick={setSelectedOperador} />
```

**Atenção:** `setSelectedOperador` precisa ser acessível nesses componentes. Como eles recebem `onOperadorClick` como prop, o estado fica em `CapacityTimes` e a função é passada para baixo via props da árvore: `CapacityTimes → SquadTab/ComercialTab → CsTable/ComercialTable`.

Isso implica que `SquadTab` e `ComercialTab` também precisam receber e repassar a prop:

```tsx
function SquadTab({ group, onOperadorClick }: { group: SquadGroup; onOperadorClick: (nome: string) => void }) {
  // ...
  return (
    <>
      {/* ... cards e alertas ... */}
      <CsTable rows={rows} onOperadorClick={onOperadorClick} />
    </>
  );
}

function ComercialTab({ title, rows, onOperadorClick }: { title: string; rows: ComercialRow[]; onOperadorClick: (nome: string) => void }) {
  return (
    <>
      {/* ... cards ... */}
      <ComercialTable rows={rows} onOperadorClick={onOperadorClick} />
    </>
  );
}
```

No JSX de `CapacityTimes`, passar a prop nos locais de uso de `SquadTab` e `ComercialTab`:

```tsx
<SquadTab group={...} onOperadorClick={setSelectedOperador} />
<ComercialTab title="..." rows={...} onOperadorClick={setSelectedOperador} />
```

- [ ] **Passo 5: Renderizar `OperadorDrawer` no retorno de `CapacityTimes`**

No final do JSX retornado por `CapacityTimes`, antes do `</div>` final, adicionar:

```tsx
<OperadorDrawer
  operador={selectedOperador}
  onClose={() => setSelectedOperador(null)}
/>
```

- [ ] **Passo 6: Reiniciar o servidor e testar manualmente**

```bash
# Reiniciar servidor
lsof -ti:3000 | xargs kill -9 2>/dev/null
npm run dev
```

Verificar:
1. Página Capacity Times carrega sem erros
2. Hover sobre nome de operador → cursor pointer + underline azul
3. Clique → drawer abre à direita com lista de contratos
4. Contratos exibem cliente, produto, badge de status colorido, MRR, pontual
5. Fechar drawer (X ou clique fora) → drawer fecha, pode clicar em outro operador
6. Dark mode e light mode funcionam

- [ ] **Passo 7: Commit final**

```bash
git add client/src/pages/CapacityTimes.tsx
git commit -m "feat(capacity-times): wire OperadorDrawer to table rows"
```
