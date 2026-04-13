# Despesas Atribuídas por Squad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Adicionar campo `despesasPorSquadMensais` à resposta do endpoint `/api/contribuicao-squad/dfc/bulk` agregando salários e freelancers por (squad de receita, mês), e fazer o frontend usar esse lookup direto em vez de ratear despesa pelo `receita_squad / receita_total`.

**Architecture:** Agregação 100% em JS no backend (sem nova query SQL). Após popular `salariosPorColab` (já existe) e `freelaResult` (já existe), adicionar dois Maps `salariosPorSquadMes` e `freelaPorSquadMes` que usam `findRevenueSquad` para mapear squads RH ↔ Receita. Combinar nos dois em `despesasPorSquadMensais` no shape `Record<squad, Record<mes, { salarios, freelancers }>>`. Frontend troca `despesaSquadMes` (rateio) por lookup direto. Mantém `despesasMensais` intacto para totais.

**Tech Stack:** TypeScript, Express, Drizzle (apenas reuso), React.

**Spec:** `docs/superpowers/specs/2026-04-10-despesas-atribuicao-real-design.md`

---

## File Structure

| Arquivo | O que muda |
|---------|------------|
| `server/routes.ts` (~5341–5900) | Mover `stripEmoji`/`revenueSquadMap`/`findRevenueSquad` para mais cedo no handler. Adicionar agregação de salários por squad. Adicionar agregação de freelancers por squad (na query loop). Montar `despesasPorSquadMensais`. Adicionar ao `res.json`. |
| `client/src/pages/ContribuicaoSquad.tsx` (~30-220) | Adicionar interface `DespesasPorSquadMensais`. Reescrever `despesaSquadMes` e `despesaComponenteSquadMes` para fazer lookup direto. Atualizar chamadas no JSX (passar string `'salarios'/'freelancers'` em vez de array). Recalcular `squadRanking.despesaRateada` a partir do novo campo. |

Sem novos arquivos. Sem mudança de query SQL.

---

## Branch

`feature/despesas-atribuicao-real` (já criada).

---

## Tasks

### Task 1: Backend — mover findRevenueSquad para mais cedo + agregar despesas por squad

**Files:**
- Modify: `server/routes.ts` (handler `/api/contribuicao-squad/dfc/bulk`)

#### Step 1: Localizar bloco de `stripEmoji` / `revenueSquadMap` / `findRevenueSquad`

Use Grep para localizar:
```bash
grep -n "stripEmoji\|revenueSquadMap\|findRevenueSquad" server/routes.ts | head -20
```

Hoje esses 3 helpers estão definidos dentro do bloco `// Detalhes individuais de salários — agregados a partir de salariosPorColab` (~linha 5900-5920), DEPOIS de:
- query de salários
- query de cxcs (já removida)
- query de freelas
- montagem de despesasMensais
- montagem de squadSummaryMap/resumoPorSquad
- montagem de receitasDetalhesPorSquad

E sào usados SOMENTE para construir `salariosDetalhesPorSquad` ali em seguida.

**Decisão:** mover esses 3 helpers para LOGO APÓS a definição de `resumoPorSquad` (que é o que define os squads de receita). Isso permite que sejam reutilizados nas novas agregações de despesa por squad ANTES da query de freelas/salários (que vamos modificar).

Wait: na verdade `resumoPorSquad` é construído DEPOIS da query de receitas mas ANTES da query de salários e freelas. Vamos mover os helpers pra logo após `resumoPorSquad`, antes do bloco de despesas.

#### Step 2: Mover os helpers

Localizar o final do bloco `resumoPorSquad`:
```bash
grep -n "const resumoPorSquad = Array.from" server/routes.ts
```

Imediatamente após o `.sort((a, b) => b.receitaTotal - a.receitaTotal);` da definição de `resumoPorSquad`, adicionar:

