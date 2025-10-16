import StatsCard from '../StatsCard';
import { DollarSign } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <StatsCard 
      title="LTV Médio"
      value="R$ 43.400"
      icon={DollarSign}
      trend={{ value: "12% vs mês anterior", isPositive: true }}
    />
  );
}