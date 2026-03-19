import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, LayoutGrid, List } from "lucide-react";
import ProjectCard from "@/components/tech/ProjectCard";
import ProjectDrawer from "@/components/tech/ProjectDrawer";

// ── Helpers ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.split(/[\s;]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] || "?").toUpperCase();
}

function getCargaInfo(count: number): { label: string; color: string } {
  if (count > 7) return { label: "Alta", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (count >= 4) return { label: "Media", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: "OK", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
}

function getStatusColor(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("design")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
  if (s.includes("dev")) return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
  if (s.includes("review")) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  if (s.includes("qa")) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  if (s.includes("deploy")) return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
  if (s.includes("done") || s.includes("closed")) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (s.includes("kickoff")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
}

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

  // When switching to fechados, force lista view (kanban only shows abertos)
  const effectiveView = toggle === "fechados" ? "lista" : viewMode;

  // ── Kanban data (board grouped by responsavel) ─────────────────────
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

  // ── Lista data (all projects) ──────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Abertos / Fechados */}
        <div className="flex rounded-lg border border-gray-300 dark:border-zinc-600 overflow-hidden">
          <button
            onClick={() => setToggle("abertos")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              toggle === "abertos"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
            }`}
          >
            Abertos
          </button>
          <button
            onClick={() => setToggle("fechados")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              toggle === "fechados"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
            }`}
          >
            Fechados
          </button>
        </div>

        {/* Kanban / Lista toggle */}
        <div className="flex rounded-lg border border-gray-300 dark:border-zinc-600 overflow-hidden">
          <button
            onClick={() => setViewMode("kanban")}
            disabled={toggle === "fechados"}
            className={`px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              effectiveView === "kanban"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
            }`}
            title="Kanban"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("lista")}
            className={`px-2.5 py-1.5 text-sm font-medium transition-colors ${
              effectiveView === "lista"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
            }`}
            title="Lista"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-500"
          />
        </div>

        {/* Filters (shared) */}
        {effectiveView === "kanban" ? (
          <>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
            >
              <option value="">Status</option>
              <option value="kickoff">Kickoff</option>
              <option value="design">Design</option>
              <option value="dev">Dev</option>
              <option value="review">Review</option>
              <option value="qa">QA</option>
              <option value="deploy">Deploy</option>
            </select>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
            >
              <option value="">Tipo</option>
              <option value="feature">Feature</option>
              <option value="melhoria">Melhoria</option>
              <option value="bug">Bug</option>
              <option value="hotfix">Hotfix</option>
            </select>
            <select
              value={filterPrioridade}
              onChange={(e) => setFilterPrioridade(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
            >
              <option value="">Prioridade</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="normal">Normal</option>
              <option value="baixa">Baixa</option>
            </select>
          </>
        ) : (
          <>
            <select
              value={filterResponsavel}
              onChange={(e) => setFilterResponsavel(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
            >
              <option value="">Responsavel</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
            >
              <option value="">Status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
            >
              <option value="">Tipo</option>
              {tipos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </>
        )}

        <span className="text-sm text-gray-500 dark:text-zinc-400 ml-auto">
          {totalCount} projetos
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : effectiveView === "kanban" ? (
        /* ── Kanban View ──────────────────────────────────────────── */
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {filteredColumns.map((col: any) => {
              const carga = getCargaInfo(col.total);
              return (
                <div key={col.responsavel} className="w-72 flex-shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      {getInitials(col.responsavel)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {col.responsavel}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 dark:text-zinc-400">
                          {col.total} projetos
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${carga.color}`}>
                          {carga.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {col.projetos.map((proj: any) => (
                      <ProjectCard
                        key={proj.clickup_task_id}
                        project={proj}
                        onClick={() => setSelectedProject(proj)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filteredProjetos.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500 py-8 text-center">
          Nenhum projeto encontrado.
        </p>
      ) : (
        /* ── Lista View ───────────────────────────────────────────── */
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-900">
              <tr className="text-xs text-gray-500 dark:text-zinc-400 uppercase">
                <th className="text-left py-2 px-3 font-medium">Projeto</th>
                <th className="text-left py-2 px-3 font-medium">Status</th>
                <th className="text-left py-2 px-3 font-medium">Responsavel</th>
                <th className="text-left py-2 px-3 font-medium">Fase</th>
                <th className="text-left py-2 px-3 font-medium">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjetos.map((p: any) => {
                const id = p.clickup_task_id || p.clickupTaskId;
                const name = p.task_name || p.taskName;
                const status = p.status_projeto || p.statusProjeto || "";
                const fase = p.fase_projeto || p.faseProjeto || "";
                const vencimento = p.data_vencimento || p.dataVencimento;
                const selectedId =
                  selectedProject?.clickup_task_id || selectedProject?.clickupTaskId;
                const isSelected = selectedId === id;

                return (
                  <tr
                    key={id}
                    onClick={() => setSelectedProject(normalizeForDrawer(p))}
                    className={`cursor-pointer border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-l-indigo-500"
                        : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                      {name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(status)}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-600 dark:text-zinc-400 truncate max-w-[150px]">
                      {p.responsavel || "\u2014"}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-600 dark:text-zinc-400">
                      {fase || "\u2014"}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-600 dark:text-zinc-400">
                      {vencimento
                        ? new Date(vencimento).toLocaleDateString("pt-BR")
                        : "\u2014"}
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
