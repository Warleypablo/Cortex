---
name: obsidian-sync
description: >
  Syncs development progress to the Obsidian vault after every code change.
  Invoked automatically as the final step of git-autopush. Updates tasks, epic status,
  overviews, and creates new epics/ADRs as needed. Never skip this step.
---

# Obsidian Sync Skill

After every code change (invoked by git-autopush), update the Obsidian vault to reflect what was done.

**Vault root:** `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/`

---

## Workflow

### Step 1 — Identify what changed

Use the commit message and diff context from the git-autopush to understand:
- **What was done** (new feature, bug fix, refactor, etc.)
- **Which domain** is affected (see Domain Mapping below)
- **Which epic/task** this relates to (if any)

### Step 2 — Find the relevant epic

Search the vault for an existing epic that matches the work done:

```bash
grep -rl "<keyword>" "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/<domain>/"
```

- If a matching epic exists → go to Step 3
- If no matching epic exists → go to Step 5

### Step 3 — Update tasks in the epic

Open the epic file and check its task list:

**If a task was completed:**
Change `- [ ] Task description #tag` to:
```markdown
- [x] Task description #tag ✅ YYYY-MM-DD
```

**If work is in progress but not complete:**
Do not mark the task as done. Only update the `atualizado` field in the frontmatter:
```yaml
atualizado: YYYY-MM-DD
```

### Step 4 — Update epic status

After updating tasks, check if the epic status should change:

| Condition | New Status |
|-----------|-----------|
| All tasks are `[x]` | `status: 🟢 concluido` |
| At least one task is in progress | `status: 🟡 em-andamento` |
| A task is blocked | `status: 🔴 bloqueado` |
| No tasks started yet | `status: ⚪ planejado` |

Also update `atualizado: YYYY-MM-DD` in the frontmatter.

### Step 5 — Create new epic (if needed)

If the work done does not match any existing epic, create a new one:

**File:** `<domain-folder>/<epic-name>.md`

```markdown
---
tipo: epico
dominio: <dominio>
status: 🟡 em-andamento
criado: YYYY-MM-DD
atualizado: YYYY-MM-DD
---
# <Nome do Épico>

## Objetivo
<Why this epic exists — infer from the work done>

## Tasks
- [x] <What was just completed> #<tag> ✅ YYYY-MM-DD
- [ ] <Remaining known tasks if any> #<tag>

## Notas
<Technical context, file paths, relevant links>
```

Then add a link to the new epic in the domain's `_overview.md`.

### Step 6 — Update domain overview

Open `<domain-folder>/_overview.md` and update:
- Epic list (add new epic if created in Step 5)
- Status counts (Construídos/Em andamento/Planejados)
- Status emoji of the listed epic if it changed

### Step 7 — Create ADR (if applicable)

If the change involved an **architectural decision** (new integration, tech choice, structural change, security pattern), create an ADR:

**File:** `Decisoes/<NNN>-<slug>.md`

```markdown
---
tipo: decisao
dominio: <dominio>
data: YYYY-MM-DD
status: aceita
---
# ADR-<NNN>: <Título>

## Contexto
<What problem was being solved>

## Decisão
<What was decided>

## Consequências
<What changes because of this decision>
```

Number the ADR sequentially (check existing files in `Decisoes/` for the last number).

### Step 8 — Confirm to user

After all updates, show a brief confirmation:

```
📓 Obsidian atualizado:
   - <what was updated> (epic/task/overview/ADR)
```

If nothing needed updating (trivial change like formatting/comments), skip silently.

---

## Domain Mapping

Identify the domain by the **files changed** and **context of the work**:

| Keywords / File Patterns | Domain Folder |
|--------------------------|---------------|
| `PortalCliente`, portal, suporte, CX, boleto, cancelamento, NPS, cliente-facing | `01-Area-do-Cliente/` |
| `contrato`, `Contracts`, `assinafy`, staging, assinatura, entregável | `02-Contratos/` |
| `financeiro`, `dre`, `fluxo-caixa`, `inadimplencia`, `caz_`, NF, billing | `03-Financeiro/` |
| `churn`, `retencao`, `risk-score`, cancelamento-interno | `04-Churn-Retencao/` |
| `comercial`, `sdr`, `closer`, `vendas`, `squad`, `okr`, `margem`, funil | `05-Comercial/` |
| `rh`, `colaborador`, `patrimonio`, `ferias`, `beneficio`, `inhire`, onboarding-rh | `06-RH-Pessoas/` |
| `relatorio`, `report`, auto-report, investor, slides | `07-Relatorios/` |
| `security`, `auth`, `routes.ts` (modularização), `rate-limit`, `zod`, middleware, infra | `08-Infra-Seguranca/` |
| `juridico`, `legal`, `processo`, assistente-juridico | `09-Juridico/` |

If the domain is ambiguous, use the **primary purpose** of the change. If it spans multiple domains, update each one.

---

## Edge Cases

- **Trivial changes** (typo, formatting, comments): skip Obsidian update silently
- **Multiple domains affected**: update each domain's epic separately
- **Vault files missing/corrupted**: warn the user, do not crash
- **New domain that doesn't exist**: warn the user and suggest creating a new domain folder
- **Task not found in any epic**: create a note in the relevant epic's `## Notas` section mentioning the work done

---

## Notes

- Always use today's date (`YYYY-MM-DD`) for timestamps
- Respect existing content in vault files — only modify the specific lines that need updating
- Never delete content from the vault unless explicitly asked
- If unsure whether to update, err on the side of updating (better to have too much tracking than too little)
