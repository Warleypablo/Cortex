# CAC por Contrato — Toggle de Produtos (BP 2026)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar sub-linhas expansíveis por produto na linha "CAC por contrato" do BP 2026, com toggle via chevron.

**Architecture:** `cacPorContrato` ganha um campo `filhos?: Linha[]` no backend com uma sub-linha por produto recorrente (fórmula: `cacTotal ÷ contratos_produto`). No frontend, `BPDreTable` ganha um `useState` de linhas expandidas e renderiza as sub-linhas quando o usuário clica no chevron da linha-mãe.

**Tech Stack:** TypeScript, React, Tailwind CSS, lucide-react, PostgreSQL via pool existente.

## Global Constraints

- Dark/light mode obrigatório — usar `dark:` variants Tailwind em todo CSS novo
- Sem novas dependências npm
- Commits seguem Conventional Commits com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Testar no browser (npm run dev, porta 3000) antes de considerar pronto

---

### Task 1: Backend — campo `filhos` no tipo e sub-linhas por produto

**Files:**
- Modify: `server/routes/bp2026.detalhamentos.ts:13-18` (interface `Linha`)
- Modify: `server/routes/bp2026.detalhamentos.ts:227-243` (bloco `cacPorContrato`)

**Interfaces:**
- Consome: `PRODUTOS_CAC` (array `{ slug: string; titulo: string }[]`), `contratosVendidosRec` (`Record<string, (number | null)[]>`), `cacTotalSerie` (`(number | null)[]`), `cacOrcMes(m: number): number`, `orcado` (objeto com chaves `contratos_vendidos_mrr_${slug}`), `fazLinha`, `razao`, `mesCorrente`
- Produz: `cacPorContrato.filhos: Linha[]` — uma sub-linha por produto de `PRODUTOS_CAC`

- [ ] **Step 1: Adicionar `filhos` na interface `Linha`**

Arquivo: `server/routes/bp2026.detalhamentos.ts`, linha 13.

Substituir:
```ts
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec"; nota?: string; destaque?: boolean;
  grupo?: string; subItem?: boolean; semDetalhe?: boolean;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}
```

Por:
```ts
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec"; nota?: string; destaque?: boolean;
  grupo?: string; subItem?: boolean; semDetalhe?: boolean;
  filhos?: Linha[];
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}
```

- [ ] **Step 2: Construir as sub-linhas e adicioná-las a `cacPorContrato`**

Localizar o bloco que começa em `const cacPorContrato: Linha = {` (linha ~227) e substituí-lo por:

```ts
  // sub-linhas por produto: CAC total ÷ contratos do produto (mesma premissa de CAC)
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

  const cacPorContrato: Linha = {
    ...fazLinha(
      { metrica: "cac_por_contrato", titulo: "CAC por contrato", direcao: "menor_melhor", unidade: "brl",
        nota: "Despesa CAC do mês ÷ contratos vendidos no Bitrix (recorrentes + pontuais; um deal com N produtos conta N contratos). Comparável ao CAC por cliente: fica menor que ele quando um cliente fecha mais de um contrato. Orçado ÷ contratos vendidos orçados." },
      porContratoSerie,
      (m) => razao(cacOrcMes(m), contratosOrcMes(m)) ?? 0,
      mesFechado === 0 ? undefined : {
        orcado: razao(somaAte(cacOrcMes), somaAte(contratosOrcMes)) ?? 0,
        realizado: razao(cacYtdReal, somaAte((m) => contratosVendidosTotalPorMes[m - 1] ?? 0)),
      }
    ),
    semDetalhe: true,
    filhos: cacPorContratoFilhos,
  };
```

- [ ] **Step 3: Verificar que TypeScript compila sem erros**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "bp2026.detalhamentos"
```

Esperado: sem output (sem erros nesse arquivo).

- [ ] **Step 4: Commit**

```bash
git add server/routes/bp2026.detalhamentos.ts
git commit -m "feat(bp2026): sub-linhas por produto no CAC por contrato (fórmula: cacTotal ÷ contratos_produto)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — chevron toggle no `BPDreTable`

**Files:**
- Modify: `client/src/components/bp2026/BPDreTable.tsx` (interface `BPLinha`, imports, componente)

**Interfaces:**
- Consome: `BPLinha.filhos?: BPLinha[]` produzido na Task 1
- Produz: linhas expandíveis com chevron; sub-linhas com `pl-12`

- [ ] **Step 1: Adicionar `filhos` na interface `BPLinha` e imports**

