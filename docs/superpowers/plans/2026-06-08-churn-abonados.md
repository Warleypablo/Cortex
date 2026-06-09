# Churns Abonados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/dashboard/churn-abonados` com análise de churns abonados por motivo, operacional e evolução temporal.

**Architecture:** Uma nova página React que consome o endpoint existente `/api/analytics/churn-detalhamento` com janela de 12 meses, filtra `is_abonado === true` no frontend e calcula as três seções de análise (motivo, operacional, temporal) via `useMemo`. Sem nenhuma alteração de backend.

**Tech Stack:** React + TypeScript, TanStack Query, Recharts (AreaChart, BarChart), Tailwind CSS (dark/light mode), date-fns, wouter (roteamento), shared/nav-config.ts (permissões + menu)

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `client/src/pages/ChurnAbonados.tsx` | Componente da página completa |
| Modificar | `shared/nav-config.ts` | Chave de permissão + entrada de menu + mapeamento de rota + label |
| Modificar | `client/src/App.tsx` | Import lazy + Route |

---

## Task 1: Registrar permissão e navegação

**Files:**
- Modify: `shared/nav-config.ts:55` (PERMISSION_KEYS.GESTAO)
- Modify: `shared/nav-config.ts:240` (permissionsToRoutes)
- Modify: `shared/nav-config.ts:473` (NAV_CONFIG — item de menu)
- Modify: `shared/nav-config.ts:707` (PERMISSION_LABELS)

- [ ] **Step 1: Adicionar chave de permissão em PERMISSION_KEYS.GESTAO**

Em `shared/nav-config.ts`, na linha 55 (logo após `CHURN_PRODUTO: 'gestao.churn_produto',`), adicionar:

```ts
    CHURN_ABONADOS: 'gestao.churn_abonados',
```

- [ ] **Step 2: Adicionar mapeamento de rota**

Na linha 240 (logo após `'/dashboard/churn-produto': PERMISSION_KEYS.GESTAO.CHURN_PRODUTO,`), adicionar:

```ts
  '/dashboard/churn-abonados': PERMISSION_KEYS.GESTAO.CHURN_ABONADOS,
```

- [ ] **Step 3: Adicionar entrada no menu lateral**

Na linha 473 (logo após a entrada de Churn por Produto), adicionar:

```ts
        { title: 'Churns Abonados', url: '/dashboard/churn-abonados', icon: 'Shield', permissionKey: PERMISSION_KEYS.GESTAO.CHURN_ABONADOS },
```

- [ ] **Step 4: Adicionar label de permissão**

Na linha 707 (logo após `[PERMISSION_KEYS.GESTAO.CHURN_PRODUTO]: 'Churn por Produto',`), adicionar:

```ts
  [PERMISSION_KEYS.GESTAO.CHURN_ABONADOS]: 'Churns Abonados',
```

- [ ] **Step 5: Commit**

```bash
git add shared/nav-config.ts
git commit -m "feat(churn-abonados): adicionar permissão e entrada de navegação"
```

---

## Task 2: Registrar rota no App.tsx

**Files:**
- Modify: `client/src/App.tsx:75` (import lazy)
- Modify: `client/src/App.tsx:323` (Route)

- [ ] **Step 1: Adicionar import lazy**

Na linha 75 (logo após `const ChurnProduto = lazyWithRetry(...)`), adicionar:

```ts
const ChurnAbonados = lazyWithRetry(() => import("@/pages/ChurnAbonados"));
```

- [ ] **Step 2: Adicionar Route**

Na linha 323 (logo após a Route de churn-produto), adicionar:

```tsx
      <Route path="/dashboard/churn-abonados">{() => <ProtectedRoute path="/dashboard/churn-abonados" component={ChurnAbonados} />}</Route>
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(churn-abonados): registrar rota /dashboard/churn-abonados"
```

---

## Task 3: Criar o componente ChurnAbonados.tsx

**Files:**
- Create: `client/src/pages/ChurnAbonados.tsx`

- [ ] **Step 1: Criar o arquivo com o componente completo**

Criar `client/src/pages/ChurnAbonados.tsx` com o conteúdo abaixo:

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency } from "@/lib/utils";
import { TrendingDown, DollarSign, Users, Calendar, Shield } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  format,
  parseISO,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface AbonadoContract {
  id: string;
  cliente_nome: string;
  produto: string;
  squad: string;
  responsavel: string;
  valorr: number;
  data_encerramento: string | null;
  motivo_cancelamento?: string;
  submotivo?: string | null;
  is_abonado?: boolean;
  abonar_churn?: string;
}

