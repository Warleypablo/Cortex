# 🎨 Design System — Turbo Cortex

> Fonte da verdade visual da plataforma **Turbo Cortex** (uso interno Turbo Partners).
> Este documento é gerado a partir do **código real** (`client/src/index.css`, `tailwind.config.ts`, `components/ui/*`), não de intenções de design. Ao construir uma tela nova, siga este guia.
>
> ⚠️ O arquivo legado `design_guidelines.md` (raiz) está **desatualizado** (descreve paleta azul antiga + Chart.js). **Ignore-o.** Esta é a referência vigente.

---

## 1. Fundamentos

| Item | Valor |
|------|-------|
| **Produto** | Turbo Cortex — plataforma interna de gestão (clientes, contratos, faturamento, métricas) |
| **Identidade** | Preto + Azul Marinho (light) · Azul vibrante sobre fundo quase-preto (dark) |
| **Stack UI** | shadcn/ui (estilo `new-york`, baseColor `neutral`) + Radix Primitives |
| **Estilização** | Tailwind CSS (`darkMode: ["class"]`), tokens via CSS variables HSL |
| **Fonte** | **Poppins** (Google Fonts — 400/500/600/700) |
| **Ícones** | `lucide-react` |
| **Gráficos** | **Recharts** (não Chart.js) |
| **Animação** | `framer-motion` + `tailwindcss-animate` |
| **Variantes** | `class-variance-authority` (CVA) |
| **Merge de classes** | `cn()` = `twMerge(clsx(...))` — de `@/lib/utils` |
| **Theme-color (mobile)** | `#f97316` (laranja Turbo) |

### Aliases de import (`components.json`)
```
@/components   @/components/ui   @/lib   @/lib/utils   @/hooks
```

---

## 2. Cor — Tokens semânticos

As cores **nunca** são hardcoded. Elas vivem como CSS variables HSL em `client/src/index.css` (`:root` = light, `.dark` = dark) e são expostas ao Tailwind via `tailwind.config.ts`. Use sempre a **classe semântica** (`bg-primary`, `text-muted-foreground`, `border-card-border`…), não o valor cru.

> Formato dos tokens: `H S% L%` (ex.: `221 45% 18%`). O Tailwind aplica via `hsl(var(--token) / <alpha-value>)`, então `bg-primary/50` funciona.

### 2.1 Paleta base

| Token | Light (`:root`) | Dark (`.dark`) | Uso |
|-------|-----------------|----------------|-----|
| `background` | `220 15% 96%` | `222 30% 5%` | Fundo da página |
| `foreground` | `221 40% 12%` | `210 20% 95%` | Texto principal |
| `border` | `218 20% 88%` | `219 25% 16%` | Bordas gerais (aplicada em `*` via `@layer base`) |
| `input` | `218 15% 84%` | `219 20% 16%` | Bordas de campos de formulário |
| `ring` | `221 45% 18%` | `215 80% 55%` | Anel de foco (`focus-visible`) |
| **`card`** | `0 0% 100%` | `219 35% 10%` | Fundo de cards |
| `card-foreground` | `221 40% 12%` | `210 20% 92%` | Texto em cards |
| `card-border` | `218 20% 88%` | `219 25% 14%` | Borda de cards |
| **`primary`** | `221 45% 18%` (azul-marinho) | `215 80% 55%` (azul vibrante) | Ação principal, links, estados ativos |
| `primary-foreground` | `0 0% 100%` | `0 0% 100%` | Texto sobre primary |
| `secondary` | `218 15% 91%` | `219 20% 18%` | Botão/superfície secundária |
| `secondary-foreground` | `221 35% 20%` | `210 20% 95%` | Texto sobre secondary |
| `muted` | `218 15% 94%` | `219 20% 13%` | Superfície neutra |
| `muted-foreground` | `218 12% 45%` | `215 15% 55%` | Texto de apoio/labels/metadados |
| `accent` | `218 30% 93%` | `217 35% 16%` | Realce sutil / hover de itens |
| `accent-foreground` | `221 40% 22%` | `215 65% 80%` | Texto sobre accent |
| **`destructive`** | `0 72% 51%` | `0 75% 55%` | Erro, exclusão, alerta crítico |
| `destructive-foreground` | `0 0% 100%` | `0 0% 100%` | Texto sobre destructive |
| `popover` / `popover-foreground` / `popover-border` | branco / `221 40% 12%` / `218 20% 88%` | `222 30% 6%` / `210 20% 95%` / `219 25% 14%` | Popovers, dropdowns, tooltips |

### 2.2 Sidebar (namespace próprio)

