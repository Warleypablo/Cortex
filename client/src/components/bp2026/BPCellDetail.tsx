// client/src/components/bp2026/BPCellDetail.tsx
import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { corAtingimento, type BPLinha } from "./BPDreTable";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const DERIVADAS: Record<string, string[]> = {
  // DRE originais
  receita_total_faturavel: ["mrr_ativo", "receita_pontual", "outras_receitas"],
  receita_liquida: ["receita_total_faturavel", "inadimplencia", "impostos_receita"],
  margem_bruta: ["receita_liquida", "csv_salarios", "csv_beneficio", "csv_stack"],
  ebitda: ["margem_bruta", "cac", "sga", "bonus"],
  geracao_caixa: ["ebitda", "impostos_diretos", "capex"],
  // Métricas Gerais
  receita_total: ["receita_total_faturavel", "inadimplencia"],
  despesa_total: ["impostos_receita", "csv_salarios", "csv_beneficio", "csv_stack", "cac", "sga", "bonus", "impostos_diretos", "capex"],
  receita_cabeca: ["receita_total_faturavel", "colaboradores"],
  mrr_cabeca: ["mrr_ativo", "colaboradores"],
  ticket_cliente: ["receita_total_faturavel", "clientes"],
  ticket_contrato: ["receita_total_faturavel", "contratos"],
  mrr_delta_nao_explicado: ["mrr_ativo", "vendas_mrr", "churn_mes"],
  aliquota_efetiva: ["impostos_receita", "impostos_diretos", "receita_total_faturavel"],
  margem_geracao: ["geracao_caixa", "receita_total_faturavel"],
  // Revenue — AOV por produto (5 linhas × 2 componentes)
  aov_performance: ["mrr_performance", "contratos_performance"],
  aov_creators: ["mrr_creators", "contratos_creators"],
  aov_social: ["mrr_social", "contratos_social"],
  aov_gc: ["mrr_gc", "contratos_gc"],
  aov_others: ["mrr_others", "contratos_others"],
  // Funil
  aov_venda_mrr: ["funil_vendas_mrr", "contratos_vendidos_mrr"],
  aov_venda_pontual: ["funil_vendas_pontual", "contratos_vendidos_pontual"],
  // Vendas por Produto — AOV por segmento (valor ÷ contratos)
  aov_venda_mrr_performance: ["vendas_mrr_performance", "contratos_vendidos_mrr_performance"],
  aov_venda_mrr_creators: ["vendas_mrr_creators", "contratos_vendidos_mrr_creators"],
  aov_venda_mrr_social: ["vendas_mrr_social", "contratos_vendidos_mrr_social"],
  aov_venda_mrr_gc: ["vendas_mrr_gc", "contratos_vendidos_mrr_gc"],
  aov_venda_mrr_others: ["vendas_mrr_others", "contratos_vendidos_mrr_others"],
  aov_venda_pontual_ecommerce: ["vendas_pontual_ecommerce", "contratos_vendidos_pontual_ecommerce"],
  aov_venda_pontual_site: ["vendas_pontual_site", "contratos_vendidos_pontual_site"],
  aov_venda_pontual_landing: ["vendas_pontual_landing", "contratos_vendidos_pontual_landing"],
  aov_venda_pontual_others: ["vendas_pontual_others", "contratos_vendidos_pontual_others"],
  // Capacity
  gestores_necessarios: ["cap_contratos_performance"],
  designers_necessarios: ["cap_contratos_performance"],
  necessidade_gestores: ["gestores_necessarios", "gestores_atuais"],
  contratos_por_gestor: ["cap_contratos_performance", "gestores_atuais"],
  contas_por_designer: ["cap_contratos_performance", "designers_atuais"],
  // SG&A
  sga_total_detalhe: ["sga_uzk", "sga_backoffice", "sga_software", "sga_ocupacao", "beneficio_total_empresa", "sga_premiacoes", "sga_eventos", "sga_outras"],
  // CAC
  cac_total_detalhe: ["cac_pre_vendas", "cac_vendas", "cac_gerencia", "cac_comissoes", "cac_growth", "cac_ads", "cac_eventos", "cac_brindes", "cac_viagens", "cac_outras_sub"],
  cac_pct_receita: ["cac_total_detalhe", "funil_vendas_mrr", "funil_vendas_pontual"],
  cac_payback_mrr: ["cac_total_detalhe", "funil_vendas_mrr"],
  // Outras Receitas
  or_total_detalhe: ["or_receita_variavel", "or_stack_digital", "or_demais"],
};

