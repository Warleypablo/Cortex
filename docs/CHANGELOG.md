# Changelog

## 2026-03-10 | fix(security): hardening Phase 2 - SQL injection deep fixes

**O que foi feito:**
- **churnRiskEngine.ts**: Substituída concatenação de string com `sql.raw()` por queries parametrizadas usando `sql` template + `sql.join()` para filtros dinâmicos
- **dfcAnalysis.ts**: Hardened `executeSecureQuery()` - regex-based pattern blocking, table blacklist, forced LIMIT 500, transação read-only, log truncado
- **juridico.ts**: Substituído escape manual de SQL (IN clause com `replace(/'/g, "''")`) por `ANY()` parametrizado
- **comercial.ts**: Substituída query inteira em `sql.raw()` por `sql.join()` para colunas dinâmicas do SELECT

**110 sql.raw() restantes** são todos server-computed (datas de `new Date().toISOString()`, nomes de tabela hardcoded, scripts de migração) - nenhum com interpolação de input de usuário.

**Impacto arquitetural:** Eliminadas todas as vulnerabilidades de SQL injection com input de usuário

---

## 2026-03-10 | refactor(routes): modularize routes.ts - Phase 3 refactoring

**O que foi feito:**
- Extraídos 7 módulos de rotas de `routes.ts` (21k linhas → 11k linhas, **-47%**)
- Módulos criados: `inadimplencia.ts`, `geg.ts`, `comercial.ts`, `okr2026.ts`, `juridico.ts`, `clientes.ts`, `colaboradores.ts`
- Total de ~177 rotas extraídas para arquivos dedicados
- Adicionada validação Zod (middleware) em 9 endpoints críticos (auth, chamados, inadimplência, user management)
- Configurados Vitest (24 tests), ESLint + Prettier

**Arquivos criados:**
- `server/routes/inadimplencia.ts` (1310 linhas, 18 rotas)
- `server/routes/geg.ts` (958 linhas, 30 rotas)
- `server/routes/comercial.ts` (2356 linhas, 41 rotas)
- `server/routes/okr2026.ts` (1784 linhas, 30 rotas)
- `server/routes/juridico.ts` (1760 linhas, 17 rotas)
- `server/routes/clientes.ts` (976 linhas, 26 rotas)
- `server/routes/colaboradores.ts` (964 linhas, 15 rotas)
- `server/middleware/validate.ts`, `server/middleware/schemas.ts`

**Impacto arquitetural:** Manutenibilidade significativamente melhorada - cada domínio em arquivo dedicado

---

## 2026-03-09 | fix(security): hardening Phase 1 - endpoints, SQL injection, rate limiting

**O que foi feito:**
- Removidos 10 endpoints `/debug-*` não protegidos (~360 linhas) que estavam antes do middleware `isAuthenticated`
- Substituídos ~30 `sql.raw()` com interpolação de input de usuário por queries parametrizadas (Drizzle `sql` template)
- Adicionado `express-rate-limit`: 200 req/min geral em `/api`, 20 req/15min em login/OAuth
- Validação fail-fast de `SESSION_SECRET` em produção
- Corrigido error handler que fazia re-throw após responder (crash com ERR_HTTP_HEADERS_SENT)
- Adicionados `process.on('unhandledRejection')` e `process.on('uncaughtException')` handlers
- Adicionados `credentials/`, `*.key`, `*.pem` ao `.gitignore`

**Arquivos alterados:**
- `server/routes.ts` - Remoção de debug endpoints
- `server/storage.ts` - Parametrização de queries (inadimplência, métricas, busca)
- `server/auth/routes.ts` - Parametrização de UUID array e name matching
- `server/routes/chamados.ts` - Parametrização de list/update
- `server/routes/juridico-assistente.ts` - Parametrização de LIMIT
- `server/index.ts` - Rate limiting, SESSION_SECRET, error handler, process guards
- `.gitignore` - Secrets patterns

**Impacto arquitetural:** Segurança reforçada em múltiplas camadas

---

## 2026-03-09 | fix(contribuicao-squad): fix resultado liquido calculation to include all expenses

**O que foi feito:**
- Corrigido cálculo do Resultado Líquido no ranking de squads para incluir todas as despesas (impostos + salários + CXCS + freelancers) rateadas proporcionalmente à receita
- Anteriormente só deduzia a taxa de imposto, resultando em margem artificialmente alta

**Por que:**
- O valor da margem estava muito baixo/errado - mostrava apenas dedução de imposto em vez de todas as despesas

**Arquivos alterados:**
- `client/src/pages/ContribuicaoSquad.tsx` - Corrigido squadRanking.resultadoLiquido e coluna de despesas na tabela

