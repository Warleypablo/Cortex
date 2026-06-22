# Patrimônio: Ajustes de Responsável, Status "Em Conserto" e Notas

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Desatribuir patrimônios automaticamente quando colaborador fica inativo, adicionar status "Em Conserto" com tracking de datas, e campo de notas.

**Architecture:** Alterações no schema (3 novas colunas + 1 status), backend (storage + routes) e frontend (PatrimonioDetail). A desatribuição automática é feita no `updateColaborador` existente.

**Tech Stack:** Drizzle ORM, PostgreSQL, React, TanStack Query, Tailwind CSS

---

### Task 1: Adicionar colunas no banco de dados

**Files:**
- Modify: `shared/schema.ts:388-402` (schema rhPatrimonio)
- Modify: `server/db.ts` ou `server/storage.ts` (CREATE TABLE / ALTER TABLE)

**Step 1: Adicionar colunas ao schema Drizzle**

Em `shared/schema.ts`, adicionar ao `rhPatrimonio`:

```typescript
statusPatrimonio: varchar("status_patrimonio", { length: 50 }),
dataInicioConserto: timestamp("data_inicio_conserto"),
dataFimConserto: timestamp("data_fim_conserto"),
notas: text("notas"),
```

**Step 2: Rodar ALTER TABLE no banco local**

```sql
ALTER TABLE "Inhire".rh_patrimonio
  ADD COLUMN IF NOT EXISTS status_patrimonio VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_inicio_conserto TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_fim_conserto TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notas TEXT;
```

**Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(patrimonio): add status_patrimonio, conserto dates and notas columns"
```

---

### Task 2: Desatribuição automática ao dispensar colaborador

**Files:**
- Modify: `server/storage.ts:2419-2497` (updateColaborador)
- Modify: `server/storage.ts:2731-2743` (getColaboradoresDropdown)

**Step 1: Adicionar lógica de desatribuição no updateColaborador**

Em `server/storage.ts`, no método `updateColaborador`, após a linha `return updatedColaborador` (2496), inserir ANTES do return:

```typescript
// Se status mudou para Dispensado ou Inativo, desatribuir patrimônios
const statusAnterior = currentColaborador.status;
const statusNovo = colaborador.status;
const statusProvided = 'status' in colaborador && statusNovo !== undefined;

if (statusProvided && statusAnterior !== statusNovo &&
    (statusNovo === 'Dispensado' || statusNovo === 'Inativo')) {
  // Buscar patrimônios atribuídos a este colaborador
  const patrimonios = await db.execute(sql`
    SELECT id, responsavel_atual as "responsavelAtual"
    FROM "Inhire".rh_patrimonio
    WHERE responsavel_id = ${id}
  `);

  if (patrimonios.rows && patrimonios.rows.length > 0) {
    // Desatribuir todos
    await db.execute(sql`
      UPDATE "Inhire".rh_patrimonio
      SET responsavel_atual = NULL, responsavel_id = NULL
      WHERE responsavel_id = ${id}
    `);

    // Registrar no histórico de cada patrimônio
    for (const p of patrimonios.rows as any[]) {
      await this.createPatrimonioHistorico({
        patrimonioId: p.id,
        acao: `Responsável removido automaticamente (${updatedColaborador.nome} — ${statusNovo})`,
        usuario: criadoPor || 'Sistema',
        data: new Date(),
      });
    }
  }
}
```

**Step 2: Filtrar dropdown para excluir inativos/dispensados**

Em `getColaboradoresDropdown`, mudar a query para filtrar:

```typescript
async getColaboradoresDropdown(): Promise<{ id: number; nome: string; email_turbo: string | null; status: string | null }[]> {
  const result = await db
    .select({
      id: schema.rhPessoal.id,
      nome: schema.rhPessoal.nome,
      emailTurbo: schema.rhPessoal.emailTurbo,
      status: schema.rhPessoal.status,
    })
    .from(schema.rhPessoal)
    .where(
      or(
        eq(schema.rhPessoal.status, 'Ativo'),
        isNull(schema.rhPessoal.status)
      )
    )
    .orderBy(schema.rhPessoal.nome);

  return result.map(r => ({ id: r.id, nome: r.nome, email_turbo: r.emailTurbo, status: r.status }));
}
```

**Step 3: Commit**

```bash
git add server/storage.ts
git commit -m "feat(patrimonio): auto-unassign on collaborator dismissal, filter dropdown"
```

---

### Task 3: Script de limpeza one-time

**Files:**
- Runtime: executar via `npx tsx -e` no terminal

**Step 1: Rodar script para limpar dados existentes**

```sql
-- Identificar patrimônios com responsáveis inativos
SELECT p.id, p.numero_ativo, p.responsavel_atual, c.status
FROM "Inhire".rh_patrimonio p
JOIN "Inhire".rh_pessoal c ON p.responsavel_id = c.id
WHERE c.status IN ('Dispensado', 'Inativo');

