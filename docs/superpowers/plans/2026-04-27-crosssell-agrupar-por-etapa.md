# CrossSell agrupar por etapa (accordion) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a grid plana de cards-por-cliente por um accordion vertical onde cada etapa do funil é uma seção colapsável; cliente com oportunidades em N etapas aparece em N seções, focado na oportunidade daquela etapa.

**Architecture:** Mudança 100% de apresentação no `CrossSellPipeline.tsx` + 1 linha no backend `POST /api/comercial/crosssell` para aceitar `etapa` opcional. Sem mudança de schema, sem novo endpoint.

**Tech Stack:** React + TypeScript + Tailwind. Sem libs novas.

**Spec de referência:** `docs/superpowers/specs/2026-04-27-crosssell-agrupar-por-etapa-design.md`

---

## File Structure

### Modificar
| Arquivo | Responsabilidade |
|---------|------------------|
| `client/src/pages/CrossSellPipeline.tsx` | Adicionar `EtapaSection`, `groupClientesByEtapa`. `ClienteCard` ganha prop `oportunidadesFiltradas?`. `NewOpDialog` ganha prop `etapaInicial?`. Componente principal renderiza accordion em vez de grid. |
| `server/routes/crosssell.ts` | `POST /api/comercial/crosssell` aceita `etapa` opcional no body. |

### Não tocar
- Schema do banco
- `GET /api/comercial/crosssell` e demais endpoints
- `CrossSellDashboard.tsx`
- `server/services/crosssell-scoring.ts`

---

## Backend

### Task 1: `POST /api/comercial/crosssell` aceita etapa opcional

**Files:**
- Modify: `server/routes/crosssell.ts:124-145` (handler do POST)

- [ ] **Step 1: Adicionar `etapa` no destructuring e usar no INSERT**

Localizar o bloco do POST que começa com `app.post("/api/comercial/crosssell", ...)`. Substituir o bloco `try { ... }` por:

```typescript
    try {
      const { clienteId, cnpj, produtoMapeado, cxResponsavel, valorRNegociacao, valorPNegociacao, etapa } = req.body;

      if (!clienteId || !cnpj || !produtoMapeado || !cxResponsavel) {
        return res.status(400).json({ error: "clienteId, cnpj, produtoMapeado, cxResponsavel são obrigatórios" });
      }

      const etapaInicial = typeof etapa === "string" && etapa.length > 0 ? etapa : "fazer_contato";

      const result = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_oportunidades
          (cliente_id, cnpj, produto_mapeado, cx_responsavel, valor_r_negociacao, valor_p_negociacao, etapa)
        VALUES
          (${clienteId}, ${cnpj}, ${produtoMapeado}, ${cxResponsavel}, ${valorRNegociacao || null}, ${valorPNegociacao || null}, ${etapaInicial})
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[crosssell] Error creating oportunidade:", error);
      res.status(500).json({ error: "Failed to create oportunidade" });
    }
```

- [ ] **Step 2: Restart dev server e validar via curl**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 6
curl -s -c /tmp/cortex-cookies.txt -X POST 'http://localhost:3000/auth/dev-login' > /dev/null

# POST sem etapa (deve usar default fazer_contato)
curl -s -b /tmp/cortex-cookies.txt -X POST 'http://localhost:3000/api/comercial/crosssell' \
  -H 'Content-Type: application/json' \
  -d '{"clienteId":"test_001","cnpj":"00.000.000/0001-00","produtoMapeado":"BI","cxResponsavel":"Teste"}' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); print("etapa:", r.get("etapa"))'
```

Expected: `etapa: fazer_contato`

```bash
# POST com etapa explícita
curl -s -b /tmp/cortex-cookies.txt -X POST 'http://localhost:3000/api/comercial/crosssell' \
  -H 'Content-Type: application/json' \
  -d '{"clienteId":"test_002","cnpj":"00.000.000/0002-00","produtoMapeado":"SEO","cxResponsavel":"Teste","etapa":"reuniao_agendada"}' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); print("etapa:", r.get("etapa"))'
