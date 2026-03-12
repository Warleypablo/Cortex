import { ShoppingCart } from "lucide-react";
import { TURBO_COMMERCE_TARGETS, getQuarterKey } from "./turboCommerceTargets";
import type { ObjectiveSlide } from "./types";

const KEY_TO_KR: Record<string, { krId: string; brlTarget?: number }> = {
  venda_mrr: { krId: "O1_KR2" },
  venda_pontual: { krId: "O1_KR3" },
  pontual_tech: { krId: "O1_KR5" },
  churn: { krId: "O2_KR1", brlTarget: 311363 },
  inadimplencia: { krId: "O2_KR2", brlTarget: 281000 },
};

interface Props {
  ano: number;
  mes: number;
  okrObjectives?: ObjectiveSlide[];
  mrrAtivo?: number;
}

function formatBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(3).replace(".", ",")}Mi`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function getActualForKey(
  key: string,
  okrObjectives?: ObjectiveSlide[],
  mrrAtivo?: number,
): { value: number | null; unit: "BRL" | "PCT" } {
  if (key === "mrr_commerce" && mrrAtivo != null) {
    return { value: mrrAtivo, unit: "BRL" };
  }
  const mapping = KEY_TO_KR[key];
  if (!mapping || !okrObjectives) return { value: null, unit: "BRL" };
  for (const obj of okrObjectives) {
    const kr = obj.krs.find((k) => k.id === mapping.krId);
    if (kr && kr.actual != null) {
      return { value: kr.actual, unit: kr.unit === "PCT" ? "PCT" : "BRL" };
    }
  }
  return { value: null, unit: "BRL" };
}

function getAchievementColor(
  actual: number,
  target: number,
  direction: "gte" | "lte",
): string {
  let pct: number;
  if (direction === "lte") {
    // Lower is better (churn, inadimplência) — under target = good
    pct = target > 0 ? Math.max(0, (2 - actual / target)) * 100 : 100;
  } else {
    pct = target > 0 ? (actual / target) * 100 : 0;
  }
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}

export default function SlideTurboCommerce({ ano, mes, okrObjectives, mrrAtivo }: Props) {
  const qKey = getQuarterKey(ano, mes);
  const quarter = TURBO_COMMERCE_TARGETS[qKey];

  if (!quarter) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
        <p className="relative z-10 text-zinc-500">Metas do trimestre {qKey} não configuradas</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col text-white p-10 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="relative z-10 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
            <ShoppingCart className="h-5 w-5 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Turbo Commerce</h2>
          <span className="text-sm bg-white/[0.06] border border-purple-500/20 text-purple-300 rounded-full px-3 py-0.5">{quarter.label}</span>
        </div>
        <div className="h-px bg-gradient-to-r from-purple-500/40 to-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 auto-rows-min">
        {quarter.items.map((item) => {
          const { value: actual, unit: actualUnit } = getActualForKey(item.key, okrObjectives, mrrAtivo);
          const direction = (item.key === "churn" || item.key === "inadimplencia") ? "lte" as const : "gte" as const;
          const mapping = KEY_TO_KR[item.key];
          const achievementTarget = mapping?.brlTarget ?? item.target;
          const colorClass = actual != null ? getAchievementColor(actual, achievementTarget, direction) : "";
          return (
            <div key={item.key} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <p className="text-sm text-zinc-400 mb-1">{item.label}</p>
                <p className="text-2xl font-bold">
                  {item.unit === "BRL" ? formatBRL(item.target) : `${item.target}%`}
                </p>
                {actual != null && (
                  <p className={`text-sm font-semibold mt-1 ${colorClass}`}>
                    Atual: {actualUnit === "BRL" || item.unit === "BRL" ? formatBRL(actual) : `${actual.toFixed(1)}%`}
                  </p>
                )}
              </div>
              {item.subLabel && (
                <p className="text-xs text-zinc-500 mt-2">{item.subLabel}</p>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
