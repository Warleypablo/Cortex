# CrossSell — Vendedor selecionável por oportunidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar campo `vendedor` selecionável (combobox pesquisável) em cada oportunidade mapeada da aba CrossSell Pipeline, persistindo por oportunidade.

**Architecture:** Nova coluna `vendedor TEXT` (nullable) em `cortex_core.crosssell_oportunidades`. Backend ganha endpoint `GET /api/comercial/crosssell/vendedores` (DISTINCT da união `vendedor` ∪ `responsavel_geral` ∪ `responsavel` de `cup_clientes`) e passa a aceitar `vendedor` no PATCH e retorná-lo no GET de listagem. Frontend adiciona componente `VendedorCombobox` (Popover + Command shadcn) na linha de oportunidade.

**Tech Stack:** PostgreSQL (GCP Cloud SQL prod + cortex_dev local), Drizzle ORM, Express, React 18, TanStack Query, shadcn/ui (Popover, Command/cmdk), Tailwind CSS.

**Spec:** [`docs/superpowers/specs/2026-05-08-crosssell-vendedor-por-oportunidade-design.md`](../specs/2026-05-08-crosssell-vendedor-por-oportunidade-design.md)

**Branch:** `feature/crosssell-vendedor-oportunidade`

**Convenções do projeto (CLAUDE.md):**
- Sempre criar feature branch antes de codar.
- Aplicar mudanças de schema **no prod E no local** (regra db_prod_sync).
- Suporte dark/light mode obrigatório.
- Conventional Commits + `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Não há suite de testes automatizados pra rotas/UI desta área — verificação por SQL/curl/teste manual no browser.

---

## Task 0: Preparar ambiente

**Files:** —

- [ ] **Step 1: Criar feature branch**

```bash
git checkout main
git pull origin main
git checkout -b feature/crosssell-vendedor-oportunidade
```

- [ ] **Step 2: Confirmar dev server desligado**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "porta livre"
```

---

## Task 1: Migration — coluna `vendedor` em `crosssell_oportunidades`

**Files:**
- Run SQL: prod (`34.95.249.110/dados_turbo`) + local (`localhost/cortex_dev`)

- [ ] **Step 1: Aplicar ALTER TABLE em produção**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo -c \
  "ALTER TABLE cortex_core.crosssell_oportunidades ADD COLUMN IF NOT EXISTS vendedor TEXT;"
```

Expected output: `ALTER TABLE`

- [ ] **Step 2: Verificar coluna criada em prod**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='cortex_core' AND table_name='crosssell_oportunidades' AND column_name='vendedor';"
```

Expected output: 1 linha com `vendedor`.

- [ ] **Step 3: Aplicar ALTER TABLE no banco local**

```bash
PGPASSWORD='dev123' psql -h localhost -U cortex -d cortex_dev -c \
  "ALTER TABLE cortex_core.crosssell_oportunidades ADD COLUMN IF NOT EXISTS vendedor TEXT;"
```

Expected output: `ALTER TABLE`

- [ ] **Step 4: Verificar coluna criada em local**

```bash
PGPASSWORD='dev123' psql -h localhost -U cortex -d cortex_dev -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='cortex_core' AND table_name='crosssell_oportunidades' AND column_name='vendedor';"
```

Expected output: 1 linha com `vendedor`.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(crosssell): add vendedor column to crosssell_oportunidades (prod+local)

Migration aplicada manualmente via psql em produção (GCP) e local (cortex_dev).
Coluna nullable, sem default — oportunidades existentes ficam com NULL.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Atualizar Drizzle schema

**Files:**
- Modify: `shared/schema.ts` (~linha 3267, dentro do `crosssellOportunidades`)

- [ ] **Step 1: Adicionar campo `vendedor` no schema**

No bloco `crosssellOportunidades` (entre `cxResponsavel` e `ultimoContato`), adicionar:

```ts
export const crosssellOportunidades = cortexCoreSchema.table("crosssell_oportunidades", {
  id: serial("id").primaryKey(),
  clienteId: text("cliente_id").notNull(),
  cnpj: text("cnpj").notNull(),
  produtoMapeado: text("produto_mapeado").notNull(),
  etapa: text("etapa").notNull().default("fazer_contato"),
  valorRNegociacao: decimal("valor_r_negociacao", { precision: 12, scale: 2 }).default("0"),
  valorPNegociacao: decimal("valor_p_negociacao", { precision: 12, scale: 2 }).default("0"),
  cxResponsavel: text("cx_responsavel").notNull(),
  vendedor: text("vendedor"),
  ultimoContato: date("ultimo_contato"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});
```

- [ ] **Step 2: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "schema\.ts|crosssell" | head -20
```

Expected: nenhum erro relacionado a `crosssellOportunidades`.

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "$(cat <<'EOF'
feat(schema): add vendedor field to crosssellOportunidades drizzle table

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Backend — endpoint `GET /api/comercial/crosssell/vendedores`

**Files:**
- Modify: `server/routes/crosssell.ts` (inserir logo após o `GET /api/comercial/crosssell`, ~linha 153, **antes** de qualquer rota com `:id`)

- [ ] **Step 1: Adicionar endpoint**

Logo após o `})` que fecha o handler de `GET /api/comercial/crosssell` (depois da linha que diz `});` correspondente ao `res.status(500).json({ error: "Failed to list clientes" })`), inserir:

```ts
  // 1b. GET /api/comercial/crosssell/vendedores — Lista unificada de vendedores
  // (DISTINCT união de cup_clientes.vendedor / responsavel_geral / responsavel)
  // IMPORTANTE: precisa estar registrada ANTES de qualquer rota com :id
  app.get("/api/comercial/crosssell/vendedores", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT pessoa
        FROM (
          SELECT vendedor          AS pessoa FROM "Clickup".cup_clientes WHERE vendedor IS NOT NULL AND vendedor <> ''
          UNION
          SELECT responsavel_geral AS pessoa FROM "Clickup".cup_clientes WHERE responsavel_geral IS NOT NULL AND responsavel_geral <> ''
          UNION
          SELECT responsavel       AS pessoa FROM "Clickup".cup_clientes WHERE responsavel IS NOT NULL AND responsavel <> ''
        ) t
        ORDER BY pessoa ASC
      `);
      const vendedores = (result.rows as any[]).map((r) => r.pessoa as string);
      res.json(vendedores);
    } catch (error) {
      console.error("[crosssell] Error listing vendedores:", error);
      res.status(500).json({ error: "Failed to list vendedores" });
    }
  });
```

- [ ] **Step 2: Iniciar dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Aguardar ~5s.

- [ ] **Step 3: Testar o endpoint via curl**

```bash
curl -s -b cookies.txt http://localhost:3000/api/comercial/crosssell/vendedores | head -c 500
```

(Se 401/Unauthorized, fazer login primeiro via UI no browser e copiar cookie; ou comentar temporariamente o middleware.)

Expected: array JSON de strings ordenadas alfabeticamente, ex: `["Ana Silva","Bruno Costa","Carlos ..."]`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
feat(api): add GET /api/comercial/crosssell/vendedores endpoint

Retorna lista DISTINCT unificada de cup_clientes.vendedor +
responsavel_geral + responsavel, ordenada alfabeticamente.
Fonte para o combobox de vendedor por oportunidade.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Backend — incluir `vendedor` no GET de listagem

**Files:**
- Modify: `server/routes/crosssell.ts` (~linhas 36-146, dentro do `GET /api/comercial/crosssell`)

- [ ] **Step 1: Adicionar `o.vendedor` no SELECT do CTE**

No CTE `oportunidades_filtradas`, adicionar `o.vendedor` logo após `o.cx_responsavel`. O bloco fica:

```sql
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
            o.vendedor AS vendedor_op,
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
            c.vendedor AS vendedor,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_comentarios cm
             WHERE cm.oportunidade_id = o.id) AS total_comentarios
          FROM cortex_core.crosssell_oportunidades o
          LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
          ${whereClause}
        ),
```

> **Importante:** alias `vendedor_op` evita colisão com o `c.vendedor AS vendedor` (do cliente, agregado depois). Mantém o nível-cliente `vendedor` intocado.

- [ ] **Step 2: Adicionar `vendedor` no `json_build_object` da agregação**

No `json_agg` da query principal, adicionar a chave `vendedor`:

```sql
          json_agg(json_build_object(
            'id', of_.id,
            'produto', of_.produto_mapeado,
            'etapa', of_.etapa,
            'valorRNegociacao', of_.valor_r_negociacao,
            'valorPNegociacao', of_.valor_p_negociacao,
            'cxResponsavel', of_.cx_responsavel,
            'vendedor', of_.vendedor_op,
            'ultimoContato', of_.ultimo_contato,
            'origem', COALESCE(of_.origem, 'manual'),
            'prioridade', of_.prioridade,
            'motivo', of_.motivo,
            'totalComentarios', of_.total_comentarios,
            'atualizadoEm', of_.atualizado_em
          ) ORDER BY of_.atualizado_em DESC) AS oportunidades
```

- [ ] **Step 3: Mapear `vendedor` no objeto JS retornado**

No `.map((op: any) => ({ ... }))` ao final do handler, adicionar:

```ts
        oportunidades: (r.oportunidades ?? []).map((op: any) => ({
          id: op.id,
          produto: op.produto,
          etapa: op.etapa,
          valorRNegociacao: op.valorRNegociacao != null ? Number(op.valorRNegociacao) : null,
          valorPNegociacao: op.valorPNegociacao != null ? Number(op.valorPNegociacao) : null,
          cxResponsavel: op.cxResponsavel,
          vendedor: op.vendedor ?? null,
          ultimoContato: op.ultimoContato,
          origem: op.origem ?? "manual",
          prioridade: op.prioridade,
          motivo: op.motivo,
          totalComentarios: Number(op.totalComentarios ?? 0),
          atualizadoEm: op.atualizadoEm,
        })),
```

- [ ] **Step 4: Reiniciar dev server e validar**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Aguardar ~5s.

```bash
curl -s -b cookies.txt http://localhost:3000/api/comercial/crosssell | python3 -c "
import json,sys
data = json.load(sys.stdin)
if not data:
    print('Lista vazia — ok'); sys.exit(0)
op = data[0].get('oportunidades', [{}])[0]
print('Tem campo vendedor?', 'vendedor' in op)
print('Valor:', op.get('vendedor'))
"
```

Expected: `Tem campo vendedor? True` e valor `None` (oportunidades existentes nasceram sem vendedor).

- [ ] **Step 5: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
feat(api): expose vendedor por oportunidade no GET /crosssell

Inclui o.vendedor no CTE como vendedor_op (alias evita colisão com
c.vendedor do cliente) e propaga no json_build_object e no map JS.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Backend — aceitar `vendedor` no PATCH

**Files:**
- Modify: `server/routes/crosssell.ts` (~linhas 192-254, handler `PATCH /:id`)

- [ ] **Step 1: Adicionar `vendedor` no destructure**

Localizar:

```ts
      const { etapa, valorRNegociacao, valorPNegociacao, ultimoContato, alteradoPor } = req.body;
```

Substituir por:

```ts
      const { etapa, valorRNegociacao, valorPNegociacao, ultimoContato, vendedor, alteradoPor } = req.body;
```

- [ ] **Step 2: Adicionar bloco `if` no SET dinâmico**

Após o bloco `if (ultimoContato !== undefined) { ... }`, adicionar:

```ts
      if (vendedor !== undefined) {
        values.push(vendedor);
        setClauses.push(`vendedor = $${values.length}`);
      }
```

> Nota: o reduce que substitui `$N` na linha 241 trata `null` como `'NULL'`. Strings com aspas simples são escapadas. Funciona pra string e null.

- [ ] **Step 3: Reiniciar dev server e testar PATCH**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Pegar um ID válido:

```bash
PGPASSWORD='dev123' psql -h localhost -U cortex -d cortex_dev -c \
  "SELECT id FROM cortex_core.crosssell_oportunidades LIMIT 1;"
```

Atribuir um vendedor (substituir `<ID>`):

```bash
curl -s -b cookies.txt -X PATCH http://localhost:3000/api/comercial/crosssell/<ID> \
  -H "Content-Type: application/json" \
  -d '{"vendedor":"Teste Vendedor"}'
```

Expected: JSON com a oportunidade atualizada, campo `vendedor: "Teste Vendedor"`.

Limpar (null):

```bash
curl -s -b cookies.txt -X PATCH http://localhost:3000/api/comercial/crosssell/<ID> \
  -H "Content-Type: application/json" \
  -d '{"vendedor":null}'
```

Expected: JSON com `vendedor: null`.

Verificar persistência:

```bash
PGPASSWORD='dev123' psql -h localhost -U cortex -d cortex_dev -c \
  "SELECT id, vendedor FROM cortex_core.crosssell_oportunidades WHERE id=<ID>;"
```

Expected: `vendedor` igual ao último PATCH (null neste ponto).

- [ ] **Step 4: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
feat(api): accept vendedor in PATCH /crosssell/:id

Adiciona campo ao destructure e ao UPDATE dinâmico.
Aceita string ou null (null persiste como NULL no banco).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Frontend — atualizar tipo e fetch da lista de vendedores

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx`

- [ ] **Step 1: Adicionar `vendedor` na interface `Oportunidade`**

Localizar (~linha 101):

```ts
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
```

Substituir por:

```ts
interface Oportunidade {
  id: number;
  produto: string;
  etapa: string;
  valorRNegociacao: number | null;
  valorPNegociacao: number | null;
  cxResponsavel: string;
  vendedor: string | null;
  ultimoContato: string | null;
  origem: "manual" | "sistema";
  prioridade: "alta" | "media" | "baixa" | null;
  motivo: string | null;
  totalComentarios: number;
  atualizadoEm: string;
}
```

- [ ] **Step 2: Adicionar query `useVendedoresList` dentro de `CrossSellPipeline`**

Localizar a query principal (~linha 246):

```ts
  const { data: clientes = [], isLoading } = useQuery<ClienteCrossSell[]>({
```

Logo após esse bloco (antes de `// Derived: list of distinct CX responsáveis`), adicionar:

```ts
  // Lista unificada de vendedores (cup_clientes.vendedor ∪ responsavel_geral ∪ responsavel)
  const { data: vendedoresList = [] } = useQuery<string[]>({
    queryKey: ["/api/comercial/crosssell/vendedores"],
    queryFn: async () => {
      const res = await fetch("/api/comercial/crosssell/vendedores");
      if (!res.ok) throw new Error("Erro ao carregar vendedores");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min — dado quase estático
  });
```

- [ ] **Step 3: Adicionar mutation `changeVendedor`**

Após o `changeValor` mutation (~linha 343), adicionar:

```ts
  const changeVendedor = useMutation({
    mutationFn: async ({ id, vendedor }: { id: number; vendedor: string | null }) => {
      const res = await fetch(`/api/comercial/crosssell/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor, alteradoPor: user?.name }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar vendedor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
    },
  });
