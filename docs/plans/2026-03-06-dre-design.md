# Design: DRE (Demonstração do Resultado do Exercício)

**Data:** 2026-03-06
**Status:** Aprovado

## Decisões

| Aspecto | Decisão |
|---------|---------|
| Escopo | DRE Completa com subcategorias (plano de contas) |
| Regime | Caixa (data_quitacao + status QUITADO) |
| Período | Visão anual (12 meses + acumulado YTD) |
| Empresas | Consolidada + filtro por empresa individual |
| Abordagem | Query-based (sem tabela nova, tudo sobre caz_parcelas) |

## Estrutura da DRE

```
(+) RECEITA BRUTA OPERACIONAL
    03.01 Receita Commerce
    03.02 Receita Variável
    03.03 Receita Stack Digital
    03.04 Receita Cursos e Treinamentos
    03.05 Receita Ventures

(+) RECEITAS NÃO OPERACIONAIS
    04.xx (categorias do grupo 04)

(=) RECEITA BRUTA TOTAL

(-) CUSTOS OPERACIONAIS
    05.xx (todas subcategorias do grupo 05)

(=) LUCRO BRUTO

(-) DESPESAS OPERACIONAIS
    06.xx (todas subcategorias do grupo 06)

(=) RESULTADO OPERACIONAL (EBITDA)

(-) DESPESAS NÃO OPERACIONAIS
    07.xx (todas subcategorias do grupo 07)

(=) RESULTADO LÍQUIDO
```

## Interface (UI)

- **Filtros:** Ano (dropdown) + Empresa (dropdown: Consolidada | individuais)
- **Tabela estilo planilha:**
  - Coluna fixa esquerda: nome da conta (indentada para subcategorias)
  - 12 colunas mensais (Jan–Dez)
  - Coluna final: Acumulado YTD
- **Linhas de grupo:** background destacado, bold, colapsáveis
- **Linhas de subtotal:** bold com separador visual
- **Cores:** negativos em vermelho, positivos em preto/verde
- **AV%:** análise vertical opcional (% sobre Receita Líquida)
- **Export:** download CSV/Excel

## Backend

- **Endpoint:** `GET /api/financeiro/dre?ano=2026&empresa=todas`
- **Source:** `caz_parcelas` WHERE `status = 'QUITADO'`
- **Data:** `data_quitacao` (regime de caixa)
- **Agrupamento:** `categoria_nome` (com regexp_split_to_table) × mês
- **Hierarquia:** derivada do prefixo da categoria
- **Subtotais:** calculados no backend

### Mapeamento de grupos

```
03.xx → RECEITA BRUTA OPERACIONAL (soma positiva)
04.xx → RECEITAS NÃO OPERACIONAIS (soma positiva)
05.xx → CUSTOS OPERACIONAIS (soma negativa)
06.xx → DESPESAS OPERACIONAIS (soma negativa)
07.xx → DESPESAS NÃO OPERACIONAIS (soma negativa)
```

## Navegação

- Menu: Financeiro → DRE
- Rota: `/dashboard/dre`
- Permissão: `fin.dre`
