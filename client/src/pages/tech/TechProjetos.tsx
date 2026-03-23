import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProjectCard from "@/components/tech/ProjectCard";
import ProjectDrawer from "@/components/tech/ProjectDrawer";

// ── Helpers ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.split(/[\s;]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] || "?").toUpperCase();
}

function getLoadDot(count: number): string {
  if (count > 7) return "bg-red-500";
  if (count >= 4) return "bg-amber-500";
  return "bg-emerald-500";
}

function getUrgencyForRow(dueDate: string | null): "overdue" | "risk" | "ok" | "none" {
  if (!dueDate) return "none";
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "risk";
  return "ok";
}

const URGENCY_DOT_COLOR: Record<string, string> = {
  overdue: "bg-red-500",
  risk: "bg-amber-500",
  ok: "bg-emerald-500",
  none: "bg-gray-300 dark:bg-zinc-600",
};

const URGENCY_LABEL: Record<string, string> = {
  overdue: "Atrasado",
  risk: "Em risco",
  ok: "No prazo",
  none: "—",
};

function normalizeForDrawer(p: any) {
  return {
    ...p,
    clickup_task_id: p.clickup_task_id || p.clickupTaskId,
    task_name: p.task_name || p.taskName,
    status_projeto: p.status_projeto || p.statusProjeto,
    fase_projeto: p.fase_projeto || p.faseProjeto,
    data_vencimento: p.data_vencimento || p.dataVencimento,
    lancamento: p.lancamento,
    tempo_total: p.tempo_total || p.tempoTotal,
  };
}

const selectClass =
  "h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

// ── Component ──────────────────────────────────────────────────────────

