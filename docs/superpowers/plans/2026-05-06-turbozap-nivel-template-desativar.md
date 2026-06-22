# TurboZap — Nível por Template + Desativar Níveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que templates da biblioteca sejam associados a um nível específico (ou genérico) e que níveis de cobrança possam ser desativados via UI sem editar código.

**Architecture:** Coluna `nivel` nullable em `turbozap_templates` (NULL = genérico); array `niveis_desativados` em `turbozap_configuracoes`; dois novos endpoints REST; filtros client-side no frontend.

**Tech Stack:** PostgreSQL raw SQL via Drizzle `db.execute`, Express REST, React Query, Radix UI Switch/Select, Tailwind dark/light, Vitest unit tests.

---

## File Map

| Arquivo | O que muda |
|---------|-----------|
| `server/services/turbozap.ts` | Interface, `getTemplates`, `createTemplate`, novas funções, filtro em `previewCobrancas`, seed |
| `server/services/turbozap-templates.test.ts` | Testes para `nivel`, `getNiveisDesativados`, `toggleNivel` |
| `server/routes/turbozap.ts` | POST templates aceita `nivel`; 2 novos endpoints (`GET/PUT /niveis`) |
| `client/src/pages/TurboZap.tsx` | Interface, `BibliotecaTemplates`, `TemplateNivelEditor`, novo `GerenciarNiveis`, `ConfiguracoesTab` |

---

## Task 1: Service layer — DB migration, novas funções, testes

**Files:**
- Modify: `server/services/turbozap.ts`
- Modify: `server/services/turbozap-templates.test.ts`

### Passo 1.1 — Escrever testes que falham

- [ ] Abrir `server/services/turbozap-templates.test.ts` e substituir o conteúdo completo por:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import {
  getTemplates,
  createTemplate,
  deleteTemplate,
  getNiveisDesativados,
  toggleNivel,
} from './turbozap';

// ---- getTemplates ----
describe('getTemplates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista de templates com campo nivel', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, nome: 'Template A', conteudo: 'Olá {nome}', criado_por: 'user@x.com', criado_em: '2026-05-01T00:00:00Z', nivel: 'D+7' },
      ],
    });
    const result = await getTemplates();
    expect(result).toHaveLength(1);
    expect(result[0].nivel).toBe('D+7');
  });

  it('retorna nivel null para templates genéricos', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, nome: 'Genérico', conteudo: 'Texto', criado_por: null, criado_em: '2026-05-01T00:00:00Z', nivel: null }],
    });
    const result = await getTemplates();
    expect(result[0].nivel).toBeNull();
  });

  it('retorna array vazio quando não há templates', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getTemplates();
    expect(result).toEqual([]);
  });
});

// ---- createTemplate ----
describe('createTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria template sem nivel (genérico)', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, nome: 'Novo', conteudo: 'Texto {valor}', criado_por: 'user', criado_em: '2026-05-01T00:00:00Z', nivel: null }],
    });
    const result = await createTemplate('Novo', 'Texto {valor}', 'user', null);
    expect(result.id).toBe(2);
    expect(result.nivel).toBeNull();
  });

  it('cria template com nivel específico', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 3, nome: 'D+7 Template', conteudo: 'Texto', criado_por: 'user', criado_em: '2026-05-01T00:00:00Z', nivel: 'D+7' }],
    });
    const result = await createTemplate('D+7 Template', 'Texto', 'user', 'D+7');
    expect(result.nivel).toBe('D+7');
  });

  it('lança erro se INSERT retorna vazio', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(createTemplate('Novo', 'Texto', 'user', null)).rejects.toThrow('Falha ao criar template');
  });

  it('permite criadoPor null', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 3, nome: 'Template Anonimo', conteudo: 'Conteúdo', criado_por: null, criado_em: '2026-05-01T00:00:00Z', nivel: null }],
    });
    const result = await createTemplate('Template Anonimo', 'Conteúdo', null, null);
    expect(result.criado_por).toBeNull();
  });
});

// ---- deleteTemplate ----
describe('deleteTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lança erro se template não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(deleteTemplate(999)).rejects.toThrow('Template #999 não encontrado');
  });

  it('resolve sem erro quando template existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await expect(deleteTemplate(1)).resolves.toBeUndefined();
  });
});

