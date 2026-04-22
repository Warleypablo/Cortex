# Triagem Scoring Refinado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar o sistema de scoring da triagem inteligente com pesos explícitos, sinais agravantes, atenuantes e fórmula transparente.

**Architecture:** Reescrever o prompt do Claude em `server/services/triagem.ts` com critérios ponderados e formato de saída expandido. Atualizar os tipos TypeScript em `client/src/pages/Triagem.tsx` e expandir o DetailSheet para mostrar composição do score, agravantes e atenuantes.

**Tech Stack:** TypeScript, Anthropic SDK (claude-sonnet-4-5), React, Tailwind CSS, shadcn/ui

---

### Task 1: Reescrever o prompt do Claude com novos critérios

**Files:**
- Modify: `server/services/triagem.ts:58-97`

- [ ] **Step 1: Substituir `TRIAGEM_SYSTEM_PROMPT`**

Replace the entire `TRIAGEM_SYSTEM_PROMPT` constant (lines 58-97) with:

```typescript
const TRIAGEM_SYSTEM_PROMPT = `Você é um analista de qualidade de vendas da Turbo Partners, uma agência de marketing digital.

Sua tarefa é analisar a transcrição de uma reunião de venda e identificar sinais de desalinhamento que indicam risco de churn precoce.

## SISTEMA DE PONTUAÇÃO

Analise a transcrição usando EXATAMENTE 3 critérios principais de risco, cada um com um peso máximo de pontos:

### Critério 1: Expectativa Irreal de Resultado (0 a 40 pontos) — MAIOR PESO
Avalie se o cliente espera resultados em prazos incompatíveis com a realidade, se o vendedor fez promessas exageradas, ou se o cliente demonstra impaciência/urgência irreal.
- 0 pontos: Expectativas realistas de prazo e resultado
- 10-15 pontos: Expectativas levemente otimistas mas corrigíveis
- 20-30 pontos: Expectativas claramente desalinhadas, vendedor não corrigiu adequadamente
- 35-40 pontos: Expectativas completamente irreais, promessas exageradas pelo vendedor

### Critério 2: Falta de Estrutura / Orçamento (0 a 35 pontos)
Avalie se o cliente tem verba para mídia/anúncios, equipe interna, produto/estoque pronto, e condições operacionais mínimas.
- 0 pontos: Verba, equipe e operação prontas
- 8-15 pontos: Pequenas lacunas (site precisa ajustes, verba de mídia apertada)
- 18-25 pontos: Lacunas significativas (sem verba definida OU sem produto/operação prontos)
- 28-35 pontos: Múltiplas lacunas graves (sem verba E sem estrutura operacional)

### Critério 3: Serviço Vendido Inadequado (0 a 25 pontos)
Avalie se a necessidade real do cliente combina com o serviço vendido e se o perfil do negócio é compatível com o produto contratado.
- 0 pontos: Serviço atende bem a necessidade real
- 5-10 pontos: Leve desalinhamento, ajustável no onboarding
- 12-18 pontos: Desalinhamento claro entre necessidade e serviço
- 20-25 pontos: Serviço completamente errado para o perfil

## SINAIS SECUNDÁRIOS — AGRAVANTES (até +10 pontos no total, máximo +3 cada)

Identifique se algum destes sinais está presente na transcrição:
- **Tomador de decisão ausente**: Reunião foi com intermediário, decisor nunca participou
- **Histórico negativo com agências**: Cliente já trocou várias agências, insatisfação recorrente
- **Falta de clareza no objetivo**: "Quero crescer" sem métricas, sem meta definida
- **Dependência excessiva da agência**: Cliente espera que a agência resolva tudo (conteúdo, fotos, estratégia, atendimento)
- **Desalinhamento de perfil/porte**: Segmento ou porte do cliente fora do perfil atendido pela agência

## SINAIS ATENUANTES (até -15 pontos no total, máximo -3 cada)

