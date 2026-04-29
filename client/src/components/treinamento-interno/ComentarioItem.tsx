import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface Comentario {
  id: string;
  userEmail: string;
  userNome: string;
  conteudo: string;
  createdAt: string;
  isOwner: boolean;
}

interface ComentarioItemProps {
  comentario: Comentario;
  videoId: string;
}

// Linkifica URLs http(s) simples mantendo o resto como texto.
function renderConteudo(text: string) {
  const parts = text.split(/(\bhttps?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export function ComentarioItem({ comentario, videoId }: ComentarioItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/treinamentos-internos/comentarios/${comentario.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos', videoId] });
      setConfirmOpen(false);
      toast({ title: 'Comentário excluído' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    },
  });

  const inicial = (comentario.userNome || 'U').charAt(0).toUpperCase();
  const tempo = formatDistanceToNow(new Date(comentario.createdAt), { addSuffix: true, locale: ptBR });

  return (
    <div className="flex gap-3 py-3" data-testid={`comentario-${comentario.id}`}>
      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium shrink-0">
        {inicial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-medium">{comentario.userNome}</span>
            <span className="text-muted-foreground ml-2">{tempo}</span>
          </div>
          {comentario.isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              data-testid={`button-delete-comentario-${comentario.id}`}
              aria-label="Excluir comentário"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="text-sm mt-1 whitespace-pre-wrap break-words">
          {renderConteudo(comentario.conteudo)}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-comentario"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>
              ) : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
