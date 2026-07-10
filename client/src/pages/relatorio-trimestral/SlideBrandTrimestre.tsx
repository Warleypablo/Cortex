import type { ReactNode } from "react";
import SlideLayout, { type SlideSection } from "../relatorio-mensal/SlideLayout";
import { entrance } from "./deck-kit";

// Bloco de slides "brand" do fecho do deck (visão / partnership / bônus), replicando as
// telas fornecidas pelo Ichino (2026-07-10) no estilo visual do deck. Conteúdo hardcoded.
// Um único componente parametrizado por `spec.layout` renderiza todas as telas.

type BrandSpec =
  | { layout: "hero"; kicker?: string; title: string; accentWord?: string; big?: string; accent: string; section: SlideSection }
  | { layout: "valor"; label: string; valor: string; accent: string; section: SlideSection }
  | { layout: "tabela"; title: string; subtitle?: string; cols: string[]; rows: string[][]; highlightFrom?: number; accent: string; section: SlideSection }
  | { layout: "conceito"; title: string; body?: string; items?: string[]; accent: string; section: SlideSection }
  | { layout: "quadrantes"; title: string; quads: string[]; destaque: string; accent: string; section: SlideSection };

export const BRAND_SLIDES: BrandSpec[] = [
  { layout: "hero", title: "Shake Hands", accentWord: "Hands", accent: "#22d3ee", section: "intro" },
  { layout: "hero", title: "Bigger and Better", accentWord: "Better", accent: "#a855f7", section: "intro" },
  {
    layout: "tabela", title: "Escadinha de Faturamento", subtitle: "2022 → 2028 · 25 – 50 – 100",
    cols: ["Ano", "Faturamento"],
    rows: [
      ["2022", "R$ 1.133.000"],
      ["2023", "R$ 2.258.000"],
      ["2024", "R$ 5.025.000"],
      ["2025", "R$ 11.082.096"],
      ["2026e", "R$ 25.000.000"],
      ["2027e", "R$ 50.000.000"],
      ["2028e", "R$ 100.000.000"],
    ],
    highlightFrom: 4, accent: "#34d399", section: "commerce",
  },
  { layout: "hero", kicker: "Meta", title: "R$ 100MI", accentWord: "100MI", big: "2028", accent: "#34d399", section: "commerce" },
  { layout: "hero", title: "Partnership", accentWord: "ship", accent: "#22d3ee", section: "intro" },
  {
    layout: "tabela", title: "Preço de Ações — Partnership",
    cols: ["Ano", "Valuation", "Preço da ação"],
    rows: [
      ["2022", "R$ 2.266.000", "R$ 23"],
      ["2023", "R$ 4.516.000", "R$ 45"],
      ["2024", "R$ 10.050.000", "R$ 101"],
      ["2025", "R$ 22.121.532", "R$ 221"],
    ],
    accent: "#a855f7", section: "commerce",
  },
  { layout: "valor", label: "Bônus previsto", valor: "R$ 1.500.000", accent: "#34d399", section: "commerce" },
  { layout: "hero", kicker: "Política de Bônus", title: "2026", accentWord: "2026", accent: "#fbbf24", section: "intro" },
  { layout: "conceito", title: "Como uma empresa ganha dinheiro?", body: "Receita (o que vendeu) − Despesa (o que gastou) = Lucro (o que sobrou)", accent: "#22d3ee", section: "commerce" },
  { layout: "conceito", title: "Como uma empresa quebra?", items: ["Gastou mais do que podia", "Vendeu menos do que deveria"], accent: "#f87171", section: "commerce" },
  { layout: "quadrantes", title: "E para a realidade da Turbo?", quads: ["CSV", "CAC", "SG&A", "LUCRO"], destaque: "LUCRO", accent: "#34d399", section: "commerce" },
  { layout: "conceito", title: "E por que é importante respeitar essas fatias?", body: "Lucro = Bônus", accent: "#34d399", section: "commerce" },
  { layout: "conceito", title: "Como vai funcionar o bônus?", body: "Distribuição = Caixa inicial + Geração de caixa − Saldo mínimo de caixa", accent: "#22d3ee", section: "commerce" },
  { layout: "conceito", title: "E como será distribuído?", items: ["40% Executivos", "30% Líderes", "30% Especialistas"], accent: "#a855f7", section: "commerce" },
];

function Frame({ section, children }: { section: SlideSection; children: ReactNode }) {
  return (
    <SlideLayout section={section} padding="48px 64px">
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 text-center">{children}</div>
    </SlideLayout>
  );
}

function renderTitleWithAccent(title: string, accentWord: string | undefined, accent: string) {
  if (!accentWord || !title.includes(accentWord)) return title;
  const [before, after] = title.split(accentWord);
  return (
    <>
      {before}
      <span style={{ color: accent }}>{accentWord}</span>
      {after}
    </>
  );
}

