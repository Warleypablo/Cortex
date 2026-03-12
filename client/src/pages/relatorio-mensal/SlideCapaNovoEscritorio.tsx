import { Building2 } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SectionCover } from "./SlideComponents";

export default function SlideCapaNovoEscritorio() {
  return (
    <SlideLayout section="closing" showLogo={false} padding="48px" className="items-center justify-center">
      <SectionCover
        icon={Building2}
        title="Novo Escritório"
        subtitle="Nova Sede Gazeta"
        section="closing"
      />
    </SlideLayout>
  );
}
