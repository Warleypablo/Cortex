import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import type { Benefit, InsertBenefit } from "@shared/schema";
import { insertBenefitSchema, benefitSegmentEnum } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Search, Plus, Copy, Edit, Trash2, ExternalLink, Loader2, ChevronDown, ChevronRight, Gift, Tag, Percent, LayoutGrid, Table2, ArrowUpDown } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortField = 'empresa' | 'cupom' | 'desconto' | 'segmento';
type SortDirection = 'asc' | 'desc';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const segmentIcons: Record<string, string> = {
  alimentos: "Alimentos",
  beleza_cosmeticos: "Beleza",
  casa_cozinha: "Casa",
  tecnologia: "Tech",
  pet: "Pet",
  plantas_agro: "Agro",
  suplementacao: "Fitness",
  moda: "Moda",
};

const segmentColors: Record<string, string> = {
  alimentos: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  beleza_cosmeticos: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  casa_cozinha: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  tecnologia: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pet: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  plantas_agro: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  suplementacao: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  moda: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const segmentLabels: Record<string, string> = {
  alimentos: "Alimentos",
  beleza_cosmeticos: "Beleza & Cosméticos",
  casa_cozinha: "Casa & Cozinha",
  tecnologia: "Tecnologia",
  pet: "Pet",
  plantas_agro: "Plantas & Agro",
  suplementacao: "Suplementação",
  moda: "Moda",
};

function AddBenefitDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertBenefit>({
    resolver: zodResolver(insertBenefitSchema),
    defaultValues: {
      empresa: "",
      cupom: "",
      desconto: "",
      site: "",
      segmento: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertBenefit) => {
      const response = await apiRequest("POST", "/api/beneficios", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficios"] });
      toast({
        title: "Benefício adicionado",
        description: "O benefício foi adicionado com sucesso.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar benefício",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertBenefit) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-benefit">
          <Plus className="w-4 h-4 mr-2" />
          Novo Benefício
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Benefício</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo benefício. O campo Empresa é obrigatório.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="empresa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-benefit-empresa" placeholder="Nome da empresa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cupom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cupom</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-benefit-cupom" placeholder="Código do cupom" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="desconto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desconto</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-benefit-desconto" placeholder="Ex: 10%, R$ 50, Frete Grátis" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-benefit-site" placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="segmento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-benefit-segmento">
                        <SelectValue placeholder="Selecione o segmento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {benefitSegmentEnum.map((segmento) => (
                        <SelectItem key={segmento} value={segmento}>
                          {segmentLabels[segmento]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-benefit"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-benefit"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditBenefitDialog({
  benefit,
  open,
  onOpenChange,
}: {
  benefit: Benefit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<InsertBenefit>({
    resolver: zodResolver(insertBenefitSchema),
    defaultValues: {
      empresa: benefit.empresa || "",
      cupom: benefit.cupom || "",
      desconto: benefit.desconto || "",
      site: benefit.site || "",
      segmento: benefit.segmento || undefined,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertBenefit) => {
      const response = await apiRequest("PATCH", `/api/beneficios/${benefit.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficios"] });
      toast({
        title: "Benefício atualizado",
        description: "O benefício foi atualizado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar benefício",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertBenefit) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Benefício</DialogTitle>
          <DialogDescription>
            Atualize as informações do benefício {benefit.empresa}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="empresa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-benefit-empresa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cupom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cupom</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-benefit-cupom" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="desconto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desconto</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-benefit-desconto" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-benefit-site" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="segmento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-benefit-segmento">
                        <SelectValue placeholder="Selecione o segmento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {benefitSegmentEnum.map((segmento) => (
                        <SelectItem key={segmento} value={segmento}>
                          {segmentLabels[segmento]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-benefit"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit-benefit"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BenefitCard({
  benefit,
  onEdit,
  onDelete,
}: {
  benefit: Benefit;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Cupom copiado para a área de transferência",
    });
  };

  return (
    <Card
      className="hover-elevate cursor-pointer"
      data-testid={`card-benefit-${benefit.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Gift className="w-5 h-5 text-muted-foreground shrink-0" />
            <CardTitle className="text-base truncate">{benefit.empresa}</CardTitle>
          </div>
          {benefit.segmento && (
            <Badge className={segmentColors[benefit.segmento]} variant="secondary">
              {segmentIcons[benefit.segmento]}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {benefit.cupom && (
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="outline" className="font-mono text-sm">
                <Tag className="w-3 h-3 mr-1" />
                {benefit.cupom}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(benefit.cupom!);
                }}
                data-testid={`button-copy-cupom-${benefit.id}`}
              >
                <Copy className="w-3 h-3" />
              </Button>
              {benefit.site && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(benefit.cupom!);
                    const url = benefit.site!.startsWith("http") ? benefit.site : `https://${benefit.site}`;
                    window.open(url, "_blank");
                  }}
                  data-testid={`button-use-cupom-card-${benefit.id}`}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Usar cupom
                </Button>
              )}
            </div>
          )}
          {benefit.desconto && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Percent className="w-3 h-3 mr-1" />
              {benefit.desconto}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-benefit-${benefit.id}`}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 mr-1" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1" />
            )}
            Detalhes
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              data-testid={`button-edit-benefit-${benefit.id}`}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              data-testid={`button-delete-benefit-${benefit.id}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="pt-2 border-t space-y-2">
            {benefit.segmento && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Segmento:</span>
                <span data-testid={`text-benefit-segmento-${benefit.id}`}>
                  {segmentLabels[benefit.segmento]}
                </span>
              </div>
            )}
            {benefit.site && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Site:</span>
                <a
                  href={benefit.site.startsWith("http") ? benefit.site : `https://${benefit.site}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                  data-testid={`link-benefit-site-${benefit.id}`}
                >
                  Acessar <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Beneficios() {
  usePageTitle("Benefícios");
  useSetPageInfo("Benefícios", "Cupons e descontos exclusivos");

  const [search, setSearch] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState<string>("all");
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [deletingBenefit, setDeletingBenefit] = useState<Benefit | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortField, setSortField] = useState<SortField>('empresa');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  const { data: benefits = [], isLoading } = useQuery<Benefit[]>({
    queryKey: ["/api/beneficios"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/beneficios/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficios"] });
      toast({
        title: "Benefício excluído",
        description: "O benefício foi excluído com sucesso.",
      });
      setDeletingBenefit(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir benefício",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredBenefits = useMemo(() => {
    return benefits.filter((benefit) => {
      const matchesSearch =
        !search ||
        benefit.empresa?.toLowerCase().includes(search.toLowerCase()) ||
        benefit.cupom?.toLowerCase().includes(search.toLowerCase()) ||
        benefit.desconto?.toLowerCase().includes(search.toLowerCase());

      const matchesSegmento = segmentoFilter === "all" || benefit.segmento === segmentoFilter;

      return matchesSearch && matchesSegmento;
    });
  }, [benefits, search, segmentoFilter]);

  const sortedBenefits = useMemo(() => {
    return [...filteredBenefits].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredBenefits, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  const copyAndOpenSite = (cupom: string, site: string) => {
    navigator.clipboard.writeText(cupom);
    const url = site.startsWith("http") ? site : `https://${site}`;
    window.open(url, "_blank");
    toast({
      title: "Cupom copiado!",
      description: "O cupom foi copiado e o site foi aberto em uma nova aba",
    });
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      {children}
      <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-50'}`} />
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-benefits">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar benefícios..."
              className="pl-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-benefits"
            />
          </div>

          <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
            <SelectTrigger className="w-48" data-testid="select-filter-segmento">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Segmentos</SelectItem>
              {benefitSegmentEnum.map((segmento) => (
                <SelectItem key={segmento} value={segmento}>
                  {segmentLabels[segmento]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              data-testid="button-view-table"
            >
              <Table2 className="w-4 h-4" />
            </Button>
          </div>
          <AddBenefitDialog />
        </div>
      </div>

      {sortedBenefits.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-benefits">
          <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Nenhum benefício encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search || segmentoFilter !== "all"
              ? "Tente ajustar os filtros"
              : "Adicione seu primeiro benefício clicando no botão acima"}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedBenefits.map((benefit) => (
            <BenefitCard
              key={benefit.id}
              benefit={benefit}
              onEdit={() => setEditingBenefit(benefit)}
              onDelete={() => setDeletingBenefit(benefit)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>
                  <SortableHeader field="empresa">Empresa</SortableHeader>
                </TableHead>
                <TableHead>
                  <SortableHeader field="cupom">Cupom</SortableHeader>
                </TableHead>
                <TableHead>
                  <SortableHeader field="desconto">Desconto</SortableHeader>
                </TableHead>
                <TableHead>
                  <SortableHeader field="segmento">Segmento</SortableHeader>
                </TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBenefits.map((benefit) => {
                const isExpanded = expandedRows.has(benefit.id);
                
                return (
                  <>
                    <TableRow 
                      key={benefit.id}
                      className={cn(
                        "cursor-pointer hover-elevate",
                        isExpanded && "bg-muted/50"
                      )}
                      onClick={() => toggleRowExpand(benefit.id)}
                      data-testid={`row-benefit-${benefit.id}`}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{benefit.empresa}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {benefit.cupom ? (
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-muted-foreground" />
                            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{benefit.cupom}</code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(benefit.cupom!, "Cupom");
                              }}
                              data-testid={`button-copy-cupom-table-${benefit.id}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            {benefit.site && (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-6 ml-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyAndOpenSite(benefit.cupom!, benefit.site!);
                                }}
                                data-testid={`button-use-cupom-${benefit.id}`}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Usar
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {benefit.desconto ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Percent className="w-3 h-3 mr-1" />
                            {benefit.desconto}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {benefit.segmento ? (
                          <Badge className={segmentColors[benefit.segmento]} variant="secondary">
                            {segmentIcons[benefit.segmento]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingBenefit(benefit)}
                            data-testid={`button-edit-table-${benefit.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeletingBenefit(benefit)}
                            data-testid={`button-delete-table-${benefit.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${benefit.id}-details`} className="bg-muted/30">
                        <TableCell colSpan={6} className="py-3">
                          <div className="pl-10 space-y-2">
                            <div className="text-sm font-medium text-muted-foreground mb-2">Detalhes do Benefício</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {benefit.segmento && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-sm">Segmento:</span>
                                  <span className="text-sm">{segmentLabels[benefit.segmento]}</span>
                                </div>
                              )}
                              {benefit.site && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-sm">Site:</span>
                                  <a
                                    href={benefit.site.startsWith("http") ? benefit.site : `https://${benefit.site}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-sm flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Acessar <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                              {!benefit.segmento && !benefit.site && (
                                <span className="text-muted-foreground text-sm">Nenhum detalhe adicional</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editingBenefit && (
        <EditBenefitDialog
          benefit={editingBenefit}
          open={!!editingBenefit}
          onOpenChange={(open) => !open && setEditingBenefit(null)}
        />
      )}

      <AlertDialog open={!!deletingBenefit} onOpenChange={(open) => !open && setDeletingBenefit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Benefício</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o benefício "{deletingBenefit?.empresa}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-benefit">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBenefit && deleteMutation.mutate(deletingBenefit.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-benefit"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
