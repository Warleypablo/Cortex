import { Smile } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import { ACCENT, entrance, GrowBar, DeckKeyframes } from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Dados hardcoded — mesma fonte manual do SlideNPS do mensal; atualizar junto
const NPS_DATA = {
  score: 58.6,
  promotores: 71.4,
  neutros: 15.7,
  detratores: 12.9,
  melhoresClientes: [
    { nome: "Click Cannabis", lt: "7 meses", accent: "#22c55e" },
    { nome: "Creamy", lt: "2 meses", accent: "#14b8a6" },
    { nome: "WinStage", lt: "1 ano e 3 meses", accent: "#a78bfa" },
  ],
};

// Zonas do NPS — convencionais (Bain/Reichheld)
const ZONAS = [
  { from: -100, to: 0, color: "#dc2626", label: "Zona\nCrítica", textColor: "#fff" },
  { from: 0, to: 50, color: "#f59e0b", label: "Zona de\nAperfeiçoamento", textColor: "#fff" },
  { from: 50, to: 75, color: "#84cc16", label: "Zona de\nQualidade", textColor: "#fff" },
  { from: 75, to: 100, color: "#15803d", label: "Zona de\nExcelência", textColor: "#fff" },
];

const TICKS = [-100, 0, 50, 75, 100];