// ---- getNiveisDesativados ----
describe('getNiveisDesativados', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna array vazio se chave não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getNiveisDesativados();
    expect(result).toEqual([]);
  });

  it('retorna array parseado da chave', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '["D+14","D+20"]' }] });
    const result = await getNiveisDesativados();
    expect(result).toEqual(['D+14', 'D+20']);
  });

  it('retorna array vazio se JSON inválido', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: 'not-json' }] });
    const result = await getNiveisDesativados();
    expect(result).toEqual([]);
  });
});

// ---- toggleNivel ----
describe('toggleNivel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adiciona nivel ao array quando ativo=false', async () => {
    // 1ª chamada: lê niveis_desativados (vazio)
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '[]' }] });
    // 2ª chamada: UPDATE configuracao
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1, chave: 'niveis_desativados', valor: '["D+14"]', atualizado_por: 'user', atualizado_em: '2026-05-06' }] });

    const result = await toggleNivel('D+14', false, 'user');
    expect(result).toContain('D+14');
  });

  it('remove nivel do array quando ativo=true', async () => {
    // 1ª chamada: lê niveis_desativados com D+14 presente
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '["D+14","D+20"]' }] });
    // 2ª chamada: UPDATE configuracao
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1, chave: 'niveis_desativados', valor: '["D+20"]', atualizado_por: 'user', atualizado_em: '2026-05-06' }] });

    const result = await toggleNivel('D+14', true, 'user');
    expect(result).not.toContain('D+14');
    expect(result).toContain('D+20');
  });
});
```

### Passo 1.2 — Rodar testes para confirmar que falham

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx vitest run server/services/turbozap-templates.test.ts 2>&1 | tail -30
```
Esperado: FAIL em `getNiveisDesativados`, `toggleNivel`, e nos testes de `nivel` em `createTemplate`/`getTemplates`.

### Passo 1.3 — Aplicar migração real no banco de dados

- [ ] Rodar diretamente no banco:
```bash
cd /Users/mac0267/Cortex && node -e "
const { db } = require('./server/db.js');
const { sql } = require('drizzle-orm');
db.execute(sql\`ALTER TABLE cortex_core.turbozap_templates ADD COLUMN IF NOT EXISTS nivel TEXT\`)
  .then(() => { console.log('OK'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
"
```
Esperado: `OK`

### Passo 1.4 — Atualizar `server/services/turbozap.ts`

- [ ] Atualizar a interface `TurboZapTemplate` (linhas 64–70). Substituir:
```typescript
export interface TurboZapTemplate {
  id: number;
  nome: string;
  conteudo: string;
  criado_por: string | null;
  criado_em: string;
}
```
Por:
```typescript
export interface TurboZapTemplate {
  id: number;
  nome: string;
  conteudo: string;
  nivel: string | null;
  criado_por: string | null;
  criado_em: string;
}
```

- [ ] Adicionar seed de `niveis_desativados` no array `seedConfigs` dentro de `initTurboZapTables` (logo após `{ chave: "dry_run_juridico", valor: "true" }`):
```typescript
      { chave: "niveis_desativados", valor: "[]" },
```

- [ ] Atualizar `getTemplates()` (linha 1042) para incluir `nivel`:
```typescript
export async function getTemplates(): Promise<TurboZapTemplate[]> {
  const result = await db.execute(sql`
    SELECT id, nome, conteudo, nivel, criado_por, criado_em
    FROM cortex_core.turbozap_templates
    ORDER BY criado_em DESC
  `);
  return result.rows as TurboZapTemplate[];
}
```

- [ ] Atualizar `createTemplate()` (linha 1051) para aceitar `nivel`:
```typescript
export async function createTemplate(
  nome: string,
  conteudo: string,
  criadoPor: string | null,
  nivel: string | null,
): Promise<TurboZapTemplate> {
  const result = await db.execute(sql`
    INSERT INTO cortex_core.turbozap_templates (nome, conteudo, criado_por, nivel)
    VALUES (${nome}, ${conteudo}, ${criadoPor}, ${nivel})
    RETURNING id, nome, conteudo, nivel, criado_por, criado_em
  `);
  if (result.rows.length === 0) {
    throw new Error("Falha ao criar template");
  }
  return result.rows[0] as TurboZapTemplate;
}
```

