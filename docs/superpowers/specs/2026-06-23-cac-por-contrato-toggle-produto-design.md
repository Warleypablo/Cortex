# Design: Toggle de produtos no CAC por contrato (BP 2026)

**Data:** 2026-06-23  
**Status:** Aprovado

## Objetivo

Adicionar sub-linhas expansíveis (toggle) na linha "CAC por contrato" da aba CAC do BP 2026, mostrando o custo por contrato de cada produto. O usuário clica em um chevron para expandir/colapsar.

## Fórmula

Para cada produto P no mês M:

```
CAC_por_contrato_produto[P][M] = CAC_total[M] / contratos_vendidos_rec[P][M]
```

Premissa: todo produto compartilha o mesmo time e CAC (sem rateio proporcional). O denominador é apenas o volume de contratos daquele produto.

Produtos cobertos: os mesmos de `PRODUTOS_CAC` = `SEGMENTOS_RECORRENTES` (Performance, Creators, etc.), usando `contratosVendidosRec` já disponível em `montarDetalhamentos`.

## Arquitetura

### 1. Tipos (`bp2026.detalhamentos.ts` e `BPDreTable.tsx`)

Adicionar campo opcional:
- **Backend** (`Linha`): `filhos?: Linha[]`
- **Frontend** (`BPLinha`): `filhos?: BPLinha[]`

Os filhos viajam embutidos na linha-mãe no JSON de resposta — sem novo endpoint.

### 2. Backend — `bp2026.detalhamentos.ts`

Após construir `porContratoSerie`, gerar `cacPorContratoFilhos: Linha[]`:

```ts
const cacPorContratoFilhos: Linha[] = PRODUTOS_CAC.map((p) => {
  const serie = Array.from({ length: 12 }, (_, i) => {
    if (i + 1 > mesCorrente) return null;
    const cont = contratosVendidosRec[p.slug]?.[i] ?? 0;
    return cont > 0 ? razao(cacTotalSerie[i], cont) : null;
  });
  return {
    ...fazLinha(
      { metrica: `cac_contrato_produto_${p.slug}`, titulo: p.titulo,
        direcao: "menor_melhor", unidade: "brl" },
      serie,
      (m) => {
        const cont = orcado[`contratos_vendidos_mrr_${p.slug}`]?.[m] ?? 0;
        return cont > 0 ? razao(cacOrcMes(m), cont) ?? 0 : 0;
      },
    ),
    subItem: true,
    semDetalhe: true,
  };
});
```

`cacPorContrato` ganha `filhos: cacPorContratoFilhos` e mantém `semDetalhe: true`.

### 3. Frontend — `BPDreTable.tsx`

- Adicionar `useState<Set<string>>` → `expanded` (chaveado por `metrica`)
- Linhas com `filhos?.length > 0` recebem `ChevronRight` / `ChevronDown` à esquerda do título
- Click no chevron: `setExpanded(prev => toggle(prev, linha.metrica))`
- Após renderizar a linha-mãe, se `expanded.has(linha.metrica)`: iterar `linha.filhos` e renderizar cada um com `pl-12` (indentação extra vs. `pl-8` do `subItem`)
- Filhos herdam `semMeta`, `semDetalhe`, sem atingimento colorido

## Critérios de aceite

1. Linha "CAC por contrato" exibe chevron clicável
2. Clicar expande sub-linhas por produto (Performance, Creators, etc.)
3. Clicar novamente colapsa
4. Valores realizado e orçado corretos por produto e por mês
5. Dark mode e light mode funcionando
6. Linhas colapsadas por padrão (estado inicial = fechado)
