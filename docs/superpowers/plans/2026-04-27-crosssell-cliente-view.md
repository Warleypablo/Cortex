# CrossSell Pipeline por Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar a página CrossSell Pipeline para apresentar **um card por cliente** (com seus serviços ativos e oportunidades mapeadas dentro), substituindo a visualização atual de um card por oportunidade.

**Architecture:** Mudança 100% de apresentação — sem mudança de schema. O endpoint `GET /api/comercial/crosssell` é refatorado para retornar lista de clientes com oportunidades aninhadas. O frontend ganha 2 componentes novos (`ClienteCard`, `OportunidadeRow`) que substituem o `OpCard`. Modais (NewOp, Ganho, Comments) e mutations existentes são preservados — apenas a forma de abrir muda. Dashboard ganha 2 KPIs novos de cobertura.

**Tech Stack:** React + TypeScript + Tailwind (dark mode obrigatório) + React Query + Express + Drizzle ORM (raw SQL via `db.execute`). PostgreSQL.

**Spec de referência:** `docs/superpowers/specs/2026-04-27-crosssell-cliente-view-design.md`

---

## File Structure

### Modificar
| Arquivo | Responsabilidade |
|---------|------------------|
| `server/routes/crosssell.ts` | Endpoint `GET /api/comercial/crosssell` retorna shape agrupado por cliente. Endpoint `/dashboard` ganha 2 KPIs. |
| `client/src/pages/CrossSellPipeline.tsx` | Substituir `OpCard` por `ClienteCard` + `OportunidadeRow`. Filtros 6→4. Dropdown de ordenação. |
| `client/src/pages/CrossSellDashboard.tsx` | 2 cards de KPI novos. Grid ajustado (7→9 cards). |

### Não tocar
- `server/services/crosssell-scoring.ts`
- `shared/schema.ts`, `shared/nav-config.ts`
- Migrações
- Outros endpoints (POST/PATCH/comentários/ganho/mapear)

---

## Setup

### Task 0: Criar feature branch e validar baseline

**Files:** N/A (operação git)

- [ ] **Step 1: Criar branch**

```bash
cd /Users/mac0267/Cortex
git checkout -b feature/crosssell-cliente-view
```

- [ ] **Step 2: Confirmar branch**

Run: `git branch --show-current`
Expected: `feature/crosssell-cliente-view`

- [ ] **Step 3: Subir dev server e validar página atual funciona**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Abrir `http://localhost:3000/dashboard/comercial/crosssell` em browser. Verificar que a página carrega cards de oportunidades. Anotar visualmente: nº de cards, alguns nomes de clientes, filtros funcionando. Isso é o baseline para comparar depois.

- [ ] **Step 4: Parar dev server (vamos rodar de novo após mudanças)**

```bash
lsof -ti:3000 | xargs kill -9
```

---

## Backend

### Task 1: Refatorar `GET /api/comercial/crosssell` para retornar agrupado por cliente

**Files:**
- Modify: `server/routes/crosssell.ts:10-121`

A query passa a usar duas CTEs (oportunidades filtradas + contratos do cliente) e agrega via `json_agg`. Filtros de query string aplicam-se na CTE de oportunidades.

- [ ] **Step 1: Substituir o handler do endpoint inteiro**

Substituir o bloco entre `// 1. GET /api/comercial/crosssell — List oportunidades with filters` (linha ~9) e o fechamento `});` (linha ~121) — incluindo o handler completo — por:

