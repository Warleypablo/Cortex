import { ShoppingCart } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SectionCover } from "./SlideComponents";

export default function SlideCapaCommerce() {
  return (
    <SlideLayout section="commerce" showLogo={false} padding="48px" className="items-center justify-center">
      <SectionCover
        icon={ShoppingCart}
        title="Commerce"
        subtitle="E-Commerce e Performance Digital"
        section="commerce"
      />
    </SlideLayout>
  );
}
