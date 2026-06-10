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
    assert abs(total - esperado) < 1, f"{metrica}: total lido {total:.1f} != esperado {esperado:.1f}"
    stmts.append(f"DELETE FROM cortex_core.bp2026_orcado WHERE metrica = '{metrica}';")
    for mes, valor in enumerate(valores, 1):
        stmts.append(
            f"INSERT INTO cortex_core.bp2026_orcado (metrica, mes, valor) VALUES ('{metrica}', {mes}, {round(valor, 2)});"
        )

with open("/tmp/seed-bp2026-orcado.sql", "w") as f:
    f.write("BEGIN;\n" + "\n".join(stmts) + "\nCOMMIT;\n")

print(f"OK: {len(stmts)} statements em /tmp/seed-bp2026-orcado.sql")
