import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Brain, ArrowRight, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DiscWizard from "@/components/disc/DiscWizard";
import DiscResultado, { type DiscResultadoData } from "@/components/disc/DiscResultado";
import { type Fator } from "@shared/disc";

type Etapa = "intro" | "teste" | "resultado";

export default function DiscTeste() {
  const { setPageInfo } = usePageInfo();
  usePageTitle("Perfil Comportamental (DISC)");
  const { toast } = useToast();

  const [etapa, setEtapa] = useState<Etapa>("intro");
  const [resultado, setResultado] = useState<DiscResultadoData | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Guard idempotente: o DiscWizard pode disparar onConcluir DUAS vezes (duplo clique
  // na última pergunta dispara dois setTimeout de 180ms). O state `enviando` é assíncrono
  // e não é confiável como guard síncrono, então usamos um ref para bloquear na hora.
  const enviandoRef = useRef(false);

  useEffect(() => {
    setPageInfo("Perfil Comportamental (DISC)", "Descubra seu perfil de comportamento");
  }, [setPageInfo]);

  const { data: meu, isLoading } = useQuery<DiscResultadoData | null>({
    queryKey: ["/api/gg/disc/meu"],
  });

  useEffect(() => {
    if (meu && etapa === "intro") {
      setResultado(meu);
      setEtapa("resultado");
    }
  }, [meu]); // eslint-disable-line react-hooks/exhaustive-deps

  const concluir = async (respostas: Fator[]) => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const res = await apiRequest("POST", "/api/gg/disc/resultado", { respostas });
      const data = (await res.json()) as DiscResultadoData;
      setResultado(data);
      setEtapa("resultado");
    } catch (e) {
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setEnviando(false);
      enviandoRef.current = false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {etapa === "intro" && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                <Brain className="h-5 w-5" />
              </span>
              <CardTitle className="text-xl text-gray-900 dark:text-white">Teste de Perfil Comportamental (DISC)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-600 dark:text-zinc-300">
            <p>
              São <strong>40 perguntas</strong> rápidas (~3 min). Em cada uma, escolha a palavra
              que <strong>melhor te descreve</strong>. Não existe resposta certa ou errada —
              responda com sinceridade e pela sua primeira impressão.
            </p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              O DISC mede 4 fatores: Dominância, Influência, Estabilidade e Conformidade.
              Ao final você vê seu perfil e uma leitura de pontos fortes e comunicação.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => setEtapa("teste")} data-testid="disc-iniciar">
                Começar teste <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Link href="/gg/disc/mapa">
                <Button variant="outline">
                  <Map className="mr-1 h-4 w-4" /> Ver mapa do time
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === "teste" && (
        <div className="relative">
          {enviando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-black/60">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          )}
          <DiscWizard onConcluir={concluir} />
        </div>
      )}

      {etapa === "resultado" && resultado && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Seu resultado DISC</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setResultado(null); setEtapa("teste"); }}>
                Refazer teste
              </Button>
              <Link href="/gg/disc/mapa">
                <Button variant="ghost"><Map className="mr-1 h-4 w-4" /> Mapa do time</Button>
              </Link>
            </div>
          </div>
          <DiscResultado data={resultado} />
        </div>
      )}
    </div>
  );
}
