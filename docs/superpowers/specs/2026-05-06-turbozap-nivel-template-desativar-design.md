# Spec: Nível por Template + Desativar Níveis — TurboZap

**Data:** 2026-05-06  
**Status:** Aprovado

---

## Contexto

A biblioteca de templates criada anteriormente não tem associação com níveis de cobrança (D-3, D+7…) — todos os templates aparecem em todos os seletores. Além disso, os níveis de cobrança são fixos: não há como desativar um nível sem editar código.

Esta spec adiciona:
1. **Nível por template** — cada template pode ser tagueado para um nível específico (ou ficar genérico).
2. **Desativar níveis** — níveis podem ser desativados via UI; desativados não aparecem nos cards de template nem executam cobranças.

---

## Requisitos

1. **Campo `nivel` no template** — nullable TEXT. `NULL` = genérico (aparece em todos); `"D-3"`, `"D+7"` etc. = aparece só naquele nível.
2. **Criar template com nível** — form de `BibliotecaTemplates` ganha Select "Nível (opcional)".
3. **Badge de nível na lista** — cada template na biblioteca exibe badge do nível associado.
4. **Filtro no seletor por nível** — `TemplateNivelEditor` mostra só templates cujo `nivel === tipo` OU `nivel === null`.
5. **Gerenciar Níveis** — nova seção em Configurações lista os 13 níveis com toggle on/off.
6. **Nível desativado** — não aparece nos cards de Templates Financeiro/Jurídico; é pulado no preview e na execução de cobranças.
7. **Reativar** — toggle pode ser revertido a qualquer momento.

---

## Estrutura de Dados

### Migração: `turbozap_templates`

```sql
ALTER TABLE cortex_core.turbozap_templates
  ADD COLUMN IF NOT EXISTS nivel TEXT;
```

`nivel` nullable. Templates existentes ficam com `NULL` (genérico) automaticamente.

### `turbozap_configuracoes` — nova chave

| chave | valor (exemplo) |
|-------|----------------|
| `niveis_desativados` | `["D+14","D+20"]` |

Seed: `[]` (todos ativos por padrão).

---

## API — Mudanças

### Existente: `POST /api/turbozap/templates`
- Aceitar campo `nivel` (string opcional, nullable) no body.
- Sem validação de enum — o frontend envia somente valores válidos do `TIPO_COLORS`.

### Novo: `PUT /api/turbozap/niveis/toggle`
- Body: `{ tipo: string, ativo: boolean }`
- Lê `niveis_desativados`, adiciona/remove `tipo`, persiste via `updateConfiguracao`.
- Retorna o array atualizado.

---

## Service — Mudanças

### `turbozap.ts`

**`TurboZapTemplate`** — adicionar campo `nivel: string | null`.

**`createTemplate(nome, conteudo, criadoPor, nivel)`** — aceitar `nivel: string | null` como 4º parâmetro; inserir na coluna.

**`getTemplates()`** — sem mudança (retorna todos; filtragem no cliente).

**Novas funções:**

```typescript
export async function getNiveisDesativados(): Promise<string[]>
// Lê chave 'niveis_desativados' de turbozap_configuracoes.
// Retorna [] se não existir ou JSON inválido.

export async function toggleNivel(tipo: string, ativo: boolean, atualizadoPor: string): Promise<string[]>
// Lê niveis_desativados, adiciona/remove tipo, salva, retorna array atualizado.
```

**`previewCobrancas()` e `executarCobrancas()`** — filtrar `NIVEIS_COBRANCA` pelos níveis desativados antes de processar.

**`initTurboZapTables()`** — seed da chave `niveis_desativados` com `[]` (ON CONFLICT DO NOTHING).

---

## UI — Mudanças

### `BibliotecaTemplates`

**Form de criação:**
- Adicionar Select "Nível (opcional)" com opções: "Genérico" (valor `null`) + todos os 13 tipos em ordem.
- Estado local: `nivelNovo: string | null` (default `null`).
- Enviar `nivel: nivelNovo` no POST.

**Lista de templates:**
- Exibir badge do nível ao lado do nome (ou "Genérico" com estilo neutro se `nivel === null`).

### `TemplateNivelEditor`

**Filtro no seletor:**
```typescript
const templatesForLevel = templates.filter(
  (t) => t.nivel === tipo || t.nivel === null
);
// Só renderiza o Select se templatesForLevel.length > 0
```

### `ConfiguracoesTab` — nova seção "Gerenciar Níveis"

- Inserir antes dos cards "Templates — Financeiro" e "Templates — Jurídico".
- `useQuery` para `/api/turbozap/niveis` (retorna `{ tipo, label, ativo }[]`).
- Lista dos 13 níveis com toggle Switch (on = ativo, off = desativado).
- `useMutation` para `PUT /api/turbozap/niveis/toggle`.
- Toast de feedback ao toggling.

**Efeito nos cards de template:**
- Antes de renderizar cada card Financeiro/Jurídico, filtrar os tipos: `templateKeysFinanceiro.filter(tipo => !niveisDesativados.includes(tipo))`.
- Se todos os tipos do card estiverem desativados, o card inteiro não renderiza.

---

## Comportamento do Preview e Execução

Em `previewCobrancas()` e `executarCobrancas()` (service):
- Buscar `niveis_desativados` uma vez no início.
- Fazer `NIVEIS_COBRANCA.filter(n => !desativados.includes(n.tipo))` antes do loop.
- Níveis desativados não geram clientes nem enviam mensagens.

---

## Endpoint Auxiliar: `GET /api/turbozap/niveis`

Retorna estado atual de todos os níveis:

```json
[
  { "tipo": "D-3", "label": "D-3 (Lembrete)", "ativo": true },
  { "tipo": "D+14", "label": "D+14 (Cancelamento)", "ativo": false },
  ...
]
```

Derivado de `NIVEIS_COBRANCA` cruzado com `niveis_desativados`.

---

## Fora do Escopo

- Criar ou renomear níveis via UI (apenas desativar/reativar os existentes)
- Associar template a múltiplos níveis (um template → um nível ou genérico)
- Validação de enum `nivel` no servidor
