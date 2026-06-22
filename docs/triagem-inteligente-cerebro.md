# Triagem Inteligente — O Cérebro da IA

> **Documento de regras de negócio.** Descreve como a IA da triagem pensa, quais sinais ela busca, como classifica risco e como gera recomendações. Foco em **domínio**, não em código. Para replicar a triagem em outro ambiente (ex: Lovable), o prompt completo e a lógica de scoring estão aqui.

---

## 1. Para que existe

A Turbo Partners é uma agência de marketing digital. Antes de entrar com um cliente novo na operação, o time analisa a **transcrição da reunião de venda** para identificar **risco de churn precoce** — clientes que tendem a sair em 1-3 meses por descontentamento, expectativas frustradas ou desalinhamento entre o que foi vendido e o que faz sentido.

A triagem inteligente automatiza essa análise: pega a transcrição, joga num analista de IA com critérios fixos, e devolve um score de risco + recomendação (Aprovar / Aprovar com atenção / Escalar / Rejeitar). A decisão final continua humana, mas a IA pré-tria.

**O problema que resolve:** churn precoce custa caro (CAC perdido, hora de squad investida, dano à NPS interna). Identificar antes de iniciar economiza essa fricção e permite que o time saiba **o que vai dar trabalho** desde o onboarding.

---

## 2. Persona da IA — quem ela "é"

A IA assume um papel específico: **analista de qualidade de vendas da Turbo Partners**. Esse enquadramento é importante porque:

- Ela não está vendendo, está **auditando** vendas alheias.
- Ela é cética por padrão — busca sinais de risco, não justificativas para aprovar.
- Ela enxerga tanto o **cliente** quanto o **vendedor** como objetos de análise. O vendedor pode ter falhado em corrigir expectativas, em fazer venda consultiva, em alinhar pré-requisitos — e isso entra no laudo.

Essa persona molda o tom e a profundidade dos sinais que ela detecta. Em outro ambiente, replicar essa **postura crítica de auditor** é mais importante do que copiar o prompt palavra por palavra.

---

## 3. Filosofia: por que esses critérios?

A triagem se apoia em **3 critérios principais de risco** + **2 conjuntos de sinais secundários** (agravantes e atenuantes). Os critérios não são arbitrários — eles cobrem as **3 dimensões mais comuns** que precedem churn precoce na agência:

| Dimensão | Pergunta que captura | Por que prediz churn |
|---|---|---|
| **Expectativa** | O cliente espera o impossível? | Cliente frustra-se em 30-60 dias e cancela. |
| **Estrutura/Orçamento** | O cliente está pronto para operar? | Sem verba/equipe/produto, nada sai do papel — culpa mora na agência. |
| **Adequação de serviço** | Vendemos o produto certo? | Serviço errado nunca entrega valor — desgaste mútuo até cancelar. |

Esses 3 critérios **somam até 100 pontos**, distribuídos por relevância:

```
Expectativa irreal     ████████████████░░░░  40 pts (40%)  ← MAIOR PESO
Falta de estrutura     ██████████████░░░░░░  35 pts (35%)
Serviço inadequado     ██████████░░░░░░░░░░  25 pts (25%)
                                            ───
                                            100 pts
```

Expectativa pesa mais porque é a **causa raiz mais comum de churn precoce** identificada historicamente. Estrutura e adequação são habilitadores — sem eles, o resultado não acontece, mas com expectativa correta o cliente ao menos entende quando precisa esperar.

Os sinais secundários **modulam** o score:

- **Agravantes** somam até **+10 pontos** — sinais que aumentam o risco já detectado.
- **Atenuantes** subtraem até **−15 pontos** — sinais positivos que reduzem o risco aparente.

A janela maior dos atenuantes (15 vs 10) é proposital: quando os fundamentos estão muito bons, o sistema dá benefício da dúvida sobre falhas pontuais.

---

## 4. Os 3 critérios de risco — em detalhe

