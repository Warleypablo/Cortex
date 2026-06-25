import { Card, CardContent } from "@/components/ui/card";

export const TechKpiCard = ({ title, value, subtitle, icon: Icon, gradient, shadowColor, size = "normal" }: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  gradient: string;
  shadowColor: string;
  size?: "normal" | "large";
}) => (
  <Card className={`relative overflow-hidden border-border/50 hover:border-border transition-all hover:shadow-lg ${size === "large" ? "col-span-2" : ""}`}>
    <CardContent className={size === "large" ? "p-5" : "p-4"}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-semibold text-muted-foreground uppercase tracking-wider ${size === "large" ? "text-xs" : "text-[10px]"}`}>
          {title}
        </span>
        <div className={`rounded-md ${gradient} ${size === "large" ? "p-2" : "p-1.5"}`}>
          <Icon className={`text-white ${size === "large" ? "h-4 w-4" : "h-3 w-3"}`} />
        </div>
      </div>
      <div className={`font-bold text-foreground tracking-tight ${size === "large" ? "text-2xl" : "text-xl"}`}>{value}</div>
      <p className={`text-muted-foreground mt-0.5 ${size === "large" ? "text-xs" : "text-[10px]"}`}>{subtitle}</p>
    </CardContent>
  </Card>
);
