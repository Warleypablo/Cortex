// client/src/pages/BP2026.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BPDreTable, type BPLinha } from "@/components/bp2026/BPDreTable";
import { useAuth } from "@/contexts/AuthContext";
import { BP2026_TABS, abasPermitidas } from "@shared/bp2026-tabs";

// Converte lista plana com paiMetrica → árvore com filhos para BPDreTable.
function nestFilhos(linhas: BPLinha[]): BPLinha[] {
  const filhosPorPai = new Map<string, BPLinha[]>();
  for (const l of linhas) {
    const pm = (l as any).paiMetrica as string | undefined;
    if (pm) {
      if (!filhosPorPai.has(pm)) filhosPorPai.set(pm, []);
      filhosPorPai.get(pm)!.push(l);
    }
  }
  return linhas
    .filter((l) => !(l as any).paiMetrica)
    .map((pai) => {
      const filhos = filhosPorPai.get(pai.metrica);
      return filhos ? { ...pai, filhos } : pai;
    });
}
import { BPCellDetail } from "@/components/bp2026/BPCellDetail";
import { BPReconciliacao } from "@/components/bp2026/BPReconciliacao";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

interface ReceitasResponse {
  ano: number;
  mesCorrente: number;
  mesFechado: number;
  linhas: BPLinha[];
  metricasGerais: BPLinha[];
  revenue: BPLinha[];
  pontual: BPLinha[];
  funil: BPLinha[];
  vendasProduto: BPLinha[];
  capacity: BPLinha[];
  sgaDetalhe: BPLinha[];
  cacDetalhe: BPLinha[];
  outrasDetalhe: BPLinha[];
  atualizadoEm: string;
}

interface CreatorsPontualResponse {
  linhas: BPLinha[];
  mesCorrente: number;
  mesFechado: number;
}

export default function BP2026() {
  const { data, isLoading, error } = useQuery<ReceitasResponse>({
    queryKey: ["/api/bp2026/receitas"],
  });
  const { data: creatorsData } = useQuery<CreatorsPontualResponse>({
    queryKey: ["/api/bp2026/pontual-creators"],
  });
  const { user } = useAuth();
  const abas = abasPermitidas(user?.role, user?.allowedBpTabs);
  const podeVer = (id: string) => abas.includes(id as any);

  const [detalhe, setDetalhe] = useState<{ metrica: string; mes: number; aba: string } | null>(null);
  const [recon, setRecon] = useState<{ produto: string; mes: number; titulo: string } | null>(null);
  const [detalheCreators, setDetalheCreators] = useState<{ metrica: string; mes: number; aba: string } | null>(null);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            BP 2026 — Orçado × Realizado
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Bloco de receitas · orçado fechado em dezembro/2025 · realizado ao vivo
          </p>
        </div>
        <Link href="/bp-2026/copilot">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0">
            <Bot className="w-4 h-4" />
            BP Copilot
          </Button>
        </Link>
      </div>
      {abas.length === 0 && (
        <div className="p-4 text-sm text-gray-600 dark:text-zinc-400">
          Você não tem acesso a nenhuma aba do BP 2026. Fale com um administrador.
        </div>
      )}
      {abas.length > 0 && (
        <Tabs defaultValue={abas[0] ?? "dre"}>
          <TabsList>
            {BP2026_TABS.filter((t: { id: string; label: string }) => podeVer(t.id)).map((t: { id: string; label: string }) => (
              <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {podeVer("dre") && (
            <TabsContent value="dre" className="mt-4">
              <BPDreTable
                linhas={data.linhas}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "dre" })}
              />
            </TabsContent>
          )}
          {podeVer("metricas") && (
            <TabsContent value="metricas" className="mt-4">
              <BPDreTable
                linhas={data.metricasGerais}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "metricas" })}
              />
            </TabsContent>
          )}
          {podeVer("revenue") && (
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
                    setDetalhe({ metrica, mes, aba: "revenue" });
                  }
                }}
              />
            </TabsContent>
          )}
          {podeVer("funil") && (
            <TabsContent value="funil" className="mt-4">
              <BPDreTable
                linhas={data.funil}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "funil" })}
              />
            </TabsContent>
          )}
          {podeVer("vendasProduto") && (
            <TabsContent value="vendasProduto" className="mt-4">
              <BPDreTable
                linhas={data.vendasProduto}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "vendasProduto" })}
              />
            </TabsContent>
          )}
          {podeVer("capacity") && (
            <TabsContent value="capacity" className="mt-4">
              <BPDreTable
                linhas={data.capacity}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "capacity" })}
              />
            </TabsContent>
          )}
          {podeVer("sga") && (
            <TabsContent value="sga" className="mt-4">
              <BPDreTable
                linhas={data.sgaDetalhe}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "sga" })}
              />
            </TabsContent>
          )}
          {podeVer("cac") && (
            <TabsContent value="cac" className="mt-4">
              <BPDreTable
                linhas={data.cacDetalhe}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "cac" })}
              />
            </TabsContent>
          )}
          {podeVer("outras") && (
            <TabsContent value="outras" className="mt-4">
              <BPDreTable
                linhas={data.outrasDetalhe}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "outras" })}
              />
            </TabsContent>
          )}
          {podeVer("pontual") && (
            <TabsContent value="pontual" className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                Pontual — venda comercial e movimento de estoque (só realizado)
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-4xl">
                <strong>Venda Pontual</strong> = quanto foi vendido no mês (data de criação), igual a Vendas
                por Produto; decomposta em <em>entrou no estoque</em> e <em>fora do estoque</em> (entregue/cancelada
                ou criada no fim do mês). O <strong>Movimento do estoque</strong> é a foto do ClickUp (snapshot) e
                fecha no estoque final — é outra régua de valor, por isso a Entrada na foto não é igual à Venda.
              </p>
              <BPDreTable
                linhas={nestFilhos(data.pontual)}
                mesCorrente={data.mesCorrente}
                mesFechado={data.mesFechado}
                mostrarOrcado={false}
                onCellClick={(metrica, mes) => setDetalhe({ metrica, mes, aba: "pontual" })}
              />
            </TabsContent>
          )}
          {podeVer("pontual-creators") && (
            <TabsContent value="pontual-creators" className="mt-4 space-y-2">
              {!creatorsData ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <BPDreTable
                  linhas={nestFilhos(creatorsData.linhas)}
                  mesCorrente={creatorsData.mesCorrente}
                  mesFechado={creatorsData.mesFechado}
                  mostrarOrcado={false}
                  onCellClick={(metrica, mes) => setDetalheCreators({ metrica, mes, aba: "pontual-creators" })}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      )}
      <BPCellDetail
        metrica={detalhe?.metrica ?? null}
        mes={detalhe?.mes ?? null}
        aba={detalhe?.aba}
        linhas={[
          ...data.linhas, ...data.metricasGerais, ...data.revenue,
          ...data.pontual, ...data.funil, ...data.vendasProduto, ...data.capacity, ...data.sgaDetalhe,
          ...data.cacDetalhe, ...data.outrasDetalhe,
        ]}
        onClose={() => setDetalhe(null)}
      />
      <BPCellDetail
        metrica={detalheCreators?.metrica ?? null}
        mes={detalheCreators?.mes ?? null}
        aba={detalheCreators?.aba}
        linhas={creatorsData?.linhas ?? []}
        onClose={() => setDetalheCreators(null)}
        segmento="creators"
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
