# Churn Nominal em Revenue (BP 2026) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar linhas de Churn R$ (valor monetário) na aba Revenue do BP 2026 — por linha de serviço e consolidado — com orçado derivado e realizado ao vivo.

**Architecture:** Mudança exclusiva em `server/routes/bp2026.revenue.ts`. Os dados de realizado já existem em `churnRs`. O orçado é derivado como `churn_pct_orc × mrr_orc mês anterior`. Nenhuma query nova, nenhuma mudança de banco ou frontend.

**Tech Stack:** TypeScript, Drizzle ORM, React Query, BPDreTable (já suporta unidade `brl`).

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `server/routes/bp2026.revenue.ts` | Modificar | Adicionar série + YTD de Churn R$ por produto e consolidado |

---

### Task 1: Adicionar série Churn R$ por produto no loop

**Files:**
- Modify: `server/routes/bp2026.revenue.ts`

O loop `for (const { chave, titulo } of LINHAS_SERVICO)` já tem `churnRsSerie` implícita em `c`. Precisamos:
1. Criar `churnRsSerie` explícita (realizado)
2. Calcular `churnRsYtd` (orçado derivado + realizado acumulado)
3. Adicionar a nova constante `NOTA_CHURN_RS`
4. Adicionar `fazLinha` para `churn_rs_${chave}` no `linhas.push`

- [ ] **Step 1: Adicionar a constante NOTA_CHURN_RS após NOTA_CHURN (linha 31)**

No arquivo `server/routes/bp2026.revenue.ts`, adicionar logo após:
```typescript
const NOTA_CHURN =
  "Taxa do mês = churn (não abonado) do produto ÷ MRR da linha no fim do mês anterior.";
```

Inserir:
```typescript
const NOTA_CHURN_RS =
  "Valor absoluto de churn não abonado por produto. " +
  "Orçado derivado de churn% × MRR orçado do mês anterior.";
```

- [ ] **Step 2: Adicionar série e YTD de Churn R$ dentro do loop**

Ainda dentro do loop `for (const { chave, titulo } of LINHAS_SERVICO)`, após o bloco que calcula `churnYtd` (linha ~171), adicionar:

```typescript
    // Churn R$ por produto: realizado = valor nominal; orçado derivado de pct × mrr anterior
    const churnRsSerie = Array.from({ length: 12 }, (_, i) =>
      i + 1 <= mesCorrente ? (c[i + 1] ?? 0) : null
    );

    let churnRsYtd: { orcado: number; realizado: number | null } | undefined;
    if (mesFechado > 0) {
      let somaReal = 0;
      let somaOrc = 0;
      for (let m = 1; m <= mesFechado; m++) {
        somaReal += c[m] ?? 0;
        // mrr_orc do mês m-1: mes=0 não existe no banco → 0 (correto para janeiro)
        const mrrOrcAnterior = orcado[`mrr_${chave}`]?.[m - 1] ?? 0;
        somaOrc += (orcado[`churn_pct_${chave}`]?.[m] ?? 0) * mrrOrcAnterior;
      }
      churnRsYtd = { orcado: somaOrc, realizado: somaReal };
    }
```

- [ ] **Step 3: Adicionar fazLinha de churn_rs no linhas.push**

No `linhas.push(...)` (linha ~173-178), adicionar a chamada `churn_rs_${chave}` logo após o `churn_pct_${chave}`:

