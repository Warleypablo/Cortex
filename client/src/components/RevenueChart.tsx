import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RevenueData {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  onBarClick?: (month: string) => void;
  selectedMonth?: string | null;
}

export default function RevenueChart({ data, onBarClick, selectedMonth }: RevenueChartProps) {
  const handleBarClick = (entry: any) => {
    const month = entry?.payload?.month || entry?.month;
    if (month && onBarClick) {
      onBarClick(month);
    }
  };

  return (
    <Card className="p-6">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="month" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
            formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Faturamento']}
          />
          <Bar 
            dataKey="revenue" 
            radius={[8, 8, 0, 0]}
            cursor="pointer"
            onClick={handleBarClick}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill="hsl(var(--primary))"
                fillOpacity={selectedMonth && entry.month !== selectedMonth ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}