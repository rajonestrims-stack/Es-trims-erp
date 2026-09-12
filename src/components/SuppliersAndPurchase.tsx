import React, { useState, useMemo, useRef, useEffect } from 'react';
import { printElement } from '../utils/printHelper';
import { 
  Users, 
  Plus, 
  Search, 
  FileText, 
  Printer, 
  CreditCard, 
  DollarSign, 
  Trash2, 
  Edit2, 
  Building2, 
  Calendar, 
  Check, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Phone, 
  Mail, 
  MapPin, 
  Package, 
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  Palette,
  CheckSquare,
  Filter,
  Receipt
} from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Timestamp, addDoc, updateDoc, deleteDoc, doc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier, PurchaseOrder, PurchaseOrderItem, SupplierPayment, PaymentAllocation, Item, Transaction, UserProfile, UserRolePermission, getSubmenuApprovalConfig, PurchaseRequisition } from '../types';
import { checkActionPermission, isUserSuperAdmin, canUserAccessPage } from '../admin/adminUtils';
import { checkPageApprovalRule, submitDocumentForApproval } from '../services/approvalService';
import { PurchaseOrderPrintView, POPrintData } from './PurchaseOrderPrintView';
import { SupplierPaymentVoucherPrintView, PaymentVoucherData } from './SupplierPaymentVoucherPrintView';
import { ApproverSelector, ApproverUserOption } from './ApproverSelector';

interface SuppliersAndPurchaseProps {
  userProfile: UserProfile;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPayment[];
  items: Item[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  recalculateItemStock: (itemId: string, businessId: string) => Promise<void>;
  fetchFullHistory?: (silent?: boolean) => Promise<void>;
  syncAllData?: (silent?: boolean) => Promise<void>;
  isEditor: boolean;
  initialTab?: 'suppliers' | 'ledger' | 'purchases' | 'payment' | 'report';
  selectedSupplierIdFromParent?: string | null;
  roles?: any[];
  allowedPagesSet?: Set<string>;
  requisitions?: PurchaseRequisition[];
  selectedReqForPOConversion?: PurchaseRequisition | null;
  onClearSelectedReqForPO?: () => void;
  onSwitchToRequisitions?: () => void;
}

// Convert numbers to words (Bengali / Taka standard helper)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Taka Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if ((n = n.toString() as any).length > 9) return 'overflow';
    const nMatch = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nMatch) return '';
    let str = '';
    str += (nMatch[1] != '00') ? (a[Number(nMatch[1])] || b[nMatch[1][0]] + ' ' + a[nMatch[1][1]]) + 'Crore ' : '';
    str += (nMatch[2] != '00') ? (a[Number(nMatch[2])] || b[nMatch[2][0]] + ' ' + a[nMatch[2][1]]) + 'Lakh ' : '';
    str += (nMatch[3] != '00') ? (a[Number(nMatch[3])] || b[nMatch[3][0]] + ' ' + a[nMatch[3][1]]) + 'Thousand ' : '';
    str += (nMatch[4] != '00') ? (a[Number(nMatch[4])] || b[nMatch[4][0]] + ' ' + a[nMatch[4][1]]) + 'Hundred ' : '';
    str += (nMatch[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(nMatch[5])] || b[nMatch[5][0]] + ' ' + a[nMatch[5][1]]) : '';
    return str.trim();
  }

  const taka = Math.floor(num);
  const paisa = Math.round((num - taka) * 100);
  let result = inWords(taka) + ' Taka';
  if (paisa > 0) {
    result += ' and ' + inWords(paisa) + ' Paisa';
  }
  return result + ' Only';
}

const toSafeDate = (val: any): Date => {
  if (!val) return new Date();
  try {
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      return isNaN(d.getTime()) ? new Date() : d;
    }
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? new Date() : val;
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    if (val.seconds !== undefined && typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      return isNaN(d.getTime()) ? new Date() : d;
    }
  } catch (e) {
    console.warn('toSafeDate error:', e);
  }
  return new Date();
};

