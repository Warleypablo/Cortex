#!/usr/bin/env python3
"""Seed de cortex_core.bp2026_orcado a partir da planilha BP 2026.

Lê linhas de orçamento de várias abas (colunas C..N = Janeiro..Dezembro)
e gera /tmp/seed-bp2026-orcado.sql. Aborta se os totais lidos divergirem
dos totais conhecidos da planilha.
"""
import openpyxl

XLSX = "BP 2026 - Turbo - Financials.xlsx"
# (aba, linha, metrica)
LINHAS = [
    ("Overview", 4, "mrr_ativo"),
    ("Overview", 5, "receita_pontual"),
    ("Overview", 6, "outras_receitas"),
    ("Overview", 8, "inadimplencia"),
    ("Overview", 9, "impostos_receita"),
    ("Overview", 11, "csv_salarios"),
    ("Overview", 12, "csv_beneficio"),
    ("Overview", 13, "csv_stack"),
    ("Overview", 15, "cac"),
    ("Overview", 16, "sga"),
    ("Overview", 17, "bonus"),
    ("Overview", 19, "impostos_diretos"),
    ("Overview", 20, "capex"),
    ("Overview", 25, "receita_total"),
    ("Overview", 26, "despesa_total"),
    ("Overview", 27, "vendas_mrr"),
    ("Overview", 28, "vendas_pontual"),
    ("Overview", 29, "colaboradores"),
    ("Overview", 30, "receita_cabeca"),
    ("Overview", 31, "mrr_cabeca"),
    ("Overview", 32, "clientes"),
    ("Overview", 33, "contratos"),
    ("Overview", 34, "ticket_cliente"),
    ("Overview", 35, "ticket_contrato"),
    ("Overview", 36, "churn_mes"),
    ("Overview", 37, "aliquota_efetiva"),
    ("Overview", 39, "margem_geracao"),
    ("Overview", 40, "saldo_caixa"),
    ("Overview", 43, "pessoas_csv"),
    ("Overview", 44, "pessoas_cac"),
    ("Overview", 45, "pessoas_sgea"),
    ("SG&A", 11, "beneficio_total_empresa"),  # denominador do rateio do benefício
]
# Totais conhecidos da planilha, para verificação anti-drift
TOTAIS_ESPERADOS = {
    "mrr_ativo": 20998078.1,
    "receita_pontual": 4045000.0,
    "outras_receitas": 1040111.3,
    "inadimplencia": 1564991.4,
    "impostos_receita": 2422411.4,
    "csv_salarios": 6314099.1,
    "csv_beneficio": 481200.0,
    "csv_stack": 565344.0,
    "cac": 4449113.7,
    "sga": 2688672.0,
    "bonus": 100000.0,
    "impostos_diretos": 2583101.7,
    "capex": 420000.0,
    "receita_total": 24518198.06,
    "despesa_total": 20023941.87,
    "vendas_mrr": 3075000.0,
    "vendas_pontual": 4230000.0,
    "colaboradores": 1704.0,
    "receita_cabeca": 181563.68,
    "mrr_cabeca": 146258.20,
    "clientes": 5231.49,
    "contratos": 7246.86,
    "ticket_cliente": 59490.94,
    "ticket_contrato": 42974.33,
    "churn_mes": 1889827.03,
    "aliquota_efetiva": 2.27,
    "margem_geracao": 1.96,
    "saldo_caixa": 28936413.23,
    "pessoas_csv": 1203.0,
    "pessoas_cac": 359.0,
    "pessoas_sgea": 142.0,
    "beneficio_total_empresa": 736000.0,
}

# Métricas com células vazias na planilha (tratadas como 0). Ex.: Bônus só tem jan-mar.
PERMITE_VAZIO = {"bonus"}

wb = openpyxl.load_workbook(XLSX, data_only=True)

stmts = []
for aba, row, metrica in LINHAS:
    ws = wb[aba]
    valores = [ws.cell(row=row, column=col).value for col in range(3, 15)]  # C..N
    if metrica in PERMITE_VAZIO:
        valores = [v if isinstance(v, (int, float)) else 0 for v in valores]
    assert all(isinstance(v, (int, float)) for v in valores), f"{metrica}: célula vazia/não numérica: {valores}"
    total = sum(valores)
    esperado = TOTAIS_ESPERADOS[metrica]
    tol = 0.01 if esperado < 10 else 1
    assert abs(total - esperado) < tol, f"{metrica}: total lido {total:.2f} != esperado {esperado:.2f}"
    stmts.append(f"DELETE FROM cortex_core.bp2026_orcado WHERE metrica = '{metrica}';")
    for mes, valor in enumerate(valores, 1):
        stmts.append(
            f"INSERT INTO cortex_core.bp2026_orcado (metrica, mes, valor) VALUES ('{metrica}', {mes}, {round(valor, 6)});"
        )

with open("/tmp/seed-bp2026-orcado.sql", "w") as f:
    f.write("BEGIN;\n" + "\n".join(stmts) + "\nCOMMIT;\n")

print(f"OK: {len(stmts)} statements em /tmp/seed-bp2026-orcado.sql")
