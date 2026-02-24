# DATABASE.md - Documentacao Completa do Banco de Dados Cortex

## Visao Geral

| Item | Detalhe |
|------|---------|
| **Engine** | PostgreSQL |
| **Hospedagem** | Google Cloud SQL |
| **ORM** | Drizzle ORM (drizzle-orm/node-postgres) |
| **Pool** | pg.Pool (max 20 conexoes, SSL habilitado) |
| **Schema principal** | Definido em `shared/schema.ts` |

### Schemas do Banco

| Schema | Descricao | Tabelas Ativas |
|--------|-----------|----------------|
| `Bitrix` | CRM - deals, closers e usuarios | 3 |
| `Clickup` | Operacoes - clientes, contratos, tasks, tech | ~20 |
| `Conta Azul` | Financeiro - parcelas, receber, pagar, vendas | ~10 |
| `Inhire` | RH/People - pessoal, patrimonio, vagas, NPS | ~15 |
| `cortex_core` | Core do app - auth, catalogs, contratos, metricas, notificacoes | ~50+ |
| `google_ads` | Google Ads - campaigns, ad_groups, metricas | ~15 |
| `meta_ads` | Meta/Facebook Ads - campaigns, insights | ~7 |
| `public` | Tabelas compartilhadas / auxiliares | ~8 |
| `staging` | Copia staging de cortex_core | espelho |
| `sys` | Catalogs de sistema | ~5 |
| `kpi` | Metricas KPI | 1 |
| `gold_views` | Views refinadas (camada gold) | views |
| `admin` | Tabelas administrativas | 1 |

---

## Schema: Bitrix

CRM comercial - dados importados do Bitrix24.

### crm_deal
Deals/oportunidades do CRM.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico do deal |
| `title` | text | | Titulo do deal |
| `stage_id` | text | | Estagio do funil |
| `category_id` | integer | | ID da categoria/pipeline |
| `assigned_by_id` | integer | | ID do responsavel |
| `opportunity` | numeric | | Valor da oportunidade |
| `currency_id` | text | | Moeda |
| `date_create` | timestamp | | Data de criacao |
| `date_modify` | timestamp | | Data de modificacao |
| `closedate` | timestamp | | Data de fechamento |
| `closed` | text | | Se esta fechado |
| `won` | text | | Se foi ganho |
| `lost_reason` | text | | Motivo da perda |
| `comments` | text | | Comentarios |
| `source_id` | text | | Fonte do lead |
| `contact_id` | integer | | ID do contato |
| `company_id` | integer | | ID da empresa |

**Registros:** ~12.822
**Indexes:** `idx_crm_deal_assigned_by`, `idx_crm_deal_category`, `idx_crm_deal_date_create`, `idx_crm_deal_date_modify`, `idx_crm_deal_stage`

### crm_closers
Closers (vendedores) do CRM.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | integer | ID do closer |
| `name` | text | Nome |

**Registros:** ~31

### crm_users
Usuarios do Bitrix.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID do usuario |
| `name` | text | | Nome do usuario |

**Registros:** ~37

---

## Schema: Clickup

Dados operacionais importados do ClickUp - clientes, contratos, tasks.

### cup_clientes
Clientes gerenciados no ClickUp.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID interno |
| `cnpj` | text | UQ | CNPJ do cliente (chave de relacionamento com Conta Azul) |
| `nome` | text | | Nome do cliente |
| `status` | text | | Status do cliente |
| `telefone` | text | | Telefone |
| `responsavel` | text | | CS responsavel |
| `cluster` | text | | Cluster do cliente |
| `task_id` | text | | ID da task no ClickUp |
| `responsavel_geral` | text | | Responsavel geral |
| `site` | text | | Site do cliente |
| `email` | text | | Email |
| `instagram` | text | | Instagram |
| `links_contrato` | text | | Links dos contratos |
| `link_lista_clickup` | text | | Link da lista no ClickUp |
| `nome_dono` | text | | Nome do dono |
| `tipo_negocio` | text | | Tipo de negocio |
| `faturamento_mensal` | text | | Faturamento mensal |
| `investimento_ads` | text | | Investimento em ads |
| `status_conta` | text | | Status da conta |
| `vendedor` | text | | Vendedor responsavel |

**Registros:** ~1.177
**Indexes:** `idx_cup_clientes_cnpj`, `idx_cup_clientes_task_id`

