"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDown, ArrowUp, MoreHorizontal, Pin, Settings, Share2, Trash, TriangleAlert, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatItem {
  title: string;
  value: number;
  delta: number;
  lastMonth: number;
  positive: boolean;
  prefix?: string;
  suffix?: string;
  format?: (v: number) => string;
  lastFormat?: (v: number) => string;
}

interface StatisticsCard1Props {
  stats?: StatItem[];
  className?: string;
  showMenu?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

const defaultStats: StatItem[] = [
  {
    title: "All Orders",
    value: 122380,
    delta: 15.1,
    lastMonth: 105922,
    positive: true,
    prefix: "",
    suffix: "",
  },
  {
    title: "Order Created",
    value: 1902380,
    delta: -2.0,
    lastMonth: 2002098,
    positive: false,
    prefix: "",
    suffix: "",
  },
  {
    title: "Organic Sales",
    value: 98100000,
    delta: 0.4,
    lastMonth: 97800000,
    positive: true,
    format: (v: number) => `$${(v / 1_000_000).toFixed(1)}M`,
    lastFormat: (v: number) => `$${(v / 1_000_000).toFixed(1)}M`,
  },
  {
    title: "Active Users",
    value: 48210,
    delta: 3.7,
    lastMonth: 46480,
    positive: true,
    prefix: "",
    suffix: "",
  },
];

export default function StatisticsCard1({ 
  stats = defaultStats, 
  className,
  showMenu = true,
}: StatisticsCard1Props) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {stats.map((stat, index) => (
        <Card key={index} data-testid={`stat-card-1-${index}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {stat.title}
            </CardTitle>
            {showMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <TriangleAlert className="h-4 w-4 mr-2" />
                    Add Alert
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Pin className="h-4 w-4 mr-2" />
                    Pin to Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Trash className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-medium text-foreground tracking-tight">
                {stat.format
                  ? stat.format(stat.value)
                  : (stat.prefix || "") + formatNumber(stat.value) + (stat.suffix || "")}
              </span>
              <Badge
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium border-none",
                  stat.positive
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                )}
              >
                {stat.delta > 0 ? <ArrowUp className="h-3 w-3 mr-0.5" /> : <ArrowDown className="h-3 w-3 mr-0.5" />}
                {Math.abs(stat.delta)}%
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2.5">
              Vs last month:{" "}
              <span className="font-medium text-foreground">
                {stat.lastFormat
                  ? stat.lastFormat(stat.lastMonth)
                  : (stat.prefix || "") + formatNumber(stat.lastMonth) + (stat.suffix || "")}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export { StatisticsCard1 };
export type { StatisticsCard1Props, StatItem };
