import { MessageSquare, Workflow, Handshake, Rocket, Shuffle, Brain, Sparkles } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

const TOPICOS = [
  { icon: Workflow,  label: "Novo Modelo Operação", color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
  { icon: Handshake, label: "Partnership",          color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { icon: Rocket,    label: "Ventures",             color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  { icon: Shuffle,   label: "Mudança de Squads",    color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30" },
  { icon: Brain,     label: "IA Mindset",           color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30" },
  { icon: Sparkles,  label: "IA Turbo",             color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
];

export default function SlideTopicosDiscussao() {
  return (
    <SlideLayout section="intro" padding="32px 48px">
      <SlideHeader
        icon={MessageSquare}
        iconColor="text-violet-400"
        title="Tópicos de Discussão"
        gradientColor="#a78bfa"
      />

      <div className="flex-1 grid grid-cols-2 gap-4 content-center max-w-5xl mx-auto w-full">
        {TOPICOS.map(({ icon: Icon, label, color, bg, border }) => (
          <div
            key={label}
            className={`flex items-center gap-4 ${bg} border ${border} rounded-2xl px-6 py-5 backdrop-blur-sm shadow-lg shadow-black/20`}
          >
            <div className={`w-14 h-14 rounded-2xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
              <Icon className={`h-7 w-7 ${color}`} />
            </div>
            <span className={`text-xl font-bold ${color}`}>{label}</span>
          </div>
        ))}
      </div>
    </SlideLayout>
  );
}
