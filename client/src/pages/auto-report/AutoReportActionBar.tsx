import { Button } from "@/components/ui/button";
import { CheckCircle, Play, Presentation, FileText } from "lucide-react";
import type { OutputFormat } from "./types";

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
}: AutoReportActionBarProps) {
  const isVisible = selectedCount > 0 || isGenerating || batchDone;

  const progressPercent = batchTotal > 0
    ? Math.round(((batchCompleted + batchErrors) / batchTotal) * 100)
    : 0;

  const remaining = batchTotal - batchCompleted - batchErrors;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 shadow-lg transition-all duration-300 ease-in-out ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* State 1: Selection (not generating, not batchDone, selectedCount > 0) */}
        {!isGenerating && !batchDone && selectedCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
              <CheckCircle className="w-4 h-4 text-primary" />
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
            <Button size="sm" onClick={onGerar}>
              <Play className="w-4 h-4 mr-1" />
              {outputFormat === 'slides' ? (
                <>
                  <Presentation className="w-4 h-4 mr-1" />
                  Gerar Slides
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-1" />
                  Gerar PDF
                </>
              )}
            </Button>
          </div>
        )}

        {/* State 2: Progress (isGenerating) */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full w-full">
              <div
                className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 dark:text-zinc-400">
              {batchCompleted}/{batchTotal} concluidos
              {batchErrors > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {" "}&bull; {batchErrors} erros
                </span>
              )}
              {remaining > 0 && (
                <span> &bull; {remaining} restam</span>
              )}
            </div>
          </div>
        )}

        {/* State 3: Completion (batchDone, not isGenerating) */}
        {batchDone && !isGenerating && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-zinc-300">
              {batchCompleted} gerados
              {batchErrors > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  , {batchErrors} erros
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onVerDetalhes}>
                Ver Detalhes
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
