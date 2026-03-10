import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronDown, Plus, Trash2, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Entregavel {
  id: number;
  contrato_id: number;
  contrato_item_id: number | null;
  parent_id: number | null;
  titulo: string;
  descricao: string | null;
  status: string;
  responsavel: string | null;
  prazo: string | null;
  data_conclusao: string | null;
  prioridade: string;
  ordem: number;
  nivel: number;
  depth: number;
}

interface TreeNode extends Entregavel {
  children: TreeNode[];
}

function buildTree(items: Entregavel[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function countLeaves(node: TreeNode): { total: number; done: number } {
  if (node.children.length === 0) {
    return { total: 1, done: node.status === "concluido" ? 1 : 0 };
  }
  return node.children.reduce(
    (acc, child) => {
      const c = countLeaves(child);
      return { total: acc.total + c.total, done: acc.done + c.done };
    },
    { total: 0, done: 0 }
  );
}

const prioridadeColors: Record<string, string> = {
  alta: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  media: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  baixa: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function EntregavelNode({
  node,
  onToggle,
  onDelete,
}: {
  node: TreeNode;
  onToggle: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isOverdue = node.prazo && new Date(node.prazo) < new Date() && node.status !== "concluido";
  const { total, done } = countLeaves(node);

  return (
    <div className="ml-0">
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800/50 group ${isOverdue ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-gray-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <Checkbox
          checked={node.status === "concluido"}
          onCheckedChange={(checked) =>
            onToggle(node.id, checked ? "concluido" : "pendente")
          }
        />

        <span className={`flex-1 text-sm ${node.status === "concluido" ? "line-through text-gray-400 dark:text-zinc-500" : "text-gray-900 dark:text-white"}`}>
          {node.titulo}
        </span>

        {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500" />}

        {hasChildren && (
          <span className="text-xs text-gray-400 dark:text-zinc-500">{done}/{total}</span>
        )}

        <Badge variant="outline" className={`text-[10px] ${prioridadeColors[node.prioridade] || ""}`}>
          {node.prioridade}
        </Badge>

        {node.prazo && (
          <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400 dark:text-zinc-500"}`}>
            {new Date(node.prazo).toLocaleDateString("pt-BR")}
          </span>
        )}

        <button
          onClick={() => onDelete(node.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {hasChildren && expanded && (
        <div className="ml-6 border-l border-gray-200 dark:border-zinc-700 pl-2">
          {node.children.map((child) => (
            <EntregavelNode key={child.id} node={child} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EntregaveisChecklist({ contratoId }: { contratoId: number }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: entregaveis = [], isLoading } = useQuery<Entregavel[]>({
    queryKey: ["/api/contratos", contratoId, "entregaveis"],
    queryFn: () => fetch(`/api/contratos/${contratoId}/entregaveis`).then((r) => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/contratos/entregaveis/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/contratos/entregaveis/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] }),
  });

  const createMutation = useMutation({
    mutationFn: (titulo: string) =>
      fetch(`/api/contratos/${contratoId}/entregaveis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo }),
      }),
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => fetch(`/api/contratos/${contratoId}/gerar-entregaveis`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] }),
  });

  const tree = buildTree(entregaveis);
  const allLeaves = entregaveis.filter((e) => !entregaveis.some((c) => c.parent_id === e.id));
  const doneLeaves = allLeaves.filter((e) => e.status === "concluido");
  const overdueCount = entregaveis.filter((e) => e.prazo && new Date(e.prazo) < new Date() && e.status !== "concluido").length;
  const progress = allLeaves.length > 0 ? Math.round((doneLeaves.length / allLeaves.length) * 100) : 0;

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Entregaveis</h3>
          <span className="text-xs text-gray-400">{doneLeaves.length}/{allLeaves.length}</span>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {overdueCount} atrasado{overdueCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="text-xs"
        >
          {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
          Gerar via IA
        </Button>
      </div>

      <Progress value={progress} className="h-2" />

      {tree.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4">
          Nenhum entregavel. Clique em "Gerar via IA" ou adicione manualmente.
        </p>
      ) : (
        <div className="space-y-0.5">
          {tree.map((node) => (
            <EntregavelNode
              key={node.id}
              node={node}
              onToggle={(id, status) => toggleMutation.mutate({ id, status })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Novo entregavel..."
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMutation.mutate(newTitle.trim())}
        />
        <Button
          size="sm"
          onClick={() => newTitle.trim() && createMutation.mutate(newTitle.trim())}
          disabled={!newTitle.trim() || createMutation.isPending}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}