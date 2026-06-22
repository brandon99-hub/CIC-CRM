import { LucideIcon, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React from "react";

interface MarketingPageHeaderProps {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    actionButton?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    stackLayout?: boolean;
    children?: React.ReactNode;
}

/**
 * A reusable page header for the Marketing Dashboard that replicates the 
 * premium design found in the "All Cases" module.
 */
export function MarketingPageHeader({
    title,
    subtitle,
    icon: Icon,
    searchPlaceholder = "Search...",
    searchValue,
    onSearchChange,
    actionButton,
    stackLayout = false,
    children
}: MarketingPageHeaderProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-[#004E98]/10 p-3 rounded-lg flex-shrink-0">
                        <Icon className="h-6 w-6 text-[#004E98]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-none">{title}</h3>
                        <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                            {subtitle}
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder={searchPlaceholder}
                        className="pl-10 h-10 border-gray-200 focus:border-[#004E98] focus:ring-[#004E98] bg-white"
                        value={searchValue || ""}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {children}
                    {actionButton && (
                        <Button onClick={actionButton.onClick} className="bg-[#004E98] hover:bg-[#003d7a]">
                            {actionButton.icon ? <actionButton.icon className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            {actionButton.label}
                        </Button>
                    )}
                </div>
            </div>

        </div>
    );
}
