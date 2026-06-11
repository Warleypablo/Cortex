# Toggle Abonar Churn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um switch por linha na aba "Contratos" do Detalhamento de Churn para ativar/desativar o campo `abonar_churn` diretamente na tela.

**Architecture:** Novo endpoint `PATCH /api/churn/abonar/:taskId` no servidor atualiza `cup_churn.abonar_churn` no banco. No frontend, optimistic update local via `useState` mantém a UI responsiva; em caso de erro, reverte e exibe toast.

**Tech Stack:** Express (routes.ts), Drizzle ORM (sql tag), React + TanStack Query (useMutation), shadcn/ui Switch, Sonner toast.

---

## Arquivos

- **Modify:** `server/routes.ts` — novo endpoint PATCH
- **Modify:** `client/src/pages/ChurnDetalhamento.tsx` — import Switch + useMutation, estado local, nova coluna

---

### Task 1: Endpoint `PATCH /api/churn/abonar/:taskId`

**Files:**
- Modify: `server/routes.ts` (~linha 4669, antes do endpoint `/api/analytics/churn-detalhamento`)

- [ ] **Step 1: Localizar ponto de inserção**

  Abrir `server/routes.ts` e encontrar a linha que contém:
  ```typescript
  app.get("/api/analytics/churn-detalhamento",
  ```
  Inserir o novo endpoint IMEDIATAMENTE ANTES dessa linha.

- [ ] **Step 2: Inserir o endpoint**

  ```typescript
  app.patch("/api/churn/abonar/:taskId", async (req, res) => {
    const { taskId } = req.params;
    const { abonar } = req.body as { abonar: boolean };
    if (!taskId) {
      return res.status(400).json({ error: "taskId obrigatório" });
    }
    if (typeof abonar !== "boolean") {
      return res.status(400).json({ error: "abonar deve ser boolean" });
    }
    try {
      await db.execute(sql`
        UPDATE "Clickup".cup_churn
        SET abonar_churn = ${abonar ? "Sim" : null}
        WHERE task_id = ${taskId}
      `);
      res.json({ ok: true });
    } catch (error) {
      console.error("[churn/abonar] erro:", error);
      res.status(500).json({ error: "Falha ao atualizar abonar_churn" });
    }
  });
  ```

- [ ] **Step 3: Verificar que o servidor sobe sem erro**

  ```bash
  # Matar processo existente e reiniciar
  lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
  ```
  Esperado: `[express] serving on port 3000` sem erros de sintaxe.

- [ ] **Step 4: Commit**

  ```bash
  git add server/routes.ts
  git commit -m "feat(churn): endpoint PATCH /api/churn/abonar/:taskId"
  ```

---

### Task 2: Switch na tabela de Contratos

**Files:**
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

- [ ] **Step 1: Adicionar imports**

  Encontrar a linha com `import { useQuery } from "@tanstack/react-query";` e substituir por:
  ```typescript
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  ```

  Encontrar o bloco de imports do shadcn/ui (onde está `Badge`, `Button`, etc.) e adicionar:
  ```typescript
  import { Switch } from "@/components/ui/switch";
  ```

  Adicionar import do toast (verificar se já existe `import { toast } from "sonner"` — se não existir, adicionar):
  ```typescript
  import { toast } from "sonner";
  ```

- [ ] **Step 2: Adicionar estado local para optimistic update**

  Encontrar onde `filteredContratos` é definido (useMemo). Logo APÓS a definição do componente principal (após os outros `useState`), adicionar:

  ```typescript
  const [abonadoOverrides, setAbonadoOverrides] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  ```

- [ ] **Step 3: Adicionar useMutation**

  Logo após o `useState` acima, adicionar:

  ```typescript
  const abonarMutation = useMutation({
    mutationFn: async ({ taskId, abonar }: { taskId: string; abonar: boolean }) => {
      const res = await fetch(`/api/churn/abonar/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abonar }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar");
      return res.json();
    },
    onMutate: ({ taskId, abonar }) => {
      setAbonadoOverrides(prev => ({ ...prev, [taskId]: abonar }));
    },
    onError: (_err, { taskId }) => {
      setAbonadoOverrides(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      toast.error("Erro ao atualizar abono");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/churn-detalhamento"] });
    },
  });
  ```

- [ ] **Step 4: Adicionar coluna "Abonar" no cabeçalho da tabela**

  Encontrar (linha ~4360):
  ```tsx
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("lifetime_meses")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          LT
                          <SortIcon column="lifetime_meses" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
  ```

  Substituir por:
  ```tsx
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("lifetime_meses")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          LT
                          <SortIcon column="lifetime_meses" />
                        </div>
                      </TableHead>
                      <TableHead className="text-center w-[80px]">Abonar</TableHead>
                    </TableRow>
                  </TableHeader>
  ```

- [ ] **Step 5: Adicionar célula Switch na linha**

  Encontrar (linha ~4431):
  ```tsx
                            <TableCell className="text-right">
                              <Badge
                                variant={contrato.lifetime_meses < 3 ? "destructive" : contrato.lifetime_meses < 6 ? "secondary" : "default"}
                                className="text-[10px]"
                              >
                                {contrato.lifetime_meses.toFixed(1)}m
                              </Badge>
                            </TableCell>
                          </TableRow>
  ```

  Substituir por:
  ```tsx
                            <TableCell className="text-right">
                              <Badge
                                variant={contrato.lifetime_meses < 3 ? "destructive" : contrato.lifetime_meses < 6 ? "secondary" : "default"}
                                className="text-[10px]"
                              >
                                {contrato.lifetime_meses.toFixed(1)}m
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                              <Switch
                                checked={abonadoOverrides[contrato.id] ?? contrato.is_abonado ?? false}
                                onCheckedChange={checked =>
                                  abonarMutation.mutate({ taskId: contrato.id, abonar: checked })
                                }
                                disabled={abonarMutation.isPending}
                                className="data-[state=checked]:bg-amber-500"
                              />
                            </TableCell>
                          </TableRow>
  ```

  **Nota:** `e.stopPropagation()` evita que o clique no switch expanda a linha de detalhes.

- [ ] **Step 6: Ajustar colSpan do detalhe expandido**

  Encontrar (linha ~4442):
  ```tsx
                              <TableCell colSpan={11} className="p-0">
  ```
  Substituir por:
  ```tsx
                              <TableCell colSpan={12} className="p-0">
  ```

- [ ] **Step 7: Testar no browser**

  1. Abrir `http://localhost:3000/dashboard/churn-detalhamento`
  2. Ir para aba "Contratos"
  3. Verificar que a coluna "Abonar" aparece no final
  4. Clicar no switch de um contrato não-abonado → deve ficar âmbar imediatamente
  5. Recarregar a página → contrato deve permanecer abonado
  6. Clicar novamente para desabonar → deve voltar ao estado original após reload

- [ ] **Step 8: Commit**

  ```bash
  git add client/src/pages/ChurnDetalhamento.tsx
  git commit -m "feat(churn): toggle abonar/desabonar contrato direto na tabela de detalhamento"
  ```

---

### Task 3: Push

- [ ] **Step 1: Push para main**

  ```bash
  git push origin main
  ```
