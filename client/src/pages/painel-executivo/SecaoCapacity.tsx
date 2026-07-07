import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/utils";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import {
  useCeoDashboard,
  useCapacityTimes,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
  useScorecardSeries,
} from "./hooks";
import { linhasPorDimensao } from "./scorecard/logica";
import { SELVA_BLOQUEADA } from "@shared/capacityGrupos";
import { ErroCard } from "./_ui";
import type { CeoKpi } from "@/components/ceo/CeoKpiCard";
import type { ScorecardSection, ScorecardRow, ScorecardResponsavelItem, ScorecardSeriesResponse } from "./scorecard/tipos";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "YYYY-MM" → label curto (ex: "Jan") — mesmo padrão de `labelMesCurto` em SecaoChurn.tsx/
   SecaoEntregas.tsx (duplicado localmente, não há util compartilhado entre seções). */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

// Shapes espelham server/routes/capacityTimes.helpers.ts (CapacityTimesResponse), confirmadas
// lendo capacity.ts (GET /api/capacity-times) e o consumidor client/src/pages/CapacityTimes.tsx —
// não há tipo compartilhado client/server para este endpoint (por isso a duplicação local,
// preservada da v1 desta seção).
interface ComercialRow {
  nome: string;
  mrr_atual: number;
  contas_ativas: number;
  util_mrr_pct: number | null;
  util_contas_pct: number | null;
}
interface SelvaRow {
  nome: string;
  contas: number;
  faturamento: number;
  cap_fat: number | null;
  util_pct: number | null;
}
interface CsRow {
  nome: string;
  op_recorrente: number;
  mrr_operando: number;
  cap_fat: number | null;
  util_fat_pct: number | null;
}
interface SquadGroup { squad: string; rows: CsRow[]; }
// Exportado para reuso por SecaoConsolidado.tsx (mesmo cast local de `capacity.data`).
export interface CapacityTimesResponse {
  selva: SelvaRow[];
  black: ComercialRow[];
  squadra: ComercialRow[];
  cxcs: ComercialRow[];
  squads: SquadGroup[];
  metaContasDesigner: number;
}

/** Chave estável para linhas derivadas de listas variáveis (pessoa por equipe/squad) — mesmo
   padrão de SecaoChurn.tsx (slug determinístico, não por índice de posição). */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pctText(pct: number | null): string {
  return pct === null ? "—" : formatPercent(pct, 1);
}

function linhaComercial(equipe: string, r: ComercialRow): ScorecardRow {
  return {
    key: `capacity_${slug(equipe)}_${slug(r.nome)}`,
    metrica: r.nome,
    sub: `${equipe} · ${r.contas_ativas} contas · Util. ${pctText(r.util_mrr_pct)}`,
    atual: r.mrr_atual,
    formato: "brl",
    temporalidade: "snapshot",
    // Dono automático (a própria pessoa) — mesmo padrão de SecaoChurn "por operador".
    responsavelAuto: r.nome,
  };
}

function linhaSelva(r: SelvaRow): ScorecardRow {
  return {
    key: `capacity_selva_${slug(r.nome)}`,
    metrica: r.nome,
    sub: `Selva · ${r.contas} contas · Util. ${pctText(r.util_pct)}`,
    atual: r.faturamento,
    formato: "brl",
    temporalidade: "snapshot",
    responsavelAuto: r.nome,
  };
}

function linhaSquad(squad: string, r: CsRow): ScorecardRow {
  return {
    key: `capacity_squad_${slug(squad)}_${slug(r.nome)}`,
    metrica: r.nome,
    sub: `Squad ${squad} · ${r.op_recorrente} contratos rec. · Util. ${pctText(r.util_fat_pct)}`,
    atual: r.mrr_operando,
    formato: "brl",
    temporalidade: "snapshot",
    responsavelAuto: r.nome,
  };
}

/** Achata as 5 tabelas da v1 (Black/Squadra/CXCS/Selva/Squads de CS) em linhas de scorecard —
   uma pessoa por linha, faturamento/MRR real como métrica principal e utilização no `sub`
   (ScorecardRow não tem colunas extras para contas/util separadas). Selva some quando
   SELVA_BLOQUEADA (mesmo comportamento da v1, sinalizado via `subtitulo` da seção). */
function montarLinhasCapacidade(cap: CapacityTimesResponse): ScorecardRow[] {
  const linhas: ScorecardRow[] = [
    ...cap.black.map((r) => linhaComercial("Black", r)),
    ...cap.squadra.map((r) => linhaComercial("Squadra", r)),
    ...cap.cxcs.map((r) => linhaComercial("CXCS", r)),
  ];
  if (!SELVA_BLOQUEADA) linhas.push(...cap.selva.map(linhaSelva));
  for (const g of cap.squads) linhas.push(...g.rows.map((r) => linhaSquad(g.squad, r)));
  return linhas;
}

export interface MontarSecoesCapacityCeo {
  isError: boolean;
  kpis: CeoKpi[] | undefined;
}
export interface MontarSecoesCapacitySeries {
  isError: boolean;
  data: ScorecardSeriesResponse | undefined;
}

