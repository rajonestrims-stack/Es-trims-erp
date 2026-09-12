import { Timestamp } from 'firebase/firestore';

export interface SubMenuPermission {
  canView: boolean;
  canPost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  approvalNeeded?: boolean;
  approverUid?: string;
  approverName?: string;
}

export interface ApprovalRequest {
  id: string;
  businessId: string;
  module: string;
  moduleName: string;
  actionType: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  amount?: number;
  currency?: string;
  currencyCode?: string;
  currencySymbol?: string;
  requestedByUid: string;
  requestedByName: string;
  requestedByEmail?: string;
  approverType?: 'user' | 'role';
  approverUid?: string;
  approverEmail?: string;
  approverName?: string;
  approverRole?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
}

export function getSubmenuApprovalConfig(
  userProfile: UserProfile | null | undefined,
  roles: UserRolePermission[] | undefined,
  subId: string
): { approvalNeeded: boolean; approverUid?: string; approverName?: string } {
  if (!userProfile) return { approvalNeeded: false };
  // Admin role or Super Admin email bypasses approval requirement
  if (userProfile.role === 'Admin' || userProfile.email === 'rajonpaul300@gmail.com') {
    return { approvalNeeded: false };
  }
  if (!roles || roles.length === 0) {
    return { approvalNeeded: false };
  }
  const userRole = roles.find(r => r.name === userProfile.role || r.id === userProfile.role);
  if (!userRole || !userRole.menuPermissions) {
    return { approvalNeeded: false };
  }
  const perm = userRole.menuPermissions[subId];
  if (perm && perm.approvalNeeded && perm.approverUid) {
    return {
      approvalNeeded: true,
      approverUid: perm.approverUid,
      approverName: perm.approverName || 'Designated Approver'
    };
  }
  return { approvalNeeded: false };
}

export interface ModuleActions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  print: boolean;
}

export interface SpecialPermissions {
  canApproveGRN?: boolean;
  canViewAccounts?: boolean;
  canEditStock?: boolean;
  canDeleteTx?: boolean;
  canApprovePO?: boolean;
  canPrintReports?: boolean;
  [key: string]: boolean | undefined;
}

export interface UserRolePermission {
  id: string;
  name: string;
  businessId: string;
  allowedPages: string[];
  menuPermissions?: Record<string, SubMenuPermission>;
  modulePermissions?: Record<string, ModuleActions>;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove?: boolean;
  canPrint?: boolean;
  description?: string;
  createdAt?: Timestamp;
}

export type RoleDefinition = UserRolePermission;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  name?: string; // Add name as alias for displayName or additional field
  department?: string;
  designation?: string;
  role: string; // Accepts 'Super Admin', 'MD', 'GM', 'Sales Manager', 'Commercial Manager', 'Purchase Manager', 'Store Manager', 'Production Manager', 'Accounts Manager', 'Data Entry Operator', or any custom role name
  businessId: string;
  businessName?: string;
  joinedAt?: Timestamp;
  customModulePermissions?: Record<string, ModuleActions>;
  specialPermissions?: SpecialPermissions;
  allowedPages?: string[];
  customPermissions?: Record<string, any>;
  employeeName?: string;
  roleId?: string;
  roleName?: string;
  username?: string;
  designationName?: string;
  departmentName?: string;
}

export interface Category {
  id: string;
  name: string;
  ownerId: string;
  businessId: string;
}

export interface Batch {
  quantity: number;
  price: number;
  date: Timestamp;
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  categoryId?: string;
  unit: string;
  minStock?: number;
  currentStock: number;
  avgCost: number;
  averagePrice?: number; // Alias for avgCost
  totalValue?: number;
  batches: Batch[];
  ownerId: string;
  businessId: string;
  description?: string;
  updatedAt?: Timestamp;
  status?: 'active' | 'pending_delete';
}

export interface ProductionFormula {
  id: string;
  itemId: string;
  piecesPerSheet: number;
  extraPercent: number;
  businessId: string;
  ownerId: string;
}

export interface Transaction {
  id: string;
  itemId: string;
  type: 'IN' | 'OUT' | 'PRODUCTION' | 'EXTRA_REQUISITION' | 'PRODUCTION_RETURN' | 'PURCHASE_RETURN';
  quantity: number;
  price: number;
  date: Timestamp;
  reference?: string;
  purchaseType?: 'Local' | 'Bond';
  notes?: string;
  ownerId: string;
  businessId: string;
  status?: 'active' | 'pending_delete';
  // Supplier metadata
  supplierId?: string;
  supplierName?: string;
  poNumber?: string;
  poId?: string;
  // Store Requisition metadata
  srNo?: string;
  department?: string;
  location?: string;
  requestorName?: string;
  designation?: string;
  purpose?: string;
  jobNo?: string;
  style?: string;
  requiredDate?: string;
  itemSpecification?: string;
  itemRemarks?: string;
}

export interface StoreRequisitionItem {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  specification?: string;
  unit?: string;
  quantity: number;
  productionQty?: number;
  ups?: number;
  baseSheets?: number;
  roundedSheets?: number;
  extraSheets?: number;
  wastagePercent?: number;
  bomNo?: string;
  bomId?: string;
  notes?: string;
  remarks?: string;
}

export interface StoreRequisitionData {
  id?: string;
  srNo: string;
  srDate: string;
  requiredDate?: string;
  department?: string;
  location?: string;
  requestorName?: string;
  designation?: string;
  purpose?: string;
  jobNo?: string;
  woId?: string;
  woNumber?: string;
  finishedGoodsId?: string;
  finishedGoodsNo?: string;
  finishedGoodsName?: string;
  bomId?: string;
  bomNo?: string;
  style?: string;
  type: 'PRODUCTION' | 'EXTRA_REQUISITION';
  remarks?: string;
  notes?: string;
  items: StoreRequisitionItem[];
  businessId?: string;
  ownerId?: string;
  createdAt?: any;
}

