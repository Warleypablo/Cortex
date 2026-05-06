# TurboZap — Biblioteca de Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma biblioteca de templates nomeados ao TurboZap, com seletor por nível de cobrança, botões clicáveis de variável e exclusão de templates.

**Architecture:** Nova tabela `cortex_core.turbozap_templates` persiste templates nomeados. Funções de serviço em `turbozap.ts` expõem CRUD; 3 novos endpoints REST. No frontend, `BibliotecaTemplates` gerencia criação/exclusão e `TemplateNivelEditor` envolve cada nível com seletor de template e botões de variável.

**Tech Stack:** PostgreSQL (raw SQL via drizzle `db.execute`), Express, React, React Query, Tailwind CSS, Vitest

---

## File Map

| Arquivo | Mudança |
|---------|---------|
| `server/services/turbozap.ts` | Adicionar `TurboZapTemplate`, CREATE TABLE em `initTurboZapTables`, funções `getTemplates` / `createTemplate` / `deleteTemplate` |
| `server/services/turbozap-templates.test.ts` | Criar — testes das 3 funções CRUD |
| `server/routes/turbozap.ts` | Adicionar 3 rotas: GET/POST/DELETE `/api/turbozap/templates` |
| `client/src/pages/TurboZap.tsx` | Adicionar `TurboZapTemplate`, `VARIAVEIS`, `insertarVariavel`, `BibliotecaTemplates`, `TemplateNivelEditor`; refatorar `ConfiguracoesTab` |

---

## Task 1: DB migration — criar tabela `turbozap_templates`

**Files:**
- Modify: `server/services/turbozap.ts` (dentro de `initTurboZapTables`, antes do bloco da tabela `turbozap_pipeline_juridico`)

- [ ] **Step 1: Adicionar bloco CREATE TABLE**

Em `server/services/turbozap.ts`, dentro da função `initTurboZapTables`, localizar o comentário `// Create pipeline juridico table` (~linha 297) e inserir o bloco abaixo **antes** dele:

```typescript
    // Create templates library table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.turbozap_templates (
        id         SERIAL PRIMARY KEY,
        nome       TEXT NOT NULL,
        conteudo   TEXT NOT NULL,
        criado_por TEXT,
        criado_em  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
```

- [ ] **Step 2: Reiniciar o servidor para executar a migration**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
curl -s http://localhost:3000/api/turbozap/stats -b cookies.txt | head -c 100
```

O server deve subir sem erro. A tabela é criada com `IF NOT EXISTS`, portanto idempotente.

- [ ] **Step 3: Commit**

```bash
git add server/services/turbozap.ts
git commit -m "feat(turbozap): criar tabela turbozap_templates no init"
```

---

## Task 2: Service CRUD + interface + testes

**Files:**
- Modify: `server/services/turbozap.ts` — adicionar interface e 3 funções
- Create: `server/services/turbozap-templates.test.ts`

- [ ] **Step 1: Escrever o arquivo de testes (failing)**

Criar `server/services/turbozap-templates.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import { getTemplates, createTemplate, deleteTemplate } from './turbozap';

describe('getTemplates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista de templates', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, nome: 'Template A', conteudo: 'Olá {nome}', criado_por: 'user@x.com', criado_em: '2026-05-01T00:00:00Z' },
      ],
    });
    const result = await getTemplates();
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Template A');
  });

  it('retorna array vazio quando não há templates', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getTemplates();
    expect(result).toEqual([]);
  });
});

describe('createTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria e retorna o template inserido', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, nome: 'Novo', conteudo: 'Texto {valor}', criado_por: 'user', criado_em: '2026-05-01T00:00:00Z' }],
    });
    const result = await createTemplate('Novo', 'Texto {valor}', 'user');
    expect(result.id).toBe(2);
    expect(result.nome).toBe('Novo');
    expect(result.conteudo).toBe('Texto {valor}');
  });
});

