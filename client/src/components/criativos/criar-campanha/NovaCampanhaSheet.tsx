import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, ExternalLink, AlertTriangle, CheckCircle2, ChevronsUpDown, X, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  useAudiences,
  useCampaigns,
  useCreateDraft,
  useExecuteDraft,
  useDraftStatus,
  useLastDraft,
  usePreviewDrive,
  type BriefingPayload,
  type BudgetMode,
  type CampaignMode,
  type MetaCallToAction,
  type MetaObjective,
  type Placement,
} from "@/hooks/useAdsCreation";

interface Props {
  open: boolean;
  onClose: () => void;
}

const OBJECTIVES: { value: MetaObjective; label: string }[] = [
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_SALES", label: "Vendas" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de App" },
];

const CTAS: { value: MetaCallToAction; label: string }[] = [
  { value: "LEARN_MORE", label: "Saiba mais" },
  { value: "SHOP_NOW", label: "Comprar agora" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "SUBSCRIBE", label: "Assinar" },
  { value: "CONTACT_US", label: "Fale conosco" },
  { value: "GET_OFFER", label: "Aproveitar oferta" },
  { value: "DOWNLOAD", label: "Baixar" },
  { value: "WATCH_MORE", label: "Assistir" },
  { value: "APPLY_NOW", label: "Aplicar agora" },
  { value: "GET_QUOTE", label: "Pedir orçamento" },
];

const SUBTYPE_LABEL: Record<string, string> = {
  WEBSITE: "Site (Pixel)",
  CUSTOM: "Lista",
  ENGAGEMENT: "Engajamento",
  IG_BUSINESS: "IG Business",
  LOOKALIKE: "Lookalike",
  VIDEO: "Vídeo",
  APP: "App",
};

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: "facebook_feed", label: "Facebook Feed" },
  { value: "facebook_profile_feed", label: "Facebook Feed do perfil" },
  { value: "facebook_stories", label: "Facebook Stories" },
  { value: "facebook_reels", label: "Facebook Reels" },
  { value: "facebook_marketplace", label: "Facebook Marketplace" },
  { value: "facebook_video_feeds", label: "Facebook Video Feeds" },
  { value: "facebook_instream_video", label: "Facebook In-Stream Video" },
  { value: "facebook_right_column", label: "Facebook Coluna direita" },
  { value: "instagram_feed", label: "Instagram Feed" },
  { value: "instagram_profile_feed", label: "Instagram Feed do perfil" },
  { value: "instagram_stories", label: "Instagram Stories" },
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "instagram_explore", label: "Instagram Explore" },
  { value: "instagram_explore_home", label: "Instagram Explore Home" },
  { value: "instagram_search", label: "Instagram Search" },
];

type PlacementBucket = "Feed" | "Reels" | "Stories" | "Outros";

const PLACEMENT_BUCKET: Record<Placement, PlacementBucket> = {
  facebook_feed: "Feed",
  facebook_profile_feed: "Feed",
  facebook_video_feeds: "Feed",
  facebook_marketplace: "Feed",
  instagram_feed: "Feed",
  instagram_profile_feed: "Feed",
  instagram_explore: "Feed",
  instagram_explore_home: "Feed",
  instagram_search: "Feed",
  facebook_reels: "Reels",
  instagram_reels: "Reels",
  facebook_stories: "Stories",
  instagram_stories: "Stories",
  facebook_instream_video: "Outros",
  facebook_right_column: "Outros",
};

const BUCKET_ORDER: PlacementBucket[] = ["Feed", "Reels", "Stories", "Outros"];

function buildPlacementsLabel(selected: Placement[]): string {
  if (selected.length === 0) return "ADV+";
  const active = new Set<PlacementBucket>();
  for (const p of selected) {
    const bucket = PLACEMENT_BUCKET[p];
    if (bucket) active.add(bucket);
  }
  return BUCKET_ORDER.filter((b) => active.has(b)).join("+");
}

interface FormState {
  campaignMode: CampaignMode;
  existingCampaignId: string;
  existingCampaignName: string;
  campaignName: string;
  objective: MetaObjective;
  budgetMode: BudgetMode;
  dailyBudgetReais: string;
  startDate: string;
  endDate: string;
  audienceName: string;
  excludedAudienceNames: string[];
  disableAdvantageExpansion: boolean;
  placementMode: "auto" | "manual";
  selectedPlacements: Placement[];
  primaryText: string;
  headline: string;
  description: string;
  callToAction: MetaCallToAction;
  destinationUrl: string;
  driveFolderUrl: string;
  /** Overrides por conjunto (modo bulk). Keys = folderName. Valores vazios = usa default do form. */
  conjuntoOverrides: Record<string, { audienceName?: string; dailyBudgetReais?: string }>;
}

