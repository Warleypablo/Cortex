---
date: 2026-05-08
topic: CrossSell Dashboard — redesign visual e otimização
status: aprovado pelo usuário (aguardando review do spec escrito)
---

# CrossSell Dashboard — Redesign

## Contexto

O dashboard atual (`client/src/pages/CrossSellDashboard.tsx`) tem **9 KPIs lado a lado** sem hierarquia visual, **2 charts genéricos** (funil em barra horizontal + reuniões por CX, este último redundante com o ranking de reuniões) e **2 rankings em cards cinzas chapados**. Faltam tendência (delta vs mês anterior), cara de funil de verdade, agrupamento semântico das métricas e respiro visual.

O backend já existe em `server/routes/crosssell.ts` (`GET /api/comercial/crosssell/dashboard`) — calcula os 9 KPIs + dados de funil/CX/rankings. Será expandido para retornar valores do mês corrente E anterior + a lista de top clientes.

## Objetivo

Redesenhar o dashboard com **direção executiva (1 KPI hero + 4 secundários)**, charts mais úteis (funil real + top clientes em negociação) e rankings com **pódio**. Adicionar **delta vs mês anterior** em cada KPI.

## Escopo

**No escopo:**
- Redesenho da página `CrossSellDashboard.tsx` (mantém o arquivo, mas reescreve a estrutura interna).
- Backend: estender o endpoint dashboard para retornar (a) valores do mês anterior para todos os KPIs visíveis, (b) lista top 5 clientes em negociação (CNPJ, nome, valor R, etapa).
- Remoção definitiva dos KPIs **Taxa Aceitação**, **Reuniões Realizadas**, **Sugestões Ativas**, **Clientes em Negociação** da UI (backend pode continuar calculando — não custa nada — mas frontend não consome).
- Remoção do chart **"Reuniões por CX"** (redundante com ranking).
- Funil visual com taxa de conversão entre etapas.
- Pódio nos rankings (1º maior no centro com borda dourada).
- Suporte dark/light mode (obrigatório).

**Fora do escopo:**
- Sparklines com histórico de 6 meses (postergado para v2).
- Filtros adicionais (por CX, por cluster, por produto).
- Drill-down clicável em cards/charts.
- Esquemas de cores totalmente novos — usaremos a paleta indigo/purple/blue já presente.

## Decisões aprovadas

| Item | Decisão |
|------|---------|
| Direção visual | **A · Executivo / Hero** (1 KPI gigante com gradiente + 4 secundários) |
| KPI hero | **Total Negociação R** |
| KPIs secundários (4) | Total Negociação P, Reuniões Agendadas, Taxa Conversão, Cobertura |
| KPIs removidos da UI | Taxa Aceitação, Reuniões Realizadas, Sugestões Ativas, Clientes em Negociação |
| Tendência | **Delta vs mês anterior** (`↑X% vs abr` ou `↓Xpp vs abr` para taxas) |
| Chart 1 | Funil de conversão visual (barras estreitando + % conversão entre etapas) |
| Chart 2 | Top 5 Clientes em Negociação (lista com etapa + valor R) — substitui "Reuniões por CX" |
| Rankings | Pódio (1º maior centralizado com borda dourada, 4º+ em lista compacta) |
| Agrupamento | 2 seções: **Pipeline** (funil + top clientes) e **Performance da Equipe** (rankings) |

## Arquitetura

### 1. Backend — `server/routes/crosssell.ts`

#### 1.1 Estender `GET /api/comercial/crosssell/dashboard`

A query atual já calcula os KPIs do mês selecionado. Vamos adicionar:

**(a)** Calcular os mesmos KPIs para o **mês anterior** ao filtro recebido:
- Se `mes=5, ano=2026`: mês anterior é `mes=4, ano=2026`.
- Se `mes=1, ano=2026`: mês anterior é `mes=12, ano=2025`.

