# Roadmap de Auditoria de Clientes - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Kanban pipeline page that tracks clients across Bitrix → ClickUp → Conta Azul, identifying value divergences and lost clients using pg_trgm fuzzy matching.

**Architecture:** New API endpoint queries 3 CTEs (Bitrix deals, ClickUp contracts, Conta Azul parcels), joins them via CNPJ and fuzzy name matching (pg_trgm), returns unified audit items. Frontend renders a 3-column Kanban with client cards, divergence alerts, and a detail side panel.

**Tech Stack:** PostgreSQL pg_trgm, Drizzle ORM raw SQL, React + TanStack Query, Tailwind CSS, Lucide icons, shadcn/ui components.

---

### Task 1: Enable pg_trgm Extension

**Files:**
- Modify: `server/db.ts` (add extension creation in initializeDatabase or equivalent init block)

**Step 1: Add pg_trgm extension creation**

In `server/db.ts`, find the database initialization section (around line 38-88 where tables are created) and add before any table creation:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Using the existing pattern:
```typescript
await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
```

**Step 2: Verify extension works**

Test via the app startup logs — no errors should appear.

**Step 3: Commit**

```bash
git add server/db.ts
git commit -m "feat(db): enable pg_trgm extension for fuzzy text matching"
```

---

### Task 2: Add Navigation & Routing Config

**Files:**
- Modify: `shared/nav-config.ts`
- Modify: `client/src/App.tsx`

**Step 1: Add permission key**

In `shared/nav-config.ts`, add to `PERMISSION_KEYS.FIN` object (after line 27 where `AUDITORIA` exists):

```typescript
ROADMAP_AUDITORIA: 'fin.roadmap_auditoria',
```

**Step 2: Add route-to-permission mapping**

In `ROUTE_TO_PERMISSION` object (after line 194):

```typescript
'/dashboard/roadmap-auditoria': PERMISSION_KEYS.FIN.ROADMAP_AUDITORIA,
```

**Step 3: Add nav item to Financeiro section**

In `setores[0].items` array (after the existing items around line 398):

```typescript
{ title: 'Roadmap Auditoria', url: '/dashboard/roadmap-auditoria', icon: 'Route', permissionKey: PERMISSION_KEYS.FIN.ROADMAP_AUDITORIA },
```

**Step 4: Add permission label**

In the `PERMISSION_LABELS` object (after line 611):

```typescript
[PERMISSION_KEYS.FIN.ROADMAP_AUDITORIA]: 'Roadmap Auditoria',
```

**Step 5: Add lazy import in App.tsx**

Near line 84 (where other lazy imports are):

```typescript
const RoadmapAuditoria = lazyWithRetry(() => import("@/pages/RoadmapAuditoria"));
```

**Step 6: Add route in App.tsx**

Near line 290 (where other routes are):

```tsx
<Route path="/dashboard/roadmap-auditoria">
  {() => <ProtectedRoute path="/dashboard/roadmap-auditoria" component={RoadmapAuditoria} />}
</Route>
```

**Step 7: Commit**

```bash
git add shared/nav-config.ts client/src/App.tsx
git commit -m "feat(nav): add Roadmap Auditoria route and navigation"
```

---

### Task 3: Backend API Endpoint

**Files:**
- Modify: `server/routes.ts` (add new GET endpoint)

**Step 1: Add the endpoint**

Add after the existing auditoria-sistemas endpoint (around line 11410). The endpoint uses raw SQL with 3 CTEs and pg_trgm fuzzy matching:

