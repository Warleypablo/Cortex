# Spec: Níveis Customizados — TurboZap

**Data:** 2026-05-06
**Status:** Aprovado

---

## Contexto

Os 13 níveis de cobrança do TurboZap (D-3 a D+55) são fixados em código. Não existe como adicionar um novo nível (ex: D+1) sem alterar o código-fonte.

Esta spec permite criar e deletar níveis customizados via UI, mantendo os 13 níveis originais como "sistema" (não deletáveis, apenas toggleáveis).

---

## Requisitos

1. **Criar nível customizado** — usuário informa o número de dias; `tipo` e `label` são gerados automaticamente.
2. **Tipo auto-gerado** — `dias >= 0 → "D+{dias}"`, `dias < 0 → "D{dias}"` (ex: -1 → "D-1").
3. **Label auto-gerada** — `"D+{dias} (Customizado)"`.
4. **Instância** — sempre `"financeiro"` (sem opção de escolha).
5. **Validação** — `dias` deve ser inteiro; `tipo` gerado não pode conflitar com nível existente (sistema ou custom).
6. **Seed de template** — ao criar, semeia `template_{tipo} = ""` em `turbozap_configuracoes` automaticamente.
7. **Deletar nível customizado** — remove da tabela + remove `template_{tipo}` de `turbozap_configuracoes`.
8. **Nível de sistema não pode ser deletado** — DELETE retorna 400 se `tipo` pertencer aos 13 originais.
9. **Lista combinada** — `GET /api/turbozap/niveis` retorna sistema + customizados, ordenados por `dias`.
10. **Novos campos no endpoint** — resposta inclui `instancia` e `is_custom` (boolean).
11. **UI — GerenciarNiveis** — botão "Novo Nível" abre mini-form inline com input de dias e preview do tipo gerado.
12. **UI — badge "Custom"** — níveis customizados mostram badge visual + ícone de lixeira (com confirmação). Níveis de sistema: só toggle.
13. **UI — ConfiguracoesTab dinâmico** — `templateKeysFinanceiro` e `templateKeysJuridico` derivados de `niveisInfo` da API (não hardcoded). Novo nível customizado aparece automaticamente no card de templates.

---

## Estrutura de Dados

### Nova tabela: `turbozap_niveis_customizados`

```sql
CREATE TABLE IF NOT EXISTS cortex_core.turbozap_niveis_customizados (
  id         SERIAL PRIMARY KEY,
  tipo       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  dias       INTEGER NOT NULL,
  instancia  TEXT NOT NULL DEFAULT 'financeiro',
  criado_por TEXT,
  criado_em  TIMESTAMP DEFAULT NOW()
);
```

### `turbozap_configuracoes` — seed automático

Ao criar nível customizado:
```sql
INSERT INTO cortex_core.turbozap_configuracoes (chave, valor)
VALUES ('template_{tipo}', '')
ON CONFLICT (chave) DO NOTHING;
```

Ao deletar nível customizado:
```sql
DELETE FROM cortex_core.turbozap_configuracoes WHERE chave = 'template_{tipo}';
```

---

## Service — Mudanças

### `turbozap.ts`

**`NivelCobranca` interface** — adicionar campo opcional `is_custom?: boolean`.

**Nova interface `NivelCustomizado`:**
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

**Novas funções:**
```typescript
export async function getNiveisCustomizados(): Promise<NivelCustomizado[]>
// SELECT * FROM turbozap_niveis_customizados ORDER BY dias

export async function createNivelCustomizado(dias: number, criadoPor: string | null): Promise<NivelCustomizado>
// Gera tipo e label, valida conflito com NIVEIS_COBRANCA + existentes, INSERT, semeia template

export async function deleteNivelCustomizado(tipo: string): Promise<void>
// Valida que não é nível de sistema, DELETE da tabela, DELETE do template em configuracoes
```

**`getNiveisInfo(desativados)` — nova função helper exportada:**
```typescript
export function getNiveisInfo(
  customizados: NivelCustomizado[],
  desativados: string[],
): Array<{ tipo: string; label: string; ativo: boolean; instancia: string; is_custom: boolean }>
// Combina NIVEIS_COBRANCA + customizados, ordena por dias, aplica flag ativo
```

**`GET /api/turbozap/niveis`** — passa a chamar `getNiveisCustomizados()` e `getNiveisInfo()`.

**`previewCobrancas()`** — já filtra por `niveisAtivos` (sem mudança estrutural); mas agora `niveisAtivos` deve incluir customizados.

**`initTurboZapTables()`** — cria tabela `turbozap_niveis_customizados`.

---

## API — Mudanças

### `GET /api/turbozap/niveis` (atualizado)

Retorna lista combinada com novos campos:
```json
[
  { "tipo": "D-3", "label": "D-3 (Lembrete)", "ativo": true, "instancia": "financeiro", "is_custom": false },
  { "tipo": "D+1", "label": "D+1 (Customizado)", "ativo": true, "instancia": "financeiro", "is_custom": true }
]
```

### `POST /api/turbozap/niveis` (novo)

- Body: `{ dias: number }`
- Valida: inteiro, não conflita
- Retorna `NivelCustomizado` criado com status 201

### `DELETE /api/turbozap/niveis/:tipo` (novo)

- Rejeita com 400 se for nível de sistema
- Retorna `{ ok: true }` em sucesso

---

## UI — Mudanças

### `NivelInfo` interface (frontend)

Adicionar campos:
```typescript
interface NivelInfo {
  tipo: string;
  label: string;
  ativo: boolean;
  instancia: string;
  is_custom: boolean;
}
```

### `GerenciarNiveis`

- Botão "Novo Nível" (ícone `Plus`) no header do Card.
- Mini-form inline (toggle `showForm`):
  - Input numérico `diasNovo`
  - Preview em tempo real: `diasNovo >= 0 ? "D+" + diasNovo : "D" + diasNovo`
  - Botão "Criar" — chama `POST /api/turbozap/niveis`
  - Cancelar
- Na lista, cada nível exibe:
  - **Sistema**: badge "SIS" neutro (ou nenhum badge) + só toggle
  - **Custom**: badge "Custom" azul + toggle + botão lixeira com `AlertDialog` de confirmação
- `useMutation` para `DELETE /api/turbozap/niveis/:tipo`
- Após criar ou deletar: `invalidateQueries` para `/api/turbozap/niveis` E `/api/turbozap/configuracoes`

### `ConfiguracoesTab`

Substituir arrays hardcoded por derivação dinâmica de `niveisInfo`:
```typescript
const templateKeysFinanceiro = niveisInfo
  .filter((n) => n.ativo && n.instancia === "financeiro")
  .map((n) => n.tipo);
const templateKeysJuridico = niveisInfo
  .filter((n) => n.ativo && n.instancia === "juridico")
  .map((n) => n.tipo);
```

---

## Fora do Escopo

- Escolher instância (financeiro/jurídico) ao criar nível customizado — sempre financeiro
- Editar dias/label de nível customizado após criação
- Criar níveis jurídicos customizados
- Reordenar níveis manualmente