Implementação: dentro do mesmo handler, após determinar o `(mes, ano)` de filtro, computar `(mesPrev, anoPrev)` e disparar a mesma query KPIs em paralelo (executar 2 vezes via Promise.all).

**(b)** Adicionar query de **top 5 clientes em negociação**:

```sql
SELECT
  o.cnpj,
  c.nome AS cliente_nome,
  o.etapa,
  o.valor_r_negociacao,
  o.id AS oportunidade_id
FROM cortex_core.crosssell_oportunidades o
LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
WHERE o.etapa NOT IN ('ganho', 'descartado', 'sugerido_sistema')
  AND o.valor_r_negociacao IS NOT NULL
  AND o.valor_r_negociacao > 0
ORDER BY o.valor_r_negociacao DESC NULLS LAST
LIMIT 5
```

#### 1.2 Schema da resposta

A resposta JSON ganha 2 novas chaves:

```ts
{
  kpis: { /* mesmos campos atuais — apenas os 5 visíveis serão consumidos */ },
  kpisAnterior: {
    totalRNegociacao: number;
    totalPNegociacao: number;
    reunioesAgendadas: number;
    taxaConversao: number;
    coberturaBase: number;
  },
  topClientes: Array<{
    cnpj: string;
    clienteNome: string | null;
    etapa: string;
    valorR: number;
    oportunidadeId: number;
  }>,
  funilEtapas: [/* mantém */],
  rankingValor: [/* mantém */],
  rankingReunioes: [/* mantém */],
  // reunioesPorCx: pode permanecer no payload — frontend simplesmente não usa
}
```

> **Nota de compatibilidade:** o payload é aditivo — não removemos chaves existentes para evitar quebrar consumidores. Apenas o frontend deixa de renderizar o que não precisa.

#### 1.3 Cobertura — uso de KPI atemporal

A query atual de `cobertura_base` não usa filtro de mês (é stateful em relação ao banco inteiro). Para comparação mensal, precisamos de um snapshot histórico — **fora do escopo**. Solução pragmática: o **delta de cobertura é sempre `0pp`** (ou omitir o delta neste KPI). Documentar no spec e UI: tooltip explicando que cobertura é "valor atual, sem comparação histórica".

### 2. Frontend — `client/src/pages/CrossSellDashboard.tsx`

#### 2.1 Estrutura de componentes (mesmo arquivo)

```
CrossSellDashboard (default export)
├── HeroKpi               (gradiente, valor grande)
├── SecondaryKpiCard      (4×, com delta)
├── ConversionFunnel      (chart custom — não Recharts)
├── TopClientesList       (lista valor)
├── PodiumRanking         (3 pódios + lista compacta)
└── EmptyState            (existente, reusar)
```

Componentes inline no mesmo arquivo (segue padrão do `CrossSellPipeline.tsx`). Se algum ficar > 80 linhas, considera-se extrair, mas não é obrigatório.

#### 2.2 Tipos

```ts
interface DashboardData {
  kpis: {
    reunioesAgendadas: number;
    reunioesRealizadas: number;        // payload aditivo, não usado
    totalRNegociacao: number;
    totalPNegociacao: number;
    taxaConversao: number;
    sugestoesAtivas: number;            // payload aditivo, não usado
    taxaAceitacao: number;              // payload aditivo, não usado
    clientesEmNegociacao: number;       // payload aditivo, não usado
    coberturaBase: number;
  };
  kpisAnterior: {
    totalRNegociacao: number;
    totalPNegociacao: number;
    reunioesAgendadas: number;
    taxaConversao: number;
    coberturaBase: number;
  };
  topClientes: Array<{
    cnpj: string;
    clienteNome: string | null;
    etapa: string;
    valorR: number;
    oportunidadeId: number;
  }>;
  funilEtapas: Array<{ etapa: string; total: number }>;
  rankingValor: Array<{ cxResponsavel: string; totalR: number; totalP: number; totalDeals: number }>;
  rankingReunioes: Array<{ cxResponsavel: string; totalReunioes: number }>;
}
```

