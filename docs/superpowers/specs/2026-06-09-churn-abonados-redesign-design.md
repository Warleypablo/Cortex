# Redesign Visual — Churns Abonados

**Data:** 2026-06-09
**Arquivo:** `client/src/pages/ChurnAbonados.tsx`
**Tipo:** Repaginação visual (sem mudança de lógica de dados/endpoint)

## Problema

A tela `/dashboard/churn-abonados` tem dois defeitos visuais:

1. **"Amarelo aleatório":** a tela inteira é âmbar/laranja/amarelo monocromático
   (header com gradiente âmbar, 4 KPIs em amber/orange/yellow/stone, marcadores de
   seção, toggles, e todos os gráficos pintados de âmbar). Destoa do resto do app,
   que usa base neutra/azul + paleta categórica (ver `churn-produto`). No gráfico
   temporal, "Abono Manual" (âmbar) e "Abono Automático" (laranja) são cores quase
   idênticas — impossível distinguir.

2. **"Buracos vazios":** a tela foca no mês selecionado. No mês atual (junho/2026,
   0 abonados) todos os cards mostram "Nenhum abonado no período" dentro de caixas
   escuras gigantes de altura fixa. A tela abre ~80% vazia.

## Direções aprovadas

1. **Cor:** alinhar ao **azul do app** (abandonar âmbar). Base neutra + azul primário
   como único acento de marca.
2. **Mês vazio:** **visão de 12 meses como primária** (sempre populada); o mês vira
   filtro/drill opcional.
3. **Escopo:** repaginação visual completa — mantém as 3 seções e o drill-down.

## Tokens de design (já existentes no app)

- Azul primário (dark): `--primary: 215 80% 55%` → `text-primary` / `bg-primary`.
- Paleta de gráficos: `--chart-1` azul, `--chart-2` roxo, `--chart-3` verde.
- `getSquadColor(squad)` em `lib/squadColors.ts` — cor fixa por squad, usada no app
  inteiro (Selva=verde, Hunters=roxo, Squadra=azul…).

## Mudanças

### 1. Paleta
Remover todo âmbar/orange/yellow/stone. Base neutra (`bg-card`, `border-border`,
`text-muted-foreground`) + azul primário como acento.
- Header: fundo `bg-card` sóbrio, ícone shield em azul (sem o gradiente âmbar).
- Marcadores de seção (`SectionTitle`) e toggles (`SegmentedToggle`): azul no lugar do âmbar.

### 2. KPIs (4 cards)
Hoje cada card tem cor diferente (arco-íris). Vira: 4 cards neutros uniformes
(`bg-card border-border`), valor em `text-foreground`, só "Contratos" recebe acento
azul. Ícones em `text-muted-foreground`. Valores referem-se aos **12 meses**, com
sub-rótulo discreto "· N no mês selecionado".

### 3. Gráficos
- **Por Motivo** (barras H): azul primário sólido.
- **Por Squad** (barras V): `getSquadColor(squad)` por barra (`<Cell>`).
- **Top 10 Responsáveis** (barras H): azul primário.
- **Temporal manual×automático:** azul (`--chart-1`) vs roxo (`--chart-2`), legenda clara.

### 4. Visão 12 meses primária
- Período default = "Últimos 12 meses". Cards Motivo/Squad/Top10 usam `abonados12m`
  (acumulado), filtrado por squad — sempre com dados.
- Seletor de mês = drill opcional: escolher um mês filtra os cards para o mês. Mês
  sem abonados → faixa fina "Sem abonados em \<mês\> — exibindo 12 meses" (não o caixão).
- Gráfico temporal sempre 12 meses; mês selecionado destacado.

### 5. Empty states
Trocar caixões de ~200px por faixas compactas (~64px), discretas.

## Não muda

Estrutura das 3 seções (Motivo / Operacional / Temporal), filtro de squad,
drill-down lateral (Sheet), lógica de dados e endpoint `churn-detalhamento`.

## Verificação

- Tela abre populada (12m) mesmo em mês vazio.
- Nenhum âmbar/amarelo remanescente; acento azul consistente com o app.
- Manual vs automático distinguíveis no gráfico temporal.
- Squads com cores corretas (`getSquadColor`).
- Dark mode E light mode corretos.
