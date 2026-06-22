import React from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallbackTitle?: string }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center flex-col gap-4 p-8 text-center bg-gray-50">
          <AlertTriangle className="h-12 w-12 text-orange-500" />
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
            {this.props.fallbackTitle || "Something went wrong"}
          </h1>
          <p className="text-gray-500 max-w-md font-medium">
            {this.state.error?.message || "An unexpected error occurred. Please refresh the page."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-3 bg-[#004E98] text-white rounded-xl font-bold shadow-md hover:bg-[#003B73] transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