### 4.1 Critério 1: Expectativa Irreal de Resultado (0-40 pts) — **MAIOR PESO**

**O que avaliar:** se o cliente espera resultados em prazos incompatíveis com a realidade, se o vendedor fez promessas exageradas, ou se o cliente demonstra impaciência/urgência irreal.

**Sinais a procurar na transcrição:**

- Cliente menciona "já no primeiro mês", "30 dias", "resultado rápido" para expectativas que naturalmente levam 3-6 meses (ex: ROAS estável, CAC otimizado, autoridade orgânica).
- Vendedor confirma esses prazos sem corrigir ou condicionar.
- Cliente fala em volumes específicos ("quero 100 leads no primeiro mês") sem base histórica nem orçamento proporcional.
- Cliente compara com um caso de sucesso atípico que viu ("vi um cliente seu fazendo X em 60 dias, quero igual").
- Frases como "se não der resultado em X, vou trocar" indicam impaciência embutida.
- **Fortíssimo sinal:** vendedor prometeu número específico ("vou te trazer 50 leads/mês") em vez de processo.

**Gradação:**

| Pontos | Cenário |
|---|---|
| **0** | Expectativas realistas de prazo e resultado, ou expectativa não-comentada (cliente humilde sobre prazos). |
| **10-15** | Expectativas levemente otimistas mas o vendedor corrigiu / o cliente aceitou correção bem. |
| **20-30** | Expectativas claramente desalinhadas. Vendedor não corrigiu adequadamente, ou tentou e o cliente resistiu. |
| **35-40** | Expectativas completamente irreais. Vendedor reforçou ou prometeu algo absurdo para fechar a venda. |

### 4.2 Critério 2: Falta de Estrutura / Orçamento (0-35 pts)

**O que avaliar:** se o cliente tem verba para mídia/anúncios, equipe interna mínima, produto/estoque pronto, e condições operacionais para operar com a agência.

**Sinais a procurar:**

- **Verba de mídia indefinida ou ausente:** "ainda vou ver com meu sócio quanto a gente investe", "não sei o budget exato", "queria começar com pouco e depois aumentar".
- **Sem produto/estoque:** e-commerce sem produto cadastrado, infoprodutor sem aula gravada, B2B sem pitch.
- **Site quebrado/inexistente:** "ainda estamos refazendo", "o site está fora do ar".
- **Sem equipe interna:** ninguém para responder leads, sem CRM, sem atendimento configurado.
- **Operação caótica:** cliente menciona disfunção interna ("brigando com sócios", "trocando de fornecedor", "sem ter quem responda WhatsApp").
- **Verba apertada para o objetivo:** quer escala mas o investimento mensal não comporta.

**Gradação:**

| Pontos | Cenário |
|---|---|
| **0** | Verba, equipe e operação prontas. Cliente sabe quanto vai investir, tem produto pronto, tem quem opere. |
| **8-15** | Pequenas lacunas (site precisa ajustes, verba apertada, equipe pequena mas funcional). |
| **18-25** | Lacunas significativas: sem verba definida OU sem produto/operação pronto (mas não ambos). |
| **28-35** | Múltiplas lacunas graves: sem verba E sem estrutura operacional. Cliente "vem buscar tudo" da agência. |

### 4.3 Critério 3: Serviço Vendido Inadequado (0-25 pts)

**O que avaliar:** se a necessidade real do cliente combina com o serviço vendido e se o perfil do negócio é compatível com o produto contratado.

**Sinais a procurar:**

- Cliente vende B2B mas comprou pacote de Performance focado em B2C.
- Negócio local de baixo ticket comprou serviço focado em escala nacional.
- Cliente quer awareness de marca mas comprou serviço de conversão direta.
- Ticket médio do cliente não comporta o CPL esperado do canal.
- Segmento muito nichado (serviços técnicos, regulamentados) com produto genérico.
- Cliente verbaliza necessidade A mas saiu da reunião com produto B.

**Gradação:**

