import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const TechChartCard = ({ title, subtitle, icon: Icon, iconBg, meta, footer, children }: {
  title: string;
  subtitle: string;
  icon: any;
  iconBg: string;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card className="border-border/50 bg-gradient-to-b from-white to-slate-50/80 dark:from-zinc-900/70 dark:to-zinc-950/40 shadow-sm hover:shadow-md transition-all">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${iconBg} shadow-sm`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">{subtitle}</CardDescription>
          </div>
        </div>
        {meta && (
          <div className="hidden md:flex items-center gap-2">
            {meta}
          </div>
        )}
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="rounded-lg border border-border/40 bg-white/80 dark:bg-zinc-900/50 p-3">
        {children}
      </div>
      {footer && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          {footer}
        </div>
      )}
    </CardContent>
  </Card>
);
