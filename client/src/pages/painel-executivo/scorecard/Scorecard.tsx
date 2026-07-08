import { Fragment } from "react";
import { LineChart, Line } from "recharts";
import { cn, formatPercent } from "@/lib/utils";
import { calcStatus, calcYtd, deltaM1, formatValor, ANO_MIN_EVOLUCAO, type DeltaM1Result } from "./logica";
import { CelulaResponsavel } from "./CelulaResponsavel";
import type {
  ScorecardSection,
  ScorecardRow,
  ScorecardSeriePonto,
  ScorecardMeta,
  ScorecardDirection,
  ScorecardFormato,
  ScorecardResponsavelItem,
} from "./tipos";

export type ScorecardModo = "foco" | "evolucao";

interface ScorecardProps {
  secoes: ScorecardSection[];
  mes: string;
  modo: ScorecardModo;
  metas: Record<string, ScorecardMeta>;
  responsaveis: ScorecardResponsavelItem[];
  onEditResponsavel: (metricaKey: string, valor: string) => void;
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function mesAbrev(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

/** Meta formatada com prefixo de direção (churn-like → "< R$ 96.000"; up-is-better → valor puro). */
function formatMeta(meta: ScorecardMeta | undefined, formato: ScorecardFormato): string {
  if (!meta) return "—";
  return `${meta.direction === "down" ? "< " : ""}${formatValor(meta.valor, formato)}`;
}

/** Se a variação (raw, ex. "subiu 8%") é favorável ou não depende da direção da meta da
   métrica (up-is-better vs. down-is-better, ex. churn). Sem meta → sem julgamento (neutro). */
function trendFavoravel(delta: DeltaM1Result | null, direction?: ScorecardDirection): boolean | null {
  if (!delta || delta.dir === "flat" || !direction) return null;
  return (direction === "up") === (delta.dir === "up");
}

const PILL_TONE: Record<"good" | "warn" | "bad" | "neutral", string> = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  bad: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground",
};

function StatusPill({ tone, label }: { tone: "good" | "warn" | "bad" | "neutral"; label: string }) {
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", PILL_TONE[tone])}>
      {label}
    </span>
  );
}

/** Linha "header" de seção — faixa navy full-width. O `td` cobre a linha inteira (colSpan),
   mas o TEXTO fica num `div` sticky à esquerda para não sumir ao rolar a tabela para a direita. */
