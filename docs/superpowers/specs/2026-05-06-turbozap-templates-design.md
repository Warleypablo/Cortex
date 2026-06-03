# Spec: Biblioteca de Templates — TurboZap

**Data:** 2026-05-06  
**Status:** Aprovado

---

## Contexto

O TurboZap gerencia templates de mensagem WhatsApp por nível de cobrança (D-3, D+0, …, D+55). Hoje o usuário só pode editar o texto diretamente em um textarea, sem reutilização e sem assistência para inserir variáveis. Esta spec adiciona uma biblioteca de templates nomeados e uma interface de seleção de variáveis.

---

## Requisitos

1. **Biblioteca de templates** — criar, listar e excluir templates com nome e conteúdo livre.
2. **Aplicar template por nível** — selecionar um template da biblioteca substitui o texto ativo daquele nível de cobrança.
3. **Botões de variável** — botões clicáveis inserem variáveis (`{nome}`, `{valor}`, `{vencimento}`, `{link_pagamento}`) na posição do cursor dentro do textarea.
4. **Exclusão com confirmação** — deletar template exige confirm dialog para evitar exclusão acidental.

---

## Estrutura de Dados

### Nova tabela: `cortex_core.turbozap_templates`

```sql
CREATE TABLE cortex_core.turbozap_templates (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  conteudo   TEXT NOT NULL,
  criado_por TEXT,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);
```

**Sem alterações** na tabela `turbozap_configuracoes`. Os campos `template_D-3`, `template_D+7`, etc. continuam como texto ativo de cada nível. A biblioteca é apenas uma fonte de conteúdo — ao aplicar um template, o conteúdo é copiado para o campo do nível correspondente.

---

## API — Novos Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/turbozap/templates` | Lista todos os templates da biblioteca |
| `POST` | `/api/turbozap/templates` | Cria novo template (`{ nome, conteudo }`) |
| `DELETE` | `/api/turbozap/templates/:id` | Exclui template por ID |

---

## UI — Aba Configurações

### Seção nova: "Biblioteca de Templates"

Inserida **antes** dos cards de Templates Financeiro/Jurídico.

**Lista de templates:**
- Card com título "Biblioteca de Templates"
- Cada item: nome em destaque + prévia do conteúdo (2 linhas truncadas) + botão de lixeira
- Ao clicar na lixeira → `AlertDialog` de confirmação antes de deletar
- Estado vazio: mensagem "Nenhum template salvo ainda"

**Criar novo template:**
- Botão `+ Novo Template` no header do card
- Abre form inline (não modal) com: campo Nome + Textarea + botões de variável + botão Salvar / Cancelar
- Ao salvar → POST + invalida query + fecha form

### Modificação nos cards de níveis (Financeiro e Jurídico)

Em cada nível (D-3, D+0, …, D+55), **acima** da textarea existente:

- Select `"Aplicar template da biblioteca"` — lista os templates salvos
- Ao selecionar um template → `AlertDialog` pergunta "Substituir o texto atual pelo template X?" → confirmar preenche o textarea do nível
- Após aplicar, o select volta ao placeholder (sem valor selecionado)
- O textarea segue editável normalmente após a aplicação

**Botões de variável** (abaixo de cada textarea, já existia hint de texto):
- Substituir o texto `Variáveis: {nome}, {valor}...` por 4 botões clicáveis
- Clicar em um botão insere o texto da variável na posição atual do cursor (via `selectionStart`/`selectionEnd` + `setRangeText` ou equivalente com `ref`)

---

## Comportamento Esperado

- Biblioteca vazia não impede uso dos níveis — o select aparece vazio/desabilitado
- Aplicar template não salva automaticamente o nível — o usuário ainda precisa clicar "Salvar" (comportamento atual mantido)
- Deletar template da biblioteca **não afeta** o texto já aplicado nos níveis (pois o conteúdo foi copiado, não referenciado)

---

## Fora do Escopo

- Edição de template na biblioteca (apenas criar e deletar)
- Versionamento de templates
- Associação fixa template ↔ nível
