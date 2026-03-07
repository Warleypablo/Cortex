# DRE Melhorias Contábeis — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar a DRE contabilmente correta (CPC/Lei 6.404/76) com deduções, receita líquida, LAIR e IR/CSLL.

**Architecture:** Reclassificar categorias 05.05/05.06 como deduções no backend, adicionar grupo 08, recalcular subtotais derivados, atualizar frontend com nova estrutura e AV% corrigido.

**Tech Stack:** TypeScript, Express, Drizzle ORM (SQL), React, Tailwind CSS, Recharts

---

### Task 1: Backend — Adicionar grupo 08 e grupo virtual de deduções ao GRUPO_MAP

**Files:**
- Modify: `server/routes/dre.ts:34-40` (GRUPO_MAP)

**Step 1: Adicionar grupo 08 e grupo virtual DD ao GRUPO_MAP**

Em `server/routes/dre.ts`, substituir o GRUPO_MAP (linhas 34-40) por:

```typescript
const GRUPO_MAP: Record<string, { nome: string; tipo: 'receita' | 'despesa' }> = {
  '03': { nome: 'RECEITA BRUTA OPERACIONAL', tipo: 'receita' },
  '04': { nome: 'RECEITAS NÃO OPERACIONAIS', tipo: 'receita' },
  '05': { nome: 'CUSTOS OPERACIONAIS', tipo: 'despesa' },
  '06': { nome: 'DESPESAS OPERACIONAIS', tipo: 'despesa' },
  '07': { nome: 'DESPESAS NÃO OPERACIONAIS', tipo: 'despesa' },
  '08': { nome: 'IR E CONTRIBUIÇÃO SOCIAL', tipo: 'despesa' },
  'DD': { nome: 'DEDUÇÕES DA RECEITA BRUTA', tipo: 'despesa' },
};
```

O grupo `DD` é virtual — não existe no Conta Azul. Categorias 05.05 e 05.06 serão reclassificadas para ele no processamento.

**Step 2: Verificar que o servidor inicia sem erros**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev`
Expected: Server starts without errors

**Step 3: Commit**

```bash
git add server/routes/dre.ts
git commit -m "feat(dre): adiciona grupo 08 (IR/CSLL) e DD (deduções) ao GRUPO_MAP"
```

---

### Task 2: Backend — Reclassificar 05.05/05.06 como deduções e adicionar novos subtotais

**Files:**
- Modify: `server/routes/dre.ts:5-32` (interfaces)
- Modify: `server/routes/dre.ts:104-177` (processamento e subtotais)

**Step 1: Atualizar a interface DREResponse com novos subtotais**

Substituir a interface `DREResponse` (linhas 16-32) por:

```typescript
interface DREResponse {
  ano: number;
  empresa: string;
  linhas: DRELineItem[];
  parentCategories: Record<string, string>;
  subtotais: {
    receita_bruta_operacional: Record<string, number>;
    deducoes_receita_bruta: Record<string, number>;
    receita_operacional_liquida: Record<string, number>;
    receitas_nao_operacionais: Record<string, number>;
    receita_liquida_total: Record<string, number>;
    custos_operacionais: Record<string, number>;
    lucro_bruto: Record<string, number>;
    despesas_operacionais: Record<string, number>;
    resultado_operacional: Record<string, number>;
    despesas_nao_operacionais: Record<string, number>;
    lair: Record<string, number>;
    ir_csll: Record<string, number>;
    resultado_liquido: Record<string, number>;
  };
}
```

**Step 2: Adicionar lógica de reclassificação no loop de processamento**

Após a linha `if (!grupoInfo) continue;` (linha 117), adicionar reclassificação de 05.05/05.06:

```typescript
// Reclassificar 05.05 e 05.06 como Deduções da Receita Bruta
const DEDUCAO_PARENTS = new Set(['05.05', '05.06']);
let effectiveGrupo = grupoKey;
if (DEDUCAO_PARENTS.has(parentKey)) {
  effectiveGrupo = 'DD';
}
```

Depois, usar `effectiveGrupo` em vez de `grupoKey` ao criar o DRELineItem:

```typescript
if (!categoriaMap.has(catNome)) {
  categoriaMap.set(catNome, {
    categoria_id: effectiveGrupo + '.' + catNome,
    categoria_nome: catNome,
    grupo: effectiveGrupo,
    grupo_nome: effectiveGrupo === 'DD' ? 'DEDUÇÕES DA RECEITA BRUTA' : grupoInfo.nome,
    parent_key: parentKey,
    parent_nome: parentCategories[parentKey] || parentKey,
    tipo: effectiveGrupo === 'DD' ? 'despesa' : grupoInfo.tipo,
    valores: emptyMonths(),
  });
}
```

**Step 3: Atualizar cálculo de subtotais**

Substituir o bloco de subtotais (linhas 143-177) por:

```typescript
const subtotais = {
  receita_bruta_operacional: emptyMonths(),
  deducoes_receita_bruta: emptyMonths(),
  receita_operacional_liquida: emptyMonths(),
  receitas_nao_operacionais: emptyMonths(),
  receita_liquida_total: emptyMonths(),
  custos_operacionais: emptyMonths(),
  lucro_bruto: emptyMonths(),
  despesas_operacionais: emptyMonths(),
  resultado_operacional: emptyMonths(),
  despesas_nao_operacionais: emptyMonths(),
  lair: emptyMonths(),
  ir_csll: emptyMonths(),
  resultado_liquido: emptyMonths(),
};

