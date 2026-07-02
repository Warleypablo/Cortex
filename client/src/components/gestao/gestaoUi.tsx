// client/src/components/gestao/gestaoUi.tsx
// Helpers visuais compartilhados da família Gestão de Receita (page + seções extraídas).
// Movidos de GestaoReceita.tsx sem mudança de comportamento.
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

/* ---------- formatadores ---------- */
export const brl = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
export const brlk = (n: number) => {
  if (Math.abs(n) >= 1000) return "R$ " + (n / 1000).toFixed(Math.abs(n) % 1000 === 0 ? 0 : 1) + "k";
  return brl(n);
};
export const pct = (n: number) => (Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0") + "%";
export const intBR = (n: number) => Math.round(n).toLocaleString("pt-BR");

// contexto de edição de metas (override): quando editando, os campos de meta viram inputs
export interface MetasCtx {
  editando: boolean; mesUnico: boolean; salvando: boolean; numAlteracoes: number;
  get: (chave: string, fallback: number) => number; set: (chave: string, valor: number) => void;
  iniciar: () => void; salvar: () => void; cancelar: () => void;
}

export function Fonte({ tipo }: { tipo: "bitrix" | "clickup" | "bp" | "caixa" | "meta" }) {
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
export function MetaInput({ chave, valorAtual, metas, prefix = "R$" }: { chave: string; valorAtual: number; metas: MetasCtx; prefix?: string }) {
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

export function SectionCard({ title, fonte, children, className = "" }: { title?: string; fonte?: React.ReactNode; children: React.ReactNode; className?: string }) {
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

export function BlockHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">{icon}</span>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
    </div>
  );
}

export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// pill das linhas de realizado manual da tabela "Custo da operação"
export const PillManual = () => (
  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">manual</span>
);
