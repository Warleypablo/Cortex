"use client";

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, TrendingDown, TrendingUp, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCard {
  title: string;
  subtitle: string;
  value: string;
  valueColor?: string;
  badge: {
    color: string;
    icon: LucideIcon;
    iconColor: string;
    text: string;
  };
  comparison: {
    value: string;
    label: string;
    color: string;
  };
}

interface StatisticsCard7Props {
  cards?: StatCard[];
  className?: string;
}

const defaultCards: StatCard[] = [
  {
    title: 'Total Sales & Cost',
    subtitle: 'Last 60 days',
    value: '$956.82k',
    valueColor: 'text-green-600',
    badge: {
      color: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
      icon: ArrowUpRight,
      iconColor: 'text-green-500',
      text: '+5.4%',
    },
    comparison: {
      value: '+8.20k',
      label: 'vs prev. 60 days',
      color: 'text-green-600',
    },
  },
  {
    title: 'New Customers',
    subtitle: 'This quarter',
    value: '1,245',
    valueColor: 'text-blue-600',
    badge: {
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
      icon: ArrowUpRight,
      iconColor: 'text-blue-500',
      text: '+3.2%',
    },
    comparison: {
      value: '+39',
      label: 'vs last quarter',
      color: 'text-blue-600',
    },
  },
  {
    title: 'Churn Rate',
    subtitle: 'Last 30 days',
    value: '2.8%',
    valueColor: 'text-red-500',
    badge: {
      color: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
      icon: TrendingDown,
      iconColor: 'text-red-500',
      text: '-1.1%',
    },
    comparison: {
      value: '-0.3%',
      label: 'vs prev. 30 days',
      color: 'text-red-500',
    },
  },
];

export default function StatisticsCard7({ cards = defaultCards, className }: StatisticsCard7Props) {
  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 bg-background overflow-hidden rounded-xl border border-border">
        {cards.map((card, i) => (
          <Card
            key={i}
            className={cn(
              "border-0 shadow-none rounded-none",
              i !== 0 && "border-t lg:border-t-0 lg:border-l border-border"
            )}
            data-testid={`stat-card-${i}`}
          >
            <CardContent className="flex flex-col h-full space-y-4 justify-between p-5">
              <div className="space-y-0.5">
                <div className="text-lg font-semibold text-foreground">{card.title}</div>
                <div className="text-sm text-muted-foreground">{card.subtitle}</div>
              </div>

              <div className="flex-1 flex flex-col gap-1.5 justify-between grow">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold tracking-tight">{card.value}</span>
                  <Badge
                    className={cn(
                      card.badge.color,
                      "px-2 py-1 rounded-full text-sm font-medium flex items-center gap-1 shadow-none border-none"
                    )}
                  >
                    <card.badge.icon className={cn("w-3 h-3", card.badge.iconColor)} />
                    {card.badge.text}
                  </Badge>
                </div>
                <div className="text-sm">
                  <span className={cn("font-medium", card.comparison.color)}>
                    {card.comparison.value}{' '}
                    <span className="text-muted-foreground font-normal">{card.comparison.label}</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export { StatisticsCard7 };
export type { StatCard, StatisticsCard7Props };
