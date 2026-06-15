#!/usr/bin/env python3
"""Sincroniza as product rows (linhas de produto, com preço por serviço) dos deals
ganhos do Bitrix para cortex_core.bitrix_deal_produto_valor.

Cada linha de produto tem PRICE × QUANTITY; o nome do produto é mapeado para um
segmento BP (mesma lógica do CASE_PRODUTO). O resultado é o valor por segmento por
deal — usado pela cascata de "Vendas por Produto" como 1ª fonte de mix (exata),
antes do mix do ClickUp e do rateio por AOV.

A API de product rows é por deal (1 chamada cada), por isso isto roda em batch
(sync), não em tempo de request. Gera /tmp/sync-bitrix-product-rows.sql.

Uso: BITRIX_WEBHOOK_URL=... PGHOST/PG... python3 scripts/sync-bitrix-product-rows.py
(por padrão lê os deals do banco apontado pelas envs DB_* / PROD_PASS abaixo)
"""
import os, sys, json, subprocess, urllib.request, time

WH = os.environ["BITRIX_WEBHOOK_URL"].rstrip("/")

def fetch_rows(did):
    # respeita o rate limit do Bitrix: backoff exponencial em 503/429
    for tentativa in range(5):
        try:
            return json.load(urllib.request.urlopen(f"{WH}/crm.deal.productrows.get?id={did}", timeout=30)).get("result") or []
        except urllib.error.HTTPError as e:
            if e.code in (503, 429) and tentativa < 4:
                time.sleep(1.5 * (tentativa + 1)); continue
            raise
    return []

# Conexão para LER a lista de deals (qualquer ambiente serve; usa o que vier nas envs)
PSQL = ["psql", "-h", os.environ.get("DBH", "34.95.249.110"), "-U", os.environ.get("DBU", "postgres"),
        "-d", os.environ.get("DBN", "dados_turbo"), "-tAF", "|", "-c"]
ENV = dict(os.environ, PGPASSWORD=os.environ["PGPASS"])

def segmento(nome: str) -> str:
    n = (nome or "").lower()
    if "performance" in n: return "Performance"
    if "creator" in n: return "Creators"
    if "social" in n: return "Social"
    if "comunidade" in n: return "Gestão de Comunidade"
    if "commerce" in n: return "E-commerce"
    if "site" in n: return "Site Institucional"
    if "landing" in n: return "Landing Page"
    return "Others"

# deals ganhos 2026 com valor (mesmo universo do assembler)
q = ("SELECT id FROM \"Bitrix\".crm_deal WHERE stage_name='Negócio Ganho' "
     "AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01' "
     "AND (COALESCE(valor_recorrente,0) > 0 OR COALESCE(valor_pontual,0) > 0)")
ids = [l.strip() for l in subprocess.check_output(PSQL + [q], env=ENV, text=True).splitlines() if l.strip()]

inserts = []
deals_com_rows = 0
falhas = 0
for did in ids:
    try:
        rows = fetch_rows(did)
    except Exception as e:
        print(f"  ! deal {did}: {e}", file=sys.stderr); rows = []; falhas += 1
    time.sleep(0.25)  # ~4 req/s, abaixo do limite do Bitrix
    if not rows:
        continue
    por_seg = {}
    for r in rows:
        v = float(r.get("PRICE", 0) or 0) * float(r.get("QUANTITY", 1) or 1)
        if v <= 0:
            continue
        seg = segmento(r.get("PRODUCT_NAME", ""))
        por_seg[seg] = por_seg.get(seg, 0.0) + v
    if not por_seg:
        continue
    deals_com_rows += 1
    for seg, v in por_seg.items():
        inserts.append(f"INSERT INTO cortex_core.bitrix_deal_produto_valor (deal_id, segmento, valor) VALUES ({did}, '{seg}', {round(v, 2)});")

sql = "BEGIN;\nTRUNCATE cortex_core.bitrix_deal_produto_valor;\n" + "\n".join(inserts) + "\nCOMMIT;\n"
out = "/tmp/sync-bitrix-product-rows.sql"
with open(out, "w") as f:
    f.write(sql)
print(f"OK: {len(ids)} deals lidos, {deals_com_rows} com product rows, {len(inserts)} linhas (segmento×deal), {falhas} falhas em {out}")
