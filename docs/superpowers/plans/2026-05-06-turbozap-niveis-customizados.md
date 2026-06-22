# TurboZap — Níveis Customizados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir criar e deletar níveis de cobrança customizados (ex: D+1) via UI, mantendo os 13 níveis de sistema intocáveis.

**Architecture:** Nova tabela `turbozap_niveis_customizados` armazena níveis criados pelo usuário. O service combina sistema + custom em uma lista unificada. A rota `GET /niveis` e `previewCobrancas` passam a usar essa lista combinada. O frontend deriva os cards de template dinamicamente da API.

**Tech Stack:** PostgreSQL raw SQL via Drizzle `db.execute`, Express REST, React Query, Radix UI, Tailwind dark/light, Vitest unit tests.

---

## File Map

| Arquivo | O que muda |
|---------|-----------|
| `server/services/turbozap.ts` | Nova interface, nova tabela no init, novas funções, update previewCobrancas + toggleNivel |
| `server/services/turbozap-niveis-customizados.test.ts` | Novo arquivo de testes para as novas funções |
| `server/services/turbozap-templates.test.ts` | Atualizar mocks de `toggleNivel` (nova DB call) |
| `server/routes/turbozap.ts` | Atualizar GET /niveis + 2 novos endpoints POST/DELETE |
| `client/src/pages/TurboZap.tsx` | Atualizar NivelInfo interface + GerenciarNiveis + ConfiguracoesTab |

---

## Task 1: Service layer — DB, novas funções, testes

**Files:**
- Modify: `server/services/turbozap.ts`
- Create: `server/services/turbozap-niveis-customizados.test.ts`
- Modify: `server/services/turbozap-templates.test.ts`

### Passo 1.1 — Escrever testes que falham

- [ ] Criar `server/services/turbozap-niveis-customizados.test.ts` com o conteúdo:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import {
  getNiveisCustomizados,
  getNiveisInfo,
  createNivelCustomizado,
  deleteNivelCustomizado,
} from './turbozap';

// ---- getNiveisCustomizados ----
describe('getNiveisCustomizados', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista de níveis customizados', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro', criado_por: 'user', criado_em: '2026-05-06T00:00:00Z' },
      ],
    });
    const result = await getNiveisCustomizados();
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('D+1');
    expect(result[0].is_custom).toBeUndefined(); // is_custom está em NivelCustomizado, não aqui
  });

  it('retorna array vazio quando não há customizados', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getNiveisCustomizados();
    expect(result).toEqual([]);
  });
});

// ---- getNiveisInfo ----
describe('getNiveisInfo', () => {
  it('combina sistema + custom ordenados por dias', () => {
    const customizados = [
      { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro' as const, criado_por: null, criado_em: '' },
    ];
    const desativados: string[] = [];
    const result = getNiveisInfo(customizados, desativados);

    // D-3 (dias=-3) deve vir primeiro
    expect(result[0].tipo).toBe('D-3');
    // D+1 (dias=1) deve vir entre D+0 e D+3
    const d0idx = result.findIndex(n => n.tipo === 'D+0');
    const d1idx = result.findIndex(n => n.tipo === 'D+1');
    const d3idx = result.findIndex(n => n.tipo === 'D+3');
    expect(d0idx).toBeLessThan(d1idx);
    expect(d1idx).toBeLessThan(d3idx);
  });

  it('marca is_custom corretamente', () => {
    const customizados = [
      { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro' as const, criado_por: null, criado_em: '' },
    ];
    const result = getNiveisInfo(customizados, []);
    const d1 = result.find(n => n.tipo === 'D+1');
    const d3 = result.find(n => n.tipo === 'D+3');
    expect(d1?.is_custom).toBe(true);
    expect(d3?.is_custom).toBe(false);
  });

  it('aplica desativados corretamente', () => {
    const result = getNiveisInfo([], ['D+7']);
    const d7 = result.find(n => n.tipo === 'D+7');
    const d3 = result.find(n => n.tipo === 'D+3');
    expect(d7?.ativo).toBe(false);
    expect(d3?.ativo).toBe(true);
  });

  it('inclui instancia em todos os itens', () => {
    const customizados = [
      { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro' as const, criado_por: null, criado_em: '' },
    ];
    const result = getNiveisInfo(customizados, []);
    for (const n of result) {
      expect(n.instancia).toMatch(/^(financeiro|juridico)$/);
    }
  });
});

// ---- createNivelCustomizado ----
describe('createNivelCustomizado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gera tipo D+1 para dias=1', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro', criado_por: 'user', criado_em: '2026-05-06T00:00:00Z' }],
    });
    mockExecute.mockResolvedValueOnce({ rows: [] }); // seed template
    const result = await createNivelCustomizado(1, 'user');
    expect(result.tipo).toBe('D+1');
  });

  it('gera tipo D-1 para dias=-1', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, tipo: 'D-1', label: 'D-1 (Customizado)', dias: -1, instancia: 'financeiro', criado_por: 'user', criado_em: '2026-05-06T00:00:00Z' }],
    });
    mockExecute.mockResolvedValueOnce({ rows: [] }); // seed template
    const result = await createNivelCustomizado(-1, 'user');
    expect(result.tipo).toBe('D-1');
  });

  it('lança erro se conflita com nível de sistema', async () => {
    // D+7 é sistema, dias=7
    await expect(createNivelCustomizado(7, 'user')).rejects.toThrow('já existe como nível de sistema');
  });

  it('lança erro se INSERT retorna vazio', async () => {
    // dias=1 não conflita com sistema
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(createNivelCustomizado(1, 'user')).rejects.toThrow('Falha ao criar nível');
  });
});

