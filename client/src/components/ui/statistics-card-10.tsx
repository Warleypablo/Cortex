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
import { BarChart2, MoreHorizontal, LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailItem {
  label: string;
  value: string | number;
}

interface StatisticsCard10Props {
  title?: string;
  icon?: LucideIcon;
  value?: string;
  currency?: string;
  delta?: number;
  deltaLabel?: string;
  details?: DetailItem[];
  className?: string;
  showMenu?: boolean;
}

export default function StatisticsCard10({
  title = "Total Revenue",
  icon: Icon = BarChart2,
  value = "$ 1,120,500",
  currency = "USD",
  delta = -12.7,
  deltaLabel = "decreased from last quarter",
  details = [
    { label: "Avg. Subscription Value:", value: "$320" },
    { label: "Enterprise Clients:", value: "42" },
  ],
  className,
  showMenu = true,
}: StatisticsCard10Props) {
  const isPositive = delta >= 0;

  return (
    <Card className={cn("w-full max-w-md", className)} data-testid="stat-card-10">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
        <CardTitle className="inline-flex items-center gap-2">
          <Icon className="h-8 w-8 text-primary" />
          {title}
        </CardTitle>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Export Data</DropdownMenuItem>
              <DropdownMenuItem>Pin to Dashboard</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="flex flex-col justify-between gap-3.5">
        <div className="space-y-3.5">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="text-3xl font-bold text-foreground tracking-tight">{value}</span>
            <span className="text-xs text-muted-foreground font-medium leading-none">{currency}</span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Badge
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium border-none flex items-center gap-1",
                isPositive
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
              )}
            >
              {isPositive ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {Math.abs(delta)}%
            </Badge>
            <span className="text-sm text-muted-foreground">{deltaLabel}</span>
          </div>
        </div>

        <div className="space-y-1">
          {details.map((detail, index) => (
            <div
              key={index}
              className="p-2.5 bg-muted/60 flex items-center justify-between rounded-lg"
            >
              <span className="text-sm text-muted-foreground">{detail.label}</span>
              <span className="text-base font-semibold text-foreground">{detail.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export { StatisticsCard10 };
export type { StatisticsCard10Props, DetailItem };