-- Desatribuir
UPDATE "Inhire".rh_patrimonio p
SET responsavel_atual = NULL, responsavel_id = NULL
FROM "Inhire".rh_pessoal c
WHERE p.responsavel_id = c.id
AND c.status IN ('Dispensado', 'Inativo');
```

Registrar no histórico de cada patrimônio afetado.

---

### Task 4: Backend — Status "Em Conserto" e Notas

**Files:**
- Modify: `server/storage.ts:2803-2853` (updatePatrimonio)
- Modify: `server/storage.ts:2668-2710` (getPatrimonioById — SELECT)
- Modify: `server/storage.ts` (getPatrimonios — SELECT)
- Modify: `server/routes.ts` (PATCH /api/patrimonio/:id)

**Step 1: Adicionar novos campos no updatePatrimonio**

Em `storage.ts`, no método `updatePatrimonio`, adicionar suporte para os novos campos:

```typescript
if ('statusPatrimonio' in data) {
  updates.push(sql`status_patrimonio = ${data.statusPatrimonio}`);
}
if ('notas' in data) {
  updates.push(sql`notas = ${data.notas}`);
}
if ('dataInicioConserto' in data) {
  updates.push(sql`data_inicio_conserto = ${data.dataInicioConserto}`);
}
if ('dataFimConserto' in data) {
  updates.push(sql`data_fim_conserto = ${data.dataFimConserto}`);
}
```

**Step 2: Atualizar SELECTs para retornar novos campos**

Em todos os SELECT de patrimônio, adicionar:

```sql
status_patrimonio as "statusPatrimonio",
data_inicio_conserto as "dataInicioConserto",
data_fim_conserto as "dataFimConserto",
notas
```

**Step 3: Adicionar lógica de datas de conserto na rota**

Na rota `PATCH /api/patrimonio/:id` em `routes.ts`, detectar mudança de status:

```typescript
// Se status mudou para "Em Conserto", setar data início
if (data.statusPatrimonio === 'Em Conserto') {
  data.dataInicioConserto = new Date().toISOString();
  data.dataFimConserto = null;
}
// Se saiu de "Em Conserto", setar data fim
if (data.statusPatrimonio && data.statusPatrimonio !== 'Em Conserto') {
  // Checar se estava em conserto antes
  const patrimonio = await storage.getPatrimonioById(id);
  if (patrimonio?.statusPatrimonio === 'Em Conserto') {
    data.dataFimConserto = new Date().toISOString();
  }
}
```

Registrar no histórico: "Status alterado para Em Conserto" / "Conserto finalizado".

**Step 4: Commit**

```bash
git add server/storage.ts server/routes.ts
git commit -m "feat(patrimonio): add Em Conserto status with date tracking and notas field"
```

---

### Task 5: Frontend — Status badge, notas e conserto no PatrimonioDetail

**Files:**
- Modify: `client/src/pages/PatrimonioDetail.tsx`

**Step 1: Adicionar select de status do patrimônio**

Na seção de detalhes, adicionar um `Select` com as opções:
- "Disponível", "Em Uso", "Em Conserto", "Aposentado"

Com badge visual:
- Disponível → verde
- Em Uso → azul
- Em Conserto → amarelo/laranja
- Aposentado → cinza

**Step 2: Mostrar datas de conserto**

Quando status = "Em Conserto" ou quando há `dataFimConserto`, mostrar:
- "Em conserto desde: DD/MM/YYYY"
- "Conserto finalizado em: DD/MM/YYYY (X dias)"

**Step 3: Adicionar campo Notas**

Textarea com salvamento via mutation ao clicar fora ou botão salvar.

**Step 4: Commit**

```bash
git add client/src/pages/PatrimonioDetail.tsx
git commit -m "feat(patrimonio): add status select, conserto dates display and notas field to detail page"
```

---

### Task 6: Frontend — Badge de status na listagem principal

**Files:**
- Modify: `client/src/pages/Patrimonio.tsx`

**Step 1: Adicionar coluna/badge de status na tabela**

Mostrar badge de status ao lado do nome do patrimônio ou como coluna separada.

**Step 2: Adicionar filtro por status**

No painel de filtros, adicionar dropdown para filtrar por status do patrimônio.

**Step 3: Commit**

```bash
git add client/src/pages/Patrimonio.tsx
git commit -m "feat(patrimonio): add status badge and filter to list view"
```