- [ ] Adicionar as duas novas funções logo antes de `deleteTemplate` (após `createTemplate`):
```typescript
export async function getNiveisDesativados(): Promise<string[]> {
  const raw = await getConfiguracao("niveis_desativados");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function toggleNivel(
  tipo: string,
  ativo: boolean,
  atualizadoPor: string,
): Promise<string[]> {
  const desativados = await getNiveisDesativados();
  const updated = ativo
    ? desativados.filter((t) => t !== tipo)
    : [...new Set([...desativados, tipo])];
  await updateConfiguracao("niveis_desativados", JSON.stringify(updated), atualizadoPor);
  return updated;
}
```

- [ ] Atualizar `previewCobrancas()` para filtrar níveis desativados. Substituir o início da função (antes do loop `for (const nivel of NIVEIS_COBRANCA)`):
```typescript
export async function previewCobrancas(): Promise<PreviewNivel[]> {
  const skipNumerosRaw = await getConfiguracao("skip_numeros");
  const skipNumeros = new Set<string>(
    skipNumerosRaw ? JSON.parse(skipNumerosRaw) : DEFAULT_SKIP_NUMEROS,
  );

  const desativados = await getNiveisDesativados();
  const niveisAtivos = NIVEIS_COBRANCA.filter((n) => !desativados.includes(n.tipo));

  const niveis: PreviewNivel[] = [];

  for (const nivel of niveisAtivos) {
```

### Passo 1.5 — Rodar testes e confirmar que passam

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx vitest run server/services/turbozap-templates.test.ts 2>&1 | tail -20
```
Esperado: todos os testes PASS (12 testes).

### Passo 1.6 — Commit

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add server/services/turbozap.ts server/services/turbozap-templates.test.ts && git commit -m "$(cat <<'EOF'
feat(turbozap): adicionar campo nivel em templates + funções getNiveisDesativados/toggleNivel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: API routes — novos endpoints niveis + update POST templates

**Files:**
- Modify: `server/routes/turbozap.ts`

### Passo 2.1 — Atualizar imports

- [ ] Em `server/routes/turbozap.ts`, atualizar a linha de import para incluir as novas funções:
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
  getNiveisDesativados,
  toggleNivel,
} from "../services/turbozap";
```

### Passo 2.2 — Adicionar `GET /api/turbozap/niveis`

- [ ] Adicionar logo após o DELETE templates (linha ~257, antes do `export { initTurboZapTables }`):
```typescript
  // GET /api/turbozap/niveis - Lista níveis com estado ativo/desativado
  app.get("/api/turbozap/niveis", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const desativados = await getNiveisDesativados();
      const NIVEIS_LABELS: Record<string, string> = {
        "D-3": "D-3 (Lembrete)",
        "D+0": "D+0 (Vencimento)",
        "D+3": "D+3 (3 dias)",
        "D+7": "D+7 (Suspensão)",
        "D+10": "D+10 (Rescisão)",
        "D+14": "D+14 (Cancelamento)",
        "D+15": "D+15 (Encerramento)",
        "D+20": "D+20 (Cancelado)",
        "D+30": "D+30 (Formalização Jurídica)",
        "D+40": "D+40 (Comunicação Protesto)",
        "D+45": "D+45 (Protesto Efetivado)",
        "D+50": "D+50 (Aviso Negativação)",
        "D+55": "D+55 (Negativação Efetivada)",
      };
      const TODOS_TIPOS = ["D-3","D+0","D+3","D+7","D+10","D+14","D+15","D+20","D+30","D+40","D+45","D+50","D+55"];
      const niveis = TODOS_TIPOS.map((tipo) => ({
        tipo,
        label: NIVEIS_LABELS[tipo] ?? tipo,
        ativo: !desativados.includes(tipo),
      }));
      res.json(niveis);
    } catch (error) {
      console.error("[turbozap] Error fetching niveis:", error);
      res.status(500).json({ message: "Erro ao buscar níveis" });
    }
  });

  // PUT /api/turbozap/niveis/toggle - Ativa/desativa um nível
  app.put("/api/turbozap/niveis/toggle", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const { tipo, ativo } = req.body;

      if (!tipo || typeof ativo !== "boolean") {
        return res.status(400).json({ message: "Campos 'tipo' (string) e 'ativo' (boolean) são obrigatórios" });
      }

      const updated = await toggleNivel(
        tipo,
        ativo,
        user?.email || user?.name || "sistema",
      );
      res.json({ niveis_desativados: updated });
    } catch (error: any) {
      console.error("[turbozap] Error toggling nivel:", error);
      res.status(500).json({ message: error.message || "Erro ao alterar nível" });
    }
  });
```

