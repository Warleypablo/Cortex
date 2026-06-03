---
name: Squad Slides Individuais — Reporte Mensal
description: Substitui o grid de squads (SlideSquadDetails) por slides individuais dinâmicos, um por squad, com 4 KPIs proeminentes (MRR Ativo, Pontual Entregue, Churn, Evolução MRR)
type: project
---

# Squad Slides Individuais — Reporte Mensal

## Contexto

O slide "Squad Details" (posição 13, `case 13` em `renderFixedSlide`) atualmente mostra todas as squads em um grid de até 6 cards por slide. O objetivo é substituí-lo por slides individuais — cada squad ocupa um slide inteiro, navegando com a seta normal da apresentação.

## Objetivo

- Cada squad = um slide próprio, com 4 métricas grandes e visualmente proeminentes
- Navegação: clique/seta avança para o próximo squad (e depois para o slide seguinte normal)
- Métricas exibidas: **MRR Ativo**, **Pontual Entregue**, **Churn**, **Evolução MRR**
- Zero novas queries — todos os campos já existem em `SquadDetail`

## Componente: SlideSquadSingle.tsx

**Arquivo:** `client/src/pages/relatorio-mensal/SlideSquadSingle.tsx`

**Props:**
```ts
interface Props {
  squad: SquadDetail;
  mesLabel: string;
}
```

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ [LayoutGrid]  🌿 SELVA — Abril 2026                      │
│               (cor da squad como gradientColor)          │
├─────────────┬───────────────┬────────────┬──────────────┤
│  MRR Ativo  │ Pontual       │  Churn     │ Evolução MRR │
│  R$ 85k     │ Entregue      │  2,1%      │ +R$ 3.200    │
│  (cor squad)│ R$ 12k        │  verde/vm  │  verde/vm    │
│             │ (cyan)        │ subtítulo  │              │
└─────────────┴───────────────┴────────────┴──────────────┘
```

- `SlideLayout section="commerce"` padding `28px 36px`
- `SlideHeader`:
  - `icon={LayoutGrid}`
  - `iconColor` = a cor da squad (hex inline via style, ou classe Tailwind mais próxima)
  - `title` = `{emoji} {NOME} — {mesLabel}` (nome em maiúsculas)
  - `gradientColor` = cor da squad
- **4 `SecondaryCard`s** em `grid-cols-4 gap-4`, ocupando o espaço disponível:
  1. **MRR Ativo** — `text-2xl font-black` na cor da squad; sem subtítulo
  2. **Pontual Entregue** — `text-2xl font-black text-cyan-400`; sem subtítulo
  3. **Churn** — `text-2xl font-black` semáforo (`#22c55e` se <8%, `#ef4444` se ≥8%); subtítulo: `{fmtBRL(churnBrl)} / {fmtBRL(mrrBase)}`
  4. **Evolução MRR** — `text-2xl font-black` semáforo (verde se ≥0, vermelho se <0); prefixo `+` ou `−`; subtítulo: `{squad.clientes} cliente(s)`

**Paleta SQUAD_COLORS** — idêntica à existente em `SlideSquadDetails.tsx` (copiar). Função `parseSquadName` e `getColor` também copiadas do mesmo arquivo.

## Arquitetura em RelatorioMensal.tsx

### 1. Extensão de SlotEntry

```ts
type SlotEntry =
  | { type: "fixed"; fixedIndex: number; name: string }
  | { type: "custom"; data: CustomSlide }
  | { type: "squad"; squadIndex: number; name: string }; // NOVO
```

### 2. buildSlotArray recebe squadDetails

```ts
function buildSlotArray(customSlides: CustomSlide[], squadDetails: SquadDetail[]): SlotEntry[]
```

Quando `i === 13`, em vez de inserir o slot fixo "Squad Details", inserir N slots de squad:
```ts
if (i === 13) {
  for (let s = 0; s < squadDetails.length; s++) {
    const { emoji, name } = parseSquadNameMinimal(squadDetails[s].squad);
    const label = emoji ? `${emoji} ${name}` : name;
    slots.push({ type: "squad", squadIndex: s, name: label });
  }
  // custom slides posicionados em 13 entram após os squad slots
} else {
  slots.push({ type: "fixed", fixedIndex: i, name: FIXED_SLIDE_NAMES[i] });
}
```

`parseSquadNameMinimal` é uma função inline simples (não importar de SlideSquadDetails, que será deletado):
```ts
function parseSquadNameMinimal(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  return { emoji: "", name: trimmed };
}
```

### 3. useMemo de slots

```ts
const slots = useMemo(
  () => buildSlotArray(customSlides, data?.squadDetails ?? []),
  [customSlides, data?.squadDetails]
);
```

### 4. slideNames

```ts
const slideNames = useMemo(
  () => slots.map(s =>
    s.type === "fixed" ? s.name :
    s.type === "squad"  ? s.name :
    (s.data.titulo || "Slide Custom")
  ),
  [slots]
);
```

### 5. renderSlide — tratar slot de squad

No bloco `renderSlide()`, antes do `return renderFixedSlide(...)`:
```ts
if (slot.type === "squad") {
  return <SlideSquadSingle squad={data.squadDetails[slot.squadIndex]} mesLabel={data.mesDadosLabel} />;
}
```

### 6. Import

Adicionar `import SlideSquadSingle from "./relatorio-mensal/SlideSquadSingle"` e remover `import SlideSquadDetails`.

## Arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `client/src/pages/relatorio-mensal/SlideSquadSingle.tsx` | create | Novo componente single-squad |
| `client/src/pages/relatorio-mensal/SlideSquadDetails.tsx` | delete | Grid substituído |
| `client/src/pages/RelatorioMensal.tsx` | edit | SlotEntry, buildSlotArray, useMemo slots, slideNames, renderSlide, imports |

## Comportamento de borda

- `squadDetails` vazio → posição 13 não insere nenhum slot; deck vai direto para slide 14 (Ranking Squads)
- `mrrBase = 0` → Churn exibe `R$ 0 / R$ 0` (não divide por zero — `churnPct` já vem calculado do backend)
- Squad sem emoji → exibe só o nome, sem espaço extra
- Squads com sufixo `(OFF)` → `getColor` já trata via regex `replace(/\s*\(OFF\)\s*$/i, "")`