Identifique se algum destes sinais positivos está presente e pode REDUZIR a severidade dos riscos detectados:
- **Orçamento robusto e definido**: Cliente já tem verba separada, sabe quanto quer investir
- **Experiência prévia com marketing digital**: Já trabalhou com agência ou roda campanhas próprias
- **Tomador de decisão presente e engajado**: Decisor na reunião, faz perguntas relevantes, demonstra compromisso
- **Expectativas realinhadas na reunião**: Vendedor corrigiu expectativas e cliente aceitou bem
- **Estrutura operacional pronta**: Site no ar, produto disponível, equipe de atendimento funcionando

## CÁLCULO DO SCORE

score_numerico = (pontos critério 1) + (pontos critério 2) + (pontos critério 3) + (soma agravantes) - (soma atenuantes)

O resultado deve ser CLAMPADO entre 0 e 100.

## CLASSIFICAÇÃO

Com base no score_numerico:
- 0-39: score = "baixo"
- 40-69: score = "medio"
- 70-100: score = "alto"

## RECOMENDAÇÃO

Com base no score_numerico:
- 0-30: "Aprovar"
- 31-50: "Aprovar com atenção"
- 51-70: "Escalar para gestor"
- 71-100: "Rejeitar - alto risco"

Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks, sem texto antes ou depois. Use esta estrutura exata:

{
  "score": "alto" | "medio" | "baixo",
  "score_numerico": <0-100>,
  "composicao_score": {
    "expectativa_irreal": <0-40>,
    "falta_estrutura": <0-35>,
    "servico_inadequado": <0-25>,
    "agravantes_total": <0-10>,
    "atenuantes_total": <0-15>,
    "formula": "<ex: 30 + 15 + 10 + 3 - 6 = 52>"
  },
  "analise": {
    "expectativa_irreal": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "pontos": <0-40>,
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante da transcrição>"]
    },
    "falta_estrutura": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "pontos": <0-35>,
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante>"]
    },
    "servico_inadequado": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "pontos": <0-25>,
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante>"]
    }
  },
  "agravantes": [
    {
      "sinal": "<nome do sinal>",
      "pontos": <1-3>,
      "justificativa": "<explicação breve>"
    }
  ],
  "atenuantes": [
    {
      "sinal": "<nome do sinal>",
      "pontos": <1-3>,
      "justificativa": "<explicação breve>"
    }
  ],
  "resumo": "<resumo executivo em 2-3 frases>",
  "recomendacao": "Aprovar" | "Aprovar com atenção" | "Escalar para gestor" | "Rejeitar - alto risco"
}`;
```

- [ ] **Step 2: Atualizar o fallback de parse error**

Replace the catch block fallback (lines 122-132) to include the new fields:

```typescript
  try {
    return JSON.parse(text);
  } catch {
    console.error("[triagem] Failed to parse Claude response:", text);
    return {
      score: "medio",
      score_numerico: 50,
      composicao_score: {
        expectativa_irreal: 0,
        falta_estrutura: 0,
        servico_inadequado: 0,
        agravantes_total: 0,
        atenuantes_total: 0,
        formula: "Análise inconclusiva",
      },
      analise: {
        expectativa_irreal: { detectado: false, severidade: "nenhuma", pontos: 0, justificativa: "Não foi possível analisar", trechos: [] },
        falta_estrutura: { detectado: false, severidade: "nenhuma", pontos: 0, justificativa: "Não foi possível analisar", trechos: [] },
        servico_inadequado: { detectado: false, severidade: "nenhuma", pontos: 0, justificativa: "Não foi possível analisar", trechos: [] },
      },
      agravantes: [],
      atenuantes: [],
      resumo: "Análise inconclusiva - resposta da IA não pôde ser processada.",
      recomendacao: "Escalar para gestor",
    };
  }
```

- [ ] **Step 3: Commit**

```bash
git add server/services/triagem.ts
git commit -m "feat(triagem): rewrite scoring prompt with weighted criteria, aggravators and mitigators"
```

---

### Task 2: Atualizar types do frontend

