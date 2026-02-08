import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Send, ClipboardCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AREAS = [
  "Sócio / Partner",
  "Financeiro",
  "Pré-vendas (SDR/BDR)",
  "Comercial",
  "Tech sites",
  "Tech (IA)",
  "Design",
  "Gente e Gestão",
  "Comunicação",
  "Gestor de performance - SQUADRA",
  "Gestor de performance - SELVA",
  "CX / CS",
  "Audiovisual",
  "Estagiário (geral)",
  "Liderança (squad, time)",
];

const MOTIVOS_PERMANENCIA = [
  "O fato dela me proporcionar equilíbrio entre minha vida pessoal e profissional",
  "A remuneração e benefícios oferecidos pela empresa",
  "A oportunidade que tenho de crescer e me desenvolver",
  "O alinhamento dos meus valores com os valores da empresa",
];

function getMesReferencia() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getLocalStorageKey() {
  return `nps_submitted_${getMesReferencia()}`;
}

function ScoreSelector({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">{label} <span className="text-red-500">*</span></Label>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 11 }, (_, i) => i).map((score) => {
          const isSelected = value === score;
          let colorClass = "border-gray-300 dark:border-zinc-600 hover:border-gray-400 dark:hover:border-zinc-500";
          if (isSelected) {
            if (score <= 6) colorClass = "bg-red-500 border-red-500 text-white";
            else if (score <= 8) colorClass = "bg-yellow-500 border-yellow-500 text-white";
            else colorClass = "bg-green-500 border-green-500 text-white";
          }

          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={`w-11 h-11 rounded-lg border-2 text-sm font-bold transition-all ${colorClass} ${
                !isSelected ? "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300" : ""
              }`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>Não recomendaria</span>
        <span>Recomendaria para todos</span>
      </div>
    </div>
  );
}

export default function NpsPesquisa() {
  const { setPageInfo } = usePageInfo();
  usePageTitle("E-NPS - Pesquisa");

  useEffect(() => {
    setPageInfo("E-NPS", "Pesquisa de satisfação anônima");
  }, [setPageInfo]);

  const mesRef = getMesReferencia();
  const mesNome = format(new Date(), "MMMM/yyyy", { locale: ptBR });
  const [alreadySubmitted, setAlreadySubmitted] = useState(
    () => localStorage.getItem(getLocalStorageKey()) === "true"
  );
  const [submitted, setSubmitted] = useState(false);

  const [area, setArea] = useState("");
  const [motivoPermanencia, setMotivoPermanencia] = useState("");
  const [scoreEmpresa, setScoreEmpresa] = useState<number | null>(null);
  const [comentarioEmpresa, setComentarioEmpresa] = useState("");
  const [scoreLider, setScoreLider] = useState<number | null>(null);
  const [comentarioLider, setComentarioLider] = useState("");
  const [scoreProdutos, setScoreProdutos] = useState<number | null>(null);
  const [comentarioProdutos, setComentarioProdutos] = useState("");
  const [feedbackGeral, setFeedbackGeral] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/rh/nps", data);
      return res.json();
    },
    onSuccess: () => {
      localStorage.setItem(getLocalStorageKey(), "true");
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/rh/nps/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rh/nps/respostas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rh/nps/meses"] });
    },
  });

  const isFormValid =
    area &&
    motivoPermanencia &&
    scoreEmpresa !== null &&
    comentarioEmpresa.trim() &&
    scoreLider !== null &&
    comentarioLider.trim() &&
    scoreProdutos !== null &&
    comentarioProdutos.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;
    mutation.mutate({
      mesReferencia: mesRef,
      area,
      motivoPermanencia,
      scoreEmpresa,
      comentarioEmpresa: comentarioEmpresa.trim(),
      scoreLider,
      comentarioLider: comentarioLider.trim(),
      scoreProdutos,
      comentarioProdutos: comentarioProdutos.trim(),
      feedbackGeral: feedbackGeral.trim() || null,
    });
  }

  if (alreadySubmitted || submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
              {submitted ? "Resposta enviada com sucesso!" : "Você já respondeu este mês!"}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {submitted
                ? "Obrigado por participar da pesquisa E-NPS. Sua resposta é anônima e nos ajuda a melhorar cada vez mais."
                : `Você já enviou sua resposta para ${mesNome}. A pesquisa é liberada uma vez por mês.`}
            </p>
            <Badge variant="outline" className="mt-2 text-sm">
              Referência: {mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                E-NPS: {mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">Pesquisa anônima de satisfação</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              Tornamos a vida de quem quer vender online mais fácil e rentável, aproveitando
              desse know how para criar as marcas da próxima geração. Juntamente a isso temos
              os melhores profissionais conosco, transformando a vida desses clientes e
              construindo algo que gere retorno positivo nas vidas das pessoas envolvidas nesse
              processo!
            </p>
            <p>
              E para melhorarmos ainda mais nossos resultados, sabemos que é fundamental
              termos um ambiente de trabalho excelente, cada vez mais satisfatório, saudável e
              com entusiasmo, para continuarmos nossa missão!
            </p>
            <p className="font-medium text-foreground">
              Por favor, responda a pesquisa abaixo com sinceridade (as respostas são{" "}
              <span className="font-bold text-primary">ANÔNIMAS</span>) e assertividade!
              Você é FUNDAMENTAL para a nossa evolução e próximos passos aqui na turbo!
            </p>
            <p className="italic">
              Você sonha grande, é inconformado e por isso melhora todos os dias. Pensando como
              dono, fazendo o que tem que ser feito, você terá o que merece!
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Área */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Qual a sua área na Turbo? <span className="text-red-500">*</span></Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione sua área" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">O principal motivo que me faz permanecer na empresa é: <span className="text-red-500">*</span></Label>
              <Select value={motivoPermanencia} onValueChange={setMotivoPermanencia}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_PERMANENCIA.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Score Empresa */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <ScoreSelector
              label="Em uma escala de 0 a 10, o quanto você avalia a Turbo Partners?"
              value={scoreEmpresa}
              onChange={setScoreEmpresa}
            />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                O que precisamos fazer para sermos ou mantermos um 10? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={comentarioEmpresa}
                onChange={(e) => setComentarioEmpresa(e.target.value)}
                placeholder="Escreva sua resposta..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Score Líder */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <ScoreSelector
              label="Em uma escala de 0 a 10, o quanto você avalia o seu líder de equipe como uma boa pessoa para se trabalhar?"
              value={scoreLider}
              onChange={setScoreLider}
            />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                O que o seu líder precisa fazer ou manter para receber um 10? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={comentarioLider}
                onChange={(e) => setComentarioLider(e.target.value)}
                placeholder="Escreva sua resposta..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Score Produtos */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <ScoreSelector
              label="Em uma escala de 0 a 10, o quanto você avalia os produtos da nossa empresa?"
              value={scoreProdutos}
              onChange={setScoreProdutos}
            />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                O que podemos fazer para recebermos ou mantermos um 10? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={comentarioProdutos}
                onChange={(e) => setComentarioProdutos(e.target.value)}
                placeholder="Escreva sua resposta..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Feedback Geral */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <Label className="text-sm font-semibold">
              Espaço para feedbacks, críticas construtivas e opiniões:
            </Label>
            <Textarea
              value={feedbackGeral}
              onChange={(e) => setFeedbackGeral(e.target.value)}
              placeholder="Opcional - fique à vontade para compartilhar..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={!isFormValid || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? "Enviando..." : (
              <>
                <Send className="w-4 h-4" />
                Enviar Pesquisa
              </>
            )}
          </Button>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-500 text-center">
            Erro ao enviar. Tente novamente.
          </p>
        )}
      </form>
    </div>
  );
}
