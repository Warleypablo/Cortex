# Card de Cliente Automatico - Design Spec

**Data:** 2026-03-10
**Status:** Aprovado (rev.2 - pos code review)

## Resumo

Ao ativar um contrato (status → "ativo") no modulo de contratos, o sistema automaticamente:
1. Cria ou atualiza o registro do cliente em `"Clickup".cup_clientes`
2. Atribui um CS responsavel via round-robin (least-loaded)
3. Registra evento na timeline do cliente

## Trigger

- **Endpoint:** `PUT /api/contratos/contratos/:id` (server/routes/contratos.ts ~linha 1275)
- **Condicao:** `oldStatus !== "ativo" && newStatus === "ativo"` (evita triggers duplicados)
- **Acao:** Hook pos-update executa provisioning do cliente
- **Nota:** Este e o endpoint do modulo staging.contratos, que tem `entidade_id` vinculado a `staging.entidades`

## Fluxo

```
PUT /api/contratos/contratos/:id { status: "ativo" }
  → ler status atual do contrato (oldStatus)
  → updateContrato() (existente)
  → SE oldStatus !== "ativo" E newStatus === "ativo":
    → buscar entidade via staging.entidades (entidade_id do contrato)
    → buscar CNPJ da entidade (cpf_cnpj)
    → upsert atomico em "Clickup".cup_clientes (INSERT ... ON CONFLICT)
    → round-robin: atribuir CS com menor carga (com fallback)
    → INSERT em cliente_eventos com dados_extras (timeline)
  → responder normalmente (provisioning nao bloqueia resposta em caso de erro)
```

## Upsert de Cliente

Tabela: `"Clickup".cup_clientes` (chave: `cnpj`)

Usa `INSERT ... ON CONFLICT (cnpj) DO UPDATE` para atomicidade.

### Campos no INSERT:
| Campo | Origem |
|-------|--------|
| `cnpj` | entidade.cpf_cnpj |
| `nome` | entidade.nome_razao_social |
| `status` | 'onboarding' |
| `responsavel` | CS atribuido por round-robin |
| `email` | entidade.email_principal |
| `telefone` | entidade.telefone_principal |
| `task_id` | `cortex-ent-{entidade_id}` (sintetico) |
| `site` | null |

### Estrategia de merge no UPDATE (ON CONFLICT):
- `status` → sempre atualiza para 'onboarding'
- `responsavel` → sempre atualiza (novo round-robin)
- `email` → so atualiza se campo existente e NULL
- `telefone` → so atualiza se campo existente e NULL
- `nome` → so atualiza se campo existente e NULL
- `task_id` → so atualiza se campo existente e NULL

## Round-Robin (Least-Loaded)

```sql
-- Buscar todos os CS's distintos (incluindo os com zero clientes ativos)
WITH cs_roster AS (
  SELECT DISTINCT responsavel
  FROM "Clickup".cup_clientes
  WHERE responsavel IS NOT NULL
    AND responsavel != ''
),
cs_carga AS (
  SELECT r.responsavel,
         COALESCE(COUNT(c.cnpj), 0) as carga
  FROM cs_roster r
  LEFT JOIN "Clickup".cup_clientes c
    ON c.responsavel = r.responsavel
    AND c.status IN ('ativo', 'onboarding', 'triagem')
  GROUP BY r.responsavel
  ORDER BY carga ASC
  LIMIT 1
)
SELECT responsavel FROM cs_carga
```

**Fallback:** Se nenhum CS encontrado, atribui NULL e loga warning.
O campo `responsavel` de cup_clientes aceita NULL.

## Evento na Timeline

Tabela: `cliente_eventos`

```sql
INSERT INTO cliente_eventos (
  cliente_cnpj, tipo, titulo, descricao,
  usuario_id, usuario_nome, dados_extras
)
VALUES (
  :cnpj,
  'contrato_ativado',
  'Novo contrato ativado',
  'Contrato #:numero ativado. CS responsavel: :cs_nome.',
  :user_id,
  :user_nome,
  :dados_extras::jsonb
)
```

`dados_extras` contem:
```json
{
  "contrato_id": 123,
  "numero_contrato": "CT-001",
  "cs_atribuido": "Nome do CS",
  "servicos": ["SEO", "Ads"],
  "valor_total": 5000.00
}
```

## Tratamento de Erros

- Provisioning e **fire-and-forget**: se falhar, loga erro mas nao impede o update do contrato
- Cada etapa (upsert, round-robin, timeline) falha independentemente
- Log com `console.error("[card-auto]", error)` para debug
- Se entidade nao encontrada (entidade_id invalido), loga warning e pula provisioning

## Tratamento de Duplicatas

- Upsert atomico via `INSERT ... ON CONFLICT (cnpj) DO UPDATE`
- Sem race conditions - PostgreSQL garante atomicidade
- Trigger so dispara na transicao de status (oldStatus !== "ativo")

## Arquivos Impactados

1. `server/routes/contratos.ts` - Hook no handler PUT /api/contratos/contratos/:id (~linha 1275)
2. Nenhum arquivo novo necessario

## Decisoes

- **Sem tabela nova** - Usa infraestrutura existente (cup_clientes + cliente_eventos)
- **Sem webhook externo** - Trigger manual no modulo de contratos (staging)
- **Sem notificacao ativa** - Apenas evento na timeline (consultavel)
- **Least-loaded** ao inves de round-robin puro - distribui melhor a carga
- **Fire-and-forget** - Provisioning nao bloqueia o update do contrato
- **ON CONFLICT** para upsert atomico - sem race conditions
- **task_id sintetico** `cortex-ent-{id}` para linkagem com cup_contratos
