# Mini DFC de CAC — Design Spec

## Objetivo

Criar uma página `/growth/dfc-cac` dentro do grupo Growth que consolida custos de aquisição (DRE) e receita vendida (Bitrix) em uma mini DFC mensal, permitindo que gerentes de Growth e Comercial entendam o custo e retorno que estão gerando.

---

## Fontes de Dados

### Custos de Aquisição
**Tabela:** `"Conta Azul".caz_parcelas`  
**Filtro:** `tipo_evento = 'DESPESA' AND status = 'QUITADO'`  
**Categorias incluídas** (via `categoria_nome` com split por `;`):

| Código | Nome |
|--------|------|
| 06.04.01 | Gestor Comercial |
| 06.04.02 | Inside Sales |
| 06.04.03 | Pré-Vendas |
| 06.04.04 | Comissão Comercial |
| 06.04.05 | Indique e Ganhe |
| 06.06.01 | Despesas com Anúncios |
| 06.06.02 | Growth Interno |
| 06.07.01 | Eventos |
| 06.07.02 | Brindes |
| 06.07.03 | Patrocínios e Associações |

**Agrupamento:** `date_trunc('month', data_pagamento_previsto)` e categoria  
**Campo de valor:** `valor_liquido`

### Receita Vendida
**Tabela:** `"Bitrix".crm_deal`  
**Filtro:** `stage_name = 'Negócio Ganho'`  
**Campos:** `valor_recorrente` (MRR), `valor_pontual`  
**Agrupamento:** `date_trunc('month', data_fechamento)` — também conta `COUNT(*)` para número de contratos

---

## Endpoint

`GET /api/growth/dfc-cac?meses=6`

**Parâmetro:** `meses` (inteiro 1–24, default 6) — quantos meses para trás incluir (excluindo mês corrente).

**Resposta:**
```typescript
{
  meses: string[];                          // ["2025-12", "2026-01", ...]
  receita: {
    recorrente: Record<string, number>;     // mes → valor
    pontual: Record<string, number>;
    total: Record<string, number>;
    contratos: Record<string, number>;      // mes → nº contratos fechados
  };
  custos: {
    grupos: {
      grupo: string;                        // "06.04 Equipe Comercial"
      prefixo: string;                      // "06.04"
      linhas: {
        categoria: string;                  // "06.04.01 Gestor Comercial"
        valores: Record<string, number>;    // mes → valor
      }[];
      subtotais: Record<string, number>;    // mes → soma do grupo
    }[];
    total: Record<string, number>;          // mes → custo total
  };
  metricas: {
    cac: Record<string, number | null>;             // custo / contratos
    ticketMedioRec: Record<string, number | null>;  // mrr / contratos
    payback: Record<string, number | null>;         // cac / ticket (meses)
    roi: Record<string, number | null>;             // (receita-custo)/custo*100
  };
  resumo: {                                // último mês completo
    cac: number | null;
    ticketMedioRec: number | null;
    payback: number | null;
    roi: number | null;
  };
}
```

---

## Página: `/growth/dfc-cac`

**Arquivo:** `client/src/pages/GrowthDfcCac.tsx`

### Cards de Resumo (topo)

4 cards referentes ao **último mês completo** da série:

| Card | Fórmula | Formato |
|------|---------|---------|
| CAC | custo total ÷ nº contratos | R$ X.XXX |
| Ticket Médio Rec. | MRR vendido ÷ nº contratos | R$ X.XXX |
| Payback | CAC ÷ ticket médio recorrente | X,X meses |
| ROI de Aquisição | (receita total − custo) ÷ custo × 100 | XXX% |

### Tabela DFC Mensal

Estrutura de linhas (grupos expansíveis):

```
SEÇÃO             LINHA                    ESTILO
──────────────────────────────────────────────────────
RECEITA VENDIDA   (header de seção)        fundo sutil
  —               MRR Recorrente           normal
  —               Pontual                  normal
  —               → Total Receita          bold, verde
CUSTO DE AQUISIÇÃO (header de seção)       fundo sutil
  06.04           Equipe Comercial         expansível
    —             Gestor Comercial         recuado
    —             Inside Sales             recuado
    —             Pré-Vendas               recuado
    —             Comissão Comercial       recuado
    —             Indique e Ganhe          recuado
    —             → Subtotal 06.04         bold
  06.06           Growth                   expansível
    —             Despesas com Anúncios    recuado
    —             Growth Interno           recuado
    —             → Subtotal 06.06         bold
  06.07           Eventos/Marketing        expansível
    —             Eventos                  recuado
    —             Brindes                  recuado
    —             Patrocínios e Assoc.     recuado
    —             → Subtotal 06.07         bold
  —               → Total Custo            bold, vermelho
RESULTADO         (header de seção)        fundo sutil
  —               Resultado Líquido        bold, colorido (verde/vermelho)
  —               CAC                      R$
  —               Payback                  meses
  —               ROI                      %
```

**Comportamento:** grupos de custo (06.04, 06.06, 06.07) começam expandidos. Clique no nome do grupo colapsa/expande as sublinhas.

**Valores nulos:** exibir "—" quando não há lançamento no mês.

**Dark/light mode:** suporte completo via classes Tailwind `dark:`.

---

## Registro

| Arquivo | Mudança |
|---------|---------|
| `server/routes/growthDfcCac.ts` | Criar — endpoint `/api/growth/dfc-cac` |
| `server/routes.ts` | Importar e registrar `registerGrowthDfcCacRoutes` |
| `client/src/pages/GrowthDfcCac.tsx` | Criar — página completa |
| `shared/nav-config.ts` | Adicionar item "DFC de CAC" no grupo Growth |
| `client/src/App.tsx` | Adicionar rota `/growth/dfc-cac` |

---

## Testes

- `server/routes/growthDfcCac.test.ts` — testa o endpoint com mock de DB:
  - Retorna estrutura correta com meses, receita, custos e métricas
  - Calcula CAC, payback e ROI corretamente
  - Retorna `null` quando divisor é zero (ex: mês sem contratos)
  - Retorna 500 em erro de banco
