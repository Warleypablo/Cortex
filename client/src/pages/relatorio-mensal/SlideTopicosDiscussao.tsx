import { MessageSquare, Workflow, Handshake, Cpu, Rocket } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

const TOPICOS = [
  { icon: Workflow,  label: "Novo Modelo Operação", color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
  { icon: Handshake, label: "Partnership",          color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { icon: Cpu,       label: "IA",                   color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30" },
  { icon: Rocket,    label: "Ventures",             color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
];

export default function SlideTopicosDiscussao() {
  return (
    <SlideLayout section="intro" padding="40px 48px">
      <SlideHeader
        icon={MessageSquare}
        iconColor="text-violet-400"
        title="Tópicos de Discussão"
        gradientColor="#a78bfa"
      />

      <div className="flex-1 flex flex-col gap-6 justify-center max-w-3xl mx-auto w-full">
        {TOPICOS.map(({ icon: Icon, label, color, bg, border }) => (
          <div
            key={label}
            className={`flex items-center gap-6 ${bg} border ${border} rounded-2xl px-8 py-6 backdrop-blur-sm shadow-lg shadow-black/20`}
          >
            <div className={`w-16 h-16 rounded-2xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
              <Icon className={`h-8 w-8 ${color}`} />
            </div>
            <span className={`text-2xl font-bold ${color}`}>{label}</span>
          </div>
        ))}
      </div>
    </SlideLayout>
  );
}
