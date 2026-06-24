import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta, date
import requests
import random
import time
import textwrap
from decimal import Decimal, InvalidOperation
from dotenv import load_dotenv

# Carregar variáveis do .env
load_dotenv()

# Conectar ao banco
conn = psycopg2.connect(
    host=os.getenv("PG_HOST"),
    dbname=os.getenv("PG_DBNAME"),
    user=os.getenv("PG_USER"),
    password=os.getenv("PG_PASSWORD"),
    port=os.getenv("PG_PORT")
)

cursor = conn.cursor(cursor_factory=RealDictCursor)

# Lista de telefones (somente digitos) para ignorar no envio
SKIP_NUMEROS = {
    "5527981111621",
    "5527997081791",
    "5527998989705",
    "5551993251413",
    "5531988120000",
}

def normalizar_numero(numero):
    return "".join(ch for ch in str(numero) if ch.isdigit())

def formatar_valor_br(valor):
    if valor is None:
        return ""
    try:
        if isinstance(valor, Decimal):
            valor_num = valor
        else:
            s = str(valor).strip()
            s = s.replace("R$", "").replace(" ", "")
            if "," in s and "." in s:
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", ".")
            valor_num = Decimal(s)
        valor_num = valor_num.quantize(Decimal("0.01"))
        s = f"{valor_num:,.2f}"
        return s.replace(",", "X").replace(".", ",").replace("X", ".")
    except (InvalidOperation, ValueError):
        return str(valor)

# Configuração de teste: DRY_RUN=true evita envio real
DRY_RUN = str(os.getenv("DRY_RUN", "false")).strip().lower() == "true"

# Função para enviar mensagem
def enviar_mensagem(cliente, mensagem, tipo_cobranca):
    numero_cliente = cliente['telefone'].replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    nome_cliente = str(cliente['cliente_nome'])  # nome do cliente buscado em caz_clientes
    valor = cliente['total']
    valor_formatado = formatar_valor_br(valor)
    # Formata data de vencimento aceitando date, datetime ou string ISO
    dv = cliente['data_vencimento']
    if isinstance(dv, (datetime, date)):
        vencimento = dv.strftime("%d/%m/%Y")
    else:
        try:
            vencimento = datetime.fromisoformat(str(dv)).strftime("%d/%m/%Y")
        except Exception:
            vencimento = str(dv)
    link_pagamento = cliente['link_pagamento']
    data_limite = datetime.now().strftime('%d/%m/%Y')
    hora_limite_env = os.getenv('HORA_LIMITE', '')
    hora_limite = hora_limite_env.strip() if hora_limite_env else datetime.now().strftime('%Hh')

    mensagem_formatada = mensagem.format(nome=nome_cliente, valor=valor_formatado, vencimento=vencimento, link_pagamento=link_pagamento, data_limite=data_limite, hora_limite=hora_limite)

    payload = {
        "number": numero_cliente,
        "options": {"delay": 100, "presence": "composing", "linkPreview": True},
        "text": mensagem_formatada
    }

    if DRY_RUN:
        print("[DRY_RUN] -> NÂO enviando. Pré-visualização:")
        print({
            'to': numero_cliente,
            'nome': nome_cliente,
            'valor': valor_formatado,
            'vencimento': vencimento,
            'link': link_pagamento,
            'texto': mensagem_formatada[:200] + ('...' if len(mensagem_formatada) > 200 else '')
        })
        return

    try:
        response = requests.post(
            f"https://{os.getenv('EVOLUTION_SERVER_URL')}/message/sendText/{os.getenv('EVOLUTION_INSTANCE_ID')}",
            json=payload,
            headers={"apikey": os.getenv('EVOLUTION_TOKEN'), "Content-Type": "application/json"}
        )
        if response.status_code in [200, 201]:
            print(f"✅ Mensagem enviada para {nome_cliente} ({numero_cliente}) com sucesso!")
        else:
            print(f"❌ Erro ao enviar para {nome_cliente}: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Erro ao tentar enviar para {nome_cliente}: {e}")

# Função para buscar clientes com vencimentos específicos
def buscar_clientes(data_vencimento):
    query = """
        SELECT DISTINCT ON (p.id_cliente, p.data_vencimento)
            p.id_cliente AS id_cliente,
            c.nome AS cliente_nome,
            cup.telefone,
            p.data_vencimento,
            p.nao_pago AS total,
            p.url_cobranca AS link_pagamento,
            p.status
        FROM "Conta Azul".caz_parcelas p
        INNER JOIN "Conta Azul".caz_clientes c ON c.ids = p.id_cliente::text
        INNER JOIN "Clickup".cup_clientes cup
            ON regexp_replace(cup.cnpj::text, '[^0-9]', '', 'g')
             = regexp_replace(c.cnpj::text, '[^0-9]', '', 'g')
        WHERE p.data_vencimento = %s
          AND p.nao_pago > 0
          AND cup.telefone IS NOT NULL
        ORDER BY p.id_cliente, p.data_vencimento
    """
    cursor.execute(query, (data_vencimento,))
    return cursor.fetchall()

# Mensagens de vencimento para diferentes períodos (agendadas por D- / D+)
def _msg(texto):
    return textwrap.dedent(texto).strip()