#### 2.3 Helper `formatDelta`

```ts
function formatDelta(curr: number, prev: number, type: "currency" | "count" | "percent"): {
  text: string;
  direction: "up" | "down" | "flat";
} {
  if (prev === 0) {
    return { text: curr > 0 ? "novo" : "—", direction: curr > 0 ? "up" : "flat" };
  }
  const diff = curr - prev;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  if (type === "percent") {
    // diferença em pontos percentuais
    const pp = Math.abs(diff).toFixed(1);
    return { text: `${diff >= 0 ? "↑" : "↓"} ${pp}pp vs mês ant.`, direction };
  }
  // currency e count: variação relativa em %
  const pct = Math.abs((diff / prev) * 100).toFixed(0);
  return { text: `${diff >= 0 ? "↑" : "↓"} ${pct}% vs mês ant.`, direction };
}
```

Usa "vs mês ant." (curto e neutro) em vez de "vs abr"/"vs mai" — evita lógica de tradução de mês.

#### 2.4 Componente `HeroKpi`

```tsx
<div className="rounded-2xl p-6 text-white relative overflow-hidden
                bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-500
                dark:from-indigo-700 dark:via-purple-700 dark:to-purple-600">
  <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full
                  bg-white/15 blur-3xl pointer-events-none" />
  <p className="text-xs font-semibold tracking-widest text-white/85">
    PIPELINE EM NEGOCIAÇÃO · RECORRENTE
  </p>
  <p className="text-4xl font-extrabold mt-1.5 leading-tight">
    {formatCurrency(value)}
  </p>
  <span className="inline-flex items-center gap-1 mt-1 px-3 py-1 rounded-full
                   bg-white/20 text-emerald-50 text-xs font-semibold">
    {delta.text}
  </span>
</div>
```

#### 2.5 Componente `SecondaryKpiCard`

Card branco/zinc com:
- Label uppercase pequena.
- Valor grande (text-2xl).
- Delta colorido (verde/vermelho/cinza).

```tsx
<div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700
                rounded-xl p-4">
  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
    {label}
  </p>
  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
    {value}
  </p>
  <p className={`text-xs font-semibold mt-1 ${
    delta.direction === "up" ? "text-green-600 dark:text-green-400" :
    delta.direction === "down" ? "text-red-600 dark:text-red-400" :
    "text-gray-400 dark:text-zinc-500"
  }`}>
    {delta.text}
  </p>
</div>
```

#### 2.6 Componente `ConversionFunnel`

Chart **custom em divs** (não Recharts) — barras estreitando proporcionalmente ao volume relativo ao topo. Cada linha mostra:
- Nome da etapa (esquerda, fixo 110px).
- Barra colorida proporcional (largura = `total/maxTotal * 100%`).
- % de conversão da etapa anterior em superscript discreto sobre a barra (`↓ 41%`).
- Contagem absoluta à direita.

A ordem das etapas segue o pipeline natural:
```
sugerido_sistema → fazer_contato → tentativa_contato → em_contato →
reuniao_agendada → proposta_enviada → forte_interesse → ganho
```

`descartado` é **omitido** do funil (ramo lateral, não conversão).

Cores: as mesmas que já existem em `ETAPA_COLORS`.

#### 2.7 Componente `TopClientesList`

Lista vertical (até 5 itens). Cada linha:
- Badge da etapa (esquerda, pequena, com a cor de `ETAPA_COLORS`).
- Nome do cliente (centro, truncado).
- Valor R formatado (direita, em destaque).
- Background com gradient de `bg-indigo-50 X% → transparent` onde X = `valorR / maxValorR * 100`.

Click no item navega para `/comercial/crosssell` filtrando pela oportunidade (escopo: por enquanto **sem clique** — apenas leitura. Drill-down fica para v2).

#### 2.8 Componente `PodiumRanking`

