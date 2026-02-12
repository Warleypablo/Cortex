import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Link2,
  FileText,
  ArrowUpRight,
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
  color: string;
  processos: Processo[];
}

// ── Dados das Abas da Planilha ─────────────────────────────────────────

const ABAS: Aba[] = [
  {
    id: "processos",
    label: "Processos",
    icon: <ListChecks className="h-4 w-4" />,
    color: "text-blue-600 dark:text-blue-400",
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
    color: "text-emerald-600 dark:text-emerald-400",
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
    color: "text-violet-600 dark:text-violet-400",
    processos: [
      { nome: "Proposta Única de Valor", descricao: "Documento que deixa claro o papel da área de Performance dentro da empresa, estabelecendo de forma objetiva o que essa área entrega, o que não está sob sua responsabilidade direta e quais são os seus limites de atuação. Define o objetivo central da área, as métricas que ela controla diretamente (CAC, CPA, volume qualificado, ROAS), bem como aquelas que influencia mas não controla", linkLabel: "Proposta Única de Valor", linkUrl: "https://docs.google.com/document/d/1LDQq7XCh3sKmAR7TW9AAUJh1omT1gDJ33w1P9aRMvqg/edit?tab=t.0" },
    ],
  },
  {
    id: "melhoria",
    label: "Melhoria Contínua",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-amber-600 dark:text-amber-400",
    processos: [
      { nome: "Checklist de Saúde da Performance", descricao: "O Checklist de Saúde da Performance foi estruturado como um processo operacional e estratégico para garantir qualidade, consistência e escalabilidade nas operações de mídia paga da Turbo", linkLabel: "Checklist de Saúde da Performance", linkUrl: "https://docs.google.com/document/d/1TLDpQkPPyvPLaCx1gqgjpVHiaA3fqNHrJLvVZHQeEC4/edit?tab=t.0" },
      { nome: "Segmentos Prioritários", descricao: "Este playbook orienta a atuação do gestor de tráfego nos principais segmentos atendidos pela Turbo, garantindo decisões mais precisas, leitura correta de métricas e operações mais fluidas", linkLabel: "Segmentos Prioritários", linkUrl: "https://docs.google.com/document/d/1zfOguD95uxXig4wjnbsQHYXfmaRv2eFrTYGQxRqPbjc/edit?tab=t.0" },
    ],
  },
];

// ── ProcessCard Component ──────────────────────────────────────────────

function ProcessCard({ processo, index }: { processo: Processo; index: number }) {
  const hasLink = processo.linkUrl.length > 0;

  return (
    <Card
      className={`group hover-elevate transition-all duration-300 ${
        hasLink ? "cursor-pointer" : ""
      }`}
      onClick={() => {
        if (hasLink) {
          window.open(processo.linkUrl, "_blank", "noopener,noreferrer");
        }
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0 group-hover:scale-110 transition-transform duration-300">
              <FileText className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm leading-snug line-clamp-2">
                {processo.nome}
              </CardTitle>
            </div>
          </div>
          {hasLink && (
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted/50 opacity-0 group-hover:opacity-100 transition-all duration-300 shrink-0">
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <CardDescription className="text-xs line-clamp-3 leading-relaxed">
          {processo.descricao}
        </CardDescription>
        {processo.linkLabel && (
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3 w-3 text-primary/60 shrink-0" />
            <span className="text-[11px] font-medium text-primary/80 dark:text-primary/70 truncate">
              {processo.linkLabel}
            </span>
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
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/15">
            <FolderOpen className="h-5.5 w-5.5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Processos Internos
            </h1>
            <p className="text-sm text-muted-foreground">
              Playbook Estrutural — Performance (Gestão de Tráfego)
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar processos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ABAS.map((aba) => {
          const count = aba.processos.length;
          return (
            <Card key={aba.id} className="bg-gradient-to-br from-white/80 via-white/60 to-slate-50/40 dark:from-slate-800/60 dark:via-slate-900/50 dark:to-slate-950/40 border-white/60 dark:border-white/10 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/25 dark:to-primary/10">
                  <span className={aba.color}>{aba.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground truncate">{aba.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs Content */}
      <Card>
        <Tabs defaultValue="processos">
          <CardHeader className="pb-0">
            <TabsList className="w-fit">
              {ABAS.map((aba) => {
                const filteredCount = filteredAbas.find((a) => a.id === aba.id)?.processos.length ?? 0;
                return (
                  <TabsTrigger key={aba.id} value={aba.id} className="gap-2">
                    <span className={aba.color}>{aba.icon}</span>
                    <span className="hidden sm:inline">{aba.label}</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5 font-semibold">
                      {filteredCount}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {ABAS.map((aba) => {
              const filtered = filteredAbas.find((a) => a.id === aba.id);
              const processos = filtered?.processos ?? [];

              return (
                <TabsContent key={aba.id} value={aba.id} className="mt-0">
                  {processos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/50 mb-4">
                        <Search className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {searchTerm
                          ? `Nenhum processo encontrado para "${searchTerm}"`
                          : "Nenhum processo nesta seção ainda"}
                      </p>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="mt-3 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          Limpar busca
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {processos.map((p, i) => (
                        <ProcessCard key={p.nome} processo={p} index={i} />
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
