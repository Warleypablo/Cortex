import { Trophy } from "lucide-react";
import type { TopOperadores, OperadorRanking } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard } from "./SlideComponents";

interface Props {
  topOperadores: TopOperadores;
  mesLabel: string;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  if (v === 0) return "R$ 0";
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

const RANK_STYLES = [
  { text: "text-amber-400", size: "text-lg font-black" },
  { text: "text-zinc-300", size: "text-base font-bold" },
  { text: "text-zinc-500", size: "text-sm font-semibold" },
] as const;

interface PodiumColProps {
  title: string;
  items: OperadorRanking[];
  formatValue: (v: number) => string;
}

function PodiumCol({ title, items, formatValue }: PodiumColProps) {
  return (
    <SecondaryCard className="flex flex-col gap-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{title}</p>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-600 text-sm">Sem dados no mês</p>
        </div>
      ) : (
        items.slice(0, 3).map((item, i) => (
          <div key={`${i}-${item.nome}`} className="flex items-start gap-2.5">
            <span className="text-2xl leading-none mt-0.5">{MEDALS[i]}</span>
            <div className="flex-1 min-w-0">
              <p className={`truncate ${RANK_STYLES[i].size} ${RANK_STYLES[i].text}`}>
                {item.nome}
              </p>
              <p className={`text-xs ${RANK_STYLES[i].text} opacity-70`}>
                {formatValue(item.valor)}
              </p>
            </div>
          </div>
        ))
      )}
    </SecondaryCard>
  );
}

export default function SlideTopOperadores({ topOperadores, mesLabel }: Props) {
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={Trophy}
        iconColor="text-amber-400"
        title={`Top Operadores — ${mesLabel}`}
        gradientColor="#f59e0b"
      />

      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <PodiumCol
          title="MRR Ativo"
          items={topOperadores.topMrr}
          formatValue={fmtBRL}
        />
        <PodiumCol
          title="Menor Churn"
          items={topOperadores.topMenorChurn}
          formatValue={fmtBRL}
        />
        <PodiumCol
          title="Projetos Entregues"
          items={topOperadores.topEntregas}
          formatValue={(v) => `${v} entrega${v !== 1 ? "s" : ""}`}
        />
      </div>
    </SlideLayout>
  );
}
