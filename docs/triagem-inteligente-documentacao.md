# Triagem Inteligente - Documentacao Tecnica e Operacional

## 1. Visao Geral do Sistema

A **Triagem Inteligente** e um sistema de analise de risco pre-onboarding que utiliza inteligencia artificial (Claude Sonnet 4.5, Anthropic) para avaliar transcricoes de reunioes de venda e determinar a probabilidade de churn precoce de um cliente antes mesmo da contratacao ser efetivada.

O sistema funciona como um **quality gate** entre a venda e o onboarding: toda reuniao de venda e analisada por IA, que gera um score numerico de risco (0-100), identifica problemas especificos, destaca sinais positivos, avalia a postura do vendedor e emite uma recomendacao de acao.

### 1.1. Fluxo Operacional Completo

```
Cliente em status "triagem" no ClickUp
        |
        v
Gestor acessa /triagem no Cortex
        |
        v
Seleciona o cliente no dropdown (puxa de cup_clientes WHERE status = 'triagem')
        |
        v
Cola a transcricao da reuniao de venda (ou sistema busca automaticamente no Google Drive)
        |
        v
Transcricao enviada para Claude Sonnet 4.5 via API Anthropic
        |
        v
IA retorna analise estruturada em JSON com score, criterios, agravantes, atenuantes e avaliacao do vendedor
        |
        v
Resultado salvo no banco (cortex_core.triagem_analises) e exibido no dashboard
        |
        v
Gestor registra decisao: Aprovado | Rejeitado | Escalado
```

### 1.2. Fonte de Dados do Cliente

Os clientes disponiveis para analise sao puxados diretamente da tabela `"Clickup".cup_clientes` filtrando pelo status `triagem`. Ao selecionar um cliente, os campos **vendedor**, **squad** e **servico** sao preenchidos automaticamente a partir dos dados do ClickUp — nao ha entrada manual desses dados.

### 1.3. Fonte da Transcricao

A transcricao pode vir de duas fontes:

1. **Google Drive (automatico)**: o sistema busca no Drive da empresa por arquivos `.txt`, Google Docs ou arquivos com "transcript" no nome que contenham o nome do cliente. Prioriza o arquivo mais recente.
2. **Entrada manual**: o gestor cola a transcricao diretamente no campo de texto do formulario.

---

## 2. Modelo de Scoring — Arquitetura de Pontuacao

O score de risco e composto por uma formula matematica com 4 componentes:

```
SCORE = C1 + C2 + C3 + A - M
```

Onde:
- **C1** = Expectativa Irreal de Resultado (0-40 pontos)
- **C2** = Falta de Estrutura / Orcamento (0-35 pontos)
- **C3** = Servico Vendido Inadequado (0-25 pontos)
- **A** = Soma dos sinais agravantes (0-10 pontos)
- **M** = Soma dos sinais atenuantes (0-15 pontos)

O resultado e **clampado** (limitado) entre 0 e 100. Isso significa que mesmo que a soma ultrapasse 100, o score maximo e 100; e mesmo que atenuantes reduzam o score abaixo de zero, o minimo e 0.

### 2.1. Distribuicao de Pesos

A hierarquia de pesos foi definida com base na experiencia operacional da Turbo Partners sobre os fatores que mais causam churn precoce:

| Componente | Peso Maximo | % do Score Base | Justificativa |
|---|---|---|---|
| Expectativa Irreal | 40 pts | 40% | Principal causa de churn: cliente espera resultados impossiveis |
| Falta de Estrutura | 35 pts | 35% | Segundo fator: sem verba ou operacao, servico nao funciona |
| Servico Inadequado | 25 pts | 25% | Menos frequente, mas quando ocorre e fatal |
| Agravantes | +10 pts | Bonus | Sinais secundarios que amplificam o risco |
| Atenuantes | -15 pts | Reducao | Sinais positivos que mitigam riscos detectados |

**Nota:** Os atenuantes tem peso maximo superior aos agravantes (-15 vs +10) porque a presenca de sinais positivos fortes pode genuinamente compensar riscos moderados. Um cliente com expectativa levemente otimista (15 pts) mas com orcamento robusto e experiencia previa (-6 pts) tem risco real menor.

---

## 3. Criterios Principais — Detalhamento

### 3.1. Criterio 1: Expectativa Irreal de Resultado (0-40 pontos)

