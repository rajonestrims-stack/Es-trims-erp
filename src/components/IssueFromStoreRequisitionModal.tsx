import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  Timestamp, 
  getDocs 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  ClipboardCheck, 
  FileText, 
  Printer, 
  Search, 
  Filter, 
  Clock, 
  Package, 
  RefreshCw,
  XCircle,
  Check,
  Building2,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import { db } from '../firebase';
import { 
  Item, 
  UserProfile, 
  StoreRequisitionData, 
  StoreRequisitionItem 
} from '../types';

export interface UnifiedStoreRequisitionRecord {
  id: string;
  sourceDoc: 'store_requisitions' | 'production_requisitions';
  storeReqDocId?: string;
  prodReqDocId?: string;
  srNo: string;
  srDate: string;
  department: string;
  requestorName: string;
  purpose?: string;
  jobNo?: string;
  woNumber?: string;
  style?: string;
  productName?: string;
  status: 'pending' | 'issued' | 'rejected';
  remarks?: string;
  items: {
    itemId?: string;
    itemCode?: string;
    itemName: string;
    unit?: string;
    quantity: number;
    remarks?: string;
  }[];
  createdAt?: any;
  issuedAt?: any;
  issuedBy?: string;
  rejectionReason?: string;
}

export interface IssueFromStoreRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onRequisitionIssued: (reqData: StoreRequisitionData) => void;
  recalculateItemStock: (itemId: string, businessId: string) => Promise<void>;
  syncAllData?: () => Promise<void>;
}