**Files:**
- Modify: `client/src/pages/Triagem.tsx:57-73`

- [ ] **Step 1: Adicionar novas interfaces**

Replace the `CriterioAnalise` and `AnaliseJson` interfaces (lines 57-74) with:

```typescript
interface CriterioAnalise {
  detectado: boolean;
  severidade: "alta" | "media" | "baixa" | "nenhuma";
  pontos: number;
  justificativa: string;
  trechos: string[];
}

interface SinalSecundario {
  sinal: string;
  pontos: number;
  justificativa: string;
}

interface ComposicaoScore {
  expectativa_irreal: number;
  falta_estrutura: number;
  servico_inadequado: number;
  agravantes_total: number;
  atenuantes_total: number;
  formula: string;
}

interface AnaliseJson {
  score: "alto" | "medio" | "baixo";
  score_numerico: number;
  composicao_score: ComposicaoScore;
  analise: {
    expectativa_irreal: CriterioAnalise;
    falta_estrutura: CriterioAnalise;
    servico_inadequado: CriterioAnalise;
  };
  agravantes: SinalSecundario[];
  atenuantes: SinalSecundario[];
  resumo: string;
  recomendacao: "Aprovar" | "Aprovar com atenção" | "Escalar para gestor" | "Rejeitar - alto risco";
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Triagem.tsx
git commit -m "feat(triagem): update frontend types for new scoring format"
```

---

### Task 3: Expandir o DetailSheet com composição do score

**Files:**
- Modify: `client/src/pages/Triagem.tsx:426-608` (DetailSheet component)

- [ ] **Step 1: Adicionar helper `ScoreCompositionBar`**

Add this component right after the `ScoreBar` component (after line 147):

