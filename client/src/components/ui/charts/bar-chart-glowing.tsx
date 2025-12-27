"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Bar, BarChart, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart-container";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export interface BarChartDataPoint {
  label: string;
  [key: string]: string | number;
}

export interface GlowingBarChartProps {
  title?: string;
  description?: string;
  data?: BarChartDataPoint[];
  bars?: Array<{
    dataKey: string;
    label: string;
    color?: string;
  }>;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  showPropertySelector?: boolean;
  className?: string;
}

const defaultData: BarChartDataPoint[] = [
  { label: "January", desktop: 342, mobile: 245, tablet: 123 },
  { label: "February", desktop: 876, mobile: 654, tablet: 234 },
  { label: "March", desktop: 512, mobile: 387, tablet: 156 },
  { label: "April", desktop: 629, mobile: 521, tablet: 267 },
  { label: "May", desktop: 458, mobile: 412, tablet: 213 },
  { label: "June", desktop: 781, mobile: 598, tablet: 321 },
  { label: "July", desktop: 394, mobile: 312, tablet: 145 },
  { label: "August", desktop: 925, mobile: 743, tablet: 150 },
  { label: "September", desktop: 647, mobile: 489, tablet: 212 },
  { label: "October", desktop: 532, mobile: 476, tablet: 187 },
  { label: "November", desktop: 803, mobile: 687, tablet: 298 },
  { label: "December", desktop: 271, mobile: 198, tablet: 123 },
];

const defaultBars = [
  { dataKey: "desktop", label: "Desktop", color: "hsl(var(--chart-1))" },
  { dataKey: "mobile", label: "Mobile", color: "hsl(var(--chart-2))" },
  { dataKey: "tablet", label: "Tablet", color: "hsl(var(--chart-3))" },
];

export default function GlowingBarChart({
  title = "Bar Chart",
  description = "January - December 2024",
  data = defaultData,
  bars = defaultBars,
  trend = { value: 5.2, direction: 'up' },
  showPropertySelector = true,
  className,
}: GlowingBarChartProps) {
  const [activeProperty, setActiveProperty] = useState<string>("all");

  const chartConfig = bars.reduce((acc, bar, index) => {
    acc[bar.dataKey] = {
      label: bar.label,
      color: bar.color || `hsl(var(--chart-${(index % 5) + 1}))`,
    };
    return acc;
  }, {} as ChartConfig);

  const visibleBars = activeProperty === "all" 
    ? bars 
    : bars.filter(bar => bar.dataKey === activeProperty);

  return (
    <Card className={className} data-testid="chart-bar-glowing">
      <CardHeader>
        <div className="flex flex-row justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {title}
            {trend && (
              <Badge
                variant="outline"
                className={`${trend.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-destructive bg-destructive/10'} border-none`}
              >
                {trend.direction === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{trend.value}%</span>
              </Badge>
            )}
          </CardTitle>
          {showPropertySelector && bars.length > 1 && (
            <Select
              value={activeProperty}
              onValueChange={setActiveProperty}
            >
              <SelectTrigger className="text-xs h-7 px-2 w-auto" data-testid="select-bar-property">
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectLabel>Properties</SelectLabel>
                  <SelectItem className="text-xs" value="all">
                    All
                  </SelectItem>
                  {bars.map(bar => (
                    <SelectItem key={bar.dataKey} className="text-xs" value={bar.dataKey}>
                      {bar.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={data}>
            <defs>
              <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            {visibleBars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                fill={bar.color || `hsl(var(--chart-${(index % 5) + 1}))`}
                radius={4}
                filter="url(#glow-effect)"
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
