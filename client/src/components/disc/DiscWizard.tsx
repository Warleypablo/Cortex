import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DISC_PERGUNTAS, type Fator } from "@shared/disc";

export default function DiscWizard({ onConcluir }: { onConcluir: (respostas: Fator[]) => void }) {
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<(Fator | null)[]>(
    Array(DISC_PERGUNTAS.length).fill(null),
  );

  const pergunta = DISC_PERGUNTAS[idx];
  const total = DISC_PERGUNTAS.length;
  const progresso = Math.round(((idx + (respostas[idx] ? 1 : 0)) / total) * 100);

  const escolher = (fator: Fator) => {
    const novas = [...respostas];
    novas[idx] = fator;
    setRespostas(novas);
    // Avança automaticamente (última pergunta conclui).
    setTimeout(() => {
      if (idx < total - 1) {
        setIdx(idx + 1);
      } else {
        onConcluir(novas.map((r) => r as Fator));
      }
    }, 180);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Progresso */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-gray-500 dark:text-zinc-400">
          <span>Pergunta {idx + 1} de {total}</span>
          <span>{progresso}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardContent className="p-6">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900 dark:text-white">
            Qual palavra melhor te descreve?
          </h2>
          <div className="grid gap-3">
            {pergunta.opcoes.map((op) => {
              const selecionada = respostas[idx] === op.fator;
              return (
                <button
                  key={op.palavra}
                  onClick={() => escolher(op.fator)}
                  data-testid={`disc-opcao-${op.fator}`}
                  className={
                    "w-full rounded-lg border px-4 py-3 text-left text-base transition-colors " +
                    (selecionada
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-100"
                      : "border-gray-200 bg-white text-gray-800 hover:border-indigo-300 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-500 dark:hover:bg-zinc-800")
                  }
                >
                  {op.palavra}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button
          variant="ghost"
          size="sm"
          disabled={idx === 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          className="text-gray-500 dark:text-zinc-400"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
      </div>
    </div>
  );
}
