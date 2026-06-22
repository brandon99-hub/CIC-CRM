import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Option {
    id: string;
    label: string;
}

interface MultiSelectProps {
    options: Option[];
    value: string[];
    onValueChange: (value: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
}

export function MultiSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select options...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    className,
    disabled = false
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);

    const selectedOptions = options.filter((opt) => value.includes(opt.id));

    const filteredOptions = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    // Close when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (id: string) => {
        if (value.includes(id)) {
            onValueChange(value.filter((v) => v !== id));
        } else {
            onValueChange([...value, id]);
        }
    };

    const removeOption = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onValueChange(value.filter((v) => v !== id));
    };

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <div
                role="combobox"
                aria-expanded={open}
                className={cn(
                    "w-full min-h-[44px] flex items-center justify-between bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all cursor-pointer p-1.5",
                    disabled && "opacity-50 cursor-not-allowed",
                    open && "ring-2 ring-[#004E98]/20 border-[#004E98]/30"
                )}
                onClick={() => !disabled && setOpen(!open)}
            >
                <div className="flex flex-wrap gap-1.5 flex-1 items-center px-1">
                    {selectedOptions.length === 0 ? (
                        <span className="text-sm text-gray-400 px-1 py-1 font-medium">{placeholder}</span>
                    ) : (
                        selectedOptions.map((opt) => (
                            <Badge 
                                key={opt.id} 
                                variant="secondary" 
                                className="bg-[#004E98]/10 text-[#004E98] hover:bg-[#004E98]/20 text-xs font-bold px-2 py-1 flex items-center gap-1 border-0"
                            >
                                <span className="truncate max-w-[120px]">{opt.label}</span>
                                <button
                                    className="ml-1 ring-offset-background rounded-full outline-none hover:bg-[#004E98]/20 p-0.5 transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            removeOption(e as any, opt.id);
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onClick={(e) => removeOption(e, opt.id)}
                                >
                                    <X className="h-3 w-3" />
                                    <span className="sr-only">Remove</span>
                                </button>
                            </Badge>
                        ))
                    )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400 mr-2" />
            </div>

            {open && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="p-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                        <Search className="h-4 w-4 text-gray-400 ml-2" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-9 border-0 bg-transparent focus-visible:ring-0 shadow-none text-sm placeholder:text-gray-400"
                            autoFocus
                        />
                        {search && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-gray-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearch("");
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-400 italic">
                                {emptyText}
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = value.includes(opt.id);
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors text-left",
                                            isSelected
                                                ? "bg-[#004E98]/5 text-[#004E98] font-bold"
                                                : "text-gray-700 hover:bg-gray-100"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleOption(opt.id);
                                        }}
                                    >
                                        <span className="truncate">{opt.label}</span>
                                        <div className={cn(
                                            "h-4 w-4 border rounded flex items-center justify-center transition-colors",
                                            isSelected ? "bg-[#004E98] border-[#004E98]" : "border-gray-300"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
