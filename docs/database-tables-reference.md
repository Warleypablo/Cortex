# Referência de Tabelas do Banco de Dados

Documentação das principais tabelas utilizadas no Cortex para integração entre ClickUp (operações), Conta Azul (financeiro) e Bitrix (CRM comercial).

---

## "Clickup".cup_clientes

Tabela de clientes importada do ClickUp. Cada registro representa um cliente (task) na lista de clientes.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | integer | Sim | ID interno sequencial |
| `task_id` | text | Sim | ID da task no ClickUp (ex: "86agr5akn"). **Chave de relacionamento com cup_contratos** |
| `nome` | text | Não | Nome do cliente |
| `cnpj` | text | Não | CNPJ do cliente. **Chave de relacionamento com caz_clientes** (via normalização) |
| `status` | text | Não | Status do cliente (ex: "ativo", "triagem", "cancelado/inativo") |
| `telefone` | varchar | Não | Telefone de contato |
| `email` | text | Não | Email de contato |
| `responsavel` | text | Não | Responsável pelo atendimento do cliente |
| `responsavel_geral` | text | Não | Responsável geral/gestor da conta |
| `segmento` | varchar | Não | Segmento de mercado do cliente |
| `cluster` | varchar | Não | Cluster/agrupamento do cliente |
| `status_conta` | varchar | Não | Saúde da conta (ex: "Saudavel") |
| `servico` | text | Não | Serviço principal contratado |
| `tipo` | text | Não | Tipo de negócio (ex: "Ecommerce") |
| `squad` | text | Não | Squad responsável |
| `subtask_ids` | text | Não | IDs das subtasks (contratos) associadas |
| `motivo_cancelamento` | text | Não | Motivo do cancelamento, se aplicável |
| `valorr` | text | Não | Valor recorrente (agregado dos contratos) |
| `reteve` | text | Não | Indicador se o cliente foi retido |
| `link_lista_clickup` | text | Não | Link para a lista do cliente no ClickUp |
| `site` | text | Não | Site do cliente |
| `instagram` | text | Não | Instagram do cliente |
| `links_contrato` | text | Não | Links dos contratos |
| `nome_dono` | text | Não | Nome do dono/sócio da empresa |
| `vendedor` | text | Não | Vendedor que fechou o contrato |

**Relacionamentos:**
- `task_id` → `cup_contratos.id_task` (1:N — um cliente pode ter vários contratos)
- `cnpj` → `caz_clientes.cnpj` (via normalização, removendo pontuação)

---

## "Clickup".cup_contratos

