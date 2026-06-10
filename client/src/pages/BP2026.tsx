// client/src/pages/BP2026.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BPDreTable, type BPLinha } from "@/components/bp2026/BPDreTable";
import { BPMonthSelector } from "@/components/bp2026/BPMonthSelector";
import { Skeleton } from "@/components/ui/skeleton";

interface ReceitasResponse {
  ano: number;
  mesCorrente: number;
  mesFechado: number;
  linhas: BPLinha[];
  atualizadoEm: string;
}

export default function BP2026() {
  const { data, isLoading, error } = useQuery<ReceitasResponse>({
    queryKey: ["/api/bp2026/receitas"],
  });
  const [mes, setMes] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400">
        Erro ao carregar o orçado × realizado. Tente novamente.
      </div>
    );
  }

  const mesMaximo = Math.max(1, Math.min(data.mesCorrente, 12));
  // abre no último mês fechado; se nenhum fechou ainda (janeiro), no mês corrente
  const mesPadrao = data.mesFechado >= 1 ? data.mesFechado : mesMaximo;
  const mesAtivo = mes ?? mesPadrao;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            BP 2026 — Orçado × Realizado
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Bloco de receitas · orçado fechado em dezembro/2025 · realizado ao vivo
          </p>
        </div>
        <BPMonthSelector
          mes={mesAtivo}
          mesMaximo={mesMaximo}
          parcial={mesAtivo === data.mesCorrente && data.mesCorrente > data.mesFechado}
          onChange={setMes}
        />
      </div>
      <BPDreTable linhas={data.linhas} mes={mesAtivo} mesFechado={data.mesFechado} />
      <p className="text-xs text-gray-500 dark:text-zinc-500">
        MRR: ClickUp (snapshot fim do mês) · Pontual: Bitrix (vendas ganhas — proxy de
        faturamento) · Outras: Conta Azul (competência). YTD considera apenas meses
        fechados. Atualizado em {new Date(data.atualizadoEm).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
