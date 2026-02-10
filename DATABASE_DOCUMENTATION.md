# Documentacao Completa do Banco de Dados - Cortex

> **Data de geracao:** 10 de fevereiro de 2026  
> **Banco:** Google Cloud SQL (PostgreSQL)  
> **Projeto:** Cortex - Plataforma de Gestao Integrada

## Resumo Geral

| Metrica | Quantidade |
|---------|------------|
| Schemas | 14 |
| Tabelas | 239 |
| Views | 14 |
| Colunas (total) | 3108 |
| Foreign Keys | 82 |
| Indexes | 406 |

---

## Sumario

- [Schema: Bitrix](#schema-bitrix) (3 objetos)
- [Schema: Clickup](#schema-clickup) (21 objetos)
- [Schema: Conta Azul](#schema-conta-azul) (11 objetos)
- [Schema: Inhire](#schema-inhire) (15 objetos)
- [Schema: admin](#schema-admin) (1 objetos)
- [Schema: clickup](#schema-clickup) (2 objetos)
- [Schema: cortex_core](#schema-cortex_core) (96 objetos)
- [Schema: gold_views](#schema-gold_views) (1 objetos)
- [Schema: google_ads](#schema-google_ads) (24 objetos)
- [Schema: kpi](#schema-kpi) (1 objetos)
- [Schema: meta_ads](#schema-meta_ads) (7 objetos)
- [Schema: public](#schema-public) (10 objetos)
- [Schema: staging](#schema-staging) (56 objetos)
- [Schema: sys](#schema-sys) (5 objetos)
- [Relacionamentos entre Schemas](#relacionamentos-entre-schemas)
- [Resumo de Indexes](#resumo-de-indexes)

---

## Schema: Bitrix

**Descricao:** Dados do CRM Bitrix24 - gerenciamento de deals, closers e usuarios do pipeline comercial.

#### `crm_closers` (TABLE | ~31 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id | int | Sim | - | Identificador unico |
| nome | varchar(255) | Sim | - | Nome |
| email | varchar(255) | Sim | - | Email |
| active | bool | Sim | - | Ativo/Inativo |
| work_position | varchar(255) | Sim | - | Cargo/posicao |
| created_at | timestamp | Sim | - | Data de criacao |
| updated_at | timestamp | Sim | - | Data de atualizacao |
| empresa | varchar(255) | Sim | - | Empresa |

#### `crm_deal` (TABLE | ~12.822 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | bigint | Nao | - | Identificador unico |
| date_create | timestamp | Sim | - | Data de criacao |
| date_modify | timestamp | Sim | - | Data de modificacao |
| created_by_id | bigint | Sim | - | ID do criador |
| created_by_name | text | Sim | - | Nome do criador |
| created_by | text | Sim | - | Criado por |
| modify_by_id | bigint | Sim | - | ID do modificador |
| modified_by_name | text | Sim | - | Nome do modificador |
| modified_by | text | Sim | - | Modificado por |
| assigned_by_id | bigint | Sim | - | ID do responsavel |
| assigned_by | text | Sim | - | Atribuido por |
| company_id | bigint | Sim | - | ID da empresa |
| company_name | text | Sim | - | Nome da empresa |
| company | text | Sim | - | Empresa |
| contact_id | bigint | Sim | - | ID do contato |
| contact_name | text | Sim | - | Nome do contato |
| contact | text | Sim | - | Contato |
| title | text | Sim | - | Titulo |
| category_id | bigint | Sim | - | ID da categoria |
| category_name | text | Sim | - | Nome da categoria |
| category | text | Sim | - | category |
| stage_id | bigint | Sim | - | ID do estagio |
| stage_name | text | Sim | - | Nome do estagio |
| stage | text | Sim | - | Estagio no pipeline |
| stage_semantic | text | Sim | - | Semantica do estagio |
| comments | text | Sim | - | Comentarios |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| assigned_by_name | text | Sim | - | Nome do responsavel |
| closer | text | Sim | - | Closer (vendedor) |
| sdr | text | Sim | - | SDR (pre-vendas) |
| funil | varchar(255) | Sim | - | Funil de vendas |
| data_reuniao_realizada | date | Sim | - | Data da reuniao realizada |
| faturamento_mensal | varchar(255) | Sim | - | Faturamento mensal |
| lp_da_conversao | varchar(255) | Sim | - | Landing page da conversao |
| fonte | varchar(255) | Sim | - | Fonte/origem do lead |
| valor_pontual | numeric(15) | Sim | - | Valor pontual |
| valor_recorrente | numeric(15) | Sim | - | Valor recorrente |
| segmento | varchar(255) | Sim | - | segmento |
| lp_conversao | text | Sim | - | lp conversao |
| mql | text | Sim | - | mql |
| data_fechamento | date | Sim | - | Data de fechamento |
| source | varchar(255) | Sim | - | source |
| empresa | varchar(255) | Sim | - | Empresa |
| utm_source | varchar(255) | Sim | - | utm source |
| utm_campaign | varchar(255) | Sim | - | utm campaign |
| utm_term | varchar(255) | Sim | - | utm term |
| utm_content | varchar(255) | Sim | - | utm content |
| fnl_ngc | text | Sim | - | fnl ngc |

**Indexes:**
- `idx_crm_deal_assigned_by`: INDEX idx_crm_deal_assigned_by ON "Bitrix".crm_deal USING btree (assigned_by_id)
- `idx_crm_deal_category`: INDEX idx_crm_deal_category ON "Bitrix".crm_deal USING btree (category_id)
- `idx_crm_deal_date_create`: INDEX idx_crm_deal_date_create ON "Bitrix".crm_deal USING btree (date_create)
- `idx_crm_deal_date_modify`: INDEX idx_crm_deal_date_modify ON "Bitrix".crm_deal USING btree (date_modify)
- `idx_crm_deal_stage`: INDEX idx_crm_deal_stage ON "Bitrix".crm_deal USING btree (stage_id)

#### `crm_users` (TABLE | ~37 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Bitrix".crm_users_id_seq'::...` | Identificador unico |
| nome | varchar(255) | Nao | - | Nome |
| email | varchar(255) | Sim | - | Email |
| active | bool | Sim | `true` | Ativo/Inativo |
| work_position | varchar(255) | Sim | - | Cargo/posicao |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| empresa | varchar(255) | Sim | - | Empresa |

---

## Schema: Clickup

**Descricao:** Dados do ClickUp (com C maiusculo) - gestao de projetos, clientes, contratos, tarefas tech e custom fields.

#### `cup_clientes` (TABLE | ~1.177 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Clickup".clientes_clickup_i...` | Identificador unico |
| nome | text | Sim | - | Nome |
| cnpj | text | Sim | - | CNPJ do cliente |
| status | text | Sim | - | Status atual |
| telefone | varchar(50) | Sim | - | Telefone |
| responsavel | text | Sim | - | Responsavel |
| segmento | varchar(255) | Sim | - | segmento |
| cluster | varchar(255) | Sim | - | Cluster do cliente |
| status_conta | varchar(255) | Sim | - | Status da conta |
| servico | text | Sim | - | Servico contratado |
| tipo | text | Sim | - | Tipo |
| task_id | text | Sim | - | ID da tarefa no ClickUp |
| subtask_ids | text | Sim | - | subtask ids |
| motivo_cancelamento | text | Sim | - | Motivo do cancelamento |
| valorr | text | Sim | - | Valor recorrente (MRR) |
| reteve | text | Sim | - | reteve |
| responsavel_geral | text | Sim | - | Responsavel geral |
| squad | text | Sim | - | Squad/equipe |
| link_lista_clickup | text | Sim | - | link lista clickup |
| email | text | Sim | - | Email |
| site | text | Sim | - | site |
| instagram | text | Sim | - | instagram |
| links_contrato | text | Sim | - | links contrato |
| nome_dono | text | Sim | - | nome dono |
| vendedor | text | Sim | - | Vendedor responsavel |

**Indexes:**
- `idx_cup_clientes_cnpj`: INDEX idx_cup_clientes_cnpj ON "Clickup".cup_clientes USING btree (cnpj)
- `idx_cup_clientes_task_id`: INDEX idx_cup_clientes_task_id ON "Clickup".cup_clientes USING btree (task_id)

#### `cup_contratos` (TABLE | ~2.113 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| servico | varchar(255) | Sim | - | Servico contratado |
| status | text | Sim | - | Status atual |
| valorr | numeric(10) | Sim | - | Valor recorrente (MRR) |
| valorp | numeric(10) | Sim | - | Valor pontual |
| id_task | text | Sim | - | ID da tarefa (cliente) |
| 🔑 id_subtask | text | Nao | - | ID da subtarefa (contrato) |
| data_encerramento | date | Sim | - | Data de encerramento |
| data_inicio | date | Sim | - | Data de inicio |
| squad | text | Sim | - | Squad/equipe |
| produto | text | Sim | - | Produto |
| data_solicitacao_encerramento | date | Sim | - | Data da solicitacao de encerramento |
| responsavel | text | Sim | - | Responsavel |
| cs_responsavel | text | Sim | - | CS responsavel |
| vendedor | text | Sim | - | Vendedor responsavel |
| data_pausa | date | Sim | - | Data de pausa |
| motivo_cancelamento | text | Sim | - | Motivo do cancelamento |
| plano | text | Sim | - | Plano contratado |
| data_criado | date | Sim | - | Data de criado |
| data_entrega | date | Sim | - | Data de entrega |

**Indexes:**
- `idx_cup_contratos_id_subtask`: INDEX idx_cup_contratos_id_subtask ON "Clickup".cup_contratos USING btree (id_subtask)
- `idx_cup_contratos_id_task`: INDEX idx_cup_contratos_id_task ON "Clickup".cup_contratos USING btree (id_task)
- `idx_cup_contratos_status`: INDEX idx_cup_contratos_status ON "Clickup".cup_contratos USING btree (status)

#### `cup_custom_field_definitions` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 field_id | text | Nao | - | ID do campo customizado |
| name | text | Sim | - | Nome |
| type | text | Sim | - | type |
| space_id | text | Sim | - | ID do space (ClickUp) |

#### `cup_custom_field_values` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| 🔑 field_id | text | Nao | - | ID do campo customizado |
| field_name | text | Sim | - | field name |
| value_text | text | Sim | - | value text |
| value_number | numeric | Sim | - | value number |
| value_json | jsonb | Sim | - | value json |

#### `cup_data_hist` (TABLE | ~38.206 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| servico | varchar(255) | Sim | - | Servico contratado |
| status | text | Sim | - | Status atual |
| valorr | numeric(10) | Sim | - | Valor recorrente (MRR) |
| valorp | numeric(10) | Sim | - | Valor pontual |
| id_task | text | Sim | - | ID da tarefa (cliente) |
| id_subtask | text | Sim | - | ID da subtarefa (contrato) |
| data_encerramento | date | Sim | - | Data de encerramento |
| data_inicio | date | Sim | - | Data de inicio |
| squad | text | Sim | - | Squad/equipe |
| produto | text | Sim | - | Produto |
| data_solicitacao_encerramento | date | Sim | - | Data da solicitacao de encerramento |
| responsavel | text | Sim | - | Responsavel |
| cs_responsavel | text | Sim | - | CS responsavel |
| vendedor | text | Sim | - | Vendedor responsavel |
| data_pausa | date | Sim | - | Data de pausa |
| motivo_cancelamento | text | Sim | - | Motivo do cancelamento |
| plano | text | Sim | - | Plano contratado |
| data_snapshot | date | Sim | - | Data de snapshot |
| snapshot_date | date | Sim | - | snapshot date |
| cliente | varchar(255) | Sim | - | cliente |
| created_at | timestamp | Sim | `now()` | Data de criacao |

#### `cup_folders` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 folder_id | text | Nao | - | ID da pasta (ClickUp) |
| space_id | text | Nao | - | ID do space (ClickUp) |
| name | text | Nao | - | Nome |

#### `cup_freelas` (TABLE | ~1.069 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 clickup_task_id | text | Nao | - | ID de clickup task |
| task_name | text | Sim | - | task name |
| status | text | Sim | - | Status atual |
| prioridade | text | Sim | - | prioridade |
| valor_projeto | float8 | Sim | - | Valor de projeto |
| valor_projeto_2 | float8 | Sim | - | Valor de projeto 2 |
| data_vencimento | date | Sim | - | Data de vencimento |
| data_pagamento | date | Sim | - | Data de pagamento |
| data_inicio | date | Sim | - | Data de inicio |
| data_criada | timestamptz | Sim | - | Data de criada |
| data_atualizada | timestamptz | Sim | - | Data de atualizada |
| responsavel | text | Sim | - | Responsavel |
| tags | text | Sim | - | tags |
| list_id | text | Sim | - | ID da lista (ClickUp) |
| list_name | text | Sim | - | list name |
| url | text | Sim | - | url |
| parent_id | text | Sim | - | ID de parent |
| custom_fields | jsonb | Sim | - | custom fields |

#### `cup_lists` (TABLE | ~1 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id | text | Sim | - | Identificador unico |
| name | text | Sim | - | Nome |
| orderindex | text | Sim | - | orderindex |
| status | text | Sim | - | Status atual |
| priority | text | Sim | - | priority |
| assignee | text | Sim | - | assignee |
| task_count | text | Sim | - | task count |
| due_date | text | Sim | - | due date |
| start_date | text | Sim | - | start date |
| archived | text | Sim | - | archived |
| override_statuses | text | Sim | - | override statuses |
| statuses | text | Sim | - | statuses |
| permission_level | text | Sim | - | permission level |
| space.id | text | Sim | - | space.id |
| space.name | text | Sim | - | space.name |
| space.access | text | Sim | - | space.access |

#### `cup_projetos_tech` (TABLE | ~29 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 clickup_task_id | text | Nao | - | ID de clickup task |
| task_name | text | Sim | - | task name |
| status_projeto | text | Sim | - | status projeto |
| prioridade | text | Sim | - | prioridade |
| data_vencimento | date | Sim | - | Data de vencimento |
| lancamento | date | Sim | - | lancamento |
| tempo_total | float8 | Sim | - | tempo total |
| responsavel | text | Sim | - | Responsavel |
| fase_projeto | text | Sim | - | fase projeto |
| tipo | text | Sim | - | Tipo |
| tipo_projeto | text | Sim | - | tipo projeto |
| figma | text | Sim | - | figma |
| valor_p | float8 | Sim | - | Valor de p |
| data_inicial | date | Sim | - | Data de inicial |
| data_criada | date | Sim | - | Data de criada |

#### `cup_projetos_tech_fechados` (TABLE | ~472 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 clickup_task_id | text | Nao | - | ID de clickup task |
| task_name | text | Sim | - | task name |
| status_projeto | text | Sim | - | status projeto |
| prioridade | text | Sim | - | prioridade |
| data_vencimento | date | Sim | - | Data de vencimento |
| lancamento | date | Sim | - | lancamento |
| tempo_total | float8 | Sim | - | tempo total |
| responsavel | text | Sim | - | Responsavel |
| fase_projeto | text | Sim | - | fase projeto |
| tipo | text | Sim | - | Tipo |
| tipo_projeto | text | Sim | - | tipo projeto |
| figma | text | Sim | - | figma |
| valor_p | float8 | Sim | - | Valor de p |
| data_inicial | date | Sim | - | Data de inicial |
| data_criada | date | Sim | - | Data de criada |

#### `cup_spaces` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 space_id | text | Nao | - | ID do space (ClickUp) |
| name | text | Nao | - | Nome |

#### `cup_tags` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 space_id | text | Nao | - | ID do space (ClickUp) |
| 🔑 tag_name | text | Nao | - | Nome da tag |
| color | text | Sim | - | Cor |

#### `cup_task_assignees` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| 🔑 user_id | text | Nao | - | ID do usuario |

#### `cup_task_tags` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| 🔑 space_id | text | Nao | - | ID do space (ClickUp) |
| 🔑 tag_name | text | Nao | - | Nome da tag |

#### `cup_task_watchers` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| 🔑 user_id | text | Nao | - | ID do usuario |

#### `cup_tasks` (TABLE | ~2.814 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id | text | Sim | - | Identificador unico |
| custom_id | text | Sim | - | ID de custom |
| custom_item_id | text | Sim | - | ID de custom item |
| name | text | Sim | - | Nome |
| text_content | text | Sim | - | text content |
| description | text | Sim | - | Descricao |
| orderindex | text | Sim | - | orderindex |
| date_created | text | Sim | - | date created |
| date_updated | text | Sim | - | date updated |
| date_closed | text | Sim | - | date closed |
| date_done | text | Sim | - | date done |
| archived | text | Sim | - | archived |
| assignees | text | Sim | - | assignees |
| group_assignees | text | Sim | - | group assignees |
| watchers | text | Sim | - | watchers |
| checklists | text | Sim | - | checklists |
| tags | text | Sim | - | tags |
| parent | text | Sim | - | parent |
| top_level_parent | text | Sim | - | top level parent |
| priority | text | Sim | - | priority |
| due_date | text | Sim | - | due date |
| start_date | text | Sim | - | start date |
| points | text | Sim | - | points |
| time_estimate | text | Sim | - | time estimate |
| custom_fields | text | Sim | - | custom fields |
| dependencies | text | Sim | - | dependencies |
| linked_tasks | text | Sim | - | linked tasks |
| locations | text | Sim | - | locations |
| team_id | text | Sim | - | ID de team |
| url | text | Sim | - | url |
| permission_level | text | Sim | - | permission level |
| status.status | text | Sim | - | status.status |
| status.id | text | Sim | - | status.id |
| status.color | text | Sim | - | status.color |
| status.type | text | Sim | - | status.type |
| status.orderindex | text | Sim | - | status.orderindex |
| creator.id | text | Sim | - | creator.id |
| creator.username | text | Sim | - | creator.username |
| creator.color | text | Sim | - | creator.color |
| creator.email | text | Sim | - | creator.email |
| creator.profilePicture | text | Sim | - | creator.profilePicture |
| sharing.public | text | Sim | - | sharing.public |
| sharing.public_share_expires_on | text | Sim | - | sharing.public share expires on |
| sharing.public_fields | text | Sim | - | sharing.public fields |
| sharing.token | text | Sim | - | sharing.token |
| sharing.seo_optimized | text | Sim | - | sharing.seo optimized |
| list.id | text | Sim | - | list.id |
| list.name | text | Sim | - | list.name |
| list.access | text | Sim | - | list.access |
| project.id | text | Sim | - | project.id |
| project.name | text | Sim | - | project.name |
| project.hidden | text | Sim | - | project.hidden |
| project.access | text | Sim | - | project.access |
| folder.id | text | Sim | - | folder.id |
| folder.name | text | Sim | - | folder.name |
| folder.hidden | text | Sim | - | folder.hidden |
| folder.access | text | Sim | - | folder.access |
| space.id | text | Sim | - | space.id |
| priority.color | text | Sim | - | priority.color |
| priority.id | text | Sim | - | priority.id |
| priority.orderindex | text | Sim | - | priority.orderindex |
| priority.priority | text | Sim | - | priority.priority |
| time_spent | text | Sim | - | time spent |
| sharing.permission_level | text | Sim | - | sharing.permission level |
| sharing.permissions.can_comment | text | Sim | - | sharing.permissions.can comment |
| sharing.permissions.name | text | Sim | - | sharing.permissions.name |

#### `cup_teams` (TABLE | ~1 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id | text | Sim | - | Identificador unico |
| name | text | Sim | - | Nome |
| color | text | Sim | - | Cor |
| avatar | text | Sim | - | URL do avatar |
| members | text | Sim | - | members |

#### `cup_tech` (TABLE | ~545 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| list_id | text | Nao | - | ID da lista (ClickUp) |
| name | text | Nao | - | Nome |
| status_name | text | Sim | - | status name |
| status_type | text | Sim | - | status type |
| status_color | text | Sim | - | status color |
| due_on | timestamptz | Sim | - | due on |
| start_on | timestamptz | Sim | - | start on |
| time_estimate | bigint | Sim | - | time estimate |
| time_spent | bigint | Sim | - | time spent |
| priority | text | Sim | - | priority |
| orderindex | bigint | Sim | - | orderindex |
| creator | jsonb | Sim | - | creator |
| assignees | jsonb | Sim | - | assignees |
| watchers | jsonb | Sim | - | watchers |
| tags | jsonb | Sim | - | tags |
| custom_fields | jsonb | Sim | - | custom fields |
| subtasks | jsonb | Sim | - | subtasks |
| raw_payload | jsonb | Nao | - | raw payload |
| fetched_at | timestamptz | Nao | `now()` | Data/hora de fetched |
| cnpj | text | Sim | - | CNPJ do cliente |
| telefone | text | Sim | - | Telefone |
| segmento | text | Sim | - | segmento |
| cluster | text | Sim | - | Cluster do cliente |
| status_conta | text | Sim | - | Status da conta |
| motivo_cancelamento | text | Sim | - | Motivo do cancelamento |
| reteve | bool | Sim | - | reteve |
| tipo | text | Sim | - | Tipo |
| squad | text | Sim | - | Squad/equipe |
| responsavel | text | Sim | - | Responsavel |
| responsavel_geral | text | Sim | - | Responsavel geral |
| tempo_status_ativo | float8 | Sim | - | tempo status ativo |
| data_entregue_projeto_pontual | timestamptz | Sim | - | Data de entregue projeto pontual |
| figma_url | text | Sim | - | figma url |
| observadores | text | Sim | - | observadores |
| valor_f_ui_ux | numeric(18) | Sim | - | Valor de f ui ux |
| lancamento_previsto | timestamptz | Sim | - | lancamento previsto |
| uiux_freela | text | Sim | - | uiux freela |
| data_kickoff | timestamptz | Sim | - | Data de kickoff |
| valor_p | numeric(18) | Sim | - | Valor de p |
| lt | float8 | Sim | - | lt |
| contrato_rr | bool | Sim | - | contrato rr |
| data_ultimo_contato | timestamptz | Sim | - | Data de ultimo contato |
| produto | text | Sim | - | Produto |
| valor_f_dev | numeric(18) | Sim | - | Valor de f dev |
| tipo_task | text | Sim | - | tipo task |
| url_dev | text | Sim | - | url dev |
| valor_r | numeric(18) | Sim | - | Valor de r |
| tempo_total_ativo | float8 | Sim | - | tempo total ativo |
| equipe | text | Sim | - | equipe |
| fase_projeto | text | Sim | - | fase projeto |
| contato_feito_por | text | Sim | - | contato feito por |
| progresso | float8 | Sim | - | progresso |
| tipo_projeto | text | Sim | - | tipo projeto |
| plano | text | Sim | - | Plano contratado |
| time_to_deploy | float8 | Sim | - | time to deploy |
| dev_freela | text | Sim | - | dev freela |
| status_contato | text | Sim | - | status contato |

#### `cup_tech_custom_fields` (TABLE | ~1.372 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| 🔑 field_id | text | Nao | - | ID do campo customizado |
| field_name | text | Nao | - | field name |
| field_type | text | Sim | - | field type |
| type_config | jsonb | Sim | - | type config |
| value_text | text | Sim | - | value text |
| value_numeric | float8 | Sim | - | value numeric |
| value_boolean | bool | Sim | - | value boolean |
| value_datetime | timestamptz | Sim | - | value datetime |
| value_json | jsonb | Sim | - | value json |
| raw_field | jsonb | Nao | - | raw field |
| fetched_at | timestamptz | Nao | `now()` | Data/hora de fetched |

#### `cup_tech_tasks` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| status | varchar(50) | Sim | - | Status atual |
| prioridade | varchar(50) | Sim | - | prioridade |
| data_vencimento | date | Sim | - | Data de vencimento |
| lancamento | date | Sim | - | lancamento |
| tempo_total | int | Sim | - | tempo total |
| responsavel | varchar(100) | Sim | - | Responsavel |
| fase_projeto | varchar(100) | Sim | - | fase projeto |
| tipo | varchar(100) | Sim | - | Tipo |
| tipo_projeto | varchar(100) | Sim | - | tipo projeto |
| figma | varchar(255) | Sim | - | figma |
| valor_p | numeric(10) | Sim | - | Valor de p |
| data_inicial | date | Sim | - | Data de inicial |
| data_criada | timestamp | Sim | `now()` | Data de criada |
| id_task | text | Sim | - | ID da tarefa (cliente) |

#### `cup_users` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 user_id | text | Nao | - | ID do usuario |
| username | text | Sim | - | username |
| email | text | Sim | - | Email |
| full_name | text | Sim | - | full name |

---

## Schema: Conta Azul

**Descricao:** Dados financeiros do Conta Azul - parcelas, contas a pagar/receber, vendas, categorias e clientes.

#### `caz_bancos` (TABLE | ~15 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| automaticbankfeedenabled | bool | Sim | - | automaticbankfeedenabled |
| numberofpendingconciliations | int | Sim | - | numberofpendingconciliations |
| defaultaccount | bool | Sim | - | defaultaccount |
| balance | numeric | Sim | - | balance |
| accounttype | text | Sim | - | accounttype |
| ativo | bool | Sim | - | ativo |
| codbanco | text | Sim | - | codbanco |
| idbanco | text | Sim | - | idbanco |
| nmbanco | text | Sim | - | nmbanco |
| uuid | uuid | Sim | - | uuid |
| flag | bool | Sim | - | flag |
| paymentcompany | text | Sim | - | paymentcompany |
| wizardstatus | text | Sim | - | wizardstatus |
| contaazuldigital | bool | Sim | - | contaazuldigital |
| accountholdertype | text | Sim | - | accountholdertype |
| parentaccount_nmbanco | text | Sim | - | parentaccount nmbanco |
| empresa | text | Sim | - | Empresa |

#### `caz_categorias` (TABLE | ~130 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | text | Nao | - | Identificador unico |
| versao | int | Sim | - | Versao do registro |
| nome | text | Sim | - | Nome |
| categoria_pai | text | Sim | - | categoria pai |
| tipo | text | Sim | - | Tipo |
| entrada_dre | bool | Sim | - | entrada dre |
| considera_custo_dre | bool | Sim | - | considera custo dre |
| empresa | text | Sim | - | Empresa |

#### `caz_clientes` (TABLE | ~2.891 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Conta Azul".clientes_id_seq...` | Identificador unico |
| nome | varchar(255) | Nao | - | Nome |
| cnpj | varchar(255) | Nao | - | CNPJ do cliente |
| email | varchar(255) | Sim | - | Email |
| telefone | varchar(255) | Sim | - | Telefone |
| endereco | text | Sim | - | Endereco |
| ativo | bool | Sim | `true` | ativo |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| empresa | varchar(255) | Sim | - | Empresa |
| ids | varchar(255) | Sim | - | ids |

**Indexes:**
- `caz_clientes_ids_un`: UNIQUE INDEX caz_clientes_ids_un ON "Conta Azul".caz_clientes USING btree (ids)
- `idx_caz_clientes_cnpj`: INDEX idx_caz_clientes_cnpj ON "Conta Azul".caz_clientes USING btree (cnpj)
- `idx_caz_clientes_ids`: INDEX idx_caz_clientes_ids ON "Conta Azul".caz_clientes USING btree (ids)
- `idx_cnpj`: INDEX idx_cnpj ON "Conta Azul".caz_clientes USING btree (cnpj)

#### `caz_dre` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| descricao | text | Nao | - | Descricao |
| codigo | varchar(10) | Sim | - | codigo |
| posicao | int | Sim | - | posicao |
| indica_totalizador | bool | Sim | `false` | indica totalizador |
| representa_soma_custo_medio | bool | Sim | `false` | representa soma custo medio |
| id_pai | uuid | Sim | - | ID de pai |

#### `caz_itensvenda` (TABLE | ~1.034 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | - | Identificador unico |
| 🔑 id_item | uuid | Nao | - | ID de item |
| nome | text | Nao | - | Nome |
| descricao | text | Sim | - | Descricao |
| tipo | varchar(50) | Nao | - | Tipo |
| quantidade | int | Nao | - | quantidade |
| valor | numeric(12) | Nao | - | Valor monetario |
| custo | numeric(12) | Nao | - | custo |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |

**Indexes:**
- `caz_itensvenda_id_id_item_key`: UNIQUE INDEX caz_itensvenda_id_id_item_key ON "Conta Azul".caz_itensvenda USING btree (id, id_item)

#### `caz_pagar` (TABLE | ~14.783 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| status | varchar(50) | Sim | - | Status atual |
| total | numeric(12) | Sim | - | total |
| descricao | text | Sim | - | Descricao |
| data_vencimento | date | Sim | - | Data de vencimento |
| nao_pago | numeric(12) | Sim | - | Valor nao pago |
| pago | numeric(12) | Sim | - | pago |
| data_criacao | timestamp | Sim | `now()` | Data de criacao |
| data_alteracao | timestamp | Sim | `now()` | Data de alteracao |
| fornecedor | varchar(255) | Sim | - | fornecedor |
| nome | varchar(255) | Sim | - | Nome |
| empresa | varchar(255) | Sim | - | Empresa |
| data_quitacao | date | Sim | - | Data de quitacao |

#### `caz_parcelas` (TABLE | ~19.939 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | - | Identificador unico |
| status | varchar(30) | Sim | - | Status atual |
| versao | int | Sim | - | Versao do registro |
| indice | int | Sim | - | Indice da parcela |
| conciliado | bool | Sim | - | Se esta conciliado |
| valor_pago | numeric | Sim | - | Valor pago |
| perda | numeric | Sim | - | Valor de perda |
| nao_pago | numeric | Sim | - | Valor nao pago |
| data_vencimento | date | Sim | - | Data de vencimento |
| data_pagamento_previsto | date | Sim | - | Data prevista de pagamento |
| descricao | text | Sim | - | Descricao |
| nota | text | Sim | - | Nota/observacao |
| metodo_pagamento | varchar(50) | Sim | - | Metodo de pagamento |
| baixa_agendada | bool | Sim | - | Baixa agendada |
| valor_bruto | numeric | Sim | - | Valor bruto |
| valor_liquido | numeric | Sim | - | Valor liquido |
| desconto | numeric | Sim | - | Desconto aplicado |
| multa | numeric | Sim | - | Multa aplicada |
| juros | numeric | Sim | - | Juros aplicados |
| taxa | numeric | Sim | - | Taxa aplicada |
| id_evento | uuid | Sim | - | ID do evento |
| tipo_evento | varchar(30) | Sim | - | Tipo do evento (receita/despesa) |
| id_conta_financeira | uuid | Sim | - | ID da conta financeira |
| nome_conta_financeira | varchar(100) | Sim | - | Nome da conta financeira |
| tipo_conta_financeira | varchar(50) | Sim | - | Tipo da conta financeira |
| id_cliente | uuid | Sim | - | ID do cliente (Conta Azul) |
| url_cobranca | text | Sim | - | URL de cobranca |
| status_solicitacao_cobranca | varchar(30) | Sim | - | Status da solicitacao de cobranca |
| data_quitacao | date | Sim | - | Data de quitacao |
| tipo_solicitacao_cobranca | varchar(30) | Sim | - | Tipo de solicitacao de cobranca |
| numero_fatura | int | Sim | - | Numero da fatura |
| tipo_fatura | varchar(30) | Sim | - | Tipo da fatura |
| categoria_id | text | Sim | - | ID da categoria |
| categoria_nome | text | Sim | - | Nome da categoria |
| centro_custo_id | text | Sim | - | ID do centro de custo |
| centro_custo_nome | text | Sim | - | Nome do centro de custo |
| valor_centro_custo | text | Sim | - | Valor do centro de custo |
| empresa | varchar(255) | Sim | - | Empresa |
| nome | varchar(255) | Sim | - | Nome |
| valor_categoria | varchar(255) | Sim | - | Valor por categoria |
| categoria_nome_secundario | text | Sim | - | categoria nome secundario |
| categoria_nome_terciario | text | Sim | - | categoria nome terciario |
| categoria_valor_secundario | text | Sim | - | categoria valor secundario |
| categoria_valor_terciario | text | Sim | - | categoria valor terciario |
| data_competencia | date | Sim | - | Data de competencia |

#### `caz_receber` (TABLE | ~13.047 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | varchar(255) | Nao | - | Identificador unico |
| status | varchar(50) | Sim | - | Status atual |
| total | numeric(10) | Sim | - | total |
| descricao | text | Sim | - | Descricao |
| data_vencimento | date | Sim | - | Data de vencimento |
| nao_pago | numeric(10) | Sim | - | Valor nao pago |
| pago | numeric(10) | Sim | - | pago |
| data_criacao | timestamp | Sim | - | Data de criacao |
| data_alteracao | timestamp | Sim | - | Data de alteracao |
| cliente_id | varchar(255) | Sim | - | ID do cliente |
| cliente_nome | varchar(255) | Sim | - | Nome de cliente |
| cnpj | varchar(50) | Sim | - | CNPJ do cliente |
| telefone | varchar(20) | Sim | - | Telefone |
| link_pagamento | text | Sim | - | link pagamento |
| empresa | varchar(255) | Sim | - | Empresa |
| status_clickup | varchar(255) | Sim | - | status clickup |
| telefoneca | varchar(20) | Sim | - | telefoneca |
| status_cobranca | varchar(50) | Sim | `'Não Enviada'::character varying` | status cobranca |
| observacao | text | Sim | `''::text` | observacao |
| status_tratativa | varchar(50) | Sim | `NULL::character varying` | status tratativa |

#### `caz_vendas` (TABLE | ~26.000 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | - | Identificador unico |
| id_legado | bigint | Sim | - | ID de legado |
| data | date | Sim | - | Data |
| criado_em | timestamp | Sim | - | Data/hora de criado |
| tipo | varchar(50) | Sim | - | Tipo |
| itens | varchar(50) | Sim | - | itens |
| condicao_pagamento | bool | Sim | - | condicao pagamento |
| total | numeric(10) | Sim | - | total |
| numero | int | Sim | - | numero |
| cliente_id | uuid | Sim | - | ID do cliente |
| cliente_email | varchar(255) | Sim | - | cliente email |
| cliente_uuid_legado | uuid | Sim | - | cliente uuid legado |
| cliente_nome | varchar(255) | Sim | - | Nome de cliente |
| empresa | varchar(255) | Sim | - | Empresa |

#### `caz_vendasbyid` (TABLE | ~22.007 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| cliente_uuid | uuid | Sim | - | cliente uuid |
| cliente_tipo_pessoa | varchar(50) | Sim | - | cliente tipo pessoa |
| cliente_documento | varchar(20) | Sim | - | cliente documento |
| cliente_nome | varchar(255) | Sim | - | Nome de cliente |
| evento_financeiro_id | uuid | Sim | - | ID de evento financeiro |
| notificacao_id_referencia | varchar(255) | Sim | - | notificacao id referencia |
| notificacao_enviado_para | varchar(255) | Sim | - | notificacao enviado para |
| notificacao_enviado_em | timestamp | Sim | - | Data/hora de notificacao enviado |
| notificacao_aberto_em | timestamp | Sim | - | Data/hora de notificacao aberto |
| notificacao_status | varchar(50) | Sim | - | notificacao status |
| natureza_operacao_uuid | uuid | Sim | - | natureza operacao uuid |
| natureza_operacao_tipo_operacao | varchar(50) | Sim | - | natureza operacao tipo operacao |
| natureza_operacao_template_operacao | varchar(50) | Sim | - | natureza operacao template operacao |
| natureza_operacao_label | varchar(255) | Sim | - | natureza operacao label |
| natureza_operacao_mudanca_financeira | bool | Sim | - | natureza operacao mudanca financeira |
| natureza_operacao_mudanca_estoque | varchar(50) | Sim | - | natureza operacao mudanca estoque |
| venda_id | uuid | Sim | - | ID de venda |
| venda_status | varchar(50) | Sim | - | venda status |
| venda_id_legado | int | Sim | - | venda id legado |
| venda_tipo_negociacao | varchar(50) | Sim | - | venda tipo negociacao |
| venda_numero | int | Sim | - | venda numero |
| venda_id_categoria | uuid | Sim | - | venda id categoria |
| venda_data_compromisso | date | Sim | - | venda data compromisso |
| venda_observacoes | text | Sim | - | venda observacoes |
| venda_id_cliente | uuid | Sim | - | venda id cliente |
| venda_versao | int | Sim | - | venda versao |
| venda_id_natureza_operacao | uuid | Sim | - | venda id natureza operacao |
| venda_id_centro_custo | uuid | Sim | - | venda id centro custo |
| vendedor_id | uuid | Sim | - | ID de vendedor |
| vendedor_nome | varchar(255) | Sim | - | Nome de vendedor |
| vendedor_id_legado | int | Sim | - | vendedor id legado |
| empresa | varchar(255) | Sim | - | Empresa |
| produto | text | Sim | - | Produto |

#### `caz_vendedores` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id | bigint | Sim | - | Identificador unico |
| nome | varchar(255) | Sim | - | Nome |
| id_legado | varchar | Sim | - | ID de legado |

---

## Schema: Inhire

**Descricao:** Dados de RH e gestao de pessoas - colaboradores, candidaturas, vagas, patrimonio, pagamentos e avaliacoes.

#### `rh_candidaturas` (TABLE | ~2.633 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | bigint | Nao | `nextval('"Inhire".rh_candidaturas_id_...` | Identificador unico |
| job_id_raw | uuid | Nao | - | job id raw |
| job_id_hash | bigint | Nao | - | job id hash |
| job_name | text | Sim | - | job name |
| talent_id | uuid | Nao | - | ID de talent |
| talent_name | text | Sim | - | talent name |
| talent_email | text | Sim | - | talent email |
| talent_status | text | Sim | - | talent status |
| stage_id | uuid | Sim | - | ID do estagio |
| stage_name | text | Sim | - | Nome do estagio |
| source | text | Sim | - | source |
| updated_at | timestamptz | Nao | - | Data de atualizacao |
| payload | jsonb | Sim | - | payload |
| inserted_at | timestamptz | Nao | `now()` | Data/hora de inserted |

**Indexes:**
- `rh_candidaturas_job_idx`: INDEX rh_candidaturas_job_idx ON "Inhire".rh_candidaturas USING btree (job_id_hash)
- `rh_candidaturas_job_talent_uq`: UNIQUE INDEX rh_candidaturas_job_talent_uq ON "Inhire".rh_candidaturas USING btree (job_id_raw, talent_id)
- `rh_candidaturas_status_idx`: INDEX rh_candidaturas_status_idx ON "Inhire".rh_candidaturas USING btree (talent_status)

#### `rh_comentarios` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_comentarios_id_s...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| autor_id | int | Sim | - | ID do autor |
| autor_nome | varchar(200) | Sim | - | Nome de autor |
| autor_email | varchar(200) | Sim | - | autor email |
| comentario | text | Nao | - | comentario |
| tipo | varchar(50) | Sim | `'geral'::character varying` | Tipo |
| visibilidade | varchar(50) | Sim | `'lider'::character varying` | visibilidade |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| atualizado_em | timestamp | Sim | `now()` | Data/hora de atualizado |

**🔗 Foreign Keys:**
- `autor_id` → `Inhire.rh_pessoal.id`
- `colaborador_id` → `Inhire.rh_pessoal.id`

**Indexes:**
- `idx_rh_comentarios_autor`: INDEX idx_rh_comentarios_autor ON "Inhire".rh_comentarios USING btree (autor_id)
- `idx_rh_comentarios_colaborador`: INDEX idx_rh_comentarios_colaborador ON "Inhire".rh_comentarios USING btree (colaborador_id)
- `idx_rh_comentarios_criado`: INDEX idx_rh_comentarios_criado ON "Inhire".rh_comentarios USING btree (criado_em)

#### `rh_enps` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_enps_id_seq'::re...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| score | int | Nao | - | Pontuacao |
| comentario | text | Sim | - | comentario |
| data | date | Sim | `CURRENT_DATE` | Data |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| criado_por | text | Sim | - | criado por |
| motivo_permanencia | text | Sim | - | motivo permanencia |
| comentario_empresa | text | Sim | - | comentario empresa |
| score_lider | int | Sim | - | score lider |
| comentario_lider | text | Sim | - | comentario lider |
| score_produtos | int | Sim | - | score produtos |
| comentario_produtos | text | Sim | - | comentario produtos |
| feedback_geral | text | Sim | - | feedback geral |

**🔗 Foreign Keys:**
- `colaborador_id` → `Inhire.rh_pessoal.id`

**Indexes:**
- `idx_rh_enps_colaborador`: INDEX idx_rh_enps_colaborador ON "Inhire".rh_enps USING btree (colaborador_id)
- `idx_rh_enps_data`: INDEX idx_rh_enps_data ON "Inhire".rh_enps USING btree (data)

#### `rh_notas_fiscais` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_notas_fiscais_id...` | Identificador unico |
| pagamento_id | int | Nao | - | ID de pagamento |
| colaborador_id | int | Nao | - | ID do colaborador |
| numero_nf | varchar(50) | Sim | - | numero nf |
| valor_nf | numeric | Sim | - | Valor de nf |
| arquivo_path | text | Sim | - | arquivo path |
| arquivo_nome | text | Sim | - | Nome de arquivo |
| data_emissao | date | Sim | - | Data de emissao |
| status | varchar(50) | Sim | `'pendente'::character varying` | Status atual |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| criado_por | varchar(100) | Sim | - | criado por |
| xml_nfe | xml | Sim | - | xml nfe |

**Indexes:**
- `idx_rh_notas_fiscais_colaborador`: INDEX idx_rh_notas_fiscais_colaborador ON "Inhire".rh_notas_fiscais USING btree (colaborador_id)
- `idx_rh_notas_fiscais_pagamento`: INDEX idx_rh_notas_fiscais_pagamento ON "Inhire".rh_notas_fiscais USING btree (pagamento_id)

#### `rh_nps` (TABLE | ~2 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_nps_id_seq'::reg...` | Identificador unico |
| mes_referencia | varchar(7) | Nao | - | Mes de referencia |
| area | varchar(100) | Nao | - | Area/departamento |
| motivo_permanencia | text | Nao | - | motivo permanencia |
| score_empresa | int | Nao | - | score empresa |
| comentario_empresa | text | Nao | - | comentario empresa |
| score_lider | int | Nao | - | score lider |
| comentario_lider | text | Nao | - | comentario lider |
| score_produtos | int | Nao | - | score produtos |
| comentario_produtos | text | Nao | - | comentario produtos |
| feedback_geral | text | Sim | - | feedback geral |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |

**Indexes:**
- `idx_rh_nps_area`: INDEX idx_rh_nps_area ON "Inhire".rh_nps USING btree (area)
- `idx_rh_nps_mes`: INDEX idx_rh_nps_mes ON "Inhire".rh_nps USING btree (mes_referencia)

#### `rh_one_on_one` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_one_on_one_id_se...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| lider_id | int | Sim | - | ID do lider |
| data | date | Nao | - | Data |
| tipo | varchar(50) | Sim | `'regular'::character varying` | Tipo |
| anotacoes | text | Sim | - | anotacoes |
| proximos_passos | text | Sim | - | proximos passos |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| pdf_object_key | varchar(1000) | Sim | - | Chave de pdf object |
| pdf_filename | varchar(1000) | Sim | - | pdf filename |
| transcript_url | varchar(1000) | Sim | - | transcript url |
| transcript_text | text | Sim | - | transcript text |
| uploaded_by | varchar(1000) | Sim | - | uploaded by |
| ai_analysis | text | Sim | - | ai analysis |
| ai_analyzed_at | timestamp | Sim | - | Data/hora de ai analyzed |

**🔗 Foreign Keys:**
- `colaborador_id` → `Inhire.rh_pessoal.id`
- `lider_id` → `Inhire.rh_pessoal.id`

**Indexes:**
- `idx_rh_one_on_one_colaborador`: INDEX idx_rh_one_on_one_colaborador ON "Inhire".rh_one_on_one USING btree (colaborador_id)
- `idx_rh_one_on_one_data`: INDEX idx_rh_one_on_one_data ON "Inhire".rh_one_on_one USING btree (data)

#### `rh_pagamentos` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_pagamentos_id_se...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| mes_referencia | int | Nao | - | Mes de referencia |
| ano_referencia | int | Nao | - | Ano de referencia |
| valor_bruto | numeric | Nao | - | Valor bruto |
| valor_liquido | numeric | Sim | - | Valor liquido |
| data_pagamento | date | Sim | - | Data de pagamento |
| status | varchar(50) | Sim | `'pendente'::character varying` | Status atual |
| observacoes | text | Sim | - | Observacoes |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| atualizado_em | timestamp | Sim | `now()` | Data/hora de atualizado |

**Indexes:**
- `idx_rh_pagamentos_colaborador`: INDEX idx_rh_pagamentos_colaborador ON "Inhire".rh_pagamentos USING btree (colaborador_id)
- `idx_rh_pagamentos_periodo`: INDEX idx_rh_pagamentos_periodo ON "Inhire".rh_pagamentos USING btree (ano_referencia, mes_referencia)

#### `rh_patrimonio` (TABLE | ~253 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_patrimonio_id_se...` | Identificador unico |
| numero_ativo | varchar(50) | Nao | - | numero ativo |
| ativo | varchar(255) | Nao | - | ativo |
| marca | varchar(255) | Sim | - | marca |
| estado_conservacao | varchar(100) | Sim | - | estado conservacao |
| responsavel_atual | varchar(255) | Sim | - | responsavel atual |
| data_compra | date | Sim | - | Data de compra |
| valor_pago | numeric(12) | Sim | - | Valor pago |
| valor_mercado | numeric(12) | Sim | - | Valor de mercado |
| valor_venda | numeric(12) | Sim | - | Valor de venda |
| descricao | text | Sim | - | Descricao |
| email | varchar(255) | Sim | - | Email |
| responsavel_id | int | Sim | - | ID de responsavel |

#### `rh_patrimonio_historico` (TABLE | ~59 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_patrimonio_histo...` | Identificador unico |
| patrimonio_id | int | Nao | - | ID do patrimonio |
| acao | text | Nao | - | acao |
| usuario | text | Nao | - | usuario |
| data | timestamptz | Nao | `now()` | Data |

**🔗 Foreign Keys:**
- `patrimonio_id` → `Inhire.rh_patrimonio.id`

**Indexes:**
- `idx_patrimonio_historico_patrimonio_data`: INDEX idx_patrimonio_historico_patrimonio_data ON "Inhire".rh_patrimonio_historico USING btree (patrimonio_id, data DESC)

#### `rh_pdi` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_pdi_id_seq'::reg...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| titulo | varchar(200) | Nao | - | titulo |
| descricao | text | Sim | - | Descricao |
| status | varchar(50) | Sim | `'em_andamento'::character varying` | Status atual |
| progresso | int | Sim | `0` | progresso |
| data_inicio | date | Sim | `CURRENT_DATE` | Data de inicio |
| data_alvo | date | Sim | - | Data de alvo |
| data_conclusao | date | Sim | - | Data de conclusao |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| atualizado_em | timestamp | Sim | `now()` | Data/hora de atualizado |

**🔗 Foreign Keys:**
- `colaborador_id` → `Inhire.rh_pessoal.id`

**Indexes:**
- `idx_rh_pdi_colaborador`: INDEX idx_rh_pdi_colaborador ON "Inhire".rh_pdi USING btree (colaborador_id)
- `idx_rh_pdi_status`: INDEX idx_rh_pdi_status ON "Inhire".rh_pdi USING btree (status)

#### `rh_pessoal` (TABLE | ~311 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_pessoal_id_seq':...` | Identificador unico |
| status | varchar(50) | Sim | - | Status atual |
| nome | varchar(150) | Nao | - | Nome |
| cpf | varchar(14) | Sim | - | CPF da pessoa |
| endereco | text | Sim | - | Endereco |
| estado | varchar(2) | Sim | - | estado |
| telefone | varchar(20) | Sim | - | Telefone |
| aniversario | date | Sim | - | aniversario |
| admissao | date | Sim | - | admissao |
| demissao | date | Sim | - | demissao |
| tipo_demissao | varchar(100) | Sim | - | tipo demissao |
| motivo_demissao | text | Sim | - | motivo demissao |
| proporcional | numeric(10) | Sim | - | proporcional |
| proporcional_caju | numeric(10) | Sim | - | proporcional caju |
| setor | varchar(100) | Sim | - | setor |
| squad | varchar(100) | Sim | - | Squad/equipe |
| cargo | varchar(100) | Sim | - | Cargo |
| nivel | varchar(50) | Sim | - | nivel |
| pix | varchar(200) | Sim | - | pix |
| cnpj | varchar(18) | Sim | - | CNPJ do cliente |
| email_turbo | varchar(150) | Sim | - | email turbo |
| email_pessoal | varchar(150) | Sim | - | email pessoal |
| meses_de_turbo | int | Sim | - | meses de turbo |
| ultimo_aumento | date | Sim | - | ultimo aumento |
| meses_ult_aumento | int | Sim | - | meses ult aumento |
| salario | text | Sim | - | Salario |
| caju | text | Sim | - | caju |
| user_id | varchar(100) | Sim | - | ID do usuario |

**Indexes:**
- `rh_pessoal_cpf_key`: UNIQUE INDEX rh_pessoal_cpf_key ON "Inhire".rh_pessoal USING btree (cpf)

#### `rh_promocoes` (TABLE | ~113 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_promocoes_id_seq...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| data_promocao | date | Nao | - | Data de promocao |
| cargo_anterior | varchar(200) | Sim | - | cargo anterior |
| cargo_novo | varchar(200) | Sim | - | cargo novo |
| nivel_anterior | varchar(50) | Sim | - | nivel anterior |
| nivel_novo | varchar(50) | Sim | - | nivel novo |
| salario_anterior | numeric(10) | Sim | - | salario anterior |
| salario_novo | numeric(10) | Sim | - | salario novo |
| observacoes | text | Sim | - | Observacoes |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| criado_por | varchar(100) | Sim | - | criado por |

#### `rh_talentos` (TABLE | ~367 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_talentos_id_seq'...` | Identificador unico |
| nome | text | Nao | - | Nome |
| email | text | Nao | - | Email |
| status | text | Sim | - | Status atual |
| atualizacao | timestamp | Sim | `now()` | atualizacao |
| endereco | text | Sim | - | Endereco |

#### `rh_telefones` (TABLE | ~21 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | - | Identificador unico |
| conta | varchar(50) | Sim | - | conta |
| plano_operadora | varchar(50) | Sim | - | plano operadora |
| telefone | varchar(20) | Sim | - | Telefone |
| responsavel_nome | varchar(150) | Sim | - | Nome de responsavel |
| responsavel_id | int | Sim | - | ID de responsavel |
| setor | varchar(100) | Sim | - | setor |
| ultima_recarga | date | Sim | - | ultima recarga |
| status | varchar(20) | Sim | - | Status atual |

#### `rh_vagas` (TABLE | ~31 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('"Inhire".rh_vagas_id_seq'::r...` | Identificador unico |
| nome | text | Nao | - | Nome |
| status | text | Sim | - | Status atual |
| atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | atualizacao |
| area | text | Sim | - | Area/departamento |
| active_talents | text | Sim | - | active talents |
| created_at | text | Sim | - | Data de criacao |
| description | text | Sim | - | Descricao |
| seniority | text | Sim | - | seniority |

---

## Schema: admin

**Descricao:** Schema administrativo com tabelas de configuracao e mapeamento de status.

#### `contract_status_map` (TABLE | ~10 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('admin.contract_status_map_id...` | Identificador unico |
| status | varchar(100) | Nao | - | Status atual |
| is_active | bool | Sim | `false` | Se esta ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `contract_status_map_status_key`: UNIQUE INDEX contract_status_map_status_key ON admin.contract_status_map USING btree (status)

---

## Schema: clickup

**Descricao:** Replica normalizada do ClickUp (minusculo) - clientes e contratos em formato simplificado.

#### `cup_clientes` (TABLE | ~1.130 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| nome | text | Sim | - | Nome |
| cnpj | text | Sim | - | CNPJ do cliente |
| telefone | text | Sim | - | Telefone |
| status | text | Sim | - | Status atual |
| responsavel | text | Sim | - | Responsavel |
| responsavel_geral | text | Sim | - | Responsavel geral |
| vendedor | text | Sim | - | Vendedor responsavel |
| segmento | text | Sim | - | segmento |
| cluster | text | Sim | - | Cluster do cliente |
| status_conta | text | Sim | - | Status da conta |
| motivo_cancelamento | text | Sim | - | Motivo do cancelamento |
| reteve | text | Sim | - | reteve |
| squad | text | Sim | - | Squad/equipe |
| servico | text | Sim | - | Servico contratado |
| subtask_ids | text | Sim | - | subtask ids |
| tipo | text | Sim | - | Tipo |

#### `cup_contratos` (TABLE | ~2.019 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id_subtask | text | Nao | - | ID da subtarefa (contrato) |
| id_task | text | Sim | - | ID da tarefa (cliente) |
| servico | text | Sim | - | Servico contratado |
| status | text | Sim | - | Status atual |
| valorr | float8 | Sim | - | Valor recorrente (MRR) |
| valorp | float8 | Sim | - | Valor pontual |
| produto | text | Sim | - | Produto |
| plano | text | Sim | - | Plano contratado |
| data_criado | date | Sim | - | Data de criado |
| data_inicio | date | Sim | - | Data de inicio |
| data_encerramento | date | Sim | - | Data de encerramento |
| data_solicitacao_encerramento | date | Sim | - | Data da solicitacao de encerramento |
| squad | text | Sim | - | Squad/equipe |
| cs_responsavel | text | Sim | - | CS responsavel |
| responsavel | text | Sim | - | Responsavel |
| vendedor | text | Sim | - | Vendedor responsavel |
| data_pausa | date | Sim | - | Data de pausa |
| motivo_cancelamento | text | Sim | - | Motivo do cancelamento |

---

## Schema: cortex_core

**Descricao:** Schema principal do sistema Cortex - autenticacao, contratos, catalogo, chat, metricas, dashboards, financeiro e operacoes.

### Autenticacao e Sessoes

#### `access_logs` (TABLE | ~54 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | varchar | Nao | `gen_random_uuid()` | Identificador unico |
| action | text | Nao | - | action |
| entity_type | varchar(50) | Nao | - | entity type |
| entity_id | varchar(100) | Sim | - | ID de entity |
| entity_name | text | Sim | - | entity name |
| client_id | varchar(100) | Sim | - | ID de client |
| client_name | text | Sim | - | client name |
| details | text | Sim | - | details |
| user_email | varchar(255) | Sim | - | user email |
| user_name | varchar(255) | Sim | - | user name |
| created_at | timestamp | Sim | `now()` | Data de criacao |

#### `auth_logs` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.auth_logs_id_seq...` | Identificador unico |
| timestamp | timestamp | Sim | `now()` | timestamp |
| user_id | varchar(100) | Sim | - | ID do usuario |
| user_email | varchar(200) | Sim | - | user email |
| user_name | varchar(200) | Sim | - | user name |
| action | varchar(50) | Sim | - | action |
| ip_address | varchar(50) | Sim | - | Endereco IP |
| user_agent | text | Sim | - | User agent do navegador |
| success | varchar(10) | Sim | `'true'::character varying` | success |

#### `auth_users` (TABLE | ~91 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | varchar(100) | Nao | - | Identificador unico |
| google_id | varchar(100) | Nao | - | ID do Google |
| email | varchar(255) | Nao | - | Email |
| name | varchar(255) | Sim | - | Nome |
| picture | text | Sim | - | picture |
| created_at | timestamptz | Sim | `now()` | Data de criacao |
| role | varchar(20) | Sim | `'user'::character varying` | Papel/funcao |
| allowed_routes | array | Sim | - | allowed routes |
| department | text | Sim | - | department |

**Indexes:**
- `auth_users_google_id_key`: UNIQUE INDEX auth_users_google_id_key ON cortex_core.auth_users USING btree (google_id)

#### `portal_auth_sessions` (TABLE | ~4 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| email | varchar(255) | Nao | - | Email |
| token | varchar(255) | Nao | - | token |
| code | varchar(6) | Sim | - | code |
| expires_at | timestamp | Nao | - | Data de expiracao |
| used | bool | Sim | `false` | used |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |

**Indexes:**
- `idx_portal_auth_sessions_email`: INDEX idx_portal_auth_sessions_email ON cortex_core.portal_auth_sessions USING btree (email)
- `idx_portal_auth_sessions_token`: INDEX idx_portal_auth_sessions_token ON cortex_core.portal_auth_sessions USING btree (token)
- `portal_auth_sessions_token_key`: UNIQUE INDEX portal_auth_sessions_token_key ON cortex_core.portal_auth_sessions USING btree (token)

#### `portal_users` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| email | varchar(255) | Nao | - | Email |
| cnpj | varchar(14) | Sim | - | CNPJ do cliente |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| last_login | timestamp | Sim | - | last login |

**Indexes:**
- `idx_portal_users_cnpj`: INDEX idx_portal_users_cnpj ON cortex_core.portal_users USING btree (cnpj)
- `idx_portal_users_email`: INDEX idx_portal_users_email ON cortex_core.portal_users USING btree (email)
- `portal_users_email_key`: UNIQUE INDEX portal_users_email_key ON cortex_core.portal_users USING btree (email)

#### `session` (TABLE | ~59 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 sid | varchar | Nao | - | ID da sessao |
| sess | json | Nao | - | Dados da sessao |
| expire | timestamp | Nao | - | Expiracao da sessao |

**Indexes:**
- `idx_session_expire`: INDEX idx_session_expire ON cortex_core.session USING btree (expire)

### Catalogos e Configuracoes

#### `catalog_account_health` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_account_...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_account_health_slug_key`: UNIQUE INDEX catalog_account_health_slug_key ON cortex_core.catalog_account_health USING btree (slug)

#### `catalog_aliases` (TABLE | ~201 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 catalog_key | varchar(100) | Nao | - | Chave do catalogo |
| 🔑 alias | varchar(255) | Nao | - | Alias/apelido |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `slug` → `cortex_core.catalog_items.slug`
- `slug` → `cortex_core.catalog_items.catalog_key`
- `catalog_key` → `cortex_core.catalog_items.slug`
- `catalog_key` → `cortex_core.catalog_items.catalog_key`

#### `catalog_churn_reason` (TABLE | ~9 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_churn_re...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_churn_reason_slug_key`: UNIQUE INDEX catalog_churn_reason_slug_key ON cortex_core.catalog_churn_reason USING btree (slug)

#### `catalog_clusters` (TABLE | ~5 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_clusters...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_clusters_slug_key`: UNIQUE INDEX catalog_clusters_slug_key ON cortex_core.catalog_clusters USING btree (slug)

#### `catalog_contract_status` (TABLE | ~7 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_contract...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| counts_as_operating | bool | Sim | `false` | counts as operating |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_contract_status_slug_key`: UNIQUE INDEX catalog_contract_status_slug_key ON cortex_core.catalog_contract_status USING btree (slug)

#### `catalog_items` (TABLE | ~68 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 catalog_key | varchar(100) | Nao | - | Chave do catalogo |
| 🔑 slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| meta | jsonb | Sim | `'{}'::jsonb` | meta |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `catalog_key` → `cortex_core.catalogs.catalog_key`

#### `catalog_plans` (TABLE | ~6 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_plans_id...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_plans_slug_key`: UNIQUE INDEX catalog_plans_slug_key ON cortex_core.catalog_plans USING btree (slug)

#### `catalog_products` (TABLE | ~22 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_products...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| bp_segment | varchar(50) | Sim | - | bp segment |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_products_slug_key`: UNIQUE INDEX catalog_products_slug_key ON cortex_core.catalog_products USING btree (slug)

#### `catalog_roi_bucket` (TABLE | ~4 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_roi_buck...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_roi_bucket_slug_key`: UNIQUE INDEX catalog_roi_bucket_slug_key ON cortex_core.catalog_roi_bucket USING btree (slug)

#### `catalog_squads` (TABLE | ~12 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.catalog_squads_i...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| is_off | bool | Sim | `false` | Flag: off |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_squads_slug_key`: UNIQUE INDEX catalog_squads_slug_key ON cortex_core.catalog_squads USING btree (slug)

#### `catalogs` (TABLE | ~8 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 catalog_key | varchar(100) | Nao | - | Chave do catalogo |
| description | text | Sim | - | Descricao |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

### Contratos e Entidades

#### `aditivo_servicos` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.aditivo_servicos...` | Identificador unico |
| aditivo_id | int | Sim | - | ID do aditivo |
| plano_servico_id | int | Sim | - | ID do plano de servico |
| tipo_operacao | varchar(50) | Sim | - | tipo operacao |
| quantidade | int | Sim | `1` | quantidade |
| valor_unitario | numeric(12) | Sim | `0` | Valor de unitario |
| valor_total | numeric(12) | Sim | `0` | Valor de total |
| observacoes | text | Sim | - | Observacoes |

**🔗 Foreign Keys:**
- `plano_servico_id` → `cortex_core.planos_servicos.id`
- `aditivo_id` → `cortex_core.aditivos.id`

#### `aditivos` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.aditivos_id_seq'...` | Identificador unico |
| contrato_id | int | Sim | - | ID do contrato |
| numero_aditivo | varchar(20) | Sim | - | numero aditivo |
| tipo_aditivo | varchar(50) | Sim | - | tipo aditivo |
| descricao | text | Sim | - | Descricao |
| valor_anterior | numeric(12) | Sim | - | Valor de anterior |
| valor_novo | numeric(12) | Sim | - | Valor de novo |
| data_inicio_vigencia | date | Sim | - | Data de inicio vigencia |
| status | varchar(30) | Sim | `'rascunho'::character varying` | Status atual |
| url_assinatura | text | Sim | - | url assinatura |
| documento_assinado | bool | Sim | `false` | documento assinado |
| observacoes | text | Sim | - | Observacoes |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**🔗 Foreign Keys:**
- `contrato_id` → `cortex_core.contratos.id`

#### `contract_attachments` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contract_attachm...` | Identificador unico |
| contract_id | int | Sim | - | ID de contract |
| filename | varchar(255) | Sim | - | filename |
| file_path | text | Sim | - | file path |
| file_size | int | Sim | - | file size |
| file_type | varchar(100) | Sim | - | file type |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**🔗 Foreign Keys:**
- `contract_id` → `cortex_core.contratos.id`

#### `contract_signatures` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contract_signatu...` | Identificador unico |
| contract_id | int | Sim | - | ID de contract |
| external_id | varchar(255) | Sim | - | ID de external |
| provider | varchar(50) | Sim | - | provider |
| signature_url | text | Sim | - | signature url |
| status | varchar(50) | Sim | - | Status atual |
| signer_name | varchar(255) | Sim | - | signer name |
| signer_email | varchar(255) | Sim | - | signer email |
| signer_role | varchar(100) | Sim | - | signer role |
| signed_at | timestamp | Sim | - | Data/hora de signed |
| expires_at | timestamp | Sim | - | Data de expiracao |
| error_message | text | Sim | - | error message |
| webhook_data | jsonb | Sim | - | webhook data |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**🔗 Foreign Keys:**
- `contract_id` → `cortex_core.contratos.id`

#### `contract_status_history` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contract_status_...` | Identificador unico |
| contract_id | int | Sim | - | ID de contract |
| status_anterior | varchar(50) | Sim | - | status anterior |
| status_novo | varchar(50) | Sim | - | status novo |
| user_id | int | Sim | - | ID do usuario |
| changed_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data/hora de changed |
| ip_address | varchar(50) | Sim | - | Endereco IP |
| user_agent | text | Sim | - | User agent do navegador |
| observacoes | text | Sim | - | Observacoes |

**🔗 Foreign Keys:**
- `contract_id` → `cortex_core.contratos.id`

#### `contract_status_map` (TABLE | ~10 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contract_status_...` | Identificador unico |
| status | varchar(100) | Nao | - | Status atual |
| is_active | bool | Sim | `false` | Se esta ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `contract_status_map_status_key`: UNIQUE INDEX contract_status_map_status_key ON cortex_core.contract_status_map USING btree (status)

#### `contrato_servicos` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contrato_servico...` | Identificador unico |
| contrato_id | int | Sim | - | ID do contrato |
| servico_nome | varchar(255) | Nao | - | Nome de servico |
| plano | varchar(100) | Sim | - | Plano contratado |
| valor_original | numeric(12) | Sim | `0` | Valor de original |
| valor_negociado | numeric(12) | Sim | `0` | Valor de negociado |
| desconto_percentual | numeric(5) | Sim | `0` | desconto percentual |
| valor_final | numeric(12) | Sim | `0` | Valor de final |
| economia | numeric(12) | Sim | `0` | economia |
| modalidade | varchar(50) | Sim | - | modalidade |
| criado_em | timestamp | Sim | `CURRENT_TIMESTAMP` | Data/hora de criado |

**🔗 Foreign Keys:**
- `contrato_id` → `cortex_core.contratos.id`

#### `contratos` (TABLE | ~275 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contratos_id_seq...` | Identificador unico |
| numero_contrato | varchar(50) | Nao | - | numero contrato |
| entidade_id | int | Sim | - | ID da entidade |
| comercial_responsavel | varchar(255) | Sim | - | comercial responsavel |
| comercial_responsavel_email | varchar(255) | Sim | - | comercial responsavel email |
| id_crm_bitrix | varchar(50) | Sim | - | ID de crm_bitrix |
| status | varchar(30) | Sim | `'rascunho'::character varying` | Status atual |
| data_inicio | date | Sim | - | Data de inicio |
| data_fim | date | Sim | - | Data de fim |
| observacoes | text | Sim | - | Observacoes |
| criado_em | timestamp | Sim | `CURRENT_TIMESTAMP` | Data/hora de criado |
| atualizado_em | timestamp | Sim | `CURRENT_TIMESTAMP` | Data/hora de atualizado |
| cliente_id | int | Sim | - | ID do cliente |
| fornecedor_id | int | Sim | - | ID de fornecedor |
| status_faturamento | varchar(50) | Sim | `'pendente'::character varying` | status faturamento |
| data_ultima_fatura | date | Sim | - | Data de ultima fatura |
| usuario_fatura | int | Sim | - | usuario fatura |
| comercial_nome | varchar(255) | Sim | - | Nome de comercial |
| comercial_email | varchar(255) | Sim | - | comercial email |
| comercial_telefone | varchar(50) | Sim | - | comercial telefone |
| comercial_cargo | varchar(100) | Sim | - | comercial cargo |
| comercial_empresa | varchar(255) | Sim | - | comercial empresa |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| data_criacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| met_cob_recorrente | varchar(50) | Sim | - | met cob recorrente |
| met_cob_pontual | varchar(50) | Sim | - | met cob pontual |
| id_crm | varchar(50) | Sim | - | ID de crm |
| descricao | text | Sim | - | Descricao |
| valor_total | numeric(12) | Sim | - | Valor de total |
| data_inicio_recorrentes | date | Sim | - | Data de inicio recorrentes |
| data_inicio_cobranca_recorrentes | date | Sim | - | Data de inicio cobranca recorrentes |
| data_inicio_pontuais | date | Sim | - | Data de inicio pontuais |
| data_inicio_cobranca_pontuais | date | Sim | - | Data de inicio cobranca pontuais |
| hash_documento | varchar(255) | Sim | - | hash documento |
| url_assinatura | text | Sim | - | url assinatura |
| documento_assinado | bool | Sim | `false` | documento assinado |
| usuario_criacao | int | Sim | - | usuario criacao |
| usuario_atualizacao | int | Sim | - | usuario atualizacao |
| valor_original | numeric(12) | Sim | `0` | Valor de original |
| valor_negociado | numeric(12) | Sim | `0` | Valor de negociado |
| economia | numeric(12) | Sim | `0` | economia |
| desconto_percentual | numeric(5) | Sim | `0` | desconto percentual |
| signature_provider | varchar(50) | Sim | - | signature provider |
| signature_external_id | varchar(255) | Sim | - | ID de signature external |
| assinafy_document_id | varchar(255) | Sim | - | ID de assinafy document |
| assinafy_status | varchar(50) | Sim | - | assinafy status |
| assinafy_upload_url | text | Sim | - | assinafy upload url |
| assinafy_signing_url | text | Sim | - | assinafy signing url |
| assinafy_signed_document_url | text | Sim | - | assinafy signed document url |
| assinafy_last_sync | timestamp | Sim | - | assinafy last sync |
| signature_sent_at | timestamp | Sim | - | Data/hora de signature sent |
| signature_completed_at | timestamp | Sim | - | Data/hora de signature completed |
| usuario_responsavel_id | int | Sim | - | ID de usuario responsavel |

**🔗 Foreign Keys:**
- `entidade_id` → `cortex_core.entidades.id`

**Indexes:**
- `contratos_numero_contrato_key`: UNIQUE INDEX contratos_numero_contrato_key ON cortex_core.contratos USING btree (numero_contrato)

#### `contratos_colaboradores_status` (TABLE | ~185 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contratos_colabo...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| colaborador_nome | varchar(255) | Nao | - | Nome de colaborador |
| colaborador_email | varchar(255) | Sim | - | colaborador email |
| documento_id | varchar(255) | Sim | - | ID de documento |
| status | varchar(50) | Nao | `'Enviado para assinatura'::character ...` | Status atual |
| data_envio | timestamp | Sim | `now()` | Data de envio |
| data_assinatura | timestamp | Sim | - | Data de assinatura |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

#### `contratos_itens` (TABLE | ~430 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.contratos_itens_...` | Identificador unico |
| contrato_id | int | Sim | - | ID do contrato |
| plano_servico_id | int | Sim | - | ID do plano de servico |
| quantidade | int | Sim | `1` | quantidade |
| valor_unitario | numeric(12) | Sim | `0` | Valor de unitario |
| valor_total | numeric(12) | Sim | `0` | Valor de total |
| modalidade | varchar(50) | Sim | - | modalidade |
| valor_original | numeric(12) | Sim | `0` | Valor de original |
| valor_negociado | numeric(12) | Sim | `0` | Valor de negociado |
| desconto_percentual | numeric(5) | Sim | `0` | desconto percentual |
| tipo_desconto | varchar(20) | Sim | - | tipo desconto |
| valor_desconto | numeric(12) | Sim | `0` | Valor de desconto |
| valor_final | numeric(12) | Sim | `0` | Valor de final |
| economia | numeric(12) | Sim | `0` | economia |
| vigencia_desconto | text | Sim | - | vigencia desconto |
| periodo_desconto | varchar(50) | Sim | - | periodo desconto |
| apos_periodo | varchar(50) | Sim | - | apos periodo |
| forma_pagamento | varchar(50) | Sim | - | forma pagamento |
| num_parcelas | int | Sim | - | Quantidade/total de parcelas |
| valor_parcela | numeric(12) | Sim | - | Valor de parcela |
| observacoes | text | Sim | - | Observacoes |
| escopo | text | Sim | - | escopo |
| is_personalizado | bool | Sim | `false` | Flag: personalizado |

**🔗 Foreign Keys:**
- `contrato_id` → `cortex_core.contratos.id`
- `plano_servico_id` → `cortex_core.planos_servicos.id`

#### `entidades` (TABLE | ~269 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.entidades_id_seq...` | Identificador unico |
| tipo_pessoa | varchar(20) | Nao | `'juridica'::character varying` | tipo pessoa |
| cpf_cnpj | varchar(20) | Nao | - | cpf cnpj |
| nome_razao_social | varchar(255) | Sim | - | nome razao social |
| email_principal | varchar(255) | Sim | - | email principal |
| email_cobranca | varchar(255) | Sim | - | email cobranca |
| telefone_principal | varchar(20) | Sim | - | telefone principal |
| telefone_cobranca | varchar(20) | Sim | - | telefone cobranca |
| cep | varchar(10) | Sim | - | cep |
| numero | varchar(20) | Sim | - | numero |
| logradouro | varchar(255) | Sim | - | logradouro |
| bairro | varchar(100) | Sim | - | bairro |
| complemento | varchar(100) | Sim | - | complemento |
| cidade | varchar(100) | Sim | - | cidade |
| estado | varchar(2) | Sim | - | estado |
| tipo_entidade | varchar(20) | Nao | `'cliente'::character varying` | tipo entidade |
| observacoes | text | Sim | - | Observacoes |
| ativo | bool | Sim | `true` | ativo |
| criado_em | timestamp | Sim | `CURRENT_TIMESTAMP` | Data/hora de criado |
| atualizado_em | timestamp | Sim | `CURRENT_TIMESTAMP` | Data/hora de atualizado |
| nome | varchar(255) | Sim | - | Nome |
| nome_socio | varchar(255) | Sim | - | nome socio |
| cpf_socio | varchar(20) | Sim | - | cpf socio |
| eh_cliente | bool | Sim | `true` | eh cliente |
| eh_fornecedor | bool | Sim | `false` | eh fornecedor |
| endereco | varchar(255) | Sim | - | Endereco |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| telefone | varchar(50) | Sim | - | Telefone |
| email | varchar(255) | Sim | - | Email |

**Indexes:**
- `entidades_cpf_cnpj_key`: UNIQUE INDEX entidades_cpf_cnpj_key ON cortex_core.entidades USING btree (cpf_cnpj)

#### `planos_servicos` (TABLE | ~48 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.planos_servicos_...` | Identificador unico |
| servico_id | int | Sim | - | ID de servico |
| nome | varchar(255) | Nao | - | Nome |
| escopo | text | Sim | - | escopo |
| diretrizes | text | Sim | - | diretrizes |
| valor | numeric(12) | Sim | `0` | Valor monetario |
| periodicidade | varchar(50) | Sim | - | periodicidade |
| ativo | bool | Sim | `true` | ativo |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**🔗 Foreign Keys:**
- `servico_id` → `cortex_core.servicos.id`

#### `servicos` (TABLE | ~26 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.servicos_id_seq'...` | Identificador unico |
| nome | varchar(255) | Nao | - | Nome |
| descricao | text | Sim | - | Descricao |
| ativo | bool | Sim | `true` | ativo |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

### Clientes

#### `clientes` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| cnpj | text | Sim | - | CNPJ do cliente |
| nome | text | Sim | - | Nome |
| status | text | Sim | - | Status atual |
| telefone | varchar(50) | Sim | - | Telefone |
| responsavel | text | Sim | - | Responsavel |
| cluster | varchar(255) | Sim | - | Cluster do cliente |
| status_conta | varchar(255) | Sim | - | Status da conta |
| responsavel_geral | text | Sim | - | Responsavel geral |
| endereco | text | Sim | - | Endereco |
| empresa | varchar(255) | Sim | - | Empresa |
| ids | varchar(255) | Sim | - | ids |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT cup.cnpj,
    cup.nome,
    cup.status,
    cup.telefone,
    cup.responsavel,
    cup.cluster,
    cup.status_conta,
    cup.responsavel_geral,
    caz.endereco,
    caz.empresa,
    caz.ids
   FROM ("Clickup".cup_clientes cup
     LEFT JOIN "Conta Azul".caz_clientes caz ON ((cup.cnpj = (caz.cnpj)::text)));
```
</details>

#### `clients` (TABLE | ~386 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| name | text | Nao | - | Nome |
| cnpj | text | Sim | - | CNPJ do cliente |
| additional_info | text | Sim | - | additional info |
| created_at | timestamp | Nao | `now()` | Data de criacao |
| updated_at | timestamp | Nao | `now()` | Data de atualizacao |
| status | text | Sim | `'ativo'::text` | Status atual |
| linked_client_cnpj | text | Sim | - | linked client cnpj |

### Chat e Atendimento

#### `chat_conversas` (TABLE | ~6 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| cnpj | varchar(20) | Nao | - | CNPJ do cliente |
| cliente_id | uuid | Nao | - | ID do cliente |
| cliente_email | varchar(255) | Nao | - | cliente email |
| responsavel_apelido | varchar(255) | Sim | - | responsavel apelido |
| responsavel_geral_apelido | varchar(255) | Sim | - | responsavel geral apelido |
| status | varchar(20) | Sim | `'open'::character varying` | Status atual |
| atendente_atual | varchar(255) | Sim | - | atendente atual |
| primeira_resposta_em | timestamp | Sim | - | Data/hora de primeira resposta |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |
| closed_at | timestamp | Sim | - | Data/hora de closed |

**🔗 Foreign Keys:**
- `cliente_id` → `cortex_core.portal_users.id`

**Indexes:**
- `idx_chat_conversas_cliente`: INDEX idx_chat_conversas_cliente ON cortex_core.chat_conversas USING btree (cliente_id)
- `idx_chat_conversas_cnpj`: INDEX idx_chat_conversas_cnpj ON cortex_core.chat_conversas USING btree (cnpj)
- `idx_chat_conversas_responsavel`: INDEX idx_chat_conversas_responsavel ON cortex_core.chat_conversas USING btree (responsavel_apelido)
- `idx_chat_conversas_status`: INDEX idx_chat_conversas_status ON cortex_core.chat_conversas USING btree (status)

#### `chat_mensagens` (TABLE | ~31 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| conversa_id | uuid | Nao | - | ID da conversa |
| autor_tipo | varchar(20) | Nao | - | autor tipo |
| autor_id | varchar(255) | Sim | - | ID do autor |
| autor_nome | varchar(255) | Sim | - | Nome de autor |
| mensagem | text | Nao | - | mensagem |
| lida | bool | Sim | `false` | lida |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `conversa_id` → `cortex_core.chat_conversas.id`

**Indexes:**
- `idx_chat_mensagens_autor`: INDEX idx_chat_mensagens_autor ON cortex_core.chat_mensagens USING btree (autor_tipo)
- `idx_chat_mensagens_conversa`: INDEX idx_chat_mensagens_conversa ON cortex_core.chat_mensagens USING btree (conversa_id)
- `idx_chat_mensagens_created`: INDEX idx_chat_mensagens_created ON cortex_core.chat_mensagens USING btree (created_at)

#### `chat_metricas` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| data | date | Nao | - | Data |
| responsavel_apelido | varchar(255) | Sim | - | responsavel apelido |
| total_conversas | int | Sim | `0` | Quantidade/total de conversas |
| conversas_abertas | int | Sim | `0` | conversas abertas |
| conversas_fechadas | int | Sim | `0` | conversas fechadas |
| tempo_primeira_resposta_avg | int | Sim | `0` | tempo primeira resposta avg |
| tempo_atendimento_avg | int | Sim | `0` | tempo atendimento avg |
| total_mensagens | int | Sim | `0` | Quantidade/total de mensagens |
| sla_cumprido | int | Sim | `0` | sla cumprido |
| sla_violado | int | Sim | `0` | sla violado |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `chat_metricas_data_responsavel_apelido_key`: UNIQUE INDEX chat_metricas_data_responsavel_apelido_key ON cortex_core.chat_metricas USING btree (data, responsavel_apelido)
- `idx_chat_metricas_data`: INDEX idx_chat_metricas_data ON cortex_core.chat_metricas USING btree (data)
- `idx_chat_metricas_responsavel`: INDEX idx_chat_metricas_responsavel ON cortex_core.chat_metricas USING btree (responsavel_apelido)

### Financeiro e DFC

#### `bp_snapshots` (TABLE | ~2 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.bp_snapshots_id_...` | Identificador unico |
| mes_ano | varchar(7) | Nao | - | Mes/Ano de referencia |
| data_snapshot | timestamp | Nao | `now()` | Data de snapshot |
| metricas | jsonb | Nao | - | metricas |
| created_at | timestamp | Nao | `now()` | Data de criacao |

**Indexes:**
- `bp_snapshots_mes_ano_key`: UNIQUE INDEX bp_snapshots_mes_ano_key ON cortex_core.bp_snapshots USING btree (mes_ano)
- `idx_bp_snapshots_mes_ano`: INDEX idx_bp_snapshots_mes_ano ON cortex_core.bp_snapshots USING btree (mes_ano)

#### `clientes_faturamento` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.clientes_faturam...` | Identificador unico |
| cliente_id | int | Sim | - | ID do cliente |
| ciclo_faturamento | varchar(50) | Sim | - | ciclo faturamento |
| dia_vencimento | int | Sim | - | dia vencimento |
| dias_antecedencia_cobranca | int | Sim | `5` | dias antecedencia cobranca |
| dias_lembrete_apos_vencimento | int | Sim | `3` | dias lembrete apos vencimento |
| email_cobranca | varchar(255) | Sim | - | email cobranca |
| telefone_whatsapp | varchar(50) | Sim | - | telefone whatsapp |
| observacoes_fatura | text | Sim | - | observacoes fatura |
| ativo | bool | Sim | `true` | ativo |
| modalidade_recorrente | varchar(50) | Sim | - | modalidade recorrente |
| modalidade_pontual | varchar(50) | Sim | - | modalidade pontual |
| data_inicio_cobranca_recorrente | date | Sim | - | Data de inicio cobranca recorrente |
| data_inicio_cobranca_pontual | date | Sim | - | Data de inicio cobranca pontual |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**🔗 Foreign Keys:**
- `cliente_id` → `cortex_core.entidades.id`

#### `dfc` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.dfc_id_seq'::reg...` | Identificador unico |
| mes_referencia | date | Sim | - | Mes de referencia |
| tipo_fluxo | varchar(20) | Sim | - | tipo fluxo |
| categoria | varchar(100) | Sim | - | Categoria |
| valor_total | numeric(14) | Sim | - | Valor de total |

#### `dfc_completa` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| mes_referencia | date | Sim | - | Mes de referencia |
| cliente_nome | varchar(255) | Sim | - | Nome de cliente |
| categoria_nome | text | Sim | - | Nome da categoria |
| tipo_fluxo | text | Sim | - | tipo fluxo |
| valor_receita | numeric | Sim | - | Valor de receita |
| valor_imposto | numeric | Sim | - | Valor de imposto |
| valor_bruto | numeric | Sim | - | Valor bruto |
| descricao | text | Sim | - | Descricao |
| empresa | varchar(255) | Sim | - | Empresa |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT (date_trunc('month'::text, (p.data_vencimento)::timestamp with time zone))::date AS mes_referencia,
    cli.nome AS cliente_nome,
    TRIM(BOTH FROM p.cat) AS categoria_nome,
        CASE
            WHEN (lower((p.tipo_evento)::text) = 'receita'::text) THEN
            CASE
                WHEN ((p.cat ~~* '%ISS%'::text) OR (p.cat ~~* '%INSS%'::text) OR (p.cat ~~* '%IRRF%'::text)) THEN 'Saída'::text
                ELSE 'Entrada'::text
            END
            WHEN (lower((p.tipo_evento)::text) = 'despesa'::text) THEN 'Saída'::text
            ELSE NULL::text
        END AS tipo_fluxo,
    GREATEST(COALESCE((NULLIF(regexp_replace(split_part((p.valor_categoria)::text, ';'::text, 1), '[^0-9\.]'::text, ''::text, 'g'::text), ''::text))::numeric, (0)::numeric), COALESCE((NULLIF(regexp_replace(split_part((p.valor_categoria)::text, ';'::text, 2), '[^0-9\.]'::text, ''::text, 'g'::text), ''::text))::numeric, (0)::numeric)) AS valor_receita,
    LEAST(COALESCE((NULLIF(regexp_replace(split_part((p.valor_categoria)::text, ';'::text, 1), '[^0-9\.]'::text, ''::text, 'g'::text), ''::text))::numeric, (0)::numeric), COALESCE((NULLIF(regexp_replace(split_part((p.valor_categoria)::text, ';'::text, 2), '[^0-9\.]'::text, ''::text, 'g'::text), ''::text))::numeric, (0)::numeric)) AS valor_imposto,
    p.valor_bruto,
    p.descricao,
    p.empresa
   FROM (( SELECT p_1.id,
            p_1.status,
            p_1.versao,
            p_1.indice,
            p_1.conciliado,
            p_1.valor_pago,
            p_1.perda,
            p_1.nao_pago,
            p_1.data_vencimento,
            p_1.data_pagamento_previsto,
            p_1.descricao,
            p_1.nota,
            p_1.metodo_pagamento,
            p_1.baixa_agendada,
            p_1.valor_bruto,
            p_1.valor_liquido,
            p_1.desconto,
            p_1.multa,
            p_1.juros,
            p_1.taxa,
            p_1.id_evento,
            p_1.tipo_evento,
            p_1.id_conta_financeira,
            p_1.nome_conta_financeira,
            p_1.tipo_conta_financeira,
            p_1.id_cliente,
            p_1.url_cobranca,
            p_1.status_solicitacao_cobranca,
            p_1.data_quitacao,
            p_1.tipo_solicitacao_cobranca,
            p_1.numero_fatura,
            p_1.tipo_fatura,
            p_1.categoria_id,
            p_1.categoria_nome,
            p_1.centro_custo_id,
            p_1.centro_custo_nome,
            p_1.valor_centro_custo,
            p_1.empresa,
            p_1.nome,
            p_1.valor_categoria,
            regexp_split_to_table(p_1.categoria_nome, ';'::text) AS cat
           FROM "Conta Azul".caz_parcelas p_1
          WHERE (p_1.data_vencimento IS NOT NULL)) p
     LEFT JOIN "Conta Azul".caz_clientes cli ON (((p.id_cliente)::text = (cli.ids)::text)))
  ORDER BY ((date_trunc('month'::text, (p.data_vencimento)::timestamp with time zone))::date);
```
</details>

#### `dfc_mensal` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| mes_referencia | date | Sim | - | Mes de referencia |
| id | uuid | Sim | - | Identificador unico |
| valor_bruto | numeric | Sim | - | Valor bruto |
| data_quitacao | date | Sim | - | Data de quitacao |
| empresa | varchar(255) | Sim | - | Empresa |
| categoria_nome | text | Sim | - | Nome da categoria |
| nivel_principal | text | Sim | - | nivel principal |
| subnivel_1 | text | Sim | - | subnivel 1 |
| subnivel_2 | text | Sim | - | subnivel 2 |
| subnivel_3 | text | Sim | - | subnivel 3 |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT (date_trunc('month'::text, (data_quitacao)::timestamp with time zone))::date AS mes_referencia,
    id,
    valor_bruto,
    data_quitacao,
    empresa,
    categoria_nome,
        CASE
            WHEN (((split_part(categoria_nome, '.'::text, 1))::integer >= 3) AND ((split_part(categoria_nome, '.'::text, 1))::integer <= 4)) THEN 'RECEITA'::text
            WHEN (((split_part(categoria_nome, '.'::text, 1))::integer >= 5) AND ((split_part(categoria_nome, '.'::text, 1))::integer <= 7)) THEN 'DESPESA'::text
            ELSE 'OUTROS'::text
        END AS nivel_principal,
        CASE
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '03%'::text) THEN '3 Receitas Operacionais'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '04%'::text) THEN '4 Receitas Não Operacionais'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '05%'::text) THEN '5 Custos Operacionais'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '06%'::text) THEN '6 Despesas Operacionais'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '07%'::text) THEN '7 Despesas Não Operacionais'::text
            ELSE 'Outros'::text
        END AS subnivel_1,
        CASE
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '03.01%'::text) THEN '3.01 Receita Commerce'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '03.02%'::text) THEN '3.02 Receita Variável'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '03.03%'::text) THEN '3.03 Receita Stack Digital'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '03.04%'::text) THEN '3.04 Receita de Curso e Treinamentos'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '03.05%'::text) THEN '3.05 Receita Ventures'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '04.01%'::text) THEN '4.01 Receita Financeiras'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '04.02%'::text) THEN '4.02 Recebimento de Empréstimos'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '04.03%'::text) THEN '4.03 Outras Receitas Não Operacionais'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '05.01%'::text) THEN '5.01 Custos Diretos'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '05.02%'::text) THEN '5.02 Custos de Produção'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '05.03%'::text) THEN '5.03 Custos Administrativos'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '06.01%'::text) THEN '6.01 Despesas Administrativas'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '06.02%'::text) THEN '6.02 Despesas Comerciais'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '06.03%'::text) THEN '6.03 Despesas Financeiras'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '07.01%'::text) THEN '7.01 Despesas Não Operacionais'::text
            WHEN (split_part(categoria_nome, ' '::text, 1) ~~ '07.02%'::text) THEN '7.02 Provisões e Perdas'::text
            ELSE NULL::text
        END AS subnivel_2,
    concat(split_part(categoria_nome, ' '::text, 1), ' - ', initcap(TRIM(BOTH FROM regexp_replace(categoria_nome, '^[0-9\.]+\s*'::text, ''::text)))) AS subnivel_3
   FROM "Conta Azul".caz_parcelas p
  WHERE (data_quitacao IS NOT NULL);
```
</details>

#### `dfc_mensal_backup` (TABLE | ~4.092 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| mes_referencia | date | Sim | - | Mes de referencia |
| tipo_fluxo | text | Sim | - | tipo fluxo |
| nome_conta_financeira | varchar(100) | Sim | - | Nome da conta financeira |
| cliente_fornecedor | varchar(255) | Sim | - | cliente fornecedor |
| valor_total | numeric | Sim | - | Valor de total |
| subnivel_1 | varchar(10) | Sim | - | subnivel 1 |
| subnivel_2 | varchar(10) | Sim | - | subnivel 2 |
| subnivel_3 | varchar(20) | Sim | - | subnivel 3 |

#### `dfc_mensal_expandida` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| mes_referencia | date | Sim | - | Mes de referencia |
| id | uuid | Sim | - | Identificador unico |
| valor_bruto | numeric | Sim | - | Valor bruto |
| data_quitacao | date | Sim | - | Data de quitacao |
| empresa | varchar(255) | Sim | - | Empresa |
| categoria_nome | text | Sim | - | Nome da categoria |
| nivel_principal | text | Sim | - | nivel principal |
| subnivel_1 | text | Sim | - | subnivel 1 |
| subnivel_2 | text | Sim | - | subnivel 2 |
| subnivel_3 | text | Sim | - | subnivel 3 |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT (date_trunc('month'::text, (data_quitacao)::timestamp with time zone))::date AS mes_referencia,
    id,
    valor_bruto,
    data_quitacao,
    empresa,
    TRIM(BOTH FROM cat) AS categoria_nome,
        CASE
            WHEN (((split_part(cat, '.'::text, 1))::integer >= 3) AND ((split_part(cat, '.'::text, 1))::integer <= 4)) THEN 'RECEITA'::text
            WHEN (((split_part(cat, '.'::text, 1))::integer >= 5) AND ((split_part(cat, '.'::text, 1))::integer <= 7)) THEN 'DESPESA'::text
            ELSE 'OUTROS'::text
        END AS nivel_principal,
        CASE
            WHEN (split_part(cat, ' '::text, 1) ~~ '03%'::text) THEN '3 Receitas Operacionais'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '04%'::text) THEN '4 Receitas Não Operacionais'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '05%'::text) THEN '5 Custos Operacionais'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '06%'::text) THEN '6 Despesas Operacionais'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '07%'::text) THEN '7 Despesas Não Operacionais'::text
            ELSE 'Outros'::text
        END AS subnivel_1,
        CASE
            WHEN (split_part(cat, ' '::text, 1) ~~ '03.01%'::text) THEN '3.01 Receita Commerce'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '03.02%'::text) THEN '3.02 Receita Variável'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '03.03%'::text) THEN '3.03 Receita Stack Digital'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '03.04%'::text) THEN '3.04 Receita de Curso e Treinamentos'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '03.05%'::text) THEN '3.05 Receita Ventures'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '04.01%'::text) THEN '4.01 Receita Financeiras'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '04.02%'::text) THEN '4.02 Recebimento de Empréstimos'::text
            WHEN (split_part(cat, ' '::text, 1) ~~ '04.03%'::text) THEN '4.03 Outras Receitas Não Operacionais'::text
            ELSE NULL::text
        END AS subnivel_2,
    concat(split_part(cat, ' '::text, 1), ' - ', initcap(TRIM(BOTH FROM regexp_replace(cat, '^[0-9\.]+\s*'::text, ''::text)))) AS subnivel_3
   FROM ( SELECT p_1.id,
            p_1.status,
            p_1.versao,
            p_1.indice,
            p_1.conciliado,
            p_1.valor_pago,
            p_1.perda,
            p_1.nao_pago,
            p_1.data_vencimento,
            p_1.data_pagamento_previsto,
            p_1.descricao,
            p_1.nota,
            p_1.metodo_pagamento,
            p_1.baixa_agendada,
            p_1.valor_bruto,
            p_1.valor_liquido,
            p_1.desconto,
            p_1.multa,
            p_1.juros,
            p_1.taxa,
            p_1.id_evento,
            p_1.tipo_evento,
            p_1.id_conta_financeira,
            p_1.nome_conta_financeira,
            p_1.tipo_conta_financeira,
            p_1.id_cliente,
            p_1.url_cobranca,
            p_1.status_solicitacao_cobranca,
            p_1.data_quitacao,
            p_1.tipo_solicitacao_cobranca,
            p_1.numero_fatura,
            p_1.tipo_fatura,
            p_1.categoria_id,
            p_1.categoria_nome,
            p_1.centro_custo_id,
            p_1.centro_custo_nome,
            p_1.valor_centro_custo,
            p_1.empresa,
            p_1.nome,
            p_1.valor_categoria,
            TRIM(BOTH FROM c.c) AS cat
           FROM "Conta Azul".caz_parcelas p_1,
            LATERAL regexp_split_to_table(p_1.categoria_nome, ';'::text) c(c)
          WHERE (p_1.data_quitacao IS NOT NULL)) p
  WHERE (((split_part(cat, '.'::text, 1))::integer >= 3) AND ((split_part(cat, '.'::text, 1))::integer <= 4))
  ORDER BY data_quitacao;
```
</details>

#### `dfc_nova` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id_parcela | uuid | Sim | - | ID de parcela |
| data_ref | date | Sim | - | Data de ref |
| cat_principal | varchar(30) | Sim | - | cat principal |
| valor | numeric | Sim | - | Valor monetario |
| id_cat | text | Sim | - | ID de cat |
| descricao | text | Sim | - | Descricao |
| cliente | text | Sim | - | cliente |
| categoria_bruta | text | Sim | - | categoria bruta |
| cod_categoria | text | Sim | - | cod categoria |
| nome_categoria | text | Sim | - | nome categoria |
| subnivel_1 | text | Sim | - | subnivel 1 |
| subnivel_2 | text | Sim | - | subnivel 2 |
| subnivel_3 | text | Sim | - | subnivel 3 |

<details>
<summary>Definicao SQL da View</summary>

```sql
WITH raw AS (
         SELECT r.id AS id_parcela,
            r.data_quitacao AS data_ref,
            r.tipo_evento AS cat_principal,
            r.valor_pago AS valor,
            r.categoria_nome,
            split_part(r.categoria_id, ';'::text, 1) AS id_cat,
            r.descricao,
            (r.id_cliente)::text AS cliente,
            TRIM(BOTH FROM replace(replace(cat.cat, '	'::text, ' '::text), '  '::text, ' '::text)) AS cat_clean,
            split_part(TRIM(BOTH FROM cat.cat), '.'::text, 1) AS cat_prefix
           FROM ("Conta Azul".caz_parcelas r
             CROSS JOIN LATERAL regexp_split_to_table(r.categoria_nome, ';'::text) cat(cat))
          WHERE (r.data_quitacao IS NOT NULL)
        ), flags AS (
         SELECT raw.id_parcela,
            bool_or((raw.cat_prefix = ANY (ARRAY['03'::text, '04'::text]))) AS has_receita_cat
           FROM raw
          GROUP BY raw.id_parcela
        ), filtered AS (
         SELECT r.id_parcela,
            r.data_ref,
            r.cat_principal,
            r.valor,
            r.categoria_nome,
            r.id_cat,
            r.descricao,
            r.cliente,
            r.cat_clean,
            r.cat_prefix,
            f.has_receita_cat
           FROM (raw r
             JOIN flags f USING (id_parcela))
          WHERE ((f.has_receita_cat AND (r.cat_prefix = ANY (ARRAY['03'::text, '04'::text]))) OR (NOT f.has_receita_cat))
        ), split_cats AS (
         SELECT filtered.id_parcela,
            filtered.data_ref,
            filtered.cat_principal,
            filtered.valor,
            filtered.categoria_nome,
            filtered.id_cat,
            filtered.descricao,
            filtered.cliente,
            filtered.cat_clean,
            filtered.cat_prefix,
            filtered.has_receita_cat,
            split_part(filtered.cat_clean, ' '::text, 1) AS cod_categoria,
            regexp_replace(filtered.cat_clean, '^[0-9\.]+\s*'::text, ''::text) AS nome_categoria
           FROM filtered
        )
 SELECT id_parcela,
    data_ref,
    cat_principal,
    valor,
    id_cat,
    descricao,
    cliente,
    cat_clean AS categoria_bruta,
    cod_categoria,
    nome_categoria,
        CASE
            WHEN (split_part(cod_categoria, '.'::text, 1) = '03'::text) THEN '03 Receitas Operacionais'::text
            WHEN (split_part(cod_categoria, '.'::text, 1) = '04'::text) THEN '04 Receitas Não Operacionais'::text
            WHEN (split_part(cod_categoria, '.'::text, 1) = '05'::text) THEN '05 Custos Operacionais'::text
            WHEN (split_part(cod_categoria, '.'::text, 1) = '06'::text) THEN '06 Despesas Operacionais'::text
            WHEN (split_part(cod_categoria, '.'::text, 1) = '07'::text) THEN '07 Despesas Não Operacionais'::text
            ELSE split_part(cod_categoria, '.'::text, 1)
        END AS subnivel_1,
        CASE
            WHEN (concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)) ~~ '03.%'::text) THEN concat_ws(' '::text, concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)), nome_categoria)
            WHEN (concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)) ~~ '04.%'::text) THEN concat_ws(' '::text, concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)), nome_categoria)
            WHEN (concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)) ~~ '05.%'::text) THEN concat_ws(' '::text, concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)), nome_categoria)
            WHEN (concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)) ~~ '06.%'::text) THEN concat_ws(' '::text, concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2)), nome_categoria)
            ELSE concat_ws('.'::text, split_part(cod_categoria, '.'::text, 1), split_part(cod_categoria, '.'::text, 2))
        END AS subnivel_2,
    concat_ws(' '::text, cod_categoria, nome_categoria) AS subnivel_3
   FROM split_cats;
