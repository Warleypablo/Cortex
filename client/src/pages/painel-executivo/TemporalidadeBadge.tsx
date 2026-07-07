import { Calendar, Camera } from "lucide-react";
import { labelMes } from "./temporalidade";

export function TemporalidadeBadge({ tipo, mes }: { tipo: "mes" | "snapshot"; mes: string }) {
  if (tipo === "mes") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
        <Calendar className="h-3 w-3" /> {labelMes(mes)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      <Camera className="h-3 w-3" /> Snapshot atual
    </span>
  );
}
