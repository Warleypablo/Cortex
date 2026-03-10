# Spec: Obsidian Sync Skill

**Data:** 2026-03-10
**Status:** Aprovado

## Objetivo

Skill que sincroniza automaticamente o progresso de desenvolvimento com o vault do Obsidian. Invocada pelo git-autopush após cada alteração de código. Mantém tasks, épicos, overviews e ADRs atualizados.

## Decisões

| Aspecto | Decisão |
|---------|---------|
| Trigger | Invocada pelo git-autopush como step final |
| Arquivo | `agents/obsidian-sync-SKILL.md` (separado) |
| Escopo | Completo: tasks, épicos, overviews, novos épicos, ADRs |
| Vault path | `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/` |

## Fluxo

```
Código alterado → git-autopush (stage, commit, push, changelog) → obsidian-sync
```

## Lógica de Atualização

| Situação | Ação no Vault |
|----------|--------------|
| Task existente completada | Marca `- [x]` com `✅ YYYY-MM-DD` |
| Todas tasks de épico feitas | `status: 🟢 concluido` no frontmatter |
| Alteração em progresso | Atualiza `atualizado:` no frontmatter |
| Feature nova sem épico | Cria novo épico na pasta do domínio |
| Decisão arquitetural | Cria ADR em `Decisoes/` |
| Qualquer alteração | Atualiza `_overview.md` do domínio |

## Mapeamento de Domínio

Baseado nos paths dos arquivos alterados:

| Path pattern | Domínio |
|-------------|---------|
| `PortalCliente`, `portal-cliente`, suporte, CX | `01-Area-do-Cliente` |
| `contrato`, `Contracts`, `assinafy`, staging | `02-Contratos` |
| `financeiro`, `dre`, `fluxo-caixa`, `inadimplencia`, `caz_` | `03-Financeiro` |
| `churn`, `retencao`, `risk-score` | `04-Churn-Retencao` |
| `comercial`, `sdr`, `closer`, `vendas`, `squad`, `okr`, `margem` | `05-Comercial` |
| `rh`, `colaborador`, `patrimonio`, `ferias`, `beneficio`, `inhire` | `06-RH-Pessoas` |
| `relatorio`, `report`, `auto-report`, `investor` | `07-Relatorios` |
| `security`, `auth`, `routes.ts` (modularização), `rate-limit`, `zod` | `08-Infra-Seguranca` |
| `juridico`, `legal`, `processo` | `09-Juridico` |

## Alterações Necessárias

1. Criar `agents/obsidian-sync-SKILL.md`
2. Adicionar step no `agents/git-autopush-SKILL.md` referenciando a nova skill
3. Adicionar regra no `CLAUDE.md` na seção de agentes
