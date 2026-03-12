import { Target } from "lucide-react";
import type { ObjectiveSlide } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

interface Props {
  objectives: ObjectiveSlide[];
}

export default function SlideKRs({ objectives }: Props) {
  return (
    <SlideLayout section="commerce" padding="40px">
      <SlideHeader
        icon={Target}
        iconColor="text-blue-400"
        title="Turbo Commerce"
        gradientColor="#3b82f6"
      />

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {objectives.map((obj) => (
          <div key={obj.id} className="bg-white/[0.04] border border-white/[0.08] shadow-lg shadow-black/20 rounded-2xl p-5 flex flex-col">
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
    </SlideLayout>
  );
}