export interface StockReport {
  itemId: string;
  itemName: string;
  sku: string;
  openingStock: number;
  inQty: number;
  outQty: number;
  closingStock: number;
  unit: string;
}

export interface Supplier {
  id: string;
  name: string;
  partyCategory?: string;
  partyType?: string;
  partyCode?: string;
  
  // Address Fields
  addressType?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  pin?: string;
  state?: string;
  country?: string;
  
  // Contact Fields
  contactPurpose?: string;
  contactType?: string;
  contactPerson?: string;
  designation?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  email2?: string;
  location?: string;

  address?: string;
  openingBalance: number; // positive = payable to supplier
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  sku?: string;
  unit?: string;
  quantity: number;
  price: number;
  total: number;
  specification?: string;
  requisitionItemId?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  date: Timestamp;
  supplierId: string;
  supplierName: string;
  purchaseType?: 'Local' | 'Bond';
  notes?: string;
  items: PurchaseOrderItem[];
  subtotal?: number;
  vatPercent?: number;
  vatAmount?: number;
  aitPercent?: number;
  aitAmount?: number;
  discount?: number;
  totalAmount: number;
  deliveryDate?: string;
  deliveryTo?: string;
  termsConditions?: string;
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  requisitionId?: string;
  requisitionNo?: string;
  businessId: string;
  ownerId: string;
  status?: 'active' | 'pending_delete';
  createdAt?: Timestamp;
}

export interface PurchaseRequisitionItem {
  id?: string;
  itemId: string;
  itemName: string;
  sku?: string;
  category?: string;
  unit?: string;
  currentStock?: number;
  quantity: number;
  previousPrice: number;
  priceSource?: string;
  unitPrice: number;
  totalAmount: number;
  remarks?: string;
  specification?: string;
  orderedQty?: number;
}