| Pontos | Cenário |
|---|---|
| **0** | Serviço atende bem a necessidade real. Cliente entende o que comprou. |
| **5-10** | Leve desalinhamento — ajustável no onboarding com escopo refinado. |
| **12-18** | Desalinhamento claro entre necessidade e serviço contratado. |
| **20-25** | Serviço completamente errado para o perfil — não há onboarding que conserte. |

---

## 5. Sinais secundários — agravantes e atenuantes

Os critérios principais capturam **estado** (expectativa, estrutura, adequação). Os secundários capturam **dinâmica** (perfil de quem está na sala, padrões de comportamento, sinais de maturidade).

Cada sinal vale **1 a 3 pontos** dependendo da intensidade. Somatórios capados (agravantes ≤ +10, atenuantes ≤ -15).

### 5.1 Agravantes (+0 a +10 pts no total)

| Sinal | O que detectar |
|---|---|
| **Tomador de decisão ausente** | Reunião foi com intermediário (assistente, gerente operacional). O dono / decisor real nunca apareceu. Risco: aprovação atrasa, decisões mudam após o fechamento. |
| **Histórico negativo com agências** | Cliente já trocou 2+ agências em pouco tempo. Reclama todas. Risco: padrão de relacionamento tóxico, vai repetir aqui. |
| **Falta de clareza no objetivo** | "Quero crescer", "vender mais" sem KPI nem meta numérica. Risco: nunca está satisfeito porque nunca há critério de sucesso. |
| **Dependência excessiva da agência** | Cliente espera que a agência cuide de conteúdo, fotos, estratégia, atendimento — tudo. Risco: escopo infla, custo não fecha, frustração mútua. |
| **Desalinhamento de perfil/porte** | Segmento ou porte do cliente está fora do que a agência sabe operar bem. Risco: agência aprende no cliente, cliente paga pelo aprendizado. |

### 5.2 Atenuantes (−0 a −15 pts no total)

| Sinal | O que detectar |
|---|---|
| **Orçamento robusto e definido** | Cliente fala valores concretos, tem reserva separada, sabe quanto investe e por quanto tempo aguenta. |
| **Experiência prévia com marketing digital** | Já trabalhou com agência (mesmo que não deu certo, sabe como é). Roda campanhas próprias. Entende vocabulário. |
| **Tomador de decisão presente e engajado** | Decisor está na reunião, faz perguntas relevantes, demonstra responsabilidade. |
| **Expectativas realinhadas na reunião** | Vendedor corrigiu uma expectativa irreal, o cliente entendeu e aceitou bem. Reduz risco da expectativa irreal vista no Critério 1. |
| **Estrutura operacional pronta** | Site no ar, produto disponível, equipe de atendimento funcionando, CRM configurado. |

### 5.3 Como o realinhamento na reunião funciona

O atenuante "expectativas realinhadas" interage com o Critério 1. Mesmo que o cliente tenha começado com expectativa irreal, **se o vendedor corrigiu e o cliente recalibrou**, o sistema:

- Mantém o Critério 1 com pontos médios (não zero — a expectativa inicial existiu).
- Aplica o atenuante para reduzir o score total em até 3 pts.

Isso premia vendedores que fazem **venda consultiva** mesmo quando o cliente chega com a régua errada.

---

## 6. Cálculo do score e classificação

### 6.1 Fórmula

```
score_numerico = critério_1 + critério_2 + critério_3 + agravantes − atenuantes
```

Resultado é **clampado entre 0 e 100** (não pode ser negativo nem passar de 100).

### 6.2 Classificação categórica (visual)

| Faixa | Score categórico | Cor sugerida |
|---|---|---|
| 0-39 | **baixo** | verde |
| 40-69 | **medio** | amarelo |
| 70-100 | **alto** | vermelho |

### 6.3 Recomendação (acionável)

