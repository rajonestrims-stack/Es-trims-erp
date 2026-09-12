export type QuantityUnit = 'pcs' | 'dozen' | '100_pcs' | '1000_pcs' | 'sheet';

export type UOMUnit = 
  | 'Piece' 
  | 'Dozen' 
  | '100 Pcs' 
  | '1000 Pcs' 
  | 'Sheet' 
  | 'Kg' 
  | 'Gram' 
  | 'Meter' 
  | 'Yard' 
  | 'Box' 
  | 'Liter' 
  | 'Set';

export type CostBasis = 
  | 'per_piece' 
  | 'per_dozen' 
  | 'per_100' 
  | 'per_1000' 
  | 'per_sheet' 
  | 'per_kg' 
  | 'per_gram' 
  | 'per_meter' 
  | 'per_hour' 
  | 'per_lot' 
  | 'fixed';

export type CalculationBase = 
  | 'raw_material' 
  | 'process' 
  | 'manufacturing' 
  | 'total_cost' 
  | 'sales_value';

export interface RawMaterialCostRow {
  id: string;
  itemId?: string;
  itemName: string;
  itemCode?: string;
  consumption: number;
  unit: UOMUnit;
  price: number;
  priceBasis: CostBasis;
  priceSource: 'previous' | 'manual';
  previousPrice?: number;
  lastSupplierName?: string;
  lastPurchaseDate?: string;
}

export interface ProcessCostRow {
  id: string;
  processName: string;
  quantity: number;
  cost: number;
  costBasis: CostBasis;
}

export interface OtherCostRow {
  id: string;
  costHead: string;
  method: 'percentage' | 'fixed';
  value: number;
  base: CalculationBase;
}

export interface CostingInput {
  productId?: string;
  productName: string;
  productCode: string;
  productCategory?: string;
  productUnit?: string;
  productWidth?: number;
  productHeight?: number;

  calculationQuantity: number;
  quantityUnit: QuantityUnit;
  ups: number;

  currency: string;
  exchangeRate: number; // Rate against BDT (e.g., 1 USD = 110 BDT)

  rawMaterials: RawMaterialCostRow[];
  processes: ProcessCostRow[];

  overheadMethod: 'percentage' | 'fixed';
  overheadValue: number;
  overheadBase: CalculationBase;

  adminMethod: 'percentage' | 'fixed';
  adminValue: number;
  adminBase: CalculationBase;

  transportMethod: 'percentage' | 'fixed';
  transportValue: number;
  transportBase: CalculationBase;

  otherCosts: OtherCostRow[];

  sellingPriceMethod: 'cost_plus_markup' | 'percentage_sales' | 'manual';
  markupOrMarginPercent: number;
  manualSellingPrice?: number;
}

export interface CostingResult {
  calculationQuantityPcs: number;
  requiredSheets: number;
  totalProductionPcsFromSheets: number;

  // Raw Material Breakdown
  rawMaterialTotals: { id: string; total: number; totalPerPcs: number }[];
  totalRawMaterialCost: number;
  rawMaterialCostPerPcs: number;

  // Process Breakdown
  processTotals: { id: string; total: number; totalPerPcs: number }[];
  totalProcessCost: number;
  processCostPerPcs: number;

  // Manufacturing Total
  manufacturingCost: number;
  manufacturingCostPerPcs: number;

  // Overheads / Admin / Transport / Other
  overheadCost: number;
  adminCost: number;
  transportCost: number;
  otherCostsBreakdown: { id: string; amount: number }[];
  totalOtherCost: number;

  // Base Total Cost (before Sales-based % costs)
  baseTotalCost: number;

  // Final Total Cost (including Sales-based % costs solved mathematically)
  totalCost: number;
  costPerPiece: number;
  costPerDozen: number;
  costPer100: number;
  costPer1000: number;

  // Selling Price & Profit
  sellingPrice: number;
  sellingPricePerPiece: number;
  sellingPricePerDozen: number;
  sellingPricePer100: number;
  sellingPricePer1000: number;
  profitAmount: number;
  profitMarginPercent: number;

  // Currency Convert & Dual-Currency Output (BDT and USD)
  conversionRateUsed: number;
  currencySymbol: string;
  isBDTPrimary: boolean;

  bdtTotalCost: number;
  bdtCostPerPiece: number;
  bdtCostPerDozen: number;
  bdtCostPer100: number;
  bdtCostPer1000: number;
  bdtSellingPrice: number;
  bdtSellingPricePerPiece: number;
  bdtSellingPricePerDozen: number;
  bdtSellingPricePer100: number;
  bdtSellingPricePer1000: number;
  bdtProfitAmount: number;

