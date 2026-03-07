# Design: TurboZap Jurídico — Mensagens D+30 a D+55

**Data:** 2026-03-07
**Status:** Aprovado

## Contexto

Estender o sistema TurboZap existente (D-3 a D+20, instância "Financeiro") para incluir 5 novos níveis jurídicos (D+30 a D+55) enviados por uma instância WhatsApp separada ("Juridico"), com pipeline visual para controle de etapas condicionais (protesto e negativação).

## Decisões

- **Abordagem:** Extensão inline do TurboZap existente (não criar serviço separado)
- **Instância:** Nova env var `EVOLUTION_JURIDICO_INSTANCE_ID` (backend preparado, `dry_run_juridico=true` até instância existir)
- **Controle de etapas:** Pipeline dedicado (`turbozap_pipeline_juridico`) com flags booleanas
- **Trigger:** Mesmo botão manual para financeiro + jurídico
- **D+45 e D+55:** Condicionais — só disparam se pipeline confirma protesto/negativação efetivados

## Níveis Jurídicos

| Tipo | Label | Dias | Condicional |
|------|-------|------|-------------|
| D+30 | Formalização Jurídica | 30 | Não |
| D+40 | Comunicação de Protesto | 40 | Não |
| D+45 | Protesto Efetivado | 45 | `protesto_efetivado = true` |
| D+50 | Aviso de Negativação | 50 | Não |
| D+55 | Negativação Efetivada | 55 | `negativacao_efetivada = true` |

## Arquitetura

```
TurboZap (existente)
├── NIVEIS_COBRANCA: D-3 ... D+20 (instancia: "financeiro")
├── NIVEIS_COBRANCA: D+30 ... D+55 (instancia: "juridico")  ← NOVO
├── enviarMensagemWhatsApp(numero, texto, instancia)          ← MODIFICADO
├── Pipeline Jurídico (turbozap_pipeline_juridico)            ← NOVO
│   ├── Auto-criado quando D+30 é enviado
│   ├── Etapas: formalizado → protesto_comunicado → protesto_efetivado → negativacao_comunicada → negativacao_efetivada
│   └── Flags: protesto_efetivado, negativacao_efetivada
└── Preview/Executar: verifica condicionais antes de enviar   ← MODIFICADO
```

## Tabela: turbozap_pipeline_juridico

```sql
CREATE TABLE cortex_core.turbozap_pipeline_juridico (
  id SERIAL PRIMARY KEY,
  cnpj TEXT NOT NULL,
  cliente_nome TEXT,
  data_vencimento DATE NOT NULL,
  valor DECIMAL(12,2),
  etapa TEXT DEFAULT 'formalizado',
  protesto_efetivado BOOLEAN DEFAULT false,
  negativacao_efetivada BOOLEAN DEFAULT false,
  observacoes TEXT,
  atualizado_por TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(cnpj, data_vencimento)
);
```

## Roteamento de Instância

```typescript
async function enviarMensagemWhatsApp(numero, texto, instancia = "financeiro") {
  const instanceId = instancia === "juridico"
    ? process.env.EVOLUTION_JURIDICO_INSTANCE_ID
    : process.env.EVOLUTION_INSTANCE_ID;
  const dryRunKey = instancia === "juridico" ? "dry_run_juridico" : "dry_run";
  // ...
}
```

## Lógica Condicional

```typescript
// No executarCobrancas(), para níveis com `condicional`:
if (nivel.condicional) {
  const pipeline = await checkPipeline(cliente.cnpj, cliente.data_vencimento);
  if (!pipeline || !pipeline[nivel.condicional]) {
    // Pula: condição não atendida
    continue;
  }
}
```

## Endpoints Novos

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/turbozap/pipeline-juridico` | Lista registros do pipeline |
| `PUT` | `/api/turbozap/pipeline-juridico/:id` | Atualiza etapa/flags |

## Frontend

- **TurboZap.tsx**: Nova 4ª aba "Pipeline Jurídico"
  - Tabela com: Cliente, CNPJ, Vencimento, Valor, Etapa (dropdown), Protesto (toggle), Negativação (toggle)
- **Preview**: Níveis jurídicos com badge distinto (roxo/vermelho vs azul)
- **Configurações**: 5 novos templates + toggle `dry_run_juridico`

## Templates

5 mensagens fornecidas pelo usuário, usando variáveis `{nome}`, `{valor}`, `{vencimento}`, `{link_pagamento}`. Assinatura: "— Departamento Jurídico | Turbo Partners".

## Env Vars

```
EVOLUTION_JURIDICO_INSTANCE_ID=Juridico  # Quando instância for criada
```

Config `dry_run_juridico` defaults to `true` até a instância existir.
