import type { RelatorioTrimestralData } from "./types";
export default function SlideVisaoTrimestre({ data }: { data: RelatorioTrimestralData }) {
  return <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-white">Visão do Trimestre — {data.label}</div>;
}
