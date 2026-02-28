import React from 'react';
import { AlertCircle, Clock, FileText, MousePointer } from 'lucide-react';

interface FailedRequest {
  id: number;
  latitude: number | null;
  longitude: number | null;
  subtotal: number | null;
  reason: string;
  source: 'manual' | 'csv';
  timestamp: string;
}

interface FailedRequestsTableProps {
  requests: FailedRequest[];
  loading: boolean;
}

export function FailedRequestsTable({ requests, loading }: FailedRequestsTableProps) {
  if (loading && requests.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-black/20">
        <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-medium">Loading error history...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-black/30 text-center">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No failed requests</p>
        <p className="text-sm">All order attempts have been successful so far.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black/5 border-b border-black/5">
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Timestamp</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Source</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Attempted Data</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-red-50/30 transition-colors">
              <td className="px-6 py-4">
                <span className="text-xs text-black/40 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(req.timestamp).toLocaleString()}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                  req.source === 'manual' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                }`}>
                  {req.source === 'manual' ? <MousePointer className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  {req.source}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="text-xs font-mono text-black/60">
                  {req.latitude !== null && req.longitude !== null ? (
                    <span>{req.latitude.toFixed(4)}, {req.longitude.toFixed(4)}</span>
                  ) : (
                    <span className="italic">Invalid Coords</span>
                  )}
                  {req.subtotal !== null && (
                    <span className="ml-2 opacity-40">| ${req.subtotal.toFixed(2)}</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-xs text-red-600 font-medium">{req.reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