```

- [ ] **Step 4: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "CrossSellPipeline" | head -20
```

Expected: nenhum erro.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): add vendedor to Oportunidade type, fetch list, mutation

- Tipo Oportunidade ganha campo vendedor: string | null.
- Query useVendedoresList carrega lista unificada com staleTime 5min.
- Mutation changeVendedor faz PATCH otimista invalidando a lista.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend — componente `VendedorCombobox`

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx` (adicionar componente no final do arquivo, antes do último `}`)

- [ ] **Step 1: Importar componentes do shadcn**

No topo do arquivo, junto com os outros imports, adicionar:

```ts
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
```

E adicionar `Check, X` na linha de import do `lucide-react` que hoje contém `Plus, MessageSquare, Trophy, ...`. O bloco fica:

```ts
import {
  Plus,
  MessageSquare,
  Trophy,
  Search,
  Send,
  User,
  Briefcase,
  Clock,
  Sparkles,
  Check,
  X,
} from "lucide-react";
```

- [ ] **Step 2: Implementar o componente**

Adicionar logo antes do `// ---` que delimita `OportunidadeRow` (~linha 845, depois de `InlineValorInput`):

```tsx
// ---------------------------------------------------------------------------
// VendedorCombobox — combobox pesquisável para selecionar vendedor da
// oportunidade. Lista vinda da união de cup_clientes (vendedor, responsavel_geral,
// responsavel). Aceita null (mostra "—").
// ---------------------------------------------------------------------------

function VendedorCombobox({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-left w-full max-w-[130px] px-1 py-0.5 rounded border border-transparent hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
          title={value ?? "Selecionar vendedor"}
        >
          <span
            className={`truncate ${
              value
                ? "text-gray-700 dark:text-zinc-300"
                : "text-gray-400 dark:text-zinc-600"
            }`}
          >
            {value ?? "—"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-64 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="bg-transparent">
          <CommandInput placeholder="Buscar vendedor..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__limpar__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-gray-500 dark:text-zinc-400"
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Limpar
              </CommandItem>
              {options.map((nome) => (
                <CommandItem
                  key={nome}
                  value={nome}
                  onSelect={() => {
                    onChange(nome === value ? null : nome);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${
                      value === nome ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "CrossSellPipeline|VendedorCombobox" | head -10
```

