import { Link } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TechOverview from "./tech/TechOverview";
import TechProjetos from "./tech/TechProjetos";
import TechPerformance from "./tech/TechPerformance";

type Section = "overview" | "projetos" | "performance";

const tabs: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "projetos", label: "Projetos" },
  { id: "performance", label: "Performance" },
];

export default function TechHub() {
  const searchParams = new URLSearchParams(window.location.search);
  const sectionParam = searchParams.get("section") as Section | null;
  const defaultTab = tabs.some((t) => t.id === sectionParam) ? sectionParam! : "overview";

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      <Tabs defaultValue={defaultTab} className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-medium text-foreground">Tech Hub</h1>
            <Link
              href="/tech/responsavel"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Por Responsável →
            </Link>
          </div>
          <TabsList className="bg-transparent p-0 h-auto gap-4">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 pb-3 pt-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Content */}
        <TabsContent value="overview" className="flex-1 overflow-auto mt-0">
          <TechOverview />
        </TabsContent>
        <TabsContent value="projetos" className="flex-1 overflow-auto mt-0">
          <TechProjetos />
        </TabsContent>
        <TabsContent value="performance" className="flex-1 overflow-auto mt-0">
          <TechPerformance />
        </TabsContent>
      </Tabs>
    </div>
  );
}
