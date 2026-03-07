# Changelog

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