```
</details>

#### `dfc_nova_com_hierarquia` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| data_ref | date | Sim | - | Data de ref |
| cat_principal | varchar(30) | Sim | - | cat principal |
| valor | numeric | Sim | - | Valor monetario |
| cod_categoria | text | Sim | - | cod categoria |
| nome_categoria | text | Sim | - | nome categoria |
| categoria_exibicao | text | Sim | - | categoria exibicao |

<details>
<summary>Definicao SQL da View</summary>

```sql
WITH raw AS (
         SELECT r.id,
            r.data_quitacao AS data_ref,
            r.tipo_evento AS cat_principal,
            r.valor_pago AS valor,
            TRIM(BOTH FROM replace(replace(cat.cat, '	'::text, ' '::text), '  '::text, ' '::text)) AS cat_clean,
            split_part(TRIM(BOTH FROM cat.cat), '.'::text, 1) AS cat_prefix
           FROM ("Conta Azul".caz_parcelas r
             CROSS JOIN LATERAL regexp_split_to_table(r.categoria_nome, ';'::text) cat(cat))
          WHERE (r.data_quitacao IS NOT NULL)
        ), flags AS (
         SELECT raw.id,
            bool_or((raw.cat_prefix = ANY (ARRAY['03'::text, '04'::text]))) AS has_receita_cat
           FROM raw
          GROUP BY raw.id
        ), filtered AS (
         SELECT r.id,
            r.data_ref,
            r.cat_principal,
            r.valor,
            r.cat_clean,
            r.cat_prefix,
            f.has_receita_cat
           FROM (raw r
             JOIN flags f USING (id))
          WHERE ((f.has_receita_cat AND (r.cat_prefix = ANY (ARRAY['03'::text, '04'::text]))) OR (NOT f.has_receita_cat))
        ), split_cats AS (
         SELECT filtered.id,
            filtered.data_ref,
            filtered.cat_principal,
            filtered.valor,
            filtered.cat_clean,
            filtered.cat_prefix,
            filtered.has_receita_cat,
            split_part(filtered.cat_clean, ' '::text, 1) AS cod_categoria,
            regexp_replace(filtered.cat_clean, '^[0-9\.]+\s*'::text, ''::text) AS nome_categoria
           FROM filtered
        ), nivel_real AS (
         SELECT split_cats.data_ref,
            split_cats.cat_principal,
            split_cats.valor,
            split_cats.cod_categoria,
            split_cats.nome_categoria,
            split_part(split_cats.cod_categoria, '.'::text, 1) AS cod_1,
            concat_ws('.'::text, split_part(split_cats.cod_categoria, '.'::text, 1), split_part(split_cats.cod_categoria, '.'::text, 2)) AS cod_2
           FROM split_cats
        ), nivel_pai_2 AS (
         SELECT DISTINCT nivel_real.data_ref,
            nivel_real.cat_principal,
            0 AS valor,
            nivel_real.cod_2 AS cod_categoria,
            NULL::text AS nome_categoria,
            split_part(nivel_real.cod_2, '.'::text, 1) AS cod_1,
            nivel_real.cod_2
           FROM nivel_real
          WHERE ((nivel_real.cod_2 IS NOT NULL) AND (nivel_real.cod_2 <> ''::text))
        ), nivel_pai_1 AS (
         SELECT DISTINCT nivel_real.data_ref,
            nivel_real.cat_principal,
            0 AS valor,
            nivel_real.cod_1 AS cod_categoria,
            NULL::text AS nome_categoria,
            nivel_real.cod_1,
            nivel_real.cod_1 AS cod_2
           FROM nivel_real
        ), union_all_levels AS (
         SELECT nivel_real.data_ref,
            nivel_real.cat_principal,
            nivel_real.valor,
            nivel_real.cod_categoria,
            nivel_real.nome_categoria,
            nivel_real.cod_1,
            nivel_real.cod_2
           FROM nivel_real
        UNION
         SELECT nivel_pai_2.data_ref,
            nivel_pai_2.cat_principal,
            nivel_pai_2.valor,
            nivel_pai_2.cod_categoria,
            nivel_pai_2.nome_categoria,
            nivel_pai_2.cod_1,
            nivel_pai_2.cod_2
           FROM nivel_pai_2
        UNION
         SELECT nivel_pai_1.data_ref,
            nivel_pai_1.cat_principal,
            nivel_pai_1.valor,
            nivel_pai_1.cod_categoria,
            nivel_pai_1.nome_categoria,
            nivel_pai_1.cod_1,
            nivel_pai_1.cod_2
           FROM nivel_pai_1
        )
 SELECT DISTINCT data_ref,
    cat_principal,
    valor,
    cod_categoria,
    COALESCE(nome_categoria,
        CASE
            WHEN (cod_categoria ~~ '03%'::text) THEN 'Receitas Operacionais'::text
            WHEN (cod_categoria ~~ '04%'::text) THEN 'Receitas Não Operacionais'::text
            WHEN (cod_categoria ~~ '05%'::text) THEN 'Custos Operacionais'::text
            WHEN (cod_categoria ~~ '06%'::text) THEN 'Despesas Operacionais'::text
            WHEN (cod_categoria ~~ '07%'::text) THEN 'Despesas Não Operacionais'::text
            ELSE 'Outros'::text
        END) AS nome_categoria,
    concat_ws(' '::text, cod_categoria, COALESCE(nome_categoria,
        CASE
            WHEN (cod_categoria ~~ '03%'::text) THEN 'Receitas Operacionais'::text
            WHEN (cod_categoria ~~ '04%'::text) THEN 'Receitas Não Operacionais'::text
            WHEN (cod_categoria ~~ '05%'::text) THEN 'Custos Operacionais'::text
            WHEN (cod_categoria ~~ '06%'::text) THEN 'Despesas Operacionais'::text
            WHEN (cod_categoria ~~ '07%'::text) THEN 'Despesas Não Operacionais'::text
            ELSE 'Outros'::text
        END)) AS categoria_exibicao
   FROM union_all_levels;
