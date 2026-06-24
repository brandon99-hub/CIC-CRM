import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend
);

interface MonthlyTrendsData {
  month: string;
  leads: number;
  salesWon: number;
  expectedOrders: number;
}

interface MonthlyTrendsChartProps {
  data?: MonthlyTrendsData[];
  title?: string;
  description?: string;
  pipelineMode?: "B2C" | "B2B" | "student" | "business";
}

export function MonthlyTrendsChart({ 
  data = [], 
  title = "Monthly Trends", 
  description = "Performance trends over time",
  pipelineMode = "B2B"
}: MonthlyTrendsChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const safeData = Array.isArray(data) ? data : [];
  // Find max values for scaling
  const maxLeads = safeData.length ? Math.max(...safeData.map(d => d.leads)) : 0;
  const maxSalesWon = safeData.length ? Math.max(...safeData.map(d => d.salesWon)) : 0;
  const maxExpectedOrders = safeData.length ? Math.max(...safeData.map(d => d.expectedOrders)) : 0;
  const maxValue = Math.max(maxLeads, maxSalesWon, maxExpectedOrders);

  // Dynamic labels
  const labelLeads = "Leads";
  const labelExpectedOrders = "Underwriting Count";
  const labelSalesWon = "Policies Issued";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        </div>
        <CardDescription className="text-gray-600">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <Line data={{
            labels: safeData.map(item => item.month),
            datasets: [
              {
                label: labelLeads,
                data: safeData.map(item => item.leads),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: false,
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#ffffff',
                pointHoverBackgroundColor: 'rgb(59, 130, 246)',
                pointHoverBorderColor: '#ffffff',
              },
              {
                label: labelSalesWon,
                data: safeData.map(item => item.salesWon),
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: false,
                pointBackgroundColor: 'rgb(34, 197, 94)',
                pointBorderColor: '#ffffff',
                pointHoverBackgroundColor: 'rgb(34, 197, 94)',
                pointHoverBorderColor: '#ffffff',
              },
              {
                label: labelExpectedOrders,
                data: safeData.map(item => item.expectedOrders),
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                tension: 0.4,
                fill: false,
                pointBackgroundColor: 'rgb(147, 51, 234)',
                pointBorderColor: '#ffffff',
                pointHoverBackgroundColor: 'rgb(147, 51, 234)',
                pointHoverBorderColor: '#ffffff',
              },
            ],
          }} options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 2000,
              easing: 'easeInOutQuart',
              delay: (context: any) => context.dataIndex * 100,
            },
            plugins: {
              legend: {
                position: 'top' as const,
                labels: {
                  usePointStyle: true,
                  padding: 20,
                  font: {
                    size: 12,
                    weight: 'bold'
                  }
                }
              },
              title: {
                display: false,
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: 'white',
                bodyColor: 'white',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: true,
                mode: 'index',
                intersect: false,
                callbacks: {
                  label: function(context: any) {
                    const value = context.parsed.y;
                    return `${context.dataset.label}: ${formatCurrency(value)}`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: {
                  display: false,
                },
                ticks: {
                  font: {
                    size: 11,
                    weight: 'bold'
                  }
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                },
                ticks: {
                  callback: function(value: any) {
                    if (typeof value === 'number') {
                      return formatCurrency(value);
                    }
                    return value;
                  },
                  font: {
                    size: 11,
                    weight: 'bold'
                  }
                }
              }
            },
            elements: {
              point: {
                radius: 6,
                hoverRadius: 8,
                borderWidth: 2,
              },
              line: {
                tension: 0.4,
                borderWidth: 3,
              }
            },
            interaction: {
              intersect: false,
              mode: 'index',
            }
          }} />
        </div>
      </CardContent>
    </Card>
  );
}
