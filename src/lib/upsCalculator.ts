export type DimensionUnit = 'mm' | 'cm' | 'inch';

export interface UPSCalculationInput {
  productWidth: number;
  productHeight: number;
  productUnit: DimensionUnit;

  paperWidth: number;
  paperHeight: number;
  paperUnit: DimensionUnit;

  gripperMm: number;
  gapMm: number;
  topBottomMarginMm: number;
  leftRightMarginMm: number;

  selectedPrice?: number;
  priceSource?: 'previous' | 'manual';
  costBasis?: 'per_sheet' | 'per_product';

  additionalCosts?: {
    paperCost?: number;
    printingCost?: number;
    plateCost?: number;
    cuttingCost?: number;
    laminationCost?: number;
    foilingCost?: number;
    embossCost?: number;
    glueCost?: number;
    otherCost?: number;
  };
}

export interface OrientationCalculation {
  columns: number;
  rows: number;
  ups: number;
  productWidthMm: number;
  productHeightMm: number;
}

export interface UPSCalculationResult {
  usablePaperWidthMm: number;
  usablePaperHeightMm: number;
  paperWidthMm: number;
  paperHeightMm: number;
  productWidthMm: number;
  productHeightMm: number;

  portrait: OrientationCalculation;
  landscape: OrientationCalculation;

  bestOrientation: 'PORTRAIT' | 'LANDSCAPE';
  bestUPS: number;
  bestColumns: number;
  bestRows: number;
  bestProductWidthMm: number;
  bestProductHeightMm: number;

  paperAreaSqMm: number;
  usedAreaSqMm: number;
  unusedAreaSqMm: number;
  utilizationPercent: number;
  wastagePercent: number;

  costPerPiece: number;
  sheetCost: number;
  totalAdditionalCost: number;
  totalCostPerPieceWithAddons: number;

  isValid: boolean;
  errorMessage?: string;
}

export function convertToMm(val: number, unit: DimensionUnit): number {
  if (isNaN(val) || val <= 0) return 0;
  switch (unit) {
    case 'cm':
      return val * 10;
    case 'inch':
      return val * 25.4;
    case 'mm':
    default:
      return val;
  }
}

export function convertMmToUnit(valMm: number, unit: DimensionUnit): number {
  if (isNaN(valMm) || valMm <= 0) return 0;
  switch (unit) {
    case 'cm':
      return valMm / 10;
    case 'inch':
      return valMm / 25.4;
    case 'mm':
    default:
      return valMm;
  }
}

