// client/src/pages/gestao/GestaoReceita.tsx
// Painel "Gestão de Receita" — Orçado × Realizado da área comercial.
// Orçado: BP 2026. Venda nova: Bitrix. Custos: regime caixa (Conta Azul).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodoSelector } from "@/components/PeriodoSelector";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Target, Layers, Filter, ShieldCheck, TrendingUp, TrendingDown,
  Trophy, AlertTriangle, Wallet, Database, PencilLine,
} from "lucide-react";
import { GestaoReceitaDetalhe, type DrillRef } from "@/components/gestao/GestaoReceitaDetalhe";
import { Fonte, MetaInput, SectionCard, BlockHead, Nota, PillManual, brl, brlk, pct, intBR, type MetasCtx } from "@/components/gestao/gestaoUi";

// classe das linhas/elementos clicáveis (drill-down)
const rowClick = "cursor-pointer transition hover:bg-gray-50 dark:hover:bg-zinc-800/50";

/* ---------- tipos ---------- */
type Stat = { orcado: number; realizado: number; editavel?: boolean; chave?: string };
interface EtapaFunil { etapa: string; valor: number; mql: number }
interface CloserRow { nome: string; mrr: number; pont: number; deals: number; reunioes: number; score: number; conv: number; ticketMrr: number; ticketPont: number; }
interface SdrRow { nome: string; leads: number; reunioes: number; deals: number; mrr: number; pont: number; valor: number; conv: number; convVenda: number; }
// linha da tabela "Custo da operação" (seção CAC): fonteReal 'cortex' = caixa Conta Azul
// (sub = chave do predicado, usada no drill); 'manual' = digitado via Editar metas
interface CacOperacaoRow { item: string; label: string; orcado: number; realizado: number; fonteReal: "cortex" | "manual"; sub: string | null }
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
      operacao: CacOperacaoRow[];
    };
  };
  pessoas: { custoComercial: Stat; comissoes: Stat; closers: CloserRow[]; sdrs: SdrRow[] };
  micro: { produtos: ProdutoRow[]; vendedores: CloserRow[]; sdrs: SdrRow[] };
  funil: {
    inbound: EtapaFunil[];
    outbound: EtapaFunil[];
    outros: EtapaFunil[];
    mql: { classe: string; leads: number; rr: number; ganhos: number }[];
    investimento: { metaAdsSpend: number; adsContaAzul: number; leadsInbound: number; mqlsInbound: number; cpl: number; cplMq: number };
    opcoesProduto: { produto: string; qtd: number }[];
  };
  qualidade: {
    churnPorMotivo: { motivo: string; qtd: number; valor: number }[];
    churnPorVendedor: { vendedor: string; qtd: number; valor: number }[];
    total: { qtd: number; valor: number };
  };
}

function statusClasses(atingimento: number, lowerIsBetter = false) {
  const good = lowerIsBetter ? atingimento <= 100 : atingimento >= 100;
  const warn = lowerIsBetter ? atingimento <= 110 : atingimento >= 90;
  if (good) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (warn) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };
}

