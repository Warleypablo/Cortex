import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ExternalLink,
  FolderOpen,
  ListChecks,
  RotateCcw,
  Eye,
  TrendingUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface Processo {
  nome: string;
  descricao: string;
  linkLabel: string;
  linkUrl: string;
}

interface Aba {
  id: string;
  label: string;
  icon: React.ReactNode;
  processos: Processo[];
}

// ── Dados das Abas da Planilha ─────────────────────────────────────────

const ABAS: Aba[] = [
  {
    id: "processos",
    label: "Processos",
    icon: <ListChecks className="h-4 w-4" />,
    processos: [
      { nome: "Briefing padrão de tráfego", descricao: "Modelo padrão de briefing para campanhas de tráfego pago", linkLabel: "Turbo Operation System | Performance", linkUrl: "https://docs.google.com/document/d/1XDi6rsfBZ2xizWok7_kX5bZenp-VlISAsQhM05d60R0/edit?tab=t.0" },
      { nome: "Checklist de setup de campanhas", descricao: "Checklist completo para configuração de novas campanhas", linkLabel: "Turbo Operation System | Performance", linkUrl: "https://docs.google.com/document/d/1XDi6rsfBZ2xizWok7_kX5bZenp-VlISAsQhM05d60R0/edit?tab=t.0" },
      { nome: "Checklist de validação pré-go live", descricao: "Validações obrigatórias antes de ativar uma campanha", linkLabel: "Turbo Operation System | Performance", linkUrl: "https://docs.google.com/document/d/1XDi6rsfBZ2xizWok7_kX5bZenp-VlISAsQhM05d60R0/edit?tab=t.0" },
      { nome: "Fluxo de aprovação de criativos", descricao: "Processo de aprovação de peças criativas para campanhas", linkLabel: "Turbo Operation System | Performance", linkUrl: "https://docs.google.com/document/d/1XDi6rsfBZ2xizWok7_kX5bZenp-VlISAsQhM05d60R0/edit?tab=t.0" },
      { nome: "Padrão de nomenclatura de campanhas", descricao: "Regras de nomenclatura para organização de campanhas", linkLabel: "Turbo Operation System | Performance", linkUrl: "https://docs.google.com/document/d/1XDi6rsfBZ2xizWok7_kX5bZenp-VlISAsQhM05d60R0/edit?tab=t.0" },
      { nome: "Manual de arquitetura de conta", descricao: "Guia de estruturação e organização de contas de anúncios", linkLabel: "Turbo Operation System | Performance", linkUrl: "https://docs.google.com/document/d/1XDi6rsfBZ2xizWok7_kX5bZenp-VlISAsQhM05d60R0/edit?tab=t.0" },
      { nome: "Modelo de relatório de performance", descricao: "Template padrão para relatórios de performance de campanhas", linkLabel: "Turbo Operation System | Performance", linkUrl: "https://docs.google.com/document/d/1XDi6rsfBZ2xizWok7_kX5bZenp-VlISAsQhM05d60R0/edit?tab=t.0" },
    ],
  },
  {
    id: "rotinas",
    label: "Rotinas e Critérios",
    icon: <RotateCcw className="h-4 w-4" />,
    processos: [
      { nome: "Mapa de Processos da Área de Performance", descricao: "Fluxo visual ou documentado que representa, de ponta a ponta, como a área realmente opera. Desde a entrada da demanda até a entrega de relatórios, definindo responsabilidades, insumos e saídas por etapa", linkLabel: "Turbo Partners: Processo de Performance", linkUrl: "https://docs.google.com/document/d/1K91gzcdUopwj53uC4m78xMGefPbqiUc1ZkkD88fV6is/edit?usp=sharing" },
      { nome: "Rotina Operacional de Performance", descricao: "Define as operações diárias do gestor com responsabilidades claras entre funções analíticas e de monitoramento, estruturadas por rotinas diárias, semanais e mensais", linkLabel: "Ongoing (Pós Setup)", linkUrl: "https://drive.google.com/drive/folders/17Ws6SmTHKAqZNYC_Oc3Scuo4iQNmR1MP?usp=drive_link" },
      { nome: "Critérios de Otimização & Intervenção", descricao: "Estabelece critérios objetivos para decisões operacionais sobre mudança de criativos, pausas de campanhas e escalonamento de budget", linkLabel: "Critérios e Otimização", linkUrl: "https://docs.google.com/document/d/1CvvXYSKylUemKuEdyhYszxj70i6yreQw88qjfv5fF1Q/edit?tab=t.0#heading=h.6we43026g4g5" },
    ],
  },
  {
    id: "clareza",
    label: "Clareza de Performance",
    icon: <Eye className="h-4 w-4" />,
    processos: [
      { nome: "Proposta Única de Valor", descricao: "Documento que deixa claro o papel da área de Performance dentro da empresa, estabelecendo de forma objetiva o que essa área entrega, o que não está sob sua responsabilidade direta e quais são os seus limites de atuação. Define o objetivo central da área, as métricas que ela controla diretamente (CAC, CPA, volume qualificado, ROAS), bem como aquelas que influencia mas não controla", linkLabel: "Proposta Única de Valor", linkUrl: "https://docs.google.com/document/d/1LDQq7XCh3sKmAR7TW9AAUJh1omT1gDJ33w1P9aRMvqg/edit?tab=t.0" },
    ],
  },
  {
    id: "melhoria",
    label: "Melhoria Contínua",
    icon: <TrendingUp className="h-4 w-4" />,
    processos: [
      { nome: "Checklist de Saúde da Performance", descricao: "O Checklist de Saúde da Performance foi estruturado como um processo operacional e estratégico para garantir qualidade, consistência e escalabilidade nas operações de mídia paga da Turbo", linkLabel: "Checklist de Saúde da Performance", linkUrl: "https://docs.google.com/document/d/1TLDpQkPPyvPLaCx1gqgjpVHiaA3fqNHrJLvVZHQeEC4/edit?tab=t.0" },
      { nome: "Segmentos Prioritários", descricao: "Este playbook orienta a atuação do gestor de tráfego nos principais segmentos atendidos pela Turbo, garantindo decisões mais precisas, leitura correta de métricas e operações mais fluidas", linkLabel: "Segmentos Prioritários", linkUrl: "https://docs.google.com/document/d/1zfOguD95uxXig4wjnbsQHYXfmaRv2eFrTYGQxRqPbjc/edit?tab=t.0" },
    ],
  },
];

