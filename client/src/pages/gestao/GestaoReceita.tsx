// client/src/pages/gestao/GestaoReceita.tsx
// Painel "Gestão de Receita" — Orçado × Realizado da área comercial.
// Orçado: BP 2026. Venda nova: Bitrix. Custos: regime caixa (Conta Azul).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Target, Layers, Filter, ShieldCheck, TrendingUp, TrendingDown,
  Trophy, AlertTriangle, Wallet, Database, Info,
} from "lucide-react";

/* ---------- tipos ---------- */
type Stat = { orcado: number; realizado: number };
interface CloserRow { nome: string; mrr: number; pont: number; deals: number; reunioes: number; score: number; conv: number; }
interface SdrRow { nome: string; leads: number; reunioes: number; mrr: number; pont: number; valor: number; conv: number; }
interface ProdutoRow { produto: string; cMrr: number; mrr: number; tmMrr: number; cPont: number; pont: number; tmPont: number; orcadoMrr: number | null; }
interface GestaoReceitaData {
  mes: string; mesNum: number; ano: number; mesParcial: boolean;
  macro: {
    vendaMrr: Stat; vendaPontual: Stat;
    canais: { canal: string; deals: number; mrr: number; pont: number; total: number; ticket: number }[];
    cac: {
      custoTotal: Stat;
      produto: { orcado: number; realizado: number; n: number };
      cliente: { orcado: number; realizado: number; n: number };
    };
  };
  pessoas: { custoComercial: Stat; comissoes: Stat; closers: CloserRow[]; sdrs: SdrRow[] };
  micro: { produtos: ProdutoRow[]; vendedores: CloserRow[]; sdrs: SdrRow[] };
  funil: { etapas: { etapa: string; valor: number }[]; mql: { classe: string; leads: number; rr: number; ganhos: number }[] };
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
function Fonte({ tipo }: { tipo: "bitrix" | "clickup" | "bp" | "caixa" }) {
  const map = {
    bitrix: { label: "Bitrix", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    clickup: { label: "ClickUp", cls: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
    bp: { label: "BP 2026", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    caixa: { label: "Conta Azul", cls: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  } as const;
  const m = map[tipo];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function StatOR({ label, stat, lowerIsBetter = false, money = true, fonte }: {
  label: string; stat: Stat; lowerIsBetter?: boolean; money?: boolean; fonte?: React.ReactNode;
}) {
  const atg = stat.orcado ? (stat.realizado / stat.orcado) * 100 : 0;
  const cls = statusClasses(atg, lowerIsBetter);
  const fmt = money ? brl : intBR;
  const delta = stat.realizado - stat.orcado;
  const good = lowerIsBetter ? delta <= 0 : delta >= 0;
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardContent className="pt-4 pb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{label}</span>
          {fonte}
        </div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className={`text-2xl font-bold tabular-nums ${cls.text}`}>{fmt(stat.realizado)}</span>
          <span className="text-xs text-gray-500 dark:text-zinc-400">orçado <b className="tabular-nums text-gray-600 dark:text-zinc-300">{fmt(stat.orcado)}</b></span>
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
function Ranking({ rows, tone }: { rows: { nome: string; primary: string; sub: string }[]; tone: "top" | "bot" }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
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
function SecaoPessoas({ d }: { d: GestaoReceitaData }) {
  const closersTop = d.pessoas.closers.slice(0, 3).map((c) => ({ nome: c.nome, primary: brlk(c.score), sub: `MRR ${brlk(c.mrr)} + Pont ${brlk(c.pont)}/5` }));
  const closersBot = d.pessoas.closers.slice(-3).reverse().map((c) => ({ nome: c.nome, primary: brlk(c.score), sub: `MRR ${brlk(c.mrr)} + Pont ${brlk(c.pont)}/5` }));
  const sdrTop = d.pessoas.sdrs.slice(0, 3).map((s) => ({ nome: s.nome, primary: brlk(s.valor), sub: `${s.reunioes} reuniões · ${s.leads} leads` }));
  const sdrBot = d.pessoas.sdrs.slice(-3).reverse().map((s) => ({ nome: s.nome, primary: brlk(s.valor), sub: `${s.reunioes} reuniões · ${s.leads} leads` }));
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Wallet className="h-4 w-4" />} title="Custo do time comercial — Orçado × Realizado" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatOR label="Custo comercial (Vendas + Pré-vendas)" stat={d.pessoas.custoComercial} lowerIsBetter fonte={<Fonte tipo="caixa" />} />
          <StatOR label="Comissões" stat={d.pessoas.comissoes} lowerIsBetter fonte={<Fonte tipo="caixa" />} />
        </div>
      </div>
      <div>
        <BlockHead icon={<Trophy className="h-4 w-4" />} title="Top 3 / Bottom 3 — performance individual" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SectionCard title="Closers · Top 3" fonte={<Fonte tipo="bitrix" />}>{closersTop.length ? <Ranking rows={closersTop} tone="top" /> : <Vazio />}</SectionCard>
          <SectionCard title="Closers · Bottom 3" fonte={<Fonte tipo="bitrix" />}>{closersBot.length ? <Ranking rows={closersBot} tone="bot" /> : <Vazio />}</SectionCard>
          <SectionCard title="Pré-vendas (SDR) · Top 3" fonte={<Fonte tipo="bitrix" />}>{sdrTop.length ? <Ranking rows={sdrTop} tone="top" /> : <Vazio />}</SectionCard>
          <SectionCard title="Pré-vendas (SDR) · Bottom 3" fonte={<Fonte tipo="bitrix" />}>{sdrBot.length ? <Ranking rows={sdrBot} tone="bot" /> : <Vazio />}</SectionCard>
        </div>
        <Nota>Closers ordenados por <b>score = MRR + Pontual ÷ 5</b>. Pré-vendas ordenados pelo <b>valor gerado</b> nas reuniões/vendas atribuídas ao SDR.</Nota>
      </div>
    </div>
  );
}

function SecaoMacro({ d }: { d: GestaoReceitaData }) {
  const { canais, cac } = d.macro;
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Target className="h-4 w-4" />} title="Venda nova — Orçado × Realizado" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatOR label="Venda de MRR (recorrente nova)" stat={d.macro.vendaMrr} fonte={<Fonte tipo="bitrix" />} />
          <StatOR label="Venda Pontual" stat={d.macro.vendaPontual} fonte={<Fonte tipo="bitrix" />} />
        </div>
      </div>
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Resultado por canal de aquisição" />
        <SectionCard title="Deals ganhos, valor vendido e ticket médio por canal" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <Th left>Canal</Th><Th>Deals</Th><Th>Vendido MRR</Th><Th>Vendido Pont.</Th><Th>Total</Th><Th>Ticket médio</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canais.map((c) => (
                  <TableRow key={c.canal}>
                    <Td left>{c.canal}</Td><Td>{intBR(c.deals)}</Td><Td>{brl(c.mrr)}</Td><Td>{brl(c.pont)}</Td><Td>{brl(c.total)}</Td><Td>{brl(c.ticket)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota>Canal = campo <code>source</code> do Bitrix nos deals ganhos. <b>"(não informado)"</b> é um bucket legítimo — boa parte dos deals não tem origem preenchida no CRM.</Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Target className="h-4 w-4" />} title="CAC — custo de aquisição" />
        <div className="mb-3">
          <StatOR label="Custo comercial total (CAC)" stat={cac.custoTotal} lowerIsBetter fonte={<Fonte tipo="caixa" />} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatOR label={`CAC por contrato  ·  ${cac.produto.n} contratos novos`} stat={cac.produto} lowerIsBetter fonte={<Fonte tipo="caixa" />} />
          <StatOR label={`CAC por cliente  ·  ${cac.cliente.n} clientes novos`} stat={cac.cliente} lowerIsBetter fonte={<Fonte tipo="caixa" />} />
        </div>
        <Nota>CAC = custo comercial total ÷ novos adquiridos no mês. Realizado: contratos novos (ClickUp) e clientes novos (deals ganhos Bitrix). Orçado: contratos/clientes vendidos do BP.</Nota>
      </div>
    </div>
  );
}

function SecaoMicro({ d }: { d: GestaoReceitaData }) {
  const { produtos, vendedores, sdrs } = d.micro;
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Layers className="h-4 w-4" />} title="Venda e ticket médio por produto" />
        <SectionCard title="Contratos novos no mês, valor e ticket médio por produto" fonte={<Fonte tipo="clickup" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <Th left>Produto</Th><Th>Contr. MRR</Th><Th>Vendido MRR</Th><Th>TM MRR</Th><Th>Contr. Pont.</Th><Th>Vendido Pont.</Th><Th>TM Pont.</Th><Th>Orç. MRR</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p) => (
                  <TableRow key={p.produto}>
                    <Td left>{p.produto}</Td>
                    <Td>{intBR(p.cMrr)}</Td><Td>{brl(p.mrr)}</Td><Td>{p.tmMrr ? brl(p.tmMrr) : "—"}</Td>
                    <Td>{intBR(p.cPont)}</Td><Td>{brl(p.pont)}</Td><Td>{p.tmPont ? brl(p.tmPont) : "—"}</Td>
                    <Td>{p.orcadoMrr != null ? brl(p.orcadoMrr) : "—"}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota>Visão por produto vem do <b>ClickUp</b> (o Bitrix não tem produto por deal) → o total aqui pode divergir da venda do Bitrix na aba Macro. Orçado por produto só onde há mapeamento direto com os segmentos do BP.</Nota>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Users className="h-4 w-4" />} title="Performance por vendedor (Closer)" />
        <SectionCard title="Vendido MRR/Pontual, ticket e conversão" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow><Th left>Vendedor</Th><Th>Vendido MRR</Th><Th>Vendido Pont.</Th><Th>Deals</Th><Th>Reuniões</Th><Th>Conv. reun.→venda</Th></TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.map((v) => (
                  <TableRow key={v.nome}>
                    <Td left>{v.nome}</Td><Td>{brl(v.mrr)}</Td><Td>{brl(v.pont)}</Td><Td>{intBR(v.deals)}</Td><Td>{intBR(v.reunioes)}</Td>
                    <Td><span className={convColor(v.conv, 28, 20)}>{pct(v.conv)}</span></Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Users className="h-4 w-4" />} title="Performance por pré-vendas (SDR)" />
        <SectionCard title="Leads, reuniões, valor gerado e conversão" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow><Th left>Pré-vendedor</Th><Th>Leads</Th><Th>Reuniões</Th><Th>Valor gerado</Th><Th>Conv. lead→reun.</Th></TableRow>
              </TableHeader>
              <TableBody>
                {sdrs.map((s) => (
                  <TableRow key={s.nome}>
                    <Td left>{s.nome}</Td><Td>{intBR(s.leads)}</Td><Td>{intBR(s.reunioes)}</Td><Td>{brl(s.valor)}</Td>
                    <Td><span className={convColor(s.conv, 20, 14)}>{pct(s.conv)}</span></Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </SectionCard>
      </div>
    </div>
  );
}

function SecaoFunil({ d }: { d: GestaoReceitaData }) {
  const { etapas, mql } = d.funil;
  const topo = etapas[0]?.valor || 1;
  const totalLeadsMql = mql.reduce((a, m) => a + m.leads, 0);
  return (
    <div className="space-y-5">
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Funil comercial — Lead → Reunião → Venda" />
        <SectionCard title="Volume e conversão por etapa" fonte={<Fonte tipo="bitrix" />}>
          <div className="flex flex-col gap-2">
            {etapas.map((e, i) => {
              const prev = i > 0 ? etapas[i - 1].valor : null;
              const convEtapa = prev ? (e.valor / prev) * 100 : null;
              const convAcum = (e.valor / topo) * 100;
              return (
                <div key={e.etapa} className="grid grid-cols-[130px_1fr_150px] items-center gap-3">
                  <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300">{e.etapa}</span>
                  <div className="h-8 overflow-hidden rounded-md bg-gray-100 dark:bg-zinc-800">
                    <div className="flex h-full items-center justify-end rounded-md bg-gradient-to-r from-teal-400 to-teal-600 px-2 text-xs font-bold tabular-nums text-white" style={{ width: Math.max(convAcum, 6) + "%" }}>
                      {intBR(e.valor)}
                    </div>
                  </div>
                  <span className="text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">
                    {convEtapa != null ? <><b className="text-gray-800 dark:text-zinc-100">{pct(convEtapa)}</b> etapa · </> : "topo · "}{pct(convAcum)} acum.
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
      <div>
        <BlockHead icon={<Filter className="h-4 w-4" />} title="Composição MQL / NMQL por etapa" />
        <SectionCard title="Leads, reuniões realizadas e ganhos por classificação" fonte={<Fonte tipo="bitrix" />}>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow><Th left>Classificação</Th><Th>Leads</Th><Th>Reuniões realizadas</Th><Th>Ganhos</Th></TableRow>
              </TableHeader>
              <TableBody>
                {mql.map((m) => (
                  <TableRow key={m.classe}>
                    <Td left>{m.classe}</Td><Td>{intBR(m.leads)}</Td><Td>{intBR(m.rr)}</Td><Td>{intBR(m.ganhos)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          <Nota>
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
            A classificação MQL/NMQL depende do campo <code>mql</code> no Bitrix, preenchido em poucos leads
            ({totalLeadsMql > 0 ? pct((mql.find((m) => m.classe === "(sem classificação)")?.leads || 0) / totalLeadsMql * 100) : "—"} sem classificação no mês). Os números refletem o CRM como está hoje.
          </Nota>
        </SectionCard>
      </div>
    </div>
  );
}

function SecaoQualidade({ d }: { d: GestaoReceitaData }) {
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
                  <TableRow key={m.motivo}><Td left>{m.motivo}</Td><Td>{intBR(m.qtd)}</Td><Td className="text-red-600 dark:text-red-400">{brl(m.valor)}</Td></TableRow>
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
                  <TableRow key={v.vendedor}><Td left>{v.vendedor}</Td><Td>{intBR(v.qtd)}</Td><Td className="text-red-600 dark:text-red-400">{brl(v.valor)}</Td></TableRow>
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
function convColor(v: number, hi: number, mid: number) {
  if (v >= hi) return "font-bold text-emerald-600 dark:text-emerald-400";
  if (v >= mid) return "font-bold text-amber-600 dark:text-amber-400";
  return "font-bold text-red-600 dark:text-red-400";
}

const MESES = [
  { v: "2026-01", l: "Janeiro 2026" }, { v: "2026-02", l: "Fevereiro 2026" }, { v: "2026-03", l: "Março 2026" },
  { v: "2026-04", l: "Abril 2026" }, { v: "2026-05", l: "Maio 2026" }, { v: "2026-06", l: "Junho 2026" },
];

/* ============================================================ PÁGINA ============================================================ */
export default function GestaoReceita() {
  usePageTitle("Gestão de Receita");
  useSetPageInfo("Gestão de Receita", "Orçado × Realizado da área comercial");
  const [mes, setMes] = useState("2026-06");

  const { data, isLoading, isError } = useQuery<GestaoReceitaData>({
    queryKey: ["/api/gestao/receita", { mes }],
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
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-44 bg-white dark:bg-zinc-900"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {data?.mesParcial && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Mês em andamento — custos em regime caixa (CAC, comissões) ficam <b>parciais</b> até o fechamento; o realizado tende a subir.</span>
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
          <TabsContent value="pessoas" className="mt-4"><SecaoPessoas d={data} /></TabsContent>
          <TabsContent value="macro" className="mt-4"><SecaoMacro d={data} /></TabsContent>
          <TabsContent value="micro" className="mt-4"><SecaoMicro d={data} /></TabsContent>
          <TabsContent value="funil" className="mt-4"><SecaoFunil d={data} /></TabsContent>
          <TabsContent value="qualidade" className="mt-4"><SecaoQualidade d={data} /></TabsContent>
        </Tabs>
      )}

      <div className="flex items-center gap-2 pt-2 text-xs text-gray-400 dark:text-zinc-500">
        <Database className="h-3.5 w-3.5" /> Dados via Cortex — Bitrix (venda/funil), ClickUp (produto/churn), Conta Azul (custos), BP 2026 (metas).
      </div>
    </div>
  );
}