// Geometria do gauge (semicírculo) — maior que o do mensal: é o hero do slide
const GAUGE = { cx: 380, cy: 280, r: 230, w: 70 };

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Mapeia score [-100, 100] → ângulo [-90°, 90°] (esquerda → direita)
function scoreToAngle(score: number): number {
  const clamped = Math.max(-100, Math.min(100, score));
  return -90 + ((clamped + 100) / 200) * 180;
}

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const startOuter = polar(cx, cy, rOuter, startAngle);
  const endOuter = polar(cx, cy, rOuter, endAngle);
  const startInner = polar(cx, cy, rInner, endAngle);
  const endInner = polar(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

function getZoneByScore(score: number): (typeof ZONAS)[number] {
  return ZONAS.find((z) => score >= z.from && score <= z.to) ?? ZONAS[0];
}

// Gauge hero: aceita um score animado (count-up) que move a agulha e o número em tempo real;
// a cor do score fica travada na zona do valor final p/ não "piscar" cor durante a entrada.
function NpsGaugeHero({ animatedScore, targetScore }: { animatedScore: number; targetScore: number }) {
  const { cx, cy, r, w } = GAUGE;
  const rInner = r - w;
  const needleAngle = scoreToAngle(animatedScore);
  const needleEnd = polar(cx, cy, r - 14, needleAngle);
  const zone = getZoneByScore(targetScore);

  return (
    <svg viewBox="0 0 760 380" className="w-full max-w-[640px]">
      {/* Arcs */}
      {ZONAS.map((z) => (
        <path
          key={z.label}
          d={arcPath(cx, cy, r, rInner, scoreToAngle(z.from), scoreToAngle(z.to))}
          fill={z.color}
          opacity={0.92}
        />
      ))}

      {/* Tick marks + values */}
      {TICKS.map((t) => {
        const a = scoreToAngle(t);
        const tickInner = polar(cx, cy, r + 4, a);
        const tickOuter = polar(cx, cy, r + 18, a);
        const labelPos = polar(cx, cy, r + 36, a);
        return (
          <g key={t}>
            <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} stroke="#a1a1aa" strokeWidth={2} />
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#d4d4d8"
              fontSize={16}
              fontWeight={700}
            >
              {t}
            </text>
          </g>
        );
      })}

      {/* Zone labels */}
      {ZONAS.map((z) => {
        const midAngle = (scoreToAngle(z.from) + scoreToAngle(z.to)) / 2;
        const labelR = (r + rInner) / 2;
        const pos = polar(cx, cy, labelR, midAngle);
        return (
          <text
            key={`l-${z.label}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={z.textColor}
            fontSize={13}
            fontWeight={700}
            style={{ pointerEvents: "none" }}
          >
            {z.label.split("\n").map((line, i) => (
              <tspan key={i} x={pos.x} dy={i === 0 ? 0 : 15}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}

      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={15} fill="#0f172a" stroke="#fff" strokeWidth={4} />

      {/* Score (hero) */}
      <text x={cx} y={cy + 58} textAnchor="middle" fill={zone.color} fontSize={56} fontWeight={900}>
        {animatedScore.toFixed(1).replace(".", ",")}
      </text>
      <text x={cx} y={cy + 82} textAnchor="middle" fill="#a1a1aa" fontSize={13} letterSpacing={3}>
        SCORE NPS
      </text>
    </svg>
  );
}

function ClienteCard({ nome, lt, accent, delayMs }: { nome: string; lt: string; accent: string; delayMs: number }) {
  return (
    <div {...entrance(delayMs)}>
      <SecondaryCard className="p-3 flex items-center gap-3" borderColor={accent}>
        <div
          className="rounded-full flex items-center justify-center shrink-0 font-black text-white text-sm"
          style={{
            width: 40,
            height: 40,
            background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
            boxShadow: `0 0 16px ${accent}55`,
          }}
        >
          10
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{nome}</p>
          <p className="text-[11px] text-zinc-500">LT — {lt}</p>
        </div>
        <span className="text-amber-400 text-xs shrink-0" aria-hidden>
          ★★★★★
        </span>
      </SecondaryCard>
    </div>
  );
}

export default function SlideNpsTrimestre({ label }: { label: string }) {
  const { score, promotores, neutros, detratores, melhoresClientes } = NPS_DATA;

  // Count-up sincronizado com a entrada dos blocos (+200ms sobre o delay do bloco)
  const scoreAnim = useCountUp(score, 750, 200);
  const promotoresAnim = useCountUp(promotores, 750, 400);
  const neutrosAnim = useCountUp(neutros, 750, 400);
  const detratoresAnim = useCountUp(detratores, 750, 400);

  const gaugeEntrance = entrance(0);
  const clientesHeaderEntrance = entrance(150);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Smile} iconColor="text-emerald-400" title={`NPS — ${label}`} gradientColor={ACCENT.mrr} />

      <div className="flex-1 grid grid-cols-5 gap-6 min-h-0">
        {/* LEFT: gauge hero + distribuição de respostas */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">
          <div
            className={`${gaugeEntrance.className} flex-1 flex items-center justify-center min-h-0`}
            style={gaugeEntrance.style}
          >
            <NpsGaugeHero animatedScore={scoreAnim} targetScore={score} />
          </div>

          <div {...entrance(200)}>
            <SecondaryCard className="px-5 py-4">
              <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3">Distribuição de respostas</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs font-bold text-emerald-400 uppercase tracking-wide text-right shrink-0">
                    Promotores
                  </span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden bg-white/[0.04]">
                    <GrowBar widthPct={promotores} delayMs={250} className="bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-md" />
                  </div>
                  <span className="w-16 text-sm font-black text-emerald-400 text-right shrink-0 tabular-nums">
                    {promotoresAnim.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs font-bold text-amber-400 uppercase tracking-wide text-right shrink-0">
                    Neutros
                  </span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden bg-white/[0.04]">
                    <GrowBar widthPct={neutros} delayMs={310} className="bg-gradient-to-r from-amber-500 to-amber-400 rounded-md" />
                  </div>
                  <span className="w-16 text-sm font-black text-amber-400 text-right shrink-0 tabular-nums">
                    {neutrosAnim.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-xs font-bold text-red-400 uppercase tracking-wide text-right shrink-0">
                    Detratores
                  </span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden bg-white/[0.04]">
                    <GrowBar widthPct={detratores} delayMs={370} className="bg-gradient-to-r from-red-500 to-red-400 rounded-md" />
                  </div>
                  <span className="w-16 text-sm font-black text-red-400 text-right shrink-0 tabular-nums">
                    {detratoresAnim.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
              </div>
            </SecondaryCard>
          </div>
        </div>

        {/* RIGHT: melhores clientes */}
        <div className="col-span-2 flex flex-col gap-3 min-h-0">
          <div {...clientesHeaderEntrance}>
            <h3 className="text-lg font-black text-white">Melhores Clientes</h3>
            <p className="text-xs text-zinc-500">Promotores com nota 10 no NPS</p>
          </div>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            {melhoresClientes.map((c, i) => (
              <ClienteCard key={c.nome} nome={c.nome} lt={c.lt} accent={c.accent} delayMs={250 + i * 90} />
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
