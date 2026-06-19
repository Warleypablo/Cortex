// client/src/pages/BP2026.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BPDreTable, type BPLinha } from "@/components/bp2026/BPDreTable";
import { BPCellDetail } from "@/components/bp2026/BPCellDetail";
import { BPReconciliacao } from "@/components/bp2026/BPReconciliacao";
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
  vendasProduto: BPLinha[];
  capacity: BPLinha[];
  sgaDetalhe: BPLinha[];
  cacDetalhe: BPLinha[];
  outrasDetalhe: BPLinha[];
  atualizadoEm: string;
}

export default function BP2026() {
  const { data, isLoading, error } = useQuery<ReceitasResponse>({
    queryKey: ["/api/bp2026/receitas"],
  });
  const [detalhe, setDetalhe] = useState<{ metrica: string; mes: number } | null>(null);
  const [recon, setRecon] = useState<{ produto: string; mes: number; titulo: string } | null>(null);
  const PRODUTOS_REVENUE = ["performance", "creators", "social", "gc", "others"];

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
          <TabsTrigger value="dre">Overview</TabsTrigger>
          <TabsTrigger value="metricas">Métricas Gerais</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="funil">Funil Comercial</TabsTrigger>
          <TabsTrigger value="vendasProduto">Vendas por Produto</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="sga">SG&amp;A</TabsTrigger>
          <TabsTrigger value="cac">CAC</TabsTrigger>
          <TabsTrigger value="outras">Outras Receitas</TabsTrigger>
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
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <BPDreTable
            linhas={data.revenue}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => {
              const prod = metrica.startsWith("mrr_") ? metrica.slice(4) : "";
              if (PRODUTOS_REVENUE.includes(prod)) {
                const titulo = data.revenue.find((l) => l.metrica === metrica)?.titulo ?? prod;
                setRecon({ produto: prod, mes, titulo });
              } else {
                setDetalhe({ metrica, mes });
              }
            }}
          />
        </TabsContent>
        <TabsContent value="funil" className="mt-4">
          <BPDreTable
            linhas={data.funil}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
        <TabsContent value="vendasProduto" className="mt-4">
          <BPDreTable
            linhas={data.vendasProduto}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
        <TabsContent value="capacity" className="mt-4">
          <BPDreTable
            linhas={data.capacity}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
        <TabsContent value="sga" className="mt-4">
          <BPDreTable
            linhas={data.sgaDetalhe}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
        <TabsContent value="cac" className="mt-4">
          <BPDreTable
            linhas={data.cacDetalhe}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
        <TabsContent value="outras" className="mt-4">
          <BPDreTable
            linhas={data.outrasDetalhe}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
      </Tabs>
      <BPCellDetail
        metrica={detalhe?.metrica ?? null}
        mes={detalhe?.mes ?? null}
        linhas={[
          ...data.linhas, ...data.metricasGerais, ...data.revenue,
          ...data.funil, ...data.vendasProduto, ...data.capacity, ...data.sgaDetalhe,
          ...data.cacDetalhe, ...data.outrasDetalhe,
        ]}
        onClose={() => setDetalhe(null)}
      />
      <BPReconciliacao
        produto={recon?.produto ?? null}
        mes={recon?.mes ?? null}
        titulo={recon?.titulo ?? ""}
        onClose={() => setRecon(null)}
      />
      <p className="text-xs text-gray-500 dark:text-zinc-500">
        MRR: ClickUp (snapshot fim do mês) · Pontual: Bitrix (vendas ganhas — proxy de
        faturamento) · Outras: Conta Azul (competência). Acumulado considera apenas meses
        fechados. Atualizado em {new Date(data.atualizadoEm).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
