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
import { BarChart2, MoreHorizontal, TrendingDown, TrendingUp, LucideIcon } from 'lucide-react';

export interface StatisticDetail {
  label: string;
  value: string;
}

export interface StatisticCardProps {
  title?: string;
  value?: string | number;
  currency?: string;
  currencySymbol?: string;
  showCurrencySymbol?: boolean;
  icon?: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label: string;
  };
  details?: StatisticDetail[];
  showMenu?: boolean;
  onSettingsClick?: () => void;
  onExportClick?: () => void;
  onPinClick?: () => void;
  onRemoveClick?: () => void;
  className?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  BRL: 'R$',
  JPY: '¥',
  CNY: '¥',
};

export default function StatisticCard({
  title = "Total Revenue",
  value = "1,120,500",
  currency = "USD",
  currencySymbol,
  showCurrencySymbol = true,
  icon: Icon = BarChart2,
  trend = {
    value: 12.7,
    direction: 'down',
    label: 'decreased from last quarter'
  },
  details = [
    { label: 'Avg. Subscription Value:', value: '$320' },
    { label: 'Enterprise Clients:', value: '42' }
  ],
  showMenu = true,
  onSettingsClick,
  onExportClick,
  onPinClick,
  onRemoveClick,
  className
}: StatisticCardProps) {
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString() 
    : value;

  const symbol = currencySymbol ?? CURRENCY_SYMBOLS[currency] ?? '';

  return (
    <Card className={`w-full max-w-md ${className}`} data-testid="chart-statistics-card">
      <CardHeader className="border-0 py-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Icon className="size-6 text-primary" />
            {title}
          </CardTitle>
          {showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-card-menu">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem onClick={onSettingsClick}>Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={onExportClick}>Export Data</DropdownMenuItem>
                <DropdownMenuItem onClick={onPinClick}>Pin to Dashboard</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={onRemoveClick}>Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {showCurrencySymbol && symbol}{formattedValue}
            </span>
            {currency && (
              <span className="text-xs text-muted-foreground font-medium leading-none">{currency}</span>
            )}
          </div>

          {trend && (
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`${trend.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-destructive bg-destructive/10'} border-none`}
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
          )}
        </div>

        {details && details.length > 0 && (
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
        )}
      </CardContent>
    </Card>
  );
}