  usdTotalCost: number;
  usdCostPerPiece: number;
  usdCostPerDozen: number;
  usdCostPer100: number;
  usdCostPer1000: number;
  usdSellingPrice: number;
  usdSellingPricePerPiece: number;
  usdSellingPricePerDozen: number;
  usdSellingPricePer100: number;
  usdSellingPricePer1000: number;
  usdProfitAmount: number;

  selectedCurrencyTotalCost: number;
  selectedCurrencyCostPerPiece: number;

  // Percentage Breakdown
  breakdownPercent: {
    rawMaterial: number;
    process: number;
    overhead: number;
    admin: number;
    transport: number;
    other: number;
    profit: number;
  };

  isValid: boolean;
  errorMessage?: string;
}

/**
 * Helper to convert quantity into total pieces
 */
export function convertToTotalPieces(qty: number, unit: QuantityUnit, ups: number): number {
  if (isNaN(qty) || qty <= 0) return 0;
  switch (unit) {
    case 'dozen':
      return qty * 12;
    case '100_pcs':
      return qty * 100;
    case '1000_pcs':
      return qty * 1000;
    case 'sheet':
      return qty * (ups > 0 ? ups : 1);
    case 'pcs':
    default:
      return qty;
  }
}

/**
 * Calculates item cost based on price basis & quantity/sheets
 */
export function calculateRowTotalCost(
  qty: number,
  price: number,
  basis: CostBasis,
  totalPcs: number,
  requiredSheets: number
): number {
  if (price <= 0 || qty <= 0) return 0;

  switch (basis) {
    case 'per_piece':
      // qty represents consumption per piece or total pieces entered
      return qty * price;
    case 'per_dozen':
      return (qty / 12) * price;
    case 'per_100':
      return (qty / 100) * price;
    case 'per_1000':
      return (qty / 1000) * price;
    case 'per_sheet':
      // If consumption is specified per piece or specific sheets, calculate with sheets
      return qty * price;
    case 'fixed':
    case 'per_lot':
      return price;
    case 'per_kg':
    case 'per_gram':
    case 'per_meter':
    case 'per_hour':
    default:
      return qty * price;
  }
}

/**
 * Core Calculation Engine for Product Costing
 */
