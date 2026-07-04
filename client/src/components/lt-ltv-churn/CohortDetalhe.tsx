// Sheet lateral de auditoria de uma célula da matriz de cohort: lista nominal de
// quem estava vivo no mês alvo e de quem já tinha saído (base -> célula).
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson, buildUrl } from "./utils";
import type { CohortDetalheData, CohortDetalheItem } from "./types";

export interface CohortDrillRef {
  unidade: "cliente" | "contrato";
  safra: string; // "YYYY-MM"
  offset: number;
}

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function labelMes(anoMes: string | null | undefined): string {
  if (!anoMes) return "";
  const [ano, mes] = anoMes.split("-");
  return `${MESES_PT[Number(mes) - 1]}/${ano.slice(2)}`;
}

function labelData(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
}

const fmt = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");

function detalheItem(it: CohortDetalheItem, unidade: "cliente" | "contrato"): string {
  if (unidade === "contrato") {
    const partes = [it.servico || "sem serviço", `início ${labelData(it.dataInicio)}`];
    if (it.vivo && it.status) partes.push(it.status);
    if (!it.vivo) partes.push(it.dataFim ? `saiu ${labelData(it.dataFim)}` : "saiu");
    return partes.join(" · ");
  }
  const partes = [`${it.nVivos ?? 0}/${it.nContratos ?? 0} contratos vivos no mês`];
  if (!it.vivo) {
    partes.push(`saiu em ${labelMes(it.ultimoMesVivo)}`);
    if (it.temContratoPosterior) partes.push("voltou depois");
    if (it.ativoHoje) partes.push("ativo hoje");
  }
  return partes.join(" · ");
}

function GrupoItens({ titulo, itens, unidade, abrir }: {
  titulo: string;
  itens: CohortDetalheItem[];
  unidade: "cliente" | "contrato";
  abrir: boolean;
}) {
  return (
    <details open={abrir} className="rounded-lg border border-gray-200 dark:border-zinc-700">
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
        <span>{titulo}</span>
        <span className="tabular-nums">{itens.length}</span>
      </summary>
      <div className="border-t border-gray-100 dark:border-zinc-800">
        {itens.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-500 dark:text-zinc-500">Nenhum.</p>
        ) : (
          itens.map((it) => {
            const valor = unidade === "contrato" ? (it.valorr ?? 0) : (it.mrrVivo ?? 0);
            return (
              <div
                key={it.id}
                className="flex items-start justify-between gap-2 border-b border-gray-50 px-3 py-1.5 text-xs last:border-0 dark:border-zinc-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-gray-800 dark:text-zinc-200">
                    <a
                      href={`https://app.clickup.com/t/${it.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {it.nome || it.id}
                    </a>
                  </p>
                  <p className="truncate text-gray-500 dark:text-zinc-500">{detalheItem(it, unidade)}</p>
                </div>
                <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">
                  {valor > 0 ? fmt(valor) : "—"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </details>
  );
}

export function CohortDetalhe({ drill, produto, onClose }: {
  drill: CohortDrillRef | null;
  produto?: string;
  onClose: () => void;
}) {
  const aberto = drill !== null;
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/lt-ltv-churn/cohort/detalhe", drill?.unidade, drill?.safra, drill?.offset, produto],
    enabled: aberto,
    queryFn: () =>
      fetchJson<CohortDetalheData>(
        buildUrl("/api/lt-ltv-churn/cohort/detalhe", {
          unidade: drill!.unidade,
          safra: drill!.safra,
          offset: String(drill!.offset),
          produto,
        })
      ),
  });

  const vivos = data?.itens.filter((i) => i.vivo) ?? [];
  const saidos = data?.itens.filter((i) => !i.vivo) ?? [];
  const base = data?.itens.length ?? 0;
  const pct = base > 0 ? ((vivos.length / base) * 100).toFixed(1) : "0";

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-xl dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            {drill
              ? `Safra ${labelMes(drill.safra)} · M${drill.offset} — por ${drill.unidade}`
              : "Auditoria da célula"}
          </SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-zinc-400">
            {data
              ? `${vivos.length} de ${base} ${data.unidade === "cliente" ? "clientes" : "contratos"} vivos no mês (${pct}%)${produto ? ` · ${produto}` : ""}`
              : "Carregando…"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar a auditoria.</p>
          ) : (
            <>
              <GrupoItens
                titulo={`Vivos em M${data.offset}`}
                itens={vivos}
                unidade={data.unidade}
                abrir={vivos.length <= 40}
              />
              {data.offset > 0 && (
                <GrupoItens
                  titulo={`Saíram até M${data.offset}`}
                  itens={saidos}
                  unidade={data.unidade}
                  abrir={saidos.length <= 40}
                />
              )}
              <p className="text-xs text-gray-500 dark:text-zinc-500">
                {data.unidade === "cliente"
                  ? "MRR à direita = soma do Valor R dos contratos do cliente vivos no mês alvo. Nomes linkam para a task do cliente no ClickUp."
                  : "Valor à direita = Valor R do contrato. Nomes linkam para a subtask do contrato no ClickUp."}
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
