import { Smile, TrendingUp, TrendingDown } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import { ACCENT, entrance, entranceWith, GrowBar, DeckKeyframes } from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Dados hardcoded — mesma fonte manual do SlideNPS do mensal; atualizar junto.
// ⚠️ O NPS de CLIENTE não existe em nenhuma tabela do banco (só o eNPS de
// colaborador, em "Inhire".rh_nps). Por isso o bloco abaixo é manual, incluindo o
// período anterior, que alimenta o comparativo antes × depois.
const NPS_DATA = {
  score: 58.6,
  promotores: 71.4,
  neutros: 15.7,
  detratores: 12.9,
  anterior: {
    score: 3.13,
    detratores: 43.9,
  },
  melhoresClientes: [
    { nome: "Click Cannabis", lt: "7 meses", accent: "#22c55e" },
    { nome: "Creamy", lt: "2 meses", accent: "#14b8a6" },
    { nome: "WinStage", lt: "1 ano e 3 meses", accent: "#a78bfa" },
  ],
};

// Zonas do NPS — convencionais (Bain/Reichheld)
const ZONAS = [
  { from: -100, to: 0, color: "#dc2626", label: "Zona Crítica" },
  { from: 0, to: 50, color: "#f59e0b", label: "Zona de Aperfeiçoamento" },
  { from: 50, to: 75, color: "#84cc16", label: "Zona de Qualidade" },
  { from: 75, to: 100, color: "#15803d", label: "Zona de Excelência" },
];

// Geometria do gauge compacto (semicírculo). Dois lado a lado não comportam os
// rótulos de zona (ficariam com ~6px): a classificação vai para a legenda abaixo.
const GAUGE = { cx: 180, cy: 172, r: 140, w: 44 };

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

/** "+58,6" / "−31,0" — sinal explícito e vírgula decimal (menos tipográfico). */
function fmtSigned(v: number, decimals = 1): string {
  const s = Math.abs(v).toFixed(decimals).replace(".", ",");
  return `${v < 0 ? "−" : "+"}${s}`;
}

/** Gauge compacto: arcos coloridos + agulha + valor. Sem ticks nem rótulo de zona. */
function NpsGaugeMini({
  animatedScore,
  targetScore,
  caption,
  decimals = 1,
  dimmed = false,
}: {
  animatedScore: number;
  targetScore: number;
  caption: string;
  decimals?: number;
  dimmed?: boolean;
}) {
  const { cx, cy, r, w } = GAUGE;
  const rInner = r - w;
  const needleEnd = polar(cx, cy, r - 12, scoreToAngle(animatedScore));
  const zone = getZoneByScore(targetScore);

  return (
    <svg viewBox="0 0 360 236" className="w-full" style={{ opacity: dimmed ? 0.75 : 1 }}>
      {ZONAS.map((z) => (
        <path
          key={z.label}
          d={arcPath(cx, cy, r, rInner, scoreToAngle(z.from), scoreToAngle(z.to))}
          fill={z.color}
          opacity={dimmed ? 0.55 : 0.92}
        />
      ))}

      {/* Legenda do gauge (ANTES / DEPOIS), dentro do arco */}
      <text x={cx} y={cy - 44} textAnchor="middle" fill="#a1a1aa" fontSize={15} fontWeight={700} letterSpacing={4}>
        {caption}
      </text>

      {/* Agulha */}
      <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={13} fill="#0f172a" stroke="#fff" strokeWidth={4} />

      {/* Valor */}
      <text x={cx} y={cy + 52} textAnchor="middle" fill={zone.color} fontSize={40} fontWeight={900}>
        {fmtSigned(animatedScore, decimals)}
      </text>
    </svg>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
  delayMs,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon?: typeof TrendingUp;
  delayMs: number;
}) {
  return (
    <div {...entrance(delayMs)}>
      <SecondaryCard className="px-4 py-3 text-center" borderColor={color}>
        <div className="flex items-center justify-center gap-1.5">
          {Icon && <Icon className="h-3 w-3 shrink-0" style={{ color }} />}
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest whitespace-nowrap">{label}</p>
        </div>
        <p className="text-[32px] leading-none font-black mt-1.5 tabular-nums" style={{ color }}>
          {value}
        </p>
        <p className="text-[10px] text-zinc-500 mt-1 truncate">{sub}</p>
      </SecondaryCard>
    </div>
  );
}

