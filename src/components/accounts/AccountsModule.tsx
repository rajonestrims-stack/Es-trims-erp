import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderTree, 
  BookOpen, 
  Landmark, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShoppingBag, 
  Building2, 
  FileText, 
  LayoutDashboard,
  RefreshCw,
  Receipt,
  GitFork,
  Workflow
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  CoaAccountGroup, 
  CoaAccountCategory, 
  CoaSubCategory, 
  CoaLedgerAccount, 
  JournalEntry, 
  CashBankTransaction, 
  FixedAsset 
} from '../../types/accounts';
import { 
  CustomerBill, 
  UserProfile 
} from '../../types';
import { 
  getCoaHierarchy, 
  getJournalEntries, 
  getCashBankTransactions, 
  getFixedAssets 
} from '../../services/accountsService';
import { AccountsDashboard } from './AccountsDashboard';
import { ChartOfAccountsView } from './ChartOfAccountsView';
import { JournalEntryView } from './JournalEntryView';
import { CashBankView } from './CashBankView';
import { CustomerReceivableView } from './CustomerReceivableView';
import { SupplierPayableView } from './SupplierPayableView';
import { SalesAccountsView } from './SalesAccountsView';
import { FixedAssetsView } from './FixedAssetsView';
import { FinancialReportsView } from './FinancialReportsView';
import { AutoPostingMappingView } from './AutoPostingMappingView';

export type AccountsMainMenu = 
  | 'dashboard'
  | 'chart_of_accounts'
  | 'journal_entry'
  | 'cash_bank'
  | 'customer_receivable'
  | 'supplier_payable'
  | 'sales_accounts'
  | 'fixed_assets'
  | 'financial_reports'
  | 'auto_posting_mapping';

interface AccountsModuleProps {
  userProfile: UserProfile;
  customerBills?: CustomerBill[];
  currencySymbol?: string;
  initialMenu?: AccountsMainMenu;
  onSwitchToBilling?: () => void;
  onMenuChange?: (menu: AccountsMainMenu) => void;
}

