import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Search, 
  Ruler, 
  FileText, 
  Sparkles, 
  Maximize2, 
  RotateCw, 
  DollarSign, 
  Save, 
  Printer, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  History, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Package,
  Sliders,
  Scissors,
  Layers,
  Info
} from 'lucide-react';
import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  DimensionUnit, 
  UPSCalculationInput, 
  UPSCalculationResult, 
  calculateUPS, 
  STANDARD_PAPER_PRESETS, 
  STANDARD_MACHINES,
  convertToMm
} from '../../lib/upsCalculator';
import { ImpositionPreview } from './ImpositionPreview';
import { Item, PurchaseOrder, Transaction, UserProfile } from '../../types';

interface ProductUPSCalculatorProps {
  items: Item[];
  purchaseOrders?: PurchaseOrder[];
  transactions?: Transaction[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSavedSuccess?: () => void;
  initialData?: any;
}

interface PurchaseHistoryRecord {
  date: string;
  supplierName: string;
  quantity: number;
  unitPrice: number;
  poNumber?: string;
}

export const ProductUPSCalculator: React.FC<ProductUPSCalculatorProps> = ({
  items,
  purchaseOrders = [],
  transactions = [],
  userProfile,
  showToast,
  onSavedSuccess,
  initialData,
}) => {
  // Product Selection State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);

  // Selected Product Metadata
  const [productName, setProductName] = useState<string>('Hang Tag');
  const [productCode, setProductCode] = useState<string>('HT-001');
  const [productCategory, setProductCategory] = useState<string>('Printed Accessories');

  // Product Size State
  const [productWidth, setProductWidth] = useState<number>(50);
  const [productHeight, setProductHeight] = useState<number>(80);
  const [productUnit, setProductUnit] = useState<DimensionUnit>('mm');

  // Paper Size State
  const [paperPreset, setPaperPreset] = useState<string>('28 × 22 Inch');
  const [paperWidth, setPaperWidth] = useState<number>(28);
  const [paperHeight, setPaperHeight] = useState<number>(22);
  const [paperUnit, setPaperUnit] = useState<DimensionUnit>('inch');

  // Printing Parameters
  const [selectedMachine, setSelectedMachine] = useState<string>('Standard Offset Press (Gripper 10mm)');
  const [gripperMm, setGripperMm] = useState<number>(10);
  const [gapMm, setGapMm] = useState<number>(3);
  const [topBottomMarginMm, setTopBottomMarginMm] = useState<number>(5);
  const [leftRightMarginMm, setLeftRightMarginMm] = useState<number>(5);

  // Pricing & Price Source
  const [previousPurchasePrice, setPreviousPurchasePrice] = useState<number>(2.50);
  const [lastPurchaseDate, setLastPurchaseDate] = useState<string>('10-Aug-2026');
  const [lastSupplierName, setLastSupplierName] = useState<string>('ABC Paper Mills');
  const [priceHistory, setPriceHistory] = useState<PurchaseHistoryRecord[]>([
    { date: '10-Aug-2026', supplierName: 'ABC Paper Mills', quantity: 10000, unitPrice: 2.50, poNumber: 'PO-2026-081' },
    { date: '02-Jun-2026', supplierName: 'XYZ Packaging Supplier', quantity: 5000, unitPrice: 2.40, poNumber: 'PO-2026-042' },
    { date: '15-Apr-2026', supplierName: 'ABC Paper Mills', quantity: 8000, unitPrice: 2.35, poNumber: 'PO-2026-018' },
  ]);

  const [priceSource, setPriceSource] = useState<'previous' | 'manual'>('previous');
  const [manualPrice, setManualPrice] = useState<number>(2.50);
  const [costBasis, setCostBasis] = useState<'per_sheet' | 'per_product'>('per_sheet');
  const [showPriceHistoryTable, setShowPriceHistoryTable] = useState<boolean>(false);

  // Development Costing Breakdown (Expandable)
  const [showCostingBreakdown, setShowCostingBreakdown] = useState<boolean>(false);
  const [paperCost, setPaperCost] = useState<number>(0);
  const [printingCost, setPrintingCost] = useState<number>(0);
  const [plateCost, setPlateCost] = useState<number>(0);
  const [cuttingCost, setCuttingCost] = useState<number>(0);
  const [laminationCost, setLaminationCost] = useState<number>(0);
  const [foilingCost, setFoilingCost] = useState<number>(0);
  const [embossCost, setEmbossCost] = useState<number>(0);
  const [glueCost, setGlueCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);

  // Version & Save State
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [calculationNotes, setCalculationNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load initialData if editing or duplicating
  useEffect(() => {
    if (initialData) {
      if (initialData.productId) setSelectedProductId(initialData.productId);
      if (initialData.productName) setProductName(initialData.productName);
      if (initialData.productCode) setProductCode(initialData.productCode);
      if (initialData.category) setProductCategory(initialData.category);
      if (initialData.productWidth) setProductWidth(initialData.productWidth);
      if (initialData.productHeight) setProductHeight(initialData.productHeight);
      if (initialData.productUnit) setProductUnit(initialData.productUnit);
      if (initialData.paperWidth) setPaperWidth(initialData.paperWidth);
      if (initialData.paperHeight) setPaperHeight(initialData.paperHeight);
      if (initialData.paperUnit) setPaperUnit(initialData.paperUnit);
      if (initialData.paperPreset) setPaperPreset(initialData.paperPreset);
      if (initialData.gripperMm !== undefined) setGripperMm(initialData.gripperMm);
      if (initialData.gapMm !== undefined) setGapMm(initialData.gapMm);
      if (initialData.topBottomMarginMm !== undefined) setTopBottomMarginMm(initialData.topBottomMarginMm);
      if (initialData.leftRightMarginMm !== undefined) setLeftRightMarginMm(initialData.leftRightMarginMm);
      if (initialData.selectedPrice !== undefined) {
        if (initialData.priceSource === 'manual') {
          setPriceSource('manual');
          setManualPrice(initialData.selectedPrice);
        } else {
          setPriceSource('previous');
          setPreviousPurchasePrice(initialData.selectedPrice);
        }
      }
      if (initialData.version) setCurrentVersion(initialData.version);
    }
  }, [initialData]);

  // Filter products for dropdown
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return items.slice(0, 15);
    const term = productSearchTerm.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        i.sku.toLowerCase().includes(term) ||
        (i.description && i.description.toLowerCase().includes(term))
    );
  }, [items, productSearchTerm]);

  // When a product is selected from the list
  const handleSelectProduct = async (item: Item) => {
    setSelectedProductId(item.id);
    setProductName(item.name);
    setProductCode(item.sku);
    setProductCategory(item.unit || 'Accessories');
    setIsProductDropdownOpen(false);

    // Default price from item.avgCost if available
    if (item.avgCost && item.avgCost > 0) {
      setPreviousPurchasePrice(item.avgCost);
      setManualPrice(item.avgCost);
    }

    // Try to extract purchase price history from purchaseOrders & transactions
    try {
      const history: PurchaseHistoryRecord[] = [];

      // Look in purchase orders
      purchaseOrders.forEach((po) => {
        po.items.forEach((pItem) => {
          if (pItem.itemId === item.id || pItem.itemName.toLowerCase() === item.name.toLowerCase()) {
            const dt = po.date ? new Date(po.date.seconds * 1000).toLocaleDateString('en-GB') : 'N/A';
            history.push({
              date: dt,
              supplierName: po.supplierName || 'Supplier',
              quantity: pItem.quantity,
              unitPrice: pItem.price,
              poNumber: po.poNumber
            });
          }
        });
      });

      // Look in transactions (IN / Purchase)
      transactions.forEach((tx) => {
        if (tx.itemId === item.id && tx.type === 'IN') {
          const dt = tx.date ? new Date(tx.date.seconds * 1000).toLocaleDateString('en-GB') : 'N/A';
          history.push({
            date: dt,
            supplierName: tx.supplierName || 'Purchase Record',
            quantity: tx.quantity,
            unitPrice: tx.price,
            poNumber: tx.poNumber || tx.reference
          });
        }
      });

      if (history.length > 0) {
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPriceHistory(history);
        setPreviousPurchasePrice(history[0].unitPrice);
        setLastPurchaseDate(history[0].date);
        setLastSupplierName(history[0].supplierName);
        if (priceSource === 'previous') {
          setManualPrice(history[0].unitPrice);
        }
      } else if (item.avgCost && item.avgCost > 0) {
        setPriceHistory([
          { date: new Date().toLocaleDateString('en-GB'), supplierName: 'System Avg Cost', quantity: item.currentStock || 0, unitPrice: item.avgCost }
        ]);
        setPreviousPurchasePrice(item.avgCost);
        setLastPurchaseDate(new Date().toLocaleDateString('en-GB'));
        setLastSupplierName('Inventory Avg Cost');
      }
    } catch (err) {
      console.error('Error fetching price history:', err);
    }
  };

  // Preset Paper Handler
  const handlePaperPresetChange = (presetLabel: string) => {
    setPaperPreset(presetLabel);
    const preset = STANDARD_PAPER_PRESETS.find((p) => p.label === presetLabel);
    if (preset && preset.width > 0 && preset.height > 0) {
      setPaperWidth(preset.width);
      setPaperHeight(preset.height);
      setPaperUnit(preset.unit);
    }
  };

  // Machine preset handler
  const handleMachineChange = (machineName: string) => {
    setSelectedMachine(machineName);
    const m = STANDARD_MACHINES.find((x) => x.name === machineName);
    if (m) {
      setGripperMm(m.gripperMm);
      setGapMm(m.gapMm);
      setTopBottomMarginMm(m.topBottomMarginMm);
      setLeftRightMarginMm(m.leftRightMarginMm);
    }
  };

  // Determine active price
  const activePrice = priceSource === 'previous' ? previousPurchasePrice : manualPrice;

  // Calculation Engine Call
  const calcResult: UPSCalculationResult = useMemo(() => {
    const input: UPSCalculationInput = {
      productWidth,
      productHeight,
      productUnit,
      paperWidth,
      paperHeight,
      paperUnit,
      gripperMm,
      gapMm,
      topBottomMarginMm,
      leftRightMarginMm,
      selectedPrice: activePrice,
      priceSource,
      costBasis,
      additionalCosts: showCostingBreakdown ? {
        paperCost,
        printingCost,
        plateCost,
        cuttingCost,
        laminationCost,
        foilingCost,
        embossCost,
        glueCost,
        otherCost
      } : undefined
    };
    return calculateUPS(input);
  }, [
    productWidth, productHeight, productUnit,
    paperWidth, paperHeight, paperUnit,
    gripperMm, gapMm, topBottomMarginMm, leftRightMarginMm,
    activePrice, priceSource, costBasis,
    showCostingBreakdown, paperCost, printingCost, plateCost, cuttingCost, laminationCost, foilingCost, embossCost, glueCost, otherCost
  ]);

  // Save to Firestore
  const handleSaveCalculation = async (asNewVersion = false) => {
    if (!calcResult.isValid) {
      showToast('Cannot save invalid calculation. Please check dimensions.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const nextVersion = asNewVersion ? currentVersion + 1 : currentVersion;
      const calcId = `PD-UPS-${Date.now().toString().slice(-6)}`;

      const payload = {
        calculationNo: calcId,
        version: nextVersion,
        productId: selectedProductId || 'custom',
        productCode,
        productName,
        category: productCategory,
        productWidth,
        productHeight,
        productUnit,
        paperWidth,
        paperHeight,
        paperUnit,
        paperPreset,
        gripperMm,
        gapMm,
        topBottomMarginMm,
        leftRightMarginMm,
        machineName: selectedMachine,
        portrait: calcResult.portrait,
        landscape: calcResult.landscape,
        bestOrientation: calcResult.bestOrientation,
        bestUPS: calcResult.bestUPS,
        bestColumns: calcResult.bestColumns,
        bestRows: calcResult.bestRows,
        paperAreaSqMm: calcResult.paperAreaSqMm,
        usedAreaSqMm: calcResult.usedAreaSqMm,
        unusedAreaSqMm: calcResult.unusedAreaSqMm,
        utilizationPercent: calcResult.utilizationPercent,
        wastagePercent: calcResult.wastagePercent,
        previousPurchasePrice,
        lastPurchaseDate,
        lastSupplierName,
        selectedPrice: activePrice,
        priceSource,
        costBasis,
        estimatedCostPerPiece: calcResult.costPerPiece,
        totalCostPerPieceWithAddons: calcResult.totalCostPerPieceWithAddons,
        costing: showCostingBreakdown ? {
          paperCost, printingCost, plateCost, cuttingCost, laminationCost, foilingCost, embossCost, glueCost, otherCost,
          totalAdditionalCost: calcResult.totalAdditionalCost
        } : null,
        notes: calculationNotes,
        businessId: userProfile.businessId,
        ownerId: userProfile.uid,
        createdByName: userProfile.displayName || userProfile.name || 'User',
        createdByEmail: userProfile.email,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'product_developments'), payload);
      setCurrentVersion(nextVersion);
      showToast(`Calculation saved successfully (${calcId} v${nextVersion})`, 'success');
      if (onSavedSuccess) onSavedSuccess();
    } catch (err: any) {
      console.error('Error saving calculation:', err);
      showToast('Failed to save calculation: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Print Summary Report
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow popups to print calculation report', 'error');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product UPS Calculation - ${productName}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
            .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #f8fafc; }
            .card-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #475569; margin-bottom: 12px; letter-spacing: 0.5px; }
            .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
            .row:last-child { border-bottom: none; }
            .result-card { background: #0f172a; color: #ffffff; padding: 20px; border-radius: 12px; margin-top: 20px; }
            .result-card h3 { margin: 0 0 10px 0; color: #38bdf8; font-size: 16px; }
            .result-big { font-size: 32px; font-weight: bold; color: #ffffff; }
            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Product UPS & Imposition Report</h1>
              <div class="sub">Product Development & Costing Module</div>
            </div>
            <div class="badge">PD-UPS-${Date.now().toString().slice(-6)}</div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">1. Product & Sheet Specification</div>
              <div class="row"><span>Product Name:</span> <strong>${productName}</strong></div>
              <div class="row"><span>Product Code:</span> <strong>${productCode}</strong></div>
              <div class="row"><span>Product Size:</span> <strong>${productWidth} × ${productHeight} ${productUnit}</strong></div>
              <div class="row"><span>Paper / Sheet Size:</span> <strong>${paperWidth} × ${paperHeight} ${paperUnit}</strong></div>
              <div class="row"><span>Paper Preset:</span> <strong>${paperPreset}</strong></div>
            </div>

            <div class="card">
              <div class="card-title">2. Printing Parameters</div>
              <div class="row"><span>Machine Config:</span> <strong>${selectedMachine}</strong></div>
              <div class="row"><span>Gripper:</span> <strong>${gripperMm} mm</strong></div>
              <div class="row"><span>Product Gap:</span> <strong>${gapMm} mm</strong></div>
              <div class="row"><span>Margins (Top/Bottom):</span> <strong>${topBottomMarginMm} mm</strong></div>
              <div class="row"><span>Margins (Left/Right):</span> <strong>${leftRightMarginMm} mm</strong></div>
            </div>
          </div>

          <div class="card" style="margin-bottom: 24px;">
            <div class="card-title">3. Imposition & Orientation Comparison</div>
            <div class="row"><span>Portrait Layout:</span> <strong>${calcResult.portrait.columns} Cols × ${calcResult.portrait.rows} Rows = ${calcResult.portrait.ups} UPS</strong></div>
            <div class="row"><span>Landscape Layout:</span> <strong>${calcResult.landscape.columns} Cols × ${calcResult.landscape.rows} Rows = ${calcResult.landscape.ups} UPS</strong></div>
            <div class="row"><span>Paper Utilization:</span> <strong>${calcResult.utilizationPercent.toFixed(2)}%</strong></div>
            <div class="row"><span>Paper Wastage:</span> <strong>${calcResult.wastagePercent.toFixed(2)}%</strong></div>
          </div>

          <div class="card">
            <div class="card-title">4. Pricing & Costing Summary</div>
            <div class="row"><span>Price Basis:</span> <strong>${costBasis === 'per_sheet' ? 'Per Paper Sheet' : 'Per Individual Product'}</strong></div>
            <div class="row"><span>Selected Price:</span> <strong>৳ ${activePrice.toFixed(2)} (${priceSource})</strong></div>
            <div class="row"><span>Estimated Raw Cost / Piece:</span> <strong style="color: #0284c7;">৳ ${calcResult.costPerPiece.toFixed(4)}</strong></div>
            ${calcResult.totalAdditionalCost > 0 ? `<div class="row"><span>Total Cost / Piece (Inc Addons):</span> <strong>৳ ${calcResult.totalCostPerPieceWithAddons.toFixed(4)}</strong></div>` : ''}
          </div>

          <div class="result-card">
            <h3>BEST UTILIZATION RESULT</h3>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 14px; opacity: 0.9;">Optimal Orientation: <strong>${calcResult.bestOrientation}</strong></div>
                <div style="font-size: 14px; opacity: 0.9;">Arrangement: ${calcResult.bestColumns} Columns × ${calcResult.bestRows} Rows</div>
              </div>
              <div class="result-big">${calcResult.bestUPS} UPS</div>
            </div>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()} by ${userProfile.displayName || userProfile.email} | ERP Product Development System
          </div>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              window.focus();
              window.print();
            });
            setTimeout(function() {
              window.focus();
              window.print();
            }, 100);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvRows = [
      ['Product UPS Calculation Summary'],
      ['Date', new Date().toLocaleDateString()],
      ['Product Name', productName],
      ['Product Code', productCode],
      ['Product Size', `${productWidth} x ${productHeight} ${productUnit}`],
      ['Paper Size', `${paperWidth} x ${paperHeight} ${paperUnit}`],
      ['Gripper (mm)', gripperMm],
      ['Gap (mm)', gapMm],
      ['Margins (mm)', `${topBottomMarginMm} TB / ${leftRightMarginMm} LR`],
      ['Portrait UPS', calcResult.portrait.ups],
      ['Landscape UPS', calcResult.landscape.ups],
      ['Best Orientation', calcResult.bestOrientation],
      ['Best UPS', calcResult.bestUPS],
      ['Paper Utilization %', calcResult.utilizationPercent.toFixed(2)],
      ['Wastage %', calcResult.wastagePercent.toFixed(2)],
      ['Selected Price', activePrice],
      ['Price Source', priceSource],
      ['Cost Basis', costBasis],
      ['Cost Per Piece', calcResult.costPerPiece.toFixed(4)]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `UPS_Calculation_${productCode || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('UPS calculation exported as CSV', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-neutral-900">Product UPS Calculation</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                v{currentVersion}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Calculate maximum piece yield per sheet, paper utilization & unit raw material costing
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => handleSaveCalculation(false)}
            disabled={isSaving || !calcResult.isValid}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Development</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveCalculation(true)}
            disabled={isSaving || !calcResult.isValid}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-all border border-neutral-200"
            title="Save as a new version (e.g. V2)"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Save New Version</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-all border border-neutral-200"
          >
            <Printer className="w-4 h-4 text-neutral-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-all border border-neutral-200"
          >
            <Download className="w-4 h-4 text-neutral-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Section 3: Product Selection */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Product Selection</h3>
              </div>
              <span className="text-xs text-neutral-400 font-medium">ERP Master Integrated</span>
            </div>

            <div className="relative">
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Select Product from Master
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-left focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Search className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <span className="font-semibold text-neutral-800 truncate">
                      {productName} {productCode ? `(${productCode})` : ''}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>

                {/* Dropdown Menu */}
                {isProductDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl p-2 max-h-64 overflow-y-auto space-y-1">
                    <input
                      type="text"
                      placeholder="Search product name, SKU..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-neutral-100 border border-neutral-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    {filteredProducts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectProduct(item)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left hover:bg-indigo-50 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-neutral-800">{item.name}</div>
                          <div className="text-[11px] text-neutral-400">SKU: {item.sku} • Stock: {item.currentStock} {item.unit}</div>
                        </div>
                        {item.avgCost && item.avgCost > 0 && (
                          <span className="font-semibold text-emerald-600 text-xs">
                            ৳{item.avgCost.toFixed(2)}
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="p-3 text-center text-xs text-neutral-400">No products found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Editable Product Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Product Code</label>
                <input
                  type="text"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Product Name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Category / Group</label>
                <input
                  type="text"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4 & 5: Product Size & Paper Size Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Product Size Card */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Product Size</h3>
                </div>
                <div className="flex gap-1 bg-neutral-100 p-0.5 rounded-lg">
                  {(['mm', 'cm', 'inch'] as DimensionUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setProductUnit(u)}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase transition-all ${
                        productUnit === u ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Width ({productUnit.toUpperCase()})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={productWidth || ''}
                    onChange={(e) => setProductWidth(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Height ({productUnit.toUpperCase()})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={productHeight || ''}
                    onChange={(e) => setProductHeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">
                Actual single piece dimensions. You can manually adjust for bled edges if needed.
              </p>
            </div>

            {/* Paper Size Card */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Paper / Sheet Size</h3>
                </div>
                <div className="flex gap-1 bg-neutral-100 p-0.5 rounded-lg">
                  {(['mm', 'cm', 'inch'] as DimensionUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setPaperUnit(u)}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase transition-all ${
                        paperUnit === u ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Standard Paper Preset</label>
                <select
                  value={paperPreset}
                  onChange={(e) => handlePaperPresetChange(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {STANDARD_PAPER_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Paper Width ({paperUnit.toUpperCase()})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={paperWidth || ''}
                    onChange={(e) => {
                      setPaperWidth(parseFloat(e.target.value) || 0);
                      setPaperPreset('Custom');
                    }}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Paper Height ({paperUnit.toUpperCase()})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={paperHeight || ''}
                    onChange={(e) => {
                      setPaperHeight(parseFloat(e.target.value) || 0);
                      setPaperPreset('Custom');
                    }}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Section 6: Printing Parameters */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Printing & Machine Parameters</h3>
              </div>
              <select
                value={selectedMachine}
                onChange={(e) => handleMachineChange(e.target.value)}
                className="text-xs bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1 font-semibold text-neutral-700"
              >
                {STANDARD_MACHINES.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Gripper (mm)</label>
                <input
                  type="number"
                  min="0"
                  value={gripperMm}
                  onChange={(e) => setGripperMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Gap Between (mm)</label>
                <input
                  type="number"
                  min="0"
                  value={gapMm}
                  onChange={(e) => setGapMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Top/Bot Margin (mm)</label>
                <input
                  type="number"
                  min="0"
                  value={topBottomMarginMm}
                  onChange={(e) => setTopBottomMarginMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Left/Right Margin (mm)</label>
                <input
                  type="number"
                  min="0"
                  value={leftRightMarginMm}
                  onChange={(e) => setLeftRightMarginMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                />
              </div>
            </div>
          </div>

          {/* Section 13, 14, 15: Product Price & Price Source */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Product / Paper Price & Source</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500 font-medium">Cost Basis:</span>
                <button
                  type="button"
                  onClick={() => setCostBasis(costBasis === 'per_sheet' ? 'per_product' : 'per_sheet')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-100 border border-neutral-200 text-neutral-800 hover:bg-neutral-200 transition-all"
                >
                  {costBasis === 'per_sheet' ? 'Per Paper Sheet' : 'Per Individual Product'}
                </button>
              </div>
            </div>

            {/* Price Source Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Option 1: Previous Purchase Price */}
              <div
                onClick={() => setPriceSource('previous')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  priceSource === 'previous'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-neutral-200 bg-neutral-50 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="priceSource"
                      checked={priceSource === 'previous'}
                      onChange={() => setPriceSource('previous')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-neutral-900">Previous Purchase Price</span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-700">৳{previousPurchasePrice.toFixed(2)}</span>
                </div>
                <div className="text-[11px] text-neutral-500 pl-5 space-y-0.5">
                  <div>Supplier: <strong className="text-neutral-700">{lastSupplierName}</strong></div>
                  <div>Last Date: <strong className="text-neutral-700">{lastPurchaseDate}</strong></div>
                </div>
              </div>

              {/* Option 2: Manual Price Override */}
              <div
                onClick={() => setPriceSource('manual')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  priceSource === 'manual'
                    ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-neutral-200 bg-neutral-50 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="priceSource"
                      checked={priceSource === 'manual'}
                      onChange={() => setPriceSource('manual')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-neutral-900">Manual Price Override</span>
                  </div>
                </div>
                <div className="pl-5 pt-1">
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-neutral-400">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manualPrice || ''}
                      onChange={(e) => {
                        setManualPrice(parseFloat(e.target.value) || 0);
                        setPriceSource('manual');
                      }}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Expandable Price History Section */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPriceHistoryTable(!showPriceHistoryTable)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <History className="w-3.5 h-3.5" />
                <span>{showPriceHistoryTable ? 'Hide' : 'View'} Previous Purchase Price History ({priceHistory.length})</span>
                {showPriceHistoryTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showPriceHistoryTable && (
                <div className="mt-3 overflow-x-auto border border-neutral-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-100 text-neutral-600 font-bold border-b border-neutral-200">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5 text-right">Quantity</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {priceHistory.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="p-2.5 font-medium">{rec.date}</td>
                          <td className="p-2.5">{rec.supplierName}</td>
                          <td className="p-2.5 text-right">{rec.quantity.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-bold text-neutral-900">৳{rec.unitPrice.toFixed(2)}</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviousPurchasePrice(rec.unitPrice);
                                setPriceSource('previous');
                                showToast(`Selected price ৳${rec.unitPrice.toFixed(2)} from ${rec.supplierName}`, 'info');
                              }}
                              className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            >
                              Use Price
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section 17: Optional Product Development Costing */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3">
            <button
              type="button"
              onClick={() => setShowCostingBreakdown(!showCostingBreakdown)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Additional Product Development Costing (Optional)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {showCostingBreakdown && (
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                    Addons: ৳{calcResult.totalAdditionalCost.toFixed(2)}
                  </span>
                )}
                {showCostingBreakdown ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </div>
            </button>

            {showCostingBreakdown && (
              <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Paper Cost', val: paperCost, set: setPaperCost },
                  { label: 'Printing Cost', val: printingCost, set: setPrintingCost },
                  { label: 'Plate Cost', val: plateCost, set: setPlateCost },
                  { label: 'Cutting Cost', val: cuttingCost, set: setCuttingCost },
                  { label: 'Lamination Cost', val: laminationCost, set: setLaminationCost },
                  { label: 'Foiling Cost', val: foilingCost, set: setFoilingCost },
                  { label: 'Emboss Cost', val: embossCost, set: setEmbossCost },
                  { label: 'Glue Cost', val: glueCost, set: setGlueCost },
                  { label: 'Other Cost', val: otherCost, set: setOtherCost },
                ].map((item) => (
                  <div key={item.label}>
                    <label className="block text-[11px] font-medium text-neutral-600 mb-1">{item.label}</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={item.val || ''}
                      onChange={(e) => item.set(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-bold text-neutral-800"
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Calculations & Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Section 7 & 8: Portrait vs Landscape Cards */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Portrait Card */}
            <div className={`p-4 rounded-2xl border transition-all ${
              calcResult.bestOrientation === 'PORTRAIT'
                ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                : 'border-neutral-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">PORTRAIT</span>
                {calcResult.bestOrientation === 'PORTRAIT' && (
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                    BEST
                  </span>
                )}
              </div>
              <div className="text-2xl font-black text-neutral-900 mb-1">
                {calcResult.portrait.ups} <span className="text-xs font-semibold text-neutral-500">UPS</span>
              </div>
              <div className="text-xs text-neutral-500 font-medium">
                {calcResult.portrait.columns} Cols × {calcResult.portrait.rows} Rows
              </div>
            </div>

            {/* Landscape Card */}
            <div className={`p-4 rounded-2xl border transition-all ${
              calcResult.bestOrientation === 'LANDSCAPE'
                ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                : 'border-neutral-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">LANDSCAPE</span>
                {calcResult.bestOrientation === 'LANDSCAPE' && (
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                    BEST
                  </span>
                )}
              </div>
              <div className="text-2xl font-black text-neutral-900 mb-1">
                {calcResult.landscape.ups} <span className="text-xs font-semibold text-neutral-500">UPS</span>
              </div>
              <div className="text-xs text-neutral-500 font-medium">
                {calcResult.landscape.columns} Cols × {calcResult.landscape.rows} Rows
              </div>
            </div>

          </div>

          {/* Section 9: BEST UTILIZATION Result Card */}
          <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-indigo-950 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Sparkles className="w-32 h-32 text-indigo-400" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                  BEST UTILIZATION RESULT
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {calcResult.bestOrientation}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-4xl font-black text-white tracking-tight">
                    {calcResult.bestUPS} <span className="text-lg font-bold text-indigo-300">UPS</span>
                  </div>
                  <div className="text-xs text-neutral-300 font-medium mt-1">
                    {calcResult.bestColumns} Columns × {calcResult.bestRows} Rows per sheet
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-neutral-400 uppercase font-semibold">Utilization</div>
                  <div className="text-xl font-bold text-emerald-400">
                    {calcResult.utilizationPercent.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Progress Bar for Utilization */}
              <div className="space-y-1">
                <div className="w-full bg-neutral-700/60 rounded-full h-2 overflow-hidden p-0.5">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, calcResult.utilizationPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-neutral-400 font-medium">
                  <span>Wastage: {calcResult.wastagePercent.toFixed(1)}%</span>
                  <span>Unused: {(calcResult.unusedAreaSqMm / 100).toFixed(0)} cm²</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 12: Visual Imposition Preview */}
          <div className="space-y-2">
            <ImpositionPreview
              result={calcResult}
              productName={productName}
              paperUnit={paperUnit}
              productUnit={productUnit}
              title="Sheet Imposition Layout Preview"
            />
          </div>

          {/* Section 18: Final Result Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">PRODUCT UPS RESULT SUMMARY</h3>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Product:</span>
                <strong className="text-neutral-900">{productName} ({productCode})</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Product Size:</span>
                <strong className="text-neutral-900">{productWidth} × {productHeight} {productUnit}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Paper Size:</span>
                <strong className="text-neutral-900">{paperWidth} × {paperHeight} {paperUnit} ({paperPreset})</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Best Orientation:</span>
                <strong className="text-indigo-600 font-bold">{calcResult.bestOrientation} ({calcResult.bestColumns}×{calcResult.bestRows})</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Maximum UPS:</span>
                <strong className="text-neutral-900 font-extrabold text-sm">{calcResult.bestUPS} UPS</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Selected Price ({priceSource}):</span>
                <strong className="text-neutral-900">৳{activePrice.toFixed(2)}</strong>
              </div>

              {/* Estimated Cost Highlight */}
              <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Estimated Cost / Piece
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium">
                    {costBasis === 'per_sheet' ? `Based on ৳${activePrice.toFixed(2)} / Sheet ÷ ${calcResult.bestUPS} UPS` : 'Direct Product Price'}
                  </div>
                </div>
                <div className="text-xl font-black text-emerald-900">
                  ৳{calcResult.costPerPiece.toFixed(4)}
                </div>
              </div>

              {calcResult.totalAdditionalCost > 0 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-purple-900">
                  <span className="font-bold">Total Cost / Piece (with Addons):</span>
                  <span className="font-black text-base">৳{calcResult.totalCostPerPieceWithAddons.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
