"use client";

import { TrendingUp } from "lucide-react";
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

const chartData = [
  { month: "January", desktop: 342, mobile: 245, tablet: 123 },
  { month: "February", desktop: 876, mobile: 654, tablet: 234 },
  { month: "March", desktop: 512, mobile: 387, tablet: 156 },
  { month: "April", desktop: 629, mobile: 521, tablet: 267 },
  { month: "May", desktop: 458, mobile: 412, tablet: 213 },
  { month: "June", desktop: 781, mobile: 598, tablet: 321 },
  { month: "July", desktop: 394, mobile: 312, tablet: 145 },
  { month: "August", desktop: 925, mobile: 743, tablet: 150 },
  { month: "September", desktop: 647, mobile: 489, tablet: 212 },
  { month: "October", desktop: 532, mobile: 476, tablet: 187 },
  { month: "November", desktop: 803, mobile: 687, tablet: 298 },
  { month: "December", desktop: 271, mobile: 198, tablet: 123 },
];

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
  mobile: {
    label: "Mobile",
    color: "hsl(var(--chart-2))",
  },
  tablet: {
    label: "Tablet",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

type ActiveProperty = keyof typeof chartConfig | "all";

export default function GlowingBarChart() {
  const [activeProperty, setActiveProperty] =
    useState<ActiveProperty>("all");

  return (
    <Card data-testid="chart-bar-glowing">
      <CardHeader>
        <div className="flex flex-row justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            Bar Chart
            <Badge
              variant="outline"
              className="text-green-500 bg-green-500/10 border-none"
            >
              <TrendingUp className="h-4 w-4" />
              <span>5.2%</span>
            </Badge>
          </CardTitle>
          <Select
            value={activeProperty}
            onValueChange={(value: ActiveProperty) => {
              setActiveProperty(value);
            }}
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
                <SelectItem className="text-xs" value="desktop">
                  Desktop
                </SelectItem>
                <SelectItem className="text-xs" value="mobile">
                  Mobile
                </SelectItem>
                <SelectItem className="text-xs" value="tablet">
                  Tablet
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>January - December 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <defs>
              <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            {(activeProperty === "all" || activeProperty === "desktop") && (
              <Bar
                dataKey="desktop"
                fill="var(--color-desktop)"
                radius={4}
                filter="url(#glow-effect)"
              />
            )}
            {(activeProperty === "all" || activeProperty === "mobile") && (
              <Bar
                dataKey="mobile"
                fill="var(--color-mobile)"
                radius={4}
                filter="url(#glow-effect)"
              />
            )}
            {(activeProperty === "all" || activeProperty === "tablet") && (
              <Bar
                dataKey="tablet"
                fill="var(--color-tablet)"
                radius={4}
                filter="url(#glow-effect)"
              />
            )}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
