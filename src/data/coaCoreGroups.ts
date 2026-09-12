import { CoaGroupMaster, CoaCategoryMaster } from '../types/accounts';

export const COA_GROUPS: Omit<CoaGroupMaster, 'businessId'>[] = [
  { id: 'grp-asset', code: '100000000000', name: 'Asset', nature: 'Debit', sequence: 1, status: 'active', description: 'Economic resources, receivables, fixed assets and cash balances' },
  { id: 'grp-liability', code: '200000000000', name: 'Liability', nature: 'Credit', sequence: 2, status: 'active', description: 'Trade payables, borrowings, loans, TDS, VDS and accrued expenses' },
  { id: 'grp-equity', code: '300000000000', name: 'Equity', nature: 'Credit', sequence: 3, status: 'active', description: "Owner's capital, retained earnings, and revaluation reserve" },
  { id: 'grp-revenue', code: '400000000000', name: 'Income', nature: 'Credit', sequence: 4, status: 'active', description: 'Operating export sales turnover, cash incentives, and indirect revenues' },
  { id: 'grp-expense', code: '500000000000', name: 'Expense', nature: 'Debit', sequence: 5, status: 'active', description: 'Cost of Goods Sold (COGS), Administrative, Financial, and Selling & Distribution Expenses' },
];

export const COA_CATEGORIES: Omit<CoaCategoryMaster, 'businessId'>[] = [
  // 1. Assets (100000000000)
  { id: 'cat-current-asset', code: '110000000000', name: 'Current Assets', groupId: 'grp-asset', groupCode: '100000000000', groupName: 'Asset', nature: 'Debit', sequence: 1, status: 'active', description: 'Liquid and short-term operational assets' },
  { id: 'cat-non-current-asset', code: '120000000000', name: 'Non-Current Assets', groupId: 'grp-asset', groupCode: '100000000000', groupName: 'Asset', nature: 'Debit', sequence: 2, status: 'active', description: 'Property, plant, equipment, and capital work-in-progress' },

  // 2. Liabilities (200000000000)
  { id: 'cat-current-liability', code: '210000000000', name: 'Current Liabilities', groupId: 'grp-liability', groupCode: '200000000000', groupName: 'Liability', nature: 'Credit', sequence: 1, status: 'active', description: 'Trade payables, short-term borrowings, overdrafts, and accrued liabilities' },
  { id: 'cat-non-current-liability', code: '220000000000', name: 'Non-Current Liabilities', groupId: 'grp-liability', groupCode: '200000000000', groupName: 'Liability', nature: 'Credit', sequence: 2, status: 'active', description: 'Long term bank loans and accumulated depreciation/amortization' },

  // 3. Owners Equity (300000000000)
  { id: 'cat-owners-equity', code: '310000000000', name: "Owner's Equity", groupId: 'grp-equity', groupCode: '300000000000', groupName: 'Equity', nature: 'Credit', sequence: 1, status: 'active', description: 'Share capital, retained earnings and revaluation reserve' },

  // 4. Revenue (400000000000)
  { id: 'cat-operating-income', code: '410000000000', name: 'Operating Income', groupId: 'grp-revenue', groupCode: '400000000000', groupName: 'Income', nature: 'Credit', sequence: 1, status: 'active', description: 'Direct export sales and operating turnover' },
  { id: 'cat-non-operating-income', code: '420000000000', name: 'Non Operating Income', groupId: 'grp-revenue', groupCode: '400000000000', groupName: 'Income', nature: 'Credit', sequence: 2, status: 'active', description: 'Indirect income, scrap sales, cash incentives, and interest' },

  // 5. Expenses (500000000000)
  { id: 'cat-cogs', code: '510000000000', name: 'Cost of Goods Sold (COGS)', groupId: 'grp-expense', groupCode: '500000000000', groupName: 'Expense', nature: 'Debit', sequence: 1, status: 'active', description: 'Direct raw materials, direct wages, commercial import costs and factory overhead' },
  { id: 'cat-admin-expense', code: '520000000000', name: 'Administrative Expenses', groupId: 'grp-expense', groupCode: '500000000000', groupName: 'Expense', nature: 'Debit', sequence: 2, status: 'active', description: 'Management salaries, rent, audit fees, utilities, and general administration' },
  { id: 'cat-financial-expense', code: '530000000000', name: 'Financial Expenses', groupId: 'grp-expense', groupCode: '500000000000', groupName: 'Expense', nature: 'Debit', sequence: 3, status: 'active', description: 'Bank charges, LC commissions, loan interest and finance fees' },
  { id: 'cat-selling-expense', code: '540000000000', name: 'Selling & Distribution Expenses', groupId: 'grp-expense', groupCode: '500000000000', groupName: 'Expense', nature: 'Debit', sequence: 4, status: 'active', description: 'Marketing, logistics outward, vehicle freight, courier, and sample costs' },
  { id: 'cat-income-tax', code: '550000000000', name: 'Income Tax', groupId: 'grp-expense', groupCode: '500000000000', groupName: 'Expense', nature: 'Debit', sequence: 5, status: 'active', description: 'Corporate income tax and provisions' },
];