for (const linha of linhas) {
  const keys = Object.keys(linha.valores);
  for (const k of keys) {
    if (linha.grupo === '03') subtotais.receita_bruta_operacional[k] += linha.valores[k];
    if (linha.grupo === 'DD') subtotais.deducoes_receita_bruta[k] += linha.valores[k];
    if (linha.grupo === '04') subtotais.receitas_nao_operacionais[k] += linha.valores[k];
    if (linha.grupo === '05') subtotais.custos_operacionais[k] += linha.valores[k];
    if (linha.grupo === '06') subtotais.despesas_operacionais[k] += linha.valores[k];
    if (linha.grupo === '07') subtotais.despesas_nao_operacionais[k] += linha.valores[k];
    if (linha.grupo === '08') subtotais.ir_csll[k] += linha.valores[k];
  }
}

// Derived subtotals
const keys = Object.keys(emptyMonths());
for (const k of keys) {
  subtotais.receita_operacional_liquida[k] =
    subtotais.receita_bruta_operacional[k] - subtotais.deducoes_receita_bruta[k];
  subtotais.receita_liquida_total[k] =
    subtotais.receita_operacional_liquida[k] + subtotais.receitas_nao_operacionais[k];
  subtotais.lucro_bruto[k] =
    subtotais.receita_liquida_total[k] - subtotais.custos_operacionais[k];
  subtotais.resultado_operacional[k] =
    subtotais.lucro_bruto[k] - subtotais.despesas_operacionais[k];
  subtotais.lair[k] =
    subtotais.resultado_operacional[k] - subtotais.despesas_nao_operacionais[k];
  subtotais.resultado_liquido[k] =
    subtotais.lair[k] - subtotais.ir_csll[k];
}
```

**Step 4: Reiniciar servidor e testar endpoint**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev`
Depois: `curl 'http://localhost:3000/api/financeiro/dre?ano=2026' | jq '.subtotais | keys'`

Expected: Deve retornar as novas chaves incluindo `deducoes_receita_bruta`, `receita_operacional_liquida`, `receita_liquida_total`, `lair`, `ir_csll`

**Step 5: Commit**

```bash
git add server/routes/dre.ts
git commit -m "feat(dre): reclassifica 05.05/05.06 como deduções, adiciona receita líquida e LAIR"
```

---

### Task 3: Frontend — Atualizar tipos e DRE_SECTIONS

**Files:**
- Modify: `client/src/pages/DRE.tsx:30-89` (types e DRE_SECTIONS)