// ---- deleteNivelCustomizado ----
describe('deleteNivelCustomizado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lança erro se for nível de sistema', async () => {
    await expect(deleteNivelCustomizado('D+7')).rejects.toThrow('nível de sistema');
  });

  it('lança erro se nível customizado não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] }); // DELETE retorna vazio
    await expect(deleteNivelCustomizado('D+1')).rejects.toThrow('não encontrado');
  });

  it('deleta e remove template config', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // DELETE customizado
    mockExecute.mockResolvedValueOnce({ rows: [] }); // DELETE configuracao
    await expect(deleteNivelCustomizado('D+1')).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
```

### Passo 1.2 — Rodar testes para confirmar que falham

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx vitest run server/services/turbozap-niveis-customizados.test.ts 2>&1 | tail -15
```
Esperado: FAIL com "getNiveisCustomizados is not a function" (ou similar).

### Passo 1.3 — Aplicar migração no banco

- [ ] Executar via psql:
```bash
psql $DATABASE_URL -c "
CREATE TABLE IF NOT EXISTS cortex_core.turbozap_niveis_customizados (
  id         SERIAL PRIMARY KEY,
  tipo       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  dias       INTEGER NOT NULL,
  instancia  TEXT NOT NULL DEFAULT 'financeiro',
  criado_por TEXT,
  criado_em  TIMESTAMP DEFAULT NOW()
);"
```
Esperado: `CREATE TABLE` ou `NOTICE: relation already exists`.

### Passo 1.4 — Adicionar interface `NivelCustomizado` em `server/services/turbozap.ts`

- [ ] Adicionar logo após a interface `TurboZapTemplate` (linha ~71), antes do comentário `// Níveis de escalação`:

```typescript
export interface NivelCustomizado {
  id: number;
  tipo: string;
  label: string;
  dias: number;
  instancia: "financeiro" | "juridico";
  criado_por: string | null;
  criado_em: string;
}
```

### Passo 1.5 — Adicionar criação da tabela em `initTurboZapTables`

- [ ] Adicionar bloco `CREATE TABLE` dentro de `initTurboZapTables`, logo após o bloco que cria `turbozap_templates` (após a linha com `ADD COLUMN IF NOT EXISTS nivel TEXT`):

```typescript
    // Create custom levels table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.turbozap_niveis_customizados (
        id         SERIAL PRIMARY KEY,
        tipo       TEXT NOT NULL UNIQUE,
        label      TEXT NOT NULL,
        dias       INTEGER NOT NULL,
        instancia  TEXT NOT NULL DEFAULT 'financeiro',
        criado_por TEXT,
        criado_em  TIMESTAMP DEFAULT NOW()
      )
    `);