interface ItemDet { nome: string; detalhe: string; data: string | null; valor: number; url?: string }
interface GrupoDet { titulo: string; total: number; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number } }
interface DetalheResponse {
  metrica: string; mes: number; titulo: string;
  orcado: number | null; realizado: number | null;
  grupos: GrupoDet[];
  rateio?: { fracao: number; totalBruto: number; totalRateado: number };
  notaDinamica?: string;
  nota?: string;
}

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtUnidade(v: number | null | undefined, unidade?: "brl" | "int" | "pct" | "dec"): string {
  if (v === null || v === undefined) return "—";
  if (unidade === "pct") return `${(v * 100).toFixed(1)}%`;
  if (unidade === "int") return Math.round(v).toLocaleString("pt-BR");
  if (unidade === "dec") return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

interface Props {
  metrica: string | null;
  mes: number | null;
  linhas: BPLinha[];
  onClose: () => void;
}

export function BPCellDetail({ metrica, mes, linhas, onClose }: Props) {
  const aberto = metrica !== null && mes !== null;
  const ehDerivada = metrica !== null && metrica in DERIVADAS;

  const { data, isLoading, error } = useQuery<DetalheResponse>({
    queryKey: ["/api/bp2026/detalhe", { metrica: metrica ?? "", mes: String(mes ?? "") }],
    enabled: aberto && !ehDerivada,
  });

  const linha = linhas.find((l) => l.metrica === metrica);
  const celula = linha && mes ? linha.meses[mes - 1] : null;

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            {linha?.titulo} · {mes ? MESES[mes - 1] : ""} 2026
          </SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-zinc-400">
            Orçado {fmtUnidade(celula?.orcado, linha?.unidade)} · Realizado {fmtUnidade(celula?.realizado, linha?.unidade)}
            {celula?.atingimento != null && (
              <>
                {" · "}
                <span className={`font-semibold ${corAtingimento(celula.atingimento, linha?.direcao)}`}>
                  {(celula.atingimento * 100).toFixed(1)}%
                </span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {ehDerivada && linha && mes ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">
                Composição do mês (clique nas linhas-fonte da matriz para ver itens):
              </p>
              {DERIVADAS[metrica!].map((m) => {
                const comp = linhas.find((l) => l.metrica === m);
                const cm = comp?.meses[mes - 1];
                return (
                  <div key={m} className="flex items-center justify-between gap-2 rounded border border-gray-100 dark:border-zinc-800 px-3 py-2 text-sm">
                    <span className="text-gray-800 dark:text-zinc-200">{comp?.titulo ?? m}</span>
                    <span className="flex items-baseline gap-2 shrink-0">
                      <span className="text-[11px] tabular-nums text-gray-500 dark:text-zinc-500">
                        orç {fmtUnidade(cm?.orcado, comp?.unidade)}
                      </span>
                      <span className="tabular-nums text-gray-900 dark:text-white">{fmtUnidade(cm?.realizado, comp?.unidade)}</span>
                      <span className={`text-[11px] font-semibold tabular-nums ${corAtingimento(cm?.atingimento ?? null, comp?.direcao)}`}>
                        {cm?.atingimento != null ? `${(cm.atingimento * 100).toFixed(1)}%` : "—"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar o detalhamento.</p>
          ) : data.grupos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500">Sem itens neste mês.</p>
          ) : (
            <>
              {data.grupos.map((g) => {
                // grupos cujos itens não carregam valor próprio (contagens e numeradores
                // de taxa) mostram a quantidade; os demais, a soma em R$
                const isInt = linha?.unidade === "int" || g.itens.every((it) => it.valor === 0);
                const totalGrupo = isInt
                  ? (g.itens.length + (g.itensOmitidos?.qtd ?? 0)).toLocaleString("pt-BR")
                  : fmt(g.total);
                return (
                  <details key={g.titulo} open={data.grupos.length <= 3} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                    <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <span>{g.titulo}</span>
                      <span className="tabular-nums">{totalGrupo}</span>
                    </summary>
                    <div className="border-t border-gray-100 dark:border-zinc-800">
                      {g.itens.map((it, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                          <div className="min-w-0">
                            <p className="truncate text-gray-800 dark:text-zinc-200">
                              {it.url ? (
                                <a href={it.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{it.nome}</a>
                              ) : it.nome}
                            </p>
                            {(it.detalhe || it.data) && (
                              <p className="truncate text-gray-500 dark:text-zinc-500">
                                {[it.detalhe, it.data].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                          {(!isInt || it.valor !== 0) && (
                            <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{fmt(it.valor)}</span>
                          )}
                        </div>
                      ))}
                      {g.itensOmitidos && (
                        <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-500">
                          +{g.itensOmitidos.qtd} itens ({isInt ? g.itensOmitidos.qtd.toLocaleString("pt-BR") : fmt(g.itensOmitidos.valor)})
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}
              {data.rateio && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  Caju total {fmt(data.rateio.totalBruto)} × fração orçada {(data.rateio.fracao * 100).toFixed(1)}% =
                  <strong> {fmt(data.rateio.totalRateado)}</strong> (valor da célula)
                </div>
              )}
              {data.notaDinamica && (
                <p className="text-xs text-gray-500 dark:text-zinc-500">{data.notaDinamica}</p>
              )}
              {data.nota && (
                <p className="text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
