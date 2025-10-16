import RevenueChart from '../RevenueChart';

export default function RevenueChartExample() {
  const mockData = [
    { month: '07/2024', revenue: 6200 },
    { month: '08/2024', revenue: 6200 },
    { month: '09/2024', revenue: 6200 },
    { month: '10/2024', revenue: 6200 },
    { month: '11/2024', revenue: 6200 },
    { month: '12/2024', revenue: 6200 },
  ];

  return <RevenueChart data={mockData} />;
}