function SecaoHeaderRow({ titulo, subtitulo, colSpan }: { titulo: string; subtitulo?: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-[hsl(var(--primary))] p-0 dark:bg-[#16234a]">
        <div className="sticky left-0 w-max px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-primary-foreground">
          {titulo}
          {subtitulo && (
            <span className="ml-2 text-[11px] font-medium normal-case tracking-normal text-primary-foreground/70">{subtitulo}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ───────────────────────── modo "foco" ─────────────────────────

function LinhaFoco({
  row, meta, responsavelManual, onEditResponsavel,
}: {
  row: ScorecardRow;
  meta?: ScorecardMeta;
  responsavelManual: string | null;
  onEditResponsavel: (metricaKey: string, valor: string) => void;
}) {
  const isSnapshot = row.temporalidade === "snapshot";
  const status = isSnapshot ? null : calcStatus(row.atual, meta?.valor, meta?.direction ?? "up");
  const delta = isSnapshot ? null : deltaM1(row.serie);
  const favoravel = trendFavoravel(delta, meta?.direction);

  return (
    <tr
      onClick={row.drill}
      className={cn("group border-b border-border/60 last:border-0", row.drill && "cursor-pointer hover:bg-muted/40")}
    >
      <td className={cn("sticky left-0 z-10 bg-card px-4 py-3 text-left align-middle font-medium text-foreground", row.drill && "group-hover:bg-muted/40")}>
        {row.metrica}
        {row.sub && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.sub}</span>}
      </td>
      <td className="bg-accent px-4 py-3 text-right font-semibold tabular-nums text-accent-foreground">
        {formatValor(row.atual, row.formato)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {isSnapshot || !delta || delta.dir === "flat" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={cn(
            "font-semibold",
            favoravel === null ? "text-muted-foreground" : favoravel ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
          )}>
            {delta.dir === "up" ? "▲" : "▼"} {formatPercent(Math.abs(delta.pct), 1)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
        {isSnapshot ? "—" : formatMeta(meta, row.formato)}
      </td>
      <td className="px-4 py-3 text-right">
        <StatusPill
          tone={isSnapshot ? "neutral" : (status ?? "neutral")}
          label={isSnapshot ? "Snapshot" : status === "good" ? "No alvo" : status === "warn" ? "Atenção" : status === "bad" ? "Fora da meta" : "—"}
        />
      </td>
      {/* stopPropagation: a linha inteira é clicável (drill) quando `row.drill` existe — sem
         isso, escolher um responsável no <Select> também dispararia o drill-down. */}
      <td className="px-4 py-3 text-left" onClick={(e) => e.stopPropagation()}>
        <CelulaResponsavel
          metricaKey={row.key}
          responsavelAuto={row.responsavelAuto}
          responsavelManual={responsavelManual}
          onEditResponsavel={onEditResponsavel}
        />
      </td>
    </tr>
  );
}

function TabelaFoco({
  secoes, mes, metas, responsaveisManuais, onEditResponsavel,
}: {
  secoes: ScorecardSection[];
  mes: string;
  metas: Record<string, ScorecardMeta>;
  responsaveisManuais: Map<string, string | null>;
  onEditResponsavel: (metricaKey: string, valor: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="sticky left-0 z-20 bg-muted/40 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Métrica</th>
            <th className="bg-accent px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">Atual ({mesAbrev(mes)})</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Δ M-1</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Meta</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável</th>
          </tr>
        </thead>
        <tbody>
          {secoes.map((secao) => (
            <Fragment key={secao.id}>
              <SecaoHeaderRow titulo={secao.titulo} subtitulo={secao.subtitulo} colSpan={6} />
              {secao.linhas.map((row) => (
                <LinhaFoco
                  key={row.key}
                  row={row}
                  meta={row.metaKey ? metas[row.metaKey] : undefined}
                  responsavelManual={responsaveisManuais.get(row.key) ?? null}
                  onEditResponsavel={onEditResponsavel}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────── modo "evolução" ───────────────────────

/** Trunca a série à janela do ano corrente (2026) até o mês SELECIONADO (`mes`): descarta pontos
   de meses POSTERIORES (a série costuma vir até o mês corrente real, mesmo quando o usuário
   escolhe um mês anterior) E pontos de anos anteriores a 2026. Pontos sem `month` (séries
   antigas, sem essa info) são mantidos sem corte — fallback. */
function truncarSerie(serie: ScorecardSeriePonto[], mes: string): ScorecardSeriePonto[] {
  if (!serie.some((p) => p.month)) return serie;
  return serie.filter((p) => !p.month || (p.month >= ANO_MIN_EVOLUCAO && p.month <= mes));
}

/** Colunas de meses = a maior série (JÁ TRUNCADA no mês selecionado) entre todas as linhas de
   todas as seções (assume que compartilham a mesma janela mensal, como as métricas do
   relatório mensal). Truncar ANTES de comparar o tamanho garante que a coluna mais à direita
   corresponda ao mês selecionado, não ao último mês absoluto da série mais longa. */
function mesesGlobais(secoes: ScorecardSection[], mes: string): string[] {
  let maiorSerie: ScorecardSeriePonto[] = [];
  for (const secao of secoes) {
    for (const row of secao.linhas) {
      if (!row.serie) continue;
      const truncada = truncarSerie(row.serie, mes);
      if (truncada.length > maiorSerie.length) maiorSerie = truncada;
    }
  }
  return maiorSerie.map((p) => p.label);
}

/** Alinha a série da linha (que pode ser mais curta, ex. métrica nova) às colunas de mês
   globais pela DIREITA — assume que todas as séries terminam no mesmo mês atual. */
function valoresAlinhados(serie: ScorecardSeriePonto[], totalColunas: number): (number | null | undefined)[] {
  const offset = Math.max(0, totalColunas - serie.length);
  return Array.from({ length: totalColunas }, (_, i) => (i < offset ? undefined : serie[i - offset]?.valor));
}

function Sparkline({ serie, favoravel }: { serie: ScorecardSeriePonto[]; favoravel: boolean | null }) {
  const pontos = serie.filter((p) => p.valor !== null && p.valor !== undefined) as { label: string; valor: number }[];
  if (pontos.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  // stroke="currentColor" herda a cor do texto (mesmos tons emerald/rose do Δ M-1, com
  // dark: variant) em vez de hex fixo — o SVG do Recharts não lê tokens do tema sozinho.
  return (
    <div className={cn(
      "inline-block",
      favoravel === null ? "text-muted-foreground" : favoravel ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
    )}>
      <LineChart width={64} height={24} data={pontos} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="valor" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </div>
  );
}

function LinhaEvolucao({ row, colunas, meta, mes }: { row: ScorecardRow; colunas: string[]; meta?: ScorecardMeta; mes: string }) {
  // "Snapshot" é um selo de TEMPORALIDADE (estoque medido num ponto no tempo, ex: estoque
  // pontual em aberto, LTV médio) — não um estado genérico para "linha sem série". Uma
  // métrica mensal (temporalidade "mes") que ainda não acumulou histórico é outra coisa:
  // sem série (ainda), não snapshot. Confundir os dois rotula métricas normais como
  // "Snapshot" incorretamente.
  const isSnapshot = row.temporalidade === "snapshot";
  // Trunca ANTES de calcular delta/sparkline/alinhamento — sem isso, o M-1 e o sparkline
  // comparariam meses posteriores ao selecionado (ex. mês corrente real, ainda incompleto).
  const serieTruncada = row.serie ? truncarSerie(row.serie, mes) : undefined;
  const semSerie = !serieTruncada || serieTruncada.length === 0;
  const delta = isSnapshot || semSerie ? null : deltaM1(serieTruncada);
  const favoravel = trendFavoravel(delta, meta?.direction);
  // YTD (acumulado do ano) — calculado sobre a série INTEIRA (calcYtd já filtra a janela
  // jan/ANO_MIN_EVOLUCAO..mes internamente, mesma regra de truncarSerie), não sobre `serieTruncada`.
  const ytd = calcYtd(row.serie, mes, row.ytdAgg, row.formato);

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/40">
      <td className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium text-foreground">{row.metrica}</td>
      {isSnapshot || semSerie ? (
        // colSpan == colunas.length sempre — mesmo quando a seção inteira não tem nenhuma
        // série (colunas cai no fallback ["Atual"] de 1 coluna), mantendo a grade alinhada
        // com o header (nº de <th> de mês/placeholder é sempre igual a colunas.length).
        <td colSpan={colunas.length} className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="font-semibold tabular-nums text-foreground">{formatValor(row.atual, row.formato)}</span>
            {isSnapshot ? (
              <StatusPill tone="neutral" label="Snapshot" />
            ) : (
              <span className="text-xs text-muted-foreground">sem série</span>
            )}
          </div>
        </td>
      ) : (
        valoresAlinhados(serieTruncada!, colunas.length).map((valor, i) => (
          <td
            key={i}
            className={cn(
              "px-3 py-3 text-right tabular-nums",
              i === colunas.length - 1 ? "bg-accent font-semibold text-accent-foreground" : "text-foreground",
            )}
          >
            {valor === null || valor === undefined ? "—" : formatValor(valor, row.formato)}
          </td>
        ))
      )}
      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatMeta(meta, row.formato)}</td>
      <td className="px-3 py-3 text-right tabular-nums font-medium text-foreground">
        {ytd === null ? <span className="text-muted-foreground">—</span> : formatValor(ytd, row.formato)}
      </td>
      <td className="px-3 py-3 text-right">
        {isSnapshot || semSerie ? <span className="text-xs text-muted-foreground">—</span> : <Sparkline serie={serieTruncada!} favoravel={favoravel} />}
      </td>
    </tr>
  );
}

function TabelaEvolucao({ secoes, metas, mes }: { secoes: ScorecardSection[]; metas: Record<string, ScorecardMeta>; mes: string }) {
  const meses = mesesGlobais(secoes, mes);
  // Fallback ["Atual"]: quando NENHUMA linha de NENHUMA seção tem série (ex. seção 100%
  // snapshot), garante ao menos 1 coluna na "zona de meses" — sem isso, colSpan das linhas
  // (sempre >= 1) desalinharia com um header de 0 colunas de mês.
  const colunas = meses.length > 0 ? meses : ["Atual"];
  const totalCols = 1 + colunas.length + 3; // Métrica + colunas + Meta + YTD + Tend.

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="sticky left-0 z-20 bg-muted/40 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Métrica</th>
            {colunas.map((label, i) => (
              <th
                key={label + i}
                className={cn(
                  "px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide",
                  i === colunas.length - 1 ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Meta</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">YTD</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tend.</th>
          </tr>
        </thead>
        <tbody>
          {secoes.map((secao) => (
            <Fragment key={secao.id}>
              <SecaoHeaderRow titulo={secao.titulo} subtitulo={secao.subtitulo} colSpan={totalCols} />
              {secao.linhas.map((row) => (
                <LinhaEvolucao key={row.key} row={row} colunas={colunas} meta={row.metaKey ? metas[row.metaKey] : undefined} mes={mes} />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────  raiz  ────────────────────────────

/** Tabela central do Scorecard executivo — 2 modos:
   - "foco": leitura do fechamento do mês (Métrica | Atual | Δ M-1 | Meta | Status | Responsável).
   - "evolucao": a mesma métrica mês a mês em colunas (tendência), sem Δ/Status/Responsável. */
export function Scorecard({ secoes, mes, modo, metas, responsaveis, onEditResponsavel }: ScorecardProps) {
  if (modo === "evolucao") {
    return <TabelaEvolucao secoes={secoes} metas={metas} mes={mes} />;
  }

  const responsaveisManuais = new Map(responsaveis.map((r) => [r.metrica_key, r.responsavel]));
  return (
    <TabelaFoco
      secoes={secoes}
      mes={mes}
      metas={metas}
      responsaveisManuais={responsaveisManuais}
      onEditResponsavel={onEditResponsavel}
    />
  );
}