**Impacto arquitetural:** Nenhum

---

## 2026-03-09 | refactor(inadimplencia): improve dashboard UX with compact filters, KPI deltas, and chart enhancements

**O que foi feito:**
- Removido ~200 linhas de dead code (imports, interfaces, queries, PDF handlers não utilizados)
- Substituída barra de filtros com gradiente por filtros inline compactos (Período + Squad + Vendedor + Faixa)
- Adicionados deltas de tendência nos KPI cards comparando mês atual vs anterior
- Melhorada tipografia dos KPIs (text-xl, uppercase tracking-wider)
- Substituído ComposedChart dual-axis por BarChart com toggle Valor/Parcelas
- Gráficos de barras agora ordenados por valor decrescente, com labels mais largos (120px) e truncação inteligente de nomes
- Adicionado LabelList nos gráficos de barras com valores compactos
- Tooltips ricos customizados mostrando nome completo, valor, parcelas, clientes e % do total
- Badge de urgência na tab Clientes mostrando contagem de 90+ dias
- Empty states melhorados com ícones e textos descritivos

**Por que:**
- Melhorar a experiência do usuário na análise de inadimplência: mais técnica, mais bonita, mais intuitiva

**Arquivos alterados:**
- `client/src/pages/DashboardInadimplencia.tsx` - Refatoração completa da UX do dashboard

**Impacto arquitetural:** Nenhum

---

## 2026-03-07 | feat(juridico): add legal knowledge markdowns for AI assistant

**O que foi feito:**
- Criado `agents/legal-cobranca.md` com procedimentos de cobranca, escalonamento por dias de atraso, juros/multa, prescricao
- Criado `agents/legal-contratos.md` com tipos de contrato, clausulas essenciais (SLA, NDA, PI, LGPD), checklist de analise
- Criado `agents/legal-trabalhista.md` com modalidades CLT/PJ/estagio, tipos de rescisao, documentacao e prazos

**Por que:**
- Base de conhecimento necessaria para o assistente juridico com IA que sera integrado ao Cortex
- Markdowns servem como contexto de sistema (system prompt) para orientar respostas juridicas

**Arquivos alterados:**
- `agents/legal-cobranca.md` - Novo arquivo: conhecimento sobre cobranca e inadimplencia empresarial
- `agents/legal-contratos.md` - Novo arquivo: conhecimento sobre contratos empresariais
- `agents/legal-trabalhista.md` - Novo arquivo: conhecimento sobre direito trabalhista brasileiro

**Impacto arquitetural:** Nenhum. Arquivos de conhecimento (markdown) sem impacto em codigo.

---

## 2026-03-07 | feat(dre): reclassifica deduções e adiciona receita líquida, LAIR, IR/CSLL no backend

**O que foi feito:**
- Adiciona grupo 08 (IR E CONTRIBUIÇÃO SOCIAL) e grupo virtual DD (DEDUÇÕES DA RECEITA BRUTA) ao GRUPO_MAP
- Reclassifica categorias 05.05/05.06 (ISS, PIS, COFINS) de custos operacionais para deduções da receita bruta
- Adiciona novos subtotais: deducoes_receita_bruta, receita_operacional_liquida, receita_liquida_total, lair, ir_csll
- Atualiza cálculos derivados seguindo estrutura contábil: Receita Bruta - Deduções = Receita Líquida - Custos = Lucro Bruto - Despesas = LAIR - IR/CSLL = Resultado Líquido

**Por que:**
- Categorias 05.05 (ISS) e 05.06 (PIS/COFINS) são deduções tributárias sobre receita, não custos operacionais
- A DRE precisa separar Receita Bruta de Receita Líquida para análise correta
- LAIR (Lucro Antes do IR) e IR/CSLL são obrigatórios numa DRE completa
- Grupo 08 já existia no plano de contas mas não era processado

**Arquivos alterados:**
- `server/routes/dre.ts` - GRUPO_MAP expandido, DREResponse com novos subtotais, reclassificação 05.05/05.06→DD, cálculos derivados atualizados

**Impacto arquitetural:** Mudança no contrato da API /api/financeiro/dre — subtotais renomeados (receita_bruta_total→receita_liquida_total) e novos campos adicionados. Frontend precisará ser atualizado para consumir os novos subtotais.

---

## 2026-03-06 | feat(squad): overhaul completo da página Contribuição por Squad