**Step 1: Atualizar interface DREData com novos subtotais**

Substituir a interface `DREData.subtotais` (linhas 35-45) por:

```typescript
subtotais: {
  receita_bruta_operacional: Record<string, number>;
  deducoes_receita_bruta: Record<string, number>;
  receita_operacional_liquida: Record<string, number>;
  receitas_nao_operacionais: Record<string, number>;
  receita_liquida_total: Record<string, number>;
  custos_operacionais: Record<string, number>;
  lucro_bruto: Record<string, number>;
  despesas_operacionais: Record<string, number>;
  resultado_operacional: Record<string, number>;
  despesas_nao_operacionais: Record<string, number>;
  lair: Record<string, number>;
  ir_csll: Record<string, number>;
  resultado_liquido: Record<string, number>;
};
```

**Step 2: Atualizar DRE_SECTIONS com nova estrutura contábil**

Substituir o array `DRE_SECTIONS` (linhas 70-89) por:

```typescript
const DRE_SECTIONS: (DREGroup | DREDerived)[] = [
  // 1. Receita Bruta Operacional
  { key: "03", grupoFilter: "03", label: "(+) RECEITA BRUTA OPERACIONAL", subtotalKey: "receita_bruta_operacional" },
  // 2. Deduções da Receita Bruta
  { key: "DD", grupoFilter: "DD", label: "(-) DEDUÇÕES DA RECEITA BRUTA", subtotalKey: "deducoes_receita_bruta" },
  // 3. Receita Operacional Líquida (derived)
  { label: "(=) RECEITA OPERACIONAL LÍQUIDA", subtotalKey: "receita_operacional_liquida", bgClass: "bg-blue-50 dark:bg-blue-950/30", borderClass: "border-t-2" },
  // 4. Receitas Não Operacionais
  { key: "04", grupoFilter: "04", label: "(+) RECEITAS NÃO OPERACIONAIS", subtotalKey: "receitas_nao_operacionais" },
  // 5. Receita Líquida Total (derived)
  { label: "(=) RECEITA LÍQUIDA TOTAL", subtotalKey: "receita_liquida_total", bgClass: "bg-blue-100 dark:bg-blue-950/50", borderClass: "border-t-2" },
  // 6. Custos Operacionais
  { key: "05", grupoFilter: "05", label: "(-) CUSTOS OPERACIONAIS", subtotalKey: "custos_operacionais" },
  // 7. Lucro Bruto (derived)
  { label: "(=) LUCRO BRUTO", subtotalKey: "lucro_bruto", bgClass: "bg-green-50 dark:bg-green-950/30", borderClass: "border-t-2" },
  // 8. Despesas Operacionais
  { key: "06", grupoFilter: "06", label: "(-) DESPESAS OPERACIONAIS", subtotalKey: "despesas_operacionais" },
  // 9. Resultado Operacional (derived)
  { label: "(=) RESULTADO OPERACIONAL (EBIT)", subtotalKey: "resultado_operacional", bgClass: "bg-yellow-50 dark:bg-yellow-950/30", borderClass: "border-t-2" },
  // 10. Despesas Não Operacionais
  { key: "07", grupoFilter: "07", label: "(-) DESPESAS NÃO OPERACIONAIS", subtotalKey: "despesas_nao_operacionais" },
  // 11. LAIR (derived)
  { label: "(=) RESULTADO ANTES DO IR/CSLL (LAIR)", subtotalKey: "lair", bgClass: "bg-amber-50 dark:bg-amber-950/30", borderClass: "border-t-2" },
  // 12. IR e Contribuição Social
  { key: "08", grupoFilter: "08", label: "(-) IR E CONTRIBUIÇÃO SOCIAL", subtotalKey: "ir_csll" },
  // 13. Resultado Líquido (derived)
  { label: "(=) RESULTADO LÍQUIDO", subtotalKey: "resultado_liquido", bgClass: "bg-emerald-50 dark:bg-emerald-950/30", borderClass: "border-t-4", textClass: "text-lg" },
];
```

