#!/usr/bin/env python3
"""Seed de cortex_core.bp2026_orcado a partir da planilha BP 2026.

Lê a aba Overview (linhas 4-6 e 8-9 = MRR Ativo, Receita Pontual, Outras Receitas,
Inadimplência, Impostos sobre Receita; colunas C..N = Janeiro..Dezembro) e gera
/tmp/seed-bp2026-orcado.sql.
Aborta se os totais lidos divergirem dos totais conhecidos da planilha.
"""
import openpyxl

XLSX = "BP 2026 - Turbo - Financials.xlsx"
LINHAS = {
    4: "mrr_ativo",
    5: "receita_pontual",
    6: "outras_receitas",
    8: "inadimplencia",
    9: "impostos_receita",
}
# Totais da coluna O da aba Overview, para verificação anti-drift
TOTAIS_ESPERADOS = {
    "mrr_ativo": 20998078.1,
    "receita_pontual": 4045000.0,
    "outras_receitas": 1040111.3,
    "inadimplencia": 1564991.4,
    "impostos_receita": 2422411.4,
}

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Overview"]

stmts = []
for row, metrica in LINHAS.items():
    valores = [ws.cell(row=row, column=col).value for col in range(3, 15)]  # C..N
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
