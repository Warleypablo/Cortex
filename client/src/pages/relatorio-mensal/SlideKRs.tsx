import { Target } from "lucide-react";
import type { ObjectiveSlide } from "./types";

interface Props {
  objectives: ObjectiveSlide[];
}

export default function SlideKRs({ objectives }: Props) {
  return (
    <div className="w-full h-full flex flex-col text-white p-10 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="relative z-10 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
            <Target className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Turbo Commerce</h2>
        </div>
        <div className="h-px bg-gradient-to-r from-blue-500/40 to-transparent" />
      </div>

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {objectives.map((obj) => (
          <div key={obj.id} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20 rounded-2xl p-5 flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-bold">
                <span className="text-blue-400">{obj.id}</span> – {obj.title}
              </h3>
              {obj.subtitle && <p className="text-xs text-zinc-500">{obj.subtitle}</p>}
            </div>

            <div className="space-y-3 flex-1">
              {obj.krs.map((kr) => (
                <div key={kr.id} className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
                  <span className="text-sm text-zinc-200 font-medium">{kr.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
