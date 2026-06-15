#!/usr/bin/env python3
"""Seed do orçado de VENDAS POR PRODUTO em cortex_core.bp2026_orcado.

Lê a aba CAC da planilha BP 2026 (blocos "Aquisition Recorrente" e
"Aquisition Pontual", labels na coluna P, meses Jan..Dez nas colunas Q..AB)
e gera as métricas consumidas pela sub-aba "Vendas por Produto":

  vendas_mrr_<seg> / contratos_vendidos_mrr_<seg> / aov_venda_mrr_<seg>
  vendas_pontual_<seg> / contratos_vendidos_pontual_<seg> / aov_venda_pontual_<seg>

Segmentos recorrentes: performance, creators, social, gc, others.
Segmentos pontuais: ecommerce, site, landing, creators, crm, others (cada um lido
direto da linha correspondente da aba CAC).

Gera /tmp/seed-bp2026-vendas-produto-orcado.sql. Aborta se a soma por produto
divergir do total agregado (vendas_mrr=215k.., vendas_pontual=270k..).

Uso: python3 scripts/seed-bp2026-vendas-produto-orcado.py [caminho_xlsx]
"""
import sys
import openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else "BP 2026 - Turbo - Financials.xlsx"
ABA = "CAC"
COL_JAN = 17  # coluna Q (Janeiro); 12 meses até AB

# (metrica destino, linha 1-indexed na aba CAC)  — valores em colunas Q..AB
ROWS_DIRETAS = [
    # Recorrente
    ("vendas_mrr_performance", 9), ("aov_venda_mrr_performance", 10), ("contratos_vendidos_mrr_performance", 11),
    ("vendas_mrr_creators", 14), ("aov_venda_mrr_creators", 15), ("contratos_vendidos_mrr_creators", 16),
    ("vendas_mrr_social", 20), ("aov_venda_mrr_social", 21), ("contratos_vendidos_mrr_social", 22),
    ("vendas_mrr_gc", 25), ("aov_venda_mrr_gc", 26), ("contratos_vendidos_mrr_gc", 27),
    ("vendas_mrr_others", 30), ("aov_venda_mrr_others", 31), ("contratos_vendidos_mrr_others", 32),
    # Pontual nomeados (Creators e CRM separados; Others = só o bucket residual de 15%)
    ("vendas_pontual_ecommerce", 40), ("aov_venda_pontual_ecommerce", 41), ("contratos_vendidos_pontual_ecommerce", 42),
    ("vendas_pontual_site", 45), ("aov_venda_pontual_site", 46), ("contratos_vendidos_pontual_site", 47),
    ("vendas_pontual_landing", 50), ("aov_venda_pontual_landing", 51), ("contratos_vendidos_pontual_landing", 52),
    ("vendas_pontual_creators", 55), ("aov_venda_pontual_creators", 56), ("contratos_vendidos_pontual_creators", 57),
    ("vendas_pontual_crm", 60), ("aov_venda_pontual_crm", 61), ("contratos_vendidos_pontual_crm", 62),
    ("vendas_pontual_others", 65), ("aov_venda_pontual_others", 66), ("contratos_vendidos_pontual_others", 67),
]

# Totais agregados esperados por mês (anti-drift) — já existentes em bp2026_orcado.
VENDAS_MRR_TOTAL = [215000]*3 + [240000]*3 + [270000]*3 + [300000]*3
VENDAS_PONTUAL_TOTAL = [270000]*3 + [325000]*3 + [380000]*3 + [435000]*3

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb[ABA]

def ler(row):
    vals = [ws.cell(row=row, column=COL_JAN + k).value for k in range(12)]
    assert all(isinstance(v, (int, float)) for v in vals), f"linha {row}: célula não numérica: {vals}"
    return [float(v) for v in vals]

series = {}  # metrica -> [12]
for metrica, row in ROWS_DIRETAS:
    series[metrica] = ler(row)

# --- Verificação anti-drift: soma por produto == total agregado, mês a mês ---
def soma(prefixos, m):
    return sum(series[k][m] for k in series if any(k.startswith(p) for p in prefixos))

for m in range(12):
    smrr = soma(["vendas_mrr_"], m)
    spont = soma(["vendas_pontual_"], m)
    assert abs(smrr - VENDAS_MRR_TOTAL[m]) < 1, f"mes {m+1}: soma vendas_mrr {smrr:.0f} != {VENDAS_MRR_TOTAL[m]}"
    assert abs(spont - VENDAS_PONTUAL_TOTAL[m]) < 1, f"mes {m+1}: soma vendas_pontual {spont:.0f} != {VENDAS_PONTUAL_TOTAL[m]}"

# --- Gera SQL ---
stmts = []
for metrica, vals in series.items():
    stmts.append(f"DELETE FROM cortex_core.bp2026_orcado WHERE metrica = '{metrica}';")
    for mes, valor in enumerate(vals, 1):
        stmts.append(
            f"INSERT INTO cortex_core.bp2026_orcado (metrica, mes, valor) VALUES ('{metrica}', {mes}, {round(valor, 6)});"
        )

out = "/tmp/seed-bp2026-vendas-produto-orcado.sql"
with open(out, "w") as f:
    f.write("BEGIN;\n" + "\n".join(stmts) + "\nCOMMIT;\n")

print(f"OK: {len(series)} métricas, {len(stmts)} statements em {out}")
print("Anti-drift: soma por produto == total agregado em todos os 12 meses.")
