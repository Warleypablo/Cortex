# Top MRR por Area - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar secao na pagina AnaliseSquads mostrando MRR total e ranking de clientes por area (Comunicacao vs Performance).

**Architecture:** Novo endpoint backend que agrupa contratos ativos em duas areas (Comunicacao = Makers+Pulse, Performance = demais squads), retornando KPIs e lista de clientes por MRR. Novo componente frontend renderiza dois cards lado a lado com KPIs e tabela scrollavel.

**Tech Stack:** Express + Drizzle ORM (backend), React + React Query + Tailwind + Recharts (frontend)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/routes.ts` | Modify (~line 5557) | Add new endpoint `/api/analise-squads/top-mrr-area` |
| `client/src/components/squads/TopMrrPorArea.tsx` | Create | Component with 2 cards side-by-side |
| `client/src/pages/AnaliseSquads.tsx` | Modify | Import and render TopMrrPorArea component |

---

### Task 1: Backend - Endpoint `/api/analise-squads/top-mrr-area`

**Files:**
- Modify: `server/routes.ts` (after line ~5557, after the existing `/api/analise-squads/detalhe` endpoint)

- [ ] **Step 1: Add the endpoint**

Insert after the `/api/analise-squads/detalhe` endpoint block in `server/routes.ts`:

```typescript
  // Top MRR por Area (Comunicacao vs Performance)
  app.get("/api/analise-squads/top-mrr-area", async (req, res) => {
    try {
      const mesAno = req.query.mesAno as string;
      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }

      const [ano, mes] = mesAno.split('-').map(Number);
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0, 23, 59, 59);
      const agora = new Date();
      const isMesAtual = ano === agora.getFullYear() && mes === (agora.getMonth() + 1);

      // Squads da area Comunicacao
      const COMUNICACAO_SQUADS = ['Makers', 'Pulse'];

      let clientesRows: any[];

      if (isMesAtual) {
        const result = await db.execute(sql`
          SELECT
            COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad') as squad,
            cl.nome as cliente_nome,
            COALESCE(SUM(c.valorr::numeric), 0) as mrr,
            COUNT(DISTINCT c.id_subtask) as contratos,
            MAX(c.responsavel) as responsavel
          FROM "Clickup".cup_contratos c
          LEFT JOIN "Clickup".cup_clientes cl ON c.id_task = cl.task_id
          WHERE c.status IN ('ativo', 'onboarding', 'triagem')
            AND c.valorr IS NOT NULL AND c.valorr > 0
          GROUP BY COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad'), cl.nome
          ORDER BY mrr DESC
        `);
        clientesRows = result.rows as any[];
      } else {
        // Snapshot historico
        const snapshotResult = await db.execute(sql`
          SELECT MAX(data_snapshot) as ds
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= ${inicioMes}::timestamp
            AND data_snapshot <= ${fimMes}::timestamp
        `);
        const dataSnapshot = (snapshotResult.rows[0] as any)?.ds;

        if (dataSnapshot) {
          const result = await db.execute(sql`
            SELECT
              COALESCE(NULLIF(TRIM(h.squad), ''), 'Sem Squad') as squad,
              cl.nome as cliente_nome,
              COALESCE(SUM(h.valorr::numeric), 0) as mrr,
              COUNT(DISTINCT h.id_subtask) as contratos,
              MAX(h.responsavel) as responsavel
            FROM "Clickup".cup_data_hist h
            LEFT JOIN "Clickup".cup_clientes cl ON h.id_task = cl.task_id
            WHERE h.data_snapshot = ${dataSnapshot}::timestamp
              AND h.status IN ('ativo', 'onboarding', 'triagem')
              AND h.valorr IS NOT NULL AND h.valorr > 0
            GROUP BY COALESCE(NULLIF(TRIM(h.squad), ''), 'Sem Squad'), cl.nome
            ORDER BY mrr DESC
          `);
          clientesRows = result.rows as any[];
        } else {
          clientesRows = [];
        }
      }

      // Separar em areas
      const comunicacao: any[] = [];
      const performance: any[] = [];

      for (const row of clientesRows) {
        const squad = (row.squad || '').trim();
        const cliente = {
          nome: row.cliente_nome || 'Sem Nome',
          squad,
          mrr: parseFloat(row.mrr) || 0,
          contratos: parseInt(row.contratos) || 0,
          responsavel: row.responsavel || '',
        };
        if (COMUNICACAO_SQUADS.includes(squad)) {
          comunicacao.push(cliente);
        } else {
          performance.push(cliente);
        }
      }

      const buildArea = (clientes: any[]) => {
        const mrr = clientes.reduce((s, c) => s + c.mrr, 0);
        const contratos = clientes.reduce((s, c) => s + c.contratos, 0);
        return {
          mrr,
          contratos,
          ticketMedio: contratos > 0 ? mrr / contratos : 0,
          clientes,
        };
      };

      res.json({
        comunicacao: buildArea(comunicacao),
        performance: buildArea(performance),
      });
    } catch (error) {
      console.error("Erro ao buscar top MRR por area:", error);
      res.status(500).json({ error: "Erro interno" });
    }
  });
