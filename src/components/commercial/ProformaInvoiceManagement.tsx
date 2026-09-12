import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Receipt, Plus, FileText, CheckCircle2, Clock, XCircle, 
  Search, Filter, Printer, Edit, Trash2, ChevronRight, 
  Building2, AlertTriangle, ShieldCheck, ArrowRight, Eye,
  CreditCard, Check, ArrowLeft, RefreshCw, Send, Lock,
  Calendar, Layers, DollarSign, Download, Settings, FileCheck2,
  Truck, RotateCcw, Sparkles, ArrowUp, ArrowDown, Edit3
} from 'lucide-react';
import { 
  ProformaInvoice, ProformaInvoiceItem, CustomerBill, WorkOrder, 
  BankMaster, BankAccountMaster, PISetupConfig, UserProfile,
  PISourceType, PIStatus
} from '../../types';
import { 
  collection, query, where, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc, Timestamp, orderBy 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  ProformaInvoicePrintView, 
  numberToWordsUSD, 
  PITermItem, 
  DEFAULT_PI_TERMS, 
  PRESET_PI_CLAUSES, 
  parsePITerms 
} from './ProformaInvoicePrintView';
import { BankMasterView } from './BankMasterView';
import { ConfirmModal, ConfirmVariant } from '../ui/ConfirmModal';

export type CommercialMainTab = 'create-pi-bill' | 'create-pi-wo' | 'document' | 'pi-list' | 'pending-approvals' | 'create-pi' | 'bank-master';

interface ProformaInvoiceManagementProps {
  userProfile: UserProfile;
  initialMainTab?: CommercialMainTab;
  initialBillId?: string;
  initialWoId?: string;
  initialSourceType?: PISourceType;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToBill?: (billId: string) => void;
  onNavigateToWorkOrder?: (woId: string) => void;
  onSubTabChange?: (tab: CommercialMainTab) => void;
  allowedPagesSet?: Set<string>;
  roles?: any[];
}

