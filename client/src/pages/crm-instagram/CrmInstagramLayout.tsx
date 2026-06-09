import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Pipeline from "./Pipeline";
import Qualificacao from "./Qualificacao";
import SocialMedia from "./SocialMedia";
import Documentacao from "./Documentacao";

export default function CrmInstagramLayout() {
  usePageTitle("CRM Instagram");
  useSetPageInfo("CRM Instagram", "Garimpo de engajamento → social selling");

  return (
    <div className="p-4 md:p-6">
      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="qualificacao">Qualificação</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <Pipeline />
        </TabsContent>
        <TabsContent value="qualificacao" className="mt-4">
          <Qualificacao />
        </TabsContent>
        <TabsContent value="social" className="mt-4">
          <SocialMedia />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <Documentacao />
        </TabsContent>
      </Tabs>
    </div>
  );
}