**O que a IA avalia:**
- O cliente espera resultados em prazos incompativeis com a realidade do marketing digital?
- O vendedor fez promessas exageradas ou usou cases de sucesso sem contextualizar diferencas?
- O cliente demonstra impaciencia, urgencia irreal ou vincula permanencia a metas agressivas?

**Escala de pontuacao:**

| Faixa | Severidade | Descricao | Exemplo |
|---|---|---|---|
| 0 pts | Nenhuma | Expectativas realistas de prazo e resultado | "Entendo que resultados vem em 3-6 meses" |
| 10-15 pts | Baixa | Levemente otimistas mas corrigiveis | "Espero ver crescimento ja no primeiro mes" (sem urgencia) |
| 20-30 pts | Media | Claramente desalinhadas, vendedor nao corrigiu | "Preciso triplicar vendas em 2 meses" + vendedor nao contesta |
| 35-40 pts | Alta | Completamente irreais, promessas exageradas | "Se nao vender em 15 dias saio" + vendedor prometeu cases |

**Sinais textuais que a IA busca na transcricao:**
- Mencoes a prazos curtos ("em 1 semana", "no primeiro mes", "resultados imediatos")
- Metas numericas irrealistas ("2000 vendas em 4 meses com R$2k de midia")
- Condicionais de permanencia ("se nao funcionar em X dias, cancelo")
- Promessas do vendedor ("nosso cliente Y conseguiu Z em N dias")
- Ausencia de alinhamento quando o cliente demonstra urgencia

### 3.2. Criterio 2: Falta de Estrutura / Orcamento (0-35 pontos)

**O que a IA avalia:**
- O cliente tem verba separada para midia/anuncios?
- Existe equipe interna para complementar o servico (atendimento, conteudo)?
- O produto/estoque esta pronto para vender?
- As condicoes operacionais minimas estao atendidas (site, logistica, precificacao)?

**Escala de pontuacao:**

| Faixa | Severidade | Descricao | Exemplo |
|---|---|---|---|
| 0 pts | Nenhuma | Verba, equipe e operacao prontas | "Temos R$10k/mes para midia e equipe de 3 pessoas" |
| 8-15 pts | Baixa | Pequenas lacunas | "Site precisa de uns ajustes, verba de midia apertada" |
| 18-25 pts | Media | Lacunas significativas (OU verba OU operacao) | "Ainda nao definimos orcamento de midia" |
| 28-35 pts | Alta | Multiplas lacunas graves (verba E operacao) | "Caixa finito, produto nao validado, sem equipe" |

**Sinais textuais:**
- Mencoes a limitacoes financeiras ("caixa finito", "sem verba", "investimento limitado")
- Produto/servico nao validado ("ainda testando", "sem vendas ate agora")
- Ausencia de estrutura digital (sem site, sem redes sociais ativas)
- Dependencia total da agencia para operacao basica

### 3.3. Criterio 3: Servico Vendido Inadequado (0-25 pontos)

**O que a IA avalia:**
- A necessidade real do cliente combina com o servico vendido?
- O perfil do negocio e compativel com o produto contratado?
- O cliente precisa de algo diferente do que esta comprando?

**Escala de pontuacao:**

| Faixa | Severidade | Descricao | Exemplo |
|---|---|---|---|
| 0 pts | Nenhuma | Servico atende bem a necessidade real | Performance para e-commerce com trafego maduro |
| 5-10 pts | Baixa | Leve desalinhamento, ajustavel no onboarding | Social media vendido mas cliente precisa mais de trafego |
| 12-18 pts | Media | Desalinhamento claro | Pacote de escala para empresa que precisa validar produto |
| 20-25 pts | Alta | Servico completamente errado | Consultoria de performance para quem precisa de branding basico |

---

## 4. Sinais Secundarios

### 4.1. Agravantes (+1 a +3 pontos cada, maximo +10 no total)

Sinais que nao sao criterios principais mas amplificam o risco de churn. A IA atribui de 1 a 3 pontos por sinal detectado, conforme a intensidade observada na transcricao.

| Sinal | O que indica | Exemplo textual |
|---|---|---|
| **Tomador de decisao ausente** | Reuniao com intermediario, decisor nunca validou | "Vou falar com meu socio e te retorno" (socio nunca apareceu) |
| **Historico negativo com agencias** | Padrao de insatisfacao cronica, rotatividade alta | "Ja troquei 3 agencias nos ultimos 2 anos" |
| **Falta de clareza no objetivo** | Metas vagas, sem metricas definidas | "Quero crescer" / "Quero mais vendas" sem numeros |
| **Dependencia excessiva da agencia** | Espera que a agencia resolva tudo | "Voces vao fazer tudo, nao tenho tempo pra nada disso" |
| **Desalinhamento de perfil/porte** | Segmento ou porte fora do perfil atendido | Microempreendedor individual contratando pacote enterprise |

