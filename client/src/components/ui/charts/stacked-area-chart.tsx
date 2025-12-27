'use client';

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

interface ChartDataPoint {
  key: Date;
  data: number | null | undefined;
}

interface ChartSeries {
  key: string;
  data: ChartDataPoint[];
}

interface LegendItem {
  name: string;
  color: string;
}

interface MetricInfo {
  id: string;
  label: string;
  tooltip: string;
  value: string;
  trend: 'up' | 'down';
  delay: number;
}

const LEGEND_ITEMS: LegendItem[] = [
  { name: 'Threat Intel', color: '#FAE5F6' },
  { name: 'DLP', color: '#EE4094' },
  { name: 'SysLog', color: '#BB015A' },
];

const CHART_COLOR_SCHEME = ['#FAE5F6', '#EE4094', '#BB015A'];

const now = new Date();
const generateDate = (offsetDays: number): Date => {
  const date = new Date(now);
  date.setDate(now.getDate() - offsetDays);
  return date;
};

const initialMultiDateData: ChartSeries[] = [
  {
    key: 'Threat Intel',
    data: Array.from({ length: 7 }, (_, i) => ({ key: generateDate(6 - i), data: Math.floor(Math.random() * 20) + 10 })),
  },
  {
    key: 'DLP',
    data: Array.from({ length: 7 }, (_, i) => ({ key: generateDate(6 - i), data: Math.floor(Math.random() * 25) + 15 })),
  },
  {
    key: 'SysLog',
    data: Array.from({ length: 7 }, (_, i) => ({ key: generateDate(6 - i), data: Math.floor(Math.random() * 15) + 5 })),
  },
];

const validateChartData = (data: ChartSeries[]) => {
  return data.map(series => ({
    ...series,
    data: series.data.map(item => ({
      ...item,
      data: (typeof item.data !== 'number' || isNaN(item.data)) ? 0 : item.data,
    })),
  }));
};

const validatedChartData = validateChartData(initialMultiDateData);

const METRICS_DATA: MetricInfo[] = [
  {
    id: 'mttd',
    label: 'Mean Time to Respond',
    tooltip: 'Mean Time to Respond',
    value: '6 Hours',
    trend: 'up',
    delay: 0,
  },
  {
    id: 'irt',
    label: 'Incident Response Time',
    tooltip: 'Incident Response Time',
    value: '4 Hours',
    trend: 'up',
    delay: 0.05,
  },
  {
    id: 'ier',
    label: 'Incident Escalation Rate',
    tooltip: 'Incident Escalation Rate',
    value: '10%',
    trend: 'down',
    delay: 0.1,
  },
];

interface StackedAreaReportProps {
  className?: string;
}

const StackedAreaReport = ({ className }: StackedAreaReportProps) => {
  return (
    <div className={`flex flex-col pt-4 pb-4 bg-card rounded-xl border w-full max-w-md min-h-[500px] overflow-hidden transition-colors duration-300 ${className}`} data-testid="chart-stacked-area">
      <h3 className="text-xl text-left p-6 pb-4 font-bold text-foreground">
        Incident Report
      </h3>
      
      <div className="flex justify-between w-full px-6 mb-4">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.name} className="flex gap-2 items-center">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground text-xs">{item.name}</span>
          </div>
        ))}
      </div>

      <div className="h-[200px] px-2">
        <StackedNormalizedAreaChart
          height={200}
          id="stacked-normalized-details"
          data={validatedChartData}
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
              colorScheme={CHART_COLOR_SCHEME}
            />
          }
          gridlines={<GridlineSeries line={<Gridline strokeColor="hsl(var(--border))" />} />}
        />
      </div>

      <div className="flex flex-col px-6 pt-6 font-mono divide-y divide-border">
        {METRICS_DATA.map((metric) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: metric.delay }}
            className="flex w-full py-3 items-center gap-2"
          >
            <div className="flex flex-row gap-2 items-center text-sm w-1/2 text-muted-foreground">
              <span className="truncate" title={metric.tooltip}>
                {metric.label}
              </span>
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
