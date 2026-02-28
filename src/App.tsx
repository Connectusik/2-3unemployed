import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  FileUp, 
  History, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { OrderTable } from './components/OrderTable';
import { ManualOrderForm } from './components/ManualOrderForm';
import { ImportModal } from './components/ImportModal';
import { FailedRequestsTable } from './components/FailedRequestsTable';
import { Login } from './components/Login';
import { formatCurrency } from './lib/utils';
import { apiUrl } from './lib/api';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [failedRequests, setFailedRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedLoading, setFailedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'errors'>('orders');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [stats, setStats] = useState({ totalRevenue: 0, totalTax: 0, orderCount: 0 });
  const [apiError, setApiError] = useState<string | null>(null);

  const parseResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();
    return { error: text || `Request failed (${response.status})` };
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('betterme_token');
    if (!token) {
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('betterme_token');
      }
    } catch (err) {
      console.error('Auth check failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('betterme_token');
    setUser(null);
  };

  const handleClearHistoryClick = () => {
    setIsClearHistoryModalOpen(true);
  };

  const confirmClearHistory = async () => {
    const token = localStorage.getItem('betterme_token');
    try {
      const response = await fetch(apiUrl('/api/history'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchOrders(1);
        fetchFailedRequests();
        setIsClearHistoryModalOpen(false);
      } else {
        alert('Failed to clear history');
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('An error occurred while clearing history');
    }
  };

  const fetchOrders = useCallback(async (page = 1) => {
    if (!user) return;
    const token = localStorage.getItem('betterme_token');
    setLoading(true);
    setApiError(null);
    try {
      const response = await fetch(apiUrl(`/api/orders?page=${page}&limit=10`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('betterme_token');
        setUser(null);
        return;
      }

      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch orders');
      }

      const nextOrders = Array.isArray(data?.data) ? data.data : [];
      const nextPagination = data?.pagination || {};
      const nextStats = data?.stats || {};

      setOrders(nextOrders);
      setPagination({
        page: Number(nextPagination.page) || 1,
        pages: Number(nextPagination.pages) || 1,
        total: Number(nextPagination.total) || 0,
      });
      setStats({ 
        totalRevenue: Number(nextStats.total_revenue) || 0, 
        totalTax: Number(nextStats.total_tax) || 0, 
        orderCount: Number(nextStats.count) || 0,
      });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
      setPagination({ page: 1, pages: 1, total: 0 });
      setStats({ totalRevenue: 0, totalTax: 0, orderCount: 0 });
      setApiError(error instanceof Error ? error.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchFailedRequests = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem('betterme_token');
    setFailedLoading(true);
    try {
      const response = await fetch(apiUrl('/api/failed-requests'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await parseResponse(response);
        setFailedRequests(Array.isArray(data) ? data : []);
      } else {
        const data = await parseResponse(response);
        throw new Error(data?.error || 'Failed to fetch errors');
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error);
      setFailedRequests([]);
    } finally {
      setFailedLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchFailedRequests();
    }
  }, [user, fetchOrders, fetchFailedRequests]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-black/5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">BetterMe</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-black/40 leading-none">Tax Compliance Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleClearHistoryClick}
              className="p-2 hover:bg-red-50 text-black/40 hover:text-red-500 rounded-lg transition-colors"
              title="Clear History"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FileUp className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>

            <div className="h-8 w-px bg-black/5 mx-1" />

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold uppercase tracking-tighter">{user.username}</span>
                <span className="text-[10px] text-black/40 font-medium">Administrator</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-black/40 hover:text-red-500 rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {apiError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load orders: {apiError}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 space-y-8">
            <section className="grid grid-cols-2 gap-4">
              <div className="card p-4 bg-white">
                <p className="text-[10px] uppercase font-bold text-black/40 mb-1">Total Orders</p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{stats.orderCount}</span>
                  <History className="w-5 h-5 text-black/10" />
                </div>
              </div>
              <div className="card p-4 bg-white">
                <p className="text-[10px] uppercase font-bold text-black/40 mb-1">Tax Collected</p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalTax)}</span>
                  <DollarSign className="w-5 h-5 text-black/10" />
                </div>
              </div>
            </section>

            <ManualOrderForm 
              onSuccess={() => fetchOrders(1)} 
              onError={() => fetchFailedRequests()}
            />

            <div className="card p-6 bg-black text-white">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Compliance Status
              </h4>
              <p className="text-sm text-white/60 leading-relaxed">
                All orders are now being processed with New York State composite sales tax calculation. 
                Coordinates are mapped to jurisdictions including State, County, and MCTD districts.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/40 uppercase tracking-wider">System Status</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  OPERATIONAL
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setActiveTab('orders')}
                  className={`text-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'orders' ? 'text-black' : 'text-black/30 hover:text-black/60'}`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Recent Orders
                </button>
                <button 
                  onClick={() => setActiveTab('errors')}
                  className={`text-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'errors' ? 'text-red-600' : 'text-black/30 hover:text-black/60'}`}
                >
                  <AlertTriangle className="w-5 h-5" />
                  Error History
                </button>
              </div>
              
              {activeTab === 'orders' && (
                <div className="flex items-center gap-2">
                  <button 
                    disabled={pagination.page === 1}
                    onClick={() => fetchOrders(pagination.page - 1)}
                    className="p-2 hover:bg-black/5 rounded-lg disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button 
                    disabled={pagination.page === pagination.pages}
                    onClick={() => fetchOrders(pagination.page + 1)}
                    className="p-2 hover:bg-black/5 rounded-lg disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'orders' ? (
              <OrderTable orders={orders} loading={loading} />
            ) : (
              <FailedRequestsTable requests={failedRequests} loading={failedLoading} />
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-black/5 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-black/40">
            &copy; {new Date().getFullYear()} BetterMe Wellness. NY Tax Compliance Dashboard.
          </p>
          <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-black/30">
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Terms</a>
            <a href="#" className="hover:text-black transition-colors">Support</a>
          </div>
        </div>
      </footer>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onSuccess={() => {
          fetchOrders(1);
          fetchFailedRequests();
        }}
      />

      <AnimatePresence>
        {isClearHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsClearHistoryModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Clear History</h3>
                <p className="text-black/60 mb-6">
                  Are you sure you want to clear all order history and reset counters? This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setIsClearHistoryModalOpen(false)}
                    className="px-4 py-2 rounded-lg font-medium hover:bg-black/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmClearHistory}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Clear History
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