| Token | Light | Dark |
|-------|-------|------|
| `sidebar` | `0 0% 100%` | `222 35% 4%` |
| `sidebar-foreground` | `221 40% 12%` | `210 15% 88%` |
| `sidebar-border` | `218 20% 90%` | `219 30% 12%` |
| `sidebar-primary` | `221 45% 18%` | `215 80% 55%` |
| `sidebar-accent` | `218 30% 93%` | `219 35% 14%` |
| `sidebar-accent-foreground` | `221 40% 18%` | `215 65% 80%` |
| `sidebar-ring` | `221 45% 18%` | `215 80% 55%` |

### 2.3 Cores de status (RGB fixo, iguais nos 2 temas)

Expostas como `bg-status-online`, `text-status-busy`, etc.

| Token | Valor | Semântica |
|-------|-------|-----------|
| `status.online` | `rgb(34 197 94)` 🟢 | Ativo / OK |
| `status.away` | `rgb(245 158 11)` 🟠 | Ausente / atenção |
| `status.busy` | `rgb(239 68 68)` 🔴 | Ocupado / crítico |
| `status.offline` | `rgb(156 163 175)` ⚪ | Offline / inativo |

### 2.4 Cores de gráfico (`chart-1`…`chart-5`)

Diferem entre temas (dark usa hues mais saturados). Use `hsl(var(--chart-N))` ou a classe `text-chart-N`/`fill-chart-N`.

| Token | Light | Dark |
|-------|-------|------|
| `chart-1` | `221 45% 18%` (marinho) | `215 80% 55%` (azul) |
| `chart-2` | `217 46% 33%` (azul médio) | `265 70% 55%` (roxo) |
| `chart-3` | `160 84% 39%` (verde) | `160 80% 48%` (verde) |
| `chart-4` | `43 96% 56%` (âmbar) | `38 95% 55%` (âmbar) |
| `chart-5` | `340 75% 55%` (rosa) | `340 80% 58%` (rosa) |

### 2.5 Paleta de Squads — `@/lib/squadColors`

Cores fixas (hex) por squad, **centralizadas** em `client/src/lib/squadColors.ts`. Múltiplos dashboards reutilizam. **Nunca** redefina cores de squad localmente — importe `getSquadColor()`.

```ts
import { getSquadColor, SQUAD_COLORS } from "@/lib/squadColors";

// Sempre com fallback determinístico por índice:
const cor = getSquadColor(nomeSquad, index);
```

| Squad | Hex | | Squad | Hex |
|-------|-----|---|-------|-----|
| Aura | `#14b8a6` | | Olimpo | `#f97316` |
| Aurea | `#fbbf24` | | Pulse | `#ec4899` |
| Black | `#475569` | | Selva | `#22c55e` |
| Bloomfield | `#10b981` | | Squadra | `#3b82f6` |
| Chama | `#f43f5e` | | Squad X | `#6366f1` |
| Hunters | `#a855f7` | | Supreme | `#8b5cf6` |
| Makers | `#06b6d4` | | Tech | `#0ea5e9` |
| Turbo Interno | `#94a3b8` | | *(variantes `(OFF)` = tom mais claro)* | |

Fallback (squad desconhecido, ciclado por índice): `#06b6d4 #8b5cf6 #22c55e #f59e0b #ec4899 #3b82f6 #10b981 #f43f5e #6366f1 #14b8a6`.

---

## 3. Tipografia

**Poppins** para tudo (`--font-sans`, `--font-serif` e sans apontam para Poppins; `--font-mono` = Menlo). Carregada via `<link>` no `client/index.html`.

| Peso | Uso |
|------|-----|
| 400 Regular | Corpo de texto |
| 500 Medium | Labels, botões, UI |
| 600 Semibold | Títulos, cabeçalhos, `CardTitle` |
| 700 Bold | Números de destaque (KPIs) |

### Escala em uso (valores reais dos componentes)

| Elemento | Classe | Observação |
|----------|--------|------------|
| Título de card | `text-2xl font-semibold leading-none tracking-tight` | `<CardTitle>` |
| Título de KPI | `text-base font-semibold text-foreground` | `KpiCardGrid` |
| **Valor de KPI** | `text-2xl font-bold tracking-tight` | número principal |
| Descrição / subtítulo | `text-sm text-muted-foreground` | `<CardDescription>` |
| Metadado / caption | `text-xs text-muted-foreground` | legendas, labels |
| Texto de botão | `text-sm font-medium` (sm: `text-xs`) | ver §6.1 |

> Regra: texto de apoio usa **`text-muted-foreground`** (nunca `text-gray-*` cru). Títulos e valores usam `text-foreground`.

---

## 4. Espaçamento, Raio e Sombra

### Border radius (`tailwind.config.ts` + `--radius: 0.75rem`)
| Classe | Valor |
|--------|-------|
| `rounded-sm` | `0.25rem` (4px) |
| `rounded-md` | `0.5rem` (8px) — **raio padrão de botões/badges** |
| `rounded-lg` | `1rem` (16px) |
| `rounded-xl` | usado no `<Card>` |
| `rounded-full` | pills, avatares, dots de status |

