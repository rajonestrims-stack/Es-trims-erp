import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  getDocs,
  deleteField,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Users, 
  UserPlus,
  Building2, 
  Package, 
  DollarSign, 
  Gift,
  RotateCcw, 
  Layers, 
  ChevronRight, 
  ArrowLeft, 
  Eye, 
  Printer, 
  FileText, 
  Calendar, 
  Tag, 
  X,
  ShieldAlert,
  RefreshCw,
  Sliders,
  Phone,
  Mail,
  MapPin,
  Check,
  Copy,
  BarChart3,
  Filter,
  Sparkles,
  Globe,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  GitMerge,
  Workflow,
  ExternalLink,
  Save,
  Calculator
} from 'lucide-react';
import Papa from 'papaparse';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  UserProfile, 
  Customer, 
  Buyer, 
  SectionMaster, 
  ProductionProcessMaster,
  FinishedGoods, 
  FgCategory,
  FgSubCategory,
  CurrencyMaster, 
  PriceMaster, 
  CustomerOrder, 
  WorkOrder,
  WorkOrderProcessStep,
  WorkOrderBreakdownRow,
  WorkOrderAuditLog,
  SizeMaster,
  ColorMaster,
  ApprovalRequest,
  DeliveryChallanRecord,
  GatePassRecord,
  BomMaster,
  Item,
  RoleDefinition
} from '../types';
import { CustomerMrrReceiptView } from './CustomerMrrReceiptView';
import { BookingReportView } from './BookingReportView';
import { SalesReportView } from './SalesReportView';
import { checkPageApprovalRule, submitDocumentForApproval } from '../services/approvalService';
import { checkActionPermission, isUserSuperAdmin } from '../admin/adminUtils';

interface SalesOrderEntryProps {
  userProfile: UserProfile;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeSubTab?: 'entry' | 'create' | 'list' | 'rectify-requests' | 'mrr-receipt' | 'booking-report' | 'sales-report' | 'currency-master' | 'price-master' | 'buyer-master' | 'customer-master' | 'fg-master' | 'category-master' | 'subcategory-master' | 'section-master' | 'process-master';
  onSubTabChange?: (tab: string) => void;
  allowedPagesSet?: Set<string>;
  roles?: RoleDefinition[];
}

export const getCurrencySymbol = (code?: string) => {
  if (!code) return '৳';
  const upper = code.toUpperCase();
  switch (upper) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'BDT': return '৳';
    case 'INR': return '₹';
    default: return code;
  }
};

