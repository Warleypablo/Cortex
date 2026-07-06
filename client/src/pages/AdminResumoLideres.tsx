import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Send, CheckCircle2, XCircle, Clock, RefreshCw, MessageSquare, ChevronDown } from "lucide-react";

interface StatusResp { ativo: boolean; destino: string | null; janelas: string[]; timezone: string }
interface PreviewResp { mensagem: string }
interface Envio {
  id: number; data_ref: string; janela: string | null; destino: string | null;
  mensagem: string | null; status: string; erro: string | null; criado_em: string;
}

const fmtDataHora = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const JANELA_LABEL: Record<string, string> = { "10h": "Manhã · 10h", "19h": "Noite · 19h", manual: "Manual" };

function mascararNumero(n: string | null): string {
  if (!n) return "—";
  if (n.includes("@g.us")) return "Grupo WhatsApp";
  return n.length > 6 ? `${n.slice(0, 4)}…${n.slice(-4)}` : n;
}

export default function AdminResumoLideres() {
  usePageTitle("Resumo dos Líderes");
  const { toast } = useToast();
  const [expandido, setExpandido] = useState<number | null>(null);

  const status = useQuery<StatusResp>({ queryKey: ["/api/resumo-lideres/status"] });
  const preview = useQuery<PreviewResp>({ queryKey: ["/api/resumo-lideres/preview"] });
  const historico = useQuery<{ envios: Envio[] }>({ queryKey: ["/api/resumo-lideres/historico"] });

  const enviar = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/resumo-lideres/enviar", { force: true });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Resumo enviado", description: "A mensagem foi disparada para o WhatsApp." });
      queryClient.invalidateQueries({ queryKey: ["/api/resumo-lideres/historico"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao enviar", description: e?.message || "Erro ao enviar o resumo.", variant: "destructive" });
    },
  });

  const envios = historico.data?.envios ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-500">
            <MessageSquare className="h-3.5 w-3.5" /> Comunicação · Líderes
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Resumo dos Líderes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Resumo diário de métricas enviado por WhatsApp. Dispare manualmente e acompanhe o histórico.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600 text-white" disabled={enviar.isPending || preview.isLoading}>
              <Send className="h-4 w-4" /> {enviar.isPending ? "Enviando…" : "Enviar agora"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Enviar resumo agora?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso dispara a mensagem por WhatsApp para <strong>{mascararNumero(status.data?.destino ?? null)}</strong> imediatamente.
                É um envio real e não pode ser desfeito.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-orange-500 hover:bg-orange-600" onClick={() => enviar.mutate()}>
                Enviar agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Status do automático */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-zinc-500">Automático</span>
            {status.isLoading ? <Skeleton className="h-5 w-16" /> : status.data?.ativo ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100">
                <CheckCircle2 className="h-3 w-3" /> Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-gray-500 dark:text-zinc-400">
                <XCircle className="h-3 w-3" /> Inativo
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-zinc-300">Janelas 10h e 19h · America/Sao_Paulo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-zinc-500">Destino</span>
            <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-zinc-200">{mascararNumero(status.data?.destino ?? null)}</span>
          </div>
        </CardContent>
        {status.data && !status.data.ativo && (
          <div className="border-t border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-6 py-3 text-xs text-amber-700 dark:text-amber-300">
            O envio automático está desligado. Para ativar, defina <code className="font-mono">RESUMO_LIDERES_ATIVO=true</code> no ambiente (Render). O envio manual acima funciona independentemente.
          </div>
        )}
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prévia da mensagem</CardTitle>
          <CardDescription>Exatamente o que será enviado agora (métricas ao vivo).</CardDescription>
        </CardHeader>
        <CardContent>
          {preview.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : preview.isError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">Falha ao gerar a prévia.</p>
          ) : (
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-[#e7ffdb] dark:bg-emerald-950/20 p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-gray-800 dark:text-zinc-100">
                {preview.data?.mensagem}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Histórico de envios</CardTitle>
            <CardDescription>Últimos disparos (automáticos e manuais).</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5"
            onClick={() => historico.refetch()} disabled={historico.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${historico.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {historico.isLoading ? (
            <div className="p-6 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : envios.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500 dark:text-zinc-500">Nenhum envio registrado ainda.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {envios.map((e) => {
                const ok = e.status === "ok";
                const aberto = expandido === e.id;
                return (
                  <div key={e.id}>
                    <button
                      className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors"
                      onClick={() => setExpandido(aberto ? null : e.id)}
                    >
                      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
                      <span className="text-sm tabular-nums text-gray-700 dark:text-zinc-200 w-32 shrink-0">{fmtDataHora(e.criado_em)}</span>
                      <Badge variant="outline" className="shrink-0 text-[11px]">{JANELA_LABEL[e.janela ?? ""] ?? e.janela ?? "—"}</Badge>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 truncate flex-1">{mascararNumero(e.destino)}</span>
                      {!ok && <span className="text-xs text-rose-500 shrink-0 max-w-[40%] truncate">{e.erro}</span>}
                      <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
                    </button>
                    {aberto && (
                      <div className="bg-gray-50 dark:bg-zinc-900/60 px-6 py-3">
                        {e.erro && <p className="mb-2 text-xs text-rose-600 dark:text-rose-400"><strong>Erro:</strong> {e.erro}</p>}
                        {e.mensagem ? (
                          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-gray-700 dark:text-zinc-300">{e.mensagem}</pre>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-zinc-500">Sem conteúdo registrado (falha antes de montar a mensagem).</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
