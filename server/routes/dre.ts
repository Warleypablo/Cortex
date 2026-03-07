import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";

interface DRELineItem {
  categoria_id: string;
  categoria_nome: string;
  grupo: string;
  grupo_nome: string;
  parent_key: string;       // e.g. "05.01"
  parent_nome: string;      // e.g. "Mão de Obra Operacional"
  tipo: 'receita' | 'despesa';
  valores: Record<string, number>; // mes_01..mes_12 + acumulado
}

interface DREResponse {
  ano: number;
  empresa: string;
  linhas: DRELineItem[];
  parentCategories: Record<string, string>; // "05.01" -> "Mão de Obra Operacional"
  subtotais: {
    receita_bruta_operacional: Record<string, number>;
    deducoes_receita_bruta: Record<string, number>;
    receita_operacional_liquida: Record<string, number>;
    receitas_nao_operacionais: Record<string, number>;
    receita_liquida_total: Record<string, number>;
    custos_operacionais: Record<string, number>;
    lucro_bruto: Record<string, number>;
    despesas_operacionais: Record<string, number>;
    resultado_operacional: Record<string, number>;
    despesas_nao_operacionais: Record<string, number>;
    lair: Record<string, number>;
    ir_csll: Record<string, number>;
    resultado_liquido: Record<string, number>;
  };
}

