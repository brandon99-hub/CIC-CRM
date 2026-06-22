import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("marketingUser");
    
    // Quick frontend check
    if (!userData) {
      setLocation("/marketing/login");
      return;
    }

    // Ping an auth endpoint to verify the httpOnly cookie is valid
    apiRequest("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          setIsReady(true);
        } else {
          setLocation("/marketing/login");
        }
      })
      .catch(() => {
        setLocation("/marketing/login");
      });
  }, [setLocation]);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#004E98]" />
      </div>
    );
  }

  return <>{children}</>;
}