```
</details>

#### `dfc_snapshots` (TABLE | ~1 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.dfc_snapshots_id...` | Identificador unico |
| mes_ano | varchar(7) | Nao | - | Mes/Ano de referencia |
| data_snapshot | timestamp | Nao | `now()` | Data de snapshot |
| saldo_inicial | numeric(15) | Nao | - | saldo inicial |
| dados_diarios | jsonb | Nao | - | dados diarios |
| created_at | timestamp | Nao | `now()` | Data de criacao |

**Indexes:**
- `dfc_snapshots_mes_ano_key`: UNIQUE INDEX dfc_snapshots_mes_ano_key ON cortex_core.dfc_snapshots USING btree (mes_ano)
- `idx_dfc_snapshots_mes_ano`: INDEX idx_dfc_snapshots_mes_ano ON cortex_core.dfc_snapshots USING btree (mes_ano)

#### `faturas` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.faturas_id_seq':...` | Identificador unico |
| numero_fatura | varchar(50) | Nao | - | Numero da fatura |
| cliente_id | int | Sim | - | ID do cliente |
| contrato_id | int | Sim | - | ID do contrato |
| valor_total | numeric(12) | Sim | `0` | Valor de total |
| valor_desconto | numeric(12) | Sim | `0` | Valor de desconto |
| valor_liquido | numeric(12) | Sim | `0` | Valor liquido |
| data_emissao | date | Sim | - | Data de emissao |
| data_vencimento | date | Sim | - | Data de vencimento |
| data_pagamento | date | Sim | - | Data de pagamento |
| status | varchar(30) | Sim | `'pendente'::character varying` | Status atual |
| forma_pagamento | varchar(50) | Sim | - | forma pagamento |
| observacoes | text | Sim | - | Observacoes |
| conta_azul_id | varchar(100) | Sim | - | ID de conta azul |
| conta_azul_status | varchar(50) | Sim | - | conta azul status |
| conta_azul_sync_date | timestamp | Sim | - | conta azul sync date |
| url_boleto | text | Sim | - | url boleto |
| url_pix | text | Sim | - | url pix |
| usuario_criacao | int | Sim | - | usuario criacao |
| modalidade | varchar(50) | Sim | - | modalidade |
| status_geracao | varchar(50) | Sim | - | status geracao |
| proximo_vencimento | date | Sim | - | proximo vencimento |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**🔗 Foreign Keys:**
- `contrato_id` → `cortex_core.contratos.id`
- `cliente_id` → `cortex_core.entidades.id`

