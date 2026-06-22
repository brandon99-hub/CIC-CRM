import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StatItem {
    label: string;
    value: React.ReactNode;
    description: string;
    color?: string;
}

interface StatsCarouselProps {
    stats: StatItem[];
    className?: string;
    autoPlayInterval?: number;
}

export function StatsCarousel({
    stats,
    className,
    autoPlayInterval = 5000,
}: StatsCarouselProps) {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isHovering, setIsHovering] = React.useState(false);

    const next = React.useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % stats.length);
    }, [stats.length]);

    const prev = React.useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + stats.length) % stats.length);
    }, [stats.length]);

    React.useEffect(() => {
        if (autoPlayInterval && !isHovering && stats.length > 1) {
            const timer = setInterval(next, autoPlayInterval);
            return () => clearInterval(timer);
        }
    }, [next, autoPlayInterval, isHovering, stats.length]);

    if (!stats || stats.length === 0) return null;

    return (
        <div
            className={cn("relative group overflow-hidden bg-gray-50/50 rounded-xl border border-gray-100 p-6 min-h-[140px] flex flex-col justify-center", className)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <div className="relative z-10">
                <div key={currentIndex} className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
                        Dashboard Insight
                    </p>
                    <div className="flex items-baseline gap-3">
                        <h3 className={cn(
                            "text-2xl font-black tracking-tight",
                            stats[currentIndex].color || "text-[#004E98]"
                        )}>
                            {stats[currentIndex].value}
                        </h3>
                        <p className="text-sm font-bold text-gray-700 leading-tight">
                            {stats[currentIndex].label}
                        </p>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed max-w-[280px]">
                        {stats[currentIndex].description}
                    </p>
                </div>
            </div>

            {/* Navigation Dots */}
            {stats.length > 1 && (
                <div className="absolute bottom-4 right-6 flex items-center gap-1.5">
                    {stats.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === currentIndex ? "w-6 bg-[#004E98]" : "w-1.5 bg-gray-300 hover:bg-gray-400"
                            )}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Navigation Arrows (visible on hover) */}
            {stats.length > 1 && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={prev}
                        className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-gray-400"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={next}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-gray-400"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </>
            )}
        </div>
    );
}
