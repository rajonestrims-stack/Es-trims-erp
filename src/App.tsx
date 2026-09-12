/**
 * ERP System Application - UTF-8
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { printElement } from './utils/printHelper';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp, 
  orderBy,
  getDocs,
  getDocFromServer,
  setDoc,
  getDoc,
  limit,
  getCountFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword
} from 'firebase/auth';
import { 
  Package, 
  ArrowLeftRight, 
  FileText, 
  BarChart3, 
  Plus, 
  Search, 
  LogOut, 
  AlertTriangle, 
  ChevronRight,
  Filter,
  Download,
  Calendar,
  History,
  Database,
  Mail,
  Lock,
  RefreshCw,
  LayoutDashboard,
  ShieldCheck,
  Calculator,
  Edit2,
  Trash2,
  User as UserIcon,
  Menu,
  X,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  FileSpreadsheet,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Building2,
  ShoppingBag,
  Users,
  Palette,
  UserPlus,
  KeyRound,
  CheckCircle2,
  Sliders,
  Eye,
  EyeOff,
  Save,
  Bell,
  Briefcase,
  Clock,
  Settings,
  Layers,
  Scissors,
  Tags,
  Factory,
  Truck,
  Sparkles,
  Tag,
  FolderTree,
  DollarSign,
  ShoppingCart,
  Receipt,
  Grid,
  Activity,
  FileCheck2,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Workflow,
  RotateCcw,
  ClipboardCheck,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, startOfMonth, endOfMonth, subMonths, isAfter } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { db, auth, handleFirestoreError, OperationType, createNewUserAccount } from './firebase';
import { Item, Transaction, StockReport, Category, Batch, UserProfile, ProductionFormula, StoreRequisitionData, StoreRequisitionItem, Supplier, PurchaseOrder, SupplierPayment, UserRolePermission, SubMenuPermission, ApprovalRequest, ModuleActions, SpecialPermissions } from './types';
import { MultiItemRequisitionModal, StoreRequisitionPrintModal } from './components/StoreRequisition';
import { IssueFromStoreRequisitionModal } from './components/IssueFromStoreRequisitionModal';
import { DirectStoreRequisitionModal } from './components/DirectStoreRequisitionModal';
import { SuppliersAndPurchase } from './components/SuppliersAndPurchase';
import { ProcurementManagement } from './components/ProcurementManagement';
import { DyeingManagement } from './components/DyeingManagement';
import { SalesOrderEntry } from './components/SalesOrderEntry';
import { ProductDevelopmentModule } from './components/ProductDevelopment/ProductDevelopmentModule';
import { ProductionManagement } from './components/ProductionManagement';
import { DespatchManagement } from './components/DespatchManagement';
import { UnifiedDashboard } from './components/dashboard/UnifiedDashboard';
import { SubContractManagement } from './components/subcontract/SubContractManagement';
import { AccountsFinanceView } from './components/AccountsFinanceView';
import { AccountsModule } from './components/accounts/AccountsModule';
import { BankLoanManagement } from './components/BankLoanManagement';
import { ProformaInvoiceManagement } from './components/commercial/ProformaInvoiceManagement';
import { CompanyMasterView } from './components/master/CompanyMasterView';
import { BankMasterView } from './components/commercial/BankMasterView';
import { DataMigrationManager } from './components/DataMigrationManager';
import { IssueAnalysisView } from './components/IssueAnalysisView';
import { ConfirmModal, ConfirmVariant } from './components/ui/ConfirmModal';
import { CalculatorsView } from './components/CalculatorsView';
import { ApprovalsView } from './components/ApprovalsView';
import { SplashScreen } from './components/SplashScreen';
import { AdminLayout } from './admin/AdminLayout';
import { isUserSuperAdmin } from './admin/adminUtils';
import { canUserApprove, executeApprovalAction, executeRejectAction, getApprovalRequestCurrency } from './services/approvalService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ERP_MODULES_LIST = [
  { id: 'sales', name: 'Sales & Order Tracking', desc: 'Order entry, customer sales invoices, delivery chalans & order tracking' },
  { id: 'subcontract', name: 'Sub Contract Management', desc: 'Dyeing, Woven & Embroidery outsourcing, Sub Contract PO, Item Master, GRN & Reports' },
  { id: 'purchase', name: 'Purchase & Suppliers', desc: 'Supplier master directory, local & bond POs, supplier ledger & payments' },
  { id: 'inventory', name: 'Inventory & Store', desc: 'Item catalog, stock counts, GRN, stock IN/OUT, store requisitions' },
  { id: 'accounts', name: 'Accounts & Finance', desc: 'Financial valuation, ledgers, cash/bank accounts, loans & supplier payments' },
  { id: 'bank-loans', name: 'Bank Loan & Finance', desc: 'Sanctions, UPAS/LTR/Term loans, repayments, accounting GL vouchers & overdue calculation' },
  { id: 'production', name: 'Production & BOM', desc: 'Production orders, BOM formulas, yarn/fabric dyeing process' },
  { id: 'commercial', name: 'Commercial & LC', desc: 'LC management, import documents, proforma invoices (PI)' },
  { id: 'hr', name: 'HR & Payroll', desc: 'Employee profiles, attendance tracking & payroll management' },
  { id: 'admin', name: 'Admin Controls', desc: 'User & role settings, pending deletion approvals & backups' },
] as const;

export function getRolePresetMatrix(roleName: string): Record<string, ModuleActions> {
  const m = (v: boolean, a: boolean, e: boolean, d: boolean, ap: boolean, p: boolean): ModuleActions => ({
    view: v, add: a, edit: e, delete: d, approve: ap, print: p
  });
  const r = (roleName || '').toLowerCase();

  if (r.includes('super admin') || r === 'admin') {
    return {
      sales: m(true, true, true, true, true, true),
      purchase: m(true, true, true, true, true, true),
      inventory: m(true, true, true, true, true, true),
      accounts: m(true, true, true, true, true, true),
      production: m(true, true, true, true, true, true),
      commercial: m(true, true, true, true, true, true),
      hr: m(true, true, true, true, true, true),
      admin: m(true, true, true, true, true, true),
    };
  }

  if (r === 'md' || r.includes('managing director')) {
    return {
      sales: m(true, false, false, false, true, true),
      purchase: m(true, false, false, false, true, true),
      inventory: m(true, false, false, false, true, true),
      accounts: m(true, false, false, false, true, true),
      production: m(true, false, false, false, true, true),
      commercial: m(true, false, false, false, true, true),
      hr: m(true, false, false, false, true, true),
      admin: m(true, false, false, false, true, true),
    };
  }

  if (r === 'gm' || r.includes('general manager')) {
    return {
      sales: m(true, true, true, false, true, true),
      purchase: m(true, true, true, false, true, true),
      inventory: m(true, true, true, false, true, true),
      accounts: m(true, true, true, false, true, true),
      production: m(true, true, true, false, true, true),
      commercial: m(true, true, true, false, true, true),
      hr: m(true, true, true, false, true, true),
      admin: m(true, false, false, false, false, true),
    };
  }

  if (r.includes('sales')) {
    return {
      sales: m(true, true, true, false, true, true),
      purchase: m(false, false, false, false, false, false),
      inventory: m(true, false, false, false, false, true),
      accounts: m(false, false, false, false, false, false),
      production: m(true, false, false, false, false, false),
      commercial: m(true, false, false, false, false, false),
      hr: m(false, false, false, false, false, false),
      admin: m(false, false, false, false, false, false),
    };
  }

  if (r.includes('commercial')) {
    return {
      sales: m(true, false, false, false, false, false),
      purchase: m(true, true, true, false, true, true),
      inventory: m(true, false, false, false, false, true),
      accounts: m(true, false, false, false, false, true),
      production: m(false, false, false, false, false, false),
      commercial: m(true, true, true, false, true, true),
      hr: m(false, false, false, false, false, false),
      admin: m(false, false, false, false, false, false),
    };
  }

  if (r.includes('purchase')) {
    return {
      sales: m(false, false, false, false, false, false),
      purchase: m(true, true, true, false, true, true),
      inventory: m(true, true, false, false, false, true),
      accounts: m(true, false, false, false, false, true),
      production: m(true, false, false, false, false, false),
      commercial: m(true, false, false, false, false, false),
      hr: m(false, false, false, false, false, false),
      admin: m(false, false, false, false, false, false),
    };
  }

  if (r.includes('store')) {
    return {
      sales: m(false, false, false, false, false, false),
      purchase: m(true, true, false, false, true, true),
      inventory: m(true, true, true, false, true, true),
      accounts: m(false, false, false, false, false, false),
      production: m(true, true, false, false, false, true),
      commercial: m(false, false, false, false, false, false),
      hr: m(false, false, false, false, false, false),
      admin: m(false, false, false, false, false, false),
    };
  }

  if (r.includes('production')) {
    return {
      sales: m(true, false, false, false, false, false),
      purchase: m(true, false, false, false, false, false),
      inventory: m(true, true, true, false, false, true),
      accounts: m(false, false, false, false, false, false),
      production: m(true, true, true, false, true, true),
      commercial: m(false, false, false, false, false, false),
      hr: m(false, false, false, false, false, false),
      admin: m(false, false, false, false, false, false),
    };
  }

  if (r.includes('account')) {
    return {
      sales: m(true, true, true, false, true, true),
      purchase: m(true, true, true, false, true, true),
      inventory: m(true, false, false, false, false, true),
      accounts: m(true, true, true, false, true, true),
      production: m(true, false, false, false, false, true),
      commercial: m(true, true, false, false, true, true),
      hr: m(true, true, true, false, true, true),
      admin: m(false, false, false, false, false, false),
    };
  }

  if (r.includes('data entry')) {
    return {
      sales: m(true, true, false, false, false, true),
      purchase: m(true, true, false, false, false, true),
      inventory: m(true, true, false, false, false, true),
      accounts: m(false, false, false, false, false, false),
      production: m(true, true, false, false, false, true),
      commercial: m(true, true, false, false, false, true),
      hr: m(false, false, false, false, false, false),
      admin: m(false, false, false, false, false, false),
    };
  }

  return {
    sales: m(true, true, true, false, true, true),
    purchase: m(true, true, true, false, true, true),
    inventory: m(true, true, true, false, true, true),
    accounts: m(true, true, true, false, true, true),
    production: m(true, true, true, false, true, true),
    commercial: m(true, true, true, false, true, true),
    hr: m(true, true, true, false, true, true),
    admin: m(false, false, false, false, false, false),
  };
}

// Helper to format Reference, SR No, Purpose and Notes for Ledger & Transaction views
function getTxDisplayReferenceAndPurpose(tx?: Partial<Transaction> | null): string {
  if (!tx) return '-';
  const srRef = (tx.srNo || tx.reference || '').trim();
  const purpose = (tx.purpose || '').trim();
  const notes = (tx.notes || '').trim();

  const parts: string[] = [];
  if (srRef) {
    parts.push(srRef);
  }
  if (purpose) {
    parts.push(srRef ? `Purpose: ${purpose}` : purpose);
  }
  if (notes && notes !== purpose && notes !== srRef) {
    parts.push(notes);
  }

  if (parts.length === 0) return '-';
  return parts.join(' | ');
}

// --- WAC Utility (Weighted Average Cost) ---
const recalculateItemStock = async (itemId: string, businessId: string, prefetchedTxs?: Transaction[]) => {
  try {
    let txs: Transaction[] = [];
    
    if (prefetchedTxs) {
      txs = prefetchedTxs.filter(t => t.itemId === itemId && t.status === 'active')
        .sort((a, b) => {
          const dateA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
          const dateB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
          return dateA - dateB;
        });
    } else {
      const txsQuery = query(
        collection(db, 'transactions'),
        where('businessId', '==', businessId),
        where('itemId', '==', itemId),
        where('status', '==', 'active'),
        orderBy('date', 'asc')
      );
      const snapshot = await getDocs(txsQuery);
      txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    }
    
    if (txs.length === 0) {
      // If no transactions, check if we should reset to zero
      const itemRef = doc(db, 'items', itemId);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        const data = itemSnap.data();
        if (data.currentStock !== 0 || data.totalValue !== 0) {
          await updateDoc(itemRef, {
            currentStock: 0,
            avgCost: 0,
            totalValue: 0,
            batches: [],
            updatedAt: Timestamp.now()
          });
        }
      }
      return;
    }

    let currentStock = 0;
    let totalValue = 0;
    let lastAvgCost = 0;

    for (const tx of txs) {
      const qty = Number(tx.quantity) || 0;
      const price = Number(tx.price) || 0;
      const type = (tx.type || '').toUpperCase();
      const ref = (tx.reference || '').toUpperCase().trim();
      const isAddition = type === 'IN' || type === 'PRODUCTION_RETURN' || ref === 'OPENING';

      if (isAddition) {
        totalValue += qty * price;
        currentStock += qty;
        if (currentStock > 0) {
          lastAvgCost = totalValue / currentStock;
        } else if (qty > 0) {
          lastAvgCost = price;
        }
      } else {
        // OUT, PRODUCTION, EXTRA_REQUISITION, PURCHASE_RETURN are deductions
        const currentAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;
        currentStock -= qty;
        totalValue -= qty * currentAvgCost;
        
        if (currentStock <= 0) {
          totalValue = 0;
        }
      }
    }
    
    // For WAC, we don't strictly need persistent batches, but we store one flat batch for UI compatibility
    const batches: Batch[] = currentStock > 0 ? [{
      quantity: Number(currentStock.toFixed(4)),
      price: Number(lastAvgCost.toFixed(4)),
      date: Timestamp.now()
    }] : [];
    
    const finalAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;
    
    await updateDoc(doc(db, 'items', itemId), {
      currentStock: Number(currentStock.toFixed(4)),
      avgCost: Number(finalAvgCost.toFixed(4)),
      totalValue: Number(totalValue.toFixed(4)),
      batches: batches, 
      updatedAt: Timestamp.now()
    });
  } catch (err) {
    console.error('Error recalculating stock for item:', itemId, err);
  }
};

// --- Components ---

const Button = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-neutral-800',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent hover:bg-neutral-100 text-neutral-600',
    outline: 'bg-transparent border border-neutral-200 hover:bg-neutral-50 text-neutral-600'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )} 
      {...props} 
    />
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'flex h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )} 
    {...props} 
  />
);

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div onClick={onClick} className={cn('bg-white border border-neutral-100 rounded-xl shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-4 border-bottom border-neutral-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'transactions' | 'ledger' | 'ledger-summary' | 'reports' | 'approvals' | 'calculators' | 'issue-analysis' | 'suppliers' | 'dyeing' | 'admin'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[] | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [formulas, setFormulas] = useState<ProductionFormula[]>([]);
  const [roles, setRoles] = useState<UserRolePermission[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [totalTransactionsCount, setTotalTransactionsCount] = useState(0);

  const totalPendingApprovalsCount = useMemo(() => {
    const isSuperAdmin = isUserSuperAdmin(userProfile);
    const pendingDeletesCount = isSuperAdmin
      ? (purchaseOrders.filter(p => p.status === 'pending_delete').length) +
        (suppliers.filter(s => (s as any).status === 'pending_delete').length) +
        (items.filter(i => i.status === 'pending_delete').length) +
        (transactions.filter(t => t.status === 'pending_delete').length)
      : 0;

    const pendingModuleRequestsCount = approvalRequests.filter(r => {
      if (r.status !== 'pending') return false;
      return canUserApprove(r, userProfile);
    }).length;

    return pendingDeletesCount + pendingModuleRequestsCount;
  }, [purchaseOrders, suppliers, items, transactions, approvalRequests, userProfile]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasFetchedCount, setHasFetchedCount] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedBillForPI, setSelectedBillForPI] = useState<string>('');
  const [selectedWoForPI, setSelectedWoForPI] = useState<string>('');

  const copyBusinessId = () => {
    if (!userProfile) return;
    navigator.clipboard.writeText(userProfile.businessId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [businessCode, setBusinessCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Edit User Modal State (Admin Panel)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState('Editor');
  const [editUserBusinessId, setEditUserBusinessId] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // My Profile Modal State (All Users)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('firestore-quota-exceeded', handleQuota);
    return () => window.removeEventListener('firestore-quota-exceeded', handleQuota);
  }, []);

  const fetchFullHistory = useCallback(async (silent = false) => {
    if (!userProfile?.businessId || allTransactions || isHistoryLoading || quotaExceeded) return;
    setIsHistoryLoading(true);
    try {
      if (!silent) showToast('Loading full transaction history...', 'success');
      const q = query(
        collection(db, 'transactions'),
        where('businessId', '==', userProfile.businessId),
        where('status', 'in', ['active', 'pending_delete'])
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
        .sort((a, b) => b.date.toMillis() - a.date.toMillis());
      
      setAllTransactions(data);
      if (!silent) showToast('History loaded successfully', 'success');
    } catch (err) {
      console.error('Failed to fetch history:', err);
      // Quota errors are handled by global listener
    } finally {
      setIsHistoryLoading(false);
    }
  }, [userProfile?.businessId, !!allTransactions, isHistoryLoading, quotaExceeded, showToast]);

  const backupDataToJSON = async () => {
    if (!userProfile?.businessId || quotaExceeded || isSyncing) return;
    
    const secretCode = window.prompt('Please enter the secret code to authorize backup download:');
    if (secretCode !== '787898Rajon') {
      if (secretCode !== null) showToast('Invalid secret code!', 'error');
      return;
    }

    setIsSyncing(true);
    showToast('Preparing full database backup...', 'success');
    
    try {
      // Fetch all data for this business
      const queryItems = query(collection(db, 'items'), where('businessId', '==', userProfile.businessId));
      const queryCategories = query(collection(db, 'categories'), where('businessId', '==', userProfile.businessId));
      const queryFormulas = query(collection(db, 'formulas'), where('businessId', '==', userProfile.businessId));
      const queryTransactions = query(collection(db, 'transactions'), where('businessId', '==', userProfile.businessId));
      
      const [itemsSnap, categoriesSnap, formulasSnap, transactionsSnap] = await Promise.all([
        getDocs(queryItems),
        getDocs(queryCategories),
        getDocs(queryFormulas),
        getDocs(queryTransactions)
      ]);
      
      const backupData = {
        businessId: userProfile.businessId,
        exportDate: new Date().toISOString(),
        items: itemsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        categories: categoriesSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        formulas: formulasSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        transactions: transactionsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        userProfile: userProfile
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory_backup_${format(new Date(), 'yyyy_MM_dd')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Full JSON backup downloaded successfully!', 'success');
    } catch (err) {
      console.error('Backup failed:', err);
      showToast('Backup failed. Please try again.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const exportTransactionsToCSV = () => {
    const txList = allTransactions || transactions;
    const activeTransactions = txList
      .filter(tx => tx.status !== 'pending_delete')
      .sort((a, b) => b.date.toMillis() - a.date.toMillis());

    const csvData = activeTransactions.map(tx => {
      const item = items.find(i => i.id === tx.itemId);
      return {
        date: format(tx.date.toDate(), 'yyyy-MM-dd HH:mm:ss'),
        sku: item?.sku || 'N/A',
        itemName: item?.name || 'Deleted Item',
        type: tx.type,
        quantity: tx.quantity,
        price: tx.price,
        total: tx.quantity * tx.price,
        reference: tx.reference || '',
        notes: tx.notes || ''
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_export_${format(new Date(), 'yyyy_MM_dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportItemsToCSV = () => {
    const csvData = items.map(item => {
      const category = categories.find(c => c.id === item.categoryId);
      return {
        sku: item.sku || '',
        name: item.name || '',
        category: category?.name || 'N/A',
        unit: item.unit || '',
        currentStock: item.currentStock || 0,
        minStock: item.minStock || 0,
        avgCost: item.avgCost || 0,
        description: item.description || ''
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_items_${format(new Date(), 'yyyy_MM_dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCategoriesToCSV = () => {
    const csvData = categories.map(cat => ({
      name: cat.name || '',
      id: cat.id || ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `categories_export_${format(new Date(), 'yyyy_MM_dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportUserProfileToCSV = () => {
    if (!userProfile) return;
    const csvData = [{
      name: userProfile.displayName || userProfile.name || '',
      email: userProfile.email || '',
      role: userProfile.role || '',
      businessName: userProfile.businessName || '',
      businessId: userProfile.businessId || '',
      uid: userProfile.uid || '',
      joinedAt: userProfile.joinedAt ? format(userProfile.joinedAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
    }];

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `user_profile_${(userProfile.displayName || userProfile.name || 'info').replace(/\s+/g, '_').toLowerCase()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open & Save My Profile
  const handleOpenProfileModal = () => {
    setProfileDisplayName(userProfile?.displayName || user?.displayName || '');
    setProfileNewPassword('');
    setShowProfilePassword(false);
    setIsProfileModalOpen(true);
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const newName = profileDisplayName.trim() || 'Team Member';

      // 1. Update Firebase Auth Display Name if available
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newName });
      }

      // 2. Update Password if provided
      if (profileNewPassword.trim()) {
        if (profileNewPassword.trim().length < 6) {
          showToast('Password must be at least 6 characters long.', 'error');
          setIsSavingProfile(false);
          return;
        }
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, profileNewPassword.trim());
        }
      }

      // 3. Update Firestore user profile
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newName
      });

      // 4. Update local userProfile state
      setUserProfile(prev => prev ? { ...prev, displayName: newName } : null);

      showToast('Your display name and password updated successfully!', 'success');
      setIsProfileModalOpen(false);
      setProfileNewPassword('');
    } catch (err: any) {
      console.error('Update Profile Error:', err);
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const syncAllData = useCallback(async (silentParam: boolean | React.MouseEvent = false) => {
    if (!userProfile?.businessId || quotaExceeded) return;
    const silent = typeof silentParam === 'boolean' ? silentParam : false;
    
    // Prevent overlapping syncs
    if (isSyncing) return;
    
    setIsSyncing(true);
    if (!silent) showToast('Syncing all inventory data...', 'success');
    
    try {
      // 1. Fetch all active transactions for this business in ONE go
      const txsQuery = query(
        collection(db, 'transactions'),
        where('businessId', '==', userProfile.businessId),
        where('status', 'in', ['active', 'pending_delete']),
        orderBy('date', 'asc')
      );
      const txsSnapshot = await getDocs(txsQuery);
      const fetchedAllTransactions = txsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      
      // Update our history state too
      setAllTransactions(fetchedAllTransactions);

      // 2. Map transactions to items
      const txMap: Record<string, Transaction[]> = {};
      fetchedAllTransactions.forEach(tx => {
        if (!txMap[tx.itemId]) txMap[tx.itemId] = [];
        txMap[tx.itemId].push(tx);
      });

      // 3. Process each item (using already fetched items from state or refetch if needed)
      // For total reliability in a sync, we refetch items list once
      const itemsSnapshot = await getDocs(query(
        collection(db, 'items'),
        where('businessId', '==', userProfile.businessId)
      ));
      
      const updatePromises: Promise<void>[] = [];

      for (const itemDoc of itemsSnapshot.docs) {
        const itemId = itemDoc.id;
        const itemData = itemDoc.data() as Item;
        const itemTxs = txMap[itemId] || [];
        
        // Repair logic: Check if we need an opening transaction
        if (itemTxs.length === 0 && (itemData.currentStock > 0 || (itemData.totalValue && itemData.totalValue > 0))) {
          console.log(`Repairing item ${itemData.name}: Creating opening transaction`);
          updatePromises.push((async () => {
            await addDoc(collection(db, 'transactions'), {
              itemId: itemId,
              type: 'IN',
              quantity: itemData.currentStock || 0,
              price: itemData.avgCost || 0,
              date: itemData.updatedAt || Timestamp.now(),
              reference: 'OPENING',
              notes: 'System Repaired Opening Stock',
              ownerId: userProfile.uid,
              businessId: userProfile.businessId,
              status: 'active'
            });
          })());
        }

        // 4. Calculate state (Weighted Average) locally
        let currentStock = 0;
        let totalValue = 0;
        let lastAvgCost = 0;

        for (const tx of itemTxs) {
          const qty = Number(tx.quantity) || 0;
          const price = Number(tx.price) || 0;
          const type = (tx.type || '').toUpperCase();
          const ref = (tx.reference || '').toUpperCase().trim();
          const isAddition = type === 'IN' || type === 'PRODUCTION_RETURN' || ref === 'OPENING';

          if (isAddition) {
            totalValue += qty * price;
            currentStock += qty;
            if (currentStock > 0) {
              lastAvgCost = totalValue / currentStock;
            } else if (qty > 0) {
              lastAvgCost = price;
            }
          } else {
            const currentAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;
            currentStock -= qty;
            totalValue -= qty * currentAvgCost;
            if (currentStock <= 0) {
              totalValue = 0;
            }
          }
        }

        const finalAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;

        // Only update if values actually changed to save on writes
        if (
          Math.abs(itemData.currentStock - currentStock) > 0.0001 || 
          Math.abs((itemData.totalValue || 0) - totalValue) > 0.0001 ||
          Math.abs(itemData.avgCost - finalAvgCost) > 0.0001
        ) {
          updatePromises.push(updateDoc(doc(db, 'items', itemId), {
            currentStock: Number(currentStock.toFixed(4)),
            avgCost: Number(finalAvgCost.toFixed(4)),
            totalValue: Number(totalValue.toFixed(4)),
            batches: currentStock > 0 ? [{ quantity: currentStock, price: finalAvgCost, date: Timestamp.now() }] : [],
            updatedAt: Timestamp.now()
          }));
        }
      }

      await Promise.all(updatePromises);
      if (!silent) showToast('Sync completed! Redundant operations avoided.', 'success');
    } catch (err) {
      console.error('Sync failed:', err);
      if (!silent) showToast('Sync failed. Please try again.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, userProfile, showToast]);

  const recalculateItemStock = useCallback(async (itemId: string, businessId: string) => {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('businessId', '==', businessId),
        where('itemId', '==', itemId),
        where('status', 'in', ['active', 'pending_delete'])
      );
      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      txs.sort((a, b) => {
        const timeA = a.date?.toMillis ? a.date.toMillis() : (a.date ? new Date(a.date as any).getTime() : 0);
        const timeB = b.date?.toMillis ? b.date.toMillis() : (b.date ? new Date(b.date as any).getTime() : 0);
        return timeA - timeB;
      });

      let currentStock = 0;
      let totalValue = 0;
      let lastAvgCost = 0;

      for (const tx of txs) {
        const qty = Number(tx.quantity) || 0;
        const price = Number(tx.price) || 0;
        const type = (tx.type || '').toUpperCase();
        const ref = (tx.reference || '').toUpperCase().trim();
        const isAddition = type === 'IN' || type === 'PRODUCTION_RETURN' || ref === 'OPENING';

        if (isAddition) {
          totalValue += qty * price;
          currentStock += qty;
          if (currentStock > 0) {
            lastAvgCost = totalValue / currentStock;
          } else if (qty > 0) {
            lastAvgCost = price;
          }
        } else {
          const currentAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;
          currentStock -= qty;
          totalValue -= qty * currentAvgCost;
          if (currentStock <= 0) totalValue = 0;
        }
      }

      const finalAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;

      await updateDoc(doc(db, 'items', itemId), {
        currentStock: Number(currentStock.toFixed(4)),
        avgCost: Number(finalAvgCost.toFixed(4)),
        totalValue: Number(totalValue.toFixed(4)),
        batches: currentStock > 0 ? [{ quantity: currentStock, price: finalAvgCost, date: Timestamp.now() }] : [],
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      console.error(`Failed to recalculate stock for item ${itemId}:`, err);
    }
  }, []);

  const cleanupSKURange = useCallback(async () => {
    if (!userProfile) return;
    if (!confirm('Warning: This will permanently delete all items from SKU 30 to SKU 51 and their related transactions. This cannot be undone. Proceed?')) return;
    
    setIsSyncing(true);
    showToast('Starting bulk cleanup...', 'success');
    
    try {
      // Find items in range SKU 30 to SKU 51
      const rangeItems = items.filter(item => {
        const skuPrefix = 'SKU ';
        if (!item.sku.startsWith(skuPrefix)) return false;
        const num = parseInt(item.sku.replace(skuPrefix, ''), 10);
        return num >= 30 && num <= 51;
      });

      if (rangeItems.length === 0) {
        showToast('No items found in range SKU 30-51', 'error');
        setIsSyncing(false);
        return;
      }

      showToast(`Deleting ${rangeItems.length} items and their history...`, 'success');

      for (const item of rangeItems) {
        // 1. Delete all transactions for this item
        const txsQuery = query(
          collection(db, 'transactions'),
          where('businessId', '==', userProfile.businessId),
          where('itemId', '==', item.id)
        );
        const txSnapshot = await getDocs(txsQuery);
        for (const txDoc of txSnapshot.docs) {
          await deleteDoc(doc(db, 'transactions', txDoc.id));
        }

        // 2. Delete the item itself
        await deleteDoc(doc(db, 'items', item.id));
      }

      showToast('Cleanup completed successfully!', 'success');
      // Final Sync to update dashboard stats
      await syncAllData(true);
    } catch (err) {
      console.error('Cleanup failed:', err);
      showToast('Cleanup failed. Check logs.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [userProfile, items, showToast, syncAllData]);

  // Auth Listener with Real-time User Profile & Permission Sync
  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      try {
        setUser(u);
        if (u) {
          const profileDoc = await getDoc(doc(db, 'users', u.uid));

          if (profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            let needsUpdate = false;
            if (!data.businessId) {
              data.businessId = u.uid;
              needsUpdate = true;
            }
            if (u.email && ['rajonpaul300@gmail.com', 'esstore@gmail.com', 'rajon.estrims@gmail.com', 'estore@gmail.com'].includes(u.email.toLowerCase()) && data.role !== 'admin' && data.role !== 'super admin') {
              data.role = 'admin';
              needsUpdate = true;
            }
            if (needsUpdate) {
              await updateDoc(doc(db, 'users', u.uid), { businessId: data.businessId, role: data.role });
            }
            setUserProfile(data);
          } else {
            const isSuper = u.email && ['rajonpaul300@gmail.com', 'esstore@gmail.com', 'rajon.estrims@gmail.com', 'estore@gmail.com'].includes(u.email.toLowerCase());
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'User',
              role: isSuper ? 'admin' : 'editor',
              businessId: u.uid 
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setUserProfile(newProfile);
          }

          // Live Snapshot listener so permission matrix / role updates apply immediately
          unsubUserDoc = onSnapshot(doc(db, 'users', u.uid), (snap) => {
            if (snap.exists()) {
              const liveData = snap.data() as UserProfile;
              setUserProfile(prev => ({ ...(prev || {}), ...liveData }));
            }
          }, (err) => {
            console.error('User doc live snapshot failed:', err);
          });
        } else {
          setUserProfile(null);
        }
      } catch (err: any) {
        console.error('Auth sync failed:', err);
        const isQuotaErr = err.message?.includes('Quota exceeded') || err.code === 'resource-exhausted';
        if (isQuotaErr) {
          window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
        }
        showToast(isQuotaErr ? 'Daily database limit exceeded. Please wait for the daily reset.' : 'Profile sync failed. Check your connection.', 'error');
      } finally {
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Skip Test Connection to save reads
  useEffect(() => {
    // Connection is naturally tested by the profile fetch and listeners
  }, [isAuthReady, user]);

  // Outer Listener and Auto-Sync
  useEffect(() => {
    if (!userProfile) return;
    fetchFullHistory(true);
    // Silently sync and repair any out-of-sync quantities due to the stale calculation bug
    // ONLY ONCE per session to prevent infinite loop of fetches and heavy database load!
    if (!hasAutoSynced) {
      setHasAutoSynced(true);
      syncAllData(true).catch(console.error);
    }
  }, [userProfile?.businessId, fetchFullHistory, syncAllData, hasAutoSynced]);

  useEffect(() => {
    if (!userProfile || quotaExceeded) return;

    const itemsQuery = query(
      collection(db, 'items'),
      where('businessId', '==', userProfile.businessId),
      orderBy('name', 'asc')
    );

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('businessId', '==', userProfile.businessId),
      where('status', 'in', ['active', 'pending_delete']),
      orderBy('date', 'desc'),
      limit(200)
    );

    const categoriesQuery = query(
      collection(db, 'categories'),
      where('businessId', '==', userProfile.businessId),
      orderBy('name', 'asc')
    );

    const formulasQuery = query(
      collection(db, 'formulas'),
      where('businessId', '==', userProfile.businessId)
    );

    const suppliersQuery = query(
      collection(db, 'suppliers'),
      where('businessId', '==', userProfile.businessId)
    );

    const purchaseOrdersQuery = query(
      collection(db, 'purchaseOrders'),
      where('businessId', '==', userProfile.businessId)
    );

    const supplierPaymentsQuery = query(
      collection(db, 'supplierPayments'),
      where('businessId', '==', userProfile.businessId)
    );

    const rolesQuery = query(
      collection(db, 'roles'),
      where('businessId', '==', userProfile.businessId)
    );

    const approvalRequestsQuery = query(
      collection(db, 'approvalRequests'),
      where('businessId', '==', userProfile.businessId)
    );

    // Only fetch total count if we don't have it to save reads
    if (!hasFetchedCount) {
      getCountFromServer(query(collection(db, 'transactions'), where('businessId', '==', userProfile.businessId)))
        .then(snap => {
          setTotalTransactionsCount(snap.data().count);
          setHasFetchedCount(true);
        })
        .catch(console.error);
    }

    const unsubItems = onSnapshot(itemsQuery, (snapshot) => {
      console.log(`Received ${snapshot.size} items for business ${userProfile.businessId}`);
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Item)));
    }, (err) => {
      console.error('Items listener failed:', err);
      showToast('Inventory listener failed. Please refresh.', 'error');
    });

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      console.log(`Received ${snapshot.size} transactions for business ${userProfile.businessId}`);
      const newTransactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(newTransactions);
      
      // If full history was already loaded, we SHOULD update it too to keep UI consistent
      // We only prepend new items that aren't already there (though onSnapshot usually replaces the whole list)
      if (allTransactions) {
        setAllTransactions(prev => {
          if (!prev) return null;
          // Merge logic: take existing full history, but replace/add everything from the new snapshot
          const snapshotIds = new Set(newTransactions.map(tx => tx.id));
          const filteredPrev = prev.filter(tx => !snapshotIds.has(tx.id));
          return [...newTransactions, ...filteredPrev].sort((a, b) => b.date.toMillis() - a.date.toMillis());
        });
      }
    }, (err) => {
      console.error('Transactions listener failed:', err);
      showToast('Transaction listener failed. Please refresh.', 'error');
    });

    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
      console.log(`Received ${snapshot.size} categories for business ${userProfile.businessId}`);
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (err) => {
      console.error('Categories listener failed:', err);
      showToast('Category listener failed.', 'error');
    });

    const unsubFormulas = onSnapshot(formulasQuery, (snapshot) => {
      setFormulas(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductionFormula)));
    }, (err) => {
      console.error('Formulas listener failed:', err);
    });

    const unsubSuppliers = onSnapshot(suppliersQuery, (snapshot) => {
      setSuppliers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    }, (err) => {
      console.error('Suppliers listener failed:', err);
    });

    const unsubPurchaseOrders = onSnapshot(purchaseOrdersQuery, (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    }, (err) => {
      console.error('Purchase Orders listener failed:', err);
    });

    const unsubSupplierPayments = onSnapshot(supplierPaymentsQuery, (snapshot) => {
      setSupplierPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupplierPayment)));
    }, (err) => {
      console.error('Supplier Payments listener failed:', err);
    });

    const unsubRoles = onSnapshot(rolesQuery, (snapshot) => {
      setRoles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserRolePermission)));
    }, (err) => {
      console.error('Roles listener failed:', err);
    });

    // Aggregated Approval Requests listener:
    // Ensures designated user assignments are delivered immediately to the targeted approver
    const requestsMap = new Map<string, ApprovalRequest>();
    const updateMergedRequests = (docs: any[]) => {
      docs.forEach(d => {
        requestsMap.set(d.id, { id: d.id, ...d.data() } as ApprovalRequest);
      });
      setApprovalRequests(Array.from(requestsMap.values()));
    };

    const unsubApprovalRequests = onSnapshot(approvalRequestsQuery, (snapshot) => {
      updateMergedRequests(snapshot.docs);
    }, (err) => {
      console.warn('Approval requests listener notice:', err);
    });

    let unsubUidApprovals: (() => void) | null = null;
    let unsubEmailApprovals: (() => void) | null = null;

    if (userProfile?.uid) {
      const qUid = query(collection(db, 'approvalRequests'), where('approverUid', '==', userProfile.uid));
      unsubUidApprovals = onSnapshot(qUid, (snapshot) => {
        updateMergedRequests(snapshot.docs);
      }, (err) => console.warn('Uid approvals sub notice:', err));
    }

    if (userProfile?.email) {
      const qEmail = query(collection(db, 'approvalRequests'), where('approverEmail', '==', userProfile.email.toLowerCase().trim()));
      unsubEmailApprovals = onSnapshot(qEmail, (snapshot) => {
        updateMergedRequests(snapshot.docs);
      }, (err) => console.warn('Email approvals sub notice:', err));
    }

    return () => {
      unsubItems();
      unsubTransactions();
      unsubCategories();
      unsubFormulas();
      unsubSuppliers();
      unsubPurchaseOrders();
      unsubSupplierPayments();
      unsubRoles();
      unsubApprovalRequests();
      if (unsubUidApprovals) unsubUidApprovals();
      if (unsubEmailApprovals) unsubEmailApprovals();
    };
  }, [userProfile?.businessId, userProfile?.uid, userProfile?.email]); // Stable dependency

  const superAdminEmails = ['rajonpaul300@gmail.com', 'estore@gmail.com', 'esstore@gmail.com', 'rajon.estrims@gmail.com'];
  const currentUserEmailLower = (userProfile?.email || user?.email || '').toLowerCase().replace(/\s+/g, '');
  const isSuperAdmin = superAdminEmails.includes(currentUserEmailLower);
  const isAdmin = isSuperAdmin || userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'super admin';

  const currentUserName = useMemo(() => {
    const raw = userProfile?.displayName || userProfile?.name || userProfile?.employeeName || user?.displayName || '';
    if (raw && !raw.includes('@')) return raw.trim();
    if (raw && raw.includes('@')) {
      const prefix = raw.split('@')[0];
      return prefix.replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
    }
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
    }
    return 'User';
  }, [userProfile?.displayName, userProfile?.name, userProfile?.employeeName, user?.displayName, user?.email]);

  const DEFAULT_ROLES: UserRolePermission[] = useMemo(() => {
    const bId = userProfile?.businessId || '';
    const allP = [
      'dashboard', 'sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-mrr-receipt', 'sales-booking-report', 'sales-sales-report',
      'master-setup', 'sales-price-master', 'sales-currency-master', 'sales-buyer-master', 'sales-customer-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master',
      'supplier-report', 'suppliers', 'purchases', 'supplier-ledger', 'supplier-payment', 'bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers',
      'inventory', 'transactions', 'issue-analysis', 'dyeing', 'ledger', 'ledger-summary', 'reports', 'calculators', 'approvals', 'accounts', 'accounts-finance', 'accounts-dashboard', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'accounts-financial-reports', 'accounts-auto-posting', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'admin',
      'production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition',
      'despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'
    ];

    return [
      {
        id: 'super-admin',
        name: 'Super Admin',
        businessId: bId,
        allowedPages: allP,
        modulePermissions: getRolePresetMatrix('Super Admin'),
        canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canPrint: true,
        description: 'Super Admin - Unrestricted full access to all ERP modules'
      },
      {
        id: 'md',
        name: 'MD',
        businessId: bId,
        allowedPages: allP,
        modulePermissions: getRolePresetMatrix('MD'),
        canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: true, canPrint: true,
        description: 'Managing Director - Executive view of all modules, financial reports & approval capabilities'
      },
      {
        id: 'gm',
        name: 'GM',
        businessId: bId,
        allowedPages: allP,
        modulePermissions: getRolePresetMatrix('GM'),
        canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canPrint: true,
        description: 'General Manager - Operational oversight across all modules, post/edit & approve'
      },
      {
        id: 'sales-manager',
        name: 'Sales Manager',
        businessId: bId,
        allowedPages: ['dashboard', 'sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-mrr-receipt', 'sales-booking-report', 'sales-sales-report', 'master-setup', 'sales-price-master', 'sales-currency-master', 'sales-buyer-master', 'sales-customer-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master', 'inventory', 'transactions', 'issue-analysis', 'reports', 'calculators', 'accounts', 'accounts-finance', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker'],
        modulePermissions: getRolePresetMatrix('Sales Manager'),
        canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canPrint: true,
        description: 'Sales Manager - Sales order entry, tracking, customer billing & invoice management'
      },
      {
        id: 'commercial-manager',
        name: 'Commercial Manager',
        businessId: bId,
        allowedPages: ['dashboard', 'suppliers', 'purchases', 'supplier-ledger', 'supplier-payment', 'reports', 'calculators'],
        modulePermissions: getRolePresetMatrix('Commercial Manager'),
        canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canPrint: true,
        description: 'Commercial Manager - LC management, import PI & bond document handling'
      },
      {
        id: 'purchase-manager',
        name: 'Purchase Manager',
        businessId: bId,
        allowedPages: ['dashboard', 'supplier-report', 'suppliers', 'purchases', 'supplier-ledger', 'supplier-payment', 'inventory', 'transactions', 'calculators'],
        modulePermissions: getRolePresetMatrix('Purchase Manager'),
        canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canPrint: true,
        description: 'Purchase Manager - Supplier master directory, purchase orders & procurement approvals'
      },
      {
        id: 'store-manager',
        name: 'Store Manager',
        businessId: bId,
        allowedPages: ['dashboard', 'suppliers', 'purchases', 'inventory', 'transactions', 'issue-analysis', 'dyeing', 'ledger', 'ledger-summary'],
        modulePermissions: getRolePresetMatrix('Store Manager'),
        canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canPrint: true,
        description: 'Store Manager - Inventory catalog, GRN stock receive, stock issues & store requisitions'
      },
      {
        id: 'production-manager',
        name: 'Production Manager',
        businessId: bId,
        allowedPages: ['dashboard', 'inventory', 'transactions', 'issue-analysis', 'dyeing', 'ledger', 'calculators', 'production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition', 'despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'],
        modulePermissions: getRolePresetMatrix('Production Manager'),
        canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canPrint: true,
        description: 'Production Manager - Production orders, BOM formulas, process updates & despatch gate passes'
      },
      {
        id: 'accounts-manager',
        name: 'Accounts Manager',
        businessId: bId,
        allowedPages: ['dashboard', 'accounts', 'accounts-finance', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers', 'supplier-report', 'suppliers', 'purchases', 'supplier-ledger', 'supplier-payment', 'inventory', 'ledger', 'ledger-summary', 'reports'],
        modulePermissions: getRolePresetMatrix('Accounts Manager'),
        canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canPrint: true,
        description: 'Accounts Manager - Ledgers, stock valuation, customer bills, supplier payments & financial accounting'
      },
      {
        id: 'data-entry-operator',
        name: 'Data Entry Operator',
        businessId: bId,
        allowedPages: ['dashboard', 'suppliers', 'purchases', 'inventory', 'transactions', 'dyeing'],
        modulePermissions: getRolePresetMatrix('Data Entry Operator'),
        canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false, canPrint: true,
        description: 'Data Entry Operator - View & data entry capabilities only (no edit/delete/approve)'
      },
      {
        id: 'admin',
        name: 'Admin',
        businessId: bId,
        allowedPages: allP,
        modulePermissions: getRolePresetMatrix('Super Admin'),
        canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canPrint: true,
        description: 'Full administrative system access'
      },
      {
        id: 'editor',
        name: 'Editor',
        businessId: bId,
        allowedPages: allP.filter(p => p !== 'supplier-ledger' && p !== 'supplier-payment'),
        modulePermissions: getRolePresetMatrix('Store Manager'),
        canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canPrint: true,
        description: 'Full operational access'
      },
      {
        id: 'viewer',
        name: 'Viewer',
        businessId: bId,
        allowedPages: ['dashboard', 'inventory', 'suppliers', 'purchases', 'ledger', 'ledger-summary', 'reports'],
        modulePermissions: getRolePresetMatrix('MD'),
        canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canPrint: true,
        description: 'Read-only access'
      }
    ];
  }, [userProfile?.businessId]);

  const currentUserRoleConfig = useMemo(() => {
    if (isAdmin) {
      return {
        id: 'admin',
        name: 'Super Admin',
        businessId: userProfile?.businessId || '',
        allowedPages: [
          'dashboard', 'procurement', 'procurement-requisition', 'procurement-po', 'procurement-mrr', 'procurement-suppliers',
          'sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-mrr-receipt', 'sales-booking-report', 'sales-sales-report',
          'master-setup', 'sales-price-master', 'sales-currency-master', 'sales-buyer-master', 'sales-customer-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master',
          'subcontract', 'subcontract-dashboard', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery', 'subcontract-item-master', 'subcontract-category-master', 'subcontract-price-master', 'subcontract-po', 'subcontract-issue', 'subcontract-receive', 'subcontract-reports',
          'inventory', 'transactions', 'suppliers', 'purchases', 'dyeing', 'ledger', 'ledger-summary', 'issue-analysis', 'reports', 'calculators', 'approvals',
          'accounts', 'accounts-finance', 'accounts-dashboard', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'accounts-financial-reports', 'accounts-auto-posting', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers', 'supplier-ledger', 'supplier-payment', 'supplier-report',
          'admin', 'production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition',
          'despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'
        ],
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true
      };
    }
    const roleLower = (userProfile?.role || 'editor').toLowerCase();
    const customMatch = roles.find(r => r.name.toLowerCase() === roleLower || r.id.toLowerCase() === roleLower);
    if (customMatch) return customMatch;

    const defaultMatch = DEFAULT_ROLES.find(r => r.name.toLowerCase() === roleLower || r.id.toLowerCase() === roleLower);
    if (defaultMatch) return defaultMatch;

    return DEFAULT_ROLES[1]; // fallback Editor
  }, [isAdmin, userProfile?.role, userProfile?.businessId, roles, DEFAULT_ROLES]);

  const [isProcurementSubmenuOpen, setIsProcurementSubmenuOpen] = useState(false);
  const [isSalesSubmenuOpen, setIsSalesSubmenuOpen] = useState(false);
  const [isMasterSubmenuOpen, setIsMasterSubmenuOpen] = useState(false);
  const [isSubContractSubmenuOpen, setIsSubContractSubmenuOpen] = useState(false);
  const [isInventorySubmenuOpen, setIsInventorySubmenuOpen] = useState(false);
  const [isProductDevSubmenuOpen, setIsProductDevSubmenuOpen] = useState(false);
  const [isProductionSubmenuOpen, setIsProductionSubmenuOpen] = useState(false);
  const [isDespatchSubmenuOpen, setIsDespatchSubmenuOpen] = useState(false);
  const [isCommercialSubmenuOpen, setIsCommercialSubmenuOpen] = useState(false);
  const [isAccountsSubmenuOpen, setIsAccountsSubmenuOpen] = useState(false);
  const [isBankLoansSubmenuOpen, setIsBankLoansSubmenuOpen] = useState(false);
  const [isAdminSubmenuOpen, setIsAdminSubmenuOpen] = useState(false);

  useEffect(() => {
    if (['procurement', 'procurement-requisition', 'procurement-po', 'procurement-mrr', 'procurement-suppliers', 'purchases', 'suppliers'].includes(activeTab)) {
      setIsProcurementSubmenuOpen(true);
    }
    if (['sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-mrr-receipt', 'sales-booking-report', 'sales-sales-report'].includes(activeTab)) {
      setIsSalesSubmenuOpen(true);
    }
    if (['master-setup', 'sales-company-master', 'company-master', 'sales-customer-master', 'sales-buyer-master', 'sales-bank-master', 'commercial-bank-master', 'bank-master', 'sales-price-master', 'sales-currency-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master'].includes(activeTab)) {
      setIsMasterSubmenuOpen(true);
    }
    if (['subcontract', 'subcontract-dashboard', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery', 'subcontract-item-master', 'subcontract-category-master', 'subcontract-price-master', 'subcontract-po', 'subcontract-issue', 'subcontract-receive', 'subcontract-reports'].includes(activeTab)) {
      setIsSubContractSubmenuOpen(true);
    }

    if (['inventory', 'transactions', 'ledger', 'ledger-summary', 'issue-analysis', 'reports'].includes(activeTab)) {
      setIsInventorySubmenuOpen(true);
    }
    if (['product-development', 'pd-product-master', 'pd-ups-calculation', 'pd-costing', 'pd-history'].includes(activeTab)) {
      setIsProductDevSubmenuOpen(true);
    }
    if (['production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition'].includes(activeTab)) {
      setIsProductionSubmenuOpen(true);
    }
    if (['despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'].includes(activeTab)) {
      setIsDespatchSubmenuOpen(true);
    }
    if (['commercial', 'commercial-pi', 'commercial-pi-create', 'commercial-pi-list', 'commercial-pi-approvals', 'commercial-bank-master', 'bank-master'].includes(activeTab) || activeTab.startsWith('commercial-')) {
      setIsCommercialSubmenuOpen(true);
    }
    if (['accounts', 'accounts-finance', 'accounts-dashboard', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'accounts-financial-reports', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'supplier-ledger', 'supplier-payment', 'supplier-report'].includes(activeTab) || activeTab.startsWith('accounts-') || activeTab.startsWith('finance-') || activeTab.startsWith('supplier-')) {
      setIsAccountsSubmenuOpen(true);
    }
    if (['bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers'].includes(activeTab) || activeTab.startsWith('loan-') || activeTab.startsWith('bank-loan')) {
      setIsBankLoansSubmenuOpen(true);
    }
    if (activeTab === 'admin' || activeTab.startsWith('admin-')) {
      setIsAdminSubmenuOpen(true);
    }
  }, [activeTab]);

  const allowedPagesSet = useMemo(() => {
    const pages = new Set<string>();

    if (isAdmin || currentUserRoleConfig.id === 'super-admin' || currentUserRoleConfig.id === 'admin') {
      [
        'dashboard', 'dashboard-sales', 'dashboard-production', 'dashboard-inventory', 'dashboard-accounts', 'dashboard-executive',
        'procurement', 'procurement-requisition', 'procurement-po', 'procurement-mrr', 'procurement-suppliers',
        'sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-rectify-requests', 'sales-mrr-receipt', 'sales-booking-report', 'sales-sales-report',
        'master-setup', 'sales-company-master', 'company-master', 'sales-customer-master', 'sales-buyer-master', 'sales-bank-master', 'commercial-bank-master', 'bank-master', 'sales-price-master', 'sales-currency-master',
        'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master',
        'product-development', 'pd-product-master', 'pd-ups-calculation', 'pd-costing', 'pd-history',
        'subcontract', 'subcontract-dashboard', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery', 'subcontract-item-master', 'subcontract-category-master', 'subcontract-subcategory-master', 'subcontract-price-master', 'subcontract-po', 'subcontract-issue', 'subcontract-receive', 'subcontract-reports',
        'inventory', 'inventory-requisition', 'inventory-direct-sr', 'inventory-sr-issue', 'transactions', 'suppliers',
        'purchases', 'supplier-ledger', 'supplier-payment', 'supplier-report', 'bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers', 'dyeing',
        'commercial', 'commercial-pi', 'commercial-pi-create', 'commercial-pi-bill', 'commercial-pi-wo', 'commercial-documents', 'commercial-pi-list', 'commercial-pi-approvals', 'commercial-bank-master', 'bank-master', 'sales-bank-master',
        'ledger', 'ledger-summary', 'issue-analysis', 'reports', 'calculators', 'approvals', 'accounts', 'accounts-finance', 'accounts-dashboard', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'accounts-financial-reports', 'accounts-auto-posting', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'admin',
        'admin-dashboard', 'admin-users', 'admin-roles', 'admin-permissions', 'admin-approvals',
        'admin-employees', 'admin-designations', 'admin-departments', 'admin-audit-log', 'admin-settings',
        'sql-migration', 'data-migration',
        'production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition', 'production-process-master',
        'despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'
      ].forEach(p => pages.add(p));
      return pages;
    }

    // For non-admin users: check userProfile.allowedPages or customPermissions or role allowedPages
    const userCustomPages = (userProfile as any)?.allowedPages;
    const userCustomPerms = (userProfile as any)?.customPermissions;
    let explicitPages: string[] = [];

    if (Array.isArray(userCustomPages) && userCustomPages.length > 0) {
      explicitPages = userCustomPages;
    } else if (userCustomPerms && Object.keys(userCustomPerms).length > 0) {
      explicitPages = Object.keys(userCustomPerms).filter(k => userCustomPerms[k]?.view);
    } else if (currentUserRoleConfig.allowedPages) {
      explicitPages = currentUserRoleConfig.allowedPages;
    }

    explicitPages.forEach(p => pages.add(p));

    // Map parent container access when child subpages are permitted (WITHOUT auto-granting unauthorized sibling subpages)
    if (pages.has('inventory-requisition') || pages.has('inventory-direct-sr') || pages.has('inventory-sr-issue') || pages.has('transactions') || pages.has('ledger') || pages.has('ledger-summary') || pages.has('issue-analysis') || pages.has('reports') || pages.has('calculators') || pages.has('dyeing')) {
      pages.add('inventory');
    }
    if (pages.has('procurement-requisition') || pages.has('procurement-po') || pages.has('procurement-mrr') || pages.has('procurement-suppliers') || pages.has('purchases') || pages.has('suppliers')) {
      pages.add('procurement');
    }
    if (pages.has('sales-order-entry') || pages.has('sales-create-order') || pages.has('sales-order-list') || pages.has('sales-rectify-requests') || pages.has('sales-mrr-receipt') || pages.has('sales-booking-report') || pages.has('sales-sales-report')) {
      pages.add('sales');
    }
    if (pages.has('sales-company-master') || pages.has('company-master') || pages.has('sales-bank-master') || pages.has('commercial-bank-master') || pages.has('bank-master') || pages.has('sales-price-master') || pages.has('sales-currency-master') || pages.has('sales-buyer-master') || pages.has('sales-customer-master') || pages.has('sales-fg-master') || pages.has('sales-category-master') || pages.has('sales-subcategory-master') || pages.has('sales-section-master') || pages.has('sales-process-master')) {
      pages.add('master-setup');
    }
    if (pages.has('subcontract-dashboard') || pages.has('subcontract-dyeing') || pages.has('subcontract-woven') || pages.has('subcontract-embroidery') || pages.has('subcontract-item-master') || pages.has('subcontract-category-master') || pages.has('subcontract-subcategory-master') || pages.has('subcontract-price-master') || pages.has('subcontract-po') || pages.has('subcontract-issue') || pages.has('subcontract-receive') || pages.has('subcontract-reports')) {
      pages.add('subcontract');
    }
    if (pages.has('pd-product-master') || pages.has('pd-ups-calculation') || pages.has('pd-costing') || pages.has('pd-history')) {
      pages.add('product-development');
    }
    if (pages.has('production-dashboard') || pages.has('production-update') || pages.has('production-bom') || pages.has('production-status') || pages.has('production-details') || pages.has('production-requisition') || pages.has('production-process-master')) {
      pages.add('production');
      pages.add('production-management');
    }
    if (pages.has('despatch-challan') || pages.has('despatch-report') || pages.has('despatch-gatepass') || pages.has('despatch-received') || pages.has('despatch-mrr-receipt')) {
      pages.add('despatch');
      pages.add('despatch-management');
    }
    if (pages.has('commercial-pi') || pages.has('commercial-pi-create') || pages.has('commercial-pi-bill') || pages.has('commercial-pi-wo') || pages.has('commercial-documents') || pages.has('commercial-pi-list') || pages.has('commercial-pi-approvals') || pages.has('commercial-bank-master')) {
      pages.add('commercial');
    }
    if (pages.has('accounts') || pages.has('accounts-finance')) {
      pages.add('accounts');
      pages.add('accounts-finance');
      pages.add('accounts-dashboard');
      pages.add('accounts-coa');
      pages.add('accounts-journal');
      pages.add('accounts-cash-bank');
      pages.add('accounts-receivable');
      pages.add('accounts-payable');
      pages.add('accounts-sales');
      pages.add('accounts-fixed-assets');
      pages.add('accounts-reports');
      pages.add('accounts-financial-reports');
      pages.add('accounts-auto-posting');
      pages.add('bank-loans');
      pages.add('bank-loan-dashboard');
      pages.add('loan-sanctions');
      pages.add('loan-records');
      pages.add('loan-repayment');
      pages.add('loan-repayments');
      pages.add('loan-vouchers');
    }
    if (pages.has('accounts-dashboard') || pages.has('accounts-coa') || pages.has('accounts-journal') || pages.has('accounts-cash-bank') || pages.has('accounts-receivable') || pages.has('accounts-payable') || pages.has('accounts-sales') || pages.has('accounts-fixed-assets') || pages.has('accounts-reports') || pages.has('accounts-financial-reports') || pages.has('accounts-auto-posting') || pages.has('finance-billing') || pages.has('finance-bill-list') || pages.has('finance-mrr-tracker') || pages.has('commercial-pi') || pages.has('commercial-bank-master') || pages.has('commercial-pi-create') || pages.has('commercial-pi-list') || pages.has('commercial-pi-approvals') || pages.has('bank-master') || pages.has('supplier-ledger') || pages.has('supplier-payment') || pages.has('supplier-report') || pages.has('bank-loans') || pages.has('bank-loan-dashboard') || pages.has('loan-sanctions') || pages.has('loan-records') || pages.has('loan-repayment') || pages.has('loan-repayments') || pages.has('loan-vouchers')) {
      pages.add('accounts');
      pages.add('accounts-finance');
      pages.add('bank-loans');
    }

    if (pages.has('dashboard-sales') || pages.has('dashboard-production') || pages.has('dashboard-inventory') || pages.has('dashboard-accounts') || pages.has('dashboard-executive') || pages.has('sales-dashboard') || pages.has('production-dashboard') || pages.has('accounts-dashboard') || pages.has('inventory-dashboard')) {
      pages.add('dashboard');
    }

    // Always ensure approvals module is accessible so designated approvers can action assigned approval requests
    pages.add('approvals');

    return pages;
  }, [currentUserRoleConfig, isAdmin, userProfile]);

  const baseNavItems = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'ledger', label: 'Item Ledger', icon: History },
    { id: 'ledger-summary', label: 'Item Ledger Details', icon: FileText },
    { id: 'issue-analysis', label: 'Issue Analysis', icon: PieChartIcon },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'calculators', label: 'Calculators', icon: Calculator },
    { id: 'approvals', label: 'Approvals', icon: AlertTriangle },
  ], []);

  const navItems = useMemo(() => {
    const items = baseNavItems.filter(item => allowedPagesSet.has(item.id));
    if (isAdmin) {
      items.push({ id: 'admin', label: 'Admin Panel', icon: ShieldCheck });
    }
    return items;
  }, [baseNavItems, allowedPagesSet, isAdmin]);

  useEffect(() => {
    if (
      userProfile &&
      !allowedPagesSet.has(activeTab) &&
      !(isAdmin || isSuperAdmin) &&
      !(activeTab.startsWith('admin') && (allowedPagesSet.has('admin') || isAdmin)) &&
      !(activeTab.startsWith('accounts') && (allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || allowedPagesSet.has('accounts-auto-posting') || isAdmin))
    ) {
      const firstAllowed = baseNavItems.find(i => allowedPagesSet.has(i.id))?.id || 'dashboard';
      setActiveTab(firstAllowed as any);
    }
  }, [userProfile, allowedPagesSet, activeTab, baseNavItems, isAdmin, isSuperAdmin]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setAuthError('');
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const u = result.user;
      
      // Check if profile exists
      const docSnap = await getDoc(doc(db, 'users', u.uid));
      if (!docSnap.exists()) {
        // New user from Google - need verification code
        setPendingUser(u);
        setPendingProfile({
          uid: u.uid,
          email: u.email || '',
          displayName: u.displayName || 'User',
          role: 'editor',
          businessId: '' // Will be set after verification
        });
        setShowVerification(true);
      }
    } catch (error: any) {
      if (error.code === 'auth/account-exists-with-different-credential') {
        setAuthError('An account already exists with this email using a different login method (e.g. password).');
      } else {
        setAuthError(error.message);
      }
      console.error('Login failed', error);
    }
  };

  const verifyAndCreateProfile = async () => {
    if (verificationCode !== '87654321') { 
      setAuthError('Invalid Security Code. Please contact your administrator.');
      return;
    }

    try {
      if (pendingProfile && pendingUser) {
        const finalProfile = {
          ...pendingProfile,
          businessId: businessCode.trim() || pendingUser.uid
        };
        await setDoc(doc(db, 'users', pendingUser.uid), finalProfile);
        setUserProfile(finalProfile);
        setShowVerification(false);
        setPendingUser(null);
        setPendingProfile(null);
        showToast('Account verified and created successfully');
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      let loginEmail = email.trim();
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail.toLowerCase()}@estrims.com`;
      }

      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        setAuthError('Invalid User ID or Password. Please check your credentials.');
      } else {
        setAuthError(error.message || 'Login failed. Please try again.');
      }
      console.error('Auth failed', error);
      showToast(error.message || 'Login failed', 'error');
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return <SplashScreen message="Initializing ES Trims ERP..." />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 shadow-sm border border-neutral-200">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 overflow-hidden border border-neutral-100 p-1 shadow-sm">
              <img 
                src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
                className="w-full h-full object-contain" 
                alt="ES TRIMS LIMITED Logo"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">ES TRIMS LIMITED</h1>
            <p className="text-sm text-neutral-500">
              Professional ERP & Inventory Management System
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">User ID / Email Address</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input 
                  type="text"
                  placeholder="e.g. tanvir or admin@estrims.com" 
                  className="pl-10 h-11" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input 
                  type="password"
                  placeholder="--------" 
                  className="pl-10 h-11" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {authError && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
                {authError}
              </p>
            )}

            <Button type="submit" className="w-full h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold shadow-sm">
              Log In
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (quotaExceeded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center space-y-6 border border-red-100"
        >
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Database Limit Reached</h1>
            <p className="text-slate-600">
              The free daily limit for database reads has been reached. The application will resume full operation after the daily reset (usually at midnight UTC).
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl text-sm text-slate-500 text-left">
            <p className="font-medium text-slate-700 mb-1">What can I do?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Wait for the daily reset</li>
              <li>Enable billing in Google Cloud Console to increase limits</li>
              <li>Try again in a few hours</li>
            </ul>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Try Refreshing
          </button>
        </motion.div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-neutral-200/80 p-2 shadow-sm">
            <img 
              src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
              className="w-full h-full object-contain animate-pulse" 
              alt="ES Trims Logo"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <div>
            <h2 className="text-base font-bold text-neutral-800 tracking-tight">ES TRIMS LIMITED</h2>
            <p className="text-sm text-neutral-500 font-medium mt-0.5">ES Trims ERP Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {toast && (
        <div className={cn(
          "fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium animate-in fade-in slide-in-from-bottom-4",
          toast.type === 'success' ? "bg-green-600" : "bg-red-600"
        )}>
          {toast.message}
        </div>
      )}

      {/* Mobile Header */}
      <header className="md:hidden h-16 bg-white border-b border-neutral-100 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-neutral-100 p-0.5">
            <img 
              src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
              className="w-full h-full object-contain" 
              alt="Logo"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-bold text-sm tracking-tight truncate max-w-[120px]">ES TRIMS LIMITED</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-neutral-500 hover:text-neutral-900"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#0f172a] text-slate-100 border-r border-slate-800 z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-700 p-0.5 shadow-sm">
                    <img 
                      src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
                      className="w-full h-full object-contain" 
                      alt="Logo"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-base text-white">ES TRIMS</span>
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">ERP</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {navItems.filter(i => i.id === 'dashboard').map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                      activeTab === item.id 
                        ? 'bg-black text-white shadow-lg' 
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
                ))}

                
                {/* Collapsible Procurement & Purchase Group */}
                {(allowedPagesSet.has('procurement') || allowedPagesSet.has('procurement-requisition') || allowedPagesSet.has('procurement-po') || allowedPagesSet.has('procurement-mrr') || allowedPagesSet.has('procurement-suppliers') || allowedPagesSet.has('purchases') || allowedPagesSet.has('suppliers') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsProcurementSubmenuOpen(!isProcurementSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['procurement', 'procurement-requisition', 'procurement-po', 'procurement-mrr', 'procurement-suppliers', 'purchases', 'suppliers'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['procurement-requisition', 'procurement-po', 'procurement-suppliers'].find(p => allowedPagesSet.has(p)) || 'procurement-requisition';
                          setActiveTab(target as any);
                          setIsProcurementSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <ShoppingCart className="w-5 h-5 text-indigo-600" />
                        <span>Procurement</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isProcurementSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isProcurementSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('procurement-requisition') || (allowedPagesSet.has('procurement') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('procurement-requisition' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'procurement-requisition' || activeTab === 'procurement'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>Purchase Requisition</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('procurement-po') || allowedPagesSet.has('purchases') || (allowedPagesSet.has('procurement') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('procurement-po' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'procurement-po' || activeTab === 'purchases'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Purchase Orders (PO)</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('procurement-suppliers') || allowedPagesSet.has('suppliers') || (allowedPagesSet.has('procurement') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('procurement-suppliers' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'procurement-suppliers' || activeTab === 'suppliers'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Users className="w-4 h-4" />
                            <span>Supplier Master</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Sales & Orders */}
                {(allowedPagesSet.has('sales') || allowedPagesSet.has('sales-order-entry') || allowedPagesSet.has('sales-create-order') || allowedPagesSet.has('sales-order-list') || allowedPagesSet.has('sales-mrr-receipt') || allowedPagesSet.has('sales-customer-master') || allowedPagesSet.has('sales-buyer-master') || allowedPagesSet.has('sales-price-master') || allowedPagesSet.has('sales-fg-master') || allowedPagesSet.has('sales-category-master') || allowedPagesSet.has('sales-subcategory-master') || allowedPagesSet.has('sales-section-master') || allowedPagesSet.has('sales-process-master') || allowedPagesSet.has('sales-booking-report') || allowedPagesSet.has('sales-sales-report') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsSalesSubmenuOpen(!isSalesSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-customer-master', 'sales-buyer-master', 'sales-price-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master', 'sales-booking-report', 'sales-sales-report', 'sales-mrr-receipt'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-mrr-receipt', 'sales-customer-master', 'sales-buyer-master', 'sales-price-master', 'sales-fg-master', 'sales-booking-report', 'sales-sales-report'].find(p => allowedPagesSet.has(p)) || 'sales-order-entry';
                          setActiveTab(target as any);
                          setIsSalesSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <ShoppingBag className="w-5 h-5 text-indigo-600" />
                        <span>Sales & Orders</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isSalesSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isSalesSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('sales-order-entry') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-order-entry' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-order-entry' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Order Entry</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-order-list') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-order-list' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-order-list' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Order List</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-mrr-receipt') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-mrr-receipt' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-mrr-receipt' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Customer MRR Receipt</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-customer-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-customer-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-customer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Users className="w-4 h-4" />
                            <span>Customer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-buyer-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-buyer-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-buyer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>Buyer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-price-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-price-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-price-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Price Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-fg-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-fg-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-fg-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Finished Goods</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-category-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-category-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-category-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Layers className="w-4 h-4" />
                            <span>Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-subcategory-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-subcategory-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-subcategory-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Tags className="w-4 h-4" />
                            <span>Sub-Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-section-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-section-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-section-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Grid className="w-4 h-4" />
                            <span>Section Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-process-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-process-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-process-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Activity className="w-4 h-4" />
                            <span>Process Master</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('sales-booking-report') || allowedPagesSet.has('sales-sales-report') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <div className="pt-2 mt-1 border-t border-indigo-100/70">
                            {(allowedPagesSet.has('sales-booking-report') || (allowedPagesSet.has('sales') && isAdmin)) && (
                              <button
                                type="button"
                                onClick={() => { setActiveTab('sales-booking-report' as any); setIsMobileMenuOpen(false); }}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                  activeTab === 'sales-booking-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-indigo-700 hover:bg-indigo-50 font-bold'
                                )}
                              >
                                <TrendingUp className="w-4 h-4 text-indigo-600" />
                                <span>Booking Report</span>
                              </button>
                            )}
                            {(allowedPagesSet.has('sales-sales-report') || (allowedPagesSet.has('sales') && isAdmin)) && (
                              <button
                                type="button"
                                onClick={() => { setActiveTab('sales-sales-report' as any); setIsMobileMenuOpen(false); }}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left mt-1',
                                  activeTab === 'sales-sales-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-emerald-700 hover:bg-emerald-50 font-bold'
                                )}
                              >
                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                <span>Sales Report</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Master Setup Group */}
                {(allowedPagesSet.has('master-setup') || allowedPagesSet.has('sales-company-master') || allowedPagesSet.has('sales-customer-master') || allowedPagesSet.has('sales-buyer-master') || allowedPagesSet.has('sales-bank-master') || allowedPagesSet.has('commercial-bank-master') || allowedPagesSet.has('sales-price-master') || allowedPagesSet.has('sales-currency-master') || allowedPagesSet.has('sales-fg-master') || allowedPagesSet.has('sales-category-master') || allowedPagesSet.has('sales-subcategory-master') || allowedPagesSet.has('sales-section-master') || allowedPagesSet.has('sales-process-master') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsMasterSubmenuOpen(!isMasterSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['master-setup', 'sales-company-master', 'sales-customer-master', 'sales-buyer-master', 'sales-bank-master', 'commercial-bank-master', 'sales-price-master', 'sales-currency-master', 'sales-fg-master', 'sales-section-master', 'sales-category-master', 'sales-subcategory-master', 'sales-process-master'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['sales-company-master', 'sales-customer-master', 'sales-buyer-master', 'sales-bank-master', 'sales-price-master', 'sales-currency-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master'].find(p => allowedPagesSet.has(p)) || 'sales-company-master';
                          setActiveTab(target as any);
                          setIsMasterSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Sliders className="w-5 h-5 text-purple-600" />
                        <span>Master Setup</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isMasterSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isMasterSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('sales-company-master') || allowedPagesSet.has('company-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-company-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-company-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Building2 className="w-4 h-4 text-amber-500" />
                            <span>Company Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-customer-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-customer-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-customer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Users className="w-4 h-4" />
                            <span>Customer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-buyer-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-buyer-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-buyer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>Buyer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-bank-master') || allowedPagesSet.has('commercial-bank-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-bank-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-bank-master' || activeTab === 'commercial-bank-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                            <span>Bank Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-currency-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-currency-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-currency-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Coins className="w-4 h-4 text-amber-400" />
                            <span>Currency Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-price-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-price-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-price-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span>Customer Price Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-fg-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-fg-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-fg-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Finished Goods Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-category-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-category-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-category-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Layers className="w-4 h-4" />
                            <span>Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-subcategory-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-subcategory-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-subcategory-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Tags className="w-4 h-4" />
                            <span>Sub-Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-section-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-section-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-section-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Building2 className="w-4 h-4" />
                            <span>Section Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-process-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-process-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-process-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Sliders className="w-4 h-4" />
                            <span>Process Master</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Sub Contract Group */}
                {(allowedPagesSet.has('subcontract') || allowedPagesSet.has('subcontract-dashboard') || allowedPagesSet.has('subcontract-dyeing') || allowedPagesSet.has('subcontract-woven') || allowedPagesSet.has('subcontract-embroidery') || allowedPagesSet.has('subcontract-item-master') || allowedPagesSet.has('subcontract-category-master') || allowedPagesSet.has('subcontract-subcategory-master') || allowedPagesSet.has('subcontract-price-master') || allowedPagesSet.has('subcontract-po') || allowedPagesSet.has('subcontract-issue') || allowedPagesSet.has('subcontract-receive') || allowedPagesSet.has('subcontract-reports') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsSubContractSubmenuOpen(!isSubContractSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['subcontract', 'subcontract-dashboard', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery', 'subcontract-item-master', 'subcontract-category-master', 'subcontract-subcategory-master', 'subcontract-price-master', 'subcontract-po', 'subcontract-issue', 'subcontract-receive', 'subcontract-reports'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['subcontract-dashboard', 'subcontract-po', 'subcontract-subcategory-master', 'subcontract-price-master', 'subcontract-receive', 'subcontract-issue', 'subcontract-reports'].find(p => allowedPagesSet.has(p)) || 'subcontract-dashboard';
                          setActiveTab(target as any);
                          setIsSubContractSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Layers className="w-5 h-5 text-purple-600" />
                        <span>Sub Contract</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isSubContractSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isSubContractSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('subcontract-dashboard') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-dashboard' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-dashboard' || activeTab === 'subcontract' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Dashboard</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-po') || allowedPagesSet.has('subcontract-dyeing') || allowedPagesSet.has('subcontract-woven') || allowedPagesSet.has('subcontract-embroidery') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-po' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['subcontract-po', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>Sub Contract PO</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-subcategory-master') || allowedPagesSet.has('subcontract-item-master') || allowedPagesSet.has('subcontract-category-master') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-subcategory-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['subcontract-subcategory-master', 'subcontract-item-master', 'subcontract-category-master'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FolderTree className="w-4 h-4" />
                            <span>Sub-Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-price-master') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-price-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-price-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Supplier Price Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-receive') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-receive' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-receive' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Sub Contract Receive (MRR)</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-issue') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-issue' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-issue' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Truck className="w-4 h-4" />
                            <span>Issue / Delivery</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-reports') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-reports' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-reports' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Reports</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Product Development Group */}
                {(allowedPagesSet.has('product-development') || allowedPagesSet.has('pd-product-master') || allowedPagesSet.has('pd-ups-calculation') || allowedPagesSet.has('pd-costing') || allowedPagesSet.has('pd-history') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsProductDevSubmenuOpen(!isProductDevSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['product-development', 'pd-product-master', 'pd-ups-calculation', 'pd-costing', 'pd-history'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['pd-product-master', 'pd-ups-calculation', 'pd-costing', 'pd-history'].find(p => allowedPagesSet.has(p)) || 'pd-ups-calculation';
                          setActiveTab(target as any);
                          setIsProductDevSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span>Product Development</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isProductDevSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isProductDevSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('pd-product-master') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-product-master' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-product-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Product Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('pd-ups-calculation') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-ups-calculation' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-ups-calculation' || activeTab === 'product-development' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Calculator className="w-4 h-4" />
                            <span>Product UPS Calculation</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('pd-costing') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-costing' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-costing' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Scissors className="w-4 h-4" />
                            <span>Product Development / Costing</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('pd-history') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-history' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-history' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <History className="w-4 h-4" />
                            <span>Development History</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Inventory Group */}
                {(allowedPagesSet.has('inventory') || allowedPagesSet.has('inventory-requisition') || allowedPagesSet.has('transactions') || allowedPagesSet.has('ledger') || allowedPagesSet.has('ledger-summary') || allowedPagesSet.has('issue-analysis') || allowedPagesSet.has('reports') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsInventorySubmenuOpen(!isInventorySubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['inventory', 'transactions', 'ledger', 'ledger-summary', 'issue-analysis', 'reports', 'inventory-requisition'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['inventory', 'inventory-requisition', 'transactions', 'ledger', 'ledger-summary', 'issue-analysis', 'reports'].find(p => allowedPagesSet.has(p)) || 'inventory';
                          setActiveTab(target as any);
                          setIsInventorySubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Package className="w-5 h-5 text-emerald-600" />
                        <span>Inventory</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isInventorySubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isInventorySubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('inventory-requisition') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('inventory-requisition' as any); setIsMobileMenuOpen(false); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                activeTab === 'inventory-requisition' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                              )}
                            >
                              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="truncate">Store Requisition</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('inventory-sr-issue' as any); setIsMobileMenuOpen(false); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                activeTab === 'inventory-sr-issue' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                              )}
                            >
                              <ClipboardCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="truncate">Issue from Store Requisition</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('inventory-direct-sr' as any); setIsMobileMenuOpen(false); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                activeTab === 'inventory-direct-sr' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                              )}
                            >
                              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                              <span className="truncate">Direct Store Requisition</span>
                            </button>
                          </>
                        )}
                        {(allowedPagesSet.has('transactions') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('transactions' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'transactions' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                            <span>Transactions</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('ledger') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('ledger' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'ledger' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <History className="w-4 h-4" />
                            <span>Item Ledger</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('ledger-summary') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('ledger-summary' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'ledger-summary' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>Item Ledger Details</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('issue-analysis') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('issue-analysis' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'issue-analysis' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <PieChartIcon className="w-4 h-4" />
                            <span>Issue Analysis</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('reports') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('reports' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'reports' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Reports</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Production Group */}
                {(allowedPagesSet.has('production') || allowedPagesSet.has('production-management') || allowedPagesSet.has('production-dashboard') || allowedPagesSet.has('production-update') || allowedPagesSet.has('production-bom') || allowedPagesSet.has('production-status') || allowedPagesSet.has('production-details') || allowedPagesSet.has('production-requisition') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsProductionSubmenuOpen(!isProductionSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-requisition'].find(p => allowedPagesSet.has(p)) || 'production-dashboard';
                          setActiveTab(target as any);
                          setIsProductionSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span>Production</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isProductionSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isProductionSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('production-dashboard') || allowedPagesSet.has('production-management') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-dashboard' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['production', 'production-management', 'production-dashboard'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Production Dashboard</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-update') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-update' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-update' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Process Update</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-bom') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-bom' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-bom' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>BOM Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-status') || allowedPagesSet.has('production-details') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-status' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-status' || activeTab === 'production-details' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Production Status</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-requisition') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-requisition' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-requisition' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Store Requisition</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Despatch Group */}
                {(allowedPagesSet.has('despatch') || allowedPagesSet.has('despatch-management') || allowedPagesSet.has('despatch-challan') || allowedPagesSet.has('despatch-report') || allowedPagesSet.has('despatch-gatepass') || allowedPagesSet.has('despatch-received') || allowedPagesSet.has('despatch-mrr-receipt') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsDespatchSubmenuOpen(!isDespatchSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'].find(p => allowedPagesSet.has(p)) || 'despatch-challan';
                          setActiveTab(target as any);
                          setIsDespatchSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Truck className="w-5 h-5 text-indigo-600" />
                        <span>Despatch & Delivery</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isDespatchSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isDespatchSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('despatch-challan') || allowedPagesSet.has('despatch-management') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-challan' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['despatch', 'despatch-management', 'despatch-challan'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>Delivery Challan</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-report') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-report' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Challan Register</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-gatepass') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-gatepass' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-gatepass' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Gate Pass</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-received') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-received' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-received' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Received / Returned</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-mrr-receipt') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-mrr-receipt' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-mrr-receipt' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileCheck2 className="w-4 h-4" />
                            <span>Customer MRR Receipt</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Commercial Group */}
                {(allowedPagesSet.has('commercial') || allowedPagesSet.has('commercial-pi') || allowedPagesSet.has('commercial-pi-bill') || allowedPagesSet.has('commercial-pi-wo') || allowedPagesSet.has('commercial-documents') || allowedPagesSet.has('commercial-pi-create') || allowedPagesSet.has('commercial-pi-list') || allowedPagesSet.has('commercial-pi-approvals') || (allowedPagesSet.has('accounts') && isAdmin) || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsCommercialSubmenuOpen(!isCommercialSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['commercial', 'commercial-pi', 'commercial-pi-bill', 'commercial-pi-wo', 'commercial-documents', 'commercial-pi-create', 'commercial-pi-list', 'commercial-pi-approvals'].includes(activeTab) || activeTab.startsWith('commercial-')
                          ? 'bg-slate-800/90 text-teal-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('commercial-pi-bill' as any);
                          setIsCommercialSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">Commercial</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isCommercialSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isCommercialSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-teal-500/30 space-y-1 py-1">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-pi-bill' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-pi-bill' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <Receipt className="w-4 h-4" />
                          <span>Proforma Invoice From Bill</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-pi-wo' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-pi-wo' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <Layers className="w-4 h-4" />
                          <span>Proforma Invoice From Work Order</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-documents' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-documents' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <FileText className="w-4 h-4" />
                          <span>Document</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-pi-list' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-pi-list' || activeTab === 'commercial-pi' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <FileCheck2 className="w-4 h-4" />
                          <span>PI Register</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Accounts & Finance Group (Consolidated with Bank Loans & Facilities) */}
                {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || allowedPagesSet.has('accounts-dashboard') || allowedPagesSet.has('accounts-coa') || allowedPagesSet.has('accounts-journal') || allowedPagesSet.has('accounts-cash-bank') || allowedPagesSet.has('accounts-receivable') || allowedPagesSet.has('accounts-payable') || allowedPagesSet.has('accounts-sales') || allowedPagesSet.has('accounts-fixed-assets') || allowedPagesSet.has('accounts-reports') || allowedPagesSet.has('finance-billing') || allowedPagesSet.has('finance-bill-list') || allowedPagesSet.has('finance-mrr-tracker') || allowedPagesSet.has('supplier-ledger') || allowedPagesSet.has('supplier-payment') || allowedPagesSet.has('supplier-report') || allowedPagesSet.has('bank-loans') || allowedPagesSet.has('bank-loan-dashboard') || allowedPagesSet.has('loan-sanctions') || allowedPagesSet.has('loan-records') || allowedPagesSet.has('loan-repayment') || allowedPagesSet.has('loan-repayments') || allowedPagesSet.has('loan-vouchers') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsAccountsSubmenuOpen(!isAccountsSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['accounts', 'accounts-finance', 'accounts-dashboard', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'commercial-pi', 'commercial-pi-create', 'commercial-pi-list', 'commercial-pi-approvals', 'commercial-bank-master', 'bank-master', 'supplier-ledger', 'supplier-payment', 'supplier-report', 'bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers'].includes(activeTab) || activeTab.startsWith('accounts-') || activeTab.startsWith('loan-') || activeTab.startsWith('bank-loan')
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('accounts-dashboard' as any);
                          setIsAccountsSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">Accounts & Finance</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isAccountsSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isAccountsSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {/* Section Header: ERP Core Accounting */}
                        <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-indigo-400" />
                          <span>ERP Accounts (8 Menus)</span>
                        </div>

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-dashboard' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              ['accounts', 'accounts-finance', 'accounts-dashboard'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            <span>Accounts Dashboard</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-coa' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-coa' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FolderTree className="w-3.5 h-3.5" />
                            <span>1. Chart of Accounts</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-journal' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-journal' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>2. Journal Entry</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-cash-bank' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-cash-bank' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Landmark className="w-3.5 h-3.5" />
                            <span>3. Cash & Bank</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-receivable' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-receivable' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>4. Customer Receivable</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-payable' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-payable' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>5. Supplier Payable</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-sales' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-sales' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>6. Sales Accounts</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-fixed-assets' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-fixed-assets' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>7. Fixed Assets</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-reports' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-reports' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>8. Financial Reports</span>
                          </button>
                        )}

                        {/* Section Header: Bank Loans & Facility */}
                        <div className="px-2 pt-2.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 border-t border-slate-800 mt-1.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-emerald-400" />
                          <span>Bank Loans & Facility</span>
                        </div>

                        {(allowedPagesSet.has('bank-loan-dashboard') || allowedPagesSet.has('bank-loans') || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('bank-loan-dashboard' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'bank-loan-dashboard' || activeTab === 'bank-loans' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Loan Dashboard</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-sanctions') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-sanctions' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-sanctions' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Facility & Sanctions</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-records') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-records' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-records' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Loan Records</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-repayment') || allowedPagesSet.has('loan-repayments') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-repayment' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-repayment' || activeTab === 'loan-repayments' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Loan Repayments</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-vouchers') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-vouchers' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-vouchers' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                            <span>GL Loan Vouchers</span>
                          </button>
                        )}

                        {/* Section Header: Billing & Operations */}
                        <div className="px-2 pt-2.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400/80 border-t border-slate-800 mt-1.5 flex items-center gap-1">
                          <Receipt className="w-3 h-3 text-slate-400" />
                          <span>Billing & Operations</span>
                        </div>

                        {(allowedPagesSet.has('finance-billing') || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('finance-billing' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'finance-billing' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Plus className="w-4 h-4" />
                            <span>Create Bill</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('finance-bill-list') || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('finance-bill-list' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'finance-bill-list' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Bill Register</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('finance-mrr-tracker') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('finance-mrr-tracker' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'finance-mrr-tracker' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <Clock className="w-4 h-4" />
                            <span>MRR Billing Tracker</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('supplier-ledger') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('supplier-ledger' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'supplier-ledger' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>Supplier Ledger</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('supplier-payment') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('supplier-payment' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'supplier-payment' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Supplier Payment</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('supplier-report') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('supplier-report' as any); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'supplier-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                            )}
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Supplier Financials</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Workflow & Pending Approvals */}
                {(allowedPagesSet.has('approvals') || isAdmin || totalPendingApprovalsCount > 0) && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('approvals')}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left my-1',
                      activeTab === 'approvals'
                        ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-900/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={cn("w-5 h-5", activeTab === 'approvals' ? "text-white" : "text-amber-400")} />
                      <span>Pending Approvals</span>
                    </div>
                    {totalPendingApprovalsCount > 0 && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-black shadow-xs",
                        activeTab === 'approvals' ? "bg-white text-purple-900" : "bg-rose-500 text-white animate-pulse"
                      )}>
                        {totalPendingApprovalsCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Collapsible Admin Control Modules Group */}
                {(allowedPagesSet.has('admin') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminSubmenuOpen(!isAdminSubmenuOpen);
                        if (!activeTab.startsWith('admin')) {
                          setActiveTab('admin-dashboard' as any);
                        }
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        (activeTab === 'admin' || activeTab.startsWith('admin'))
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('admin-dashboard' as any);
                          setIsAdminSubmenuOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        <span>Admin Panel</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isAdminSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isAdminSubmenuOpen && (
                      <div className="pl-4 ml-4 border-l-2 border-blue-500/30 space-y-1 py-1">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-dashboard' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin' || activeTab === 'admin-dashboard') ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          <span>Admin Dashboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-users' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-users' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <Users className="w-4 h-4" />
                          <span>User Management</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-roles' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-roles' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <KeyRound className="w-4 h-4" />
                          <span>Role Management</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-permissions' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-permissions' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Permission Matrix</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-approvals' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin-approvals' || activeTab === 'admin-approval-setup') ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50 font-semibold' : 'text-emerald-400 hover:bg-slate-800/80 hover:text-emerald-200'
                          )}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approval Workflows</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-employees' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-employees' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <Briefcase className="w-4 h-4" />
                          <span>Employee Master</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-designations' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin-designations' || activeTab === 'admin-departments' || activeTab === 'admin-business') ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <Building2 className="w-4 h-4" />
                          <span>Designations & Depts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-audit-log' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin-logs' || activeTab === 'admin-audit-log') ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <Clock className="w-4 h-4" />
                          <span>System Audit Log</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-settings' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-settings' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <Settings className="w-4 h-4" />
                          <span>System Settings</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </nav>

              <div className="p-6 border-t border-slate-800 bg-slate-950/40 space-y-4">
                <div className="flex items-center gap-3 mb-2 p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName)}&background=random`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt={currentUserName} />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { handleOpenProfileModal(); setIsMobileMenuOpen(false); }}>
                    <p className="text-sm font-bold text-white truncate">{currentUserName}</p>
                  </div>
                  <button 
                    onClick={() => { handleOpenProfileModal(); setIsMobileMenuOpen(false); }}
                    className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Edit Name & Password"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 border-slate-800"
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-[#0f172a] border-r border-slate-800 text-slate-100 flex flex-col hidden md:flex print:hidden sticky top-0 h-screen shadow-xl select-none">
        <div className="p-4 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-slate-700 p-0.5 shadow-sm">
            <img 
              src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
              className="w-full h-full object-contain" 
              alt="Logo"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>ES TRIMS</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">ERP</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Enterprise Suite</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.filter(i => i.id === 'dashboard').map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                activeTab === item.id 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/60 ring-1 ring-blue-400/40 font-bold' 
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}

          
                {/* Collapsible Procurement & Purchase Group */}
                {(allowedPagesSet.has('procurement') || allowedPagesSet.has('procurement-requisition') || allowedPagesSet.has('procurement-po') || allowedPagesSet.has('procurement-mrr') || allowedPagesSet.has('procurement-suppliers') || allowedPagesSet.has('purchases') || allowedPagesSet.has('suppliers') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsProcurementSubmenuOpen(!isProcurementSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['procurement', 'procurement-requisition', 'procurement-po', 'procurement-mrr', 'procurement-suppliers', 'purchases', 'suppliers'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['procurement-requisition', 'procurement-po', 'procurement-suppliers'].find(p => allowedPagesSet.has(p)) || 'procurement-requisition';
                          setActiveTab(target as any);
                          setIsProcurementSubmenuOpen(true);
                          
                        }}
                      >
                        <ShoppingCart className="w-5 h-5 text-indigo-600" />
                        <span>Procurement</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isProcurementSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isProcurementSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('procurement-requisition') || (allowedPagesSet.has('procurement') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('procurement-requisition' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'procurement-requisition' || activeTab === 'procurement'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>Purchase Requisition</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('procurement-po') || allowedPagesSet.has('purchases') || (allowedPagesSet.has('procurement') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('procurement-po' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'procurement-po' || activeTab === 'purchases'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Purchase Orders (PO)</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('procurement-suppliers') || allowedPagesSet.has('suppliers') || (allowedPagesSet.has('procurement') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('procurement-suppliers' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'procurement-suppliers' || activeTab === 'suppliers'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <Users className="w-4 h-4" />
                            <span>Supplier Master</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Sales & Orders */}
                {(allowedPagesSet.has('sales') || allowedPagesSet.has('sales-order-entry') || allowedPagesSet.has('sales-create-order') || allowedPagesSet.has('sales-order-list') || allowedPagesSet.has('sales-mrr-receipt') || allowedPagesSet.has('sales-customer-master') || allowedPagesSet.has('sales-buyer-master') || allowedPagesSet.has('sales-price-master') || allowedPagesSet.has('sales-fg-master') || allowedPagesSet.has('sales-category-master') || allowedPagesSet.has('sales-subcategory-master') || allowedPagesSet.has('sales-section-master') || allowedPagesSet.has('sales-process-master') || allowedPagesSet.has('sales-booking-report') || allowedPagesSet.has('sales-sales-report') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsSalesSubmenuOpen(!isSalesSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-customer-master', 'sales-buyer-master', 'sales-price-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master', 'sales-booking-report', 'sales-sales-report', 'sales-mrr-receipt'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-mrr-receipt', 'sales-customer-master', 'sales-buyer-master', 'sales-price-master', 'sales-fg-master', 'sales-booking-report', 'sales-sales-report'].find(p => allowedPagesSet.has(p)) || 'sales-order-entry';
                          setActiveTab(target as any);
                          setIsSalesSubmenuOpen(true);
                          
                        }}
                      >
                        <ShoppingBag className="w-5 h-5 text-indigo-600" />
                        <span>Sales & Orders</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isSalesSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isSalesSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('sales-order-entry') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-order-entry' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-order-entry' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Order Entry</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-order-list') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-order-list' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-order-list' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Order List</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-customer-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-customer-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-customer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Users className="w-4 h-4" />
                            <span>Customer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-buyer-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-buyer-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-buyer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>Buyer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-price-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-price-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-price-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Price Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-fg-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-fg-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-fg-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Finished Goods</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-category-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-category-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-category-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Layers className="w-4 h-4" />
                            <span>Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-subcategory-master') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-subcategory-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-subcategory-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Tags className="w-4 h-4" />
                            <span>Sub-Category Master</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('sales-booking-report') || allowedPagesSet.has('sales-sales-report') || (allowedPagesSet.has('sales') && isAdmin)) && (
                          <div className="pt-2 mt-1 border-t border-indigo-100/70">
                            {(allowedPagesSet.has('sales-booking-report') || (allowedPagesSet.has('sales') && isAdmin)) && (
                              <button
                                type="button"
                                onClick={() => { setActiveTab('sales-booking-report' as any);  }}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                  activeTab === 'sales-booking-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-indigo-700 hover:bg-indigo-50 font-bold'
                                )}
                              >
                                <TrendingUp className="w-4 h-4 text-indigo-600" />
                                <span>Booking Report</span>
                              </button>
                            )}
                            {(allowedPagesSet.has('sales-sales-report') || (allowedPagesSet.has('sales') && isAdmin)) && (
                              <button
                                type="button"
                                onClick={() => { setActiveTab('sales-sales-report' as any);  }}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left mt-1',
                                  activeTab === 'sales-sales-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-emerald-700 hover:bg-emerald-50 font-bold'
                                )}
                              >
                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                <span>Sales Report</span>
                              </button>
                            )}
                            {(allowedPagesSet.has('sales-rectify-requests') || allowedPagesSet.has('sales-order-entry') || (allowedPagesSet.has('sales') && isAdmin)) && (
                              <button
                                type="button"
                                onClick={() => { setActiveTab('sales-rectify-requests' as any); }}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left mt-1',
                                  activeTab === 'sales-rectify-requests' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                                )}
                              >
                                <RotateCcw className="w-4 h-4" />
                                <span>Rectify & Unlock</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Master Setup Group */}
                {(allowedPagesSet.has('master-setup') || allowedPagesSet.has('sales-company-master') || allowedPagesSet.has('sales-customer-master') || allowedPagesSet.has('sales-buyer-master') || allowedPagesSet.has('sales-bank-master') || allowedPagesSet.has('commercial-bank-master') || allowedPagesSet.has('sales-price-master') || allowedPagesSet.has('sales-currency-master') || allowedPagesSet.has('sales-fg-master') || allowedPagesSet.has('sales-category-master') || allowedPagesSet.has('sales-subcategory-master') || allowedPagesSet.has('sales-section-master') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsMasterSubmenuOpen(!isMasterSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['master-setup', 'sales-company-master', 'sales-customer-master', 'sales-buyer-master', 'sales-bank-master', 'commercial-bank-master', 'sales-price-master', 'sales-currency-master', 'sales-fg-master', 'sales-section-master', 'sales-category-master', 'sales-subcategory-master'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['sales-company-master', 'sales-customer-master', 'sales-buyer-master', 'sales-bank-master', 'sales-price-master', 'sales-currency-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master'].find(p => allowedPagesSet.has(p)) || 'sales-company-master';
                          setActiveTab(target as any);
                          setIsMasterSubmenuOpen(true);
                          
                        }}
                      >
                        <Sliders className="w-5 h-5 text-purple-600" />
                        <span>Master Setup</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isMasterSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isMasterSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('sales-company-master') || allowedPagesSet.has('company-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-company-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-company-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Building2 className="w-4 h-4 text-amber-500" />
                            <span>Company Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-customer-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-customer-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-customer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Users className="w-4 h-4" />
                            <span>Customer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-buyer-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-buyer-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-buyer-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>Buyer Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-bank-master') || allowedPagesSet.has('commercial-bank-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-bank-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-bank-master' || activeTab === 'commercial-bank-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                            <span>Bank Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-currency-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-currency-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-currency-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Coins className="w-4 h-4 text-amber-400" />
                            <span>Currency Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-price-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-price-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-price-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span>Customer Price Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-fg-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-fg-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-fg-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Finished Goods Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-category-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-category-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-category-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Layers className="w-4 h-4" />
                            <span>Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-subcategory-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-subcategory-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-subcategory-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Tags className="w-4 h-4" />
                            <span>Sub-Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('sales-section-master') || (allowedPagesSet.has('master-setup') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('sales-section-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'sales-section-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Building2 className="w-4 h-4" />
                            <span>Section Master</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Sub Contract Group */}
                {(allowedPagesSet.has('subcontract') || allowedPagesSet.has('subcontract-dashboard') || allowedPagesSet.has('subcontract-dyeing') || allowedPagesSet.has('subcontract-woven') || allowedPagesSet.has('subcontract-embroidery') || allowedPagesSet.has('subcontract-item-master') || allowedPagesSet.has('subcontract-category-master') || allowedPagesSet.has('subcontract-subcategory-master') || allowedPagesSet.has('subcontract-price-master') || allowedPagesSet.has('subcontract-po') || allowedPagesSet.has('subcontract-issue') || allowedPagesSet.has('subcontract-receive') || allowedPagesSet.has('subcontract-reports') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsSubContractSubmenuOpen(!isSubContractSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['subcontract', 'subcontract-dashboard', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery', 'subcontract-item-master', 'subcontract-category-master', 'subcontract-subcategory-master', 'subcontract-price-master', 'subcontract-po', 'subcontract-issue', 'subcontract-receive', 'subcontract-reports'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['subcontract-dashboard', 'subcontract-po', 'subcontract-subcategory-master', 'subcontract-price-master', 'subcontract-receive', 'subcontract-issue', 'subcontract-reports'].find(p => allowedPagesSet.has(p)) || 'subcontract-dashboard';
                          setActiveTab(target as any);
                          setIsSubContractSubmenuOpen(true);
                          
                        }}
                      >
                        <Layers className="w-5 h-5 text-purple-600" />
                        <span>Sub Contract</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isSubContractSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isSubContractSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('subcontract-dashboard') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-dashboard' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-dashboard' || activeTab === 'subcontract' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Dashboard</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-po') || allowedPagesSet.has('subcontract-dyeing') || allowedPagesSet.has('subcontract-woven') || allowedPagesSet.has('subcontract-embroidery') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-po' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['subcontract-po', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>Sub Contract PO</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-subcategory-master') || allowedPagesSet.has('subcontract-item-master') || allowedPagesSet.has('subcontract-category-master') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-subcategory-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['subcontract-subcategory-master', 'subcontract-item-master', 'subcontract-category-master'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FolderTree className="w-4 h-4" />
                            <span>Sub-Category Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-price-master') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-price-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-price-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Supplier Price Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-receive') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-receive' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-receive' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Sub Contract Receive (MRR)</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-issue') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-issue' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-issue' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Truck className="w-4 h-4" />
                            <span>Issue / Delivery</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('subcontract-reports') || (allowedPagesSet.has('subcontract') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('subcontract-reports' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'subcontract-reports' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Reports</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Product Development Group */}
                {(allowedPagesSet.has('product-development') || allowedPagesSet.has('pd-product-master') || allowedPagesSet.has('pd-ups-calculation') || allowedPagesSet.has('pd-costing') || allowedPagesSet.has('pd-history') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsProductDevSubmenuOpen(!isProductDevSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['product-development', 'pd-product-master', 'pd-ups-calculation', 'pd-costing', 'pd-history'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['pd-product-master', 'pd-ups-calculation', 'pd-costing', 'pd-history'].find(p => allowedPagesSet.has(p)) || 'pd-ups-calculation';
                          setActiveTab(target as any);
                          setIsProductDevSubmenuOpen(true);
                          
                        }}
                      >
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span>Product Development</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isProductDevSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isProductDevSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('pd-product-master') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-product-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-product-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Product Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('pd-ups-calculation') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-ups-calculation' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-ups-calculation' || activeTab === 'product-development' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Calculator className="w-4 h-4" />
                            <span>Product UPS Calculation</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('pd-costing') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-costing' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-costing' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Scissors className="w-4 h-4" />
                            <span>Product Development / Costing</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('pd-history') || (allowedPagesSet.has('product-development') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pd-history' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'pd-history' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <History className="w-4 h-4" />
                            <span>Development History</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Inventory Group */}
                {(allowedPagesSet.has('inventory') || allowedPagesSet.has('inventory-requisition') || allowedPagesSet.has('transactions') || allowedPagesSet.has('ledger') || allowedPagesSet.has('ledger-summary') || allowedPagesSet.has('issue-analysis') || allowedPagesSet.has('reports') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsInventorySubmenuOpen(!isInventorySubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['inventory', 'transactions', 'ledger', 'ledger-summary', 'issue-analysis', 'reports', 'inventory-requisition'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['inventory', 'inventory-requisition', 'transactions', 'ledger', 'ledger-summary', 'issue-analysis', 'reports'].find(p => allowedPagesSet.has(p)) || 'inventory';
                          setActiveTab(target as any);
                          setIsInventorySubmenuOpen(true);
                          
                        }}
                      >
                        <Package className="w-5 h-5 text-emerald-600" />
                        <span>Inventory</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isInventorySubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isInventorySubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('inventory-requisition') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('inventory-requisition' as any); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                activeTab === 'inventory-requisition' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                              )}
                            >
                              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="truncate">Store Requisition</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('inventory-sr-issue' as any); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                activeTab === 'inventory-sr-issue' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                              )}
                            >
                              <ClipboardCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="truncate">Issue from Store Requisition</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('inventory-direct-sr' as any); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                                activeTab === 'inventory-direct-sr' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                              )}
                            >
                              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                              <span className="truncate">Direct Store Requisition</span>
                            </button>
                          </>
                        )}
                        {(allowedPagesSet.has('transactions') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('transactions' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'transactions' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                            <span>Transactions</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('ledger') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('ledger' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'ledger' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <History className="w-4 h-4" />
                            <span>Item Ledger</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('ledger-summary') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('ledger-summary' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'ledger-summary' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>Item Ledger Details</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('issue-analysis') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('issue-analysis' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'issue-analysis' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <PieChartIcon className="w-4 h-4" />
                            <span>Issue Analysis</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('reports') || (allowedPagesSet.has('inventory') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('reports' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'reports' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Reports</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Production Group */}
                {(allowedPagesSet.has('production') || allowedPagesSet.has('production-management') || allowedPagesSet.has('production-dashboard') || allowedPagesSet.has('production-update') || allowedPagesSet.has('production-bom') || allowedPagesSet.has('production-status') || allowedPagesSet.has('production-details') || allowedPagesSet.has('production-requisition') || allowedPagesSet.has('production-process-master') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsProductionSubmenuOpen(!isProductionSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition', 'production-process-master'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-requisition', 'production-process-master'].find(p => allowedPagesSet.has(p)) || 'production-dashboard';
                          setActiveTab(target as any);
                          setIsProductionSubmenuOpen(true);
                          
                        }}
                      >
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span>Production</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isProductionSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isProductionSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('production-dashboard') || allowedPagesSet.has('production-management') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-dashboard' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['production', 'production-management', 'production-dashboard'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Production Dashboard</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-process-master') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-process-master' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-process-master' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Activity className="w-4 h-4" />
                            <span>Process Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-update') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-update' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-update' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Process Update</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-bom') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-bom' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-bom' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>BOM Master</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-status') || allowedPagesSet.has('production-details') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-status' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-status' || activeTab === 'production-details' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Production Status</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('production-requisition') || (allowedPagesSet.has('production') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('production-requisition' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'production-requisition' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Package className="w-4 h-4" />
                            <span>Store Requisition</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Despatch Group */}
                {(allowedPagesSet.has('despatch') || allowedPagesSet.has('despatch-management') || allowedPagesSet.has('despatch-challan') || allowedPagesSet.has('despatch-report') || allowedPagesSet.has('despatch-gatepass') || allowedPagesSet.has('despatch-received') || allowedPagesSet.has('despatch-mrr-receipt') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsDespatchSubmenuOpen(!isDespatchSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'].includes(activeTab)
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = ['despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'].find(p => allowedPagesSet.has(p)) || 'despatch-challan';
                          setActiveTab(target as any);
                          setIsDespatchSubmenuOpen(true);
                          
                        }}
                      >
                        <Truck className="w-5 h-5 text-indigo-600" />
                        <span>Despatch & Delivery</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isDespatchSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isDespatchSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('despatch-challan') || allowedPagesSet.has('despatch-management') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-challan' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              ['despatch', 'despatch-management', 'despatch-challan'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span>Delivery Challan</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-report') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-report' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Challan Register</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-gatepass') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-gatepass' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-gatepass' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Gate Pass</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-received') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-received' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-received' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Received / Returned</span>
                          </button>
                        )}
                        {(allowedPagesSet.has('despatch-mrr-receipt') || (allowedPagesSet.has('despatch') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('despatch-mrr-receipt' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'despatch-mrr-receipt' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FileCheck2 className="w-4 h-4" />
                            <span>Customer MRR Receipt</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Commercial Group */}
                {(allowedPagesSet.has('commercial') || allowedPagesSet.has('commercial-pi') || allowedPagesSet.has('commercial-pi-bill') || allowedPagesSet.has('commercial-pi-wo') || allowedPagesSet.has('commercial-documents') || allowedPagesSet.has('commercial-pi-create') || allowedPagesSet.has('commercial-pi-list') || allowedPagesSet.has('commercial-pi-approvals') || (allowedPagesSet.has('accounts') && isAdmin) || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsCommercialSubmenuOpen(!isCommercialSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['commercial', 'commercial-pi', 'commercial-pi-bill', 'commercial-pi-wo', 'commercial-documents', 'commercial-pi-create', 'commercial-pi-list', 'commercial-pi-approvals'].includes(activeTab) || activeTab.startsWith('commercial-')
                          ? 'bg-slate-800/90 text-teal-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('commercial-pi-bill' as any);
                          setIsCommercialSubmenuOpen(true);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">Commercial</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isCommercialSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isCommercialSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-teal-500/30 space-y-1 py-1">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-pi-bill' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-pi-bill' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <Receipt className="w-4 h-4" />
                          <span>Proforma Invoice From Bill</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-pi-wo' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-pi-wo' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <Layers className="w-4 h-4" />
                          <span>Proforma Invoice From Work Order</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-documents' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-documents' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <FileText className="w-4 h-4" />
                          <span>Document</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab('commercial-pi-list' as any); setIsMobileMenuOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'commercial-pi-list' || activeTab === 'commercial-pi' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <FileCheck2 className="w-4 h-4" />
                          <span>PI Register</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Accounts & Finance Group (Consolidated with Bank Loans & Facilities) */}
                {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || allowedPagesSet.has('accounts-dashboard') || allowedPagesSet.has('accounts-coa') || allowedPagesSet.has('accounts-journal') || allowedPagesSet.has('accounts-cash-bank') || allowedPagesSet.has('accounts-receivable') || allowedPagesSet.has('accounts-payable') || allowedPagesSet.has('accounts-sales') || allowedPagesSet.has('accounts-fixed-assets') || allowedPagesSet.has('accounts-reports') || allowedPagesSet.has('finance-billing') || allowedPagesSet.has('finance-bill-list') || allowedPagesSet.has('finance-mrr-tracker') || allowedPagesSet.has('supplier-ledger') || allowedPagesSet.has('supplier-payment') || allowedPagesSet.has('supplier-report') || allowedPagesSet.has('bank-loans') || allowedPagesSet.has('bank-loan-dashboard') || allowedPagesSet.has('loan-sanctions') || allowedPagesSet.has('loan-records') || allowedPagesSet.has('loan-repayment') || allowedPagesSet.has('loan-repayments') || allowedPagesSet.has('loan-vouchers') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsAccountsSubmenuOpen(!isAccountsSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['accounts', 'accounts-finance', 'accounts-dashboard', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'commercial-pi', 'commercial-pi-create', 'commercial-pi-list', 'commercial-pi-approvals', 'commercial-bank-master', 'bank-master', 'supplier-ledger', 'supplier-payment', 'supplier-report', 'bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers'].includes(activeTab) || activeTab.startsWith('accounts-') || activeTab.startsWith('loan-') || activeTab.startsWith('bank-loan')
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('accounts-dashboard' as any);
                          setIsAccountsSubmenuOpen(true);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">Accounts & Finance</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isAccountsSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isAccountsSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        {/* Section Header: ERP Core Accounting */}
                        <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-indigo-400" />
                          <span>ERP Accounts (8 Menus)</span>
                        </div>

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-dashboard' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              ['accounts', 'accounts-finance', 'accounts-dashboard'].includes(activeTab) ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            <span>Accounts Dashboard</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-coa' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-coa' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <FolderTree className="w-3.5 h-3.5" />
                            <span>1. Chart of Accounts</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-journal' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-journal' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>2. Journal Entry</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-cash-bank' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-cash-bank' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <Landmark className="w-3.5 h-3.5" />
                            <span>3. Cash & Bank</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-receivable' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-receivable' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>4. Customer Receivable</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-payable' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-payable' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>5. Supplier Payable</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-sales' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-sales' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>6. Sales Accounts</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-fixed-assets' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-fixed-assets' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>7. Fixed Assets</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-reports' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-reports' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                            )}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>8. Financial Reports</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || allowedPagesSet.has('accounts-auto-posting') || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('accounts-auto-posting' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'accounts-auto-posting' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50 font-semibold' : 'text-indigo-400 hover:bg-slate-800/70 hover:text-indigo-200'
                            )}
                          >
                            <Workflow className="w-3.5 h-3.5" />
                            <span>9. Auto Journal Mapping</span>
                          </button>
                        )}

                        {/* Section Header: Billing & Operations */}
                        <div className="px-2 pt-2.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400/80 border-t border-slate-800 mt-1.5 flex items-center gap-1">
                          <Receipt className="w-3 h-3 text-slate-400" />
                          <span>Billing & Operations</span>
                        </div>

                        {(allowedPagesSet.has('finance-billing') || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('finance-billing' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'finance-billing' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Plus className="w-4 h-4" />
                            <span>Create Bill</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('finance-bill-list') || (allowedPagesSet.has('accounts') && isAdmin)) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('finance-bill-list' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'finance-bill-list' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Bill Register</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('finance-mrr-tracker') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('finance-mrr-tracker' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'finance-mrr-tracker' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Clock className="w-4 h-4" />
                            <span>MRR Billing Tracker</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('supplier-ledger') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('supplier-ledger' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'supplier-ledger' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>Supplier Ledger</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('supplier-payment') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('supplier-payment' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'supplier-payment' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Supplier Payment</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('supplier-report') || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('supplier-report' as any);  }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'supplier-report' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Supplier Financials</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Bank Loan & Finance Group */}
                {(allowedPagesSet.has('bank-loans') || allowedPagesSet.has('bank-loan-dashboard') || allowedPagesSet.has('loan-sanctions') || allowedPagesSet.has('loan-records') || allowedPagesSet.has('loan-repayment') || allowedPagesSet.has('loan-repayments') || allowedPagesSet.has('loan-vouchers') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => setIsBankLoansSubmenuOpen(!isBankLoansSubmenuOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        ['bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers'].includes(activeTab) || activeTab.startsWith('loan-') || activeTab.startsWith('bank-loan')
                          ? 'bg-slate-800/90 text-emerald-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('bank-loan-dashboard' as any);
                          setIsBankLoansSubmenuOpen(true);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">Bank Loan & Finance</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isBankLoansSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isBankLoansSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-emerald-500/30 space-y-1 py-1">
                        {(allowedPagesSet.has('bank-loan-dashboard') || allowedPagesSet.has('bank-loans') || (allowedPagesSet.has('accounts') && isAdmin) || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('bank-loan-dashboard' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'bank-loan-dashboard' || activeTab === 'bank-loans' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Loan Dashboard</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-sanctions') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin) || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-sanctions' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-sanctions' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Facility & Sanctions</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-records') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin) || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-records' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-records' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Loan Records</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-repayment') || allowedPagesSet.has('loan-repayments') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin) || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-repayment' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-repayment' || activeTab === 'loan-repayments' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Loan Repayments</span>
                          </button>
                        )}

                        {(allowedPagesSet.has('loan-vouchers') || (allowedPagesSet.has('bank-loans') && isAdmin) || (allowedPagesSet.has('accounts') && isAdmin) || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('loan-vouchers' as any); }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                              activeTab === 'loan-vouchers' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                            <span>GL Loan Vouchers</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Admin Control Modules Group */}
                {(allowedPagesSet.has('admin') || isAdmin) && (
                  <div className="space-y-1 my-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminSubmenuOpen(!isAdminSubmenuOpen);
                        if (!activeTab.startsWith('admin')) {
                          setActiveTab('admin-dashboard' as any);
                        }
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        (activeTab === 'admin' || activeTab.startsWith('admin'))
                          ? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'
                      )}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('admin-dashboard' as any);
                          setIsAdminSubmenuOpen(true);
                          
                        }}
                      >
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        <span>Admin Panel</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-slate-400 ml-2",
                          isAdminSubmenuOpen ? "transform rotate-180" : ""
                        )}
                      />
                    </button>
                    {isAdminSubmenuOpen && (
                      <div className="pl-3 ml-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-dashboard' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin' || activeTab === 'admin-dashboard') ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          <span>Admin Dashboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-users' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-users' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <Users className="w-4 h-4" />
                          <span>User Management</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-roles' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-roles' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <KeyRound className="w-4 h-4" />
                          <span>Role Management</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-permissions' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-permissions' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Permission Matrix</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-approvals' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin-approvals' || activeTab === 'admin-approval-setup') ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50 font-semibold' : 'text-emerald-400 hover:bg-slate-800 hover:text-emerald-200'
                          )}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approval Workflows</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-employees' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-employees' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <Briefcase className="w-4 h-4" />
                          <span>Employee Master</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-designations' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin-designations' || activeTab === 'admin-departments' || activeTab === 'admin-business') ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <Building2 className="w-4 h-4" />
                          <span>Designations & Depts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-audit-log' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            (activeTab === 'admin-logs' || activeTab === 'admin-audit-log') ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <Clock className="w-4 h-4" />
                          <span>System Audit Log</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-settings' as any);  }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                            activeTab === 'admin-settings' ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <Settings className="w-4 h-4" />
                          <span>System Settings</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-950/50 transition-colors border border-slate-800/80">
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName)}&background=random`} className="w-8 h-8 rounded-full border border-slate-800" alt={currentUserName} />
            <div className="flex-1 min-w-0 cursor-pointer" onClick={handleOpenProfileModal} title="Click to edit profile & password">
              <p className="text-sm font-semibold text-white truncate">{currentUserName}</p>
            </div>
            <button 
              onClick={handleOpenProfileModal} 
              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Edit Profile & Password"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Sign Out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header (Desktop-ish) */}
        <header className="h-16 bg-white border-b border-neutral-200/80 flex items-center justify-between px-4 md:px-8 print:hidden sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <h2 className="text-base md:text-lg font-bold text-neutral-900 capitalize tracking-tight flex items-center gap-2">
              <span>{activeTab.replace(/-/g, ' ')}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input placeholder="Search records, SKU, suppliers..." className="pl-10 w-72 h-9 bg-neutral-50/80 border-neutral-200 focus:bg-white text-xs" />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => syncAllData()}
              disabled={isSyncing}
              className="h-9 gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 border-neutral-200 hover:bg-neutral-50"
              title="Sync & Refresh Data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-blue-600")} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setActiveTab('approvals')} 
              className="h-9 w-9 rounded-xl text-neutral-600 hover:text-purple-600 hover:bg-purple-50 transition-colors relative border border-neutral-200/60"
              title="Pending Approvals & Notifications"
            >
              <Bell className="w-4 h-4" />
              {totalPendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse shadow-sm">
                  {totalPendingApprovalsCount}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className={cn("flex-1 overflow-y-auto print:p-0", (activeTab.startsWith("accounts") || ["accounts", "accounts-finance", "accounts-dashboard", "accounts-coa", "accounts-journal", "accounts-cash-bank", "accounts-receivable", "accounts-payable", "accounts-sales", "accounts-fixed-assets", "accounts-reports"].includes(activeTab)) ? "p-0 bg-slate-100/60" : "p-4 md:p-8")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {!allowedPagesSet.has(activeTab) && !(isAdmin || isSuperAdmin) && !(activeTab.startsWith('admin') && (allowedPagesSet.has('admin') || isAdmin)) && !(activeTab.startsWith('accounts') && (allowedPagesSet.has('accounts') || allowedPagesSet.has('accounts-finance') || allowedPagesSet.has('accounts-auto-posting') || isAdmin)) ? (
                <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-4 max-w-md mx-auto my-12 shadow-sm">
                  <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-neutral-900">Access Restricted</h3>
                  <p className="text-xs text-neutral-500 font-medium">You do not have permission to view the selected module (<span className="font-mono text-rose-600 font-bold">{activeTab}</span>). Please contact your administrator to grant role access.</p>
                  <button
                    onClick={() => {
                      const firstAllowed = ['dashboard', 'inventory', 'suppliers', 'sales-order-entry', 'reports'].find(p => allowedPagesSet.has(p)) || 'dashboard';
                      setActiveTab(firstAllowed as any);
                    }}
                    className="px-5 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-all shadow-sm"
                  >
                    Return to Allowed Module
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <UnifiedDashboard 
                      items={items} 
                      transactions={allTransactions || transactions} 
                      totalTransactionsCount={totalTransactionsCount} 
                      userProfile={userProfile!} 
                      allowedPagesSet={allowedPagesSet}
                      showToast={showToast} 
                      syncAllData={syncAllData} 
                      isSyncing={isSyncing} 
                      cleanupSKURange={cleanupSKURange} 
                      backupDataToJSON={backupDataToJSON} 
                      exportUserProfileToCSV={exportUserProfileToCSV} 
                      suppliers={suppliers}
                      purchaseOrders={purchaseOrders}
                      supplierPayments={supplierPayments}
                      onNavigate={(tab) => setActiveTab(tab as any)}
                    />
                  )}
              {(activeTab === 'inventory' || activeTab === 'inventory-requisition' || activeTab === 'inventory-sr-issue' || activeTab === 'inventory-direct-sr') && (
                <InventoryView 
                  items={items} 
                  categories={categories} 
                  transactions={allTransactions || transactions} 
                  userProfile={userProfile!} 
                  showToast={showToast} 
                  syncAllData={syncAllData} 
                  isSyncing={isSyncing} 
                  fetchFullHistory={fetchFullHistory} 
                  exportItemsToCSV={exportItemsToCSV} 
                  exportCategoriesToCSV={exportCategoriesToCSV}
                  recalculateItemStock={recalculateItemStock}
                  defaultOpenRequisitionModal={activeTab === 'inventory-requisition'}
                  defaultOpenSrIssueModal={activeTab === 'inventory-sr-issue'}
                  defaultOpenDirectSrModal={activeTab === 'inventory-direct-sr'}
                  onCloseIssueModal={() => {
                    if (['inventory-requisition', 'inventory-sr-issue', 'inventory-direct-sr'].includes(activeTab)) {
                      setActiveTab('inventory');
                    }
                  }}
                />
              )}
              {activeTab === 'transactions' && (
                <TransactionsView 
                  items={items} 
                  transactions={allTransactions || transactions} 
                  userProfile={userProfile!} 
                  showToast={showToast} 
                  fetchFullHistory={fetchFullHistory} 
                  syncAllData={syncAllData} 
                  isHistoryLoading={isHistoryLoading} 
                  exportTransactionsToCSV={exportTransactionsToCSV}
                  recalculateItemStock={recalculateItemStock}
                />
              )}
              {['procurement', 'procurement-requisition', 'procurement-po', 'procurement-mrr', 'procurement-suppliers', 'purchases', 'suppliers'].includes(activeTab) && (
                <ProcurementManagement
                  userProfile={userProfile!}
                  suppliers={suppliers}
                  purchaseOrders={purchaseOrders}
                  items={items}
                  showToast={showToast}
                  recalculateItemStock={recalculateItemStock}
                  fetchFullHistory={fetchFullHistory}
                  syncAllData={syncAllData}
                  isEditor={userProfile!.role === 'admin' || userProfile!.role === 'editor'}
                  initialSubTab={
                    activeTab === 'procurement-po' || activeTab === 'purchases' ? 'purchases' :
                    activeTab === 'procurement-mrr' ? 'mrr' :
                    activeTab === 'procurement-suppliers' || activeTab === 'suppliers' ? 'suppliers' :
                    'requisitions'
                  }
                  onSubTabChange={(sub) => {
                    if (sub === 'purchases') setActiveTab('procurement-po' as any);
                    else if (sub === 'mrr') setActiveTab('procurement-mrr' as any);
                    else if (sub === 'suppliers') setActiveTab('procurement-suppliers' as any);
                    else setActiveTab('procurement-requisition' as any);
                  }}
                  roles={roles}
                  allowedPagesSet={allowedPagesSet}
                />
              )}
              {['sales', 'sales-order-entry', 'sales-create-order', 'sales-order-list', 'sales-rectify-requests', 'sales-mrr-receipt', 'sales-booking-report', 'sales-sales-report', 'sales-currency-master', 'sales-price-master', 'sales-buyer-master', 'sales-customer-master', 'sales-fg-master', 'sales-category-master', 'sales-subcategory-master', 'sales-section-master', 'sales-process-master'].includes(activeTab) && (
                <SalesOrderEntry
                  userProfile={userProfile!}
                  showToast={showToast}
                  allowedPagesSet={allowedPagesSet}
                  roles={roles}
                  activeSubTab={
                    activeTab === 'sales-create-order' ? 'create' :
                    activeTab === 'sales-order-list' ? 'list' :
                    activeTab === 'sales-rectify-requests' ? 'rectify-requests' :
                    activeTab === 'sales-mrr-receipt' ? 'mrr-receipt' :
                    activeTab === 'sales-booking-report' ? 'booking-report' :
                    activeTab === 'sales-sales-report' ? 'sales-report' :
                    activeTab === 'sales-currency-master' ? 'currency-master' :
                    activeTab === 'sales-price-master' ? 'price-master' :
                    activeTab === 'sales-buyer-master' ? 'buyer-master' :
                    activeTab === 'sales-customer-master' ? 'customer-master' :
                    activeTab === 'sales-fg-master' ? 'fg-master' :
                    activeTab === 'sales-category-master' ? 'category-master' :
                    activeTab === 'sales-subcategory-master' ? 'subcategory-master' :
                    activeTab === 'sales-section-master' ? 'section-master' :
                    activeTab === 'sales-process-master' ? 'process-master' :
                    'entry'
                  }
                  onSubTabChange={(sub) => {
                    const tabMap: Record<string, string> = {
                      'entry': 'sales-order-entry',
                      'create': 'sales-create-order',
                      'list': 'sales-order-list',
                      'rectify-requests': 'sales-rectify-requests',
                      'mrr-receipt': 'sales-mrr-receipt',
                      'booking-report': 'sales-booking-report',
                      'sales-report': 'sales-sales-report',
                      'currency-master': 'sales-currency-master',
                      'price-master': 'sales-price-master',
                      'buyer-master': 'sales-buyer-master',
                      'customer-master': 'sales-customer-master',
                      'fg-master': 'sales-fg-master',
                      'category-master': 'sales-category-master',
                      'subcategory-master': 'sales-subcategory-master',
                      'section-master': 'sales-section-master',
                      'process-master': 'sales-process-master'
                    };
                    setActiveTab((tabMap[sub] || 'sales-order-entry') as any);
                  }}
                />
              )}
              {['product-development', 'pd-product-master', 'pd-ups-calculation', 'pd-costing', 'pd-history'].includes(activeTab) && (
                <ProductDevelopmentModule
                  items={items}
                  purchaseOrders={purchaseOrders}
                  transactions={allTransactions || transactions}
                  userProfile={userProfile!}
                  showToast={showToast}
                  allowedPagesSet={allowedPagesSet}
                  roles={roles}
                  initialSubTab={
                    activeTab === 'pd-product-master' ? 'pd-product-master' :
                    activeTab === 'pd-costing' ? 'pd-costing' :
                    activeTab === 'pd-history' ? 'pd-history' :
                    'pd-ups-calculation'
                  }
                  onSubTabChange={(sub) => setActiveTab(sub as any)}
                />
              )}
              {activeTab === 'dyeing' && (
                <DyeingManagement
                  userProfile={userProfile!}
                  suppliers={suppliers}
                  purchaseOrders={purchaseOrders}
                  items={items}
                  showToast={showToast}
                  recalculateItemStock={recalculateItemStock}
                  fetchFullHistory={fetchFullHistory}
                  syncAllData={syncAllData}
                  isEditor={userProfile!.role === 'admin' || userProfile!.role === 'editor'}
                />
              )}
              {['production', 'production-management', 'production-dashboard', 'production-update', 'production-bom', 'production-status', 'production-details', 'production-requisition', 'production-process-master'].includes(activeTab) && (
                <ProductionManagement
                  userProfile={userProfile!}
                  items={items}
                  showToast={showToast}
                  recalculateItemStock={recalculateItemStock}
                  allowedPagesSet={allowedPagesSet}
                  roles={roles}
                  activeSubTab={
                    activeTab === 'production-update' ? 'production-update' :
                    activeTab === 'production-bom' ? 'production-bom' :
                    activeTab === 'production-status' ? 'production-status' :
                    activeTab === 'production-details' ? 'production-details' :
                    activeTab === 'production-requisition' ? 'production-requisition' :
                    activeTab === 'production-process-master' ? 'production-process-master' :
                    'production-dashboard'
                  }
                  onSubTabChange={(sub) => setActiveTab(sub as any)}
                  onNavigateToDespatch={() => setActiveTab('despatch-challan' as any)}
                />
              )}
              {['despatch', 'despatch-management', 'despatch-challan', 'despatch-report', 'despatch-gatepass', 'despatch-received', 'despatch-mrr-receipt'].includes(activeTab) && (
                <DespatchManagement
                  userProfile={userProfile!}
                  showToast={showToast}
                  allowedPagesSet={allowedPagesSet}
                  roles={roles}
                  activeSubTab={
                    activeTab === 'despatch-report' ? 'despatch-report' :
                    activeTab === 'despatch-gatepass' ? 'despatch-gatepass' :
                    activeTab === 'despatch-received' ? 'despatch-received' :
                    activeTab === 'despatch-mrr-receipt' ? 'despatch-mrr-receipt' :
                    'despatch-challan'
                  }
                  onSubTabChange={(sub) => setActiveTab(sub as any)}
                />
              )}
              {['subcontract', 'subcontract-management', 'subcontract-dashboard', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery', 'subcontract-item-master', 'subcontract-category-master', 'subcontract-subcategory-master', 'subcontract-price-master', 'subcontract-po', 'subcontract-issue', 'subcontract-receive', 'subcontract-reports'].includes(activeTab) && (
                <SubContractManagement
                  userProfile={userProfile!}
                  suppliers={suppliers}
                  showToast={showToast}
                  isEditor={userProfile!.role === 'admin' || userProfile!.role === 'editor'}
                  allowedPagesSet={allowedPagesSet}
                  roles={roles}
                  initialSubTab={
                    activeTab === 'subcontract-subcategory-master' || activeTab === 'subcontract-item-master' || activeTab === 'subcontract-category-master' ? 'subcategory_master' :
                    activeTab === 'subcontract-price-master' ? 'price_master' :
                    activeTab === 'subcontract-po' || activeTab === 'subcontract-dyeing' || activeTab === 'subcontract-woven' || activeTab === 'subcontract-embroidery' ? 'purchase_order' :
                    activeTab === 'subcontract-issue' ? 'issue_delivery' :
                    activeTab === 'subcontract-receive' ? 'receive' :
                    activeTab === 'subcontract-reports' ? 'reports' :
                    'dashboard'
                  }
                />
              )}
              {(['accounts', 'accounts-finance', 'accounts-dashboard', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'accounts-financial-reports'].includes(activeTab) || activeTab.startsWith('accounts-')) && (
                <AccountsModule
                  userProfile={userProfile!}
                  currencySymbol="$"
                  initialMenu={
                    activeTab === 'accounts-coa' ? 'chart_of_accounts' :
                    activeTab === 'accounts-journal' ? 'journal_entry' :
                    activeTab === 'accounts-cash-bank' ? 'cash_bank' :
                    activeTab === 'accounts-receivable' ? 'customer_receivable' :
                    activeTab === 'accounts-payable' ? 'supplier_payable' :
                    activeTab === 'accounts-sales' ? 'sales_accounts' :
                    activeTab === 'accounts-fixed-assets' ? 'fixed_assets' :
                    (activeTab === 'accounts-reports' || activeTab === 'accounts-financial-reports') ? 'financial_reports' :
                    activeTab === 'accounts-auto-posting' ? 'auto_posting_mapping' :
                    'dashboard'
                  }
                  onSwitchToBilling={() => setActiveTab('finance-billing' as any)}
                  onMenuChange={(menu) => {
                    if (menu === 'chart_of_accounts') setActiveTab('accounts-coa' as any);
                    else if (menu === 'journal_entry') setActiveTab('accounts-journal' as any);
                    else if (menu === 'cash_bank') setActiveTab('accounts-cash-bank' as any);
                    else if (menu === 'customer_receivable') setActiveTab('accounts-receivable' as any);
                    else if (menu === 'supplier_payable') setActiveTab('accounts-payable' as any);
                    else if (menu === 'sales_accounts') setActiveTab('accounts-sales' as any);
                    else if (menu === 'fixed_assets') setActiveTab('accounts-fixed-assets' as any);
                    else if (menu === 'financial_reports') setActiveTab('accounts-reports' as any);
                    else if (menu === 'auto_posting_mapping') setActiveTab('accounts-auto-posting' as any);
                    else setActiveTab('accounts-dashboard' as any);
                  }}
                />
              )}
              {['finance-billing', 'finance-bill-list', 'finance-mrr-tracker', 'supplier-ledger', 'supplier-payment', 'supplier-report'].includes(activeTab) && (
                <AccountsFinanceView
                  userProfile={userProfile!}
                  showToast={showToast}
                  suppliers={suppliers}
                  purchaseOrders={purchaseOrders}
                  supplierPayments={supplierPayments}
                  items={items}
                  recalculateItemStock={recalculateItemStock}
                  fetchFullHistory={fetchFullHistory}
                  syncAllData={syncAllData}
                  isEditor={userProfile!.role === 'admin' || userProfile!.role === 'editor'}
                  roles={roles}
                  allowedPagesSet={allowedPagesSet}
                  onCreatePI={(billId) => {
                    setSelectedBillForPI(billId);
                    setSelectedWoForPI('');
                    setActiveTab('commercial-pi' as any);
                  }}
                  initialSubTab={
                    activeTab === 'finance-bill-list' ? 'bill-list' :
                    activeTab === 'finance-mrr-tracker' ? 'mrr-status' :
                    activeTab === 'supplier-ledger' ? 'supplier-ledger' :
                    activeTab === 'supplier-payment' ? 'supplier-payment' :
                    activeTab === 'supplier-report' ? 'supplier-report' :
                    'create-bill'
                  }
                  onSubTabChange={(sub) => {
                    if (sub === 'bill-list' && (allowedPagesSet.has('finance-bill-list') || isSuperAdmin)) setActiveTab('finance-bill-list' as any);
                    else if (sub === 'mrr-status' && (allowedPagesSet.has('finance-mrr-tracker') || isSuperAdmin)) setActiveTab('finance-mrr-tracker' as any);
                    else if (sub === 'supplier-ledger' && (allowedPagesSet.has('supplier-ledger') || isSuperAdmin)) setActiveTab('supplier-ledger' as any);
                    else if (sub === 'supplier-payment' && (allowedPagesSet.has('supplier-payment') || isSuperAdmin)) setActiveTab('supplier-payment' as any);
                    else if (sub === 'supplier-report' && (allowedPagesSet.has('supplier-report') || isSuperAdmin)) setActiveTab('supplier-report' as any);
                    else if (allowedPagesSet.has('finance-billing') || allowedPagesSet.has('finance-create-bill') || isSuperAdmin) setActiveTab('finance-billing' as any);
                  }}
                />
              )}
              {['sales-company-master', 'company-master'].includes(activeTab) && (
                <CompanyMasterView
                  userProfile={userProfile!}
                  userEmail={userProfile?.email}
                  businessId={userProfile?.businessId || 'default'}
                  isAdmin={userProfile?.role === 'admin'}
                  showToast={showToast}
                />
              )}
              {['bank-master', 'sales-bank-master'].includes(activeTab) && (
                <BankMasterView
                  userProfile={userProfile!}
                  showToast={showToast}
                />
              )}
              {['commercial', 'commercial-pi', 'commercial-pi-bill', 'commercial-pi-wo', 'commercial-documents', 'commercial-pi-create', 'commercial-pi-list', 'commercial-pi-approvals', 'commercial-bank-master'].includes(activeTab) && (
                <ProformaInvoiceManagement
                  userProfile={userProfile!}
                  showToast={showToast}
                  allowedPagesSet={allowedPagesSet}
                  roles={roles}
                  initialMainTab={
                    activeTab === 'commercial-documents' ? 'document' :
                    activeTab === 'commercial-pi-wo' ? 'create-pi-wo' :
                    activeTab === 'commercial-pi-bill' ? 'create-pi-bill' :
                    activeTab === 'commercial-pi-create' ? 'create-pi-bill' :
                    activeTab === 'commercial-pi-approvals' ? 'pending-approvals' :
                    activeTab === 'commercial-pi-list' ? 'pi-list' :
                    'create-pi-bill'
                  }
                  initialBillId={selectedBillForPI}
                  initialWoId={selectedWoForPI}
                  onNavigateToBill={(billId) => {
                    setActiveTab('finance-bill-list' as any);
                  }}
                  onNavigateToWorkOrder={(woId) => {
                    setActiveTab('sales-order-list' as any);
                  }}
                  onSubTabChange={(tab) => {
                    if (tab === 'document') setActiveTab('commercial-documents' as any);
                    else if (tab === 'create-pi-wo') setActiveTab('commercial-pi-wo' as any);
                    else if (tab === 'create-pi-bill') setActiveTab('commercial-pi-bill' as any);
                    else if (tab === 'pending-approvals') setActiveTab('commercial-pi-approvals' as any);
                    else if (tab === 'pi-list') setActiveTab('commercial-pi-list' as any);
                    else setActiveTab('commercial-pi-bill' as any);
                  }}
                />
              )}
              {['bank-loans', 'bank-loan-dashboard', 'loan-sanctions', 'loan-records', 'loan-repayment', 'loan-repayments', 'loan-vouchers'].includes(activeTab) && (
                <BankLoanManagement
                  userProfile={userProfile!}
                  showToast={showToast}
                  roles={roles}
                  allowedPagesSet={allowedPagesSet}
                  initialSubTab={
                    activeTab === 'loan-sanctions' ? 'sanctions' :
                    activeTab === 'loan-records' ? 'loans' :
                    (activeTab === 'loan-repayment' || activeTab === 'loan-repayments') ? 'repayments' :
                    activeTab === 'loan-vouchers' ? 'gl_vouchers' :
                    'dashboard'
                  }
                  onSubTabChange={(sub) => {
                    if (sub === 'sanctions') setActiveTab('loan-sanctions' as any);
                    else if (sub === 'loans') setActiveTab('loan-records' as any);
                    else if (sub === 'repayments') setActiveTab('loan-repayment' as any);
                    else if (sub === 'gl_vouchers') setActiveTab('loan-vouchers' as any);
                    else setActiveTab('bank-loans' as any);
                  }}
                />
              )}
              {activeTab === 'ledger' && <LedgerView items={items} transactions={allTransactions || transactions} fetchFullHistory={fetchFullHistory} isHistoryLoading={isHistoryLoading} />}
              {activeTab === 'ledger-summary' && <LedgerSummaryView items={items} transactions={allTransactions || transactions} fetchFullHistory={fetchFullHistory} isHistoryLoading={isHistoryLoading} />}
              {activeTab === 'reports' && <ReportsView items={items} transactions={allTransactions || transactions} categories={categories} fetchFullHistory={fetchFullHistory} isHistoryLoading={isHistoryLoading} />}
              {activeTab === 'calculators' && <CalculatorsView items={items} formulas={formulas} userProfile={userProfile!} showToast={showToast} />}
              {activeTab === 'approvals' && (
                <ApprovalsView
                  items={items}
                  transactions={transactions}
                  purchaseOrders={purchaseOrders}
                  suppliers={suppliers}
                  userProfile={userProfile!}
                  showToast={showToast}
                  recalculateItemStock={recalculateItemStock}
                  fetchFullHistory={fetchFullHistory}
                  syncAllData={syncAllData}
                  approvalRequests={approvalRequests}
                />
              )}
              {activeTab === 'issue-analysis' && <IssueAnalysisView transactions={allTransactions || transactions} items={items} categories={categories} onBack={() => setActiveTab('dashboard')} />}
              {(activeTab === 'sql-migration' || activeTab === 'data-migration') && isAdmin && (
                <DataMigrationManager userProfile={userProfile!} />
              )}
              {(activeTab === 'admin' || activeTab.startsWith('admin')) && (allowedPagesSet.has('admin') || isAdmin) && (
                <AdminLayout
                  currentUserEmail={userProfile?.email}
                  currentUserName={currentUserName}
                  businessId={userProfile?.businessId || 'default'}
                  onReturnToErp={() => setActiveTab('dashboard')}
                  activeTabOverride={activeTab}
                  embedMode={true}
                  onTabChange={(tab) => setActiveTab(tab as any)}
                  allowedPagesSet={allowedPagesSet}
                  roles={roles}
                />
              )}
            </>
          )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* My Profile & Security Password Modal */}
        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="Edit Profile & Security Password"
        >
          <form onSubmit={handleSaveMyProfile} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Your Display Name</label>
              <Input
                type="text"
                placeholder="Type your display name manually..."
                value={profileDisplayName}
                onChange={(e) => setProfileDisplayName(e.target.value)}
                className="h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">User ID / Email Address</label>
              <Input
                type="text"
                value={user?.email || ''}
                disabled
                className="h-10 bg-neutral-100 text-neutral-500 font-mono cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">New Password (Optional)</label>
              <div className="relative">
                <Input
                  type={showProfilePassword ? "text" : "password"}
                  placeholder="Type new password manually..."
                  value={profileNewPassword}
                  onChange={(e) => setProfileNewPassword(e.target.value)}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowProfilePassword(!showProfilePassword)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                >
                  {showProfilePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-neutral-400">Leave blank if you don't want to change your password.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProfileModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}

// --- View Components ---

function DashboardView({ 
  items, 
  transactions, 
  totalTransactionsCount, 
  userProfile, 
  showToast, 
  syncAllData, 
  isSyncing, 
  cleanupSKURange, 
  backupDataToJSON, 
  exportUserProfileToCSV,
  suppliers = [],
  purchaseOrders = [],
  supplierPayments = [],
  onNavigateToSuppliers
}: { 
  items: Item[]; 
  transactions: Transaction[]; 
  totalTransactionsCount: number; 
  userProfile: UserProfile; 
  showToast: (msg: string, type?: 'success' | 'error') => void; 
  syncAllData: () => Promise<void>; 
  isSyncing: boolean; 
  cleanupSKURange: () => Promise<void>; 
  backupDataToJSON: () => Promise<void>; 
  exportUserProfileToCSV: () => void;
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  supplierPayments?: SupplierPayment[];
  onNavigateToSuppliers?: () => void;
}) {
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showRecentTxModal, setShowRecentTxModal] = useState(false);

  // Supplier Report (Current Month Movement & Outstanding Due)
  const supplierReport = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    let totalDueBalance = 0;
    let totalThisMonthPurchases = 0; // + Increased due to POs
    let totalThisMonthPayments = 0;  // - Decreased due to Payments

    const perSupplierMap: Record<string, {
      id: string;
      name: string;
      contactPerson?: string;
      phone?: string;
      totalDue: number;
      monthPurchases: number;
      monthPayments: number;
    }> = {};

    suppliers.forEach(s => {
      const ob = Number(s.openingBalance) || 0;
      perSupplierMap[s.id] = {
        id: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        totalDue: -ob, // Payable opening balance is Credit (-ob)
        monthPurchases: 0,
        monthPayments: 0
      };
    });

    purchaseOrders.forEach(po => {
      const isDyeing = (po.purchaseType as string) === 'Dyeing' || po.poNumber.toUpperCase().includes('DYE');
      if (!isDyeing && (po.status as string) !== 'deleted') {
        const amt = Number(po.totalAmount) || 0;
        if (perSupplierMap[po.supplierId]) {
          perSupplierMap[po.supplierId].totalDue -= amt; // Purchase is Credit (-)
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
        perSupplierMap[pm.supplierId].totalDue += amt; // Payment is Debit (+)
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
    return supplierReport.list.slice(0, 8).map(s => ({
      shortName: s.name.length > 12 ? s.name.substring(0, 10) + '..' : s.name,
      fullName: s.name,
      'Net Due': s.totalDue < 0 ? Math.abs(s.totalDue) : 0,
      'Purchases': s.monthPurchases,
      'Payments': s.monthPayments,
    }));
  }, [supplierReport.list]);

  const stats = useMemo(() => {
    const activeItems = items.filter(i => i.status !== 'pending_delete');
    const activeTransactions = transactions.filter(tx => tx.status !== 'pending_delete');
    
    // Total Items & Value - calculated using high-performance real-time cached fields
    const totalItems = activeItems.length;
    const totalStockValue = activeItems.reduce((acc, item) => acc + (Number(item.totalValue) || 0), 0);
    const totalTransactions = totalTransactionsCount;

    const lowStockItems = activeItems.filter(item => {
      const stock = Number(item.currentStock) || 0;
      const min = Number(item.minStock) || 0;
      return min > 0 && stock <= min;
    }).length;

    const recentTransactions = [...activeTransactions]
      .sort((a, b) => b.date.toMillis() - a.date.toMillis())
      .slice(0, 5);

    // Estimate storage: ~1.2KB per document
    const estimatedUsageKB = (totalItems + totalTransactions) * 1.2;
    const usagePercentage = (estimatedUsageKB / (1024 * 1024)) * 100;

    // Monthly Comparison Data
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const getMonthlyStats = (start: Date, end: Date) => {
      return transactions.filter(tx => {
        const txDate = tx.date.toDate();
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
        name: format(prevMonthStart, 'MMMM'),
        IN: prevStats.in,
        ISSUE: prevStats.out,
      },
      {
        name: format(currentMonthStart, 'MMMM'),
        IN: currentStats.in,
        ISSUE: currentStats.out,
      }
    ];

    // Issue Analysis Breakdown (Current Month)
    const issueBreakdown = transactions.filter(tx => {
      const txDate = tx.date.toDate();
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

    // Purchase Source Breakdown (Current Month)
    const purchaseBreakdown = transactions.filter(tx => {
      const txDate = tx.date.toDate();
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

    return { totalItems, totalTransactions, totalStockValue, lowStockItems, recentTransactions, estimatedUsageKB, usagePercentage, chartData, issueBreakdown, purchaseBreakdown };
  }, [items, transactions]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Summary Header */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-neutral-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live ERP System
            </span>
            <span className="text-xs text-neutral-400 font-medium">| {format(new Date(), 'EEEE, dd MMMM yyyy')}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-neutral-900 tracking-tight">
            Inventory & Operations Overview
          </h2>
          <p className="text-xs text-neutral-500">
            Welcome back, <span className="font-semibold text-neutral-700">{(userProfile?.displayName && !userProfile.displayName.includes('@')) ? userProfile.displayName : (userProfile?.name || (userProfile?.email ? userProfile.email.split('@')[0] : 'User'))}</span>! Real-time stock levels, purchase movement, and supplier balances.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={syncAllData} 
            disabled={isSyncing}
            className="h-9 text-xs font-bold gap-1.5 border-neutral-200 text-neutral-700 hover:bg-neutral-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-indigo-600")} />
            {isSyncing ? 'Refreshing...' : 'Refresh Overview'}
          </Button>
        </div>
      </div>

      {stats.totalStockValue === 0 && stats.totalTransactions > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Data Sync Required</p>
            <p className="text-xs text-amber-700">Your dashboard shows 0 value but you have transactions. Please click "Sync All Data" to update your stock levels.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100 font-bold text-xs"
            onClick={syncAllData}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      )}

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Items</span>
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{stats.totalItems}</h3>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">Catalog item varieties in stock</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Closing Stock Value</span>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
            BDT {stats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </h3>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Real-time total inventory valuation</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Low Stock Alerts</span>
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{stats.lowStockItems}</h3>
          <p className="text-[11px] text-amber-700 font-medium mt-1">Items at or below safety threshold</p>
        </div>

        <div 
          className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer"
          onClick={onNavigateToSuppliers}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Supplier Payable</span>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
            BDT {supplierReport.totalDueBalance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </h3>
          <p className="text-[11px] text-purple-700 font-medium mt-1 truncate">
            +Tk{supplierReport.totalThisMonthPurchases.toLocaleString()} POs | -Tk{supplierReport.totalThisMonthPayments.toLocaleString()} Paid
          </p>
        </div>
      </div>

      {/* Supplier Report Section */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-lg">Supplier Dues & Monthly Report</h3>
              <p className="text-xs text-neutral-500">
                Current Month: <span className="font-bold text-neutral-700">{format(new Date(), 'MMMM yyyy')}</span>
              </p>
            </div>
          </div>
          {onNavigateToSuppliers && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onNavigateToSuppliers}
              className="flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 self-start md:self-auto"
            >
              <span>Manage Suppliers & Payments</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 4 Summary Stat Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Total Outstanding Due</span>
              <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">All Time</span>
            </div>
            <h4 className="text-xl font-black text-purple-950 tracking-tight">
              BDT {supplierReport.totalDueBalance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </h4>
            <p className="text-[11px] text-purple-700/80 mt-1 font-medium">Total payable balance across all suppliers</p>
          </div>

          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">This Month Purchases (+ Due)</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">POs IN</span>
            </div>
            <h4 className="text-xl font-black text-amber-950 tracking-tight">
              + BDT {supplierReport.totalThisMonthPurchases.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </h4>
            <p className="text-[11px] text-amber-700/80 mt-1 font-medium">New purchase orders added this month</p>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">This Month Payments (- Cleared)</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Paid OUT</span>
            </div>
            <h4 className="text-xl font-black text-emerald-950 tracking-tight">
              - BDT {supplierReport.totalThisMonthPayments.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </h4>
            <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">Payments made to suppliers this month</p>
          </div>

          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Net Monthly Change</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Shift</span>
            </div>
            <h4 className="text-xl font-black text-blue-950 tracking-tight">
              {supplierReport.netMonthChange >= 0 ? '+' : ''} BDT {supplierReport.netMonthChange.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </h4>
            <p className="text-[11px] text-blue-700/80 mt-1 font-medium">
              {supplierReport.netMonthChange >= 0 ? 'Dues increased this month' : 'Dues decreased this month'}
            </p>
          </div>
        </div>

        {/* Compact Histogram Bar Chart */}
        {supplierChartData.length > 0 && (
          <div className="mb-6 p-4 bg-neutral-50/70 rounded-xl border border-neutral-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-xs text-neutral-700 uppercase tracking-wider">Supplier Dues & Monthly Movement Histogram</h4>
              <span className="text-[10px] text-neutral-400 font-medium">Top Suppliers Comparison</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip 
                    formatter={(val: any) => [`BDT ${Number(val).toLocaleString()}`, '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="Net Due" fill="#9333ea" name="Net Due" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Purchases" fill="#f59e0b" name="This Month POs" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Payments" fill="#10b981" name="This Month Paid" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-neutral-900">Monthly Comparison</h3>
              <p className="text-xs text-neutral-500">Inventory Value (IN vs ISSUE)</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Stock IN</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Issue OUT</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#888', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#888', fontSize: 12 }}
                  tickFormatter={(value) => `Tk${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  formatter={(value: any) => [`BDT ${value.toLocaleString()}`, '']}
                />
                <Bar dataKey="IN" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="ISSUE" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="font-bold text-neutral-900 border-b border-neutral-50 pb-4 flex justify-between items-center">
                <span>Issue Analysis</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">{format(new Date(), 'MMMM')}</span>
              </h3>
              <div className="h-[200px] w-full flex items-center justify-center">
                {stats.issueBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.issueBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {stats.issueBreakdown.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={['#ef4444', '#f97316', '#a855f7', '#3b82f6'][index % 4]} 
                            className="drop-shadow-md"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`BDT ${value.toLocaleString()}`, 'Value']}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        iconType="circle" 
                        formatter={(value) => <span className="text-[10px] font-bold text-neutral-500 uppercase">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center space-y-2">
                    <PieChartIcon className="w-8 h-8 text-neutral-200 mx-auto" />
                    <p className="text-[10px] text-neutral-400 font-medium italic">No issue data for {format(new Date(), 'MMMM')}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 md:border-l md:border-neutral-100 md:pl-8">
              <h3 className="font-bold text-neutral-900 border-b border-neutral-50 pb-4 flex justify-between items-center">
                <span>Purchase Source</span>
                <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Local vs Bond</span>
              </h3>
              <div className="h-[200px] w-full flex items-center justify-center">
                {stats.purchaseBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.purchaseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {stats.purchaseBreakdown.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.name === 'Local' ? '#10b981' : '#6366f1'} 
                            className="drop-shadow-md"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`BDT ${value.toLocaleString()}`, 'Value']}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        iconType="circle" 
                        formatter={(value) => <span className="text-[10px] font-bold text-neutral-500 uppercase">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center space-y-2">
                    <PieChartIcon className="w-8 h-8 text-neutral-200 mx-auto" />
                    <p className="text-[10px] text-neutral-400 font-medium italic">No purchase data yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-4 pt-6 border-t border-neutral-50 mt-6">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
              <p className="text-[10px] text-green-600 font-bold uppercase mb-1">Growth (IN Value)</p>
              <div className="flex items-end justify-between">
                <h4 className="text-xl font-black text-green-900">
                  {stats.chartData[1].IN > stats.chartData[0].IN ? '+' : ''}
                  {stats.chartData[0].IN !== 0 
                    ? (((stats.chartData[1].IN - stats.chartData[0].IN) / stats.chartData[0].IN) * 100).toFixed(1)
                    : '100'}%
                </h4>
                <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4 text-green-700 rotate-90" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-neutral-900">Recent Transactions</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowRecentTxModal(true)}>View All</Button>
          </div>
          <div className="space-y-4">
            {stats.recentTransactions.map((tx) => {
              const item = items.find(i => i.id === tx.itemId);
              return (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      tx.type === 'IN' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {tx.type === 'IN' ? <Plus className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{item?.name || 'Unknown Item'}</p>
                      <p className="text-xs text-neutral-500">{format(tx.date.toDate(), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-bold",
                      tx.type === 'IN' ? "text-green-600" : "text-red-600"
                    )}>
                      {tx.type === 'IN' ? '+' : '-'}{tx.quantity} {item?.unit}
                    </p>
                    <p className="text-xs text-neutral-400">BDT {(tx.quantity * tx.price).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
            {stats.recentTransactions.length === 0 && (
              <div className="text-center py-8 text-neutral-400 italic">No transactions yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-neutral-900">Low Stock Alerts</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowLowStockModal(true)}>View All</Button>
          </div>
          <div className="space-y-4">
            {items.filter(i => i.minStock && i.currentStock <= i.minStock).slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border border-orange-100 bg-orange-50/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                    <p className="text-xs text-neutral-500">SKU: {item.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-orange-600">{item.currentStock} {item.unit}</p>
                  <p className="text-[10px] text-neutral-400">Min: {item.minStock} {item.unit}</p>
                </div>
              </div>
            ))}
            {items.filter(i => i.minStock && i.currentStock <= i.minStock).length === 0 && (
              <div className="text-center py-8 text-neutral-400 italic">All stock levels are healthy.</div>
            )}
          </div>
        </Card>
      </div>

      {/* Low Stock All Items Modal */}
      <Modal 
        isOpen={showLowStockModal} 
        onClose={() => setShowLowStockModal(false)} 
        title="All Low Stock Alerts"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {items.filter(i => i.minStock && i.currentStock <= Number(i.minStock)).map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 border border-orange-100 bg-orange-50/50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900">{item.name}</p>
                  <p className="text-xs text-neutral-500 font-mono">SKU: {item.sku}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-orange-600 leading-tight">{item.currentStock} {item.unit}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Min: {item.minStock}</p>
              </div>
            </div>
          ))}
          {items.filter(i => i.minStock && i.currentStock <= i.minStock).length === 0 && (
            <div className="text-center py-12 text-neutral-400 italic">No low stock items found.</div>
          )}
        </div>
        <div className="mt-6">
          <Button variant="secondary" className="w-full" onClick={() => setShowLowStockModal(false)}>Close</Button>
        </div>
      </Modal>

      {/* Recent Transactions All Modal */}
      <Modal 
        isOpen={showRecentTxModal} 
        onClose={() => setShowRecentTxModal(false)} 
        title="Recent Activity"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {transactions.filter(tx => tx.status !== 'pending_delete').sort((a,b) => b.date.toMillis() - a.date.toMillis()).slice(0, 30).map((tx) => {
            const item = items.find(i => i.id === tx.itemId);
            return (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 transition-colors border border-neutral-50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center",
                    ['IN', 'PRODUCTION_RETURN'].includes(tx.type) ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    {['IN', 'PRODUCTION_RETURN'].includes(tx.type) ? <Plus className="w-4 h-4" /> : <Plus className="w-4 h-4 rotate-45" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{item?.name || 'Unknown Item'}</p>
                    <p className="text-[10px] text-neutral-500 font-medium">{format(tx.date.toDate(), 'MMM dd, hh:mm a')} - {tx.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-black",
                    ['IN', 'PRODUCTION_RETURN'].includes(tx.type) ? "text-green-600" : "text-red-600"
                  )}>
                    {['IN', 'PRODUCTION_RETURN'].includes(tx.type) ? '+' : '-'}{tx.quantity}
                  </p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">BDT {(tx.quantity * tx.price).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          <Button variant="secondary" className="w-full" onClick={() => setShowRecentTxModal(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}

function InventoryView({ 
  items, 
  categories, 
  transactions, 
  userProfile, 
  showToast, 
  syncAllData, 
  isSyncing, 
  fetchFullHistory, 
  exportItemsToCSV, 
  exportCategoriesToCSV,
  recalculateItemStock,
  defaultOpenIssueModal = false,
  defaultOpenRequisitionModal = false,
  defaultOpenSrIssueModal = false,
  defaultOpenDirectSrModal = false,
  onCloseIssueModal
}: { 
  items: Item[]; 
  categories: Category[]; 
  transactions: Transaction[]; 
  userProfile: UserProfile; 
  showToast: (msg: string, type?: 'success' | 'error') => void; 
  syncAllData: () => Promise<void>; 
  isSyncing: boolean; 
  fetchFullHistory: () => Promise<void>; 
  exportItemsToCSV: () => void; 
  exportCategoriesToCSV: () => void;
  recalculateItemStock: (itemId: string, businessId: string) => Promise<void>;
  defaultOpenIssueModal?: boolean;
  defaultOpenRequisitionModal?: boolean;
  defaultOpenSrIssueModal?: boolean;
  defaultOpenDirectSrModal?: boolean;
  onCloseIssueModal?: () => void;
}) {
  useEffect(() => {
    fetchFullHistory();
  }, [fetchFullHistory]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSrIssueModalOpen, setIsSrIssueModalOpen] = useState(defaultOpenSrIssueModal);
  const [isDirectSrModalOpen, setIsDirectSrModalOpen] = useState(defaultOpenDirectSrModal || defaultOpenIssueModal);
  const [isMultiReqModalOpen, setIsMultiReqModalOpen] = useState(defaultOpenRequisitionModal || false);
  const [selectedIssueItemId, setSelectedIssueItemId] = useState<string | undefined>(undefined);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalData, setPrintModalData] = useState<StoreRequisitionData | null>(null);
  const [pendingSrCount, setPendingSrCount] = useState(0);

  useEffect(() => {
    if (defaultOpenRequisitionModal) {
      setIsMultiReqModalOpen(true);
    }
  }, [defaultOpenRequisitionModal]);

  useEffect(() => {
    if (defaultOpenSrIssueModal) {
      setIsSrIssueModalOpen(true);
    }
  }, [defaultOpenSrIssueModal]);

  useEffect(() => {
    if (defaultOpenDirectSrModal || defaultOpenIssueModal) {
      setIsDirectSrModalOpen(true);
    }
  }, [defaultOpenDirectSrModal, defaultOpenIssueModal]);

  useEffect(() => {
    if (!userProfile.businessId) return;
    const q = query(
      collection(db, 'store_requisitions'),
      where('businessId', '==', userProfile.businessId),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, snap => {
      setPendingSrCount(snap.size);
    }, err => console.warn('Store requisition count listener:', err));
    return () => unsub();
  }, [userProfile.businessId]);

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    categoryId: '',
    unit: 'Pcs',
    minStock: 0,
    openingStock: 0,
    openingCost: 0
  });

  const isViewer = userProfile.role === 'viewer';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    if (!newCategoryName.trim()) return;
    try {
      console.log('Adding category:', newCategoryName, userProfile.businessId);
      const docRef = await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        ownerId: userProfile.uid,
        businessId: userProfile.businessId
      });
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      setFormData(prev => ({ ...prev, categoryId: docRef.id }));
      showToast('Category created successfully');
    } catch (err) {
      console.error('Category creation failed:', err);
      handleFirestoreError(err, OperationType.CREATE, 'categories');
      showToast('Failed to create category', 'error');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (isViewer) return;
    
    // Check if any items are using this category
    const itemsUsingCategory = items.filter(i => i.categoryId === catId && i.status !== 'pending_delete');
    
    const message = itemsUsingCategory.length > 0 
      ? `There are ${itemsUsingCategory.length} items in this category. Deleting it will leave them uncategorized. Continue?`
      : 'Are you sure you want to delete this category?';

    if (confirm(message)) {
      try {
        await deleteDoc(doc(db, 'categories', catId));
        showToast('Category deleted successfully');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'categories');
      }
    }
  };

  const downloadCSVSample = () => {
    const headers = ['name', 'sku', 'unit', 'minStock', 'category', 'openingStock', 'unitPrice'];
    const sampleData = [
      ['Sample Item 1', 'IC-01', 'Pcs', '10', 'Raw Material', '100', '50.50'],
      ['Sample Item 2', 'IC-02', 'KG', '5', 'Packaging', '0', '0']
    ];
    const csvContent = [headers, ...sampleData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "inventory_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewer) return;
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      complete: async (results) => {
        const data = results.data as any[];
        const localCategoryCache = new Map<string, string>(); // Name -> ID
        
        let successCount = 0;
        let failCount = 0;

        for (const row of data) {
          try {
            let categoryId = '';
            // Try different possible header names just in case
            const categoryName = (row.category || row.cat || row.categoryname || '').trim();
            
            if (categoryName) {
              const normalizedName = categoryName.toLowerCase();
              
              // 1. Check existing categories from props
              const existingCat = categories.find(c => c.name.toLowerCase() === normalizedName);
              
              // 2. Check local category cache (created during this loop)
              const cachedId = localCategoryCache.get(normalizedName);

              if (existingCat) {
                categoryId = existingCat.id;
              } else if (cachedId) {
                categoryId = cachedId;
              } else {
                // Do not auto-create category; leave uncategorized unless explicitly configured
                categoryId = '';
              }
            } else if (row.categoryid) {
              categoryId = row.categoryid;
            }

            const itemDocRef = await addDoc(collection(db, 'items'), {
              name: row.name || 'Unnamed Item',
              sku: row.sku || `SKU-${Date.now()}`,
              categoryId: categoryId,
              unit: row.unit || 'Pcs',
              minStock: Number(row.minstock || row.min_stock) || 0,
              currentStock: 0,
              avgCost: 0,
              batches: [],
              ownerId: userProfile.uid,
              businessId: userProfile.businessId,
              updatedAt: Timestamp.now(),
              status: 'active'
            });

            // Create Opening Stock Transaction if needed
            const openingQty = Number(row.openingstock || row.opening_stock || 0);
            const openingPrice = Number(row.unitprice || row.unit_price || row.price || 0);
            
            if (openingQty > 0) {
              await addDoc(collection(db, 'transactions'), {
                itemId: itemDocRef.id,
                type: 'IN',
                quantity: openingQty,
                price: openingPrice,
                date: Timestamp.now(),
                reference: 'OPENING',
                notes: 'Opening Stock Import',
                ownerId: userProfile.uid,
                businessId: userProfile.businessId,
                status: 'active'
              });
              await recalculateItemStock(itemDocRef.id, userProfile.businessId);
            }

            successCount++;
          } catch (err) {
            console.error('Error importing item:', err);
            failCount++;
          }
        }
        showToast(`Import completed: ${successCount} successful, ${failCount} failed.`, successCount > 0 ? 'success' : 'error');
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    try {
      console.log('Submitting item:', formData, userProfile.businessId);
      if (editingItem) {
        await updateDoc(doc(db, 'items', editingItem.id), {
          name: formData.name,
          sku: formData.sku,
          categoryId: formData.categoryId,
          unit: formData.unit,
          minStock: Number(formData.minStock),
          updatedAt: Timestamp.now()
        });
        showToast('Item updated successfully');
      } else {
        const itemRef = await addDoc(collection(db, 'items'), {
          name: formData.name,
          sku: formData.sku,
          categoryId: formData.categoryId,
          unit: formData.unit,
          minStock: Number(formData.minStock),
          currentStock: 0,
          avgCost: 0,
          batches: [],
          ownerId: userProfile.uid,
          businessId: userProfile.businessId,
          updatedAt: Timestamp.now(),
          status: 'active'
        });

        // Handle Opening Stock for manual entry
        if (Number(formData.openingStock) > 0) {
          await addDoc(collection(db, 'transactions'), {
            itemId: itemRef.id,
            type: 'IN',
            quantity: Number(formData.openingStock),
            price: Number(formData.openingCost),
            date: Timestamp.now(),
            reference: 'OPENING',
            notes: 'Manual Opening Stock',
            ownerId: userProfile.uid,
            businessId: userProfile.businessId,
            status: 'active'
          });
          await recalculateItemStock(itemRef.id, userProfile.businessId);
        }

        showToast('Item created successfully');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', sku: '', categoryId: '', unit: 'Pcs', minStock: 0, openingStock: 0, openingCost: 0 });
    } catch (err) {
      console.error('Item submission failed:', err);
      handleFirestoreError(err, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'items');
      showToast('Failed to save item', 'error');
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      categoryId: item.categoryId || '',
      unit: item.unit,
      minStock: item.minStock || 0,
    });
    setIsModalOpen(true);
  };

  const generateNextSKU = useCallback(() => {
    console.log('Generating next SKU, current items count:', items.length);
    const skuNumbers = items
      .map(i => {
        const match = i.sku.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    
    const nextNumber = skuNumbers.length > 0 ? Math.max(...skuNumbers) + 1 : 1;
    const paddedNumber = String(nextNumber).padStart(3, '0');
    const newSku = `SKU-${paddedNumber}`;
    console.log('Generated SKU:', newSku);
    setFormData(prev => ({ ...prev, sku: newSku }));
  }, [items]);

  useEffect(() => {
    if (isModalOpen && !editingItem && !formData.sku && items.length >= 0) {
      generateNextSKU();
    }
  }, [isModalOpen, editingItem, generateNextSKU, formData.sku, items.length]);

  const handleDelete = async (id: string) => {
    const isApprover = isUserSuperAdmin(userProfile) || userProfile?.role === 'admin' || userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin';
    if (isApprover) {
      if (confirm('Are you sure you want to delete this item?')) {
        try {
          await deleteDoc(doc(db, 'items', id));
          showToast('Item deleted successfully');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'items');
        }
      }
    } else {
      if (confirm('Request item deletion? Approval request will be sent to rajonpaul300@gmail.com.')) {
        try {
          await updateDoc(doc(db, 'items', id), {
            status: 'pending_delete'
          });
          showToast('Deletion request submitted to rajonpaul300@gmail.com for approval.');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'items');
        }
      }
    }
  };

  const activeItems = items;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-neutral-900">Inventory</h3>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {!isViewer && (
            <>
              <Button 
                variant="outline" 
                onClick={syncAllData} 
                disabled={isSyncing}
                className="gap-2 flex-grow sm:flex-grow-0"
              >
                <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync All'}</span>
                <span className="sm:hidden">Sync</span>
              </Button>
              <Button variant="secondary" onClick={() => setIsCategoryModalOpen(true)} className="gap-2 flex-grow sm:flex-grow-0">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Categories</span>
                <span className="sm:hidden">Cats</span>
              </Button>
              <Button onClick={() => { 
                setEditingItem(null); 
                setFormData({ name: '', sku: '', categoryId: '', unit: 'Pcs', minStock: 0, openingStock: 0, openingCost: 0 });
                setIsModalOpen(true); 
              }} className="gap-2 flex-grow sm:flex-grow-0">
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
              <Button 
                onClick={() => setIsMultiReqModalOpen(true)} 
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex-grow sm:flex-grow-0 shadow-sm"
                title="Create and issue Store Requisition"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Store Requisition</span>
                <span className="sm:hidden">Store Req</span>
              </Button>
              <Button 
                onClick={() => setIsSrIssueModalOpen(true)} 
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-grow sm:flex-grow-0 shadow-sm relative"
                title="Issue raw materials based on Store Requisitions from Production"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Issue from Store Requisition</span>
                <span className="sm:hidden">Issue from SR</span>
                {pendingSrCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-amber-400 text-amber-950 text-[10px] font-black rounded-full shadow-xs">
                    {pendingSrCount}
                  </span>
                )}
              </Button>
              <Button 
                onClick={() => {
                  setSelectedIssueItemId(undefined);
                  setIsDirectSrModalOpen(true);
                }} 
                className="gap-2 bg-slate-700 hover:bg-slate-800 text-white font-bold flex-grow sm:flex-grow-0 shadow-sm"
                title="Direct Store Requisition & Material Issue (No BOM Required)"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Direct Store Requisition</span>
                <span className="sm:hidden">Direct SR</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Item Details</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Stock Level</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Avg Cost</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {activeItems.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center text-neutral-500">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900 leading-none mb-1">{item.name}</p>
                      <p className="text-[10px] text-neutral-500 font-mono tracking-tight uppercase">SKU: {item.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded uppercase tracking-wider">
                    {categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <p className={cn(
                      "text-xs font-black",
                      item.minStock && item.currentStock <= item.minStock ? "text-orange-600" : "text-neutral-900"
                    )}>
                      {item.currentStock} {item.unit}
                    </p>
                    {item.minStock && (
                      <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Min: {item.minStock}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-neutral-600">
                  BDT {item.avgCost.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  {!isViewer && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2.5 text-[10px] uppercase font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 gap-1"
                        onClick={() => {
                          setSelectedIssueItemId(item.id);
                          setIsDirectSrModalOpen(true);
                        }}
                        title={`Direct Store Requisition for ${item.name}`}
                      >
                        <FileText className="w-3 h-3 text-indigo-600" />
                        Requisition
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] uppercase font-bold" onClick={() => handleEdit(item)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] uppercase font-bold text-red-600 hover:bg-red-50" onClick={() => handleDelete(item.id)}>Delete</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 italic">
                  No items found. Click "Add New Item" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? 'Edit Item' : 'Add New Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500 uppercase">Item Name</label>
            <Input 
              required 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              placeholder="e.g. Wireless Mouse"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-neutral-500 uppercase">SKU</label>
                {!editingItem && (
                  <button 
                    type="button" 
                    onClick={generateNextSKU}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Auto Generate
                  </button>
                )}
              </div>
              <Input 
                required 
                value={formData.sku} 
                onChange={e => setFormData({ ...formData, sku: e.target.value })} 
                placeholder="SKU-001"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-neutral-500 uppercase">Category</label>
                <button 
                  type="button" 
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  + Quick Add
                </button>
              </div>
              <select 
                className="w-full h-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
                value={formData.categoryId}
                onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Unit</label>
              <Input 
                required 
                value={formData.unit} 
                onChange={e => setFormData({ ...formData, unit: e.target.value })} 
                placeholder="Pcs, Kg, etc."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Min Stock Alert</label>
              <Input 
                type="number" 
                step="any"
                value={formData.minStock} 
                onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })} 
              />
            </div>
          </div>

          {!editingItem && (
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-blue-900 uppercase">Initial Balance (Optional)</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-blue-700 uppercase">Opening Stock Qty</label>
                  <Input 
                    type="number" 
                    step="any"
                    className="bg-white border-blue-200"
                    value={formData.openingStock} 
                    onChange={e => setFormData({ ...formData, openingStock: Number(e.target.value) })} 
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-blue-700 uppercase">Unit Cost (BDT)</label>
                  <Input 
                    type="number" 
                    className="bg-white border-blue-200"
                    value={formData.openingCost} 
                    onChange={e => setFormData({ ...formData, openingCost: Number(e.target.value) })} 
                    placeholder="0.00"
                  />
                </div>
              </div>
              <p className="text-[10px] text-blue-600 font-medium">Opening stock will be recorded as a manual "IN" transaction.</p>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1">{editingItem ? 'Update Item' : 'Create Item'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Manage Categories">
        <div className="space-y-6">
          <form onSubmit={handleCategorySubmit} className="space-y-4 pb-6 border-b border-neutral-100">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">New Category Name</label>
              <div className="flex gap-2">
                <Input 
                  required 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="e.g. Raw Materials"
                />
                <Button type="submit">Add</Button>
              </div>
            </div>
          </form>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-neutral-500 uppercase">Existing Categories</h4>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100 group">
                  <span className="text-sm font-medium text-neutral-900">{cat.name}</span>
                  {!isViewer && (
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-neutral-400 italic py-4 text-center">No categories created yet.</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button type="button" variant="secondary" className="w-full" onClick={() => setIsCategoryModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* 1. Store Requisition Modal */}
      <MultiItemRequisitionModal
        isOpen={isMultiReqModalOpen}
        onClose={() => {
          setIsMultiReqModalOpen(false);
          if (onCloseIssueModal) onCloseIssueModal();
        }}
        items={items}
        transactions={transactions}
        userProfile={userProfile}
        showToast={showToast}
        onRequisitionCreated={(reqData) => {
          setPrintModalData(reqData);
          setIsPrintModalOpen(true);
          fetchFullHistory();
          if (syncAllData) syncAllData();
        }}
        recalculateItemStock={recalculateItemStock}
      />

      {/* 2. Issue from Store Requisition (Production Linked) */}
      <IssueFromStoreRequisitionModal
        isOpen={isSrIssueModalOpen}
        onClose={() => {
          setIsSrIssueModalOpen(false);
          if (onCloseIssueModal) onCloseIssueModal();
        }}
        items={items}
        userProfile={userProfile}
        showToast={showToast}
        onRequisitionIssued={(reqData) => {
          setPrintModalData(reqData);
          setIsPrintModalOpen(true);
          fetchFullHistory();
          if (syncAllData) syncAllData();
        }}
        recalculateItemStock={recalculateItemStock}
        syncAllData={syncAllData}
      />

      {/* 3. Direct Store Requisition (No BOM Required) */}
      <DirectStoreRequisitionModal
        isOpen={isDirectSrModalOpen}
        onClose={() => {
          setIsDirectSrModalOpen(false);
          setSelectedIssueItemId(undefined);
          if (onCloseIssueModal) onCloseIssueModal();
        }}
        items={items}
        initialItemId={selectedIssueItemId}
        transactions={transactions}
        userProfile={userProfile}
        showToast={showToast}
        onRequisitionCreated={(reqData) => {
          setPrintModalData(reqData);
          setIsPrintModalOpen(true);
          fetchFullHistory();
          if (syncAllData) syncAllData();
        }}
        recalculateItemStock={recalculateItemStock}
      />

      {/* Printable Store Requisition Slip Modal */}
      {printModalData && (
        <StoreRequisitionPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setPrintModalData(null);
          }}
          data={printModalData}
        />
      )}
    </div>
  );
}

function TransactionsView({ 
  items, 
  transactions, 
  userProfile, 
  showToast, 
  fetchFullHistory, 
  syncAllData, 
  isHistoryLoading, 
  exportTransactionsToCSV,
  recalculateItemStock
}: { 
  items: Item[]; 
  transactions: Transaction[]; 
  userProfile: UserProfile; 
  showToast: (msg: string, type?: 'success' | 'error') => void; 
  fetchFullHistory: (silent?: boolean) => Promise<void>; 
  syncAllData?: (silent?: boolean) => Promise<void>; 
  isHistoryLoading: boolean; 
  exportTransactionsToCSV: () => void;
  recalculateItemStock: (itemId: string, businessId: string) => Promise<void>;
}) {
  useEffect(() => {
    fetchFullHistory();
  }, [fetchFullHistory]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isMultiReqModalOpen, setIsMultiReqModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalData, setPrintModalData] = useState<StoreRequisitionData | null>(null);

  // Filter States for Transactions
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txStartDate, setTxStartDate] = useState('');
  const [txEndDate, setTxEndDate] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('ALL');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isViewer = userProfile.role === 'viewer';
  const isSuperAdmin = isUserSuperAdmin(userProfile);

  const handlePrintStoreRequisition = (tx: Transaction) => {
    const ref = tx.reference || tx.srNo || `SR-${tx.id.slice(0, 6)}`;
    const matching = activeTransactions.filter(t => (t.reference === ref || t.srNo === ref));
    const targetList = matching.length > 0 ? matching : [tx];
    const firstTx = targetList[0];

    const reqItems: StoreRequisitionItem[] = targetList.map(t => {
      const item = items.find(i => i.id === t.itemId);
      return {
        itemId: t.itemId,
        itemCode: item?.sku || '',
        itemName: item?.name || 'Item',
        specification: t.itemSpecification || '',
        unit: item?.unit || 'Pcs',
        quantity: t.quantity,
        remarks: t.itemRemarks || ''
      };
    });

    const reqData: StoreRequisitionData = {
      srNo: ref,
      srDate: format(firstTx.date.toDate(), 'dd-MMM-yyyy HH:mm'),
      requiredDate: firstTx.requiredDate ? format(new Date(firstTx.requiredDate), 'dd-MMM-yyyy') : '',
      department: firstTx.department || 'Production',
      location: firstTx.location || 'Main Store',
      requestorName: firstTx.requestorName || 'Store Incharge',
      designation: firstTx.designation || 'Officer',
      purpose: firstTx.purpose || firstTx.notes || 'Production Requirement',
      jobNo: firstTx.jobNo || '',
      style: firstTx.style || '',
      type: (firstTx.type === 'EXTRA_REQUISITION' ? 'EXTRA_REQUISITION' : 'PRODUCTION'),
      remarks: firstTx.notes || '',
      items: reqItems
    };

    setPrintModalData(reqData);
    setIsPrintModalOpen(true);
  };
  const [formData, setFormData] = useState({
    itemId: '',
    type: 'IN' as 'IN' | 'OUT' | 'PRODUCTION' | 'EXTRA_REQUISITION' | 'PRODUCTION_RETURN' | 'PURCHASE_RETURN',
    quantity: 1,
    price: 0,
    reference: '',
    purchaseType: '' as 'Local' | 'Bond' | '',
    notes: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const openNewTransactionModal = () => {
    setEditingTransaction(null);
    setFormData({
      itemId: '',
      type: 'IN',
      quantity: 1,
      price: 0,
      reference: '',
      purchaseType: '',
      notes: '',
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsModalOpen(true);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewer) return;
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        const affectedItemIds = new Set<string>();
        let importedCount = 0;
        let skippedDueToStockCount = 0;

        for (const row of data) {
          try {
            const item = items.find(i => i.sku === row.sku);
            if (!item) continue;
            const qty = Number(row.quantity);
            const price = Number(row.price);
            const type = row.type as "IN" | "OUT" | "PRODUCTION" | "EXTRA_REQUISITION" | "PRODUCTION_RETURN" | "PURCHASE_RETURN";
            const isDeduct = ["OUT", "PRODUCTION", "EXTRA_REQUISITION", "PURCHASE_RETURN"].includes(type);
            if (isDeduct && qty > (Number(item.currentStock) || 0) + 0.0001) {
              skippedDueToStockCount++;
              continue;
            }

            const date = row.date ? new Date(row.date) : new Date();
            await addDoc(collection(db, "transactions"), {
              itemId: item.id,
              type,
              quantity: qty,
              price,
              date: Timestamp.fromDate(date),
              reference: row.reference || "",
              notes: row.notes || "",
              ownerId: userProfile.uid,
              businessId: userProfile.businessId,
              status: "active"
            });
            importedCount++;
            affectedItemIds.add(item.id);
          } catch (err) {
            console.error("Error importing transaction:", err);
          }
        }

        // Recalculate all affected items
        for (const itemId of affectedItemIds) {
          await new Promise(resolve => setTimeout(resolve, 800));
          await recalculateItemStock(itemId, userProfile.businessId);
        }

        if (skippedDueToStockCount > 0) {
          showToast(`CSV Import: ${importedCount} imported, ${skippedDueToStockCount} skipped due to insufficient stock!`, "error");
        } else {
          showToast(`Transactions CSV Import completed (${importedCount} records)!`, "success");
        }
      }
    });
  };

  useEffect(() => {
    // Auto-calculate price for NEW transactions when item changes
    if (isModalOpen && !editingTransaction && formData.itemId) {
      const item = items.find(i => i.id === formData.itemId);
      if (item) {
        const avgPrice = Number(item.avgCost) || 0;
        console.log(`Auto-filling price for ${item.name}: ${avgPrice}`);
        setFormData(prev => ({ 
          ...prev, 
          price: Number(avgPrice.toFixed(2)) 
        }));
      }
    }
  }, [formData.itemId, isModalOpen, editingTransaction, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    const item = items.find(i => i.id === formData.itemId);
    if (!item) return;

    const isDeduction = ['OUT', 'PRODUCTION', 'EXTRA_REQUISITION', 'PURCHASE_RETURN'].includes(formData.type);
    
    // Calculate effective stock considering the original transaction if editing
    let effectiveAvailableStock = item.currentStock;
    if (editingTransaction && editingTransaction.itemId === formData.itemId) {
      const oldType = editingTransaction.type;
      const oldQty = Number(editingTransaction.quantity) || 0;
      const wasDeduction = ['OUT', 'PRODUCTION', 'EXTRA_REQUISITION', 'PURCHASE_RETURN'].includes(oldType);
      const wasAddition = ['IN', 'PRODUCTION_RETURN'].includes(oldType);

      if (wasDeduction) {
        effectiveAvailableStock += oldQty;
      } else if (wasAddition) {
        effectiveAvailableStock -= oldQty;
      }
    }

    const EPSILON = 0.00001;
    if (isDeduction && (effectiveAvailableStock + EPSILON) < formData.quantity) {
      showToast(`Insufficient stock! Max available for this item: ${effectiveAvailableStock.toFixed(2)} ${item.unit}.`, 'error');
      return;
    }

    if (formData.type === 'IN' && !formData.purchaseType) {
      showToast('Please select Purchase Source (Local or Bond)', 'error');
      return;
    }

    try {
      if (editingTransaction) {
        // Update Transaction
        await updateDoc(doc(db, 'transactions', editingTransaction.id), {
          itemId: formData.itemId,
          type: formData.type,
          quantity: Number(formData.quantity),
          price: Number(formData.price),
          reference: formData.reference,
          purchaseType: formData.type === 'IN' ? formData.purchaseType : '',
          notes: formData.notes,
          date: Timestamp.fromDate(new Date(formData.date)),
        });
        
        // Recalculate background
        recalculateItemStock(editingTransaction.itemId, userProfile.businessId).catch(console.error);
        if (formData.itemId !== editingTransaction.itemId) {
          recalculateItemStock(formData.itemId, userProfile.businessId).catch(console.error);
        }
        showToast('Transaction updated successfully!', 'success');
      } else {
        // Record New Transaction
        const txDoc = await addDoc(collection(db, 'transactions'), {
          itemId: formData.itemId,
          type: formData.type,
          quantity: Number(formData.quantity),
          price: Number(formData.price),
          reference: formData.reference,
          purchaseType: formData.type === 'IN' ? formData.purchaseType : '',
          notes: formData.notes,
          date: Timestamp.fromDate(new Date(formData.date)),
          ownerId: userProfile.uid,
          businessId: userProfile.businessId,
          status: 'active'
        });
        
        console.log('New transaction added:', txDoc.id);
        
        // Optimistic stock update for better UI responsiveness
        const manualStockChange = isDeduction ? -Number(formData.quantity) : Number(formData.quantity);
        
        updateDoc(doc(db, 'items', formData.itemId), {
          currentStock: Number((item.currentStock + manualStockChange).toFixed(4)),
          updatedAt: Timestamp.now()
        }).catch(err => console.warn('Background optimistic update failed:', err));

        // Trigger background recalculation
        setTimeout(() => {
          recalculateItemStock(formData.itemId, userProfile.businessId).catch(console.error);
        }, 300);
        showToast('Transaction recorded successfully!', 'success');
      }

      setIsModalOpen(false);
      setEditingTransaction(null);
      setFormData({
        itemId: '',
        type: 'IN',
        quantity: 1,
        price: 0,
        reference: '',
        notes: '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
    } catch (err) {
      console.error('Error saving transaction:', err);
      showToast('Error saving transaction. Please check your inputs.', 'error');
      handleFirestoreError(err, editingTransaction ? OperationType.UPDATE : OperationType.WRITE, 'transactions');
    }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setFormData({
      itemId: tx.itemId,
      type: tx.type,
      quantity: tx.quantity,
      price: tx.price,
      reference: tx.reference || '',
      purchaseType: tx.purchaseType || '',
      notes: tx.notes || '',
      date: format(tx.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (tx: Transaction) => {
    if (!isSuperAdmin) {
      showToast('Only Super Admin can delete transactions.', 'error');
      return;
    }
    if (confirm('Are you sure you want to delete this transaction? This will revert inventory stock.')) {
      try {
        await deleteDoc(doc(db, 'transactions', tx.id));
        await recalculateItemStock(tx.itemId, userProfile.businessId);
        if (fetchFullHistory) await fetchFullHistory(true);
        if (syncAllData) await syncAllData(true);
        showToast('Transaction deleted successfully');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'transactions');
      }
    }
  };

  const activeTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.status === 'pending_delete') return false;

      if (txTypeFilter !== 'ALL' && tx.type !== txTypeFilter) return false;

      let txDate: Date;
      if (tx.date && typeof (tx.date as any).toDate === 'function') {
        txDate = (tx.date as any).toDate();
      } else if (tx.date && (tx.date as any).seconds) {
        txDate = new Date((tx.date as any).seconds * 1000);
      } else {
        txDate = new Date(tx.date as any);
      }

      if (txStartDate) {
        const parts = txStartDate.split('-');
        let start: Date;
        if (parts.length === 3) {
          start = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
        } else {
          start = new Date(txStartDate);
        }
        if (txDate < start) return false;
      }

      if (txEndDate) {
        const parts = txEndDate.split('-');
        let end: Date;
        if (parts.length === 3) {
          end = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
        } else {
          end = new Date(txEndDate);
        }
        if (txDate > end) return false;
      }

      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase().trim();
        const item = items.find(i => i.id === tx.itemId);
        const itemName = (item?.name || '').toLowerCase();
        const itemSku = (item?.sku || '').toLowerCase();
        const ref = (tx.reference || tx.srNo || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        const purpose = (tx.purpose || '').toLowerCase();
        const jobNo = (tx.jobNo || '').toLowerCase();
        const style = (tx.style || '').toLowerCase();

        const combined = `${itemName} ${itemSku} ${ref} ${notes} ${purpose} ${jobNo} ${style}`;
        return combined.includes(q);
      }

      return true;
    });
  }, [transactions, items, txTypeFilter, txStartDate, txEndDate, txSearchQuery]);

  const txSummaryStats = useMemo(() => {
    let totalInQty = 0;
    let totalInValue = 0;
    let totalOutQty = 0;
    let totalOutValue = 0;

    activeTransactions.forEach(tx => {
      const isAdd = ['IN', 'PRODUCTION_RETURN'].includes(tx.type);
      const isDed = ['OUT', 'PRODUCTION', 'EXTRA_REQUISITION', 'PURCHASE_RETURN'].includes(tx.type);
      const val = (Number(tx.quantity) || 0) * (Number(tx.price) || 0);

      if (isAdd) {
        totalInQty += Number(tx.quantity) || 0;
        totalInValue += val;
      } else if (isDed) {
        totalOutQty += Number(tx.quantity) || 0;
        totalOutValue += val;
      }
    });

    return { totalInQty, totalInValue, totalOutQty, totalOutValue };
  }, [activeTransactions]);

  const setTxPresetDate = (preset: 'today' | 'month' | 'last30' | 'all') => {
    const today = new Date();
    if (preset === 'today') {
      const dateStr = format(today, 'yyyy-MM-dd');
      setTxStartDate(dateStr);
      setTxEndDate(dateStr);
    } else if (preset === 'month') {
      const startStr = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
      const endStr = format(today, 'yyyy-MM-dd');
      setTxStartDate(startStr);
      setTxEndDate(endStr);
    } else if (preset === 'last30') {
      const prev30 = new Date();
      prev30.setDate(today.getDate() - 30);
      setTxStartDate(format(prev30, 'yyyy-MM-dd'));
      setTxEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'all') {
      setTxStartDate('');
      setTxEndDate('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-xl md:text-2xl font-bold text-neutral-900">Stock Movements</h3>
          <p className="text-sm text-neutral-500">Record purchases, production, and sales.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {!isViewer && (
            <>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleCsvUpload} 
              />
              <Button 
                variant="outline" 
                className="gap-2 flex-grow sm:flex-grow-0" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Download className="w-4 h-4 rotate-180" />
                Import CSV
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 flex-grow sm:flex-grow-0" 
                onClick={exportTransactionsToCSV}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button 
                onClick={() => setIsMultiReqModalOpen(true)} 
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white flex-grow sm:flex-grow-0 shadow-lg shadow-indigo-500/20"
              >
                <FileText className="w-4 h-4" />
                Store Requisition
              </Button>
              <Button onClick={openNewTransactionModal} className="gap-2 flex-grow sm:flex-grow-0 shadow-lg shadow-black/10">
                <Plus className="w-4 h-4" />
                Add Transaction
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Date Range & Filter Panel */}
      <Card className="p-4 space-y-3 bg-white border border-neutral-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Date & Movement Filters</span>
          </div>
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-neutral-400 font-medium mr-1">Quick Range:</span>
            <button
              onClick={() => setTxPresetDate('today')}
              className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
            >
              Today
            </button>
            <button
              onClick={() => setTxPresetDate('month')}
              className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
            >
              This Month
            </button>
            <button
              onClick={() => setTxPresetDate('last30')}
              className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTxPresetDate('all')}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-all"
            >
              All Time / Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">From Date</label>
            <input
              type="date"
              value={txStartDate}
              onChange={e => setTxStartDate(e.target.value)}
              className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">To Date</label>
            <input
              type="date"
              value={txEndDate}
              onChange={e => setTxEndDate(e.target.value)}
              className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Movement Type</label>
            <select
              value={txTypeFilter}
              onChange={e => setTxTypeFilter(e.target.value)}
              className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="IN">Purchases / Receipt (IN)</option>
              <option value="OUT">Sales / Issue (OUT)</option>
              <option value="PRODUCTION">Production Issue</option>
              <option value="EXTRA_REQUISITION">Extra Requisition</option>
              <option value="PRODUCTION_RETURN">Production Return</option>
              <option value="PURCHASE_RETURN">Purchase Return</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Search Keyword</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search Item, SKU, Ref, Notes..."
                value={txSearchQuery}
                onChange={e => setTxSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Filtered Movement Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-100">
          <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Filtered Records</span>
            <span className="text-sm font-black text-neutral-900 mt-0.5 block">{activeTransactions.length} items</span>
          </div>
          <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Total Received (IN)</span>
            <span className="text-sm font-black text-emerald-900 mt-0.5 block">
              +{txSummaryStats.totalInQty.toLocaleString()} (Tk {txSummaryStats.totalInValue.toLocaleString()})
            </span>
          </div>
          <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
            <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block">Total Issued (OUT)</span>
            <span className="text-sm font-black text-amber-900 mt-0.5 block">
              -{txSummaryStats.totalOutQty.toLocaleString()} (Tk {txSummaryStats.totalOutValue.toLocaleString()})
            </span>
          </div>
          <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider block">Active Date Range</span>
            <span className="text-xs font-bold text-indigo-900 mt-0.5 block truncate">
              {txStartDate || txEndDate ? `${txStartDate || 'Beginning'} -> ${txEndDate || 'Today'}` : 'All Time'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Date</th>
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Item</th>
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Type</th>
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Qty</th>
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Price</th>
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Total</th>
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Ref</th>
              <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {activeTransactions.map((tx) => {
              const item = items.find(i => i.id === tx.itemId);
              return (
                <tr key={tx.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-4 py-3 text-[10px] font-medium text-neutral-500">
                    {format(tx.date.toDate(), 'MMM dd, HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-neutral-900 leading-none mb-1">{item?.name || 'Deleted Item'}</p>
                    <p className="text-[9px] text-neutral-400 font-mono tracking-tighter uppercase">SKU: {item?.sku}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                      tx.type === 'IN' ? "bg-green-50 text-green-700" : 
                      tx.type === 'PRODUCTION' ? "bg-blue-50 text-blue-700" : 
                      tx.type === 'EXTRA_REQUISITION' ? "bg-purple-50 text-purple-700" : 
                      tx.type === 'PRODUCTION_RETURN' ? "bg-emerald-50 text-emerald-700" :
                      tx.type === 'PURCHASE_RETURN' ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    )}>
                      {tx.type === 'OUT' ? 'SALES' : tx.type.replace(/_/g, ' ')}
                    </span>
                    {tx.type === 'IN' && tx.purchaseType && (
                      <span className="block mt-1 text-[8px] font-bold text-neutral-400">
                        {tx.purchaseType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-black text-neutral-900">
                    {tx.quantity} {item?.unit}
                  </td>
                  <td className="px-4 py-3 text-[10px] font-medium text-neutral-600">
                    {Number(tx.price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs font-black text-neutral-900">
                    {(tx.quantity * tx.price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-neutral-500 font-medium tracking-tight">
                    {getTxDisplayReferenceAndPurpose(tx)}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {(tx.type === 'PRODUCTION' || tx.type === 'EXTRA_REQUISITION' || tx.reference || tx.srNo) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-[10px] uppercase font-bold text-indigo-600 hover:bg-indigo-50" 
                        onClick={() => handlePrintStoreRequisition(tx)}
                      >
                        Print SR
                      </Button>
                    )}
                    {!isViewer && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase font-bold" onClick={() => handleEdit(tx)}>Edit</Button>
                        {isSuperAdmin && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase font-bold text-red-600 hover:bg-red-50" onClick={() => handleDelete(tx)}>Delete</Button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 italic">
                  No transactions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTransaction ? 'Edit Transaction' : 'New Transaction'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500 uppercase">Select Item</label>
            <select 
              required
              className="w-full h-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              value={formData.itemId}
              onChange={e => setFormData({ ...formData, itemId: e.target.value })}
            >
              <option value="">Choose an item...</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
              ))}
            </select>
            {formData.itemId && (
              <div className="flex justify-between px-1">
                <span className="text-[10px] text-neutral-500">
                  Current Stock: <span className="font-bold">{items.find(i => i.id === formData.itemId)?.currentStock} {items.find(i => i.id === formData.itemId)?.unit}</span>
                </span>
                <span className="text-[10px] text-neutral-500">
                  Avg Cost: <span className="font-bold">{items.find(i => i.id === formData.itemId)?.avgCost.toFixed(2)}</span>
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Type</label>
              <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'IN' })}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all whitespace-nowrap px-2",
                    formData.type === 'IN' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  )}
                >IN (Purchase)</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'PRODUCTION' })}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all px-2",
                    formData.type === 'PRODUCTION' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  )}
                >PROD</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'EXTRA_REQUISITION' })}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all px-2",
                    formData.type === 'EXTRA_REQUISITION' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  )}
                >EXTRA REQ</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'PRODUCTION_RETURN' })}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all px-2",
                    formData.type === 'PRODUCTION_RETURN' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  )}
                >RETURN (IN)</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'PURCHASE_RETURN' })}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all px-2",
                    formData.type === 'PURCHASE_RETURN' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  )}
                >PURCHASE RETURN</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'OUT' })}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all px-2",
                    formData.type === 'OUT' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  )}
                >SALES</button>
              </div>
            </div>
            <div className="space-y-1">
              {formData.type === 'IN' ? (
                <>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Purchase Source <span className="text-red-500">*</span></label>
                  <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, purchaseType: 'Local' })}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all",
                        formData.purchaseType === 'Local' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                      )}
                    >Local</button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, purchaseType: 'Bond' })}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all",
                        formData.purchaseType === 'Bond' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                      )}
                    >Bond</button>
                  </div>
                </>
              ) : (
                <>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Date & Time</label>
                  <Input 
                    type="datetime-local" 
                    required 
                    value={formData.date} 
                    onChange={e => setFormData({ ...formData, date: e.target.value })} 
                  />
                </>
              )}
            </div>
          </div>
          {formData.type === 'IN' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Date & Time</label>
              <Input 
                type="datetime-local" 
                required 
                value={formData.date} 
                onChange={e => setFormData({ ...formData, date: e.target.value })} 
              />
            </div>
          )}
          {(() => {
            const selItem = items.find(i => i.id === formData.itemId);
            const isDeduct = ['OUT', 'PRODUCTION', 'EXTRA_REQUISITION', 'PURCHASE_RETURN'].includes(formData.type);
            let effStock = selItem ? (Number(selItem.currentStock) || 0) : 0;
            if (editingTransaction && editingTransaction.itemId === formData.itemId) {
              const oldType = editingTransaction.type;
              const oldQty = Number(editingTransaction.quantity) || 0;
              if (['OUT', 'PRODUCTION', 'EXTRA_REQUISITION', 'PURCHASE_RETURN'].includes(oldType)) effStock += oldQty;
              else if (['IN', 'PRODUCTION_RETURN'].includes(oldType)) effStock -= oldQty;
            }
            const isOverStock = isDeduct && selItem && (Number(formData.quantity) > (effStock + 0.0001));

            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Quantity</label>
                      {isDeduct && selItem && (
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-[10px] font-bold", isOverStock ? "text-rose-600 font-extrabold" : "text-emerald-700")}>
                            Stock: {effStock.toFixed(2)} {selItem.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, quantity: Math.max(0, Number(effStock.toFixed(2))) })}
                            className="text-[9px] font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-all"
                          >
                            Max
                          </button>
                        </div>
                      )}
                    </div>
                    <Input 
                      type="number" 
                      step="any"
                      required 
                      min="0.0001"
                      max={isDeduct && selItem ? effStock : undefined}
                      value={formData.quantity} 
                      onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} 
                      className={cn(isOverStock && "border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/50 text-rose-800 font-bold")}
                    />
                    {isOverStock && (
                      <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                        ⚠️ Quantity exceeds available stock ({effStock.toFixed(2)} {selItem?.unit})! Cannot issue more than in stock. (স্টকের চেয়ে বেশি আউট করা যাবে না)
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-500 uppercase">
                      Price per Unit {formData.type !== 'IN' && "(Avg Auto)"}
                    </label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        required 
                        step="0.01"
                        value={formData.price} 
                        onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} 
                      />
                    </div>
                    {formData.type !== 'IN' && formData.itemId && (
                      <p className="text-[10px] text-neutral-400 mt-1 italic">
                        * Price automatically calculated using Weighted Average Cost method.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Reference / Invoice #</label>
                  <Input 
                    value={formData.reference} 
                    onChange={e => setFormData({ ...formData, reference: e.target.value })} 
                    placeholder="e.g. INV-2024-001"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button 
                    type="submit" 
                    className={cn("flex-1 font-bold", isOverStock && "bg-rose-600 hover:bg-rose-700 opacity-60 cursor-not-allowed")}
                    disabled={isOverStock}
                  >
                    {isOverStock ? `⚠️ Insufficient Stock (${effStock.toFixed(2)} ${selItem?.unit} Available)` : (editingTransaction ? 'Update Entry' : 'Record Entry')}
                  </Button>
                </div>
              </>
            );
          })()}
        </form>
      </Modal>

      {/* Multi-Item Store Requisition Modal */}
      <MultiItemRequisitionModal
        isOpen={isMultiReqModalOpen}
        onClose={() => setIsMultiReqModalOpen(false)}
        items={items}
        transactions={transactions}
        userProfile={userProfile}
        showToast={showToast}
        onRequisitionCreated={(reqData) => {
          setPrintModalData(reqData);
          setIsPrintModalOpen(true);
        }}
        recalculateItemStock={recalculateItemStock}
      />

      {/* Printable Store Requisition Slip Modal */}
      <StoreRequisitionPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        data={printModalData}
      />
    </div>
  );
}

function LedgerSummaryView({ items, transactions, fetchFullHistory, isHistoryLoading }: { items: Item[]; transactions: Transaction[]; fetchFullHistory: () => Promise<void>; isHistoryLoading: boolean }) {
  useEffect(() => {
    fetchFullHistory();
  }, [fetchFullHistory]);

  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<string>('all');

  const reportData = useMemo(() => {
    if (!selectedItemId) return null;
    
    const start = startOfDay(new Date(dateRange.start));
    const end = endOfDay(new Date(dateRange.end));

    const item = items.find(i => i.id === selectedItemId);
    if (!item || item.status === 'pending_delete') return null;

    const itemTxs = transactions
      .filter(tx => tx.itemId === item.id && tx.status === 'active')
      .sort((a, b) => a.date.toMillis() - b.date.toMillis());

    let currentStock = 0;
    let totalValue = 0;
    let lastAvgCost = 0;
    
    let openingStock = 0;
    let openingValue = 0;
    let inQty = 0;
    let inValue = 0;
    let prodQty = 0;
    let prodValue = 0;
    let outQty = 0;
    let outValue = 0;
    let extraReqQty = 0;
    let extraReqValue = 0;
    let purchaseReturnQty = 0;
    let purchaseReturnValue = 0;

    const filteredDetailedTxs = itemTxs.filter(tx => isWithinInterval(tx.date.toDate(), { start, end }));

    for (const tx of itemTxs) {
      const txDate = tx.date.toDate();
      const qty = Number(tx.quantity) || 0;
      const price = Number(tx.price) || 0;
      const type = (tx.type || '').toUpperCase();
      const ref = (tx.reference || '').toUpperCase().trim();
      const isAddition = type === 'IN' || type === 'PRODUCTION_RETURN' || ref === 'OPENING';

      if (isAddition) {
        totalValue += qty * price;
        currentStock += qty;
        if (currentStock > 0) lastAvgCost = totalValue / currentStock;

        if (isWithinInterval(txDate, { start, end }) && ref !== 'OPENING') {
          inQty += qty;
          inValue += qty * price;
        }
      } else {
        const currentAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;
        const deductionValue = qty * currentAvgCost;
        
        currentStock -= qty;
        totalValue -= deductionValue;
        if (currentStock <= 0) totalValue = 0;

        if (isWithinInterval(txDate, { start, end })) {
          if (type === 'OUT') {
            outQty += qty;
            outValue += deductionValue;
          } else if (type === 'PRODUCTION') {
            prodQty += qty;
            prodValue += deductionValue;
          } else if (type === 'EXTRA_REQUISITION') {
            extraReqQty += qty;
            extraReqValue += deductionValue;
          } else if (type === 'PURCHASE_RETURN') {
            purchaseReturnQty += qty;
            purchaseReturnValue += deductionValue;
          }
        }
      }

      const isOpeningWithinPeriod = isWithinInterval(txDate, { start, end }) && ref === 'OPENING';

      if (txDate < start || isOpeningWithinPeriod) {
        openingStock = currentStock;
        openingValue = totalValue;
      }
    }

    const closingStock = currentStock;
    const closingValue = totalValue;

    return {
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      openingStock,
      openingValue,
      inQty,
      inValue,
      outQty,
      outValue,
      prodQty,
      prodValue,
      extraReqQty,
      extraReqValue,
      purchaseReturnQty,
      purchaseReturnValue,
      closingStock,
      closingValue,
      unit: item.unit,
      detailedTxs: filteredDetailedTxs
    };
  }, [items, transactions, dateRange, selectedItemId]);

  const toggleTxSelection = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTxIds(next);
  };

  const selectAllTxs = () => {
    if (!reportData) return;
    const currentList = selectedTxsForDisplay;
    const allSelected = currentList.every(t => selectedTxIds.has(t.id));

    const next = new Set(selectedTxIds);
    if (allSelected) {
      currentList.forEach(t => next.delete(t.id));
    } else {
      currentList.forEach(t => next.add(t.id));
    }
    setSelectedTxIds(next);
  };

  const selectedTxsForDisplay = useMemo(() => {
    if (!reportData) return [];
    let txs = reportData.detailedTxs;
    
    // Apply type filter first
    if (selectedType !== 'all') {
      txs = txs.filter(tx => tx.type === selectedType);
    }
    
    return txs;
  }, [reportData, selectedType]);

  const filteredAndSelectedTxs = useMemo(() => {
    if (selectedTxIds.size === 0) return selectedTxsForDisplay;
    return selectedTxsForDisplay.filter(tx => selectedTxIds.has(tx.id));
  }, [selectedTxsForDisplay, selectedTxIds]);

  const exportToExcel = () => {
    if (!reportData) return;
    const data = [{
      Item: reportData.itemName,
      SKU: reportData.sku,
      'Opening Stock': reportData.openingStock,
      'Opening Value': reportData.openingValue.toFixed(2),
      'IN Qty': reportData.inQty,
      'IN Value': reportData.inValue.toFixed(2),
      'OUT Qty': reportData.outQty,
      'OUT Value': reportData.outValue.toFixed(2),
      'PROD Qty': reportData.prodQty,
      'PROD Value': reportData.prodValue.toFixed(2),
      'EXTRA Qty': reportData.extraReqQty,
      'EXTRA Value': reportData.extraReqValue.toFixed(2),
      'PURCHASE RETURN Qty': reportData.purchaseReturnQty,
      'PURCHASE RETURN Value': reportData.purchaseReturnValue.toFixed(2),
      'Closing Stock': reportData.closingStock,
      'Closing Value': reportData.closingValue.toFixed(2),
      Unit: reportData.unit
    }];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFile(wb, `Item_Detail_${reportData.itemName}_${dateRange.start}.xlsx`);
  };

  const selectedItemData = items.find(i => i.id === selectedItemId);

  return (
    <div className="space-y-6">
      {isHistoryLoading && (
        <div className="flex items-center justify-center p-8 bg-blue-50 border border-blue-100 rounded-2xl animate-pulse print:hidden">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest text-center">
              Fetching complete history for summary... <br/>
              <span className="opacity-60 lowercase font-medium">This saves your daily database quota</span>
            </p>
          </div>
        </div>
      )}
      <Card className="p-6 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 w-full">
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-bold text-neutral-900">Item Ledger Details</h3>
            <p className="text-sm text-neutral-500">View movement summary for a specific item.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[280px]">
              <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block">Date Range</label>
              <div className="flex items-center gap-2">
                <Input type="date" className="h-9 w-full" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                <span className="text-neutral-400">to</span>
                <Input type="date" className="h-9 w-full" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
              </div>
            </div>
            <div className="w-full sm:w-64">
              <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block">Select Item</label>
              <select 
                className="w-full h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
              >
                <option value="">Choose an item...</option>
                {items.filter(i => i.status !== 'pending_delete').map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block">Type</label>
              <select 
                className="w-full h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="IN">Stock IN</option>
                <option value="OUT">Stock OUT</option>
                <option value="PRODUCTION">Production</option>
                <option value="EXTRA_REQUISITION">Extra Req</option>
                <option value="PURCHASE_RETURN">Purchase Return</option>
                <option value="PRODUCTION_RETURN">Return</option>
              </select>
            </div>
            {reportData && (
              <>
                <Button variant="outline" size="sm" onClick={exportToExcel} className="h-9 gap-2">
                  <Download className="w-4 h-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => printElement('printable-stock-ledger', { title: `Stock_Ledger_${reportData?.itemName || 'Item'}` })} className="h-9 gap-2 cursor-pointer">
                  <FileText className="w-4 h-4" />
                  Print
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {reportData ? (
        <div id="printable-stock-ledger" className="printable-doc space-y-6">
          {/* Header Info for Screen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
            <Card className="md:col-span-2 p-8 bg-neutral-900 text-white relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs mb-2">Selected Item</p>
                <h2 className="text-3xl font-black mb-1">{reportData.itemName}</h2>
                <p className="text-lg text-neutral-400 mb-8 font-mono">SKU: {reportData.sku}</p>
                
                <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
                  <div>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase mb-1">Stock in Hand</p>
                    <p className="text-4xl font-black text-green-400 leading-none">
                      {reportData.closingStock}
                      <span className="ml-2 text-sm text-neutral-500 font-bold uppercase tracking-wider">{reportData.unit}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase mb-1">Total Stock Value</p>
                    <p className="text-4xl font-black text-white leading-none tracking-tight">
                      {reportData.closingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="ml-2 text-sm text-neutral-500 font-bold uppercase">BDT</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Package className="w-40 h-40" />
              </div>
            </Card>

            <Card className="p-8 border-2 border-dashed border-neutral-200 bg-neutral-50 flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-neutral-100">
                <Calendar className="w-8 h-8 text-neutral-400" />
              </div>
              <p className="text-neutral-500 text-sm mb-1 font-medium">Reporting Period</p>
              <p className="font-bold text-neutral-900">{format(new Date(dateRange.start), 'MMM dd')} - {format(new Date(dateRange.end), 'MMM dd, yyyy')}</p>
            </Card>
          </div>

          {/* Compact Header for Printing */}
          <div className="hidden print:block border-b-2 border-neutral-900 pb-4 mb-6">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-neutral-900 leading-tight">LEDGER DETAILS: {reportData.itemName}</h1>
                <div className="flex gap-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  <span>SKU: {reportData.sku}</span>
                  <span>|</span>
                  <span>Unit: {reportData.unit}</span>
                  <span>|</span>
                  <span>Period: {format(new Date(dateRange.start), 'dd/MM/yy')} to {format(new Date(dateRange.end), 'dd/MM/yy')}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Closing Balance</p>
                <div className="flex flex-col items-end">
                  <p className="text-xl font-black text-neutral-900">{reportData.closingStock} {reportData.unit}</p>
                  <p className="text-sm font-bold text-neutral-600">BDT {reportData.closingValue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="overflow-x-auto print:border-none print:shadow-none">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th className="px-6 py-4 font-bold text-neutral-900 border-l first:border-l-0 border-neutral-200 text-center" colSpan={2}>Opening Status</th>
                  <th className="px-6 py-4 font-bold text-green-600 border-l border-neutral-200 text-center" colSpan={2}>Stock IN (+)</th>
                  <th className="px-6 py-4 font-bold text-red-600 border-l border-neutral-200 text-center" colSpan={2}>Sales OUT (-)</th>
                  <th className="px-6 py-4 font-bold text-orange-600 border-l border-neutral-200 text-center" colSpan={2}>Production (-)</th>
                  <th className="px-6 py-4 font-bold text-purple-600 border-l border-neutral-200 text-center" colSpan={2}>Extra Req (-)</th>
                  <th className="px-6 py-4 font-bold text-amber-600 border-l border-neutral-200 text-center" colSpan={2}>Purchase Return (-)</th>
                  <th className="px-6 py-4 font-bold text-blue-600 border-l border-neutral-200 text-center" colSpan={2}>Closing / Stock in Hand</th>
                </tr>
                <tr className="bg-neutral-50/50 border-b border-neutral-100">
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 border-l first:border-l-0 border-neutral-200 text-center">Qty</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 text-center">Value</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 border-l border-neutral-200 text-center">Qty</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 text-center">Value</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 border-l border-neutral-200 text-center">Qty</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 text-center">Value</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 border-l border-neutral-200 text-center">Qty</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 text-center">Value</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 border-l border-neutral-200 text-center">Qty</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 text-center">Value</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 border-l border-neutral-200 text-center">Qty</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 text-center">Value</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 border-l border-neutral-200 text-center">Qty</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-neutral-400 font-bold text-center">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 border-l first:border-l-0 border-neutral-200 text-center font-bold text-neutral-900">{reportData.openingStock}</td>
                  <td className="px-4 py-3 text-center font-medium">{reportData.openingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  
                  <td className="px-4 py-3 border-l border-neutral-200 text-green-700 text-center font-bold">+{reportData.inQty}</td>
                  <td className="px-4 py-3 text-green-700 text-center">{reportData.inValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  
                  <td className="px-4 py-3 border-l border-neutral-200 text-red-700 text-center font-bold">-{reportData.outQty}</td>
                  <td className="px-4 py-3 text-red-700 text-center">{reportData.outValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  
                  <td className="px-4 py-3 border-l border-neutral-200 text-orange-700 text-center font-bold">-{reportData.prodQty}</td>
                  <td className="px-4 py-3 text-orange-700 text-center">{reportData.prodValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>

                  <td className="px-4 py-3 border-l border-neutral-200 text-purple-700 text-center font-bold">-{reportData.extraReqQty}</td>
                  <td className="px-4 py-3 text-purple-700 text-center">{reportData.extraReqValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>

                  <td className="px-4 py-3 border-l border-neutral-200 text-amber-700 text-center font-bold">-{reportData.purchaseReturnQty}</td>
                  <td className="px-4 py-3 text-amber-700 text-center">{reportData.purchaseReturnValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  
                  <td className="px-4 py-3 border-l border-neutral-200 font-black text-neutral-900 text-center text-sm">{reportData.closingStock} {reportData.unit}</td>
                  <td className="px-4 py-3 font-black text-neutral-900 bg-neutral-50/50 text-center text-sm border-r border-neutral-200">BDT {reportData.closingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
          </Card>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1 print:hidden">
              <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-widest px-4">Transaction History</h4>
              <div className="flex items-center gap-4 px-4">
                <div className="text-[10px] text-neutral-400 font-medium">
                  {selectedTxIds.size > 0 ? `${selectedTxIds.size} selected` : `Showing ${selectedTxsForDisplay.length} transactions`}
                </div>
                <button 
                  onClick={selectAllTxs}
                  className="text-[10px] font-bold text-black hover:underline uppercase"
                >
                  {selectedTxsForDisplay.every(t => selectedTxIds.has(t.id)) && selectedTxsForDisplay.length > 0 ? 'Deselect current' : 'Select current'}
                </button>
              </div>
            </div>
            
            <Card className="overflow-hidden print:border-none print:shadow-none mx-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100">
                    <th className="px-4 py-4 w-10 text-center print:hidden">
                      <div className="w-4 h-4" />
                    </th>
                    <th className="px-6 py-4 font-bold text-neutral-900 border-neutral-200 text-center">Date</th>
                    <th className="px-6 py-4 font-bold text-neutral-900 border-neutral-200">Type</th>
                    <th className="px-6 py-4 font-bold text-neutral-900 border-neutral-200 text-center">Qty</th>
                    <th className="px-6 py-4 font-bold text-neutral-900 border-neutral-200 text-center">Rate</th>
                    <th className="px-6 py-4 font-bold text-neutral-900 border-neutral-200 text-center">Total Value</th>
                    <th className="px-6 py-4 font-bold text-neutral-900 border-neutral-200">Remarks / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 italic print:not-italic">
                  {filteredAndSelectedTxs.map(tx => (
                    <tr key={tx.id} className={cn(
                      "transition-colors",
                      selectedTxIds.has(tx.id) ? "bg-blue-50/30" : "hover:bg-neutral-50"
                    )}>
                      <td className="px-4 py-4 text-center print:hidden">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-black cursor-pointer"
                          checked={selectedTxIds.has(tx.id)}
                          onChange={() => toggleTxSelection(tx.id)}
                        />
                      </td>
                      <td className="px-6 py-4 text-center text-neutral-600">
                        {format(tx.date.toDate(), 'MM/dd/yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase",
                          ['IN', 'PRODUCTION_RETURN'].includes(tx.type) ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
                        )}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold">
                        {['IN', 'PRODUCTION_RETURN'].includes(tx.type) ? '+' : '-'}{tx.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center text-neutral-500">
                        {Number(tx.price).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-neutral-900">
                        {(Number(tx.quantity) * Number(tx.price)).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-neutral-600 text-[10px] font-medium max-w-[250px] break-words">
                        {getTxDisplayReferenceAndPurpose(tx)}
                      </td>
                    </tr>
                  ))}
                  {filteredAndSelectedTxs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 italic">No transactions found for the selection.</td>
                    </tr>
                  )}
                </tbody>
                {filteredAndSelectedTxs.length > 0 && (
                   <tfoot className="bg-neutral-50 border-t border-neutral-100 font-black text-neutral-900">
                    <tr className="print:bg-transparent">
                      <td className="print:hidden"></td>
                      <td colSpan={2} className="px-6 py-4 text-right uppercase tracking-wider text-[10px]">Displayed Selection Total:</td>
                      <td className="px-6 py-4 text-center">
                        {filteredAndSelectedTxs.reduce((acc, tx) => {
                          const isAdd = ['IN', 'PRODUCTION_RETURN'].includes(tx.type);
                          return acc + (isAdd ? tx.quantity : -tx.quantity);
                        }, 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-center">
                        BDT {filteredAndSelectedTxs.reduce((acc, tx) => {
                          const isAdd = ['IN', 'PRODUCTION_RETURN'].includes(tx.type);
                          return acc + (isAdd ? (tx.quantity * tx.price) : -(tx.quantity * tx.price));
                        }, 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </Card>
          </div>

          <div className="hidden print:flex justify-between px-8 pt-20 text-xs font-bold text-neutral-400 bg-white">
            <div className="text-center border-t border-neutral-200 pt-2 w-32">PREPARED BY</div>
            <div className="text-center border-t border-neutral-200 pt-2 w-32">STORE MANAGER</div>
            <div className="text-center border-t border-neutral-200 pt-2 w-32">AUTHORIZED</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-dashed border-neutral-200 space-y-6">
          <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center">
            <FileText className="w-10 h-10 text-neutral-300" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-neutral-900">Search Item Ledger Details</h3>
            <p className="text-neutral-500 max-w-xs">Please select an item and date range from the filters above to view its detailed movement summary.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerView({ items, transactions, fetchFullHistory, isHistoryLoading }: { items: Item[]; transactions: Transaction[]; fetchFullHistory: () => Promise<void>; isHistoryLoading: boolean }) {
  useEffect(() => {
    fetchFullHistory();
  }, [fetchFullHistory]);

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  
  const item = items.find(i => i.id === selectedItemId);

  const ledgerCalculatedData = useMemo(() => {
    if (!selectedItemId) return { rows: [], totals: { inQty: 0, inValue: 0, outQty: 0, outValue: 0 } };
    
    const start = startOfDay(new Date(dateRange.start));
    const end = endOfDay(new Date(dateRange.end));
    
    const allTxs = transactions
      .filter(tx => tx.itemId === selectedItemId && (tx.status as string) !== 'deleted')
      .sort((a, b) => a.date.toMillis() - b.date.toMillis());

    let currentStock = 0;
    let totalValue = 0;
    let lastAvgCost = 0;
    let rows: any[] = [];
    
    let totalInQty = 0;
    let totalInValue = 0;
    let totalOutQty = 0;
    let totalOutValue = 0;

    for (const tx of allTxs) {
      const txDate = tx.date.toDate();
      const qty = Number(tx.quantity) || 0;
      const type = (tx.type || '').toUpperCase();
      const ref = (tx.reference || '').toUpperCase().trim();
      const isAddition = type === 'IN' || type === 'PRODUCTION_RETURN' || ref === 'OPENING';
      
      let rowData: any = {
        id: tx.id,
        date: txDate,
        type: tx.type,
        ref: tx.reference,
        remarks: getTxDisplayReferenceAndPurpose(tx)
      };

      if (isAddition) {
        const price = Number(tx.price) || 0;
        totalValue += qty * price;
        currentStock += qty;
        if (currentStock > 0) lastAvgCost = totalValue / currentStock;

        rowData.purchase = { qty: qty, price: price, total: qty * price };
        if (isWithinInterval(txDate, { start, end })) {
          totalInQty += qty;
          totalInValue += qty * price;
        }
      } else {
        const currentAvgCost = currentStock > 0 ? totalValue / currentStock : lastAvgCost;
        const deductionValue = qty * currentAvgCost;
        
        currentStock -= qty;
        totalValue -= deductionValue;
        if (currentStock <= 0) totalValue = 0;

        rowData.sale = { 
          qty: qty, 
          total: deductionValue,
          breakdown: [{ qty: qty, price: currentAvgCost }]
        };
        
        if (isWithinInterval(txDate, { start, end })) {
          totalOutQty += qty;
          totalOutValue += deductionValue;
        }
      }

      rowData.balances = [{ quantity: currentStock, price: currentStock > 0 ? totalValue / currentStock : lastAvgCost, total: totalValue }];

      if (txDate < start) {
        // Just update "Opening" snapshot
        rows = [{ 
          type: 'OPENING', 
          date: start, 
          balances: rowData.balances 
        }];
      } else if (txDate <= end) {
        // Add to visible rows
        rows.push(rowData);
      }
    }

    if (rows.length === 0) {
      // No records
    } else if (rows[0].type !== 'OPENING') {
      rows.unshift({ type: 'OPENING', date: start, balances: [] });
    }

    return { rows, totals: { inQty: totalInQty, inValue: totalInValue, outQty: totalOutQty, outValue: totalOutValue } };
  }, [selectedItemId, transactions, dateRange]);

  const handlePrint = () => { 
    printElement('printable-weighted-ledger', { title: `Valuation_Ledger_${item?.name || 'Item'}`, pageOrientation: 'landscape' }); 
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 w-full">
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-bold text-neutral-900">Weighted Average Ledger</h3>
            <p className="text-sm text-neutral-500">Detailed movement and average cost tracking.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[280px]">
              <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block">Date Range</label>
              <div className="flex items-center gap-2">
                <Input type="date" className="h-9 w-full" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                <span className="text-neutral-400">to</span>
                <Input type="date" className="h-9 w-full" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
              </div>
            </div>
            <div className="w-full sm:w-64">
              <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block">Select Item</label>
              <select 
                className="w-full h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
              >
                <option value="">Choose an item...</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 gap-2 cursor-pointer">
                <FileText className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {item ? (
        <div id="printable-weighted-ledger" className="printable-doc print-container overflow-x-auto">
          <div className="hidden print:block mb-8 text-center">
            <h1 className="text-2xl font-bold">FIFO Inventory Valuation Ledger</h1>
            <p className="text-neutral-500">{item.name} ({item.sku}) | Period: {dateRange.start} to {dateRange.end}</p>
          </div>

          <table className="w-full border-collapse border border-neutral-300 text-[11px] md:text-sm bg-white">
            <thead>
              <tr className="bg-neutral-100 text-neutral-900 border border-neutral-300">
                <th rowSpan={2} className="border border-neutral-300 p-2 text-center">Date</th>
                <th rowSpan={2} className="border border-neutral-300 p-2 text-center w-[12%]">Remarks</th>
                <th colSpan={3} className="border border-neutral-300 p-2 text-center bg-blue-50/50">Purchases / IN</th>
                <th colSpan={3} className="border border-neutral-300 p-2 text-center bg-red-50/50">Sales / Issues / OUT</th>
                <th colSpan={3} className="border border-neutral-300 p-2 text-center bg-green-50/50">Balance (FIFO Batches)</th>
              </tr>
              <tr className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500 border border-neutral-300 font-bold">
                <th className="border border-neutral-300 p-1 text-center bg-blue-50/50 w-[8%] text-neutral-900">Qty</th>
                <th className="border border-neutral-300 p-1 text-center bg-blue-50/50 w-[8%] text-neutral-900">Rate</th>
                <th className="border border-neutral-300 p-1 text-center bg-blue-50/50 w-[8%] text-neutral-900">Total</th>
                
                <th className="border border-neutral-300 p-1 text-center bg-red-50/50 w-[8%] text-neutral-900">Qty</th>
                <th className="border border-neutral-300 p-1 text-center bg-red-50/50 w-[12%] text-neutral-900">Rate</th>
                <th className="border border-neutral-300 p-1 text-center bg-red-50/50 w-[10%] text-neutral-900">Total</th>
                
                <th className="border border-neutral-300 p-1 text-center bg-green-50/50 w-[10%] text-neutral-900">Qty</th>
                <th className="border border-neutral-300 p-1 text-center bg-green-50/50 w-[10%] text-neutral-900">Rate</th>
                <th className="border border-neutral-300 p-1 text-center bg-green-50/50 w-[10%] text-neutral-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {ledgerCalculatedData.rows.map((row, idx) => {
                const balanceCount = Math.max(row.balances.length, 1);
                const salesBreakdown = row.sale?.breakdown || [];
                const maxInnerRows = Math.max(balanceCount, salesBreakdown.length);

                return Array.from({ length: maxInnerRows }).map((_, innerIdx) => (
                  <tr key={`${idx}-${innerIdx}`} className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-200">
                    {/* Date Column - only on first inner row */}
                    {innerIdx === 0 && (
                      <td rowSpan={maxInnerRows} className="border border-neutral-200 p-2 font-medium text-neutral-700 bg-neutral-50/30 text-center">
                        {row.type === 'OPENING' ? (
                          <span className="font-bold">Opening Stock</span>
                        ) : (
                          format(row.date, 'MMM dd, yyyy')
                        )}
                      </td>
                    )}

                    {/* Remarks Column */}
                    {innerIdx === 0 && (
                      <td rowSpan={maxInnerRows} className="border border-neutral-200 p-2 text-[10px] text-neutral-600 font-medium max-w-[200px] break-words">
                        {row.remarks}
                      </td>
                    )}

                    {/* Purchase Columns - only on first inner row */}
                    {innerIdx === 0 ? (
                      <>
                        <td className="border border-neutral-200 p-2 text-center">{row.purchase?.qty || ''}</td>
                        <td className="border border-neutral-200 p-2 text-center">{row.purchase?.price?.toLocaleString() || ''}</td>
                        <td className="border border-neutral-200 p-2 text-center font-semibold">{row.purchase?.total?.toLocaleString() || ''}</td>
                      </>
                    ) : (
                      <>
                        <td className="border border-neutral-200 p-2"></td>
                        <td className="border border-neutral-200 p-2"></td>
                        <td className="border border-neutral-200 p-2"></td>
                      </>
                    )}

                    {/* Sale Columns - handle breakdown */}
                    <td className="border border-neutral-200 p-2 text-center font-medium">
                      {innerIdx === 0 ? row.sale?.qty : ''}
                    </td>
                    <td className="border border-neutral-200 p-2 text-center text-[10px] text-neutral-600">
                      {salesBreakdown[innerIdx] ? (
                        <span>{salesBreakdown[innerIdx].qty} x {salesBreakdown[innerIdx].price.toLocaleString()}</span>
                      ) : ''}
                    </td>
                    <td className="border border-neutral-200 p-2 text-center font-semibold">
                      {innerIdx === 0 ? row.sale?.total?.toLocaleString() : ''}
                    </td>

                    {/* Balance Columns - handle multiple batches */}
                    <td className="border border-neutral-200 p-2 text-center bg-green-50/10">
                      {row.balances[innerIdx]?.quantity || ''}
                    </td>
                    <td className="border border-neutral-200 p-2 text-center bg-green-50/10">
                      {row.balances[innerIdx]?.price?.toLocaleString() || ''}
                    </td>
                    <td className="border border-neutral-200 p-2 text-center font-bold text-neutral-900 bg-green-50/20">
                      {row.balances[innerIdx]?.total?.toLocaleString() || ''}
                    </td>
                  </tr>
                ));
              })}
              {ledgerCalculatedData.rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-neutral-400 italic">No records for selected period.</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-neutral-900 text-white font-bold text-[12px] uppercase tracking-wider">
              <tr>
                <td colSpan={2} className="border border-neutral-800 p-3 text-center">Totals</td>
                <td className="border border-neutral-800 p-3 text-center">{ledgerCalculatedData.totals.inQty.toLocaleString()}</td>
                <td className="border border-neutral-800 p-3 text-center">-</td>
                <td className="border border-neutral-800 p-3 text-center bg-blue-900">BDT {ledgerCalculatedData.totals.inValue.toLocaleString()}</td>
                
                <td className="border border-neutral-800 p-3 text-center">{ledgerCalculatedData.totals.outQty.toLocaleString()}</td>
                <td className="border border-neutral-800 p-3 text-center">-</td>
                <td className="border border-neutral-800 p-3 text-center bg-red-900">BDT {ledgerCalculatedData.totals.outValue.toLocaleString()}</td>
                
                <td colSpan={2} className="border border-neutral-800 p-3 text-right pr-6 bg-neutral-800">Stock in Hand Value:</td>
                <td className="border border-neutral-800 p-3 text-center bg-green-700 text-lg">
                  BDT {(ledgerCalculatedData.rows[ledgerCalculatedData.rows.length-1]?.balances.reduce((a: any, b: any) => a + b.total, 0) || 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
          
          <div className="mt-8 flex justify-between px-4 text-xs font-bold text-neutral-500 uppercase tracking-widest print:mt-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-[1px] bg-neutral-300"></div>
              <span>Prepared By</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-[1px] bg-neutral-300"></div>
              <span>Inventory Manager</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-[1px] bg-neutral-300"></div>
              <span>Authorized Signature</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 space-y-4 print:hidden">
          <History className="w-16 h-16 opacity-20" />
          <p className="text-lg font-medium">Select an item to view its detailed FIFO ledger</p>
        </div>
      )}
    </div>
  );
}

function ReportsView({ items, transactions, categories, fetchFullHistory, isHistoryLoading }: { items: Item[]; transactions: Transaction[]; categories: Category[]; fetchFullHistory: () => Promise<void>; isHistoryLoading: boolean }) {
  useEffect(() => {
    fetchFullHistory();
  }, [fetchFullHistory]);

  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPurchaseType, setSelectedPurchaseType] = useState<string>('all');
  const [reportType, setReportType] = useState<'movement' | 'transactions'>('movement');

  const reportData = useMemo(() => {
    const start = startOfDay(new Date(dateRange.start));
    const end = endOfDay(new Date(dateRange.end));

    const activeItems = items.filter(i => (i.status as string) !== 'deleted');
    const filteredItems = selectedCategory === 'all' 
      ? activeItems 
      : activeItems.filter(i => i.categoryId === selectedCategory);

    if (reportType === 'movement') {
      return filteredItems.map(item => {
        const itemTxs = transactions
          .filter(tx => tx.itemId === item.id && (tx.status as string) !== 'deleted')
          .sort((a, b) => a.date.toMillis() - b.date.toMillis());

        let batches: { quantity: number; price: number; date: Date }[] = [];
        
        let openingStock = 0;
        let openingValue = 0;
        let closingStock = 0;
        let closingValue = 0;

        let inQty = 0;
        let prodQty = 0;
        let outQty = 0;
        let extraReqQty = 0;
        let purchaseReturnQty = 0;
        let inValue = 0;
        let prodValue = 0;
        let outValue = 0;
        let extraReqValue = 0;
        let purchaseReturnValue = 0;

        let curStock = 0;
        let curValue = 0;
        let lastAvgCost = 0;

        for (const tx of itemTxs) {
          const txDate = tx.date.toDate();
          const qty = Number(tx.quantity) || 0;
          const price = Number(tx.price) || 0;
          const type = (tx.type || '').toUpperCase();
          const ref = (tx.reference || '').toUpperCase().trim();
          const isAddition = type === 'IN' || type === 'PRODUCTION_RETURN' || ref === 'OPENING';

          if (isAddition) {
            const val = qty * price;
            curStock += qty;
            curValue += val;
            if (curStock > 0) lastAvgCost = curValue / curStock;

            if (isWithinInterval(txDate, { start, end })) {
              if (ref === 'OPENING') {
                openingStock += qty;
                openingValue += val;
              } else {
                const txPurchaseType = tx.purchaseType || 'Local';
                if (selectedPurchaseType === 'all' || txPurchaseType === selectedPurchaseType) {
                  inQty += qty;
                  inValue += val;
                }
              }
            }
          } else {
            const currentAvgCost = curStock > 0 ? curValue / curStock : lastAvgCost;
            const deductionValue = qty * currentAvgCost;
            
            curStock -= qty;
            curValue -= deductionValue;
            if (curStock <= 0) curValue = 0;

            if (isWithinInterval(txDate, { start, end })) {
              if (type === 'OUT') {
                outQty += qty;
                outValue += deductionValue;
              } else if (type === 'PRODUCTION') {
                prodQty += qty;
                prodValue += deductionValue;
              } else if (type === 'EXTRA_REQUISITION') {
                extraReqQty += qty;
                extraReqValue += deductionValue;
              } else if (type === 'PURCHASE_RETURN') {
                purchaseReturnQty += qty;
                purchaseReturnValue += deductionValue;
              }
            }
          }

          if (txDate < start) {
            openingStock = curStock;
            openingValue = curValue;
          }
          if (txDate <= end) {
            closingStock = curStock;
            closingValue = curValue;
          }
        }

        return {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          openingStock,
          openingValue,
          inQty,
          inValue,
          outQty,
          outValue,
          prodQty,
          prodValue,
          extraReqQty,
          extraReqValue,
          purchaseReturnQty,
          purchaseReturnValue,
          closingStock,
          closingValue,
          unit: item.unit
        };
      });
    } else {
      // Transaction-wise report
      const filteredTxs = transactions
        .filter(tx => {
          const txDate = tx.date.toDate();
          const item = items.find(i => i.id === tx.itemId);
          const matchesCategory = selectedCategory === 'all' || (item && item.categoryId === selectedCategory);
          const matchesType = selectedType === 'all' || tx.type === selectedType;
          
          let matchesPurchaseType = true;
          if (tx.type === 'IN') {
            const txPurchaseType = tx.purchaseType || 'Local';
            matchesPurchaseType = selectedPurchaseType === 'all' || txPurchaseType === selectedPurchaseType;
          } else if (selectedPurchaseType !== 'all') {
            matchesPurchaseType = false;
          }

          return (tx.status as string) !== 'deleted' && 
                 isWithinInterval(txDate, { start, end }) && 
                 matchesCategory &&
                 matchesType &&
                 matchesPurchaseType;
        })
        .sort((a, b) => b.date.toMillis() - a.date.toMillis());

      return filteredTxs.map(tx => {
        const item = items.find(i => i.id === tx.itemId);
        return {
          id: tx.id,
          date: tx.date.toDate(),
          itemName: item?.name || 'Unknown Item',
          sku: item?.sku || '-',
          type: tx.type,
          quantity: tx.quantity,
          price: tx.price,
          totalValue: tx.quantity * tx.price,
          reference: getTxDisplayReferenceAndPurpose(tx),
          unit: item?.unit || ''
        };
      });
    }
  }, [items, transactions, dateRange, selectedCategory, selectedType, selectedPurchaseType, reportType]);

  const totals = useMemo(() => {
    if (reportType === 'movement') {
      return (reportData as any[]).reduce((acc, row) => {
        acc.openingValue += row.openingValue;
        acc.inValue += row.inValue;
        acc.outValue += row.outValue;
        acc.prodValue += row.prodValue;
        acc.extraReqValue += row.extraReqValue;
        acc.purchaseReturnValue += row.purchaseReturnValue;
        acc.closingValue += row.closingValue;
        return acc;
      }, { openingValue: 0, inValue: 0, outValue: 0, prodValue: 0, extraReqValue: 0, purchaseReturnValue: 0, closingValue: 0 });
    } else {
      return (reportData as any[]).reduce((acc, row) => {
        acc.totalValue += row.totalValue;
        acc.totalQty += row.quantity;
        return acc;
      }, { totalValue: 0, totalQty: 0 });
    }
  }, [reportData, reportType]);

  const exportToExcel = () => {
    let data = [];
    if (reportType === 'movement') {
      data = (reportData as any[]).map(row => ({
        Item: row.itemName,
        SKU: row.sku,
        'Opening Stock': row.openingStock,
        'Opening Value (BDT)': row.openingValue.toFixed(2),
        'Stock IN Qty': row.inQty,
        'Stock IN Value': row.inValue.toFixed(2),
        'Stock OUT Qty': row.outQty,
        'Stock OUT Value': row.outValue.toFixed(2),
        'Production Qty': row.prodQty,
        'Production Value': row.prodValue.toFixed(2),
        'Extra Req Qty': row.extraReqQty,
        'Extra Req Value': row.extraReqValue.toFixed(2),
        'Purchase Return Qty': row.purchaseReturnQty,
        'Purchase Return Value': row.purchaseReturnValue.toFixed(2),
        'Closing Stock': row.closingStock,
        'Closing Value (BDT)': row.closingValue.toFixed(2),
        Unit: row.unit
      }));
    } else {
      data = (reportData as any[]).map(row => ({
        Date: format(row.date, 'yyyy-MM-dd HH:mm'),
        Item: row.itemName,
        SKU: row.sku,
        Type: row.type,
        Quantity: row.quantity,
        Unit: row.unit,
        Price: row.price.toFixed(2),
        'Total Value': row.totalValue.toFixed(2),
        Reference: row.reference
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType === 'movement' ? "Stock Report" : "Transaction Report");
    XLSX.writeFile(wb, `${reportType === 'movement' ? 'Stock' : 'Transaction'}_Report_${dateRange.start}_to_${dateRange.end}.xlsx`);
  };

  const handlePrint = () => {
    printElement('printable-inventory-report', { 
      title: `${reportType === 'movement' ? 'Inventory_Stock_Report' : 'Transaction_Report'}_${dateRange.start}_to_${dateRange.end}`,
      pageOrientation: 'landscape'
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-bold text-neutral-900">Reports</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setReportType('movement')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all",
                  reportType === 'movement' ? "bg-black text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                )}
              >
                Stock Movement
              </button>
              <button 
                onClick={() => setReportType('transactions')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all",
                  reportType === 'transactions' ? "bg-black text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                )}
              >
                Transaction Wise
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase block">Category</label>
              <select 
                className="h-9 w-40 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm outline-none"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase block">Stock IN Source</label>
              <select 
                className="h-9 w-40 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm outline-none"
                value={selectedPurchaseType}
                onChange={e => setSelectedPurchaseType(e.target.value)}
              >
                <option value="all">All Sources</option>
                <option value="Local">Local</option>
                <option value="Bond">Bond</option>
              </select>
            </div>
            {reportType === 'transactions' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase block">Type</label>
                <select 
                  className="h-9 w-32 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm outline-none"
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="IN">Stock IN</option>
                  <option value="OUT">Stock OUT</option>
                  <option value="PRODUCTION">Production</option>
                  <option value="EXTRA_REQUISITION">Extra Req</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase block">From</label>
              <Input 
                type="date" 
                className="h-9 w-40" 
                value={dateRange.start} 
                onChange={e => setDateRange({ ...dateRange, start: e.target.value })} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase block">To</label>
              <Input 
                type="date" 
                className="h-9 w-40" 
                value={dateRange.end} 
                onChange={e => setDateRange({ ...dateRange, end: e.target.value })} 
              />
            </div>
            <div className="pt-5 flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
                <Download className="w-4 h-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <FileText className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div id="printable-inventory-report" className="printable-doc print-container">
        <div className="hidden print:block mb-8 text-center">
          <h1 className="text-2xl font-bold">{reportType === 'movement' ? 'Inventory Average Cost Report' : 'Transaction Wise Report'}</h1>
          <p className="text-neutral-500">Period: {dateRange.start} to {dateRange.end}</p>
        </div>

        {reportType === 'transactions' && reportData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:hidden">
            <Card className="p-4 bg-white border-neutral-100">
              <p className="text-xs font-bold text-neutral-500 uppercase mb-1">Total Transactions</p>
              <p className="text-2xl font-bold text-neutral-900">{reportData.length}</p>
            </Card>
            <Card className="p-4 bg-white border-neutral-100">
              <p className="text-xs font-bold text-neutral-500 uppercase mb-1">Total Quantity</p>
              <p className="text-2xl font-bold text-neutral-900">{(totals as any).totalQty.toLocaleString()}</p>
            </Card>
            <Card className="p-4 bg-neutral-900 border-neutral-900">
              <p className="text-xs font-bold text-neutral-400 uppercase mb-1">Total Value</p>
              <p className="text-2xl font-bold text-white">{(totals as any).totalValue.toLocaleString()} BDT</p>
            </Card>
          </div>
        )}

        <Card className="overflow-x-auto print:border-none print:shadow-none">
          {reportType === 'movement' ? (
            <table className="w-full text-left border-collapse print:text-[10pt]">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100 print:bg-neutral-100">
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Opening Stock</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Opening Value</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-900 uppercase tracking-wider">IN QTY (+)</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-900 uppercase tracking-wider">IN VALUE</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-900 uppercase tracking-wider">SALES QTY (-)</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-900 uppercase tracking-wider">SALES VALUE</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-900 uppercase tracking-wider">PROD (-)</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-900 uppercase tracking-wider">EXTRA (-)</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-900 uppercase tracking-wider text-amber-600">PURCHASE RETURN (-)</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Closing Stock</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider bg-neutral-900 text-white print:text-black print:bg-neutral-100">Closing Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(reportData as any[]).map((row) => (
                  <tr key={row.itemId} className="hover:bg-neutral-50/50 transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-neutral-900">{row.itemName}</p>
                      <p className="text-xs text-neutral-500">SKU: {row.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {row.openingStock} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {row.openingValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      +{row.inQty}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      {row.inValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      -{row.outQty}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      {row.outValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      -{row.prodQty}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      -{row.extraReqQty}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-amber-700">
                      -{row.purchaseReturnQty}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      {row.closingStock} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900 bg-neutral-50/50 print:bg-transparent">
                      {row.closingValue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
                <tfoot className="bg-neutral-900 font-bold text-white shadow-[0_-4px_15px_rgba(0,0,0,0.2)] sticky bottom-0 z-10 print:static">
                  <tr>
                    <td className="px-4 py-6 text-sm uppercase tracking-wider text-neutral-400">Grand Total</td>
                    <td className="px-4 py-6 text-sm text-center">-</td>
                    <td className="px-4 py-6 text-sm text-center">{(totals as any).openingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-6 text-sm text-center">-</td>
                    <td className="px-4 py-6 text-sm text-center">{(totals as any).inValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-6 text-sm text-center">-</td>
                    <td className="px-4 py-6 text-sm text-center">{(totals as any).outValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-6 text-sm text-center">{(totals as any).prodValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-6 text-sm text-center">{(totals as any).extraReqValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-6 text-sm text-center text-amber-400">{(totals as any).purchaseReturnValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-6 text-sm text-center">-</td>
                    <td className="px-4 py-6 text-sm text-center text-green-400 text-xl border-l border-neutral-700">
                      <span className="text-xs block text-neutral-400 font-medium mb-1">TOTAL CLOSING VALUE</span>
                      BDT {(totals as any).closingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
            </table>
          ) : (
            <table className="w-full text-left border-collapse print:text-[10pt]">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100 print:bg-neutral-100">
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Value</th>
                  <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(reportData as any[]).map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {format(row.date, 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-neutral-900">{row.itemName}</p>
                      <p className="text-xs text-neutral-500">SKU: {row.sku}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-full uppercase",
                        row.type === 'IN' ? "bg-green-100 text-neutral-900" : 
                        row.type === 'OUT' ? "bg-red-100 text-neutral-900" :
                        row.type === 'PRODUCTION' ? "bg-orange-100 text-neutral-900" :
                        row.type === 'PRODUCTION_RETURN' ? "bg-emerald-100 text-neutral-900" :
                        "bg-purple-100 text-neutral-900"
                      )}>
                        {row.type === 'OUT' ? 'SALES' : row.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {row.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-neutral-900">
                      {row.totalValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500 italic">
                      {row.reference}
                    </td>
                  </tr>
                ))}
              </tbody>
              {reportData.length > 0 && (
                <tfoot className="bg-neutral-50 font-bold print:bg-neutral-100">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm text-neutral-900 text-right uppercase">Total</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{(totals as any).totalQty}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">-</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{(totals as any).totalValue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
          {reportData.length === 0 && (
            <div className="px-6 py-12 text-center text-neutral-400 italic">
              No data available for the selected period.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
