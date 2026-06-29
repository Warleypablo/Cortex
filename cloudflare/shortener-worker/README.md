# Encurtador da Turbo — Cloudflare Worker

Worker que serve `marketing.turbopartners.com.br/<slug>`: lê o slug no KV, redireciona
pro destino (com UTM intacta) e dispara o clique pro Cortex. Ver `docs/encurtador-links-plano.md`.

> **Arquitetura:** o **Cortex** cria o link (UTM Builder) e escreve `slug → URL` no KV.
> Este **Worker** só lê o KV e redireciona. O clique volta pro Cortex via `POST /api/clicks`.

---

## Passo a passo (rodar 1x, na pasta `cloudflare/shortener-worker/`)

### A) Deploy do Worker

```bash
cd cloudflare/shortener-worker
npm install
npx wrangler login                       # abre o navegador, loga na conta Cloudflare da Turbo
```

**1. Criar o KV namespace** (o "dicionário" slug → URL):
```bash
npx wrangler kv namespace create LINKS
```
→ copie o `id` que ele imprime e cole em `wrangler.toml` (campo `id` de `kv_namespaces`).
**Guarde esse id** — vai ser o `CF_KV_NAMESPACE_ID` no Cortex também.

**2. Gerar o segredo de clique** (compartilhado com o Cortex):
```bash
openssl rand -hex 32                      # gera um valor; copie
npx wrangler secret put CLICK_INGEST_SECRET   # cole o valor quando pedir
```

**3. DNS do subdomínio** (no painel Cloudflare → DNS de `turbopartners.com.br`):
- Adicione um registro **AAAA** · nome `marketing` · conteúdo `100::` · **Proxy LIGADO (nuvem laranja)**.
- Isso faz o hostname existir e passar pela Cloudflare; o tráfego real é interceptado pelo Worker
  (o `100::` é um endereço de descarte — nunca recebe tráfego de verdade).

**4. Publicar:**
```bash
npx wrangler deploy
```
Isso publica o Worker e registra a rota `marketing.turbopartners.com.br/*`.

✅ Testar: `https://marketing.turbopartners.com.br/<um-slug-que-você-criou-no-Cortex>` deve redirecionar.

### B) Configurar o Cortex (Render) pra escrever no KV e receber o clique

No serviço do Cortex no Render, adicione as variáveis de ambiente e **redeploy**:

| Variável | Valor |
|---|---|
| `SHORTENER_BASE_URL` | `https://marketing.turbopartners.com.br` |
| `CF_ACCOUNT_ID` | Account ID (painel Cloudflare → Workers, canto direito) |
| `CF_KV_NAMESPACE_ID` | o `id` do KV do passo A1 |
| `CF_API_TOKEN` | um API Token com permissão **Workers KV Storage : Edit** (criar em My Profile → API Tokens) |
| `CLICK_INGEST_SECRET` | **o mesmo** valor gerado no passo A2 |

Pronto: ao criar um link no UTM Builder, o Cortex escreve no KV → o Worker já redireciona →
o clique volta pro Cortex e aparece na coluna **Cliques** do Histórico.

---

## Dev / debug

```bash
npx wrangler dev      # roda local (KV de teste; não é o de produção)
npx wrangler tail     # logs ao vivo do Worker em produção
```

## Como funciona o redirect

```
GET marketing.turbopartners.com.br/vitor-junho
  → KV.get("vitor-junho") = "https://turbopartners.com.br?utm_source=vitor&..."
  → 302 pro destino (UTM intacta)
  → ctx.waitUntil: POST cortex.../api/clicks  { slug, country, ipHash, userAgent, referrer }
```
Slug inexistente ou raiz → redireciona pro `FALLBACK_URL` (o site), nunca um 404.
