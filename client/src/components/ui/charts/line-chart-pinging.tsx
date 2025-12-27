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

export interface LineChartDataPoint {
  label: string;
  value: number;
}

export interface PingingDotChartProps {
  title?: string;
  description?: string;
  data?: LineChartDataPoint[];
  dataKey?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color?: string;
  showGrid?: boolean;
  className?: string;
}

const defaultData: LineChartDataPoint[] = [
  { label: "January", value: 186 },
  { label: "February", value: 305 },
  { label: "March", value: 237 },
  { label: "April", value: 73 },
  { label: "May", value: 209 },
  { label: "June", value: 214 },
];

const CustomizedDot = (props: React.SVGProps<SVGCircleElement>) => {
  const { cx, cy, stroke } = props;

  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={3}
        stroke={stroke}
        fill="none"
        strokeWidth="1"
        opacity="0.8"
      >
        <animate
          attributeName="r"
          values="3;10"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;0"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};

export default function PingingDotChart({
  title = "Pinging Dot Chart",
  description = "January - June 2024",
  data = defaultData,
  dataKey = "value",
  trend = { value: 5.2, direction: 'up' },
  color = "hsl(var(--chart-2))",
  showGrid = true,
  className,
}: PingingDotChartProps) {
  const chartConfig = {
    [dataKey]: {
      label: dataKey.charAt(0).toUpperCase() + dataKey.slice(1),
      color: color,
    },
  } satisfies ChartConfig;

  return (
    <Card className={className} data-testid="chart-line-pinging">
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
            <Line
              dataKey={dataKey}
              type="linear"
              stroke={color}
              strokeDasharray="4 4"
              dot={<CustomizedDot />}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