export function calculateUPS(input: UPSCalculationInput): UPSCalculationResult {
  const productWidthMm = convertToMm(input.productWidth, input.productUnit);
  const productHeightMm = convertToMm(input.productHeight, input.productUnit);
  const paperWidthMm = convertToMm(input.paperWidth, input.paperUnit);
  const paperHeightMm = convertToMm(input.paperHeight, input.paperUnit);

  const gripperMm = Math.max(0, input.gripperMm || 0);
  const gapMm = Math.max(0, input.gapMm || 0);
  const topBottomMarginMm = Math.max(0, input.topBottomMarginMm || 0);
  const leftRightMarginMm = Math.max(0, input.leftRightMarginMm || 0);

  const usablePaperWidthMm = paperWidthMm - (2 * leftRightMarginMm);
  const usablePaperHeightMm = paperHeightMm - (2 * topBottomMarginMm) - gripperMm;

  if (paperWidthMm <= 0 || paperHeightMm <= 0) {
    return {
      usablePaperWidthMm: 0, usablePaperHeightMm: 0, paperWidthMm: 0, paperHeightMm: 0,
      productWidthMm, productHeightMm,
      portrait: { columns: 0, rows: 0, ups: 0, productWidthMm, productHeightMm },
      landscape: { columns: 0, rows: 0, ups: 0, productWidthMm: productHeightMm, productHeightMm: productWidthMm },
      bestOrientation: 'PORTRAIT', bestUPS: 0, bestColumns: 0, bestRows: 0, bestProductWidthMm: productWidthMm, bestProductHeightMm: productHeightMm,
      paperAreaSqMm: 0, usedAreaSqMm: 0, unusedAreaSqMm: 0, utilizationPercent: 0, wastagePercent: 0,
      costPerPiece: 0, sheetCost: 0, totalAdditionalCost: 0, totalCostPerPieceWithAddons: 0,
      isValid: false, errorMessage: 'Paper dimensions must be greater than 0.'
    };
  }

  if (productWidthMm <= 0 || productHeightMm <= 0) {
    return {
      usablePaperWidthMm, usablePaperHeightMm, paperWidthMm, paperHeightMm,
      productWidthMm, productHeightMm,
      portrait: { columns: 0, rows: 0, ups: 0, productWidthMm, productHeightMm },
      landscape: { columns: 0, rows: 0, ups: 0, productWidthMm: productHeightMm, productHeightMm: productWidthMm },
      bestOrientation: 'PORTRAIT', bestUPS: 0, bestColumns: 0, bestRows: 0, bestProductWidthMm: productWidthMm, bestProductHeightMm: productHeightMm,
      paperAreaSqMm: paperWidthMm * paperHeightMm, usedAreaSqMm: 0, unusedAreaSqMm: paperWidthMm * paperHeightMm, utilizationPercent: 0, wastagePercent: 100,
      costPerPiece: 0, sheetCost: 0, totalAdditionalCost: 0, totalCostPerPieceWithAddons: 0,
      isValid: false, errorMessage: 'Product dimensions must be greater than 0.'
    };
  }

  if (usablePaperWidthMm <= 0 || usablePaperHeightMm <= 0) {
    return {
      usablePaperWidthMm, usablePaperHeightMm, paperWidthMm, paperHeightMm,
      productWidthMm, productHeightMm,
      portrait: { columns: 0, rows: 0, ups: 0, productWidthMm, productHeightMm },
      landscape: { columns: 0, rows: 0, ups: 0, productWidthMm: productHeightMm, productHeightMm: productWidthMm },
      bestOrientation: 'PORTRAIT', bestUPS: 0, bestColumns: 0, bestRows: 0, bestProductWidthMm: productWidthMm, bestProductHeightMm: productHeightMm,
      paperAreaSqMm: paperWidthMm * paperHeightMm, usedAreaSqMm: 0, unusedAreaSqMm: paperWidthMm * paperHeightMm, utilizationPercent: 0, wastagePercent: 100,
      costPerPiece: 0, sheetCost: 0, totalAdditionalCost: 0, totalCostPerPieceWithAddons: 0,
      isValid: false, errorMessage: 'Gripper and Margins exceed total paper dimensions.'
    };
  }

  // Portrait Calculation (Product placed as Width x Height)
  const portraitCols = Math.max(0, Math.floor((usablePaperWidthMm + gapMm) / (productWidthMm + gapMm)));
  const portraitRows = Math.max(0, Math.floor((usablePaperHeightMm + gapMm) / (productHeightMm + gapMm)));
  const portraitUPS = portraitCols * portraitRows;

  const portrait: OrientationCalculation = {
    columns: portraitCols,
    rows: portraitRows,
    ups: portraitUPS,
    productWidthMm,
    productHeightMm,
  };

  // Landscape Calculation (Product rotated 90 deg: Height x Width)
  const landscapeCols = Math.max(0, Math.floor((usablePaperWidthMm + gapMm) / (productHeightMm + gapMm)));
  const landscapeRows = Math.max(0, Math.floor((usablePaperHeightMm + gapMm) / (productWidthMm + gapMm)));
  const landscapeUPS = landscapeCols * landscapeRows;

  const landscape: OrientationCalculation = {
    columns: landscapeCols,
    rows: landscapeRows,
    ups: landscapeUPS,
    productWidthMm: productHeightMm,
    productHeightMm: productWidthMm,
  };

  // Best Orientation Selection
  let bestOrientation: 'PORTRAIT' | 'LANDSCAPE' = 'PORTRAIT';
  let bestUPS = portraitUPS;
  let bestColumns = portraitCols;
  let bestRows = portraitRows;
  let bestProductWidthMm = productWidthMm;
  let bestProductHeightMm = productHeightMm;

  if (landscapeUPS > portraitUPS) {
    bestOrientation = 'LANDSCAPE';
    bestUPS = landscapeUPS;
    bestColumns = landscapeCols;
    bestRows = landscapeRows;
    bestProductWidthMm = productHeightMm;
    bestProductHeightMm = productWidthMm;
  }

  const paperAreaSqMm = paperWidthMm * paperHeightMm;
  const usedAreaSqMm = bestUPS * productWidthMm * productHeightMm;
  const unusedAreaSqMm = Math.max(0, paperAreaSqMm - usedAreaSqMm);
  const utilizationPercent = paperAreaSqMm > 0 ? (usedAreaSqMm / paperAreaSqMm) * 100 : 0;
  const wastagePercent = Math.max(0, 100 - utilizationPercent);

  // Costing
  const price = input.selectedPrice || 0;
  const costBasis = input.costBasis || 'per_sheet';

  let costPerPiece = 0;
  let sheetCost = 0;

  if (costBasis === 'per_sheet') {
    sheetCost = price;
    costPerPiece = bestUPS > 0 ? price / bestUPS : 0;
  } else {
    costPerPiece = price;
    sheetCost = price * bestUPS;
  }

  const addons = input.additionalCosts || {};
  const totalAdditionalCost = (addons.paperCost || 0) +
    (addons.printingCost || 0) +
    (addons.plateCost || 0) +
    (addons.cuttingCost || 0) +
    (addons.laminationCost || 0) +
    (addons.foilingCost || 0) +
    (addons.embossCost || 0) +
    (addons.glueCost || 0) +
    (addons.otherCost || 0);

  const totalCostPerPieceWithAddons = costPerPiece + (bestUPS > 0 ? totalAdditionalCost / bestUPS : 0);

  return {
    usablePaperWidthMm,
    usablePaperHeightMm,
    paperWidthMm,
    paperHeightMm,
    productWidthMm,
    productHeightMm,
    portrait,
    landscape,
    bestOrientation,
    bestUPS,
    bestColumns,
    bestRows,
    bestProductWidthMm,
    bestProductHeightMm,
    paperAreaSqMm,
    usedAreaSqMm,
    unusedAreaSqMm,
    utilizationPercent,
    wastagePercent,
    costPerPiece,
    sheetCost,
    totalAdditionalCost,
    totalCostPerPieceWithAddons,
    isValid: bestUPS > 0,
    errorMessage: bestUPS === 0 ? 'Product size exceeds usable paper area.' : undefined
  };
}

