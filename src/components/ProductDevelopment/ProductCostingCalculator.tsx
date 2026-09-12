import React, { useState, useEffect, useMemo } from 'react';
import { printElement } from '../../utils/printHelper';
import {
  Calculator,
  Plus,
  Trash2,
  Copy,
  Save,
  Printer,
  Download,
  RefreshCw,
  Search,
  Package,
  DollarSign,
  Layers,
  ArrowRight,
  Sparkles,
  ChevronDown,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Building2,
  Truck,
  Percent,
  HelpCircle,
  Eye,
  History
} from 'lucide-react';
import {
  CostingInput,
  CostingResult,
  RawMaterialCostRow,
  ProcessCostRow,
  OtherCostRow,
  QuantityUnit,
  UOMUnit,
  CostBasis,
  CalculationBase,
  calculateProductCosting,
  COMMON_PROCESS_TEMPLATES,
  convertToTotalPieces
} from '../../lib/productCostingCalculator';
import { UserProfile } from '../../types';

interface ProductCostingCalculatorProps {
  items: any[];
  purchaseOrders?: any[];
  transactions?: any[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSaveCosting?: (record: any) => void;
  initialProduct?: any;
  initialCostingRecord?: any;
}

export const ProductCostingCalculator: React.FC<ProductCostingCalculatorProps> = ({
  items = [],
  purchaseOrders = [],
  transactions = [],
  userProfile,
  showToast,
  onSaveCosting,
  initialProduct,
  initialCostingRecord
}) => {
  // 1. Product Selection State
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProduct?.id || initialCostingRecord?.productId || ''
  );
  const [productCode, setProductCode] = useState<string>(
    initialProduct?.itemCode || initialCostingRecord?.productCode || 'HT-001'
  );
  const [productName, setProductName] = useState<string>(
    initialProduct?.itemName || initialCostingRecord?.productName || 'Hang Tag 300 GSM'
  );
  const [productCategory, setProductCategory] = useState<string>(
    initialProduct?.category || initialCostingRecord?.productCategory || 'Paper Products'
  );
  const [productUnit, setProductUnit] = useState<string>(
    initialProduct?.unit || initialCostingRecord?.productUnit || 'Pcs'
  );
  const [productWidth, setProductWidth] = useState<number>(
    initialProduct?.width || initialCostingRecord?.productWidth || 2.5
  );
  const [productHeight, setProductHeight] = useState<number>(
    initialProduct?.height || initialCostingRecord?.productHeight || 4.0
  );
  const [costingVersion, setCostingVersion] = useState<number>(
    initialCostingRecord?.version || 1
  );

  // 2. Quantity & UPS
  const [calculationQuantity, setCalculationQuantity] = useState<number>(
    initialCostingRecord?.calculationQuantity || 10000
  );
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(
    initialCostingRecord?.quantityUnit || 'pcs'
  );
  const [ups, setUps] = useState<number>(
    initialCostingRecord?.ups || initialProduct?.ups || 20
  );

  // 3. Currency & Sales Conversion Rate State
  // Raw materials, processes, overheads, and manufacturing costs are always computed in BDT (৳).
  // The Currency selector and Conversion Rate convert the Sales Price and Commercial Quotations into USD ($) or other selected export currencies.
  const [currency, setCurrency] = useState<string>(
    initialCostingRecord?.currency || 'USD'
  );
  const [exchangeRate, setExchangeRate] = useState<number>(
    initialCostingRecord?.exchangeRate || 120.0
  );

  // 4. Raw Materials State
  const [rawMaterials, setRawMaterials] = useState<RawMaterialCostRow[]>(
    initialCostingRecord?.rawMaterials || [
      {
        id: 'rm-1',
        itemName: 'Paper 300 GSM Art Card',
        consumption: 500,
        unit: 'Sheet',
        price: 8.5,
        priceBasis: 'per_sheet',
        priceSource: 'previous',
        previousPrice: 8.5,
        lastSupplierName: 'ABC Paper Mills Ltd',
        lastPurchaseDate: '2026-08-01'
      },
      {
        id: 'rm-2',
        itemName: 'Offset Printing Ink',
        consumption: 1.5,
        unit: 'Kg',
        price: 850,
        priceBasis: 'per_kg',
        priceSource: 'previous',
        previousPrice: 850,
        lastSupplierName: 'Global Inks Corp',
        lastPurchaseDate: '2026-07-28'
      },
      {
        id: 'rm-3',
        itemName: 'Cotton String / Cord',
        consumption: 10000,
        unit: 'Piece',
        price: 0.4,
        priceBasis: 'per_piece',
        priceSource: 'manual'
      }
    ]
  );

  // 5. Processes State
  const [processes, setProcesses] = useState<ProcessCostRow[]>(
    initialCostingRecord?.processes || [
      { id: 'proc-1', processName: 'Offset Printing 4 Color', quantity: 500, cost: 2.5, costBasis: 'per_sheet' },
      { id: 'proc-2', processName: 'Die Cutting', quantity: 10000, cost: 0.1, costBasis: 'per_piece' },
      { id: 'proc-3', processName: 'Matt Lamination', quantity: 500, cost: 1.8, costBasis: 'per_sheet' },
      { id: 'proc-4', processName: 'Gold Foiling', quantity: 10000, cost: 0.2, costBasis: 'per_piece' }
    ]
  );

  // 6. Overhead, Admin, Transport, Other
  const [overheadMethod, setOverheadMethod] = useState<'percentage' | 'fixed'>(
    initialCostingRecord?.overheadMethod || 'percentage'
  );
  const [overheadValue, setOverheadValue] = useState<number>(
    initialCostingRecord?.overheadValue || 5.0
  );
  const [overheadBase, setOverheadBase] = useState<CalculationBase>(
    initialCostingRecord?.overheadBase || 'manufacturing'
  );

  const [adminMethod, setAdminMethod] = useState<'percentage' | 'fixed'>(
    initialCostingRecord?.adminMethod || 'percentage'
  );
  const [adminValue, setAdminValue] = useState<number>(
    initialCostingRecord?.adminValue || 3.0
  );
  const [adminBase, setAdminBase] = useState<CalculationBase>(
    initialCostingRecord?.adminBase || 'manufacturing'
  );

  const [transportMethod, setTransportMethod] = useState<'percentage' | 'fixed'>(
    initialCostingRecord?.transportMethod || 'percentage'
  );
  const [transportValue, setTransportValue] = useState<number>(
    initialCostingRecord?.transportValue || 2.0
  );
  const [transportBase, setTransportBase] = useState<CalculationBase>(
    initialCostingRecord?.transportBase || 'manufacturing'
  );

  const [otherCosts, setOtherCosts] = useState<OtherCostRow[]>(
    initialCostingRecord?.otherCosts || [
      { id: 'oc-1', costHead: 'Inspection & QC', method: 'percentage', value: 0.5, base: 'manufacturing' },
      { id: 'oc-2', costHead: 'Special Export Packaging', method: 'fixed', value: 500, base: 'manufacturing' }
    ]
  );

  // 7. Selling Price & Profit Margin
  const [sellingPriceMethod, setSellingPriceMethod] = useState<'cost_plus_markup' | 'percentage_sales' | 'manual'>(
    initialCostingRecord?.sellingPriceMethod || 'cost_plus_markup'
  );
  const [markupOrMarginPercent, setMarkupOrMarginPercent] = useState<number>(
    initialCostingRecord?.markupOrMarginPercent || 15.0
  );
  const [manualSellingPrice, setManualSellingPrice] = useState<number>(
    initialCostingRecord?.manualSellingPrice || 0
  );