### cup_contratos
Contratos dos clientes (subtasks no ClickUp).

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id_subtask` | text | PK | ID da subtask (contrato) |
| `id_task` | text | | ID da task pai (cliente) |
| `servico` | text | | Nome do servico |
| `status` | text | | Status do contrato |
| `valorr` | numeric | | Valor recorrente (MRR) |
| `valorp` | numeric | | Valor pontual |
| `data_inicio` | timestamp | | Data de inicio |
| `data_encerramento` | timestamp | | Data de encerramento |
| `data_pausa` | timestamp | | Data de pausa |
| `squad` | text | | Squad responsavel |
| `produto` | text | | Produto contratado |
| `data_solicitacao_encerramento` | timestamp | | Data da solicitacao de cancelamento |
| `responsavel` | text | | Responsavel operacional |
| `cs_responsavel` | text | | CS responsavel |
| `vendedor` | text | | Vendedor |
| `plano` | text | | Plano contratado |
| `motivo_cancelamento` | text | | Motivo do cancelamento |

**Registros:** ~2.113
**Indexes:** `idx_cup_contratos_id_subtask`, `idx_cup_contratos_id_task`, `idx_cup_contratos_status`

### cup_data_hist
Historico diario de contratos (snapshots).

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico |
| `data_snapshot` | timestamp | | Data do snapshot |
| `servico` | text | | Servico |
| `status` | text | | Status na data |
| `valorr` | numeric | | Valor recorrente na data |
| `valorp` | numeric | | Valor pontual na data |
| `id_task` | text | | ID do cliente |
| `id_subtask` | text | | ID do contrato |
| `data_inicio` | timestamp | | Data de inicio |
| `data_encerramento` | timestamp | | Data de encerramento |
| `data_pausa` | timestamp | | Data de pausa |
| `squad` | text | | Squad |
| `produto` | text | | Produto |
| `responsavel` | text | | Responsavel |
| `cs_responsavel` | text | | CS responsavel |
| `vendedor` | text | | Vendedor |

**Registros:** ~38.206

### cup_tasks
Tasks genericas do ClickUp.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | text | PK | ID da task |
| `name` | text | | Nome da task |
| `status` | text | | Status |
| `custom_fields` | text (JSONB) | | Custom fields como JSON |
| `list_id` | text | | ID da lista |
| `folder_id` | text | | ID da pasta |
| `space_id` | text | | ID do space |
| `date_created` | text | | Data de criacao |
| `date_updated` | text | | Data de atualizacao |
| `date_closed` | text | | Data de fechamento |
| `assignees` | text | | Assignees como JSON |

**Registros:** ~2.814

### cup_tech
Tasks do time de tecnologia.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `task_id` | text | PK | ID da task |
| `name` | text | | Nome da task |
| `status` | text | | Status |
| `assignees` | text | | Responsaveis |
| `custom_fields` | text | | Custom fields |
| `list_name` | text | | Nome da lista |
| `date_created` | text | | Data de criacao |
| `date_updated` | text | | Data de atualizacao |

**Registros:** ~545

### cup_tech_custom_fields
Custom fields das tasks de tech.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `task_id` | text | PK | ID da task (composta) |
| `field_id` | text | PK | ID do field (composta) |
| `field_name` | text | | Nome do campo |
| `field_type` | text | | Tipo do campo |
| `value` | text | | Valor |

**Registros:** ~1.372

### cup_freelas
Freelancers gerenciados no ClickUp.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `clickup_task_id` | text | PK | ID da task do freela |

**Registros:** ~1.069

### cup_projetos_tech / cup_projetos_tech_fechados
Projetos de tecnologia (abertos e fechados).

**Registros:** ~29 abertos / ~472 fechados

### Tabelas auxiliares do ClickUp
| Tabela | PK | Registros | Descricao |
|--------|-----|-----------|-----------|
| `cup_spaces` | space_id | 0 | Spaces do ClickUp |
| `cup_folders` | folder_id | 0 | Folders |
| `cup_lists` | (composite) | 1 | Listas |
| `cup_users` | user_id | 0 | Usuarios |
| `cup_tags` | (space_id, tag_name) | 0 | Tags |
| `cup_task_assignees` | (task_id, user_id) | 0 | Assignees |
| `cup_task_watchers` | (task_id, user_id) | 0 | Watchers |
| `cup_task_tags` | (task_id, space_id, tag_name) | 0 | Tags por task |
| `cup_custom_field_definitions` | field_id | 0 | Definicoes de campos |
| `cup_custom_field_values` | (task_id, field_id) | 0 | Valores de campos |
| `cup_tech_tasks` | - | 0 | Tasks tech (legado) |
| `cup_teams` | - | 1 | Times |

---

## Schema: Conta Azul

Dados financeiros importados do Conta Azul (ERP).

### caz_parcelas
Parcelas de receitas e despesas - **tabela principal do financeiro**.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico da parcela |
| `status` | text | | Status (PAGO, PENDENTE, VENCIDO) |
| `versao` | text | | Versao do registro |
| `indice` | text | | Indice da parcela |
| `conciliado` | text | | Se foi conciliado |
| `valor_pago` | numeric | | Valor efetivamente pago |
| `perda` | numeric | | Valor de perda |
| `nao_pago` | numeric | | Valor nao pago |
| `data_vencimento` | timestamp | | Data de vencimento |
| `data_pagamento_previsto` | timestamp | | Data prevista de pagamento |
| `descricao` | text | | Descricao da parcela |
| `nota` | text | | Nota fiscal |
| `metodo_pagamento` | text | | Metodo de pagamento |
| `baixa_agendada` | text | | Se baixa esta agendada |
| `valor_bruto` | numeric | | Valor bruto |
| `valor_liquido` | numeric | | Valor liquido |
| `desconto` | numeric | | Desconto |
| `multa` | numeric | | Multa |
| `juros` | numeric | | Juros |
| `taxa` | numeric | | Taxa |
| `id_evento` | text | | ID do evento (receita/despesa) |
| `tipo_evento` | text | | Tipo (receita ou despesa) |
| `id_conta_financeira` | text | | ID da conta financeira |
| `nome_conta_financeira` | text | | Nome da conta financeira |
| `tipo_conta_financeira` | text | | Tipo da conta financeira |
| `id_cliente` | text | | ID do cliente no Conta Azul |
| `url_cobranca` | text | | URL do boleto/cobranca |
| `status_solicitacao_cobranca` | text | | Status da cobranca |
| `data_quitacao` | timestamp | | Data de quitacao efetiva |
| `tipo_solicitacao_cobranca` | text | | Tipo de cobranca |
| `numero_fatura` | text | | Numero da fatura |
| `tipo_fatura` | text | | Tipo da fatura |
| `categoria_id` | text | | ID da categoria (separado por ;) |
| `categoria_nome` | text | | Nome da categoria (separado por ;) |
| `centro_custo_id` | text | | ID do centro de custo |
| `centro_custo_nome` | text | | Nome do centro de custo |
| `valor_centro_custo` | text | | Valor por centro de custo |
| `empresa` | text | | Empresa (multi-empresa) |
| `nome` | text | | Nome do pagador/recebedor |
| `valor_categoria` | text | | Valor por categoria |

**Registros:** ~19.939

### caz_receber
Contas a receber.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico |
| `status` | text | | Status |
| `total` | numeric | | Valor total |
| `descricao` | text | | Descricao |
| `data_vencimento` | timestamp | | Data de vencimento |
| `nao_pago` | numeric | | Valor nao pago |
| `pago` | numeric | | Valor pago |
| `data_criacao` | timestamp | | Data de criacao |
| `data_alteracao` | timestamp | | Data de alteracao |
| `cliente_id` | text | | ID do cliente |
| `cliente_nome` | text | | Nome do cliente |
| `empresa` | text | | Empresa |

**Registros:** ~13.047

### caz_pagar
Contas a pagar.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico |
| `status` | text | | Status |
| `total` | numeric | | Valor total |
| `descricao` | text | | Descricao |
| `data_vencimento` | timestamp | | Data de vencimento |
| `nao_pago` | numeric | | Valor nao pago |
| `pago` | numeric | | Valor pago |
| `data_criacao` | timestamp | | Data de criacao |
| `data_alteracao` | timestamp | | Data de alteracao |
| `fornecedor` | text | | Fornecedor |
| `nome` | text | | Nome |
| `empresa` | text | | Empresa |

**Registros:** ~14.783

### caz_clientes
Cadastro de clientes do Conta Azul.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico |
| `nome` | text | | Nome do cliente |
| `cnpj` | text | IDX | CNPJ (chave de join com ClickUp) |
| `email` | text | | Email |
| `telefone` | text | | Telefone |
| `endereco` | text | | Endereco |
| `ativo` | text | | Se esta ativo |
| `created_at` | timestamp | | Data de criacao |
| `empresa` | text | | Empresa |
| `ids` | text | UQ | IDs internos do Conta Azul |

**Registros:** ~2.891
**Indexes:** `idx_caz_clientes_cnpj`, `idx_caz_clientes_ids`, `idx_cnpj`

### caz_categorias
Categorias financeiras (plano de contas).

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | text | PK | ID da categoria |
| `nome` | text | | Nome da categoria |
| `tipo` | text | | Tipo (receita/despesa) |
| `empresa` | text | | Empresa |

**Registros:** ~130

### caz_bancos
Contas bancarias.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID do banco |
| `nome` | text | | Nome da conta |
| `balance` | numeric | | Saldo |
| `empresa` | text | | Empresa |
| `ativo` | text | | Se esta ativo |

**Registros:** ~15

### caz_vendas
Vendas registradas.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID da venda |

**Registros:** ~26.000

### caz_vendasbyid
Vendas indexadas por ID.

**Registros:** ~22.007

### caz_itensvenda
Itens de venda.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID da venda (composta) |
| `id_item` | integer | PK | ID do item (composta) |

**Registros:** ~1.034
**Constraint:** UNIQUE(id, id_item)

### caz_dre
DRE (Demonstracao do Resultado do Exercicio).

**Registros:** 0 (estrutura reservada)

### caz_vendedores
Vendedores do Conta Azul.

**Registros:** 0

---

## Schema: Inhire

Dados de RH/People - colaboradores, patrimonio, recrutamento, NPS.

### rh_pessoal
Cadastro de colaboradores.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico |
| `status` | varchar(50) | | Status (ativo, demitido, etc) |
| `nome` | varchar(150) | | Nome completo |
| `cpf` | varchar(14) | | CPF |
| `endereco` | text | | Endereco |
| `estado` | varchar(2) | | UF |
| `telefone` | varchar(20) | | Telefone |
| `aniversario` | date | | Data de aniversario |
| `admissao` | date | | Data de admissao |
| `demissao` | date | | Data de demissao |
| `tipo_demissao` | varchar(100) | | Tipo de demissao |
| `motivo_demissao` | text | | Motivo da demissao |
| `proporcional` | numeric | | Valor proporcional |
| `proporcional_caju` | numeric | | Valor proporcional Caju |
| `setor` | varchar(100) | | Setor |
| `squad` | varchar(100) | | Squad |
| `cargo` | varchar(100) | | Cargo |
| `nivel` | varchar(50) | | Nivel (junior, pleno, senior) |
| `pix` | varchar(200) | | Chave PIX |
| `cnpj` | varchar(18) | | CNPJ (PJ) |
| `email_turbo` | varchar(150) | | Email corporativo |
| `email_pessoal` | varchar(150) | | Email pessoal |
| `meses_de_turbo` | integer | | Meses na empresa |
| `ultimo_aumento` | date | | Data do ultimo aumento |
| `meses_ult_aumento` | integer | | Meses desde ultimo aumento |
| `salario` | numeric | | Salario |
| `user_id` | varchar(100) | | ID do usuario no sistema |

**Registros:** ~311

### rh_promocoes
Historico de promocoes.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico |
| `colaborador_id` | integer | | FK -> rh_pessoal.id |
| `data_promocao` | date | | Data da promocao |
| `cargo_anterior` | varchar(100) | | Cargo anterior |
| `cargo_novo` | varchar(100) | | Cargo novo |
| `nivel_anterior` | varchar(50) | | Nivel anterior |
| `nivel_novo` | varchar(50) | | Nivel novo |
| `salario_anterior` | numeric | | Salario anterior |
| `salario_novo` | numeric | | Salario novo |
| `observacoes` | text | | Observacoes |
| `criado_em` | timestamp | | Data de criacao |
| `criado_por` | varchar(100) | | Quem registrou |

**Registros:** ~113

### rh_patrimonio
Patrimonio / ativos da empresa.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | integer | PK | ID unico |
| `numero_ativo` | varchar(100) | | Numero do ativo |
| `ativo` | varchar(200) | | Nome/descricao do ativo |
| `marca` | varchar(150) | | Marca |
| `estado_conservacao` | varchar(100) | | Estado de conservacao |
| `responsavel_atual` | varchar(200) | | Responsavel atual |
| `responsavel_id` | integer | | FK -> rh_pessoal.id |
| `valor_pago` | numeric | | Valor de compra |
| `valor_mercado` | numeric | | Valor de mercado |
| `valor_venda` | numeric | | Valor de venda |
| `descricao` | text | | Descricao detalhada |
| `email` | varchar(200) | | Email do responsavel |

**Registros:** ~253

### rh_patrimonio_historico
Historico de movimentacao de patrimonio.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | integer | ID unico |
| `patrimonio_id` | integer | FK -> rh_patrimonio.id |
| `acao` | text | Acao realizada |
| `usuario` | text | Quem realizou |
| `data` | timestamp | Data da acao |

**Registros:** ~59
**FK:** `patrimonio_id` -> `rh_patrimonio.id`

### rh_nps
Respostas E-NPS anonimo.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `mes_referencia` | varchar(7) | | Mes de referencia (YYYY-MM) |
| `area` | varchar(100) | | Area do respondente |
| `motivo_permanencia` | text | | Por que permanece na empresa |
| `score_empresa` | integer | | Nota para a empresa (0-10) |
| `comentario_empresa` | text | | Comentario sobre a empresa |
| `score_lider` | integer | | Nota para o lider (0-10) |
| `comentario_lider` | text | | Comentario sobre o lider |
| `score_produtos` | integer | | Nota para os produtos (0-10) |
| `comentario_produtos` | text | | Comentario sobre produtos |
| `feedback_geral` | text | | Feedback geral |
| `criado_em` | timestamp | | Data de envio |

**Registros:** ~2

### rh_nps_config
Configuracao de periodo do E-NPS.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `mes_referencia` | varchar(7) | UQ | Mes de referencia |
| `data_inicio` | date | | Data de inicio da pesquisa |
| `data_fim` | date | | Data de fim da pesquisa |
| `ativo` | boolean | | Se esta ativo |
| `criado_em` | timestamp | | Data de criacao |
| `atualizado_em` | timestamp | | Data de atualizacao |

### rh_comentarios
Comentarios sobre colaboradores.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | integer | ID unico |
| `colaborador_id` | integer | FK -> rh_pessoal.id |
| `autor_id` | integer | FK -> rh_pessoal.id |
| `texto` | text | Texto do comentario |
| `criado_em` | timestamp | Data de criacao |

**FK:** `colaborador_id` -> `rh_pessoal.id`, `autor_id` -> `rh_pessoal.id`

### rh_one_on_one
Registros de reunioes 1:1.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | integer | ID unico |
| `colaborador_id` | integer | FK -> rh_pessoal.id |
| `lider_id` | integer | FK -> rh_pessoal.id |

**Registros:** ~3
**FK:** `colaborador_id` -> `rh_pessoal.id`, `lider_id` -> `rh_pessoal.id`

### rh_enps
E-NPS vinculado ao colaborador.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `colaborador_id` | integer | FK -> rh_pessoal.id |

**FK:** `colaborador_id` -> `rh_pessoal.id`

### rh_pdi
Plano de Desenvolvimento Individual.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `colaborador_id` | integer | FK -> rh_pessoal.id |

**FK:** `colaborador_id` -> `rh_pessoal.id`

### Tabelas auxiliares do Inhire
| Tabela | Registros | Descricao |
|--------|-----------|-----------|
| `rh_cargos` | config | Catalogo de cargos disponiveis |
| `rh_niveis` | config | Catalogo de niveis (jr, pl, sr) |
| `rh_squads` | config | Catalogo de squads |
| `rh_candidaturas` | ~2.633 | Candidaturas de recrutamento |
| `rh_talentos` | ~367 | Banco de talentos |
| `rh_vagas` | ~31 | Vagas abertas |
| `rh_telefones` | ~21 | Telefones adicionais |
| `rh_notas_fiscais` | 0 | Notas fiscais de PJ |
| `rh_pagamentos` | 0 | Pagamentos |

---

## Schema: cortex_core

Core do aplicativo Cortex - autenticacao, catalogs, contratos, metricas, notificacoes.

### auth_users
Usuarios autenticados (Google OAuth).

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | varchar(100) | PK | ID unico |
| `google_id` | varchar(100) | UQ | Google ID |
| `email` | varchar(255) | | Email |
| `name` | varchar(255) | | Nome |
| `picture` | text | | URL da foto |
| `created_at` | timestamp | | Data de criacao |
| `role` | varchar(20) | | Papel (user, admin) |
| `allowed_routes` | text[] | | Rotas permitidas |
| `department` | varchar(50) | | Departamento |

**Registros:** ~91

### session
Sessoes de autenticacao.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `sid` | varchar | PK | Session ID |
| `sess` | json | | Dados da sessao |
| `expire` | timestamp | | Expiracao |

**Registros:** ~59

### Catalogs (Sistema de Catalogos)

Sistema generico de catalogos para normalizar dados de contratos.

#### catalogs
| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID auto |
| `catalog_key` | varchar(100) | UQ | Chave unica do catalogo |
| `name` | varchar(255) | | Nome do catalogo |

**Registros:** 8

#### catalog_items
| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID auto |
| `catalog_key` | varchar(100) | FK | FK -> catalogs.catalog_key |
| `slug` | varchar(100) | UQ | Slug unico |
| `name` | varchar(255) | | Nome do item |

**Registros:** 68

#### catalog_aliases
| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID auto |
| `catalog_key` | varchar(100) | FK | FK -> catalog_items.catalog_key |
| `slug` | varchar(100) | FK | FK -> catalog_items.slug |
| `alias` | varchar(255) | | Alias (nome alternativo) |

**Registros:** 201

#### Catalogos Especializados

| Tabela | Registros | Campos Extras | Descricao |
|--------|-----------|---------------|-----------|
| `catalog_products` | 22 | `bp_segment` | Produtos (Performance, Creators, Social Media...) |
| `catalog_plans` | 6 | - | Planos (Starter, Scale, Enterprise...) |
| `catalog_squads` | 12 | `is_off` | Squads (Squadra, Makers, Pulse, Tech...) |
| `catalog_clusters` | 5 | - | Clusters (Regulares, Imperdiveis, Chaves, NFNC) |
| `catalog_contract_status` | 7 | `counts_as_operating` | Status contrato (Triagem, Onboarding, Ativo, Pausado...) |
| `catalog_account_health` | 3 | - | Saude da conta (Saudavel, Atencao, Insatisfeito) |
| `catalog_roi_bucket` | 4 | - | Faixas de ROI |
| `catalog_churn_reason` | 9 | - | Motivos de churn |

Cada catalogo tem a estrutura: `id SERIAL PK, slug VARCHAR(100) UNIQUE, name VARCHAR(255), active BOOLEAN, sort_order INTEGER, created_at TIMESTAMP`

### Contratos (Sistema Interno)

#### entidades
Entidades/clientes no sistema interno.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `nome` | text | | Nome da entidade |
| `cnpj` | text | | CNPJ |

**Registros:** ~269

#### contratos
Contratos do sistema interno.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `entidade_id` | integer | FK | FK -> entidades.id |
| `status` | text | | Status |

**Registros:** ~275
**FK:** `entidade_id` -> `entidades.id`

#### contratos_itens
Itens de cada contrato.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `contrato_id` | integer | FK | FK -> contratos.id |
| `plano_servico_id` | integer | FK | FK -> planos_servicos.id |

**Registros:** ~430
**FK:** `contrato_id` -> `contratos.id`, `plano_servico_id` -> `planos_servicos.id`

#### servicos
Catalogo de servicos.

**Registros:** ~26

#### planos_servicos
Planos vinculados a servicos.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | serial | ID unico |
| `servico_id` | integer | FK -> servicos.id |

**Registros:** ~48
**FK:** `servico_id` -> `servicos.id`

#### Tabelas auxiliares de contratos
| Tabela | FK | Registros | Descricao |
|--------|----|-----------|-----------|
| `aditivos` | contrato_id -> contratos.id | 0 | Aditivos contratuais |
| `aditivo_servicos` | aditivo_id -> aditivos.id, plano_servico_id -> planos_servicos.id | 0 | Servicos do aditivo |
| `contract_attachments` | contract_id -> contratos.id | 0 | Anexos do contrato |
| `contract_signatures` | contract_id -> contratos.id | 0 | Assinaturas digitais |
| `contract_status_history` | contract_id -> contratos.id | 0 | Historico de status |
| `document_status_changes` | contrato_id -> contratos.id | 0 | Mudancas de status do documento |
| `pdfs_contratos` | contrato_id -> contratos.id | 0 | PDFs gerados |
| `contrato_servicos` | contrato_id -> contratos.id | 0 | Servicos do contrato |
| `faturas` | contrato_id -> contratos.id, cliente_id -> entidades.id | 0 | Faturas |
| `faturas_itens` | fatura_id -> faturas.id, contrato_item_id -> contratos_itens.id | 0 | Itens da fatura |

### Metricas e KPIs

#### metrics_registry_extended
Registro de metricas do sistema.

**Registros:** ~38

#### metric_targets_monthly
Metas mensais por metrica.

**Registros:** ~2.079

#### metric_rulesets
Regras de calculo de metricas.

**Registros:** ~2

#### metric_thresholds
Thresholds de alerta por metrica.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `ruleset_id` | integer | FK -> metric_rulesets.id |

**Registros:** ~5
**FK:** `ruleset_id` -> `metric_rulesets.id`

#### metric_actuals_monthly / metric_overrides_monthly / metric_actual_overrides_monthly
Valores realizados e overrides mensais de metricas.

### Notificacoes

#### notifications
Sistema de notificacoes internas.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `type` | text | | Tipo (inadimplencia, contrato_vencendo, aniversario) |
| `title` | text | | Titulo |
| `message` | text | | Mensagem |
| `entity_id` | text | | ID da entidade relacionada |
| `entity_type` | text | | Tipo da entidade |
| `priority` | text | | Prioridade (low, medium, high) |
| `read` | boolean | | Se foi lida |
| `dismissed` | boolean | | Se foi dispensada |
| `created_at` | timestamp | | Data de criacao |
| `expires_at` | timestamp | | Data de expiracao |
| `unique_key` | text | UQ | Chave unica (evita duplicatas) |

**Registros:** ~5.427

#### notification_rules
Regras de notificacao.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `rule_type` | text | | Tipo da regra |
| `name` | text | | Nome |
| `description` | text | | Descricao |
| `is_enabled` | boolean | | Se esta habilitada |
| `config` | text | | Configuracao (JSON) |

**Registros:** ~3 (inadimplencia, contrato_vencendo, aniversario)

### Chat (Atendimento ao Cliente)

#### chat_conversas
Conversas de atendimento.

| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `id` | serial | PK | ID unico |
| `cliente_id` | integer | FK | FK -> portal_users.id |
| `status` | varchar | | Status (open, waiting, closed) |
| `responsavel_apelido` | text | | Apelido do responsavel |
| `primeira_resposta_em` | timestamp | | Timestamp da primeira resposta |
| `closed_at` | timestamp | | Data de fechamento |
| `created_at` | timestamp | | Data de criacao |

**Registros:** ~6
**FK:** `cliente_id` -> `portal_users.id`

#### chat_mensagens
Mensagens das conversas.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `conversa_id` | integer | FK -> chat_conversas.id |

**Registros:** ~31
**FK:** `conversa_id` -> `chat_conversas.id`

### Portal do Cliente

#### portal_users
Usuarios do portal do cliente.

**Registros:** ~3

#### portal_auth_sessions
Sessoes de auth do portal.

**Registros:** ~4

### Outras tabelas cortex_core

| Tabela | Registros | Descricao |
|--------|-----------|-----------|
| `clients` | 386 | Clientes internos |
| `credentials` | 1.162 | Credenciais de acesso de clientes |
| `contract_status_map` | 10 | Mapeamento de status de contratos |
| `access_logs` | 54 | Logs de acesso |
| `auth_logs` | 3 | Logs de autenticacao |
| `system_logs` | 4 | Logs do sistema |
| `sync_logs` | 6 | Logs de sincronizacao |
| `audit_log` | 0 | Log de auditoria |
| `system_fields` | 31 | Campos de sistema |
| `system_field_options` | 35 | Opcoes de campos |
| `validation_rules` | 7 | Regras de validacao |
| `data_reconciliation` | 2 | Reconciliacao de dados |
| `contratos_colaboradores_status` | 185 | Status de colaboradores em contratos |
| `inadimplencia_contextos` | 127 | Contextos de inadimplencia |
| `juridico_regras_escalonamento` | 3 | Regras de escalonamento juridico |
| `tarefas_clientes` | 21.403 | Tarefas vinculadas a clientes |
| `courses` | 67 | Cursos |
| `agentesdr_sorisos` | 290 | Agentes DR Sorisos |
| `assinafy_config` | 2 | Config do Assinafy |
| `benefits` | 34 | Beneficios |
| `bp_snapshots` | 2 | Snapshots de Business Plan |
| `dashboard_views` | 4 | Views do dashboard |
| `dashboard_cards` | 0 | Cards do dashboard |
| `dfc` | 0 | Fluxo de caixa (base) |
| `dfc_mensal_backup` | 4.092 | Backup do DFC mensal |
| `dfc_snapshots` | 1 | Snapshots do fluxo de caixa |
| `clientes_faturamento` | 0 | Faturamento por cliente |
| `onboarding_templates` | 1 | Templates de onboarding |
| `onboarding_etapas` | 0 | Etapas de onboarding |
| `onboarding_colaborador` | 0 | Onboarding de colaborador |
| `onboarding_progresso` | 0 | Progresso do onboarding |
| `turbo_avisos` | 1 | Avisos internos |
| `turbo_eventos` | 16 | Eventos internos |
| `turbo_tools` | 152 | Ferramentas internas |
| `turbodash_kpis` | 2 | KPIs do dashboard |
| `sales_goals` | 3 | Metas de vendas |
| `squad_goals` | 16 | Metas por squad |
| `squad_metas` | 0 | Metas de squad (v2) |
| `sugestoes` | 1 | Caixa de sugestoes |
| `unavailability_requests` | 1 | Solicitacoes de ausencia |
| `kr_checkins` | 0 | Checkins de Key Results |
| `cup_spaces` | 6 | Spaces do ClickUp (cache) |
| `cup_folders` | 20 | Folders do ClickUp (cache) |
| `cup_tech_tasks` | 73 | Tasks tech (cache) |

---

## Schema: google_ads

Dados do Google Ads - contas, campanhas, grupos de anuncios e metricas.

### accounts
| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `account_key` | serial | PK | Chave interna |
| `customer_id` | text | | ID da conta Google Ads |

**Registros:** ~66

### campaigns
| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `campaign_key` | serial | PK | Chave interna |
| `account_key` | integer | FK | FK -> accounts.account_key |
| `campaign_id` | text | | ID da campanha no Google Ads |
| `name` | text | | Nome da campanha |
| `status` | text | | Status |

**Registros:** ~864

### ad_groups
| Coluna | Tipo | PK | Descricao |
|--------|------|:--:|-----------|
| `ad_group_key` | serial | PK | Chave interna |
| `campaign_key` | integer | FK | FK -> campaigns.campaign_key |
| `ad_group_id` | text | | ID do grupo no Google Ads |
| `name` | text | | Nome |
| `status` | text | | Status |

**Registros:** ~1.634

### ads
Anuncios individuais.

**Registros:** ~2.971

### campaign_daily_metrics (particionada)
Metricas diarias por campanha. Particionada por mes (YYYY_MM).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `campaign_key` | integer | FK -> campaigns.campaign_key |
| `report_date` | date | Data do relatorio |
| `device_type` | text | Tipo de dispositivo |
| `network_type` | text | Tipo de rede |
| `impressions` | bigint | Impressoes |
| `clicks` | bigint | Cliques |
| `cost_micros` | bigint | Custo em micros |
| `conversions` | numeric | Conversoes |
| `conversion_value` | numeric | Valor de conversao |
| `all_conversions` | numeric | Todas conversoes |
| `view_through_conversions` | bigint | Conversoes view-through |
| `interactions` | bigint | Interacoes |
| `engagement_rate` | numeric | Taxa de engajamento |
| `video_views` | bigint | Views de video |

**Particoes:** `_2024_11`, `_2025_10`, `_2025_11`, `_2025_12`

### ad_group_daily_metrics (particionada)
Metricas diarias por grupo de anuncio. Mesma estrutura, particionada por mes.

**FK:** `ad_group_key` -> `ad_groups.ad_group_key`

### Outras tabelas google_ads
| Tabela | Registros | Descricao |
|--------|-----------|-----------|
| `keywords` | 0 | Palavras-chave |
| `keyword_daily_metrics` | 0 | Metricas por keyword (particionada) |
| `campaign_budgets` | 0 | Orcamentos de campanhas |
| `campaign_geo_targets` | 0 | Segmentacao geografica |
| `geographic_targets` | 0 | Targets geograficos |
| `load_runs` | 0 | Logs de carregamento |

---

## Schema: meta_ads

Dados do Meta/Facebook Ads.

### meta_accounts
Contas de anuncio do Meta.

**Registros:** ~2

### meta_campaigns
Campanhas do Meta.

**Registros:** ~114

### meta_adsets
Conjuntos de anuncios.

**Registros:** ~312

### meta_ads
Anuncios individuais.

**Registros:** ~732

### meta_insights_daily
Metricas diarias de performance.

**Registros:** ~7.114

### meta_creatives
Criativos dos anuncios.

**Registros:** 0

### metas_diarias
Metas diarias de investimento.

**Registros:** ~61

---

## Schema: public

Tabelas auxiliares compartilhadas.

| Tabela | Registros | Descricao |
|--------|-----------|-----------|
| `aux_responsaveis` | 42 | Responsaveis auxiliares |
| `catalog_products` | 22 | Produtos (duplicata) |
| `cup_lists` | 0 | Listas ClickUp |
| `cup_tasks` | 0 | Tasks ClickUp |
| `dashboard_views` | 0 | Views dashboard |
| `notification_rules` | 3 | Regras de notificacao |
| `onboarding_templates` | 0 | Templates de onboarding |
| `system_field_options` | 0 | Opcoes de campos |
| `system_fields` | 31 | Campos de sistema |
| `users` | - | Usuarios da aplicacao |

---

## Schema: sys

Catalogs de sistema (espelho/base).

| Tabela | Registros | Descricao |
|--------|-----------|-----------|
| `catalogs` | 8 | Catalogos base |
| `catalog_items` | 68 | Itens dos catalogos |
| `catalog_aliases` | 201 | Aliases dos catalogos |
| `system_fields` | 24 | Campos de sistema |
| `validation_rules` | 7 | Regras de validacao |

---

## Views

### cortex_core.clientes
Unifica clientes ClickUp + Conta Azul via CNPJ.
```sql
SELECT cup.cnpj, cup.nome, cup.status, cup.telefone, cup.responsavel,
       cup.cluster, cup.status_conta, cup.responsavel_geral,
       caz.endereco, caz.empresa, caz.ids
