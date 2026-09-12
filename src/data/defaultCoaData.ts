import { CoaGroupMaster, CoaCategoryMaster, CoaSubCategoryMaster, CoaLedgerAccount } from '../types/accounts';
import { COA_GROUPS, COA_CATEGORIES } from './coaCoreGroups';
import { ASSET_SUBCATEGORIES, ASSET_LEDGERS } from './coaAssetData';
import { LIABILITY_SUBCATEGORIES, LIABILITY_LEDGERS } from './coaLiabilityData';
import { EQUITY_REVENUE_SUBCATEGORIES, EQUITY_REVENUE_LEDGERS } from './coaEquityRevenueData';
import { EXPENSE_SUBCATEGORIES, EXPENSE_LEDGERS } from './coaExpenseData';

export const DEFAULT_COA_GROUPS: Omit<CoaGroupMaster, 'businessId'>[] = COA_GROUPS;

export const DEFAULT_COA_CATEGORIES: Omit<CoaCategoryMaster, 'businessId'>[] = COA_CATEGORIES;

export const DEFAULT_COA_SUBCATEGORIES: Omit<CoaSubCategoryMaster, 'businessId'>[] = [
  ...ASSET_SUBCATEGORIES,
  ...LIABILITY_SUBCATEGORIES,
  ...EQUITY_REVENUE_SUBCATEGORIES,
  ...EXPENSE_SUBCATEGORIES
];

export const DEFAULT_COA_LEDGERS: Omit<CoaLedgerAccount, 'businessId'>[] = [
  ...ASSET_LEDGERS,
  ...LIABILITY_LEDGERS,
  ...EQUITY_REVENUE_LEDGERS,
  ...EXPENSE_LEDGERS
];
