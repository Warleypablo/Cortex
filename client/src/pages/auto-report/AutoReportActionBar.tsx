import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Play,
  Presentation,
  FileText,
  Clipboard,
  X,
} from 'lucide-react';
import type { OutputFormat, AutoReportJob } from './types';

interface AutoReportActionBarProps {
  selectedCount: number;
  onSelectPendentes: () => void;
  onClearSelection: () => void;
  onGerar: () => void;
  isGenerating: boolean;
  batchTotal: number;
  batchCompleted: number;
  batchErrors: number;
  batchDone: boolean;
  onVerDetalhes: () => void;
  onDismiss: () => void;
  outputFormat: OutputFormat;
  jobs: AutoReportJob[];
  batchClientNames: string[];
}

export default function AutoReportActionBar({
  selectedCount,
  onSelectPendentes,
  onClearSelection,
  onGerar,
  isGenerating,
  batchTotal,
  batchCompleted,
  batchErrors,
  batchDone,
  onVerDetalhes,
  onDismiss,
  outputFormat,
  jobs,
  batchClientNames,
}: AutoReportActionBarProps) {
  const { toast } = useToast();
  const isVisible = selectedCount > 0 || isGenerating || batchDone;

  const progressPercent =
    batchTotal > 0 ? Math.round(((batchCompleted + batchErrors) / batchTotal) * 100) : 0;

  const remaining = batchTotal - batchCompleted - batchErrors;

  const completedJobs = jobs.filter(
    (j) =>
      batchClientNames.includes(j.clienteNome) &&
      j.status === 'concluido' &&
      j.presentationUrl,
  );

  const completedWithUrlCount = completedJobs.length;

  const handleCopyAllLinks = async () => {
    if (completedJobs.length === 0) {
      toast({
        title: 'Nenhum link disponível',
        description: 'Os links aparecem após a conclusão dos relatórios.',
        variant: 'destructive',
      });
      return;
    }

    const text = completedJobs
      .map((j) => `${j.clienteNome} — ${j.presentationUrl}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${completedJobs.length} links copiados`,
        description: 'Cole no WhatsApp ou e-mail.',
      });
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Tente abrir os jobs e copiar individualmente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* State 1: Selection */}
        {!isGenerating && !batchDone && selectedCount > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>{selectedCount} selecionados</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onSelectPendentes}>
                Selecionar Pendentes
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Limpar
              </Button>
            </div>
            <Button size="lg" onClick={onGerar} className="gap-2">
              <Play className="w-4 h-4" />
              {outputFormat === 'slides' ? (
                <>
                  <Presentation className="w-4 h-4" />
                  Gerar {selectedCount} Slides
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Gerar {selectedCount} PDFs
                </>
              )}
            </Button>
          </div>
        )}

        {/* State 2: Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Gerando {batchTotal} relatórios
              </span>
              <span className="text-muted-foreground">
                {batchCompleted}/{batchTotal} concluídos
                {batchErrors > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {' · '}
                    {batchErrors} erros
                  </span>
                )}
                {remaining > 0 && <span> · {remaining} restam</span>}
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 dark:bg-zinc-800 rounded-full w-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* State 3: Completion */}
        {batchDone && !isGenerating && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>
                {batchCompleted} relatórios gerados
                {batchErrors > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {' · '}
                    {batchErrors} com erro
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleCopyAllLinks}
                disabled={completedWithUrlCount === 0}
                data-testid="button-copy-all-links"
              >
                <Clipboard className="w-4 h-4 mr-2" />
                Copiar todos os links ({completedWithUrlCount})
              </Button>
              <Button variant="outline" size="sm" onClick={onVerDetalhes}>
                Ver Detalhes
              </Button>
              <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Fechar">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
