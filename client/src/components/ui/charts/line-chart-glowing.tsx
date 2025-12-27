"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

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
import { TrendingUp, TrendingDown } from "lucide-react";

export interface GlowingLineDataPoint {
  label: string;
  [key: string]: string | number;
}

export interface GlowingLineChartProps {
  title?: string;
  description?: string;
  data?: GlowingLineDataPoint[];
  lines?: Array<{
    dataKey: string;
    label: string;
    color?: string;
  }>;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  showGrid?: boolean;
  className?: string;
}

const defaultData: GlowingLineDataPoint[] = [
  { label: "January", desktop: 186, mobile: 87 },
  { label: "February", desktop: 305, mobile: 163 },
  { label: "March", desktop: 237, mobile: 142 },
  { label: "April", desktop: 73, mobile: 195 },
  { label: "May", desktop: 209, mobile: 118 },
  { label: "June", desktop: 214, mobile: 231 },
];

const defaultLines = [
  { dataKey: "desktop", label: "Desktop", color: "hsl(var(--chart-2))" },
  { dataKey: "mobile", label: "Mobile", color: "hsl(var(--chart-5))" },
];

export default function GlowingLineChart({
  title = "Glowing Line Chart",
  description = "January - June 2024",
  data = defaultData,
  lines = defaultLines,
  trend = { value: 5.2, direction: 'up' },
  showGrid = true,
  className,
}: GlowingLineChartProps) {
  const chartConfig = lines.reduce((acc, line, index) => {
    acc[line.dataKey] = {
      label: line.label,
      color: line.color || `hsl(var(--chart-${(index % 5) + 1}))`,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <Card className={className} data-testid="chart-line-glowing">
      <CardHeader>
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
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            {showGrid && <CartesianGrid vertical={false} />}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            {lines.map((line, index) => (
              <Line
                key={line.dataKey}
                dataKey={line.dataKey}
                type="bump"
                stroke={line.color || `hsl(var(--chart-${(index % 5) + 1}))`}
                dot={false}
                strokeWidth={2}
                filter="url(#rainbow-line-glow)"
              />
            ))}
            <defs>
              <filter
                id="rainbow-line-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