```typescript
  // 1. GET /api/comercial/crosssell — List clientes com oportunidades aninhadas
  app.get("/api/comercial/crosssell", async (req, res) => {
    try {
      const { cluster, cx, etapa, produto } = req.query;

      const conditions: string[] = [`o.etapa NOT IN ('ganho', 'descartado')`];
      const params: any[] = [];

      if (cluster && typeof cluster === "string") {
        params.push(cluster);
        conditions.push(`c.cluster = $${params.length}`);
      }
      if (cx && typeof cx === "string") {
        params.push(cx);
        conditions.push(`o.cx_responsavel = $${params.length}`);
      }
      if (etapa && typeof etapa === "string") {
        params.push(etapa);
        conditions.push(`o.etapa = $${params.length}`);
      }
      if (produto && typeof produto === "string") {
        params.push(produto);
        conditions.push(`o.produto_mapeado = $${params.length}`);
      }

      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      const query = `
        WITH oportunidades_filtradas AS (
          SELECT
            o.id,
            o.cliente_id,
            o.cnpj,
            o.produto_mapeado,
            o.etapa,
            o.valor_r_negociacao,
            o.valor_p_negociacao,
            o.cx_responsavel,
            o.ultimo_contato,
            o.atualizado_em,
            o.origem,
            o.prioridade,
            o.score_detalhes,
            o.motivo,
            c.nome AS cliente_nome,
            c.cluster,
            c.status AS cliente_status,
            c.responsavel AS cx_conta,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_comentarios cm
             WHERE cm.oportunidade_id = o.id) AS total_comentarios
          FROM cortex_core.crosssell_oportunidades o
          LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
          ${whereClause}
        ),
        contratos_cliente AS (
          SELECT
            cl.cnpj,
            COALESCE(SUM(ct.valorr), 0)::float AS valor_r_atual,
            COALESCE(SUM(ct.valorp), 0)::float AS valor_p_atual,
            MIN(ct.data_inicio) AS contrato_inicio,
            COALESCE(
              array_agg(DISTINCT ct.produto) FILTER (WHERE ct.produto IS NOT NULL AND ct.produto != ''),
              ARRAY[]::text[]
            ) AS servicos_ativos
          FROM "Clickup".cup_contratos ct
          JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
          WHERE ct.status IN ('ativo', 'Ativo', 'ATIVO')
            AND cl.cnpj IN (SELECT DISTINCT cnpj FROM oportunidades_filtradas)
          GROUP BY cl.cnpj
        )
        SELECT
          of_.cnpj,
          MAX(of_.cliente_id) AS cliente_id,
          MAX(of_.cliente_nome) AS cliente_nome,
          MAX(of_.cluster) AS cluster,
          MAX(of_.cliente_status) AS cliente_status,
          MAX(of_.cx_conta) AS cx_conta,
          COALESCE(MAX(cc.valor_r_atual), 0) AS valor_r_atual,
          COALESCE(MAX(cc.valor_p_atual), 0) AS valor_p_atual,
          MAX(cc.contrato_inicio) AS contrato_inicio,
          COALESCE(MAX(cc.servicos_ativos), ARRAY[]::text[]) AS servicos_ativos,
          COALESCE(MAX((of_.score_detalhes->>'total')::float), 0) AS score_maximo,
          json_agg(json_build_object(
            'id', of_.id,
            'produto', of_.produto_mapeado,
            'etapa', of_.etapa,
            'valorRNegociacao', of_.valor_r_negociacao,
            'valorPNegociacao', of_.valor_p_negociacao,
            'cxResponsavel', of_.cx_responsavel,
            'ultimoContato', of_.ultimo_contato,
            'origem', COALESCE(of_.origem, 'manual'),
            'prioridade', of_.prioridade,
            'motivo', of_.motivo,
            'totalComentarios', of_.total_comentarios,
            'atualizadoEm', of_.atualizado_em
          ) ORDER BY of_.atualizado_em DESC) AS oportunidades
        FROM oportunidades_filtradas of_
        LEFT JOIN contratos_cliente cc ON cc.cnpj = of_.cnpj
        GROUP BY of_.cnpj
        ORDER BY score_maximo DESC NULLS LAST
      `;

      const finalQuery = params.length > 0
        ? params.reduce((q, val, i) => q.replace(new RegExp(`\\$${i + 1}\\b`, 'g'), `'${String(val).replace(/'/g, "''")}'`), query)
        : query;

      const result = await db.execute(sql.raw(finalQuery));

      const rows = (result.rows as any[]).map((r) => ({
        cnpj: r.cnpj,
        clienteId: r.cliente_id,
        nome: r.cliente_nome,
        cluster: r.cluster,
        status: r.cliente_status,
        cxConta: r.cx_conta,
        valorRAtual: Number(r.valor_r_atual),
        valorPAtual: Number(r.valor_p_atual),
        contratoInicio: r.contrato_inicio,
        servicosAtivos: r.servicos_ativos ?? [],
        scoreMaximo: Number(r.score_maximo),
        oportunidades: (r.oportunidades ?? []).map((op: any) => ({
          id: op.id,
          produto: op.produto,
          etapa: op.etapa,
          valorRNegociacao: op.valorRNegociacao != null ? Number(op.valorRNegociacao) : null,
          valorPNegociacao: op.valorPNegociacao != null ? Number(op.valorPNegociacao) : null,
          cxResponsavel: op.cxResponsavel,
          ultimoContato: op.ultimoContato,
          origem: op.origem ?? "manual",
          prioridade: op.prioridade,
          motivo: op.motivo,
          totalComentarios: Number(op.totalComentarios ?? 0),
          atualizadoEm: op.atualizadoEm,
        })),
      }));

      res.json(rows);
    } catch (error) {
      console.error("[crosssell] Error listing clientes:", error);
      res.status(500).json({ error: "Failed to list clientes" });
    }
  });
```

- [ ] **Step 2: Subir dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 4
```

- [ ] **Step 3: Testar endpoint sem filtros via curl**

```bash
curl -s -b cookies.txt -c cookies.txt 'http://localhost:3000/api/comercial/crosssell' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"clientes: {len(d)}"); print(f"primeiro: {d[0][\"nome\"]} ({len(d[0][\"oportunidades\"])} oportunidades, {len(d[0][\"servicosAtivos\"])} servicos)" if d else "vazio")'
```

Expected: imprime número de clientes e detalhes do primeiro. Resposta deve ser array de objetos com `cnpj`, `nome`, `cluster`, `valorRAtual`, `servicosAtivos[]`, `oportunidades[]`. Se 401 (não autenticado), fazer login pela UI primeiro e usar cookie.

