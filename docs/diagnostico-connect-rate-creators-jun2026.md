# Diagnóstico — Queda de Connect Rate e Tx Conversão (Creators, Meta Ads) — Junho/2026

> Investigação conduzida em 08/06/2026. Dados: `meta_ads.*` (GCP), GA4 (Linktree property),
> e Graph API da Meta (`ACCESS_TOKEN_META_SYSTEM`) para os destinos reais dos anúncios.

## TL;DR

Eram **dois problemas distintos**, com causas diferentes:

1. **Connect Rate caindo (Jun)** → **landing page errada + pixel quebrado**, NÃO performance real.
   Parte dos criativos de Creators aponta para uma LP secundária no **Webflow**
   (`lp.turbopartners.com.br/commerce/creators-lp`) cujo evento *LandingPageView* do pixel
   Meta despencou (76% → **29%** de connect rate em junho). Como os **leads se mantiveram
   (~30/dia)**, é majoritariamente **medição**, não perda de negócio — mas a LP precisa ser
   corrigida/redirecionada.

2. **Tx Conversão da Página caindo (Mar→Jun, 14,6% → 9,3%)** → **retornos decrescentes ao
   escalar**. Investimento +50% (R$67k→R$101k) com **leads travados em ~940/mês** e
   **CPL +49%** (R$72→R$107). Saturação de público — problema real de mídia, separado do item 1.

## Destino correto (canônico)

**`pages.turbopartners.com.br/creators`** (atrás de Cloudflare). Todo tráfego de Creators
deveria ir para cá.

## Evidências

### Connect Rate por mês (Creators) — pixel = LPV ÷ cliques de saída
| | Mar | Abr | Mai | Jun |
|---|---|---|---|---|
| Connect Rate | 77% | 82% | 81% | **72%** |

Não é tendência — é um **degrau a partir de 02/jun** (01/jun ainda 79%; 02–06/jun ~63–65%).

### Origem da queda — concentrada por destino (Graph API, Mai vs Jun 2–6)
| Destino | Plataforma | Mai CR | Jun CR | Spend Jun |
|---|---|---|---|---|
| `pages.turbopartners.com.br/creators/` | Cloudflare | 81% | 70% | R$13.567 |
| `lp.turbopartners.com.br/commerce/creators-lp` | **Webflow** | 76% | **29%** | R$1.632 |

- A LP secundária (Webflow) **colapsou 47pp** — é a leva de criativos `Bready_lab_UGC_Ichino`.
- A LP principal (`pages/creators`) também **amoleceu 11pp** (81→70); como carrega ~85% do
  tráfego, contribui tanto quanto a Webflow para a queda absoluta. Verificar pixel nela também.

### Confirmação de que é medição (não negócio)
- GA4 **sessões ÷ cliques de saída ≈ 100%** em junho → as pessoas **chegam** na página.
- Pixel Meta **LPV ÷ cliques = 72%** → o evento *LandingPageView* **sub-dispara**.
- **Leads não caíram**: ~29 leads/dia em junho vs ~30/dia em maio.

### Tx Conversão da Página — decomposição (Leads ÷ LPV)
| | Mar | Abr | Mai |
|---|---|---|---|
| Investimento | R$67k | R$81k | R$101k (+50%) |
| LPV (tráfego LP) | 6.390 | 6.941 | 7.628 (+19%) |
| **Leads** | 930 | 935 | **945 (+1,6% — travado)** |
| CPL | R$72 | R$87 | R$107 (+49%) |

Leads não acompanham o gasto → conversão página→lead cai. Saturação / retorno decrescente.

## Outras anomalias encontradas (varredura da conta inteira, Mai 1 – Jun 8)

| Connect Rate | Spend | Ads | Destino | Observação |
|---|---|---|---|---|
| 80% | R$104k | 81 | `pages.turbopartners.com.br/creators` | ✅ canônico |
| 85% | R$12,3k | 11 | `pages.turbopartners.com.br/ecommerce` | ✅ outro produto |
| 64% | R$8,1k | 11 | `lp.turbopartners.com.br/commerce/creators-lp` | ⚠️ **LP errada (Webflow) — corrigir** |
| 86% | R$657 | 1 | `tiktok-turbopartners.lovable.app` | ⚠️ 3ª plataforma de LP (Lovable) |
| 60% | R$590 | 1 | `www.turbopartners.com.br` | ⚠️ **ad mandando tráfego pago pro site institucional** |
| 84% | R$1,5k | 1 | (sem destino parseável) | ⚠️ checar (lead form / instant experience?) |

