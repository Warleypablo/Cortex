import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, RefreshCw, GraduationCap, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { TrilhaCard, type TrilhaSummary } from './TrilhaCard';

interface SyncReport {
  ok: boolean;
  trilhasAtivas: number;
  videosAtivos: number;
  trilhasDesativadas: number;
  videosDesativados: number;
  erros: Array<{ contexto: string; mensagem: string }>;
  alreadyRunning?: boolean;
}

export function TreinamentoInternoTab() {
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const { data: trilhas = [], isLoading } = useQuery<TrilhaSummary[]>({
    queryKey: ['/api/treinamentos-internos/trilhas'],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/treinamentos-internos/sync');
      return (await res.json()) as SyncReport;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/trilhas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos'] });
      if (report.alreadyRunning) {
        toast({ title: 'Sincronização já em andamento' });
      } else if (!report.ok) {
        toast({
          title: 'Falha na sincronização',
          description: report.erros[0]?.mensagem || 'Erro desconhecido',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sincronizado!',
          description: `${report.trilhasAtivas} trilhas, ${report.videosAtivos} vídeos`
            + (report.erros.length > 0 ? ` (${report.erros.length} erros parciais)` : ''),
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-trilhas">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vídeo..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            data-testid="input-buscar-treinamento"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-treinamentos"
        >
          {syncMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sincronizando...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" />Sincronizar agora</>
          )}
        </Button>
      </div>

      {trilhas.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-trilhas">
          <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Nenhuma trilha sincronizada ainda</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Sincronizar agora" para puxar os vídeos do Drive.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trilhas.map((t) => (
            <TrilhaCard key={t.id} trilha={t} filtroBusca={busca} />
          ))}
        </div>
      )}
    </div>
  );
}