```

### Passo 1.6 — Adicionar as novas funções em `server/services/turbozap.ts`

- [ ] Adicionar as 4 novas funções/helpers logo antes de `getTemplates()` (após o bloco de Pipeline Jurídico):

```typescript
// ============================================
// Níveis customizados
// ============================================

export async function getNiveisCustomizados(): Promise<NivelCustomizado[]> {
  const result = await db.execute(sql`
    SELECT id, tipo, label, dias, instancia, criado_por, criado_em
    FROM cortex_core.turbozap_niveis_customizados
    ORDER BY dias
  `);
  return result.rows as NivelCustomizado[];
}

export function getNiveisInfo(
  customizados: NivelCustomizado[],
  desativados: string[],
): Array<{ tipo: string; label: string; ativo: boolean; instancia: string; is_custom: boolean; dias: number }> {
  const sistema = NIVEIS_COBRANCA.map((n) => ({
    tipo: n.tipo,
    label: n.label,
    ativo: !desativados.includes(n.tipo),
    instancia: n.instancia as string,
    is_custom: false,
    dias: n.dias,
  }));
  const custom = customizados.map((c) => ({
    tipo: c.tipo,
    label: c.label,
    ativo: !desativados.includes(c.tipo),
    instancia: c.instancia as string,
    is_custom: true,
    dias: c.dias,
  }));
  return [...sistema, ...custom].sort((a, b) => a.dias - b.dias);
}

export async function createNivelCustomizado(
  dias: number,
  criadoPor: string | null,
): Promise<NivelCustomizado> {
  const tipo = dias >= 0 ? `D+${dias}` : `D${dias}`;
  if (NIVEIS_COBRANCA.some((n) => n.tipo === tipo)) {
    throw new Error(`Nível ${tipo} já existe como nível de sistema`);
  }
  const label = `${tipo} (Customizado)`;
  const result = await db.execute(sql`
    INSERT INTO cortex_core.turbozap_niveis_customizados (tipo, label, dias, instancia, criado_por)
    VALUES (${tipo}, ${label}, ${dias}, 'financeiro', ${criadoPor})
    RETURNING id, tipo, label, dias, instancia, criado_por, criado_em
  `);
  if (result.rows.length === 0) {
    throw new Error("Falha ao criar nível");
  }
  const chave = `template_${tipo}`;
  await db.execute(sql`
    INSERT INTO cortex_core.turbozap_configuracoes (chave, valor)
    VALUES (${chave}, '')
    ON CONFLICT (chave) DO NOTHING
  `);
  return result.rows[0] as NivelCustomizado;
}

export async function deleteNivelCustomizado(tipo: string): Promise<void> {
  if (NIVEIS_COBRANCA.some((n) => n.tipo === tipo)) {
    throw new Error(`Nível ${tipo} é um nível de sistema e não pode ser deletado`);
  }
  const result = await db.execute(sql`
    DELETE FROM cortex_core.turbozap_niveis_customizados
    WHERE tipo = ${tipo}
    RETURNING id
  `);
  if (result.rows.length === 0) {
    throw new Error(`Nível customizado ${tipo} não encontrado`);
  }
  const chave = `template_${tipo}`;
  await db.execute(sql`
    DELETE FROM cortex_core.turbozap_configuracoes
    WHERE chave = ${chave}
  `);
}
```

### Passo 1.7 — Atualizar `previewCobrancas()` para incluir customizados

- [ ] Substituir as linhas que criam `niveisAtivos` dentro de `previewCobrancas()` (atualmente em torno da linha 468):

Substituir:
```typescript
  const desativados = await getNiveisDesativados();
  const niveisAtivos = NIVEIS_COBRANCA.filter((n) => !desativados.includes(n.tipo));
```

Por:
```typescript
  const desativados = await getNiveisDesativados();
  const customizados = await getNiveisCustomizados();
  const todosOsNiveis: NivelCobranca[] = [
    ...NIVEIS_COBRANCA,
    ...customizados.map((c) => ({
      tipo: c.tipo,
      label: c.label,
      dias: c.dias,
      instancia: c.instancia as "financeiro" | "juridico",
    })),
  ];
  const niveisAtivos = todosOsNiveis.filter((n) => !desativados.includes(n.tipo));
