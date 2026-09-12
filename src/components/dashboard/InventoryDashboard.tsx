import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { 
  Package, 
  ArrowLeftRight, 
  BarChart3, 
  AlertTriangle, 
  Plus, 
  ChevronRight, 
  Building2, 
  PieChart as PieChartIcon, 
  Layers,
  ArrowUpRight,
  TrendingDown,
  Warehouse,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { Timestamp } from 'firebase/firestore';
import { Item, Transaction, UserProfile, Supplier, PurchaseOrder, SupplierPayment } from '../../types';
import { Card, Button, Modal } from '../ui';
import { cn } from '../../lib/utils';

interface InventoryDashboardProps {
  items: Item[];
  transactions: Transaction[];
  totalTransactionsCount: number;
  userProfile: UserProfile;
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  supplierPayments?: SupplierPayment[];
  onNavigate?: (tab: string) => void;
  allowedPagesSet?: Set<string>;
  compact?: boolean;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({
  items = [],
  transactions = [],
  totalTransactionsCount,
  userProfile,
  suppliers = [],
  purchaseOrders = [],
  supplierPayments = [],
  onNavigate,
  allowedPagesSet,
  compact = false
}) => {
  const isAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com' || userProfile.email === 'rajon.estrims@gmail.com';
  const hasPageAccess = (pageId: string) => {
    if (isAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showRecentTxModal, setShowRecentTxModal] = useState(false);

  // Supplier Payables & Movement Calculation
  const supplierReport = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    let totalDueBalance = 0;
    let totalThisMonthPurchases = 0;
    let totalThisMonthPayments = 0;

    const perSupplierMap: Record<string, {
      id: string;
      name: string;
      totalDue: number;
      monthPurchases: number;
      monthPayments: number;
    }> = {};

    suppliers.forEach(s => {
      const ob = Number(s.openingBalance) || 0;
      perSupplierMap[s.id] = {
        id: s.id,
        name: s.name,
        totalDue: -ob,
        monthPurchases: 0,
        monthPayments: 0
      };
    });

    purchaseOrders.forEach(po => {
      const isDyeing = (po.purchaseType as string) === 'Dyeing' || po.poNumber?.toUpperCase().includes('DYE');
      if (!isDyeing && (po.status as string) !== 'deleted') {
        const amt = Number(po.totalAmount) || 0;
        if (perSupplierMap[po.supplierId]) {
          perSupplierMap[po.supplierId].totalDue -= amt;
        }
        const poDate = po.date instanceof Timestamp ? po.date.toDate() : new Date(po.date);
        if (isWithinInterval(poDate, { start: currentMonthStart, end: currentMonthEnd })) {
          totalThisMonthPurchases += amt;
          if (perSupplierMap[po.supplierId]) {
            perSupplierMap[po.supplierId].monthPurchases += amt;
          }
        }
      }
    });

    supplierPayments.forEach(pm => {
      const amt = Number(pm.amount) || 0;
      if (perSupplierMap[pm.supplierId]) {
        perSupplierMap[pm.supplierId].totalDue += amt;
      }
      const pmDate = pm.paymentDate instanceof Timestamp ? pm.paymentDate.toDate() : new Date(pm.paymentDate);
      if (isWithinInterval(pmDate, { start: currentMonthStart, end: currentMonthEnd })) {
        totalThisMonthPayments += amt;
        if (perSupplierMap[pm.supplierId]) {
          perSupplierMap[pm.supplierId].monthPayments += amt;
        }
      }
    });

    Object.values(perSupplierMap).forEach(s => {
      if (s.totalDue < 0) {
        totalDueBalance += Math.abs(s.totalDue);
      }
    });

    const list = Object.values(perSupplierMap).sort((a, b) => a.totalDue - b.totalDue);

    return {
      totalDueBalance,
      totalThisMonthPurchases,
      totalThisMonthPayments,
      netMonthChange: totalThisMonthPurchases - totalThisMonthPayments,
      list
    };
  }, [suppliers, purchaseOrders, supplierPayments]);

  const supplierChartData = useMemo(() => {
    return supplierReport.list.slice(0, 6).map(s => ({
      shortName: s.name.length > 10 ? s.name.substring(0, 8) + '..' : s.name,
      fullName: s.name,
      'Net Due': s.totalDue < 0 ? Math.abs(s.totalDue) : 0,
      'Purchases': s.monthPurchases,
      'Payments': s.monthPayments,
    }));
  }, [supplierReport.list]);

  const stats = useMemo(() => {
    const activeItems = items.filter(i => i.status !== 'pending_delete');
    const activeTransactions = transactions.filter(tx => tx.status !== 'pending_delete');
    
    const totalItems = activeItems.length;
    const totalStockValue = activeItems.reduce((acc, item) => acc + (Number(item.totalValue) || 0), 0);
    const totalTransactions = totalTransactionsCount || activeTransactions.length;

    const lowStockList = activeItems.filter(item => {
      const stock = Number(item.currentStock) || 0;
      const min = Number(item.minStock) || 0;
      return min > 0 && stock <= min;
    });

    const recentTransactions = [...activeTransactions]
      .sort((a, b) => b.date?.toMillis ? b.date.toMillis() - (a.date?.toMillis ? a.date.toMillis() : 0) : 0)
      .slice(0, 5);

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const getMonthlyStats = (start: Date, end: Date) => {
      return activeTransactions.filter(tx => {
        const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        return (tx.status as string) !== 'deleted' && isWithinInterval(txDate, { start, end });
      }).reduce((acc, tx) => {
        const type = (tx.type || '').toUpperCase();
        const value = (Number(tx.quantity) || 0) * (Number(tx.price) || 0);
        if (type === 'IN' || type === 'PRODUCTION_RETURN') {
          acc.in += value;
        } else if (type === 'OUT' || type === 'SALE' || type === 'PRODUCTION' || type === 'EXTRA_REQUISITION') {
          acc.out += value;
        }
        return acc;
      }, { in: 0, out: 0 });
    };

    const currentStats = getMonthlyStats(currentMonthStart, currentMonthEnd);
    const prevStats = getMonthlyStats(prevMonthStart, prevMonthEnd);

    const chartData = [
      {
        name: format(prevMonthStart, 'MMM yyyy'),
        IN: prevStats.in,
        ISSUE: prevStats.out,
      },
      {
        name: format(currentMonthStart, 'MMM yyyy'),
        IN: currentStats.in,
        ISSUE: currentStats.out,
      }
    ];

    const issueBreakdown = activeTransactions.filter(tx => {
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      const type = (tx.type || '').toUpperCase();
      return (tx.status as string) !== 'deleted' && 
             isWithinInterval(txDate, { start: currentMonthStart, end: currentMonthEnd }) && 
             ['OUT', 'SALE', 'PRODUCTION', 'EXTRA_REQUISITION'].includes(type);
    }).reduce((acc, tx) => {
      const type = (tx.type || '').toUpperCase();
      const value = (Number(tx.quantity) || 0) * (Number(tx.price) || 0);
      const label = (type === 'OUT' || type === 'SALE') ? 'SALES' : type.replace(/_/g, ' ');
      
      const existing = acc.find(item => item.name === label);
      if (existing) {
        existing.value += value;
      } else {
        acc.push({ name: label, value });
      }
      return acc;
    }, [] as { name: string; value: number }[]);

    const purchaseBreakdown = activeTransactions.filter(tx => {
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      const type = (tx.type || '').toUpperCase();
      return (tx.status as string) !== 'deleted' && 
             isWithinInterval(txDate, { start: currentMonthStart, end: currentMonthEnd }) && 
             type === 'IN';
    }).reduce((acc, tx) => {
      const source = tx.purchaseType || 'Local';
      const value = (Number(tx.quantity) || 0) * (Number(tx.price) || 0);
      
      const existing = acc.find(item => item.name === source);
      if (existing) {
        existing.value += value;
      } else {
        acc.push({ name: source, value });
      }
      return acc;
    }, [] as { name: string; value: number }[]);

    return {
      totalItems,
      totalTransactions,
      totalStockValue,
      lowStockList,
      recentTransactions,
      chartData,
      issueBreakdown,
      purchaseBreakdown
    };
  }, [items, transactions, totalTransactionsCount]);

  return (
    <div className="space-y-5">
      {/* Module Header Bar if standalone */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Inventory & Store Operations</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Store
              </span>
            </div>
            <p className="text-xs text-slate-500">Real-time raw material valuation, stock movement & inward-outward logs</p>
          </div>
        </div>

        {onNavigate && (hasPageAccess('inventory') || hasPageAccess('transactions')) && (
          <div className="flex items-center gap-2">
            {hasPageAccess('inventory') && (
              <button
                onClick={() => onNavigate('inventory')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <span>Item Catalog</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPageAccess('transactions') && (
              <button
                onClick={() => onNavigate('transactions')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Stock Transactions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 Core Inventory KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Catalog Items</span>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-slate-900 tracking-tight">{stats.totalItems} Items</h4>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Across active raw material categories</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stock Valuation</span>
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-emerald-950 tracking-tight">
            BDT {stats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </h4>
          <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Real-time store closing value</p>
        </div>

        <div 
          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all cursor-pointer"
          onClick={() => setShowLowStockModal(true)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Low Stock Alerts</span>
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-amber-900 tracking-tight">{stats.lowStockList.length} Items</h4>
          <p className="text-[11px] text-amber-700 mt-0.5 font-medium flex items-center gap-1">
            <span>At/below safety threshold</span>
            <ChevronRight className="w-3 h-3" />
          </p>
        </div>

        <div 
          className={cn(
            "bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs transition-all",
            hasPageAccess('supplier-report') && onNavigate ? "hover:border-purple-300 cursor-pointer" : ""
          )}
          onClick={() => {
            if (hasPageAccess('supplier-report') && onNavigate) {
              onNavigate('supplier-report');
            }
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Supplier Payable Due</span>
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-purple-950 tracking-tight">
            BDT {supplierReport.totalDueBalance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </h4>
          <p className="text-[11px] text-purple-700 mt-0.5 font-medium flex items-center gap-1">
            <span>+Tk{supplierReport.totalThisMonthPurchases.toLocaleString()} POs this month</span>
          </p>
        </div>
      </div>

      {/* Charts Section: Movement Comparison & Issue/Source Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Inventory Movement Comparison</h4>
              <p className="text-xs text-slate-500">Inward Purchase Value vs Outward Issue Value</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                <span className="text-slate-600">Stock IN</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                <span className="text-slate-600">Issue OUT</span>
              </div>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(val) => `Tk ${(val / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  formatter={(value: any) => [`BDT ${Number(value).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="IN" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
                <Bar dataKey="ISSUE" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issue & Purchase Breakdown Pies */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Current Month Issue & Source</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {format(new Date(), 'MMMM')}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Issue Distribution</p>
                <div className="h-28 w-full">
                  {stats.issueBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.issueBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={32}
                          outerRadius={48}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {stats.issueBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => [`BDT ${Number(val).toLocaleString()}`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                      No issue activity this month
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Local Purchases: </span>
                  <span className="font-bold text-slate-800">
                    BDT {(stats.purchaseBreakdown.find(p => p.name === 'Local')?.value || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Bond: </span>
                  <span className="font-bold text-slate-800">
                    BDT {(stats.purchaseBreakdown.find(p => p.name === 'Bond')?.value || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Low Stock Count</span>
            <span className={cn("font-bold px-2 py-0.5 rounded-full text-[11px]", stats.lowStockList.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
              {stats.lowStockList.length > 0 ? `${stats.lowStockList.length} items to reorder` : 'All stocks safe'}
            </span>
          </div>
        </div>
      </div>

      {/* Supplier Movement & Recent Transactions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Supplier Dues Histogram */}
        {supplierChartData.length > 0 ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Supplier Dues & Monthly Movement</h4>
                <p className="text-xs text-slate-500">Top accounts payable balances</p>
              </div>
              {onNavigate && hasPageAccess('supplier-report') && (
                <button 
                  onClick={() => onNavigate('supplier-report')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>All Suppliers</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `Tk${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: any) => [`BDT ${Number(val).toLocaleString()}`, '']} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                  <Bar dataKey="Net Due" fill="#8b5cf6" name="Outstanding Due" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Purchases" fill="#f59e0b" name="This Month POs" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Payments" fill="#10b981" name="Paid Out" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-center text-xs text-slate-400 italic">
            No supplier payable records found
          </div>
        )}

        {/* Recent Transactions List */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Recent Stock Activity</h4>
              <p className="text-xs text-slate-500">Inward & outward transactions</p>
            </div>
            <button 
              onClick={() => setShowRecentTxModal(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View Log
            </button>
          </div>

          <div className="space-y-2.5">
            {stats.recentTransactions.map((tx) => {
              const item = items.find(i => i.id === tx.itemId);
              const isPositive = ['IN', 'PRODUCTION_RETURN'].includes(tx.type);
              const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
              return (
                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/70 hover:bg-slate-100/80 transition-colors border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                      isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {isPositive ? '+' : '-'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{item?.name || 'Stock Item'}</p>
                      <p className="text-[10px] text-slate-400">{format(txDate, 'MMM dd, hh:mm a')} • {tx.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-bold", isPositive ? "text-emerald-600" : "text-rose-600")}>
                      {isPositive ? '+' : '-'}{tx.quantity} {item?.unit || 'pcs'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">BDT {(Number(tx.quantity) * Number(tx.price)).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
            {stats.recentTransactions.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 italic">No stock transactions recorded.</div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock All Items Modal */}
      <Modal 
        isOpen={showLowStockModal} 
        onClose={() => setShowLowStockModal(false)} 
        title="Low Stock Reorder Alerts"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {stats.lowStockList.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border border-amber-200 bg-amber-50/60 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{item.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">SKU: {item.sku}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-amber-700">{item.currentStock} {item.unit}</p>
                <p className="text-[10px] text-slate-500 font-semibold">Min: {item.minStock} {item.unit}</p>
              </div>
            </div>
          ))}
          {stats.lowStockList.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400 italic">All items are at healthy inventory levels.</div>
          )}
        </div>
        <div className="mt-4">
          <Button variant="secondary" className="w-full text-xs" onClick={() => setShowLowStockModal(false)}>Close</Button>
        </div>
      </Modal>

      {/* Recent Transactions All Modal */}
      <Modal 
        isOpen={showRecentTxModal} 
        onClose={() => setShowRecentTxModal(false)} 
        title="Recent Activity Log"
      >
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {transactions.filter(tx => tx.status !== 'pending_delete').slice(0, 25).map((tx) => {
            const item = items.find(i => i.id === tx.itemId);
            const isPositive = ['IN', 'PRODUCTION_RETURN'].includes(tx.type);
            const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
            return (
              <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-6 h-6 rounded flex items-center justify-center font-bold", isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                    {isPositive ? '+' : '-'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{item?.name || 'Item'}</p>
                    <p className="text-[10px] text-slate-400">{format(txDate, 'MMM dd, yyyy hh:mm a')} • {tx.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn("font-bold", isPositive ? "text-emerald-600" : "text-rose-600")}>
                    {isPositive ? '+' : '-'}{tx.quantity} {item?.unit || 'pcs'}
                  </span>
                  <p className="text-[10px] text-slate-400">BDT {(Number(tx.quantity) * Number(tx.price)).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Button variant="secondary" className="w-full text-xs" onClick={() => setShowRecentTxModal(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
};
