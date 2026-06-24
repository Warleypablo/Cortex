# Design Spec — Sistema de Gestão CrossSell

**Data:** 2026-04-17
**Status:** Aprovado
**Abordagem:** 100% Cortex DB (Opção A)

---

## 1. Visão Geral

Ferramenta interna para gestão do pipeline de CrossSell dentro da área Comercial do Cortex. Substitui visualização em coluna por interface de cards com informações consolidadas por cliente, histórico de interações, pipeline de negociação em 7 etapas, conversão automatizada para "Negócio Ganho" e dashboard analítico.

## 2. Modelo de Dados

4 tabelas novas em `cortex_core`.

### 2.1. `crosssell_oportunidades`

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | serial | PK | ID da oportunidade |
| `cliente_id` | text | NOT NULL | task_id do cliente em `cup_clientes` |
| `cnpj` | text | NOT NULL | CNPJ do cliente |
| `produto_mapeado` | text | NOT NULL | Produto identificado como oportunidade (do catálogo) |
| `etapa` | text | NOT NULL, DEFAULT 'fazer_contato' | Etapa da negociação |
| `valor_r_negociacao` | numeric(12,2) | DEFAULT 0 | Valor recorrente em negociação |
| `valor_p_negociacao` | numeric(12,2) | DEFAULT 0 | Valor pontual em negociação |
| `cx_responsavel` | text | NOT NULL | CX que conduz a negociação |
| `ultimo_contato` | date | | Data do último contato |
| `criado_em` | timestamp | DEFAULT NOW() | Data de criação |
| `atualizado_em` | timestamp | DEFAULT NOW() | Última atualização |

**Etapas válidas (enum lógico):**
1. `fazer_contato`
2. `tentativa_contato`
3. `reuniao_agendada`
4. `em_contato`
5. `proposta_enviada`
6. `forte_interesse`
7. `descartado`
8. `ganho` (estado terminal — card removido do pipeline ativo)

**Dados do cliente via JOIN (não armazenados):**
- Nome do cliente → `cup_clientes.nome`
- Status da conta → `cup_clientes.status`
- Cluster → `cup_clientes.cluster`
- CX Responsável da conta → `cup_clientes.responsavel`
- Lifetime → calculado a partir de `cup_contratos.data_inicio` (contrato mais antigo ativo)
- Valor R atual → SUM de `cup_contratos.valorr` WHERE status ativo
- Valor P atual → SUM de `cup_contratos.valorp` WHERE status ativo

### 2.2. `crosssell_comentarios`

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | serial | PK | ID do comentário |
| `oportunidade_id` | int | FK → crosssell_oportunidades.id, NOT NULL | Referência à oportunidade |
| `autor` | text | NOT NULL | Quem escreveu |
| `texto` | text | NOT NULL | Conteúdo do comentário |
| `criado_em` | timestamp | DEFAULT NOW() | Data/hora do registro |

### 2.3. `crosssell_negocios_ganhos`

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | serial | PK | ID |
| `oportunidade_id` | int | FK → crosssell_oportunidades.id, NOT NULL | Referência à oportunidade original |
| `cliente_nome` | text | NOT NULL | Nome do cliente (snapshot) |
| `cnpj` | text | NOT NULL | CNPJ |
| `valor_r` | numeric(12,2) | NOT NULL | Valor recorrente ganho |
| `valor_p` | numeric(12,2) | NOT NULL | Valor pontual ganho |
| `cx_responsavel` | text | NOT NULL | CX que fechou |
| `operacao` | text[] | NOT NULL | Array: Upsell, CrossSell, Renovação, Upgrade |
| `produto` | text | NOT NULL | Produto vendido |
| `mes_ganho` | date | NOT NULL | Mês em que foi ganho |
| `criado_em` | timestamp | DEFAULT NOW() | Data do registro |

