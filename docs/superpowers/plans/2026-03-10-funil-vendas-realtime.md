# Funil de Vendas em Tempo Real - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated sales funnel page with visual funnel bars, KPIs, conversion metrics between stages, and a filterable deal table.

**Architecture:** 3 new backend endpoints in `server/routes/comercial.ts` for funnel data (filters, stage aggregation, deal list). 1 new frontend page `FunilVendas.tsx` with funnel visualization, KPI cards, and deal table. Route registered in App.tsx.

**Tech Stack:** PostgreSQL (Bitrix schema), Express.js, React + Tailwind + React Query, Recharts (optional for future), lucide-react icons

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/routes/comercial.ts` | Modify | Add 3 new endpoints for funil (filtros, etapas, deals) |
| `client/src/pages/FunilVendas.tsx` | Create | Full funnel page: KPIs, visual funnel, deal table |
| `client/src/App.tsx` | Modify | Register route `/dashboard/comercial/funil` |

---

## Chunk 1: Backend + Frontend

### Task 1: Add funil endpoints to comercial.ts

**Files:**
- Modify: `server/routes/comercial.ts` (add before closing `}` of `registerComercialRoutes` at line ~2358)

- [ ] **Step 1: Add the funil stage mapping and 3 endpoints**

At the end of `registerComercialRoutes`, before the closing `}` (line 2358), add:

```typescript
  // ==================== COMERCIAL - FUNIL DE VENDAS ====================

  const FUNNEL_STAGES = [
    { key: "lead", names: ["Novo", "Lead", "Lead Novo", "Contato Inicial", "Contato inicial"], label: "Lead" },
    { key: "qualificado", names: ["Qualificado", "Qualificação", "Qualificacao"], label: "Qualificado" },
    { key: "reuniao", names: ["Reunião Agendada", "Reunião Realizada", "Reuniao Agendada", "Reuniao Realizada"], label: "Reunião" },
    { key: "proposta", names: ["Proposta", "Proposta Enviada", "Apresentação", "Apresentacao"], label: "Proposta" },
    { key: "negociacao", names: ["Negociação", "Em negociação", "Fechamento", "Negociacao", "Em negociacao"], label: "Negociação" },
    { key: "ganho", names: ["Negócio Ganho", "Negocio Ganho", "Ganho"], label: "Ganho" },
    { key: "perdido", names: ["Negócio Perdido", "Negócio perdido", "Negocio Perdido", "Perdido", "Descartado", "Descartado/sem fit"], label: "Perdido" },
  ];

  function getStageKey(stageName: string | null): string {
    if (!stageName) return "outros";
    for (const stage of FUNNEL_STAGES) {
      if (stage.names.some(n => n.toLowerCase() === stageName.toLowerCase())) return stage.key;
    }
    return "outros";
  }

  // Filtros: listas de closers, SDRs e fontes
  app.get("/api/comercial/funil/filtros", isAuthenticated, async (req, res) => {
    try {
      const [closersResult, sdrsResult, sourcesResult] = await Promise.all([
        db.execute(sql`SELECT id, nome as name FROM "Bitrix".crm_closers ORDER BY nome`),
        db.execute(sql`
          SELECT DISTINCT u.id, u.nome as name
          FROM "Bitrix".crm_users u
          INNER JOIN "Bitrix".crm_deal d ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
          ORDER BY u.nome
        `),
        db.execute(sql`SELECT DISTINCT source FROM "Bitrix".crm_deal WHERE source IS NOT NULL AND source != '' ORDER BY source`),
      ]);

      res.json({
        closers: closersResult.rows,
        sdrs: sdrsResult.rows,
        sources: (sourcesResult.rows as any[]).map(r => r.source),
      });
    } catch (error) {
      console.error("[api] Error fetching funil filtros:", error);
      res.status(500).json({ error: "Failed to fetch filtros" });
    }
  });

  // Etapas: metricas agregadas por etapa do funil
  app.get("/api/comercial/funil/etapas", isAuthenticated, async (req, res) => {
    try {
      const { dataInicio, dataFim, closer, sdr, source } = req.query;

      const conditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) conditions.push(sql`d.date_create >= ${dataInicio}`);
      if (dataFim) conditions.push(sql`d.date_create <= ${dataFim}`);
      if (closer) conditions.push(sql`d.closer = ${closer}`);
      if (sdr) conditions.push(sql`d.sdr = ${sdr}`);
      if (source) conditions.push(sql`d.source = ${source}`);

      const whereClause = conditions.length > 0
        ? sql`AND ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          d.stage_name,
          COUNT(*) as count,
          COALESCE(SUM(COALESCE(d.valor_recorrente, 0) + COALESCE(d.valor_pontual, 0)), 0) as valor
        FROM "Bitrix".crm_deal d
        WHERE d.stage_name IS NOT NULL AND d.stage_name != ''
          ${whereClause}
        GROUP BY d.stage_name
      `);

      // Aggregate by funnel stage
      const stageMap: Record<string, { count: number; valor: number }> = {};
      for (const stage of FUNNEL_STAGES) {
        stageMap[stage.key] = { count: 0, valor: 0 };
      }
      stageMap["outros"] = { count: 0, valor: 0 };

      let totalDeals = 0;
      let totalValor = 0;
      let dealsGanhos = 0;

      for (const row of result.rows as any[]) {
        const key = getStageKey(row.stage_name);
        if (!stageMap[key]) stageMap[key] = { count: 0, valor: 0 };
        stageMap[key].count += parseInt(row.count);
        stageMap[key].valor += parseFloat(row.valor);
        totalDeals += parseInt(row.count);
        totalValor += parseFloat(row.valor);
        if (key === "ganho") dealsGanhos += parseInt(row.count);
      }

      const etapas = [...FUNNEL_STAGES, { key: "outros", names: [], label: "Outros" }]
        .map(s => ({
          key: s.key,
          label: s.label,
          count: stageMap[s.key]?.count || 0,
          valor: stageMap[s.key]?.valor || 0,
        }))
        .filter(e => e.count > 0);

      const taxaConversao = totalDeals > 0 ? (dealsGanhos / totalDeals) * 100 : 0;
      const ticketMedio = dealsGanhos > 0 ? (stageMap["ganho"]?.valor || 0) / dealsGanhos : 0;

      res.json({
        etapas,
        kpis: {
          total_deals: totalDeals,
          valor_pipeline: totalValor,
          taxa_conversao: Math.round(taxaConversao * 10) / 10,
          ticket_medio: Math.round(ticketMedio),
        },
      });
    } catch (error) {
      console.error("[api] Error fetching funil etapas:", error);
      res.status(500).json({ error: "Failed to fetch etapas" });
    }
  });

  // Deals: lista de deals filtrada por etapa
  app.get("/api/comercial/funil/deals", isAuthenticated, async (req, res) => {
    try {
      const { dataInicio, dataFim, closer, sdr, source, stage, limit: lim, offset: off } = req.query;

      const conditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) conditions.push(sql`d.date_create >= ${dataInicio}`);
      if (dataFim) conditions.push(sql`d.date_create <= ${dataFim}`);
      if (closer) conditions.push(sql`d.closer = ${closer}`);
      if (sdr) conditions.push(sql`d.sdr = ${sdr}`);
      if (source) conditions.push(sql`d.source = ${source}`);

      // Filter by funnel stage key
      if (stage && stage !== "all") {
        const stageObj = FUNNEL_STAGES.find(s => s.key === stage);
        if (stageObj) {
          const stageNames = stageObj.names;
          conditions.push(sql`d.stage_name = ANY(${stageNames})`);
        }
      }

      const whereClause = conditions.length > 0
        ? sql`AND ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const limitVal = parseInt(String(lim)) || 50;
      const offsetVal = parseInt(String(off)) || 0;

      const result = await db.execute(sql`
        SELECT
          d.id,
          d.title,
          d.stage_name,
          d.closer,
          d.sdr,
          d.source,
          COALESCE(d.valor_recorrente, 0) as valor_recorrente,
          COALESCE(d.valor_pontual, 0) as valor_pontual,
          d.date_create,
          d.data_fechamento,
          c.nome as closer_name
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON c.id::text = d.closer
        WHERE d.stage_name IS NOT NULL AND d.stage_name != ''
          ${whereClause}
        ORDER BY d.date_create DESC
        LIMIT ${limitVal} OFFSET ${offsetVal}
      `);

      // Add stage_key to each deal
      const deals = (result.rows as any[]).map(r => ({
        ...r,
        stage_key: getStageKey(r.stage_name),
      }));

      res.json(deals);
    } catch (error) {
      console.error("[api] Error fetching funil deals:", error);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/comercial.ts
git commit -m "feat: add funil de vendas endpoints (filtros, etapas, deals)"
```

---

### Task 2: Create FunilVendas page

**Files:**
- Create: `client/src/pages/FunilVendas.tsx`

- [ ] **Step 1: Create the full page component**

```typescript
// client/src/pages/FunilVendas.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, DollarSign, TrendingUp, Target, ChevronDown, ArrowRight } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

interface FunilEtapa {
  key: string;
  label: string;
  count: number;
  valor: number;
}

interface FunilKPIs {
  total_deals: number;
  valor_pipeline: number;
  taxa_conversao: number;
  ticket_medio: number;
}

interface Deal {
  id: number;
  title: string;
  stage_name: string;
  stage_key: string;
  closer: string;
  closer_name: string | null;
  sdr: string;
  source: string;
  valor_recorrente: number;
  valor_pontual: number;
  date_create: string;
  data_fechamento: string | null;
}

interface Filtros {
  closers: { id: number; name: string }[];
  sdrs: { id: number; name: string }[];
  sources: string[];
}

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-500",
  qualificado: "bg-cyan-500",
  reuniao: "bg-indigo-500",
  proposta: "bg-violet-500",
  negociacao: "bg-amber-500",
  ganho: "bg-emerald-500",
  perdido: "bg-red-500",
  outros: "bg-gray-400",
};

const STAGE_BG: Record<string, string> = {
  lead: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  qualificado: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800",
  reuniao: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
  proposta: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
  negociacao: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  ganho: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  perdido: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  outros: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
};

// ---- KPI Cards ----

function KPICards({ kpis }: { kpis: FunilKPIs }) {
  const cards = [
    { title: "Total de Deals", value: String(kpis.total_deals), icon: Users, color: "text-blue-500" },
    { title: "Valor do Pipeline", value: formatCurrency(kpis.valor_pipeline), icon: DollarSign, color: "text-green-500" },
    { title: "Taxa de Conversão", value: `${kpis.taxa_conversao}%`, icon: TrendingUp, color: "text-emerald-500" },
    { title: "Ticket Médio", value: formatCurrency(kpis.ticket_medio), icon: Target, color: "text-violet-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.title} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{c.title}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Funil Visual ----

function FunilVisual({
  etapas,
  selectedStage,
  onSelectStage,
}: {
  etapas: FunilEtapa[];
  selectedStage: string | null;
  onSelectStage: (key: string | null) => void;
}) {
  if (etapas.length === 0) return <p className="text-center text-gray-400 py-8">Nenhum deal encontrado</p>;

  const maxCount = Math.max(...etapas.map(e => e.count));

  // Separate main funnel stages from terminal stages
  const mainStages = etapas.filter(e => !["ganho", "perdido", "outros"].includes(e.key));
  const terminalStages = etapas.filter(e => ["ganho", "perdido"].includes(e.key));
  const outrosStage = etapas.find(e => e.key === "outros");

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 p-6">
      <div className="space-y-1">
        {mainStages.map((etapa, i) => {
          const widthPct = maxCount > 0 ? Math.max((etapa.count / maxCount) * 100, 15) : 15;
          const prevCount = i > 0 ? mainStages[i - 1].count : null;
          const conversionPct = prevCount && prevCount > 0 ? Math.round((etapa.count / prevCount) * 100) : null;
          const isSelected = selectedStage === etapa.key;

          return (
            <div key={etapa.key}>
              {conversionPct !== null && (
                <div className="flex items-center gap-2 py-1 pl-4">
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                  <span className="text-xs font-medium text-gray-400 dark:text-zinc-500">{conversionPct}% conversão</span>
                </div>
              )}
              <button
                onClick={() => onSelectStage(isSelected ? null : etapa.key)}
                className={`w-full text-left transition-all rounded-lg border p-3 ${isSelected ? "ring-2 ring-primary" : ""} ${STAGE_BG[etapa.key] || STAGE_BG.outros}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${STAGE_COLORS[etapa.key] || STAGE_COLORS.outros}`} />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{etapa.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">{etapa.count} deals</Badge>
                    <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{formatCurrency(etapa.valor)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${STAGE_COLORS[etapa.key] || STAGE_COLORS.outros}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </button>
            </div>
          );
        })}

        {/* Terminal stages: Ganho and Perdido side by side */}
        {terminalStages.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-1 pl-4">
              <ArrowRight className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-medium text-gray-400 dark:text-zinc-500">Resultado</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {terminalStages.map(etapa => {
                const isSelected = selectedStage === etapa.key;
                return (
                  <button
                    key={etapa.key}
                    onClick={() => onSelectStage(isSelected ? null : etapa.key)}
                    className={`text-left transition-all rounded-lg border p-3 ${isSelected ? "ring-2 ring-primary" : ""} ${STAGE_BG[etapa.key] || STAGE_BG.outros}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${STAGE_COLORS[etapa.key]}`} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{etapa.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{etapa.count}</Badge>
                      <span className="text-xs text-gray-600 dark:text-zinc-400">{formatCurrency(etapa.valor)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {outrosStage && outrosStage.count > 0 && (
          <button
            onClick={() => onSelectStage(selectedStage === "outros" ? null : "outros")}
            className={`w-full text-left transition-all rounded-lg border p-3 mt-2 ${selectedStage === "outros" ? "ring-2 ring-primary" : ""} ${STAGE_BG.outros}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Outros</span>
              </div>
              <Badge variant="secondary" className="text-xs">{outrosStage.count} deals</Badge>
            </div>
          </button>
        )}
      </div>
    </Card>
  );
}

