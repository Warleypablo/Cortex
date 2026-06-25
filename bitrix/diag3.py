"""
Diagnóstico v3 — SOMENTE-LEITURA.
Mede se a cura das UTMs está COMPLETA: compara, por dia,
a cobertura no banco vs o teto real no Bitrix (origem).
"""
import os, sys, requests, time, psycopg2
from dotenv import load_dotenv

load_dotenv()

BITRIX_WEBHOOK = (os.getenv("BITRIX_WEBHOOK_URL") or "").rstrip("/") + "/"
if BITRIX_WEBHOOK == "/":
    sys.exit("Faltando BITRIX_WEBHOOK_URL no .env")

_last = 0.0
def req(url, params):
    global _last
    el = time.time() - _last
    if el < 1.0: time.sleep(1.0 - el)
    _last = time.time()
    return requests.post(url, json=params, timeout=30).json()

def bitrix_cobertura(dia_ini, dia_fim):
    """Conta no Bitrix: total de deals e quantos têm UTM_SOURCE no intervalo."""
    url = f"{BITRIX_WEBHOOK}crm.deal.list"
    start = 0; total = 0; com_utm = 0
    while True:
        params = {'order': {'ID': 'ASC'},
                  'select': ['ID', 'UTM_SOURCE'],
                  'filter': {'>=DATE_CREATE': dia_ini, '<DATE_CREATE': dia_fim},
                  'start': start}
        data = req(url, params)
        res = data.get('result', [])
        for d in res:
            total += 1
            if d.get('UTM_SOURCE'):
                com_utm += 1
        nxt = data.get('next')
        if nxt is None: break
        start = nxt
    return total, com_utm

DIAS = [
    ('2026-06-12', '2026-06-13'),
    ('2026-06-13', '2026-06-14'),
    ('2026-06-14', '2026-06-15'),
    ('2026-06-15', '2026-06-16'),
]

print("Coletando cobertura de UTM na ORIGEM (Bitrix)...")
bitrix = {}
for ini, fim in DIAS:
    t, c = bitrix_cobertura(ini, fim)
    bitrix[ini] = (t, c)
    print(f"  {ini}: Bitrix total={t}  com_utm_source={c}")

# Banco
conn = psycopg2.connect(host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
                        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"),
                        password=os.getenv("DB_PASSWORD"),
                        connect_timeout=10, application_name='diag_readonly')
conn.set_session(readonly=True)
cur = conn.cursor()
cur.execute("""
    SELECT date_create::date AS dia,
           COUNT(*) AS leads,
           COUNT(utm_source)   FILTER (WHERE utm_source   <> '') AS c_source,
           COUNT(utm_campaign) FILTER (WHERE utm_campaign <> '') AS c_campaign,
           COUNT(utm_content)  FILTER (WHERE utm_content  <> '') AS c_content
    FROM "Bitrix".crm_deal
    WHERE date_create::date BETWEEN DATE '2026-06-12' AND DATE '2026-06-15'
    GROUP BY 1 ORDER BY 1;
""")
print("\nCobertura no BANCO:")
print(f"  {'dia':<12}{'leads':>6}{'source':>8}{'campaign':>10}{'content':>9}")
for dia, leads, cs, cc, cco in cur.fetchall():
    print(f"  {str(dia):<12}{leads:>6}{cs:>8}{cc:>10}{cco:>9}")

print("\nPARIDADE (banco com_source vs Bitrix com_utm — devem bater):")
for ini, fim in DIAS:
    cur.execute("""SELECT COUNT(utm_source) FILTER (WHERE utm_source <> '')
                   FROM "Bitrix".crm_deal
                   WHERE date_create >= %s AND date_create < %s""", (ini, fim))
    db_c = cur.fetchone()[0]
    bt_t, bt_c = bitrix[ini]
    flag = "OK" if db_c == bt_c else f"DIVERGE ({bt_c - db_c} faltando)"
    print(f"  {ini}: banco={db_c}  bitrix={bt_c}  -> {flag}")

cur.close(); conn.close()