```

### Passo 1.8 — Atualizar `toggleNivel()` para aceitar níveis customizados

- [ ] Substituir o bloco de validação de `tipo` dentro de `toggleNivel()`:

Substituir:
```typescript
  if (!NIVEIS_COBRANCA.some((n) => n.tipo === tipo)) {
    throw new Error(`Nível desconhecido: ${tipo}`);
  }
```

Por:
```typescript
  const customizados = await getNiveisCustomizados();
  const todosOsTipos = [
    ...NIVEIS_COBRANCA.map((n) => n.tipo),
    ...customizados.map((c) => c.tipo),
  ];
  if (!todosOsTipos.includes(tipo)) {
    throw new Error(`Nível desconhecido: ${tipo}`);
  }
```

### Passo 1.9 — Atualizar mocks de `toggleNivel` nos testes existentes

- [ ] Em `server/services/turbozap-templates.test.ts`, atualizar os dois testes de `toggleNivel` para incluir o mock extra de `getNiveisCustomizados()`:

```typescript
  it('adiciona nivel ao array quando ativo=false', async () => {
    // 1ª chamada: getNiveisCustomizados (array vazio)
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // 2ª chamada: lê niveis_desativados (vazio)
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '[]' }] });
    // 3ª chamada: UPDATE configuracao
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1, chave: 'niveis_desativados', valor: '["D+14"]', atualizado_por: 'user', atualizado_em: '2026-05-06' }] });

    const result = await toggleNivel('D+14', false, 'user');
    expect(result).toContain('D+14');
  });

  it('remove nivel do array quando ativo=true', async () => {
    // 1ª chamada: getNiveisCustomizados (array vazio)
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // 2ª chamada: lê niveis_desativados com D+14 presente
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '["D+14","D+20"]' }] });
    // 3ª chamada: UPDATE configuracao
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1, chave: 'niveis_desativados', valor: '["D+20"]', atualizado_por: 'user', atualizado_em: '2026-05-06' }] });

    const result = await toggleNivel('D+14', true, 'user');
    expect(result).not.toContain('D+14');
    expect(result).toContain('D+20');
  });

  it('lança erro para nivel desconhecido', async () => {
    // getNiveisCustomizados retorna vazio → INVALIDO não está em nenhuma lista
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(toggleNivel('INVALIDO', false, 'user')).rejects.toThrow('Nível desconhecido: INVALIDO');
  });
```

### Passo 1.10 — Rodar todos os testes

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx vitest run server/services/turbozap-niveis-customizados.test.ts server/services/turbozap-templates.test.ts 2>&1 | tail -20
```
Esperado: todos os testes passando (16 + novos).

### Passo 1.11 — Verificar TypeScript

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "turbozap" | head -20
```
Esperado: sem erros nos arquivos turbozap.

### Passo 1.12 — Commit

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add server/services/turbozap.ts server/services/turbozap-niveis-customizados.test.ts server/services/turbozap-templates.test.ts && git commit -m "$(cat <<'EOF'
feat(turbozap): adicionar níveis customizados — getNiveisCustomizados/createNivelCustomizado/deleteNivelCustomizado

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: API routes — atualizar GET /niveis + POST/DELETE /niveis

**Files:**
- Modify: `server/routes/turbozap.ts`

### Passo 2.1 — Atualizar imports

- [ ] Adicionar as novas funções ao import de `../services/turbozap`:

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
  NIVEIS_COBRANCA,
  getNiveisCustomizados,
  getNiveisInfo,
  createNivelCustomizado,
  deleteNivelCustomizado,
} from "../services/turbozap";
import type { NivelCobranca } from "../services/turbozap";
```

### Passo 2.2 — Atualizar `GET /api/turbozap/niveis`

- [ ] Substituir o handler completo do GET (atualmente linhas ~269–285):

```typescript
  // GET /api/turbozap/niveis - Lista níveis com estado ativo/desativado
  app.get("/api/turbozap/niveis", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const [desativados, customizados] = await Promise.all([
        getNiveisDesativados(),
        getNiveisCustomizados(),
      ]);
      const niveis = getNiveisInfo(customizados, desativados);
      res.json(niveis);
    } catch (error) {
      console.error("[turbozap] Error fetching niveis:", error);
      res.status(500).json({ message: "Erro ao buscar níveis" });
    }
  });
```

### Passo 2.3 — Adicionar `POST /api/turbozap/niveis`

