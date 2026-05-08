import { Smile } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard } from "./SlideComponents";

// Dados hardcoded — atualizar manualmente até existir fonte (cortex_core.nps_clientes ou integração externa).
const NPS_DATA = {
  score: 37.1,
  promotores: 60.0,
  neutros: 17.1,
  detratores: 22.9,
  melhoresClientes: [
    { nome: "Consiga Empréstimo", lt: "5 meses", accent: "#22c55e" },
    { nome: "America Rental Car", lt: "3 anos",  accent: "#14b8a6" },
    { nome: "Livraria da Vila",   lt: "3 anos",  accent: "#a78bfa" },
  ],
};

// Zonas do NPS — convencionais (Bain/Reichheld)
const ZONAS = [
  { from: -100, to: 0,   color: "#dc2626", label: "Zona\nCrítica",          textColor: "#fff" },
  { from: 0,    to: 50,  color: "#f59e0b", label: "Zona de\nAperfeiçoamento", textColor: "#fff" },
  { from: 50,   to: 75,  color: "#84cc16", label: "Zona de\nQualidade",     textColor: "#fff" },
  { from: 75,   to: 100, color: "#15803d", label: "Zona de\nExcelência",    textColor: "#fff" },
];

const TICKS = [-100, 0, 50, 75, 100];

// Geometria do gauge (semicírculo)
const GAUGE = { cx: 320, cy: 220, r: 200, w: 60 };

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
  const endOuter   = polar(cx, cy, rOuter, endAngle);
  const startInner = polar(cx, cy, rInner, endAngle);
  const endInner   = polar(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

function getZoneByScore(score: number): typeof ZONAS[number] {
  return ZONAS.find((z) => score >= z.from && score <= z.to) ?? ZONAS[0];
}

function NpsGauge({ score }: { score: number }) {
  const { cx, cy, r, w } = GAUGE;
  const rInner = r - w;
  const needleAngle = scoreToAngle(score);
  const needleEnd = polar(cx, cy, r - 12, needleAngle);
  const zone = getZoneByScore(score);

  return (
    <svg viewBox="0 0 640 280" className="w-full max-w-[640px]">
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
        const tickOuter = polar(cx, cy, r + 16, a);
        const labelPos = polar(cx, cy, r + 32, a);
        return (
          <g key={t}>
            <line
              x1={tickInner.x} y1={tickInner.y}
              x2={tickOuter.x} y2={tickOuter.y}
              stroke="#a1a1aa" strokeWidth={2}
            />
            <text
              x={labelPos.x} y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#d4d4d8" fontSize={14} fontWeight={600}
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
            x={pos.x} y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={z.textColor}
            fontSize={11}
            fontWeight={700}
            style={{ pointerEvents: "none" }}
          >
            {z.label.split("\n").map((line, i) => (
              <tspan key={i} x={pos.x} dy={i === 0 ? 0 : 13}>{line}</tspan>
            ))}
          </text>
        );
      })}

      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={needleEnd.x} y2={needleEnd.y}
        stroke="#fff" strokeWidth={3} strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={12} fill="#0f172a" stroke="#fff" strokeWidth={3} />

      {/* Score text below needle pivot */}
      <text x={cx} y={cy + 50} textAnchor="middle" fill={zone.color} fontSize={32} fontWeight={900}>
        {score.toFixed(1).replace(".", ",")}
      </text>
      <text x={cx} y={cy + 70} textAnchor="middle" fill="#a1a1aa" fontSize={11} letterSpacing={2}>
        SCORE NPS
      </text>
    </svg>
  );
}

function StarRating() {
  return (
    <div className="flex gap-0.5 justify-center text-amber-400 text-lg">
      {[1, 2, 3, 4, 5].map((i) => <span key={i}>★</span>)}
    </div>
  );
}

interface Props {
  mesLabel: string;
}

export default function SlideNPS({ mesLabel }: Props) {
  const { score, promotores, neutros, detratores, melhoresClientes } = NPS_DATA;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={Smile}
        iconColor="text-emerald-400"
        title={`Relatório de NPS — ${mesLabel}`}
        gradientColor="#10b981"
      />

      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* LEFT: Gauge + Score + Distribuição */}
        <div className="flex flex-col items-center justify-center gap-4">
          <NpsGauge score={score} />

          {/* Distribuição */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[520px]">
            <SecondaryCard className="p-3 flex flex-col items-center gap-1" borderColor="#22c55e">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Promotores</p>
              <p className="text-2xl font-black text-emerald-400 tabular-nums">
                {promotores.toFixed(1).replace(".", ",")}%
              </p>
            </SecondaryCard>
            <SecondaryCard className="p-3 flex flex-col items-center gap-1" borderColor="#f59e0b">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Neutros</p>
              <p className="text-2xl font-black text-amber-400 tabular-nums">
                {neutros.toFixed(1).replace(".", ",")}%
              </p>
            </SecondaryCard>
            <SecondaryCard className="p-3 flex flex-col items-center gap-1" borderColor="#ef4444">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Detratores</p>
              <p className="text-2xl font-black text-red-400 tabular-nums">
                {detratores.toFixed(1).replace(".", ",")}%
              </p>
            </SecondaryCard>
          </div>
        </div>

        {/* RIGHT: Melhores Clientes */}
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-xl font-black text-white">Melhores Clientes</h3>
            <p className="text-xs text-zinc-500">Clientes promotores com nota 10 no NPS</p>
          </div>

          <div className="flex flex-col gap-3 flex-1 justify-center">
            {melhoresClientes.map((c) => (
              <SecondaryCard
                key={c.nome}
                className="p-4 flex items-center gap-4"
                borderColor={c.accent}
              >
                <div
                  className="rounded-full flex items-center justify-center shrink-0 font-black text-white"
                  style={{
                    width: 52, height: 52,
                    background: `linear-gradient(135deg, ${c.accent}, ${c.accent}aa)`,
                    boxShadow: `0 0 20px ${c.accent}55`,
                  }}
                >
                  10
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{c.nome}</p>
                  <p className="text-xs text-zinc-500">LT — {c.lt}</p>
                </div>
                <StarRating />
              </SecondaryCard>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
