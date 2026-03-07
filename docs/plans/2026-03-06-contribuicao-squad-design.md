# Design: Overhaul Contribuição por Squad

**Data:** 2026-03-06
**Objetivo:** Redesign completo da página de Contribuição por Squad focado no uso executivo (CEO).
**Abordagem:** Executive Dashboard First (ranking visual + resumo anual + detalhamento colapsável).

## Contexto

O CEO usa esta tela para ver **contribuição % líquida** de cada squad rapidamente. O estado atual enterra essa informação na última linha de uma tabela com 12 colunas e hierarquia de 4 níveis, forçando scroll horizontal e vertical.

## Problemas Identificados

1. Contribuição % enterrada na última linha da tabela
2. 12 colunas de meses sem resumo anual
3. Sem ranking visual de squads
4. Imposto 18% hardcoded (precisa ser configurável)
5. Hierarquia 4 níveis excessiva para visão executiva
6. Tooltip limitada (max 5 parcelas)
7. URL confusa (`/contribuicao-operador` vs título "Squad")
8. Sem indicação de tendência (crescendo/caindo)

## Design Aprovado

### Seção 1: Header + Controles

- Título: "Contribuição por Squad"
- Controles: Seletor de Ano | Input Alíquota Imposto (%) default 18% | Seletor Squad
- Alíquota editável com stepper ou input numérico

### Seção 2: Hero — Ranking de Squads

Cards ordenados por contribuição % (maior → menor):
- Posição ordinal colorida (1º, 2º, 3º...)
- Barra de progresso proporcional ao total
- Receita Bruta | Resultado Líquido | Variação tendência
- Clicável → filtra squad no detalhamento

### Seção 3: Resumo Anual (tabela compacta)

Tabela sem scroll horizontal:
- Colunas: Squad | Receita Bruta | Impostos | Resultado Líquido | Contribuição % | Tendência (sparkline 12 meses)
- Ordenável por qualquer coluna
- Linha Total no rodapé
- Impostos calculados com alíquota configurável

### Seção 4: Detalhamento Mensal (colapsável)

- Começa colapsado
- Botão "Ver detalhamento mensal" expande
- Mantém hierarquia: Categoria > Cliente > Serviço > Parcelas
- Melhorias: heatmap visual, coluna Total Anual sticky, tooltip expandida

### Seção 5: UX

- Hover micro-interactions
- Dark mode consistente
- Loading skeletons proporcionais
- Empty state com mensagem clara

## Restrições

- Não alterar endpoints de API (apenas frontend)
- Manter compatibilidade dark/light mode
- Tailwind CSS only
- Mobile-friendly
