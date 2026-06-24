import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CapacityMetaDialog, CATEGORIA_LABELS } from "./CapacityMetaDialog";

export interface CapacityMeta {
  id: number;
  nome: string;
  match_responsavel: string;
  categoria: string;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  ordem: number;
  ativo: boolean;
}

export interface ResponsavelOption {
  responsavel: string;
  contratos: number;
  mrr: number;
}

function fmtCap(v: number | null): string {
  return v === null ? "—" : new Intl.NumberFormat("pt-BR").format(v);
}

export function CapacityMetasConfig() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CapacityMeta | null>(null);
  const [toDelete, setToDelete] = useState<CapacityMeta | null>(null);

  const { data: metas, isLoading } = useQuery<CapacityMeta[]>({
    queryKey: ["/api/capacity-metas"],
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/capacity-metas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/capacity-times"] });
  }

  const toggleMutation = useMutation({
    mutationFn: async (m: CapacityMeta) => {
      await apiRequest("PUT", `/api/capacity-metas/${m.id}`, { ...m, ativo: !m.ativo });
    },
    onSuccess: invalidateAll,
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/capacity-metas/${id}`); },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Operador removido" });
      setToDelete(null);
    },
    onError: (e: Error) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Configure a capacity de cada operador. As edições alimentam os cálculos das outras abas.
        </p>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="capacity-add">
          <Plus className="h-4 w-4 mr-1" /> Adicionar operador
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-zinc-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead className="text-right">Cap. MRR</TableHead>
              <TableHead className="text-right">Cap. Pont.</TableHead>
              <TableHead className="text-right">Cap. Contas</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(metas ?? []).map((m) => (
              <TableRow key={m.id} className={m.ativo ? "" : "opacity-50"}>
                <TableCell>{m.ordem}</TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">{m.nome}</TableCell>
                <TableCell className="text-gray-600 dark:text-zinc-400">
                  {CATEGORIA_LABELS[m.categoria] ?? m.categoria}
                </TableCell>
                <TableCell className="text-gray-600 dark:text-zinc-400">{m.match_responsavel}</TableCell>
                <TableCell className="text-right">{fmtCap(m.cap_mrr)}</TableCell>
                <TableCell className="text-right">{fmtCap(m.cap_pontual)}</TableCell>
                <TableCell className="text-right">{fmtCap(m.cap_contas)}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={m.ativo}
                    onCheckedChange={() => toggleMutation.mutate(m)}
                    data-testid={`capacity-toggle-${m.id}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setDialogOpen(true); }}
                      data-testid={`capacity-edit-${m.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(m)}
                      data-testid={`capacity-delete-${m.id}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CapacityMetaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        meta={editing}
        existingCategorias={Array.from(new Set((metas ?? []).map((m) => m.categoria)))}
        onSaved={invalidateAll}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover operador?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.nome}" será removido permanentemente. Para apenas pausar, use o toggle "Ativo".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
