# Design: Reestruturação Tech Hub

## 1. Redesign Visual (3 tabs existentes)

**Princípios:**
- Reduzir densidade visual — menos cards, mais espaçamento
- Hierarquia clara — KPIs grandes no topo, detalhes menores
- Consistência — mesmo padrão de cards, badges e cores
- Tipografia — títulos font-light, números text-3xl
- Cards com bg-card border, sem backgrounds coloridos pesados
- Remover ícones decorativos redundantes

**Overview:**
- 4 KPIs no topo: Projetos Ativos, Em Risco, Tempo Médio Deploy, Taxa No Prazo
- Pipeline snapshot horizontal (barra única por fase)
- Próximos vencimentos como lista compacta

**Projetos:**
- Kanban mais limpo — cards menores (nome + status + prazo + responsável)
- Badge de urgência sutil (sem borda colorida lateral)
- Filtros em linha (não colapsáveis)

**Performance:**
- Charts com cores mais sutis (opacidade reduzida)
- Grid 2 colunas para charts

## 2. Nova Página: Estatísticas por Responsável

**Rota:** /tech/responsavel

**Layout:**
- Select de responsável no topo
- Dashboard individual ao selecionar

**Seção 1 — KPIs (4 cards):**
- Projetos Ativos, Concluídos, Tempo Médio Deploy, Taxa No Prazo %

**Seção 2 — Carga Atual:**
- Lista de projetos ativos com status, fase, prazo, urgência
- Indicador de carga (alta/média/ok)

**Seção 3 — Performance Histórica:**
- Entregas por trimestre (barras)
- Tempo médio deploy por trimestre (linha)

**Seção 4 — Tempo por Fase:**
- Barras horizontais (Design, Dev, Review, etc.)

**Backend:** Reutiliza endpoints existentes + novo endpoint para KPIs individuais.
