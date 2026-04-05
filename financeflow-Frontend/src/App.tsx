import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  LogOut, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Filter,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  ChevronRight,
  Search,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

// --- Types ---

type Role = 'admin' | 'analyst' | 'viewer';
type TransactionType = 'income' | 'expense';

interface User {
  id: number;
  username: string;
  role: Role;
}

interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
  created_at: string;
}

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  categoryWise: { category: string; total: number; type: TransactionType }[];
  recentActivity: Transaction[];
}

// --- API Service ---

const API = {
  token: localStorage.getItem('token'),
  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  },
  async request(path: string, options: RequestInit = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Something went wrong');
    }
    return res.json();
  }
};

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  };
  return (
    <button 
      className={cn("px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2", variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
    {...props}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
    {...props}
  />
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'transactions' | 'users'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ type: '', category: '', startDate: '', endDate: '' });

  // UI States
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && API.token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      if (view === 'transactions') fetchTransactions();
      if (view === 'users' && user.role === 'admin') fetchUsers();
    }
  }, [user, view, filters]);

  const fetchDashboardData = async () => {
    try {
      const data = await API.request('/api/summary');
      setSummary(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTransactions = async () => {
    try {
      const query = new URLSearchParams(filters).toString();
      const data = await API.request(`/api/transactions?${query}`);
      setTransactions(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await API.request('/api/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      setError(null);
      const data = await API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      API.setToken(data.token);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    API.setToken(null);
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleSaveTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      amount: Number(formData.get('amount')),
      type: formData.get('type') as TransactionType,
      category: formData.get('category') as string,
      date: formData.get('date') as string,
      description: formData.get('description') as string,
    };

    try {
      if (editingTx) {
        await API.request(`/api/transactions/${editingTx.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } else {
        await API.request('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      }
      setIsTxModalOpen(false);
      setEditingTx(null);
      fetchDashboardData();
      fetchTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await API.request(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchDashboardData();
      fetchTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleUserStatus = async (id: number, currentStatus: string) => {
    try {
      await API.request(`/api/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: currentStatus === 'active' ? 'inactive' : 'active' }),
      });
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <Wallet className="text-white w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">FinanceFlow</h1>
              <p className="text-slate-500 mt-2">Sign in to your dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <Input name="username" placeholder="admin, analyst, or viewer" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <Input name="password" type="password" placeholder="••••••••" required />
              </div>
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full py-3">Sign In</Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Demo Credentials</p>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="block font-bold text-slate-700">admin</span>
                  <span className="text-slate-400">admin123</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="block font-bold text-slate-700">analyst</span>
                  <span className="text-slate-400">analyst123</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="block font-bold text-slate-700">viewer</span>
                  <span className="text-slate-400">viewer123</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
            <Wallet className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-slate-900">FinanceFlow</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <button 
            onClick={() => setView('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              view === 'dashboard' ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => setView('transactions')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              view === 'transactions' ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Receipt size={20} />
            Transactions
          </button>
          {user.role === 'admin' && (
            <button 
              onClick={() => setView('users')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                view === 'users' ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Users size={20} />
              User Management
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user.username}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{user.role}</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600" onClick={handleLogout}>
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 capitalize">{view}</h2>
          <div className="flex items-center gap-4">
            {user.role !== 'viewer' && (
              <Button onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}>
                <Plus size={18} />
                New Transaction
              </Button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {view === 'dashboard' && summary && (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                      <TrendingUp size={24} />
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Total Income</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-1">${summary.totalIncome.toLocaleString()}</h3>
                </Card>
                <Card className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                      <TrendingDown size={24} />
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Total Expenses</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-1">${summary.totalExpenses.toLocaleString()}</h3>
                </Card>
                <Card className="p-6 bg-indigo-600 text-white border-none shadow-indigo-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-white/20 text-white rounded-xl">
                      <Wallet size={24} />
                    </div>
                  </div>
                  <p className="text-white/70 text-sm font-medium">Net Balance</p>
                  <h3 className="text-3xl font-bold mt-1">${summary.netBalance.toLocaleString()}</h3>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <Card>
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Recent Activity</h3>
                    <Button variant="ghost" className="text-xs" onClick={() => setView('transactions')}>View All</Button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {summary.recentActivity.map(tx => (
                      <div key={tx.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          tx.type === 'income' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        )}>
                          {tx.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{tx.description || tx.category}</p>
                          <p className="text-xs text-slate-400">{format(new Date(tx.date), 'MMM dd, yyyy')}</p>
                        </div>
                        <div className={cn("text-sm font-bold", tx.type === 'income' ? "text-green-600" : "text-red-600")}>
                          {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Category Breakdown */}
                <Card>
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900">Category Breakdown</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {summary.categoryWise.map((cat, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 font-medium">{cat.category}</span>
                          <span className="text-slate-900 font-bold">${cat.total.toLocaleString()}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full", cat.type === 'income' ? "bg-green-500" : "bg-red-500")}
                            style={{ width: `${Math.min((cat.total / Math.max(summary.totalIncome, summary.totalExpenses)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {view === 'transactions' && (
            <div className="space-y-6">
              {/* Filters */}
              <Card className="p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type</label>
                  <Select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                    <option value="">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                  <Input 
                    placeholder="Search category..." 
                    value={filters.category} 
                    onChange={e => setFilters({ ...filters, category: e.target.value })} 
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Start Date</label>
                  <Input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">End Date</label>
                  <Input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
                </div>
                <Button variant="secondary" onClick={() => setFilters({ type: '', category: '', startDate: '', endDate: '' })}>
                  Reset
                </Button>
              </Card>

              {/* Transactions Table */}
              <Card className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Description</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Category</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Amount</th>
                      {user.role !== 'viewer' && <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(tx.date), 'MMM dd, yyyy')}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">{tx.description || '-'}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                            tx.type === 'income' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={cn("px-6 py-4 text-sm font-bold text-right", tx.type === 'income' ? "text-green-600" : "text-red-600")}>
                          {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                        </td>
                        {user.role !== 'viewer' && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user.role === 'admin' && (
                                <>
                                  <button 
                                    onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {transactions.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    <Receipt size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No transactions found matching your filters.</p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {view === 'users' && user.role === 'admin' && (
            <div className="space-y-6">
              <Card>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">User</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Role</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Joined</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                              {u.username[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{u.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600 capitalize">{u.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit",
                            u.status === 'active' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {u.status === 'active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            {u.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{format(new Date(u.created_at), 'MMM dd, yyyy')}</td>
                        <td className="px-6 py-4 text-right">
                          {u.username !== 'admin' && (
                            <Button 
                              variant="secondary" 
                              className="text-xs"
                              onClick={() => toggleUserStatus(u.id, u.status)}
                            >
                              {u.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Transaction Modal */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTxModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg"
            >
              <Card className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">{editingTx ? 'Edit Transaction' : 'New Transaction'}</h3>
                  <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <XCircle size={24} />
                  </button>
                </div>

                <form onSubmit={handleSaveTransaction} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                      <Input name="amount" type="number" step="0.01" defaultValue={editingTx?.amount} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <Select name="type" defaultValue={editingTx?.type || 'expense'}>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <Input name="category" placeholder="e.g. Salary, Food, Rent" defaultValue={editingTx?.category} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <Input name="date" type="date" defaultValue={editingTx?.date || format(new Date(), 'yyyy-MM-dd')} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <Input name="description" placeholder="Optional notes..." defaultValue={editingTx?.description} />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsTxModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Save Transaction</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
