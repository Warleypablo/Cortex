---
name: git-autopush
description: >
  Automatically stages, commits, and pushes code changes to GitHub after every modification made via Claude Code.
  Use this skill ALWAYS after editing, creating, or deleting any file in a project that has a git repository.
  Triggers on: any file edit, code generation, refactoring, bug fix, dependency change, config update, or any other
  modification to the codebase. Never skip this — every change should be committed and pushed immediately.
---

# Git Auto-Push Skill

After **every code change**, automatically:
1. Stage all modified files
2. Generate a commit message based on the diff
3. Commit and push to the current branch
4. Add changelog entry to `docs/CHANGELOG.md`

---

## Workflow

### Step 1 — Check git context

```bash
git -C <project_root> status --short
git -C <project_root> branch --show-current
```

- If the directory is not a git repo → warn the user and skip.
- Note the current branch name (commit to it, no matter what).

### Step 2 — Stage all changes

```bash
git -C <project_root> add -A
```

### Step 3 — Generate commit message

Run `git diff --cached` to see what changed, then write a commit message following this format:

```
<type>(<scope>): <short description>

- <bullet summarizing change 1>
- <bullet summarizing change 2>
...
```

**Types** (Conventional Commits):
| Type | When to use |
|------|-------------|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `style` | Formatting, whitespace, naming |
| `docs` | Documentation updates |
| `chore` | Config, deps, tooling, scripts |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |

**Rules for the message:**
- Subject line: max 72 chars, imperative mood ("add", not "added")
- Scope: the affected module/folder/feature (optional but preferred)
- Bullets: only include if there are 2+ meaningful changes
- Never include "Claude made this change" or similar — write as if a human dev wrote it

**Examples:**
```
feat(auth): add Google OAuth login flow
fix(api): handle null response from payment gateway
refactor(dashboard): extract chart logic into separate component
chore(deps): upgrade React to 18.3
```

### Step 4 — Commit and push

```bash
git -C <project_root> commit -m "<generated message>"
git -C <project_root> push
```

If `push` fails due to no upstream set:
```bash
git -C <project_root> push --set-upstream origin <current_branch>
```

### Step 5 — Add changelog entry

After a successful push, add an entry to `docs/CHANGELOG.md` documenting what was done.

**Create the file if it doesn't exist** with a `# Changelog` header.

**Add the new entry at the TOP** of the file (right after the `# Changelog` header), so the most recent changes appear first.

**Format:**

```markdown
## YYYY-MM-DD | <commit message subject line>

**O que foi feito:**
- <bullet describing each meaningful change>

**Por que:**
- <the reason/motivation behind the change>

**Arquivos alterados:**
- `<file path>` - <brief description of what changed in this file>

**Impacto arquitetural:** <"Nenhum" OR brief description of structural impact>

---
```

**Rules:**
- Each commit generates ONE entry
- "Impacto arquitetural" is mandatory — forces reflection on structural changes
- For trivial commits (typo, style, formatting), use a minimal single-line entry: `## YYYY-MM-DD | style: fix typo — Sem impacto.`
- Do NOT include the changelog file itself in the list of altered files
- After writing the entry, stage, commit (`docs(changelog): update changelog`), and push

### Step 6 — Confirm to the user

After everything completes, show a brief confirmation:

```
✅ Committed and pushed to `<branch>`:
   <commit message subject line>
📋 Changelog updated
```

If anything fails, show the error clearly and suggest a fix.

---

## Edge Cases

- **Untracked files only** (no modifications): still stage and commit with `chore: add <filenames>`
- **Nothing to commit**: skip silently, no message needed
- **Merge conflicts**: do NOT attempt to resolve — warn the user and stop
- **Detached HEAD**: warn the user and skip the push (commit is still OK if they confirm)
- **Large binary files**: skip files >10MB from auto-commit and warn the user
- **.gitignore**: respect it — never force-add ignored files

---

## Notes

- Always infer `<project_root>` from the file(s) being edited in the current task
- If multiple repos are involved in one task, commit and push each one separately
- Do not ask for confirmation before committing — just do it and report what happened
