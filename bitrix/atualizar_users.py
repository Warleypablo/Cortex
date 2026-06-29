import os
import requests
import psycopg2
from psycopg2.extras import execute_values
import sys
import time
from dotenv import load_dotenv

load_dotenv()

# Configurações do Bitrix24 (lidas do .env; mantem a barra final)
BITRIX_WEBHOOK = (os.getenv("BITRIX_WEBHOOK_URL") or "").rstrip("/") + "/"
if BITRIX_WEBHOOK == "/":
    sys.exit("Faltando BITRIX_WEBHOOK_URL no .env")

# Configurações do banco PostgreSQL (lidas do .env)
DB_CONFIG = {
    'host': os.getenv("DB_HOST"),
    'port': int(os.getenv("DB_PORT", "5432")),
    'dbname': os.getenv("DB_NAME"),
    'user': os.getenv("DB_USER"),
    'password': os.getenv("DB_PASSWORD"),
    'connect_timeout': 10,
    'application_name': 'atualizar_users'
}

def request_with_retry(url, json_params, max_retries=5):
    """Faz requisição HTTP com retry automático em caso de 429"""
    for attempt in range(max_retries):
        response = requests.post(url, json=json_params)
        if response.status_code == 429:
            wait_time = 2 ** attempt
            print(f"  Rate limit (429). Aguardando {wait_time}s... (tentativa {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue
        response.raise_for_status()
        return response
    response = requests.post(url, json=json_params)
    response.raise_for_status()
    return response


def fetch_all_users():
    """Busca todos os usuários do Bitrix24 com paginação"""
    all_users = []
    start = 0

    print("Coletando usuários do Bitrix24...")
    while True:
        url = f"{BITRIX_WEBHOOK}user.get"
        params = {
            "sort": "ID",
            "order": "ASC",
            "start": start
        }

        response = request_with_retry(url, params)
        data = response.json()
        users = data.get('result', [])
        all_users.extend(users)

        next_offset = data.get('next')
        if next_offset is None:
            break
        start = next_offset
        time.sleep(0.5)

    print(f"Total de usuários coletados: {len(all_users)}")
    return all_users


def get_table_columns(cur):
    """Consulta as colunas da tabela crm_users"""
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'Bitrix' AND table_name = 'crm_users'
        ORDER BY ordinal_position
    """)
    columns = cur.fetchall()
    return columns


def safe_str(value):
    if value is None or value == '':
        return None
    return str(value)


def safe_int(value):
    if value is None or value == '':
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def safe_bool(value):
    if value is None or value == '':
        return None
    if isinstance(value, bool):
        return value
    return str(value).lower() in ('true', '1', 'yes', 'y')


def main():
    start_time = time.time()

    # 1. Busca todos os usuários do Bitrix
    all_users = fetch_all_users()

    if not all_users:
        print("Nenhum usuário encontrado no Bitrix.")
        sys.exit(0)

    # Mostra campos disponíveis no primeiro usuário
    print(f"\nCampos disponíveis no Bitrix: {list(all_users[0].keys())}")

    # 2. Conecta ao banco
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("SET synchronous_commit = OFF")
        conn.commit()
        print("Conexão com o banco estabelecida!")
    except Exception as e:
        print(f"Erro ao conectar: {e}")
        sys.exit(1)

    # 3. Verifica estrutura da tabela
    columns = get_table_columns(cur)
    if columns:
        print(f"\nEstrutura atual da tabela crm_users ({len(columns)} colunas):")
        for col_name, data_type, nullable in columns:
            print(f"  {col_name}: {data_type} {'(nullable)' if nullable == 'YES' else '(not null)'}")
        col_names = [c[0] for c in columns]
    else:
        print("\nTabela crm_users não encontrada. Criando...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS "Bitrix".crm_users (
                id INTEGER PRIMARY KEY,
                name VARCHAR(255),
                last_name VARCHAR(255),
                second_name VARCHAR(255),
                full_name VARCHAR(512),
                email VARCHAR(255),
                personal_phone VARCHAR(100),
                personal_mobile VARCHAR(100),
                work_phone VARCHAR(100),
                work_position VARCHAR(255),
                uf_department TEXT,
                active BOOLEAN,
                date_register TIMESTAMP,
                last_login TIMESTAMP,
                last_activity_date TIMESTAMP,
                personal_city VARCHAR(255),
                personal_state VARCHAR(255),
                personal_country VARCHAR(10),
                personal_birthday VARCHAR(50),
                personal_gender VARCHAR(10),
                personal_photo VARCHAR(512),
                xml_id VARCHAR(255),
                user_type VARCHAR(50)
            )
        """)
        conn.commit()
        print("Tabela crm_users criada com sucesso!")
        col_names = [
            'id', 'name', 'last_name', 'second_name', 'full_name', 'email',
            'personal_phone', 'personal_mobile', 'work_phone', 'work_position',
            'uf_department', 'active', 'date_register', 'last_login',
            'last_activity_date', 'personal_city', 'personal_state',
            'personal_country', 'personal_birthday', 'personal_gender',
            'personal_photo', 'xml_id', 'user_type'
        ]

    # 4. Mapeia campos Bitrix -> colunas da tabela
    # Mapeamento padrão dos campos mais comuns do Bitrix user.get
    bitrix_to_db = {
        'id': lambda u: safe_int(u.get('ID')),
        'nome': lambda u: safe_str(
            f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip() or 'Sem nome'
        ),
        'email': lambda u: safe_str(u.get('EMAIL')),
        'active': lambda u: safe_bool(u.get('ACTIVE')),
        'work_position': lambda u: safe_str(u.get('WORK_POSITION')),
        'created_at': lambda u: safe_str(u.get('DATE_REGISTER')),
        'updated_at': lambda u: safe_str(u.get('LAST_ACTIVITY_DATE')) if isinstance(u.get('LAST_ACTIVITY_DATE'), str) else None,
        'empresa': lambda u: None,
    }

    # Filtra apenas colunas que existem na tabela
    active_cols = [c for c in col_names if c in bitrix_to_db]
    missing_cols = [c for c in col_names if c not in bitrix_to_db and c != 'id']

    if missing_cols:
        print(f"\nColunas na tabela sem mapeamento Bitrix (serão NULL): {missing_cols}")

    print(f"Colunas que serão atualizadas: {active_cols}")

    # 5. Prepara as rows
    rows = []
    for user in all_users:
        row = tuple(bitrix_to_db[col](user) for col in active_cols)
        rows.append(row)

    # 6. Upsert no banco
    update_cols = [c for c in active_cols if c != 'id']
    col_list = ', '.join(active_cols)
    update_set = ', '.join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = f"""
    INSERT INTO "Bitrix".crm_users ({col_list})
    VALUES %s
    ON CONFLICT (id) DO UPDATE SET {update_set}
    """

    batch_size = 500
    total_processed = 0

    print(f"\nInserindo/atualizando {len(rows)} usuários...")

    try:
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            execute_values(cur, sql, batch, page_size=batch_size)
            conn.commit()
            total_processed += len(batch)
            print(f"  Lote {i // batch_size + 1}: {total_processed}/{len(rows)} registros")

        elapsed = time.time() - start_time
        print(f"\nConcluído! {total_processed} usuários atualizados em {elapsed:.2f}s")

    except Exception as e:
        print(f"Erro ao inserir dados: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()
        print("Conexão fechada.")


if __name__ == '__main__':
    main()
