# Design: View de Capacity

## Problema

Atualmente nao existe mecanismo para definir quantos contratos cada operador consegue gerenciar por produto, nem visibilidade consolidada de vagas disponiveis e utilizacao por squad/produto.

## Solucao

### Modelo de dados

Nova tabela `cortex_core.capacity_operador`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | serial PK | ID unico |
| operador | text NOT NULL | Nome do responsavel (match com `cup_contratos.responsavel`) |
| produto | text NOT NULL | Produto (match com `cup_contratos.produto`) |
| squad | text NOT NULL | Squad do operador |
| max_contratos | integer NOT NULL | Capacity maxima de contratos |
| atualizado_por | text | Email de quem atualizou |
| atualizado_em | timestamp DEFAULT NOW() | Data da ultima atualizacao |

**Constraint:** UNIQUE(operador, produto) — um operador tem uma unica capacity por produto.

### Calculo de utilizacao

- **Contratos atuais**: `SELECT COUNT(*) FROM "Clickup".cup_contratos WHERE responsavel = X AND produto = Y AND status IN (statuses ativos)`
- **Vagas livres**: `max_contratos - contratos_atuais`
- **% utilizacao**: `(contratos_atuais / max_contratos) * 100`

### API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/capacity` | Lista todas as capacities com contratos atuais calculados |
| GET | `/api/capacity/consolidado` | Dados agregados por squad e produto |
| POST | `/api/capacity` | Cria/atualiza capacity de um operador+produto (upsert) |
| DELETE | `/api/capacity/:id` | Remove uma capacity |

### Frontend

Uma pagina com 2 abas:

**Aba 1 — Configuracao:**
- Formulario para definir capacity: selecionar operador, produto, e numero maximo de contratos
- Tabela editavel com todas as capacities configuradas
- Opcao de deletar entradas
- Filtro por squad

**Aba 2 — Dashboard:**
- Cards no topo: capacity total, contratos total, vagas livres, % utilizacao geral
- Visao por Squad: barras horizontais mostrando % utilizacao de cada squad por produto
- Visao por Operador: tabela com operador, produto, capacity, contratos atuais, vagas livres, % utilizacao
- Cores: verde (<70%), amarelo (70-90%), vermelho (>90%)
- Filtros por squad e produto

### Permissoes

- Nova permissao `gestao.capacity` no sistema de permissoes existente
- Gestor do squad pode editar capacity dos operadores do seu squad
- Visualizacao disponivel para quem tem permissao

### Stack

- Tabela: SQL direto via migration
- Backend: Express route em `routes.ts`, query em `storage.ts`
- Frontend: React + TailwindCSS + Recharts + React Query + shadcn/ui
- Dark/light mode obrigatorio

## Fora de escopo

- Historico de mudancas de capacity (pode ser adicionado futuramente)
- Capacity por horas ou MRR
- Alocacao automatica de contratos