function SearchableSupplierSelect({
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  placeholder = "Search supplier name, phone, contact...",
  supplierStatsMap,
  className = ""
}: {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSelectSupplier: (id: string) => void;
  placeholder?: string;
  supplierStatsMap?: Record<string, { totalPurchases: number; totalPayments: number; netBalance: number }>;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveId = selectedSupplierId || suppliers[0]?.id || '';
  const selectedSupplier = suppliers.find(s => s.id === effectiveId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return suppliers;
    const tokens = q.split(/\s+/).filter(Boolean);
    return suppliers.filter(s => {
      const text = [s.name, s.phone, s.contactPerson, s.email, s.address].filter(Boolean).join(' ').toLowerCase();
      return tokens.every(token => text.includes(token));
    });
  }, [suppliers, filterText]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
      >
        <span className="truncate text-left">
          {selectedSupplier ? (
            <>
              {selectedSupplier.name}
              {supplierStatsMap && supplierStatsMap[selectedSupplier.id] !== undefined && (
                <span className="text-neutral-500 font-normal ml-1">
                  (Bal: {(supplierStatsMap[selectedSupplier.id]?.netBalance || 0).toLocaleString()} Tk)
                </span>
              )}
            </>
          ) : (
            <span className="text-neutral-400 font-normal">-- Choose Supplier --</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-64 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-neutral-100 bg-neutral-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                autoFocus
                placeholder={placeholder}
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48 divide-y divide-neutral-50">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-neutral-400 text-xs">
                No supplier matching "{filterText}"
              </div>
            ) : (
              filtered.map(s => {
                const bal = supplierStatsMap?.[s.id]?.netBalance;
                const isSelected = s.id === selectedSupplierId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSupplier(s.id);
                      setIsOpen(false);
                      setFilterText('');
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{s.name}</div>
                      {(s.phone || s.contactPerson) && (
                        <div className="text-[10px] text-neutral-500">
                          {s.contactPerson ? `${s.contactPerson} ` : ''}
                          {s.phone ? `• ${s.phone}` : ''}
                        </div>
                      )}
                    </div>
                    {bal !== undefined && (
                      <span className={`text-[10px] font-bold ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {bal.toLocaleString()} Tk
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const SuppliersAndPurchase: React.FC<SuppliersAndPurchaseProps> = ({
  userProfile,
  suppliers,
  purchaseOrders,
  supplierPayments,
  items,
  showToast,
  recalculateItemStock,
  fetchFullHistory,
  syncAllData,
  isEditor,
  initialTab = 'report',
  selectedSupplierIdFromParent = null,
  roles = [],
  allowedPagesSet,
  requisitions = [],
  selectedReqForPOConversion = null,
  onClearSelectedReqForPO,
  onSwitchToRequisitions
}) => {
  // Granular Action & Tab-level Permissions
  const isSuperAdmin = isUserSuperAdmin(userProfile);
  const canAccessReport = isSuperAdmin || (allowedPagesSet ? allowedPagesSet.has('supplier-report') || allowedPagesSet.has('reports') : canUserAccessPage(userProfile, 'supplier-report', roles) || canUserAccessPage(userProfile, 'reports', roles));
  const canAccessSuppliers = isSuperAdmin || (allowedPagesSet ? allowedPagesSet.has('procurement-suppliers') || allowedPagesSet.has('suppliers') : canUserAccessPage(userProfile, 'procurement-suppliers', roles) || canUserAccessPage(userProfile, 'suppliers', roles));
  const canAccessPO = isSuperAdmin || (allowedPagesSet ? allowedPagesSet.has('procurement-po') || allowedPagesSet.has('purchases') : canUserAccessPage(userProfile, 'procurement-po', roles) || canUserAccessPage(userProfile, 'purchases', roles));
  const canAccessLedger = isSuperAdmin || (allowedPagesSet ? allowedPagesSet.has('supplier-ledger') : canUserAccessPage(userProfile, 'supplier-ledger', roles));
  const canAccessPayment = isSuperAdmin || (allowedPagesSet ? allowedPagesSet.has('supplier-payment') : canUserAccessPage(userProfile, 'supplier-payment', roles));

  const availableTabs = useMemo(() => {
    const tabs: ('report' | 'suppliers' | 'purchases' | 'ledger' | 'payment')[] = [];
    if (canAccessReport) tabs.push('report');
    if (canAccessSuppliers) tabs.push('suppliers');
    if (canAccessPO) tabs.push('purchases');
    if (canAccessLedger) tabs.push('ledger');
    if (canAccessPayment) tabs.push('payment');
    return tabs;
  }, [canAccessReport, canAccessSuppliers, canAccessPO, canAccessLedger, canAccessPayment]);

  const safeInitialTab = (initialTab === 'ledger' && !canAccessLedger) || (initialTab === 'payment' && !canAccessPayment)
    ? (availableTabs[0] || 'suppliers')
    : initialTab;

  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchases' | 'ledger' | 'payment' | 'report'>(safeInitialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(selectedSupplierIdFromParent);

  // Approver routing states
  const [selectedApproverPO, setSelectedApproverPO] = useState<ApproverUserOption | null>(null);
  const [poApprovalRequired, setPoApprovalRequired] = useState(false);

  const [selectedApproverPayment, setSelectedApproverPayment] = useState<ApproverUserOption | null>(null);
  const [paymentApprovalRequired, setPaymentApprovalRequired] = useState(false);

  const canCreateSupplier = isSuperAdmin || checkActionPermission(userProfile, 'procurement-suppliers', 'create', roles);
  const canEditSupplier = isSuperAdmin || checkActionPermission(userProfile, 'procurement-suppliers', 'edit', roles);
  const canDeleteSupplier = isSuperAdmin || checkActionPermission(userProfile, 'procurement-suppliers', 'delete', roles);

  const canCreatePO = isSuperAdmin || checkActionPermission(userProfile, 'procurement-po', 'create', roles);
  const canEditPO = isSuperAdmin || checkActionPermission(userProfile, 'procurement-po', 'edit', roles);
  const canDeletePO = isSuperAdmin || checkActionPermission(userProfile, 'procurement-po', 'delete', roles);

  const canCreatePayment = isSuperAdmin || checkActionPermission(userProfile, 'supplier-payment', 'create', roles);
  const canEditPayment = isSuperAdmin || checkActionPermission(userProfile, 'supplier-payment', 'edit', roles);
  const canDeletePayment = isSuperAdmin;

  const canEdit = isSuperAdmin || isEditor || canEditSupplier || canCreateSupplier || canCreatePO || canEditPO;

  // Safe tab switch guard
  const handleTabSwitch = (targetTab: 'suppliers' | 'purchases' | 'ledger' | 'payment' | 'report') => {
    if (targetTab === 'ledger' && !canAccessLedger) {
      showToast('You do not have permission to access Supplier Ledger & Accounts', 'error');
      return;
    }
    if (targetTab === 'payment' && !canAccessPayment) {
      showToast('You do not have permission to access Supplier Payment', 'error');
      return;
    }
    setActiveTab(targetTab);
  };

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  // Requisitions handling & syncing for PO conversion
  const [internalRequisitions, setInternalRequisitions] = useState<PurchaseRequisition[]>([]);
  const [activeRequisitionForPO, setActiveRequisitionForPO] = useState<PurchaseRequisition | null>(null);
  const [showRequisitionPickerModal, setShowRequisitionPickerModal] = useState(false);

  useEffect(() => {
    if (requisitions && requisitions.length > 0) {
      setInternalRequisitions(requisitions);
    } else if (userProfile?.businessId) {
      const qReq = query(
        collection(db, 'purchase_requisitions'),
        where('businessId', '==', userProfile.businessId)
      );
      const unsub = onSnapshot(qReq, (snap) => {
        const list: PurchaseRequisition[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as PurchaseRequisition);
        });
        setInternalRequisitions(list);
      }, (err) => console.warn('PR listener warning in SuppliersAndPurchase:', err));
      return () => unsub();
    }
  }, [requisitions, userProfile?.businessId]);

  const allRequisitions = requisitions && requisitions.length > 0 ? requisitions : internalRequisitions;

  const approvedRequisitions = useMemo(() => {
    return allRequisitions.filter(r => r.status === 'approved' || r.status === 'partially_ordered');
  }, [allRequisitions]);

  // Total Supplier Report Filters
  const [reportStartDate, setReportStartDate] = useState<string>(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  );
  const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Supplier Ledger Date Range Filters
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');

  const setReportPresetDate = (preset: 'today' | 'month' | 'lastMonth' | 'year' | 'all') => {
    const today = new Date();
    if (preset === 'today') {
      const dateStr = format(today, 'yyyy-MM-dd');
      setReportStartDate(dateStr);
      setReportEndDate(dateStr);
    } else if (preset === 'month') {
      const startStr = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
      const endStr = format(today, 'yyyy-MM-dd');
      setReportStartDate(startStr);
      setReportEndDate(endStr);
    } else if (preset === 'lastMonth') {
      const prevMonthStart = format(new Date(today.getFullYear(), today.getMonth() - 1, 1), 'yyyy-MM-dd');
      const prevMonthEnd = format(new Date(today.getFullYear(), today.getMonth(), 0), 'yyyy-MM-dd');
      setReportStartDate(prevMonthStart);
      setReportEndDate(prevMonthEnd);
    } else if (preset === 'year') {
      const startStr = format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd');
      const endStr = format(today, 'yyyy-MM-dd');
      setReportStartDate(startStr);
      setReportEndDate(endStr);
    } else if (preset === 'all') {
      setReportStartDate('');
      setReportEndDate('');
    }
  };

  const setLedgerPresetDate = (preset: 'today' | 'month' | 'last30' | 'year' | 'all') => {
    const today = new Date();
    if (preset === 'today') {
      const dateStr = format(today, 'yyyy-MM-dd');
      setLedgerStartDate(dateStr);
      setLedgerEndDate(dateStr);
    } else if (preset === 'month') {
      const startStr = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
      const endStr = format(today, 'yyyy-MM-dd');
      setLedgerStartDate(startStr);
      setLedgerEndDate(endStr);
    } else if (preset === 'last30') {
      const prev30 = new Date();
      prev30.setDate(today.getDate() - 30);
      setLedgerStartDate(format(prev30, 'yyyy-MM-dd'));
      setLedgerEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'year') {
      const startStr = format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd');
      const endStr = format(today, 'yyyy-MM-dd');
      setLedgerStartDate(startStr);
      setLedgerEndDate(endStr);
    } else if (preset === 'all') {
      setLedgerStartDate('');
      setLedgerEndDate('');
    }
  };

  useEffect(() => {
    if (initialTab && availableTabs.includes(initialTab)) {
      setActiveTab(initialTab);
    } else if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [initialTab, availableTabs]);

  useEffect(() => {
    if (!selectedSupplierId && suppliers.length > 0) {
      setSelectedSupplierId(suppliers[0].id);
    }
  }, [suppliers, selectedSupplierId]);

  // Modal States
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPOForPrint, setSelectedPOForPrint] = useState<PurchaseOrder | null>(null);
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<SupplierPayment | null>(null);

  // Supplier / Party Master Form State
  const [partyCategory, setPartyCategory] = useState('Supplier');
  const [partyType, setPartyType] = useState('Manufacturer');
  const [supplierName, setSupplierName] = useState('');
  const [partyCode, setPartyCode] = useState('');

  // Address Section
  const [addressType, setAddressType] = useState('Main Address');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [addressLine3, setAddressLine3] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState('');
  const [state, setState] = useState('Dhaka');
  const [country, setCountry] = useState('Bangladesh');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Contacts Section
  const [contactPurpose, setContactPurpose] = useState('EmailAndSms');
  const [contactType, setContactType] = useState('CustomerHead');
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  const [email2, setEmail2] = useState('');
  const [location, setLocation] = useState('');

  // Multi-Item Purchase Form State
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [purchaseType, setPurchaseType] = useState<'Local' | 'Bond'>('Local');
  const [poNotes, setPoNotes] = useState('');
  const [poVatPercent, setPoVatPercent] = useState<number | string>(0);
  const [poAitPercent, setPoAitPercent] = useState<number | string>(0);
  const [poDiscount, setPoDiscount] = useState<number | string>(0);
  const [poTermsConditions, setPoTermsConditions] = useState(
    '1. All materials must be supplied as per approved specification.\n' +
    '2. Quality and quantity must be strictly maintained.\n' +
    '3. Mention Purchase Order number on invoice and delivery challan.\n' +
    '4. Rejected / under quality materials will be replaced by supplier.\n' +
    '5. Payment will be made as per company policy after inspection & bill submission.'
  );
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([
    { itemId: '', itemName: '', sku: '', unit: '', quantity: 1, price: 0, total: 0 }
  ]);

  // Check if entered PO Number is duplicate in real-time
  const isDuplicatePONumber = useMemo(() => {
    if (!poNumber.trim()) return false;
    const clean = poNumber.trim().toUpperCase();
    return purchaseOrders.some(p =>
      p.id !== editingPO?.id &&
      p.status !== 'deleted' &&
      (p.poNumber || '').trim().toUpperCase() === clean
    );
  }, [poNumber, purchaseOrders, editingPO]);

  // Payment Form State
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payMethod, setPayMethod] = useState('Cash');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payAllocations, setPayAllocations] = useState<Record<string, number>>({});

  // Calculate total allocated amount per PO across all saved payments
  const poAllocatedMap = useMemo(() => {
    const map: Record<string, number> = {};
    supplierPayments.forEach(pm => {
      if (pm.allocations && Array.isArray(pm.allocations)) {
        pm.allocations.forEach(alloc => {
          if (alloc.poId) {
            map[alloc.poId] = (map[alloc.poId] || 0) + Number(alloc.allocatedAmount || 0);
          }
        });
      }
    });
    return map;
  }, [supplierPayments]);

  // Open / unpaid Purchase Orders for currently selected paySupplierId
  const openPOListForPaySupplier = useMemo(() => {
    if (!paySupplierId) return [];
    return purchaseOrders
      .filter(po => po.supplierId === paySupplierId && po.status !== 'pending_delete' && (po.purchaseType as string) !== 'Dyeing')
      .map(po => {
        const paidSoFar = poAllocatedMap[po.id] || 0;
        const totalAmount = Number(po.totalAmount || 0);
        const dueAmount = Math.max(0, totalAmount - paidSoFar);
        return {
          po,
          totalAmount,
          paidSoFar,
          dueAmount
        };
      })
      .filter(item => item.dueAmount > 0.01)
      .sort((a, b) => toSafeDate(a.po.date).getTime() - toSafeDate(b.po.date).getTime());
  }, [paySupplierId, purchaseOrders, poAllocatedMap]);

  // Auto-allocate payAmount sequentially across open POs
  const handleAutoAllocate = (amountToDistribute?: number) => {
    const targetAmt = amountToDistribute !== undefined ? amountToDistribute : (Number(payAmount) || 0);
    let remaining = targetAmt;
    const newAlloc: Record<string, number> = {};

    openPOListForPaySupplier.forEach(item => {
      if (remaining <= 0) {
        newAlloc[item.po.id] = 0;
      } else {
        const alloc = Math.min(remaining, item.dueAmount);
        newAlloc[item.po.id] = alloc;
        remaining -= alloc;
      }
    });
    setPayAllocations(newAlloc);
  };

  // Toggle selection or change individual bill allocation
  const handleBillAllocationChange = (poId: string, val: number, maxDue: number) => {
    const clampedVal = Math.max(0, Math.min(val, maxDue));
    setPayAllocations(prev => ({
      ...prev,
      [poId]: clampedVal
    }));
  };

  // Total allocated amount sum
  const totalAllocated = useMemo(() => {
    return Object.values(payAllocations).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
  }, [payAllocations]);

  // CSV File Input Refs
  const supplierFileInputRef = useRef<HTMLInputElement>(null);
  const ledgerFileInputRef = useRef<HTMLInputElement>(null);
  const replaceLedgerFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse dates flexibly from CSV
  const parseCSVDate = (dateStr: any): Date => {
    if (!dateStr) return new Date();
    const str = dateStr.toString().trim();
    if (!str) return new Date();

    // Month names map
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      january: 0, february: 1, march: 2, april: 3, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };

    // Split by whitespace, dash, slash, dot
    const parts = str.split(/[\s\-/.]+/);
    if (parts.length === 3) {
      let p0 = parts[0].trim();
      let p1 = parts[1].trim();
      let p2 = parts[2].trim();

      let day = 0;
      let month = -1;
      let year = 0;

      const lowerP0 = p0.toLowerCase();
      const lowerP1 = p1.toLowerCase();

      if (monthMap[lowerP1] !== undefined) {
        // e.g., 18-May-25 or 18-May-2025
        day = parseInt(p0, 10);
        month = monthMap[lowerP1];
        year = parseInt(p2, 10);
      } else if (monthMap[lowerP0] !== undefined) {
        // e.g., May-18-2025
        month = monthMap[lowerP0];
        day = parseInt(p1, 10);
        year = parseInt(p2, 10);
      } else {
        // Numeric parts e.g. 18-05-2025 or 2025-05-18 or 18/05/25
        let num0 = parseInt(p0, 10);
        let num1 = parseInt(p1, 10);
        let num2 = parseInt(p2, 10);

        if (num0 > 1000) {
          // e.g. 2025-05-18
          year = num0;
          month = num1 - 1;
          day = num2;
        } else {
          // e.g. 18-05-2025 or 18-05-25
          day = num0;
          month = num1 - 1;
          year = num2;
        }
      }

      if (year < 100) {
        year += 2000;
      }

      if (!isNaN(day) && month >= 0 && month <= 11 && !isNaN(year) && year > 1900) {
        return new Date(year, month, day);
      }
    }

    const directDate = new Date(str);
    if (!isNaN(directDate.getTime())) return directDate;

    return new Date();
  };

  // Export Suppliers to CSV
  const handleExportSuppliersCSV = () => {
    if (suppliers.length === 0) {
      showToast('No suppliers available to export', 'error');
      return;
    }
    const csvData = suppliers.map(s => {
      const stats = supplierStatsMap[s.id] || { totalPurchases: 0, totalPayments: 0, netBalance: s.openingBalance || 0 };
      return {
        'Supplier Name': s.name,
        'Contact Person': s.contactPerson || '',
        'Phone': s.phone || '',
        'Email': s.email || '',
        'Address': s.address || '',
        'Opening Balance': s.openingBalance || 0,
        'Total Purchases': stats.totalPurchases,
        'Total Payments': stats.totalPayments,
        'Net Payable Balance': stats.netBalance
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `suppliers_list_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Suppliers exported to CSV');
  };

  // Download Sample CSV Template
  const handleDownloadSampleSupplierCSV = () => {
    const sampleData = [
      {
        'Supplier Name': 'Acme Accessories Ltd',
        'Contact Person': 'Rahim Uddin',
        'Phone': '01711000000',
        'Email': 'acme@example.com',
        'Address': 'Dhaka, Bangladesh',
        'Opening Balance': 50000
      },
      {
        'Supplier Name': 'Poly & Box House',
        'Contact Person': 'Karim Hossain',
        'Phone': '01819000000',
        'Email': 'poly@example.com',
        'Address': 'Gazipur, Bangladesh',
        'Opening Balance': 12000
      }
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `suppliers_import_sample.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import Suppliers from CSV
  const handleImportSuppliersCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV Parse Warnings:', results.errors);
        }

        const rows = results.data as Record<string, any>[];
        if (!rows || rows.length === 0) {
          showToast('The selected CSV file is empty', 'error');
          return;
        }

        let importedCount = 0;
        try {
          for (const row of rows) {
            const name = (row['Supplier Name'] || row['SupplierName'] || row['Name'] || row['name'] || '').toString().trim();
            if (!name) continue;

            const contactPerson = (row['Contact Person'] || row['ContactPerson'] || row['Contact'] || row['contact'] || '').toString().trim();
            const phone = (row['Phone'] || row['phone'] || row['Mobile'] || row['mobile'] || '').toString().trim();
            const email = (row['Email'] || row['email'] || '').toString().trim();
            const address = (row['Address'] || row['address'] || '').toString().trim();
            const openingBalanceVal = parseFloat(row['Opening Balance'] || row['OpeningBalance'] || row['Opening Bal'] || row['openingBalance'] || '0') || 0;

            await addDoc(collection(db, 'suppliers'), {
              name,
              contactPerson,
              phone,
              email,
              address,
              openingBalance: openingBalanceVal,
              businessId: userProfile.businessId,
              ownerId: userProfile.uid,
              createdAt: Timestamp.now()
            });
            importedCount++;
          }

          if (importedCount > 0) {
            showToast(`Successfully imported ${importedCount} supplier(s) from CSV!`);
          } else {
            showToast('No valid supplier records found in CSV. Please check column headers.', 'error');
          }
        } catch (err: any) {
          console.error('Failed to import suppliers:', err);
          showToast(err.message || 'Failed to import suppliers from CSV', 'error');
        } finally {
          e.target.value = '';
        }
      },
      error: (err) => {
        showToast(`CSV Parse Error: ${err.message}`, 'error');
        e.target.value = '';
      }
    });
  };

  // --- SUPPLIER LEDGER CSV FUNCTIONS ---
  // Export Selected Supplier Ledger to CSV
  const handleExportLedgerCSV = () => {
    if (!ledgerSupplier) {
      showToast('Please select a supplier to export ledger', 'error');
      return;
    }
    if (ledgerEntries.length === 0) {
      showToast('No ledger entries available to export', 'error');
      return;
    }

    const csvData = ledgerEntries.map(e => ({
      'Date': format(e.date, 'yyyy-MM-dd'),
      'Details': e.description,
      'Debit': e.debit > 0 ? e.debit : 0,
      'Credit': e.credit > 0 ? e.credit : 0,
      'Balance': e.runningBalance
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supplier_ledger_${ledgerSupplier.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Supplier ledger exported to CSV');
  };

  // Download Sample Supplier Ledger CSV Template (Date, Details, Debit, Credit, Balance)
  const handleDownloadSampleLedgerCSV = () => {
    const sampleData = [
      {
        'Date': '2026-01-01',
        'Details': 'Opening Balance',
        'Debit': 0,
        'Credit': 50000,
        'Balance': 50000
      },
      {
        'Date': '2026-01-10',
        'Details': 'Poly & Box Batch #101 Purchase Invoice',
        'Debit': 0,
        'Credit': 15000,
        'Balance': 65000
      },
      {
        'Date': '2026-01-15',
        'Details': 'Payment via Cash / Bank Transfer',
        'Debit': 20000,
        'Credit': 0,
        'Balance': 45000
      }
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supplier_ledger_sample_format.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import Supplier Ledger CSV (Format: Date, Details, Debit, Credit, Balance)
  const handleImportLedgerCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ledgerSupplier) {
      showToast('Please select a supplier before uploading ledger CSV', 'error');
      e.target.value = '';
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV Parse Warnings:', results.errors);
        }

        const rows = results.data as Record<string, any>[];
        if (!rows || rows.length === 0) {
          showToast('The selected CSV file is empty', 'error');
          e.target.value = '';
          return;
        }

        let importedCount = 0;
        try {
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const normRow: Record<string, any> = {};
            Object.keys(row).forEach(k => {
              if (k) normRow[k.trim().toLowerCase()] = row[k];
            });

            const rawDate = normRow['date'] || normRow['transaction date'] || normRow['tx date'] || normRow['dt'] || '';
            const details = (
              normRow['details'] || 
              normRow['particulars'] || 
              normRow['description'] || 
              normRow['notes'] || 
              normRow['narration'] || ''
            ).toString().trim();

            const rawDebit = normRow['debit'] || normRow['dabit'] || normRow['debit amount'] || normRow['payment'] || normRow['paid'] || '0';
            const rawCredit = normRow['credit'] || normRow['cradit'] || normRow['credit amount'] || normRow['purchase'] || normRow['bill'] || '0';

            const debitVal = Math.abs(parseFloat(rawDebit.toString().replace(/,/g, ''))) || 0;
            const creditVal = Math.abs(parseFloat(rawCredit.toString().replace(/,/g, ''))) || 0;

            if (debitVal === 0 && creditVal === 0 && !details) continue;

            const parsedDate = parseCSVDate(rawDate);
            const timestamp = Timestamp.fromDate(parsedDate);

            const lowerDetails = details.toLowerCase();
            if (lowerDetails.includes('opening balance') || lowerDetails.includes('opening') || lowerDetails === 'ob') {
              const obVal = creditVal > 0 ? creditVal : (debitVal > 0 ? -debitVal : 0);
              if (obVal !== 0) {
                await updateDoc(doc(db, 'suppliers', ledgerSupplier.id), {
                  openingBalance: obVal
                });
                importedCount++;
                continue;
              }
            }

            // Debit = Payment made to supplier
            if (debitVal > 0) {
              await addDoc(collection(db, 'supplierPayments'), {
                supplierId: ledgerSupplier.id,
                supplierName: ledgerSupplier.name,
                amount: debitVal,
                paymentDate: timestamp,
                paymentMethod: 'CSV Ledger Import',
                reference: `CSV-IMP-${i + 1}`,
                notes: details || 'Imported Payment',
                businessId: userProfile.businessId,
                ownerId: userProfile.uid,
                createdAt: Timestamp.now()
              });
              importedCount++;
            }

            // Credit = Purchase / Bill from supplier
            if (creditVal > 0) {
              const genPoNum = `PO-IMP-${format(parsedDate, 'yyyyMMdd')}-${String(i + 1).padStart(3, '0')}`;
              await addDoc(collection(db, 'purchaseOrders'), {
                poNumber: genPoNum,
                date: timestamp,
                supplierId: ledgerSupplier.id,
                supplierName: ledgerSupplier.name,
                purchaseType: 'Local',
                notes: details || 'Imported Ledger Purchase',
                items: [{
                  itemId: '',
                  itemName: details || 'Imported Purchase Bill',
                  sku: '',
                  unit: 'Pcs',
                  quantity: 1,
                  price: creditVal,
                  total: creditVal
                }],
                totalAmount: creditVal,
                businessId: userProfile.businessId,
                ownerId: userProfile.uid,
                status: 'active',
                createdAt: Timestamp.now()
              });
              importedCount++;
            }
          }

          if (importedCount > 0) {
            showToast(`Successfully imported ${importedCount} ledger entries for ${ledgerSupplier.name}!`);
            if (syncAllData) await syncAllData(true);
            if (fetchFullHistory) await fetchFullHistory(true);
          } else {
            showToast('No valid ledger records found in CSV. Expected headers: Date, Details, Debit, Credit, Balance.', 'error');
          }
        } catch (err: any) {
          console.error('Failed to import ledger CSV:', err);
          showToast(err.message || 'Failed to import ledger CSV', 'error');
        } finally {
          e.target.value = '';
        }
      },
      error: (err) => {
        showToast(`CSV Parse Error: ${err.message}`, 'error');
        e.target.value = '';
      }
    });
  };

  // Replace Supplier Ledger CSV (Clears previous entries for this supplier & imports new ones)
  const handleReplaceLedgerCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ledgerSupplier) {
      showToast('Please select a supplier before replacing ledger CSV', 'error');
      e.target.value = '';
      return;
    }

    const currentSupplierName = ledgerSupplier.name;
    const currentSupplierId = ledgerSupplier.id;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV Parse Warnings:', results.errors);
        }

        const rows = results.data as Record<string, any>[];
        if (!rows || rows.length === 0) {
          showToast('The selected CSV file is empty', 'error');
          e.target.value = '';
          return;
        }

        try {
          if (!userProfile?.businessId) {
            showToast('User business profile not found', 'error');
            e.target.value = '';
            return;
          }

          showToast(`Clearing old records for ${currentSupplierName}...`);
          const bId = userProfile.businessId;

          // 1. Delete existing Purchase Orders for this supplier
          const poQuery = query(collection(db, 'purchaseOrders'), where('businessId', '==', bId));
          const poSnap = await getDocs(poQuery);
          const poDeletes = poSnap.docs
            .filter(d => {
              const data = d.data();
              return data.supplierId === currentSupplierId || data.supplierName === currentSupplierName;
            })
            .map(d => deleteDoc(doc(db, 'purchaseOrders', d.id)));
          await Promise.all(poDeletes);

          // 2. Delete existing Supplier Payments for this supplier
          const payQuery = query(collection(db, 'supplierPayments'), where('businessId', '==', bId));
          const paySnap = await getDocs(payQuery);
          const payDeletes = paySnap.docs
            .filter(d => {
              const data = d.data();
              return data.supplierId === currentSupplierId || data.supplierName === currentSupplierName;
            })
            .map(d => deleteDoc(doc(db, 'supplierPayments', d.id)));
          await Promise.all(payDeletes);

          // 3. Delete existing Transactions for this supplier
          const txQuery = query(collection(db, 'transactions'), where('businessId', '==', bId));
          const txSnap = await getDocs(txQuery);
          const txDeletes = txSnap.docs
            .filter(d => {
              const data = d.data();
              return data.supplierId === currentSupplierId || data.supplierName === currentSupplierName;
            })
            .map(d => deleteDoc(doc(db, 'transactions', d.id)));
          await Promise.all(txDeletes);

          // 4. Reset supplier opening balance
          await updateDoc(doc(db, 'suppliers', currentSupplierId), {
            openingBalance: 0
          });

          // 4. Import new entries
          let importedCount = 0;
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const normRow: Record<string, any> = {};
            Object.keys(row).forEach(k => {
              if (k) normRow[k.trim().toLowerCase()] = row[k];
            });

            const rawDate = normRow['date'] || normRow['transaction date'] || normRow['tx date'] || normRow['dt'] || '';
            const details = (
              normRow['details'] || 
              normRow['particulars'] || 
              normRow['description'] || 
              normRow['notes'] || 
              normRow['narration'] || ''
            ).toString().trim();

            const rawDebit = normRow['debit'] || normRow['dabit'] || normRow['debit amount'] || normRow['payment'] || normRow['paid'] || '0';
            const rawCredit = normRow['credit'] || normRow['cradit'] || normRow['credit amount'] || normRow['purchase'] || normRow['bill'] || '0';

            const debitVal = Math.abs(parseFloat(rawDebit.toString().replace(/,/g, ''))) || 0;
            const creditVal = Math.abs(parseFloat(rawCredit.toString().replace(/,/g, ''))) || 0;

            if (debitVal === 0 && creditVal === 0 && !details) continue;

            const parsedDate = parseCSVDate(rawDate);
            const timestamp = Timestamp.fromDate(parsedDate);

            const lowerDetails = details.toLowerCase();
            if (lowerDetails.includes('opening balance') || lowerDetails.includes('opening') || lowerDetails === 'ob') {
              const obVal = creditVal > 0 ? creditVal : (debitVal > 0 ? -debitVal : 0);
              if (obVal !== 0) {
                await updateDoc(doc(db, 'suppliers', currentSupplierId), {
                  openingBalance: obVal
                });
                importedCount++;
                continue;
              }
            }

            // Debit = Payment made to supplier
            if (debitVal > 0) {
              await addDoc(collection(db, 'supplierPayments'), {
                supplierId: currentSupplierId,
                supplierName: currentSupplierName,
                amount: debitVal,
                paymentDate: timestamp,
                paymentMethod: 'CSV Ledger Import',
                reference: `CSV-IMP-${i + 1}`,
                notes: details || 'Imported Payment',
                businessId: userProfile.businessId,
                ownerId: userProfile.uid,
                createdAt: Timestamp.now()
              });
              importedCount++;
            }

            // Credit = Purchase / Bill from supplier
            if (creditVal > 0) {
              const genPoNum = `PO-IMP-${format(parsedDate, 'yyyyMMdd')}-${String(i + 1).padStart(3, '0')}`;
              await addDoc(collection(db, 'purchaseOrders'), {
                poNumber: genPoNum,
                date: timestamp,
                supplierId: currentSupplierId,
                supplierName: currentSupplierName,
                purchaseType: 'Local',
                notes: details || 'Imported Ledger Purchase',
                items: [{
                  itemId: '',
                  itemName: details || 'Imported Purchase Bill',
                  sku: '',
                  unit: 'Pcs',
                  quantity: 1,
                  price: creditVal,
                  total: creditVal
                }],
                totalAmount: creditVal,
                businessId: userProfile.businessId,
                ownerId: userProfile.uid,
                status: 'active',
                createdAt: Timestamp.now()
              });
              importedCount++;
            }
          }

          if (syncAllData) await syncAllData(true);
          if (fetchFullHistory) await fetchFullHistory(true);
          showToast(`Replaced ledger! Cleared old records and imported ${importedCount} new entries for ${currentSupplierName}.`);
        } catch (err: any) {
          console.error('Failed to replace ledger CSV:', err);
          showToast(err.message || 'Failed to replace ledger CSV', 'error');
        } finally {
          e.target.value = '';
        }
      },
      error: (err) => {
        showToast(`CSV Parse Error: ${err.message}`, 'error');
        e.target.value = '';
      }
    });
  };

  // Calculate Balances per Supplier
  const supplierStatsMap = useMemo(() => {
    const map: Record<string, { totalPurchases: number; totalPayments: number; netBalance: number }> = {};

    suppliers.forEach(s => {
      const ob = Number(s.openingBalance) || 0;
      map[s.id] = {
        totalPurchases: 0,
        totalPayments: 0,
        netBalance: -ob // Opening balance payable is Credit (-ob)
      };
    });

    purchaseOrders.forEach(po => {
      const isDyeing = (po.purchaseType as string) === 'Dyeing' || po.poNumber.toUpperCase().includes('DYE');
      if (!isDyeing && po.status !== 'deleted' && map[po.supplierId]) {
        const amt = Number(po.totalAmount) || 0;
        map[po.supplierId].totalPurchases += amt;
        map[po.supplierId].netBalance -= amt; // Purchase is Credit (-)
      }
    });

    supplierPayments.forEach(pm => {
      if (map[pm.supplierId]) {
        const amt = Number(pm.amount) || 0;
        map[pm.supplierId].totalPayments += amt;
        map[pm.supplierId].netBalance += amt; // Payment is Debit (+)
      }
    });

    return map;
  }, [suppliers, purchaseOrders, supplierPayments]);

  // Helper to parse report start & end dates safely
  const safeStart = useMemo(() => {
    if (!reportStartDate) return new Date(2000, 0, 1);
    const parts = reportStartDate.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
    }
    const d = new Date(reportStartDate);
    return isNaN(d.getTime()) ? new Date(2000, 0, 1) : d;
  }, [reportStartDate]);

  const safeEnd = useMemo(() => {
    if (!reportEndDate) return new Date(2099, 11, 31);
    const parts = reportEndDate.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
    }
    const d = new Date(reportEndDate);
    return isNaN(d.getTime()) ? new Date(2099, 11, 31) : d;
  }, [reportEndDate]);

  // Total Supplier Report Data Calculation (Opening Balance, Period Purchases, Period Payments, Closing Balance)
  const totalSupplierReportData = useMemo(() => {
    const start = safeStart;
    const end = safeEnd;

    let filteredSups = suppliers;
    if (reportSearchQuery.trim()) {
      const q = reportSearchQuery.toLowerCase().trim();
      filteredSups = suppliers.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.contactPerson || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q)
      );
    }

    let totalOB = 0;
    let totalPurchases = 0;
    let totalPayments = 0;
    let totalClosing = 0;

    const rows = filteredSups.map(supplier => {
      const baseOB = Number(supplier.openingBalance) || 0;

      let prePurchases = 0;
      let pPurchases = 0;

      purchaseOrders.forEach(po => {
        const poNum = po.poNumber || '';
        const isDyeing = (po.purchaseType as string) === 'Dyeing' || poNum.toUpperCase().includes('DYE');
        if (po.supplierId === supplier.id && po.status !== 'deleted' && po.status !== 'pending_delete' && !isDyeing) {
          const poDate = toSafeDate(po.date);
          const amt = Number(po.totalAmount) || (po.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
          if (poDate < start) {
            prePurchases += amt;
          } else if (poDate >= start && poDate <= end) {
            pPurchases += amt;
          }
        }
      });

      let prePayments = 0;
      let pPayments = 0;

      supplierPayments.forEach(pm => {
        if (pm.supplierId === supplier.id) {
          const pmDate = toSafeDate(pm.paymentDate);
          const amt = Number(pm.amount) || 0;
          if (pmDate < start) {
            prePayments += amt;
          } else if (pmDate >= start && pmDate <= end) {
            pPayments += amt;
          }
        }
      });

      // Opening Payable Balance before start date
      const openingBalance = baseOB + prePurchases - prePayments;
      // Closing Payable Balance as of end date
      const closingBalance = openingBalance + pPurchases - pPayments;

      totalOB += openingBalance;
      totalPurchases += pPurchases;
      totalPayments += pPayments;
      totalClosing += closingBalance;

      return {
        supplier,
        openingBalance,
        periodPurchases: pPurchases,
        periodPayments: pPayments,
        closingBalance
      };
    });

    return {
      rows,
      totalOB,
      totalPurchases,
      totalPayments,
      totalClosing
    };
  }, [suppliers, purchaseOrders, supplierPayments, safeStart, safeEnd, reportSearchQuery]);

  // Export Total Supplier Report to CSV
  const handleExportTotalSupplierReportCSV = () => {
    if (totalSupplierReportData.rows.length === 0) {
      showToast('No supplier report data available to export', 'error');
      return;
    }

    const csvData = totalSupplierReportData.rows.map((row, idx) => ({
      'SL': idx + 1,
      'Supplier Name': row.supplier.name,
      'Contact Person': row.supplier.contactPerson || '',
      'Phone': row.supplier.phone || '',
      'Opening Payable (Tk)': row.openingBalance,
      'Purchases in Period (Tk)': row.periodPurchases,
      'Payments in Period (Tk)': row.periodPayments,
      'Closing Payable (Tk)': row.closingBalance
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `total_supplier_report_${reportStartDate}_to_${reportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Total supplier report exported to CSV');
  };

  const handlePrintSupplierReport = () => {
    printElement('printable-supplier-ledger', { title: 'Supplier_Report' });
  };

  // Filtered payments for Payment tab
  const filteredPayments = useMemo(() => {
    if (!paymentSearchQuery.trim()) return supplierPayments;
    const q = paymentSearchQuery.toLowerCase();
    return supplierPayments.filter(p =>
      (p.supplierName || '').toLowerCase().includes(q) ||
      (p.paymentMethod || '').toLowerCase().includes(q) ||
      (p.reference || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q)
    );
  }, [supplierPayments, paymentSearchQuery]);

  // Delete payment record (Super Admin check)
  const handleDeletePayment = async (paymentId: string) => {
    if (!isSuperAdmin) {
      showToast('Only Super Admin can delete payment entries.', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this payment record?')) return;
    try {
      await deleteDoc(doc(db, 'supplierPayments', paymentId));
      showToast('Payment record deleted successfully!');
      if (syncAllData) await syncAllData(true);
      if (fetchFullHistory) await fetchFullHistory(true);
    } catch (err: any) {
      console.error('Failed to delete payment:', err);
      showToast(err.message || 'Failed to delete payment', 'error');
    }
  };

  // Generate strictly unique PO Number formatted as PO-000001
  const generatePONumber = (customList?: PurchaseOrder[]): string => {
    const list = customList || purchaseOrders || [];
    let maxSeq = 0;

    // Scan all existing POs to find the highest number in PO-000001 or numeric format
    list.forEach(po => {
      if (!po.poNumber) return;
      const cleanNum = po.poNumber.trim().toUpperCase();

      // Check standard format PO-000001 or any PO-(\d+)
      const directMatch = cleanNum.match(/^PO-0*(\d+)$/i);
      if (directMatch && directMatch[1]) {
        const val = parseInt(directMatch[1], 10);
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val;
        }
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `PO-${String(nextSeq).padStart(6, '0')}`;

    // Guarantee no duplicate with ANY existing PO number in the system (case-insensitive)
    const existingSet = new Set(list.map(p => (p.poNumber || '').trim().toUpperCase()));
    while (existingSet.has(candidate.toUpperCase())) {
      nextSeq++;
      candidate = `PO-${String(nextSeq).padStart(6, '0')}`;
    }

    return candidate;
  };

  // Generate Auto Party Code
  const generateAutoPartyCode = (category: string) => {
    let prefix = 'SUP';
    if (category === 'Customer') prefix = 'CUST';
    else if (category === 'Vendor') prefix = 'VND';
    else if (category === 'Dyeing Factory') prefix = 'DYE';
    else if (category === 'Subcontractor') prefix = 'SUBC';

    const count = suppliers.length + 1;
    return `${prefix}${String(count).padStart(4, '0')}`;
  };

  const handleCategoryChange = (newCat: string) => {
    setPartyCategory(newCat);
    if (!editingSupplier) {
      setPartyCode(generateAutoPartyCode(newCat));
    }
  };

  // Open Add Supplier Modal
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    const defaultCat = 'Supplier';
    setPartyCategory(defaultCat);
    setPartyType('Manufacturer');
    setSupplierName('');
    setPartyCode(generateAutoPartyCode(defaultCat));
    setAddressType('Main Address');
    setAddressLine1('');
    setAddressLine2('');
    setAddressLine3('');
    setCity('');
    setPin('');
    setState('Dhaka');
    setCountry('Bangladesh');
    setContactPurpose('EmailAndSms');
    setContactType('CustomerHead');
    setContactPerson('');
    setDesignation('');
    setPhone('');
    setMobile('');
    setFax('');
    setEmail('');
    setEmail2('');
    setLocation('');
    setAddress('');
    setOpeningBalance(0);
    setIsSupplierModalOpen(true);
  };

  // Open Edit Supplier Modal
  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setPartyCategory(supplier.partyCategory || 'Supplier');
    setPartyType(supplier.partyType || 'Manufacturer');
    setSupplierName(supplier.name || '');
    setPartyCode(supplier.partyCode || '');
    setAddressType(supplier.addressType || 'Main Address');
    setAddressLine1(supplier.addressLine1 || '');
    setAddressLine2(supplier.addressLine2 || '');
    setAddressLine3(supplier.addressLine3 || '');
    setCity(supplier.city || '');
    setPin(supplier.pin || '');
    setState(supplier.state || 'Dhaka');
    setCountry(supplier.country || 'Bangladesh');
    setContactPurpose(supplier.contactPurpose || 'EmailAndSms');
    setContactType(supplier.contactType || 'CustomerHead');
    setContactPerson(supplier.contactPerson || '');
    setDesignation(supplier.designation || '');
    setPhone(supplier.phone || '');
    setMobile(supplier.mobile || '');
    setFax(supplier.fax || '');
    setEmail(supplier.email || '');
    setEmail2(supplier.email2 || '');
    setLocation(supplier.location || '');
    setAddress(supplier.address || '');
    setOpeningBalance(supplier.openingBalance || 0);
    setIsSupplierModalOpen(true);
  };

  // Save Supplier / Party
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      showToast('Please enter Party Name', 'error');
      return;
    }

    const fullAddr = [addressLine1, addressLine2, addressLine3, city, state, country, pin]
      .filter(Boolean)
      .join(', ') || address.trim();

    const supplierPayload = {
      name: supplierName.trim(),
      partyCategory,
      partyType,
      partyCode: partyCode.trim(),
      addressType,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      addressLine3: addressLine3.trim(),
      city: city.trim(),
      pin: pin.trim(),
      state: state.trim(),
      country: country.trim(),
      contactPurpose,
      contactType,
      contactPerson: contactPerson.trim(),
      designation: designation.trim(),
      phone: phone.trim(),
      mobile: mobile.trim(),
      fax: fax.trim(),
      email: email.trim(),
      email2: email2.trim(),
      location: location.trim(),
      address: fullAddr,
      openingBalance: Number(openingBalance) || 0,
    };

    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), supplierPayload);
        showToast('Party details updated successfully');
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...supplierPayload,
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        showToast('Party created successfully');
      }
      setIsSupplierModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save party details:', err);
      showToast(err.message || 'Failed to save party details', 'error');
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async (supplierId: string) => {
    const isApprover = userProfile.email === 'rajonpaul300@gmail.com';
    if (!isApprover) {
      if (!confirm('Request supplier deletion? Approval request will be sent to rajonpaul300@gmail.com.')) return;
      try {
        await updateDoc(doc(db, 'suppliers', supplierId), { status: 'pending_delete' });
        showToast('Deletion request submitted to rajonpaul300@gmail.com for approval.');
      } catch (err: any) {
        showToast('Failed to request supplier deletion', 'error');
      }
      return;
    }

    if (!confirm('Are you sure you want to delete this supplier? History will remain in transactions.')) return;
    try {
      await deleteDoc(doc(db, 'suppliers', supplierId));
      showToast('Supplier deleted');
    } catch (err: any) {
      showToast('Failed to delete supplier', 'error');
    }
  };

  // Open Purchase Order Modal (New)
  const handleOpenPurchaseModal = (supplierId?: string) => {
    setEditingPO(null);
    setPoSupplierId(supplierId || (suppliers[0]?.id || ''));
    setPoNumber(generatePONumber());
    setPoDate(format(new Date(), 'yyyy-MM-dd'));
    setPurchaseType('Local');
    setPoNotes('');
    setPoVatPercent(0);
    setPoAitPercent(0);
    setPoDiscount(0);
    setPoTermsConditions(
      '1. All materials must be supplied as per approved specification.\n' +
      '2. Quality and quantity must be strictly maintained.\n' +
      '3. Mention Purchase Order number on invoice and delivery challan.\n' +
      '4. Rejected / under quality materials will be replaced by supplier.\n' +
      '5. Payment will be made as per company policy after inspection & bill submission.'
    );
    setPoItems([
      { itemId: items[0]?.id || '', itemName: items[0]?.name || '', sku: items[0]?.sku || '', unit: items[0]?.unit || 'Pcs', quantity: 1, price: items[0]?.avgCost || 0, total: items[0]?.avgCost || 0 }
    ]);
    setIsPurchaseModalOpen(true);
  };

  // Open Dyeing Purchase Order Modal with Preset (Dyeing Order in KG & Price)
  const handleOpenDyeingPurchaseModal = () => {
    setEditingPO(null);
    let dyeingSup = suppliers.find(s => (s.name || '').toLowerCase().includes('dyeing') || (s.name || '').toLowerCase().includes('factory') || (s.name || '').toLowerCase().includes('mills'));
    if (!dyeingSup && suppliers.length > 0) dyeingSup = suppliers[0];

    const genNum = `PO-DYE-${format(new Date(), 'yyyyMMdd')}-${Math.floor(100 + Math.random() * 900)}`;
    setPoSupplierId(dyeingSup?.id || '');
    setPoNumber(genNum);
    setPoDate(format(new Date(), 'yyyy-MM-dd'));
    setPurchaseType('Local');
    setPoNotes('Yarn/Fabric Dyeing Order - 500 Kg @ 85 Tk/Kg');

    const kgItem = items.find(i => (i.unit || '').toLowerCase() === 'kg' || (i.name || '').toLowerCase().includes('dyeing') || (i.name || '').toLowerCase().includes('yarn') || (i.name || '').toLowerCase().includes('fabric'));

    setPoItems([
      {
        itemId: kgItem?.id || items[0]?.id || '',
        itemName: kgItem?.name || items[0]?.name || 'Cotton Fabric / Yarn Dyeing Service',
        sku: kgItem?.sku || 'DYE-500',
        unit: 'Kg',
        quantity: 500,
        price: 85,
        total: 42500
      }
    ]);
    setIsPurchaseModalOpen(true);
  };

  // Load Dyeing Preset into current PO modal
  const handleLoadDyeingPreset = () => {
    let dyeingSup = suppliers.find(s => (s.name || '').toLowerCase().includes('dyeing') || (s.name || '').toLowerCase().includes('factory') || (s.name || '').toLowerCase().includes('mills'));
    if (dyeingSup) {
      setPoSupplierId(dyeingSup.id);
    }
    setPoNumber(`PO-DYE-${format(new Date(), 'yyyyMMdd')}-${Math.floor(100 + Math.random() * 900)}`);
    setPoDate(format(new Date(), 'yyyy-MM-dd'));
    setPurchaseType('Local');
    setPoNotes('Fabric/Yarn Dyeing Process - 500 Kg @ 85 Tk/Kg');

    const kgItem = items.find(i => (i.unit || '').toLowerCase() === 'kg' || (i.name || '').toLowerCase().includes('dyeing') || (i.name || '').toLowerCase().includes('yarn') || (i.name || '').toLowerCase().includes('fabric'));

    setPoItems([
      {
        itemId: kgItem?.id || items[0]?.id || '',
        itemName: kgItem?.name || items[0]?.name || 'Cotton Fabric Dyeing Service',
        sku: kgItem?.sku || 'DYE-500',
        unit: 'Kg',
        quantity: 500,
        price: 85,
        total: 42500
      }
    ]);
    showToast('Dyeing order template loaded (500 Kg @ 85 Tk/Kg)');
  };

  // Open Purchase Order Modal (Edit)
  const handleEditPurchaseOrder = (po: PurchaseOrder) => {
    setEditingPO(po);
    setPoSupplierId(po.supplierId);
    setPoNumber(po.poNumber);
    setPoDate(format(toSafeDate(po.date), 'yyyy-MM-dd'));
    setPurchaseType(po.purchaseType || 'Local');
    setPoNotes(po.notes || '');
    setPoVatPercent(po.vatPercent !== undefined ? po.vatPercent : 0);
    setPoAitPercent(po.aitPercent !== undefined ? po.aitPercent : 0);
    setPoDiscount(po.discount || 0);
    setPoTermsConditions(po.termsConditions || '');
    setPoItems(po.items.map(item => ({ ...item })));
    setIsPurchaseModalOpen(true);
  };

  // Delete Purchase Order (Reverts inventory stock and decreases supplier balance)
  const handleDeletePurchaseOrder = async (po: PurchaseOrder) => {
    const isApprover = userProfile.email === 'rajonpaul300@gmail.com';

    if (!isApprover) {
      if (!confirm(`Request deletion for Purchase Order ${po.poNumber}? Approval request will be sent to rajonpaul300@gmail.com.`)) return;
      try {
        await updateDoc(doc(db, 'purchaseOrders', po.id), { status: 'pending_delete' });

        // Mark associated transactions as pending_delete
        const txsQuery = query(
          collection(db, 'transactions'),
          where('businessId', '==', userProfile.businessId),
          where('poId', '==', po.id)
        );
        const txSnap = await getDocs(txsQuery);
        for (const txDoc of txSnap.docs) {
          await updateDoc(doc(db, 'transactions', txDoc.id), { status: 'pending_delete' });
        }

        if (fetchFullHistory) await fetchFullHistory(true);
        if (syncAllData) await syncAllData(true);

        showToast('Deletion request submitted to rajonpaul300@gmail.com for approval. PO remains in stock and ledger until approved.');
      } catch (err: any) {
        showToast('Failed to request PO deletion', 'error');
      }
      return;
    }

    if (!confirm(`Are you sure you want to delete Purchase Order ${po.poNumber}? This will revert inventory stock and decrease supplier purchase balance.`)) return;

    try {
      // 1. Delete PO Document
      await deleteDoc(doc(db, 'purchaseOrders', po.id));

      // 2. Delete associated transactions
      const txsQuery = query(
        collection(db, 'transactions'),
        where('businessId', '==', userProfile.businessId),
        where('poId', '==', po.id)
      );
      const txSnap = await getDocs(txsQuery);
      for (const txDoc of txSnap.docs) {
        await deleteDoc(doc(db, 'transactions', txDoc.id));
      }

      // 3. Recalculate stock for every item that was in this PO
      for (const item of po.items) {
        await recalculateItemStock(item.itemId, userProfile.businessId);
      }

      if (fetchFullHistory) await fetchFullHistory(true);
      if (syncAllData) await syncAllData(true);

      showToast(`Purchase Order ${po.poNumber} deleted! Inventory stock & supplier balance updated.`);
    } catch (err: any) {
      console.error('Failed to delete PO:', err);
      showToast('Failed to delete purchase order', 'error');
    }
  };

  // Item Change in Purchase Row
  const handlePOItemChange = (index: number, itemId: string) => {
    const item = items.find(i => i.id === itemId);
    setPoItems(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const qty = row.quantity || 1;
      const price = item?.avgCost || row.price || 0;
      return {
        ...row,
        itemId,
        itemName: item?.name || '',
        sku: item?.sku || '',
        unit: item?.unit || 'Pcs',
        price,
        total: qty * price
      };
    }));
  };

  // Qty/Price/Unit Change in Purchase Row
  const handlePORowFieldChange = (index: number, field: 'quantity' | 'price' | 'unit' | 'specification', val: any) => {
    setPoItems(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: val };
      if (field === 'quantity' || field === 'price') {
        const qty = Number(field === 'quantity' ? val : updated.quantity) || 0;
        const pr = Number(field === 'price' ? val : updated.price) || 0;
        updated.total = qty * pr;
      }
      return updated;
    }));
  };

  // Add Row
  const handleAddPORow = () => {
    setPoItems(prev => [
      ...prev,
      { itemId: items[0]?.id || '', itemName: items[0]?.name || '', sku: items[0]?.sku || '', unit: items[0]?.unit || 'Pcs', quantity: 1, price: 0, total: 0 }
    ]);
  };

  // Remove Row
  const handleRemovePORow = (index: number) => {
    if (poItems.length === 1) return;
    setPoItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate PO Total
  const poSubtotal = useMemo(() => {
    return poItems.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
  }, [poItems]);

  const poVatAmount = useMemo(() => {
    return (poSubtotal * (Number(poVatPercent) || 0)) / 100;
  }, [poSubtotal, poVatPercent]);

  const poAitAmount = useMemo(() => {
    return (poSubtotal * (Number(poAitPercent) || 0)) / 100;
  }, [poSubtotal, poAitPercent]);

  const poTotalAmount = useMemo(() => {
    return poSubtotal + poVatAmount + poAitAmount - (Number(poDiscount) || 0);
  }, [poSubtotal, poVatAmount, poAitAmount, poDiscount]);

  useEffect(() => {
    if (isPurchaseModalOpen && userProfile?.businessId) {
      checkPageApprovalRule('purchases', userProfile.businessId, userProfile, poTotalAmount)
        .then(res => setPoApprovalRequired(res.required))
        .catch(console.warn);
    }
  }, [isPurchaseModalOpen, userProfile?.businessId, poTotalAmount]);

  useEffect(() => {
    if (isPaymentModalOpen && userProfile?.businessId) {
      checkPageApprovalRule('supplier-payment', userProfile.businessId, userProfile, Number(payAmount) || 0)
        .then(res => setPaymentApprovalRequired(res.required))
        .catch(console.warn);
    }
  }, [isPaymentModalOpen, userProfile?.businessId, payAmount]);

  // Save Purchase Order (Create or Edit)
  const handleSavePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) {
      showToast('Please select a supplier', 'error');
      return;
    }
    const supplier = suppliers.find(s => s.id === poSupplierId);
    if (!supplier) {
      showToast('Supplier not found', 'error');
      return;
    }

    const validItems = poItems.filter(r => r.itemId && r.quantity > 0);
    if (validItems.length === 0) {
      showToast('Please add at least one valid item to the purchase order', 'error');
      return;
    }

    // Strict Duplicate PO Number Validation
    const finalPONum = (poNumber.trim() || generatePONumber());
    const isDup = purchaseOrders.some(p => 
      p.id !== editingPO?.id && 
      p.status !== 'deleted' && 
      (p.poNumber || '').trim().toUpperCase() === finalPONum.toUpperCase()
    );

    if (isDup) {
      showToast(`Purchase Order "${finalPONum}" already exists! Duplicate PO number is strictly prohibited.`, 'error');
      if (!editingPO) {
        setPoNumber(generatePONumber());
      }
      return;
    }

    // Direct Firestore query to eliminate cross-session collisions
    try {
      const qDup = query(
        collection(db, 'purchaseOrders'),
        where('businessId', '==', userProfile.businessId),
        where('poNumber', '==', finalPONum)
      );
      const dupSnap = await getDocs(qDup);
      const collision = dupSnap.docs.find(d => d.id !== editingPO?.id && d.data().status !== 'deleted');
      if (collision) {
        showToast(`Purchase Order "${finalPONum}" already exists in the database! Duplicate PO number is strictly prohibited.`, 'error');
        if (!editingPO) {
          setPoNumber(generatePONumber());
        }
        return;
      }
    } catch (dbErr) {
      console.warn('Firestore duplicate PO check warning:', dbErr);
    }

    try {
      const pDate = new Date(poDate);
      const timestamp = Timestamp.fromDate(pDate);

      if (editingPO) {
        // --- EDIT PURCHASE ORDER ---
        await updateDoc(doc(db, 'purchaseOrders', editingPO.id), {
          poNumber: finalPONum,
          date: timestamp,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierAddress: supplier.address || [supplier.addressLine1, supplier.city, supplier.country].filter(Boolean).join(', ') || '',
          supplierContact: supplier.contactPerson || '',
          supplierPhone: supplier.phone || supplier.mobile || '',
          supplierEmail: supplier.email || '',
          purchaseType,
          notes: poNotes.trim(),
          items: validItems,
          subtotal: poSubtotal,
          vatPercent: Number(poVatPercent) || 0,
          vatAmount: poVatAmount,
          aitPercent: Number(poAitPercent) || 0,
          aitAmount: poAitAmount,
          discount: Number(poDiscount) || 0,
          termsConditions: poTermsConditions.trim(),
          totalAmount: poTotalAmount,
          status: 'active'
        });

        // Delete old transactions for this PO
        const txsQuery = query(
          collection(db, 'transactions'),
          where('businessId', '==', userProfile.businessId),
          where('poId', '==', editingPO.id)
        );
        const txSnap = await getDocs(txsQuery);
        for (const txDoc of txSnap.docs) {
          await deleteDoc(doc(db, 'transactions', txDoc.id));
        }

        // Add updated IN transactions
        const txPromises = validItems.map(row => {
          return addDoc(collection(db, 'transactions'), {
            itemId: row.itemId,
            type: 'IN',
            quantity: Number(row.quantity),
            price: Number(row.price),
            date: timestamp,
            reference: finalPONum,
            purchaseType: purchaseType,
            notes: `Purchase Order from ${supplier.name}. ${poNotes.trim()}`.trim(),
            supplierId: supplier.id,
            supplierName: supplier.name,
            poNumber: finalPONum,
            poId: editingPO.id,
            ownerId: userProfile.uid,
            businessId: userProfile.businessId,
            status: 'active'
          });
        });
        await Promise.all(txPromises);

        // Recalculate stock for all affected items (both old and new)
        const affectedItemIds = new Set([
          ...editingPO.items.map(i => i.itemId),
          ...validItems.map(i => i.itemId)
        ]);

        for (const itemId of affectedItemIds) {
          await recalculateItemStock(itemId, userProfile.businessId);
        }

        if (fetchFullHistory) await fetchFullHistory(true);
        if (syncAllData) await syncAllData(true);

        showToast(`Purchase Order ${finalPONum} updated successfully! Stock & ledger recalculated.`);
        setIsPurchaseModalOpen(false);
        setEditingPO(null);
      } else {
        // --- CREATE NEW PURCHASE ORDER ---
        const checkResult = await checkPageApprovalRule('purchases', userProfile.businessId, userProfile, poTotalAmount);
        const poStatus = (checkResult.required || !!selectedApproverPO) ? 'pending_approval' : 'active';

        const poDocData: Record<string, any> = {
          poNumber: finalPONum,
          date: timestamp,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierAddress: supplier.address || [supplier.addressLine1, supplier.city, supplier.country].filter(Boolean).join(', ') || '',
          supplierContact: supplier.contactPerson || '',
          supplierPhone: supplier.phone || supplier.mobile || '',
          supplierEmail: supplier.email || '',
          purchaseType,
          notes: poNotes.trim(),
          items: validItems,
          subtotal: poSubtotal,
          vatPercent: Number(poVatPercent) || 0,
          vatAmount: poVatAmount,
          aitPercent: Number(poAitPercent) || 0,
          aitAmount: poAitAmount,
          discount: Number(poDiscount) || 0,
          termsConditions: poTermsConditions.trim(),
          totalAmount: poTotalAmount,
          preparedBy: userProfile.displayName || userProfile.email || 'Admin',
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          status: poStatus,
          createdAt: Timestamp.now()
        };

        if (selectedApproverPO) {
          poDocData.assignedApproverUid = selectedApproverPO.uid;
          poDocData.assignedApproverEmail = selectedApproverPO.email;
          poDocData.assignedApproverName = selectedApproverPO.displayName;
        }

        const poRef = await addDoc(collection(db, 'purchaseOrders'), poDocData);

        // Create individual IN Transactions for each item
        const txPromises = validItems.map(row => {
          return addDoc(collection(db, 'transactions'), {
            itemId: row.itemId,
            type: 'IN',
            quantity: Number(row.quantity),
            price: Number(row.price),
            date: timestamp,
            reference: finalPONum,
            purchaseType: purchaseType,
            notes: `Purchase Order from ${supplier.name}. ${poNotes.trim()}`.trim(),
            supplierId: supplier.id,
            supplierName: supplier.name,
            poNumber: finalPONum,
            poId: poRef.id,
            ownerId: userProfile.uid,
            businessId: userProfile.businessId,
            status: poStatus,
            ...(selectedApproverPO ? {
              assignedApproverUid: selectedApproverPO.uid,
              assignedApproverEmail: selectedApproverPO.email,
              assignedApproverName: selectedApproverPO.displayName
            } : {})
          });
        });

        await Promise.all(txPromises);

        if (checkResult.required || selectedApproverPO) {
          await submitDocumentForApproval(
            userProfile.businessId,
            'purchases',
            'Purchase Orders',
            'Create Purchase Order',
            'purchaseOrders',
            poRef.id,
            `Purchase Order ${finalPONum} from ${supplier.name}`,
            userProfile,
            checkResult,
            poTotalAmount,
            'BDT',
            selectedApproverPO
          );
          const targetApprover = selectedApproverPO?.displayName || checkResult.approverName || 'Designated Approver';
          showToast(`Purchase Order ${finalPONum} submitted! Sent to ${targetApprover} for approval. Notification sent.`, 'success');
        } else {
          // Recalculate stock for modified items
          for (const item of validItems) {
            await recalculateItemStock(item.itemId, userProfile.businessId);
          }
          if (fetchFullHistory) await fetchFullHistory(true);
          if (syncAllData) await syncAllData(true);
          showToast(`Purchase Order ${finalPONum} saved successfully! Inventory stock & supplier balance updated.`);
        }

        setIsPurchaseModalOpen(false);

        // Automatically offer print
        setSelectedPOForPrint({
          id: poRef.id,
          poNumber: finalPONum,
          date: timestamp,
          supplierId: supplier.id,
          supplierName: supplier.name,
          purchaseType,
          notes: poNotes.trim(),
          items: validItems,
          totalAmount: poTotalAmount,
          businessId: userProfile.businessId,
          ownerId: userProfile.uid
        });
      }
    } catch (err: any) {
      console.error('Failed to save purchase order:', err);
      showToast(err.message || 'Failed to save purchase order', 'error');
    }
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (supplierId?: string) => {
    if (!canAccessPayment || !canCreatePayment) {
      showToast('You do not have permission to record supplier payments', 'error');
      return;
    }
    const selectedId = supplierId || suppliers[0]?.id || '';
    setPaySupplierId(selectedId);
    setPayAmount(0);
    setPayDate(format(new Date(), 'yyyy-MM-dd'));
    setPayMethod('Cash');
    setPayReference('');
    setPayNotes('');
    setPayAllocations({});
    setIsPaymentModalOpen(true);
  };

  // Save Supplier Payment
  const handleSavePayment = async (e?: React.FormEvent, shouldPrint: boolean = true) => {
    if (e) e.preventDefault();
    if (!canAccessPayment || !canCreatePayment) {
      showToast('You do not have permission to record supplier payments', 'error');
      return;
    }
    if (!paySupplierId) {
      showToast('Please select a supplier', 'error');
      return;
    }
    if (payAmount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    const supplier = suppliers.find(s => s.id === paySupplierId);
    if (!supplier) {
      showToast('Supplier not found', 'error');
      return;
    }

    const finalAllocations: PaymentAllocation[] = [];
    Object.entries(payAllocations).forEach(([poId, allocAmt]) => {
      const amt = Number(allocAmt) || 0;
      if (amt > 0) {
        const poItem = openPOListForPaySupplier.find(x => x.po.id === poId);
        finalAllocations.push({
          poId,
          poNumber: poItem?.po.poNumber || poId,
          allocatedAmount: amt
        });
      }
    });

    try {
      const checkResult = await checkPageApprovalRule('supplier-payment', userProfile.businessId, userProfile, Number(payAmount));
      const paymentStatus = (checkResult.required || !!selectedApproverPayment) ? 'pending_approval' : 'active';
      const autoVoucherNo = payReference.trim() || `PV-${format(new Date(payDate), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newPaymentDocData: Record<string, any> = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        amount: Number(payAmount),
        paymentDate: Timestamp.fromDate(new Date(payDate)),
        paymentMethod: payMethod,
        reference: payReference.trim() || autoVoucherNo,
        notes: payNotes.trim(),
        allocations: finalAllocations,
        businessId: userProfile.businessId,
        ownerId: userProfile.uid,
        status: paymentStatus,
        createdAt: Timestamp.now()
      };

      if (selectedApproverPayment) {
        newPaymentDocData.assignedApproverUid = selectedApproverPayment.uid;
        newPaymentDocData.assignedApproverEmail = selectedApproverPayment.email;
        newPaymentDocData.assignedApproverName = selectedApproverPayment.displayName;
      }

      const paymentDocRef = await addDoc(collection(db, 'supplierPayments'), newPaymentDocData);

      const savedPaymentRecord: SupplierPayment = {
        id: paymentDocRef.id,
        ...newPaymentDocData
      } as SupplierPayment;

      if (checkResult.required || selectedApproverPayment) {
        await submitDocumentForApproval(
          userProfile.businessId,
          'supplier-payment',
          'Supplier Payment',
          'Post Payment',
          'supplierPayments',
          paymentDocRef.id,
          `Payment of Tk ${Number(payAmount).toLocaleString()} to ${supplier.name}${payReference ? ` (Ref: ${payReference})` : ''}`,
          userProfile,
          checkResult,
          Number(payAmount),
          'BDT',
          selectedApproverPayment
        );
        const targetApprover = selectedApproverPayment?.displayName || checkResult.approverName || 'Designated Approver';
        showToast(`Payment submitted! Sent to ${targetApprover} for approval. Notification sent.`, 'success');
      } else {
        showToast(`Payment of Tk ${Number(payAmount).toLocaleString()} recorded for ${supplier.name}`, 'success');
      }

      setIsPaymentModalOpen(false);

      if (shouldPrint) {
        setSelectedPaymentForPrint(savedPaymentRecord);
      }
    } catch (err: any) {
      console.error('Failed to save supplier payment:', err);
      showToast(err.message || 'Failed to save payment', 'error');
    }
  };

  // Filtered Suppliers List
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suppliers;

    const tokens = q.split(/\s+/).filter(Boolean);
    return suppliers.filter(s => {
      const searchableText = [
        s.name,
        s.phone,
        s.contactPerson,
        s.email,
        s.address
      ].filter(Boolean).join(' ').toLowerCase();

      return tokens.every(token => searchableText.includes(token));
    });
  }, [suppliers, searchQuery]);

  // Selected Supplier for Ledger
  const ledgerSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId) || suppliers[0] || null;
  }, [suppliers, selectedSupplierId]);

  // Safe Date Helpers for Supplier Ledger
  const safeLedgerStart = useMemo(() => {
    if (!ledgerStartDate) return null;
    const parts = ledgerStartDate.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
    }
    const d = new Date(ledgerStartDate);
    return isNaN(d.getTime()) ? null : d;
  }, [ledgerStartDate]);

  const safeLedgerEnd = useMemo(() => {
    if (!ledgerEndDate) return null;
    const parts = ledgerEndDate.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
    }
    const d = new Date(ledgerEndDate);
    return isNaN(d.getTime()) ? null : d;
  }, [ledgerEndDate]);

  // Ledger Entries and Period Calculations for selected supplier
  const ledgerData = useMemo(() => {
    if (!ledgerSupplier) {
      return {
        entries: [],
        periodOB: 0,
        periodPurchases: 0,
        periodPayments: 0,
        periodClosing: 0
      };
    }

    const start = safeLedgerStart;
    const end = safeLedgerEnd;

    const baseOB = Number(ledgerSupplier.openingBalance) || 0;

    let priorPurchases = 0;
    let periodPurchases = 0;

    purchaseOrders.forEach(po => {
      const isDyeing = (po.purchaseType as string) === 'Dyeing' || (po.poNumber || '').toUpperCase().includes('DYE');
      if (po.supplierId === ledgerSupplier.id && po.status !== 'deleted' && po.status !== 'pending_delete' && !isDyeing) {
        const pDate = toSafeDate(po.date);
        const amt = Number(po.totalAmount) || (po.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        if (start && pDate < start) {
          priorPurchases += amt;
        } else if ((!start || pDate >= start) && (!end || pDate <= end)) {
          periodPurchases += amt;
        }
      }
    });

    let priorPayments = 0;
    let periodPayments = 0;

    supplierPayments.forEach(pm => {
      if (pm.supplierId === ledgerSupplier.id) {
        const pmDate = toSafeDate(pm.paymentDate);
        const amt = Number(pm.amount) || 0;
        if (start && pmDate < start) {
          priorPayments += amt;
        } else if ((!start || pmDate >= start) && (!end || pmDate <= end)) {
          periodPayments += amt;
        }
      }
    });

    // Calculate Opening Payable Balance prior to period start
    const periodOB = baseOB + priorPurchases - priorPayments;
    const periodClosing = periodOB + periodPurchases - periodPayments;

    const entries: {
      id: string;
      date: Date;
      type: 'OPENING' | 'PURCHASE' | 'PAYMENT';
      reference: string;
      description: string;
      credit: number; // Purchase (+)
      debit: number;  // Payment (-)
    }[] = [];

    // 1. Period Opening Balance Row
    if (start) {
      entries.push({
        id: 'period_opening',
        date: start,
        type: 'OPENING',
        reference: 'OB',
        description: `Period Opening Balance (as of ${format(start, 'dd MMM yyyy')})`,
        credit: periodOB > 0 ? periodOB : 0,
        debit: periodOB < 0 ? Math.abs(periodOB) : 0
      });
    } else if (baseOB !== 0) {
      entries.push({
        id: 'opening',
        date: toSafeDate(ledgerSupplier.createdAt),
        type: 'OPENING',
        reference: 'OB',
        description: 'Supplier Opening Balance',
        credit: baseOB > 0 ? baseOB : 0,
        debit: baseOB < 0 ? Math.abs(baseOB) : 0
      });
    }

    // 2. Purchases within period
    purchaseOrders
      .filter(po => {
        const isDyeing = (po.purchaseType as string) === 'Dyeing' || (po.poNumber || '').toUpperCase().includes('DYE');
        if (po.supplierId !== ledgerSupplier.id || po.status === 'deleted' || po.status === 'pending_delete' || isDyeing) return false;
        const pDate = toSafeDate(po.date);
        if (start && pDate < start) return false;
        if (end && pDate > end) return false;
        return true;
      })
      .forEach(po => {
        const itemNames = (po.items || []).map(i => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ');
        entries.push({
          id: po.id,
          date: toSafeDate(po.date),
          type: 'PURCHASE',
          reference: po.poNumber || 'PO',
          description: `Items: ${itemNames} ${po.notes ? `| ${po.notes}` : ''}`,
          credit: Number(po.totalAmount) || 0,
          debit: 0
        });
      });

    // 3. Payments within period
    supplierPayments
      .filter(pm => {
        if (pm.supplierId !== ledgerSupplier.id) return false;
        const pmDate = toSafeDate(pm.paymentDate);
        if (start && pmDate < start) return false;
        if (end && pmDate > end) return false;
        return true;
      })
      .forEach(pm => {
        let allocDesc = '';
        if (pm.allocations && pm.allocations.length > 0) {
          const details = pm.allocations.map(a => `${a.poNumber} (Tk ${a.allocatedAmount.toLocaleString()})`).join(', ');
          allocDesc = ` | Against Bills: ${details}`;
        }
        entries.push({
          id: pm.id,
          date: toSafeDate(pm.paymentDate),
          type: 'PAYMENT',
          reference: pm.reference || `PMT-${pm.id ? pm.id.slice(0, 6) : ''}`,
          description: `Payment via ${pm.paymentMethod || 'Cash'}${allocDesc}${pm.notes ? ` | ${pm.notes}` : ''}`,
          credit: 0,
          debit: Number(pm.amount) || 0
        });
      });

    // Sort chronologically
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance: Credit (+) minus Debit (-)
    let runningBalance = 0;
    const entriesWithRunning = entries.map(entry => {
      if (entry.id === 'period_opening' || entry.id === 'opening') {
        runningBalance = entry.credit - entry.debit;
      } else {
        runningBalance += entry.credit - entry.debit;
      }
      return {
        ...entry,
        runningBalance
      };
    });

    return {
      entries: entriesWithRunning,
      periodOB,
      periodPurchases,
      periodPayments,
      periodClosing
    };
  }, [ledgerSupplier, purchaseOrders, supplierPayments, safeLedgerStart, safeLedgerEnd]);

  const ledgerEntries = ledgerData.entries;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-neutral-900 tracking-tight">Suppliers & Purchase Management</h2>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Manage vendor master, record multi-item purchase orders, track payments, & print supplier ledger statements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {canCreateSupplier && canAccessSuppliers && (
              <button
                onClick={handleOpenAddSupplier}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Supplier
              </button>
            )}
            {canCreatePO && canAccessPO && (
              <button
                onClick={() => handleOpenPurchaseModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
              >
                <Package className="w-4 h-4" />
                New Multi-Item Purchase
              </button>
            )}
            {canCreatePayment && canAccessPayment && (
              <button
                onClick={() => handleOpenPaymentModal()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
              >
                <CreditCard className="w-4 h-4" />
                Pay Supplier
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-neutral-200 gap-4 sm:gap-6 text-xs font-bold pt-2 overflow-x-auto">
          {canAccessReport && (
            <button
              onClick={() => setActiveTab('report')}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'report' 
                  ? 'border-indigo-600 text-indigo-600 font-black' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Total Supplier Report
            </button>
          )}
          {canAccessSuppliers && (
            <button
              onClick={() => {
                setActiveTab('suppliers');
              }}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'suppliers' 
                  ? 'border-indigo-600 text-indigo-600 font-black' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Supplier Master ({suppliers.length})
            </button>
          )}
          {canAccessPO && (
            <button
              onClick={() => setActiveTab('purchases')}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'purchases' 
                  ? 'border-indigo-600 text-indigo-600 font-black' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Purchase Orders ({purchaseOrders.length})
            </button>
          )}
          {canAccessLedger && (
            <button
              onClick={() => setActiveTab('ledger')}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'ledger' 
                  ? 'border-indigo-600 text-indigo-600 font-black' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Supplier Ledger & Accounts
            </button>
          )}
          {canAccessPayment && (
            <button
              onClick={() => setActiveTab('payment')}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'payment' 
                  ? 'border-indigo-600 text-indigo-600 font-black' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Supplier Payment ({supplierPayments.length})
            </button>
          )}
        </div>
      </div>

      {/* --- TAB 0: TOTAL SUPPLIER REPORT --- */}
      {activeTab === 'report' && canAccessReport && (
        <div className="space-y-4">
          {/* Controls & Date Range Filter */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm space-y-3 print:hidden">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-sm text-neutral-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-600" />
                  Total Supplier Consolidated Summary Report
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Select start date (opening date) and end date to calculate Opening Balance, Total Purchases, Payments & Closing Payable Balance for all suppliers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={handleExportTotalSupplierReportCSV}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrintSupplierReport}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-100">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Start Date (Opening Date)</label>
                </div>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={e => setReportStartDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">End Date (Closing Date)</label>
                </div>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={e => setReportEndDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Search Supplier / Contact</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by supplier name or phone..."
                    value={reportSearchQuery}
                    onChange={e => setReportSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Quick Presets for Total Supplier Report */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs border-t border-neutral-100">
              <span className="text-[11px] text-neutral-400 font-medium mr-1">Quick Date Range:</span>
              <button
                type="button"
                onClick={() => setReportPresetDate('today')}
                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setReportPresetDate('month')}
                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setReportPresetDate('lastMonth')}
                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => setReportPresetDate('year')}
                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
              >
                This Year
              </button>
              <button
                type="button"
                onClick={() => setReportPresetDate('all')}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-all"
              >
                All Time / Clear
              </button>
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 print:hidden">
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Total Opening Payable</span>
              <span className="text-lg font-black text-neutral-900 mt-1 block">
                {totalSupplierReportData.totalOB.toLocaleString()} Tk
              </span>
            </div>
            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Period Purchases (+ Due)</span>
              <span className="text-lg font-black text-indigo-900 mt-1 block">
                +{totalSupplierReportData.totalPurchases.toLocaleString()} Tk
              </span>
            </div>
            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Period Payments (- Cleared)</span>
              <span className="text-lg font-black text-emerald-900 mt-1 block">
                -{totalSupplierReportData.totalPayments.toLocaleString()} Tk
              </span>
            </div>
            <div className="p-3.5 bg-red-50/60 rounded-xl border border-red-100">
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Closing Outstanding Balance</span>
              <span className="text-lg font-black text-red-950 mt-1 block">
                {totalSupplierReportData.totalClosing.toLocaleString()} Tk
              </span>
            </div>
          </div>

          {/* Printable Report Header */}
          <div className="hidden print:block text-center space-y-1 mb-4">
            <h2 className="text-xl font-black text-neutral-900">Total Supplier Consolidated Statement Report</h2>
            <p className="text-xs text-neutral-600">
              Period: {format(new Date(reportStartDate), 'dd MMM yyyy')} to {format(new Date(reportEndDate), 'dd MMM yyyy')}
            </p>
          </div>

          {/* Report Data Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="p-3.5 border-b border-neutral-100 font-bold text-xs text-neutral-800 flex items-center justify-between print:hidden">
              <span>All Suppliers Consolidated Report ({totalSupplierReportData.rows.length} Suppliers)</span>
              <span className="text-[11px] font-normal text-neutral-500">From {reportStartDate} To {reportEndDate}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-800 font-black uppercase text-[10px] border-b border-neutral-200">
                    <th className="p-2.5 border-r border-neutral-200 text-center w-10">SL</th>
                    <th className="p-2.5 border-r border-neutral-200">Supplier Name</th>
                    <th className="p-2.5 border-r border-neutral-200">Contact / Phone</th>
                    <th className="p-2.5 border-r border-neutral-200 text-right">Opening Balance (Tk)</th>
                    <th className="p-2.5 border-r border-neutral-200 text-right">Purchase (Tk)</th>
                    <th className="p-2.5 border-r border-neutral-200 text-right">Payment (Tk)</th>
                    <th className="p-2.5 border-r border-neutral-200 text-right">Closing Balance (Tk)</th>
                    {canAccessLedger && <th className="p-2.5 text-center print:hidden w-24">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {totalSupplierReportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={canAccessLedger ? 8 : 7} className="p-8 text-center text-neutral-400 font-medium italic">
                        No suppliers match the current search or date criteria.
                      </td>
                    </tr>
                  ) : (
                    totalSupplierReportData.rows.map((r, idx) => (
                      <tr key={r.supplier.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="p-2.5 border-r border-neutral-100 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="p-2.5 border-r border-neutral-100 font-bold text-neutral-900">{r.supplier.name}</td>
                        <td className="p-2.5 border-r border-neutral-100 text-neutral-600">
                          <div className="font-medium">{r.supplier.contactPerson || '-'}</div>
                          {r.supplier.phone && <div className="text-[10px] text-neutral-400 font-mono">{r.supplier.phone}</div>}
                        </td>
                        <td className="p-2.5 border-r border-neutral-100 text-right font-semibold text-neutral-800">
                          {r.openingBalance.toLocaleString()}
                        </td>
                        <td className="p-2.5 border-r border-neutral-100 text-right font-bold text-indigo-700">
                          {r.periodPurchases > 0 ? `+${r.periodPurchases.toLocaleString()}` : '0'}
                        </td>
                        <td className="p-2.5 border-r border-neutral-100 text-right font-bold text-emerald-700">
                          {r.periodPayments > 0 ? `-${r.periodPayments.toLocaleString()}` : '0'}
                        </td>
                        <td className={`p-2.5 ${canAccessLedger ? 'border-r border-neutral-100' : ''} text-right font-black ${r.closingBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {r.closingBalance.toLocaleString()} Tk
                        </td>
                        {canAccessLedger && (
                          <td className="p-2.5 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSupplierId(r.supplier.id);
                                setActiveTab('ledger');
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] flex items-center gap-1 mx-auto transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              Ledger
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-900 text-white font-black text-xs">
                    <td colSpan={3} className="p-3 text-right uppercase tracking-wider">
                      Grand Total ({totalSupplierReportData.rows.length} Suppliers):
                    </td>
                    <td className="p-3 text-right">
                      {totalSupplierReportData.totalOB.toLocaleString()} Tk
                    </td>
                    <td className="p-3 text-right text-indigo-300">
                      +{totalSupplierReportData.totalPurchases.toLocaleString()} Tk
                    </td>
                    <td className="p-3 text-right text-emerald-300">
                      -{totalSupplierReportData.totalPayments.toLocaleString()} Tk
                    </td>
                    <td className="p-3 text-right text-amber-300 font-black text-sm">
                      {totalSupplierReportData.totalClosing.toLocaleString()} Tk
                    </td>
                    {canAccessLedger && <td className="p-3 print:hidden"></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 1: SUPPLIER MASTER --- */}
      {activeTab === 'suppliers' && canAccessSuppliers && (
        <div className="space-y-4">
          <input
            type="file"
            ref={supplierFileInputRef}
            onChange={handleImportSuppliersCSV}
            accept=".csv"
            className="hidden"
          />

          {/* Party Master Quick Launch Banner */}
          <div className="bg-gradient-to-r from-indigo-900 to-neutral-900 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/80 text-white rounded-xl shadow-inner border border-indigo-400/30">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-white text-sm">Supplier & Party Master Directory</h4>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Create new supplier or search and edit existing party details directly in full popup form.
                </p>
              </div>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenAddSupplier}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                Open Party Master Popup
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search supplier name, code, phone, or contact..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {isEditor && (
                <button
                  onClick={() => supplierFileInputRef.current?.click()}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Import suppliers from CSV file"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import CSV
                </button>
              )}
              <button
                onClick={handleExportSuppliersCSV}
                className="px-3 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title="Export supplier list to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={handleDownloadSampleSupplierCSV}
                className="px-3 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
                title="Download CSV Template Sample"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Sample CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 uppercase font-black tracking-wider">
                    <th className="py-3 px-4">Supplier Details</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4 text-right">Opening Bal. (Tk)</th>
                    <th className="py-3 px-4 text-right">Purchases (Tk)</th>
                    <th className="py-3 px-4 text-right">Payments (Tk)</th>
                    <th className="py-3 px-4 text-right">Net Payable (Tk)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-neutral-400 font-medium">
                        No suppliers found. Click <span className="font-bold text-neutral-800">"Add Supplier"</span> to create your first vendor!
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(s => {
                      const stats = supplierStatsMap[s.id] || { totalPurchases: 0, totalPayments: 0, netBalance: s.openingBalance || 0 };
                      return (
                        <tr key={s.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div 
                              onClick={() => handleOpenEditSupplier(s)}
                              className="font-extrabold text-neutral-900 hover:text-indigo-600 cursor-pointer transition-colors flex items-center gap-1.5"
                              title="Click to edit party details in popup"
                            >
                              {s.name}
                              {s.partyCode && (
                                <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">
                                  {s.partyCode}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
                              {s.partyCategory && (
                                <span className="text-[10px] bg-neutral-100 px-1.5 py-0.2 rounded font-semibold text-neutral-700">
                                  {s.partyCategory}
                                </span>
                              )}
                              {s.partyType && (
                                <span className="text-[10px] bg-neutral-100 px-1.5 py-0.2 rounded font-semibold text-neutral-600">
                                  {s.partyType}
                                </span>
                              )}
                              {s.contactPerson && <span>Contact: {s.contactPerson}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 space-y-0.5">
                            {s.phone && (
                              <div className="flex items-center gap-1.5 text-neutral-700">
                                <Phone className="w-3 h-3 text-neutral-400" />
                                {s.phone}
                              </div>
                            )}
                            {s.address && (
                              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
                                <MapPin className="w-3 h-3 text-neutral-400" />
                                {s.address}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-neutral-600">
                            {(Number(s.openingBalance) || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-indigo-600">
                            {stats.totalPurchases.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            {stats.totalPayments.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`inline-block px-2.5 py-1 rounded-lg font-black ${
                              stats.netBalance > 0 
                                ? 'bg-red-50 text-red-700 border border-red-100' 
                                : stats.netBalance < 0 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-neutral-100 text-neutral-700'
                            }`}>
                              {stats.netBalance.toLocaleString()} Tk
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {canAccessLedger && (
                                <button
                                  onClick={() => {
                                    setSelectedSupplierId(s.id);
                                    setActiveTab('ledger');
                                  }}
                                  title="View Ledger"
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  Ledger
                                </button>
                              )}
                              {canCreatePO && canAccessPO && (
                                <button
                                  onClick={() => handleOpenPurchaseModal(s.id)}
                                  title="Create Multi-Item Purchase"
                                  className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 rounded-lg transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canEditSupplier && (
                                <button
                                  onClick={() => handleOpenEditSupplier(s)}
                                  title="Edit Supplier"
                                  className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-neutral-100 rounded-lg transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteSupplier && (
                                <button
                                  onClick={() => handleDeleteSupplier(s.id)}
                                  title="Delete Supplier"
                                  className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-neutral-100 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: PURCHASE ORDERS --- */}
      {activeTab === 'purchases' && canAccessPO && (
        <div className="space-y-4">
          {/* Action Bar for Purchase Orders */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm">
            <div>
              <h3 className="font-bold text-neutral-900 text-sm">Purchase Order Records</h3>
              <p className="text-xs text-neutral-500">Record and manage multi-item purchase invoices for local & bond purchases</p>
            </div>
            {canCreatePO && canAccessPO && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPurchaseModal()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Multi-Item Purchase
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 uppercase font-black tracking-wider">
                    <th className="py-3 px-4">PO # / Date</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4 text-right">Grand Total (Tk)</th>
                    <th className="py-3 px-4 text-center">Print / View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-neutral-400 font-medium">
                        No purchase orders found. Click <span className="font-bold text-neutral-800">"New Multi-Item Purchase"</span> to add one!
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders
                      .filter(po => po.status !== 'pending_delete')
                      .sort((a, b) => toSafeDate(b.date).getTime() - toSafeDate(a.date).getTime())
                      .map(po => (
                        <tr key={po.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-neutral-900">{po.poNumber}</div>
                            <div className="text-[11px] text-neutral-500">
                              {format(toSafeDate(po.date), 'yyyy-MM-dd')}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-neutral-800">
                            {po.supplierName}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold text-[10px]">
                              {po.purchaseType || 'Local'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-600 font-medium">
                            {po.items.length} item(s)
                          </td>
                          <td className="py-3 px-4 text-right font-black text-neutral-900">
                            {po.totalAmount.toLocaleString()} Tk
                          </td>
                          <td className="py-3 px-4 text-center space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedPOForPrint(po)}
                              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                              title="Print PO"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print
                            </button>
                            {canEditPO && (
                              <button
                                onClick={() => handleEditPurchaseOrder(po)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                                title="Edit Purchase Order"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            )}
                            {canDeletePO && (
                              <button
                                onClick={() => handleDeletePurchaseOrder(po)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                                title="Delete Purchase Order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: SUPPLIER LEDGER --- */}
      {activeTab === 'ledger' && canAccessLedger && (
        <div className="space-y-6">
          <input
            type="file"
            ref={ledgerFileInputRef}
            onChange={handleImportLedgerCSV}
            accept=".csv"
            className="hidden"
          />
          <input
            type="file"
            ref={replaceLedgerFileInputRef}
            onChange={handleReplaceLedgerCSV}
            accept=".csv"
            className="hidden"
          />

          {/* Supplier Selector & CSV / Print Action Bar */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <label className="text-xs font-bold text-neutral-500 uppercase shrink-0">Select Supplier:</label>
              <SearchableSupplierSelect
                suppliers={suppliers}
                selectedSupplierId={selectedSupplierId || (ledgerSupplier?.id || '')}
                onSelectSupplier={id => setSelectedSupplierId(id)}
                supplierStatsMap={supplierStatsMap}
                className="w-full md:w-72"
              />
            </div>

            {ledgerSupplier && (
              <div className="flex flex-wrap items-center gap-2 no-print w-full md:w-auto">
                {canEditSupplier && (
                  <button
                    onClick={() => {
                      if (!ledgerSupplier) {
                        showToast('Please select a supplier first', 'error');
                        return;
                      }
                      ledgerFileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    title="Upload Ledger CSV (Appends to existing entries)"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Ledger CSV
                  </button>
                )}
                {canDeleteSupplier && (
                  <button
                    onClick={() => {
                      if (!ledgerSupplier) {
                        showToast('Please select a supplier first', 'error');
                        return;
                      }
                      const confirmed = window.confirm(
                        `⚠️ Replace CSV Warning:\n\nThis will DELETE ALL previous transactions/ledger entries for "${ledgerSupplier.name}" and replace them with the new CSV file.\n\nAre you sure you want to proceed?`
                      );
                      if (confirmed) {
                        replaceLedgerFileInputRef.current?.click();
                      }
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    title="Deletes previous entries for this supplier and imports the new CSV file"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Replace CSV
                  </button>
                )}
                <button
                  onClick={handleExportLedgerCSV}
                  className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Export current ledger statement to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  onClick={handleDownloadSampleLedgerCSV}
                  className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200/80 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
                  title="Download CSV Ledger Format (Date, Details, Debit, Credit, Balance)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  CSV Template
                </button>
                <button
                  onClick={() => printElement('printable-supplier-ledger', { title: `Supplier_Statement_${ledgerSupplier?.name || 'Ledger'}` })}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Statement
                </button>
              </div>
            )}
          </div>

          {ledgerSupplier ? (
            <div id="printable-supplier-ledger" className="space-y-6 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
              {/* Printable Header */}
              <div className="border-b border-neutral-200 pb-4 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <img
                    src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                    alt="ES Trims Limited"
                    className="h-14 w-14 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                  />
                  <div>
                    <h1 className="text-xl font-black text-neutral-900 tracking-tight uppercase">ES TRIMS LIMITED</h1>
                    <p className="text-[10px] text-neutral-600 font-medium">ES Trims Limited, C-15 panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400</p>
                    <p className="text-xs text-neutral-500 font-bold uppercase mt-1">SUPPLIER ACCOUNT LEDGER STATEMENT</p>
                    <p className="text-xs text-neutral-600 mt-1 font-bold">
                      Supplier: <span className="text-neutral-900 text-sm font-black">{ledgerSupplier.name}</span>
                    </p>
                    {ledgerSupplier.phone && (
                      <p className="text-xs text-neutral-500">Phone: {ledgerSupplier.phone}</p>
                    )}
                    {ledgerSupplier.address && (
                      <p className="text-xs text-neutral-500">Address: {ledgerSupplier.address}</p>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-neutral-500 space-y-1">
                  <p className="font-bold text-neutral-900">Statement Date: {format(new Date(), 'dd MMM yyyy')}</p>
                  <p>
                    Selected Period:{' '}
                    <span className="font-bold text-neutral-800">
                      {ledgerStartDate || ledgerEndDate
                        ? `${ledgerStartDate || 'Beginning'} to ${ledgerEndDate || 'Today'}`
                        : 'All Time'}
                    </span>
                  </p>
                  <p>Opening Balance: <span className="font-bold text-neutral-800">{ledgerData.periodOB.toLocaleString()} Tk</span></p>
                </div>
              </div>

              {/* Date Filter & Quick Range Selector for Supplier Ledger */}
              <div className="bg-neutral-50 rounded-xl border border-neutral-200/80 p-3 space-y-3 no-print">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-neutral-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Ledger Date Range Filter</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] text-neutral-400 font-medium mr-1">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setLedgerPresetDate('today')}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200 rounded-lg text-[11px] font-bold transition-all"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerPresetDate('month')}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200 rounded-lg text-[11px] font-bold transition-all"
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerPresetDate('last30')}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200 rounded-lg text-[11px] font-bold transition-all"
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerPresetDate('year')}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200 rounded-lg text-[11px] font-bold transition-all"
                    >
                      This Year
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerPresetDate('all')}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition-all"
                    >
                      All Time / Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">From Date (Opening Date)</label>
                    <input
                      type="date"
                      value={ledgerStartDate}
                      onChange={e => setLedgerStartDate(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">To Date (Closing Date)</label>
                    <input
                      type="date"
                      value={ledgerEndDate}
                      onChange={e => setLedgerEndDate(e.target.value)}
                      className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Metric Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <div className="text-xs text-neutral-500 font-semibold">Period Opening Balance</div>
                  <div className="text-lg font-black text-neutral-900 mt-1">
                    {ledgerData.periodOB.toLocaleString()} Tk
                  </div>
                </div>
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <div className="text-xs text-indigo-700 font-semibold">Period Purchases (+ Credit)</div>
                  <div className="text-lg font-black text-indigo-900 mt-1">
                    {ledgerData.periodPurchases.toLocaleString()} Tk
                  </div>
                </div>
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-700 font-semibold">Period Payments (- Debit)</div>
                  <div className="text-lg font-black text-emerald-900 mt-1">
                    {ledgerData.periodPayments.toLocaleString()} Tk
                  </div>
                </div>
                <div className="p-4 bg-red-50/60 rounded-xl border border-red-100">
                  <div className="text-xs text-red-700 font-semibold">Closing Payable Balance</div>
                  <div className="text-lg font-black text-red-900 mt-1">
                    {ledgerData.periodClosing.toLocaleString()} Tk
                  </div>
                </div>
              </div>

              {/* Detailed Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-neutral-200">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 font-black uppercase text-[10px]">
                      <th className="p-2.5 border border-neutral-200">Date</th>
                      <th className="p-2.5 border border-neutral-200">Type</th>
                      <th className="p-2.5 border border-neutral-200">Reference #</th>
                      <th className="p-2.5 border border-neutral-200">Details</th>
                      <th className="p-2.5 border border-neutral-200 text-right">Debit (Payment) Tk</th>
                      <th className="p-2.5 border border-neutral-200 text-right">Credit (Purchase) Tk</th>
                      <th className="p-2.5 border border-neutral-200 text-right">Balance Tk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-neutral-400 font-medium">
                          No transaction history recorded for this supplier yet.
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map(e => (
                        <tr key={e.id} className="hover:bg-neutral-50/50">
                          <td className="p-2.5 border border-neutral-200 whitespace-nowrap font-medium text-neutral-800">
                            {format(e.date, 'yyyy-MM-dd')}
                          </td>
                          <td className="p-2.5 border border-neutral-200 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              e.type === 'PURCHASE' ? 'bg-indigo-100 text-indigo-800' :
                              e.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-800'
                            }`}>
                              {e.type}
                            </span>
                          </td>
                          <td className="p-2.5 border border-neutral-200 font-mono font-bold text-neutral-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{e.reference}</span>
                              {e.type === 'PAYMENT' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matched = supplierPayments.find(p => p.id === e.id || p.reference === e.reference) || {
                                      id: e.id,
                                      supplierId: ledgerSupplier.id,
                                      supplierName: ledgerSupplier.name,
                                      amount: e.debit,
                                      paymentDate: Timestamp.fromDate(e.date),
                                      paymentMethod: 'Cash',
                                      reference: e.reference,
                                      notes: e.description,
                                      businessId: userProfile.businessId,
                                      ownerId: userProfile.uid
                                    } as SupplierPayment;
                                    setSelectedPaymentForPrint(matched);
                                  }}
                                  className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors"
                                  title="Print Payment Voucher"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 border border-neutral-200 text-neutral-700 max-w-xs break-words">
                            {e.description}
                          </td>
                          <td className="p-2.5 border border-neutral-200 text-right font-bold text-emerald-900 whitespace-nowrap">
                            {e.debit > 0 ? e.debit.toLocaleString() : '-'}
                          </td>
                          <td className="p-2.5 border border-neutral-200 text-right font-bold text-indigo-900 whitespace-nowrap">
                            {e.credit > 0 ? e.credit.toLocaleString() : '-'}
                          </td>
                          <td className="p-2.5 border border-neutral-200 text-right font-black text-neutral-900 whitespace-nowrap">
                            {e.runningBalance.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-100 font-black text-neutral-900">
                      <td colSpan={4} className="p-3 border border-neutral-300 text-right uppercase">
                        Net Outstanding Payable Balance:
                      </td>
                      <td colSpan={3} className="p-3 border border-neutral-300 text-right text-sm text-red-700">
                        {((supplierStatsMap[ledgerSupplier.id]?.netBalance) || 0).toLocaleString()} Tk
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-200">
              Please select a supplier to view account ledger details.
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: SUPPLIER PAYMENT --- */}
      {activeTab === 'payment' && canAccessPayment && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search payment by supplier, method, or ref #..."
                value={paymentSearchQuery}
                onChange={e => setPaymentSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {canCreatePayment && canAccessPayment && (
              <button
                type="button"
                onClick={() => handleOpenPaymentModal()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Record Supplier Payment
              </button>
            )}
          </div>

          {/* Payment Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <div className="text-xs text-emerald-700 font-semibold">Total Payments Recorded</div>
              <div className="text-xl font-black text-emerald-900 mt-1">
                {supplierPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toLocaleString()} Tk
              </div>
            </div>
            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <div className="text-xs text-indigo-700 font-semibold">Total Payment Transactions</div>
              <div className="text-xl font-black text-indigo-900 mt-1">
                {supplierPayments.length} Transactions
              </div>
            </div>
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
              <div className="text-xs text-amber-700 font-semibold">Active Suppliers</div>
              <div className="text-xl font-black text-amber-900 mt-1">
                {suppliers.length} Suppliers
              </div>
            </div>
          </div>

          {/* Payments List Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-neutral-100 font-bold text-sm text-neutral-900 flex items-center justify-between">
              <span>Supplier Payment Transactions</span>
              <span className="text-xs font-normal text-neutral-500">Showing {filteredPayments.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200">
                    <th className="p-3">Date</th>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Reference / Voucher #</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3 text-right">Amount Paid (Tk)</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-400">
                        No supplier payments found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/50">
                        <td className="p-3 whitespace-nowrap font-medium text-neutral-800">
                          {format(toSafeDate(p.paymentDate), 'yyyy-MM-dd')}
                        </td>
                        <td className="p-3 font-bold text-neutral-900">
                          {p.supplierName}
                        </td>
                        <td className="p-3 font-semibold text-neutral-700">
                          <span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-bold text-neutral-700">
                            {p.paymentMethod || 'Cash'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-indigo-700 font-bold">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForPrint(p)}
                            className="hover:underline flex items-center gap-1 cursor-pointer"
                            title="Click to Print Voucher"
                          >
                            <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{p.reference || `PV-${p.id.slice(-6).toUpperCase()}`}</span>
                          </button>
                        </td>
                        <td className="p-3 text-neutral-500 max-w-xs truncate">
                          {p.notes || '-'}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700 text-sm whitespace-nowrap">
                          {Number(p.amount).toLocaleString()} Tk
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPaymentForPrint(p)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                              title="Print Payment Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Voucher</span>
                            </button>
                            {canDeletePayment && (
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(p.id)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Payment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fallback when active tab is not accessible */}
      {!availableTabs.includes(activeTab) && (
        <div className="p-12 text-center bg-white rounded-2xl border border-neutral-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-neutral-900">Access Restricted</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            You do not have permission to view this section ({activeTab}). Please contact your system administrator for access.
          </p>
        </div>
      )}

      {/* --- MODAL 1: ADD / EDIT SUPPLIER / PARTY MASTER --- */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-100 w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden border border-neutral-300 my-auto text-xs">
            {/* Header Banner */}
            <div className="bg-neutral-300/90 px-4 py-2.5 border-b border-neutral-300 flex items-center justify-between">
              <h3 className="font-extrabold text-neutral-800 text-sm tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-700" />
                {editingSupplier ? `Edit Party: ${editingSupplier.name}` : 'Add New Party Master'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsSupplierModalOpen(false)} 
                className="text-neutral-600 hover:text-neutral-900 font-bold p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-4 space-y-4">
              {/* Quick Search & Select Existing Supplier to Edit */}
              <div className="bg-indigo-50/90 border border-indigo-200 p-2.5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                  <Search className="w-4 h-4 text-indigo-600" />
                  <span>Select / Search Existing Supplier to Edit:</span>
                </div>
                <select
                  value={editingSupplier?.id || ''}
                  onChange={(e) => {
                    const found = suppliers.find(s => s.id === e.target.value);
                    if (found) {
                      handleOpenEditSupplier(found);
                    } else {
                      handleOpenAddSupplier();
                    }
                  }}
                  className="bg-white border border-indigo-300 rounded px-2.5 py-1 text-xs font-bold text-neutral-800 w-full sm:w-80 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="">-- Create New Party --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.partyCode || s.phone || 'No Code'}) - {s.partyCategory || 'Supplier'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Top Party Basics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 bg-neutral-100 p-2 rounded">
                <div className="flex items-center gap-2">
                  <label className="w-28 text-right font-semibold text-neutral-700 shrink-0">Party Category</label>
                  <select
                    value={partyCategory}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="Supplier">Supplier</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Customer">Customer</option>
                    <option value="Dyeing Factory">Dyeing Factory</option>
                    <option value="Subcontractor">Subcontractor</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-28 text-right font-semibold text-neutral-700 shrink-0">Party Type</label>
                  <select
                    value={partyType}
                    onChange={e => setPartyType(e.target.value)}
                    className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Subcontractor">Subcontractor</option>
                    <option value="Wholesaler">Wholesaler</option>
                    <option value="Trader">Trader</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Importer">Importer</option>
                    <option value="Service Provider">Service Provider</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-28 text-right font-semibold text-neutral-700 shrink-0">Party Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. improsys"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 font-extrabold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-28 text-right font-semibold text-neutral-700 shrink-0">Party Code (Auto)</label>
                  <input
                    type="text"
                    placeholder="SUP0001 / CUST0001"
                    value={partyCode}
                    onChange={e => setPartyCode(e.target.value)}
                    className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 uppercase"
                  />
                </div>
              </div>

              {/* Two Column Layout: Party Address & Party Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Box: Party Address */}
                <div className="bg-neutral-50 border border-neutral-300 rounded overflow-hidden">
                  <div className="bg-neutral-300 px-3 py-1.5 font-bold text-neutral-800 border-b border-neutral-300">
                    Party Address
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Address Type</label>
                      <select
                        value={addressType}
                        onChange={e => setAddressType(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-800 focus:outline-none"
                      >
                        <option value="Main Address">Main Address</option>
                        <option value="Billing Address">Billing Address</option>
                        <option value="Factory Address">Factory Address</option>
                        <option value="Shipping Address">Shipping Address</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Address Line 1</label>
                      <input
                        type="text"
                        placeholder="A-29, Jai Ganesh Vision,"
                        value={addressLine1}
                        onChange={e => setAddressLine1(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Address Line 2</label>
                      <input
                        type="text"
                        placeholder="A wing, Ground floor"
                        value={addressLine2}
                        onChange={e => setAddressLine2(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Address Line 3</label>
                      <input
                        type="text"
                        placeholder="Akurdi,"
                        value={addressLine3}
                        onChange={e => setAddressLine3(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">City</label>
                      <input
                        type="text"
                        placeholder="Pune"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Pin</label>
                      <input
                        type="text"
                        placeholder="431005"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">State</label>
                      <input
                        type="text"
                        placeholder="Maharashtra / Dhaka"
                        value={state}
                        onChange={e => setState(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Country</label>
                      <input
                        type="text"
                        placeholder="India / Bangladesh"
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-200">
                      <label className="w-28 text-right font-bold text-neutral-800 shrink-0">Opening Bal (Tk)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={openingBalance}
                        onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-bold text-neutral-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Box: Party Contacts */}
                <div className="bg-neutral-50 border border-neutral-300 rounded overflow-hidden">
                  <div className="bg-neutral-300 px-3 py-1.5 font-bold text-neutral-800 border-b border-neutral-300">
                    Party Contacts
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Contact Purpose</label>
                      <select
                        value={contactPurpose}
                        onChange={e => setContactPurpose(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-800 focus:outline-none"
                      >
                        <option value="EmailandSms">EmailandSms</option>
                        <option value="Accounts">Accounts</option>
                        <option value="Billing">Billing</option>
                        <option value="General">General</option>
                        <option value="Delivery">Delivery</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Contact Type</label>
                      <select
                        value={contactType}
                        onChange={e => setContactType(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-800 focus:outline-none"
                      >
                        <option value="CustomerHead">CustomerHead</option>
                        <option value="AccountsHead">AccountsHead</option>
                        <option value="SalesManager">SalesManager</option>
                        <option value="ManagingDirector">ManagingDirector</option>
                        <option value="Manager">Manager</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Person Name</label>
                      <input
                        type="text"
                        placeholder="Payal"
                        value={contactPerson}
                        onChange={e => setContactPerson(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Designation</label>
                      <input
                        type="text"
                        placeholder="Business Consultant"
                        value={designation}
                        onChange={e => setDesignation(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Phone No</label>
                      <input
                        type="text"
                        placeholder=""
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Mobile No</label>
                      <input
                        type="text"
                        placeholder="9876453212"
                        value={mobile}
                        onChange={e => setMobile(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Fax No</label>
                      <input
                        type="text"
                        placeholder=""
                        value={fax}
                        onChange={e => setFax(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Email ID 1</label>
                      <input
                        type="email"
                        placeholder="payalbharote@gmail.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Email ID 2</label>
                      <input
                        type="email"
                        placeholder=""
                        value={email2}
                        onChange={e => setEmail2(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-28 text-right font-medium text-neutral-600 shrink-0">Location</label>
                      <input
                        type="text"
                        placeholder="Pune"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Centered Save Button */}
              <div className="pt-2 text-center">
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded shadow transition-all inline-flex items-center gap-2"
                >
                  Save Party Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: MULTI-ITEM PURCHASE ORDER --- */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-5 border border-neutral-200 my-8">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-xl text-neutral-900">
                  {editingPO ? 'Edit Purchase Order' : 'New Multi-Item Purchase Order'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {editingPO ? 'Modify items, quantities, and rates for this purchase order.' : 'Select supplier and add multiple items in a single purchase invoice.'}
                </p>
              </div>
              <button onClick={() => setIsPurchaseModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchaseOrder} className="space-y-4 text-xs">

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200/80">
                <div className="sm:col-span-2">
                  <label className="font-bold text-neutral-700 block mb-1">Select Supplier *</label>
                  <SearchableSupplierSelect
                    suppliers={suppliers}
                    selectedSupplierId={poSupplierId}
                    onSelectSupplier={id => setPoSupplierId(id)}
                    supplierStatsMap={supplierStatsMap}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-neutral-700 block">PO / Invoice # *</label>
                    <button
                      type="button"
                      onClick={() => setPoNumber(generatePONumber())}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 transition-colors"
                      title="Generate next unique sequential PO number (PO-000001 format)"
                    >
                      <RefreshCw className="w-3 h-3" /> Auto PO #
                    </button>
                  </div>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    placeholder="PO-000001"
                    className={`w-full p-2.5 bg-white border rounded-xl font-mono font-bold focus:ring-2 ${
                      isDuplicatePONumber
                        ? 'border-red-500 text-red-700 focus:ring-red-400 bg-red-50/30'
                        : 'border-neutral-300 text-neutral-900 focus:ring-indigo-500'
                    }`}
                  />
                  {isDuplicatePONumber && (
                    <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Duplicate PO Number! Already exists.
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={e => setPoDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-medium text-neutral-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Purchase Type</label>
                  <select
                    value={purchaseType}
                    onChange={e => setPurchaseType(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-medium text-neutral-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Local">Local Purchase</option>
                    <option value="Bond">Bond Purchase</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="font-bold text-neutral-700 block mb-1">Notes / Payment Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. Credit 30 Days, Delivery at Store #1"
                    value={poNotes}
                    onChange={e => setPoNotes(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Multi-Item Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-neutral-800 text-xs uppercase tracking-wider">Purchase Line Items</h4>
                  <button
                    type="button"
                    onClick={handleAddPORow}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-700 font-bold">
                        <th className="p-2.5">Item Name / Code</th>
                        <th className="p-2.5 w-24">Unit</th>
                        <th className="p-2.5 w-28 text-right">Qty</th>
                        <th className="p-2.5 w-32 text-right">Unit Price (Tk)</th>
                        <th className="p-2.5 w-36 text-right">Line Total (Tk)</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {poItems.map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="p-2">
                            <select
                              value={row.itemId}
                              onChange={e => handlePOItemChange(idx, e.target.value)}
                              className="w-full p-2 border border-neutral-300 rounded-lg font-bold text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">-- Select Item --</option>
                              {items.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.sku || 'No SKU'}) - Stock: {item.currentStock} {item.unit}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={e => handlePORowFieldChange(idx, 'unit', e.target.value)}
                              placeholder="Kg / Pcs"
                              className="w-full p-2 bg-white border border-neutral-300 rounded-lg font-bold text-center text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              value={row.quantity}
                              onChange={e => handlePORowFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full p-2 border border-neutral-300 rounded-lg text-right font-bold text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.price}
                              onChange={e => handlePORowFieldChange(idx, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full p-2 border border-neutral-300 rounded-lg text-right font-bold text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2 text-right font-black text-neutral-900 p-2.5">
                            {(Number(row.total) || 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            {poItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePORow(idx)}
                                className="p-1 text-neutral-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-50 font-bold text-neutral-800 border-t border-neutral-200">
                        <td colSpan={4} className="p-2.5 text-right uppercase text-xs">Subtotal:</td>
                        <td className="p-2.5 text-right font-mono font-bold text-neutral-900">
                          {poSubtotal.toLocaleString()} Tk
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* VAT, AIT, Discount & Terms & Conditions Section */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-7 space-y-1">
                  <label className="font-bold text-neutral-700 block text-xs">Terms & Conditions (Editable)</label>
                  <textarea
                    rows={4}
                    value={poTermsConditions}
                    onChange={e => setPoTermsConditions(e.target.value)}
                    placeholder="Enter Terms & Conditions line by line..."
                    className="w-full p-2 text-xs bg-white border border-neutral-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-5 bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-neutral-700">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">{poSubtotal.toLocaleString()} Tk</span>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-700">VAT (%):</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={poVatPercent}
                        onChange={e => setPoVatPercent(e.target.value)}
                        placeholder="0"
                        className="w-full p-1 border border-neutral-300 rounded-lg text-right font-mono font-bold text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-700">AIT (%):</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={poAitPercent}
                        onChange={e => setPoAitPercent(e.target.value)}
                        placeholder="0"
                        className="w-full p-1 border border-neutral-300 rounded-lg text-right font-mono font-bold text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-700">Discount (Tk):</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={poDiscount}
                        onChange={e => setPoDiscount(e.target.value)}
                        placeholder="0"
                        className="w-full p-1 border border-neutral-300 rounded-lg text-right font-mono font-bold text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 flex justify-between items-center font-black text-sm text-neutral-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-indigo-700">{poTotalAmount.toLocaleString()} Tk</span>
                  </div>
                </div>
              </div>

              {/* Approver Selection */}
              <div className="pt-2">
                <ApproverSelector
                  businessId={userProfile.businessId}
                  selectedUid={selectedApproverPO?.uid}
                  selectedEmail={selectedApproverPO?.email}
                  selectedName={selectedApproverPO?.displayName}
                  isApprovalRequired={poApprovalRequired}
                  pageName="Purchase Orders"
                  onSelectApprover={setSelectedApproverPO}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2 border border-neutral-200 rounded-xl font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDuplicatePONumber}
                  className={`px-6 py-2 font-bold rounded-xl shadow-md transition-all ${
                    isDuplicatePONumber
                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  Save & Print Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: SUPPLIER PAYMENT & BILL ALLOCATION --- */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-4 border border-neutral-200 my-8">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-lg text-neutral-900">Record Supplier Payment & Bill Allocation</h3>
                <p className="text-xs text-neutral-500">
                  Record payment amount and allocate against open purchase bills for this supplier.
                </p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              {/* Payment Details Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                <div className="sm:col-span-2">
                  <label className="font-bold text-neutral-700 block mb-1">Select Supplier *</label>
                  <SearchableSupplierSelect
                    suppliers={suppliers}
                    selectedSupplierId={paySupplierId}
                    onSelectSupplier={id => {
                      setPaySupplierId(id);
                      setPayAllocations({});
                    }}
                    supplierStatsMap={supplierStatsMap}
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Payment Amount (Tk) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0"
                    value={payAmount || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setPayAmount(val);
                      if (Object.keys(payAllocations).length > 0) {
                        handleAutoAllocate(val);
                      }
                    }}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl font-black text-lg text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="bKash/Nagad">bKash / Nagad</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Cheque / Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Cheque # 98402, Txn ID..."
                    value={payReference}
                    onChange={e => setPayReference(e.target.value)}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-neutral-700 block mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Optional payment notes..."
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    className="w-full p-2 border border-neutral-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Bill Allocation Section */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="font-black text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Bill-Wise Payment Allocation
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Select bills to settle or enter partial allocation amounts.
                    </p>
                  </div>
                  {openPOListForPaySupplier.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAutoAllocate()}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Auto Allocate (Tk {payAmount.toLocaleString()})
                    </button>
                  )}
                </div>

                {openPOListForPaySupplier.length === 0 ? (
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-center text-neutral-500 text-xs font-medium">
                    No outstanding purchase bills for this supplier. Payment will be saved as advance on account.
                  </div>
                ) : (
                  <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-700 font-bold">
                          <th className="p-2.5 w-10 text-center">Sel</th>
                          <th className="p-2.5">PO / Bill #</th>
                          <th className="p-2.5 w-24">Date</th>
                          <th className="p-2.5 w-28 text-right">Bill Total (Tk)</th>
                          <th className="p-2.5 w-28 text-right">Due (Tk)</th>
                          <th className="p-2.5 w-36 text-right">Allocate Amount (Tk)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {openPOListForPaySupplier.map(({ po, totalAmount, dueAmount }) => {
                          const currentAlloc = payAllocations[po.id] || 0;
                          const isSelected = currentAlloc > 0;

                          return (
                            <tr key={po.id} className={isSelected ? 'bg-indigo-50/60 font-medium' : 'hover:bg-neutral-50'}>
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      const unalloc = Math.max(0, payAmount - totalAllocated);
                                      const target = unalloc > 0 ? Math.min(unalloc, dueAmount) : dueAmount;
                                      handleBillAllocationChange(po.id, target, dueAmount);
                                    } else {
                                      handleBillAllocationChange(po.id, 0, dueAmount);
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-2.5 font-bold font-mono text-neutral-900">
                                {po.poNumber}
                              </td>
                              <td className="p-2.5 text-neutral-600">
                                {format(toSafeDate(po.date), 'dd/MM/yyyy')}
                              </td>
                              <td className="p-2.5 text-right text-neutral-700">
                                {totalAmount.toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-bold text-rose-600">
                                {dueAmount.toLocaleString()}
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  max={dueAmount}
                                  value={currentAlloc || ''}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    handleBillAllocationChange(po.id, val, dueAmount);
                                  }}
                                  placeholder="0"
                                  className="w-28 p-1.5 border border-neutral-300 rounded-lg text-right font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-neutral-100 font-bold border-t border-neutral-200 text-neutral-800">
                          <td colSpan={4} className="p-2.5 text-right">Allocation Summary:</td>
                          <td className="p-2.5 text-right text-indigo-700 font-black">
                            Allocated: {totalAllocated.toLocaleString()} Tk
                          </td>
                          <td className="p-2.5 text-right text-emerald-700 font-black">
                            {payAmount - totalAllocated > 0 
                              ? `Advance: ${(payAmount - totalAllocated).toLocaleString()} Tk`
                              : payAmount - totalAllocated < 0
                              ? `Excess: ${Math.abs(payAmount - totalAllocated).toLocaleString()} Tk`
                              : 'Fully Allocated'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Approver Selection */}
              <div className="pt-2">
                <ApproverSelector
                  businessId={userProfile.businessId}
                  selectedUid={selectedApproverPayment?.uid}
                  selectedEmail={selectedApproverPayment?.email}
                  selectedName={selectedApproverPayment?.displayName}
                  isApprovalRequired={paymentApprovalRequired}
                  pageName="Supplier Payment"
                  onSelectApprover={setSelectedApproverPayment}
                />
              </div>

              <div className="flex flex-wrap justify-end items-center gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-neutral-200 rounded-xl font-bold text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSavePayment(e, false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-neutral-600" />
                  Save Only
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Save & Print Voucher</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: PRINT PURCHASE ORDER SLIP --- */}
      {selectedPOForPrint && (() => {
        const sup = suppliers.find(s => s.id === selectedPOForPrint.supplierId || (s.name && selectedPOForPrint.supplierName && s.name.trim().toLowerCase() === selectedPOForPrint.supplierName.trim().toLowerCase()));
        const subTotalAmount = selectedPOForPrint.subtotal !== undefined 
          ? selectedPOForPrint.subtotal 
          : selectedPOForPrint.items.reduce((sum, it) => sum + (it.total || (it.quantity * it.price)), 0);
        
        const vatPercent = selectedPOForPrint.vatPercent !== undefined ? Number(selectedPOForPrint.vatPercent) : 0;
        const vatAmount = selectedPOForPrint.vatAmount !== undefined 
          ? Number(selectedPOForPrint.vatAmount) 
          : ((subTotalAmount * vatPercent) / 100);

        const aitPercent = selectedPOForPrint.aitPercent !== undefined ? Number(selectedPOForPrint.aitPercent) : 0;
        const aitAmount = selectedPOForPrint.aitAmount !== undefined 
          ? Number(selectedPOForPrint.aitAmount) 
          : ((subTotalAmount * aitPercent) / 100);

        const poPrintData: POPrintData = {
          documentType: 'purchase-order',
          title: 'Purchase Order',
          status: selectedPOForPrint.status === 'pending_delete' ? 'PENDING DELETE' : 'CONFIRMED',
          poNumber: selectedPOForPrint.poNumber,
          poDate: toSafeDate(selectedPOForPrint.date),
          deliveryDate: selectedPOForPrint.deliveryDate ? toSafeDate(selectedPOForPrint.deliveryDate) : toSafeDate(selectedPOForPrint.date),
          deliveryTo: selectedPOForPrint.deliveryTo || 'ES Trims Limited, C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400',
          currency: 'BDT',
          supplierName: selectedPOForPrint.supplierName || sup?.name || '',
          supplierAddress: (sup?.address || (sup ? [sup.addressLine1, sup.city, sup.country].filter(Boolean).join(', ') : '')) || selectedPOForPrint.supplierAddress || '',
          supplierContact: sup?.contactPerson || (selectedPOForPrint as any).supplierContact || '',
          supplierPhone: sup?.phone || sup?.mobile || (selectedPOForPrint as any).supplierPhone || '',
          supplierEmail: sup?.email || (selectedPOForPrint as any).supplierEmail || '',
          supplierTinBin: (sup as any)?.taxNumber || (sup as any)?.bin || (sup as any)?.tradeLicense || '',
          items: selectedPOForPrint.items.map((it, idx) => ({
            sl: idx + 1,
            itemCode: it.sku || `RM-${101 + idx}`,
            itemName: it.itemName,
            specification: (it as any).specification || (it as any).notes || 'Standard Factory Grade',
            unit: it.unit || 'PCS',
            quantity: it.quantity,
            unitPrice: it.price,
            amount: it.total || (it.quantity * it.price)
          })),
          subTotal: subTotalAmount,
          vatPercent,
          vatAmount,
          aitPercent,
          aitAmount,
          discount: selectedPOForPrint.discount || 0,
          grandTotal: selectedPOForPrint.totalAmount || (subTotalAmount + vatAmount + aitAmount - (selectedPOForPrint.discount || 0)),
          notes: selectedPOForPrint.notes,
          termsAndConditions: selectedPOForPrint.termsConditions || selectedPOForPrint.notes,
          preparedByName: selectedPOForPrint.preparedBy || userProfile.displayName || userProfile.email || 'Admin',
          preparedByDesignation: (userProfile as any).designation || 'Purchase Executive',
          preparedByDate: format(toSafeDate(selectedPOForPrint.date), 'dd MMM yyyy'),
          checkedByName: undefined, // Blank for physical signature
          approvedByName: undefined, // Blank for physical signature
          acceptedByName: sup?.contactPerson || '',
          acceptedByCompany: selectedPOForPrint.supplierName || sup?.name || 'Supplier'
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print-bg">
            <div className="bg-transparent w-full max-w-5xl my-8">
              <PurchaseOrderPrintView 
                data={poPrintData}
                onClose={() => setSelectedPOForPrint(null)}
              />
            </div>
          </div>
        );
      })()}

      {/* --- MODAL 5: PRINT SUPPLIER PAYMENT VOUCHER --- */}
      {selectedPaymentForPrint && (() => {
        const sup = suppliers.find(s => s.id === selectedPaymentForPrint.supplierId || (s.name && selectedPaymentForPrint.supplierName && s.name.trim().toLowerCase() === selectedPaymentForPrint.supplierName.trim().toLowerCase()));
        
        // Match allocations with detailed PO data if possible
        const detailedAllocations = (selectedPaymentForPrint.allocations || []).map(alloc => {
          const po = purchaseOrders.find(p => p.id === alloc.poId || p.poNumber === alloc.poNumber);
          const subTotal = po?.subtotal !== undefined ? po.subtotal : (po?.items || []).reduce((sum, it) => sum + (it.total || (it.quantity * it.price)), 0);
          const vat = po?.vatAmount || (po?.vatPercent ? (subTotal * Number(po.vatPercent)) / 100 : 0);
          const ait = po?.aitAmount || (po?.aitPercent ? (subTotal * Number(po.aitPercent)) / 100 : 0);
          const discount = po?.discount || 0;
          const poTotal = po?.grandTotal || Math.max(0, subTotal + vat + ait - discount);
          
          return {
            poId: alloc.poId,
            poNumber: alloc.poNumber,
            billDate: po ? toSafeDate(po.date) : undefined,
            billAmount: poTotal || undefined,
            allocatedAmount: alloc.allocatedAmount
          };
        });

        const autoVoucherNo = selectedPaymentForPrint.reference || `PV-${format(toSafeDate(selectedPaymentForPrint.paymentDate), 'yyyyMMdd')}-${selectedPaymentForPrint.id ? selectedPaymentForPrint.id.slice(-4).toUpperCase() : Math.floor(1000 + Math.random() * 9000)}`;

        const voucherData: PaymentVoucherData = {
          voucherNo: autoVoucherNo,
          paymentDate: toSafeDate(selectedPaymentForPrint.paymentDate),
          amount: Number(selectedPaymentForPrint.amount),
          paymentMethod: selectedPaymentForPrint.paymentMethod || 'Cash',
          reference: selectedPaymentForPrint.reference,
          notes: selectedPaymentForPrint.notes,
          status: selectedPaymentForPrint.status,
          supplierId: sup?.id || selectedPaymentForPrint.supplierId,
          supplierName: sup?.name || selectedPaymentForPrint.supplierName,
          supplierAddress: sup?.address || [sup?.addressLine1, sup?.city, sup?.country].filter(Boolean).join(', ') || undefined,
          supplierContact: sup?.contactPerson || undefined,
          supplierPhone: sup?.phone || sup?.mobile || undefined,
          supplierEmail: sup?.email || undefined,
          supplierBalance: supplierStatsMap[selectedPaymentForPrint.supplierId]?.netBalance,
          allocations: detailedAllocations,
          preparedByName: userProfile.displayName || userProfile.name || userProfile.email || 'Accounts Department'
        };

        return (
          <SupplierPaymentVoucherPrintView
            voucherData={voucherData}
            onClose={() => setSelectedPaymentForPrint(null)}
          />
        );
      })()}
    </div>
  );
};
