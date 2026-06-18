import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Copy, Check, AlertTriangle, Link2, History, Settings, Loader2, Plus, ShieldAlert, Sparkles, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  UTM_MEDIUMS,
  UTM_MEDIUM_LABELS,
  UTM_SOURCES_BY_MEDIUM,
  UTM_SOURCE_LABELS,
  PAID_MEDIA_HINTS,
  type UtmMedium,
} from "@shared/utm-vocabulary";
import { sanitizeUtmValue, sanitizeUtmValueLive, buildUtmUrl } from "@shared/utm-sanitize";
import { isGrowthTeam } from "@shared/growth-team";

interface VocabularyItem {
  id: string;
  value: string;
  labelPt: string;
  source: string | null;
}

interface HistoryRow {
  id: string;
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  fullUrl: string;
  isAdhoc: boolean;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

const OUTRO_VALUE = "__outro__";

export default function UtmBuilder() {
  usePageTitle("Gerador de UTMs");
  useSetPageInfo("Gerador de UTMs", "Constituição UTM Turbo v1.4");

  // Badge de pendências — só busca se for admin ou time de Growth
  const { data: user } = useQuery<AuthUser>({ queryKey: ["/api/auth/me"] });
  const canEditVocabulary = user?.role === "admin" || isGrowthTeam(user?.email);
  const { data: adhocs } = useQuery<AdhocPendingItem[]>({
    queryKey: ["/api/utm/adhoc-pending"],
    queryFn: async () => {
      const res = await fetch("/api/utm/adhoc-pending", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canEditVocabulary,
  });
  const pendingCount = adhocs?.length || 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Tabs defaultValue="gerar" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="gerar" data-testid="tab-gerar">
            <Link2 className="w-4 h-4 mr-2" />
            Gerar link
          </TabsTrigger>
          <TabsTrigger value="historico" data-testid="tab-historico">
            <History className="w-4 h-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="configurar" data-testid="tab-configurar">
            <Settings className="w-4 h-4 mr-2" />
            Configurar valores
            {canEditVocabulary && pendingCount > 0 && (
              <Badge variant="default" className="ml-2 bg-amber-500 hover:bg-amber-500 text-white">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="guia" data-testid="tab-guia">
            <BookOpen className="w-4 h-4 mr-2" />
            Guia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gerar">
          <TabGerar />
        </TabsContent>

        <TabsContent value="historico">
          <TabHistorico />
        </TabsContent>

        <TabsContent value="configurar">
          <TabConfigurar />
        </TabsContent>

        <TabsContent value="guia">
          <TabGuia />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// ABA 1 — GERAR LINK
// ============================================================================

function TabGerar() {
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState("");
  const [medium, setMedium] = useState<UtmMedium | "">("");
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [campaignOther, setCampaignOther] = useState("");
  const [term, setTerm] = useState("");
  const [termOther, setTermOther] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Reset cascata ao trocar medium
  useEffect(() => {
    setSource("");
    setCampaign("");
    setTerm("");
    setCampaignOther("");
    setTermOther("");
  }, [medium]);

  // Reset campaign/term ao trocar source
  useEffect(() => {
    setCampaign("");
    setTerm("");
    setCampaignOther("");
    setTermOther("");
  }, [source]);

  const { data: baseUrlSuggestions } = useQuery<string[]>({
    queryKey: ["/api/utm/base-urls"],
  });

  const { data: campaignOptions } = useQuery<VocabularyItem[]>({
    queryKey: ["/api/utm/vocabulary", "campaign", medium, source],
    queryFn: async () => {
      if (!medium) return [];
      const params = new URLSearchParams({ field: "campaign", medium });
      if (source) params.set("source", source);
      const res = await fetch(`/api/utm/vocabulary?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!medium,
  });

  const { data: termOptions } = useQuery<VocabularyItem[]>({
    queryKey: ["/api/utm/vocabulary", "term", medium, source],
    queryFn: async () => {
      if (!medium) return [];
      const params = new URLSearchParams({ field: "term", medium });
      if (source) params.set("source", source);
      const res = await fetch(`/api/utm/vocabulary?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!medium,
  });

  // Valor final de campaign/term considerando "Outro"
  const finalCampaign = campaign === OUTRO_VALUE ? sanitizeUtmValue(campaignOther) : campaign;
  const finalTerm = term === OUTRO_VALUE ? sanitizeUtmValue(termOther) : term;
  const finalContent = sanitizeUtmValue(content);

  const sourceOptions = useMemo(() => {
    if (!medium) return [];
    if (medium === "eventos") return []; // input livre
    return UTM_SOURCES_BY_MEDIUM[medium];
  }, [medium]);

  const previewUrl = useMemo(() => {
    if (!baseUrl || !medium || !source) return "";
    try {
      return buildUtmUrl({
        baseUrl,
        utmSource: source,
        utmMedium: medium,
        utmCampaign: finalCampaign || undefined,
        utmTerm: finalTerm || undefined,
        utmContent: finalContent || undefined,
      });
    } catch {
      return "";
    }
  }, [baseUrl, medium, source, finalCampaign, finalTerm, finalContent]);

  const isPaidMedium = medium === "paid";
  const paidHints = isPaidMedium && source ? PAID_MEDIA_HINTS[source] : null;

  const isCampaignAdhoc = campaign === OUTRO_VALUE && campaignOther.length > 0;
  const isTermAdhoc = term === OUTRO_VALUE && termOther.length > 0;

  const canGenerate =
    /^https?:\/\//i.test(baseUrl) &&
    !!medium &&
    !!source &&
    (medium !== "eventos" || source.length > 0);

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/utm/generate", {
        baseUrl,
        utmSource: source,
        utmMedium: medium,
        utmCampaign: finalCampaign || undefined,
        utmTerm: finalTerm || undefined,
        utmContent: finalContent || undefined,
      });
    },
    onSuccess: async (res: any) => {
      const data = await res.json();
      setGeneratedUrl(data.url);
      navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link gerado e copiado!",
        description: data.isAdhoc
          ? "Você usou um valor que ainda não está cadastrado — admin vai oficializar depois."
          : "URL pronta para colar onde precisar.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/utm/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/utm/base-urls"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Falha ao gerar link", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Gerar link com UTM</h2>
          <p className="text-sm text-muted-foreground">
            Padronizado pela Constituição UTM Turbo v1. Preencha os campos em ordem.
          </p>
        </div>

        {/* URL Base */}
        <div className="space-y-2">
          <Label htmlFor="base-url">1. URL de destino</Label>
          <Input
            id="base-url"
            data-testid="input-base-url"
            placeholder="https://turbopartners.com.br/creators"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            list="base-url-suggestions"
          />
          <datalist id="base-url-suggestions">
            <option value="https://turbopartners.com.br/" />
            <option value="https://turbopartners.com.br/creators" />
            <option value="https://pages.turbopartners.com.br/" />
            {baseUrlSuggestions?.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          {baseUrl && !/^https?:\/\//i.test(baseUrl) && (
            <p className="text-xs text-destructive">URL precisa começar com http:// ou https://</p>
          )}
        </div>

        {/* Medium */}
        <div className="space-y-2">
          <Label>2. Medium (categoria do canal)</Label>
          <Select value={medium} onValueChange={(v) => setMedium(v as UtmMedium)}>
            <SelectTrigger data-testid="select-medium">
              <SelectValue placeholder="Escolha o medium" />
            </SelectTrigger>
            <SelectContent>
              {UTM_MEDIUMS.map((m) => (
                <SelectItem key={m} value={m} data-testid={`medium-${m}`}>
                  {UTM_MEDIUM_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Source */}
        {medium && (
          <div className="space-y-2">
            <Label>3. Source (canal técnico de onde o clique sai)</Label>
            {medium === "eventos" ? (
              <Input
                data-testid="input-source-evento"
                placeholder="slug-do-evento (ex: rd-summit-2026, turbo-workshop-creators-sp)"
                value={source}
                onChange={(e) => setSource(sanitizeUtmValueLive(e.target.value))}
              />
            ) : (
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger data-testid="select-source">
                  <SelectValue placeholder="Escolha o source" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((s) => (
                    <SelectItem key={s} value={s} data-testid={`source-${s}`}>
                      {UTM_SOURCE_LABELS[s] || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Campaign */}
        {medium && source && (
          <div className="space-y-2">
            <Label>4. Campaign {paidHints && <span className="text-muted-foreground text-xs">(use token dinâmico)</span>}</Label>
            {isPaidMedium && paidHints ? (
              <Input
                data-testid="input-campaign-paid"
                placeholder={paidHints.campaign}
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              />
            ) : (
              <>
                <Select value={campaign} onValueChange={setCampaign}>
                  <SelectTrigger data-testid="select-campaign">
                    <SelectValue placeholder="Escolha ou digite um novo" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignOptions?.map((opt) => (
                      <SelectItem key={opt.id} value={opt.value} data-testid={`campaign-${opt.value}`}>
                        {opt.labelPt}
                      </SelectItem>
                    ))}
                    <SelectItem value={OUTRO_VALUE} data-testid="campaign-outro">
                      ✏️ Outro / digitar valor novo
                    </SelectItem>
                  </SelectContent>
                </Select>
                {campaign === OUTRO_VALUE && (
                  <>
                    <Input
                      data-testid="input-campaign-other"
                      placeholder="ex: dr-rafael, nutricao-creators-2026-05"
                      value={campaignOther}
                      onChange={(e) => setCampaignOther(sanitizeUtmValueLive(e.target.value))}
                    />
                    {isCampaignAdhoc && (
                      <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700 dark:text-amber-300">
                          Este valor ainda não está cadastrado. Considere pedir pro admin oficializar pra aparecer no dropdown.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Term */}
        {medium && source && (
          <div className="space-y-2">
            <Label>5. Term {paidHints && <span className="text-muted-foreground text-xs">(use token dinâmico)</span>}</Label>
            {isPaidMedium && paidHints ? (
              <Input
                data-testid="input-term-paid"
                placeholder={paidHints.term}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            ) : (
              <>
                <Select value={term} onValueChange={setTerm}>
                  <SelectTrigger data-testid="select-term">
                    <SelectValue placeholder="Escolha ou digite um novo" />
                  </SelectTrigger>
                  <SelectContent>
                    {termOptions?.map((opt) => (
                      <SelectItem key={opt.id} value={opt.value} data-testid={`term-${opt.value}`}>
                        {opt.labelPt}
                      </SelectItem>
                    ))}
                    <SelectItem value={OUTRO_VALUE} data-testid="term-outro">
                      ✏️ Outro / digitar valor novo
                    </SelectItem>
                  </SelectContent>
                </Select>
                {term === OUTRO_VALUE && (
                  <>
                    <Input
                      data-testid="input-term-other"
                      placeholder="ex: feed, stories, linktree"
                      value={termOther}
                      onChange={(e) => setTermOther(sanitizeUtmValueLive(e.target.value))}
                    />
                    {isTermAdhoc && (
                      <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700 dark:text-amber-300">
                          Este valor ainda não está cadastrado. Considere pedir pro admin oficializar.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Content */}
        {medium && source && (
          <div className="space-y-2">
            <Label>
              6. Content {paidHints && <span className="text-muted-foreground text-xs">(use token dinâmico)</span>}
              <span className="text-xs text-muted-foreground ml-1">(ID único do post/peça)</span>
            </Label>
            {isPaidMedium && paidHints ? (
              <Input
                data-testid="input-content-paid"
                placeholder={paidHints.content}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            ) : (
              <Input
                data-testid="input-content"
                placeholder="ex: post-2026-05-19-creators, touchpoint-12-audio-convite"
                value={content}
                onChange={(e) => setContent(sanitizeUtmValueLive(e.target.value))}
              />
            )}
          </div>
        )}

        {/* Preview */}
        {previewUrl && (
          <div className="space-y-2 pt-4 border-t">
            <Label>URL gerada</Label>
            <div className="rounded-md bg-muted p-3 font-mono text-sm break-all" data-testid="preview-url">
              {previewUrl}
            </div>
            <div className="flex gap-2 items-center">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!canGenerate || generateMutation.isPending}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : copied ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copied ? "Copiado!" : "Copiar e salvar"}
              </Button>
              {(isCampaignAdhoc || isTermAdhoc) && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  Valor novo (não oficializado)
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Snippets de exemplo */}
        <Accordion type="single" collapsible className="pt-4">
          <AccordionItem value="snippets">
            <AccordionTrigger>Exemplos prontos por medium</AccordionTrigger>
            <AccordionContent className="space-y-3 font-mono text-xs">
              <div>
                <strong className="not-italic font-sans text-sm">Post no Instagram com link na bio:</strong>
                <div className="bg-muted p-2 rounded mt-1 break-all">
                  ?utm_source=instagram&utm_medium=organic&utm_campaign=bio&utm_term=feed&utm_content=post-2026-05-19-creators
                </div>
              </div>
              <div>
                <strong className="not-italic font-sans text-sm">Footer do Dr. Rafael:</strong>
                <div className="bg-muted p-2 rounded mt-1 break-all">
                  ?utm_source=cliente&utm_medium=referral&utm_campaign=dr-rafael&utm_term=footer&utm_content=rodape-home
                </div>
              </div>
              <div>
                <strong className="not-italic font-sans text-sm">WhatsApp nutrição:</strong>
                <div className="bg-muted p-2 rounded mt-1 break-all">
                  ?utm_source=whatsapp&utm_medium=crm&utm_campaign=turma-6-rafa-mais-proximo&utm_term=lista-quentes&utm_content=touchpoint-12
                </div>
              </div>
              <div>
                <strong className="not-italic font-sans text-sm">Evento com QR code:</strong>
                <div className="bg-muted p-2 rounded mt-1 break-all">
                  ?utm_source=rd-summit-2026&utm_medium=eventos&utm_campaign=presencial-2026&utm_term=palestra&utm_content=slide-final-cta
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ABA 2 — HISTÓRICO
// ============================================================================

function TabHistorico() {
  const [filterMedium, setFilterMedium] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  // Reset página quando filtros mudam
  useEffect(() => {
    setPage(1);
  }, [filterMedium, searchQ]);

  const { data, isLoading } = useQuery<{ rows: HistoryRow[]; page: number; pageSize: number }>({
    queryKey: ["/api/utm/history", filterMedium, searchQ, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterMedium && filterMedium !== "all") params.set("medium", filterMedium);
      if (searchQ) params.set("q", searchQ);
      params.set("page", String(page));
      const res = await fetch(`/api/utm/history?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const hasNext = (data?.rows.length || 0) >= (data?.pageSize || 50);

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada!" });
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">Histórico de links gerados</h2>
          <p className="text-sm text-muted-foreground">
            Todos os links já criados por todo o time. Filtre, busque, copie.
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={filterMedium} onValueChange={setFilterMedium}>
            <SelectTrigger className="w-48" data-testid="filter-medium">
              <SelectValue placeholder="Todos os mediums" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os mediums</SelectItem>
              {UTM_MEDIUMS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar por campaign, content, term ou URL..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="max-w-md"
            data-testid="filter-search"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criado</TableHead>
                <TableHead>Por</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>URL</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum link gerado ainda.
                  </TableCell>
                </TableRow>
              )}
              {data?.rows.map((row) => (
                <TableRow key={row.id} data-testid={`history-row-${row.id}`}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(row.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-xs">{row.userName || row.userEmail || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.utmMedium}</Badge>
                  </TableCell>
                  <TableCell>{row.utmSource}</TableCell>
                  <TableCell className="text-xs">{row.utmCampaign || "—"}</TableCell>
                  <TableCell className="text-xs">{row.utmTerm || "—"}</TableCell>
                  <TableCell className="text-xs">{row.utmContent || "—"}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate" title={row.fullUrl}>
                    {row.fullUrl}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(row.fullUrl)}
                      data-testid={`copy-${row.id}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isLoading && (page > 1 || hasNext) && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              Página {page}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
              >
                Próxima →
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ABA 3 — CONFIGURAR VALORES (admin)
// ============================================================================

interface VocabularyFullItem {
  id: string;
  field: "campaign" | "term";
  medium: string;
  source: string | null;
  value: string;
  labelPt: string;
  isActive: boolean;
  createdAt: string;
}

interface AdhocPendingItem {
  field: "campaign" | "term";
  medium: string;
  source: string | null;
  value: string;
  first_seen: string;
  uses: string;
}

interface AuthUser {
  id: string;
  role: "admin" | "user";
  name: string;
  email: string;
}

function TabConfigurar() {
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
  });

  const canEdit = user?.role === "admin" || isGrowthTeam(user?.email);

  if (userLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Acesso restrito</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Esta aba é restrita ao time de Growth e admins do Cortex. Se você precisa cadastrar um valor novo de campaign ou term, peça pra alguém do time de Growth.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="organic" className="w-full">
      <TabsList className="mb-4 flex-wrap h-auto">
        {UTM_MEDIUMS.map((m) => (
          <TabsTrigger key={m} value={m} data-testid={`subtab-${m}`}>
            {m}
          </TabsTrigger>
        ))}
      </TabsList>

      {UTM_MEDIUMS.map((m) => (
        <TabsContent key={m} value={m} className="space-y-6">
          <PendingAdhocsCard medium={m} />
          <SourcesForMediumCard medium={m} />
          <VocabularySection
            field="campaign"
            medium={m}
            title={`Campaigns oficiais — ${m}`}
            description="Nomes de iniciativas, clientes, fluxos, cadências. Aparecem no dropdown Campaign da aba Gerar."
          />
          <VocabularySection
            field="term"
            medium={m}
            title={`Terms oficiais — ${m}`}
            description="Posicionamentos, locais do clique, segmentos. Aparecem no dropdown Term da aba Gerar."
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ============================================================================
// Pendências (valores criados sem cadastro)
// ============================================================================

function PendingAdhocsCard({ medium }: { medium?: string }) {
  const { toast } = useToast();
  const { data: allAdhocs } = useQuery<AdhocPendingItem[]>({
    queryKey: ["/api/utm/adhoc-pending"],
    queryFn: async () => {
      const res = await fetch("/api/utm/adhoc-pending", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar pendências");
      return res.json();
    },
  });

  const adhocs = medium ? allAdhocs?.filter((a) => a.medium === medium) : allAdhocs;
  const [promoting, setPromoting] = useState<AdhocPendingItem | null>(null);

  const dismissMutation = useMutation({
    mutationFn: async (a: AdhocPendingItem) => {
      return apiRequest("POST", "/api/utm/adhoc-dismiss", {
        field: a.field,
        medium: a.medium,
        source: a.source,
        value: a.value,
      });
    },
    onSuccess: () => {
      toast({ title: "Dispensado", description: "Valor removido das pendências (não vira opção do dropdown)." });
      queryClient.invalidateQueries({ queryKey: ["/api/utm/adhoc-pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/utm/vocabulary/all"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Falha ao dispensar", variant: "destructive" });
    },
  });

  if (!adhocs || adhocs.length === 0) return null;

  return (
    <>
      <Card className="border-amber-500/50">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold">Valores criados sem cadastro ({adhocs.length})</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            O time digitou esses valores via "Outro" mas eles ainda não estão na lista oficial.
            Clique em "Oficializar" pra adicioná-los aos dropdowns.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Valor digitado</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Visto pela 1ª vez</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adhocs.map((a, i) => (
                <TableRow key={`${a.field}-${a.medium}-${a.source || "_"}-${a.value}-${i}`}>
                  <TableCell><Badge variant="secondary">{a.field}</Badge></TableCell>
                  <TableCell>{a.medium}</TableCell>
                  <TableCell>{a.source || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{a.value}</TableCell>
                  <TableCell>{a.uses}</TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(a.first_seen), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => setPromoting(a)}>
                        Oficializar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => dismissMutation.mutate(a)}
                        disabled={dismissMutation.isPending}
                        data-testid={`dismiss-${a.value}`}
                      >
                        Dispensar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {promoting && (
        <VocabularyDialog
          field={promoting.field}
          presetMedium={promoting.medium}
          presetSource={promoting.source}
          presetValue={promoting.value}
          open={!!promoting}
          onClose={() => setPromoting(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// Sources daquele medium (read-only) — mostra a Constituição contextualmente
// ============================================================================

function SourcesForMediumCard({ medium }: { medium: UtmMedium }) {
  const sources = UTM_SOURCES_BY_MEDIUM[medium];
  const isOpenVocab = medium === "eventos";

  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-bold">Sources permitidos em <span className="font-mono">{medium}</span></h3>
          <Badge variant="outline" className="text-xs">Fixo pela Constituição</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {UTM_MEDIUM_LABELS[medium]}. Mudar essa lista exige PR no código + aprovação Growth + Pre-Sales.
        </p>
        {isOpenVocab ? (
          <p className="text-sm">
            Vocabulário <strong>aberto</strong> — aceita qualquer slug de evento (ex:{" "}
            <code className="font-mono text-xs">rd-summit-2026</code>,{" "}
            <code className="font-mono text-xs">turbo-workshop-creators-sp</code>).
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <div key={s} className="border rounded-md px-3 py-1.5 text-sm">
                <div className="font-mono font-bold">{s}</div>
                <div className="text-xs text-muted-foreground">{UTM_SOURCE_LABELS[s] || s}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Tabela de Campaign ou Term (editável)
// ============================================================================

function VocabularySection({
  field,
  medium,
  title,
  description,
}: {
  field: "campaign" | "term";
  medium: UtmMedium;
  title: string;
  description: string;
}) {
  const [filterActive, setFilterActive] = useState<string>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VocabularyFullItem | null>(null);

  const {
    data: vocab,
    isLoading,
    error,
    refetch,
  } = useQuery<VocabularyFullItem[]>({
    queryKey: ["/api/utm/vocabulary/all", field, medium, filterActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("field", field);
      params.set("medium", medium);
      if (filterActive === "active") params.set("active", "true");
      if (filterActive === "inactive") params.set("active", "false");
      const res = await fetch(`/api/utm/vocabulary/all?${params}`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
      }
      return res.json();
    },
    staleTime: 0,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/utm/vocabulary/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/utm/vocabulary/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/utm/vocabulary"] });
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid={`new-${field}`}>
            <Plus className="w-4 h-4 mr-1" />
            Novo {field}
          </Button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ativos + inativos</SelectItem>
              <SelectItem value="active">Só ativos</SelectItem>
              <SelectItem value="inactive">Só inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {String((error as Error).message || "Falha ao carregar")}
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => refetch()}>
                Tentar de novo
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Valor (slug)</TableHead>
                <TableHead>Como aparece no dropdown</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vocab?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum {field} cadastrado em {medium}.
                  </TableCell>
                </TableRow>
              )}
              {vocab?.map((v) => (
                <TableRow key={v.id} data-testid={`${field}-row-${v.id}`}>
                  <TableCell>{v.source || <span className="text-muted-foreground">qualquer source</span>}</TableCell>
                  <TableCell className="font-mono text-xs">{v.value}</TableCell>
                  <TableCell>{v.labelPt}</TableCell>
                  <TableCell>
                    <Switch
                      checked={v.isActive}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: v.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(v)}
                      data-testid={`edit-${v.id}`}
                      title="Editar label"
                    >
                      ✎
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {dialogOpen && (
          <VocabularyDialog
            field={field}
            presetMedium={medium}
            lockedMedium
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
          />
        )}

        {editing && (
          <VocabularyDialog
            field={field}
            editingId={editing.id}
            presetMedium={editing.medium}
            presetSource={editing.source}
            presetValue={editing.value}
            presetLabel={editing.labelPt}
            open={!!editing}
            onClose={() => setEditing(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Dialog Cadastrar / Oficializar
// ============================================================================

function VocabularyDialog({
  field,
  presetMedium,
  presetSource,
  presetValue,
  presetLabel,
  editingId,
  lockedMedium,
  open,
  onClose,
}: {
  field: "campaign" | "term";
  presetMedium?: string;
  presetSource?: string | null;
  presetValue?: string;
  presetLabel?: string;
  editingId?: string;
  lockedMedium?: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [medium, setMedium] = useState<UtmMedium>((presetMedium as UtmMedium) || "organic");
  const [source, setSource] = useState<string>(presetSource || "");
  const [value, setValue] = useState(presetValue || "");
  const [labelPt, setLabelPt] = useState(
    presetLabel ||
      (presetValue
        ? presetValue.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")
        : "")
  );

  const sourcesForMedium =
    medium === "eventos" ? [] : UTM_SOURCES_BY_MEDIUM[medium] || [];

  const isEditing = !!editingId;
  const isPromoting = !!presetValue && !isEditing;
  const lockedAll = isEditing; // ao editar, só label muda

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/utm/vocabulary/${editingId}`, { labelPt });
      }
      return apiRequest("POST", "/api/utm/vocabulary", {
        field,
        medium,
        source: source || null,
        value,
        labelPt,
      });
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "Atualizado!" : isPromoting ? "Oficializado!" : "Cadastrado!",
      });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/utm/vocabulary/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/utm/vocabulary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/utm/adhoc-pending"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Falha ao salvar", variant: "destructive" });
    },
  });

  const title = isEditing
    ? `Editar label de "${presetValue}"`
    : isPromoting
    ? `Oficializar "${presetValue}"`
    : `Novo ${field}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Medium</Label>
            <Select
              value={medium}
              onValueChange={(v) => setMedium(v as UtmMedium)}
              disabled={isPromoting || lockedMedium || lockedAll}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UTM_MEDIUMS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Source (deixe vazio pra valer pra todos os sources do medium)</Label>
            {sourcesForMedium.length > 0 ? (
              <Select
                value={source || "__all__"}
                onValueChange={(v) => setSource(v === "__all__" ? "" : v)}
                disabled={isPromoting || lockedAll}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Qualquer source de "{medium}"</SelectItem>
                  {sourcesForMedium.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="slug do evento ou vazio"
                value={source}
                onChange={(e) => setSource(sanitizeUtmValueLive(e.target.value))}
                disabled={isPromoting || lockedAll}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Valor (slug) — como vai aparecer na URL</Label>
            <Input
              placeholder="ex: dr-rafael, social-selling, lista-quentes"
              value={value}
              onChange={(e) => setValue(sanitizeUtmValueLive(e.target.value))}
              disabled={isPromoting || lockedAll}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Como aparece no dropdown (label em PT)</Label>
            <Input
              placeholder="ex: Dr. Rafael, Social Selling, Lista de quentes"
              value={labelPt}
              onChange={(e) => setLabelPt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!value || !labelPt || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ABA 4 — GUIA (exemplos por plataforma)
// ============================================================================

interface ExemploProps {
  titulo: string;
  descricao: string;
  url: string;
}

function ExemploCard({ titulo, descricao, url }: ExemploProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "URL copiada", description: "Cola e ajusta o conteúdo final." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{titulo}</h4>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">{descricao}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
      <code className="block bg-gray-50 dark:bg-zinc-800 text-xs font-mono p-2 rounded mt-2 break-all text-gray-800 dark:text-zinc-200">
        {url}
      </code>
    </div>
  );
}

function TermoTabela({ rows }: { rows: { term: string; onde: string }[] }) {
  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-zinc-800">
          <tr>
            <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300 w-1/3">term</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300">onde fica</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.term} className="border-t border-gray-200 dark:border-zinc-700">
              <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-white">{r.term}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">{r.onde}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{titulo}</h3>
          {descricao && <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">{descricao}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// Sub-abas do Guia — uma por canal. "Fundamentos" concentra o que é transversal.
const GUIA_CANAIS: { value: string; label: string }[] = [
  { value: "fundamentos", label: "Fundamentos" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "paga", label: "Mídia Paga" },
  { value: "eventos", label: "Eventos" },
  { value: "crm", label: "CRM" },
  { value: "outbound", label: "Outbound" },
  { value: "referral", label: "Referral" },
  { value: "proprios", label: "Canais próprios" },
];

// Cabeçalho padrão de cada canal: título + time(s) responsável(is) + resumo de uma linha.
function CanalHeader({ titulo, times, resumo }: { titulo: string; times: string[]; resumo: string }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{titulo}</h2>
        <div className="flex flex-wrap gap-2">
          {times.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs font-medium">
              Time: {t}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-gray-700 dark:text-zinc-300">{resumo}</p>
      </CardContent>
    </Card>
  );
}

// Lista numerada do "como fazer" no gerador.
function Passos({ items }: { items: React.ReactNode[] }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Passo a passo — aba "Gerar link"
        </h3>
        <ol className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-zinc-300">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="pt-0.5">{it}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// Bloco "não faça" específico do canal.
function ProibicoesCanal({ items }: { items: React.ReactNode[] }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-2">
        <h3 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Não faça
        </h3>
        <ul className="text-sm space-y-1.5 text-gray-700 dark:text-zinc-300">
          {items.map((it, i) => (
            <li key={i}>• {it}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Bloco de exemplos prontos (copiáveis).
function Exemplos({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Exemplos prontos
        </h3>
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function TabGuia() {
  return (
    <Tabs defaultValue="fundamentos" className="w-full">
      <TabsList className="mb-6 flex flex-wrap h-auto justify-start gap-1 p-1">
        {GUIA_CANAIS.map((c) => (
          <TabsTrigger key={c.value} value={c.value} data-testid={`guia-tab-${c.value}`}>
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="fundamentos"><GuiaFundamentos /></TabsContent>
      <TabsContent value="instagram"><GuiaInstagram /></TabsContent>
      <TabsContent value="youtube"><GuiaYoutube /></TabsContent>
      <TabsContent value="tiktok"><GuiaTiktok /></TabsContent>
      <TabsContent value="linkedin"><GuiaLinkedin /></TabsContent>
      <TabsContent value="paga"><GuiaPaga /></TabsContent>
      <TabsContent value="eventos"><GuiaEventos /></TabsContent>
      <TabsContent value="crm"><GuiaCrm /></TabsContent>
      <TabsContent value="outbound"><GuiaOutbound /></TabsContent>
      <TabsContent value="referral"><GuiaReferral /></TabsContent>
      <TabsContent value="proprios"><GuiaProprios /></TabsContent>
    </Tabs>
  );
}

// ── FUNDAMENTOS (transversal: conceitos, content, slugs, bio vs linktree, proibições) ──
function GuiaFundamentos() {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Como preencher cada UTM</h2>
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            Tudo aqui segue a <strong>Constituição UTM Turbo v1.4</strong>. Monte os links na aba <strong>Gerar link</strong> (os dropdowns já garantem o padrão). Use estas sub-abas por <strong>canal</strong> pra saber exatamente o que preencher no seu time. Comece entendendo os 5 campos:
          </p>
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm space-y-1">
            <div><strong>medium</strong> — categoria do canal (paid, organic, eventos, referral, crm, outbound + os canais-próprios victor/andre/rodrigo)</div>
            <div><strong>source</strong> — plataforma técnica de onde saiu o clique (facebook, google, instagram, linkedin…)</div>
            <div><strong>campaign</strong> — iniciativa de marketing (always-on, social-selling, lancamento-X)</div>
            <div><strong>term</strong> — onde fisicamente o link foi colado (feed, stories, bio, dm…)</div>
            <div><strong>content</strong> — identificador da peça específica (tipo de destino, ou slug + data — ver detalhe na aba de cada canal)</div>
          </div>
        </CardContent>
      </Card>

      {/* PROIBIÇÕES GLOBAIS */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Proibições (valem pra todo canal)
          </h3>
          <ul className="text-sm space-y-2 text-gray-700 dark:text-zinc-300">
            <li>• <strong>Nunca</strong> usar <code className="font-mono">fb</code>, <code className="font-mono">meta</code> ou <code className="font-mono">ig</code> — Meta Ads é sempre <code className="font-mono">facebook</code>, Instagram orgânico é <code className="font-mono">instagram</code>.</li>
            <li>• <strong>Linktree não é source.</strong> O source é a rede onde o clique nasceu (instagram, tiktok…). Linktree vai como <code className="font-mono">term=linktree</code>.</li>
            <li>• Nome de cliente, colaborador, influencer <strong>nunca em source</strong>. Vai em <code className="font-mono">campaign</code>.</li>
            <li>• Sem espaço, sem underline, sem maiúscula, sem acento. Sempre lowercase com hífen.</li>
            <li>• Ferramenta de envio (RD, Mailchimp, Apollo) não entra no UTM. source é só o canal de entrega.</li>
          </ul>
        </CardContent>
      </Card>

      {/* ALWAYS-ON */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            O que é <code className="font-mono text-base">campaign=always-on</code>?
          </h3>
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            <strong>Always-on</strong> = presença contínua, <strong>sem data de início ou fim</strong>. É o valor <strong>padrão</strong> de <code className="font-mono">campaign</code> para todo conteúdo recorrente que <strong>não</strong> faz parte de uma campanha nomeada específica. Pensa nele como o "sempre ligado" da marca: o link existe o tempo todo, não amarrado a um lançamento.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-3">
              <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm mb-2">Use always-on quando…</h4>
              <ul className="text-sm space-y-1 text-gray-700 dark:text-zinc-300">
                <li>• link fixo na bio / "Sobre" / banner</li>
                <li>• post do dia a dia, sem campanha por trás</li>
                <li>• descrição de vídeo recorrente</li>
                <li>• DM de rotina (fora de iniciativa nomeada)</li>
              </ul>
            </div>
            <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3">
              <h4 className="font-semibold text-amber-700 dark:text-amber-300 text-sm mb-2">NÃO use quando o link tem objetivo/data próprios</h4>
              <ul className="text-sm space-y-1 text-gray-700 dark:text-zinc-300">
                <li>• lançamento → <code className="font-mono text-xs">lancamento-&#123;slug&#125;-&#123;aaaa-mm&#125;</code></li>
                <li>• SDR nas DMs → <code className="font-mono text-xs">social-selling</code></li>
                <li>• ManyChat / bots → <code className="font-mono text-xs">automacoes</code></li>
                <li>• evento, parceria, régua → nome próprio</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400">
            <strong>Por que importa:</strong> no relatório, o always-on é a sua linha de base contínua. Separá-lo das campanhas pontuais deixa claro o que vem do "fluxo de sempre" e o que vem de picos de iniciativas específicas.
          </p>
        </CardContent>
      </Card>

      {/* SLUGS DE PRODUTO */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Slugs oficiais dos produtos</h3>
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            Use sempre esses slugs em <code className="font-mono">campaign</code> de lançamento e em <code className="font-mono">content</code>. Não inventar variações.
          </p>
          <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300 w-1/3">Produto</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300 w-1/4">slug</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300">também conhecido como</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">Creators</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-white">creators</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">UGC, GC (mesma coisa)</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">E-Commerce</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-white">ecommerce</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">Shopify (todo projeto é em Shopify)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400">
            Exemplos: <code className="font-mono">campaign=lancamento-creators-2026-05</code> · link fixo <code className="font-mono">content=lp-creators</code> · post <code className="font-mono">content=ecommerce-2026-05</code>
          </p>
        </CardContent>
      </Card>

      {/* BIO VS LINKTREE */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bio vs Linktree — qual usar?</h3>
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            Os dois existem porque a Turbo usa Linktree no Instagram (e às vezes no TikTok). A regra é simples e depende só de <strong>onde você está colando o link</strong> na hora.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 bg-white dark:bg-zinc-900">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                <code className="font-mono text-sm">term=bio</code>
              </h4>
              <p className="text-sm text-gray-700 dark:text-zinc-300 mt-2">
                Quando o link com UTM vai <strong>direto na bio do perfil</strong> (campo "site/website" do Instagram/TikTok/LinkedIn). Sem Linktree no meio.
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">
                Ex: bio do IG aponta direto pra <code className="font-mono">turbopartners.com.br/creators?utm=…</code>
              </p>
            </div>
            <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 bg-white dark:bg-zinc-900">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                <code className="font-mono text-sm">term=linktree</code>
              </h4>
              <p className="text-sm text-gray-700 dark:text-zinc-300 mt-2">
                Quando o link com UTM está cadastrado <strong>dentro da Linktree</strong>. Você está editando a Linktree e colando a URL no campo de algum botão de lá.
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">
                Ex: bio do IG aponta pra Linktree, e dentro tem botão "Diagnóstico Creators" com UTM.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400">
            Em qualquer caso, o <code className="font-mono">content</code> identifica o <strong>tipo de destino</strong> do link fixo: <code className="font-mono">lp-creators</code> (landing page), <code className="font-mono">site-home</code> (site institucional). Não use o prefixo antigo <code className="font-mono">link-</code>.
          </p>
        </CardContent>
      </Card>

      {/* BIO COM MÚLTIPLOS LINKS */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bio com vários links (até 5 no Instagram)</h3>
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            A bio nativa hoje aceita <strong>vários links diretos</strong> (até 5 no Instagram), funcionando como uma mini-Linktree dentro do app. Como todos ficam fisicamente na bio, <strong>todos usam <code className="font-mono">term=bio</code></strong> — o que diferencia cada botão é o <code className="font-mono">content</code> (tipo de destino, sem data, porque é link fixo).
          </p>
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            O <code className="font-mono">campaign</code> fica <code className="font-mono">always-on</code> para botões de presença contínua; só muda quando o botão pertence a uma iniciativa específica (ex: <code className="font-mono">creator-summit-2026</code>).
          </p>
          <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300">Botão</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300">campaign</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300">term</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300">content</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">Página Creators</td>
                  <td className="px-3 py-2 font-mono text-xs">always-on</td>
                  <td className="px-3 py-2 font-mono text-xs">bio</td>
                  <td className="px-3 py-2 font-mono text-xs">lp-creators</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">Creator Summit</td>
                  <td className="px-3 py-2 font-mono text-xs">creator-summit-2026</td>
                  <td className="px-3 py-2 font-mono text-xs">bio</td>
                  <td className="px-3 py-2 font-mono text-xs">lp-creator-summit</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">WhatsApp</td>
                  <td className="px-3 py-2 font-mono text-xs">always-on</td>
                  <td className="px-3 py-2 font-mono text-xs">bio</td>
                  <td className="px-3 py-2 font-mono text-xs">whatsapp</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">Site</td>
                  <td className="px-3 py-2 font-mono text-xs">always-on</td>
                  <td className="px-3 py-2 font-mono text-xs">bio</td>
                  <td className="px-3 py-2 font-mono text-xs">site-home</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-gray-700 dark:text-zinc-300">
            <strong>Atenção WhatsApp:</strong> UTM colada direto num link <code className="font-mono">wa.me</code> / <code className="font-mono">api.whatsapp.com</code> <strong>não rastreia</strong> — o WhatsApp ignora os parâmetros e o lead nunca chega ao Bitrix. Para rastrear o botão de WhatsApp, aponte para uma página de redirect tracked (ex: <code className="font-mono">pages.turbopartners.com.br/wpp?…</code>) que registra a UTM e redireciona pro <code className="font-mono">wa.me</code>.
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardContent className="p-4 text-xs text-gray-500 dark:text-zinc-500 text-center">
          Documento de referência completo: <code className="font-mono">docs/utm-constituicao.md</code> · Constituição UTM Turbo v1.4 · Vigência a partir de 21/05/2026
        </CardContent>
      </Card>
    </div>
  );
}

// ── INSTAGRAM ──
function GuiaInstagram() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="Instagram orgânico"
        times={["Conteúdo/Social", "SDR — só DM"]}
        resumo="source = instagram. Mesmo quando o link passa por Linktree, o source continua instagram (a Linktree vira term=linktree)."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">organic</code></>,
          <><code className="font-mono">source</code> = <code className="font-mono">instagram</code></>,
          <><code className="font-mono">term</code> = onde você está colando o link (veja a tabela abaixo): <code className="font-mono">bio</code>, <code className="font-mono">feed</code>, <code className="font-mono">stories</code>, <code className="font-mono">reels</code>, <code className="font-mono">destaques</code>, <code className="font-mono">dm</code>, <code className="font-mono">linktree</code></>,
          <><code className="font-mono">campaign</code>: <code className="font-mono">always-on</code> (presença contínua) · <code className="font-mono">lancamento-&#123;slug&#125;-&#123;aaaa-mm&#125;</code> (lançamento) · <code className="font-mono">social-selling</code> (DM do SDR) · <code className="font-mono">automacoes</code> (ManyChat/bot)</>,
          <><code className="font-mono">content</code>: <strong>link fixo</strong> (bio/linktree) → tipo de destino <strong>sem data</strong> (<code className="font-mono">lp-creators</code>); <strong>post</strong> (feed/stories/reels/dm) → <strong>nome + data</strong> (<code className="font-mono">creators-2026-05-26</code>)</>,
          <>Clique em <strong>Copiar e salvar</strong> — o link entra no Histórico do time.</>,
        ]}
      />
      <Secao titulo="term — onde fica" >
        <TermoTabela
          rows={[
            { term: "bio", onde: "link único na bio do perfil" },
            { term: "feed", onde: "post no feed/timeline" },
            { term: "stories", onde: "stories temporários" },
            { term: "reels", onde: "Reels" },
            { term: "destaques", onde: "Story Highlights (destaques fixados)" },
            { term: "dm", onde: "mensagem direta (social-selling do SDR)" },
            { term: "linktree", onde: "passou pelo intermediário Linktree" },
          ]}
        />
      </Secao>
      <Exemplos>
        <ExemploCard
          titulo="Link fixo na bio (pra LP de Creators)"
          descricao="Link fixo — content = tipo de destino (lp-), sem data."
          url="https://turbopartners.com.br/creators?utm_source=instagram&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=lp-creators"
        />
        <ExemploCard
          titulo="SDR mandando link via DM (social-selling)"
          descricao="Iniciativa coordenada do time de Pré-vendas conversando nas DMs."
          url="https://turbopartners.com.br/diagnostico?utm_source=instagram&utm_medium=organic&utm_campaign=social-selling&utm_term=dm&utm_content=leandro-2026-05-26"
        />
        <ExemploCard
          titulo="Stories de lançamento de produto"
          descricao="Campanha pontual — slug no formato lancamento-{produto}-{aaaa-mm}."
          url="https://turbopartners.com.br/creators?utm_source=instagram&utm_medium=organic&utm_campaign=lancamento-creators-2026-05&utm_term=stories&utm_content=story-cta-final"
        />
        <ExemploCard
          titulo="ManyChat respondendo comentário (automação)"
          descricao="Bots e fluxos automáticos no Instagram."
          url="https://turbopartners.com.br/creators?utm_source=instagram&utm_medium=organic&utm_campaign=automacoes&utm_term=dm&utm_content=manychat-quero-creators"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Nunca <code className="font-mono">ig</code> — Instagram orgânico é sempre <code className="font-mono">instagram</code>.</>,
          <>Linktree não é source: vai como <code className="font-mono">term=linktree</code>, e o source continua <code className="font-mono">instagram</code>.</>,
          <>DM do SDR é <code className="font-mono">social-selling</code> (organic), não outbound.</>,
        ]}
      />
    </div>
  );
}

// ── YOUTUBE ──
function GuiaYoutube() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="YouTube orgânico"
        times={["Conteúdo/Social"]}
        resumo="source = youtube. Conteúdo do canal da Turbo. Se você aparece como convidado em canal de terceiro, isso é referral/influencer (não organic)."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">organic</code></>,
          <><code className="font-mono">source</code> = <code className="font-mono">youtube</code></>,
          <><code className="font-mono">term</code> = onde o link está (tabela abaixo): <code className="font-mono">descricao-video</code>, <code className="font-mono">descricao-shorts</code>, <code className="font-mono">card</code>, <code className="font-mono">bio</code>, <code className="font-mono">banner</code></>,
          <><code className="font-mono">campaign</code>: <code className="font-mono">always-on</code> · <code className="font-mono">lancamento-&#123;slug&#125;-&#123;aaaa-mm&#125;</code> (lançamento)</>,
          <><code className="font-mono">content</code>: <strong>link fixo</strong> (bio/banner) → tipo de destino sem data (<code className="font-mono">lp-diagnostico</code>); <strong>post</strong> (descrição) → nome + data (<code className="font-mono">creators-ugc-2026-05-26</code>)</>,
          <>Clique em <strong>Copiar e salvar</strong>.</>,
        ]}
      />
      <Secao titulo="term — onde fica">
        <TermoTabela
          rows={[
            { term: "descricao-video", onde: "descrição abaixo do vídeo" },
            { term: "descricao-shorts", onde: "descrição de YouTube Shorts" },
            { term: "card", onde: "cards interativos no canto do vídeo" },
            { term: "bio", onde: "seção \"Sobre\" do canal" },
            { term: "banner", onde: "links clicáveis no cabeçalho/banner do canal" },
          ]}
        />
      </Secao>
      <Exemplos>
        <ExemploCard
          titulo="Link na descrição de vídeo"
          descricao="Caso mais comum — slug do vídeo + data."
          url="https://turbopartners.com.br/creators?utm_source=youtube&utm_medium=organic&utm_campaign=always-on&utm_term=descricao-video&utm_content=creators-ugc-2026-05-26"
        />
        <ExemploCard
          titulo="Link na descrição de Shorts"
          descricao="Vídeos curtos do YouTube Shorts."
          url="https://turbopartners.com.br/creators?utm_source=youtube&utm_medium=organic&utm_campaign=always-on&utm_term=descricao-shorts&utm_content=hook-rafa-2026-05-26"
        />
        <ExemploCard
          titulo="Banner do canal"
          descricao="Links fixos no cabeçalho do canal."
          url="https://turbopartners.com.br/diagnostico?utm_source=youtube&utm_medium=organic&utm_campaign=always-on&utm_term=banner&utm_content=lp-diagnostico"
        />
        <ExemploCard
          titulo="Card de lançamento dentro do vídeo"
          descricao="Card interativo apontando pra LP de lançamento."
          url="https://turbopartners.com.br/creators?utm_source=youtube&utm_medium=organic&utm_campaign=lancamento-creators-2026-05&utm_term=card&utm_content=cta-final-creators"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Convidado em canal de terceiro <strong>não é</strong> organic — é <code className="font-mono">referral/influencer</code>.</>,
          <>Banner e bio são link fixo → <code className="font-mono">content</code> sem data.</>,
        ]}
      />
    </div>
  );
}

// ── TIKTOK ──
function GuiaTiktok() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="TikTok orgânico"
        times={["Conteúdo/Social"]}
        resumo="source = tiktok. Conteúdo da conta oficial da Turbo no TikTok."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">organic</code></>,
          <><code className="font-mono">source</code> = <code className="font-mono">tiktok</code></>,
          <><code className="font-mono">term</code> = onde o link está: <code className="font-mono">bio</code>, <code className="font-mono">feed</code>, <code className="font-mono">dm</code>, <code className="font-mono">linktree</code></>,
          <><code className="font-mono">campaign</code>: <code className="font-mono">always-on</code> · <code className="font-mono">lancamento-&#123;slug&#125;-&#123;aaaa-mm&#125;</code> · <code className="font-mono">social-selling</code> (DM)</>,
          <><code className="font-mono">content</code>: link fixo (bio/linktree) → tipo de destino sem data; post (feed/dm) → nome + data</>,
          <>Clique em <strong>Copiar e salvar</strong>.</>,
        ]}
      />
      <Secao titulo="term — onde fica">
        <TermoTabela
          rows={[
            { term: "bio", onde: "link único na bio do perfil" },
            { term: "feed", onde: "vídeos no feed" },
            { term: "dm", onde: "mensagem direta (social-selling)" },
            { term: "linktree", onde: "passou pelo intermediário Linktree" },
          ]}
        />
      </Secao>
      <Exemplos>
        <ExemploCard
          titulo="Link na bio do TikTok"
          descricao="Único link clicável no perfil do TikTok."
          url="https://turbopartners.com.br/diagnostico?utm_source=tiktok&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=lp-diagnostico"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Linktree não é source: vai como <code className="font-mono">term=linktree</code>, source continua <code className="font-mono">tiktok</code>.</>,
        ]}
      />
    </div>
  );
}

// ── LINKEDIN ──
function GuiaLinkedin() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="LinkedIn orgânico"
        times={["Conteúdo/Social", "SDR — DM"]}
        resumo="source = linkedin. Vale igual para a página oficial da Turbo e para post no perfil pessoal de colaborador."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">organic</code></>,
          <><code className="font-mono">source</code> = <code className="font-mono">linkedin</code></>,
          <><code className="font-mono">term</code> = onde o link está: <code className="font-mono">bio</code> (Sobre), <code className="font-mono">feed</code> (post), <code className="font-mono">dm</code></>,
          <><code className="font-mono">campaign</code>: <code className="font-mono">always-on</code> · <code className="font-mono">social-selling</code> (DM do SDR) · <code className="font-mono">lancamento-&#123;slug&#125;-&#123;aaaa-mm&#125;</code></>,
          <><code className="font-mono">content</code>: link fixo (Sobre) → tipo de destino sem data; post (feed/dm) → nome + data</>,
          <>Clique em <strong>Copiar e salvar</strong>.</>,
        ]}
      />
      <Secao titulo="term — onde fica">
        <TermoTabela
          rows={[
            { term: "bio", onde: "seção \"Sobre\" do perfil/página" },
            { term: "feed", onde: "post no feed (página ou perfil pessoal)" },
            { term: "dm", onde: "mensagem direta (social-selling do SDR)" },
          ]}
        />
      </Secao>
      <Exemplos>
        <ExemploCard
          titulo="Post no feed da página"
          descricao="Conteúdo recorrente da página oficial."
          url="https://turbopartners.com.br/creators?utm_source=linkedin&utm_medium=organic&utm_campaign=always-on&utm_term=feed&utm_content=creators-2026-05-26"
        />
        <ExemploCard
          titulo="SDR via DM (social-selling)"
          descricao="Pré-vendas conversando ativamente nas DMs do LinkedIn da Turbo."
          url="https://turbopartners.com.br/diagnostico?utm_source=linkedin&utm_medium=organic&utm_campaign=social-selling&utm_term=dm&utm_content=camila-2026-05-26"
        />
        <ExemploCard
          titulo={`Link no "Sobre" da página`}
          descricao="Link fixo na seção de bio."
          url="https://turbopartners.com.br/diagnostico?utm_source=linkedin&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=lp-diagnostico"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>DM do SDR no LinkedIn oficial é <code className="font-mono">social-selling</code> (organic). DM fria via Sales Navigator é <code className="font-mono">outbound</code> — não confunda.</>,
        ]}
      />
    </div>
  );
}

// ── MÍDIA PAGA ──
function GuiaPaga() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="Mídia Paga (Meta, Google, YouTube Ads)"
        times={["Mídia/Tráfego"]}
        resumo="Você NÃO escreve UTM à mão. As plataformas substituem os tokens automaticamente no momento do clique. Configura-se uma vez por conta."
      />
      <Passos
        items={[
          <><strong>Meta Ads:</strong> cole os URL parameters no nível do anúncio (já configurados em <code className="font-mono">server/services/adsCreation/creator.ts</code>).</>,
          <><strong>Google Ads:</strong> cole o Tracking template <strong>a nível de conta</strong> e confirme que o <strong>Auto-tagging</strong> está ativado.</>,
          <>No Google, sempre teste no botão <strong>"Test"</strong> antes de salvar.</>,
          <>Não preencha <code className="font-mono">campaign</code>/<code className="font-mono">term</code>/<code className="font-mono">content</code> à mão — os tokens (<code className="font-mono">&#123;&#123;campaign.id&#125;&#125;</code>, <code className="font-mono">&#123;campaignid&#125;</code>) fazem isso sozinhos.</>,
        ]}
      />
      <Exemplos>
        <ExemploCard
          titulo="Meta Ads (Facebook + Instagram)"
          descricao="URL parameters no nível do anúncio. Tokens já configurados em server/services/adsCreation/creator.ts."
          url="utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}"
        />
        <ExemploCard
          titulo="Google Ads (Search, Display, YouTube)"
          descricao="Tracking template a nível de conta. YouTube Ads roda dentro do Google Ads — o token {network} retorna youtube automaticamente."
          url="{lpurl}?utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_term={adgroupid}-{network}-{device}-{matchtype}-{keyword}&utm_content={creative}"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Nunca <code className="font-mono">fb</code> ou <code className="font-mono">meta</code> — Meta Ads é sempre <code className="font-mono">facebook</code>.</>,
          <>Não montar UTM manual pra anúncio: deixe os tokens da plataforma preencherem.</>,
        ]}
      />
    </div>
  );
}

// ── EVENTOS ──
function GuiaEventos() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="Eventos"
        times={["Marketing/Eventos"]}
        resumo="source = slug do evento (lowercase, sem acento, hífen). Evento próprio da Turbo → prefixo turbo-. Evento de terceiro → nome direto."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">eventos</code></>,
          <><code className="font-mono">source</code> = slug do evento (ex: <code className="font-mono">rd-summit-2026</code>, <code className="font-mono">turbo-workshop-creators-sp</code>)</>,
          <><code className="font-mono">campaign</code> = tipo + ano (ex: <code className="font-mono">presencial-2026</code>, <code className="font-mono">workshop-online-2026-11</code>)</>,
          <><code className="font-mono">term</code> = mecanismo do clique: <code className="font-mono">palestra</code>, <code className="font-mono">estande</code>, <code className="font-mono">qrcode-cracha</code>, <code className="font-mono">material-impresso</code></>,
          <><code className="font-mono">content</code> = ação específica (ex: <code className="font-mono">slide-final-cta</code>, <code className="font-mono">mesa-recepcao</code>)</>,
          <>Clique em <strong>Copiar e salvar</strong> e gere o QR Code a partir do link.</>,
        ]}
      />
      <Exemplos>
        <ExemploCard
          titulo="QR code no slide final de palestra (RD Summit)"
          descricao="Evento de terceiro — nome direto."
          url="https://turbopartners.com.br/diagnostico?utm_source=rd-summit-2026&utm_medium=eventos&utm_campaign=presencial-2026&utm_term=palestra&utm_content=slide-final-cta"
        />
        <ExemploCard
          titulo="Workshop próprio da Turbo"
          descricao="Evento próprio — prefixo turbo-."
          url="https://turbopartners.com.br/diagnostico?utm_source=turbo-workshop-creators-sp&utm_medium=eventos&utm_campaign=presencial-2026&utm_term=qrcode-cracha&utm_content=mesa-recepcao"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Sem acento no slug do evento (<code className="font-mono">sao-paulo</code>, não <code className="font-mono">são-paulo</code>).</>,
          <>Evento próprio da Turbo leva prefixo <code className="font-mono">turbo-</code>.</>,
        ]}
      />
    </div>
  );
}

// ── CRM ──
function GuiaCrm() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="CRM (base própria — email, WhatsApp broadcast, SMS)"
        times={["CRM/Marketing"]}
        resumo="Comunicação ativa pra quem já é lead/cliente. source = canal de entrega (email/whatsapp/sms), NÃO a ferramenta de envio (RD, Mailchimp)."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">crm</code></>,
          <><code className="font-mono">source</code> = <code className="font-mono">email</code>, <code className="font-mono">whatsapp</code> ou <code className="font-mono">sms</code></>,
          <><code className="font-mono">campaign</code> = nome do fluxo/campanha (ex: <code className="font-mono">nutricao-creators-2026-11</code>, <code className="font-mono">turma-6-rafa-mais-proximo</code>)</>,
          <><code className="font-mono">term</code> = segmento da lista (ex: <code className="font-mono">lista-quentes</code>, <code className="font-mono">mql-nao-convertido</code>)</>,
          <><code className="font-mono">content</code> = touchpoint específico (ex: <code className="font-mono">touchpoint-12-audio-convite</code>)</>,
          <>Clique em <strong>Copiar e salvar</strong>.</>,
        ]}
      />
      <Exemplos>
        <ExemploCard
          titulo="Régua de WhatsApp da Turma 6 do Dr. Rafael"
          descricao="Toque específico (12 de 41) numa régua de quentes."
          url="https://turbopartners.com.br/agendar?utm_source=whatsapp&utm_medium=crm&utm_campaign=turma-6-rafa-mais-proximo&utm_term=lista-quentes&utm_content=touchpoint-12-audio-convite"
        />
        <ExemploCard
          titulo="E-mail de nutrição do funil Creators"
          descricao="Disparo de email para MQLs não convertidos."
          url="https://turbopartners.com.br/diagnostico?utm_source=email&utm_medium=crm&utm_campaign=nutricao-creators-2026-11&utm_term=mql-nao-convertido&utm_content=cta-agendar-diagnostico"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Ferramenta de envio (RD, Mailchimp) não entra no UTM — <code className="font-mono">source</code> é só o canal (<code className="font-mono">email</code>).</>,
          <>UTM em link <code className="font-mono">wa.me</code> <strong>não rastreia</strong>. Rastreie via página de redirect <code className="font-mono">/wpp</code>.</>,
        ]}
      />
    </div>
  );
}

// ── OUTBOUND ──
function GuiaOutbound() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="Outbound (prospecção fria — SDR)"
        times={["SDR/Pré-vendas"]}
        resumo="Lead que nunca interagiu antes. source = canal final de envio. Ligação não é canal de UTM — usa o canal que de fato enviou o link."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">outbound</code></>,
          <><code className="font-mono">source</code> = <code className="font-mono">email</code>, <code className="font-mono">linkedin</code> ou <code className="font-mono">whatsapp</code></>,
          <><code className="font-mono">campaign</code> = nome da cadência (ex: <code className="font-mono">cadencia-q4-donos-agencia</code>)</>,
          <><code className="font-mono">term</code> = perfil do lead (ex: <code className="font-mono">agencia-50-funcionarios</code>, <code className="font-mono">dono-clinica-odonto</code>)</>,
          <><code className="font-mono">content</code> = touchpoint/template (ex: <code className="font-mono">email-2-quebra-objecao</code>, <code className="font-mono">linkedin-msg-1</code>)</>,
          <>Clique em <strong>Copiar e salvar</strong>.</>,
        ]}
      />
      <Exemplos>
        <ExemploCard
          titulo="Cold email do SDR"
          descricao="Cadência de prospecção via Apollo/Reply/Lemlist."
          url="https://turbopartners.com.br/diagnostico?utm_source=email&utm_medium=outbound&utm_campaign=cadencia-q4-donos-agencia&utm_term=agencia-50-funcionarios&utm_content=email-2-quebra-objecao"
        />
        <ExemploCard
          titulo="Cold outreach LinkedIn"
          descricao="DM fria via Sales Navigator (não confunde com DM social-selling em organic)."
          url="https://turbopartners.com.br/diagnostico?utm_source=linkedin&utm_medium=outbound&utm_campaign=cadencia-q4-donos-agencia&utm_term=agencia-50-funcionarios&utm_content=linkedin-msg-1"
        />
        <ExemploCard
          titulo="Follow-up de cold call (WhatsApp pós-ligação)"
          descricao="Ligação não é canal de UTM — usa o canal real de envio (whatsapp/email)."
          url="https://turbopartners.com.br/diagnostico?utm_source=whatsapp&utm_medium=outbound&utm_campaign=cadencia-q4-donos-agencia&utm_term=pos-ligacao&utm_content=follow-up-call-2026-05-26"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>DM fria do LinkedIn é <code className="font-mono">outbound</code>, não <code className="font-mono">social-selling</code>.</>,
          <>Cold call não tem source próprio: usa o canal que enviou o link, com <code className="font-mono">term=pos-ligacao</code>.</>,
        ]}
      />
    </div>
  );
}

// ── REFERRAL ──
function GuiaReferral() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="Referral (cliente, colaborador, influencer, marketplace)"
        times={["Parcerias/Growth"]}
        resumo="Alguém externo trazendo lead. source = tipo de relação; campaign = nome da entidade (cliente, pessoa, influencer)."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">referral</code></>,
          <><code className="font-mono">source</code> = tipo de relação: <code className="font-mono">cliente</code>, <code className="font-mono">colaborador</code>, <code className="font-mono">influencer</code>, <code className="font-mono">afiliado</code>, <code className="font-mono">marketplace</code></>,
          <><code className="font-mono">campaign</code> = nome da entidade em slug (ex: <code className="font-mono">dr-rafael</code>, <code className="font-mono">lucas</code>, <code className="font-mono">joao-silva</code>)</>,
          <><code className="font-mono">term</code> = mecanismo (ex: <code className="font-mono">footer</code>, <code className="font-mono">indicacao</code>, <code className="font-mono">prova-social</code>, <code className="font-mono">bio-influencer</code>)</>,
          <><code className="font-mono">content</code> = local específico do link (ex: <code className="font-mono">rodape-home</code>, <code className="font-mono">stories-link-bio</code>)</>,
          <>Clique em <strong>Copiar e salvar</strong>.</>,
        ]}
      />
      <Exemplos>
        <ExemploCard
          titulo="Footer da clínica do Dr. Rafael (cliente)"
          descricao="Cliente colocando link da Turbo no footer do site dele."
          url="https://turbopartners.com.br/?utm_source=cliente&utm_medium=referral&utm_campaign=dr-rafael&utm_term=footer&utm_content=rodape-home"
        />
        <ExemploCard
          titulo="Colaborador (informal) indicando via WhatsApp pessoal"
          descricao="Não confunde com social-selling (que é iniciativa coordenada nas DMs oficiais)."
          url="https://turbopartners.com.br/?utm_source=colaborador&utm_medium=referral&utm_campaign=lucas&utm_term=indicacao&utm_content=whatsapp-amigo-loja-x"
        />
        <ExemploCard
          titulo="Influencer postando link"
          descricao="Criador externo divulgando Turbo no conteúdo dele."
          url="https://turbopartners.com.br/?utm_source=influencer&utm_medium=referral&utm_campaign=joao-silva&utm_term=bio-influencer&utm_content=stories-link-bio"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Nome de cliente/colaborador/influencer <strong>nunca em source</strong> — vai em <code className="font-mono">campaign</code>.</>,
          <>Colaborador informal (WhatsApp pessoal) ≠ <code className="font-mono">social-selling</code> (que é iniciativa coordenada de SDR nas DMs oficiais).</>,
        ]}
      />
    </div>
  );
}

// ── CANAIS PRÓPRIOS (victor / andre / rodrigo) ──
function GuiaProprios() {
  return (
    <div className="space-y-6">
      <CanalHeader
        titulo="Canais próprios: victor, andre, rodrigo"
        times={["Growth / a figura"]}
        resumo="Exceções: figuras-chave com canal próprio robusto (YouTube, Instagram, LinkedIn, TikTok). O medium é o nome da figura — não organic. O naming é idêntico ao organic."
      />
      <Passos
        items={[
          <><code className="font-mono">medium</code> = <code className="font-mono">victor</code>, <code className="font-mono">andre</code> ou <code className="font-mono">rodrigo</code></>,
          <><code className="font-mono">source</code> = a plataforma da figura (<code className="font-mono">youtube</code>, <code className="font-mono">instagram</code>, <code className="font-mono">linkedin</code>, <code className="font-mono">tiktok</code>)</>,
          <><code className="font-mono">campaign</code> = <code className="font-mono">always-on</code> (default) · <code className="font-mono">lancamento-&#123;slug&#125;-&#123;aaaa-mm&#125;</code> (parceria pontual)</>,
          <><code className="font-mono">term</code> = mesmo vocabulário do organic por plataforma (<code className="font-mono">bio</code>, <code className="font-mono">descricao-video</code>, <code className="font-mono">feed</code>, <code className="font-mono">linktree</code>…)</>,
          <><code className="font-mono">content</code>: link fixo → tipo de destino sem data; post → nome + data</>,
          <>Clique em <strong>Copiar e salvar</strong>.</>,
        ]}
      />
      <Exemplos>
        <ExemploCard
          titulo="Victor — bio do canal no YouTube apontando pra Turbo"
          descricao="Link fixo — content = tipo de destino, sem data."
          url="https://turbopartners.com.br/?utm_source=youtube&utm_medium=victor&utm_campaign=always-on&utm_term=bio&utm_content=site-home"
        />
        <ExemploCard
          titulo="André — descrição de vídeo no canal dele"
          descricao="Post — nome + data."
          url="https://turbopartners.com.br/creators?utm_source=youtube&utm_medium=andre&utm_campaign=always-on&utm_term=descricao-video&utm_content=video-creators-2026-05-28"
        />
        <ExemploCard
          titulo="Rodrigo — link da Turbo na Linktree do Instagram dele"
          descricao="Linktree continua sendo term, não source. medium = a figura."
          url="https://turbopartners.com.br/?utm_source=instagram&utm_medium=rodrigo&utm_campaign=always-on&utm_term=linktree&utm_content=site-home"
        />
      </Exemplos>
      <ProibicoesCanal
        items={[
          <>Conteúdo do canal/página <strong>da Turbo</strong> que só cita a figura → <code className="font-mono">organic</code>.</>,
          <>Anúncio pago com a figura no criativo → <code className="font-mono">paid</code> (a figura vai no <code className="font-mono">content</code> do ad, não no medium).</>,
        ]}
      />
    </div>
  );
}
