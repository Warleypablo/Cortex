import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, RefreshCw, Database, Settings2, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Override {
  id: number;
  year: number;
  month: number;
  metric_key: string;
  override_value: string;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface ContractStatus {
  id: number;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RecomputeResult {
  success: boolean;
  year: number;
  baseMetricsComputed: number;
  derivedMetricsComputed: number;
  overridesApplied: number;
  errors?: string[];
}

const MONTHS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

function OverridesTab() {
  const { toast } = useToast();
  const [year] = useState(2026);
  const [newOverride, setNewOverride] = useState({ month: "", metricKey: "", overrideValue: "", note: "" });
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: overrides = [], isLoading, refetch } = useQuery<Override[]>({
    queryKey: ["/api/kpi/overrides", year],
  });

  const { data: metrics = [] } = useQuery<any[]>({
    queryKey: ["/api/okr2026/metrics-registry"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newOverride) => {
      const res = await fetch("/api/kpi/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month: parseInt(data.month),
          metricKey: data.metricKey,
          overrideValue: parseFloat(data.overrideValue),
          note: data.note || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create override");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/overrides"] });
      setNewOverride({ month: "", metricKey: "", overrideValue: "", note: "" });
      setDialogOpen(false);
      toast({ title: "Override criado", description: "O valor foi salvo com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar override.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/kpi/overrides/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/overrides"] });
      toast({ title: "Override removido" });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Overrides Manuais</h3>
          <p className="text-sm text-muted-foreground">Valores manuais que sobrescrevem os cálculos automáticos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-overrides">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-override">
                <Plus className="h-4 w-4 mr-2" />
                Novo Override
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Override Manual</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select value={newOverride.month} onValueChange={(v) => setNewOverride({ ...newOverride, month: v })}>
                      <SelectTrigger data-testid="select-month">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Métrica</Label>
                    <Select value={newOverride.metricKey} onValueChange={(v) => setNewOverride({ ...newOverride, metricKey: v })}>
                      <SelectTrigger data-testid="select-metric">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {metrics.map((m: any) => (
                          <SelectItem key={m.metric_key} value={m.metric_key}>{m.title || m.metric_key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 1500000"
                    value={newOverride.overrideValue}
                    onChange={(e) => setNewOverride({ ...newOverride, overrideValue: e.target.value })}
                    data-testid="input-override-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nota (opcional)</Label>
                  <Input
                    placeholder="Justificativa do override..."
                    value={newOverride.note}
                    onChange={(e) => setNewOverride({ ...newOverride, note: e.target.value })}
                    data-testid="input-override-note"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(newOverride)}
                  disabled={!newOverride.month || !newOverride.metricKey || !newOverride.overrideValue || createMutation.isPending}
                  data-testid="button-save-override"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Override
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {overrides.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum override cadastrado para {year}.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Atualizado por</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((o) => (
                <TableRow key={o.id} data-testid={`row-override-${o.id}`}>
                  <TableCell>
                    <Badge variant="secondary">{MONTHS.find((m) => m.value === String(o.month))?.label || o.month}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{o.metric_key}</TableCell>
                  <TableCell className="text-right font-medium">
                    {parseFloat(o.override_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{o.note || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{o.updated_by || "-"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(o.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-override-${o.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function ContractStatusTab() {
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState("");

  const { data: statuses = [], isLoading, refetch } = useQuery<ContractStatus[]>({
    queryKey: ["/api/admin/contract-status-map"],
  });

  const createMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch("/api/admin/contract-status-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, isActive: false }),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contract-status-map"] });
      setNewStatus("");
      toast({ title: "Status adicionado" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/admin/contract-status-map/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contract-status-map"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/contract-status-map/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contract-status-map"] });
      toast({ title: "Status removido" });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Mapeamento de Status de Contratos</h3>
          <p className="text-sm text-muted-foreground">Define quais status são considerados "ativos" para cálculo de MRR</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-status">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Novo status..."
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="max-w-xs"
              data-testid="input-new-status"
            />
            <Button
              onClick={() => createMutation.mutate(newStatus)}
              disabled={!newStatus || createMutation.isPending}
              data-testid="button-add-status"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ativo?</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((s) => (
                <TableRow key={s.id} data-testid={`row-status-${s.id}`}>
                  <TableCell className="font-medium">{s.status}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: s.id, isActive: checked })}
                      data-testid={`switch-status-${s.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(s.id)}
                      data-testid={`button-delete-status-${s.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionsTab() {
  const { toast } = useToast();
  const [recomputeResult, setRecomputeResult] = useState<RecomputeResult | null>(null);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/okr2026/seed-bp", { method: "POST" });
      if (!res.ok) throw new Error("Failed to seed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Seed BP 2026 concluído",
        description: `${data.metricsProcessed} métricas, ${data.targetsUpserted} targets`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health"] });
    },
    onError: () => {
      toast({ title: "Erro no seed", variant: "destructive" });
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/kpi/recompute?year=2026", { method: "POST" });
      if (!res.ok) throw new Error("Failed to recompute");
      return res.json();
    },
    onSuccess: (data: RecomputeResult) => {
      setRecomputeResult(data);
      toast({
        title: "Recompute concluído",
        description: `${data.baseMetricsComputed} base, ${data.derivedMetricsComputed} derived`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health"] });
    },
    onError: () => {
      toast({ title: "Erro no recompute", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Ações do Sistema</h3>
        <p className="text-sm text-muted-foreground">Executar operações administrativas do motor KPI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-5 w-5" />
              Seed BP 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Popula o registro de métricas e targets mensais com os valores do Business Plan 2026.
            </p>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="w-full"
              data-testid="button-seed-bp"
            >
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
              Executar Seed
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-5 w-5" />
              Recompute KPIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Recalcula todos os actuals do ano 2026, aplicando overrides e fórmulas derivadas.
            </p>
            <Button
              onClick={() => recomputeMutation.mutate()}
              disabled={recomputeMutation.isPending}
              className="w-full"
              data-testid="button-recompute"
            >
              {recomputeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Recompute
            </Button>
          </CardContent>
        </Card>
      </div>

      {recomputeResult && (
        <Card className={recomputeResult.success ? "border-green-500/50" : "border-red-500/50"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {recomputeResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Resultado do Recompute
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{recomputeResult.baseMetricsComputed}</p>
                <p className="text-sm text-muted-foreground">Métricas Base</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{recomputeResult.derivedMetricsComputed}</p>
                <p className="text-sm text-muted-foreground">Métricas Derivadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{recomputeResult.overridesApplied}</p>
                <p className="text-sm text-muted-foreground">Overrides Aplicados</p>
              </div>
            </div>
            {recomputeResult.errors && recomputeResult.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
                <p className="text-sm font-medium text-red-500 mb-2">Erros:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {recomputeResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminOverrides() {
  useSetPageInfo("Motor KPI", "Gerenciamento de overrides, status e recompute");

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-overrides">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Motor KPI</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento de overrides, mapeamentos e ações administrativas</p>
        </div>
      </div>

      <Tabs defaultValue="actions" className="w-full">
        <TabsList data-testid="tabs-admin">
          <TabsTrigger value="actions" data-testid="tab-actions">Ações</TabsTrigger>
          <TabsTrigger value="overrides" data-testid="tab-overrides">Overrides</TabsTrigger>
          <TabsTrigger value="status" data-testid="tab-status">Status Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-6">
          <ActionsTab />
        </TabsContent>

        <TabsContent value="overrides" className="mt-6">
          <OverridesTab />
        </TabsContent>

        <TabsContent value="status" className="mt-6">
          <ContractStatusTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
