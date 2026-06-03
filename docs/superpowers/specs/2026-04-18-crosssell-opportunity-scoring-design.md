# Cross-Sell: Mapeamento Automático de Oportunidades

**Data:** 2026-04-18
**Status:** Aprovado

## Objetivo

Construir um motor de mapeamento automático de oportunidades de cross-sell que analisa a base de clientes e contratos, calcula um score composto baseado em 5 fatores reais, e injeta oportunidades recomendadas diretamente no pipeline existente com classificação por prioridade.

## Decisões de Design

- **Acionamento**: sob demanda (botão "Mapear Oportunidades"), não automático
- **Afinidade de produto**: calculada a partir de co-ocorrência real na base (não regras manuais)
- **Entrada no pipeline**: direto como oportunidade na etapa `sugerido_sistema` (antes de `fazer_contato`)
- **Priorização**: faixas Alta/Média/Baixa (sem score numérico visível)
- **Scoring**: abordagem de score composto com pesos fixos

---

## 1. Motor de Scoring

### 1.1 Afinidade de Produto (peso 30%)

Calcula uma matriz de co-ocorrência real a partir de `cup_contratos` (status ativo):

- Para cada par de produtos (A, B): "dos clientes que têm A, quantos % também têm B?"
- Para cada cliente, o score de afinidade de um produto sugerido = co-ocorrência média entre esse produto e os produtos que o cliente já tem
- Usa os 22 produtos do catálogo (PRODUTOS constant)

### 1.2 Gap de Portfólio (peso 20%)

- Calcula a média de produtos ativos por cluster (Regulares, Imperdiveis, Chaves, NFNC)
- Score = `1 - (produtos_do_cliente / média_do_cluster)`, limitado entre 0 e 1
- Quanto menos produtos em relação ao seu cluster, maior o score

### 1.3 Saúde Financeira (peso 20%)

Normaliza 3 indicadores em percentil dentro da base:

- `faturamento_mensal` (cup_clientes)
- `investimento_ads` (cup_clientes)
- MRR total (soma de `valorr` dos contratos ativos)
- Score = média dos 3 percentis

### 1.4 Tenure (peso 15%)

- Meses desde o `data_inicio` do contrato mais antigo ativo
- Normalizado em faixas: 0-6 meses = 0.2, 6-12 = 0.5, 12-24 = 0.8, 24+ = 1.0

### 1.5 Histórico de Churn (peso 15%)

- Verifica em `cup_contratos` se o cliente tem serviços cancelados/pausados
- Produto sugerido é do mesmo tipo de um cancelado → 0.8 (oportunidade de reativação)
- Cliente nunca cancelou nada → 0.5 (estável)
- Cancelou muitos serviços recentemente → 0.2 (risco)

### Classificação Final

Score composto = soma ponderada dos 5 fatores (0 a 1):

| Faixa | Score | Badge |
|-------|-------|-------|
| Alta | > 0.70 | Verde |
| Média | 0.40 – 0.70 | Amarelo |
| Baixa | < 0.40 | Cinza |

---

## 2. Fluxo de Mapeamento

### 2.1 Botão "Mapear Oportunidades"

- Localizado na barra de filtros da página de pipeline
- Ao clicar: loading → POST /api/comercial/crosssell/mapear → toast com resumo → recarrega pipeline

### 2.2 Lógica de Processamento

```
1. Query: clientes ativos com seus contratos ativos (JOIN cup_clientes + cup_contratos)
2. Query: oportunidades já existentes no pipeline (para deduplicação)
3. Calcular matriz de co-ocorrência entre os 22 produtos
4. Para cada cliente:
   a. Listar produtos que ele TEM (ativos)
   b. Listar produtos que ele NÃO TEM
   c. Para cada produto ausente:
      - Calcular score de afinidade (co-ocorrência com produtos do cliente)
      - Se afinidade < 0.15 → pular (sem relação relevante)
      - Calcular os outros 4 fatores
      - Score composto → classificar prioridade
      - Se score ≥ 0.30 E não duplicado → criar oportunidade
   d. Limitar a no máximo 3 sugestões por cliente (top 3 por score)
```

