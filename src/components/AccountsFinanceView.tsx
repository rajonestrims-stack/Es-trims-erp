import React, { useState, useEffect, useMemo } from 'react';
import { printElement } from '../utils/printHelper';
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
  orderBy
} from 'firebase/firestore';
import { 
  Receipt, 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  Edit2, 
  Trash2, 
  Printer, 
  X, 
  Filter, 
  Building2, 
  Hash, 
  Calendar, 
  Package, 
  AlertCircle,
  FileCheck2,
  DollarSign,
  Download,
  ArrowRight,
  Eye,
  RefreshCw,
  Layers,
  ChevronRight,
  Calculator,
  Percent,
  Check,
  CreditCard,
  FileSpreadsheet
} from 'lucide-react';
import { db } from '../firebase';
import { 
  UserProfile, 
  Customer, 
  DeliveryChallanRecord, 
  CustomerMrrReceipt,
  PriceMaster,
  WorkOrder,
  CustomerBill,
  CustomerBillItem,
  Supplier,
  PurchaseOrder,
  SupplierPayment,
  Item,
  RoleDefinition
} from '../types';
import { SuppliersAndPurchase } from './SuppliersAndPurchase';
import { AccountsModule } from './accounts/AccountsModule';
import { checkActionPermission, isUserSuperAdmin, canUserAccessPage } from '../admin/adminUtils';

interface AccountsFinanceViewProps {
  userProfile: UserProfile;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  customers?: Customer[];
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  supplierPayments?: SupplierPayment[];
  items?: Item[];
  recalculateItemStock?: (itemId: string, businessId: string) => Promise<void>;
  fetchFullHistory?: () => Promise<void>;
  syncAllData?: () => Promise<void>;
  isEditor?: boolean;
  initialSubTab?: 'create-bill' | 'bill-list' | 'mrr-status' | 'supplier-ledger' | 'supplier-payment' | 'supplier-report';
  onSubTabChange?: (subTab: 'create-bill' | 'bill-list' | 'mrr-status' | 'supplier-ledger' | 'supplier-payment' | 'supplier-report') => void;
  onCreatePI?: (billId: string) => void;
  roles?: RoleDefinition[];
  allowedPagesSet?: Set<string>;
}

// Number to Words converter helper for USD
function numberToWords(num: number): string {
  if (num === 0) return 'Zero USD';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? '-' + a[digit] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + inWords(n % 100) : '');
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + inWords(n % 1000000) : '');
    return inWords(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 ? ' ' + inWords(n % 1000000000) : '');
  }

  const parts = num.toFixed(2).split('.');
  const dollars = parseInt(parts[0], 10);
  const cents = parseInt(parts[1], 10);

  let res = 'US Dollar ' + inWords(dollars);
  if (cents > 0) {
    res += ' and ' + inWords(cents) + ' Cents';
  }
  return res + ' Only';
}

