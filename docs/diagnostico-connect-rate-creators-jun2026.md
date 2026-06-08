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