**Estrutural:** LPs de Creators (e da conta) estão **fragmentadas em 3 plataformas** —
Cloudflare (`pages.*`), Webflow (`lp.*`) e Lovable (`*.lovable.app`) — com confiabilidade de
pixel inconsistente. Consolidar num único padrão (`pages.turbopartners.com.br/...`) é o
conserto de fundo.

## Plano de ação

1. **Imediato — parar o sangramento:** editar no Meta Ads Manager o destino dos **11 anúncios**
   que apontam para `lp.turbopartners.com.br/commerce/creators-lp` → `pages.turbopartners.com.br/creators`.
2. **Redirect permanente (rede de segurança):** 301 de `lp.turbopartners.com.br/commerce/creators-lp`
   → `https://pages.turbopartners.com.br/creators/` no **Webflow** (ver seção abaixo).
3. **Verificar o pixel da LP principal** (`pages/creators`) — caiu 11pp; rodar Meta Pixel Helper
   e conferir disparo de PageView/LandingPageView.
4. **Investigar os 2 ads avulsos:** o que vai pro `www.turbopartners.com.br` (destino errado) e o
   "sem destino" (R$1,5k).
5. **Mídia (item 2):** revisar ritmo de escala — leads travados em ~940/mês com +50% de gasto.
6. **Descartado:** o parâmetro `tum_term+=` (malformado, "tum" em vez de "utm") — não faz sentido,
   remover do tagueamento. Não era a causa da queda.

## Correlação LP antiga × queda — e projeção de leads/MQL perdidos

> Método: cruzamento **leads/clique** (leads do Bitrix via `utm_content`=ad_id × cliques da Meta).
> Isso **ignora o pixel quebrado** — usa só dados confiáveis (cliques Meta + leads Bitrix).
> Bitrix `crm_deal` tem `utm_content`, `utm_campaign`, `mql`. GA4 confirma chegada na página.

### Conversão clique→lead por LP (paid Meta)
| LP | Período | Cliques | Leads | MQL | Leads/clique | MQL/clique | CR pixel |
|---|---|---|---|---|---|---|---|
| **Canônica** `pages/creators` | Maio | 7.755 | 613 | 227 | 7,9% | 2,9% | 83% |
| | Jun 1-8 | 2.592 | 161 | 63 | 6,2% | 2,4% | 70% |
| **Antiga** `lp/commerce/creators-lp` | Maio | 1.091 | 104 | 20 | **9,5%** | 1,8% | 71% |
| | Jun 1-8 | 119 | **0** | **0** | **0%** | 0% | **15%** |

### Leitura
1. **Em maio a LP antiga convertia BEM** (9,5% leads/clique — até melhor que a canônica 7,9%).
   Ou seja, a página em si não era ruim; mandar tráfego pra ela em maio **não** custou leads.
2. **Em junho a LP antiga colapsou**: 119 cliques (221 sessões no GA4) → **0 leads, 0 MQL**,
   pixel CR 71%→15%. As pessoas **chegaram** (GA4 viu), mas a página **parou de converter** —
   quebra real a partir de ~02/jun (pixel + formulário/UTM), não só medição.
3. **O estrago real foi pequeno** porque o time **já tinha movido ~93% do budget** pra fora da
   LP antiga em junho (R$8,7k em maio → R$577 em junho).

### Projeção de perda
- **Realizada (Jun 1-8):** ~119 cliques na LP antiga quebrada → esperado ~7-11 leads e ~2-3 MQL
  (às taxas de 6,2-9,5%), obtido **0**. → **perda real ≈ 7-11 leads e 2-3 MQL.** Pequena.
- **Exposição se não tivesse sido pego (run-rate):** ao volume de maio (~1.091 cliques → 104 leads,
  20 MQL/mês), um mês inteiro quebrado custaria **~100 leads e ~20 MQL/mês.** Foi a bala desviada
  ao mover o budget cedo.

