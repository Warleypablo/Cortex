# Integração Conta Azul API — Criar Pessoa + Gerar Fatura

**Data:** 2026-03-16
**Status:** Aprovado
**Escopo:** Integração write com a API v2 do Conta Azul para criação de entidades e contas a receber a partir de contratos assinados.

---

## Problema

Hoje, após um contrato ser assinado no Cortex, o time precisa cadastrar manualmente o cliente no Conta Azul e criar as faturas. Isso gera retrabalho, risco de erros e atraso no início da cobrança.

## Solução

Botão "Enviar para Conta Azul" na tela de detalhes do contrato que:
1. Verifica se a pessoa já existe no CA (busca por CNPJ)
2. Cria a pessoa se não existir (ou vincula se existir)
3. Gera as contas a receber baseadas nos itens do contrato

## Decisões de Design

- **Gatilho:** Botão manual na tela de detalhes do contrato (não automático)
- **Fonte de dados:** `staging.entidades` + `staging.contratos` + `staging.contratos_itens`
- **Abordagem:** Integração direta no backend (módulo de rotas), sem queue/fila
- **Autenticação:** OAuth2 Bearer JWT com refresh automático
- **Queries:** Raw SQL (não Drizzle ORM) — as colunas de `staging.entidades` e `staging.contratos` são adicionadas via migrations runtime em `contratos.ts`, não estão no schema Drizzle

---

## Arquitetura

### Novos Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `server/services/contaAzulAuth.ts` | Gerenciamento de tokens OAuth2 (access_token, refresh, persistência) |
| `server/routes/contaazul.ts` | Endpoints da integração (sync pessoa, criar conta a receber) |
| `client/src/components/contratos/EnviarContaAzulButton.tsx` | Botão + feedback na UI |

### Variáveis de Ambiente

```env
CONTAAZUL_CLIENT_ID=xxx
CONTAAZUL_CLIENT_SECRET=xxx
CONTAAZUL_REFRESH_TOKEN=xxx
```

### Alterações no Banco

```sql
-- Rastreamento do ID no Conta Azul
ALTER TABLE staging.entidades ADD COLUMN IF NOT EXISTS id_conta_azul VARCHAR(255);
ALTER TABLE staging.contratos ADD COLUMN IF NOT EXISTS id_conta_azul_receber VARCHAR(255);
ALTER TABLE staging.contratos ADD COLUMN IF NOT EXISTS data_envio_conta_azul TIMESTAMP;

-- Nota: `status_faturamento` já existe em staging.contratos (default 'pendente'), sem ALTER necessário.
-- Nota: `documento_assinado` já existe em staging.contratos (default false), sem ALTER necessário.
```

---

## Fluxo Detalhado

### Endpoint Principal

```
POST /api/contaazul/enviar/:contratoId
```

**Passos:**

1. **Buscar contrato** via raw SQL:
   ```sql
   SELECT c.*, e.nome, e.tipo_pessoa, e.cpf_cnpj, e.email, e.telefone,
          e.email_cobranca, e.endereco, e.numero, e.complemento,
          e.bairro, e.cidade, e.estado, e.cep, e.eh_cliente, e.eh_fornecedor,
          e.id_conta_azul
   FROM staging.contratos c
   JOIN staging.entidades e ON e.id = c.entidade_id
   WHERE c.id = :contratoId
   ```
   > **Nota sobre colunas:** `staging.entidades` tem colunas `nome`, `email`, `telefone`, `endereco` que são aliases migrados de `nome_razao_social`, `email_principal`, `telefone_principal`, `logradouro` respectivamente (migration runtime em `contratos.ts:50-74`). Usar as colunas migradas (`nome`, `email`, `telefone`, `endereco`).

2. **Validar pré-condições:**
   - Contrato deve ter `documento_assinado = true`
   - Entidade deve ter `cpf_cnpj` preenchido e válido (sanitizar removendo pontos/traços/barras; CPF=11 dígitos, CNPJ=14 dígitos)
   - Contrato não deve ter `id_conta_azul_receber` preenchido (evita duplicata)

