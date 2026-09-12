import { CoaAccountNature, CoaAccountType } from './accounts';

export type PostingModuleType = 
  | 'sales_billing'
  | 'customer_receipts'
  | 'procurement_mrr'
  | 'production_manufacturing'
  | 'subcontracting'
  | 'supplier_payments'
  | 'bank_loans_finance'
  | 'fixed_assets'
  | 'factory_admin_expenses';

export type PostingEventCode = 
  | 'SALES_BILL_CONFIRMED'
  | 'SALES_RETURN_CREDIT_NOTE'
  | 'CUSTOMER_PAYMENT_RECEIVED'
  | 'CUSTOMER_ADVANCE_RECEIVED'
  | 'PURCHASE_MRR_CONFIRMED'
  | 'PURCHASE_RETURN_DEBIT_NOTE'
  | 'STORE_ISSUE_TO_PRODUCTION'
  | 'FINISHED_GOODS_OUTPUT'
  | 'SUBCONTRACT_MATERIAL_ISSUE'
  | 'SUBCONTRACT_BILL_RECEIVED'
  | 'SUPPLIER_BILL_PAID'
  | 'SUPPLIER_ADVANCE_PAID'
  | 'BANK_LOAN_DISBURSED'
  | 'BANK_LOAN_EMI_REPAYMENT'
  | 'FIXED_ASSET_PURCHASE'
  | 'FIXED_ASSET_DEPRECIATION'
  | 'FACTORY_OVERHEAD_EXPENSE'
  | 'ADMIN_SALARY_PAYROLL';

export interface AutoPostingRule {
  id: string;
  eventCode: PostingEventCode;
  moduleKey: PostingModuleType;
  moduleName: string;
  moduleNameBn?: string;
  eventName: string;
  eventNameBn: string;
  triggerDescription: string;
  triggerDescriptionBn: string;
  
  // Debit Configuration
  debitLedgerCode: string;
  debitLedgerName: string;
  debitAccountType: CoaAccountType;
  debitNature?: CoaAccountNature;
  
  // Credit Configuration
  creditLedgerCode: string;
  creditLedgerName: string;
  creditAccountType: CoaAccountType;
  creditNature?: CoaAccountNature;

  // Secondary Accounts (e.g. VAT, TDS, Interest)
  secondaryDebitLedgerCode?: string;
  secondaryDebitLedgerName?: string;
  secondaryCreditLedgerCode?: string;
  secondaryCreditLedgerName?: string;

  voucherPrefix: string; // e.g. 'SV', 'CR', 'PV', 'JV', 'BP', 'LV', 'FA'
  financialStatementImpact: string; // e.g. 'Balance Sheet (Asset & Liability)' or 'P&L (Expense & Asset)'
  isAutoPostActive: boolean;
  requiresApproval: boolean;
  businessId: string;
  updatedAt?: string;
}

export interface PostingSimulationPayload {
  eventCode: PostingEventCode;
  amount: number;
  secondaryAmount?: number;
  partyName?: string;
  referenceNo?: string;
  notes?: string;
  date?: string;
}

export interface PostingSimulationResult {
  rule: AutoPostingRule;
  voucherNo: string;
  date: string;
  referenceNo: string;
  narration: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    accountType: CoaAccountType;
    nature: CoaAccountNature;
    debit: number;
    credit: number;
    coaPath: string;
  }>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  statementImpactExplanation: string;
}
