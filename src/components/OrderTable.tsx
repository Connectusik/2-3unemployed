import React from 'react';
import { formatCurrency, formatPercent } from '../lib/utils';
import { MapPin, Clock, Info } from 'lucide-react';

interface Order {
  id: number;
  latitude: number;
  longitude: number;
  subtotal: number;
  composite_tax_rate: number;
  tax_amount: number;
  total_amount: number;
  jurisdictions: string[];
  timestamp: string;
  breakdown: {
    state_rate: number;
    county_rate: number;
    city_rate: number;
    special_rate?: number;
    special_rates?: Array<{ name: string; rate: number }>;
  };
}

interface OrderTableProps {
  orders: Order[];
  loading: boolean;
}

export function OrderTable({ orders, loading }: OrderTableProps) {
  const getSpecialRates = (order: Order) => {
    if (Array.isArray(order.breakdown.special_rates)) {
      return order.breakdown.special_rates;
    }
    if ((order.breakdown.special_rate ?? 0) > 0) {
      return [{ name: 'MCTD', rate: order.breakdown.special_rate as number }];
    }
    return [];
  };

  if (loading && orders.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-black/20">
        <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-medium">Loading orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-black/30 text-center">
        <Info className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No orders yet</p>
        <p className="text-sm">Import a CSV or add an order manually to get started.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black/5 border-b border-black/5">
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Order Details</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Location</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Subtotal</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Tax Rate</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Tax Amount</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black/50">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-black/[0.02] transition-colors group">
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-medium">#ORD-{order.id.toString().padStart(5, '0')}</span>
                  <span className="text-xs text-black/40 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.timestamp).toLocaleString()}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <MapPin className="w-3 h-3 text-black/40" />
                    {order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {order.jurisdictions.map((j, i) => (
                      <span key={i} className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter text-black/60">
                        {j}
                      </span>
                    ))}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 font-medium text-sm">{formatCurrency(order.subtotal)}</td>
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{formatPercent(order.composite_tax_rate)}</span>
                  <div className="hidden group-hover:flex flex-col text-[10px] text-black/40 leading-tight mt-1">
                    <span>State: {formatPercent(order.breakdown.state_rate)}</span>
                    <span>County: {formatPercent(order.breakdown.county_rate)}</span>
                    <span>City: {formatPercent(order.breakdown.city_rate)}</span>
                    {getSpecialRates(order).map((special, index) => (
                      <span key={`${special.name}-${index}`}>{special.name}: {formatPercent(special.rate)}</span>
                    ))}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-black/60">{formatCurrency(order.tax_amount)}</td>
              <td className="px-6 py-4">
                <span className="bg-black text-white px-2 py-1 rounded text-sm font-bold">
                  {formatCurrency(order.total_amount)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
