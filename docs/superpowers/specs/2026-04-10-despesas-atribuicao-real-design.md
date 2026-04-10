# Despesas Atribuídas por Squad — Fim do Rateio por Receita

**Data:** 2026-04-10
**Status:** Aprovado, pronto para implementação
**Escopo:** `server/routes.ts` endpoint `/api/contribuicao-squad/dfc/bulk` + `client/src/pages/ContribuicaoSquad.tsx`

---

## Contexto

Após PR #105 (receitas pontuais reconciliadas), a aba "Contribuição por Squad" passou a mostrar receita real por squad — incluindo Tech, que saltou de R$ 32k para R$ 378k. Mas as **despesas continuam sendo rateadas por receita**, não atribuídas ao squad real:

- `despesasMensais.salarios` é o **total mensal global** (`SUM(salario_proporcional)` sem split por squad)
- `despesasMensais.freelancers` é o **total mensal global** (a query SQL traz `bm.rh_squad` por linha mas o JS descarta)
- `ContribuicaoSquad.tsx:191-195` rateia `despesa_total * (receita_squad / receita_total)`

Resultado: squad com muita receita carrega despesa alheia, squad com pouca receita parece barato. Tech (que ganhou muita receita pontual) agora aparece com despesa enorme rateada — falso. Squadra (recorrente, muito tempo de casa, muito colaborador) aparece com despesa rateada **proporcional à receita**, não à folha real.

A feature anterior corrigiu o **cálculo do total** de salários (proporcional por admissão/demissão). Esta corrige a **distribuição entre squads**.

---

## Decisões

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Escopo: só freelas, ou freelas + salários? | **Ambos** — atacar de uma vez para não deixar a UI inconsistente. |
| 2 | Shape do payload | **Campo separado** `despesasPorSquadMensais` adicional. Mantém `despesasMensais` (totais para hero/rodapé). |
| 3 | Match RH ↔ Receita | **`findRevenueSquad`** existente — mesma fuzzy lógica que mapeia "🎯 Squadra" RH → "⚓️ Squadra" receita. |
| 4 | Squads OFF / colaboradores sem squad de receita | Salário/freela continua somando no **total mensal** (`despesasMensais`), mas **NÃO** entra em `despesasPorSquadMensais`. Tabela visível por squad bate com `resumoPorSquad` (que já filtra OFF). |
| 5 | Squad com receita mas zero despesa atribuída | Mostra **R$ 0** em despesa (margem 100%). Mais honesto que rateio. |
| 6 | Performance | Agregação O(colaboradores + freelas) — trivial. Sem query nova; apenas reagrupamento JS. |

---

## Backend changes

### Novo campo na resposta

```typescript
type DespesaSquadMes = {
  salarios: number;
  freelancers: number;
};

despesasPorSquadMensais: Record<string, Record<string, DespesaSquadMes>>;
// Exemplo:
// {
//   '⚓️ Squadra': {
//     '2026-01': { salarios: 95000, freelancers: 8000 },
//     '2026-02': { salarios: 96500, freelancers: 5500 },
//     ...
//   },
//   '🖥️ Tech': { ... }
// }
```

### Salários por squad (em `server/routes.ts`)

Hoje, depois do `simulateCliente`-equivalent (na verdade, depois do loop que popula `salariosPorColab` a partir da query proporcional), o JS tem:

```typescript
const salariosPorColab = new Map<number, ColabAgg>();
// ColabAgg = { nome, squad, porMes: number[12], total }
```

**Adicionar agregação por squad** após o loop existente:

```typescript
const salariosPorSquadMes = new Map<string, Map<string, number>>(); // squad → mes → valor
for (const colab of Array.from(salariosPorColab.values())) {
  const normKey = stripEmoji(colab.squad);
  const matchedSquad = findRevenueSquad(normKey);
  if (!matchedSquad) continue; // squad não casa com receita → fica fora (decisão #4)

  for (let i = 0; i < 12; i++) {
    const valor = colab.porMes[i] || 0;
    if (valor === 0) continue;
    const mesKey = `${ano}-${String(i + 1).padStart(2, '0')}`;

    if (!salariosPorSquadMes.has(matchedSquad)) salariosPorSquadMes.set(matchedSquad, new Map());
    const inner = salariosPorSquadMes.get(matchedSquad)!;
    inner.set(mesKey, (inner.get(mesKey) || 0) + valor);
  }
}
```

**Importante:** `findRevenueSquad` precisa ser definido **ANTES** desse bloco. Hoje ele está definido depois, no bloco de `salariosDetalhesPorSquad`. Vou movê-lo para mais cedo no handler — junto com o `stripEmoji` e o `revenueSquadMap` — depois do `resumoPorSquad` (que define o conjunto de squads de receita) e antes de qualquer agregação por squad.