3. **Verificar pessoa no CA:** `GET /v1/pessoas?documento={cnpj_sanitizado}`
   - Se encontrada → usar `id` existente, salvar em `entidades.id_conta_azul`
   - Se não encontrada → criar via `POST /v1/pessoas`

4. **Criar conta a receber:** `POST /v1/financeiro/eventos-financeiros/contas-a-receber`
   - Parcelas baseadas nos itens de `staging.contratos_itens`

5. **Atualizar banco** (em transação para consistência):
   ```sql
   BEGIN;
   UPDATE staging.entidades SET id_conta_azul = :uuid_pessoa WHERE id = :entidade_id;
   UPDATE staging.contratos SET
     id_conta_azul_receber = :uuid_evento,
     data_envio_conta_azul = NOW(),
     status_faturamento = 'enviado_ca'
   WHERE id = :contrato_id;
   COMMIT;
   ```
   > **Idempotência:** Se a criação da pessoa no CA for bem-sucedida mas a conta a receber falhar, o `id_conta_azul` na entidade é salvo mas `id_conta_azul_receber` permanece null. No retry, a busca por CNPJ encontrará a pessoa existente (sem duplicata), e tentará criar apenas a conta a receber.

6. **Registrar no log de auditoria:**
   ```sql
   INSERT INTO sync_logs (integration, operation, status, details, created_at)
   VALUES ('conta_azul', 'enviar_contrato', :status, :json_details, NOW());
   ```

7. **Retornar resultado** para a UI

### Mapeamento de Campos: Entidade → Pessoa CA

| staging.entidades (coluna migrada) | API Conta Azul | Transformação |
|---|---|---|
| `nome` | `nome` | Direto (obrigatório) |
| `tipo_pessoa` | `tipo_pessoa` | "juridica" → "Jurídica", "fisica" → "Física" (obrigatório) |
| `cpf_cnpj` | `cnpj` ou `cpf` | Sanitizar (remover `.`, `-`, `/`). Se tipo_pessoa="juridica" → campo `cnpj`, se "fisica" → campo `cpf` |
| `email` | `email` | Direto |
| `telefone` | `telefone_comercial` | Direto |
| `endereco` | `enderecos[0].logradouro` | Direto |
| `numero` | `enderecos[0].numero` | Direto |
| `complemento` | `enderecos[0].complemento` | Direto |
| `bairro` | `enderecos[0].bairro` | Direto |
| `cidade` | `enderecos[0].cidade` | Direto |
| `estado` | `enderecos[0].estado` | Direto |
| `cep` | `enderecos[0].cep` | Direto |
| `email_cobranca` | `contato_cobranca_faturamento.emails[]` | Wrap em array |
| `eh_cliente` | `perfis[].tipo_perfil = "Cliente"` | Se true, adicionar perfil |
| `eh_fornecedor` | `perfis[].tipo_perfil = "Fornecedor"` | Se true, adicionar perfil |

### Geração de Contas a Receber

Endpoint: `POST /v1/financeiro/eventos-financeiros/contas-a-receber`

**Dados de origem:** `staging.contratos_itens` (tabela com ~430 registros, definida em `contratos.ts:315`)

```sql
SELECT ci.*, cf.dia_vencimento
FROM staging.contratos_itens ci
LEFT JOIN staging.clientes_faturamento cf ON cf.cliente_id = c.entidade_id
WHERE ci.contrato_id = :contratoId
```

**Lógica de parcelas:**
- Itens com `modalidade = 'recorrente'`:
  - Número de parcelas = `contratos_itens.num_parcelas` se definido; caso contrário, calcular de `data_inicio_cobranca_recorrentes` até `data_fim` do item (arredondando para cima em meses). Se nenhum dos dois existir, gerar 12 parcelas (padrão)
  - Data de início = `contratos.data_inicio_cobranca_recorrentes`
  - Valor = `valor_final` do item (ou `valor_total` se `valor_final` for null)
