import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Filter,
  X,
  Search,
  Calendar,
  User,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface ProspectFiltersProps {
  onFiltersChange: (filters: {
    year?: string;
    quarter?: string;
    bdId?: string;
    sectorId?: string;
  }) => void;
  showMarketerInfo?: boolean;
}

export function ProspectFilters({ onFiltersChange, showMarketerInfo = false }: ProspectFiltersProps) {
  const [year, setYear] = useState("all");
  const [quarter, setQuarter] = useState("all");
  const [bdId, setBdId] = useState("all");
  const [sectorId, setSectorId] = useState("all");

  const { data: sectorsData } = useQuery<{ sectors: Sector[] }>({
    queryKey: ["marketing", "sectors", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/sectors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load sectors");
      return response.json();
    },
    staleTime: 600000,
  });

  const { data: marketersData } = useQuery<{ users: MarketingUser[] }>({
    queryKey: ["marketing", "users", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load marketers");
      return response.json();
    },
    staleTime: 600000,
  });

  const sectors = sectorsData?.sectors || [];
  const marketers = marketersData?.users || [];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const quarters = [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' },
  ];


  useEffect(() => {
    const filters = {
      ...(year && year !== "all" && { year }),
      ...(quarter && quarter !== "all" && { quarter }),
      ...(bdId && bdId !== "all" && { bdId }),
      ...(sectorId && sectorId !== "all" && { sectorId }),
    };

    onFiltersChange(filters);
  }, [year, quarter, bdId, sectorId]);


  const clearFilters = () => {
    setYear("all");
    setQuarter("all");
    setBdId("all");
    setSectorId("all");
  };

  const hasActiveFilters = year !== "all" || quarter !== "all" || bdId !== "all" || sectorId !== "all";

  return (
    <Card className="border-gray-200 shadow-none bg-gray-50/30">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Year Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
              <Calendar className="h-3 w-3 mr-1.5 text-[#004E98]" />
              Year
            </label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-10 bg-white border-gray-200">
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quarter Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quarter</label>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="h-10 bg-white border-gray-200">
                <SelectValue placeholder="All quarters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All quarters</SelectItem>
                {quarters.map((q) => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sector Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
              <Building2 className="h-3 w-3 mr-1.5 text-[#004E98]" />
              Sector
            </label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger className="h-10 bg-white border-gray-200">
                <SelectValue placeholder="All sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Marketer Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
              <User className="h-3 w-3 mr-1.5 text-[#004E98]" />
              Marketer
            </label>
            <Select value={bdId} onValueChange={setBdId}>
              <SelectTrigger className="h-10 bg-white border-gray-200">
                <SelectValue placeholder="All marketers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All marketers</SelectItem>
                {marketers.map((marketer) => (
                  <SelectItem key={marketer.id} value={marketer.id}>
                    {marketer.firstName} {marketer.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-10 text-gray-500 hover:text-red-500 hover:bg-red-50 font-bold text-xs uppercase"
              disabled={!hasActiveFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
