import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  Chart as ChartJS,
  ArcElement,
  PieController,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, PieController, Tooltip, Legend);

interface ExpectedOrdersData {
  marketerId: string;
  marketerName: string;
  expectedOrders: number;
  percentage: number;
  color: string;
}

interface ExpectedOrdersPieChartProps {
  data?: ExpectedOrdersData[];
  title?: string;
  description?: string;
}

export function ExpectedOrdersPieChart({ 
  data = [], 
  title = "Expected Orders Share", 
  description = "Distribution of expected orders by marketer" 
}: ExpectedOrdersPieChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const safeData = Array.isArray(data) ? data : [];
  const totalOrders = safeData.reduce((sum, item) => sum + (item.expectedOrders || 0), 0);

  // Generate SVG path for pie slice
  const createPieSlice = (percentage: number, offset: number) => {
    const radius = 80;
    const centerX = 100;
    const centerY = 100;
    
    const startAngle = (offset * 360) - 90; // Start from top
    const endAngle = ((offset + percentage) * 360) - 90;
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);
    
    const largeArcFlag = percentage > 50 ? 1 : 0;
    
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  let currentOffset = 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <PieChartIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        </div>
        <CardDescription className="text-gray-600">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <Pie data={{
            labels: safeData.map(item => item.marketerName),
            datasets: [
              {
                data: safeData.map(item => item.expectedOrders),
                backgroundColor: [
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(147, 51, 234, 0.8)',
                  'rgba(236, 72, 153, 0.8)',
                  'rgba(34, 197, 94, 0.8)',
                  'rgba(245, 158, 11, 0.8)',
                  'rgba(239, 68, 68, 0.8)',
                  'rgba(6, 182, 212, 0.8)',
                  'rgba(168, 85, 247, 0.8)',
                ],
                borderColor: [
                  'rgba(59, 130, 246, 1)',
                  'rgba(147, 51, 234, 1)',
                  'rgba(236, 72, 153, 1)',
                  'rgba(34, 197, 94, 1)',
                  'rgba(245, 158, 11, 1)',
                  'rgba(239, 68, 68, 1)',
                  'rgba(6, 182, 212, 1)',
                  'rgba(168, 85, 247, 1)',
                ],
                borderWidth: 3,
                hoverBorderWidth: 4,
              },
            ],
          }} options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              animateRotate: true,
              animateScale: true,
              duration: 2000,
              easing: 'easeInOutQuart',
            },
            plugins: {
              legend: {
                position: 'right' as const,
                labels: {
                  usePointStyle: true,
                  padding: 15,
                  font: {
                    size: 11,
                    weight: 'bold'
                  },
                  generateLabels: function(chart: any) {
                    const data = chart.data;
                    if (data.labels.length && data.datasets.length) {
                      return data.labels.map((label: string, i: number) => {
                        const value = data.datasets[0].data[i];
                        const percentage = totalOrders ? ((value / totalOrders) * 100).toFixed(1) : '0.0';
                        return {
                          text: `${label}: ${formatCurrency(value)} (${percentage}%)`,
                          fillStyle: data.datasets[0].backgroundColor[i],
                          strokeStyle: data.datasets[0].borderColor[i],
                          lineWidth: data.datasets[0].borderWidth,
                          hidden: false,
                          index: i
                        };
                      });
                    }
                    return [];
                  }
                }
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
                    const value = context.parsed;
                    const percentage = totalOrders ? ((value / totalOrders) * 100).toFixed(1) : '0.0';
                    return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                  }
                }
              }
            },
            elements: {
              arc: {
                borderWidth: 2,
                borderColor: '#ffffff',
              }
            }
          }} />
        </div>
      </CardContent>
    </Card>
  );
}