export default function TechProjetos() {
  const [toggle, setToggle] = useState<"abertos" | "fechados">("abertos");
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterPrioridade, setFilterPrioridade] = useState("");
  const [filterResponsavel, setFilterResponsavel] = useState("");
  const [selectedProject, setSelectedProject] = useState<any>(null);

  // When switching to fechados, force lista view
  const effectiveView = toggle === "fechados" ? "lista" : viewMode;

  // ── Kanban data ─────────────────────────────────────────────────────
  const kanbanParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filterStatus) p.set("status", filterStatus);
    if (filterTipo) p.set("tipo", filterTipo);
    if (filterPrioridade) p.set("prioridade", filterPrioridade);
    return p.toString();
  }, [filterStatus, filterTipo, filterPrioridade]);

  const { data: boardColumns = [], isLoading: loadingBoard } = useQuery({
    queryKey: ["/api/tech/board", kanbanParams],
    queryFn: async () => {
      const res = await fetch(`/api/tech/board?${kanbanParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: effectiveView === "kanban",
  });

  // ── Lista data ──────────────────────────────────────────────────────
  const { data: projetos = [], isLoading: loadingProjetos } = useQuery({
    queryKey: ["/api/tech/projetos", toggle],
    queryFn: async () => {
      const res = await fetch(`/api/tech/projetos?tipo=${toggle}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: effectiveView === "lista",
  });

  // Extract unique filter values from lista data
  const responsaveis = useMemo(
    () => Array.from(new Set(projetos.map((p: any) => p.responsavel).filter(Boolean))).sort() as string[],
    [projetos],
  );
  const statuses = useMemo(
    () => Array.from(new Set(projetos.map((p: any) => p.status_projeto || p.statusProjeto).filter(Boolean))).sort() as string[],
    [projetos],
  );
  const tipos = useMemo(
    () => Array.from(new Set(projetos.map((p: any) => p.tipo).filter(Boolean))).sort() as string[],
    [projetos],
  );

  // Filter lista projects
  const filteredProjetos = useMemo(() => {
    return projetos.filter((p: any) => {
      const name = (p.task_name || p.taskName || "").toLowerCase();
      const resp = p.responsavel || "";
      const status = p.status_projeto || p.statusProjeto || "";
      const tipo = p.tipo || "";

      if (search && !name.includes(search.toLowerCase())) return false;
      if (filterResponsavel && resp !== filterResponsavel) return false;
      if (filterStatus && status !== filterStatus) return false;
      if (filterTipo && tipo !== filterTipo) return false;
      return true;
    });
  }, [projetos, search, filterResponsavel, filterStatus, filterTipo]);

  // Filter kanban columns by search
  const filteredColumns = useMemo(() => {
    if (!search) return boardColumns;
    return boardColumns
      .map((col: any) => ({
        ...col,
        projetos: col.projetos.filter((p: any) =>
          (p.task_name || "").toLowerCase().includes(search.toLowerCase()),
        ),
      }))
      .map((col: any) => ({ ...col, total: col.projetos.length }));
  }, [boardColumns, search]);

  const totalCount =
    effectiveView === "kanban"
      ? filteredColumns.reduce((sum: number, col: any) => sum + col.total, 0)
      : filteredProjetos.length;

  const isLoading = effectiveView === "kanban" ? loadingBoard : loadingProjetos;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Toolbar — single row */}
      <div className="flex items-center gap-2 mb-4">
        {/* Abertos / Fechados segmented control */}
        <div className="inline-flex rounded-md border border-input overflow-hidden">
          <button
            onClick={() => setToggle("abertos")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              toggle === "abertos"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Abertos
          </button>
          <button
            onClick={() => setToggle("fechados")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              toggle === "fechados"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Fechados
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-7 pr-3 text-xs rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Filters */}
        {effectiveView === "kanban" ? (
          <>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
              <option value="">Status</option>
              <option value="kickoff">Kickoff</option>
              <option value="design">Design</option>
              <option value="dev">Dev</option>
              <option value="review">Review</option>
              <option value="qa">QA</option>
              <option value="deploy">Deploy</option>
            </select>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className={selectClass}>
              <option value="">Tipo</option>
              <option value="feature">Feature</option>
              <option value="melhoria">Melhoria</option>
              <option value="bug">Bug</option>
              <option value="hotfix">Hotfix</option>
            </select>
            <select value={filterPrioridade} onChange={(e) => setFilterPrioridade(e.target.value)} className={selectClass}>
              <option value="">Prioridade</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="normal">Normal</option>
              <option value="baixa">Baixa</option>
            </select>
          </>
        ) : (
          <>
            <select value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className={selectClass}>
              <option value="">Responsável</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
              <option value="">Status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className={selectClass}>
              <option value="">Tipo</option>
              {tipos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </>
        )}

        {/* Right side: count + view toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            {totalCount} projetos
          </span>

          {/* Kanban / Lista segmented control */}
          <div className="inline-flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setViewMode("kanban")}
              disabled={toggle === "fechados"}
              className={`p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                effectiveView === "kanban"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="Kanban"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("lista")}
              className={`p-1.5 transition-colors ${
                effectiveView === "lista"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="Lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : effectiveView === "kanban" ? (
        /* ── Kanban View ──────────────────────────────────────────── */
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {filteredColumns.map((col: any) => (
              <div key={col.responsavel} className="w-72 flex-shrink-0">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                    {getInitials(col.responsavel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {col.responsavel}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${getLoadDot(col.total)}`} />
                    <span className="text-xs text-muted-foreground">
                      {col.total}
                    </span>
                  </div>
                </div>

                {/* Cards container */}
                <div className="rounded-lg bg-muted/30 p-3 space-y-2 min-h-[100px]">
                  {col.projetos.map((proj: any) => (
                    <ProjectCard
                      key={proj.clickup_task_id}
                      project={proj}
                      onClick={() => setSelectedProject(proj)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredProjetos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum projeto encontrado.
        </p>
      ) : (
        /* ── Lista View ───────────────────────────────────────────── */
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Nome</th>
                <th className="text-left py-2 px-3 font-medium">Status</th>
                <th className="text-left py-2 px-3 font-medium">Fase</th>
                <th className="text-left py-2 px-3 font-medium">Responsável</th>
                <th className="text-left py-2 px-3 font-medium">
                  {toggle === "fechados" ? "Entrega" : "Prazo"}
                </th>
                <th className="text-left py-2 px-3 font-medium">Urgência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProjetos.map((p: any) => {
                const id = p.clickup_task_id || p.clickupTaskId;
                const name = p.task_name || p.taskName;
                const status = p.status_projeto || p.statusProjeto || "";
                const fase = p.fase_projeto || p.faseProjeto || "";
                const vencimento = p.data_vencimento || p.dataVencimento;
                const dateToShow = toggle === "fechados" ? p.lancamento : vencimento;
                const urgency = getUrgencyForRow(vencimento);
                const selectedId =
                  selectedProject?.clickup_task_id || selectedProject?.clickupTaskId;
                const isSelected = selectedId === id;

                return (
                  <tr
                    key={id}
                    onClick={() => setSelectedProject(normalizeForDrawer(p))}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 text-sm font-medium text-foreground truncate max-w-xs">
                      {name}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="secondary" className="text-xs">
                        {status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {fase || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-muted-foreground truncate max-w-[150px]">
                      {p.responsavel || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {dateToShow
                        ? new Date(dateToShow).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${URGENCY_DOT_COLOR[urgency]}`} />
                        <span className="text-xs text-muted-foreground">
                          {URGENCY_LABEL[urgency]}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      <ProjectDrawer
        project={selectedProject}
        open={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
