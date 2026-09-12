export type CoaAccountNature = 'Debit' | 'Credit';
export type CoaAccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

export interface CoaGroupMaster {
  id: string;
  code: string; // e.g. "100000000000"
  name: string; // e.g. "Asset"
  nature: CoaAccountNature;
  parentGroup?: string;
  sequence: number;
  status: 'active' | 'inactive';
  description?: string;
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CoaCategoryMaster {
  id: string;
  code: string; // e.g. "110000000000"
  name: string; // e.g. "Current Assets"
  groupId: string;
  groupCode: string;
  groupName: string;
  nature: CoaAccountNature;
  parentCategoryId?: string;
  sequence: number;
  status: 'active' | 'inactive';
  description?: string;
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CoaSubCategoryMaster {
  id: string;
  code: string; // e.g. "110100000000"
  name: string; // e.g. "Cash & Cash Equivalent"
  groupId: string;
  categoryId: string;
  groupCode: string;
  categoryCode: string;
  groupName?: string;
  categoryName?: string;
  nature: CoaAccountNature;
  sequence: number;
  status: 'active' | 'inactive';
  description?: string;
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CoaLedgerAccount {
  id: string;
  code: string; // e.g. "110101000001"
  name: string; // e.g. "Cash in Hand - Factory"
  groupId: string;
  categoryId: string;
  subCategoryId: string;
  groupName: string;
  categoryName: string;
  subCategoryName: string;
  accountType: CoaAccountType;
  nature: CoaAccountNature;
  parentAccountId?: string;
  openingBalance: number;
  openingBalanceDate?: string;
  currentBalance?: number;
  debitTotal?: number;
  creditTotal?: number;
  currency?: string;
  directEntryAllowed: boolean; // Must be true for manual Journal Entries
  controlAccount?: boolean;
  systemAccount?: boolean;
  status: 'active' | 'inactive';
  description?: string;
  businessId: string;
  createdBy?: string;
  createdAt?: any;
  updatedBy?: string;
  updatedAt?: any;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountNature?: CoaAccountNature;
  debit: number;
  credit: number;
  costCenter?: string;
  lineNarration?: string;
}

export type JournalReferenceType = 
  | 'manual' 
  | 'sales' 
  | 'customer_payment' 
  | 'purchase' 
  | 'supplier_payment' 
  | 'cash_bank' 
  | 'loan_disbursement' 
  | 'loan_repayment' 
  | 'depreciation' 
  | 'adjustment' 
  | 'reversal';

export interface JournalAuditRecord {
  action: string;
  performedBy: string;
  timestamp: string;
  details?: string;
}

export interface JournalEntry {
  id: string;
  journalNo: string; // e.g. JV-202608-0001
  date: string; // YYYY-MM-DD
  referenceNo?: string;
  referenceType: JournalReferenceType;
  narration: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  costCenter?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  preparedBy: string;
  approvedBy?: string;
  approvedDate?: string;
  postedBy?: string;
  postedDate?: string;
  status: 'draft' | 'pending_approval' | 'posted' | 'rejected' | 'reversed';
  isSystemGenerated: boolean;
  reversedJournalId?: string;
  reversalReason?: string;
  businessId: string;
  createdAt?: any;
  updatedAt?: any;
  postedAt?: any;
  auditTrail?: JournalAuditRecord[];
}

export type CashBankVoucherType = 
  | 'cash_receipt' 
  | 'cash_payment' 
  | 'cash_transfer' 
  | 'bank_receipt' 
  | 'bank_payment' 
  | 'bank_transfer' 
  | 'reconciliation';

export interface CashBankTransaction {
  id: string;
  voucherNo: string; // e.g. CRV-202608-001, BPV-202608-001
  voucherType: CashBankVoucherType;
  date: string;
  accountId: string; // Cash or Bank COA Ledger Account
  accountCode: string;
  accountName: string;
  contraAccountId?: string;
  contraAccountCode?: string;
  contraAccountName?: string;
  amount: number;
  paymentMode: 'cash' | 'cheque' | 'beftn' | 'rtgs' | 'swift' | 'transfer';
  chequeNo?: string;
  chequeDate?: string;
  bankBranch?: string;
  partyType?: 'customer' | 'supplier' | 'employee' | 'other';
  partyId?: string;
  partyName?: string;
  referenceNo?: string;
  narration: string;
  status: 'posted' | 'pending_approval' | 'draft' | 'rejected' | 'cancelled';
  isReconciled?: boolean;
  reconciliationDate?: string;
  bankStatementDate?: string;
  bankCharge?: number;
  journalId?: string;
  businessId: string;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CustomerReceivableSummary {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalReceived: number;
  totalOutstanding: number;
  currentBucket: number; // 0-30 days
  bucket30: number; // 31-60 days
  bucket60: number; // 61-90 days
  bucket90: number; // 91-120 days
  bucket120Plus: number; // 120+ days
  invoiceCount: number;
  lastPaymentDate?: string;
  status: 'current' | 'overdue' | 'settled';
}

export interface SupplierPayableSummary {
  supplierId: string;
  supplierName: string;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  currentBucket: number; // 0-30 days
  bucket30: number; // 31-60 days
  bucket60: number; // 61-90 days
  bucket90: number; // 91-120 days
  bucket120Plus: number; // 120+ days
  billCount: number;
  lastPaymentDate?: string;
  status: 'current' | 'overdue' | 'settled';
}

export type CoaAccountGroup = CoaGroupMaster;
export type CoaAccountCategory = CoaCategoryMaster;
export type CoaSubCategory = CoaSubCategoryMaster;
export type CustomerReceivable = CustomerReceivableSummary;
export type SupplierPayable = SupplierPayableSummary;

export interface FixedAsset {
  id: string;
  assetCode: string; // e.g. FA-2026-001
  assetName: string;
  assetCategory?: string; // Machinery, Furniture, IT, Vehicle, Building
  category?: string;
  purchaseDate: string;
  purchaseValue?: number;
  purchaseCost?: number;
  salvageValue?: number;
  supplier?: string;
  location?: string;
  serialNo?: string;
  responsiblePerson?: string;
  usefulLifeYears: number;
  depreciationMethod: any;
  depreciationRate?: number; // Percentage per year
  accumulatedDepreciation: number;
  netBookValue: number;
  status?: 'active' | 'disposed' | 'written_off';
  disposalStatus?: 'active' | 'disposed' | 'written_off';
  disposalDate?: string;
  disposalValue?: number;
  gainLossOnDisposal?: number;
  assetLedgerId?: string;
  assetLedgerCode?: string;
  assetLedgerName?: string;
  depreciationExpenseLedgerId?: string;
  accumulatedDepLedgerId?: string;
  coaAssetAccountId?: string;
  coaDepreciationAccountId?: string;
  coaAccumulatedDeprAccountId?: string;
  businessId: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