### Espaçamento
- Base: `--spacing: 0.25rem` (grade de 4px). Use unidades Tailwind `1,2,3,4,5,6,8,12,16`.
- Card: `CardHeader`/`CardContent`/`CardFooter` = **`p-6`** (`pt-0` no content/footer).
- KPI card: `p-5`, `space-y-3`.
- Gaps de grid: `gap-4` a `gap-6`.

### Sombras (escala `--shadow-*`, mais intensa no dark)
`shadow-2xs` · `shadow-xs` · `shadow-sm` · `shadow` · `shadow-md` · `shadow-lg` · `shadow-xl` · `shadow-2xl`.
Cards usam `shadow-sm`. Botões `outline`/badges usam `shadow-xs`.

---

## 5. ⭐ Sistema "Elevate" (o diferencial deste DS)

Em vez de `hover:bg-*` manual, o Cortex usa um sistema de **elevação automática por overlay** (herdado do padrão Replit/shadcn). Um pseudo-elemento pinta uma camada translúcida (`--elevate-1` / `--elevate-2`) por cima do elemento — funciona igual em light e dark, e **compõe com bordas automaticamente**.

| Classe | Efeito |
|--------|--------|
| `hover-elevate` | Escurece/clareia sutil no hover (`--elevate-1`) |
| `active-elevate-2` | Realce mais forte no active/press (`--elevate-2`) |
| `toggle-elevate` + `toggle-elevated` | Estado "ligado" persistente (ex.: `data-[state=on]:toggle-elevated`) |
| `no-default-hover-elevate` / `no-default-active-elevate` | Escape hatch: desliga o elevate automático |

```tsx
// Botão custom que participa do sistema:
<div className="border rounded-md p-3 hover-elevate active-elevate-2">…</div>

// Toggle controlado por data-attribute do Radix:
<button className="toggle-elevate data-[state=on]:toggle-elevated">…</button>
```

Intensidades (`index.css`): light `--elevate-1: rgba(0,0,0,.03)` / `--elevate-2: rgba(0,0,0,.08)`; dark `rgba(255,255,255,.05)` / `.10`.
Os componentes `Button` e `Badge` já incluem `hover-elevate` por padrão.

> ⚠️ `hover-elevate` **não funciona** em elementos com `overflow:hidden` (o overlay é clipado).

---

## 6. Componentes

Todos os primitivos vivem em `client/src/components/ui/` (shadcn/Radix). Sempre importe deles — não recrie.

### 6.1 Button — `@/components/ui/button`
Base: `inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium … hover-elevate active-elevate-2`

| `variant` | Aparência |
|-----------|-----------|
| `default` | `bg-primary text-primary-foreground border-primary-border` |
| `destructive` | `bg-destructive …` |
| `outline` | borda `var(--button-outline)` + `shadow-xs` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `ghost` | transparente (borda invisível) |

| `size` | Altura |
|--------|--------|
| `default` | `min-h-9 px-4 py-2` |
| `sm` | `min-h-8 px-3 text-xs` |
| `lg` | `min-h-10 px-8` |
| `icon` | `h-9 w-9` |

> Alturas são **`min-h`** (não `h`) de propósito: o botão cresce se receber muito conteúdo. Suporta `asChild` (Radix Slot) para virar `<Link>` etc.

### 6.2 Badge — `@/components/ui/badge`
`rounded-md border px-2.5 py-0.5 text-xs font-semibold` + `hover-elevate`. Variantes: `default` (primary), `secondary`, `destructive`, `outline`. Nunca quebra linha (`whitespace-nowrap`).

Para badges de status coloridas (verde/vermelho suave), o padrão usado no `KpiCardGrid`:
```tsx
className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"  // positivo
className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"          // negativo
```

### 6.3 Card — `@/components/ui/card`
Composição: `Card` › `CardHeader` (`CardTitle` + `CardDescription`) › `CardContent` › `CardFooter`.
Base do `Card`: `rounded-xl border bg-card border-card-border text-card-foreground shadow-sm`.

### 6.4 Inventário de primitivos disponíveis
`accordion · alert · alert-dialog · aspect-ratio · avatar · badge · breadcrumb · button · calendar · card · carousel · chart · checkbox · collapsible · color-picker · command · context-menu · date-range-picker · dialog · drawer · dropdown-menu · form · hover-card · input · input-otp · label · menubar · month-year-picker · multi-select · navigation-menu · pagination · popover · progress · radio-group · resizable · scroll-area · select · select-with-add · separator · sheet · sidebar · skeleton · slider · switch · table · table-skeleton · tabs · textarea · toast/toaster · toggle · toggle-group · tooltip · virtualized-table · year-picker`