**Regra de cap:** Mesmo que todos os 5 sinais estejam presentes, o total de agravantes nao pode ultrapassar 10 pontos. Isso evita que sinais secundarios tenham mais peso que um criterio principal.

### 4.2. Atenuantes (-1 a -3 pontos cada, maximo -15 no total)

Sinais positivos que reduzem a severidade dos riscos detectados. Funcionam como **contrapeso**: um cliente com expectativa levemente alta mas orcamento robusto tem risco real menor.

| Sinal | O que indica | Exemplo textual |
|---|---|---|
| **Orcamento robusto e definido** | Cliente ja separou verba, sabe quanto investir | "Separamos R$15k/mes so pra midia" |
| **Experiencia previa com marketing digital** | Ja trabalhou com agencia ou roda campanhas | "A gente ja roda Google Ads internamente faz 2 anos" |
| **Tomador de decisao presente e engajado** | Decisor na reuniao, perguntas relevantes | CEO participou, questionou metricas, pediu detalhes |
| **Expectativas realinhadas na reuniao** | Vendedor corrigiu e cliente aceitou | "Entendi, 3-6 meses faz mais sentido, vamos nesse prazo" |
| **Estrutura operacional pronta** | Site, produto, equipe funcionando | "Site ja esta no ar, estoque pronto, equipe de atendimento" |

**Mecanica de atenuacao:** Atenuantes nao eliminam riscos — eles reduzem a pontuacao. Um cliente com 35 pts em expectativa irreal e -3 pts de atenuante por "expectativas realinhadas" fica com um score efetivo de 32 pts naquele criterio. O risco foi **mitigado**, nao eliminado.

---

## 5. Avaliacao do Vendedor

Alem da analise de risco do cliente, o sistema avalia a **postura e conduta do vendedor** durante a reuniao. Esta avaliacao e qualitativa (nao impacta o score numerico) e serve como feedback para o time comercial.

### 5.1. Pontos Negativos Avaliados

| Aspecto | Descricao |
|---|---|
| Promessas exageradas | Vendedor prometeu resultados ou prazos irreais para fechar a venda |
| Produto empurrado | Vendeu servico desnecessario ou inadequado para o perfil |
| Nao alinhou expectativas | Cliente demonstrou visao irrealista e vendedor nao corrigiu |
| Venda consultiva fraca | Nao investigou a real necessidade, pulou direto para proposta |
| Omitiu limitacoes | Nao explicou riscos, pre-requisitos ou limitacoes do servico |

### 5.2. Pontos Positivos Avaliados

| Aspecto | Descricao |
|---|---|
| Alinhamento de expectativas | Comunicou de forma clara e honesta o que esperar |
| Perguntas consultivas | Investigou a real necessidade antes de propor solucao |
| Produto adequado | Sugeriu o servico mais compativel com o perfil do cliente |
| Explicou pre-requisitos | Deixou claro o que o cliente precisa ter pronto |
| Conduta profissional | Reuniao bem conduzida, organizada, sem pressao indevida |
| Proximos passos claros | Estabeleceu timeline e acoes concretas para ambos os lados |

### 5.3. Nota Geral do Vendedor

| Nota | Significado |
|---|---|
| **Boa** | Maioria de pontos positivos, conduziu bem a venda, alinhou expectativas |
| **Regular** | Mix de positivos e negativos, pontos de melhoria identificados |
| **Ruim** | Maioria de pontos negativos, conduziu a venda de forma problematica |

Cada ponto (positivo ou negativo) vem acompanhado de **justificativa** e **trecho literal da transcricao** que evidencia o comportamento identificado.

---

## 6. Classificacao e Recomendacao

### 6.1. Faixas de Score

| Score | Classificacao | Cor no Dashboard | Significado |
|---|---|---|---|
| 0-39 | Baixo Risco | Verde | Cliente alinhado, poucas ou nenhuma red flag |
| 40-69 | Medio Risco | Amarelo | Sinais de atencao, possivel de contornar com onboarding cuidadoso |
| 70-100 | Alto Risco | Vermelho | Multiplas red flags graves, alta probabilidade de churn precoce |

### 6.2. Recomendacoes