```typescript
      // ──── Helpers para mapear squad RH → squad de Receita ───────────────
      // Usado para atribuir despesas (salários, freelancers) ao squad correto.
      const stripEmoji = (s: string) =>
        s.replace(/[^\p{L}\p{N}\s.&+]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

      const revenueSquadMap = new Map<string, string>();
      for (const s of resumoPorSquad) {
        revenueSquadMap.set(stripEmoji(s.squad), s.squad);
      }

      const findRevenueSquad = (normKey: string): string | null => {
        if (revenueSquadMap.has(normKey)) return revenueSquadMap.get(normKey)!;
        let bestMatch: string | null = null;
        let bestLen = 0;
        for (const [revNorm, revName] of Array.from(revenueSquadMap)) {
          if (normKey.startsWith(revNorm) || revNorm.startsWith(normKey)) {
            const matchLen = Math.min(normKey.length, revNorm.length);
            if (matchLen > bestLen) {
              bestLen = matchLen;
              bestMatch = revName;
            }
          }
        }
        return bestMatch;
      };

```

E REMOVER as definições duplicadas mais abaixo (no bloco de `salariosDetalhesPorSquad`). Procurar:
```bash
grep -n "const stripEmoji" server/routes.ts
```

Deixar SÓ uma definição de cada (a nova, antes do bloco de despesas). A versão antiga lá embaixo deve ser deletada — o `salariosDetalhesPorSquad` continuará usando os helpers definidos acima.

#### Step 3: Adicionar agregação de salários por squad

Localizar o ponto após o loop que popula `salariosPorColab`:
```bash
grep -n "salariosPorColab.set" server/routes.ts
```

O loop inteiro vai do `for (const row of salarioResult.rows as any[]) {` até o `}` do for. **DEPOIS desse `}`**, adicionar:

```typescript
      // ──── Agregação de salários por (squad de receita, mês) ────────────
      const salariosPorSquadMes = new Map<string, Map<string, number>>();
      for (const colab of Array.from(salariosPorColab.values())) {
        const normKey = stripEmoji(colab.squad);
        const matchedSquad = findRevenueSquad(normKey);
        if (!matchedSquad) continue; // squad RH não casa com squad de receita → fora da tabela visível

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

#### Step 4: Adicionar agregação de freelancers por squad no loop existente

Localizar o loop:
```bash
grep -n "freelaPorMes.set" server/routes.ts
```

Ele está dentro do `for (const row of freelaResult.rows as any[])`. Substituir o bloco:

```typescript
      // Agrupar freelancers por mês
      const freelaPorMes = new Map<string, number>();
      let freelaTotal = 0;
      for (const row of freelaResult.rows as any[]) {
        const mes = row.mes as string;
        const valor = Number(row.valor) || 0;
        freelaPorMes.set(mes, (freelaPorMes.get(mes) || 0) + valor);
        freelaTotal += valor;
      }
```

Por:

```typescript
      // Agrupar freelancers por mês (total) e por (squad, mês)
      const freelaPorMes = new Map<string, number>();
      const freelaPorSquadMes = new Map<string, Map<string, number>>();
      let freelaTotal = 0;
      for (const row of freelaResult.rows as any[]) {
        const mes = row.mes as string;
        const valor = Number(row.valor) || 0;
        const rawSquad = row.squad || 'Sem Squad';
        freelaPorMes.set(mes, (freelaPorMes.get(mes) || 0) + valor);
        freelaTotal += valor;

        // Atribuição por squad de receita (usa findRevenueSquad)
        const normKey = stripEmoji(rawSquad);
        const matchedSquad = findRevenueSquad(normKey);
        if (!matchedSquad) continue; // freela sem match → fora da tabela visível

        if (!freelaPorSquadMes.has(matchedSquad)) freelaPorSquadMes.set(matchedSquad, new Map());
        const inner = freelaPorSquadMes.get(matchedSquad)!;
        inner.set(mes, (inner.get(mes) || 0) + valor);
      }