**O que foi feito:**
- [BACKEND] Novo campo `resumoPorSquad` no endpoint bulk com totais por squad, breakdown mensal e contagem de contratos
- [HERO] Ranking de Squads no topo: cards ordenados por contribuição %, sparklines de tendência, clicáveis para filtrar
- [TABELA] Resumo Anual com colunas: Squad, Receita Bruta, Impostos, Líquido, Contribuição %, Tendência
- [TAXA] Alíquota de imposto configurável (input no header, default 18%) — remove todo hardcode 0.18/0.82
- [DETAIL] Detalhamento mensal colapsável (começa fechado para visão executiva rápida)
- [UX] Empty state, botão "Voltar para todos", loading skeletons adequados
- KPI cards só aparecem no modo squad individual; ranking + tabela resumo no modo "Todos"

**Por que:**
- CEO precisa ver contribuição % líquida de cada squad imediatamente, sem scroll horizontal em tabela de 12 colunas

**Arquivos alterados:**
- `server/routes.ts` - resumoPorSquad no endpoint bulk
- `client/src/pages/ContribuicaoSquad.tsx` - redesign completo (hero, tabela resumo, detail colapsável, taxa configurável)

**Impacto arquitetural:** Campo additive na API (não breaking)

---

## 2026-03-06 | feat(metas): overhaul completo da página Metas de Receita

**O que foi feito:**
- [ALTA] Atingimento da Meta movido para hero section no topo com badges de status (Abaixo/Em progresso/Meta atingida)
- [ALTA] KPI cards reorganizados: 3 grandes (Total a Receber, Recebido, Pendente) + 3 compactos (Inadimplente, Projeção, Média Diária)
- [ALTA] Sistema de cores semântico padronizado: verde=recebido, amarelo=pendente, vermelho=inadimplente, azul=projeções
- [MÉDIA] Badges CRÍTICO/ATENÇÃO/OK nos cards de inadimplência baseados em thresholds
- [MÉDIA] Labels nos eixos Y do gráfico (R$ Diário / R$ Acumulado) e legenda separada por tipo
- [BAIXA] Hover micro-interactions (shadow, scale) em todos os cards
- [BAIXA] Renomeado "Revenue Goals" → "Metas de Receita" no nav e page info
- Ticket médio: ícones menores (w-5), padding compacto, fonte ajustada

**Arquivos alterados:**
- `client/src/pages/RevenueGoals.tsx` - layout completo, KPICard compact prop, hero section, status badges, chart labels
- `shared/nav-config.ts` - título e label de permissão renomeados

**Impacto arquitetural:** Nenhum — apenas frontend, sem alteração de API

---

## 2026-03-06 | feat(dfc): exportação CSV/Excel nos modos Diário e Mensal

**O que foi feito:**
- Dropdown "Exportar" com opções CSV e Excel no card do gráfico principal
- CSV com BOM para acentuação correta, Excel com colunas auto-dimensionadas
- Disponível nos modos Diário e Mensal (Semanal já tinha exportação própria)

**Arquivos alterados:**
- `client/src/pages/FluxoCaixa.tsx` - funções exportFluxoCSV/exportFluxoXLSX, DropdownMenu

**Impacto arquitetural:** Nenhum — usa xlsx já instalado

---

## 2026-03-06 | feat(dfc): marcação do dia atual no gráfico diário

**O que foi feito:**
- Linha vertical tracejada com label "Hoje" no gráfico diário usando ReferenceLine do recharts
- Só aparece quando o dia atual está dentro do período selecionado

**Arquivos alterados:**
- `client/src/pages/FluxoCaixa.tsx` - hojeFormatado useMemo, ReferenceLine component

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dfc): colunas ordenáveis na tabela Maiores Inadimplentes

**O que foi feito:**
- Colunas Valor Total, Parcelas e Dias Atraso clicáveis para ordenação asc/desc
- Ícone ArrowUpDown nos headers para indicar que são clicáveis

**Arquivos alterados:**
- `client/src/pages/RelatorioSemanalFinanceiro.tsx` - inadimSort state, sortedInadimClientes, headers clicáveis

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dfc): tooltip de contexto nas variações semanais

**O que foi feito:**
- VariationBadge nos KPI cards do relatório semanal agora mostra tooltip "vs. semana anterior (dd/MM - dd/MM)"
- KpiCard aceita prop `deltaTooltip` opcional

**Arquivos alterados:**
- `client/src/pages/RelatorioSemanalFinanceiro.tsx` - KpiCard deltaTooltip prop, TooltipUI wrapper, prevWeekLabel

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dfc): filtro por conta financeira no modo Diário

**O que foi feito:**
- Novo endpoint `/api/fluxo-caixa/contas-financeiras` retorna contas distintas
- Parâmetro `contaFinanceira` no endpoint diario-completo filtra por nome_conta_financeira
- Select dropdown no card do gráfico para selecionar conta específica

