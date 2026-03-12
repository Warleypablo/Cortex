import { Monitor } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SectionCover } from "./SlideComponents";

export default function SlideCapaTech() {
  return (
    <SlideLayout section="tech" showLogo={false} padding="48px" className="items-center justify-center">
      <SectionCover
        icon={Monitor}
        title="Tech"
        subtitle="Desenvolvimento e Projetos"
        section="tech"
      />
    </SlideLayout>
  );
}
