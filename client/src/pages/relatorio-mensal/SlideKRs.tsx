import { Target } from "lucide-react";
import type { ObjectiveSlide } from "./types";

interface Props {
  objectives: ObjectiveSlide[];
}

export default function SlideKRs({ objectives }: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-7 w-7 text-blue-400" />
        <h2 className="text-2xl font-bold">Turbo Commerce</h2>
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
              {obj.krs.map((kr) => (
                <div key={kr.id} className="bg-zinc-800/40 rounded-xl px-4 py-3">
                  <span className="text-sm text-zinc-200 font-medium">{kr.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
