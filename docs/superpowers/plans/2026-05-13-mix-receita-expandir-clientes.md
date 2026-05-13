# Mix de Receita — Expandir clientes por produto: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a coluna Produto da tabela "Mix de Receita por Produto" (aba "Por Produto") expansível, mostrando contratos individuais (cliente, MRR, pontual, squad, responsável, status) para conferência com ClickUp.

**Architecture:** Backend ganha endpoint dedicado `/api/financeiro/mix-receita/clientes` com query params `produto/status/squad` (lazy, on-demand). Frontend acrescenta coluna chevron + estado de expansão multi-produto e renderiza sub-componente `<ContratosCliente>` (em arquivo próprio) numa `<tr>` com `colSpan`.

**Tech Stack:** Express + Drizzle ORM (raw `sql` template), React + TypeScript, React Query (`@tanstack/react-query`), Tailwind, lucide-react icons.

**Branch:** `feature/mix-receita-expandir-clientes` (já criada no commit do spec).

**Spec de referência:** `docs/superpowers/specs/2026-05-13-mix-receita-expandir-clientes-design.md`

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server/routes/mixReceita.ts` | Modificar | Adicionar handler `GET /api/financeiro/mix-receita/clientes` |
| `client/src/pages/financeiro/mix-receita/ContratosCliente.tsx` | Criar | Sub-componente que busca e renderiza a tabela de contratos de um produto |
| `client/src/pages/financeiro/MixReceita.tsx` | Modificar | Estado de expansão, coluna chevron, renderização da linha expandida |

**Decisão de extração:** `MixReceita.tsx` já tem 555 linhas. O CLAUDE.md instrui avaliar split em arquivos > 500 linhas. `ContratosCliente.tsx` segue o padrão da pasta (igual a `EvolucaoTemporal.tsx`).

---

## Task 1: Backend — endpoint `/api/financeiro/mix-receita/clientes`

**Files:**
- Modify: `server/routes/mixReceita.ts` (adicionar handler antes do `app.get("/api/financeiro/mix-receita/temporal", ...)`)

- [ ] **Step 1: Adicionar interface da response**

Em `server/routes/mixReceita.ts`, logo após a interface `MixReceitaResponse` (linha ~35), adicionar:

```ts
interface ContratoCliente {
  cliente_nome: string;
  id_task: string;
  id_subtask: string;
  mrr_recorrente: number;
  total_pontual: number;
  total: number;
  squad: string;
  responsavel: string;
  status: string;
}

