import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { FiltrosState } from "./types";

const TODOS = "todos";

export function Filtros({
  value, onChange, opcoes,
}: {
  value: FiltrosState;
  onChange: (f: FiltrosState) => void;
  opcoes?: { produtos: string[]; squads: string[]; responsaveis: string[] };
}) {
  const set = (patch: Partial<FiltrosState>) => onChange({ ...value, ...patch });
  const norm = (v: string) => (v === TODOS ? undefined : v);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={value.produto ?? TODOS} onValueChange={(v) => set({ produto: norm(v) })}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Produto" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os produtos</SelectItem>
          {opcoes?.produtos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={value.squad ?? TODOS} onValueChange={(v) => set({ squad: norm(v) })}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Squad" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os squads</SelectItem>
          {opcoes?.squads.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={value.responsavel ?? TODOS} onValueChange={(v) => set({ responsavel: norm(v) })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os responsáveis</SelectItem>
          {opcoes?.responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>

      <input
        type="month" value={value.de ?? ""} onChange={(e) => set({ de: e.target.value || undefined })}
        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Início (de)"
      />
      <input
        type="month" value={value.ate ?? ""} onChange={(e) => set({ ate: e.target.value || undefined })}
        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Início (até)"
      />

      <div className="ml-auto flex overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
        {(["vendido", "entregue"] as const).map((b) => (
          <Button
            key={b} type="button" variant={value.base === b ? "default" : "ghost"}
            size="sm" className="rounded-none" onClick={() => set({ base: b })}
          >
            {b === "vendido" ? "Vendido" : "Só entregue"}
          </Button>
        ))}
      </div>
    </div>
  );
}
