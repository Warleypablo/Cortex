import type { ReactNode } from "react";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

export type SlideSection = "intro" | "people" | "comercial" | "commerce" | "tech" | "closing";

const SECTION_THEMES: Record<SlideSection, { glow1: string; glow2: string; accent: string }> = {
  intro:     { glow1: "#7c3aed", glow2: "#6366f1", accent: "#a78bfa" },
  people:    { glow1: "#ec4899", glow2: "#8b5cf6", accent: "#f472b6" },
  comercial: { glow1: "#f59e0b", glow2: "#f97316", accent: "#fbbf24" },
  commerce:  { glow1: "#06b6d4", glow2: "#3b82f6", accent: "#22d3ee" },
  tech:      { glow1: "#3b82f6", glow2: "#06b6d4", accent: "#60a5fa" },
  closing:   { glow1: "#7c3aed", glow2: "#06b6d4", accent: "#a78bfa" },
};

interface Props {
  section: SlideSection;
  children: ReactNode;
  showLogo?: boolean;
  showGrid?: boolean;
  padding?: string;
  className?: string;
}

export default function SlideLayout({
  section,
  children,
  showLogo = true,
  showGrid = true,
  padding = "32px 40px",
  className = "",
}: Props) {
  const theme = SECTION_THEMES[section];

  return (
    <div
      className="w-full h-full flex flex-col text-white relative overflow-hidden"
      style={{
        padding,
        background: "linear-gradient(145deg, #060511 0%, #0e0a24 30%, #150f35 50%, #0e0a24 75%, #060511 100%)",
      }}
    >
      {/* Glow 1 - top right */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.12]"
        style={{ background: `radial-gradient(circle, ${theme.glow1} 0%, transparent 70%)` }}
      />
      {/* Glow 2 - bottom left */}
      <div
        className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-[0.08]"
        style={{ background: `radial-gradient(circle, ${theme.glow2} 0%, transparent 70%)` }}
      />
      {/* Grid overlay */}
      {showGrid && (
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      )}
      {/* Accent line - left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{
          background: `linear-gradient(to bottom, ${theme.accent}40, ${theme.accent}10, transparent)`,
        }}
      />
      {/* Geometric corner - top right */}
      <div
        className="absolute top-0 right-0 w-24 h-24"
        style={{
          borderRight: `2px solid ${theme.accent}18`,
          borderTop: `2px solid ${theme.accent}18`,
        }}
      />
      {/* Geometric corner - bottom left */}
      <div
        className="absolute bottom-0 left-0 w-16 h-16"
        style={{
          borderLeft: `2px solid ${theme.accent}18`,
          borderBottom: `2px solid ${theme.accent}18`,
        }}
      />

      {/* Content */}
      <div className={`relative z-10 flex flex-col flex-1 min-h-0 ${className}`}>
        {children}
      </div>

      {/* Footer logo */}
      {showLogo && (
        <img
          src={turboLogo}
          alt="Turbo"
          className="absolute bottom-3 right-4 h-5 object-contain opacity-20 z-10"
        />
      )}
    </div>
  );
}

export { SECTION_THEMES };