```tsx
function ScoreCompositionBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 dark:text-zinc-400">{label}</span>
        <span className="font-medium text-gray-700 dark:text-zinc-300">{value}/{max}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar seção de composição do score no DetailSheet**

Inside the DetailSheet component, after the score bar section (after the closing `)}` of the `{analise.scoreNumerico !== null && (` block, around line 469), add:

```tsx
          {/* Score Composition */}
          {aj?.composicao_score && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
                Composição do Score
              </h3>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-3">
                <ScoreCompositionBar
                  label="Expectativa Irreal"
                  value={aj.composicao_score.expectativa_irreal}
                  max={40}
                  color="bg-red-500"
                />
                <ScoreCompositionBar
                  label="Falta de Estrutura"
                  value={aj.composicao_score.falta_estrutura}
                  max={35}
                  color="bg-orange-500"
                />
                <ScoreCompositionBar
                  label="Serviço Inadequado"
                  value={aj.composicao_score.servico_inadequado}
                  max={25}
                  color="bg-yellow-500"
                />
                {aj.composicao_score.agravantes_total > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t border-gray-200 dark:border-zinc-700">
                    <span className="text-red-600 dark:text-red-400">+ Agravantes</span>
                    <span className="font-medium text-red-600 dark:text-red-400">+{aj.composicao_score.agravantes_total}</span>
                  </div>
                )}
                {aj.composicao_score.atenuantes_total > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600 dark:text-green-400">- Atenuantes</span>
                    <span className="font-medium text-green-600 dark:text-green-400">-{aj.composicao_score.atenuantes_total}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs pt-1 border-t border-gray-200 dark:border-zinc-700">
                  <span className="text-gray-500 dark:text-zinc-500 font-mono">{aj.composicao_score.formula}</span>
                </div>
              </div>
            </div>
          )}
```

- [ ] **Step 3: Adicionar pontos ao lado de cada critério**

In the criteria rendering section (inside the `criterios.map` block, around line 546-554), replace the severity display to include points:

Replace this block:
```tsx
                    <div className="flex items-center gap-2">
                      {data.detectado ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      <span className={`text-xs font-medium capitalize ${SEVERIDADE_CONFIG[data.severidade]}`}>
                        {data.severidade === "nenhuma" ? "Não detectado" : `Severidade: ${data.severidade}`}
                      </span>
                    </div>
```

With:
```tsx
                    <div className="flex items-center gap-2">
                      {data.detectado ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      <span className={`text-xs font-medium capitalize ${SEVERIDADE_CONFIG[data.severidade]}`}>
                        {data.severidade === "nenhuma" ? "Não detectado" : `Severidade: ${data.severidade}`}
                      </span>
                      {data.pontos > 0 && (
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          +{data.pontos} pts
                        </span>
                      )}
                    </div>
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Triagem.tsx
git commit -m "feat(triagem): add score composition display to detail sheet"
```

---

### Task 4: Adicionar seções de agravantes e atenuantes no DetailSheet

**Files:**
- Modify: `client/src/pages/Triagem.tsx:426-608` (DetailSheet component)

- [ ] **Step 1: Adicionar seção de agravantes**

After the criteria section closing `</div>` (the one that closes `{criterios.length > 0 && (`), add:

```tsx
          {/* Agravantes */}
          {aj?.agravantes && aj.agravantes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Sinais Agravantes (+{aj.agravantes.reduce((s, a) => s + a.pontos, 0)} pts)
              </h3>
              <div className="space-y-2">
                {aj.agravantes.map((agr, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{agr.sinal}</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">+{agr.pontos} pts</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">{agr.justificativa}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Atenuantes */}
          {aj?.atenuantes && aj.atenuantes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Sinais Atenuantes (-{aj.atenuantes.reduce((s, a) => s + a.pontos, 0)} pts)
              </h3>
              <div className="space-y-2">
                {aj.atenuantes.map((att, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{att.sinal}</span>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">-{att.pontos} pts</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">{att.justificativa}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Triagem.tsx
git commit -m "feat(triagem): add aggravators and mitigators sections to detail sheet"
```

---

### Task 5: Atualizar contagem de sinais no AnaliseCard

**Files:**
- Modify: `client/src/pages/Triagem.tsx:618-709` (AnaliseCard component)

- [ ] **Step 1: Atualizar cálculo de sinais detectados**

Replace the `detectedCount` calculation (lines 620-622) with:

```typescript
  const detectedCount = aj
    ? Object.values(aj.analise).filter(c => c.detectado).length + (aj.agravantes?.length || 0)
    : 0;
  const mitigatorCount = aj?.atenuantes?.length || 0;
```

- [ ] **Step 2: Adicionar indicador de atenuantes no card**

After the `detectedCount` display (around line 675), add the mitigator indicator:

```tsx
          {mitigatorCount > 0 && (
            <span className="flex items-center gap-1 text-green-500 dark:text-green-400">
              <ShieldCheck className="w-3 h-3" /> {mitigatorCount} atenuante{mitigatorCount > 1 ? "s" : ""}
            </span>
          )}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Triagem.tsx
git commit -m "feat(triagem): show aggravator and mitigator counts in analysis cards"
```

---

### Task 6: Testar no browser

**Files:** None (testing only)

- [ ] **Step 1: Reiniciar o dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

- [ ] **Step 2: Testar criação de nova análise**

Navigate to `/triagem`, create a new analysis with a test transcription. Verify:
- Score numérico respeita as faixas de peso (0-40, 0-35, 0-25)
- Composição do score aparece no detail sheet com barras visuais
- Fórmula legível é exibida
- Agravantes e atenuantes aparecem quando detectados
- Cards mostram contagem de sinais + atenuantes

- [ ] **Step 3: Testar retrocompatibilidade**

If there are existing analyses, verify they still render correctly (old format without `composicao_score`, `agravantes`, `atenuantes` fields — these should be handled gracefully with optional chaining `?.`).

- [ ] **Step 4: Testar dark mode**

Toggle dark mode and verify all new sections render correctly.

- [ ] **Step 5: Commit final (if any fixes needed)**

```bash
git add -A
git commit -m "fix(triagem): polish scoring UI after browser testing"
```
