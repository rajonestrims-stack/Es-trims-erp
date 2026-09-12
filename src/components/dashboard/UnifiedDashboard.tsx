import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, 
  Factory, 
  Package, 
  Coins, 
  LayoutDashboard, 
  Sparkles, 
  RefreshCw, 
  Calendar, 
  Layers, 
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Building2,
  TrendingUp,
  AlertTriangle,
  Receipt,
  Cpu,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { Item, Transaction, UserProfile, Supplier, PurchaseOrder, SupplierPayment } from '../../types';
import { SalesDashboard } from './SalesDashboard';
import { ProductionDashboard } from './ProductionDashboard';
import { InventoryDashboard } from './InventoryDashboard';
import { AccountsFinanceDashboard } from './AccountsFinanceDashboard';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

interface UnifiedDashboardProps {
  items: Item[];
  transactions: Transaction[];
  totalTransactionsCount: number;
  userProfile: UserProfile;
  allowedPagesSet?: Set<string>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  syncAllData: () => Promise<void>;
  isSyncing: boolean;
  cleanupSKURange: () => Promise<void>;
  backupDataToJSON: () => Promise<void>;
  exportUserProfileToCSV: () => void;
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  supplierPayments?: SupplierPayment[];
  onNavigate: (tab: string) => void;
}

