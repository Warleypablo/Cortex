# DRE - AV% sobre Faturamento Bruto + Drill-down por Fornecedor

## Contexto

A DRE atual tem AV% baseado em Receita Líquida Total. O usuário quer:
1. Trocar a base para **Faturamento Bruto** (grupo 03)
2. Adicionar **drill-down por fornecedor** nas categorias de despesa (visão agrupada), seguindo a mesma lógica da DFC

## 1. Análise Vertical (AV%) sobre Faturamento Bruto

**Mudança**: Trocar a base do cálculo de AV% de "Receita Líquida Total" para Receita Bruta (subtotal do grupo 03).

- Fórmula: `AV% = (valor_da_linha / receita_bruta_do_mes) * 100`
- Aplica-se a todas as linhas (receitas e despesas)
- O toggle AV% existente continua funcionando igual, só muda a base
- Impacto: apenas frontend (DRE.tsx), alterar referência de `subtotais.receita_liquida_total` para `subtotais["03"]` (receita bruta)

## 2. Drill-down por Fornecedor (só despesas)

### Backend (`server/routes/dre.ts`)

- Adicionar LEFT JOIN com `caz_clientes` (mesma lógica da DFC em `server/storage.ts:4768-4786`):
  ```sql
  LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = COALESCE(c.ids, c.id::text)
  ```
- Selecionar `COALESCE(c.nome, c.empresa, 'Não identificado') as fornecedor` e `p.valor_bruto`
- Para cada categoria-folha de despesa, retornar array `fornecedores` agrupado por fornecedor com valores por mês
- Interface: `{ nome: string, valores: Record<string, number> }` dentro de cada `DRELineItem` de despesa

### Frontend (`client/src/pages/DRE.tsx`)

- Nas categorias-folha de despesa (XX.YY.ZZ) na visão agrupada, adicionar ícone de expand (chevron)
- Ao clicar, expande linhas inline abaixo mostrando cada fornecedor
- Colunas: nome do fornecedor + valores por mês (mesma grade da DRE)
- Estilo: indent maior, fonte menor, cor mais suave para distinguir do nível de categoria
- Interface `DRELineItem` ganha campo opcional `fornecedores?: { nome: string, valores: Record<string, number> }[]`

## Referência: DFC (padrão a seguir)

- JOIN: `storage.ts:4768-4786`
- Parcelas com fornecedor: `DfcParcela.fornecedor`
- Expansão inline: mesmo padrão visual de parent→children na DRE atual
