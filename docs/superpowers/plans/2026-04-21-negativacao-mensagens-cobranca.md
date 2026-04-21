# Mensagens de Cobrança no Drawer de Negativação - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir histórico completo de mensagens de cobrança (TurboZap) no drawer de detalhes do cliente na aba de negativação.

**Architecture:** Novo endpoint GET no backend que consulta `cortex_core.turbozap_envios` por `id_cliente`. No frontend, nova query React Query carregada ao abrir o drawer, renderizando seção dedicada abaixo da timeline existente.

**Tech Stack:** Express (backend), React + React Query + Tailwind + Lucide icons (frontend), SQL direto via Drizzle `db.execute(sql)`.

---

### Task 1: Backend - Novo endpoint de mensagens de cobrança

**Files:**
- Modify: `server/routes/negativacao.ts` (adicionar após o endpoint `/api/negativacao/resumo`, linha ~215)

- [ ] **Step 1: Adicionar endpoint GET /api/negativacao/mensagens/:clienteId**

Adicionar antes do fechamento da função `registerNegativacaoRoutes`, após o endpoint de resumo (linha 214):

```typescript
  // GET /api/negativacao/mensagens/:clienteId — Billing messages from TurboZap
  app.get("/api/negativacao/mensagens/:clienteId", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const result = await db.execute(sql`
        SELECT
          tipo_cobranca,
          criado_em,
          valor,
          telefone,
          status
        FROM cortex_core.turbozap_envios
        WHERE id_cliente = ${clienteId}
        ORDER BY criado_em DESC
      `);
      res.json(result.rows || []);
    } catch (error) {
      console.error("[api] Error fetching mensagens cobranca:", error);
      res.status(500).json({ error: "Failed to fetch billing messages" });
    }
  });
```

- [ ] **Step 2: Verificar que o servidor reinicia sem erros**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &`

Testar: `curl -s http://localhost:3000/api/negativacao/mensagens/test123 | head`

Expected: `[]` (array vazio, sem erro 500)

- [ ] **Step 3: Commit**

```bash
git add server/routes/negativacao.ts
git commit -m "feat(negativacao): add endpoint for client billing messages from TurboZap"
```

---

### Task 2: Frontend - Interface de tipo e query para mensagens

**Files:**
- Modify: `client/src/pages/Negativacao.tsx`

- [ ] **Step 1: Adicionar interface MensagemCobranca após a interface KanbanData (linha ~78)**

```typescript
interface MensagemCobranca {
  tipo_cobranca: string;
  criado_em: string;
  valor: string;
  telefone: string;
  status: string;
}
```

- [ ] **Step 2: Adicionar import do ícone MessageSquare no bloco de imports do Lucide (linha ~29)**

Adicionar `MessageSquare` e `Phone` à lista de imports existente do lucide-react:

```typescript
import {
  AlertTriangle,
  Scale,
  Gavel,
  FileWarning,
  Handshake,
  Clock,
  User,
  Calendar,
  ChevronRight,
  GripVertical,
  CircleDot,
  MessageSquare,
  Phone,
} from "lucide-react";
```

- [ ] **Step 3: Adicionar query de mensagens após a query de clientHistory (após linha ~181)**

```typescript
  const { data: mensagensCobranca, isLoading: isLoadingMensagens } = useQuery<MensagemCobranca[]>({
    queryKey: ["/api/negativacao/mensagens", selectedClient],
    queryFn: async () => {
      const r = await fetch(`/api/negativacao/mensagens/${selectedClient}`);
      if (!r.ok) throw new Error("Failed to fetch billing messages");
      return r.json();
    },
    enabled: !!selectedClient,
  });
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Negativacao.tsx
git commit -m "feat(negativacao): add billing messages type and query"
```

---

### Task 3: Frontend - Renderizar seção de mensagens de cobrança no drawer

**Files:**
- Modify: `client/src/pages/Negativacao.tsx`

- [ ] **Step 1: Adicionar seção de mensagens de cobrança abaixo da timeline (após linha ~703, antes do Edit Form)**

Inserir entre o fechamento da `</div>` da timeline (linha ~703) e o `<div>` do Edit Form (linha ~706, que tem `border-t`):

```tsx
              {/* Mensagens de Cobrança */}
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <h4 className="font-medium text-sm text-gray-700 dark:text-zinc-300">
                    Mensagens de Cobrança
                  </h4>
                  {mensagensCobranca && mensagensCobranca.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      {mensagensCobranca.length}
                    </Badge>
                  )}
                </div>

                {isLoadingMensagens ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                ) : !mensagensCobranca || mensagensCobranca.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-zinc-500 italic">
                    Nenhuma mensagem de cobrança encontrada para este cliente.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {mensagensCobranca.map((msg, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className="text-xs font-mono bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                            >
                              {msg.tipo_cobranca}
                            </Badge>
                            <span className="text-xs text-gray-500 dark:text-zinc-400">
                              {msg.criado_em
                                ? new Date(msg.criado_em).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-zinc-400">
                            <span className="font-medium">
                              {formatCurrency(parseFloat(msg.valor || "0"))}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {msg.telefone}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {msg.status === "enviado" && (
                            <span className="text-green-600 dark:text-green-400 text-sm" title="Enviado">✓</span>
                          )}
                          {msg.status === "erro" && (
                            <span className="text-red-600 dark:text-red-400 text-sm" title="Erro">✗</span>
                          )}
                          {msg.status === "pulado" && (
                            <span className="text-gray-400 dark:text-zinc-500 text-sm" title="Pulado">⏭</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
```

- [ ] **Step 2: Testar no browser**

1. Abrir `/financeiro/negativacao`
2. Clicar em um card de cliente no Kanban
3. Verificar que o drawer abre e a seção "Mensagens de Cobrança" aparece abaixo da timeline
4. Verificar dark mode e light mode
5. Verificar estado vazio (cliente sem mensagens)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Negativacao.tsx
git commit -m "feat(negativacao): display billing messages in client detail drawer"
```
