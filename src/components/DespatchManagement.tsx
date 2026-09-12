import React, { useState, useEffect, useMemo } from 'react';
import { printElement } from '../utils/printHelper';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  Timestamp 
} from 'firebase/firestore';
import { 
  Truck, 
  FileText, 
  ShieldCheck, 
  Search, 
  Plus, 
  Printer, 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  Save, 
  Clock, 
  Package,
  Building2,
  Calendar,
  User as UserIcon,
  Check,
  AlertCircle,
  Edit3,
  Lock,
  Unlock,
  RotateCcw,
  CheckSquare,
  ShieldAlert,
  Trash2,
  ArrowRightLeft,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { 
  WorkOrder, 
  UserProfile, 
  DeliveryChallanRecord, 
  DeliveryChallanItem,
  GatePassRecord, 
  ProductionProcessExecution,
  Customer,
  RoleDefinition 
} from '../types';
import { CustomerMrrReceiptView } from './CustomerMrrReceiptView';

interface DespatchManagementProps {
  userProfile: UserProfile;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  activeSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
  allowedPagesSet?: Set<string>;
  roles?: RoleDefinition[];
}

function BarcodeSvg({ value, height = 36, className = "" }: { value: string; height?: number; className?: string }) {
  const str = value || "CLN-000001";
  const bars: { w: number; isSpace: boolean }[] = [
    { w: 2, isSpace: false }, { w: 2, isSpace: true }, { w: 2, isSpace: false }
  ];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bars.push({ w: (code % 3) + 1, isSpace: false });
    bars.push({ w: ((code >> 1) % 3) + 1, isSpace: true });
    bars.push({ w: ((code >> 2) % 3) + 1, isSpace: false });
    bars.push({ w: ((code >> 3) % 2) + 1, isSpace: true });
  }

  bars.push({ w: 2, isSpace: false }, { w: 2, isSpace: true }, { w: 2, isSpace: false });

  let totalW = 0;
  const rects = bars.map((bar, idx) => {
    const x = totalW;
    totalW += bar.w * 2;
    if (bar.isSpace) return null;
    return <rect key={idx} x={x} y={0} width={bar.w * 2} height={height} fill="black" />;
  });

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={Math.max(140, totalW)} height={height} viewBox={`0 0 ${totalW} ${height}`} className="max-w-full">
        {rects}
      </svg>
      <span className="font-mono font-bold text-[10px] tracking-widest text-black mt-0.5">{str}</span>
    </div>
  );
}

