import { Target } from "lucide-react";
import type { ObjectiveSlide } from "./types";

interface Props {
  objectives: ObjectiveSlide[];
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "BRL") {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  }
  if (unit === "PCT") return `${value.toFixed(1)}%`;
  return value.toLocaleString("pt-BR");
}

function getBarColor(achievement: number, hasData: boolean): string {
  if (!hasData) return "bg-zinc-700";
  if (achievement >= 80) return "bg-emerald-500";
  if (achievement >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function getBadgeStyle(achievement: number, hasData: boolean): string {
  if (!hasData) return "bg-zinc-800 text-zinc-500";
  if (achievement >= 80) return "bg-emerald-500/20 text-emerald-400";
  if (achievement >= 50) return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

export default function SlideKRs({ objectives }: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-7 w-7 text-blue-400" />
        <h2 className="text-2xl font-bold">Key Results</h2>
      </div>

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {objectives.map((obj) => (
          <div key={obj.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-bold">
                <span className="text-blue-400">{obj.id}</span> – {obj.title}
              </h3>
              {obj.subtitle && <p className="text-xs text-zinc-500">{obj.subtitle}</p>}
            </div>

            <div className="space-y-3 flex-1">
              {obj.krs.map((kr) => {
                const hasData = kr.actual !== null;
                return (
                  <div key={kr.id} className="bg-zinc-800/40 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-200 font-medium truncate mr-3">{kr.title}</span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${getBadgeStyle(kr.achievement, hasData)}`}>
                        {hasData ? `${kr.achievement}%` : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-zinc-900 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getBarColor(kr.achievement, hasData)} transition-all duration-500`}
                          style={{ width: hasData ? `${Math.max(kr.achievement, 2)}%` : "0%" }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-zinc-500">
                        Meta: {formatValue(kr.targetQ, kr.unit)}
                      </span>
                      <span className={`text-xs font-semibold ${hasData ? "text-white" : "text-zinc-600"}`}>
                        {hasData ? formatValue(kr.actual, kr.unit) : "Sem dados"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
