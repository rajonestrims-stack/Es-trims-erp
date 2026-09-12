import React, { useState, useEffect, useMemo } from 'react';
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
  setDoc,
  getDocs
} from 'firebase/firestore';
import { 
  Factory, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Play, 
  Pause, 
  CheckSquare, 
  Search, 
  Plus, 
  Eye, 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  Layers, 
  Package, 
  User as UserIcon, 
  Settings, 
  ChevronRight, 
  TrendingUp, 
  ArrowRight, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Calendar, 
  Building2, 
  Users, 
  Sliders, 
  PieChart as PieChartIcon, 
  Send,
  Check,
  ArrowLeftRight,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { printElement } from '../utils/printHelper';
import { format } from 'date-fns';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { ConfirmModal, ConfirmVariant } from './ui/ConfirmModal';
import { 
  WorkOrder, 
  Item, 
  UserProfile, 
  BomMaster, 
  BomItem, 
  ProductionProcessExecution, 
  ProductionTransactionRecord, 
  ProductionRequisitionRecord, 
  ProductionRequisitionItem, 
  DeliveryChallanRecord, 
  FinishedGoods,
  ProductionProcessMaster,
  SectionMaster,
  RoleDefinition 
} from '../types';

interface ProductionManagementProps {
  userProfile: UserProfile;
  items: Item[];
  finishedGoodsList?: FinishedGoods[];
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  activeSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
  onNavigateToDespatch?: (woNumber?: string) => void;
  recalculateItemStock?: (itemId: string, businessId: string) => Promise<void>;
  allowedPagesSet?: Set<string>;
  roles?: RoleDefinition[];
}

export function ProductionManagement({
  userProfile,
  items,
  finishedGoodsList = [],
  showToast,
  activeSubTab = 'production-dashboard',
  onSubTabChange,
  onNavigateToDespatch,
  recalculateItemStock,
  allowedPagesSet,
  roles = []
}: ProductionManagementProps) {
  const isSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com';
  const isViewer = userProfile.role === 'viewer';

  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  const allTabDefinitions = [
    { id: 'production-dashboard', label: 'Dashboard', icon: BarChart3, checkId: 'production-dashboard' },
    { id: 'production-process-master', label: 'Process Master', icon: Activity, checkId: 'production-process-master' },
    { id: 'production-update', label: 'Production Update', icon: RefreshCw, checkId: 'production-update' },
    { id: 'production-bom', label: 'BOM Create', icon: Layers, checkId: 'production-bom' },
    { id: 'production-status', label: 'Production Status', icon: PieChartIcon, checkId: 'production-status' },
    { id: 'production-details', label: 'WO Details', icon: FileText, checkId: 'production-details' },
    { id: 'production-requisition', label: 'Requisition', icon: Send, checkId: 'production-requisition' },
  ];

  const availableTabs = useMemo(() => {
    return allTabDefinitions.filter(tab => isPagePermitted(tab.checkId)).map(t => t.id);
  }, [isSuperAdmin, allowedPagesSet]);

  const [subTab, setSubTab] = useState<string>(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeSubTab)) {
      return availableTabs[0];
    }
    return activeSubTab;
  });

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeSubTab)) {
      setSubTab(availableTabs[0]);
    } else if (activeSubTab) {
      setSubTab(activeSubTab);
    }
  }, [activeSubTab, availableTabs]);

  const handleTabChange = (tab: string) => {
    setSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  // State collections
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [processExecutions, setProcessExecutions] = useState<ProductionProcessExecution[]>([]);
  const [transactions, setTransactions] = useState<ProductionTransactionRecord[]>([]);
  const [boms, setBoms] = useState<BomMaster[]>([]);
  const [requisitions, setRequisitions] = useState<ProductionRequisitionRecord[]>([]);
  const [challans, setChallans] = useState<DeliveryChallanRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected state for detail / status views
  const [selectedWoId, setSelectedWoId] = useState<string>('');
  const [filterCardType, setFilterCardType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Requisition list filter & search state
  const [reqStatusFilter, setReqStatusFilter] = useState<'all' | 'pending' | 'issued' | 'rejected'>('all');
  const [reqSearchQuery, setReqSearchQuery] = useState<string>('');

  // Printable Report Modal State
  const [showPrintReportModal, setShowPrintReportModal] = useState<boolean>(false);
  const [printWo, setPrintWo] = useState<WorkOrder | null>(null);

  // BOM Form State
  const [showBomModal, setShowBomModal] = useState<boolean>(false);
  const [editingBom, setEditingBom] = useState<BomMaster | null>(null);
  const [bomNo, setBomNo] = useState<string>('');
  const [bomProductId, setBomProductId] = useState<string>('');
  const [bomProductName, setBomProductName] = useState<string>('');
  const [bomProductCode, setBomProductCode] = useState<string>('');
  const [bomVersion, setBomVersion] = useState<string>('1.0');
  const [bomEffectiveDate, setBomEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bomUnit, setBomUnit] = useState<string>('Pcs');
  const [bomUps, setBomUps] = useState<number | string>(1);
  const [bomSheetItemId, setBomSheetItemId] = useState<string>('');
  const [bomWastagePercent, setBomWastagePercent] = useState<number | string>(2);
  const [bomRemarks, setBomRemarks] = useState<string>('');
  const [bomItems, setBomItems] = useState<BomItem[]>([]);

  // Requisition Form State
  const [showReqModal, setShowReqModal] = useState<boolean>(false);
  const [reqWoId, setReqWoId] = useState<string>('');
  const [reqStore, setReqStore] = useState<string>('Main Store');
  const [reqBaseSheets, setReqBaseSheets] = useState<number>(0);
  const [reqExtraSheets, setReqExtraSheets] = useState<number | string>(0);
  const [reqExtraRemarks, setReqExtraRemarks] = useState<string>('');
  const [reqRemarks, setReqRemarks] = useState<string>('');
  const [reqItems, setReqItems] = useState<ProductionRequisitionItem[]>([]);
  const [reqSelectedBom, setReqSelectedBom] = useState<BomMaster | null>(null);
  const [selectedReqForPrint, setSelectedReqForPrint] = useState<ProductionRequisitionRecord | null>(null);
  const [isPrintSlipModalOpen, setIsPrintSlipModalOpen] = useState<boolean>(false);
  const [isConfirmingReqId, setIsConfirmingReqId] = useState<string | null>(null);

  // Production Update Entry State
  const [updateWoId, setUpdateWoId] = useState<string>('');
  const [updatingProcess, setUpdatingProcess] = useState<ProductionProcessExecution | null>(null);
  const [updateMode, setUpdateMode] = useState<'add' | 'set'>('add');
  const [inputCompletedQty, setInputCompletedQty] = useState<number>(0);
  const [inputRejectQty, setInputRejectQty] = useState<number>(0);
  const [inputEmployee, setInputEmployee] = useState<string>('');
  const [inputMachine, setInputMachine] = useState<string>('');
  const [inputRemarks, setInputRemarks] = useState<string>('');

  const bId = userProfile.businessId;

  // Process Master States
  const [productionProcesses, setProductionProcesses] = useState<ProductionProcessMaster[]>([]);
  const [sections, setSections] = useState<SectionMaster[]>([]);
  const [selectedProcessSectionFilter, setSelectedProcessSectionFilter] = useState<string>('');
  const [processSearchTerm, setProcessSearchTerm] = useState<string>('');
  const [showAddProcessModal, setShowAddProcessModal] = useState<boolean>(false);
  const [editingProcess, setEditingProcess] = useState<ProductionProcessMaster | null>(null);
  const [newProcessSectionId, setNewProcessSectionId] = useState<string>('');
  const [newProcessCode, setNewProcessCode] = useState<string>('');
  const [newProcessName, setNewProcessName] = useState<string>('');
  const [newProcessSeq, setNewProcessSeq] = useState<number | ''>(1);
  const [newProcessDesc, setNewProcessDesc] = useState<string>('');

  // Realtime Listeners
  const [finishedGoods, setFinishedGoods] = useState<FinishedGoods[]>(finishedGoodsList || []);
  const [fgSearchQuery, setFgSearchQuery] = useState<string>('');
  const [isFgDropdownOpen, setIsFgDropdownOpen] = useState<boolean>(false);
  const [existingBomWarning, setExistingBomWarning] = useState<BomMaster | null>(null);

  useEffect(() => {
    if (!bId) return;
    setIsLoading(true);

    // Finished Goods listener
    const qFg = query(collection(db, 'finished_goods'), where('businessId', '==', bId));
    const unsubFg = onSnapshot(qFg, (snap) => {
      const fgList = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinishedGoods));
      setFinishedGoods(fgList.length > 0 ? fgList : finishedGoodsList || []);
    }, (err) => console.warn('FG Listener error:', err));

    // Listen to Sections
    const qSec = query(collection(db, 'sections'), where('businessId', '==', bId));
    const unsubSec = onSnapshot(qSec, (snap) => {
      setSections(snap.docs.map(d => ({ id: d.id, ...d.data() } as SectionMaster)));
    }, (err) => console.warn('Sections listener error:', err));

    // Listen to Production Processes
    const qProdProc = query(collection(db, 'production_processes'), where('businessId', '==', bId));
    const unsubProdProc = onSnapshot(qProdProc, (snap) => {
      setProductionProcesses(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionProcessMaster)));
    }, (err) => console.warn('Process Master listener error:', err));

    // 1. Listen to Work Orders (Confirmed or in progress)
    const qWo = query(
      collection(db, 'work_orders'),
      where('businessId', '==', bId)
    );
    const unsubWo = onSnapshot(qWo, (snap) => {
      const woList = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder));
      // Only confirmed/approved work orders are valid for Production
      const confirmedWoList = woList.filter(w => 
        w.status === 'confirmed' || 
        w.status === 'approved' || 
        w.status === 'in_production' || 
        w.status === 'completed'
      );
      setWorkOrders(confirmedWoList);
      setIsLoading(false);
    }, (err) => console.warn('WO Listener error:', err));

    // 2. Listen to Production Process Executions
    const qProc = query(collection(db, 'production_executions'), where('businessId', '==', bId));
    const unsubProc = onSnapshot(qProc, (snap) => {
      setProcessExecutions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionProcessExecution)));
    });

    // 3. Listen to Production Transactions
    const qTx = query(collection(db, 'production_transactions'), where('businessId', '==', bId));
    const unsubTx = onSnapshot(qTx, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionTransactionRecord)));
    });

    // 4. Listen to BOMs
    const qBom = query(collection(db, 'boms'), where('businessId', '==', bId));
    const unsubBom = onSnapshot(qBom, (snap) => {
      setBoms(snap.docs.map(d => ({ id: d.id, ...d.data() } as BomMaster)));
    });

    // 5. Listen to Production Requisitions
    const qReq = query(collection(db, 'production_requisitions'), where('businessId', '==', bId));
    const unsubReq = onSnapshot(qReq, (snap) => {
      setRequisitions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionRequisitionRecord)));
    });

    // 6. Listen to Delivery Challans for Despatch calculations
    const qDc = query(collection(db, 'delivery_challans'), where('businessId', '==', bId));
    const unsubDc = onSnapshot(qDc, (snap) => {
      setChallans(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryChallanRecord)));
    });

    return () => {
      unsubFg();
      unsubSec();
      unsubProdProc();
      unsubWo();
      unsubProc();
      unsubTx();
      unsubBom();
      unsubReq();
      unsubDc();
    };
  }, [bId]);

  // Filtered Production Processes for Process Master View
  const filteredProcesses = useMemo(() => {
    return productionProcesses.filter(p => {
      const matchSection = !selectedProcessSectionFilter || p.sectionId === selectedProcessSectionFilter;
      const search = (processSearchTerm || '').toLowerCase().trim();
      const matchSearch = !search || 
        (p.processName || '').toLowerCase().includes(search) ||
        (p.processCode || '').toLowerCase().includes(search) ||
        (p.sectionName || '').toLowerCase().includes(search);
      return matchSection && matchSearch;
    }).sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  }, [productionProcesses, selectedProcessSectionFilter, processSearchTerm]);

  const handleOpenAddProcessModal = (proc?: ProductionProcessMaster) => {
    if (proc) {
      setEditingProcess(proc);
      setNewProcessSectionId(proc.sectionId || '');
      setNewProcessCode(proc.processCode || '');
      setNewProcessName(proc.processName || '');
      setNewProcessSeq(proc.sequenceOrder || 1);
      setNewProcessDesc(proc.description || '');
    } else {
      setEditingProcess(null);
      setNewProcessSectionId(sections[0]?.id || '');
      const nextSeq = productionProcesses.length + 1;
      setNewProcessCode(`PROC-${String(nextSeq).padStart(2, '0')}`);
      setNewProcessName('');
      setNewProcessSeq(nextSeq);
      setNewProcessDesc('');
    }
    setShowAddProcessModal(true);
  };

  const handleSaveProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProcessName.trim() || !newProcessCode.trim()) {
      showToast('Please enter process name and code', 'error');
      return;
    }

    const sec = sections.find(s => s.id === newProcessSectionId);

    const payload = {
      sectionId: newProcessSectionId,
      sectionName: sec ? sec.name : '',
      processCode: newProcessCode.trim().toUpperCase(),
      processName: newProcessName.trim(),
      sequenceOrder: Number(newProcessSeq) || 1,
      description: newProcessDesc.trim(),
      businessId: bId,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProcess) {
        await updateDoc(doc(db, 'production_processes', editingProcess.id), payload);
        showToast('Production process updated successfully', 'success');
      } else {
        await addDoc(collection(db, 'production_processes'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        showToast('Production process created successfully', 'success');
      }
      setShowAddProcessModal(false);
      setEditingProcess(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to save process', 'error');
    }
  };

  const handleDeleteProcess = async (procId: string) => {
    if (!confirm('Are you sure you want to delete this production process?')) return;
    try {
      await deleteDoc(doc(db, 'production_processes', procId));
      showToast('Production process deleted successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete process', 'error');
    }
  };

  // Helper calculation per Work Order
  const getWoProductionStats = (wo: WorkOrder) => {
    // Determine baseline required processes for this WO (ONLY ACTIVE / SELECTED ONES)
    const rawSelected = wo.selectedProcesses && wo.selectedProcesses.length > 0
      ? wo.selectedProcesses.filter(p => p.isIncluded !== false)
      : [];

    const processMasterList = rawSelected.length > 0
      ? rawSelected
      : [
          { processCode: 'PROC-01', processName: 'Cutting', sequenceOrder: 1, isIncluded: true },
          { processCode: 'PROC-02', processName: 'Printing / Dyeing', sequenceOrder: 2, isIncluded: true },
          { processCode: 'PROC-03', processName: 'Assembly / Sewing', sequenceOrder: 3, isIncluded: true },
          { processCode: 'PROC-04', processName: 'Finishing & Packaging', sequenceOrder: 4, isIncluded: true }
        ];

    const allowedProcessNames = new Set(processMasterList.map(p => p.processName));

    const woProcs = processExecutions
      .filter(p => (p.woId === wo.id || p.woNumber === wo.woNumber) && (allowedProcessNames.size === 0 || allowedProcessNames.has(p.processName)))
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    const orderQty = wo.totalQuantity || 0;

    const finalSeq = processMasterList.length;
    const finalProcName = processMasterList[finalSeq - 1]?.processName;
    const finalProcDoc = woProcs.find(p => p.sequenceOrder === finalSeq || p.processName === finalProcName);

    // Produced Qty is ONLY available from the FINAL completed process in sequence
    let producedQty = 0;
    if (finalProcDoc) {
      producedQty = finalProcDoc.completedQty || 0;
    } else if (wo.status === 'completed') {
      producedQty = orderQty;
    } else {
      producedQty = 0;
    }

    const balanceQty = Math.max(0, orderQty - producedQty);

    // Sum of rejects across all processes
    const totalRejectQty = woProcs.reduce((sum, p) => sum + (p.rejectQty || 0), 0);

    // Delivery stats
    const woChallans = challans.filter(c => (c.woId === wo.id || c.woNumber === wo.woNumber) && c.status === 'active');
    const deliveredQty = woChallans.reduce((sum, c) => sum + (c.currentDeliveryQty || 0), 0);

    const readyForDelivery = Math.max(0, producedQty - deliveredQty);
    const deliveryBalance = Math.max(0, orderQty - deliveredQty);

    // Current active process
    let currentProcessName = 'Not Started';
    let progressPercent = 0;

    if (woProcs.length > 0) {
      const activeProc = woProcs.find(p => p.status === 'Running' || p.status === 'Partially Completed') ||
        woProcs.find(p => p.status === 'Not Started') ||
        woProcs[woProcs.length - 1];

      currentProcessName = activeProc ? `${activeProc.processName} (${activeProc.status})` : 'Completed';

      const totalSteps = processMasterList.length;
      const completedStepsRatio = processMasterList.reduce((acc, masterP) => {
        const doc = woProcs.find(p => p.sequenceOrder === masterP.sequenceOrder || p.processName === masterP.processName);
        const stepRatio = (doc && orderQty > 0) ? Math.min(1, (doc.completedQty || 0) / orderQty) : 0;
        return acc + stepRatio;
      }, 0);
      progressPercent = Math.min(100, Math.round((completedStepsRatio / totalSteps) * 100));
    } else {
      progressPercent = 0;
    }

    // Status classifications
    let prodStatus: 'Pending' | 'Running' | 'Partially Completed' | 'Completed' = 'Pending';
    if (producedQty >= orderQty && orderQty > 0) {
      prodStatus = 'Completed';
    } else if (producedQty > 0 || woProcs.some(p => p.completedQty > 0 || p.status === 'Running')) {
      prodStatus = 'Partially Completed';
    } else if (woProcs.some(p => p.status === 'Running')) {
      prodStatus = 'Running';
    }

    let delivStatus: 'Pending Delivery' | 'Partially Delivered' | 'Fully Delivered' = 'Pending Delivery';
    if (deliveredQty >= orderQty && orderQty > 0) {
      delivStatus = 'Fully Delivered';
    } else if (deliveredQty > 0) {
      delivStatus = 'Partially Delivered';
    }

    return {
      orderQty,
      producedQty,
      balanceQty,
      totalRejectQty,
      deliveredQty,
      readyForDelivery,
      deliveryBalance,
      currentProcessName,
      progressPercent,
      prodStatus,
      delivStatus,
      woProcs
    };
  };

  // Overall Summary Metrics for Dashboard
  const summaryMetrics = useMemo(() => {
    let totalConfirmedWo = workOrders.length;
    let pendingProduction = 0;
    let runningProduction = 0;
    let partiallyCompleted = 0;
    let productionCompleted = 0;

    let totalOrderQty = 0;
    let totalProducedQty = 0;
    let totalBalanceQty = 0;

    let readyForDelivery = 0;
    let partiallyDelivered = 0;
    let fullyDelivered = 0;

    workOrders.forEach(wo => {
      const stats = getWoProductionStats(wo);

      totalOrderQty += stats.orderQty;
      totalProducedQty += stats.producedQty;
      totalBalanceQty += stats.balanceQty;
      readyForDelivery += stats.readyForDelivery;

      if (stats.prodStatus === 'Pending') pendingProduction++;
      else if (stats.prodStatus === 'Running') runningProduction++;
      else if (stats.prodStatus === 'Partially Completed') partiallyCompleted++;
      else if (stats.prodStatus === 'Completed') productionCompleted++;

      if (stats.delivStatus === 'Partially Delivered') partiallyDelivered++;
      else if (stats.delivStatus === 'Fully Delivered') fullyDelivered++;
    });

    return {
      totalConfirmedWo,
      pendingProduction,
      runningProduction,
      partiallyCompleted,
      productionCompleted,
      totalOrderQty,
      totalProducedQty,
      totalBalanceQty,
      readyForDelivery,
      partiallyDelivered,
      fullyDelivered
    };
  }, [workOrders, processExecutions, challans]);

  // Filtered Work Orders for Table View
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      const stats = getWoProductionStats(wo);
      const search = (searchQuery || '').toLowerCase().trim();
      const matchesSearch = 
        (wo.woNumber || '').toLowerCase().includes(search) ||
        (wo.customerName || '').toLowerCase().includes(search) ||
        (wo.finishedGoodsName || '').toLowerCase().includes(search) ||
        (wo.poNo || '').toLowerCase().includes(search);

      if (!matchesSearch) return false;

      if (filterCardType === 'pending') return stats.prodStatus === 'Pending';
      if (filterCardType === 'running') return stats.prodStatus === 'Running';
      if (filterCardType === 'partially_completed') return stats.prodStatus === 'Partially Completed';
      if (filterCardType === 'completed') return stats.prodStatus === 'Completed';
      if (filterCardType === 'ready_delivery') return stats.readyForDelivery > 0;
      if (filterCardType === 'partially_delivered') return stats.delivStatus === 'Partially Delivered';
      if (filterCardType === 'fully_delivered') return stats.delivStatus === 'Fully Delivered';

      return true;
    });
  }, [workOrders, searchQuery, filterCardType, processExecutions, challans]);

  // Selected WO for Status View
  const activeWo = useMemo(() => {
    if (!selectedWoId && workOrders.length > 0) return workOrders[0];
    return workOrders.find(w => w.id === selectedWoId || w.woNumber === selectedWoId) || workOrders[0] || null;
  }, [selectedWoId, workOrders]);

  const activeWoStats = useMemo(() => {
    if (!activeWo) return null;
    return getWoProductionStats(activeWo);
  }, [activeWo, processExecutions, challans]);

  // Handle selecting Work Order in Production Update
  const selectedUpdateWo = useMemo(() => {
    if (!updateWoId) return null;
    return workOrders.find(w => w.id === updateWoId || w.woNumber === updateWoId) || null;
  }, [updateWoId, workOrders]);

  // Handle auto-initializing or reading processes when selecting a WO in Production Update
  const updateWoProcesses = useMemo(() => {
    if (!selectedUpdateWo) return [];
    
    // Get all process executions saved in DB for this WO
    const savedProcs = processExecutions.filter(
      p => p.woId === selectedUpdateWo.id || p.woNumber === selectedUpdateWo.woNumber
    );

    // Determine the baseline process steps for this WO (ONLY ACTIVE / SELECTED ONES)
    let processMasterList: { processCode: string; processName: string; sequenceOrder: number }[] = [];
    
    if (selectedUpdateWo.selectedProcesses && selectedUpdateWo.selectedProcesses.length > 0) {
      const activeSelected = selectedUpdateWo.selectedProcesses.filter(p => p.isIncluded !== false);
      if (activeSelected.length > 0) {
        processMasterList = activeSelected.map((p, idx) => ({
          processCode: p.processCode || `PROC-0${idx + 1}`,
          processName: p.processName,
          sequenceOrder: p.sequenceOrder || idx + 1
        }));
      } else {
        processMasterList = [
          { processCode: 'PROC-01', processName: 'General Production', sequenceOrder: 1 }
        ];
      }
    } else {
      // Default standard 4-step sequence if WO has no explicit process list
      processMasterList = [
        { processCode: 'PROC-01', processName: 'Cutting', sequenceOrder: 1 },
        { processCode: 'PROC-02', processName: 'Printing / Dyeing', sequenceOrder: 2 },
        { processCode: 'PROC-03', processName: 'Assembly / Sewing', sequenceOrder: 3 },
        { processCode: 'PROC-04', processName: 'Finishing & Packaging', sequenceOrder: 4 }
      ];
    }

    processMasterList.sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    const plannedQty = selectedUpdateWo.totalQuantity || 0;
    const resultList: ProductionProcessExecution[] = [];

    processMasterList.forEach((masterProc, idx) => {
      // Find if there is an existing saved document for this process step
      const existing = savedProcs.find(
        p => p.sequenceOrder === masterProc.sequenceOrder || p.processName === masterProc.processName
      );

      // Available Input Qty for step 0 is WO planned Qty; for step i (>0), it's the completed Qty of step i-1
      let previousStepCompleted = 0;
      if (idx === 0) {
        previousStepCompleted = plannedQty;
      } else {
        const prevProc = resultList[idx - 1];
        previousStepCompleted = prevProc ? (prevProc.completedQty || 0) : 0;
      }

      if (existing) {
        resultList.push({
          ...existing,
          sequenceOrder: masterProc.sequenceOrder,
          plannedQty: plannedQty,
          previousCompletedQty: previousStepCompleted,
          availableInputQty: previousStepCompleted,
          balanceQty: Math.max(0, previousStepCompleted - (existing.completedQty || 0))
        });
      } else {
        resultList.push({
          id: `virtual-${masterProc.sequenceOrder}`,
          woId: selectedUpdateWo.id,
          woNumber: selectedUpdateWo.woNumber,
          processId: `proc-${masterProc.sequenceOrder}`,
          processCode: masterProc.processCode,
          processName: masterProc.processName,
          sequenceOrder: masterProc.sequenceOrder,
          plannedQty: plannedQty,
          previousCompletedQty: previousStepCompleted,
          availableInputQty: previousStepCompleted,
          completedQty: 0,
          rejectQty: 0,
          balanceQty: previousStepCompleted,
          status: 'Not Started' as const,
          businessId: bId,
          ownerId: userProfile.uid
        });
      }
    });

    return resultList;
  }, [selectedUpdateWo, processExecutions, bId, userProfile.uid]);

  // Handle saving a process production update
  const handleSaveProcessUpdate = async (procItem: ProductionProcessExecution) => {
    if (!selectedUpdateWo) {
      showToast('Please select a Work Order first.', 'error');
      return;
    }

    const prevCompletedInProc = procItem.completedQty || 0;
    const prevRejectInProc = procItem.rejectQty || 0;

    const finalCompleted = updateMode === 'add' ? (prevCompletedInProc + inputCompletedQty) : inputCompletedQty;
    const finalReject = updateMode === 'add' ? (prevRejectInProc + inputRejectQty) : inputRejectQty;

    // Validation: Cumulative total produced + rejected cannot exceed Available Input Qty
    if (finalCompleted + finalReject > procItem.availableInputQty) {
      showToast(`Invalid Entry: Total cumulative produced + rejected (${(finalCompleted + finalReject).toLocaleString()}) cannot exceed Available Input Qty (${procItem.availableInputQty.toLocaleString()}).`, 'error');
      return;
    }

    try {
      const balance = Math.max(0, procItem.availableInputQty - finalCompleted);

      let newStatus: ProductionProcessExecution['status'] = 'Not Started';
      if (finalCompleted >= procItem.plannedQty) {
        newStatus = 'Completed';
      } else if (finalCompleted > 0) {
        newStatus = 'Partially Completed';
      } else {
        newStatus = 'Running';
      }

      // Check if document exists in Firestore or create it
      const existingDoc = processExecutions.find(p => 
        (p.woId === selectedUpdateWo.id || p.woNumber === selectedUpdateWo.woNumber) && 
        p.processName === procItem.processName
      );

      const updateData = {
        woId: selectedUpdateWo.id,
        woNumber: selectedUpdateWo.woNumber,
        processId: procItem.processId,
        processCode: procItem.processCode,
        processName: procItem.processName,
        sequenceOrder: procItem.sequenceOrder,
        plannedQty: procItem.plannedQty,
        previousCompletedQty: procItem.previousCompletedQty,
        availableInputQty: procItem.availableInputQty,
        completedQty: finalCompleted,
        rejectQty: finalReject,
        balanceQty: balance,
        employee: inputEmployee,
        machine: inputMachine,
        startDate: procItem.startDate || format(new Date(), 'yyyy-MM-dd'),
        completionDate: newStatus === 'Completed' ? format(new Date(), 'yyyy-MM-dd') : (procItem.completionDate || ''),
        remarks: inputRemarks,
        status: newStatus,
        updatedAt: Timestamp.now(),
        updatedBy: userProfile.displayName || userProfile.email,
        businessId: bId,
        ownerId: userProfile.uid
      };

      if (existingDoc && !existingDoc.id.startsWith('virtual-')) {
        await updateDoc(doc(db, 'production_executions', existingDoc.id), updateData);
      } else {
        await addDoc(collection(db, 'production_executions'), updateData);
      }

      // Log transaction record in history
      const formattedEntryRemarks = inputRemarks.trim() 
        ? inputRemarks 
        : (updateMode === 'add' 
            ? `Batch entry: +${inputCompletedQty.toLocaleString()} Pcs (Cumulative: ${finalCompleted.toLocaleString()} Pcs)`
            : `Total set to: ${finalCompleted.toLocaleString()} Pcs`);

      await addDoc(collection(db, 'production_transactions'), {
        woId: selectedUpdateWo.id,
        woNumber: selectedUpdateWo.woNumber,
        processCode: procItem.processCode,
        processName: procItem.processName,
        sequenceOrder: procItem.sequenceOrder,
        date: format(new Date(), 'yyyy-MM-dd'),
        inputQty: procItem.availableInputQty,
        completedQty: inputCompletedQty,
        totalCompletedQty: finalCompleted,
        rejectQty: inputRejectQty,
        employee: inputEmployee,
        machine: inputMachine,
        remarks: formattedEntryRemarks,
        createdAt: Timestamp.now(),
        createdBy: userProfile.displayName || userProfile.email,
        businessId: bId,
        ownerId: userProfile.uid
      });

      // Update parent Work Order status to in_production or completed
      if (selectedUpdateWo.status !== 'completed') {
        const isFinalStep = procItem.sequenceOrder === updateWoProcesses.length;
        const woNewStatus = (isFinalStep && finalCompleted >= procItem.plannedQty) ? 'completed' : 'in_production';
        await updateDoc(doc(db, 'work_orders', selectedUpdateWo.id), {
          status: woNewStatus,
          isLocked: true
        });
      }

      showToast(`Production process '${procItem.processName}' updated successfully! Total completed: ${finalCompleted.toLocaleString()} Pcs`, 'success');
      setUpdatingProcess(null);
      setInputCompletedQty(0);
      setInputRejectQty(0);
      setInputRemarks('');
    } catch (err: any) {
      console.error(err);
      showToast('Failed to save production update: ' + err.message, 'error');
    }
  };

  // Handle saving BOM
  const handleSaveBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomNo || !bomProductName || bomItems.length === 0) {
      showToast('Please fill all required BOM details and add at least one raw material item.', 'error');
      return;
    }

    // Check duplicate: Only 1 Master BOM is allowed per Finished Good
    const normalizedName = (bomProductName || '').toLowerCase().trim();
    const normalizedCode = bomProductCode ? bomProductCode.toLowerCase().trim() : '';

    const duplicateBom = boms.find(b => {
      if (editingBom && b.id === editingBom.id) return false;
      if (bomProductId && b.productId && b.productId === bomProductId) return true;
      if (normalizedCode && b.productCode && b.productCode.toLowerCase().trim() === normalizedCode) return true;
      if (b.productName && (b.productName || '').toLowerCase().trim() === normalizedName) return true;
      return false;
    });

    if (duplicateBom) {
      showToast(`Cannot create multiple BOMs for the same Finished Good! Existing Master BOM: '${duplicateBom.bomNo}' (${duplicateBom.productName}). Only 1 active BOM is allowed per Finished Good. Please edit the existing BOM instead.`, 'error');
      return;
    }

    try {
      const selectedSheetItem = items.find(i => i.id === bomSheetItemId);
      const upsNum = Math.max(1, Number(bomUps) || 1);
      const wstNum = Number(bomWastagePercent) || 0;

      const bomData = {
        bomNo,
        productId: bomProductId,
        productName: bomProductName,
        productCode: bomProductCode,
        version: bomVersion,
        effectiveDate: bomEffectiveDate,
        unit: bomUnit,
        ups: upsNum,
        piecesPerSheet: upsNum,
        sheetItemId: bomSheetItemId || '',
        sheetItemName: selectedSheetItem?.name || '',
        sheetUnit: selectedSheetItem?.unit || 'Roll',
        wastagePercent: wstNum,
        remarks: bomRemarks,
        items: bomItems,
        businessId: bId,
        ownerId: userProfile.uid,
        createdAt: Timestamp.now()
      };

      if (editingBom) {
        await updateDoc(doc(db, 'boms', editingBom.id), bomData);
        showToast(`BOM '${bomNo}' updated successfully!`, 'success');
      } else {
        await addDoc(collection(db, 'boms'), bomData);
        showToast(`BOM '${bomNo}' created successfully!`, 'success');
      }

      setShowBomModal(false);
      setEditingBom(null);
      setExistingBomWarning(null);
    } catch (err: any) {
      showToast('Failed to save BOM: ' + err.message, 'error');
    }
  };

  // Handle selecting Work Order for Requisition with exact Sales Order sheet calculation
  const handleSelectWoForRequisition = (wId: string) => {
    setReqWoId(wId);
    if (!wId) {
      setReqBaseSheets(0);
      setReqExtraSheets(0);
      setReqExtraRemarks('');
      setReqItems([]);
      setReqSelectedBom(null);
      return;
    }

    const wo = workOrders.find(w => w.id === wId);
    if (!wo) return;

    // 1. Check for matching BOM first to know UPS and Wastage
    const matchingBom = boms.find(b => 
      (wo.finishedGoodsId && b.productId === wo.finishedGoodsId) ||
      (b.productName && wo.finishedGoodsName && b.productName.toLowerCase().trim() === wo.finishedGoodsName.toLowerCase().trim()) ||
      (b.productCode && wo.finishedGoodsNo && b.productCode.toLowerCase().trim() === wo.finishedGoodsNo.toLowerCase().trim()) ||
      (b.productCode && wo.styleNo && b.productCode.toLowerCase().trim() === wo.styleNo.toLowerCase().trim()) ||
      (b.bomNo && (wo.bomNo || '').toLowerCase().trim() === b.bomNo.toLowerCase().trim())
    );

    setReqSelectedBom(matchingBom || null);

    const orderQty = wo.totalQuantity || 0;
    const defaultUps = Math.max(1, matchingBom?.ups || matchingBom?.piecesPerSheet || wo.ups || 1);
    const defaultWastage = matchingBom?.wastagePercent || 0;

    // 2. Calculate exact Sales Order Sheet/Roll Quantity (from breakdown rows grouped by Finished Good)
    let soRequiredSheets = 0;
    if (wo.requiredSheets && Number(wo.requiredSheets) > 0) {
      soRequiredSheets = Number(wo.requiredSheets);
    } else if (wo.breakdownRows && wo.breakdownRows.length > 0) {
      const fgGroupMap: Record<string, { totalQty: number; ups: number }> = {};
      wo.breakdownRows.forEach((r: any) => {
        const fgKey = r.finishedGoodsId || (r.finishedGoodsNo ? r.finishedGoodsNo.trim().toLowerCase() : '') || (r.finishedGoodsName ? r.finishedGoodsName.trim().toLowerCase() : '') || (wo.finishedGoodsId || 'default');
        const rowFgId = r.finishedGoodsId || wo.finishedGoodsId;
        const rowFgName = r.finishedGoodsName || wo.finishedGoodsName;
        const rowFgNo = r.finishedGoodsNo || wo.finishedGoodsNo;
        const rowBom = boms.find(b => 
          (rowFgId && b.productId === rowFgId) ||
          (b.productName && rowFgName && b.productName.toLowerCase().trim() === rowFgName.toLowerCase().trim()) ||
          (b.productCode && rowFgNo && b.productCode.toLowerCase().trim() === rowFgNo.toLowerCase().trim())
        ) || matchingBom;
        const rowUps = Math.max(1, r.ups || rowBom?.ups || rowBom?.piecesPerSheet || defaultUps);
        
        if (!fgGroupMap[fgKey]) {
          fgGroupMap[fgKey] = { totalQty: 0, ups: rowUps };
        }
        fgGroupMap[fgKey].totalQty += (Number(r.quantity) || 0);
      });

      soRequiredSheets = Object.values(fgGroupMap).reduce((sum, item) => {
        const exactUnits = item.totalQty / Math.max(1, item.ups);
        return sum + Math.ceil(exactUnits);
      }, 0);
    }

    if (soRequiredSheets <= 0) {
      const baseUnits = orderQty > 0 ? orderQty / defaultUps : 0;
      soRequiredSheets = Math.ceil(baseUnits);
    }

    setReqBaseSheets(soRequiredSheets);
    setReqExtraSheets(0);
    setReqExtraRemarks('');

    // 3. Build requisition items
    const rows: ProductionRequisitionItem[] = [];

    // Find primary raw material (paper/board/roll/sheet) item
    let sheetItem = matchingBom?.sheetItemId ? items.find(i => i.id === matchingBom.sheetItemId) : undefined;
    if (!sheetItem && matchingBom?.sheetItemName) {
      sheetItem = items.find(i => i.name && i.name.toLowerCase().trim() === matchingBom.sheetItemName?.toLowerCase().trim());
    }
    if (!sheetItem) {
      sheetItem = items.find(i => (i.name || '').toLowerCase().includes('roll') || (i.name || '').toLowerCase().includes('sheet') || (i.name || '').toLowerCase().includes('paper') || (i.name || '').toLowerCase().includes('board'));
    }

    const itemUnit = sheetItem?.unit || matchingBom?.sheetUnit || (matchingBom?.sheetItemName?.toLowerCase().includes('roll') ? 'Roll' : 'Sheet');
    const matName = sheetItem?.name || matchingBom?.sheetItemName || 'Paper / Board / Roll Material';
    const avail = sheetItem ? sheetItem.currentStock : 0;

    rows.push({
      rawMaterialId: sheetItem?.id || matchingBom?.sheetItemId || '',
      rawMaterialName: matName,
      requiredQty: soRequiredSheets,
      availableStock: avail,
      shortageQty: Math.max(0, soRequiredSheets - avail),
      unit: itemUnit,
      remarks: `Sales Order Requirement (${soRequiredSheets} ${itemUnit})`
    });

    // Add other BOM items
    if (matchingBom && matchingBom.items && matchingBom.items.length > 0) {
      matchingBom.items.forEach(bItem => {
        if (bItem.rawMaterialId === (sheetItem?.id || matchingBom.sheetItemId)) return;
        const invItem = items.find(i => i.id === bItem.rawMaterialId);
        const invAvail = invItem ? invItem.currentStock : 0;
        const perUnitQty = bItem.totalRequiredQty || (bItem.consumptionQty ? bItem.consumptionQty * (1 + (bItem.wastagePercent || 0)/100) : 0);
        const reqQty = Number((perUnitQty * (orderQty || 1)).toFixed(3));
        rows.push({
          rawMaterialId: bItem.rawMaterialId,
          rawMaterialName: bItem.rawMaterialName || invItem?.name || 'Raw Material',
          requiredQty: reqQty > 0 ? reqQty : 1,
          availableStock: invAvail,
          shortageQty: Math.max(0, reqQty - invAvail),
          unit: bItem.unit || invItem?.unit || 'Kg',
          remarks: `BOM: ${matchingBom.bomNo}`
        });
      });
    }

    setReqItems(rows);
  };

  // Handle updating Extra Quantity & Remarks
  const handleUpdateExtraSheets = (extraVal: number | string, remarkVal: string) => {
    const extraNum = Math.max(0, Number(extraVal) || 0);
    setReqExtraSheets(extraVal);
    setReqExtraRemarks(remarkVal);

    const totalSheets = reqBaseSheets + extraNum;
    setReqItems(prev => prev.map((item, idx) => {
      if (idx === 0 || (item.unit || '').toLowerCase().includes('sheet') || (item.rawMaterialName || '').toLowerCase().includes('sheet') || (item.rawMaterialName || '').toLowerCase().includes('paper')) {
        const shortage = Math.max(0, totalSheets - item.availableStock);
        return {
          ...item,
          requiredQty: totalSheets,
          shortageQty: shortage,
          remarks: extraNum > 0 
            ? `Base: ${reqBaseSheets} + Extra: ${extraNum} = ${totalSheets} Sheets (${remarkVal || 'Extra allowance'})`
            : `Sales Order Base Sheets (${reqBaseSheets} Sheets)`
        };
      }
      return item;
    }));
  };

  // Handle saving Requisition with pending status
  const handleSaveRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqWoId || reqItems.length === 0) {
      showToast('Please select a Work Order and calculate raw material requirements.', 'error');
      return;
    }

    const targetWo = workOrders.find(w => w.id === reqWoId);
    if (!targetWo) return;

    const extraNum = Math.max(0, Number(reqExtraSheets) || 0);
    const totalSheets = reqBaseSheets + extraNum;

    try {
      const reqNo = `FREQ-${format(new Date(), 'yyyy')}-${String(requisitions.length + 1).padStart(4, '0')}`;
      const reqData: Omit<ProductionRequisitionRecord, 'id'> = {
        reqNo,
        woId: targetWo.id,
        woNumber: targetWo.woNumber,
        productId: targetWo.finishedGoodsId || '',
        productName: targetWo.finishedGoodsName || 'Finished Product',
        productionQty: targetWo.totalQuantity || 0,
        baseSheets: reqBaseSheets,
        extraSheets: extraNum,
        extraRemarks: reqExtraRemarks,
        totalSheets: totalSheets,
        bomId: reqSelectedBom?.id || '',
        bomNo: reqSelectedBom?.bomNo || '',
        store: reqStore,
        remarks: reqRemarks,
        status: 'pending',
        date: format(new Date(), 'yyyy-MM-dd'),
        items: reqItems,
        businessId: bId,
        ownerId: userProfile.uid,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'production_requisitions'), reqData);

      // Also create an integrated store requisition with pending status
      await addDoc(collection(db, 'store_requisitions'), {
        srNo: reqNo,
        srDate: format(new Date(), 'yyyy-MM-dd'),
        department: 'Production',
        requestorName: userProfile.displayName || userProfile.email,
        purpose: `Production Raw Material Requisition for Work Order ${targetWo.woNumber}`,
        jobNo: targetWo.woNumber,
        style: targetWo.style || targetWo.finishedGoodsName || '',
        type: 'PRODUCTION',
        status: 'pending',
        baseSheets: reqBaseSheets,
        extraSheets: extraNum,
        extraRemarks: reqExtraRemarks,
        totalSheets: totalSheets,
        remarks: reqRemarks ? `${reqRemarks} ${reqExtraRemarks ? `(Extra: ${extraNum} - ${reqExtraRemarks})` : ''}` : (reqExtraRemarks ? `Extra: ${extraNum} - ${reqExtraRemarks}` : ''),
        items: reqItems.map(item => ({
          itemId: item.rawMaterialId,
          itemCode: item.sku || '',
          itemName: item.rawMaterialName,
          unit: item.unit,
          quantity: item.requiredQty,
          remarks: item.remarks || ''
        })),
        businessId: bId,
        ownerId: userProfile.uid,
        createdAt: Timestamp.now()
      });

      showToast(`Production Requisition '${reqNo}' submitted to Store for Confirmation!`, 'success');
      setShowReqModal(false);
    } catch (err: any) {
      showToast('Failed to create requisition: ' + err.message, 'error');
    }
  };

  // Confirmation Modal state
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

  const triggerConfirmRequisition = (req: ProductionRequisitionRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Requisition & Issue Raw Materials',
      message: `Are you sure you want to confirm Requisition #${req.reqNo} for Work Order #${req.woNumber}?`,
      subMessage: `Product: ${req.productName} • Raw materials will be deducted from Store Inventory and issued to Production.`,
      variant: 'approve',
      confirmText: 'Yes, Confirm & Issue',
      onConfirm: () => handleConfirmRequisition(req)
    });
  };

  const triggerRejectRequisition = (req: ProductionRequisitionRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Production Requisition',
      message: `Are you sure you want to reject Requisition #${req.reqNo}?`,
      subMessage: `Work Order: #${req.woNumber} • Product: ${req.productName}`,
      variant: 'reject',
      confirmText: 'Yes, Reject Requisition',
      onConfirm: () => handleRejectRequisition(req)
    });
  };

  // Handle Confirming and Issuing Requisition from Store (Deducts stock and creates transaction)
  const handleConfirmRequisition = async (req: ProductionRequisitionRecord) => {
    if (isViewer) {
      showToast('Viewer role cannot confirm store requisitions.', 'error');
      return;
    }

    try {
      setIsConfirmingReqId(req.id);

      // Pre-check: Ensure ALL items have sufficient stock before deducting anything
      const insufficientItems: string[] = [];
      for (const item of req.items) {
        if (!item.rawMaterialId) continue;
        const invItem = items.find(i => i.id === item.rawMaterialId);
        const currentStock = invItem ? (Number(invItem.currentStock) || 0) : 0;
        const requiredQty = Number(item.requiredQty) || 0;
        if (requiredQty > currentStock + 0.0001) {
          insufficientItems.push(`• ${item.rawMaterialName || invItem?.name || 'Item'}: In Stock: ${currentStock.toFixed(2)}, Required: ${requiredQty.toFixed(2)}`);
        }
      }

      if (insufficientItems.length > 0) {
        showToast(
          `Cannot Issue Requisition! Insufficient Stock in Inventory:\n${insufficientItems.join('\n')}`,
          'error'
        );
        setIsConfirmingReqId(null);
        return;
      }

      // Deduct stock for each requisition item
      for (const item of req.items) {
        if (!item.rawMaterialId) continue;
        const invItem = items.find(i => i.id === item.rawMaterialId);
        const currentStock = invItem ? invItem.currentStock : 0;
        const newStock = Math.max(0, currentStock - (item.requiredQty || 0));

        // 1. Update stock in items collection
        const itemRef = doc(db, 'items', item.rawMaterialId);
        await updateDoc(itemRef, {
          currentStock: newStock,
          updatedAt: Timestamp.now()
        });

        // 2. Create transaction record
        await addDoc(collection(db, 'transactions'), {
          type: 'PRODUCTION',
          itemId: item.rawMaterialId,
          quantity: item.requiredQty,
          price: invItem?.avgCost || 0,
          date: Timestamp.now(),
          businessId: bId,
          ownerId: userProfile.uid,
          department: 'Production',
          purpose: `Issue to Production for Work Order ${req.woNumber} (Req: ${req.reqNo})`,
          jobNo: req.woNumber,
          style: req.productName,
          srNo: req.reqNo,
          reference: req.reqNo,
          notes: (req.remarks || '') + (req.extraRemarks ? ` [Extra Sheets: ${req.extraSheets} - ${req.extraRemarks}]` : ''),
          status: 'active'
        });

        // 3. Recalculate stock
        if (recalculateItemStock) {
          await recalculateItemStock(item.rawMaterialId, bId);
        }
      }

      // Update production_requisition status to 'issued'
      const reqRef = doc(db, 'production_requisitions', req.id);
      await updateDoc(reqRef, {
        status: 'issued',
        issuedAt: Timestamp.now(),
        issuedBy: userProfile.displayName || userProfile.email
      });

      // Update matching store_requisitions to 'issued'
      const qSr = query(collection(db, 'store_requisitions'), where('srNo', '==', req.reqNo), where('businessId', '==', bId));
      const srSnap = await getDocs(qSr);
      srSnap.forEach(async (srDoc) => {
        await updateDoc(doc(db, 'store_requisitions', srDoc.id), {
          status: 'issued',
          issuedAt: Timestamp.now(),
          issuedBy: userProfile.displayName || userProfile.email
        });
      });

      showToast(`Store Requisition '${req.reqNo}' confirmed! Raw materials issued from Store to Production.`, 'success');
    } catch (err: any) {
      showToast('Failed to confirm requisition: ' + err.message, 'error');
    } finally {
      setIsConfirmingReqId(null);
    }
  };

  // Handle Rejecting Requisition
  const handleRejectRequisition = async (req: ProductionRequisitionRecord) => {
    if (isViewer) {
      showToast('Viewer role cannot reject requisitions.', 'error');
      return;
    }
    try {
      const reqRef = doc(db, 'production_requisitions', req.id);
      await updateDoc(reqRef, { status: 'rejected' });

      const qSr = query(collection(db, 'store_requisitions'), where('srNo', '==', req.reqNo), where('businessId', '==', bId));
      const srSnap = await getDocs(qSr);
      srSnap.forEach(async (srDoc) => {
        await updateDoc(doc(db, 'store_requisitions', srDoc.id), { status: 'rejected' });
      });

      showToast(`Requisition '${req.reqNo}' marked as rejected.`, 'info');
    } catch (err: any) {
      showToast('Failed to reject requisition: ' + err.message, 'error');
    }
  };

  // Export Production Report to Excel
  const handleExportExcel = (wo: WorkOrder) => {
    const stats = getWoProductionStats(wo);
    const procData = stats.woProcs.map((p, idx) => ({
      'SL': idx + 1,
      'Process': p.processName,
      'Planned Qty': p.plannedQty,
      'Completed Qty': p.completedQty,
      'Balance Qty': p.balanceQty,
      'Reject Qty': p.rejectQty,
      'Status': p.status
    }));

    const ws = XLSX.utils.json_to_sheet(procData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production Report');
    XLSX.writeFile(wb, `Production_Report_${wo.woNumber}.xlsx`);
    showToast('Exported Production Report to Excel!', 'info');
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR & SUBMODULE NAVIGATION */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-neutral-900">Production & Manufacturing</h1>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Automated process routing, process-wise completed tracking & delivery-ready quantities
          </p>
        </div>

        {/* Submenu Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          {[
            { id: 'production-dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'production-update', label: 'Production Update', icon: RefreshCw },
            { id: 'production-bom', label: 'BOM Create', icon: Layers },
            { id: 'production-status', label: 'Production Status', icon: PieChartIcon },
            { id: 'production-details', label: 'WO Details', icon: FileText },
            { id: 'production-requisition', label: 'Requisition', icon: Send },
          ].filter(tab => availableTabs.includes(tab.id)).map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  active 
                    ? 'bg-white text-indigo-700 shadow-sm border border-neutral-200' 
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- SUBTAB 1: PRODUCTION DASHBOARD --- */}
      {subTab === 'production-dashboard' && (
        <div className="space-y-6">
          {/* Summary Cards Grid (11 Interactive Metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'all', title: 'Confirmed WOs', count: summaryMetrics.totalConfirmedWo, color: 'bg-indigo-50 border-indigo-200 text-indigo-900', label: 'Total Confirmed' },
              { id: 'pending', title: 'Pending Prod.', count: summaryMetrics.pendingProduction, color: 'bg-amber-50 border-amber-200 text-amber-900', label: 'Not Started' },
              { id: 'running', title: 'Running Prod.', count: summaryMetrics.runningProduction, color: 'bg-blue-50 border-blue-200 text-blue-900', label: 'Active Process' },
              { id: 'partially_completed', title: 'Partially Comp.', count: summaryMetrics.partiallyCompleted, color: 'bg-purple-50 border-purple-200 text-purple-900', label: 'In Progress' },
              { id: 'completed', title: 'Completed', count: summaryMetrics.productionCompleted, color: 'bg-emerald-50 border-emerald-200 text-emerald-900', label: 'Production Done' },
              { id: 'ready_delivery', title: 'Ready for Deliv.', count: `${summaryMetrics.readyForDelivery.toLocaleString()} Pcs`, color: 'bg-teal-50 border-teal-200 text-teal-900', label: 'Available Delivery' },
            ].map(card => (
              <div 
                key={card.id}
                onClick={() => setFilterCardType(card.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${card.color} ${filterCardType === card.id ? 'ring-2 ring-indigo-500 shadow-md' : 'shadow-sm'}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">{card.title}</span>
                <span className="text-xl font-black block mt-1">{card.count}</span>
                <span className="text-[9px] font-medium block mt-0.5 opacity-80">{card.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'qty_order', title: 'Total Order Qty', count: `${summaryMetrics.totalOrderQty.toLocaleString()} Pcs`, color: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
              { id: 'qty_produced', title: 'Total Produced Qty', count: `${summaryMetrics.totalProducedQty.toLocaleString()} Pcs`, color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
              { id: 'qty_balance', title: 'Total Balance Qty', count: `${summaryMetrics.totalBalanceQty.toLocaleString()} Pcs`, color: 'bg-rose-50 border-rose-200 text-rose-900' },
              { id: 'partially_delivered', title: 'Partially Delivered', count: summaryMetrics.partiallyDelivered, color: 'bg-orange-50 border-orange-200 text-orange-900' },
              { id: 'fully_delivered', title: 'Fully Delivered', count: summaryMetrics.fullyDelivered, color: 'bg-cyan-50 border-cyan-200 text-cyan-900' },
            ].map(card => (
              <div key={card.id} className={`p-3 rounded-xl border shadow-sm ${card.color}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">{card.title}</span>
                <span className="text-lg font-black block mt-1">{card.count}</span>
              </div>
            ))}
          </div>

          {/* Work Order Overview Table */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-neutral-900">Work Order Production Overview</h2>
                <p className="text-xs text-neutral-500">Live production & delivery status across all confirmed work orders</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search WO, Customer, Product..."
                    className="pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs w-64 focus:bg-white focus:outline-indigo-500"
                  />
                </div>
                {filterCardType !== 'all' && (
                  <button
                    onClick={() => setFilterCardType('all')}
                    className="text-xs font-bold text-rose-600 hover:underline px-2 py-1 bg-rose-50 rounded-md"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700 font-bold uppercase text-[10px]">
                    <th className="p-3">Work Order</th>
                    <th className="p-3">Customer & Buyer</th>
                    <th className="p-3">Product / FG Item</th>
                    <th className="p-3 text-right">Order Qty</th>
                    <th className="p-3 text-right">Produced Qty</th>
                    <th className="p-3 text-right">Balance</th>
                    <th className="p-3">Current Process</th>
                    <th className="p-3">Progress</th>
                    <th className="p-3">Delivery Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-medium">
                  {filteredWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-neutral-500 italic">
                        No confirmed work orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkOrders.map(wo => {
                      const stats = getWoProductionStats(wo);
                      return (
                        <tr key={wo.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-indigo-900">
                            {wo.woNumber}
                            <span className="block text-[10px] text-neutral-500 font-normal">{wo.poNo || 'No PO'}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-neutral-900 block">{wo.customerName}</span>
                            <span className="text-[10px] text-neutral-500">{wo.buyerName}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-neutral-800 block">{wo.finishedGoodsName || 'N/A'}</span>
                            <span className="text-[10px] font-mono text-neutral-500">{wo.finishedGoodsNo}</span>
                          </td>
                          <td className="p-3 text-right font-bold text-neutral-900">
                            {wo.totalQuantity?.toLocaleString()} {wo.finishedGoodsUnit || 'Pcs'}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            {stats.producedQty.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-bold text-rose-600">
                            {stats.balanceQty.toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[10px] font-bold text-neutral-700">
                              {stats.currentProcessName}
                            </span>
                          </td>
                          <td className="p-3 w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-neutral-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-2 rounded-full transition-all" 
                                  style={{ width: `${stats.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold">{stats.progressPercent}%</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              stats.delivStatus === 'Fully Delivered' ? 'bg-emerald-100 text-emerald-800' :
                              stats.delivStatus === 'Partially Delivered' ? 'bg-amber-100 text-amber-800' :
                              'bg-neutral-100 text-neutral-700'
                            }`}>
                              {stats.delivStatus}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedWoId(wo.id);
                                handleTabChange('production-status');
                              }}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-all flex items-center gap-1 mx-auto"
                            >
                              <Eye className="w-3 h-3" /> View Production
                            </button>
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

      {/* --- SUBTAB 2: PRODUCTION UPDATE --- */}
      {subTab === 'production-update' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-200 pb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600" /> Process-Wise Production Entry
            </h2>

            {/* Select Work Order */}
            <div className="max-w-xl space-y-1">
              <label className="text-xs font-bold text-neutral-700 block">Select Confirmed Work Order <span className="text-rose-500">*</span></label>
              <select
                value={updateWoId}
                onChange={(e) => setUpdateWoId(e.target.value)}
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:bg-white focus:outline-indigo-500"
              >
                <option value="">-- Select Work Order --</option>
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>
                    {wo.woNumber} | {wo.customerName} | {wo.finishedGoodsName || 'Item'} ({wo.totalQuantity?.toLocaleString()} Pcs)
                  </option>
                ))}
              </select>
            </div>

            {selectedUpdateWo ? (
              <div className="space-y-6 pt-2">
                {/* Work Order Spec Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-indigo-50/60 p-3 rounded-lg border border-indigo-100 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Customer & Buyer</span>
                    <span className="font-bold text-neutral-900">{selectedUpdateWo.customerName}</span>
                    <span className="text-[10px] text-neutral-600 block">{selectedUpdateWo.buyerName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Finished Goods</span>
                    <span className="font-bold text-neutral-900">{selectedUpdateWo.finishedGoodsName}</span>
                    <span className="text-[10px] text-neutral-600 font-mono block">{selectedUpdateWo.finishedGoodsNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Order Qty & Unit</span>
                    <span className="font-bold text-indigo-900 text-sm">{selectedUpdateWo.totalQuantity?.toLocaleString()} {selectedUpdateWo.finishedGoodsUnit || 'Pcs'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Delivery Date</span>
                    <span className="font-bold text-neutral-900">{selectedUpdateWo.deliveryDate || 'N/A'}</span>
                  </div>
                </div>

                {/* Process Execution List Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Production Process Sequence</h3>
                  <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-700 font-bold uppercase text-[10px]">
                          <th className="p-2.5 w-12 text-center">Seq</th>
                          <th className="p-2.5">Process Name</th>
                          <th className="p-2.5 text-right">Planned Qty</th>
                          <th className="p-2.5 text-right">Prev Comp Qty</th>
                          <th className="p-2.5 text-right bg-indigo-50/50">Avail. Input</th>
                          <th className="p-2.5 text-right">Completed Qty</th>
                          <th className="p-2.5 text-right">Reject Qty</th>
                          <th className="p-2.5 text-right">Balance Qty</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 font-medium">
                        {updateWoProcesses.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="p-4 text-center text-neutral-500 italic">
                              No production processes configured for this Work Order.
                            </td>
                          </tr>
                        ) : (
                          updateWoProcesses.map((proc, pIdx) => {
                            // Calculate available input from previous step completion
                            let prevCompleted = proc.plannedQty;
                            if (pIdx > 0) {
                              prevCompleted = updateWoProcesses[pIdx - 1].completedQty || 0;
                            }
                            const availInput = prevCompleted;
                            const bal = Math.max(0, availInput - (proc.completedQty || 0));

                            return (
                              <tr key={proc.id || pIdx} className="hover:bg-neutral-50">
                                <td className="p-2.5 text-center font-bold text-neutral-500">{proc.sequenceOrder}</td>
                                <td className="p-2.5 font-bold text-neutral-900">{proc.processName}</td>
                                <td className="p-2.5 text-right">{proc.plannedQty.toLocaleString()}</td>
                                <td className="p-2.5 text-right text-neutral-600">{prevCompleted.toLocaleString()}</td>
                                <td className="p-2.5 text-right font-bold text-indigo-900 bg-indigo-50/30">{availInput.toLocaleString()}</td>
                                <td className="p-2.5 text-right font-bold text-emerald-700">{proc.completedQty?.toLocaleString() || 0}</td>
                                <td className="p-2.5 text-right font-bold text-rose-600">{proc.rejectQty?.toLocaleString() || 0}</td>
                                <td className="p-2.5 text-right font-bold text-neutral-800">{bal.toLocaleString()}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    proc.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                    proc.status === 'Running' || proc.status === 'Partially Completed' ? 'bg-amber-100 text-amber-800' :
                                    'bg-neutral-100 text-neutral-600'
                                  }`}>
                                    {proc.status}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    onClick={() => {
                                      setUpdatingProcess({
                                        ...proc,
                                        previousCompletedQty: prevCompleted,
                                        availableInputQty: availInput
                                      });
                                      setUpdateMode('add');
                                      setInputCompletedQty(0);
                                      setInputRejectQty(0);
                                      setInputEmployee(proc.employee || '');
                                      setInputMachine(proc.machine || '');
                                      setInputRemarks('');
                                    }}
                                    className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700 transition-all"
                                  >
                                    Update Entry
                                  </button>
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
            ) : (
              <div className="p-8 text-center text-neutral-400 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                <Search className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                Select a confirmed Work Order from the dropdown above to load process workflow steps.
              </div>
            )}
          </div>

          {/* Modal / Inline Drawer for Updating Specific Process */}
          {updatingProcess && (() => {
            const prevCompletedInProc = updatingProcess.completedQty || 0;
            const prevRejectInProc = updatingProcess.rejectQty || 0;
            const prevBalance = Math.max(0, updatingProcess.availableInputQty - prevCompletedInProc);

            const calcNewCumulativeCompleted = updateMode === 'add' ? (prevCompletedInProc + inputCompletedQty) : inputCompletedQty;
            const calcNewCumulativeReject = updateMode === 'add' ? (prevRejectInProc + inputRejectQty) : inputRejectQty;
            const calcNewBalance = Math.max(0, updatingProcess.availableInputQty - calcNewCumulativeCompleted);

            return (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-neutral-900">Process Production Update</h3>
                      <p className="text-xs text-indigo-700 font-mono font-bold">{selectedUpdateWo?.woNumber} &rarr; {updatingProcess.processName}</p>
                    </div>
                    <button onClick={() => setUpdatingProcess(null)} className="p-1 text-neutral-400 hover:text-neutral-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Entry Mode Selector */}
                  <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setUpdateMode('add')}
                      className={`flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        updateMode === 'add' ? 'bg-indigo-600 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Batch Output (Incremental)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUpdateMode('set');
                        setInputCompletedQty(prevCompletedInProc);
                        setInputRejectQty(prevRejectInProc);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        updateMode === 'set' ? 'bg-indigo-600 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" /> Direct Set Total Qty
                    </button>
                  </div>

                  {/* Process Balance Stat Cards */}
                  <div className="grid grid-cols-3 gap-2 bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs text-center">
                    <div className="bg-white p-2 rounded-lg border border-neutral-200 shadow-2xs">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold block">Available Target</span>
                      <span className="text-sm font-black text-neutral-900">{updatingProcess.availableInputQty.toLocaleString()} Pcs</span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold block">Prev. Completed</span>
                      <span className="text-sm font-black text-emerald-800">{prevCompletedInProc.toLocaleString()} Pcs</span>
                    </div>
                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 shadow-2xs">
                      <span className="text-[10px] text-amber-700 uppercase font-bold block">Current Balance</span>
                      <span className="text-sm font-black text-amber-800">{prevBalance.toLocaleString()} Pcs</span>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-neutral-800 block">
                          {updateMode === 'add' ? 'New Batch Completed Quantity (Pcs)' : 'Total Completed Quantity (Pcs)'} <span className="text-rose-500">*</span>
                        </label>
                        {updateMode === 'add' && prevCompletedInProc > 0 && (
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            Prev: {prevCompletedInProc.toLocaleString()} Pcs
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        value={inputCompletedQty}
                        onChange={(e) => setInputCompletedQty(Number(e.target.value))}
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-base font-black text-emerald-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        min={0}
                        placeholder={updateMode === 'add' ? 'e.g. 5000' : `${prevCompletedInProc}`}
                      />
                      {updateMode === 'add' && (
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Entering <strong className="text-emerald-700 font-bold">{inputCompletedQty.toLocaleString()} Pcs</strong> will add to previous <strong className="text-neutral-700 font-bold">{prevCompletedInProc.toLocaleString()} Pcs</strong> &rarr; Total: <strong className="text-indigo-900 font-bold">{calcNewCumulativeCompleted.toLocaleString()} Pcs</strong>.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">
                        {updateMode === 'add' ? 'Batch Reject / Wastage Quantity (Pcs)' : 'Total Reject Quantity (Pcs)'}
                      </label>
                      <input
                        type="number"
                        value={inputRejectQty}
                        onChange={(e) => setInputRejectQty(Number(e.target.value))}
                        className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm font-bold text-rose-700 focus:bg-white"
                        min={0}
                      />
                    </div>

                    {/* Live Calculation Result Preview Box */}
                    <div className="p-3 bg-indigo-900 text-white rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-indigo-200">New Total Cumulative Completed:</span>
                        <span className="text-base font-black text-emerald-300">{calcNewCumulativeCompleted.toLocaleString()} Pcs</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-indigo-200">Updated Remaining Balance:</span>
                        <span className="text-sm font-bold text-amber-300">{calcNewBalance.toLocaleString()} Pcs</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-neutral-700 block mb-1">Operator / Employee</label>
                        <input
                          type="text"
                          value={inputEmployee}
                          onChange={(e) => setInputEmployee(e.target.value)}
                          placeholder="e.g. Rahim Uddin"
                          className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-neutral-700 block mb-1">Machine / Line</label>
                        <input
                          type="text"
                          value={inputMachine}
                          onChange={(e) => setInputMachine(e.target.value)}
                          placeholder="e.g. Press Machine #2"
                          className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Remarks / Shift Notes</label>
                      <input
                        type="text"
                        value={inputRemarks}
                        onChange={(e) => setInputRemarks(e.target.value)}
                        placeholder="e.g. Shift 1 production run completed"
                        className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                    <button
                      onClick={() => setUpdatingProcess(null)}
                      className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-700 hover:bg-neutral-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveProcessUpdate(updatingProcess)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" /> Save Production Entry
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* --- SUBTAB 3: BOM CREATE --- */}
      {subTab === 'production-bom' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Bill of Materials (BOM Master)</h2>
              <p className="text-xs text-neutral-500">Define raw material consumption, wastage formulas & process requirements</p>
            </div>
            <button
              onClick={() => {
                setEditingBom(null);
                setBomNo(`BOM-2026-${String(boms.length + 1).padStart(4, '0')}`);
                setBomProductId('');
                setBomProductName('');
                setBomProductCode('');
                setBomItems([]);
                setBomUps(24);
                setBomSheetItemId('');
                setBomWastagePercent(2);
                setShowBomModal(true);
              }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create New BOM
            </button>
          </div>

          {/* BOM List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boms.length === 0 ? (
              <div className="col-span-full p-12 text-center text-neutral-400 bg-white rounded-xl border border-dashed border-neutral-300">
                <Layers className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                No BOM formulas created yet. Click "Create New BOM" above.
              </div>
            ) : (
              boms.map(bom => (
                <div key={bom.id} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-all space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{bom.bomNo}</span>
                      <h3 className="text-sm font-bold text-neutral-900 mt-1">{bom.productName}</h3>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">v{bom.version}</span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="p-1.5 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between">
                      <span className="text-indigo-950 font-bold">Cutting Yield (UPS):</span>
                      <span className="font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                        1 {bom.sheetUnit || 'Unit'} = {(bom.ups || bom.piecesPerSheet || 1).toLocaleString()} Pcs
                      </span>
                    </div>
                    {bom.sheetItemName && (
                      <p className="text-neutral-600 text-[11px] truncate">
                        <span className="font-bold text-neutral-700">Primary Material:</span> {bom.sheetItemName} ({bom.sheetUnit || 'Unit'})
                      </p>
                    )}
                    <p className="text-neutral-600"><span className="font-bold text-neutral-700">Raw Materials:</span> {bom.items?.length || 0} items</p>
                    <p className="text-neutral-600"><span className="font-bold text-neutral-700">Unit:</span> {bom.unit}</p>
                    <p className="text-neutral-600"><span className="font-bold text-neutral-700">Effective Date:</span> {bom.effectiveDate}</p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingBom(bom);
                        setBomNo(bom.bomNo);
                        setBomProductId(bom.productId);
                        setBomProductName(bom.productName);
                        setBomProductCode(bom.productCode);
                        setBomVersion(bom.version);
                        setBomEffectiveDate(bom.effectiveDate);
                        setBomUnit(bom.unit);
                        setBomRemarks(bom.remarks || '');
                        setBomItems(bom.items || []);
                        setBomUps(bom.ups || bom.piecesPerSheet || 1);
                        setBomSheetItemId(bom.sheetItemId || '');
                        setBomWastagePercent(bom.wastagePercent ?? 2);
                        setShowBomModal(true);
                      }}
                      className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-xs font-bold flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Edit BOM
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* BOM Creation Modal */}
          {showBomModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">{editingBom ? 'Edit BOM Master' : 'Create New BOM Master'}</h3>
                    <p className="text-[11px] text-neutral-500">Define raw material formulas, sheet cutting calculation (UPS) & process requirements.</p>
                  </div>
                  <button onClick={() => { setShowBomModal(false); setExistingBomWarning(null); }} className="p-1 text-neutral-400 hover:text-neutral-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Duplicate BOM Warning Banner if already exists */}
                {existingBomWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold">BOM Already Exists:</span> Master BOM <strong className="font-mono">{existingBomWarning.bomNo}</strong> is already defined for <strong>{existingBomWarning.productName}</strong> ({existingBomWarning.productCode || 'No Code'}).
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBom(existingBomWarning);
                        setBomNo(existingBomWarning.bomNo);
                        setBomProductId(existingBomWarning.productId);
                        setBomProductName(existingBomWarning.productName);
                        setBomProductCode(existingBomWarning.productCode);
                        setBomVersion(existingBomWarning.version);
                        setBomEffectiveDate(existingBomWarning.effectiveDate);
                        setBomUnit(existingBomWarning.unit);
                        setBomRemarks(existingBomWarning.remarks || '');
                        setBomItems(existingBomWarning.items || []);
                        setBomUps(existingBomWarning.ups || existingBomWarning.piecesPerSheet || 1);
                        setBomSheetItemId(existingBomWarning.sheetItemId || '');
                        setBomWastagePercent(existingBomWarning.wastagePercent ?? 2);
                        setExistingBomWarning(null);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shrink-0 flex items-center gap-1 shadow-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Existing BOM
                    </button>
                  </div>
                )}

                <form onSubmit={handleSaveBom} className="space-y-4 text-xs">
                  {/* Finished Goods Search & Selection Bar */}
                  <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-indigo-950 flex items-center gap-1.5 text-xs">
                        <Package className="w-4 h-4 text-indigo-600" /> Search & Select Finished Goods (FG)
                      </label>
                      <span className="text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded font-semibold border border-indigo-200">
                        {finishedGoods.length} FG Items Available
                      </span>
                    </div>

                    <div className="relative">
                      <div className="relative flex items-center">
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Type Finished Goods name or FG code (e.g. FG-001, Kimball Sticker)..."
                          value={fgSearchQuery}
                          onChange={(e) => {
                            setFgSearchQuery(e.target.value);
                            setIsFgDropdownOpen(true);
                          }}
                          onFocus={() => setIsFgDropdownOpen(true)}
                          className="w-full pl-9 pr-8 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />
                        {fgSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setFgSearchQuery('');
                              setIsFgDropdownOpen(false);
                            }}
                            className="absolute right-2.5 p-0.5 text-neutral-400 hover:text-neutral-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Filtered Finished Goods Dropdown */}
                      {isFgDropdownOpen && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-neutral-100">
                          {finishedGoods
                            .filter(fg => 
                              !fgSearchQuery || 
                              fg.name?.toLowerCase().includes(fgSearchQuery.toLowerCase()) || 
                              fg.fgNo?.toLowerCase().includes(fgSearchQuery.toLowerCase()) ||
                              fg.productType?.toLowerCase().includes(fgSearchQuery.toLowerCase())
                            )
                            .map(fg => {
                              const existingForFg = boms.find(b => 
                                (b.productId === fg.id || 
                                 (b.productCode && fg.fgNo && b.productCode.toLowerCase().trim() === fg.fgNo.toLowerCase().trim()) || 
                                 (b.productName && fg.name && b.productName.toLowerCase().trim() === fg.name.toLowerCase().trim())) && 
                                (!editingBom || b.id !== editingBom.id)
                              );

                              return (
                                <button
                                  key={fg.id}
                                  type="button"
                                  onClick={() => {
                                    setBomProductId(fg.id);
                                    setBomProductName(fg.name);
                                    setBomProductCode(fg.fgNo || '');
                                    setBomUnit(fg.unit || 'Pcs');
                                    setFgSearchQuery(`${fg.name} (${fg.fgNo || 'No Code'})`);
                                    setIsFgDropdownOpen(false);

                                    if (existingForFg) {
                                      setExistingBomWarning(existingForFg);
                                      showToast(`⚠️ Master BOM '${existingForFg.bomNo}' already exists for this Finished Good!`, 'warning');
                                    } else {
                                      setExistingBomWarning(null);
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-indigo-50/80 flex items-center justify-between transition-colors group"
                                >
                                  <div>
                                    <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                                      <span>{fg.name}</span>
                                      {fg.fgNo && (
                                        <span className="font-mono text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                          {fg.fgNo}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-neutral-500 mt-0.5">
                                      Category: {fg.categoryName || fg.productCategory || 'General'} | Unit: {fg.unit || 'Pcs'}
                                    </div>
                                  </div>

                                  {existingForFg ? (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" /> BOM: {existingForFg.bomNo}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 opacity-0 group-hover:opacity-100 transition-opacity">
                                      Select Item
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          {finishedGoods.length === 0 && (
                            <div className="p-3 text-center text-neutral-400 italic text-[11px]">
                              No Finished Goods found in Master Setup.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">BOM No</label>
                      <input type="text" value={bomNo} onChange={(e) => setBomNo(e.target.value)} className="w-full p-2 bg-neutral-50 border rounded-lg font-mono font-bold" required />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Finished Product Name <span className="text-rose-500">*</span></label>
                      <input type="text" value={bomProductName} onChange={(e) => setBomProductName(e.target.value)} placeholder="Auto-filled or typed" className="w-full p-2 bg-white border border-neutral-300 rounded-lg font-bold" required />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Product Code / FG No <span className="text-neutral-400 font-normal">(Auto)</span></label>
                      <input type="text" value={bomProductCode} onChange={(e) => setBomProductCode(e.target.value)} placeholder="Auto-filled from FG" className="w-full p-2 bg-neutral-50 border rounded-lg font-mono font-bold text-indigo-900" />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Version & Unit</label>
                      <div className="flex gap-1">
                        <input type="text" value={bomVersion} onChange={(e) => setBomVersion(e.target.value)} className="w-16 p-2 bg-neutral-50 border rounded-lg text-center font-bold" />
                        <input type="text" value={bomUnit} onChange={(e) => setBomUnit(e.target.value)} className="w-full p-2 bg-neutral-50 border rounded-lg font-bold" />
                      </div>
                    </div>
                  </div>

                  {/* Material & UPS Yield Formula Section */}
                  {(() => {
                    const selectedMat = items.find(i => i.id === bomSheetItemId);
                    const matUnit = selectedMat?.unit || 'Roll';
                    const upsVal = Math.max(1, Number(bomUps) || 1);
                    const wstVal = Number(bomWastagePercent) || 0;
                    return (
                      <div className="p-3.5 bg-gradient-to-r from-amber-50/80 via-indigo-50/50 to-emerald-50/60 rounded-xl border border-indigo-200/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <span className="font-extrabold text-neutral-900 text-xs">Material & UPS Cutting Formula (১ {matUnit}-এ কত পিস তৈরি হবে)</span>
                          </div>
                          <span className="text-[10px] text-indigo-700 bg-white px-2.5 py-0.5 rounded-full font-bold border border-indigo-200 shadow-2xs">
                            Auto-calculates required {matUnit}s in Order Entry & Store Requisition
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                              Pieces Per 1 {matUnit} (UPS / Yield) <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                value={bomUps}
                                onChange={(e) => setBomUps(e.target.value)}
                                placeholder="e.g. 10000"
                                className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                                required
                              />
                              <span className="absolute right-2.5 top-2 text-[10px] font-bold text-neutral-400">Pcs / 1 {matUnit}</span>
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-0.5">
                              How many finished pieces come from 1 {matUnit}.
                            </p>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                              Primary Store Material ({matUnit})
                            </label>
                            <select
                              value={bomSheetItemId}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                const selected = items.find(i => i.id === selectedId);
                                setBomSheetItemId(selectedId);
                                if (selected) {
                                  const exists = bomItems.some(bi => bi.rawMaterialId === selected.id);
                                  if (!exists) {
                                    const upsNum = Math.max(1, Number(bomUps) || 1);
                                    const cons = Number((1 / upsNum).toFixed(6));
                                    const wst = Number(bomWastagePercent) || 0;
                                    setBomItems(prev => [
                                      ...prev,
                                      {
                                        rawMaterialId: selected.id,
                                        rawMaterialName: selected.name,
                                        sku: selected.sku || (selected as any).itemCode || '',
                                        unit: selected.unit || 'Roll',
                                        consumptionQty: cons,
                                        wastagePercent: wst,
                                        totalRequiredQty: Number((cons * (1 + wst / 100)).toFixed(6)),
                                        remarks: `Primary Material (${bomUps || 1} Pcs/${selected.unit || 'Roll'})`
                                      }
                                    ]);
                                  }
                                }
                              }}
                              className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs font-semibold text-neutral-900 focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">-- Optional: Link Store Material Item --</option>
                              {items.map(i => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.unit || 'Unit'} - Stock: {i.currentStock ?? (i as any).quantity ?? 0})
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-neutral-500 mt-0.5">
                              Connects directly to raw material inventory.
                            </p>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                              Wastage % (Optional)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={bomWastagePercent}
                                onChange={(e) => setBomWastagePercent(e.target.value)}
                                className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-neutral-900"
                              />
                              <span className="absolute right-2.5 top-2 text-[10px] font-bold text-neutral-400">%</span>
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-0.5">
                              Production / cutting wastage buffer.
                            </p>
                          </div>
                        </div>

                        {/* Formula Calculation Summary Box */}
                        <div className="p-2 bg-white rounded-lg border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded">Formula</span>
                            <span className="text-neutral-700">
                              <strong>1 {matUnit} = {upsVal.toLocaleString()} Pcs</strong> (Consumption: <strong className="font-mono text-indigo-700">{(1 / upsVal).toFixed(6)} {matUnit}/Pc</strong>)
                            </span>
                          </div>
                          <span className="text-neutral-600 text-[11px]">
                            Sample Order 49,225 Pcs ÷ {upsVal.toLocaleString()} = <strong className="font-mono text-indigo-900">{(49225 / upsVal).toFixed(4)} {matUnit}</strong> (Round: <strong className="font-bold text-emerald-700">{Math.ceil(49225 / upsVal)} {matUnit}</strong>)
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Raw Material Rows */}
                  <div className="space-y-2 border-t border-neutral-200 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-neutral-800 uppercase tracking-wider">Raw Material Composition (Formula per 1 {bomUnit || 'Unit'})</h4>
                        <p className="text-[10px] text-neutral-500">Pick materials from inventory store to ensure automated stock availability checks during Order Entry.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBomItems([
                            ...bomItems,
                            { rawMaterialId: '', rawMaterialName: '', unit: 'Kg', consumptionQty: 1, wastagePercent: 2, totalRequiredQty: 1.02 }
                          ]);
                        }}
                        className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Material
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-neutral-100 border-b border-neutral-200 font-bold uppercase text-[10px]">
                            <th className="p-2.5">Raw Material Item</th>
                            <th className="p-2.5 w-24">Store Stock</th>
                            <th className="p-2.5 w-20">Unit</th>
                            <th className="p-2.5 w-24">Cons. Qty</th>
                            <th className="p-2.5 w-20">Wastage %</th>
                            <th className="p-2.5 w-28">Total Req. / Pc</th>
                            <th className="p-2.5 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {bomItems.map((item, idx) => {
                            const matchedInvItem = items.find(i => i.id === item.rawMaterialId || (i.name && item.rawMaterialName && i.name.toLowerCase() === item.rawMaterialName.toLowerCase()));
                            const currentStock = Number(matchedInvItem?.currentStock || (matchedInvItem as any)?.quantity || 0);

                            return (
                              <tr key={idx} className="hover:bg-neutral-50/80">
                                <td className="p-2">
                                  <select
                                    value={item.rawMaterialId}
                                    onChange={(e) => {
                                      const selectedItem = items.find(i => i.id === e.target.value);
                                      const newArr = [...bomItems];
                                      newArr[idx] = {
                                        ...newArr[idx],
                                        rawMaterialId: e.target.value,
                                        rawMaterialName: selectedItem?.name || '',
                                        unit: selectedItem?.unit || 'Kg',
                                        sku: selectedItem?.sku || (selectedItem as any)?.itemCode || ''
                                      };
                                      setBomItems(newArr);
                                    }}
                                    className="w-full p-1.5 bg-white border border-neutral-300 rounded font-semibold text-neutral-800"
                                  >
                                    <option value="">-- Select Store Material --</option>
                                    {items.map(i => (
                                      <option key={i.id} value={i.id}>
                                        {i.name} {i.sku ? `[${i.sku}]` : ''} ({i.unit || 'Kg'} - Stock: {i.currentStock ?? (i as any).quantity ?? 0})
                                      </option>
                                    ))}
                                  </select>
                                  {item.rawMaterialName && !item.rawMaterialId && (
                                    <input
                                      type="text"
                                      value={item.rawMaterialName}
                                      onChange={(e) => {
                                        const newArr = [...bomItems];
                                        newArr[idx].rawMaterialName = e.target.value;
                                        setBomItems(newArr);
                                      }}
                                      placeholder="Material Name"
                                      className="mt-1 w-full p-1 bg-white border rounded text-xs"
                                    />
                                  )}
                                </td>
                                <td className="p-2 font-mono text-[11px] font-bold text-neutral-700">
                                  <span className={`px-1.5 py-0.5 rounded ${currentStock > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-neutral-100 text-neutral-500'}`}>
                                    {currentStock.toLocaleString()} {item.unit || ''}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <input type="text" value={item.unit} onChange={(e) => {
                                    const newArr = [...bomItems];
                                    newArr[idx].unit = e.target.value;
                                    setBomItems(newArr);
                                  }} className="w-full p-1.5 bg-white border rounded text-center font-bold" />
                                </td>
                                <td className="p-2">
                                  <input type="number" step="0.0001" value={item.consumptionQty} onChange={(e) => {
                                    const newArr = [...bomItems];
                                    const cons = Number(e.target.value);
                                    newArr[idx].consumptionQty = cons;
                                    newArr[idx].totalRequiredQty = Number((cons * (1 + (newArr[idx].wastagePercent || 0) / 100)).toFixed(4));
                                    setBomItems(newArr);
                                  }} className="w-full p-1.5 bg-white border rounded text-right font-bold text-indigo-900" />
                                </td>
                                <td className="p-2">
                                  <input type="number" value={item.wastagePercent} onChange={(e) => {
                                    const newArr = [...bomItems];
                                    const wst = Number(e.target.value);
                                    newArr[idx].wastagePercent = wst;
                                    newArr[idx].totalRequiredQty = Number(((newArr[idx].consumptionQty || 0) * (1 + wst / 100)).toFixed(4));
                                    setBomItems(newArr);
                                  }} className="w-full p-1.5 bg-white border rounded text-right" />
                                </td>
                                <td className="p-2 font-black text-indigo-900 text-right font-mono text-xs">
                                  {item.totalRequiredQty} <span className="text-[10px] text-neutral-400 font-normal">{item.unit}</span>
                                </td>
                                <td className="p-2 text-center">
                                  <button type="button" onClick={() => setBomItems(bomItems.filter((_, i) => i !== idx))} className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                    <button type="button" onClick={() => { setShowBomModal(false); setExistingBomWarning(null); }} className="px-4 py-2 border rounded-lg text-xs font-bold text-neutral-700">Cancel</button>
                    <button type="submit" disabled={!!existingBomWarning} className={`px-4 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 ${existingBomWarning ? 'bg-neutral-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                      <Save className="w-3.5 h-3.5" /> Save BOM Master
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB 4: PRODUCTION STATUS --- */}
      {subTab === 'production-status' && (
        <div className="space-y-6">
          {/* WO Selector Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-neutral-400" />
              <label className="text-xs font-bold text-neutral-700 whitespace-nowrap">Search Work Order No:</label>
              <select
                value={selectedWoId}
                onChange={(e) => setSelectedWoId(e.target.value)}
                className="p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:bg-white w-64"
              >
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>{wo.woNumber} - {wo.finishedGoodsName || 'Product'}</option>
                ))}
              </select>
            </div>

            {activeWo && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPrintWo(activeWo);
                    setShowPrintReportModal(true);
                  }}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Status Report
                </button>
                <button
                  onClick={() => handleExportExcel(activeWo)}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                </button>
              </div>
            )}
          </div>

          {activeWo && activeWoStats ? (
            <div className="space-y-6">
              {/* Top Work Order Info & Production Summary Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Work Order Info */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider border-b pb-2">Work Order Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-neutral-500 block">Work Order No:</span><span className="font-mono font-bold text-indigo-900">{activeWo.woNumber}</span></div>
                    <div><span className="text-neutral-500 block">Customer:</span><span className="font-bold text-neutral-900">{activeWo.customerName}</span></div>
                    <div><span className="text-neutral-500 block">Buyer:</span><span className="font-bold text-neutral-800">{activeWo.buyerName}</span></div>
                    <div><span className="text-neutral-500 block">PO No:</span><span className="font-mono font-bold">{activeWo.poNo || 'N/A'}</span></div>
                    <div><span className="text-neutral-500 block">Product Item:</span><span className="font-bold text-neutral-900">{activeWo.finishedGoodsName}</span></div>
                    <div><span className="text-neutral-500 block">Delivery Date:</span><span className="font-bold text-neutral-800">{activeWo.deliveryDate || 'N/A'}</span></div>
                  </div>
                </div>

                {/* Production Summary Metrics */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider border-b pb-2">Production & Delivery Summary</h3>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-2 bg-neutral-50 rounded-lg"><span className="text-neutral-500 text-[10px] block">Order Qty</span><span className="font-black text-neutral-900 text-sm">{activeWoStats.orderQty.toLocaleString()}</span></div>
                    <div className="p-2 bg-emerald-50 rounded-lg"><span className="text-emerald-700 text-[10px] block">Produced Qty</span><span className="font-black text-emerald-800 text-sm">{activeWoStats.producedQty.toLocaleString()}</span></div>
                    <div className="p-2 bg-rose-50 rounded-lg"><span className="text-rose-700 text-[10px] block">Prod. Balance</span><span className="font-black text-rose-800 text-sm">{activeWoStats.balanceQty.toLocaleString()}</span></div>
                    <div className="p-2 bg-amber-50 rounded-lg"><span className="text-amber-700 text-[10px] block">Rejected Qty</span><span className="font-black text-amber-800 text-sm">{activeWoStats.totalRejectQty.toLocaleString()}</span></div>
                    <div className="p-2 bg-teal-50 rounded-lg"><span className="text-teal-700 text-[10px] block">Avail. for Deliv.</span><span className="font-black text-teal-800 text-sm">{activeWoStats.readyForDelivery.toLocaleString()}</span></div>
                    <div className="p-2 bg-cyan-50 rounded-lg"><span className="text-cyan-700 text-[10px] block">Delivered Qty</span><span className="font-black text-cyan-800 text-sm">{activeWoStats.deliveredQty.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Donut Chart Visualization */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Visual Progress Bar Card */}
                <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Overall Production Completion</h3>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-4xl font-black text-indigo-900">{activeWoStats.progressPercent}%</span>
                      <span className="text-xs text-neutral-500 font-bold">{activeWoStats.producedQty.toLocaleString()} / {activeWoStats.orderQty.toLocaleString()} Pcs</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-neutral-100 rounded-full h-4 overflow-hidden border border-neutral-200 p-0.5">
                      <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${activeWoStats.progressPercent}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-emerald-700">Completed: {activeWoStats.producedQty.toLocaleString()} Pcs</span>
                      <span className="text-rose-600">Remaining: {activeWoStats.balanceQty.toLocaleString()} Pcs</span>
                    </div>
                  </div>
                </div>

                {/* Production Donut Chart */}
                <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-around gap-4">
                  <div className="w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Completed', value: activeWoStats.producedQty },
                            { name: 'Remaining', value: activeWoStats.balanceQty }
                          ]}
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#f43f5e" />
                        </Pie>
                        <RechartsTooltip formatter={(val: any) => `${Number(val).toLocaleString()} Pcs`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 text-xs">
                    <h4 className="font-bold text-neutral-900 border-b pb-1">Realtime Production Distribution</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                      <span className="font-bold text-neutral-700">Completed Qty:</span>
                      <span className="font-mono font-bold text-emerald-800">{activeWoStats.producedQty.toLocaleString()} Pcs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
                      <span className="font-bold text-neutral-700">Remaining Qty:</span>
                      <span className="font-mono font-bold text-rose-800">{activeWoStats.balanceQty.toLocaleString()} Pcs</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Process Sequence Timeline */}
              <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Process Workflow Timeline</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {activeWoStats.woProcs.map((proc, idx) => (
                    <React.Fragment key={proc.id || idx}>
                      <div className={`p-3 rounded-xl border text-xs min-w-36 space-y-1 ${
                        proc.status === 'Completed' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                        proc.status === 'Running' || proc.status === 'Partially Completed' ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-400' :
                        'bg-neutral-50 border-neutral-200 text-neutral-600'
                      }`}>
                        <div className="flex items-center justify-between font-bold">
                          <span>{proc.processName}</span>
                          {proc.status === 'Completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        </div>
                        <span className="text-[10px] block font-mono">
                          {proc.completedQty?.toLocaleString() || 0} / {proc.plannedQty.toLocaleString()} Pcs
                        </span>
                        <span className="text-[9px] font-bold block uppercase">{proc.status}</span>
                      </div>
                      {idx < activeWoStats.woProcs.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-neutral-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-neutral-400 bg-white rounded-xl border border-dashed border-neutral-300">
              No Work Order selected. Please choose a Work Order from the dropdown above.
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB 5: WO DETAILS --- */}
      {subTab === 'production-details' && (
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Work Order Wise Production Transaction History</h2>
              <p className="text-xs text-neutral-500">Comprehensive audit log of all process completions and operator entries</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-200 font-bold uppercase text-[10px]">
                  <th className="p-3">Date</th>
                  <th className="p-3">WO No</th>
                  <th className="p-3">Process</th>
                  <th className="p-3 text-right">Input Qty</th>
                  <th className="p-3 text-right">Completed Qty</th>
                  <th className="p-3 text-right">Reject Qty</th>
                  <th className="p-3">Operator</th>
                  <th className="p-3">Machine</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-neutral-500 italic">No production transaction logs recorded yet.</td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-neutral-50">
                      <td className="p-3 font-mono">{tx.date}</td>
                      <td className="p-3 font-mono font-bold text-indigo-900">{tx.woNumber}</td>
                      <td className="p-3 font-bold">{tx.processName}</td>
                      <td className="p-3 text-right">{tx.inputQty?.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">{tx.completedQty?.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-rose-600">{tx.rejectQty?.toLocaleString()}</td>
                      <td className="p-3">{tx.employee || 'N/A'}</td>
                      <td className="p-3">{tx.machine || 'N/A'}</td>
                      <td className="p-3 text-neutral-500">{tx.remarks || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SUBTAB 6: REQUISITION --- */}
      {subTab === 'production-requisition' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Production Requisitions & Material Issue</h2>
              <p className="text-xs text-neutral-500">Calculate exact sheet requirements from Sales Orders, add extra sheets with remarks, and issue directly from store stock</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setReqWoId('');
                  setReqBaseSheets(0);
                  setReqExtraSheets(0);
                  setReqExtraRemarks('');
                  setReqRemarks('');
                  setReqItems([]);
                  setReqSelectedBom(null);
                  setShowReqModal(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Requisition
              </button>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by Req No, WO No, Product, Store..."
                value={reqSearchQuery}
                onChange={(e) => setReqSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent border-none outline-hidden placeholder-neutral-400"
              />
              {reqSearchQuery && (
                <button onClick={() => setReqSearchQuery('')} className="text-neutral-400 hover:text-neutral-600 text-xs">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs font-medium self-start sm:self-auto">
              {(['all', 'pending', 'issued', 'rejected'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setReqStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md text-xs transition-colors capitalize font-bold ${
                    reqStatusFilter === tab
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {tab === 'all' ? 'All Requisitions' : tab === 'pending' ? 'Pending Store Issue' : tab === 'issued' ? 'Issued from Stock' : 'Rejected'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-200 font-bold uppercase text-[10px] text-neutral-600">
                  <th className="p-3">Req No & Date</th>
                  <th className="p-3">Work Order / Job</th>
                  <th className="p-3">Product & Style</th>
                  <th className="p-3 text-right">Sales Order Sheets</th>
                  <th className="p-3 text-right">Extra Sheets</th>
                  <th className="p-3 text-right">Total Req Sheets</th>
                  <th className="p-3">Store</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {requisitions
                  .filter(req => {
                    const matchFilter = reqStatusFilter === 'all' || req.status === reqStatusFilter;
                    const q = reqSearchQuery.toLowerCase().trim();
                    const matchSearch = !q || 
                      req.reqNo?.toLowerCase().includes(q) ||
                      req.woNumber?.toLowerCase().includes(q) ||
                      req.productName?.toLowerCase().includes(q) ||
                      req.store?.toLowerCase().includes(q);
                    return matchFilter && matchSearch;
                  })
                  .length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-neutral-500 italic">
                      No production requisitions matching current filters.
                    </td>
                  </tr>
                ) : (
                  requisitions
                    .filter(req => {
                      const matchFilter = reqStatusFilter === 'all' || req.status === reqStatusFilter;
                      const q = reqSearchQuery.toLowerCase().trim();
                      const matchSearch = !q || 
                        req.reqNo?.toLowerCase().includes(q) ||
                        req.woNumber?.toLowerCase().includes(q) ||
                        req.productName?.toLowerCase().includes(q) ||
                        req.store?.toLowerCase().includes(q);
                      return matchFilter && matchSearch;
                    })
                    .map(req => (
                      <tr key={req.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="p-3">
                          <span className="font-mono font-bold text-indigo-900 block">{req.reqNo}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">{req.date}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-neutral-900 block">{req.woNumber}</span>
                          <span className="text-[10px] text-neutral-500">{req.productionQty?.toLocaleString()} Pcs</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-neutral-900 block">{req.productName}</span>
                          {req.bomNo && <span className="text-[10px] text-neutral-500 font-mono">BOM: {req.bomNo}</span>}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-neutral-800">
                          {req.baseSheets ? `${req.baseSheets.toLocaleString()} Shts` : '-'}
                        </td>
                        <td className="p-3 text-right">
                          {req.extraSheets && req.extraSheets > 0 ? (
                            <div>
                              <span className="font-mono font-bold text-amber-700">+{req.extraSheets.toLocaleString()}</span>
                              {req.extraRemarks && (
                                <span className="block text-[10px] text-neutral-500 italic truncate max-w-32 text-right ml-auto" title={req.extraRemarks}>
                                  {req.extraRemarks}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-900 text-sm">
                          {(req.totalSheets || (req.baseSheets ? (req.baseSheets + (req.extraSheets || 0)) : req.items[0]?.requiredQty))?.toLocaleString()} Shts
                        </td>
                        <td className="p-3 font-medium text-neutral-700">{req.store}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'issued' ? 'bg-emerald-100 text-emerald-800' :
                            req.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {req.status === 'issued' ? 'Issued from Stock' : req.status === 'pending' ? 'Pending Store' : 'Rejected'}
                          </span>
                          {req.issuedAt && (
                            <span className="block text-[9px] text-neutral-400 mt-0.5">
                              {req.issuedBy || 'Store In-Charge'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Confirmation & Issue Button */}
                            {req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => triggerConfirmRequisition(req)}
                                  disabled={isConfirmingReqId === req.id || isViewer}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                  title="Confirm and deduct raw materials from store inventory"
                                >
                                  {isConfirmingReqId === req.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  Confirm & Issue
                                </button>
                                <button
                                  onClick={() => triggerRejectRequisition(req)}
                                  disabled={isViewer}
                                  className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Reject Requisition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Print Requisition Slip Button */}
                            <button
                              onClick={() => {
                                setSelectedReqForPrint(req);
                                setIsPrintSlipModalOpen(true);
                              }}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold transition-colors"
                              title="Print Store Requisition Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {/* Create Requisition Modal with Sales Order Sheet Integration & Extra Quantity */}
          {showReqModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Create Production Requisition to Store</h3>
                    <p className="text-xs text-neutral-500">Pulls exact sheet requirements from Sales Order Breakdown with extra quantity allowances</p>
                  </div>
                  <button onClick={() => setShowReqModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveRequisition} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Select Work Order <span className="text-rose-500">*</span></label>
                      <select
                        value={reqWoId}
                        onChange={(e) => handleSelectWoForRequisition(e.target.value)}
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        required
                      >
                        <option value="">-- Select Confirmed Work Order --</option>
                        {workOrders.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.woNumber} - {w.finishedGoodsName || w.style} ({w.totalQuantity?.toLocaleString()} Pcs)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Target Store Location</label>
                      <select
                        value={reqStore}
                        onChange={(e) => setReqStore(e.target.value)}
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      >
                        <option value="Main Store">Main Store</option>
                        <option value="Raw Material Store">Raw Material Store</option>
                        <option value="Paper & Board Store">Paper & Board Store</option>
                        <option value="Production Floor Store">Production Floor Store</option>
                      </select>
                    </div>
                  </div>

                  {/* Work Order & Sales Order Sheet Information Banner */}
                  {reqWoId && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-900 font-bold">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          <span>Sales Order Material Requirement Parity</span>
                        </div>
                        {reqSelectedBom && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-mono text-[10px] font-bold">
                            BOM: {reqSelectedBom.bomNo} (UPS: {reqSelectedBom.ups || 1})
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-indigo-100 text-neutral-800">
                        <div>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase block">Work Order Qty</span>
                          <span className="font-mono font-black text-sm text-neutral-900">
                            {workOrders.find(w => w.id === reqWoId)?.totalQuantity?.toLocaleString()} Pcs
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase block">SO Material Requirement</span>
                          <span className="font-mono font-black text-sm text-indigo-900">
                            {reqBaseSheets.toLocaleString()} {reqItems[0]?.unit ? (reqItems[0].unit === 'Roll' ? 'Rolls' : reqItems[0].unit === 'Sheet' ? 'Sheets' : reqItems[0].unit) : 'Units'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase block">Extra Allowance Added</span>
                          <span className="font-mono font-black text-sm text-amber-700">
                            +{Number(reqExtraSheets || 0).toLocaleString()} {reqItems[0]?.unit ? (reqItems[0].unit === 'Roll' ? 'Rolls' : reqItems[0].unit === 'Sheet' ? 'Sheets' : reqItems[0].unit) : 'Units'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase block">Total Requisition Quantity</span>
                          <span className="font-mono font-black text-sm text-emerald-800">
                            {(reqBaseSheets + Math.max(0, Number(reqExtraSheets) || 0)).toLocaleString()} {reqItems[0]?.unit ? (reqItems[0].unit === 'Roll' ? 'Rolls' : reqItems[0].unit === 'Sheet' ? 'Sheets' : reqItems[0].unit) : 'Units'}
                          </span>
                        </div>
                      </div>

                      {/* Extra Quantity and Remarks Input Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="font-bold text-neutral-700 block mb-1">
                            Extra Sheet Quantity (Allowance / Buffer)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0 (e.g. 50 extra sheets)"
                            value={reqExtraSheets}
                            onChange={(e) => handleUpdateExtraSheets(e.target.value, reqExtraRemarks)}
                            className="w-full p-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-neutral-700 block mb-1">
                            Reason / Remark for Extra Quantity
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Extra for color setup / cutting buffer"
                            value={reqExtraRemarks}
                            onChange={(e) => handleUpdateExtraSheets(reqExtraSheets, e.target.value)}
                            className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Calculated Raw Material Requirements Table */}
                  {reqItems.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold uppercase text-[10px] text-neutral-500 tracking-wider">
                          Calculated Raw Material Requisition List
                        </h4>
                        <span className="text-[10px] text-neutral-400">Values synchronized with Sales Order & BOM</span>
                      </div>

                      <div className="border border-neutral-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-neutral-100 font-bold uppercase text-[10px] text-neutral-600">
                              <th className="p-2.5">Material Name</th>
                              <th className="p-2.5 text-right">Required Requisition Qty</th>
                              <th className="p-2.5 text-right">Current Stock</th>
                              <th className="p-2.5 text-right">Shortage</th>
                              <th className="p-2.5">Unit</th>
                              <th className="p-2.5">Remarks / Calculation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {reqItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50">
                                <td className="p-2.5 font-bold text-neutral-900">{item.rawMaterialName}</td>
                                <td className="p-2.5 text-right font-mono font-black text-indigo-900">
                                  {item.requiredQty.toLocaleString()}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                                  {item.availableStock.toLocaleString()}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold">
                                  {item.shortageQty > 0 ? (
                                    <span className="text-rose-600">-{item.shortageQty.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-emerald-600">Sufficient</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-medium">{item.unit}</td>
                                <td className="p-2.5 text-neutral-500 text-[11px]">{item.remarks || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">General Requisition Notes</label>
                    <textarea
                      rows={2}
                      value={reqRemarks}
                      onChange={(e) => setReqRemarks(e.target.value)}
                      placeholder="Optional notes for store department regarding this issue..."
                      className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowReqModal(false)}
                      className="px-4 py-2 border border-neutral-300 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      Submit Requisition (Send for Confirmation)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Printable Store Requisition Slip Modal */}
          {isPrintSlipModalOpen && selectedReqForPrint && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 text-black print:p-0 print:m-0 print:border-none print:shadow-none">
                {/* Header Actions */}
                <div className="flex items-center justify-between border-b pb-4 print:hidden">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold">
                    <Printer className="w-5 h-5 text-indigo-600" />
                    <span>Store Requisition & Material Issue Voucher</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printElement('printable-prod-slip', { title: `Requisition_Slip_${selectedReqForPrint?.reqNo || 'Doc'}` })}
                      className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Print Slip
                    </button>
                    <button
                      onClick={() => {
                        setIsPrintSlipModalOpen(false);
                        setSelectedReqForPrint(null);
                      }}
                      className="p-2 border rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Printable Document Content */}
                <div id="printable-prod-slip" className="printable-doc space-y-6">
                  {/* Company Header */}
                  <div className="border-b-2 border-black pb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                        alt="ES Trims Limited"
                        className="h-14 w-14 object-contain shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                      />
                      <div className="text-left">
                        <h1 className="text-2xl font-black tracking-wide uppercase">ES TRIMS LIMITED</h1>
                        <p className="text-[11px] text-neutral-700 font-medium">ES Trims Limited, C-15 panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400</p>
                      </div>
                    </div>
                    <div className="px-4 py-1.5 bg-neutral-900 text-white rounded text-xs font-black tracking-widest uppercase shrink-0">
                      STORE REQUISITION & ISSUE VOUCHER
                    </div>
                  </div>

                  {/* Requisition Meta Details */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 rounded-lg border border-neutral-300">
                    <div className="space-y-1.5">
                      <div><span className="font-bold text-neutral-600">Requisition No:</span> <span className="font-mono font-black text-indigo-900">{selectedReqForPrint.reqNo}</span></div>
                      <div><span className="font-bold text-neutral-600">Work Order No:</span> <span className="font-mono font-bold text-neutral-900">{selectedReqForPrint.woNumber}</span></div>
                      <div><span className="font-bold text-neutral-600">Product / Style:</span> <span className="font-bold text-neutral-900">{selectedReqForPrint.productName}</span></div>
                      <div><span className="font-bold text-neutral-600">Production Qty:</span> <span className="font-bold">{selectedReqForPrint.productionQty?.toLocaleString()} Pcs</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <div><span className="font-bold text-neutral-600">Date:</span> <span className="font-mono">{selectedReqForPrint.date}</span></div>
                      <div><span className="font-bold text-neutral-600">Store Department:</span> <span>{selectedReqForPrint.store}</span></div>
                      <div>
                        <span className="font-bold text-neutral-600">Status:</span>{' '}
                        <span className="font-bold uppercase text-emerald-800">
                          {selectedReqForPrint.status === 'issued' ? 'CONFIRMED & ISSUED' : selectedReqForPrint.status}
                        </span>
                      </div>
                      {selectedReqForPrint.issuedBy && (
                        <div><span className="font-bold text-neutral-600">Issued By:</span> <span>{selectedReqForPrint.issuedBy}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Sheet Calculation Summary Banner */}
                  {(selectedReqForPrint.baseSheets || selectedReqForPrint.extraSheets) && (
                    <div className="border border-neutral-400 p-3 rounded-lg bg-neutral-50 text-xs">
                      <div className="font-bold uppercase text-[10px] text-neutral-600 mb-1 border-b pb-1">
                        Sheet Breakdown & Extra Allowances
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-mono">
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Sales Order Base Sheets:</span>
                          <span className="font-black">{selectedReqForPrint.baseSheets?.toLocaleString() || 0} Shts</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Extra Allowance Sheets:</span>
                          <span className="font-black text-amber-800">+{selectedReqForPrint.extraSheets?.toLocaleString() || 0} Shts</span>
                          {selectedReqForPrint.extraRemarks && (
                            <span className="text-[10px] text-neutral-500 block italic font-sans">{selectedReqForPrint.extraRemarks}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Total Requisition Sheets:</span>
                          <span className="font-black text-emerald-900 text-sm">{selectedReqForPrint.totalSheets?.toLocaleString() || (selectedReqForPrint.baseSheets! + (selectedReqForPrint.extraSheets || 0))} Shts</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Materials Table */}
                  <div className="border border-black rounded overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-200 border-b border-black font-bold uppercase text-[10px]">
                          <th className="p-2 border-r border-black w-10 text-center">SL</th>
                          <th className="p-2 border-r border-black">Raw Material Description</th>
                          <th className="p-2 border-r border-black text-right">Required Qty</th>
                          <th className="p-2 border-r border-black text-center">Unit</th>
                          <th className="p-2">Remarks / Extra Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-300 font-medium">
                        {selectedReqForPrint.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 border-r border-black text-center font-mono">{idx + 1}</td>
                            <td className="p-2 border-r border-black font-bold">{item.rawMaterialName}</td>
                            <td className="p-2 border-r border-black text-right font-mono font-black">{item.requiredQty.toLocaleString()}</td>
                            <td className="p-2 border-r border-black text-center">{item.unit}</td>
                            <td className="p-2 text-neutral-600 text-[11px]">{item.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Notes */}
                  {selectedReqForPrint.remarks && (
                    <div className="text-xs text-neutral-700 border-l-2 border-indigo-600 pl-3">
                      <span className="font-bold">Requisition Remarks:</span> {selectedReqForPrint.remarks}
                    </div>
                  )}

                  {/* Signature Section */}
                  <div className="grid grid-cols-4 gap-4 pt-14 text-center text-xs font-bold">
                    <div>
                      <div className="border-t border-black pt-1">Prepared By</div>
                      <span className="text-[10px] font-normal text-neutral-500">Production In-Charge</span>
                    </div>
                    <div>
                      <div className="border-t border-black pt-1">Issued By</div>
                      <span className="text-[10px] font-normal text-neutral-500">Store In-Charge</span>
                    </div>
                    <div>
                      <div className="border-t border-black pt-1">Received By</div>
                      <span className="text-[10px] font-normal text-neutral-500">Floor Supervisor</span>
                    </div>
                    <div>
                      <div className="border-t border-black pt-1">Authorized By</div>
                      <span className="text-[10px] font-normal text-neutral-500">Factory Manager</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB: PROCESS MASTER --- */}
      {subTab === 'production-process-master' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Production Process Master
              </h2>
              <p className="text-xs text-neutral-500 font-medium">
                Configure manufacturing, offset printing, and finishing routing steps linked with factory sections
              </p>
            </div>

            {!isViewer && (
              <button
                type="button"
                onClick={() => handleOpenAddProcessModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 self-start md:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add New Process
              </button>
            )}
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={processSearchTerm}
                onChange={(e) => setProcessSearchTerm(e.target.value)}
                placeholder="Search by process name, code, or section..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={selectedProcessSectionFilter}
                onChange={(e) => setSelectedProcessSectionFilter(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- All Sections / Departments --</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code || 'N/A'})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Process List Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-100/80 border-b border-neutral-200 text-neutral-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-3.5 text-center w-12">Seq</th>
                    <th className="p-3.5">Process Code</th>
                    <th className="p-3.5">Process Name</th>
                    <th className="p-3.5">Section / Department</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredProcesses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                        {productionProcesses.length === 0 
                          ? 'No production processes created yet. Click "+ Add New Process" to add one.'
                          : 'No processes matched your filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProcesses.map((proc) => (
                      <tr key={proc.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="p-3.5 text-center font-mono font-bold text-neutral-500">
                          {proc.sequenceOrder || '-'}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-indigo-700">
                          {proc.processCode}
                        </td>
                        <td className="p-3.5 font-bold text-neutral-900">
                          {proc.processName}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-md font-bold text-[11px]">
                            {proc.sectionName || 'General Section'}
                          </span>
                        </td>
                        <td className="p-3.5 text-neutral-600 max-w-xs truncate">
                          {proc.description || '-'}
                        </td>
                        <td className="p-3.5 text-center">
                          {!isViewer && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenAddProcessModal(proc)}
                                className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit Process"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProcess(proc.id)}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete Process"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

      {/* --- MODAL: ADD / EDIT PROCESS --- */}
      {showAddProcessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                {editingProcess ? 'Edit Production Process' : 'Add New Production Process'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddProcessModal(false);
                  setEditingProcess(null);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProcess} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Section / Department <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newProcessSectionId}
                  onChange={(e) => setNewProcessSectionId(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg font-bold"
                  required
                >
                  <option value="">-- Select Section --</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code || 'N/A'})</option>
                  ))}
                </select>
                {sections.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Tip: Create sections in Master Setup &gt; Section Master first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Process Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProcessCode}
                    onChange={(e) => setNewProcessCode(e.target.value)}
                    placeholder="e.g. PROC-01"
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono uppercase font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Sequence Order <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newProcessSeq}
                    onChange={(e) => setNewProcessSeq(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    min={1}
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Process Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProcessName}
                  onChange={(e) => setNewProcessName(e.target.value)}
                  placeholder="e.g. Offset Printing, Die Cutting, Lamination"
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Description / Notes</label>
                <textarea
                  value={newProcessDesc}
                  onChange={(e) => setNewProcessDesc(e.target.value)}
                  placeholder="Brief details about standard operating procedure or machine setup..."
                  rows={3}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProcessModal(false);
                    setEditingProcess(null);
                  }}
                  className="px-4 py-2 border border-neutral-300 rounded-lg font-bold hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700"
                >
                  {editingProcess ? 'Update Process' : 'Save Process'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Production Report Modal */}
      {showPrintReportModal && printWo && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 text-black print:p-0">
            <div className="flex items-center justify-between border-b-2 border-black pb-4 print:hidden">
              <div>
                <h1 className="text-xl font-black uppercase">Production Status Report</h1>
                <p className="text-xs font-bold text-neutral-600">Work Order: {printWo.woNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => printElement('printable-prod-report', { title: `Production_Report_${printWo.woNumber}` })} 
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Document
                </button>
                <button onClick={() => setShowPrintReportModal(false)} className="p-1.5 border rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div id="printable-prod-report" className="printable-doc space-y-6">
              <div className="border-b-2 border-black pb-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                    alt="ES Trims Limited"
                    className="h-14 w-14 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                  />
                  <div className="text-left">
                    <h1 className="text-2xl font-black tracking-wide uppercase">ES TRIMS LIMITED</h1>
                    <p className="text-[11px] text-neutral-700 font-medium">ES Trims Limited, C-15 panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400</p>
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-neutral-900 text-white rounded text-xs font-black tracking-widest uppercase shrink-0">
                  PRODUCTION STATUS & PROCESS ROUTING REPORT
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 rounded-lg border border-neutral-300">
                <div><span className="font-bold text-neutral-600">Work Order No:</span> <span className="font-mono font-bold text-indigo-900">{printWo.woNumber}</span></div>
                <div><span className="font-bold text-neutral-600">Customer:</span> <span className="font-bold text-neutral-900">{printWo.customerName}</span></div>
                <div><span className="font-bold text-neutral-600">Buyer:</span> <span className="font-bold text-neutral-900">{printWo.buyerName}</span></div>
                <div><span className="font-bold text-neutral-600">Product:</span> <span className="font-bold text-neutral-900">{printWo.finishedGoodsName}</span></div>
                <div><span className="font-bold text-neutral-600">Order Qty:</span> <span className="font-black text-indigo-900">{printWo.totalQuantity?.toLocaleString()} {printWo.finishedGoodsUnit || 'Pcs'}</span></div>
              </div>

              {/* Selected Process Tracking Table */}
              {(() => {
                const stats = getWoProductionStats(printWo);
                return (
                  <div className="border border-black rounded overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-200 border-b border-black font-bold uppercase text-[10px]">
                          <th className="p-2 border-r border-black w-10 text-center">SL</th>
                          <th className="p-2 border-r border-black">Process Name</th>
                          <th className="p-2 border-r border-black text-right">Planned Qty</th>
                          <th className="p-2 border-r border-black text-right">Produced Qty</th>
                          <th className="p-2 border-r border-black text-right">Reject Qty</th>
                          <th className="p-2 border-r border-black text-right">Balance Qty</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-300 font-medium">
                        {stats.woProcs.map((proc, idx) => (
                          <tr key={proc.id || idx}>
                            <td className="p-2 border-r border-black text-center font-mono">{idx + 1}</td>
                            <td className="p-2 border-r border-black font-bold">{proc.processName}</td>
                            <td className="p-2 border-r border-black text-right font-mono">{proc.plannedQty?.toLocaleString() || 0}</td>
                            <td className="p-2 border-r border-black text-right font-mono font-bold text-emerald-800">{proc.completedQty?.toLocaleString() || 0}</td>
                            <td className="p-2 border-r border-black text-right font-mono text-amber-800">{proc.rejectQty?.toLocaleString() || 0}</td>
                            <td className="p-2 border-r border-black text-right font-mono font-bold text-rose-800">{proc.balanceQty?.toLocaleString() || 0}</td>
                            <td className="p-2 text-center font-bold uppercase text-[10px]">{proc.status}</td>
                          </tr>
                        ))}
                        {stats.woProcs.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-neutral-500 italic">No active production processes found for this Work Order.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Requisition Confirmation Modal */}
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
}
