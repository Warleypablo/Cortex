# TV Leaderboard — Gamificação Visual

**Data:** 2026-05-19  
**Status:** Aprovado  
**Escopo:** Apenas frontend — zero mudanças de backend/schema

---

## Objetivo

Adicionar animações de entrada e um sistema de tiers visuais à TV Leaderboard (`/gestao/tv-leaderboard`), tornando a experiência mais próxima de um game real exibido em TV.

---

## Componentes Afetados

### Novos
| Arquivo | Responsabilidade |
|---------|-----------------|
| `client/src/hooks/useCountUp.ts` | Anima um número de 0 até o valor final via `requestAnimationFrame`. Recebe `value`, `duration` (padrão 1200ms) e `enabled` (boolean para disparar só quando o componente está visível). Retorna o valor corrente formatado. |
| `client/src/components/tv-leaderboard/TierBadge.tsx` | Badge visual de tier baseado em `posicao: number`. Tamanho configurável via prop `size` (`sm` / `md`). Pulsa suavemente no Diamante. |

### Modificados
| Arquivo | O que muda |
|---------|-----------|
| `TvRotator.tsx` | Adiciona `AnimatePresence mode="wait"` com `motion.div` em cada screen — fade + slide ao trocar tela |
| `TelaSquads.tsx` | Envolve o grid de `SquadKpiCard` em `motion.div` com `staggerChildren: 0.08` |
| `SquadPodium.tsx` | Barras do pódio começam com `height: 0` e sobem com `spring`. Ordem de entrada: #3 → #2 → #1. Cada squad ganha `TierBadge` |
| `SquadKpiCard.tsx` | Valores de MRR animados com `useCountUp`. `TierBadge` no canto superior direito |
| `TelaPessoas.tsx` | Envolve as duas `RankingColuna` com `motion.div` com `staggerChildren: 0.15` |
| `RankingColuna.tsx` | Header e lista envolvidos em `motion.div` com entrada fade+slide |
| `PodiumTop3.tsx` | Avatares escalam de `0.6 → 1.0` com spring elástico. Valores animados com `useCountUp`. `TierBadge` em cada posição |
| `RankingListaItem.tsx` | Entrada com slide da esquerda (`x: -24 → 0`), staggerada pelo pai |

---

## Sistema de Tiers

Critério: **posição no ranking** (calculado client-side, sem backend).

| Posição | Tier | Ícone | Glow CSS |
|---------|------|-------|----------|
| #1 | Diamante | 💎 | `shadow-[0_0_32px_rgba(147,197,253,0.7)]` — azul gelo |
| #2–3 | Ouro | 🥇 | `shadow-[0_0_24px_rgba(251,191,36,0.6)]` — dourado |
| #4–5 | Prata | 🥈 | `shadow-[0_0_16px_rgba(228,228,231,0.4)]` — prata |
| #6+ | Bronze | 🥉 | sem glow extra |

O badge Diamante usa `animate-pulse` para se destacar na TV. Os outros tiers são estáticos.

O `TierBadge` recebe apenas `posicao: number` e `size?: 'sm' | 'md'` — sem estado externo.

---

## Animações de Entrada

### Transição entre telas (TvRotator)
- `AnimatePresence mode="wait"`
- Saída: `opacity 0, y -20`, duração 0.4s, ease `easeIn`
- Entrada: `opacity 0 → 1, y 20 → 0`, duração 0.5s, ease `easeOut`

### Cards de Squad (TelaSquads)
- Container: `variants.container` com `staggerChildren: 0.08`
- Item: `opacity: 0 → 1, y: 40 → 0`, spring `{ stiffness: 260, damping: 22 }`

### Pódio de Squads (SquadPodium)
- Cada barra: `height: 0 → height real`, spring `{ stiffness: 180, damping: 20 }`
- Delays: #3 = 0.1s, #2 = 0.2s, #1 = 0.4s (líder entra por último)

### Avatares do Pódio de Pessoas (PodiumTop3)
- `scale: 0.6 → 1.0`, spring `{ stiffness: 300, damping: 18, type: 'spring' }`
- Delays: #2 = 0.1s, #3 = 0.2s, #1 = 0.35s

### Lista de Ranking (RankingListaItem)
- `x: -24 → 0, opacity: 0 → 1`, staggerado pelo `RankingColuna` pai
- `staggerChildren: 0.04` (lista pode ter até 12 itens)

### Contador de Números (useCountUp)
- Duração: 1200ms, easing `easeOut` via `t => 1 - Math.pow(1 - t, 3)`
- Disparado no `useEffect` de montagem do componente — como o `TvRotator` monta/desmonta cada tela via `AnimatePresence`, o contador recomeça naturalmente a cada exibição da tela
- Formatação BRL aplicada frame a frame

---

## Restrições

- Nenhuma mudança de dados, API ou schema
- Todas as animações usam Framer Motion (já instalado v11)
- `useCountUp` usa `requestAnimationFrame`, não `setInterval`
- A prop `enabled` do `useCountUp` garante que o contador só roda quando o componente está na tela (evita contador rodando na tela que não está visível no rotator)
- Dark mode: a tela já é 100% dark (`fixed inset-0 bg-zinc-950`), sem mudanças de tema
