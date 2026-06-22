import { PhoneCall, Users, Clock, ShieldCheck, Activity } from "lucide-react";

export function AvayaMonitor() {
  const queues = [
    { name: "Student Support", waiting: 12, maxWait: "4m 20s", agents: 8 },
    { name: "Exams Inquiry", waiting: 5, maxWait: "1m 15s", agents: 4 },
    { name: "Finance Desk", waiting: 0, maxWait: "0s", agents: 3 },
  ];

  const agents = [
    { name: "Sarah Connor", ext: "1001", status: "On Call", duration: "12m 30s", queue: "Student Support" },
    { name: "John Smith", ext: "1002", status: "Available", duration: "1h 15m", queue: "Exams Inquiry" },
    { name: "Jane Doe", ext: "1003", status: "Wrap Up", duration: "45s", queue: "Finance Desk" },
    { name: "Mike Johnson", ext: "1004", status: "Break", duration: "10m 00s", queue: "-" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avaya Contact Center Monitor</h1>
          <p className="text-gray-500 mt-1">Real-time telephonic queues and agent statuses.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Connection
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Agents</p>
            <h3 className="text-2xl font-bold text-gray-900">15</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <PhoneCall size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Calls Waiting</p>
            <h3 className="text-2xl font-bold text-gray-900">17</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Avg Wait Time</p>
            <h3 className="text-2xl font-bold text-gray-900">2m 45s</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* Queues List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Activity size={18} className="text-blue-500" /> Active Queues
            </h3>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-medium">Queue Name</th>
                  <th className="px-6 py-3 font-medium">Waiting</th>
                  <th className="px-6 py-3 font-medium">Max Wait</th>
                  <th className="px-6 py-3 font-medium">Agents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queues.map((q, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{q.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${q.waiting > 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {q.waiting}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{q.maxWait}</td>
                    <td className="px-6 py-4 text-gray-600">{q.agents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agents List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" /> Agent Status
            </h3>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-medium">Agent</th>
                  <th className="px-6 py-3 font-medium">Ext</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agents.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{a.name}</div>
                      <div className="text-xs text-gray-500">{a.queue}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{a.ext}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                        a.status === 'On Call' ? 'bg-amber-100 text-amber-700' :
                        a.status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">{a.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
