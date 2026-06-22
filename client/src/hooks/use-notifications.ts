import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useNotifications() {
    const queryClient = useQueryClient();
    const token = typeof window !== 'undefined' ? localStorage.getItem("marketingToken") : null;

    const { data, isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: async () => {
            if (!token) return { notifications: [] };
            const res = await fetch("/api/notifications", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch notifications");
            return res.json();
        },
        enabled: !!token,
        refetchInterval: 30000,
    });

    const readMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/notifications/${id}/read`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to mark as read");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    const readAllMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/notifications/read-all", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to mark all as read");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    return {
        notifications: data?.notifications || [],
        isLoading,
        markAsRead: readMutation.mutate,
        markAllAsRead: readAllMutation.mutate,
        unreadCount: (data?.notifications || []).filter((n: any) => !n.isRead).length
    };
}
