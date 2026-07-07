import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/utils";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import { useCeoDashboard, useCapacityTimes, useScorecardMetas, useScorecardResponsaveis, useSalvarResponsaveis } from "./hooks";
import { SELVA_BLOQUEADA } from "@shared/capacityGrupos";
import { ErroCard } from "./_ui";
import type { CeoKpi } from "@/components/ceo/CeoKpiCard";
import type { ScorecardSection, ScorecardRow, ScorecardResponsavelItem } from "./scorecard/tipos";

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
interface CapacityTimesResponse {
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

export function SecaoCapacity({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const ceo = useCeoDashboard(mes);
  const capacity = useCapacityTimes();
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

  // /api/ceo-dashboard exige permissão de CEO (403 para os demais papéis; useCeoDashboard já
  // usa retry:false). Isolado: a linha mostra atual=null + aviso, sem derrubar a aba inteira.
  const receitaCabecaValor = ceo.isError
    ? null
    : ((ceo.data as { kpis?: CeoKpi[] } | undefined)?.kpis?.find((k) => k.key === "receita_cabeca")?.valor ?? null);

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

  // capacity-times bloqueia SÓ a seção snapshot (Receita/Cabeça continua acima, independente).
  const cap = capacity.data as CapacityTimesResponse | undefined;
  const secoes: ScorecardSection[] = [secaoReceitaCabeca];
  if (cap) {
    secoes.push({
      id: "capacity-squad-snapshot",
      titulo: "Capacity por squad (snapshot)",
      subtitulo: SELVA_BLOQUEADA
        ? "Selva (Designers) desativada temporariamente — carteira em preenchimento no ClickUp."
        : undefined,
      linhas: montarLinhasCapacidade(cap),
    });
  }

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