  // 8. Costing Record Meta & Approval Status
  const [costingId, setCostingId] = useState<string>(
    initialCostingRecord?.costingId || `PC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [approvalStatus, setApprovalStatus] = useState<'Draft' | 'Pending Approval' | 'Approved'>(
    initialCostingRecord?.approvalStatus || 'Draft'
  );

  // Search filter for product selector dropdown
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Active raw material search state for searchable picker
  const [activeMaterialSearchRowId, setActiveMaterialSearchRowId] = useState<string | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

  // Automatically lookup previous purchase prices from items & purchase history when raw material is selected
  const findPreviousPurchasePrice = (itemNameOrId: string) => {
    if (!itemNameOrId) return null;
    const lowerQuery = String(itemNameOrId).toLowerCase().trim();

    // 1. Direct match in items
    const matchedItem = items.find(
      (i) =>
        i.id === itemNameOrId ||
        (i.name && i.name.toLowerCase().trim() === lowerQuery) ||
        (i.itemName && i.itemName.toLowerCase().trim() === lowerQuery) ||
        (i.sku && i.sku.toLowerCase().trim() === lowerQuery) ||
        (i.itemCode && i.itemCode.toLowerCase().trim() === lowerQuery)
    );

    // 2. Search in purchaseOrders / transactions for most recent real purchase
    let recentPoRate: number | null = null;
    let recentPoSupplier: string | null = null;
    let recentPoDate: string | null = null;

    if (purchaseOrders && purchaseOrders.length > 0) {
      for (const po of purchaseOrders) {
        if (po.items && Array.isArray(po.items)) {
          const poItem = po.items.find(
            (it: any) =>
              it.itemId === matchedItem?.id ||
              it.itemId === itemNameOrId ||
              (it.itemName && it.itemName.toLowerCase().trim() === lowerQuery) ||
              (it.name && it.name.toLowerCase().trim() === lowerQuery) ||
              (it.sku && it.sku.toLowerCase().trim() === lowerQuery) ||
              (it.itemCode && it.itemCode.toLowerCase().trim() === lowerQuery)
          );
          if (poItem && (Number(poItem.unitPrice) > 0 || Number(poItem.rate) > 0 || Number(poItem.price) > 0)) {
            recentPoRate = Number(poItem.unitPrice || poItem.rate || poItem.price) || 0;
            recentPoSupplier = po.supplierName || po.supplier || 'PO Supplier';
            recentPoDate = po.orderDate || po.date || po.createdAt;
            break;
          }
        }
      }
    }

    // 3. Search in transactions for recent IN purchase
    let recentTxPrice: number | null = null;
    let recentTxSupplier: string | null = null;
    let recentTxDate: string | null = null;

    if (transactions && transactions.length > 0) {
      const inTx = transactions.filter(
        (tx: any) =>
          tx.type === 'IN' &&
          (tx.itemId === matchedItem?.id || tx.itemId === itemNameOrId) &&
          Number(tx.price) > 0
      );
      if (inTx.length > 0) {
        const latestTx = inTx[0];
        recentTxPrice = Number(latestTx.price) || 0;
        recentTxSupplier = latestTx.supplierName || 'Store Inventory';
        recentTxDate = latestTx.date
          ? typeof latestTx.date.toDate === 'function'
            ? latestTx.date.toDate().toISOString().substring(0, 10)
            : String(latestTx.date).substring(0, 10)
          : null;
      }
    }

    // 4. Check item batch prices
    let latestBatchPrice: number | null = null;
    if (matchedItem?.batches && Array.isArray(matchedItem.batches) && matchedItem.batches.length > 0) {
      const validBatch = matchedItem.batches.find((b: any) => Number(b.price) > 0);
      if (validBatch) {
        latestBatchPrice = Number(validBatch.price);
      }
    }

    if (matchedItem || recentPoRate !== null || recentTxPrice !== null) {
      const bestPrice =
        recentPoRate && recentPoRate > 0
          ? recentPoRate
          : recentTxPrice && recentTxPrice > 0
          ? recentTxPrice
          : latestBatchPrice && latestBatchPrice > 0
          ? latestBatchPrice
          : matchedItem?.avgCost && matchedItem.avgCost > 0
          ? Number(matchedItem.avgCost)
          : matchedItem?.averagePrice && matchedItem.averagePrice > 0
          ? Number(matchedItem.averagePrice)
          : matchedItem?.lastPurchasePrice && matchedItem.lastPurchasePrice > 0
          ? Number(matchedItem.lastPurchasePrice)
          : matchedItem?.purchasePrice && matchedItem.purchasePrice > 0
          ? Number(matchedItem.purchasePrice)
          : matchedItem?.costPrice && matchedItem.costPrice > 0
          ? Number(matchedItem.costPrice)
          : matchedItem?.unitPrice && matchedItem.unitPrice > 0
          ? Number(matchedItem.unitPrice)
          : matchedItem?.price && matchedItem.price > 0
          ? Number(matchedItem.price)
          : 0;

      const unitRaw = matchedItem?.unit || matchedItem?.uom || 'Sheet';
      const supplierName = recentPoSupplier || recentTxSupplier || matchedItem?.primarySupplier || 'ERP Store Inventory';
      const purchaseDate = recentPoDate
        ? String(recentPoDate).substring(0, 10)
        : recentTxDate || matchedItem?.lastPurchaseDate || 'Recent Stock Rate';

      return {
        price: bestPrice,
        unit: unitRaw,
        supplierName,
        purchaseDate,
        itemCode: matchedItem?.sku || matchedItem?.itemCode || '',
        currentStock: matchedItem?.currentStock || 0,
        matchedItem
      };
    }
    return null;
  };

  // Handle selecting a product from ERP Product Master
  const handleSelectProduct = (productItem: any) => {
    setSelectedProductId(productItem.id);
    setProductCode(productItem.sku || productItem.itemCode || productItem.code || 'PROD-001');
    setProductName(productItem.name || productItem.itemName || 'Custom Product');
    setProductCategory(productItem.category || productItem.categoryId || 'General');
    setProductUnit(productItem.unit || productItem.uom || 'Pcs');
    if (productItem.width) setProductWidth(productItem.width);
    if (productItem.height) setProductHeight(productItem.height);
    if (productItem.ups) setUps(productItem.ups);
    setIsProductDropdownOpen(false);
    showToast(`Loaded ${productItem.name || productItem.itemName}`, 'info');
  };

  // Live Recalculation Engine Call
  const costingResult: CostingResult = useMemo(() => {
    const input: CostingInput = {
      productId: selectedProductId,
      productName,
      productCode,
      productCategory,
      productUnit,
      productWidth,
      productHeight,
      calculationQuantity,
      quantityUnit,
      ups,
      currency,
      exchangeRate,
      rawMaterials,
      processes,
      overheadMethod,
      overheadValue,
      overheadBase,
      adminMethod,
      adminValue,
      adminBase,
      transportMethod,
      transportValue,
      transportBase,
      otherCosts,
      sellingPriceMethod,
      markupOrMarginPercent,
      manualSellingPrice
    };

    return calculateProductCosting(input);
  }, [
    selectedProductId,
    productName,
    productCode,
    productCategory,
    productUnit,
    productWidth,
    productHeight,
    calculationQuantity,
    quantityUnit,
    ups,
    currency,
    exchangeRate,
    rawMaterials,
    processes,
    overheadMethod,
    overheadValue,
    overheadBase,
    adminMethod,
    adminValue,
    adminBase,
    transportMethod,
    transportValue,
    transportBase,
    otherCosts,
    sellingPriceMethod,
    markupOrMarginPercent,
    manualSellingPrice
  ]);

  // Synchronize required sheets & batch pieces with raw materials & processes when calculation quantity or UPS changes
  const handleSyncAllQuantities = () => {
    const totalPcs = convertToTotalPieces(calculationQuantity, quantityUnit, Math.max(1, ups || 1));
    const reqSheets = Math.ceil(totalPcs / Math.max(1, ups || 1));

    // Update raw materials
    setRawMaterials((prev) =>
      prev.map((rm) => {
        if (rm.unit === 'Sheet' || rm.priceBasis === 'per_sheet') {
          return { ...rm, consumption: reqSheets };
        }
        if (rm.unit === 'Piece' && rm.priceBasis === 'per_piece') {
          return { ...rm, consumption: totalPcs };
        }
        return rm;
      })
    );

    // Update processes
    setProcesses((prev) =>
      prev.map((proc) => {
        if (proc.costBasis === 'per_sheet') {
          return { ...proc, quantity: reqSheets };
        }
        if (['per_piece', 'per_100', 'per_1000', 'per_dozen'].includes(proc.costBasis)) {
          return { ...proc, quantity: totalPcs };
        }
        return proc;
      })
    );

    showToast(`Quantities aligned: ${totalPcs.toLocaleString()} Pcs / ${reqSheets.toLocaleString()} Sheets`, 'info');
  };

  // Dynamic Row Handlers for Raw Material
  const handleAddRawMaterial = (customPreset?: Partial<RawMaterialCostRow>) => {
    const totalPcs = convertToTotalPieces(calculationQuantity, quantityUnit, Math.max(1, ups || 1));
    const reqSheets = Math.ceil(totalPcs / Math.max(1, ups || 1));
    const isSheet = customPreset?.unit === 'Sheet' || customPreset?.priceBasis === 'per_sheet' || !customPreset?.unit;

    const newRow: RawMaterialCostRow = {
      id: `rm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      itemName: customPreset?.itemName || '',
      consumption: customPreset?.consumption !== undefined ? customPreset.consumption : (isSheet ? reqSheets : totalPcs),
      unit: customPreset?.unit || (isSheet ? 'Sheet' : 'Piece'),
      price: customPreset?.price || 0,
      priceBasis: customPreset?.priceBasis || (isSheet ? 'per_sheet' : 'per_piece'),
      priceSource: customPreset?.priceSource || 'manual'
    };

