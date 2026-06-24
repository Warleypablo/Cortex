# Reporte Mensal Visual Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish visual consistency, legibility, and impact across all 19 slides of the monthly report presentation.

**Architecture:** Incremental changes to existing slide components — no structural redesign. Foundation components (SlideComponents.tsx) are updated first, then individual slides adopt the changes. All changes are CSS/Tailwind only.

**Tech Stack:** React, Tailwind CSS, Recharts, Lucide icons

---

### Task 1: Foundation — Padronizar SecondaryCard e PrimaryCard

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideComponents.tsx`

**Step 1: Update SecondaryCard padding**

Change SecondaryCard default padding to `p-4` and ensure consistent border:

```tsx
export function SecondaryCard({ children, className = "", borderColor }: SecondaryCardProps) {
  return (
    <div
      className={`bg-white/[0.04] border border-white/[0.08] rounded-xl shadow-lg shadow-black/20 p-4 ${className}`}
      style={borderColor ? { borderColor: `${borderColor}25` } : undefined}
    >
      {children}
    </div>
  );
}
```

**Step 2: Update MetricCard to use text-sm minimum**

Replace `text-xs text-zinc-500` label with `text-xs` (already minimum). Ensure value is `text-xl`:

No change needed — MetricCard already uses `text-xs` label and `text-xl` value. ✓

**Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideComponents.tsx
git commit -m "style(slides): standardize SecondaryCard padding to p-4"
```

---