export const ProformaInvoiceManagement: React.FC<ProformaInvoiceManagementProps> = ({
  userProfile,
  initialMainTab,
  initialBillId,
  initialWoId,
  initialSourceType,
  showToast,
  onNavigateToBill,
  onNavigateToWorkOrder,
  onSubTabChange,
  allowedPagesSet,
  roles = []
}) => {
  const businessId = userProfile.businessId || 'default';
  const isSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com';

  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  const canAccessPiList = isPagePermitted('commercial-pi') || isPagePermitted('commercial-pi-list') || isPagePermitted('commercial');
  const canAccessCreatePi = isPagePermitted('commercial-pi') || isPagePermitted('commercial-pi-create') || isPagePermitted('commercial-pi-bill') || isPagePermitted('commercial-pi-wo') || isPagePermitted('commercial');
  const canAccessDocument = isPagePermitted('commercial-pi') || isPagePermitted('commercial-documents') || isPagePermitted('commercial');
  const canAccessApprovals = isPagePermitted('commercial-pi') || isPagePermitted('commercial-pi-approvals') || isPagePermitted('commercial');

  const availableTabs = useMemo(() => {
    const list: CommercialMainTab[] = [];
    if (canAccessCreatePi) {
      list.push('create-pi-bill');
      list.push('create-pi-wo');
    }
    if (canAccessDocument) list.push('document');
    if (canAccessPiList) list.push('pi-list');
    if (canAccessApprovals || isSuperAdmin) list.push('pending-approvals');
    return list;
  }, [canAccessCreatePi, canAccessDocument, canAccessPiList, canAccessApprovals, isSuperAdmin]);

  // Main navigation tabs
  const defaultTab: CommercialMainTab = initialMainTab || (initialBillId ? 'create-pi-bill' : initialWoId ? 'create-pi-wo' : 'create-pi-bill');
  const [activeMainTab, setActiveMainTab] = useState<CommercialMainTab>(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(defaultTab) && defaultTab !== 'create-pi') {
      return availableTabs[0];
    }
    return defaultTab;
  });

  const [selectedDocPiId, setSelectedDocPiId] = useState<string>('');
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeMainTab) && activeMainTab !== 'create-pi' && activeMainTab !== 'bank-master') {
      setActiveMainTab(availableTabs[0]);
    }
  }, [availableTabs, activeMainTab]);

  useEffect(() => {
    if (initialMainTab) {
      setActiveMainTab(initialMainTab);
      if (initialMainTab === 'create-pi-bill') {
        setPiSource('bill_based');
      } else if (initialMainTab === 'create-pi-wo') {
        setPiSource('booking_based');
      }
    }
  }, [initialMainTab]);

  useEffect(() => {
    if (initialBillId) {
      setPiSource('bill_based');
      setSelectedBillId(initialBillId);
      setActiveMainTab('create-pi-bill');
    }
  }, [initialBillId]);

  useEffect(() => {
    if (initialWoId) {
      setPiSource('booking_based');
      setSelectedWoId(initialWoId);
      setActiveMainTab('create-pi-wo');
    }
  }, [initialWoId]);

  // Data states
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [bills, setBills] = useState<CustomerBill[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [banks, setBanks] = useState<BankMaster[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountMaster[]>([]);
  const [piSetup, setPiSetup] = useState<PISetupConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Active Viewing / Printing states
  const [viewingPI, setViewingPI] = useState<ProformaInvoice | null>(null);
  const [printingPI, setPrintingPI] = useState<ProformaInvoice | null>(null);
  
  // Rejection Dialog State
  const [rejectingPI, setRejectingPI] = useState<ProformaInvoice | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // ----------------------------------------------------
  // PI FORM STATE
  // ----------------------------------------------------
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [editingPIId, setEditingPIId] = useState<string | null>(null);

  const [piSource, setPiSource] = useState<PISourceType>(initialSourceType || (initialBillId ? 'bill_based' : 'bill_based'));
  const [selectedBillId, setSelectedBillId] = useState<string>(initialBillId || '');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>(initialBillId ? [initialBillId] : []);
  const [selectedBills, setSelectedBills] = useState<{ billId: string; billNo: string; billDate: string; amountUSD: number }[]>([]);
  const [billSearchQuery, setBillSearchQuery] = useState('');

  const [selectedWoId, setSelectedWoId] = useState<string>(initialWoId || '');
  const [selectedWoIds, setSelectedWoIds] = useState<string[]>(initialWoId ? [initialWoId] : []);
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<{ woId: string; woNumber: string; date?: string; amountUSD: number }[]>([]);
  const [woSearchQuery, setWoSearchQuery] = useState('');

  const [piNumber, setPiNumber] = useState<string>('');
  const [piDate, setPiDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [validityDate, setValidityDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [buyerName, setBuyerName] = useState('');

  // Commercial & Export Negotiation Parameters
  const [lcNumber, setLcNumber] = useState('2167260400592');
  const [lcDate, setLcDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exportLcNo, setExportLcNo] = useState('FAL-AW26-01');
  const [exportLcDate, setExportLcDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [commercialInvoiceNo, setCommercialInvoiceNo] = useState('');
  const [commercialInvoiceDate, setCommercialInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryChallanNo, setDeliveryChallanNo] = useState('');
  const [deliveryChallanDate, setDeliveryChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [truckNo, setTruckNo] = useState('Dhaka Metro MA-11-5740');
  const [tenorDays, setTenorDays] = useState('90 days');
  const [hsCode, setHsCode] = useState('6217.10.00');
  const [commodity, setCommodity] = useState('GARMENTS ACCESSORIES');
  const [netWeightKg, setNetWeightKg] = useState<number>(12070.66);
  const [grossWeightKg, setGrossWeightKg] = useState<number>(12312.07);
  const [carrier, setCarrier] = useState('By Truck');
  const [sailingDate, setSailingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [finalDestination, setFinalDestination] = useState('Buyer Factory.');

  // Advising & Issuing Banks
  const [issuingBankName, setIssuingBankName] = useState('THE PREMIER BANK PLC');
  const [issuingBankBranch, setIssuingBankBranch] = useState('CENTRAL TRADE OPERATION');
  const [issuingBankCity, setIssuingBankCity] = useState('DHAKA BD');
  const [buyerIrc, setBuyerIrc] = useState('260326120010019');
  const [buyerErc, setBuyerErc] = useState('260326210044019');
  const [buyerBin, setBuyerBin] = useState('000154448-0204');
  const [buyerTin, setBuyerTin] = useState('848559133820');
  const [buyerBankBin, setBuyerBankBin] = useState('000000548-0002');

  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [masterPIValue, setMasterPIValue] = useState<number>(0.0);

  // Bank Info
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedBankName, setSelectedBankName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankSwiftCode, setBankSwiftCode] = useState('');
  const [bankRoutingNumber, setBankRoutingNumber] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankBeneficiaryName, setBankBeneficiaryName] = useState('ES TRIMS LIMITED');
  const [bankAddress, setBankAddress] = useState('');

  // Commercial Terms & Conditions State
  const [paymentTerms, setPaymentTerms] = useState('100% Irrevocable Letter of Credit (LC) at Sight');
  const [shipmentTerms, setShipmentTerms] = useState('FOB Dhaka / Chittagong');
  const [portOfLoading, setPortOfLoading] = useState('Dhaka / Chittagong, Bangladesh');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [deliveryPeriod, setDeliveryPeriod] = useState('7-15 Days from LC Receipt');
  const [remarks, setRemarks] = useState('');

  // Editable Terms & Conditions clauses list
  const [termsList, setTermsList] = useState<PITermItem[]>(() => DEFAULT_PI_TERMS.map(t => ({ ...t })));

  const handleAddTerm = () => {
    const nextIdx = termsList.length + 1;
    setTermsList(prev => [
      ...prev,
      {
        id: `term-${Date.now()}`,
        label: `${String(nextIdx).padStart(2, '0')}. Clause :`,
        text: ''
      }
    ]);
  };

  const handleUpdateTerm = (idx: number, field: 'label' | 'text', val: string) => {
    setTermsList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveTerm = (idx: number) => {
    setTermsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMoveTerm = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= termsList.length) return;
    setTermsList(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleResetTerms = () => {
    setTermsList(DEFAULT_PI_TERMS.map(t => ({ ...t })));
  };

  const handleAddPreset = (preset: { name: string; label: string; text: string }) => {
    const nextIdx = termsList.length + 1;
    setTermsList(prev => [
      ...prev,
      {
        id: `term-${Date.now()}`,
        label: `${String(nextIdx).padStart(2, '0')}. ${preset.label}`,
        text: preset.text
      }
    ]);
  };

  // Dynamic Line Items
  const [piItems, setPiItems] = useState<ProformaInvoiceItem[]>([
    {
      id: 'item-1',
      sl: 1,
      itemName: 'Woven Label / Printed Tag',
      description: 'High Quality Garment Trims with specified artwork',
      quantity: 10000,
      unit: 'PCS',
      rate: 0.05,
      amount: 500,
      remarks: ''
    }
  ]);

  // Duplicate Warning
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Document Tab Memo
  const selectedDocPi = useMemo(() => proformaInvoices.find(p => p.id === selectedDocPiId), [proformaInvoices, selectedDocPiId]);

  // ----------------------------------------------------
  // REAL-TIME FIRESTORE SUBSCRIPTIONS
  // ----------------------------------------------------
  useEffect(() => {
    setIsLoading(true);

    // 1. Proforma Invoices
    const qPI = query(collection(db, 'proforma_invoices'), where('businessId', '==', businessId));
    const unsubPI = onSnapshot(qPI, (snap) => {
      const data: ProformaInvoice[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as ProformaInvoice));
      // Sort newest date first
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProformaInvoices(data);
      setIsLoading(false);
    }, (err) => {
      console.warn('PI listener notice:', err);
      setIsLoading(false);
    });

    // 2. Customer Bills
    const qBills = query(collection(db, 'customer_bills'), where('businessId', '==', businessId));
    const unsubBills = onSnapshot(qBills, (snap) => {
      const data: CustomerBill[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as CustomerBill));
      data.sort((a, b) => (b.billDate || '').localeCompare(a.billDate || ''));
      setBills(data);
    }, (err) => {
      console.warn('Customer bills listener notice:', err);
    });

    // 3. Work Orders
    const qWo = query(collection(db, 'work_orders'), where('businessId', '==', businessId));
    const unsubWo = onSnapshot(qWo, (snap) => {
      const data: WorkOrder[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as WorkOrder));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setWorkOrders(data);
    }, (err) => {
      console.warn('Work orders listener notice:', err);
    });

    // 4. Bank Masters
    const qBanks = query(collection(db, 'bank_masters'), where('businessId', '==', businessId));
    const unsubBanks = onSnapshot(qBanks, (snap) => {
      const data: BankMaster[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as BankMaster));
      setBanks(data);
    }, (err) => {
      console.warn('Bank masters listener notice:', err);
    });

    // 5. Bank Accounts
    const qAccounts = query(collection(db, 'bank_accounts'), where('businessId', '==', businessId));
    const unsubAccounts = onSnapshot(qAccounts, (snap) => {
      const data: BankAccountMaster[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as BankAccountMaster));
      setBankAccounts(data);
    }, (err) => {
      console.warn('Bank accounts listener notice:', err);
    });

    // 6. PI Setup Config
    const qSetup = query(collection(db, 'pi_setup_configs'), where('businessId', '==', businessId));
    const unsubSetup = onSnapshot(qSetup, (snap) => {
      if (!snap.empty) {
        setPiSetup({ id: snap.docs[0].id, ...snap.docs[0].data() } as PISetupConfig);
      } else {
        setPiSetup({
          prefix: 'PI-',
          startingNumber: 1,
          numberFormat: 'financial_year',
          isBillBasedEnabled: true,
          isBookingBasedEnabled: true,
          isBillValueMatchingMandatory: true,
          isWoValueMatchingMandatory: true,
          valueTolerance: 0.00,
          isApprovalRequired: true,
          approverRole: 'Commercial Manager / Admin',
          businessId
        });
      }
    }, (err) => {
      console.warn('PI setup listener notice:', err);
    });

    return () => {
      unsubPI();
      unsubBills();
      unsubWo();
      unsubBanks();
      unsubAccounts();
      unsubSetup();
    };
  }, [businessId]);

  // Generate dynamic PI number
  const generateNewPINumber = useMemo(() => {
    const prefix = piSetup?.prefix || 'PI-';
    const year = new Date().getFullYear();
    const count = proformaInvoices.length + (piSetup?.startingNumber || 1);
    const padded = String(count).padStart(6, '0');
    return piSetup?.numberFormat === 'continuous' 
      ? `${prefix}${padded}` 
      : `${prefix}${year}-${padded}`;
  }, [proformaInvoices.length, piSetup]);

  // Set default bank and account when available
  useEffect(() => {
    if (!selectedBankName && banks.length > 0) {
      const defaultAcc = bankAccounts.find(a => a.isDefault) || bankAccounts[0];
      if (defaultAcc) {
        setSelectedBankId(defaultAcc.bankId || '');
        setSelectedBankName(defaultAcc.bankName);
        setSelectedAccountId(defaultAcc.id);
        setBankBranch(defaultAcc.branch);
        setBankAccountNumber(defaultAcc.accountNumber);
        setBankSwiftCode(defaultAcc.swiftCode || '');
        setBankRoutingNumber(defaultAcc.routingNumber || '');
        setBankIban(defaultAcc.iban || '');
        setBankBeneficiaryName(defaultAcc.beneficiaryName);
        setBankAddress(defaultAcc.accountAddress || '');
      } else {
        setSelectedBankName(banks[0].bankName);
        setSelectedBankId(banks[0].id);
        setBankBranch(banks[0].branchName || '');
        setBankSwiftCode(banks[0].swiftCode || '');
        setBankRoutingNumber(banks[0].routingNumber || '');
      }
    }
  }, [banks, bankAccounts, selectedBankName]);

  // Handle external trigger (initialBillId or initialWoId)
  useEffect(() => {
    if (initialBillId && bills.length > 0) {
      handleSelectBill(initialBillId);
      setActiveMainTab('create-pi');
    } else if (initialWoId && workOrders.length > 0) {
      handleSelectWorkOrder(initialWoId);
      setActiveMainTab('create-pi');
    }
  }, [initialBillId, initialWoId, bills.length, workOrders.length]);

  // Helper to safely get value of a Customer Bill
  const getCustomerBillValue = (b: any): number => {
    if (!b) return 0;
    if (typeof b.grandTotalUSD === 'number' && b.grandTotalUSD > 0) return b.grandTotalUSD;
    if (typeof b.totalAmountUSD === 'number' && b.totalAmountUSD > 0) return b.totalAmountUSD;
    if (typeof b.totalAmount === 'number' && b.totalAmount > 0) return b.totalAmount;
    if (typeof b.totalBillAmountUSD === 'number' && b.totalBillAmountUSD > 0) return b.totalBillAmountUSD;
    if (typeof b.netPayableUSD === 'number' && b.netPayableUSD > 0) return b.netPayableUSD;
    
    if (Array.isArray(b.items) && b.items.length > 0) {
      const sum = b.items.reduce((acc: number, item: any) => {
        const itemTot = (typeof item.amountUSD === 'number' && item.amountUSD > 0)
          ? item.amountUSD
          : (typeof item.amount === 'number' && item.amount > 0)
          ? item.amount
          : ((Number(item.quantityPcs) || Number(item.quantity) || 0) * (Number(item.pricePerPcs) || Number(item.rate) || 0));
        return acc + (Number(itemTot) || 0);
      }, 0);
      if (sum > 0) return sum;
    }
    return 0;
  };

  // Helper to safely get value of a Work Order
  const getWorkOrderValue = (wo: any): number => {
    if (!wo) return 0;
    if (typeof wo.totalAmount === 'number' && wo.totalAmount > 0) return wo.totalAmount;
    if (typeof wo.totalPriceUSD === 'number' && wo.totalPriceUSD > 0) return wo.totalPriceUSD;
    if (typeof wo.total === 'number' && wo.total > 0) return wo.total;
    
    // Check breakdownRows
    if (Array.isArray(wo.breakdownRows) && wo.breakdownRows.length > 0) {
      const sum = wo.breakdownRows.reduce((acc: number, r: any) => {
        const rowTot = (typeof r.total === 'number' && r.total > 0)
          ? r.total
          : (typeof r.totalPriceUSD === 'number' && r.totalPriceUSD > 0)
          ? r.totalPriceUSD
          : (typeof r.amount === 'number' && r.amount > 0)
          ? r.amount
          : ((Number(r.quantity) || Number(r.orderQty) || 0) * (Number(r.rate) || Number(r.unitPriceUSD) || 0));
        return acc + (Number(rowTot) || 0);
      }, 0);
      if (sum > 0) return sum;
    }

    // Check items
    if (Array.isArray(wo.items) && wo.items.length > 0) {
      const sum = wo.items.reduce((acc: number, item: any) => {
        const itemTot = (typeof item.amount === 'number' && item.amount > 0)
          ? item.amount
          : ((Number(item.orderQty) || Number(item.quantity) || 0) * (Number(item.rate) || 0));
        return acc + (Number(itemTot) || 0);
      }, 0);
      if (sum > 0) return sum;
    }

    // Top-level quantity * rate
    const topQty = Number(wo.totalQuantity) || Number(wo.quantity) || 0;
    const topRate = Number(wo.rate) || 0;
    if (topQty > 0 && topRate > 0) {
      return topQty * topRate;
    }

    return 0;
  };

  // ----------------------------------------------------
  // SOURCE AUTO-FETCH LOGIC (MULTI-BILL & MULTI-WORK ORDER)
  // ----------------------------------------------------
  const handleToggleBill = (billId: string) => {
    const isCurrentlySelected = selectedBillIds.includes(billId);
    let newBillIds: string[] = [];

    if (isCurrentlySelected) {
      newBillIds = selectedBillIds.filter(id => id !== billId);
    } else {
      newBillIds = [...selectedBillIds, billId];
    }

    applySelectedBills(newBillIds);
  };

  const handleToggleAllBills = (select: boolean, billList: CustomerBill[]) => {
    if (select) {
      const allIds = billList.map(b => b.id);
      applySelectedBills(allIds);
    } else {
      applySelectedBills([]);
    }
  };

  const handleSelectBill = (billId: string) => {
    if (!billId) {
      applySelectedBills([]);
      return;
    }
    applySelectedBills([billId]);
  };

  const applySelectedBills = (billIds: string[]) => {
    setSelectedBillIds(billIds);
    setSelectedBillId(billIds[0] || '');
    setDuplicateWarning(null);

    const matchedBills = bills.filter(b => billIds.includes(b.id));
    if (matchedBills.length === 0) {
      setSelectedBills([]);
      setMasterPIValue(0);
      return;
    }

    const billsData = matchedBills.map(b => ({
      billId: b.id,
      billNo: b.billNo,
      billDate: b.billDate,
      amountUSD: getCustomerBillValue(b)
    }));
    setSelectedBills(billsData);

    // Primary bill info
    const primaryBill = matchedBills[0];
    setCustomerId(primaryBill.customerId || '');
    setCustomerName(primaryBill.customerName || '');
    setCustomerAddress(primaryBill.customerAddress || '');
    setBuyerName(primaryBill.buyerName || '');
    setCurrency(primaryBill.currency || 'USD');

    // Aggregate Master Total Value from all selected bills
    const totalBillsSum = matchedBills.reduce((sum, b) => sum + getCustomerBillValue(b), 0);
    setMasterPIValue(totalBillsSum);

    // Merge line items from all selected bills
    const allGeneratedItems: ProformaInvoiceItem[] = [];
    let runningSl = 1;

    matchedBills.forEach(b => {
      if (b.items && b.items.length > 0) {
        b.items.forEach((item) => {
          const qty = item.quantityPcs || (item.quantityDoz ? item.quantityDoz * 12 : (item.quantity || 1));
          const rate = item.pricePerPcs || (item.pricePerDoz ? item.pricePerDoz / 12 : (item.rate || (qty > 0 && item.amountUSD ? item.amountUSD / qty : 0)));
          const amount = item.amountUSD || item.amount || (qty * rate);

          allGeneratedItems.push({
            id: item.id || `item-bill-${b.id}-${runningSl}`,
            sl: runningSl++,
            itemName: item.description || item.itemName || 'Garments Accessories',
            description: `Ref Bill: ${b.billNo} | PO: ${item.poNo || 'N/A'} | Challan: ${item.challanNo || 'N/A'}`,
            quantity: qty,
            unit: item.unit || 'PCS',
            rate: rate,
            amount: amount,
            remarks: item.challanNo ? `Challan: ${item.challanNo}` : '',
            billId: b.id,
            poNo: item.poNo,
            woId: item.woId
          });
        });
      }
    });

    if (allGeneratedItems.length > 0) {
      setPiItems(allGeneratedItems);
    }
  };

  const handleToggleWorkOrder = (woId: string) => {
    const isCurrentlySelected = selectedWoIds.includes(woId);
    let newWoIds: string[] = [];

    if (isCurrentlySelected) {
      newWoIds = selectedWoIds.filter(id => id !== woId);
    } else {
      newWoIds = [...selectedWoIds, woId];
    }

    applySelectedWorkOrders(newWoIds);
  };

  const handleToggleAllWorkOrders = (select: boolean, woList: WorkOrder[]) => {
    if (select) {
      const allIds = woList.map(w => w.id);
      applySelectedWorkOrders(allIds);
    } else {
      applySelectedWorkOrders([]);
    }
  };

  const handleSelectWorkOrder = (woId: string) => {
    if (!woId) {
      applySelectedWorkOrders([]);
      return;
    }
    applySelectedWorkOrders([woId]);
  };

  const applySelectedWorkOrders = (woIds: string[]) => {
    setSelectedWoIds(woIds);
    setSelectedWoId(woIds[0] || '');
    setDuplicateWarning(null);

    const matchedWos = workOrders.filter(w => woIds.includes(w.id));
    if (matchedWos.length === 0) {
      setSelectedWorkOrders([]);
      setMasterPIValue(0);
      return;
    }

    const woData = matchedWos.map(w => {
      const val = getWorkOrderValue(w);
      return {
        woId: w.id,
        woNumber: w.woNumber || 'WO-N/A',
        date: w.date || (w as any).orderDate || '',
        amountUSD: val
      };
    });
    setSelectedWorkOrders(woData);

    // Primary Work Order info
    const primaryWo = matchedWos[0];
    setCustomerId(primaryWo.customerId || '');
    setCustomerName(primaryWo.customerName || '');
    setCustomerAddress(primaryWo.customerAddress || '');
    setBuyerId(primaryWo.buyerId || '');
    setBuyerName(primaryWo.buyerName || '');
    setCurrency(primaryWo.currencyCode || 'USD');

    // Aggregate Master Total Value from all selected work orders
    const totalWoSum = matchedWos.reduce((sum, w) => sum + getWorkOrderValue(w), 0);
    setMasterPIValue(totalWoSum);

    // Merge line items from all selected work orders
    const allGeneratedItems: ProformaInvoiceItem[] = [];
    let runningSl = 1;

    matchedWos.forEach(w => {
      let addedFromWo = false;

      // 1. Try breakdownRows
      if (Array.isArray(w.breakdownRows) && w.breakdownRows.length > 0) {
        w.breakdownRows.forEach((row: any) => {
          const qty = Number(row.quantity) || Number(row.orderQty) || 0;
          const rate = Number(row.rate) || Number(row.unitPriceUSD) || (qty > 0 && row.total ? Number(row.total) / qty : 0);
          const amount = (typeof row.total === 'number' && row.total > 0)
            ? row.total
            : (typeof row.totalPriceUSD === 'number' && row.totalPriceUSD > 0)
            ? row.totalPriceUSD
            : (typeof row.amount === 'number' && row.amount > 0)
            ? row.amount
            : (qty * rate);

          const itemName = row.finishedGoodsName || row.itemName || w.finishedGoodsName || `${w.finishedGoodsCategory || (w as any).productType || 'Garment Item'} (${row.size || 'STD'})`;
          const styleVal = row.style || w.style || (w as any).styleName || '';
          const colorVal = row.color || '';
          const sizeVal = row.size || '';
          const poVal = w.poNo || (w as any).poNumber || row.orderNo || '';

          const descParts = [
            `WO: ${w.woNumber}`,
            styleVal ? `Style: ${styleVal}` : '',
            colorVal ? `Color: ${colorVal}` : '',
            sizeVal ? `Size: ${sizeVal}` : '',
            poVal ? `PO: ${poVal}` : ''
          ].filter(Boolean);

          allGeneratedItems.push({
            id: row.id || `item-wo-${w.id}-${runningSl}`,
            sl: runningSl++,
            itemName: itemName,
            description: descParts.join(' | '),
            quantity: qty || 1,
            unit: row.unit || w.finishedGoodsUnit || 'PCS',
            rate: rate,
            amount: amount,
            remarks: row.remarks || (poVal ? `PO: ${poVal}` : ''),
            woId: w.id,
            poNo: poVal,
            style: styleVal
          });
          addedFromWo = true;
        });
      }

      // 2. Try items (if breakdownRows did not yield items)
      if (!addedFromWo && Array.isArray(w.items) && w.items.length > 0) {
        w.items.forEach((item: any) => {
          const qty = Number(item.orderQty) || Number(item.quantity) || 0;
          const rate = Number(item.rate) || (qty > 0 && item.amount ? Number(item.amount) / qty : 0);
          const amount = (typeof item.amount === 'number' && item.amount > 0) ? item.amount : (qty * rate);
          const poVal = w.poNo || (w as any).poNumber || '';
          const styleVal = w.style || (w as any).styleName || '';

          allGeneratedItems.push({
            id: item.id || `item-wo-${w.id}-${runningSl}`,
            sl: runningSl++,
            itemName: item.fgName || item.itemName || w.finishedGoodsName || 'Garment Item',
            description: `WO: ${w.woNumber} | Ref: ${item.fgNo || 'N/A'}${poVal ? ` | PO: ${poVal}` : ''}${styleVal ? ` | Style: ${styleVal}` : ''}`,
            quantity: qty || 1,
            unit: item.unit || w.finishedGoodsUnit || 'PCS',
            rate: rate,
            amount: amount,
            remarks: poVal ? `PO: ${poVal}` : '',
            woId: w.id,
            poNo: poVal,
            style: styleVal
          });
          addedFromWo = true;
        });
      }

      // 3. Fallback to top-level Work Order fields
      if (!addedFromWo) {
        const qty = Number(w.totalQuantity) || (w as any).quantity || 1;
        const totalVal = getWorkOrderValue(w);
        const rate = Number(w.rate) || (qty > 0 ? totalVal / qty : totalVal);
        const poVal = w.poNo || (w as any).poNumber || '';
        const styleVal = w.style || (w as any).styleName || '';

        allGeneratedItems.push({
          id: `item-wo-${w.id}-${runningSl}`,
          sl: runningSl++,
          itemName: w.finishedGoodsName || (w as any).productType || 'Garments Accessories',
          description: `Work Order: ${w.woNumber}${styleVal ? ` | Style: ${styleVal}` : ''}${poVal ? ` | PO: ${poVal}` : ''}`,
          quantity: qty,
          unit: w.finishedGoodsUnit || 'PCS',
          rate: rate,
          amount: totalVal || (qty * rate),
          remarks: poVal ? `PO: ${poVal}` : '',
          woId: w.id,
          poNo: poVal,
          style: styleVal
        });
      }
    });

    if (allGeneratedItems.length > 0) {
      setPiItems(allGeneratedItems);
    }
  };

  // ----------------------------------------------------
  // DYNAMIC LINE ITEMS MANAGEMENT
  // ----------------------------------------------------
  const handleAddItemRow = () => {
    const newSl = piItems.length + 1;
    const newItem: ProformaInvoiceItem = {
      id: `item-${Date.now()}-${newSl}`,
      sl: newSl,
      itemName: 'Garment Trims / Accessory',
      description: 'Specification as per approved sample',
      quantity: 1000,
      unit: 'PCS',
      rate: 0.10,
      amount: 100,
      remarks: ''
    };
    setPiItems([...piItems, newItem]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (piItems.length === 1) {
      showToast('PI must have at least one line item', 'error');
      return;
    }
    const updated = piItems.filter((_, idx) => idx !== index).map((item, idx) => ({
      ...item,
      sl: idx + 1
    }));
    setPiItems(updated);
  };

  const handleUpdateItem = (index: number, field: keyof ProformaInvoiceItem, val: any) => {
    const updated = [...piItems];
    const current = { ...updated[index], [field]: val };

    // Auto calculate amount when quantity or rate changes
    if (field === 'quantity' || field === 'rate') {
      const q = field === 'quantity' ? parseFloat(val) || 0 : current.quantity;
      const r = field === 'rate' ? parseFloat(val) || 0 : current.rate;
      current.amount = Math.round(q * r * 10000) / 10000;
    }

    updated[index] = current;
    setPiItems(updated);
  };

  // ----------------------------------------------------
  // LIVE VALUE & MATCHING CALCULATIONS
  // ----------------------------------------------------
  const piTotalCalculation = useMemo(() => {
    const totalQty = piItems.reduce((sum, it) => sum + (parseFloat(it.quantity as any) || 0), 0);
    const totalVal = piItems.reduce((sum, it) => sum + (parseFloat(it.amount as any) || 0), 0);
    const diff = Math.round((totalVal - masterPIValue) * 100) / 100;
    const tolerance = piSetup?.valueTolerance ?? 0.00;
    const isMatched = Math.abs(diff) <= tolerance;

    return {
      totalQuantity: totalQty,
      piTotalValue: totalVal,
      difference: diff,
      isValueMatched: isMatched
    };
  }, [piItems, masterPIValue, piSetup?.valueTolerance]);

  // ----------------------------------------------------
  // SAVE / SUBMIT / APPROVE / CONFIRM HANDLERS
  // ----------------------------------------------------
  const handleSavePI = async (targetStatus: PIStatus) => {
    // 1. Basic Validations
    if (!customerName?.trim()) {
      showToast('Please select a valid Bill or Work Order with Customer information', 'error');
      return;
    }

    if (piItems.length === 0) {
      showToast('PI must contain at least one line item', 'error');
      return;
    }

    // 2. Strict Validation for Submit for Approval / Approve / Confirm
    if (['pending_approval', 'approved', 'confirmed'].includes(targetStatus)) {
      if (!piTotalCalculation.isValueMatched) {
        const sourceLabel = piSource === 'bill_based' ? 'Bill Total Value' : 'Master Work Order Value';
        showToast(
          `PI Total Value ($${piTotalCalculation.piTotalValue.toFixed(2)}) does not match the ${sourceLabel} ($${masterPIValue.toFixed(2)}). Difference: $${piTotalCalculation.difference.toFixed(2)}. Value must match exactly!`,
          'error'
        );
        return;
      }
    }

    const currentNumber = piNumber || generateNewPINumber;
    const matchedBill = bills.find(b => b.id === selectedBillId);
    const matchedWo = workOrders.find(w => w.id === selectedWoId);

    const now = new Date().toISOString();
    const userEmail = userProfile.email || 'Commercial Officer';

    try {
      // Helper to sanitize payload for Firestore (eliminates any `undefined` values)
      const sanitizeForFirestore = (data: any): any => {
        if (data === undefined) return null;
        if (data === null) return null;
        if (Array.isArray(data)) {
          return data.map(item => sanitizeForFirestore(item));
        }
        if (typeof data === 'object' && !(data instanceof Date)) {
          const cleaned: Record<string, any> = {};
          for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
              cleaned[key] = sanitizeForFirestore(value);
            }
          }
          return cleaned;
        }
        return data;
      };

      const existingAudit = (isEditingExisting && editingPIId ? proformaInvoices.find(p => p.id === editingPIId)?.auditTrail : null) || {};
      const auditTrail: Record<string, any> = {
        ...existingAudit,
        createdBy: existingAudit.createdBy || userEmail,
        createdAt: existingAudit.createdAt || now
      };

      if (isEditingExisting) {
        auditTrail.editedBy = userEmail;
        auditTrail.editedAt = now;
      }
      if (targetStatus === 'pending_approval') {
        auditTrail.submittedBy = userEmail;
        auditTrail.submittedAt = now;
      }
      if (targetStatus === 'approved') {
        auditTrail.approvedBy = userEmail;
        auditTrail.approvedAt = now;
      }
      if (targetStatus === 'confirmed') {
        auditTrail.confirmedBy = userEmail;
        auditTrail.confirmedAt = now;
      }

      const rawPayload: Record<string, any> = {
        piNumber: currentNumber || '',
        piDate: piDate || new Date().toISOString().split('T')[0],
        validityDate: validityDate || '',
        piSource: piSource || 'bill_based',
        sourceId: piSource === 'bill_based' ? (selectedBillId || '') : (selectedWoId || ''),
        sourceNumber: piSource === 'bill_based' ? (matchedBill?.billNo || (selectedBills[0]?.billNo || '')) : (matchedWo?.woNumber || (selectedWorkOrders[0]?.woNumber || '')),
        billId: piSource === 'bill_based' ? (selectedBillId || '') : '',
        billNo: piSource === 'bill_based' ? (matchedBill?.billNo || (selectedBills[0]?.billNo || '')) : '',
        billDate: piSource === 'bill_based' ? (matchedBill?.billDate || (selectedBills[0]?.billDate || piDate)) : '',
        selectedBillIds: piSource === 'bill_based' ? (selectedBillIds || []) : [],
        selectedBills: piSource === 'bill_based' ? (selectedBills || []) : [],
        woId: piSource === 'booking_based' ? (selectedWoId || '') : (matchedBill?.items?.[0]?.woId || ''),
        woNumber: piSource === 'booking_based' ? (matchedWo?.woNumber || (selectedWorkOrders[0]?.woNumber || '')) : (matchedBill?.items?.[0]?.systemId || ''),
        bookingNo: matchedWo?.poNo || (matchedWo as any)?.poNumber || matchedBill?.items?.[0]?.poNo || '',
        selectedWoIds: piSource === 'booking_based' ? (selectedWoIds || []) : [],
        selectedWorkOrders: piSource === 'booking_based' ? (selectedWorkOrders || []) : [],
        
        customerId: customerId || '',
        customerName: customerName || '',
        customerAddress: customerAddress || '',
        buyerId: buyerId || '',
        buyerName: buyerName || '',

        // Commercial & Export Negotiation Fields
        lcNumber: lcNumber || '',
        lcDate: lcDate || '',
        exportLcNo: exportLcNo || '',
        exportLcDate: exportLcDate || '',
        commercialInvoiceNo: commercialInvoiceNo || currentNumber,
        commercialInvoiceDate: commercialInvoiceDate || '',
        deliveryChallanNo: deliveryChallanNo || (selectedBills[0]?.billNo || '282'),
        deliveryChallanDate: deliveryChallanDate || '',
        truckNo: truckNo || '',
        tenorDays: tenorDays || '',
        hsCode: hsCode || '',
        commodity: commodity || '',
        netWeightKg: Number(netWeightKg) || 0,
        grossWeightKg: Number(grossWeightKg) || 0,
        carrier: carrier || '',
        sailingDate: sailingDate || '',
        finalDestination: finalDestination || '',
        issuingBankName: issuingBankName || '',
        issuingBankBranch: issuingBankBranch || '',
        issuingBankCity: issuingBankCity || '',
        buyerIrc: buyerIrc || '',
        buyerErc: buyerErc || '',
        buyerBin: buyerBin || '',
        buyerTin: buyerTin || '',
        buyerBankBin: buyerBankBin || '',

        currency: currency || 'USD',
        exchangeRate: exchangeRate || 1.0,
        masterPIValue: masterPIValue || 0,
        piTotalValue: piTotalCalculation.piTotalValue || 0,
        differenceValue: piTotalCalculation.difference || 0,
        isValueMatched: !!piTotalCalculation.isValueMatched,

        bankId: selectedBankId || '',
        bankName: selectedBankName || '',
        bankAccountId: selectedAccountId || '',
        bankAccountName: bankBeneficiaryName || '',
        bankAccountNumber: bankAccountNumber || '',
        bankBranch: bankBranch || '',
        bankSwiftCode: bankSwiftCode || '',
        bankRoutingNumber: bankRoutingNumber || '',
        bankIban: bankIban || '',
        bankBeneficiaryName: bankBeneficiaryName || '',
        bankAddress: bankAddress || '',

        paymentTerms: paymentTerms || '',
        shipmentTerms: shipmentTerms || '',
        portOfLoading: portOfLoading || '',
        portOfDischarge: portOfDischarge || '',
        deliveryPeriod: deliveryPeriod || '',
        remarks: remarks || '',
        termsAndConditions: termsList,

        items: (piItems || []).map((item, idx) => ({
          id: item.id || `item-${idx + 1}`,
          sl: item.sl || idx + 1,
          itemName: item.itemName || '',
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unit: item.unit || 'PCS',
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || 0,
          remarks: item.remarks || '',
          billId: item.billId || '',
          woId: item.woId || '',
          poNo: item.poNo || '',
          style: item.style || ''
        })),
        totalQuantity: piTotalCalculation.totalQuantity || 0,
        status: targetStatus,
        auditTrail,

        businessId: businessId || '',
        ownerId: userProfile.uid || '',
        updatedAt: now
      };

      const payload = sanitizeForFirestore(rawPayload);

      if (isEditingExisting && editingPIId) {
        await updateDoc(doc(db, 'proforma_invoices', editingPIId), payload);
        showToast(`Proforma Invoice #${currentNumber} updated with status: ${targetStatus.toUpperCase()}`, 'success');
      } else {
        await addDoc(collection(db, 'proforma_invoices'), {
          ...payload,
          createdAt: now
        });
        showToast(`Proforma Invoice #${currentNumber} created successfully! Status: ${targetStatus.toUpperCase()}`, 'success');
      }

      // Reset form and go back to list
      resetPIForm();
      setActiveMainTab('pi-list');

    } catch (err: any) {
      console.error('Error saving PI:', err);
      showToast('Failed to save Proforma Invoice: ' + err.message, 'error');
    }
  };

  // Direct Update Negotiation Details from Print Modal
  const handleUpdatePiNegotiationDetails = async (updated: Partial<ProformaInvoice>) => {
    if (!printingPI) return;
    try {
      const now = new Date().toISOString();
      const sanitizedUpdates: Record<string, any> = { updatedAt: now };
      Object.entries(updated).forEach(([key, val]) => {
        if (val !== undefined) {
          sanitizedUpdates[key] = val;
        }
      });
      await updateDoc(doc(db, 'proforma_invoices', printingPI.id), sanitizedUpdates);
      setPrintingPI(prev => prev ? { ...prev, ...updated } : null);
      showToast('Export Negotiation details updated successfully!', 'success');
    } catch (err: any) {
      showToast('Failed to update export details: ' + err.message, 'error');
    }
  };

  const handleSelectDocPI = (pi: ProformaInvoice) => {
    setSelectedDocPiId(pi.id);
    setLcNumber(pi.lcNumber || '2167260400592');
    setLcDate(pi.lcDate || pi.piDate);
    setExportLcNo(pi.exportLcNo || 'FAL-AW26-01');
    setExportLcDate(pi.exportLcDate || pi.piDate);
    setCommercialInvoiceNo(pi.commercialInvoiceNo || pi.piNumber);
    setCommercialInvoiceDate(pi.commercialInvoiceDate || pi.piDate);
    setDeliveryChallanNo(pi.deliveryChallanNo || (pi.selectedBills?.[0]?.billNo || '282'));
    setDeliveryChallanDate(pi.deliveryChallanDate || pi.piDate);
    setTruckNo(pi.truckNo || 'Dhaka Metro MA-11-5740');
    setTenorDays(pi.tenorDays || '90 days');
    setHsCode(pi.hsCode || '6217.10.00');
    setCommodity(pi.commodity || 'GARMENTS ACCESSORIES (100% EXPORT ORIENTED)');
    setNetWeightKg(pi.netWeightKg || 12070.66);
    setGrossWeightKg(pi.grossWeightKg || 12312.07);
    setCarrier(pi.carrier || 'By Truck');
    setSailingDate(pi.sailingDate || pi.piDate);
    setFinalDestination(pi.finalDestination || 'Buyer Factory.');
    setIssuingBankName(pi.issuingBankName || 'THE PREMIER BANK PLC');
    setIssuingBankBranch(pi.issuingBankBranch || 'CENTRAL TRADE OPERATION');
    setIssuingBankCity(pi.issuingBankCity || 'DHAKA BD');
    setBuyerIrc(pi.buyerIrc || '260326120010019');
    setBuyerErc(pi.buyerErc || '260326210044019');
    setBuyerBin(pi.buyerBin || '000154448-0204');
    setBuyerTin(pi.buyerTin || '848559133820');
    setBuyerBankBin(pi.buyerBankBin || '000000548-0002');
    setTermsList(parsePITerms(pi.termsAndConditions));
  };

  const handleSaveDocumentPack = async (openPrintPreview: boolean = true) => {
    const targetPI = proformaInvoices.find(p => p.id === selectedDocPiId);
    if (!targetPI) {
      showToast('Please select a Proforma Invoice first!', 'error');
      return;
    }

    try {
      const now = new Date().toISOString();
      const updates = {
        lcNumber,
        lcDate,
        exportLcNo,
        exportLcDate,
        commercialInvoiceNo: commercialInvoiceNo || targetPI.piNumber,
        commercialInvoiceDate,
        deliveryChallanNo,
        deliveryChallanDate,
        truckNo,
        tenorDays,
        hsCode,
        commodity,
        netWeightKg: Number(netWeightKg) || 0,
        grossWeightKg: Number(grossWeightKg) || 0,
        carrier,
        sailingDate,
        finalDestination,
        issuingBankName,
        issuingBankBranch,
        issuingBankCity,
        buyerIrc,
        buyerErc,
        buyerBin,
        buyerTin,
        buyerBankBin,
        termsAndConditions: termsList,
        hasDocumentPack: true,
        updatedAt: now
      };

      await updateDoc(doc(db, 'proforma_invoices', targetPI.id), updates);

      const updatedPi: ProformaInvoice = {
        ...targetPI,
        ...updates
      };

      setProformaInvoices(prev => prev.map(p => p.id === targetPI.id ? updatedPi : p));
      showToast(`Export Document Pack saved for PI #${targetPI.piNumber}!`, 'success');

      if (openPrintPreview) {
        setPrintingPI(updatedPi);
      }
    } catch (err: any) {
      showToast('Failed to save Document Pack: ' + err.message, 'error');
    }
  };

  // Quick Approval Handler
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmText?: string;
    variant: ConfirmVariant;
    showReasonInput?: boolean;
    onConfirm: (reason?: string) => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'approve',
    onConfirm: () => {},
  });

  const triggerApprovePI = (pi: ProformaInvoice) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Proforma Invoice',
      message: `Are you sure you want to approve Proforma Invoice #${pi.piNumber}?`,
      subMessage: `Buyer: ${pi.buyerName || 'N/A'} • Total Value: ${pi.currency || 'USD'} ${Number(pi.piTotalValue || 0).toLocaleString()}`,
      variant: 'approve',
      confirmText: 'Yes, Approve PI',
      onConfirm: () => handleApprovePI(pi)
    });
  };

  const handleApprovePI = async (pi: ProformaInvoice) => {
    if (!pi.isValueMatched) {
      showToast('Cannot approve PI with mismatched value! Difference must be $0.00.', 'error');
      return;
    }

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'proforma_invoices', pi.id), {
        status: 'approved',
        'auditTrail.approvedBy': userProfile.email || 'Commercial Admin',
        'auditTrail.approvedAt': now,
        updatedAt: now
      });
      showToast(`Proforma Invoice #${pi.piNumber} Approved successfully!`, 'success');
    } catch (err: any) {
      showToast('Failed to approve PI: ' + err.message, 'error');
    }
  };

  // Quick Confirm Handler
  const handleConfirmPI = async (pi: ProformaInvoice) => {
    if (!pi.isValueMatched) {
      showToast('Cannot confirm PI with mismatched value!', 'error');
      return;
    }

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'proforma_invoices', pi.id), {
        status: 'confirmed',
        'auditTrail.confirmedBy': userProfile.email || 'Commercial Admin',
        'auditTrail.confirmedAt': now,
        updatedAt: now
      });
      showToast(`Proforma Invoice #${pi.piNumber} Confirmed as commercial export document!`, 'success');
    } catch (err: any) {
      showToast('Failed to confirm PI: ' + err.message, 'error');
    }
  };

  // Handle Reject PI
  const handleRejectPI = async () => {
    if (!rejectingPI) return;
    if (!rejectionReasonInput.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'proforma_invoices', rejectingPI.id), {
        status: 'rejected',
        'auditTrail.rejectedBy': userProfile.email || 'Commercial Admin',
        'auditTrail.rejectedAt': now,
        'auditTrail.rejectionReason': rejectionReasonInput.trim(),
        updatedAt: now
      });
      showToast(`Proforma Invoice #${rejectingPI.piNumber} has been rejected. Returned for amendment.`, 'info');
      setRejectingPI(null);
      setRejectionReasonInput('');
    } catch (err: any) {
      showToast('Failed to reject PI: ' + err.message, 'error');
    }
  };

  // Handle Edit PI
  const handleStartEditPI = (pi: ProformaInvoice) => {
    setIsEditingExisting(true);
    setEditingPIId(pi.id);
    setPiSource(pi.piSource);
    setSelectedBillId(pi.billId || '');
    setSelectedBillIds(pi.selectedBillIds || (pi.billId ? [pi.billId] : []));
    setSelectedBills(pi.selectedBills || (pi.billNo ? [{ billId: pi.billId || '', billNo: pi.billNo, billDate: pi.billDate || pi.piDate, amountUSD: pi.piTotalValue }] : []));
    setSelectedWoId(pi.woId || '');
    setSelectedWoIds(pi.selectedWoIds || (pi.woId ? [pi.woId] : []));
    setSelectedWorkOrders(pi.selectedWorkOrders || (pi.woNumber ? [{ woId: pi.woId || '', woNumber: pi.woNumber, date: pi.piDate, amountUSD: pi.piTotalValue }] : []));
    setPiNumber(pi.piNumber);
    setPiDate(pi.piDate);
    setValidityDate(pi.validityDate || '');
    setCustomerId(pi.customerId);
    setCustomerName(pi.customerName);
    setCustomerAddress(pi.customerAddress || '');
    setBuyerId(pi.buyerId || '');
    setBuyerName(pi.buyerName || '');

    // Negotiation fields
    setLcNumber(pi.lcNumber || '2167260400592');
    setLcDate(pi.lcDate || pi.piDate);
    setExportLcNo(pi.exportLcNo || 'FAL-AW26-01');
    setExportLcDate(pi.exportLcDate || pi.piDate);
    setCommercialInvoiceNo(pi.commercialInvoiceNo || pi.piNumber);
    setCommercialInvoiceDate(pi.commercialInvoiceDate || pi.piDate);
    setDeliveryChallanNo(pi.deliveryChallanNo || (pi.selectedBills?.[0]?.billNo || '282'));
    setDeliveryChallanDate(pi.deliveryChallanDate || pi.piDate);
    setTruckNo(pi.truckNo || 'Dhaka Metro MA-11-5740');
    setTenorDays(pi.tenorDays || '90 days');
    setHsCode(pi.hsCode || '6217.10.00');
    setCommodity(pi.commodity || 'GARMENTS ACCESSORIES');
    setNetWeightKg(pi.netWeightKg || 12070.66);
    setGrossWeightKg(pi.grossWeightKg || 12312.07);
    setCarrier(pi.carrier || 'By Truck');
    setSailingDate(pi.sailingDate || pi.piDate);
    setFinalDestination(pi.finalDestination || 'Buyer Factory.');
    setIssuingBankName(pi.issuingBankName || 'THE PREMIER BANK PLC');
    setIssuingBankBranch(pi.issuingBankBranch || 'CENTRAL TRADE OPERATION');
    setIssuingBankCity(pi.issuingBankCity || 'DHAKA BD');
    setBuyerIrc(pi.buyerIrc || '260326120010019');
    setBuyerErc(pi.buyerErc || '260326210044019');
    setBuyerBin(pi.buyerBin || '000154448-0204');
    setBuyerTin(pi.buyerTin || '848559133820');
    setBuyerBankBin(pi.buyerBankBin || '000000548-0002');
    setTermsList(parsePITerms(pi.termsAndConditions));

    setCurrency(pi.currency);
    setExchangeRate(pi.exchangeRate || 1.0);
    setMasterPIValue(pi.masterPIValue);
    setSelectedBankId(pi.bankId || '');
    setSelectedBankName(pi.bankName || '');
    setSelectedAccountId(pi.bankAccountId || '');
    setBankAccountNumber(pi.bankAccountNumber || '');
    setBankBranch(pi.bankBranch || '');
    setBankSwiftCode(pi.bankSwiftCode || '');
    setBankRoutingNumber(pi.bankRoutingNumber || '');
    setBankIban(pi.bankIban || '');
    setBankBeneficiaryName(pi.bankBeneficiaryName || 'ES TRIMS LIMITED');
    setBankAddress(pi.bankAddress || '');
    setPaymentTerms(pi.paymentTerms || '100% LC at Sight');
    setShipmentTerms(pi.shipmentTerms || 'FOB Dhaka');
    setPortOfLoading(pi.portOfLoading || 'Dhaka, Bangladesh');
    setPortOfDischarge(pi.portOfDischarge || '');
    setDeliveryPeriod(pi.deliveryPeriod || '7-15 Days');
    setRemarks(pi.remarks || '');
    setPiItems(pi.items || []);

    setActiveMainTab(pi.piSource === 'booking_based' ? 'create-pi-wo' : 'create-pi-bill');
  };

  const resetPIForm = () => {
    setIsEditingExisting(false);
    setEditingPIId(null);
    setSelectedBillId('');
    setSelectedBillIds([]);
    setSelectedBills([]);
    setSelectedWoId('');
    setSelectedWoIds([]);
    setSelectedWorkOrders([]);
    setPiNumber('');
    setDuplicateWarning(null);
    setTermsList(DEFAULT_PI_TERMS.map(t => ({ ...t })));
    setPiItems([
      {
        id: 'item-1',
        sl: 1,
        itemName: 'Woven Label / Printed Tag',
        description: 'High Quality Garment Trims with specified artwork',
        quantity: 10000,
        unit: 'PCS',
        rate: 0.05,
        amount: 500,
        remarks: ''
      }
    ]);
    setMasterPIValue(0);
  };

  // ----------------------------------------------------
  // FILTERED PI LIST
  // ----------------------------------------------------
  const filteredPIList = useMemo(() => {
    return proformaInvoices.filter(pi => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || (
        pi.piNumber.toLowerCase().includes(q) ||
        pi.customerName.toLowerCase().includes(q) ||
        (pi.buyerName && pi.buyerName.toLowerCase().includes(q)) ||
        (pi.billNo && pi.billNo.toLowerCase().includes(q)) ||
        (pi.woNumber && pi.woNumber.toLowerCase().includes(q)) ||
        (pi.bankName && pi.bankName.toLowerCase().includes(q))
      );

      // Status
      const matchStatus = statusFilter === 'all' || pi.status === statusFilter;

      // Source
      const matchSource = sourceFilter === 'all' || pi.piSource === sourceFilter;

      // Customer
      const matchCustomer = customerFilter === 'all' || pi.customerId === customerFilter || pi.customerName === customerFilter;

      // Date Range
      const matchDateFrom = !dateFrom || pi.piDate >= dateFrom;
      const matchDateTo = !dateTo || pi.piDate <= dateTo;

      return matchSearch && matchStatus && matchSource && matchCustomer && matchDateFrom && matchDateTo;
    });
  }, [proformaInvoices, searchQuery, statusFilter, sourceFilter, customerFilter, dateFrom, dateTo]);

  const pendingApprovalCount = useMemo(() => {
    return proformaInvoices.filter(p => p.status === 'pending_approval').length;
  }, [proformaInvoices]);

  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    proformaInvoices.forEach(p => {
      if (p.customerName) set.add(p.customerName);
    });
    return Array.from(set);
  }, [proformaInvoices]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 font-black">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-neutral-900 tracking-tight">Proforma Invoice (PI) Management</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                Commercial & LC Module
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Generate Bill Based & Booking Based Proforma Invoices with strict Master Value matching and bank instructions.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              resetPIForm();
              setPiSource('bill_based');
              setActiveMainTab('create-pi-bill');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs ${
              activeMainTab === 'create-pi-bill' ? 'bg-indigo-700 text-white ring-2 ring-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>PI From Bill</span>
          </button>

          <button
            onClick={() => {
              resetPIForm();
              setPiSource('booking_based');
              setActiveMainTab('create-pi-wo');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs ${
              activeMainTab === 'create-pi-wo' ? 'bg-indigo-700 text-white ring-2 ring-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>PI From Work Order</span>
          </button>

          <button
            onClick={() => setActiveMainTab('document')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all border ${
              activeMainTab === 'document' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-400' : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Document</span>
          </button>

          {(activeMainTab === 'create-pi-bill' || activeMainTab === 'create-pi-wo' || activeMainTab === 'create-pi' || activeMainTab === 'document') && (
            <button
              onClick={() => {
                resetPIForm();
                setActiveMainTab('pi-list');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Register</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 overflow-x-auto">
        <button
          onClick={() => {
            resetPIForm();
            setPiSource('bill_based');
            setActiveMainTab('create-pi-bill');
          }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeMainTab === 'create-pi-bill'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Proforma Invoice From Bill</span>
        </button>

        <button
          onClick={() => {
            resetPIForm();
            setPiSource('booking_based');
            setActiveMainTab('create-pi-wo');
          }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeMainTab === 'create-pi-wo'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Proforma Invoice From Work Order</span>
        </button>

        <button
          onClick={() => setActiveMainTab('document')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeMainTab === 'document'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Document</span>
        </button>

        <button
          onClick={() => setActiveMainTab('pi-list')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeMainTab === 'pi-list'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>PI Register ({proformaInvoices.length})</span>
        </button>

        {availableTabs.includes('pending-approvals') && (
          <button
            onClick={() => setActiveMainTab('pending-approvals')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all relative ${
              activeMainTab === 'pending-approvals'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Approvals</span>
            {pendingApprovalCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center ml-1">
                {pendingApprovalCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PI REGISTER & LIST */}
      {/* ========================================================================= */}
      {activeMainTab === 'pi-list' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search PI number, customer, buyer, bill no, work order no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Sources</option>
                  <option value="bill_based">Bill Based PI</option>
                  <option value="booking_based">Booking / WO Based PI</option>
                </select>

                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-medium focus:ring-1 focus:ring-indigo-500 max-w-[160px]"
                >
                  <option value="all">All Customers</option>
                  {uniqueCustomers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 text-xs">
              <span className="text-neutral-500 font-medium">PI Date Range:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                />
                <span className="text-neutral-400">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                />
              </div>

              {(searchQuery || statusFilter !== 'all' || sourceFilter !== 'all' || customerFilter !== 'all' || dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setSourceFilter('all');
                    setCustomerFilter('all');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold ml-auto"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* PI Register Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-700 uppercase font-bold text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-3.5">PI Number & Date</th>
                    <th className="p-3.5">Source & Reference</th>
                    <th className="p-3.5">Customer & Buyer</th>
                    <th className="p-3.5 text-right">Master Value</th>
                    <th className="p-3.5 text-right">PI Total</th>
                    <th className="p-3.5 text-center">Value Match</th>
                    <th className="p-3.5">Bank Account</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredPIList.map((pi) => {
                    const isMatched = pi.isValueMatched ?? (Math.abs((pi.piTotalValue || 0) - (pi.masterPIValue || 0)) <= (piSetup?.valueTolerance ?? 0.00));
                    return (
                      <tr key={pi.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-neutral-900">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-indigo-950">{pi.piNumber}</span>
                          </div>
                          <div className="text-[11px] font-normal text-neutral-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-neutral-400" />
                            <span>{pi.piDate}</span>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="inline-block px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider mb-1 bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {pi.piSource === 'bill_based' ? 'Bill Based' : 'Booking Based'}
                          </div>
                          <div className="font-mono text-[11px] font-bold text-neutral-800">
                            {pi.sourceNumber || pi.billNo || pi.woNumber || '—'}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-neutral-900">{pi.customerName}</div>
                          {pi.buyerName && (
                            <div className="text-[11px] text-neutral-500 font-medium">
                              Buyer: <span className="text-neutral-800 font-semibold">{pi.buyerName}</span>
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-neutral-700">
                          ${pi.masterPIValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </td>

                        <td className="p-3.5 text-right font-mono font-black text-indigo-950">
                          ${pi.piTotalValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </td>

                        <td className="p-3.5 text-center">
                          {isMatched ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200" title={`Diff: $${(pi.differenceValue || 0).toFixed(2)}`}>
                              <XCircle className="w-3 h-3" />
                              Mismatch
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="font-semibold text-neutral-900 truncate max-w-[140px]">{pi.bankName || 'Eastern Bank PLC'}</div>
                          <div className="font-mono text-[10px] text-neutral-500">{pi.bankAccountNumber || 'USD Account'}</div>
                        </td>

                        <td className="p-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            pi.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            pi.status === 'approved' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            pi.status === 'pending_approval' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            pi.status === 'rejected' ? 'bg-red-100 text-red-800 border border-red-300' :
                            'bg-neutral-100 text-neutral-700 border border-neutral-200'
                          }`}>
                            {pi.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setPrintingPI(pi)}
                              title="Print / PDF Proforma Invoice"
                              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {pi.status !== 'confirmed' && (
                              <button
                                onClick={() => handleStartEditPI(pi)}
                                title="Edit PI"
                                className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-neutral-100 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}

                            {isSuperAdmin && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete Proforma Invoice ${pi.piNumber}?`)) return;
                                  try {
                                    await deleteDoc(doc(db, 'proforma_invoices', pi.id));
                                    showToast(`PI #${pi.piNumber} deleted`, 'success');
                                  } catch (err: any) {
                                    showToast('Failed to delete: ' + err.message, 'error');
                                  }
                                }}
                                title="Delete PI"
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPIList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-neutral-400">
                        <Receipt className="w-10 h-10 mx-auto mb-2 text-neutral-300" />
                        <p className="text-sm font-semibold text-neutral-700">No Proforma Invoices found</p>
                        <p className="text-xs text-neutral-400 mt-0.5">Click "Create New PI" to generate your first export invoice.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CREATE / EDIT PROFORMA INVOICE FORM */}
      {/* ========================================================================= */}
      {(activeMainTab === 'create-pi-bill' || activeMainTab === 'create-pi-wo' || activeMainTab === 'create-pi') && (
        <div className="space-y-6">
          {/* Source Header Info (Step 1 Selection Hidden as requested) */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  {piSource === 'bill_based' ? <Receipt className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {piSource === 'bill_based' ? 'Proforma Invoice from Customer Bill(s)' : 'Proforma Invoice from Work Order / Booking'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    {piSource === 'bill_based' 
                      ? 'Select finalized commercial customer bills to compile your Proforma Invoice' 
                      : 'Select confirmed work order / booking to compile advance export PI'}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                piSource === 'bill_based' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {piSource === 'bill_based' ? 'Bill Based' : 'Work Order Based'}
              </span>
            </div>

            {/* Multi-Source Document Selection */}
            <div className="pt-2">
              {piSource === 'bill_based' && (() => {
                const filteredBills = bills.filter(b => {
                  if (!billSearchQuery) return true;
                  const q = billSearchQuery.toLowerCase();
                  return (
                    b.billNo?.toLowerCase().includes(q) ||
                    b.customerName?.toLowerCase().includes(q) ||
                    (b.buyerName && b.buyerName.toLowerCase().includes(q))
                  );
                });
                const allFilteredSelected = filteredBills.length > 0 && filteredBills.every(b => selectedBillIds.includes(b.id));

                return (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <label className="text-xs font-bold text-neutral-800 block">
                          Select One or Multiple Customer Bills *
                        </label>
                        <span className="text-[11px] text-neutral-500">
                          Combine multiple commercial bills into a single consolidated Proforma Invoice (PI)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAllBills(!allFilteredSelected, filteredBills)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 transition-colors"
                        >
                          {allFilteredSelected ? 'Deselect All' : 'Select All Visible'}
                        </button>
                        {selectedBillIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => applySelectedBills([])}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          >
                            Clear ({selectedBillIds.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          placeholder="Search bills by Bill #, Customer name, Buyer..."
                          value={billSearchQuery}
                          onChange={(e) => setBillSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                      <span className="text-xs font-bold text-neutral-600 shrink-0 bg-neutral-100 px-3 py-2 rounded-xl">
                        Selected: <span className="text-indigo-600">{selectedBillIds.length}</span> / {bills.length} Bills
                      </span>
                    </div>

                    {/* Selected Bills Chips Summary */}
                    {selectedBills.length > 0 && (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                            Aggregated Commercial Bills ({selectedBills.length}):
                          </span>
                          <span className="font-mono font-black text-indigo-900">
                            Total Combined: ${selectedBills.reduce((s, b) => s + b.amountUSD, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedBills.map(b => (
                            <span
                              key={b.billId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-900 shadow-2xs"
                            >
                              <span>{b.billNo}</span>
                              <span className="text-indigo-600 font-mono font-normal">(${b.amountUSD.toFixed(2)})</span>
                              <button
                                type="button"
                                onClick={() => handleToggleBill(b.billId)}
                                className="text-neutral-400 hover:text-red-600 ml-0.5"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bills Selection List Table */}
                    <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 sticky top-0 z-10 border-b border-neutral-200 text-neutral-700 font-bold text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={(e) => handleToggleAllBills(e.target.checked, filteredBills)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                            </th>
                            <th className="p-2.5">Bill Number</th>
                            <th className="p-2.5">Customer & Buyer</th>
                            <th className="p-2.5">Bill Date</th>
                            <th className="p-2.5 text-center">Items</th>
                            <th className="p-2.5 text-right">Bill Total (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {filteredBills.map((b) => {
                            const isChecked = selectedBillIds.includes(b.id);
                            const val = b.grandTotalUSD || b.totalAmountUSD || 0;
                            return (
                              <tr
                                key={b.id}
                                onClick={() => handleToggleBill(b.id)}
                                className={`cursor-pointer transition-colors ${
                                  isChecked ? 'bg-indigo-50/60 font-medium' : 'hover:bg-neutral-50'
                                }`}
                              >
                                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleBill(b.id)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-2.5 font-bold font-mono text-indigo-950">
                                  {b.billNo}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-neutral-900">{b.customerName}</div>
                                  {b.buyerName && <div className="text-[10px] text-neutral-500">Buyer: {b.buyerName}</div>}
                                </td>
                                <td className="p-2.5 text-neutral-600 font-mono text-[11px]">
                                  {b.billDate}
                                </td>
                                <td className="p-2.5 text-center font-mono text-neutral-600">
                                  {b.items?.length || 1}
                                </td>
                                <td className="p-2.5 text-right font-mono font-black text-neutral-900">
                                  ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredBills.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-neutral-400">
                                No customer bills found matching "{billSearchQuery}".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {piSource === 'booking_based' && (() => {
                const filteredWos = workOrders.filter(w => {
                  if (!woSearchQuery) return true;
                  const q = woSearchQuery.toLowerCase();
                  return (
                    w.woNumber?.toLowerCase().includes(q) ||
                    w.customerName?.toLowerCase().includes(q) ||
                    (w.buyerName && w.buyerName.toLowerCase().includes(q)) ||
                    (w.poNo && w.poNo.toLowerCase().includes(q)) ||
                    ((w as any).poNumber && (w as any).poNumber.toLowerCase().includes(q)) ||
                    (w.style && w.style.toLowerCase().includes(q)) ||
                    ((w as any).styleName && (w as any).styleName.toLowerCase().includes(q)) ||
                    (w.finishedGoodsName && w.finishedGoodsName.toLowerCase().includes(q))
                  );
                });
                const allFilteredSelected = filteredWos.length > 0 && filteredWos.every(w => selectedWoIds.includes(w.id));

                return (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <label className="text-xs font-bold text-neutral-800 block">
                          Select One or Multiple Work Orders / Bookings *
                        </label>
                        <span className="text-[11px] text-neutral-500">
                          Combine multiple factory work orders or bookings into a single advance Proforma Invoice (PI)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAllWorkOrders(!allFilteredSelected, filteredWos)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 transition-colors"
                        >
                          {allFilteredSelected ? 'Deselect All' : 'Select All Visible'}
                        </button>
                        {selectedWoIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => applySelectedWorkOrders([])}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          >
                            Clear ({selectedWoIds.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          placeholder="Search work orders by WO #, PO, Customer, Buyer, Style..."
                          value={woSearchQuery}
                          onChange={(e) => setWoSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                      <span className="text-xs font-bold text-neutral-600 shrink-0 bg-neutral-100 px-3 py-2 rounded-xl">
                        Selected: <span className="text-indigo-600">{selectedWoIds.length}</span> / {workOrders.length} Work Orders
                      </span>
                    </div>

                    {/* Selected WOs Chips Summary */}
                    {selectedWorkOrders.length > 0 && (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            Aggregated Work Orders ({selectedWorkOrders.length}):
                          </span>
                          <span className="font-mono font-black text-indigo-900">
                            Total Combined: ${selectedWorkOrders.reduce((s, w) => s + w.amountUSD, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedWorkOrders.map(w => (
                            <span
                              key={w.woId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-900 shadow-2xs"
                            >
                              <span>{w.woNumber}</span>
                              <span className="text-indigo-600 font-mono font-normal">(${w.amountUSD.toFixed(2)})</span>
                              <button
                                type="button"
                                onClick={() => handleToggleWorkOrder(w.woId)}
                                className="text-neutral-400 hover:text-red-600 ml-0.5"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Work Orders Selection List Table */}
                    <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 sticky top-0 z-10 border-b border-neutral-200 text-neutral-700 font-bold text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={(e) => handleToggleAllWorkOrders(e.target.checked, filteredWos)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                            </th>
                            <th className="p-2.5">Work Order #</th>
                            <th className="p-2.5">Customer & Buyer</th>
                            <th className="p-2.5">PO / Style</th>
                            <th className="p-2.5">Order Date</th>
                            <th className="p-2.5 text-right">WO Total (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {filteredWos.map((wo) => {
                            const isChecked = selectedWoIds.includes(wo.id);
                            const val = getWorkOrderValue(wo);
                            return (
                              <tr
                                key={wo.id}
                                onClick={() => handleToggleWorkOrder(wo.id)}
                                className={`cursor-pointer transition-colors ${
                                  isChecked ? 'bg-indigo-50/60 font-medium' : 'hover:bg-neutral-50'
                                }`}
                              >
                                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleWorkOrder(wo.id)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-2.5 font-bold font-mono text-indigo-950">
                                  {wo.woNumber}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-neutral-900">{wo.customerName}</div>
                                  {wo.buyerName && <div className="text-[10px] text-neutral-500">Buyer: {wo.buyerName}</div>}
                                </td>
                                <td className="p-2.5 text-neutral-600">
                                  <div className="font-mono text-[11px]">{wo.poNo || (wo as any).poNumber || 'N/A'}</div>
                                  {(wo.style || (wo as any).styleName) && <div className="text-[10px] text-neutral-400 truncate max-w-[120px]">{wo.style || (wo as any).styleName}</div>}
                                </td>
                                <td className="p-2.5 text-neutral-600 font-mono text-[11px]">
                                  {wo.date || (wo as any).orderDate || '—'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-black text-neutral-900">
                                  ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredWos.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-neutral-400">
                                No work orders found matching "{woSearchQuery}".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Duplicate PI Warning */}
              {duplicateWarning && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Duplicate Warning: </span>
                    {duplicateWarning}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Commercial Validation Summary (Clean & Compact) */}
          <div className="bg-white px-4 py-3 rounded-xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                piTotalCalculation.isValueMatched ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {piTotalCalculation.isValueMatched ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div>
                <span className="font-bold text-neutral-900 block text-xs">Commercial Value Validation</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500 mt-0.5">
                  <span>{piSource === 'bill_based' ? 'Bill Total' : 'WO Value'}: <strong className="font-mono text-neutral-900">${masterPIValue.toFixed(2)}</strong></span>
                  <span>•</span>
                  <span>PI Items Sum: <strong className="font-mono text-indigo-600">${piTotalCalculation.piTotalValue.toFixed(2)}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {piTotalCalculation.isValueMatched ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Value Matched (100%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-300 rounded-full font-bold text-xs">
                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                  Diff: {piTotalCalculation.difference > 0 ? `+$${piTotalCalculation.difference.toFixed(2)}` : `-$${Math.abs(piTotalCalculation.difference).toFixed(2)}`}
                </span>
              )}
            </div>
          </div>

          {/* Section A: PI Header */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">
              Section A: PI Header & Commercial Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">PI Number *</label>
                <input
                  type="text"
                  value={piNumber || generateNewPINumber}
                  onChange={(e) => setPiNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl font-mono font-bold text-indigo-950 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">PI Date *</label>
                <input
                  type="date"
                  value={piDate}
                  onChange={(e) => setPiDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Validity Date</label>
                <input
                  type="date"
                  value={validityDate}
                  onChange={(e) => setValidityDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-bold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="BDT">BDT (৳)</option>
                </select>
              </div>
            </div>

            {/* Customer & Buyer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-neutral-100">
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Applicant / Customer Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer / Factory Name"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-bold focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Buyer / Brand Name</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Buyer / Retailer Brand"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Customer Address</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Factory Address"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Bank & Financial Selection */}
            <div className="pt-2 border-t border-neutral-100 space-y-3">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Beneficiary Bank & Account Instructions
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Select Bank *</label>
                  <select
                    value={selectedBankName}
                    onChange={(e) => {
                      const bName = e.target.value;
                      setSelectedBankName(bName);
                      // Filter accounts for this bank
                      const bankAccs = bankAccounts.filter(a => a.bankName.toLowerCase() === bName.toLowerCase());
                      if (bankAccs.length > 0) {
                        const acc = bankAccs[0];
                        setSelectedAccountId(acc.id);
                        setBankAccountNumber(acc.accountNumber);
                        setBankBranch(acc.branch);
                        setBankSwiftCode(acc.swiftCode || '');
                        setBankRoutingNumber(acc.routingNumber || '');
                        setBankIban(acc.iban || '');
                        setBankBeneficiaryName(acc.beneficiaryName);
                        setBankAddress(acc.accountAddress || '');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    {banks.map(b => (
                      <option key={b.id} value={b.bankName}>{b.bankName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Bank Account Number *</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => {
                      const accId = e.target.value;
                      setSelectedAccountId(accId);
                      const acc = bankAccounts.find(a => a.id === accId);
                      if (acc) {
                        setBankAccountNumber(acc.accountNumber);
                        setBankBranch(acc.branch);
                        setBankSwiftCode(acc.swiftCode || '');
                        setBankRoutingNumber(acc.routingNumber || '');
                        setBankIban(acc.iban || '');
                        setBankBeneficiaryName(acc.beneficiaryName);
                        setBankAddress(acc.accountAddress || '');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono font-bold text-indigo-950 focus:ring-1 focus:ring-indigo-500"
                  >
                    {bankAccounts
                      .filter(a => !selectedBankName || a.bankName.toLowerCase() === selectedBankName.toLowerCase())
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.accountNumber} ({a.currency} - {a.accountType})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">SWIFT Code & Branch</label>
                  <input
                    type="text"
                    readOnly
                    value={`${bankSwiftCode || 'EBLDBDDHA'} | ${bankBranch || 'Principal Branch'}`}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 border border-neutral-200 rounded-xl font-mono text-neutral-700"
                  />
                </div>
              </div>
            </div>

            {/* Commercial Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-neutral-100">
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 100% LC at Sight, TT In Advance"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Shipment Terms / Incoterms</label>
                <input
                  type="text"
                  value={shipmentTerms}
                  onChange={(e) => setShipmentTerms(e.target.value)}
                  placeholder="e.g. FOB Chittagong, EXW Factory"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Delivery Period</label>
                <input
                  type="text"
                  value={deliveryPeriod}
                  onChange={(e) => setDeliveryPeriod(e.target.value)}
                  placeholder="e.g. 7-15 Days from LC Receipt"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section B: Dynamic PI Line Items Table */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Section B: Dynamic PI Line Items & Price Structure
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Input and adjust line quantities, units, and rates. The live sum must match the Master Value.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItemRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-700 uppercase font-bold text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-2.5 w-10 text-center">SL</th>
                    <th className="p-2.5 min-w-[180px]">Item Name *</th>
                    <th className="p-2.5 min-w-[200px]">Description</th>
                    <th className="p-2.5 w-28 text-center">Quantity *</th>
                    <th className="p-2.5 w-24">Unit</th>
                    <th className="p-2.5 w-28 text-right">Unit Rate ({currency}) *</th>
                    <th className="p-2.5 w-32 text-right">Amount ({currency})</th>
                    <th className="p-2.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {piItems.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-neutral-50/50">
                      <td className="p-2.5 text-center font-mono font-bold text-neutral-500">
                        {idx + 1}
                      </td>

                      <td className="p-2.5">
                        <input
                          type="text"
                          required
                          value={item.itemName}
                          onChange={(e) => handleUpdateItem(idx, 'itemName', e.target.value)}
                          placeholder="e.g. Woven Label"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                          placeholder="Specification / Style"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          required
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg text-center font-mono font-bold focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="p-2.5">
                        <select
                          value={item.unit || 'PCS'}
                          onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="PCS">PCS</option>
                          <option value="DOZ">DOZEN</option>
                          <option value="GROSS">GROSS</option>
                          <option value="YARDS">YARDS</option>
                          <option value="ROLLS">ROLLS</option>
                          <option value="MTR">MTR</option>
                          <option value="KG">KG</option>
                          <option value="SETS">SETS</option>
                        </select>
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          required
                          value={item.rate}
                          onChange={(e) => handleUpdateItem(idx, 'rate', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg text-right font-mono font-bold focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="p-2.5 text-right font-mono font-black text-indigo-950">
                        ${item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-100 font-bold border-t-2 border-neutral-300 text-xs">
                    <td colSpan={3} className="p-3 text-right uppercase text-neutral-700">
                      Total Items Sum ({currency}):
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-neutral-900">
                      {piTotalCalculation.totalQuantity.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-3 text-right text-neutral-500 font-normal">
                      Net PI Total:
                    </td>
                    <td className="p-3 text-right font-mono text-sm font-black text-indigo-950">
                      ${piTotalCalculation.piTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Words representation */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs flex items-center gap-2">
              <span className="font-bold text-neutral-600 uppercase">Amount in Words:</span>
              <span className="font-semibold text-neutral-900 italic">
                {numberToWordsUSD(piTotalCalculation.piTotalValue)}
              </span>
            </div>
          </div>

          {/* Section C: Dynamic Terms & Conditions (শর্তাবলী ও ক্লজ) */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    Section C: Terms & Conditions (শর্তাবলী ও বাণিজ্যিক ক্লজ)
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                    {termsList.length} Clauses
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Customize the terms printed at the bottom of the Proforma Invoice. Edit text, add custom clauses, or use quick presets.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetTerms}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-all"
                  title="Reset terms to default standard clauses"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Clause</span>
                </button>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Clause Presets (ক্লিক করে যোগ করুন):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PI_CLAUSES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddPreset(preset)}
                    className="px-2.5 py-1 text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-neutral-700 font-medium rounded-lg border border-neutral-200 transition-all cursor-pointer shadow-2xs"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Terms List */}
            <div className="space-y-2.5">
              {termsList.map((term, idx) => (
                <div 
                  key={term.id || idx} 
                  className="p-3 bg-neutral-50/70 hover:bg-neutral-50 rounded-xl border border-neutral-200 transition-all flex flex-col md:flex-row items-start md:items-center gap-3"
                >
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveTerm(idx, -1)}
                      className="p-1 text-neutral-400 hover:text-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === termsList.length - 1}
                      onClick={() => handleMoveTerm(idx, 1)}
                      className="p-1 text-neutral-400 hover:text-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded-full">
                      {idx + 1}
                    </span>
                  </div>

                  <div className="w-full md:w-56 shrink-0">
                    <input
                      type="text"
                      value={term.label || ''}
                      onChange={(e) => handleUpdateTerm(idx, 'label', e.target.value)}
                      placeholder="Clause Label (e.g. 01. Payment :)"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-bold text-neutral-800 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <textarea
                      rows={2}
                      value={term.text}
                      onChange={(e) => handleUpdateTerm(idx, 'text', e.target.value)}
                      placeholder="Enter clause text details..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500 text-neutral-800 font-normal leading-relaxed"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTerm(idx)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all shrink-0"
                    title="Remove this clause"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action & Workflow Bar */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 z-20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-medium">Validation Status:</span>
              {piTotalCalculation.isValueMatched ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Ready to Confirm & Approve
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-300 rounded-full text-xs font-bold">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Difference: ${Math.abs(piTotalCalculation.difference).toFixed(2)} (Fix to Match)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Draft Save - Always Allowed */}
              <button
                type="button"
                onClick={() => handleSavePI('draft')}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-all"
              >
                Save Draft
              </button>

              {/* Submit for Approval */}
              <button
                type="button"
                disabled={!piTotalCalculation.isValueMatched}
                onClick={() => handleSavePI('pending_approval')}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all ${
                  piTotalCalculation.isValueMatched
                    ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                }`}
                title={!piTotalCalculation.isValueMatched ? 'Cannot submit until PI value strictly matches Master Value' : ''}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>

              {/* Admin Direct Approve */}
              {isSuperAdmin && (
                <button
                  type="button"
                  disabled={!piTotalCalculation.isValueMatched}
                  onClick={() => handleSavePI('approved')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all ${
                    piTotalCalculation.isValueMatched
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve PI</span>
                </button>
              )}

              {/* Confirm PI - Final Commercial Stage */}
              <button
                type="button"
                disabled={!piTotalCalculation.isValueMatched}
                onClick={() => handleSavePI('confirmed')}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-black rounded-xl shadow-md transition-all ${
                  piTotalCalculation.isValueMatched
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 cursor-pointer'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                }`}
                title={!piTotalCalculation.isValueMatched ? 'PI Total Value does not match Master Value' : ''}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm Final PI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DOCUMENT (Export Negotiation & 8-Page Document Pack)                 */}
      {/* ========================================================================= */}
      {activeMainTab === 'document' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-neutral-900">Commercial Document Pack</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    8-Page Negotiation Set
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Select a Proforma Invoice, fill in Section D export details, and click "Add & Create Document Set" to compile the complete negotiation pack.
                </p>
              </div>
            </div>

            {selectedDocPiId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveDocumentPack(false)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 transition-all"
                >
                  Save Draft Details
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDocumentPack(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Add & Create Document Set</span>
                </button>
              </div>
            )}
          </div>

          {/* PI Selection Card */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                  Select Proforma Invoice (PI) *
                </label>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Choose the Proforma Invoice to attach commercial export and banking documents to
                </p>
              </div>

              {proformaInvoices.length > 0 && (
                <div className="text-xs text-neutral-400">
                  Total {proformaInvoices.length} PI(s) Available
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-neutral-700 block mb-1.5">
                  Choose Target PI from Register
                </label>
                <select
                  value={selectedDocPiId}
                  onChange={(e) => {
                    const pi = proformaInvoices.find(p => p.id === e.target.value);
                    if (pi) handleSelectDocPI(pi);
                    else setSelectedDocPiId('');
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-neutral-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Click here to select a Proforma Invoice --</option>
                  {proformaInvoices.map(pi => (
                    <option key={pi.id} value={pi.id}>
                      PI #{pi.piNumber} • {pi.customerName} ({pi.buyerName || 'No Buyer'}) • ${Number(pi.piTotalValue || 0).toLocaleString()} • [{pi.status.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1.5">
                  Current Selected Status
                </label>
                <div className="h-10 px-3.5 flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                  {selectedDocPi ? (
                    <>
                      <span className="font-bold text-neutral-800 font-mono">PI #{selectedDocPi.piNumber}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                        {selectedDocPi.status.replace('_', ' ')}
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400 italic">No PI Selected</span>
                  )}
                </div>
              </div>
            </div>

            {/* Selected PI Summary Ribbon */}
            {selectedDocPi && (
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Customer</span>
                    <span className="font-bold text-neutral-900">{selectedDocPi.customerName}</span>
                  </div>
                  {selectedDocPi.buyerName && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">Buyer</span>
                      <span className="font-bold text-neutral-900">{selectedDocPi.buyerName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">PI Date</span>
                    <span className="font-semibold text-neutral-700">{selectedDocPi.piDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Total Value</span>
                    <span className="font-mono font-bold text-indigo-700">
                      ${Number(selectedDocPi.piTotalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPrintingPI(selectedDocPi)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 shadow-2xs transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview 8-Page Set</span>
                </button>
              </div>
            )}
          </div>

          {!selectedDocPiId ? (
            /* Empty State Prompt */
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-neutral-800">Please Select a Proforma Invoice Above</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                Select a PI from the dropdown above to load its commercial parameters and generate the complete 8-page document set.
              </p>
            </div>
          ) : (
            /* Section D Export Negotiation Parameters Form */
            <div className="space-y-6">
              {/* Section D Fields */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Section D: Export Negotiation & 8-Page Document Pack Details
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Fill out or modify these parameters. Click "Add & Create Document Set" to save and generate the negotiation documents.
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Negotiation Ready
                  </span>
                </div>

                {/* Sub-section 1: Master & Export LC */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    1. Master & Export L/C Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Master / Export L/C No *</label>
                      <input
                        type="text"
                        value={lcNumber}
                        onChange={(e) => setLcNumber(e.target.value)}
                        placeholder="e.g. 2167260400592"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">L/C Date</label>
                      <input
                        type="date"
                        value={lcDate}
                        onChange={(e) => setLcDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Export L/C Ref No</label>
                      <input
                        type="text"
                        value={exportLcNo}
                        onChange={(e) => setExportLcNo(e.target.value)}
                        placeholder="e.g. FAL-AW26-01"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Export L/C Date</label>
                      <input
                        type="date"
                        value={exportLcDate}
                        onChange={(e) => setExportLcDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Tenor Period</label>
                      <input
                        type="text"
                        value={tenorDays}
                        onChange={(e) => setTenorDays(e.target.value)}
                        placeholder="e.g. 90 days, Sight"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-section 2: Invoice & Delivery Challan */}
                <div className="pt-3 border-t border-neutral-100">
                  <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                    2. Commercial Invoice & Delivery Challan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Commercial Invoice Number</label>
                      <input
                        type="text"
                        value={commercialInvoiceNo}
                        onChange={(e) => setCommercialInvoiceNo(e.target.value)}
                        placeholder="Defaults to PI Number"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Commercial Invoice Date</label>
                      <input
                        type="date"
                        value={commercialInvoiceDate}
                        onChange={(e) => setCommercialInvoiceDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Delivery Challan Number</label>
                      <input
                        type="text"
                        value={deliveryChallanNo}
                        onChange={(e) => setDeliveryChallanNo(e.target.value)}
                        placeholder="e.g. 282 or Auto from Bill"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Delivery Challan Date</label>
                      <input
                        type="date"
                        value={deliveryChallanDate}
                        onChange={(e) => setDeliveryChallanDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-section 3: Transport & Packing Specs */}
                <div className="pt-3 border-t border-neutral-100">
                  <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    3. Transport, Carrier & Shipping Weights
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Truck / Vehicle No</label>
                      <input
                        type="text"
                        value={truckNo}
                        onChange={(e) => setTruckNo(e.target.value)}
                        placeholder="e.g. Dhaka Metro MA-11-5740"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Carrier</label>
                      <input
                        type="text"
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        placeholder="e.g. By Truck"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Sailing / Dispatch Date</label>
                      <input
                        type="date"
                        value={sailingDate}
                        onChange={(e) => setSailingDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Final Destination</label>
                      <input
                        type="text"
                        value={finalDestination}
                        onChange={(e) => setFinalDestination(e.target.value)}
                        placeholder="e.g. Buyer Factory."
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Net Weight (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={netWeightKg}
                        onChange={(e) => setNetWeightKg(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 12070.66"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Gross Weight (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={grossWeightKg}
                        onChange={(e) => setGrossWeightKg(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 12312.07"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-section 4: Issuing Bank Details */}
                <div className="pt-3 border-t border-neutral-100">
                  <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    4. Issuing Bank Negotiation Coordinates
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Issuing Bank Name</label>
                      <input
                        type="text"
                        value={issuingBankName}
                        onChange={(e) => setIssuingBankName(e.target.value)}
                        placeholder="e.g. THE PREMIER BANK PLC"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Issuing Bank Branch</label>
                      <input
                        type="text"
                        value={issuingBankBranch}
                        onChange={(e) => setIssuingBankBranch(e.target.value)}
                        placeholder="e.g. CENTRAL TRADE OPERATION"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Issuing Bank City / Country</label>
                      <input
                        type="text"
                        value={issuingBankCity}
                        onChange={(e) => setIssuingBankCity(e.target.value)}
                        placeholder="e.g. DHAKA BD"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-700 block mb-1">Bank BIN No</label>
                      <input
                        type="text"
                        value={buyerBankBin}
                        onChange={(e) => setBuyerBankBin(e.target.value)}
                        placeholder="e.g. 000000548-0002"
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-section 5: Buyer Statutory & Customs */}
                <div className="pt-3 border-t border-neutral-100">
                  <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" />
                    5. Buyer Statutory Numbers & HS Classification
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3.5 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 block mb-1">HS Code</label>
                      <input
                        type="text"
                        value={hsCode}
                        onChange={(e) => setHsCode(e.target.value)}
                        placeholder="e.g. 6217.10.00"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 block mb-1">Commodity</label>
                      <input
                        type="text"
                        value={commodity}
                        onChange={(e) => setCommodity(e.target.value)}
                        placeholder="e.g. GARMENTS ACCESSORIES"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 block mb-1">Buyer IRC No</label>
                      <input
                        type="text"
                        value={buyerIrc}
                        onChange={(e) => setBuyerIrc(e.target.value)}
                        placeholder="IRC No"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 block mb-1">Buyer ERC No</label>
                      <input
                        type="text"
                        value={buyerErc}
                        onChange={(e) => setBuyerErc(e.target.value)}
                        placeholder="ERC No"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 block mb-1">Buyer BIN No</label>
                      <input
                        type="text"
                        value={buyerBin}
                        onChange={(e) => setBuyerBin(e.target.value)}
                        placeholder="BIN No"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-600 block mb-1">Buyer TIN No</label>
                      <input
                        type="text"
                        value={buyerTin}
                        onChange={(e) => setBuyerTin(e.target.value)}
                        placeholder="TIN No"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-section 6: Terms & Conditions for PI & Negotiation */}
                <div className="pt-3 border-t border-neutral-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      6. Proforma Invoice Terms & Conditions (শর্তাবলী)
                    </h4>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleResetTerms}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Defaults</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTerm}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Clause</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {termsList.map((term, idx) => (
                      <div key={term.id || idx} className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col md:flex-row items-start md:items-center gap-2 text-xs">
                        <span className="w-5 h-5 flex items-center justify-center bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded-full shrink-0">
                          {idx + 1}
                        </span>
                        <div className="w-full md:w-48 shrink-0">
                          <input
                            type="text"
                            value={term.label || ''}
                            onChange={(e) => handleUpdateTerm(idx, 'label', e.target.value)}
                            placeholder="Clause Label"
                            className="w-full px-2 py-1 text-xs bg-white border border-neutral-300 rounded font-bold text-neutral-800"
                          />
                        </div>
                        <div className="flex-1 w-full">
                          <input
                            type="text"
                            value={term.text}
                            onChange={(e) => handleUpdateTerm(idx, 'text', e.target.value)}
                            placeholder="Clause detail text..."
                            className="w-full px-2.5 py-1 text-xs bg-white border border-neutral-300 rounded"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTerm(idx)}
                          className="p-1 text-red-500 hover:text-red-700 rounded shrink-0"
                          title="Remove clause"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 8-Page Set Manifest & Actions */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    8-Page Negotiation Document Set Ready to Output:
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      1. First of Exchange
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      2. Second of Exchange
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      3. Commercial Invoice
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      4. Delivery Challan
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      5. Packing List
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      6. Certificate of Origin
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      7. Truck Challan
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      8. Forwarding Letter
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSaveDocumentPack(false)}
                    className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-all"
                  >
                    Save Changes
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveDocumentPack(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add & Generate Document Set</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PENDING APPROVALS SCREEN */}
      {/* ========================================================================= */}
      {activeMainTab === 'pending-approvals' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Commercial Proforma Invoices Awaiting Approval
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Review Master Value vs PI Items Total. Differences must be strictly $0.00 for approval authorization.
            </p>
          </div>

          <div className="space-y-4">
            {proformaInvoices.filter(p => p.status === 'pending_approval' || p.status === 'draft').map((pi) => {
              const diff = Math.round(((pi.piTotalValue || 0) - (pi.masterPIValue || 0)) * 100) / 100;
              const isMatched = Math.abs(diff) <= (piSetup?.valueTolerance ?? 0.00);

              return (
                <div key={pi.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        PI
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-neutral-900 font-mono">{pi.piNumber}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                            {pi.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Customer: <span className="font-bold text-neutral-800">{pi.customerName}</span> | Date: {pi.piDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPrintingPI(pi)}
                        className="p-2 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="Print / PDF View"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Prominent Comparison Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Source Reference</span>
                      <p className="font-mono font-bold text-xs text-neutral-900 mt-0.5">
                        {pi.piSource === 'bill_based' ? `Bill #${pi.sourceNumber || pi.billNo}` : `WO #${pi.sourceNumber || pi.woNumber}`}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Master Value</span>
                      <p className="font-mono font-black text-sm text-neutral-900 mt-0.5">
                        ${pi.masterPIValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">PI Total Value</span>
                      <p className="font-mono font-black text-sm text-indigo-950 mt-0.5">
                        ${pi.piTotalValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Difference & Status</span>
                      <div className="mt-0.5">
                        {isMatched ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" /> Difference: $0.00 (Matched)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-red-600">
                            <XCircle className="w-4 h-4" /> Diff: ${diff.toFixed(2)} (Mismatch)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Mini Table */}
                  <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 text-neutral-700 font-bold text-[10px]">
                        <tr>
                          <th className="p-2 text-center w-8">SL</th>
                          <th className="p-2">Item Description</th>
                          <th className="p-2 text-center w-20">Qty</th>
                          <th className="p-2 text-right w-24">Rate ({pi.currency})</th>
                          <th className="p-2 text-right w-28">Amount ({pi.currency})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {pi.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 text-center font-mono">{idx + 1}</td>
                            <td className="p-2 font-semibold text-neutral-900">{item.itemName}</td>
                            <td className="p-2 text-center font-mono">{item.quantity.toLocaleString()} {item.unit}</td>
                            <td className="p-2 text-right font-mono">{item.rate.toFixed(4)}</td>
                            <td className="p-2 text-right font-mono font-bold">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Approval Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setRejectingPI(pi);
                        setRejectionReasonInput('');
                      }}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-all"
                    >
                      Reject with Reason
                    </button>

                    <button
                      disabled={!isMatched}
                      onClick={() => triggerApprovePI(pi)}
                      className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all ${
                        isMatched
                          ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                          : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      }`}
                      title={!isMatched ? 'Cannot approve mismatched PI' : ''}
                    >
                      <Check className="w-4 h-4" />
                      <span>Authorize & Approve</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {proformaInvoices.filter(p => p.status === 'pending_approval').length === 0 && (
              <div className="py-12 text-center bg-white rounded-2xl border border-neutral-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-800">All pending Proforma Invoices are cleared!</p>
                <p className="text-xs text-neutral-400 mt-0.5">No invoices awaiting commercial authorization.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BANK MASTER & ACCOUNT SETUP */}
      {/* ========================================================================= */}
      {activeMainTab === 'bank-master' && (
        <BankMasterView
          banks={banks}
          bankAccounts={bankAccounts}
          piSetup={piSetup}
          businessId={businessId}
          userEmail={userProfile.email}
          showToast={showToast}
          isAdmin={isSuperAdmin}
        />
      )}

      {/* Rejection Modal Dialog */}
      {rejectingPI && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-neutral-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Reject PI #{rejectingPI.piNumber}
              </h3>
              <button onClick={() => setRejectingPI(null)} className="text-neutral-400 hover:text-neutral-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-700 block mb-1.5">
                Rejection Reason / Amendment Instruction *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Item rate mismatch with buyer agreed contract, please adjust row 2 quantity."
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="w-full p-3 text-xs border border-neutral-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setRejectingPI(null)}
                className="px-4 py-2 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectPI}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print / PDF Document Modal */}
      {printingPI && (
        <ProformaInvoicePrintView
          pi={printingPI}
          companyInfo={{
            name: 'ES TRIMS LIMITED',
            address: 'Plot # 122-124, Sector # 03, Uttara, Dhaka-1230, Bangladesh',
            factoryAddress: 'Vogra, Gazipur Sadar, Gazipur, Bangladesh',
            phone: '+880 2 8954421, +880 1713 000000',
            email: 'info@estrims.com, accounts@estrims.com',
            web: 'www.estrims.com',
            binNumber: '001234567-0101',
            tinNumber: '123456789012',
            ercNumber: 'RA-0987654',
            ircNumber: 'BA-1234567',
            authorizedSignatoryName: 'Mohammad Ekhlas',
            authorizedSignatoryDesignation: 'Managing Director'
          }}
          onUpdatePiDetails={handleUpdatePiNegotiationDetails}
          onClose={() => setPrintingPI(null)}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        subMessage={confirmModal.subMessage}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        showReasonInput={confirmModal.showReasonInput}
      />

    </div>
  );
};