const GRUPO_MAP: Record<string, { nome: string; tipo: 'receita' | 'despesa' }> = {
  '03': { nome: 'RECEITA BRUTA OPERACIONAL', tipo: 'receita' },
  '04': { nome: 'RECEITAS NÃO OPERACIONAIS', tipo: 'receita' },
  '05': { nome: 'CUSTOS OPERACIONAIS', tipo: 'despesa' },
  '06': { nome: 'DESPESAS OPERACIONAIS', tipo: 'despesa' },
  '07': { nome: 'DESPESAS NÃO OPERACIONAIS', tipo: 'despesa' },
  '08': { nome: 'IR E CONTRIBUIÇÃO SOCIAL', tipo: 'despesa' },
  'DD': { nome: 'DEDUÇÕES DA RECEITA BRUTA', tipo: 'despesa' },
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
          SELECT DISTINCT ON (p.id, REGEXP_REPLACE(TRIM(cat.categoria), '\s+', ' ', 'g'))
            p.id,
            REGEXP_REPLACE(TRIM(cat.categoria), '\s+', ' ', 'g') AS categoria_nome,
            p.tipo_evento,
            p.empresa,
            EXTRACT(MONTH FROM p.data_quitacao::date)::int AS mes,
            COALESCE(p.valor_pago::numeric, 0) AS valor
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

      // Fetch parent category names (XX.YY level) from caz_categorias
      const parentCatResult = await db.execute(sql`
        SELECT nome FROM "Conta Azul".caz_categorias
        WHERE nome ~ ${'^[0-9]{2}[.][0-9]{2} '}
        ORDER BY nome
      `);
      const parentCategories: Record<string, string> = {};
      for (const row of parentCatResult.rows) {
        const nome = (row.nome as string).trim();
        const match = nome.match(/^(\d{2}\.\d{2})\s+(.+)/);
        if (match) {
          parentCategories[match[1]] = match[2];
        }
      }

      // Build line items grouped by category
      const categoriaMap = new Map<string, DRELineItem>();

      for (const row of result.rows) {
        const catNome = (row.categoria_nome as string).trim();
        const mes = parseInt(row.mes as string);
        const total = parseFloat(row.total as string) || 0;

        // Derive grupo from categoria prefix (e.g., "03.01.01" -> grupo "03", parent "03.01")
        const prefixMatch = catNome.match(/^(\d{2})\.(\d{2})/);
        const grupoKey = prefixMatch ? prefixMatch[1] : '99';
        const parentKey = prefixMatch ? `${prefixMatch[1]}.${prefixMatch[2]}` : '99.99';
        const grupoInfo = GRUPO_MAP[grupoKey];

        if (!grupoInfo) continue; // Skip categories outside known groups

        // Reclassify tax deductions (05.05, 05.06) from Custos to Deduções
        const DEDUCAO_PARENTS = new Set(['05.05', '05.06']);
        let effectiveGrupo = grupoKey;
        if (DEDUCAO_PARENTS.has(parentKey)) {
          effectiveGrupo = 'DD';
        }

        if (!categoriaMap.has(catNome)) {
          categoriaMap.set(catNome, {
            categoria_id: effectiveGrupo + '.' + catNome,
            categoria_nome: catNome,
            grupo: effectiveGrupo,
            grupo_nome: effectiveGrupo === 'DD' ? 'DEDUÇÕES DA RECEITA BRUTA' : grupoInfo.nome,
            parent_key: parentKey,
            parent_nome: parentCategories[parentKey] || parentKey,
            tipo: effectiveGrupo === 'DD' ? 'despesa' : grupoInfo.tipo,
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
        deducoes_receita_bruta: emptyMonths(),
        receita_operacional_liquida: emptyMonths(),
        receitas_nao_operacionais: emptyMonths(),
        receita_liquida_total: emptyMonths(),
        custos_operacionais: emptyMonths(),
        lucro_bruto: emptyMonths(),
        despesas_operacionais: emptyMonths(),
        resultado_operacional: emptyMonths(),
        despesas_nao_operacionais: emptyMonths(),
        lair: emptyMonths(),
        ir_csll: emptyMonths(),
        resultado_liquido: emptyMonths(),
      };

      for (const linha of linhas) {
        const keys = Object.keys(linha.valores);
        for (const k of keys) {
          if (linha.grupo === '03') subtotais.receita_bruta_operacional[k] += linha.valores[k];
          if (linha.grupo === 'DD') subtotais.deducoes_receita_bruta[k] += linha.valores[k];
          if (linha.grupo === '04') subtotais.receitas_nao_operacionais[k] += linha.valores[k];
          if (linha.grupo === '05') subtotais.custos_operacionais[k] += linha.valores[k];
          if (linha.grupo === '06') subtotais.despesas_operacionais[k] += linha.valores[k];
          if (linha.grupo === '07') subtotais.despesas_nao_operacionais[k] += linha.valores[k];
          if (linha.grupo === '08') subtotais.ir_csll[k] += linha.valores[k];
        }
      }

      // Derived subtotals
      const keys = Object.keys(emptyMonths());
      for (const k of keys) {
        subtotais.receita_operacional_liquida[k] =
          subtotais.receita_bruta_operacional[k] - subtotais.deducoes_receita_bruta[k];
        subtotais.receita_liquida_total[k] =
          subtotais.receita_operacional_liquida[k] + subtotais.receitas_nao_operacionais[k];
        subtotais.lucro_bruto[k] =
          subtotais.receita_liquida_total[k] - subtotais.custos_operacionais[k];
        subtotais.resultado_operacional[k] =
          subtotais.lucro_bruto[k] - subtotais.despesas_operacionais[k];
        subtotais.lair[k] =
          subtotais.resultado_operacional[k] - subtotais.despesas_nao_operacionais[k];
        subtotais.resultado_liquido[k] =
          subtotais.lair[k] - subtotais.ir_csll[k];
      }

      // Get available empresas for filter
      const empresasResult = await db.execute(sql`
        SELECT DISTINCT empresa
        FROM "Conta Azul".caz_parcelas
        WHERE empresa IS NOT NULL AND empresa != ''
        ORDER BY empresa
      `);

      // Determine which months have actual data (any row with non-zero value)
      const mesesComDados: Set<string> = new Set();
      for (const linha of linhas) {
        for (let i = 1; i <= 12; i++) {
          const mk = `mes_${String(i).padStart(2, '0')}`;
          if (linha.valores[mk] !== 0) {
            mesesComDados.add(mk);
          }
        }
      }

      const response: DREResponse & { empresas: string[]; mesesComDados: string[] } = {
        ano,
        empresa,
        linhas,
        parentCategories,
        subtotais,
        empresas: empresasResult.rows.map((r: any) => r.empresa as string),
        mesesComDados: Array.from(mesesComDados),
      };

      res.json(response);
    } catch (error) {
      console.error("[api] Error fetching DRE:", error);
      res.status(500).json({ error: "Failed to fetch DRE data" });
    }
  });
}