export function DespatchManagement({
  userProfile,
  showToast,
  activeSubTab = 'despatch-challan',
  onSubTabChange,
  allowedPagesSet,
  roles = []
}: DespatchManagementProps) {
  const isSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com';

  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  const allTabDefinitions = [
    { id: 'despatch-challan', label: 'Delivery Challan', icon: FileText },
    { id: 'despatch-report', label: 'Challan Register', icon: FileSpreadsheet },
    { id: 'despatch-gatepass', label: 'Gate Pass', icon: ShieldCheck },
    { id: 'despatch-received', label: 'Challan Received', icon: Clock },
    { id: 'despatch-mrr-receipt', label: 'Customer MRR Receipt', icon: CheckCircle2 },
  ];

  const availableTabs = useMemo(() => {
    return allTabDefinitions.filter(tab => isPagePermitted(tab.id)).map(t => t.id);
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

  const bId = userProfile.businessId;

  // Realtime Collections
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [challans, setChallans] = useState<DeliveryChallanRecord[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePassRecord[]>([]);
  const [processExecutions, setProcessExecutions] = useState<ProductionProcessExecution[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Delivery Challan Form State
  const [selectedWoId, setSelectedWoId] = useState<string>('');
  const [challanDate, setChallanDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [piNo, setPiNo] = useState<string>('');
  const [woBagNo, setWoBagNo] = useState<string>('');
  const [fscCoc, setFscCoc] = useState<string>('N/A');
  const [invoiceAddress, setInvoiceAddress] = useState<string>('');
  const [invoiceContactPerson, setInvoiceContactPerson] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryContactPerson, setDeliveryContactPerson] = useState<string>('');
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverMobile, setDriverMobile] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<string>('Company Truck');
  const [totalBox, setTotalBox] = useState<string>('1 Box');
  const [currentDeliveryQty, setCurrentDeliveryQty] = useState<number>(0);
  
  // Multi-item breakdown state for Challan
  const [challanItems, setChallanItems] = useState<DeliveryChallanItem[]>([]);

  // Gate Pass Form State
  const [showGatePassModal, setShowGatePassModal] = useState<boolean>(false);
  const [gpChallanId, setGpChallanId] = useState<string>('');
  const [gpRemarks, setGpRemarks] = useState<string>('');
  const [gatePassSubView, setGatePassSubView] = useState<'pending-challans' | 'issued-passes'>('pending-challans');
  const [gpApprovalFilter, setGpApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectingGatePass, setRejectingGatePass] = useState<GatePassRecord | null>(null);
  const [gpRejectReason, setGpRejectReason] = useState<string>('');

  // Edit Delivery Challan Modal State (For Unlocked Challans)
  const [editingChallan, setEditingChallan] = useState<DeliveryChallanRecord | null>(null);
  const [editDeliveryQty, setEditDeliveryQty] = useState<number>(0);
  const [editVehicleNo, setEditVehicleNo] = useState<string>('');
  const [editDriverName, setEditDriverName] = useState<string>('');
  const [editDriverMobile, setEditDriverMobile] = useState<string>('');
  const [editDeliveryType, setEditDeliveryType] = useState<string>('Company Truck');
  const [editTotalBox, setEditTotalBox] = useState<string>('1 Box');
  const [editDeliveryAddress, setEditDeliveryAddress] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [editItems, setEditItems] = useState<DeliveryChallanItem[]>([]);
  const [selectedBreakdownToAdd, setSelectedBreakdownToAdd] = useState<string>('');
  const [qtyToAdd, setQtyToAdd] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Challans Awaiting Gate Pass Issuance (Challan created but Gate Pass not issued yet)
  const challansAwaitingGatePass = useMemo(() => {
    return challans.filter(c => {
      if (c.status === 'cancelled' || c.receivedStatus === 'rejected') return false;
      const hasActiveGp = gatePasses.some(gp => gp.challanId === c.id && gp.status !== 'cancelled');
      return !hasActiveGp;
    });
  }, [challans, gatePasses]);

  // Set of Challan IDs that have an APPROVED Gate Pass
  const approvedGatePassChallanIds = useMemo(() => {
    const ids = new Set<string>();
    gatePasses.forEach(gp => {
      if (gp.status !== 'cancelled' && gp.approvalStatus === 'approved') {
        ids.add(gp.challanId);
      }
    });
    // Also include challans explicitly flagged as approved
    challans.forEach(c => {
      if (c.gatePassStatus === 'approved' || c.isLocked) {
        ids.add(c.id);
      }
    });
    return ids;
  }, [gatePasses, challans]);

  // Challans strictly cleared for Customer Receipt (ONLY Gate Pass Approved)
  const clearedForReceiptChallans = useMemo(() => {
    return challans.filter(c => {
      if (c.status === 'cancelled' || c.receivedStatus === 'rejected') return false;
      return approvedGatePassChallanIds.has(c.id) || c.gatePassStatus === 'approved';
    });
  }, [challans, approvedGatePassChallanIds]);

  // Challan Received Modal & Rejection State
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [receivingChallan, setReceivingChallan] = useState<DeliveryChallanRecord | null>(null);
  const [receiptMode, setReceiptMode] = useState<'receive' | 'reject'>('receive');
  const [receiveDate, setReceiveDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [receiverName, setReceiverName] = useState<string>('');
  const [verifiedQty, setVerifiedQty] = useState<number>(0);
  const [receiveRemarks, setReceiveRemarks] = useState<string>('Above goods are acknowledged and received in good condition.');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [isUpdatingReceipt, setIsUpdatingReceipt] = useState<boolean>(false);

  // Quick Receipt Bar & Search State
  const [selectedChallanForQuickReceipt, setSelectedChallanForQuickReceipt] = useState<string>('');
  const [receiptSearchNo, setReceiptSearchNo] = useState<string>('');

  // Challan Received Filtered List (Restricted strictly to Gate Pass Approved Challans)
  const receiptFilteredChallans = useMemo(() => {
    return clearedForReceiptChallans.filter(c => {
      const q = (receiptSearchNo || '').toLowerCase().trim();
      if (!q) return true;
      return (
        (c.challanNo || '').toLowerCase().includes(q) ||
        (c.woNumber || '').toLowerCase().includes(q) ||
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.poNo && c.poNo.toLowerCase().includes(q)) ||
        (c.productName && c.productName.toLowerCase().includes(q))
      );
    });
  }, [clearedForReceiptChallans, receiptSearchNo]);

  // Printable Challan / Gate Pass Modal State
  const [printableChallan, setPrintableChallan] = useState<DeliveryChallanRecord | null>(null);
  const [printableGatePass, setPrintableGatePass] = useState<GatePassRecord | null>(null);

  // Report Filter State
  const [searchChallanNo, setSearchChallanNo] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterCustomer, setFilterCustomer] = useState<string>('ALL');
  const [filterWoNumber, setFilterWoNumber] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Firestore Listeners
  useEffect(() => {
    if (!bId) return;

    const qWo = query(collection(db, 'work_orders'), where('businessId', '==', bId));
    const unsubWo = onSnapshot(qWo, (snap) => {
      setWorkOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder)));
    });

    const qDc = query(collection(db, 'delivery_challans'), where('businessId', '==', bId));
    const unsubDc = onSnapshot(qDc, (snap) => {
      setChallans(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryChallanRecord)));
    });

    const qGp = query(collection(db, 'gate_passes'), where('businessId', '==', bId));
    const unsubGp = onSnapshot(qGp, (snap) => {
      setGatePasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as GatePassRecord)));
    });

    const qProc = query(collection(db, 'production_executions'), where('businessId', '==', bId));
    const unsubProc = onSnapshot(qProc, (snap) => {
      setProcessExecutions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionProcessExecution)));
    });

    const qCust = query(collection(db, 'customers'), where('businessId', '==', bId));
    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    return () => {
      unsubWo();
      unsubDc();
      unsubGp();
      unsubProc();
      unsubCust();
    };
  }, [bId]);

  // Selected Work Order calculation for Delivery Challan
  const activeWo = useMemo(() => {
    if (!selectedWoId) return null;
    return workOrders.find(w => w.id === selectedWoId || w.woNumber === selectedWoId) || null;
  }, [selectedWoId, workOrders]);

  // Helper function to generate clean Challan No format: CLN-000001
  const generateNextChallanNo = () => {
    let maxSeq = 0;
    challans.forEach(c => {
      if (c.challanNo) {
        const match = c.challanNo.match(/CLN-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    });
    const nextSeq = maxSeq > 0 ? maxSeq + 1 : 1;
    return `CLN-${String(nextSeq).padStart(6, '0')}`;
  };

  // Check if current user is authorized to reject or cancel delivery challans
  const canRejectChallan = useMemo(() => {
    if (!userProfile) return false;
    const role = (userProfile.role || '').toLowerCase();
    const isPrivilegedRole =
      role.includes('admin') ||
      role.includes('super admin') ||
      role.includes('md') ||
      role.includes('gm') ||
      role.includes('managing director') ||
      role.includes('general manager') ||
      role.includes('sales manager') ||
      role.includes('commercial manager') ||
      role.includes('factory manager') ||
      role.includes('head of sales');

    const hasSpecialPerm =
      userProfile.specialPermissions?.canApprove === true ||
      userProfile.specialPermissions?.canDeleteTx === true;

    return isPrivilegedRole || hasSpecialPerm;
  }, [userProfile]);

  // Valid Active Challans (excludes rejected or cancelled challans so quantity returns to available stock)
  const activeChallans = useMemo(() => {
    return challans.filter(c => c.status !== 'cancelled' && c.receivedStatus !== 'rejected');
  }, [challans]);

  const activeWoDeliveryStats = useMemo(() => {
    if (!activeWo) return null;

    // Calculate Production Completed Qty (Only from final process execution step in sequence if available)
    const woProcs = processExecutions.filter(p => p.woId === activeWo.id || p.woNumber === activeWo.woNumber);
    const processMasterList = activeWo.selectedProcesses && activeWo.selectedProcesses.length > 0
      ? activeWo.selectedProcesses
      : [
          { processCode: 'PROC-01', processName: 'Cutting', sequenceOrder: 1 },
          { processCode: 'PROC-02', processName: 'Printing / Dyeing', sequenceOrder: 2 },
          { processCode: 'PROC-03', processName: 'Assembly / Sewing', sequenceOrder: 3 },
          { processCode: 'PROC-04', processName: 'Finishing & Packaging', sequenceOrder: 4 }
        ];

    const finalSeq = processMasterList.length;
    const finalProcName = processMasterList[finalSeq - 1]?.processName;
    const finalProcDoc = woProcs.find(p => p.sequenceOrder === finalSeq || p.processName === finalProcName);

    let productionCompletedQty = 0;
    if (finalProcDoc && (finalProcDoc.completedQty || 0) > 0) {
      productionCompletedQty = finalProcDoc.completedQty;
    } else {
      productionCompletedQty = activeWo.totalQuantity || 0;
    }

    const orderQty = activeWo.totalQuantity || 0;

    // Previously Delivered Qty from active & accepted Challans only (rejected/cancelled excluded)
    const prevChallans = activeChallans.filter(c => (c.woId === activeWo.id || c.woNumber === activeWo.woNumber));
    const previouslyDeliveredQty = prevChallans.reduce((sum, c) => sum + (c.currentDeliveryQty || 0), 0);

    // Available for Delivery is Total Order Quantity minus Previously Delivered Quantity
    const availableQty = Math.max(0, orderQty - previouslyDeliveredQty);

    return {
      orderQty,
      productionCompletedQty,
      previouslyDeliveredQty,
      availableQty,
      remainingQty: Math.max(0, availableQty - currentDeliveryQty)
    };
  }, [activeWo, processExecutions, activeChallans, currentDeliveryQty]);

  // Synchronize Delivery Quantity entered in top input across breakdown items
  const handleSetDeliveryQty = (targetTotal: number) => {
    if (!activeWoDeliveryStats) return;
    const clampedTotal = Math.max(0, Math.min(targetTotal, activeWoDeliveryStats.availableQty));
    setCurrentDeliveryQty(clampedTotal);

    setChallanItems(prev => {
      let remainingToDistribute = clampedTotal;
      return prev.map(item => {
        const avail = item.availableQty ?? Math.max(0, item.orderQty - (item.pChallanQty || 0));
        if (avail <= 0) {
          return {
            ...item,
            selected: false,
            challanQty: 0,
            balanceQty: Math.max(0, item.orderQty - (item.pChallanQty || 0))
          };
        }
        const qtyForThisRow = Math.min(remainingToDistribute, avail);
        remainingToDistribute -= qtyForThisRow;
        return {
          ...item,
          selected: qtyForThisRow > 0,
          challanQty: qtyForThisRow,
          balanceQty: Math.max(0, item.orderQty - ((item.pChallanQty || 0) + qtyForThisRow))
        };
      });
    });
  };

  // Auto-fill form fields when Work Order is selected
  useEffect(() => {
    if (activeWo) {
      setDeliveryAddress(activeWo.customerAddress || `${activeWo.customerName} Factory Premises`);
      setInvoiceAddress(activeWo.customerAddress || `${activeWo.customerName} Main Office`);
      setInvoiceContactPerson(activeWo.customerContact || activeWo.customerName);
      setDeliveryContactPerson(activeWo.customerContact || activeWo.customerName);
      setPiNo(activeWo.piNo || `CPI-${String(Math.floor(Math.random() * 900000) + 100000)}-2026`);
      setWoBagNo(activeWo.woNumber);

      const prevChallansForWo = activeChallans.filter(c => (c.woId === activeWo.id || c.woNumber === activeWo.woNumber));

      // Generate items breakdown table from Work Order breakdowns with per-row previous challan tracking
      if (activeWo.breakdownRows && activeWo.breakdownRows.length > 0) {
        // 1. Calculate itemized previous deliveries from past active challans
        const breakdownDeliveredMap = new Map<string, number>();
        let matchedTotalFromItems = 0;

        prevChallansForWo.forEach(c => {
          if (c.items && c.items.length > 0) {
            c.items.forEach(it => {
              const qty = Number(it.challanQty) || 0;
              if (qty > 0) {
                if (it.breakdownId) {
                  breakdownDeliveredMap.set(it.breakdownId, (breakdownDeliveredMap.get(it.breakdownId) || 0) + qty);
                }
                if (it.id) {
                  breakdownDeliveredMap.set(it.id, (breakdownDeliveredMap.get(it.id) || 0) + qty);
                }
                const comboKey = `${it.size || ''}_${it.color || ''}_${it.style || ''}`.toLowerCase();
                breakdownDeliveredMap.set(comboKey, (breakdownDeliveredMap.get(comboKey) || 0) + qty);
                matchedTotalFromItems += qty;
              }
            });
          }
        });

        const totalPrevDelivered = prevChallansForWo.reduce((sum, c) => sum + (c.currentDeliveryQty || 0), 0);
        const unallocatedPrev = Math.max(0, totalPrevDelivered - matchedTotalFromItems);
        const totalWoBreakdownOrder = activeWo.breakdownRows.reduce((sum, b) => sum + (b.quantity || 0), 0) || activeWo.totalQuantity || 1;

        const items: DeliveryChallanItem[] = activeWo.breakdownRows.map((b, idx) => {
          const directKey1 = b.id;
          const comboKey = `${b.size || ''}_${b.color || ''}_${b.style || activeWo.style || ''}`.toLowerCase();
          
          let pChallanQty = breakdownDeliveredMap.get(directKey1) ?? breakdownDeliveredMap.get(comboKey) ?? 0;

          // If there were legacy challans without item breakdowns, allocate proportionally
          if (unallocatedPrev > 0) {
            const propShare = Math.round(((b.quantity || 0) / totalWoBreakdownOrder) * unallocatedPrev);
            pChallanQty += propShare;
          }

          // Ensure pChallanQty cannot exceed order quantity
          pChallanQty = Math.min(b.quantity || 0, pChallanQty);

          const availableQty = Math.max(0, (b.quantity || 0) - pChallanQty);
          const isSelected = availableQty > 0;
          const challanQty = isSelected ? availableQty : 0;
          const balanceQty = Math.max(0, (b.quantity || 0) - (pChallanQty + challanQty));

          return {
            id: b.id,
            breakdownId: b.id,
            selected: isSelected,
            sn: idx + 1,
            style: b.style || activeWo.style || '-',
            jobNo: b.jobNo || `JOB-${activeWo.woNumber.replace(/\D/g, '')}`,
            poNo: activeWo.poNo || '-',
            itemNo: activeWo.finishedGoodsNo || `FG-${idx + 1}`,
            color: b.color || 'As per WO',
            size: b.size || 'STD',
            measurement: b.unit || activeWo.finishedGoodsUnit || 'Pcs',
            itemDescription: activeWo.finishedGoodsName || 'Trims & Accessories',
            orderQty: b.quantity || 0,
            pChallanQty,
            availableQty,
            challanQty,
            balanceQty,
            unit: b.unit || activeWo.finishedGoodsUnit || 'Pcs',
            remarks: 'Good Condition'
          };
        });

        // Exact match reconciliation: ensure sum of pChallanQty matches totalPrevDelivered exactly
        const sumPChallan = items.reduce((sum, it) => sum + (it.pChallanQty || 0), 0);
        if (sumPChallan !== totalPrevDelivered && items.length > 0 && totalPrevDelivered <= totalWoBreakdownOrder) {
          const diff = totalPrevDelivered - sumPChallan;
          for (const it of items) {
            if (diff > 0 && it.orderQty >= (it.pChallanQty || 0) + diff) {
              it.pChallanQty = (it.pChallanQty || 0) + diff;
              it.availableQty = Math.max(0, it.orderQty - it.pChallanQty);
              it.challanQty = it.selected ? it.availableQty : 0;
              it.balanceQty = Math.max(0, it.orderQty - (it.pChallanQty + it.challanQty));
              break;
            } else if (diff < 0 && (it.pChallanQty || 0) >= Math.abs(diff)) {
              it.pChallanQty = (it.pChallanQty || 0) + diff;
              it.availableQty = Math.max(0, it.orderQty - it.pChallanQty);
              it.challanQty = it.selected ? it.availableQty : 0;
              it.balanceQty = Math.max(0, it.orderQty - (it.pChallanQty + it.challanQty));
              break;
            }
          }
        }

        setChallanItems(items);
        const initialTotal = items.filter(i => i.selected).reduce((sum, i) => sum + (i.challanQty || 0), 0);
        setCurrentDeliveryQty(initialTotal);
      } else {
        const prevTotal = prevChallansForWo.reduce((sum, c) => sum + (c.currentDeliveryQty || 0), 0);
        const avail = Math.max(0, (activeWo.totalQuantity || 0) - prevTotal);
        const singleItem: DeliveryChallanItem = {
          sn: 1,
          selected: avail > 0,
          style: activeWo.style || '-',
          jobNo: `JOB-${activeWo.woNumber.replace(/\D/g, '')}`,
          poNo: activeWo.poNo || '-',
          itemNo: activeWo.finishedGoodsNo || 'FG-001',
          color: 'Standard',
          size: 'Standard',
          measurement: activeWo.finishedGoodsUnit || 'Pcs',
          itemDescription: activeWo.finishedGoodsName || 'Trims & Accessories Item',
          orderQty: activeWo.totalQuantity || 0,
          pChallanQty: prevTotal,
          availableQty: avail,
          challanQty: avail,
          balanceQty: 0,
          unit: activeWo.finishedGoodsUnit || 'Pcs',
          remarks: 'Good Condition'
        };
        setChallanItems([singleItem]);
        setCurrentDeliveryQty(avail);
      }
    }
  }, [activeWo, activeChallans]);

  // Toggle selection checkbox for a breakdown item row
  const handleToggleSelectItem = (index: number) => {
    setChallanItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const newSelected = !item.selected;
      item.selected = newSelected;

      if (newSelected) {
        const avail = item.availableQty ?? Math.max(0, item.orderQty - (item.pChallanQty || 0));
        item.challanQty = item.challanQty > 0 ? item.challanQty : avail;
        item.balanceQty = Math.max(0, item.orderQty - ((item.pChallanQty || 0) + item.challanQty));
      } else {
        item.challanQty = 0;
        item.balanceQty = Math.max(0, item.orderQty - (item.pChallanQty || 0));
      }

      updated[index] = item;
      const newTotal = updated.filter(i => i.selected).reduce((sum, i) => sum + (i.challanQty || 0), 0);
      setCurrentDeliveryQty(newTotal);
      return updated;
    });
  };

  // Select all or Deselect all breakdown items
  const handleSelectAllBreakdowns = (select: boolean) => {
    setChallanItems(prev => {
      const updated = prev.map(item => {
        const avail = item.availableQty ?? Math.max(0, item.orderQty - (item.pChallanQty || 0));
        if (select) {
          return {
            ...item,
            selected: avail > 0,
            challanQty: avail,
            balanceQty: 0
          };
        } else {
          return {
            ...item,
            selected: false,
            challanQty: 0,
            balanceQty: avail
          };
        }
      });
      const newTotal = updated.filter(i => i.selected).reduce((sum, i) => sum + (i.challanQty || 0), 0);
      setCurrentDeliveryQty(newTotal);
      return updated;
    });
  };

  // Update item row in Challan items list with validation & auto-selection
  const handleItemRowChange = (index: number, field: keyof DeliveryChallanItem, value: any) => {
    setChallanItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'challanQty') {
        const val = Math.max(0, Number(value) || 0);
        const maxAvail = item.availableQty ?? Math.max(0, item.orderQty - (item.pChallanQty || 0));
        if (val > maxAvail) {
          showToast(`Warning: Quantity entered (${val.toLocaleString()}) exceeds available remaining (${maxAvail.toLocaleString()}) for Size ${item.size}`, 'warning');
        }
        item.challanQty = Math.min(val, maxAvail);
        item.selected = item.challanQty > 0;
        item.balanceQty = Math.max(0, item.orderQty - ((item.pChallanQty || 0) + item.challanQty));
      } else {
        (item as any)[field] = value;
      }

      updated[index] = item;
      const newTotal = updated.filter(i => i.selected).reduce((sum, i) => sum + (i.challanQty || 0), 0);
      setCurrentDeliveryQty(newTotal);
      return updated;
    });
  };

  // Handle Save Delivery Challan
  const handleSaveChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWo || !activeWoDeliveryStats) {
      showToast('Please select a Work Order.', 'error');
      return;
    }

    const selectedItems = challanItems.filter(item => item.selected && item.challanQty > 0);
    if (selectedItems.length === 0) {
      showToast('Please select at least one size breakdown item with quantity > 0.', 'error');
      return;
    }

    const totalSelectedDeliveryQty = selectedItems.reduce((sum, it) => sum + it.challanQty, 0);
    if (totalSelectedDeliveryQty <= 0) {
      showToast('Delivery Quantity must be greater than zero.', 'error');
      return;
    }

    if (totalSelectedDeliveryQty > activeWoDeliveryStats.availableQty) {
      showToast(`Validation Error: Selected Delivery Quantity (${totalSelectedDeliveryQty.toLocaleString()}) cannot exceed Available Delivery Quantity (${activeWoDeliveryStats.availableQty.toLocaleString()}).`, 'error');
      return;
    }

    try {
      const challanNo = generateNextChallanNo();
      const totalDelivered = activeWoDeliveryStats.previouslyDeliveredQty + totalSelectedDeliveryQty;

      let deliveryStatus: 'Pending Delivery' | 'Partially Delivered' | 'Fully Delivered' = 'Partially Delivered';
      if (totalDelivered >= activeWoDeliveryStats.orderQty) {
        deliveryStatus = 'Fully Delivered';
      }

      // ONLY include selected breakdown rows in the Challan
      const formattedChallanItems: DeliveryChallanItem[] = selectedItems.map((item, idx) => ({
        ...item,
        sn: idx + 1,
        challanQty: item.challanQty,
        balanceQty: Math.max(0, item.orderQty - ((item.pChallanQty || 0) + item.challanQty))
      }));

      const challanData: Omit<DeliveryChallanRecord, 'id'> = {
        challanNo,
        challanDate: format(new Date(challanDate), 'dd/MM/yyyy'),
        woId: activeWo.id,
        woNumber: activeWo.woNumber,
        woBagNo: woBagNo || activeWo.woNumber,
        customerId: activeWo.customerId,
        customerName: activeWo.customerName,
        buyerName: activeWo.buyerName,
        poNo: activeWo.poNo || 'N/A',
        piNo,
        fscCoc,
        invoiceAddress,
        invoiceContactPerson,
        deliveryAddress,
        deliveryContactPerson,
        vehicleNo,
        driverName,
        driverMobile,
        deliveryType,
        totalBox,
        productId: activeWo.finishedGoodsId || '',
        productName: activeWo.finishedGoodsName || 'Product Item',
        productCode: activeWo.finishedGoodsNo || '',
        style: activeWo.style || '',
        orderQty: activeWoDeliveryStats.orderQty,
        productionCompletedQty: activeWoDeliveryStats.productionCompletedQty,
        previouslyDeliveredQty: activeWoDeliveryStats.previouslyDeliveredQty,
        availableQty: activeWoDeliveryStats.availableQty,
        currentDeliveryQty: totalSelectedDeliveryQty,
        remainingQty: Math.max(0, activeWoDeliveryStats.availableQty - totalSelectedDeliveryQty),
        unit: activeWo.finishedGoodsUnit || 'Pcs',
        deliveryStatus,
        status: 'active',
        items: formattedChallanItems,
        receivedStatus: 'pending',
        isLocked: false,
        gatePassStatus: 'none',
        preparedBy: userProfile.displayName || userProfile.email,
        preparedByUid: userProfile.uid,
        businessId: bId,
        ownerId: userProfile.uid,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'delivery_challans'), challanData);
      
      showToast(`Delivery Challan '${challanNo}' created successfully! Print preview opened.`, 'success');
      // Instantly open printable Challan modal
      setPrintableChallan({ id: docRef.id, ...challanData });
      setSelectedWoId('');
      setCurrentDeliveryQty(0);
      setVehicleNo('');
      setDriverName('');
      setDriverMobile('');
    } catch (err: any) {
      showToast('Failed to create Delivery Challan: ' + err.message, 'error');
    }
  };

  // Permission for Gate Pass Approval/Rejection
  const canApproveGatePass = useMemo(() => {
    if (!userProfile) return false;
    const role = (userProfile.role || '').toLowerCase();
    return (
      role.includes('admin') ||
      role.includes('super admin') ||
      role.includes('md') ||
      role.includes('gm') ||
      role.includes('managing director') ||
      role.includes('general manager') ||
      role.includes('factory manager') ||
      role.includes('production manager') ||
      role.includes('security') ||
      role.includes('manager') ||
      userProfile.specialPermissions?.canApprove === true
    );
  }, [userProfile]);

  // Balance calculation for editing Challan
  const editingChallanBalance = useMemo(() => {
    if (!editingChallan) return null;
    const wo = workOrders.find(w => w.id === editingChallan.woId || w.woNumber === editingChallan.woNumber);
    const totalOrderQty = wo?.totalQuantity || editingChallan.orderQty || 0;

    // Previous other active challans for the same Work Order
    const otherChallans = challans.filter(c => 
      c.id !== editingChallan.id && 
      c.status !== 'cancelled' && 
      c.receivedStatus !== 'rejected' && 
      (c.woId === editingChallan.woId || c.woNumber === editingChallan.woNumber)
    );

    // Quantity from confirmed/locked challans (cannot be changed!)
    const prevConfirmedQty = otherChallans
      .filter(c => c.isLocked || c.gatePassStatus === 'approved' || c.receivedStatus === 'received')
      .reduce((sum, c) => sum + (c.currentDeliveryQty || 0), 0);

    // Quantity from other unlocked active challans (if any)
    const otherPendingQty = otherChallans
      .filter(c => !(c.isLocked || c.gatePassStatus === 'approved' || c.receivedStatus === 'received'))
      .reduce((sum, c) => sum + (c.currentDeliveryQty || 0), 0);

    // Maximum available balance for this challan
    const maxAvailableForThisChallan = Math.max(0, totalOrderQty - prevConfirmedQty - otherPendingQty);

    return {
      totalOrderQty,
      prevConfirmedQty,
      otherPendingQty,
      maxAvailableForThisChallan
    };
  }, [editingChallan, challans, workOrders]);

  // Work Order associated with currently edited Challan
  const editingWo = useMemo(() => {
    if (!editingChallan) return null;
    return workOrders.find(w => w.id === editingChallan.woId || w.woNumber === editingChallan.woNumber);
  }, [editingChallan, workOrders]);

  // Other active challans for the same Work Order (excluding the currently edited challan)
  const otherChallansForEditingWo = useMemo(() => {
    if (!editingChallan) return [];
    return challans.filter(c => 
      c.id !== editingChallan.id && 
      c.status !== 'cancelled' && 
      c.receivedStatus !== 'rejected' && 
      (c.woId === editingChallan.woId || c.woNumber === editingChallan.woNumber)
    );
  }, [editingChallan, challans]);

  // Map of previously delivered quantities per breakdown across other active challans
  const otherChallanBreakdownDeliveredMap = useMemo(() => {
    const map = new Map<string, number>();
    otherChallansForEditingWo.forEach(c => {
      if (c.items && c.items.length > 0) {
        c.items.forEach(it => {
          const qty = Number(it.challanQty) || 0;
          if (qty > 0) {
            if (it.breakdownId) {
              map.set(it.breakdownId, (map.get(it.breakdownId) || 0) + qty);
            }
            if (it.id) {
              map.set(it.id, (map.get(it.id) || 0) + qty);
            }
            const comboKey = `${it.size || ''}_${it.color || ''}_${it.style || ''}`.toLowerCase();
            map.set(comboKey, (map.get(comboKey) || 0) + qty);
          }
        });
      }
    });
    return map;
  }, [otherChallansForEditingWo]);

  // Work Order breakdowns that are NOT currently in editItems (available to add)
  const availableBreakdownsToAdd = useMemo(() => {
    if (!editingWo || !editingWo.breakdownRows || editingWo.breakdownRows.length === 0) return [];
    
    return editingWo.breakdownRows.map((b, idx) => {
      const directKey = b.id;
      const comboKey = `${b.size || ''}_${b.color || ''}_${b.style || editingWo.style || ''}`.toLowerCase();
      const prevDelivered = otherChallanBreakdownDeliveredMap.get(directKey) ?? otherChallanBreakdownDeliveredMap.get(comboKey) ?? 0;
      const orderQty = b.quantity || 0;
      const availableQty = Math.max(0, orderQty - prevDelivered);

      // Check if already in editItems (by breakdownId, id, or combo match)
      const alreadyInEdit = editItems.some(it => 
        (it.breakdownId && it.breakdownId === b.id) || 
        (it.id && it.id === b.id) || 
        ((it.style || '') === (b.style || editingWo.style || '') && (it.color || '') === (b.color || '') && (it.size || '') === (b.size || ''))
      );

      return {
        id: b.id || `b-${idx}`,
        breakdownId: b.id,
        style: b.style || editingWo.style || '-',
        color: b.color || 'Standard',
        size: b.size || 'Standard',
        unit: b.unit || editingWo.finishedGoodsUnit || 'Pcs',
        orderQty,
        pChallanQty: prevDelivered,
        availableQty,
        alreadyInEdit
      };
    }).filter(b => !b.alreadyInEdit);
  }, [editingWo, otherChallanBreakdownDeliveredMap, editItems]);

  // Open Edit Challan Modal
  const handleOpenEditChallan = (c: DeliveryChallanRecord) => {
    if (c.isLocked || c.gatePassStatus === 'approved') {
      showToast('This Challan is LOCKED because its Gate Pass has been approved. It cannot be edited.', 'warning');
      return;
    }
    setEditingChallan(c);
    setEditDeliveryQty(c.currentDeliveryQty || 0);
    setEditVehicleNo(c.vehicleNo || '');
    setEditDriverName(c.driverName || '');
    setEditDriverMobile(c.driverMobile || '');
    setEditDeliveryType(c.deliveryType || 'Company Truck');
    setEditTotalBox(String(c.totalBox || '1 Box'));
    setEditDeliveryAddress(c.deliveryAddress || '');
    setEditRemarks(c.remarks || '');
    setSelectedBreakdownToAdd('');
    setQtyToAdd('');

    if (c.items && c.items.length > 0) {
      setEditItems(JSON.parse(JSON.stringify(c.items)));
    } else {
      // If challan had no items array, reconstruct from Work Order breakdowns
      const wo = workOrders.find(w => w.id === c.woId || w.woNumber === c.woNumber);
      if (wo && wo.breakdownRows && wo.breakdownRows.length > 0) {
        const otherChallans = challans.filter(oc => 
          oc.id !== c.id && 
          oc.status !== 'cancelled' && 
          oc.receivedStatus !== 'rejected' && 
          (oc.woId === c.woId || oc.woNumber === c.woNumber)
        );
        const deliveredMap = new Map<string, number>();
        otherChallans.forEach(oc => {
          if (oc.items) {
            oc.items.forEach(it => {
              const q = Number(it.challanQty) || 0;
              if (q > 0) {
                if (it.breakdownId) deliveredMap.set(it.breakdownId, (deliveredMap.get(it.breakdownId) || 0) + q);
                if (it.id) deliveredMap.set(it.id, (deliveredMap.get(it.id) || 0) + q);
                const comboKey = `${it.size || ''}_${it.color || ''}_${it.style || ''}`.toLowerCase();
                deliveredMap.set(comboKey, (deliveredMap.get(comboKey) || 0) + q);
              }
            });
          }
        });

        const newItems: DeliveryChallanItem[] = wo.breakdownRows.map((b, idx) => {
          const directKey = b.id;
          const comboKey = `${b.size || ''}_${b.color || ''}_${b.style || wo.style || ''}`.toLowerCase();
          const prevDelivered = deliveredMap.get(directKey) ?? deliveredMap.get(comboKey) ?? 0;
          const orderQty = b.quantity || 0;
          const avail = Math.max(0, orderQty - prevDelivered);
          return {
            id: b.id,
            breakdownId: b.id,
            selected: avail > 0,
            sn: idx + 1,
            style: b.style || wo.style || '-',
            jobNo: (b as any).jobNo || `JOB-${wo.woNumber.replace(/\D/g, '')}`,
            poNo: wo.poNo || '-',
            itemNo: wo.finishedGoodsNo || `FG-${idx + 1}`,
            color: b.color || 'Standard',
            size: b.size || 'Standard',
            measurement: b.unit || wo.finishedGoodsUnit || 'Pcs',
            itemDescription: wo.finishedGoodsName || 'Trims & Accessories Item',
            orderQty,
            pChallanQty: prevDelivered,
            availableQty: avail,
            challanQty: 0,
            balanceQty: avail,
            unit: b.unit || wo.finishedGoodsUnit || 'Pcs',
            remarks: 'Good Condition'
          };
        });
        setEditItems(newItems);
      } else {
        setEditItems([]);
      }
    }
  };

  // Change individual breakdown quantity
  const handleEditItemQty = (index: number, val: number) => {
    setEditItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const clampedVal = Math.max(0, val);
      item.challanQty = clampedVal;
      item.selected = clampedVal > 0;
      item.balanceQty = Math.max(0, item.orderQty - ((item.pChallanQty || 0) + clampedVal));
      updated[index] = item;

      const total = updated.filter(i => i.selected).reduce((sum, i) => sum + (Number(i.challanQty) || 0), 0);
      setEditDeliveryQty(total);
      return updated;
    });
  };

  // Toggle item inclusion in Challan
  const handleToggleEditItemSelected = (index: number) => {
    setEditItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.selected = !item.selected;
      if (item.selected && (!item.challanQty || item.challanQty <= 0)) {
        const avail = item.availableQty ?? Math.max(0, item.orderQty - (item.pChallanQty || 0));
        item.challanQty = avail;
      }
      item.balanceQty = Math.max(0, item.orderQty - ((item.pChallanQty || 0) + (item.selected ? (Number(item.challanQty) || 0) : 0)));
      updated[index] = item;
      const total = updated.filter(i => i.selected).reduce((sum, i) => sum + (Number(i.challanQty) || 0), 0);
      setEditDeliveryQty(total);
      return updated;
    });
  };

  // Remove / delete a breakdown completely from this Challan
  const handleRemoveEditItem = (index: number) => {
    setEditItems(prev => {
      const target = prev[index];
      const next = prev.filter((_, idx) => idx !== index);
      const newTotal = next.filter(i => i.selected).reduce((sum, i) => sum + (Number(i.challanQty) || 0), 0);
      setEditDeliveryQty(newTotal);
      showToast(`Removed breakdown [${target?.style || ''} ${target?.color || ''} / ${target?.size || ''}] from Challan.`, 'info');
      return next;
    });
  };

  // Add an un-allocated breakdown from the Work Order into this Challan
  const handleAddBreakdownToEdit = (breakdownIdToAdd?: string, customQty?: number) => {
    const targetId = breakdownIdToAdd || selectedBreakdownToAdd;
    if (!targetId || !editingWo) {
      showToast('Please select a breakdown from the Work Order to add.', 'warning');
      return;
    }

    const b = editingWo.breakdownRows?.find(r => r.id === targetId) || 
      availableBreakdownsToAdd.find(a => a.breakdownId === targetId || a.id === targetId);

    if (!b) {
      showToast('Selected breakdown not found in Work Order.', 'error');
      return;
    }

    const directKey = b.id;
    const comboKey = `${b.size || ''}_${b.color || ''}_${b.style || editingWo.style || ''}`.toLowerCase();
    const prevDelivered = otherChallanBreakdownDeliveredMap.get(directKey) ?? otherChallanBreakdownDeliveredMap.get(comboKey) ?? 0;
    const orderQty = (b as any).quantity || (b as any).orderQty || 0;
    const maxAvail = Math.max(0, orderQty - prevDelivered);

    const parsedQty = customQty !== undefined ? customQty : (Number(qtyToAdd) > 0 ? Number(qtyToAdd) : maxAvail);
    const initialQty = Math.min(parsedQty, maxAvail);

    const newItem: DeliveryChallanItem = {
      id: b.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      breakdownId: b.id,
      selected: initialQty > 0,
      sn: editItems.length + 1,
      style: b.style || editingWo.style || '-',
      jobNo: (b as any).jobNo || `JOB-${editingWo.woNumber.replace(/\D/g, '')}`,
      poNo: editingWo.poNo || '-',
      itemNo: editingWo.finishedGoodsNo || `FG-${editItems.length + 1}`,
      color: b.color || 'Standard',
      size: b.size || 'Standard',
      measurement: b.unit || editingWo.finishedGoodsUnit || 'Pcs',
      itemDescription: editingWo.finishedGoodsName || 'Trims & Accessories Item',
      orderQty,
      pChallanQty: prevDelivered,
      availableQty: maxAvail,
      challanQty: initialQty,
      balanceQty: Math.max(0, orderQty - (prevDelivered + initialQty)),
      unit: b.unit || editingWo.finishedGoodsUnit || 'Pcs',
      remarks: 'Good Condition'
    };

    setEditItems(prev => {
      const next = [...prev, newItem];
      const newTotal = next.filter(i => i.selected).reduce((sum, i) => sum + (Number(i.challanQty) || 0), 0);
      setEditDeliveryQty(newTotal);
      return next;
    });

    setSelectedBreakdownToAdd('');
    setQtyToAdd('');
    showToast(`Added breakdown [${newItem.style} / ${newItem.color} / ${newItem.size}] to Challan.`, 'success');
  };

  // Import all available Work Order breakdowns into this Challan
  const handleImportAllWoBreakdowns = () => {
    if (!editingWo || !editingWo.breakdownRows || editingWo.breakdownRows.length === 0) {
      showToast('No Work Order breakdowns available to import.', 'warning');
      return;
    }
    
    let addedCount = 0;
    const existingKeys = new Set(editItems.map(it => it.breakdownId || it.id || `${it.size}_${it.color}_${it.style}`.toLowerCase()));
    
    const newItems: DeliveryChallanItem[] = [];
    editingWo.breakdownRows.forEach((b, idx) => {
      const directKey = b.id;
      const comboKey = `${b.size || ''}_${b.color || ''}_${b.style || editingWo.style || ''}`.toLowerCase();
      if (!existingKeys.has(directKey) && !existingKeys.has(comboKey)) {
        const prevDelivered = otherChallanBreakdownDeliveredMap.get(directKey) ?? otherChallanBreakdownDeliveredMap.get(comboKey) ?? 0;
        const orderQty = b.quantity || 0;
        const maxAvail = Math.max(0, orderQty - prevDelivered);
        newItems.push({
          id: b.id || `b-${idx}`,
          breakdownId: b.id,
          selected: maxAvail > 0,
          sn: editItems.length + newItems.length + 1,
          style: b.style || editingWo.style || '-',
          jobNo: (b as any).jobNo || `JOB-${editingWo.woNumber.replace(/\D/g, '')}`,
          poNo: editingWo.poNo || '-',
          itemNo: editingWo.finishedGoodsNo || `FG-${idx + 1}`,
          color: b.color || 'Standard',
          size: b.size || 'Standard',
          measurement: b.unit || editingWo.finishedGoodsUnit || 'Pcs',
          itemDescription: editingWo.finishedGoodsName || 'Trims & Accessories Item',
          orderQty,
          pChallanQty: prevDelivered,
          availableQty: maxAvail,
          challanQty: maxAvail,
          balanceQty: Math.max(0, orderQty - (prevDelivered + maxAvail)),
          unit: b.unit || editingWo.finishedGoodsUnit || 'Pcs',
          remarks: 'Good Condition'
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setEditItems(prev => {
        const combined = [...prev, ...newItems];
        const newTotal = combined.filter(i => i.selected).reduce((sum, i) => sum + (Number(i.challanQty) || 0), 0);
        setEditDeliveryQty(newTotal);
        return combined;
      });
      showToast(`Imported ${addedCount} breakdown(s) from Work Order.`, 'success');
    } else {
      showToast('All Work Order breakdowns are already present in this Challan.', 'info');
    }
  };

  const handleSetEditDeliveryQty = (targetTotal: number) => {
    if (!editingChallanBalance) return;
    const clampedTotal = Math.max(0, Math.min(targetTotal, editingChallanBalance.maxAvailableForThisChallan));
    setEditDeliveryQty(clampedTotal);

    if (editItems.length > 0) {
      setEditItems(prev => {
        let remaining = clampedTotal;
        return prev.map(item => {
          const avail = item.availableQty ?? Math.max(0, item.orderQty - (item.pChallanQty || 0));
          const qty = Math.min(remaining, avail);
          remaining -= qty;
          return {
            ...item,
            selected: qty > 0,
            challanQty: qty,
            balanceQty: Math.max(0, item.orderQty - ((item.pChallanQty || 0) + qty))
          };
        });
      });
    }
  };

  const handleSaveEditedChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChallan || !editingChallanBalance) return;

    const totalQty = editItems.length > 0 
      ? editItems.filter(i => i.selected).reduce((sum, i) => sum + (Number(i.challanQty) || 0), 0)
      : Number(editDeliveryQty) || 0;

    if (totalQty <= 0) {
      showToast('Delivery Quantity must be greater than 0. Please select at least one breakdown with quantity.', 'error');
      return;
    }

    if (totalQty > editingChallanBalance.maxAvailableForThisChallan) {
      showToast(`Quantity (${totalQty.toLocaleString()}) exceeds remaining available order balance (${editingChallanBalance.maxAvailableForThisChallan.toLocaleString()}).`, 'error');
      return;
    }

    setIsSavingEdit(true);
    try {
      const updatedDeliveredTotal = editingChallanBalance.prevConfirmedQty + editingChallanBalance.otherPendingQty + totalQty;
      let deliveryStatus: 'Pending Delivery' | 'Partially Delivered' | 'Fully Delivered' = 'Partially Delivered';
      if (updatedDeliveredTotal >= editingChallanBalance.totalOrderQty) {
        deliveryStatus = 'Fully Delivered';
      }

      // Only keep and store active items that have positive challanQty
      const updatedItems = editItems
        .filter(item => item.selected && (Number(item.challanQty) || 0) > 0)
        .map((item, idx) => ({
          ...item,
          sn: idx + 1,
          selected: true,
          challanQty: Number(item.challanQty) || 0,
          balanceQty: Math.max(0, item.orderQty - ((item.pChallanQty || 0) + (Number(item.challanQty) || 0)))
        }));

      await updateDoc(doc(db, 'delivery_challans', editingChallan.id), {
        currentDeliveryQty: totalQty,
        remainingQty: Math.max(0, editingChallanBalance.maxAvailableForThisChallan - totalQty),
        vehicleNo: editVehicleNo,
        driverName: editDriverName,
        driverMobile: editDriverMobile,
        deliveryType: editDeliveryType,
        totalBox: editTotalBox,
        deliveryAddress: editDeliveryAddress,
        deliveryStatus,
        items: updatedItems,
        remarks: editRemarks,
        updatedAt: Timestamp.now(),
        updatedBy: userProfile.displayName || userProfile.email
      });

      // Synchronize matching Gate Pass if exists
      const existingGp = gatePasses.find(gp => gp.challanId === editingChallan.id && gp.status !== 'cancelled');
      if (existingGp) {
        const gpUpdates: any = {
          deliveryQty: totalQty,
          vehicleNo: editVehicleNo,
          driverName: editDriverName,
          driverMobile: editDriverMobile,
          deliveryType: editDeliveryType
        };
        // If gate pass was rejected, reset to pending for re-approval
        if (existingGp.approvalStatus === 'rejected') {
          gpUpdates.approvalStatus = 'pending';
          gpUpdates.rejectionReason = '';
          await updateDoc(doc(db, 'delivery_challans', editingChallan.id), {
            gatePassStatus: 'pending'
          });
        }
        await updateDoc(doc(db, 'gate_passes', existingGp.id), gpUpdates);
      }

      showToast(`Challan '${editingChallan.challanNo}' updated successfully! Print preview opened.`, 'success');
      setPrintableChallan({
        ...editingChallan,
        currentDeliveryQty: totalQty,
        remainingQty: Math.max(0, editingChallanBalance.maxAvailableForThisChallan - totalQty),
        vehicleNo: editVehicleNo,
        driverName: editDriverName,
        driverMobile: editDriverMobile,
        deliveryType: editDeliveryType,
        totalBox: editTotalBox,
        deliveryAddress: editDeliveryAddress,
        deliveryStatus,
        items: updatedItems,
        remarks: editRemarks
      });
      setEditingChallan(null);
    } catch (err: any) {
      showToast('Failed to update Challan: ' + err.message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Gate Pass Approval
  const handleApproveGatePass = async (gp: GatePassRecord) => {
    try {
      const currentUser = userProfile?.displayName || userProfile?.email || 'Approver';
      await updateDoc(doc(db, 'gate_passes', gp.id), {
        approvalStatus: 'approved',
        approvedBy: currentUser,
        approvedByUid: userProfile.uid,
        approvedAt: Timestamp.now(),
        status: 'active'
      });
      await updateDoc(doc(db, 'delivery_challans', gp.challanId), {
        gatePassStatus: 'approved',
        isLocked: true,
        gatePassId: gp.id,
        gatePassNo: gp.gatePassNo
      });
      showToast(`Gate Pass '${gp.gatePassNo}' Approved & Confirmed! Challan '${gp.challanNo}' is now LOCKED and sent to Challan Received.`, 'success');
    } catch (err: any) {
      showToast('Failed to approve Gate Pass: ' + err.message, 'error');
    }
  };

  // Gate Pass Rejection
  const handleRejectGatePass = async (gp: GatePassRecord, reason: string) => {
    if (!reason.trim()) {
      showToast('Please provide a reason for rejecting this Gate Pass.', 'warning');
      return;
    }
    try {
      const currentUser = userProfile?.displayName || userProfile?.email || 'Approver';
      await updateDoc(doc(db, 'gate_passes', gp.id), {
        approvalStatus: 'rejected',
        rejectedBy: currentUser,
        rejectedByUid: userProfile.uid,
        rejectedAt: Timestamp.now(),
        rejectionReason: reason.trim()
      });
      await updateDoc(doc(db, 'delivery_challans', gp.challanId), {
        gatePassStatus: 'rejected',
        isLocked: false
      });
      showToast(`Gate Pass '${gp.gatePassNo}' Rejected. Delivery Challan '${gp.challanNo}' remains UNLOCKED for edit & correction.`, 'warning');
      setRejectingGatePass(null);
      setGpRejectReason('');
    } catch (err: any) {
      showToast('Failed to reject Gate Pass: ' + err.message, 'error');
    }
  };

  // Gate Pass Resubmit
  const handleResubmitGatePass = async (gp: GatePassRecord) => {
    try {
      await updateDoc(doc(db, 'gate_passes', gp.id), {
        approvalStatus: 'pending',
        rejectionReason: ''
      });
      await updateDoc(doc(db, 'delivery_challans', gp.challanId), {
        gatePassStatus: 'pending',
        isLocked: false
      });
      showToast(`Gate Pass '${gp.gatePassNo}' resubmitted for Approval.`, 'info');
    } catch (err: any) {
      showToast('Failed to resubmit Gate Pass: ' + err.message, 'error');
    }
  };

  // Handle Save Gate Pass
  const handleSaveGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetChallan = challans.find(c => c.id === gpChallanId);
    if (!targetChallan) {
      showToast('Please select a valid Delivery Challan.', 'error');
      return;
    }

    try {
      const gatePassNo = `GP-2026-${String(gatePasses.length + 101).padStart(6, '0')}`;
      const gpData: Omit<GatePassRecord, 'id'> = {
        gatePassNo,
        challanId: targetChallan.id,
        challanNo: targetChallan.challanNo,
        gatePassDate: format(new Date(), 'dd/MM/yyyy'),
        woId: targetChallan.woId,
        woNumber: targetChallan.woNumber,
        customerName: targetChallan.customerName,
        buyerName: targetChallan.buyerName,
        productName: targetChallan.productName,
        deliveryQty: targetChallan.currentDeliveryQty,
        unit: targetChallan.unit,
        vehicleNo: targetChallan.vehicleNo,
        driverName: targetChallan.driverName,
        driverMobile: targetChallan.driverMobile,
        deliveryType: targetChallan.deliveryType,
        remarks: gpRemarks,
        status: 'active',
        approvalStatus: 'pending',
        issuedBy: userProfile.displayName || userProfile.email,
        businessId: bId,
        ownerId: userProfile.uid,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'gate_passes'), gpData);

      // Update Delivery Challan with Gate Pass reference (unlocked until approved)
      await updateDoc(doc(db, 'delivery_challans', targetChallan.id), {
        gatePassId: docRef.id,
        gatePassNo,
        gatePassStatus: 'pending',
        isLocked: false
      });

      showToast(`Security Gate Pass '${gatePassNo}' issued! Status: Pending Approval (Challan remains unlocked until approved).`, 'success');
      setPrintableGatePass({ id: docRef.id, ...gpData });
      setShowGatePassModal(false);
      setGpRemarks('');
    } catch (err: any) {
      showToast('Failed to create Gate Pass: ' + err.message, 'error');
    }
  };

  // Handle Mark Challan Received or Rejected
  const handleOpenReceiveModal = (c: DeliveryChallanRecord, mode: 'receive' | 'reject' = 'receive') => {
    if (mode === 'reject' && !canRejectChallan) {
      showToast('Permission Denied: Only Admin, MD, GM, or Sales Manager are authorized to reject delivery challans.', 'error');
      return;
    }
    setReceivingChallan(c);
    setReceiptMode(mode);
    setReceiveDate(format(new Date(), 'yyyy-MM-dd'));
    setReceiverName(c.receiverName || c.deliveryContactPerson || c.customerName || 'Store Representative');
    setVerifiedQty(c.receivedQty || c.currentDeliveryQty || 0);
    setRejectedQty(c.rejectedQty || c.currentDeliveryQty || 0);
    setRejectionReason(c.rejectionReason || '');
    setReceiveRemarks(c.receiverRemarks || 'Above goods are acknowledged and received in good condition of package and quantity as per challan.');
    setShowReceiveModal(true);
  };

  // Helper function to safely format dates from <input type="date">
  const formatInputDate = (dateStr: string) => {
    if (!dateStr) return format(new Date(), 'dd/MM/yyyy');
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return format(new Date(year, month, day), 'dd/MM/yyyy');
      }
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return format(new Date(), 'dd/MM/yyyy');
    }
  };

  // Quick One-Click Total Receipt
  const handleQuickTotalReceipt = async (target: DeliveryChallanRecord) => {
    try {
      const currentUser = userProfile?.displayName || userProfile?.email || 'Admin User';
      await updateDoc(doc(db, 'delivery_challans', target.id), {
        receivedStatus: 'received',
        receivedDate: format(new Date(), 'dd/MM/yyyy'),
        receiverName: target.deliveryContactPerson || target.customerName || 'Customer Store Representative',
        receivedQty: Number(target.currentDeliveryQty) || 0,
        receiverRemarks: 'Total Receipt Confirmed in Good Condition',
        receivedAt: Timestamp.now(),
        receivedBy: currentUser
      });
      showToast(`Challan '${target.challanNo}' TOTAL RECEIVED & ACKNOWLEDGED!`, 'success');
    } catch (err: any) {
      showToast('Failed to mark total receipt: ' + err.message, 'error');
    }
  };

  const handleSaveChallanReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingChallan) return;

    setIsUpdatingReceipt(true);
    try {
      const formattedDate = formatInputDate(receiveDate);
      const currentUser = userProfile?.displayName || userProfile?.email || 'Admin User';

      if (receiptMode === 'reject') {
        if (!canRejectChallan) {
          showToast('Permission Denied: Only Admin, MD, GM, or Sales Manager are authorized to reject delivery challans.', 'error');
          setIsUpdatingReceipt(false);
          return;
        }

        if (!rejectionReason.trim()) {
          showToast('Please specify the company rejection reason.', 'warning');
          setIsUpdatingReceipt(false);
          return;
        }

        await updateDoc(doc(db, 'delivery_challans', receivingChallan.id), {
          status: 'cancelled',
          receivedStatus: 'rejected',
          rejectedDate: formattedDate,
          rejectionReason: rejectionReason.trim(),
          rejectedQty: Number(rejectedQty) || Number(receivingChallan.currentDeliveryQty) || 0,
          rejectedBy: currentUser,
          receiverRemarks: `REJECTED: ${rejectionReason.trim()}`,
          receivedAt: Timestamp.now()
        });

        showToast(`Challan '${receivingChallan.challanNo}' REJECTED & CANCELLED! Goods quantity returned to Available Balance for re-issuance.`, 'warning');
      } else {
        const finalReceiver = receiverName.trim() || receivingChallan.deliveryContactPerson || receivingChallan.customerName || 'Store Representative';

        await updateDoc(doc(db, 'delivery_challans', receivingChallan.id), {
          receivedStatus: 'received',
          receivedDate: formattedDate,
          receiverName: finalReceiver,
          receivedQty: Number(verifiedQty) || Number(receivingChallan.currentDeliveryQty) || 0,
          receiverRemarks: receiveRemarks.trim() || 'Received in good condition',
          receivedAt: Timestamp.now(),
          receivedBy: currentUser
        });

        showToast(`Challan '${receivingChallan.challanNo}' marked as RECEIVED and acknowledged!`, 'success');
      }

      setShowReceiveModal(false);
      setReceivingChallan(null);
    } catch (err: any) {
      showToast('Failed to update Challan status: ' + err.message, 'error');
    } finally {
      setIsUpdatingReceipt(false);
    }
  };

  // Export Filtered Challans to Excel
  const handleExportExcel = () => {
    const dataToExport = filteredChallans.map(c => ({
      'Challan No': c.challanNo,
      'Date': c.challanDate,
      'Work Order': c.woNumber,
      'PI No': c.piNo || '-',
      'PO No': c.poNo || '-',
      'Customer': c.customerName,
      'Buyer': c.buyerName,
      'Product': c.productName,
      'Order Qty': c.orderQty,
      'Delivered Qty': c.currentDeliveryQty,
      'Unit': c.unit,
      'Total Box': c.totalBox || '1',
      'Delivery Vehicle': c.vehicleNo,
      'Driver Name': c.driverName,
      'Driver Mobile': c.driverMobile,
      'Status': c.receivedStatus === 'received' ? 'Received & Acknowledged' : c.receivedStatus === 'rejected' ? `Rejected (${c.rejectionReason || ''})` : 'Pending Receipt',
      'Rejection Reason': c.rejectionReason || '-',
      'Receiver Name': c.receiverName || '-',
      'Received Date': c.receivedDate || '-',
      'Prepared By': c.preparedBy
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Challans');
    XLSX.writeFile(wb, `ES_Trims_Delivery_Challans_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    showToast(`Exported ${dataToExport.length} Delivery Challan records to Excel!`, 'info');
  };

  // Unique lists for Filter Dropdowns
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    challans.forEach(c => { if (c.customerName) set.add(c.customerName); });
    return Array.from(set).sort();
  }, [challans]);

  const uniqueWorkOrders = useMemo(() => {
    const set = new Set<string>();
    challans.forEach(c => { if (c.woNumber) set.add(c.woNumber); });
    return Array.from(set).sort();
  }, [challans]);

  // Comprehensive Filtered Challans
  const filteredChallans = useMemo(() => {
    return challans.filter(c => {
      // 1. Quick Search Text
      const q = (searchChallanNo || '').toLowerCase().trim();
      const textMatch = !q || 
        (c.challanNo || '').toLowerCase().includes(q) ||
        (c.woNumber || '').toLowerCase().includes(q) ||
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.poNo && c.poNo.toLowerCase().includes(q)) ||
        (c.buyerName && c.buyerName.toLowerCase().includes(q));

      if (!textMatch) return false;

      // 2. Between Date Range Filter
      if (filterStartDate || filterEndDate) {
        let cDate: Date | null = null;
        if (c.challanDate) {
          if (c.challanDate.includes('/')) {
            const [d, m, y] = c.challanDate.split('/');
            cDate = new Date(Number(y), Number(m) - 1, Number(d));
          } else {
            cDate = new Date(c.challanDate);
          }
        }
        if (cDate) {
          if (filterStartDate) {
            const start = new Date(filterStartDate);
            start.setHours(0, 0, 0, 0);
            if (cDate < start) return false;
          }
          if (filterEndDate) {
            const end = new Date(filterEndDate);
            end.setHours(23, 59, 59, 999);
            if (cDate > end) return false;
          }
        }
      }

      // 3. Customer Filter
      if (filterCustomer !== 'ALL' && c.customerName !== filterCustomer) {
        return false;
      }

      // 4. Work Order Filter
      if (filterWoNumber !== 'ALL' && c.woNumber !== filterWoNumber) {
        return false;
      }

      // 5. Status Filter
      if (filterStatus !== 'ALL') {
        const status = c.receivedStatus || 'pending';
        if (filterStatus === 'pending' && status !== 'pending') return false;
        if (filterStatus === 'received' && status !== 'received') return false;
        if (filterStatus === 'rejected' && status !== 'rejected') return false;
      }

      return true;
    });
  }, [challans, searchChallanNo, filterStartDate, filterEndDate, filterCustomer, filterWoNumber, filterStatus]);

  return (
    <div className="space-y-6">
      {/* HEADER & SUBMODULE NAV */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-neutral-900">Despatch & Delivery Management</h1>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            ES Trims Limited official delivery challans, gate passes & customer receipt tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          {[
            { id: 'despatch-challan', label: 'Delivery Challan', icon: FileText },
            { id: 'despatch-report', label: 'Challan Register', icon: FileSpreadsheet },
            { id: 'despatch-gatepass', label: 'Gate Pass', icon: ShieldCheck, badge: challansAwaitingGatePass.length },
            { id: 'despatch-received', label: 'Challan Received', icon: Clock },
            { id: 'despatch-mrr-receipt', label: 'Customer MRR Receipt', icon: CheckCircle2 },
          ].filter(tab => availableTabs.includes(tab.id)).map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all relative ${
                  active 
                    ? 'bg-white text-indigo-700 shadow-sm border border-neutral-200' 
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-black rounded-full shadow-2xs animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- SUBTAB 1: DELIVERY CHALLAN CREATION --- */}
      {subTab === 'despatch-challan' && (
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm space-y-6">
          <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Create Delivery Challan (ES Trims Format)</h2>
              <p className="text-xs text-neutral-500">Only completed production quantities are available for despatch</p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-mono text-xs font-bold rounded-full border border-indigo-200">
              Auto sequence: {generateNextChallanNo()}
            </span>
          </div>

          <form onSubmit={handleSaveChallan} className="space-y-6 text-xs">
            {/* Top Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <div className="space-y-1 col-span-1 md:col-span-2">
                <label className="font-bold text-neutral-700 block">Select Work Order <span className="text-rose-500">*</span></label>
                <select
                  value={selectedWoId}
                  onChange={(e) => setSelectedWoId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Select Work Order --</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      {wo.woNumber} | {wo.customerName} ({wo.finishedGoodsName || 'Trims Item'}) - Qty: {wo.totalQuantity?.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 block">Challan Date</label>
                <input
                  type="date"
                  value={challanDate}
                  onChange={(e) => setChallanDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 block">Delivery By / Carrier</label>
                <select
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(e.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-bold"
                >
                  <option value="Company Truck">Company Dedicated Truck</option>
                  <option value="Covered Van">Covered Van Express</option>
                  <option value="Courier Express">Courier Express (SA Paribahan/Sundarban)</option>
                  <option value="Hand Delivery">Hand Delivery / Agent</option>
                  <option value="Customer Self Pickup">Customer Self Pickup</option>
                </select>
              </div>
            </div>

            {/* ES Trims PDF Grid Header Inputs */}
            {activeWo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
                {/* Left Block: Invoice & Delivery Address */}
                <div className="space-y-3">
                  <h3 className="font-bold text-indigo-900 text-xs uppercase border-b border-indigo-200 pb-1 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" /> Bill to & Ship to Party Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Invoice Address (Bill to)</label>
                      <input
                        type="text"
                        value={invoiceAddress}
                        onChange={(e) => setInvoiceAddress(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Invoice Contact Person</label>
                      <input
                        type="text"
                        value={invoiceContactPerson}
                        onChange={(e) => setInvoiceContactPerson(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Delivery Address (Ship to)</label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs font-bold text-indigo-950"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Delivery Contact Person</label>
                      <input
                        type="text"
                        value={deliveryContactPerson}
                        onChange={(e) => setDeliveryContactPerson(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Block: Order Reference Info */}
                <div className="space-y-3">
                  <h3 className="font-bold text-indigo-900 text-xs uppercase border-b border-indigo-200 pb-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" /> Reference Documents & FSC-COC
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">P.O. Number</label>
                      <input
                        type="text"
                        value={activeWo.poNo || ''}
                        readOnly
                        className="w-full p-2 bg-neutral-100 border border-neutral-300 rounded-lg font-bold font-mono text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Buyer Name</label>
                      <input
                        type="text"
                        value={activeWo.buyerName || ''}
                        readOnly
                        className="w-full p-2 bg-neutral-100 border border-neutral-300 rounded-lg font-bold text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Work Order No</label>
                      <input
                        type="text"
                        value={activeWo.woNumber}
                        readOnly
                        className="w-full p-2 bg-neutral-100 border border-neutral-300 rounded-lg font-bold font-mono text-indigo-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">PI NO</label>
                      <input
                        type="text"
                        value={piNo}
                        onChange={(e) => setPiNo(e.target.value)}
                        placeholder="e.g. CPI-000078-2026"
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">FSC-COC</label>
                      <input
                        type="text"
                        value={fscCoc}
                        onChange={(e) => setFscCoc(e.target.value)}
                        placeholder="e.g. FSC Mix 70%"
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">WO Bag No</label>
                      <input
                        type="text"
                        value={woBagNo}
                        onChange={(e) => setWoBagNo(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Production Quantity Calculation Banner */}
            {activeWo && activeWoDeliveryStats && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase block">Total Order Qty</span>
                    <span className="text-sm font-black text-neutral-800">{activeWoDeliveryStats.orderQty.toLocaleString()} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase block">Produced Qty</span>
                    <span className="text-sm font-black text-emerald-800">{activeWoDeliveryStats.productionCompletedQty.toLocaleString()} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase block">Prev. Delivered</span>
                    <span className="text-sm font-black text-cyan-800">{activeWoDeliveryStats.previouslyDeliveredQty.toLocaleString()} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase block">Available for Despatch</span>
                    <span className="text-sm font-black text-indigo-900">{activeWoDeliveryStats.availableQty.toLocaleString()} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase block">Remaining Balance</span>
                    <span className="text-sm font-black text-rose-700">{activeWoDeliveryStats.remainingQty.toLocaleString()} Pcs</span>
                  </div>
                </div>

                {/* Delivery Quantity Entry & Vehicle Details */}
                <div className="p-4 bg-white border border-neutral-300 rounded-xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                      <Truck className="w-4 h-4 text-indigo-600" /> Transport & Despatch Quantity Controls
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSetDeliveryQty(activeWoDeliveryStats.availableQty)}
                      className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold hover:bg-indigo-200 transition-colors"
                    >
                      Set Full Delivery ({activeWoDeliveryStats.availableQty.toLocaleString()} Pcs)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Despatch Quantity <span className="text-rose-500">*</span></label>
                      <input
                        type="number"
                        min={0}
                        value={currentDeliveryQty}
                        onChange={(e) => handleSetDeliveryQty(Number(e.target.value))}
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-base font-black text-indigo-900 focus:bg-white"
                        max={activeWoDeliveryStats.availableQty}
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Vehicle No</label>
                      <input
                        type="text"
                        value={vehicleNo}
                        onChange={(e) => setVehicleNo(e.target.value)}
                        placeholder="e.g. Dhaka Metro-TA 11-2045"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Driver Name & Mobile</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Driver Name"
                          className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          value={driverMobile}
                          onChange={(e) => setDriverMobile(e.target.value)}
                          placeholder="Mobile No"
                          className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Total Package / Box</label>
                      <input
                        type="text"
                        value={totalBox}
                        onChange={(e) => setTotalBox(e.target.value)}
                        placeholder="e.g. 5 Cartons"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Items Breakdown Table Preview with Checkbox Selection */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-neutral-900 text-xs uppercase flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        Size Breakdown Line Items Selection (Challan Print Breakdown)
                      </h3>
                      <p className="text-[11px] text-neutral-500">
                        Tik mark diye jei size/breakdown gula select korben sudhu oi guloi Delivery Challan-e issue hobe
                      </p>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAllBreakdowns(true)}
                        className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Select All Available
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllBreakdowns(false)}
                        className="px-2.5 py-1 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-md text-[11px] font-bold hover:bg-neutral-200 transition-colors"
                      >
                        Deselect All
                      </button>
                      <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-md text-[11px] font-black">
                        {challanItems.filter(i => i.selected && i.challanQty > 0).length} of {challanItems.length} Selected ({currentDeliveryQty.toLocaleString()} Pcs)
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-neutral-300 rounded-xl shadow-xs">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-neutral-300 font-bold uppercase text-[9px] text-neutral-700">
                          <th className="p-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={challanItems.length > 0 && challanItems.every(i => i.selected)}
                              onChange={(e) => handleSelectAllBreakdowns(e.target.checked)}
                              className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                              title="Select / Deselect All"
                            />
                          </th>
                          <th className="p-2 w-8 text-center">SN</th>
                          <th className="p-2">Style</th>
                          <th className="p-2">Job No</th>
                          <th className="p-2">PO No</th>
                          <th className="p-2">Colour</th>
                          <th className="p-2">Size</th>
                          <th className="p-2 text-right">Order QTY</th>
                          <th className="p-2 text-right">P. Challan QTY</th>
                          <th className="p-2 text-right text-emerald-800">Available QTY</th>
                          <th className="p-2 text-right text-indigo-900 font-black">Challan QTY</th>
                          <th className="p-2 text-right text-rose-700 font-bold">Balance QTY</th>
                          <th className="p-2 text-center">UOM</th>
                          <th className="p-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {challanItems.map((item, idx) => {
                          const maxAvail = item.availableQty ?? Math.max(0, item.orderQty - (item.pChallanQty || 0));
                          const isRowSelected = item.selected && item.challanQty > 0;

                          return (
                            <tr
                              key={idx}
                              className={`transition-colors ${isRowSelected ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'bg-white hover:bg-neutral-50 opacity-75'}`}
                            >
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!item.selected}
                                  onChange={() => handleToggleSelectItem(idx)}
                                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                                />
                              </td>
                              <td className="p-2 font-bold text-center text-neutral-500">{idx + 1}</td>
                              <td className="p-2 font-bold text-neutral-900">{item.style}</td>
                              <td className="p-2 font-mono text-neutral-700">{item.jobNo}</td>
                              <td className="p-2 font-mono text-neutral-700">{item.poNo}</td>
                              <td className="p-2 font-medium">{item.color}</td>
                              <td className="p-2 font-bold text-indigo-950 bg-indigo-50/40 px-2 rounded text-center">{item.size}</td>
                              <td className="p-2 text-right font-bold">{item.orderQty.toLocaleString()}</td>
                              <td className="p-2 text-right text-neutral-600">{item.pChallanQty || 0}</td>
                              <td className="p-2 text-right font-bold text-emerald-700">
                                {maxAvail.toLocaleString()}
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxAvail}
                                  value={item.challanQty}
                                  onChange={(e) => handleItemRowChange(idx, 'challanQty', Number(e.target.value))}
                                  disabled={!item.selected}
                                  className={`w-24 p-1.5 border rounded-lg text-right font-black transition-all ${
                                    item.selected
                                      ? 'bg-white border-indigo-400 text-indigo-900 shadow-2xs focus:ring-2 focus:ring-indigo-500'
                                      : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                                  }`}
                                />
                              </td>
                              <td className="p-2 text-right font-black text-rose-700">
                                {item.balanceQty || 0}
                              </td>
                              <td className="p-2 text-center text-neutral-600">{item.unit || 'Pcs'}</td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={item.remarks || ''}
                                  onChange={(e) => handleItemRowChange(idx, 'remarks', e.target.value)}
                                  disabled={!item.selected}
                                  placeholder="Notes..."
                                  className="w-full p-1 bg-white border border-neutral-300 rounded text-xs disabled:bg-neutral-100"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-neutral-100 border-t-2 border-neutral-300 font-black text-neutral-900 text-xs">
                          <td colSpan={7} className="p-2.5 text-right uppercase tracking-wider">
                            Total Selected For Delivery:
                          </td>
                          <td className="p-2 text-right">
                            {challanItems.reduce((sum, it) => sum + (it.orderQty || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-right text-neutral-600">
                            {challanItems.reduce((sum, it) => sum + (it.pChallanQty || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-right text-emerald-800">
                            {challanItems.reduce((sum, it) => sum + (it.availableQty ?? Math.max(0, it.orderQty - (it.pChallanQty || 0))), 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-right text-indigo-900 bg-indigo-100/60 font-black text-sm">
                            {challanItems.filter(i => i.selected).reduce((sum, it) => sum + (it.challanQty || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-right text-rose-700 font-bold">
                            {challanItems.reduce((sum, it) => sum + (it.balanceQty || 0), 0).toLocaleString()}
                          </td>
                          <td colSpan={2} className="p-2 text-center text-indigo-700">
                            {challanItems.filter(i => i.selected && i.challanQty > 0).length} Rows Selected
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-neutral-200">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md"
                  >
                    <Save className="w-4 h-4" /> Issue Delivery Challan
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* --- SUBTAB 2: DELIVERY CHALLAN REGISTER --- */}
      {subTab === 'despatch-report' && (
        <div className="space-y-6">
          {/* Header & Main Actions */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Delivery Challan Register & History</h2>
              <p className="text-xs text-neutral-500">View, search, filter and export past delivery challan documents</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Excel ({filteredChallans.length})
              </button>
            </div>
          </div>

          {/* Advanced Multi-Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600" /> Filter Challan Register
              </span>
              {(filterStartDate || filterEndDate || filterCustomer !== 'ALL' || filterWoNumber !== 'ALL' || filterStatus !== 'ALL' || searchChallanNo) && (
                <button
                  onClick={() => {
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setFilterCustomer('ALL');
                    setFilterWoNumber('ALL');
                    setFilterStatus('ALL');
                    setSearchChallanNo('');
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline"
                >
                  Reset All Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {/* Filter 1: Date Range From - To */}
              <div>
                <label className="font-bold text-neutral-700 block mb-1">From Date (Between)</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">To Date (Between)</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                />
              </div>

              {/* Filter 2: Customer Filter */}
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Customer / Buyer</label>
                <select
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium"
                >
                  <option value="ALL">All Customers ({uniqueCustomers.length})</option>
                  {uniqueCustomers.map((cust, idx) => (
                    <option key={idx} value={cust}>{cust}</option>
                  ))}
                </select>
              </div>

              {/* Filter 3: Work Order Number Filter */}
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Work Order No</label>
                <select
                  value={filterWoNumber}
                  onChange={(e) => setFilterWoNumber(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono font-medium"
                >
                  <option value="ALL">All Work Orders ({uniqueWorkOrders.length})</option>
                  {uniqueWorkOrders.map((wo, idx) => {
                    const count = challans.filter(c => c.woNumber === wo).length;
                    return <option key={idx} value={wo}>{wo} ({count} Challans)</option>;
                  })}
                </select>
              </div>

              {/* Filter 4: Status Filter */}
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Receipt Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending">Pending Receipt</option>
                  <option value="received">Received & Acknowledged</option>
                  <option value="rejected">Rejected Challans</option>
                </select>
              </div>
            </div>

            {/* Quick Keyword Search Input */}
            <div className="relative pt-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={searchChallanNo}
                onChange={(e) => setSearchChallanNo(e.target.value)}
                placeholder="Search Challan No, Buyer, Product Name, PO No..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium"
              />
            </div>
          </div>

          {/* Filtered Statistics Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
              <p className="text-[10px] font-bold text-indigo-700 uppercase">Filtered Challans</p>
              <p className="text-xl font-black text-indigo-950 mt-0.5">{filteredChallans.length}</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-700 uppercase">Total Delivered Qty</p>
              <p className="text-xl font-black text-emerald-950 mt-0.5">
                {filteredChallans.reduce((acc, c) => acc + (c.currentDeliveryQty || 0), 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
              <p className="text-[10px] font-bold text-blue-700 uppercase">Received Count</p>
              <p className="text-xl font-black text-blue-950 mt-0.5">
                {filteredChallans.filter(c => c.receivedStatus === 'received').length}
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
              <p className="text-[10px] font-bold text-rose-700 uppercase">Rejected Count</p>
              <p className="text-xl font-black text-rose-950 mt-0.5">
                {filteredChallans.filter(c => c.receivedStatus === 'rejected').length}
              </p>
            </div>
          </div>

          {/* Challan Table */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-200 font-bold uppercase text-[10px] text-neutral-700">
                  <th className="p-3">Challan No</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Work Order</th>
                  <th className="p-3">Customer & Buyer</th>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Delivered Qty</th>
                  <th className="p-3">Vehicle & Driver</th>
                  <th className="p-3">Gate Pass & Lock</th>
                  <th className="p-3">Receipt Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {filteredChallans.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-neutral-500 italic">No delivery challans matched the selected filters.</td>
                  </tr>
                ) : (
                  filteredChallans.map(c => {
                    const gp = gatePasses.find(g => g.challanId === c.id && g.status !== 'cancelled');
                    const isApproved = c.isLocked || c.gatePassStatus === 'approved' || gp?.approvalStatus === 'approved';
                    const isRejected = c.gatePassStatus === 'rejected' || gp?.approvalStatus === 'rejected';
                    const isPending = c.gatePassStatus === 'pending' || gp?.approvalStatus === 'pending';

                    return (
                      <tr key={c.id} className={c.receivedStatus === 'rejected' ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-neutral-50'}>
                        <td className="p-3 font-mono font-bold text-indigo-900">{c.challanNo}</td>
                        <td className="p-3 font-mono">{c.challanDate}</td>
                        <td className="p-3 font-mono font-bold">{c.woNumber}</td>
                        <td className="p-3">
                          <p className="font-bold text-neutral-900">{c.customerName}</p>
                          <p className="text-[10px] text-neutral-500">Buyer: {c.buyerName}</p>
                        </td>
                        <td className="p-3">{c.productName}</td>
                        <td className="p-3 text-right font-black text-indigo-900">{c.currentDeliveryQty?.toLocaleString()} {c.unit}</td>
                        <td className="p-3 font-mono text-[10px]">
                          <p className="font-bold">{c.vehicleNo || 'N/A'}</p>
                          <p className="text-neutral-500">{c.driverName || 'N/A'}</p>
                        </td>
                        <td className="p-3">
                          {isApproved ? (
                            <div>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit shadow-2xs">
                                <Lock className="w-3 h-3 text-emerald-700" /> Locked (Approved)
                              </span>
                              {gp && (
                                <p className="text-[9px] font-mono text-emerald-900 mt-0.5">{gp.gatePassNo}</p>
                              )}
                            </div>
                          ) : isRejected ? (
                            <div>
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                                <Unlock className="w-3 h-3 text-rose-600" /> Unlocked (Rejected)
                              </span>
                              {gp?.rejectionReason && (
                                <p className="text-[9px] font-bold text-rose-600 mt-0.5 truncate max-w-[120px]" title={gp.rejectionReason}>
                                  {gp.rejectionReason}
                                </p>
                              )}
                            </div>
                          ) : isPending ? (
                            <div>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                                <Unlock className="w-3 h-3 text-amber-600" /> Unlocked (Pending)
                              </span>
                              {gp && (
                                <p className="text-[9px] font-mono text-amber-900 mt-0.5">{gp.gatePassNo}</p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                              <Unlock className="w-3 h-3 text-slate-500" /> Unlocked (No GP)
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {c.receivedStatus === 'received' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" /> Received ({c.receivedDate})
                            </span>
                          ) : c.receivedStatus === 'rejected' ? (
                            <div>
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                                <AlertCircle className="w-3 h-3 text-rose-600" /> Rejected
                              </span>
                              {c.rejectionReason && (
                                <p className="text-[10px] font-bold text-rose-700 mt-1 max-w-xs truncate" title={c.rejectionReason}>
                                  Reason: {c.rejectionReason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                              <Clock className="w-3 h-3" /> Pending Receipt
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Button for Unlocked Challan */}
                            {!isApproved ? (
                              <button
                                onClick={() => handleOpenEditChallan(c)}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                title="Edit Delivery Challan Details & Quantities"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-400 rounded text-[10px] font-bold flex items-center gap-0.5" title="Locked: Gate Pass approved">
                                <Lock className="w-2.5 h-2.5" /> Locked
                              </span>
                            )}

                            <button
                              onClick={() => setPrintableChallan(c)}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-xs"
                              title="Print ES Trims Official Challan"
                            >
                              <Printer className="w-3 h-3" /> Print
                            </button>
                            
                            {c.receivedStatus !== 'received' && (
                              <button
                                onClick={() => {
                                  if (!isApproved) {
                                    showToast('Security Clearance: Gate Pass must be Approved before customer receipt acknowledgment.', 'warning');
                                    return;
                                  }
                                  handleOpenReceiveModal(c, 'receive');
                                }}
                                className={`px-2 py-1 rounded text-[10px] font-bold ${
                                  isApproved 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                                    : 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed'
                                }`}
                                title={isApproved ? 'Acknowledge Receipt' : 'Gate Pass Approval required first'}
                              >
                                Receive
                              </button>
                            )}
                            {c.receivedStatus !== 'rejected' && (
                              <button
                                onClick={() => handleOpenReceiveModal(c, 'reject')}
                                className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold hover:bg-rose-100"
                              >
                                Reject
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
      )}

      {/* --- SUBTAB 3: GATE PASS --- */}
      {subTab === 'despatch-gatepass' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-neutral-900">Security Gate Passes & Approval Clearance</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Challans remain unlocked until Gate Pass approval. Once approved, the Challan is locked and cleared for Customer Receipt.
              </p>
            </div>
            <button
              onClick={() => {
                setGpChallanId('');
                setShowGatePassModal(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Issue Gate Pass
            </button>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div 
              onClick={() => setGatePassSubView('pending-challans')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                gatePassSubView === 'pending-challans'
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40 shadow-xs'
                  : 'bg-white border-neutral-200 hover:border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-600">Awaiting Gate Pass</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-amber-900">{challansAwaitingGatePass.length}</span>
                <span className="text-[10px] font-bold text-amber-700">Challans Unlocked</span>
              </div>
            </div>

            <div 
              onClick={() => {
                setGatePassSubView('issued-passes');
                setGpApprovalFilter('pending');
              }}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                gatePassSubView === 'issued-passes' && gpApprovalFilter === 'pending'
                  ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-400/40 shadow-xs'
                  : 'bg-white border-neutral-200 hover:border-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-600">Pending Approval</span>
                <AlertCircle className="w-4 h-4 text-yellow-600" />
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-yellow-900">
                  {gatePasses.filter(gp => gp.status !== 'cancelled' && (gp.approvalStatus === 'pending' || !gp.approvalStatus)).length}
                </span>
                <span className="text-[10px] font-bold text-yellow-700">Needs Confirmation</span>
              </div>
            </div>

            <div 
              onClick={() => {
                setGatePassSubView('issued-passes');
                setGpApprovalFilter('approved');
              }}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                gatePassSubView === 'issued-passes' && gpApprovalFilter === 'approved'
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/40 shadow-xs'
                  : 'bg-white border-neutral-200 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-600">Approved & Locked</span>
                <Lock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-900">
                  {gatePasses.filter(gp => gp.status !== 'cancelled' && gp.approvalStatus === 'approved').length}
                </span>
                <span className="text-[10px] font-bold text-emerald-700">Cleared for Receipt</span>
              </div>
            </div>

            <div 
              onClick={() => {
                setGatePassSubView('issued-passes');
                setGpApprovalFilter('rejected');
              }}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                gatePassSubView === 'issued-passes' && gpApprovalFilter === 'rejected'
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/40 shadow-xs'
                  : 'bg-white border-neutral-200 hover:border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-600">Rejected (Unlocked)</span>
                <Unlock className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-rose-900">
                  {gatePasses.filter(gp => gp.status !== 'cancelled' && gp.approvalStatus === 'rejected').length}
                </span>
                <span className="text-[10px] font-bold text-rose-700">Editable for Re-submit</span>
              </div>
            </div>
          </div>

          {/* Sub-view Toggle */}
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGatePassSubView('pending-challans')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  gatePassSubView === 'pending-challans'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Challans Awaiting Gate Pass
                {challansAwaitingGatePass.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    gatePassSubView === 'pending-challans' ? 'bg-indigo-800 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {challansAwaitingGatePass.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setGatePassSubView('issued-passes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  gatePassSubView === 'issued-passes'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Security Gate Passes ({gatePasses.filter(g => g.status !== 'cancelled').length})
              </button>
            </div>

            {gatePassSubView === 'issued-passes' && (
              <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setGpApprovalFilter('all')}
                  className={`px-2.5 py-1 rounded-md ${gpApprovalFilter === 'all' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setGpApprovalFilter('pending')}
                  className={`px-2.5 py-1 rounded-md ${gpApprovalFilter === 'pending' ? 'bg-white text-yellow-800 shadow-2xs' : 'text-neutral-600'}`}
                >
                  Pending
                </button>
                <button
                  type="button"
                  onClick={() => setGpApprovalFilter('approved')}
                  className={`px-2.5 py-1 rounded-md ${gpApprovalFilter === 'approved' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-neutral-600'}`}
                >
                  Approved
                </button>
                <button
                  type="button"
                  onClick={() => setGpApprovalFilter('rejected')}
                  className={`px-2.5 py-1 rounded-md ${gpApprovalFilter === 'rejected' ? 'bg-white text-rose-800 shadow-2xs' : 'text-neutral-600'}`}
                >
                  Rejected
                </button>
              </div>
            )}
          </div>

          {/* VIEW 1: CHALLANS AWAITING GATE PASS */}
          {gatePassSubView === 'pending-challans' && (
            <div className="space-y-3">
              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Challans Pending Security Gate Pass Clearance</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    The Delivery Challans listed below are currently <strong>UNLOCKED</strong> and editable. Once you Issue a Gate Pass and it is approved, the Challan will be <strong>LOCKED</strong> automatically and forwarded to Challan Received.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-200 font-bold uppercase text-[10px] text-neutral-700">
                      <th className="p-3">Challan No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Work Order</th>
                      <th className="p-3">Customer & Buyer</th>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Delivery Qty</th>
                      <th className="p-3">Vehicle & Driver</th>
                      <th className="p-3">Gate Pass Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 font-medium">
                    {challansAwaitingGatePass.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-neutral-500 italic">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                          All generated delivery challans currently have security gate passes issued.
                        </td>
                      </tr>
                    ) : (
                      challansAwaitingGatePass.map(c => (
                        <tr key={c.id} className="hover:bg-neutral-50">
                          <td className="p-3 font-mono font-bold text-indigo-900">{c.challanNo}</td>
                          <td className="p-3 font-mono">{c.challanDate}</td>
                          <td className="p-3 font-mono font-bold">{c.woNumber}</td>
                          <td className="p-3">
                            <p className="font-bold text-neutral-900">{c.customerName}</p>
                            <p className="text-[10px] text-neutral-500">Buyer: {c.buyerName || 'N/A'}</p>
                          </td>
                          <td className="p-3">{c.productName}</td>
                          <td className="p-3 text-right font-black text-indigo-950">
                            {c.currentDeliveryQty?.toLocaleString()} {c.unit}
                          </td>
                          <td className="p-3 font-mono text-[10px]">
                            <p className="font-bold">{c.vehicleNo || 'N/A'}</p>
                            <p className="text-neutral-500">{c.driverName || 'N/A'}</p>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                              <Unlock className="w-3 h-3 text-amber-600" /> Gate Pass Needed (Unlocked)
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setGpChallanId(c.id);
                                  setShowGatePassModal(true);
                                }}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                title="Issue Official Security Gate Pass"
                              >
                                <ShieldCheck className="w-3 h-3" /> Issue Gate Pass
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditChallan(c)}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                title="Edit Challan Quantity & Details (Unlocked)"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => setPrintableChallan(c)}
                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                title="Print Preview"
                              >
                                <Printer className="w-3 h-3" /> Print
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: ISSUED SECURITY GATE PASSES & APPROVAL WORKFLOW */}
          {gatePassSubView === 'issued-passes' && (
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-200 font-bold uppercase text-[10px] text-neutral-700">
                    <th className="p-3">Gate Pass No</th>
                    <th className="p-3">Challan No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer & Buyer</th>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-right">Delivery Qty</th>
                    <th className="p-3">Vehicle & Driver</th>
                    <th className="p-3">Approval & Lock Status</th>
                    <th className="p-3 text-center">Action & Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-medium">
                  {(() => {
                    const activePasses = gatePasses.filter(gp => gp.status !== 'cancelled');
                    const filteredPasses = activePasses.filter(gp => {
                      if (gpApprovalFilter === 'all') return true;
                      if (gpApprovalFilter === 'pending') return gp.approvalStatus === 'pending' || !gp.approvalStatus;
                      if (gpApprovalFilter === 'approved') return gp.approvalStatus === 'approved';
                      if (gpApprovalFilter === 'rejected') return gp.approvalStatus === 'rejected';
                      return true;
                    });

                    if (filteredPasses.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-neutral-500 italic">
                            No security gate passes matched the "{gpApprovalFilter}" filter.
                          </td>
                        </tr>
                      );
                    }

                    return filteredPasses.map(gp => {
                      const isApproved = gp.approvalStatus === 'approved';
                      const isRejected = gp.approvalStatus === 'rejected';
                      const isPending = !isApproved && !isRejected;
                      const matchingChallan = challans.find(c => c.id === gp.challanId);

                      return (
                        <tr key={gp.id} className={isRejected ? 'bg-rose-50/40 hover:bg-rose-50/70' : isApproved ? 'hover:bg-emerald-50/30' : 'hover:bg-neutral-50'}>
                          <td className="p-3 font-mono font-bold text-indigo-900">{gp.gatePassNo}</td>
                          <td className="p-3 font-mono">
                            <p className="font-bold">{gp.challanNo}</p>
                            <p className="text-[10px] text-neutral-500">WO: {gp.woNumber}</p>
                          </td>
                          <td className="p-3 font-mono">{gp.gatePassDate}</td>
                          <td className="p-3">
                            <p className="font-bold text-neutral-900">{gp.customerName}</p>
                            <p className="text-[10px] text-neutral-500">Buyer: {gp.buyerName || 'N/A'}</p>
                          </td>
                          <td className="p-3">{gp.productName}</td>
                          <td className="p-3 text-right font-black text-indigo-950">{gp.deliveryQty?.toLocaleString()} {gp.unit}</td>
                          <td className="p-3 font-mono text-[10px]">
                            <p className="font-bold">{gp.vehicleNo}</p>
                            <p className="text-neutral-500">{gp.driverName} ({gp.driverMobile || 'N/A'})</p>
                          </td>
                          <td className="p-3">
                            {isApproved ? (
                              <div>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit shadow-2xs">
                                  <Lock className="w-3 h-3 text-emerald-700" /> Approved & Locked
                                </span>
                                {gp.approvedBy && (
                                  <p className="text-[9px] text-emerald-800 font-bold mt-0.5">
                                    By {gp.approvedBy}
                                  </p>
                                )}
                              </div>
                            ) : isRejected ? (
                              <div>
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                                  <AlertCircle className="w-3 h-3 text-rose-600" /> Rejected (Unlocked)
                                </span>
                                {gp.rejectionReason && (
                                  <p className="text-[9px] font-bold text-rose-700 mt-0.5 max-w-[150px] truncate" title={gp.rejectionReason}>
                                    Reason: {gp.rejectionReason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3 text-yellow-600" /> Pending Approval (Unlocked)
                                </span>
                                <span className="text-[9px] text-neutral-500">Challan editable</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* APPROVE BUTTON */}
                              {isPending && (
                                <>
                                  {canApproveGatePass ? (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveGatePass(gp)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                      title="Confirm & Approve Gate Pass (Locks Delivery Challan)"
                                    >
                                      <Check className="w-3 h-3" /> Approve & Lock
                                    </button>
                                  ) : (
                                    <span className="px-2 py-1 bg-neutral-100 text-neutral-500 rounded text-[10px] font-bold" title="Gate pass approval requires Manager / Security clearance permission">
                                      Awaiting Clearance
                                    </span>
                                  )}

                                  {canApproveGatePass && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingGatePass(gp);
                                        setGpRejectReason('');
                                      }}
                                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="Reject Gate Pass (Keeps Challan Unlocked for Correction)"
                                    >
                                      <X className="w-3 h-3" /> Reject
                                    </button>
                                  )}
                                </>
                              )}

                              {/* IF REJECTED: ALLOW RESUBMIT */}
                              {isRejected && (
                                <button
                                  type="button"
                                  onClick={() => handleResubmitGatePass(gp)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Resubmit Gate Pass for Approval"
                                >
                                  <RotateCcw className="w-3 h-3" /> Resubmit GP
                                </button>
                              )}

                              {/* EDIT CHALLAN BUTTON: ALLOWED WHEN UNLOCKED (PENDING OR REJECTED) */}
                              {!isApproved && matchingChallan && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditChallan(matchingChallan)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Edit Delivery Challan (Quantity/Vehicle/Details)"
                                >
                                  <Edit3 className="w-3 h-3" /> Edit Challan
                                </button>
                              )}

                              {/* PRINT GATE PASS */}
                              <button
                                type="button"
                                onClick={() => setPrintableGatePass(gp)}
                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                title="Print Official Security Gate Pass"
                              >
                                <Printer className="w-3 h-3" /> Print GP
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB 4: CHALLAN RECEIVED (CUSTOMER RECEIPT ACKNOWLEDGMENT) --- */}
      {subTab === 'despatch-received' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Challan Receipt & Customer Rejection Portal
              </h2>
              <p className="text-xs text-neutral-500 font-medium">
                Search Challan Number to acknowledge total receipt or record rejection reasons with user audit logs
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {challans.filter(c => c.receivedStatus === 'received').length} / {challans.length} Received
              </span>
              {challans.filter(c => c.receivedStatus === 'rejected').length > 0 && (
                <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> {challans.filter(c => c.receivedStatus === 'rejected').length} Rejected
                </span>
              )}
            </div>
          </div>

          {/* Quick Search & Fast Action Control Hub */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" /> Search Delivery Challan for Instant Action
              </span>
              <span className="text-[11px] text-slate-400">Type or select Challan No (e.g. CLN-000001) to confirm or reject</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Live Search Input */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Search by Challan No, Buyer or WO</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={receiptSearchNo}
                    onChange={(e) => setReceiptSearchNo(e.target.value)}
                    placeholder="Search Challan No (e.g. CLN-000001), Buyer, WO..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                  />
                  {receiptSearchNo && (
                    <button
                      onClick={() => setReceiptSearchNo('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Option B: Direct Dropdown Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Select from Cleared Delivery Challan List</label>
                <select
                  value={selectedChallanForQuickReceipt}
                  onChange={(e) => {
                    setSelectedChallanForQuickReceipt(e.target.value);
                    if (e.target.value) setReceiptSearchNo(e.target.value);
                  }}
                  className="w-full p-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Cleared Delivery Challan No --</option>
                  {clearedForReceiptChallans.length === 0 ? (
                    <option value="" disabled>No Challans cleared with approved Gate Pass yet</option>
                  ) : (
                    clearedForReceiptChallans.map(c => (
                      <option key={c.id} value={c.challanNo}>
                        {c.challanNo} | {c.customerName} ({c.currentDeliveryQty?.toLocaleString()} {c.unit}) [{c.receivedStatus || 'pending'}]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Warning if searched Challan is not approved / locked yet */}
            {(() => {
              const q = receiptSearchNo.trim().toLowerCase();
              if (!q) return null;
              const unapprovedMatch = challans.find(c => 
                !approvedGatePassChallanIds.has(c.id) && 
                c.gatePassStatus !== 'approved' && 
                c.status !== 'cancelled' &&
                (c.challanNo.toLowerCase().includes(q) || (c.woNumber && c.woNumber.toLowerCase().includes(q)))
              );
              if (!unapprovedMatch) return null;

              return (
                <div className="bg-amber-950/80 border border-amber-500/50 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-300">
                      Challan '{unapprovedMatch.challanNo}' is UNLOCKED & Awaiting Gate Pass Clearance
                    </p>
                    <p className="text-[11px] text-amber-200/90 mt-0.5">
                      Status: {unapprovedMatch.gatePassStatus === 'rejected' ? 'Gate Pass Rejected' : unapprovedMatch.gatePassStatus === 'pending' ? 'Gate Pass Pending Approval' : 'No Gate Pass Issued Yet'}. 
                      Goods receipt can only be acknowledged after official Gate Pass approval.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Quick Action Bar for Currently Selected or Single Searched Match */}
            {(() => {
              const matchedChallan = selectedChallanForQuickReceipt 
                ? challans.find(c => c.challanNo === selectedChallanForQuickReceipt)
                : receiptSearchNo.trim() && receiptFilteredChallans.length === 1
                ? receiptFilteredChallans[0]
                : null;

              if (!matchedChallan) return null;

              const isRecv = matchedChallan.receivedStatus === 'received';
              const isRej = matchedChallan.receivedStatus === 'rejected';

              return (
                <div className="bg-slate-800/80 border border-indigo-500/40 p-4 rounded-xl space-y-3 mt-2 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
                    <div>
                      <span className="font-mono font-black text-indigo-300 text-sm tracking-wider">{matchedChallan.challanNo}</span>
                      <span className="ml-2 text-xs text-slate-300 font-bold">| {matchedChallan.customerName}</span>
                    </div>
                    <div>
                      {isRecv ? (
                        <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[11px] font-bold">
                          ✓ Already Received
                        </span>
                      ) : isRej ? (
                        <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-[11px] font-bold">
                          ✕ Rejected
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[11px] font-bold">
                          ⏱ Pending Confirmation
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400">Work Order No</p>
                      <p className="font-mono font-bold text-slate-200">{matchedChallan.woNumber}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Product</p>
                      <p className="font-bold text-slate-200 truncate">{matchedChallan.productName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Dispatched Qty</p>
                      <p className="font-black text-indigo-300">{matchedChallan.currentDeliveryQty?.toLocaleString()} {matchedChallan.unit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Vehicle / Driver</p>
                      <p className="font-bold text-slate-200">{matchedChallan.vehicleNo || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Audit Detail Line if already processed */}
                  {(isRecv || isRej) && (
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50 text-[11px]">
                      {isRecv ? (
                        <p className="text-emerald-300">
                          <span className="font-bold">Ke Receive Korece (User):</span> {matchedChallan.receivedBy || 'System User'} | <span className="font-bold">Receiver Person:</span> {matchedChallan.receiverName || '-'} ({matchedChallan.receivedDate})
                        </p>
                      ) : (
                        <p className="text-rose-300">
                          <span className="font-bold">Ke Reject Korece (User):</span> {matchedChallan.rejectedBy || 'System User'} | <span className="font-bold">Rejection Reason:</span> {matchedChallan.rejectionReason} ({matchedChallan.rejectedDate})
                        </p>
                      )}
                    </div>
                  )}

                  {/* Main Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuickTotalReceipt(matchedChallan)}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 min-w-[120px]"
                    >
                      <Check className="w-4 h-4" /> Quick Receipt OK
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenReceiveModal(matchedChallan, 'receive')}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 min-w-[120px]"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Detailed Receive
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenReceiveModal(matchedChallan, 'reject')}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 min-w-[120px]"
                    >
                      <AlertCircle className="w-4 h-4" /> Reject Challan
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Received & Rejected List Table */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Challan Receipt & Rejection Log ({receiptFilteredChallans.length})
              </span>
              <span className="text-[11px] text-neutral-500">
                Shows exact details of who received or rejected each delivery
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-200 font-bold uppercase text-[10px] text-neutral-700">
                  <th className="p-3">Challan No & Date</th>
                  <th className="p-3">Customer & WO</th>
                  <th className="p-3">Product & Qty</th>
                  <th className="p-3">Receipt / Rejection Status</th>
                  <th className="p-3">Who Processed (Ke Receive / Reject Korece)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {receiptFilteredChallans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-500 italic">
                      No delivery challans matched the search criteria.
                    </td>
                  </tr>
                ) : (
                  receiptFilteredChallans.map(c => {
                    const isRecv = c.receivedStatus === 'received';
                    const isRej = c.receivedStatus === 'rejected';

                    return (
                      <tr key={c.id} className={isRecv ? 'bg-emerald-50/30' : isRej ? 'bg-rose-50/40' : 'hover:bg-neutral-50'}>
                        <td className="p-3">
                          <p className="font-mono font-bold text-indigo-900">{c.challanNo}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">{c.challanDate}</p>
                        </td>

                        <td className="p-3">
                          <p className="font-bold text-neutral-900">{c.customerName}</p>
                          <p className="text-[10px] font-mono text-indigo-700 font-semibold">{c.woNumber}</p>
                        </td>

                        <td className="p-3">
                          <p className="font-semibold text-neutral-800">{c.productName}</p>
                          <p className="text-[11px] font-black text-neutral-900">
                            Dispatched: {c.currentDeliveryQty?.toLocaleString()} {c.unit}
                          </p>
                        </td>

                        <td className="p-3">
                          {isRecv ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Received OK
                            </span>
                          ) : isRej ? (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit shadow-2xs">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Receipt
                            </span>
                          )}
                        </td>

                        {/* Who Processed: Ke Receive Korece / Ke Reject Korece */}
                        <td className="p-3">
                          {isRecv ? (
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-emerald-950">
                                <span className="text-[10px] text-neutral-500 font-medium">System User:</span> {c.receivedBy || 'Admin User'}
                              </p>
                              <p className="text-[11px] text-emerald-900">
                                <span className="font-semibold">Receiver:</span> {c.receiverName || '-'} ({c.receivedDate})
                              </p>
                              {c.receiverRemarks && (
                                <p className="text-[10px] text-neutral-600 italic">"{c.receiverRemarks}"</p>
                              )}
                            </div>
                          ) : isRej ? (
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-rose-950">
                                <span className="text-[10px] text-neutral-500 font-medium">Rejected By User:</span> {c.rejectedBy || 'Admin User'}
                              </p>
                              <p className="text-[11px] text-rose-900 font-bold">
                                Rejection Reason: <span className="text-rose-700">{c.rejectionReason || 'No note given'}</span>
                              </p>
                              <p className="text-[10px] text-rose-700">Date: {c.rejectedDate}</p>
                            </div>
                          ) : (
                            <span className="text-neutral-400 italic text-[11px]">Awaiting Customer Confirmation</span>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {!isRecv && (
                              <button
                                onClick={() => handleQuickTotalReceipt(c)}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 shadow-xs flex items-center gap-1"
                                title="Instant Total Receipt"
                              >
                                <Check className="w-3 h-3" /> Quick OK
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenReceiveModal(c, 'receive')}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
                                isRecv
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                              }`}
                              title="Detailed Receipt & Remarks"
                            >
                              <CheckCircle2 className="w-3 h-3 text-indigo-600" /> {isRecv ? 'Edit Receipt' : 'Receive'}
                            </button>

                            <button
                              onClick={() => handleOpenReceiveModal(c, 'reject')}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
                                isRej 
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <AlertCircle className="w-3 h-3 text-rose-600" /> {isRej ? 'Edit Rejection' : 'Reject'}
                            </button>
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
      )}

      {/* --- SUBTAB: CUSTOMER MRR RECEIPT --- */}
      {(subTab === 'despatch-mrr-receipt' || subTab === 'mrr-receipt') && (
        <CustomerMrrReceiptView
          userProfile={userProfile}
          showToast={showToast}
          customers={customers}
        />
      )}

      {/* --- MODAL: ISSUE GATE PASS --- */}
      {showGatePassModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" /> Issue Factory Security Gate Pass
              </h3>
              <button onClick={() => setShowGatePassModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGatePass} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Select Delivery Challan <span className="text-rose-500">*</span></label>
                <select
                  value={gpChallanId}
                  onChange={(e) => setGpChallanId(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border rounded-lg font-bold"
                  required
                >
                  <option value="">-- Select Active Delivery Challan --</option>
                  {challansAwaitingGatePass.length > 0 && (
                    <optgroup label="Awaiting Security Gate Pass (Pending Action)">
                      {challansAwaitingGatePass.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.challanNo} | {c.customerName} ({c.currentDeliveryQty.toLocaleString()} {c.unit}) [NEEDS GATE PASS]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All Active Delivery Challans">
                    {challans.filter(c => c.status !== 'cancelled' && c.receivedStatus !== 'rejected').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.challanNo} | {c.customerName} ({c.currentDeliveryQty.toLocaleString()} {c.unit})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Security / Gate Remarks</label>
                <input
                  type="text"
                  value={gpRemarks}
                  onChange={(e) => setGpRemarks(e.target.value)}
                  placeholder="e.g. Verified goods and cartons at Main Gate #1"
                  className="w-full p-2.5 bg-neutral-50 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowGatePassModal(false)} className="px-4 py-2 border rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md">Issue Gate Pass</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: MARK CHALLAN AS RECEIVED OR REJECTED --- */}
      {showReceiveModal && receivingChallan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  {receiptMode === 'reject' ? (
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  {receiptMode === 'reject' ? 'Record Challan Rejection' : 'Record Goods Receipt & Acknowledgment'}
                </h3>
                <p className="text-xs text-neutral-500">Challan No: <span className="font-mono font-bold text-indigo-900">{receivingChallan.challanNo}</span></p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setReceiptMode('receive')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  receiptMode === 'receive' ? 'bg-white text-emerald-800 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Check className="w-4 h-4 text-emerald-600" /> Receive Goods
              </button>
              <button
                type="button"
                onClick={() => setReceiptMode('reject')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  receiptMode === 'reject' ? 'bg-rose-600 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <AlertCircle className="w-4 h-4" /> Reject Challan
              </button>
            </div>

            <form onSubmit={handleSaveChallanReceipt} className="space-y-4 text-xs">
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-1">
                <p><span className="font-bold">Customer:</span> {receivingChallan.customerName}</p>
                <p><span className="font-bold">Work Order:</span> {receivingChallan.woNumber}</p>
                <p><span className="font-bold">Dispatched Quantity:</span> {receivingChallan.currentDeliveryQty?.toLocaleString()} {receivingChallan.unit}</p>
              </div>

              {receiptMode === 'receive' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">Receipt Date <span className="text-rose-500">*</span></label>
                      <input
                        type="date"
                        value={receiveDate}
                        onChange={(e) => setReceiveDate(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg font-bold"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-neutral-700 block">Verified Recv Qty <span className="text-rose-500">*</span></label>
                        <button
                          type="button"
                          onClick={() => setVerifiedQty(receivingChallan.currentDeliveryQty || 0)}
                          className="text-[10px] text-emerald-700 font-black underline hover:text-emerald-900"
                        >
                          Fill Full ({receivingChallan.currentDeliveryQty})
                        </button>
                      </div>
                      <input
                        type="number"
                        value={verifiedQty}
                        onChange={(e) => setVerifiedQty(Number(e.target.value))}
                        className="w-full p-2 bg-white border border-neutral-300 rounded-lg font-black text-emerald-900"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">Receiver Person Name / Seal Signature <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="e.g. Mr. Kabir / Store Representative"
                      className="w-full p-2 bg-white border border-neutral-300 rounded-lg font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">Customer Certification & Remarks</label>
                    <textarea
                      rows={2}
                      value={receiveRemarks}
                      onChange={(e) => setReceiveRemarks(e.target.value)}
                      placeholder="e.g. Received all boxes intact"
                      className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-3">
                    <div>
                      <label className="font-bold text-rose-900 block mb-1">
                        Rejection Reason / Company Remarks <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain reason why company rejected challan (e.g. Colour shade mismatch, wrong sizes delivered, damaged cartons)"
                        className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs font-bold text-rose-950 focus:ring-2 focus:ring-rose-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-rose-900 block mb-1">Rejection Date</label>
                        <input
                          type="date"
                          value={receiveDate}
                          onChange={(e) => setReceiveDate(e.target.value)}
                          className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-rose-900 block mb-1">Rejected Quantity</label>
                        <input
                          type="number"
                          value={receivingChallan.currentDeliveryQty || 0}
                          readOnly
                          className="w-full p-2 bg-rose-100 border border-rose-300 rounded-lg text-xs font-black text-rose-950"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowReceiveModal(false)} className="px-4 py-2 border rounded-lg font-bold">Cancel</button>
                <button
                  type="submit"
                  disabled={isUpdatingReceipt}
                  className={`px-5 py-2 text-white rounded-lg font-bold shadow-md flex items-center gap-1.5 ${
                    receiptMode === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isUpdatingReceipt ? 'Saving...' : receiptMode === 'reject' ? 'Confirm Rejection & Log Reason' : 'Confirm Goods Received'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: REJECT GATE PASS --- */}
      {rejectingGatePass && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-neutral-900">Reject Gate Pass</h3>
              </div>
              <button 
                onClick={() => setRejectingGatePass(null)} 
                className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-900 space-y-1">
              <p><span className="font-bold">Gate Pass No:</span> {rejectingGatePass.gatePassNo}</p>
              <p><span className="font-bold">Challan No:</span> {rejectingGatePass.challanNo}</p>
              <p><span className="font-bold">Customer:</span> {rejectingGatePass.customerName}</p>
              <p><span className="font-bold">Quantity:</span> {rejectingGatePass.deliveryQty?.toLocaleString()} {rejectingGatePass.unit}</p>
              <p className="text-[11px] text-rose-700 font-medium pt-1 border-t border-rose-200/80">
                Rejecting this Gate Pass will keep the Delivery Challan <strong>UNLOCKED</strong> so the store team can correct the quantities or details and resubmit for approval.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRejectGatePass(rejectingGatePass, gpRejectReason);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-neutral-800 block mb-1">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={gpRejectReason}
                  onChange={(e) => setGpRejectReason(e.target.value)}
                  placeholder="e.g. Discrepancy in carton count, wrong vehicle number, or quantity mismatch"
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setRejectingGatePass(null)}
                  className="px-4 py-2 border border-neutral-300 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-md cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT UNLOCKED CHALLAN --- */}
      {editingChallan && editingChallanBalance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-bold text-neutral-900">
                    Edit Delivery Challan ({editingChallan.challanNo})
                  </h3>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                    Unlocked
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Update quantities or details while unlocked. Once Gate Pass is approved, the Challan will be locked permanently.
                </p>
              </div>
              <button 
                onClick={() => setEditingChallan(null)} 
                className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quantity Ledger & Balance Information */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Total Order Qty</span>
                <span className="text-base font-black text-neutral-900">
                  {editingChallanBalance.totalOrderQty.toLocaleString()} {editingChallan.unit}
                </span>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Confirmed / Prev Challans</span>
                  <Lock className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="text-base font-black text-emerald-900">
                  {editingChallanBalance.prevConfirmedQty.toLocaleString()} {editingChallan.unit}
                </span>
                <span className="text-[9px] text-emerald-700 block mt-0.5">Fixed & Locked (Unchangeable)</span>
              </div>
              <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
                <span className="text-[10px] font-bold text-indigo-800 uppercase block">Max Available for this Challan</span>
                <span className="text-base font-black text-indigo-900">
                  {editingChallanBalance.maxAvailableForThisChallan.toLocaleString()} {editingChallan.unit}
                </span>
                <span className="text-[9px] text-indigo-700 block mt-0.5">Remaining unallocated order stock</span>
              </div>
            </div>

            <form onSubmit={handleSaveEditedChallan} className="space-y-4">
              {/* Item Breakdown (Delete, Add from Work Order, and Reallocate) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-800 uppercase text-[10px] tracking-wider">
                      Item Breakdown & Dispatched Quantities
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">
                      {editItems.filter(i => i.selected && (Number(i.challanQty) || 0) > 0).length} active breakdown(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {availableBreakdownsToAdd.length > 0 && (
                      <button
                        type="button"
                        onClick={handleImportAllWoBreakdowns}
                        className="text-[10px] px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-100 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Import all remaining un-added breakdowns from Work Order"
                      >
                        <Layers className="w-3.5 h-3.5" /> Import All WO Breakdowns ({availableBreakdownsToAdd.length})
                      </button>
                    )}
                    <span className="text-[11px] font-black text-indigo-950 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200">
                      Total Dispatched: {editDeliveryQty.toLocaleString()} / {editingChallanBalance.maxAvailableForThisChallan.toLocaleString()} {editingChallan.unit}
                    </span>
                  </div>
                </div>

                {editItems.length > 0 ? (
                  <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-2xs">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-neutral-100 font-bold text-[10px] uppercase text-neutral-700 sticky top-0 border-b border-neutral-200">
                        <tr>
                          <th className="p-2 w-8 text-center">#</th>
                          <th className="p-2 w-10 text-center">Inc</th>
                          <th className="p-2">Style / Item</th>
                          <th className="p-2">Color / Size</th>
                          <th className="p-2 text-right">Order Qty</th>
                          <th className="p-2 text-right">Prev Confirmed</th>
                          <th className="p-2 text-right">This Challan Qty</th>
                          <th className="p-2 text-right">Balance</th>
                          <th className="p-2 w-12 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 font-medium">
                        {editItems.map((item, idx) => {
                          const maxAvailForItem = Math.max(0, item.orderQty - (item.pChallanQty || 0));
                          return (
                            <tr 
                              key={item.id || idx} 
                              className={item.selected ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'bg-neutral-50/50 hover:bg-neutral-100/50 opacity-60'}
                            >
                              <td className="p-2 text-center text-neutral-500 font-mono">{idx + 1}</td>
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.selected ?? false}
                                  onChange={() => handleToggleEditItemSelected(idx)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  title={item.selected ? "Click to exclude from Challan" : "Click to include in Challan"}
                                />
                              </td>
                              <td className="p-2">
                                <p className="font-bold text-neutral-900">{item.style || item.itemDescription}</p>
                                <p className="text-[9px] text-neutral-500 font-mono">{item.jobNo || item.poNo || ''}</p>
                              </td>
                              <td className="p-2">
                                <span className="font-medium text-neutral-800">{item.color || 'Std'}</span>
                                <span className="text-neutral-400 mx-1">/</span>
                                <span className="font-bold text-neutral-700">{item.size || 'Std'}</span>
                              </td>
                              <td className="p-2 text-right font-mono">{item.orderQty?.toLocaleString()}</td>
                              <td className="p-2 text-right">
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                                  <Lock className="w-2.5 h-2.5 text-emerald-600" />
                                  {item.pChallanQty?.toLocaleString() || 0}
                                </span>
                              </td>
                              <td className="p-2 text-right">
                                <div className="inline-flex flex-col items-end">
                                  <input
                                    type="number"
                                    min={0}
                                    max={maxAvailForItem}
                                    value={item.challanQty ?? 0}
                                    onChange={(e) => handleEditItemQty(idx, Number(e.target.value))}
                                    disabled={!item.selected}
                                    className="w-24 p-1 text-right font-black text-indigo-950 bg-white border border-neutral-300 rounded focus:ring-2 focus:ring-indigo-500 disabled:bg-neutral-100 disabled:text-neutral-400 text-xs"
                                  />
                                  <span className="text-[9px] text-neutral-400 mt-0.5">max: {maxAvailForItem.toLocaleString()}</span>
                                </div>
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-neutral-600">
                                {item.balanceQty?.toLocaleString() || 0}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditItem(idx)}
                                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete breakdown from this Challan"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-300 text-center space-y-2">
                    <p className="text-neutral-600 font-medium">No breakdowns are currently included in this Challan.</p>
                    <p className="text-xs text-neutral-500">You can add breakdowns from the Work Order below or import all available breakdowns.</p>
                    {availableBreakdownsToAdd.length > 0 && (
                      <button
                        type="button"
                        onClick={handleImportAllWoBreakdowns}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Layers className="w-4 h-4" /> Import All {availableBreakdownsToAdd.length} Work Order Breakdowns
                      </button>
                    )}
                  </div>
                )}

                {/* ADD BREAKDOWN FROM WORK ORDER BOX */}
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-indigo-700 font-bold" />
                      <span className="font-bold text-neutral-900 text-[11px] uppercase tracking-wide">
                        Add Breakdown from Work Order
                      </span>
                      {availableBreakdownsToAdd.length > 0 ? (
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-bold rounded-full">
                          {availableBreakdownsToAdd.length} un-challaned available
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">
                          All WO breakdowns added
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-500">
                      Work Order: <strong className="font-mono text-neutral-800">{editingChallan.woNumber}</strong>
                    </span>
                  </div>

                  {availableBreakdownsToAdd.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <div className="flex-1">
                        <select
                          value={selectedBreakdownToAdd}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedBreakdownToAdd(val);
                            const item = availableBreakdownsToAdd.find(b => b.breakdownId === val || b.id === val);
                            if (item) {
                              setQtyToAdd(String(item.availableQty));
                            } else {
                              setQtyToAdd('');
                            }
                          }}
                          className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Select Work Order Breakdown to Add --</option>
                          {availableBreakdownsToAdd.map(b => (
                            <option key={b.id} value={b.breakdownId || b.id}>
                              Style: {b.style} | Color: {b.color} | Size: {b.size} (Avail: {b.availableQty.toLocaleString()} {b.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-36">
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty to Add"
                          value={qtyToAdd}
                          onChange={(e) => setQtyToAdd(e.target.value)}
                          className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs font-black text-indigo-950 text-right focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={!selectedBreakdownToAdd}
                        onClick={() => handleAddBreakdownToEdit()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add to Challan
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-600 italic py-1">
                      All breakdowns from Work Order <span className="font-mono font-bold text-indigo-950">{editingChallan.woNumber}</span> are currently in this Challan. You can modify quantities or remove items using the controls above.
                    </p>
                  )}
                </div>

                {/* QUANTITY REALLOCATION & BALANCE INDICATOR */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-neutral-100/80 rounded-xl border border-neutral-200 text-[11px]">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-neutral-700">
                      <strong>Reallocation:</strong> You can delete any breakdown or reduce its quantity, and transfer/allocate that balance into any other breakdown.
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-500 block">Remaining WO Allowance</span>
                      <span className={`font-black text-xs ${editDeliveryQty > editingChallanBalance.maxAvailableForThisChallan ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {Math.max(0, editingChallanBalance.maxAvailableForThisChallan - editDeliveryQty).toLocaleString()} {editingChallan.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Over-allocation warning alert */}
                {editDeliveryQty > editingChallanBalance.maxAvailableForThisChallan && (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      Total quantity ({editDeliveryQty.toLocaleString()}) exceeds the allowable Work Order balance ({editingChallanBalance.maxAvailableForThisChallan.toLocaleString()}). Please reduce breakdown quantities before saving.
                    </span>
                  </div>
                )}
              </div>

              {/* Transport & Vehicle Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Delivery Type</label>
                  <select
                    value={editDeliveryType}
                    onChange={(e) => setEditDeliveryType(e.target.value)}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg font-bold"
                  >
                    <option value="Company Truck">Company Truck</option>
                    <option value="Covered Van">Covered Van</option>
                    <option value="Pickup / Carrier">Pickup / Carrier</option>
                    <option value="Hand Delivery">Hand Delivery</option>
                    <option value="Customer Vehicle">Customer Vehicle</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Vehicle No</label>
                  <input
                    type="text"
                    value={editVehicleNo}
                    onChange={(e) => setEditVehicleNo(e.target.value)}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Total Cartons / Box</label>
                  <input
                    type="text"
                    value={editTotalBox}
                    onChange={(e) => setEditTotalBox(e.target.value)}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={editDriverName}
                    onChange={(e) => setEditDriverName(e.target.value)}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Driver Mobile</label>
                  <input
                    type="text"
                    value={editDriverMobile}
                    onChange={(e) => setEditDriverMobile(e.target.value)}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={editDeliveryAddress}
                    onChange={(e) => setEditDeliveryAddress(e.target.value)}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Remarks</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingChallan(null)}
                  className="px-4 py-2 border border-neutral-300 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || editDeliveryQty <= 0 || editDeliveryQty > editingChallanBalance.maxAvailableForThisChallan}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  {isSavingEdit ? 'Saving Changes...' : 'Save & Print Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE MODAL 1: OFFICIAL ES TRIMS LIMITED DELIVERY CHALLAN (PDF MATCH) */}
      {/* ========================================================================= */}
      {printableChallan && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-2xl space-y-4 text-black text-xs print:p-0 print:shadow-none print:w-full print:max-w-none">
            {/* Action Bar (Hidden on Print) */}
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h2 className="font-black text-sm text-neutral-900 uppercase">ES Trims Limited Delivery Challan Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => printElement('printable-delivery-challan', { title: 'Delivery Challan' })} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs shadow-md cursor-pointer">
                  <Printer className="w-4 h-4" /> Print Document
                </button>
                <button onClick={() => setPrintableChallan(null)} className="p-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ES TRIMS FORMAL DELIVERY CHALLAN PAPER SHEET */}
            <div id="printable-delivery-challan" className="printable-doc border border-neutral-800 p-6 space-y-4 print:border-none print:p-0">
              {/* Header Banner */}
              <div className="flex justify-between items-start border-b-2 border-black pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                    alt="ES Trims Limited"
                    className="h-14 w-14 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                  />
                  <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-black">ES Trims Limited</h1>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">Delivery Challan</h2>
                    <p className="text-[10px] text-neutral-700 font-medium">
                      C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400, Bangladesh
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  {/* Clean SVG Barcode Component */}
                  <BarcodeSvg value={printableChallan.challanNo} height={38} className="ml-auto" />
                </div>
              </div>

              {/* 2x2 Header Info Grid Box */}
              <div className="grid grid-cols-2 border border-black text-[11px] divide-x divide-y divide-black">
                {/* Box 1: Invoice Address / Bill to Party */}
                <div className="p-2.5 space-y-1">
                  <p className="font-black uppercase text-[10px] border-b border-neutral-300 pb-0.5 text-neutral-700">
                    Invoice Address / Bill to Party
                  </p>
                  <p className="font-bold text-sm text-black">{printableChallan.customerName}</p>
                  <p className="text-neutral-800 leading-tight">{printableChallan.invoiceAddress || printableChallan.deliveryAddress}</p>
                  <p className="text-[10px]"><span className="font-bold">Contact:</span> {printableChallan.invoiceContactPerson || 'N/A'}</p>
                </div>

                {/* Box 2: Order Reference Grid */}
                <div className="p-2.5 grid grid-cols-2 gap-x-2 gap-y-1">
                  <div><span className="font-bold">P.O:</span> {printableChallan.poNo}</div>
                  <div><span className="font-bold">Buyer:</span> {printableChallan.buyerName}</div>
                  <div><span className="font-bold">Work Order No:</span> <span className="font-mono">{printableChallan.woNumber}</span></div>
                  <div><span className="font-bold">PI NO:</span> <span className="font-mono">{printableChallan.piNo || '-'}</span></div>
                  <div><span className="font-bold">FSC-COC:</span> {printableChallan.fscCoc || 'N/A'}</div>
                  <div><span className="font-bold">Challan No:</span> <span className="font-mono font-bold">{printableChallan.challanNo}</span></div>
                  <div><span className="font-bold">Date:</span> {printableChallan.challanDate}</div>
                  <div><span className="font-bold">WO Bag No:</span> <span className="font-mono">{printableChallan.woBagNo || printableChallan.woNumber}</span></div>
                </div>

                {/* Box 3: Delivery Address / Ship to Party */}
                <div className="p-2.5 space-y-1">
                  <p className="font-black uppercase text-[10px] border-b border-neutral-300 pb-0.5 text-neutral-700">
                    Delivery Address / Ship to Party / Notify Party
                  </p>
                  <p className="text-neutral-900 font-bold leading-tight">{printableChallan.deliveryAddress}</p>
                  <p className="text-[10px]"><span className="font-bold">Contact Person:</span> {printableChallan.deliveryContactPerson || 'N/A'}</p>
                </div>

                {/* Box 4: Transport Details */}
                <div className="p-2.5 space-y-1">
                  <div><span className="font-bold">Delivery By:</span> {printableChallan.deliveryType}</div>
                  <div><span className="font-bold">Delivery Man Name:</span> {printableChallan.driverName || 'N/A'} {printableChallan.driverMobile ? `(${printableChallan.driverMobile})` : ''}</div>
                  <div><span className="font-bold">Vehicle No:</span> <span className="font-mono">{printableChallan.vehicleNo || 'N/A'}</span></div>
                  <div><span className="font-bold">Total Box:</span> <span className="font-bold">{printableChallan.totalBox || '1 Box'}</span></div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] border border-black border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-black font-black uppercase text-[9px] text-black">
                      <th className="p-1.5 border-r border-black text-center">SN</th>
                      <th className="p-1.5 border-r border-black">Sub Category</th>
                      <th className="p-1.5 border-r border-black">Booking No</th>
                      <th className="p-1.5 border-r border-black">Style</th>
                      <th className="p-1.5 border-r border-black">Job No</th>
                      <th className="p-1.5 border-r border-black">PO No</th>
                      <th className="p-1.5 border-r border-black">Item Description</th>
                      <th className="p-1.5 border-r border-black text-right">Order QTY</th>
                      <th className="p-1.5 border-r border-black text-right">P. Challan QTY</th>
                      <th className="p-1.5 border-r border-black text-right">Challan QTY</th>
                      <th className="p-1.5 border-r border-black">UOM</th>
                      <th className="p-1.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-medium">
                    {(() => {
                      const activeItems = printableChallan.items?.filter(it => (Number(it.challanQty) || 0) > 0) || [];
                      if (activeItems.length > 0) {
                        return activeItems.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-1.5 border-r border-black text-center font-bold">{idx + 1}</td>
                            <td className="p-1.5 border-r border-black">{it.subCategory || 'Trims'}</td>
                            <td className="p-1.5 border-r border-black font-mono">{it.bookingNo || printableChallan.woNumber}</td>
                            <td className="p-1.5 border-r border-black font-bold">{it.style || printableChallan.style || '-'}</td>
                            <td className="p-1.5 border-r border-black font-mono">{it.jobNo || '-'}</td>
                            <td className="p-1.5 border-r border-black font-mono">{it.poNo || printableChallan.poNo}</td>
                            <td className="p-1.5 border-r border-black font-bold">
                              {it.itemDescription || printableChallan.productName}
                              {(it.color || it.size) && (
                                <span className="block text-[9px] font-normal text-neutral-800">
                                  {[it.color, it.size].filter(Boolean).join(' / ')}
                                </span>
                              )}
                            </td>
                            <td className="p-1.5 border-r border-black text-right font-bold">{it.orderQty?.toLocaleString()}</td>
                            <td className="p-1.5 border-r border-black text-right">{it.pChallanQty || 0}</td>
                            <td className="p-1.5 border-r border-black text-right font-black">{it.challanQty?.toLocaleString()}</td>
                            <td className="p-1.5 border-r border-black">{it.unit || printableChallan.unit}</td>
                            <td className="p-1.5">{it.remarks || 'Good'}</td>
                          </tr>
                        ));
                      }
                      return (
                        <tr>
                          <td className="p-1.5 border-r border-black text-center font-bold">1</td>
                          <td className="p-1.5 border-r border-black">Trims Item</td>
                          <td className="p-1.5 border-r border-black font-mono">{printableChallan.woNumber}</td>
                          <td className="p-1.5 border-r border-black font-bold">{printableChallan.style || '-'}</td>
                          <td className="p-1.5 border-r border-black font-mono">JOB-01</td>
                          <td className="p-1.5 border-r border-black font-mono">{printableChallan.poNo}</td>
                          <td className="p-1.5 border-r border-black font-bold">{printableChallan.productName}</td>
                          <td className="p-1.5 border-r border-black text-right font-bold">{printableChallan.orderQty?.toLocaleString()}</td>
                          <td className="p-1.5 border-r border-black text-right">{printableChallan.previouslyDeliveredQty?.toLocaleString()}</td>
                          <td className="p-1.5 border-r border-black text-right font-black">{printableChallan.currentDeliveryQty?.toLocaleString()}</td>
                          <td className="p-1.5 border-r border-black">{printableChallan.unit}</td>
                          <td className="p-1.5">Good Condition</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                  {/* Total Summary Row */}
                  <tfoot>
                    <tr className="bg-neutral-100 border-t-2 border-black font-black uppercase text-[10px]">
                      <td colSpan={7} className="p-1.5 border-r border-black text-right">Total Summary:</td>
                      <td className="p-1.5 border-r border-black text-right">{printableChallan.orderQty?.toLocaleString()}</td>
                      <td className="p-1.5 border-r border-black text-right">{printableChallan.previouslyDeliveredQty?.toLocaleString()}</td>
                      <td className="p-1.5 border-r border-black text-right">{printableChallan.currentDeliveryQty?.toLocaleString()} {printableChallan.unit}</td>
                      <td colSpan={2} className="p-1.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures & Customer Acknowledgment Certification Footer */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-[11px] items-end">
                {/* Left: Prepared By */}
                <div className="space-y-1">
                  <div className="border-t border-black w-48 pt-1 font-bold">
                    Prepared By: {printableChallan.preparedBy}
                  </div>
                  <p className="text-[10px] text-neutral-600 font-mono">
                    Time Stamp: {format(new Date(), 'dd/MM/yyyy hh:mm:ss a')}
                  </p>
                </div>

                {/* Right: Customer Certification & Receiver Seal */}
                <div className="space-y-2 text-right">
                  <p className="text-[10px] italic font-semibold leading-tight text-neutral-800">
                    "Above goods are acknowledged and received in good condition of package and quantity as per challan"
                  </p>
                  <div className="border-t border-black w-56 ml-auto pt-1 font-bold">
                    Receiver Name & Signature Date & Seal
                  </div>
                  {printableChallan.receivedStatus === 'received' && (
                    <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 p-1 border border-emerald-200 inline-block rounded">
                      ✓ Received & Verified on {printableChallan.receivedDate} by {printableChallan.receiverName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE MODAL 2: FACTORY SECURITY GATE PASS                             */}
      {/* ========================================================================= */}
      {printableGatePass && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-black text-xs print:p-0 print:shadow-none print:w-full print:max-w-none">
            {/* Action Bar */}
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h2 className="font-black text-sm text-neutral-900 uppercase">Factory Security Gate Pass</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => printElement('printable-gate-pass', { title: 'Security Gate Pass' })} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs shadow-md cursor-pointer">
                  <Printer className="w-4 h-4" /> Print Gate Pass
                </button>
                <button onClick={() => setPrintableGatePass(null)} className="p-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* GATE PASS FORMAL PAPER */}
            <div id="printable-gate-pass" className="printable-doc border-2 border-black p-6 space-y-4 print:border-none print:p-0">
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                    alt="ES Trims Limited"
                    className="h-14 w-14 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                  />
                  <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-black">ES Trims Limited</h1>
                    <p className="text-[10px] font-bold text-neutral-700">C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400</p>
                  </div>
                </div>
                <div className="inline-block bg-black text-white px-4 py-1.5 font-black text-sm tracking-wider uppercase rounded-sm">
                  Security Gate Pass
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-black p-3 text-xs">
                <div><span className="font-bold">Gate Pass No:</span> <span className="font-mono font-bold text-indigo-900">{printableGatePass.gatePassNo}</span></div>
                <div><span className="font-bold">Date:</span> {printableGatePass.gatePassDate}</div>
                <div><span className="font-bold">Delivery Challan No:</span> <span className="font-mono font-bold">{printableGatePass.challanNo}</span></div>
                <div><span className="font-bold">Work Order No:</span> <span className="font-mono">{printableGatePass.woNumber}</span></div>
                <div><span className="font-bold">Party / Customer:</span> <span className="font-bold">{printableGatePass.customerName}</span></div>
                <div><span className="font-bold">Buyer Name:</span> {printableGatePass.buyerName || 'N/A'}</div>
                <div><span className="font-bold">Vehicle No:</span> <span className="font-mono font-bold">{printableGatePass.vehicleNo || 'N/A'}</span></div>
                <div><span className="font-bold">Driver Name & Mobile:</span> {printableGatePass.driverName} ({printableGatePass.driverMobile})</div>
              </div>

              <div className="border border-black p-3 space-y-2 bg-neutral-50">
                <p className="font-black uppercase text-[10px]">Security Item Clearance Summary:</p>
                <div className="flex items-center justify-between font-bold text-sm">
                  <span>{printableGatePass.productName}</span>
                  <span className="font-black text-indigo-950">{printableGatePass.deliveryQty?.toLocaleString()} {printableGatePass.unit || 'Pcs'}</span>
                </div>
                {printableGatePass.remarks && (
                  <p className="text-[10px] text-neutral-700"><span className="font-bold">Security Remarks:</span> {printableGatePass.remarks}</p>
                )}
              </div>

              {/* 4-Column Signature Block */}
              <div className="pt-12 grid grid-cols-4 gap-2 text-[10px] font-bold text-center">
                <div className="border-t border-black pt-1">Prepared By (Store)</div>
                <div className="border-t border-black pt-1">Security Officer</div>
                <div className="border-t border-black pt-1">Carrier Driver</div>
                <div className="border-t border-black pt-1">Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