export type DashboardTab = 'all' | 'sales' | 'production' | 'inventory' | 'accounts';

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  items = [],
  transactions = [],
  totalTransactionsCount,
  userProfile,
  allowedPagesSet = new Set(),
  showToast,
  syncAllData,
  isSyncing,
  cleanupSKURange,
  backupDataToJSON,
  exportUserProfileToCSV,
  suppliers = [],
  purchaseOrders = [],
  supplierPayments = [],
  onNavigate
}) => {
  const isAdmin = useMemo(() => {
    const role = userProfile?.role?.toLowerCase() || '';
    return role.includes('admin') || role.includes('owner') || role.includes('md') || role.includes('gm') || userProfile?.email === 'rajonpaul300@gmail.com';
  }, [userProfile]);

  // Determine permissions for the 4 core business pillars + Executive overview
  const permissions = useMemo(() => {
    const isSuper = isAdmin;

    // Check if user has explicit dashboard keys or custom permission matrix configured
    const hasExplicitDashboard = 
      allowedPagesSet.has('dashboard-sales') ||
      allowedPagesSet.has('dashboard-production') ||
      allowedPagesSet.has('dashboard-inventory') ||
      allowedPagesSet.has('dashboard-accounts') ||
      allowedPagesSet.has('dashboard-executive') ||
      allowedPagesSet.has('sales-dashboard') ||
      allowedPagesSet.has('production-dashboard') ||
      allowedPagesSet.has('inventory-dashboard') ||
      allowedPagesSet.has('accounts-dashboard');

    const hasConfiguredPermissions = Boolean(
      (userProfile?.customPermissions && Object.keys(userProfile.customPermissions).length > 0) ||
      (userProfile?.allowedPages && userProfile.allowedPages.length > 0)
    );

    // 1. Sales & Marketing Dashboard
    const canSales = isSuper || 
      allowedPagesSet.has('dashboard-sales') || 
      allowedPagesSet.has('sales-dashboard') || 
      (!hasExplicitDashboard && !hasConfiguredPermissions && (
        allowedPagesSet.has('sales') || 
        allowedPagesSet.has('sales-order-entry') || 
        allowedPagesSet.has('sales-create-order') || 
        allowedPagesSet.has('sales-order-list') || 
        allowedPagesSet.has('sales-booking-report') || 
        allowedPagesSet.has('sales-sales-report') ||
        allowedPagesSet.has('sales-mrr-receipt')
      ));

    // 2. Production Management Dashboard
    const canProduction = isSuper || 
      allowedPagesSet.has('dashboard-production') || 
      allowedPagesSet.has('production-dashboard') || 
      (!hasExplicitDashboard && !hasConfiguredPermissions && (
        allowedPagesSet.has('production') || 
        allowedPagesSet.has('production-management') || 
        allowedPagesSet.has('production-update') || 
        allowedPagesSet.has('production-bom') || 
        allowedPagesSet.has('production-status') || 
        allowedPagesSet.has('production-details') || 
        allowedPagesSet.has('production-requisition')
      ));

    // 3. Store & Inventory Dashboard
    const canInventory = isSuper || 
      allowedPagesSet.has('dashboard-inventory') || 
      allowedPagesSet.has('inventory-dashboard') || 
      (!hasExplicitDashboard && !hasConfiguredPermissions && (
        allowedPagesSet.has('inventory') || 
        allowedPagesSet.has('inventory-requisition') || 
        allowedPagesSet.has('transactions') || 
        allowedPagesSet.has('ledger') || 
        allowedPagesSet.has('ledger-summary') || 
        allowedPagesSet.has('issue-analysis') || 
        allowedPagesSet.has('reports') || 
        allowedPagesSet.has('calculators') || 
        allowedPagesSet.has('dyeing') || 
        allowedPagesSet.has('procurement') || 
        allowedPagesSet.has('suppliers')
      ));

    // 4. Accounts & Finance Dashboard
    const canAccounts = isSuper || 
      allowedPagesSet.has('dashboard-accounts') || 
      allowedPagesSet.has('accounts-dashboard') || 
      (!hasExplicitDashboard && !hasConfiguredPermissions && (
        allowedPagesSet.has('accounts') || 
        allowedPagesSet.has('accounts-finance') || 
        allowedPagesSet.has('accounts-coa') || 
        allowedPagesSet.has('accounts-journal') || 
        allowedPagesSet.has('accounts-cash-bank') || 
        allowedPagesSet.has('accounts-receivable') || 
        allowedPagesSet.has('accounts-payable') || 
        allowedPagesSet.has('accounts-sales') || 
        allowedPagesSet.has('accounts-fixed-assets') || 
        allowedPagesSet.has('accounts-financial-reports') || 
        allowedPagesSet.has('finance-billing') || 
        allowedPagesSet.has('finance-bill-list') || 
        allowedPagesSet.has('finance-mrr-tracker') || 
        allowedPagesSet.has('commercial-pi') || 
        allowedPagesSet.has('supplier-ledger') || 
        allowedPagesSet.has('supplier-payment') || 
        allowedPagesSet.has('supplier-report') || 
        allowedPagesSet.has('bank-loans')
      ));

    // 5. Executive / All Overview Dashboard
    const canExecutive = isSuper || 
      allowedPagesSet.has('dashboard-executive') ||
      (allowedPagesSet.has('dashboard') && (!hasExplicitDashboard && !hasConfiguredPermissions));

    const accessibleList: { id: DashboardTab; label: string; icon: any; color: string; badge: string }[] = [];
    if (canSales) accessibleList.push({ id: 'sales', label: 'Sales & Orders', icon: ShoppingBag, color: 'text-blue-600', badge: 'Sales' });
    if (canProduction) accessibleList.push({ id: 'production', label: 'Production & Floor', icon: Factory, color: 'text-indigo-600', badge: 'Production' });
    if (canInventory) accessibleList.push({ id: 'inventory', label: 'Inventory & Store', icon: Package, color: 'text-emerald-600', badge: 'Inventory' });
    if (canAccounts) accessibleList.push({ id: 'accounts', label: 'Accounts & Finance', icon: Coins, color: 'text-amber-600', badge: 'Accounts' });

    return {
      canSales,
      canProduction,
      canInventory,
      canAccounts,
      canExecutive,
      accessibleList,
      count: accessibleList.length
    };
  }, [isAdmin, allowedPagesSet, userProfile]);

  // Active sub-tab state inside dashboard
  const [activeSubTab, setActiveSubTab] = useState<DashboardTab>(() => {
    if (permissions.canExecutive && permissions.count > 1) return 'all';
    if (permissions.accessibleList.length > 0) return permissions.accessibleList[0].id;
    return 'all';
  });

  // If user only has access to one module, or current activeSubTab is unauthorized, default accordingly
  useEffect(() => {
    if (permissions.count === 0) {
      return;
    }
    if (permissions.count === 1) {
      setActiveSubTab(permissions.accessibleList[0].id);
    } else if (!permissions.canExecutive && activeSubTab === 'all') {
      setActiveSubTab(permissions.accessibleList[0].id);
    } else if (activeSubTab !== 'all') {
      const isAllowed = permissions.accessibleList.some(item => item.id === activeSubTab);
      if (!isAllowed) {
        setActiveSubTab(permissions.canExecutive ? 'all' : permissions.accessibleList[0].id);
      }
    }
  }, [permissions, activeSubTab]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Multi-Module Command Header */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Enterprise ERP Hub
            </span>
            <span className="text-xs text-slate-400 font-medium">| {format(new Date(), 'EEEE, dd MMMM yyyy')}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
              {userProfile?.role || 'User'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            {permissions.count === 1 && !permissions.canExecutive
              ? `${permissions.accessibleList[0].label} Dashboard`
              : 'Operational Executive Dashboard'}
          </h2>
          <p className="text-xs text-slate-500">
            Welcome back, <span className="font-bold text-slate-800">{userProfile?.displayName || userProfile?.name || 'User'}</span>! {permissions.count === 1 && !permissions.canExecutive ? `Direct access to your assigned ${permissions.accessibleList[0].label} department.` : 'Real-time performance across your permitted business units.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={syncAllData} 
            disabled={isSyncing}
            className="h-9 text-xs font-bold gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-indigo-600")} />
            {isSyncing ? 'Refreshing...' : 'Refresh All'}
          </Button>
        </div>
      </div>

      {/* Module Selector Pill Bar (Displayed if user has access to multiple modules) */}
      {permissions.count > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {permissions.canExecutive && (
            <button
              onClick={() => setActiveSubTab('all')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-xs",
                activeSubTab === 'all'
                  ? "bg-slate-900 text-white shadow-slate-900/20"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
              )}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
              <span>All Overview ({permissions.count} Modules)</span>
            </button>
          )}

          {permissions.accessibleList.map(mod => {
            const Icon = mod.icon;
            const isActive = activeSubTab === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveSubTab(mod.id)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-xs",
                  isActive
                    ? "bg-blue-600 text-white shadow-blue-600/20"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : mod.color)} />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Single-Module Direct View OR Selected Module View */}
      {activeSubTab === 'sales' && permissions.canSales && (
        <SalesDashboard userProfile={userProfile} onNavigate={onNavigate} allowedPagesSet={allowedPagesSet} />
      )}

      {activeSubTab === 'production' && permissions.canProduction && (
        <ProductionDashboard userProfile={userProfile} onNavigate={onNavigate} allowedPagesSet={allowedPagesSet} />
      )}

      {activeSubTab === 'inventory' && permissions.canInventory && (
        <InventoryDashboard 
          items={items} 
          transactions={transactions} 
          totalTransactionsCount={totalTransactionsCount} 
          userProfile={userProfile} 
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          supplierPayments={supplierPayments}
          onNavigate={onNavigate} 
          allowedPagesSet={allowedPagesSet}
        />
      )}

      {activeSubTab === 'accounts' && permissions.canAccounts && (
        <AccountsFinanceDashboard 
          userProfile={userProfile} 
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          supplierPayments={supplierPayments}
          onNavigate={onNavigate} 
          allowedPagesSet={allowedPagesSet}
        />
      )}

      {/* Zero Dashboard Permissions Fallback */}
      {permissions.count === 0 && !permissions.canExecutive && (
        <div className="bg-white rounded-2xl p-10 md:p-14 border border-slate-200/80 shadow-xs text-center max-w-xl mx-auto my-6">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">No Dashboard Permission Assigned</h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Your user account has not been assigned access to any specific dashboard view. Please contact a system administrator to configure your dashboard access in the <strong>Permission Matrix</strong>.
          </p>
          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 font-medium">
            💡 <strong>Admin Note:</strong> Permission Matrix থেকে যে ইউজারের জন্য যে ড্যাশবোর্ড (Sales, Production, Inventory, Accounts, Executive) সিলেক্ট করে সেভ করা হবে, শুধুমাত্র সেই ড্যাশবোর্ডটি উক্ত ইউজারের কাছে শো করবে।
          </div>
        </div>
      )}

      {/* Consolidated "All Overview" Command Center */}
      {activeSubTab === 'all' && (permissions.canExecutive || permissions.count > 1) && (
        <div className="space-y-6">
          {/* Permitted Sections Stack */}
          {permissions.canSales && (
            <div>
              <SalesDashboard userProfile={userProfile} onNavigate={onNavigate} allowedPagesSet={allowedPagesSet} />
            </div>
          )}

          {permissions.canProduction && (
            <div className={permissions.canSales ? "border-t border-slate-200/60 pt-6" : ""}>
              <ProductionDashboard userProfile={userProfile} onNavigate={onNavigate} allowedPagesSet={allowedPagesSet} />
            </div>
          )}

          {permissions.canInventory && (
            <div className={(permissions.canSales || permissions.canProduction) ? "border-t border-slate-200/60 pt-6" : ""}>
              <InventoryDashboard 
                items={items} 
                transactions={transactions} 
                totalTransactionsCount={totalTransactionsCount} 
                userProfile={userProfile} 
                suppliers={suppliers}
                purchaseOrders={purchaseOrders}
                supplierPayments={supplierPayments}
                onNavigate={onNavigate} 
                allowedPagesSet={allowedPagesSet}
              />
            </div>
          )}

          {permissions.canAccounts && (
            <div className={(permissions.canSales || permissions.canProduction || permissions.canInventory) ? "border-t border-slate-200/60 pt-6" : ""}>
              <AccountsFinanceDashboard 
                userProfile={userProfile} 
                suppliers={suppliers}
                purchaseOrders={purchaseOrders}
                supplierPayments={supplierPayments}
                onNavigate={onNavigate} 
                allowedPagesSet={allowedPagesSet}
              />
            </div>
          )}
        </div>
      )}

      {/* Zero Permissions Fallback */}
      {permissions.count === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Dashboard Access Permitted</h3>
          <p className="text-xs text-slate-500">
            Your current user account does not have permission to view any dashboard metrics. Please contact your system administrator to assign module permissions.
          </p>
        </div>
      )}
    </div>
  );
};
