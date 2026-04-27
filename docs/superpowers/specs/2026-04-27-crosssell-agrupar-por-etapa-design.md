# Design Spec — CrossSell agrupado por etapa (accordion)

**Data:** 2026-04-27
**Status:** Aprovado
**Tipo:** Refatoração de apresentação (sem mudança de schema, sem mudança de backend)
**Predecessor:** `docs/superpowers/specs/2026-04-27-crosssell-cliente-view-design.md`

---

## 1. Problema

A grid plana de cards-por-cliente entregue na refatoração anterior agrupa tudo num único bloco. O CX precisa rolar a página inteira para identificar visualmente "o que está em proposta enviada" ou "o que está em reunião agendada". Falta a estrutura de Kanban que torna a operação por etapa imediata.

## 2. Mudança proposta

A grid plana é substituída por um accordion vertical onde cada **etapa** é uma seção colapsável. Dentro de cada seção, os cards de cliente aparecem em grid (1/2/3 colunas conforme largura), mostrando **apenas** as oportunidades daquele cliente que estão naquela etapa.

Cliente que tem oportunidades em 3 etapas diferentes aparece em 3 seções, cada vez focado na oportunidade da seção correspondente. O cabeçalho do card (CX, cluster, status, lifetime, valores) e os chips de serviços ativos ficam idênticos em todas as ocorrências — só o bloco "Oportunidades mapeadas" muda de conteúdo por seção.

## 3. Decisões de design

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Como cliente em múltiplas etapas é exibido | Card duplicado em cada seção, com oportunidades filtradas pela etapa daquela seção | Preserva semântica de Kanban e a visão de cliente; cada seção continua sendo um foco de trabalho |
| Backend | Sem mudança | Agrupamento por etapa é puro frontend; o endpoint atual já retorna `oportunidades[]` por cliente |
| Toggle "grid plana" vs "agrupado" | Sem toggle — agrupado vira o default único | YAGNI; se sentir falta, adiciona depois |
| Etapas sem cards | Seção escondida | Reduz ruído visual |
| Etapas expandidas no carregamento | 3 primeiras etapas que tiverem cards; `sugerido_sistema` e `descartado` começam colapsadas | Sugerido pode ter centenas de cards; descartado é histórico |
| Cabeçalho da seção | Badge da etapa (mesma cor de hoje) + contagem de cards + chevron de colapsar + botão `+` | `+` abre o dialog de Nova Oportunidade pré-preenchido com a etapa |
| Sort dropdown | Aplica dentro de cada seção | Sort global perde sentido quando há grupos |
| Filtros | Aplicam em todas as seções (sem mudança) | Comportamento já correto para visão agrupada |

## 4. Estrutura visual

```
[Filtros: Cluster · CX · Etapa · Produto] [Ordenar por ▾]   [✨ Mapear] [+ Nova]

X clientes únicos · Y oportunidades · R$ Z em negociação

▾ FAZER CONTATO  (5)                                                 [+]
   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────
   │ Cliente A           │ │ Cliente B           │ │ Cliente C
   │ 👤 João · Imp · ⏱  │ │ ...                 │ │ ...
   │ R: 18,5k · P: 42k  │ │                     │ │
   │ ──────────          │ │                     │ │
   │ Serviços ativos:    │ │                     │ │
   │ [Performance] [SM]  │ │                     │ │
   │ ──────────          │ │                     │ │
   │ 🟢 SEO  [Fazer C ▾] │ │                     │ │
   │     R$ 4k 💬2 🏆   │ │                     │ │
   └────────────────────┘ └────────────────────┘ └────────────────

▾ TENTATIVA DE CONTATO  (3)                                          [+]
   [card] [card] [card]

▸ REUNIÃO AGENDADA  (12)                                             [+]
   (colapsado)

▸ SUGERIDO  (108)                                                    [+]
   (colapsado por default)

▸ DESCARTADO  (24)                                                   [+]
   (colapsado por default)
```

## 5. Arquitetura frontend

### 5.1 Novos componentes (mesmo arquivo `CrossSellPipeline.tsx`)

**`EtapaSection`** — cabeçalho colapsável + grid interno de cards.

```typescript
function EtapaSection({
  etapa,
  clientes,                  // ClienteCrossSell[] já agrupados pra essa etapa
  expanded,
  onToggle,
  onNewOpForEtapa,           // abre NewOpDialog pré-preenchido
  onChangeEtapa,
  onGanho,
  onComments,
}: {
  etapa: Etapa;
  clientes: ClienteCrossSell[];
  expanded: boolean;
  onToggle: () => void;
  onNewOpForEtapa: (etapa: Etapa) => void;
  onChangeEtapa: (opId: number, etapa: string) => void;
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) { ... }
```

