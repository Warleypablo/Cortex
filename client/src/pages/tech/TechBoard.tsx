import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import ProjectCard from "@/components/tech/ProjectCard";
import ProjectDrawer from "@/components/tech/ProjectDrawer";

function getInitials(name: string): string {
  const parts = name.split(/[\s;]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] || '?').toUpperCase();
}

function getCargaInfo(count: number): { label: string; color: string } {
  if (count > 7) return { label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
  if (count >= 4) return { label: 'Média', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  return { label: 'OK', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
}

export default function TechBoard() {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterPrioridade, setFilterPrioridade] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filterStatus) p.set('status', filterStatus);
    if (filterTipo) p.set('tipo', filterTipo);
    if (filterPrioridade) p.set('prioridade', filterPrioridade);
    return p.toString();
  }, [filterStatus, filterTipo, filterPrioridade]);

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['/api/tech/board', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/tech/board?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const totalProjects = columns.reduce((sum: number, col: any) => sum + col.total, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
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
          onChange={e => setFilterTipo(e.target.value)}
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
          onChange={e => setFilterPrioridade(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
        >
          <option value="">Prioridade</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
          <option value="baixa">Baixa</option>
        </select>
        <span className="text-sm text-gray-500 dark:text-zinc-400 ml-auto">
          {totalProjects} projetos
        </span>
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {columns.map((col: any) => {
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
                      <span className="text-xs text-gray-500 dark:text-zinc-400">{col.total} projetos</span>
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

      {/* Drawer */}
      <ProjectDrawer
        project={selectedProject}
        open={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