#### `faturas_itens` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.faturas_itens_id...` | Identificador unico |
| fatura_id | int | Sim | - | ID de fatura |
| contrato_item_id | int | Sim | - | ID de contrato item |
| descricao | text | Sim | - | Descricao |
| quantidade | int | Sim | `1` | quantidade |
| valor_unitario | numeric(12) | Sim | `0` | Valor de unitario |
| valor_total | numeric(12) | Sim | `0` | Valor de total |
| periodo_inicio | date | Sim | - | periodo inicio |
| periodo_fim | date | Sim | - | periodo fim |
| modalidade_servico | varchar(50) | Sim | - | modalidade servico |

**🔗 Foreign Keys:**
- `fatura_id` → `cortex_core.faturas.id`
- `contrato_item_id` → `cortex_core.contratos_itens.id`

#### `inadimplencia_contextos` (TABLE | ~127 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.inadimplencia_co...` | Identificador unico |
| cliente_id | varchar(255) | Nao | - | ID do cliente |
| contexto | text | Sim | - | contexto |
| evidencias | text | Sim | - | evidencias |
| acao | varchar(50) | Nao | - | acao |
| atualizado_por | varchar(255) | Nao | - | atualizado por |
| atualizado_em | timestamp | Sim | `now()` | Data/hora de atualizado |
| status_financeiro | varchar(30) | Sim | - | status financeiro |
| detalhe_financeiro | text | Sim | - | detalhe financeiro |
| contexto_juridico | text | Sim | - | contexto juridico |
| procedimento_juridico | varchar(50) | Sim | - | procedimento juridico |
| status_juridico | varchar(50) | Sim | - | status juridico |
| atualizado_juridico_por | varchar(255) | Sim | - | atualizado juridico por |
| atualizado_juridico_em | timestamp | Sim | - | Data/hora de atualizado juridico |
| valor_acordado | text | Sim | - | Valor de acordado |
| tipo_inadimplencia | text | Sim | - | tipo inadimplencia |

**Indexes:**
- `idx_inadimplencia_contextos_cliente_id`: INDEX idx_inadimplencia_contextos_cliente_id ON cortex_core.inadimplencia_contextos USING btree (cliente_id)
- `inadimplencia_contextos_cliente_id_key`: UNIQUE INDEX inadimplencia_contextos_cliente_id_key ON cortex_core.inadimplencia_contextos USING btree (cliente_id)

### Metricas e KPIs

#### `kr_checkins` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.kr_checkins_id_s...` | Identificador unico |
| kr_id | varchar(50) | Nao | - | ID de kr |
| year | int | Nao | - | year |
| period_type | varchar(10) | Nao | - | period type |
| period_value | varchar(10) | Nao | - | period value |
| confidence | int | Nao | `50` | confidence |
| commentary | text | Sim | - | commentary |
| blockers | text | Sim | - | blockers |
| next_actions | text | Sim | - | next actions |
| created_by | varchar(100) | Sim | - | Criado por |
| created_at | timestamp | Sim | `now()` | Data de criacao |

#### `metric_actual_overrides_monthly` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.metric_actual_ov...` | Identificador unico |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| year | int | Nao | - | year |
| month | varchar(7) | Nao | - | month |
| dimension_key | varchar(50) | Sim | - | Chave de dimension |
| dimension_value | varchar(100) | Sim | - | dimension value |
| actual_value | numeric(18) | Nao | - | actual value |
| notes | text | Sim | - | notes |
| updated_by | varchar(100) | Sim | - | updated by |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `metric_actual_overrides_month_metric_key_year_month_dimensi_key`: UNIQUE INDEX metric_actual_overrides_month_metric_key_year_month_dimensi_key ON cortex_core.metric_actual_overrides_monthly USING btree (metric_key, year, month, dimension_key, dimension_value)

#### `metric_actuals_monthly` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.metric_actuals_m...` | Identificador unico |
| year | int | Nao | - | year |
| month | int | Nao | - | month |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| dimension_key | varchar(100) | Sim | `NULL::character varying` | Chave de dimension |
| dimension_value | varchar(255) | Sim | `NULL::character varying` | dimension value |
| actual_value | numeric(18) | Sim | - | actual value |
| calculated_at | timestamp | Sim | `now()` | Data/hora de calculated |
| source | varchar(100) | Sim | - | source |

**Indexes:**
- `metric_actuals_monthly_year_month_metric_key_dimension_key__key`: UNIQUE INDEX metric_actuals_monthly_year_month_metric_key_dimension_key__key ON cortex_core.metric_actuals_monthly USING btree (year, month, metric_key, dimension_key, dimension_value)

#### `metric_overrides_monthly` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.metric_overrides...` | Identificador unico |
| year | int | Nao | - | year |
| month | int | Nao | - | month |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| dimension_key | varchar(100) | Sim | `''::character varying` | Chave de dimension |
| dimension_value | varchar(255) | Sim | `''::character varying` | dimension value |
| override_value | numeric(18) | Nao | - | override value |
| note | text | Sim | - | note |
| updated_by | varchar(255) | Sim | - | updated by |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `metric_overrides_monthly_year_month_metric_key_dimension_ke_key`: UNIQUE INDEX metric_overrides_monthly_year_month_metric_key_dimension_ke_key ON cortex_core.metric_overrides_monthly USING btree (year, month, metric_key, dimension_key, dimension_value)

#### `metric_rulesets` (TABLE | ~2 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.metric_rulesets_...` | Identificador unico |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| display_label | varchar(200) | Nao | - | display label |
| default_color | varchar(50) | Sim | `'default'::character varying` | default color |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |
| updated_by | varchar(200) | Sim | - | updated by |

**Indexes:**
- `metric_rulesets_metric_key_key`: UNIQUE INDEX metric_rulesets_metric_key_key ON cortex_core.metric_rulesets USING btree (metric_key)

#### `metric_targets_monthly` (TABLE | ~2.079 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.metric_targets_m...` | Identificador unico |
| year | int | Nao | - | year |
| month | int | Nao | - | month |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| dimension_key | varchar(100) | Sim | `NULL::character varying` | Chave de dimension |
| dimension_value | varchar(255) | Sim | `NULL::character varying` | dimension value |
| target_value | numeric(18) | Nao | - | target value |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `metric_targets_monthly_year_month_metric_key_dimension_key__key`: UNIQUE INDEX metric_targets_monthly_year_month_metric_key_dimension_key__key ON cortex_core.metric_targets_monthly USING btree (year, month, metric_key, dimension_key, dimension_value)

#### `metric_thresholds` (TABLE | ~5 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.metric_threshold...` | Identificador unico |
| ruleset_id | int | Nao | - | ID de ruleset |
| min_value | numeric | Sim | - | min value |
| max_value | numeric | Sim | - | max value |
| color | varchar(50) | Nao | `'default'::character varying` | Cor |
| label | varchar(200) | Sim | - | Label/rotulo |
| sort_order | int | Sim | `0` | Ordem de exibicao |

**🔗 Foreign Keys:**
- `ruleset_id` → `cortex_core.metric_rulesets.id`

**Indexes:**
- `idx_metric_thresholds_ruleset`: INDEX idx_metric_thresholds_ruleset ON cortex_core.metric_thresholds USING btree (ruleset_id)

#### `metrics_registry_extended` (TABLE | ~38 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.metrics_registry...` | Identificador unico |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| title | varchar(255) | Nao | - | Titulo |
| unit | varchar(20) | Nao | - | unit |
| period_type | varchar(20) | Nao | - | period type |
| direction | varchar(10) | Nao | - | direction |
| is_derived | bool | Sim | `false` | Flag: derived |
| formula_expr | text | Sim | - | formula expr |
| tolerance | numeric(10) | Sim | `0.10` | tolerance |
| dimension_key | varchar(100) | Sim | - | Chave de dimension |
| dimension_value | varchar(255) | Sim | - | dimension value |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `metrics_registry_extended_metric_key_key`: UNIQUE INDEX metrics_registry_extended_metric_key_key ON cortex_core.metrics_registry_extended USING btree (metric_key)

#### `sales_goals` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.sales_goals_id_s...` | Identificador unico |
| goal_type | varchar(50) | Nao | - | goal type |
| goal_key | varchar(100) | Nao | - | Chave de goal |
| goal_value | numeric(15) | Nao | - | goal value |
| period_month | int | Sim | - | period month |
| period_year | int | Sim | - | period year |
| updated_by | varchar(255) | Sim | - | updated by |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `idx_sales_goals_type_key`: INDEX idx_sales_goals_type_key ON cortex_core.sales_goals USING btree (goal_type, goal_key)
- `sales_goals_goal_type_goal_key_period_month_period_year_key`: UNIQUE INDEX sales_goals_goal_type_goal_key_period_month_period_year_key ON cortex_core.sales_goals USING btree (goal_type, goal_key, period_month, period_year)

#### `squad_goals` (TABLE | ~16 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.squad_goals_id_s...` | Identificador unico |
| squad | text | Nao | - | Squad/equipe |
| perspective | text | Nao | - | perspective |
| metric_name | text | Nao | - | metric name |
| unit | text | Sim | `'number'::text` | unit |
| periodicity | text | Sim | `'monthly'::text` | periodicity |
| data_source | text | Sim | - | Data de source |
| owner_team | text | Sim | - | owner team |
| actual_value | numeric(18) | Sim | - | actual value |
| target_value | numeric(18) | Sim | - | target value |
| score | numeric(5) | Sim | - | Pontuacao |
| weight | numeric(5) | Sim | `1` | weight |
| notes | text | Sim | - | notes |
| year | int | Sim | `2026` | year |
| quarter | int | Sim | - | quarter |
| month | int | Sim | - | month |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

#### `squad_metas` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.squad_metas_id_s...` | Identificador unico |
| squad | text | Nao | - | Squad/equipe |
| ano | int | Nao | - | ano |
| mes | int | Nao | - | mes |
| meta_mrr | numeric(15) | Nao | `0` | meta mrr |
| meta_contratos | int | Sim | `0` | meta contratos |
| observacoes | text | Sim | - | Observacoes |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |
| created_by | text | Sim | - | Criado por |

**Indexes:**
- `squad_metas_squad_ano_mes_key`: UNIQUE INDEX squad_metas_squad_ano_mes_key ON cortex_core.squad_metas USING btree (squad, ano, mes)