interface ClientesPorProdutoResponse {
  produto: string;
  contratos: ContratoCliente[];
  totais: {
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
    receita_total: number;
  };
}
```

- [ ] **Step 2: Adicionar handler do endpoint**

Em `server/routes/mixReceita.ts`, dentro de `registerMixReceitaRoutes`, **logo antes** do bloco `app.get("/api/financeiro/mix-receita/temporal", ...)` (atualmente linha ~155), adicionar:

```ts
  app.get("/api/financeiro/mix-receita/clientes", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || "";
      if (!produto) {
        return res.status(400).json({ error: "produto é obrigatório" });
      }

      const statusQuery = (req.query.status as string) || "";
      const squadQuery = (req.query.squad as string) || "";

      const statusFiltro = statusQuery
        ? statusQuery.split(",").map((s) => s.trim()).filter(Boolean)
        : STATUS_PADRAO;

      const squadFilter = squadQuery && squadQuery !== "todos"
        ? sql` AND co.squad = ${squadQuery}`
        : sql``;

      const statusList = sql.join(
        statusFiltro.map((s) => sql`${s}`),
        sql`, `
      );

      const result = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(cc.nome), ''), '(cliente não identificado)') AS cliente_nome,
          co.id_task,
          co.id_subtask,
          COALESCE(co.valorr::numeric, 0)::float AS mrr_recorrente,
          COALESCE(co.valorp::numeric, 0)::float AS total_pontual,
          (COALESCE(co.valorr::numeric, 0) + COALESCE(co.valorp::numeric, 0))::float AS total,
          COALESCE(NULLIF(TRIM(co.squad), ''), '(sem squad)') AS squad,
          COALESCE(NULLIF(TRIM(co.responsavel), ''), '(sem responsável)') AS responsavel,
          co.status
        FROM "Clickup".cup_contratos co
        LEFT JOIN "Clickup".cup_clientes cc ON co.id_task = cc.task_id
        WHERE COALESCE(NULLIF(TRIM(co.produto), ''), '(sem produto)') = ${produto}
          AND co.status IN (${statusList})
          ${squadFilter}
        ORDER BY total DESC, cliente_nome ASC
      `);

      const contratos: ContratoCliente[] = result.rows.map((r: any) => ({
        cliente_nome: r.cliente_nome,
        id_task: r.id_task,
        id_subtask: r.id_subtask,
        mrr_recorrente: Number(r.mrr_recorrente) || 0,
        total_pontual: Number(r.total_pontual) || 0,
        total: Number(r.total) || 0,
        squad: r.squad,
        responsavel: r.responsavel,
        status: r.status,
      }));

      const totalMrr = contratos.reduce((s, c) => s + c.mrr_recorrente, 0);
      const totalPontual = contratos.reduce((s, c) => s + c.total_pontual, 0);

      const response: ClientesPorProdutoResponse = {
        produto,
        contratos,
        totais: {
          contratos: contratos.length,
          mrr_recorrente: totalMrr,
          total_pontual: totalPontual,
          receita_total: totalMrr + totalPontual,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("[api] Error fetching mix-receita clientes:", error);
      res.status(500).json({ error: "Failed to fetch clientes por produto" });
    }
  });
```

- [ ] **Step 3: Reiniciar dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
cd /Users/mac0267/Cortex && nohup npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 5
curl -s http://localhost:3000/api/health 2>/dev/null || tail -20 /tmp/cortex-dev.log
```

Expected: server respondendo ou log com `Server running` (sem stack traces).

- [ ] **Step 4: Testar endpoint com curl — caso feliz**

```bash
curl -s 'http://localhost:3000/api/financeiro/mix-receita/clientes?produto=Performance' \
  | jq '{produto, total_contratos: .totais.contratos, mrr: .totais.mrr_recorrente, pontual: .totais.total_pontual, primeiros_3: (.contratos[:3] | map({cliente_nome, total, status}))}'
```

Expected: JSON com `produto: "Performance"`, `total_contratos` próximo de 142, `mrr` próximo de R$ 434.936 e `pontual` próximo de R$ 6.497 (valores da tabela atual). Os 3 primeiros contratos ordenados por valor desc.

- [ ] **Step 5: Testar endpoint com curl — validações**

```bash
echo "--- sem produto ---"
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/financeiro/mix-receita/clientes'
echo "--- produto inexistente ---"
curl -s 'http://localhost:3000/api/financeiro/mix-receita/clientes?produto=XXXNAOEXISTE' | jq '.totais'
echo "--- filtro squad ---"
curl -s 'http://localhost:3000/api/financeiro/mix-receita/clientes?produto=Performance&squad=Performance' | jq '.totais.contratos'
echo "--- bucket sem produto ---"
curl -s 'http://localhost:3000/api/financeiro/mix-receita/clientes?produto=(sem+produto)' | jq '.totais.contratos'
```

Expected:
- Sem produto → `400`
- Produto inexistente → `{contratos: 0, mrr_recorrente: 0, total_pontual: 0, receita_total: 0}`
- Filtro squad → número > 0 (depende do dado)
- Bucket "(sem produto)" → número > 0 (no print existe a barra)

- [ ] **Step 6: Validar coerência com a linha-pai**

```bash
# Total do "Performance" na sub-tabela deve bater com a tabela principal
SUB=$(curl -s 'http://localhost:3000/api/financeiro/mix-receita/clientes?produto=Performance' | jq '.totais.mrr_recorrente')
MAIN=$(curl -s 'http://localhost:3000/api/financeiro/mix-receita' | jq '[.itens[] | select(.produto=="Performance") | .mrr_recorrente] | .[0]')
echo "Sub MRR: $SUB | Main MRR: $MAIN"
test "$SUB" = "$MAIN" && echo "OK: valores idênticos" || echo "DIFF: valores não batem"
```

Expected: `OK: valores idênticos`.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/routes/mixReceita.ts
git commit -m "$(cat <<'EOF'
feat(mix-receita): endpoint /clientes lista contratos por produto

GET /api/financeiro/mix-receita/clientes?produto=X&status=Y&squad=Z
retorna cada contrato (subtask) do produto com cliente, MRR, pontual,
squad, responsável e status, ordenado por valor desc.

Validação: totais batem 1:1 com a linha-pai da tabela Por Produto.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend — sub-componente `<ContratosCliente>`

**Files:**
- Create: `client/src/pages/financeiro/mix-receita/ContratosCliente.tsx`

- [ ] **Step 1: Criar o arquivo com o componente completo**

```tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyNoDecimals } from "@/lib/utils";