    // If item name matches something in ERP items, auto-lookup previous price
    if (newRow.itemName) {
      const prev = findPreviousPurchasePrice(newRow.itemName);
      if (prev) {
        newRow.price = prev.price;
        newRow.previousPrice = prev.price;
        newRow.lastSupplierName = prev.supplierName;
        newRow.lastPurchaseDate = prev.purchaseDate;
        newRow.priceSource = 'previous';
      }
    }

    setRawMaterials([...rawMaterials, newRow]);
  };

  const handleSelectRawMaterialItem = (rowId: string, itemObj: any) => {
    const prev = findPreviousPurchasePrice(itemObj.id || itemObj.name || itemObj.itemName);
    const itemUnitRaw = (itemObj.unit || itemObj.uom || '').toLowerCase();
    const isSheet = itemUnitRaw.includes('sheet') || itemUnitRaw.includes('board') || itemUnitRaw.includes('card');
    const totalPcs = convertToTotalPieces(calculationQuantity, quantityUnit, Math.max(1, ups || 1));
    const reqSheets = Math.ceil(totalPcs / Math.max(1, ups || 1));
    
    let unitVal: UOMUnit = 'Piece';
    let priceBasisVal: CostBasis = 'per_piece';
    let defaultConsumption = totalPcs;

    if (isSheet) {
      unitVal = 'Sheet';
      priceBasisVal = 'per_sheet';
      defaultConsumption = reqSheets;
    } else if (itemUnitRaw.includes('kg')) {
      unitVal = 'Kg';
      priceBasisVal = 'per_kg';
      defaultConsumption = 1;
    } else if (itemUnitRaw.includes('meter') || itemUnitRaw.includes('mtr')) {
      unitVal = 'Meter';
      priceBasisVal = 'per_meter';
      defaultConsumption = totalPcs;
    } else if (itemUnitRaw.includes('yard') || itemUnitRaw.includes('yds')) {
      unitVal = 'Yard';
      priceBasisVal = 'per_piece';
      defaultConsumption = totalPcs;
    } else if (itemUnitRaw.includes('doz')) {
      unitVal = 'Dozen';
      priceBasisVal = 'per_dozen';
      defaultConsumption = totalPcs;
    } else if (itemUnitRaw.includes('liter') || itemUnitRaw.includes('ltr')) {
      unitVal = 'Liter';
      priceBasisVal = 'per_piece';
      defaultConsumption = 1;
    }

    const autoPrice = prev ? prev.price : (itemObj.avgCost || itemObj.lastPurchasePrice || itemObj.unitPrice || 0);

    setRawMaterials(
      rawMaterials.map((rm) => {
        if (rm.id === rowId) {
          return {
            ...rm,
            itemId: itemObj.id,
            itemCode: itemObj.sku || itemObj.itemCode || '',
            itemName: itemObj.name || itemObj.itemName || 'Raw Material',
            unit: unitVal,
            priceBasis: priceBasisVal,
            consumption: defaultConsumption,
            price: autoPrice,
            previousPrice: autoPrice,
            lastSupplierName: prev?.supplierName || itemObj.primarySupplier || 'Store Inventory',
            lastPurchaseDate: prev?.purchaseDate || itemObj.lastPurchaseDate || 'Recent Stock Rate',
            priceSource: 'previous'
          };
        }
        return rm;
      })
    );

    setActiveMaterialSearchRowId(null);
    setMaterialSearchQuery('');
    showToast(`Loaded ${itemObj.name || itemObj.itemName} @ ৳ ${autoPrice}`, 'info');
  };

  const handleUpdateRawMaterial = (id: string, updates: Partial<RawMaterialCostRow>) => {
    setRawMaterials(
      rawMaterials.map((rm) => {
        if (rm.id === id) {
          const updated = { ...rm, ...updates };
          if (updates.itemName && updates.itemName !== rm.itemName) {
            const prev = findPreviousPurchasePrice(updates.itemName);
            if (prev) {
              updated.price = prev.price;
              updated.previousPrice = prev.price;
              updated.lastSupplierName = prev.supplierName;
              updated.lastPurchaseDate = prev.purchaseDate;
              updated.priceSource = 'previous';
              if (prev.unit) {
                const u = prev.unit.toLowerCase();
                if (u.includes('sheet')) {
                  updated.unit = 'Sheet';
                  updated.priceBasis = 'per_sheet';
                }
              }
            }
          }
          if (updates.priceSource === 'previous' && (updated.itemName || updated.itemId)) {
            const prev = findPreviousPurchasePrice(updated.itemId || updated.itemName);
            if (prev) {
              updated.price = prev.price;
              updated.previousPrice = prev.price;
              updated.lastSupplierName = prev.supplierName;
              updated.lastPurchaseDate = prev.purchaseDate;
            }
          }
          return updated;
        }
        return rm;
      })
    );
  };

  const handleDeleteRawMaterial = (id: string) => {
    setRawMaterials(rawMaterials.filter((rm) => rm.id !== id));
  };

  const handleDuplicateRawMaterial = (row: RawMaterialCostRow) => {
    setRawMaterials([
      ...rawMaterials,
      { ...row, id: `rm-${Date.now()}-${Math.floor(Math.random() * 1000)}`, itemName: `${row.itemName} (Copy)` }
    ]);
  };

  // Dynamic Row Handlers for Process
  const handleAddProcess = (presetName?: string, defaultBasis: CostBasis = 'per_piece') => {
    const procName = presetName || 'Printing';
    const isSheetBased = defaultBasis === 'per_sheet' || procName.toLowerCase().includes('printing') || procName.toLowerCase().includes('lamination');
    const newRow: ProcessCostRow = {
      id: `proc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      processName: procName,
      quantity: isSheetBased ? costingResult.requiredSheets : costingResult.calculationQuantityPcs,
      cost: 0,
      costBasis: isSheetBased ? 'per_sheet' : defaultBasis
    };
    setProcesses([...processes, newRow]);
  };

  const handleUpdateProcess = (id: string, updates: Partial<ProcessCostRow>) => {
    setProcesses(
      processes.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          // If user switches basis to per_sheet, automatically align quantity to required sheets if desired
          if (updates.costBasis === 'per_sheet' && p.costBasis !== 'per_sheet') {
            updated.quantity = costingResult.requiredSheets;
          } else if (updates.costBasis === 'per_piece' && p.costBasis === 'per_sheet') {
            updated.quantity = costingResult.calculationQuantityPcs;
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleDeleteProcess = (id: string) => {
    setProcesses(processes.filter((p) => p.id !== id));
  };

  const handleDuplicateProcess = (row: ProcessCostRow) => {
    setProcesses([
      ...processes,
      { ...row, id: `proc-${Date.now()}`, processName: `${row.processName} (Copy)` }
    ]);
  };

  // Dynamic Row Handlers for Other Costs
  const handleAddOtherCost = () => {
    const newRow: OtherCostRow = {
      id: `oc-${Date.now()}`,
      costHead: 'Miscellaneous Cost',
      method: 'fixed',
      value: 0,
      base: 'manufacturing'
    };
    setOtherCosts([...otherCosts, newRow]);
  };

  const handleUpdateOtherCost = (id: string, updates: Partial<OtherCostRow>) => {
    setOtherCosts(
      otherCosts.map((oc) => (oc.id === id ? { ...oc, ...updates } : oc))
    );
  };

  const handleDeleteOtherCost = (id: string) => {
    setOtherCosts(otherCosts.filter((oc) => oc.id !== id));
  };

  // Save Costing
  const handleSaveCosting = (status: 'Draft' | 'Pending Approval' | 'Approved' = 'Draft') => {
    if (!productName || calculationQuantity <= 0) {
      showToast('Please select a valid product and enter calculation quantity.', 'error');
      return;
    }

    const record = {
      costingId,
      version: costingVersion,
      productId: selectedProductId,
      productCode,
      productName,
      productCategory,
      productUnit,
      productWidth,
      productHeight,
      calculationQuantity,
      quantityUnit,
      ups,
      currency,
      exchangeRate,
      rawMaterials,
      processes,
      overheadMethod,
      overheadValue,
      overheadBase,
      adminMethod,
      adminValue,
      adminBase,
      transportMethod,
      transportValue,
      transportBase,
      otherCosts,
      sellingPriceMethod,
      markupOrMarginPercent,
      manualSellingPrice,
      results: costingResult,
      approvalStatus: status,
      createdBy: userProfile?.displayName || userProfile?.email || 'System User',
      createdAt: new Date().toISOString()
    };

    if (onSaveCosting) {
      onSaveCosting(record);
    }
    setApprovalStatus(status);
    showToast(`Product Costing ${costingId} v${costingVersion} saved successfully as ${status}!`, 'success');
  };

  const handleSaveAsNewVersion = () => {
    const newVersion = costingVersion + 1;
    const newCostingId = `PC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    setCostingVersion(newVersion);
    setCostingId(newCostingId);
    setApprovalStatus('Draft');
    showToast(`Created new costing version v${newVersion} (${newCostingId})`, 'info');
  };

  // Print & Export
  const handlePrint = () => {
    printElement('printable-product-costing', { title: `Costing_${costingId}_v${costingVersion}` });
  };

  const handleExportCSV = () => {
    const csvLines = [
      `Costing ID,Product Code,Product Name,Quantity,Unit,UPS,Required Sheets,Total Cost BDT,Total Cost USD,Selling Price USD,Selling Price BDT,Sales Price/Pc USD,Sales Price/Pc BDT,Cost/Pc BDT,Profit USD,Profit Margin %,Exchange Rate`,
      `${costingId},${productCode},"${productName}",${calculationQuantity},${quantityUnit},${ups},${costingResult.requiredSheets},${costingResult.bdtTotalCost.toFixed(2)},${costingResult.usdTotalCost.toFixed(2)},${costingResult.usdSellingPrice.toFixed(2)},${costingResult.bdtSellingPrice.toFixed(2)},${costingResult.usdSellingPricePerPiece.toFixed(4)},${costingResult.bdtSellingPricePerPiece.toFixed(4)},${costingResult.bdtCostPerPiece.toFixed(4)},${costingResult.usdProfitAmount.toFixed(2)},${costingResult.profitMarginPercent.toFixed(2)}%,${exchangeRate}`
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Costing_${costingId}_v${costingVersion}.csv`;
    a.click();
    showToast('Exported Costing to CSV', 'success');
  };

  const filteredItems = items.filter(
    (i) =>
      i.itemName?.toLowerCase().includes(productSearch.toLowerCase()) ||
      i.itemCode?.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 bg-neutral-50/50 p-2 sm:p-6 rounded-2xl">
      {/* Top Header & Quick Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calculator className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900">Product Costing Calculation</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                  Version {costingVersion}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    approvalStatus === 'Approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : approvalStatus === 'Pending Approval'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                  }`}
                >
                  {approvalStatus}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Calculate complete manufacturing cost, overheads, processes, and optimal selling prices.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSaveCosting('Draft')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 transition-all shadow-sm"
          >
            <Save className="w-4 h-4 text-neutral-500" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={() => handleSaveCosting('Pending Approval')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit for Approval</span>
          </button>

          <button
            onClick={handleSaveAsNewVersion}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span>New Version</span>
          </button>

          <button
            onClick={handlePrint}
            className="p-2 rounded-xl border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-all"
            title="Print Costing Sheet"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCSV}
            className="p-2 rounded-xl border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-all cursor-pointer"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div id="printable-product-costing" className="printable-doc space-y-6">
        {/* 1. PRODUCT SELECTION & CONFIGURATION BAR */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">1. Product & Production Sheet Specification</h2>
          </div>
          <span className="text-xs text-neutral-400 font-mono">ID: {costingId}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Product Selector */}
          <div className="relative">
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Product <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-left text-xs font-semibold text-neutral-800 hover:border-indigo-500 focus:outline-none transition-all"
            >
              <div className="truncate">
                <span className="font-bold text-indigo-600 mr-2">[{productCode}]</span>
                <span>{productName}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            </button>

            {isProductDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search product code/name..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectProduct(item)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 text-xs flex justify-between items-center transition-all"
                    >
                      <div>
                        <div className="font-bold text-neutral-800">{item.itemName || item.name}</div>
                        <div className="text-[10px] text-neutral-500">{item.itemCode || item.code} • {item.category || 'General'}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        UPS: {item.ups || 1}
                      </span>
                    </button>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="text-center py-3 text-xs text-neutral-400">No items found in Product Master</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Product Code & Category Info Display */}
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 flex flex-col justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Product Meta</span>
            <div className="text-xs font-bold text-neutral-800 truncate mt-0.5">{productCategory}</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
              Unit: {productUnit} | Size: {productWidth}" x {productHeight}"
            </div>
          </div>

          {/* Calculation Quantity Entry */}
          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-1">
            <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
              Calculation Quantity
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={calculationQuantity}
                onChange={(e) => setCalculationQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-indigo-200 rounded-lg text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value as QuantityUnit)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-indigo-200 rounded-lg text-indigo-900 focus:outline-none"
              >
                <option value="pcs">Pieces</option>
                <option value="dozen">Dozen</option>
                <option value="100_pcs">100 Pcs</option>
                <option value="1000_pcs">1,000 Pcs</option>
                <option value="sheet">Sheets</option>
              </select>
            </div>
          </div>

          {/* UPS & Required Sheet Auto-Calculation */}
          <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">UPS & Sheet Info</span>
              <button
                type="button"
                onClick={handleSyncAllQuantities}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-all"
                title="Synchronize required sheet count with all sheet-based raw materials and process quantities"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Auto-Sync Qty</span>
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-20">
                <label className="text-[9px] font-semibold text-neutral-500 block">UPS (Pcs/Sheet)</label>
                <input
                  type="number"
                  min="1"
                  value={ups}
                  onChange={(e) => {
                    const newUps = Math.max(1, parseInt(e.target.value) || 1);
                    setUps(newUps);
                  }}
                  className="w-full px-2 py-1 text-xs font-bold bg-white border border-amber-200 rounded text-neutral-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex-1 text-right">
                <span className="text-[10px] font-semibold text-neutral-500 block">Required Sheets</span>
                <span className="text-sm font-extrabold text-amber-900">
                  {costingResult.requiredSheets.toLocaleString()} Sheets
                </span>
                <span className="text-[10px] text-amber-700 block">
                  ({(costingResult.requiredSheets * ups).toLocaleString()} Pcs yield)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Currency & Conversion Rate Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-neutral-100 bg-gradient-to-r from-emerald-50/60 via-indigo-50/40 to-neutral-50 p-3.5 rounded-xl border border-neutral-200/80">
          <div className="flex flex-wrap items-center gap-4">
            {/* Sales Currency Selector */}
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-neutral-800">Sales / Quote Currency:</span>
              <div className="inline-flex rounded-lg border border-neutral-300 p-0.5 bg-white shadow-xs">
                {(['USD', 'BDT', 'EUR', 'GBP'] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      currency === curr
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    }`}
                  >
                    {curr === 'USD' ? '$ USD' : curr === 'BDT' ? '৳ BDT' : curr === 'EUR' ? '€ EUR' : '£ GBP'}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversion Rate Input */}
            <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-lg border border-neutral-300 shadow-2xs">
              <span className="font-semibold text-neutral-600">
                1 {currency === 'BDT' ? 'USD' : currency} =
              </span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                className="w-20 px-2 py-0.5 bg-neutral-50 border border-neutral-300 rounded font-black text-neutral-900 text-center focus:bg-white focus:outline-emerald-600"
              />
              <span className="font-bold text-neutral-800">BDT</span>
              
              {/* Quick Presets */}
              <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-neutral-200">
                {[120, 122, 125].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setExchangeRate(rate)}
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                      exchangeRate === rate
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] text-neutral-500 italic hidden md:inline">
              (Costs calculated in ৳ BDT; Sales quote converts to {currency})
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-neutral-600">
            <div>
              Batch: <span className="font-bold text-neutral-900">{costingResult.calculationQuantityPcs.toLocaleString()} Pcs</span>
            </div>
            <div>
              Sheets: <span className="font-bold text-amber-900">{costingResult.requiredSheets.toLocaleString()} Sheets</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. RAW MATERIAL COST SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">2. Raw Material Costing</h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Select raw materials from store inventory to auto-populate previous purchase rates and auto-calculate required sheet consumption.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncAllQuantities}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-all"
              title="Sync Sheet Consumption with Required Sheets"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Sheets</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddRawMaterial()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Raw Material</span>
            </button>
          </div>
        </div>

        {/* Raw Material Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Raw Material / Store Item</th>
                <th className="py-2.5 px-3 text-right">Consumption</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3 text-right">Rate / Unit (৳ BDT)</th>
                <th className="py-2.5 px-3">Rate Basis</th>
                <th className="py-2.5 px-3">Price Source</th>
                <th className="py-2.5 px-3 text-right">Cost / Pc (৳)</th>
                <th className="py-2.5 px-3 text-right font-bold text-neutral-900">Total Price (৳ BDT)</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rawMaterials.map((rm, idx) => {
                const rowTotal = costingResult.rawMaterialTotals.find((r) => r.id === rm.id)?.total || 0;
                const rowPerPcs = costingResult.calculationQuantityPcs > 0 ? rowTotal / costingResult.calculationQuantityPcs : 0;
                const isSearchActive = activeMaterialSearchRowId === rm.id;

                const filteredMaterials = items.filter((it) => {
                  if (!materialSearchQuery) return true;
                  const q = materialSearchQuery.toLowerCase();
                  return (
                    (it.name && it.name.toLowerCase().includes(q)) ||
                    (it.itemName && it.itemName.toLowerCase().includes(q)) ||
                    (it.sku && it.sku.toLowerCase().includes(q)) ||
                    (it.itemCode && it.itemCode.toLowerCase().includes(q)) ||
                    (it.category && it.category.toLowerCase().includes(q))
                  );
                });

                return (
                  <tr key={rm.id} className="hover:bg-neutral-50/80 transition-all">
                    <td className="py-2.5 px-3 font-semibold text-neutral-400">{idx + 1}</td>

                    {/* Material Item Name + Searchable Inventory Dropdown */}
                    <td className="py-2.5 px-3 min-w-[280px]">
                      <div className="space-y-1 relative">
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={rm.itemName}
                            onChange={(e) => handleUpdateRawMaterial(rm.id, { itemName: e.target.value })}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Type material or select from inventory..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMaterialSearchRowId(isSearchActive ? null : rm.id);
                              setMaterialSearchQuery('');
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all ${
                              isSearchActive
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                            }`}
                            title="Browse ERP Inventory Items"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Select</span>
                          </button>
                        </div>

                        {/* Searchable Picker Popover */}
                        {isSearchActive && (
                          <div className="absolute top-full left-0 w-80 z-40 bg-white border border-neutral-200 rounded-xl shadow-2xl p-3 space-y-2 mt-1">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search material by name or SKU..."
                                value={materialSearchQuery}
                                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="max-h-52 overflow-y-auto divide-y divide-neutral-100">
                              {filteredMaterials.map((it) => {
                                const itemPrice = it.avgCost || it.lastPurchasePrice || it.unitPrice || it.price || 0;
                                return (
                                  <button
                                    key={it.id}
                                    type="button"
                                    onClick={() => handleSelectRawMaterialItem(rm.id, it)}
                                    className="w-full text-left p-2 hover:bg-indigo-50/80 rounded-lg text-xs transition-all flex justify-between items-center"
                                  >
                                    <div className="pr-2">
                                      <div className="font-bold text-neutral-900 truncate">
                                        {it.name || it.itemName}
                                      </div>
                                      <div className="text-[10px] text-neutral-500 font-mono">
                                        {it.sku || it.itemCode || 'SKU'} • {it.category || 'General'}
                                      </div>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                      <div className="font-extrabold text-indigo-700">
                                        ৳ {Number(itemPrice).toFixed(2)}
                                      </div>
                                      <div className="text-[10px] text-neutral-400">
                                        {it.currentStock !== undefined ? `${it.currentStock} ${it.unit || 'unit'}` : it.unit || 'Sheet'}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                              {filteredMaterials.length === 0 && (
                                <div className="py-4 text-center text-xs text-neutral-400">
                                  No matching items found in inventory
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Last supplier/purchase rate badge */}
                        {rm.lastSupplierName && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium truncate">
                            <span>Auto Rate: ৳ {rm.previousPrice || rm.price}</span>
                            <span className="text-neutral-400">•</span>
                            <span className="truncate">{rm.lastSupplierName}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Consumption */}
                    <td className="py-2.5 px-3 min-w-[95px]">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rm.consumption}
                        onChange={(e) => handleUpdateRawMaterial(rm.id, { consumption: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-right text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3 min-w-[95px]">
                      <select
                        value={rm.unit}
                        onChange={(e) => {
                          const newUnit = e.target.value as UOMUnit;
                          const isSheet = newUnit === 'Sheet';
                          handleUpdateRawMaterial(rm.id, {
                            unit: newUnit,
                            priceBasis: isSheet ? 'per_sheet' : rm.priceBasis === 'per_sheet' ? 'per_piece' : rm.priceBasis
                          });
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700"
                      >
                        <option value="Sheet">Sheet</option>
                        <option value="Piece">Piece</option>
                        <option value="Kg">Kg</option>
                        <option value="Gram">Gram</option>
                        <option value="Meter">Meter</option>
                        <option value="Yard">Yard</option>
                        <option value="Dozen">Dozen</option>
                        <option value="Box">Box</option>
                        <option value="Liter">Liter</option>
                        <option value="Set">Set</option>
                      </select>
                    </td>

                    {/* Rate / Price (BDT) */}
                    <td className="py-2.5 px-3 min-w-[100px]">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rm.price}
                        onChange={(e) =>
                          handleUpdateRawMaterial(rm.id, {
                            price: parseFloat(e.target.value) || 0,
                            priceSource: 'manual'
                          })
                        }
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-right text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Price Basis */}
                    <td className="py-2.5 px-3 min-w-[110px]">
                      <select
                        value={rm.priceBasis}
                        onChange={(e) => handleUpdateRawMaterial(rm.id, { priceBasis: e.target.value as CostBasis })}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700"
                      >
                        <option value="per_sheet">Per Sheet</option>
                        <option value="per_piece">Per Piece</option>
                        <option value="per_dozen">Per Dozen</option>
                        <option value="per_100">Per 100</option>
                        <option value="per_1000">Per 1,000</option>
                        <option value="per_kg">Per Kg</option>
                        <option value="fixed">Fixed Lot</option>
                      </select>
                    </td>

                    {/* Price Source Toggle */}
                    <td className="py-2.5 px-3 min-w-[110px]">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateRawMaterial(rm.id, { priceSource: 'previous' })}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rm.priceSource === 'previous'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                          }`}
                        >
                          ERP Rate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRawMaterial(rm.id, { priceSource: 'manual' })}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rm.priceSource === 'manual'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                          }`}
                        >
                          Manual
                        </button>
                      </div>
                    </td>

                    {/* Cost / Pc (BDT) */}
                    <td className="py-2.5 px-3 text-right font-medium text-neutral-600 min-w-[80px]">
                      ৳ {rowPerPcs.toFixed(4)}
                    </td>

                    {/* Total Row Amount (BDT) */}
                    <td className="py-2.5 px-3 text-right font-extrabold text-neutral-900 min-w-[110px]">
                      ৳ {rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center min-w-[80px]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDuplicateRawMaterial(rm)}
                          className="p-1 text-neutral-400 hover:text-indigo-600 transition-all"
                          title="Duplicate row"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRawMaterial(rm.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600 transition-all"
                          title="Delete row"
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

        {/* Raw Material Summary Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-100 bg-neutral-50 p-4 rounded-xl">
          <div className="text-xs font-semibold text-neutral-600">
            Total Raw Materials: <span className="font-bold text-neutral-900">{rawMaterials.length} Items</span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Material Cost / Piece</span>
              <span className="font-extrabold text-neutral-800">
                ৳ {costingResult.rawMaterialCostPerPcs.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Total Raw Material Cost ({calculationQuantity} {quantityUnit})</span>
              <span className="text-base font-extrabold text-indigo-700">
                ৳ {costingResult.totalRawMaterialCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PROCESS COST SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">3. Process Costing</h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Enter process rates (Printing, Lamination, Die Cutting, etc.). Quantities automatically scale with required sheets or production pieces.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncAllQuantities}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-all"
              title="Sync Process Quantities"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Quantities</span>
            </button>
            <button
              onClick={() => handleAddProcess()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Process</span>
            </button>
          </div>
        </div>

        {/* Quick Add Presets Bar */}
        <div className="flex flex-wrap items-center gap-1.5 py-1 text-xs">
          <span className="text-neutral-400 font-semibold mr-1 text-[11px]">Quick Add:</span>
          {[
            { name: 'Offset Printing (4 Color)', basis: 'per_sheet' as CostBasis },
            { name: 'Matt / Gloss Lamination', basis: 'per_sheet' as CostBasis },
            { name: 'UV Spot Coating', basis: 'per_sheet' as CostBasis },
            { name: 'Die Cutting / Punching', basis: 'per_piece' as CostBasis },
            { name: 'Gold / Silver Foiling', basis: 'per_piece' as CostBasis },
            { name: 'Auto Pasting / Gluing', basis: 'per_piece' as CostBasis },
            { name: 'QC & Packaging', basis: 'per_piece' as CostBasis }
          ].map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleAddProcess(preset.name, preset.basis)}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-[11px] transition-all"
            >
              + {preset.name}
            </button>
          ))}
        </div>

        {/* Process Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Process Name</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3">Cost Basis</th>
                <th className="py-2.5 px-3 text-right">Unit Rate (৳ BDT)</th>
                <th className="py-2.5 px-3 text-right">Cost / Pc (৳)</th>
                <th className="py-2.5 px-3 text-right font-bold text-neutral-900">Total Process Cost (৳ BDT)</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {processes.map((proc, idx) => {
                const rowTotal = costingResult.processTotals.find((p) => p.id === proc.id)?.total || 0;
                const rowPerPcs = costingResult.calculationQuantityPcs > 0 ? rowTotal / costingResult.calculationQuantityPcs : 0;
                const isSheetBasis = proc.costBasis === 'per_sheet';

                return (
                  <tr key={proc.id} className="hover:bg-neutral-50/80 transition-all">
                    <td className="py-2.5 px-3 font-semibold text-neutral-400">{idx + 1}</td>

                    {/* Process Name dropdown + text */}
                    <td className="py-2.5 px-3 min-w-[240px]">
                      <div className="flex gap-1">
                        <select
                          value={COMMON_PROCESS_TEMPLATES.includes(proc.processName) ? proc.processName : 'Custom'}
                          onChange={(e) => {
                            if (e.target.value !== 'Custom') {
                              const isSheetTmpl = e.target.value.toLowerCase().includes('printing') || e.target.value.toLowerCase().includes('lamination');
                              handleUpdateProcess(proc.id, {
                                processName: e.target.value,
                                costBasis: isSheetTmpl ? 'per_sheet' : proc.costBasis,
                                quantity: isSheetTmpl ? costingResult.requiredSheets : proc.quantity
                              });
                            }
                          }}
                          className="px-2 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700"
                        >
                          {COMMON_PROCESS_TEMPLATES.map((tmpl) => (
                            <option key={tmpl} value={tmpl}>
                              {tmpl}
                            </option>
                          ))}
                          <option value="Custom">Custom...</option>
                        </select>
                        <input
                          type="text"
                          value={proc.processName}
                          onChange={(e) => handleUpdateProcess(proc.id, { processName: e.target.value })}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-800 focus:ring-1 focus:ring-indigo-500"
                          placeholder="Process name..."
                        />
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-2.5 px-3 min-w-[110px]">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={proc.quantity}
                          onChange={(e) => handleUpdateProcess(proc.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-right text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">
                          {isSheetBasis ? 'Sht' : 'Pcs'}
                        </span>
                      </div>
                    </td>

                    {/* Cost Basis */}
                    <td className="py-2.5 px-3 min-w-[120px]">
                      <select
                        value={proc.costBasis}
                        onChange={(e) => handleUpdateProcess(proc.id, { costBasis: e.target.value as CostBasis })}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700"
                      >
                        <option value="per_sheet">Per Sheet</option>
                        <option value="per_piece">Per Piece</option>
                        <option value="per_dozen">Per Dozen</option>
                        <option value="per_100">Per 100</option>
                        <option value="per_1000">Per 1,000</option>
                        <option value="per_kg">Per Kg</option>
                        <option value="per_hour">Per Hour</option>
                        <option value="per_lot">Per Lot</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </td>

                    {/* Unit Cost */}
                    <td className="py-2.5 px-3 min-w-[100px]">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={proc.cost}
                        onChange={(e) => handleUpdateProcess(proc.id, { cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-right text-neutral-900 focus:ring-1 focus:ring-indigo-500"
                        placeholder="0.00"
                      />
                    </td>

                    {/* Cost / Pc */}
                    <td className="py-2.5 px-3 text-right font-medium text-neutral-500 min-w-[80px]">
                      ৳ {rowPerPcs.toFixed(4)}
                    </td>

                    {/* Total Row Amount */}
                    <td className="py-2.5 px-3 text-right font-extrabold text-neutral-900 min-w-[110px]">
                      ৳ {rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center min-w-[80px]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDuplicateProcess(proc)}
                          className="p-1 text-neutral-400 hover:text-indigo-600 transition-all"
                          title="Duplicate process"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProcess(proc.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600 transition-all"
                          title="Delete process"
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

        {/* Process Cost Summary Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-100 bg-neutral-50 p-4 rounded-xl">
          <div className="text-xs font-semibold text-neutral-600">
            Total Processes: <span className="font-bold text-neutral-900">{processes.length} Processes</span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Manufacturing Total (Mat + Process)</span>
              <span className="font-extrabold text-neutral-900">
                ৳ {costingResult.manufacturingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">Total Process Cost</span>
              <span className="text-base font-extrabold text-indigo-700">
                ৳ {costingResult.totalProcessCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. OVERHEADS, ADMINISTRATIVE, TRANSPORT & OTHER COSTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fixed Overhead Head Configs */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">4. Overhead, Admin & Transport Costs</h2>
          </div>

          <div className="space-y-4 text-xs">
            {/* Overhead Cost Row */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-neutral-800">Factory Overhead</span>
                <span className="text-[10px] text-neutral-400 block">Utilities, maintenance & factory burden</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={overheadMethod}
                  onChange={(e) => setOverheadMethod(e.target.value as 'percentage' | 'fixed')}
                  className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-semibold"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={overheadValue}
                  onChange={(e) => setOverheadValue(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-white border border-neutral-300 rounded text-right font-bold"
                />
                <span className="font-extrabold text-indigo-700 min-w-[70px] text-right">
                  ৳ {costingResult.overheadCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Admin Cost Row */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-neutral-800">Office & Administrative</span>
                <span className="text-[10px] text-neutral-400 block">Office salaries, rent & management overhead</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={adminMethod}
                  onChange={(e) => setAdminMethod(e.target.value as 'percentage' | 'fixed')}
                  className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-semibold"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={adminValue}
                  onChange={(e) => setAdminValue(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-white border border-neutral-300 rounded text-right font-bold"
                />
                <span className="font-extrabold text-indigo-700 min-w-[70px] text-right">
                  ৳ {costingResult.adminCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Transport Cost Row */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-neutral-800">Transport & Handling</span>
                <span className="text-[10px] text-neutral-400 block">Freight, cartage & delivery expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={transportMethod}
                  onChange={(e) => setTransportMethod(e.target.value as 'percentage' | 'fixed')}
                  className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-semibold"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={transportValue}
                  onChange={(e) => setTransportValue(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-white border border-neutral-300 rounded text-right font-bold"
                />
                <span className="font-extrabold text-indigo-700 min-w-[70px] text-right">
                  ৳ {costingResult.transportCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Other Costs */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">5. Other Costs / Sales Commissions</h2>
            </div>
            <button
              onClick={handleAddOtherCost}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Other Cost</span>
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {otherCosts.map((oc, index) => {
              const rowAmt = costingResult.otherCostsBreakdown[index]?.amount || 0;
              return (
                <div key={oc.id} className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between gap-2 text-xs">
                  <input
                    type="text"
                    value={oc.costHead}
                    onChange={(e) => handleUpdateOtherCost(oc.id, { costHead: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white border border-neutral-200 rounded font-semibold text-neutral-800"
                    placeholder="Cost Head..."
                  />
                  <select
                    value={oc.method}
                    onChange={(e) => handleUpdateOtherCost(oc.id, { method: e.target.value as 'percentage' | 'fixed' })}
                    className="px-2 py-1 bg-white border border-neutral-200 rounded font-semibold"
                  >
                    <option value="percentage">% Percentage</option>
                    <option value="fixed">Fixed</option>
                  </select>

                  {oc.method === 'percentage' && (
                    <select
                      value={oc.base}
                      onChange={(e) => handleUpdateOtherCost(oc.id, { base: e.target.value as CalculationBase })}
                      className="px-2 py-1 bg-white border border-neutral-200 rounded font-semibold text-[11px]"
                    >
                      <option value="manufacturing">Of Mfg Cost</option>
                      <option value="raw_material">Of Raw Mat</option>
                      <option value="process">Of Process</option>
                      <option value="sales_value">Of Sales Value</option>
                    </select>
                  )}

                  <input
                    type="number"
                    step="0.1"
                    value={oc.value}
                    onChange={(e) => handleUpdateOtherCost(oc.id, { value: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 bg-white border border-neutral-200 rounded text-right font-bold"
                  />

                  <span className="font-extrabold text-neutral-900 min-w-[60px] text-right">
                    ৳ {rowAmt.toFixed(2)}
                  </span>

                  <button
                    onClick={() => handleDeleteOtherCost(oc.id)}
                    className="p-1 text-neutral-400 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-neutral-100 text-xs">
            <span className="font-semibold text-neutral-600">Total Other Costs:</span>
            <span className="font-extrabold text-indigo-700">
              ৳ {costingResult.totalOtherCost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 5. SELLING PRICE & PROFIT MARGIN ENGINE */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-neutral-900 text-white p-6 rounded-2xl shadow-lg space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-700/50">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h2 className="text-base font-extrabold uppercase tracking-wide">6. Selling Price & Profit Calculation</h2>
            </div>
            <p className="text-xs text-indigo-200 mt-1">
              Set target profit margins and markup methods to resolve optimal market selling price.
            </p>
          </div>

          {/* Pricing Method Selector */}
          <div className="flex items-center gap-2 bg-indigo-950/60 p-1.5 rounded-xl border border-indigo-700/60">
            <button
              type="button"
              onClick={() => setSellingPriceMethod('cost_plus_markup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sellingPriceMethod === 'cost_plus_markup' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-300 hover:text-white'
              }`}
            >
              Cost + Markup %
            </button>
            <button
              type="button"
              onClick={() => setSellingPriceMethod('percentage_sales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sellingPriceMethod === 'percentage_sales' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-300 hover:text-white'
              }`}
            >
              Margin % on Sales
            </button>
            <button
              type="button"
              onClick={() => setSellingPriceMethod('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sellingPriceMethod === 'manual' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-300 hover:text-white'
              }`}
            >
              Manual Selling Price
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Margin/Markup Input */}
          <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-indigo-200">
              {sellingPriceMethod === 'cost_plus_markup'
                ? 'Markup Percentage (%)'
                : sellingPriceMethod === 'percentage_sales'
                ? 'Profit Margin % on Sales'
                : 'Manual Target Selling Price'}
            </label>

            {sellingPriceMethod !== 'manual' ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={markupOrMarginPercent}
                  onChange={(e) => setMarkupOrMarginPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white text-neutral-900 font-extrabold text-lg rounded-xl focus:outline-none"
                />
                <span className="text-xl font-bold">%</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={manualSellingPrice}
                  onChange={(e) => setManualSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white text-neutral-900 font-extrabold text-lg rounded-xl focus:outline-none"
                />
                <span className="text-xs font-bold">{currency}</span>
              </div>
            )}
            <p className="text-[10px] text-indigo-300">
              {sellingPriceMethod === 'cost_plus_markup'
                ? 'Adds markup % on top of total manufacturing & overhead cost (in ৳ BDT).'
                : sellingPriceMethod === 'percentage_sales'
                ? 'Calculates selling price so profit is exact % of total sales value.'
                : `Enter fixed total selling price in ${currency} manually.`}
            </p>
          </div>

          {/* Calculated Selling Price - Dual Currency */}
          <div className="bg-emerald-500/20 p-4 rounded-xl border border-emerald-500/30 flex flex-col justify-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 block">
              Total Selling Price / Sales Value
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-emerald-400">
                {costingResult.currencySymbol} {costingResult.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </span>
              <span className="text-sm font-extrabold text-emerald-200">
                (৳ {costingResult.bdtSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT)
              </span>
            </div>
            <div className="text-xs font-semibold text-emerald-200 flex items-center gap-3 flex-wrap pt-0.5">
              <span>Sales Rate / Pc: <strong className="text-white">{costingResult.currencySymbol} {costingResult.sellingPricePerPiece.toFixed(4)} {currency}</strong></span>
              <span className="text-emerald-300/80">|</span>
              <span>BDT / Pc: <strong className="text-white">৳ {costingResult.bdtSellingPricePerPiece.toFixed(4)}</strong></span>
            </div>
          </div>

          {/* Calculated Profit & Margin - Dual Currency */}
          <div className="bg-amber-500/20 p-4 rounded-xl border border-amber-500/30 flex flex-col justify-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block">
              Net Profit & Margin
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-amber-400">
                {costingResult.currencySymbol} {costingResult.profitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </span>
              <span className="text-sm font-extrabold text-amber-200">
                (৳ {costingResult.bdtProfitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT)
              </span>
            </div>
            <div className="text-xs font-semibold text-amber-200 flex items-center gap-3 pt-0.5">
              <span>Profit Margin: <strong className="text-white text-sm">{costingResult.profitMarginPercent.toFixed(2)}%</strong></span>
              <span className="text-amber-300/60 text-[10px]">(@ 1 {currency === 'BDT' ? 'USD' : currency} = ৳{exchangeRate})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. FINAL COST SUMMARY & PER QUANTITY BREAKDOWN */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">7. Final Costing & Quotation Summary</h2>
          </div>
          <span className="text-xs text-neutral-500 font-semibold">
            Calculation Order Batch: <span className="text-indigo-900 font-bold">{calculationQuantity} {quantityUnit} ({costingResult.calculationQuantityPcs.toLocaleString()} Pcs)</span>
          </span>
        </div>

        {/* Executive Commercial Highlights Banner (Dual Currency) */}
        <div className="p-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-neutral-900 rounded-2xl text-white shadow-md space-y-4 border border-indigo-900/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Total Quotation / Sales Value ({calculationQuantity} {quantityUnit})
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-500/30">
                  Dual Currency Active (1 {currency === 'BDT' ? 'USD' : currency} = ৳{exchangeRate})
                </span>
              </div>
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <div className="text-3xl font-black text-white">
                  {costingResult.currencySymbol} {costingResult.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg font-bold text-emerald-400">{currency}</span>
                </div>
                <div className="text-xl font-bold text-neutral-300">
                  / ৳ {costingResult.bdtSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-neutral-400">BDT</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-[10px] text-neutral-300 block font-semibold uppercase">Total Batch Cost (BDT Base)</span>
                <span className="text-base font-extrabold text-neutral-100">
                  ৳ {costingResult.bdtTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-neutral-400 block font-medium">
                  ({costingResult.currencySymbol} {costingResult.totalCost.toFixed(2)} {currency})
                </span>
              </div>
              <div className="bg-emerald-500/20 px-3.5 py-2 rounded-xl border border-emerald-500/30">
                <span className="text-[10px] text-emerald-300 block font-semibold uppercase">Net Batch Profit</span>
                <span className="text-base font-black text-emerald-400">
                  {costingResult.currencySymbol} {costingResult.profitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                </span>
                <span className="text-[10px] text-emerald-200 block font-medium">
                  (৳ {costingResult.bdtProfitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT)
                </span>
              </div>
              <div className="bg-amber-500/20 px-3.5 py-2 rounded-xl border border-amber-500/30">
                <span className="text-[10px] text-amber-300 block font-semibold uppercase">Profit Margin</span>
                <span className="text-base font-black text-amber-300">
                  {costingResult.profitMarginPercent.toFixed(2)}%
                </span>
                <span className="text-[10px] text-amber-200 block font-medium">
                  Net Return
                </span>
              </div>
            </div>
          </div>

          {/* Unit Commercial Rates Grid (Dual Currency: Selected Currency & BDT) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            {/* Sales / Piece */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
              <span className="text-[10px] text-indigo-200 block uppercase font-bold">Sales / Piece</span>
              <div className="text-base font-extrabold text-white">
                {costingResult.currencySymbol} {costingResult.sellingPricePerPiece.toFixed(4)} <span className="text-[11px] font-semibold text-emerald-400">{currency}</span>
              </div>
              <div className="text-xs font-bold text-neutral-300 mt-0.5">
                ৳ {costingResult.bdtSellingPricePerPiece.toFixed(4)} BDT
              </div>
              <span className="text-[9px] text-neutral-400 block mt-1 pt-1 border-t border-white/10">
                Cost: ৳ {costingResult.bdtCostPerPiece.toFixed(4)}
              </span>
            </div>

            {/* Sales / Dozen */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
              <span className="text-[10px] text-indigo-200 block uppercase font-bold">Sales / Dozen</span>
              <div className="text-base font-extrabold text-white">
                {costingResult.currencySymbol} {costingResult.sellingPricePerDozen.toFixed(3)} <span className="text-[11px] font-semibold text-emerald-400">{currency}</span>
              </div>
              <div className="text-xs font-bold text-neutral-300 mt-0.5">
                ৳ {costingResult.bdtSellingPricePerDozen.toFixed(2)} BDT
              </div>
              <span className="text-[9px] text-neutral-400 block mt-1 pt-1 border-t border-white/10">
                Cost: ৳ {costingResult.bdtCostPerDozen.toFixed(2)}
              </span>
            </div>

            {/* Sales / 100 Pcs */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
              <span className="text-[10px] text-indigo-200 block uppercase font-bold">Sales / 100 Pcs</span>
              <div className="text-base font-extrabold text-white">
                {costingResult.currencySymbol} {costingResult.sellingPricePer100.toFixed(2)} <span className="text-[11px] font-semibold text-emerald-400">{currency}</span>
              </div>
              <div className="text-xs font-bold text-neutral-300 mt-0.5">
                ৳ {costingResult.bdtSellingPricePer100.toFixed(2)} BDT
              </div>
              <span className="text-[9px] text-neutral-400 block mt-1 pt-1 border-t border-white/10">
                Cost: ৳ {costingResult.bdtCostPer100.toFixed(2)}
              </span>
            </div>

            {/* Sales / 1,000 Pcs */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
              <span className="text-[10px] text-indigo-200 block uppercase font-bold">Sales / 1,000 Pcs</span>
              <div className="text-base font-extrabold text-white">
                {costingResult.currencySymbol} {costingResult.sellingPricePer1000.toFixed(2)} <span className="text-[11px] font-semibold text-emerald-400">{currency}</span>
              </div>
              <div className="text-xs font-bold text-neutral-300 mt-0.5">
                ৳ {costingResult.bdtSellingPricePer1000.toFixed(2)} BDT
              </div>
              <span className="text-[9px] text-neutral-400 block mt-1 pt-1 border-t border-white/10">
                Cost: ৳ {costingResult.bdtCostPer1000.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Manufacturing Cost Breakdown Matrix (BDT Core + USD Reference) */}
        <div>
          <div className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
            Manufacturing Cost Structure (Internal BDT Base)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Cost / Piece</span>
              <div className="text-base font-extrabold text-neutral-900 mt-0.5">
                ৳ {costingResult.bdtCostPerPiece.toFixed(4)}
              </div>
              <span className="text-[10px] text-neutral-500 font-semibold block mt-0.5">
                {costingResult.currencySymbol} {costingResult.costPerPiece.toFixed(4)} {currency}
              </span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Cost / Dozen</span>
              <div className="text-base font-extrabold text-neutral-900 mt-0.5">
                ৳ {costingResult.bdtCostPerDozen.toFixed(2)}
              </div>
              <span className="text-[10px] text-neutral-500 font-semibold block mt-0.5">
                {costingResult.currencySymbol} {costingResult.costPerDozen.toFixed(3)} {currency}
              </span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Cost / 100 Pcs</span>
              <div className="text-base font-extrabold text-neutral-900 mt-0.5">
                ৳ {costingResult.bdtCostPer100.toFixed(2)}
              </div>
              <span className="text-[10px] text-neutral-500 font-semibold block mt-0.5">
                {costingResult.currencySymbol} {costingResult.costPer100.toFixed(2)} {currency}
              </span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Cost / 1,000 Pcs</span>
              <div className="text-base font-extrabold text-neutral-900 mt-0.5">
                ৳ {costingResult.bdtCostPer1000.toFixed(2)}
              </div>
              <span className="text-[10px] text-neutral-500 font-semibold block mt-0.5">
                {costingResult.currencySymbol} {costingResult.costPer1000.toFixed(2)} {currency}
              </span>
            </div>

            <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-center col-span-2 md:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">Total Batch Cost</span>
              <div className="text-base font-black text-indigo-950 mt-0.5">
                ৳ {costingResult.bdtTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-indigo-700 font-semibold block mt-0.5">
                {costingResult.currencySymbol} {costingResult.totalCost.toFixed(2)} {currency}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Cost Breakdown Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
            <span>Cost Distribution Breakdown</span>
            <span>100% Total Selling Value</span>
          </div>

          <div className="h-5 w-full bg-neutral-100 rounded-xl overflow-hidden flex shadow-inner text-[10px] font-bold text-white text-center">
            {costingResult.breakdownPercent.rawMaterial > 0 && (
              <div
                style={{ width: `${costingResult.breakdownPercent.rawMaterial}%` }}
                className="bg-indigo-600 h-full flex items-center justify-center truncate px-1"
                title={`Raw Material: ${costingResult.breakdownPercent.rawMaterial.toFixed(1)}%`}
              >
                Mat {costingResult.breakdownPercent.rawMaterial.toFixed(0)}%
              </div>
            )}

            {costingResult.breakdownPercent.process > 0 && (
              <div
                style={{ width: `${costingResult.breakdownPercent.process}%` }}
                className="bg-blue-500 h-full flex items-center justify-center truncate px-1"
                title={`Process: ${costingResult.breakdownPercent.process.toFixed(1)}%`}
              >
                Proc {costingResult.breakdownPercent.process.toFixed(0)}%
              </div>
            )}

            {costingResult.breakdownPercent.overhead > 0 && (
              <div
                style={{ width: `${costingResult.breakdownPercent.overhead}%` }}
                className="bg-amber-500 h-full flex items-center justify-center truncate px-1"
                title={`Overhead: ${costingResult.breakdownPercent.overhead.toFixed(1)}%`}
              >
                OV {costingResult.breakdownPercent.overhead.toFixed(0)}%
              </div>
            )}

            {costingResult.breakdownPercent.admin > 0 && (
              <div
                style={{ width: `${costingResult.breakdownPercent.admin}%` }}
                className="bg-purple-500 h-full flex items-center justify-center truncate px-1"
                title={`Admin: ${costingResult.breakdownPercent.admin.toFixed(1)}%`}
              >
                Admin {costingResult.breakdownPercent.admin.toFixed(0)}%
              </div>
            )}

            {costingResult.breakdownPercent.transport > 0 && (
              <div
                style={{ width: `${costingResult.breakdownPercent.transport}%` }}
                className="bg-teal-500 h-full flex items-center justify-center truncate px-1"
                title={`Transport: ${costingResult.breakdownPercent.transport.toFixed(1)}%`}
              >
                Tr {costingResult.breakdownPercent.transport.toFixed(0)}%
              </div>
            )}

            {costingResult.breakdownPercent.profit > 0 && (
              <div
                style={{ width: `${costingResult.breakdownPercent.profit}%` }}
                className="bg-emerald-500 h-full flex items-center justify-center truncate px-1"
                title={`Profit: ${costingResult.breakdownPercent.profit.toFixed(1)}%`}
              >
                Profit {costingResult.breakdownPercent.profit.toFixed(0)}%
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] text-neutral-600 font-semibold pt-1">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Raw Material</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Process</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Overhead</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Admin</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Transport</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Profit</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