/* ---------- componentes base ---------- */
// botões "Editar metas / Salvar / Cancelar" — usados no header da página e na aba Micro
function MetasBotoes({ metas, compact = false }: { metas: MetasCtx; compact?: boolean }) {
  const sz = compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";
  if (metas.editando) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={metas.salvar}
          disabled={metas.salvando || metas.numAlteracoes === 0}
          className={`rounded-md bg-teal-600 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50 ${sz}`}
        >
          {metas.salvando ? "Salvando…" : `Salvar metas${metas.numAlteracoes ? ` (${metas.numAlteracoes})` : ""}`}
        </button>
        <button
          onClick={metas.cancelar}
          className={`rounded-md border border-gray-300 font-medium text-gray-600 transition hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 ${sz}`}
        >
          Cancelar
        </button>
      </div>
    );
  }
  if (!metas.mesUnico) return null;
  return (
    <button
      onClick={metas.iniciar}
      className={`inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ${sz}`}
    >
      <PencilLine className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> Editar metas
    </button>
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

// Tabela "Custo da operação": composição do CAC item a item. Orçado editável em todos
// (default = BP 2026); realizado manual só onde o Conta Azul não separa (comissões
// PV × Vendas) ou o time preenche à mão (Ferramentas, Eventos). Totais ao vivo no modo edição.
function CustoOperacaoTabela({ rows, metas, onDrill }: { rows: CacOperacaoRow[]; metas: MetasCtx; onDrill: (dr: DrillRef) => void }) {
  const orcVivo = (r: CacOperacaoRow) => metas.get(`cac_op_orc:${r.item}`, r.orcado);
  const realVivo = (r: CacOperacaoRow) => (r.fonteReal === "manual" ? metas.get(`cac_op_real:${r.item}`, r.realizado) : r.realizado);
  const orcTotal = rows.reduce((a, r) => a + orcVivo(r), 0);
  const realTotal = rows.reduce((a, r) => a + realVivo(r), 0);
  return (
    <SectionCard title="Custo da operação — Orçado × Realizado" fonte={<Fonte tipo="caixa" />}>
      <TableScroll>
        <Table>
          <TableHeader>
            <TableRow><Th left>Item</Th><Th>Orçado</Th><Th>Realizado</Th><Th>Var.</Th></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const clicavel = !metas.editando && r.sub != null;
              return (
                <TableRow key={r.item} onClick={clicavel ? () => onDrill({ tipo: "cac_sub", chave: r.sub! }) : undefined} className={clicavel ? rowClick : ""}>
                  <Td left>(-) {r.label}</Td>
                  <Td>{metas.editando ? <MetaInput chave={`cac_op_orc:${r.item}`} valorAtual={r.orcado} metas={metas} /> : brl(r.orcado)}</Td>
                  <Td>
                    {r.fonteReal === "manual" ? (
                      metas.editando
                        ? <MetaInput chave={`cac_op_real:${r.item}`} valorAtual={r.realizado} metas={metas} />
                        : <span className="inline-flex items-center gap-1.5">{brl(r.realizado)}<PillManual /></span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">{brl(r.realizado)}<Fonte tipo="caixa" /></span>
                    )}
                  </Td>
                  <Td>{orcVivo(r) > 0 ? <VarPill orcado={orcVivo(r)} realizado={realVivo(r)} lowerIsBetter /> : "—"}</Td>
                </TableRow>
              );
            })}
            <TableRow className="font-bold">
              <Td left>Custo total</Td>
              <Td>{brl(orcTotal)}</Td>
              <Td>{brl(realTotal)}</Td>
              <Td>{orcTotal > 0 ? <VarPill orcado={orcTotal} realizado={realTotal} lowerIsBetter /> : "—"}</Td>
            </TableRow>
          </TableBody>
        </Table>
      </TableScroll>
      <Nota>
        <b>Orçado</b>: todos os itens editáveis no botão "Editar metas" (default = BP 2026). <b>Realizado</b>: Ferramentas, Comissões PV, Comissões Vendas e Eventos são <b>manuais</b> (o Conta Azul não separa comissões de PV × Vendas); os demais vêm do caixa (Conta Azul). O card "Custo comercial total (CAC)" acima inclui também Brindes, Viagens e Outras despesas comerciais, fora desta tabela — por isso o Custo total daqui tende a ser menor.
      </Nota>
    </SectionCard>
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
          <Nota>Canal = campo <code>source</code> do Bitrix. <b>"(não informado)"</b> é um bucket legítimo — boa parte dos deals não tem origem preenchida no CRM. Tx conv. = deals ganhos no mês ÷ reuniões do mês (mesma régua das tabelas de Closers e SDRs); pode passar de 100% quando fecham deals cuja reunião foi em meses anteriores. Ticket Rec./Pont. = valor vendido ÷ deals com valor daquele tipo. Canais com reunião e sem venda aparecem com 0 deals.</Nota>
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
        <div className="mt-3">
          <CustoOperacaoTabela rows={cac.operacao} metas={metas} onDrill={onDrill} />
        </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BlockHead icon={<Layers className="h-4 w-4" />} title="Venda por produto — MRR e Pontual" />
          <MetasBotoes metas={metas} compact />
        </div>
        <div className="space-y-3">
          <ProdutoTabela produtos={produtos} tipo="mrr" onDrill={onDrill} metas={metas} />
          <ProdutoTabela produtos={produtos} tipo="pont" onDrill={onDrill} metas={metas} />
        </div>
        <Nota>Base ClickUp por <code>data_criado</code> (mesma régua do <b>BP 2026</b>). <b>Orçado</b> por produto = <b>meta de nº contratos × meta de ticket médio</b> (editáveis no botão "Metas"). O pontual é deduplicado por jornada, então fica menor que o BP; a venda comercial real está na aba <b>Macro</b> (Bitrix).</Nota>
      </div>
      <div>
        <BlockHead icon={<Users className="h-4 w-4" />} title="Performance por vendedor (Closer)" />
        <SectionCard title="Vendido MRR/Pontual, ticket médio (Rec. × Pont.) e conversão" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow><Th left>Vendedor</Th><Th>Vendido MRR</Th><Th>Vendido Pont.</Th><Th>Ticket Rec.</Th><Th>Ticket Pont.</Th><Th>Deals</Th><Th>Reuniões</Th><Th>Conv. reun→venda</Th></TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.map((v) => (
                  <TableRow key={v.nome} onClick={() => onDrill({ tipo: "closer", chave: v.nome })} className={rowClick}>
                    <Td left>{v.nome}</Td><Td>{brl(v.mrr)}</Td><Td>{brl(v.pont)}</Td>
                    <Td>{v.ticketMrr ? brl(v.ticketMrr) : "—"}</Td><Td>{v.ticketPont ? brl(v.ticketPont) : "—"}</Td>
                    <Td>{intBR(v.deals)}</Td><Td>{intBR(v.reunioes)}</Td>
                    <Td className="font-semibold text-teal-700 dark:text-teal-400">{pct(v.conv)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota>Ticket Rec./Pont. = valor vendido ÷ deals ganhos <b>com valor daquele tipo</b> (deal misto conta nos dois; mesma régua da tabela por canal). <b>Conversão direta</b>: deals ganhos no mês ÷ reuniões realizadas no mês (coortes distintas — o deal pode ter tido reunião em mês anterior; pode passar de 100%).</Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Users className="h-4 w-4" />} title="Performance por pré-vendas (SDR)" />
        <SectionCard title="Leads, reuniões, valor gerado (MRR × Pontual) e conversão" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow><Th left>Pré-vendedor</Th><Th>Leads</Th><Th>Reuniões</Th><Th>Gerado MRR</Th><Th>Gerado Pont.</Th><Th>Conv. lead→reun.</Th><Th>Conv. reun→venda</Th></TableRow>
              </TableHeader>
              <TableBody>
                {sdrs.map((s) => (
                  <TableRow key={s.nome} onClick={() => onDrill({ tipo: "sdr", chave: s.nome })} className={rowClick}>
                    <Td left>{s.nome}</Td><Td>{intBR(s.leads)}</Td><Td>{intBR(s.reunioes)}</Td><Td>{brl(s.mrr)}</Td><Td>{brl(s.pont)}</Td>
                    <Td className="font-semibold text-teal-700 dark:text-teal-400">{pct(s.conv)}</Td>
                    <Td className="font-semibold text-teal-700 dark:text-teal-400">{pct(s.convVenda)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota><b>Conv. lead→reun. (coorte)</b>: dos leads criados no mês, % que teve reunião realizada. <b>Conv. reun→venda (direta)</b>: deals ganhos no mês ÷ reuniões realizadas no mês (mesma régua da tabela de closers; pode passar de 100%). <b>Valor gerado</b> (MRR/Pontual) é da venda atribuída ao SDR (o mesmo deal também conta para o closer; não some as listas).</Nota>
        </SectionCard>
      </div>
    </div>
  );
}

// funil Lead→RA→RR→Venda; se `empilhado`, cada barra mostra composição MQL (verde) / NMQL (cinza)
function FunilView({ etapas, seg, empilhado, onDrill }: { etapas: EtapaFunil[]; seg: "inbound" | "outbound" | "outros"; empilhado: boolean; onDrill: (dr: DrillRef) => void }) {
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

// rótulos do filtro de Plataforma (régua utm_source do growth — ver gestaoReceita.funil.ts)
const PLATAFORMAS_FUNIL = [
  { valor: "meta", label: "Meta Ads" },
  { valor: "google", label: "Google Ads" },
  { valor: "tiktok", label: "TikTok" },
  { valor: "outros", label: "Outras origens" },
  { valor: "sem_utm", label: "(sem UTM)" },
];

function SecaoFunil({ d, de, ate, onDrill }: { d: GestaoReceitaData; de: string; ate: string; onDrill: (dr: DrillRef) => void }) {
  const { investimento: inv, opcoesProduto } = d.funil;
  // filtros Produto (fnl_ngc) × Plataforma (utm_source); "todos" = sem filtro
  const [produto, setProduto] = useState("todos");
  const [plataforma, setPlataforma] = useState("todos");
  const filtroAtivo = produto !== "todos" || plataforma !== "todos";
  // com filtro ativo, busca só o bloco de funis no endpoint dedicado (payload principal segue intacto)
  const { data: funilFiltrado, isFetching } = useQuery<{ inbound: EtapaFunil[]; outbound: EtapaFunil[]; outros: EtapaFunil[] }>({
    queryKey: ["/api/gestao/receita/funil", { de, ate, produto, plataforma }],
    enabled: filtroAtivo,
    placeholderData: keepPreviousData,
  });
  const inbound = filtroAtivo ? funilFiltrado?.inbound ?? [] : d.funil.inbound;
  const outbound = filtroAtivo ? funilFiltrado?.outbound ?? [] : d.funil.outbound;
  const outros = filtroAtivo ? funilFiltrado?.outros ?? [] : d.funil.outros;
  const carregandoFiltro = filtroAtivo && !funilFiltrado;
  // drill herda os filtros ativos p/ o detalhamento bater com as barras
  const drill = (dr: DrillRef) =>
    onDrill({ ...dr, produto: produto !== "todos" ? produto : undefined, plataforma: plataforma !== "todos" ? plataforma : undefined });
  const leadsInb = inbound[0]?.valor || 0;
  const mqlInb = inbound[0]?.mql || 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <Filter className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Filtrar funis</span>
        <Select value={produto} onValueChange={setProduto}>
          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os produtos</SelectItem>
            {opcoesProduto.map((o) => (
              <SelectItem key={o.produto} value={o.produto}>{o.produto} ({intBR(o.qtd)})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={plataforma} onValueChange={setPlataforma}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as plataformas</SelectItem>
            {PLATAFORMAS_FUNIL.map((p) => (
              <SelectItem key={p.valor} value={p.valor}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtroAtivo && (
          <button
            onClick={() => { setProduto("todos"); setPlataforma("todos"); }}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Limpar
          </button>
        )}
        <span className="ml-auto text-[11px] text-gray-400 dark:text-zinc-500">
          Produto = funil do negócio (<code>fnl_ngc</code>) · Plataforma = <code>utm_source</code> · aplica aos funis e ao drill
        </span>
      </div>
      <div className={isFetching ? "space-y-5 opacity-60 transition-opacity" : "space-y-5"}>
      {carregandoFiltro ? (
        <div className="space-y-3"><Skeleton className="h-48 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : (
      <>
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Funil Inbound — Lead → RA → RR → Venda" />
        <SectionCard title="Composição MQL / NMQL por etapa · origem inbound (WEBFORM/WEB/ADVERTISING/CALL/EMAIL…)" fonte={<Fonte tipo="bitrix" />}>
          <FunilView etapas={inbound} seg="inbound" empilhado onDrill={drill} />
          <Nota>
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
            <b>MQL</b> = campo <code>mql</code> preenchido no Bitrix; <b>NMQL</b> = o resto (inclui não-classificados). Hoje só {leadsInb > 0 ? pct((mqlInb / leadsInb) * 100) : "—"} dos leads inbound estão marcados como MQL — a fatia verde fica pequena porque o CRM classifica poucos.
          </Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Funil Outbound — Lead → RA → RR → Venda" />
        <SectionCard title="Somente Prospecção ativa (source “Prospecção” no Bitrix)" fonte={<Fonte tipo="bitrix" />}>
          <FunilView etapas={outbound} seg="outbound" empilhado={false} onDrill={drill} />
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Funil Outros — relacionamento & base" />
        <SectionCard title="Crossell, indicação, recomendação, eventos, recuperação de base e deals sem origem" fonte={<Fonte tipo="bitrix" />}>
          <FunilView etapas={outros} seg="outros" empilhado={false} onDrill={drill} />
          <Nota>Origens que não são mídia (inbound) nem prospecção ativa (outbound). Antes esses leads inflavam o funil outbound; desde 2026-07-01 ficam separados aqui.</Nota>
        </SectionCard>
      </div>
      </>
      )}
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
  const metasCtx: MetasCtx = {
    editando,
    mesUnico,
    salvando: salvarMetas.isPending,
    numAlteracoes: Object.keys(rascunho).length,
    get: (chave, fallback) => (chave in rascunho ? rascunho[chave] : fallback),
    set: (chave, valor) => setRascunho((r) => ({ ...r, [chave]: valor })),
    iniciar: () => setEditando(true),
    salvar: () => salvarMetas.mutate(),
    cancelar: () => { setEditando(false); setRascunho({}); },
  };

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
          <MetasBotoes metas={metasCtx} />
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
          <TabsContent value="funil" className="mt-4"><SecaoFunil d={data} de={periodo.de} ate={periodo.ate} onDrill={setDrill} /></TabsContent>
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
