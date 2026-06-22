// Force module index refresh for forensic-dashboard
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useState, ComponentType, lazy, Suspense } from "react";
import MarketingLogin from "./pages/marketing-login";
import MarketingResetPassword from "./pages/marketing-reset-password";
import DashboardHub from "./pages/dashboard-hub";
import { Toaster } from "./components/ui/toaster";
import { apiRequest } from "./lib/api-client";
import { ErrorBoundary } from "./components/shared/error-boundary";

const MarketingDashboard = lazy(() => import("./pages/marketing-dashboard"));
const AdminDashboard = lazy(() => import("./pages/admin-dashboard"));
const StakeholderDashboard = lazy(() => import("./pages/stakeholder-dashboard"));
const CaseDashboard = lazy(() => import("./pages/case-dashboard"));
const ExecutiveDashboard = lazy(() => import("./pages/executive-dashboard"));
const CaseWorkspace = lazy(() => import("./pages/cases/case-workspace"));
const CollaborationHub = lazy(() => import("./pages/cases/collaboration-hub"));
const ProfilePage = lazy(() => import("./pages/profile"));
const SatisfactionPage = lazy(() => import("./pages/satisfaction-page"));
const CampaignLanding = lazy(() => import("./pages/campaign-landing"));
const EventRegistration = lazy(() => import("./pages/event-registration"));
const ForensicDashboard = lazy(() => import("./pages/forensic-dashboard"));
const CommunicationsDashboard = lazy(() => import("./pages/communications-dashboard"));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#004E98] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 text-sm">Loading dashboard...</p>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";

function DashboardGuard({ dashboardId, Component }: { dashboardId: string; Component: ComponentType }) {
  const [, setLocation] = useLocation();

  // Synchronous pre-check for fast perceived performance
  const userData = localStorage.getItem("marketingUser");
  const parsedUser = userData ? JSON.parse(userData) : null;
  const localDashboardAccess: string[] = parsedUser?.dashboardAccess || [];

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest("/api/auth/me").then(r => r.json()),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      setLocation("/marketing/login");
      return;
    }
    if (me && !me.dashboardAccess.includes(dashboardId)) {
      setLocation("/dashboard");
    }
  }, [me, isError, dashboardId, setLocation]);

  if (isLoading && !localDashboardAccess.includes(dashboardId)) return <LoadingSpinner />;
  if (isError || (me && !me.dashboardAccess.includes(dashboardId))) return null;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ErrorBoundary fallbackTitle="Dashboard Error">
        <Component />
      </ErrorBoundary>
    </Suspense>
  );
}

import { QueryProvider } from "./lib/query-provider";
import { AiChatbot } from "./components/shared/ai-chatbot";

import { RegionProvider } from "./lib/RegionContext";
import "./lib/i18n";

function ConditionalChatbot() {
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest("/api/auth/me").then(r => r.json()),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  if (!me) return null;
  return <AiChatbot />;
}

function App() {
  return (
    <QueryProvider>
      <RegionProvider>
      <Switch>
        <Route path="/marketing/login" component={MarketingLogin} />
        <Route path="/dashboard" component={DashboardHub} />
        <Route path="/marketing/dashboard">
          {() => <DashboardGuard dashboardId="marketing" Component={MarketingDashboard} />}
        </Route>
        <Route path="/marketing/events/:id/forensics">
          {() => <DashboardGuard dashboardId="marketing" Component={ForensicDashboard} />}
        </Route>
        <Route path="/communications/dashboard">
          {() => <DashboardGuard dashboardId="marketing" Component={CommunicationsDashboard} />}
        </Route>
        <Route path="/admin/dashboard">
          {() => <DashboardGuard dashboardId="admin" Component={AdminDashboard} />}
        </Route>
        <Route path="/stakeholders/dashboard">
          {() => <DashboardGuard dashboardId="stakeholders" Component={StakeholderDashboard} />}
        </Route>
        <Route path="/cases/dashboard">
          {() => <DashboardGuard dashboardId="cases" Component={CaseDashboard} />}
        </Route>
        <Route path="/cases/workspace/:id">
          {() => <DashboardGuard dashboardId="cases" Component={CaseWorkspace} />}
        </Route>
        <Route path="/cases/collaboration">
          {() => <DashboardGuard dashboardId="cases" Component={CollaborationHub} />}
        </Route>
        <Route path="/executive/dashboard">
          {() => <DashboardGuard dashboardId="executive" Component={ExecutiveDashboard} />}
        </Route>
        <Route path="/profile">
          {() => (
            <Suspense fallback={<LoadingSpinner />}>
              <ProfilePage />
            </Suspense>
          )}
        </Route>
        <Route path="/satisfaction/rate/:token">
          {() => (
            <Suspense fallback={<LoadingSpinner />}>
              <SatisfactionPage />
            </Suspense>
          )}
        </Route>
        <Route path="/marketing/campaign-landing/:id">
          {(params) => (
            <Suspense fallback={<LoadingSpinner />}>
              <CampaignLanding id={params.id} />
            </Suspense>
          )}
        </Route>
        <Route path="/events/register/:slug">
          {(params) => (
            <Suspense fallback={<LoadingSpinner />}>
              <EventRegistration />
            </Suspense>
          )}
        </Route>
        <Route path="/marketing/reset-password" component={MarketingLogin} />
        <Route path="/">
          {() => {
            window.location.href = "/marketing/login";
            return null;
          }}
        </Route>
        <Route>
          {() => {
            window.location.href = "/marketing/login";
            return null;
          }}
        </Route>
      </Switch>
      <Toaster />
      <ConditionalChatbot />
      </RegionProvider>
    </QueryProvider>
  );
}

export default App;