interface ChurnDetalhamentoData {
  contratos: AbonadoContract[];
  squads: string[];
}

const MOTIVOS_AUTOMATICOS = ["Inadimplente 1º Mês", "Não começou", "Erro na Venda"];

function ToggleButton({
  value,
  active,
  onClick,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-xs rounded transition-colors ${
        active
          ? "bg-amber-500 text-white"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {value}
    </button>
  );
}

export default function ChurnAbonados() {
  usePageTitle("Churns Abonados");
  useSetPageInfo("Churns Abonados", "Análise de contratos com churn abonado");

  const [anoMes, setAnoMes] = useState(() => format(new Date(), "yyyy-MM"));
  const [filterSquad, setFilterSquad] = useState<string>("todos");
  const [motivoToggle, setMotivoToggle] = useState<"mrr" | "volume">("mrr");
  const [temporalToggle, setTemporalToggle] = useState<"mrr" | "volume">("mrr");

  // Mês de referência: primeiro dia do mês selecionado
  const refDate = useMemo(() => {
    const [year, month] = anoMes.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [anoMes]);

  // Janela de 12 meses para a query
  const dataInicio12m = useMemo(
    () => format(startOfMonth(subMonths(refDate, 11)), "yyyy-MM-dd"),
    [refDate]
  );
  const dataFim12m = useMemo(
    () => format(endOfMonth(refDate), "yyyy-MM-dd"),
    [refDate]
  );

  const { data, isLoading, error } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", dataInicio12m, dataFim12m],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dataInicio12m,
        endDate: dataFim12m,
      });
      const res = await fetch(
        `/api/analytics/churn-detalhamento?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch churn data");
      return res.json();
    },
  });

  // Todos os abonados nos 12 meses
  const abonados12m = useMemo(
    () => (data?.contratos ?? []).filter((c) => c.is_abonado),
    [data]
  );

  // Limites do mês selecionado
  const mesInicio = format(startOfMonth(refDate), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(refDate), "yyyy-MM-dd");

  // Abonados no mês selecionado + filtro de squad
  const abonadosMes = useMemo(
    () =>
      abonados12m.filter((c) => {
        const d = c.data_encerramento ?? "";
        return (
          d >= mesInicio &&
          d <= mesFim &&
          (filterSquad === "todos" || c.squad === filterSquad)
        );
      }),
    [abonados12m, mesInicio, mesFim, filterSquad]
  );

  // Squads disponíveis
  const squads = useMemo(() => data?.squads ?? [], [data]);

  // Hero cards
  const heroMetrics = useMemo(() => {
    const count = abonadosMes.length;
    const mrr = abonadosMes.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const ticketMedio = count > 0 ? mrr / count : 0;
    const byMotivo: Record<string, number> = {};
    abonadosMes.forEach((c) => {
      const m = c.motivo_cancelamento || "Não especificado";
      byMotivo[m] = (byMotivo[m] || 0) + 1;
    });
    const maiorMotivo =
      Object.entries(byMotivo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { count, mrr, ticketMedio, maiorMotivo };
  }, [abonadosMes]);

  // Seção 1a: Por Motivo
  const motivoData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes.forEach((c) => {
      const m = c.motivo_cancelamento || "Não especificado";
      if (!map[m]) map[m] = { count: 0, mrr: 0 };
      map[m].count++;
      map[m].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([motivo, v]) => ({ motivo, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosMes]);

  // Seção 1b: Por Submotivo (condicional)
  const submotivoData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes
      .filter((c) => c.submotivo)
      .forEach((c) => {
        const s = c.submotivo!;
        if (!map[s]) map[s] = { count: 0, mrr: 0 };
        map[s].count++;
        map[s].mrr += c.valorr || 0;
      });
    return Object.entries(map)
      .map(([submotivo, v]) => ({ submotivo, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosMes]);

  // Seção 2a: Por Squad
  const squadData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes.forEach((c) => {
      const s = c.squad || "Sem Squad";
      if (!map[s]) map[s] = { count: 0, mrr: 0 };
      map[s].count++;
      map[s].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([squad, v]) => ({ squad, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [abonadosMes]);

  // Seção 2b: Top 10 Responsáveis
  const responsavelData = useMemo(() => {
    const map: Record<string, { count: number; mrr: number }> = {};
    abonadosMes.forEach((c) => {
      const r = c.responsavel || "Não especificado";
      if (!map[r]) map[r] = { count: 0, mrr: 0 };
      map[r].count++;
      map[r].mrr += c.valorr || 0;
    });
    return Object.entries(map)
      .map(([responsavel, v]) => ({ responsavel, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [abonadosMes]);

  // Seção 3: Evolução temporal — 12 meses, com squad filter
  const temporalData = useMemo(() => {
    const months: Record<
      string,
      {
        manual: number;
        automatico: number;
        mrrManual: number;
        mrrAutomatico: number;
        sortKey: string;
      }
    > = {};

    // Inicializar todos os 12 meses
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(refDate, i);
      const key = format(d, "MMM/yy", { locale: ptBR });
      months[key] = {
        manual: 0,
        automatico: 0,
        mrrManual: 0,
        mrrAutomatico: 0,
        sortKey: format(d, "yyyy-MM"),
      };
    }

    const filtrados = abonados12m.filter(
      (c) => filterSquad === "todos" || c.squad === filterSquad
    );

    filtrados.forEach((c) => {
      if (!c.data_encerramento) return;
      const d = parseISO(c.data_encerramento);
      const key = format(d, "MMM/yy", { locale: ptBR });
      if (!months[key]) return;
      const isManual =
        c.abonar_churn === "Sim" &&
        !MOTIVOS_AUTOMATICOS.includes(c.motivo_cancelamento ?? "");
      if (isManual) {
        months[key].manual++;
        months[key].mrrManual += c.valorr || 0;
      } else {
        months[key].automatico++;
        months[key].mrrAutomatico += c.valorr || 0;
      }
    });

    return Object.entries(months)
      .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
      .map(([mes, v]) => ({ mes, ...v }));
  }, [abonados12m, refDate, filterSquad]);

  // Opções de mês para o seletor (últimos 24 meses)
  const monthOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 24; i++) {
      const d = subMonths(new Date(), i);
      opts.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM/yyyy", { locale: ptBR }),
      });
    }
    return opts;
  }, []);

  if (isLoading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Carregando churns abonados...
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-destructive">
        Erro ao carregar dados.
      </div>
    );

  const motivoBarKey = motivoToggle === "mrr" ? "mrr" : "count";
  const temporalManualKey = temporalToggle === "mrr" ? "mrrManual" : "manual";
  const temporalAutoKey =
    temporalToggle === "mrr" ? "mrrAutomatico" : "automatico";

  const tooltipFormatter = (value: unknown, name: string) => {
    const v = Number(value);
    if (name === "mrrManual" || name === "mrr") return [formatCurrency(v), "MRR"];
    if (name === "mrrAutomatico") return [formatCurrency(v), "Abono Automático MRR"];
    if (name === "manual") return [v, "Abono Manual"];
    if (name === "automatico") return [v, "Abono Automático"];
    if (name === "count") return [v, "Contratos"];
    return [v, name];
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Churns Abonados
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise de contratos com churn abonado — por motivo, operacional e
            temporal
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={anoMes} onValueChange={setAnoMes}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSquad} onValueChange={setFilterSquad}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os squads</SelectItem>
            {squads.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: TrendingDown,
            label: "Contratos Abonados",
            value: heroMetrics.count.toString(),
          },
          {
            icon: DollarSign,
            label: "MRR Abonado",
            value: formatCurrency(heroMetrics.mrr),
          },
          {
            icon: Users,
            label: "Ticket Médio",
            value: formatCurrency(heroMetrics.ticketMedio),
          },
          {
            icon: Calendar,
            label: "Maior Motivo",
            value: heroMetrics.maiorMotivo,
          },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="border-amber-200 dark:border-amber-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 leading-tight">
                {value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Seção 1: Por Motivo */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Por Motivo
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Distribuição por Motivo */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Distribuição por Motivo</CardTitle>
              <div className="flex gap-1">
                <ToggleButton
                  value="MRR"
                  active={motivoToggle === "mrr"}
                  onClick={() => setMotivoToggle("mrr")}
                />
                <ToggleButton
                  value="Volume"
                  active={motivoToggle === "volume"}
                  onClick={() => setMotivoToggle("volume")}
                />
              </div>
            </CardHeader>
            <CardContent>
              {motivoData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum abonado no período
                </p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(motivoData.length * 52 + 20, 100)}
                >
                  <BarChart
                    data={motivoData}
                    layout="vertical"
                    margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="motivo"
                      width={170}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip formatter={tooltipFormatter} />
                    <Bar
                      dataKey={motivoBarKey}
                      fill="#f59e0b"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Detalhamento por Submotivo — condicional */}
          {submotivoData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Detalhamento por Submotivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">
                        Submotivo
                      </th>
                      <th className="text-right py-2 font-medium text-muted-foreground">
                        Qtd
                      </th>
                      <th className="text-right py-2 font-medium text-muted-foreground">
                        MRR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {submotivoData.map((row) => (
                      <tr
                        key={row.submotivo}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 text-foreground">
                          {row.submotivo}
                        </td>
                        <td className="py-2 text-right text-foreground">
                          {row.count}
                        </td>
                        <td className="py-2 text-right text-amber-600 dark:text-amber-400 font-medium">
                          {formatCurrency(row.mrr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Seção 2: Operacional */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Operacional
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Por Squad */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Abonados por Squad</CardTitle>
            </CardHeader>
            <CardContent>
              {squadData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum abonado no período
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={squadData}
                    margin={{ top: 8, right: 24, bottom: 48, left: 8 }}
                  >
                    <XAxis
                      dataKey="squad"
                      tick={{ fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis hide />
                    <Tooltip formatter={tooltipFormatter} />
                    <Bar
                      dataKey="mrr"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      name="mrr"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top 10 Responsáveis */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 10 Responsáveis</CardTitle>
            </CardHeader>
            <CardContent>
              {responsavelData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum abonado no período
                </p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(responsavelData.length * 44 + 20, 80)}
                >
                  <BarChart
                    data={responsavelData}
                    layout="vertical"
                    margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="responsavel"
                      width={150}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={tooltipFormatter} />
                    <Bar
                      dataKey="count"
                      fill="#fb923c"
                      radius={[0, 4, 4, 0]}
                      name="count"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção 3: Evolução Temporal */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Evolução Temporal
        </h2>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Evolução Mês a Mês — últimos 12 meses
            </CardTitle>
            <div className="flex gap-1">
              <ToggleButton
                value="MRR"
                active={temporalToggle === "mrr"}
                onClick={() => setTemporalToggle("mrr")}
              />
              <ToggleButton
                value="Volume"
                active={temporalToggle === "volume"}
                onClick={() => setTemporalToggle("volume")}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={temporalData}
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip formatter={tooltipFormatter} />
                <Legend
                  formatter={(name) =>
                    name === temporalManualKey
                      ? "Abono Manual"
                      : "Abono Automático"
                  }
                />
                <Area
                  type="monotone"
                  dataKey={temporalManualKey}
                  stackId="1"
                  fill="#f59e0b"
                  stroke="#f59e0b"
                  fillOpacity={0.8}
                  name={temporalManualKey}
                />
                <Area
                  type="monotone"
                  dataKey={temporalAutoKey}
                  stackId="1"
                  fill="#fb923c"
                  stroke="#fb923c"
                  fillOpacity={0.8}
                  name={temporalAutoKey}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verificar se o servidor de dev está rodando, subir se necessário**

```bash
lsof -ti:3000 | head -1
# Se retornar vazio, subir: npm run dev
```

- [ ] **Step 3: Abrir no browser e validar a página**

Navegar para `http://localhost:3000/dashboard/churn-abonados` e verificar:
- [ ] Hero cards renderizam com valores numéricos (mesmo que zero)
- [ ] Filtros de período e squad funcionam
- [ ] Gráfico de motivos exibe barras horizontais com toggle MRR/Volume
- [ ] Gráfico de squad exibe barras verticais
- [ ] Gráfico de responsáveis exibe top 10 horizontal
- [ ] Area chart temporal exibe 12 meses com duas séries âmbar/laranja
- [ ] Dark mode: verificar com `Ctrl+T` ou toggle de tema — todas as cores devem funcionar
- [ ] Entrada "Churns Abonados" aparece no menu lateral

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ChurnAbonados.tsx
git commit -m "feat(churn-abonados): criar página de análise de churns abonados"
```
