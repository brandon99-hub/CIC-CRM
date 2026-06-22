import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, PieChart, Activity } from "lucide-react";

export function SalesWonChartSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-gray-900">
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </div>
        <CardDescription className="text-gray-600">
          <Skeleton className="h-4 w-64" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 space-y-4">
          {/* Legend skeleton */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          
          {/* Chart skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex space-x-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PieChartSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <PieChart className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-gray-900">
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </div>
        <CardDescription className="text-gray-600">
          <Skeleton className="h-4 w-64" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 flex items-center justify-center">
          <div className="flex items-center space-x-8">
            {/* Pie chart skeleton */}
            <Skeleton className="w-48 h-48 rounded-full" />
            
            {/* Legend skeleton */}
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LineChartSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-gray-900">
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </div>
        <CardDescription className="text-gray-600">
          <Skeleton className="h-4 w-64" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 space-y-4">
          {/* Legend skeleton */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          
          {/* Chart skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex space-x-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-800">
          <Skeleton className="h-6 w-48" />
        </CardTitle>
        <CardDescription className="text-gray-600">
          <Skeleton className="h-4 w-64" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center space-x-4 p-3 border rounded-lg">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
