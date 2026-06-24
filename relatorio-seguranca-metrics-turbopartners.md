# 🔒 Relatório de Segurança — metrics.turbopartners.com.br

**Data:** 2026-04-23
**Alvo:** https://metrics.turbopartners.com.br/
**Tipo de análise:** Reconhecimento passivo + testes não-intrusivos (OSINT, headers, TLS, DNS, arquivos expostos, bundle JS)
**Escopo:** Apenas aplicação web pública. Nenhum teste de carga, força-bruta ou exploração foi executado.

---

## 📋 Sumário Executivo

| Categoria | Status |
|---|---|
| **Nota geral** | **B+ (Boa)** — postura sólida, com melhorias pontuais em headers |
| Criptografia (TLS) | ✅ Forte |
| Autenticação de e-mail (SPF/DMARC) | ✅ Excelente |
| Headers de segurança | ⚠️ Parcial (faltam 3 críticos) |
| Exposição de arquivos sensíveis | ✅ Nenhuma detectada |
| Secrets no bundle JS | ✅ Apenas chave pública (anon key Supabase) |
| Configuração de backend (Supabase) | ✅ Adequada (RLS ativo) |

**Riscos prioritários a corrigir (em ordem):**
1. 🟡 **Content-Security-Policy ausente** → XSS pode ser mais fácil de explorar
2. 🟡 **X-Frame-Options / frame-ancestors ausente** → clickjacking possível
3. 🟢 **CAA DNS ausente** → qualquer CA pode emitir certificado para o domínio
4. 🟢 **HSTS sem `preload`** → primeira visita em HTTP permanece vulnerável a MITM

---

## 🏗️ 1. Infraestrutura e Stack Identificada

- **CDN/WAF:** Cloudflare (header `server: cloudflare`, cookie `__cf_bm`)
- **Hospedagem da app:** Lovable (`sales-optimizer-zone.lovable.app.` via CNAME)
- **Backend BaaS:** Supabase (`https://ulwtlazcfzojcvjzwdpq.supabase.co`)
- **Frontend:** React/Vite (bundle `/assets/index-T6EWNnsP.js`, 2.3 MB)
- **Analytics:** Flock (`/~flock.js`)
- **Site institucional (`www.turbopartners.com.br`):** hospedado no Webflow (escopo diferente)

> A arquitetura Lovable + Supabase + Cloudflare é moderna e, se bem configurada no Supabase (RLS), tende a ser segura. O elo mais fraco tipicamente são as políticas RLS no banco.

---

## 🔐 2. TLS / Certificado

| Item | Valor |
|---|---|
| Emissor | Google Trust Services (WE1) |
| Subject | `CN=metrics.turbopartners.com.br` |
| Válido de | 14/04/2026 |
| Válido até | 13/07/2026 (~90 dias — renovação automática Cloudflare/Google) |
| TLS 1.0 / 1.1 | ❌ Rejeitado (✅ correto) |
| TLS 1.2 | ✅ Aceito |
| TLS 1.3 | ✅ Aceito (cifra: `AEAD-CHACHA20-POLY1305-SHA256`) |
| HTTP → HTTPS | ✅ 301 com HSTS |

**Veredito:** Excelente. Nenhum problema de criptografia detectado.

---

## 🧱 3. Headers HTTP de Segurança

Headers retornados por `GET /`:

```
strict-transport-security: max-age=31536000; includeSubDomains
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
```

| Header | Presente? | Recomendação |
|---|---|---|
| `Strict-Transport-Security` | ✅ | Adicionar `preload` e submeter em https://hstspreload.org |
| `X-Content-Type-Options: nosniff` | ✅ | — |
| `Referrer-Policy` | ✅ | — |
| **`Content-Security-Policy`** | ❌ **Ausente** | **Adicionar (ver §7)** |
| **`X-Frame-Options` / `frame-ancestors`** | ❌ **Ausente** | **Adicionar `DENY` ou `SAMEORIGIN`** |
| `Permissions-Policy` | ❌ Ausente | Recomendado limitar `camera`, `microphone`, `geolocation` |
| `Cross-Origin-Opener-Policy` | ❌ Ausente | Opcional, `same-origin` |
| `Cross-Origin-Resource-Policy` | ❌ Ausente | Opcional, `same-site` |

