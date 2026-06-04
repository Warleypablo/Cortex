# Métricas de Página: Connect Rate e Conversão (View vs Sessão)

> Definição canônica e justificativa das métricas de topo de página no Growth (aba
> Orçado x Realizado e Por Plataforma). Criado em 2026-06-04.
> Decisões tomadas com Ichino + alinhadas à [Constituição UTM](./utm-constituicao.md).

## 1. Connect Rate

```
Connect Rate = Visualizações de Página (Pixel Meta) ÷ Cliques de Saída do Meta
```

- **Numerador:** `landing_page_views` (Meta Pixel) — a LP carregou.
- **Denominador:** `outbound_clicks` do **Meta** — cliques que saíram do anúncio.
- **Semântica:** de cada clique que saiu do anúncio, quantos chegaram (a LP carregou). Mede
  perda por velocidade da página, desistência no carregamento, falha de tracking.
- **É puramente Meta** (Pixel). Google não tem `landing_page_views`.

**Correção 2026-06-04:** o denominador passou a usar `metaOutboundClicks` (capturado **antes**
de somar os cliques do Google). Antes, no consolidado, o `cliquesSaida` já tinha Google somado
(herdado do cálculo de CTR), inflando o denominador e **subestimando** o Connect Rate. Agora
numerador e denominador são ambos Meta. Ver `server/routes/growth.ts` (endpoint `/ads`).

## 2. Conversão de Página — DUAS métricas distintas

São perguntas diferentes; por isso têm nomes distintos e aparecem lado a lado.

### Tx Conversão de Página (View)
```
= Leads ÷ Visualizações de Página (landing_page_views, Pixel Meta)
```
- "Dos que clicaram no anúncio e a LP carregou, quantos viraram lead?"
- **Só Meta** (Pixel). Por-anúncio (existe em Criativos). Sofre subcontagem do Pixel (iOS/ATT).
- Tende a ser **mais alta** (denominador mais qualificado: já chegou na página).

### Tx Conversão de Página (Sessão)
```
= Leads ÷ Sessões (GA4, bucket da plataforma)
```
- "De cada visita ao site vinda do canal, quantas viraram lead?"
- **Universal** (Meta, Google, orgânico). Comparável entre canais. É a métrica honesta para
  comparação de canais. Sessão = visita ao site (qualquer página, exceto `linktr.ee`).
- Tende a ser **mais baixa** (denominador mais largo: inclui quem visitou e nem chegou na oferta).

> **Sessão ≠ Visitante único.** Sessão = visita (a mesma pessoa pode ter várias). Visitante
> único = `totalUsers` no GA4. Escolhemos **Sessão** (padrão de mercado pra conversão de página).

**Comparativo real (maio/2026, escopo Meta):** View = 10,2% (901/8.824) vs Sessão = 5,7%
(901/15.695). A escolha do denominador quase dobra o número — por isso mostramos as duas.

## 3. Matriz de disponibilidade por plataforma/filtro

| Filtro | (View) Pixel | (Sessão) GA4 |
|---|---|---|
| **Meta Ads** | ✅ real | ✅ |
| **Google Ads** | ❌ "—" (não tem Pixel; `visualizacoesPagina` é cliques) | ✅ |
| **Instagram** (orgânico) | ❌ "—" | ✅ (bucket `instagram`) |
| **YouTube / LinkedIn** | ❌ "—" | ✅ mas volume ~0 |
| **Consolidado** (sem filtro) | ❌ "—" (leads all-source ÷ views só-Meta = enganoso) | ✅ (GA4 total) |
| **Criativos** (por ad) | ✅ (único possível por-ad) | ❌ (não existe por-ad) |

"—" = denominador não existe/não é honesto naquele recorte.

## 4. Bucketing de Sessões GA4 (`server/services/ga4Sessions.ts`)

`classifyPlatform(source, medium)` separa as sessões por **source + medium**:

| Bucket | Regra |
|---|---|
| `meta_ads` | source `facebook`/`fb`/`meta` **+ medium pago** (cpc/ppc/paid/...) |
| `google_ads` | source `google`/`adwords`/`gads` **+ medium pago** |
| `instagram` | source `instagram`/`ig` (orgânico) |
| `youtube` | source `youtube`/`yt` (orgânico) |
| `linkedin` | source `linkedin` |
| `organico` | direto/organic + **Facebook orgânico** (page posts, bio/linktree) |
| `outros` | resto |

**Por que medium importa (a ambiguidade do `facebook`):** `utm_source=facebook` é sobrecarregado
— significa Meta Ads **pago**, página **orgânica** do Facebook, e referrals de `facebook.com`.
Em maio/2026 havia **866 sessões "facebook" que NÃO eram pago** (linktree/organic/referral). Só
o **`utm_medium`** separa pago de orgânico. Por isso o bucket `meta_ads` exige medium pago — senão
o orgânico inflaria o "Meta pago" (~6%).

**Placement FB vs IG:** anúncios Meta no feed do Facebook e no stories do Instagram saem os dois
como `utm_source=facebook&utm_medium=paid`. O placement está no **`utm_term`** (`{{placement}}`),
não no source. Logo, separar performance FB-placement vs IG-placement exige `utm_term`, não source.

**Volumes maio/2026 (sanidade):** meta_ads 14.277 · google_ads 4.122 · instagram 552 · youtube 33
· linkedin 10 · organico 7.963 · outros 2.799. (Antes, Instagram caía dentro de Meta, sujando-o.)

## 5. Dependências e limitações

- A Sessão dos **canais orgânicos** (IG/YT/LinkedIn) só atribui se os links (bio, descrição)
  tiverem UTM correta (`utm_source=instagram/youtube/linkedin`). Pós-cutover da Constituição
  (21/05/2026) ok; histórico antigo sem UTM cai em `organico`/`outros`.
- **YouTube/LinkedIn** têm volume ~0 hoje (sem operação real) — a Sessão deles é ruído esperado.
- A mesma assimetria numerador/denominador também afetava **CPL/CPMQL** no consolidado (gasto pago
  ÷ leads all-source) — **fora de escopo** desta mudança; decidir depois se padroniza.

## 6. Onde está no código

- Connect Rate + sessão por bucket: `server/routes/growth.ts` (endpoints `/ads`, `/meta-ads`,
  `/google-ads`, `/instagram`, `funnel-by-platform`).
- Bucketing GA4: `server/services/ga4Sessions.ts` (`classifyPlatform`, `Ga4PlatformBreakdown`).
- Duas linhas de conversão no front: `client/src/pages/GrowthOrcadoRealizado.tsx`
  (`buildFunnelMetrics`, `buildAdsMetrics`).
