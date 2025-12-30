"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, TrendingDown, TrendingUp, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface KpiCard {
  title: string;
  subtitle: string;
  value: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    isPositive: boolean;
  };
  comparison?: {
    value: string;
    label: string;
    isPositive?: boolean;
  };
  href?: string;
}

interface KpiCardGridProps {
  cards: KpiCard[];
  className?: string;
  columns?: 3 | 4 | 5;
}

function KpiCardItem({ card }: { card: KpiCard }) {
  const Icon = card.icon;
  
  const content = (
    <Card 
      className={cn(
        "border-0 shadow-none rounded-none h-full",
        card.href && "cursor-pointer hover:bg-muted/30 transition-colors"
      )}
      data-testid={`kpi-card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="flex flex-col h-full space-y-3 justify-between p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-base font-semibold text-foreground">{card.title}</div>
            <div className="text-xs text-muted-foreground">{card.subtitle}</div>
          </div>
          {Icon && (
            <div className="p-2 rounded-lg bg-muted/60">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1.5 justify-end">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {card.value}
            </span>
            {card.badge && (
              <Badge
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 shadow-none border-none",
                  card.badge.isPositive
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                )}
              >
                {card.badge.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {card.badge.text}
              </Badge>
            )}
          </div>
          {card.comparison && (
            <div className="text-xs">
              <span className={cn(
                "font-medium",
                card.comparison.isPositive === undefined
                  ? "text-muted-foreground"
                  : card.comparison.isPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
              )}>
                {card.comparison.value}
              </span>{" "}
              <span className="text-muted-foreground">{card.comparison.label}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (card.href) {
    return <Link href={card.href}>{content}</Link>;
  }
  return content;
}

export default function KpiCardGrid({ cards, className, columns = 4 }: KpiCardGridProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className={cn(
        "grid bg-background overflow-hidden rounded-xl border border-border",
        columns === 3 
          ? "grid-cols-1 lg:grid-cols-3" 
          : columns === 5 
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-5"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      )}>
        {cards.map((card, i) => (
          <div
            key={i}
            className={cn(
              i !== 0 && "border-t lg:border-t-0 lg:border-l border-border"
            )}
          >
            <KpiCardItem card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

export { KpiCardGrid, KpiCardItem };
export type { KpiCard, KpiCardGridProps };
