import { TrendingUp } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SectionCover } from "./SlideComponents";

export default function SlideCapaComercial() {
  return (
    <SlideLayout section="comercial" showLogo={false} padding="48px" className="items-center justify-center">
      <SectionCover
        icon={TrendingUp}
        title="Comercial"
        subtitle="Resultados e Performance"
        section="comercial"
      />
    </SlideLayout>
  );
}
