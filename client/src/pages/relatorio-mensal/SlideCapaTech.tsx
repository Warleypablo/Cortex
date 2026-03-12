import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";
import { Monitor } from "lucide-react";

export default function SlideCapaTech() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white p-12 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <img src={turboLogo} alt="Turbo Partners" className="h-12 object-contain opacity-60" />
        <Monitor className="h-16 w-16 text-blue-500" />
        <h1 className="text-4xl font-bold tracking-tight">Tech</h1>
        <p className="text-zinc-400 text-lg">Desenvolvimento e Projetos</p>
      </div>
    </div>
  );
}
