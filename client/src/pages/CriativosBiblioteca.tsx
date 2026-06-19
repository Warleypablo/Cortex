import { useMemo, useState, type ReactNode } from "react";
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
import { Plus, Search, X, ExternalLink, Loader2, Pencil, Settings2, FileText, FolderOpen } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useCreativePerformance,
  type Creative,
  type CreativePerfRow,
} from "@/hooks/useCreatives";
import { CreativeFormSheet } from "@/components/criativos/biblioteca/CreativeFormSheet";
import { RankingPanel } from "@/components/criativos/biblioteca/RankingPanel";
import { VocabConfigDialog } from "@/components/criativos/biblioteca/VocabConfigDialog";
import {
  fmtBRL,
  fmtInt,
  fmtPct,
  fmtRoas,
  roasClass,
  windowFromPreset,
  WINDOW_PRESETS,
  type WindowPreset,
} from "@/lib/creativePerfFormat";

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

const FMT_STYLES: Record<string, string> = {
  "9x16": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "4x5": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "1x1": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "16x9": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};

/**
 * Extrai estrutura do nome do criativo: formato (9x16/4x5...) e variação (hook/body/cta),
 * e devolve um "nome base" limpo (sem o sufixo h_b_c_formato, underscores → espaços).
 * Robusto a separadores `_`, espaço e `-` e a zeros à esquerda (h01).
 */
function parseCreative(nomeDrive: string) {
  const noExt = (nomeDrive || "").replace(/\.[^.]+$/, "");
  const fmt = noExt.match(/(9x16|4x5|1x1|16x9)/i)?.[1]?.toLowerCase() ?? null;
  const m = noExt.match(/h\s*0*(\d+)\s*[_\s-]+b\s*0*(\d+)\s*[_\s-]+c\s*0*(\d+)/i);
  const hook = m?.[1] ?? null;
  const body = m?.[2] ?? null;
  const cta = m?.[3] ?? null;
  let base = m
    ? noExt.slice(0, m.index)
    : noExt.replace(/[_\s-]*(9x16|4x5|1x1|16x9)\s*$/i, "");
  base = base.replace(/[_\s-]+$/, "").replace(/_/g, " ").trim();
  return { fmt, hook, body, cta, base: base || noExt };
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-muted text-foreground/70">
      {children}
    </span>
  );
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

  // ---- Inteligência / performance ----
  const [tab, setTab] = useState<"biblioteca" | "inteligencia">("biblioteca");
  const [preset, setPreset] = useState<WindowPreset>("30d");
  const [vocabOpen, setVocabOpen] = useState(false);
  const win = useMemo(() => windowFromPreset(preset), [preset]);
  const { data: perf } = useCreativePerformance(win);
  const perfMap = useMemo(() => {
    const m = new Map<number, CreativePerfRow>();
    for (const r of perf?.rows ?? []) m.set(r.creativeId, r);
    return m;
  }, [perf]);

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
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
            <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={preset} onValueChange={(v) => setPreset(v as WindowPreset)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" title="Listas controladas" onClick={() => setVocabOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button onClick={() => setFormState({ mode: "create" })}>
              <Plus className="h-4 w-4 mr-2" /> Novo criativo
            </Button>
          </div>
        </div>

        <TabsContent value="biblioteca" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Biblioteca de Criativos</CardTitle>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
            {data?.total ?? 0} criativos cadastrados. Performance da janela{" "}
            <strong>{WINDOW_PRESETS.find((p) => p.value === preset)?.label.toLowerCase()}</strong>.
          </p>
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
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        (data?.rows ?? []).length > 0 &&
                        (data?.rows ?? []).every((r) => selectedIds.has(r.id))
                      }
                      onCheckedChange={() => togglePage(data?.rows ?? [])}
                    />
                  </TableHead>
                  <TableHead className="w-[88px] sticky left-0 bg-background z-10">TP</TableHead>
                  <TableHead className="min-w-[240px]">Criativo</TableHead>
                  <TableHead className="w-[150px]">Variação</TableHead>
                  <TableHead className="w-[90px]">Formato</TableHead>
                  <TableHead className="min-w-[110px]">Produto</TableHead>
                  <TableHead className="text-right border-l">Invest.</TableHead>
                  <TableHead className="text-right">Hook%</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">CAC</TableHead>
                  <TableHead className="text-right border-r">ROAS</TableHead>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[80px]">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && (data?.rows ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                      Nenhum criativo encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {(data?.rows ?? []).map((row, idx) => {
                  const meta = parseCreative(row.nomeDrive);
                  const p = perfMap.get(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      title={row.nomeFinal || undefined}
                      className={`cursor-pointer hover:bg-muted/60 ${idx % 2 ? "bg-muted/30" : ""}`}
                      onClick={() => setFormState({ mode: "edit", creative: row })}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleRow(row.id)}
                        />
                      </TableCell>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {row.tpId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium leading-tight truncate max-w-[280px]">
                          {meta.base}
                        </div>
                        {row.personagem && (
                          <div className="text-xs text-muted-foreground mt-0.5">{row.personagem}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {meta.hook || meta.body || meta.cta ? (
                          <div className="flex gap-1">
                            {meta.hook && <Chip>H{meta.hook}</Chip>}
                            {meta.body && <Chip>B{meta.body}</Chip>}
                            {meta.cta && <Chip>C{meta.cta}</Chip>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {meta.fmt ? (
                          <Badge variant="secondary" className={`font-mono ${FMT_STYLES[meta.fmt] ?? ""}`}>
                            {meta.fmt}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.produto || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Performance (janela selecionada) — vinda do read-back por ad_id */}
                      <TableCell className="text-right text-sm tabular-nums border-l">
                        {p ? fmtBRL(p.spend) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{p ? fmtPct(p.hookRate) : "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{p ? fmtPct(p.ctr) : "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{p ? fmtInt(p.leads) : "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{p ? fmtInt(p.vendas) : "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{p ? fmtBRL(p.cac) : "—"}</TableCell>
                      <TableCell className={`text-right text-sm tabular-nums border-r ${p ? roasClass(p.roas) : ""}`}>
                        {p ? fmtRoas(p.roas) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateBr(row.dataPostagem)}
                      </TableCell>
                      <TableCell>
                        {row.adValidado ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Validado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {row.roteiroUrl ? (
                            <a
                              href={row.roteiroUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir roteiro (Google Doc)"
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              <FileText className="h-4 w-4" />
                            </a>
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground/30" aria-label="sem roteiro" />
                          )}
                          {row.linkDrive ? (
                            <a
                              href={row.linkDrive}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir no Drive (arquivo do ad)"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <ExternalLink className="h-4 w-4 text-muted-foreground/30" aria-label="sem link do Drive" />
                          )}
                          {row.driveFolderId && (
                            <a
                              href={`https://drive.google.com/drive/folders/${row.driveFolderId}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir a pasta do ad no Drive"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <FolderOpen className="h-4 w-4" />
                            </a>
                          )}
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
        </TabsContent>

        <TabsContent value="inteligencia" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Inteligência de criativos</CardTitle>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                Qual <strong>tipo</strong> de criativo converte melhor — vira briefing pro próximo
                roteiro. Janela{" "}
                <strong>{WINDOW_PRESETS.find((pp) => pp.value === preset)?.label.toLowerCase()}</strong>.
              </p>
            </CardHeader>
            <CardContent>
              <RankingPanel win={win} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      <VocabConfigDialog open={vocabOpen} onClose={() => setVocabOpen(false)} />
    </div>
  );
}