Extras "de produto": `kpi-card-grid`, `okr-badges`, `chart-tooltip`, `statistics-card-*`, `line-chart-interactive`, além de efeitos (`canvas-reveal-effect`, `web-gl-shader`, `cinematic-switch`).

> Select: sempre `@/components/ui/select`. Para tabelas grandes, `virtualized-table`. Para loading, `skeleton`/`table-skeleton`.

---

## 7. Gráficos (Recharts)

- Biblioteca oficial: **Recharts** (`recharts`). Séries usam `hsl(var(--chart-N))` ou `getSquadColor()`.
- O tooltip default do Recharts é **corrigido para dark mode globalmente** em `index.css` (`.recharts-tooltip-wrapper .recharts-default-tooltip` → `bg-card`, `border`, `card-foreground`). Não precisa reestilizar manualmente na maioria dos casos; para tooltip custom, use `@/components/ui/chart-tooltip`.
- Grade/eixos: derive de `--border` e `--muted-foreground` para acompanhar o tema.

---

## 8. Dark / Light mode — obrigatório

**Toda** tela deve funcionar nos dois temas. Estratégia:

- Provider próprio: `@/components/ThemeProvider` (não `next-themes` apesar de instalado). Alterna a classe `light`/`dark` no `<html>` e persiste em `localStorage("theme")`. Default: `light`.
- Hook: `const { theme, toggleTheme } = useTheme();`
- Nas classes: sempre forneça a variante `dark:` quando usar cor **não-semântica**. Tokens semânticos (`bg-card`, `text-foreground`, `text-muted-foreground`…) **já trocam sozinhos** — prefira-os.

```tsx
// ✅ Preferido — token semântico, troca automática:
<div className="bg-card text-foreground border-card-border">

// ✅ Aceitável — cor crua COM variante dark:
<span className="text-green-700 dark:text-green-400">

// ❌ Proibido — cor crua sem dark:, ou hardcode hex:
<div className="bg-[#ffffff]">
<span className="text-gray-900">
```

---

## 9. Utilitários & Formatadores

### `cn()` — merge de classes (`@/lib/utils`)
```tsx
import { cn } from "@/lib/utils";
className={cn("base", condicao && "extra", props.className)}
```

### Formatadores de moeda/número (`@/lib/utils`) — **sempre** usar, nunca formatar à mão
| Função | Saída |
|--------|-------|
| `formatCurrency(v)` | `R$ 1.234` (0–2 casas) |
| `formatCurrencyWithDecimals(v)` | `R$ 1.234,56` (2 casas fixas) |
| `formatCurrencyNoDecimals(v)` | `R$ 1.234` (0 casas) |
| `formatCurrencyCompact(v)` | `R$ 1,2K` / `R$ 3,4M` / `R$ 5B` |
| `formatCurrencyUSD(v)` | `$1,234` |
| `formatPercent(v)` | `10,5%` (máx 2 casas) |
| `formatDecimal(v)` | número com máx 2 casas, sem zeros à direita |

Todos tratam `null`/`undefined`/`NaN` retornando um zero seguro (`R$ 0`, `0%`, etc.).

### Scrollbar minimalista
Classe utilitária `scrollbar-minimal` (fina, translúcida, sem setas) para áreas roláveis.

---

## 10. Convenções de código (do CLAUDE.md)

- **TypeScript** em tudo; componentes React funcionais + hooks.
- **Nomenclatura**: Componentes `PascalCase` · funções `camelCase` · constantes `UPPER_SNAKE_CASE` · arquivos kebab-case ou PascalCase (componentes).
- Estado de servidor via **React Query**; roteamento via **wouter** (`import { Link } from "wouter"`).
- Arquivos > 500 linhas → avaliar extração de componentes.
- **Testar em light E dark** antes de considerar pronto.

---

## ✅ Checklist ao criar uma tela nova

- [ ] Usei tokens semânticos (`bg-card`, `text-muted-foreground`…) em vez de cores cruas?
- [ ] Toda cor crua tem variante `dark:`? Nenhum hex hardcoded?
- [ ] Importei primitivos de `@/components/ui/*` (não recriei)?
- [ ] Números/moeda via formatadores de `@/lib/utils`?
- [ ] Cores de squad via `getSquadColor()` (não redefinidas localmente)?
- [ ] Gráficos em Recharts com `hsl(var(--chart-N))`?
- [ ] Interações usam o sistema `hover-elevate`/`active-elevate-2` onde faz sentido?
- [ ] Testado nos dois temas?

---

*Gerado a partir de: `client/src/index.css`, `tailwind.config.ts`, `components.json`, `client/index.html`, `client/src/components/ui/{button,badge,card,kpi-card-grid}.tsx`, `client/src/lib/{utils,squadColors}.ts`.*