```typescript
app.get("/api/auditoria/roadmap-clientes", async (req, res) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const threshold = parseFloat(req.query.threshold as string) || 5;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid month format. Expected: YYYY-MM" });
    }

    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const endDate = `${year}-${mon}-${new Date(parseInt(year), parseInt(mon), 0).getDate()}`;

    const result = await db.execute(sql`
      WITH bitrix_deals AS (
        SELECT
          b.id,
          b.company_name,
          COALESCE(b.valor_recorrente, 0) as valor_recorrente,
          COALESCE(b.valor_pontual, 0) as valor_pontual,
          b.closer,
          b.data_fechamento,
          b.category_name,
          LOWER(TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                COALESCE(b.company_name, ''),
                '\s*(LTDA|ME|SA|EIRELI|EPP|MEI|S\.A\.|S/A|SOCIEDADE|LIMITADA)\.?\s*$',
                '', 'gi'
              ),
              '\s+', ' ', 'g'
            )
          )) as nome_normalizado
        FROM "Bitrix".crm_deal b
        WHERE LOWER(b.stage_name) = 'negócio ganho'
          AND b.data_fechamento IS NOT NULL
          AND b.data_fechamento >= ${startDate}::date
          AND b.data_fechamento <= ${endDate}::date
          AND COALESCE(b.valor_recorrente, 0) > 0
      ),
      clickup_clientes AS (
        SELECT
          cli.cnpj,
          cli.nome,
          cli.task_id,
          cli.status_conta,
          LOWER(TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                COALESCE(cli.nome, ''),
                '\s*(LTDA|ME|SA|EIRELI|EPP|MEi|S\.A\.|S/A|SOCIEDADE|LIMITADA)\.?\s*$',
                '', 'gi'
              ),
              '\s+', ' ', 'g'
            )
          )) as nome_normalizado,
          COALESCE(SUM(con.valorr), 0) as valor_clickup,
          COUNT(con.id_subtask) as qtd_contratos,
          STRING_AGG(DISTINCT con.squad, ', ') as squads
        FROM "Clickup".cup_clientes cli
        LEFT JOIN "Clickup".cup_contratos con ON con.id_task = cli.task_id
          AND con.status IN ('ativo', 'onboarding', 'Ativo', 'Onboarding')
        GROUP BY cli.cnpj, cli.nome, cli.task_id, cli.status_conta
        HAVING COALESCE(SUM(con.valorr), 0) > 0
      ),
      contaazul_agg AS (
        SELECT
          REGEXP_REPLACE(COALESCE(cc.cnpj, ''), '[^0-9]', '', 'g') as cnpj_limpo,
          cc.nome,
          COALESCE(SUM(cp.valor_bruto), 0) as valor_contaazul,
          COUNT(cp.id) as qtd_parcelas
        FROM "Conta Azul".caz_parcelas cp
        JOIN "Conta Azul".caz_clientes cc ON cp.id_cliente = cc.ids
        WHERE cp.tipo_evento = 'RECEIVE'
          AND cp.data_vencimento >= ${startDate}::timestamp
          AND cp.data_vencimento <= ${endDate}::timestamp + interval '1 day'
          AND cp.status IN ('PAGO', 'PENDENTE', 'Pago', 'Pendente', 'VENCIDO', 'Vencido')
        GROUP BY REGEXP_REPLACE(COALESCE(cc.cnpj, ''), '[^0-9]', '', 'g'), cc.nome
      )
      SELECT
        COALESCE(cu.nome, ca.nome, bd.company_name) as cliente_nome,
        cu.cnpj,
        -- Bitrix
        CASE WHEN bd.id IS NOT NULL THEN true ELSE false END as bitrix_encontrado,
        COALESCE(bd.valor_recorrente, 0) as bitrix_valor_recorrente,
        COALESCE(bd.valor_pontual, 0) as bitrix_valor_pontual,
        bd.closer as bitrix_closer,
        bd.data_fechamento::text as bitrix_data_fechamento,
        bd.company_name as bitrix_company_name,
        COALESCE(similarity(bd.nome_normalizado, cu.nome_normalizado), 0) as bitrix_match_score,
        -- ClickUp
        CASE WHEN cu.task_id IS NOT NULL THEN true ELSE false END as clickup_encontrado,
        COALESCE(cu.valor_clickup, 0) as clickup_valor_total,
        COALESCE(cu.qtd_contratos, 0)::integer as clickup_qtd_contratos,
        cu.status_conta as clickup_status,
        cu.squads as clickup_squad,
        -- Conta Azul
        CASE WHEN ca.cnpj_limpo IS NOT NULL AND ca.cnpj_limpo != '' THEN true ELSE false END as contaazul_encontrado,
        COALESCE(ca.valor_contaazul, 0) as contaazul_valor_mes,
        COALESCE(ca.qtd_parcelas, 0)::integer as contaazul_qtd_parcelas,
        -- Divergências
        CASE
          WHEN bd.valor_recorrente IS NOT NULL AND cu.valor_clickup IS NOT NULL AND cu.valor_clickup > 0
          THEN ABS(bd.valor_recorrente - cu.valor_clickup) / cu.valor_clickup * 100
          ELSE 0
        END as divergencia_bitrix_clickup,
        CASE
          WHEN cu.valor_clickup IS NOT NULL AND cu.valor_clickup > 0 AND ca.valor_contaazul IS NOT NULL
          THEN ABS(cu.valor_clickup - ca.valor_contaazul) / cu.valor_clickup * 100
          ELSE 0
        END as divergencia_clickup_contaazul
      FROM clickup_clientes cu
      FULL OUTER JOIN contaazul_agg ca
        ON REGEXP_REPLACE(COALESCE(cu.cnpj, ''), '[^0-9]', '', 'g') = ca.cnpj_limpo
        AND ca.cnpj_limpo != ''
      LEFT JOIN bitrix_deals bd
        ON cu.nome_normalizado IS NOT NULL
        AND bd.nome_normalizado IS NOT NULL
        AND similarity(bd.nome_normalizado, cu.nome_normalizado) >= 0.8
      WHERE COALESCE(cu.valor_clickup, 0) > 0
         OR COALESCE(ca.valor_contaazul, 0) > 0
         OR COALESCE(bd.valor_recorrente, 0) > 0
      ORDER BY COALESCE(cu.valor_clickup, ca.valor_contaazul, bd.valor_recorrente, 0) DESC
    `);

    const items = (result.rows || []).map((row: any) => {
      const bitrixEncontrado = row.bitrix_encontrado === true || row.bitrix_encontrado === 't';
      const clickupEncontrado = row.clickup_encontrado === true || row.clickup_encontrado === 't';
      const contaazulEncontrado = row.contaazul_encontrado === true || row.contaazul_encontrado === 't';
      const divBitrixClickup = parseFloat(row.divergencia_bitrix_clickup) || 0;
      const divClickupContaazul = parseFloat(row.divergencia_clickup_contaazul) || 0;

      let status = 'ok';
      if (clickupEncontrado && !contaazulEncontrado) {
        status = 'faltando_contaazul';
      } else if (!clickupEncontrado && contaazulEncontrado) {
        status = 'faltando_clickup';
      } else if (!clickupEncontrado && !contaazulEncontrado) {
        status = 'faltando_ambos';
      } else if (divBitrixClickup > threshold || divClickupContaazul > threshold) {
        status = 'divergencia_valor';
      }

      return {
        clienteNome: row.cliente_nome,
        cnpj: row.cnpj,
        bitrix_encontrado: bitrixEncontrado,
        bitrix_valor_recorrente: parseFloat(row.bitrix_valor_recorrente) || 0,
        bitrix_valor_pontual: parseFloat(row.bitrix_valor_pontual) || 0,
        bitrix_closer: row.bitrix_closer || null,
        bitrix_data_fechamento: row.bitrix_data_fechamento || null,
        bitrix_company_name: row.bitrix_company_name || null,
        bitrix_match_score: parseFloat(row.bitrix_match_score) || 0,
        clickup_encontrado: clickupEncontrado,
        clickup_valor_total: parseFloat(row.clickup_valor_total) || 0,
        clickup_qtd_contratos: parseInt(row.clickup_qtd_contratos) || 0,
        clickup_status: row.clickup_status || null,
        clickup_squad: row.clickup_squad || null,
        contaazul_encontrado: contaazulEncontrado,
        contaazul_valor_mes: parseFloat(row.contaazul_valor_mes) || 0,
        contaazul_qtd_parcelas: parseInt(row.contaazul_qtd_parcelas) || 0,
        divergencia_bitrix_clickup: divBitrixClickup,
        divergencia_clickup_contaazul: divClickupContaazul,
        status,
      };
    });

    res.json(items);
  } catch (error) {
    console.error("[api] Error fetching roadmap auditoria:", error);
    res.status(500).json({ error: "Failed to fetch roadmap auditoria data" });
  }
});
```

