import { MessageSquare, Users, Zap, Home, Sparkles, Calendar, Target } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

const TOPICOS = [
  { icon: Target, label: "Resultado de Clientes", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { icon: Users, label: "Momento do Líder", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  { icon: Zap, label: "FlashCRM", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  { icon: Home, label: "Nova Casa", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { icon: Sparkles, label: "Outras Atualizações", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/30" },
  { icon: Calendar, label: "Eventos", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30" },
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

      <div className="flex-1 grid grid-cols-2 gap-5 content-center">
        {TOPICOS.map(({ icon: Icon, label, color, bg, border }) => (
          <div
            key={label}
            className={`flex items-center gap-4 ${bg} border ${border} rounded-2xl px-6 py-5 backdrop-blur-sm shadow-lg shadow-black/20`}
          >
            <div className={`w-12 h-12 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
            <span className={`text-xl font-bold ${color}`}>{label}</span>
          </div>
        ))}
      </div>
    </SlideLayout>
  );
}
