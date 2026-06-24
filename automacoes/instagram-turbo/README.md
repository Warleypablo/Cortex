# Automação Instagram TurboPartners

Publica no Instagram do perfil TurboPartners automaticamente a partir de tasks `aprovado` na lista **Instagram 📷** do ClickUp (id `901300920768`).

**Runtime:** Python simples rodando em scheduled task / cron (sem n8n).
**Fontes:** ClickUp API + Google Drive/Docs + Meta Graph API.
**Fallback:** Claude gera legenda quando Doc mestre tá com seção vazia.

## Estrutura

```
.
├── PLANO.md                ← arquitetura (LEIA PRIMEIRO)
├── CHECKLIST-EXECUCAO.md   ← blocos A-J com critério "pronto"
├── .env.example            ← template de credenciais
├── agente/                 ← código da automação
│   ├── README.md
│   ├── runbook.md          ← como rodar, debugar, recuperar
│   ├── ferramentas.md      ← mapa MCPs vs APIs diretas
│   └── ...                 ← main.py, clickup.py, drive.py, etc (Bloco C)
├── scripts/                ← validação e bootstrap
│   ├── 0-validar-estrutura.py
│   └── investigar-estrutura.py
├── _arquivado/             ← tentativa inicial com n8n (não usar)
└── clickup/, docs/         ← notas auxiliares da descoberta
```

## Status atual

| Bloco | Descrição | Status |
|---|---|---|
| A | Validação (só leitura) | ✅ |
| B | Credenciais Meta + Google + Anthropic | ⏳ aguardando inputs |
| C | Agente base em dry-run | 🔜 próximo |
| D | Meta Graph publish | 🔒 depende de B |
| E | ClickUp write | 🔒 depende de C + permissão |
| F | Fallback Claude | 🔒 depende de C |
| G | Scheduled task | 🔒 depende de C |
| H | Dry-run 1 semana | 🔒 depende de G |
| I | Ativação | 🔒 depende de H |
| J | Hardening | ongoing |

## Decisões já tomadas

- ❌ Sem criar custom fields, listas, statuses ou webhooks no ClickUp sem permissão (workspace compartilhado da Turbo).
- ❌ Sem Slack — aprovação e alertas via **comment no ClickUp**.
- ❌ Sem n8n — runtime é Python + cron.
- ✅ Match ClickUp ↔ Doc é pelo `task.name` (UPPER); match ClickUp ↔ Drive é pelo `TURBO_<slug>`.
- ✅ Pasta-raiz dos meses é fixa no Drive: `1yGxKCORxe7PipuYKY1yd508IWQyKgIIt`.

Ver `PLANO.md` §9-10 para decisões pendentes.
