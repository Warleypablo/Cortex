import { ShoppingCart } from "lucide-react";
import { TURBO_COMMERCE_TARGETS, getQuarterKey } from "./turboCommerceTargets";

interface Props {
  ano: number;
  mes: number;
}

function formatBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(3).replace(".", ",")}Mi`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export default function SlideTurboCommerce({ ano, mes }: Props) {
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
      <div className="relative z-10 flex flex-col flex-1">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingCart className="h-7 w-7 text-purple-400" />
        <h2 className="text-2xl font-bold">Turbo Commerce</h2>
        <span className="text-sm bg-purple-500/20 text-purple-300 rounded-full px-3 py-0.5">{quarter.label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 auto-rows-min">
        {quarter.items.map((item) => (
          <div key={item.key} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-sm text-zinc-400 mb-1">{item.label}</p>
              <p className="text-2xl font-bold">
                {item.unit === "BRL" ? formatBRL(item.target) : `${item.target}%`}
              </p>
            </div>
            {item.subLabel && (
              <p className="text-xs text-zinc-500 mt-2">{item.subLabel}</p>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
