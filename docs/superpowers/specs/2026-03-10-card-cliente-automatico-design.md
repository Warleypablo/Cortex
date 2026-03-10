# Card de Cliente Automatico - Design Spec

**Data:** 2026-03-10
**Status:** Aprovado

## Resumo

Ao ativar um contrato (status → "ativo") no modulo de contratos, o sistema automaticamente:
1. Cria ou atualiza o registro do cliente em `"Clickup".cup_clientes`
2. Atribui um CS responsavel via round-robin (least-loaded)
3. Registra evento na timeline do cliente

## Trigger

- **Endpoint:** `PATCH /api/contratos/:idSubtask` (server/routes.ts:1497)
- **Condicao:** Campo `status` muda para `"ativo"`
- **Acao:** Hook pos-update executa provisioning do cliente

## Fluxo

```
PATCH /api/contratos/:id { status: "ativo" }
  → updateContrato() (existente)
  → detectar status == "ativo"
  → buscar entidade via staging.entidades (entidade_id do contrato)
  → buscar CNPJ da entidade (cpf_cnpj)
  → upsert em "Clickup".cup_clientes
  → round-robin: atribuir CS com menor carga
  → INSERT em cliente_eventos (timeline)
```

## Upsert de Cliente

Tabela: `"Clickup".cup_clientes` (chave: `cnpj`)

### Se nao existe (INSERT):
| Campo | Origem |
|-------|--------|
| `cnpj` | entidade.cpf_cnpj |
| `nome` | entidade.nome_razao_social |
| `status` | 'onboarding' |
| `responsavel` | CS atribuido por round-robin |
| `email` | entidade.email_principal |
| `telefone` | entidade.telefone_principal |
| `site` | null |

### Se ja existe (UPDATE):
- Atualiza `status` para 'onboarding' (se estava inativo/cancelado)
- Atualiza `responsavel` via round-robin
- Mantem dados existentes que nao conflitam

## Round-Robin (Least-Loaded)

```sql
SELECT responsavel, COUNT(*) as carga
FROM "Clickup".cup_clientes
WHERE responsavel IS NOT NULL
  AND status IN ('ativo', 'onboarding', 'triagem')
GROUP BY responsavel
ORDER BY carga ASC
LIMIT 1
```

Sem tabela nova. Usa dados existentes de CS's ativos em cup_clientes.
O CS com menos clientes ativos recebe o proximo.

## Evento na Timeline

Tabela: `cliente_eventos`

```sql
INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome)
VALUES (
  :cnpj,
  'contrato_ativado',
  'Novo contrato ativado',
  'Contrato #:numero ativado. CS responsavel: :cs_nome. Servicos: :lista_servicos',
  :user_id,
  :user_nome
)
```

## Tratamento de Duplicatas

- Deteccao por CNPJ (chave primaria de cup_clientes)
- Cliente existente: atualiza registro, nao cria duplicata
- Novo contrato para cliente existente: atualiza status e CS

## Arquivos Impactados

1. `server/routes.ts` - Hook no handler PATCH /api/contratos/:idSubtask (~linha 1497)
2. `server/routes/clientes.ts` - Possivelmente reutilizar logica existente de eventos

## Decisoes

- **Sem tabela nova** - Usa infraestrutura existente (cup_clientes + cliente_eventos)
- **Sem webhook externo** - Trigger manual no modulo de contratos
- **Sem notificacao ativa** - Apenas evento na timeline (consultavel)
- **Least-loaded** ao inves de round-robin puro - distribui melhor a carga
