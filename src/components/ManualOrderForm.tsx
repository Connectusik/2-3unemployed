import React, { useState } from 'react';
import { Plus, Loader2, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { apiUrl } from '../lib/api';

interface ManualOrderFormProps {
  onSuccess: () => void;
  onError?: () => void;
}

export function ManualOrderForm({ onSuccess, onError }: ManualOrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    subtotal: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('betterme_token');
      const response = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          subtotal: parseFloat(formData.subtotal),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (onError) onError();
        throw new Error(data.error || 'Failed to create order');
      }

      setFormData({ latitude: '', longitude: '', subtotal: '' });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
        }));
      });
    }
  };

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5" />
        Manual Order Entry
      </h3>
      {error && (
        <div className="mb-4 text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/50">Latitude</label>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                value={formData.latitude}
                onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                className="input-field w-full pr-10"
                placeholder="40.7128"
              />
              <button
                type="button"
                onClick={getUserLocation}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/5 rounded-md text-black/40 hover:text-black/60 transition-colors"
                title="Use current location"
              >
                <MapPin className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-black/50">Longitude</label>
            <input
              type="number"
              step="any"
              required
              value={formData.longitude}
              onChange={e => setFormData({ ...formData, longitude: e.target.value })}
              className="input-field w-full"
              placeholder="-74.0060"
            />
            <p className="text-[10px] text-black/30">NY longitude is always negative (e.g., -74.0)</p>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-black/50">Subtotal ($)</label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.subtotal}
            onChange={e => setFormData({ ...formData, subtotal: e.target.value })}
            className="input-field w-full"
            placeholder="99.99"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calculate & Save Order'}
        </button>
      </form>
    </div>
  );
}
