"use client";

import { LabelList, Pie, PieChart } from "recharts";

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

export interface PieChartDataItem {
  name: string;
  value: number;
  fill?: string;
}

export interface RoundedPieChartProps {
  title?: string;
  description?: string;
  data?: PieChartDataItem[];
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  innerRadius?: number;
  cornerRadius?: number;
  paddingAngle?: number;
  showLabels?: boolean;
  className?: string;
}

const defaultData: PieChartDataItem[] = [
  { name: "chrome", value: 275, fill: "hsl(var(--chart-1))" },
  { name: "safari", value: 200, fill: "hsl(var(--chart-2))" },
  { name: "firefox", value: 187, fill: "hsl(var(--chart-3))" },
  { name: "edge", value: 173, fill: "hsl(var(--chart-4))" },
  { name: "other", value: 90, fill: "hsl(var(--chart-5))" },
];

export default function RoundedPieChart({
  title = "Pie Chart",
  description = "January - June 2024",
  data = defaultData,
  trend = { value: 5.2, direction: 'up' },
  innerRadius = 30,
  cornerRadius = 8,
  paddingAngle = 4,
  showLabels = true,
  className,
}: RoundedPieChartProps) {
  const chartConfig = data.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name.charAt(0).toUpperCase() + item.name.slice(1),
      color: item.fill || `hsl(var(--chart-${(index % 5) + 1}))`,
    };
    return acc;
  }, { value: { label: "Value" } } as ChartConfig);

  const chartData = data.map((item, index) => ({
    ...item,
    fill: item.fill || `hsl(var(--chart-${(index % 5) + 1}))`,
  }));

  return (
    <Card className={`flex flex-col ${className}`} data-testid="chart-pie-rounded">
      <CardHeader className="items-center pb-0">
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
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="value" hideLabel />}
            />
            <Pie
              data={chartData}
              innerRadius={innerRadius}
              dataKey="value"
              nameKey="name"
              cornerRadius={cornerRadius}
              paddingAngle={paddingAngle}
            >
              {showLabels && (
                <LabelList
                  dataKey="value"
                  stroke="none"
                  fontSize={12}
                  fontWeight={500}
                  fill="currentColor"
                  formatter={(value: number) => value.toString()}
                />
              )}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
