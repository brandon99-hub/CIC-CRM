import { useState, useEffect } from "react";
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
  DollarSign,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isSystem?: boolean;
}

interface SalesWonFiltersProps {
  onFiltersChange: (filters: {
    year?: string;
    quarter?: string;
    marketerId?: string;
    sector?: string;
  }) => void;
  showMarketerInfo?: boolean;
}

export function SalesWonFilters({ onFiltersChange, showMarketerInfo = false }: SalesWonFiltersProps) {
  const [year, setYear] = useState("all");
  const [quarter, setQuarter] = useState("all");
  const [marketerId, setMarketerId] = useState("all");
  const [sector, setSector] = useState("all");
  const [marketers, setMarketers] = useState<MarketingUser[]>([]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const quarters = [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' },
  ];

  const sectors = [
    'Government',
    'Private',
    'NGO',
    'Education',
    'Healthcare',
    'Finance',
    'Manufacturing',
    'Technology',
    'Retail',
    'Other'
  ];

  useEffect(() => {
    if (showMarketerInfo) {
      loadMarketers();
    }
  }, [showMarketerInfo]);

  useEffect(() => {
    const filters = {
      ...(year && year !== "all" && { year }),
      ...(quarter && quarter !== "all" && { quarter }),
      ...(marketerId && marketerId !== "all" && { marketerId }),
      ...(sector && sector !== "all" && { sector }),
    };

    onFiltersChange(filters);
  }, [year, quarter, marketerId, sector]);

  const loadMarketers = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMarketers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to load marketers:", error);
    }
  };

  const clearFilters = () => {
    setYear("all");
    setQuarter("all");
    setMarketerId("all");
    setSector("all");
  };

  const hasActiveFilters = year !== "all" || quarter !== "all" || marketerId !== "all" || sector !== "all";

  return (
    <Card className="border-gray-200 shadow-none bg-gray-50/30">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="h-10 bg-white border-gray-200">
                <SelectValue placeholder="All sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Marketer Filter */}
          {showMarketerInfo && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                <User className="h-3 w-3 mr-1.5 text-[#004E98]" />
                Marketer
              </label>
              <Select value={marketerId} onValueChange={setMarketerId}>
                <SelectTrigger className="h-10 bg-white border-gray-200">
                  <SelectValue placeholder="All marketers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All marketers</SelectItem>
                  {marketers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