export const AccountsModule: React.FC<AccountsModuleProps> = ({
  userProfile,
  customerBills: propCustomerBills = [],
  currencySymbol = '$',
  initialMenu = 'dashboard',
  onSwitchToBilling,
  onMenuChange
}) => {
  const businessId = userProfile?.businessId || 'default-business';
  const userDisplayName = userProfile?.displayName || userProfile?.email || 'Accountant';
  const userUid = userProfile?.uid || 'system_user';
  const isSuperAdmin = userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin' || userProfile?.email === 'rajonpaul300@gmail.com' || userProfile?.email === 'rajon.estrims@gmail.com';

  const [activeMenu, setActiveMenu] = useState<AccountsMainMenu>(initialMenu);
  const [bills, setBills] = useState<CustomerBill[]>(propCustomerBills);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Synchronize initialMenu when it changes from outside
  useEffect(() => {
    if (initialMenu) {
      setActiveMenu(initialMenu);
    }
  }, [initialMenu]);

  useEffect(() => {
    if (propCustomerBills && propCustomerBills.length > 0) {
      setBills(propCustomerBills);
    }
  }, [propCustomerBills]);

  // Accounting State
  const [groups, setGroups] = useState<CoaAccountGroup[]>([]);
  const [categories, setCategories] = useState<CoaAccountCategory[]>([]);
  const [subCategories, setSubCategories] = useState<CoaSubCategory[]>([]);
  const [ledgers, setLedgers] = useState<CoaLedgerAccount[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [cashBankTransactions, setCashBankTransactions] = useState<CashBankTransaction[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  // Load all accounting data stably without infinite cycles
  const loadAccountingData = useCallback(async (isManualRefresh: boolean = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }
      const [coaData, jvData, cbData, faData] = await Promise.all([
        getCoaHierarchy(businessId),
        getJournalEntries(businessId),
        getCashBankTransactions(businessId),
        getFixedAssets(businessId)
      ]);

      // If bills not provided via props, load from customer_bills collection
      if (!propCustomerBills || propCustomerBills.length === 0) {
        try {
          const billsSnap = await getDocs(query(collection(db, 'customer_bills'), where('businessId', '==', businessId)));
          const loadedBills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerBill));
          setBills(loadedBills);
        } catch (bErr) {
          console.warn('Could not fetch customer bills:', bErr);
        }
      }

      setGroups(coaData.groups);
      setCategories(coaData.categories);
      setSubCategories(coaData.subCategories);
      setLedgers(coaData.ledgers);

      setJournals(jvData);
      setCashBankTransactions(cbData);
      setFixedAssets(faData);
    } catch (err) {
      console.error('Error loading accounting data:', err);
    } finally {
      setIsLoading(false);
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
    }
  }, [businessId]);

  useEffect(() => {
    loadAccountingData(false);
  }, [loadAccountingData]);

  const handleSelectMenu = (menu: string) => {
    let normalized = menu;
    if (menu === 'coa' || menu === 'chart-of-accounts') normalized = 'chart_of_accounts';
    if (menu === 'journal' || menu === 'journal-entry') normalized = 'journal_entry';
    if (menu === 'cash-bank' || menu === 'cash_bank') normalized = 'cash_bank';
    if (menu === 'receivable' || menu === 'receivables' || menu === 'customer-receivable') normalized = 'customer_receivable';
    if (menu === 'payable' || menu === 'payables' || menu === 'supplier-payable') normalized = 'supplier_payable';
    if (menu === 'sales' || menu === 'sales-accounts' || menu === 'sales_accounts') normalized = 'sales_accounts';
    if (menu === 'fixed-assets' || menu === 'fixed_assets') normalized = 'fixed_assets';
    if (menu === 'reports' || menu === 'financial-reports' || menu === 'financial_reports') normalized = 'financial_reports';
    if (menu === 'auto-posting' || menu === 'auto_posting' || menu === 'auto-posting-mapping' || menu === 'auto_posting_mapping' || menu === 'journal-mapping') normalized = 'auto_posting_mapping';
    setActiveMenu(normalized as AccountsMainMenu);
    if (onMenuChange) {
      onMenuChange(normalized as AccountsMainMenu);
    }
  };

  // Main ERP accounting menu items
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'chart_of_accounts', label: '1. Chart of Accounts', icon: FolderTree, badge: `${ledgers.length}` },
    { id: 'journal_entry', label: '2. Journal Entry', icon: BookOpen, badge: `${journals.length}` },
    { id: 'cash_bank', label: '3. Cash & Bank', icon: Landmark, badge: `${cashBankTransactions.length}` },
    { id: 'customer_receivable', label: '4. Customer Receivable', icon: ArrowDownLeft, badge: null },
    { id: 'supplier_payable', label: '5. Supplier Payable', icon: ArrowUpRight, badge: null },
    { id: 'sales_accounts', label: '6. Sales Accounts', icon: ShoppingBag, badge: `${bills.length}` },
    { id: 'fixed_assets', label: '7. Fixed Assets', icon: Building2, badge: `${fixedAssets.length}` },
    { id: 'financial_reports', label: '8. Financial Reports', icon: FileText, badge: null },
    { id: 'auto_posting_mapping', label: '9. Auto Journal Mapping', icon: Workflow, badge: 'Auto' },
  ];

  return (
    <div id="accounts-erp-module" className="min-h-screen bg-slate-100/60 pb-12">
      {/* Clean Modern Navigation Sub-Tab Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2 gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 flex-1">
              {menuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeMenu === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectMenu(item.id as AccountsMainMenu)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full ${
                        isActive ? 'bg-neutral-800 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onSwitchToBilling && (
                <button
                  type="button"
                  onClick={onSwitchToBilling}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  title="Switch to MRR & Billing Tracker"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">MRR / Bill Register</span>
                </button>
              )}
              <button
                type="button"
                onClick={loadAccountingData}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
                title="Refresh Financial Books"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <span className="text-sm font-bold text-slate-700">Loading Chart of Accounts & Financial Ledgers...</span>
            <span className="text-xs text-slate-400 mt-1">Initializing double-entry database engine</span>
          </div>
        ) : (
          <div>
            {activeMenu === 'dashboard' && (
              <AccountsDashboard
                ledgers={ledgers}
                journals={journals}
                cashBankTxs={cashBankTransactions}
                fixedAssets={fixedAssets}
                customerBills={bills}
                currencySymbol={currencySymbol}
                onNavigate={(menu) => handleSelectMenu(menu as AccountsMainMenu)}
              />
            )}

            {activeMenu === 'chart_of_accounts' && (
              <ChartOfAccountsView
                groups={groups}
                categories={categories}
                subCategories={subCategories}
                ledgers={ledgers}
                journals={journals}
                businessId={businessId}
                userUid={userUid}
                userDisplayName={userDisplayName}
                isSuperAdmin={isSuperAdmin}
                onRefresh={loadAccountingData}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'journal_entry' && (
              <JournalEntryView
                journals={journals}
                ledgers={ledgers}
                businessId={businessId}
                userUid={userUid}
                userDisplayName={userDisplayName}
                isSuperAdmin={isSuperAdmin}
                onRefresh={loadAccountingData}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'cash_bank' && (
              <CashBankView
                transactions={cashBankTransactions}
                ledgers={ledgers}
                businessId={businessId}
                userUid={userUid}
                userDisplayName={userDisplayName}
                isSuperAdmin={isSuperAdmin}
                onRefresh={loadAccountingData}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'customer_receivable' && (
              <CustomerReceivableView
                customerBills={bills}
                customers={[]}
                ledgers={ledgers}
                journals={journals}
                businessId={businessId}
                userDisplayName={userDisplayName}
                onRefresh={loadAccountingData}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'supplier_payable' && (
              <SupplierPayableView
                ledgers={ledgers}
                journals={journals}
                businessId={businessId}
                userDisplayName={userDisplayName}
                onRefresh={loadAccountingData}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'sales_accounts' && (
              <SalesAccountsView
                customerBills={bills}
                ledgers={ledgers}
                journals={journals}
                businessId={businessId}
                userDisplayName={userDisplayName}
                onRefresh={loadAccountingData}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'fixed_assets' && (
              <FixedAssetsView
                fixedAssets={fixedAssets}
                ledgers={ledgers}
                journals={journals}
                businessId={businessId}
                userDisplayName={userDisplayName}
                onRefresh={loadAccountingData}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'financial_reports' && (
              <FinancialReportsView
                ledgers={ledgers}
                journals={journals}
                currencySymbol={currencySymbol}
              />
            )}

            {activeMenu === 'auto_posting_mapping' && (
              <AutoPostingMappingView
                businessId={businessId}
                userProfile={userProfile}
                coaLedgers={ledgers}
                currencySymbol={currencySymbol}
                onRefreshData={loadAccountingData}
                onNavigateToJournal={() => handleSelectMenu('journal_entry')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
