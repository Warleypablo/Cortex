# Slide "Promoções do Trimestre" — Reporte Mensal

**Data:** 2026-07-08
**Status:** Aprovado para implementação

## Objetivo

Adicionar um novo slide ao Reporte Mensal (`RelatorioMensal.tsx`) listando as
pessoas promovidas no trimestre, com foto real e nome. Posicionado logo após o
slide "Novos & Aniversários" (seção Pessoas).

## Decisões (brainstorming)

| Decisão | Escolha |
|---------|---------|
| Fonte dos dados | Lista **fixa no código** (backend), editada a cada trimestre |
| Exibição | Foto real (RH/`auth_users`) + **nome apenas** (sem cargo) |
| Nome exibido | Como o usuário forneceu (curto) |
| Posição | Após "Novos & Aniversários" |

## Dados (validado em produção 2026-07-08)

Os 22 nomes existem em `"Inhire".rh_pessoal`, todos com status `Ativo` e match
**unívoco** (1 registro cada). **21/22 têm foto** em `cortex_core.auth_users`;
apenas *Ana Clara Cordeiro do Carmo* não tem → cai no avatar de iniciais (mesmo
fallback do slide de Aniversariantes).

Vários nomes fornecidos são um **prefixo** do nome completo do RH (ex.: "Gabriel
Taufner" → "Gabriel Pereira Taufner"). Por isso cada entrada guarda dois campos:
`nome` (exibição) e `rhNome` (nome exato do RH, usado para casar foto sem
ambiguidade — há homônimos: 3 "Anderson", 15 "Gabriel", 11 "Matheus").

## Arquitetura

### 1. Backend — `server/routes/relatorioMensalSlides.ts`

- Constante `PROMOCOES_TRIMESTRE: { nome: string; rhNome: string }[]` no topo do
  arquivo (com os 22 pares, comentário indicando o trimestre vigente).
- Nova query no bloco `Promise.all` que casa `rhNome` normalizado
  (`lower(trim(regexp_replace(unaccent(nome),'\s+',' ','g')))`) contra
  `rh_pessoal.nome` (status `Ativo`), join triplo com `auth_users` para a foto
  — mesmo padrão das queries #1/#2 (novos/aniversariantes).
- Resultado ordenado pela ordem da constante, retornado como
  `promocoes: { nome: string; fotoUrl: string | null }[]` no JSON da resposta.
  (A query resolve por `rhNome` mas o objeto retornado usa o `nome` de exibição.)

### 2. Tipos — `client/src/pages/relatorio-mensal/types.ts`

- `export interface Promocao { nome: string; fotoUrl: string | null }`
- Adicionar `promocoes: Promocao[]` a `RelatorioMensalData`.

### 3. Componente — `client/src/pages/relatorio-mensal/SlidePromocoes.tsx`

- Espelha `SlideNovosAniversariantes`: `SlideLayout section="people"`,
  `SlideHeader` (ícone `Award`/troféu dourado, título "Promoções do Trimestre",
  subtítulo `(22)`), grid responsivo até 5 colunas de cartões
  `avatar (foto ou iniciais) + nome`.
- Reaproveita o padrão de `Avatar` (foto com `onError` → iniciais).

### 4. Wiring — `client/src/pages/RelatorioMensal.tsx`

Inserção **sem renumerar** os índices existentes (o `switch` usa índices mágicos
13=squad, 22=tópicos). Espelhando o padrão já usado para squad/tópicos:

- `import SlidePromocoes`.
- Novo case no `renderFixedSlide` com índice fora da faixa (ex.: `100`):
  `case 100: return <SlidePromocoes promocoes={data.promocoes} />;`
- No `buildSlotArray`, após o push do slot `i === 2` ("Novos & Aniversários"):
  `if (i === 2) slots.push({ type: "fixed", fixedIndex: 100, name: "Promoções" });`

Isso adiciona o slide na posição 4 da apresentação sem deslocar nenhum outro.

## Fora de escopo (YAGNI)

- Edição por UI / persistência em banco (`rh_promocoes` existe, mas não será usada agora).
- Lógica automática de detecção de trimestre. A lista é fixa e aparece em todo mês.
- Exibição de cargo ou de/para da promoção.

## Testes / verificação

- `npx tsc --noEmit` limpo.
- Validar no browser (dev server) que o slide aparece na posição 4, com as 22
  pessoas, fotos carregando e Ana Clara em iniciais. Dark mode (slides já são dark).