// ---- Deals Table ----

function DealsTable({ deals, isLoading }: { deals: Deal[]; isLoading: boolean }) {
  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando deals...</div>;

  if (deals.length === 0) return <p className="text-center text-gray-400 py-8">Nenhum deal encontrado</p>;

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Título</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Closer</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">SDR</th>
              <th className="text-right py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">MRR</th>
              <th className="text-right py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Pontual</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Etapa</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Fonte</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <td className="py-2 px-3 text-gray-900 dark:text-white font-medium max-w-[200px] truncate">{deal.title || "—"}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">{deal.closer_name || deal.closer || "—"}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">{deal.sdr || "—"}</td>
                <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                  {Number(deal.valor_recorrente) > 0 ? formatCurrency(Number(deal.valor_recorrente)) : "—"}
                </td>
                <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                  {Number(deal.valor_pontual) > 0 ? formatCurrency(Number(deal.valor_pontual)) : "—"}
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${STAGE_COLORS[deal.stage_key] || STAGE_COLORS.outros}`} />
                    <span className="text-gray-700 dark:text-zinc-300 text-xs">{deal.stage_name}</span>
                  </div>
                </td>
                <td className="py-2 px-3 text-gray-600 dark:text-zinc-400 text-xs">{deal.source || "—"}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-zinc-400 text-xs">
                  {deal.date_create ? new Date(deal.date_create).toLocaleDateString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-gray-400">{deals.length} deal(s)</div>
    </Card>
  );
}

// ---- Main Page ----

export default function FunilVendas() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [closer, setCloser] = useState("");
  const [sdr, setSdr] = useState("");
  const [source, setSource] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const { data: filtros } = useQuery<Filtros>({
    queryKey: ["/api/comercial/funil/filtros"],
    queryFn: () => fetch("/api/comercial/funil/filtros").then(r => r.json()),
  });

  const buildParams = () => {
    const p = new URLSearchParams();
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim) p.set("dataFim", dataFim);
    if (closer && closer !== "all") p.set("closer", closer);
    if (sdr && sdr !== "all") p.set("sdr", sdr);
    if (source && source !== "all") p.set("source", source);
    return p.toString();
  };

  const params = buildParams();

  const { data: etapasData, isLoading: etapasLoading } = useQuery<{ etapas: FunilEtapa[]; kpis: FunilKPIs }>({
    queryKey: ["/api/comercial/funil/etapas", params],
    queryFn: () => fetch(`/api/comercial/funil/etapas?${params}`).then(r => r.json()),
  });

  const dealParams = new URLSearchParams(params);
  if (selectedStage) dealParams.set("stage", selectedStage);

  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/comercial/funil/deals", dealParams.toString()],
    queryFn: () => fetch(`/api/comercial/funil/deals?${dealParams.toString()}`).then(r => r.json()),
  });

  if (etapasLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header + Filters */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-500" /> Funil de Vendas
        </h1>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">De</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[150px] bg-white dark:bg-zinc-800" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">Até</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[150px] bg-white dark:bg-zinc-800" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">Closer</Label>
            <Select value={closer} onValueChange={setCloser}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(filtros?.closers || []).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">SDR</Label>
            <Select value={sdr} onValueChange={setSdr}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(filtros?.sdrs || []).map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">Fonte</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(filtros?.sources || []).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {etapasData?.kpis && <KPICards kpis={etapasData.kpis} />}

      {/* Funil Visual */}
      <FunilVisual
        etapas={etapasData?.etapas || []}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
      />

      {/* Deals Table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Deals {selectedStage ? `— ${etapasData?.etapas.find(e => e.key === selectedStage)?.label || selectedStage}` : ""}
          </h2>
          {selectedStage && (
            <button onClick={() => setSelectedStage(null)} className="text-xs text-blue-500 hover:underline">
              Limpar filtro
            </button>
          )}
        </div>
        <DealsTable deals={deals} isLoading={dealsLoading} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/FunilVendas.tsx
git commit -m "feat: add FunilVendas page with visual funnel, KPIs, and deals table"
```

---

### Task 3: Register route in App.tsx

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add lazy import**

Near the other comercial lazy imports (around line 98-101), add:

```typescript
const FunilVendas = lazyWithRetry(() => import("@/pages/FunilVendas"));
```

- [ ] **Step 2: Add route**

In the `{/* Comercial */}` section (around line 320-328), add after the last comercial route:

```typescript
      <Route path="/dashboard/comercial/funil">{() => <ProtectedRoute path="/dashboard/comercial/funil" component={FunilVendas} />}</Route>
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: register funil de vendas route in App.tsx"
```

---

### Task 4: Manual test and push

- [ ] **Step 1: Restart dev server and verify**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Test checklist:
1. Navigate to `/dashboard/comercial/funil`
2. Verify KPI cards show data
3. Verify funnel stages appear with counts and values
4. Click a stage bar → deals table filters
5. Change closer/SDR/source filters → data updates
6. Verify dark mode support

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Update Obsidian vault**

Update `funil-vendas-realtime.md` epic from planejado to concluido.
