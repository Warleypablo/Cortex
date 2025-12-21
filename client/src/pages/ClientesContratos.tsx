import { useState, useEffect } from "react";
import { Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageInfo } from "@/contexts/PageContext";
import Clients from "./Clients";
import Contracts from "./Contracts";

type Tab = "clientes" | "contratos";

const TAB_TITLES: Record<Tab, { title: string; subtitle: string }> = {
  clientes: { title: "Clientes", subtitle: "Gestão de clientes ativos" },
  contratos: { title: "Contratos", subtitle: "Acompanhamento de contratos e serviços" },
};

export default function ClientesContratos() {
  const { setPageInfo } = usePageInfo();
  const [activeTab, setActiveTab] = useState<Tab>("clientes");
  
  useEffect(() => {
    const { title, subtitle } = TAB_TITLES[activeTab];
    setPageInfo(title, subtitle);
  }, [activeTab, setPageInfo]);

  const tabs = [
    { id: "clientes" as Tab, label: "Clientes", icon: Users },
    { id: "contratos" as Tab, label: "Contratos", icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 p-2 bg-card/50 border-b border-border mx-4 mt-4 rounded-lg w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={`gap-2 ${isActive ? "bg-muted" : ""}`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>
      
      <div className="flex-1 overflow-auto">
        {activeTab === "clientes" && <Clients />}
        {activeTab === "contratos" && <Contracts />}
      </div>
    </div>
  );
}