### Passo 2.3 — Atualizar POST `/api/turbozap/templates` para aceitar `nivel`

- [ ] Substituir o bloco do POST de templates (linhas ~219–241):
```typescript
  // POST /api/turbozap/templates - Cria template na biblioteca
  app.post("/api/turbozap/templates", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const { nome, conteudo, nivel } = req.body;
      if (!nome?.trim() || !conteudo?.trim()) {
        return res.status(400).json({ message: "Campos 'nome' e 'conteudo' são obrigatórios" });
      }
      if (nome.trim().length > 100) {
        return res.status(400).json({ message: "Nome do template deve ter no máximo 100 caracteres" });
      }
      const template = await createTemplate(
        nome.trim(),
        conteudo.trim(),
        user?.email || user?.name || "sistema",
        nivel ?? null,
      );
      res.status(201).json(template);
    } catch (error) {
      console.error("[turbozap] Error creating template:", error);
      res.status(500).json({ message: "Erro ao criar template" });
    }
  });
```

### Passo 2.4 — Verificar TypeScript

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep turbozap
```
Esperado: sem erros.

### Passo 2.5 — Commit

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add server/routes/turbozap.ts && git commit -m "$(cat <<'EOF'
feat(turbozap): adicionar endpoints GET/PUT /niveis e aceitar nivel no POST /templates

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: UI — atualizar interface e BibliotecaTemplates

**Files:**
- Modify: `client/src/pages/TurboZap.tsx` (seções de interface e BibliotecaTemplates)

### Passo 3.1 — Atualizar interface `TurboZapTemplate` no frontend

- [ ] Em `client/src/pages/TurboZap.tsx`, substituir a interface `TurboZapTemplate` (linhas 102–108):
```typescript
interface TurboZapTemplate {
  id: number;
  nome: string;
  conteudo: string;
  nivel: string | null;
  criado_por: string | null;
  criado_em: string;
}
```

### Passo 3.2 — Atualizar estado de criação e form em `BibliotecaTemplates`

- [ ] Substituir a declaração de estados no início de `BibliotecaTemplates` (após `const formTextareaRef`):
```typescript
function BibliotecaTemplates() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [conteudoNovo, setConteudoNovo] = useState("");
  const [nivelNovo, setNivelNovo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TurboZapTemplate | null>(null);
  const formTextareaRef = useRef<HTMLTextAreaElement>(null);
```

- [ ] Atualizar o `mutationFn` do `createMutation` para enviar `nivel`:
```typescript
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/turbozap/templates", {
        nome: nomeNovo,
        conteudo: conteudoNovo,
        nivel: nivelNovo,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/templates"] });
      toast({ title: "Template criado!" });
      setShowForm(false);
      setNomeNovo("");
      setConteudoNovo("");
      setNivelNovo(null);
    },
    onError: () => {
      toast({ title: "Erro ao criar template", variant: "destructive" });
    },
  });
```

- [ ] Adicionar o Select de nível logo após o `<Input>` de nome no form (antes do `<Textarea>`):
```tsx
            <Select
              value={nivelNovo ?? "generico"}
              onValueChange={(v) => setNivelNovo(v === "generico" ? null : v)}
            >
              <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 h-9 text-sm">
                <SelectValue placeholder="Nível (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generico">Genérico (todos os níveis)</SelectItem>
                {(["D-3","D+0","D+3","D+7","D+10","D+14","D+15","D+20","D+30","D+40","D+45","D+50","D+55"] as const).map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
```

- [ ] Atualizar o cancelar do form para resetar `nivelNovo`:
```tsx
                onClick={() => {
                  setShowForm(false);
                  setNomeNovo("");
                  setConteudoNovo("");
                  setNivelNovo(null);
                }}
```

- [ ] Adicionar badge de nível na lista de templates (logo após `<p className="text-sm font-medium ...">{tpl.nome}</p>`):
```tsx
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tpl.nome}</p>
                {tpl.nivel ? (
                  <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                    {tpl.nivel}
                  </span>
                ) : (
                  <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-zinc-400 mt-0.5">
                    Genérico
                  </span>
                )}
