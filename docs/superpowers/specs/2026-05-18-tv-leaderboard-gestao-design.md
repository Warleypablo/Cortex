# TV Leaderboard de Gestão — Design

**Data:** 2026-05-18
**Autor:** Warleypablo (com Claude)
**Status:** Aprovado para implementação

## Objetivo

Dashboard gamificado para exibir na TV principal da operação, alternando automaticamente entre duas telas a cada 30 segundos. Objetivo é incentivar competição saudável entre squads e colaboradores, dando visibilidade às métricas-chave de receita e retenção.

## Escopo

**Inclui:**
- Tela 1 (Squads): Faturamento YTD vs meta 25MM, MRR Ativo / NRR / Churn por squad, pódio de squads
- Tela 2 (Pessoas): Rankings individuais de MRR, NRR e Anti-churn (pódio top 3 + lista 4º–10º)
- Auto-rotação de 30s entre as duas telas
- Período fixo: mês corrente

**Fora de escopo:**
- NPS (squad e pessoa) — explicitamente ignorado pelo solicitante
- Configuração de período (fica fixo no mês atual)
- Streak de meses consecutivos no top 3 (avaliar em v2)
- Som/efeitos sonoros
- Mobile/responsivo abaixo de 1280px

## Arquitetura

**Rota:** `/gestao/tv-leaderboard`

**Layout base:**
- Fullscreen, sem sidebar/header global (modo TV)
- Dark mode forçado (`className="dark"` no root da página)
- Otimizado para 1920×1080 (Full HD), breakpoint único `min-width: 1280px`
- Header fino com: período ("Maio/2026 — Mês atual"), relógio ao vivo, logo Forcell
- Rodapé com barra de progresso indicando tempo até próxima rotação

**Componente raiz `<TvRotator>`:**
- Alterna entre `<TelaSquads>` e `<TelaPessoas>` a cada 30s
- Transição cross-fade
- Indicador de progresso no rodapé

**Dados:**
- React Query, `staleTime: 5min`, `refetchInterval: 5min`
- 1 hook agregador `useTvLeaderboardData()` que dispara queries em paralelo
- Loading: skeleton dark, não bloqueia rotação se uma das telas já carregou
- Erro: card discreto "dados desatualizados — última atualização HH:MM"

**Endpoints reaproveitados (sem criar novos):**
- MRR/squad: `/api/analise-squads`, `/api/visao-geral/mrr-evolucao`
- NRR/squad: `/api/analytics/nrr`
- Churn/squad: `/api/churn-por-responsavel`, `/api/churn/consolidado-trimestral`
- Faturamento YTD vs meta: `/api/visao-geral/mrr-evolucao` agregado YTD
- Ranking por pessoa: `/api/analise-squads/detalhe`, `/api/contribuicao-squad/ranking`, `/api/analise-squads/top-mrr-area`

Se algum endpoint não cobrir 100% da agregação necessária, criar 1 endpoint consolidado `/api/tv-leaderboard/snapshot` que retorne tudo de uma vez (decisão fica para a fase de implementação após investigação detalhada).

## Tela 1 — Squads

Grid 12 colunas em 3 faixas verticais.

### Faixa superior (30% altura) — Hero "Faturamento YTD vs Meta 25MM"
- Gauge/barra de progresso gigante
- Valor atual em destaque (R$ X,XM)
- % atingido
- Ritmo necessário/dia para bater a meta
- Cor dinâmica: verde (no ritmo), amarelo (atrás), vermelho (crítico)

### Faixa central (50% altura) — Cards por squad
- 1 card por squad em linha horizontal
- Cada card mostra:
  - Nome da squad + cor (usando `SQUAD_COLORS` existente)
  - MRR Ativo (valor grande)
  - NRR % com seta ⬆️/⬇️ vs mês anterior
  - Churn R$ + % (vermelho se acima da meta)
  - Mini-sparkline dos últimos 6 meses
- Ordenação: MRR Ativo desc (líder à esquerda)

