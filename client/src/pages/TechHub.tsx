import { useState } from "react";
import { BarChart3, Columns3, FolderOpen, TrendingUp } from "lucide-react";
import TechOverview from "./tech/TechOverview";
import TechBoard from "./tech/TechBoard";
import TechProjetosHub from "./tech/TechProjetosHub";
import TechPerformance from "./tech/TechPerformance";

type Section = "overview" | "board" | "projetos" | "performance";

const sections: { id: Section; label: string; icon: React.ComponentType<any> }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "projetos", label: "Projetos", icon: FolderOpen },
  { id: "performance", label: "Performance", icon: TrendingUp },
];

export default function TechHub() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialSection = (searchParams.get("section") as Section) || "overview";
  const [activeSection, setActiveSection] = useState<Section>(
    sections.some(s => s.id === initialSection) ? initialSection : "overview"
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-52 bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
        <div className="text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-4 px-3">
          Tech Hub
        </div>
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === s.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-900">
        {activeSection === "overview" && <TechOverview />}
        {activeSection === "board" && <TechBoard />}
        {activeSection === "projetos" && <TechProjetosHub />}
        {activeSection === "performance" && <TechPerformance />}
      </div>
    </div>
  );
}