### ⚠️ Sinal separado a verificar — a LP canônica também caiu
`leads/clique` da canônica caiu **7,9% → 6,2%** (−21% relativo); MQL/clique 2,9% → 2,4%.
Sobre os 2.592 cliques de junho, isso seria ~**40 leads** "a menos" que a taxa de maio — **maior
que a perda da LP antiga**. **Mas** junho tem só 8 dias parciais e há **lag de classificação**
(lead/MQL recém-criado ainda não marcado), o que **subestima** as taxas de junho. Reavaliar quando
o mês fechar antes de tratar como perda confirmada — pode ser lag/saturação, não quebra de página.

### Sobre a correlação que você perguntou
- **LP antiga ↔ Connect Rate:** correlação **direta** (a queda do connect rate ESTÁ concentrada
  nela), mas majoritariamente **medição** (pixel) + quebra real de junho em volume pequeno.
- **LP antiga ↔ Tx Conversão da Página:** **não** é a causa principal. A queda de Tx Conversão é
  o fenômeno de **saturação** (Mar→Jun, leads travados vs gasto escalando) — tendência de meses,
  separada. A LP antiga só somou um pouco em junho. (Aliás, o pixel sub-contando LPV *infla* a
  Tx Conversão da LP antiga, não deprime.)

## Destinos a investigar (varredura da conta)
- **`www.turbopartners.com.br/`** — 5 ads institucionais antigos ("Esther", mar/26: "Diferente das
  Agências", "Cresceram Junto com a Turbo", "Grandes marcas institucional") mandando tráfego pago
  pra **home institucional** (não é LP de conversão). Quase off em junho (R$13). Converteu 6,9%
  leads/clique em maio. Não urgente, mas home ≠ LP.
- **`tiktok-turbopartners.lovable.app/`** — 1 ad (`TP1377 - vv-Interno3`), campanha
  `[TP] [Lead] [ABO] [TikTok] - Captação Creators`. LP no **Lovable** (3ª plataforma). CR pixel 85% ok.
- **`authenticnutri.pilea.app/influencers`** — campanha `[TP] [Leads] [ABO] - Comunidade Authentic`.
  **Produto diferente** (não Creators) — LP na **Pilea** (4ª plataforma). Não é erro, mas reforça a
  fragmentação.
- **(sem destino) — R$19,7k em maio:** ads sem URL parseável (provável Lead Form / Instant Experience
  do Meta, ou catálogo). Confirmar manualmente.

## Como fazer o redirect (a LP está no Webflow)

`lp.turbopartners.com.br` resolve por CNAME para `cdn.webflow.com` → hospedada no **Webflow**.
O redirect deve ser feito **no Webflow**, não neste repositório (as LPs não são servidas pelo Cortex).

**Opção A — 301 no Webflow (recomendado):**
1. Webflow → *Site Settings → Publishing → 301 redirects*.
2. Adicionar: *Old Path* `/commerce/creators-lp` → *Redirect to* `https://pages.turbopartners.com.br/creators/`.
3. ⚠️ O Webflow só aplica o redirect para caminhos **sem página publicada**. Então primeiro
   **despublicar/excluir** (ou renomear o slug d)a página `/commerce/creators-lp`; depois publicar.
   O Webflow preserva a query string no 301 (mantém UTMs de atribuição).

**Opção B — redirect na própria página (imediato, sem excluir):**
No `<head>` da página (Webflow → Page Settings → Custom Code), adicionar:
```html
<script>location.replace('https://pages.turbopartners.com.br/creators/' + location.search);</script>
<meta http-equiv="refresh" content="0; url=https://pages.turbopartners.com.br/creators/">
```
Não é um 301 "puro", mas redireciona na hora e preserva a query string. Bom como ponte até a Opção A.

> Cloudflare Bulk/Redirect Rules **não** servem aqui: `lp.*` aponta direto pro Webflow CDN
> (não está proxied no Cloudflare). Mover o DNS pro proxy do Cloudflare quebraria o SSL/hosting
> do Webflow para o resto do site `lp.*`.
