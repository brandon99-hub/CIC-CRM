import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 1000 * 60 * 5, // 5 minutes - balanced freshness
                        gcTime: 1000 * 60 * 60, // 1 hour - persist in memory longer
                        retry: 1,
                        refetchOnWindowFocus: false, // Don't refetch on tab focus to save bandwidth
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
    );
}