### 2.4. `crosssell_etapa_log`

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | serial | PK | ID |
| `oportunidade_id` | int | FK → crosssell_oportunidades.id, NOT NULL | Referência à oportunidade |
| `etapa_anterior` | text | NOT NULL | Etapa de origem |
| `etapa_nova` | text | NOT NULL | Etapa de destino |
| `alterado_por` | text | NOT NULL | Quem mudou |
| `criado_em` | timestamp | DEFAULT NOW() | Quando mudou |

## 3. Arquitetura de Páginas

### 3.1. CrossSell Pipeline

**Rota:** `/dashboard/comercial/crosssell`
**Arquivo:** `client/src/pages/CrossSellPipeline.tsx`

**Barra de filtros:**
- Cluster (Select — valores de `cup_clientes.cluster`: Regulares, Imperdíveis, Chaves, NFNC)
- CX Responsável (Select — lista distinta de `crosssell_oportunidades.cx_responsavel`)
- Etapa (Select — as 7 etapas + "Todas")
- Produto Mapeado (Select — catálogo de produtos)
- Botão "+ Nova Oportunidade"

**Grid de cards (3 colunas responsivo):**
Cada card exibe:
- Header: nome do cliente + CX responsável + badge da etapa (cor por etapa)
- Grid 2x4 de dados: Produto Mapeado, Status Conta, Valor R atual, Valor P atual, Valor R negociação, Valor P negociação, Lifetime, Último contato
- Footer: botão comentários (com contador) + botão "Ganho"

**Cores por etapa:**
| Etapa | Cor do badge |
|-------|-------------|
| Fazer contato | Cinza |
| Tentativa de contato | Laranja claro |
| Reunião agendada | Amarelo |
| Em contato | Azul claro |
| Proposta enviada | Azul |
| Fortemente interessado | Roxo |
| Descartado | Vermelho, card com opacidade 60% |

### 3.2. CrossSell Dashboard

**Rota:** `/dashboard/comercial/crosssell-dashboard`
**Arquivo:** `client/src/pages/CrossSellDashboard.tsx`

**KPIs (linha de 5 cards):**
1. Reuniões Agendadas — COUNT de registros em `crosssell_etapa_log` WHERE `etapa_nova = 'reuniao_agendada'`
2. Reuniões Realizadas — COUNT de registros em `crosssell_etapa_log` WHERE `etapa_anterior = 'reuniao_agendada'` AND `etapa_nova` em etapa posterior
3. Total em Negociação (R) — SUM de `valor_r_negociacao` de oportunidades ativas
4. Total em Negociação (P) — SUM de `valor_p_negociacao` de oportunidades ativas
5. Taxa de Conversão — (total ganhos / total oportunidades criadas) × 100

**Gráficos (2 colunas):**
- Funil por Etapa — barras horizontais com contagem por etapa (Recharts BarChart horizontal)
- Reuniões Agendadas por CX — barras horizontais agrupadas por CX

**Rankings (2 colunas):**
- Ranking Valor Gerado — SUM de `valor_r + valor_p` de `crosssell_negocios_ganhos` por CX, ordenado desc
- Ranking Reuniões Agendadas — COUNT de mudanças para `reuniao_agendada` em `crosssell_etapa_log` por CX

**Filtro de período:** mês/ano selector aplicado a todos os indicadores.

## 4. Fluxos de Interação

### 4.1. Criar Nova Oportunidade
1. Clicar "+ Nova Oportunidade" abre Dialog
2. Campo de busca de cliente (autocomplete consultando `cup_clientes`)
3. Selecionar produto mapeado (Select com catálogo de produtos)
4. Preencher valores R e P em negociação
5. CX responsável = usuário logado (editável)
6. Etapa inicial = "Fazer contato"
7. POST `/api/comercial/crosssell` → card aparece no grid

### 4.2. Mudar Etapa
1. Dropdown no card permite trocar etapa
2. PATCH `/api/comercial/crosssell/:id` com nova etapa
3. Backend insere registro em `crosssell_etapa_log` automaticamente
4. Badge atualiza cor/texto

