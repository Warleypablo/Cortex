# Etapa "Recuperados" na Negativação - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar coluna "Recuperados" ao Kanban de negativação para clientes que quitaram suas dívidas, com visual de sucesso (verde), sem drag-and-drop.

**Architecture:** Mudar o status dos clientes auto-removidos de `concluido` para `quitado`. Adicionar a etapa `recuperados` no backend (filtro + response) e frontend (nova coluna verde no Kanban). Cards recuperados são read-only (sem drag).

**Tech Stack:** Express + Drizzle SQL (backend), React + Tailwind + Lucide (frontend)

---

### Task 1: Backend - Mudar status para `quitado` e incluir etapa `recuperados` no kanban

**Files:**
- Modify: `server/routes/negativacao.ts`

- [ ] **Step 1: Alterar a query de auto-remove para usar status `quitado` e etapa `recuperados`**

No endpoint `GET /api/negativacao/kanban` (linha ~12), alterar o UPDATE:

```typescript
      // Auto-move clients with no overdue unpaid debt to "recuperados"
      await db.execute(sql`
        UPDATE cortex_core.negativacao_acoes
        SET status = 'quitado',
            etapa = 'recuperados',
            observacoes = 'Quitado - movido automaticamente',
            atualizado_em = NOW()
        WHERE status IN ('pendente', 'em_andamento')
          AND cliente_id NOT IN (
            SELECT DISTINCT p.id_cliente::text
            FROM "Conta Azul".caz_parcelas p
            WHERE p.nao_pago > 0
              AND p.tipo_evento != 'DESPESA'
              AND p.data_vencimento < CURRENT_DATE
              AND p.id_cliente IS NOT NULL
          )
      `);
```

- [ ] **Step 2: Adicionar filtro `recuperados` no agrupamento por etapa**

Após a linha `const acaoJudicial = allActions.filter(...)` (linha ~37), adicionar:

```typescript
      const recuperados = allActions.filter((a: any) => a.etapa === "recuperados");
```

- [ ] **Step 3: Incluir `recuperados` no response JSON**

Na linha ~56, alterar o `res.json` para incluir a nova coluna:

```typescript
      res.json({
        colunas: { notificacao, protesto, negativacao, acao_judicial: acaoJudicial, recuperados },
        resumo: {
          totalClientes: clienteIds.size,
          totalValor,
          totalAcordos: acordos.length,
          taxaRecuperacao: Math.round(taxaRecuperacao * 100) / 100,
        },
      });
```

- [ ] **Step 4: Atualizar registros existentes que já foram marcados como `concluido` pelo auto-remove**

Esses já foram marcados com `observacoes = 'Quitado - removido automaticamente'`. Precisamos migrá-los. Adicionar uma migration one-time no início do endpoint (antes do auto-move), que pode ser removida depois:

```typescript
      // One-time migration: move previously auto-removed to recuperados
      await db.execute(sql`
        UPDATE cortex_core.negativacao_acoes
        SET status = 'quitado', etapa = 'recuperados'
        WHERE status = 'concluido'
          AND observacoes = 'Quitado - removido automaticamente'
      `);
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/negativacao.ts
git commit -m "feat(negativacao): add 'recuperados' stage for paid clients

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend - Adicionar coluna Recuperados ao Kanban

**Files:**
- Modify: `client/src/pages/Negativacao.tsx`

- [ ] **Step 1: Importar ícone `CheckCircle2` do Lucide**

Adicionar `CheckCircle2` ao bloco de imports do lucide-react (linha ~28).

- [ ] **Step 2: Adicionar `recuperados` ao array ETAPAS**

Após o item `acao_judicial` no array `ETAPAS` (linha ~134), adicionar:

```typescript
  {
    key: "recuperados",
    label: "Recuperados",
    icon: CheckCircle2,
    color: "green",
    bgLight: "bg-green-50",
    bgDark: "dark:bg-green-950/30",
    borderLight: "border-green-200",
    borderDark: "dark:border-green-800",
    headerBg: "bg-green-100 dark:bg-green-900/40",
    badgeBg: "bg-green-500",
    textColor: "text-green-700 dark:text-green-400",
  },
```

- [ ] **Step 3: Adicionar `quitado` ao `STATUS_COLORS`**

Após `cancelado` no objeto `STATUS_COLORS` (linha ~142), adicionar:

```typescript
  quitado: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
```

- [ ] **Step 4: Adicionar `recuperados` ao `KanbanData` interface**

Na interface `KanbanData` (linha ~66), adicionar `recuperados` às colunas:

```typescript
interface KanbanData {
  colunas: {
    notificacao: NegativacaoAcao[];
    protesto: NegativacaoAcao[];
    negativacao: NegativacaoAcao[];
    acao_judicial: NegativacaoAcao[];
    recuperados: NegativacaoAcao[];
  };
  // ...
}
```

- [ ] **Step 5: Desabilitar drag nos cards da coluna Recuperados**

No render dos cards (linha ~532), o atributo `draggable` e os handlers de drag devem ser condicionais. Alterar:

```tsx
draggable={etapa.key !== "recuperados"}
onDragStart={(e) => etapa.key !== "recuperados" && handleDragStart(e, action.clienteId)}
```

E no drop handler da coluna, impedir drop em recuperados:

```tsx
onDragOver={etapa.key !== "recuperados" ? handleDragOver : undefined}
onDrop={etapa.key !== "recuperados" ? (e) => handleDrop(e, etapa.key) : undefined}
```

- [ ] **Step 6: Esconder o GripVertical drag handle para cards recuperados**

No card render, mostrar o GripVertical condicionalmente:

```tsx
{etapa.key !== "recuperados" && (
  <GripVertical className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
)}
```

Nota: como o card render está dentro do `ETAPAS.map`, a variável `etapa` já está disponível no escopo. Se não estiver, passar `etapa.key` como prop ou usar o `action.etapa` para a verificação.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Negativacao.tsx
git commit -m "feat(negativacao): add 'Recuperados' column to kanban board

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Testar e ajustar

- [ ] **Step 1: Reiniciar dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

- [ ] **Step 2: Testar no browser**

1. Abrir `/financeiro/negativacao`
2. Verificar que a coluna "Recuperados" aparece à direita com visual verde
3. Verificar que clientes sem dívida vencida foram movidos para lá
4. Verificar que cards em "Recuperados" não são draggable
5. Verificar que não é possível dropar cards em "Recuperados"
6. Clicar em um card recuperado e verificar que o drawer abre normalmente
7. Verificar dark mode e light mode

- [ ] **Step 3: Commit final se necessário**
