import { Trophy, Crown } from "lucide-react";
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  fotoUrl?: string | null;
  nome: string;
  size: number;
  ringColor: string;
}

function Avatar({ fotoUrl, nome, size, ringColor }: AvatarProps) {
  const fontSize = Math.round(size * 0.34);
  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${ringColor}33, ${ringColor}11)`,
        border: `3px solid ${ringColor}`,
        boxShadow: `0 0 24px ${ringColor}55, 0 0 48px ${ringColor}22`,
      }}
    >
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt={nome}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span className="font-black text-white" style={{ fontSize }}>
          {getInitials(nome)}
        </span>
      )}
    </div>
  );
}

interface RankingPanelProps {
  title: string;
  accent: string;
  items: OperadorRanking[];
  formatValue: (v: number) => string;
}

const PODIUM_COLORS = ["#f59e0b", "#a1a1aa", "#f97316"];
const MEDALS = ["🥇", "🥈", "🥉"];

function RankingPanel({ title, accent, items, formatValue }: RankingPanelProps) {
  const top = items.slice(0, 3);
  const champion = top[0];
  const runners = top.slice(1, 3);

  return (
    <SecondaryCard className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
        <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">{title}</p>
      </div>

      {top.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-600 text-sm">Sem dados no mês</p>
        </div>
      ) : (
        <>
          {/* Champion (1st place) — large highlight */}
          {champion && (
            <div className="flex flex-col items-center text-center">
              <Crown className="text-amber-400 mb-1" style={{ width: 24, height: 24 }} />
              <Avatar
                fotoUrl={champion.fotoUrl}
                nome={champion.nome}
                size={96}
                ringColor={PODIUM_COLORS[0]}
              />
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xl leading-none">{MEDALS[0]}</span>
                <p className="text-lg font-black text-white truncate max-w-[200px]">
                  {champion.nome}
                </p>
              </div>
              {champion.cargo && (
                <p className="text-[11px] text-zinc-500 truncate max-w-[220px]">{champion.cargo}</p>
              )}
              <p className="text-2xl font-black text-amber-400 mt-1 tabular-nums">
                {formatValue(champion.valor)}
              </p>
            </div>
          )}

          {/* Runners-up (2nd & 3rd) */}
          {runners.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-auto pt-3 border-t border-white/5">
              {runners.map((item, i) => {
                const rank = i + 1; // 1 -> 2nd, 2 -> 3rd
                const color = PODIUM_COLORS[rank];
                return (
                  <div key={`${rank}-${item.nome}`} className="flex flex-col items-center text-center">
                    <Avatar
                      fotoUrl={item.fotoUrl}
                      nome={item.nome}
                      size={56}
                      ringColor={color}
                    />
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-base leading-none">{MEDALS[rank]}</span>
                      <p className="text-sm font-bold text-white truncate max-w-[110px]">
                        {item.nome}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums" style={{ color }}>
                      {formatValue(item.valor)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
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

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        <RankingPanel
          title="MRR Ativo"
          accent="#22d3ee"
          items={topOperadores.topMrr}
          formatValue={fmtBRL}
        />
        <RankingPanel
          title="Projetos Entregues"
          accent="#f59e0b"
          items={topOperadores.topEntregas}
          formatValue={(v) => `${v} entrega${v !== 1 ? "s" : ""}`}
        />
      </div>
    </SlideLayout>
  );
}