```

### Passo 3.3 — Verificar TypeScript

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep TurboZap
```
Esperado: sem erros.

### Passo 3.4 — Commit

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add client/src/pages/TurboZap.tsx && git commit -m "$(cat <<'EOF'
feat(turbozap-ui): adicionar seletor de nivel no form de template + badge na lista

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: UI — GerenciarNiveis + filtro no ConfiguracoesTab

**Files:**
- Modify: `client/src/pages/TurboZap.tsx` (novo componente + ConfiguracoesTab)

### Passo 4.1 — Adicionar interface `NivelInfo` e componente `GerenciarNiveis`

- [ ] Adicionar a interface `NivelInfo` logo após a interface `TurboZapTemplate` (após a linha 108):
```typescript
interface NivelInfo {
  tipo: string;
  label: string;
  ativo: boolean;
}
```

- [ ] Adicionar o componente `GerenciarNiveis` logo antes de `BibliotecaTemplates` (antes da linha 660):
```tsx
// ============================================
// Gerenciar Níveis
// ============================================

function GerenciarNiveis() {
  const { toast } = useToast();

  const { data: niveis = [], isLoading } = useQuery<NivelInfo[]>({
    queryKey: ["/api/turbozap/niveis"],
    queryFn: async () => {
      const res = await fetch("/api/turbozap/niveis", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar níveis");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ tipo, ativo }: { tipo: string; ativo: boolean }) => {
      const res = await apiRequest("PUT", "/api/turbozap/niveis/toggle", { tipo, ativo });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/niveis"] });
      toast({ title: "Nível atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao alterar nível", variant: "destructive" });
    },
  });

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white text-lg">Gerenciar Níveis</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-400 dark:text-zinc-500">Carregando...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {niveis.map((nivel) => (
              <div
                key={nivel.tipo}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-medium ${nivel.ativo ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-zinc-500 line-through"}`}
                  >
                    {nivel.tipo}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">
                    {nivel.label.replace(`${nivel.tipo} `, "")}
                  </span>
                </div>
                <Switch
                  checked={nivel.ativo}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ tipo: nivel.tipo, ativo: checked })
                  }
                  disabled={toggleMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Passo 4.2 — Integrar `GerenciarNiveis` em `ConfiguracoesTab` e filtrar cards

- [ ] Em `ConfiguracoesTab`, adicionar `useQuery` para buscar os níveis desativados:

Adicionar logo após a declaração de `const configMap = useMemo(...)`:
```typescript
  const { data: niveisInfo = [] } = useQuery<NivelInfo[]>({
    queryKey: ["/api/turbozap/niveis"],
    queryFn: async () => {
      const res = await fetch("/api/turbozap/niveis", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar níveis");
      return res.json();
    },
  });

  const niveisDesativados = useMemo(
    () => niveisInfo.filter((n) => !n.ativo).map((n) => n.tipo),
    [niveisInfo],
  );
```

- [ ] Substituir as linhas `const templateKeysFinanceiro` e `const templateKeysJuridico` (linha 1058) para filtrar desativados:
```typescript
  const templateKeysFinanceiro = ["D-3", "D+0", "D+3", "D+7", "D+10", "D+14", "D+15", "D+20"]
    .filter((tipo) => !niveisDesativados.includes(tipo));
  const templateKeysJuridico = ["D+30", "D+40", "D+45", "D+50", "D+55"]
    .filter((tipo) => !niveisDesativados.includes(tipo));
```

- [ ] Inserir o componente `<GerenciarNiveis />` logo após `{/* Biblioteca de Templates */}` e antes do card de Templates Financeiro. Substituir:
```tsx
      {/* Biblioteca de Templates */}
      <BibliotecaTemplates />

      {/* Templates Financeiro */}
```
Por:
```tsx
      {/* Biblioteca de Templates */}
      <BibliotecaTemplates />

      {/* Gerenciar Níveis */}
      <GerenciarNiveis />

      {/* Templates Financeiro */}
```

- [ ] Adicionar condicional para não renderizar o card Financeiro quando vazio:

Substituir o Card "Templates — Financeiro":
```tsx
      {/* Templates Financeiro */}
      {templateKeysFinanceiro.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white text-lg">
              Templates — Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>
      )}
```

- [ ] Adicionar condicional para não renderizar o card Jurídico quando vazio:

Substituir o Card "Templates — Jurídico":
```tsx
      {/* Templates Jurídico */}
      {templateKeysJuridico.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white text-lg flex items-center gap-2">
              Templates — Jurídico
              <Badge variant="outline" className="text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700">
                Instância Jurídico
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>
      )}
```

### Passo 4.3 — Verificar TypeScript

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep TurboZap
```
Esperado: sem erros.

### Passo 4.4 — Commit

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add client/src/pages/TurboZap.tsx && git commit -m "$(cat <<'EOF'
feat(turbozap-ui): adicionar GerenciarNiveis com toggle e filtrar cards por nivel ativo

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: UI — filtrar templates por nível no TemplateNivelEditor

**Files:**
- Modify: `client/src/pages/TurboZap.tsx` (componente `TemplateNivelEditor`)

### Passo 5.1 — Adicionar filtro de templates por nível

- [ ] Em `TemplateNivelEditor`, após o `useQuery` de templates, adicionar:
```typescript
  const templatesForLevel = templates.filter(
    (t) => t.nivel === tipo || t.nivel === null,
  );
```

- [ ] Substituir a condição de renderização do `<Select>` de `{templates.length > 0 && (` por `{templatesForLevel.length > 0 && (`.

- [ ] Substituir `{templates.map((t) => (` por `{templatesForLevel.map((t) => (` dentro do `<SelectContent>`.

- [ ] Substituir `templates.find(...)` por `templatesForLevel.find(...)` no `onValueChange`:
```typescript
              onValueChange={(v) => {
                const tpl = templatesForLevel.find((t) => String(t.id) === v);
                if (tpl) setPendingTemplate(tpl);
              }}
```

### Passo 5.2 — Verificar TypeScript e rodar build

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep TurboZap
```
Esperado: sem erros.

### Passo 5.3 — Reiniciar servidor e testar no browser

- [ ] Reiniciar o servidor de desenvolvimento:
```bash
cd /Users/mac0267/Cortex && lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

- [ ] Testar no browser (http://localhost:3000):
  - Abrir TurboZap → aba Configurações
  - Verificar que seção "Gerenciar Níveis" aparece com 13 níveis e toggles
  - Desativar um nível (ex: D+14) e verificar que o card de template desaparece
  - Reativar e verificar que reaparece
  - Criar um template com nível "D+7" e verificar badge
  - Criar um template genérico e verificar badge "Genérico"
  - No card D+7, verificar que só aparecem templates D+7 e Genéricos no select

### Passo 5.4 — Commit final

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add client/src/pages/TurboZap.tsx && git commit -m "$(cat <<'EOF'
feat(turbozap-ui): filtrar templates por nivel no seletor de cada nivel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist de Spec Coverage

| Requisito da spec | Task |
|-------------------|------|
| Campo `nivel` nullable em `turbozap_templates` | Task 1 (migração + service) |
| `createTemplate` com `nivel` | Task 1 + Task 2 |
| Badge de nível na lista | Task 3 |
| Select "Nível (opcional)" no form | Task 3 |
| Filtro no seletor por nível | Task 5 |
| Seção "Gerenciar Níveis" com toggle | Task 4 |
| Nível desativado some dos cards de template | Task 4 |
| Nível desativado pulado no preview | Task 1 (`previewCobrancas`) |
| Reativar toggle | Task 4 (toggle bidirecional) |
| `getNiveisDesativados()` | Task 1 |
| `toggleNivel()` | Task 1 + Task 2 |
| Seed `niveis_desativados: []` | Task 1 |
| `GET /api/turbozap/niveis` | Task 2 |
| `PUT /api/turbozap/niveis/toggle` | Task 2 |
