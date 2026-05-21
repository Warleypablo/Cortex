import { useMemo, useState } from "react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, X, ExternalLink, Loader2, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useCreativesList,
  useCreativeOptions,
  useBulkUpdateCreatives,
  type Creative,
} from "@/hooks/useCreatives";
import { CreativeFormSheet } from "@/components/criativos/biblioteca/CreativeFormSheet";

const PAGE_SIZE = 50;

function formatDateBr(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export default function CriativosBiblioteca() {
  usePageTitle("Biblioteca de Criativos");
  useSetPageInfo("Biblioteca de Criativos", "Cadastro central de criativos da Turbo");

  const [q, setQ] = useState("");
  const [personagem, setPersonagem] = useState<string>("todos");
  const [produto, setProduto] = useState<string>("todos");
  const [adValidado, setAdValidado] = useState<string>("todos");
  const [page, setPage] = useState(1);

  const [formState, setFormState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; creative: Creative }
  >({ mode: "closed" });

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkPatch, setBulkPatch] = useState<Record<string, string>>({});
  const bulkUpdate = useBulkUpdateCreatives();
  const { toast } = useToast();

  const toggleRow = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = (rows: Creative[]) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = rows.length > 0 && rows.every((r) => next.has(r.id));
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkSave = async () => {
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(bulkPatch)) {
      if (v === "" || v === "__keep__") continue;
      if (k === "adValidado") patch[k] = v === "true";
      else patch[k] = v;
    }
    if (Object.keys(patch).length === 0) {
      toast({ title: "Nenhum campo selecionado pra alterar", variant: "destructive" });
      return;
    }
    try {
      const res = await bulkUpdate.mutateAsync({ ids: Array.from(selectedIds), patch });
      toast({
        title: `${res.updated} atualizado(s)`,
        description: res.failed > 0 ? `${res.failed} falharam` : undefined,
      });
      setBulkEditOpen(false);
      setBulkPatch({});
      clearSelection();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const params = useMemo(
    () => ({
      q: q.trim() || undefined,
      personagem: personagem !== "todos" ? personagem : undefined,
      produto: produto !== "todos" ? produto : undefined,
      adValidado:
        adValidado === "true" ? true : adValidado === "false" ? false : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [q, personagem, produto, adValidado, page],
  );

  const { data, isLoading } = useCreativesList(params);
  const { data: options } = useCreativeOptions();

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const clearFilters = () => {
    setQ("");
    setPersonagem("todos");
    setProduto("todos");
    setAdValidado("todos");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Biblioteca de Criativos</CardTitle>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              {data?.total ?? 0} criativos cadastrados. Esta é a fonte do{" "}
              <strong>Nome Final</strong> usado no Meta Ads.
            </p>
          </div>
          <Button onClick={() => setFormState({ mode: "create" })}>
            <Plus className="h-4 w-4 mr-2" /> Novo criativo
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por TP, Nome Drive, Nome Final, Personagem..."
                className="pl-9"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={personagem}
              onValueChange={(v) => {
                setPersonagem(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Personagem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos personagens</SelectItem>
                {(options?.personagem ?? []).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={produto}
              onValueChange={(v) => {
                setProduto(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos produtos</SelectItem>
                {(options?.produto ?? []).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={adValidado}
              onValueChange={(v) => {
                setAdValidado(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Validado?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="true">Validado</SelectItem>
                <SelectItem value="false">Não validado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" /> Limpar
            </Button>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-2 border border-blue-500/30 bg-blue-500/5 rounded">
              <span className="text-sm font-medium">
                {selectedIds.size} selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar selecionados
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Limpar seleção
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        (data?.rows ?? []).length > 0 &&
                        (data?.rows ?? []).every((r) => selectedIds.has(r.id))
                      }
                      onCheckedChange={() => togglePage(data?.rows ?? [])}
                    />
                  </TableHead>
                  <TableHead className="w-[80px] sticky left-0 bg-background z-10">TP</TableHead>
                  <TableHead className="min-w-[200px]">Nome Drive</TableHead>
                  <TableHead className="min-w-[120px]">Personagem</TableHead>
                  <TableHead className="min-w-[120px]">Produto</TableHead>
                  <TableHead className="min-w-[120px]">Data Postagem</TableHead>
                  <TableHead className="min-w-[260px]">Nome Final</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && (data?.rows ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      Nenhum criativo encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {(data?.rows ?? []).map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800"
                    onClick={() => setFormState({ mode: "edit", creative: row })}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={() => toggleRow(row.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono sticky left-0 bg-background z-10">
                      {row.tpId}
                    </TableCell>
                    <TableCell className="font-medium">{row.nomeDrive}</TableCell>
                    <TableCell>{row.personagem || "—"}</TableCell>
                    <TableCell>{row.produto || "—"}</TableCell>
                    <TableCell>{formatDateBr(row.dataPostagem)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.nomeFinal}</TableCell>
                    <TableCell>
                      {row.adValidado ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Validado
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {row.linkDrive && (
                        <a
                          href={row.linkDrive}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {(data?.total ?? 0) > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-zinc-400">
              <span>
                Página {page} de {totalPages} • {data?.total} criativos
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreativeFormSheet
        open={formState.mode !== "closed"}
        mode={formState.mode === "edit" ? "edit" : "create"}
        creative={formState.mode === "edit" ? formState.creative : null}
        onClose={() => setFormState({ mode: "closed" })}
      />

      <Dialog open={bulkEditOpen} onOpenChange={(v) => { if (!v) { setBulkEditOpen(false); setBulkPatch({}); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.size} criativo(s)</DialogTitle>
            <DialogDescription>
              Os campos preenchidos serão aplicados a todos os selecionados. Deixe vazio pra não alterar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {[
              { key: "personagem", label: "Personagem", opts: options?.personagem },
              { key: "produto", label: "Produto", opts: options?.produto },
              { key: "etapaFunil", label: "Etapa Funil", opts: options?.etapaFunil },
              { key: "plataforma", label: "Plataforma", opts: options?.plataforma },
              { key: "tipoAd", label: "Tipo Ad", opts: options?.tipoAd },
            ].map((f) => (
              <div key={f.key}>
                <Label className="text-xs">{f.label}</Label>
                <Select
                  value={bulkPatch[f.key] ?? "__keep__"}
                  onValueChange={(v) => setBulkPatch((s) => ({ ...s, [f.key]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep__">Não alterar</SelectItem>
                    {(f.opts ?? []).map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div>
              <Label className="text-xs">Status validação</Label>
              <Select
                value={bulkPatch.adValidado ?? "__keep__"}
                onValueChange={(v) => setBulkPatch((s) => ({ ...s, adValidado: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">Não alterar</SelectItem>
                  <SelectItem value="true">Validado</SelectItem>
                  <SelectItem value="false">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkEditOpen(false); setBulkPatch({}); }}>
              Cancelar
            </Button>
            <Button onClick={handleBulkSave} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Aplicar a {selectedIds.size} criativo(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