### Task 2: Foundation — SectionCover com mais presença

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideComponents.tsx`

**Step 1: Enhance SectionCover**

Update the SectionCover component — bigger icon, pulsing glow, larger title, decorative line:

```tsx
export function SectionCover({ icon: Icon, title, subtitle, section }: SectionCoverProps) {
  const theme = SECTION_THEMES[section];

  return (
    <div className="flex flex-col items-center gap-6">
      <img src={turboLogo} alt="Turbo Partners" className="h-10 object-contain opacity-50" />

      {/* Icon with animated glow */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-2xl animate-pulse"
          style={{ boxShadow: `0 0 60px ${theme.glow1}50, 0 0 120px ${theme.glow1}20`, opacity: 0.6 }}
        />
        <div
          className="relative p-6 rounded-2xl bg-white/10"
          style={{ boxShadow: `0 0 50px ${theme.glow1}40, 0 0 100px ${theme.glow1}15` }}
        >
          <Icon className="h-20 w-20" style={{ color: theme.accent }} />
        </div>
      </div>

      <h1 className="text-6xl font-black tracking-tight">{title}</h1>
      <p className="text-lg text-zinc-400">{subtitle}</p>

      {/* Decorative line below subtitle */}
      <div
        className="h-px w-48"
        style={{ background: `linear-gradient(to right, transparent, ${theme.accent}66, transparent)` }}
      />

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
```

**Step 2: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideComponents.tsx
git commit -m "style(slides): enhance SectionCover with animated glow and larger presence"
```

---

### Task 3: SlideEncerramento e SlideFraseEncerramento — efeito cinematográfico

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideEncerramento.tsx`
- Modify: `client/src/pages/relatorio-mensal/SlideFraseEncerramento.tsx`

**Step 1: Enhance SlideEncerramento**

Make the closing title larger and more impactful:

```tsx
export default function SlideEncerramento() {
  return (
    <SlideLayout section="closing" showLogo={false} padding="24px 32px">
      <div className="flex-1 flex flex-col items-center justify-center">
        <img
          src={teamPhoto}
          alt="Time Turbo Partners"
          style={{ maxWidth: "85%", maxHeight: "calc(100% - 120px)", objectFit: "contain", borderRadius: "16px" }}
        />
        <h2 className="mt-8 text-5xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
          Vamos com Turbo!
        </h2>
      </div>
    </SlideLayout>
  );
}
```

**Step 2: Enhance SlideFraseEncerramento**

Add spotlight glow effect behind the text:

```tsx
export default function SlideFraseEncerramento() {
  return (
    <SlideLayout section="closing" showLogo={false} padding="0">
      <div className="flex-1 relative">
        <img
          src={fotoEncerramento}
          alt="Turbo Partners"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Stronger vignette for spotlight effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center bottom, transparent 30%, rgba(0,0,0,0.6) 100%)",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-10 text-center">
          <div className="px-10 py-8 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/[0.08] max-w-3xl mx-auto">
            <p className="text-2xl leading-relaxed italic font-light">
              <span className="bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
                "Voce sonha grande, e inconformado e por isso melhora todos os dias,
                pensando como dono e fazendo o que tem que ser feito,
                voce tera o que merece!"
              </span>
            </p>
            <p className="text-base text-zinc-400 mt-5 font-medium">— Queiroz, Musso</p>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
```

**Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideEncerramento.tsx client/src/pages/relatorio-mensal/SlideFraseEncerramento.tsx
git commit -m "style(slides): cinematic closing slides with spotlight and gradient text"
```

---

### Task 4: SlideTurboMetrics — eliminar text-[10px], layout 4 colunas

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx`

**Step 1: Reorganize top grid from 5 to 4 columns**

Merge CXCS cross-sell data into the MRR Add/Cancel card. Remove standalone CXCS card. Change all `text-[10px]` to `text-xs`.

Key changes:
- `grid grid-cols-5` → `grid grid-cols-4`
- All `text-[10px]` → `text-xs`
- Merge cross-sell rows into the MRR Add/Cancel/Pausado card (it has vertical space)
- Remove the standalone CXCS card
- Keep the retencoes info as a small section inside the Faturamento card or create a 2-row layout in the MRR card

Replace the entire top grid section (line 81-209) with:

```tsx
      {/* Top row: 4 compact cards */}
      <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
        {/* Faturamento */}
        <SecondaryCard className="p-4 flex flex-col justify-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Faturamento Mes</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-400">Fixo:</span>
              <span className="text-sm font-bold text-emerald-400">{fmtBRL(metrics.mrrAtivo)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-zinc-400">Variavel:</span>
              <span className="text-sm font-bold text-amber-400">{fmtBRL(faturamentoVariavel)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-xs text-zinc-400">Pont:</span>
              <span className="text-sm font-bold text-purple-400">{fmtBRL(faturamentoPontual)}</span>
            </div>
          </div>
          <div className="mt-2 bg-cyan-500/10 rounded px-2 py-1 inline-block">
            <span className="text-sm font-bold text-cyan-400">Total: {fmtBRL(faturamentoTotal)}</span>
          </div>
        </SecondaryCard>

        {/* Base */}
        <SecondaryCard className="p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-blue-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Base</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-500">Clientes</p>
              <p className="text-2xl font-black">{metrics.clientesAtivos}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Contratos</p>
              <p className="text-2xl font-black">{metrics.contratosAtivos}</p>
            </div>
          </div>
        </SecondaryCard>

        {/* MRR Add / Cancel / Pausado + Cross-sell */}
        <SecondaryCard className="p-4 flex flex-col justify-center">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-bold">Adicionado</span>
              </div>
              <span className="text-sm font-bold text-emerald-400">{fmtBRL(metrics.mrrAdicionado)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs text-red-400 font-bold">Cancelados</span>
              </div>
              <span className="text-sm font-bold text-red-400">{fmtBRL(metrics.churnMrr)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pause className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-amber-400 font-bold">Pausados</span>
              </div>
              <span className="text-sm font-bold text-amber-400">{fmtBRL(metrics.pausadosMrr)}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 mt-1 space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Cross Rec:</span>
                <span className="text-xs font-bold text-emerald-400">{fmtBRL(metrics.crosssellMrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Cross Pont:</span>
                <span className="text-xs font-bold text-purple-400">{fmtBRL(metrics.crosssellPontual)}</span>
              </div>
            </div>
          </div>
        </SecondaryCard>

        {/* Ticket Medio + Retencoes */}
        <SecondaryCard className="p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-zinc-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Ticket Medio</p>
          </div>
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Contrato:</span>
              <span className="text-sm font-bold">{fmtBRL(metrics.ticketMedioContrato)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Cliente:</span>
              <span className="text-sm font-bold">{fmtBRL(metrics.ticketMedioCliente)}</span>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-2 space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Handshake className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-purple-400 font-bold">CXCS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-400">Solicit.:</span>
              <span className="text-xs font-bold text-red-400">
                {metrics.retencoesSolicitacoesCount} ({fmtBRL(metrics.retencoesSolicitacoesValor)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-400">Retido:</span>
              <span className="text-xs font-bold text-emerald-400">
                {metrics.retencoesCount} ({retencaoPct}%)
              </span>
            </div>
          </div>
        </SecondaryCard>
      </div>
```

**Step 2: Fix remaining text-[10px] in the bottom section**

In the MRR Ativo card (bottom right), change:
- `text-[10px]` → `text-xs`
- `text-[7px]` → `text-[9px]` (bar chart micro labels - acceptable since they're decorative)
- `text-[6px]` → `text-[8px]` (vertical bar labels)

In the Meta Churn card:
- `text-[10px]` → `text-xs`

**Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx
git commit -m "style(slides): TurboMetrics 4-col layout, merge CXCS, eliminate tiny fonts"
```

---

### Task 5: SlideGraficoContratos — eliminar text-[10px] e text-[9px]

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideGraficoContratos.tsx`

**Step 1: Replace all tiny font sizes**

Find and replace across the file:
- `text-[10px]` → `text-xs` (all instances: labels like "Total de Contratos", "Receita Total", "Recorrente", "Pontual", etc.)
- `text-[9px]` → `text-xs` (chart legend labels "MRR", "Pontual")

**Step 2: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideGraficoContratos.tsx
git commit -m "style(slides): eliminate text-[10px] and text-[9px] from GraficoContratos"
```

---

### Task 6: SlideAreaTech — eliminar text-[9px]

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideAreaTech.tsx`

**Step 1: Replace tiny font sizes**

- `text-[9px]` → `text-xs` (chart legend tipo labels, lines 177 and 255)

**Step 2: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideAreaTech.tsx
git commit -m "style(slides): eliminate text-[9px] from AreaTech legends"
```

---

### Task 7: SlideTurboCommerce — eliminar text-[10px]

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideTurboCommerce.tsx`

**Step 1: Replace tiny font**

- Line 136: `text-[10px]` → `text-xs` (progress percentage label)

**Step 2: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideTurboCommerce.tsx
git commit -m "style(slides): eliminate text-[10px] from TurboCommerce"
```

---

### Task 8: Transições e micro-animações

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideComponents.tsx`

**Step 1: Add transitions to cards and progress bars**

Add `transition-all duration-300 ease-out` to SecondaryCard and PrimaryCard.

Update ProgressBar to animate bar width:

In ProgressBar, change the inner bar div to:
```tsx
<div
  className="h-full rounded-full transition-[width] duration-700 ease-out"
  style={{ width: `${pct}%`, backgroundColor: color }}
/>
```

**Step 2: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideComponents.tsx
git commit -m "style(slides): add CSS transitions to cards and progress bars"
```

---

### Task 9: SlideRankingSquads — alinhar com padrão de ranking

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideRankingSquads.tsx`

**Step 1: Unify ranking medal colors**

Add medal colors consistent with Closers/SDRs:

```tsx
const MEDAL_COLORS: Record<number, { ring: string; text: string }> = {
  1: { ring: "#f59e0b", text: "text-amber-400" },
  2: { ring: "#a1a1aa", text: "text-zinc-300" },
  3: { ring: "#f97316", text: "text-orange-400" },
  4: { ring: "#71717a", text: "text-zinc-400" },
  5: { ring: "#71717a", text: "text-zinc-400" },
};
```

Apply medal ring color to squad icon circle border (override squad-specific color for positions 1-3 to use standard medals), and use medal text color for position number instead of white.

**Step 2: Add glow effect to 1st place**

Add a Crown icon import and render above 1st place squad (consistent with Closers/SDRs):

```tsx
import { Crown } from "lucide-react";
// In the podium render for position 1:
{isFirst && <Crown className="text-amber-400 mb-2" style={{ width: 36, height: 36 }} />}
```

**Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideRankingSquads.tsx
git commit -m "style(slides): unify squad ranking with medal colors and crown icon"
```

---

### Task 10: Verificação final e cleanup

**Step 1: Search for remaining text-[10px] and text-[9px]**

```bash
grep -rn "text-\[10px\]\|text-\[9px\]" client/src/pages/relatorio-mensal/
```

Fix any remaining instances.

**Step 2: Visual test**

- `npm run dev`
- Navigate to `/reports/mensal`
- Check each slide in both editor and presentation mode
- Verify all text is legible
- Verify card styles are consistent
- Verify section covers have enhanced presence

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "style(slides): final cleanup of tiny font remnants"
```