**Step 3: Commit**

```bash
git add client/src/pages/DRE.tsx
git commit -m "feat(dre): atualiza tipos e DRE_SECTIONS com estrutura contábil completa"
```

---

### Task 4: Frontend — Corrigir base do AV% e labels

**Files:**
- Modify: `client/src/pages/DRE.tsx:270-279` (receitaBrutaTotal → receitaLiquidaTotal)

**Step 1: Corrigir base do AV%**

Substituir `receitaBrutaTotal` e `receitaBrutaTotalAcum` (linhas 270-279) por:

```typescript
// AV% base: Receita Líquida Total (padrão contábil)
const receitaLiquidaTotal = useMemo(() => {
  if (!data) return emptyMonthsRecord();
  return data.subtotais.receita_liquida_total;
}, [data]);

const receitaLiquidaTotalAcum = useMemo(() => {
  if (!data) return 0;
  return computeAccumulated(data.subtotais.receita_liquida_total);
}, [data]);
```

**Step 2: Substituir todas as referências**

Usar find-and-replace no arquivo:
- `receitaBrutaTotal[` → `receitaLiquidaTotal[`
- `receitaBrutaTotalAcum` → `receitaLiquidaTotalAcum`

Ocorrências esperadas: ~8 substituições (em renderAVCell calls nas linhas 446, 451, 553, 558, 598, 610)

**Step 3: Atualizar RESULT_KEYS e SPARKLINE_KEYS**

Substituir os sets (linhas 128-139) por:

```typescript
const RESULT_KEYS: Set<string> = new Set([
  "lucro_bruto",
  "resultado_operacional",
  "lair",
  "resultado_liquido",
]);

const SPARKLINE_KEYS: Set<string> = new Set([
  "receita_operacional_liquida",
  "lucro_bruto",
  "resultado_liquido",
]);
```

**Step 4: Atualizar subtítulo com nota de regime de caixa**

Na linha 751, alterar o CardTitle:

```tsx
<CardTitle className="text-lg text-gray-900 dark:text-white">
  Demonstração do Resultado do Exercício — {ano}
  <span className="text-xs font-normal text-gray-500 dark:text-zinc-400 ml-2">(Regime de Caixa)</span>
</CardTitle>
```

**Step 5: Commit**

```bash
git add client/src/pages/DRE.tsx
git commit -m "feat(dre): corrige AV% para usar receita líquida, adiciona nota regime de caixa"
```

---

### Task 5: Frontend — Atualizar exportação e testar visualmente

**Files:**
- Modify: `client/src/pages/DRE.tsx:174-205` (buildExportRows)

**Step 1: Atualizar buildExportRows**

A função `buildExportRows` já itera sobre `DRE_SECTIONS`, então a exportação se atualiza automaticamente ao mudar o array. Verificar que os novos subtotalKeys existem no tipo.

Nenhuma mudança de código necessária aqui — a função é genérica o suficiente.

**Step 2: Reiniciar servidor e testar no browser**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev`

Verificar no browser `http://localhost:3000/dashboard/dre`:
- [ ] Deduções aparecem após Receita Bruta Operacional
- [ ] Receita Operacional Líquida aparece como linha derivada azul
- [ ] Receita Líquida Total aparece como linha derivada azul mais escura
- [ ] Custos Operacionais NÃO incluem mais 05.05/05.06
- [ ] LAIR aparece antes de IR/CSLL
- [ ] Grupo 08 (IR/CSLL) aparece se houver dados
- [ ] Resultado Líquido = LAIR - IR/CSLL
- [ ] AV% usa Receita Líquida Total como base
- [ ] Exportação CSV/Excel reflete nova estrutura
- [ ] Dark mode funciona em todas as novas linhas

**Step 3: Commit final**

```bash
git add client/src/pages/DRE.tsx server/routes/dre.ts
git commit -m "feat(dre): overhaul contábil completo — deduções, receita líquida, LAIR, IR/CSLL"
```

**Step 4: Push**

```bash
git push
```
