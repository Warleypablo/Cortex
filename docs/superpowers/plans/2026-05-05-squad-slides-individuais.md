# Squad Slides Individuais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o grid de squads por slides individuais dinâmicos — cada squad ocupa um slide inteiro com 4 KPIs (MRR Ativo, Pontual Entregue, Churn, Evolução MRR), navegados pela seta normal da apresentação.

**Architecture:** Novo `SlideSquadSingle.tsx` exibe um `SquadDetail` por vez. `RelatorioMensal.tsx` estende `SlotEntry` com tipo `"squad"`, modifica `buildSlotArray` para receber `squadDetails` e substituir o slot fixo 13 por N slots dinâmicos. `SlideSquadDetails.tsx` (grid) é deletado.

**Tech Stack:** React, TypeScript, Tailwind CSS, SlideLayout/SlideHeader/SecondaryCard de `./SlideComponents`.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `client/src/pages/relatorio-mensal/SlideSquadSingle.tsx` | create | Slide individual de squad — 4 KPI cards |
| `client/src/pages/relatorio-mensal/SlideSquadDetails.tsx` | delete | Grid de squads (substituído) |
| `client/src/pages/RelatorioMensal.tsx` | modify | SlotEntry, buildSlotArray, useMemo, slideNames, renderSlide, imports |

---

## Task 1: Criar SlideSquadSingle.tsx

**Files:**
- Create: `client/src/pages/relatorio-mensal/SlideSquadSingle.tsx`

Contexto: Este componente substitui o grid. Exibe UMA squad por slide. O `SlideHeader` aceita `iconColor` como classe Tailwind (não hex), então usamos `"text-zinc-300"` para o ícone. A cor da squad vai em `gradientColor` (hex) e inline no valor do card MRR Ativo. `SecondaryCard` aceita `borderColor` como hex (internamente faz `${color}25`). A função `fmtBRL` formata valores em R$. Funções `parseSquadName` e `getColor` são copiadas de `SlideSquadDetails.tsx`.

- [ ] **Step 1: Criar o arquivo**

Criar `/Users/mac0267/Cortex/client/src/pages/relatorio-mensal/SlideSquadSingle.tsx` com este conteúdo exato:

```tsx
import { LayoutGrid } from "lucide-react";
import type { SquadDetail } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard } from "./SlideComponents";

interface Props {
  squad: SquadDetail;
  mesLabel: string;
}

const SQUAD_COLORS: Record<string, string> = {
  "Selva":         "#22c55e",
  "Squadra":       "#3b82f6",
  "Pulse":         "#ec4899",
  "Squad X":       "#6366f1",
  "Tech":          "#0ea5e9",
  "Makers":        "#06b6d4",
  "Hunters":       "#a855f7",
  "Chama":         "#f43f5e",
  "Aurea":         "#fbbf24",
  "Supreme":       "#8b5cf6",
  "Bloomfield":    "#10b981",
  "Black":         "#475569",
  "Ventures":      "#f59e0b",
  "Vendas":        "#f97316",
  "CX&CS":         "#14b8a6",
  "Nitro":         "#ef4444",
  "Turbo Interno": "#94a3b8",
};

function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  return { emoji: "", name: trimmed };
}

function getColor(baseName: string): string {
  if (SQUAD_COLORS[baseName]) return SQUAD_COLORS[baseName];
  const clean = baseName.replace(/\s*\(OFF\)\s*$/i, "").trim();
  return SQUAD_COLORS[clean] || "#71717a";
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

export default function SlideSquadSingle({ squad, mesLabel }: Props) {
  const { emoji, name } = parseSquadName(squad.squad);
  const color = getColor(name);
  const churnColor = squad.churnPct >= 8 ? "#ef4444" : "#22c55e";
  const evolColor = squad.evolucaoMrr >= 0 ? "#22c55e" : "#ef4444";
  const evolSign = squad.evolucaoMrr >= 0 ? "+" : "";
  const title = `${emoji ? emoji + " " : ""}${name.toUpperCase()} — ${mesLabel}`;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={LayoutGrid}
        iconColor="text-zinc-300"
        title={title}
        gradientColor={color}
      />

      <div className="flex-1 grid grid-cols-4 gap-4 min-h-0 content-start pt-2">
        {/* MRR Ativo */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2" borderColor={color}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">MRR Ativo</p>
          <p className="text-3xl font-black" style={{ color }}>{fmtBRL(squad.mrr)}</p>
          <p className="text-[11px] text-zinc-600">{squad.clientes} cliente{squad.clientes !== 1 ? "s" : ""}</p>
        </SecondaryCard>

        {/* Pontual Entregue */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Pontual Entregue</p>
          <p className="text-3xl font-black text-cyan-400">{fmtBRL(squad.pontual)}</p>
          <p className="text-[11px] text-zinc-600">{mesLabel}</p>
        </SecondaryCard>

        {/* Churn */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Churn</p>
          <p className="text-3xl font-black" style={{ color: churnColor }}>
            {squad.churnPct.toFixed(1).replace(".", ",")}%
          </p>
          <p className="text-[11px] text-zinc-600">
            {fmtBRL(squad.churnBrl)} / {fmtBRL(squad.mrrBase || 0)}
          </p>
        </SecondaryCard>

        {/* Evolução MRR */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Evolução MRR</p>
          <p className="text-3xl font-black" style={{ color: evolColor }}>
            {evolSign}{fmtBRL(squad.evolucaoMrr)}
          </p>
          <p className="text-[11px] text-zinc-600">vs. mês anterior</p>
        </SecondaryCard>
      </div>
    </SlideLayout>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "SlideSquadSingle" | head -10
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/pages/relatorio-mensal/SlideSquadSingle.tsx
git commit -m "feat(relatorio): componente SlideSquadSingle — 1 squad por slide

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Atualizar RelatorioMensal.tsx

**Files:**
- Modify: `client/src/pages/RelatorioMensal.tsx`

Contexto: O arquivo tem 5 mudanças independentes que devem ser feitas na ordem:
1. Trocar import `SlideSquadDetails` por `SlideSquadSingle`
2. Estender `SlotEntry` com tipo `"squad"`
3. Adicionar `parseSquadNameMinimal` (função auxiliar para label do slot)
4. Modificar `buildSlotArray` para receber `squadDetails` e inserir squad slots no lugar de fixedIndex=13
5. Atualizar useMemo de `slots`, `slideNames` e o bloco `renderSlide`

Importante: `buildSlotArray` está definida **fora** do componente React (é uma função pura no topo do arquivo). O `useMemo` de `slots` está dentro do componente.

- [ ] **Step 1: Trocar import**

Localizar linha 31:
```tsx
import SlideSquadDetails from "./relatorio-mensal/SlideSquadDetails";
```

Substituir por:
```tsx
import SlideSquadSingle from "./relatorio-mensal/SlideSquadSingle";
```

- [ ] **Step 2: Estender SlotEntry com tipo "squad"**

Localizar (linha ~50):
```ts
type SlotEntry = { type: "fixed"; fixedIndex: number; name: string } | { type: "custom"; data: CustomSlide };
```

Substituir por:
```ts
type SlotEntry =
  | { type: "fixed"; fixedIndex: number; name: string }
  | { type: "custom"; data: CustomSlide }
  | { type: "squad"; squadIndex: number; name: string };
