import { useMemo, useState } from "react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Plus, Search, X, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
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
  useUpdateCreative,
  useDeleteCreative,
  useCreativeMetricsByTp,
  type Creative,
} from "@/hooks/useCreatives";
import { CreativeFormSheet } from "@/components/criativos/biblioteca/CreativeFormSheet";
import {
  InlineText,
  InlineSelect,
  InlineDate,
  InlineValidado,
} from "@/components/criativos/biblioteca/InlineCells";
import { formatCurrency, formatPercent, formatDecimal } from "@/lib/utils";

const PAGE_SIZE = 50;

function MetricCell({
  value,
  format,
}: {
  value: number | null | undefined;
  format: (n: number) => string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-gray-300 dark:text-zinc-600">—</span>;
  }
  return <span className="tabular-nums">{format(value)}</span>;
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
  const updateCreative = useUpdateCreative();
  const deleteCreative = useDeleteCreative();
  const { data: metricsByTp } = useCreativeMetricsByTp();
  const { toast } = useToast();

  const patchField = (id: number, patch: Partial<Creative>) => {
    updateCreative.mutate(
      { id, patch: patch as any },
      {
        onError: (e: any) =>
          toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (row: Creative) => {
    if (!window.confirm(`Apagar o criativo ${row.tpId}? Esta ação não pode ser desfeita.`)) return;
    deleteCreative.mutate(row.id, {
      onSuccess: () => toast({ title: `${row.tpId} apagado` }),
      onError: (e: any) =>
        toast({ title: "Erro ao apagar", description: e.message, variant: "destructive" }),
    });
  };

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
                  <TableHead className="min-w-[130px]">Personagem</TableHead>
                  <TableHead className="min-w-[130px]">Produto</TableHead>
                  <TableHead className="min-w-[130px]">Ângulo</TableHead>
                  <TableHead className="min-w-[150px]">Data Postagem</TableHead>
                  <TableHead className="min-w-[240px]">Nome Final</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="text-right min-w-[90px]">Video Hook</TableHead>
                  <TableHead className="text-right min-w-[90px]">Video Hold</TableHead>
                  <TableHead className="text-right min-w-[70px]">CTR</TableHead>
                  <TableHead className="text-right min-w-[110px]">Investimento</TableHead>
                  <TableHead className="text-right min-w-[70px]">Leads</TableHead>
                  <TableHead className="text-right min-w-[70px]">MQLs</TableHead>
                  <TableHead className="text-right min-w-[80px]">% MQL</TableHead>
                  <TableHead className="text-right min-w-[70px]">Vendas</TableHead>
                  <TableHead className="text-right min-w-[100px]">CAC</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={19} className="text-center py-8">
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
                {(data?.rows ?? []).map((row) => {
                  const m = metricsByTp?.get(row.tpId);
                  return (
                  <TableRow
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={() => toggleRow(row.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono sticky left-0 bg-background z-10">
                      {row.tpId}
                    </TableCell>
                    <TableCell className="font-medium">
                      <InlineText
                        value={row.nomeDrive}
                        onCommit={(v) => patchField(row.id, { nomeDrive: v ?? "" })}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={row.personagem}
                        options={options?.personagem ?? []}
                        onCommit={(v) => patchField(row.id, { personagem: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={row.produto}
                        options={options?.produto ?? []}
                        onCommit={(v) => patchField(row.id, { produto: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineText
                        value={row.angulo}
                        onCommit={(v) => patchField(row.id, { angulo: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineDate
                        value={row.dataPostagem}
                        onCommit={(v) => patchField(row.id, { dataPostagem: v })}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.nomeFinal}</TableCell>
                    <TableCell>
                      <InlineValidado
                        value={row.adValidado}
                        onCommit={(v) => patchField(row.id, { adValidado: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.videoHook} format={(n) => formatPercent(n, 1)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.videoHold} format={(n) => formatPercent(n, 1)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.ctr} format={(n) => formatPercent(n, 2)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.investimento} format={formatCurrency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.leads} format={(n) => formatDecimal(n, 0)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.mql} format={(n) => formatDecimal(n, 0)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.percMql} format={(n) => formatPercent(n, 1)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.vendas} format={(n) => formatDecimal(n, 0)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricCell value={m?.cacGeral} format={formatCurrency} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {row.linkDrive && (
                          <a
                            href={row.linkDrive}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                            title="Abrir no Drive"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Apagar criativo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
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
