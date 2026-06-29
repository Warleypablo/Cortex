import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link2, Copy, ArrowLeft, Loader2, MousePointerClick } from "lucide-react";

// ============================================================================
// Página de gestão dos links curtos (Fase 4 do encurtador).
// Lista o que foi criado pelo UTM Builder + contagem de cliques (GET /api/links).
// ============================================================================

interface ShortLinkRow {
  id: string;
  slug: string;
  targetUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdByName: string | null;
  clickCount: number;
}

const SHORT_BASE = "marketing.turbopartners.com.br";

export default function LinkShortener() {
  const { toast } = useToast();
  const { data: links, isLoading } = useQuery<ShortLinkRow[]>({
    queryKey: ["/api/links"],
  });

  const copy = (text: string, label = "Link copiado!") => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" /> Links curtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Links criados pelo UTM Builder, servidos por <span className="font-mono">{SHORT_BASE}</span>, com contagem de cliques.
          </p>
        </div>
        <Link href="/utm-builder">
          <Button variant="outline" data-testid="link-back-utm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Criar novo link
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando…
            </div>
          ) : !links || links.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Link2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum link curto ainda.</p>
              <Link href="/utm-builder">
                <Button variant="link" className="mt-1">Criar o primeiro no UTM Builder →</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Link curto</TableHead>
                  <TableHead>Campanha (UTM)</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={l.id} data-testid={`row-link-${l.slug}`}>
                    <TableCell>
                      <div className="font-mono text-sm flex items-center gap-1.5">
                        <span className="text-muted-foreground">{SHORT_BASE}/</span>
                        <span className="font-semibold">{l.slug}</span>
                        {!l.isActive && <Badge variant="outline" className="ml-1">inativo</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[360px]" title={l.targetUrl}>
                        → {l.targetUrl}
                      </div>
                    </TableCell>
                    <TableCell>
                      {l.utmCampaign ? (
                        <div className="text-sm">
                          <div className="font-medium">{l.utmCampaign}</div>
                          <div className="text-xs text-muted-foreground">
                            {[l.utmSource, l.utmMedium].filter(Boolean).join(" / ") || "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                        <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground" />
                        {l.clickCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.createdByName || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(l.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copy(`https://${SHORT_BASE}/${l.slug}`)}
                        data-testid={`copy-${l.slug}`}
                        title="Copiar link curto"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
