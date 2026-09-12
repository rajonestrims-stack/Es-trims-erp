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
  orderBy,
  getDocs
} from 'firebase/firestore';
import { format } from 'date-fns';
import { 
  ShoppingBag, 
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
  FileSpreadsheet,
  Users,
  BookOpen,
  ArrowUpRight,
  CheckSquare,
  XCircle,
  TrendingUp,
  FileText,
  Truck,
  ShieldCheck,
  Send,
  Sparkles
} from 'lucide-react';
import { db } from '../firebase';
import { 
  UserProfile, 
  Supplier, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  PurchaseRequisition, 
  PurchaseRequisitionItem,
  Item,
  RoleDefinition,
  Transaction
} from '../types';
import { SuppliersAndPurchase } from './SuppliersAndPurchase';
import { checkActionPermission, isUserSuperAdmin, canUserAccessPage } from '../admin/adminUtils';
import { checkPageApprovalRule, submitDocumentForApproval } from '../services/approvalService';
import { ConfirmModal, ConfirmVariant } from './ui/ConfirmModal';
import { ApproverSelector, ApproverUserOption } from './ApproverSelector';

interface ProcurementManagementProps {
  userProfile: UserProfile;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  items: Item[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  recalculateItemStock?: (itemId: string, businessId: string) => Promise<void>;
  fetchFullHistory?: () => Promise<void>;
  syncAllData?: () => Promise<void>;
  isEditor?: boolean;
  initialSubTab?: 'requisitions' | 'purchases' | 'suppliers' | 'mrr';
  onSubTabChange?: (tab: 'requisitions' | 'purchases' | 'suppliers' | 'mrr') => void;
  roles?: RoleDefinition[];
  allowedPagesSet?: Set<string>;
}

export function ProcurementManagement({
  userProfile,
  suppliers,
  purchaseOrders,
  items,
  showToast,
  recalculateItemStock,
  fetchFullHistory,
  syncAllData,
  isEditor = false,
  initialSubTab = 'requisitions',
  onSubTabChange,
  roles = [],
  allowedPagesSet
}: ProcurementManagementProps) {
  const businessId = userProfile.businessId || 'default';
  const isSuperAdmin = isUserSuperAdmin(userProfile);
  const canDeleteRequisition = checkActionPermission(userProfile, 'procurement-requisition', 'delete', roles);
  const canEditRequisition = checkActionPermission(userProfile, 'procurement-requisition', 'edit', roles);
  const canCreateRequisition = checkActionPermission(userProfile, 'procurement-requisition', 'create', roles);
  const canApprove = isSuperAdmin || userProfile.role === 'editor' || (userProfile.role && (userProfile.role.includes('procurement') || userProfile.role.includes('manager') || userProfile.role.includes('accounts')));

  const [selectedApproverUser, setSelectedApproverUser] = useState<ApproverUserOption | null>(null);
  const [reqApprovalRequired, setReqApprovalRequired] = useState(false);

  const canAccessReq = isSuperAdmin || canUserAccessPage(userProfile, 'procurement-requisition', roles);
  const canAccessPo = isSuperAdmin || canUserAccessPage(userProfile, 'procurement-po', roles) || canUserAccessPage(userProfile, 'purchases', roles);
  const canAccessSuppliers = isSuperAdmin || canUserAccessPage(userProfile, 'procurement-suppliers', roles) || canUserAccessPage(userProfile, 'suppliers', roles);

  const availableTabs = useMemo(() => {
    const tabs: ('requisitions' | 'purchases' | 'suppliers' | 'mrr')[] = [];
    if (canAccessReq) tabs.push('requisitions');
    if (canAccessPo) tabs.push('purchases');
    if (canAccessSuppliers) tabs.push('suppliers');
    return tabs;
  }, [canAccessReq, canAccessPo, canAccessSuppliers]);

  const [activeTab, setActiveTab] = useState<'requisitions' | 'purchases' | 'suppliers' | 'mrr'>(() => {
    if (initialSubTab && (
      (initialSubTab === 'requisitions' && canAccessReq) ||
      (initialSubTab === 'purchases' && canAccessPo) ||
      (initialSubTab === 'suppliers' && canAccessSuppliers)
    )) {
      return initialSubTab;
    }
    return availableTabs[0] || 'requisitions';
  });

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  useEffect(() => {
    if (initialSubTab && availableTabs.includes(initialSubTab)) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab, availableTabs]);

  const handleTabSwitch = (tab: 'requisitions' | 'purchases' | 'suppliers' | 'mrr') => {
    setActiveTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // --- Purchase Requisitions Live Listener ---
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [isReqLoading, setIsReqLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setIsReqLoading(true);
    const qReq = query(
      collection(db, 'purchase_requisitions'),
      where('businessId', '==', businessId)
    );
    const unsub = onSnapshot(qReq, (snap) => {
      const list: PurchaseRequisition[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as PurchaseRequisition);
      });
      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.reqNo || '').localeCompare(a.reqNo || ''));
      setRequisitions(list);
      setIsReqLoading(false);
    }, (err) => {
      console.warn('Requisitions listener warning:', err.message);
      setIsReqLoading(false);
    });

    return () => unsub();
  }, [businessId]);

  // --- Helper Map: Find Previous Purchase Price for any Item ---
  // Look up latest purchase order with this item to get the previous price
  const itemPreviousPriceMap = useMemo(() => {
    const map: Record<string, { price: number; poNo?: string; date?: string }> = {};
    
    // Sort POs by date descending to find the latest
    const sortedPOs = [...purchaseOrders].sort((a, b) => {
      const aTime = (a.date as any)?.toMillis ? (a.date as any).toMillis() : (a.date ? new Date(a.date as any).getTime() : 0);
      const bTime = (b.date as any)?.toMillis ? (b.date as any).toMillis() : (b.date ? new Date(b.date as any).getTime() : 0);
      return bTime - aTime;
    });

    sortedPOs.forEach(po => {
      if (po.items && Array.isArray(po.items)) {
        po.items.forEach(it => {
          if (it.itemId && map[it.itemId] === undefined && it.price && it.price > 0) {
            const poDateStr = (po.date as any)?.toDate 
              ? (po.date as any).toDate().toLocaleDateString() 
              : (po.date ? String(po.date) : undefined);
            map[it.itemId] = {
              price: it.price,
              poNo: po.poNumber,
              date: poDateStr
            };
          }
        });
      }
    });

    // Also fallback to item.unitCost or item.price if not found in PO history
    items.forEach(it => {
      if (map[it.id] === undefined) {
        const cost = (it as any).unitCost || (it as any).lastPurchasePrice || (it as any).unitPrice || (it as any).price || it.avgCost || 0;
        if (cost > 0) {
          map[it.id] = {
            price: cost,
            poNo: 'Item Master Cost'
          };
        }
      }
    });

    return map;
  }, [purchaseOrders, items]);

  // --- Purchase Requisition Form Modal State ---
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<PurchaseRequisition | null>(null);
  const [selectedReqForView, setSelectedReqForView] = useState<PurchaseRequisition | null>(null);
  const [selectedReqForPrint, setSelectedReqForPrint] = useState<PurchaseRequisition | null>(null);

  // Requisition Form fields
  const [reqNo, setReqNo] = useState('');
  const [reqDate, setReqDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [requiredDate, setRequiredDate] = useState(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'));
  const [department, setDepartment] = useState('Store');
  const [requestorName, setRequestorName] = useState(userProfile.displayName || userProfile.name || '');
  const [purpose, setPurpose] = useState('');
  const [reqRemarks, setReqRemarks] = useState('');
  
  const [reqItems, setReqItems] = useState<PurchaseRequisitionItem[]>([
    {
      itemId: '',
      itemName: '',
      sku: '',
      category: '',
      unit: 'Pcs',
      currentStock: 0,
      quantity: 1,
      previousPrice: 0,
      priceSource: '',
      unitPrice: 0,
      totalAmount: 0,
      remarks: '',
      specification: ''
    }
  ]);

  // Generate Requisition Number: REQ-YYYY-000001
  const generateNextReqNo = () => {
    const year = new Date().getFullYear();
    let maxSeq = 0;
    requisitions.forEach(r => {
      if (r.reqNo && r.reqNo.startsWith(`REQ-${year}-`)) {
        const parts = r.reqNo.split('-');
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    return `REQ-${year}-${String(maxSeq + 1).padStart(6, '0')}`;
  };

  const handleOpenNewReqModal = () => {
    setEditingReq(null);
    setReqNo(generateNextReqNo());
    setReqDate(format(new Date(), 'yyyy-MM-dd'));
    setRequiredDate(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'));
    setDepartment('Store');
    setRequestorName(userProfile.displayName || userProfile.name || '');
    setPurpose('');
    setReqRemarks('');
    setReqItems([
      {
        itemId: '',
        itemName: '',
        sku: '',
        category: '',
        unit: 'Pcs',
        currentStock: 0,
        quantity: 1,
        previousPrice: 0,
        priceSource: '',
        unitPrice: 0,
        totalAmount: 0,
        remarks: '',
        specification: ''
      }
    ]);
    setIsReqModalOpen(true);
  };

  const handleOpenEditReqModal = (req: PurchaseRequisition) => {
    if (req.status !== 'pending' && !isSuperAdmin) {
      showToast('Only pending requisitions can be edited', 'error');
      return;
    }
    setEditingReq(req);
    setReqNo(req.reqNo);
    setReqDate(req.date);
    setRequiredDate(req.requiredDate || format(new Date(), 'yyyy-MM-dd'));
    setDepartment(req.department || 'Store');
    setRequestorName(req.requestorName || '');
    setPurpose(req.purpose || '');
    setReqRemarks(req.remarks || '');
    setReqItems(req.items.map(it => ({ ...it })));
    setIsReqModalOpen(true);
  };

  // Requisition Item change handlers
  const handleItemSelect = (index: number, itemId: string) => {
    const selectedItem = items.find(i => i.id === itemId);
    if (!selectedItem) return;

    const prevPriceInfo = itemPreviousPriceMap[itemId];
    const prevPrice = prevPriceInfo ? prevPriceInfo.price : 0;
    const priceSource = prevPriceInfo ? (prevPriceInfo.poNo ? `Last PO: ${prevPriceInfo.poNo}` : 'Master Cost') : 'Manual';

    setReqItems(prev => {
      const updated = [...prev];
      const qty = updated[index].quantity || 1;
      const effectivePrice = prevPrice > 0 ? prevPrice : (updated[index].unitPrice || 0);
      
      updated[index] = {
        ...updated[index],
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        sku: selectedItem.sku || '',
        category: (selectedItem as any).category || selectedItem.categoryId || '',
        unit: selectedItem.unit || 'Pcs',
        currentStock: selectedItem.currentStock || (selectedItem as any).quantity || 0,
        previousPrice: prevPrice,
        priceSource: priceSource,
        unitPrice: effectivePrice,
        totalAmount: qty * effectivePrice
      };
      return updated;
    });
  };

  const handleQtyChange = (index: number, qty: number) => {
    const validQty = Math.max(0, qty);
    setReqItems(prev => {
      const updated = [...prev];
      const price = updated[index].unitPrice || 0;
      updated[index] = {
        ...updated[index],
        quantity: validQty,
        totalAmount: validQty * price
      };
      return updated;
    });
  };

  const handlePriceChange = (index: number, price: number) => {
    const validPrice = Math.max(0, price);
    setReqItems(prev => {
      const updated = [...prev];
      const qty = updated[index].quantity || 0;
      updated[index] = {
        ...updated[index],
        unitPrice: validPrice,
        totalAmount: qty * validPrice
      };
      return updated;
    });
  };

  const handleItemRemarkChange = (index: number, remarks: string) => {
    setReqItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        remarks
      };
      return updated;
    });
  };

  const handleAddReqItemRow = () => {
    setReqItems(prev => [
      ...prev,
      {
        itemId: '',
        itemName: '',
        sku: '',
        category: '',
        unit: 'Pcs',
        currentStock: 0,
        quantity: 1,
        previousPrice: 0,
        priceSource: '',
        unitPrice: 0,
        totalAmount: 0,
        remarks: '',
        specification: ''
      }
    ]);
  };

  const handleRemoveReqItemRow = (index: number) => {
    if (reqItems.length <= 1) {
      showToast('Requisition must have at least one item', 'error');
      return;
    }
    setReqItems(prev => prev.filter((_, i) => i !== index));
  };

  // Requisition Form Totals
  const reqTotalQty = useMemo(() => {
    return reqItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [reqItems]);

  const reqTotalAmount = useMemo(() => {
    return reqItems.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
  }, [reqItems]);

  useEffect(() => {
    if (isReqModalOpen && businessId) {
      checkPageApprovalRule('procurement-requisition', businessId, userProfile, reqTotalAmount)
        .then(rule => {
          setReqApprovalRequired(rule.required);
        })
        .catch(console.warn);
    }
  }, [isReqModalOpen, businessId, reqTotalAmount]);

  // Save Requisition (Confirm & Submit for Approval)
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  const handleSaveRequisition = async () => {
    if (!reqNo.trim()) {
      showToast('Please provide a Requisition Number', 'error');
      return;
    }
    if (!reqDate) {
      showToast('Please select a Requisition Date', 'error');
      return;
    }

    const invalidItems = reqItems.filter(it => !it.itemId || !it.itemName);
    if (invalidItems.length > 0) {
      showToast('Please select valid raw materials for all rows', 'error');
      return;
    }

    const zeroQtyItems = reqItems.filter(it => !it.quantity || it.quantity <= 0);
    if (zeroQtyItems.length > 0) {
      showToast('All items must have a quantity greater than 0', 'error');
      return;
    }

    try {
      setIsSubmittingReq(true);
      const reqPayload: Omit<PurchaseRequisition, 'id'> = {
        reqNo: reqNo.trim(),
        date: reqDate,
        requiredDate: requiredDate || reqDate,
        department: department.trim() || 'Store',
        requestorName: requestorName.trim() || userProfile.displayName || userProfile.name || 'User',
        purpose: purpose.trim(),
        remarks: reqRemarks.trim(),
        items: reqItems.map(it => ({
          itemId: it.itemId,
          itemName: it.itemName,
          sku: it.sku || '',
          category: it.category || '',
          unit: it.unit || 'Pcs',
          currentStock: Number(it.currentStock) || 0,
          quantity: Number(it.quantity) || 0,
          previousPrice: Number(it.previousPrice) || 0,
          priceSource: it.priceSource || '',
          unitPrice: Number(it.unitPrice) || 0,
          totalAmount: Number(it.totalAmount) || 0,
          remarks: it.remarks || '',
          specification: it.specification || ''
        })),
        totalQty: reqTotalQty,
        totalAmount: reqTotalAmount,
        status: editingReq ? editingReq.status : 'pending',
        businessId,
        ownerId: userProfile.uid,
        createdBy: userProfile.email || userProfile.displayName || 'System',
        createdAt: editingReq?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      if (editingReq) {
        await updateDoc(doc(db, 'purchase_requisitions', editingReq.id), reqPayload as any);
        showToast(`Purchase Requisition ${reqNo} updated successfully`, 'success');
      } else {
        const checkResult = await checkPageApprovalRule('procurement-requisition', businessId, userProfile, reqTotalAmount);
        const reqStatus = (checkResult.required || !!selectedApproverUser) ? 'pending' : 'approved';

        const requisitionDocData: Record<string, any> = {
          ...reqPayload,
          status: reqStatus
        };

        if (selectedApproverUser) {
          requisitionDocData.assignedApproverUid = selectedApproverUser.uid;
          requisitionDocData.assignedApproverEmail = selectedApproverUser.email;
          requisitionDocData.assignedApproverName = selectedApproverUser.displayName;
        }

        if (!checkResult.required && !selectedApproverUser) {
          requisitionDocData.approvedBy = userProfile.displayName || userProfile.email || 'Auto-Approved';
          requisitionDocData.approvedAt = Timestamp.now();
        }

        const docRef = await addDoc(collection(db, 'purchase_requisitions'), requisitionDocData);

        if (checkResult.required || selectedApproverUser) {
          await submitDocumentForApproval(
            businessId,
            'procurement-requisition',
            'Procurement & Purchase',
            'Purchase Requisition',
            'purchase_requisitions',
            docRef.id,
            `Purchase Requisition ${reqNo.trim()} (${department}) - ${reqItems.length} item(s)`,
            userProfile,
            checkResult,
            reqTotalAmount,
            'BDT',
            selectedApproverUser
          );
          const approverLabel = selectedApproverUser?.displayName || checkResult.approverName || 'Designated Approver';
          showToast(`Purchase Requisition ${reqNo} submitted! Sent to ${approverLabel} for approval.`, 'success');
        } else {
          showToast(`Purchase Requisition ${reqNo} created & approved directly.`, 'success');
        }
      }

      setIsReqModalOpen(false);
    } catch (err: any) {
      console.error('Error saving requisition:', err);
      showToast(err.message || 'Failed to save requisition', 'error');
    } finally {
      setIsSubmittingReq(false);
    }
  };

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

  const triggerApproveRequisition = (req: PurchaseRequisition) => {
    const totalItems = req.items?.length || 0;
    setConfirmModal({
      isOpen: true,
      title: 'Approve Purchase Requisition',
      message: `Are you sure you want to approve Purchase Requisition #${req.reqNo}?`,
      subMessage: `Department: ${req.department || 'General'} • Items: ${totalItems} item(s) • Requestor: ${req.requestorName || 'N/A'}`,
      variant: 'approve',
      confirmText: 'Yes, Approve Requisition',
      onConfirm: async () => {
        await handleApproveRequisition(req);
      }
    });
  };

  const triggerRejectRequisition = (req: PurchaseRequisition) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Purchase Requisition',
      message: `Are you sure you want to reject Purchase Requisition #${req.reqNo}?`,
      subMessage: `Department: ${req.department || 'General'} • Requested By: ${req.requestorName || 'User'}`,
      variant: 'reject',
      confirmText: 'Yes, Reject Requisition',
      showReasonInput: true,
      onConfirm: async (reason) => {
        await handleRejectRequisition(req, reason);
      }
    });
  };

  // Approval & Rejection Handlers
  const handleApproveRequisition = async (req: PurchaseRequisition) => {
    try {
      await updateDoc(doc(db, 'purchase_requisitions', req.id), {
        status: 'approved',
        approvedBy: userProfile.displayName || userProfile.name || userProfile.email || 'Admin',
        approvedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Synchronize linked approvalRequests
      try {
        const q = query(
          collection(db, 'approvalRequests'),
          where('targetId', '==', req.id),
          where('status', '==', 'pending')
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'approvalRequests', d.id), {
            status: 'approved',
            approvedAt: Timestamp.now(),
            approvedBy: userProfile.displayName || userProfile.email || 'Admin',
            approvalComment: 'Approved via Procurement Portal'
          });
        }
      } catch (e) {
        console.warn('Could not sync approvalRequests on requisition approve', e);
      }

      showToast(`Purchase Requisition ${req.reqNo} has been APPROVED!`, 'success');
      if (selectedReqForView?.id === req.id) {
        setSelectedReqForView(prev => prev ? { ...prev, status: 'approved', approvedBy: userProfile.displayName || 'Admin' } : null);
      }
    } catch (err: any) {
      console.error('Error approving requisition:', err);
      showToast(err.message || 'Failed to approve', 'error');
    }
  };

  const handleRejectRequisition = async (req: PurchaseRequisition, customReason?: string) => {
    const reason = customReason || 'Rejected by approver';

    try {
      await updateDoc(doc(db, 'purchase_requisitions', req.id), {
        status: 'rejected',
        approvalRemarks: reason || 'Rejected by approver',
        rejectionReason: reason || 'Rejected by approver',
        approvedBy: userProfile.displayName || userProfile.name || userProfile.email || 'Admin',
        approvedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Synchronize linked approvalRequests
      try {
        const q = query(
          collection(db, 'approvalRequests'),
          where('targetId', '==', req.id),
          where('status', '==', 'pending')
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'approvalRequests', d.id), {
            status: 'rejected',
            rejectedAt: Timestamp.now(),
            rejectedBy: userProfile.displayName || userProfile.email || 'Admin',
            rejectionReason: reason || 'Rejected'
          });
        }
      } catch (e) {
        console.warn('Could not sync approvalRequests on requisition reject', e);
      }

      showToast(`Purchase Requisition ${req.reqNo} has been REJECTED`, 'info');
      if (selectedReqForView?.id === req.id) {
        setSelectedReqForView(prev => prev ? { ...prev, status: 'rejected', approvalRemarks: reason } : null);
      }
    } catch (err: any) {
      console.error('Error rejecting requisition:', err);
      showToast(err.message || 'Failed to reject', 'error');
    }
  };

  const handleDeleteRequisition = async (req: PurchaseRequisition) => {
    if (!canDeleteRequisition) {
      showToast('Permission Denied: You do not have permission to delete purchase requisitions.', 'error');
      return;
    }
    if (!isSuperAdmin && req.status !== 'pending') {
      showToast('Only pending requisitions can be deleted', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete requisition ${req.reqNo}?`)) return;

    try {
      await deleteDoc(doc(db, 'purchase_requisitions', req.id));
      showToast(`Requisition ${req.reqNo} deleted successfully`);
      if (selectedReqForView?.id === req.id) {
        setSelectedReqForView(null);
      }
    } catch (err: any) {
      console.error('Error deleting requisition:', err);
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  // Convert Approved Requisition to Purchase Order
  const [selectedReqForPOConversion, setSelectedReqForPOConversion] = useState<PurchaseRequisition | null>(null);

  const handleCreatePOFromRequisition = (req: PurchaseRequisition) => {
    if (req.status !== 'approved' && req.status !== 'partially_ordered') {
      showToast('Only approved requisitions can be converted into Purchase Orders', 'error');
      return;
    }
    setSelectedReqForPOConversion(req);
    setActiveTab('purchases');
  };

  // Filter & Search Requisitions List
  const [reqFilterStatus, setReqFilterStatus] = useState<string>('all');
  const [reqSearchQuery, setReqSearchQuery] = useState('');

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(r => {
      if (reqFilterStatus !== 'all' && r.status !== reqFilterStatus) return false;
      if (reqSearchQuery.trim()) {
        const q = reqSearchQuery.toLowerCase();
        const matchesNo = (r.reqNo || '').toLowerCase().includes(q);
        const matchesRequestor = (r.requestorName || '').toLowerCase().includes(q);
        const matchesDept = (r.department || '').toLowerCase().includes(q);
        const matchesPurpose = (r.purpose || '').toLowerCase().includes(q);
        const matchesItem = r.items?.some(it => (it.itemName || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q));
        if (!matchesNo && !matchesRequestor && !matchesDept && !matchesPurpose && !matchesItem) return false;
      }
      return true;
    });
  }, [requisitions, reqFilterStatus, reqSearchQuery]);

  // Summary Metrics for Requisitions
  const reqStats = useMemo(() => {
    const total = requisitions.length;
    const pending = requisitions.filter(r => r.status === 'pending').length;
    const approved = requisitions.filter(r => r.status === 'approved').length;
    const ordered = requisitions.filter(r => r.status === 'ordered' || r.status === 'partially_ordered').length;
    const totalEstValue = requisitions.reduce((s, r) => s + (r.totalAmount || 0), 0);

    return { total, pending, approved, ordered, totalEstValue };
  }, [requisitions]);

  return (
    <div className="space-y-6">
      {/* Header Navigation Tabs */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900">Procurement & Purchase</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60">
                  Procurement Portal
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Purchase Requisitions with Previous Rate Lookup, Approvals, PO Generation, and Supplier Material Receipts
              </p>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100/80 rounded-xl overflow-x-auto border border-neutral-200/60">
            {canAccessReq && (
              <button
                type="button"
                onClick={() => handleTabSwitch('requisitions')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'requisitions'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
                }`}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Purchase Requisition</span>
                {reqStats.pending > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {reqStats.pending}
                  </span>
                )}
              </button>
            )}

            {canAccessPo && (
              <button
                type="button"
                onClick={() => handleTabSwitch('purchases')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'purchases'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Purchase Orders (PO)</span>
              </button>
            )}

            {canAccessSuppliers && (
              <button
                type="button"
                onClick={() => handleTabSwitch('suppliers')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'suppliers'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Supplier Master</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TAB 1: PURCHASE REQUISITION */}
      {activeTab === 'requisitions' && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm">
              <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
                <span>Total Requisitions</span>
                <FileText className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-neutral-900">{reqStats.total}</div>
              <div className="text-[11px] text-neutral-400 mt-1">All submitted requisitions</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
              <div className="flex items-center justify-between text-amber-700 text-xs font-medium mb-1">
                <span>Pending Approval</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-900">{reqStats.pending}</div>
              <div className="text-[11px] text-amber-600 mt-1">Awaiting approval action</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
              <div className="flex items-center justify-between text-emerald-700 text-xs font-medium mb-1">
                <span>Approved</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-900">{reqStats.approved}</div>
              <div className="text-[11px] text-emerald-600 mt-1">Ready for Purchase Order</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm">
              <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
                <span>Estimated Value</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-600">৳{reqStats.totalEstValue.toLocaleString()}</div>
              <div className="text-[11px] text-neutral-400 mt-1">Total estimated cost</div>
            </div>
          </div>

          {/* Action Bar & Filters */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search REQ No, Requestor, Dept, Material..."
                  value={reqSearchQuery}
                  onChange={(e) => setReqSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 font-medium placeholder:text-neutral-400"
                />
                {reqSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setReqSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'ordered', label: 'PO Created' },
                  { id: 'rejected', label: 'Rejected' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setReqFilterStatus(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      reqFilterStatus === s.id
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Create Requisition Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenNewReqModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Purchase Requisition</span>
              </button>
            </div>
          </div>

          {/* Requisitions Table */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Req No & Date</th>
                    <th className="py-3.5 px-4">Department / Requestor</th>
                    <th className="py-3.5 px-4">Materials / Items</th>
                    <th className="py-3.5 px-4 text-center">Total Qty</th>
                    <th className="py-3.5 px-4 text-right">Est. Amount (BDT)</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                  {isReqLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Loading purchase requisitions...
                      </td>
                    </tr>
                  ) : filteredRequisitions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-400">
                        <FileCheck2 className="w-10 h-10 mx-auto mb-2 text-neutral-300 stroke-[1.5]" />
                        <div className="font-semibold text-neutral-600">No Purchase Requisitions Found</div>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Click "Create Purchase Requisition" above to raise a raw material purchase request</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequisitions.map((req) => {
                      const isPending = req.status === 'pending';
                      const isApproved = req.status === 'approved';
                      const isRejected = req.status === 'rejected';
                      const isOrdered = req.status === 'ordered' || req.status === 'partially_ordered';

                      return (
                        <tr key={req.id} className="hover:bg-neutral-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                              <span>{req.reqNo}</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-neutral-400" />
                              <span>{req.date}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-neutral-900">{req.department || 'Store'}</div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">
                              Req by: <span className="font-medium text-neutral-700">{req.requestorName || 'User'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="space-y-1">
                              {req.items?.slice(0, 2).map((it, idx) => (
                                <div key={idx} className="text-xs truncate flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                  <span className="font-medium text-neutral-800 truncate">{it.itemName}</span>
                                  <span className="text-[11px] text-neutral-400 font-mono">({it.quantity} {it.unit})</span>
                                </div>
                              ))}
                              {req.items && req.items.length > 2 && (
                                <span className="text-[10px] font-bold text-indigo-600">
                                  +{req.items.length - 2} more item(s)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-bold font-mono text-neutral-800">
                            {req.totalQty?.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold font-mono text-neutral-900">
                            ৳{(req.totalAmount || 0).toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                                <Clock className="w-3 h-3" />
                                <span>Pending Approval</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved</span>
                              </span>
                            )}
                            {isOrdered && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                                <ShoppingBag className="w-3 h-3" />
                                <span>PO Created</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                                <XCircle className="w-3 h-3" />
                                <span>Rejected</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View / Print Detail */}
                              <button
                                type="button"
                                onClick={() => setSelectedReqForView(req)}
                                title="View Details"
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedReqForPrint(req)}
                                title="Print Requisition Voucher"
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Approvals Action for Authorized Users */}
                              {isPending && canApprove && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => triggerApproveRequisition(req)}
                                    title="Approve Requisition"
                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => triggerRejectRequisition(req)}
                                    title="Reject Requisition"
                                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {/* Create Purchase Order (PO) from Approved Requisition */}
                              {isApproved && (
                                <button
                                  type="button"
                                  onClick={() => handleCreatePOFromRequisition(req)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all"
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                  <span>Create PO</span>
                                </button>
                              )}

                              {/* Edit / Delete */}
                              {isPending && (
                                <>
                                  {canEditRequisition && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditReqModal(req)}
                                      title="Edit Requisition"
                                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canDeleteRequisition && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRequisition(req)}
                                      title="Delete Requisition"
                                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
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

      {/* TAB 2 & 3: PURCHASES & SUPPLIERS & MRR */}
      {activeTab !== 'requisitions' && (
        <SuppliersAndPurchase
          userProfile={userProfile}
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          supplierPayments={[]}
          items={items}
          showToast={showToast}
          recalculateItemStock={recalculateItemStock}
          fetchFullHistory={fetchFullHistory}
          syncAllData={syncAllData}
          isEditor={isEditor}
          initialTab={
            activeTab === 'purchases' ? 'purchases' :
            activeTab === 'suppliers' ? 'suppliers' :
            'report'
          }
          roles={roles}
          allowedPagesSet={allowedPagesSet}
          selectedSupplierIdFromParent={null}
          requisitions={requisitions}
          selectedReqForPOConversion={selectedReqForPOConversion}
          onClearSelectedReqForPO={() => setSelectedReqForPOConversion(null)}
          onSwitchToRequisitions={() => handleTabSwitch('requisitions')}
        />
      )}

      {/* CREATE / EDIT REQUISITION MODAL */}
      {isReqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-neutral-100 overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {editingReq ? 'Edit Purchase Requisition' : 'Create Purchase Requisition'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Select raw materials, previous purchase prices will be populated automatically
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReqModalOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Header Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Requisition No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reqNo}
                    onChange={(e) => setReqNo(e.target.value)}
                    placeholder="REQ-2026-000001"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Requisition Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Required By Date
                  </label>
                  <input
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Store">Store / Inventory</option>
                    <option value="Production">Production</option>
                    <option value="Cutting">Cutting</option>
                    <option value="Sewing">Sewing</option>
                    <option value="Finishing">Finishing</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="General">General Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Requestor Name
                  </label>
                  <input
                    type="text"
                    value={requestorName}
                    onChange={(e) => setRequestorName(e.target.value)}
                    placeholder="Requestor name"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Purpose / Job / Order Reference
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Raw materials for Order #WO-902, Monthly Store replenishment..."
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Raw Materials Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                      Raw Materials / Items List ({reqItems.length})
                    </h4>
                    <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                      Rates auto-populated from previous POs
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddReqItemRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* Items Table */}
                <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-bold text-neutral-600">
                          <th className="py-2.5 px-3 w-8">#</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Raw Material / Item</th>
                          <th className="py-2.5 px-3 w-24 text-center">Stock</th>
                          <th className="py-2.5 px-3 w-28 text-center">Req Qty</th>
                          <th className="py-2.5 px-3 w-20 text-center">Unit</th>
                          <th className="py-2.5 px-3 w-32 text-right">Unit Price (৳)</th>
                          <th className="py-2.5 px-3 w-32 text-right">Amount (৳)</th>
                          <th className="py-2.5 px-3 w-36">Remarks</th>
                          <th className="py-2.5 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-xs">
                        {reqItems.map((row, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Item Selector */}
                            <td className="py-2 px-3">
                              <select
                                value={row.itemId}
                                onChange={(e) => handleItemSelect(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">-- Select Material / Item --</option>
                                {items.map(it => (
                                  <option key={it.id} value={it.id}>
                                    {it.name} {it.sku ? `(${it.sku})` : ''} - Stock: {it.currentStock || (it as any).quantity || 0} {it.unit || 'Pcs'}
                                  </option>
                                ))}
                              </select>
                              {row.priceSource && (
                                <div className="text-[10px] text-indigo-600 font-medium mt-0.5 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{row.priceSource}</span>
                                </div>
                              )}
                            </td>

                            {/* Stock Display */}
                            <td className="py-2 px-3 text-center font-mono font-semibold text-neutral-600">
                              {row.currentStock || 0}
                            </td>

                            {/* Quantity */}
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={row.quantity || ''}
                                onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                                placeholder="Qty"
                                className="w-full px-2 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-bold text-center text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                              />
                            </td>

                            {/* Unit */}
                            <td className="py-2 px-3 text-center text-neutral-600 font-medium text-[11px]">
                              {row.unit || 'Pcs'}
                            </td>

                            {/* Unit Price (Auto previous price or editable manual) */}
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.unitPrice || ''}
                                onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full px-2 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-bold text-right text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                              />
                            </td>

                            {/* Line Total */}
                            <td className="py-2 px-3 text-right font-bold font-mono text-neutral-900">
                              ৳{(row.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Remarks */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.remarks || ''}
                                onChange={(e) => handleItemRemarkChange(idx, e.target.value)}
                                placeholder="Spec / note"
                                className="w-full px-2 py-1 bg-white border border-neutral-200 rounded-lg text-[11px] text-neutral-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>

                            {/* Delete */}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveReqItemRow(idx)}
                                className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Bottom Totals Bar */}
                  <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-neutral-500">
                      Total Items: <span className="font-bold text-neutral-900">{reqItems.length}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-xs">
                        <span className="text-neutral-500 mr-2">Total Quantity:</span>
                        <span className="font-bold font-mono text-neutral-900 text-sm">
                          {reqTotalQty.toLocaleString()}
                        </span>
                      </div>

                      <div className="text-xs">
                        <span className="text-neutral-500 mr-2">Total Estimated Price:</span>
                        <span className="font-bold font-mono text-indigo-600 text-base">
                          ৳{reqTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* General Remarks */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  General Remarks / Instructions
                </label>
                <textarea
                  rows={2}
                  value={reqRemarks}
                  onChange={(e) => setReqRemarks(e.target.value)}
                  placeholder="Additional notes for procurement and approving authority..."
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Approver Selection */}
              <div className="pt-1">
                <ApproverSelector
                  businessId={businessId}
                  selectedUid={selectedApproverUser?.uid}
                  selectedEmail={selectedApproverUser?.email}
                  selectedName={selectedApproverUser?.displayName}
                  isApprovalRequired={reqApprovalRequired}
                  pageName="Purchase Requisition"
                  onSelectApprover={setSelectedApproverUser}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsReqModalOpen(false)}
                className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingReq}
                onClick={handleSaveRequisition}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                {isSubmittingReq ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm & Submit for Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW REQUISITION DETAILS MODAL */}
      {selectedReqForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-neutral-100 overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Requisition Details: {selectedReqForView.reqNo}
                  </h3>
                  <p className="text-xs text-neutral-500">Date: {selectedReqForView.date}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReqForView(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 text-xs">
                <div>
                  <div className="text-neutral-400">Department</div>
                  <div className="font-bold text-neutral-900 mt-0.5">{selectedReqForView.department || 'Store'}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Requestor</div>
                  <div className="font-bold text-neutral-900 mt-0.5">{selectedReqForView.requestorName || 'User'}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Required Date</div>
                  <div className="font-bold text-neutral-900 mt-0.5">{selectedReqForView.requiredDate || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Status</div>
                  <div className="mt-0.5">
                    {selectedReqForView.status === 'approved' && (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                        Approved
                      </span>
                    )}
                    {selectedReqForView.status === 'pending' && (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                        Pending Approval
                      </span>
                    )}
                    {selectedReqForView.status === 'rejected' && (
                      <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-full text-[10px]">
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedReqForView.purpose && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                  <span className="font-bold">Purpose / Ref: </span>{selectedReqForView.purpose}
                </div>
              )}

              {/* Items List */}
              <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-[11px] font-bold text-neutral-500 border-b border-neutral-200">
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3 text-center">Stock</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {selectedReqForView.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">
                          {it.itemName}
                          {it.sku && <span className="text-[10px] text-neutral-400 block font-mono">{it.sku}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">{it.currentStock || 0}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-neutral-900 font-mono">{it.quantity} {it.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-neutral-700">৳{(it.unitPrice || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-neutral-900">৳{(it.totalAmount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-50 font-bold border-t border-neutral-200">
                      <td colSpan={2} className="py-2.5 px-3 text-neutral-600">Total</td>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-900">{selectedReqForView.totalQty}</td>
                      <td></td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-600 text-sm">
                        ৳{(selectedReqForView.totalAmount || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedReqForPrint(selectedReqForView)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 rounded-xl text-xs font-bold transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedReqForView.status === 'pending' && canApprove && (
                  <>
                    <button
                      type="button"
                      onClick={() => selectedReqForView && triggerRejectRequisition(selectedReqForView)}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedReqForView && triggerApproveRequisition(selectedReqForView)}
                      className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Requisition</span>
                    </button>
                  </>
                )}

                {selectedReqForView.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => handleCreatePOFromRequisition(selectedReqForView)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Create Purchase Order</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE REQUISITION VOUCHER MODAL */}
      {selectedReqForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-neutral-100 overflow-hidden my-8 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between print:hidden">
              <div className="font-bold text-xs text-neutral-700 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Print Preview — Requisition Voucher</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printElement('printable-procurement-req', { title: `Requisition_${selectedReqForPrint?.reqNo || 'Doc'}` })}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReqForPrint(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Document */}
            <div id="printable-procurement-req" className="printable-doc p-8 space-y-6 text-neutral-900 font-sans bg-white print:p-0">
              {/* Header */}
              <div className="text-center border-b-2 border-neutral-900 pb-4">
                <h1 className="text-2xl font-black tracking-wider uppercase">ES TRIMS LIMITED</h1>
                <p className="text-xs text-neutral-600 font-medium mt-0.5">
                  100% Export Oriented Garments Accessories & Packaging Industry
                </p>
                <div className="inline-block mt-2 px-4 py-1 bg-neutral-900 text-white rounded-md text-xs font-bold tracking-wider uppercase">
                  PURCHASE REQUISITION VOUCHER
                </div>
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-neutral-300 p-3 rounded-lg">
                <div>
                  <div><span className="font-bold text-neutral-700">Requisition No:</span> <span className="font-mono font-bold text-neutral-900">{selectedReqForPrint.reqNo}</span></div>
                  <div><span className="font-bold text-neutral-700">Department:</span> {selectedReqForPrint.department || 'Store'}</div>
                  <div><span className="font-bold text-neutral-700">Requestor:</span> {selectedReqForPrint.requestorName || 'User'}</div>
                </div>
                <div className="text-right">
                  <div><span className="font-bold text-neutral-700">Date:</span> {selectedReqForPrint.date}</div>
                  <div><span className="font-bold text-neutral-700">Required Date:</span> {selectedReqForPrint.requiredDate || 'Immediate'}</div>
                  <div><span className="font-bold text-neutral-700">Status:</span> <span className="uppercase font-bold">{selectedReqForPrint.status}</span></div>
                </div>
              </div>

              {selectedReqForPrint.purpose && (
                <div className="text-xs border-l-4 border-neutral-900 pl-3 py-1 bg-neutral-50">
                  <span className="font-bold">Purpose: </span>{selectedReqForPrint.purpose}
                </div>
              )}

              {/* Items Table */}
              <table className="w-full border-collapse border border-neutral-900 text-xs">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-900 font-bold">
                    <th className="border border-neutral-900 py-2 px-2 text-center w-8">SL</th>
                    <th className="border border-neutral-900 py-2 px-3 text-left">Item Description</th>
                    <th className="border border-neutral-900 py-2 px-2 text-center w-20">Stock</th>
                    <th className="border border-neutral-900 py-2 px-2 text-center w-24">Req Qty</th>
                    <th className="border border-neutral-900 py-2 px-2 text-center w-16">Unit</th>
                    <th className="border border-neutral-900 py-2 px-3 text-right w-28">Est. Rate (৳)</th>
                    <th className="border border-neutral-900 py-2 px-3 text-right w-28">Amount (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReqForPrint.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="border border-neutral-900 py-2 px-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-neutral-900 py-2 px-3 font-semibold">
                        {it.itemName}
                        {it.remarks && <div className="text-[10px] text-neutral-500 italic">{it.remarks}</div>}
                      </td>
                      <td className="border border-neutral-900 py-2 px-2 text-center font-mono">{it.currentStock || 0}</td>
                      <td className="border border-neutral-900 py-2 px-2 text-center font-bold font-mono">{it.quantity}</td>
                      <td className="border border-neutral-900 py-2 px-2 text-center">{it.unit || 'Pcs'}</td>
                      <td className="border border-neutral-900 py-2 px-3 text-right font-mono">{(it.unitPrice || 0).toFixed(2)}</td>
                      <td className="border border-neutral-900 py-2 px-3 text-right font-bold font-mono">{(it.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-100 font-bold border-t-2 border-neutral-900">
                    <td colSpan={3} className="border border-neutral-900 py-2 px-3 text-right uppercase">Total:</td>
                    <td className="border border-neutral-900 py-2 px-2 text-center font-mono">{selectedReqForPrint.totalQty}</td>
                    <td className="border border-neutral-900"></td>
                    <td className="border border-neutral-900"></td>
                    <td className="border border-neutral-900 py-2 px-3 text-right font-mono text-sm">
                      ৳{(selectedReqForPrint.totalAmount || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Signature Blocks */}
              <div className="grid grid-cols-4 gap-4 pt-16 text-center text-xs">
                <div className="border-t border-neutral-900 pt-2">
                  <div className="font-bold">{selectedReqForPrint.requestorName || 'Prepared By'}</div>
                  <div className="text-[10px] text-neutral-500">Prepared By</div>
                </div>
                <div className="border-t border-neutral-900 pt-2">
                  <div className="font-bold">Dept Head</div>
                  <div className="text-[10px] text-neutral-500">Checked By</div>
                </div>
                <div className="border-t border-neutral-900 pt-2">
                  <div className="font-bold">Procurement</div>
                  <div className="text-[10px] text-neutral-500">Verified By</div>
                </div>
                <div className="border-t border-neutral-900 pt-2">
                  <div className="font-bold">{selectedReqForPrint.approvedBy || 'Managing Director'}</div>
                  <div className="text-[10px] text-neutral-500">Approved By</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
