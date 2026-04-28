import { useState, useMemo } from 'react';
import { Send, Copy, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  renderizarNotificacao,
  renderizarNotificacaoHtml,
  type ClienteParaNotificacao,
  type ParcelaParaNotificacao,
  type FormularioNotificacao,
} from '@/lib/notificacao-extrajudicial';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ConfirmacaoEnvioDialog } from './ConfirmacaoEnvioDialog';

interface NotificacaoExtrajudicialModalProps {
  open: boolean;
  onClose: () => void;
  cliente: ClienteParaNotificacao & {
    idCliente: string;
    email: string | null;
    endereco: string | null;
    servicos: string | null;
    telefone: string | null;
  };
  parcelas: ParcelaParaNotificacao[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificacaoExtrajudicialModal({
  open,
  onClose,
  cliente,
  parcelas,
}: NotificacaoExtrajudicialModalProps) {
  const { toast } = useToast();

  const [form, setForm] = useState<FormularioNotificacao>({
    email: cliente.email ?? '',
    endereco: cliente.endereco ?? '',
    numeroContrato: '',
    dataContrato: '',
    nomeServico: cliente.servicos ?? '',
  });

  const [previewEditado, setPreviewEditado] = useState<string | null>(null);
  const [manualEdit, setManualEdit] = useState(false);

  const { data: historicoEnvios } = useQuery<
    { id: number; emailDestino: string; enviadoPor: string; enviadoEm: string; status: string }[]
  >({
    queryKey: ['/api/negativacao/cliente', cliente.idCliente, 'notificacoes-enviadas'],
    queryFn: async () => {
      const r = await fetch(
        `/api/negativacao/cliente/${cliente.idCliente}/notificacoes-enviadas`,
        { credentials: 'include' },
      );
      if (!r.ok) throw new Error('Failed to fetch history');
      return r.json();
    },
    enabled: open,
  });

  const ultimoEnvio = historicoEnvios?.[0]
    ? { enviadoEm: historicoEnvios[0].enviadoEm, enviadoPor: historicoEnvios[0].enviadoPor }
    : null;

  const [confirmacaoOpen, setConfirmacaoOpen] = useState(false);

  const previewGerado = useMemo(
    () => renderizarNotificacao({ cliente, parcelas, form }),
    [cliente, parcelas, form],
  );

  const preview = manualEdit && previewEditado !== null ? previewEditado : previewGerado;

  const emailValido = EMAIL_REGEX.test(form.email.trim());
  const emailAusenteNoBanco = !cliente.email;

  const handleFormChange = (campo: keyof FormularioNotificacao, valor: string) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const handlePreviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPreviewEditado(e.target.value);
    setManualEdit(true);
  };

  const handleRestaurar = () => {
    setManualEdit(false);
    setPreviewEditado(null);
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      toast({ title: 'Texto copiado!', description: 'Notificação copiada para a área de transferência.' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const enviarMutation = useMutation({
    mutationFn: async () => {
      const corpoHtml = renderizarNotificacaoHtml(preview);
      const r = await fetch('/api/negativacao/notificacoes/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clienteId: cliente.idCliente,
          clienteNome: cliente.nomeCliente,
          emailDestino: form.email.trim(),
          assunto: 'Notificação Extrajudicial de Cobrança - TURBO PARTNERS',
          corpoTexto: preview,
          corpoHtml,
          telefone: cliente.telefone,
        }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}: ${text || r.statusText}`);
      }
      return r.json();
    },
    onSuccess: (result) => {
      const wpp = result?.whatsapp as
        | { status: 'enviado' | 'sem_telefone' | 'erro'; detalhe?: string }
        | undefined;

      let descricaoWpp = '';
      if (wpp?.status === 'enviado') {
        descricaoWpp = ' WhatsApp de aviso também enviado.';
      } else if (wpp?.status === 'sem_telefone') {
        descricaoWpp = ' WhatsApp não enviado: cliente sem telefone cadastrado.';
      } else if (wpp?.status === 'erro') {
        descricaoWpp = ` WhatsApp falhou: ${wpp.detalhe ?? 'erro desconhecido'}.`;
      }

      toast({
        title: 'Notificação enviada',
        description: `ID: ${result.sendgridMessageId ?? result.id}.${descricaoWpp}`,
        variant: wpp?.status === 'erro' ? 'destructive' : 'default',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/negativacao/cliente', cliente.idCliente, 'notificacoes-enviadas'],
      });
      setConfirmacaoOpen(false);
      onClose();
    },
    onError: (err: Error) => {
      toast({
        title: 'Falha no envio',
        description: err.message,
        variant: 'destructive',
      });
      setConfirmacaoOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notificação Extrajudicial de Cobrança</DialogTitle>
          <DialogDescription>
            {cliente.nomeCliente || cliente.empresa}
          </DialogDescription>
        </DialogHeader>

        {emailAusenteNoBanco && (
          <div
            className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3 text-sm text-yellow-800 dark:text-yellow-200"
            data-testid="alert-email-ausente"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Email não cadastrado em <code>caz_clientes</code>. Preencha manualmente abaixo para continuar.
            </span>
          </div>
        )}

        <div className="space-y-6">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do Notificado
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="notif-email">Email do notificado</Label>
                <Input
                  id="notif-email"
                  type="email"
                  value={form.email}
                  onChange={e => handleFormChange('email', e.target.value)}
                  placeholder="contato@empresa.com"
                  data-testid="input-email-notificado"
                />
              </div>
              <div>
                <Label htmlFor="notif-endereco">Endereço completo</Label>
                <Input
                  id="notif-endereco"
                  value={form.endereco}
                  onChange={e => handleFormChange('endereco', e.target.value)}
                  placeholder="Rua X, 123, Cidade/UF, CEP 00000-000"
                  data-testid="input-endereco-notificado"
                />
              </div>
              <div>
                <Label htmlFor="notif-contrato">Nº do contrato</Label>
                <Input
                  id="notif-contrato"
                  value={form.numeroContrato}
                  onChange={e => handleFormChange('numeroContrato', e.target.value)}
                  placeholder="000.33333.22"
                  data-testid="input-numero-contrato"
                />
              </div>
              <div>
                <Label htmlFor="notif-data-contrato">Data de assinatura do contrato</Label>
                <Input
                  id="notif-data-contrato"
                  type="date"
                  value={form.dataContrato}
                  onChange={e => handleFormChange('dataContrato', e.target.value)}
                  data-testid="input-data-contrato"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do Contrato
            </h4>
            <div>
              <Label htmlFor="notif-servico">Nome do serviço contratado</Label>
              <Input
                id="notif-servico"
                value={form.nomeServico}
                onChange={e => handleFormChange('nomeServico', e.target.value)}
                placeholder="Consultoria financeira"
                data-testid="input-nome-servico"
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Preview da Notificação
              </h4>
              {manualEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestaurar}
                  data-testid="button-restaurar-preview"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restaurar do formulário
                </Button>
              )}
            </div>
            <Textarea
              value={preview}
              onChange={handlePreviewChange}
              className="font-mono text-xs min-h-[500px]"
              data-testid="textarea-preview-notificacao"
            />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} data-testid="button-fechar-notificacao">
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={handleCopiar}
            data-testid="button-copiar-notificacao"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar texto
          </Button>
          <Button
            onClick={() => setConfirmacaoOpen(true)}
            disabled={!emailValido}
            data-testid="button-enviar-notificacao"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar agora
          </Button>
        </DialogFooter>
        <ConfirmacaoEnvioDialog
          open={confirmacaoOpen}
          onOpenChange={setConfirmacaoOpen}
          onConfirm={() => enviarMutation.mutate()}
          emailDestino={form.email.trim()}
          clienteNome={cliente.nomeCliente || cliente.empresa || ''}
          ultimoEnvio={ultimoEnvio}
          isSending={enviarMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
