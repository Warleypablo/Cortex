import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";

interface DRELineItem {
  categoria_id: string;
  categoria_nome: string;
  grupo: string;
  grupo_nome: string;
  tipo: 'receita' | 'despesa';
  valores: Record<string, number>; // mes_01..mes_12 + acumulado
}

interface DREResponse {
  ano: number;
  empresa: string;
  linhas: DRELineItem[];
  subtotais: {
    receita_bruta_operacional: Record<string, number>;
    receitas_nao_operacionais: Record<string, number>;
    receita_bruta_total: Record<string, number>;
    custos_operacionais: Record<string, number>;
    lucro_bruto: Record<string, number>;
    despesas_operacionais: Record<string, number>;
    resultado_operacional: Record<string, number>;
    despesas_nao_operacionais: Record<string, number>;
    resultado_liquido: Record<string, number>;
  };
}

const GRUPO_MAP: Record<string, { nome: string; tipo: 'receita' | 'despesa' }> = {
  '03': { nome: 'RECEITA BRUTA OPERACIONAL', tipo: 'receita' },
  '04': { nome: 'RECEITAS NÃO OPERACIONAIS', tipo: 'receita' },
  '05': { nome: 'CUSTOS OPERACIONAIS', tipo: 'despesa' },
  '06': { nome: 'DESPESAS OPERACIONAIS', tipo: 'despesa' },
  '07': { nome: 'DESPESAS NÃO OPERACIONAIS', tipo: 'despesa' },
};

function emptyMonths(): Record<string, number> {
  const m: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) {
    m[`mes_${String(i).padStart(2, '0')}`] = 0;
  }
  m.acumulado = 0;
  return m;
}

export function registerDRERoutes(app: Express, db: any, storage: IStorage) {

  app.get("/api/financeiro/dre", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      const empresa = (req.query.empresa as string) || 'todas';

      const empresaFilter = empresa !== 'todas'
        ? sql` AND p.empresa = ${empresa}`
        : sql``;

      const result = await db.execute(sql`
        WITH categorias_expandidas AS (
          SELECT
            p.id,
            TRIM(cat.categoria) AS categoria_nome,
            p.tipo_evento,
            p.empresa,
            EXTRACT(MONTH FROM p.data_quitacao::date)::int AS mes,
            COALESCE(p.valor_categoria::numeric, p.valor_pago::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p,
               regexp_split_to_table(p.categoria_nome, ';') AS cat(categoria)
          WHERE p.status = 'QUITADO'
            AND EXTRACT(YEAR FROM p.data_quitacao::date) = ${ano}
            ${empresaFilter}
            AND p.categoria_nome IS NOT NULL
            AND p.categoria_nome != ''
        )
        SELECT
          categoria_nome,
          mes,
          SUM(valor) AS total
        FROM categorias_expandidas
        GROUP BY categoria_nome, mes
        ORDER BY categoria_nome, mes
      `);

      // Build line items grouped by category
      const categoriaMap = new Map<string, DRELineItem>();

      for (const row of result.rows) {
        const catNome = (row.categoria_nome as string).trim();
        const mes = parseInt(row.mes as string);
        const total = parseFloat(row.total as string) || 0;

        // Derive grupo from categoria prefix (e.g., "03.01" -> "03")
        const prefixMatch = catNome.match(/^(\d{2})\./);
        const grupoKey = prefixMatch ? prefixMatch[1] : '99';
        const grupoInfo = GRUPO_MAP[grupoKey];

        if (!grupoInfo) continue; // Skip categories outside 03-07

        if (!categoriaMap.has(catNome)) {
          categoriaMap.set(catNome, {
            categoria_id: grupoKey + '.' + catNome,
            categoria_nome: catNome,
            grupo: grupoKey,
            grupo_nome: grupoInfo.nome,
            tipo: grupoInfo.tipo,
            valores: emptyMonths(),
          });
        }

        const item = categoriaMap.get(catNome)!;
        const mesKey = `mes_${String(mes).padStart(2, '0')}`;
        item.valores[mesKey] = total;
        item.valores.acumulado += total;
      }

      const linhas = Array.from(categoriaMap.values()).sort((a, b) =>
        a.categoria_nome.localeCompare(b.categoria_nome)
      );

      // Calculate subtotals
      const subtotais = {
        receita_bruta_operacional: emptyMonths(),
        receitas_nao_operacionais: emptyMonths(),
        receita_bruta_total: emptyMonths(),
        custos_operacionais: emptyMonths(),
        lucro_bruto: emptyMonths(),
        despesas_operacionais: emptyMonths(),
        resultado_operacional: emptyMonths(),
        despesas_nao_operacionais: emptyMonths(),
        resultado_liquido: emptyMonths(),
      };

      for (const linha of linhas) {
        const keys = Object.keys(linha.valores);
        for (const k of keys) {
          if (linha.grupo === '03') subtotais.receita_bruta_operacional[k] += linha.valores[k];
          if (linha.grupo === '04') subtotais.receitas_nao_operacionais[k] += linha.valores[k];
          if (linha.grupo === '05') subtotais.custos_operacionais[k] += linha.valores[k];
          if (linha.grupo === '06') subtotais.despesas_operacionais[k] += linha.valores[k];
          if (linha.grupo === '07') subtotais.despesas_nao_operacionais[k] += linha.valores[k];
        }
      }

      // Derived subtotals
      const keys = Object.keys(emptyMonths());
      for (const k of keys) {
        subtotais.receita_bruta_total[k] =
          subtotais.receita_bruta_operacional[k] + subtotais.receitas_nao_operacionais[k];
        subtotais.lucro_bruto[k] =
          subtotais.receita_bruta_total[k] - subtotais.custos_operacionais[k];
        subtotais.resultado_operacional[k] =
          subtotais.lucro_bruto[k] - subtotais.despesas_operacionais[k];
        subtotais.resultado_liquido[k] =
          subtotais.resultado_operacional[k] - subtotais.despesas_nao_operacionais[k];
      }

      // Get available empresas for filter
      const empresasResult = await db.execute(sql`
        SELECT DISTINCT empresa
        FROM "Conta Azul".caz_parcelas
        WHERE empresa IS NOT NULL AND empresa != ''
        ORDER BY empresa
      `);

      const response: DREResponse & { empresas: string[] } = {
        ano,
        empresa,
        linhas,
        subtotais,
        empresas: empresasResult.rows.map((r: any) => r.empresa as string),
      };

      res.json(response);
    } catch (error) {
      console.error("[api] Error fetching DRE:", error);
      res.status(500).json({ error: "Failed to fetch DRE data" });
    }
  });
}