export function IssueFromStoreRequisitionModal({
  isOpen,
  onClose,
  items,
  userProfile,
  showToast,
  onRequisitionIssued,
  recalculateItemStock,
  syncAllData
}: IssueFromStoreRequisitionModalProps) {
  const isViewer = userProfile.role === 'viewer';
  const bId = userProfile.businessId;

  const [activeFilter, setActiveFilter] = useState<'pending' | 'issued' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReq, setSelectedReq] = useState<UnifiedStoreRequisitionRecord | null>(null);
  const [isConfirmingId, setIsConfirmingId] = useState<string | null>(null);
  const [isRejectingId, setIsRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reqToReject, setReqToReject] = useState<UnifiedStoreRequisitionRecord | null>(null);

  // Requisitions from store_requisitions collection
  const [storeReqs, setStoreReqs] = useState<any[]>([]);
  // Requisitions from production_requisitions collection
  const [prodReqs, setProdReqs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Realtime listeners for both store_requisitions and production_requisitions
  useEffect(() => {
    if (!isOpen || !bId) return;

    setIsLoading(true);

    const qStore = query(collection(db, 'store_requisitions'), where('businessId', '==', bId));
    const unsubStore = onSnapshot(qStore, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStoreReqs(list);
      setIsLoading(false);
    }, (err) => {
      console.warn('Error fetching store_requisitions:', err);
      setIsLoading(false);
    });

    const qProd = query(collection(db, 'production_requisitions'), where('businessId', '==', bId));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setProdReqs(list);
    }, (err) => {
      console.warn('Error fetching production_requisitions:', err);
    });

    return () => {
      unsubStore();
      unsubProd();
    };
  }, [isOpen, bId]);

  // Combine and deduplicate requisitions by srNo/reqNo
  const unifiedRequisitions: UnifiedStoreRequisitionRecord[] = useMemo(() => {
    const map = new Map<string, UnifiedStoreRequisitionRecord>();

    // 1. Process store_requisitions first
    storeReqs.forEach((sr) => {
      const key = (sr.srNo || sr.reqNo || sr.id).trim().toUpperCase();
      const rawItems = Array.isArray(sr.items) ? sr.items : [];
      const normalizedItems = rawItems.map((it: any) => ({
        itemId: it.itemId || it.rawMaterialId,
        itemCode: it.itemCode || it.sku,
        itemName: it.itemName || it.rawMaterialName || 'Material Item',
        unit: it.unit || 'Pcs',
        quantity: Number(it.quantity || it.requiredQty || 0),
        remarks: it.remarks || it.notes || ''
      }));

      map.set(key, {
        id: sr.id,
        sourceDoc: 'store_requisitions',
        storeReqDocId: sr.id,
        srNo: sr.srNo || sr.reqNo || 'SR-0000',
        srDate: sr.srDate || sr.date || format(new Date(), 'yyyy-MM-dd'),
        department: sr.department || 'Production',
        requestorName: sr.requestorName || 'Production Floor',
        purpose: sr.purpose || '',
        jobNo: sr.jobNo || sr.woNumber || '',
        woNumber: sr.woNumber || sr.jobNo || '',
        style: sr.style || sr.productName || '',
        productName: sr.productName || sr.style || '',
        status: (sr.status || 'pending').toLowerCase() as any,
        remarks: sr.remarks || sr.notes || '',
        items: normalizedItems,
        createdAt: sr.createdAt,
        issuedAt: sr.issuedAt,
        issuedBy: sr.issuedBy,
        rejectionReason: sr.rejectionReason
      });
    });

    // 2. Merge production_requisitions (link with storeReqDocId if already found, or add new)
    prodReqs.forEach((pr) => {
      const key = (pr.reqNo || pr.srNo || pr.id).trim().toUpperCase();
      const existing = map.get(key);

      const rawItems = Array.isArray(pr.items) ? pr.items : [];
      const normalizedItems = rawItems.map((it: any) => ({
        itemId: it.rawMaterialId || it.itemId,
        itemCode: it.sku || it.itemCode,
        itemName: it.rawMaterialName || it.itemName || 'Raw Material',
        unit: it.unit || 'Pcs',
        quantity: Number(it.requiredQty || it.quantity || 0),
        remarks: it.remarks || it.notes || ''
      }));

      if (existing) {
        existing.prodReqDocId = pr.id;
        // If items were missing in storeReq, enrich from prodReq
        if (existing.items.length === 0 && normalizedItems.length > 0) {
          existing.items = normalizedItems;
        }
        if (!existing.woNumber && pr.woNumber) existing.woNumber = pr.woNumber;
        if (!existing.productName && pr.productName) existing.productName = pr.productName;
        // Prioritize issued status if either is issued
        if (pr.status === 'issued' || existing.status === 'issued') {
          existing.status = 'issued';
        } else if (pr.status === 'rejected' || existing.status === 'rejected') {
          existing.status = 'rejected';
        }
      } else {
        map.set(key, {
          id: pr.id,
          sourceDoc: 'production_requisitions',
          prodReqDocId: pr.id,
          srNo: pr.reqNo || pr.srNo || 'PR-0000',
          srDate: pr.date || format(new Date(), 'yyyy-MM-dd'),
          department: 'Production',
          requestorName: pr.requestorName || 'Production Floor',
          purpose: `Raw Material Requisition for Work Order ${pr.woNumber || ''}`,
          jobNo: pr.jobNo || pr.woNumber || '',
          woNumber: pr.woNumber || '',
          style: pr.style || pr.productName || '',
          productName: pr.productName || '',
          status: (pr.status || 'pending').toLowerCase() as any,
          remarks: pr.remarks || '',
          items: normalizedItems,
          createdAt: pr.createdAt,
          issuedAt: pr.issuedAt,
          issuedBy: pr.issuedBy
        });
      }
    });

    // Convert map to sorted array (newest first, pending first)
    const list = Array.from(map.values());
    list.sort((a, b) => {
      // Pending first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      // Then date
      const dateA = a.srDate ? new Date(a.srDate).getTime() : 0;
      const dateB = b.srDate ? new Date(b.srDate).getTime() : 0;
      return dateB - dateA;
    });

    return list;
  }, [storeReqs, prodReqs]);

  // Counts
  const pendingCount = useMemo(() => {
    return unifiedRequisitions.filter(r => r.status === 'pending').length;
  }, [unifiedRequisitions]);

  const issuedCount = useMemo(() => {
    return unifiedRequisitions.filter(r => r.status === 'issued').length;
  }, [unifiedRequisitions]);

  // Filtered list
  const filteredRequisitions = useMemo(() => {
    return unifiedRequisitions.filter(req => {
      // Filter by status tab
      if (activeFilter === 'pending' && req.status !== 'pending') return false;
      if (activeFilter === 'issued' && req.status !== 'issued') return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSrNo = req.srNo.toLowerCase().includes(q);
        const matchesJobNo = (req.jobNo || '').toLowerCase().includes(q);
        const matchesWo = (req.woNumber || '').toLowerCase().includes(q);
        const matchesStyle = (req.style || '').toLowerCase().includes(q);
        const matchesProd = (req.productName || '').toLowerCase().includes(q);
        const matchesRequestor = (req.requestorName || '').toLowerCase().includes(q);
        const matchesItem = req.items.some(i => i.itemName.toLowerCase().includes(q) || (i.itemCode || '').toLowerCase().includes(q));

        if (!matchesSrNo && !matchesJobNo && !matchesWo && !matchesStyle && !matchesProd && !matchesRequestor && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedRequisitions, activeFilter, searchQuery]);

  // Auto-select first requisition if none selected
  useEffect(() => {
    if (filteredRequisitions.length > 0) {
      if (!selectedReq || !filteredRequisitions.some(r => r.id === selectedReq.id)) {
        setSelectedReq(filteredRequisitions[0]);
      }
    } else {
      setSelectedReq(null);
    }
  }, [filteredRequisitions]);

  // Check stock status for items in selected requisition
  const stockValidation = useMemo(() => {
    if (!selectedReq) return { canIssue: false, shortages: [], itemsStatus: [] };

    const shortages: { itemName: string; requiredQty: number; availableStock: number; unit: string }[] = [];
    const itemsStatus = selectedReq.items.map(reqItem => {
      // Match by itemId first, then by SKU/itemCode or item name
      let matchedItem: Item | undefined;
      if (reqItem.itemId) {
        matchedItem = items.find(i => i.id === reqItem.itemId);
      }
      if (!matchedItem && reqItem.itemCode) {
        matchedItem = items.find(i => i.sku?.toLowerCase().trim() === reqItem.itemCode?.toLowerCase().trim());
      }
      if (!matchedItem) {
        matchedItem = items.find(i => i.name.toLowerCase().trim() === reqItem.itemName.toLowerCase().trim());
      }

      const availableStock = matchedItem ? Number(matchedItem.currentStock) || 0 : 0;
      const requiredQty = Number(reqItem.quantity) || 0;
      const isSufficient = availableStock >= requiredQty - 0.0001;

      if (!isSufficient) {
        shortages.push({
          itemName: reqItem.itemName || matchedItem?.name || 'Item',
          requiredQty,
          availableStock,
          unit: reqItem.unit || matchedItem?.unit || 'Pcs'
        });
      }

      return {
        reqItem,
        matchedItem,
        availableStock,
        requiredQty,
        isSufficient
      };
    });

    return {
      canIssue: shortages.length === 0,
      shortages,
      itemsStatus
    };
  }, [selectedReq, items]);

  // Handle Confirm & Issue Requisition
  const handleConfirmIssue = async (req: UnifiedStoreRequisitionRecord) => {
    if (isViewer) {
      showToast('Viewer role cannot issue store requisitions.', 'error');
      return;
    }

    if (stockValidation.shortages.length > 0) {
      showToast(
        `Cannot issue! Insufficient stock for ${stockValidation.shortages.length} item(s). Please adjust or replenish stock first.`,
        'error'
      );
      return;
    }

    setIsConfirmingId(req.id);

    try {
      const affectedItemIds = new Set<string>();
      const issuedItemsSummary: StoreRequisitionItem[] = [];

      for (const itemStatus of stockValidation.itemsStatus) {
        const { reqItem, matchedItem, requiredQty } = itemStatus;
        const targetItem = matchedItem || items.find(i => i.id === reqItem.itemId);

        const currentStock = targetItem ? Number(targetItem.currentStock) || 0 : 0;
        const newStock = Math.max(0, currentStock - requiredQty);
        const avgCost = targetItem ? Number(targetItem.avgCost) || 0 : 0;
        const itemId = targetItem ? targetItem.id : (reqItem.itemId || 'custom-item');

        // 1. Update stock in items collection
        if (targetItem) {
          const itemRef = doc(db, 'items', targetItem.id);
          await updateDoc(itemRef, {
            currentStock: Number(newStock.toFixed(4)),
            updatedAt: Timestamp.now()
          });
          affectedItemIds.add(targetItem.id);
        }

        // 2. Create deduction transaction record
        await addDoc(collection(db, 'transactions'), {
          type: 'PRODUCTION',
          itemId: itemId,
          quantity: requiredQty,
          price: avgCost,
          date: Timestamp.now(),
          businessId: bId,
          ownerId: userProfile.uid,
          department: req.department || 'Production',
          purpose: req.purpose || `Store Issue against Requisition ${req.srNo} (Job: ${req.jobNo || req.woNumber || 'N/A'})`,
          jobNo: req.jobNo || req.woNumber || '',
          style: req.style || req.productName || '',
          srNo: req.srNo,
          reference: req.srNo,
          notes: req.remarks || `Issued to Production via Store Requisition ${req.srNo}`,
          status: 'active'
        });

        issuedItemsSummary.push({
          itemId: itemId,
          itemCode: reqItem.itemCode || targetItem?.sku || '',
          itemName: reqItem.itemName || targetItem?.name || 'Raw Material',
          unit: reqItem.unit || targetItem?.unit || 'Pcs',
          quantity: requiredQty,
          notes: reqItem.remarks || ''
        });
      }

      const nowTimestamp = Timestamp.now();
      const issuerName = userProfile.displayName || userProfile.name || userProfile.email || 'Store In-Charge';

      // 3. Update store_requisitions document(s)
      if (req.storeReqDocId) {
        await updateDoc(doc(db, 'store_requisitions', req.storeReqDocId), {
          status: 'issued',
          issuedAt: nowTimestamp,
          issuedBy: issuerName
        }).catch(err => console.warn('Update store_requisitions error:', err));
      } else {
        // Find by srNo query
        const qSr = query(collection(db, 'store_requisitions'), where('srNo', '==', req.srNo), where('businessId', '==', bId));
        const srSnap = await getDocs(qSr);
        srSnap.forEach(async (srDoc) => {
          await updateDoc(doc(db, 'store_requisitions', srDoc.id), {
            status: 'issued',
            issuedAt: nowTimestamp,
            issuedBy: issuerName
          });
        });
      }

      // 4. Update production_requisitions document(s)
      if (req.prodReqDocId) {
        await updateDoc(doc(db, 'production_requisitions', req.prodReqDocId), {
          status: 'issued',
          issuedAt: nowTimestamp,
          issuedBy: issuerName
        }).catch(err => console.warn('Update production_requisitions error:', err));
      } else {
        const qPr = query(collection(db, 'production_requisitions'), where('reqNo', '==', req.srNo), where('businessId', '==', bId));
        const prSnap = await getDocs(qPr);
        prSnap.forEach(async (prDoc) => {
          await updateDoc(doc(db, 'production_requisitions', prDoc.id), {
            status: 'issued',
            issuedAt: nowTimestamp,
            issuedBy: issuerName
          });
        });
      }

      // 5. Recalculate item stocks in background
      setTimeout(() => {
        affectedItemIds.forEach(id => {
          recalculateItemStock(id, bId).catch(console.error);
        });
      }, 300);

      showToast(`Store Requisition '${req.srNo}' confirmed! Raw materials issued from Store to Production.`, 'success');

      if (syncAllData) {
        syncAllData();
      }

      // 6. Construct printable slip data and trigger print preview
      const printableData: StoreRequisitionData = {
        id: req.id,
        srNo: req.srNo,
        srDate: req.srDate || format(new Date(), 'yyyy-MM-dd HH:mm'),
        department: req.department || 'Production',
        location: 'Main Store',
        requestorName: req.requestorName,
        purpose: req.purpose || `Store Issue for ${req.woNumber || req.jobNo || 'Production'}`,
        jobNo: req.jobNo || req.woNumber || '',
        style: req.style || req.productName || '',
        type: 'PRODUCTION',
        remarks: req.remarks,
        items: issuedItemsSummary,
        businessId: bId,
        ownerId: userProfile.uid
      };

      onRequisitionIssued(printableData);
    } catch (err: any) {
      console.error('Error confirming store requisition:', err);
      showToast('Failed to issue store requisition: ' + err.message, 'error');
    } finally {
      setIsConfirmingId(null);
    }
  };

  // Handle Reject Requisition
  const handleRejectRequisition = async () => {
    if (!reqToReject) return;
    if (isViewer) {
      showToast('Viewer role cannot reject store requisitions.', 'error');
      return;
    }

    setIsRejectingId(reqToReject.id);
    try {
      const nowTimestamp = Timestamp.now();
      const rejectorName = userProfile.displayName || userProfile.name || userProfile.email || 'Store In-Charge';

      if (reqToReject.storeReqDocId) {
        await updateDoc(doc(db, 'store_requisitions', reqToReject.storeReqDocId), {
          status: 'rejected',
          rejectionReason: rejectReason.trim() || 'Rejected by Store',
          rejectedAt: nowTimestamp,
          rejectedBy: rejectorName
        });
      }

      if (reqToReject.prodReqDocId) {
        await updateDoc(doc(db, 'production_requisitions', reqToReject.prodReqDocId), {
          status: 'rejected',
          rejectionReason: rejectReason.trim() || 'Rejected by Store',
          rejectedAt: nowTimestamp,
          rejectedBy: rejectorName
        });
      }

      showToast(`Store Requisition '${reqToReject.srNo}' marked as rejected.`, 'info');
      setShowRejectModal(false);
      setReqToReject(null);
      setRejectReason('');
    } catch (err: any) {
      showToast('Failed to reject requisition: ' + err.message, 'error');
    } finally {
      setIsRejectingId(null);
    }
  };

  // Open printable slip for already issued requisition
  const handlePrintExistingReq = (req: UnifiedStoreRequisitionRecord) => {
    const printableData: StoreRequisitionData = {
      id: req.id,
      srNo: req.srNo,
      srDate: req.srDate || format(new Date(), 'yyyy-MM-dd HH:mm'),
      department: req.department || 'Production',
      location: 'Main Store',
      requestorName: req.requestorName,
      purpose: req.purpose || `Store Requisition for ${req.woNumber || req.jobNo || 'Production'}`,
      jobNo: req.jobNo || req.woNumber || '',
      style: req.style || req.productName || '',
      type: 'PRODUCTION',
      remarks: req.remarks,
      items: req.items.map(it => ({
        itemId: it.itemId || '',
        itemCode: it.itemCode || '',
        itemName: it.itemName,
        unit: it.unit || 'Pcs',
        quantity: it.quantity,
        notes: it.remarks || ''
      })),
      businessId: bId,
      ownerId: userProfile.uid
    };
    onRequisitionIssued(printableData);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden my-4 border border-neutral-200 flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-neutral-900 to-indigo-950 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">Issue from Store Requisition</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Production Requisitions
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Confirm and issue raw materials against requisitions submitted by the Production department
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Navigation & Search Bar */}
        <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto bg-neutral-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveFilter('pending')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'pending'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pending Issue</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeFilter === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-300 text-neutral-700'
              }`}>
                {pendingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('issued')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'issued'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Issued History</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeFilter === 'issued' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-300 text-neutral-700'
              }`}>
                {issuedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>All ({unifiedRequisitions.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Requisition, WO, Item..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 placeholder:text-neutral-400"
            />
          </div>
        </div>

        {/* Content: 2-column layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-neutral-200">
          {/* Left Column: Requisitions List */}
          <div className="w-full md:w-5/12 overflow-y-auto max-h-[55vh] md:max-h-[68vh] p-3 space-y-2 bg-neutral-50/50">
            {isLoading ? (
              <div className="p-8 text-center text-neutral-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                <p className="text-xs">Loading store requisitions...</p>
              </div>
            ) : filteredRequisitions.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 space-y-2">
                <ClipboardCheck className="w-8 h-8 mx-auto text-neutral-300" />
                <p className="text-sm font-semibold text-neutral-600">No requisitions found</p>
                <p className="text-xs text-neutral-400">
                  {activeFilter === 'pending' 
                    ? 'There are currently no pending store requisitions waiting for material issue.' 
                    : 'No records match the current filter.'}
                </p>
              </div>
            ) : (
              filteredRequisitions.map((req) => {
                const isSelected = selectedReq?.id === req.id;
                const isPending = req.status === 'pending';
                const isIssued = req.status === 'issued';
                const isRejected = req.status === 'rejected';

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedReq(req)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                        : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-neutral-900">{req.srNo}</span>
                        {isPending && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            Pending Issue
                          </span>
                        )}
                        {isIssued && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Issued
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            Rejected
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-500 font-medium">{req.srDate}</span>
                    </div>

                    <div className="space-y-0.5 text-xs">
                      {(req.woNumber || req.jobNo) && (
                        <p className="text-neutral-700 font-medium truncate">
                          <span className="text-neutral-400">WO / Job:</span> {req.woNumber || req.jobNo}
                        </p>
                      )}
                      {(req.style || req.productName) && (
                        <p className="text-neutral-600 truncate">
                          <span className="text-neutral-400">Style:</span> {req.style || req.productName}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-500 border-t border-neutral-100 mt-1.5">
                        <span>Dept: {req.department}</span>
                        <span>{req.items.length} item(s)</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Requisition Details & Issue Confirmation */}
          <div className="w-full md:w-7/12 overflow-y-auto max-h-[55vh] md:max-h-[68vh] p-4 sm:p-5 flex flex-col justify-between bg-white">
            {selectedReq ? (
              <div className="space-y-4">
                {/* Requisition Meta Header Card */}
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Store Requisition No.</span>
                        <span className="font-mono font-black text-sm text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                          {selectedReq.srNo}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        {selectedReq.purpose || 'Production Floor Material Requisition'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedReq.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Ready to Issue
                        </span>
                      )}
                      {selectedReq.status === 'issued' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Issued from Store
                        </span>
                      )}
                      {selectedReq.status === 'rejected' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meta Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <span className="text-neutral-400 block text-[11px]">Requisition Date</span>
                      <span className="font-semibold text-neutral-800">{selectedReq.srDate}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">Department</span>
                      <span className="font-semibold text-neutral-800">{selectedReq.department}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">Work Order / Job</span>
                      <span className="font-semibold text-neutral-800">{selectedReq.woNumber || selectedReq.jobNo || '—'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">Requested By</span>
                      <span className="font-semibold text-neutral-800 truncate block">{selectedReq.requestorName}</span>
                    </div>
                  </div>

                  {selectedReq.remarks && (
                    <div className="text-xs bg-white p-2.5 rounded-lg border border-neutral-200">
                      <span className="text-neutral-400 font-bold block text-[10px] uppercase">Remarks / Notes</span>
                      <p className="text-neutral-700 mt-0.5">{selectedReq.remarks}</p>
                    </div>
                  )}

                  {selectedReq.rejectionReason && (
                    <div className="text-xs bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-rose-800">
                      <span className="font-bold block text-[10px] uppercase">Rejection Reason</span>
                      <p className="mt-0.5">{selectedReq.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Stock Shortage Warning Alert */}
                {selectedReq.status === 'pending' && !stockValidation.canIssue && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Insufficient Stock in Inventory</span>
                      <p className="text-amber-800 mt-0.5">
                        One or more items do not have enough stock in the store. Please replenish or adjust stock before issuing.
                      </p>
                      <ul className="mt-1.5 space-y-0.5 list-disc list-inside font-medium text-amber-950">
                        {stockValidation.shortages.map((sh, idx) => (
                          <li key={idx}>
                            {sh.itemName}: Available {sh.availableStock.toFixed(2)} {sh.unit}, Need {sh.requiredQty.toFixed(2)} {sh.unit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Requisition Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-emerald-600" />
                      Required Items for Issue ({selectedReq.items.length})
                    </h3>
                    <span className="text-[11px] text-neutral-500">Live Inventory Verification</span>
                  </div>

                  <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-100 text-neutral-600 font-bold border-b border-neutral-200">
                          <th className="px-3 py-2">Item Name & SKU</th>
                          <th className="px-3 py-2 text-right">Required Qty</th>
                          <th className="px-3 py-2 text-right">Store Stock</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {stockValidation.itemsStatus.map((itStat, idx) => {
                          const { reqItem, availableStock, requiredQty, isSufficient } = itStat;
                          return (
                            <tr key={idx} className="hover:bg-neutral-50/60 transition-colors">
                              <td className="px-3 py-2.5">
                                <span className="font-bold text-neutral-900 block">{reqItem.itemName}</span>
                                {reqItem.itemCode && (
                                  <span className="font-mono text-[10px] text-neutral-400">SKU: {reqItem.itemCode}</span>
                                )}
                                {reqItem.remarks && (
                                  <p className="text-[10px] text-neutral-500 italic mt-0.5">{reqItem.remarks}</p>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-black text-neutral-900">
                                {requiredQty.toLocaleString()} <span className="text-neutral-500 font-normal">{reqItem.unit || 'Pcs'}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold">
                                <span className={availableStock < requiredQty ? 'text-rose-600' : 'text-emerald-700'}>
                                  {availableStock.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {selectedReq.status === 'issued' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <Check className="w-3 h-3" /> Issued
                                  </span>
                                ) : isSufficient ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <Check className="w-3 h-3" /> Available
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                    <AlertTriangle className="w-3 h-3" /> Short
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Actions for Selected Requisition */}
                <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrintExistingReq(selectedReq)}
                      className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-300 shadow-xs"
                      title="Preview and Print Store Requisition Slip"
                    >
                      <Printer className="w-4 h-4 text-neutral-600" />
                      Print Requisition Slip
                    </button>

                    {selectedReq.status === 'pending' && !isViewer && (
                      <button
                        type="button"
                        onClick={() => {
                          setReqToReject(selectedReq);
                          setShowRejectModal(true);
                        }}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-200"
                        title="Reject Store Requisition"
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Reject Requisition
                      </button>
                    )}
                  </div>

                  {selectedReq.status === 'pending' && (
                    <button
                      type="button"
                      disabled={isViewer || isConfirmingId === selectedReq.id || !stockValidation.canIssue}
                      onClick={() => handleConfirmIssue(selectedReq)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                    >
                      {isConfirmingId === selectedReq.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Deducting Stock & Issuing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm & Issue Stock Now</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-center text-neutral-400">
                <div>
                  <ClipboardCheck className="w-12 h-12 mx-auto text-neutral-300 mb-2" />
                  <p className="text-sm font-semibold text-neutral-600">Select a requisition</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Select a requisition from the list on the left to verify store stock and confirm material issue.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-2.5 bg-neutral-100 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Store Requisition Fulfillment Engine</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-neutral-600 hover:text-neutral-900"
          >
            Close Window
          </button>
        </div>
      </div>

      {/* Reject Confirmation Modal */}
      {showRejectModal && reqToReject && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowRejectModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-4 border border-neutral-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Reject Store Requisition</h3>
                <p className="text-xs text-neutral-500">Requisition No: {reqToReject.srNo}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Reason for Rejection:
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Raw material out of stock, awaiting import delivery..."
                className="w-full p-2.5 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setReqToReject(null);
                }}
                className="px-3 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRejectingId === reqToReject.id}
                onClick={handleRejectRequisition}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                {isRejectingId === reqToReject.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
