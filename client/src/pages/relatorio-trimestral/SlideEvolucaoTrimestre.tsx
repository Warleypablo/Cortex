import type { TrendData } from "./types";
export default function SlideEvolucaoTrimestre({ trend }: { trend: TrendData }) {
  return <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-white">Evolução — {trend.series.length} trimestres</div>;
}