| Score | Recomendacao | Acao Sugerida |
|---|---|---|
| 0-30 | **Aprovar** | Seguir para onboarding normalmente |
| 31-50 | **Aprovar com atencao** | Onboarding com pontos de atencao documentados, acompanhamento proximo |
| 51-70 | **Escalar para gestor** | Gestor deve revisar a analise e decidir, possivel reuniao adicional |
| 71-100 | **Rejeitar - alto risco** | Nao prosseguir com o contrato, risco de churn muito alto |

### 6.3. Workflow de Decisao

Apos a IA gerar a analise, um gestor humano registra a decisao final:

- **Aprovado** — cliente segue para onboarding
- **Rejeitado** — contrato nao prossegue
- **Escalado** — encaminhado para nivel superior de decisao

A decisao humana pode divergir da recomendacao da IA. O sistema registra quem decidiu, quando e com qual justificativa para auditoria posterior.

---

## 7. Composicao do Score — Transparencia e Auditabilidade

Cada analise inclui um campo `composicao_score` que mostra exatamente como o score numerico foi calculado:

```
composicao_score: {
  expectativa_irreal: 30      // pontos do criterio 1
  falta_estrutura: 15         // pontos do criterio 2
  servico_inadequado: 10      // pontos do criterio 3
  agravantes_total: 3         // soma dos agravantes
  atenuantes_total: 6         // soma dos atenuantes
  formula: "30 + 15 + 10 + 3 - 6 = 52"
}
```

Isso permite que o gestor entenda **por que** o score e X e nao Y, e possa questionar ou validar a avaliacao da IA com base nos trechos da transcricao citados em cada criterio.

---

## 8. Modelo de IA — Detalhes Tecnicos

### 8.1. Modelo Utilizado

- **Modelo:** Claude Sonnet 4.5 (`claude-sonnet-4-5`)
- **Provider:** Anthropic
- **Max tokens de resposta:** 4.096
- **Formato de saida:** JSON estruturado (sem markdown)

### 8.2. Arquitetura do Prompt

O sistema utiliza um prompt do tipo **system + user**:

- **System prompt:** Contem todas as regras de pontuacao, criterios, escalas, sinais secundarios, formula e formato de saida JSON. E um prompt extenso (~3.500 tokens) que funciona como um "manual de avaliacao" completo.
- **User prompt:** Contem apenas a transcricao da reuniao, precedida por "Analise esta transcricao de reuniao de venda:".

Essa separacao garante que o modelo trate as regras como instrucoes fixas e a transcricao como dado de entrada variavel.

### 8.3. Estrategia de Confiabilidade

1. **Formato rigido:** O prompt exige resposta exclusivamente em JSON valido, sem markdown, sem backticks, sem texto adicional.
2. **Strip de artefatos:** Mesmo assim, o backend aplica regex para remover code fences caso o modelo insira.
3. **Fallback gracioso:** Se o JSON nao puder ser parseado, o sistema retorna uma analise padrao neutra (score 50, "medio risco") com recomendacao "Escalar para gestor" — nunca falha silenciosamente.
4. **Evidencia obrigatoria:** Cada criterio exige trechos literais da transcricao como justificativa, impedindo que o modelo "invente" problemas sem base textual.
5. **Faixas de pontuacao explicitas:** Em vez de pedir um numero de 0 a 40, o prompt define exatamente o que cada faixa significa, reduzindo a variancia entre analises.

### 8.4. Limitacoes Conhecidas

- **Qualidade da transcricao:** Transcricoes automaticas (speech-to-text) podem ter erros que afetam a analise. Transcricoes manuais ou revisadas produzem resultados mais precisos.
- **Subjetividade residual:** Mesmo com faixas definidas, ha margem de interpretacao dentro de cada faixa (ex: 20 vs 30 pontos em "expectativa irreal media"). Duas analises da mesma transcricao podem ter scores ligeiramente diferentes.
- **Contexto limitado:** A IA analisa apenas o que esta na transcricao. Informacoes contextuais nao mencionadas na reuniao (ex: cliente tem caixa robusto mas nao mencionou) nao serao captadas.
- **Sem dados historicos:** O score nao cruza com dados financeiros do Conta Azul ou historico de contratos. E uma analise puramente baseada na transcricao.

---

## 9. Infraestrutura e Armazenamento

### 9.1. Tabela Principal

