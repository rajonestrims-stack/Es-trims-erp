import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Coins, 
  Receipt, 
  CreditCard, 
  Building, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ChevronRight, 
  FileText, 
  ArrowUpRight, 
  Landmark,
  PiggyBank,
  DollarSign,
  AlertCircle,
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
import { UserProfile, Supplier, PurchaseOrder, SupplierPayment } from '../../types';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { cn } from '../../lib/utils';

interface AccountsFinanceDashboardProps {
  userProfile: UserProfile;
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  supplierPayments?: SupplierPayment[];
  onNavigate?: (tab: string) => void;
  allowedPagesSet?: Set<string>;
  compact?: boolean;
}

export const AccountsFinanceDashboard: React.FC<AccountsFinanceDashboardProps> = ({
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
    if (pageId === 'finance-billing') {
      return allowedPagesSet.has('finance-billing') || allowedPagesSet.has('accounts-finance') || allowedPagesSet.has('accounts');
    }
    if (pageId === 'accounts-journal') {
      return allowedPagesSet.has('accounts-journal') || allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance');
    }
    if (pageId === 'finance-bill-list') {
      return allowedPagesSet.has('finance-bill-list') || allowedPagesSet.has('accounts-finance') || allowedPagesSet.has('accounts');
    }
    return allowedPagesSet.has(pageId);
  };

  const [bills, setBills] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const businessId = userProfile?.businessId || 'default-business';

  useEffect(() => {
    if (!businessId) return;

    const qBills = query(collection(db, 'customer_bills'), where('businessId', '==', businessId));
    const qLoans = query(collection(db, 'bank_loans'), where('businessId', '==', businessId));

    const unsubBills = onSnapshot(
      qBills, 
      (snap) => {
        setBills(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.warn('Bills snapshot listener notice:', error.message);
        setLoading(false);
      }
    );

    const unsubLoans = onSnapshot(
      qLoans, 
      (snap) => {
        setLoans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.warn('Bank loans snapshot listener notice:', error.message);
      }
    );

    return () => {
      unsubBills();
      unsubLoans();
    };
  }, [businessId]);

  // Supplier Payables Calculation
  const supplierPayableBalance = useMemo(() => {
    let totalDue = 0;
    const perSupplier: Record<string, number> = {};

    suppliers.forEach(s => {
      const ob = Number(s.openingBalance) || 0;
      perSupplier[s.id] = -ob;
    });

    purchaseOrders.forEach(po => {
      if ((po.status as string) !== 'deleted') {
        const amt = Number(po.totalAmount) || 0;
        if (perSupplier[po.supplierId] !== undefined) {
          perSupplier[po.supplierId] -= amt;
        } else {
          perSupplier[po.supplierId] = -amt;
        }
      }
    });

    supplierPayments.forEach(pm => {
      const amt = Number(pm.amount) || 0;
      if (perSupplier[pm.supplierId] !== undefined) {
        perSupplier[pm.supplierId] += amt;
      } else {
        perSupplier[pm.supplierId] = amt;
      }
    });

    Object.values(perSupplier).forEach(bal => {
      if (bal < 0) totalDue += Math.abs(bal);
    });

    return totalDue;
  }, [suppliers, purchaseOrders, supplierPayments]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    let totalInvoicedBDT = 0;
    let totalCustomerReceivableBDT = 0;
    let totalCollectedBDT = 0;
    let thisMonthBillingBDT = 0;
    let thisMonthCollectedBDT = 0;

    const monthlyBillingMap: Record<string, { month: string; billed: number; collected: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, 'MMM yyyy');
      monthlyBillingMap[key] = { month: key, billed: 0, collected: 0 };
    }

    bills.forEach(bill => {
      const gTotal = Number(bill.grandTotal) || Number(bill.totalAmount) || 0;
      const paid = Number(bill.paidAmount) || 0;
      const due = Number(bill.dueAmount) || (gTotal - paid);

      totalInvoicedBDT += gTotal;
      totalCollectedBDT += paid;
      totalCustomerReceivableBDT += due > 0 ? due : 0;

      let bDate = new Date();
      if (bill.billDate instanceof Timestamp) bDate = bill.billDate.toDate();
      else if (bill.createdAt instanceof Timestamp) bDate = bill.createdAt.toDate();
      else if (bill.billDate) bDate = new Date(bill.billDate);

      if (isWithinInterval(bDate, { start: currentMonthStart, end: currentMonthEnd })) {
        thisMonthBillingBDT += gTotal;
        thisMonthCollectedBDT += paid;
      }

      const monthKey = format(bDate, 'MMM yyyy');
      if (monthlyBillingMap[monthKey]) {
        monthlyBillingMap[monthKey].billed += gTotal;
        monthlyBillingMap[monthKey].collected += paid;
      }
    });

    // Bank Loans exposure
    let totalLoanDisbursed = 0;
    let totalLoanOutstanding = 0;
    loans.forEach(loan => {
      const principal = Number(loan.loanAmount) || Number(loan.sanctionAmount) || 0;
      const repaid = Number(loan.repaidAmount) || Number(loan.totalRepaid) || 0;
      totalLoanDisbursed += principal;
      totalLoanOutstanding += Math.max(0, principal - repaid);
    });

    const monthlyChartData = Object.values(monthlyBillingMap);

    const receivableAgingData = [
      { name: 'Collected', value: totalCollectedBDT, fill: '#10b981' },
      { name: 'Receivable Due', value: totalCustomerReceivableBDT, fill: '#f59e0b' }
    ];

    const recentBills = [...bills]
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.billDate ? new Date(a.billDate).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.billDate ? new Date(b.billDate).getTime() : 0);
        return timeB - timeA;
      })
      .slice(0, 5);

    return {
      totalInvoicedBDT,
      totalCustomerReceivableBDT,
      totalCollectedBDT,
      thisMonthBillingBDT,
      thisMonthCollectedBDT,
      totalLoanDisbursed,
      totalLoanOutstanding,
      monthlyChartData,
      receivableAgingData,
      recentBills
    };
  }, [bills, loans]);

  return (
    <div className="space-y-5">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Accounts & Financial Intelligence</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Financial KPIs
              </span>
            </div>
            <p className="text-xs text-slate-500">Commercial billings, customer receivables, supplier payables & loan liability tracking</p>
          </div>
        </div>

        {onNavigate && (hasPageAccess('finance-billing') || hasPageAccess('accounts-journal')) && (
          <div className="flex items-center gap-2">
            {hasPageAccess('finance-billing') && (
              <button
                onClick={() => onNavigate('finance-billing')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <span>Create Bill</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPageAccess('accounts-journal') && (
              <button
                onClick={() => onNavigate('accounts-journal')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Journal Entries</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 Core Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales Invoiced</span>
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-slate-900 tracking-tight">
            BDT {stats.totalInvoicedBDT.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h4>
          <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
            +Tk{stats.thisMonthBillingBDT.toLocaleString()} billed in {format(new Date(), 'MMMM')}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer Receivables</span>
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-amber-950 tracking-tight">
            BDT {stats.totalCustomerReceivableBDT.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h4>
          <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
            Total unpaid customer balances
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Supplier Payables Due</span>
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-purple-950 tracking-tight">
            BDT {supplierPayableBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h4>
          <p className="text-[11px] text-purple-700 mt-0.5 font-medium">
            Accounts payable liability
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bank Loan Exposure</span>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-blue-950 tracking-tight">
            BDT {stats.totalLoanOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h4>
          <p className="text-[11px] text-blue-600 mt-0.5 font-medium">
            UPAS / LTR / Term loan outstanding
          </p>
        </div>
      </div>

      {/* Charts Section: Billing vs Collection Velocity & Collection Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Commercial Billing & Collection Trend</h4>
              <p className="text-xs text-slate-500">Invoiced value vs received customer payments</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                <span className="text-slate-600">Invoiced</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                <span className="text-slate-600">Collected</span>
              </div>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
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
                <Bar dataKey="billed" fill="#f59e0b" name="Invoiced" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="collected" fill="#10b981" name="Collected" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collection Share Pie */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Receivables Status</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                All-time
              </span>
            </div>

            <div className="h-44 w-full flex items-center justify-center">
              {stats.totalInvoicedBDT > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.receivableAgingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {stats.receivableAgingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`BDT ${Number(val).toLocaleString()}`, '']} />
                    <Legend 
                      wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                      formatter={(name) => <span className="text-[11px] font-medium text-slate-600">{name}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  No commercial bills issued yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Recovery Rate</span>
            <span className="font-bold text-emerald-700">
              {stats.totalInvoicedBDT > 0 ? ((stats.totalCollectedBDT / stats.totalInvoicedBDT) * 100).toFixed(1) : '100'}%
            </span>
          </div>
        </div>
      </div>

      {/* Recent Bills Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Recent Commercial Invoices</h4>
            <p className="text-xs text-slate-500">Live bill register</p>
          </div>
          {onNavigate && hasPageAccess('finance-bill-list') && (
            <button 
              onClick={() => onNavigate('finance-bill-list')}
              className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
            >
              <span>Bill Register</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Bill No</th>
                <th className="py-2.5 px-3">Customer Account</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Due Status</th>
                <th className="py-2.5 px-3 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentBills.map(bill => {
                let bDate = '-';
                if (bill.billDate instanceof Timestamp) bDate = format(bill.billDate.toDate(), 'dd MMM yyyy');
                else if (bill.billDate) bDate = format(new Date(bill.billDate), 'dd MMM yyyy');

                const gTotal = Number(bill.grandTotal) || Number(bill.totalAmount) || 0;
                const paid = Number(bill.paidAmount) || 0;
                const due = Number(bill.dueAmount) || (gTotal - paid);

                return (
                  <tr key={bill.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {bill.billNo || 'BILL-#'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {bill.customerName || 'Direct Customer'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-medium">{bDate}</td>
                    <td className="py-2.5 px-3">
                      {due <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Due: BDT {due.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      BDT {gTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {stats.recentBills.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400 italic">
                    No commercial bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
