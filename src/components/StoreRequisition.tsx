import React, { useState, useEffect, useMemo } from 'react';
import { printElement } from '../utils/printHelper';
import { 
  collection, 
  addDoc, 
  Timestamp, 
  doc, 
  updateDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { format } from 'date-fns';
import { 
  Printer, 
  Plus, 
  Trash2, 
  X, 
  FileText, 
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  ArrowLeft,
  Calculator,
  Layers,
  Sparkles,
  HelpCircle,
  Info
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Item, 
  Transaction, 
  UserProfile, 
  StoreRequisitionData, 
  StoreRequisitionItem,
  BomMaster,
  WorkOrder,
  FinishedGoods 
} from '../types';

export interface MultiItemRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  initialItemId?: string;
  initialMode?: 'DIRECT_ISSUE' | 'STORE_REQUISITION';
  transactions?: Transaction[];
  boms?: BomMaster[];
  workOrders?: WorkOrder[];
  finishedGoods?: FinishedGoods[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onRequisitionCreated: (reqData: StoreRequisitionData) => void;
  recalculateItemStock: (itemId: string, businessId: string) => Promise<void>;
}

export interface RequisitionRowState {
  itemId: string;
  specification: string;
  useSheetCalc: boolean;
  productionQty: number | string;
  ups: number | string;
  extraSheets: number | string;
  wastagePercent: number | string;
  quantity: number | string;
  remarks: string;
  bomNo?: string;
  bomId?: string;
}

export function MultiItemRequisitionModal({
  isOpen,
  onClose,
  items,
  initialItemId,
  initialMode,
  transactions = [],
  boms: initialBoms,
  workOrders: initialWorkOrders,
  finishedGoods: initialFinishedGoods,
  userProfile,
  showToast,
  onRequisitionCreated,
  recalculateItemStock
}: MultiItemRequisitionModalProps) {
  const isViewer = userProfile.role === 'viewer';
  const bId = userProfile.businessId;

  // Realtime state fallback for BOMs, Work Orders, and Finished Goods
  const [bomsList, setBomsList] = useState<BomMaster[]>(initialBoms || []);
  const [workOrdersList, setWorkOrdersList] = useState<WorkOrder[]>(initialWorkOrders || []);
  const [finishedGoodsList, setFinishedGoodsList] = useState<FinishedGoods[]>(initialFinishedGoods || []);

  useEffect(() => {
    if (initialBoms && initialBoms.length > 0) setBomsList(initialBoms);
    if (initialWorkOrders && initialWorkOrders.length > 0) setWorkOrdersList(initialWorkOrders);
    if (initialFinishedGoods && initialFinishedGoods.length > 0) setFinishedGoodsList(initialFinishedGoods);
  }, [initialBoms, initialWorkOrders, initialFinishedGoods]);

  useEffect(() => {
    if (!isOpen || !bId) return;

    if (!initialBoms || initialBoms.length === 0) {
      const qBom = query(collection(db, 'boms'), where('businessId', '==', bId));
      const unsubBom = onSnapshot(qBom, snap => {
        setBomsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as BomMaster)));
      }, err => console.warn('BOM listener in StoreRequisition error:', err));
      return () => unsubBom();
    }
  }, [isOpen, bId, initialBoms]);

  useEffect(() => {
    if (!isOpen || !bId) return;

    if (!initialWorkOrders || initialWorkOrders.length === 0) {
      const qWo = query(collection(db, 'work_orders'), where('businessId', '==', bId));
      const unsubWo = onSnapshot(qWo, snap => {
        setWorkOrdersList(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder)));
      }, err => console.warn('WO listener in StoreRequisition error:', err));
      return () => unsubWo();
    }
  }, [isOpen, bId, initialWorkOrders]);

  useEffect(() => {
    if (!isOpen || !bId) return;

    if (!initialFinishedGoods || initialFinishedGoods.length === 0) {
      const qFg = query(collection(db, 'finished_goods'), where('businessId', '==', bId));
      const unsubFg = onSnapshot(qFg, snap => {
        setFinishedGoodsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinishedGoods)));
      }, err => console.warn('FG listener in StoreRequisition error:', err));
      return () => unsubFg();
    }
  }, [isOpen, bId, initialFinishedGoods]);

  // Calculate next sequential SR No (e.g. SR-0001, SR-0002...)
  const calculateNextSrNo = () => {
    let maxNum = 0;

    transactions.forEach(tx => {
      const refs = [tx.srNo, tx.reference].filter(Boolean);
      refs.forEach(ref => {
        if (typeof ref === 'string' && /^SR/i.test(ref)) {
          const matches = ref.match(/\d+/g);
          if (matches && matches.length > 0) {
            const lastDigitStr = matches[matches.length - 1];
            const num = parseInt(lastDigitStr, 10);
            if (!isNaN(num) && num < 100000 && num > maxNum) {
              maxNum = num;
            }
          }
        }
      });
    });

    try {
      const savedLastSr = localStorage.getItem('es_trims_last_sr_no');
      if (savedLastSr) {
        const matches = savedLastSr.match(/\d+/g);
        if (matches && matches.length > 0) {
          const lastDigitStr = matches[matches.length - 1];
          const num = parseInt(lastDigitStr, 10);
          if (!isNaN(num) && num < 100000 && num > maxNum) {
            maxNum = num;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading es_trims_last_sr_no from localStorage', e);
    }

    const nextNum = maxNum + 1;
    return `SR-${String(nextNum).padStart(4, '0')}`;
  };

  const [reqType, setReqType] = useState<'PRODUCTION' | 'EXTRA_REQUISITION'>('PRODUCTION');
  const [srNo, setSrNo] = useState('SR-0001');
  const [srDate, setSrDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [requiredDate, setRequiredDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [department, setDepartment] = useState('Cutting');
  const [location, setLocation] = useState('Main Store');
  const [requestorName, setRequestorName] = useState(userProfile.displayName || userProfile.name || '');
  const [designation, setDesignation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [jobNo, setJobNo] = useState('');
  const [style, setStyle] = useState('');
  const [generalRemarks, setGeneralRemarks] = useState('');

  // Selected Work Order or BOM for quick population
  const [selectedWoId, setSelectedWoId] = useState<string>('');
  const [selectedBomId, setSelectedBomId] = useState<string>('');

  const [itemRows, setItemRows] = useState<RequisitionRowState[]>([
    { 
      itemId: '', 
      specification: '', 
      useSheetCalc: false,
      productionQty: '',
      ups: '',
      extraSheets: '',
      wastagePercent: '',
      quantity: 1, 
      remarks: '' 
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSrNo(calculateNextSrNo());
      setSrDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      if (initialItemId) {
        setItemRows([
          { 
            itemId: initialItemId, 
            specification: '', 
            useSheetCalc: false,
            productionQty: '',
            ups: '',
            extraSheets: '',
            wastagePercent: '',
            quantity: 1, 
            remarks: '' 
          }
        ]);
      }
    }
  }, [isOpen, transactions, initialItemId]);

  // Helper to compute material requirement: Production Qty / UPS (Yield) -> Round Up (Ceil) + Extra Units
  const computeSheetResult = (prodQty: number | string, upsVal: number | string, extraVal: number | string) => {
    const qty = Number(prodQty) || 0;
    const ups = Math.max(1, Number(upsVal) || 1);
    const baseUnits = qty > 0 ? qty / ups : 0;
    const roundedUnits = Math.ceil(baseUnits);
    const extraUnits = Number(extraVal) || 0;
    const totalUnits = roundedUnits + extraUnits;

    return {
      qty,
      ups,
      baseSheets: Number(baseUnits.toFixed(4)),
      baseUnits: Number(baseUnits.toFixed(4)),
      roundedSheets: roundedUnits,
      roundedUnits,
      extraSheets: extraUnits,
      extraUnits,
      totalSheets: Math.max(0, totalUnits),
      totalUnits: Math.max(0, totalUnits)
    };
  };

  // Find BOM for a given item or finished good
  const findBomByItemOrProduct = (itemId: string): BomMaster | undefined => {
    if (!bomsList || bomsList.length === 0) return undefined;
    return bomsList.find(b => 
      b.sheetItemId === itemId || 
      b.items?.some(i => i.rawMaterialId === itemId) ||
      b.productId === itemId
    );
  };

  const handleAddRow = () => {
    setItemRows([
      ...itemRows, 
      { 
        itemId: '', 
        specification: '', 
        useSheetCalc: false,
        productionQty: '',
        ups: '',
        extraSheets: '',
        wastagePercent: '',
        quantity: 1, 
        remarks: '' 
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (itemRows.length === 1) {
      showToast('At least one item row is required.', 'error');
      return;
    }
    setItemRows(itemRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof RequisitionRowState, value: any) => {
    const updated = [...itemRows];
    const currentRow = { ...updated[index], [field]: value };
    const selectedItem = items.find(i => i.id === (field === 'itemId' ? value : currentRow.itemId));
    const currentUnit = selectedItem?.unit || 'Unit';

    // When item is selected, check if it is linked to a BOM sheet or has BOM defaults
    if (field === 'itemId') {
      const matchingBom = findBomByItemOrProduct(value);
      
      if (matchingBom) {
        currentRow.bomNo = matchingBom.bomNo;
        currentRow.bomId = matchingBom.id;
        currentRow.useSheetCalc = true;
        if (!currentRow.ups || Number(currentRow.ups) <= 1) {
          currentRow.ups = matchingBom.ups || matchingBom.piecesPerSheet || 1;
        }
        if (!currentRow.wastagePercent && matchingBom.wastagePercent) {
          currentRow.wastagePercent = matchingBom.wastagePercent;
        }
        // If production qty is set, recompute
        if (Number(currentRow.productionQty) > 0) {
          const calc = computeSheetResult(currentRow.productionQty, currentRow.ups, currentRow.extraSheets);
          currentRow.quantity = calc.totalUnits;
        }
      } else if (selectedItem && (
        selectedItem.unit?.toLowerCase().includes('sheet') || 
        selectedItem.unit?.toLowerCase().includes('roll') || 
        selectedItem.name?.toLowerCase().includes('sheet') || 
        selectedItem.name?.toLowerCase().includes('roll') || 
        selectedItem.name?.toLowerCase().includes('board') || 
        selectedItem.name?.toLowerCase().includes('card')
      )) {
        currentRow.useSheetCalc = true;
        if (!currentRow.ups) currentRow.ups = 1;
      }
    }

    // If changing calculation fields
    if (field === 'productionQty' || field === 'ups' || field === 'extraSheets') {
      const prodQty = field === 'productionQty' ? value : currentRow.productionQty;
      const upsVal = field === 'ups' ? value : currentRow.ups;
      const extraVal = field === 'extraSheets' ? value : currentRow.extraSheets;

      if (currentRow.useSheetCalc && Number(prodQty) > 0) {
        const calc = computeSheetResult(prodQty, upsVal, extraVal);
        currentRow.quantity = calc.totalUnits;
        
        // Auto-note breakdown if empty or default
        const notePrefix = `[BOM Calc: ${calc.qty.toLocaleString()} Pcs ÷ ${calc.ups} UPS = ${calc.baseUnits} ${currentUnit} (Round: ${calc.roundedUnits})${calc.extraUnits > 0 ? ` + ${calc.extraUnits} Extra` : ''} = ${calc.totalUnits} ${currentUnit}]`;
        if (!currentRow.remarks || currentRow.remarks.startsWith('[BOM Calc:')) {
          currentRow.remarks = notePrefix;
        }
      }
    }

    // Toggle sheet calculator mode
    if (field === 'useSheetCalc') {
      if (value && Number(currentRow.productionQty) > 0) {
        const calc = computeSheetResult(currentRow.productionQty, currentRow.ups, currentRow.extraSheets);
        currentRow.quantity = calc.totalUnits;
      }
    }

    updated[index] = currentRow;
    setItemRows(updated);
  };

  // Quick fill from selected Work Order
  const handleSelectWorkOrder = (woId: string) => {
    setSelectedWoId(woId);
    setSelectedBomId('');

    if (!woId) return;

    const wo = workOrdersList.find(w => w.id === woId);
    if (!wo) return;

    setJobNo(wo.woNumber || '');
    setStyle(wo.finishedGoodsName || wo.styleNo || '');
    setPurpose(`Production issue for Work Order ${wo.woNumber} (${(wo.totalQuantity || 0).toLocaleString()} Pcs)`);
    if (wo.deliveryDate) setRequiredDate(wo.deliveryDate);

    // Look for matching BOM first to know UPS and wastage
    const matchingBom = bomsList.find(b => 
      (wo.finishedGoodsId && b.productId === wo.finishedGoodsId) ||
      (b.productName && wo.finishedGoodsName && b.productName.toLowerCase().trim() === wo.finishedGoodsName.toLowerCase().trim()) ||
      (b.productCode && wo.finishedGoodsNo && b.productCode.toLowerCase().trim() === wo.finishedGoodsNo.toLowerCase().trim()) ||
      (b.productCode && wo.styleNo && b.productCode.toLowerCase().trim() === wo.styleNo.toLowerCase().trim()) ||
      (b.bomNo && (wo.bomNo || '').toLowerCase().trim() === b.bomNo.toLowerCase().trim())
    );

    const defaultUps = Math.max(1, matchingBom?.ups || matchingBom?.piecesPerSheet || wo.ups || 1);
    const defaultWastage = matchingBom?.wastagePercent || 0;
    const orderQty = wo.totalQuantity || 0;

    // Calculate exact required sheets/rolls from Sales Order Entry (confirmed or breakdown rows)
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
        const rowBom = bomsList.find(b => 
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

    if (matchingBom) {
      setSelectedBomId(matchingBom.id);
      const rows: RequisitionRowState[] = [];

      // Primary Material Item (Roll / Sheet / etc.) if defined in BOM or inventory
      let sheetItem = matchingBom.sheetItemId ? items.find(i => i.id === matchingBom.sheetItemId) : undefined;
      if (!sheetItem && matchingBom.sheetItemName) {
        sheetItem = items.find(i => i.name && i.name.toLowerCase().trim() === matchingBom.sheetItemName?.toLowerCase().trim());
      }
      if (!sheetItem) {
        sheetItem = items.find(i => (i.name || '').toLowerCase().includes('roll') || (i.name || '').toLowerCase().includes('sheet') || (i.name || '').toLowerCase().includes('paper') || (i.name || '').toLowerCase().includes('board'));
      }

      const itemUnit = sheetItem?.unit || matchingBom.sheetUnit || (matchingBom.sheetItemName?.toLowerCase().includes('roll') ? 'Roll' : 'Sheet');
      const ups = Math.max(1, matchingBom.ups || matchingBom.piecesPerSheet || 1);
      const wastage = matchingBom.wastagePercent || 0;
      
      let baseUnits = 0;
      let roundedUnits = 0;
      let extraUnits = 0;
      let totalUnits = 0;

      if (soRequiredSheets > 0) {
        baseUnits = soRequiredSheets;
        roundedUnits = soRequiredSheets;
        extraUnits = 0;
        totalUnits = soRequiredSheets;
      } else {
        baseUnits = orderQty > 0 ? orderQty / ups : 0;
        roundedUnits = Math.ceil(baseUnits);
        extraUnits = 0;
        totalUnits = roundedUnits;
      }

      rows.push({
        itemId: sheetItem?.id || matchingBom.sheetItemId || '',
        specification: sheetItem?.description || `${sheetItem?.name || matchingBom.sheetItemName || 'Paper / Board / Roll Material'}`,
        useSheetCalc: true,
        productionQty: orderQty,
        ups: ups,
        extraSheets: extraUnits,
        wastagePercent: wastage,
        quantity: totalUnits,
        remarks: soRequiredSheets > 0 
          ? `[Sales Order Requirement: ${soRequiredSheets} ${itemUnit} (${orderQty.toLocaleString()} Pcs ÷ ${ups} Pcs/${itemUnit})]`
          : `[BOM Calc: ${orderQty.toLocaleString()} Pcs ÷ ${ups} Pcs/${itemUnit} = ${baseUnits.toFixed(4)} ${itemUnit} (Round: ${roundedUnits})${extraUnits > 0 ? ` + ${extraUnits} Extra (${wastage}% Wastage)` : ''} = ${totalUnits} ${itemUnit}]`,
        bomNo: matchingBom.bomNo,
        bomId: matchingBom.id
      });

      // 2. Add other items from BOM
      if (matchingBom.items && matchingBom.items.length > 0) {
        matchingBom.items.forEach(bItem => {
          if (bItem.rawMaterialId === (sheetItem?.id || matchingBom.sheetItemId)) return; // avoid duplicate
          const rawItem = items.find(i => i.id === bItem.rawMaterialId);
          const perUnitQty = bItem.totalRequiredQty || (bItem.consumptionQty ? bItem.consumptionQty * (1 + (bItem.wastagePercent || 0)/100) : 0);
          const reqQty = Number((perUnitQty * orderQty).toFixed(3));

          rows.push({
            itemId: bItem.rawMaterialId,
            specification: bItem.specification || rawItem?.description || '',
            useSheetCalc: false,
            productionQty: orderQty,
            ups: 1,
            extraSheets: 0,
            wastagePercent: bItem.wastagePercent || 0,
            quantity: Math.max(0.001, reqQty),
            remarks: `BOM: ${matchingBom.bomNo} (${bItem.rawMaterialName})`,
            bomNo: matchingBom.bomNo,
            bomId: matchingBom.id
          });
        });
      }

      if (rows.length > 0) {
        setItemRows(rows);
        showToast(`Loaded ${rows.length} raw material requirement(s) from BOM ${matchingBom.bomNo}!`, 'success');
        return;
      }
    }

    // If no specific BOM matched, create a calculation row with WO Qty
    const defaultFirstItem = items[0];
    const defaultUnit = defaultFirstItem?.unit || 'Unit';
    showToast(`Work Order ${wo.woNumber} selected. Enter UPS & choose material item below to auto-calculate.`, 'info');
    setItemRows([{
      itemId: defaultFirstItem?.id || '',
      specification: `Style: ${wo.finishedGoodsName || 'Trim Item'}`,
      useSheetCalc: true,
      productionQty: orderQty,
      ups: 24,
      extraSheets: 0,
      wastagePercent: 0,
      quantity: Math.ceil(orderQty / 24),
      remarks: `Order: ${wo.woNumber} (${orderQty.toLocaleString()} Pcs)`
    }]);
  };

  // Quick fill from standalone BOM Master
  const handleSelectBom = (bomId: string) => {
    setSelectedBomId(bomId);
    if (!bomId) return;

    const bom = bomsList.find(b => b.id === bomId);
    if (!bom) return;

    setStyle(bom.productName || bom.productCode || '');
    setPurpose(`Material requisition according to BOM ${bom.bomNo} (${bom.productName})`);

    const defaultProdQty = 1000;
    const rows: RequisitionRowState[] = [];

    if (bom.sheetItemId) {
      const sheetItem = items.find(i => i.id === bom.sheetItemId);
      const itemUnit = sheetItem?.unit || bom.sheetUnit || 'Unit';
      const ups = Math.max(1, bom.ups || bom.piecesPerSheet || 1);
      const wastage = bom.wastagePercent || 0;
      const baseUnits = defaultProdQty / ups;
      const roundedUnits = Math.ceil(baseUnits);
      const extraUnits = 0;
      const totalUnits = roundedUnits;

      rows.push({
        itemId: bom.sheetItemId,
        specification: sheetItem?.description || `${sheetItem?.name || 'Raw Material'}`,
        useSheetCalc: true,
        productionQty: defaultProdQty,
        ups: ups,
        extraSheets: extraUnits,
        wastagePercent: wastage,
        quantity: totalUnits,
        remarks: `[BOM Calc: ${defaultProdQty.toLocaleString()} Pcs ÷ ${ups} Pcs/${itemUnit} = ${baseUnits.toFixed(4)} ${itemUnit} (Round: ${roundedUnits}) = ${totalUnits} ${itemUnit}]`,
        bomNo: bom.bomNo,
        bomId: bom.id
      });
    }

    if (bom.items && bom.items.length > 0) {
      bom.items.forEach(bItem => {
        if (bItem.rawMaterialId === bom.sheetItemId) return;
        const rawItem = items.find(i => i.id === bItem.rawMaterialId);
        const reqQty = Number((bItem.totalRequiredQty * defaultProdQty).toFixed(3));

        rows.push({
          itemId: bItem.rawMaterialId,
          specification: bItem.specification || rawItem?.description || '',
          useSheetCalc: false,
          productionQty: defaultProdQty,
          ups: 1,
          extraSheets: 0,
          wastagePercent: bItem.wastagePercent || 0,
          quantity: Math.max(0.001, reqQty),
          remarks: `BOM: ${bom.bomNo} (${bItem.rawMaterialName})`,
          bomNo: bom.bomNo,
          bomId: bom.id
        });
      });
    }

    if (rows.length > 0) {
      setItemRows(rows);
      showToast(`Loaded ${rows.length} raw material(s) from BOM ${bom.bomNo}. Enter target production quantity to adjust sheets.`, 'info');
    }
  };

  const hasAnyOverStock = useMemo(() => {
    const aggregatedQtyByItem: Record<string, number> = {};
    for (const row of itemRows) {
      if (!row.itemId) continue;
      aggregatedQtyByItem[row.itemId] = (aggregatedQtyByItem[row.itemId] || 0) + (Number(row.quantity) || 0);
    }
    for (const [itemId, totalReqQty] of Object.entries(aggregatedQtyByItem)) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;
      const stock = Number(item.currentStock) || 0;
      if (stock + 0.0001 < totalReqQty) {
        return true;
      }
    }
    return false;
  }, [itemRows, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;

    if (!srNo.trim()) {
      showToast('Store Requisition (SR) No. is required.', 'error');
      return;
    }

    // Filter valid rows
    const validRows = itemRows.filter(r => r.itemId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      showToast('Please select at least one valid item with a quantity greater than 0.', 'error');
      return;
    }

    // Stock availability check (Cumulative per item to prevent multi-row stock bypass)
    const aggregatedQtyByItem: Record<string, number> = {};
    for (const row of validRows) {
      aggregatedQtyByItem[row.itemId] = (aggregatedQtyByItem[row.itemId] || 0) + (Number(row.quantity) || 0);
    }

    for (const [itemId, totalReqQty] of Object.entries(aggregatedQtyByItem)) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;
      const stock = Number(item.currentStock) || 0;
      if (stock + 0.0001 < totalReqQty) {
        showToast(
          `Insufficient stock for "${item.name}"! Available Stock: ${stock.toFixed(2)} ${item.unit}, Total Requisition Quantity: ${totalReqQty.toFixed(2)} ${item.unit}.`,
          'error'
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const createdItemsSummary: StoreRequisitionItem[] = [];
      const affectedItemIds = new Set<string>();

      for (const row of validRows) {
        const item = items.find(i => i.id === row.itemId)!;
        const qty = Number(row.quantity);
        const avgCost = Number(item.avgCost) || 0;

        const prodQty = Number(row.productionQty) || undefined;
        const ups = Number(row.ups) || undefined;
        const extraSheets = Number(row.extraSheets) || undefined;
        const wastagePercent = Number(row.wastagePercent) || undefined;
        const baseSheets = (prodQty && ups) ? Number((prodQty / ups).toFixed(3)) : undefined;
        const roundedSheets = (prodQty && ups) ? Math.ceil(prodQty / ups) : undefined;

        // Record inventory deduction transaction
        await addDoc(collection(db, 'transactions'), {
          itemId: item.id,
          type: reqType,
          quantity: qty,
          price: avgCost,
          date: Timestamp.fromDate(new Date(srDate)),
          reference: srNo.trim(),
          srNo: srNo.trim(),
          department: department.trim(),
          location: location.trim(),
          requestorName: requestorName.trim(),
          designation: designation.trim(),
          purpose: purpose.trim(),
          jobNo: jobNo.trim(),
          style: style.trim(),
          requiredDate,
          itemSpecification: row.specification.trim(),
          itemRemarks: row.remarks.trim(),
          productionQty: prodQty || null,
          ups: ups || null,
          baseSheets: baseSheets || null,
          roundedSheets: roundedSheets || null,
          extraSheets: extraSheets || null,
          wastagePercent: wastagePercent || null,
          bomNo: row.bomNo || null,
          notes: generalRemarks.trim(),
          ownerId: userProfile.uid,
          businessId: userProfile.businessId,
          status: 'active'
        });

        affectedItemIds.add(item.id);

        // Optimistic local stock reduction
        updateDoc(doc(db, 'items', item.id), {
          currentStock: Number((item.currentStock - qty).toFixed(4)),
          updatedAt: Timestamp.now()
        }).catch(err => console.warn('Background optimistic update failed:', err));

        createdItemsSummary.push({
          itemId: item.id,
          itemCode: item.sku,
          itemName: item.name,
          specification: row.specification.trim(),
          unit: item.unit,
          quantity: qty,
          productionQty: prodQty,
          ups: ups,
          baseSheets: baseSheets,
          roundedSheets: roundedSheets,
          extraSheets: extraSheets,
          wastagePercent: wastagePercent,
          bomNo: row.bomNo,
          bomId: row.bomId,
          notes: row.remarks.trim(),
          remarks: row.remarks.trim()
        });
      }

      // Persist Store Requisition record document in `store_requisitions`
      const requisitionDocData = {
        srNo: srNo.trim(),
        srDate: format(new Date(srDate), 'yyyy-MM-dd HH:mm'),
        requiredDate: requiredDate || '',
        department: department.trim(),
        location: location.trim(),
        requestorName: requestorName.trim(),
        designation: designation.trim(),
        purpose: purpose.trim(),
        jobNo: jobNo.trim(),
        style: style.trim(),
        type: reqType,
        remarks: generalRemarks.trim(),
        notes: generalRemarks.trim(),
        status: 'issued',
        items: createdItemsSummary,
        businessId: userProfile.businessId,
        ownerId: userProfile.uid,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'store_requisitions'), requisitionDocData).catch(err => 
        console.warn('Store requisition collection insert warning:', err)
      );

      // Background stock recalculations
      setTimeout(() => {
        affectedItemIds.forEach(id => {
          recalculateItemStock(id, userProfile.businessId).catch(console.error);
        });
      }, 400);

      showToast(`Store Requisition ${srNo} confirmed! Stock deducted from store successfully.`, 'success');

      try {
        localStorage.setItem('es_trims_last_sr_no', srNo.trim());
      } catch (e) {
        console.warn('Failed to save last SR No to localStorage:', e);
      }

      const reqData: StoreRequisitionData = {
        srNo: srNo.trim(),
        srDate: format(new Date(srDate), 'dd-MMM-yyyy HH:mm'),
        requiredDate: requiredDate ? format(new Date(requiredDate), 'dd-MMM-yyyy') : '',
        department,
        location,
        requestorName,
        designation,
        purpose,
        jobNo,
        style,
        type: reqType,
        remarks: generalRemarks,
        notes: generalRemarks,
        items: createdItemsSummary
      };

      onRequisitionCreated(reqData);
      onClose();
    } catch (err) {
      console.error('Error creating store requisition:', err);
      showToast('Failed to save store requisition. Please try again.', 'error');
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-5xl my-6 bg-white rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 cursor-default flex flex-col max-h-[92vh]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-900/60 rounded-xl border border-indigo-700/50">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Store Requisition & Issue from Store
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  BOM Sheet Calculation Enabled
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Calculate required sheets from BOM (with decimal round up & extra sheets) and issue directly from store
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Quick-Fill & Requisition Type Top Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
            {/* Requisition Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
                Requisition Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReqType('PRODUCTION')}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                    reqType === 'PRODUCTION'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Production Issue
                </button>
                <button
                  type="button"
                  onClick={() => setReqType('EXTRA_REQUISITION')}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                    reqType === 'EXTRA_REQUISITION'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Extra Requisition
                </button>
              </div>
            </div>

            {/* Quick-Load from Work Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Auto-Fill from Work Order
              </label>
              <select
                value={selectedWoId}
                onChange={e => handleSelectWorkOrder(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="">-- Choose Confirmed Work Order --</option>
                {workOrdersList.map(wo => (
                  <option key={wo.id} value={wo.id}>
                    {wo.woNumber} - {wo.finishedGoodsName || wo.styleNo} ({(wo.totalQuantity || 0).toLocaleString()} Pcs)
                  </option>
                ))}
              </select>
            </div>

            {/* Quick-Load from Standalone BOM */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Or Load from BOM Formula
              </label>
              <select
                value={selectedBomId}
                onChange={e => handleSelectBom(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="">-- Choose BOM Master --</option>
                {bomsList.map(bom => (
                  <option key={bom.id} value={bom.id}>
                    {bom.bomNo} - {bom.productName} (UPS: {bom.ups || bom.piecesPerSheet || 1})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Requisition Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">SR No. / Ref <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={srNo}
                onChange={e => setSrNo(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm font-mono font-bold text-indigo-700 bg-indigo-50/40 focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                placeholder="SR-0001"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">SR Date & Time</label>
              <input
                type="datetime-local"
                required
                value={srDate}
                onChange={e => setSrDate(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Required Date</label>
              <input
                type="date"
                value={requiredDate}
                onChange={e => setRequiredDate(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Requisition From (Department)</label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Cutting, Sewing, Finishing"
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Main Store, Floor 2"
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Requestor Name</label>
              <input
                type="text"
                value={requestorName}
                onChange={e => setRequestorName(e.target.value)}
                placeholder="Full Name"
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                placeholder="e.g. Supervisor, Incharge"
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Work Order / Job No.</label>
              <input
                type="text"
                value={jobNo}
                onChange={e => setJobNo(e.target.value)}
                placeholder="e.g. WO-8842 / JOB-102"
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm font-mono font-bold focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Production Style / Item</label>
              <input
                type="text"
                value={style}
                onChange={e => setStyle(e.target.value)}
                placeholder="e.g. Shirt Trim Pack / Jacket #205"
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-neutral-600 uppercase">Purpose / Use</label>
              <input
                type="text"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="e.g. Raw material issuance for cutting & printing"
                className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
              />
            </div>
          </div>

          {/* Items Table Section with BOM Material Yield Calculation */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                  <span>Requisition Items List ({itemRows.length})</span>
                  <span className="text-[10px] font-normal text-neutral-500 normal-case">
                    (Formula: Total Units = ⌈Quantity ÷ UPS⌉ + Extra Units)
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm self-start"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </button>
            </div>

            <div className="border border-neutral-200 rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-neutral-800 text-white font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-3 py-3 w-10 text-center">SL</th>
                    <th className="px-3 py-3 min-w-[200px]">Raw Material Item <span className="text-red-400">*</span></th>
                    <th className="px-3 py-3 min-w-[130px]">Specification / Size</th>
                    <th className="px-3 py-3 min-w-[260px] bg-neutral-900/60 border-x border-neutral-700">
                      <div className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                        <span>BOM Yield / Cutting Breakdown</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 w-16 text-center">UoM</th>
                    <th className="px-3 py-3 w-28 text-right">Req. Quantity <span className="text-red-400">*</span></th>
                    <th className="px-3 py-3 min-w-[150px]">Item Notes / Remarks</th>
                    <th className="px-3 py-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {itemRows.map((row, idx) => {
                    const selectedItem = items.find(i => i.id === row.itemId);
                    const itemUnit = selectedItem?.unit || 'Unit';
                    const isOverStock = selectedItem && Number(row.quantity) > selectedItem.currentStock;

                    const prodQtyNum = Number(row.productionQty) || 0;
                    const upsNum = Math.max(1, Number(row.ups) || 1);
                    const baseUnitsDecimal = prodQtyNum > 0 ? prodQtyNum / upsNum : 0;
                    const roundedUnitsCeil = Math.ceil(baseUnitsDecimal);
                    const extraUnitsNum = Number(row.extraSheets) || 0;
                    const hasDecimal = prodQtyNum > 0 && (baseUnitsDecimal % 1 !== 0);

                    return (
                      <tr key={idx} className="hover:bg-neutral-50/80 transition-colors align-top">
                        <td className="px-3 py-3 text-center font-bold text-neutral-500">
                          {idx + 1}
                        </td>

                        {/* Raw Material Select */}
                        <td className="px-3 py-2.5">
                          <select
                            required
                            value={row.itemId}
                            onChange={e => handleRowChange(idx, 'itemId', e.target.value)}
                            className="w-full h-8 rounded-lg border border-neutral-300 bg-white px-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-400 outline-none"
                          >
                            <option value="">-- Choose Item --</option>
                            {items.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.sku}) - Stock: {item.currentStock} {item.unit}
                              </option>
                            ))}
                          </select>

                          {selectedItem && (
                            <div className="flex items-center justify-between mt-1 px-1 text-[10px]">
                              <span className={isOverStock ? 'text-red-600 font-black' : 'text-emerald-700 font-bold'}>
                                Stock: {selectedItem.currentStock.toLocaleString()} {selectedItem.unit}
                              </span>
                              <span className="text-neutral-400 font-mono">
                                Avg: ${selectedItem.avgCost?.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {row.bomNo && (
                            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                              <Layers className="w-3 h-3" />
                              BOM: {row.bomNo}
                            </div>
                          )}
                        </td>

                        {/* Specification / Size */}
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={row.specification}
                            onChange={e => handleRowChange(idx, 'specification', e.target.value)}
                            placeholder="e.g. 50mm x 20mm"
                            className="w-full h-8 rounded-lg border border-neutral-300 px-2 text-xs focus:ring-2 focus:ring-neutral-400 outline-none"
                          />
                        </td>

                        {/* BOM / Unit Yield Calculator Sub-Panel */}
                        <td className="px-3 py-2.5 bg-neutral-50/60 border-x border-neutral-200">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-indigo-950">
                                <input
                                  type="checkbox"
                                  checked={row.useSheetCalc}
                                  onChange={e => handleRowChange(idx, 'useSheetCalc', e.target.checked)}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded"
                                />
                                <span>Yield / Piece Formula ({itemUnit})</span>
                              </label>
                              {row.useSheetCalc && hasDecimal && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded">
                                  Round-Up: {baseUnitsDecimal.toFixed(4)} ➔ {roundedUnitsCeil} {itemUnit}
                                </span>
                              )}
                            </div>

                            {row.useSheetCalc ? (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-3 gap-1.5">
                                  <div>
                                    <span className="text-[9px] font-bold text-neutral-500 block">Pcs Qty</span>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={row.productionQty}
                                      onChange={e => handleRowChange(idx, 'productionQty', e.target.value)}
                                      placeholder="e.g. 5000"
                                      className="w-full h-7 rounded border border-neutral-300 px-1.5 text-right font-bold text-xs bg-white"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-neutral-500 block">UPS (Pcs/{itemUnit})</span>
                                    <input
                                      type="number"
                                      step="any"
                                      min="1"
                                      value={row.ups}
                                      onChange={e => handleRowChange(idx, 'ups', e.target.value)}
                                      placeholder="e.g. 24"
                                      className="w-full h-7 rounded border border-neutral-300 px-1.5 text-right font-bold text-xs bg-white text-indigo-800"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-neutral-500 block">+ Extra {itemUnit}s</span>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={row.extraSheets}
                                      onChange={e => handleRowChange(idx, 'extraSheets', e.target.value)}
                                      placeholder="e.g. 0"
                                      className="w-full h-7 rounded border border-purple-300 px-1.5 text-right font-bold text-xs bg-purple-50 text-purple-900"
                                    />
                                  </div>
                                </div>

                                {prodQtyNum > 0 && (
                                  <div className="p-1.5 bg-indigo-50/80 rounded border border-indigo-100 text-[10px] text-indigo-900 font-medium">
                                    <span className="font-bold">{prodQtyNum.toLocaleString()} Pcs</span> ÷ {upsNum.toLocaleString()} UPS = <span className="font-mono font-bold">{baseUnitsDecimal.toFixed(4)} {itemUnit}</span> ➔ Round Up: <span className="font-bold">{roundedUnitsCeil} {itemUnit}</span>{extraUnitsNum > 0 ? ` + ${extraUnitsNum} Extra = ${roundedUnitsCeil + extraUnitsNum} ${itemUnit}s` : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-neutral-400 italic">
                                Direct quantity entry. Check box above to calculate from UPS & Extra.
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="px-3 py-3 text-center font-bold text-neutral-600">
                          {selectedItem?.unit || '-'}
                        </td>

                        {/* Req. Quantity */}
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            required
                            value={row.quantity}
                            onChange={e => handleRowChange(idx, 'quantity', e.target.value)}
                            className={`w-full h-8 rounded-lg border text-right font-black px-2 text-xs focus:ring-2 outline-none ${
                              isOverStock
                                ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-400'
                                : 'border-neutral-300 focus:ring-indigo-400 text-neutral-900'
                            }`}
                          />
                          {isOverStock && (
                            <span className="text-[9px] text-red-600 font-bold block text-right mt-0.5">
                              Exceeds Stock!
                            </span>
                          )}
                        </td>

                        {/* Remarks / Notes per row */}
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={e => handleRowChange(idx, 'remarks', e.target.value)}
                            placeholder="Row notes (e.g. extra buffer reason)"
                            className="w-full h-8 rounded-lg border border-neutral-300 px-2 text-xs focus:ring-2 focus:ring-neutral-400 outline-none"
                          />
                        </td>

                        {/* Delete row */}
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove row"
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
          </div>

          {/* General Remarks / Authorization Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-600 uppercase">General Remarks & Requisition Notes</label>
            <textarea
              rows={2}
              value={generalRemarks}
              onChange={e => setGeneralRemarks(e.target.value)}
              placeholder="Any additional remarks, instructions, or authorization notes..."
              className="w-full rounded-xl border border-neutral-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Submitting will record the requisition & immediately deduct stock from the store inventory.</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold text-xs hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isViewer || hasAnyOverStock}
                className={`px-6 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 ${
                  hasAnyOverStock ? 'bg-rose-600 hover:bg-rose-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {hasAnyOverStock ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-200" />
                    Cannot Issue: Exceeds Available Stock (স্টকের বেশি আউট সম্ভব নয়)
                  </>
                ) : isSubmitting ? (
                  <>Saving & Issuing...</>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Requisition & Issue from Store
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface StoreRequisitionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: StoreRequisitionData | null;
}

export function StoreRequisitionPrintModal({
  isOpen,
  onClose,
  data
}: StoreRequisitionPrintModalProps) {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    printElement('printable-store-requisition', { title: `Requisition-${data.srNo || 'Doc'}` });
  };

  // Pad items to at least 10 rows for official paper template layout matching the uploaded picture
  const minRows = 10;
  const itemsToRender = [...data.items];
  const emptyRowsNeeded = Math.max(0, minRows - itemsToRender.length);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-4xl bg-neutral-100 rounded-2xl shadow-2xl overflow-hidden my-6 border border-neutral-300 cursor-default"
        onClick={e => e.stopPropagation()}
      >
        {/* Printable Top Actions Bar */}
        <div className="no-print flex items-center justify-between px-6 py-3.5 bg-neutral-900 text-white border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-700"
              title="Close and return to app"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="h-4 w-px bg-neutral-700" />
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-sm tracking-wide">Store Requisition Slip Preview (ES TRIMS LIMITED)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Box - Styled strictly according to official paper layout */}
        <div className="p-6 overflow-x-auto bg-neutral-200">
          <div 
            id="printable-store-requisition" 
            className="w-[210mm] max-w-full mx-auto bg-white p-5 sm:p-6 shadow-xl border border-neutral-300 font-sans text-neutral-900 text-xs leading-tight box-border"
          >
            {/* Header Section */}
            <div className="flex justify-between items-start mb-3">
              {/* Logo & Company Details */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <img
                    src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
                    alt="ES Trims Limited"
                    className="h-12 w-12 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                  />
                  <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tight text-[#1B365D] font-serif leading-none">
                      ES TRIMS LIMITED
                    </span>
                    <span className="text-[8px] font-extrabold text-orange-600 tracking-widest uppercase mt-0.5">
                      Garments Accessories
                    </span>
                  </div>
                </div>

                <div className="border-l-2 border-neutral-300 pl-3 py-0.5 text-[10px] text-neutral-700 leading-tight">
                  <p className="font-extrabold text-neutral-900 text-xs">ES TRIMS LIMITED</p>
                  <p>C-15, Panchaboti, Industrial Park, Hariharpara,</p>
                  <p>Enayetnagar, Fatullah, Narayanganj 1400</p>
                </div>
              </div>

              {/* Title Pill */}
              <div className="self-center bg-[#1B365D] text-white px-8 py-2 rounded-md font-extrabold text-lg tracking-wider uppercase shadow-sm">
                STORE REQUISITION
              </div>

              {/* SR Top Right Details Box */}
              <div className="border border-neutral-800 rounded-md p-2 w-52 text-[11px] space-y-1 bg-white">
                <div className="flex justify-between border-b border-neutral-200 pb-0.5">
                  <span className="font-bold text-neutral-800">SR No.</span>
                  <span className="font-extrabold font-mono text-indigo-900">{data.srNo}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-200 pb-0.5">
                  <span className="font-bold text-neutral-800">SR Date</span>
                  <span className="font-medium">{data.srDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-800">Required Date</span>
                  <span className="font-medium">{data.requiredDate || '-'}</span>
                </div>
              </div>
            </div>

            {/* Upper Requisition Metadata Outer Box */}
            <div className="border border-neutral-800 rounded-md p-3 mb-3 bg-neutral-50/50">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                {/* Left Column */}
                <div className="space-y-1.5">
                  <div className="flex items-center">
                    <span className="w-32 font-bold text-neutral-800">Requisition From</span>
                    <span className="mr-1">:</span>
                    <span className="font-bold border-b border-neutral-400 flex-1 px-1">
                      {data.department || '-'} <span className="text-[10px] text-neutral-500 font-normal">(Department)</span>
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 font-bold text-neutral-800">Location</span>
                    <span className="mr-1">:</span>
                    <span className="border-b border-neutral-400 flex-1 px-1">{data.location || '-'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 font-bold text-neutral-800">Requestor Name</span>
                    <span className="mr-1">:</span>
                    <span className="border-b border-neutral-400 flex-1 px-1">{data.requestorName || '-'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 font-bold text-neutral-800">Designation</span>
                    <span className="mr-1">:</span>
                    <span className="border-b border-neutral-400 flex-1 px-1">{data.designation || '-'}</span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-1.5">
                  <div className="flex items-start">
                    <span className="w-36 font-bold text-neutral-800">Purpose / Use</span>
                    <span className="mr-1">:</span>
                    <span className="border-b border-neutral-400 flex-1 px-1 font-medium">{data.purpose || '-'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-36 font-bold text-neutral-800">Work Order / Job No.</span>
                    <span className="mr-1">:</span>
                    <span className="border-b border-neutral-400 flex-1 px-1 font-mono font-bold">{data.jobNo || '-'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-36 font-bold text-neutral-800">Production Style / Item</span>
                    <span className="mr-1">:</span>
                    <span className="border-b border-neutral-400 flex-1 px-1 font-bold">{data.style || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Requisition Items Table */}
            <div className="border border-neutral-800 rounded-md overflow-hidden mb-3">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#1B365D] text-white font-bold text-center border-b border-neutral-800">
                    <th className="py-1.5 px-2 w-10 border-r border-neutral-600">SL</th>
                    <th className="py-1.5 px-2 w-28 border-r border-neutral-600">Item Code</th>
                    <th className="py-1.5 px-2 text-left border-r border-neutral-600">Item Description</th>
                    <th className="py-1.5 px-2 text-left border-r border-neutral-600">Specification / Size</th>
                    <th className="py-1.5 px-2 w-16 border-r border-neutral-600">UoM</th>
                    <th className="py-1.5 px-2 w-24 text-right border-r border-neutral-600">Required Quantity</th>
                    <th className="py-1.5 px-2 text-left">Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300">
                  {itemsToRender.map((item, idx) => (
                    <tr key={idx} className="h-8">
                      <td className="text-center font-bold border-r border-neutral-300 px-1">{idx + 1}</td>
                      <td className="font-mono text-center border-r border-neutral-300 px-1">{item.itemCode || '-'}</td>
                      <td className="font-bold border-r border-neutral-300 px-2">{item.itemName}</td>
                      <td className="border-r border-neutral-300 px-2 text-neutral-700">{item.specification || '-'}</td>
                      <td className="text-center border-r border-neutral-300 px-1">{item.unit || '-'}</td>
                      <td className="text-right font-black border-r border-neutral-300 px-2 text-neutral-900">
                        {item.quantity.toLocaleString()}
                      </td>
                      <td className="px-2 text-neutral-600">{item.remarks || item.notes || '-'}</td>
                    </tr>
                  ))}

                  {/* Empty rows to match official form height */}
                  {Array.from({ length: emptyRowsNeeded }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-8">
                      <td className="text-center font-bold text-neutral-400 border-r border-neutral-300 px-1">
                        {itemsToRender.length + idx + 1}
                      </td>
                      <td className="border-r border-neutral-300"></td>
                      <td className="border-r border-neutral-300"></td>
                      <td className="border-r border-neutral-300"></td>
                      <td className="border-r border-neutral-300"></td>
                      <td className="border-r border-neutral-300"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* General Remarks Section */}
            <div className="border border-neutral-800 rounded-md p-2.5 mb-3 bg-neutral-50/30">
              <div className="flex items-start text-[11px]">
                <span className="font-bold text-neutral-800 w-32 shrink-0">Remarks (If any)</span>
                <span className="mr-2">:</span>
                <div className="flex-1 border-b border-neutral-300 pb-1 min-h-[1.5rem]">
                  {data.remarks || data.notes || 'N/A'}
                </div>
              </div>
            </div>

            {/* Approval / Signatures Grid - 4 Columns Box */}
            <div className="border border-neutral-800 rounded-md overflow-hidden grid grid-cols-4 divide-x divide-neutral-800 text-[10px] mb-4 bg-white">
              {/* Requested By */}
              <div className="p-2 flex flex-col justify-between h-28">
                <p className="font-bold text-neutral-900 border-b border-neutral-200 pb-1 text-center">
                  Requested By
                </p>
                <div className="space-y-1 text-neutral-800 pt-4">
                  <p><span className="font-medium">Name:</span> {data.requestorName || '________________'}</p>
                  <p><span className="font-medium">Designation:</span> {data.designation || '________________'}</p>
                  <p><span className="font-medium">Date:</span> {data.srDate}</p>
                </div>
              </div>

              {/* Checked By (Store) */}
              <div className="p-2 flex flex-col justify-between h-28">
                <p className="font-bold text-neutral-900 border-b border-neutral-200 pb-1 text-center">
                  Checked By (Store)
                </p>
                <div className="space-y-1 text-neutral-800 pt-4">
                  <p><span className="font-medium">Name:</span> ________________</p>
                  <p><span className="font-medium">Designation:</span> ________________</p>
                  <p><span className="font-medium">Date:</span> ________________</p>
                </div>
              </div>

              {/* Approved By (Department Head) */}
              <div className="p-2 flex flex-col justify-between h-28">
                <p className="font-bold text-neutral-900 border-b border-neutral-200 pb-1 text-center">
                  Approved By (Department Head)
                </p>
                <div className="space-y-1 text-neutral-800 pt-4">
                  <p><span className="font-medium">Name:</span> ________________</p>
                  <p><span className="font-medium">Designation:</span> ________________</p>
                  <p><span className="font-medium">Date:</span> ________________</p>
                </div>
              </div>

              {/* Approved By (Admin) */}
              <div className="p-2 flex flex-col justify-between h-28">
                <p className="font-bold text-neutral-900 border-b border-neutral-200 pb-1 text-center">
                  Approved By (Admin)
                </p>
                <div className="space-y-1 text-neutral-800 pt-4">
                  <p><span className="font-medium">Name:</span> ________________</p>
                  <p><span className="font-medium">Designation:</span> ________________</p>
                  <p><span className="font-medium">Date:</span> ________________</p>
                </div>
              </div>
            </div>

            {/* Document Footer */}
            <div className="flex justify-between items-end text-[9px] text-neutral-600">
              <div className="space-y-0.5">
                <p className="font-bold text-neutral-800">Note:</p>
                <p>1. Please attach relevant documents if any.</p>
                <p>2. Approved Store Requisition is valid for 7 days from the date of approval.</p>
              </div>
              <div className="bg-[#1B365D] text-white px-3 py-1 rounded text-[9px] font-mono font-bold tracking-wider">
                Form No.: EST/STORE/SR/01 &nbsp;&nbsp; Rev.: 00
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