- [ ] Adicionar logo após o handler do PUT /niveis/toggle (antes do `}`  que fecha `registerTurboZapRoutes`):

```typescript
  // POST /api/turbozap/niveis - Cria nível customizado
  app.post("/api/turbozap/niveis", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const { dias } = req.body;

      if (dias === undefined || dias === null || !Number.isInteger(Number(dias))) {
        return res.status(400).json({ message: "Campo 'dias' deve ser um número inteiro" });
      }

      const nivel = await createNivelCustomizado(
        Number(dias),
        user?.email || user?.name || "sistema",
      );
      res.status(201).json(nivel);
    } catch (error: any) {
      if (error.message?.includes("nível de sistema") || error.message?.includes("já existe")) {
        return res.status(400).json({ message: error.message });
      }
      console.error("[turbozap] Error creating nivel:", error);
      res.status(500).json({ message: error.message || "Erro ao criar nível" });
    }
  });

  // DELETE /api/turbozap/niveis/:tipo - Deleta nível customizado
  app.delete("/api/turbozap/niveis/:tipo", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const tipo = req.params.tipo;
      await deleteNivelCustomizado(tipo);
      res.json({ ok: true });
    } catch (error: any) {
      if (error.message?.includes("nível de sistema")) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes("não encontrado")) {
        return res.status(404).json({ message: error.message });
      }
      console.error("[turbozap] Error deleting nivel:", error);
      res.status(500).json({ message: error.message || "Erro ao deletar nível" });
    }
  });
```