### Faixa inferior (20% altura) — Pódio de squads
- Pódio horizontal compacto 🥇 🥈 🥉
- Critério: crescimento de MRR no mês (delta vs mês anterior)
- Mostra nome + valor de crescimento

### Gamificação
- Squad líder em MRR: borda animada (glow sutil pulsante)
- Squad com pior churn: ícone discreto de alerta (não humilhante)
- Badges automáticos: "🚀 Maior crescimento", "🛡️ Menor churn", "🎯 Bateu meta"

## Tela 2 — Pessoas

Layout em 3 colunas iguais (1/3 cada). Header fino: "Ranking individual — Maio/2026".

### Coluna 1 — 💰 MRR (Ranking de vendas)
- Pódio top 3 no topo: avatar grande + nome + valor MRR no mês + chip da squad
- 1º colocado em destaque (maior, com coroa/glow)
- Lista vertical 4º–10º: posição #, avatar pequeno, nome, chip squad, valor, seta de variação

### Coluna 2 — 📈 NRR (Retenção/expansão)
- Mesma estrutura
- Métrica: NRR % do mês
- Filtro de elegibilidade: apenas pessoas com base ≥ 5 clientes (evita distorção de amostra pequena)

### Coluna 3 — 🛡️ Anti-churn (menor churn)
- Mesma estrutura, ranking INVERTIDO (menor churn = topo)
- Métrica: R$ de churn no mês + % da base sob responsabilidade
- 1º colocado = "Guardião do mês"

### Elementos comuns de gamificação
- Variação de posição vs mês anterior (▲3, ▼1, =) ao lado do nome
- Chip com cor da squad em cada item

### Filtros implícitos
- Apenas colaboradores ativos no mês
- Sem filtro visível na tela (TV limpa)

## Estrutura de arquivos

```
client/src/pages/gestao/TvLeaderboard.tsx          # rota principal
client/src/components/tv-leaderboard/
  ├── TvRotator.tsx                                 # alterna telas + barra progresso
  ├── TelaSquads.tsx
  ├── TelaPessoas.tsx
  ├── MetaFaturamentoHero.tsx                       # gauge 25MM
  ├── SquadKpiCard.tsx
  ├── SquadPodium.tsx                               # pódio horizontal squads
  ├── RankingColuna.tsx                             # coluna genérica (MRR/NRR/Churn)
  ├── PodiumTop3.tsx                                # pódio top 3 c/ avatar
  └── RankingListaItem.tsx                          # item 4º–10º
client/src/hooks/useTvLeaderboardData.ts            # agrega queries
```

Princípio de design: componentes pequenos com responsabilidade única. `RankingColuna` é genérico e parametrizado por métrica (mrr/nrr/churn) — evita duplicar layout em 3 lugares.

## Tipografia e visual

- Font sizes generosos para legibilidade em TV:
  - KPIs principais: ≥ 48px
  - Valores destacados: ≥ 64px
  - Texto secundário: ≥ 18px
- Paleta: `SQUAD_COLORS` existente + neutros zinc-900/zinc-800
- Animações: apenas fade entre telas e glow sutil no líder. Sem animações pesadas.

## Rota e menu

- Adicionar rota em `App.tsx` dentro de `/gestao`
- Adicionar item no menu Gestão: "📺 TV Leaderboard"
- Permissão: mesma do bloco de gestão (sem nova role)
- Página renderiza sem layout global (sem sidebar/topbar) para máximo aproveitamento da TV

## Testes mínimos

- Smoke test: `TvLeaderboard` renderiza sem erro com dados mockados
- `TvRotator`: troca de tela após 30s (timer mock com `vi.useFakeTimers`)
- `RankingColuna`: renderiza top 3 + lista corretamente com dados de teste

## Decisões abertas para fase de implementação

- Avaliar se vale criar endpoint consolidado `/api/tv-leaderboard/snapshot` em vez de N queries paralelas (decisão após medir latência real)
- Definir avatar fallback quando colaborador não tem foto (iniciais coloridas por squad)
