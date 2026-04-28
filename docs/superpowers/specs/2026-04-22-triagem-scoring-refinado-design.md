# Triagem Inteligente — Scoring Refinado

## Contexto

A triagem inteligente analisa transcrições de reuniões de venda para identificar risco de churn precoce. Atualmente, o scoring é 100% delegado ao Claude sem pesos explícitos, com apenas 3 critérios de red flags e sem considerar sinais positivos.

## Objetivo

Refinar o sistema de scoring pré-onboarding para ter:
- Pesos explícitos por critério (hierarquia de gravidade)
- Sinais secundários agravantes
- Sinais atenuantes que reduzem risco
- Fórmula transparente e auditável
- Formato de saída expandido com composição do score

## Design

### Abordagem: Prompt Estruturado com Pesos

O prompt do Claude será reescrito com instruções explícitas de pontuação. O Claude avalia nuances mas dentro de faixas definidas.

### Critérios de Risco Principais (0-100 pts)

#### 1. Expectativa Irreal de Resultado (0-40 pontos) — Maior peso
- 0 pts: Expectativas realistas de prazo e resultado
- 10-15 pts: Expectativas levemente otimistas mas corrigíveis
- 20-30 pts: Expectativas claramente desalinhadas, vendedor não corrigiu adequadamente
- 35-40 pts: Expectativas completamente irreais, promessas exageradas pelo vendedor

#### 2. Falta de Estrutura/Orçamento (0-35 pontos)
- 0 pts: Verba, equipe e operação prontas
- 8-15 pts: Pequenas lacunas (site precisa ajustes, verba apertada)
- 18-25 pts: Lacunas significativas (sem verba definida OU sem produto/operação prontos)
- 28-35 pts: Múltiplas lacunas graves (sem verba E sem estrutura operacional)

#### 3. Serviço Vendido Inadequado (0-25 pontos)
- 0 pts: Serviço atende bem a necessidade real
- 5-10 pts: Leve desalinhamento, ajustável no onboarding
- 12-18 pts: Desalinhamento claro entre necessidade e serviço
- 20-25 pts: Serviço completamente errado para o perfil

### Sinais Secundários — Agravantes (até +10 pts, máx +3 cada)

| Sinal | Descrição |
|-------|-----------|
| Tomador de decisão ausente | Reunião com intermediário, decisor nunca participou |
| Histórico negativo com agências | Múltiplas trocas de agência, insatisfação recorrente |
| Falta de clareza no objetivo | "Quero crescer" sem métricas, sem meta definida |
| Dependência excessiva da agência | Espera que a agência faça tudo |
| Desalinhamento de perfil/porte | Segmento ou porte fora do que a Turbo atende bem |

### Sinais Atenuantes (até -15 pts, máx -3 cada)

| Sinal | Descrição |
|-------|-----------|
| Orçamento robusto e definido | Verba já separada, sabe quanto quer investir |
| Experiência prévia com marketing digital | Já trabalhou com agência ou roda campanhas |
| Tomador de decisão presente e engajado | Decisor na reunião, faz perguntas, compromisso |
| Expectativas realinhadas na reunião | Vendedor corrigiu expectativas, cliente aceitou |
| Estrutura operacional pronta | Site no ar, produto disponível, equipe de atendimento |

### Fórmula

```
score = critério1 + critério2 + critério3 + agravantes - atenuantes
```

Clampado em 0-100.

### Faixas de Classificação

| Faixa | Classificação | Cor |
|-------|--------------|-----|
| 0-39 | Baixo risco | Verde |
| 40-69 | Médio risco | Amarelo |
| 70-100 | Alto risco | Vermelho |

### Recomendações

| Faixa | Recomendação |
|-------|-------------|
| 0-30 | Aprovar |
| 31-50 | Aprovar com atenção |
| 51-70 | Escalar para gestor |
| 71-100 | Rejeitar - alto risco |

### Formato de Saída JSON

```json
{
  "score": "alto" | "medio" | "baixo",
  "score_numerico": 0-100,
  "composicao_score": {
    "expectativa_irreal": 0-40,
    "falta_estrutura": 0-35,
    "servico_inadequado": 0-25,
    "agravantes_total": 0-10,
    "atenuantes_total": 0-15,
    "formula": "ex: 30 + 15 + 10 + 3 - 6 = 52"
  },
  "analise": {
    "expectativa_irreal": {
      "detectado": true|false,
      "severidade": "alta"|"media"|"baixa"|"nenhuma",
      "pontos": 0-40,
      "justificativa": "...",
      "trechos": ["..."]
    },
    "falta_estrutura": {
      "detectado": true|false,
      "severidade": "alta"|"media"|"baixa"|"nenhuma",
      "pontos": 0-35,
      "justificativa": "...",
      "trechos": ["..."]
    },
    "servico_inadequado": {
      "detectado": true|false,
      "severidade": "alta"|"media"|"baixa"|"nenhuma",
      "pontos": 0-25,
      "justificativa": "...",
      "trechos": ["..."]
    }
  },
  "agravantes": [
    {
      "sinal": "nome do sinal",
      "pontos": 1-3,
      "justificativa": "..."
    }
  ],
  "atenuantes": [
    {
      "sinal": "nome do sinal",
      "pontos": 1-3,
      "justificativa": "..."
    }
  ],
  "resumo": "sumário executivo em 2-3 frases",
  "recomendacao": "Aprovar"|"Aprovar com atenção"|"Escalar para gestor"|"Rejeitar - alto risco"
}
```

## Impacto

### Backend (`server/services/triagem.ts`)
- Reescrever o prompt do sistema com os novos critérios, pesos e formato
- Manter a mesma integração com Google Drive e Claude API

### Frontend (`client/src/pages/Triagem.tsx`)
- Expandir o detail sheet para mostrar composição do score (barra por critério)
- Adicionar seções de agravantes e atenuantes detectados
- Mostrar a fórmula de composição para auditabilidade

### Banco de dados
- Nenhuma mudança — `analise_json` (JSONB) é flexível e aceita a nova estrutura
- Retrocompatível — análises antigas continuam funcionando

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `server/services/triagem.ts` | Reescrever prompt (linhas 58-97) |
| `client/src/pages/Triagem.tsx` | Expandir detail sheet com composição |

## Fora de Escopo

- Scoring híbrido com dados financeiros/operacionais
- Health score pós-venda contínuo
- Mudanças no schema do banco
- Mudanças nas faixas de cor ou status workflow
