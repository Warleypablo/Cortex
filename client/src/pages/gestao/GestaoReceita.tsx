// client/src/pages/gestao/GestaoReceita.tsx
// Painel "Gestão de Receita" — Orçado × Realizado da área comercial.
// Orçado: BP 2026. Venda nova: Bitrix. Custos: regime caixa (Conta Azul).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodoSelector } from "@/components/PeriodoSelector";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Target, Layers, Filter, ShieldCheck, TrendingUp, TrendingDown,
  Trophy, AlertTriangle, Wallet, Database, Info, PencilLine,
} from "lucide-react";
import { GestaoReceitaDetalhe, type DrillRef } from "@/components/gestao/GestaoReceitaDetalhe";

// classe das linhas/elementos clicáveis (drill-down)
const rowClick = "cursor-pointer transition hover:bg-gray-50 dark:hover:bg-zinc-800/50";

/* ---------- tipos ---------- */
type Stat = { orcado: number; realizado: number; editavel?: boolean; chave?: string };
// contexto de edição de metas (override): quando editando, os campos de meta viram inputs
interface MetasCtx { editando: boolean; get: (chave: string, fallback: number) => number; set: (chave: string, valor: number) => void; }
interface CloserRow { nome: string; mrr: number; pont: number; deals: number; reunioes: number; score: number; conv: number; ticket: number; }
interface SdrRow { nome: string; leads: number; reunioes: number; mrr: number; pont: number; valor: number; conv: number; }
interface ProdutoRow {
  produto: string; cMrr: number; mrr: number; tmMrr: number; cPont: number; pont: number; tmPont: number;
  metaTmMrr: number | null; metaCtrMrr: number | null; metaTmPont: number | null; metaCtrPont: number | null;
  orcadoMrr: number | null; orcadoPont: number | null;
}
interface GestaoReceitaData {
  mes: string; mesNum: number; ano: number; mesParcial: boolean;
  macro: {
    vendaMrr: Stat; vendaPontual: Stat;
    ticketMrr: number; ticketPontual: number; taxaConversao: number; numReunioes: number;
    canais: { canal: string; canalLabel: string; deals: number; reunioes: number; conv: number; mrr: number; pont: number; total: number; ticketMrr: number; ticketPont: number }[];
    cac: {
      custoTotal: Stat;
      produto: { orcado: number; realizado: number; n: number };
      cliente: { orcado: number; realizado: number; n: number };
    };
  };
  pessoas: { custoComercial: Stat; comissoes: Stat; closers: CloserRow[]; sdrs: SdrRow[] };
  micro: { produtos: ProdutoRow[]; vendedores: CloserRow[]; sdrs: SdrRow[] };
  funil: {
    inbound: { etapa: string; valor: number; mql: number }[];
    outbound: { etapa: string; valor: number; mql: number }[];
    mql: { classe: string; leads: number; rr: number; ganhos: number }[];
    investimento: { metaAdsSpend: number; adsContaAzul: number; leadsInbound: number; mqlsInbound: number; cpl: number; cplMq: number };
  };
  qualidade: {
    churnPorMotivo: { motivo: string; qtd: number; valor: number }[];
    churnPorVendedor: { vendedor: string; qtd: number; valor: number }[];
    total: { qtd: number; valor: number };
  };
}

/* ---------- formatadores ---------- */
const brl = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
const brlk = (n: number) => {
  if (Math.abs(n) >= 1000) return "R$ " + (n / 1000).toFixed(Math.abs(n) % 1000 === 0 ? 0 : 1) + "k";
  return brl(n);
};
const pct = (n: number) => (Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0") + "%";
const intBR = (n: number) => Math.round(n).toLocaleString("pt-BR");

function statusClasses(atingimento: number, lowerIsBetter = false) {
  const good = lowerIsBetter ? atingimento <= 100 : atingimento >= 100;
  const warn = lowerIsBetter ? atingimento <= 110 : atingimento >= 90;
  if (good) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (warn) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };
}

