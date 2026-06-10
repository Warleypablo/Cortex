// server/routes/bp2026.capacity.ts
// Sub-aba Capacity: dimensionamento de gestores de Performance e designers vs aba CSV.
// Contratos Performance vêm da série da Revenue; headcount por cargo do Inhire.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";

interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec"; nota?: string; destaque?: boolean;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_CONTRATOS_GESTOR =
  "Capacity planejada: 12 contratos/gestor. Acima do orçado = eficiência, " +
  "mas risco de churn por sobrecarga.";

const NOTA_DESIGNERS =
  "Conta todos com cargo Designer no Inhire — pode incluir designers fora " +
  "da operação de Performance.";

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  contratosPerformance: (number | null)[]; // série mensal (12) extraída do payload da Revenue
  mesCorrente: number;
  mesFechado: number;
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

export async function montarCapacity(deps: Deps): Promise<Linha[]> {
  const { db, orcado, contratosPerformance, mesCorrente, mesFechado } = deps;

  const result = await db.execute(sql`
    SELECT gs.mes,
           COUNT(*) FILTER (WHERE TRIM(p.cargo) = 'Gestor de Performance') AS gestores,
           COUNT(*) FILTER (WHERE TRIM(p.cargo) = 'Designer') AS designers
    FROM generate_series(1, 12) AS gs(mes)
    LEFT JOIN "Inhire".rh_pessoal p
      ON p.admissao IS NOT NULL
     AND p.admissao::date <= (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date
     AND (p.demissao IS NULL OR p.demissao::date > (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date)
    GROUP BY gs.mes ORDER BY gs.mes
  `);
  const hc: Record<number, { gestores: number; designers: number }> = {};
  for (const row of result.rows as any[]) {
    hc[Number(row.mes)] = { gestores: parseInt(row.gestores), designers: parseInt(row.designers) };
  }

  const mensal = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const contratos = contratosPerformance;
  const gestores = mensal((m) => hc[m]?.gestores ?? null);
  const designers = mensal((m) => hc[m]?.designers ?? null);
  const orcDe = (metrica: string) => (m: number) => orcado[metrica]?.[m] ?? 0;

  const gestoresNec = Array.from({ length: 12 }, (_, i) =>
    razao(contratos[i], orcado["capacity_gestores"]?.[i + 1] ?? 0)
  );
  const designersNec = Array.from({ length: 12 }, (_, i) =>
    razao(contratos[i], orcado["capacity_designers"]?.[i + 1] ?? 0)
  );
  const necessidade = Array.from({ length: 12 }, (_, i) =>
    gestoresNec[i] === null || gestores[i] === null ? null : gestoresNec[i]! - gestores[i]!
  );
  const contratosPorGestor = Array.from({ length: 12 }, (_, i) => razao(contratos[i], gestores[i]));
  const contasPorDesigner = Array.from({ length: 12 }, (_, i) => razao(contratos[i], designers[i]));

  const fazLinha = (
    def: { metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque"; direcao: Linha["direcao"]; unidade: NonNullable<Linha["unidade"]>; nota?: string; destaque?: boolean },
    serie: (number | null)[],
    orcadoMes: (m: number) => number,
    ytdOverride?: { orcado: number; realizado: number | null }
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const o = orcadoMes(mes);
      const r = serie[i];
      return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    let ytd: Linha["ytd"];
    if (mesFechado === 0) {
      ytd = { orcado: 0, realizado: null, atingimento: null };
    } else if (ytdOverride) {
      ytd = { ...ytdOverride, atingimento: calcAtingimento(ytdOverride.orcado, ytdOverride.realizado) };
    } else {
      const v = calcYtd(meses, mesFechado, def.tipoAgregacao);
      ytd = { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) };
    }
    return { ...def, meses, ytd };
  };

  // todas as linhas são posições → tipoAgregacao estoque; YTD = posição no mês fechado
  const ytdPos = (serie: (number | null)[], orcadoMes: (m: number) => number) =>
    mesFechado === 0 ? undefined : { orcado: orcadoMes(mesFechado), realizado: serie[mesFechado - 1] };

  return [
    fazLinha({ metrica: "cap_contratos_performance", titulo: "Contratos Performance", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int", destaque: true }, contratos, orcDe("contratos_performance"), ytdPos(contratos, orcDe("contratos_performance"))),
    fazLinha({ metrica: "gestores_necessarios", titulo: "Gestores necessários", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "dec" }, gestoresNec, orcDe("gestores_necessarios"), ytdPos(gestoresNec, orcDe("gestores_necessarios"))),
    fazLinha({ metrica: "gestores_atuais", titulo: "Gestores atuais", tipoAgregacao: "estoque", direcao: "menor_melhor", unidade: "int" }, gestores, orcDe("gestores_atuais"), ytdPos(gestores, orcDe("gestores_atuais"))),
    // necessidade fica neutra: atingimento sobre orçado negativo não tem leitura de cor
    fazLinha({ metrica: "necessidade_gestores", titulo: "Necessidade de contratar (gestores)", tipoAgregacao: "estoque", direcao: "neutro", unidade: "dec" }, necessidade,
      (m) => (orcado["gestores_necessarios"]?.[m] ?? 0) - (orcado["gestores_atuais"]?.[m] ?? 0),
      ytdPos(necessidade, (m) => (orcado["gestores_necessarios"]?.[m] ?? 0) - (orcado["gestores_atuais"]?.[m] ?? 0))),
    fazLinha({ metrica: "contratos_por_gestor", titulo: "Contratos por gestor", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "dec", nota: NOTA_CONTRATOS_GESTOR }, contratosPorGestor, orcDe("contratos_por_gestor"), ytdPos(contratosPorGestor, orcDe("contratos_por_gestor"))),
    fazLinha({ metrica: "designers_necessarios", titulo: "Designers necessários", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "dec" }, designersNec, orcDe("designers_necessarios"), ytdPos(designersNec, orcDe("designers_necessarios"))),
    fazLinha({ metrica: "designers_atuais", titulo: "Designers atuais", tipoAgregacao: "estoque", direcao: "menor_melhor", unidade: "int", nota: NOTA_DESIGNERS }, designers, orcDe("designers_atuais"), ytdPos(designers, orcDe("designers_atuais"))),
    fazLinha({ metrica: "contas_por_designer", titulo: "Contas por designer", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "dec" }, contasPorDesigner, orcDe("contas_por_designer"), ytdPos(contasPorDesigner, orcDe("contas_por_designer"))),
  ];
}