```

- [ ] **Step 2: Test the endpoint manually**

Run: restart server, then `curl "http://localhost:3000/api/analise-squads/top-mrr-area?mesAno=2026-03"` (after logging in via browser to get a session cookie).
Expected: JSON with `comunicacao` and `performance` objects containing clientes arrays.

- [ ] **Step 3: Commit**

```bash
git add server/routes.ts
git commit -m "feat(squads): add /api/analise-squads/top-mrr-area endpoint (TASK-11)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Frontend - Componente `TopMrrPorArea`

**Files:**
- Create: `client/src/components/squads/TopMrrPorArea.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p client/src/components/squads
```

- [ ] **Step 2: Create the component**

```tsx
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, FileText, Receipt } from "lucide-react";

interface ClienteArea {
  nome: string;
  squad: string;
  mrr: number;
  contratos: number;
  responsavel: string;
}

interface AreaData {
  mrr: number;
  contratos: number;
  ticketMedio: number;
  clientes: ClienteArea[];
}

interface TopMrrAreaResponse {
  comunicacao: AreaData;
  performance: AreaData;
}

interface TopMrrPorAreaProps {
  mesAno: string;
}

function AreaCard({
  title,
  color,
  data,
  isDark,
}: {
  title: string;
  color: string;
  data: AreaData;
  isDark: boolean;
}) {
  return (
    <Card className="flex-1 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-white">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
            <DollarSign className="w-4 h-4 mx-auto mb-1 text-gray-500 dark:text-zinc-400" />
            <p className="text-xs text-gray-500 dark:text-zinc-400">MRR Total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.mrr)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
            <FileText className="w-4 h-4 mx-auto mb-1 text-gray-500 dark:text-zinc-400" />
            <p className="text-xs text-gray-500 dark:text-zinc-400">Contratos</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{data.contratos}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
            <Receipt className="w-4 h-4 mx-auto mb-1 text-gray-500 dark:text-zinc-400" />
            <p className="text-xs text-gray-500 dark:text-zinc-400">Ticket Medio</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.ticketMedio)}
            </p>
          </div>
        </div>

        {/* Tabela de clientes */}
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 dark:bg-zinc-800 z-10">
              <TableRow>
                <TableHead className="text-gray-600 dark:text-zinc-400">#</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Cliente</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Squad</TableHead>
                <TableHead className="text-right text-gray-600 dark:text-zinc-400">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.clientes.map((c, i) => (
                <TableRow key={`${c.nome}-${i}`} className="border-gray-100 dark:border-zinc-800">
                  <TableCell className="text-gray-500 dark:text-zinc-500 w-8">{i + 1}</TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                    {c.nome}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-zinc-400 text-sm">{c.squad}</TableCell>
                  <TableCell className="text-right font-semibold text-gray-900 dark:text-white">
                    {formatCurrencyNoDecimals(c.mrr)}
                  </TableCell>
                </TableRow>
              ))}
              {data.clientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 dark:text-zinc-500 py-8">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TopMrrPorArea({ mesAno }: TopMrrPorAreaProps) {
  const { data, isLoading } = useQuery<TopMrrAreaResponse>({
    queryKey: ["/api/analise-squads/top-mrr-area", mesAno],
    queryFn: async () => {
      const response = await fetch(`/api/analise-squads/top-mrr-area?mesAno=${mesAno}`);
      if (!response.ok) throw new Error("Falha ao buscar dados");
      return response.json();
    },
  });

  const isDark = document.documentElement.classList.contains("dark");

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[500px]" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Top MRR por Area</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AreaCard title="Comunicacao" color="#ec4899" data={data.comunicacao} isDark={isDark} />
        <AreaCard title="Performance" color="#3b82f6" data={data.performance} isDark={isDark} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/squads/TopMrrPorArea.tsx
git commit -m "feat(squads): add TopMrrPorArea component (TASK-11)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Integrar componente na pagina AnaliseSquads

**Files:**
- Modify: `client/src/pages/AnaliseSquads.tsx`

- [ ] **Step 1: Add import**

At the top of AnaliseSquads.tsx, add import:

```typescript
import TopMrrPorArea from "@/components/squads/TopMrrPorArea";
```

- [ ] **Step 2: Render the component**

Inside the main return JSX, after the existing content (before the closing `</div>`), add:

```tsx
<TopMrrPorArea mesAno={mesAno} />
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000` > Analise de Squads. Verify:
- Two cards render side by side (Comunicacao and Performance)
- KPIs show MRR total, contratos, ticket medio
- Tables list clients ordered by MRR descending
- Tables scroll when content exceeds max height
- Dark and light mode both work correctly

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/AnaliseSquads.tsx
git commit -m "feat(squads): integrate TopMrrPorArea into AnaliseSquads page (TASK-11)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Git push e atualizar Obsidian/Chamados

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Update Obsidian task file**

Update `/Users/mac0267/Documents/Obsidian Vault/Cortex 2.0/Tasks/TASK-11-mostrar-top-mrr-por-area.md`:
- Set `status: "concluido"`
- Add `concluido: 2026-03-11`
- Mark subtasks complete

- [ ] **Step 3: Update chamado in DB**

```sql
UPDATE cortex_core.chamados SET status='resolvido', resolvido_em=NOW(), atualizado_em=NOW() WHERE id=11;
```