```typescript
    linhas.push(
      fazLinha({ metrica: `mrr_${chave}`, titulo: `MRR — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "brl", destaque: true, ...(chave === "others" ? { nota: NOTA_OTHERS } : {}) }, mrrSerie),
      fazLinha({ metrica: `contratos_${chave}`, titulo: `Contratos — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, contratosSerie),
      fazLinha({ metrica: `aov_${chave}`, titulo: `AOV — ${titulo}`, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, aovSerie, aovYtd),
      fazLinha({ metrica: `churn_pct_${chave}`, titulo: `Churn — ${titulo}`, tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "pct", nota: NOTA_CHURN }, churnPctSerie, churnYtd),
      fazLinha({ metrica: `churn_rs_${chave}`, titulo: `Churn R$ — ${titulo}`, tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "brl", nota: NOTA_CHURN_RS }, churnRsSerie, churnRsYtd)
    );
```

- [ ] **Step 4: Verificar TypeScript sem erros**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros (ou apenas erros preexistentes não relacionados).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.revenue.ts
git commit -m "feat(bp2026-revenue): adiciona Churn R\$ por produto na aba Revenue

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Adicionar linha consolidada Churn R$ Total

**Files:**
- Modify: `server/routes/bp2026.revenue.ts`

Após o bloco do `linhas.unshift({ metrica: "mrr_ativo", ... })` (linha ~192-198), adicionar a linha consolidada `churn_rs_total`. Como `fazLinha` está definida dentro do loop (não acessível aqui), a linha consolidada é construída manualmente — igual ao padrão de `mrr_ativo`.

- [ ] **Step 1: Adicionar linha consolidada após linhas.unshift de mrr_ativo**

No arquivo `server/routes/bp2026.revenue.ts`, logo após o bloco:
```typescript
  linhas.unshift({
    metrica: "mrr_ativo", ...
  });
```

Adicionar:
```typescript
  // Churn R$ consolidado = soma dos 5 produtos (orçado derivado + realizado)
  const mesesChurnTotal: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const real = mes <= mesCorrente
      ? LINHAS_SERVICO.reduce((acc, { chave: ch }) => acc + (churnRs[ch]?.[mes] ?? 0), 0)
      : null;
    const orc = LINHAS_SERVICO.reduce((acc, { chave: ch }) => {
      const mrrOrcAnterior = orcado[`mrr_${ch}`]?.[mes - 1] ?? 0;
      return acc + (orcado[`churn_pct_${ch}`]?.[mes] ?? 0) * mrrOrcAnterior;
    }, 0);
    return { mes, orcado: orc, realizado: real, atingimento: calcAtingimento(orc, real) };
  });
  const vChurnTot = calcYtd(mesesChurnTotal, mesFechado, "fluxo");
  linhas.unshift({
    metrica: "churn_rs_total",
    titulo: "Churn R$ Total",
    tipoAgregacao: "fluxo",
    direcao: "menor_melhor",
    unidade: "brl",
    nota: "Soma do churn não abonado de todos os produtos. Orçado derivado de churn% × MRR orçado do mês anterior.",
    meses: mesesChurnTotal,
    ytd: mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : { ...vChurnTot, atingimento: calcAtingimento(vChurnTot.orcado, vChurnTot.realizado) },
  });
```

**Atenção:** `churnRs` é a variável `Record<string, Record<number, number>>` declarada na linha ~106 do arquivo, antes do loop. Está acessível aqui.

- [ ] **Step 2: Verificar TypeScript sem erros**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros novos.

- [ ] **Step 3: Reiniciar o servidor e testar no browser**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; cd /Users/mac0267/Cortex && npm run dev &
```

Abrir `http://localhost:3000`, navegar até **BP 2026 → aba Revenue** e verificar:
- Linha "Churn R$ Total" aparece no topo da aba (após MRR Ativo)
- Para cada produto (Performance, Creators, Social, GC, Others): linha "Churn R$ — {Produto}" aparece após "Churn — {Produto}"
- Valores são monetários (R$), não percentuais
- Colunas orçado e realizado preenchidas

- [ ] **Step 4: Commit**

```bash
git add server/routes/bp2026.revenue.ts
git commit -m "feat(bp2026-revenue): adiciona linha consolidada Churn R\$ Total no topo de Revenue

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Push e validação final

- [ ] **Step 1: Verificar diff completo antes do push**

```bash
git diff origin/main..HEAD -- server/routes/bp2026.revenue.ts
```

Confirmar que apenas as linhas de Churn R$ foram adicionadas, sem remoções indevidas.

- [ ] **Step 2: Push**

```bash
git push origin HEAD
```

- [ ] **Step 3: Verificar no banco de produção**

A lógica usa apenas `vw_cup_churn_ajustado` e `cup_data_hist` — ambas existem em produção. Nenhuma migration necessária.