```sql
cortex_core.triagem_analises (
  id              SERIAL PRIMARY KEY,
  cliente_id      TEXT,              -- ID do cliente (opcional)
  cliente_nome    TEXT NOT NULL,      -- Nome do cliente
  squad           TEXT,              -- Squad responsavel
  vendedor        TEXT,              -- Vendedor que conduziu
  produto         TEXT,              -- Servico/produto vendido
  valor_contrato  DECIMAL(12,2),     -- Valor do contrato
  transcricao_url TEXT,              -- Link para transcricao no Drive
  transcricao_texto TEXT,            -- Texto completo da transcricao
  score           TEXT,              -- "alto" | "medio" | "baixo"
  score_numerico  INTEGER,           -- 0-100
  analise_json    JSONB,             -- JSON completo da analise da IA
  status          TEXT DEFAULT 'pendente',  -- pendente | aprovado | rejeitado | escalado
  decisao_por     TEXT,              -- Quem decidiu
  decisao_observacoes TEXT,          -- Justificativa da decisao
  criado_em       TIMESTAMP DEFAULT NOW(),
  atualizado_em   TIMESTAMP DEFAULT NOW()
)
```

O campo `analise_json` (JSONB) armazena a resposta completa da IA, incluindo todos os criterios, agravantes, atenuantes, avaliacao do vendedor, resumo e recomendacao. Isso permite consultas avancadas via SQL sobre os dados da analise.

### 9.2. Endpoints da API

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | `/api/triagem/clientes` | Lista clientes com status 'triagem' do ClickUp |
| GET | `/api/triagem` | Lista todas as analises (filtros: status, score, squad) |
| GET | `/api/triagem/:id` | Detalhe de uma analise especifica |
| POST | `/api/triagem/analisar` | Cria nova analise (envia transcricao para IA) |
| PUT | `/api/triagem/:id/decidir` | Registra decisao humana |
| DELETE | `/api/triagem/:id` | Exclui uma analise |

---

## 10. Exemplos de Cenarios

### Cenario A: Cliente de Baixo Risco (Score ~18)

```
Criterio 1 (Expectativa Irreal): 10 pts
  - Cliente mencionou "gostaria de ver resultados em 2 meses"
  - Vendedor alinhou: "resultados consistentes a partir do 3o mes"
  - Cliente aceitou: "faz sentido"

Criterio 2 (Falta de Estrutura): 8 pts
  - Site no ar mas precisa de ajustes na landing page
  - Verba de midia definida em R$5k/mes

Criterio 3 (Servico Inadequado): 0 pts
  - Servico de performance para e-commerce maduro — perfeito fit

Agravantes: 0 pts
  - Nenhum sinal detectado

Atenuantes: -6 pts
  - Orcamento robusto (-3)
  - Tomador de decisao presente e engajado (-3)

SCORE = 10 + 8 + 0 + 0 - 6 = 12
Classificacao: BAIXO RISCO
Recomendacao: APROVAR
```

### Cenario B: Cliente de Alto Risco (Score ~78)

```
Criterio 1 (Expectativa Irreal): 35 pts
  - "Se nao vender em 15 dias saio"
  - "Vou vender 2000 unidades em 4 meses com R$2k de midia"
  - Vendedor nao corrigiu, usou cases de sucesso sem contexto

Criterio 2 (Falta de Estrutura): 28 pts
  - Caixa finito, empresa nunca vendeu
  - Produto nao validou product-market fit
  - Sem equipe interna

Criterio 3 (Servico Inadequado): 12 pts
  - Precisa validar produto, mas comprou pacote de escala

Agravantes: +6 pts
  - Falta de clareza no objetivo (+3)
  - Dependencia excessiva da agencia (+3)

Atenuantes: -3 pts
  - Tomador de decisao presente e engajado (-3)

SCORE = 35 + 28 + 12 + 6 - 3 = 78
Classificacao: ALTO RISCO
Recomendacao: REJEITAR - ALTO RISCO
```

---

## 11. Evolucoes Futuras Possiveis

1. **Score hibrido com dados financeiros**: Cruzar transcricao com dados do Conta Azul (historico de pagamento, inadimplencia) para clientes recorrentes.
2. **Health score pos-venda**: Evoluir para monitoramento continuo durante o contrato.
3. **Calibracao por dados reais**: Apos acumular N analises com desfecho real (churn ou retencao), usar dados historicos para calibrar pesos e faixas.
4. **Score deterministico (Fase 2)**: Migrar de pontuacao por IA para calculo fixo no backend baseado em severidade detectada, reduzindo variancia.

---

*Documento gerado em 2026-04-22. Versao 1.0.*
*Sistema desenvolvido para Turbo Partners — uso interno.*