function ClienteCard({ nome, lt, accent, delayMs }: { nome: string; lt: string; accent: string; delayMs: number }) {
  return (
    <div {...entrance(delayMs)}>
      <SecondaryCard className="p-2.5 flex items-center gap-3" borderColor={accent}>
        <div
          className="rounded-full flex items-center justify-center shrink-0 font-black text-white text-sm"
          style={{
            width: 36,
            height: 36,
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
  const { score, promotores, neutros, detratores, anterior, melhoresClientes } = NPS_DATA;

  // Derivados — nunca hardcodados, para não divergirem dos números acima.
  const evolucao = score - anterior.score;                 // pontos de NPS
  const deltaDetratores = detratores - anterior.detratores; // pontos percentuais
  const zonaAtual = getZoneByScore(score);
  const zonaAnterior = getZoneByScore(anterior.score);
  const detratoresMelhorou = deltaDetratores <= 0;

  // Count-up sincronizado com a entrada dos blocos
  const scoreAnim = useCountUp(score, 900, 350);
  const anteriorAnim = useCountUp(anterior.score, 900, 350);
  const evolucaoAnim = useCountUp(evolucao, 750, 200);
  const deltaDetAnim = useCountUp(Math.abs(deltaDetratores), 750, 200);
  const promotoresAnim = useCountUp(promotores, 750, 500);
  const neutrosAnim = useCountUp(neutros, 750, 500);
  const detratoresAnim = useCountUp(detratores, 750, 500);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader
        icon={Smile}
        iconColor="text-emerald-400"
        title={`NPS — ${label}`}
        gradientColor={ACCENT.mrr}
        subtitle="Impacto do ajuste de processo na experiência do cliente"
      />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Linha de KPIs: anterior → atual, e as duas variações */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <KpiCard
            label="NPS anterior"
            value={fmtSigned(anterior.score, 2)}
            sub={zonaAnterior.label}
            color={zonaAnterior.color}
            delayMs={0}
          />
          <KpiCard
            label="NPS atual"
            value={fmtSigned(score, 1)}
            sub={zonaAtual.label}
            color={zonaAtual.color}
            delayMs={60}
          />
          <KpiCard
            label="Evolução"
            value={fmtSigned(evolucaoAnim, 1)}
            sub="pontos de NPS"
            color={ACCENT.vendas}
            icon={evolucao >= 0 ? TrendingUp : TrendingDown}
            delayMs={120}
          />
          <KpiCard
            label="Detratores"
            value={`${deltaDetratores < 0 ? "−" : "+"}${deltaDetAnim.toFixed(1).replace(".", ",")}`}
            sub="pontos percentuais"
            color={detratoresMelhorou ? ACCENT.mrr : ACCENT.churn}
            icon={detratoresMelhorou ? TrendingDown : TrendingUp}
            delayMs={180}
          />
        </div>

        <div className="flex-1 grid grid-cols-5 gap-6 min-h-0">
          {/* ESQUERDA: gauges antes × depois + legenda de zonas */}
          <div className="col-span-3 flex flex-col justify-center gap-3 min-h-0">
            <div {...entranceWith(240, "grid grid-cols-2 gap-5 items-center")}>
              <NpsGaugeMini animatedScore={anteriorAnim} targetScore={anterior.score} caption="ANTES" decimals={2} dimmed />
              <NpsGaugeMini animatedScore={scoreAnim} targetScore={score} caption="DEPOIS" decimals={1} />
            </div>

            {/* Legenda das zonas — substitui os rótulos que não cabem no gauge pequeno */}
            <div {...entranceWith(320, "flex items-center justify-center gap-4 flex-wrap")}>
              {ZONAS.map((z) => (
                <span key={z.label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: z.color }} />
                  <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                    {z.label} <span className="text-zinc-600">({z.from} a {z.to})</span>
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* DIREITA: distribuição + melhores clientes */}
          <div className="col-span-2 flex flex-col gap-3 min-h-0">
            <div {...entranceWith(280, "shrink-0")}>
              <SecondaryCard className="px-4 py-3">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2.5">Distribuição de respostas</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-20 text-[10px] font-bold text-emerald-400 uppercase tracking-wide text-right shrink-0">
                      Promotores
                    </span>
                    <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/[0.04]">
                      <GrowBar widthPct={promotores} delayMs={350} className="bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-md" />
                    </div>
                    <span className="w-12 text-xs font-black text-emerald-400 text-right shrink-0 tabular-nums">
                      {promotoresAnim.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-20 text-[10px] font-bold text-amber-400 uppercase tracking-wide text-right shrink-0">
                      Neutros
                    </span>
                    <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/[0.04]">
                      <GrowBar widthPct={neutros} delayMs={410} className="bg-gradient-to-r from-amber-500 to-amber-400 rounded-md" />
                    </div>
                    <span className="w-12 text-xs font-black text-amber-400 text-right shrink-0 tabular-nums">
                      {neutrosAnim.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-20 text-[10px] font-bold text-red-400 uppercase tracking-wide text-right shrink-0">
                      Detratores
                    </span>
                    <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/[0.04]">
                      <GrowBar widthPct={detratores} delayMs={470} className="bg-gradient-to-r from-red-500 to-red-400 rounded-md" />
                    </div>
                    <span className="w-12 text-xs font-black text-red-400 text-right shrink-0 tabular-nums">
                      {detratoresAnim.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 mt-2 tabular-nums">
                  Detratores eram {anterior.detratores.toFixed(1).replace(".", ",")}% no período anterior
                </p>
              </SecondaryCard>
            </div>

            <div {...entranceWith(320, "shrink-0")}>
              <h3 className="text-base font-black text-white">Melhores Clientes</h3>
              <p className="text-[11px] text-zinc-500">Promotores com nota 10 no NPS</p>
            </div>
            <div className="flex flex-col gap-2.5 flex-1 justify-center min-h-0">
              {melhoresClientes.map((c, i) => (
                <ClienteCard key={c.nome} nome={c.nome} lt={c.lt} accent={c.accent} delayMs={380 + i * 80} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
