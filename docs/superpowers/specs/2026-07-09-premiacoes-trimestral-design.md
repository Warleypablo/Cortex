# Seção Premiações — Reporte Trimestral

**Data:** 2026-07-09
**Autor:** Ichino + Claude
**Status:** Aprovado

## Objetivo

Adicionar uma quarta seção ao deck `/reports/trimestral` — **Premiações** — com
uma capa de seção e quatro slides de tópico, exibidos no fecho da apresentação.

Os slides **não exibem nomes de premiados**. São slides de tópico: anunciam a
categoria enquanto quem apresenta cita os nomes no palco. Nenhum dado é lido do
banco.

## Decisões validadas (brainstorming)

| Tema | Decisão |
|------|---------|
| Fonte de dados | **Nenhuma.** Slides estáticos. Não existe (nem será criada) tabela de premiados; os nomes são falados no palco |
| Posição no deck | Após `faturamento`, antes de `encerramento`. O Q&A segue como último slide (é pra onde o QR da abertura aponta) |
| Capa da seção | Reusa `SlideCapaSecao` com `numero="04"` |
| Accent da seção | Âmbar `#fbbf24` / `rgba(251,191,36,0.12)` — lê como troféu e não colide com Comercial (`#38bdf8`), Operação (`#34d399`) nem Tech (`#a78bfa`) |
| Slides de tópico | Um componente novo reusado 4× (`SlidePremiacaoTrimestre`) |
| Subtítulo | Prop **opcional**. Sem slogan motivacional inventado — só informação real |
| Tema | Dark fixo (`#05060f`), como todo slide do deck. A regra dark/light do `CLAUDE.md` não se aplica dentro do deck |

## Escopo

**Inclui:**
- Componente `client/src/pages/relatorio-trimestral/SlidePremiacaoTrimestre.tsx`
- Novos slots em `RelatorioTrimestral.tsx`: `capa-premiacoes` e `premiacao`
- Reuso de `SlideCapaSecao` para a capa `04 · Premiações`

**Não inclui:**
- Tabela `premiacoes_trimestre`, endpoint, CRUD ou tela de edição
- Nomes, fotos ou justificativas dos premiados
- Qualquer alteração em `server/routes/reportsTrimestral.ts`

## Os quatro slides

| # | Título | Subtítulo |
|---|--------|-----------|
| 1 | Colaborador Turbinado | — |
| 2 | Guardiões da Cultura | — |
| 3 | Destaques | Colaboradores |
| 4 | Destaques | Líderes |

O subtítulo dos dois "Destaques" sai da própria nomenclatura da premiação. Os
dois primeiros ficam sem subtítulo por decisão explícita: não há informação real
a colocar, e texto de efeito foi rejeitado. Quando `subtitulo` é omitido, o
título centraliza sozinho no slide.

## Arquitetura

### `SlidePremiacaoTrimestre.tsx`

```ts
interface Props {
  titulo: string;       // "Colaborador Turbinado"
  subtitulo?: string;   // "Colaboradores" | undefined
  indice: number;       // 1-based, para o contador "02 / 04"
  total: number;        // 4
  label: string;        // "Q2 2026"
}
```

Herda o DNA visual de `SlideCapaSecao`: fundo void `#05060f`, aurora âmbar no
canto, grade em perspectiva no rodapé, título gigante em gradiente
(`#ffffff → #fbbf24`). Duas diferenças:

- No lugar do numeral fantasma da seção, um **contador de posição** discreto
  (`02 / 04`) — sinaliza à plateia quantas premiações ainda vêm.
- Um **troféu fantasma** em outline atrás do conteúdo, ecoando o numeral
  fantasma da capa sem repetir o mesmo recurso.

Animações de entrada apenas (`animate-in fade-in slide-in-from-*`), sem loop
contínuo — o `exportPdf` fotografa cada slide após 1600ms, e loops geram
capturas inconsistentes. Todas respeitam `motion-reduce`.

### `RelatorioTrimestral.tsx`

O union `TrimSlot` ganha dois membros:

```ts
| { type: "capa-premiacoes" }
| { type: "premiacao"; premiacaoIndex: number }
```

Uma constante de módulo descreve as quatro premiações:

```ts
const PREMIACOES = [
  { titulo: "Colaborador Turbinado" },
  { titulo: "Guardiões da Cultura" },
  { titulo: "Destaques", subtitulo: "Colaboradores" },
  { titulo: "Destaques", subtitulo: "Líderes" },
] as const;
```

O array `fechamento` passa de:

```ts
[{ type: "faturamento" }, { type: "encerramento" }, { type: "qa" }]
```

para:

```ts
[
  { type: "faturamento" },
  { type: "capa-premiacoes" },
  ...PREMIACOES.map((_, i) => ({ type: "premiacao", premiacaoIndex: i })),
  { type: "encerramento" },
  { type: "qa" },
]
```

O `renderSlide` ganha os dois cases correspondentes. O contador de slides, os
dots de navegação, o atalho `End` e o `exportPdf` derivam todos de
`slots.length`, então absorvem os 5 slides novos sem alteração.

## Fluxo de dados

Nenhum. Os slides não consomem `data` do endpoint — exceto `data.label`
(ex.: `"Q2 2026"`), que já está carregado e é passado para o eyebrow, como fazem
as outras capas de seção.

## Erros e casos de borda

- **Deck sem dados:** `renderSlide` já retorna `null` quando `!data`. Os slides
  novos ficam atrás desse mesmo guard, então não há caso novo a tratar.
- **Trimestre parcial:** irrelevante — os slides não têm números, logo não há
  parcialidade a sinalizar.
- **Export PDF:** os 5 slides novos entram no loop de `exportPdf`
  automaticamente. Sem animação em loop, a captura é determinística.

## Testes

Não há lógica de negócio nova — os componentes são apresentacionais e a
constante `PREMIACOES` é estática. A verificação é `npx tsc --noEmit` mais
navegação manual pelo deck (posição correta dos slides, contador `n/total`
coerente, título centralizado quando não há subtítulo, export PDF íntegro).
