import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/StatsCard";
import TeamMember from "@/components/TeamMember";
import ContractCard from "@/components/ContractCard";
import RevenueChart from "@/components/RevenueChart";
import { ArrowLeft, DollarSign, TrendingUp, Receipt } from "lucide-react";
import avatar1 from '@assets/generated_images/Marketing_executive_avatar_male_fff2f919.png';
import avatar2 from '@assets/generated_images/Marketing_manager_avatar_female_d414a5e8.png';
import avatar3 from '@assets/generated_images/Tech_developer_avatar_male_029e9424.png';

//todo: remove mock functionality
const mockClientData = {
  "1": {
    id: "1",
    name: "Ensinando Tecnologia e Intermediação Ltda",
    cnpj: "33.406.825/0001-60",
    squad: "Performance",
    status: "active",
    stakeholder: "Murilo Carvalho",
    stakeholderPhone: "+5527996020510",
    city: "Vitória",
    state: "ES",
    startDate: "2024-06-04",
    ltv: 43400,
    avgTicket: 6200,
    totalInvoices: 7,
    contracts: [
      { module: "Design Services", service: "Criação de artes", type: "Recorrente" as const, value: 0 },
      { module: "Engagement Solutions", service: "Landing Page - Portugal", type: "Recorrente" as const, value: 5281 },
      { module: "Growth Marketing Advisory", service: "Gestão de Projetos Essencial", type: "Recorrente" as const, value: 6200 },
      { module: "Media Management", service: "Google + Social Ads", type: "Recorrente" as const, value: 0 }
    ],
    team: [
      { name: "Murilo Carvalho", role: "Account Manager", avatar: avatar1 },
      { name: "Ana Silva", role: "Performance Specialist", avatar: avatar2 },
      { name: "Carlos Santos", role: "Tech Lead", avatar: avatar3 }
    ],
    revenueHistory: [
      { month: '07/2024', revenue: 6200 },
      { month: '08/2024', revenue: 6200 },
      { month: '09/2024', revenue: 6200 },
      { month: '10/2024', revenue: 6200 },
      { month: '11/2024', revenue: 6200 },
      { month: '12/2024', revenue: 6200 }
    ]
  }
};

export default function ClientDetail() {
  const [, params] = useRoute("/cliente/:id");
  const clientId = params?.id || "1";
  
  //todo: remove mock functionality
  const client = mockClientData[clientId as keyof typeof mockClientData] || mockClientData["1"];

  const getSquadColor = (squad: string) => {
    switch (squad) {
      case "Performance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Comunicação":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "Tech":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="hover-elevate -ml-2 mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para clientes
            </Button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold mb-2">{client.name}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>CNPJ: {client.cnpj}</span>
                <span>•</span>
                <span>{client.city}, {client.state}</span>
                <span>•</span>
                <span>Início: {new Date(client.startDate).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getSquadColor(client.squad)} variant="outline">
                {client.squad}
              </Badge>
              <Badge variant={client.status === "active" ? "default" : "secondary"}>
                {client.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="LTV"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(client.ltv)}
            icon={DollarSign}
          />
          <StatsCard
            title="Ticket Médio"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(client.avgTicket)}
            icon={TrendingUp}
          />
          <StatsCard
            title="Total de Faturas"
            value={client.totalInvoices.toString()}
            icon={Receipt}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <RevenueChart data={client.revenueHistory} />
          </div>
          <div>
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Equipe Responsável</h3>
              <div className="space-y-4">
                {client.team.map((member, idx) => (
                  <TeamMember
                    key={idx}
                    name={member.name}
                    role={member.role}
                    avatarUrl={member.avatar}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-6">Contratos Ativos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.contracts.map((contract, idx) => (
              <ContractCard
                key={idx}
                module={contract.module}
                service={contract.service}
                type={contract.type}
                value={contract.value}
                startDate={client.startDate}
              />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Informações Institucionais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Stakeholder</p>
                <p className="font-medium">{client.stakeholder}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Celular</p>
                <p className="font-medium">{client.stakeholderPhone}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Endereço</p>
                <p className="font-medium">{client.city}, {client.state}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">CNPJ</p>
                <p className="font-medium">{client.cnpj}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}