**Arquivos alterados:**
- `server/routes.ts` - novo endpoint, filtro SQL em ambos os branches
- `server/storage.ts` - parâmetro contasFinanceiras na query principal
- `client/src/pages/FluxoCaixa.tsx` - Select dropdown, query state

**Impacto arquitetural:** Novo endpoint de API (não breaking)

---

## 2026-03-06 | feat(dfc): tooltip de metodologia no Saldo Projetado

**O que foi feito:**
- Ícone Info (i) ao lado do label "Saldo Projetado" com tooltip explicando o cálculo

**Arquivos alterados:**
- `client/src/pages/FluxoCaixa.tsx` - TooltipUI com Info icon no card Saldo Projetado

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): sparklines de tendência nas linhas principais

**O que foi feito:**
- Coluna "Tendência" com mini gráficos AreaChart (recharts) para Receita Bruta Total, Lucro Bruto e Resultado Líquido
- Verde para valor positivo, vermelho para negativo, apenas meses com dados são plotados

**Por que:**
- Facilitar visualização rápida da evolução sem precisar ler todos os números

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - componente Sparkline, coluna Tendência no header e linhas derivadas

**Impacto arquitetural:** Nenhum — usa recharts já instalado

---

## 2026-03-06 | style(dre): responsividade com borda na coluna sticky

**O que foi feito:**
- Borda direita na coluna "Conta" em todos os níveis para separação visual ao scrollar horizontalmente
- Aumenta min-width das colunas de meses para 100px

**Por que:**
- Ao scrollar horizontalmente, não havia separação visual entre coluna fixa e colunas que scrollam

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - border-r em todas as td sticky

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): exportação Excel (.xlsx) com cabeçalho e separadores

**O que foi feito:**
- Dropdown "Exportar" com opções CSV e Excel (.xlsx) substituindo botão único
- Exportação inclui título com empresa/período e linhas separadoras entre seções
- Colunas auto-dimensionadas no Excel

**Por que:**
- Exportação apenas CSV era limitada; Excel é mais comum no contexto financeiro

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - funções buildExportRows, exportXLSX, DropdownMenu

**Impacto arquitetural:** Nenhum — usa xlsx já instalado, import dinâmico

---

## 2026-03-06 | fix(dre): corrige duplicidade de categorias

**O que foi feito:**
- Normaliza whitespace com REGEXP_REPLACE na query SQL
- DISTINCT ON (p.id, categoria_nome) evita contar parcela duplicada

**Por que:**
- Categorias como "05.01.09 Analista de Comunicação" apareciam duplicadas por diferenças de espaço no nome

**Arquivos alterados:**
- `server/routes/dre.ts` - query SQL do CTE categorias_expandidas

**Impacto arquitetural:** Nenhum — apenas normalização de dados

---

## 2026-03-06 | style(dre): melhora visual do AV%

**O que foi feito:**
- AV% usa text-[10px] italic para se distinguir dos valores monetários
- Headers de AV% mostram "AV%" em vez de apenas "%"

**Por que:**
- AV% precisa ser visível mas não competir visualmente com os valores principais

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderAVCell e headers

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): indicadores de variação mês a mês

**O que foi feito:**
- Tooltip no hover mostra variação % vs mês anterior (ex: "+5.2% vs Jan")
- Setas TrendingUp/TrendingDown nas linhas de Lucro Bruto, Resultado Operacional e Resultado Líquido

**Por que:**
- Permitir análise rápida de tendência sem cálculo manual

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderValueCell com prevValue, showBadge, TooltipProvider

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | feat(dre): destaque visual da coluna Acumulado (YTD)

**O que foi feito:**
- Células de acumulado recebem background diferenciado e font-semibold

**Por que:**
- Diferenciar visualmente coluna de totalização das colunas mensais

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderValueCell com isAccum

**Impacto arquitetural:** Nenhum

---

## 2026-03-06 | fix(dre): substitui R$ 0 por traço em meses sem dados

**O que foi feito:**
- Backend envia array mesesComDados indicando quais meses têm lançamentos
- Frontend mostra "—" em vez de "R$ 0" para meses sem dados, com cor mais sutil

**Por que:**
- Meses futuros mostrando R$ 0 em todas as linhas era confuso e poluído visualmente

**Arquivos alterados:**
- `client/src/pages/DRE.tsx` - renderValueCell e renderAVCell com lógica de isEmptyMonth
- `server/routes/dre.ts` - campo mesesComDados na resposta

**Impacto arquitetural:** Nenhum — novo campo na API sem breaking change

---