### Freelancers por squad

Hoje:
```typescript
const freelaPorMes = new Map<string, number>();
for (const row of freelaResult.rows) {
  const mes = row.mes;
  const valor = Number(row.valor) || 0;
  freelaPorMes.set(mes, (freelaPorMes.get(mes) || 0) + valor);
}
```

A query já traz `row.squad` (de `bm.rh_squad`). **Adicionar agregação por (squad, mes):**

```typescript
const freelaPorMes = new Map<string, number>();
const freelaPorSquadMes = new Map<string, Map<string, number>>();
for (const row of freelaResult.rows as any[]) {
  const mes = row.mes as string;
  const valor = Number(row.valor) || 0;
  const rawSquad = row.squad || 'Sem Squad';

  // Total mensal (mantém igual)
  freelaPorMes.set(mes, (freelaPorMes.get(mes) || 0) + valor);

  // Por squad — usa findRevenueSquad para mapear RH → Receita
  const normKey = stripEmoji(rawSquad);
  const matchedSquad = findRevenueSquad(normKey);
  if (!matchedSquad) continue; // sem match → fora da tabela visível

  if (!freelaPorSquadMes.has(matchedSquad)) freelaPorSquadMes.set(matchedSquad, new Map());
  const inner = freelaPorSquadMes.get(matchedSquad)!;
  inner.set(mes, (inner.get(mes) || 0) + valor);
}
```

### Montagem de `despesasPorSquadMensais`

Após popular ambos os Maps, montar o objeto final:

```typescript
const despesasPorSquadMensais: Record<string, Record<string, { salarios: number; freelancers: number }>> = {};

// Coletar todos os squads que aparecem em qualquer um dos dois Maps
const todosSquads = new Set<string>([
  ...Array.from(salariosPorSquadMes.keys()),
  ...Array.from(freelaPorSquadMes.keys()),
]);

for (const squad of Array.from(todosSquads)) {
  despesasPorSquadMensais[squad] = {};
  for (let i = 0; i < 12; i++) {
    const mesKey = `${ano}-${String(i + 1).padStart(2, '0')}`;
    const sal = salariosPorSquadMes.get(squad)?.get(mesKey) || 0;
    const fre = freelaPorSquadMes.get(squad)?.get(mesKey) || 0;
    if (sal === 0 && fre === 0) continue;
    despesasPorSquadMensais[squad][mesKey] = { salarios: sal, freelancers: fre };
  }
}
```

### Adicionar ao `res.json`

```typescript
res.json({
  ano,
  squad: squadFilter || 'todos',
  squads: Array.from(squadsSet).sort(),
  meses: monthlyData,
  resumoPorSquad,
  despesasMensais,
  despesasPorSquadMensais,    // ← novo
  salariosDetalhesPorSquad,
  receitasDetalhesPorSquad,
});
```

---

## Frontend changes

### Adicionar tipo

`client/src/pages/ContribuicaoSquad.tsx`, junto com `BulkResponse`:

```typescript
interface DespesasPorSquadMensais {
  [squad: string]: {
    [mes: string]: {
      salarios: number;
      freelancers: number;
    };
  };
}

interface BulkResponse {
  // ... existentes
  despesasPorSquadMensais?: DespesasPorSquadMensais;
}
```

### Substituir `despesaSquadMes` e `despesaComponenteSquadMes`

ANTES (linhas 191-202):
```typescript
const despesaSquadMes = (sq, mesIdx) => {
  const receitaMes = receitaTotalPorMes[mesIdx];
  const proporcao = receitaMes > 0 ? (sq.porMes[mesIdx] || 0) / receitaMes : 0;
  return despesaTotalPorMes[mesIdx] * proporcao;
};

const despesaComponenteSquadMes = (sq, mesIdx, componente) => {
  const receitaMes = receitaTotalPorMes[mesIdx];
  const proporcao = receitaMes > 0 ? (sq.porMes[mesIdx] || 0) / receitaMes : 0;
  return componente[mesIdx] * proporcao;
};
```

DEPOIS:
```typescript
const despesaSquadMes = (sq: typeof squadRanking[0], mesIdx: number) => {
  const mesKey = monthlyResults[mesIdx].mes;
  const desp = bulkData?.despesasPorSquadMensais?.[sq.squad]?.[mesKey];
  return (desp?.salarios || 0) + (desp?.freelancers || 0);
};

// Tipo: 'salarios' | 'freelancers' (string literal em vez de array)
const despesaComponenteSquadMes = (sq: typeof squadRanking[0], mesIdx: number, tipo: 'salarios' | 'freelancers') => {
  const mesKey = monthlyResults[mesIdx].mes;
  return bulkData?.despesasPorSquadMensais?.[sq.squad]?.[mesKey]?.[tipo] || 0;
};
```