#### `turbodash_kpis` (TABLE | ~2 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.turbodash_kpis_i...` | Identificador unico |
| cnpj | varchar(20) | Nao | - | CNPJ do cliente |
| cliente_nome | varchar(255) | Sim | - | Nome de cliente |
| cliente_id_cortex | int | Sim | - | cliente id cortex |
| periodo_inicio | date | Nao | - | periodo inicio |
| periodo_fim | date | Nao | - | periodo fim |
| faturamento | numeric(18) | Sim | - | faturamento |
| faturamento_variacao | numeric(8) | Sim | - | faturamento variacao |
| investimento | numeric(18) | Sim | - | investimento |
| investimento_variacao | numeric(8) | Sim | - | investimento variacao |
| roas | numeric(10) | Sim | - | roas |
| roas_variacao | numeric(8) | Sim | - | roas variacao |
| compras | int | Sim | - | compras |
| compras_variacao | numeric(8) | Sim | - | compras variacao |
| cpa | numeric(12) | Sim | - | cpa |
| cpa_variacao | numeric(8) | Sim | - | cpa variacao |
| ticket_medio | numeric(12) | Sim | - | ticket medio |
| ticket_medio_variacao | numeric(8) | Sim | - | ticket medio variacao |
| sessoes | int | Sim | - | sessoes |
| sessoes_variacao | numeric(8) | Sim | - | sessoes variacao |
| cps | numeric(12) | Sim | - | cps |
| cps_variacao | numeric(8) | Sim | - | cps variacao |
| taxa_conversao | numeric(8) | Sim | - | taxa conversao |
| taxa_conversao_variacao | numeric(8) | Sim | - | taxa conversao variacao |
| taxa_recorrencia | numeric(8) | Sim | - | taxa recorrencia |
| taxa_recorrencia_variacao | numeric(8) | Sim | - | taxa recorrencia variacao |
| sync_status | varchar(20) | Nao | `'fresh'::character varying` | sync status |
| last_synced_at | timestamp | Sim | `now()` | Data/hora de last synced |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `idx_turbodash_kpis_cliente_id`: INDEX idx_turbodash_kpis_cliente_id ON cortex_core.turbodash_kpis USING btree (cliente_id_cortex)
- `idx_turbodash_kpis_cnpj`: INDEX idx_turbodash_kpis_cnpj ON cortex_core.turbodash_kpis USING btree (cnpj)

### Dashboards e Notificacoes

#### `dashboard_cards` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.dashboard_cards_...` | Identificador unico |
| view_key | varchar(50) | Nao | - | Chave de view |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| position | int | Nao | `0` | position |
| size | varchar(10) | Nao | `'md'::character varying` | size |
| show_trend | bool | Nao | `true` | show trend |
| trend_months | int | Nao | `6` | trend months |
| show_ytd | bool | Nao | `true` | show ytd |
| show_variance | bool | Nao | `true` | show variance |
| show_status | bool | Nao | `true` | show status |
| created_at | timestamp | Sim | `now()` | Data de criacao |

#### `dashboard_views` (TABLE | ~4 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.dashboard_views_...` | Identificador unico |
| key | varchar(50) | Nao | - | key |
| name | varchar(200) | Nao | - | Nome |
| description | text | Sim | - | Descricao |
| is_active | bool | Nao | `true` | Se esta ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `dashboard_views_key_key`: UNIQUE INDEX dashboard_views_key_key ON cortex_core.dashboard_views USING btree (key)

#### `notification_rules` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.notification_rul...` | Identificador unico |
| rule_type | text | Nao | - | rule type |
| name | text | Nao | - | Nome |
| description | text | Sim | - | Descricao |
| is_enabled | bool | Sim | `true` | Flag: enabled |
| config | text | Sim | - | config |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

#### `notifications` (TABLE | ~5.427 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.notifications_id...` | Identificador unico |
| type | text | Nao | - | type |
| title | text | Nao | - | Titulo |
| message | text | Nao | - | message |
| entity_id | text | Sim | - | ID de entity |
| entity_type | text | Sim | - | entity type |
| read | bool | Sim | `false` | read |
| dismissed | bool | Sim | `false` | dismissed |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| expires_at | timestamp | Sim | - | Data de expiracao |
| unique_key | text | Sim | - | Chave de unique |
| priority | text | Sim | `'medium'::text` | priority |

**Indexes:**
- `notifications_unique_key_key`: UNIQUE INDEX notifications_unique_key_key ON cortex_core.notifications USING btree (unique_key)

#### `turbo_avisos` (TABLE | ~1 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.turbo_avisos_id_...` | Identificador unico |
| titulo | text | Nao | - | titulo |
| mensagem | text | Nao | - | mensagem |
| tipo | text | Nao | `'info'::text` | Tipo |
| cor | text | Sim | `'#f97316'::text` | cor |
| icone | text | Sim | - | icone |
| link_texto | text | Sim | - | link texto |
| link_url | text | Sim | - | link url |
| ativo | bool | Nao | `true` | ativo |
| ordem | int | Nao | `0` | ordem |
| data_inicio | timestamp | Sim | - | Data de inicio |
| data_fim | timestamp | Sim | - | Data de fim |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| atualizado_em | timestamp | Sim | `now()` | Data/hora de atualizado |
| criado_por | text | Sim | - | criado por |

#### `turbo_eventos` (TABLE | ~16 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.turbo_eventos_id...` | Identificador unico |
| titulo | varchar(255) | Nao | - | titulo |
| descricao | text | Sim | - | Descricao |
| tipo | varchar(50) | Nao | `'outro'::character varying` | Tipo |
| data_inicio | timestamptz | Nao | - | Data de inicio |
| data_fim | timestamptz | Sim | - | Data de fim |
| local | varchar(255) | Sim | - | local |
| organizador_id | int | Sim | - | ID de organizador |
| organizador_nome | varchar(255) | Sim | - | Nome de organizador |
| cor | varchar(20) | Sim | - | cor |
| criado_em | timestamptz | Sim | `now()` | Data/hora de criado |
| criado_por | varchar(255) | Sim | - | criado por |

#### `turbo_tools` (TABLE | ~152 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| name | text | Nao | - | Nome |
| login | text | Sim | - | login |
| password | text | Sim | - | password |
| site | text | Sim | - | site |
| observations | text | Sim | - | observations |
| valor | text | Sim | - | Valor monetario |
| recorrencia | enum | Sim | - | recorrencia |
| data_primeiro_pagamento | timestamp | Sim | - | Data de primeiro pagamento |
| created_by | uuid | Sim | - | Criado por |
| created_at | timestamp | Nao | `now()` | Data de criacao |
| updated_at | timestamp | Nao | `now()` | Data de atualizacao |

**Indexes:**
- `turbo_tools_name_idx`: INDEX turbo_tools_name_idx ON cortex_core.turbo_tools USING btree (name)

### Onboarding

#### `onboarding_colaborador` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.onboarding_colab...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| template_id | int | Nao | - | ID de template |
| data_inicio | date | Nao | - | Data de inicio |
| status | varchar(20) | Nao | `'pending'::character varying` | Status atual |
| created_at | timestamp | Sim | `now()` | Data de criacao |

#### `onboarding_etapas` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.onboarding_etapa...` | Identificador unico |
| template_id | int | Nao | - | ID de template |
| nome | varchar(100) | Nao | - | Nome |
| ordem | int | Nao | - | ordem |
| descricao | text | Sim | - | Descricao |
| responsavel_padrao | varchar(100) | Sim | - | responsavel padrao |
| prazo_dias | int | Sim | - | prazo dias |
| titulo | varchar(100) | Sim | - | titulo |

#### `onboarding_progresso` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.onboarding_progr...` | Identificador unico |
| onboarding_colaborador_id | int | Nao | - | ID de onboarding colaborador |
| etapa_id | int | Nao | - | ID de etapa |
| status | varchar(20) | Nao | `'pending'::character varying` | Status atual |
| responsavel_id | int | Sim | - | ID de responsavel |
| data_conclusao | timestamp | Sim | - | Data de conclusao |
| observacoes | text | Sim | - | Observacoes |

#### `onboarding_templates` (TABLE | ~1 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.onboarding_templ...` | Identificador unico |
| nome | varchar(100) | Nao | - | Nome |
| descricao | text | Sim | - | Descricao |
| ativo | bool | Sim | `true` | ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |

### Assinatura Digital

#### `assinafy_config` (TABLE | ~2 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.assinafy_config_...` | Identificador unico |
| account_id | varchar(255) | Sim | - | ID de account |
| api_key | varchar(255) | Sim | - | Chave de api |
| api_url | varchar(255) | Sim | - | api url |
| webhook_url | varchar(255) | Sim | - | webhook url |
| webhook_secret | varchar(255) | Sim | - | webhook secret |
| ativo | bool | Sim | `true` | ativo |
| data_cadastro | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de cadastro |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| tipo | varchar(50) | Sim | `'clientes'::character varying` | Tipo |

### Documentos

#### `document_status_changes` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.document_status_...` | Identificador unico |
| contrato_id | int | Sim | - | ID do contrato |
| document_id | varchar(255) | Sim | - | ID de document |
| status_anterior | varchar(50) | Sim | - | status anterior |
| status_novo | varchar(50) | Sim | - | status novo |
| webhook_data | jsonb | Sim | - | webhook data |
| data_mudanca | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de mudanca |

**🔗 Foreign Keys:**
- `contrato_id` → `cortex_core.contratos.id`

### Juridico

#### `juridico_regras_escalonamento` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.juridico_regras_...` | Identificador unico |
| dias_atraso_min | int | Nao | - | dias atraso min |
| dias_atraso_max | int | Sim | - | dias atraso max |
| procedimento_sugerido | text | Nao | - | procedimento sugerido |
| prioridade | int | Nao | `1` | prioridade |
| ativo | bool | Nao | `true` | ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |

### Sistema e Auditoria

#### `audit_log` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.audit_log_id_seq...` | Identificador unico |
| usuario_id | int | Sim | - | ID de usuario |
| modulo | varchar(100) | Sim | - | modulo |
| acao | varchar(100) | Sim | - | acao |
| tabela_afetada | varchar(100) | Sim | - | tabela afetada |
| registro_id | int | Sim | - | ID de registro |
| dados_anteriores | jsonb | Sim | - | dados anteriores |
| dados_novos | jsonb | Sim | - | dados novos |
| ip_address | varchar(50) | Sim | - | Endereco IP |
| user_agent | text | Sim | - | User agent do navegador |
| data_acao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de acao |

#### `data_reconciliation` (TABLE | ~2 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.data_reconciliat...` | Identificador unico |
| timestamp | timestamp | Sim | `now()` | timestamp |
| entity_type | varchar(100) | Sim | - | entity type |
| source_system | varchar(100) | Sim | - | source system |
| target_system | varchar(100) | Sim | - | target system |
| discrepancy_type | varchar(100) | Sim | - | discrepancy type |
| source_id | varchar(100) | Sim | - | ID de source |
| target_id | varchar(100) | Sim | - | ID de target |
| entity_name | varchar(200) | Sim | - | entity name |
| source_value | text | Sim | - | source value |
| target_value | text | Sim | - | target value |
| severity | varchar(20) | Sim | `'medium'::character varying` | severity |
| status | varchar(50) | Sim | `'pending'::character varying` | Status atual |
| resolved_at | timestamp | Sim | - | Data/hora de resolved |
| resolved_by | varchar(100) | Sim | - | resolved by |
| notes | text | Sim | - | notes |

#### `sync_logs` (TABLE | ~6 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.sync_logs_id_seq...` | Identificador unico |
| integration | varchar(100) | Nao | - | integration |
| operation | varchar(100) | Sim | - | operation |
| status | varchar(50) | Nao | - | Status atual |
| started_at | timestamp | Sim | `now()` | Data/hora de started |
| completed_at | timestamp | Sim | - | Data/hora de completed |
| records_processed | int | Sim | `0` | records processed |
| records_created | int | Sim | `0` | records created |
| records_updated | int | Sim | `0` | records updated |
| records_failed | int | Sim | `0` | records failed |
| error_message | text | Sim | - | error message |
| triggered_by | varchar(100) | Sim | - | triggered by |
| duration_ms | int | Sim | - | duration ms |

#### `system_field_options` (TABLE | ~35 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.system_field_opt...` | Identificador unico |
| field_type | text | Nao | - | field type |
| value | text | Nao | - | value |
| label | text | Nao | - | Label/rotulo |
| color | text | Sim | - | Cor |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| is_active | bool | Sim | `true` | Se esta ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `system_field_options_field_type_value_key`: UNIQUE INDEX system_field_options_field_type_value_key ON cortex_core.system_field_options USING btree (field_type, value)

#### `system_fields` (TABLE | ~31 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.system_fields_id...` | Identificador unico |
| field_key | varchar(100) | Nao | - | Chave de field |
| label | varchar(255) | Nao | - | Label/rotulo |
| entity | varchar(50) | Nao | - | entity |
| field_type | varchar(50) | Nao | - | field type |
| required | bool | Sim | `false` | required |
| default_value | text | Sim | - | default value |
| enum_catalog | varchar(100) | Sim | - | enum catalog |
| validation_rules | jsonb | Sim | - | validation rules |
| help_text | text | Sim | - | help text |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `system_fields_field_key_key`: UNIQUE INDEX system_fields_field_key_key ON cortex_core.system_fields USING btree (field_key)

#### `system_logs` (TABLE | ~4 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.system_logs_id_s...` | Identificador unico |
| timestamp | timestamp | Sim | `now()` | timestamp |
| method | varchar(10) | Sim | - | method |
| endpoint | varchar(500) | Sim | - | endpoint |
| status_code | int | Sim | - | status code |
| response_time_ms | int | Sim | - | response time ms |
| user_id | varchar(100) | Sim | - | ID do usuario |
| user_email | varchar(200) | Sim | - | user email |
| ip_address | varchar(50) | Sim | - | Endereco IP |
| user_agent | text | Sim | - | User agent do navegador |

#### `validation_rules` (TABLE | ~7 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 rule_id | varchar(100) | Nao | - | ID de rule |
| name | varchar(255) | Nao | - | Nome |
| entity | varchar(50) | Nao | - | entity |
| when_condition | jsonb | Sim | `'{}'::jsonb` | when condition |
| action | jsonb | Sim | `'{}'::jsonb` | action |
| message | text | Sim | - | message |
| active | bool | Sim | `true` | Ativo/Inativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

### ClickUp (Copia Local)

#### `cup_cnpj` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id_cup | text | Sim | - | ID de cup |
| id_caz | text | Sim | - | ID de caz |
| cnpj | text | Sim | - | CNPJ do cliente |
| nome | text | Sim | - | Nome |
| statusconta | text | Sim | - | statusconta |
| csresponsavel | text | Sim | - | csresponsavel |

<details>
<summary>Definicao SQL da View</summary>

```sql
WITH campos_filtrados AS (
         SELECT ct.id AS id_cup,
            ct.name,
            regexp_replace((fields.value ->> 'value'::text), '[^0-9]'::text, ''::text, 'g'::text) AS cnpj,
            ( SELECT (option.value ->> 'name'::text)
                   FROM (jsonb_array_elements((ct.custom_fields)::jsonb) field(value)
                     CROSS JOIN LATERAL jsonb_array_elements(((field.value -> 'type_config'::text) -> 'options'::text)) option(value))
                  WHERE (((field.value ->> 'id'::text) = 'bea467ac-244d-4f2a-ac35-62019e8f6bea'::text) AND (((field.value ->> 'value'::text))::integer = ((option.value ->> 'orderindex'::text))::integer))) AS statusconta,
            ( SELECT (jsonb_array_elements((field.value -> 'value'::text)) ->> 'username'::text)
                   FROM jsonb_array_elements((ct.custom_fields)::jsonb) field(value)
                  WHERE ((field.value ->> 'id'::text) = '5df72d40-b3ca-44d1-a174-eea9f85c239f'::text)
                 LIMIT 1) AS csresponsavel
           FROM ((("Clickup".cup_tasks ct
             CROSS JOIN LATERAL jsonb_array_elements((ct.custom_fields)::jsonb) fields(value))
             LEFT JOIN LATERAL ( SELECT option.value
                   FROM jsonb_array_elements(((fields.value -> 'type_config'::text) -> 'options'::text)) option(value)
                  WHERE (((fields.value ->> 'id'::text) = 'bea467ac-244d-4f2a-ac35-62019e8f6bea'::text) AND ((fields.value ->> 'value'::text) = (option.value ->> 'orderindex'::text)))) status_option ON (true))
             LEFT JOIN LATERAL ( SELECT field.value AS resp_field
                   FROM jsonb_array_elements((ct.custom_fields)::jsonb) field(value)
                  WHERE ((field.value ->> 'id'::text) = '5df72d40-b3ca-44d1-a174-eea9f85c239f'::text)
                 LIMIT 1) resp_data ON (true))
          WHERE (((fields.value ->> 'id'::text) = 'f02eaef1-529e-49f3-bad5-38ca2813fc12'::text) AND ((fields.value ->> 'value'::text) IS NOT NULL) AND ((fields.value ->> 'value'::text) <> ''::text) AND (regexp_replace((fields.value ->> 'value'::text), '[^0-9]'::text, ''::text, 'g'::text) <> '0'::text) AND (length(regexp_replace((fields.value ->> 'value'::text), '[^0-9]'::text, ''::text, 'g'::text)) >= 11))
        )
 SELECT id_cup,
    cnpj AS id_caz,
    cnpj,
    name AS nome,
    statusconta,
    csresponsavel
   FROM campos_filtrados
  WHERE (cnpj IS NOT NULL)
  ORDER BY cnpj, id_cup;
```
</details>

#### `cup_folders` (TABLE | ~20 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id | text | Sim | - | Identificador unico |
| name | text | Sim | - | Nome |
| orderindex | text | Sim | - | orderindex |
| override_statuses | text | Sim | - | override statuses |
| hidden | text | Sim | - | hidden |
| task_count | text | Sim | - | task count |
| archived | text | Sim | - | archived |
| statuses | text | Sim | - | statuses |
| lists | text | Sim | - | lists |
| permission_level | text | Sim | - | permission level |
| space.id | text | Sim | - | space.id |
| space.name | text | Sim | - | space.name |

#### `cup_spaces` (TABLE | ~6 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id | text | Sim | - | Identificador unico |
| name | text | Sim | - | Nome |
| color | text | Sim | - | Cor |
| private | text | Sim | - | private |
| avatar | text | Sim | - | URL do avatar |
| admin_can_manage | text | Sim | - | admin can manage |
| statuses | text | Sim | - | statuses |
| multiple_assignees | text | Sim | - | multiple assignees |
| archived | text | Sim | - | archived |
| features.due_dates.enabled | text | Sim | - | features.due dates.enabled |
| features.due_dates.start_date | text | Sim | - | features.due dates.start date |
| features.due_dates.remap_due_dates | text | Sim | - | features.due dates.remap due dates |
| features.due_dates.remap_closed_due_date | text | Sim | - | features.due dates.remap closed due date |
| features.sprints.enabled | text | Sim | - | features.sprints.enabled |
| features.time_tracking.enabled | text | Sim | - | features.time tracking.enabled |
| features.time_tracking.harvest | text | Sim | - | features.time tracking.harvest |
| features.time_tracking.rollup | text | Sim | - | features.time tracking.rollup |
| features.time_tracking.default_to_billable | text | Sim | - | features.time tracking.default to billable |
| features.points.enabled | text | Sim | - | features.points.enabled |
| features.custom_items.enabled | text | Sim | - | features.custom items.enabled |
| features.priorities.enabled | text | Sim | - | features.priorities.enabled |
| features.priorities.priorities | text | Sim | - | features.priorities.priorities |
| features.tags.enabled | text | Sim | - | features.tags.enabled |
| features.time_estimates.enabled | text | Sim | - | features.time estimates.enabled |
| features.time_estimates.rollup | text | Sim | - | features.time estimates.rollup |
| features.time_estimates.per_assignee | text | Sim | - | features.time estimates.per assignee |
| features.check_unresolved.enabled | text | Sim | - | features.check unresolved.enabled |
| features.check_unresolved.subtasks | text | Sim | - | features.check unresolved.subtasks |
| features.check_unresolved.checklists | text | Sim | - | features.check unresolved.checklists |
| features.check_unresolved.comments | text | Sim | - | features.check unresolved.comments |
| features.milestones.enabled | text | Sim | - | features.milestones.enabled |
| features.custom_fields.enabled | text | Sim | - | features.custom fields.enabled |
| features.remap_dependencies.enabled | text | Sim | - | features.remap dependencies.enabled |
| features.dependency_warning.enabled | text | Sim | - | features.dependency warning.enabled |
| features.status_pies.enabled | text | Sim | - | features.status pies.enabled |
| features.multiple_assignees.enabled | text | Sim | - | features.multiple assignees.enabled |
| features.emails.enabled | text | Sim | - | features.emails.enabled |
| features.scheduler_enabled | text | Sim | - | features.scheduler enabled |
| features.dependency_type_enabled | text | Sim | - | features.dependency type enabled |
| features.dependency_enforcement.enforcement_enabled | text | Sim | - | features.dependency enforcement.enforcement enabled |
| features.dependency_enforcement.enforcement_mode | text | Sim | - | features.dependency enforcement.enforcement mode |
| features.wip_limits.enabled | text | Sim | - | features.wip limits.enabled |

#### `cup_tech_tasks` (TABLE | ~73 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 clickup_task_id | text | Nao | - | ID de clickup task |
| task_name | text | Sim | - | task name |
| status_projeto | text | Sim | - | status projeto |
| prioridade | text | Sim | - | prioridade |
| data_vencimento | date | Sim | - | Data de vencimento |
| lancamento | date | Sim | - | lancamento |
| tempo_total | float8 | Sim | - | tempo total |
| responsavel | text | Sim | - | Responsavel |
| fase_projeto | text | Sim | - | fase projeto |
| tipo | text | Sim | - | Tipo |
| tipo_projeto | text | Sim | - | tipo projeto |
| figma | text | Sim | - | figma |
| valor_p | float8 | Sim | - | Valor de p |
| data_inicial | date | Sim | - | Data de inicial |
| data_criada | date | Sim | - | Data de criada |
| id_task | text | Sim | - | ID da tarefa (cliente) |

### RH e Documentos

#### `pdfs_contratos` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.pdfs_contratos_i...` | Identificador unico |
| contrato_id | int | Sim | - | ID do contrato |
| filename | varchar(255) | Sim | - | filename |
| original_filename | varchar(255) | Sim | - | original filename |
| file_path | text | Sim | - | file path |
| file_size | int | Sim | - | file size |
| file_hash | varchar(255) | Sim | - | file hash |
| download_url | text | Sim | - | download url |
| is_signed | bool | Sim | `false` | Flag: signed |
| signature_metadata | jsonb | Sim | - | signature metadata |
| download_count | int | Sim | `0` | download count |
| expires_at | timestamp | Sim | - | Data de expiracao |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**🔗 Foreign Keys:**
- `contrato_id` → `cortex_core.contratos.id`

### Credenciais

#### `credentials` (TABLE | ~1.162 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| client_id | uuid | Nao | - | ID de client |
| platform | text | Nao | - | platform |
| username | text | Nao | - | username |
| password | text | Sim | - | password |
| access_url | text | Sim | - | access url |
| observations | text | Sim | - | observations |
| created_at | timestamp | Nao | `now()` | Data de criacao |
| updated_at | timestamp | Nao | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `client_id` → `cortex_core.clients.id`

**Indexes:**
- `idx_credentials_client_id`: INDEX idx_credentials_client_id ON cortex_core.credentials USING btree (client_id)

### Beneficios

#### `benefits` (TABLE | ~34 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | uuid | Nao | `gen_random_uuid()` | Identificador unico |
| empresa | text | Nao | - | Empresa |
| cupom | text | Nao | - | cupom |
| desconto | text | Nao | - | Desconto aplicado |
| site | text | Nao | - | site |
| segmento | enum | Nao | - | segmento |
| created_by | uuid | Sim | - | Criado por |
| created_at | timestamp | Nao | `now()` | Data de criacao |
| updated_at | timestamp | Nao | `now()` | Data de atualizacao |

**Indexes:**
- `benefits_empresa_idx`: INDEX benefits_empresa_idx ON cortex_core.benefits USING btree (empresa)
- `benefits_segmento_idx`: INDEX benefits_segmento_idx ON cortex_core.benefits USING btree (segmento)

### Cursos

#### `courses` (TABLE | ~67 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | text | Nao | - | Identificador unico |
| nome | text | Nao | - | Nome |
| status | text | Sim | `'sem_status'::text` | Status atual |
| tema_principal | text | Sim | - | tema principal |
| plataforma | text | Sim | - | plataforma |
| url | text | Sim | - | url |
| login | text | Sim | - | login |
| senha | text | Sim | - | senha |
| created_by | text | Sim | - | Criado por |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

### Agentes e Sorisos

#### `agentesdr_sorisos` (TABLE | ~290 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.agentesdr_soriso...` | Identificador unico |
| session_id | varchar(255) | Nao | - | ID de session |
| message | jsonb | Nao | - | message |

### Sugestoes

#### `sugestoes` (TABLE | ~1 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.sugestoes_id_seq...` | Identificador unico |
| tipo | varchar(50) | Nao | - | Tipo |
| titulo | varchar(255) | Nao | - | titulo |
| descricao | text | Nao | - | Descricao |
| prioridade | varchar(20) | Sim | `'media'::character varying` | prioridade |
| status | varchar(50) | Sim | `'pendente'::character varying` | Status atual |
| autor_id | varchar(100) | Nao | - | ID do autor |
| autor_nome | varchar(255) | Nao | - | Nome de autor |
| autor_email | varchar(255) | Sim | - | autor email |
| modulo | varchar(100) | Sim | - | modulo |
| anexo_path | text | Sim | - | anexo path |
| criado_em | timestamp | Sim | `now()` | Data/hora de criado |
| atualizado_em | timestamp | Sim | `now()` | Data/hora de atualizado |
| comentario_admin | text | Sim | - | comentario admin |

### Tarefas

#### `tarefas_clientes` (TABLE | ~21.403 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.tarefas_clientes...` | Identificador unico |
| status | varchar(50) | Nao | - | Status atual |
| nome | varchar(255) | Nao | - | Nome |
| responsavel | varchar(255) | Sim | - | Responsavel |
| data_vencimento | date | Sim | - | Data de vencimento |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| cliente | text | Sim | - | cliente |
| data_conclusao | date | Sim | - | Data de conclusao |
| equipe | text | Sim | - | equipe |
| tipo_task | text | Sim | - | tipo task |

### Indisponibilidade

#### `unavailability_requests` (TABLE | ~1 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('cortex_core.unavailability_r...` | Identificador unico |
| colaborador_id | int | Nao | - | ID do colaborador |
| colaborador_nome | varchar(255) | Nao | - | Nome de colaborador |
| colaborador_email | varchar(255) | Sim | - | colaborador email |
| data_inicio | date | Nao | - | Data de inicio |
| data_fim | date | Nao | - | Data de fim |
| motivo | text | Sim | - | motivo |
| data_admissao | date | Sim | - | Data de admissao |
| status | varchar(20) | Sim | `'pendente'::character varying` | Status atual |
| aprovador_email | varchar(255) | Sim | - | aprovador email |
| aprovador_nome | varchar(255) | Sim | - | Nome de aprovador |
| data_aprovacao | timestamp | Sim | - | Data de aprovacao |
| observacao_aprovador | text | Sim | - | observacao aprovador |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| status_rh | varchar(20) | Sim | `'pendente'::character varying` | status rh |
| status_lider | varchar(20) | Sim | `'pendente'::character varying` | status lider |
| rh_aprovador_email | varchar(255) | Sim | - | rh aprovador email |
| rh_aprovador_nome | varchar(255) | Sim | - | Nome de rh aprovador |
| rh_aprovado_em | timestamp | Sim | - | Data/hora de rh aprovado |
| rh_observacao | text | Sim | - | rh observacao |
| lider_aprovador_email | varchar(255) | Sim | - | lider aprovador email |
| lider_aprovador_nome | varchar(255) | Sim | - | Nome de lider aprovador |
| lider_aprovado_em | timestamp | Sim | - | Data/hora de lider aprovado |
| lider_observacao | text | Sim | - | lider observacao |
| aprovador_rh_email | varchar(255) | Sim | - | aprovador rh email |
| aprovador_rh_nome | varchar(255) | Sim | - | Nome de aprovador rh |
| aprovado_rh_em | timestamp | Sim | - | Data/hora de aprovado rh |
| observacao_rh | text | Sim | - | observacao rh |
| aprovador_lider_email | varchar(255) | Sim | - | aprovador lider email |
| aprovador_lider_nome | varchar(255) | Sim | - | Nome de aprovador lider |
| aprovado_lider_em | timestamp | Sim | - | Data/hora de aprovado lider |
| observacao_lider | text | Sim | - | observacao lider |
| data_aprovacao_rh | timestamp | Sim | - | Data de aprovacao rh |
| data_aprovacao_lider | timestamp | Sim | - | Data de aprovacao lider |
| squad_nome | text | Sim | - | Nome de squad |

### Outros

