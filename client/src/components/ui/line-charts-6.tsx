"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/charts/chart-container";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

interface MetricDef {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  format?: (val: number) => string;
  isNegative?: boolean;
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

interface LineCharts6Props {
  data?: ChartDataPoint[];
  metrics?: MetricDef[];
  title?: string;
  description?: string;
  className?: string;
}

const defaultData: ChartDataPoint[] = [
  { date: "2024-04-01", orders: 222, response: 150, revenue: 8.2, customers: 420 },
  { date: "2024-04-02", orders: 97, response: 180, revenue: 4.5, customers: 290 },
  { date: "2024-04-03", orders: 167, response: 120, revenue: 6.8, customers: 380 },
  { date: "2024-04-04", orders: 242, response: 260, revenue: 9.1, customers: 520 },
  { date: "2024-04-05", orders: 301, response: 340, revenue: 11.2, customers: 620 },
  { date: "2024-04-06", orders: 59, response: 110, revenue: 2.8, customers: 180 },
  { date: "2024-04-07", orders: 261, response: 190, revenue: 9.8, customers: 510 },
  { date: "2024-04-08", orders: 327, response: 350, revenue: 12.1, customers: 650 },
  { date: "2024-04-09", orders: 89, response: 150, revenue: 3.8, customers: 220 },
  { date: "2024-04-10", orders: 195, response: 165, revenue: 7.2, customers: 390 },
  { date: "2024-04-11", orders: 224, response: 170, revenue: 8.5, customers: 450 },
  { date: "2024-04-12", orders: 387, response: 290, revenue: 13.8, customers: 710 },
  { date: "2024-04-13", orders: 215, response: 250, revenue: 8.2, customers: 430 },
  { date: "2024-04-14", orders: 75, response: 130, revenue: 3.1, customers: 190 },
  { date: "2024-04-15", orders: 122, response: 180, revenue: 5.1, customers: 300 },
  { date: "2024-04-16", orders: 197, response: 160, revenue: 7.5, customers: 390 },
  { date: "2024-04-17", orders: 473, response: 380, revenue: 17.2, customers: 890 },
  { date: "2024-04-18", orders: 338, response: 400, revenue: 12.9, customers: 670 },
];

const defaultMetrics: MetricDef[] = [
  {
    key: "orders",
    label: "Orders",
    value: 2865,
    previousValue: 2420,
    format: (val: number) => val.toLocaleString(),
  },
  {
    key: "response",
    label: "Response Time",
    value: 135,
    previousValue: 118,
    format: (val: number) => `${val}ms`,
    isNegative: true,
  },
  {
    key: "revenue",
    label: "Revenue",
    value: 8.67,
    previousValue: 7.54,
    format: (val: number) => `$${val.toFixed(2)}k`,
  },
  {
    key: "customers",
    label: "Active Users",
    value: 1425,
    previousValue: 1240,
    format: (val: number) => val.toLocaleString(),
  },
];

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function LineCharts6({
  data = defaultData,
  metrics = defaultMetrics,
  title = "Platform Metrics",
  description = "E-commerce performance overview",
  className,
}: LineCharts6Props) {
  const [activeMetric, setActiveMetric] = useState(metrics[0].key);

  const activeConfig = metrics.find((m) => m.key === activeMetric) || metrics[0];
  const activeIndex = metrics.findIndex((m) => m.key === activeMetric);

  const chartConfig = metrics.reduce((acc, metric, index) => {
    acc[metric.key] = {
      label: metric.label,
      color: chartColors[index % chartColors.length],
    };
    return acc;
  }, {} as ChartConfig);

  const calculateDelta = (current: number, previous: number, isNegative?: boolean) => {
    const delta = ((current - previous) / previous) * 100;
    const isPositive = isNegative ? delta < 0 : delta > 0;
    return { value: Math.abs(delta).toFixed(1), isPositive };
  };

  return (
    <Card className={cn("w-full", className)} data-testid="line-charts-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {metrics.map((metric, index) => {
            const delta = calculateDelta(metric.value, metric.previousValue, metric.isNegative);
            const isActive = activeMetric === metric.key;

            return (
              <button
                key={metric.key}
                onClick={() => setActiveMetric(metric.key)}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
                data-testid={`metric-selector-${metric.key}`}
              >
                <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold">
                    {metric.format ? metric.format(metric.value) : metric.value}
                  </span>
                  <Badge
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full border-none",
                      delta.isPositive
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                    )}
                  >
                    {delta.isPositive ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {delta.value}%
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        <ChartContainer config={chartConfig} className="h-[250px]">
          <LineChart data={data} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", { day: "2-digit", month: "short" })
              }
            />
            <YAxis hide />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Line
              type="monotone"
              dataKey={activeMetric}
              stroke={chartColors[activeIndex % chartColors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export { LineCharts6 };
export type { LineCharts6Props, MetricDef, ChartDataPoint };
