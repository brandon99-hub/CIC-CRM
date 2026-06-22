import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Option {
    id: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string | null;
    onValueChange: (value: string | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    className,
    disabled = false
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.id === value);

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

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(
                    "w-full justify-between h-11 bg-gray-50/50 border-gray-200 hover:bg-white transition-all",
                    !value && "text-muted-foreground"
                )}
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
            >
                <span className="truncate">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

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
                                onClick={() => setSearch("")}
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
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors text-left",
                                        value === opt.id
                                            ? "bg-[#004E98] text-white font-bold"
                                            : "text-gray-700 hover:bg-gray-100"
                                    )}
                                    onClick={() => {
                                        onValueChange(opt.id);
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {value === opt.id && <Check className="h-4 w-4" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