- Itens com `modalidade = 'pontual'`:
  - Parcela única na `contratos.data_inicio_cobranca_pontuais`
  - Valor = `valor_final` do item
- **Dia de vencimento:**
  - Usar `clientes_faturamento.dia_vencimento` se existir registro
  - **Fallback:** dia 10 do mês (quando `clientes_faturamento` não tem registro para o cliente — tabela atualmente com ~0 registros)
- `id_cliente` = UUID da pessoa no CA (criada/encontrada no passo anterior)

---

## Autenticação (contaAzulAuth.ts)

```
Base URL: https://api-v2.contaazul.com
```
> **Nota:** `api-v2.contaazul.com` é a URL da plataforma. Os endpoints individuais usam versionamento próprio (`/v1/`).

**Responsabilidades:**
- Armazenar `access_token` em memória com TTL
- Refresh automático via `refresh_token` quando expira
- Se o refresh retornar um **novo** `refresh_token`, persistir no banco (tabela `cortex_core.system_settings` ou similar) para sobreviver a restarts do servidor
- Exportar função `getAccessToken(): Promise<string>`
- Retry com novo token em caso de 401

**Tratamento de Erros:**

| Código | Ação |
|--------|------|
| 201 | Sucesso — salvar ID retornado |
| 400 | Validação — retornar erro detalhado para o usuário |
| 401 | Token expirado — refresh automático + retry (1x) |
| 429 | Rate limit — retornar erro, sugerir tentar novamente |
| 500 | Erro CA — logar erro em `sync_logs`, notificar usuário |

---

## Frontend

### Botão "Enviar para Conta Azul"

**Localização:** Tela de detalhes do contrato

**Visibilidade:**
- Visível quando `documento_assinado = true`
- Habilitado quando `id_conta_azul_receber` é null (não enviado ainda)
- Desabilitado com badge "Enviado" quando já foi processado

**Comportamento:**
- Desabilitar imediatamente ao clicar (previne double-click)
- Loading spinner durante a chamada
- Toast de sucesso: "Cliente vinculado e conta a receber criada no Conta Azul"
- Toast de erro: mensagem detalhada da API
- Após sucesso, botão muda para estado "Enviado" (desabilitado permanente)

**Proteção contra concorrência:**
- Frontend: desabilitar botão no onClick antes da chamada
- Backend: `SELECT ... FOR UPDATE` no contrato para prevenir envios duplicados simultâneos

**Dark/Light mode:** Seguir padrão do projeto com `dark:` variants do Tailwind.

---

## API Conta Azul — Referência

### Endpoints Utilizados

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/v1/pessoas` | Buscar pessoa por documento (CNPJ/CPF) |
| POST | `/v1/pessoas` | Criar nova pessoa |
| POST | `/v1/financeiro/eventos-financeiros/contas-a-receber` | Criar conta a receber com parcelas |

### Base URL
```
https://api-v2.contaazul.com
```

### Campos Obrigatórios — Criar Pessoa
- `nome` (string)
- `tipo_pessoa` (enum: "Física", "Jurídica", "Estrangeira")

### Campos Obrigatórios — Criar Conta a Receber
- `id_cliente` (UUID da pessoa)
- Parcelas com `data_vencimento` e `valor`

---

## Fontes

- [Conta Azul Pessoas API](https://developers.contaazul.com/open-api-docs/open-api-person)
- [Conta Azul Criar Pessoa](https://developers.contaazul.com/open-api-docs/open-api-person/v1/criarpessoa)
- [Conta Azul Sales API](https://developers.contaazul.com/docs/sales-apis-openapi)
- [Conta Azul Financial API](https://developers.contaazul.com/docs/financial-apis-openapi/v1)
