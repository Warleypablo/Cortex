// client/src/pages/BP2026.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BPDreTable, type BPLinha } from "@/components/bp2026/BPDreTable";
import { BPCellDetail } from "@/components/bp2026/BPCellDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ReceitasResponse {
  ano: number;
  mesCorrente: number;
  mesFechado: number;
  linhas: BPLinha[];
  metricasGerais: BPLinha[];
  revenue: BPLinha[];
  funil: BPLinha[];
  capacity: BPLinha[];
  atualizadoEm: string;
}

export default function BP2026() {
  const { data, isLoading, error } = useQuery<ReceitasResponse>({
    queryKey: ["/api/bp2026/receitas"],
  });
  const [detalhe, setDetalhe] = useState<{ metrica: string; mes: number } | null>(null);

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          BP 2026 — Orçado × Realizado
        </h1>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Bloco de receitas · orçado fechado em dezembro/2025 · realizado ao vivo
        </p>
      </div>
      <Tabs defaultValue="dre">
        <TabsList>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="metricas">Métricas Gerais</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="funil">Funil Comercial</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
        </TabsList>
        <TabsContent value="dre" className="mt-4">
          <BPDreTable
            linhas={data.linhas}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
        <TabsContent value="metricas" className="mt-4">
          <BPDreTable
            linhas={data.metricasGerais}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
          />
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <BPDreTable
            linhas={data.revenue}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
          />
        </TabsContent>
        <TabsContent value="funil" className="mt-4">
          <BPDreTable
            linhas={data.funil}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
          />
        </TabsContent>
        <TabsContent value="capacity" className="mt-4">
          <BPDreTable
            linhas={data.capacity}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
          />
        </TabsContent>
      </Tabs>
      <BPCellDetail
        metrica={detalhe?.metrica ?? null}
        mes={detalhe?.mes ?? null}
        linhas={data.linhas}
        onClose={() => setDetalhe(null)}
      />
      <p className="text-xs text-gray-500 dark:text-zinc-500">
        MRR: ClickUp (snapshot fim do mês) · Pontual: Bitrix (vendas ganhas — proxy de
        faturamento) · Outras: Conta Azul (competência). Acumulado considera apenas meses
        fechados. Atualizado em {new Date(data.atualizadoEm).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
