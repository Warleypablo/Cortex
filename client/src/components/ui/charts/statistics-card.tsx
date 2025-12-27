"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarChart2, MoreHorizontal, TrendingDown, TrendingUp } from 'lucide-react';

interface StatisticCardProps {
  title?: string;
  value?: string;
  currency?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label: string;
  };
  details?: Array<{
    label: string;
    value: string;
  }>;
  className?: string;
}

export default function StatisticCard({
  title = "Total Revenue",
  value = "1,120,500",
  currency = "USD",
  trend = {
    value: 12.7,
    direction: 'down',
    label: 'decreased from last quarter'
  },
  details = [
    { label: 'Avg. Subscription Value:', value: '$320' },
    { label: 'Enterprise Clients:', value: '42' }
  ],
  className
}: StatisticCardProps) {
  return (
    <Card className={`w-full max-w-md ${className}`} data-testid="chart-statistics-card">
      <CardHeader className="border-0 py-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <BarChart2 className="size-6 text-primary" />
            {title}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-card-menu">
                <MoreHorizontal className="size-4" />
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
        </div>
      </CardHeader>
      <CardContent className="flex flex-col justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">$ {value}</span>
            <span className="text-xs text-muted-foreground font-medium leading-none">{currency}</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`${trend.direction === 'up' ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'} border-none`}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {trend.direction === 'down' ? '-' : '+'}{trend.value}%
            </Badge>
            <span className="text-sm text-muted-foreground">{trend.label}</span>
          </div>
        </div>

        <div className="space-y-1">
          {details.map((detail, index) => (
            <div 
              key={index}
              className="p-2 bg-muted/60 flex items-center justify-between rounded-md"
            >
              <span className="text-sm text-muted-foreground">{detail.label}</span>
              <span className="text-sm font-semibold text-foreground">{detail.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