Tabela de contratos/serviços importada do ClickUp. Cada registro é uma subtask representando um contrato específico de um cliente.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id_subtask` | text | Sim | ID da subtask no ClickUp. **Chave primária** |
| `id_task` | text | Não | ID da task pai (cliente). **FK → cup_clientes.task_id** |
| `servico` | varchar | Não | Nome do serviço contratado (ex: "Creators Recorrente - Enterprise") |
| `status` | text | Não | Status do contrato: "ativo", "cancelado/inativo", "entregue", "em cancelamento", "triagem", "onboarding", "pausado", "não usar" |
| `valorr` | numeric | Não | **Valor recorrente mensal** do contrato (R$) |
| `valorp` | numeric | Não | **Valor pontual total** do contrato (R$). Pode ser parcelado no Conta Azul |
| `squad` | text | Não | Squad responsável pela execução do serviço |
| `produto` | text | Não | Produto/tipo de serviço |
| `plano` | text | Não | Plano contratado |
| `responsavel` | text | Não | Responsável operacional pelo contrato |
| `cs_responsavel` | text | Não | Customer Success responsável |
| `vendedor` | text | Não | Vendedor que fechou o contrato |
| `data_inicio` | date | Não | Data de início do contrato |
| `data_encerramento` | date | Não | Data de encerramento do contrato |
| `data_solicitacao_encerramento` | date | Não | Data em que o cancelamento foi solicitado |
| `data_pausa` | date | Não | Data de pausa do contrato |
| `data_criado` | date | Não | Data de criação da subtask no ClickUp |
| `data_entrega` | date | Não | Data de entrega (para serviços pontuais) |
| `motivo_cancelamento` | text | Não | Motivo do cancelamento |

**Status possíveis e significado:**
- `ativo` — contrato em execução
- `onboarding` — cliente em fase de integração
- `triagem` — contrato em avaliação/setup
- `em cancelamento` — cancelamento em andamento, mas serviço ainda pode estar sendo prestado
- `pausado` — contrato temporariamente pausado
- `entregue` — serviço pontual finalizado
- `cancelado/inativo` — contrato encerrado
- `não usar` — registro inválido/duplicado

**Nota sobre valorr vs valorp:**
- `valorr` = valor recorrente mensal que o squad fatura
- `valorp` = valor pontual total (pode ser parcelado no financeiro, ex: R$ 20k parcelado em 10x de R$ 2k)

---

## "Conta Azul".caz_clientes

Tabela de clientes do sistema financeiro Conta Azul.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | integer | Sim | ID interno sequencial |
| `ids` | varchar | Não | **UUID do Conta Azul**. Chave de relacionamento com caz_parcelas.id_cliente |
| `nome` | varchar | Sim | Nome do cliente (formato: "Nome Fantasia (Razão Social)") |
| `cnpj` | varchar | Sim | CPF ou CNPJ do cliente (pode vir com ou sem pontuação) |
| `email` | varchar | Não | Email do cliente |
| `telefone` | varchar | Não | Telefone do cliente |
| `endereco` | text | Não | Endereço completo |
| `ativo` | boolean | Não | Se o cliente está ativo no Conta Azul |
| `empresa` | varchar | Não | Empresa do Conta Azul (ex: "Turbo Partners") |
| `created_at` | timestamp | Não | Data de criação do registro |
| `updated_at` | timestamp | Não | Data da última atualização |

**Relacionamentos:**
- `ids` → `caz_parcelas.id_cliente` (1:N — um cliente tem várias parcelas)
- `cnpj` → `cup_clientes.cnpj` (via normalização — ponte entre financeiro e operações)

---

## "Conta Azul".caz_parcelas

Tabela de parcelas/lançamentos financeiros do Conta Azul. Cada registro é uma parcela de uma venda ou despesa.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | uuid | Sim | UUID da parcela no Conta Azul. **Chave primária** |
| `id_evento` | uuid | Não | UUID do evento (venda/compra) que originou a parcela |
| `id_cliente` | uuid | Não | **UUID do cliente no Conta Azul. FK → caz_clientes.ids** |
| `status` | varchar | Não | Status da parcela: "QUITADO", "PENDENTE", "VENCIDO" |
| `tipo_evento` | varchar | Não | Tipo: "RECEITA" ou "DESPESA" |
| `valor_pago` | numeric | Não | Valor efetivamente pago |
| `valor_bruto` | numeric | Não | Valor bruto da parcela |
| `valor_liquido` | numeric | Não | Valor líquido (após descontos/taxas) |
| `desconto` | numeric | Não | Valor de desconto aplicado |
| `multa` | numeric | Não | Valor de multa |
| `juros` | numeric | Não | Valor de juros |
| `taxa` | numeric | Não | Taxas aplicadas |
| `perda` | numeric | Não | Valor de perda/write-off |
| `nao_pago` | numeric | Não | Valor não pago |
| `data_vencimento` | date | Não | Data de vencimento da parcela |
| `data_pagamento_previsto` | date | Não | Data prevista para pagamento |
| `data_quitacao` | date | Não | **Data efetiva do pagamento**. Usada para agrupar receita por mês |
| `data_competencia` | date | Não | Data de competência contábil |
| `descricao` | text | Não | Descrição do lançamento |
| `nota` | text | Não | Observações |
| `metodo_pagamento` | varchar | Não | Método: "PIX_PAGAMENTO_INSTANTANEO", "BOLETO_BANCARIO", "CARTAO_CREDITO", etc. |
| `conciliado` | boolean | Não | Se a parcela foi conciliada bancariamente |
| `baixa_agendada` | boolean | Não | Se existe baixa automática agendada |
| `versao` | integer | Não | Versão do registro |
| `indice` | integer | Não | Índice da parcela (ex: 1 de 10) |
| `id_conta_financeira` | uuid | Não | UUID da conta bancária |
| `nome_conta_financeira` | varchar | Não | Nome da conta (ex: "Itau Conta Corrente") |
| `tipo_conta_financeira` | varchar | Não | Tipo da conta (ex: "CONTA_CORRENTE") |
| `url_cobranca` | text | Não | Link da fatura/boleto |
| `status_solicitacao_cobranca` | varchar | Não | Status da cobrança enviada |
| `tipo_solicitacao_cobranca` | varchar | Não | Tipo de cobrança (ex: "BOLETO") |
| `numero_fatura` | integer | Não | Número da fatura |
| `tipo_fatura` | varchar | Não | Tipo da fatura |
| `categoria_id` | text | Não | UUID da categoria contábil |
| `categoria_nome` | text | Não | Nome da categoria (ex: "03.01.01 Receita de Servicos") |
| `categoria_nome_secundario` | text | Não | Categoria secundária (ex: "Impostos retidos em vendas") |
| `categoria_nome_terciario` | text | Não | Categoria terciária |
| `valor_categoria` | varchar | Não | Valor atribuído à categoria principal |
| `categoria_valor_secundario` | text | Não | Valor da categoria secundária |
| `categoria_valor_terciario` | text | Não | Valor da categoria terciária |
| `centro_custo_id` | text | Não | UUID do centro de custo |
| `centro_custo_nome` | text | Não | Nome do centro de custo |
| `valor_centro_custo` | text | Não | Valor atribuído ao centro de custo |
| `empresa` | varchar | Não | Empresa (ex: "TURBO PARTNERS") |
| `nome` | varchar | Não | Nome auxiliar |

**Filtros mais usados:**
- `status = 'QUITADO'` + `tipo_evento = 'RECEITA'` → receita efetivamente recebida
- `data_quitacao` → mês em que o dinheiro entrou
- `valor_pago > 0` → exclui estornos/zerados

---

## "Bitrix".crm_deal

Tabela de negócios/oportunidades do CRM Bitrix24. Cada registro é um deal no pipeline comercial.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|:-----------:|-----------|
| `id` | bigint | Sim | ID do deal no Bitrix. **Chave primária** |
| `title` | text | Não | Título do deal (geralmente o nome da empresa) |
| `category_id` | bigint | Não | ID do pipeline/funil |
| `category_name` | text | Não | Nome do pipeline (ex: "Geral", "Outbound") |
| `category` | text | Não | Pipeline (pode ser ID ou nome) |
| `stage_id` | bigint | Não | ID do estágio |
| `stage_name` | text | Não | Nome do estágio (ex: "Negocio Ganho", "Mapeados") |
| `stage` | text | Não | Código do estágio (ex: "WON") |
| `stage_semantic` | text | Não | Semântica: "S" (success/ganho), "F" (fail/perdido), null (em andamento) |
| `company_id` | bigint | Não | ID da empresa no Bitrix |
| `company_name` | text | Não | Nome da empresa |
| `company` | text | Não | Empresa (pode ser ID ou nome) |
| `contact_id` | bigint | Não | ID do contato principal |
| `contact_name` | text | Não | Nome do contato |
| `contact` | text | Não | Contato (pode ser ID ou nome) |
| `created_by_id` | bigint | Não | ID do usuário que criou |
| `created_by_name` | text | Não | Nome do criador |
| `created_by` | text | Não | Criador (pode ser ID ou nome) |
| `modify_by_id` | bigint | Não | ID do último modificador |
| `modified_by_name` | text | Não | Nome do último modificador |
| `modified_by` | text | Não | Modificador (pode ser ID ou nome) |
| `assigned_by_id` | bigint | Não | ID do responsável atribuído |
| `assigned_by_name` | text | Não | Nome do responsável |
| `assigned_by` | text | Não | Responsável (pode ser ID ou nome) |
| `closer` | text | Não | Closer responsável pelo fechamento |
| `sdr` | text | Não | SDR que prospectou o lead |
| `funil` | varchar | Não | Funil de vendas (ex: "Vendas") |
| `segmento` | varchar | Não | Segmento do prospect |
| `empresa` | varchar | Não | Empresa (campo auxiliar) |
| `fonte` | varchar | Não | Fonte/origem do lead (URL da LP) |
| `lp_da_conversao` | varchar | Não | Landing page que converteu |
| `lp_conversao` | text | Não | Landing page (campo duplicado) |
| `source` | varchar | Não | Código fonte no Bitrix |
| `valor_pontual` | numeric | Não | Valor pontual proposto |
| `valor_recorrente` | numeric | Não | Valor recorrente proposto |
| `faturamento_mensal` | varchar | Não | Faturamento mensal do prospect |
| `produtos` | text | Não | Produtos/serviços propostos |
| `comments` | text | Não | Comentários do deal |
| `date_create` | timestamp | Não | Data de criação do deal |
| `date_modify` | timestamp | Não | Data da última modificação |
| `created_at` | timestamp | Não | Data de criação (registro local) |
| `updated_at` | timestamp | Não | Data de atualização (registro local) |
| `data_reuniao_agendada` | date | Não | Data da reunião agendada |
| `data_reuniao_realizada` | date | Não | Data em que a reunião foi realizada |
| `data_fechamento` | date | Não | Data de fechamento do deal |
| `mql` | text | Não | Flag MQL (Marketing Qualified Lead) |
| `utm_source` | varchar | Não | UTM source da conversão |
| `utm_campaign` | varchar | Não | UTM campaign |
| `utm_term` | varchar | Não | UTM term |
| `utm_content` | varchar | Não | UTM content |
| `fnl_ngc` | text | Não | Campo auxiliar do funil de negócios |

**Estágios semânticos:**
- `stage_semantic = 'S'` → Deal ganho (venda fechada)
- `stage_semantic = 'F'` → Deal perdido
- `stage_semantic = null` → Deal em andamento

---

## Relacionamentos entre tabelas

```
cup_clientes.task_id ──────── cup_contratos.id_task
      │
      │ (via CNPJ normalizado)
      │
caz_clientes.cnpj ─────────── cup_clientes.cnpj
      │
      │ (via UUID)
      │
caz_clientes.ids ──────────── caz_parcelas.id_cliente
      
crm_deal.company_name ─────── cup_clientes.nome (match por nome, sem FK direta)
```

**Fluxo principal de dados:**
1. **Bitrix** (crm_deal) → Lead vira cliente
2. **ClickUp** (cup_clientes + cup_contratos) → Cliente com contratos por squad
3. **Conta Azul** (caz_clientes + caz_parcelas) → Pagamentos financeiros
4. **Cortex** → Cruza CNPJ para atribuir receita paga a cada squad