### Passo 2.4 — Verificar TypeScript

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "turbozap" | head -20
```
Esperado: sem erros.

### Passo 2.5 — Commit

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add server/routes/turbozap.ts && git commit -m "$(cat <<'EOF'
feat(turbozap): atualizar GET /niveis + adicionar POST/DELETE /niveis para customizados

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: UI — NivelInfo + GerenciarNiveis + ConfiguracoesTab dinâmico

**Files:**
- Modify: `client/src/pages/TurboZap.tsx`

### Passo 3.1 — Atualizar interface `NivelInfo`

- [ ] Substituir a interface `NivelInfo` (linhas 111–115):

```typescript
interface NivelInfo {
  tipo: string;
  label: string;
  ativo: boolean;
  instancia: string;
  is_custom: boolean;
  dias: number;
}
```

### Passo 3.2 — Atualizar `GerenciarNiveis` — adicionar estado do form

- [ ] Substituir o início da função `GerenciarNiveis` (do `function GerenciarNiveis() {` até antes do `return (`), mantendo o useQuery e toggleMutation existentes e adicionando o form e deleteMutation:

```tsx
function GerenciarNiveis() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [diasNovo, setDiasNovo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: async (dias: number) => {
      const res = await apiRequest("POST", "/api/turbozap/niveis", { dias });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/niveis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/configuracoes"] });
      toast({ title: "Nível criado!" });
      setShowForm(false);
      setDiasNovo("");
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Erro ao criar nível", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tipo: string) => {
      await apiRequest("DELETE", `/api/turbozap/niveis/${encodeURIComponent(tipo)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/niveis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/configuracoes"] });
      toast({ title: "Nível removido!" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Erro ao remover nível", variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const diasNum = parseInt(diasNovo, 10);
  const tipoPreview = !isNaN(diasNum)
    ? diasNum >= 0 ? `D+${diasNum}` : `D${diasNum}`
    : null;
  const conflito = tipoPreview ? niveis.some((n) => n.tipo === tipoPreview) : false;
```

### Passo 3.3 — Atualizar o JSX de `GerenciarNiveis`

- [ ] Substituir o bloco `return (...)` completo de `GerenciarNiveis` pelo seguinte:

```tsx
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-gray-900 dark:text-white text-lg">Gerenciar Níveis</CardTitle>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1">
            <Plus className="w-3 h-3" /> Novo Nível
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="border border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-4 mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Dias (ex: 1, -1, 21)"
                  value={diasNovo}
                  onChange={(e) => setDiasNovo(e.target.value)}
                  className="bg-gray-50 dark:bg-zinc-800"
                />
              </div>
              {tipoPreview && (
                <span className={`font-mono text-sm font-semibold px-2 py-1 rounded ${conflito ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"}`}>
                  {conflito ? `${tipoPreview} (já existe)` : tipoPreview}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => !isNaN(diasNum) && createMutation.mutate(diasNum)}
                disabled={!tipoPreview || conflito || createMutation.isPending}
              >
                {createMutation.isPending ? "Criando..." : "Criar Nível"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowForm(false); setDiasNovo(""); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

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
                  {nivel.is_custom && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      Custom
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={nivel.ativo}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ tipo: nivel.tipo, ativo: checked })
                    }
                    disabled={toggleMutation.isPending}
                  />
                  {nivel.is_custom && (
                    <button
                      onClick={() => setDeleteTarget(nivel.tipo)}
                      className="p-1 text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
                      title="Remover nível"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">
              Remover nível customizado
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-zinc-400">
              Tem certeza que deseja remover o nível <strong className="text-gray-900 dark:text-white font-mono">{deleteTarget}</strong>? O template associado também será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-zinc-800 dark:text-white dark:border-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

### Passo 3.4 — Derivar templateKeys dinamicamente em `ConfiguracoesTab`

- [ ] Substituir as duas linhas hardcoded (linhas ~1186–1189):

```typescript
  const templateKeysFinanceiro = ["D-3", "D+0", "D+3", "D+7", "D+10", "D+14", "D+15", "D+20"]
    .filter((tipo) => !niveisDesativados.includes(tipo));
  const templateKeysJuridico = ["D+30", "D+40", "D+45", "D+50", "D+55"]
    .filter((tipo) => !niveisDesativados.includes(tipo));
```

Por:

```typescript
  const templateKeysFinanceiro = niveisInfo
    .filter((n) => n.ativo && n.instancia === "financeiro")
    .map((n) => n.tipo);
  const templateKeysJuridico = niveisInfo
    .filter((n) => n.ativo && n.instancia === "juridico")
    .map((n) => n.tipo);
```

### Passo 3.5 — Verificar TypeScript

- [ ] Executar:
```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "TurboZap\|error TS" | head -20
```
Esperado: sem erros em TurboZap.tsx.

### Passo 3.6 — Reiniciar servidor e testar no browser

- [ ] Reiniciar:
```bash
cd /Users/mac0267/Cortex && lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

- [ ] Testar em http://localhost:3000 → TurboZap → Configurações:
  - Clicar "Novo Nível", digitar `1` → preview mostra "D+1"
  - Digitar `7` → preview mostra "D+7 (já existe)" em vermelho, botão desabilitado
  - Criar D+1 → aparece na lista com badge "Custom" e lixeira
  - Card "Templates — Financeiro" mostra D+1 com editor de template
  - Clicar lixeira no D+1 → AlertDialog → confirmar → nível e card desaparecem

### Passo 3.7 — Commit

- [ ] Commit:
```bash
cd /Users/mac0267/Cortex && git add client/src/pages/TurboZap.tsx && git commit -m "$(cat <<'EOF'
feat(turbozap-ui): GerenciarNiveis com criar/deletar customizados + templateKeys dinâmico

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist de Spec Coverage

| Requisito | Task |
|-----------|------|
| Nova tabela `turbozap_niveis_customizados` | Task 1 (init + migração) |
| `tipo` auto-gerado de `dias` | Task 1 (`createNivelCustomizado`) |
| `label` auto-gerada | Task 1 |
| Instância sempre financeiro | Task 1 |
| Validação conflito com sistema | Task 1 |
| Seed `template_{tipo}` ao criar | Task 1 |
| Delete remove template config | Task 1 |
| Sistema não pode ser deletado (400) | Task 1 + Task 2 |
| `GET /niveis` retorna `instancia` + `is_custom` | Task 2 |
| Lista combinada ordenada por dias | Task 1 (`getNiveisInfo`) |
| `POST /api/turbozap/niveis` | Task 2 |
| `DELETE /api/turbozap/niveis/:tipo` | Task 2 |
| UI form com preview do tipo | Task 3 |
| Badge "Custom" + lixeira | Task 3 |
| AlertDialog confirmação delete | Task 3 |
| `templateKeys` derivados da API | Task 3 |
| Nível customizado aparece em card de templates | Task 3 (via templateKeys dinâmico) |