**`ClienteCard`** — ganha prop opcional `oportunidadesFiltradas?: Oportunidade[]`. Se passada, renderiza só essas no bloco "Oportunidades mapeadas". Se omitida, renderiza todas (compatibilidade futura).

### 5.2 Função de agrupamento

```typescript
function groupClientesByEtapa(
  clientes: ClienteCrossSell[]
): Map<Etapa, Array<{ cliente: ClienteCrossSell; oportunidades: Oportunidade[] }>> {
  const groups = new Map<Etapa, Array<{ cliente: ClienteCrossSell; oportunidades: Oportunidade[] }>>();
  for (const cliente of clientes) {
    const byEtapa = new Map<Etapa, Oportunidade[]>();
    for (const op of cliente.oportunidades) {
      const e = op.etapa as Etapa;
      if (!byEtapa.has(e)) byEtapa.set(e, []);
      byEtapa.get(e)!.push(op);
    }
    for (const [e, ops] of byEtapa) {
      if (!groups.has(e)) groups.set(e, []);
      groups.get(e)!.push({ cliente, oportunidades: ops });
    }
  }
  return groups;
}
```

A ordenação (`useMemo` `sorted`) passa a operar **dentro de cada seção**. O sort global existente é aplicado nos clientes de cada seção.

### 5.3 Estado novo no componente principal

```typescript
const [etapasExpandidas, setEtapasExpandidas] = useState<Set<Etapa>>(() => {
  // Default: primeiras 3 etapas que tiverem cards, exceto sugerido_sistema e descartado
  // Calculado uma vez no mount via useEffect quando dados carregam
  return new Set();
});
```

Inicialização (`useEffect` quando `clientes` mudam pela primeira vez): identifica as primeiras 3 etapas em `ETAPAS` (ordem fixa) que têm ≥1 cliente, excluindo `sugerido_sistema` e `descartado`, e marca como expandidas. `sugerido_sistema` e `descartado` ficam colapsados independentemente da contagem.

### 5.4 NewOpDialog

Ganha prop opcional `etapaInicial?: Etapa`. Se passada, sobrescreve o default `'fazer_contato'` no momento da criação. Endpoint backend não muda — o `cx` continua mandando `etapa` no payload se necessário (já é, indiretamente, pois o backend usa default `'fazer_contato'`; vamos passar a etapa explícita quando vem do botão `+` da seção).

**Backend `POST /api/comercial/crosssell`** já aceita campos opcionais — adicionamos suporte para receber `etapa` no body (default `fazer_contato` se não vier). Mudança mínima de 1 linha.

## 6. Arquivos impactados

### Modificar
| Arquivo | Mudança |
|---------|---------|
| `client/src/pages/CrossSellPipeline.tsx` | Novo `EtapaSection`, `groupClientesByEtapa`, estado `etapasExpandidas`. `ClienteCard` ganha prop `oportunidadesFiltradas?`. `NewOpDialog` ganha prop `etapaInicial?`. Componente principal renderiza accordion em vez de grid plana. |
| `server/routes/crosssell.ts` | `POST /api/comercial/crosssell` aceita `etapa` opcional no body (default `fazer_contato`). |

### Não tocar
- Schema do banco
- Demais endpoints
- `CrossSellDashboard.tsx`
- `server/services/crosssell-scoring.ts`

## 7. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Cliente com 5 oportunidades em 5 etapas vira 5 cards visíveis simultaneamente | É comportamento esperado e desejado — cada card representa um foco de trabalho diferente. Tipicamente são 1-2 etapas por cliente. |
| Seção `sugerido_sistema` com 100+ cards pode lentar render | Default colapsada; quando expandida, virtualização não é necessária no volume atual (~108) mas se crescer muito, considerar `react-window`. |
| Estado `etapasExpandidas` se reseta quando filtros mudam | OK no v1 — UX padrão de Kanban; revisitar se reclamação. |
| Botão `+` na seção pré-preenche etapa, mas usuário pode esquecer e ficar confuso | Mostrar etapa pré-selecionada destacada no dialog ("Esta oportunidade será criada em: Reunião Agendada"). |

## 8. Stack técnica

Sem mudança em relação ao predecessor — React + TypeScript + Tailwind + React Query, componentes de `@/components/ui/`, Drizzle no backend.
