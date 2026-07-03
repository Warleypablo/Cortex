// client/src/components/gestao/CacPorCanal.tsx
// Seção "CAC por canal — variáveis de custo" (aba Macro da Gestão de Receita).
// CAC gerencial: custos manuais editáveis por mês (Editar metas) + incentivos
// automáticos por cliente. Clientes = deals ganhos Bitrix por macro-canal.
import { Card, CardContent } from "@/components/ui/card";
import { Filter } from "lucide-react";
import { Fonte, MetaInput, Nota, BlockHead, SectionCard, brl, intBR, type MetasCtx } from "./gestaoUi";
import type { DrillRef } from "./GestaoReceitaDetalhe";

export interface CacCanalItem { id: string; label: string; valor: number; fonte: "auto" | "manual" }
export interface CacCanalCard {
  id: string; label: string; clientes: number; custoTotal: number; cacCliente: number | null;
  sources: string[];
  itens: CacCanalItem[];
  incentivo?: { label: string; unit: number; qtd: number; total: number };
}
export interface CacCanaisData {
  geral: { cac: number | null; clientes: number; custoTotal: number };
  canais: CacCanalCard[];
}

export function CacPorCanal({ dados, metas, onDrill }: { dados: CacCanaisData; metas: MetasCtx; onDrill: (dr: DrillRef) => void }) {
  // valores "ao vivo" durante a edição (mesma mecânica da tabela Custo da operação);
  // fora do modo edição, metas.get devolve o fallback (valor do payload).
  // Item automático (spend de ads) não é editável — sempre o valor do payload.
  const itemVivo = (c: CacCanalCard, it: CacCanalItem) =>
    it.fonte === "auto" ? it.valor : metas.get(`cac_canal:${c.id}:${it.id}`, it.valor);
  const unitVivo = (c: CacCanalCard) => metas.get(`cac_canal_unit:${c.id}`, c.incentivo?.unit ?? 0);
  // fora de edição, usa o total do payload (em multi-mês o unitário pode ter variado
  // entre meses, e unit × qtd divergiria do cálculo mês a mês do backend)
  const incentivoVivo = (c: CacCanalCard) =>
    c.incentivo ? (metas.editando ? unitVivo(c) * c.incentivo.qtd : c.incentivo.total) : 0;
  const custoVivo = (c: CacCanalCard) => c.itens.reduce((a, it) => a + itemVivo(c, it), 0) + incentivoVivo(c);
  const geralCusto = dados.canais.reduce((a, c) => a + custoVivo(c), 0);
  const geralCac = dados.geral.clientes > 0 ? Math.round(geralCusto / dados.geral.clientes) : null;

  return (
    <div>
      <BlockHead icon={<Filter className="h-4 w-4" />} title="CAC por canal — variáveis de custo" />
      <SectionCard>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Como é calculado</div>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
          CAC do canal = soma das variáveis de custo ÷ nº de clientes fechados do canal (Bitrix).
          Custos manuais editáveis; incentivos por cliente automáticos.
        </p>
        <div className="mt-3 text-3xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{geralCac != null ? brl(geralCac) : "—"}</div>
        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          CAC geral · {intBR(dados.geral.clientes)} clientes
        </div>
      </SectionCard>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {dados.canais.map((c) => {
          const custo = custoVivo(c);
          const cac = c.clientes > 0 ? Math.round(custo / c.clientes) : null;
          return (
            <Card
              key={c.id}
              onClick={metas.editando ? undefined : () => onDrill({ tipo: "cac_canal", chave: c.id })}
              className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 ${metas.editando ? "" : "cursor-pointer transition hover:border-teal-400 hover:shadow-sm dark:hover:border-teal-600"}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2 dark:border-zinc-800">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.label}</span>
                  <span className="text-right">
                    <span className="block text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{cac != null ? brl(cac) : "—"}</span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">CAC / cliente</span>
                  </span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {c.itens.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-gray-700 dark:text-zinc-300">{it.label}</span>
                      {it.fonte === "auto" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{brl(it.valor)}</span>
                          <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-300">auto</span>
                        </span>
                      ) : metas.editando
                        ? <MetaInput chave={`cac_canal:${c.id}:${it.id}`} valorAtual={it.valor} metas={metas} />
                        : <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{brl(it.valor)}</span>}
                    </div>
                  ))}
                  {c.incentivo && (
                    <div className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-gray-700 dark:text-zinc-300">
                        {c.incentivo.label}{" "}
                        {metas.editando
                          ? <MetaInput chave={`cac_canal_unit:${c.id}`} valorAtual={c.incentivo.unit} metas={metas} />
                          : <b className="tabular-nums">{brl(unitVivo(c))}</b>}{" "}
                        / cliente × {intBR(c.incentivo.qtd)}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-500 dark:text-zinc-400">{brl(incentivoVivo(c))}</span>
                    </div>
                  )}
                  {c.itens.length === 0 && !c.incentivo && (
                    <div className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-gray-500 dark:text-zinc-400">Sem custo direto</span>
                      <span className="text-gray-400 dark:text-zinc-500">—</span>
                    </div>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-sm dark:border-zinc-800">
                  <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-zinc-400">
                    Clientes <b className="tabular-nums text-gray-900 dark:text-white">{intBR(c.clientes)}</b> <Fonte tipo="bitrix" />
                  </span>
                  <span className="text-gray-600 dark:text-zinc-400">
                    Custo total <b className="tabular-nums text-gray-900 dark:text-white">{brl(custo)}</b>
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Nota>
        Visão gerencial: custos informados manualmente por mês (botão "Editar metas", mês único) + itens automáticos.
        "Investimento em anúncios" (auto) = spend Meta + Google + TikTok + LinkedIn das contas da Turbo no período (competência, não caixa);
        incentivos por cliente também são automáticos. Não bate com o card "CAC — custo de aquisição" (Conta Azul, regime caixa) por design.
        Parceria ainda não tem source no CRM (clientes 0). Deals de sources fora dos 10 canais (ex.: sem origem) ficam fora desta seção.
      </Nota>

      {/* De-para canal → origem: como cada macro-canal agrupa os sources do Bitrix
          (mesmos nomes da tabela "Resultado por canal de aquisição"). Vem do
          catálogo do backend — fonte única, não duplicar aqui. */}
      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          De-para: canal do CAC → origem (source) do Bitrix
        </div>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          {dados.canais.map((c) => (
            <div key={c.id} className="text-xs text-gray-600 dark:text-zinc-400">
              <b className="text-gray-800 dark:text-zinc-200">{c.label}</b>
              {": "}
              {c.sources.length > 0 ? c.sources.join(", ") : "sem source no CRM ainda"}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-zinc-500">
          Clientes do canal = deals ganhos no mês dessas origens; são os mesmos sources da tabela
          "Resultado por canal de aquisição" (lá sem agrupar).
        </p>
      </div>
    </div>
  );
}