**Step 2: Verify server compiles**

Restart the dev server and check for TypeScript errors.

**Step 3: Commit**

```bash
git add server/routes.ts
git commit -m "feat(api): add roadmap auditoria clientes endpoint with fuzzy matching"
```

---

### Task 4: Frontend Page - Base Structure & Hero Cards

**Files:**
- Create: `client/src/pages/RoadmapAuditoria.tsx`

**Step 1: Create the page with hero summary cards, filters, and useQuery**

```typescript
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Route as RouteIcon,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Users,
  ArrowRight,
  Building2,
  FileText,
  CreditCard,
  ChevronRight,
  X,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface AuditoriaRoadmapItem {
  clienteNome: string;
  cnpj: string | null;
  bitrix_encontrado: boolean;
  bitrix_valor_recorrente: number;
  bitrix_valor_pontual: number;
  bitrix_closer: string | null;
  bitrix_data_fechamento: string | null;
  bitrix_company_name: string | null;
  bitrix_match_score: number;
  clickup_encontrado: boolean;
  clickup_valor_total: number;
  clickup_qtd_contratos: number;
  clickup_status: string | null;
  clickup_squad: string | null;
  contaazul_encontrado: boolean;
  contaazul_valor_mes: number;
  contaazul_qtd_parcelas: number;
  divergencia_bitrix_clickup: number;
  divergencia_clickup_contaazul: number;
  status: 'ok' | 'divergencia_valor' | 'faltando_clickup' | 'faltando_contaazul' | 'faltando_ambos';
}

const formatCurrencyNoDecimals = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

const statusConfig = {
  ok: { label: "OK", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/50", icon: CheckCircle2 },
  divergencia_valor: { label: "Divergência", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/50", icon: AlertTriangle },
  faltando_clickup: { label: "Sem ClickUp", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800/50", icon: XCircle },
  faltando_contaazul: { label: "Sem Conta Azul", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800/50", icon: XCircle },
  faltando_ambos: { label: "Só Bitrix", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800/50", icon: XCircle },
};

export default function RoadmapAuditoria() {
  usePageTitle("Roadmap de Auditoria");
  useSetPageInfo("Roadmap de Auditoria", "Pipeline completo: Bitrix → ClickUp → Conta Azul");

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [threshold, setThreshold] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedItem, setSelectedItem] = useState<AuditoriaRoadmapItem | null>(null);

  const { data, isLoading } = useQuery<AuditoriaRoadmapItem[]>({
    queryKey: ["/api/auditoria/roadmap-clientes", month, threshold],
    queryFn: async () => {
      const params = new URLSearchParams({ month, threshold: threshold.toString() });
      const res = await fetch(`/api/auditoria/roadmap-clientes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    let items = [...data];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.clienteNome?.toLowerCase().includes(term) ||
        i.cnpj?.includes(term) ||
        i.bitrix_company_name?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== "todos") {
      items = items.filter(i => i.status === statusFilter);
    }
    return items;
  }, [data, searchTerm, statusFilter]);

  // Métricas resumo
  const metricas = useMemo(() => {
    if (!data) return { total: 0, divergencias: 0, faltando: 0, mrrRisco: 0 };
    const divergencias = data.filter(i => i.status === 'divergencia_valor').length;
    const faltando = data.filter(i => ['faltando_clickup', 'faltando_contaazul', 'faltando_ambos'].includes(i.status)).length;
    const mrrRisco = data
      .filter(i => i.status !== 'ok')
      .reduce((sum, i) => sum + Math.max(i.clickup_valor_total, i.contaazul_valor_mes, i.bitrix_valor_recorrente), 0);
    return { total: data.length, divergencias, faltando, mrrRisco };
  }, [data]);

  // Agrupar por coluna (Bitrix, ClickUp, Conta Azul)
  const kanbanData = useMemo(() => {
    const bitrix: AuditoriaRoadmapItem[] = [];
    const clickup: AuditoriaRoadmapItem[] = [];
    const contaazul: AuditoriaRoadmapItem[] = [];

    filteredData.forEach(item => {
      if (item.bitrix_encontrado) bitrix.push(item);
      if (item.clickup_encontrado) clickup.push(item);
      if (item.contaazul_encontrado) contaazul.push(item);
    });

    return { bitrix, clickup, contaazul };
  }, [filteredData]);

  // -- RENDER --
  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Mês:</label>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Tolerância:</label>
          <Select value={threshold.toString()} onValueChange={v => setThreshold(parseInt(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5%</SelectItem>
              <SelectItem value="10">10%</SelectItem>
              <SelectItem value="20">20%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Status:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="divergencia_valor">Divergência</SelectItem>
              <SelectItem value="faltando_clickup">Sem ClickUp</SelectItem>
              <SelectItem value="faltando_contaazul">Sem Conta Azul</SelectItem>
              <SelectItem value="faltando_ambos">Só Bitrix</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Hero Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total Clientes</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : metricas.total}</div>
            <div className="text-xs text-muted-foreground mt-1">no pipeline do mês</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Divergências</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{isLoading ? <Skeleton className="h-8 w-16" /> : metricas.divergencias}</div>
            <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">valores diferentes entre sistemas</div>
          </CardContent>
        </Card>
        <Card className="border-red-200/50 dark:border-red-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Faltando no Pipe</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{isLoading ? <Skeleton className="h-8 w-16" /> : metricas.faltando}</div>
            <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">clientes perdidos entre etapas</div>
          </CardContent>
        </Card>
        <Card className="border-rose-200/50 dark:border-rose-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase">MRR em Risco</span>
              <DollarSign className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{isLoading ? <Skeleton className="h-8 w-16" /> : formatCurrencyNoDecimals(metricas.mrrRisco)}</div>
            <div className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">soma dos clientes com problema</div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Pipeline */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-border/50"><CardContent className="p-4 space-y-3">{[1,2,3,4].map(j => <Skeleton key={j} className="h-20 w-full" />)}</CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Coluna Bitrix */}
          <Card className="border-purple-200/50 dark:border-purple-800/30 bg-purple-50/30 dark:bg-purple-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-purple-500/10"><Building2 className="h-4 w-4 text-purple-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold">Bitrix (CRM)</h3>
                  <p className="text-[11px] text-muted-foreground">Negócios Ganhos</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{kanbanData.bitrix.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {kanbanData.bitrix.map((item, idx) => {
                  const cfg = statusConfig[item.status];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={`bitrix-${idx}`}
                      onClick={() => setSelectedItem(item)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${cfg.bg} ${cfg.border}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.bitrix_company_name || item.clienteNome}</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5">{formatCurrencyNoDecimals(item.bitrix_valor_recorrente)}</p>
                        </div>
                        <Icon className={`h-4 w-4 flex-shrink-0 mt-1 ${cfg.color}`} />
                      </div>
                      {item.bitrix_closer && <p className="text-[11px] text-muted-foreground mt-1">Closer: {item.bitrix_closer}</p>}
                      {item.bitrix_encontrado && item.clickup_encontrado && item.divergencia_bitrix_clickup > threshold && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{item.divergencia_bitrix_clickup.toFixed(1)}% diff vs ClickUp</span>
                        </div>
                      )}
                      {item.bitrix_encontrado && !item.clickup_encontrado && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-red-600 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          <span>Não encontrado no ClickUp</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {kanbanData.bitrix.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum negócio ganho no período</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coluna ClickUp */}
          <Card className="border-blue-200/50 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-blue-500/10"><FileText className="h-4 w-4 text-blue-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold">ClickUp (Operação)</h3>
                  <p className="text-[11px] text-muted-foreground">Contratos Ativos</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{kanbanData.clickup.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {kanbanData.clickup.map((item, idx) => {
                  const cfg = statusConfig[item.status];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={`clickup-${idx}`}
                      onClick={() => setSelectedItem(item)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${cfg.bg} ${cfg.border}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.clienteNome}</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5">{formatCurrencyNoDecimals(item.clickup_valor_total)}</p>
                        </div>
                        <Icon className={`h-4 w-4 flex-shrink-0 mt-1 ${cfg.color}`} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground">{item.clickup_qtd_contratos} contrato(s)</span>
                        {item.clickup_squad && <span className="text-[11px] text-muted-foreground">· {item.clickup_squad}</span>}
                      </div>
                      {item.clickup_encontrado && item.contaazul_encontrado && item.divergencia_clickup_contaazul > threshold && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{item.divergencia_clickup_contaazul.toFixed(1)}% diff vs Conta Azul</span>
                        </div>
                      )}
                      {item.clickup_encontrado && !item.contaazul_encontrado && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-orange-600 dark:text-orange-400">
                          <XCircle className="h-3 w-3" />
                          <span>Sem parcelas no Conta Azul</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {kanbanData.clickup.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato ativo</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coluna Conta Azul */}
          <Card className="border-green-200/50 dark:border-green-800/30 bg-green-50/30 dark:bg-green-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-green-500/10"><CreditCard className="h-4 w-4 text-green-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold">Conta Azul (Financeiro)</h3>
                  <p className="text-[11px] text-muted-foreground">Parcelas do Mês</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{kanbanData.contaazul.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {kanbanData.contaazul.map((item, idx) => {
                  const cfg = statusConfig[item.status];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={`ca-${idx}`}
                      onClick={() => setSelectedItem(item)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${cfg.bg} ${cfg.border}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.clienteNome}</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5">{formatCurrencyNoDecimals(item.contaazul_valor_mes)}</p>
                        </div>
                        <Icon className={`h-4 w-4 flex-shrink-0 mt-1 ${cfg.color}`} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{item.contaazul_qtd_parcelas} parcela(s)</span>
                    </div>
                  );
                })}
                {kanbanData.contaazul.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma parcela no período</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Side Panel - Detalhe do Cliente */}
      {selectedItem && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white dark:bg-zinc-900 border-l border-border shadow-2xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold truncate pr-4">{selectedItem.clienteNome}</h2>
              <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedItem.cnpj && (
              <p className="text-sm text-muted-foreground mb-4">CNPJ: {selectedItem.cnpj}</p>
            )}

            {/* Status badge */}
            {(() => {
              const cfg = statusConfig[selectedItem.status];
              const Icon = cfg.icon;
              return (
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-6 ${cfg.bg} ${cfg.border} border`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                  <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })()}

            {/* Pipeline visual */}
            <div className="space-y-4">
              {/* Bitrix */}
              <div className={`p-4 rounded-lg border ${selectedItem.bitrix_encontrado ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/50' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-semibold">Bitrix (CRM)</span>
                  {selectedItem.bitrix_encontrado
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                    : <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                  }
                </div>
                {selectedItem.bitrix_encontrado ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor Recorrente</span><span className="font-semibold">{formatCurrency(selectedItem.bitrix_valor_recorrente)}</span></div>
                    {selectedItem.bitrix_valor_pontual > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Valor Pontual</span><span className="font-semibold">{formatCurrency(selectedItem.bitrix_valor_pontual)}</span></div>}
                    {selectedItem.bitrix_closer && <div className="flex justify-between"><span className="text-muted-foreground">Closer</span><span>{selectedItem.bitrix_closer}</span></div>}
                    {selectedItem.bitrix_data_fechamento && <div className="flex justify-between"><span className="text-muted-foreground">Data Fechamento</span><span>{selectedItem.bitrix_data_fechamento}</span></div>}
                    {selectedItem.bitrix_match_score > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Match Score</span><span>{(selectedItem.bitrix_match_score * 100).toFixed(0)}%</span></div>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Não encontrado no Bitrix</p>}
              </div>

              <div className="flex justify-center">
                <ChevronRight className="h-5 w-5 text-muted-foreground rotate-90" />
              </div>

              {/* Divergência Bitrix → ClickUp */}
              {selectedItem.bitrix_encontrado && selectedItem.clickup_encontrado && selectedItem.divergencia_bitrix_clickup > threshold && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Divergência de {selectedItem.divergencia_bitrix_clickup.toFixed(1)}% entre Bitrix e ClickUp</span>
                </div>
              )}

              {/* ClickUp */}
              <div className={`p-4 rounded-lg border ${selectedItem.clickup_encontrado ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold">ClickUp (Operação)</span>
                  {selectedItem.clickup_encontrado
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                    : <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                  }
                </div>
                {selectedItem.clickup_encontrado ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor Total MRR</span><span className="font-semibold">{formatCurrency(selectedItem.clickup_valor_total)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Contratos</span><span>{selectedItem.clickup_qtd_contratos}</span></div>
                    {selectedItem.clickup_squad && <div className="flex justify-between"><span className="text-muted-foreground">Squad</span><span>{selectedItem.clickup_squad}</span></div>}
                    {selectedItem.clickup_status && <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{selectedItem.clickup_status}</span></div>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Não encontrado no ClickUp</p>}
              </div>

              <div className="flex justify-center">
                <ChevronRight className="h-5 w-5 text-muted-foreground rotate-90" />
              </div>

              {/* Divergência ClickUp → Conta Azul */}
              {selectedItem.clickup_encontrado && selectedItem.contaazul_encontrado && selectedItem.divergencia_clickup_contaazul > threshold && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Divergência de {selectedItem.divergencia_clickup_contaazul.toFixed(1)}% entre ClickUp e Conta Azul</span>
                </div>
              )}

              {/* Conta Azul */}
              <div className={`p-4 rounded-lg border ${selectedItem.contaazul_encontrado ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-semibold">Conta Azul (Financeiro)</span>
                  {selectedItem.contaazul_encontrado
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                    : <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                  }
                </div>
                {selectedItem.contaazul_encontrado ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor Mês</span><span className="font-semibold">{formatCurrency(selectedItem.contaazul_valor_mes)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Parcelas</span><span>{selectedItem.contaazul_qtd_parcelas}</span></div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Não encontrado no Conta Azul</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify page compiles**

Navigate to `/dashboard/roadmap-auditoria` in the browser.

**Step 3: Commit**

```bash
git add client/src/pages/RoadmapAuditoria.tsx
git commit -m "feat(auditoria): add Roadmap Auditoria Kanban pipeline page"
```

---

### Task 5: Final Integration & Testing

**Step 1: Test the full pipeline**

1. Open the app and navigate to Roadmap Auditoria
2. Verify the 3 columns render with data
3. Click a client card and verify the side panel opens
4. Test filters (month, tolerance, status, search)
5. Verify dark mode works correctly

**Step 2: Fix any issues found during testing**

**Step 3: Final commit and push**

```bash
git push
```
