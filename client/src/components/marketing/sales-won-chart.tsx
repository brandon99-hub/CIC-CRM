import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend
);

interface SalesWonData {
  marketerId: string;
  marketerName: string;
  salesWon: number;
  target: number;
  achievementRate: number;
}

interface SalesWonChartProps {
  data?: SalesWonData[];
  title?: string;
  description?: string;
  pipelineMode?: "business" | "student" | "B2B" | "B2C";
}

export function SalesWonChart({ 
  data = [], 
  title, 
  description,
  pipelineMode = "business"
}: SalesWonChartProps) {
  const safeData = Array.isArray(data) ? data : [];
  
  const defaultTitle = "Policies Issued vs Target";
  const defaultDescription = "Individual marketer performance against policy issuance targets";

  const chartTitle = title || defaultTitle;
  const chartDescription = description || defaultDescription;

  const formatValue = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-gray-900">{chartTitle}</CardTitle>
        </div>
        <CardDescription className="text-gray-600">{chartDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {safeData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No data available</p>
                <p className="text-sm">Set targets and record transactions to see performance comparison</p>
              </div>
            </div>
          ) : (
            <Chart type='bar' data={{
            labels: safeData.map(item => item.marketerName),
            datasets: [
              {
                label: 'Target',
                data: safeData.map(item => item.target),
                backgroundColor: 'rgba(239, 68, 68, 0.6)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
                order: 2,
              },
              {
                label: 'Policies Issued',
                data: safeData.map(item => item.salesWon),
                backgroundColor: 'rgba(34, 197, 94, 0.6)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
                order: 1,
              },
            ],
          }} options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 2000,
              easing: 'easeInOutQuart',
              delay: (context: any) => context.dataIndex * 200,
            },
            plugins: {
              legend: {
                position: 'top' as const,
                labels: {
                  usePointStyle: false,
                  padding: 20,
                  font: {
                    size: 12,
                    weight: 500
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
                callbacks: {
                  label: function(context: any) {
                    const value = context.parsed.y;
                    return `${context.dataset.label}: ${formatValue(value)}`;
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
                    weight: 500
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
                    return formatValue(value);
                  },
                  font: {
                    size: 11,
                    weight: 500
                  }
                }
              }
            },
            elements: {
              bar: {
                borderRadius: 6,
                borderSkipped: false,
              }
            }
          }} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

