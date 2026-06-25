"""
Diagnóstico v2 — SOMENTE-LEITURA.
A) Testa se crm.deal.list com select ['*','UF_*'] (igual ao puxardados.py)
   RETORNA UTM_SOURCE. Gotcha clássico do Bitrix.
B) Confere o estado real do banco: contagem por dia e quantos têm utm_source.
   Apenas SELECT — não escreve nada.
"""
import os, sys, requests, time, psycopg2
from dotenv import load_dotenv

load_dotenv()

BITRIX_WEBHOOK = (os.getenv("BITRIX_WEBHOOK_URL") or "").rstrip("/") + "/"
if BITRIX_WEBHOOK == "/":
    sys.exit("Faltando BITRIX_WEBHOOK_URL no .env")

# ---------- A) Teste do select '*' ----------
print("="*70)
print("A) crm.deal.list com select ['*','UF_*'] retorna UTM_SOURCE?")
print("="*70)
# Deal 41058 (14/06) que SABEMOS ter UTM_SOURCE='facebook' no Bitrix
url = f"{BITRIX_WEBHOOK}crm.deal.get"
r = requests.post(url, json={'id': 41058}, timeout=30).json()
deal_get = r.get('result', {})
print(f"  crm.deal.get(41058) UTM_SOURCE = {deal_get.get('UTM_SOURCE')!r}")

# Agora via crm.deal.list com EXATAMENTE o select do puxardados.py
url = f"{BITRIX_WEBHOOK}crm.deal.list"
params = {'order': {'ID': 'ASC'}, 'select': ['*', 'UF_*'],
          'filter': {'ID': 41058}}
time.sleep(1)
r = requests.post(url, json=params, timeout=30).json()
res = r.get('result', [])
if res:
    d = res[0]
    tem_utm = 'UTM_SOURCE' in d
    print(f"  crm.deal.list select=['*','UF_*']:")
    print(f"    'UTM_SOURCE' presente nas chaves? {tem_utm}")
    print(f"    valor UTM_SOURCE = {d.get('UTM_SOURCE')!r}")
    print(f"    valor UTM_CAMPAIGN = {d.get('UTM_CAMPAIGN')!r}")
    print(f"    total de chaves retornadas: {len(d)}")
else:
    print("  (sem resultado)")

# ---------- B) Estado do banco ----------
print()
print("="*70)
print("B) Estado do banco Bitrix.crm_deal (SOMENTE SELECT)")
print("="*70)
conn = psycopg2.connect(host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
                        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"),
                        password=os.getenv("DB_PASSWORD"),
                        connect_timeout=10, application_name='diag_readonly')
conn.set_session(readonly=True)
cur = conn.cursor()
cur.execute("""
    SELECT date_create::date AS dia,
           COUNT(*) AS leads,
           COUNT(utm_source) FILTER (WHERE utm_source <> '') AS com_utm_source,
           MAX(id) AS max_id
    FROM "Bitrix".crm_deal
    WHERE date_create::date >= DATE '2026-06-09'
    GROUP BY 1 ORDER BY 1 DESC;
""")
print(f"  {'dia':<12}{'leads':>7}{'com_utm':>9}{'max_id':>9}")
for dia, leads, com_utm, max_id in cur.fetchall():
    print(f"  {str(dia):<12}{leads:>7}{com_utm:>9}{max_id:>9}")

# Confirma que linhas de 13-15/06 existem (backfill = UPDATE, não INSERT)
cur.execute("""
    SELECT id, date_create, utm_source, utm_campaign, utm_content
    FROM "Bitrix".crm_deal
    WHERE id IN (40978, 40980, 41058, 41060, 41144, 41148)
    ORDER BY id;
""")
print("\n  Amostra de linhas que no Bitrix TÊM utm (esperado: utm_source NULL/vazio no banco):")
for row in cur.fetchall():
    print(f"    id={row[0]}  date_create={row[1]}  utm_source={row[2]!r}  utm_campaign={row[3]!r}")

cur.close(); conn.close()