interface ContratoCliente {
  cliente_nome: string;
  id_task: string;
  id_subtask: string;
  mrr_recorrente: number;
  total_pontual: number;
  total: number;
  squad: string;
  responsavel: string;
  status: string;
}

interface ClientesPorProdutoResponse {
  produto: string;
  contratos: ContratoCliente[];
  totais: {
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
    receita_total: number;
  };
}

interface ContratosClienteProps {
  produto: string;
  statusFiltro: string[];
  squad: string;
}

function statusBadgeClass(status: string): string {
  const s = (status || "").toLowerCase().trim();
  if (s === "ativo") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (s === "onboarding" || s === "pausado") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  if (s === "em cancelamento") return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
  if (s === "entregue") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  return "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400";
}

export function ContratosCliente({ produto, statusFiltro, squad }: ContratosClienteProps) {
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("produto", produto);
    if (statusFiltro.length > 0) p.set("status", statusFiltro.join(","));
    if (squad !== "todos") p.set("squad", squad);
    return p.toString();
  }, [produto, statusFiltro, squad]);

  const { data, isLoading, error } = useQuery<ClientesPorProdutoResponse>({
    queryKey: [`/api/financeiro/mix-receita/clientes?${params}`],
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-rose-700 dark:text-rose-400">
        Erro ao carregar contratos: {(error as Error).message}
      </div>
    );
  }

  if (!data || data.contratos.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-zinc-400 italic">
        Sem contratos para este produto com os filtros atuais
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-zinc-900/30 border-l-4 border-emerald-500 dark:border-emerald-600">
      <table className="w-full text-xs">
        <thead className="border-b border-gray-200 dark:border-zinc-800">
          <tr>
            <th className="p-2 pl-12 text-left font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Cliente</th>
            <th className="p-2 text-right font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">MRR</th>
            <th className="p-2 text-right font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Pontual</th>
            <th className="p-2 text-left font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Squad</th>
            <th className="p-2 text-left font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Responsável</th>
            <th className="p-2 text-center font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.contratos.map((c) => {
            const isUnknownClient = c.cliente_nome === "(cliente não identificado)";
            return (
              <tr
                key={c.id_subtask}
                className="border-b border-gray-100 dark:border-zinc-900/60 hover:bg-white dark:hover:bg-zinc-900/60"
              >
                <td className={`p-2 pl-12 font-medium ${isUnknownClient ? "text-gray-400 dark:text-zinc-500 italic" : "text-gray-900 dark:text-white"}`}>
                  {c.cliente_nome}
                </td>
                <td className="p-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                  {c.mrr_recorrente > 0 ? formatCurrencyNoDecimals(c.mrr_recorrente) : "—"}
                </td>
                <td className="p-2 text-right tabular-nums text-orange-700 dark:text-orange-400">
                  {c.total_pontual > 0 ? formatCurrencyNoDecimals(c.total_pontual) : "—"}
                </td>
                <td className="p-2 text-gray-700 dark:text-zinc-300">{c.squad}</td>
                <td className="p-2 text-gray-700 dark:text-zinc-300">{c.responsavel}</td>
                <td className="p-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusBadgeClass(c.status)}`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100 dark:bg-zinc-900/60 border-t border-gray-200 dark:border-zinc-800">
          <tr>
            <td className="p-2 pl-12 font-semibold text-gray-700 dark:text-zinc-300">
              {data.totais.contratos} contrato{data.totais.contratos !== 1 ? "s" : ""}
            </td>
            <td className="p-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
              {formatCurrencyNoDecimals(data.totais.mrr_recorrente)}
            </td>
            <td className="p-2 text-right tabular-nums font-semibold text-orange-700 dark:text-orange-400">
              {formatCurrencyNoDecimals(data.totais.total_pontual)}
            </td>
            <td colSpan={3} className="p-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white pr-4">
              Total: {formatCurrencyNoDecimals(data.totais.receita_total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript compila**

```bash
cd /Users/mac0267/Cortex
npx tsc --noEmit -p . 2>&1 | grep -E "ContratosCliente|mix-receita" | head -10 || echo "OK: sem erros relacionados"
```

Expected: `OK: sem erros relacionados` (não deve haver mensagens listadas).

- [ ] **Step 3: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/pages/financeiro/mix-receita/ContratosCliente.tsx
git commit -m "$(cat <<'EOF'
feat(mix-receita): componente ContratosCliente lista contratos por produto

Sub-tabela aninhada com Cliente, MRR, Pontual, Squad, Responsável,
Status (badge colorido). Lazy fetch via useQuery, com estados de
loading/error/empty e footer com totais.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — wire-up expansão em `MixReceita.tsx`

**Files:**
- Modify: `client/src/pages/financeiro/MixReceita.tsx`

- [ ] **Step 1: Importar dependências novas**

Em `client/src/pages/financeiro/MixReceita.tsx`, **linha 15** (linha de imports do lucide-react), substituir:

```tsx
import { Repeat, Zap, TrendingUp, Package, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
```

por:

```tsx
import { Repeat, Zap, TrendingUp, Package, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from "lucide-react";
```

E **linha 16** (logo após o import do `EvolucaoTemporal`), adicionar:

```tsx
import { ContratosCliente } from "./mix-receita/ContratosCliente";
```

- [ ] **Step 2: Adicionar estado de expansão**

Em `MixReceita.tsx`, **dentro de `export default function MixReceita()`**, logo após a linha `const [sortDir, setSortDir] = useState<SortDir>("desc");` (linha ~85), adicionar:

```tsx
  const [expandedProdutos, setExpandedProdutos] = useState<Set<string>>(new Set());

  const toggleExpand = (produto: string) => {
    setExpandedProdutos((prev) => {
      const next = new Set(prev);
      if (next.has(produto)) next.delete(produto);
      else next.add(produto);
      return next;
    });
  };

  const statusListResolved = STATUS_PRESETS[statusPreset];
```

- [ ] **Step 3: Adicionar coluna chevron no header**

Em `MixReceita.tsx`, **dentro do `<thead>` da tabela "Por Produto"** (linha ~278, dentro do `<tr>` de headers), adicionar como primeira `<th>` (antes de `<Th onClick={() => toggleSort("produto")}>`):

```tsx
                      <th className="w-8 p-3" aria-label="Expandir"></th>
```

- [ ] **Step 4: Substituir o map de linhas de produto**

Localizar o bloco `itensOrdenados.map((item) => { ... })` que renderiza as linhas (linhas ~308-336). Substituir o callback **inteiro** por:

```tsx
                      itensOrdenados.map((item) => {
                        const perfil = perfilLabel(item.pct_recorrente);
                        const isExpanded = expandedProdutos.has(item.produto);
                        return (
                          <Fragment key={item.produto}>
                            <tr
                              className="border-b border-gray-100 dark:border-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-900/30 cursor-pointer"
                              onClick={() => toggleExpand(item.produto)}
                            >
                              <td className="w-8 p-3 text-gray-500 dark:text-zinc-400">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </td>
                              <td className="p-3 font-medium text-gray-900 dark:text-white">{item.produto}</td>
                              <td className="p-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">{item.contratos}</td>
                              <td className="p-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                                {formatCurrencyNoDecimals(item.mrr_recorrente)}
                              </td>
                              <td className="p-3 text-right tabular-nums text-orange-700 dark:text-orange-400 font-medium">
                                {formatCurrencyNoDecimals(item.total_pontual)}
                              </td>
                              <td className="p-3 min-w-[140px]">
                                <MixBar pctRecorrente={item.pct_recorrente} />
                              </td>
                              <td className={`p-3 text-right tabular-nums font-semibold ${pctClass(item.pct_recorrente)}`}>
                                {item.pct_recorrente.toFixed(1)}%
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${perfil.color}`}>
                                  {perfil.label}
                                </span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${item.produto}__expanded`}>
                                <td colSpan={8} className="p-0">
                                  <ContratosCliente
                                    produto={item.produto}
                                    statusFiltro={statusListResolved}
                                    squad={squad}
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
```

- [ ] **Step 5: Importar `Fragment` do React**

Em `MixReceita.tsx`, **linha 1**, substituir:

```tsx
import { useState, useMemo } from "react";
```

por:

```tsx
import { useState, useMemo, Fragment } from "react";
```

- [ ] **Step 6: Ajustar `colSpan` da linha "empty" e do `<tfoot>`**

Localizar `<tr><td colSpan={7} className="p-8 text-center ...">Sem dados...</td></tr>` (linha ~306) e **trocar `colSpan={7}` por `colSpan={8}`**.

Localizar o `<tr>` dentro do `<tfoot>` da tabela "Por Produto" (linhas ~340-356). **Adicionar uma `<td>` vazia como primeira célula** (antes do "Total"):

```tsx
                      <tr>
                        <td />
                        <td className="p-3 text-gray-900 dark:text-white">Total</td>
```

Também ajustar a linha de skeleton dentro do `tbody` (linha ~302): trocar `colSpan={7}` por `colSpan={8}`.

- [ ] **Step 7: Reiniciar dev server e checar TypeScript**

```bash
cd /Users/mac0267/Cortex
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
npx tsc --noEmit -p . 2>&1 | grep -E "MixReceita|ContratosCliente" | head -10 || echo "OK: sem erros TS"
nohup npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 5
tail -10 /tmp/cortex-dev.log
```

Expected: `OK: sem erros TS` e servidor sobe sem stack traces.

- [ ] **Step 8: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/pages/financeiro/MixReceita.tsx
git commit -m "$(cat <<'EOF'
feat(mix-receita): coluna Produto expansível na tabela Por Produto

Adiciona chevron clicável e estado multi-expansão. Cada linha expandida
renderiza ContratosCliente com a lista de contratos do produto, herdando
os filtros de status e squad do header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Validação manual no browser + ClickUp

**Files:** — (apenas verificação)

- [ ] **Step 1: Abrir a página**

Abrir `http://localhost:3000/financeiro/mix-receita` em browser autenticado, na aba "Por Produto".

- [ ] **Step 2: Validar UI básica**

- ✅ A primeira coluna da tabela mostra um `ChevronRight`
- ✅ Clicar na linha "Performance" expande mostrando contratos abaixo
- ✅ O chevron vira `ChevronDown` quando expandido
- ✅ Clicar de novo colapsa

- [ ] **Step 3: Validar dados da expansão**

Com "Performance" expandido:
- ✅ Lista ordenada por valor total desc (primeiros = clientes mais caros)
- ✅ Footer mostra "N contratos · Total R$ X" — valor deve bater com a linha-pai
- ✅ Status badge colorido (verde para "ativo")
- ✅ Cliente com `id_task` sem match aparece como "(cliente não identificado)" em cinza itálico

- [ ] **Step 4: Validar multi-expansão**

- ✅ Expandir "Performance" e "Creators" ao mesmo tempo → ambos abertos
- ✅ Colapsar "Performance" → "Creators" continua aberto

- [ ] **Step 5: Validar propagação de filtros**

- ✅ Com "Performance" expandido, mudar squad para um valor específico → sub-tabela refaz fetch e mostra só contratos daquele squad
- ✅ Mudar status preset → sub-tabela refaz fetch
- ✅ Os totais (sub-tabela vs linha-pai) continuam batendo

- [ ] **Step 6: Validar dark/light mode**

- ✅ Trocar tema → cores legíveis em ambos
- ✅ Border esquerda emerald destacando a expansão
- ✅ Badges legíveis em ambos os temas

- [ ] **Step 7: Conferir com ClickUp (validação de negócio)**

Pegar 3 contratos de produtos diferentes na sub-tabela. Para cada:
- ✅ Abrir o ClickUp e localizar a subtask (`id_subtask` é o link)
- ✅ Comparar valor recorrente / pontual / status / responsável com o que aparece na sub-tabela
- ✅ Valores devem ser idênticos

Se alguma divergência: investigar a fonte (provavelmente cache de sync do ClickUp → cup_contratos, não bug desta feature). Documentar no commit final.

- [ ] **Step 8: Commit final (se nada precisou ser ajustado)**

Sem alterações de código — pode pular. Se algum ajuste menor for necessário, commitar como `fix(mix-receita): ...` e validar de novo.

---

## Self-Review

**Spec coverage:**

| Spec section | Onde está coberto |
|---|---|
| Backend endpoint + query SQL + response shape | Task 1, Steps 1-2 |
| Frontend ContratosCliente + estados | Task 2, Step 1 |
| Estado expandedProdutos + toggleExpand | Task 3, Step 2 |
| Coluna chevron | Task 3, Steps 3-4 |
| Linha expandida com colSpan | Task 3, Step 4 |
| Status badge colorido | Task 2, Step 1 (`statusBadgeClass`) |
| Filtros propagam | Task 3, Step 4 (`statusListResolved` passado como prop) |
| Multi-expand | Task 3, Step 2 (`Set<string>`) |
| Totais batendo com linha-pai | Task 1, Step 6 (curl); Task 4, Step 3 (browser) |
| Cliente órfão | Task 2, Step 1 (italic gray) |
| Dark/light mode | Task 4, Step 6 |
| Aba "Por Squad x Produto" intocada | Não há mudança — ✓ |
| Aba "Evolução temporal" intocada | Não há mudança — ✓ |
| Conferência com ClickUp | Task 4, Step 7 |

**Placeholder scan:** Nenhum TBD/TODO/"implementar depois". Todo código está completo.

**Type consistency:**
- `ContratoCliente` definido idêntico em backend (Task 1, Step 1) e frontend (Task 2, Step 1) ✓
- `ClientesPorProdutoResponse` idem ✓
- `statusListResolved: string[]` consumido por `statusFiltro: string[]` em `ContratosCliente` ✓
- `produto: string` consistente em URL param e prop ✓

Sem inconsistências.

---

## Após implementar

Seguir o workflow obrigatório (CLAUDE.md "Workflow Pós-Conclusão de Task"):
1. Git auto-push (já feito a cada task)
2. Atualizar Obsidian vault — esta task não tem TASK-N (é uma feature ad-hoc), mas se houver chamado vinculado, atualizar status
3. Considerar PR para staging