describe('deleteTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lança erro se template não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(deleteTemplate(999)).rejects.toThrow('Template não encontrado');
  });

  it('resolve sem erro quando template existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await expect(deleteTemplate(1)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar os testes — confirmar que falham por "not exported"**

```bash
npx vitest run server/services/turbozap-templates.test.ts 2>&1 | tail -20
```

Esperado: FAIL com `getTemplates is not a function` ou similar.

- [ ] **Step 3: Adicionar interface `TurboZapTemplate` e as 3 funções ao serviço**

Em `server/services/turbozap.ts`, após a interface `TurboZapConfiguracao` (~linha 62), adicionar:

```typescript
export interface TurboZapTemplate {
  id: number;
  nome: string;
  conteudo: string;
  criado_por: string | null;
  criado_em: string;
}
```

Ao final do arquivo (após `updatePipelineJuridico` ou qualquer última função), adicionar:

```typescript
// ============================================
// Templates biblioteca
// ============================================

export async function getTemplates(): Promise<TurboZapTemplate[]> {
  const result = await db.execute(sql`
    SELECT id, nome, conteudo, criado_por, criado_em
    FROM cortex_core.turbozap_templates
    ORDER BY criado_em DESC
  `);
  return result.rows as TurboZapTemplate[];
}

export async function createTemplate(
  nome: string,
  conteudo: string,
  criadoPor: string,
): Promise<TurboZapTemplate> {
  const result = await db.execute(sql`
    INSERT INTO cortex_core.turbozap_templates (nome, conteudo, criado_por)
    VALUES (${nome}, ${conteudo}, ${criadoPor})
    RETURNING id, nome, conteudo, criado_por, criado_em
  `);
  return result.rows[0] as TurboZapTemplate;
}

export async function deleteTemplate(id: number): Promise<void> {
  const result = await db.execute(sql`
    DELETE FROM cortex_core.turbozap_templates
    WHERE id = ${id}
    RETURNING id
  `);
  if (result.rows.length === 0) {
    throw new Error("Template não encontrado");
  }
}
```

- [ ] **Step 4: Rodar os testes — confirmar que passam**

```bash
npx vitest run server/services/turbozap-templates.test.ts 2>&1 | tail -20
```

Esperado: `4 tests | 4 passed`.

- [ ] **Step 5: Commit**

```bash
git add server/services/turbozap.ts server/services/turbozap-templates.test.ts
git commit -m "feat(turbozap): adicionar CRUD de biblioteca de templates"
```

---

## Task 3: API routes GET / POST / DELETE

**Files:**
- Modify: `server/routes/turbozap.ts`

- [ ] **Step 1: Adicionar imports das novas funções**

Em `server/routes/turbozap.ts`, localizar o bloco de imports do serviço (~linha 2-14) e adicionar `getTemplates`, `createTemplate`, `deleteTemplate`:

```typescript
import {
  initTurboZapTables,
  previewCobrancas,
  executarCobrancas,
  previewPorData,
  executarEnvioMassa,
  getHistorico,
  getStats,
  getConfiguracoes,
  updateConfiguracao,
  getPipelineJuridico,
  updatePipelineJuridico,
  getTemplates,
  createTemplate,
  deleteTemplate,
} from "../services/turbozap";
```

- [ ] **Step 2: Adicionar as 3 rotas antes do fechamento de `registerTurboZapRoutes`**

Antes da linha `}` que fecha `registerTurboZapRoutes` (~linha 201), inserir:

```typescript
  // GET /api/turbozap/templates - Lista biblioteca de templates
  app.get("/api/turbozap/templates", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const templates = await getTemplates();
      res.json(templates);
    } catch (error) {
      console.error("[turbozap] Error fetching templates:", error);
      res.status(500).json({ message: "Erro ao buscar templates" });
    }
  });

  // POST /api/turbozap/templates - Cria template na biblioteca
  app.post("/api/turbozap/templates", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const { nome, conteudo } = req.body;
      if (!nome || !conteudo) {
        return res.status(400).json({ message: "Campos 'nome' e 'conteudo' são obrigatórios" });
      }
      const template = await createTemplate(
        nome,
        conteudo,
        user?.email || user?.name || "sistema",
      );
      res.status(201).json(template);
    } catch (error) {
      console.error("[turbozap] Error creating template:", error);
      res.status(500).json({ message: "Erro ao criar template" });
    }
  });

  // DELETE /api/turbozap/templates/:id - Remove template da biblioteca
  app.delete("/api/turbozap/templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      await deleteTemplate(id);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[turbozap] Error deleting template:", error);
      const status = error.message === "Template não encontrado" ? 404 : 500;
      res.status(status).json({ message: error.message || "Erro ao deletar template" });
    }
  });
```

- [ ] **Step 3: Reiniciar servidor e verificar rotas**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
# Verificar se server sobe sem erro de compilação TypeScript
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/turbozap/templates
```

Esperado: `200` (ou `401` se sem sessão ativa — ambos indicam que a rota existe).

- [ ] **Step 4: Commit**

```bash
git add server/routes/turbozap.ts
git commit -m "feat(turbozap): adicionar rotas GET/POST/DELETE /api/turbozap/templates"
```

---

## Task 4: UI — componente `BibliotecaTemplates`

**Files:**
- Modify: `client/src/pages/TurboZap.tsx`

- [ ] **Step 1: Adicionar imports necessários no topo do arquivo**

Em `TurboZap.tsx`, localizar a linha de imports do lucide-react (~linha 8) e adicionar `Plus` e `Trash2`:

```typescript
import {
  Zap, Send, History, Settings, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, SkipForward, Search, Loader2,
  MessageSquare, TrendingUp, AlertTriangle, Phone, X, Scale, Calendar,
  Plus, Trash2,
} from "lucide-react";
```

Adicionar `useRef` ao import do React (~linha 1):

```typescript
import { useState, useMemo, useRef } from "react";
```

- [ ] **Step 2: Adicionar interface `TurboZapTemplate` e constantes de variáveis**

Após o bloco de interfaces existentes (~após linha 99, antes de `const ETAPAS_PIPELINE`), adicionar:

```typescript
interface TurboZapTemplate {
  id: number;
  nome: string;
  conteudo: string;
  criado_por: string | null;
  criado_em: string;
}

const VARIAVEIS = ["{nome}", "{valor}", "{vencimento}", "{link_pagamento}"];

function insertarVariavel(
  variavel: string,
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void,
) {
  const ta = ref.current;
  if (!ta) {
    onChange(value + variavel);
    return;
  }
  const start = ta.selectionStart ?? value.length;
  const end = ta.selectionEnd ?? value.length;
  const newVal = value.slice(0, start) + variavel + value.slice(end);
  onChange(newVal);
  requestAnimationFrame(() => {
    ta.selectionStart = start + variavel.length;
    ta.selectionEnd = start + variavel.length;
    ta.focus();
  });
}
```

- [ ] **Step 3: Adicionar componente `BibliotecaTemplates`**

Antes da função `ConfiguracoesTab` (~linha 627), inserir o componente completo:

```typescript
// ============================================
// Biblioteca de Templates
// ============================================

function BibliotecaTemplates() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [conteudoNovo, setConteudoNovo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TurboZapTemplate | null>(null);
  const formTextareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: templates = [] } = useQuery<TurboZapTemplate[]>({
    queryKey: ["/api/turbozap/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/turbozap/templates", {
        nome: nomeNovo,
        conteudo: conteudoNovo,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/templates"] });
      toast({ title: "Template criado!" });
      setShowForm(false);
      setNomeNovo("");
      setConteudoNovo("");
    },
    onError: () => {
      toast({ title: "Erro ao criar template", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/turbozap/templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/templates"] });
      toast({ title: "Template excluído!" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir template", variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-gray-900 dark:text-white text-lg">
          Biblioteca de Templates
        </CardTitle>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1">
            <Plus className="w-3 h-3" /> Novo Template
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-4 space-y-3">
            <Input
              placeholder="Nome do template (ex: Lembrete Amigável)"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              className="bg-gray-50 dark:bg-zinc-800"
            />
            <Textarea
              ref={formTextareaRef}
              placeholder="Conteúdo da mensagem..."
              value={conteudoNovo}
              onChange={(e) => setConteudoNovo(e.target.value)}
              className="min-h-[120px] bg-gray-50 dark:bg-zinc-800 text-sm font-mono"
            />
            <div className="flex flex-wrap gap-1">
              {VARIAVEIS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertarVariavel(v, formTextareaRef, conteudoNovo, setConteudoNovo)}
                  className="px-2 py-0.5 text-xs rounded border border-dashed border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 hover:border-primary hover:text-primary transition-colors font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!nomeNovo.trim() || !conteudoNovo.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Salvando..." : "Salvar Template"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setNomeNovo("");
                  setConteudoNovo("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {templates.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 dark:text-zinc-500">
            Nenhum template salvo ainda. Crie o primeiro clicando em "Novo Template".
          </p>
        )}

        <div className="space-y-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-zinc-800"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tpl.nome}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 line-clamp-2">
                  {tpl.conteudo}
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(tpl)}
                className="shrink-0 p-1 text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
                title="Excluir template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">
              Excluir template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-zinc-400">
              Tem certeza que deseja excluir "{deleteTarget?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-zinc-800 dark:text-white dark:border-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

- [ ] **Step 4: Adicionar `<BibliotecaTemplates />` no início do return de `ConfiguracoesTab`**

Em `ConfiguracoesTab` (~linha 734), localizar o `return (` e o `<div className="space-y-6">`. Adicionar `<BibliotecaTemplates />` como primeiro filho, antes do card "Templates — Financeiro":

```tsx
  return (
    <div className="space-y-6">
      {/* Save all button */}
      {dirty.size > 0 && (
        // ... (mantido como está)
      )}

      {/* Biblioteca de Templates */}
      <BibliotecaTemplates />

      {/* Templates Financeiro */}
      <Card ...>
```

- [ ] **Step 5: Verificar no browser — acessar aba Configurações**

```bash
# server deve estar rodando em :3000
# Abrir http://localhost:3000 → TurboZap → Configurações
# Verificar: card "Biblioteca de Templates" aparece no topo
# Verificar: botão "+ Novo Template" funciona
# Verificar: form abre com textarea + 4 botões de variável
# Verificar: criar template → aparece na lista
# Verificar: excluir template → confirm dialog → some da lista
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/TurboZap.tsx
git commit -m "feat(turbozap): adicionar componente BibliotecaTemplates com criar/excluir"
```

---

## Task 5: UI — `TemplateNivelEditor` com seletor e botões de variável

**Files:**
- Modify: `client/src/pages/TurboZap.tsx`

- [ ] **Step 1: Adicionar componente `TemplateNivelEditor` antes de `ConfiguracoesTab`**

Inserir logo antes da função `ConfiguracoesTab` (após `BibliotecaTemplates`):

```typescript
interface TemplateNivelEditorProps {
  tipo: string;
  value: string;
  isDirty: boolean;
  onValueChange: (v: string) => void;
  onSave: () => void;
  savePending: boolean;
  colors: { bg: string; text: string; border: string };
}

function TemplateNivelEditor({
  tipo,
  value,
  isDirty,
  onValueChange,
  onSave,
  savePending,
  colors,
}: TemplateNivelEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingTemplate, setPendingTemplate] = useState<TurboZapTemplate | null>(null);
  const [selectKey, setSelectKey] = useState(0);

  const { data: templates = [] } = useQuery<TurboZapTemplate[]>({
    queryKey: ["/api/turbozap/templates"],
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className={`${colors.bg} ${colors.text} border-0`}>{tipo}</Badge>
          {isDirty && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">modificado</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <Select
              key={selectKey}
              onValueChange={(v) => {
                const tpl = templates.find((t) => String(t.id) === v);
                if (tpl) setPendingTemplate(tpl);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-[200px] bg-gray-50 dark:bg-zinc-800">
                <SelectValue placeholder="Aplicar template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isDirty && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSave}
              disabled={savePending}
            >
              Salvar
            </Button>
          )}
        </div>
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="min-h-[120px] bg-gray-50 dark:bg-zinc-800 text-sm font-mono"
        placeholder={`Template para ${tipo}...`}
      />

      <div className="flex flex-wrap gap-1">
        {VARIAVEIS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insertarVariavel(v, textareaRef, value, onValueChange)}
            className="px-2 py-0.5 text-xs rounded border border-dashed border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 hover:border-primary hover:text-primary transition-colors font-mono"
          >
            {v}
          </button>
        ))}
      </div>

      <AlertDialog
        open={!!pendingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTemplate(null);
            setSelectKey((k) => k + 1);
          }
        }}
      >
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">
              Aplicar template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-zinc-400">
              Substituir o texto atual de <strong className="text-gray-900 dark:text-white">{tipo}</strong> pelo template{" "}
              <strong className="text-gray-900 dark:text-white">"{pendingTemplate?.nome}"</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="dark:bg-zinc-800 dark:text-white dark:border-zinc-700"
              onClick={() => setSelectKey((k) => k + 1)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplate) onValueChange(pendingTemplate.conteudo);
                setPendingTemplate(null);
                setSelectKey((k) => k + 1);
              }}
            >
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

> **Nota:** `selectKey` é um trick para resetar o Select após aplicar ou cancelar, pois o componente Radix não limpa o valor selecionado sem recriar o elemento.

- [ ] **Step 2: Substituir o bloco de render por nível nos cards Financeiro e Jurídico**

Em `ConfiguracoesTab`, dentro do `.map((tipo) => {...})` dos cards Financeiro (~linha 760) e Jurídico (~linha 810), substituir o bloco `<div key={tipo} className="space-y-2">` que contém Badge + isDirty + Textarea + hint de variáveis pelo uso do `TemplateNivelEditor`.

**Antes (padrão repetido em ambos os cards):**
```tsx
{templateKeysFinanceiro.map((tipo) => {
  const chave = `template_${tipo}`;
  const colors = TIPO_COLORS[tipo] || TIPO_COLORS["D-3"];
  const isDirty = dirty.has(chave);
  return (
    <div key={tipo} className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={`${colors.bg} ${colors.text} border-0`}>{tipo}</Badge>
          {isDirty && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">modificado</span>
          )}
        </div>
        {isDirty && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveMutation.mutate(chave)}
            disabled={saveMutation.isPending}
          >
            Salvar
          </Button>
        )}
      </div>
      <Textarea
        value={getVal(chave)}
        onChange={(e) => setVal(chave, e.target.value)}
        className="min-h-[120px] bg-gray-50 dark:bg-zinc-800 text-sm font-mono"
        placeholder={`Template para ${tipo}...`}
      />
      <p className="text-xs text-gray-400 dark:text-zinc-500">
        Variáveis: {"{nome}"}, {"{valor}"}, {"{vencimento}"}, {"{link_pagamento}"}
      </p>
    </div>
  );
})}
```

**Depois:**
```tsx
{templateKeysFinanceiro.map((tipo) => {
  const chave = `template_${tipo}`;
  const colors = TIPO_COLORS[tipo] || TIPO_COLORS["D-3"];
  return (
    <TemplateNivelEditor
      key={tipo}
      tipo={tipo}
      value={getVal(chave)}
      isDirty={dirty.has(chave)}
      onValueChange={(v) => setVal(chave, v)}
      onSave={() => saveMutation.mutate(chave)}
      savePending={saveMutation.isPending}
      colors={colors}
    />
  );
})}
```

Aplicar o mesmo padrão para `templateKeysJuridico` (troca `TIPO_COLORS["D-3"]` fallback por `TIPO_COLORS["D+30"]`):

```tsx
{templateKeysJuridico.map((tipo) => {
  const chave = `template_${tipo}`;
  const colors = TIPO_COLORS[tipo] || TIPO_COLORS["D+30"];
  return (
    <TemplateNivelEditor
      key={tipo}
      tipo={tipo}
      value={getVal(chave)}
      isDirty={dirty.has(chave)}
      onValueChange={(v) => setVal(chave, v)}
      onSave={() => saveMutation.mutate(chave)}
      savePending={saveMutation.isPending}
      colors={colors}
    />
  );
})}
```

- [ ] **Step 3: Verificar TypeScript sem erros**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Esperado: sem erros relacionados a `TurboZap.tsx`.

- [ ] **Step 4: Testar no browser**

```bash
# Abrir http://localhost:3000 → TurboZap → Configurações
# Para cada nível (D-3, D+0, ...):
#   - Verificar 4 botões de variável abaixo do textarea
#   - Clicar num botão com cursor no meio do texto → variável inserida no cursor
#   - Se há templates na biblioteca → seletor "Aplicar template..." aparece
#   - Selecionar template → confirm dialog → "Aplicar" → texto do nível substituído
#   - Selecionar template → confirm dialog → "Cancelar" → select volta ao placeholder
# Verificar dark mode e light mode
```

- [ ] **Step 5: Commit final**

```bash
git add client/src/pages/TurboZap.tsx
git commit -m "feat(turbozap): TemplateNivelEditor com seletor de biblioteca e botões de variável"
```
