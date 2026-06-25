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

# Busca dados da tabela solutions_remix_link
print("Buscando dados de solutions_remix_link...\n")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/members_profiles",
    headers=headers,
    params={
        "select": "*",
        "order": "created_at.desc",
    },
)

if response.ok:
    dados = response.json()
    print(f"Registros encontrados: {len(dados)}\n")
    for item in dados:
        print(json.dumps(item, indent=2, ensure_ascii=False, default=str))
        print("-" * 60)
else:
    print(f"Erro: {response.status_code} - {response.text}")