// ── ProcessCard Component ──────────────────────────────────────────────

function ProcessCard({ processo }: { processo: Processo }) {
  const hasLink = processo.linkUrl.length > 0;

  return (
    <Card
      className={`group relative transition-all duration-200 border border-gray-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 ${
        hasLink
          ? "hover:shadow-md hover:border-primary/30 dark:hover:border-primary/40 cursor-pointer"
          : ""
      }`}
      onClick={() => {
        if (hasLink) {
          window.open(processo.linkUrl, "_blank", "noopener,noreferrer");
        }
      }}
    >
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">
            {processo.nome}
          </h3>
          {hasLink && (
            <ExternalLink className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
          {processo.descricao}
        </p>
        {processo.linkLabel && (
          <div className="pt-1">
            <Badge
              variant="secondary"
              className="text-[10px] font-medium px-1.5 py-0 h-5 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
            >
              {processo.linkLabel}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ProcessosInternos() {
  const [searchTerm, setSearchTerm] = useState("");

  const totalProcessos = ABAS.reduce((acc, aba) => acc + aba.processos.length, 0);

  const filteredAbas = useMemo(() => {
    if (!searchTerm.trim()) return ABAS;

    const term = searchTerm.toLowerCase();
    return ABAS.map((aba) => ({
      ...aba,
      processos: aba.processos.filter(
        (p) =>
          p.nome.toLowerCase().includes(term) ||
          p.descricao.toLowerCase().includes(term) ||
          p.linkLabel.toLowerCase().includes(term)
      ),
    }));
  }, [searchTerm]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Processos Internos
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Playbook Estrutural — Performance (Gestão de Tráfego) &middot; {totalProcessos} processos
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar processos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
          />
        </div>
      </div>

      {/* Tabs */}
      <Card className="border-gray-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900/50">
        <Tabs defaultValue="processos">
          <div className="px-4 pt-4 sm:px-6 sm:pt-6">
            <TabsList className="w-fit">
              {ABAS.map((aba) => {
                const filteredCount = filteredAbas.find((a) => a.id === aba.id)?.processos.length ?? 0;
                return (
                  <TabsTrigger key={aba.id} value={aba.id} className="gap-2">
                    {aba.icon}
                    <span className="hidden sm:inline">{aba.label}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 ml-0.5">
                      {filteredCount}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <CardContent className="p-4 sm:p-6 pt-4">
            {ABAS.map((aba) => {
              const filtered = filteredAbas.find((a) => a.id === aba.id);
              const processos = filtered?.processos ?? [];

              return (
                <TabsContent key={aba.id} value={aba.id} className="mt-0">
                  {processos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Search className="h-10 w-10 text-gray-300 dark:text-zinc-600 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-zinc-400">
                        {searchTerm
                          ? `Nenhum processo encontrado para "${searchTerm}"`
                          : "Nenhum processo nesta seção ainda"}
                      </p>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          Limpar busca
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {processos.map((p) => (
                        <ProcessCard key={p.nome} processo={p} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
