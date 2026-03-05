import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";
import { TrendingUp } from "lucide-react";

export default function SlideCapaComercial() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white p-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[800px] h-[400px] rounded-full bg-gradient-to-b from-amber-500 to-orange-600" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <img src={turboLogo} alt="Turbo Partners" className="h-12 object-contain opacity-60" />
        <TrendingUp className="h-16 w-16 text-amber-500" />
        <h1 className="text-4xl font-bold tracking-tight">Comercial</h1>
        <p className="text-zinc-400 text-lg">Resultados e Performance</p>
      </div>
    </div>
  );
}
