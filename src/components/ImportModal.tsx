import React, { useState } from 'react';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiUrl } from '../lib/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ count: number; skipped: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccessData(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('betterme_token');
      const response = await fetch(apiUrl('/api/orders/import'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(`Server returned non-JSON response (${response.status}). Check server logs.`);
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to import CSV');

      setSuccessData({ count: data.count, skipped: data.skipped });
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccessData(null);
        setFile(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Import CSV Orders</h3>
              <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!successData ? (
                <div className="space-y-4">
                  <div
                    className={clsx(
                      "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors",
                      file ? "border-emerald-500 bg-emerald-50" : "border-black/10 hover:border-black/20"
                    )}
                  >
                    <Upload className={clsx("w-10 h-10 mb-2", file ? "text-emerald-500" : "text-black/30")} />
                    <p className="text-sm text-black/60 text-center mb-4">
                      {file ? file.name : "Select a CSV file with latitude, longitude, and subtotal"}
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="btn-secondary cursor-pointer text-sm"
                    >
                      Choose File
                    </label>
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleUpload}
                    disabled={!file || loading}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Start Import'
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4"
                  >
                    <CheckCircle2 className="w-10 h-10" />
                  </motion.div>
                  <h4 className="text-lg font-medium text-emerald-900">Import Processed</h4>
                  <p className="text-sm text-emerald-700 mt-1">
                    {successData.count} orders imported.
                    {successData.skipped > 0 && (
                      <span className="block text-amber-600 font-medium">
                        {successData.skipped} orders skipped (outside NY or invalid).
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function clsx(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