### Atualizar chamadas de `despesaComponenteSquadMes`

Hoje a chamada passa um array (linha ~488):
```typescript
{[
  { label: "Salários", data: tableData.salariosPorMes, expandable: true },
  { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
].map(({ label, data, expandable }) => {
  // ...
  const val = tableData.despesaComponenteSquadMes(sq, i, data);
```

Mudar para passar uma string literal:
```typescript
{[
  { label: "Salários", tipo: 'salarios' as const, expandable: true },
  { label: "Freelancers", tipo: 'freelancers' as const, expandable: false },
].map(({ label, tipo, expandable }) => {
  // ...
  const val = tableData.despesaComponenteSquadMes(sq, i, tipo);
```

`tableData.salariosPorMes` e `tableData.freelancersPorMes` continuam existindo (são usados no rodapé total).

### `squadRanking` recalcular `despesaRateada` e `resultadoLiquido`

Linha ~159 hoje calcula `despesaRateada` a partir do `totalDespAnual` global. Isso fica errado depois da mudança porque o total da empresa (incluindo squads OFF) vai ser distribuído errado.

Substituir por soma das despesas REAIS do squad:

```typescript
return bulkData.resumoPorSquad.map((sq) => {
  // Despesa real do squad (sem rateio)
  let despesaSquad = 0;
  for (const m of monthlyResults) {
    const desp = bulkData.despesasPorSquadMensais?.[sq.squad]?.[m.mes];
    if (desp) despesaSquad += desp.salarios + desp.freelancers;
  }
  return {
    ...sq,
    contribuicaoPct: totalGeral > 0 ? (sq.receitaTotal / totalGeral) * 100 : 0,
    despesaRateada: despesaSquad,  // nome ruim agora, mas mantém pra não quebrar consumidores
    resultadoLiquido: sq.receitaTotal - despesaSquad,
  };
});
```

`totalDespAnual` deixa de ser usado nesse bloco (mas ainda pode ser computado pra hero "Total Despesas").

---

## Edge cases

| Caso | Comportamento |
|------|---------------|
| Squad em `resumoPorSquad` mas sem despesa atribuída | Linha aparece com R$ 0 em despesa, margem 100%. Visível no UI. |
| Squad com despesa mas sem receita (ex: squad inteiro de freela externo sem receita atribuída) | Não aparece na tabela porque `squadRanking` é montado a partir de `resumoPorSquad`. Sua despesa fica em `despesasPorSquadMensais` mas ninguém olha. Ok. |
| Colaborador com squad RH "🎯 Squadra" → squad receita "⚓️ Squadra" | `findRevenueSquad("squadra")` casa pelo prefixo. Mesma lógica de `salariosDetalhesPorSquad`. |
| Colaborador com squad RH "Sem Squad" | `findRevenueSquad("sem squad")` provavelmente não casa → não entra em `despesasPorSquadMensais`. Soma só no total. |
| Freela responsável "João" sem match em `rh_pessoal` | `bm.rh_squad` é null → squad vira "Sem Squad" → não casa → fica fora. Soma só no total. |
| Total `despesasMensais.salarios` ≠ Σ `despesasPorSquadMensais[*].salarios` | Diferença = colaboradores em squads não-mapeados. **Esperado**, e o UI deve refletir isso (hero mostra total, tabela mostra atribuído). |

---

## Validação

1. **Sanity:** `Σ despesasPorSquadMensais[*][*].salarios ≤ Σ despesasMensais[*].salarios` (todos os meses)
2. **Tech:** despesa real do squad Tech após mudança. Comparar com rateio antigo (que era `despesa_total × receita_tech / receita_total ≈ R$ 4.4M × 0.096 ≈ R$ 422k`). Esperado: provavelmente bem menor (Tech tem poucos colaboradores).
3. **Squadra:** despesa real (recorrente, muitos colaboradores). Esperado: maior do que o rateio mostrava.
4. **Browser:** abrir aba, expandir Salários e Freelancers em 2-3 squads, conferir que valores são coerentes com o squad real.

---

## Fora de escopo

- Despesas administrativas/marketing globais (não pertencem a squad nenhum) — não tratadas. Se aparecerem como "Sem Squad" no Inhire, ficam só no total. Bucket "Compartilhado" pode ser feito num plano futuro.
- Alocação parcial de colaborador entre múltiplos squads (ex: PM dividida 50/50 entre Tech e Makers) — não tratada. Cada colaborador é 100% de 1 squad.
- Histórico de mudança de squad — usa squad atual de `rh_pessoal`. Mesmo limite das features anteriores.

---

## Próximos passos

Plano de implementação detalhado em `docs/superpowers/plans/2026-04-10-despesas-atribuicao-real.md`.