Expected: nenhum erro.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): add VendedorCombobox component (Popover + Command)

Combobox pesquisável com opção "Limpar" no topo, suporte a dark/light
mode e stopPropagation no trigger pra não disparar toggle do row.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend — integrar combobox em `OportunidadeRow`

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx` (props chain: `CrossSellPipeline` → `EtapaSection` → `ClienteRow` → `OportunidadeRow`)

- [ ] **Step 1: Passar `vendedoresList` e `onChangeVendedor` por toda a árvore**

**1.1) Em `CrossSellPipeline`** (~linha 484, no `<EtapaSection ...>`), adicionar duas props:

```tsx
          <EtapaSection
            key={etapa}
            etapa={etapa}
            grupos={grupos.get(etapa) ?? []}
            expanded={etapasExpandidas.has(etapa)}
            onToggle={...}
            onNewOpForEtapa={(e) => setNewOpEtapa(e)}
            ordenacao={ordenacao}
            onChangeEtapa={(opId, e) => changeEtapa.mutate({ id: opId, etapa: e })}
            onChangeValor={(opId, field, value) => changeValor.mutate({ id: opId, field, value })}
            onChangeVendedor={(opId, vendedor) => changeVendedor.mutate({ id: opId, vendedor })}
            vendedoresList={vendedoresList}
            onGanho={...}
            onComments={...}
          />