| Faixa | Recomendação | O que significa |
|---|---|---|
| 0-30 | **Aprovar** | Cliente saudável, segue para onboarding padrão. |
| 31-50 | **Aprovar com atenção** | Aprovado, mas o squad precisa estar ciente dos sinais — onboarding com checklist extra. |
| 51-70 | **Escalar para gestor** | Decisão fora do squad — gestor avalia se aceita o risco ou pede revisão de proposta. |
| 71-100 | **Rejeitar - alto risco** | Recomendação é não fechar. Se fechar, há registro de que a IA alertou. |

A separação **classificação** vs **recomendação** é proposital:

- **Classificação** comunica risco a stakeholders (rótulo curto, fácil de filtrar).
- **Recomendação** comunica próximo passo a quem opera (verbo, ação).

Score 70 é "alto" mas ainda pede "escalar" (não rejeitar) — há margem para revisão. Score 71 já é rejeição direta.

---

## 7. Avaliação do vendedor — paralela ao score do cliente

A IA também emite um **laudo separado sobre a postura do vendedor**. Isso é **obrigatório** mesmo quando não há nada negativo a dizer (i.e., a seção sempre existe na saída).

A intenção é dupla:

1. **Feedback estruturado para o time comercial** — o que o vendedor fez certo/errado, com trecho específico da transcrição. Vira material de coaching.
2. **Separar responsabilidades** — um cliente de risco alto pode ter um vendedor exemplar (cliente difícil mesmo), ou pode ter um vendedor que **criou** o risco (prometendo demais). Importante distinguir.

### 7.1 Pontos negativos (procurar)

| Comportamento | Por que é problema |
|---|---|
| Prometeu resultados exagerados ou prazos irreais | Cria a expectativa irreal que vai virar churn. |
| Empurrou produto/serviço inadequado | Fechou contrato, mas plantou desalinhamento. |
| Não alinhou expectativas quando cliente demonstrou visão irrealista | Falha consultiva — sabia e omitiu. |
| Não investigou a real necessidade do cliente | Vendeu o que está no catálogo, não o que o cliente precisa. |
| Omitiu limitações, riscos ou pré-requisitos | Cliente descobre depois que faltava algo — frustração. |

### 7.2 Pontos positivos (procurar)

| Comportamento | Por que é mérito |
|---|---|
| Alinhou expectativas de forma clara e honesta | Reduz churn antes mesmo de começar. |
| Fez perguntas consultivas | Venda baseada em diagnóstico, não em catálogo. |
| Sugeriu o produto/serviço mais adequado | Pode ter ganho menos comissão por isso, mas reduziu o risco. |
| Explicou pré-requisitos | Cliente chega ao onboarding sabendo o que precisa ter. |
| Conduziu a reunião de forma profissional | Tom, estrutura, próximos passos claros. |

### 7.3 Nota geral do vendedor

Saída categórica: **"boa"** / **"regular"** / **"ruim"**. Combina o saldo entre positivos e negativos detectados, ponderado pela severidade.

---

## 8. Estrutura da saída (formato JSON)