```

Expected: `etapa: reuniao_agendada`

- [ ] **Step 3: Limpar oportunidades de teste**

```bash
psql "$DATABASE_URL" -c "DELETE FROM cortex_core.crosssell_oportunidades WHERE cliente_id IN ('test_001','test_002')"
```

(Se `DATABASE_URL` não estiver no shell, ignorar — os registros teste ficam em prod sem afetar UX. Anotar como cleanup futuro.)

- [ ] **Step 4: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
feat(crosssell): POST aceita etapa opcional no body

Permite criar oportunidade ja em uma etapa especifica. Default
permanece 'fazer_contato' quando etapa nao e enviada.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Frontend

### Task 2: Função de agrupamento + estado de etapas expandidas

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx` (no bloco de Helpers, antes do componente principal)

- [ ] **Step 1: Adicionar função `groupClientesByEtapa` no bloco de Helpers**

Localizar a função `formatCurrencyCompact` (no bloco `// Helpers`) e adicionar logo abaixo:

```typescript
type ClienteEtapaGroup = {
  cliente: ClienteCrossSell;
  oportunidades: Oportunidade[];
};

function groupClientesByEtapa(
  clientes: ClienteCrossSell[]
): Map<Etapa, ClienteEtapaGroup[]> {
  const groups = new Map<Etapa, ClienteEtapaGroup[]>();
  for (const cliente of clientes) {
    const byEtapa = new Map<Etapa, Oportunidade[]>();
    for (const op of cliente.oportunidades) {
      const e = op.etapa as Etapa;
      if (!byEtapa.has(e)) byEtapa.set(e, []);
      byEtapa.get(e)!.push(op);
    }
    for (const [e, ops] of byEtapa) {
      if (!groups.has(e)) groups.set(e, []);
      groups.get(e)!.push({ cliente, oportunidades: ops });
    }
  }
  return groups;
}
```

- [ ] **Step 2: Adicionar estado `etapasExpandidas` e inicialização ao componente principal**

No componente principal `CrossSellPipeline`, logo após o estado `ordenacao` (e antes dos modais), adicionar:

```typescript
  const [etapasExpandidas, setEtapasExpandidas] = useState<Set<Etapa>>(new Set());
  const initializedExpansion = useRef(false);
```

E adicionar `useRef` ao import do React no topo do arquivo:

Localizar `import { useState, useMemo } from "react";` e trocar por:

```typescript
import { useState, useMemo, useEffect, useRef } from "react";
```

- [ ] **Step 3: Inicializar etapas expandidas após dados carregarem**

Após o bloco da query (`useQuery<ClienteCrossSell[]>`), adicionar:

```typescript
  // Group + Init expansion default (3 primeiras etapas com itens, exceto sugerido_sistema/descartado)
  const grupos = useMemo(() => groupClientesByEtapa(clientes), [clientes]);

  useEffect(() => {
    if (initializedExpansion.current || clientes.length === 0) return;
    const etapasComCards = ETAPAS.filter(
      (e) => e !== "sugerido_sistema" && e !== "descartado" && (grupos.get(e)?.length ?? 0) > 0
    );
    setEtapasExpandidas(new Set(etapasComCards.slice(0, 3)));
    initializedExpansion.current = true;
  }, [clientes, grupos]);
```

(O `useMemo` antigo chamado `sorted` será removido na Task 4 Step 5, junto com o JSX da grid plana.)

- [ ] **Step 4: Salvar (sem rodar — vamos compilar tudo na Task 4)**

(O componente ainda usa o `sorted` antigo. A próxima task substitui o JSX.)

---