export interface PurchaseRequisition {
  id: string;
  reqNo: string;
  date: string;
  requiredDate?: string;
  department?: string;
  requestorName?: string;
  purpose?: string;
  remarks?: string;
  items: PurchaseRequisitionItem[];
  totalQty: number;
  totalAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'partially_ordered' | 'cancelled';
  approvedBy?: string;
  approvedAt?: any;
  approvalRemarks?: string;
  poIds?: string[];
  poNumbers?: string[];
  businessId: string;
  ownerId: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface PaymentAllocation {
  poId: string;
  poNumber: string;
  allocatedAmount: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentDate: Timestamp;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  allocations?: PaymentAllocation[];
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

// --- Sales & Order Entry Masters & Workflow Interfaces ---

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  country?: string;
  currency?: string;
  conversionRate?: number; // Customer specific conversion rate to BDT (e.g. 122.50)
  conversionRateBDT?: number;
  currencyRates?: Record<string, number>; // Map of currency code -> BDT rate, e.g. { USD: 122.5, EUR: 132 }
  paymentTerms?: string;
  deliveryTerms?: string;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Buyer {
  id: string;
  buyerCode: string;
  name: string;
  customerId?: string; // Linked Customer ID
  contactPerson?: string;
  phone?: string;
  email?: string;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface SectionMaster {
  id: string;
  sectionCode: string;
  name: string;
  status: 'active' | 'inactive';
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface ProductionProcessMaster {
  id: string;
  processCode: string;
  processName: string;
  sectionId: string;
  sectionName: string;
  sequenceOrder?: number;
  description?: string;
  status: 'active' | 'inactive';
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface FgCategory {
  id: string;
  categoryCode: string;
  name: string;
  description?: string;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface FgSubCategory {
  id: string;
  categoryId?: string;
  categoryName?: string;
  subCategoryCode: string;
  name: string;
  description?: string;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface FinishedGoods {
  id: string;
  fgNo: string;
  name: string;
  customerId?: string;
  customerName?: string;
  categoryId?: string;
  categoryName?: string;
  subCategoryId?: string;
  subCategoryName?: string;
  productCategory?: string;
  productType?: string;
  unit: string;
  defaultSpecification?: string;
  defaultPrice?: number;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface CurrencyMaster {
  id: string;
  code: string; // BDT, USD, EUR, GBP
  name: string;
  symbol: string;
  rateToBDT?: number; // Base exchange/conversion rate to BDT (e.g. 120.00 for USD)
  isDefault?: boolean;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PriceMaster {
  id: string;
  customerId: string;
  customerName: string;
  finishedGoodsId: string;
  finishedGoodsNo: string;
  finishedGoodsName: string;
  style?: string; // Optional style-specific pricing
  currencyId?: string;
  currencyCode?: string; // BDT or USD
  unit?: string; // e.g. PCS, DZN, GROSS, SET, KG, YDS, MTR, 1000 PCS, etc.
  rate: number;
  effectiveDate: string;
  status: 'active' | 'inactive' | 'pending_approval';
  pendingRate?: number;
  pendingStyle?: string;
  pendingUnit?: string;
  pendingCurrencyCode?: string;
  pendingCurrencyId?: string;
  pendingEffectiveDate?: string;
  requestedBy?: string;
  requestedAt?: any;
  approvedBy?: string;
  approvedAt?: any;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SizeMaster {
  id: string;
  code: string;
  name: string;
  businessId: string;
}

export interface ColorMaster {
  id: string;
  code: string;
  name: string;
  hexColor?: string;
  businessId: string;
}

export interface OrderItemBreakdown {
  id?: string;
  style?: string;
  size?: string;
  color?: string;
  orderNo?: string;
  quantity: number;
  unit?: string;
  rate?: number;
  total?: number;
  priceSource?: 'Customer + Style Price' | 'Customer Price' | 'General Price' | 'Manual';
}

export interface CustomerOrderItem {
  id: string;
  fgId: string;
  fgNo: string;
  fgName: string;
  category: string;
  subCategory: string;
  unit: string;
  orderQty: number;
  rate: number;
  amount: number;
  priceSource?: string;
  breakdownType: 'none' | 'size' | 'color' | 'size_color';
  breakdowns: OrderItemBreakdown[];
}

export interface WorkOrderBreakdownRow {
  id: string;
  jobNo?: string;
  style: string;
  color?: string;
  size: string;
  orderNo: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  priceSource?: string;
  finishedGoodsId?: string;
  finishedGoodsNo?: string;
  finishedGoodsName?: string;
  requiredSheets?: number;
  ups?: number;
  bomNo?: string;
}

export interface WorkOrderAuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  performedByUid: string;
  details?: string;
}

export interface OrderAuditTrail {
  createdByUid?: string;
  createdByName?: string;
  createdAt?: string | Timestamp;
  confirmedByUid?: string;
  confirmedByName?: string;
  confirmedAt?: string | Timestamp;
  approvedByUid?: string;
  approvedByName?: string;
  approvedAt?: string | Timestamp;
  rejectedByUid?: string;
  rejectedByName?: string;
  rejectedAt?: string | Timestamp;
  unlockedByUid?: string;
  unlockedByName?: string;
  unlockedAt?: string | Timestamp;
  lastEditedByUid?: string;
  lastEditedByName?: string;
  lastEditedAt?: string | Timestamp;
  logs?: WorkOrderAuditLog[];
}

export interface CustomerOrder {
  id: string;
  coNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  customerCode?: string;
  buyerId: string;
  buyerName: string;
  sectionId: string;
  sectionName: string;
  piNo: string;
  poNo?: string;
  deliveryDate?: string;
  style: string;
  isFoc: boolean;
  focNote?: string;
  currencyId: string;
  currencyCode: string;
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  status: 'draft' | 'confirmed' | 'pending_approval' | 'approved' | 'rejected' | 'returned' | 'cancelled' | 'closed' | 'locked' | 'in_progress' | 'completed';
  isLocked: boolean;
  items: CustomerOrderItem[];
  auditTrail: OrderAuditTrail;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface WorkOrderProcessStep {
  id: string;
  processCode: string;
  processName: string;
  sequenceOrder?: number;
  isIncluded: boolean;
  notes?: string;
}

export interface WorkOrder {
  id: string;
  woNumber: string; // WO-2026-000001
  orderNo: string; // SO-2026-000125
  poNo: string; // PO-ABC-2026-001
  date: string; // Order Date YYYY-MM-DD
  deliveryDate?: string; // Delivery Date DD-MM-YYYY or YYYY-MM-DD
  coId?: string;
  coNumber?: string;
  customerId: string;
  customerName: string;
  customerCode?: string;
  customerAddress?: string;
  customerContact?: string;
  customerPhone?: string;
  customerEmail?: string;
  country?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  buyerId: string;
  buyerName: string;
  sectionId?: string;
  sectionName?: string;
  finishedGoodsId?: string;
  finishedGoodsNo?: string;
  finishedGoodsName?: string;
  finishedGoodsCategory?: string;
  finishedGoodsUnit?: string;
  finishedGoodsSpec?: string;
  piNo?: string;
  style?: string;
  currencyId?: string;
  currencyCode?: string;
  rate?: number;
  priceSource?: string;
  manualPriceOverride?: boolean;
  isFreeOfCost?: boolean;
  focRefJobNo?: string;
  focRemark?: string;
  selectedProcesses?: WorkOrderProcessStep[];
  breakdownRows: WorkOrderBreakdownRow[];
  items?: CustomerOrderItem[];
  totalQuantity: number;
  totalAmount: number;
  requiredSheets?: number; // Total required raw material units (Rolls / Sheets) calculated from BOM & Total Qty
  rawMaterialUnit?: string; // Unit label (Roll, Sheet, etc.)
  conversionRate?: number; // Conversion rate to BDT applied on this order
  totalAmountBDT?: number; // Converted total value in BDT
  status: 'draft' | 'confirmed' | 'pending_approval' | 'approved' | 'rejected' | 'returned' | 'cancelled' | 'closed' | 'pending' | 'in_production' | 'completed';
  isLocked?: boolean;
  approvalRequestId?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  auditLogs?: WorkOrderAuditLog[];
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

// --- Production & Despatch Interfaces ---

export interface BomItem {
  id?: string;
  rawMaterialId: string;
  rawMaterialName: string;
  sku?: string;
  unit: string;
  consumptionQty: number;
  wastagePercent: number;
  totalRequiredQty: number;
  process?: string;
  remarks?: string;
}

export interface BomMaster {
  id: string;
  bomNo: string; // e.g. BOM-2026-0001
  productId: string; // Finished Goods ID
  productName: string;
  productCode: string; // FG No
  version: string;
  effectiveDate: string;
  unit: string;
  ups?: number; // Pieces produced per 1 sheet
  piecesPerSheet?: number; // Same as UPS
  sheetItemId?: string; // Raw material store item used as sheet
  sheetItemName?: string;
  sheetUnit?: string;
  wastagePercent?: number;
  processId?: string;
  processName?: string;
  remarks?: string;
  items: BomItem[];
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface ProductionProcessExecution {
  id: string;
  woId: string;
  woNumber: string;
  processId: string;
  processCode: string;
  processName: string;
  sequenceOrder: number;
  plannedQty: number;
  previousCompletedQty: number;
  availableInputQty: number;
  completedQty: number;
  rejectQty: number;
  balanceQty: number;
  employee?: string;
  machine?: string;
  startDate?: string;
  completionDate?: string;
  remarks?: string;
  status: 'Not Started' | 'Running' | 'Partially Completed' | 'Completed' | 'Hold' | 'Cancelled';
  updatedAt?: any;
  updatedBy?: string;
  businessId: string;
  ownerId: string;
}

export interface ProductionTransactionRecord {
  id: string;
  woId: string;
  woNumber: string;
  processCode: string;
  processName: string;
  sequenceOrder?: number;
  date: string;
  inputQty: number;
  completedQty: number;
  rejectQty: number;
  employee?: string;
  machine?: string;
  remarks?: string;
  createdAt?: Timestamp;
  createdBy?: string;
  businessId: string;
  ownerId: string;
}

export interface ProductionRequisitionItem {
  rawMaterialId: string;
  rawMaterialName: string;
  sku?: string;
  requiredQty: number;
  availableStock: number;
  shortageQty: number;
  unit: string;
  store?: string;
  remarks?: string;
}

export interface ProductionRequisitionRecord {
  id: string;
  reqNo: string; // e.g. FREQ-2026-0001
  woId: string;
  woNumber: string;
  productId: string;
  productName: string;
  productionQty: number;
  baseSheets?: number;
  extraSheets?: number;
  extraRemarks?: string;
  totalSheets?: number;
  bomId?: string;
  bomNo?: string;
  store: string;
  remarks?: string;
  status: 'pending' | 'issued' | 'rejected' | 'confirmed';
  date: string;
  items: ProductionRequisitionItem[];
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
  issuedAt?: Timestamp;
  issuedBy?: string;
}

export interface DeliveryChallanItem {
  id?: string;
  breakdownId?: string;
  selected?: boolean;
  sn?: number;
  subCategory?: string;
  bookingNo?: string;
  style?: string;
  jobNo?: string;
  poNo?: string;
  itemNo?: string;
  color?: string;
  size?: string;
  measurement?: string;
  itemDescription?: string;
  orderQty: number;
  pChallanQty?: number;
  availableQty?: number;
  challanQty: number;
  balanceQty: number;
  unit?: string;
  remarks?: string;
}

export interface DeliveryChallanRecord {
  id: string;
  challanNo: string; // e.g. CLN-000191-2026 or DC-2026-000001
  challanDate: string; // e.g. 28/07/2026
  woId: string;
  woNumber: string; // e.g. SO-000086-2026 / WO-000063-2026
  woBagNo?: string; // e.g. WO-000063-2026
  customerId: string;
  customerName: string;
  buyerName: string;
  poNo: string;
  piNo?: string; // e.g. CPI-000078-2026
  fscCoc?: string;
  invoiceAddress?: string;
  invoiceContactPerson?: string;
  deliveryAddress: string;
  deliveryContactPerson?: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
  deliveryType: string;
  totalBox?: string | number;
  productId: string;
  productName: string;
  productCode: string;
  style?: string;
  color?: string;
  size?: string;
  orderQty: number;
  productionCompletedQty: number;
  previouslyDeliveredQty: number;
  availableQty: number;
  currentDeliveryQty: number;
  remainingQty: number;
  unit: string;
  deliveryStatus: 'Pending Delivery' | 'Partially Delivered' | 'Fully Delivered';
  status: 'active' | 'cancelled';
  remarks?: string;
  items?: DeliveryChallanItem[];
  // Receipt / Acknowledgment tracking
  receivedStatus?: 'pending' | 'received' | 'rejected';
  receivedDate?: string;
  receiverName?: string;
  receivedQty?: number;
  receiverRemarks?: string;
  receivedAt?: any;
  receivedBy?: string;
  rejectionReason?: string;
  rejectedDate?: string;
  rejectedBy?: string;
  rejectedQty?: number;
  isLocked?: boolean;
  gatePassId?: string;
  gatePassNo?: string;
  gatePassStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  correctionStatus?: 'none' | 'requested' | 'approved' | 'rectified';
  activeCorrectionRequestId?: string;
  correctionHistory?: {
    requestId?: string;
    reason: string;
    rectifiedBy: string;
    rectifiedAt: string;
    changesSummary?: string;
  }[];
  preparedBy: string;
  preparedByUid?: string;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface ChallanCorrectionRequest {
  id?: string;
  challanId: string;
  challanNo: string;
  woId: string;
  woNumber: string;
  customerName: string;
  buyerName?: string;
  originalDeliveryQty: number;
  reason: string;
  proposedChanges?: string;
  requestedBy: string;
  requestedByUid?: string;
  requestedAt: any;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reviewedBy?: string;
  reviewedByUid?: string;
  reviewedAt?: any;
  reviewNotes?: string;
  rectifiedBy?: string;
  rectifiedAt?: any;
  rectificationNotes?: string;
  businessId: string;
  ownerId?: string;
}

export interface GatePassRecord {
  id: string;
  gatePassNo: string; // e.g. GP-2026-000001
  challanId: string;
  challanNo: string;
  gatePassDate: string;
  woId: string;
  woNumber: string;
  customerName: string;
  buyerName?: string;
  productName: string;
  deliveryQty: number;
  unit?: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
  deliveryType?: string;
  remarks?: string;
  status: 'active' | 'exited' | 'cancelled';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  confirmedBy?: string;
  confirmedAt?: any;
  approvedBy?: string;
  approvedByUid?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedByUid?: string;
  rejectedAt?: any;
  rejectionReason?: string;
  issuedBy: string;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface CustomerMrrReceipt {
  id: string;
  mrrNo: string; // Manually input MRR Number (Mandatory)
  mrrDate: string; // e.g. YYYY-MM-DD
  challanId: string;
  challanNo: string;
  challanDate: string;
  woId?: string;
  woNumber?: string;
  customerId: string;
  customerName: string;
  buyerName?: string;
  poNo?: string;
  piNo?: string;
  productName?: string;
  productCode?: string;
  challanQty: number; // Total quantity from Delivery Challan
  mrrQty: number; // Accepted MRR quantity (manually input / edited)
  unit?: string;
  remarks?: string;
  billingStatus?: 'pending' | 'partially_billed' | 'billed';
  billedQty?: number;
  unbilledQty?: number;
  businessId: string;
  ownerId: string;
  createdAt?: Timestamp;
  createdBy?: string;
}

// ==========================================
// SUB CONTRACT MODULE TYPES
// ==========================================

export interface SubContractCategory {
  id: string;
  categoryCode: string; // e.g. CAT-DYE, CAT-WOV, CAT-EMB
  categoryName: string; // e.g. Dyeing, Woven, Embroidery, Printing, Washing, Finishing
  description?: string;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface SubContractSubCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  subCategoryCode: string; // e.g. SUB-DYE-01, SUB-WOV-01
  subCategoryName: string; // e.g. Reactive Dyeing, Disperse Dyeing, Jacquard, Taffeta, 3D Embroidery, Screen Print, etc.
  orderType?: 'dyeing' | 'woven' | 'embroidery' | 'printing' | 'washing' | 'finishing' | 'other';
  defaultUnit: string; // KG, Pcs, Yds, Mtr, Dozen, etc.
  description?: string;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface SubContractItem {
  id: string;
  itemCode: string; // Unique e.g. DYE-001, WOV-001, EMB-001
  itemName: string; // e.g. Fabric Dyeing, Reactive Dyeing, Computer Embroidery
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  unit: string; // KG, Pcs, Yds, Mtr, Dozen, etc.
  description?: string;
  specification?: string;
  defaultSupplierId?: string;
  defaultSupplierName?: string;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface SubContractPrice {
  id: string;
  supplierId: string;
  supplierName: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  unit: string;
  contractPrice: number;
  currency: string; // BDT, USD, EUR, etc.
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string; // YYYY-MM-DD (optional)
  status: 'active' | 'inactive';
  remarks?: string;
  previousPrice?: number;
  priceHistory?: {
    oldPrice: number;
    newPrice: number;
    changedDate: string;
    changedBy: string;
    remarks?: string;
  }[];
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface SubContractOrderItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  color?: string;
  colorCode?: string;
  style?: string;
  embroideryType?: string;
  remarks?: string;
}

export type SubContractOrderStatus = 
  | 'draft' 
  | 'confirmed' 
  | 'issued' 
  | 'partially_received' 
  | 'fully_received' 
  | 'completed' 
  | 'cancelled';

export interface SubContractOrder {
  id: string;
  orderNo: string; // e.g. SC-DYE-2026-0001, SC-WOV-2026-0001, SC-EMB-2026-0001
  orderType: 'dyeing' | 'woven' | 'embroidery' | 'printing' | 'washing' | 'finishing' | 'other';
  orderDate: string; // YYYY-MM-DD
  supplierId: string;
  supplierName: string;
  subContractRef?: string; // Reference or customer work order link
  buyerName?: string;
  customerName?: string;
  style?: string;
  color?: string;
  colorCode?: string;
  embroideryType?: string;
  fabricDetails?: string;
  items: SubContractOrderItem[];
  totalQuantity: number;
  totalAmount: number;
  currency: string;
  requiredDate?: string;
  deliveryDate?: string;
  issuedQuantity: number;
  receivedQuantity: number;
  balanceQuantity: number;
  status: SubContractOrderStatus;
  remarks?: string;
  businessId: string;
  ownerId?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface SubContractPurchaseOrderItem {
  itemId?: string;
  itemCode?: string;
  itemName: string;
  categoryId?: string;
  categoryName?: string;
  subCategoryId?: string;
  subCategoryName?: string;
  specification?: string;
  quantity: number;
  receivedQuantity?: number;
  balanceQuantity?: number;
  unit: string;
  rate: number;
  amount: number;
  remarks?: string;
  yarnDetails?: string;
  colorName?: string;
  colorCode?: string;
  fabricType?: string;
  stitchCount?: number;
  sizeDimension?: string;
}

export interface SubContractPurchaseOrder {
  id: string;
  poNumber: string; // e.g. SC-PO-2026-0001
  poDate: string;
  supplierId: string;
  supplierName: string;
  supplierAddress?: string;
  supplierContact?: string;
  supplierEmail?: string;
  subContractOrderId?: string;
  subContractOrderNo?: string;
  orderType: 'dyeing' | 'woven' | 'embroidery' | 'printing' | 'washing' | 'finishing' | 'other';
  categoryName?: string;
  items: SubContractPurchaseOrderItem[];
  totalQuantity?: number;
  receivedQuantity?: number;
  balanceQuantity?: number;
  subtotal: number;
  discount: number;
  taxVatPercent: number;
  taxVatAmount: number;
  taxAitPercent?: number;
  taxAitAmount?: number;
  additionalCharges: number;
  grandTotal: number;
  currency: string;
  deliveryDate?: string;
  deliveryTo?: string;
  termsConditions?: string;
  remarks?: string;
  status: 'draft' | 'confirmed' | 'approved' | 'issued' | 'partially_received' | 'fully_received' | 'completed' | 'cancelled';
  preparedBy: string;
  checkedBy?: string;
  approvedBy?: string;
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SubContractIssue {
  id: string;
  issueNo: string; // e.g. SC-ISS-2026-0001
  orderId?: string;
  orderNo?: string;
  poId?: string;
  poNumber?: string;
  supplierId: string;
  supplierName: string;
  orderType: string;
  itemId?: string;
  itemCode?: string;
  itemName: string;
  categoryName?: string;
  subCategoryName?: string;
  issueQuantity: number;
  unit: string;
  issueDate: string;
  challanNo: string;
  vehicleNo?: string;
  driverDetails?: string;
  remarks?: string;
  businessId: string;
  createdBy: string;
  createdAt?: any;
}

export interface SubContractReceiveItem {
  itemId?: string;
  itemName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  orderedQuantity: number;
  previouslyReceived: number;
  receivedQuantity: number;
  balanceQuantity: number;
  unit: string;
  rate?: number;
  amount?: number;
  remarks?: string;
}

export interface SubContractReceive {
  id: string;
  receiveNo: string; // e.g. SC-RCV-2026-0001
  poId?: string;
  poNumber?: string;
  orderId?: string;
  orderNo?: string;
  issueId?: string;
  issueNo?: string;
  supplierId: string;
  supplierName: string;
  orderType: string;
  items?: SubContractReceiveItem[];
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  categoryName?: string;
  subCategoryName?: string;
  receivedQuantity: number;
  unit: string;
  receiveDate: string;
  challanNo: string;
  supplierChallanNo?: string;
  qualityStatus: 'passed' | 'rejected' | 'rework' | 'accepted_with_deviation';
  vehicleNo?: string;
  driverDetails?: string;
  remarks?: string;
  businessId: string;
  createdBy: string;
  createdAt?: any;
}

export interface SubContractAuditLog {
  id: string;
  action: string;
  module: string;
  recordId: string;
  recordNo: string;
  summary: string;
  performedBy: string;
  performedAt: any;
  businessId: string;
}// ==========================================
// ACCOUNTS & FINANCE / BILLING TYPES
// ==========================================

export interface CustomerBillItem {
  id?: string;
  poNo: string; // P/O No from Work Order / MRR
  systemId: string; // System ID / Work Order No (e.g. SO-000086-2026 / WO-000063-2026)
  challanNo: string; // Delivery Chalan No
  date: string; // Challan / Delivery Date
  description: string; // Item Name / Description
  quantityPcs: number; // Quantity in Pcs (from MRR)
  quantityDoz: number; // Quantity in Dozen (quantityPcs / 12)
  pricePerPcs: number; // Price per piece (from Price Master or Work Order)
  pricePerDoz: number; // Price per Dozen (pricePerPcs * 12)
  amountUSD: number; // Total Amount in USD (quantityDoz * pricePerDoz)
  mrrId?: string; // Reference to customer_mrr_receipts
  mrrNo?: string;
  challanId?: string;
  woId?: string;
  productId?: string;
  style?: string;
  unit?: string;
}

export interface CustomerBill {
  id: string;
  billNo: string; // e.g. BILL-2026-000001
  billDate: string; // YYYY-MM-DD
  dueDate?: string;
  customerId: string;
  customerName: string;
  customerAddress?: string;
  buyerName?: string;
  currency: string; // Default USD
  currencySymbol?: string;
  items: CustomerBillItem[];
  totalQtyPcs: number;
  totalQtyDoz: number;
  totalAmountUSD: number;
  vatPercent?: number;
  vatAmount?: number;
  discountAmount?: number;
  grandTotalUSD: number;
  amountInWords?: string;
  paymentTerms?: string;
  remarks?: string;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
  businessId: string;
  ownerId: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ==========================================
// BANK LOAN & FINANCE MANAGEMENT TYPES
// ==========================================

export type BankFacilityType = 
  | 'import_loan'
  | 'upas'
  | 'ltr'
  | 'term_loan'
  | 'lc_purchase'
  | 'bank_od'
  | 'composite';

export type OverdueChargeBasis = 
  | 'overdue_principal'
  | 'overdue_interest'
  | 'overdue_installment'
  | 'total_overdue';

export type OverdueChargeFrequency = 
  | 'one_time'
  | 'per_month'
  | 'per_annum'
  | 'per_overdue_period';

export interface BankFacilitySanction {
  id: string;
  facilityNo: string; // e.g. SANCT-EBL-2026-001
  bankName: string; // e.g. Eastern Bank PLC, Dutch-Bangla Bank, City Bank
  branchName?: string;
  sanctionDate: string; // YYYY-MM-DD
  facilityType: BankFacilityType;
  sanctionedLimit: number;
  utilizedAmount?: number;
  availableLimit?: number;
  currency: string; // BDT, USD, EUR
  validFrom: string;
  validTo: string;
  interestRate: number; // e.g. 9.00%
  marginPercent: number; // e.g. 20%
  repaymentTerms?: string;
  tenorDays?: number;
  tenorMonths?: number;
  gracePeriodDays?: number;
  securityCollateral?: string;
  processingCharges?: number;
  
  // Overdue / Delayed Payment Rules (Configurable per facility)
  overdueRate: number; // default 1.50%
  overdueBasis: OverdueChargeBasis;
  overdueFrequency: OverdueChargeFrequency;
  graceDays: number; // grace period before overdue kicks in
  
  status: 'active' | 'expired' | 'suspended';
  businessId: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type LoanType = 'upas' | 'ltr' | 'term_loan' | 'lc_purchase' | 'bank_od';

export type LoanStatus = 
  | 'upcoming' 
  | 'due_today' 
  | 'due' 
  | 'overdue' 
  | 'partially_paid' 
  | 'fully_paid' 
  | 'closed';

export interface LoanInstallmentScheduleItem {
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'upcoming' | 'due_today' | 'due' | 'overdue' | 'paid' | 'partially_paid';
  paidDate?: string;
  overdueDays?: number;
  overdueCharge?: number;
}

export interface BankLoanRecord {
  id: string;
  loanNo: string; // e.g. LN-UPAS-2026-0001
  facilityId: string;
  facilityNo: string;
  bankName: string;
  loanType: LoanType;
  currency: string;
  
  // Principal & Financed calculations
  principalAmount: number; // LC Value / Import Value / Machine Cost
  marginPercent: number;
  marginAmount: number;
  financedAmount: number; // principalAmount - marginAmount
  interestRate: number; // % p.a.
  
  // Dates & Tenor
  interestStartDate: string;
  maturityDate: string;
  tenorDays?: number;
  tenorMonths?: number;
  
  // Amounts
  calculatedInterest: number;
  otherCharges: number;
  totalPayable: number;
  
  // Repayment tracking
  paidPrincipal: number;
  paidInterest: number;
  paidOtherCharges: number;
  paidOverdueCharges: number;
  totalPaidAmount: number;
  
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingOverdueCharge: number;
  netOutstanding: number;
  
  status: LoanStatus;
  
  // Overdue status & dynamic calculations
  overdueDays: number;
  overdueAmount: number;
  overdueChargeRate: number; // e.g. 1.50%
  calculatedOverdueCharge: number;
  lastOverdueCalculationDate?: string;
  
  // UPAS / LC Purchase specific
  lcNumber?: string;
  lcDate?: string;
  supplierName?: string;
  
  // LTR specific
  importBillNo?: string;
  customsDocNo?: string;
  
  // Term Loan specific
  machineryName?: string;
  machinerySupplier?: string;
  downPayment?: number;
  firstInstallmentDate?: string;
  installmentCount?: number;
  installmentFrequency?: 'monthly' | 'quarterly' | 'custom';
  installmentCalculationType?: 'emi' | 'equal_principal' | 'custom';
  emiAmount?: number;
  repaymentSchedule?: LoanInstallmentScheduleItem[];
  
  // Bank OD specific
  odOpeningBalance?: number;
  odDrawdownsTotal?: number;
  odRepaymentsTotal?: number;
  odAvailableLimit?: number;
  
  remarks?: string;
  businessId: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface LoanRepaymentRecord {
  id: string;
  repaymentNo: string; // e.g. REP-2026-0001
  loanId: string;
  loanNo: string;
  loanType: LoanType;
  bankName: string;
  facilityId?: string;
  paymentDate: string; // YYYY-MM-DD
  
  originalDueAmount: number;
  overdueDays: number;
  overdueAmount: number;
  overdueChargeRate: number;
  additionalOverdueCharge: number;
  totalPayable: number;
  
  amountPaid: number;
  
  // Allocation
  allocatedOverdueCharge: number;
  allocatedOtherCharges: number;
  allocatedInterest: number;
  allocatedPrincipal: number;
  remainingOutstanding: number;
  
  paymentMethod: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  paymentReference?: string;
  voucherNo?: string;
  glPosted?: boolean;
  remarks?: string;
  
  businessId: string;
  createdBy?: string;
  createdAt?: any;
}

export interface LoanGlVoucher {
  id: string;
  voucherNo: string; // e.g. JV-LOAN-2026-0001
  postingDate: string;
  voucherType: 'loan_disbursement' | 'interest_accrual' | 'overdue_charge' | 'loan_repayment' | 'od_drawdown' | 'od_repayment';
  loanId: string;
  loanNo: string;
  debitAccount: string;
  debitAccountCode?: string;
  creditAccount: string;
  creditAccountCode?: string;
  amount: number;
  currency: string;
  reference: string;
  narration: string;
  businessId: string;
  createdBy: string;
  createdAt?: any;
}

export interface OdTransaction {
  id: string;
  loanId: string;
  date: string;
  type: 'drawdown' | 'repayment' | 'interest_charge' | 'fee_charge';
  amount: number;
  balanceAfter: number;
  reference: string;
  remarks?: string;
  businessId: string;
  createdAt?: any;
}

// ==========================================
// COMMERCIAL & COMPANY & PROFORMA INVOICE (PI) TYPES
// ==========================================

export interface CompanyMaster {
  id: string;
  companyName: string; // e.g. "ES TRIMS LIMITED"
  companyCode?: string; // e.g. "EST"
  legalType?: string; // e.g. "Private Limited Company", "100% Export Oriented Garment Trims Unit"
  address: string; // Head Office / Registered Address
  factoryAddress?: string; // Factory / Production Plant Address
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  binNumber?: string; // Business Identification Number (13-digit BIN / VAT)
  tinNumber?: string; // Tax Identification Number (e-TIN)
  tradeLicenseNo?: string;
  ircNumber?: string; // Import Registration Certificate
  ercNumber?: string; // Export Registration Certificate
  epzRegNo?: string; // EPZ Permission / Custom Bond No
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  defaultBankAccountId?: string;
  tagline?: string;
  isDefault?: boolean;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface BankMaster {
  id: string;
  bankName: string; // e.g. HSBC Bank, Eastern Bank PLC, Standard Chartered
  bankCode?: string;
  bankAddress?: string;
  branchName?: string;
  branchAddress?: string;
  swiftCode?: string;
  routingNumber?: string;
  country?: string;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: any;
  createdBy?: string;
}

export type BankAccountType = 'Current' | 'Savings' | 'Export' | 'Foreign Currency' | 'Other';
export type CurrencyCode = 'BDT' | 'USD' | 'EUR' | 'GBP' | 'Other';

export interface BankAccountMaster {
  id: string;
  bankId: string;
  bankName: string;
  branch: string;
  companyId?: string;
  companyName?: string;
  accountName: string;
  accountNumber: string;
  accountType: BankAccountType;
  currency: CurrencyCode;
  swiftCode?: string;
  routingNumber?: string;
  iban?: string;
  beneficiaryName: string;
  accountAddress?: string;
  isDefault?: boolean;
  isActive?: boolean;
  businessId: string;
  createdAt?: any;
  createdBy?: string;
}

export interface PISetupConfig {
  id?: string;
  prefix: string; // e.g. "PI-"
  startingNumber: number;
  numberFormat: 'continuous' | 'financial_year';
  isBillBasedEnabled: boolean;
  isBookingBasedEnabled: boolean;
  isBillValueMatchingMandatory: boolean;
  isWoValueMatchingMandatory: boolean;
  valueTolerance: number; // default 0.00
  isApprovalRequired: boolean;
  approverRole?: string;
  businessId: string;
  updatedAt?: any;
}

export interface ProformaInvoiceItem {
  id: string;
  sl: number;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number; // quantity * rate
  remarks?: string;
  woId?: string;
  billId?: string;
  poNo?: string;
  style?: string;
  netWeightKg?: number;
  grossWeightKg?: number;
  quantityDzn?: number;
  quantityPcs?: number;
}

export type PISourceType = 'bill_based' | 'booking_based';
export type PIStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'confirmed' | 'cancelled';

export interface PIAuditTrail {
  createdBy?: string;
  createdAt?: any;
  editedBy?: string;
  editedAt?: any;
  submittedBy?: string;
  submittedAt?: any;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  rejectionReason?: string;
  confirmedBy?: string;
  confirmedAt?: any;
  cancelledBy?: string;
  cancelledAt?: any;
  cancelReason?: string;
}

export interface PISelectedBillRef {
  billId: string;
  billNo: string;
  billDate: string;
  amountUSD: number;
  amountBDT?: number;
  challanNo?: string;
  poNo?: string;
}

export interface PISelectedWorkOrderRef {
  woId: string;
  woNumber: string;
  date?: string;
  amountUSD: number;
  poNo?: string;
  style?: string;
  buyerName?: string;
}

export interface ProformaInvoice {
  id: string;
  piNumber: string; // e.g. PI-2026-000001 or FAL/2026/08 A ES
  piDate: string; // YYYY-MM-DD
  validityDate?: string;
  piSource: PISourceType;
  
  // Company Profile Reference
  companyId?: string;
  companyName?: string;
  companyAddress?: string;
  companyFactoryAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWeb?: string;
  companyBin?: string;
  companyTin?: string;
  companyIrc?: string;
  companyErc?: string;
  companySignatoryName?: string;
  companySignatoryDesignation?: string;
  
  // Single or Multi Source reference
  sourceId: string; // Bill ID or Work Order ID (or primary)
  sourceNumber: string; // Bill No or Work Order No (or comma-separated)
  billId?: string;
  billNo?: string;
  billDate?: string;
  woId?: string;
  woNumber?: string;
  bookingNo?: string;
  poNo?: string;
  
  // Multiple Selection support
  selectedBillIds?: string[];
  selectedBills?: PISelectedBillRef[];
  selectedWoIds?: string[];
  selectedWorkOrders?: PISelectedWorkOrderRef[];

  // Customer & Buyer
  customerId: string;
  customerName: string;
  customerAddress?: string;
  buyerId?: string;
  buyerName?: string;
  
  // Commercial & Export Negotiation Fields (for the 8-page Export Document Set)
  lcNumber?: string;
  lcDate?: string;
  exportLcNo?: string;
  exportLcDate?: string;
  commercialInvoiceNo?: string;
  commercialInvoiceDate?: string;
  deliveryChallanNo?: string;
  deliveryChallanDate?: string;
  truckNo?: string;
  carrier?: string;
  sailingDate?: string;
  portOfLoading?: string;
  finalDestination?: string;
  portOfDischarge?: string;
  tenorDays?: string; // e.g. "90 Days"
  commodity?: string; // e.g. "GARMENTS ACCESSORIES"
  netWeightKg?: number;
  grossWeightKg?: number;
  totalQuantityDzn?: number;
  totalQuantityPcs?: number;

  // Buyer statutory info
  buyerIrc?: string;
  buyerErc?: string;
  buyerBin?: string;
  buyerTin?: string;
  buyerBankBin?: string;

  // Advising / Issuing Bank Details
  bankId?: string;
  bankName?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  bankSwiftCode?: string;
  bankRoutingNumber?: string;
  bankIban?: string;
  bankBeneficiaryName?: string;
  bankAddress?: string;
  bankCurrency?: string;
  bankTinNo?: string;
  bankVatNo?: string;

  // L/C Issuing Bank (Second Notify)
  issuingBankName?: string;
  issuingBankBranch?: string;
  issuingBankAddress?: string;
  issuingBankCity?: string;

  // Currency & Values
  currency: string; // USD, EUR, BDT, GBP
  currencySymbol?: string;
  exchangeRate: number; // default 1.00
  masterPIValue: number; // Locked source amount (sum of selected bills/WOs)
  piTotalValue: number; // Live sum of items
  differenceValue: number; // piTotalValue - masterPIValue
  isValueMatched: boolean; // Math.abs(differenceValue) <= tolerance
  
  // Commercial Terms
  paymentTerms?: string; // e.g. 100% Irrevocable Letter Of Credit Ninety (90) Days at sight without recourse
  shipmentTerms?: string; // Incoterms (FOB, CFR, CIF, EXW)
  hsCode?: string;
  deliveryPeriod?: string;
  countryOfOrigin?: string;
  remarks?: string;
  termsAndConditions?: Array<string | { id?: string; label?: string; text: string }>;
  
  // Items & Status
  items: ProformaInvoiceItem[];
  totalQuantity: number;
  status: PIStatus;
  
  // Audit Trail
  auditTrail: PIAuditTrail;
  
  businessId: string;
  ownerId: string;
  createdAt?: any;
  updatedAt?: any;
}