A IA responde **sempre** em JSON estrito (sem markdown, sem texto explicativo antes/depois). A estrutura abaixo é o contrato — se o sistema vai consumir essa saída, precisa parsear assim:

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
    "formula": "30 + 15 + 10 + 3 - 6 = 52"
  },
  "analise": {
    "expectativa_irreal": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "pontos": 0-40,
      "justificativa": "explicação em 1-2 frases",
      "trechos": ["trecho relevante da transcrição"]
    },
    "falta_estrutura": { ... mesma estrutura, max 35 pts ... },
    "servico_inadequado": { ... mesma estrutura, max 25 pts ... }
  },
  "agravantes": [
    { "sinal": "Tomador de decisão ausente", "pontos": 1-3, "justificativa": "..." }
  ],
  "atenuantes": [
    { "sinal": "Orçamento robusto e definido", "pontos": 1-3, "justificativa": "..." }
  ],
  "avaliacao_vendedor": {
    "pontos_negativos": [
      { "aspecto": "...", "justificativa": "...", "trecho": "..." }
    ],
    "pontos_positivos": [
      { "aspecto": "...", "justificativa": "...", "trecho": "..." }
    ],
    "nota_geral": "boa" | "regular" | "ruim",
    "resumo_vendedor": "resumo da postura em 1-2 frases"
  },
  "resumo": "resumo executivo em 2-3 frases",
  "recomendacao": "Aprovar" | "Aprovar com atenção" | "Escalar para gestor" | "Rejeitar - alto risco"
}
```

### Por que cada campo existe

| Campo | Para quê |
|---|---|
| `score` + `score_numerico` | Filtros e ordenações; cor visual. |
| `composicao_score.formula` | Auditoria — humano consegue reproduzir o cálculo mentalmente. |
| `analise.*.trechos` | Citação direta da transcrição para cada decisão de pontuação. **Crítico** — sem isso a IA vira caixa-preta. |
| `analise.*.severidade` | Granularidade visual além dos pontos. |
| `agravantes`/`atenuantes` arrays | Permite UI mostrar tags/chips. |
| `avaliacao_vendedor` | Feedback estruturado para coaching. |
| `resumo` | TL;DR para quem não vai abrir o detalhe. |
| `recomendacao` | Ação imediata — o que fazer com este caso. |

---

## 9. Princípios de design — o que o sistema NÃO faz

Decisões conscientes para manter a triagem útil:

### 9.1 A IA não decide nada — recomenda

Mesmo com score 100, a IA fala "Rejeitar - alto risco", não "Rejeitado". Sempre há um humano que registra a decisão final (`aprovado` / `rejeitado` / `escalado`) com observações. A IA nunca é juíza.

### 9.2 Sem aprendizado contínuo (no MVP)

O prompt é **fixo**. Não há fine-tuning, não há acumulação de exemplos few-shot a partir das decisões humanas, não há feedback automático. Toda evolução do "cérebro" hoje passa por:

1. Discutir mudança de critério com o time.
2. Editar o prompt.
3. Validar manualmente em 5-10 casos antigos.
4. Deploy.

Isso é proposital — o domínio muda devagar (critérios de churn não viram da água pro vinho), e a transparência do prompt vale mais do que a sofisticação de um modelo aprendendo sozinho.

### 9.3 Sem feedback do vendedor para a IA

A IA julga o vendedor, mas o vendedor não responde para a IA. Isso é decisão de produto: a triagem é uma **ferramenta de gestão**, não um diálogo. Vendedor recebe coaching humano com base no que a IA detectou.

### 9.4 Saída estruturada > prosa livre

O prompt obriga JSON estrito. Isso:

- Evita a IA "explicar com palavras" sem comprometer com pontos.
- Permite UI rica (gráficos, tags, filtros).
- Permite auditoria automatizada (testar consistência da fórmula, agregar por critério, etc).

### 9.5 Citação obrigatória

Cada critério detectado precisa apresentar **trecho da transcrição** que justifica a pontuação. Isso é o antídoto contra alucinação: se a IA não consegue citar, ela não detectou.

---

## 10. Casos de borda — o que acontece quando dá errado

### 10.1 IA não retorna JSON válido

O sistema faz **fallback para análise inconclusiva** com:

- `score_numerico: 50`
- `score: "medio"`
- Recomendação: `"Escalar para gestor"`
- Resumo: "Análise inconclusiva — resposta da IA não pôde ser processada."
- Todos os arrays vazios.

A lógica: na dúvida, **escala para humano**. Não bloqueia o fluxo, mas marca como precisando atenção.

### 10.2 Transcrição não disponível

Se não há transcrição (nem no Drive nem colada manualmente), **não há análise**. O sistema exige texto antes de chamar a IA.

### 10.3 Transcrição muito longa

Modelo Sonnet 4.5 com `max_tokens: 4096` na saída suporta inputs grandes (200K+ tokens de contexto). Transcrições típicas de reunião de venda (30-90 min) cabem com folga. Se um dia faltar contexto, o caminho é resumir antes de mandar — não cortar.

### 10.4 Cliente sem nome conhecido

Busca de transcrição no Drive depende de match exato no nome. Cliente com nome ambíguo (ex: "João") pega a primeira ocorrência por modificação mais recente — pode trazer transcrição errada. Mitigação: usuário cola manualmente quando não confia no auto-fetch.

---

## 11. Como replicar em outro ambiente (Lovable)

Este documento é o **espec funcional** completo. Para implementar a triagem em outro stack, é preciso replicar:

### 11.1 O cérebro (não-negociável)

1. **Prompt do sistema completo** — copiar o texto da Seção 4 + 5 + 6 + 7 + 8 verbatim ou com ajustes mínimos.
2. **Modelo:** Claude Sonnet (versão atual mais recente — hoje `claude-sonnet-4-5`). Outros modelos funcionam mas a qualidade da análise pode variar — testar antes.
3. **Saída em JSON estrito** com a estrutura da Seção 8.
4. **Fallback** quando JSON inválido (Seção 10.1).

### 11.2 Os fluxos (adaptáveis)

| Item | Padrão atual | Adaptação razoável |
|---|---|---|
| Fonte da transcrição | Google Drive (busca por nome) + cola manual | Upload direto, integração com outra ferramenta de gravação (Otter, Fireflies, Gong), ou sempre manual. |
| Lista de clientes | Tabela ClickUp `cup_clientes` (status='triagem') | Qualquer fonte de leads pré-onboarding. |
| Persistência | PostgreSQL com tabela `triagem_analises` (1 tabela com JSONB para análise completa) | Qualquer banco; estrutura pode ser simplificada. |
| Decisão humana | Workflow `pendente` → `aprovado`/`rejeitado`/`escalado` com observação | Manter o workflow de decisão. Granularidade pode mudar. |

### 11.3 O que NÃO copiar cegamente

- **Pesos dos critérios** (40/35/25). Validar se fazem sentido para o domínio do outro ambiente. Numa agência B2B SaaS, os pesos podem ser muito diferentes.
- **Faixas de classificação e recomendação** (0-30/31-50/...). Calibrar com base em dados reais — começar com essas e ajustar após 50-100 análises.
- **Tom dos sinais.** "Tomador de decisão ausente" pode não fazer sentido em todo modelo de venda.

### 11.4 Métricas para validar a triagem (após 30-60 dias rodando)

| Métrica | Para validar |
|---|---|
| Taxa de concordância humano-IA | Quantas vezes o humano segue a recomendação da IA. |
| Churn precoce dos "Aprovar" | Se o sistema está deixando passar risco. |
| Churn precoce dos "Rejeitar - alto risco" se foram aceitos mesmo assim | Se a IA está acertando ao prever churn. |
| Distribuição dos scores | Se 90% dos clientes caem em "alto", a calibração está errada. |
| Citação da transcrição válida | Auditar amostra: trechos citados correspondem à pontuação? |

---

## 12. Glossário rápido

| Termo | Significado |
|---|---|
| **Triagem** | Análise pré-onboarding para identificar risco de churn precoce. |
| **Churn precoce** | Cliente que cancela em 1-3 meses após início — antes do contrato anual. |
| **Score numérico** | Pontuação 0-100 que combina os 3 critérios + agravantes − atenuantes. |
| **Score categórico** | Rótulo "baixo"/"medio"/"alto" derivado do numérico. |
| **Recomendação** | Ação sugerida ("Aprovar", "Escalar", etc) — independente do score categórico. |
| **Agravante** | Sinal secundário que **aumenta** o risco já detectado. |
| **Atenuante** | Sinal secundário que **reduz** o risco já detectado. |
| **Avaliação do vendedor** | Laudo paralelo, separado do score do cliente, sobre a postura do vendedor. |
| **Análise inconclusiva** | Saída de fallback quando a IA não retorna JSON válido. |
