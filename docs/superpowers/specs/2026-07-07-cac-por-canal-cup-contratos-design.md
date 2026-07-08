# CAC por canal — contar contratos por `cup_contratos` (não Bitrix)

Data: 2026-07-07
Rota: `/gestao/receita` → aba Macro → seção "CAC por canal"

## Problema

A tela tem duas contagens de "contratos" de fontes diferentes que não batem:

- **Card "CAC — custo de aquisição"** (topo): `137 contratos novos` vem do **ClickUp**
  `cup_contratos` (por `data_criado`; MRR + pontual dedup por jornada).
- **Seção "CAC por canal"** (toggle "por contrato"): `104 contratos` vem do **Bitrix**
  `crm_deal.servicos_vendidos` (1 serviço vendido = 1 contrato).

Ambos os números estão corretos, mas medem coisas diferentes (fonte, data, régua). O
pedido: **unificar** — a seção CAC por canal deve contar contratos pela mesma
fonte/régua do card, ou seja, `cup_contratos`.

## Decisão

Manter os **deals ganhos do Bitrix como espinha dorsal** da seção (eles carregam o
canal via `source` e a contagem de **clientes** = 1 por deal, que **não muda**). Trocar
apenas a contagem de **contratos**: passa a vir do `cup_contratos`, atribuído ao canal
via CNPJ do deal do mês.

### Régua de contagem de contratos (idêntica ao card 137)

- MRR: linhas de `cup_contratos` com `valorr > 0` (cada linha = 1 contrato).
- Pontual: dedup por jornada — `id_task` p/ produto `Creators`, `id_subtask` p/ os demais.
- Filtro: `data_criado ∈ [dIni, dFim)` e `LOWER(TRIM(status)) <> 'não usar'`.

### Mapa contrato → canal

- Elo: `cup_contratos.id_task → cup_clientes.task_id → cup_clientes.cnpj → crm_deal.cnpj`.
- CNPJ normalizado: `regexp_replace(cnpj, '\D', '', 'g')`, exigindo `LENGTH >= 11`.
- `canal(cnpj)` = canal do **deal ganho mais recente do período** para aquele CNPJ
  (desempate; afeta só 1 CNPJ em junho/2026). `data_fechamento` é `date` → compara string.
- Contrato cujo cliente **não teve deal ganho no período** fica **fora da seção**
  (é a consequência aceita da abordagem "via deal do mês").

## Resultado esperado (junho/2026)

| | Antes | Depois |
|---|---|---|
| Clientes (total) | 79 | 79 (inalterado) |
| Contratos (total) | 104 (Bitrix) | **110** (ClickUp, só clientes com deal no mês) |

Por canal (contratos): Inbound 59, Expansão 24, Recomendação 9, Evento 6, Outbound 6,
Reativação 3, Indique 3, Social Selling 0.

### Invariante que muda

O piso "1 contrato por deal" (Bitrix) garantia `contratos ≥ clientes` → `CAC/contrato ≤
CAC/cliente`. Com `cup_contratos` esse piso **some**: um canal pode ter clientes (deal
ganho) mas 0 contratos criados no ClickUp no mês (lag de onboarding). Ex.: Social
Selling em junho (1 cliente, 0 contratos) → `cacContrato = null` → UI mostra "—".
Comportamento já suportado (`contratos > 0 ? … : null`). Semanticamente correto: reflete
que nem toda venda virou contrato operacional no mesmo mês.

## Implementação

Só backend, 1 arquivo: `server/routes/gestaoReceita.cacCanais.ts`.

1. `computeCacCanais`: adiciona query aos `cup_contratos` (por CNPJ+mês, régua do card),
   traz `cnpj`/`data_fechamento` na query de deals, monta `canalPorCnpj` (desempate) e
   `contratosCanalMes` (canalId → mês → nº contratos).
2. `agregarCacCanais`: novo parâmetro final opcional `contratosCanalMes`. Contratos por
   canal passam a vir desse map (não mais de `d.contratos`). Clientes inalterados.
   `DealsSourceMes` perde o campo `contratos`.
3. Remove `contratosDoDeal` e os imports `parseServicosVendidos`/`contarServicosPorSegmento`
   (só usados nesta seção; o BP tem cópia própria da régua).
4. Frontend: **sem mudanças** — o payload (`geral.contratos`, `c.contratos`, `cacContrato`)
   mantém a mesma forma.

## Testes

`server/routes/gestaoReceita.cacCanais.test.ts`:
- Atualiza os 2 testes de contrato para a nova assinatura (contratos via `contratosCanalMes`).
- Novo teste: canal com clientes>0 e contratos=0 → `cacContrato = null`, `cacCliente` definido.
- Novo teste: `contratosCanalMes` soma multi-mês.
- Remove o `describe("contratosDoDeal")`.