const INITIAL: FormState = {
  campaignMode: "new",
  existingCampaignId: "",
  existingCampaignName: "",
  campaignName: "",
  objective: "OUTCOME_LEADS",
  budgetMode: "ABO",
  dailyBudgetReais: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  audienceName: "",
  excludedAudienceNames: [],
  disableAdvantageExpansion: false,
  placementMode: "auto",
  selectedPlacements: [],
  primaryText: "",
  headline: "",
  description: "",
  callToAction: "LEARN_MORE",
  destinationUrl: "",
  driveFolderUrl: "",
  conjuntoOverrides: {},
};

export function NovaCampanhaSheet({ open, onClose }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [audiencePopoverOpen, setAudiencePopoverOpen] = useState(false);
  const [excludedPopoverOpen, setExcludedPopoverOpen] = useState(false);
  const [campaignPopoverOpen, setCampaignPopoverOpen] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);

  const audiencesQuery = useAudiences(open);
  const campaignsQuery = useCampaigns(open && form.campaignMode === "existing");
  const createDraft = useCreateDraft();
  const executeDraft = useExecuteDraft();
  const previewDrive = usePreviewDrive();
  const statusQuery = useDraftStatus(draftId, draftId !== null);
  const lastDraftQuery = useLastDraft(open);

  const handleUseLastBriefing = () => {
    const briefing = lastDraftQuery.data?.briefing;
    if (!briefing) {
      toast({ title: "Nenhum briefing anterior encontrado" });
      return;
    }
    setForm((s) => ({
      ...s,
      campaignMode: briefing.campaignMode,
      existingCampaignId: briefing.existingCampaignId ?? "",
      campaignName: briefing.campaignName ?? "",
      objective: briefing.objective,
      budgetMode: briefing.budgetMode,
      dailyBudgetReais: briefing.dailyBudgetCents ? (briefing.dailyBudgetCents / 100).toString() : "",
      startDate: briefing.startDate ?? s.startDate,
      endDate: briefing.endDate ?? "",
      audienceName: briefing.audienceName ?? "",
      excludedAudienceNames: briefing.excludedAudienceNames ?? [],
      disableAdvantageExpansion: briefing.disableAdvantageExpansion ?? false,
      placementMode: briefing.placements === "auto" ? "auto" : "manual",
      selectedPlacements: Array.isArray(briefing.placements) ? briefing.placements : [],
      primaryText: briefing.primaryText ?? "",
      headline: briefing.headline ?? "",
      description: briefing.description ?? "",
      callToAction: briefing.callToAction,
      destinationUrl: briefing.destinationUrl ?? "",
      driveFolderUrl: "",  // sempre limpa: nova execução = nova pasta
      conjuntoOverrides: {},
    }));
    toast({ title: "Briefing anterior carregado", description: "Confira os campos antes de submeter." });
  };

  useEffect(() => {
    if (!open) {
      setForm(INITIAL);
      setDraftId(null);
      previewDrive.reset();
      createDraft.reset();
      executeDraft.reset();
    }
  }, [open]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const togglePlacement = (p: Placement) => {
    setForm((s) => ({
      ...s,
      selectedPlacements: s.selectedPlacements.includes(p)
        ? s.selectedPlacements.filter((x) => x !== p)
        : [...s.selectedPlacements, p],
    }));
  };

  const buildPayload = (): BriefingPayload => {
    const dailyBudgetCents = Math.round(parseFloat(form.dailyBudgetReais.replace(",", ".")) * 100);
    return {
      campaignMode: form.campaignMode,
      existingCampaignId: form.campaignMode === "existing" ? form.existingCampaignId : undefined,
      campaignName: form.campaignName.trim(),
      objective: form.objective,
      budgetMode: form.budgetMode,
      dailyBudgetCents,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      audienceName: form.audienceName.trim(),
      excludedAudienceNames: form.excludedAudienceNames.length > 0 ? form.excludedAudienceNames : undefined,
      disableAdvantageExpansion: form.disableAdvantageExpansion || undefined,
      placements:
        form.placementMode === "auto" ? "auto" : form.selectedPlacements,
      primaryText: form.primaryText.trim(),
      headline: form.headline.trim() || undefined,
      description: form.description.trim() || undefined,
      callToAction: form.callToAction,
      destinationUrl: form.destinationUrl.trim(),
      driveFolderUrl: form.driveFolderUrl.trim(),
      conjuntoOverrides: Object.entries(form.conjuntoOverrides)
        .map(([folderName, ov]) => {
          const out: { folderName: string; audienceName?: string; dailyBudgetCents?: number } = { folderName };
          if (ov.audienceName && ov.audienceName.trim()) out.audienceName = ov.audienceName.trim();
          if (ov.dailyBudgetReais && ov.dailyBudgetReais.trim()) {
            const cents = Math.round(parseFloat(ov.dailyBudgetReais.replace(",", ".")) * 100);
            if (Number.isFinite(cents) && cents >= 100) out.dailyBudgetCents = cents;
          }
          return out;
        })
        .filter((o) => o.audienceName !== undefined || o.dailyBudgetCents !== undefined),
    };
  };

  const validationError = useMemo(() => {
    if (form.campaignMode === "existing") {
      if (!form.existingCampaignId) return "Selecione uma campanha existente";
    } else {
      if (!form.campaignName.trim()) return "Informe o nome da campanha";
    }
    if (!form.dailyBudgetReais.trim()) return "Informe o orçamento diário";
    const budget = parseFloat(form.dailyBudgetReais.replace(",", "."));
    if (!Number.isFinite(budget) || budget < 1) return "Orçamento diário deve ser >= R$ 1,00";
    // audienceName vazio → Advantage+ Audience (sem público específico)
    if (!form.primaryText.trim()) return "Informe a copy principal";
    if (!form.destinationUrl.trim()) return "Informe a URL de destino";
    if (!form.driveFolderUrl.trim()) return "Informe o link da pasta do Drive";
    if (
      form.placementMode === "manual" &&
      form.selectedPlacements.length === 0
    )
      return "Selecione pelo menos um posicionamento ou volte para automático";
    return null;
  }, [form]);

  // Preview dos nomes que serão criados (para o usuário ver antes de submeter).
  const namePreview = useMemo(() => {
    let campaign: string | null = null;
    if (form.campaignMode === "existing") {
      if (!form.existingCampaignName) return null;
      campaign = form.existingCampaignName + "  (existente)";
    } else {
      if (!form.campaignName) return null;
      campaign = form.campaignName;
    }
    const placements =
      form.placementMode === "auto"
        ? "ADV+"
        : form.selectedPlacements.length > 0
          ? buildPlacementsLabel(form.selectedPlacements)
          : "?";
    const adset = form.audienceName
      ? `[NN] - ${placements} ${form.audienceName} {Personagem do Sheet} - {Nome do ad do Sheet}`
      : null;
    return { campaign, adset };
  }, [form]);

  // Soma orçamento total — usa overrides quando bulk, senão = budget × N conjuntos.
  const budgetSummary = useMemo(() => {
    const baseBudgetReais = parseFloat(form.dailyBudgetReais.replace(",", "."));
    if (!Number.isFinite(baseBudgetReais) || baseBudgetReais < 1) return null;
    const previewData = previewDrive.data;
    if (!previewData) {
      return { totalReais: baseBudgetReais, conjuntoCount: 1, hasOverrides: false };
    }
    const conjuntoCount = previewData.mode === "bulk" ? previewData.totalConjuntos : 1;
    if (previewData.mode !== "bulk") {
      return { totalReais: baseBudgetReais, conjuntoCount: 1, hasOverrides: false };
    }
    let total = 0;
    let hasOverrides = false;
    for (const c of previewData.conjuntos) {
      const ov = form.conjuntoOverrides[c.folderName];
      if (ov?.dailyBudgetReais) {
        const v = parseFloat(ov.dailyBudgetReais.replace(",", "."));
        if (Number.isFinite(v) && v >= 1) {
          total += v;
          hasOverrides = true;
          continue;
        }
      }
      total += baseBudgetReais;
    }
    return { totalReais: total, conjuntoCount, hasOverrides };
  }, [form.dailyBudgetReais, form.conjuntoOverrides, previewDrive.data]);

  const handlePreviewDrive = async () => {
    if (!form.driveFolderUrl.trim()) {
      toast({ title: "Informe o link do Drive primeiro", variant: "destructive" });
      return;
    }
    try {
      await previewDrive.mutateAsync(form.driveFolderUrl.trim());
    } catch (err: any) {
      toast({ title: "Erro no Drive", description: err.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (validationError) {
      toast({ title: validationError, variant: "destructive" });
      return;
    }
    try {
      const draft = await createDraft.mutateAsync(buildPayload());
      const id = draft.draft.id;
      setDraftId(id);
      await executeDraft.mutateAsync({
        id,
        autoStubs: previewData?.autoStubs ?? [],
        unparseableStubs: previewData?.unparseableStubs ?? [],
      });
      toast({
        title: "Criação iniciada",
        description: "Acompanhe o status abaixo. Tudo será criado em PAUSED.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao criar", description: err.message, variant: "destructive" });
    }
  };

  const status = statusQuery.data;
  const isExecuting = status?.status === "executing" || executeDraft.isPending || createDraft.isPending;
  const isDone = status?.status === "created";
  const isFailed = status?.status === "failed";
  const isReadOnly = isExecuting || isDone;

  const previewData = previewDrive.data;
  const previewMode = previewData?.mode;
  const totalFiles =
    previewData?.mode === "single"
      ? previewData.totalFiles
      : previewData?.mode === "bulk"
        ? previewData.totalFiles
        : 0;
  const totalConjuntos =
    previewData?.mode === "bulk" ? previewData.totalConjuntos : previewData?.mode === "single" ? 1 : 0;
  const unmatchedFiles = previewData?.unmatchedFiles ?? [];
  const autoStubs = previewData?.autoStubs ?? [];
  const unparseableStubs = previewData?.unparseableStubs ?? [];
  const matchedCount = totalFiles - autoStubs.length - unparseableStubs.length;
  const audiences = audiencesQuery.data?.audiences ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isExecuting && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subir nova campanha no Meta Ads</DialogTitle>
          <DialogDescription>
            A campanha, o conjunto e os anúncios serão criados em <strong>PAUSED</strong>.
            Você revisa no Gerenciador antes de ativar.
          </DialogDescription>
        </DialogHeader>

        {!isDone && (
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Modo:</span>
              <div className="flex rounded-md border bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => update("campaignMode", "new")}
                  disabled={isReadOnly}
                  className={`px-3 py-1 text-sm rounded ${form.campaignMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  Nova campanha
                </button>
                <button
                  type="button"
                  onClick={() => update("campaignMode", "existing")}
                  disabled={isReadOnly}
                  className={`px-3 py-1 text-sm rounded ${form.campaignMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  Adicionar a existente
                </button>
              </div>
            </div>
            {lastDraftQuery.data?.briefing && !isExecuting && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseLastBriefing}
                title="Pré-preenche o form com os campos do último briefing salvo"
              >
                ↻ Usar último briefing
              </Button>
            )}
          </div>
        )}
        {isDone && status?.result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-4 border border-green-500/30 bg-green-500/5 rounded-md">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Campanha criada com sucesso</p>
                <p className="text-muted-foreground mt-1">
                  Campaign: {status.result.campaignId} •{" "}
                  {(status.result.adsetIds?.length ?? (status.result.adsetId ? 1 : 0))} conjunto(s) •{" "}
                  {status.result.adIds.length} anúncio(s)
                </p>
                {status.result.adsetIds && status.result.adsetIds.length > 1 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Ver IDs dos conjuntos
                    </summary>
                    <ul className="ml-4 list-disc text-xs font-mono mt-1">
                      {status.result.adsetIds.map((id) => (
                        <li key={id}>{id}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {status.result.errors.length > 0 && (
                  <p className="text-amber-500 mt-2">
                    Avisos: {status.result.errors.join("; ")}
                  </p>
                )}
              </div>
            </div>
            {status.result.managerUrl && (
              <Button
                variant="default"
                className="w-full gap-2"
                onClick={() => window.open(status.result!.managerUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4" />
                Abrir no Gerenciador de Anúncios
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {form.campaignMode === "existing" ? "Campanha existente" : "Configuração da campanha"}
              </h3>

              {form.campaignMode === "existing" ? (
                <Popover open={campaignPopoverOpen} onOpenChange={setCampaignPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={isReadOnly || campaignsQuery.isLoading}
                    >
                      {form.existingCampaignName ||
                        (campaignsQuery.isLoading
                          ? "Carregando campanhas..."
                          : "Selecione uma campanha")}
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[600px]" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar campanha..." />
                      <CommandList>
                        {campaignsQuery.isError ? (
                          <div className="px-3 py-4 text-sm">
                            <div className="font-medium text-destructive mb-1">
                              Não consegui carregar as campanhas
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(() => {
                                const msg = (campaignsQuery.error as any)?.message ?? '';
                                if (msg.includes('80004') || msg.toLowerCase().includes('rate limit')) {
                                  return 'Rate limit do Meta atingido. Aguarde 15–30 minutos e tente novamente.';
                                }
                                return msg || 'Erro desconhecido. Tente novamente em alguns instantes.';
                              })()}
                            </div>
                          </div>
                        ) : (
                          <CommandEmpty>Nenhuma campanha ativa encontrada.</CommandEmpty>
                        )}
                        <CommandGroup>
                          {(campaignsQuery.data?.campaigns ?? [])
                            .filter((c) => {
                              // Considera "ativa" = configurada como ACTIVE OU rodando no Meta agora.
                              // Cobre os casos: usuário ligou e está rodando; usuário ligou mas
                              // Meta colocou WITH_ISSUES/IN_PROCESS temporariamente; ou só
                              // effective_status diz ACTIVE.
                              const cfg = String(c.status || '').toUpperCase();
                              const eff = String(c.effective_status || '').toUpperCase();
                              if (cfg === 'ACTIVE') return true;
                              return ['ACTIVE', 'WITH_ISSUES', 'IN_PROCESS'].includes(eff);
                            })
                            .map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                update("existingCampaignId", c.id);
                                update("existingCampaignName", c.name);
                                setCampaignPopoverOpen(false);
                              }}
                            >
                              <div className="flex flex-col w-full">
                                <span className="truncate">{c.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {c.objective} • {c.effective_status}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="campaignName">Nome da campanha</Label>
                    <Input
                      id="campaignName"
                      value={form.campaignName}
                      onChange={(e) => update("campaignName", e.target.value)}
                      placeholder="Ex: [TP] [Leads] [ABO] [Ecommerce] - Lancamento Maio"
                      disabled={isReadOnly}
                    />
                    <details className="text-xs p-2 border rounded bg-muted/30">
                      <summary className="cursor-pointer font-medium">📐 Como nomear a campanha (convenção interna)</summary>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p className="font-mono text-foreground">
                          [TP] [Objetivo] [ABO/CBO] [Produto] - Nome livre
                        </p>
                        <p className="font-mono">
                          Ex: <span className="text-foreground">[TP] [Leads] [ABO] [Ecommerce] - Lancamento Maio</span>
                        </p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li><strong>Objetivo:</strong> Reconhecimento, Trafego, Engajamento, Leads, Vendas, App</li>
                          <li><strong>ABO/CBO:</strong> tipo de orçamento (mesmo do select abaixo)</li>
                          <li><strong>Produto:</strong> Ecommerce, Odonto, Creators, BP, Distribuição, etc.</li>
                          <li><strong>Nome livre:</strong> tema/lançamento da campanha</li>
                        </ul>
                      </div>
                    </details>
                  </div>
                  <div>
                    <Label>Tipo de orçamento</Label>
                    <Select
                      value={form.budgetMode}
                      onValueChange={(v) => update("budgetMode", v as BudgetMode)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ABO">ABO (orçamento por conjunto)</SelectItem>
                        <SelectItem value="CBO">CBO (orçamento por campanha)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className={`grid grid-cols-1 ${form.campaignMode === "existing" ? "md:grid-cols-2" : "md:grid-cols-3"} gap-3`}>
                {form.campaignMode === "new" && (
                  <div>
                    <Label>Objetivo</Label>
                    <Select
                      value={form.objective}
                      onValueChange={(v) => update("objective", v as MetaObjective)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OBJECTIVES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="budget">Orçamento diário (R$)</Label>
                  <Input
                    id="budget"
                    type="text"
                    inputMode="decimal"
                    value={form.dailyBudgetReais}
                    onChange={(e) => update("dailyBudgetReais", e.target.value)}
                    placeholder="100,00"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="start">Início</Label>
                    <Input
                      id="start"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => update("startDate", e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end">Fim (opcional)</Label>
                    <Input
                      id="end"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => update("endDate", e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Público
              </h3>
              <Popover open={audiencePopoverOpen} onOpenChange={setAudiencePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={isReadOnly || audiencesQuery.isLoading}
                  >
                    {form.audienceName || (audiencesQuery.isLoading ? "Carregando públicos..." : "✨ Advantage+ Audience (sem público específico)")}
                    <ChevronsUpDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar público..." />
                    <CommandList>
                      <CommandEmpty>Nenhum público encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__advantage_plus__"
                          onSelect={() => {
                            update("audienceName", "");
                            setAudiencePopoverOpen(false);
                          }}
                        >
                          <div className="flex flex-col w-full">
                            <span className="truncate font-medium">✨ Advantage+ Audience</span>
                            <span className="text-xs text-muted-foreground">
                              Sem público específico — Meta usa sinais comportamentais + Brasil como localização
                            </span>
                          </div>
                        </CommandItem>
                        {audiences.map((a) => (
                          <CommandItem
                            key={a.id}
                            value={a.name}
                            onSelect={() => {
                              update("audienceName", a.name);
                              setAudiencePopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col w-full">
                              <span className="truncate">{a.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {a.subtype ? (SUBTYPE_LABEL[a.subtype] ?? a.subtype) : "Salvo"}
                                {a.approximateCount ? ` • ~${a.approximateCount.toLocaleString("pt-BR")} pessoas` : ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {form.audienceName.length > 30 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Nome do público tem {form.audienceName.length} caracteres. Considere renomear no Meta para manter o nome do conjunto legível.
                </p>
              )}

              {/* Excluir públicos */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Excluir públicos (opcional)</Label>
                <Popover open={excludedPopoverOpen} onOpenChange={setExcludedPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-9 text-sm"
                      disabled={isReadOnly || audiencesQuery.isLoading}
                    >
                      {form.excludedAudienceNames.length > 0
                        ? `${form.excludedAudienceNames.length} público(s) excluído(s)`
                        : "Nenhum (entrega pra todos do público principal)"}
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar público pra excluir..." />
                      <CommandList>
                        <CommandEmpty>Nenhum público encontrado.</CommandEmpty>
                        <CommandGroup>
                          {audiences
                            .filter((a) => a.name !== form.audienceName)
                            .map((a) => {
                              const checked = form.excludedAudienceNames.includes(a.name);
                              return (
                                <CommandItem
                                  key={a.id}
                                  value={a.name}
                                  onSelect={() => {
                                    update(
                                      "excludedAudienceNames",
                                      checked
                                        ? form.excludedAudienceNames.filter((n) => n !== a.name)
                                        : [...form.excludedAudienceNames, a.name],
                                    );
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${checked ? "opacity-100" : "opacity-0"}`}
                                  />
                                  <div className="flex flex-col">
                                    <span className="truncate">{a.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {a.subtype ? (SUBTYPE_LABEL[a.subtype] ?? a.subtype) : "Salvo"}
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {form.excludedAudienceNames.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.excludedAudienceNames.map((name) => (
                      <Badge key={name} variant="secondary" className="gap-1 pr-1">
                        <span className="text-xs">{name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              "excludedAudienceNames",
                              form.excludedAudienceNames.filter((n) => n !== name),
                            )
                          }
                          disabled={isReadOnly}
                          className="hover:bg-muted rounded-sm p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Limitar alcance (Advantage+ off) */}
              <div className="flex items-start gap-3 p-2 border rounded">
                <Switch
                  id="disableExpansion"
                  checked={form.disableAdvantageExpansion}
                  onCheckedChange={(v) => update("disableAdvantageExpansion", v)}
                  disabled={isReadOnly}
                />
                <div className="flex-1">
                  <Label htmlFor="disableExpansion" className="text-sm cursor-pointer">
                    Limitar alcance ao público salvo
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sem isso, o Meta amplia automaticamente pra audiences semelhantes (Advantage+ Audience). Ative pra entregar SÓ pro público escolhido.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Posicionamentos
              </h3>
              <Select
                value={form.placementMode}
                onValueChange={(v) => update("placementMode", v as "auto" | "manual")}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Advantage+ (automáticos)</SelectItem>
                  <SelectItem value="manual">Selecionar manualmente</SelectItem>
                </SelectContent>
              </Select>
              {form.placementMode === "manual" && (
                <div className="flex flex-wrap gap-2">
                  {PLACEMENTS.map((p) => (
                    <Badge
                      key={p.value}
                      variant={form.selectedPlacements.includes(p.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => !isReadOnly && togglePlacement(p.value)}
                    >
                      {p.label}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Anúncio
              </h3>
              <div>
                <Label htmlFor="primaryText">Copy principal</Label>
                <Textarea
                  id="primaryText"
                  value={form.primaryText}
                  onChange={(e) => update("primaryText", e.target.value)}
                  rows={3}
                  placeholder="O texto que aparece acima da imagem"
                  disabled={isReadOnly}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="headline">Título (opcional)</Label>
                  <Input
                    id="headline"
                    value={form.headline}
                    onChange={(e) => update("headline", e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Botão (CTA)</Label>
                  <Select
                    value={form.callToAction}
                    onValueChange={(v) => update("callToAction", v as MetaCallToAction)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CTAS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="destinationUrl">URL de destino</Label>
                  <Input
                    id="destinationUrl"
                    type="url"
                    value={form.destinationUrl}
                    onChange={(e) => update("destinationUrl", e.target.value)}
                    placeholder="https://..."
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Criativos
              </h3>
              <div>
                <Label htmlFor="drive">Pasta do Drive</Label>
                <div className="flex gap-2">
                  <Input
                    id="drive"
                    type="url"
                    value={form.driveFolderUrl}
                    onChange={(e) => update("driveFolderUrl", e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    disabled={isReadOnly}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreviewDrive}
                    disabled={isReadOnly || previewDrive.isPending}
                  >
                    {previewDrive.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Listar"}
                  </Button>
                </div>
              </div>
              <details className="text-xs p-2 border rounded bg-muted/30">
                <summary className="cursor-pointer font-medium">📐 Como nomear arquivos no Drive (convenção interna)</summary>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p className="font-mono text-foreground">
                    {"{tipo}-{nomeAd}-{personagem}-{formato}-v{NN}.{ext}"}
                  </p>
                  <p className="font-mono">
                    Ex: <span className="text-foreground">vv-novosclientes-marina-9x16-v01.mp4</span>
                  </p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li><strong>tipo:</strong> vv (vídeo), img (imagem), car (carrossel)</li>
                    <li><strong>nomeAd:</strong> tema/ângulo (kebab-case)</li>
                    <li><strong>personagem:</strong> quem aparece</li>
                    <li><strong>formato:</strong> 9x16, 4x5, 1x1, 16x9</li>
                    <li><strong>v01:</strong> variação 2 dígitos</li>
                  </ul>
                  <p className="pt-1">
                    Arquivos que seguem o padrão são auto-cadastrados na{" "}
                    <a href="/growth/criativos/biblioteca" target="_blank" rel="noreferrer" className="underline">Biblioteca</a>{" "}
                    com personagem e ângulo pré-preenchidos. Arquivos fora do padrão sobem igual — você só completa os campos depois se quiser.
                  </p>
                </div>
              </details>
              {previewData?.mode === "single" && previewData.totalFiles > 0 && (
                <div className="text-xs text-muted-foreground p-2 border rounded">
                  <span className="font-medium">
                    {previewData.totalFiles} arquivo(s) — 1 conjunto:
                  </span>{" "}
                  {previewData.files
                    .map((f) => `${f.name}${f.inLibrary ? "" : " ⚠️"}`)
                    .join(", ")}
                </div>
              )}
              {previewData?.mode === "bulk" && (
                <div className="text-xs p-2 border rounded space-y-1">
                  <div className="font-medium">
                    {previewData.totalConjuntos} conjunto(s) detectado(s) — {previewData.totalFiles} arquivo(s) no total
                  </div>
                  <ul className="ml-3 list-disc space-y-0.5 text-muted-foreground">
                    {previewData.conjuntos.map((c) => (
                      <li key={c.folderName}>
                        <span className="font-medium text-foreground">{c.folderName}</span>:{" "}
                        {Object.entries(c.formats)
                          .map(([tag, info]) => `${tag} ×${info.count}`)
                          .join(" + ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {previewData?.mode === "bulk" && previewData.conjuntos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Configuração por conjunto</h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isReadOnly || !form.audienceName}
                        onClick={() => {
                          const next = { ...form.conjuntoOverrides };
                          for (const c of previewData.conjuntos) {
                            next[c.folderName] = { ...next[c.folderName], audienceName: form.audienceName };
                          }
                          update("conjuntoOverrides", next);
                        }}
                      >
                        ↓ Aplicar público a todos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isReadOnly || !form.dailyBudgetReais}
                        onClick={() => {
                          const next = { ...form.conjuntoOverrides };
                          for (const c of previewData.conjuntos) {
                            next[c.folderName] = { ...next[c.folderName], dailyBudgetReais: form.dailyBudgetReais };
                          }
                          update("conjuntoOverrides", next);
                        }}
                      >
                        ↓ Aplicar orçamento a todos
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco pra usar o valor do form principal (público: <span className="font-medium">{form.audienceName || "—"}</span> · orçamento: <span className="font-medium">R$ {form.dailyBudgetReais || "—"}</span>).
                  </p>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium">Conjunto</th>
                          <th className="text-left px-2 py-1.5 font-medium">Público</th>
                          <th className="text-left px-2 py-1.5 font-medium w-32">Orçamento R$/dia</th>
                          <th className="text-left px-2 py-1.5 font-medium w-20">Ads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.conjuntos.map((c) => {
                          const ov = form.conjuntoOverrides[c.folderName] ?? {};
                          return (
                            <tr key={c.folderName} className="border-t">
                              <td className="px-2 py-1.5 font-mono">{c.folderName}</td>
                              <td className="px-2 py-1.5">
                                <Select
                                  value={ov.audienceName ?? ""}
                                  onValueChange={(v) =>
                                    update("conjuntoOverrides", {
                                      ...form.conjuntoOverrides,
                                      [c.folderName]: { ...ov, audienceName: v === "__default__" ? undefined : v },
                                    })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder={form.audienceName || "Default"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__default__">Usar default</SelectItem>
                                    {audiences.map((a) => (
                                      <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  className="h-8"
                                  type="text"
                                  inputMode="decimal"
                                  value={ov.dailyBudgetReais ?? ""}
                                  placeholder={form.dailyBudgetReais || "—"}
                                  onChange={(e) =>
                                    update("conjuntoOverrides", {
                                      ...form.conjuntoOverrides,
                                      [c.folderName]: { ...ov, dailyBudgetReais: e.target.value },
                                    })
                                  }
                                  disabled={isReadOnly}
                                />
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground">{c.totalFiles}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {previewData && totalFiles > 0 && (
                <div className="text-xs space-y-2">
                  <div className="flex flex-wrap gap-3 text-muted-foreground">
                    <span>🟢 <strong className="text-foreground">{matchedCount}</strong> já cadastrado(s)</span>
                    <span>🔵 <strong className="text-foreground">{autoStubs.length}</strong> auto-cadastro</span>
                    <span>🟡 <strong className="text-foreground">{unparseableStubs.length}</strong> fora do padrão</span>
                  </div>
                  {(autoStubs.length > 0 || unparseableStubs.length > 0) && (
                    <p className="text-muted-foreground">
                      Os arquivos novos serão persistidos na Biblioteca quando você clicar em <strong>Criar em PAUSED</strong>.
                    </p>
                  )}
                  {autoStubs.length > 0 && (
                    <details className="border border-blue-500/30 bg-blue-500/5 rounded p-2" open>
                      <summary className="cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                        🔵 {autoStubs.length} auto-cadastro (parser preencheu campos)
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {autoStubs.map((s) => (
                          <li key={s.driveFileId ?? s.nomeDrive} className="font-mono break-all">
                            {s.nomeDrive}
                            <span className="text-muted-foreground ml-2">
                              · {s.personagem ?? "?"} · {s.angulo ?? "?"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {unparseableStubs.length > 0 && (
                    <details className="border border-amber-500/30 bg-amber-500/5 rounded p-2" open>
                      <summary className="cursor-pointer text-amber-600 dark:text-amber-400 font-medium">
                        🟡 {unparseableStubs.length} fora do padrão (vai entrar com nome bruto)
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {unparseableStubs.map((s) => (
                          <li key={s.driveFileId ?? s.nomeDrive} className="font-mono break-all">{s.nomeDrive}</li>
                        ))}
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Edite os campos depois em{" "}
                        <a href="/growth/criativos/biblioteca" target="_blank" rel="noreferrer" className="underline">
                          /criativos/biblioteca
                        </a>{" "}
                        se quiser.
                      </p>
                    </details>
                  )}
                </div>
              )}
            </section>

            {namePreview && !isExecuting && (
              <div className="text-xs space-y-1 p-3 border rounded bg-muted/30">
                <div className="font-semibold text-muted-foreground uppercase tracking-wide">Como vai ficar nomeado:</div>
                <div className="font-mono">📁 {namePreview.campaign}</div>
                {namePreview.adset && previewMode !== "bulk" && (
                  <div className="font-mono ml-3">📂 {namePreview.adset}</div>
                )}
                {previewMode === "bulk" && (
                  <div className="font-mono ml-3 text-muted-foreground">
                    📂 {totalConjuntos} conjunto(s) — [NN] sequencial automático
                  </div>
                )}
                {totalFiles > 0 && (
                  <div className="font-mono ml-6 text-muted-foreground">
                    📄 {totalFiles} ad(s) — nome puxado da Biblioteca
                  </div>
                )}
              </div>
            )}
            {budgetSummary && !isExecuting && (
              <div className="text-xs flex items-center justify-between p-3 border border-emerald-500/30 bg-emerald-500/5 rounded">
                <div>
                  <span className="font-semibold">💰 Orçamento total:</span>{" "}
                  <span className="font-mono">
                    R$ {budgetSummary.totalReais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/dia
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({budgetSummary.conjuntoCount} conjunto{budgetSummary.conjuntoCount > 1 ? "s" : ""}
                    {budgetSummary.hasOverrides ? ", c/ overrides" : ""})
                  </span>
                </div>
                <span className="text-muted-foreground">
                  ~R$ {(budgetSummary.totalReais * 30).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / mês
                </span>
              </div>
            )}
            {isExecuting && (
              <div className="space-y-2 p-3 border border-blue-500/30 bg-blue-500/5 rounded">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Criando no Meta...</span>
                </div>
                {status?.result?.conjuntos && status.result.conjuntos.length > 0 ? (
                  <ul className="space-y-1 text-xs">
                    {status.result.conjuntos.map((c) => {
                      const icon =
                        c.status === "done" ? "✅" :
                        c.status === "running" ? "🔄" :
                        c.status === "failed" ? "❌" : "⏳";
                      const label =
                        c.status === "done" ? `(${c.adIds.length}/${c.totalAds} ads)` :
                        c.status === "running" ? "criando..." :
                        c.status === "failed" ? `falhou: ${c.error ?? "erro"}` :
                        "fila";
                      return (
                        <li key={c.folderName} className="flex items-baseline gap-2">
                          <span>{icon}</span>
                          <span className="font-mono">{c.folderName}</span>
                          <span className="text-muted-foreground">{label}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Pode levar 30s a 3min por conjunto (mais demorado se houver vídeo).</p>
                )}
              </div>
            )}
            {isFailed && status?.errorMessage && (
              <div className="flex items-start gap-2 p-3 border border-red-500/30 bg-red-500/5 rounded text-sm">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Falhou</p>
                  <p className="text-muted-foreground">{status.errorMessage}</p>
                </div>
              </div>
            )}
            {validationError && !isExecuting && (
              <p className="text-xs text-amber-500">{validationError}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExecuting}>
            {isDone ? "Fechar" : "Cancelar"}
          </Button>
          {!isDone && (
            <Button
              onClick={handleCreate}
              disabled={!!validationError || isExecuting}
            >
              {isExecuting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Criar em PAUSED no Meta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
