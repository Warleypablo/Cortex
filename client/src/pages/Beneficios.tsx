import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Benefit, InsertBenefit } from "@shared/schema";
import { insertBenefitSchema, benefitSegmentEnum } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Search, Plus, Copy, Edit, Trash2, ExternalLink, Loader2, ChevronDown, ChevronRight, Gift, Tag, Percent } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <div className="flex items-center gap-1">
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
  useSetPageInfo("Benefícios", "Cupons e descontos exclusivos");

  const [search, setSearch] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState<string>("all");
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [deletingBenefit, setDeletingBenefit] = useState<Benefit | null>(null);

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

        <AddBenefitDialog />
      </div>

      {filteredBenefits.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-benefits">
          <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Nenhum benefício encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search || segmentoFilter !== "all"
              ? "Tente ajustar os filtros"
              : "Adicione seu primeiro benefício clicando no botão acima"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBenefits.map((benefit) => (
            <BenefitCard
              key={benefit.id}
              benefit={benefit}
              onEdit={() => setEditingBenefit(benefit)}
              onDelete={() => setDeletingBenefit(benefit)}
            />
          ))}
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