FROM "Clickup".cup_clientes cup
LEFT JOIN "Conta Azul".caz_clientes caz ON cup.cnpj = caz.cnpj::text
```

### cortex_core.cup_cnpj
Extrai CNPJ de custom fields do ClickUp para relacionamento.
- Extrai CNPJ do campo `f02eaef1-529e-49f3-bad5-38ca2813fc12`
- Extrai status da conta do campo `bea467ac-244d-4f2a-ac35-62019e8f6bea`
- Extrai CS responsavel do campo `5df72d40-b3ca-44d1-a174-eea9f85c239f`

### cortex_core.dfc_completa
Fluxo de caixa completo - classifica parcelas como Entrada/Saida.
- JOIN com `caz_clientes` via `id_cliente = ids`
- Split de categorias multi-valor (separadas por `;`)
- Classifica impostos (ISS, INSS, IRRF) como Saida mesmo sendo receita

### cortex_core.dfc_mensal
DFC mensal agrupado por data de quitacao.
- Classifica por nivel (03-04 = RECEITA, 05-07 = DESPESA)
- Hierarquia: subnivel_1 -> subnivel_2 -> subnivel_3

### cortex_core.dfc_mensal_expandida
Versao expandida do DFC mensal com split de categorias.
- Expande categorias separadas por `;`
- Filtra apenas receitas (prefixos 03.xx e 04.xx)

### cortex_core.dfc_nova
Nova versao do DFC com tratamento de categorias duplicadas.
- Usa CTEs (raw -> flags -> filtered -> split_cats)
- Prioriza categorias de receita quando existem multiplas

### cortex_core.dfc_nova_com_hierarquia
DFC com hierarquia completa de categorias.
- Gera linhas de nivel pai automaticamente
- UNION de nivel_real + nivel_pai_2 + nivel_pai_1

### cortex_core.vw_chat_metricas_realtime
Metricas real-time de chat por responsavel.
- Conversas abertas, aguardando, fechadas hoje
- Tempo medio de primeira resposta
- Tempo medio de atendimento

### cortex_core.vw_cohort_contratos
Analise de cohort de contratos.
- Agrupa por mes de inicio (cohort_month)
- Calcula retencao percentual por idade em meses
- Gera series mensais via `generate_series`

### cortex_core.vw_cohort_detalhada
Cohort detalhada com dados completos do contrato.
- Inclui servico, squad, produto, vendedor, motivo de cancelamento

### gold_views.clientes
Visao unificada de clientes (Conta Azul + ClickUp).
```sql
SELECT cup.nome, caz.cnpj, caz.email, caz.telefone, cup.telefone AS celular,
       caz.endereco, caz.ids AS id_ca, cup.task_id AS id_clickup,
       cup.responsavel AS cx, cup.vendedor, cup.status
