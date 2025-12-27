'use client';

import { useMemo } from 'react';
import {
  BarChart,
  LinearYAxis,
  LinearYAxisTickSeries,
  LinearYAxisTickLabel,
  LinearXAxis,
  LinearXAxisTickSeries,
  BarSeries,
  Bar,
  GridlineSeries,
  Gridline,
} from 'reaviz';
import { motion } from 'framer-motion';

export interface BarDataItem {
  key: string;
  data: number;
}

export interface MetricItem {
  id: string;
  label: string;
  value: string;
  trend: 'up' | 'down';
}

export interface SummaryMetric {
  label: string;
  count: number;
  percentage: number;
  comparisonText: string;
  trend: 'up' | 'down';
}

export interface DetailedIncidentReportCardProps {
  title?: string;
  data?: BarDataItem[];
  metrics?: MetricItem[];
  summaryLeft?: SummaryMetric;
  summaryRight?: SummaryMetric;
  colorScheme?: string[];
  height?: number;
  className?: string;
}

const defaultData: BarDataItem[] = [
  { key: 'Brute Force', data: 100 },
  { key: 'Web Attack', data: 80 },
  { key: 'Malware', data: 120 },
  { key: 'Phishing', data: 90 },
];

const defaultMetrics: MetricItem[] = [
  { id: 'mttRespond', label: 'Mean Time to Respond', value: '6 Hours', trend: 'up' },
  { id: 'incidentResponseTime', label: 'Incident Response Time', value: '4 Hours', trend: 'up' },
  { id: 'incidentEscalationRate', label: 'Incident Escalation Rate', value: '10%', trend: 'down' },
];

const defaultSummaryLeft: SummaryMetric = {
  label: 'Critical Incidents',
  count: 321,
  percentage: 12,
  comparisonText: 'Compared to 293 last week',
  trend: 'up',
};

const defaultSummaryRight: SummaryMetric = {
  label: 'Total Incidents',
  count: 1120,
  percentage: 4,
  comparisonText: 'Compared to 1.06k last week',
  trend: 'down',
};

const defaultColorScheme = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

function DetailedIncidentReportCard({
  title = "Incident Report",
  data = defaultData,
  metrics = defaultMetrics,
  summaryLeft = defaultSummaryLeft,
  summaryRight = defaultSummaryRight,
  colorScheme = defaultColorScheme,
  height = 200,
  className,
}: DetailedIncidentReportCardProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      data: (typeof item.data === 'number' && !isNaN(item.data)) ? item.data : 0,
    }));
  }, [data]);

  return (
    <div className={`flex flex-col justify-between pt-4 pb-4 bg-card rounded-xl border w-full max-w-[600px] overflow-hidden transition-colors duration-300 ${className}`} data-testid="chart-horizontal-bar-report">
      <div className="flex justify-between items-center p-6 pb-4">
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
      </div>

      <div className="flex-grow px-4" style={{ height }}>
        <BarChart
          id="detailed-horizontal-incident-chart"
          height={height}
          data={chartData}
          yAxis={
            <LinearYAxis
              type="category"
              tickSeries={
                <LinearYAxisTickSeries
                  label={
                    <LinearYAxisTickLabel
                      format={(text: string) => (text.length > 10 ? `${text.slice(0,10)}...` : text)}
                      fill="hsl(var(--muted-foreground))"
                    />
                  }
                />
              }
            />
          }
          xAxis={
            <LinearXAxis
              type="value"
              axisLine={null}
              tickSeries={
                <LinearXAxisTickSeries
                  label={null}
                  line={null}
                  tickSize={10}
                />
              }
            />
          }
          series={
            <BarSeries
              layout="horizontal"
              bar={
                <Bar
                  glow={{
                    blur: 20,
                    opacity: 0.5,
                  }}
                  gradient={null}
                />
              }
              colorScheme={colorScheme}
              padding={0.1}
            />
          }
          gridlines={
            <GridlineSeries
              line={<Gridline strokeColor="hsl(var(--border))" />}
            />
          }
        />
      </div>

      <div className="flex w-full px-6 justify-between pb-2 pt-6">
        <div className="flex flex-col gap-2 w-1/2">
          <span className="text-base text-muted-foreground">{summaryLeft.label}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-foreground">
              {summaryLeft.count}
            </span>
            <div className={`flex p-1 px-2 items-center rounded-full text-sm ${summaryLeft.trend === 'up' ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-500'}`}>
              {summaryLeft.trend === 'up' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 21" fill="none">
                  <path d="M5.50134 9.11119L10.0013 4.66675M10.0013 4.66675L14.5013 9.11119M10.0013 4.66675L10.0013 16.3334" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 21" fill="none">
                  <path d="M14.4987 11.8888L9.99866 16.3333M9.99866 16.3333L5.49866 11.8888M9.99866 16.3333V4.66658" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                </svg>
              )}
              {summaryLeft.percentage}%
            </div>
          </div>
          <span className="text-muted-foreground text-xs">{summaryLeft.comparisonText}</span>
        </div>
        <div className="flex flex-col gap-2 w-1/2">
          <span className="text-base text-muted-foreground">{summaryRight.label}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-foreground">
              {summaryRight.count}
            </span>
            <div className={`flex p-1 px-2 items-center rounded-full text-sm ${summaryRight.trend === 'up' ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-500'}`}>
              {summaryRight.trend === 'up' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 21" fill="none">
                  <path d="M5.50134 9.11119L10.0013 4.66675M10.0013 4.66675L14.5013 9.11119M10.0013 4.66675L10.0013 16.3334" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 21" fill="none">
                  <path d="M14.4987 11.8888L9.99866 16.3333M9.99866 16.3333L5.49866 11.8888M9.99866 16.3333V4.66658" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                </svg>
              )}
              {summaryRight.percentage}%
            </div>
          </div>
          <span className="text-muted-foreground text-xs">{summaryRight.comparisonText}</span>
        </div>
      </div>

      <div className="flex flex-col px-6 font-mono divide-y divide-border">
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
}

export default DetailedIncidentReportCard;
