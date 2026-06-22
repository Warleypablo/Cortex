# Spec: Edição de Cláusulas — Contratos Creators

**Data:** 2026-05-15
**Status:** Aprovado

---

## Contexto

Os contratos de creators possuem 12 cláusulas padrão geradas dinamicamente com dados do contrato (nome, valor, prazo, etc.). Atualmente essas cláusulas são hardcoded na função `gerarContratoCreatorPDF` em `server/routes/creators.ts` e não são editáveis pelo usuário.

A demanda é permitir revisar e editar as cláusulas individualmente antes de enviar o contrato para assinatura, sem persistir as alterações no banco de dados.

---

## Escopo

- Edição por contrato individualmente (não é template global)
- Ativada apenas no momento do envio para assinatura
- Alterações não são salvas no banco — usadas apenas para gerar o PDF
- Não há botão de restaurar texto original
- Funciona apenas para contratos em status `rascunho`

---

## Fluxo

1. Usuário clica **"Enviar para assinatura"** em um contrato com status `rascunho`
2. Abre modal **"Revisar Cláusulas — [Nome do Creator]"**
3. Modal carrega as 12 cláusulas via `GET /api/creators/contratos/:id/clausulas`
4. Usuário revisa cláusulas (accordion, todas colapsadas por padrão)
5. Expande cláusula → lê texto → clica **"Editar"** → textarea inline aparece
6. Edita texto → clica **"Salvar"** → texto atualizado em memória, badge `• Editada` aparece no header
7. Clica **"Confirmar e Enviar"** → envia `clausulasEditadas` junto com a requisição
8. Backend gera PDF com textos (padrão + editados) e envia ao Assinafy

---

## Interface

### Modal: `RevisarClausulasModal`

**Props:**
```typescript
interface RevisarClausulasModalProps {
  contratoId: number;
  creatorNome: string;
  open: boolean;
  onClose: () => void;
  onConfirmar: (clausulasEditadas: Record<number, string>) => void;
}
```

**Estado interno:**
```typescript
clausulas: Array<{ index: number; titulo: string; texto: string }>
clausulaEditando: number | null   // índice da cláusula em edição
textosEditados: Record<number, string>  // sobrescreve padrão onde editado
expandidas: Set<number>           // acordeon
```

**Layout do accordion (por cláusula):**
- Header: `[▶/▼] CLÁUSULA N - TÍTULO` + badge `• Editada` (se editada)
- Expandido/somente leitura: texto da cláusula + botão `Editar` (canto direito)
- Expandido/modo edição: `textarea` com texto atual + botões `Cancelar` e `Salvar`

**Footer fixo:**
- Botão esquerdo: `Cancelar` (fecha modal sem enviar)
- Botão direito: `Confirmar e Enviar →` (dispara envio)

---

## Backend

### Novo endpoint: `GET /api/creators/contratos/:id/clausulas`

Extrai a lógica de geração de texto das 12 cláusulas da função `gerarContratoCreatorPDF` para uma função reutilizável `gerarTextosClausulas(contrato)`.

**Resposta:**
```json
[
  { "index": 0, "titulo": "CLÁUSULA 1 - OBJETO", "texto": "..." },
  { "index": 1, "titulo": "CLÁUSULA 2 - DAS OBRIGAÇÕES DA CONTRATADA", "texto": "..." },
  ...
]
```

### Modificação: `POST /api/creators/contratos/:id/enviar-assinatura`

Aceita body opcional:
```json
{
  "clausulasEditadas": {
    "2": "Texto alternativo para cláusula 3...",
    "7": "Texto alternativo para cláusula 8..."
  }
}
```

Quando presente, substitui os textos correspondentes antes de gerar o PDF.

### Refatoração: `gerarContratoCreatorPDF`

A função passa a receber um parâmetro opcional `clausulasOverride: Record<number, string>`. Onde o índice existe em `clausulasOverride`, usa o texto fornecido em vez do padrão.

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `server/routes/creators.ts` | Novo endpoint GET `/clausulas`, refatorar `gerarContratoCreatorPDF` para aceitar overrides, modificar endpoint `enviar-assinatura` |
| `client/src/pages/Creators.tsx` | Substituir chamada direta de envio pelo novo modal, adicionar componente `RevisarClausulasModal` |

---

## Fora do escopo

- Persistência de cláusulas editadas no banco
- Template global de cláusulas
- Editor rico (rich text) — apenas textarea simples
- Botão de restaurar texto original
- Edição de contratos já enviados ou assinados
