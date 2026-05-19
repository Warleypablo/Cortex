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
import { Copy, Check, AlertTriangle, Link2, History, Settings, Loader2, Plus, ShieldAlert, Sparkles } from "lucide-react";
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
  useSetPageInfo("Gerador de UTMs", "Constituição UTM Turbo v1");

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
