'use client';

import { useState, useMemo } from 'react';
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

interface ChartCategoryData {
  key: string;
  data: number | null;
}

const baseCategoryDataRaw: ChartCategoryData[] = [
  { key: 'Brute Force', data: 100 },
  { key: 'Web Attack', data: 80 },
  { key: 'Malware', data: 120 },
  { key: 'Phishing', data: 90 },
  { key: 'DDoS', data: 70 },
  { key: 'Insider Threat', data: 50 },
];

const validatedBaseCategoryData = baseCategoryDataRaw.map(item => ({
  ...item,
  data: (typeof item.data === 'number' && !isNaN(item.data)) ? item.data : 0,
}));

const chartColors = ['#9152EE', '#40D3F4', '#40E5D1', '#4C86FF'];

interface MetricItem {
  id: string;
  label: string;
  value: string;
  trend: 'up' | 'down';
  delay: number;
}

const metrics: MetricItem[] = [
  {
    id: 'mttRespond',
    label: 'Mean Time to Respond',
    value: '6 Hours',
    trend: 'up',
    delay: 0,
  },
  {
    id: 'incidentResponseTime',
    label: 'Incident Response Time',
    value: '4 Hours',
    trend: 'up',
    delay: 0.05,
  },
  {
    id: 'incidentEscalationRate',
    label: 'Incident Escalation Rate',
    value: '10%',
    trend: 'down',
    delay: 0.1,
  },
];

const criticalIncidentsData = {
  count: 321,
  percentage: 12,
  comparisonText: 'Compared to 293 last week',
};

const totalIncidentsData = {
  count: 1120,
  percentage: 4,
  comparisonText: 'Compared to 1.06k last week',
};

interface DetailedIncidentReportCardProps {
  className?: string;
}

function DetailedIncidentReportCard({ className }: DetailedIncidentReportCardProps) {
  const [timeRange, setTimeRange] = useState('last-7-days');

  const handleTimeRangeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRange(event.target.value);
  };

  const chartData = useMemo(() => {
    if (timeRange === 'last-7-days') {
      return validatedBaseCategoryData.slice(0, 4);
    }
    return validatedBaseCategoryData;
  }, [timeRange]);

  return (
    <div className={`flex flex-col justify-between pt-4 pb-4 bg-card rounded-xl border w-full max-w-[600px] overflow-hidden transition-colors duration-300 ${className}`} data-testid="chart-horizontal-bar-report">
      <div className="flex justify-between items-center p-6 pb-4">
        <h3 className="text-xl font-bold text-foreground">
          Incident Report
        </h3>
        <select
          value={timeRange}
          onChange={handleTimeRangeChange}
          aria-label="Select time range for incident report"
          className="bg-muted text-foreground p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          data-testid="select-time-range"
        >
          <option value="last-7-days">Last 7 Days</option>
          <option value="last-30-days">Last 30 Days</option>
          <option value="last-90-days">Last 90 Days</option>
        </select>
      </div>

      <div className="flex-grow px-4 h-[200px]">
        <BarChart
          id="detailed-horizontal-incident-chart"
          height={200}
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
              colorScheme={chartColors}
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
          <span className="text-base text-muted-foreground">Critical Incidents</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-foreground">
              {criticalIncidentsData.count}
            </span>
            <div className="flex bg-destructive/20 p-1 px-2 items-center rounded-full text-destructive text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 21" fill="none">
                <path d="M5.50134 9.11119L10.0013 4.66675M10.0013 4.66675L14.5013 9.11119M10.0013 4.66675L10.0013 16.3334" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
              </svg>
              {criticalIncidentsData.percentage}%
            </div>
          </div>
          <span className="text-muted-foreground text-xs">
            {criticalIncidentsData.comparisonText}
          </span>
        </div>
        <div className="flex flex-col gap-2 w-1/2">
          <span className="text-base text-muted-foreground">Total Incidents</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-foreground">
              {totalIncidentsData.count}
            </span>
            <div className="flex bg-emerald-500/20 p-1 px-2 items-center rounded-full text-emerald-500 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 21" fill="none">
                <path d="M14.4987 11.8888L9.99866 16.3333M9.99866 16.3333L5.49866 11.8888M9.99866 16.3333V4.66658" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
              </svg>
              {totalIncidentsData.percentage}%
            </div>
          </div>
          <span className="text-muted-foreground text-xs">
            {totalIncidentsData.comparisonText}
          </span>
        </div>
      </div>

      <div className="flex flex-col px-6 font-mono divide-y divide-border">
        {metrics.map(metric => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: metric.delay }}
            className="flex w-full py-3 items-center gap-2"
          >
            <div className="flex flex-row gap-2 items-center text-sm w-1/2 text-muted-foreground">
              <span className="truncate" title={metric.label}>
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
}

export default DetailedIncidentReportCard;