- [ ] **Step 4: Testar com filtro de etapa**

```bash
curl -s -b cookies.txt 'http://localhost:3000/api/comercial/crosssell?etapa=fazer_contato' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"clientes com fazer_contato: {len(d)}")'
```

Expected: número menor (ou igual) que sem filtros. Cada cliente deve ter ≥1 oportunidade em `fazer_contato`.

- [ ] **Step 5: Validar que `score_maximo` ordena corretamente**

```bash
curl -s -b cookies.txt 'http://localhost:3000/api/comercial/crosssell' | python3 -c 'import json,sys; d=json.load(sys.stdin); scores=[c["scoreMaximo"] for c in d[:10]]; print("scores top 10:", scores); print("sorted desc:", scores == sorted(scores, reverse=True))'
```

Expected: `True` na última linha (scores em ordem decrescente).

- [ ] **Step 6: Parar dev server**

```bash
lsof -ti:3000 | xargs kill -9
```

- [ ] **Step 7: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
refactor(crosssell): endpoint retorna clientes com oportunidades aninhadas

GET /api/comercial/crosssell agora retorna lista agrupada por cliente,
com servicosAtivos[], oportunidades[] e scoreMaximo para ordenacao.
Modelo de dados nao muda — mudanca apenas de shape da resposta.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Adicionar 2 KPIs novos ao endpoint dashboard

**Files:**
- Modify: `server/routes/crosssell.ts:387-456` (dentro do handler `/dashboard`)

Adicionar duas queries ao `Promise.all` existente e expor os campos no JSON de resposta.

- [ ] **Step 1: Adicionar 2 queries ao Promise.all e novos campos no response**

Localizar o bloco `Promise.all([` dentro do handler `app.get("/api/comercial/crosssell/dashboard", ...)` e adicionar 2 queries ao final do array (antes do `]`):

```typescript
        // Clientes em negociação ativa (distinct cnpj com oportunidades em etapas ativas)
        db.execute(sql.raw(`
          SELECT COUNT(DISTINCT cnpj)::int AS total
          FROM cortex_core.crosssell_oportunidades
          WHERE etapa NOT IN ('ganho', 'descartado', 'sugerido_sistema')
        `)),

        // Cobertura: clientes com oportunidades / total clientes ativos
        db.execute(sql.raw(`
          SELECT
            (SELECT COUNT(DISTINCT cnpj)::int
             FROM cortex_core.crosssell_oportunidades
             WHERE etapa NOT IN ('ganho', 'descartado')) AS com_oportunidade,
            (SELECT COUNT(*)::int
             FROM "Clickup".cup_clientes
             WHERE status IN ('ativo', 'Ativo', 'ATIVO')
               AND cnpj IS NOT NULL AND cnpj != '') AS total_ativos
        `)),
```

E ajustar a desestruturação para receber 2 resultados a mais:

```typescript
      const [
        kpisResult,
        funilResult,
        reunioesPorCxResult,
        rankingValorResult,
        rankingReunioesResult,
        clientesNegociacaoResult,
        coberturaResult,
      ] = await Promise.all([
        // ... queries existentes + 2 novas
      ]);
```

E no `res.json({ kpis: { ... } })`, adicionar:

```typescript
          clientesEmNegociacao: Number((clientesNegociacaoResult.rows[0] as any).total),
          coberturaBase: (() => {
            const r = coberturaResult.rows[0] as any;
            const total = Number(r.total_ativos);
            return total > 0
              ? Number(((Number(r.com_oportunidade) / total) * 100).toFixed(1))
              : 0;
          })(),
```

- [ ] **Step 2: Subir dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 4
```

- [ ] **Step 3: Testar endpoint dashboard**

```bash
curl -s -b cookies.txt 'http://localhost:3000/api/comercial/crosssell/dashboard?mes=4&ano=2026' | python3 -c 'import json,sys; d=json.load(sys.stdin); k=d["kpis"]; print("clientesEmNegociacao:", k.get("clientesEmNegociacao")); print("coberturaBase:", k.get("coberturaBase"))'
```

Expected: imprime os 2 valores numéricos (não `None`/`null`). `clientesEmNegociacao` ≥ 0, `coberturaBase` entre 0 e 100.

- [ ] **Step 4: Parar dev server**

```bash
lsof -ti:3000 | xargs kill -9
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
feat(crosssell): adiciona KPIs de clientes em negociacao e cobertura

Endpoint /api/comercial/crosssell/dashboard ganha clientesEmNegociacao
(COUNT DISTINCT cnpj de oportunidades em etapas ativas) e coberturaBase
(% da base com pelo menos 1 oportunidade aberta).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Frontend — Pipeline

### Task 3: Atualizar tipos e helpers em `CrossSellPipeline.tsx`

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx:113-186` (bloco de Types + Helpers)

Substituir a interface `Oportunidade` pela nova estrutura que reflete o shape do backend (cliente com oportunidades aninhadas).

- [ ] **Step 1: Substituir o bloco de Types**

Localizar `// Types` (linha ~110) e substituir todo o bloco até o início de `// Helpers` por:

```typescript
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Oportunidade {
  id: number;
  produto: string;
  etapa: string;
  valorRNegociacao: number | null;
  valorPNegociacao: number | null;
  cxResponsavel: string;
  ultimoContato: string | null;
  origem: "manual" | "sistema";
  prioridade: "alta" | "media" | "baixa" | null;
  motivo: string | null;
  totalComentarios: number;
  atualizadoEm: string;
}

interface ClienteCrossSell {
  cnpj: string;
  clienteId: string;
  nome: string;
  cluster: string | null;
  status: string | null;
  cxConta: string | null;
  valorRAtual: number;
  valorPAtual: number;
  contratoInicio: string | null;
  servicosAtivos: string[];
  scoreMaximo: number;
  oportunidades: Oportunidade[];
}

interface ClienteSearch {
  task_id: string;
  cnpj: string;
  nome: string;
  status: string;
  cluster: string;
  responsavel: string;
}

interface Comentario {
  id: number;
  oportunidade_id: number;
  autor: string;
  texto: string;
  criado_em: string;
}
```

- [ ] **Step 2: Adicionar helper de formatação compacta de moeda**

Localizar a função `formatDate` no bloco de Helpers (~linha 183) e adicionar logo abaixo dela:

```typescript
function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  if (value >= 1000) {
    const k = value / 1000;
    return `R$ ${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}
```

- [ ] **Step 3: Validar que TypeScript compila (sem rodar nada — vai quebrar enquanto usuários da Oportunidade antiga existem)**

Pular validação isolada — vamos compilar tudo junto na Task 6.

- [ ] **Step 4: Commit (parcial, OK ter código quebrado entre tasks)**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
refactor(crosssell): tipos atualizados para shape de cliente

Substitui Oportunidade plana por ClienteCrossSell com oportunidades
aninhadas, refletindo nova resposta do backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Criar componente `OportunidadeRow`

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx` (adicionar componente novo após `ClienteCard` na Task 5; nessa task adicionamos no fim do arquivo, antes dos modais)

A linha mostra: bolinha de prioridade, produto, dropdown de etapa, valor R em negociação, comentários, ganho. Se for `sugerido_sistema`, mostra ações Aceitar/Descartar e motivo abaixo.

- [ ] **Step 1: Localizar o final do componente principal `CrossSellPipeline` e o início de `OpCard` (linha ~445)**

O componente `OpCard` será removido na Task 6. Por ora, adicionar `OportunidadeRow` logo antes do `OpCard` (linha ~445), inserindo:

```typescript
// ---------------------------------------------------------------------------
// OportunidadeRow
// ---------------------------------------------------------------------------

function OportunidadeRow({
  op,
  onChangeEtapa,
  onGanho,
  onComments,
}: {
  op: Oportunidade;
  onChangeEtapa: (etapa: string) => void;
  onGanho: () => void;
  onComments: () => void;
}) {
  const etapa = op.etapa as Etapa;
  const isSugerido = etapa === "sugerido_sistema";
  const isDescartado = etapa === "descartado";

  // Cor da bolinha: prioridade (se sistema) ou cinza (manual)
  const dotColor = isSugerido && op.prioridade
    ? op.prioridade === "alta"
      ? "bg-green-500"
      : op.prioridade === "media"
        ? "bg-yellow-500"
        : "bg-gray-400"
    : "bg-blue-400";

  return (
    <div className={`flex flex-col gap-1 py-2 ${isDescartado ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
          {op.produto}
        </span>

        <Select value={etapa} onValueChange={onChangeEtapa}>
          <SelectTrigger className="h-auto py-0.5 px-2 border-0 w-auto gap-1 text-xs">
            <Badge className={`text-xs ${ETAPA_COLORS[etapa] ?? "bg-gray-200 text-gray-800"}`}>
              {ETAPA_LABELS[etapa] ?? etapa}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {ETAPAS.map((e) => (
              <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-gray-600 dark:text-zinc-400 w-14 text-right">
          {formatCurrencyCompact(op.valorRNegociacao)}
        </span>

        <button
          className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 flex items-center gap-0.5 text-xs"
          onClick={onComments}
          title="Comentários"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {op.totalComentarios > 0 && <span>{op.totalComentarios}</span>}
        </button>

        {!isDescartado && !isSugerido && (
          <button
            className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            onClick={onGanho}
            title="Marcar como ganho"
          >
            <Trophy className="h-3.5 w-3.5" />
          </button>
        )}

        {isSugerido && (
          <div className="flex items-center gap-1">
            <button
              className="text-green-600 hover:text-green-700 dark:text-green-400 text-xs px-1.5 py-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/30"
              onClick={() => onChangeEtapa("fazer_contato")}
              title="Aceitar sugestão"
            >
              ✓
            </button>
            <button
              className="text-red-500 hover:text-red-600 dark:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
              onClick={() => onChangeEtapa("descartado")}
              title="Descartar sugestão"
            >
              ✗
            </button>
          </div>
        )}
      </div>

      {isSugerido && op.motivo && (
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 pl-4 truncate">
          {op.motivo}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Não compilar isolado — esperar Task 6**

(O componente `OpCard` antigo ainda existe; vamos remover na Task 6.)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): adiciona componente OportunidadeRow

Linha compacta com produto, dropdown de etapa, valor em negociacao,
comentarios e ganho. Para etapa sugerido_sistema mostra acoes
Aceitar/Descartar + motivo abaixo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Criar componente `ClienteCard`

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx` (inserir antes de `OportunidadeRow` adicionado na Task 4)

Card com header (3 linhas), chips de serviços ativos, e lista de `OportunidadeRow`.

- [ ] **Step 1: Adicionar componente `ClienteCard`**

Inserir logo após o componente principal `CrossSellPipeline` (e antes de `OportunidadeRow` que foi criado na Task 4):

```typescript
// ---------------------------------------------------------------------------
// ClienteCard
// ---------------------------------------------------------------------------

function ClienteCard({
  cliente,
  onChangeEtapa,
  onGanho,
  onComments,
}: {
  cliente: ClienteCrossSell;
  onChangeEtapa: (opId: number, etapa: string) => void;
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {cliente.nome ?? cliente.cnpj}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {cliente.cxConta ?? "—"}
            </span>
            <span>·</span>
            <span>{cliente.cluster ?? "—"}</span>
            <span>·</span>
            <span>{cliente.status ?? "—"}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {calcLifetime(cliente.contratoInicio)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-zinc-300 mt-1.5 font-medium">
            <span>R: {formatCurrency(cliente.valorRAtual)}</span>
            <span className="text-gray-400 dark:text-zinc-600">·</span>
            <span>P: {formatCurrency(cliente.valorPAtual)}</span>
          </div>
        </div>

        {/* Serviços ativos */}
        {cliente.servicosAtivos.length > 0 && (
          <div className="border-t border-gray-100 dark:border-zinc-800 pt-2">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1.5">
              Serviços ativos
            </p>
            <div className="flex flex-wrap gap-1">
              {cliente.servicosAtivos.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-[11px] text-gray-700 dark:text-zinc-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Oportunidades */}
        <div className="border-t border-gray-100 dark:border-zinc-800 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-0.5">
            Oportunidades mapeadas ({cliente.oportunidades.length})
          </p>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800/60">
            {cliente.oportunidades.map((op) => (
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
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): adiciona componente ClienteCard

Card por cliente com header (CX, cluster, status, lifetime, valor R,
valor P), chips de servicos ativos e lista de OportunidadeRow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Refatorar componente principal `CrossSellPipeline`

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx:192-443` (componente principal + remoção do OpCard antigo)

Remove `OpCard`, ajusta query para tipo `ClienteCrossSell`, reduz filtros para 4, adiciona dropdown de ordenação, atualiza grid e resumo.

- [ ] **Step 1: Substituir o componente `CrossSellPipeline` (de `export default function CrossSellPipeline()` até o fechamento `}` antes de `// OpCard`)**

```typescript
export default function CrossSellPipeline() {
  useSetPageInfo("CrossSell Pipeline", "Comercial");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [cluster, setCluster] = useState("todos");
  const [cxResp, setCxResp] = useState("todos");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [produtoFilter, setProdutoFilter] = useState("todos");
  const [ordenacao, setOrdenacao] = useState<"score" | "mrr" | "recente" | "nome">("score");

  // Modals
  const [showNew, setShowNew] = useState(false);
  const [ganhoCtx, setGanhoCtx] = useState<{ op: Oportunidade; clienteNome: string } | null>(null);
  const [commentCtx, setCommentCtx] = useState<{ op: Oportunidade; clienteNome: string } | null>(null);

  // Build query string for backend filters
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (cluster !== "todos") p.set("cluster", cluster);
    if (cxResp !== "todos") p.set("cx", cxResp);
    if (etapaFilter !== "todas") p.set("etapa", etapaFilter);
    if (produtoFilter !== "todos") p.set("produto", produtoFilter);
    return p.toString();
  }, [cluster, cxResp, etapaFilter, produtoFilter]);

  // Query
  const { data: clientes = [], isLoading } = useQuery<ClienteCrossSell[]>({
    queryKey: ["/api/comercial/crosssell", queryString],
    queryFn: async () => {
      const url = queryString
        ? `/api/comercial/crosssell?${queryString}`
        : `/api/comercial/crosssell`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar clientes");
      return res.json();
    },
  });

  // Derived: list of distinct CX responsáveis (entre todas oportunidades)
  const cxResponsaveis = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientes) {
      for (const op of c.oportunidades) set.add(op.cxResponsavel);
    }
    return Array.from(set).sort();
  }, [clientes]);

  // Sorted clients
  const sorted = useMemo(() => {
    const arr = [...clientes];
    switch (ordenacao) {
      case "mrr":
        arr.sort((a, b) => b.valorRAtual - a.valorRAtual);
        break;
      case "recente":
        arr.sort((a, b) => {
          const aMax = a.oportunidades.reduce((m, op) => Math.max(m, new Date(op.atualizadoEm).getTime()), 0);
          const bMax = b.oportunidades.reduce((m, op) => Math.max(m, new Date(op.atualizadoEm).getTime()), 0);
          return bMax - aMax;
        });
        break;
      case "nome":
        arr.sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
        break;
      case "score":
      default:
        arr.sort((a, b) => b.scoreMaximo - a.scoreMaximo);
        break;
    }
    return arr;
  }, [clientes, ordenacao]);

  // Aggregates for summary
  const totalOportunidades = useMemo(
    () => clientes.reduce((s, c) => s + c.oportunidades.length, 0),
    [clientes]
  );
  const totalRNegociacao = useMemo(
    () =>
      clientes.reduce(
        (s, c) =>
          s + c.oportunidades.reduce((s2, op) => s2 + (op.valorRNegociacao ?? 0), 0),
        0
      ),
    [clientes]
  );

  const mapear = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/comercial/crosssell/mapear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Erro ao mapear oportunidades");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
      alert(
        `${data.criadas} oportunidades mapeadas:\n` +
        `Alta: ${data.distribuicao.alta}\n` +
        `Média: ${data.distribuicao.media}\n` +
        `Baixa: ${data.distribuicao.baixa}\n` +
        `${data.ignoradas} ignoradas (já existentes)`
      );
    },
  });

  const changeEtapa = useMutation({
    mutationFn: async ({ id, etapa }: { id: number; etapa: string }) => {
      const res = await fetch(`/api/comercial/crosssell/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa, alteradoPor: user?.name }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar etapa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-48" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cluster} onValueChange={setCluster}>
          <SelectTrigger className="w-40 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Clusters</SelectItem>
            {CLUSTERS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cxResp} onValueChange={setCxResp}>
          <SelectTrigger className="w-48 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="CX Responsavel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos CX</SelectItem>
            {cxResponsaveis.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={etapaFilter} onValueChange={setEtapaFilter}>
          <SelectTrigger className="w-48 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Etapas</SelectItem>
            {ETAPAS.map((e) => (
              <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={produtoFilter} onValueChange={setProdutoFilter}>
          <SelectTrigger className="w-44 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Produtos</SelectItem>
            {PRODUTOS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as any)}>
          <SelectTrigger className="w-52 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Maior potencial</SelectItem>
            <SelectItem value="mrr">Maior MRR atual</SelectItem>
            <SelectItem value="recente">Mais recentes</SelectItem>
            <SelectItem value="nome">Alfabético</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="outline"
          onClick={() => mapear.mutate()}
          disabled={mapear.isPending}
          className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
        >
          <Sparkles className="h-4 w-4" />
          {mapear.isPending ? "Mapeando..." : "Mapear Oportunidades"}
        </Button>

        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-400">
        <span>{sorted.length} clientes</span>
        <span>·</span>
        <span>{totalOportunidades} oportunidades</span>
        <span>·</span>
        <span>R$ {formatCurrency(totalRNegociacao)} em negociação</span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((c) => (
          <ClienteCard
            key={c.cnpj}
            cliente={c}
            onChangeEtapa={(opId, etapa) => changeEtapa.mutate({ id: opId, etapa })}
            onGanho={(op) => setGanhoCtx({ op, clienteNome: c.nome ?? c.cnpj })}
            onComments={(op) => setCommentCtx({ op, clienteNome: c.nome ?? c.cnpj })}
          />
        ))}
        {sorted.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400 dark:text-zinc-500">
            Nenhum cliente encontrado com os filtros selecionados.
          </div>
        )}
      </div>

      {/* Modals */}
      {showNew && (
        <NewOpDialog
          open={showNew}
          onClose={() => setShowNew(false)}
          userName={user?.name ?? ""}
        />
      )}
      {ganhoCtx && (
        <GanhoDialog
          open={!!ganhoCtx}
          op={ganhoCtx.op}
          clienteNome={ganhoCtx.clienteNome}
          onClose={() => setGanhoCtx(null)}
          userName={user?.name ?? ""}
        />
      )}
      {commentCtx && (
        <CommentsSheet
          open={!!commentCtx}
          op={commentCtx.op}
          clienteNome={commentCtx.clienteNome}
          onClose={() => setCommentCtx(null)}
          userName={user?.name ?? ""}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remover o componente `OpCard` inteiro (e o `DataCell` que só ele usa)**

Localizar `// OpCard` (linha ~445) e deletar o bloco completo até o início de `// New Oportunidade Dialog` (cerca de 160 linhas removidas). Isso inclui:

- O comentário de seção `// OpCard` e o componente `function OpCard(...)`
- O componente `function DataCell(...)` (não tem outro consumidor — `OportunidadeRow` não usa)

- [ ] **Step 3: Ajustar `GanhoDialog` para receber `clienteNome` como prop separada**

A interface `Oportunidade` mudou (não tem mais `clienteNome`, `cnpj`, `produtoMapeado`). Precisamos passar o nome do cliente como prop separada e renomear `produtoMapeado` → `produto`.

Trocar a assinatura de `GanhoDialog`:

```typescript
function GanhoDialog({
  open,
  op,
  clienteNome,
  onClose,
  userName,
}: {
  open: boolean;
  op: Oportunidade;
  clienteNome: string;
  onClose: () => void;
  userName: string;
}) {
```

Trocar `useState(op.produtoMapeado)` por `useState(op.produto)`.

Trocar a linha que exibia o cliente:

```typescript
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Cliente: <strong className="text-gray-900 dark:text-white">{clienteNome}</strong>
          </p>
```

- [ ] **Step 4: Ajustar `CommentsSheet` da mesma forma (prop `clienteNome` adicionada)**

Trocar a assinatura:

```typescript
function CommentsSheet({
  open,
  op,
  clienteNome,
  onClose,
  userName,
}: {
  open: boolean;
  op: Oportunidade;
  clienteNome: string;
  onClose: () => void;
  userName: string;
}) {
```

E o título do drawer:

```typescript
          <SheetTitle className="text-gray-900 dark:text-white">
            Comentários — {clienteNome}
          </SheetTitle>
```

- [ ] **Step 4b: Confirmar que Step 1 já contém os states `ganhoCtx`/`commentCtx` e os callbacks corretos**

O template do componente principal em **Step 1** já declara `ganhoCtx`/`commentCtx` com `clienteNome`, passa os callbacks corretos (`onGanho={(op) => setGanhoCtx({ op, clienteNome: c.nome ?? c.cnpj })}`) e renderiza os dialogs com `clienteNome={ganhoCtx.clienteNome}`. Nada mais a fazer aqui — apenas confirmar que ficou consistente.

- [ ] **Step 5: Subir dev server e validar TypeScript não quebra**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
```

Verificar no log do dev server (terminal): nenhum erro de compilação TypeScript. Se aparecer erro, corrigir.

- [ ] **Step 6: Testar página no browser**

Abrir `http://localhost:3000/dashboard/comercial/crosssell`. Verificar:

- [ ] Cards mostram um por cliente (não mais um por oportunidade)
- [ ] Header mostra CX, Cluster, Status, Lifetime, Valor R, Valor P
- [ ] Bloco "Serviços ativos" com chips
- [ ] Bloco "Oportunidades mapeadas" com lista de linhas
- [ ] Cada linha mostra produto, dropdown de etapa, valor R em negociação, comentários, ganho
- [ ] Linha em "Sugerido" mostra ✓ Aceitar e ✗ Descartar + frase de motivo abaixo
- [ ] Filtros (Cluster, CX, Etapa, Produto) reduzem a lista
- [ ] Dropdown de ordenação muda a ordem dos cards
- [ ] Botão "Nova Oportunidade" abre dialog que continua funcionando
- [ ] Botão "Mapear Oportunidades" funciona
- [ ] Trocar etapa numa linha atualiza o card
- [ ] Clicar em comentário abre o drawer com título "Comentários — <produto>"
- [ ] Clicar em ganho abre dialog que mostra "Produto: <produto>"
- [ ] Testar dark mode (toggle no header) — todas as cores adaptam

- [ ] **Step 7: Parar dev server**

```bash
lsof -ti:3000 | xargs kill -9
```

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): pipeline renderiza um card por cliente

- Substitui OpCard por ClienteCard com header (CX, cluster, status,
  lifetime, valores), chips de servicos ativos e lista de oportunidades.
- Reduz filtros de 6 para 4 (Cluster, CX, Etapa, Produto).
- Adiciona dropdown de ordenacao (potencial, MRR, recente, alfabetico).
- Resumo no rodape passa a contar clientes alem de oportunidades.
- Dialogs Ganho/Comentarios adaptados para a nova Oportunidade.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Frontend — Dashboard

### Task 7: Adicionar 2 KPIs novos no `CrossSellDashboard.tsx`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx:75-89` (interface), `client/src/pages/CrossSellDashboard.tsx:166-215` (grid de KPIs)

- [ ] **Step 1: Atualizar a interface `DashboardData`**

Localizar `interface DashboardData {` e adicionar 2 campos no objeto `kpis`:

```typescript
interface DashboardData {
  kpis: {
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    totalRNegociacao: number;
    totalPNegociacao: number;
    taxaConversao: number;
    sugestoesAtivas: number;
    taxaAceitacao: number;
    clientesEmNegociacao: number;
    coberturaBase: number;
  };
  // ... resto inalterado
}
```

- [ ] **Step 2: Atualizar o grid e adicionar 2 KpiCards**

Localizar o `<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">` (existem 2 ocorrências — uma para skeleton, outra para os cards). Trocar `lg:grid-cols-7` por `lg:grid-cols-5 xl:grid-cols-9` em **ambas**:

```typescript
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-4">
```

E ajustar o skeleton `Array.from({ length: 7 })` para `Array.from({ length: 9 })`.

- [ ] **Step 3: Adicionar os 2 KpiCards novos no grid principal**

Localizar o último `<KpiCard title="Taxa Aceitacao" .../>` e adicionar logo depois (antes do fechamento do `</div>` do grid de KPIs):

```typescript
          <KpiCard
            title="Clientes em Negociacao"
            value={String(data?.kpis.clientesEmNegociacao ?? 0)}
            icon={<BarChart3 className="h-5 w-5 text-pink-500" />}
            accent="text-pink-600 dark:text-pink-400"
          />
          <KpiCard
            title="Cobertura da Base"
            value={`${data?.kpis.coberturaBase ?? 0}%`}
            icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
            accent="text-orange-600 dark:text-orange-400"
          />
```

- [ ] **Step 4: Subir dev server e validar visualmente**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
```

Abrir `http://localhost:3000/dashboard/comercial/crosssell-dashboard`. Verificar:
- 9 cards de KPI na linha (em telas xl) ou wrap correto em telas menores
- "Clientes em Negociação" mostra um número
- "Cobertura da Base" mostra um percentual com `%` no fim
- Dark mode funciona corretamente

- [ ] **Step 5: Parar dev server**

```bash
lsof -ti:3000 | xargs kill -9
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): dashboard exibe KPIs de Clientes em Negociacao e Cobertura

Adiciona 2 cards de KPI focados em cobertura de cliente (alem dos
KPIs de funil ja existentes). Grid passa de 7 para 9 colunas em xl.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verificação final

### Task 8: Smoke test integrado e push

**Files:** N/A (apenas verificação manual + git)

- [ ] **Step 1: Subir dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
```

- [ ] **Step 2: Validar fluxo end-to-end no Pipeline**

Abrir `http://localhost:3000/dashboard/comercial/crosssell` e percorrer:

1. Carregamento inicial: cards de cliente aparecem ordenados por maior potencial
2. Filtrar por etapa "Proposta enviada" — só clientes com ≥1 oportunidade nessa etapa
3. Mudar ordenação para "Maior MRR atual" — ordem muda
4. Clicar em "Nova Oportunidade" — dialog abre, busca cliente funciona, criar funciona
5. Mudar etapa de uma linha — card atualiza, dropdown reflete nova etapa
6. Em uma linha "Sugerido" — clicar ✓ → linha vira "Fazer Contato"
7. Em uma linha qualquer — clicar comentários → drawer abre com título "Comentários — <produto>"
8. Em uma linha não-sugerida — clicar troféu → dialog "Produto: <produto>" abre
9. Toggle dark mode — todas as cores adaptam corretamente

- [ ] **Step 3: Validar Dashboard**

Abrir `http://localhost:3000/dashboard/comercial/crosssell-dashboard` e verificar:

1. 9 KPIs aparecem (nas resoluções com `xl:`)
2. Os 2 KPIs novos têm valores numéricos válidos
3. Funil, rankings, gráficos continuam funcionando
4. Trocar mês/ano: KPIs antigos respondem ao filtro; os 2 novos não dependem de período (são snapshot atual)

- [ ] **Step 4: Parar dev server**

```bash
lsof -ti:3000 | xargs kill -9
```

- [ ] **Step 5: Verificar commits da branch**

```bash
git log --oneline main..HEAD
```

Expected: 7 commits (Task 0 não commita; tasks 1, 2, 3, 4, 5, 6, 7 cada uma commita).

- [ ] **Step 6: Push da branch**

```bash
git push -u origin feature/crosssell-cliente-view
```

- [ ] **Step 7: Abrir PR**

```bash
gh pr create --title "feat(crosssell): visao por cliente no pipeline" --body "$(cat <<'EOF'
## Summary
- Pipeline CrossSell passa a renderizar um card por cliente (era um por oportunidade)
- Card mostra serviços ativos (chips) e oportunidades mapeadas (lista vertical)
- Filtros enxutos (4) + dropdown de ordenação (potencial, MRR, recente, alfabético)
- Dashboard ganha 2 KPIs novos: Clientes em Negociação e Cobertura da Base

## Spec
docs/superpowers/specs/2026-04-27-crosssell-cliente-view-design.md

## Test plan
- [ ] Pipeline carrega cards por cliente, ordenados por potencial
- [ ] Filtros (cluster/CX/etapa/produto) reduzem a lista
- [ ] Trocar etapa numa linha atualiza o card
- [ ] Sugestões mostram ✓ Aceitar e ✗ Descartar + motivo abaixo
- [ ] Dialogs Nova Oportunidade, Ganho e Comentários funcionam
- [ ] Dashboard mostra 9 KPIs com os 2 novos com valores válidos
- [ ] Dark mode íntegro em ambas as páginas

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Anotar URL do PR retornada para acompanhamento.
