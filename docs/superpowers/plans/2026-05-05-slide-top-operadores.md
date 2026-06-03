# Slide Top Operadores — Reporte Mensal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um novo slide "Top Operadores" na posição 15 do Reporte Mensal, exibindo um pódio (🥇🥈🥉) com os 3 melhores operadores em MRR Ativo, Menor Churn e Projetos Entregues no mês.

**Architecture:** Backend adiciona 3 queries ao Promise.all existente em `relatorioMensalSlides.ts` e expõe `topOperadores` no res.json. Frontend adiciona tipos em `types.ts`, cria o componente `SlideTopOperadores.tsx`, e reconfigura `RelatorioMensal.tsx` para inserir o slide no índice 15 e reindexar os casos 15→23 para 16→24.

**Tech Stack:** TypeScript, React, Tailwind CSS, Drizzle ORM `sql` tagged templates, PostgreSQL (cup_contratos + cup_churn)

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server/routes/relatorioMensalSlides.ts` | edit | Queries 24a/b/c + `topOperadores` em res.json |
| `client/src/pages/relatorio-mensal/types.ts` | edit | Interfaces `OperadorRanking`, `TopOperadores`, campo em `RelatorioMensalData` |
| `client/src/pages/relatorio-mensal/SlideTopOperadores.tsx` | create | Componente do novo slide |
| `client/src/pages/RelatorioMensal.tsx` | edit | Import, FIXED_SLIDE_NAMES, cases 15→24 |

---

### Task 1: Backend — 3 novas queries + topOperadores no res.json

**Files:**
- Modify: `server/routes/relatorioMensalSlides.ts`

Contexto: o arquivo tem uma grande lista de destructuring de `Promise.all` começando na linha ~122. O bloco atual termina com `dfcRecebimentoYtdResult` antes do `]` do `Promise.all`. O `res.json()` está nas linhas ~1363-1402.

- [ ] **Step 1: Adicionar as 3 novas variáveis ao destructuring do Promise.all**

Localize este trecho (fim do destructuring, antes de `] = await Promise.all([`):

```ts
        dfcRecebimentoYtdResult,
      ] = await Promise.all([
```

Substitua por:

```ts
        dfcRecebimentoYtdResult,
        topMrrResult,
        topMenorChurnResult,
        topEntregasResult,
      ] = await Promise.all([
```

- [ ] **Step 2: Adicionar as 3 queries no final do array do Promise.all**

Localize o último item do Promise.all (query de `dfcRecebimentoYtdResult`, que começa com `// Faturamento` ou similar) e adicione logo após o `)`  que fecha essa query, antes do `]);`:

```ts
        // 24a. Top 3 MRR Ativo por responsável (contratos ativos)
        db.execute(sql`
          SELECT
            responsavel as nome,
            COALESCE(SUM(
              CASE WHEN valorrec ~ '^[0-9.]+$' THEN valorrec::numeric ELSE 0 END
            ), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE LOWER(status) IN ('ativo', 'onboarding', 'triagem')
            AND responsavel IS NOT NULL
            AND TRIM(responsavel) != ''
          GROUP BY responsavel
          ORDER BY valor DESC
          LIMIT 3
        `),

        // 24b. Top 3 Menor Churn por responsavel_geral (churn do mês)
        db.execute(sql`
          SELECT
            responsavel_geral as nome,
            COALESCE(SUM(valor_r), 0)::numeric as valor
          FROM "Clickup".cup_churn
          WHERE data_solicitacao_encerramento IS NOT NULL
            AND data_solicitacao_encerramento >= ${dataStart}
            AND data_solicitacao_encerramento < ${dataEnd}
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
            AND responsavel_geral IS NOT NULL
            AND TRIM(responsavel_geral) != ''
          GROUP BY responsavel_geral
          ORDER BY valor ASC
          LIMIT 3
        `),

        // 24c. Top 3 Projetos Entregues por responsável (entregas no mês)
        db.execute(sql`
          SELECT
            responsavel as nome,
            COUNT(*)::int as valor
          FROM "Clickup".cup_contratos
          WHERE LOWER(status) = 'entregue'
            AND data_entrega >= ${dataStart}::date
            AND data_entrega < ${dataEnd}::date
            AND responsavel IS NOT NULL
            AND TRIM(responsavel) != ''
          GROUP BY responsavel
          ORDER BY valor DESC
          LIMIT 3
        `),
```

- [ ] **Step 3: Construir o objeto topOperadores e adicioná-lo ao res.json**

Localize o bloco `res.json({` (por volta da linha 1363). Antes dele, adicione:

```ts
      const topOperadores = {
        topMrr: (topMrrResult.rows as any[]).map((row: any) => ({
          nome: row.nome as string,
          valor: parseFloat(row.valor) || 0,
        })),
        topMenorChurn: (topMenorChurnResult.rows as any[]).map((row: any) => ({
          nome: row.nome as string,
          valor: parseFloat(row.valor) || 0,
        })),
        topEntregas: (topEntregasResult.rows as any[]).map((row: any) => ({
          nome: row.nome as string,
          valor: parseInt(row.valor) || 0,
        })),
      };
```

Dentro do objeto `res.json({ ... })`, adicione `topOperadores,` após `faturamentoYtd,`:

```ts
        faturamentoYtd,
        topOperadores,
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | head -40
```

Esperado: sem erros (ou erros não relacionados a este arquivo). Se houver erros em `relatorioMensalSlides.ts`, corrija antes de continuar.

- [ ] **Step 5: Commit**

```bash
git add server/routes/relatorioMensalSlides.ts
git commit -m "feat(top-operadores): queries 24a/b/c + topOperadores no backend

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Types — OperadorRanking, TopOperadores, campo em RelatorioMensalData

**Files:**
- Modify: `client/src/pages/relatorio-mensal/types.ts`

- [ ] **Step 1: Adicionar as duas novas interfaces antes de RelatorioMensalData**

Localize o início da interface `RelatorioMensalData` (linha ~257 do arquivo atual). Antes dela, insira:

```ts
export interface OperadorRanking {
  nome: string;
  valor: number;
}

export interface TopOperadores {
  topMrr: OperadorRanking[];
  topMenorChurn: OperadorRanking[];
  topEntregas: OperadorRanking[];
}
```

- [ ] **Step 2: Adicionar o campo topOperadores em RelatorioMensalData**

Dentro da interface `RelatorioMensalData`, após `faturamentoYtd: FaturamentoYtdData;`, adicione:

```ts
  topOperadores: TopOperadores;
```

O resultado final da interface deve ser:

```ts
export interface RelatorioMensalData {
  mesReferencia: string;
  mesLabel: string;
  mesDadosLabel: string;
  novosColaboradores: NovoColaborador[];
  aniversariantes: Aniversariante[];
  aniversariosEmpresa: AniversarioEmpresa[];
  okrObjectives: ObjectiveSlide[];
  rankingClosers: CloserRanking[];
  topPontual: CloserRanking | null;
  rankingSDRs: SdrRanking[];
  topReunioes: TopReunioes | null;
  contratosMes: ContratosMes;
  turboMetrics: TurboMetrics;
  rankingSquads: SquadRanking[];
  squadDetails: SquadDetail[];
  techData: TechSlideData;
  indicacoes: Indicacoes;
  pontualData: PontualData;
  faturamentoYtd: FaturamentoYtdData;
  topOperadores: TopOperadores;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | head -40
```

Esperado: sem novos erros. Pode haver erros downstream em arquivos que usam `RelatorioMensalData` mas ainda não receberam `topOperadores` — esses são esperados e serão resolvidos na Task 4.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/relatorio-mensal/types.ts
git commit -m "feat(top-operadores): tipos OperadorRanking e TopOperadores

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Criar SlideTopOperadores.tsx

**Files:**
- Create: `client/src/pages/relatorio-mensal/SlideTopOperadores.tsx`

- [ ] **Step 1: Criar o arquivo com o componente completo**

```tsx
import { Trophy } from "lucide-react";
import type { TopOperadores, OperadorRanking } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard } from "./SlideComponents";

interface Props {
  topOperadores: TopOperadores;
  mesLabel: string;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  if (v === 0) return "R$ 0";
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

const RANK_STYLES = [
  { text: "text-amber-400", size: "text-lg font-black" },
  { text: "text-zinc-300", size: "text-base font-bold" },
  { text: "text-zinc-500", size: "text-sm font-semibold" },
] as const;

interface PodiumColProps {
  title: string;
  items: OperadorRanking[];
  formatValue: (v: number) => string;
}

function PodiumCol({ title, items, formatValue }: PodiumColProps) {
  return (
    <SecondaryCard className="flex flex-col gap-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{title}</p>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-600 text-sm">Sem dados no mês</p>
        </div>
      ) : (
        items.map((item, i) => (
          <div key={item.nome} className="flex items-start gap-2.5">
            <span className="text-2xl leading-none mt-0.5">{MEDALS[i]}</span>
            <div className="flex-1 min-w-0">
              <p className={`truncate ${RANK_STYLES[i].size} ${RANK_STYLES[i].text}`}>
                {item.nome}
              </p>
              <p className={`text-xs ${RANK_STYLES[i].text} opacity-70`}>
                {formatValue(item.valor)}
              </p>
            </div>
          </div>
        ))
      )}
    </SecondaryCard>
  );
}

export default function SlideTopOperadores({ topOperadores, mesLabel }: Props) {
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={Trophy}
        iconColor="text-amber-400"
        title={`Top Operadores — ${mesLabel}`}
        gradientColor="#f59e0b"
      />

      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <PodiumCol
          title="MRR Ativo"
          items={topOperadores.topMrr}
          formatValue={fmtBRL}
        />
        <PodiumCol
          title="Menor Churn"
          items={topOperadores.topMenorChurn}
          formatValue={fmtBRL}
        />
        <PodiumCol
          title="Projetos Entregues"
          items={topOperadores.topEntregas}
          formatValue={(v) => `${v} entrega${v !== 1 ? "s" : ""}`}
        />
      </div>
    </SlideLayout>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | head -40
```

Esperado: sem erros no novo arquivo. Erros em `RelatorioMensal.tsx` são esperados até a Task 4.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideTopOperadores.tsx
git commit -m "feat(top-operadores): componente SlideTopOperadores com pódio 🥇🥈🥉

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Wiring em RelatorioMensal.tsx

**Files:**
- Modify: `client/src/pages/RelatorioMensal.tsx`

Contexto sobre o arquivo atual:
- `FIXED_SLIDE_NAMES` tem 24 entradas (índices 0–23); `STATIC_SLIDES = FIXED_SLIDE_NAMES.length`
- Os índices relevantes: `14 = "Ranking Squads"`, `15 = "Turbo Commerce"`, ..., `23 = "Q&A"`
- No `renderFixedSlide`: `case 14` é `SlideRankingSquads`, `case 15` é `SlideTurboMetrics`, ..., `case 23` é `SlideQRCode`

**Objetivo:** inserir "Top Operadores" em índice 15 (entre "Ranking Squads" e "Turbo Commerce"), resultando em 25 entradas.

- [ ] **Step 1: Adicionar o import de SlideTopOperadores**

Localize a linha de import de `SlideSquadSingle`:

```ts
import SlideSquadSingle from "./relatorio-mensal/SlideSquadSingle";
```

Adicione logo após:

```ts
import SlideTopOperadores from "./relatorio-mensal/SlideTopOperadores";
```

- [ ] **Step 2: Inserir "Top Operadores" em FIXED_SLIDE_NAMES**

Localize esta sequência dentro do array:

```ts
  "Ranking Squads", "Turbo Commerce",
```

Substitua por:

```ts
  "Ranking Squads", "Top Operadores", "Turbo Commerce",
```

`STATIC_SLIDES = FIXED_SLIDE_NAMES.length` se atualiza automaticamente para 25 — nenhuma outra mudança necessária nessa linha.

- [ ] **Step 3: Adicionar case 15 e reindexar cases 16–24 no renderFixedSlide**

Localize o bloco `case 14` até `default` dentro de `renderFixedSlide`:

```ts
      case 14: return <SlideRankingSquads ranking={data.rankingSquads} />;
      case 15: return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 16: return <SlidePontual pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 17: return <SlideEntregasPontuaisCommerce pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 18: return <SlideCapaTech />;
      case 19: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 20: return <SlideEntregasPontuaisTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 21: return <SlideTopicosDiscussao />;
      case 22: return <SlideFraseEncerramento />;
      case 23: return <SlideQRCode />;
      default: return null;
```

Substitua por:

```ts
      case 14: return <SlideRankingSquads ranking={data.rankingSquads} />;
      case 15: return <SlideTopOperadores topOperadores={data.topOperadores} mesLabel={data.mesDadosLabel} />;
      case 16: return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 17: return <SlidePontual pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 18: return <SlideEntregasPontuaisCommerce pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 19: return <SlideCapaTech />;
      case 20: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 21: return <SlideEntregasPontuaisTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 22: return <SlideTopicosDiscussao />;
      case 23: return <SlideFraseEncerramento />;
      case 24: return <SlideQRCode />;
      default: return null;
```

- [ ] **Step 4: Verificar TypeScript completo**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1
```

Esperado: zero erros. Se houver erro de `topOperadores` ausente em algum tipo, significa que o `useRelatorioMensal` precisa ser verificado — mas como ele usa o tipo `RelatorioMensalData` e o backend já retorna o campo, deve resolver automaticamente.

- [ ] **Step 5: Reiniciar o servidor e testar no browser**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Aguardar ~5 segundos e abrir `http://localhost:3000`. Navegar até Reporte Mensal e verificar:

1. O slide "Top Operadores" aparece após "Ranking Squads" (slot ~14 no deck, dependendo de quantos squad slides existem)
2. As 3 colunas renderizam: MRR Ativo, Menor Churn, Projetos Entregues
3. Cada coluna mostra 🥇🥈🥉 com nome e valor formatado
4. Se não houver dados, exibe "Sem dados no mês" centralizado
5. O slide seguinte é "Turbo Commerce" (SlideTurboMetrics)
6. O total de slides aumentou em 1 (agora tem Top Operadores a mais)

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/RelatorioMensal.tsx
git commit -m "feat(top-operadores): slide pódio de operadores no reporte mensal (índice 15)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
