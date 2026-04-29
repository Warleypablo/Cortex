import { useState, type KeyboardEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ComentarioItem, type Comentario } from './ComentarioItem';

interface ComentariosThreadProps {
  videoId: string;
  comentarios: Comentario[];
}

const MAX_LEN = 5000;

export function ComentariosThread({ videoId, comentarios }: ComentariosThreadProps) {
  const [conteudo, setConteudo] = useState('');
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (texto: string) => {
      const res = await apiRequest('POST', `/api/treinamentos-internos/videos/${videoId}/comentarios`, { conteudo: texto });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos'] });
      setConteudo('');
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao comentar', description: err.message, variant: 'destructive' });
    },
  });

  const submit = () => {
    const texto = conteudo.trim();
    if (!texto) return;
    if (texto.length > MAX_LEN) {
      toast({ title: `Limite de ${MAX_LEN} caracteres ultrapassado`, variant: 'destructive' });
      return;
    }
    createMutation.mutate(texto);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const restantes = MAX_LEN - conteudo.length;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">
        {comentarios.length === 0 ? 'Sem comentários ainda' : `${comentarios.length} comentário${comentarios.length === 1 ? '' : 's'}`}
      </h3>

      <div className="space-y-2">
        <Textarea
          placeholder="Escreva um comentário..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          maxLength={MAX_LEN}
          data-testid="textarea-comentario"
        />
        <div className="flex justify-between items-center">
          {conteudo.length > 4500 ? (
            <span className={`text-xs ${restantes < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {restantes} caracteres restantes
            </span>
          ) : <span />}
          <Button
            onClick={submit}
            disabled={!conteudo.trim() || createMutation.isPending}
            size="sm"
            data-testid="button-enviar-comentario"
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Comentar</>
            )}
          </Button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-zinc-700">
        {comentarios.map((c) => (
          <ComentarioItem key={c.id} comentario={c} videoId={videoId} />
        ))}
      </div>
    </div>
  );
}