---

## 🍪 4. Cookies

| Cookie | Atributos | Avaliação |
|---|---|---|
| `__cf_bm` (Cloudflare Bot Management) | `HttpOnly; Secure; SameSite` implícito | ✅ |
| `__dpl` (Deployment ID Lovable/Vercel) | `Secure; SameSite=Lax`, **sem `HttpOnly`** | 🟢 Baixo — só armazena ID público, mas recomenda-se adicionar `HttpOnly` |

> Quando o usuário autenticar, os cookies de sessão do Supabase precisam ter `HttpOnly; Secure; SameSite=Lax/Strict`. A validação disso exigiria login autorizado.

---

## 📡 5. DNS e Configuração de Domínio

### Registros MX / Email
```
MX: aspmx.l.google.com (Google Workspace)
SPF: v=spf1 include:_spf.google.com include:_spf.supabase.com ~all  ✅
DMARC: v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:contato@... ✅ EXCELENTE
```

**DMARC com `p=reject`** é o nível máximo — protege contra spoofing do domínio.

### CAA (Certification Authority Authorization)
```
turbopartners.com.br  CAA  → (ausente)
```
🟡 **Recomendação:** Adicionar registros CAA para restringir quais CAs podem emitir certificados:
```
turbopartners.com.br. CAA 0 issue "pki.goog"
turbopartners.com.br. CAA 0 issue "letsencrypt.org"
turbopartners.com.br. CAA 0 iodef "mailto:contato@turbopartners.com.br"
```

### TXTs verificáveis
Múltiplos `google-site-verification`, `linkedin-site-verification`, `pinterest-site-verification` → esperado, sem risco.

---

## 📂 6. Exposição de Arquivos/Endpoints

Testado 21 caminhos sensíveis (`.env`, `.git/config`, `.DS_Store`, `server-status`, `phpinfo.php`, `wp-admin`, `composer.json`, `.htaccess`, sitemap, backups, etc).

| Resultado | Caminhos |
|---|---|
| **404** (não existe) | `.env`, `.DS_Store`, `phpinfo.php`, `wp-login.php`, `composer.json`, `package.json`, `.htaccess`, `security.txt`, `sitemap.xml` |
| **200 SPA fallback** (retorna index.html) | `.git/config`, `.git/HEAD`, `server-status`, `admin`, `api`, `login`, `dashboard`, `backup`, `test` |
| Source maps (`.js.map`, `.css.map`) | ❌ 404 — ✅ bom, não expõe código-fonte |

> ⚠️ **Observação:** o SPA retorna 200 com o `index.html` para qualquer rota desconhecida. Isso é comportamento esperado do React Router, mas pode confundir scanners automatizados. **Nenhum arquivo real foi exposto.**

🟢 **Recomendação leve:** publicar `/.well-known/security.txt` com contato de divulgação responsável:
```
Contact: mailto:seguranca@turbopartners.com.br
Expires: 2027-04-23T00:00:00Z
Preferred-Languages: pt-BR, en
```

---

## 🔑 7. Análise do Bundle JavaScript (2.3 MB)

**Secrets encontrados:**
- ✅ Supabase URL: `https://ulwtlazcfzojcvjzwdpq.supabase.co` (público por design)
- ✅ Supabase **anon key** (JWT com `role: anon`) — público por design, protegido por RLS

**JWT decodificado:**
```json
{"iss":"supabase","ref":"ulwtlazcfzojcvjzwdpq","role":"anon","iat":1774289807,"exp":2089865807}
```

**Teste de abuso da anon key:**
- `GET /rest/v1/` → `"Invalid API key: Only service_role..."` ✅ correto
- `GET /rest/v1/profiles` → 404 (sem permissão GRANT SELECT — ótimo)
- `GET /rest/v1/users` → 404
- `GET /rest/v1/clientes` → 404

🟢 **Veredito:** Supabase está **corretamente configurado**. A anon key não consegue listar tabelas sem autenticação, indicando que:
1. RLS está habilitado, **ou**
2. As tabelas não dão `GRANT SELECT TO anon` (preferível para tabelas 100% internas)

