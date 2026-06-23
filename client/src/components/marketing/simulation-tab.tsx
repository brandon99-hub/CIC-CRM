import React from "react";
import { SimulateMarketingLeadsCard } from "./simulate-marketing-leads-card";
import { FlaskConical } from "lucide-react";

export function SimulationTab() {
  return (
    <div className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-purple-50 rounded-2xl">
            <FlaskConical className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Simulate Scenarios</h2>
            <p className="text-sm text-gray-500 mt-1">
              Generate realistic test data for the CIC CRM pipelines. This is useful for testing dashboard metrics, 
              evaluating conversion rates, and reviewing the user interface with populated data.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <SimulateMarketingLeadsCard />
          {/* Future simulation cards can be added here */}
        </div>
      </div>
    </div>
  );
}