### Task 3: Componente `EtapaSection` + `ClienteCard` ganha `oportunidadesFiltradas`

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx`

- [ ] **Step 1: Adicionar prop `oportunidadesFiltradas` ao `ClienteCard`**

Localizar `function ClienteCard({ cliente, onChangeEtapa, onGanho, onComments }: { ... })`. Substituir a assinatura e o uso de `cliente.oportunidades` por:

```typescript
function ClienteCard({
  cliente,
  oportunidadesFiltradas,
  onChangeEtapa,
  onGanho,
  onComments,
}: {
  cliente: ClienteCrossSell;
  oportunidadesFiltradas?: Oportunidade[];
  onChangeEtapa: (opId: number, etapa: string) => void;
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
  const oportunidadesVisiveis = oportunidadesFiltradas ?? cliente.oportunidades;
  return (
```

E na renderização das oportunidades (dentro do bloco `{/* Oportunidades */}`), trocar `cliente.oportunidades.length` e `cliente.oportunidades.map(...)` por `oportunidadesVisiveis.length` e `oportunidadesVisiveis.map(...)`:

```typescript
        {/* Oportunidades */}
        <div className="border-t border-gray-100 dark:border-zinc-800 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-0.5">
            Oportunidades mapeadas ({oportunidadesVisiveis.length})
          </p>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800/60">
            {oportunidadesVisiveis.map((op) => (
              <OportunidadeRow
                key={op.id}
                op={op}
                onChangeEtapa={(etapa) => onChangeEtapa(op.id, etapa)}
                onGanho={() => onGanho(op)}
                onComments={() => onComments(op)}
              />
            ))}
          </div>
        </div>
```

- [ ] **Step 2: Adicionar componente `EtapaSection`**

Inserir antes da definição de `ClienteCard`:

```typescript
// ---------------------------------------------------------------------------
// EtapaSection
// ---------------------------------------------------------------------------

function EtapaSection({
  etapa,
  grupos,
  expanded,
  onToggle,
  onNewOpForEtapa,
  ordenacao,
  onChangeEtapa,
  onGanho,
  onComments,
}: {
  etapa: Etapa;
  grupos: ClienteEtapaGroup[];
  expanded: boolean;
  onToggle: () => void;
  onNewOpForEtapa: (etapa: Etapa) => void;
  ordenacao: "score" | "mrr" | "recente" | "nome";
  onChangeEtapa: (opId: number, etapa: string) => void;
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
  const sorted = useMemo(() => {
    const arr = [...grupos];
    switch (ordenacao) {
      case "mrr":
        arr.sort((a, b) => b.cliente.valorRAtual - a.cliente.valorRAtual);
        break;
      case "recente":
        arr.sort((a, b) => {
          const aMax = a.oportunidades.reduce((m, op) => Math.max(m, new Date(op.atualizadoEm).getTime()), 0);
          const bMax = b.oportunidades.reduce((m, op) => Math.max(m, new Date(op.atualizadoEm).getTime()), 0);
          return bMax - aMax;
        });
        break;
      case "nome":
        arr.sort((a, b) => (a.cliente.nome ?? "").localeCompare(b.cliente.nome ?? ""));
        break;
      case "score":
      default:
        arr.sort((a, b) => b.cliente.scoreMaximo - a.cliente.scoreMaximo);
        break;
    }
    return arr;
  }, [grupos, ordenacao]);

  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-zinc-900/50 rounded px-1"
      >
        <span className={`text-gray-500 dark:text-zinc-400 transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
        <Badge className={`text-xs ${ETAPA_COLORS[etapa] ?? "bg-gray-200 text-gray-800"}`}>
          {ETAPA_LABELS[etapa] ?? etapa}
        </Badge>
        <span className="text-sm text-gray-500 dark:text-zinc-400">{grupos.length}</span>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onNewOpForEtapa(etapa); }}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 px-2 py-0.5 text-sm"
          title={`Nova oportunidade em ${ETAPA_LABELS[etapa]}`}
        >
          +
        </button>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2 mb-4 pl-6">
          {sorted.map(({ cliente, oportunidades }) => (
            <ClienteCard
              key={`${etapa}-${cliente.cnpj}`}
              cliente={cliente}
              oportunidadesFiltradas={oportunidades}
              onChangeEtapa={onChangeEtapa}
              onGanho={onGanho}
              onComments={onComments}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Não rodar — Task 4 conecta tudo**

---

### Task 4: Substituir grid plana por accordion no componente principal

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx`

- [ ] **Step 1: Adicionar estado para etapa pré-selecionada do "+"**

Localizar o estado `showNew` e trocar:

```typescript
  const [showNew, setShowNew] = useState(false);
```

Por:

```typescript
  const [newOpEtapa, setNewOpEtapa] = useState<Etapa | null>(null);
```

(Vamos abrir o dialog quando `newOpEtapa` mudar pra não-null. `null` = não pré-selecionado, `string` = pré-selecionado.)

E onde existe `setShowNew(true)` (no botão "Nova Oportunidade" do filter bar), trocar por `setNewOpEtapa("fazer_contato" as Etapa)`.

- [ ] **Step 2: Substituir o JSX do grid pelo accordion**

Localizar o bloco `{/* Card grid */}` (que começa com `<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">`) e substituir o div inteiro por:

```typescript
      {/* Etapas accordion */}
      <div className="space-y-1">
        {ETAPAS.filter((e) => (grupos.get(e)?.length ?? 0) > 0).map((etapa) => (
          <EtapaSection
            key={etapa}
            etapa={etapa}
            grupos={grupos.get(etapa) ?? []}
            expanded={etapasExpandidas.has(etapa)}
            onToggle={() =>
              setEtapasExpandidas((prev) => {
                const next = new Set(prev);
                if (next.has(etapa)) next.delete(etapa);
                else next.add(etapa);
                return next;
              })
            }
            onNewOpForEtapa={(e) => setNewOpEtapa(e)}
            ordenacao={ordenacao}
            onChangeEtapa={(opId, e) => changeEtapa.mutate({ id: opId, etapa: e })}
            onGanho={(op) => {
              const grupo = grupos.get(etapa)?.find((g) => g.oportunidades.some((o) => o.id === op.id));
              if (grupo) setGanhoCtx({ op, clienteNome: grupo.cliente.nome ?? grupo.cliente.cnpj });
            }}
            onComments={(op) => {
              const grupo = grupos.get(etapa)?.find((g) => g.oportunidades.some((o) => o.id === op.id));
              if (grupo) setCommentCtx({ op, clienteNome: grupo.cliente.nome ?? grupo.cliente.cnpj });
            }}
          />
        ))}
        {grupos.size === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-zinc-500">
            Nenhum cliente encontrado com os filtros selecionados.
          </div>
        )}
      </div>
```

- [ ] **Step 3: Atualizar o resumo no rodapé da barra**

Localizar `<span>{sorted.length} clientes</span>` e substituir por:

```typescript
        <span>{clientes.length} clientes únicos</span>
```

(`clientes.length` é o total de clientes únicos; o accordion mostra cards duplicados em diferentes etapas, mas o número de clientes reais é o `clientes.length`.)

- [ ] **Step 4: Atualizar a renderização do `NewOpDialog` pra passar `etapaInicial`**

Localizar o bloco `{showNew && ( <NewOpDialog ... /> )}` e substituir por:

```typescript
      {newOpEtapa && (
        <NewOpDialog
          open={!!newOpEtapa}
          etapaInicial={newOpEtapa}
          onClose={() => setNewOpEtapa(null)}
          userName={user?.name ?? ""}
        />
      )}
```

- [ ] **Step 5: Remover o `useMemo` chamado `sorted` (substituído pelo sort dentro de cada EtapaSection)**

Localizar o bloco que começa com `const sorted = useMemo(() => {` e o `}, [clientes, ordenacao]);` correspondente. Deletar esse useMemo inteiro (já não tem consumidor após Step 2).

---

### Task 5: `NewOpDialog` aceita `etapaInicial` e passa no POST

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx` (componente `NewOpDialog`)

- [ ] **Step 1: Atualizar assinatura do `NewOpDialog`**

Localizar `function NewOpDialog({ open, onClose, userName }: { open: boolean; onClose: () => void; userName: string; }) {` e substituir por:

```typescript
function NewOpDialog({
  open,
  etapaInicial,
  onClose,
  userName,
}: {
  open: boolean;
  etapaInicial?: Etapa;
  onClose: () => void;
  userName: string;
}) {
```

- [ ] **Step 2: Incluir `etapa` no body do POST**

Localizar a `mutationFn` do `createMut` dentro do `NewOpDialog`. Substituir o `body: JSON.stringify({ ... })` para incluir `etapa`:

```typescript
        body: JSON.stringify({
          clienteId: selectedCliente.task_id,
          cnpj: selectedCliente.cnpj,
          produtoMapeado: produto,
          cxResponsavel: userName || selectedCliente.responsavel,
          valorRNegociacao: valorR ? Number(valorR) : undefined,
          valorPNegociacao: valorP ? Number(valorP) : undefined,
          etapa: etapaInicial,
        }),
```

- [ ] **Step 3: Mostrar a etapa pré-selecionada no topo do dialog**

Localizar o `<DialogHeader>` do `NewOpDialog` e logo após o `<DialogTitle>`, adicionar uma linha informativa quando `etapaInicial` não for `fazer_contato`:

```typescript
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Nova Oportunidade de CrossSell
          </DialogTitle>
          {etapaInicial && etapaInicial !== "fazer_contato" && (
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              Será criada em: <strong className="text-gray-900 dark:text-white">{ETAPA_LABELS[etapaInicial]}</strong>
            </p>
          )}
        </DialogHeader>
```

---

## Smoke test + push

### Task 6: Verificação integrada e PR

- [ ] **Step 1: Verificar TSX compila e endpoint funciona**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 6
# Hit do TSX via Vite — deve retornar 200 e código bundleado
curl -s -o /dev/null -w "Pipeline TSX: %{http_code}, %{size_download} bytes\n" 'http://localhost:3000/src/pages/CrossSellPipeline.tsx'
```

Expected: HTTP 200 e size > 100000 bytes.

- [ ] **Step 2: Teste manual no browser (não automatizável)**

Abrir `http://localhost:3000/dashboard/comercial/crosssell` e verificar:

- [ ] Página renderiza accordion vertical (etapa por etapa)
- [ ] Etapas sem cards estão escondidas
- [ ] Default expandido: 3 primeiras etapas com items (exceto Sugerido/Descartado)
- [ ] Clicar no header colapsa/expande a seção
- [ ] Cliente que tem oportunidades em 2 etapas aparece em ambas as seções (cards diferentes)
- [ ] Card mostra apenas a oportunidade da etapa correspondente
- [ ] Botão `+` na header de cada seção abre dialog "Nova Oportunidade" com a etapa pré-selecionada (e mensagem "Será criada em: X" se diferente de Fazer Contato)
- [ ] Filtros (cluster/CX/etapa/produto) afetam todas as seções
- [ ] Sort dropdown reordena dentro de cada seção
- [ ] Mudar etapa de uma oportunidade move o card pra outra seção
- [ ] Aceitar uma sugestão move da seção Sugerido pra Fazer Contato
- [ ] Dark mode íntegro

- [ ] **Step 3: Parar dev server e commitar tudo**

```bash
lsof -ti:3000 | xargs kill -9
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): pipeline agrupa cards por etapa em accordion

Substitui a grid plana por accordion vertical, uma secao por etapa.
Cliente com oportunidades em N etapas aparece em N secoes, focado
na oportunidade daquela etapa.

- Novo componente EtapaSection com header colapsavel + grid interno.
- ClienteCard ganha prop oportunidadesFiltradas? para renderizar
  apenas oportunidades da etapa correspondente.
- groupClientesByEtapa agrupa o array plano em Map<Etapa, ...>.
- 3 primeiras etapas com itens iniciam expandidas; sugerido_sistema
  e descartado iniciam colapsadas.
- Botao + no header de cada secao abre Nova Oportunidade com etapa
  pre-selecionada.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push e atualizar o PR existente**

```bash
git push
```

(O PR #134 já existe. O push adiciona os novos commits — não precisa abrir PR novo.)