export function AccountsFinanceView({
  userProfile,
  showToast,
  customers: propCustomers = [],
  suppliers = [],
  purchaseOrders = [],
  supplierPayments = [],
  items = [],
  recalculateItemStock,
  fetchFullHistory,
  syncAllData,
  isEditor = false,
  initialSubTab = 'create-bill',
  onSubTabChange,
  onCreatePI,
  roles = [],
  allowedPagesSet
}: AccountsFinanceViewProps) {
  const businessId = userProfile.businessId;

  // --- Granular Permissions & Sub-navigation Access ---
  const isSuperAdmin = isUserSuperAdmin(userProfile);
  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (allowedPagesSet) return allowedPagesSet.has(pageId);
    return canUserAccessPage(userProfile, pageId, roles);
  };
  const canAccessCreateBill = isSuperAdmin || isPagePermitted('finance-billing') || isPagePermitted('finance-create-bill') || checkActionPermission(userProfile, 'finance-create-bill', 'create', roles);
  const canAccessBillList = isSuperAdmin || isPagePermitted('finance-bill-list');
  const canAccessMrr = isSuperAdmin || isPagePermitted('customer-mrr') || isPagePermitted('finance-mrr-tracker');
  const canAccessSupplierLedger = isSuperAdmin || isPagePermitted('supplier-ledger');
  const canAccessSupplierPayment = isSuperAdmin || isPagePermitted('supplier-payment');
  const canAccessSupplierReport = isSuperAdmin || isPagePermitted('supplier-report');

  const canCreateBill = isSuperAdmin || checkActionPermission(userProfile, 'finance-create-bill', 'create', roles) || checkActionPermission(userProfile, 'finance-billing', 'create', roles);
  const canDeleteBill = isSuperAdmin || checkActionPermission(userProfile, 'finance-bill-list', 'delete', roles);

  const availableSubTabs = useMemo(() => {
    const tabs: ('create-bill' | 'bill-list' | 'mrr-status' | 'supplier-ledger' | 'supplier-payment' | 'supplier-report')[] = [];
    if (canAccessCreateBill) tabs.push('create-bill');
    if (canAccessBillList) tabs.push('bill-list');
    if (canAccessMrr) tabs.push('mrr-status');
    if (canAccessSupplierLedger) tabs.push('supplier-ledger');
    if (canAccessSupplierPayment) tabs.push('supplier-payment');
    if (canAccessSupplierReport) tabs.push('supplier-report');
    return tabs;
  }, [canAccessCreateBill, canAccessBillList, canAccessMrr, canAccessSupplierLedger, canAccessSupplierPayment, canAccessSupplierReport]);

  // --- Sub-navigation State ---
  const [financeSystemMode, setFinanceSystemMode] = useState<'erp_accounts' | 'billing_tracker'>('billing_tracker');
  const [activeSubTab, setActiveSubTab] = useState<'create-bill' | 'bill-list' | 'mrr-status' | 'supplier-ledger' | 'supplier-payment' | 'supplier-report'>(() => {
    if (initialSubTab && (
      (initialSubTab === 'create-bill' && canAccessCreateBill) ||
      (initialSubTab === 'bill-list' && canAccessBillList) ||
      (initialSubTab === 'mrr-status' && canAccessMrr) ||
      (initialSubTab === 'supplier-ledger' && canAccessSupplierLedger) ||
      (initialSubTab === 'supplier-payment' && canAccessSupplierPayment) ||
      (initialSubTab === 'supplier-report' && canAccessSupplierReport)
    )) {
      return initialSubTab;
    }
    return availableSubTabs[0] || 'bill-list';
  });

  useEffect(() => {
    if (availableSubTabs.length > 0 && !availableSubTabs.includes(activeSubTab)) {
      setActiveSubTab(availableSubTabs[0]);
    }
  }, [availableSubTabs, activeSubTab]);

  useEffect(() => {
    if (initialSubTab && availableSubTabs.includes(initialSubTab)) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, availableSubTabs]);

  const handleSubTabSwitch = (tab: 'create-bill' | 'bill-list' | 'mrr-status' | 'supplier-ledger' | 'supplier-payment' | 'supplier-report') => {
    if (!availableSubTabs.includes(tab)) {
      showToast('You do not have permission to access this section', 'error');
      return;
    }
    setActiveSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // --- Live Data State ---
  const [customers, setCustomers] = useState<Customer[]>(propCustomers);
  const [mrrReceipts, setMrrReceipts] = useState<CustomerMrrReceipt[]>([]);
  const [challans, setChallans] = useState<DeliveryChallanRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [priceMasters, setPriceMasters] = useState<PriceMaster[]>([]);
  const [bills, setBills] = useState<CustomerBill[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // --- Form & Selection State for Bill Creation ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedMrrIds, setSelectedMrrIds] = useState<Set<string>>(new Set());
  const [billItems, setBillItems] = useState<CustomerBillItem[]>([]);
  const [billNo, setBillNo] = useState<string>('');
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('30 Days');
  const [remarks, setRemarks] = useState<string>('');
  const [vatPercent, setVatPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // --- Filtering & Search State for MRR table ---
  const [mrrSearchQuery, setMrrSearchQuery] = useState<string>('');
  const [mrrStatusFilter, setMrrStatusFilter] = useState<'all' | 'pending' | 'billed'>('pending');

  // --- Bill List Filter State ---
  const [billListCustomerFilter, setBillListCustomerFilter] = useState<string>('all');
  const [billListSearchQuery, setBillListSearchQuery] = useState<string>('');
  const [billListStatusFilter, setBillListStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // --- Modals / Print Preview State ---
  const [viewingBill, setViewingBill] = useState<CustomerBill | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [billToDelete, setBillToDelete] = useState<CustomerBill | null>(null);

  // 1. Fetch Customers
  useEffect(() => {
    if (!businessId) return;
    if (propCustomers.length === 0) {
      const qCust = query(collection(db, 'customers'), where('businessId', '==', businessId));
      const unsub = onSnapshot(qCust, (snap) => {
        const list: Customer[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as Customer));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setCustomers(list);
      }, (err) => {
        console.warn('Customers listener warning:', err.message);
      });
      return () => unsub();
    } else {
      setCustomers(propCustomers);
    }
  }, [businessId, propCustomers]);

  // 2. Fetch MRR Receipts, Challans, Work Orders, Price Master, and Bills
  useEffect(() => {
    if (!businessId) return;
    setIsLoading(true);

    // Customer MRR Receipts
    const qMrr = query(collection(db, 'customer_mrr_receipts'), where('businessId', '==', businessId));
    const unsubMrr = onSnapshot(qMrr, (snap) => {
      const list: CustomerMrrReceipt[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CustomerMrrReceipt));
      list.sort((a, b) => (b.mrrDate || '').localeCompare(a.mrrDate || ''));
      setMrrReceipts(list);
    }, (err) => {
      console.warn('MRR receipts listener warning:', err.message);
    });

    // Delivery Challans
    const qChallan = query(collection(db, 'delivery_challans'), where('businessId', '==', businessId));
    const unsubChallan = onSnapshot(qChallan, (snap) => {
      const list: DeliveryChallanRecord[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as DeliveryChallanRecord));
      setChallans(list);
    }, (err) => {
      console.warn('Challans listener warning:', err.message);
    });

    // Work Orders (for PO No, System ID, Rate)
    const qWo = query(collection(db, 'work_orders'), where('businessId', '==', businessId));
    const unsubWo = onSnapshot(qWo, (snap) => {
      const list: WorkOrder[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as WorkOrder));
      setWorkOrders(list);
    }, (err) => {
      console.warn('Work orders listener warning:', err.message);
    });

    // Price Masters (for customer + product pricing)
    const qPrice = query(collection(db, 'price_master'), where('businessId', '==', businessId));
    const unsubPrice = onSnapshot(qPrice, (snap) => {
      const list: PriceMaster[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as PriceMaster));
      setPriceMasters(list);
    }, (err) => {
      console.warn('Price master listener warning:', err.message);
    });

    // Customer Bills
    const qBills = query(collection(db, 'customer_bills'), where('businessId', '==', businessId));
    const unsubBills = onSnapshot(qBills, (snap) => {
      const list: CustomerBill[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CustomerBill));
      list.sort((a, b) => (b.billDate || '').localeCompare(a.billDate || ''));
      setBills(list);
      setIsLoading(false);
    }, (err) => {
      console.warn('Bills listener warning:', err.message);
      setIsLoading(false);
    });

    return () => {
      unsubMrr();
      unsubChallan();
      unsubWo();
      unsubPrice();
      unsubBills();
    };
  }, [businessId]);

  // Generate Default Bill No on load or bill count change
  useEffect(() => {
    const year = new Date().getFullYear();
    const count = bills.length + 1;
    const padded = String(count).padStart(6, '0');
    setBillNo(`BILL-${year}-${padded}`);
  }, [bills.length]);

  // Selected Customer Object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Filtered MRR Receipts for the selected customer
  const availableCustomerMrrs = useMemo(() => {
    if (!selectedCustomerId) return [];

    return mrrReceipts.filter(mrr => {
      // Must match customer
      const matchCustomer = mrr.customerId === selectedCustomerId || 
        (selectedCustomer && mrr.customerName?.trim().toLowerCase() === selectedCustomer.name?.trim().toLowerCase());
      if (!matchCustomer) return false;

      // Status filter
      if (mrrStatusFilter === 'pending') {
        if (mrr.billingStatus === 'billed') return false;
      } else if (mrrStatusFilter === 'billed') {
        if (mrr.billingStatus !== 'billed') return false;
      }

      // Search Query
      if (mrrSearchQuery.trim()) {
        const q = mrrSearchQuery.toLowerCase();
        const match = 
          (mrr.mrrNo || '').toLowerCase().includes(q) ||
          (mrr.challanNo || '').toLowerCase().includes(q) ||
          (mrr.poNo || '').toLowerCase().includes(q) ||
          (mrr.woNumber || '').toLowerCase().includes(q) ||
          (mrr.productName || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [mrrReceipts, selectedCustomerId, selectedCustomer, mrrStatusFilter, mrrSearchQuery]);

  // Customer delivery challans summary for sequential workflow visibility
  const customerChallans = useMemo(() => {
    if (!selectedCustomerId) return [];
    return challans.filter(c => 
      c.status !== 'cancelled' && 
      (c.customerId === selectedCustomerId || (selectedCustomer && c.customerName?.trim().toLowerCase() === selectedCustomer.name?.trim().toLowerCase()))
    );
  }, [challans, selectedCustomerId, selectedCustomer]);

  const customerUnreceivedChallansCount = useMemo(() => {
    return customerChallans.filter(c => c.receivedStatus !== 'received').length;
  }, [customerChallans]);

  const customerPendingMrrChallansCount = useMemo(() => {
    return customerChallans.filter(c => 
      c.receivedStatus === 'received' && 
      !c.hasMrr && 
      !mrrReceipts.some(m => m.challanId === c.id || m.challanNo === c.challanNo)
    ).length;
  }, [customerChallans, mrrReceipts]);

  // Helper to find price per piece or price per dozen from PriceMaster or WorkOrder
  const resolvePriceForMrr = (mrr: CustomerMrrReceipt): { pricePerPcs: number; pricePerDoz: number; source: string } => {
    // 1. Check Price Master for this customer and product
    const pm = priceMasters.find(p => 
      p.customerId === mrr.customerId && 
      (p.finishedGoodsName?.trim().toLowerCase() === mrr.productName?.trim().toLowerCase() ||
       p.finishedGoodsNo?.trim().toLowerCase() === mrr.productCode?.trim().toLowerCase()) &&
      p.status === 'active'
    );

    if (pm && typeof pm.rate === 'number' && pm.rate > 0) {
      // Price master rate in system is usually per piece
      const ratePerPcs = pm.rate;
      return {
        pricePerPcs: ratePerPcs,
        pricePerDoz: Number((ratePerPcs * 12).toFixed(4)),
        source: 'Price Master'
      };
    }

    // 2. Check Work Order for rate
    if (mrr.woId || mrr.woNumber) {
      const wo = workOrders.find(w => w.id === mrr.woId || w.woNumber === mrr.woNumber);
      if (wo) {
        if (typeof wo.rate === 'number' && wo.rate > 0) {
          return {
            pricePerPcs: wo.rate,
            pricePerDoz: Number((wo.rate * 12).toFixed(4)),
            source: 'Work Order Rate'
          };
        }
        // Check breakdown rows
        if (wo.breakdownRows && wo.breakdownRows.length > 0) {
          const firstRowWithRate = wo.breakdownRows.find(r => typeof r.rate === 'number' && r.rate > 0);
          if (firstRowWithRate && firstRowWithRate.rate) {
            return {
              pricePerPcs: firstRowWithRate.rate,
              pricePerDoz: Number((firstRowWithRate.rate * 12).toFixed(4)),
              source: 'Work Order Breakdown'
            };
          }
        }
      }
    }

    // 3. Fallback default
    return {
      pricePerPcs: 0.05,
      pricePerDoz: 0.60,
      source: 'Default Estimation ($0.05/pc)'
    };
  };

  // When selected MRRs change, rebuild the bill line items
  const handleToggleMrrSelection = (mrr: CustomerMrrReceipt) => {
    const nextSelected = new Set(selectedMrrIds);
    if (nextSelected.has(mrr.id)) {
      nextSelected.delete(mrr.id);
      // Remove from bill items
      setBillItems(prev => prev.filter(item => item.mrrId !== mrr.id));
    } else {
      nextSelected.add(mrr.id);
      // Find corresponding challan or WO for missing details
      const matchedChallan = challans.find(c => c.id === mrr.challanId || c.challanNo === mrr.challanNo);
      const matchedWo = workOrders.find(w => w.id === mrr.woId || w.woNumber === mrr.woNumber);

      const resolved = resolvePriceForMrr(mrr);
      const qtyPcs = Number(mrr.mrrQty || 0);
      const qtyDoz = Number((qtyPcs / 12).toFixed(4));
      const amountUSD = Number((qtyDoz * resolved.pricePerDoz).toFixed(2));

      const newItem: CustomerBillItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        poNo: mrr.poNo || matchedChallan?.poNo || matchedWo?.poNo || 'N/A',
        systemId: mrr.woNumber || matchedChallan?.woNumber || matchedWo?.woNumber || 'SYS-ID',
        challanNo: mrr.challanNo || matchedChallan?.challanNo || 'N/A',
        date: mrr.challanDate || mrr.mrrDate || new Date().toISOString().split('T')[0],
        description: mrr.productName || matchedChallan?.productName || 'Trims Item',
        quantityPcs: qtyPcs,
        quantityDoz: qtyDoz,
        pricePerPcs: resolved.pricePerPcs,
        pricePerDoz: resolved.pricePerDoz,
        amountUSD: amountUSD,
        mrrId: mrr.id,
        mrrNo: mrr.mrrNo,
        challanId: mrr.challanId,
        woId: mrr.woId,
        productId: mrr.productCode,
        unit: mrr.unit || 'Doz'
      };

      setBillItems(prev => [...prev, newItem]);
    }
    setSelectedMrrIds(nextSelected);
  };

  const handleSelectAllMrrs = () => {
    if (selectedMrrIds.size === availableCustomerMrrs.length && availableCustomerMrrs.length > 0) {
      // Deselect all
      setSelectedMrrIds(new Set());
      setBillItems([]);
    } else {
      // Select all available
      const newSelected = new Set<string>();
      const newItems: CustomerBillItem[] = [];

      availableCustomerMrrs.forEach(mrr => {
        newSelected.add(mrr.id);
        const matchedChallan = challans.find(c => c.id === mrr.challanId || c.challanNo === mrr.challanNo);
        const matchedWo = workOrders.find(w => w.id === mrr.woId || w.woNumber === mrr.woNumber);
        const resolved = resolvePriceForMrr(mrr);
        const qtyPcs = Number(mrr.mrrQty || 0);
        const qtyDoz = Number((qtyPcs / 12).toFixed(4));
        const amountUSD = Number((qtyDoz * resolved.pricePerDoz).toFixed(2));

        newItems.push({
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          poNo: mrr.poNo || matchedChallan?.poNo || matchedWo?.poNo || 'N/A',
          systemId: mrr.woNumber || matchedChallan?.woNumber || matchedWo?.woNumber || 'SYS-ID',
          challanNo: mrr.challanNo || matchedChallan?.challanNo || 'N/A',
          date: mrr.challanDate || mrr.mrrDate || new Date().toISOString().split('T')[0],
          description: mrr.productName || matchedChallan?.productName || 'Trims Item',
          quantityPcs: qtyPcs,
          quantityDoz: qtyDoz,
          pricePerPcs: resolved.pricePerPcs,
          pricePerDoz: resolved.pricePerDoz,
          amountUSD: amountUSD,
          mrrId: mrr.id,
          mrrNo: mrr.mrrNo,
          challanId: mrr.challanId,
          woId: mrr.woId,
          productId: mrr.productCode,
          unit: mrr.unit || 'Doz'
        });
      });

      setSelectedMrrIds(newSelected);
      setBillItems(newItems);
    }
  };

  // Update item field (e.g. user manually edits Price/Doz or Quantity)
  const handleUpdateBillItem = (index: number, field: keyof CustomerBillItem, value: any) => {
    setBillItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'pricePerDoz') {
        const dozPrice = Number(value) || 0;
        item.pricePerDoz = dozPrice;
        item.pricePerPcs = Number((dozPrice / 12).toFixed(4));
        item.amountUSD = Number((item.quantityDoz * dozPrice).toFixed(2));
      } else if (field === 'pricePerPcs') {
        const pcPrice = Number(value) || 0;
        item.pricePerPcs = pcPrice;
        item.pricePerDoz = Number((pcPrice * 12).toFixed(4));
        item.amountUSD = Number((item.quantityDoz * item.pricePerDoz).toFixed(2));
      } else if (field === 'quantityPcs') {
        const pcs = Number(value) || 0;
        item.quantityPcs = pcs;
        item.quantityDoz = Number((pcs / 12).toFixed(4));
        item.amountUSD = Number((item.quantityDoz * item.pricePerDoz).toFixed(2));
      } else if (field === 'quantityDoz') {
        const doz = Number(value) || 0;
        item.quantityDoz = doz;
        item.quantityPcs = Math.round(doz * 12);
        item.amountUSD = Number((doz * item.pricePerDoz).toFixed(2));
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveBillItem = (index: number) => {
    const item = billItems[index];
    if (item && item.mrrId) {
      const next = new Set(selectedMrrIds);
      next.delete(item.mrrId);
      setSelectedMrrIds(next);
    }
    setBillItems(prev => prev.filter((_, i) => i !== index));
  };

  // Totals Calculation
  const totals = useMemo(() => {
    const totalPcs = billItems.reduce((sum, item) => sum + (Number(item.quantityPcs) || 0), 0);
    const totalDoz = Number(billItems.reduce((sum, item) => sum + (Number(item.quantityDoz) || 0), 0).toFixed(4));
    const subTotalUSD = Number(billItems.reduce((sum, item) => sum + (Number(item.amountUSD) || 0), 0).toFixed(2));
    const vatAmount = Number(((subTotalUSD * vatPercent) / 100).toFixed(2));
    const grandTotalUSD = Number((subTotalUSD + vatAmount - discountAmount).toFixed(2));

    return {
      totalPcs,
      totalDoz,
      subTotalUSD,
      vatAmount,
      grandTotalUSD,
      amountInWords: numberToWords(grandTotalUSD)
    };
  }, [billItems, vatPercent, discountAmount]);

  // Handle Save Customer Bill
  const handleSaveBill = async (andPrint: boolean = false) => {
    if (!selectedCustomerId || !selectedCustomer) {
      showToast('Please select a customer first', 'error');
      return;
    }
    if (billItems.length === 0) {
      showToast('Please select at least one MRR receipt to generate the bill', 'error');
      return;
    }
    if (!billNo.trim()) {
      showToast('Bill Number is required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      const billData: Omit<CustomerBill, 'id'> = {
        billNo: billNo.trim(),
        billDate,
        dueDate: dueDate || billDate,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerAddress: selectedCustomer.address || '',
        buyerName: billItems[0]?.poNo ? billItems[0].poNo : selectedCustomer.contactPerson || '',
        currency: 'USD',
        currencySymbol: '$',
        items: billItems,
        totalQtyPcs: totals.totalPcs,
        totalQtyDoz: totals.totalDoz,
        totalAmountUSD: totals.subTotalUSD,
        vatPercent,
        vatAmount: totals.vatAmount,
        discountAmount,
        grandTotalUSD: totals.grandTotalUSD,
        amountInWords: totals.amountInWords,
        paymentTerms,
        remarks,
        status: 'submitted',
        businessId,
        ownerId: userProfile.uid,
        createdBy: userProfile.displayName || userProfile.email,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'customer_bills'), billData);
      const createdBill: CustomerBill = { id: docRef.id, ...billData };

      // Update MRR receipts billing status to 'billed'
      for (const item of billItems) {
        if (item.mrrId) {
          try {
            await updateDoc(doc(db, 'customer_mrr_receipts', item.mrrId), {
              billingStatus: 'billed',
              billedQty: item.quantityPcs,
              billNo: billNo.trim(),
              billId: docRef.id,
              billedAt: Timestamp.now()
            });
          } catch (e) {
            console.error('Error updating MRR status:', e);
          }
        }
      }

      showToast(`Bill ${billNo} created successfully!`, 'success');

      // Reset form
      setSelectedMrrIds(new Set());
      setBillItems([]);
      const year = new Date().getFullYear();
      const count = bills.length + 2;
      setBillNo(`BILL-${year}-${String(count).padStart(6, '0')}`);

      if (andPrint) {
        setViewingBill(createdBill);
        setIsPrintModalOpen(true);
      } else {
        handleSubTabSwitch('bill-list');
      }
    } catch (err: any) {
      console.error('Error saving bill:', err);
      showToast('Failed to save bill: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Bill
  const handleDeleteBill = async () => {
    if (!billToDelete) return;
    try {
      // Revert MRR billing statuses
      if (billToDelete.items && billToDelete.items.length > 0) {
        for (const item of billToDelete.items) {
          if (item.mrrId) {
            try {
              await updateDoc(doc(db, 'customer_mrr_receipts', item.mrrId), {
                billingStatus: 'pending',
                billedQty: 0,
                billNo: null,
                billId: null
              });
            } catch (e) {
              console.error('Error reverting MRR status:', e);
            }
          }
        }
      }

      await deleteDoc(doc(db, 'customer_bills', billToDelete.id));
      showToast(`Bill ${billToDelete.billNo} deleted successfully`, 'info');
      setBillToDelete(null);
    } catch (err: any) {
      console.error('Error deleting bill:', err);
      showToast('Failed to delete bill: ' + err.message, 'error');
    }
  };

  // Filtered Bills for Bill List Tab
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      // Customer filter
      if (billListCustomerFilter !== 'all' && b.customerId !== billListCustomerFilter) {
        return false;
      }
      // Status filter
      if (billListStatusFilter !== 'all' && b.status !== billListStatusFilter) {
        return false;
      }
      // Date range filter
      if (dateFrom && b.billDate < dateFrom) return false;
      if (dateTo && b.billDate > dateTo) return false;

      // Search Query
      if (billListSearchQuery.trim()) {
        const q = billListSearchQuery.toLowerCase();
        const matchNo = (b.billNo || '').toLowerCase().includes(q);
        const matchCustomer = (b.customerName || '').toLowerCase().includes(q);
        const matchPo = b.items?.some(i => (i.poNo || '').toLowerCase().includes(q) || (i.challanNo || '').toLowerCase().includes(q));
        if (!matchNo && !matchCustomer && !matchPo) return false;
      }

      return true;
    });
  }, [bills, billListCustomerFilter, billListStatusFilter, dateFrom, dateTo, billListSearchQuery]);

  // Overall Financial Stats
  const stats = useMemo(() => {
    const totalBilledAmount = bills.reduce((sum, b) => sum + (b.grandTotalUSD || b.totalAmountUSD || 0), 0);
    const totalBillsCount = bills.length;
    const totalPcsBilled = bills.reduce((sum, b) => sum + (b.totalQtyPcs || 0), 0);
    const totalDozBilled = bills.reduce((sum, b) => sum + (b.totalQtyDoz || 0), 0);
    const pendingMrrsCount = mrrReceipts.filter(m => m.billingStatus !== 'billed').length;

    return {
      totalBilledAmount: totalBilledAmount.toFixed(2),
      totalBillsCount,
      totalPcsBilled,
      totalDozBilled: totalDozBilled.toFixed(2),
      pendingMrrsCount
    };
  }, [bills, mrrReceipts]);

  return (
    <div className="space-y-6">
      {/* Top Module Mode Bar */}
      <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3 rounded-xl border border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial System Engine:</span>
          <span className="text-xs font-semibold text-indigo-400">
            {financeSystemMode === 'erp_accounts' ? 'Standard ERP Double-Entry Ledger (8 Menus)' : 'Challan & MRR Billing Tools'}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setFinanceSystemMode('erp_accounts')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              financeSystemMode === 'erp_accounts'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ERP Accounts (8 Menus)
          </button>
          <button
            onClick={() => setFinanceSystemMode('billing_tracker')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              financeSystemMode === 'billing_tracker'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MRR & Billing Register
          </button>
        </div>
      </div>

      {financeSystemMode === 'erp_accounts' ? (
        <AccountsModule
          userProfile={userProfile}
          customerBills={bills}
          currencySymbol="$"
        />
      ) : (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-indigo-950 text-white p-6 rounded-2xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-400/30 rounded-xl flex items-center justify-center text-indigo-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Accounts & Finance Management</h1>
              <p className="text-xs text-neutral-300">
                Customer Invoicing & MRR Billing, Supplier Financial Ledgers, and Supplier Payment Vouchers
              </p>
            </div>
          </div>
        </div>

        {/* Sub navigation buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-800/80 p-1.5 rounded-xl border border-neutral-700/50">
          {(canAccessCreateBill || canAccessBillList || canAccessMrr) && (
            <div className="flex items-center gap-1 border-r border-neutral-700/60 pr-1.5 mr-0.5">
              {canAccessCreateBill && (
                <button
                  onClick={() => handleSubTabSwitch('create-bill')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeSubTab === 'create-bill'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Bill</span>
                </button>
              )}

              {canAccessBillList && (
                <button
                  onClick={() => handleSubTabSwitch('bill-list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeSubTab === 'bill-list'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Bill Register ({bills.length})</span>
                </button>
              )}

              {canAccessMrr && (
                <button
                  onClick={() => handleSubTabSwitch('mrr-status')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeSubTab === 'mrr-status'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>MRR Tracker</span>
                </button>
              )}
            </div>
          )}

          {(canAccessSupplierLedger || canAccessSupplierPayment || canAccessSupplierReport) && (
            <div className="flex items-center gap-1">
              {canAccessSupplierLedger && (
                <button
                  onClick={() => handleSubTabSwitch('supplier-ledger')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeSubTab === 'supplier-ledger'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Supplier Ledger</span>
                </button>
              )}

              {canAccessSupplierPayment && (
                <button
                  onClick={() => handleSubTabSwitch('supplier-payment')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeSubTab === 'supplier-payment'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Supplier Payment</span>
                </button>
              )}

              {canAccessSupplierReport && (
                <button
                  onClick={() => handleSubTabSwitch('supplier-report')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeSubTab === 'supplier-report'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Supplier Financials</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Supplier Ledger / Payment / Report Views */}
      {((activeSubTab === 'supplier-ledger' && canAccessSupplierLedger) || 
        (activeSubTab === 'supplier-payment' && canAccessSupplierPayment) || 
        (activeSubTab === 'supplier-report' && canAccessSupplierReport)) && (
        <SuppliersAndPurchase
          userProfile={userProfile}
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          supplierPayments={supplierPayments}
          items={items}
          showToast={showToast}
          recalculateItemStock={recalculateItemStock}
          fetchFullHistory={fetchFullHistory}
          syncAllData={syncAllData}
          isEditor={isEditor}
          initialTab={
            activeSubTab === 'supplier-ledger' ? 'ledger' :
            activeSubTab === 'supplier-payment' ? 'payment' :
            'report'
          }
          roles={roles}
          allowedPagesSet={allowedPagesSet}
          selectedSupplierIdFromParent={null}
        />
      )}

      {/* Customer Billing Views */}
      {(activeSubTab === 'create-bill' || activeSubTab === 'bill-list' || activeSubTab === 'mrr-status') && (
        <>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Total Billed</p>
            <p className="text-lg font-bold text-neutral-900">${stats.totalBilledAmount} <span className="text-xs text-neutral-400 font-normal">USD</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Total Invoices</p>
            <p className="text-lg font-bold text-neutral-900">{stats.totalBillsCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Total Dozens Billed</p>
            <p className="text-lg font-bold text-neutral-900">{stats.totalDozBilled} <span className="text-xs text-neutral-400 font-normal">Doz</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Unbilled MRRs</p>
            <p className="text-lg font-bold text-amber-600">{stats.pendingMrrsCount}</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CREATE BILL (BILL GENERATION) */}
      {/* ========================================================================= */}
      {activeSubTab === 'create-bill' && (
        <div className="space-y-6">
          {/* Customer Selection & Bill Header Config */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Step 1: Select Customer & Bill Information
              </h2>
              <span className="text-xs text-neutral-400">All available MRR receipts will load automatically</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Customer Selector */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                  Select Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setSelectedMrrIds(new Set());
                    setBillItems([]);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.customerCode ? `(${c.customerCode})` : ''}
                    </option>
                  ))}
                </select>
                {selectedCustomer && (
                  <p className="text-[11px] text-neutral-500 mt-1">
                    <span className="font-semibold">Address:</span> {selectedCustomer.address || 'N/A'} | <span className="font-semibold">Contact:</span> {selectedCustomer.contactPerson || selectedCustomer.phone || 'N/A'}
                  </p>
                )}
              </div>

              {/* Bill Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-neutral-400" />
                  Bill / Invoice No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  placeholder="e.g. BILL-2026-000001"
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              {/* Bill Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  Bill Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-neutral-100">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="45 Days">45 Days</option>
                  <option value="60 Days">60 Days</option>
                  <option value="90 Days">90 Days</option>
                  <option value="LC at Sight">LC at Sight</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Currency</label>
                <input
                  type="text"
                  value="USD ($) - United States Dollar"
                  disabled
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Remarks / Order Notes</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional billing note..."
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Available MRR Receipts Selection Table */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Step 2: Choose MRR Receipts to Include in Bill
                  {selectedCustomerId && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {availableCustomerMrrs.length} MRRs Found
                    </span>
                  )}
                </h2>
                <p className="text-xs text-neutral-500">
                  Select one or more MRR receipt challans. Quantities and Work Order prices will automatically populate.
                </p>
              </div>

              {selectedCustomerId && availableCustomerMrrs.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllMrrs}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {selectedMrrIds.size === availableCustomerMrrs.length ? 'Deselect All' : 'Select All MRRs'}
                  </button>
                </div>
              )}
            </div>

            {!selectedCustomerId ? (
              <div className="p-8 text-center border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
                <Building2 className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-neutral-600">Please select a customer above to view their MRRs</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">Only MRR receipts verified for the selected customer will be displayed.</p>
              </div>
            ) : availableCustomerMrrs.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-neutral-800">No MRR Receipts Available for {selectedCustomer?.name}</p>
                <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                  Per factory workflow, <strong>Challans cannot be billed directly without a Customer MRR Receipt</strong>. Once goods receipt is confirmed and the Customer MRR is logged, it will be eligible for billing.
                </p>
                {customerPendingMrrChallansCount > 0 && (
                  <div className="inline-block mt-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700">
                    ℹ️ {customerPendingMrrChallansCount} Delivery Challans are received & awaiting MRR logging in Despatch &gt; Customer MRR Receipt.
                  </div>
                )}
                {customerUnreceivedChallansCount > 0 && (
                  <div className="inline-block mt-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                    {customerUnreceivedChallansCount} Challans still pending customer receipt confirmation.
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Workflow Status Banner if unbilled challans without MRR exist */}
                {(customerPendingMrrChallansCount > 0 || customerUnreceivedChallansCount > 0) && (
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-900">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold">Workflow Integrity Active:</p>
                      <p className="text-[11px] text-indigo-800">
                        Only verified Customer MRR Receipts can be billed.
                        {customerPendingMrrChallansCount > 0 && ` (${customerPendingMrrChallansCount} Challans awaiting Customer MRR logging before they can be billed)`}
                        {customerUnreceivedChallansCount > 0 && ` (${customerUnreceivedChallansCount} Challans pending customer receipt)`}
                      </p>
                    </div>
                  </div>
                )}
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search MRR, Challan, PO, Item..."
                      value={mrrSearchQuery}
                      onChange={(e) => setMrrSearchQuery(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500">Show:</span>
                    <button
                      type="button"
                      onClick={() => setMrrStatusFilter('pending')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        mrrStatusFilter === 'pending'
                          ? 'bg-amber-500 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      Pending Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setMrrStatusFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        mrrStatusFilter === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      All MRRs
                    </button>
                  </div>
                </div>

                {/* MRR Table */}
                <div className="overflow-x-auto border border-neutral-200 rounded-xl max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-neutral-100/80 text-neutral-700 font-bold sticky top-0 z-10 border-b border-neutral-200">
                      <tr>
                        <th className="p-2.5 text-center w-10">Select</th>
                        <th className="p-2.5">MRR No</th>
                        <th className="p-2.5">Challan No & Date</th>
                        <th className="p-2.5">P/O No.</th>
                        <th className="p-2.5">System ID (WO)</th>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5 text-right">Challan Qty</th>
                        <th className="p-2.5 text-right font-black text-indigo-700">MRR Qty (Pcs)</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
                      {availableCustomerMrrs.map((mrr) => {
                        const isSelected = selectedMrrIds.has(mrr.id);
                        return (
                          <tr
                            key={mrr.id}
                            onClick={() => handleToggleMrrSelection(mrr)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50/70 hover:bg-indigo-100/70'
                                : 'hover:bg-neutral-50'
                            }`}
                          >
                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleMrrSelection(mrr)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-bold text-neutral-900">
                              {mrr.mrrNo}
                              <span className="block text-[10px] font-normal text-neutral-400">{mrr.mrrDate}</span>
                            </td>
                            <td className="p-2.5">
                              <span className="font-semibold text-neutral-800">{mrr.challanNo}</span>
                              <span className="block text-[10px] text-neutral-400">{mrr.challanDate}</span>
                            </td>
                            <td className="p-2.5 font-mono text-neutral-700 font-semibold">{mrr.poNo || 'N/A'}</td>
                            <td className="p-2.5 font-mono text-neutral-600">{mrr.woNumber || 'N/A'}</td>
                            <td className="p-2.5 font-semibold text-neutral-900">{mrr.productName || 'Trims'}</td>
                            <td className="p-2.5 text-right text-neutral-500">{Number(mrr.challanQty || 0).toLocaleString()}</td>
                            <td className="p-2.5 text-right font-black text-indigo-700">
                              {Number(mrr.mrrQty || 0).toLocaleString()} <span className="text-[10px] font-normal text-neutral-400">pcs</span>
                            </td>
                            <td className="p-2.5 text-center">
                              {mrr.billingStatus === 'billed' ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Billed
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Step 3: Selected Line Items in Exact Required Format */}
          {billItems.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    Step 3: Bill Items Preview & Calculation
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {billItems.length} Lines
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Format: P/O No. | System ID | Chalan No | Date | Description | Quantity (Pcs) | Quantity (Doz) | Price/Doz | Amount (USD)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBillItems([]);
                    setSelectedMrrIds(new Set());
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Items
                </button>
              </div>

              {/* Exact Required Format Table */}
              <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-900 text-white font-bold">
                    <tr>
                      <th className="p-3 text-center w-8">#</th>
                      <th className="p-3 whitespace-nowrap">P/O No.</th>
                      <th className="p-3 whitespace-nowrap">System ID</th>
                      <th className="p-3 whitespace-nowrap">Chalan No</th>
                      <th className="p-3 whitespace-nowrap">Date</th>
                      <th className="p-3 min-w-[160px]">Description</th>
                      <th className="p-3 text-right whitespace-nowrap bg-neutral-800">Quantity (Pcs)</th>
                      <th className="p-3 text-right whitespace-nowrap bg-indigo-900/80">Quantity (Doz)</th>
                      <th className="p-3 text-right whitespace-nowrap bg-indigo-900/90">Price/Doz ($)</th>
                      <th className="p-3 text-right whitespace-nowrap bg-emerald-950 font-black">Amount (USD)</th>
                      <th className="p-3 text-center w-10">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 font-medium text-neutral-800">
                    {billItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="p-3 text-center text-neutral-400 font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.poNo}
                            onChange={(e) => handleUpdateBillItem(idx, 'poNo', e.target.value)}
                            className="w-28 px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-mono font-semibold"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.systemId}
                            onChange={(e) => handleUpdateBillItem(idx, 'systemId', e.target.value)}
                            className="w-28 px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-3 font-semibold text-neutral-900 whitespace-nowrap">
                          {item.challanNo}
                        </td>
                        <td className="p-3 text-neutral-600 whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateBillItem(idx, 'description', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-semibold text-neutral-900"
                          />
                        </td>
                        {/* Quantity Pcs (From MRR) */}
                        <td className="p-3 text-right bg-neutral-50/60 font-semibold">
                          <input
                            type="number"
                            value={item.quantityPcs}
                            onChange={(e) => handleUpdateBillItem(idx, 'quantityPcs', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 bg-white border border-neutral-200 rounded text-right text-xs font-bold text-neutral-900"
                          />
                        </td>
                        {/* Quantity Dozen (Pcs / 12) */}
                        <td className="p-3 text-right bg-indigo-50/40 font-bold text-indigo-900">
                          {Number(item.quantityDoz).toFixed(2)}
                          <span className="block text-[9px] font-normal text-neutral-400">({item.quantityDoz} Doz)</span>
                        </td>
                        {/* Price/Doz ($) */}
                        <td className="p-3 text-right bg-indigo-50/60">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-neutral-400 font-bold">$</span>
                            <input
                              type="number"
                              step="0.0001"
                              value={item.pricePerDoz}
                              onChange={(e) => handleUpdateBillItem(idx, 'pricePerDoz', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 bg-white border border-indigo-300 rounded text-right text-xs font-bold text-indigo-900"
                            />
                          </div>
                          <span className="block text-[9px] text-neutral-400 mt-0.5">
                            (${Number(item.pricePerPcs).toFixed(4)}/pc)
                          </span>
                        </td>
                        {/* Amount USD (Quantity Doz * Price/Doz) */}
                        <td className="p-3 text-right bg-emerald-50/60 font-black text-emerald-700 text-sm">
                          ${Number(item.amountUSD).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBillItem(idx)}
                            className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Remove Line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals Row in Table */}
                  <tfoot className="bg-neutral-100 font-bold border-t-2 border-neutral-300 text-neutral-900">
                    <tr>
                      <td colSpan={6} className="p-3 text-right uppercase tracking-wider text-xs">
                        Total Summary:
                      </td>
                      <td className="p-3 text-right text-neutral-900 font-black">
                        {totals.totalPcs.toLocaleString()} pcs
                      </td>
                      <td className="p-3 text-right text-indigo-900 font-black">
                        {totals.totalDoz.toLocaleString()} Doz
                      </td>
                      <td className="p-3 text-right text-neutral-500 font-normal text-[11px]">
                        Avg: ${(totals.subTotalUSD / (totals.totalDoz || 1)).toFixed(2)}/doz
                      </td>
                      <td className="p-3 text-right font-black text-emerald-700 text-base">
                        ${totals.subTotalUSD.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Step 4: Summary Card & Action Buttons */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-neutral-200">
                {/* Left: Notes & In Words */}
                <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Amount in Words (USD)</p>
                    <p className="text-xs font-semibold text-indigo-900 italic bg-white p-3 rounded-lg border border-neutral-200">
                      "{totals.amountInWords}"
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Customer Invoice Info</p>
                    <p className="text-xs text-neutral-600">
                      <span className="font-semibold">Billed To:</span> {selectedCustomer?.name} | <span className="font-semibold">Terms:</span> {paymentTerms}
                    </p>
                  </div>
                </div>

                {/* Right: Calculations & Action Buttons */}
                <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>Sub-Total Amount (USD):</span>
                      <span className="font-bold text-neutral-900">${totals.subTotalUSD.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-neutral-600">VAT / Tax (%):</span>
                      <div className="flex items-center gap-1 w-24">
                        <input
                          type="number"
                          value={vatPercent}
                          onChange={(e) => setVatPercent(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-right border border-neutral-200 rounded text-xs"
                        />
                        <span className="text-neutral-400 font-bold">%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-neutral-600">Discount (USD):</span>
                      <div className="flex items-center gap-1 w-24">
                        <span className="text-neutral-400 font-bold">$</span>
                        <input
                          type="number"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-right border border-neutral-200 rounded text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-sm font-black text-emerald-800 pt-2 border-t border-neutral-200">
                      <span>Grand Total (USD):</span>
                      <span className="text-base font-black">${totals.grandTotalUSD.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Submission Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSaveBill(false)}
                      className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      Save & Create Bill
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSaveBill(true)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Save & Print Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BILL REGISTER / LIST */}
      {/* ========================================================================= */}
      {activeSubTab === 'bill-list' && (
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Customer Bill Register
              </h2>
              <p className="text-xs text-neutral-500">History of all generated customer billing invoices</p>
            </div>

            {canAccessCreateBill && canCreateBill && (
              <button
                onClick={() => setActiveSubTab('create-bill')}
                className="px-3.5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Bill</span>
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search Bill No, Customer, PO..."
                value={billListSearchQuery}
                onChange={(e) => setBillListSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={billListCustomerFilter}
              onChange={(e) => setBillListCustomerFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-xl border border-neutral-200 bg-white font-medium text-neutral-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Customers</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={billListStatusFilter}
              onChange={(e) => setBillListStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-xl border border-neutral-200 bg-white font-medium text-neutral-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="draft">Draft</option>
            </select>

            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-1/2 h-9 px-2 text-[11px] rounded-xl border border-neutral-200"
                title="From Date"
              />
              <span className="text-neutral-400">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-1/2 h-9 px-2 text-[11px] rounded-xl border border-neutral-200"
                title="To Date"
              />
            </div>
          </div>

          {/* Bills Table */}
          {isLoading ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading customer bills...
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
              <Receipt className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-neutral-600">No bills found matching the filters</p>
              {canAccessCreateBill && canCreateBill && (
                <button
                  onClick={() => setActiveSubTab('create-bill')}
                  className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
                >
                  Create First Bill
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100/90 text-neutral-700 font-bold border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Bill No & Date</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Challans & POs</th>
                    <th className="p-3 text-right">Qty (Pcs)</th>
                    <th className="p-3 text-right">Qty (Doz)</th>
                    <th className="p-3 text-right font-black text-emerald-700">Grand Total (USD)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
                  {filteredBills.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="p-3 font-bold text-neutral-900">
                        <span className="font-mono text-indigo-700">{b.billNo}</span>
                        <span className="block text-[11px] font-normal text-neutral-500">{b.billDate}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-neutral-900">{b.customerName}</span>
                        {b.customerAddress && (
                          <span className="block text-[10px] text-neutral-400 truncate max-w-xs">{b.customerAddress}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {b.items?.slice(0, 3).map((it, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-mono text-neutral-700">
                              {it.challanNo} ({it.poNo})
                            </span>
                          ))}
                          {b.items && b.items.length > 3 && (
                            <span className="text-[10px] text-neutral-400">+{b.items.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-neutral-700">
                        {Number(b.totalQtyPcs || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-bold text-indigo-900">
                        {Number(b.totalQtyDoz || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-700 text-sm">
                        ${Number(b.grandTotalUSD || b.totalAmountUSD || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          b.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : b.status === 'approved'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onCreatePI && (
                            <button
                              type="button"
                              onClick={() => onCreatePI(b.id)}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                              title="Create Proforma Invoice (PI) from this Bill"
                            >
                              <FileCheck2 className="w-3.5 h-3.5 text-purple-600" />
                              Create PI
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setViewingBill(b);
                              setIsPrintModalOpen(true);
                            }}
                            className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View / Print Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {canDeleteBill && (
                            <button
                              type="button"
                              onClick={() => setBillToDelete(b)}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Bill"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MRR BILLING TRACKER */}
      {/* ========================================================================= */}
      {activeSubTab === 'mrr-status' && (
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Customer MRR Billing Status Tracker
            </h2>
            <p className="text-xs text-neutral-500">
              Overview of all Customer MRRs showing which ones have been billed and which are pending
            </p>
          </div>

          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200">
                <tr>
                  <th className="p-3">MRR No & Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Challan No</th>
                  <th className="p-3">P/O No.</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3 text-right">MRR Qty (Pcs)</th>
                  <th className="p-3 text-right">MRR Qty (Doz)</th>
                  <th className="p-3 text-center">Billing Status</th>
                  <th className="p-3">Assigned Bill No</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
                {mrrReceipts.map((mrr) => (
                  <tr key={mrr.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-3 font-bold text-neutral-900">
                      {mrr.mrrNo}
                      <span className="block text-[10px] text-neutral-400 font-normal">{mrr.mrrDate}</span>
                    </td>
                    <td className="p-3 font-semibold text-neutral-900">{mrr.customerName}</td>
                    <td className="p-3 font-mono text-neutral-700">{mrr.challanNo}</td>
                    <td className="p-3 font-mono text-neutral-600">{mrr.poNo || 'N/A'}</td>
                    <td className="p-3">{mrr.productName}</td>
                    <td className="p-3 text-right font-black text-neutral-900">
                      {Number(mrr.mrrQty || 0).toLocaleString()} pcs
                    </td>
                    <td className="p-3 text-right font-bold text-indigo-900">
                      {(Number(mrr.mrrQty || 0) / 12).toFixed(2)} Doz
                    </td>
                    <td className="p-3 text-center">
                      {mrr.billingStatus === 'billed' ? (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Billed
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Unbilled / Pending
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-indigo-700 font-bold">
                      {(mrr as any).billNo || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE BILL / INVOICE MODAL */}
      {/* ========================================================================= */}
      {isPrintModalOpen && viewingBill && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-neutral-200 space-y-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0">
            {/* Modal Control Header (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-neutral-900 text-base">Customer Bill / Commercial Invoice Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                {onCreatePI && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintModalOpen(false);
                      onCreatePI(viewingBill.id);
                    }}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <FileCheck2 className="w-4 h-4" /> Create PI for this Bill
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => printElement('printable-customer-bill', { title: `Invoice_${viewingBill?.billNumber || 'Doc'}` })}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    setViewingBill(null);
                  }}
                  className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div id="printable-customer-bill" className="printable-doc p-8 bg-white border border-neutral-200 rounded-xl space-y-6 text-neutral-900 print:border-none print:p-0">
              {/* Company Letterhead */}
              <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <img 
                      src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
                      className="w-12 h-12 object-contain" 
                      alt="ES Trims"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                    />
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-neutral-900 uppercase">ES TRIMS LIMITED</h1>
                      <p className="text-[10px] text-neutral-600 font-medium">ES Trims Limited, C-15 panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400</p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-neutral-900 text-white font-black text-xs uppercase tracking-widest rounded">
                    BILL / INVOICE
                  </span>
                  <p className="text-xs font-mono font-bold text-neutral-800 mt-2">Bill No: {viewingBill.billNo}</p>
                  <p className="text-xs text-neutral-500">Date: {viewingBill.billDate}</p>
                </div>
              </div>

              {/* Billed To Customer Box */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Billed To (Customer):</p>
                  <p className="font-bold text-sm text-neutral-900">{viewingBill.customerName}</p>
                  <p className="text-neutral-600">{viewingBill.customerAddress || 'Dhaka, Bangladesh'}</p>
                </div>

                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Invoice Particulars:</p>
                  <p><span className="font-semibold text-neutral-500">Payment Terms:</span> {viewingBill.paymentTerms || '30 Days'}</p>
                  <p><span className="font-semibold text-neutral-500">Currency:</span> {viewingBill.currency || 'USD'} ($)</p>
                  {viewingBill.dueDate && <p><span className="font-semibold text-neutral-500">Due Date:</span> {viewingBill.dueDate}</p>}
                </div>
              </div>

              {/* Exact Requested Format Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-neutral-300 border-collapse">
                  <thead className="bg-neutral-100 text-neutral-900 font-bold border-b border-neutral-300">
                    <tr>
                      <th className="p-2.5 border-r border-neutral-300 text-center w-8">#</th>
                      <th className="p-2.5 border-r border-neutral-300">P/O No.</th>
                      <th className="p-2.5 border-r border-neutral-300">System ID</th>
                      <th className="p-2.5 border-r border-neutral-300">Chalan No</th>
                      <th className="p-2.5 border-r border-neutral-300">Date</th>
                      <th className="p-2.5 border-r border-neutral-300">Description</th>
                      <th className="p-2.5 border-r border-neutral-300 text-right">Quantity</th>
                      <th className="p-2.5 border-r border-neutral-300 text-right">Quantity (Doz)</th>
                      <th className="p-2.5 border-r border-neutral-300 text-right">Price/Doz</th>
                      <th className="p-2.5 text-right font-black">Amount (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-300 font-medium text-neutral-800">
                    {viewingBill.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 border-r border-neutral-300 text-center font-bold text-neutral-500">{idx + 1}</td>
                        <td className="p-2.5 border-r border-neutral-300 font-mono font-semibold">{item.poNo}</td>
                        <td className="p-2.5 border-r border-neutral-300 font-mono text-neutral-600">{item.systemId}</td>
                        <td className="p-2.5 border-r border-neutral-300 font-semibold">{item.challanNo}</td>
                        <td className="p-2.5 border-r border-neutral-300 whitespace-nowrap">{item.date}</td>
                        <td className="p-2.5 border-r border-neutral-300 font-semibold text-neutral-900">{item.description}</td>
                        <td className="p-2.5 border-r border-neutral-300 text-right font-semibold">{Number(item.quantityPcs).toLocaleString()}</td>
                        <td className="p-2.5 border-r border-neutral-300 text-right font-bold text-neutral-900">{Number(item.quantityDoz).toFixed(2)}</td>
                        <td className="p-2.5 border-r border-neutral-300 text-right font-bold">${Number(item.pricePerDoz).toFixed(4)}</td>
                        <td className="p-2.5 text-right font-black text-neutral-900">${Number(item.amountUSD).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals Footer */}
                  <tfoot className="bg-neutral-100 font-bold border-t-2 border-neutral-400 text-neutral-900">
                    <tr>
                      <td colSpan={6} className="p-2.5 border-r border-neutral-300 text-right uppercase tracking-wider">
                        Total:
                      </td>
                      <td className="p-2.5 border-r border-neutral-300 text-right font-black">
                        {Number(viewingBill.totalQtyPcs).toLocaleString()} pcs
                      </td>
                      <td className="p-2.5 border-r border-neutral-300 text-right font-black">
                        {Number(viewingBill.totalQtyDoz).toFixed(2)} Doz
                      </td>
                      <td className="p-2.5 border-r border-neutral-300 text-right"></td>
                      <td className="p-2.5 text-right font-black text-sm">
                        ${Number(viewingBill.totalAmountUSD).toFixed(2)}
                      </td>
                    </tr>
                    {viewingBill.vatAmount && viewingBill.vatAmount > 0 ? (
                      <tr>
                        <td colSpan={9} className="p-2 border-r border-neutral-300 text-right">
                          VAT ({viewingBill.vatPercent}%):
                        </td>
                        <td className="p-2 text-right font-bold">${Number(viewingBill.vatAmount).toFixed(2)}</td>
                      </tr>
                    ) : null}
                    {viewingBill.discountAmount && viewingBill.discountAmount > 0 ? (
                      <tr>
                        <td colSpan={9} className="p-2 border-r border-neutral-300 text-right">
                          Discount:
                        </td>
                        <td className="p-2 text-right font-bold">-${Number(viewingBill.discountAmount).toFixed(2)}</td>
                      </tr>
                    ) : null}
                    <tr className="bg-neutral-200 text-black">
                      <td colSpan={9} className="p-2.5 border-r border-neutral-400 text-right font-black uppercase text-xs">
                        Grand Total (USD):
                      </td>
                      <td className="p-2.5 text-right font-black text-base">
                        ${Number(viewingBill.grandTotalUSD || viewingBill.totalAmountUSD).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Amount In Words */}
              <div className="text-xs bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <span className="font-bold text-neutral-500 uppercase tracking-wider">In Words: </span>
                <span className="font-bold text-neutral-900 italic">
                  {viewingBill.amountInWords || numberToWords(viewingBill.grandTotalUSD || viewingBill.totalAmountUSD)}
                </span>
              </div>

              {/* Signatures Footer */}
              <div className="pt-16 grid grid-cols-4 gap-4 text-center text-xs font-semibold text-neutral-700">
                <div className="border-t border-neutral-400 pt-1">
                  <p>Prepared By</p>
                  <p className="text-[10px] text-neutral-400 font-normal">{viewingBill.createdBy || 'Accounts'}</p>
                </div>
                <div className="border-t border-neutral-400 pt-1">
                  <p>Checked By</p>
                </div>
                <div className="border-t border-neutral-400 pt-1">
                  <p>Accounts Officer</p>
                </div>
                <div className="border-t border-neutral-400 pt-1">
                  <p>Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {billToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900">Delete Bill {billToDelete.billNo}?</h3>
              <p className="text-xs text-neutral-500">
                This will delete the bill and revert all attached MRR receipts back to "Pending" status so they can be re-billed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setBillToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBill}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
        </div>
      )}
    </div>
  );
}