```

(Manter os handlers `onToggle`, `onGanho`, `onComments` intactos — só adicione as duas linhas novas.)

**1.2) Na assinatura de `EtapaSection`** (~linha 555), adicionar as duas props:

```tsx
function EtapaSection({
  etapa,
  grupos,
  expanded,
  onToggle,
  onNewOpForEtapa,
  ordenacao,
  onChangeEtapa,
  onChangeValor,
  onChangeVendedor,
  vendedoresList,
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
  onChangeValor: (opId: number, field: "valorRNegociacao" | "valorPNegociacao", value: number) => void;
  onChangeVendedor: (opId: number, vendedor: string | null) => void;
  vendedoresList: string[];
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
```

**1.3) Em `EtapaSection`, no `<ClienteRow ...>`** (~linha 634), repassar:

```tsx
            <ClienteRow
              key={`${etapa}-${cliente.cnpj}`}
              cliente={cliente}
              oportunidadesFiltradas={oportunidades}
              expanded={clientesExpandidos.has(cliente.cnpj)}
              onToggle={...}
              onChangeEtapa={onChangeEtapa}
              onChangeValor={onChangeValor}
              onChangeVendedor={onChangeVendedor}
              vendedoresList={vendedoresList}
              onGanho={onGanho}
              onComments={onComments}
            />
```

**1.4) Na assinatura de `ClienteRow`** (~linha 664), adicionar:

```tsx
function ClienteRow({
  cliente,
  oportunidadesFiltradas,
  expanded,
  onToggle,
  onChangeEtapa,
  onChangeValor,
  onChangeVendedor,
  vendedoresList,
  onGanho,
  onComments,
}: {
  cliente: ClienteCrossSell;
  oportunidadesFiltradas?: Oportunidade[];
  expanded: boolean;
  onToggle: () => void;
  onChangeEtapa: (opId: number, etapa: string) => void;
  onChangeValor: (opId: number, field: "valorRNegociacao" | "valorPNegociacao", value: number) => void;
  onChangeVendedor: (opId: number, vendedor: string | null) => void;
  vendedoresList: string[];
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
```

**1.5) Em `ClienteRow`, no `<OportunidadeRow ...>`** (~linha 761), repassar:

```tsx
                  <OportunidadeRow
                    key={op.id}
                    op={op}
                    onChangeEtapa={(etapa) => onChangeEtapa(op.id, etapa)}
                    onChangeValor={(field, value) => onChangeValor(op.id, field, value)}
                    onChangeVendedor={(vendedor) => onChangeVendedor(op.id, vendedor)}
                    vendedoresList={vendedoresList}
                    onGanho={() => onGanho(op)}
                    onComments={() => onComments(op)}
                  />
```

- [ ] **Step 2: Atualizar `OportunidadeRow` — assinatura e grid**

**2.1) Substituir a assinatura de `OportunidadeRow`** (~linha 848) por:

```tsx
function OportunidadeRow({
  op,
  onChangeEtapa,
  onChangeValor,
  onChangeVendedor,
  vendedoresList,
  onGanho,
  onComments,
}: {
  op: Oportunidade;
  onChangeEtapa: (etapa: string) => void;
  onChangeValor: (field: "valorRNegociacao" | "valorPNegociacao", value: number) => void;
  onChangeVendedor: (vendedor: string | null) => void;
  vendedoresList: string[];
  onGanho: () => void;
  onComments: () => void;
}) {
```

**2.2) Substituir o `gridTemplateColumns`** dentro de `OportunidadeRow` (~linha 880-882):

Antes:
```tsx
        style={{
          gridTemplateColumns:
            "16px 220px 140px 100px 100px 32px 56px",
        }}
```

Depois (8 colunas: bolinha, produto, vendedor, etapa, R, P, comm, trophy):
```tsx
        style={{
          gridTemplateColumns:
            "16px 200px 130px 130px 90px 90px 32px 56px",
        }}
```

**2.3) Inserir a célula `<VendedorCombobox>` entre o `<span>` do produto e o `<Select>` da etapa.**

O bloco atual é:

```tsx
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {op.produto}
        </span>

        <Select
          value={etapa}
          onValueChange={(v) => (v === "ganho" ? onGanho() : onChangeEtapa(v))}
        >
```

Inserir entre o `<span>` do `op.produto` e o `<Select>`:

```tsx
        <VendedorCombobox
          value={op.vendedor}
          options={vendedoresList}
          onChange={onChangeVendedor}
        />
```

Resultado final do início do grid:

```tsx
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {op.produto}
        </span>

        <VendedorCombobox
          value={op.vendedor}
          options={vendedoresList}
          onChange={onChangeVendedor}
        />

        <Select
          value={etapa}
          onValueChange={(v) => (v === "ganho" ? onGanho() : onChangeEtapa(v))}
        >
```

- [ ] **Step 3: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "CrossSellPipeline" | head -20
```

Expected: nenhum erro.

- [ ] **Step 4: Reiniciar dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Aguardar ~5s.

- [ ] **Step 5: Teste manual no browser**

Abrir `http://localhost:3000/comercial/crosssell` (ou caminho equivalente), verificar:

1. ✅ Aba CrossSell Pipeline carrega.
2. ✅ Expandir uma etapa → expandir um cliente → ver a coluna "—" (vendedor vazio) entre Produto e Etapa.
3. ✅ Clicar no "—" → popover abre com input de busca.
4. ✅ Digitar "an" → filtra a lista.
5. ✅ Selecionar um nome → célula passa a mostrar o nome; abrir DevTools Network e confirmar PATCH 200.
6. ✅ Reabrir popover → "Limpar" → célula volta para "—" com PATCH 200 (vendedor=null).
7. ✅ Recarregar a página → estado persiste.
8. ✅ Alternar dark mode (botão de tema) → cores corretas.
9. ✅ Etapas `Sugerido` e `Descartado` também permitem editar vendedor.

Se algum passo falhar, ajustar inline (debug com DevTools) e re-testar.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell): integrate VendedorCombobox into OportunidadeRow

- Coluna Vendedor entre Produto e Etapa (grid: 16/200/130/130/90/90/32/56).
- Props vendedoresList + onChangeVendedor propagadas via EtapaSection
  e ClienteRow até o OportunidadeRow.
- Edição inline com PATCH otimista; "—" quando null.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Push e PR

**Files:** —

- [ ] **Step 1: Push da branch**

```bash
git push -u origin feature/crosssell-vendedor-oportunidade
```

- [ ] **Step 2: Abrir PR**

```bash
gh pr create --title "feat(crosssell): vendedor selecionável por oportunidade" --body "$(cat <<'EOF'
## Summary

- Coluna **Vendedor** selecionável (combobox pesquisável) em cada oportunidade mapeada da aba CrossSell Pipeline.
- Lista unificada vinda de `cup_clientes.vendedor` ∪ `responsavel_geral` ∪ `responsavel` (DISTINCT).
- Persistência: nova coluna `vendedor TEXT` (nullable) em `cortex_core.crosssell_oportunidades`.
- Migration aplicada manualmente em **prod (GCP)** e **local (cortex_dev)**.

## Spec & Plan

- Spec: `docs/superpowers/specs/2026-05-08-crosssell-vendedor-por-oportunidade-design.md`
- Plan: `docs/superpowers/plans/2026-05-08-crosssell-vendedor-por-oportunidade.md`

## Test plan

- [ ] Aba CrossSell Pipeline abre, lista carrega com coluna "—" para oportunidades sem vendedor
- [ ] Clicar no "—" abre popover com busca
- [ ] Buscar e selecionar atualiza célula + persiste no banco (verificar via `psql` ou recarregar)
- [ ] "Limpar" volta para null
- [ ] Light + dark mode renderizam corretamente
- [ ] Etapas `sugerido_sistema` e `descartado` também permitem editar vendedor

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Confirmar URL do PR**

Saída do passo 2 contém a URL — copiar e enviar ao usuário.

---

## Self-Review

**1. Spec coverage:**
- ✅ Migration prod+local → Task 1
- ✅ Schema Drizzle → Task 2
- ✅ GET /vendedores antes de /:id → Task 3 (registrado logo após GET /, com comentário explícito sobre ordem)
- ✅ GET listagem retorna vendedor por oportunidade → Task 4 (alias `vendedor_op` evita colisão)
- ✅ PATCH aceita vendedor → Task 5
- ✅ Tipo Oportunidade ganha vendedor → Task 6
- ✅ Query useVendedoresList → Task 6
- ✅ Mutation changeVendedor → Task 6
- ✅ VendedorCombobox component → Task 7
- ✅ Coluna entre Produto e Etapa, grid ajustado → Task 8
- ✅ Dark/light mode → Task 7 (classes `dark:`) + Task 8 step 5 (validação manual)
- ✅ Plano de testes manuais → Task 8 step 5

**2. Placeholder scan:** sem TBDs, sem "implement later", sem "similar to Task N" — todo bloco de código exibido literalmente.

**3. Type consistency:**
- `onChangeVendedor: (opId: number, vendedor: string | null) => void` no nível pai (CrossSellPipeline → EtapaSection → ClienteRow).
- `onChangeVendedor: (vendedor: string | null) => void` no nível neto (OportunidadeRow), com `op.id` capturado via closure no `ClienteRow`.
- `vendedoresList: string[]` consistente em toda a cadeia.
- `value: string | null` no `VendedorCombobox` — match com `Oportunidade.vendedor`.
