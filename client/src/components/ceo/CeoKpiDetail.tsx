import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CeoEvolucaoChart, type PontoEvolucao } from "./CeoEvolucaoChart";
import { formatValor } from "./ceoFormat";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface ItemDet { nome: string; detalhe: string; data: string | null; valor: number; url?: string }
interface GrupoDet { titulo: string; total: number; sinal?: "+" | "-"; formato: "brl" | "num"; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number }; aberto?: boolean }
interface DetalheResponse {
  kpi: string; titulo: string; mes: number; unidade: "brl" | "int";
  orcado: number | null; realizado: number | null; atingimentoPct: number | null;
  grupos: GrupoDet[]; evolucao?: PontoEvolucao[]; nota?: string;
  media?: number | null; // auditoria de LTV: média dos mesmos clientes (comparativo mediana × média)
  somaLtv?: number | null; // numerador da média (soma dos LTVs listados)
  nClientes?: number | null; // população da auditoria (denominador da média; N da mediana)
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const TOM_ACENTO: Record<string, { texto: string; barra: string; chip: string }> = {
  verde: { texto: "text-emerald-600 dark:text-emerald-400", barra: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  ambar: { texto: "text-amber-600 dark:text-amber-400", barra: "bg-amber-500", chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  vermelho: { texto: "text-rose-600 dark:text-rose-400", barra: "bg-rose-500", chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  neutro: { texto: "text-orange-600 dark:text-orange-400", barra: "bg-orange-500", chip: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" },
};

// Comparativo mediana × média (auditoria de LTV): barras proporcionais + leitura do gap.
// A distância entre as duas conta a história dos outliers — por isso a célula usa mediana.
function MedianaVsMedia({ mediana, media, soma, n, unidade, corMediana }: {
  mediana: number; media: number; soma?: number | null; n?: number | null;
  unidade: "brl" | "int"; corMediana: string;
}) {
  const max = Math.max(mediana, media);
  const gapPct = Math.round((media / mediana - 1) * 100);
  const legenda = Math.abs(media / mediana - 1) <= 0.02
    ? "Média e mediana próximas: base equilibrada, sem outliers relevantes."
    : media > mediana
      ? "Média acima da mediana: poucos clientes grandes puxam a média para cima."
      : "Média abaixo da mediana: muitos clientes pequenos puxam a média para baixo.";
  // A conta aberta dos dois números, com os valores reais do mês — cada parcela
  // é conferível nos grupos listados abaixo (a soma ≈ soma dos totais dos grupos).
  const calcMediana = n != null && n > 0
    ? (n % 2 === 1
      ? `Mediana ${formatValor(mediana, unidade)} = LTV do cliente central (${(n + 1) / 2}º de ${n}) — está no grupo “Mediana”`
      : `Mediana ${formatValor(mediana, unidade)} = média do ${n / 2}º e ${n / 2 + 1}º cliente de ${n} — estão no grupo “Mediana”`)
    : null;
  const calcMedia = soma != null && n != null && n > 0
    ? `Média ${formatValor(media, unidade)} = ${formatValor(soma, unidade)} (soma dos ${n} LTVs listados) ÷ ${n}`
    : null;
  const barras = [
    { label: "Mediana", valor: mediana, cor: corMediana, gap: null as string | null },
    { label: "Média", valor: media, cor: "bg-gray-300 dark:bg-zinc-600",
      gap: gapPct !== 0 ? `${gapPct > 0 ? "+" : ""}${gapPct}%` : null },
  ];
  return (
    <div className="mt-4 space-y-1.5">
      {barras.map((b) => (
        <div key={b.label} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-gray-500 dark:text-zinc-400">{b.label}</span>
          <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
            <div className={`h-full rounded-full ${b.cor} transition-all`}
              style={{ width: `${Math.max(4, (b.valor / max) * 100)}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right tabular-nums text-gray-900 dark:text-white">
            {formatValor(b.valor, unidade)}
          </span>
          <span className="w-10 shrink-0 text-right tabular-nums text-gray-400 dark:text-zinc-500">
            {b.gap ?? ""}
          </span>
        </div>
      ))}
      {(calcMediana || calcMedia) && (
        <div className="pt-0.5 space-y-0.5">
          {calcMediana && <p className="text-[11px] leading-snug tabular-nums text-gray-500 dark:text-zinc-400">{calcMediana}</p>}
          {calcMedia && <p className="text-[11px] leading-snug tabular-nums text-gray-500 dark:text-zinc-400">{calcMedia}</p>}
        </div>
      )}
      <p className="text-[11px] leading-snug text-gray-400 dark:text-zinc-500">{legenda}</p>
    </div>
  );
}

function Grupos({ data }: { data: DetalheResponse }) {
  if (data.grupos.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-zinc-500">Sem detalhamento para este mês.</p>;
  }
  return (
    <div className="space-y-2">
      {data.grupos.map((g) => {
        const totalDisplay = g.formato === "num"
          ? int.format(g.itens.length ? g.itens.length + (g.itensOmitidos?.qtd ?? 0) : g.total)
          : brl.format(g.total);
        const prefixo = g.sinal ? `${g.sinal} ` : "";
        return (
          <details key={g.titulo} open={g.aberto ?? data.grupos.length <= 4} className="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
              <span>{prefixo}{g.titulo}</span>
              <span className="tabular-nums">{totalDisplay}</span>
            </summary>
            {g.itens.length > 0 && (
              <div className="border-t border-gray-100 dark:border-zinc-800">
                {g.itens.map((it, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-gray-800 dark:text-zinc-200">
                        {it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{it.nome}</a> : it.nome}
                      </p>
                      {(it.detalhe || it.data) && (
                        <p className="truncate text-gray-500 dark:text-zinc-500">{[it.detalhe, it.data].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                    {g.formato === "brl" && (
                      <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{brl.format(it.valor)}</span>
                    )}
                  </div>
                ))}
                {g.itensOmitidos && (
                  <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-500">
                    +{g.itensOmitidos.qtd} itens ({g.formato === "num" ? int.format(g.itensOmitidos.qtd) : brl.format(g.itensOmitidos.valor)})
                  </p>
                )}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

export function CeoKpiDetail({ kpiKey, mes, tom = "neutro", onClose }: { kpiKey: string | null; mes: string; tom?: string; onClose: () => void }) {
  const aberto = kpiKey !== null;
  const { data, isLoading, isError } = useQuery<DetalheResponse>({
    queryKey: ["/api/ceo-dashboard/detalhe", { kpi: kpiKey, mes }],
    enabled: aberto,
  });

  const acento = TOM_ACENTO[tom] ?? TOM_ACENTO.neutro;
  const temEvolucao = !!data?.evolucao && data.evolucao.length >= 2;
  const pct = data?.atingimentoPct ?? null;
  const barraLargura = pct != null ? Math.max(0, Math.min(100, pct)) : 0;

  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900 p-0">
        {/* Cabeçalho premium: eyebrow + título + realizado grande + barra de meta */}
        <div className="relative px-6 pt-6 pb-5 border-b border-gray-100 dark:border-zinc-800">
          <div className={`absolute inset-x-0 top-0 h-1 ${acento.barra}`} />
          <SheetHeader className="space-y-0 text-left">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">
              {data ? `${MESES[data.mes - 1]} 2026` : " "}
            </p>
            <SheetTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              {data?.titulo ?? "Detalhe"}
            </SheetTitle>
          </SheetHeader>

          {data && (
            <div className="mt-4">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">
                  {data.realizado != null ? formatValor(data.realizado, data.unidade) : "—"}
                </span>
                {pct != null && (
                  <span className={`mb-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${acento.chip}`}>
                    {Math.round(pct)}% da meta
                  </span>
                )}
              </div>
              {data.orcado != null && (
                <>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${acento.barra} transition-all`} style={{ width: `${barraLargura}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-500 tabular-nums">
                    Meta {formatValor(data.orcado, data.unidade)}
                  </p>
                </>
              )}
              {data.media != null && data.realizado != null && data.realizado > 0 && (
                <MedianaVsMedia mediana={data.realizado} media={data.media} soma={data.somaLtv} n={data.nClientes} unidade={data.unidade} corMediana={acento.barra} />
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          {isLoading && <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
          {isError && <p className="text-sm text-rose-600 dark:text-rose-400">Falha ao carregar o detalhamento.</p>}

          {data && !temEvolucao && (
            <>
              <Grupos data={data} />
              {data.nota && <p className="mt-4 text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>}
            </>
          )}

          {data && temEvolucao && (
            <Tabs defaultValue="evolucao">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="detalhe">Detalhamento</TabsTrigger>
                <TabsTrigger value="evolucao">Evolução</TabsTrigger>
              </TabsList>
              <TabsContent value="detalhe" className="mt-4">
                <Grupos data={data} />
                {data.nota && <p className="mt-4 text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>}
              </TabsContent>
              <TabsContent value="evolucao" className="mt-4">
                <div className="mb-3 flex items-center gap-4 text-xs text-gray-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${acento.barra}`} /> Realizado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0 w-4 border-t-2 border-dashed border-gray-400 dark:border-zinc-500" /> Meta
                  </span>
                </div>
                <CeoEvolucaoChart data={data.evolucao!} unidade={data.unidade} tom={tom} />
                <p className="mt-3 text-xs text-gray-500 dark:text-zinc-500">
                  Evolução mensal de {data.titulo.toLowerCase()} em 2026 · realizado vs meta do BP.
                </p>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
