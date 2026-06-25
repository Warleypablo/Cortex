"""
Diagnóstico SOMENTE-LEITURA do problema de UTMs (13/06+).
NÃO escreve nada no Bitrix nem no Postgres. Apenas inspeciona a origem.

Objetivo: determinar em qual camada a UTM some.
  - Os campos UTM_* padrão estão vazios no Bitrix para deals de 13/06+?
  - O dado de origem (facebook/instagram/google) migrou para algum UF_CRM_*?
  - fbclid/gclid/referrer ainda chegam?
"""
import os
import sys
import requests
import time
import json
from dotenv import load_dotenv

load_dotenv()

BITRIX_WEBHOOK = (os.getenv("BITRIX_WEBHOOK_URL") or "").rstrip("/") + "/"
if BITRIX_WEBHOOK == "/":
    sys.exit("Faltando BITRIX_WEBHOOK_URL no .env")
REQUEST_TIMEOUT = 30

UTM_STD = ['UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN', 'UTM_TERM', 'UTM_CONTENT']
TRACK_STD = ['UF_CRM_FBCLID', 'UF_CRM_GCLID', 'UF_CRM_REFERRER', 'UF_CRM_USER_AGENT', 'UF_CRM_IP_ADDRESS']
SOURCE_KEYWORDS = ['facebook', 'instagram', 'google', 'meta', 'tiktok', 'youtube',
                   'linkedin', 'whatsapp', 'utm', 'fbclid', 'gclid', 'cpc', 'paid', 'ig', 'fb']

_last = 0.0
def req(url, params):
    global _last
    elapsed = time.time() - _last
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    _last = time.time()
    r = requests.post(url, json=params, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json()

def deals_no_dia(dia_inicio, dia_fim, limite=6):
    """Busca alguns deals criados entre [dia_inicio, dia_fim)."""
    url = f"{BITRIX_WEBHOOK}crm.deal.list"
    params = {
        'order': {'ID': 'ASC'},
        # Pede explicitamente os campos UTM + tudo, para não depender de '*' incluir UTM
        'select': ['ID', 'TITLE', 'DATE_CREATE', 'SOURCE_ID', 'CATEGORY_ID',
                   'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN', 'UTM_TERM', 'UTM_CONTENT',
                   '*', 'UF_*'],
        'filter': {'>=DATE_CREATE': dia_inicio, '<DATE_CREATE': dia_fim},
        'start': 0,
    }
    data = req(url, params)
    return data.get('result', [])[:limite], data.get('total', 0)

def resumo_deal(deal):
    out = {}
    out['ID'] = deal.get('ID')
    out['DATE_CREATE'] = deal.get('DATE_CREATE')
    out['SOURCE_ID'] = deal.get('SOURCE_ID')
    # UTM padrão
    out['utm_std'] = {k: deal.get(k) for k in UTM_STD if deal.get(k) not in (None, '')}
    # tracking padrão
    out['track_std'] = {k: deal.get(k) for k in TRACK_STD if deal.get(k) not in (None, '')}
    # Varre TODOS os campos atrás de valores com cara de origem/UTM
    suspeitos = {}
    for k, v in deal.items():
        if v in (None, '', [], {}):
            continue
        sv = str(v).lower()
        if any(kw in sv for kw in SOURCE_KEYWORDS):
            suspeitos[k] = v
    out['campos_suspeitos'] = suspeitos
    return out

DIAS = [
    ('2026-06-11', '2026-06-12', 'OK (11/06)'),
    ('2026-06-12', '2026-06-13', 'PARCIAL (12/06)'),
    ('2026-06-13', '2026-06-14', 'QUEBRADO (13/06)'),
    ('2026-06-14', '2026-06-15', 'QUEBRADO (14/06)'),
    ('2026-06-15', '2026-06-16', 'QUEBRADO (15/06)'),
]

for ini, fim, rotulo in DIAS:
    deals, total = deals_no_dia(ini, fim)
    print(f"\n{'='*70}")
    print(f"  {rotulo}  —  total no dia: {total}  (amostra: {len(deals)})")
    print('='*70)
    for d in deals:
        r = resumo_deal(d)
        print(f"\n  Deal {r['ID']}  ({r['DATE_CREATE']})  SOURCE_ID={r['SOURCE_ID']}")
        print(f"    utm_std        : {r['utm_std'] or '— VAZIO —'}")
        print(f"    track_std      : {r['track_std'] or '— vazio —'}")
        outros = {k: v for k, v in r['campos_suspeitos'].items()
                  if k not in UTM_STD and k not in TRACK_STD}
        if outros:
            print(f"    OUTROS c/ origem: {json.dumps(outros, ensure_ascii=False)}")
