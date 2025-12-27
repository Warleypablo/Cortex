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

export interface HatchedBarDataPoint {
  label: string;
  value: number;
}

export interface HatchedBarChartProps {
  title?: string;
  description?: string;
  data?: HatchedBarDataPoint[];
  dataKey?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color?: string;
  showBackground?: boolean;
  className?: string;
}

const defaultData: HatchedBarDataPoint[] = [
  { label: "January", value: 342 },
  { label: "February", value: 876 },
  { label: "March", value: 512 },
  { label: "April", value: 629 },
  { label: "May", value: 458 },
  { label: "June", value: 781 },
  { label: "July", value: 394 },
  { label: "August", value: 925 },
  { label: "September", value: 647 },
  { label: "October", value: 532 },
  { label: "November", value: 803 },
  { label: "December", value: 271 },
];

const DottedBackgroundPattern = () => (
  <pattern
    id="default-pattern-dots"
    x="0"
    y="0"
    width="4"
    height="4"
    patternUnits="userSpaceOnUse"
  >
    <circle
      cx="1"
      cy="1"
      r="0.5"
      fill="currentColor"
      className="text-muted-foreground/20"
    />
  </pattern>
);

const CustomHatchedBar = (
  props: React.SVGProps<SVGRectElement> & { dataKey?: string; barColor?: string }
) => {
  const { fill, x, y, width, height, dataKey, barColor } = props;
  const patternId = `hatched-bar-pattern-${dataKey || 'default'}`;
  const useFill = barColor || fill;

  return (
    <>
      <rect
        rx={4}
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="none"
        fill={`url(#${patternId})`}
      />
      <defs>
        <pattern
          key={patternId}
          id={patternId}
          x="0"
          y="0"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect x="0" y="0" width="2" height="5" fill={useFill} />
        </pattern>
      </defs>
    </>
  );
};

export default function HatchedBarChart({
  title = "Hatched Bar Chart",
  description = "January - December 2025",
  data = defaultData,
  dataKey = "value",
  trend = { value: 5.2, direction: 'up' },
  color = "hsl(var(--chart-1))",
  showBackground = true,
  className,
}: HatchedBarChartProps) {
  const chartConfig = {
    [dataKey]: {
      label: dataKey.charAt(0).toUpperCase() + dataKey.slice(1),
      color: color,
    },
  } satisfies ChartConfig;

  return (
    <Card className={className} data-testid="chart-bar-hatched">
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
          <BarChart accessibilityLayer data={data}>
            {showBackground && (
              <rect
                x="0"
                y="0"
                width="100%"
                height="85%"
                fill="url(#default-pattern-dots)"
              />
            )}
            <defs>
              <DottedBackgroundPattern />
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
            <Bar
              dataKey={dataKey}
              fill={color}
              shape={(props: any) => <CustomHatchedBar {...props} barColor={color} />}
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