FROM "Conta Azul".caz_clientes caz
LEFT JOIN "Clickup".cup_clientes cup ON cup.cnpj = caz.cnpj::text
```

### public.vw_contratos_canon
Contratos canonizados com slugs dos catalogos.
- JOIN com `catalog_aliases` para normalizar produto, squad e status
- Calcula `mrr_value_cents` (valor * 100)

### google_ads.vw_campaign_performance
Performance de campanhas Google Ads.
- JOIN: `campaign_daily_metrics` -> `campaigns` -> `accounts`

### staging.vw_chat_metricas_realtime
Espelho da view de chat do cortex_core no staging.

---

## Relacionamentos Principais (Foreign Keys)

### Inhire (RH)
```
rh_comentarios.colaborador_id  -> rh_pessoal.id
rh_comentarios.autor_id        -> rh_pessoal.id
rh_enps.colaborador_id         -> rh_pessoal.id
rh_one_on_one.colaborador_id   -> rh_pessoal.id
rh_one_on_one.lider_id         -> rh_pessoal.id
rh_patrimonio_historico.patrimonio_id -> rh_patrimonio.id
rh_pdi.colaborador_id          -> rh_pessoal.id
```

### cortex_core (Contratos)
```
contratos.entidade_id               -> entidades.id
contratos_itens.contrato_id         -> contratos.id
contratos_itens.plano_servico_id    -> planos_servicos.id
planos_servicos.servico_id          -> servicos.id
aditivos.contrato_id                -> contratos.id
aditivo_servicos.aditivo_id         -> aditivos.id
aditivo_servicos.plano_servico_id   -> planos_servicos.id
contract_attachments.contract_id    -> contratos.id
contract_signatures.contract_id     -> contratos.id
contract_status_history.contract_id -> contratos.id
contrato_servicos.contrato_id       -> contratos.id
document_status_changes.contrato_id -> contratos.id
pdfs_contratos.contrato_id          -> contratos.id
faturas.contrato_id                 -> contratos.id
faturas.cliente_id                  -> entidades.id
faturas_itens.fatura_id             -> faturas.id
faturas_itens.contrato_item_id      -> contratos_itens.id
```

### cortex_core (Catalogs)
```
catalog_items.catalog_key      -> catalogs.catalog_key
catalog_aliases.(catalog_key, slug) -> catalog_items.(catalog_key, slug)
```

### cortex_core (Outros)
```
credentials.client_id               -> clients.id
chat_conversas.cliente_id            -> portal_users.id
chat_mensagens.conversa_id           -> chat_conversas.id
clientes_faturamento.cliente_id      -> entidades.id
metric_thresholds.ruleset_id         -> metric_rulesets.id
```

### google_ads
```
campaigns.account_key                         -> accounts.account_key
ad_groups.campaign_key                        -> campaigns.campaign_key
campaign_daily_metrics.campaign_key           -> campaigns.campaign_key
ad_group_daily_metrics.ad_group_key           -> ad_groups.ad_group_key
```

### Relacionamento Cross-Schema (Logico via CNPJ)
```
"Clickup".cup_clientes.cnpj  <-->  "Conta Azul".caz_clientes.cnpj
"Conta Azul".caz_parcelas.id_cliente  <-->  "Conta Azul".caz_clientes.ids
"Clickup".cup_contratos.id_task  <-->  "Clickup".cup_clientes.task_id
```

---

## Diagrama de Relacionamento (Simplificado)

```
                    +-----------------+
                    |   Bitrix CRM    |
                    |   crm_deal      |
                    |   crm_closers   |
                    |   crm_users     |
                    +-----------------+

