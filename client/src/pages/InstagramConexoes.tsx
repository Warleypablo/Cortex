import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Instagram,
  RefreshCw,
  Unlink,
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";

interface InstagramConnection {
  id: number;
  clienteCnpj: string;
  clienteNome?: string;
  igUserId: string;
  igUsername: string;
  tokenExpiresAt: string;
  lastSyncAt: string | null;
  createdAt: string;
}

interface ClienteLista {
  cnpj: string;
  nome: string;
}

function getTokenStatus(expiresAt: string): { label: string; variant: "default" | "secondary" | "destructive"; icon: React.ReactNode } {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { label: "Expirado", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> };
  }
  if (diffDays <= 7) {
    return { label: `Expira em ${diffDays}d`, variant: "secondary", icon: <Clock className="h-3 w-3" /> };
  }
  return { label: "Válido", variant: "default", icon: <CheckCircle className="h-3 w-3" /> };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InstagramConexoes() {
  usePageTitle("Instagram");
  const { setPageInfo } = usePageInfo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedCnpj, setSelectedCnpj] = useState<string>("");
  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  useEffect(() => {
    setPageInfo("Instagram", "Gerenciamento de conexões Instagram");
  }, [setPageInfo]);

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const success = params.get("success");
    const username = params.get("username");
    const error = params.get("error");

    if (success === "true" && username) {
      toast({
        title: "Conexão realizada!",
        description: `@${username} conectado com sucesso.`,
      });
      // Clean URL params
      setLocation("/growth/instagram", { replace: true });
    } else if (error) {
      toast({
        title: "Erro na conexão",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      setLocation("/growth/instagram", { replace: true });
    }
  }, [search, toast, setLocation]);

  // Fetch connections
  const { data: connections = [], isLoading } = useQuery<InstagramConnection[]>({
    queryKey: ["/api/instagram/connections"],
    queryFn: async () => {
      const res = await fetch("/api/instagram/connections");
      if (!res.ok) throw new Error("Erro ao carregar conexões");
      return res.json();
    },
  });

  // Fetch client list for new connection dialog
  const { data: clientes = [] } = useQuery<ClienteLista[]>({
    queryKey: ["/api/clientes/lista"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/clientes/lista");
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: newDialogOpen,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const res = await fetch(`/api/instagram/connections/${connectionId}/sync`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao sincronizar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/connections"] });
      toast({ title: "Sincronizado!", description: "Dados atualizados com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      setSyncingId(null);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const res = await fetch(`/api/instagram/connections/${connectionId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao desconectar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/connections"] });
      toast({ title: "Desconectado", description: "Conexão removida com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      setDisconnectId(null);
    },
  });

  function handleSync(id: number) {
    setSyncingId(id);
    syncMutation.mutate(id);
  }

  function handleNewConnection() {
    if (!selectedCnpj) return;
    // Redirect to Instagram OAuth flow
    window.location.href = `/auth/instagram?clienteCnpj=${encodeURIComponent(selectedCnpj)}`;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
            <Instagram className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instagram</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Gerencie as conexões Instagram dos clientes
            </p>
          </div>
        </div>

        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Nova Conexão Instagram</DialogTitle>
              <DialogDescription className="text-gray-500 dark:text-zinc-400">
                Selecione o cliente para conectar uma conta Instagram.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedCnpj} onValueChange={setSelectedCnpj}>
                <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  {clientes.map((c) => (
                    <SelectItem key={c.cnpj} value={c.cnpj} className="text-gray-900 dark:text-white">
                      {c.nome}
                    </SelectItem>
                  ))}
                  {clientes.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-zinc-400">
                      Nenhum cliente disponível
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewDialogOpen(false)} className="border-gray-200 dark:border-zinc-700">
                Cancelar
              </Button>
              <Button onClick={handleNewConnection} disabled={!selectedCnpj} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Conectar com Instagram
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-zinc-500" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && connections.length === 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-400/10 mb-4">
              <Instagram className="h-12 w-12 text-pink-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhuma conexão ainda
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mb-6">
              Conecte contas Instagram dos seus clientes para acompanhar métricas de engajamento, crescimento de seguidores e performance de conteúdo.
            </p>
            <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Conexão
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connection cards */}
      {!isLoading && connections.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => {
            const tokenStatus = getTokenStatus(conn.tokenExpiresAt);
            const isSyncing = syncingId === conn.id;

            return (
              <Card
                key={conn.id}
                className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
                        {conn.igUsername.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          @{conn.igUsername}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                          {conn.clienteNome || conn.clienteCnpj}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={tokenStatus.variant}
                      className="gap-1 text-xs"
                    >
                      {tokenStatus.icon}
                      {tokenStatus.label}
                    </Badge>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
                    <span>Última sync: {formatDate(conn.lastSyncAt)}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
                      onClick={() => handleSync(conn.id)}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Sincronizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => setDisconnectId(conn.id)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Desconectar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={disconnectId !== null} onOpenChange={(open) => !open && setDisconnectId(null)}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">
              Desconectar conta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-zinc-400">
              Essa ação removerá a conexão Instagram e todos os dados sincronizados deste cliente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 dark:border-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => disconnectId && disconnectMutation.mutate(disconnectId)}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
