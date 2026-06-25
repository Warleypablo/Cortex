import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Accept": "application/json",
}

print("Listando tabelas do banco...\n")

response = requests.get(
    f"{SUPABASE_URL}/rest/v1/",
    headers=headers,
)

if response.ok:
    dados = response.json()
    if isinstance(dados, dict):
        tabelas = list(dados.keys())
    elif isinstance(dados, list):
        tabelas = dados
    else:
        tabelas = [dados]

    print(f"Tabelas encontradas: {len(tabelas)}\n")
    for tabela in sorted(tabelas) if isinstance(tabelas[0], str) else tabelas:
        if isinstance(tabela, str):
            print(f"  - {tabela}")
        else:
            print(json.dumps(tabela, indent=2, ensure_ascii=False, default=str))
else:
    print(f"Erro: {response.status_code} - {response.text}")
