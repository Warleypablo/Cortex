import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("Faltam variaveis no .env: SUPABASE_URL e SUPABASE_ANON_KEY sao obrigatorias.")
    sys.exit(1)


CANDIDATOS = [
    "recados"
]


def testar_com_anon(tabela):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Accept": "application/json",
    }
    url = f"{SUPABASE_URL}/rest/v1/{tabela}?select=*&limit=1"
    try:
        resp = requests.get(url, headers=headers, timeout=15)
    except requests.RequestException as e:
        return ("ERRO", f"falha de rede: {e}")

    if resp.status_code in (200, 206):
        try:
            linhas = resp.json()
        except ValueError:
            linhas = []
        if isinstance(linhas, list) and len(linhas) > 0:
            return ("EXPOSTA", f"retornou {len(linhas)} linha(s) com anon key")
        return ("AMBIGUA", "200 mas vazio (tabela existe/esta exposta porem vazia, OU RLS filtrou tudo)")
    if resp.status_code in (401, 403):
        return ("BLOQUEADA", f"{resp.status_code} - RLS/permissao negou")
    if resp.status_code == 404:
        return ("NAO_EXPOSTA", "404 - nao existe ou nao publicada via PostgREST")
    return ("ERRO", f"{resp.status_code} - {resp.text[:120]}")


def main():
    if len(sys.argv) > 1:
        tabelas = sys.argv[1:]
        print(f"Testando {len(tabelas)} tabela(s) passada(s) por argumento...\n")
    else:
        tabelas = CANDIDATOS
        print(f"Testando {len(tabelas)} candidatos padrao (passe nomes como argumento para sobrescrever)...\n")

    resultados = {"EXPOSTA": [], "AMBIGUA": [], "BLOQUEADA": [], "NAO_EXPOSTA": [], "ERRO": []}
    for tabela in tabelas:
        status, detalhe = testar_com_anon(tabela)
        resultados[status].append((tabela, detalhe))
        marcador = {
            "EXPOSTA": "[!]",
            "AMBIGUA": "[?]",
            "BLOQUEADA": "[ok]",
            "NAO_EXPOSTA": "[--]",
            "ERRO": "[er]",
        }[status]
        print(f"{marcador} {tabela:30s} {status:12s} {detalhe}")

    print("\n--- Resumo ---")
    print(f"Expostas (retornaram dados):       {len(resultados['EXPOSTA'])}")
    print(f"Ambiguas (200 sem linhas):         {len(resultados['AMBIGUA'])}")
    print(f"Bloqueadas (RLS negou):            {len(resultados['BLOQUEADA'])}")
    print(f"Nao expostas / nao existem (404):  {len(resultados['NAO_EXPOSTA'])}")
    print(f"Erros:                             {len(resultados['ERRO'])}")

    if resultados["EXPOSTA"]:
        print("\n[!] ATENCAO - Tabelas com dados acessiveis via anon key:")
        for tabela, detalhe in resultados["EXPOSTA"]:
            print(f"  - {tabela}: {detalhe}")

    if resultados["AMBIGUA"]:
        print("\n[?] Ambiguas - tabela responde 200 mas sem dados. Verificar RLS manualmente:")
        for tabela, _ in resultados["AMBIGUA"]:
            print(f"  - {tabela}")


if __name__ == "__main__":
    main()