#### `vw_chat_metricas_realtime` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| responsavel_apelido | varchar(255) | Sim | - | responsavel apelido |
| conversas_abertas | bigint | Sim | - | conversas abertas |
| conversas_aguardando | bigint | Sim | - | conversas aguardando |
| conversas_fechadas_hoje | bigint | Sim | - | conversas fechadas hoje |
| tempo_primeira_resposta_avg | int | Sim | - | tempo primeira resposta avg |
| tempo_atendimento_avg | int | Sim | - | tempo atendimento avg |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT responsavel_apelido,
    count(*) FILTER (WHERE ((status)::text = 'open'::text)) AS conversas_abertas,
    count(*) FILTER (WHERE ((status)::text = 'waiting'::text)) AS conversas_aguardando,
    count(*) FILTER (WHERE (((status)::text = 'closed'::text) AND (closed_at >= CURRENT_DATE))) AS conversas_fechadas_hoje,
    (avg(
        CASE
            WHEN (primeira_resposta_em IS NOT NULL) THEN EXTRACT(epoch FROM (primeira_resposta_em - created_at))
            ELSE NULL::numeric
        END))::integer AS tempo_primeira_resposta_avg,
    (avg(
        CASE
            WHEN (closed_at IS NOT NULL) THEN EXTRACT(epoch FROM (closed_at - created_at))
            ELSE NULL::numeric
        END))::integer AS tempo_atendimento_avg
   FROM cortex_core.chat_conversas c
  WHERE (created_at >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY responsavel_apelido;
```
</details>

#### `vw_cohort_contratos` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| cohort_month | date | Sim | - | cohort month |
| idade_meses | int | Sim | - | idade meses |
| contratos_ativos | bigint | Sim | - | contratos ativos |
| receita_ativa | numeric | Sim | - | receita ativa |
| contratos_iniciais | bigint | Sim | - | contratos iniciais |
| retencao_pct | numeric | Sim | - | retencao pct |

<details>
<summary>Definicao SQL da View</summary>

```sql
WITH contratos_base AS (
         SELECT cup_contratos.id_subtask AS id_contrato,
            cup_contratos.id_task AS id_cliente,
            (date_trunc('month'::text, (cup_contratos.data_inicio)::timestamp with time zone))::date AS cohort_month,
            cup_contratos.data_inicio,
            cup_contratos.data_encerramento,
            cup_contratos.valorr
           FROM "Clickup".cup_contratos
          WHERE ((cup_contratos.valorr > (0)::numeric) AND (cup_contratos.data_inicio IS NOT NULL))
        ), contratos_mensalizados AS (
         SELECT c_1.id_contrato,
            c_1.id_cliente,
            c_1.cohort_month,
            (gs.mes_ref)::date AS mes_referencia,
            c_1.data_encerramento,
            c_1.valorr
           FROM (contratos_base c_1
             JOIN LATERAL generate_series(date_trunc('month'::text, (c_1.data_inicio)::timestamp with time zone), date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone), '1 mon'::interval) gs(mes_ref) ON (true))
        ), contratos_com_status_mes AS (
         SELECT contratos_mensalizados.id_contrato,
            contratos_mensalizados.id_cliente,
            contratos_mensalizados.cohort_month,
            contratos_mensalizados.mes_referencia,
            contratos_mensalizados.valorr,
                CASE
                    WHEN (contratos_mensalizados.data_encerramento IS NULL) THEN 1
                    WHEN (contratos_mensalizados.mes_referencia <= date_trunc('month'::text, (contratos_mensalizados.data_encerramento)::timestamp with time zone)) THEN 1
                    ELSE 0
                END AS ativo_no_mes
           FROM contratos_mensalizados
        ), contratos_com_idade AS (
         SELECT contratos_com_status_mes.id_contrato,
            contratos_com_status_mes.id_cliente,
            contratos_com_status_mes.cohort_month,
            contratos_com_status_mes.mes_referencia,
            contratos_com_status_mes.valorr,
            contratos_com_status_mes.ativo_no_mes,
            ((((date_part('year'::text, contratos_com_status_mes.mes_referencia) * (12)::double precision) + date_part('month'::text, contratos_com_status_mes.mes_referencia)) - ((date_part('year'::text, contratos_com_status_mes.cohort_month) * (12)::double precision) + date_part('month'::text, contratos_com_status_mes.cohort_month))))::integer AS idade_meses
           FROM contratos_com_status_mes
        ), cohort_iniciais AS (
         SELECT contratos_base.cohort_month,
            count(DISTINCT contratos_base.id_contrato) AS contratos_iniciais
           FROM contratos_base
          GROUP BY contratos_base.cohort_month
        )
 SELECT c.cohort_month,
    c.idade_meses,
    count(DISTINCT c.id_contrato) FILTER (WHERE (c.ativo_no_mes = 1)) AS contratos_ativos,
    sum(c.valorr) FILTER (WHERE (c.ativo_no_mes = 1)) AS receita_ativa,
    ci.contratos_iniciais,
    round(((100.0 * (count(DISTINCT c.id_contrato) FILTER (WHERE (c.ativo_no_mes = 1)))::numeric) / (ci.contratos_iniciais)::numeric), 2) AS retencao_pct
   FROM (contratos_com_idade c
     JOIN cohort_iniciais ci ON ((ci.cohort_month = c.cohort_month)))
  GROUP BY c.cohort_month, c.idade_meses, ci.contratos_iniciais
  ORDER BY c.cohort_month, c.idade_meses;
```
</details>

#### `vw_cohort_detalhada` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| servico | varchar(255) | Sim | - | Servico contratado |
| status | text | Sim | - | Status atual |
| valorr | numeric(10) | Sim | - | Valor recorrente (MRR) |
| valorp | numeric(10) | Sim | - | Valor pontual |
| id_task | text | Sim | - | ID da tarefa (cliente) |
| id_subtask | text | Sim | - | ID da subtarefa (contrato) |
| data_encerramento | date | Sim | - | Data de encerramento |
| data_inicio | date | Sim | - | Data de inicio |
| squad | text | Sim | - | Squad/equipe |
| produto | text | Sim | - | Produto |
| data_solicitacao_encerramento | date | Sim | - | Data da solicitacao de encerramento |
| responsavel | text | Sim | - | Responsavel |
| cs_responsavel | text | Sim | - | CS responsavel |
| vendedor | text | Sim | - | Vendedor responsavel |
| data_pausa | date | Sim | - | Data de pausa |
| motivo_cancelamento | text | Sim | - | Motivo do cancelamento |
| plano | text | Sim | - | Plano contratado |
| id_contrato | text | Sim | - | ID de contrato |
| id_cliente | text | Sim | - | ID do cliente (Conta Azul) |
| cohort_month | date | Sim | - | cohort month |
| idade_meses | int | Sim | - | idade meses |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT servico,
    status,
    valorr,
    valorp,
    id_task,
    id_subtask,
    data_encerramento,
    data_inicio,
    squad,
    produto,
    data_solicitacao_encerramento,
    responsavel,
    cs_responsavel,
    vendedor,
    data_pausa,
    motivo_cancelamento,
    plano,
    id_subtask AS id_contrato,
    id_task AS id_cliente,
    (date_trunc('month'::text, (data_inicio)::timestamp with time zone))::date AS cohort_month,
    ((((date_part('year'::text, CURRENT_DATE) * (12)::double precision) + date_part('month'::text, CURRENT_DATE)) - ((date_part('year'::text, data_inicio) * (12)::double precision) + date_part('month'::text, data_inicio))))::integer AS idade_meses
   FROM "Clickup".cup_contratos c
  WHERE ((valorr > (0)::numeric) AND (data_inicio IS NOT NULL));
```
</details>

---

## Schema: gold_views

**Descricao:** Views consolidadas ("gold layer") para consumo direto em dashboards e relatorios.

#### `clientes` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| nome | text | Sim | - | Nome |
| cnpj | varchar(255) | Sim | - | CNPJ do cliente |
| email | varchar(255) | Sim | - | Email |
| telefone | varchar(255) | Sim | - | Telefone |
| celular | varchar(50) | Sim | - | Celular |
| endereco | text | Sim | - | Endereco |
| id_ca | varchar(255) | Sim | - | ID de ca |
| id_clickup | text | Sim | - | ID de clickup |
| cx | text | Sim | - | cx |
| vendedor | text | Sim | - | Vendedor responsavel |
| status | text | Sim | - | Status atual |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT cup.nome,
    caz.cnpj,
    caz.email,
    caz.telefone,
    cup.telefone AS celular,
    caz.endereco,
    caz.ids AS id_ca,
    cup.task_id AS id_clickup,
    cup.responsavel AS cx,
    cup.vendedor,
    cup.status
   FROM ("Conta Azul".caz_clientes caz
     LEFT JOIN "Clickup".cup_clientes cup ON ((cup.cnpj = (caz.cnpj)::text)));
