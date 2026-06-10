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
    ("Revenue", 7, "mrr_performance", 4),
    ("Revenue", 8, "aov_performance", 4),
    ("Revenue", 9, "contratos_performance", 4),
    ("Revenue", 10, "churn_pct_performance", 4),
    ("Revenue", 12, "mrr_creators", 4),
    ("Revenue", 13, "aov_creators", 4),
    ("Revenue", 14, "contratos_creators", 4),
    ("Revenue", 15, "churn_pct_creators", 4),
    ("Revenue", 17, "mrr_social", 4),
    ("Revenue", 18, "aov_social", 4),
    ("Revenue", 19, "contratos_social", 4),
    ("Revenue", 20, "churn_pct_social", 4),
    ("Revenue", 22, "mrr_gc", 4),
    ("Revenue", 23, "aov_gc", 4),
    ("Revenue", 24, "contratos_gc", 4),
    ("Revenue", 25, "churn_pct_gc", 4),
    ("Revenue", 27, "mrr_others", 4),
    ("Revenue", 28, "aov_others", 4),
    ("Revenue", 29, "contratos_others", 4),
    ("Revenue", 30, "churn_pct_others", 4),
    ("CAC", 69, "aov_venda_pontual", 17),
    ("CAC", 70, "aov_venda_mrr", 17),
    ("CAC", 71, "taxa_conversao", 17),
    ("CAC", 72, "reunioes_necessarias", 17),
    ("CSV", 13, "capacity_gestores", 4),
    ("CSV", 14, "gestores_necessarios", 4),
    ("CSV", 15, "gestores_atuais", 4),
    ("CSV", 17, "contratos_por_gestor", 4),
    ("CSV", 55, "capacity_designers", 4),
    ("CSV", 56, "designers_necessarios", 4),
    ("CSV", 57, "designers_atuais", 4),
    ("CSV", 59, "contas_por_designer", 4),
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
    "mrr_performance": 7426334.8933,
    "aov_performance": 34141.465714,
    "contratos_performance": 2604.204968,
    "churn_pct_performance": 1.08,
    "mrr_creators": 5004613.2318,
    "aov_creators": 56074.061264,
    "contratos_creators": 1063.612613,
    "churn_pct_creators": 1.08,
    "mrr_social": 4014651.4263,
    "aov_social": 26732.128216,
    "contratos_social": 1795.775497,
    "churn_pct_social": 1.08,
    "mrr_gc": 2634209.6604,
    "aov_gc": 108740.581448,
    "contratos_gc": 286.346478,
    "churn_pct_gc": 1.08,
    "mrr_others": 1918268.8799,
    "aov_others": 20565.197133,
    "contratos_others": 1112.449569,
    "churn_pct_others": 1.08,
    "aov_venda_pontual": 118080.0,
    "aov_venda_mrr": 51480.0,
    "taxa_conversao": 3.3,
    "reunioes_necessarias": 2918.7741306,
    "capacity_gestores": 144.0,
    "gestores_necessarios": 217.017081,
    "gestores_atuais": 258.0,
    "contratos_por_gestor": 121.090493,
    "capacity_designers": 312.0,
    "designers_necessarios": 100.16173,
    "designers_atuais": 111.0,
    "contas_por_designer": 281.36058,
}

# Métricas com células vazias na planilha (tratadas como 0). Ex.: Bônus só tem jan-mar.
PERMITE_VAZIO = {"bonus"}

wb = openpyxl.load_workbook(XLSX, data_only=True)

stmts = []
for entrada in LINHAS:
    aba, row, metrica = entrada[0], entrada[1], entrada[2]
    col_inicial = entrada[3] if len(entrada) > 3 else 3  # C; aba Revenue usa 4 (D)
    ws = wb[aba]
    valores = [ws.cell(row=row, column=col).value for col in range(col_inicial, col_inicial + 12)]
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