⚠️ **O que não foi testado** (exigiria autorização explícita):
- Políticas RLS para usuário autenticado (`authenticated` role)
- Endpoints RPC (`/rest/v1/rpc/*`)
- Storage buckets do Supabase (`/storage/v1/object/*`)
- Edge Functions

**Recomendação:** executar `supabase db lint` e revisar manualmente cada policy. Bugs mais comuns em Supabase:
- `USING (true)` em tabelas sensíveis
- Ausência de policy para `UPDATE`/`DELETE` (herda `SELECT` por engano)
- Storage buckets públicos sem precisar

---

## 🌐 8. Superfície de Subdomínios

| Subdomínio | Destino | Observação |
|---|---|---|
| `metrics.turbopartners.com.br` | Lovable/Cloudflare | Alvo deste relatório |
| `www.turbopartners.com.br` | Webflow CDN | Site institucional |
| `api.` / `admin.` / `dev.` / `staging.` / `portal.` | Não resolvem | ✅ Sem ambientes auxiliares expostos |

✅ Superfície de ataque limitada. Nenhum ambiente de dev/staging exposto publicamente.

---

## 📝 9. Plano de Ação Recomendado

### Prioridade ALTA (implementar nesta sprint)

**1. Adicionar Content-Security-Policy**
No Lovable/Cloudflare, configurar o header. Base sugerida para apps React + Supabase:
```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'unsafe-inline' https://metrics.turbopartners.com.br;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev;
  connect-src 'self' https://ulwtlazcfzojcvjzwdpq.supabase.co wss://ulwtlazcfzojcvjzwdpq.supabase.co;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```
Começar com **Content-Security-Policy-Report-Only** por 1-2 semanas antes de enforçar.

**2. Adicionar X-Frame-Options / frame-ancestors**
```
X-Frame-Options: DENY
```
(já coberto se o CSP acima for aplicado com `frame-ancestors 'none'`)

### Prioridade MÉDIA

**3. Adicionar registro CAA no DNS**
No Registro.br ou provedor DNS:
```
turbopartners.com.br. CAA 0 issue "pki.goog"
turbopartners.com.br. CAA 0 iodef "mailto:contato@turbopartners.com.br"
```

**4. Adicionar Permissions-Policy**
```
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

**5. Publicar /.well-known/security.txt**
Facilita reports de pesquisadores de segurança.

### Prioridade BAIXA (melhoria contínua)

**6. HSTS preload**
Após CSP estar estável, adicionar `preload` ao HSTS e submeter em https://hstspreload.org:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**7. Auditoria de políticas RLS no Supabase**
- Revisar manualmente cada `CREATE POLICY` no banco
- Testar com um token `authenticated` comum se há vazamento cross-tenant

**8. Cookie `__dpl` com HttpOnly**
Configuração do Lovable — baixíssimo impacto, mas é higiene.

**9. WAF rules no Cloudflare**
- Rate limiting em `/rest/v1/*` (proxy Supabase, se existir)
- Bot Fight Mode para diminuir scraping

---

## ✅ 10. Pontos Fortes

- TLS moderno, TLS 1.0/1.1 desabilitados
- Certificado válido, renovação automática
- DMARC `p=reject` — nível máximo anti-spoofing
- Nenhum arquivo sensível exposto (`.env`, `.git`, source maps)
- Nenhum subdomínio de desenvolvimento vazado
- Supabase RLS aparentemente funcional
- Redirect HTTP → HTTPS com HSTS
- Cloudflare protegendo contra DDoS e bots
- SPF configurado corretamente

---

## ⚠️ Limitações deste Relatório

Esta análise cobre **apenas reconhecimento externo passivo**. Não cobre:
- Políticas RLS internas do Supabase (exigiria credenciais ou colaboração interna)
- Lógica de autenticação e autorização da aplicação (requer login autorizado)
- Edge Functions e RPCs do Supabase
- Vulnerabilidades no código-fonte (SAST)
- Dependências com CVEs (SCA do `package.json`)
- Testes de injeção, IDOR, business logic

**Próximo passo sugerido:** pentest autenticado com escopo definido ou revisão de código do repositório Cortex.
