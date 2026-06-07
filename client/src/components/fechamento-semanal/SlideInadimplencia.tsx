import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface InadimplenciaResumo {
  totalInadimplente: number;
  quantidadeClientes: number;
  faixas: {
    ate30dias: { valor: number; quantidade: number; percentual: number };
    de31a60dias: { valor: number; quantidade: number; percentual: number };
    de61a90dias: { valor: number; quantidade: number; percentual: number };
    acima90dias: { valor: number; quantidade: number; percentual: number };
  };
}

interface InadimplenciaCliente {
  idCliente: string;
  nome: string;
  totalDevido: number;
  diasAtrasoMedio: number;
}

export default function SlideInadimplencia(_: SlideProps) {
  const { data: resumo, isLoading: loadingResumo } = useQuery<InadimplenciaResumo>({
    queryKey: ["/api/inadimplencia/resumo"],
    queryFn: async () => {
      const res = await fetch("/api/inadimplencia/resumo", { credentials: "include" });
      return res.json();
    },
  });

  const { data: clientes } = useQuery<InadimplenciaCliente[]>({
    queryKey: ["/api/inadimplencia/clientes", { limite: 5, ordenarPor: "valor" }],
    queryFn: async () => {
      const res = await fetch("/api/inadimplencia/clientes?limite=5&ordenarPor=valor", { credentials: "include" });
      return res.json();
    },
  });

  const faixas = resumo
    ? [
        { label: "0–30 dias", valor: resumo.faixas.ate30dias.valor, pct: resumo.faixas.ate30dias.percentual, color: "bg-yellow-500" },
        { label: "31–60 dias", valor: resumo.faixas.de31a60dias.valor, pct: resumo.faixas.de31a60dias.percentual, color: "bg-orange-500" },
        { label: "61–90 dias", valor: resumo.faixas.de61a90dias.valor, pct: resumo.faixas.de61a90dias.percentual, color: "bg-red-500" },
        { label: "+90 dias", valor: resumo.faixas.acima90dias.valor, pct: resumo.faixas.acima90dias.percentual, color: "bg-red-800" },
      ]
    : [];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Inadimplência</h2>
      {loadingResumo ? (
        <Skeleton className="h-32 w-full bg-zinc-800" />
      ) : resumo ? (
        <>
          <div className="flex items-end gap-8 mb-10">
            <div>
              <p className="text-zinc-400 text-sm mb-1">Total em Aberto</p>
              <p className="text-6xl font-bold text-red-400">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(resumo.totalInadimplente)}
              </p>
            </div>
            <div className="mb-2">
              <p className="text-zinc-400 text-sm mb-1">Clientes</p>
              <p className="text-3xl font-semibold">{resumo.quantidadeClientes}</p>
            </div>
          </div>
          <div className="space-y-3 mb-10">
            {faixas.map((f) => (
              <div key={f.label} className="flex items-center gap-4">
                <span className="text-zinc-400 text-sm w-20">{f.label}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full transition-all`} style={{ width: `${Math.min(f.pct, 100)}%` }} />
                </div>
                <span className="text-sm text-zinc-300 w-32 text-right">{formatCurrencyCompact(f.valor)}</span>
              </div>
            ))}
          </div>
          {clientes && clientes.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Valor em Aberto</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Dias médios</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => (
                    <tr key={c.idCliente} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{c.nome}</td>
                      <td className="px-4 py-3 text-right text-red-400 font-semibold">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(c.totalDevido)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{c.diasAtrasoMedio}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
