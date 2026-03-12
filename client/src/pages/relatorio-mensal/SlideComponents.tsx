import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";
import { SECTION_THEMES, type SlideSection } from "./SlideLayout";

/* ─────────────── SlideHeader ─────────────── */

interface SlideHeaderProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  subtitle?: string;
  badge?: string;
  gradientColor: string;
}

export function SlideHeader({ icon: Icon, iconColor, title, subtitle, badge, gradientColor }: SlideHeaderProps) {
  return (
    <div className="shrink-0 mb-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-white/10 p-2 rounded-lg">
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && <span className="text-sm text-zinc-500 ml-1">{subtitle}</span>}
        {badge && (
          <span className="text-sm bg-white/[0.06] border border-white/10 text-zinc-300 rounded-full px-3 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <div className="h-px" style={{ background: `linear-gradient(to right, ${gradientColor}66, transparent)` }} />
    </div>
  );
}

/* ─────────────── MetricCard ─────────────── */

interface MetricCardProps {
  icon?: LucideIcon;
  label: string;
  value: string;
  accent?: string;
  borderColor?: string;
}

export function MetricCard({ icon: Icon, label, value, accent, borderColor }: MetricCardProps) {
  return (
    <div
      className="flex items-center gap-4 bg-white/[0.04] border border-white/[0.06] rounded-xl px-5 py-4"
      style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
    >
      {Icon && (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ? accent.replace("text-", "bg-").replace("400", "500/15") : "bg-zinc-700/30"}`}>
          <Icon className={`h-5 w-5 ${accent || "text-zinc-400"}`} />
        </div>
      )}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold ${accent || "text-white"}`}>{value}</p>
      </div>
    </div>
  );
}

/* ─────────────── PrimaryCard ─────────────── */

interface PrimaryCardProps {
  children: ReactNode;
  borderColor?: string;
  className?: string;
}

export function PrimaryCard({ children, borderColor, className = "" }: PrimaryCardProps) {
  return (
    <div
      className={`bg-white/[0.04] border-2 rounded-2xl p-6 shadow-lg shadow-black/20 ${className}`}
      style={{ borderColor: borderColor ? `${borderColor}30` : "rgba(255,255,255,0.08)" }}
    >
      {children}
    </div>
  );
}

/* ─────────────── SecondaryCard ─────────────── */

interface SecondaryCardProps {
  children: ReactNode;
  className?: string;
  borderColor?: string;
}

export function SecondaryCard({ children, className = "", borderColor }: SecondaryCardProps) {
  return (
    <div
      className={`bg-white/[0.04] border border-white/[0.08] rounded-xl shadow-lg shadow-black/20 ${className}`}
      style={borderColor ? { borderColor: `${borderColor}25` } : undefined}
    >
      {children}
    </div>
  );
}

/* ─────────────── ChartCard ─────────────── */

interface ChartCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, children, className = "" }: ChartCardProps) {
  return (
    <div className={`bg-white/[0.04] border border-white/[0.08] rounded-xl shadow-lg shadow-black/20 p-3 flex flex-col ${className}`}>
      {title && <p className="text-sm font-bold text-zinc-300 mb-2">{title}</p>}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/* ─────────────── SectionCover ─────────────── */

interface SectionCoverProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  section: SlideSection;
}

export function SectionCover({ icon: Icon, title, subtitle, section }: SectionCoverProps) {
  const theme = SECTION_THEMES[section];

  return (
    <div className="flex flex-col items-center gap-6">
      <img src={turboLogo} alt="Turbo Partners" className="h-10 object-contain opacity-50" />

      {/* Icon with glow */}
      <div
        className="p-5 rounded-2xl bg-white/10"
        style={{ boxShadow: `0 0 50px ${theme.glow1}40, 0 0 100px ${theme.glow1}15` }}
      >
        <Icon className="h-16 w-16" style={{ color: theme.accent }} />
      </div>

      <h1 className="text-5xl font-black tracking-tight">{title}</h1>
      <p className="text-lg text-zinc-400">{subtitle}</p>

      {/* Diagonal stripe */}
      <div
        className="absolute top-0 right-0 w-48 h-48 opacity-[0.04]"
        style={{
          background: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 8px,
            ${theme.accent} 8px,
            ${theme.accent} 10px
          )`,
        }}
      />
    </div>
  );
}

/* ─────────────── ProgressBar ─────────────── */

interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: "BRL" | "PCT";
  color: string;
}

export function ProgressBar({ label, current, target, unit = "BRL", color }: ProgressBarProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const formatValue = (v: number) => {
    if (unit === "PCT") return `${v.toFixed(1)}%`;
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-zinc-200 font-medium">{label}</span>
        <span className="text-xs text-zinc-500">
          {formatValue(current)} / {formatValue(target)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-end mt-1">
        <span className="text-xs font-bold" style={{ color }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/* ─────────────── SlideFooter ─────────────── */

interface SlideFooterProps {
  text?: string;
}

export function SlideFooter({ text }: SlideFooterProps) {
  return (
    <div className="shrink-0 flex items-center justify-between mt-auto pt-3">
      {text && <span className="text-xs text-zinc-600">{text}</span>}
      <img src={turboLogo} alt="Turbo" className="h-4 object-contain opacity-20 ml-auto" />
    </div>
  );
}
