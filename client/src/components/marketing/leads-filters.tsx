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
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface LeadsFiltersProps {
  onFiltersChange: (filters: {
    search?: string;
    year?: string;
    quarter?: string;
    bdId?: string;
    marketerId?: string;
  }) => void;
  showMarketerInfo?: boolean;
}

export function LeadsFilters({ onFiltersChange, showMarketerInfo = false }: LeadsFiltersProps) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [quarter, setQuarter] = useState("all");
  const [bdId, setBdId] = useState("all");
  const [marketerId, setMarketerId] = useState("all");
  const [marketers, setMarketers] = useState<MarketingUser[]>([]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const quarters = [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' },
  ];

  useEffect(() => {
    loadMarketers();
  }, []);

  useEffect(() => {
    const filters = {
      ...(year && year !== "all" && { year }),
      ...(quarter && quarter !== "all" && { quarter }),
      ...(marketerId && marketerId !== "all" && { marketerId }),
    };

    onFiltersChange(filters);
  }, [year, quarter, marketerId]);

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

  return (
    <div className="flex items-center gap-3">
      {/* Year Filter */}
      <Select value={year} onValueChange={setYear}>
        <SelectTrigger className="h-10 w-28 border-gray-200 bg-gray-50/50">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {years.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quarter Filter */}
      <Select value={quarter} onValueChange={setQuarter}>
        <SelectTrigger className="h-10 w-32 border-gray-200 bg-gray-50/50">
          <SelectValue placeholder="Quarter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Quarters</SelectItem>
          {quarters.map((q) => (
            <SelectItem key={q.value} value={q.value}>
              {q.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Marketer Filter */}
      <Select value={marketerId} onValueChange={setMarketerId}>
        <SelectTrigger className="h-10 w-44 border-gray-200 bg-gray-50/50">
          <SelectValue placeholder="Marketer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Marketers</SelectItem>
          {marketers.map((marketer) => (
            <SelectItem key={marketer.id} value={marketer.id}>
              {marketer.firstName} {marketer.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
