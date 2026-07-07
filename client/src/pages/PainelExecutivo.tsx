import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { mesDefault, mesesOptions } from "./painel-executivo/temporalidade";
import type { ScorecardModo } from "./painel-executivo/scorecard/Scorecard";
import { SecaoVisaoGeral } from "./painel-executivo/SecaoVisaoGeral";
import { SecaoReceita } from "./painel-executivo/SecaoReceita";
import { SecaoChurn } from "./painel-executivo/SecaoChurn";
import { SecaoLtLtv } from "./painel-executivo/SecaoLtLtv";
import { SecaoCapacity } from "./painel-executivo/SecaoCapacity";
import { SecaoEntregas } from "./painel-executivo/SecaoEntregas";
import { SecaoPerformance } from "./painel-executivo/SecaoPerformance";

const ABAS = [
  { value: "visao-geral", label: "Visão Geral" },
  { value: "receita", label: "Receita" },
  { value: "churn", label: "Churn" },
  { value: "lt-ltv", label: "LT / LTV" },
  { value: "capacity", label: "Capacity" },
  { value: "entregas", label: "Entregas" },
  { value: "performance", label: "Performance" },
] as const;

const MODOS: { value: ScorecardModo; label: string }[] = [
  { value: "foco", label: "Mês em foco" },
  { value: "evolucao", label: "Evolução" },
];

/** Navy sólido nos dois temas — no dark o token `--primary` do app vira azul vívido (bom p/
   botões), então aqui repetimos o mesmo hex navy que o componente Scorecard já usa
   (`scorecard/Scorecard.tsx`, faixa de seção) para manter o header/tabs consistentemente navy. */
const DARK_NAVY_BORDER = "dark:border-[#16234a]";
const DARK_NAVY_ACTIVE_BORDER = "dark:data-[state=active]:border-[#16234a]";
const DARK_NAVY_BG = "dark:bg-[#16234a]";

/** Toggle segmentado "Mês em foco" / "Evolução". O estado `modo` já sobe para o shell aqui —
   a partir da Task 6, cada `<Secao*>` passa a ser reescrita para montar `ScorecardSection[]` e
   renderizar `<Scorecard modo={modo} .../>`; até lá, as seções v1 (cards) seguem recebendo só
   `mes` (elas ainda não têm prop `modo`), então o toggle fica "pronto" mas sem efeito visível
   nas abas atuais — isso é esperado e será resolvido tarefa a tarefa nas Tasks 6-12. */
function ToggleModo({ modo, onChange }: { modo: ScorecardModo; onChange: (m: ScorecardModo) => void }) {
  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/60 p-1"
    >
      {MODOS.map((m) => (
        <button
          key={m.value}
          type="button"
          aria-pressed={modo === m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
            modo === m.value
              ? cn("bg-primary text-primary-foreground", DARK_NAVY_BG)
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function PainelExecutivo() {
  usePageTitle("Painel Executivo Mensal");
  useSetPageInfo("Painel Executivo Mensal", "Consolidado mensal auditável");
  const [mes, setMes] = useState<string>(mesDefault());
  // Estado do modo de visualização — preparado para as Tasks 6-12 (ver comentário do ToggleModo).
  const [modo, setModo] = useState<ScorecardModo>("foco");
  const opcoes = mesesOptions();

  return (
    <div className="space-y-5 p-6">
      <header className={cn("flex flex-wrap items-end justify-between gap-5 border-b-2 border-primary pb-5", DARK_NAVY_BORDER)}>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Turbo Partners · Painel Executivo
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[32px]">
            Company Scorecard{" "}
            <span className="font-semibold text-muted-foreground">— fechamento mensal</span>
          </h1>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-48 rounded-full border-border bg-card font-semibold shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      <Tabs defaultValue="visao-geral">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList className="h-auto flex-1 flex-wrap justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
            {ABAS.map((a) => (
              <TabsTrigger
                key={a.value}
                value={a.value}
                className={cn(
                  "rounded-none border-b-2 border-transparent bg-transparent px-3.5 py-2.5 text-[13px] font-semibold text-muted-foreground shadow-none",
                  "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  DARK_NAVY_ACTIVE_BORDER,
                )}
              >
                {a.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ToggleModo modo={modo} onChange={setModo} />
        </div>

        {ABAS.map((a) => (
          <TabsContent key={a.value} value={a.value} className="mt-4">
            {a.value === "visao-geral" ? (
              <SecaoVisaoGeral mes={mes} modo={modo} />
            ) : a.value === "receita" ? (
              <SecaoReceita mes={mes} modo={modo} />
            ) : a.value === "churn" ? (
              <SecaoChurn mes={mes} modo={modo} />
            ) : a.value === "lt-ltv" ? (
              <SecaoLtLtv mes={mes} modo={modo} />
            ) : a.value === "capacity" ? (
              <SecaoCapacity mes={mes} modo={modo} />
            ) : a.value === "entregas" ? (
              <SecaoEntregas mes={mes} modo={modo} />
            ) : (
              <SecaoPerformance mes={mes} modo={modo} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
