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
  Timestamp 
} from 'firebase/firestore';
import { 
  FileText, 
  Plus, 
  Search, 
  Check,
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
  Receipt,
  Download,
  ArrowRight,
  Eye,
  Tag
} from 'lucide-react';
import { db } from '../firebase';
import { 
  UserProfile, 
  Customer, 
  DeliveryChallanRecord, 
  CustomerMrrReceipt 
} from '../types';

interface CustomerMrrReceiptViewProps {
  userProfile: UserProfile;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  customers?: Customer[];
}

export function CustomerMrrReceiptView({ 
  userProfile, 
  showToast,
  customers: propCustomers = []
}: CustomerMrrReceiptViewProps) {
  // --- Data State ---
  const [customers, setCustomers] = useState<Customer[]>(propCustomers);
  const [challans, setChallans] = useState<DeliveryChallanRecord[]>([]);
  const [mrrReceipts, setMrrReceipts] = useState<CustomerMrrReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Filtering State ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [billingFilter, setBillingFilter] = useState<'all' | 'pending' | 'billed'>('all');
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');

  // --- Form State for Creating MRR Receipt ---
  const [selectedChallan, setSelectedChallan] = useState<DeliveryChallanRecord | null>(null);
  const [mrrNo, setMrrNo] = useState<string>('');
  const [mrrDate, setMrrDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [mrrQty, setMrrQty] = useState<number | ''>('');
  const [mrrRemarks, setMrrRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Edit & Modal State ---
  const [editingMrr, setEditingMrr] = useState<CustomerMrrReceipt | null>(null);
  const [viewingMrr, setViewingMrr] = useState<CustomerMrrReceipt | null>(null);

  const businessId = userProfile.businessId;

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!businessId) return;

    // 1. Fetch Customers if not passed
    if (propCustomers.length === 0) {
      const qCust = query(collection(db, 'customers'), where('businessId', '==', businessId));
      const unsubCust = onSnapshot(qCust, (snapshot) => {
        const list: Customer[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Customer));
        setCustomers(list);
      });
      return () => unsubCust();
    } else {
      setCustomers(propCustomers);
    }
  }, [businessId, propCustomers]);

  useEffect(() => {
    if (!businessId) return;
    setIsLoading(true);

    // 2. Fetch Delivery Challans
    const qChallan = query(
      collection(db, 'delivery_challans'),
      where('businessId', '==', businessId)
    );
    const unsubChallan = onSnapshot(qChallan, (snapshot) => {
      const list: DeliveryChallanRecord[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as DeliveryChallanRecord);
      });
      // Sort newest first
      list.sort((a, b) => (b.challanNo || '').localeCompare(a.challanNo || ''));
      setChallans(list);
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching challans:', err);
      setIsLoading(false);
    });

    // 3. Fetch Customer MRR Receipts
    const qMrr = query(
      collection(db, 'customer_mrr_receipts'),
      where('businessId', '==', businessId)
    );
    const unsubMrr = onSnapshot(qMrr, (snapshot) => {
      const list: CustomerMrrReceipt[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as CustomerMrrReceipt);
      });
      list.sort((a, b) => (b.mrrNo || '').localeCompare(a.mrrNo || ''));
      setMrrReceipts(list);
    }, (err) => {
      console.error('Error fetching MRR receipts:', err);
    });

    return () => {
      unsubChallan();
      unsubMrr();
    };
  }, [businessId]);

  // Set default MRR Qty when a Challan is selected
  const handleSelectChallan = (challan: DeliveryChallanRecord) => {
    setSelectedChallan(challan);
    // Use receivedQty if present, or currentDeliveryQty / orderQty
    const defaultQty = challan.receivedQty ?? challan.currentDeliveryQty ?? challan.orderQty ?? 0;
    setMrrQty(defaultQty);
    setMrrRemarks(challan.receiverRemarks || '');
    // Auto-generate suggested MRR if blank (or leave blank for mandatory user input)
    if (!mrrNo) {
      setMrrNo(`MRR-${challan.challanNo || ''}`);
    }
  };

  // Count of challans created but not yet confirmed received by the customer
  const unreceivedChallansCount = useMemo(() => {
    return challans.filter(ch => ch.status !== 'cancelled' && ch.receivedStatus !== 'received').length;
  }, [challans]);

  // --- Filtered Delivery Challans (Strict: Must be CONFIRMED RECEIVED by customer) ---
  const filteredChallans = useMemo(() => {
    return challans.filter(ch => {
      // Must not be cancelled
      if (ch.status === 'cancelled') return false;

      // CRITICAL POLICY ENFORCEMENT: Challan MUST be received by customer first
      // Unreceived / pending challans cannot be processed for Customer MRR
      if (ch.receivedStatus !== 'received') return false;

      // Customer filter
      if (selectedCustomerId !== 'all' && ch.customerId !== selectedCustomerId) {
        return false;
      }

      // Search query filter (Challan No, WO No, PO No, Product Name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchChallan = (ch.challanNo || '').toLowerCase().includes(q);
        const matchWo = (ch.woNumber || '').toLowerCase().includes(q);
        const matchPo = (ch.poNo || '').toLowerCase().includes(q);
        const matchCust = (ch.customerName || '').toLowerCase().includes(q);
        const matchProd = (ch.productName || '').toLowerCase().includes(q);
        if (!matchChallan && !matchWo && !matchPo && !matchCust && !matchProd) {
          return false;
        }
      }

      return true;
    });
  }, [challans, selectedCustomerId, searchQuery]);

  // --- Filtered MRR Receipts ---
  const filteredMrrReceipts = useMemo(() => {
    return mrrReceipts.filter(mrr => {
      // Customer filter
      if (selectedCustomerId !== 'all' && mrr.customerId !== selectedCustomerId) {
        return false;
      }

      // Billing status filter
      if (billingFilter === 'pending' && mrr.billingStatus === 'billed') return false;
      if (billingFilter === 'billed' && mrr.billingStatus !== 'billed') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchMrr = (mrr.mrrNo || '').toLowerCase().includes(q);
        const matchChallan = (mrr.challanNo || '').toLowerCase().includes(q);
        const matchCust = (mrr.customerName || '').toLowerCase().includes(q);
        const matchWo = (mrr.woNumber || '').toLowerCase().includes(q);
        const matchPo = (mrr.poNo || '').toLowerCase().includes(q);
        if (!matchMrr && !matchChallan && !matchCust && !matchWo && !matchPo) {
          return false;
        }
      }

      return true;
    });
  }, [mrrReceipts, selectedCustomerId, billingFilter, searchQuery]);

  // Check if a challan already has an MRR recorded
  const getMrrForChallan = (challanId: string, challanNo: string) => {
    return mrrReceipts.find(m => m.challanId === challanId || m.challanNo === challanNo);
  };

  // --- Create / Add Customer MRR Receipt ---
  const handleSaveMrrReceipt = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChallan) {
      showToast('Please select a Delivery Challan first!', 'error');
      return;
    }

    if (selectedChallan.receivedStatus !== 'received') {
      showToast('This Delivery Challan has not been received by the customer yet! Only confirmed received challans can be processed for MRR.', 'error');
      return;
    }

    if (!editingMrr) {
      const alreadyMrr = mrrReceipts.find(m => m.challanId === selectedChallan.id || m.challanNo === selectedChallan.challanNo);
      if (alreadyMrr) {
        showToast(`This Challan already has an MRR (${alreadyMrr.mrrNo}). Please select another challan or edit the existing MRR from the MRR Register.`, 'error');
        return;
      }
    }

    if (!mrrNo.trim()) {
      showToast('MRR Number is MANDATORY! Please enter the Customer MRR Number.', 'error');
      return;
    }

    if (mrrQty === '' || Number(mrrQty) <= 0) {
      showToast('Please enter a valid accepted MRR Quantity.', 'error');
      return;
    }

    // Check duplicate MRR No for this business
    const existingMrrNo = mrrReceipts.find(
      m => m.mrrNo.trim().toLowerCase() === mrrNo.trim().toLowerCase() && m.id !== editingMrr?.id
    );
    if (existingMrrNo) {
      showToast(`MRR Number "${mrrNo.trim()}" already exists! Please enter a unique MRR Number.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalMrrQty = Number(mrrQty);
      const challanQty = selectedChallan.currentDeliveryQty || selectedChallan.orderQty || 0;

      if (editingMrr) {
        // Edit existing MRR
        await updateDoc(doc(db, 'customer_mrr_receipts', editingMrr.id), {
          mrrNo: mrrNo.trim(),
          mrrDate: mrrDate,
          mrrQty: finalMrrQty,
          unbilledQty: finalMrrQty - (editingMrr.billedQty || 0),
          remarks: mrrRemarks.trim(),
          updatedAt: Timestamp.now(),
          updatedBy: userProfile.displayName || userProfile.email
        });

        // Update Challan reference
        if (selectedChallan.id) {
          await updateDoc(doc(db, 'delivery_challans', selectedChallan.id), {
            mrrNo: mrrNo.trim(),
            mrrDate: mrrDate,
            mrrQty: finalMrrQty,
            hasMrr: true
          });
        }

        showToast(`Customer MRR Receipt "${mrrNo}" updated successfully!`, 'success');
        setEditingMrr(null);
      } else {
        // Create new Customer MRR Receipt
        const newMrrData: Omit<CustomerMrrReceipt, 'id'> = {
          mrrNo: mrrNo.trim(),
          mrrDate: mrrDate || new Date().toISOString().split('T')[0],
          challanId: selectedChallan.id,
          challanNo: selectedChallan.challanNo,
          challanDate: selectedChallan.challanDate || '',
          woId: selectedChallan.woId || '',
          woNumber: selectedChallan.woNumber || '',
          customerId: selectedChallan.customerId || '',
          customerName: selectedChallan.customerName || '',
          buyerName: selectedChallan.buyerName || '',
          poNo: selectedChallan.poNo || '',
          piNo: selectedChallan.piNo || '',
          productName: selectedChallan.productName || '',
          productCode: selectedChallan.productCode || '',
          challanQty: challanQty,
          mrrQty: finalMrrQty,
          unit: selectedChallan.unit || 'Pcs',
          remarks: mrrRemarks.trim(),
          billingStatus: 'pending',
          billedQty: 0,
          unbilledQty: finalMrrQty,
          businessId: businessId,
          ownerId: userProfile.uid,
          createdAt: Timestamp.now(),
          createdBy: userProfile.displayName || userProfile.email
        };

        const docRef = await addDoc(collection(db, 'customer_mrr_receipts'), newMrrData);

        // Update Delivery Challan document to mark MRR received
        if (selectedChallan.id) {
          await updateDoc(doc(db, 'delivery_challans', selectedChallan.id), {
            hasMrr: true,
            mrrNo: mrrNo.trim(),
            mrrQty: finalMrrQty,
            mrrDate: mrrDate,
            mrrDocId: docRef.id,
            receivedStatus: 'received'
          });
        }

        showToast(`Customer MRR Receipt "${mrrNo}" added successfully! Quantity: ${finalMrrQty.toLocaleString()} ${selectedChallan.unit || 'Pcs'}.`, 'success');
      }

      // Reset form
      setSelectedChallan(null);
      setMrrNo('');
      setMrrQty('');
      setMrrRemarks('');
      setActiveTab('list');
    } catch (err: any) {
      console.error('Error saving Customer MRR Receipt:', err);
      showToast('Error saving MRR Receipt: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete MRR Receipt ---
  const handleDeleteMrr = async (mrr: CustomerMrrReceipt) => {
    if (mrr.billingStatus === 'billed') {
      showToast('Cannot delete an MRR Receipt that has already been billed!', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Customer MRR Receipt "${mrr.mrrNo}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'customer_mrr_receipts', mrr.id));

      // Reset challan flags
      if (mrr.challanId) {
        await updateDoc(doc(db, 'delivery_challans', mrr.challanId), {
          hasMrr: false,
          mrrNo: '',
          mrrQty: 0
        });
      }

      showToast(`MRR Receipt "${mrr.mrrNo}" deleted successfully.`, 'info');
    } catch (err: any) {
      showToast('Error deleting MRR Receipt: ' + err.message, 'error');
    }
  };

  // Edit existing MRR Receipt
  const handleEditMrrClick = (mrr: CustomerMrrReceipt) => {
    const parentChallan = challans.find(c => c.id === mrr.challanId || c.challanNo === mrr.challanNo);
    if (parentChallan) {
      setSelectedChallan(parentChallan);
    } else {
      // Mock minimal challan object if original not found
      setSelectedChallan({
        id: mrr.challanId,
        challanNo: mrr.challanNo,
        challanDate: mrr.challanDate,
        woId: mrr.woId || '',
        woNumber: mrr.woNumber || '',
        customerId: mrr.customerId,
        customerName: mrr.customerName,
        buyerName: mrr.buyerName || '',
        poNo: mrr.poNo || '',
        productName: mrr.productName || '',
        productCode: mrr.productCode || '',
        orderQty: mrr.challanQty,
        currentDeliveryQty: mrr.challanQty,
        unit: mrr.unit || 'Pcs',
        deliveryStatus: 'Fully Delivered',
        status: 'active',
        businessId: mrr.businessId,
        ownerId: mrr.ownerId,
        deliveryAddress: '',
        vehicleNo: '',
        driverName: '',
        driverMobile: '',
        deliveryType: '',
        productionCompletedQty: mrr.challanQty,
        previouslyDeliveredQty: 0,
        availableQty: 0,
        remainingQty: 0,
        preparedBy: ''
      });
    }

    setEditingMrr(mrr);
    setMrrNo(mrr.mrrNo);
    setMrrDate(mrr.mrrDate || new Date().toISOString().split('T')[0]);
    setMrrQty(mrr.mrrQty);
    setMrrRemarks(mrr.remarks || '');
    setActiveTab('create');
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalReceipts = mrrReceipts.length;
    const totalQty = mrrReceipts.reduce((acc, curr) => acc + (curr.mrrQty || 0), 0);
    const pendingBillingCount = mrrReceipts.filter(m => m.billingStatus !== 'billed').length;
    const billedCount = mrrReceipts.filter(m => m.billingStatus === 'billed').length;
    return { totalReceipts, totalQty, pendingBillingCount, billedCount };
  }, [mrrReceipts]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Receipt className="w-4 h-4" />
              <span>Sales Management & Log</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Customer MRR Receipt
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Receive and record Customer Material Receipt Reports (MRR) against delivered challans. Manage accepted quantities for subsequent invoice generation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('create');
                setSelectedChallan(null);
                setEditingMrr(null);
                setMrrNo('');
                setMrrQty('');
                setMrrRemarks('');
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              New MRR Receipt
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                activeTab === 'list'
                  ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              MRR Log ({mrrReceipts.length})
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total MRRs Logged</p>
            <p className="text-lg font-black text-white mt-1">{metrics.totalReceipts}</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Total Accepted Qty</p>
            <p className="text-lg font-black text-indigo-300 mt-1">{metrics.totalQty.toLocaleString()} Pcs</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pending Billing</p>
            <p className="text-lg font-black text-amber-300 mt-1">{metrics.pendingBillingCount} Receipts</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Billed MRRs</p>
            <p className="text-lg font-black text-emerald-300 mt-1">{metrics.billedCount} Receipts</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Customer Dropdown Filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px]">
            <Building2 className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="all">🏢 All Customers ({customers.length})</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {activeTab === 'list' && (
            <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setBillingFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${billingFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-neutral-600 hover:text-black'}`}
              >
                All MRRs
              </button>
              <button
                onClick={() => setBillingFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition-all ${billingFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-neutral-600 hover:text-black'}`}
              >
                Pending Bill
              </button>
              <button
                onClick={() => setBillingFilter('billed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${billingFilter === 'billed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-neutral-600 hover:text-black'}`}
              >
                Billed
              </button>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Challan No, MRR No, WO, PO..."
            className="w-full pl-9 pr-8 py-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 focus:bg-white focus:border-indigo-600 rounded-xl text-xs font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 rounded-full text-neutral-400 hover:text-neutral-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: CREATE / EDIT MRR RECEIPT */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (Lg 5): Available Received Delivery Challans */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Select Received Delivery Challan
              </h3>
              <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                {filteredChallans.length} Challans
              </span>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-xs text-neutral-500 font-medium space-y-2">
                <Clock className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                <p>Loading Delivery Challans...</p>
              </div>
            ) : filteredChallans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs font-bold text-neutral-800">No Received Delivery Challans Found</p>
                <p className="text-[11px] text-neutral-500">
                  Only Delivery Challans that have been confirmed as received by the customer ('Challan Received') are eligible for Customer MRR logging.
                </p>
                {unreceivedChallansCount > 0 && (
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium">
                    <p className="font-bold">⚠️ Notice:</p>
                    <p>There are {unreceivedChallansCount} challans awaiting customer receipt confirmation in Despatch &gt; Challan Received.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredChallans.map((ch) => {
                  const existingMrr = getMrrForChallan(ch.id, ch.challanNo);
                  const isSelected = selectedChallan?.id === ch.id;

                  return (
                    <div
                      key={ch.id}
                      onClick={() => handleSelectChallan(ch)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                        isSelected 
                          ? 'bg-indigo-50/90 border-indigo-600 shadow-md ring-2 ring-indigo-500/20' 
                          : existingMrr
                          ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                          : 'bg-white border-neutral-200 hover:border-indigo-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                              {ch.challanNo}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" /> Received: {ch.receivedDate || ch.challanDate || 'Confirmed'}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-neutral-900 mt-1.5">{ch.customerName}</h4>
                          {ch.buyerName && (
                            <p className="text-[11px] font-medium text-neutral-500">Buyer: {ch.buyerName}</p>
                          )}
                        </div>

                        {existingMrr ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            MRR: {existingMrr.mrrNo}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full shrink-0">
                            Pending MRR
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-neutral-100 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-neutral-400 block text-[9px] uppercase font-bold">WO & PO</span>
                          <span className="font-mono font-bold text-neutral-800 truncate block">
                            {ch.woNumber} {ch.poNo ? `/ PO: ${ch.poNo}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[9px] uppercase font-bold">Delivered Qty</span>
                          <span className="font-black text-indigo-700">
                            {(ch.currentDeliveryQty || ch.orderQty || 0).toLocaleString()} {ch.unit || 'Pcs'}
                          </span>
                        </div>
                      </div>

                      {ch.productName && (
                        <div className="mt-2 text-[11px] text-neutral-600 bg-neutral-100/70 p-1.5 rounded-lg flex items-center justify-between">
                          <span className="truncate font-medium">{ch.productName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column (Lg 7): MRR Receipt Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-6 sticky top-20">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-indigo-600" />
                    {editingMrr ? 'Edit Customer MRR Receipt' : 'Create Customer MRR Receipt'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {selectedChallan
                      ? `Recording MRR for Delivery Challan ${selectedChallan.challanNo}`
                      : 'Select a delivery challan from the left list to populate MRR details.'}
                  </p>
                </div>
                {selectedChallan && (
                  <button
                    onClick={() => {
                      setSelectedChallan(null);
                      setEditingMrr(null);
                      setMrrNo('');
                      setMrrQty('');
                    }}
                    className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700"
                    title="Clear selected challan"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!selectedChallan ? (
                <div className="bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 p-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-neutral-800">No Challan Selected</h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Click on any delivery challan from the list on the left to record its Customer Material Receipt Report (MRR).
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSaveMrrReceipt} className="space-y-5">
                  {/* Selected Challan Header Summary */}
                  <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                        Selected Delivery Challan
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-md border border-indigo-200">
                        {selectedChallan.challanNo}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-neutral-400 text-[10px] block">Customer</span>
                        <span className="font-bold text-neutral-900">{selectedChallan.customerName}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 text-[10px] block">WO / PO</span>
                        <span className="font-bold text-neutral-900">{selectedChallan.woNumber} {selectedChallan.poNo ? `/ ${selectedChallan.poNo}` : ''}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 text-[10px] block">Challan Date</span>
                        <span className="font-bold text-neutral-900">{selectedChallan.challanDate || 'N/A'}</span>
                      </div>
                    </div>

                    {selectedChallan.productName && (
                      <div className="text-xs text-neutral-700 pt-1 border-t border-indigo-100/60 flex justify-between items-center">
                        <span><strong>Product:</strong> {selectedChallan.productName}</span>
                        <span><strong>Delivered Qty:</strong> {(selectedChallan.currentDeliveryQty || selectedChallan.orderQty || 0).toLocaleString()} {selectedChallan.unit || 'Pcs'}</span>
                      </div>
                    )}
                  </div>

                  {/* Input Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Customer MRR Number (MANDATORY) */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-neutral-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-indigo-600" />
                          Customer MRR Number <span className="text-rose-600 font-extrabold">*</span>
                        </span>
                        <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                          MUST REQUIRED
                        </span>
                      </label>
                      <input
                        type="text"
                        value={mrrNo}
                        onChange={(e) => setMrrNo(e.target.value)}
                        placeholder="e.g. MRR-2026-0081, CUST-MRR-992, or Receipt No"
                        required
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-extrabold font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                      <p className="text-[10px] text-neutral-500">
                        Enter the Customer's physical MRR/GRN receipt document number. Required for billing verification.
                      </p>
                    </div>

                    {/* MRR Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        MRR Date <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={mrrDate}
                        onChange={(e) => setMrrDate(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>

                    {/* Accepted MRR Quantity (Editable!) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-indigo-600" />
                          Accepted MRR Quantity <span className="text-rose-600">*</span>
                        </span>
                        <span className="text-[10px] text-indigo-600 font-bold">
                          Manually Editable
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={mrrQty}
                          onChange={(e) => setMrrQty(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 10000"
                          required
                          min={0}
                          step="any"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                          {selectedChallan.unit || 'Pcs'}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500">
                        Defaulted from Challan ({selectedChallan.currentDeliveryQty || selectedChallan.orderQty || 0}). You can manually adjust if customer accepted partial qty.
                      </p>
                    </div>

                    {/* Remarks / Notes */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-neutral-900">
                        Remarks / Received Notes
                      </label>
                      <textarea
                        value={mrrRemarks}
                        onChange={(e) => setMrrRemarks(e.target.value)}
                        rows={2}
                        placeholder="e.g. Material received in good condition at Dhaka depot. Approved for full billing."
                        className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-300 focus:border-indigo-600 focus:bg-white rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChallan(null);
                        setEditingMrr(null);
                        setMrrNo('');
                        setMrrQty('');
                      }}
                      className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          <span>Saving MRR...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{editingMrr ? 'Update MRR Receipt' : 'Add Customer MRR Receipt'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LOGGED CUSTOMER MRR RECEIPTS LIST TABLE */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 bg-neutral-50/80 border-b border-neutral-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              Customer MRR Receipts Master Register ({filteredMrrReceipts.length})
            </h3>
            <div className="text-xs text-neutral-500 font-medium">
              Showing records for billing verification
            </div>
          </div>

          {filteredMrrReceipts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Receipt className="w-10 h-10 text-neutral-300 mx-auto" />
              <h4 className="text-sm font-bold text-neutral-800">No MRR Receipts Found</h4>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                No Customer MRR Receipts have been logged yet matching your filters. Click "New MRR Receipt" to record your first MRR.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-all"
              >
                + Create New MRR Receipt
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100/90 text-neutral-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-neutral-200">
                    <th className="py-3 px-4">MRR No & Date</th>
                    <th className="py-3 px-4">Customer & Buyer</th>
                    <th className="py-3 px-4">Challan No & Date</th>
                    <th className="py-3 px-4">WO / PO Ref</th>
                    <th className="py-3 px-4">Product / Item</th>
                    <th className="py-3 px-4 text-right">Challan Qty</th>
                    <th className="py-3 px-4 text-right">Accepted MRR Qty</th>
                    <th className="py-3 px-4 text-center">Billing Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredMrrReceipts.map((mrr) => (
                    <tr key={mrr.id} className="hover:bg-indigo-50/40 transition-colors">
                      {/* MRR No & Date */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-md inline-block">
                          {mrr.mrrNo}
                        </span>
                        <div className="text-[10px] font-semibold text-neutral-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          {mrr.mrrDate}
                        </div>
                      </td>

                      {/* Customer & Buyer */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-neutral-900 block">{mrr.customerName}</span>
                        {mrr.buyerName && (
                          <span className="text-[10px] text-neutral-500 block">Buyer: {mrr.buyerName}</span>
                        )}
                      </td>

                      {/* Challan No & Date */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                          {mrr.challanNo}
                        </span>
                        {mrr.challanDate && (
                          <span className="text-[10px] text-neutral-500 block mt-0.5">{mrr.challanDate}</span>
                        )}
                      </td>

                      {/* WO / PO Ref */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-neutral-800 block">{mrr.woNumber || 'N/A'}</span>
                        {mrr.poNo && (
                          <span className="text-[10px] font-mono text-neutral-500 block">PO: {mrr.poNo}</span>
                        )}
                      </td>

                      {/* Product */}
                      <td className="py-3 px-4 max-w-[180px] truncate">
                        <span className="font-medium text-neutral-800" title={mrr.productName}>
                          {mrr.productName || 'N/A'}
                        </span>
                      </td>

                      {/* Challan Qty */}
                      <td className="py-3 px-4 text-right font-medium text-neutral-600">
                        {(mrr.challanQty || 0).toLocaleString()} {mrr.unit || 'Pcs'}
                      </td>

                      {/* Accepted MRR Qty */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                          {(mrr.mrrQty || 0).toLocaleString()} {mrr.unit || 'Pcs'}
                        </span>
                      </td>

                      {/* Billing Status */}
                      <td className="py-3 px-4 text-center">
                        {mrr.billingStatus === 'billed' ? (
                          <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Billed
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending Bill
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingMrr(mrr)}
                            className="p-1.5 hover:bg-neutral-100 text-neutral-600 hover:text-indigo-600 rounded-lg transition-colors"
                            title="Print / View Receipt Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditMrrClick(mrr)}
                            className="p-1.5 hover:bg-indigo-50 text-neutral-600 hover:text-indigo-600 rounded-lg transition-colors"
                            title="Edit MRR Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMrr(mrr)}
                            className="p-1.5 hover:bg-rose-50 text-neutral-600 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete MRR Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* VIEW / PRINT MRR RECEIPT MODAL */}
      {viewingMrr && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95">
            {/* Modal Top Control Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <span className="font-black text-sm">Customer MRR Voucher ({viewingMrr.mrrNo})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printElement('printable-customer-mrr', { title: `MRR-${viewingMrr.mrrNo}` })}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Voucher
                </button>
                <button
                  onClick={() => setViewingMrr(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Body */}
            <div id="printable-customer-mrr" className="printable-doc p-8 space-y-6 print:p-0 print:m-0 print:w-full">
              {/* Company Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                    alt="ES Trims Limited"
                    className="h-14 w-14 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                  />
                  <div className="text-left">
                    <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">ES TRIMS LIMITED</h2>
                    <p className="text-[11px] text-slate-700 font-medium">ES Trims Limited, C-15 panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400</p>
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-md shrink-0">
                  CUSTOMER MATERIAL RECEIPT REPORT (MRR)
                </div>
              </div>

              {/* Header Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border p-4 rounded-xl bg-slate-50 border-slate-200">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">MRR Number</p>
                  <p className="font-mono font-black text-sm text-indigo-900">{viewingMrr.mrrNo}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">MRR Date</p>
                  <p className="font-bold text-slate-900">{viewingMrr.mrrDate}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Customer Name</p>
                  <p className="font-black text-slate-900">{viewingMrr.customerName}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Buyer Name</p>
                  <p className="font-bold text-slate-900">{viewingMrr.buyerName || 'N/A'}</p>
                </div>
              </div>

              {/* Reference Details */}
              <div className="grid grid-cols-3 gap-2 text-xs bg-white border p-3 rounded-xl border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Challan No</span>
                  <span className="font-mono font-bold text-slate-900">{viewingMrr.challanNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">WO Number</span>
                  <span className="font-mono font-bold text-slate-900">{viewingMrr.woNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Customer PO No</span>
                  <span className="font-mono font-bold text-slate-900">{viewingMrr.poNo || 'N/A'}</span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 uppercase text-[10px] font-extrabold border-b border-slate-300">
                    <th className="py-2.5 px-3 border-r border-slate-300">Product / Item Description</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-right">Challan Qty</th>
                    <th className="py-2.5 px-3 text-right">Accepted MRR Qty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-3 border-r border-slate-200">
                      <p className="font-bold text-slate-900">{viewingMrr.productName || 'Apparel Accessories'}</p>
                      {viewingMrr.remarks && (
                        <p className="text-[11px] text-slate-500 mt-1">Note: {viewingMrr.remarks}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 border-r border-slate-200 text-right font-medium">
                      {(viewingMrr.challanQty || 0).toLocaleString()} {viewingMrr.unit || 'Pcs'}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                      {(viewingMrr.mrrQty || 0).toLocaleString()} {viewingMrr.unit || 'Pcs'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs text-slate-600">
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-bold">Received By / Customer</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-bold">Verified By Accounts</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-bold">Authorized Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
