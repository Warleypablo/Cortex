'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  StackedNormalizedAreaChart,
  LinearXAxis,
  LinearXAxisTickSeries,
  LinearXAxisTickLabel,
  LinearYAxis,
  LinearYAxisTickSeries,
  StackedNormalizedAreaSeries,
  Line,
  Area,
  Gradient,
  GradientStop,
  GridlineSeries,
  Gridline,
} from 'reaviz';

export interface AreaDataPoint {
  key: Date;
  data: number;
}

export interface AreaSeriesData {
  key: string;
  data: AreaDataPoint[];
}

export interface AreaMetricInfo {
  id: string;
  label: string;
  value: string;
  trend: 'up' | 'down';
}

export interface StackedAreaReportProps {
  title?: string;
  data?: AreaSeriesData[];
  metrics?: AreaMetricInfo[];
  colorScheme?: string[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

const generateDefaultData = (): AreaSeriesData[] => {
  const now = new Date();
  const generateDate = (offsetDays: number): Date => {
    const date = new Date(now);
    date.setDate(now.getDate() - offsetDays);
    return date;
  };

  return [
    {
      key: 'Series A',
      data: Array.from({ length: 7 }, (_, i) => ({ 
        key: generateDate(6 - i), 
        data: Math.floor(Math.random() * 20) + 10 
      })),
    },
    {
      key: 'Series B',
      data: Array.from({ length: 7 }, (_, i) => ({ 
        key: generateDate(6 - i), 
        data: Math.floor(Math.random() * 25) + 15 
      })),
    },
    {
      key: 'Series C',
      data: Array.from({ length: 7 }, (_, i) => ({ 
        key: generateDate(6 - i), 
        data: Math.floor(Math.random() * 15) + 5 
      })),
    },
  ];
};

const defaultMetrics: AreaMetricInfo[] = [
  { id: 'mttd', label: 'Mean Time to Respond', value: '6 Hours', trend: 'up' },
  { id: 'irt', label: 'Incident Response Time', value: '4 Hours', trend: 'up' },
  { id: 'ier', label: 'Incident Escalation Rate', value: '10%', trend: 'down' },
];

const defaultColorScheme = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
];

const StackedAreaReport = ({
  title = "Area Report",
  data,
  metrics = defaultMetrics,
  colorScheme = defaultColorScheme,
  height = 200,
  showLegend = true,
  className,
}: StackedAreaReportProps) => {
  const chartData = useMemo(() => {
    const rawData = data || generateDefaultData();
    return rawData.map(series => ({
      ...series,
      data: series.data.map(item => ({
        ...item,
        data: (typeof item.data !== 'number' || isNaN(item.data)) ? 0 : item.data,
      })),
    }));
  }, [data]);

  const legendItems = chartData.map((series, index) => ({
    name: series.key,
    color: colorScheme[index % colorScheme.length],
  }));

  return (
    <div className={`flex flex-col pt-4 pb-4 bg-card rounded-xl border w-full max-w-md min-h-[500px] overflow-hidden transition-colors duration-300 ${className}`} data-testid="chart-stacked-area">
      <h3 className="text-xl text-left p-6 pb-4 font-bold text-foreground">{title}</h3>
      
      {showLegend && (
        <div className="flex justify-between w-full px-6 mb-4">
          {legendItems.map((item) => (
            <div key={item.name} className="flex gap-2 items-center">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground text-xs">{item.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-2" style={{ height }}>
        <StackedNormalizedAreaChart
          height={height}
          id="stacked-normalized-details"
          data={chartData}
          xAxis={
            <LinearXAxis
              type="time"
              tickSeries={
                <LinearXAxisTickSeries
                  label={
                    <LinearXAxisTickLabel
                      format={v => new Date(v).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                      fill="hsl(var(--muted-foreground))"
                    />
                  }
                  tickSize={10}
                />
              }
            />
          }
          yAxis={
            <LinearYAxis
              axisLine={null}
              tickSeries={<LinearYAxisTickSeries line={null} label={null} tickSize={10} />}
            />
          }
          series={
            <StackedNormalizedAreaSeries
              line={<Line strokeWidth={3} />}
              area={
                <Area
                  gradient={
                    <Gradient
                      stops={[
                        <GradientStop key={1} stopOpacity={0} />,
                        <GradientStop key={2} offset="80%" stopOpacity={0.2} />,
                      ]}
                    />
                  }
                />
              }
              colorScheme={colorScheme}
            />
          }
          gridlines={<GridlineSeries line={<Gridline strokeColor="hsl(var(--border))" />} />}
        />
      </div>

      <div className="flex flex-col px-6 pt-6 font-mono divide-y divide-border">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex w-full py-3 items-center gap-2"
          >
            <div className="flex flex-row gap-2 items-center text-sm w-1/2 text-muted-foreground">
              <span className="truncate" title={metric.label}>{metric.label}</span>
            </div>
            <div className="flex gap-2 w-1/2 justify-end items-center">
              <span className="font-semibold text-lg text-foreground">{metric.value}</span>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${metric.trend === 'up' ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-500'}`}>
                {metric.trend === 'up' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 21" fill="none">
                    <path d="M5.50134 9.11119L10.0013 4.66675M10.0013 4.66675L14.5013 9.11119M10.0013 4.66675L10.0013 16.3334" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 21" fill="none">
                    <path d="M14.4987 11.8888L9.99866 16.3333M9.99866 16.3333L5.49866 11.8888M9.99866 16.3333V4.66658" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                  </svg>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default StackedAreaReport;