```
</details>

---

## Schema: google_ads

**Descricao:** Dados de campanhas Google Ads - contas, campanhas, grupos de anuncios, metricas diarias e keywords.

#### `accounts` (TABLE | ~66 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 account_key | bigint | Nao | `nextval('google_ads.accounts_account_...` | Chave da conta |
| customer_id | bigint | Nao | - | ID do cliente (ads) |
| descriptive_name | text | Sim | - | descriptive name |
| currency_code | character | Nao | - | currency code |
| time_zone | text | Nao | - | time zone |
| auto_tagging_enabled | bool | Nao | `false` | auto tagging enabled |
| status | text | Nao | - | Status atual |
| manager | bool | Nao | `false` | manager |
| test_account | bool | Nao | `false` | test account |
| created_at | timestamptz | Nao | `now()` | Data de criacao |
| updated_at | timestamptz | Nao | `now()` | Data de atualizacao |

**Indexes:**
- `accounts_customer_id_key`: UNIQUE INDEX accounts_customer_id_key ON google_ads.accounts USING btree (customer_id)
- `idx_accounts_status`: INDEX idx_accounts_status ON google_ads.accounts USING btree (status)
- `idx_accounts_updated_at`: INDEX idx_accounts_updated_at ON google_ads.accounts USING btree (updated_at DESC)

#### `ad_group_daily_metrics` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 ad_group_key | bigint | Nao | - | Chave de ad group |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| average_cpc_micros | bigint | Sim | - | average cpc micros |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `ad_group_key` → `google_ads.ad_groups.ad_group_key`

**Indexes:**
- `idx_ad_group_daily_metrics_group`: INDEX idx_ad_group_daily_metrics_group ON ONLY google_ads.ad_group_daily_metrics USING btree (ad_group_key)

#### `ad_group_daily_metrics_2024_11` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 ad_group_key | bigint | Nao | - | Chave de ad group |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| average_cpc_micros | bigint | Sim | - | average cpc micros |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `ad_group_key` → `google_ads.ad_groups.ad_group_key`

**Indexes:**
- `ad_group_daily_metrics_2024_11_ad_group_key_idx`: INDEX ad_group_daily_metrics_2024_11_ad_group_key_idx ON google_ads.ad_group_daily_metrics_2024_11 USING btree (ad_group_key)

#### `ad_group_daily_metrics_2025_10` (TABLE | ~714 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 ad_group_key | bigint | Nao | - | Chave de ad group |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| average_cpc_micros | bigint | Sim | - | average cpc micros |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `ad_group_key` → `google_ads.ad_groups.ad_group_key`

**Indexes:**
- `ad_group_daily_metrics_2025_10_ad_group_key_idx`: INDEX ad_group_daily_metrics_2025_10_ad_group_key_idx ON google_ads.ad_group_daily_metrics_2025_10 USING btree (ad_group_key)

#### `ad_group_daily_metrics_2025_11` (TABLE | ~3.461 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 ad_group_key | bigint | Nao | - | Chave de ad group |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| average_cpc_micros | bigint | Sim | - | average cpc micros |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `ad_group_key` → `google_ads.ad_groups.ad_group_key`

**Indexes:**
- `ad_group_daily_metrics_2025_11_ad_group_key_idx`: INDEX ad_group_daily_metrics_2025_11_ad_group_key_idx ON google_ads.ad_group_daily_metrics_2025_11 USING btree (ad_group_key)

#### `ad_group_daily_metrics_2025_12` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 ad_group_key | bigint | Nao | - | Chave de ad group |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| average_cpc_micros | bigint | Sim | - | average cpc micros |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `ad_group_key` → `google_ads.ad_groups.ad_group_key`

**Indexes:**
- `ad_group_daily_metrics_2025_12_ad_group_key_idx`: INDEX ad_group_daily_metrics_2025_12_ad_group_key_idx ON google_ads.ad_group_daily_metrics_2025_12 USING btree (ad_group_key)

#### `ad_groups` (TABLE | ~1.634 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 ad_group_key | bigint | Nao | `nextval('google_ads.ad_groups_ad_grou...` | Chave de ad group |
| campaign_key | bigint | Nao | - | Chave da campanha |
| ad_group_id | bigint | Nao | - | ID de ad group |
| name | text | Nao | - | Nome |
| type | text | Nao | - | type |
| status | text | Nao | - | Status atual |
| cpc_bid_micros | bigint | Sim | - | cpc bid micros |
| cpm_bid_micros | bigint | Sim | - | cpm bid micros |
| cpa_bid_micros | bigint | Sim | - | cpa bid micros |
| target_cpa_micros | bigint | Sim | - | target cpa micros |
| start_date | date | Sim | - | start date |
| end_date | date | Sim | - | end date |
| created_at | timestamptz | Nao | `now()` | Data de criacao |
| updated_at | timestamptz | Nao | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `campaign_key` → `google_ads.campaigns.campaign_key`

**Indexes:**
- `ad_groups_campaign_key_ad_group_id_key`: UNIQUE INDEX ad_groups_campaign_key_ad_group_id_key ON google_ads.ad_groups USING btree (campaign_key, ad_group_id)
- `idx_ad_groups_campaign`: INDEX idx_ad_groups_campaign ON google_ads.ad_groups USING btree (campaign_key)
- `idx_ad_groups_status`: INDEX idx_ad_groups_status ON google_ads.ad_groups USING btree (status)

#### `ads` (TABLE | ~2.971 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 ad_key | bigint | Nao | `nextval('google_ads.ads_ad_key_seq'::...` | Chave de ad |
| ad_group_key | bigint | Nao | - | Chave de ad group |
| ad_id | bigint | Nao | - | ID de ad |
| resource_name | text | Sim | - | resource name |
| ad_type | text | Nao | - | ad type |
| status | text | Nao | - | Status atual |
| final_urls | array | Sim | - | final urls |
| final_mobile_urls | array | Sim | - | final mobile urls |
| display_url | text | Sim | - | display url |
| tracking_template | text | Sim | - | tracking template |
| created_at | timestamptz | Nao | `now()` | Data de criacao |
| updated_at | timestamptz | Nao | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `ad_group_key` → `google_ads.ad_groups.ad_group_key`

**Indexes:**
- `ads_ad_group_key_ad_id_key`: UNIQUE INDEX ads_ad_group_key_ad_id_key ON google_ads.ads USING btree (ad_group_key, ad_id)
- `idx_ads_ad_group`: INDEX idx_ads_ad_group ON google_ads.ads USING btree (ad_group_key)
- `idx_ads_status`: INDEX idx_ads_status ON google_ads.ads USING btree (status)

#### `campaign_budgets` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 budget_key | bigint | Nao | `nextval('google_ads.campaign_budgets_...` | Chave de budget |
| account_key | bigint | Nao | - | Chave da conta |
| budget_id | bigint | Nao | - | ID de budget |
| resource_name | text | Sim | - | resource name |
| name | text | Nao | - | Nome |
| amount_micros | bigint | Nao | - | amount micros |
| delivery_method | text | Nao | - | delivery method |
| explicitly_shared | bool | Nao | `false` | explicitly shared |
| status | text | Nao | - | Status atual |
| period_type | text | Sim | - | period type |
| created_at | timestamptz | Nao | `now()` | Data de criacao |
| updated_at | timestamptz | Nao | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `account_key` → `google_ads.accounts.account_key`

**Indexes:**
- `campaign_budgets_account_key_budget_id_key`: UNIQUE INDEX campaign_budgets_account_key_budget_id_key ON google_ads.campaign_budgets USING btree (account_key, budget_id)
- `idx_campaign_budgets_status`: INDEX idx_campaign_budgets_status ON google_ads.campaign_budgets USING btree (status)

#### `campaign_daily_metrics` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 campaign_key | bigint | Nao | - | Chave da campanha |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| engagement_rate | numeric(9) | Sim | - | Taxa de engajamento |
| video_views | bigint | Nao | `0` | Visualizacoes de video |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `campaign_key` → `google_ads.campaigns.campaign_key`

**Indexes:**
- `idx_campaign_daily_metrics_campaign`: INDEX idx_campaign_daily_metrics_campaign ON ONLY google_ads.campaign_daily_metrics USING btree (campaign_key)

#### `campaign_daily_metrics_2024_11` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 campaign_key | bigint | Nao | - | Chave da campanha |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| engagement_rate | numeric(9) | Sim | - | Taxa de engajamento |
| video_views | bigint | Nao | `0` | Visualizacoes de video |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `campaign_key` → `google_ads.campaigns.campaign_key`

**Indexes:**
- `campaign_daily_metrics_2024_11_campaign_key_idx`: INDEX campaign_daily_metrics_2024_11_campaign_key_idx ON google_ads.campaign_daily_metrics_2024_11 USING btree (campaign_key)

#### `campaign_daily_metrics_2025_10` (TABLE | ~634 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 campaign_key | bigint | Nao | - | Chave da campanha |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| engagement_rate | numeric(9) | Sim | - | Taxa de engajamento |
| video_views | bigint | Nao | `0` | Visualizacoes de video |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `campaign_key` → `google_ads.campaigns.campaign_key`

**Indexes:**
- `campaign_daily_metrics_2025_10_campaign_key_idx`: INDEX campaign_daily_metrics_2025_10_campaign_key_idx ON google_ads.campaign_daily_metrics_2025_10 USING btree (campaign_key)

#### `campaign_daily_metrics_2025_11` (TABLE | ~3.006 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 campaign_key | bigint | Nao | - | Chave da campanha |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| engagement_rate | numeric(9) | Sim | - | Taxa de engajamento |
| video_views | bigint | Nao | `0` | Visualizacoes de video |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `campaign_key` → `google_ads.campaigns.campaign_key`

**Indexes:**
- `campaign_daily_metrics_2025_11_campaign_key_idx`: INDEX campaign_daily_metrics_2025_11_campaign_key_idx ON google_ads.campaign_daily_metrics_2025_11 USING btree (campaign_key)

#### `campaign_daily_metrics_2025_12` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 campaign_key | bigint | Nao | - | Chave da campanha |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| all_conversions | numeric(20) | Nao | `0` | Todas as conversoes |
| view_through_conversions | bigint | Nao | `0` | Conversoes por visualizacao |
| interactions | bigint | Nao | `0` | Interacoes |
| engagement_rate | numeric(9) | Sim | - | Taxa de engajamento |
| video_views | bigint | Nao | `0` | Visualizacoes de video |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `campaign_key` → `google_ads.campaigns.campaign_key`

**Indexes:**
- `campaign_daily_metrics_2025_12_campaign_key_idx`: INDEX campaign_daily_metrics_2025_12_campaign_key_idx ON google_ads.campaign_daily_metrics_2025_12 USING btree (campaign_key)

#### `campaign_geo_targets` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 campaign_key | bigint | Nao | - | Chave da campanha |
| 🔑 geo_target_key | bigint | Nao | - | Chave de geo target |
| bid_modifier | numeric(10) | Sim | - | bid modifier |
| negative | bool | Nao | `false` | negative |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `campaign_key` → `google_ads.campaigns.campaign_key`
- `geo_target_key` → `google_ads.geographic_targets.geo_target_key`

#### `campaigns` (TABLE | ~864 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 campaign_key | bigint | Nao | `nextval('google_ads.campaigns_campaig...` | Chave da campanha |
| account_key | bigint | Nao | - | Chave da conta |
| budget_key | bigint | Sim | - | Chave de budget |
| campaign_id | bigint | Nao | - | ID da campanha |
| resource_name | text | Sim | - | resource name |
| name | text | Nao | - | Nome |
| status | text | Nao | - | Status atual |
| serving_status | text | Sim | - | serving status |
| advertising_channel_type | text | Nao | - | advertising channel type |
| advertising_channel_subtype | text | Sim | - | advertising channel subtype |
| bidding_strategy_type | text | Sim | - | bidding strategy type |
| base_campaign_id | bigint | Sim | - | ID de base campaign |
| start_date | date | Sim | - | start date |
| end_date | date | Sim | - | end date |
| created_at | timestamptz | Nao | `now()` | Data de criacao |
| updated_at | timestamptz | Nao | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `account_key` → `google_ads.accounts.account_key`
- `budget_key` → `google_ads.campaign_budgets.budget_key`

**Indexes:**
- `campaigns_account_key_campaign_id_key`: UNIQUE INDEX campaigns_account_key_campaign_id_key ON google_ads.campaigns USING btree (account_key, campaign_id)
- `idx_campaigns_account`: INDEX idx_campaigns_account ON google_ads.campaigns USING btree (account_key)
- `idx_campaigns_status`: INDEX idx_campaigns_status ON google_ads.campaigns USING btree (status)
- `idx_campaigns_updated_at`: INDEX idx_campaigns_updated_at ON google_ads.campaigns USING btree (updated_at DESC)

#### `geographic_targets` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 geo_target_key | bigint | Nao | `nextval('google_ads.geographic_target...` | Chave de geo target |
| resource_name | text | Nao | - | resource name |
| name | text | Nao | - | Nome |
| country_code | character | Sim | - | country code |
| target_type | text | Nao | - | target type |
| canonical_name | text | Sim | - | canonical name |
| status | text | Nao | - | Status atual |
| created_at | timestamptz | Nao | `now()` | Data de criacao |
| updated_at | timestamptz | Nao | `now()` | Data de atualizacao |

**Indexes:**
- `geographic_targets_resource_name_key`: UNIQUE INDEX geographic_targets_resource_name_key ON google_ads.geographic_targets USING btree (resource_name)

#### `keyword_daily_metrics` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 keyword_key | bigint | Nao | - | Chave de keyword |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| 🔑 match_type | text | Nao | - | match type |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| quality_score | int | Sim | - | quality score |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `keyword_key` → `google_ads.keywords.keyword_key`

**Indexes:**
- `idx_keyword_daily_metrics_keyword`: INDEX idx_keyword_daily_metrics_keyword ON ONLY google_ads.keyword_daily_metrics USING btree (keyword_key)

#### `keyword_daily_metrics_2025_10` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 keyword_key | bigint | Nao | - | Chave de keyword |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| 🔑 match_type | text | Nao | - | match type |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| quality_score | int | Sim | - | quality score |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `keyword_key` → `google_ads.keywords.keyword_key`

**Indexes:**
- `keyword_daily_metrics_2025_10_keyword_key_idx`: INDEX keyword_daily_metrics_2025_10_keyword_key_idx ON google_ads.keyword_daily_metrics_2025_10 USING btree (keyword_key)

#### `keyword_daily_metrics_2025_11` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 keyword_key | bigint | Nao | - | Chave de keyword |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| 🔑 match_type | text | Nao | - | match type |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| quality_score | int | Sim | - | quality score |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `keyword_key` → `google_ads.keywords.keyword_key`

**Indexes:**
- `keyword_daily_metrics_2025_11_keyword_key_idx`: INDEX keyword_daily_metrics_2025_11_keyword_key_idx ON google_ads.keyword_daily_metrics_2025_11 USING btree (keyword_key)

#### `keyword_daily_metrics_2025_12` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 report_date | date | Nao | - | Data do relatorio |
| 🔑 keyword_key | bigint | Nao | - | Chave de keyword |
| 🔑 device_type | text | Nao | - | Tipo de dispositivo |
| 🔑 network_type | text | Nao | - | Tipo de rede |
| 🔑 match_type | text | Nao | - | match type |
| impressions | bigint | Nao | `0` | Impressoes |
| clicks | bigint | Nao | `0` | Cliques |
| cost_micros | bigint | Nao | `0` | Custo em micros |
| conversions | numeric(20) | Nao | `0` | Conversoes |
| conversion_value | numeric(20) | Nao | `0` | Valor das conversoes |
| quality_score | int | Sim | - | quality score |
| created_at | timestamptz | Nao | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `keyword_key` → `google_ads.keywords.keyword_key`

**Indexes:**
- `keyword_daily_metrics_2025_12_keyword_key_idx`: INDEX keyword_daily_metrics_2025_12_keyword_key_idx ON google_ads.keyword_daily_metrics_2025_12 USING btree (keyword_key)

#### `keywords` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 keyword_key | bigint | Nao | `nextval('google_ads.keywords_keyword_...` | Chave de keyword |
| ad_group_key | bigint | Nao | - | Chave de ad group |
| criterion_id | bigint | Nao | - | ID de criterion |
| text | text | Nao | - | text |
| match_type | text | Nao | - | match type |
| status | text | Nao | - | Status atual |
| negative | bool | Nao | `false` | negative |
| cpc_bid_micros | bigint | Sim | - | cpc bid micros |
| quality_score | int | Sim | - | quality score |
| created_at | timestamptz | Nao | `now()` | Data de criacao |
| updated_at | timestamptz | Nao | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `ad_group_key` → `google_ads.ad_groups.ad_group_key`

**Indexes:**
- `idx_keywords_ad_group`: INDEX idx_keywords_ad_group ON google_ads.keywords USING btree (ad_group_key)
- `idx_keywords_status`: INDEX idx_keywords_status ON google_ads.keywords USING btree (status)
- `idx_keywords_text_trgm`: INDEX idx_keywords_text_trgm ON google_ads.keywords USING gin (text gin_trgm_ops)
- `keywords_ad_group_key_criterion_id_key`: UNIQUE INDEX keywords_ad_group_key_criterion_id_key ON google_ads.keywords USING btree (ad_group_key, criterion_id)

#### `load_runs` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 load_run_id | bigint | Nao | `nextval('google_ads.load_runs_load_ru...` | ID de load run |
| source_name | text | Nao | - | source name |
| started_at | timestamptz | Nao | `now()` | Data/hora de started |
| finished_at | timestamptz | Sim | - | Data/hora de finished |
| status | text | Nao | - | Status atual |
| configuration | jsonb | Sim | - | configuration |
| error_details | jsonb | Sim | - | error details |

**Indexes:**
- `idx_load_runs_started_at`: INDEX idx_load_runs_started_at ON google_ads.load_runs USING btree (started_at DESC)
- `idx_load_runs_status`: INDEX idx_load_runs_status ON google_ads.load_runs USING btree (status)

#### `vw_campaign_performance` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| account_key | bigint | Sim | - | Chave da conta |
| campaign_key | bigint | Sim | - | Chave da campanha |
| customer_id | bigint | Sim | - | ID do cliente (ads) |
| campaign_id | bigint | Sim | - | ID da campanha |
| name | text | Sim | - | Nome |
| status | text | Sim | - | Status atual |
| report_date | date | Sim | - | Data do relatorio |
| device_type | text | Sim | - | Tipo de dispositivo |
| network_type | text | Sim | - | Tipo de rede |
| impressions | bigint | Sim | - | Impressoes |
| clicks | bigint | Sim | - | Cliques |
| cost_micros | bigint | Sim | - | Custo em micros |
| conversions | numeric(20) | Sim | - | Conversoes |
| conversion_value | numeric(20) | Sim | - | Valor das conversoes |
| all_conversions | numeric(20) | Sim | - | Todas as conversoes |
| view_through_conversions | bigint | Sim | - | Conversoes por visualizacao |
| interactions | bigint | Sim | - | Interacoes |
| engagement_rate | numeric(9) | Sim | - | Taxa de engajamento |
| video_views | bigint | Sim | - | Visualizacoes de video |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT c.account_key,
    c.campaign_key,
    a.customer_id,
    c.campaign_id,
    c.name,
    c.status,
    m.report_date,
    m.device_type,
    m.network_type,
    m.impressions,
    m.clicks,
    m.cost_micros,
    m.conversions,
    m.conversion_value,
    m.all_conversions,
    m.view_through_conversions,
    m.interactions,
    m.engagement_rate,
    m.video_views
   FROM ((google_ads.campaign_daily_metrics m
     JOIN google_ads.campaigns c ON ((c.campaign_key = m.campaign_key)))
     JOIN google_ads.accounts a ON ((a.account_key = c.account_key)));
```
</details>

---

## Schema: kpi

**Descricao:** Schema de KPIs - metas e overrides mensais de metricas.

#### `metric_overrides_monthly` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('kpi.metric_overrides_monthly...` | Identificador unico |
| year | int | Nao | - | year |
| month | int | Nao | - | month |
| metric_key | varchar(100) | Nao | - | Chave de metric |
| dimension_key | varchar(100) | Sim | `''::character varying` | Chave de dimension |
| dimension_value | varchar(255) | Sim | `''::character varying` | dimension value |
| override_value | numeric(18) | Nao | - | override value |
| note | text | Sim | - | note |
| updated_by | varchar(255) | Sim | - | updated by |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**Indexes:**
- `metric_overrides_monthly_year_month_metric_key_dimension_ke_key`: UNIQUE INDEX metric_overrides_monthly_year_month_metric_key_dimension_ke_key ON kpi.metric_overrides_monthly USING btree (year, month, metric_key, dimension_key, dimension_value)

---

## Schema: meta_ads

**Descricao:** Dados de campanhas Meta Ads (Facebook/Instagram) - contas, campanhas, conjuntos, anuncios e metricas diarias.

#### `meta_accounts` (TABLE | ~2 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 account_id | varchar(50) | Nao | - | ID de account |
| account_name | varchar(255) | Sim | - | account name |
| business_id | varchar(50) | Sim | - | ID de business |
| currency | varchar(10) | Sim | `'BRL'::character varying` | currency |
| timezone_name | varchar(100) | Sim | - | timezone name |
| account_status | varchar(50) | Sim | - | account status |
| created_time | timestamp | Sim | - | created time |
| updated_time | timestamp | Sim | `CURRENT_TIMESTAMP` | updated time |
| data_importacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de importacao |
| ativo | bool | Sim | `true` | ativo |

#### `meta_ads` (TABLE | ~732 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 ad_id | varchar(50) | Nao | - | ID de ad |
| adset_id | varchar(50) | Nao | - | ID de adset |
| campaign_id | varchar(50) | Nao | - | ID da campanha |
| account_id | varchar(50) | Nao | - | ID de account |
| ad_name | varchar(255) | Nao | - | ad name |
| status | varchar(50) | Sim | - | Status atual |
| configured_status | varchar(50) | Sim | - | configured status |
| effective_status | varchar(50) | Sim | - | effective status |
| bid_type | varchar(50) | Sim | - | bid type |
| bid_amount | numeric(15) | Sim | - | bid amount |
| creative_id | varchar(50) | Sim | - | ID de creative |
| creative | jsonb | Sim | - | creative |
| created_time | timestamp | Sim | - | created time |
| updated_time | timestamp | Sim | - | updated time |
| conversion_specs | jsonb | Sim | - | conversion specs |
| tracking_specs | jsonb | Sim | - | tracking specs |
| demolink_hash | varchar(255) | Sim | - | demolink hash |
| preview_shareable_link | text | Sim | - | preview shareable link |
| data_importacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de importacao |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| ativo | bool | Sim | `true` | ativo |

#### `meta_adsets` (TABLE | ~312 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 adset_id | varchar(50) | Nao | - | ID de adset |
| campaign_id | varchar(50) | Nao | - | ID da campanha |
| account_id | varchar(50) | Nao | - | ID de account |
| adset_name | varchar(255) | Nao | - | adset name |
| status | varchar(50) | Sim | - | Status atual |
| configured_status | varchar(50) | Sim | - | configured status |
| effective_status | varchar(50) | Sim | - | effective status |
| daily_budget | numeric(15) | Sim | - | daily budget |
| lifetime_budget | numeric(15) | Sim | - | lifetime budget |
| budget_remaining | numeric(15) | Sim | - | budget remaining |
| bid_amount | numeric(15) | Sim | - | bid amount |
| bid_strategy | varchar(100) | Sim | - | bid strategy |
| optimization_goal | varchar(100) | Sim | - | optimization goal |
| billing_event | varchar(100) | Sim | - | billing event |
| created_time | timestamp | Sim | - | created time |
| updated_time | timestamp | Sim | - | updated time |
| start_time | timestamp | Sim | - | start time |
| end_time | timestamp | Sim | - | end time |
| targeting_age_min | int | Sim | - | targeting age min |
| targeting_age_max | int | Sim | - | targeting age max |
| targeting_genders | jsonb | Sim | - | targeting genders |
| targeting_geo_locations | jsonb | Sim | - | targeting geo locations |
| targeting_interests | jsonb | Sim | - | targeting interests |
| targeting_behaviors | jsonb | Sim | - | targeting behaviors |
| targeting_custom_audiences | jsonb | Sim | - | targeting custom audiences |
| targeting_lookalike_audiences | jsonb | Sim | - | targeting lookalike audiences |
| targeting_device_platforms | jsonb | Sim | - | targeting device platforms |
| targeting_publisher_platforms | jsonb | Sim | - | targeting publisher platforms |
| promoted_object | jsonb | Sim | - | promoted object |
| learning_stage_status | varchar(100) | Sim | - | learning stage status |
| learning_stage_conversions | int | Sim | - | learning stage conversions |
| data_importacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de importacao |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| ativo | bool | Sim | `true` | ativo |

#### `meta_campaigns` (TABLE | ~114 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 campaign_id | varchar(50) | Nao | - | ID da campanha |
| account_id | varchar(50) | Nao | - | ID de account |
| campaign_name | varchar(255) | Nao | - | campaign name |
| objective | varchar(100) | Sim | - | objective |
| status | varchar(50) | Sim | - | Status atual |
| configured_status | varchar(50) | Sim | - | configured status |
| effective_status | varchar(50) | Sim | - | effective status |
| buying_type | varchar(50) | Sim | - | buying type |
| daily_budget | numeric(15) | Sim | - | daily budget |
| lifetime_budget | numeric(15) | Sim | - | lifetime budget |
| budget_remaining | numeric(15) | Sim | - | budget remaining |
| spend_cap | numeric(15) | Sim | - | spend cap |
| created_time | timestamp | Sim | - | created time |
| updated_time | timestamp | Sim | - | updated time |
| start_time | timestamp | Sim | - | start time |
| stop_time | timestamp | Sim | - | stop time |
| bid_strategy | varchar(100) | Sim | - | bid strategy |
| pacing_type | jsonb | Sim | - | pacing type |
| special_ad_categories | jsonb | Sim | - | special ad categories |
| special_ad_category_country | jsonb | Sim | - | special ad category country |
| data_importacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de importacao |
| data_atualizacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |
| ativo | bool | Sim | `true` | ativo |

#### `meta_creatives` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 creative_id | varchar(50) | Nao | - | ID de creative |
| account_id | varchar(50) | Nao | - | ID de account |
| creative_name | varchar(255) | Sim | - | creative name |
| object_type | varchar(50) | Sim | - | object type |
| status | varchar(50) | Sim | - | Status atual |
| title | varchar(500) | Sim | - | Titulo |
| body | text | Sim | - | body |
| call_to_action_type | varchar(100) | Sim | - | call to action type |
| image_url | text | Sim | - | image url |
| video_url | text | Sim | - | video url |
| object_story_spec | jsonb | Sim | - | object story spec |
| asset_feed_spec | jsonb | Sim | - | asset feed spec |
| created_time | timestamp | Sim | - | created time |
| updated_time | timestamp | Sim | - | updated time |
| data_importacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de importacao |
| ativo | bool | Sim | `true` | ativo |

#### `meta_insights_daily` (TABLE | ~7.114 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | bigint | Nao | `nextval('meta_ads.meta_insights_daily...` | Identificador unico |
| account_id | varchar(50) | Nao | - | ID de account |
| campaign_id | varchar(50) | Sim | - | ID da campanha |
| adset_id | varchar(50) | Sim | - | ID de adset |
| ad_id | varchar(50) | Sim | - | ID de ad |
| date_start | date | Nao | - | date start |
| date_stop | date | Nao | - | date stop |
| impressions | bigint | Sim | `0` | Impressoes |
| clicks | bigint | Sim | `0` | Cliques |
| spend | numeric(15) | Sim | `0` | spend |
| reach | bigint | Sim | `0` | reach |
| frequency | numeric(10) | Sim | `0` | frequency |
| cpm | numeric(10) | Sim | `0` | cpm |
| cpc | numeric(10) | Sim | `0` | cpc |
| ctr | numeric(10) | Sim | `0` | ctr |
| cpp | numeric(10) | Sim | `0` | cpp |
| inline_link_clicks | bigint | Sim | `0` | inline link clicks |
| inline_link_click_ctr | numeric(10) | Sim | `0` | inline link click ctr |
| outbound_clicks | bigint | Sim | `0` | outbound clicks |
| outbound_clicks_ctr | numeric(10) | Sim | `0` | outbound clicks ctr |
| unique_clicks | bigint | Sim | `0` | unique clicks |
| unique_ctr | numeric(10) | Sim | `0` | unique ctr |
| unique_inline_link_clicks | bigint | Sim | `0` | unique inline link clicks |
| unique_inline_link_click_ctr | numeric(10) | Sim | `0` | unique inline link click ctr |
| conversions | bigint | Sim | `0` | Conversoes |
| conversion_rate | numeric(10) | Sim | `0` | conversion rate |
| cost_per_conversion | numeric(10) | Sim | `0` | cost per conversion |
| actions | jsonb | Sim | - | actions |
| action_values | jsonb | Sim | - | action values |
| cost_per_action_type | jsonb | Sim | - | cost per action type |
| video_play_actions | bigint | Sim | `0` | video play actions |
| video_p25_watched_actions | bigint | Sim | `0` | video p25 watched actions |
| video_p50_watched_actions | bigint | Sim | `0` | video p50 watched actions |
| video_p75_watched_actions | bigint | Sim | `0` | video p75 watched actions |
| video_p100_watched_actions | bigint | Sim | `0` | video p100 watched actions |
| video_avg_time_watched_actions | numeric(10) | Sim | `0` | video avg time watched actions |
| purchase_roas | numeric(10) | Sim | `0` | purchase roas |
| website_purchase_roas | numeric(10) | Sim | `0` | website purchase roas |
| quality_ranking | varchar(50) | Sim | - | quality ranking |
| engagement_rate_ranking | varchar(50) | Sim | - | engagement rate ranking |
| conversion_rate_ranking | varchar(50) | Sim | - | conversion rate ranking |
| data_importacao | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de importacao |
| hash_dados | varchar(64) | Sim | - | hash dados |

**Indexes:**
- `idx_insights_hash_dados`: UNIQUE INDEX idx_insights_hash_dados ON meta_ads.meta_insights_daily USING btree (hash_dados)
- `meta_insights_daily_account_id_campaign_id_adset_id_ad_id_d_key`: UNIQUE INDEX meta_insights_daily_account_id_campaign_id_adset_id_ad_id_d_key ON meta_ads.meta_insights_daily USING btree (account_id, campaign_id, adset_id, ad_id, date_start, date_stop)

#### `metas_diarias` (TABLE | ~61 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('meta_ads.metas_diarias_id_se...` | Identificador unico |
| dia | int | Nao | - | dia |
| mes | int | Nao | - | mes |
| ano | int | Nao | - | ano |
| meta_valor | numeric(15) | Nao | `0` | meta valor |
| created_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de criacao |
| updated_at | timestamp | Sim | `CURRENT_TIMESTAMP` | Data de atualizacao |

**Indexes:**
- `metas_diarias_dia_mes_ano_key`: UNIQUE INDEX metas_diarias_dia_mes_ano_key ON meta_ads.metas_diarias USING btree (dia, mes, ano)

---

## Schema: public

**Descricao:** Schema publico com tabelas auxiliares, views canonicas e configuracoes compartilhadas.

#### `aux_responsaveis` (TABLE | ~42 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('aux_responsaveis_id_seq'::re...` | Identificador unico |
| apelido | varchar(150) | Nao | - | apelido |
| nome | varchar(150) | Sim | - | Nome |
| email | varchar(150) | Sim | - | Email |
| telefone | varchar(30) | Sim | - | Telefone |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| telefone_whatsapp | varchar(20) | Sim | - | telefone whatsapp |

**Indexes:**
- `aux_responsaveis_apelido_key`: UNIQUE INDEX aux_responsaveis_apelido_key ON public.aux_responsaveis USING btree (apelido)

#### `catalog_products` (TABLE | ~22 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('public.catalog_products_id_s...` | Identificador unico |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| bp_segment | varchar(50) | Sim | - | bp segment |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `catalog_products_slug_key`: UNIQUE INDEX catalog_products_slug_key ON public.catalog_products USING btree (slug)

#### `cup_lists` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 list_id | text | Nao | - | ID da lista (ClickUp) |
| space_id | text | Nao | - | ID do space (ClickUp) |
| folder_id | text | Sim | - | ID da pasta (ClickUp) |
| name | text | Nao | - | Nome |

#### `cup_tasks` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 task_id | text | Nao | - | ID da tarefa no ClickUp |
| parent_task_id | text | Sim | - | ID de parent task |
| list_id | text | Nao | - | ID da lista (ClickUp) |
| folder_id | text | Sim | - | ID da pasta (ClickUp) |
| space_id | text | Nao | - | ID do space (ClickUp) |
| name | text | Nao | - | Nome |
| description | text | Sim | - | Descricao |
| status | text | Sim | - | Status atual |
| priority | text | Sim | - | priority |
| url | text | Sim | - | url |
| order_index | text | Sim | - | order index |
| date_created | timestamptz | Sim | - | date created |
| date_updated | timestamptz | Sim | - | date updated |
| date_closed | timestamptz | Sim | - | date closed |
| due_date | timestamptz | Sim | - | due date |
| start_date | timestamptz | Sim | - | start date |
| time_estimate | bigint | Sim | - | time estimate |
| time_spent | bigint | Sim | - | time spent |
| is_subtask | bool | Nao | `false` | Flag: subtask |

#### `dashboard_views` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('public.dashboard_views_id_se...` | Identificador unico |
| key | varchar(50) | Nao | - | key |
| name | varchar(200) | Nao | - | Nome |
| description | text | Sim | - | Descricao |
| is_active | bool | Nao | `true` | Se esta ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `dashboard_views_key_key`: UNIQUE INDEX dashboard_views_key_key ON public.dashboard_views USING btree (key)

#### `notification_rules` (TABLE | ~3 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('public.notification_rules_id...` | Identificador unico |
| rule_type | text | Nao | - | rule type |
| name | text | Nao | - | Nome |
| description | text | Sim | - | Descricao |
| is_enabled | bool | Sim | `true` | Flag: enabled |
| config | text | Sim | - | config |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

#### `onboarding_templates` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('public.onboarding_templates_...` | Identificador unico |
| nome | varchar(100) | Nao | - | Nome |
| descricao | text | Sim | - | Descricao |
| ativo | bool | Sim | `true` | ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |

#### `system_field_options` (TABLE | ~0 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('public.system_field_options_...` | Identificador unico |
| field_type | text | Nao | - | field type |
| value | text | Nao | - | value |
| label | text | Nao | - | Label/rotulo |
| color | text | Sim | - | Cor |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| is_active | bool | Sim | `true` | Se esta ativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `system_field_options_field_type_value_key`: UNIQUE INDEX system_field_options_field_type_value_key ON public.system_field_options USING btree (field_type, value)

#### `system_fields` (TABLE | ~31 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 id | int | Nao | `nextval('public.system_fields_id_seq'...` | Identificador unico |
| field_key | varchar(100) | Nao | - | Chave de field |
| label | varchar(255) | Nao | - | Label/rotulo |
| entity | varchar(50) | Nao | - | entity |
| field_type | varchar(50) | Nao | - | field type |
| required | bool | Sim | `false` | required |
| default_value | text | Sim | - | default value |
| enum_catalog | varchar(100) | Sim | - | enum catalog |
| validation_rules | jsonb | Sim | - | validation rules |
| help_text | text | Sim | - | help text |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**Indexes:**
- `system_fields_field_key_key`: UNIQUE INDEX system_fields_field_key_key ON public.system_fields USING btree (field_key)

#### `vw_contratos_canon` (📊 VIEW)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| id_task | text | Sim | - | ID da tarefa (cliente) |
| id_subtask | text | Sim | - | ID da subtarefa (contrato) |
| servico | varchar(255) | Sim | - | Servico contratado |
| produto | text | Sim | - | Produto |
| product_slug | varchar | Sim | - | product slug |
| squad | text | Sim | - | Squad/equipe |
| squad_slug | varchar | Sim | - | squad slug |
| status | text | Sim | - | Status atual |
| status_slug | varchar | Sim | - | status slug |
| valorr | numeric(10) | Sim | - | Valor recorrente (MRR) |
| mrr_value_cents | bigint | Sim | - | mrr value cents |
| valorp | numeric(10) | Sim | - | Valor pontual |
| one_time_value_cents | bigint | Sim | - | one time value cents |
| responsavel | text | Sim | - | Responsavel |
| cs_responsavel | text | Sim | - | CS responsavel |
| vendedor | text | Sim | - | Vendedor responsavel |
| data_inicio | date | Sim | - | Data de inicio |
| data_encerramento | date | Sim | - | Data de encerramento |
| data_solicitacao_encerramento | date | Sim | - | Data da solicitacao de encerramento |
| data_pausa | date | Sim | - | Data de pausa |

<details>
<summary>Definicao SQL da View</summary>

```sql
SELECT c.id_task,
    c.id_subtask,
    c.servico,
    c.produto,
    COALESCE(pa.slug, (lower(TRIM(BOTH FROM c.produto)))::character varying) AS product_slug,
    c.squad,
    COALESCE(sa.slug, (lower(TRIM(BOTH FROM c.squad)))::character varying) AS squad_slug,
    c.status,
    COALESCE(sta.slug, (lower(TRIM(BOTH FROM c.status)))::character varying) AS status_slug,
    c.valorr,
    ((COALESCE(c.valorr, (0)::numeric) * (100)::numeric))::bigint AS mrr_value_cents,
    c.valorp,
    ((COALESCE(c.valorp, (0)::numeric) * (100)::numeric))::bigint AS one_time_value_cents,
    c.responsavel,
    c.cs_responsavel,
    c.vendedor,
    c.data_inicio,
    c.data_encerramento,
    c.data_solicitacao_encerramento,
    c.data_pausa
   FROM ((("Clickup".cup_contratos c
     LEFT JOIN cortex_core.catalog_aliases pa ON ((((pa.catalog_key)::text = 'catalog_products'::text) AND (lower(TRIM(BOTH FROM c.produto)) = (pa.alias)::text))))
     LEFT JOIN cortex_core.catalog_aliases sa ON ((((sa.catalog_key)::text = 'catalog_squads'::text) AND (lower(TRIM(BOTH FROM c.squad)) = (sa.alias)::text))))
     LEFT JOIN cortex_core.catalog_aliases sta ON ((((sta.catalog_key)::text = 'catalog_contract_status'::text) AND (lower(TRIM(BOTH FROM c.status)) = (sta.alias)::text))));
```
</details>

---

## Schema: staging

**Descricao:** Ambiente de staging - espelha a estrutura do cortex_core para testes e validacao antes de producao.

> **Nota:** O schema `staging` espelha a estrutura do `cortex_core` para ambiente de testes e validacao. Abaixo estao listadas apenas as tabelas, sem detalhar as colunas.

| Tabela | Registros (aprox.) |
|--------|--------------------|
| access_logs | 85 |
| aditivo_servicos | 0 |
| aditivos | 0 |
| assinafy_config | 0 |
| audit_log | 0 |
| catalog_account_health | 3 |
| catalog_churn_reason | 9 |
| catalog_clusters | 5 |
| catalog_contract_status | 7 |
| catalog_plans | 6 |
| catalog_products | 22 |
| catalog_roi_bucket | 4 |
| catalog_squads | 12 |
| chat_conversas | 2 |
| chat_mensagens | 11 |
| chat_metricas | 0 |
| clientes_faturamento | 0 |
| contract_attachments | 0 |
| contract_signatures | 0 |
| contract_status_history | 0 |
| contratos | 271 |
| contratos_itens | 0 |
| cup_clientes | 1.130 |
| cup_contratos | 2.019 |
| cup_freelas | 1.180 |
| dashboard_cards | 0 |
| dashboard_views | 4 |
| dfc_snapshots | 0 |
| document_status_changes | 0 |
| entidades | 266 |
| faturas | 0 |
| faturas_itens | 0 |
| juridico_regras_escalonamento | 3 |
| kr_checkins | 0 |
| metric_actual_overrides_monthly | 0 |
| notification_rules | 3 |
| notifications | 0 |
| onboarding_etapas | 5 |
| onboarding_templates | 1 |
| pdfs_contratos | 0 |
| planos_servicos | 48 |
| portal_auth_sessions | 2 |
| portal_users | 1 |
| rh_notas_fiscais | 0 |
| rh_pagamentos | 0 |
| sales_goals | 0 |
| servicos | 26 |
| session | 86 |
| squad_goals | 16 |
| squad_metas | 0 |
| system_field_options | 0 |
| system_fields | 31 |
| turbo_avisos | 0 |
| turbo_eventos | 0 |
| turbodash_kpis | 0 |
| vw_chat_metricas_realtime 📊 | - |

---

## Schema: sys

**Descricao:** Schema de sistema - catalogos, aliases e regras de validacao compartilhadas entre ambientes.

#### `catalog_aliases` (TABLE | ~201 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 catalog_key | varchar(100) | Nao | - | Chave do catalogo |
| 🔑 alias | varchar(255) | Nao | - | Alias/apelido |
| slug | varchar(100) | Nao | - | Slug (identificador URL) |
| created_at | timestamp | Sim | `now()` | Data de criacao |

**🔗 Foreign Keys:**
- `slug` → `sys.catalog_items.catalog_key`
- `slug` → `sys.catalog_items.slug`
- `catalog_key` → `sys.catalog_items.catalog_key`
- `catalog_key` → `sys.catalog_items.slug`

#### `catalog_items` (TABLE | ~68 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 catalog_key | varchar(100) | Nao | - | Chave do catalogo |
| 🔑 slug | varchar(100) | Nao | - | Slug (identificador URL) |
| name | varchar(255) | Nao | - | Nome |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| meta | jsonb | Sim | `'{}'::jsonb` | meta |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

**🔗 Foreign Keys:**
- `catalog_key` → `sys.catalogs.catalog_key`

#### `catalogs` (TABLE | ~8 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 catalog_key | varchar(100) | Nao | - | Chave do catalogo |
| description | text | Sim | - | Descricao |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

#### `system_fields` (TABLE | ~24 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 field_key | varchar(100) | Nao | - | Chave de field |
| label | varchar(255) | Nao | - | Label/rotulo |
| entity | varchar(50) | Nao | - | entity |
| field_type | varchar(50) | Nao | - | field type |
| required | bool | Sim | `false` | required |
| default_value | jsonb | Sim | - | default value |
| enum_catalog | varchar(100) | Sim | - | enum catalog |
| validation | jsonb | Sim | `'{}'::jsonb` | validation |
| help_text | text | Sim | - | help text |
| active | bool | Sim | `true` | Ativo/Inativo |
| sort_order | int | Sim | `0` | Ordem de exibicao |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

#### `validation_rules` (TABLE | ~7 registros)

| Coluna | Tipo | Nulo | Default | Descricao |
|--------|------|------|---------|----------|
| 🔑 rule_id | varchar(100) | Nao | - | ID de rule |
| name | varchar(255) | Nao | - | Nome |
| entity | varchar(50) | Nao | - | entity |
| when_condition | jsonb | Sim | `'{}'::jsonb` | when condition |
| action | jsonb | Sim | `'{}'::jsonb` | action |
| message | text | Sim | - | message |
| active | bool | Sim | `true` | Ativo/Inativo |
| created_at | timestamp | Sim | `now()` | Data de criacao |
| updated_at | timestamp | Sim | `now()` | Data de atualizacao |

---

## Relacionamentos entre Schemas

Resumo de todas as foreign keys que conectam tabelas entre schemas ou dentro do mesmo schema.

### Inhire

| Tabela Origem | Coluna | Tabela Destino | Coluna Destino |
|---------------|--------|----------------|----------------|
| rh_comentarios | autor_id | Inhire.rh_pessoal | id |
| rh_comentarios | colaborador_id | Inhire.rh_pessoal | id |
| rh_enps | colaborador_id | Inhire.rh_pessoal | id |
| rh_one_on_one | colaborador_id | Inhire.rh_pessoal | id |
| rh_one_on_one | lider_id | Inhire.rh_pessoal | id |
| rh_patrimonio_historico | patrimonio_id | Inhire.rh_patrimonio | id |
| rh_pdi | colaborador_id | Inhire.rh_pessoal | id |

### cortex_core

| Tabela Origem | Coluna | Tabela Destino | Coluna Destino |
|---------------|--------|----------------|----------------|
| aditivo_servicos | plano_servico_id | cortex_core.planos_servicos | id |
| aditivo_servicos | aditivo_id | cortex_core.aditivos | id |
| aditivos | contrato_id | cortex_core.contratos | id |
| catalog_aliases | slug | cortex_core.catalog_items | slug |
| catalog_aliases | slug | cortex_core.catalog_items | catalog_key |
| catalog_aliases | catalog_key | cortex_core.catalog_items | slug |
| catalog_aliases | catalog_key | cortex_core.catalog_items | catalog_key |
| catalog_items | catalog_key | cortex_core.catalogs | catalog_key |
| chat_conversas | cliente_id | cortex_core.portal_users | id |
| chat_mensagens | conversa_id | cortex_core.chat_conversas | id |
| clientes_faturamento | cliente_id | cortex_core.entidades | id |
| contract_attachments | contract_id | cortex_core.contratos | id |
| contract_signatures | contract_id | cortex_core.contratos | id |
| contract_status_history | contract_id | cortex_core.contratos | id |
| contrato_servicos | contrato_id | cortex_core.contratos | id |
| contratos | entidade_id | cortex_core.entidades | id |
| contratos_itens | contrato_id | cortex_core.contratos | id |
| contratos_itens | plano_servico_id | cortex_core.planos_servicos | id |
| credentials | client_id | cortex_core.clients | id |
| document_status_changes | contrato_id | cortex_core.contratos | id |
| faturas | contrato_id | cortex_core.contratos | id |
| faturas | cliente_id | cortex_core.entidades | id |
| faturas_itens | fatura_id | cortex_core.faturas | id |
| faturas_itens | contrato_item_id | cortex_core.contratos_itens | id |
| metric_thresholds | ruleset_id | cortex_core.metric_rulesets | id |
| pdfs_contratos | contrato_id | cortex_core.contratos | id |
| planos_servicos | servico_id | cortex_core.servicos | id |

### google_ads

| Tabela Origem | Coluna | Tabela Destino | Coluna Destino |
|---------------|--------|----------------|----------------|
| ad_group_daily_metrics | ad_group_key | google_ads.ad_groups | ad_group_key |
| ad_group_daily_metrics_2024_11 | ad_group_key | google_ads.ad_groups | ad_group_key |
| ad_group_daily_metrics_2025_10 | ad_group_key | google_ads.ad_groups | ad_group_key |
| ad_group_daily_metrics_2025_11 | ad_group_key | google_ads.ad_groups | ad_group_key |
| ad_group_daily_metrics_2025_12 | ad_group_key | google_ads.ad_groups | ad_group_key |
| ad_groups | campaign_key | google_ads.campaigns | campaign_key |
| ads | ad_group_key | google_ads.ad_groups | ad_group_key |
| campaign_budgets | account_key | google_ads.accounts | account_key |
| campaign_daily_metrics | campaign_key | google_ads.campaigns | campaign_key |
| campaign_daily_metrics_2024_11 | campaign_key | google_ads.campaigns | campaign_key |
| campaign_daily_metrics_2025_10 | campaign_key | google_ads.campaigns | campaign_key |
| campaign_daily_metrics_2025_11 | campaign_key | google_ads.campaigns | campaign_key |
| campaign_daily_metrics_2025_12 | campaign_key | google_ads.campaigns | campaign_key |
| campaign_geo_targets | campaign_key | google_ads.campaigns | campaign_key |
| campaign_geo_targets | geo_target_key | google_ads.geographic_targets | geo_target_key |
| campaigns | account_key | google_ads.accounts | account_key |
| campaigns | budget_key | google_ads.campaign_budgets | budget_key |
| keyword_daily_metrics | keyword_key | google_ads.keywords | keyword_key |
| keyword_daily_metrics_2025_10 | keyword_key | google_ads.keywords | keyword_key |
| keyword_daily_metrics_2025_11 | keyword_key | google_ads.keywords | keyword_key |
| keyword_daily_metrics_2025_12 | keyword_key | google_ads.keywords | keyword_key |
| keywords | ad_group_key | google_ads.ad_groups | ad_group_key |

### staging

| Tabela Origem | Coluna | Tabela Destino | Coluna Destino |
|---------------|--------|----------------|----------------|
| aditivo_servicos | plano_servico_id | staging.planos_servicos | id |
| aditivo_servicos | aditivo_id | staging.aditivos | id |
| aditivos | contrato_id | staging.contratos | id |
| chat_conversas | cliente_id | staging.portal_users | id |
| chat_mensagens | conversa_id | staging.chat_conversas | id |
| clientes_faturamento | cliente_id | staging.entidades | id |
| contract_attachments | contract_id | staging.contratos | id |
| contract_signatures | contract_id | staging.contratos | id |
| contract_status_history | contract_id | staging.contratos | id |
| contratos | entidade_id | staging.entidades | id |
| contratos | cliente_id | staging.entidades | id |
| contratos | fornecedor_id | staging.entidades | id |
| contratos_itens | contrato_id | staging.contratos | id |
| contratos_itens | plano_servico_id | staging.planos_servicos | id |
| document_status_changes | contrato_id | staging.contratos | id |
| faturas | cliente_id | staging.entidades | id |
| faturas | contrato_id | staging.contratos | id |
| faturas_itens | fatura_id | staging.faturas | id |
| faturas_itens | contrato_item_id | staging.contratos_itens | id |
| pdfs_contratos | contrato_id | staging.contratos | id |
| planos_servicos | servico_id | staging.servicos | id |

### sys

| Tabela Origem | Coluna | Tabela Destino | Coluna Destino |
|---------------|--------|----------------|----------------|
| catalog_aliases | slug | sys.catalog_items | catalog_key |
| catalog_aliases | slug | sys.catalog_items | slug |
| catalog_aliases | catalog_key | sys.catalog_items | catalog_key |
| catalog_aliases | catalog_key | sys.catalog_items | slug |
| catalog_items | catalog_key | sys.catalogs | catalog_key |

---

## Resumo de Indexes

Total de indexes no banco: **406**

### Bitrix (7 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| crm_deal | crm_deal_pkey | UNIQUE |
| crm_deal | idx_crm_deal_assigned_by | INDEX |
| crm_deal | idx_crm_deal_category | INDEX |
| crm_deal | idx_crm_deal_date_create | INDEX |
| crm_deal | idx_crm_deal_date_modify | INDEX |
| crm_deal | idx_crm_deal_stage | INDEX |
| crm_users | crm_users_pkey | UNIQUE |

### Clickup (21 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| cup_clientes | clientes_clickup_pkey | UNIQUE |
| cup_clientes | idx_cup_clientes_cnpj | INDEX |
| cup_clientes | idx_cup_clientes_task_id | INDEX |
| cup_contratos | cup_contratos_pkey | UNIQUE |
| cup_contratos | idx_cup_contratos_id_subtask | INDEX |
| cup_contratos | idx_cup_contratos_id_task | INDEX |
| cup_contratos | idx_cup_contratos_status | INDEX |
| cup_custom_field_definitions | cup_custom_field_definitions_pkey | UNIQUE |
| cup_custom_field_values | cup_custom_field_values_pkey | UNIQUE |
| cup_folders | cup_folders_pkey | UNIQUE |
| cup_freelas | cup_freelas_pkey | UNIQUE |
| cup_projetos_tech | cup_projetos_tech_pkey | UNIQUE |
| cup_projetos_tech_fechados | cup_projetos_tech_fechados_pkey | UNIQUE |
| cup_spaces | cup_spaces_pkey | UNIQUE |
| cup_tags | cup_tags_pkey | UNIQUE |
| cup_task_assignees | cup_task_assignees_pkey | UNIQUE |
| cup_task_tags | cup_task_tags_pkey | UNIQUE |
| cup_task_watchers | cup_task_watchers_pkey | UNIQUE |
| cup_tech | clickup_tasks_dump_pkey | UNIQUE |
| cup_tech_custom_fields | cup_tech_custom_fields_pkey | UNIQUE |
| cup_users | cup_users_pkey | UNIQUE |

### Conta Azul (13 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| caz_categorias | caz_categorias_pkey | UNIQUE |
| caz_clientes | caz_clientes_ids_un | UNIQUE |
| caz_clientes | clientes_pkey | UNIQUE |
| caz_clientes | idx_caz_clientes_cnpj | INDEX |
| caz_clientes | idx_caz_clientes_ids | INDEX |
| caz_clientes | idx_cnpj | INDEX |
| caz_dre | caz_dre_pkey | UNIQUE |
| caz_itensvenda | caz_itensvenda_id_id_item_key | UNIQUE |
| caz_itensvenda | caz_itensvenda_pkey | UNIQUE |
| caz_pagar | caz_pagar_pkey | UNIQUE |
| caz_parcelas | caz_parcelas_pkey | UNIQUE |
| caz_receber | teste_a_receber_pkey | UNIQUE |
| caz_vendas | vendas_pkey | UNIQUE |

### Inhire (35 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| rh_candidaturas | rh_candidaturas_job_idx | INDEX |
| rh_candidaturas | rh_candidaturas_job_talent_uq | UNIQUE |
| rh_candidaturas | rh_candidaturas_pkey | UNIQUE |
| rh_candidaturas | rh_candidaturas_status_idx | INDEX |
| rh_comentarios | idx_rh_comentarios_autor | INDEX |
| rh_comentarios | idx_rh_comentarios_colaborador | INDEX |
| rh_comentarios | idx_rh_comentarios_criado | INDEX |
| rh_comentarios | rh_comentarios_pkey | UNIQUE |
| rh_enps | idx_rh_enps_colaborador | INDEX |
| rh_enps | idx_rh_enps_data | INDEX |
| rh_enps | rh_enps_pkey | UNIQUE |
| rh_notas_fiscais | idx_rh_notas_fiscais_colaborador | INDEX |
| rh_notas_fiscais | idx_rh_notas_fiscais_pagamento | INDEX |
| rh_notas_fiscais | rh_notas_fiscais_pkey | UNIQUE |
| rh_nps | idx_rh_nps_area | INDEX |
| rh_nps | idx_rh_nps_mes | INDEX |
| rh_nps | rh_nps_pkey | UNIQUE |
| rh_one_on_one | idx_rh_one_on_one_colaborador | INDEX |
| rh_one_on_one | idx_rh_one_on_one_data | INDEX |
| rh_one_on_one | rh_one_on_one_pkey | UNIQUE |
| rh_pagamentos | idx_rh_pagamentos_colaborador | INDEX |
| rh_pagamentos | idx_rh_pagamentos_periodo | INDEX |
| rh_pagamentos | rh_pagamentos_pkey | UNIQUE |
| rh_patrimonio | rh_patrimonio_pkey | UNIQUE |
| rh_patrimonio_historico | idx_patrimonio_historico_patrimonio_data | INDEX |
| rh_patrimonio_historico | rh_patrimonio_historico_pkey | UNIQUE |
| rh_pdi | idx_rh_pdi_colaborador | INDEX |
| rh_pdi | idx_rh_pdi_status | INDEX |
| rh_pdi | rh_pdi_pkey | UNIQUE |
| rh_pessoal | rh_pessoal_cpf_key | UNIQUE |
| rh_pessoal | rh_pessoal_pkey | UNIQUE |
| rh_promocoes | rh_promocoes_pkey | UNIQUE |
| rh_talentos | rh_talentos_pkey | UNIQUE |
| rh_telefones | rh_telefones_pkey | UNIQUE |
| rh_vagas | rh_vagas_pkey | UNIQUE |

### admin (2 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| contract_status_map | contract_status_map_pkey | UNIQUE |
| contract_status_map | contract_status_map_status_key | UNIQUE |

### clickup (2 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| cup_clientes | cup_clientes_pkey | UNIQUE |
| cup_contratos | cup_contratos_pkey | UNIQUE |

### cortex_core (138 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| access_logs | access_logs_pkey | UNIQUE |
| aditivo_servicos | aditivo_servicos_pkey | UNIQUE |
| aditivos | aditivos_pkey | UNIQUE |
| agentesdr_sorisos | agentesdr_sorisos_pkey | UNIQUE |
| assinafy_config | assinafy_config_pkey | UNIQUE |
| audit_log | audit_log_pkey | UNIQUE |
| auth_logs | auth_logs_pkey | UNIQUE |
| auth_users | auth_users_google_id_key | UNIQUE |
| auth_users | auth_users_pkey | UNIQUE |
| benefits | benefits_empresa_idx | INDEX |
| benefits | benefits_pkey | UNIQUE |
| benefits | benefits_segmento_idx | INDEX |
| bp_snapshots | bp_snapshots_mes_ano_key | UNIQUE |
| bp_snapshots | bp_snapshots_pkey | UNIQUE |
| bp_snapshots | idx_bp_snapshots_mes_ano | INDEX |
| catalog_account_health | catalog_account_health_pkey | UNIQUE |
| catalog_account_health | catalog_account_health_slug_key | UNIQUE |
| catalog_aliases | catalog_aliases_pkey | UNIQUE |
| catalog_churn_reason | catalog_churn_reason_pkey | UNIQUE |
| catalog_churn_reason | catalog_churn_reason_slug_key | UNIQUE |
| catalog_clusters | catalog_clusters_pkey | UNIQUE |
| catalog_clusters | catalog_clusters_slug_key | UNIQUE |
| catalog_contract_status | catalog_contract_status_pkey | UNIQUE |
| catalog_contract_status | catalog_contract_status_slug_key | UNIQUE |
| catalog_items | catalog_items_pkey | UNIQUE |
| catalog_plans | catalog_plans_pkey | UNIQUE |
| catalog_plans | catalog_plans_slug_key | UNIQUE |
| catalog_products | catalog_products_pkey | UNIQUE |
| catalog_products | catalog_products_slug_key | UNIQUE |
| catalog_roi_bucket | catalog_roi_bucket_pkey | UNIQUE |
| catalog_roi_bucket | catalog_roi_bucket_slug_key | UNIQUE |
| catalog_squads | catalog_squads_pkey | UNIQUE |
| catalog_squads | catalog_squads_slug_key | UNIQUE |
| catalogs | catalogs_pkey | UNIQUE |
| chat_conversas | chat_conversas_pkey | UNIQUE |
| chat_conversas | idx_chat_conversas_cliente | INDEX |
| chat_conversas | idx_chat_conversas_cnpj | INDEX |
| chat_conversas | idx_chat_conversas_responsavel | INDEX |
| chat_conversas | idx_chat_conversas_status | INDEX |
| chat_mensagens | chat_mensagens_pkey | UNIQUE |
| chat_mensagens | idx_chat_mensagens_autor | INDEX |
| chat_mensagens | idx_chat_mensagens_conversa | INDEX |
| chat_mensagens | idx_chat_mensagens_created | INDEX |
| chat_metricas | chat_metricas_data_responsavel_apelido_key | UNIQUE |
| chat_metricas | chat_metricas_pkey | UNIQUE |
| chat_metricas | idx_chat_metricas_data | INDEX |
| chat_metricas | idx_chat_metricas_responsavel | INDEX |
| clientes_faturamento | clientes_faturamento_pkey | UNIQUE |
| clients | clients_pkey | UNIQUE |
| contract_attachments | contract_attachments_pkey | UNIQUE |
| contract_signatures | contract_signatures_pkey | UNIQUE |
| contract_status_history | contract_status_history_pkey | UNIQUE |
| contract_status_map | contract_status_map_pkey | UNIQUE |
| contract_status_map | contract_status_map_status_key | UNIQUE |
| contrato_servicos | contrato_servicos_pkey | UNIQUE |
| contratos | contratos_numero_contrato_key | UNIQUE |
| contratos | contratos_pkey | UNIQUE |
| contratos_colaboradores_status | contratos_colaboradores_status_pkey | UNIQUE |
| contratos_itens | contratos_itens_pkey | UNIQUE |
| courses | courses_pkey | UNIQUE |
| credentials | credentials_pkey | UNIQUE |
| credentials | idx_credentials_client_id | INDEX |
| cup_tech_tasks | cup_tech_tasks_pkey | UNIQUE |
| dashboard_cards | dashboard_cards_pkey | UNIQUE |
| dashboard_views | dashboard_views_key_key | UNIQUE |
| dashboard_views | dashboard_views_pkey | UNIQUE |
| data_reconciliation | data_reconciliation_pkey | UNIQUE |
| dfc | dfc_pkey | UNIQUE |
| dfc_snapshots | dfc_snapshots_mes_ano_key | UNIQUE |
| dfc_snapshots | dfc_snapshots_pkey | UNIQUE |
| dfc_snapshots | idx_dfc_snapshots_mes_ano | INDEX |
| document_status_changes | document_status_changes_pkey | UNIQUE |
| entidades | entidades_cpf_cnpj_key | UNIQUE |
| entidades | entidades_pkey | UNIQUE |
| faturas | faturas_pkey | UNIQUE |
| faturas_itens | faturas_itens_pkey | UNIQUE |
| inadimplencia_contextos | idx_inadimplencia_contextos_cliente_id | INDEX |
| inadimplencia_contextos | inadimplencia_contextos_cliente_id_key | UNIQUE |
| inadimplencia_contextos | inadimplencia_contextos_pkey | UNIQUE |
| juridico_regras_escalonamento | juridico_regras_escalonamento_pkey | UNIQUE |
| kr_checkins | kr_checkins_pkey | UNIQUE |
| metric_actual_overrides_monthly | metric_actual_overrides_month_metric_key_year_month_dimensi_key | UNIQUE |
| metric_actual_overrides_monthly | metric_actual_overrides_monthly_pkey | UNIQUE |
| metric_actuals_monthly | metric_actuals_monthly_pkey | UNIQUE |
| metric_actuals_monthly | metric_actuals_monthly_year_month_metric_key_dimension_key__key | UNIQUE |
| metric_overrides_monthly | metric_overrides_monthly_pkey | UNIQUE |
| metric_overrides_monthly | metric_overrides_monthly_year_month_metric_key_dimension_ke_key | UNIQUE |
| metric_rulesets | metric_rulesets_metric_key_key | UNIQUE |
| metric_rulesets | metric_rulesets_pkey | UNIQUE |
| metric_targets_monthly | metric_targets_monthly_pkey | UNIQUE |
| metric_targets_monthly | metric_targets_monthly_year_month_metric_key_dimension_key__key | UNIQUE |
| metric_thresholds | idx_metric_thresholds_ruleset | INDEX |
| metric_thresholds | metric_thresholds_pkey | UNIQUE |
| metrics_registry_extended | metrics_registry_extended_metric_key_key | UNIQUE |
| metrics_registry_extended | metrics_registry_extended_pkey | UNIQUE |
| notification_rules | notification_rules_pkey | UNIQUE |
| notifications | notifications_pkey | UNIQUE |
| notifications | notifications_unique_key_key | UNIQUE |
| onboarding_colaborador | onboarding_colaborador_pkey | UNIQUE |
| onboarding_etapas | onboarding_etapas_pkey | UNIQUE |
| onboarding_progresso | onboarding_progresso_pkey | UNIQUE |
| onboarding_templates | onboarding_templates_pkey | UNIQUE |
| pdfs_contratos | pdfs_contratos_pkey | UNIQUE |
| planos_servicos | planos_servicos_pkey | UNIQUE |
| portal_auth_sessions | idx_portal_auth_sessions_email | INDEX |
| portal_auth_sessions | idx_portal_auth_sessions_token | INDEX |
| portal_auth_sessions | portal_auth_sessions_pkey | UNIQUE |
| portal_auth_sessions | portal_auth_sessions_token_key | UNIQUE |
| portal_users | idx_portal_users_cnpj | INDEX |
| portal_users | idx_portal_users_email | INDEX |
| portal_users | portal_users_email_key | UNIQUE |
| portal_users | portal_users_pkey | UNIQUE |
| sales_goals | idx_sales_goals_type_key | INDEX |
| sales_goals | sales_goals_goal_type_goal_key_period_month_period_year_key | UNIQUE |
| sales_goals | sales_goals_pkey | UNIQUE |
| servicos | servicos_pkey | UNIQUE |
| session | idx_session_expire | INDEX |
| session | session_pkey | UNIQUE |
| squad_goals | squad_goals_pkey | UNIQUE |
| squad_metas | squad_metas_pkey | UNIQUE |
| squad_metas | squad_metas_squad_ano_mes_key | UNIQUE |
| sugestoes | sugestoes_pkey | UNIQUE |
| sync_logs | sync_logs_pkey | UNIQUE |
| system_field_options | system_field_options_field_type_value_key | UNIQUE |
| system_field_options | system_field_options_pkey | UNIQUE |
| system_fields | system_fields_field_key_key | UNIQUE |
| system_fields | system_fields_pkey | UNIQUE |
| system_logs | system_logs_pkey | UNIQUE |
| tarefas_clientes | tarefas_clientes_pkey | UNIQUE |
| turbo_avisos | turbo_avisos_pkey | UNIQUE |
| turbo_eventos | turbo_eventos_pkey | UNIQUE |
| turbo_tools | turbo_tools_name_idx | INDEX |
| turbo_tools | turbo_tools_pkey | UNIQUE |
| turbodash_kpis | idx_turbodash_kpis_cliente_id | INDEX |
| turbodash_kpis | idx_turbodash_kpis_cnpj | INDEX |
| turbodash_kpis | turbodash_kpis_pkey | UNIQUE |
| unavailability_requests | unavailability_requests_pkey | UNIQUE |
| validation_rules | validation_rules_pkey | UNIQUE |

### google_ads (59 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| accounts | accounts_customer_id_key | UNIQUE |
| accounts | accounts_pkey | UNIQUE |
| accounts | idx_accounts_status | INDEX |
| accounts | idx_accounts_updated_at | INDEX |
| ad_group_daily_metrics | ad_group_daily_metrics_pkey | UNIQUE |
| ad_group_daily_metrics | idx_ad_group_daily_metrics_group | INDEX |
| ad_group_daily_metrics_2024_11 | ad_group_daily_metrics_2024_11_ad_group_key_idx | INDEX |
| ad_group_daily_metrics_2024_11 | ad_group_daily_metrics_2024_11_pkey | UNIQUE |
| ad_group_daily_metrics_2025_10 | ad_group_daily_metrics_2025_10_ad_group_key_idx | INDEX |
| ad_group_daily_metrics_2025_10 | ad_group_daily_metrics_2025_10_pkey | UNIQUE |
| ad_group_daily_metrics_2025_11 | ad_group_daily_metrics_2025_11_ad_group_key_idx | INDEX |
| ad_group_daily_metrics_2025_11 | ad_group_daily_metrics_2025_11_pkey | UNIQUE |
| ad_group_daily_metrics_2025_12 | ad_group_daily_metrics_2025_12_ad_group_key_idx | INDEX |
| ad_group_daily_metrics_2025_12 | ad_group_daily_metrics_2025_12_pkey | UNIQUE |
| ad_groups | ad_groups_campaign_key_ad_group_id_key | UNIQUE |
| ad_groups | ad_groups_pkey | UNIQUE |
| ad_groups | idx_ad_groups_campaign | INDEX |
| ad_groups | idx_ad_groups_status | INDEX |
| ads | ads_ad_group_key_ad_id_key | UNIQUE |
| ads | ads_pkey | UNIQUE |
| ads | idx_ads_ad_group | INDEX |
| ads | idx_ads_status | INDEX |
| campaign_budgets | campaign_budgets_account_key_budget_id_key | UNIQUE |
| campaign_budgets | campaign_budgets_pkey | UNIQUE |
| campaign_budgets | idx_campaign_budgets_status | INDEX |
| campaign_daily_metrics | campaign_daily_metrics_pkey | UNIQUE |
| campaign_daily_metrics | idx_campaign_daily_metrics_campaign | INDEX |
| campaign_daily_metrics_2024_11 | campaign_daily_metrics_2024_11_campaign_key_idx | INDEX |
| campaign_daily_metrics_2024_11 | campaign_daily_metrics_2024_11_pkey | UNIQUE |
| campaign_daily_metrics_2025_10 | campaign_daily_metrics_2025_10_campaign_key_idx | INDEX |
| campaign_daily_metrics_2025_10 | campaign_daily_metrics_2025_10_pkey | UNIQUE |
| campaign_daily_metrics_2025_11 | campaign_daily_metrics_2025_11_campaign_key_idx | INDEX |
| campaign_daily_metrics_2025_11 | campaign_daily_metrics_2025_11_pkey | UNIQUE |
| campaign_daily_metrics_2025_12 | campaign_daily_metrics_2025_12_campaign_key_idx | INDEX |
| campaign_daily_metrics_2025_12 | campaign_daily_metrics_2025_12_pkey | UNIQUE |
| campaign_geo_targets | campaign_geo_targets_pkey | UNIQUE |
| campaigns | campaigns_account_key_campaign_id_key | UNIQUE |
| campaigns | campaigns_pkey | UNIQUE |
| campaigns | idx_campaigns_account | INDEX |
| campaigns | idx_campaigns_status | INDEX |
| campaigns | idx_campaigns_updated_at | INDEX |
| geographic_targets | geographic_targets_pkey | UNIQUE |
| geographic_targets | geographic_targets_resource_name_key | UNIQUE |
| keyword_daily_metrics | idx_keyword_daily_metrics_keyword | INDEX |
| keyword_daily_metrics | keyword_daily_metrics_pkey | UNIQUE |
| keyword_daily_metrics_2025_10 | keyword_daily_metrics_2025_10_keyword_key_idx | INDEX |
| keyword_daily_metrics_2025_10 | keyword_daily_metrics_2025_10_pkey | UNIQUE |
| keyword_daily_metrics_2025_11 | keyword_daily_metrics_2025_11_keyword_key_idx | INDEX |
| keyword_daily_metrics_2025_11 | keyword_daily_metrics_2025_11_pkey | UNIQUE |
| keyword_daily_metrics_2025_12 | keyword_daily_metrics_2025_12_keyword_key_idx | INDEX |
| keyword_daily_metrics_2025_12 | keyword_daily_metrics_2025_12_pkey | UNIQUE |
| keywords | idx_keywords_ad_group | INDEX |
| keywords | idx_keywords_status | INDEX |
| keywords | idx_keywords_text_trgm | INDEX |
| keywords | keywords_ad_group_key_criterion_id_key | UNIQUE |
| keywords | keywords_pkey | UNIQUE |
| load_runs | idx_load_runs_started_at | INDEX |
| load_runs | idx_load_runs_status | INDEX |
| load_runs | load_runs_pkey | UNIQUE |

### kpi (2 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| metric_overrides_monthly | metric_overrides_monthly_pkey | UNIQUE |
| metric_overrides_monthly | metric_overrides_monthly_year_month_metric_key_dimension_ke_key | UNIQUE |

### meta_ads (10 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| meta_accounts | meta_accounts_pkey | UNIQUE |
| meta_ads | meta_ads_pkey | UNIQUE |
| meta_adsets | meta_adsets_pkey | UNIQUE |
| meta_campaigns | meta_campaigns_pkey | UNIQUE |
| meta_creatives | meta_creatives_pkey | UNIQUE |
| meta_insights_daily | idx_insights_hash_dados | UNIQUE |
| meta_insights_daily | meta_insights_daily_account_id_campaign_id_adset_id_ad_id_d_key | UNIQUE |
| meta_insights_daily | meta_insights_daily_pkey | UNIQUE |
| metas_diarias | metas_diarias_dia_mes_ano_key | UNIQUE |
| metas_diarias | metas_diarias_pkey | UNIQUE |

### public (14 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| aux_responsaveis | aux_responsaveis_apelido_key | UNIQUE |
| aux_responsaveis | aux_responsaveis_pkey | UNIQUE |
| catalog_products | catalog_products_pkey | UNIQUE |
| catalog_products | catalog_products_slug_key | UNIQUE |
| cup_lists | cup_lists_pkey | UNIQUE |
| cup_tasks | cup_tasks_pkey | UNIQUE |
| dashboard_views | dashboard_views_key_key | UNIQUE |
| dashboard_views | dashboard_views_pkey | UNIQUE |
| notification_rules | notification_rules_pkey | UNIQUE |
| onboarding_templates | onboarding_templates_pkey | UNIQUE |
| system_field_options | system_field_options_field_type_value_key | UNIQUE |
| system_field_options | system_field_options_pkey | UNIQUE |
| system_fields | system_fields_field_key_key | UNIQUE |
| system_fields | system_fields_pkey | UNIQUE |

### staging (98 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| access_logs | access_logs_pkey | UNIQUE |
| aditivo_servicos | aditivo_servicos_pkey | UNIQUE |
| aditivos | aditivos_pkey | UNIQUE |
| assinafy_config | assinafy_config_pkey | UNIQUE |
| audit_log | audit_log_pkey | UNIQUE |
| catalog_account_health | catalog_account_health_pkey | UNIQUE |
| catalog_account_health | catalog_account_health_slug_key | UNIQUE |
| catalog_churn_reason | catalog_churn_reason_pkey | UNIQUE |
| catalog_churn_reason | catalog_churn_reason_slug_key | UNIQUE |
| catalog_clusters | catalog_clusters_pkey | UNIQUE |
| catalog_clusters | catalog_clusters_slug_key | UNIQUE |
| catalog_contract_status | catalog_contract_status_pkey | UNIQUE |
| catalog_contract_status | catalog_contract_status_slug_key | UNIQUE |
| catalog_plans | catalog_plans_pkey | UNIQUE |
| catalog_plans | catalog_plans_slug_key | UNIQUE |
| catalog_products | catalog_products_pkey | UNIQUE |
| catalog_products | catalog_products_slug_key | UNIQUE |
| catalog_roi_bucket | catalog_roi_bucket_pkey | UNIQUE |
| catalog_roi_bucket | catalog_roi_bucket_slug_key | UNIQUE |
| catalog_squads | catalog_squads_pkey | UNIQUE |
| catalog_squads | catalog_squads_slug_key | UNIQUE |
| chat_conversas | chat_conversas_pkey | UNIQUE |
| chat_conversas | idx_chat_conversas_cliente | INDEX |
| chat_conversas | idx_chat_conversas_cnpj | INDEX |
| chat_conversas | idx_chat_conversas_responsavel | INDEX |
| chat_conversas | idx_chat_conversas_status | INDEX |
| chat_mensagens | chat_mensagens_pkey | UNIQUE |
| chat_mensagens | idx_chat_mensagens_autor | INDEX |
| chat_mensagens | idx_chat_mensagens_conversa | INDEX |
| chat_mensagens | idx_chat_mensagens_created | INDEX |
| chat_metricas | chat_metricas_data_responsavel_apelido_key | UNIQUE |
| chat_metricas | chat_metricas_pkey | UNIQUE |
| chat_metricas | idx_chat_metricas_data | INDEX |
| chat_metricas | idx_chat_metricas_responsavel | INDEX |
| clientes_faturamento | clientes_faturamento_pkey | UNIQUE |
| contract_attachments | contract_attachments_pkey | UNIQUE |
| contract_signatures | contract_signatures_pkey | UNIQUE |
| contract_status_history | contract_status_history_pkey | UNIQUE |
| contratos | contratos_numero_contrato_key | UNIQUE |
| contratos | contratos_pkey | UNIQUE |
| contratos_itens | contratos_itens_pkey | UNIQUE |
| cup_clientes | cup_clientes_pkey | UNIQUE |
| cup_contratos | cup_contratos_pkey | UNIQUE |
| cup_freelas | cup_freelas_pkey | UNIQUE |
| dashboard_cards | dashboard_cards_pkey | UNIQUE |
| dashboard_views | dashboard_views_key_key | UNIQUE |
| dashboard_views | dashboard_views_pkey | UNIQUE |
| dfc_snapshots | dfc_snapshots_mes_ano_key | UNIQUE |
| dfc_snapshots | dfc_snapshots_pkey | UNIQUE |
| dfc_snapshots | idx_dfc_snapshots_mes_ano | INDEX |
| document_status_changes | document_status_changes_pkey | UNIQUE |
| entidades | entidades_cpf_cnpj_key | UNIQUE |
| entidades | entidades_pkey | UNIQUE |
| faturas | faturas_pkey | UNIQUE |
| faturas_itens | faturas_itens_pkey | UNIQUE |
| juridico_regras_escalonamento | juridico_regras_escalonamento_pkey | UNIQUE |
| kr_checkins | kr_checkins_pkey | UNIQUE |
| metric_actual_overrides_monthly | metric_actual_overrides_month_metric_key_year_month_dimensi_key | UNIQUE |
| metric_actual_overrides_monthly | metric_actual_overrides_monthly_pkey | UNIQUE |
| notification_rules | notification_rules_pkey | UNIQUE |
| notifications | notifications_pkey | UNIQUE |
| notifications | notifications_unique_key_key | UNIQUE |
| onboarding_etapas | onboarding_etapas_pkey | UNIQUE |
| onboarding_templates | onboarding_templates_pkey | UNIQUE |
| pdfs_contratos | pdfs_contratos_pkey | UNIQUE |
| planos_servicos | planos_servicos_pkey | UNIQUE |
| portal_auth_sessions | idx_portal_auth_sessions_email | INDEX |
| portal_auth_sessions | idx_portal_auth_sessions_token | INDEX |
| portal_auth_sessions | portal_auth_sessions_pkey | UNIQUE |
| portal_auth_sessions | portal_auth_sessions_token_key | UNIQUE |
| portal_users | idx_portal_users_cnpj | INDEX |
| portal_users | idx_portal_users_email | INDEX |
| portal_users | portal_users_email_key | UNIQUE |
| portal_users | portal_users_pkey | UNIQUE |
| rh_notas_fiscais | idx_rh_notas_fiscais_colaborador | INDEX |
| rh_notas_fiscais | idx_rh_notas_fiscais_pagamento | INDEX |
| rh_notas_fiscais | rh_notas_fiscais_pkey | UNIQUE |
| rh_pagamentos | idx_rh_pagamentos_colaborador | INDEX |
| rh_pagamentos | idx_rh_pagamentos_periodo | INDEX |
| rh_pagamentos | rh_pagamentos_pkey | UNIQUE |
| sales_goals | idx_sales_goals_type_key | INDEX |
| sales_goals | sales_goals_goal_type_goal_key_period_month_period_year_key | UNIQUE |
| sales_goals | sales_goals_pkey | UNIQUE |
| servicos | servicos_pkey | UNIQUE |
| session | IDX_session_expire | INDEX |
| session | session_pkey | UNIQUE |
| squad_goals | squad_goals_pkey | UNIQUE |
| squad_metas | squad_metas_pkey | UNIQUE |
| squad_metas | squad_metas_squad_ano_mes_key | UNIQUE |
| system_field_options | system_field_options_field_type_value_key | UNIQUE |
| system_field_options | system_field_options_pkey | UNIQUE |
| system_fields | system_fields_field_key_key | UNIQUE |
| system_fields | system_fields_pkey | UNIQUE |
| turbo_avisos | turbo_avisos_pkey | UNIQUE |
| turbo_eventos | turbo_eventos_pkey | UNIQUE |
| turbodash_kpis | idx_turbodash_kpis_cliente_id | INDEX |
| turbodash_kpis | idx_turbodash_kpis_cnpj | INDEX |
| turbodash_kpis | turbodash_kpis_pkey | UNIQUE |

### sys (5 indexes)

| Tabela | Index | Tipo |
|--------|-------|------|
| catalog_aliases | catalog_aliases_pkey | UNIQUE |
| catalog_items | catalog_items_pkey | UNIQUE |
| catalogs | catalogs_pkey | UNIQUE |
| system_fields | system_fields_pkey | UNIQUE |
| validation_rules | validation_rules_pkey | UNIQUE |

---

> Documentacao gerada automaticamente a partir dos metadados do banco de dados PostgreSQL.