mensagens_agendadas = {
    "D-3": _msg("""
        Olá {nome}, tudo certo? \n
        Este é apenas um lembrete de que a fatura referente ao período vigente possui vencimento previsto para {vencimento}.\n
        segue o link para facilitar:
        {link_pagamento}
        Permanecemos à disposição para qualquer esclarecimento.
    """),
    "D+0": _msg("""
        Olá! {nome}, tudo certo? \n
        Passando aqui só pra avisar que o boleto da Turbo no valor de R$ {valor} vence hoje.\n
        Segue o link pra facilitar: {link_pagamento}\n
        Qualquer dúvida, estamos à disposição.\n
        \nEstamos cientes de que o vencimento caiu em um dia não útil. O pagamento no próximo dia útil não gerará multas nem encargos.
        — Time Financeiro | Turbo Partners
    """),
    "D+3": _msg("""
        Oi {nome}, tudo certo?\n

        venceu o boleto da Turbo (R$ {valor}, vencimento em {vencimento}), e ainda não localizamos o pagamento por aqui.\n
        Caso já tenha pago, é só nos enviar o comprovante por aqui.\n
        Se ainda não conseguiu, segue o link pra facilitar:\n
        {link_pagamento}\n

        Importante: caso a pendência não seja regularizada até o 7º dia após o vencimento, os serviços serão pausados automaticamente até a quitação.
        Qualquer dúvida, estamos à disposição.

        — Time Financeiro | Turbo Partners
    """),
    "D+7": _msg("""
        Prezado(a), {nome}\n

        Verificamos a manutenção da inadimplência referente à fatura vencida em {vencimento} no valor de R$ {valor}.\n
        Assim, informamos que, conforme previsto contratualmente e em nossas rotinas operacionais, as operações e serviços vinculados ao contrato encontram-se temporariamente suspensos, permanecendo assim até a confirmação da regularização do pagamento.\n
        Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
        {link_pagamento}\n
        Qualquer dúvida, estamos à disposição.\n

        — Time Financeiro | Turbo Partners
    """),
    "D+10": _msg("""
        Prezado(a), {nome}\n

        A inadimplência referente ao contrato permanece sem regularização até o presente momento.\n
        Informamos que, caso a situação persista, poderá ser adotado o procedimento de rescisão contratual, nos termos previstos no instrumento firmado entre as partes.\n
        Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
        {link_pagamento}\n
        Qualquer dúvida, estamos à disposição.\n

        — Time Financeiro | Turbo Partners
    """),
    "D+15": _msg("""
        Prezado(a), {nome}\n

        Diante da continuidade da inadimplência do boleto vencido em {vencimento} no valor de R$ {valor}, informamos que o contrato encontra-se em fase de encerramento administrativo, em razão do descumprimento das obrigações financeiras assumidas.\n
        Na ausência de regularização, o cancelamento contratual será efetivado, conforme previsto contratualmente.\n
        Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
        {link_pagamento}\n
        Qualquer dúvida, estamos à disposição.\n

        — Time Financeiro | Turbo Partners
    """),
    "D+20": _msg("""
        Prezado(a), {nome}\n

        Informamos que, diante da ausência de regularização do débito vencido em {vencimento} no valor de R$ {valor}, o contrato foi cancelado, nos termos do instrumento contratual firmado.\n
        O débito permanece exigível e passível de cobrança pelos meios administrativos e legais cabíveis.\n
        Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
        {link_pagamento} \n       Qualquer dúvida, estamos à disposição.\n

        — Time Financeiro | Turbo Partners
    """),
}

# Buscar clientes e enviar mensagens
for dias, mensagem in mensagens_agendadas.items():
    # Corrige a lógica: D-3 deve ser daqui a 3 dias (futuro), D+N é dias após vencimento (passado), D+0 é hoje
    if "D+" in dias:
        dias_num = int(dias.split("+")[1])  # Para "D+0", "D+1", etc.
        data_vencimento = (datetime.now() - timedelta(days=dias_num)).strftime("%Y-%m-%d")
    elif "D-" in dias:
        dias_num = int(dias.split("-")[1])  # Para "D-3", etc.
        data_vencimento = (datetime.now() + timedelta(days=dias_num)).strftime("%Y-%m-%d")
    else:
        data_vencimento = datetime.now().strftime("%Y-%m-%d")

    clientes = buscar_clientes(data_vencimento)

    # Garante apenas uma mensagem por cliente por data
    if clientes:
        vistos = set()
        unicos = []
        for c in clientes:
            chave = (c.get('id_cliente'), c.get('data_vencimento'))
            if chave in vistos:
                continue
            vistos.add(chave)
            unicos.append(c)
        clientes = unicos

    if clientes:
        for cliente in clientes:
            if cliente['status'] == 'ACQUITTED':
                print(f"💳 Boleto já pago para cliente {cliente['cliente_nome']}. Ignorando.")
                continue

            numero_normalizado = normalizar_numero(cliente.get('telefone'))
            if numero_normalizado in SKIP_NUMEROS:
                print(f"Pulando cliente {cliente['cliente_nome']} ({cliente.get('telefone')}).")
                continue

            enviar_mensagem(cliente, mensagem, dias)
            delay = random.uniform(10, 20)
            print(f"⏰ Aguardando {delay:.2f} segundos antes do próximo envio...")
            time.sleep(delay)
    else:
        print(f"Nenhum cliente encontrado com vencimento em {data_vencimento}.")

# Fechar conexões
cursor.close()
conn.close()