export function SalesOrderEntry({ 
  userProfile, 
  showToast, 
  activeSubTab = 'entry', 
  onSubTabChange,
  allowedPagesSet,
  roles = []
}: SalesOrderEntryProps) {
  const isSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com';

  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  const availableTabs = useMemo(() => {
    const tabs: ('entry' | 'create' | 'list' | 'mrr-receipt' | 'customer-master' | 'buyer-master' | 'currency-master' | 'price-master' | 'fg-master' | 'category-master' | 'subcategory-master' | 'section-master' | 'process-master' | 'booking-report' | 'sales-report' | 'rectify-requests')[] = [];
    if (isPagePermitted('sales-order-entry') || isPagePermitted('sales-create-order') || isPagePermitted('sales')) tabs.push('entry');
    if (isPagePermitted('sales-order-list')) tabs.push('list');
    if (isPagePermitted('sales-mrr-receipt')) tabs.push('mrr-receipt');
    if (isPagePermitted('sales-customer-master')) tabs.push('customer-master');
    if (isPagePermitted('sales-buyer-master')) tabs.push('buyer-master');
    if (isPagePermitted('sales-currency-master') || isPagePermitted('sales-price-master') || isSuperAdmin) tabs.push('currency-master');
    if (isPagePermitted('sales-price-master')) tabs.push('price-master');
    if (isPagePermitted('sales-fg-master')) tabs.push('fg-master');
    if (isPagePermitted('sales-category-master')) tabs.push('category-master');
    if (isPagePermitted('sales-subcategory-master')) tabs.push('subcategory-master');
    if (isPagePermitted('sales-section-master')) tabs.push('section-master');
    if (isPagePermitted('sales-process-master')) tabs.push('process-master');
    if (isPagePermitted('sales-booking-report')) tabs.push('booking-report');
    if (isPagePermitted('sales-sales-report')) tabs.push('sales-report');
    if (isPagePermitted('sales-rectify-requests') || isPagePermitted('sales-order-entry') || isPagePermitted('sales')) tabs.push('rectify-requests');
    return tabs;
  }, [isSuperAdmin, allowedPagesSet]);

  const [subTab, setSubTab] = useState<'entry' | 'create' | 'list' | 'rectify-requests' | 'mrr-receipt' | 'booking-report' | 'sales-report' | 'price-master' | 'currency-master' | 'buyer-master' | 'customer-master' | 'fg-master' | 'section-master' | 'category-master' | 'subcategory-master' | 'process-master'>(() => {
    const initial = activeSubTab === 'create' ? 'entry' : activeSubTab;
    if (availableTabs.length > 0 && !availableTabs.includes(initial as any)) {
      return availableTabs[0];
    }
    return initial;
  });

  useEffect(() => {
    const next = activeSubTab === 'create' ? 'entry' : activeSubTab;
    if (availableTabs.length > 0 && !availableTabs.includes(next as any)) {
      setSubTab(availableTabs[0]);
    } else {
      setSubTab(next);
    }
  }, [activeSubTab, availableTabs]);

  const handleTabChange = (tab: typeof subTab) => {
    setSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // --- Realtime Firestore Collections State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [sections, setSections] = useState<SectionMaster[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGoods[]>([]);
  const [fgCategories, setFgCategories] = useState<FgCategory[]>([]);
  const [fgSubCategories, setFgSubCategories] = useState<FgSubCategory[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyMaster[]>([]);
  const [priceMasters, setPriceMasters] = useState<PriceMaster[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [productionProcesses, setProductionProcesses] = useState<ProductionProcessMaster[]>([]);
  const [sizes, setSizes] = useState<SizeMaster[]>([]);
  const [colors, setColors] = useState<ColorMaster[]>([]);
  const [challans, setChallans] = useState<DeliveryChallanRecord[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePassRecord[]>([]);
  const [boms, setBoms] = useState<BomMaster[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Current Editing Work Order Form State ---
  const [editingWoId, setEditingWoId] = useState<string | null>(null);
  const [woNumber, setWoNumber] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  
  // Header Selections
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedFgId, setSelectedFgId] = useState('');
  const [headerStyle, setHeaderStyle] = useState('');
  const [orderCurrencyCode, setOrderCurrencyCode] = useState('BDT');
  const [orderCurrencyId, setOrderCurrencyId] = useState('');
  const [orderConversionRate, setOrderConversionRate] = useState<number>(1);
  
  // Rectify Order Request State
  const [showRectifyModal, setShowRectifyModal] = useState(false);
  const [rectifyTargetWo, setRectifyTargetWo] = useState<WorkOrder | null>(null);
  const [rectifyWoSearch, setRectifyWoSearch] = useState('');
  const [rectifyRemarks, setRectifyRemarks] = useState('');
  const [isSubmittingRectify, setIsSubmittingRectify] = useState(false);
  
  // Production Process Steps State for Work Order Routing
  const [selectedWoProcesses, setSelectedWoProcesses] = useState<WorkOrderProcessStep[]>([]);
  
  // Manual Price Override State
  const [manualPriceRate, setManualPriceRate] = useState<number | ''>('');
  const [isManualPriceOverride, setIsManualPriceOverride] = useState(false);

  // Free of Cost (FOC) State
  const [isFreeOfCost, setIsFreeOfCost] = useState(false);
  const [focRefJobNo, setFocRefJobNo] = useState('');
  const [focRemark, setFocRemark] = useState('');
  const [focSearchQuery, setFocSearchQuery] = useState('');

  // Selected Finished Goods Items for this Work Order
  const [selectedFgItems, setSelectedFgItems] = useState<{
    id: string; // fgId
    fgNo: string;
    fgName: string;
    unit: string;
    rate: number;
    currencyCode?: string;
    currencyId?: string;
    priceSource: string;
    style?: string;
  }[]>([]);

  // Breakdown Rows State
  const [breakdownRows, setBreakdownRows] = useState<WorkOrderBreakdownRow[]>([]);
  
  // Single Row Input Fields for "+ Add Row"
  const [rowFgId, setRowFgId] = useState('');
  const [rowJobNo, setRowJobNo] = useState('');
  const [rowStyle, setRowStyle] = useState('');
  const [rowColor, setRowColor] = useState('');
  const [rowSize, setRowSize] = useState('');
  const [rowOrderNo, setRowOrderNo] = useState('');
  const [rowQty, setRowQty] = useState<number | ''>('');
  const [rowUnit, setRowUnit] = useState('');
  const [rowRate, setRowRate] = useState<number | ''>('');

  // Status & Lock
  const [woStatus, setWoStatus] = useState<'draft' | 'confirmed' | 'pending_approval' | 'approved' | 'rejected' | 'returned' | 'cancelled' | 'closed'>('draft');
  const [woAuditLogs, setWoAuditLogs] = useState<WorkOrderAuditLog[]>([]);

  // Modals & Views
  const [showWoListModal, setShowWoListModal] = useState(false);
  const [showWoDetailsModal, setShowWoDetailsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCsvValidationModal, setShowCsvValidationModal] = useState(false);
  const [viewingWo, setViewingWo] = useState<WorkOrder | null>(null);

  // --- UNIFIED ACTION CONFIRMATION MODAL STATE ---
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'delete' | 'update' | 'confirm' | 'warning';
    confirmText?: string;
    cancelText?: string;
    details?: { label: string; value: string }[];
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'update',
    onConfirm: () => {}
  });

  const requestActionConfirmation = (config: {
    title: string;
    message: string;
    type?: 'delete' | 'update' | 'confirm' | 'warning';
    confirmText?: string;
    cancelText?: string;
    details?: { label: string; value: string }[];
    onConfirm: () => void | Promise<void>;
  }) => {
    setConfirmDialog({
      isOpen: true,
      title: config.title,
      message: config.message,
      type: config.type || 'update',
      confirmText: config.confirmText,
      cancelText: config.cancelText,
      details: config.details,
      onConfirm: config.onConfirm
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const executeConfirmDialogAction = async () => {
    const action = confirmDialog.onConfirm;
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    if (action) {
      await action();
    }
  };

  // CSV Import Validation State
  const [csvParsedRows, setCsvParsedRows] = useState<any[]>([]);
  const [csvValidRows, setCsvValidRows] = useState<WorkOrderBreakdownRow[]>([]);
  const [csvErrorLogs, setCsvErrorLogs] = useState<{ line: number; row: any; error: string }[]>([]);

  // Modals for Masters
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [showAddFgModal, setShowAddFgModal] = useState(false);
  const [showAddPriceModal, setShowAddPriceModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddSubCategoryModal, setShowAddSubCategoryModal] = useState(false);
  const [showAddProcessModal, setShowAddProcessModal] = useState(false);
  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);

  // Master Editing targets
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [editingSection, setEditingSection] = useState<SectionMaster | null>(null);
  const [editingProcess, setEditingProcess] = useState<ProductionProcessMaster | null>(null);
  const [editingFg, setEditingFg] = useState<FinishedGoods | null>(null);
  const [editingPrice, setEditingPrice] = useState<PriceMaster | null>(null);
  const [editingCategory, setEditingCategory] = useState<FgCategory | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<FgSubCategory | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyMaster | null>(null);

  // Form States for Modals
  const [newCustCode, setNewCustCode] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustContact, setNewCustContact] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustCountry, setNewCustCountry] = useState('Bangladesh');
  const [newCustPaymentTerms, setNewCustPaymentTerms] = useState('30 Days Credit');
  const [newCustDeliveryTerms, setNewCustDeliveryTerms] = useState('FOB Dhaka');
  const [newCustDefaultCurrency, setNewCustDefaultCurrency] = useState('BDT');
  const [newCustConversionRate, setNewCustConversionRate] = useState('1');

  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState<number | ''>('');
  const [selectedCurrencyIds, setSelectedCurrencyIds] = useState<string[]>([]);
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');

  const [newBuyerCode, setNewBuyerCode] = useState('');
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newBuyerCustId, setNewBuyerCustId] = useState('');
  const [newBuyerContact, setNewBuyerContact] = useState('');
  const [newBuyerPhone, setNewBuyerPhone] = useState('');
  const [newBuyerEmail, setNewBuyerEmail] = useState('');

  const [newSectionCode, setNewSectionCode] = useState('');
  const [newSectionName, setNewSectionName] = useState('');

  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [newSubCatCatId, setNewSubCatCatId] = useState('');
  const [newSubCatCode, setNewSubCatCode] = useState('');
  const [newSubCatName, setNewSubCatName] = useState('');
  const [newSubCatDesc, setNewSubCatDesc] = useState('');

  const [newFgNo, setNewFgNo] = useState('');
  const [newFgName, setNewFgName] = useState('');
  const [newFgCustId, setNewFgCustId] = useState('');
  const [newFgCustName, setNewFgCustName] = useState('');
  const [newFgCatId, setNewFgCatId] = useState('');
  const [newFgCatName, setNewFgCatName] = useState('');
  const [newFgSubCatId, setNewFgSubCatId] = useState('');
  const [newFgSubCatName, setNewFgSubCatName] = useState('');
  const [newFgUnit, setNewFgUnit] = useState('PCS');
  const [newFgPrice, setNewFgPrice] = useState<number | ''>('');
  const [newFgSpec, setNewFgSpec] = useState('');

  const [newPriceCustId, setNewPriceCustId] = useState('');
  const [newPriceFgId, setNewPriceFgId] = useState('');
  const [newPriceStyle, setNewPriceStyle] = useState('');
  const [newPriceCurrId, setNewPriceCurrId] = useState('');
  const [newPriceCurrCode, setNewPriceCurrCode] = useState('BDT');
  const [newPriceUnit, setNewPriceUnit] = useState('PCS');
  const [newPriceRate, setNewPriceRate] = useState<number | ''>('');
  const [newPriceEffDate, setNewPriceEffDate] = useState(new Date().toISOString().split('T')[0]);

  // Customer Master CSV Upload Ref
  const customerCsvInputRef = useRef<HTMLInputElement>(null);

  // Search & Filters
  const [woSearchTerm, setWoSearchTerm] = useState('');
  const [woStatusFilter, setWoStatusFilter] = useState('all');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [buyerSearchTerm, setBuyerSearchTerm] = useState('');
  const [fgSearchTerm, setFgSearchTerm] = useState('');
  const [fgCustomerFilter, setFgCustomerFilter] = useState('');
  const [sectionSearchTerm, setSectionSearchTerm] = useState('');
  const [priceSearchTerm, setPriceSearchTerm] = useState('');
  const [processSearchTerm, setProcessSearchTerm] = useState('');
  const [selectedProcessSectionFilter, setSelectedProcessSectionFilter] = useState('');
  const [currencySearchTerm, setCurrencySearchTerm] = useState('');
  const [quickCustRates, setQuickCustRates] = useState<Record<string, { currency?: string; rate?: number }>>({});
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [calcCustomerId, setCalcCustomerId] = useState<string>('');
  const [calcCurrency, setCalcCurrency] = useState<string>('USD');

  // Form States for Process Modal
  const [newProcessCode, setNewProcessCode] = useState('');
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessSectionId, setNewProcessSectionId] = useState('');
  const [newProcessSeq, setNewProcessSeq] = useState<number | ''>(1);
  const [newProcessDesc, setNewProcessDesc] = useState('');

  // Rejection comment
  const [rejectionComment, setRejectionComment] = useState('');

  // --- QUICK SEARCH STATE (WO No / Sales Order / Customer PO No) ---
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [showQuickSearchDropdown, setShowQuickSearchDropdown] = useState(false);

  // Quick search autocomplete results
  const quickSearchMatches = useMemo(() => {
    if (!quickSearchQuery.trim()) return [];
    const q = quickSearchQuery.trim().toLowerCase();
    return workOrders.filter(w =>
      w.woNumber?.toLowerCase().includes(q) ||
      w.orderNo?.toLowerCase().includes(q) ||
      w.poNo?.toLowerCase().includes(q) ||
      w.customerName?.toLowerCase().includes(q) ||
      w.buyerName?.toLowerCase().includes(q) ||
      w.style?.toLowerCase().includes(q) ||
      w.finishedGoodsName?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [quickSearchQuery, workOrders]);

  const handleSelectQuickSearchWo = (wo: WorkOrder) => {
    handleLoadWorkOrder(wo);
    setQuickSearchQuery('');
    setShowQuickSearchDropdown(false);
    showToast(`Loaded Work Order ${wo.woNumber} into Entry Form`, 'success');
  };

  // --- Firestore Subscriptions & Initial Seeds ---
  useEffect(() => {
    if (!userProfile?.businessId) return;

    setIsLoading(true);
    const bId = userProfile.businessId;

    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('businessId', '==', bId)), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    }, (err) => console.warn('Customers listener error:', err));

    const unsubBuyers = onSnapshot(query(collection(db, 'buyers'), where('businessId', '==', bId)), (snap) => {
      setBuyers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Buyer)));
    }, (err) => console.warn('Buyers listener error:', err));

    const unsubSections = onSnapshot(query(collection(db, 'sections'), where('businessId', '==', bId)), (snap) => {
      setSections(snap.docs.map(d => ({ id: d.id, ...d.data() } as SectionMaster)));
    }, (err) => console.warn('Sections listener error:', err));

    const unsubFG = onSnapshot(query(collection(db, 'finished_goods'), where('businessId', '==', bId)), (snap) => {
      setFinishedGoods(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinishedGoods)));
    }, (err) => console.warn('Finished Goods listener error:', err));

    const unsubCategories = onSnapshot(query(collection(db, 'fg_categories'), where('businessId', '==', bId)), (snap) => {
      setFgCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as FgCategory)));
    }, (err) => console.warn('FG Categories listener error:', err));

    const unsubSubCategories = onSnapshot(query(collection(db, 'fg_subcategories'), where('businessId', '==', bId)), (snap) => {
      setFgSubCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as FgSubCategory)));
    }, (err) => console.warn('FG SubCategories listener error:', err));

    const unsubCurrencies = onSnapshot(query(collection(db, 'currencies'), where('businessId', '==', bId)), (snap) => {
      setCurrencies(snap.docs.map(d => ({ id: d.id, ...d.data() } as CurrencyMaster)));
    }, (err) => console.warn('Currencies listener error:', err));

    const unsubPrices = onSnapshot(query(collection(db, 'price_masters'), where('businessId', '==', bId)), (snap) => {
      setPriceMasters(snap.docs.map(d => ({ id: d.id, ...d.data() } as PriceMaster)));
    }, (err) => console.warn('Price Masters listener error:', err));

    const unsubWOs = onSnapshot(query(collection(db, 'work_orders'), where('businessId', '==', bId)), (snap) => {
      setWorkOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder)));
      setIsLoading(false);
    }, (err) => console.warn('Work Orders listener error:', err));

    const unsubApprovals = onSnapshot(query(collection(db, 'approvalRequests'), where('businessId', '==', bId)), (snap) => {
      setApprovalRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest)));
    }, (err) => console.warn('Approval Requests listener error:', err));

    const unsubSizes = onSnapshot(query(collection(db, 'sizes'), where('businessId', '==', bId)), (snap) => {
      setSizes(snap.docs.map(d => ({ id: d.id, ...d.data() } as SizeMaster)));
    }, (err) => console.warn('Sizes listener error:', err));

    const unsubColors = onSnapshot(query(collection(db, 'colors'), where('businessId', '==', bId)), (snap) => {
      setColors(snap.docs.map(d => ({ id: d.id, ...d.data() } as ColorMaster)));
    }, (err) => console.warn('Colors listener error:', err));

    const unsubProcesses = onSnapshot(query(collection(db, 'production_processes'), where('businessId', '==', bId)), (snap) => {
      setProductionProcesses(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionProcessMaster)));
    }, (err) => console.warn('Production processes listener error:', err));

    const unsubChallans = onSnapshot(query(collection(db, 'delivery_challans'), where('businessId', '==', bId)), (snap) => {
      setChallans(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryChallanRecord)));
    }, (err) => console.warn('Delivery challans listener error:', err));

    const unsubGatePasses = onSnapshot(query(collection(db, 'gate_passes'), where('businessId', '==', bId)), (snap) => {
      setGatePasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as GatePassRecord)));
    }, (err) => console.warn('Gate passes listener error:', err));

    const unsubBoms = onSnapshot(query(collection(db, 'boms'), where('businessId', '==', bId)), (snap) => {
      setBoms(snap.docs.map(d => ({ id: d.id, ...d.data() } as BomMaster)));
    }, (err) => console.warn('BOMs listener error:', err));

    const unsubItems = onSnapshot(query(collection(db, 'items'), where('businessId', '==', bId)), (snap) => {
      setInventoryItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Item)));
    }, (err) => console.warn('Items listener error:', err));

    return () => {
      unsubCustomers();
      unsubBuyers();
      unsubSections();
      unsubFG();
      unsubCategories();
      unsubSubCategories();
      unsubCurrencies();
      unsubPrices();
      unsubWOs();
      unsubApprovals();
      unsubSizes();
      unsubColors();
      unsubProcesses();
      unsubChallans();
      unsubGatePasses();
      unsubBoms();
      unsubItems();
    };
  }, [userProfile?.businessId]);

  // Master data is managed explicitly by user input; no auto-seeding


  // Derive Currently Selected Master Objects
  const selectedCustomerObj = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const availableBuyers = useMemo(() => {
    if (!selectedCustomerId) return buyers;
    return buyers.filter(b => !b.customerId || b.customerId === selectedCustomerId);
  }, [buyers, selectedCustomerId]);

  const selectedBuyerObj = useMemo(() => {
    return buyers.find(b => b.id === selectedBuyerId) || null;
  }, [buyers, selectedBuyerId]);

  const selectedFgObj = useMemo(() => {
    return finishedGoods.find(f => f.id === selectedFgId) || null;
  }, [finishedGoods, selectedFgId]);

  const availableFinishedGoods = useMemo(() => {
    if (!selectedCustomerId) return finishedGoods;
    return finishedGoods.filter(f => f.customerId === selectedCustomerId);
  }, [finishedGoods, selectedCustomerId]);

  const selectedSectionObj = useMemo(() => {
    return sections.find(s => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  // Sync Default Unit when FG changes
  useEffect(() => {
    if (selectedFgObj?.unit) {
      setRowUnit(selectedFgObj.unit);
    }
  }, [selectedFgObj]);

  // Auto-sync Customer Default Currency and Conversion Rate if set
  useEffect(() => {
    if (selectedCustomerObj?.defaultCurrency) {
      setOrderCurrencyCode(selectedCustomerObj.defaultCurrency);
      const custRate = Number(selectedCustomerObj.conversionRate ?? selectedCustomerObj.conversionRateBDT);
      if (custRate && !isNaN(custRate) && custRate > 0) {
        setOrderConversionRate(custRate);
      } else if (selectedCustomerObj.defaultCurrency === 'BDT') {
        setOrderConversionRate(1);
      } else {
        const currObj = currencies.find(c => (c.code || '').toUpperCase() === selectedCustomerObj.defaultCurrency?.toUpperCase());
        setOrderConversionRate(currObj?.exchangeRateToBDT || currObj?.rateToBDT || 1);
      }
    }
  }, [selectedCustomerObj, currencies]);

  // Price Lookup Helper for any specific style & finished goods item
  const getPriceForStyleAndItem = (specificStyle?: string, specificFgId?: string) => {
    const targetFgId = specificFgId || rowFgId || selectedFgId;
    const targetFgObj = finishedGoods.find(f => f.id === targetFgId) || selectedFgObj;
    const targetCustObj = customers.find(c => c.id === selectedCustomerId) || selectedCustomerObj;

    if (!selectedCustomerId || (!targetFgId && !targetFgObj)) {
      const selectedFgItem = selectedFgItems.find(i => i.id === targetFgId);
      if (selectedFgItem) return { rate: selectedFgItem.rate, currencyCode: selectedFgItem.currencyCode || orderCurrencyCode || 'BDT', currencyId: selectedFgItem.currencyId || orderCurrencyId || '', unit: selectedFgItem.unit || targetFgObj?.unit || 'PCS', source: selectedFgItem.priceSource };
      if (targetFgObj?.defaultPrice) return { rate: Number(targetFgObj.defaultPrice), currencyCode: 'BDT', currencyId: '', unit: targetFgObj.unit || 'PCS', source: 'Item Price' };
      return { rate: activeEffectiveRate?.rate || 0, currencyCode: activeEffectiveRate?.currencyCode || orderCurrencyCode || 'BDT', currencyId: activeEffectiveRate?.currencyId || orderCurrencyId || '', unit: (activeEffectiveRate as any)?.unit || targetFgObj?.unit || 'PCS', source: activeEffectiveRate?.source || 'None' };
    }

    // Filter matching Price Master rules for this Customer and Finished Goods
    const matchingRules = priceMasters.filter(p => {
      const custMatch = p.customerId === selectedCustomerId ||
        (targetCustObj && p.customerName && p.customerName.trim().toLowerCase() === targetCustObj.name.trim().toLowerCase()) ||
        (targetCustObj && targetCustObj.customerCode && p.customerCode && p.customerCode.trim().toLowerCase() === targetCustObj.customerCode.trim().toLowerCase());
      
      const fgMatch = (targetFgId && p.finishedGoodsId === targetFgId) ||
        (targetFgObj && p.finishedGoodsNo && p.finishedGoodsNo.trim().toLowerCase() === targetFgObj.fgNo.trim().toLowerCase()) ||
        (targetFgObj && p.finishedGoodsName && p.finishedGoodsName.trim().toLowerCase() === targetFgObj.name.trim().toLowerCase());
      
      const statusActive = !p.status || p.status.toLowerCase() === 'active';

      return custMatch && fgMatch && statusActive;
    });

    if (matchingRules.length > 0) {
      const targetStyle = (specificStyle || rowStyle || headerStyle || '').trim().toLowerCase();

      // 1. Style-specific match in Price Master
      if (targetStyle) {
        const styleMatch = matchingRules.find(p => p.style && p.style.trim().toLowerCase() === targetStyle);
        if (styleMatch) {
          return { rate: Number(styleMatch.rate), currencyCode: styleMatch.currencyCode || 'BDT', currencyId: styleMatch.currencyId || '', unit: styleMatch.unit || targetFgObj?.unit || 'PCS', source: 'Customer + Style Price' };
        }
      }

      // 2. General style rule (blank or general)
      const generalMatch = matchingRules.find(p => !p.style || p.style.trim() === '' || p.style.toLowerCase().includes('general'));
      if (generalMatch) {
        return { rate: Number(generalMatch.rate), currencyCode: generalMatch.currencyCode || 'BDT', currencyId: generalMatch.currencyId || '', unit: generalMatch.unit || targetFgObj?.unit || 'PCS', source: 'Customer Price' };
      }

      // 3. Fallback to any matching Price Master rule for this Customer & FG
      const firstRule = matchingRules[0];
      return { rate: Number(firstRule.rate), currencyCode: firstRule.currencyCode || 'BDT', currencyId: firstRule.currencyId || '', unit: firstRule.unit || targetFgObj?.unit || 'PCS', source: 'Customer Price' };
    }

    // 4. Finished Goods Default Base Item Price from Item Master
    if (targetFgObj && targetFgObj.defaultPrice && Number(targetFgObj.defaultPrice) > 0) {
      return { rate: Number(targetFgObj.defaultPrice), currencyCode: 'BDT', currencyId: '', unit: targetFgObj.unit || 'PCS', source: 'Item Price' };
    }

    // 5. Selected FG Item cached rate if set
    const selectedFgItem = selectedFgItems.find(i => i.id === targetFgId);
    if (selectedFgItem && selectedFgItem.rate >= 0) {
      return { rate: selectedFgItem.rate, currencyCode: selectedFgItem.currencyCode || orderCurrencyCode || 'BDT', currencyId: selectedFgItem.currencyId || orderCurrencyId || '', unit: selectedFgItem.unit || targetFgObj?.unit || 'PCS', source: selectedFgItem.priceSource || 'Selected Item Price' };
    }

    return { rate: activeEffectiveRate?.rate || 0, currencyCode: activeEffectiveRate?.currencyCode || orderCurrencyCode || 'BDT', currencyId: activeEffectiveRate?.currencyId || orderCurrencyId || '', unit: (activeEffectiveRate as any)?.unit || targetFgObj?.unit || 'PCS', source: activeEffectiveRate?.source || 'Manual Required' };
  };

  // --- FOC HANDLERS ---
  const handleToggleFreeOfCost = (foc: boolean) => {
    setIsFreeOfCost(foc);
    if (foc) {
      setBreakdownRows(prev => prev.map(r => ({
        ...r,
        rate: 0,
        total: 0,
        priceSource: 'Free of Cost (FOC)'
      })));
      setSelectedFgItems(prev => prev.map(i => ({
        ...i,
        rate: 0,
        priceSource: 'Free of Cost (FOC)'
      })));
      showToast('Free of Cost mode activated. Sell price set to ৳ 0.00.', 'info');
    } else {
      setFocRefJobNo('');
      setFocRemark('');
      setFocSearchQuery('');
      showToast('Free of Cost mode deactivated.', 'info');
    }
  };

  const handleSelectFocReferenceJob = (refWo: WorkOrder) => {
    setFocRefJobNo(refWo.woNumber || refWo.orderNo || '');
    
    if (refWo.customerId) setSelectedCustomerId(refWo.customerId);
    if (refWo.buyerId) setSelectedBuyerId(refWo.buyerId);
    if (refWo.sectionId) setSelectedSectionId(refWo.sectionId);
    if (refWo.finishedGoodsId) setSelectedFgId(refWo.finishedGoodsId);
    if (refWo.style) setHeaderStyle(refWo.style);
    if (refWo.poNo) setPoNo(refWo.poNo);

    if (refWo.breakdownRows && refWo.breakdownRows.length > 0) {
      const zeroBreakdowns: WorkOrderBreakdownRow[] = refWo.breakdownRows.map(r => ({
        ...r,
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        rate: 0,
        total: 0,
        priceSource: 'Free of Cost (FOC)'
      }));
      setBreakdownRows(zeroBreakdowns);
    }

    if (refWo.finishedGoodsId) {
      const fg = finishedGoods.find(f => f.id === refWo.finishedGoodsId);
      setSelectedFgItems([{
        id: refWo.finishedGoodsId,
        fgNo: refWo.finishedGoodsNo || fg?.fgNo || '',
        fgName: refWo.finishedGoodsName || fg?.name || 'Item',
        unit: refWo.finishedGoodsUnit || fg?.unit || 'PCS',
        rate: 0,
        priceSource: 'Free of Cost (FOC)',
        style: refWo.style
      }]);
    }

    showToast(`Loaded Job "${refWo.woNumber}" breakdown & details as Free of Cost (Price: ৳ 0.00)`, 'success');
  };

  // --- ITEM ADDITION TO WORK ORDER ---
  const handleAddFgItemToOrder = () => {
    if (!selectedFgId) {
      showToast('Please select a Finished Goods Item from catalog first.', 'error');
      return;
    }
    if (!selectedFgObj) return;

    // Evaluate exact price for selected item & customer from Price Master
    const priceInfo = getPriceForStyleAndItem(headerStyle, selectedFgId);
    const itemRate = isFreeOfCost ? 0 : (isManualPriceOverride && manualPriceRate !== '' ? Number(manualPriceRate) : (priceInfo.rate >= 0 ? priceInfo.rate : activeEffectiveRate.rate));
    const itemSource = isFreeOfCost ? 'Free of Cost (FOC)' : (isManualPriceOverride ? 'Manual Override' : priceInfo.source);
    const itemCurrCode = priceInfo.currencyCode || activeEffectiveRate.currencyCode || orderCurrencyCode || 'BDT';
    const itemCurrId = priceInfo.currencyId || activeEffectiveRate.currencyId || orderCurrencyId || '';

    if (itemCurrCode) {
      setOrderCurrencyCode(itemCurrCode);
      setOrderCurrencyId(itemCurrId);
    }

    const newItem = {
      id: selectedFgId,
      fgNo: selectedFgObj.fgNo,
      fgName: selectedFgObj.name,
      unit: selectedFgObj.unit || 'PCS',
      rate: itemRate,
      currencyCode: itemCurrCode,
      currencyId: itemCurrId,
      priceSource: itemSource,
      style: headerStyle
    };

    const symbol = getCurrencySymbol(itemCurrCode);
    const existingIdx = selectedFgItems.findIndex(i => i.id === selectedFgId);
    let updatedList = [...selectedFgItems];
    if (existingIdx >= 0) {
      updatedList[existingIdx] = newItem;
      showToast(`Updated rate for "${selectedFgObj.name}" to ${symbol} ${itemRate.toFixed(2)} (${itemSource})`, 'info');
    } else {
      updatedList.push(newItem);
      showToast(`Added "${selectedFgObj.name}" @ ${symbol} ${itemRate.toFixed(2)} (${itemSource}) to Work Order!`, 'success');
    }

    setSelectedFgItems(updatedList);
    setRowFgId(selectedFgId);
    setRowRate(itemRate);
    setRowUnit(selectedFgObj.unit || 'PCS');
  };

  const handleRemoveFgItemFromOrder = (fgId: string) => {
    const filtered = selectedFgItems.filter(i => i.id !== fgId);
    setSelectedFgItems(filtered);
    if (rowFgId === fgId) {
      if (filtered.length > 0) {
        setRowFgId(filtered[0].id);
        setRowRate(filtered[0].rate);
        setRowUnit(filtered[0].unit);
      } else {
        setRowFgId('');
      }
    }
    showToast('Item removed from Work Order item selection.', 'info');
  };

  // --- AUTOMATIC PRICE ENGINE ---
  // Priority: Customer + FG Item + Style -> Customer + FG Item -> General FG Price -> Manual Price
  const automaticPriceEvaluation = useMemo(() => {
    if (!selectedCustomerId || !selectedFgId) {
      return { rate: null, currencyCode: 'BDT', currencyId: '', unit: 'PCS', source: 'None', description: 'Select Customer and Finished Goods' };
    }

    const custObj = customers.find(c => c.id === selectedCustomerId) || selectedCustomerObj;
    const fgObj = finishedGoods.find(f => f.id === selectedFgId) || selectedFgObj;

    const matchingRules = priceMasters.filter(p => {
      const custMatch = p.customerId === selectedCustomerId ||
        (custObj && p.customerName && p.customerName.trim().toLowerCase() === custObj.name.trim().toLowerCase()) ||
        (custObj && custObj.customerCode && p.customerCode && p.customerCode.trim().toLowerCase() === custObj.customerCode.trim().toLowerCase());
      
      const fgMatch = p.finishedGoodsId === selectedFgId ||
        (fgObj && p.finishedGoodsNo && p.finishedGoodsNo.trim().toLowerCase() === fgObj.fgNo.trim().toLowerCase()) ||
        (fgObj && p.finishedGoodsName && p.finishedGoodsName.trim().toLowerCase() === fgObj.name.trim().toLowerCase());
      
      const statusActive = !p.status || p.status.toLowerCase() === 'active';

      return custMatch && fgMatch && statusActive;
    });

    if (matchingRules.length > 0) {
      // 1. Exact style match if headerStyle is set
      if (headerStyle.trim()) {
        const targetStyle = headerStyle.trim().toLowerCase();
        const styleMatch = matchingRules.find(p => p.style && p.style.trim().toLowerCase() === targetStyle);
        if (styleMatch) {
          const code = styleMatch.currencyCode || 'BDT';
          const unit = styleMatch.unit || fgObj?.unit || 'PCS';
          return {
            rate: Number(styleMatch.rate),
            currencyCode: code,
            currencyId: styleMatch.currencyId || '',
            unit: unit,
            source: 'Customer + Style Price',
            description: `Customer & Style specific rate (${code} ${styleMatch.rate} / ${unit})`
          };
        }
      }

      // 2. General / blank style rule
      const generalRule = matchingRules.find(p => !p.style || p.style.trim() === '' || p.style.toLowerCase().includes('general'));
      if (generalRule) {
        const code = generalRule.currencyCode || 'BDT';
        const unit = generalRule.unit || fgObj?.unit || 'PCS';
        return {
          rate: Number(generalRule.rate),
          currencyCode: code,
          currencyId: generalRule.currencyId || '',
          unit: unit,
          source: 'Customer Price',
          description: `Customer Master specific rate (${code} ${generalRule.rate} / ${unit})`
        };
      }

      // 3. Fallback to any matching Price Master rule for this Customer & Item
      const firstRule = matchingRules[0];
      const code = firstRule.currencyCode || 'BDT';
      const unit = firstRule.unit || fgObj?.unit || 'PCS';
      return {
        rate: Number(firstRule.rate),
        currencyCode: code,
        currencyId: firstRule.currencyId || '',
        unit: unit,
        source: 'Customer Price',
        description: `Customer Master rate (${code} ${firstRule.rate} / ${unit})`
      };
    }

    // 4. Check General Finished Goods Default Base Price
    if (fgObj && fgObj.defaultPrice && Number(fgObj.defaultPrice) > 0) {
      return { 
        rate: Number(fgObj.defaultPrice), 
        currencyCode: 'BDT',
        currencyId: '',
        unit: fgObj.unit || 'PCS',
        source: 'Item Price', 
        description: `General Item Master rate (BDT ${fgObj.defaultPrice} / ${fgObj.unit || 'PCS'})` 
      };
    }

    // 5. Price Not Found
    return { 
      rate: null, 
      currencyCode: 'BDT',
      currencyId: '',
      unit: fgObj?.unit || 'PCS',
      source: 'Price Not Found', 
      description: 'No pricing rule found in Price Master. Authorized manual price required.' 
    };
  }, [selectedCustomerId, selectedFgId, headerStyle, priceMasters, selectedFgObj, customers, finishedGoods, selectedCustomerObj]);

  // Sync order currency when automatic price evaluation finds a matching Price Master rule
  useEffect(() => {
    if (automaticPriceEvaluation.currencyCode && !isManualPriceOverride) {
      setOrderCurrencyCode(automaticPriceEvaluation.currencyCode);
      setOrderCurrencyId(automaticPriceEvaluation.currencyId || '');
    }
  }, [automaticPriceEvaluation.currencyCode, automaticPriceEvaluation.currencyId, isManualPriceOverride]);

  // Update Effective Rate whenever Automatic Price, Manual Override, or Free of Cost changes
  const activeEffectiveRate = useMemo(() => {
    if (isFreeOfCost) {
      return { rate: 0, currencyCode: orderCurrencyCode || 'BDT', currencyId: orderCurrencyId || '', source: 'Free of Cost (FOC)' };
    }
    if (isManualPriceOverride && manualPriceRate !== '' && Number(manualPriceRate) >= 0) {
      return { rate: Number(manualPriceRate), currencyCode: orderCurrencyCode || automaticPriceEvaluation.currencyCode || 'BDT', currencyId: orderCurrencyId || automaticPriceEvaluation.currencyId || '', source: 'Manual Override' };
    }
    if (automaticPriceEvaluation.rate !== null) {
      return { rate: automaticPriceEvaluation.rate, currencyCode: automaticPriceEvaluation.currencyCode, currencyId: automaticPriceEvaluation.currencyId, source: automaticPriceEvaluation.source };
    }
    return { rate: 0, currencyCode: orderCurrencyCode || 'BDT', currencyId: orderCurrencyId || '', source: 'Manual Required' };
  }, [isFreeOfCost, isManualPriceOverride, manualPriceRate, automaticPriceEvaluation, orderCurrencyCode, orderCurrencyId]);

  // Available Finished Goods items for Breakdown selection (Restricted ONLY to items added/selected in Section 4)
  const availableBreakdownFgItems = useMemo(() => {
    const items = [...selectedFgItems];
    if (selectedFgId && !items.some(i => i.id === selectedFgId)) {
      const fgObj = finishedGoods.find(f => f.id === selectedFgId);
      if (fgObj) {
        const priceInfo = getPriceForStyleAndItem(headerStyle, selectedFgId);
        const rate = isManualPriceOverride && manualPriceRate !== '' ? Number(manualPriceRate) : (priceInfo.rate >= 0 ? priceInfo.rate : activeEffectiveRate.rate);
        items.unshift({
          id: fgObj.id,
          fgNo: fgObj.fgNo,
          fgName: fgObj.name,
          unit: fgObj.unit || 'PCS',
          rate: rate,
          currencyCode: priceInfo.currencyCode || activeEffectiveRate.currencyCode || orderCurrencyCode || 'BDT',
          currencyId: priceInfo.currencyId || activeEffectiveRate.currencyId || orderCurrencyId || '',
          priceSource: priceInfo.source,
          style: headerStyle
        });
      }
    }
    return items;
  }, [selectedFgItems, selectedFgId, finishedGoods, headerStyle, isManualPriceOverride, manualPriceRate, activeEffectiveRate, orderCurrencyCode, orderCurrencyId]);

  // Auto-sync selectedFgItems with latest Price Master rates & currencies when Customer, Price Master, or Style changes
  useEffect(() => {
    if (selectedCustomerId && selectedFgItems.length > 0 && !isManualPriceOverride) {
      let updated = false;
      const newList = selectedFgItems.map(item => {
        const priceInfo = getPriceForStyleAndItem(item.style || headerStyle, item.id);
        if (priceInfo.rate !== item.rate || priceInfo.source !== item.priceSource || priceInfo.currencyCode !== item.currencyCode) {
          updated = true;
          return { 
            ...item, 
            rate: priceInfo.rate, 
            priceSource: priceInfo.source,
            currencyCode: priceInfo.currencyCode,
            currencyId: priceInfo.currencyId
          };
        }
        return item;
      });
      if (updated) {
        setSelectedFgItems(newList);
      }
    }
  }, [selectedCustomerId, priceMasters, headerStyle]);

  // Keep Row Rate input, Order Currency, and Row Unit updated with active effective rate by default
  useEffect(() => {
    const activeFg = rowFgId || selectedFgId;
    if (selectedCustomerId && activeFg) {
      const priceInfo = getPriceForStyleAndItem(rowStyle || headerStyle, activeFg);
      if (priceInfo.rate >= 0) {
        setRowRate(priceInfo.rate);
      }
      if (priceInfo.currencyCode && !isManualPriceOverride) {
        setOrderCurrencyCode(priceInfo.currencyCode);
        if (priceInfo.currencyId) setOrderCurrencyId(priceInfo.currencyId);
      }
      if (priceInfo.unit) {
        setRowUnit(priceInfo.unit);
      } else {
        const fgObj = finishedGoods.find(f => f.id === activeFg);
        if (fgObj?.unit) {
          setRowUnit(fgObj.unit);
        }
      }
    } else if (activeEffectiveRate.rate >= 0) {
      setRowRate(activeEffectiveRate.rate);
      if (activeEffectiveRate.currencyCode && !isManualPriceOverride) {
        setOrderCurrencyCode(activeEffectiveRate.currencyCode);
      }
      if ((activeEffectiveRate as any).unit) {
        setRowUnit((activeEffectiveRate as any).unit);
      }
    }
  }, [rowStyle, headerStyle, selectedCustomerId, selectedFgId, rowFgId, priceMasters, selectedFgObj, activeEffectiveRate, isManualPriceOverride]);

  // Work Order Sequence Generator - Guarantees unique max sequence
  const generateNewWoNumber = () => {
    const currentYear = new Date().getFullYear();
    let maxSeq = 0;
    workOrders.forEach(w => {
      if (w.woNumber) {
        const match = w.woNumber.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });
    const newSeq = String(maxSeq + 1).padStart(6, '0');
    return `WO-${currentYear}-${newSeq}`;
  };

  const generateNewOrderNo = () => {
    const currentYear = new Date().getFullYear();
    let maxSeq = 0;
    workOrders.forEach(w => {
      if (w.orderNo) {
        const match = w.orderNo.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });
    const newSeq = String(maxSeq + 1).padStart(6, '0');
    return `SO-${currentYear}-${newSeq}`;
  };

  // Auto-load production processes for selected section in Work Order Entry
  useEffect(() => {
    if (!selectedSectionId) {
      if (!editingWoId) {
        setSelectedWoProcesses([]);
      }
      return;
    }

    const sec = sections.find(s => s.id === selectedSectionId);
    const secName = sec?.name?.toLowerCase() || '';

    // Find processes in Production Process Master for this section
    const sectionProcs = productionProcesses
      .filter(p => p.sectionId === selectedSectionId || (p.sectionName && p.sectionName.toLowerCase() === secName))
      .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

    // If editing an existing WO that already has saved processes for this section, keep them
    if (editingWoId) {
      const currentWo = workOrders.find(w => w.id === editingWoId);
      if (currentWo?.selectedProcesses && currentWo.selectedProcesses.length > 0 && currentWo.sectionId === selectedSectionId) {
        setSelectedWoProcesses(currentWo.selectedProcesses);
        return;
      }
    }

    // Map section processes into WorkOrderProcessStep array
    const steps: WorkOrderProcessStep[] = sectionProcs.map((p, idx) => ({
      id: p.id,
      processCode: p.processCode || `PROC-${String(idx + 1).padStart(2, '0')}`,
      processName: p.processName,
      sequenceOrder: p.sequenceOrder || (idx + 1),
      isIncluded: true,
      notes: p.description || ''
    }));

    setSelectedWoProcesses(steps);
  }, [selectedSectionId, productionProcesses, editingWoId, sections]);

  // --- ACTIONS: [ ADD ] ---
  const handleAddNewWorkOrder = () => {
    // If user filled draft fields but woNumber is blank, assign new WO & SO numbers without clearing filled data
    if (!woNumber && (selectedCustomerId || breakdownRows.length > 0 || selectedFgItems.length > 0 || selectedSectionId || headerStyle)) {
      const newWo = generateNewWoNumber();
      const newSo = generateNewOrderNo();
      setWoNumber(newWo);
      if (!orderNo) setOrderNo(newSo);
      showToast(`Assigned Work Order No ${newWo} to current draft!`, 'success');
      return;
    }

    // Reset for a fresh new Work Order entry
    setEditingWoId(null);
    setWoNumber('');
    setOrderNo('');
    setPoNo('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate('');
    setSelectedCustomerId('');
    setSelectedBuyerId('');
    setSelectedSectionId('');
    setSelectedFgId('');
    setHeaderStyle('');
    setManualPriceRate('');
    setIsManualPriceOverride(false);
    setIsFreeOfCost(false);
    setFocRefJobNo('');
    setFocRemark('');
    setFocSearchQuery('');
    setSelectedFgItems([]);
    setSelectedWoProcesses([]);
    setRowJobNo('');
    setRowColor('');
    setBreakdownRows([]);
    setOrderCurrencyCode('USD');
    setWoStatus('draft');
    setWoAuditLogs([{
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Initialized blank Work Order entry',
      performedBy: userProfile.displayName || userProfile.email,
      performedByUid: userProfile.uid
    }]);
    showToast('Form cleared for new Work Order entry.', 'info');
  };

  // --- ACTIONS: [ PRINT WO ] ---
  const handlePrintCurrentWo = () => {
    if (editingWoId) {
      const curr = workOrders.find(w => w.id === editingWoId);
      if (curr) setViewingWo(curr);
    } else {
      setViewingWo({
        id: 'temp-print',
        woNumber: woNumber || 'WO-DRAFT',
        orderNo: orderNo || 'SO-DRAFT',
        poNo: poNo || 'N/A',
        date: orderDate,
        deliveryDate: deliveryDate,
        customerId: selectedCustomerId,
        customerName: selectedCustomerObj?.name || 'Customer Name',
        customerCode: selectedCustomerObj?.customerCode || '',
        customerAddress: selectedCustomerObj?.address || '',
        customerContact: selectedCustomerObj?.contactPerson || '',
        customerPhone: selectedCustomerObj?.phone || '',
        customerEmail: selectedCustomerObj?.email || '',
        buyerName: selectedBuyerObj?.name || 'Buyer Name',
        sectionName: sections.find(s => s.id === selectedSectionId)?.name || 'General Section',
        finishedGoodsNo: selectedFgObj?.fgNo || '',
        finishedGoodsName: selectedFgObj?.name || 'Finished Goods',
        finishedGoodsCategory: selectedFgObj?.productCategory || '',
        finishedGoodsUnit: selectedFgObj?.unit || 'Pcs',
        style: headerStyle,
        rate: activeEffectiveRate.rate,
        priceSource: activeEffectiveRate.source,
        breakdownRows: breakdownRows,
        totalQuantity: breakdownTotals.totalQty,
        totalAmount: breakdownTotals.totalAmt,
        status: woStatus,
        businessId: userProfile?.businessId || '',
        ownerId: userProfile?.uid || '',
        createdAt: Timestamp.now()
      });
    }
    setShowWoDetailsModal(true);
    setTimeout(() => {
      printElement('printable-job-bag', { title: `WorkOrder-${woNumber || 'Draft'}` });
    }, 150);
  };

  // --- ACTIONS: [ SAVE DRAFT / UPDATE ] ---
  const handleSaveOrUpdateWorkOrder = async () => {
    if (!selectedCustomerId) {
      showToast('Please select a Customer.', 'error');
      return;
    }
    if (!selectedBuyerId) {
      showToast('Please select a Buyer.', 'error');
      return;
    }
    if (!selectedFgId) {
      showToast('Please select a Finished Goods Item.', 'error');
      return;
    }
    if (breakdownRows.length === 0) {
      showToast('Work Order must contain at least 1 breakdown row.', 'error');
      return;
    }

    // Ensure unique Work Order Number and Sales Order Number
    let targetWo = woNumber.trim();
    if (!targetWo) {
      targetWo = generateNewWoNumber();
      setWoNumber(targetWo);
    }

    let targetSo = orderNo.trim();
    if (!targetSo) {
      targetSo = generateNewOrderNo();
      setOrderNo(targetSo);
    }

    // Check for duplicate Work Order number
    const isDuplicate = workOrders.some(
      w => w.id !== editingWoId && w.woNumber && w.woNumber.trim().toLowerCase() === targetWo.toLowerCase()
    );

    if (isDuplicate) {
      showToast(`Work Order Number "${targetWo}" already exists! Duplicate WO numbers are not allowed.`, 'error');
      return;
    }

    const totalQty = breakdownRows.reduce((a, b) => a + b.quantity, 0);
    const totalAmt = breakdownRows.reduce((a, b) => a + b.total, 0);

    const auditLogEntry: WorkOrderAuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: editingWoId ? 'Updated Work Order Draft' : 'Saved Work Order Draft',
      performedBy: userProfile.displayName || userProfile.email,
      performedByUid: userProfile.uid,
      details: `Total Qty: ${totalQty.toLocaleString()}, Total Value: ৳ ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    };

    const newLogs = [...woAuditLogs, auditLogEntry];

    const payload: Omit<WorkOrder, 'id'> = {
      woNumber: targetWo,
      orderNo: targetSo,
      poNo: poNo.trim() || 'PO-DEFAULT',
      date: orderDate,
      deliveryDate: deliveryDate,
      customerId: selectedCustomerId,
      customerName: selectedCustomerObj?.name || '',
      customerCode: selectedCustomerObj?.customerCode || '',
      customerAddress: selectedCustomerObj?.address || '',
      customerContact: selectedCustomerObj?.contactPerson || '',
      customerPhone: selectedCustomerObj?.phone || '',
      customerEmail: selectedCustomerObj?.email || '',
      country: selectedCustomerObj?.country || 'Bangladesh',
      paymentTerms: selectedCustomerObj?.paymentTerms || 'Standard',
      deliveryTerms: selectedCustomerObj?.deliveryTerms || 'FOB',
      buyerId: selectedBuyerId,
      buyerName: selectedBuyerObj?.name || '',
      sectionId: selectedSectionId,
      sectionName: sections.find(s => s.id === selectedSectionId)?.name || '',
      finishedGoodsId: selectedFgId,
      finishedGoodsNo: selectedFgObj?.fgNo || '',
      finishedGoodsName: selectedFgObj?.name || '',
      finishedGoodsCategory: selectedFgObj?.productCategory || selectedFgObj?.categoryName || '',
      finishedGoodsUnit: selectedFgObj?.unit || 'Pcs',
      finishedGoodsSpec: selectedFgObj?.defaultSpecification || '',
      style: headerStyle.trim(),
      currencyCode: orderCurrencyCode || activeEffectiveRate.currencyCode || 'USD',
      currencyId: orderCurrencyId || activeEffectiveRate.currencyId || '',
      conversionRate: orderConversionRate || (orderCurrencyCode.toUpperCase() === 'BDT' ? 1 : 120),
      totalAmountBDT: (totalAmt || 0) * (orderCurrencyCode.toUpperCase() === 'BDT' ? 1 : (orderConversionRate || 120)),
      rate: activeEffectiveRate.rate,
      priceSource: activeEffectiveRate.source,
      manualPriceOverride: isManualPriceOverride,
      isFreeOfCost: isFreeOfCost,
      focRefJobNo: focRefJobNo,
      focRemark: focRemark,
      selectedProcesses: selectedWoProcesses,
      breakdownRows: breakdownRows,
      totalQuantity: totalQty,
      totalAmount: totalAmt,
      requiredSheets: breakdownTotals.totalRequiredSheetsAll,
      rawMaterialUnit: breakdownTotals.primaryUnitLabel,
      status: woStatus === 'rejected' || woStatus === 'returned' ? 'draft' : woStatus,
      isLocked: false,
      auditLogs: newLogs,
      businessId: userProfile.businessId,
      ownerId: userProfile.uid,
      createdAt: Timestamp.now()
    };

    try {
      if (editingWoId) {
        await updateDoc(doc(db, 'work_orders', editingWoId), {
          ...payload,
          updatedAt: Timestamp.now()
        });
        showToast(`Work Order ${woNumber} updated successfully!`, 'success');
      } else {
        const res = await addDoc(collection(db, 'work_orders'), payload);
        setEditingWoId(res.id);
        showToast(`Work Order ${woNumber} saved as Draft!`, 'success');
      }
      setWoAuditLogs(newLogs);
    } catch (err: any) {
      console.error('Error saving Work Order:', err);
      handleFirestoreError(err, OperationType.WRITE, 'work_orders');
    }
  };

  // --- ACTIONS: [ CONFIRM ] ---
  const handleConfirmWorkOrder = async () => {
    if (!editingWoId) {
      await handleSaveOrUpdateWorkOrder();
    }

    if (breakdownRows.length === 0) {
      showToast('Cannot confirm an empty Work Order.', 'error');
      return;
    }

    setShowConfirmModal(true);
  };

  const executeConfirmation = async () => {
    setShowConfirmModal(false);
    const targetId = editingWoId;
    if (!targetId) return;

    const totalAmt = breakdownRows.reduce((a, b) => a + b.total, 0);
    const totalQty = breakdownRows.reduce((a, b) => a + b.quantity, 0);

    const confirmAuditLog: WorkOrderAuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Confirmed Work Order & Submitted for Approval',
      performedBy: userProfile.displayName || userProfile.email,
      performedByUid: userProfile.uid,
      details: 'Work Order locked for editing until approval review.'
    };

    const updatedLogs = [...woAuditLogs, confirmAuditLog];

    try {
      const effectiveCurrCode = (orderCurrencyCode || activeEffectiveRate?.currencyCode || 'USD').toUpperCase();
      const effectiveCurrSymbol = getCurrencySymbol(effectiveCurrCode);

      // Check approval workflow setup rule for sales order / work order
      const checkResult = await checkPageApprovalRule('sales-order-entry', userProfile.businessId, userProfile, totalAmt);

      // 1. Create Approval Request in Firestore with designated approver routing
      const approvalPayload: Omit<ApprovalRequest, 'id'> = {
        businessId: userProfile.businessId,
        module: 'sales-order-entry',
        moduleName: 'Sales Order & Work Order',
        actionType: 'WORK_ORDER_APPROVAL',
        targetCollection: 'work_orders',
        targetId: targetId,
        summary: `Work Order ${woNumber} (${selectedCustomerObj?.name || 'Customer'}) - Qty: ${totalQty.toLocaleString()}, Amt: ${effectiveCurrSymbol} ${totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${effectiveCurrCode})`,
        amount: totalAmt,
        currency: effectiveCurrCode,
        currencyCode: effectiveCurrCode,
        currencySymbol: effectiveCurrSymbol,
        requestedByUid: userProfile.uid,
        requestedByName: userProfile.displayName || userProfile.email,
        requestedByEmail: userProfile.email || '',
        approverType: checkResult.approverType || (checkResult.approverUid ? 'user' : 'role'),
        approverUid: checkResult.approverUid || '',
        approverEmail: checkResult.approverEmail || '',
        approverRole: checkResult.approverRole || '',
        approverName: checkResult.approverName || 'Approver',
        status: 'pending',
        createdAt: Timestamp.now()
      };

      const appRef = await addDoc(collection(db, 'approvalRequests'), approvalPayload);

      // 2. Lock & Update Work Order Status to pending_approval
      await updateDoc(doc(db, 'work_orders', targetId), {
        status: 'pending_approval',
        isLocked: true,
        requiredSheets: breakdownTotals.totalRequiredSheetsAll,
        rawMaterialUnit: breakdownTotals.primaryUnitLabel,
        breakdownRows: breakdownRows,
        totalQuantity: totalQty,
        totalAmount: totalAmt,
        approvalRequestId: appRef.id,
        auditLogs: updatedLogs,
        updatedAt: Timestamp.now()
      });

      setWoStatus('pending_approval');
      setWoAuditLogs(updatedLogs);
      showToast(`Work Order ${woNumber} Confirmed & Submitted! Pending approval from ${checkResult.approverName || 'Designated Approver'}.`, 'success');
    } catch (err: any) {
      console.error('Error confirming work order:', err);
      showToast('Confirmation failed: ' + err.message, 'error');
    }
  };

  // --- APPROVAL HANDLERS (Direct Approver Actions) ---
  const handleApproveWorkOrder = async (wo: WorkOrder) => {
    try {
      const log: WorkOrderAuditLog = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Work Order Approved',
        performedBy: userProfile.displayName || userProfile.email,
        performedByUid: userProfile.uid,
        details: `Approved on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`
      };

      const nextLogs = [...(wo.auditLogs || []), log];

      await updateDoc(doc(db, 'work_orders', wo.id), {
        status: 'approved',
        approvedBy: userProfile.displayName || userProfile.email,
        approvedAt: new Date().toLocaleString(),
        auditLogs: nextLogs,
        updatedAt: Timestamp.now()
      });

      if (wo.approvalRequestId) {
        await updateDoc(doc(db, 'approvalRequests', wo.approvalRequestId), {
          status: 'approved',
          approvedBy: userProfile.displayName || userProfile.email,
          approvedAt: Timestamp.now()
        });
      }

      if (editingWoId === wo.id) {
        setWoStatus('approved');
        setWoAuditLogs(nextLogs);
      }

      showToast(`Work Order ${wo.woNumber} APPROVED successfully!`, 'success');
    } catch (err: any) {
      showToast('Failed to approve Work Order: ' + err.message, 'error');
    }
  };

  const handleRejectWorkOrder = async (wo: WorkOrder) => {
    if (!rejectionComment.trim()) {
      showToast('Please enter a rejection reason.', 'error');
      return;
    }

    try {
      const log: WorkOrderAuditLog = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Work Order Rejected / Returned',
        performedBy: userProfile.displayName || userProfile.email,
        performedByUid: userProfile.uid,
        details: `Reason: ${rejectionComment.trim()}`
      };

      const nextLogs = [...(wo.auditLogs || []), log];

      await updateDoc(doc(db, 'work_orders', wo.id), {
        status: 'rejected',
        isLocked: false, // Unlock for returned edit
        rejectionReason: rejectionComment.trim(),
        rejectedBy: userProfile.displayName || userProfile.email,
        rejectedAt: new Date().toLocaleString(),
        auditLogs: nextLogs,
        updatedAt: Timestamp.now()
      });

      if (wo.approvalRequestId) {
        await updateDoc(doc(db, 'approvalRequests', wo.approvalRequestId), {
          status: 'rejected',
          rejectedBy: userProfile.displayName || userProfile.email,
          rejectedAt: Timestamp.now()
        });
      }

      if (editingWoId === wo.id) {
        setWoStatus('rejected');
        setWoAuditLogs(nextLogs);
      }

      setRejectionComment('');
      showToast(`Work Order ${wo.woNumber} Rejected & Returned to User for revision.`, 'info');
    } catch (err: any) {
      showToast('Failed to reject Work Order: ' + err.message, 'error');
    }
  };

  // --- RECTIFY ORDER REQUEST HANDLER ---
  const handleSubmitRectifyRequest = async () => {
    if (!rectifyTargetWo) {
      showToast('Please select a Work Order to rectify.', 'error');
      return;
    }
    if (!rectifyRemarks.trim()) {
      showToast('Please enter remarks explaining why rectification is needed.', 'error');
      return;
    }
    setIsSubmittingRectify(true);
    try {
      const wo = rectifyTargetWo;
      const checkResult = await checkPageApprovalRule('sales-order-entry', userProfile.businessId, userProfile, wo.totalAmount);
      const currCode = (wo.currencyCode || 'USD').toUpperCase();
      const currSym = getCurrencySymbol(currCode);

      const approvalPayload: Omit<ApprovalRequest, 'id'> = {
        businessId: userProfile.businessId,
        module: 'sales-order-entry',
        moduleName: 'Sales & Work Order Rectification',
        actionType: 'RECTIFY_ORDER_REQUEST',
        targetCollection: 'work_orders',
        targetId: wo.id,
        summary: `Rectification Request for WO #${wo.woNumber} (${wo.customerName || 'Customer'}) - Reason: ${rectifyRemarks.trim()}`,
        amount: wo.totalAmount || 0,
        currency: currCode,
        currencyCode: currCode,
        currencySymbol: currSym,
        requestedByUid: userProfile.uid,
        requestedByName: userProfile.displayName || userProfile.email,
        requestedByEmail: userProfile.email || '',
        approverType: checkResult.approverType || (checkResult.approverUid ? 'user' : 'role'),
        approverUid: checkResult.approverUid || '',
        approverEmail: checkResult.approverEmail || '',
        approverRole: checkResult.approverRole || '',
        approverName: checkResult.approverName || 'Approver',
        status: 'pending',
        createdAt: Timestamp.now()
      };

      const appRef = await addDoc(collection(db, 'approvalRequests'), approvalPayload);

      const log: WorkOrderAuditLog = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Rectification Requested',
        performedBy: userProfile.displayName || userProfile.email,
        performedByUid: userProfile.uid,
        details: `Reason: ${rectifyRemarks.trim()}`
      };

      await updateDoc(doc(db, 'work_orders', wo.id), {
        rectifyRequested: true,
        rectifyApprovalRequestId: appRef.id,
        rectifyRemarks: rectifyRemarks.trim(),
        rectifyRequestedAt: Timestamp.now(),
        rectifyRequestedBy: userProfile.displayName || userProfile.email,
        auditLogs: [...(wo.auditLogs || []), log],
        updatedAt: Timestamp.now()
      });

      showToast(`Rectification request for Work Order ${wo.woNumber} submitted for approval to ${checkResult.approverName || 'Approver'}!`, 'success');
      setShowRectifyModal(false);
      setRectifyRemarks('');
      setRectifyTargetWo(null);
    } catch (err: any) {
      console.error('Error submitting rectification request:', err);
      showToast('Failed to submit rectification request: ' + err.message, 'error');
    } finally {
      setIsSubmittingRectify(false);
    }
  };

  // --- BOM & SHEET CONSUMPTION HELPER ---
  const getBomForFinishedGoods = (fgId?: string, fgNo?: string, fgName?: string): BomMaster | undefined => {
    if (!boms || boms.length === 0) return undefined;
    return boms.find(b => {
      if (fgId && b.productId && b.productId === fgId) return true;
      if (fgNo && b.productCode && b.productCode.toLowerCase().trim() === fgNo.toLowerCase().trim()) return true;
      if (fgName && b.productName && b.productName.toLowerCase().trim() === fgName.toLowerCase().trim()) return true;
      return false;
    });
  };

  const getRawMaterialUnitLabel = (bom?: BomMaster, fg?: FinishedGoods | null, storeItem?: any) => {
    const rawUnit = (
      storeItem?.unit ||
      bom?.unit ||
      (bom as any)?.sheetUnit ||
      (bom as any)?.rawMaterialUnit ||
      (bom?.sheetItemName?.toLowerCase().includes('roll') ? 'Roll' : '') ||
      (fg?.unit?.toLowerCase().includes('roll') ? 'Roll' : '') ||
      'Sheet'
    ).trim();

    if (/^roll/i.test(rawUnit) || /^rl/i.test(rawUnit)) return 'Roll';
    if (/^sheet/i.test(rawUnit) || /^sht/i.test(rawUnit)) return 'Sheet';
    if (/^meter/i.test(rawUnit) || /^mtr/i.test(rawUnit)) return 'Meter';
    if (/^yard/i.test(rawUnit) || /^yd/i.test(rawUnit)) return 'Yard';
    if (/^kg/i.test(rawUnit)) return 'Kg';
    if (/^pc/i.test(rawUnit)) return 'Pcs';
    return rawUnit || 'Sheet';
  };

  const calculateRequiredSheets = (qty: number, fgId?: string, fgNo?: string, fgName?: string) => {
    const bom = getBomForFinishedGoods(fgId, fgNo, fgName);
    if (!bom) return { requiredSheets: 0, rawUnits: 0, ups: 0, bomNo: '', sheetItemName: '', wastagePercent: 0, unitLabel: 'Sheet', hasBom: false };

    const ups = Math.max(1, bom.ups || bom.piecesPerSheet || 1);
    const wastage = bom.wastagePercent || 0;
    const baseUnits = qty / ups;
    const totalUnitsWithWastage = Math.ceil(baseUnits);

    const storeSheetItem = bom?.sheetItemId ? inventoryItems.find(it => it.id === bom.sheetItemId) : undefined;
    const activeFgObj = finishedGoods.find(f => f.id === fgId) || selectedFgObj;
    const unitLabel = getRawMaterialUnitLabel(bom, activeFgObj, storeSheetItem);

    return {
      requiredSheets: totalUnitsWithWastage,
      rawUnits: Number(baseUnits.toFixed(4)),
      ups,
      bomNo: bom.bomNo,
      sheetItemName: bom.sheetItemName || '',
      wastagePercent: wastage,
      unitLabel,
      hasBom: true
    };
  };

  // --- MANUAL BREAKDOWN ROW ENTRY ---
  const handleAddManualRow = () => {
    if (!rowQty || Number(rowQty) <= 0) {
      showToast('Enter a valid Quantity greater than 0.', 'error');
      return;
    }

    const activeFgId = rowFgId || selectedFgId || (selectedFgItems[0]?.id);
    const activeFgObj = finishedGoods.find(f => f.id === activeFgId) || selectedFgObj;

    if (!activeFgId && !activeFgObj) {
      showToast('Please select a Finished Goods Item.', 'error');
      return;
    }

    const itemInList = selectedFgItems.find(i => i.id === activeFgId);
    const styleVal = rowStyle.trim() || itemInList?.style || headerStyle.trim() || 'ST-GENERAL';
    const priceInfo = getPriceForStyleAndItem(styleVal, activeFgId);
    const effectiveRateNum = isFreeOfCost ? 0 : (rowRate !== '' ? Number(rowRate) : (itemInList?.rate ?? priceInfo.rate));
    const poVal = rowOrderNo.trim() || poNo.trim() || 'PO-DEFAULT';
    const jobVal = rowJobNo.trim() || orderNo.trim() || 'JOB-01';
    const colorVal = rowColor.trim() || 'N/A';
    const fgNoVal = activeFgObj?.fgNo || itemInList?.fgNo || '';
    const fgNameVal = activeFgObj?.name || itemInList?.fgName || 'Finished Goods';

    // Calculate Required Sheets & UPS from Master BOM
    const sheetInfo = calculateRequiredSheets(Number(rowQty), activeFgId, fgNoVal, fgNameVal);

    const newRow: WorkOrderBreakdownRow = {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      jobNo: jobVal,
      style: styleVal,
      color: colorVal,
      size: rowSize || 'M',
      orderNo: poVal,
      quantity: Number(rowQty),
      unit: rowUnit || activeFgObj?.unit || 'PCS',
      rate: effectiveRateNum,
      total: Number(rowQty) * effectiveRateNum,
      priceSource: isFreeOfCost ? 'Free of Cost (FOC)' : (itemInList?.priceSource || priceInfo.source),
      finishedGoodsId: activeFgId || '',
      finishedGoodsNo: fgNoVal,
      finishedGoodsName: fgNameVal,
      requiredSheets: sheetInfo.requiredSheets,
      ups: sheetInfo.ups,
      bomNo: sheetInfo.bomNo
    };

    const nextRows = [...breakdownRows, newRow];
    setBreakdownRows(nextRows);

    // Add Audit Log
    const log: WorkOrderAuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: `Added Row (${newRow.finishedGoodsName} / ${newRow.style} / ${newRow.color} / ${newRow.size})`,
      performedBy: userProfile.displayName || userProfile.email,
      performedByUid: userProfile.uid,
      details: `Item: ${newRow.finishedGoodsName}, Job: ${newRow.jobNo}, Qty: ${newRow.quantity}, Sheets: ${newRow.requiredSheets || 0} (UPS: ${newRow.ups || 1}), Rate: ৳${newRow.rate}, Total: ৳${newRow.total}`
    };
    setWoAuditLogs(prev => [...prev, log]);

    // Reset row inputs
    setRowQty('');
    showToast(`Added row: ${newRow.finishedGoodsName} (${newRow.style} / ${newRow.color})${sheetInfo.hasBom ? ` - Req: ${sheetInfo.requiredSheets} ${sheetInfo.unitLabel || 'Sheets'}` : ''}`, 'success');
  };

  const handleRemoveBreakdownRow = (rowId: string) => {
    if (woStatus === 'confirmed' || woStatus === 'pending_approval' || woStatus === 'approved') {
      showToast('Cannot remove rows from confirmed or approved Work Order.', 'error');
      return;
    }
    const filtered = breakdownRows.filter(r => r.id !== rowId);
    setBreakdownRows(filtered);
    showToast('Row removed.', 'info');
  };

  const handleRemoveBreakdownRowWithConfirm = (row: WorkOrderBreakdownRow) => {
    if (woStatus === 'confirmed' || woStatus === 'pending_approval' || woStatus === 'approved') {
      showToast('Cannot remove rows from confirmed or approved Work Order.', 'error');
      return;
    }
    requestActionConfirmation({
      title: 'Remove Breakdown Row?',
      message: `Are you sure you want to remove row for "${row.finishedGoodsName}" (Style: ${row.style}, Size: ${row.size})?`,
      type: 'delete',
      confirmText: 'Yes, Remove Row',
      details: [
        { label: 'Item Name', value: row.finishedGoodsName },
        { label: 'Style / Color / Size', value: `${row.style} / ${row.color} / ${row.size}` },
        { label: 'Quantity', value: `${row.quantity} ${row.unit}` }
      ],
      onConfirm: () => handleRemoveBreakdownRow(row.id)
    });
  };

  // --- CSV UPLOAD & VALIDATION ---
  const handleDownloadCsvTemplate = () => {
    const csvData = "Style,Color,Size,Quantity,Job No,Order No,Unit\nST-1001,RED,S,5000,JOB-01,PO-001,Pcs\nST-1001,RED,M,7000,JOB-01,PO-001,Pcs\nST-1002,NAVY,L,8000,JOB-02,PO-002,Pcs\nST-1003,WHITE,XL,10000,JOB-03,PO-003,Pcs";
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Work_Order_Breakdown_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded CSV Template (Item Name/No not required - uses selected Finished Goods)', 'success');
  };

  const handleUploadCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine active FG item selected in UI dropdown/item list
    const activeFgId = rowFgId || selectedFgId || (selectedFgItems[0]?.id);
    const activeFgObj = finishedGoods.find(f => f.id === activeFgId) || selectedFgObj;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data as any[];
        const validList: WorkOrderBreakdownRow[] = [];
        const errorList: { line: number; row: any; error: string }[] = [];

        rawRows.forEach((row, idx) => {
          const lineNumber = idx + 2; // header is line 1
          const rawItem = (row['Item No'] || row.Item || row.item || row['Item Name'] || row.FinishedGoods || row['FG No'] || '').toString().trim();
          
          let rowFgObj = activeFgObj;
          // If CSV row explicitly specifies an item, attempt match, otherwise default to activeFgObj selected in UI
          if (rawItem) {
            const match = finishedGoods.find(f => 
              (f.fgNo && f.fgNo.toLowerCase() === rawItem.toLowerCase()) || 
              (f.name && f.name.toLowerCase() === rawItem.toLowerCase()) ||
              f.id === rawItem
            );
            if (match) rowFgObj = match;
          }

          const jb = (row['Job No'] || row.JobNo || row.job_no || row.Job || '').toString().trim() || orderNo || 'JOB-01';
          const st = (row.Style || row.style || row.STYLE || headerStyle || rowStyle || '').toString().trim();
          const clr = (row.Color || row.Colour || row.color || row.colour || '').toString().trim() || 'N/A';
          const sz = (row.Size || row.size || row.SIZE || '').toString().trim();
          const ord = (row['Order No'] || row.OrderNo || row.order_no || row.po_no || poNo || orderNo || '').toString().trim() || 'PO-DEFAULT';
          const q = Number(row.Quantity || row.quantity || row.QTY || row.Qty || 0);
          const u = (row.Unit || row.unit || rowFgObj?.unit || 'PCS').toString().trim();

          let rowError = '';
          if (!st) rowError += 'Missing Style. ';
          if (!sz) rowError += 'Missing Size. ';
          if (isNaN(q) || q <= 0) rowError += 'Invalid Quantity (must be > 0). ';

          if (rowError) {
            errorList.push({ line: lineNumber, row, error: rowError.trim() });
          } else {
            // Retrieve exact rate for this Customer + Item from Price Master
            const rowPriceInfo = getPriceForStyleAndItem(st, rowFgObj?.id);
            const calculatedRate = rowPriceInfo.rate;
            const sheetCalc = calculateRequiredSheets(q, rowFgObj?.id || selectedFgId, rowFgObj?.fgNo, rowFgObj?.name);

            validList.push({
              id: Date.now().toString() + Math.random().toString().slice(2, 6) + idx,
              jobNo: jb,
              style: st,
              color: clr,
              size: sz,
              orderNo: ord,
              quantity: q,
              unit: u,
              rate: calculatedRate,
              total: q * calculatedRate,
              priceSource: rowPriceInfo.source,
              finishedGoodsId: rowFgObj?.id || selectedFgId || '',
              finishedGoodsNo: rowFgObj?.fgNo || '',
              finishedGoodsName: rowFgObj?.name || 'Finished Goods',
              requiredSheets: sheetCalc.requiredSheets,
              ups: sheetCalc.ups,
              bomNo: sheetCalc.bomNo
            });
          }
        });

        setCsvParsedRows(rawRows);
        setCsvValidRows(validList);
        setCsvErrorLogs(errorList);
        setShowCsvValidationModal(true);

        // Reset file input value
        e.target.value = '';
      },
      error: (err) => {
        showToast('Failed to parse CSV file: ' + err.message, 'error');
      }
    });
  };

  const executeImportValidCsvRows = () => {
    if (csvValidRows.length === 0) {
      showToast('No valid rows to import.', 'error');
      return;
    }

    const updated = [...breakdownRows, ...csvValidRows];
    setBreakdownRows(updated);
    setShowCsvValidationModal(false);

    const log: WorkOrderAuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: `Imported ${csvValidRows.length} breakdown rows from CSV`,
      performedBy: userProfile.displayName || userProfile.email,
      performedByUid: userProfile.uid
    };
    setWoAuditLogs(prev => [...prev, log]);

    showToast(`Successfully imported ${csvValidRows.length} valid rows from CSV!`, 'success');
  };

  const handleDownloadCsvErrorReport = () => {
    if (csvErrorLogs.length === 0) return;
    const reportData = csvErrorLogs.map(e => ({
      'Line Number': e.line,
      'Raw Style': e.row.Style || e.row.style || '',
      'Raw Size': e.row.Size || e.row.size || '',
      'Raw Order No': e.row['Order No'] || e.row.OrderNo || '',
      'Raw Quantity': e.row.Quantity || e.row.quantity || '',
      'Validation Error': e.error
    }));
    const csv = Papa.unparse(reportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CSV_Validation_Errors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded CSV Error Report', 'info');
  };

  // --- SUMMARIES ---
  const breakdownTotals = useMemo(() => {
    const totalRows = breakdownRows.length;
    const totalQty = breakdownRows.reduce((a, b) => a + b.quantity, 0);
    const totalAmt = breakdownRows.reduce((a, b) => a + b.total, 0);

    // Style Summary
    const styleMap: Record<string, { qty: number; value: number }> = {};
    breakdownRows.forEach(r => {
      if (!styleMap[r.style]) styleMap[r.style] = { qty: 0, value: 0 };
      styleMap[r.style].qty += r.quantity;
      styleMap[r.style].value += r.total;
    });

    // Size Summary
    const sizeMap: Record<string, number> = {};
    breakdownRows.forEach(r => {
      sizeMap[r.size] = (sizeMap[r.size] || 0) + r.quantity;
    });

    // Order No Summary
    const orderNoMap: Record<string, { qty: number; value: number }> = {};
    breakdownRows.forEach(r => {
      if (!orderNoMap[r.orderNo]) orderNoMap[r.orderNo] = { qty: 0, value: 0 };
      orderNoMap[r.orderNo].qty += r.quantity;
      orderNoMap[r.orderNo].value += r.total;
    });

    // Item / Finished Goods Summary with Total Quantity / UPS = Sheets calculation (Round figure)
    const itemMap: Record<string, { 
      fgId?: string;
      fgNo: string; 
      fgName: string; 
      qty: number; 
      value: number;
      requiredSheets: number;
      rawSheets: number;
      ups: number;
      bomNo: string;
      sheetItemName?: string;
      sheetStock?: number;
      hasBom: boolean;
      wastagePercent: number;
      unitLabel: string;
    }> = {};

    breakdownRows.forEach(r => {
      const fgName = r.finishedGoodsName || selectedFgObj?.name || 'Finished Item';
      const fgNo = r.finishedGoodsNo || selectedFgObj?.fgNo || '';
      const key = r.finishedGoodsId || (r.finishedGoodsNo ? r.finishedGoodsNo.trim().toLowerCase() : '') || (r.finishedGoodsName ? r.finishedGoodsName.trim().toLowerCase() : '') || (selectedFgId || 'default-fg');

      if (!itemMap[key]) {
        const bom = getBomForFinishedGoods(r.finishedGoodsId || selectedFgId, fgNo || selectedFgObj?.fgNo, fgName || selectedFgObj?.name);
        const storeSheetItem = bom?.sheetItemId ? inventoryItems.find(it => it.id === bom.sheetItemId) : undefined;
        const currentSheetStock = Number(storeSheetItem?.currentStock ?? (storeSheetItem as any)?.quantity ?? 0);
        const ups = Math.max(1, r.ups || bom?.ups || bom?.piecesPerSheet || 1);
        const wastage = bom?.wastagePercent || 0;
        const activeFg = finishedGoods.find(f => f.id === r.finishedGoodsId) || selectedFgObj;
        const unitLabel = getRawMaterialUnitLabel(bom, activeFg, storeSheetItem);

        itemMap[key] = { 
          fgId: r.finishedGoodsId,
          fgNo, 
          fgName, 
          qty: 0, 
          value: 0,
          requiredSheets: 0,
          rawSheets: 0,
          ups,
          bomNo: bom?.bomNo || '',
          sheetItemName: bom?.sheetItemName || storeSheetItem?.name || '',
          sheetStock: currentSheetStock,
          hasBom: !!bom,
          wastagePercent: wastage,
          unitLabel
        };
      }
      itemMap[key].qty += r.quantity;
      itemMap[key].value += r.total;
    });

    // Calculate total sheets/rolls for each item as Total Quantity / UPS (rounded up to round figure)
    let totalRequiredSheetsAll = 0;
    const unitsSet = new Set<string>();
    Object.values(itemMap).forEach(item => {
      const effectiveUps = Math.max(1, item.ups);
      const exactUnits = item.qty / effectiveUps;
      item.rawSheets = exactUnits;
      // Ensure whole number round figure from exact units
      item.requiredSheets = Math.ceil(exactUnits);
      totalRequiredSheetsAll += item.requiredSheets;

      const u = item.unitLabel || 'Sheet';
      if (u === 'Roll') unitsSet.add('Rolls');
      else if (u === 'Sheet') unitsSet.add('Sheets');
      else unitsSet.add(u);
    });

    const primaryUnitLabel = unitsSet.size === 1 ? Array.from(unitsSet)[0] : (unitsSet.size > 1 ? 'Units' : 'Sheets');

    return { totalRows, totalQty, totalAmt, totalRequiredSheetsAll, primaryUnitLabel, styleMap, sizeMap, orderNoMap, itemMap };
  }, [breakdownRows, boms, inventoryItems, selectedFgObj, finishedGoods]);

  // Load Work Order for Edit / View
  const handleLoadWorkOrder = (wo: WorkOrder) => {
    setEditingWoId(wo.id);
    setWoNumber(wo.woNumber);
    setOrderNo(wo.orderNo || 'SO-001');
    setPoNo(wo.poNo || '');
    setOrderDate(wo.date);
    setDeliveryDate(wo.deliveryDate || '');
    setSelectedCustomerId(wo.customerId || '');
    setSelectedBuyerId(wo.buyerId || '');
    setSelectedSectionId(wo.sectionId || '');
    setSelectedFgId(wo.finishedGoodsId || '');
    setHeaderStyle(wo.style || '');
    setOrderCurrencyCode(wo.currencyCode || 'BDT');
    setOrderCurrencyId(wo.currencyId || '');
    setOrderConversionRate(wo.conversionRate || 120);
    setManualPriceRate(wo.rate || '');
    setIsManualPriceOverride(!!wo.manualPriceOverride);
    setIsFreeOfCost(!!wo.isFreeOfCost);
    setFocRefJobNo(wo.focRefJobNo || '');
    setFocRemark(wo.focRemark || '');
    setBreakdownRows(wo.breakdownRows || []);
    setWoStatus(wo.status as any);
    setWoAuditLogs(wo.auditLogs || []);

    // Reconstruct Selected Finished Goods Items from Work Order
    const loadedItemsMap = new Map<string, { id: string; fgNo: string; fgName: string; unit: string; rate: number; currencyCode?: string; currencyId?: string; priceSource: string; style?: string }>();
    if (wo.finishedGoodsId) {
      const fg = finishedGoods.find(f => f.id === wo.finishedGoodsId);
      loadedItemsMap.set(wo.finishedGoodsId, {
        id: wo.finishedGoodsId,
        fgNo: wo.finishedGoodsNo || fg?.fgNo || '',
        fgName: wo.finishedGoodsName || fg?.name || 'Item',
        unit: wo.finishedGoodsUnit || fg?.unit || 'PCS',
        rate: wo.rate || fg?.defaultPrice || 0,
        currencyCode: wo.currencyCode || 'BDT',
        currencyId: wo.currencyId || '',
        priceSource: wo.priceSource || 'Header Rate',
        style: wo.style
      });
    }
    (wo.breakdownRows || []).forEach(r => {
      if (r.finishedGoodsId && !loadedItemsMap.has(r.finishedGoodsId)) {
        const fg = finishedGoods.find(f => f.id === r.finishedGoodsId);
        loadedItemsMap.set(r.finishedGoodsId, {
          id: r.finishedGoodsId,
          fgNo: r.finishedGoodsNo || fg?.fgNo || '',
          fgName: r.finishedGoodsName || fg?.name || 'Item',
          unit: r.unit || fg?.unit || 'PCS',
          rate: r.rate,
          currencyCode: wo.currencyCode || 'BDT',
          currencyId: wo.currencyId || '',
          priceSource: r.priceSource || 'Breakdown Rate',
          style: r.style
        });
      }
    });
    setSelectedFgItems(Array.from(loadedItemsMap.values()));

    // Load process steps saved on work order or derive from section
    if (wo.selectedProcesses && wo.selectedProcesses.length > 0) {
      setSelectedWoProcesses(wo.selectedProcesses);
    } else if (wo.sectionId) {
      const sec = sections.find(s => s.id === wo.sectionId);
      const secName = sec?.name?.toLowerCase() || '';
      const secProcs = productionProcesses
        .filter(p => p.sectionId === wo.sectionId || (p.sectionName && p.sectionName.toLowerCase() === secName))
        .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

      setSelectedWoProcesses(secProcs.map((p, idx) => ({
        id: p.id,
        processCode: p.processCode || `PROC-${String(idx + 1).padStart(2, '0')}`,
        processName: p.processName,
        sequenceOrder: p.sequenceOrder || (idx + 1),
        isIncluded: true,
        notes: p.description || ''
      })));
    } else {
      setSelectedWoProcesses([]);
    }

    setShowWoDetailsModal(false);
    setShowWoListModal(false);
    setSubTab('entry');
    if (onSubTabChange) {
      onSubTabChange('entry');
    }
    showToast(`Loaded Work Order ${wo.woNumber} into Entry Form`, 'success');
  };

  // Auto-Code Open Handlers for Masters
  const handleOpenAddCustomerModal = () => {
    setEditingCustomer(null);
    const autoCode = `CUST-${String(customers.length + 1).padStart(4, '0')}`;
    setNewCustCode(autoCode);
    setNewCustName(''); setNewCustAddress(''); setNewCustContact(''); setNewCustPhone(''); setNewCustEmail('');
    setNewCustCountry('Bangladesh'); setNewCustPaymentTerms('30 Days Credit'); setNewCustDeliveryTerms('FOB Dhaka');
    setShowAddCustomerModal(true);
  };

  const handleOpenAddBuyerModal = () => {
    setEditingBuyer(null);
    const autoCode = `BUY-${String(buyers.length + 1).padStart(4, '0')}`;
    setNewBuyerCode(autoCode);
    setNewBuyerName(''); setNewBuyerCustId(selectedCustomerId || ''); setNewBuyerContact(''); setNewBuyerPhone(''); setNewBuyerEmail('');
    setShowAddBuyerModal(true);
  };

  const handleOpenAddCategoryModal = () => {
    setEditingCategory(null);
    const autoCode = `CAT-${String(fgCategories.length + 1).padStart(2, '0')}`;
    setNewCatCode(autoCode);
    setNewCatName(''); setNewCatDesc('');
    setShowAddCategoryModal(true);
  };

  const handleOpenAddSubCategoryModal = () => {
    setEditingSubCategory(null);
    const autoCode = `SUBCAT-${String(fgSubCategories.length + 1).padStart(2, '0')}`;
    setNewSubCatCode(autoCode);
    setNewSubCatCatId(''); setNewSubCatName(''); setNewSubCatDesc('');
    setShowAddSubCategoryModal(true);
  };

  const handleOpenAddFgModal = () => {
    setEditingFg(null);
    const autoCode = `FG-${String(finishedGoods.length + 1).padStart(5, '0')}`;
    setNewFgNo(autoCode);
    setNewFgName(''); setNewFgCustId(''); setNewFgCustName(''); setNewFgCatId(''); setNewFgCatName(''); setNewFgSubCatId(''); setNewFgSubCatName(''); setNewFgUnit('PCS'); setNewFgPrice(''); setNewFgSpec('');
    setShowAddFgModal(true);
  };

  const handleOpenAddCurrencyModal = () => {
    setEditingCurrency(null);
    setNewCurrencyCode('');
    setNewCurrencyName('');
    setNewCurrencySymbol('$');
    setNewCurrencyRate('');
    setShowAddCurrencyModal(true);
  };

  const handleOpenAddSectionModal = () => {
    setEditingSection(null);
    const autoCode = `SEC-${String(sections.length + 1).padStart(2, '0')}`;
    setNewSectionCode(autoCode);
    setNewSectionName('');
    setShowAddSectionModal(true);
  };

  // Section Master CRUD Handlers
  const executeSaveSection = async () => {
    try {
      const code = newSectionCode.trim() || `SEC-${String(sections.length + 1).padStart(2, '0')}`;
      if (editingSection) {
        await updateDoc(doc(db, 'sections', editingSection.id), {
          sectionCode: code,
          name: newSectionName.trim(),
          updatedAt: Timestamp.now()
        });
        showToast(`Section '${newSectionName}' updated!`, 'success');
      } else {
        const res = await addDoc(collection(db, 'sections'), {
          sectionCode: code,
          name: newSectionName.trim(),
          status: 'active',
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        setSelectedSectionId(res.id);
        showToast(`Section '${newSectionName}' created!`, 'success');
      }
      setShowAddSectionModal(false);
      setEditingSection(null);
      setNewSectionCode('');
      setNewSectionName('');
    } catch (err: any) {
      showToast('Error saving section: ' + err.message, 'error');
    }
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) {
      showToast('Section name is required.', 'error');
      return;
    }
    if (editingSection) {
      requestActionConfirmation({
        title: 'Confirm Section Update?',
        message: `Are you sure you want to update section "${editingSection.name}"?`,
        type: 'update',
        confirmText: 'Yes, Update Section',
        details: [
          { label: 'Section Code', value: newSectionCode.trim() || editingSection.sectionCode || 'N/A' },
          { label: 'Section Name', value: newSectionName.trim() }
        ],
        onConfirm: executeSaveSection
      });
    } else {
      executeSaveSection();
    }
  };

  const handleDeleteSection = (section: SectionMaster) => {
    requestActionConfirmation({
      title: 'Delete Section?',
      message: `Are you sure you want to delete section "${section.name}"?`,
      type: 'delete',
      confirmText: 'Yes, Delete Section',
      details: [
        { label: 'Section Code', value: section.sectionCode || 'N/A' },
        { label: 'Section Name', value: section.name }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'sections', section.id));
          if (selectedSectionId === section.id) setSelectedSectionId('');
          showToast(`Section "${section.name}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting section: ' + err.message, 'error');
        }
      }
    });
  };

  const handleDeleteAllSections = () => {
    if (sections.length === 0) {
      showToast('No sections to delete.', 'info');
      return;
    }
    requestActionConfirmation({
      title: 'Delete All Sections?',
      message: `Are you sure you want to delete ALL ${sections.length} section(s)? This will permanently clear all existing sections.`,
      type: 'delete',
      confirmText: 'Yes, Delete All Sections',
      details: [
        { label: 'Total Sections to Delete', value: `${sections.length}` }
      ],
      onConfirm: async () => {
        try {
          for (const sec of sections) {
            await deleteDoc(doc(db, 'sections', sec.id));
          }
          setSelectedSectionId('');
          showToast('All sections deleted successfully!', 'success');
        } catch (err: any) {
          showToast('Error deleting sections: ' + err.message, 'error');
        }
      }
    });
  };

  // Process Master CRUD Handlers
  const handleOpenAddProcessModal = () => {
    setEditingProcess(null);
    const autoCode = `PROC-${String(productionProcesses.length + 1).padStart(2, '0')}`;
    setNewProcessCode(autoCode);
    setNewProcessName('');
    setNewProcessSectionId(sections[0]?.id || '');
    setNewProcessSeq(productionProcesses.length + 1);
    setNewProcessDesc('');
    setShowAddProcessModal(true);
  };

  const executeSaveProcess = async () => {
    try {
      const code = newProcessCode.trim() || `PROC-${String(productionProcesses.length + 1).padStart(2, '0')}`;
      const sec = sections.find(s => s.id === newProcessSectionId);
      const secName = sec ? sec.name : 'General';

      if (editingProcess) {
        await updateDoc(doc(db, 'production_processes', editingProcess.id), {
          processCode: code,
          processName: newProcessName.trim(),
          sectionId: newProcessSectionId,
          sectionName: secName,
          sequenceOrder: Number(newProcessSeq) || 1,
          description: newProcessDesc.trim(),
          updatedAt: Timestamp.now()
        });
        showToast(`Production Process '${newProcessName.trim()}' updated!`, 'success');
      } else {
        await addDoc(collection(db, 'production_processes'), {
          processCode: code,
          processName: newProcessName.trim(),
          sectionId: newProcessSectionId,
          sectionName: secName,
          sequenceOrder: Number(newProcessSeq) || 1,
          description: newProcessDesc.trim(),
          status: 'active',
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        showToast(`Production Process '${newProcessName.trim()}' created for section ${secName}!`, 'success');
      }
      setShowAddProcessModal(false);
      setEditingProcess(null);
    } catch (err: any) {
      showToast('Error saving process: ' + err.message, 'error');
    }
  };

  const handleSaveProcess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProcessName.trim()) {
      showToast('Process name is required.', 'error');
      return;
    }
    if (!newProcessSectionId) {
      showToast('Please select a section for this process.', 'error');
      return;
    }
    if (editingProcess) {
      requestActionConfirmation({
        title: 'Confirm Process Update?',
        message: `Are you sure you want to update production process "${editingProcess.processName}"?`,
        type: 'update',
        confirmText: 'Yes, Update Process',
        details: [
          { label: 'Process Code', value: newProcessCode.trim() || editingProcess.processCode || 'N/A' },
          { label: 'Process Name', value: newProcessName.trim() },
          { label: 'Section', value: sections.find(s => s.id === newProcessSectionId)?.name || 'N/A' }
        ],
        onConfirm: executeSaveProcess
      });
    } else {
      executeSaveProcess();
    }
  };

  const handleDeleteProcess = (proc: ProductionProcessMaster) => {
    requestActionConfirmation({
      title: 'Delete Production Process?',
      message: `Are you sure you want to delete process "${proc.processName}" from section "${proc.sectionName}"?`,
      type: 'delete',
      confirmText: 'Yes, Delete Process',
      details: [
        { label: 'Process Code', value: proc.processCode || 'N/A' },
        { label: 'Process Name', value: proc.processName },
        { label: 'Section', value: proc.sectionName }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'production_processes', proc.id));
          showToast(`Process "${proc.processName}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting process: ' + err.message, 'error');
        }
      }
    });
  };

  // Quick Master Creation & Management Handlers with Popup Confirmations
  const executeSaveCustomer = async () => {
    try {
      const code = newCustCode.trim() || `CUST-${String(customers.length + 1).padStart(4, '0')}`;
      const numConversionRate = Number(newCustConversionRate) || (newCustDefaultCurrency === 'BDT' ? 1 : 120);
      const custData = {
        customerCode: code,
        name: newCustName.trim(),
        address: newCustAddress.trim(),
        contactPerson: newCustContact.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim(),
        country: newCustCountry.trim(),
        paymentTerms: newCustPaymentTerms.trim(),
        deliveryTerms: newCustDeliveryTerms.trim(),
        defaultCurrency: newCustDefaultCurrency.trim() || 'USD',
        conversionRate: numConversionRate,
        conversionRateBDT: numConversionRate
      };

      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          ...custData,
          updatedAt: Timestamp.now()
        });
        showToast(`Customer '${newCustName}' updated!`, 'success');
      } else {
        const res = await addDoc(collection(db, 'customers'), {
          ...custData,
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        setSelectedCustomerId(res.id);
        showToast(`Customer '${newCustName}' created!`, 'success');
      }
      setShowAddCustomerModal(false);
      setEditingCustomer(null);
      setNewCustCode(''); setNewCustName(''); setNewCustAddress(''); setNewCustContact(''); setNewCustPhone(''); setNewCustEmail('');
      setNewCustDefaultCurrency('USD'); setNewCustConversionRate('120');
    } catch (err: any) {
      showToast('Error saving customer: ' + err.message, 'error');
    }
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    if (editingCustomer) {
      requestActionConfirmation({
        title: 'Confirm Customer Update?',
        message: `Are you sure you want to save changes for customer "${editingCustomer.name}"?`,
        type: 'update',
        confirmText: 'Yes, Update Customer',
        details: [
          { label: 'Customer Code', value: newCustCode.trim() || editingCustomer.customerCode || 'N/A' },
          { label: 'Customer Name', value: newCustName.trim() },
          { label: 'Contact Person', value: newCustContact.trim() || 'N/A' }
        ],
        onConfirm: executeSaveCustomer
      });
    } else {
      executeSaveCustomer();
    }
  };

  const handleDeleteCustomer = (cust: Customer) => {
    requestActionConfirmation({
      title: 'Delete Customer?',
      message: `Are you sure you want to delete customer "${cust.name}"? This action cannot be undone.`,
      type: 'delete',
      confirmText: 'Yes, Delete Customer',
      details: [
        { label: 'Customer Code', value: cust.customerCode || 'N/A' },
        { label: 'Customer Name', value: cust.name }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'customers', cust.id));
          if (selectedCustomerId === cust.id) setSelectedCustomerId('');
          showToast(`Customer "${cust.name}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting customer: ' + err.message, 'error');
        }
      }
    });
  };

  // --- CUSTOMER MASTER CSV IMPORT / EXPORT / TEMPLATE ---
  const handleDownloadCustomerSampleCsv = () => {
    const sampleData = [
      {
        'Customer Code': 'CUST-0001',
        'Customer Name': 'Apex Footwear Ltd',
        'Address': 'Plot 45, Sector 7, Uttara, Dhaka',
        'Contact Person': 'Mr. Rafiqul Islam',
        'Phone': '+8801711000001',
        'Email': 'rafiq@apex.com',
        'Country': 'Bangladesh',
        'Payment Terms': '30 Days Credit',
        'Delivery Terms': 'FOB Dhaka'
      },
      {
        'Customer Code': 'CUST-0002',
        'Customer Name': 'Ha-Meem Denim Processing',
        'Address': 'Ashulia, Savar, Dhaka',
        'Contact Person': 'Md. Kamal Hossain',
        'Phone': '+8801819000002',
        'Email': 'kamal@hameem.com',
        'Country': 'Bangladesh',
        'Payment Terms': '45 Days Credit',
        'Delivery Terms': 'Ex-Factory'
      }
    ];
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Customer_Master_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded Customer Master CSV Template', 'success');
  };

  const handleUploadCustomerCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        if (!rows || rows.length === 0) {
          showToast('CSV file is empty or formatted incorrectly.', 'error');
          return;
        }

        let successCount = 0;
        let skippedCount = 0;
        const bId = userProfile.businessId;
        const uid = userProfile.uid;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = (row['Customer Name'] || row['Customer'] || row['name'] || row['Name'] || row['Party Name'] || '').toString().trim();
          if (!name) {
            skippedCount++;
            continue;
          }

          const existing = customers.find(c => (c.name || '').toLowerCase() === name.toLowerCase());
          const code = (row['Customer Code'] || row['Code'] || row['code'] || row['customerCode'] || '').toString().trim() || 
            `CUST-${String(customers.length + successCount + 1).padStart(4, '0')}`;
          const address = (row['Address'] || row['address'] || '').toString().trim();
          const contactPerson = (row['Contact Person'] || row['Contact'] || row['contactPerson'] || '').toString().trim();
          const phone = (row['Phone'] || row['Mobile'] || row['phone'] || '').toString().trim();
          const email = (row['Email'] || row['email'] || '').toString().trim();
          const country = (row['Country'] || row['country'] || '').toString().trim() || 'Bangladesh';
          const paymentTerms = (row['Payment Terms'] || row['paymentTerms'] || '').toString().trim() || '30 Days Credit';
          const deliveryTerms = (row['Delivery Terms'] || row['deliveryTerms'] || '').toString().trim() || 'FOB Dhaka';

          try {
            if (existing) {
              await updateDoc(doc(db, 'customers', existing.id), {
                customerCode: code || existing.customerCode,
                address: address || existing.address || '',
                contactPerson: contactPerson || existing.contactPerson || '',
                phone: phone || existing.phone || '',
                email: email || existing.email || '',
                country: country || existing.country || 'Bangladesh',
                paymentTerms: paymentTerms || existing.paymentTerms || '30 Days Credit',
                deliveryTerms: deliveryTerms || existing.deliveryTerms || 'FOB Dhaka',
                updatedAt: Timestamp.now()
              });
              successCount++;
            } else {
              await addDoc(collection(db, 'customers'), {
                customerCode: code,
                name: name,
                address: address,
                contactPerson: contactPerson,
                phone: phone,
                email: email,
                country: country,
                paymentTerms: paymentTerms,
                deliveryTerms: deliveryTerms,
                businessId: bId,
                ownerId: uid,
                createdAt: Timestamp.now()
              });
              successCount++;
            }
          } catch (err: any) {
            console.error('Error importing customer row:', err);
          }
        }

        if (customerCsvInputRef.current) {
          customerCsvInputRef.current.value = '';
        }

        showToast(`Successfully imported/updated ${successCount} customers from CSV (${skippedCount} skipped)!`, 'success');
      },
      error: (err) => {
        showToast('CSV Parsing error: ' + err.message, 'error');
      }
    });
  };

  const handleExportCustomersCsv = () => {
    if (customers.length === 0) {
      showToast('No customers to export.', 'info');
      return;
    }
    const exportData = customers.map(c => ({
      'Customer Code': c.customerCode || '',
      'Customer Name': c.name || '',
      'Address': c.address || '',
      'Contact Person': c.contactPerson || '',
      'Phone': c.phone || '',
      'Email': c.email || '',
      'Country': c.country || 'Bangladesh',
      'Payment Terms': c.paymentTerms || '',
      'Delivery Terms': c.deliveryTerms || ''
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Customer_Master_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Customer Master to CSV', 'success');
  };

  const executeSaveBuyer = async () => {
    try {
      const code = newBuyerCode.trim() || `BUY-${String(buyers.length + 1).padStart(4, '0')}`;
      if (editingBuyer) {
        await updateDoc(doc(db, 'buyers', editingBuyer.id), {
          buyerCode: code,
          name: newBuyerName.trim(),
          customerId: newBuyerCustId || selectedCustomerId,
          contactPerson: newBuyerContact.trim(),
          phone: newBuyerPhone.trim(),
          email: newBuyerEmail.trim(),
          updatedAt: Timestamp.now()
        });
        showToast(`Buyer '${newBuyerName}' updated!`, 'success');
      } else {
        const res = await addDoc(collection(db, 'buyers'), {
          buyerCode: code,
          name: newBuyerName.trim(),
          customerId: newBuyerCustId || selectedCustomerId,
          contactPerson: newBuyerContact.trim(),
          phone: newBuyerPhone.trim(),
          email: newBuyerEmail.trim(),
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        setSelectedBuyerId(res.id);
        showToast(`Buyer '${newBuyerName}' created!`, 'success');
      }
      setShowAddBuyerModal(false);
      setEditingBuyer(null);
      setNewBuyerCode(''); setNewBuyerName(''); setNewBuyerContact(''); setNewBuyerPhone(''); setNewBuyerEmail('');
    } catch (err: any) {
      showToast('Error saving buyer: ' + err.message, 'error');
    }
  };

  const handleSaveBuyer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyerName.trim()) return;

    if (editingBuyer) {
      requestActionConfirmation({
        title: 'Confirm Buyer Update?',
        message: `Are you sure you want to update buyer "${editingBuyer.name}"?`,
        type: 'update',
        confirmText: 'Yes, Update Buyer',
        details: [
          { label: 'Buyer Code', value: newBuyerCode.trim() || editingBuyer.buyerCode || 'N/A' },
          { label: 'Buyer Name', value: newBuyerName.trim() }
        ],
        onConfirm: executeSaveBuyer
      });
    } else {
      executeSaveBuyer();
    }
  };

  const handleDeleteBuyer = (buyer: Buyer) => {
    requestActionConfirmation({
      title: 'Delete Buyer?',
      message: `Are you sure you want to delete buyer "${buyer.name}"?`,
      type: 'delete',
      confirmText: 'Yes, Delete Buyer',
      details: [
        { label: 'Buyer Code', value: buyer.buyerCode || 'N/A' },
        { label: 'Buyer Name', value: buyer.name }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'buyers', buyer.id));
          if (selectedBuyerId === buyer.id) setSelectedBuyerId('');
          showToast(`Buyer "${buyer.name}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting buyer: ' + err.message, 'error');
        }
      }
    });
  };

  const executeSaveCategory = async () => {
    try {
      const code = newCatCode.trim() || `CAT-${String(fgCategories.length + 1).padStart(2, '0')}`;
      if (editingCategory) {
        await updateDoc(doc(db, 'fg_categories', editingCategory.id), {
          categoryCode: code,
          name: newCatName.trim(),
          description: newCatDesc.trim(),
          updatedAt: Timestamp.now()
        });
        showToast(`Category '${newCatName}' updated!`, 'success');
      } else {
        const res = await addDoc(collection(db, 'fg_categories'), {
          categoryCode: code,
          name: newCatName.trim(),
          description: newCatDesc.trim(),
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        setNewFgCatId(res.id);
        setNewFgCatName(newCatName.trim());
        showToast(`Category '${newCatName}' created!`, 'success');
      }
      setShowAddCategoryModal(false);
      setEditingCategory(null);
      setNewCatCode(''); setNewCatName(''); setNewCatDesc('');
    } catch (err: any) {
      showToast('Error saving Category: ' + err.message, 'error');
    }
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      showToast('Category name is required.', 'error');
      return;
    }
    if (editingCategory) {
      requestActionConfirmation({
        title: 'Confirm Category Update?',
        message: `Are you sure you want to save updates for category "${editingCategory.name}"?`,
        type: 'update',
        confirmText: 'Yes, Update Category',
        details: [
          { label: 'Category Code', value: newCatCode.trim() || editingCategory.categoryCode || 'N/A' },
          { label: 'Category Name', value: newCatName.trim() }
        ],
        onConfirm: executeSaveCategory
      });
    } else {
      executeSaveCategory();
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    requestActionConfirmation({
      title: 'Delete Category?',
      message: `Are you sure you want to delete category "${catName}"? This action cannot be undone.`,
      type: 'delete',
      confirmText: 'Yes, Delete Category',
      details: [
        { label: 'Category Name', value: catName }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'fg_categories', catId));
          showToast(`Category "${catName}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting Category: ' + err.message, 'error');
        }
      }
    });
  };

  const executeSaveSubCategory = async () => {
    try {
      const parentCat = fgCategories.find(c => c.id === newSubCatCatId);
      const code = newSubCatCode.trim() || `SUBCAT-${String(fgSubCategories.length + 1).padStart(2, '0')}`;
      if (editingSubCategory) {
        await updateDoc(doc(db, 'fg_subcategories', editingSubCategory.id), {
          categoryId: newSubCatCatId || '',
          categoryName: parentCat?.name || '',
          subCategoryCode: code,
          name: newSubCatName.trim(),
          description: newSubCatDesc.trim(),
          updatedAt: Timestamp.now()
        });
        showToast(`Sub-Category '${newSubCatName}' updated!`, 'success');
      } else {
        const res = await addDoc(collection(db, 'fg_subcategories'), {
          categoryId: newSubCatCatId || '',
          categoryName: parentCat?.name || '',
          subCategoryCode: code,
          name: newSubCatName.trim(),
          description: newSubCatDesc.trim(),
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        setNewFgSubCatId(res.id);
        setNewFgSubCatName(newSubCatName.trim());
        showToast(`Sub-Category '${newSubCatName}' created!`, 'success');
      }
      setShowAddSubCategoryModal(false);
      setEditingSubCategory(null);
      setNewSubCatCatId(''); setNewSubCatCode(''); setNewSubCatName(''); setNewSubCatDesc('');
    } catch (err: any) {
      showToast('Error saving Sub-Category: ' + err.message, 'error');
    }
  };

  const handleSaveSubCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCatName.trim()) {
      showToast('Sub-Category name is required.', 'error');
      return;
    }
    if (editingSubCategory) {
      requestActionConfirmation({
        title: 'Confirm Sub-Category Update?',
        message: `Are you sure you want to update sub-category "${editingSubCategory.name}"?`,
        type: 'update',
        confirmText: 'Yes, Update Sub-Category',
        details: [
          { label: 'Sub-Category Name', value: newSubCatName.trim() }
        ],
        onConfirm: executeSaveSubCategory
      });
    } else {
      executeSaveSubCategory();
    }
  };

  const handleDeleteSubCategory = async (subCatId: string, subCatName: string) => {
    requestActionConfirmation({
      title: 'Delete Sub-Category?',
      message: `Are you sure you want to delete sub-category "${subCatName}"?`,
      type: 'delete',
      confirmText: 'Yes, Delete Sub-Category',
      details: [
        { label: 'Sub-Category Name', value: subCatName }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'fg_subcategories', subCatId));
          showToast(`Sub-Category "${subCatName}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting Sub-Category: ' + err.message, 'error');
        }
      }
    });
  };

  const executeSaveFg = async () => {
    try {
      const code = newFgNo.trim() || `FG-${String(finishedGoods.length + 1).padStart(5, '0')}`;
      const catObj = fgCategories.find(c => c.id === newFgCatId) || null;
      const subCatObj = fgSubCategories.find(s => s.id === newFgSubCatId) || null;
      const custObj = customers.find(c => c.id === newFgCustId) || null;

      const catName = catObj?.name || newFgCatName.trim() || '';
      const subCatName = subCatObj?.name || newFgSubCatName.trim() || '';
      const custName = custObj?.name || newFgCustName.trim() || '';

      const priceVal = newFgPrice !== '' ? Number(newFgPrice) : 0;
      const unitVal = newFgUnit.trim() || 'PCS';

      if (editingFg) {
        await updateDoc(doc(db, 'finished_goods', editingFg.id), {
          fgNo: code,
          name: newFgName.trim(),
          customerId: newFgCustId || '',
          customerName: custName,
          categoryId: newFgCatId || '',
          categoryName: catName,
          productCategory: catName,
          subCategoryId: newFgSubCatId || '',
          subCategoryName: subCatName,
          productType: subCatName,
          unit: unitVal,
          defaultPrice: priceVal,
          defaultSpecification: newFgSpec.trim(),
          updatedAt: Timestamp.now()
        });
        showToast(`Finished Goods '${newFgName}' updated!`, 'success');
      } else {
        await addDoc(collection(db, 'finished_goods'), {
          fgNo: code,
          name: newFgName.trim(),
          customerId: newFgCustId || '',
          customerName: custName,
          categoryId: newFgCatId || '',
          categoryName: catName,
          productCategory: catName,
          subCategoryId: newFgSubCatId || '',
          subCategoryName: subCatName,
          productType: subCatName,
          unit: unitVal,
          defaultPrice: priceVal,
          defaultSpecification: newFgSpec.trim(),
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        showToast(`Finished Goods '${newFgName}' created!`, 'success');
      }
      setShowAddFgModal(false);
      setEditingFg(null);
      setNewFgNo(''); setNewFgName(''); setNewFgCustId(''); setNewFgCustName(''); setNewFgCatId(''); setNewFgCatName(''); setNewFgSubCatId(''); setNewFgSubCatName(''); setNewFgUnit('PCS'); setNewFgPrice(''); setNewFgSpec('');
    } catch (err: any) {
      showToast('Error saving Finished Goods: ' + err.message, 'error');
    }
  };

  const executeSaveCurrency = async () => {
    try {
      const code = newCurrencyCode.trim().toUpperCase();
      const rateVal = newCurrencyRate !== '' ? Number(newCurrencyRate) : 1;

      // Duplicate check (prevent creating duplicate currencies)
      const duplicate = currencies.find(c => c.id !== editingCurrency?.id && (c.code || '').trim().toUpperCase() === code);
      if (duplicate) {
        showToast(`Currency '${code}' already exists (Current rate: ৳${duplicate.exchangeRateToBDT || duplicate.rateToBDT}). Please edit the existing entry or use a different code.`, 'error');
        return;
      }

      if (editingCurrency) {
        await updateDoc(doc(db, 'currencies', editingCurrency.id), {
          code,
          name: newCurrencyName.trim(),
          symbol: newCurrencySymbol.trim() || '$',
          exchangeRateToBDT: rateVal,
          rateToBDT: rateVal,
          updatedAt: Timestamp.now()
        });
        showToast(`Currency '${code}' updated!`, 'success');
      } else {
        await addDoc(collection(db, 'currencies'), {
          code,
          name: newCurrencyName.trim(),
          symbol: newCurrencySymbol.trim() || '$',
          exchangeRateToBDT: rateVal,
          rateToBDT: rateVal,
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });
        showToast(`Currency '${code}' created!`, 'success');
      }
      setShowAddCurrencyModal(false);
      setEditingCurrency(null);
      setNewCurrencyCode('');
      setNewCurrencyName('');
      setNewCurrencySymbol('');
      setNewCurrencyRate('');
    } catch (err: any) {
      showToast('Error saving Currency: ' + err.message, 'error');
    }
  };

  const handleSaveCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurrencyCode.trim()) {
      showToast('Currency code is required (e.g. USD, EUR, GBP).', 'error');
      return;
    }
    if (!newCurrencyName.trim()) {
      showToast('Currency name is required (e.g. US Dollar).', 'error');
      return;
    }
    if (editingCurrency) {
      requestActionConfirmation({
        title: 'Confirm Currency Update?',
        message: `Are you sure you want to update currency "${editingCurrency.code}"?`,
        type: 'update',
        confirmText: 'Yes, Update Currency',
        details: [
          { label: 'Currency Code', value: newCurrencyCode.trim().toUpperCase() },
          { label: 'Currency Name', value: newCurrencyName.trim() },
          { label: 'Exchange Rate', value: `৳ ${newCurrencyRate} BDT` }
        ],
        onConfirm: executeSaveCurrency
      });
    } else {
      executeSaveCurrency();
    }
  };

  const handleDeleteCurrency = async (currId: string, currCode: string) => {
    requestActionConfirmation({
      title: 'Delete Currency?',
      message: `Are you sure you want to delete currency "${currCode}"?`,
      type: 'delete',
      confirmText: 'Yes, Delete Currency',
      details: [
        { label: 'Currency Code', value: currCode }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'currencies', currId));
          setSelectedCurrencyIds(prev => prev.filter(id => id !== currId));
          showToast(`Currency "${currCode}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting Currency: ' + err.message, 'error');
        }
      }
    });
  };

  const handleDeleteSelectedCurrencies = () => {
    if (selectedCurrencyIds.length === 0) {
      showToast('Please select at least one currency to delete.', 'info');
      return;
    }
    requestActionConfirmation({
      title: 'Delete Selected Currencies?',
      message: `Are you sure you want to delete ${selectedCurrencyIds.length} selected currency records?`,
      type: 'delete',
      confirmText: `Yes, Delete ${selectedCurrencyIds.length} Currencies`,
      details: [
        { label: 'Selected Count', value: `${selectedCurrencyIds.length} currencies` }
      ],
      onConfirm: async () => {
        try {
          // Firestore batch support up to 450 items per batch
          const idsToDelete = [...selectedCurrencyIds];
          for (let i = 0; i < idsToDelete.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = idsToDelete.slice(i, i + 400);
            chunk.forEach(id => {
              batch.delete(doc(db, 'currencies', id));
            });
            await batch.commit();
          }
          setSelectedCurrencyIds([]);
          showToast(`Successfully deleted ${idsToDelete.length} currencies.`, 'success');
        } catch (err: any) {
          showToast('Error deleting selected currencies: ' + err.message, 'error');
        }
      }
    });
  };

  const handleDeleteAllCurrencies = () => {
    const totalCount = currencies.length;
    if (totalCount === 0) {
      showToast('No currencies found to delete.', 'info');
      return;
    }
    requestActionConfirmation({
      title: '⚠️ Delete All Currencies (Complete Reset)?',
      message: `Are you sure you want to delete ALL ${totalCount} currency records in Currency Master? This will clear all existing currency entries from your database so you can start fresh.`,
      type: 'delete',
      confirmText: `Yes, Delete All (${totalCount}) Currencies`,
      details: [
        { label: 'Total Currencies to Delete', value: `${totalCount} records` },
        { label: 'System Action', value: 'Complete cleanup of currency database' }
      ],
      onConfirm: async () => {
        try {
          // Fetch all docs to ensure nothing is missed
          const qSnap = await getDocs(query(collection(db, 'currencies'), where('businessId', '==', userProfile.businessId)));
          const docsToDelete = qSnap.docs.length > 0 ? qSnap.docs : currencies.map(c => ({ id: c.id }));
          
          for (let i = 0; i < docsToDelete.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = docsToDelete.slice(i, i + 400);
            chunk.forEach(d => {
              batch.delete(doc(db, 'currencies', d.id));
            });
            await batch.commit();
          }

          setSelectedCurrencyIds([]);
          showToast(`All ${docsToDelete.length} currencies have been completely deleted. You can now set up fresh currencies!`, 'success');
        } catch (err: any) {
          showToast('Error deleting all currencies: ' + err.message, 'error');
        }
      }
    });
  };

  const handleSeedStandardCurrencies = async () => {
    const standardCurrencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$', rateToBDT: 122.50 },
      { code: 'EUR', name: 'Euro', symbol: '€', rateToBDT: 132.00 },
      { code: 'GBP', name: 'British Pound', symbol: '£', rateToBDT: 155.00 },
      { code: 'RMB', name: 'Chinese Yuan (RMB)', symbol: '¥', rateToBDT: 17.00 },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', rateToBDT: 1.45 },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rateToBDT: 33.20 },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rateToBDT: 92.00 },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rateToBDT: 89.50 },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rateToBDT: 80.00 },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rateToBDT: 0.82 }
    ];

    try {
      const existingCodes = new Set(currencies.map(c => (c.code || '').toUpperCase()));
      const batch = writeBatch(db);
      let addedCount = 0;

      for (const item of standardCurrencies) {
        if (!existingCodes.has(item.code)) {
          const newDocRef = doc(collection(db, 'currencies'));
          batch.set(newDocRef, {
            code: item.code,
            name: item.name,
            symbol: item.symbol,
            exchangeRateToBDT: item.rateToBDT,
            rateToBDT: item.rateToBDT,
            businessId: userProfile.businessId,
            ownerId: userProfile.uid,
            createdAt: Timestamp.now()
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        await batch.commit();
        showToast(`Added ${addedCount} standard export currencies with baseline rates.`, 'success');
      } else {
        showToast('All standard currencies are already in your list.', 'info');
      }
    } catch (err: any) {
      showToast('Error seeding standard currencies: ' + err.message, 'error');
    }
  };

  const handleSaveFg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFgName.trim()) {
      showToast('Finished Goods item name is required.', 'error');
      return;
    }
    if (!newFgUnit || !newFgUnit.trim()) {
      showToast('Unit of Measurement is mandatory. Please select a unit.', 'error');
      return;
    }
    if (editingFg) {
      requestActionConfirmation({
        title: 'Confirm Finished Goods Update?',
        message: `Are you sure you want to update Finished Goods item "${editingFg.name}"?`,
        type: 'update',
        confirmText: 'Yes, Update Item',
        details: [
          { label: 'Customer', value: newFgCustName || 'General / All Customers' },
          { label: 'FG Code', value: newFgNo.trim() || editingFg.fgNo },
          { label: 'Item Name', value: newFgName.trim() },
          { label: 'Unit', value: newFgUnit.trim() },
          { label: 'Default Rate', value: newFgPrice !== '' ? `৳ ${newFgPrice}` : 'Optional / None' }
        ],
        onConfirm: executeSaveFg
      });
    } else {
      executeSaveFg();
    }
  };

  const handleDeleteFg = async (fgId: string, fgName: string) => {
    requestActionConfirmation({
      title: 'Delete Finished Goods?',
      message: `Are you sure you want to delete Finished Goods "${fgName}"?`,
      type: 'delete',
      confirmText: 'Yes, Delete Item',
      details: [
        { label: 'Item Name', value: fgName }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'finished_goods', fgId));
          if (selectedFgId === fgId) setSelectedFgId('');
          showToast(`Finished Goods "${fgName}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting Finished Goods: ' + err.message, 'error');
        }
      }
    });
  };

  const canDeletePriceMaster = checkActionPermission(userProfile, 'sales-price-master', 'delete', roles) || isUserSuperAdmin(userProfile);

  const executeSavePrice = async () => {
    try {
      const custObj = customers.find(c => c.id === newPriceCustId);
      const fgObj = finishedGoods.find(f => f.id === newPriceFgId);

      const approvalCheck = await checkPageApprovalRule('sales-price-master', userProfile.businessId, userProfile, Number(newPriceRate));

      if (editingPrice) {
        if (approvalCheck.required) {
          // Edit existing price -> Requires approval before updating active rate
          await updateDoc(doc(db, 'price_masters', editingPrice.id), {
            customerId: newPriceCustId,
            customerName: custObj?.name || '',
            finishedGoodsId: newPriceFgId,
            finishedGoodsNo: fgObj?.fgNo || '',
            finishedGoodsName: fgObj?.name || '',
            status: 'pending_approval',
            pendingRate: Number(newPriceRate),
            pendingStyle: newPriceStyle.trim(),
            pendingCurrencyCode: newPriceCurrCode || 'BDT',
            pendingCurrencyId: newPriceCurrId || '',
            pendingUnit: newPriceUnit || fgObj?.unit || 'PCS',
            pendingEffectiveDate: newPriceEffDate,
            requestedBy: userProfile?.displayName || userProfile?.name || userProfile?.employeeName || userProfile?.email || 'User',
            requestedByUid: userProfile?.uid || (userProfile as any)?.id || '',
            requestedByEmail: userProfile?.email || '',
            requestedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });

          // Submit to central approvalRequests queue
          try {
            const reqSummary = `Price change for ${custObj?.name || 'Customer'} - ${fgObj?.name || 'Item'}: Rate ${getCurrencySymbol(editingPrice.currencyCode || 'BDT')} ${editingPrice.rate.toFixed(2)} -> ${getCurrencySymbol(newPriceCurrCode || 'BDT')} ${Number(newPriceRate).toFixed(2)} / ${newPriceUnit || fgObj?.unit || 'PCS'}`;
            await submitDocumentForApproval(
              userProfile.businessId,
              'sales-price-master',
              'Sales Price Master',
              'PRICE_MASTER_UPDATE',
              'price_masters',
              editingPrice.id,
              reqSummary,
              userProfile,
              approvalCheck,
              Number(newPriceRate),
              newPriceCurrCode || 'BDT'
            );
          } catch (apprErr) {
            console.warn('Could not register central approval request:', apprErr);
          }

          showToast('Price change submitted for approval! Request sent to designated approver.', 'info');
        } else {
          // Approval is OFF -> Update directly and activate immediately
          await updateDoc(doc(db, 'price_masters', editingPrice.id), {
            customerId: newPriceCustId,
            customerName: custObj?.name || '',
            finishedGoodsId: newPriceFgId,
            finishedGoodsNo: fgObj?.fgNo || '',
            finishedGoodsName: fgObj?.name || '',
            rate: Number(newPriceRate),
            style: newPriceStyle.trim(),
            currencyCode: newPriceCurrCode || 'BDT',
            currencyId: newPriceCurrId || '',
            unit: newPriceUnit || fgObj?.unit || 'PCS',
            effectiveDate: newPriceEffDate,
            status: 'active',
            pendingRate: deleteField(),
            pendingStyle: deleteField(),
            pendingCurrencyCode: deleteField(),
            pendingCurrencyId: deleteField(),
            pendingUnit: deleteField(),
            pendingEffectiveDate: deleteField(),
            updatedAt: Timestamp.now()
          });

          showToast('Price Master entry updated successfully!', 'success');
        }
      } else {
        // Creating new price rule
        const newDocRef = await addDoc(collection(db, 'price_masters'), {
          customerId: newPriceCustId,
          customerName: custObj?.name || '',
          finishedGoodsId: newPriceFgId,
          finishedGoodsNo: fgObj?.fgNo || '',
          finishedGoodsName: fgObj?.name || '',
          style: newPriceStyle.trim(),
          currencyCode: newPriceCurrCode || 'BDT',
          currencyId: newPriceCurrId || '',
          unit: newPriceUnit || fgObj?.unit || 'PCS',
          rate: Number(newPriceRate),
          effectiveDate: newPriceEffDate,
          status: approvalCheck.required ? 'pending_approval' : 'active',
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now()
        });

        if (approvalCheck.required) {
          try {
            const reqSummary = `New Price Master rule for ${custObj?.name || 'Customer'} - ${fgObj?.name || 'Item'}: ${getCurrencySymbol(newPriceCurrCode || 'BDT')} ${Number(newPriceRate).toFixed(2)} / ${newPriceUnit || fgObj?.unit || 'PCS'}`;
            await submitDocumentForApproval(
              userProfile.businessId,
              'sales-price-master',
              'Sales Price Master',
              'PRICE_MASTER_CREATE',
              'price_masters',
              newDocRef.id,
              reqSummary,
              userProfile,
              approvalCheck,
              Number(newPriceRate),
              newPriceCurrCode || 'BDT'
            );
          } catch (apprErr) {
            console.warn('Could not register central approval request for new price rule:', apprErr);
          }
          showToast('New Price Rule submitted for approval! Request sent to designated approver.', 'info');
        } else {
          showToast('Price rule configured successfully in Price Master!', 'success');
        }
      }
      setShowAddPriceModal(false);
      setEditingPrice(null);
      setNewPriceRate(''); setNewPriceStyle('');
    } catch (err: any) {
      showToast('Error saving Price Master: ' + err.message, 'error');
    }
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriceCustId || !newPriceFgId || !newPriceRate) {
      showToast('Customer, Finished Goods, and Rate are required.', 'error');
      return;
    }

    const inputStyleNorm = newPriceStyle.trim().toLowerCase();

    if (!editingPrice) {
      // Prevent duplicate price rule creation for the same Customer and Item
      const duplicateEntry = priceMasters.find(p => 
        p.customerId === newPriceCustId && 
        p.finishedGoodsId === newPriceFgId && 
        ((p.style || '').trim().toLowerCase() === inputStyleNorm || (!p.style && !inputStyleNorm))
      );

      if (duplicateEntry) {
        const custName = customers.find(c => c.id === newPriceCustId)?.name || 'this customer';
        const fgName = finishedGoods.find(f => f.id === newPriceFgId)?.name || 'this item';
        showToast(`Duplicate entry not allowed! A Price Master rule for ${custName} - ${fgName} already exists (Current Rate: ৳${duplicateEntry.rate.toFixed(2)}). Please edit the existing entry to change prices.`, 'error');
        return;
      }
    } else {
      // Editing existing rule -> check conflict with other rules
      const conflictEntry = priceMasters.find(p => 
        p.id !== editingPrice.id &&
        p.customerId === newPriceCustId && 
        p.finishedGoodsId === newPriceFgId && 
        ((p.style || '').trim().toLowerCase() === inputStyleNorm)
      );

      if (conflictEntry) {
        showToast('Rule Conflict! Another Price Master rule already exists for this Customer and Item combination.', 'error');
        return;
      }
    }

    if (editingPrice) {
      checkPageApprovalRule('sales-price-master', userProfile.businessId, userProfile, Number(newPriceRate)).then(approvalCheck => {
        if (approvalCheck.required) {
          requestActionConfirmation({
            title: 'Submit Price Change for Approval?',
            message: `Modifying an existing Price Master rule requires authorized approval before the active rate is updated. Submit this price change request?`,
            type: 'update',
            confirmText: 'Submit Price Request',
            details: [
              { label: 'Customer', value: customers.find(c => c.id === newPriceCustId)?.name || 'N/A' },
              { label: 'Item', value: finishedGoods.find(f => f.id === newPriceFgId)?.name || 'N/A' },
              { label: 'Current Rate', value: `${getCurrencySymbol(editingPrice.currencyCode || 'BDT')} ${editingPrice.rate.toFixed(2)}` },
              { label: 'New Requested Rate', value: `${getCurrencySymbol(newPriceCurrCode || 'BDT')} ${Number(newPriceRate).toFixed(2)}` }
            ],
            onConfirm: executeSavePrice
          });
        } else {
          executeSavePrice();
        }
      }).catch(() => {
        executeSavePrice();
      });
    } else {
      executeSavePrice();
    }
  };

  const handleApprovePriceChange = (priceRule: PriceMaster) => {
    const targetRate = priceRule.pendingRate !== undefined ? priceRule.pendingRate : priceRule.rate;
    const targetCurr = priceRule.pendingCurrencyCode || priceRule.currencyCode || 'BDT';
    const targetUnit = priceRule.pendingUnit || priceRule.unit || 'PCS';
    requestActionConfirmation({
      title: 'Approve Price Master Update?',
      message: `Are you sure you want to approve the price change for ${priceRule.customerName} - ${priceRule.finishedGoodsName}?`,
      type: 'update',
      confirmText: 'Yes, Approve Price Update',
      details: [
        { label: 'Customer', value: priceRule.customerName },
        { label: 'Item', value: priceRule.finishedGoodsName },
        { label: 'Previous Rate', value: `${getCurrencySymbol(priceRule.currencyCode || 'BDT')} ${priceRule.rate.toFixed(2)} / ${priceRule.unit || 'PCS'}` },
        { label: 'New Approved Rate', value: `${getCurrencySymbol(targetCurr)} ${targetRate.toFixed(2)} / ${targetUnit}` }
      ],
      onConfirm: async () => {
        try {
          const newStyle = priceRule.pendingStyle !== undefined ? priceRule.pendingStyle : (priceRule.style || '');
          const newCurrencyCode = priceRule.pendingCurrencyCode !== undefined ? priceRule.pendingCurrencyCode : (priceRule.currencyCode || 'BDT');
          const newCurrencyId = priceRule.pendingCurrencyId !== undefined ? priceRule.pendingCurrencyId : (priceRule.currencyId || '');
          const newUnit = priceRule.pendingUnit !== undefined ? priceRule.pendingUnit : (priceRule.unit || 'PCS');
          const newEffDate = priceRule.pendingEffectiveDate || priceRule.effectiveDate;

          await updateDoc(doc(db, 'price_masters', priceRule.id), {
            rate: Number(targetRate),
            style: newStyle,
            currencyCode: newCurrencyCode,
            currencyId: newCurrencyId,
            unit: newUnit,
            effectiveDate: newEffDate,
            status: 'active',
            approvedBy: userProfile?.displayName || userProfile?.name || userProfile?.email || 'Admin',
            approvedAt: Timestamp.now(),
            pendingRate: deleteField(),
            pendingStyle: deleteField(),
            pendingCurrencyCode: deleteField(),
            pendingCurrencyId: deleteField(),
            pendingUnit: deleteField(),
            pendingEffectiveDate: deleteField(),
            updatedAt: Timestamp.now()
          });

          // Also sync any matching central approval requests
          try {
            const q = query(
              collection(db, 'approvalRequests'),
              where('targetId', '==', priceRule.id),
              where('status', '==', 'pending')
            );
            const snap = await getDocs(q);
            for (const rDoc of snap.docs) {
              await updateDoc(doc(db, 'approvalRequests', rDoc.id), {
                status: 'approved',
                approvedAt: Timestamp.now(),
                approvedBy: userProfile?.displayName || userProfile?.name || userProfile?.email || 'Admin',
                approvalComment: 'Approved directly from Price Master'
              });
            }
          } catch (syncErr) {
            console.warn('Could not sync approvalRequests on price approve:', syncErr);
          }

          showToast(`Price Master update approved! New rate ${getCurrencySymbol(newCurrencyCode)} ${targetRate.toFixed(2)} / ${newUnit} is now active.`, 'success');
        } catch (err: any) {
          showToast('Error approving price update: ' + err.message, 'error');
        }
      }
    });
  };

  const handleRejectPriceChange = (priceRule: PriceMaster) => {
    requestActionConfirmation({
      title: 'Reject Price Master Update?',
      message: `Are you sure you want to reject the price change request? The active rate (${getCurrencySymbol(priceRule.currencyCode || 'BDT')} ${priceRule.rate.toFixed(2)} / ${priceRule.unit || 'PCS'}) will be retained.`,
      type: 'delete',
      confirmText: 'Yes, Reject Request',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'price_masters', priceRule.id), {
            status: 'active',
            pendingRate: deleteField(),
            pendingStyle: deleteField(),
            pendingCurrencyCode: deleteField(),
            pendingCurrencyId: deleteField(),
            pendingUnit: deleteField(),
            pendingEffectiveDate: deleteField(),
            updatedAt: Timestamp.now()
          });

          // Also sync any matching central approval requests
          try {
            const q = query(
              collection(db, 'approvalRequests'),
              where('targetId', '==', priceRule.id),
              where('status', '==', 'pending')
            );
            const snap = await getDocs(q);
            for (const rDoc of snap.docs) {
              await updateDoc(doc(db, 'approvalRequests', rDoc.id), {
                status: 'rejected',
                rejectedAt: Timestamp.now(),
                rejectedBy: userProfile?.displayName || userProfile?.name || userProfile?.email || 'Admin',
                rejectionReason: 'Rejected from Price Master'
              });
            }
          } catch (syncErr) {
            console.warn('Could not sync approvalRequests on price reject:', syncErr);
          }

          showToast('Price Master update request rejected.', 'info');
        } catch (err: any) {
          showToast('Error rejecting price update: ' + err.message, 'error');
        }
      }
    });
  };

  const handleDeletePrice = (priceId: string, itemDesc: string) => {
    if (!canDeletePriceMaster) {
      showToast('Permission Denied: Only system administrators have permission to delete Price Master entries.', 'error');
      return;
    }
    requestActionConfirmation({
      title: 'Delete Price Rule?',
      message: `Are you sure you want to delete price rule for "${itemDesc}"?`,
      type: 'delete',
      confirmText: 'Yes, Delete Price Rule',
      details: [
        { label: 'Price Rule Item', value: itemDesc }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'price_masters', priceId));
          showToast('Price rule deleted.', 'info');
        } catch (err: any) {
          showToast('Error deleting price rule: ' + err.message, 'error');
        }
      }
    });
  };

  const handleDeleteWorkOrder = (wo: WorkOrder) => {
    requestActionConfirmation({
      title: 'Delete Work Order?',
      message: `Are you sure you want to delete Work Order "${wo.woNumber}"? This operation cannot be undone.`,
      type: 'delete',
      confirmText: 'Yes, Delete Work Order',
      details: [
        { label: 'Work Order No', value: wo.woNumber },
        { label: 'Customer', value: wo.customerName },
        { label: 'Total Value', value: `৳ ${wo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
      ],
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'work_orders', wo.id));
          if (editingWoId === wo.id) {
            setEditingWoId(null);
            setWoNumber('');
            setBreakdownRows([]);
          }
          showToast(`Work Order "${wo.woNumber}" deleted.`, 'info');
        } catch (err: any) {
          showToast('Error deleting Work Order: ' + err.message, 'error');
        }
      }
    });
  };

  // Filtered Orders / Work Orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(w => {
      const search = (woSearchTerm || '').toLowerCase().trim();
      const matchesSearch = 
        (w.woNumber || '').toLowerCase().includes(search) ||
        (w.customerName || '').toLowerCase().includes(search) ||
        (w.buyerName || '').toLowerCase().includes(search) ||
        (w.orderNo || '').toLowerCase().includes(search) ||
        (w.poNo || '').toLowerCase().includes(search) ||
        ((w.finishedGoodsName || '').toLowerCase().includes(search));

      const matchesStatus = woStatusFilter === 'all' || w.status === woStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [workOrders, woSearchTerm, woStatusFilter]);

  const currentLoadedWo = editingWoId ? workOrders.find(w => w.id === editingWoId) : null;
  const isConfirmedOrApproved = woStatus === 'confirmed' || woStatus === 'pending_approval' || woStatus === 'approved' || !!currentLoadedWo?.isLocked;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Module Title Header */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1 font-semibold">
            <span>Sales</span>
            <ChevronRight className="w-3 h-3 text-neutral-400" />
            <span>Order Entry</span>
            <ChevronRight className="w-3 h-3 text-neutral-400" />
            <span className="text-indigo-700 font-bold uppercase">{subTab.replace('-', ' ')}</span>
          </div>
          <h1 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" /> Sales Order & Work Order Entry System
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-100 p-1.5 rounded-xl text-xs font-bold">
          {availableTabs.includes('entry') && (
            <button
              onClick={() => handleTabChange('entry')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'entry' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Order & WO Entry
            </button>
          )}
          {availableTabs.includes('list') && (
            <button
              onClick={() => handleTabChange('list')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Work Order List ({workOrders.length})
            </button>
          )}
          {availableTabs.includes('mrr-receipt') && (
            <button
              onClick={() => handleTabChange('mrr-receipt')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'mrr-receipt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Customer MRR Receipt
            </button>
          )}
          {availableTabs.includes('customer-master') && (
            <button
              onClick={() => handleTabChange('customer-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'customer-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Customer Master
            </button>
          )}
          {availableTabs.includes('buyer-master') && (
            <button
              onClick={() => handleTabChange('buyer-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'buyer-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Buyer Master
            </button>
          )}
          {availableTabs.includes('currency-master') && (
            <button
              onClick={() => handleTabChange('currency-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'currency-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Currency Master ({currencies.filter(cur => (cur.code || '').toUpperCase() !== 'BDT').length})
            </button>
          )}
          {availableTabs.includes('price-master') && (
            <button
              onClick={() => handleTabChange('price-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'price-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Price Master
            </button>
          )}
          {availableTabs.includes('fg-master') && (
            <button
              onClick={() => handleTabChange('fg-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'fg-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Finished Goods ({finishedGoods.length})
            </button>
          )}
          {availableTabs.includes('category-master') && (
            <button
              onClick={() => handleTabChange('category-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'category-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Category Master ({fgCategories.length})
            </button>
          )}
          {availableTabs.includes('subcategory-master') && (
            <button
              onClick={() => handleTabChange('subcategory-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'subcategory-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Sub-Category Master ({fgSubCategories.length})
            </button>
          )}
          {availableTabs.includes('section-master') && (
            <button
              onClick={() => handleTabChange('section-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'section-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Section Master ({sections.length})
            </button>
          )}
          {availableTabs.includes('process-master') && (
            <button
              onClick={() => handleTabChange('process-master')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'process-master' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Process Master ({productionProcesses.length})
            </button>
          )}
          {availableTabs.includes('booking-report') && (
            <button
              onClick={() => handleTabChange('booking-report')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'booking-report' ? 'bg-indigo-700 text-white shadow-sm font-black' : 'text-indigo-700 hover:text-indigo-900 bg-indigo-50/80 font-extrabold border border-indigo-200'}`}
            >
              Booking Report
            </button>
          )}
          {availableTabs.includes('sales-report') && (
            <button
              onClick={() => handleTabChange('sales-report')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'sales-report' ? 'bg-emerald-700 text-white shadow-sm font-black' : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50/80 font-extrabold border border-emerald-200'}`}
            >
              Sales Report
            </button>
          )}
          {availableTabs.includes('rectify-requests') && (
            <button
              onClick={() => handleTabChange('rectify-requests')}
              className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'rectify-requests' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-600 hover:text-black'}`}
            >
              Rectify & Unlock
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB: ENTRY & MAIN WORKORDER CREATION */}
      {subTab === 'entry' && (
        <div className="space-y-6">
          
          {/* Status Alert Banner if Confirmed / Pending Approval / Approved / Rejected */}
          {woStatus !== 'draft' && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 ${
              woStatus === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
              woStatus === 'pending_approval' ? 'bg-amber-50 border-amber-200 text-amber-900' :
              woStatus === 'rejected' ? 'bg-rose-50 border-rose-200 text-rose-900' :
              'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <div className="flex items-center gap-3">
                {woStatus === 'approved' && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
                {woStatus === 'pending_approval' && <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />}
                {woStatus === 'rejected' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                {woStatus === 'confirmed' && <Lock className="w-5 h-5 text-blue-600 shrink-0" />}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Work Order Status: {woStatus.replace('_', ' ')}
                  </h4>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    {woStatus === 'pending_approval' && 'Work Order is locked while pending management approval.'}
                    {woStatus === 'approved' && 'Official Work Order is approved and locked for production.'}
                    {woStatus === 'rejected' && 'Work Order was returned by approver. Edit options are re-enabled.'}
                    {woStatus === 'confirmed' && 'Work Order confirmed & submitted for management approval.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pending Rectification Alert Banner */}
          {currentLoadedWo?.rectifyRequested && (
            <div className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-amber-600 shrink-0 animate-spin" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Rectification Request Pending Approval
                  </h4>
                  <p className="text-[11px] mt-0.5 text-amber-800">
                    Requested by <strong>{currentLoadedWo.rectifyRequestedBy || 'User'}</strong>: "{currentLoadedWo.rectifyRemarks}". 
                    The designated management approver can unlock this order from the Approvals Center.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-lg text-xs font-extrabold uppercase shrink-0">
                Pending Unlock
              </span>
            </div>
          )}

          {/* Approved Rectification Notification Banner */}
          {currentLoadedWo?.rectifyApproved && woStatus === 'draft' && (
            <div className="p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-950 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                    Work Order Unlocked for Rectification
                  </h4>
                  <p className="text-[11px] mt-0.5 text-emerald-800">
                    This order was unlocked by <strong>{currentLoadedWo.rectifyApprovedBy || 'Approver'}</strong>. You can modify quantities, breakdowns, and prices, and click "Confirm Work Order" when completed.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-200 text-emerald-900 rounded-lg text-xs font-extrabold uppercase shrink-0">
                Unlocked
              </span>
            </div>
          )}

          {/* 1. SECTION: UNIFIED COMPACT WORK ORDER HEADER */}
          <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs space-y-2.5">
            
            {/* Top Toolbar: WO Info, Quick Search, Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-neutral-100">
              
              {/* WO Number Badge */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider">Work Order:</span>
                {woNumber ? (
                  <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    {woNumber}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                    Auto-generated on save
                  </span>
                )}
                {editingWoId && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    woStatus === 'confirmed' || woStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {woStatus}
                  </span>
                )}
              </div>

              {/* Live Auto-Suggest Quick Search Bar */}
              <div className="relative flex-1 max-w-md">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-indigo-600 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={quickSearchQuery}
                    onChange={(e) => {
                      setQuickSearchQuery(e.target.value);
                      setShowQuickSearchDropdown(true);
                    }}
                    onFocus={() => setShowQuickSearchDropdown(true)}
                    placeholder="Search WO No, PO No, Sales Order, or Customer..."
                    className="w-full pl-8 pr-7 py-1 bg-neutral-50 hover:bg-white focus:bg-white border border-neutral-200 focus:border-indigo-500 rounded-lg text-xs font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  {quickSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSearchQuery('');
                        setShowQuickSearchDropdown(false);
                      }}
                      className="absolute right-2 p-0.5 hover:bg-neutral-200 rounded-full text-neutral-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Auto-suggest Dropdown */}
                {showQuickSearchDropdown && quickSearchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-neutral-100 max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-neutral-50 text-[10px] font-bold text-neutral-500 uppercase flex justify-between">
                      <span>Matches ({quickSearchMatches.length})</span>
                      <span className="text-indigo-600">Click to select</span>
                    </div>
                    {quickSearchMatches.length > 0 ? (
                      quickSearchMatches.map((wo) => (
                        <button
                          key={wo.id}
                          type="button"
                          onClick={() => handleSelectQuickSearchWo(wo)}
                          className="w-full px-3 py-2 text-left hover:bg-indigo-50/80 transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded text-[11px]">
                              {wo.woNumber}
                            </span>
                            <span className="font-bold text-neutral-900">{wo.customerName}</span>
                            {wo.poNo && <span className="text-neutral-500 font-mono text-[11px]">PO: {wo.poNo}</span>}
                          </div>
                          <span className="text-[10px] font-bold text-neutral-500 capitalize">{wo.status || 'draft'}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-neutral-400">No matching orders</div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddNewWorkOrder}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New WO
                </button>

                {!isConfirmedOrApproved ? (
                  <button
                    type="button"
                    onClick={handleSaveOrUpdateWorkOrder}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Save / Update
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-2.5 py-1.5 bg-neutral-100 text-neutral-400 rounded-lg text-xs font-bold cursor-not-allowed flex items-center gap-1 border border-neutral-200"
                    title="Locked after confirmation"
                  >
                    <Lock className="w-3.5 h-3.5" /> Locked
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePrintCurrentWo}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  title="Print Work Order"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>

                {editingWoId && (
                  <button
                    type="button"
                    onClick={() => {
                      const curr = workOrders.find(w => w.id === editingWoId);
                      if (curr) setViewingWo(curr);
                      setShowWoDetailsModal(true);
                    }}
                    className="px-2.5 py-1.5 bg-neutral-700 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> Details
                  </button>
                )}
              </div>
            </div>

            {/* Compact 2-Row Form Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              
              {/* 1. Customer */}
              <div className="lg:col-span-2">
                <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">
                  Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCustomerId}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setSelectedBuyerId('');
                  }}
                  className="w-full px-2.5 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.customerCode ? `[${c.customerCode}] ` : ''}{c.name}
                    </option>
                  ))}
                </select>
                {selectedCustomerObj && (
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral-500 truncate">
                    <span>Code: <strong className="text-neutral-700">{selectedCustomerObj.customerCode || 'N/A'}</strong></span>
                    {selectedCustomerObj.paymentTerms && <span>• Terms: <strong className="text-neutral-700">{selectedCustomerObj.paymentTerms}</strong></span>}
                  </div>
                )}
              </div>

              {/* 2. Buyer */}
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">
                  Buyer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedBuyerId}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => setSelectedBuyerId(e.target.value)}
                  className="w-full px-2.5 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">-- Select Buyer --</option>
                  {availableBuyers.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.buyerCode ? `[${b.buyerCode}] ` : ''}{b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Section / Unit */}
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">
                  Section / Unit <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSectionId}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full px-2.5 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Select Unit --</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.sectionCode ? `(${s.sectionCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Sales Order No */}
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">Sales Order No</label>
                <input
                  type="text"
                  value={orderNo}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="e.g. SO-2026-001"
                  className="w-full px-2.5 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 focus:bg-white"
                />
              </div>

              {/* 5. Customer PO No */}
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">Customer PO No</label>
                <input
                  type="text"
                  value={poNo}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => setPoNo(e.target.value)}
                  placeholder="e.g. PO-ABC-001"
                  className="w-full px-2.5 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 focus:bg-white"
                />
              </div>

              {/* Row 2: Dates, Currency, and FOC */}
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">Order Date</label>
                <input
                  type="date"
                  value={orderDate}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-2 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-2 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-0.5">Currency</label>
                  <select
                    value={orderCurrencyCode}
                    disabled={isConfirmedOrApproved}
                    onChange={(e) => {
                      const newCurr = e.target.value;
                      setOrderCurrencyCode(newCurr);
                      if (newCurr === 'BDT') {
                        setOrderConversionRate(1);
                      } else {
                        const custRate = Number(selectedCustomerObj?.conversionRate ?? selectedCustomerObj?.conversionRateBDT);
                        if (custRate && !isNaN(custRate) && custRate > 0) {
                          setOrderConversionRate(custRate);
                        } else {
                          const curObj = currencies.find(c => c.code.toUpperCase() === newCurr.toUpperCase());
                          setOrderConversionRate(curObj?.exchangeRateToBDT || curObj?.rateToBDT || 1);
                        }
                      }
                    }}
                    className="w-full px-2 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900"
                  >
                    <option value="BDT">BDT (৳ - Base)</option>
                    {currencies.filter(c => c.code?.toUpperCase() !== 'BDT').map(c => (
                      <option key={c.id} value={c.code}>{c.code} ({c.symbol || '$'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-0.5 flex items-center justify-between">
                    <span>Conv. Rate</span>
                    <span className="text-[9px] text-purple-700 font-semibold">(৳/Unit)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isConfirmedOrApproved || orderCurrencyCode === 'BDT'}
                    value={orderCurrencyCode === 'BDT' ? 1 : orderConversionRate}
                    onChange={(e) => setOrderConversionRate(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* FOC (Free of Cost) Strip */}
              <div className="lg:col-span-3 flex items-center justify-between px-2.5 py-1 bg-emerald-50/70 border border-emerald-200 rounded-lg mt-auto">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="freeOfCostCheckbox"
                    checked={isFreeOfCost}
                    disabled={isConfirmedOrApproved}
                    onChange={(e) => handleToggleFreeOfCost(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="freeOfCostCheckbox" className="text-xs font-black text-emerald-950 cursor-pointer flex items-center gap-1.5">
                    Free of Cost (FOC / Sample)
                    {isFreeOfCost && (
                      <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded uppercase">
                        Rate: ৳0.00
                      </span>
                    )}
                  </label>
                </div>

                {isFreeOfCost && focRefJobNo && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300">
                    Ref: {focRefJobNo}
                  </span>
                )}
              </div>

            </div>

            {/* FOC Extended Drawer (Compact) */}
            {isFreeOfCost && (
              <div className="p-2 bg-emerald-50/50 border border-emerald-200 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-2 text-xs animate-in fade-in">
                <div>
                  <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">
                    Import Previous Job Breakdown:
                  </label>
                  <select
                    value={focRefJobNo}
                    disabled={isConfirmedOrApproved}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFocRefJobNo(val);
                      const matchedWo = workOrders.find(w => w.woNumber === val || w.id === val);
                      if (matchedWo) handleSelectFocReferenceJob(matchedWo);
                    }}
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-mono font-bold text-neutral-900"
                  >
                    <option value="">-- Select Previous Job No --</option>
                    {workOrders.map(w => (
                      <option key={w.id} value={w.woNumber}>
                        [{w.woNumber}] - {w.customerName} | Style: {w.style || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">
                    FOC Reason / Remark:
                  </label>
                  <input
                    type="text"
                    value={focRemark}
                    disabled={isConfirmedOrApproved}
                    onChange={(e) => setFocRemark(e.target.value)}
                    placeholder="e.g. Sample order for buyer approval"
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-semibold text-neutral-900"
                  />
                </div>
              </div>
            )}

            {/* Finished Goods Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end text-xs pt-1 border-t border-neutral-100">
              
              {/* Item Selector */}
              <div className="md:col-span-5 space-y-0.5">
                <label className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-indigo-600" /> Finished Goods Item <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-1">
                  <select
                    value={selectedFgId}
                    disabled={isConfirmedOrApproved}
                    onChange={(e) => setSelectedFgId(e.target.value)}
                    className="w-full px-2 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Item from Catalog --</option>
                    {availableFinishedGoods.map(f => (
                      <option key={f.id} value={f.id}>
                        [{f.fgNo}] {f.name} ({f.unit || 'PCS'})
                      </option>
                    ))}
                  </select>
                  {!isConfirmedOrApproved && selectedFgId && (
                    <button
                      type="button"
                      onClick={handleAddFgItemToOrder}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
                      title="Add to selected items"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  )}
                </div>
              </div>

              {/* Default Style */}
              <div className="md:col-span-3 space-y-0.5">
                <label className="text-[11px] font-bold text-neutral-700 block">Header Style (Optional)</label>
                <input
                  type="text"
                  value={headerStyle}
                  disabled={isConfirmedOrApproved}
                  onChange={(e) => setHeaderStyle(e.target.value)}
                  placeholder="e.g. ST-1001"
                  className="w-full px-2 py-1 bg-neutral-50 hover:bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:bg-white"
                />
              </div>

              {/* Rate Evaluator */}
              <div className="md:col-span-4 bg-neutral-50 px-2.5 py-1 rounded-lg border border-neutral-200 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[9px] font-bold text-neutral-500 block uppercase">Rate / {selectedFgObj?.unit || 'Pcs'}</span>
                  <span className="text-xs font-black text-neutral-900 font-mono">
                    {getCurrencySymbol(activeEffectiveRate.currencyCode || orderCurrencyCode)} {activeEffectiveRate.rate.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold ml-1">({activeEffectiveRate.source})</span>
                </div>
              </div>

            </div>

            {/* Selected Work Order Items Pills */}
            {selectedFgItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-indigo-900 uppercase">Selected Items:</span>
                {selectedFgItems.map(item => (
                  <div
                    key={item.id}
                    className={`px-2 py-0.5 rounded-md border text-xs flex items-center gap-1.5 transition-all ${
                      (rowFgId || selectedFgId) === item.id
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white text-neutral-800 border-indigo-200 hover:bg-indigo-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setRowFgId(item.id);
                        setRowRate(item.rate);
                        setRowUnit(item.unit);
                        setSelectedFgId(item.id);
                      }}
                      className="flex items-center gap-1 text-left cursor-pointer"
                    >
                      <strong className="font-bold text-[11px]">{item.fgName}</strong>
                      <span className="font-mono text-[10px] opacity-90">
                        ({getCurrencySymbol(item.currencyCode || orderCurrencyCode)}{item.rate.toFixed(2)})
                      </span>
                    </button>
                    {!isConfirmedOrApproved && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFgItemFromOrder(item.id)}
                        className="hover:text-rose-400 text-xs font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* 2. SECTION: ORDER ITEM BREAKDOWN & ENTRY */}
          <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                  Order Item Breakdown
                </h3>
                <span className="text-[11px] font-mono font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  Currency: {orderCurrencyCode} ({getCurrencySymbol(orderCurrencyCode)})
                </span>
              </div>

              {/* CSV Upload Controls */}
              {!isConfirmedOrApproved && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold flex items-center gap-1 border border-neutral-200 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-neutral-600" /> CSV Template
                  </button>

                  <label className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all">
                    <Upload className="w-3 h-3" /> Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleUploadCsv}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Manual Row Entry Controls (+ Add Row) */}
            {!isConfirmedOrApproved && (
              <div className="bg-neutral-50/80 p-2.5 rounded-lg border border-neutral-200 space-y-2">
                
                {/* Live BOM & Sheet Consumption Helper Banner */}
                {(() => {
                  const activeFgId = rowFgId || selectedFgId || (selectedFgItems[0]?.id);
                  const activeFgObj = finishedGoods.find(f => f.id === activeFgId) || selectedFgObj;
                  const matchedBom = getBomForFinishedGoods(activeFgId, activeFgObj?.fgNo, activeFgObj?.name);
                  const qtyNum = Number(rowQty) || 0;

                  if (matchedBom) {
                    const ups = Math.max(1, matchedBom.ups || matchedBom.piecesPerSheet || 1);
                    const wst = matchedBom.wastagePercent || 0;
                    const matchedSheetStoreItem = matchedBom.sheetItemId ? inventoryItems.find(it => it.id === matchedBom.sheetItemId) : undefined;
                    const matUnit = matchedSheetStoreItem?.unit || matchedBom.sheetUnit || 'Roll';
                    const baseUnits = qtyNum > 0 ? qtyNum / ups : 0;
                    const reqUnits = Math.ceil(baseUnits);
                    const sheetStock = Number(matchedSheetStoreItem?.currentStock ?? (matchedSheetStoreItem as any)?.quantity ?? 0);

                    return (
                      <div className="px-2.5 py-1 bg-indigo-50/80 rounded-md border border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-indigo-950 text-[11px]">
                            BOM: <span className="font-mono text-indigo-700">{matchedBom.bomNo}</span> (1 {matUnit} = {ups.toLocaleString()} Pcs)
                          </span>
                          {matchedBom.sheetItemName && (
                            <span className="text-neutral-600 text-[11px]">
                              • Material: <strong>{matchedBom.sheetItemName}</strong>
                              {matchedSheetStoreItem && (
                                <span className={`ml-1 font-bold ${sheetStock >= reqUnits ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  (Stock: {sheetStock.toLocaleString()} {matUnit})
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {qtyNum > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                            <span className="text-[10px] text-neutral-500 uppercase">Required:</span>
                            <span className="font-mono bg-white px-2 py-0.2 rounded border border-indigo-200 text-indigo-700">
                              {reqUnits.toLocaleString()} {matUnit}
                            </span>
                            {wst > 0 && <span className="text-[10px] text-neutral-400 font-normal">({wst}% wst)</span>}
                          </div>
                        )}
                      </div>
                    );
                  } else if (activeFgObj) {
                    return (
                      <div className="px-2.5 py-1 bg-amber-50 rounded-md border border-amber-200 flex items-center justify-between text-[11px] text-amber-900">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>No Master BOM for <strong>{activeFgObj.name}</strong> (Default UPS: 1).</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700">Set in BOM Master</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-1.5 text-xs items-end">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Job No</label>
                    <input
                      type="text"
                      value={rowJobNo}
                      onChange={(e) => setRowJobNo(e.target.value)}
                      placeholder={orderNo || "JOB-01"}
                      className="w-full px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold font-mono text-neutral-900"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Item / FG *</label>
                    <select
                      value={rowFgId || availableBreakdownFgItems[0]?.id || ''}
                      onChange={(e) => {
                        const newFgId = e.target.value;
                        setRowFgId(newFgId);
                        const selItem = availableBreakdownFgItems.find(i => i.id === newFgId);
                        if (selItem) {
                          setRowRate(selItem.rate);
                          setRowUnit(selItem.unit);
                        }
                      }}
                      className="w-full px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                    >
                      {availableBreakdownFgItems.length > 0 ? (
                        availableBreakdownFgItems.map(item => (
                          <option key={`sel-${item.id}`} value={item.id}>
                            [{item.fgNo}] {item.fgName} ({getCurrencySymbol(item.currencyCode || orderCurrencyCode)}{item.rate.toFixed(2)})
                          </option>
                        ))
                      ) : (
                        <option value="">-- No FG Item Selected --</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Style</label>
                    <input
                      type="text"
                      value={rowStyle}
                      onChange={(e) => {
                        setRowStyle(e.target.value);
                        const p = getPriceForStyleAndItem(e.target.value, rowFgId || selectedFgId);
                        if (p.rate >= 0) setRowRate(p.rate);
                      }}
                      placeholder={headerStyle || "ST-1001"}
                      className="w-full px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Color</label>
                    <input
                      type="text"
                      value={rowColor}
                      onChange={(e) => setRowColor(e.target.value)}
                      placeholder="RED / NAVY"
                      className="w-full px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold text-neutral-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Size</label>
                    <select
                      value={rowSize}
                      onChange={(e) => setRowSize(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold text-neutral-900"
                    >
                      {sizes.length > 0 ? (
                        sizes.map(s => <option key={s.id} value={s.code}>{s.name}</option>)
                      ) : (
                        ['S', 'M', 'L', 'XL', 'XXL', '28', '30', '32'].map(sz => (
                          <option key={sz} value={sz}>{sz}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Order / PO</label>
                    <input
                      type="text"
                      value={rowOrderNo}
                      onChange={(e) => setRowOrderNo(e.target.value)}
                      placeholder={poNo || "PO-001"}
                      className="w-full px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Qty *</label>
                    <input
                      type="number"
                      value={rowQty}
                      onChange={(e) => setRowQty(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="5000"
                      className="w-full px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-bold text-neutral-900"
                    />
                  </div>

                  <div className="flex gap-1 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rowRate}
                        onChange={(e) => setRowRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-1.5 py-1 bg-white border border-neutral-300 rounded text-xs font-bold text-neutral-900"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddManualRow}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0"
                      title="Add Row"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown Table Display */}
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase border-b border-neutral-200 text-[11px]">
                    <th className="py-1.5 px-2.5 w-8 text-center">#</th>
                    <th className="py-1.5 px-2.5">Job No</th>
                    <th className="py-1.5 px-2.5">Item / FG</th>
                    <th className="py-1.5 px-2.5">Style</th>
                    <th className="py-1.5 px-2.5">Color</th>
                    <th className="py-1.5 px-2.5">Size</th>
                    <th className="py-1.5 px-2.5">PO / Order</th>
                    <th className="py-1.5 px-2.5 text-right">Quantity</th>
                    <th className="py-1.5 px-2.5 text-center">Unit</th>
                    <th className="py-1.5 px-2.5 text-right">Rate</th>
                    <th className="py-1.5 px-2.5 text-right">Total</th>
                    {!isConfirmedOrApproved && <th className="py-1.5 px-2 text-center w-10">Act</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-900 font-medium">
                  {breakdownRows.length > 0 ? (
                    breakdownRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-1.5 px-2.5 text-center text-neutral-400 font-bold">{idx + 1}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-purple-700">{row.jobNo || 'JOB-01'}</td>
                        <td className="py-1.5 px-2.5">
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200 mr-1">
                            {row.finishedGoodsNo || selectedFgObj?.fgNo || 'ITEM'}
                          </span>
                          <span className="font-bold">{row.finishedGoodsName || selectedFgObj?.name || 'Finished Goods'}</span>
                        </td>
                        <td className="py-1.5 px-2.5 font-bold text-indigo-700">{row.style}</td>
                        <td className="py-1.5 px-2.5 font-bold text-neutral-700 uppercase">{row.color || 'N/A'}</td>
                        <td className="py-1.5 px-2.5 font-semibold">{row.size}</td>
                        <td className="py-1.5 px-2.5 font-mono text-neutral-600">{row.orderNo}</td>
                        <td className="py-1.5 px-2.5 text-right font-black">{row.quantity.toLocaleString()}</td>
                        <td className="py-1.5 px-2.5 text-center text-neutral-500">{row.unit}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono">{getCurrencySymbol(row.currencyCode || orderCurrencyCode)} {row.rate.toFixed(2)}</td>
                        <td className="py-1.5 px-2.5 text-right font-black text-emerald-700 font-mono">
                          {getCurrencySymbol(row.currencyCode || orderCurrencyCode)} {row.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        {!isConfirmedOrApproved && (
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveBreakdownRowWithConfirm(row)}
                              className="p-0.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-6 text-center text-neutral-400 italic">
                        No breakdown rows added yet. Use form above or upload a CSV file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 3. SECTION: COMPACT SUMMARY STATS */}
            {breakdownRows.length > 0 && (
              <div className="space-y-2">
                {/* Horizontal Stat Bar */}
                <div className="bg-neutral-900 text-white px-3.5 py-2 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-400">Rows</span>
                      <p className="text-sm font-black">{breakdownTotals.totalRows}</p>
                    </div>
                    <div className="h-6 w-px bg-neutral-700" />
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-400">Total Quantity</span>
                      <p className="text-sm font-black text-indigo-300">{breakdownTotals.totalQty.toLocaleString()} Pcs</p>
                    </div>
                    <div className="h-6 w-px bg-neutral-700" />
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-400">Material Required</span>
                      <p className="text-sm font-black text-amber-300 font-mono">
                        {breakdownTotals.totalRequiredSheetsAll.toLocaleString()} {breakdownTotals.primaryUnitLabel || 'Sheets'}
                      </p>
                    </div>
                  </div>

                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-400">Total Order Value ({orderCurrencyCode})</span>
                      <div className="flex items-baseline gap-2">
                        <p className="text-base font-black text-emerald-400 font-mono">
                          {getCurrencySymbol(orderCurrencyCode)} {breakdownTotals.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        {orderCurrencyCode !== 'BDT' && (
                          <span className="text-[11px] text-emerald-300 font-mono font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                            ≈ ৳ {(breakdownTotals.totalAmt * (orderConversionRate || 120)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            <span className="text-[9px] text-emerald-400 ml-1 font-sans">(@ ৳{orderConversionRate})</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compact Item, Style, Size Summaries */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    {/* Item / FG Summary */}
                    <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-200 space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-bold text-indigo-950 uppercase">
                        <span>Item Summary</span>
                        <span className="text-[10px] text-indigo-700">{Object.keys(breakdownTotals.itemMap).length} Items</span>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(breakdownTotals.itemMap).map(([key, item]: [string, any]) => (
                          <div key={key} className="bg-white px-2 py-1 rounded border border-indigo-100 flex justify-between items-center text-[11px]" title={`Exact: ${item.rawSheets?.toFixed(4)} ${item.unitLabel || 'Unit'} (UPS: ${item.ups}, Wastage: ${item.wastagePercent}%)`}>
                            <span className="font-bold text-neutral-900 truncate max-w-[130px]">{item.fgName}</span>
                            <span className="font-bold text-indigo-700">{item.qty.toLocaleString()} Pcs</span>
                            <span className="font-mono text-emerald-700 font-bold">{getCurrencySymbol(orderCurrencyCode)}{item.value.toFixed(2)}</span>
                            <span className="font-mono text-[10px] text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              {item.requiredSheets} {item.unitLabel === 'Roll' ? (item.requiredSheets === 1 ? 'Roll' : 'Rolls') : item.unitLabel === 'Sheet' ? (item.requiredSheets === 1 ? 'Sheet' : 'Sheets') : item.unitLabel || 'Sheet'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                  {/* Style Summary */}
                  <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200 space-y-1">
                    <div className="text-[11px] font-bold text-neutral-800 uppercase">Style Summary</div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
                      {Object.entries(breakdownTotals.styleMap).map(([st, val]) => {
                        const styleVal = val as { qty: number; value: number };
                        return (
                          <div key={st} className="flex justify-between items-center bg-white px-2 py-0.5 rounded border border-neutral-200 text-[11px]">
                            <span className="font-bold text-indigo-700">{st}</span>
                            <span className="font-bold text-neutral-800">{styleVal.qty.toLocaleString()} Pcs</span>
                            <span className="text-neutral-500 font-mono text-[10px]">({getCurrencySymbol(orderCurrencyCode)}{styleVal.value.toFixed(2)})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Size Summary */}
                  <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200 space-y-1">
                    <div className="text-[11px] font-bold text-neutral-800 uppercase">Size Summary</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(breakdownTotals.sizeMap).map(([sz, qty]) => (
                        <div key={sz} className="bg-white px-2 py-0.5 rounded border border-neutral-200 text-[11px] flex items-center gap-1">
                          <span className="font-bold text-neutral-700">{sz}:</span>
                          <span className="font-black text-purple-700">{qty.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SECTION: PRODUCTION PROCESS WORKFLOW & ROUTING */}
            <div className="bg-purple-50/40 p-2.5 rounded-lg border border-purple-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-purple-100 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5 text-purple-600" />
                  <h3 className="text-xs font-black text-purple-950 uppercase tracking-wider">
                    Workflow & Routing Steps
                  </h3>
                  {selectedSectionObj && <span className="text-[10px] text-neutral-500 font-medium">({selectedSectionObj.name})</span>}
                </div>

                <div className="flex items-center gap-2">
                  {selectedWoProcesses.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                      {selectedWoProcesses.filter(p => p.isIncluded).length}/{selectedWoProcesses.length} Steps
                    </span>
                  )}
                  {!isConfirmedOrApproved && selectedSectionId && (
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setSelectedWoProcesses(prev => prev.map(p => ({ ...p, isIncluded: true })))}
                        className="text-indigo-600 hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-neutral-300">/</span>
                      <button
                        type="button"
                        onClick={() => setSelectedWoProcesses(prev => prev.map(p => ({ ...p, isIncluded: false })))}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        None
                      </button>
                      <span className="text-neutral-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          const name = prompt('Custom Process Step Name:');
                          if (name && name.trim()) {
                            setSelectedWoProcesses(prev => [
                              ...prev,
                              {
                                id: 'custom-' + Date.now(),
                                processCode: `CUST-${String(prev.length + 1).padStart(2, '0')}`,
                                processName: name.trim(),
                                sequenceOrder: prev.length + 1,
                                isIncluded: true,
                                notes: 'Custom Step'
                              }
                            ]);
                            showToast(`Added custom step "${name.trim()}"`, 'success');
                          }
                        }}
                        className="text-purple-700 hover:text-purple-900 bg-white px-1.5 py-0.5 rounded border border-purple-200 cursor-pointer"
                      >
                        + Step
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {selectedSectionId ? (
                selectedWoProcesses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {selectedWoProcesses.map((proc, idx) => (
                      <div
                        key={proc.id || idx}
                        className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                          proc.isIncluded
                            ? 'bg-white border-emerald-300 shadow-2xs'
                            : 'bg-neutral-100/70 border-neutral-200 opacity-60'
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer select-none flex-1 truncate">
                          <input
                            type="checkbox"
                            disabled={isConfirmedOrApproved}
                            checked={proc.isIncluded}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedWoProcesses(prev => prev.map((p, i) => i === idx ? { ...p, isIncluded: checked } : p));
                            }}
                            className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="font-mono text-[10px] font-bold text-indigo-700">
                            [{proc.processCode}]
                          </span>
                          <span className={`text-xs font-bold truncate ${proc.isIncluded ? 'text-neutral-900' : 'text-neutral-500 line-through'}`}>
                            {proc.processName}
                          </span>
                        </label>

                        {proc.isIncluded && (
                          <input
                            type="text"
                            disabled={isConfirmedOrApproved}
                            value={proc.notes || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedWoProcesses(prev => prev.map((p, i) => i === idx ? { ...p, notes: val } : p));
                            }}
                            placeholder="Machine/Note"
                            className="w-24 px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-[10px] text-neutral-800"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-center text-xs text-neutral-400 bg-white rounded border border-dashed">
                    No default processes. Click <strong className="text-purple-700">+ Step</strong> to add.
                  </div>
                )
              ) : (
                <div className="p-2 text-center text-xs text-neutral-400 bg-white rounded border border-dashed">
                  Select a Section / Unit above to load production routing steps.
                </div>
              )}
            </div>

            {/* 5. SECTION: BOTTOM CONFIRM & SAVE TOOLBAR */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
              <div className="text-[11px] text-neutral-500">
                {woStatus === 'draft' && 'Status: Draft (Editable)'}
                {woStatus === 'pending_approval' && 'Status: Pending Approval (Locked)'}
                {woStatus === 'approved' && 'Status: Approved (Locked for Production)'}
                {woStatus === 'confirmed' && 'Status: Confirmed (Locked)'}
              </div>

              <div className="flex items-center gap-2">
                {!isConfirmedOrApproved ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveOrUpdateWorkOrder}
                      className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-xs font-bold border border-neutral-300 transition-all cursor-pointer"
                    >
                      Save Draft
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmWorkOrder}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Work Order
                    </button>
                  </>
                ) : (
                  <span className="px-3.5 py-1.5 bg-neutral-100 text-neutral-600 rounded-lg text-xs font-bold border border-neutral-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-neutral-500" /> Order Locked ({woStatus.replace('_', ' ')})
                  </span>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUBTAB: RECTIFY & UNLOCK REQUESTS */}
      {subTab === 'rectify-requests' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2 text-neutral-600 font-bold text-xs mb-1">
                <RotateCcw className="w-4 h-4" /> Work Order Rectification & Unlock Management
              </div>
              <h2 className="text-xl font-extrabold text-neutral-900">Rectify Order Requests</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Request management authorization to unlock confirmed or approved Work Orders to amend quantities, breakdowns, or pricing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRectifyTargetWo(null);
                  setShowRectifyModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>+ New Rectification Request</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3">
              <p className="text-[11px] font-bold text-neutral-500 uppercase">Total Work Orders</p>
              <p className="text-xl font-extrabold text-neutral-900 mt-0.5">{workOrders.length}</p>
            </div>
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-amber-700 uppercase">Locked Orders</p>
              <p className="text-xl font-extrabold text-amber-900 mt-0.5">
                {workOrders.filter(w => w.status === 'approved' || w.status === 'confirmed' || w.isLocked).length}
              </p>
            </div>
            <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3">
              <p className="text-[11px] font-bold text-neutral-600 uppercase">Pending Rectification</p>
              <p className="text-xl font-extrabold text-neutral-900 mt-0.5 flex items-center gap-2">
                <span>{workOrders.filter(w => w.rectifyRequested).length}</span>
                {workOrders.filter(w => w.rectifyRequested).length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-black animate-pulse">
                    Action Needed
                  </span>
                )}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-emerald-700 uppercase">Unlocked / Editable</p>
              <p className="text-xl font-extrabold text-emerald-900 mt-0.5">
                {workOrders.filter(w => w.status === 'draft' || w.rectifyApproved).length}
              </p>
            </div>
          </div>

          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={woSearchTerm}
                onChange={(e) => setWoSearchTerm(e.target.value)}
                placeholder="Search by WO#, Customer, Buyer, PO#..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={woStatusFilter}
                onChange={(e) => setWoStatusFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white"
              >
                <option value="all">All Orders</option>
                <option value="pending_rectify">Pending Rectification Only</option>
                <option value="unlocked">Unlocked / Draft</option>
                <option value="approved">Approved & Locked</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto border border-neutral-200 rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100/90 text-neutral-700 font-bold border-b border-neutral-200">
                  <th className="py-2.5 px-3">WO Number</th>
                  <th className="py-2.5 px-3">Customer & Buyer</th>
                  <th className="py-2.5 px-3">Order / PO</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Total Value</th>
                  <th className="py-2.5 px-3 text-center">Order Status</th>
                  <th className="py-2.5 px-3">Rectification Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {workOrders
                  .filter(w => {
                    const search = (woSearchTerm || '').toLowerCase().trim();
                    const matchesSearch = 
                      (w.woNumber || '').toLowerCase().includes(search) ||
                      (w.customerName || '').toLowerCase().includes(search) ||
                      (w.buyerName || '').toLowerCase().includes(search) ||
                      (w.orderNo || '').toLowerCase().includes(search);

                    if (woStatusFilter === 'pending_rectify') return matchesSearch && !!w.rectifyRequested;
                    if (woStatusFilter === 'unlocked') return matchesSearch && (w.status === 'draft' || !!w.rectifyApproved);
                    if (woStatusFilter === 'approved') return matchesSearch && w.status === 'approved';
                    if (woStatusFilter === 'confirmed') return matchesSearch && w.status === 'confirmed';
                    return matchesSearch;
                  })
                  .map((wo) => {
                    const isLocked = wo.status === 'approved' || wo.status === 'confirmed' || wo.isLocked;
                    return (
                      <tr key={wo.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              handleLoadWorkOrder(wo);
                              setSubTab('entry');
                            }}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer font-bold text-left"
                            title="Open Work Order in Editor"
                          >
                            <span>{wo.woNumber}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-400" />
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-neutral-900">{wo.customerName}</p>
                          <p className="text-[11px] text-neutral-500">{wo.buyerName || 'Buyer: N/A'}</p>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-700">
                          <p>{wo.orderNo || 'N/A'}</p>
                          {wo.poNo && <p className="text-[10px] text-neutral-500">PO: {wo.poNo}</p>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-neutral-900">
                          {wo.totalQuantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {getCurrencySymbol(wo.currencyCode)} {(wo.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <span className="text-[10px] text-neutral-500 ml-1 font-sans">{wo.currencyCode || 'USD'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            wo.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            wo.status === 'pending_approval' ? 'bg-amber-100 text-amber-800' :
                            wo.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            wo.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                            {wo.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {wo.rectifyRequested ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[10px] font-black">
                                <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> Pending Approval
                              </span>
                              {wo.rectifyRemarks && (
                                <p className="text-[10px] text-neutral-700 italic max-w-xs truncate" title={wo.rectifyRemarks}>
                                  "{wo.rectifyRemarks}"
                                </p>
                              )}
                            </div>
                          ) : wo.rectifyApproved && wo.status === 'draft' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Unlocked for Edit
                            </span>
                          ) : isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-bold">
                              <Lock className="w-3 h-3 text-neutral-400" /> Locked
                            </span>
                          ) : (
                            <span className="text-[11px] text-neutral-400 font-medium">Editable (Draft)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {isLocked && !wo.rectifyRequested && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRectifyTargetWo(wo);
                                  setShowRectifyModal(true);
                                }}
                                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                                title="Request Rectification & Unlock"
                              >
                                <RotateCcw className="w-3 h-3" /> Rectify Request
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                handleLoadWorkOrder(wo);
                                setSubTab('entry');
                              }}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[11px] font-bold cursor-pointer"
                              title="Open Work Order in Editor"
                            >
                              Open in Editor
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setViewingWo(wo);
                                setShowWoDetailsModal(true);
                              }}
                              className="p-1 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 rounded-lg transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: WORK ORDER LIST */}
      {subTab === 'list' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Work Orders Register & History</h2>
              <p className="text-xs text-neutral-500">
                Track status, review breakdowns, print, or approve confirmed work orders.
              </p>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRectifyTargetWo(null);
                  setShowRectifyModal(true);
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Rectify Order Request
              </button>

              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={woSearchTerm}
                  onChange={(e) => setWoSearchTerm(e.target.value)}
                  placeholder="Search WO, Customer, Buyer..."
                  className="pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 w-60"
                />
              </div>

              <select
                value={woStatusFilter}
                onChange={(e) => setWoStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase border-b border-neutral-200">
                  <th className="py-2.5 px-3">Work Order</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Buyer</th>
                  <th className="py-2.5 px-3">Order No</th>
                  <th className="py-2.5 px-3">PO No</th>
                  <th className="py-2.5 px-3 text-right">Total Qty</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-900 font-medium">
                {filteredWorkOrders.length > 0 ? (
                  filteredWorkOrders.map((wo) => (
                    <tr key={wo.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            handleLoadWorkOrder(wo);
                            setSubTab('entry');
                          }}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold flex items-center gap-1 cursor-pointer text-left"
                          title="Click to Open Work Order in Editor"
                        >
                          <span>{wo.woNumber}</span>
                          <ExternalLink className="w-3 h-3 text-neutral-400" />
                        </button>
                        {wo.rectifyRequested && (
                          <span className="block mt-0.5 text-[9px] font-extrabold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded w-fit">
                            Rectify Requested
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{wo.customerName}</td>
                      <td className="py-2.5 px-3">{wo.buyerName}</td>
                      <td className="py-2.5 px-3 font-mono text-neutral-600">{wo.orderNo}</td>
                      <td className="py-2.5 px-3 font-mono">{wo.poNo}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{wo.totalQuantity.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono text-emerald-700">
                        {getCurrencySymbol(wo.currencyCode)} {wo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-neutral-500 ml-1 font-sans">{wo.currencyCode || 'USD'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          wo.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          wo.status === 'pending_approval' ? 'bg-amber-100 text-amber-800' :
                          wo.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>
                          {wo.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button
                            onClick={() => {
                              handleLoadWorkOrder(wo);
                              setSubTab('entry');
                            }}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[11px] font-bold"
                            title="Open Work Order in Editor"
                          >
                            Open
                          </button>
                          
                          {(wo.status === 'approved' || wo.status === 'confirmed' || wo.isLocked) && (
                            <button
                              onClick={() => {
                                setRectifyTargetWo(wo);
                                setShowRectifyModal(true);
                              }}
                              className="px-2 py-1 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 rounded text-[11px] font-bold flex items-center gap-0.5"
                              title="Request Rectification / Unlock"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Rectify
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setViewingWo(wo);
                              setShowWoDetailsModal(true);
                            }}
                            className="px-2 py-1 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 rounded text-[11px] font-bold"
                            title="View Details"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleDeleteWorkOrder(wo)}
                            className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[11px] font-bold flex items-center gap-1"
                            title="Delete Work Order"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-400 italic">
                      No Work Orders found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTABS: MASTERS (Customer, Buyer, Price Master, FG) */}
      {subTab === 'customer-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <input
            type="file"
            ref={customerCsvInputRef}
            onChange={handleUploadCustomerCsv}
            accept=".csv"
            className="hidden"
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Customer Master Directory
              </h2>
              <p className="text-xs text-neutral-500">Manage registered clients, addresses, and credit terms. Supports bulk CSV upload & export.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search customer, code, phone..."
                  value={customerSearchTerm}
                  onChange={e => setCustomerSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 w-48"
                />
              </div>

              <button
                type="button"
                onClick={handleDownloadCustomerSampleCsv}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Download CSV Template"
              >
                <Download className="w-3.5 h-3.5" /> Sample CSV
              </button>

              <button
                type="button"
                onClick={() => customerCsvInputRef.current?.click()}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Upload Customers via CSV"
              >
                <Upload className="w-3.5 h-3.5" /> Upload CSV
              </button>

              <button
                type="button"
                onClick={handleExportCustomersCsv}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Export all customers to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
              </button>

              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setNewCustCode('');
                  setNewCustName('');
                  setNewCustAddress('');
                  setNewCustContact('');
                  setNewCustPhone('');
                  setNewCustEmail('');
                  setShowAddCustomerModal(true);
                }}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Address</th>
                  <th className="py-2.5 px-3">Contact Person</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Currency / Rate</th>
                  <th className="py-2.5 px-3">Payment Terms</th>
                  <th className="py-2.5 px-3">Country</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {customers
                  .filter(c => {
                    if (!customerSearchTerm.trim()) return true;
                    const term = customerSearchTerm.toLowerCase();
                    return (
                      c.name?.toLowerCase().includes(term) ||
                      c.customerCode?.toLowerCase().includes(term) ||
                      c.contactPerson?.toLowerCase().includes(term) ||
                      c.phone?.toLowerCase().includes(term) ||
                      c.email?.toLowerCase().includes(term) ||
                      c.address?.toLowerCase().includes(term)
                    );
                  })
                  .map(c => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="py-2 px-3 font-mono font-bold text-purple-700">{c.customerCode}</td>
                    <td className="py-2 px-3 font-bold text-neutral-900">{c.name}</td>
                    <td className="py-2 px-3 text-neutral-600 max-w-xs truncate">{c.address || 'N/A'}</td>
                    <td className="py-2 px-3">{c.contactPerson || 'N/A'}</td>
                    <td className="py-2 px-3 font-mono">{c.phone || 'N/A'}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                          {c.defaultCurrency || 'USD'}
                        </span>
                        <span className="text-neutral-700 font-bold">
                          @ ৳{c.conversionRate ?? c.conversionRateBDT ?? 120}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-semibold text-[11px]">
                        {c.paymentTerms || '30 Days Credit'}
                      </span>
                    </td>
                    <td className="py-2 px-3">{c.country || 'Bangladesh'}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCustomer(c);
                            setNewCustCode(c.customerCode || '');
                            setNewCustName(c.name || '');
                            setNewCustAddress(c.address || '');
                            setNewCustContact(c.contactPerson || '');
                            setNewCustPhone(c.phone || '');
                            setNewCustEmail(c.email || '');
                            setNewCustPaymentTerms(c.paymentTerms || '30 Days Credit');
                            setNewCustDeliveryTerms(c.deliveryTerms || 'FOB Dhaka');
                            setNewCustCountry(c.country || 'Bangladesh');
                            setNewCustDefaultCurrency(c.defaultCurrency || 'USD');
                            setNewCustConversionRate(String(c.conversionRate ?? c.conversionRateBDT ?? 120));
                            setShowAddCustomerModal(true);
                          }}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CURRENCY & CONVERSION RATE MASTER SUBTAB */}
      {subTab === 'currency-master' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Main Card: Customer-Wise Currency & Conversion Rate Setup */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Customer-Wise Currency & Conversion Rate Master
                </h2>
                <p className="text-xs text-neutral-500">
                  Set customer-specific billing currencies and BDT conversion rates. The Sales Dashboard & Work Orders automatically convert foreign currency totals to BDT based on these rates.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={isSavingRates}
                  onClick={async () => {
                    try {
                      setIsSavingRates(true);
                      const promises = Object.entries(quickCustRates).map(async ([custId, data]: [string, any]) => {
                        const targetCust = customers.find(c => c.id === custId);
                        if (!targetCust) return;
                        const updateData: any = { updatedAt: Timestamp.now() };
                        if (data.currency) updateData.defaultCurrency = data.currency;
                        if (data.rate !== undefined && !isNaN(data.rate) && data.rate > 0) {
                          updateData.conversionRate = Number(data.rate);
                          updateData.conversionRateBDT = Number(data.rate);
                        }
                        return updateDoc(doc(db, 'customers', custId), updateData);
                      });
                      await Promise.all(promises);
                      setQuickCustRates({});
                      showToast('All customer conversion rates saved successfully!', 'success');
                    } catch (err: any) {
                      showToast('Error saving conversion rates: ' + err.message, 'error');
                    } finally {
                      setIsSavingRates(false);
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all ${
                    Object.keys(quickCustRates).length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                      : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Save All Changes ({Object.keys(quickCustRates).length})
                </button>
              </div>
            </div>

            {/* Search Bar & Quick Stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search customer by name or code..."
                  value={currencySearchTerm}
                  onChange={e => setCurrencySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Base Currency: <strong>BDT (৳)</strong>
                </span>
                <span className="px-2.5 py-1 bg-purple-50 text-purple-800 font-bold rounded-lg border border-purple-200">
                  Total Customers: <strong>{customers.length}</strong>
                </span>
              </div>
            </div>

            {/* Customer Rates Table */}
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                    <th className="py-2.5 px-3">Customer Code</th>
                    <th className="py-2.5 px-3">Customer Name</th>
                    <th className="py-2.5 px-3">Contact Person</th>
                    <th className="py-2.5 px-3">Billing Currency</th>
                    <th className="py-2.5 px-3">Conversion Rate (to ৳ BDT)</th>
                    <th className="py-2.5 px-3">Active Formula</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {customers
                    .filter(c => {
                      if (!currencySearchTerm.trim()) return true;
                      const term = currencySearchTerm.toLowerCase();
                      return (
                        c.name?.toLowerCase().includes(term) ||
                        c.customerCode?.toLowerCase().includes(term) ||
                        c.contactPerson?.toLowerCase().includes(term)
                      );
                    })
                    .map(c => {
                      const edited = quickCustRates[c.id];
                      const activeCurr = edited?.currency !== undefined ? edited.currency : (c.defaultCurrency || 'USD');
                      const activeRate = edited?.rate !== undefined ? edited.rate : Number(c.conversionRate ?? c.conversionRateBDT ?? 120);
                      const isModified = edited !== undefined;

                      return (
                        <tr key={c.id} className={`hover:bg-neutral-50 transition-colors ${isModified ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-2.5 px-3 font-mono font-bold text-purple-700">{c.customerCode || 'N/A'}</td>
                          <td className="py-2.5 px-3 font-bold text-neutral-900">{c.name}</td>
                          <td className="py-2.5 px-3 text-neutral-600">{c.contactPerson || c.phone || 'N/A'}</td>
                          
                          {/* Currency Selector */}
                          <td className="py-2.5 px-3">
                            <select
                              value={activeCurr}
                              onChange={e => {
                                const newCurr = e.target.value;
                                let defaultRate = activeRate;
                                if (newCurr === 'BDT') defaultRate = 1;
                                else {
                                  const curObj = currencies.find(curr => curr.code.toUpperCase() === newCurr.toUpperCase());
                                  if (curObj?.exchangeRateToBDT || curObj?.rateToBDT) defaultRate = curObj.exchangeRateToBDT || curObj.rateToBDT || 1;
                                }
                                setQuickCustRates(prev => ({
                                  ...prev,
                                  [c.id]: { currency: newCurr, rate: defaultRate }
                                }));
                              }}
                              className="px-2.5 py-1 bg-white border border-neutral-300 rounded-lg font-bold text-neutral-900 text-xs focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="BDT">BDT (৳ - Bangladeshi Taka / Base)</option>
                              {currencies.filter(curr => curr.code?.toUpperCase() !== 'BDT').map(cur => (
                                <option key={cur.id} value={cur.code}>{cur.code} ({cur.symbol || '$'} - {cur.name})</option>
                              ))}
                            </select>
                          </td>

                          {/* Conversion Rate Input */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-neutral-500">৳</span>
                              <input
                                type="number"
                                step="0.01"
                                disabled={activeCurr === 'BDT'}
                                value={activeCurr === 'BDT' ? 1 : activeRate}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setQuickCustRates(prev => ({
                                    ...prev,
                                    [c.id]: { ...prev[c.id], currency: activeCurr, rate: val }
                                  }));
                                }}
                                className="w-28 px-2 py-1 border border-neutral-300 rounded-lg font-mono font-bold text-xs text-emerald-950 bg-white focus:ring-2 focus:ring-emerald-500"
                              />
                              <span className="text-[10px] text-neutral-400 font-semibold">BDT / 1 {activeCurr}</span>
                            </div>
                          </td>

                          {/* Active Conversion Formula Indicator */}
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {activeCurr === 'BDT' ? (
                              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-bold rounded-md">
                                1 BDT = ৳1.00 (Base)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold rounded-md">
                                1 {activeCurr} = ৳{Number(activeRate).toFixed(2)} BDT
                              </span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              disabled={!isModified || isSavingRates}
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'customers', c.id), {
                                    defaultCurrency: activeCurr,
                                    conversionRate: Number(activeRate),
                                    conversionRateBDT: Number(activeRate),
                                    updatedAt: Timestamp.now()
                                  });
                                  setQuickCustRates(prev => {
                                    const next = { ...prev };
                                    delete next[c.id];
                                    return next;
                                  });
                                  showToast(`Updated currency & rate for "${c.name}"!`, 'success');
                                } catch (err: any) {
                                  showToast('Error updating customer rate: ' + err.message, 'error');
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto ${
                                isModified
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                              }`}
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Global Currencies Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Global Currencies & Exchange Rates
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {currencies.filter(cur => (cur.code || '').toUpperCase() !== 'BDT').length} Currencies
                  </span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Manage currencies and baseline conversion rates to BDT for international export transactions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSeedStandardCurrencies}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Populate standard export currencies (USD, EUR, GBP, RMB, INR, AED, etc.)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Preset Currencies</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddCurrencyModal}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Currency
                </button>
                {currencies.filter(cur => (cur.code || '').toUpperCase() !== 'BDT').length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllCurrencies}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    title="Permanently wipe all currency records to start fresh"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete All ({currencies.filter(cur => (cur.code || '').toUpperCase() !== 'BDT').length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter & Bulk Selection Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search currency code, name..."
                  value={currencySearchQuery}
                  onChange={e => setCurrencySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                {currencySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCurrencySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {selectedCurrencyIds.length > 0 && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl">
                  <span className="font-bold text-purple-900">
                    {selectedCurrencyIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedCurrencies}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg flex items-center gap-1 text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" /> Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCurrencyIds([])}
                    className="text-neutral-500 hover:text-neutral-800 text-[11px] underline"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          currencies.filter(c => (c.code || '').toUpperCase() !== 'BDT').length > 0 &&
                          selectedCurrencyIds.length === currencies.filter(c => (c.code || '').toUpperCase() !== 'BDT').length
                        }
                        onChange={e => {
                          const foreignList = currencies.filter(c => (c.code || '').toUpperCase() !== 'BDT');
                          if (e.target.checked) {
                            setSelectedCurrencyIds(foreignList.map(c => c.id));
                          } else {
                            setSelectedCurrencyIds([]);
                          }
                        }}
                        className="rounded border-neutral-300 text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="py-2.5 px-3">Currency Code</th>
                    <th className="py-2.5 px-3">Currency Name</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Base Rate (to BDT)</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr className="bg-emerald-50/50">
                    <td className="py-2.5 px-3 text-center text-neutral-300 font-bold">-</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-950 font-mono">BDT</td>
                    <td className="py-2.5 px-3 font-bold text-neutral-900">Bangladeshi Taka</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-800 text-sm">৳</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">৳ 1.00</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase">System Base</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-neutral-400 italic text-[11px]">Primary Base</td>
                  </tr>
                  {currencies
                    .filter(cur => (cur.code || '').toUpperCase() !== 'BDT')
                    .filter(cur => {
                      if (!currencySearchQuery.trim()) return true;
                      const q = currencySearchQuery.toLowerCase();
                      return (
                        (cur.code || '').toLowerCase().includes(q) ||
                        (cur.name || '').toLowerCase().includes(q) ||
                        (cur.symbol || '').toLowerCase().includes(q)
                      );
                    })
                    .map(cur => {
                      const isSelected = selectedCurrencyIds.includes(cur.id);
                      return (
                        <tr key={cur.id} className={`hover:bg-neutral-50 transition-colors ${isSelected ? 'bg-purple-50/60' : ''}`}>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedCurrencyIds(prev => [...prev, cur.id]);
                                } else {
                                  setSelectedCurrencyIds(prev => prev.filter(id => id !== cur.id));
                                }
                              }}
                              className="rounded border-neutral-300 text-purple-600 focus:ring-purple-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-indigo-700 font-mono">{cur.code}</td>
                          <td className="py-2.5 px-3 font-bold text-neutral-900">{cur.name}</td>
                          <td className="py-2.5 px-3 font-bold text-neutral-700 text-sm">{cur.symbol || '$'}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                            ৳ {Number(cur.exchangeRateToBDT ?? cur.rateToBDT ?? 1).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">Foreign Active</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCurrency(cur);
                                  setNewCurrencyCode(cur.code || '');
                                  setNewCurrencyName(cur.name || '');
                                  setNewCurrencySymbol(cur.symbol || '$');
                                  setNewCurrencyRate(cur.exchangeRateToBDT ?? cur.rateToBDT ?? 1);
                                  setShowAddCurrencyModal(true);
                                }}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Edit Currency"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCurrency(cur.id, cur.code)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                title="Delete Currency"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {currencies.filter(cur => (cur.code || '').toUpperCase() !== 'BDT').length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Globe className="w-8 h-8 text-neutral-300" />
                          <p className="font-semibold text-neutral-700">No custom foreign currencies defined.</p>
                          <p className="text-xs text-neutral-400">Click below to add a new currency or quickly load standard export presets.</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={handleSeedStandardCurrencies}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Preset Standard Currencies (USD, EUR, GBP...)
                            </button>
                            <button
                              type="button"
                              onClick={handleOpenAddCurrencyModal}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add New Currency
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BUYER MASTER SUBTAB */}
      {subTab === 'buyer-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Buyer Master Directory</h2>
              <p className="text-xs text-neutral-500">Manage registered buyers and link them to customer accounts.</p>
            </div>
            <button
              onClick={() => {
                setEditingBuyer(null);
                setNewBuyerCustId('');
                setNewBuyerCode('');
                setNewBuyerName('');
                setNewBuyerContact('');
                setNewBuyerPhone('');
                setNewBuyerEmail('');
                setShowAddBuyerModal(true);
              }}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Buyer
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Buyer Name</th>
                  <th className="py-2.5 px-3">Linked Customer</th>
                  <th className="py-2.5 px-3">Contact Person</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {buyers.map(b => {
                  const linkedCust = customers.find(c => c.id === b.customerId);
                  return (
                    <tr key={b.id} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 font-mono font-bold text-purple-700">{b.buyerCode || 'N/A'}</td>
                      <td className="py-2 px-3 font-bold text-neutral-900">{b.name}</td>
                      <td className="py-2 px-3 font-semibold text-indigo-700">
                        {linkedCust ? linkedCust.name : (b.customerName || 'All Customers')}
                      </td>
                      <td className="py-2 px-3">{b.contactPerson || 'N/A'}</td>
                      <td className="py-2 px-3 font-mono">{b.phone || 'N/A'}</td>
                      <td className="py-2 px-3">{b.email || 'N/A'}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingBuyer(b);
                              setNewBuyerCustId(b.customerId || '');
                              setNewBuyerCode(b.buyerCode || '');
                              setNewBuyerName(b.name || '');
                              setNewBuyerContact(b.contactPerson || '');
                              setNewBuyerPhone(b.phone || '');
                              setNewBuyerEmail(b.email || '');
                              setShowAddBuyerModal(true);
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit Buyer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBuyer(b)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete Buyer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRICE MASTER SUBTAB */}
      {subTab === 'price-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                Price Master Rules Engine
              </h2>
              <p className="text-xs text-neutral-500">Configure customer & item specific rates. Price changes and additions are routed to the central Notification & Approvals Center for authorization.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search customer, item, style..."
                  value={priceSearchTerm}
                  onChange={e => setPriceSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
                />
              </div>
              <button
                onClick={() => {
                  setEditingPrice(null);
                  setNewPriceCustId('');
                  setNewPriceFgId('');
                  setNewPriceStyle('');
                  setNewPriceCurrCode('BDT');
                  setNewPriceCurrId('');
                  setNewPriceRate('');
                  setNewPriceEffDate(new Date().toISOString().slice(0, 10));
                  setShowAddPriceModal(true);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Configure Price Rule
              </button>
            </div>
          </div>

          {priceMasters.some(p => p.status === 'pending_approval') && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{priceMasters.filter(p => p.status === 'pending_approval').length} price rule(s)</strong> are currently awaiting approval in the central <strong>Notification & Approvals Center</strong> (Bell icon in top bar).
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Finished Goods Item</th>
                  <th className="py-2.5 px-3">Style (Optional)</th>
                  <th className="py-2.5 px-3">Currency</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3 text-right">Active Rate</th>
                  <th className="py-2.5 px-3">Effective Date</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {priceMasters
                  .filter(p => {
                    if (!priceSearchTerm.trim()) return true;
                    const term = priceSearchTerm.toLowerCase();
                    return (
                      p.customerName?.toLowerCase().includes(term) ||
                      p.finishedGoodsName?.toLowerCase().includes(term) ||
                      p.finishedGoodsNo?.toLowerCase().includes(term) ||
                      p.style?.toLowerCase().includes(term) ||
                      p.unit?.toLowerCase().includes(term) ||
                      p.currencyCode?.toLowerCase().includes(term)
                    );
                  })
                  .map(p => {
                    const isPending = p.status === 'pending_approval';
                    const curr = p.currencyCode || 'BDT';
                    const unit = p.unit || 'PCS';
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-bold text-neutral-900">{p.customerName}</td>
                        <td className="py-2.5 px-3 text-indigo-700 font-medium">[{p.finishedGoodsNo}] {p.finishedGoodsName}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-purple-700">{p.style || 'General (All Styles)'}</td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className={`px-2 py-0.5 rounded font-bold border ${curr === 'USD' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                            {curr} ({getCurrencySymbol(curr)})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-neutral-700">
                          <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 rounded font-semibold border border-neutral-200">
                            {unit}
                          </span>
                          {isPending && p.pendingUnit && p.pendingUnit !== p.unit && (
                            <div className="text-[10px] text-amber-700 font-bold">
                              Req: {p.pendingUnit}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-emerald-700">{getCurrencySymbol(curr)} {p.rate.toFixed(2)}</span>
                          <span className="text-[10px] text-neutral-500 font-normal ml-1">/ {unit}</span>
                          {isPending && p.pendingRate !== undefined && (
                            <div className="text-[10px] text-amber-700 font-bold">
                              Req: {getCurrencySymbol(p.pendingCurrencyCode || curr)} {p.pendingRate.toFixed(2)} / {p.pendingUnit || unit}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">{p.effectiveDate}</td>
                        <td className="py-2.5 px-3 text-center">
                          {isPending ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shadow-xs">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Approval
                              </span>
                              <span className="text-[9px] text-amber-700 font-medium">
                                In Notification Center
                              </span>
                            </div>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" /> Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingPrice(p);
                                setNewPriceCustId(p.customerId);
                                setNewPriceFgId(p.finishedGoodsId);
                                setNewPriceStyle(p.pendingStyle !== undefined ? p.pendingStyle : (p.style || ''));
                                setNewPriceRate(p.pendingRate !== undefined ? p.pendingRate.toString() : p.rate.toString());
                                setNewPriceCurrCode(p.pendingCurrencyCode || p.currencyCode || 'BDT');
                                setNewPriceCurrId(p.pendingCurrencyId || p.currencyId || '');
                                setNewPriceUnit(p.pendingUnit || p.unit || 'PCS');
                                setNewPriceEffDate(p.pendingEffectiveDate || p.effectiveDate || new Date().toISOString().slice(0, 10));
                                setShowAddPriceModal(true);
                              }}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit Price Rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {canDeletePriceMaster && (
                              <button
                                onClick={() => handleDeletePrice(p.id, `${p.customerName || 'Customer'} - ${p.finishedGoodsName || 'Item'}`)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Price Rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FINISHED GOODS MASTER SUBTAB */}
      {subTab === 'fg-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Finished Goods Master Directory
              </h2>
              <p className="text-xs text-neutral-500">Manage finished goods catalog, customer associations, categories, units, and base specifications.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={fgCustomerFilter}
                onChange={e => setFgCustomerFilter(e.target.value)}
                className="px-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:ring-1 focus:ring-purple-500"
              >
                <option value="">All Customers</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.customerCode ? `[${c.customerCode}] ` : ''}{c.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={fgSearchTerm}
                  onChange={(e) => setFgSearchTerm(e.target.value)}
                  placeholder="Search Finished Goods..."
                  className="pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 w-48"
                />
              </div>

              <button
                onClick={() => {
                  setEditingFg(null);
                  setNewFgNo('');
                  setNewFgName('');
                  setNewFgCustId(fgCustomerFilter || '');
                  setNewFgCustName(customers.find(c => c.id === fgCustomerFilter)?.name || '');
                  setNewFgCatId('');
                  setNewFgCatName('');
                  setNewFgSubCatId('');
                  setNewFgSubCatName('');
                  setNewFgUnit('PCS');
                  setNewFgPrice('');
                  setNewFgSpec('');
                  setShowAddFgModal(true);
                }}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Finished Goods
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                  <th className="py-2.5 px-3">FG Code</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Sub-Category</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3 text-right">Default Rate (৳)</th>
                  <th className="py-2.5 px-3">Specification</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {finishedGoods.filter(f => {
                  const s = fgSearchTerm.toLowerCase();
                  const matchesSearch = !s || f.fgNo?.toLowerCase().includes(s) || f.name?.toLowerCase().includes(s) || f.categoryName?.toLowerCase().includes(s) || f.subCategoryName?.toLowerCase().includes(s) || f.customerName?.toLowerCase().includes(s);
                  const matchesCust = !fgCustomerFilter || f.customerId === fgCustomerFilter;
                  return matchesSearch && matchesCust;
                }).map(f => (
                  <tr key={f.id} className="hover:bg-neutral-50">
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">{f.fgNo}</td>
                    <td className="py-2 px-3 font-bold text-neutral-900">{f.name}</td>
                    <td className="py-2 px-3">
                      {f.customerName ? (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-bold text-[11px] flex items-center gap-1 w-fit">
                          <Building2 className="w-3 h-3 text-purple-600 shrink-0" />
                          {f.customerName}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">General / Unassigned</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold text-[11px]">
                        {f.categoryName || f.productCategory || 'General'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-neutral-700">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-semibold text-[11px]">
                        {f.subCategoryName || f.productType || 'General'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-neutral-600">
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 rounded font-semibold border border-neutral-200">
                        {f.unit || 'PCS'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">
                      {((f as any).defaultPrice && Number((f as any).defaultPrice) > 0) ? `৳ ${Number((f as any).defaultPrice).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-neutral-500 max-w-xs truncate">{f.defaultSpecification || 'N/A'}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingFg(f);
                            setNewFgNo(f.fgNo || '');
                            setNewFgName(f.name || '');
                            setNewFgCustId(f.customerId || '');
                            setNewFgCustName(f.customerName || (customers.find(c => c.id === f.customerId)?.name || ''));
                            setNewFgCatId(f.categoryId || '');
                            setNewFgCatName(f.categoryName || f.productCategory || '');
                            setNewFgSubCatId(f.subCategoryId || '');
                            setNewFgSubCatName(f.subCategoryName || f.productType || '');
                            setNewFgUnit(f.unit || 'PCS');
                            setNewFgPrice((f as any).defaultPrice ?? '');
                            setNewFgSpec(f.defaultSpecification || '');
                            setShowAddFgModal(true);
                          }}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Edit Finished Goods"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFg(f.id, f.name)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete Finished Goods"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORY MASTER SUBTAB */}
      {subTab === 'category-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Category Master Directory</h2>
              <p className="text-xs text-neutral-500">Define high-level product categories (e.g. Offset Printing, Care Label, Heat Seal).</p>
            </div>
            <button
              onClick={() => {
                setEditingCategory(null);
                setNewCatCode(''); setNewCatName(''); setNewCatDesc('');
                setShowAddCategoryModal(true);
              }}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                  <th className="py-2.5 px-3">Category Code</th>
                  <th className="py-2.5 px-3">Category Name</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-center">Sub-Categories Count</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {fgCategories.map(c => {
                  const count = fgSubCategories.filter(s => s.categoryId === c.id || s.categoryName === c.name).length;
                  return (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 font-mono font-bold text-purple-700">{c.categoryCode}</td>
                      <td className="py-2 px-3 font-bold text-neutral-900">{c.name}</td>
                      <td className="py-2 px-3 text-neutral-600">{c.description || 'N/A'}</td>
                      <td className="py-2 px-3 text-center font-bold text-indigo-700 font-mono">{count}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingCategory(c);
                              setNewCatCode(c.categoryCode || '');
                              setNewCatName(c.name || '');
                              setNewCatDesc(c.description || '');
                              setShowAddCategoryModal(true);
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-CATEGORY MASTER SUBTAB */}
      {subTab === 'subcategory-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Sub-Category Master Directory</h2>
              <p className="text-xs text-neutral-500">Manage sub-categories belonging to parent categories (e.g. Hang Tag, Barcode Sticker under Offset Printing).</p>
            </div>
            <button
              onClick={handleOpenAddSubCategoryModal}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Sub-Category
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 font-extrabold uppercase">
                  <th className="py-2.5 px-3">Sub-Cat Code</th>
                  <th className="py-2.5 px-3">Parent Category</th>
                  <th className="py-2.5 px-3">Sub-Category Name</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {fgSubCategories.map(s => {
                  const parent = fgCategories.find(c => c.id === s.categoryId) || null;
                  return (
                    <tr key={s.id} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 font-mono font-bold text-indigo-700">{s.subCategoryCode}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold text-[11px]">
                          {s.categoryName || parent?.name || 'General'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-neutral-900">{s.name}</td>
                      <td className="py-2 px-3 text-neutral-600">{s.description || 'N/A'}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSubCategory(s);
                              setNewSubCatCatId(s.categoryId || '');
                              setNewSubCatCode(s.subCategoryCode || '');
                              setNewSubCatName(s.name || '');
                              setNewSubCatDesc(s.description || '');
                              setShowAddSubCategoryModal(true);
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit Sub-Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubCategory(s.id, s.name)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete Sub-Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION MASTER SUBTAB */}
      {subTab === 'section-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Section Master Directory</h2>
              <p className="text-xs text-neutral-500">Manage production sections & factory units (Offset, Care Label, Heat Seal, Drawstring, Thread, etc.).</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search section..."
                  value={sectionSearchTerm}
                  onChange={e => setSectionSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 w-48"
                />
              </div>
              {sections.length > 0 && (
                <button
                  onClick={handleDeleteAllSections}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all"
                  title="Delete all sections"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Sections ({sections.length})
                </button>
              )}
              <button
                onClick={handleOpenAddSectionModal}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Section
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Section Code</th>
                  <th className="py-2.5 px-3">Section Name</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sections
                  .filter(s => {
                    if (!sectionSearchTerm.trim()) return true;
                    const term = sectionSearchTerm.toLowerCase();
                    return s.name?.toLowerCase().includes(term) || s.sectionCode?.toLowerCase().includes(term);
                  })
                  .map(s => (
                    <tr key={s.id} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-purple-700">{s.sectionCode || 'SEC-01'}</td>
                      <td className="py-2.5 px-3 font-bold text-neutral-900">{s.name}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingSection(s);
                              setNewSectionCode(s.sectionCode || '');
                              setNewSectionName(s.name || '');
                              setShowAddSectionModal(true);
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit Section"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSection(s)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete Section"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {sections.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-400 font-medium">
                      No sections created yet. Click "Add Section" above to create a section.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: PRODUCTION PROCESS MASTER */}
      {subTab === 'process-master' && (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200">
            <div>
              <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-600" />
                Production Process Master (Section-Wise)
              </h2>
              <p className="text-xs text-neutral-500 font-medium">
                Manage section-wise production workflow processes & step sequences
              </p>
            </div>
            <button
              onClick={handleOpenAddProcessModal}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all"
            >
              <Plus className="w-4 h-4" /> Add Production Process
            </button>
          </div>

          {/* Section Wise Count Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-neutral-500 mr-1">Section Filters:</span>
            <button
              onClick={() => setSelectedProcessSectionFilter('')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                selectedProcessSectionFilter === ''
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              All Sections ({productionProcesses.length})
            </button>
            {sections.map(sec => {
              const count = productionProcesses.filter(p => p.sectionId === sec.id || p.sectionName?.toLowerCase() === sec.name?.toLowerCase()).length;
              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedProcessSectionFilter(sec.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                    selectedProcessSectionFilter === sec.id
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                  }`}
                >
                  {sec.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={processSearchTerm}
                onChange={e => setProcessSearchTerm(e.target.value)}
                placeholder="Search processes by code, name, or section..."
                className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
              <span>Section Filter:</span>
              <select
                value={selectedProcessSectionFilter}
                onChange={e => setSelectedProcessSectionFilter(e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-xl text-xs bg-white font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- All Sections --</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Process Name</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3 text-center">Seq Order</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {productionProcesses
                  .filter(p => {
                    if (selectedProcessSectionFilter && p.sectionId !== selectedProcessSectionFilter) {
                      const sec = sections.find(s => s.id === selectedProcessSectionFilter);
                      if (sec && p.sectionName?.toLowerCase() !== sec.name?.toLowerCase()) return false;
                    }
                    if (!processSearchTerm.trim()) return true;
                    const term = processSearchTerm.toLowerCase();
                    return (
                      p.processName?.toLowerCase().includes(term) ||
                      p.processCode?.toLowerCase().includes(term) ||
                      p.sectionName?.toLowerCase().includes(term)
                    );
                  })
                  .sort((a, b) => {
                    if (a.sectionName !== b.sectionName) {
                      return (a.sectionName || '').localeCompare(b.sectionName || '');
                    }
                    return (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
                  })
                  .map(p => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-purple-700">{p.processCode || 'PROC-00'}</td>
                      <td className="py-2.5 px-3 font-bold text-neutral-900">{p.processName}</td>
                      <td className="py-2.5 px-3 font-semibold text-neutral-700">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {p.sectionName || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-neutral-700">
                        #{p.sequenceOrder || 1}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500 max-w-xs truncate">{p.description || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingProcess(p);
                              setNewProcessCode(p.processCode || '');
                              setNewProcessName(p.processName || '');
                              setNewProcessSectionId(p.sectionId || '');
                              setNewProcessSeq(p.sequenceOrder || 1);
                              setNewProcessDesc(p.description || '');
                              setShowAddProcessModal(true);
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit Process"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProcess(p)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete Process"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {productionProcesses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-400 font-medium">
                      No production processes created yet. Click "Add Production Process" above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMATION DIALOG --- */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-indigo-600">
              <ShieldAlert className="w-8 h-8" />
              <h3 className="text-lg font-black text-neutral-900">Confirm Work Order?</h3>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              After confirmation, the Work Order will be locked and cannot be edited until the approval process is completed.
            </p>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1">
              <p><span className="font-bold text-neutral-900">Work Order:</span> {woNumber}</p>
              <p><span className="font-bold text-neutral-900">Customer:</span> {selectedCustomerObj?.name}</p>
              <p><span className="font-bold text-neutral-900">Currency:</span> {orderCurrencyCode} ({getCurrencySymbol(orderCurrencyCode)})</p>
              <p><span className="font-bold text-neutral-900">Total Breakdown Quantity:</span> {breakdownTotals.totalQty.toLocaleString()} Pcs</p>
              <p><span className="font-bold text-neutral-900">Total Order Value:</span> {getCurrencySymbol(orderCurrencyCode)} {breakdownTotals.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmation}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CSV VALIDATION RESULT --- */}
      {showCsvValidationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-600" /> CSV Validation Result
              </h3>
              <button onClick={() => setShowCsvValidationModal(false)} className="p-1 hover:bg-neutral-100 rounded">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            {/* Validation Count Badge */}
            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-900 flex items-center justify-between">
                <span>✓ Valid Rows</span>
                <span className="text-base font-black">{csvValidRows.length}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-900 flex items-center justify-between">
                <span>✕ Invalid Rows</span>
                <span className="text-base font-black">{csvErrorLogs.length}</span>
              </div>
            </div>

            {/* Error Log Table if any */}
            {csvErrorLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-rose-700 uppercase">Invalid Rows Log</h4>
                <div className="max-h-40 overflow-y-auto border border-rose-200 rounded-xl bg-rose-50/50 p-2 text-[11px] space-y-1 font-mono">
                  {csvErrorLogs.map((err, idx) => (
                    <p key={idx} className="text-rose-900">
                      Line {err.line}: <span className="font-bold">{err.error}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {csvErrorLogs.length > 0 ? (
                <button
                  type="button"
                  onClick={handleDownloadCsvErrorReport}
                  className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200"
                >
                  Download Error Report
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCsvValidationModal(false)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-800 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeImportValidCsvRows}
                  disabled={csvValidRows.length === 0}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                >
                  Import {csvValidRows.length} Valid Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: WORK ORDER DETAILS VIEW / JOB BAG PRINT SHEET --- */}
      {showWoDetailsModal && (viewingWo || editingWoId) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            {(() => {
              const wo = viewingWo || workOrders.find(w => w.id === editingWoId);
              if (!wo) return null;
              return (
                <div>
                  {/* Top Control Bar (Hidden when printing) */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200 no-print mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-lg uppercase">
                        WORK ORDER SPEC SHEET
                      </span>
                      <span className="font-mono font-bold text-neutral-600 text-xs">#{wo.woNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => printElement('printable-job-bag', { title: `WorkOrder-${wo.woNumber}` })}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <Printer className="w-4 h-4" /> Print Work Order
                      </button>
                      <button 
                        onClick={() => setShowWoDetailsModal(false)} 
                        className="p-1.5 hover:bg-neutral-100 rounded-xl text-neutral-500 hover:text-neutral-900 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Printable Area - ID: printable-job-bag */}
                  <div id="printable-job-bag" className="printable-doc bg-white p-5 border-2 border-black font-sans text-black text-xs leading-snug print:border-none print:p-0 print:m-0">
                    
                    {/* 1. HEADER SECTION: Company Logo | WORK ORDER Title | Barcode & Job Card No */}
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-3">
                      {/* Company Branding */}
                      <div className="flex items-center gap-3">
                        <img
                          src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                          alt="ES Trims Limited"
                          className="h-14 w-14 object-contain shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                        />
                        <div>
                          <h2 className="text-base font-black text-black uppercase tracking-tight leading-tight">ES TRIMS LIMITED</h2>
                          <p className="text-[9px] text-neutral-700 font-medium leading-tight">
                            C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400
                          </p>
                        </div>
                      </div>

                      {/* Title */}
                      <div className="text-center">
                        <h1 className="text-2xl font-black uppercase tracking-wider text-black">WORK ORDER</h1>
                      </div>

                      {/* Barcode & WO No */}
                      <div className="text-right flex flex-col items-end">
                        <svg className="h-8 w-44" viewBox="0 0 100 24">
                          <rect x="0" y="0" width="3" height="24" fill="black" />
                          <rect x="5" y="0" width="1" height="24" fill="black" />
                          <rect x="8" y="0" width="4" height="24" fill="black" />
                          <rect x="14" y="0" width="2" height="24" fill="black" />
                          <rect x="18" y="0" width="5" height="24" fill="black" />
                          <rect x="25" y="0" width="1" height="24" fill="black" />
                          <rect x="28" y="0" width="3" height="24" fill="black" />
                          <rect x="33" y="0" width="2" height="24" fill="black" />
                          <rect x="37" y="0" width="4" height="24" fill="black" />
                          <rect x="43" y="0" width="1" height="24" fill="black" />
                          <rect x="46" y="0" width="5" height="24" fill="black" />
                          <rect x="53" y="0" width="2" height="24" fill="black" />
                          <rect x="57" y="0" width="3" height="24" fill="black" />
                          <rect x="62" y="0" width="1" height="24" fill="black" />
                          <rect x="65" y="0" width="4" height="24" fill="black" />
                          <rect x="71" y="0" width="2" height="24" fill="black" />
                          <rect x="75" y="0" width="5" height="24" fill="black" />
                          <rect x="82" y="0" width="1" height="24" fill="black" />
                          <rect x="85" y="0" width="3" height="24" fill="black" />
                          <rect x="90" y="0" width="2" height="24" fill="black" />
                          <rect x="94" y="0" width="6" height="24" fill="black" />
                        </svg>
                        <span className="text-sm font-black tracking-widest text-black font-mono mt-0.5">{wo.woNumber}</span>
                      </div>
                    </div>

                    {/* 2. HEADER INFO GRID (Bordered 2-column key-value grid) */}
                    <table className="w-full text-xs border-2 border-black border-collapse mb-3 font-semibold text-black">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold w-[18%]">Job Card No</td>
                          <td className="p-1.5 border-r border-black font-mono font-bold w-[32%]">{wo.breakdownRows?.[0]?.jobNo || wo.woNumber}</td>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold w-[18%]">Issue Date</td>
                          <td className="p-1.5 font-mono font-bold w-[32%]" colSpan={5}>{wo.date}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Sales Order</td>
                          <td className="p-1.5 border-r border-black font-mono font-bold">{wo.orderNo}</td>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold" colSpan={2}>Buyer Name: <span className="font-extrabold">{wo.buyerName}</span></td>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">ERD Date</td>
                          <td className="p-1.5 font-mono font-bold" colSpan={3}>{wo.deliveryDate || wo.date}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Customer Name</td>
                          <td className="p-1.5 border-r border-black font-extrabold" colSpan={3}>{wo.customerName}</td>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Product Category</td>
                          <td className="p-1.5 font-bold" colSpan={3}>{wo.sectionName || wo.finishedGoodsCategory || 'Offset'}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Product Sub Category</td>
                          <td className="p-1.5 border-r border-black font-bold" colSpan={3}>{wo.finishedGoodsName || 'Kimball Sticker'}</td>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Item Name</td>
                          <td className="p-1.5 font-bold" colSpan={3}>{wo.finishedGoodsName?.toLowerCase() || 'kimball sticker'}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Customer Service</td>
                          <td className="p-1.5 border-r border-black font-bold" colSpan={3}>{userProfile?.displayName || 'Maleka Farjana'}</td>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Item No</td>
                          <td className="p-1.5 font-mono font-bold" colSpan={3}>{wo.finishedGoodsNo || 'OF00012'}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Customer PO No</td>
                          <td className="p-1.5 border-r border-black font-mono font-bold" colSpan={3}>{wo.poNo}</td>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">FSC-COC</td>
                          <td className="p-1.5 font-bold" colSpan={3}>N/A</td>
                        </tr>
                        <tr>
                          <td className="p-1.5 border-r border-black bg-neutral-100 font-bold">Delivery Address</td>
                          <td className="p-1.5 font-medium" colSpan={7}>{wo.customerAddress || `${wo.customerName} Factory, BSCIC Industrial Area, Narayanganj.`}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 3. ORDER INFORMATION TITLE */}
                    <div className="text-center my-2">
                      <h2 className="text-sm font-black underline uppercase tracking-wide">Order Information</h2>
                    </div>

                    {/* Sub-Header Key Bar */}
                    <div className="border-2 border-black bg-neutral-50 p-1.5 mb-2 text-xs flex flex-wrap items-center justify-between font-bold gap-2">
                      <div>Item No: {wo.finishedGoodsNo || 'OF00012'}</div>
                      <div>Buyer: {wo.buyerName}</div>
                      <div>Section: {wo.sectionName || 'Offset'}</div>
                      <div>Item: {wo.finishedGoodsName || 'Kimball Sticker'}</div>
                      <div>Job No: {wo.breakdownRows?.[0]?.jobNo || wo.woNumber}</div>
                      {(() => {
                        const totalFgQty = wo.totalQuantity || (wo.breakdownRows?.reduce((acc, r) => acc + (r.quantity || 0), 0) || 0);
                        const bom = getBomForFinishedGoods(wo.finishedGoodsId, wo.finishedGoodsNo, wo.finishedGoodsName);
                        const storeSheetItem = bom?.sheetItemId ? inventoryItems.find(it => it.id === bom.sheetItemId) : undefined;
                        const activeFgObj = finishedGoods.find(f => f.id === wo.finishedGoodsId);
                        const unitLbl = getRawMaterialUnitLabel(bom, activeFgObj, storeSheetItem);
                        const pluralUnit = unitLbl === 'Roll' ? 'Rolls' : unitLbl === 'Sheet' ? 'Sheets' : unitLbl;
                        const ups = Math.max(1, bom?.ups || bom?.piecesPerSheet || 1);
                        const totalSheets = Math.ceil(totalFgQty / ups);
                        if (totalSheets > 0) {
                          return (
                            <div className="text-purple-900 font-extrabold bg-purple-100 px-1.5 py-0.5 rounded border border-purple-300">
                              Material Required: {totalSheets.toLocaleString()} {pluralUnit} ({totalFgQty.toLocaleString()} Pcs ÷ {ups} UPS)
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* 4. BREAKDOWN SPEC TABLE */}
                    <table className="w-full text-[11px] border-2 border-black border-collapse mb-1 font-medium text-black">
                      <thead>
                        <tr className="border-b-2 border-black bg-neutral-100 font-bold text-center">
                          <th className="p-1 border-r border-black text-left w-20">Booking</th>
                          <th className="p-1 border-r border-black text-left w-24">Style</th>
                          <th className="p-1 border-r border-black text-left w-24">Job No</th>
                          <th className="p-1 border-r border-black text-left w-24">PO No</th>
                          <th className="p-1 border-r border-black text-left">Item Name</th>
                          <th className="p-1 border-r border-black text-left w-20">Colour</th>
                          <th className="p-1 border-r border-black text-left w-16">Size</th>
                          <th className="p-1 border-r border-black text-left">Item Description</th>
                          <th className="p-1 text-right w-28">Breakdown QTY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(wo.breakdownRows && wo.breakdownRows.length > 0) ? (
                          wo.breakdownRows.map((row, idx) => {
                            return (
                              <tr key={idx} className="border-b border-black">
                                <td className="p-1 border-r border-black font-mono">{wo.poNo || 'N/A'}</td>
                                <td className="p-1 border-r border-black font-bold uppercase">{row.style || wo.style || 'N/A'}</td>
                                <td className="p-1 border-r border-black font-mono font-bold text-purple-900">{row.jobNo || wo.woNumber}</td>
                                <td className="p-1 border-r border-black font-mono">{row.orderNo || wo.poNo || 'N/A'}</td>
                                <td className="p-1 border-r border-black uppercase text-[10px] font-bold">{row.finishedGoodsName || wo.finishedGoodsName || 'ITEM'}</td>
                                <td className="p-1 border-r border-black font-bold uppercase">{row.color || 'N/A'}</td>
                                <td className="p-1 border-r border-black font-bold">{row.size || 'N/A'}</td>
                                <td className="p-1 border-r border-black text-[10px]">{row.finishedGoodsName?.toLowerCase() || wo.finishedGoodsName?.toLowerCase() || 'item'}</td>
                                <td className="p-1 text-right font-black">{row.quantity.toLocaleString()} {row.unit || wo.finishedGoodsUnit || 'PCs'}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr className="border-b border-black">
                            <td colSpan={9} className="p-3 text-center text-neutral-500 italic font-medium">No breakdown rows added.</td>
                          </tr>
                        )}
                        <tr className="border-t-2 border-black font-black text-xs bg-neutral-50">
                          <td colSpan={8} className="p-1.5 text-right uppercase tracking-wider">Total Breakdown Quantity:</td>
                          <td className="p-1.5 text-right font-black text-sm">{wo.totalQuantity?.toLocaleString() || 0} {wo.finishedGoodsUnit || 'PCs'}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Total Material Calculation Summary Card */}
                    {(() => {
                      const totalFgQty = wo.totalQuantity || (wo.breakdownRows?.reduce((acc, r) => acc + (r.quantity || 0), 0) || 0);
                      const bom = getBomForFinishedGoods(wo.finishedGoodsId, wo.finishedGoodsNo, wo.finishedGoodsName);
                      const storeSheetItem = bom?.sheetItemId ? inventoryItems.find(it => it.id === bom.sheetItemId) : undefined;
                      const activeFgObj = finishedGoods.find(f => f.id === wo.finishedGoodsId);
                      const unitLbl = getRawMaterialUnitLabel(bom, activeFgObj, storeSheetItem);
                      const pluralUnit = unitLbl === 'Roll' ? 'Rolls' : unitLbl === 'Sheet' ? 'Sheets' : unitLbl;
                      const ups = Math.max(1, bom?.ups || bom?.piecesPerSheet || 1);
                      const totalSheets = Math.ceil(totalFgQty / ups);

                      return (
                        <div className="flex items-center justify-between bg-neutral-50 border-2 border-black p-2 rounded mb-3 text-xs">
                          <div className="font-bold flex items-center gap-2">
                            <span className="uppercase text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-black">Material Requirement</span>
                            <span>{wo.finishedGoodsName || 'Finished Item'}</span>
                            {bom && <span className="font-mono text-[10px] text-neutral-600">(BOM: {bom.bomNo})</span>}
                          </div>
                          <div className="font-mono font-bold text-neutral-900">
                            Calculation: <span className="font-black">{totalFgQty.toLocaleString()} Pcs</span> ÷ <span className="font-black">{ups} UPS</span> = <span className="font-black text-purple-900 text-sm">{totalSheets.toLocaleString()} {pluralUnit} (Round Figure)</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 5. PRODUCTION TREE SECTION */}
                    <div className="text-center my-2">
                      <h2 className="text-sm font-black underline uppercase tracking-wide">Production Tree</h2>
                    </div>

                    <table className="w-full text-xs border-2 border-black border-collapse mb-6 text-center font-semibold">
                      <thead>
                        <tr className="border-b-2 border-black bg-neutral-100 font-bold">
                          <th className="p-1.5 border-r border-black w-14">SL No</th>
                          <th className="p-1.5 border-r border-black w-24">Process Code</th>
                          <th className="p-1.5 border-r border-black text-left pl-3">Process Name</th>
                          <th className="p-1.5 border-r border-black w-20">Status</th>
                          <th className="p-1.5 text-left pl-3">Machine / Routing Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(wo.selectedProcesses && wo.selectedProcesses.length > 0
                          ? wo.selectedProcesses.filter(p => p.isIncluded !== false)
                          : [
                              { processCode: 'PROC-01', processName: 'Offset Printing / Color Match', notes: 'Heidelberg Speedmaster Press #1', isIncluded: true },
                              { processCode: 'PROC-02', processName: 'Thermal Lamination & UV Coating', notes: 'Automatic Laminator #2', isIncluded: true },
                              { processCode: 'PROC-03', processName: 'Precision Die Cutting / Punching', notes: 'Bobst Die Cutter #3', isIncluded: true },
                              { processCode: 'PROC-04', processName: 'Quality Inspection & Packaging', notes: 'QC Station #1', isIncluded: true }
                            ]
                        ).map((proc, pIdx) => (
                          <tr key={pIdx} className="border-b border-black h-7">
                            <td className="p-1 border-r border-black font-bold">{pIdx + 1}</td>
                            <td className="p-1 border-r border-black font-mono font-bold text-[10px]">{proc.processCode || `PROC-0${pIdx+1}`}</td>
                            <td className="p-1 border-r border-black text-left pl-3 font-bold">{proc.processName}</td>
                            <td className="p-1 border-r border-black text-center font-mono text-[10px] font-bold text-emerald-900">
                              REQUIRED
                            </td>
                            <td className="p-1 text-left pl-3 font-medium">{proc.notes || 'Standard Line'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* 6. APPROVAL & SIGNATURE LINES */}
                    <div className="mt-14 pt-8 pb-3 text-[11px] font-black text-center border-t-2 border-black grid grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <div className="h-6"></div>
                        <div className="border-t-2 border-black pt-1.5 uppercase tracking-wider text-black font-bold">Prepared By</div>
                        <p className="text-[9px] font-normal text-neutral-600">Sales Order / Entry</p>
                      </div>
                      <div className="space-y-1">
                        <div className="h-6"></div>
                        <div className="border-t-2 border-black pt-1.5 uppercase tracking-wider text-black font-bold">Checked By</div>
                        <p className="text-[9px] font-normal text-neutral-600">Store & Planning</p>
                      </div>
                      <div className="space-y-1">
                        <div className="h-6"></div>
                        <div className="border-t-2 border-black pt-1.5 uppercase tracking-wider text-black font-bold">Approved By</div>
                        <p className="text-[9px] font-normal text-neutral-600">Manager / Dept Head</p>
                      </div>
                      <div className="space-y-1">
                        <div className="h-6"></div>
                        <div className="border-t-2 border-black pt-1.5 uppercase tracking-wider text-black font-bold">Authorized Signatory</div>
                        <p className="text-[9px] font-normal text-neutral-600">Director / Plant Head</p>
                      </div>
                    </div>
                  </div>

                  {/* Audit Logs (Screen view only) */}
                  <div className="space-y-2 mt-4 no-print">
                    <h4 className="text-xs font-bold text-neutral-800 uppercase">Audit Trail & Action Logs</h4>
                    <div className="bg-neutral-900 text-neutral-100 p-3 rounded-xl text-[11px] font-mono max-h-36 overflow-y-auto space-y-1">
                      {(wo.auditLogs || []).map((log, idx) => (
                        <p key={idx}>
                          <span className="text-neutral-400">[{log.timestamp}]</span> <span className="text-amber-400 font-bold">{log.performedBy}:</span> {log.action} {log.details && <span className="text-neutral-400">({log.details})</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE CUSTOMER MASTER --- */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-neutral-900">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button onClick={() => setShowAddCustomerModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Customer Code</label>
                <input type="text" value={newCustCode} onChange={e => setNewCustCode(e.target.value)} placeholder="CUST-0001" className="w-full px-3 py-1.5 border rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Customer Name *</label>
                <input type="text" required value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="ABC International Ltd." className="w-full px-3 py-1.5 border rounded-xl font-bold" />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Full Address</label>
                <input type="text" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} placeholder="Dhaka, Bangladesh" className="w-full px-3 py-1.5 border rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Contact Person</label>
                  <input type="text" value={newCustContact} onChange={e => setNewCustContact(e.target.value)} className="w-full px-3 py-1.5 border rounded-xl" />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Phone</label>
                  <input type="text" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="w-full px-3 py-1.5 border rounded-xl" />
                </div>
              </div>

              {/* Currency & Conversion Rate Setup */}
              <div className="grid grid-cols-2 gap-2 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                <div>
                  <label className="font-bold text-emerald-950 block mb-1">Default Currency</label>
                  <select
                    value={newCustDefaultCurrency}
                    onChange={e => {
                      const curr = e.target.value;
                      setNewCustDefaultCurrency(curr);
                      if (curr === 'BDT') setNewCustConversionRate('1');
                      else {
                        const curObj = currencies.find(c => c.code.toUpperCase() === curr.toUpperCase());
                        if (curObj?.exchangeRateToBDT) setNewCustConversionRate(String(curObj.exchangeRateToBDT));
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg font-bold bg-white text-xs"
                  >
                    <option value="BDT">BDT (৳)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-emerald-950 block mb-1">Conversion Rate (to ৳ BDT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCustConversionRate}
                    onChange={e => setNewCustConversionRate(e.target.value)}
                    placeholder="e.g. 120.00"
                    className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg font-mono font-bold bg-white text-xs text-emerald-900"
                  />
                </div>
                <p className="col-span-2 text-[10px] text-emerald-700 font-medium">
                  Used by Dashboard and Sales Orders for converting foreign currency sales to BDT automatically.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Payment Terms</label>
                  <input type="text" value={newCustPaymentTerms} onChange={e => setNewCustPaymentTerms(e.target.value)} placeholder="30 Days Credit" className="w-full px-3 py-1.5 border rounded-xl" />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Country</label>
                  <input type="text" value={newCustCountry} onChange={e => setNewCustCountry(e.target.value)} placeholder="Bangladesh" className="w-full px-3 py-1.5 border rounded-xl" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="px-3 py-1.5 bg-neutral-100 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 text-white rounded-xl font-bold">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE BUYER MASTER --- */}
      {showAddBuyerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-neutral-900">{editingBuyer ? 'Edit Buyer' : 'Add New Buyer'}</h3>
              <button onClick={() => setShowAddBuyerModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveBuyer} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Buyer Name *</label>
                <input type="text" required value={newBuyerName} onChange={e => setNewBuyerName(e.target.value)} placeholder="H&M, Zara, etc." className="w-full px-3 py-1.5 border rounded-xl font-bold" />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Link to Customer</label>
                <select value={newBuyerCustId} onChange={e => setNewBuyerCustId(e.target.value)} className="w-full px-3 py-1.5 border rounded-xl">
                  <option value="">-- All Customers / General --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Contact Person</label>
                <input type="text" value={newBuyerContact} onChange={e => setNewBuyerContact(e.target.value)} placeholder="John Doe" className="w-full px-3 py-1.5 border rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Phone</label>
                  <input type="text" value={newBuyerPhone} onChange={e => setNewBuyerPhone(e.target.value)} placeholder="+88017..." className="w-full px-3 py-1.5 border rounded-xl" />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Email</label>
                  <input type="email" value={newBuyerEmail} onChange={e => setNewBuyerEmail(e.target.value)} placeholder="buyer@example.com" className="w-full px-3 py-1.5 border rounded-xl" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddBuyerModal(false)} className="px-3 py-1.5 bg-neutral-100 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 text-white rounded-xl font-bold">Save Buyer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT PRICE MASTER --- */}
      {showAddPriceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  {editingPrice ? 'Edit Price Master Rule' : 'Configure New Price Master Rule'}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {editingPrice ? 'Changes require approval before activating.' : 'Ensure unique customer + item pair.'}
                </p>
              </div>
              <button onClick={() => setShowAddPriceModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            {editingPrice && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Approval Flow Active:</span>
                  Editing an existing price rule will submit a price change request for approval. The current active rate (৳{editingPrice.rate.toFixed(2)}) will stay active until approved.
                </div>
              </div>
            )}
            <form onSubmit={handleSavePrice} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Customer *</label>
                <select 
                  required 
                  disabled={!!editingPrice}
                  value={newPriceCustId} 
                  onChange={e => setNewPriceCustId(e.target.value)} 
                  className="w-full px-3 py-1.5 border rounded-xl disabled:bg-neutral-100 disabled:text-neutral-600"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Finished Goods Item *</label>
                <select 
                  required 
                  disabled={!!editingPrice}
                  value={newPriceFgId} 
                  onChange={e => {
                    const fgId = e.target.value;
                    setNewPriceFgId(fgId);
                    const fg = finishedGoods.find(f => f.id === fgId);
                    if (fg?.unit) {
                      setNewPriceUnit(fg.unit);
                    }
                  }} 
                  className="w-full px-3 py-1.5 border rounded-xl disabled:bg-neutral-100 disabled:text-neutral-600"
                >
                  <option value="">-- Select Item --</option>
                  {finishedGoods.map(f => <option key={f.id} value={f.id}>[{f.fgNo}] {f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Style (Optional)</label>
                <input type="text" value={newPriceStyle} onChange={e => setNewPriceStyle(e.target.value)} placeholder="Leave blank for general customer rate" className="w-full px-3 py-1.5 border rounded-xl" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Currency *</label>
                  <select
                    value={newPriceCurrCode}
                    onChange={e => {
                      const code = e.target.value;
                      setNewPriceCurrCode(code);
                      const cur = currencies.find(c => (c.code || (c as any).currencyCode) === code);
                      if (cur) setNewPriceCurrId(cur.id);
                    }}
                    className="w-full px-3 py-1.5 border rounded-xl font-bold bg-white text-xs"
                  >
                    <option value="BDT">BDT (৳) - Bangladeshi Taka</option>
                    <option value="USD">USD ($) - US Dollar</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Unit of Measurement *</label>
                  <select
                    value={newPriceUnit}
                    onChange={e => setNewPriceUnit(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-xl font-bold bg-white text-xs uppercase"
                  >
                    <option value="PCS">PCS - Pieces</option>
                    <option value="DZN">DZN - Dozen (12 Pcs)</option>
                    <option value="GROSS">GROSS - Gross (144 Pcs)</option>
                    <option value="SET">SET - Sets</option>
                    <option value="1000 PCS">1000 PCS - Thousand (1,000 Pcs)</option>
                    <option value="YDS">YDS - Yards</option>
                    <option value="MTR">MTR - Meters</option>
                    <option value="KG">KG - Kilograms</option>
                    <option value="ROLL">ROLL - Rolls</option>
                    <option value="CONE">CONE - Cones</option>
                    <option value="PACK">PACK - Packs</option>
                    <option value="PAIR">PAIR - Pairs</option>
                    <option value="BOX">BOX - Boxes</option>
                    <option value="SHEET">SHEET - Sheets</option>
                    <option value="LBS">LBS - Pounds</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Rate ({getCurrencySymbol(newPriceCurrCode)} / {newPriceUnit}) *</label>
                  <input type="number" step="0.0001" required value={newPriceRate} onChange={e => setNewPriceRate(e.target.value === '' ? '' : Number(e.target.value))} placeholder="1.50" className="w-full px-3 py-1.5 border rounded-xl font-bold text-emerald-700 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddPriceModal(false)} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold">
                  {editingPrice ? 'Submit for Approval' : 'Save Price Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT FINISHED GOODS MASTER --- */}
      {showAddFgModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">{editingFg ? 'Edit Finished Goods Item' : 'Add New Finished Goods Item'}</h3>
                <p className="text-[11px] text-neutral-500">Associate with a specific customer or keep general.</p>
              </div>
              <button onClick={() => setShowAddFgModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveFg} className="space-y-3 text-xs">
              {/* Customer Selector with '+ Add Customer' button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-neutral-700">Customer Name *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCustomer(null);
                      setNewCustCode('');
                      setNewCustName('');
                      setNewCustAddress('');
                      setNewCustContact('');
                      setNewCustPhone('');
                      setNewCustEmail('');
                      setShowAddCustomerModal(true);
                    }}
                    className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> + Add Customer
                  </button>
                </div>
                <select
                  value={newFgCustId}
                  onChange={e => {
                    const custId = e.target.value;
                    setNewFgCustId(custId);
                    const cObj = customers.find(c => c.id === custId);
                    setNewFgCustName(cObj ? cObj.name : '');
                  }}
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900 bg-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Select Customer for this Finished Goods --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.customerCode ? `[${c.customerCode}] ` : ''}{c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 mt-0.5">When creating Sales Orders, choosing this customer will filter to only show these Finished Goods.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Item Code / FG No</label>
                  <input
                    type="text"
                    value={newFgNo}
                    onChange={e => setNewFgNo(e.target.value)}
                    placeholder="Auto-generated e.g. FG-00001"
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Unit of Measurement * <span className="text-rose-500 font-bold">(Mandatory)</span></label>
                  <select
                    required
                    value={newFgUnit}
                    onChange={e => setNewFgUnit(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Select Unit --</option>
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="DZN">DZN (Dozen - 12 Pcs)</option>
                    <option value="GROSS">GROSS (Gross - 144 Pcs)</option>
                    <option value="THOUSAND">THOUSAND (1,000 Pcs)</option>
                    <option value="ROLL">ROLL (Roll)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="LBS">LBS (Pounds)</option>
                    <option value="PACKET">PACKET (Packet / Pkt)</option>
                    <option value="BOX">BOX (Box)</option>
                    <option value="SET">SET (Set)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="YDS">YDS (Yards)</option>
                    <option value="SFT">SFT (Square Feet)</option>
                    <option value="REAM">REAM (Ream - 500 Sheets)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Finished Goods Item Name *</label>
                <input
                  type="text"
                  required
                  value={newFgName}
                  onChange={e => setNewFgName(e.target.value)}
                  placeholder="e.g. Hang Tag 350 GSM Gloss Finish"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                />
              </div>

              {/* Category Dropdown with "+ Add Category" button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-neutral-700">Category *</label>
                  <button
                    type="button"
                    onClick={handleOpenAddCategoryModal}
                    className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> + Add Category
                  </button>
                </div>
                <select
                  value={newFgCatId}
                  onChange={e => {
                    const catId = e.target.value;
                    setNewFgCatId(catId);
                    const catObj = fgCategories.find(c => c.id === catId);
                    if (catObj) setNewFgCatName(catObj.name);
                    setNewFgSubCatId('');
                  }}
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold"
                >
                  <option value="">-- Select Category --</option>
                  {fgCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.categoryCode}] {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Category Dropdown with "+ Add Sub-Category" button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-neutral-700">Sub-Category *</label>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddSubCategoryModal();
                      setNewSubCatCatId(newFgCatId);
                    }}
                    className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> + Add Sub-Category
                  </button>
                </div>
                <select
                  value={newFgSubCatId}
                  onChange={e => {
                    const subId = e.target.value;
                    setNewFgSubCatId(subId);
                    const subObj = fgSubCategories.find(s => s.id === subId);
                    if (subObj) setNewFgSubCatName(subObj.name);
                  }}
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold"
                >
                  <option value="">-- Select Sub-Category --</option>
                  {fgSubCategories
                    .filter(s => !newFgCatId || s.categoryId === newFgCatId || s.categoryName === newFgCatName)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        [{s.subCategoryCode}] {s.name} ({s.categoryName || 'General'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Default Base Rate (৳) <span className="text-neutral-400 font-normal">(Optional - Price not required)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newFgPrice}
                  onChange={e => setNewFgPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 1.50 (Optional)"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Default Specification / Remarks</label>
                <textarea
                  rows={2}
                  value={newFgSpec}
                  onChange={e => setNewFgSpec(e.target.value)}
                  placeholder="e.g. 350 GSM Art Card, Matt Lamination, Spot UV, Size 50x90mm"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddFgModal(false)} className="px-3.5 py-1.5 bg-neutral-100 text-neutral-800 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md">Save Finished Goods</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT CATEGORY MASTER --- */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-neutral-900">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
              <button onClick={() => setShowAddCategoryModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Category Code</label>
                <input
                  type="text"
                  value={newCatCode}
                  onChange={e => setNewCatCode(e.target.value)}
                  placeholder="e.g. CAT-01"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="e.g. Offset Printing, Care Label, Heat Seal"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                  placeholder="Brief description of product types in this category"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCategoryModal(false)} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT SUB-CATEGORY MASTER --- */}
      {showAddSubCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-neutral-900">{editingSubCategory ? 'Edit Sub-Category' : 'Add New Sub-Category'}</h3>
              <button onClick={() => setShowAddSubCategoryModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveSubCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Parent Category *</label>
                <select
                  required
                  value={newSubCatCatId}
                  onChange={e => setNewSubCatCatId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold"
                >
                  <option value="">-- Select Parent Category --</option>
                  {fgCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.categoryCode}] {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Sub-Category Code</label>
                <input
                  type="text"
                  value={newSubCatCode}
                  onChange={e => setNewSubCatCode(e.target.value)}
                  placeholder="e.g. SUBCAT-01"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Sub-Category Name *</label>
                <input
                  type="text"
                  required
                  value={newSubCatName}
                  onChange={e => setNewSubCatName(e.target.value)}
                  placeholder="e.g. Hang Tag, Barcode Sticker, Poly Sticker"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={newSubCatDesc}
                  onChange={e => setNewSubCatDesc(e.target.value)}
                  placeholder="Brief description of items in this sub-category"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddSubCategoryModal(false)} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md">Save Sub-Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT SECTION MASTER --- */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-neutral-900">{editingSection ? 'Edit Section' : 'Add New Section'}</h3>
              <button onClick={() => setShowAddSectionModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveSection} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Section Code *</label>
                <input
                  type="text"
                  required
                  value={newSectionCode}
                  onChange={e => setNewSectionCode(e.target.value)}
                  placeholder="e.g. SEC-01"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono font-bold text-purple-700"
                />
              </div>
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Section / Factory Unit Name *</label>
                <input
                  type="text"
                  required
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  placeholder="e.g. Offset, Care Label, Heat Seal, Thread"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddSectionModal(false)} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md">
                  {editingSection ? 'Update Section' : 'Save Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT PRODUCTION PROCESS --- */}
      {showAddProcessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-neutral-900">{editingProcess ? 'Edit Production Process' : 'Add Production Process'}</h3>
              <button onClick={() => setShowAddProcessModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveProcess} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Associated Section *</label>
                <select
                  required
                  value={newProcessSectionId}
                  onChange={e => setNewProcessSectionId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-bold text-neutral-900 bg-white"
                >
                  <option value="">-- Select Section --</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Process Code *</label>
                  <input
                    type="text"
                    required
                    value={newProcessCode}
                    onChange={e => setNewProcessCode(e.target.value)}
                    placeholder="e.g. PROC-01"
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono font-bold text-purple-700"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Sequence Order *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newProcessSeq}
                    onChange={e => setNewProcessSeq(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="1, 2, 3..."
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Process Name *</label>
                <input
                  type="text"
                  required
                  value={newProcessName}
                  onChange={e => setNewProcessName(e.target.value)}
                  placeholder="e.g. Plate Making, Printing, Lamination, Cut & Fold"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Description / Remarks</label>
                <textarea
                  rows={2}
                  value={newProcessDesc}
                  onChange={e => setNewProcessDesc(e.target.value)}
                  placeholder="Additional details about machine or setup for this process"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddProcessModal(false)} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md">
                  {editingProcess ? 'Update Process' : 'Save Process'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT CURRENCY MASTER --- */}
      {showAddCurrencyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-neutral-900">{editingCurrency ? 'Edit Currency Master' : 'Add Currency Master'}</h3>
              <button onClick={() => setShowAddCurrencyModal(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSaveCurrency} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Currency Code *</label>
                  <input
                    type="text"
                    required
                    value={newCurrencyCode}
                    onChange={e => setNewCurrencyCode(e.target.value.toUpperCase())}
                    placeholder="e.g. USD, EUR, GBP"
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono font-bold text-purple-700 uppercase"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={newCurrencySymbol}
                    onChange={e => setNewCurrencySymbol(e.target.value)}
                    placeholder="e.g. $, €, £, ₹, ¥"
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Currency Name *</label>
                <input
                  type="text"
                  required
                  value={newCurrencyName}
                  onChange={e => setNewCurrencyName(e.target.value)}
                  placeholder="e.g. US Dollar, Euro, British Pound"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Base Exchange Rate to BDT (৳) *</label>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-500">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCurrencyRate}
                    onChange={e => setNewCurrencyRate(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 120.00"
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-xl font-mono font-bold text-indigo-700"
                  />
                  <span className="text-[11px] text-neutral-400 font-semibold whitespace-nowrap">per 1 {newCurrencyCode || 'Unit'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCurrencyModal(false)} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md">
                  {editingCurrency ? 'Update Currency' : 'Save Currency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB: CUSTOMER MRR RECEIPT */}
      {subTab === 'mrr-receipt' && (
        <CustomerMrrReceiptView 
          userProfile={userProfile} 
          showToast={showToast} 
          customers={customers} 
        />
      )}

      {/* SUBTAB: BOOKING REPORT */}
      {subTab === 'booking-report' && (
        <BookingReportView
          userProfile={userProfile}
          workOrders={workOrders}
          customers={customers}
          buyers={buyers}
          sections={sections}
          finishedGoods={finishedGoods}
          challans={challans}
          onViewWorkOrder={(wo) => {
            setViewingWo(wo);
            setShowWoDetailsModal(true);
          }}
        />
      )}

      {/* SUBTAB: SALES REPORT */}
      {subTab === 'sales-report' && (
        <SalesReportView
          userProfile={userProfile}
          challans={challans}
          gatePasses={gatePasses}
          workOrders={workOrders}
          customers={customers}
          buyers={buyers}
          sections={sections}
          finishedGoods={finishedGoods}
          priceMasters={priceMasters}
        />
      )}

      {/* --- RECTIFY ORDER REQUEST MODAL (UNLOCK & EDIT) --- */}
      {showRectifyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-neutral-100">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-neutral-100 text-neutral-800 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900">Rectify Order Request</h3>
                  <p className="text-xs text-neutral-500 font-medium">Request management permission to unlock and amend a locked Work Order</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRectifyModal(false);
                  setRectifyRemarks('');
                  setRectifyTargetWo(null);
                }}
                className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Select Work Order if not already targeted */}
            <div>
              <label className="text-xs font-bold text-neutral-700 block mb-1">
                Select Work Order to Rectify <span className="text-rose-500">*</span>
              </label>
              <select
                value={rectifyTargetWo?.id || ''}
                onChange={(e) => {
                  const found = workOrders.find(w => w.id === e.target.value);
                  setRectifyTargetWo(found || null);
                }}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Choose a Confirmed / Approved Work Order --</option>
                {workOrders.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.woNumber} - {w.customerName} ({w.buyerName || 'Buyer'}) | Total: {getCurrencySymbol(w.currencyCode)} {(w.totalAmount || 0).toLocaleString()} [{w.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Work Order Summary Card */}
            {rectifyTargetWo && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs space-y-1.5 text-neutral-800">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-neutral-900 font-mono text-sm font-bold">{rectifyTargetWo.woNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black ${
                    rectifyTargetWo.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {rectifyTargetWo.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-neutral-200 text-neutral-700">
                  <p><strong className="text-neutral-900">Customer:</strong> {rectifyTargetWo.customerName || 'N/A'}</p>
                  <p><strong className="text-neutral-900">Buyer:</strong> {rectifyTargetWo.buyerName || 'N/A'}</p>
                  <p><strong className="text-neutral-900">Total Quantity:</strong> {rectifyTargetWo.totalQuantity.toLocaleString()} Pcs</p>
                  <p><strong className="text-neutral-900">Total Value:</strong> {getCurrencySymbol(rectifyTargetWo.currencyCode)} {(rectifyTargetWo.totalAmount || 0).toLocaleString()} {rectifyTargetWo.currencyCode || 'USD'}</p>
                </div>
              </div>
            )}

            {/* Remarks / Rectification Reason */}
            <div>
              <label className="text-xs font-bold text-neutral-700 block mb-1">
                Rectification Remarks & Reason for Amendment <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rectifyRemarks}
                onChange={(e) => setRectifyRemarks(e.target.value)}
                placeholder="Explain what needs to be changed (e.g., Buyer requested 1000 pcs increase, size ratio correction, price update)..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
              <p className="font-bold text-neutral-800 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-neutral-700" />
                Workflow Process:
              </p>
              <p>1. This request will be sent to the designated management approver in the Approvals Center.</p>
              <p>2. Once approved, the Work Order will be UNLOCKED and converted back to Draft so you can edit quantities, breakdowns, and prices.</p>
              <p>3. After updating, re-confirm the Work Order for final production approval.</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={isSubmittingRectify}
                onClick={() => {
                  setShowRectifyModal(false);
                  setRectifyRemarks('');
                  setRectifyTargetWo(null);
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRectify || !rectifyTargetWo || !rectifyRemarks.trim()}
                onClick={handleSubmitRectifyRequest}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingRectify ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Submit Rectification Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- UNIFIED ACTION CONFIRMATION MODAL (DELETE & UPDATE POPUP) --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-neutral-100">
            <div className="flex items-center gap-3">
              {confirmDialog.type === 'delete' ? (
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                  <Trash2 className="w-6 h-6" />
                </div>
              ) : confirmDialog.type === 'warning' ? (
                <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                  <Edit2 className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-black text-neutral-900">{confirmDialog.title}</h3>
                <p className="text-xs text-neutral-500 font-medium">Please confirm before proceeding</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed font-medium">
              {confirmDialog.message}
            </p>

            {confirmDialog.details && confirmDialog.details.length > 0 && (
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5 font-medium">
                {confirmDialog.details.map((d, idx) => (
                  <div key={idx} className="flex justify-between items-center text-neutral-700">
                    <span className="text-neutral-500 font-semibold">{d.label}:</span>
                    <span className="font-bold font-mono text-neutral-900">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors"
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeConfirmDialogAction}
                className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md transition-all ${
                  confirmDialog.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                    : confirmDialog.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {confirmDialog.confirmText || (confirmDialog.type === 'delete' ? 'Yes, Delete' : 'Yes, Update')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