+-------------------+        CNPJ         +-------------------+
|    Clickup        | <=================> |   Conta Azul      |
|  cup_clientes     |                     |  caz_clientes     |
|       |           |                     |       |           |
|  cup_contratos    |                     |  caz_parcelas     |
|       |           |                     |  caz_receber      |
|  cup_data_hist    |                     |  caz_pagar        |
|  cup_tasks        |                     |  caz_vendas       |
|  cup_tech         |                     |  caz_categorias   |
|  cup_freelas      |                     |  caz_bancos       |
+-------------------+                     +-------------------+

+-------------------+                     +-------------------+
|   cortex_core     |                     |     Inhire        |
|  auth_users       |                     |  rh_pessoal       |
|  catalogs         |                     |     |-- rh_promocoes
|  catalog_items    |                     |     |-- rh_comentarios
|  entidades        |                     |     |-- rh_one_on_one
|     |-- contratos |                     |     |-- rh_enps
|     |-- faturas   |                     |     |-- rh_pdi
|  notifications    |                     |  rh_patrimonio    |
|  chat_conversas   |                     |     |-- rh_patrimonio_hist
|  metrics_*        |                     |  rh_candidaturas  |
|  clients          |                     |  rh_talentos      |
|     |-- credentials                    |  rh_nps (anonimo) |
+-------------------+                     +-------------------+

