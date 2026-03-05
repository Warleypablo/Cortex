import { Target } from "lucide-react";
import type { ObjectiveSlide } from "./types";

interface Props {
  objectives: ObjectiveSlide[];
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "-";
  if (unit === "BRL") {
    if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `R$${(value / 1_000).toFixed(0)}k`;
    return `R$${value.toFixed(0)}`;
  }
  if (unit === "PCT") return `${value.toFixed(1)}%`;
  return value.toFixed(0);
}

function ProgressBar({ achievement, direction }: { achievement: number; direction: string }) {
  const pct = Math.min(achievement, 100);
  const color = achievement >= 100
    ? "bg-emerald-500"
    : achievement >= 70
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="w-full bg-zinc-800 rounded-full h-2.5">
      <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SlideKRs({ objectives }: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-7 w-7 text-blue-400" />
        <h2 className="text-2xl font-bold">Key Results</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {objectives.map((obj) => (
          <div key={obj.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold">
                <span className="text-blue-400">{obj.id}</span> - {obj.title}
              </h3>
              {obj.subtitle && <p className="text-sm text-zinc-500">{obj.subtitle}</p>}
            </div>

            <div className="space-y-4">
              {obj.krs.map((kr) => (
                <div key={kr.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 truncate mr-2">{kr.title}</span>
                    <span className="text-zinc-500 whitespace-nowrap">
                      {formatValue(kr.actual, kr.unit)} / {formatValue(kr.targetQ, kr.unit)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar achievement={kr.achievement} direction={kr.direction} />
                    </div>
                    <span className="text-xs font-bold text-zinc-400 w-10 text-right">
                      {kr.achievement}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