No topo do arquivo (`BPDreTable.tsx`), substituir:
```ts
import { Info } from "lucide-react";
```
Por:
```ts
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useState } from "react";
```

Na interface `BPLinha` (linha ~24), adicionar `filhos` logo antes de `meses`:
```ts
export interface BPLinha {
  metrica: string;
  titulo: string;
  tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec";
  nota?: string;
  info?: { definicao: string; fonte: string; calculo: string };
  destaque?: boolean;
  grupo?: string;
  segmento?: string;
  subItem?: boolean;
  semDetalhe?: boolean;
  filhos?: BPLinha[];
  meses: BPMes[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}
```

- [ ] **Step 2: Adicionar estado de expand no componente**

Dentro de `BPDreTable`, logo após a linha `const ytdLabel = ...`, adicionar:

```ts
const [expanded, setExpanded] = useState<Set<string>>(new Set());
const toggleExpand = (metrica: string) =>
  setExpanded((prev) => {
    const next = new Set(prev);
    next.has(metrica) ? next.delete(metrica) : next.add(metrica);
    return next;
  });
```

- [ ] **Step 3: Renderizar chevron no título da linha-mãe**

Localizar o bloco que renderiza o título da linha (dentro do `<td>` sticky com `className="flex items-center gap-1.5"`):

```tsx
<span className="flex items-center gap-1.5">
  {tituloLinha}
  {(linha.info || linha.nota || ehEstoque) && (
```

Substituir por:

```tsx
<span className="flex items-center gap-1.5">
  {linha.filhos && linha.filhos.length > 0 && (
    <button
      onClick={() => toggleExpand(linha.metrica)}
      className="shrink-0 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      aria-label={expanded.has(linha.metrica) ? "Colapsar" : "Expandir"}
    >
      {expanded.has(linha.metrica)
        ? <ChevronDown className="h-3.5 w-3.5" />
        : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  )}
  {tituloLinha}
  {(linha.info || linha.nota || ehEstoque) && (
```

- [ ] **Step 4: Renderizar sub-linhas quando expandido**

Localizar o trecho após o fechamento do `</tr>` da linha principal (logo antes do `);` que fecha o `render.push(`):

```tsx
              </tr>
              );
            });
```

Substituir por:

```tsx
              </tr>
              );
              // sub-linhas de filhos (toggle)
              if (expanded.has(linha.metrica) && linha.filhos) {
                linha.filhos.forEach((filho) => {
                  render.push(
                    <tr
                      key={filho.metrica}
                      className="border-t border-gray-100 dark:border-zinc-800 text-gray-700 dark:text-zinc-300"
                      data-testid={`bp-linha-${filho.metrica}`}
                    >
                      <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 pl-12 pr-4 py-2 text-xs text-gray-500 dark:text-zinc-500 whitespace-nowrap align-top">
                        {filho.titulo}
                      </td>
                      {filho.meses.map((m) => (
                        <td key={m.mes} className="px-2 py-2 text-right align-top">
                          <Celula
                            orcado={m.orcado}
                            realizado={m.realizado}
                            atingimento={m.atingimento}
                            direcao={filho.direcao}
                            unidade={filho.unidade ?? "brl"}
                            parcial={m.mes === mesCorrente && mesCorrente > mesFechado}
                            semMeta
                            mostrarOrcado={mostrarOrcado}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right align-top border-l border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50">
                        <Celula
                          orcado={filho.ytd.orcado}
                          realizado={filho.ytd.realizado}
                          atingimento={filho.ytd.atingimento}
                          direcao={filho.direcao}
                          unidade={filho.unidade ?? "brl"}
                          semMeta
                          mostrarOrcado={mostrarOrcado}
                        />
                      </td>
                    </tr>
                  );
                });
              }
            });
```

- [ ] **Step 5: Verificar TypeScript e testar no browser**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "BPDreTable"
```

Esperado: sem output.

Abrir `http://localhost:3000`, navegar até BP 2026 → aba CAC. Verificar:
1. Linha "CAC por contrato" mostra chevron `>`
2. Clicar expande sub-linhas por produto (Performance, Creators, etc.) com valores numéricos
3. Clicar novamente colapsa
4. Dark mode: testar com toggle de tema
5. Sub-linhas começam colapsadas (estado inicial = `new Set()`)

- [ ] **Step 6: Commit**

```bash
git add client/src/components/bp2026/BPDreTable.tsx
git commit -m "feat(bp2026): toggle de produtos no CAC por contrato

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
