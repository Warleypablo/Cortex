// client/src/components/predictions/AccuracyBadge.tsx
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

interface AccuracyBadgeProps {
  accuracy?: number; // 0-100 (100 = sem erro)
  label?: string;
}

export function AccuracyBadge({ accuracy, label }: AccuracyBadgeProps) {
  if (accuracy === undefined || accuracy === null) {
    return (
      <Badge variant="outline" className="text-xs text-gray-400 dark:text-zinc-500 border-gray-300 dark:border-zinc-600">
        <ShieldQuestion className="w-3 h-3 mr-1" />
        Calibrando
      </Badge>
    );
  }

  const isHigh = accuracy >= 90;
  const isMedium = accuracy >= 80 && accuracy < 90;

  if (isHigh) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Alta confiança
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Acurácia: {accuracy.toFixed(0)}% {label && `(${label})`}</p>
          <p className="text-xs text-gray-400">Erro médio &lt; 10% nos últimos 6 meses</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isMedium) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
            <ShieldAlert className="w-3 h-3 mr-1" />
            Média confiança
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Acurácia: {accuracy.toFixed(0)}% {label && `(${label})`}</p>
          <p className="text-xs text-gray-400">Erro médio 10-20% nos últimos 6 meses</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
          <ShieldAlert className="w-3 h-3 mr-1" />
          Baixa confiança
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Acurácia: {accuracy.toFixed(0)}% {label && `(${label})`}</p>
        <p className="text-xs text-gray-400">Erro médio &gt; 20% — modelo em calibração</p>
      </TooltipContent>
    </Tooltip>
  );
}