export default function SlideBrandTrimestre({ spec }: { spec: BrandSpec }) {
  if (spec.layout === "hero") {
    return (
      <Frame section={spec.section}>
        {spec.kicker && (
          <p {...entrance(0)} className="text-sm font-bold uppercase tracking-[0.35em] mb-5" style={{ color: spec.accent }}>
            {spec.kicker}
          </p>
        )}
        <h1 {...entrance(80)} className="font-black text-white leading-[0.95] tracking-tight" style={{ fontSize: spec.big ? 96 : 108 }}>
          {renderTitleWithAccent(spec.title, spec.accentWord, spec.accent)}
        </h1>
        {spec.big && (
          <p {...entrance(180)} className="font-black tracking-tight mt-4" style={{ fontSize: 140, color: spec.accent, lineHeight: 1 }}>
            {spec.big}
          </p>
        )}
      </Frame>
    );
  }

  if (spec.layout === "valor") {
    return (
      <Frame section={spec.section}>
        <p {...entrance(0)} className="text-lg font-bold uppercase tracking-[0.3em] text-zinc-400 mb-6">{spec.label}</p>
        <p {...entrance(120)} className="font-black tracking-tight" style={{ fontSize: 132, color: spec.accent, lineHeight: 1 }}>
          {spec.valor}
        </p>
      </Frame>
    );
  }

  if (spec.layout === "conceito") {
    return (
      <Frame section={spec.section}>
        <h1 {...entrance(0)} className="font-black text-white leading-tight tracking-tight max-w-[1000px]" style={{ fontSize: 58 }}>
          {spec.title}
        </h1>
        <div className="mt-10 h-1 w-24 rounded-full" style={{ background: spec.accent }} />
        {spec.body && (
          <p {...entrance(120)} className="font-bold text-zinc-100 mt-10 max-w-[1050px]" style={{ fontSize: 40, lineHeight: 1.3 }}>
            {spec.body}
          </p>
        )}
        {spec.items && (
          <div {...entrance(120)} className="mt-10 flex flex-col gap-5">
            {spec.items.map((it, i) => (
              <div key={i} className="flex items-center gap-4 justify-center" style={{ fontSize: 36 }}>
                <span className="font-black tabular-nums" style={{ color: spec.accent }}>{i + 1}.</span>
                <span className="font-bold text-zinc-100">{it}</span>
              </div>
            ))}
          </div>
        )}
      </Frame>
    );
  }

  if (spec.layout === "quadrantes") {
    return (
      <Frame section={spec.section}>
        <h1 {...entrance(0)} className="font-black text-white leading-tight tracking-tight mb-10" style={{ fontSize: 54 }}>
          {spec.title}
        </h1>
        <div className="grid grid-cols-2 gap-5" style={{ width: 560 }}>
          {spec.quads.map((q, i) => {
            const isDestaque = q === spec.destaque;
            return (
              <div
                key={q}
                {...entrance(100 + i * 90)}
                className="rounded-2xl border flex items-center justify-center font-black tracking-wide"
                style={{
                  height: 150, fontSize: 34,
                  color: isDestaque ? "#0a0a0a" : "#fff",
                  background: isDestaque ? spec.accent : "rgba(255,255,255,0.05)",
                  borderColor: isDestaque ? spec.accent : "rgba(255,255,255,0.12)",
                }}
              >
                {q}
              </div>
            );
          })}
        </div>
      </Frame>
    );
  }

  // tabela
  return (
    <SlideLayout section={spec.section} padding="32px 72px">
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <h1 {...entrance(0)} className="font-black text-white tracking-tight text-center" style={{ fontSize: 40 }}>{spec.title}</h1>
        {spec.subtitle && <p {...entrance(60)} className="text-zinc-400 font-semibold mt-1.5 mb-5" style={{ fontSize: 18 }}>{spec.subtitle}</p>}
        {!spec.subtitle && <div className="mb-5" />}
        <div {...entrance(120)} className="w-full max-w-[900px] rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-left" style={{ fontSize: 21 }}>
            <thead>
              <tr className="bg-white/[0.06]">
                {spec.cols.map((c, i) => (
                  <th key={c} className={`px-7 py-2.5 font-bold uppercase tracking-wider text-zinc-300 ${i > 0 ? "text-right" : ""}`} style={{ fontSize: 14 }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spec.rows.map((row, ri) => {
                const hot = spec.highlightFrom !== undefined && ri >= spec.highlightFrom;
                return (
                  <tr key={ri} className="border-t border-white/[0.06]" style={hot ? { background: `${spec.accent}14` } : undefined}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-7 py-2.5 tabular-nums ${ci === 0 ? "font-bold" : "text-right font-semibold"}`}
                        style={{ color: ci === 0 ? (hot ? spec.accent : "#fff") : hot ? spec.accent : "#e4e4e7" }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SlideLayout>
  );
}