### 2.3 Regras de Negócio

- Score mínimo: 0.30 para gerar oportunidade
- Afinidade mínima: 0.15 para considerar um produto
- Máximo 3 sugestões por cliente (top score)
- Deduplicação por par (cliente + produto) contra pipeline existente (qualquer etapa)
- Oportunidades descartadas não são sugeridas novamente (par cliente+produto em etapa `descartado`)

### 2.4 Resposta ao Usuário

Toast/modal resumo: "X oportunidades mapeadas: Y Alta, Z Média, W Baixa. N clientes ignorados."

---

## 3. Nova Etapa: `sugerido_sistema`

Adicionada ao fluxo do pipeline antes de `fazer_contato`:

```
sugerido_sistema → fazer_contato → tentativa_contato → reuniao_agendada →
em_contato → proposta_enviada → forte_interesse → ganho/descartado
```

- Visual diferenciado (borda/badge roxo ou azul)
- O CX pode: Aceitar (→ `fazer_contato`) ou Descartar (→ `descartado`)

---

## 4. Backend

### 4.1 Novo Endpoint

```
POST /api/comercial/crosssell/mapear
```

- Sem parâmetros
- Retorna: `{ criadas: number, distribuicao: { alta: number, media: number, baixa: number }, ignoradas: number }`
- Processamento síncrono

### 4.2 Alterações na Tabela `crosssell_oportunidades`

Novas colunas:

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `origem` | VARCHAR(20) | `'manual'` | `'manual'` ou `'sistema'` |
| `prioridade` | VARCHAR(10) | NULL | `'alta'`, `'media'`, `'baixa'` |
| `score_detalhes` | JSONB | NULL | Breakdown: `{ afinidade, gap, financeiro, tenure, churn }` |
| `motivo` | TEXT | NULL | Frase explicativa da recomendação |

Oportunidades manuais: `origem = 'manual'`, demais campos NULL.

---

## 5. Frontend

### 5.1 Botão "Mapear Oportunidades"

- Na barra de filtros, ao lado dos filtros existentes
- Ícone Sparkles ou Search, estilo secundário
- Loading state durante processamento

### 5.2 Cards de `sugerido_sistema`

- Borda/badge em cor distinta (roxo/azul)
- Conteúdo: nome do cliente, produto sugerido, badge de prioridade (Alta/Média/Baixa), motivo resumido, cluster, MRR atual
- Ações rápidas: "Aceitar" e "Descartar"
- Expandir: breakdown dos 5 fatores com barras de progresso

### 5.3 Filtros Novos

- Filtro de etapa: adicionar `sugerido_sistema`
- Novo filtro: Prioridade (Alta / Média / Baixa)
- Novo filtro: Origem (Manual / Sistema / Todas)

### 5.4 Dashboard

- KPI novo: "Sugestões Ativas" (count de `sugerido_sistema`)
- KPI novo: "Taxa de Aceitação" (% que saiu de `sugerido_sistema` para outra etapa que não `descartado`)
- Funil: `sugerido_sistema` como primeiro estágio

---

## 6. Dados Utilizados

| Tabela | Schema | Uso |
|--------|--------|-----|
| `cup_clientes` | Clickup | Cluster, faturamento, investimento_ads, status |
| `cup_contratos` | Clickup | Produtos ativos, MRR, tenure, serviços cancelados |
| `crosssell_oportunidades` | cortex_core | Pipeline existente + novas colunas |

Catálogo de 22 produtos: Performance, Creators, Social Media, Inbound, Outbound, CRM, BI, Automacao, Consultoria, Treinamento, Design, Video, SEO, Midia Paga, E-mail Marketing, Eventos, PR, Branding, Web, App, Marketplace, Outros.
