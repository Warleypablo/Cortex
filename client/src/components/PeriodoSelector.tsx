// client/src/components/PeriodoSelector.tsx
// Filtros rápidos de período: dropdown de Mês + chips Q1–Q4 / S1 S2 / Ano / YTD.
// Emite { de, ate, label } no formato "YYYY-MM" (mês único = de === ate).
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Periodo { de: string; ate: string; label: string }

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ym = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

export function PeriodoSelector({ value, onChange, ano = 2026 }: { value: { de: string; ate: string }; onChange: (p: Periodo) => void; ano?: number }) {
  const hoje = new Date();
  const mesYtd = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
  const presets = [
    { key: "q1", label: "Q1", de: ym(ano, 1), ate: ym(ano, 3) },
    { key: "q2", label: "Q2", de: ym(ano, 4), ate: ym(ano, 6) },
    { key: "q3", label: "Q3", de: ym(ano, 7), ate: ym(ano, 9) },
    { key: "q4", label: "Q4", de: ym(ano, 10), ate: ym(ano, 12) },
    { key: "s1", label: "S1", de: ym(ano, 1), ate: ym(ano, 6) },
    { key: "s2", label: "S2", de: ym(ano, 7), ate: ym(ano, 12) },
    { key: "ano", label: "Ano", de: ym(ano, 1), ate: ym(ano, 12) },
    { key: "ytd", label: "YTD", de: ym(ano, 1), ate: ym(ano, mesYtd) },
  ];
  const ativo = (de: string, ate: string) => value.de === de && value.ate === ate;
  const mesUnico = value.de === value.ate;
  const mesSel = mesUnico ? value.de : "";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={mesSel} onValueChange={(m) => onChange({ de: m, ate: m, label: `${MESES[Number(m.split("-")[1]) - 1]} ${m.split("-")[0]}` })}>
        <SelectTrigger className="w-40 bg-white dark:bg-zinc-900"><SelectValue placeholder="Mês…" /></SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <SelectItem key={m} value={ym(ano, m)}>{MESES[m - 1]} {ano}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange({ de: p.de, ate: p.ate, label: `${p.label} ${ano}` })}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
              ativo(p.de, p.ate)
                ? "bg-teal-600 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:border-teal-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-teal-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
