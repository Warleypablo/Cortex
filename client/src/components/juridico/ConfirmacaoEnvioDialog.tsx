import { AlertTriangle, Loader2, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UltimoEnvio {
  enviadoEm: string;
  enviadoPor: string;
}

interface ConfirmacaoEnvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  emailDestino: string;
  clienteNome: string;
  ultimoEnvio?: UltimoEnvio | null;
  isSending: boolean;
}

export function ConfirmacaoEnvioDialog({
  open,
  onOpenChange,
  onConfirm,
  emailDestino,
  clienteNome,
  ultimoEnvio,
  isSending,
}: ConfirmacaoEnvioDialogProps) {
  const formatarData = (iso: string) => {
    try {
      return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return iso;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar envio da notificação?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">Para:</span> {emailDestino}
              </div>
              <div>
                <span className="font-semibold">Cliente:</span> {clienteNome}
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold">De:</span> Departamento Jurídico - Turbo Partners &lt;juridico@turbopartners.com.br&gt;
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold">BCC:</span> juridico@turbopartners.com.br
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {ultimoEnvio && (
          <div
            className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3 text-sm text-yellow-800 dark:text-yellow-200"
            data-testid="alert-duplicata-envio"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Este cliente já foi notificado em{' '}
              <strong>{formatarData(ultimoEnvio.enviadoEm)}</strong> por{' '}
              <strong>{ultimoEnvio.enviadoPor}</strong>. Enviar mesmo assim?
            </span>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending} data-testid="button-cancelar-envio">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSending}
            className={ultimoEnvio ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            data-testid="button-confirmar-envio"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