```

#### Step 5: Montar `despesasPorSquadMensais` e adicionar ao `res.json`

Localizar o `res.json({` no final do handler:
```bash
grep -n "res.json({" server/routes.ts | grep -i "5[0-9]"
```

ANTES do `res.json({`, adicionar:

```typescript
      // ──── Montar despesasPorSquadMensais ───────────────────────────────
      const despesasPorSquadMensais: Record<string, Record<string, { salarios: number; freelancers: number }>> = {};
      const todosSquadsDespesa = new Set<string>([
        ...Array.from(salariosPorSquadMes.keys()),
        ...Array.from(freelaPorSquadMes.keys()),
      ]);
      for (const squad of Array.from(todosSquadsDespesa)) {
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

E modificar o `res.json` adicionando o campo:

ANTES:
```typescript
      res.json({
        ano,
        squad: squadFilter || 'todos',
        squads: Array.from(squadsSet).sort(),
        meses: monthlyData,
        resumoPorSquad,
        despesasMensais,
        salariosDetalhesPorSquad,
        receitasDetalhesPorSquad,
      });
```

DEPOIS:
```typescript
      res.json({
        ano,
        squad: squadFilter || 'todos',
        squads: Array.from(squadsSet).sort(),
        meses: monthlyData,
        resumoPorSquad,
        despesasMensais,
        despesasPorSquadMensais,
        salariosDetalhesPorSquad,
        receitasDetalhesPorSquad,
      });
```

#### Step 6: Verificar TypeScript

Run: `npx tsc --noEmit 2>&1 | grep "routes.ts" | grep -v -E "DbStorage|es6 or later|downlevelIteration|argument of type 'string'|never"`

Esperado: vazio (sem novos erros). Erros pré-existentes (DbStorage, regex flag, etc.) podem permanecer.

#### Step 7: Commit

```bash
git commit -m "$(cat <<'EOF'
feat(contribuicao-squad): backend agrega despesas por squad (salários + freelas)

Adiciona campo despesasPorSquadMensais à resposta do endpoint bulk.
Salários e freelancers agora são atribuídos ao squad de receita
correspondente via findRevenueSquad (mesmo fuzzy match já usado em
salariosDetalhesPorSquad). Mantém despesasMensais como total mensal
para hero/rodapé.

Move stripEmoji/revenueSquadMap/findRevenueSquad para mais cedo no
handler para serem reutilizados pelas novas agregações.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" -- server/routes.ts
```

Note o `-- server/routes.ts` no final — necessário porque há outros arquivos staged não relacionados a esta feature.

---

### Task 2: Frontend — substituir rateio por lookup direto

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx`

#### Step 1: Adicionar interface `DespesasPorSquadMensais`

Localizar a interface `BulkResponse` (~linha 54-63). ANTES dela, adicionar:

```typescript
interface DespesasPorSquadMensais {
  [squad: string]: {
    [mes: string]: {
      salarios: number;
      freelancers: number;
    };
  };
}
```

E adicionar o campo no `BulkResponse`:

```typescript
interface BulkResponse {
  ano: number;
  squad: string;
  squads: string[];
  meses: MonthlyData[];
  resumoPorSquad?: SquadResumo[];
  despesasMensais?: DespesasMensais;
  despesasPorSquadMensais?: DespesasPorSquadMensais;  // ← novo
  salariosDetalhesPorSquad?: Record<string, SalarioDetalhe[]>;
  receitasDetalhesPorSquad?: Record<string, ReceitaDetalhe[]>;
}
```

#### Step 2: Reescrever `squadRanking` para usar despesa real

Localizar (~linha 148-169):

```typescript
  const squadRanking = useMemo(() => {
    if (!bulkData?.resumoPorSquad) return [];
    const totalGeral = bulkData.resumoPorSquad.reduce((s, sq) => s + sq.receitaTotal, 0);

    // Total de despesas anuais
    let totalDespAnual = 0;
    for (const m of monthlyResults) {
      const desp = bulkData.despesasMensais?.[m.mes];
      totalDespAnual += (desp?.salarios || 0) + (desp?.freelancers || 0);
    }

    return bulkData.resumoPorSquad.map((sq) => {
      const proporcao = totalGeral > 0 ? sq.receitaTotal / totalGeral : 0;
      const despesaRateada = totalDespAnual * proporcao;
      return {
        ...sq,
        contribuicaoPct: totalGeral > 0 ? proporcao * 100 : 0,
        despesaRateada,
        resultadoLiquido: sq.receitaTotal - despesaRateada,
      };
    });
  }, [bulkData, monthlyResults]);
```

Substituir por:

```typescript
  const squadRanking = useMemo(() => {
    if (!bulkData?.resumoPorSquad) return [];
    const totalGeral = bulkData.resumoPorSquad.reduce((s, sq) => s + sq.receitaTotal, 0);

    return bulkData.resumoPorSquad.map((sq) => {
      // Despesa REAL do squad (sem rateio) — soma anual de salários + freelas atribuídos
      let despesaSquad = 0;
      for (const m of monthlyResults) {
        const desp = bulkData.despesasPorSquadMensais?.[sq.squad]?.[m.mes];
        if (desp) despesaSquad += desp.salarios + desp.freelancers;
      }
      return {
        ...sq,
        contribuicaoPct: totalGeral > 0 ? (sq.receitaTotal / totalGeral) * 100 : 0,
        despesaRateada: despesaSquad, // nome legado, mas agora é despesa REAL
        resultadoLiquido: sq.receitaTotal - despesaSquad,
      };
    });
  }, [bulkData, monthlyResults]);
```

#### Step 3: Substituir `despesaSquadMes` e `despesaComponenteSquadMes`

Localizar (~linha 190-202):

```typescript
    // Despesa rateada por squad por mês
    const despesaSquadMes = (sq: typeof squadRanking[0], mesIdx: number) => {
      const receitaMes = receitaTotalPorMes[mesIdx];
      const proporcao = receitaMes > 0 ? (sq.porMes[mesIdx] || 0) / receitaMes : 0;
      return despesaTotalPorMes[mesIdx] * proporcao;
    };

    // Componente de despesa rateado por squad por mês
    const despesaComponenteSquadMes = (sq: typeof squadRanking[0], mesIdx: number, componente: number[]) => {
      const receitaMes = receitaTotalPorMes[mesIdx];
      const proporcao = receitaMes > 0 ? (sq.porMes[mesIdx] || 0) / receitaMes : 0;
      return componente[mesIdx] * proporcao;
    };
```

Substituir por:

```typescript
    // Despesa REAL por squad por mês (lookup direto, sem rateio)
    const despesaSquadMes = (sq: typeof squadRanking[0], mesIdx: number) => {
      const mesKey = monthlyResults[mesIdx].mes;
      const desp = bulkData?.despesasPorSquadMensais?.[sq.squad]?.[mesKey];
      return (desp?.salarios || 0) + (desp?.freelancers || 0);
    };

    // Componente específico (salarios | freelancers) por squad por mês
    const despesaComponenteSquadMes = (sq: typeof squadRanking[0], mesIdx: number, tipo: 'salarios' | 'freelancers') => {
      const mesKey = monthlyResults[mesIdx].mes;
      return bulkData?.despesasPorSquadMensais?.[sq.squad]?.[mesKey]?.[tipo] || 0;
    };
```

#### Step 4: Atualizar chamada de `despesaComponenteSquadMes` no drilldown por squad

Localizar (~linha 488):

```typescript
                                  {[
                                    { label: "Salários", data: tableData.salariosPorMes, expandable: true },
                                    { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
                                  ].map(({ label, data, expandable }) => {
                                    const total = monthlyResults.reduce((acc, _, i) => acc + tableData.despesaComponenteSquadMes(sq, i, data), 0);
                                    const salKey = `${sq.squad}__${label}`;
                                    const isExpanded = expandable && expandedSalarios.has(salKey);
                                    return (
                                      <Fragment key={label}>
                                        <tr
                                          className={cn("border-b border-border/20", expandable && "cursor-pointer hover:bg-muted/20")}
                                          onClick={expandable ? (e) => { e.stopPropagation(); toggleSalariosExpand(salKey); } : undefined}
                                        >
                                          <td className="py-1 px-3 pl-12 text-[11px] text-red-400/70 dark:text-red-400/50 sticky left-0 z-10 bg-background">
                                            <span className="flex items-center gap-1">
                                              {expandable && (isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                                              {label}
                                            </span>
                                          </td>
                                          {monthlyResults.map((_, i) => {
                                            const val = tableData.despesaComponenteSquadMes(sq, i, data);
```

Substituir o array e os 2 usos do `data` por `tipo`:

```typescript
                                  {([
                                    { label: "Salários", tipo: 'salarios' as const, expandable: true },
                                    { label: "Freelancers", tipo: 'freelancers' as const, expandable: false },
                                  ] as const).map(({ label, tipo, expandable }) => {
                                    const total = monthlyResults.reduce((acc, _, i) => acc + tableData.despesaComponenteSquadMes(sq, i, tipo), 0);
                                    const salKey = `${sq.squad}__${label}`;
                                    const isExpanded = expandable && expandedSalarios.has(salKey);
                                    return (
                                      <Fragment key={label}>
                                        <tr
                                          className={cn("border-b border-border/20", expandable && "cursor-pointer hover:bg-muted/20")}
                                          onClick={expandable ? (e) => { e.stopPropagation(); toggleSalariosExpand(salKey); } : undefined}
                                        >
                                          <td className="py-1 px-3 pl-12 text-[11px] text-red-400/70 dark:text-red-400/50 sticky left-0 z-10 bg-background">
                                            <span className="flex items-center gap-1">
                                              {expandable && (isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                                              {label}
                                            </span>
                                          </td>
                                          {monthlyResults.map((_, i) => {
                                            const val = tableData.despesaComponenteSquadMes(sq, i, tipo);
```

#### Step 5: Verificar que o drilldown total no rodapé NÃO usa `despesaComponenteSquadMes`

O drilldown do rodapé total (~linha 675) usa `data` que é `tableData.salariosPorMes` / `tableData.freelancersPorMes` direto (sem `despesaComponenteSquadMes`). Esse continua igual — é o **total mensal** correto. Não precisa mudar.

Confirmar via grep:
```bash
grep -n "despesaComponenteSquadMes" client/src/pages/ContribuicaoSquad.tsx
```

Esperado: aparece SÓ no drilldown por squad (~linha 488/508), não no drilldown do rodapé.

#### Step 6: Verificar TypeScript

Run: `npx tsc --noEmit 2>&1 | grep "ContribuicaoSquad"`
Esperado: zero erros.

#### Step 7: Commit

```bash
git commit -m "$(cat <<'EOF'
feat(contribuicao-squad): frontend usa despesa real por squad (sem rateio)

despesaSquadMes e despesaComponenteSquadMes agora fazem lookup
direto em bulkData.despesasPorSquadMensais em vez de ratear o
total pela proporção de receita.

squadRanking.despesaRateada (nome legado) agora é a soma anual
real do squad. Resultado líquido reflete margem real.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" -- client/src/pages/ContribuicaoSquad.tsx
```

---

### Task 3: Smoke test endpoint

**Files:** Nenhum

#### Step 1: Restart dev server

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1; npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 6
```

#### Step 2: Login + curl

```bash
curl -s -c /tmp/cortex-cookies.txt -X POST "http://localhost:3000/auth/dev-login" > /dev/null
curl -s -b /tmp/cortex-cookies.txt "http://localhost:3000/api/contribuicao-squad/dfc/bulk?ano=2026" > /tmp/bulk.json
```

#### Step 3: Validar shape e somas

```bash
python3 -c "
import json
d = json.load(open('/tmp/bulk.json'))
assert 'despesasPorSquadMensais' in d, 'Campo despesasPorSquadMensais ausente'
print('Squads em despesasPorSquadMensais:', sorted(d['despesasPorSquadMensais'].keys()))
print()
for sq, meses in d['despesasPorSquadMensais'].items():
    total_sal = sum(m['salarios'] for m in meses.values())
    total_fre = sum(m['freelancers'] for m in meses.values())
    print(f'  {sq:<25}: salarios=R\$ {total_sal:>12,.2f}  freelas=R\$ {total_fre:>10,.2f}')
print()
total_sal_squads = sum(sum(m['salarios'] for m in meses.values()) for meses in d['despesasPorSquadMensais'].values())
total_sal_global = sum(m['salarios'] for m in d['despesasMensais'].values())
print(f'Σ salários por squad: R\$ {total_sal_squads:,.2f}')
print(f'Σ salários total:    R\$ {total_sal_global:,.2f}')
print(f'Diferença (squad sem match): R\$ {total_sal_global - total_sal_squads:,.2f}')
total_fre_squads = sum(sum(m['freelancers'] for m in meses.values()) for meses in d['despesasPorSquadMensais'].values())
total_fre_global = sum(m['freelancers'] for m in d['despesasMensais'].values())
print(f'Σ freelas por squad: R\$ {total_fre_squads:,.2f}')
print(f'Σ freelas total:    R\$ {total_fre_global:,.2f}')
print(f'Diferença (freela sem match): R\$ {total_fre_global - total_fre_squads:,.2f}')
"
```

**Esperado:**
- `despesasPorSquadMensais` existe
- Cada squad de receita tem despesa atribuída
- Σ por squad ≤ Σ total (diferença = squads RH não-mapeados)
- Tech, Squadra, Makers aparecem com valores **diferentes** dos rateios anteriores

#### Step 4: Sem commit (validação)

---

### Task 4: Browser validation (manual)

**Files:** Nenhum

- [ ] Squad Tech mostra despesa **real** (provavelmente bem menor que o rateio anterior)
- [ ] Squad Squadra mostra despesa **maior** que antes (recorrente, muitos colaboradores)
- [ ] Margem por squad mudou e parece coerente
- [ ] Drilldown de Salários em um squad mostra valores que somam o total daquele squad
- [ ] Drilldown de Freelancers em um squad mostra valores reais
- [ ] Total no rodapé continua igual ao hero "Total Despesas"
- [ ] Filtro por squad funciona
- [ ] Dark + light mode OK

---

### Task 5: Push + PR

```bash
git push --set-upstream origin feature/despesas-atribuicao-real

gh pr create --base main --head feature/despesas-atribuicao-real \
  --title "feat(contribuicao-squad): despesas atribuídas por squad real (sem rateio)" \
  --body "..."
```

(corpo do PR descrevendo a mudança, igual aos PRs anteriores)

---

## Self-review checklist

- [ ] Helpers `stripEmoji`/`revenueSquadMap`/`findRevenueSquad` movidos pra mais cedo, sem duplicação
- [ ] `salariosPorSquadMes` populado após `salariosPorColab`
- [ ] `freelaPorSquadMes` populado dentro do loop de freelas
- [ ] `despesasPorSquadMensais` montado antes do `res.json`
- [ ] Campo adicionado ao `res.json`
- [ ] Frontend tem nova interface `DespesasPorSquadMensais`
- [ ] `squadRanking` usa despesa real por squad
- [ ] `despesaSquadMes` faz lookup direto
- [ ] `despesaComponenteSquadMes` recebe `'salarios' | 'freelancers'` em vez de array
- [ ] Drilldown por squad atualizado pra passar `tipo`
- [ ] Drilldown total (rodapé) NÃO mudou (continua usando `tableData.salariosPorMes`/`freelancersPorMes`)
- [ ] TypeScript clean
- [ ] Smoke test passa
- [ ] Browser validation OK
