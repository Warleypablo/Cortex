import { BarChart3, FolderOpen, TrendingUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TechOverview from "./tech/TechOverview";
import TechProjetos from "./tech/TechProjetos";
import TechPerformance from "./tech/TechPerformance";

type Section = "overview" | "projetos" | "performance";

const tabs: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "projetos", label: "Projetos", icon: FolderOpen },
  { id: "performance", label: "Performance", icon: TrendingUp },
];

export default function TechHub() {
  const searchParams = new URLSearchParams(window.location.search);
  const sectionParam = searchParams.get("section") as Section | null;
  const defaultTab = tabs.some((t) => t.id === sectionParam) ? sectionParam! : "overview";

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-zinc-900">
      <Tabs defaultValue={defaultTab} className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Tech Hub</h1>
          </div>
          <TabsList className="bg-transparent p-0 h-auto gap-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 dark:data-[state=active]:border-indigo-400 rounded-none px-4 pb-2.5 pt-1 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
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