/** Função pura: monta as seções de Capacity a partir dos payloads já resolvidos. `ceo`/`series`
   carregam o `isError` de cada query (além dos dados) porque o texto exibido distingue erro de
   loading (mesmo comportamento do componente original). Extraída de SecaoCapacity para reuso
   pela aba Consolidado. */
export function montarSecoesCapacity(
  ceo: MontarSecoesCapacityCeo,
  capacity: CapacityTimesResponse | undefined,
  series: MontarSecoesCapacitySeries,
  mes: string,
): ScorecardSection[] {
  // /api/ceo-dashboard exige permissão de CEO (403 para os demais papéis; useCeoDashboard já
  // usa retry:false). Isolado: a linha mostra atual=null + aviso, sem derrubar a aba inteira.
  const receitaCabecaValor = ceo.isError ? null : (ceo.kpis?.find((k) => k.key === "receita_cabeca")?.valor ?? null);

  const secaoReceitaCabeca: ScorecardSection = {
    id: "capacity-receita-cabeca",
    titulo: "Receita por Cabeça (mês)",
    linhas: [
      {
        key: "capacity_receita_cabeca",
        metrica: "Receita / Cabeça",
        sub: ceo.isError ? "requer permissão CEO" : undefined,
        atual: receitaCabecaValor,
        formato: "brl",
        // /api/scorecard/metas já devolve o override fixo (R$ 20.000, direction "up") p/ esta chave.
        metaKey: "receita_cabeca",
        temporalidade: "mes",
      },
    ],
  };

  // MRR por squad/operador com série real (Onda2-A) — ao contrário da seção "snapshot" abaixo
  // (achatada por pessoa, só o valor do momento), estas linhas têm `atual` E `serie` vindos do
  // MESMO endpoint (/api/scorecard/series), reconciliando o número do mês com o modo Evolução.
  const mrrSquadRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorSquad, mes, {
    keyFn: (dim) => `capacity_mrr_squad_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
  });
  const mrrOperadorRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorOperador, mes, {
    keyFn: (dim) => `capacity_mrr_operador_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    top: 10,
    responsavelAuto: true,
  });
  const secaoMrrSquad: ScorecardSection = {
    id: "capacity-mrr-squad",
    titulo: "Capacity — MRR por squad (evolução)",
    subtitulo: series.isError
      ? "falha ao carregar série por squad"
      : mrrSquadRows.length === 0
        ? "carregando série…"
        : undefined,
    linhas: mrrSquadRows,
  };
  const secaoMrrOperador: ScorecardSection = {
    id: "capacity-mrr-operador",
    titulo: "Capacity — MRR por operador (evolução)",
    subtitulo: series.isError
      ? "falha ao carregar série por operador"
      : mrrOperadorRows.length === 0
        ? "carregando série…"
        : undefined,
    linhas: mrrOperadorRows,
  };

  // capacity-times bloqueia SÓ a seção snapshot (Receita/Cabeça e as 2 seções de série
  // continuam acima, independentes).
  const secoes: ScorecardSection[] = [secaoReceitaCabeca, secaoMrrSquad, secaoMrrOperador];
  if (capacity) {
    secoes.push({
      id: "capacity-squad-snapshot",
      titulo: "Capacity por squad (snapshot)",
      subtitulo: SELVA_BLOQUEADA
        ? "Selva (Designers) desativada temporariamente — carteira em preenchimento no ClickUp."
        : undefined,
      linhas: montarLinhasCapacidade(capacity),
    });
  }

  return secoes;
}

export function SecaoCapacity({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const ceo = useCeoDashboard(mes);
  const capacity = useCapacityTimes();
  // Série de MRR por squad/operador (Onda2-A) — fonte das 2 seções de evolução abaixo. Falha/
  // loading isolados (não bloqueiam a aba): linhasPorDimensao devolve [] sem `series.data`.
  const series = useScorecardSeries(mes);
  const metas = useScorecardMetas(mes);
  const responsaveis = useScorecardResponsaveis();
  const salvarResponsaveis = useSalvarResponsaveis();

  function onEditResponsavel(metricaKey: string, valor: string) {
    const atuais = responsaveis.data?.itens ?? [];
    const atualizado: ScorecardResponsavelItem[] = [
      ...atuais.filter((i) => i.metrica_key !== metricaKey),
      { metrica_key: metricaKey, responsavel: valor },
    ];
    salvarResponsaveis.mutate(atualizado);
  }

  const cap = capacity.data as CapacityTimesResponse | undefined;
  const ceoKpis = (ceo.data as { kpis?: CeoKpi[] } | undefined)?.kpis;
  const secoes = montarSecoesCapacity({ isError: ceo.isError, kpis: ceoKpis }, cap, { isError: series.isError, data: series.data }, mes);

  return (
    <div className="space-y-4">
      <Scorecard
        secoes={secoes}
        mes={mes}
        modo={modo}
        metas={metas.data?.metas ?? {}}
        responsaveis={responsaveis.data?.itens ?? []}
        onEditResponsavel={onEditResponsavel}
      />
      {capacity.isError && <ErroCard mensagem="Falha ao carregar capacity por squad/operador." />}
      {capacity.isLoading && <Skeleton className="h-48 w-full" />}
    </div>
  );
}