+-------------------+                     +-------------------+
|   google_ads      |                     |    meta_ads       |
|  accounts         |                     |  meta_accounts    |
|     |-- campaigns |                     |  meta_campaigns   |
|         |-- ad_groups                   |  meta_adsets      |
|         |-- campaign_daily_metrics      |  meta_ads         |
|             |-- ad_group_daily_metrics  |  meta_insights    |
+-------------------+                     +-------------------+
```

---

## Notas Tecnicas

### Multi-empresa
O campo `empresa` esta presente em varias tabelas do Conta Azul (`caz_parcelas`, `caz_receber`, `caz_pagar`, `caz_clientes`), permitindo filtrar por empresa do grupo.

### Categorias Multi-valor
Na `caz_parcelas`, as colunas `categoria_id`, `categoria_nome` e `valor_categoria` podem conter multiplos valores separados por `;`. As views `dfc_*` tratam esse split.

### Particionamento
Tabelas de metricas do Google Ads sao particionadas por mes (sufixo `_YYYY_MM`) para performance.

### Schemas Staging vs Core
O schema `staging` e um espelho do `cortex_core` usado para desenvolvimento. Muitas tabelas tem estrutura identica.

### Hierarquia de Categorias (Plano de Contas)
```
03.xx = Receitas Operacionais
04.xx = Receitas Nao Operacionais
05.xx = Custos Operacionais
06.xx = Despesas Operacionais
07.xx = Despesas Nao Operacionais
```