export const STANDARD_PAPER_PRESETS = [
  { label: '28 × 22 Inch', width: 28, height: 22, unit: 'inch' as DimensionUnit },
  { label: '30 × 22 Inch', width: 30, height: 22, unit: 'inch' as DimensionUnit },
  { label: '25 × 19 Inch', width: 25, height: 19, unit: 'inch' as DimensionUnit },
  { label: '23 × 18 Inch', width: 23, height: 18, unit: 'inch' as DimensionUnit },
  { label: 'Custom', width: 0, height: 0, unit: 'inch' as DimensionUnit },
];

export const STANDARD_MACHINES = [
  { name: 'Standard Offset Press (Gripper 10mm)', gripperMm: 10, gapMm: 3, topBottomMarginMm: 5, leftRightMarginMm: 5 },
  { name: 'Label Printing Machine (Gripper 8mm)', gripperMm: 8, gapMm: 2, topBottomMarginMm: 3, leftRightMarginMm: 3 },
  { name: 'Digital Sheetfed Press (Gripper 6mm)', gripperMm: 6, gapMm: 2, topBottomMarginMm: 4, leftRightMarginMm: 4 },
  { name: 'Custom Configuration', gripperMm: 10, gapMm: 3, topBottomMarginMm: 5, leftRightMarginMm: 5 }
];
