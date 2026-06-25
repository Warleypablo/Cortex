import React from "react";

export const SectionBlock = ({
  title,
  subtitle,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  icon: any;
  accent: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm space-y-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${accent} shadow-sm`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="text-sm font-semibold text-foreground">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);