### 4.3. Comentários
1. Clicar botão de comentários abre Sheet (drawer lateral)
2. Timeline de comentários ordenada do mais recente ao mais antigo
3. Campo de texto + botão enviar
4. POST `/api/comercial/crosssell/:id/comentarios`
5. Autor preenchido automaticamente com usuário logado

### 4.4. Converter em Negócio Ganho
1. Clicar botão "Ganho" abre Dialog de confirmação
2. Campos: operação (multi-select), produto (pré-preenchido), mês ganho (date picker)
3. Valores R e P vêm pré-preenchidos da oportunidade (editáveis)
4. POST `/api/comercial/crosssell/:id/ganho`
5. Backend: cria registro em `crosssell_negocios_ganhos`, muda etapa para "ganho", insere log
6. Card desaparece do pipeline ativo

### 4.5. Descartar
1. Mudar etapa para "Descartado" via dropdown
2. Card permanece visível com opacidade reduzida
3. Filtrável — pode ser ocultado via filtro de etapa

## 5. API Endpoints

**Arquivo:** `server/routes/crosssell.ts`

### Oportunidades
| Método | Rota | Query Params | Descrição |
|--------|------|-------------|-----------|
| `GET` | `/api/comercial/crosssell` | `cluster`, `cx`, `etapa`, `produto` | Listar oportunidades com JOINs |
| `POST` | `/api/comercial/crosssell` | — | Criar oportunidade |
| `PATCH` | `/api/comercial/crosssell/:id` | — | Atualizar (etapa, valores, último contato) |

### Comentários
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/comercial/crosssell/:id/comentarios` | Listar comentários |
| `POST` | `/api/comercial/crosssell/:id/comentarios` | Adicionar comentário |

### Negócios Ganhos
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/comercial/crosssell/:id/ganho` | Converter em negócio ganho |
| `GET` | `/api/comercial/crosssell/ganhos` | Listar negócios ganhos |

### Dashboard
| Método | Rota | Query Params | Descrição |
|--------|------|-------------|-----------|
| `GET` | `/api/comercial/crosssell/dashboard` | `mes`, `ano` | KPIs, funil, rankings |

### Auxiliar
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/comercial/crosssell/clientes` | Buscar clientes para autocomplete |

## 6. Permissões e Navegação

### Permissões
- Nova chave: `com.crosssell` em `PERMISSION_KEYS.COM`
- Aplica-se a ambas as páginas
- Sem restrição por CX — todos veem e editam tudo

### Navegação (`nav-config.ts`)
2 novos itens na seção Comercial:
```typescript
{ title: 'CrossSell', url: '/dashboard/comercial/crosssell', icon: 'Repeat2', permissionKey: 'com.crosssell' }
{ title: 'CrossSell Dashboard', url: '/dashboard/comercial/crosssell-dashboard', icon: 'BarChart3', permissionKey: 'com.crosssell' }
```

## 7. Arquivos

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `server/routes/crosssell.ts` | Todos os endpoints da API |
| `client/src/pages/CrossSellPipeline.tsx` | Página do pipeline com grid de cards |
| `client/src/pages/CrossSellDashboard.tsx` | Dashboard analítico |
| `migrations/XXXX_crosssell_tables.sql` | Migração: 4 tabelas + índices |

### Modificar
| Arquivo | Mudança |
|---------|---------|
| `shared/nav-config.ts` | Adicionar 2 itens na seção Comercial + permission key |
| `shared/schema.ts` | Schemas Drizzle das 4 tabelas |
| `server/routes.ts` | Registrar `crosssellRouter` |
| `client/src/App.tsx` | 2 rotas novas |

## 8. Stack Técnica

- **Frontend:** React + TypeScript + Tailwind CSS + dark mode (`dark:` variants)
- **Data fetching:** React Query (`useQuery`, `useMutation`)
- **Gráficos:** Recharts (BarChart horizontal para funil e rankings)
- **ORM:** Drizzle para schema e queries
- **UI:** Componentes de `@/components/ui/` (Card, Dialog, Sheet, Select, Button, Input, Badge)
- **Formatação:** `formatCurrencyNoDecimals` para valores monetários