export function calculateProductCosting(input: CostingInput): CostingResult {
  const ups = Math.max(1, input.ups || 1);
  const totalPcs = convertToTotalPieces(input.calculationQuantity, input.quantityUnit, ups);

  if (totalPcs <= 0) {
    return {
      calculationQuantityPcs: 0, requiredSheets: 0, totalProductionPcsFromSheets: 0,
      rawMaterialTotals: [], totalRawMaterialCost: 0, rawMaterialCostPerPcs: 0,
      processTotals: [], totalProcessCost: 0, processCostPerPcs: 0,
      manufacturingCost: 0, manufacturingCostPerPcs: 0,
      overheadCost: 0, adminCost: 0, transportCost: 0, otherCostsBreakdown: [], totalOtherCost: 0,
      baseTotalCost: 0, totalCost: 0, costPerPiece: 0, costPerDozen: 0, costPer100: 0, costPer1000: 0,
      sellingPrice: 0, sellingPricePerPiece: 0, sellingPricePerDozen: 0, sellingPricePer100: 0, sellingPricePer1000: 0,
      profitAmount: 0, profitMarginPercent: 0,
      conversionRateUsed: input.exchangeRate || 120,
      currencySymbol: input.currency === 'USD' ? '$' : input.currency === 'EUR' ? '€' : input.currency === 'GBP' ? '£' : '৳',
      isBDTPrimary: input.currency === 'BDT',
      bdtTotalCost: 0, bdtCostPerPiece: 0, bdtCostPerDozen: 0, bdtCostPer100: 0, bdtCostPer1000: 0,
      bdtSellingPrice: 0, bdtSellingPricePerPiece: 0, bdtSellingPricePerDozen: 0, bdtSellingPricePer100: 0, bdtSellingPricePer1000: 0,
      bdtProfitAmount: 0,
      usdTotalCost: 0, usdCostPerPiece: 0, usdCostPerDozen: 0, usdCostPer100: 0, usdCostPer1000: 0,
      usdSellingPrice: 0, usdSellingPricePerPiece: 0, usdSellingPricePerDozen: 0, usdSellingPricePer100: 0, usdSellingPricePer1000: 0,
      usdProfitAmount: 0,
      selectedCurrencyTotalCost: 0, selectedCurrencyCostPerPiece: 0,
      breakdownPercent: { rawMaterial: 0, process: 0, overhead: 0, admin: 0, transport: 0, other: 0, profit: 0 },
      isValid: false, errorMessage: 'Calculation quantity must be greater than 0.'
    };
  }

  // Required Sheets Calculation (ceil to whole sheets)
  const requiredSheets = Math.ceil(totalPcs / ups);
  const totalProductionPcsFromSheets = requiredSheets * ups;

  // 1. Raw Materials Total
  const rawMaterialTotals: { id: string; total: number; totalPerPcs: number }[] = [];
  let totalRawMaterialCost = 0;

  input.rawMaterials.forEach((rm) => {
    const rowCost = calculateRowTotalCost(rm.consumption, rm.price, rm.priceBasis, totalPcs, requiredSheets);
    rawMaterialTotals.push({ id: rm.id, total: rowCost, totalPerPcs: rowCost / totalPcs });
    totalRawMaterialCost += rowCost;
  });

  const rawMaterialCostPerPcs = totalRawMaterialCost / totalPcs;

  // 2. Process Costs Total
  const processTotals: { id: string; total: number; totalPerPcs: number }[] = [];
  let totalProcessCost = 0;

  input.processes.forEach((proc) => {
    const rowCost = calculateRowTotalCost(proc.quantity, proc.cost, proc.costBasis, totalPcs, requiredSheets);
    processTotals.push({ id: proc.id, total: rowCost, totalPerPcs: rowCost / totalPcs });
    totalProcessCost += rowCost;
  });

  const processCostPerPcs = totalProcessCost / totalPcs;

  // 3. Manufacturing Cost = Raw Material + Process
  const manufacturingCost = totalRawMaterialCost + totalProcessCost;
  const manufacturingCostPerPcs = manufacturingCost / totalPcs;

  // Helper function to resolve percentage base
  const resolveBaseAmount = (base: CalculationBase): number => {
    switch (base) {
      case 'raw_material':
        return totalRawMaterialCost;
      case 'process':
        return totalProcessCost;
      case 'manufacturing':
      default:
        return manufacturingCost;
    }
  };

  // 4. Overhead Cost
  let overheadCost = 0;
  if (input.overheadMethod === 'fixed') {
    overheadCost = input.overheadValue;
  } else {
    overheadCost = (resolveBaseAmount(input.overheadBase) * input.overheadValue) / 100;
  }

  // 5. Office & Administrative Cost
  let adminCost = 0;
  if (input.adminMethod === 'fixed') {
    adminCost = input.adminValue;
  } else {
    adminCost = (resolveBaseAmount(input.adminBase) * input.adminValue) / 100;
  }

  // 6. Transport Cost
  let transportCost = 0;
  if (input.transportMethod === 'fixed') {
    transportCost = input.transportValue;
  } else {
    transportCost = (resolveBaseAmount(input.transportBase) * input.transportValue) / 100;
  }

  // 7. Other Costs
  const otherCostsBreakdown: { id: string; amount: number }[] = [];
  let totalOtherCost = 0;
  let salesBasedOtherCostPercent = 0;

  input.otherCosts.forEach((oc) => {
    if (oc.method === 'fixed') {
      otherCostsBreakdown.push({ id: oc.id, amount: oc.value });
      totalOtherCost += oc.value;
    } else {
      if (oc.base === 'sales_value') {
        // Collect sales-based percentage to solve iteratively/algebraically later
        salesBasedOtherCostPercent += oc.value;
        otherCostsBreakdown.push({ id: oc.id, amount: 0 }); // placeholder
      } else {
        const amt = (resolveBaseAmount(oc.base) * oc.value) / 100;
        otherCostsBreakdown.push({ id: oc.id, amount: amt });
        totalOtherCost += amt;
      }
    }
  });

  // Base Total Cost before sales-based % costs & selling price resolution
  const baseTotalCost = manufacturingCost + overheadCost + adminCost + transportCost + totalOtherCost;

  // 8. Selling Price & Profit Resolution (All manufacturing costs are in BDT)
  const exchangeRate = input.exchangeRate > 0 ? input.exchangeRate : 120;
  const isUSD = input.currency === 'USD';
  const isBDT = input.currency === 'BDT';

  let sellingPriceBDT = 0;
  let totalCostBDT = baseTotalCost;
  let profitAmountBDT = 0;
  let profitMarginPercent = 0;

  const markupOrMargin = Math.max(0, input.markupOrMarginPercent || 0);

  if (input.sellingPriceMethod === 'cost_plus_markup') {
    // Markup % on BDT manufacturing & overhead cost
    const factor = 1 + markupOrMargin / 100;
    const salesCostFactor = (salesBasedOtherCostPercent / 100) * factor;

    if (salesCostFactor < 1) {
      sellingPriceBDT = (baseTotalCost * factor) / (1 - salesCostFactor);
    } else {
      sellingPriceBDT = baseTotalCost * factor;
    }

    const salesBasedCostAmt = (sellingPriceBDT * salesBasedOtherCostPercent) / 100;
    totalCostBDT = baseTotalCost + salesBasedCostAmt;
    profitAmountBDT = sellingPriceBDT - totalCostBDT;
    profitMarginPercent = sellingPriceBDT > 0 ? (profitAmountBDT / sellingPriceBDT) * 100 : 0;

  } else if (input.sellingPriceMethod === 'percentage_sales') {
    // Profit margin % of Sales Value in BDT
    const marginRatio = markupOrMargin / 100;
    const salesCostRatio = salesBasedOtherCostPercent / 100;
    const denom = 1 - marginRatio - salesCostRatio;

    if (denom > 0) {
      sellingPriceBDT = baseTotalCost / denom;
    } else {
      sellingPriceBDT = baseTotalCost / 0.9;
    }

    const salesBasedCostAmt = (sellingPriceBDT * salesBasedOtherCostPercent) / 100;
    totalCostBDT = baseTotalCost + salesBasedCostAmt;
    profitAmountBDT = sellingPriceBDT - totalCostBDT;
    profitMarginPercent = sellingPriceBDT > 0 ? (profitAmountBDT / sellingPriceBDT) * 100 : 0;

  } else {
    // Manual Selling Price
    const manualVal = Math.max(0, input.manualSellingPrice || 0);
    // If entered in USD, convert to BDT to evaluate against BDT manufacturing costs
    if (isUSD) {
      sellingPriceBDT = manualVal * exchangeRate;
    } else if (input.currency === 'EUR' || input.currency === 'GBP') {
      sellingPriceBDT = manualVal * exchangeRate;
    } else {
      sellingPriceBDT = manualVal;
    }

    const salesBasedCostAmt = (sellingPriceBDT * salesBasedOtherCostPercent) / 100;
    totalCostBDT = baseTotalCost + salesBasedCostAmt;
    profitAmountBDT = sellingPriceBDT - totalCostBDT;
    profitMarginPercent = sellingPriceBDT > 0 ? (profitAmountBDT / sellingPriceBDT) * 100 : 0;
  }

  // Update sales-based other cost row breakdowns with actual calculated BDT amount
  input.otherCosts.forEach((oc, index) => {
    if (oc.method === 'percentage' && oc.base === 'sales_value') {
      const amt = (sellingPriceBDT * oc.value) / 100;
      otherCostsBreakdown[index] = { id: oc.id, amount: amt };
      totalOtherCost += amt;
    }
  });

  // BDT Per Unit Breakdown (Standard Manufacturing Rates)
  const bdtTotalCost = totalCostBDT;
  const bdtCostPerPiece = bdtTotalCost / totalPcs;
  const bdtCostPerDozen = bdtCostPerPiece * 12;
  const bdtCostPer100 = bdtCostPerPiece * 100;
  const bdtCostPer1000 = bdtCostPerPiece * 1000;

  const bdtSellingPrice = sellingPriceBDT;
  const bdtSellingPricePerPiece = bdtSellingPrice / totalPcs;
  const bdtSellingPricePerDozen = bdtSellingPricePerPiece * 12;
  const bdtSellingPricePer100 = bdtSellingPricePerPiece * 100;
  const bdtSellingPricePer1000 = bdtSellingPricePerPiece * 1000;
  const bdtProfitAmount = profitAmountBDT;

  // USD Per Unit & Quotation Breakdown (Converted via exchangeRate: 1 USD = exchangeRate BDT)
  const usdTotalCost = bdtTotalCost / exchangeRate;
  const usdCostPerPiece = bdtCostPerPiece / exchangeRate;
  const usdCostPerDozen = bdtCostPerDozen / exchangeRate;
  const usdCostPer100 = bdtCostPer100 / exchangeRate;
  const usdCostPer1000 = bdtCostPer1000 / exchangeRate;

  const usdSellingPrice = bdtSellingPrice / exchangeRate;
  const usdSellingPricePerPiece = bdtSellingPricePerPiece / exchangeRate;
  const usdSellingPricePerDozen = bdtSellingPricePerDozen / exchangeRate;
  const usdSellingPricePer100 = bdtSellingPricePer100 / exchangeRate;
  const usdSellingPricePer1000 = bdtSellingPricePer1000 / exchangeRate;
  const usdProfitAmount = bdtProfitAmount / exchangeRate;

  // Active Quote Values (Formatted to chosen sales currency: USD, EUR, GBP, BDT, etc.)
  const currencySymbol =
    input.currency === 'USD' || isUSD ? '$' : input.currency === 'EUR' ? '€' : input.currency === 'GBP' ? '£' : '৳';
  const effectiveRate = input.currency === 'BDT' ? 1 : exchangeRate > 0 ? exchangeRate : 1;

  const sellingPrice = bdtSellingPrice / effectiveRate;
  const sellingPricePerPiece = bdtSellingPricePerPiece / effectiveRate;
  const sellingPricePerDozen = bdtSellingPricePerDozen / effectiveRate;
  const sellingPricePer100 = bdtSellingPricePer100 / effectiveRate;
  const sellingPricePer1000 = bdtSellingPricePer1000 / effectiveRate;
  const totalCost = bdtTotalCost / effectiveRate;
  const costPerPiece = bdtCostPerPiece / effectiveRate;
  const costPerDozen = bdtCostPerDozen / effectiveRate;
  const costPer100 = bdtCostPer100 / effectiveRate;
  const costPer1000 = bdtCostPer1000 / effectiveRate;
  const profitAmount = bdtProfitAmount / effectiveRate;

  // Breakdown Percentages
  const denominator = bdtSellingPrice > 0 ? bdtSellingPrice : bdtTotalCost > 0 ? bdtTotalCost : 1;
  const breakdownPercent = {
    rawMaterial: (totalRawMaterialCost / denominator) * 100,
    process: (totalProcessCost / denominator) * 100,
    overhead: (overheadCost / denominator) * 100,
    admin: (adminCost / denominator) * 100,
    transport: (transportCost / denominator) * 100,
    other: (totalOtherCost / denominator) * 100,
    profit: (profitAmountBDT / denominator) * 100,
  };

  return {
    calculationQuantityPcs: totalPcs,
    requiredSheets,
    totalProductionPcsFromSheets,
    rawMaterialTotals,
    totalRawMaterialCost,
    rawMaterialCostPerPcs,
    processTotals,
    totalProcessCost,
    processCostPerPcs,
    manufacturingCost,
    manufacturingCostPerPcs,
    overheadCost,
    adminCost,
    transportCost,
    otherCostsBreakdown,
    totalOtherCost,
    baseTotalCost,
    totalCost,
    costPerPiece,
    costPerDozen,
    costPer100,
    costPer1000,
    sellingPrice,
    sellingPricePerPiece,
    sellingPricePerDozen,
    sellingPricePer100,
    sellingPricePer1000,
    profitAmount,
    profitMarginPercent,
    conversionRateUsed: exchangeRate,
    currencySymbol,
    isBDTPrimary: isBDT,
    bdtTotalCost,
    bdtCostPerPiece,
    bdtCostPerDozen,
    bdtCostPer100,
    bdtCostPer1000,
    bdtSellingPrice,
    bdtSellingPricePerPiece,
    bdtSellingPricePerDozen,
    bdtSellingPricePer100,
    bdtSellingPricePer1000,
    bdtProfitAmount,
    usdTotalCost,
    usdCostPerPiece,
    usdCostPerDozen,
    usdCostPer100,
    usdCostPer1000,
    usdSellingPrice,
    usdSellingPricePerPiece,
    usdSellingPricePerDozen,
    usdSellingPricePer100,
    usdSellingPricePer1000,
    usdProfitAmount,
    selectedCurrencyTotalCost: totalCost,
    selectedCurrencyCostPerPiece: costPerPiece,
    breakdownPercent,
    isValid: true
  };
}

export const COMMON_PROCESS_TEMPLATES = [
  'Printing',
  'Offset Printing',
  'Digital Printing',
  'Screen Printing',
  'Cutting',
  'Die Cutting',
  'Lamination',
  'Foiling',
  'Embossing',
  'Debossing',
  'UV Spot',
  'Gluing',
  'Folding',
  'Sewing',
  'Eyelet',
  'Stringing',
  'Punching',
  'Finishing',
  'Packing'
];
