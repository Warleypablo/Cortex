# Design: Melhorias Contábeis da DRE

**Data:** 2026-03-07
**Objetivo:** Tornar a DRE contabilmente correta (CPC/Lei 6.404/76) mantendo valor gerencial
**Contexto:** Peixoto = Simples Nacional, Turbo = Lucro Real

## Diagnóstico

7 gaps identificados, 4 priorizados (abordagem progressiva):

1. **Sem Deduções da Receita Bruta** — ISS/PIS/COFINS (05.05) e Estornos (05.06) estão misturados em Custos Operacionais
2. **Sem Receita Líquida** — DRE pula de Receita Bruta direto para Lucro Bruto
3. **AV% sobre base errada** — usa Receita Bruta Total; padrão é Receita Líquida
4. **Sem IR/CSLL** — grupo 08 existe no Conta Azul mas não é mapeado no backend

## Nova Estrutura

```
(+) RECEITA BRUTA OPERACIONAL (grupo 03)
    03.01 Receita Commerce
    03.02 Receita Variável
    03.03 Receita Stack Digital
    03.04 Receita Cursos e Treinamentos
    03.05 Receita Ventures

(-) DEDUÇÕES DA RECEITA BRUTA (05.05 + 05.06, reclassificados)
    05.05.01 ISS
    05.05.02 PIS COFINS
    05.05.03 Simples Nacional
    05.05.04 Impostos Retidos
    05.06.01 Estornos e Devoluções de Serviço

(=) RECEITA OPERACIONAL LÍQUIDA [nova linha derivada]

(+) RECEITAS NÃO OPERACIONAIS (grupo 04)
    04.01 Receita Financeiras
    04.02 Recebimento de Empréstimos
    04.03 Outras Receitas Não Operacionais

(=) RECEITA LÍQUIDA TOTAL [nova linha derivada]

(-) CUSTOS OPERACIONAIS (grupo 05, exceto 05.05 e 05.06)
    05.01 Mão de Obra Operacional
    05.02 Serviços Terceirizados
    05.03 Custo Stack Digital
    05.04 Outros Custos de Operação

(=) LUCRO BRUTO [existente, recalculado]

(-) DESPESAS OPERACIONAIS (grupo 06)
    06.01..06.12 (mantém todas as subcategorias)

(=) RESULTADO OPERACIONAL (EBIT) [renomeado de EBITDA]

(-) DESPESAS NÃO OPERACIONAIS (grupo 07)
    07.01 Retirada dos Sócios

(=) RESULTADO ANTES DO IR/CSLL (LAIR) [nova linha derivada]

(-) IR E CONTRIBUIÇÃO SOCIAL (grupo 08) [novo grupo]
    08.01.01 CSLL
    08.01.02 IRPJ

(=) RESULTADO LÍQUIDO [existente, recalculado]
```

## Mudanças Técnicas

### Backend (server/routes/dre.ts)

1. **GRUPO_MAP**: adicionar grupo '08' e novo grupo virtual '02' (deduções)
2. **Reclassificar 05.05 e 05.06**: no processamento pós-query, mover essas categorias para um grupo virtual "deduções" em vez de computá-las como custos operacionais
3. **Novos subtotais**:
   - `deducoes_receita_bruta` (soma de 05.05 + 05.06)
   - `receita_operacional_liquida` = receita_bruta_operacional - deducoes
   - `receita_liquida_total` = receita_operacional_liquida + receitas_nao_operacionais
   - `lair` = resultado_operacional - despesas_nao_operacionais
   - `ir_csll` (soma de grupo 08)
4. **Recalcular derivados**:
   - `lucro_bruto` = receita_liquida_total - custos_operacionais (sem 05.05/05.06)
   - `resultado_liquido` = lair - ir_csll

### Frontend (client/src/pages/DRE.tsx)

1. **DRE_SECTIONS**: atualizar array com novas seções (deduções, receita líquida, LAIR, IR/CSLL)
2. **AV%**: trocar base de `receita_bruta_total` para `receita_liquida_total`
3. **Labels**: "RESULTADO OPERACIONAL" em vez de "EBITDA"
4. **Cores**: adicionar estilo visual para novas linhas derivadas
5. **Exportação**: atualizar buildExportRows com novas seções

## Decisões

- **Regime de caixa mantido** — útil para gestão, com nota "(Regime de Caixa)" no subtítulo
- **05.05/05.06 reclassificados no código, não no Conta Azul** — sem impacto em outras features
- **Grupo 08 só aparece se houver dados** — Peixoto (Simples) não terá IR/CSLL separado
