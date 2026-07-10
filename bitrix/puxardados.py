import os
import requests
import psycopg2
from psycopg2.extras import execute_values
import sys
import re
import time
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

# Webhook do Bitrix24 (lido do .env; mantem a barra final independente do valor)
BITRIX_WEBHOOK = (os.getenv("BITRIX_WEBHOOK_URL") or "").rstrip("/") + "/"
if BITRIX_WEBHOOK == "/":
    sys.exit("Faltando BITRIX_WEBHOOK_URL no .env")

# Limite da API Bitrix24: 2 requisições por segundo por webhook
REQUEST_TIMEOUT = 30  # Timeout em segundos para cada request HTTP
MIN_REQUEST_INTERVAL = 1.0  # 1 req/s — conservador para evitar 429 em sessões longas

all_deals = []

# Rate limiter global: garante no máximo 2 req/s
_last_request_time = 0

def rate_limited_request(url, json_params, max_retries=10):
    """Faz requisição HTTP respeitando o rate limit de 2 req/s do Bitrix24"""
    global _last_request_time

    for attempt in range(max_retries):
        # Aguarda para respeitar o rate limit
        now = time.time()
        elapsed = now - _last_request_time
        if elapsed < MIN_REQUEST_INTERVAL:
            time.sleep(MIN_REQUEST_INTERVAL - elapsed)

        try:
            _last_request_time = time.time()
            response = requests.post(url, json=json_params, timeout=REQUEST_TIMEOUT)
        except requests.exceptions.Timeout:
            wait_time = min(60, 2 ** attempt)
            print(f"  Timeout. Aguardando {wait_time}s... (tentativa {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue
        except requests.exceptions.ConnectionError:
            wait_time = min(60, 2 ** attempt)
            print(f"  Erro de conexão. Aguardando {wait_time}s... (tentativa {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue

        if response.status_code == 429:
            # Backoff exponencial com teto de 60s; força pausa extra no rate limiter
            wait_time = min(60, max(5, 2 ** attempt))
            print(f"  Rate limit (429). Aguardando {wait_time}s... (tentativa {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            # Empurra o próximo request para depois do wait, evitando disparo imediato
            _last_request_time = time.time()
            continue

        # Verifica erro QUERY_LIMIT_EXCEEDED no body (Bitrix pode retornar 200 com erro)
        try:
            body = response.json()
            if body.get('error') == 'QUERY_LIMIT_EXCEEDED':
                wait_time = min(60, max(5, 2 ** attempt))
                print(f"  QUERY_LIMIT_EXCEEDED. Aguardando {wait_time}s... (tentativa {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                _last_request_time = time.time()
                continue
        except Exception:
            pass

        response.raise_for_status()
        return response

    raise Exception(f"Falha após {max_retries} tentativas para {url}")


def batch_request(commands):
    """Executa múltiplos comandos via endpoint batch do Bitrix24.

    Cada chamada batch conta como 1 requisição no rate limit,
    mas pode conter até 50 comandos internos.

    Retorna dict {cmd_key: result_data} para cada comando.
    """
    url = f"{BITRIX_WEBHOOK}batch"
    payload = {
        "halt": 0,
        "cmd": commands
    }
    response = rate_limited_request(url, payload)
    data = response.json()

    # A estrutura da resposta do batch é:
    # { "result": { "result": { "cmd_key": [...], ... }, "result_error": {...}, ... } }
    # OU em algumas versões:
    # { "result": { "result": [ ... ] } }  (quando há apenas 1 comando)
    batch_result = data.get('result', {})

    if isinstance(batch_result, dict):
        inner = batch_result.get('result', {})
        # Checa erros do batch
        result_error = batch_result.get('result_error', {})
        if result_error:
            print(f"  Erros no batch: {result_error}")

        if isinstance(inner, dict):
            return inner
        # Se inner é lista, mapeia de volta pelas chaves dos comandos
        if isinstance(inner, list):
            keys = list(commands.keys())
            return {keys[i]: inner[i] for i in range(min(len(keys), len(inner)))}

    # Fallback: loga estrutura inesperada para debug
    print(f"  [DEBUG] Estrutura batch inesperada: type(result)={type(batch_result).__name__}, keys={list(batch_result.keys()) if isinstance(batch_result, dict) else 'N/A'}")
    return {}


def encode_params(method, params_dict):
    """Codifica parâmetros para uso no comando batch (formato query string)"""
    parts = []
    for key, value in params_dict.items():
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                parts.append(f"{key}[{sub_key}]={urllib.parse.quote(str(sub_value))}")
        elif isinstance(value, list):
            for item in value:
                parts.append(f"{key}[]={urllib.parse.quote(str(item))}")
        else:
            parts.append(f"{key}={urllib.parse.quote(str(value))}")
    qs = "&".join(parts)
    return f"{method}?{qs}" if qs else method


# ========================
# 1. COLETA DE DEALS (paginação sequencial respeitando 2 req/s)
# ========================
print("Coletando deals do Bitrix24...")
start_time = time.time()

deal_url = f"{BITRIX_WEBHOOK}crm.deal.list"
deal_params = {
    'order': {'ID': 'ASC'},
    'select': ['*', 'UF_*'],
    'start': 0
}

page = 0
while True:
    response = rate_limited_request(deal_url, deal_params)
    data = response.json()
    deals = data.get('result', [])
    all_deals.extend(deals)
    page += 1

    total = data.get('total', len(all_deals))
    if page % 20 == 0 or data.get('next') is None:
        print(f"  Página {page}: {len(all_deals)}/{total} deals coletados")

    next_offset = data.get('next')
    if next_offset is None:
        break
    deal_params['start'] = next_offset

collection_time = time.time() - start_time
print(f"Total de deals coletados: {len(all_deals)} em {collection_time:.2f}s")

# ========================
# 2. CONEXÃO COM O BANCO
# ========================
try:
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=10,
        application_name='puxardados_optimized'
    )
    cur = conn.cursor()
    cur.execute("SET synchronous_commit = OFF")
    conn.commit()
    print("Conexão com o banco estabelecida com sucesso!")
except Exception as e:
    print(f"Erro ao conectar com o banco: {e}")
    sys.exit(1)

# ========================
# 3. FUNÇÕES AUXILIARES
# ========================
def safe_int(value):
    if value is None or value == '':
        return None
    try:
        clean_value = re.sub(r'[^\d\-]', '', str(value))
        if clean_value == '' or clean_value == '-':
            return None
        return int(clean_value)
    except (ValueError, TypeError):
        return None

def safe_str(value, max_len=None):
    if value is None or value == '':
        return None
    s = str(value)
    if max_len and len(s) > max_len:
        return s[:max_len]
    return s

def safe_numeric_field(value):
    if value is None or value == '':
        return None
    try:
        str_value = str(value).strip()
        if not str_value:
            return None
        clean_value = re.sub(r'[^\d\.\,\-]', '', str_value)
        if not clean_value or clean_value in ['-', '.', ',']:
            return None
        clean_value = clean_value.replace(',', '.')
        if clean_value.count('.') > 1:
            parts = clean_value.split('.')
            clean_value = ''.join(parts[:-1]) + '.' + parts[-1]
        try:
            float_val = float(clean_value)
            return int(float_val) if float_val.is_integer() else float_val
        except ValueError:
            digits_only = re.sub(r'[^\d]', '', str_value)
            return int(digits_only) if digits_only else None
    except Exception:
        return None

# ========================
# 4. CACHES DE REFERÊNCIA
# ========================
company_cache = {}
contact_cache = {}
user_cache = {}
category_cache = {}
stage_cache = {}


def load_reference_data_batch():
    """Carrega users, categories e stages em um único batch request"""
    print("Carregando dados de referência (users, categories, stages)...")

    commands = {
        "users": encode_params("user.get", {"SELECT": ["ID", "NAME", "LAST_NAME"]}),
        "categories": encode_params("crm.dealcategory.list", {"SELECT": ["ID", "NAME"]}),
        "stages": "crm.status.list",
    }

    results = batch_request(commands)

    # Processa users
    users = results.get('users', [])
    if isinstance(users, list):
        for user in users:
            user_id = int(user.get('ID', 0))
            name = user.get('NAME', '')
            last_name = user.get('LAST_NAME', '')
            full_name = f"{name} {last_name}".strip()
            user_cache[user_id] = full_name if full_name else None
    print(f"  Carregados {len(user_cache)} usuários")

    # Processa categories
    categories = results.get('categories', [])
    if isinstance(categories, list):
        for category in categories:
            category_id = int(category.get('ID', 0))
            cat_name = category.get('NAME', f"Categoria {category_id}")
            category_cache[category_id] = cat_name
    category_cache[0] = "Geral"
    print(f"  Carregadas {len(category_cache)} categorias")

    # Processa stages
    stages = results.get('stages', [])
    if isinstance(stages, list):
        for stage in stages:
            stage_id = stage.get('STATUS_ID')
            stage_name = stage.get('NAME', stage_id)
            if stage_id:
                stage_cache[stage_id] = stage_name
    print(f"  Carregados {len(stage_cache)} stages")


def load_companies_and_contacts():
    """Carrega empresas e contatos usando batch requests"""
    print("Coletando IDs únicos de empresas e contatos...")

    company_ids = set()
    contact_ids = set()

    for deal in all_deals:
        cid = safe_int(deal.get('COMPANY_ID'))
        tid = safe_int(deal.get('CONTACT_ID'))
        if cid and cid > 0:
            company_ids.add(cid)
        if tid and tid > 0:
            contact_ids.add(tid)

    print(f"  {len(company_ids)} empresas únicas, {len(contact_ids)} contatos únicos")

    # Monta comandos batch misturando empresas e contatos (até 50 por batch)
    # Cada comando busca um lote de IDs
    company_id_list = list(company_ids)
    contact_id_list = list(contact_ids)

    # Divide IDs em lotes de 50 (limite do filtro do Bitrix)
    company_batches = [company_id_list[i:i + 50] for i in range(0, len(company_id_list), 50)]
    contact_batches = [contact_id_list[i:i + 50] for i in range(0, len(contact_id_list), 50)]

    # Combina todos os comandos e envia em batches de 50
    all_commands = []
    for idx, batch_ids in enumerate(company_batches):
        # Monta query string manualmente para arrays de IDs
        id_params = "&".join(f"filter[ID][]={cid}" for cid in batch_ids)
        cmd = f"crm.company.list?select[]=ID&select[]=TITLE&{id_params}"
        all_commands.append(("company", idx, cmd))

    for idx, batch_ids in enumerate(contact_batches):
        id_params = "&".join(f"filter[ID][]={cid}" for cid in batch_ids)
        cmd = f"crm.contact.list?select[]=ID&select[]=NAME&select[]=LAST_NAME&{id_params}"
        all_commands.append(("contact", idx, cmd))

    # Envia em batches de até 50 comandos
    for batch_start in range(0, len(all_commands), 50):
        batch_cmds = all_commands[batch_start:batch_start + 50]
        commands = {}
        for entity_type, idx, cmd in batch_cmds:
            commands[f"{entity_type}_{idx}"] = cmd

        results = batch_request(commands)

        for cmd_key, result in results.items():
            if not isinstance(result, list):
                continue
            if cmd_key.startswith("company_"):
                for item in result:
                    cid = int(item.get('ID', 0))
                    company_cache[cid] = item.get('TITLE')
            elif cmd_key.startswith("contact_"):
                for item in result:
                    cid = int(item.get('ID', 0))
                    name = item.get('NAME', '')
                    last_name = item.get('LAST_NAME', '')
                    full_name = f"{name} {last_name}".strip()
                    contact_cache[cid] = full_name if full_name else None

    # Marca não encontrados
    for cid in company_ids:
        if cid not in company_cache:
            company_cache[cid] = None
    for cid in contact_ids:
        if cid not in contact_cache:
            contact_cache[cid] = None

    print(f"  Carregados {len(company_cache)} empresas e {len(contact_cache)} contatos")


def get_company_name(company_id):
    if not company_id or company_id == 0:
        return None
    return company_cache.get(company_id)

def get_contact_name(contact_id):
    if not contact_id or contact_id == 0:
        return None
    return contact_cache.get(contact_id)

def get_user_name(user_id):
    if not user_id or user_id == 0:
        return None
    return user_cache.get(user_id)

def get_category_name(category_id):
    if not category_id or category_id == 0:
        return "Geral"
    return category_cache.get(category_id, f"Categoria {category_id}")

def get_stage_name(stage_id):
    if not stage_id:
        return None
    return stage_cache.get(stage_id, stage_id)


# ========================
# 5. CARREGA REFERÊNCIAS
# ========================
reference_start = time.time()
load_reference_data_batch()      # 1 requisição batch (users + categories + stages)
load_companies_and_contacts()    # N requisições batch (empresas + contatos juntos)
reference_time = time.time() - reference_start
print(f"Dados de referência carregados em {reference_time:.2f}s!")

# ========================
# 6. PROCESSAMENTO DOS DEALS
# ========================
print("Processando deals...")
processing_start = time.time()

rows = []
for i, deal in enumerate(all_deals):
    if (i + 1) % 1000 == 0:
        elapsed = time.time() - processing_start
        rate = (i + 1) / elapsed if elapsed > 0 else 0
        print(f"  Processando deal {i + 1}/{len(all_deals)} - Taxa: {rate:.1f} deals/s")

    company_id = safe_int(deal.get('COMPANY_ID'))
    contact_id = safe_int(deal.get('CONTACT_ID'))

    company_name = get_company_name(company_id) if company_id else None
    contact_name = get_contact_name(contact_id) if contact_id else None
    created_by_name = get_user_name(safe_int(deal.get('CREATED_BY_ID')))
    modified_by_name = get_user_name(safe_int(deal.get('MODIFY_BY_ID')))
    assigned_by_name = get_user_name(safe_int(deal.get('ASSIGNED_BY_ID')))
    category_name = get_category_name(safe_int(deal.get('CATEGORY_ID')))
    stage_name = get_stage_name(safe_str(deal.get('STAGE_ID')))

    sdr = safe_str(deal.get('UF_CRM_1752257983'), 255)
    closer = safe_str(deal.get('UF_CRM_1753386868'), 255)
    data_reuniao_realizada = deal.get('UF_CRM_1755642298') or None
    data_reuniao_agendada = deal.get('UF_CRM_1753386683') or None
    produtos = safe_str(deal.get('UF_CRM_1755009751812'), 255)
    servicos_vendidos = safe_str(deal.get('UF_CRM_1755009751812'), 255)
    faturamento_mensal = deal.get('UF_CRM_1753388872')
    lp_conversao = safe_str(deal.get('UF_CRM_1753388753'), 255)
    fonte = safe_str(deal.get('UF_CRM_1753388753'), 255)
    valor_pontual = safe_numeric_field(deal.get('UF_CRM_1752256743002'))
    valor_recorrente = safe_numeric_field(deal.get('UF_CRM_1752256871802'))
    segmento = safe_str(deal.get('UF_CRM_1753447931'), 255)
    mql = safe_str(deal.get('UF_CRM_1753387697'), 255)
    fnl_ngc = safe_str(deal.get('UF_CRM_1753388612'), 255)
    source = safe_str(deal.get('SOURCE_ID'), 255)
    data_fechamento = deal.get('CLOSEDATE')
    utm_source = safe_str(deal.get('UTM_SOURCE'), 255)
    utm_medium = safe_str(deal.get('UTM_MEDIUM'), 255)
    utm_campaign = safe_str(deal.get('UTM_CAMPAIGN'), 255)
    utm_term = safe_str(deal.get('UTM_TERM'), 255)
    utm_content = safe_str(deal.get('UTM_CONTENT'), 255)
    fbclid = safe_str(deal.get('UF_CRM_FBCLID'), 255)
    gclid = safe_str(deal.get('UF_CRM_GCLID'), 255)
    referrer = safe_str(deal.get('UF_CRM_REFERRER'), 255)
    user_agent = safe_str(deal.get('UF_CRM_USER_AGENT'), 255)
    ip_address = safe_str(deal.get('UF_CRM_IP_ADDRESS'), 45)
    cnpj = safe_str(deal.get('UF_CRM_1752258644136'), 18)

    deal_id = safe_numeric_field(deal.get('ID'))
    created_by_id = safe_numeric_field(deal.get('CREATED_BY_ID'))
    modify_by_id = safe_numeric_field(deal.get('MODIFY_BY_ID'))
    assigned_by_id = safe_numeric_field(deal.get('ASSIGNED_BY_ID'))
    category_id = safe_numeric_field(deal.get('CATEGORY_ID'))
    date_create = safe_str(deal.get('DATE_CREATE'))
    date_modify = safe_str(deal.get('DATE_MODIFY'))
    title = safe_str(deal.get('TITLE'), 255)
    stage_semantic = safe_str(deal.get('STAGE_SEMANTIC'), 50)
    comments = safe_str(deal.get('COMMENTS'))  # coluna TEXT, sem truncamento

    row = (
        deal_id, date_create, date_modify, created_by_id, created_by_name, created_by_name,
        modify_by_id, modified_by_name, modified_by_name, assigned_by_id, assigned_by_name, assigned_by_name,
        company_id, company_name, company_name, contact_id, contact_name, contact_name,
        title, category_id, category_name, category_name, None, stage_name, stage_name,
        stage_semantic, comments, date_create, date_modify, data_reuniao_realizada, data_reuniao_agendada,
        faturamento_mensal, lp_conversao, fonte, valor_pontual, valor_recorrente,
        segmento, fnl_ngc, sdr, closer, mql, source, data_fechamento, utm_source, utm_campaign, utm_term, utm_content,
        produtos, cnpj, utm_medium, fbclid, gclid, referrer, user_agent, ip_address,
        servicos_vendidos
    )
    rows.append(row)

processing_time = time.time() - processing_start
total_rate = len(all_deals) / processing_time if processing_time > 0 else 0
print(f"Processamento concluído em {processing_time:.2f}s - Taxa final: {total_rate:.1f} deals/s")

# ========================
# 7. INSERÇÃO NO BANCO
# ========================
sql = """
INSERT INTO "Bitrix".crm_deal (
    id, date_create, date_modify, created_by_id, created_by_name, created_by,
    modify_by_id, modified_by_name, modified_by, assigned_by_id, assigned_by_name, assigned_by,
    company_id, company_name, company, contact_id, contact_name, contact,
    title, category_id, category_name, category, stage_id, stage_name, stage,   
    stage_semantic, comments, created_at, updated_at, data_reuniao_realizada, data_reuniao_agendada,
    faturamento_mensal, lp_conversao, fonte, valor_pontual, valor_recorrente,
    segmento, fnl_ngc, sdr, closer, mql, source, data_fechamento, utm_source, utm_campaign, utm_term, utm_content,
    produtos, cnpj, utm_medium, fbclid, gclid, referrer, user_agent, ip,
    servicos_vendidos
)
VALUES %s
"""

batch_size = 1000
total_processed = 0

print("Apagando registros do Bitrix (preservando deals do Synapse)...")
db_start = time.time()

try:
    cur.execute("""ALTER TABLE "Bitrix".crm_deal ADD COLUMN IF NOT EXISTS servicos_vendidos VARCHAR(255)""")
    conn.commit()
    print("  Coluna servicos_vendidos garantida.")

    # Não usar TRUNCATE: os deals do Synapse (source='SYNAPSE', com synapse_id)
    # convivem nesta tabela e NÃO vêm do Bitrix — o TRUNCATE os apagaria a cada
    # rodada. IS DISTINCT FROM trata source NULL como valor comparável (há ~402
    # deals do Bitrix com source NULL); um "source <> 'SYNAPSE'" simples os deixaria
    # órfãos e o re-INSERT quebraria por duplicate key (id é PK).
    cur.execute("""DELETE FROM "Bitrix".crm_deal WHERE source IS DISTINCT FROM 'SYNAPSE'""")
    deleted = cur.rowcount
    conn.commit()
    print(f"  {deleted} registros do Bitrix apagados (deals do Synapse preservados).")

    print(f"Iniciando inserção no banco de dados em lotes de {batch_size}...")
    for i in range(0, len(rows), batch_size):
        batch_start = time.time()
        batch = rows[i:i + batch_size]
        execute_values(cur, sql, batch, page_size=batch_size)
        conn.commit()

        total_processed += len(batch)
        batch_time = time.time() - batch_start
        batch_rate = len(batch) / batch_time if batch_time > 0 else 0
        print(f"  Lote {i // batch_size + 1}: {total_processed}/{len(rows)} registros - {batch_rate:.1f} deals/s")

    db_time = time.time() - db_start
    db_rate = len(rows) / db_time if db_time > 0 else 0

    print(f"Dados inseridos/atualizados com sucesso!")
    print(f"Total de registros processados: {total_processed}")
    print(f"Tempo de inserção no banco: {db_time:.2f}s - Taxa: {db_rate:.1f} deals/s")

    total_time = time.time() - start_time
    overall_rate = len(all_deals) / total_time if total_time > 0 else 0
    print(f"\n=== ESTATÍSTICAS FINAIS ===")
    print(f"Tempo total de execução: {total_time:.2f}s")
    print(f"Taxa geral de processamento: {overall_rate:.1f} deals/s")

except Exception as e:
    print(f"Erro ao inserir dados: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
    print("Conexão com o banco fechada.")