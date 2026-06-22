# Reporte Mensal — Visual Polish & Consistência

**Data:** 2026-04-08
**Abordagem:** A — Polish & Consistência (sem redesign estrutural)

## Objetivo

Tornar os slides do reporte mensal mais legíveis em TVs, visualmente consistentes entre si, e com mais impacto visual nas capas e encerramentos.

## 1. Hierarquia Tipográfica Padronizada

**Regra:** nenhum texto menor que `text-xs` (12px).

| Uso | Antes | Depois |
|-----|-------|--------|
| Micro labels | `text-[10px]`, `text-[9px]` | `text-xs` (12px) |
| Labels de card | `text-xs` | `text-xs` (mantém) |
| Valores de métricas | `text-xl` a `text-3xl` (inconsistente) | `text-lg` min, `text-2xl` padrão |
| Títulos de slide | `text-2xl` | `text-2xl` (mantém) |
| Título principal (capas) | `text-4xl`-`text-5xl` | `text-5xl` padronizado |

**TurboMetrics:** reduzir de 5 para 4 colunas no grid top. Informações do card CXCS (cross-sell) migram para dentro do card MRR Add/Cancel. Mais espaço vertical para o gráfico.

## 2. Cards Unificados

Padronizar em 2 variantes:

- **PrimaryCard**: `p-5`, `border-2`, `rounded-2xl`, `bg-white/[0.04]`
- **SecondaryCard**: `p-4`, `border`, `rounded-xl`, `bg-white/[0.04]`

Eliminar paddings inconsistentes (`p-3`, `p-5`, `p-6` misturados).

## 3. Capas de Seção com Mais Presença

- Ícone central: `h-16 w-16` → `h-20 w-20`
- Glow pulsante com `animate-pulse` sutil (opacity 0.3→0.5)
- Título: `text-6xl font-black tracking-tight`
- Linha decorativa horizontal abaixo do subtítulo (gradiente da seção)

## 4. Encerramento Cinematográfico

- **SlideEncerramento**: frase com gradiente de texto, tipografia maior
- **SlideFraseEncerramento**: efeito spotlight — glow centralizado mais forte, cantos mais escuros

## 5. Transições e Micro-animações

- Cards: `transition-all duration-300 ease-out`
- Barras de progresso: `transition-[width] duration-700`
- Podium bars: `transition-[height] duration-500`

## 6. Rankings Consistentes

Unificar Closers, SDRs e Squads:
- Mesmo formato de podium
- Mesma hierarquia: foto/emoji → nome → valor → barra
- Cores de medalha: 1º amber, 2º zinc, 3º orange
- Glow padronizado no 1º lugar

## Arquivos Impactados

- `SlideComponents.tsx` — PrimaryCard, SecondaryCard padding/border
- `SlideTurboMetrics.tsx` — layout 4 cols, merge CXCS, font sizes
- `SlideCapaComercial.tsx`, `SlideCapaCommerce.tsx`, `SlideCapaTech.tsx` — SectionCover melhorado
- `SlideRankingClosers.tsx`, `SlideRankingSDRs.tsx`, `SlideRankingSquads.tsx` — podium unificado
- `SlideEncerramento.tsx`, `SlideFraseEncerramento.tsx` — efeitos visuais
- Todos os slides — remoção de text-[10px]/text-[9px], padding consistente