/* ---------- componentes base ---------- */
function Fonte({ tipo }: { tipo: "bitrix" | "clickup" | "bp" | "caixa" | "meta" }) {
  const map = {
    bitrix: { label: "Bitrix", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    clickup: { label: "ClickUp", cls: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
    bp: { label: "BP 2026", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    caixa: { label: "Conta Azul", cls: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
    meta: { label: "Meta Ads", cls: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
  } as const;
  const m = map[tipo];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

// input de meta editável (override); stopPropagation evita disparar o drill do card ao clicar
function MetaInput({ chave, valorAtual, metas, prefix = "R$" }: { chave: string; valorAtual: number; metas: MetasCtx; prefix?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 dark:border-amber-800 dark:bg-amber-950/40" onClick={(e) => e.stopPropagation()}>
      {prefix && <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{prefix}</span>}
      <input
        type="number"
        value={metas.get(chave, valorAtual)}
        onChange={(e) => metas.set(chave, Number(e.target.value))}
        className="w-20 bg-transparent text-right text-xs font-semibold tabular-nums text-amber-800 outline-none dark:text-amber-300"
      />
    </span>
  );
}

function StatOR({ label, stat, lowerIsBetter = false, money = true, fonte, onClick, metas }: {
  label: string; stat: Stat; lowerIsBetter?: boolean; money?: boolean; fonte?: React.ReactNode; onClick?: () => void; metas?: MetasCtx;
}) {
  const atg = stat.orcado ? (stat.realizado / stat.orcado) * 100 : 0;
  const cls = statusClasses(atg, lowerIsBetter);
  const fmt = money ? brl : intBR;
  const delta = stat.realizado - stat.orcado;
  const good = lowerIsBetter ? delta <= 0 : delta >= 0;
  const editandoMeta = !!(metas?.editando && stat.editavel && stat.chave);
  return (
    <Card
      onClick={editandoMeta ? undefined : onClick}
      className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 ${onClick && !editandoMeta ? "cursor-pointer transition hover:border-teal-400 hover:shadow-sm dark:hover:border-teal-600" : ""}`}
    >
      <CardContent className="pt-4 pb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{label}</span>
          {fonte}
        </div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className={`text-2xl font-bold tabular-nums ${cls.text}`}>{fmt(stat.realizado)}</span>
          {editandoMeta
            ? <span className="text-xs text-gray-500 dark:text-zinc-400">meta <MetaInput chave={stat.chave!} valorAtual={stat.orcado} metas={metas!} prefix={money ? "R$" : ""} /></span>
            : <span className="text-xs text-gray-500 dark:text-zinc-400">orçado <b className="tabular-nums text-gray-600 dark:text-zinc-300">{fmt(stat.orcado)}</b></span>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded bg-gray-100 dark:bg-zinc-800">
          <div className={`h-full rounded ${cls.bar}`} style={{ width: Math.min(Math.max(atg, 0), 100) + "%" }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={`font-semibold tabular-nums ${cls.text}`}>{pct(atg)} do plano</span>
          <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}{fmt(delta)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// card simples de KPI (sem orçado), opcionalmente clicável para drill
function KpiCard({ label, valor, sub, fonte, onClick }: { label: string; valor: string; sub?: string; fonte?: React.ReactNode; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 ${onClick ? "cursor-pointer transition hover:border-teal-400 hover:shadow-sm dark:hover:border-teal-600" : ""}`}>
      <CardContent className="pt-4 pb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{label}</span>
          {fonte}
        </div>
        <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{valor}</span>
        {sub && <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function VarPill({ orcado, realizado, lowerIsBetter = false }: { orcado: number; realizado: number; lowerIsBetter?: boolean }) {
  const d = orcado ? ((realizado - orcado) / orcado) * 100 : 0;
  const good = lowerIsBetter ? d <= 0 : d >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${good ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
      {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {d >= 0 ? "+" : ""}{d.toFixed(0)}%
    </span>
  );
}

function SectionCard({ title, fonte, children, className = "" }: { title?: string; fonte?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 ${className}`}>
      <CardContent className="pt-4 pb-4">
        {title && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{title}</h3>
            {fonte}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function BlockHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">{icon}</span>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
    </div>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* ---------- ranking (closers/sdr) ---------- */
function Ranking({ rows, tone, onItemClick }: { rows: { nome: string; primary: string; sub: string }[]; tone: "top" | "bot"; onItemClick?: (nome: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div
          key={i}
          onClick={onItemClick ? () => onItemClick(r.nome) : undefined}
          className={`flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-800/50 ${onItemClick ? "cursor-pointer transition hover:border-teal-400 dark:hover:border-teal-600" : ""}`}
        >
          <span className={`flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-white ${tone === "top" ? "bg-emerald-500" : "bg-red-500"}`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{r.nome}</div>
            <div className="truncate text-[10px] tabular-nums text-gray-500 dark:text-zinc-400">{r.sub}</div>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-white">{r.primary}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================ SEÇÕES ============================================================ */
function SecaoPessoas({ d, onDrill }: { d: GestaoReceitaData; onDrill: (dr: DrillRef) => void }) {
  const closersTop = d.pessoas.closers.slice(0, 3).map((c) => ({ nome: c.nome, primary: brlk(c.score), sub: `MRR ${brlk(c.mrr)} + Pont ${brlk(c.pont)}/5` }));
  const closersBot = d.pessoas.closers.slice(-3).reverse().map((c) => ({ nome: c.nome, primary: brlk(c.score), sub: `MRR ${brlk(c.mrr)} + Pont ${brlk(c.pont)}/5` }));
  const sdrTop = d.pessoas.sdrs.slice(0, 3).map((s) => ({ nome: s.nome, primary: brlk(s.valor), sub: `${s.reunioes} reuniões · ${s.leads} leads` }));
  const sdrBot = d.pessoas.sdrs.slice(-3).reverse().map((s) => ({ nome: s.nome, primary: brlk(s.valor), sub: `${s.reunioes} reuniões · ${s.leads} leads` }));
  const drillCloser = (nome: string) => onDrill({ tipo: "closer", chave: nome });
  const drillSdr = (nome: string) => onDrill({ tipo: "sdr", chave: nome });
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Wallet className="h-4 w-4" />} title="Custo do time comercial — Orçado × Realizado" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatOR label="Custo comercial (Vendas + Pré-vendas)" stat={d.pessoas.custoComercial} lowerIsBetter fonte={<Fonte tipo="caixa" />} onClick={() => onDrill({ tipo: "custo_comercial" })} />
          <StatOR label="Comissões" stat={d.pessoas.comissoes} lowerIsBetter fonte={<Fonte tipo="caixa" />} onClick={() => onDrill({ tipo: "comissoes" })} />
        </div>
      </div>
      <div>
        <BlockHead icon={<Trophy className="h-4 w-4" />} title="Top 3 / Bottom 3 — performance individual" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SectionCard title="Closers · Top 3" fonte={<Fonte tipo="bitrix" />}>{closersTop.length ? <Ranking rows={closersTop} tone="top" onItemClick={drillCloser} /> : <Vazio />}</SectionCard>
          <SectionCard title="Closers · Bottom 3" fonte={<Fonte tipo="bitrix" />}>{closersBot.length ? <Ranking rows={closersBot} tone="bot" onItemClick={drillCloser} /> : <Vazio />}</SectionCard>
          <SectionCard title="Pré-vendas (SDR) · Top 3" fonte={<Fonte tipo="bitrix" />}>{sdrTop.length ? <Ranking rows={sdrTop} tone="top" onItemClick={drillSdr} /> : <Vazio />}</SectionCard>
          <SectionCard title="Pré-vendas (SDR) · Bottom 3" fonte={<Fonte tipo="bitrix" />}>{sdrBot.length ? <Ranking rows={sdrBot} tone="bot" onItemClick={drillSdr} /> : <Vazio />}</SectionCard>
        </div>
        <Nota>Closers ordenados por <b>score = MRR + Pontual ÷ 5</b>. Pré-vendas ordenados pelo <b>valor gerado</b> nas vendas atribuídas ao SDR. Quem acumula os dois papéis (ex.: atua como closer e SDR) aparece nas duas listas — é o mesmo cadastro, não duplicidade.</Nota>
      </div>
    </div>
  );
}

function SecaoMacro({ d, onDrill, metas }: { d: GestaoReceitaData; onDrill: (dr: DrillRef) => void; metas: MetasCtx }) {
  const { canais, cac } = d.macro;
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Target className="h-4 w-4" />} title="Venda nova — Orçado × Realizado" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatOR label="Venda de MRR (recorrente nova)" stat={d.macro.vendaMrr} fonte={<Fonte tipo="bitrix" />} onClick={() => onDrill({ tipo: "venda_mrr" })} metas={metas} />
          <StatOR label="Venda Pontual" stat={d.macro.vendaPontual} fonte={<Fonte tipo="bitrix" />} onClick={() => onDrill({ tipo: "venda_pontual" })} metas={metas} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Ticket Médio MRR" valor={brl(d.macro.ticketMrr)} fonte={<Fonte tipo="bitrix" />} onClick={() => onDrill({ tipo: "venda_mrr" })} />
          <KpiCard label="Ticket Médio Pontual" valor={brl(d.macro.ticketPontual)} fonte={<Fonte tipo="bitrix" />} onClick={() => onDrill({ tipo: "venda_pontual" })} />
          <KpiCard label="Taxa de Conversão" valor={pct(d.macro.taxaConversao)} sub="reunião → venda (coorte)" fonte={<Fonte tipo="bitrix" />} />
          <KpiCard label="Nº de Reuniões" valor={intBR(d.macro.numReunioes)} sub="realizadas no mês" fonte={<Fonte tipo="bitrix" />} onClick={() => onDrill({ tipo: "funil_etapa", chave: "rr" })} />
        </div>
        {d.mesParcial && <Nota>Conversão por coorte: no mês em andamento as reuniões recentes ainda não fecharam, então a taxa tende a subir até o mês fechar.</Nota>}
      </div>
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Resultado por canal de aquisição" />
        <SectionCard title="Reuniões, deals ganhos, valor vendido e ticket médio por canal" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <Th left>Canal</Th><Th>Reuniões</Th><Th>Deals</Th><Th>Tx conv.</Th><Th>Vendido MRR</Th><Th>Vendido Pont.</Th><Th>Total</Th><Th>Ticket Rec.</Th><Th>Ticket Pont.</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canais.map((c) => (
                  <TableRow key={c.canal} onClick={() => onDrill({ tipo: "canal", chave: c.canal })} className={rowClick}>
                    <Td left>{c.canalLabel}</Td><Td>{intBR(c.reunioes)}</Td><Td>{intBR(c.deals)}</Td><Td>{pct(c.conv)}</Td><Td>{brl(c.mrr)}</Td><Td>{brl(c.pont)}</Td><Td>{brl(c.total)}</Td><Td>{brl(c.ticketMrr)}</Td><Td>{brl(c.ticketPont)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota>Canal = campo <code>source</code> do Bitrix. <b>"(não informado)"</b> é um bucket legítimo — boa parte dos deals não tem origem preenchida no CRM. Tx conv. por coorte: das reuniões realizadas no período, % que virou venda. Ticket Rec./Pont. = valor vendido ÷ deals com valor daquele tipo. Canais com reunião e sem venda aparecem com 0 deals.</Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Target className="h-4 w-4" />} title="CAC — custo de aquisição" />
        <div className="mb-3">
          <StatOR label="Custo comercial total (CAC)" stat={cac.custoTotal} lowerIsBetter fonte={<Fonte tipo="caixa" />} onClick={() => onDrill({ tipo: "cac" })} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatOR label={`CAC por contrato  ·  ${cac.produto.n} contratos novos`} stat={cac.produto} lowerIsBetter fonte={<Fonte tipo="caixa" />} onClick={() => onDrill({ tipo: "cac" })} />
          <StatOR label={`CAC por cliente  ·  ${cac.cliente.n} clientes novos`} stat={cac.cliente} lowerIsBetter fonte={<Fonte tipo="caixa" />} onClick={() => onDrill({ tipo: "cac" })} />
        </div>
        <Nota>CAC = custo comercial total ÷ novos adquiridos no mês. Realizado: contratos novos (ClickUp) e clientes novos (deals ganhos Bitrix). Orçado: contratos/clientes vendidos do BP.</Nota>
      </div>
    </div>
  );
}

function ProdutoTabela({ produtos, tipo, onDrill, metas }: { produtos: ProdutoRow[]; tipo: "mrr" | "pont"; onDrill: (dr: DrillRef) => void; metas: MetasCtx }) {
  const isMrr = tipo === "mrr";
  return (
    <SectionCard title={isMrr ? "Venda de MRR por produto" : "Venda Pontual por produto"} fonte={<Fonte tipo="clickup" />}>
      <TableScroll>
        <Table>
          <TableHeader>
            <TableRow>
              <Th left>Produto</Th><Th>Contratos</Th><Th>Vendido</Th><Th>TM real</Th><Th>Meta contr.</Th><Th>Meta TM</Th><Th>Orçado</Th><Th>Var.</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtos.map((p) => {
              const c = isMrr ? p.cMrr : p.cPont;
              const vendido = isMrr ? p.mrr : p.pont;
              const tm = isMrr ? p.tmMrr : p.tmPont;
              const metaCtr = isMrr ? p.metaCtrMrr : p.metaCtrPont;
              const metaTm = isMrr ? p.metaTmMrr : p.metaTmPont;
              const orcado = isMrr ? p.orcadoMrr : p.orcadoPont;
              return (
                <TableRow key={p.produto} onClick={metas.editando ? undefined : () => onDrill({ tipo: "produto", chave: p.produto })} className={metas.editando ? "" : rowClick}>
                  <Td left>{p.produto}</Td>
                  <Td>{intBR(c)}</Td><Td>{brl(vendido)}</Td><Td>{tm ? brl(tm) : "—"}</Td>
                  <Td>{metas.editando ? <MetaInput chave={`prod_ctr_${tipo}:${p.produto}`} valorAtual={metaCtr ?? 0} metas={metas} prefix="" /> : (metaCtr != null ? intBR(metaCtr) : "—")}</Td>
                  <Td>{metas.editando ? <MetaInput chave={`prod_tm_${tipo}:${p.produto}`} valorAtual={metaTm ?? 0} metas={metas} /> : (metaTm != null ? brl(metaTm) : "—")}</Td>
                  <Td>{orcado != null ? brl(orcado) : "—"}</Td>
                  <Td>{orcado != null && orcado > 0 ? <VarPill orcado={orcado} realizado={vendido} /> : "—"}</Td>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableScroll>
    </SectionCard>
  );
}

function SecaoMicro({ d, onDrill, metas }: { d: GestaoReceitaData; onDrill: (dr: DrillRef) => void; metas: MetasCtx }) {
  const { produtos, vendedores, sdrs } = d.micro;
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Layers className="h-4 w-4" />} title="Venda por produto — MRR e Pontual" />
        <div className="space-y-3">
          <ProdutoTabela produtos={produtos} tipo="mrr" onDrill={onDrill} metas={metas} />
          <ProdutoTabela produtos={produtos} tipo="pont" onDrill={onDrill} metas={metas} />
        </div>
        <Nota>Base ClickUp por <code>data_criado</code> (mesma régua do <b>BP 2026</b>). <b>Orçado</b> por produto = <b>meta de nº contratos × meta de ticket médio</b> (editáveis no botão "Metas"). O pontual é deduplicado por jornada, então fica menor que o BP; a venda comercial real está na aba <b>Macro</b> (Bitrix).</Nota>
      </div>
      <div>
        <BlockHead icon={<Users className="h-4 w-4" />} title="Performance por vendedor (Closer)" />
        <SectionCard title="Vendido MRR/Pontual, ticket médio e conversão" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow><Th left>Vendedor</Th><Th>Vendido MRR</Th><Th>Vendido Pont.</Th><Th>Ticket médio</Th><Th>Deals</Th><Th>Reuniões</Th><Th>Conv. reun→venda</Th></TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.map((v) => (
                  <TableRow key={v.nome} onClick={() => onDrill({ tipo: "closer", chave: v.nome })} className={rowClick}>
                    <Td left>{v.nome}</Td><Td>{brl(v.mrr)}</Td><Td>{brl(v.pont)}</Td><Td>{brl(v.ticket)}</Td><Td>{intBR(v.deals)}</Td><Td>{intBR(v.reunioes)}</Td>
                    <Td className="font-semibold text-teal-700 dark:text-teal-400">{pct(v.conv)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota>Ticket médio = total vendido ÷ deals ganhos. <b>Conversão direta</b>: deals ganhos no mês ÷ reuniões realizadas no mês (coortes distintas — o deal pode ter tido reunião em mês anterior; pode passar de 100%).</Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Users className="h-4 w-4" />} title="Performance por pré-vendas (SDR)" />
        <SectionCard title="Leads, reuniões, valor gerado (MRR × Pontual) e conversão" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow><Th left>Pré-vendedor</Th><Th>Leads</Th><Th>Reuniões</Th><Th>Gerado MRR</Th><Th>Gerado Pont.</Th><Th>Conv. lead→reun.</Th></TableRow>
              </TableHeader>
              <TableBody>
                {sdrs.map((s) => (
                  <TableRow key={s.nome} onClick={() => onDrill({ tipo: "sdr", chave: s.nome })} className={rowClick}>
                    <Td left>{s.nome}</Td><Td>{intBR(s.leads)}</Td><Td>{intBR(s.reunioes)}</Td><Td>{brl(s.mrr)}</Td><Td>{brl(s.pont)}</Td>
                    <Td className="font-semibold text-teal-700 dark:text-teal-400">{pct(s.conv)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota><b>Conversão por coorte</b>: dos leads criados no mês, % que teve reunião realizada. <b>Valor gerado</b> (MRR/Pontual) é da venda atribuída ao SDR (o mesmo deal também conta para o closer; não some as listas).</Nota>
        </SectionCard>
      </div>
    </div>
  );
}

// funil Lead→RA→RR→Venda; se `empilhado`, cada barra mostra composição MQL (verde) / NMQL (cinza)
function FunilView({ etapas, seg, empilhado, onDrill }: { etapas: { etapa: string; valor: number; mql: number }[]; seg: "inbound" | "outbound"; empilhado: boolean; onDrill: (dr: DrillRef) => void }) {
  const topo = etapas[0]?.valor || 1;
  const etapaChave = ["lead", "ra", "rr", "venda"];
  const globalConv = topo ? (etapas[etapas.length - 1].valor / topo) * 100 : 0;
  return (
    <>
      {empilhado && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-zinc-300"><span className="h-3 w-3 rounded bg-gradient-to-r from-teal-400 to-teal-600" /> MQL</span>
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-zinc-300"><span className="h-3 w-3 rounded bg-gray-300 dark:bg-zinc-600" /> NMQL (não-MQL)</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-300">Conversão Lead→Venda <b className="tabular-nums">{pct(globalConv)}</b></span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {etapas.map((e, i) => {
          const prev = i > 0 ? etapas[i - 1].valor : null;
          const convEtapa = prev ? (e.valor / prev) * 100 : null;
          const convAcum = (e.valor / topo) * 100;
          const mqlPct = e.valor ? (e.mql / e.valor) * 100 : 0;
          return (
            <div
              key={e.etapa}
              onClick={() => onDrill({ tipo: "funil_etapa", chave: `${seg}:${etapaChave[i]}` })}
              className="grid grid-cols-[130px_1fr_150px] items-center gap-3 rounded-md cursor-pointer transition hover:bg-gray-50 dark:hover:bg-zinc-800/50"
            >
              <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300">{e.etapa}</span>
              <div className="flex items-center gap-2">
                <div className="flex h-8 overflow-hidden rounded-md bg-gray-100 dark:bg-zinc-800" style={{ width: Math.max(convAcum, 5) + "%" }}>
                  {empilhado ? (
                    <>
                      <div className="flex h-full items-center justify-center bg-gradient-to-r from-teal-400 to-teal-600 text-[10px] font-bold text-white" style={{ width: mqlPct + "%" }}>{mqlPct >= 18 ? Math.round(mqlPct) + "%" : ""}</div>
                      <div className="flex h-full items-center justify-center bg-gray-300 text-[10px] font-bold text-gray-600 dark:bg-zinc-600 dark:text-zinc-200" style={{ width: 100 - mqlPct + "%" }}>{100 - mqlPct >= 18 ? Math.round(100 - mqlPct) + "%" : ""}</div>
                    </>
                  ) : (
                    <div className="h-full w-full bg-gradient-to-r from-teal-400 to-teal-600" />
                  )}
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900 dark:text-white">{intBR(e.valor)}</span>
              </div>
              <span className="text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">
                {convEtapa != null ? <><b className="text-gray-800 dark:text-zinc-100">{pct(convEtapa)}</b> etapa · </> : "topo · "}{pct(convAcum)} acum.
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SecaoFunil({ d, onDrill }: { d: GestaoReceitaData; onDrill: (dr: DrillRef) => void }) {
  const { inbound, outbound, investimento: inv } = d.funil;
  const leadsInb = inbound[0]?.valor || 0;
  const mqlInb = inbound[0]?.mql || 0;
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Funil Inbound — Lead → RA → RR → Venda" />
        <SectionCard title="Composição MQL / NMQL por etapa · origem inbound (WEBFORM/WEB/ADVERTISING/CALL/EMAIL…)" fonte={<Fonte tipo="bitrix" />}>
          <FunilView etapas={inbound} seg="inbound" empilhado onDrill={onDrill} />
          <Nota>
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
            <b>MQL</b> = campo <code>mql</code> preenchido no Bitrix; <b>NMQL</b> = o resto (inclui não-classificados). Hoje só {leadsInb > 0 ? pct((mqlInb / leadsInb) * 100) : "—"} dos leads inbound estão marcados como MQL — a fatia verde fica pequena porque o CRM classifica poucos.
          </Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Funil Outbound — Lead → RA → RR → Venda" />
        <SectionCard title="Prospecção ativa / demais origens (inclui deals sem origem preenchida)" fonte={<Fonte tipo="bitrix" />}>
          <FunilView etapas={outbound} seg="outbound" empilhado={false} onDrill={onDrill} />
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Wallet className="h-4 w-4" />} title="Investimento & CPL (mídia paga)" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Investimento Meta Ads" valor={brl(inv.metaAdsSpend)} sub="spend do mês (meta_ads)" fonte={<Fonte tipo="meta" />} />
          <KpiCard label="ADs (Conta Azul)" valor={brl(inv.adsContaAzul)} sub="regime caixa 06.06.01" fonte={<Fonte tipo="caixa" />} onClick={() => onDrill({ tipo: "cac" })} />
          <KpiCard label="CPL" valor={brl(inv.cpl)} sub={`spend Meta ÷ ${intBR(inv.leadsInbound)} leads inbound`} fonte={<Fonte tipo="meta" />} />
          <KpiCard label="CPL-MQ" valor={brl(inv.cplMq)} sub={`spend Meta ÷ ${intBR(inv.mqlsInbound)} MQLs`} fonte={<Fonte tipo="meta" />} />
        </div>
        <Nota>Os dois cards medem <b>essencialmente o mesmo gasto (Meta)</b> por lentes diferentes — <b>não somar</b>. <b>Investimento Meta Ads</b> = spend por <b>veiculação</b> no mês (<code>meta_ads.meta_insights_daily</code>, competência). <b>ADs (Conta Azul)</b> = a fatura paga pelo <b>caixa</b> na 06.06.01 (99% Facebook + pouco TikTok; <b>não tem Google</b>). A diferença é o descasamento entre veicular e pagar a fatura. <b>CPL/CPL-MQ</b> são aproximados: dividem o spend do Meta por <b>todos</b> os leads/MQLs inbound (não só mídia paga) — 92% dos leads sem UTM no Bitrix impedem isolar os que vieram do Meta.</Nota>
      </div>
    </div>
  );
}

function SecaoQualidade({ d, onDrill }: { d: GestaoReceitaData; onDrill: (dr: DrillRef) => void }) {
  const { churnPorMotivo, churnPorVendedor, total } = d.qualidade;
  return (
    <div className="space-y-5">
      <BlockHead icon={<ShieldCheck className="h-4 w-4" />} title="Qualidade de vendas — Churn" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <SectionCard title="Churn por motivo" fonte={<Fonte tipo="clickup" />} className="lg:col-span-2">
          <TableScroll>
            <Table>
              <TableHeader><TableRow><Th left>Motivo</Th><Th>Clientes</Th><Th>Valor perdido</Th></TableRow></TableHeader>
              <TableBody>
                {churnPorMotivo.map((m) => (
                  <TableRow key={m.motivo} onClick={() => onDrill({ tipo: "churn_motivo", chave: m.motivo })} className={rowClick}><Td left>{m.motivo}</Td><Td>{intBR(m.qtd)}</Td><Td className="text-red-600 dark:text-red-400">{brl(m.valor)}</Td></TableRow>
                ))}
                <TableRow className="font-bold"><Td left>Total</Td><Td>{intBR(total.qtd)}</Td><Td>{brl(total.valor)}</Td></TableRow>
              </TableBody>
            </Table>
          </TableScroll>
        </SectionCard>
        <SectionCard title="Resumo do mês" fonte={<Fonte tipo="clickup" />}>
          <div className="space-y-1">
            <span className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">{intBR(total.qtd)}</span>
            <span className="ml-2 text-sm text-gray-500 dark:text-zinc-400">clientes</span>
          </div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{brl(total.valor)} em receita perdida</div>
          <Nota><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-red-500" />Churns com solicitação de encerramento no mês. Cada caso vira feedback para vendas/pré-vendas.</Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Users className="h-4 w-4" />} title="Churn por vendedor" />
        <SectionCard title="Casos atribuídos ao vendedor de origem" fonte={<Fonte tipo="clickup" />}>
          <TableScroll>
            <Table>
              <TableHeader><TableRow><Th left>Vendedor</Th><Th>Clientes</Th><Th>Valor perdido</Th></TableRow></TableHeader>
              <TableBody>
                {churnPorVendedor.map((v) => (
                  <TableRow key={v.vendedor} onClick={() => onDrill({ tipo: "churn_vendedor", chave: v.vendedor })} className={rowClick}><Td left>{v.vendedor}</Td><Td>{intBR(v.qtd)}</Td><Td className="text-red-600 dark:text-red-400">{brl(v.valor)}</Td></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </SectionCard>
      </div>
    </div>
  );
}

/* ---------- helpers de tabela/UI ---------- */
const TableScroll = ({ children }: { children: React.ReactNode }) => <div className="overflow-x-auto">{children}</div>;
const Th = ({ children, left }: { children: React.ReactNode; left?: boolean }) => (
  <TableHead className={`text-[10px] uppercase tracking-wide ${left ? "text-left" : "text-right"}`}>{children}</TableHead>
);
const Td = ({ children, left, className = "" }: { children: React.ReactNode; left?: boolean; className?: string }) => (
  <TableCell className={`${left ? "text-left font-medium" : "text-right tabular-nums"} ${className}`}>{children}</TableCell>
);
const Vazio = () => <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">Sem dados no mês</p>;

/* ============================================================ PÁGINA ============================================================ */
export default function GestaoReceita() {
  usePageTitle("Gestão de Receita");
  useSetPageInfo("Gestão de Receita", "Orçado × Realizado da área comercial");
  const [periodo, setPeriodo] = useState({ de: "2026-06", ate: "2026-06" });
  const [drill, setDrill] = useState<DrillRef | null>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<GestaoReceitaData>({
    queryKey: ["/api/gestao/receita", { de: periodo.de, ate: periodo.ate }],
  });
  const mesUnico = periodo.de === periodo.ate;

  const metasCtx: MetasCtx = {
    editando,
    get: (chave, fallback) => (chave in rascunho ? rascunho[chave] : fallback),
    set: (chave, valor) => setRascunho((r) => ({ ...r, [chave]: valor })),
  };
  const salvarMetas = useMutation({
    mutationFn: async () => {
      const metas = Object.entries(rascunho).map(([chave, valor]) => ({ chave, valor }));
      return apiRequest("PUT", "/api/gestao/receita/metas", { mes: periodo.de, metas });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gestao/receita"] });
      setEditando(false);
      setRascunho({});
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Receita</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Orçado × Realizado da área comercial · venda via Bitrix, metas do BP 2026</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editando ? (
            <>
              <button
                onClick={() => salvarMetas.mutate()}
                disabled={salvarMetas.isPending || Object.keys(rascunho).length === 0}
                className="rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {salvarMetas.isPending ? "Salvando…" : `Salvar metas${Object.keys(rascunho).length ? ` (${Object.keys(rascunho).length})` : ""}`}
              </button>
              <button
                onClick={() => { setEditando(false); setRascunho({}); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </>
          ) : (
            mesUnico && (
              <button
                onClick={() => setEditando(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <PencilLine className="h-4 w-4" /> Editar metas
              </button>
            )
          )}
          <PeriodoSelector value={periodo} onChange={(p) => { setPeriodo({ de: p.de, ate: p.ate }); setEditando(false); setRascunho({}); }} />
        </div>
      </div>

      {data?.mesParcial && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Mês em andamento — custos em regime caixa (CAC, comissões) ficam <b>parciais</b> até o fechamento; o realizado tende a subir conforme as contas são pagas.</span>
        </div>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" /> Falha ao carregar os dados. Tente recarregar.
          </CardContent>
        </Card>
      )}

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="macro">
          <TabsList className="flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="pessoas" className="gap-1.5"><Users className="h-4 w-4" /> Pessoas</TabsTrigger>
            <TabsTrigger value="macro" className="gap-1.5"><Target className="h-4 w-4" /> Macro</TabsTrigger>
            <TabsTrigger value="micro" className="gap-1.5"><Layers className="h-4 w-4" /> Micro</TabsTrigger>
            <TabsTrigger value="funil" className="gap-1.5"><Filter className="h-4 w-4" /> Funil</TabsTrigger>
            <TabsTrigger value="qualidade" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> Qualidade</TabsTrigger>
          </TabsList>
          <TabsContent value="pessoas" className="mt-4"><SecaoPessoas d={data} onDrill={setDrill} /></TabsContent>
          <TabsContent value="macro" className="mt-4"><SecaoMacro d={data} onDrill={setDrill} metas={metasCtx} /></TabsContent>
          <TabsContent value="micro" className="mt-4"><SecaoMicro d={data} onDrill={setDrill} metas={metasCtx} /></TabsContent>
          <TabsContent value="funil" className="mt-4"><SecaoFunil d={data} onDrill={setDrill} /></TabsContent>
          <TabsContent value="qualidade" className="mt-4"><SecaoQualidade d={data} onDrill={setDrill} /></TabsContent>
        </Tabs>
      )}

      <GestaoReceitaDetalhe drill={drill} de={periodo.de} ate={periodo.ate} onClose={() => setDrill(null)} />

      <div className="flex items-center gap-2 pt-2 text-xs text-gray-400 dark:text-zinc-500">
        <Database className="h-3.5 w-3.5" /> Dados via Cortex — Bitrix (venda/funil), ClickUp (produto/churn), Conta Azul (custos), BP 2026 (metas). Clique numa linha ou card para ver o detalhamento.
      </div>
    </div>
  );
}
