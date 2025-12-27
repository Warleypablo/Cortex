import { Fragment } from "react";
import { useLocation, Link } from "wouter";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeNameMap: Record<string, string> = {
  "": "Home",
  "clientes": "Clientes",
  "contratos": "Contratos",
  "cliente": "Detalhes do Cliente",
  "colaboradores": "Colaboradores",
  "colaborador": "Detalhes do Colaborador",
  "patrimonio": "Patrimônio",
  "ferramentas": "Ferramentas",
  "turbozap": "TurboZap",
  "atendimento": "Atendimento",
  "acessos": "Acessos",
  "conhecimentos": "Conhecimentos",
  "beneficios": "Benefícios",
  "calendario": "Calendário",
  "okr-2026": "OKR 2026",
  "visao-geral": "Visão Geral",
  "investors-report": "Investors Report",
  "dashboard": "Dashboards",
  "financeiro": "Financeiro",
  "dfc": "DFC",
  "fluxo-caixa": "Fluxo de Caixa",
  "revenue-goals": "Metas de Receita",
  "inadimplencia": "Inadimplência",
  "auditoria-sistemas": "Auditoria de Sistemas",
  "geg": "G&G",
  "inhire": "Inhire",
  "recrutamento": "Recrutamento",
  "retencao": "Retenção",
  "cohort": "Cohort",
  "meta-ads": "Meta Ads",
  "tech": "Tech",
  "comercial": "Comercial",
  "closers": "Closers",
  "sdrs": "SDRs",
  "detalhamento-closers": "Detalhamento Closers",
  "detalhamento-sdrs": "Detalhamento SDRs",
  "analise-vendas": "Análise de Vendas",
  "detalhamento-vendas": "Detalhamento de Vendas",
  "apresentacao": "Apresentação",
  "growth": "Growth",
  "criativos": "Criativos",
  "performance-plataformas": "Performance Plataformas",
  "cases": "Cases",
  "chat": "Chat",
  "juridico": "Jurídico",
  "rh": "RH",
  "onboarding": "Onboarding",
  "admin": "Administração",
  "usuarios": "Usuários",
  "regras-notificacoes": "Regras de Notificações",
  "projetos": "Projetos",
  "analise": "Análise",
};

interface BreadcrumbItemData {
  label: string;
  path: string;
  isLast: boolean;
}

function getBreadcrumbItems(pathname: string): BreadcrumbItemData[] {
  if (pathname === "/" || pathname === "") {
    return [];
  }

  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItemData[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    const isId = /^\d+$/.test(segment) || segment.length > 20;
    
    if (isId) {
      continue;
    }

    const label = routeNameMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    items.push({
      label,
      path: currentPath,
      isLast,
    });
  }

  if (items.length > 0) {
    items[items.length - 1].isLast = true;
  }

  return items;
}

export function Breadcrumbs() {
  const [location] = useLocation();
  const items = getBreadcrumbItems(location);

  if (items.length === 0) {
    return null;
  }

  return (
    <Breadcrumb data-testid="breadcrumb-nav">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" data-testid="breadcrumb-home">
              <Home className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {items.map((item, index) => (
          <Fragment key={item.path}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage data-testid={`breadcrumb-page-${index}`}>
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.path} data-testid={`breadcrumb-link-${index}`}>
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default Breadcrumbs;