Estrutura:
- 3 pódios em grid 1fr/1.2fr/1fr (2º à esquerda, 1º central maior, 3º à direita).
- 1º com borda amarela (`border-amber-300`) e sombra externa amarela.
- Lista compacta abaixo para **4º a 7º** (até 4 linhas adicionais; corta em 7º).
- Suporta 2 variantes via prop `metric`:
  - `"valor"`: mostra `R formatado` (e tooltip com R+P+deals)
  - `"reunioes"`: mostra `N reuniões`

```tsx
<PodiumRanking title="Valor Gerado" data={data.rankingValor} metric="valor" />
<PodiumRanking title="Reuniões Agendadas" data={data.rankingReunioes} metric="reunioes" />
```

Se houver < 3 pessoas, omite os pódios vazios e cai para lista plana.

#### 2.9 Layout final

```
┌─ Filtros (mês/ano) ─────────────────────────────────┐
├─ HeroKpi (gradient, R$ 487k) ──────────────────────┤
├─ SecondaryKpiCard × 4 (Total P / Reuniões / Conv / Cob) ┤
│
│  Pipeline (heading)
├─ ConversionFunnel ────────┬─ TopClientesList ──────┤
│                           │                         │
│  Performance da Equipe (heading)
├─ PodiumRanking (Valor)  ──┬─ PodiumRanking (Reuniões) ┤
└─────────────────────────────────────────────────────┘
```

Grid: `lg:grid-cols-2` para os pares; `grid-cols-1 md:grid-cols-4` para os secundários (em telas pequenas vira 2 cols).

### 3. Estados de carregamento e vazio

- **Loading**: Skeletons preservando estrutura (hero, 4 secs, 2 charts, 2 rankings).
- **Vazio (sem dados no período)**: cada componente mostra `<EmptyState>` próprio.
- **Erro de rede**: já há `useQuery` — mostra estado de erro inline (mensagem simples).

### 4. Dark/light mode

Todos os componentes usam classes `dark:` Tailwind. Hero gradient suaviza um pouco no dark (`dark:from-indigo-700` etc).

## Plano de testes manuais

1. Abrir `/comercial/crosssell/dashboard` (ou caminho equivalente).
2. Verificar hero exibido com valor R + delta.
3. Verificar 4 secundários com seus deltas (sinal + cor corretos).
4. Funil: ordem das etapas correta, % conversão entre cada etapa, descartado **não** aparece.
5. Top 5 clientes: ordenado por valor R desc, etapas com cores corretas.
6. Pódio: 1º central maior, 4º+ em lista compacta.
7. Trocar filtro de mês para `Janeiro 2026` → confirmar que delta compara com `Dezembro 2025` (cross-year).
8. Trocar para mês sem dados → todos componentes mostram EmptyState ou skeletons resolvidos.
9. Alternar dark mode → cores corretas em todos os elementos (especialmente hero gradient).
10. Resize para mobile (< 768px) → KPIs secundários em 2 cols, charts empilhados.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| 2 queries KPIs (mês atual + anterior) dobra carga | KPIs são leves; queries em paralelo via Promise.all. Se virar gargalo, cachear 5min. |
| Cobertura sem comparação histórica gera UX inconsistente | Mostrar tooltip explicativo + delta `—`. Alternativa: snapshot diário para próxima v. |
| Funil custom em divs pode não comportar 8 etapas em mobile | Em viewport < 640px, mostrar lista vertical compacta sem barras (graceful degradation). |
| Top clientes pode expor dados sensíveis | Já está dentro de área autenticada — sem mudança de permissão. |

## Referências

- Página atual: `client/src/pages/CrossSellPipeline.tsx` (padrão de inline components)
- Backend: `server/routes/crosssell.ts:466` (handler dashboard)
- Mockup aprovado: `.superpowers/brainstorm/87536-1778267689/content/full-dashboard.html`
- Tabelas: `cortex_core.crosssell_oportunidades`, `cortex_core.crosssell_negocios_ganhos`, `"Clickup".cup_clientes`
