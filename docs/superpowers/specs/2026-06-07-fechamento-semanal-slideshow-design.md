# Design: Fechamento Semanal — Modo Apresentação (Slideshow)

**Data:** 2026-06-07  
**Solicitante:** COO  
**Objetivo:** View de fechamento semanal consolidada em modo slideshow para apresentação gerencial, cobrindo o desempenho da semana do início ao fim.

---

## 1. Arquitetura

### Rota
`/presentation/fechamento-semanal`

### Estrutura de arquivos
```
client/src/pages/FechamentoSemanal.tsx                    ← engine do slideshow
client/src/components/fechamento-semanal/
  SlideCapaSemana.tsx
  SlideMRR.tsx
  SlideChurn.tsx
  SlideInadimplencia.tsx
  SlideRankingClosers.tsx
  SlideRankingSDRs.tsx
  SlideNovosContratos.tsx
  SlideSaudeSquads.tsx
```

### Engine do slideshow (`FechamentoSemanal.tsx`)
- Seletor de semana no topo com navegação `‹ ›` antes de entrar no slideshow
- Semana calculada com `date-fns`: `startOfWeek(date, { weekStartsOn: 1 })` / `endOfWeek` (segunda a domingo)
- Botão "Apresentar" → `requestFullscreen` na div principal
- Slides navegam com `←/→` no teclado e setas laterais clicáveis
- Barra de progresso inferior: bolinhas clicáveis `● ● ○ ○ ○ ○ ○ ○`
- `AnimatePresence` + `motion.div` para transição suave (slide horizontal)
- Tecla `Esc` sai do modo apresentação

### Props de cada slide
```tsx
interface SlideProps {
  semanaInicio: string; // ISO date, ex: "2026-06-02"
  semanaFim: string;    // ISO date, ex: "2026-06-08"
}
```
Cada slide faz seu próprio `useQuery` — sem prop drilling de dados.

---

## 2. Slides e Dados

### Slide 1 — Capa da Semana
- Sem chamada de API — dados client-side
- Conteúdo: título "Fechamento Semanal", período formatado (ex: "02 Jun – 08 Jun 2026"), data de geração, logo Turbo
- Visual: centralizado, tipografia grande, fundo escuro

### Slide 2 — MRR Atual
- **Endpoint:** `GET /api/visao-geral/mrr-evolucao` (✅ existe)
- Conteúdo: MRR total atual em destaque, variação vs semana anterior (seta verde/vermelha), mini gráfico de linha das últimas 8 semanas

### Slide 3 — Churn da Semana
- **Endpoint:** `GET /api/relatorio-semanal/churn?semanaInicio=&semanaFim=` (✅ existe)
- Conteúdo: cards (contratos perdidos, MRR perdido, taxa de churn), tabela compacta (cliente, squad, valor, motivo)

### Slide 4 — Inadimplência
- **Endpoint:** `GET /api/relatorio-semanal/inadimplencia` (✅ existe)
- Conteúdo: total em aberto em destaque, barra horizontal por faixa (0–30, 31–60, 61–90, 90+ dias), top 5 maiores devedores

### Slide 5 — Ranking de Closers
- **Endpoint:** `GET /api/closers/ranking?dataInicio=&dataFim=` (⚠️ ajuste: aceitar range livre além do mês)
- Conteúdo: pódio visual (🥇🥈🥉) para top 3, tabela para os demais. Colunas: MRR fechado, Pontual, Reuniões, Negócios ganhos

### Slide 6 — Ranking de SDRs
- **Endpoint:** `GET /api/sdrs/ranking?dataInicio=&dataFim=` (⚠️ mesmo ajuste dos closers)
- Conteúdo: mesmo padrão do slide 5. Colunas: Leads criados, Reuniões realizadas, Taxa de conversão

### Slide 7 — Novos Contratos
- **Endpoint:** `GET /api/fechamento-semanal/novos-contratos?semanaInicio=&semanaFim=` (❌ novo endpoint)
- Query: `cup_contratos` filtrando `data_inicio` no range da semana
- Conteúdo: cards ou tabela (cliente, produto, squad, CS responsável, valor MRR). Badge "NOVO" em verde

### Slide 8 — Saúde dos Squads
- **Endpoint:** `GET /api/analise-squads?dataInicio=&dataFim=` (⚠️ verificar se filtro de datas já existe)
- Conteúdo: tabela por squad (MRR total, clientes ativos, churn da semana, MRR perdido), semáforo de saúde (verde/amarelo/vermelho baseado em churn rate)

---

## 3. Visual

### Layout global
- Fundo escuro `zinc-950` em todos os slides
- Logo Turbo no canto superior direito
- Cabeçalho fixo com período da semana (ex: `02 Jun – 08 Jun 2026`)
- Barra de progresso inferior com bolinhas clicáveis
- Dark mode nativo — sem toggle de tema nos slides

### Transições
- `AnimatePresence` com `motion.div`
- Slide horizontal: entra da direita, sai pela esquerda (avanço) / inverso (voltar)
- Duração: 400ms, easing `easeInOut`

### Tipografia de destaque
- Valores monetários: fonte bold, tamanho grande (`text-5xl` ou `text-6xl`)
- Variações: `text-emerald-400` (positivo) / `text-red-400` (negativo)
- Tabelas: compactas, sem bordas pesadas, zebra stripes sutis

---

## 4. Backend — Trabalho necessário

1. **Ajustar `/api/closers/ranking`** — aceitar `dataInicio` + `dataFim` arbitrários (atualmente só aceita mês)
2. **Ajustar `/api/sdrs/ranking`** — idem
3. **Criar `/api/fechamento-semanal/novos-contratos`** — query em `cup_contratos` com `data_inicio BETWEEN semanaInicio AND semanaFim`
4. **Verificar `/api/analise-squads`** — confirmar se aceita filtro de datas ou precisa ajuste

---

## 5. Registro de rota e navegação

```tsx
// App.tsx
const FechamentoSemanal = lazyWithRetry(() => import("@/pages/FechamentoSemanal"));
<Route path="/presentation/fechamento-semanal">
  {() => <ProtectedRoute path="/presentation/fechamento-semanal" component={FechamentoSemanal} />}
</Route>
```

Adicionar item de navegação no menu lateral, agrupado com os outros relatórios/dashboards.

---

## 6. Fora de escopo

- Export PDF — não incluído nesta versão (pode ser adicionado depois)
- Autoreload automático ao vivo — não incluído
- Personalização de slides — não incluído