```

- [ ] **Step 3: Adicionar parseSquadNameMinimal antes de buildSlotArray**

Localizar a linha `function buildSlotArray(`. Inserir imediatamente antes dela:

```ts
function parseSquadNameMinimal(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  return { emoji: "", name: trimmed };
}
```

- [ ] **Step 4: Modificar buildSlotArray**

Localizar a função `buildSlotArray` completa. A assinatura atual é:
```ts
function buildSlotArray(customSlides: CustomSlide[]): SlotEntry[] {
```

**Atenção:** também precisar importar `SquadDetail` de `./relatorio-mensal/types`. Verificar se já está importado em RelatorioMensal.tsx — provavelmente não está. Adicionar no import:

Localizar:
```ts
import { useCustomSlides, type CustomSlide } from "./relatorio-mensal/useCustomSlides";
```

Substituir por:
```ts
import { useCustomSlides, type CustomSlide } from "./relatorio-mensal/useCustomSlides";
import type { SquadDetail } from "./relatorio-mensal/types";
```

Agora modificar `buildSlotArray` — substituir a função completa:

```ts
function buildSlotArray(customSlides: CustomSlide[], squadDetails: SquadDetail[]): SlotEntry[] {
  const slots: SlotEntry[] = [];
  for (let i = 0; i < STATIC_SLIDES; i++) {
    if (i === 13) {
      // Replace "Squad Details" with individual squad slides
      for (let s = 0; s < squadDetails.length; s++) {
        const { emoji, name } = parseSquadNameMinimal(squadDetails[s].squad);
        const label = emoji ? `${emoji} ${name}` : name;
        slots.push({ type: "squad", squadIndex: s, name: label });
      }
    } else {
      slots.push({ type: "fixed", fixedIndex: i, name: FIXED_SLIDE_NAMES[i] });
    }
    // Insert custom slides that go after fixed slide i
    const customs = customSlides
      .filter((c) => c.posicao === i)
      .sort((a, b) => a.ordem - b.ordem);
    for (const c of customs) {
      slots.push({ type: "custom", data: c });
    }
  }
  return slots;
}
```

- [ ] **Step 5: Atualizar useMemo de slots**

Localizar (linha ~146):
```ts
  const slots = useMemo(() => buildSlotArray(customSlides), [customSlides]);
```

Substituir por:
```ts
  const slots = useMemo(
    () => buildSlotArray(customSlides, data?.squadDetails ?? []),
    [customSlides, data?.squadDetails]
  );
```

- [ ] **Step 6: Atualizar slideNames**

Localizar (linha ~149):
```ts
  const slideNames = useMemo(
    () => slots.map((s) => s.type === "fixed" ? s.name : (s.data.titulo || "Slide Custom")),
    [slots]
  );
```

Substituir por:
```ts
  const slideNames = useMemo(
    () => slots.map((s) =>
      s.type === "fixed"  ? s.name :
      s.type === "squad"  ? s.name :
      (s.data.titulo || "Slide Custom")
    ),
    [slots]
  );
```

- [ ] **Step 7: Atualizar renderSlide para tratar slot "squad"**

Localizar o bloco `renderSlide`:
```ts
  const renderSlide = () => {
    if (!data) return null;
    const slot = slots[currentSlide];
    if (!slot) return null;
    if (slot.type === "fixed") {
      return renderFixedSlide(slot.fixedIndex);
    }
    return (
      <SlideCustom
        titulo={slot.data.titulo ?? undefined}
        subtitulo={slot.data.subtitulo ?? undefined}
        imageUrl={slot.data.image_url ?? undefined}
      />
    );
  };
```

Substituir por:
```ts
  const renderSlide = () => {
    if (!data) return null;
    const slot = slots[currentSlide];
    if (!slot) return null;
    if (slot.type === "fixed") {
      return renderFixedSlide(slot.fixedIndex);
    }
    if (slot.type === "squad") {
      return <SlideSquadSingle squad={data.squadDetails[slot.squadIndex]} mesLabel={data.mesDadosLabel} />;
    }
    return (
      <SlideCustom
        titulo={slot.data.titulo ?? undefined}
        subtitulo={slot.data.subtitulo ?? undefined}
        imageUrl={slot.data.image_url ?? undefined}
      />
    );
  };
```

- [ ] **Step 8: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "RelatorioMensal|SlideSquad" | grep -v node_modules | head -15
```

Expected: sem erros nos arquivos tocados.

- [ ] **Step 9: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/pages/RelatorioMensal.tsx
git commit -m "feat(relatorio): slides dinâmicos por squad em RelatorioMensal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Deletar SlideSquadDetails.tsx

**Files:**
- Delete: `client/src/pages/relatorio-mensal/SlideSquadDetails.tsx`

Contexto: O grid de squads foi substituído pelo `SlideSquadSingle`. O arquivo `SlideSquadDetails.tsx` não é mais importado em nenhum lugar (o import foi trocado na Task 2). Deletar para evitar código morto.

- [ ] **Step 1: Confirmar que o arquivo não é mais importado**

```bash
grep -r "SlideSquadDetails" /Users/mac0267/Cortex/client/src/ | grep -v ".tsx.bak"
```

Expected: sem resultados (nenhum arquivo importa `SlideSquadDetails`).

- [ ] **Step 2: Deletar o arquivo**

```bash
rm /Users/mac0267/Cortex/client/src/pages/relatorio-mensal/SlideSquadDetails.tsx
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "SlideSquadDetails" | head -5
```

Expected: sem erros referenciando `SlideSquadDetails`.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac0267/Cortex
git add -u client/src/pages/relatorio-mensal/SlideSquadDetails.tsx
git commit -m "refactor(relatorio): remover SlideSquadDetails (grid substituído por slides individuais)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Teste visual no browser

**Files:** nenhum alterado

- [ ] **Step 1: Reiniciar servidor**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
cd /Users/mac0267/Cortex && npm run dev &
sleep 6
```

- [ ] **Step 2: Verificar que subiu**

```bash
curl -s http://localhost:3000/ | head -3
```

Expected: `<!DOCTYPE html>`

- [ ] **Step 3: Verificar slides de squads**

Abrir `http://localhost:3000` → Reporte Mensal → selecionar mês → navegar até o bloco de squads (posição após "Capa Commerce", slide ~13).

Verificar:
- Cada squad ocupa um slide inteiro
- Título mostra `{emoji} {NOME} — {mês}` com a linha de gradiente na cor da squad
- 4 cards em linha: MRR Ativo (cor da squad + borda), Pontual Entregue (cyan), Churn (verde/vermelho), Evolução MRR (verde/vermelho)
- Navegar entre squads com seta → funciona normalmente
- Após a última squad, avança para "Ranking Squads" (slide seguinte)

- [ ] **Step 4: Verificar que "Squad Details" (grid) não aparece mais**

Confirmar que não existe nenhum slide mostrando o grid antigo com múltiplas squads.

- [ ] **Step 5: Verificar total de slides**

No navegador, verificar que o contador de slides bate com: `24 - 1 (grid removido) + N squads`. Com 6 squads típicas: 29 slides total. Com 0 squads: 23 slides total.
