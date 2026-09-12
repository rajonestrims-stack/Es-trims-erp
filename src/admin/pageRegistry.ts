export interface ErpRegisteredPage {
  id: string;
  module: 
    | 'Dashboard'
    | 'Procurement & Purchase'
    | 'Sales & Marketing'
    | 'Master Setup'
    | 'Product Development'
    | 'Sub-Contract Management'
    | 'Store & Inventory'
    | 'Production Management'
    | 'Despatch & Delivery'
    | 'Commercial'
    | 'Accounts & Finance'
    | 'Bank Loan & Finance'
    | 'Approvals'
    | 'Admin Panel';
  pageName: string;
  route: string;
  permissionCode: string;
  approvalSupported: boolean;
  description?: string;
}

export const ERP_PAGE_REGISTRY: ErpRegisteredPage[] = [
  // 1. Dashboard
  { id: 'dashboard', module: 'Dashboard', pageName: 'Executive Dashboard (All Overview)', route: '/dashboard', permissionCode: 'DASHBOARD_VIEW', approvalSupported: false, description: 'Main executive overview, company health, multi-module summary, and quick action cards' },
  { id: 'dashboard-sales', module: 'Dashboard', pageName: 'Sales & Marketing Dashboard', route: '/dashboard/sales', permissionCode: 'DASHBOARD_SALES', approvalSupported: false, description: 'Sales order pipeline, buyer statistics, booking performance, monthly delivery targets and revenue analytics' },
  { id: 'dashboard-production', module: 'Dashboard', pageName: 'Production & Floor Dashboard', route: '/dashboard/production', permissionCode: 'DASHBOARD_PRODUCTION', approvalSupported: false, description: 'Manufacturing output KPIs, floor line statuses, scrap rate, machine throughput, and work order progress' },
  { id: 'dashboard-inventory', module: 'Dashboard', pageName: 'Inventory & Store Dashboard', route: '/dashboard/inventory', permissionCode: 'DASHBOARD_INVENTORY', approvalSupported: false, description: 'Real-time stock valuation, item categories, low stock alerts, stock inward/outward analysis, and movement velocity' },
  { id: 'dashboard-accounts', module: 'Dashboard', pageName: 'Accounts & Finance Dashboard', route: '/dashboard/accounts', permissionCode: 'DASHBOARD_ACCOUNTS', approvalSupported: false, description: 'Cash & bank balances, customer receivables, supplier payables, aging analysis, and P&L financial KPIs' },

  // 2. Procurement & Purchase
  { id: 'procurement-requisition', module: 'Procurement & Purchase', pageName: 'Purchase Requisition', route: '/procurement/requisition', permissionCode: 'PROCUREMENT_REQUISITION', approvalSupported: true, description: 'Department store & material purchase requisitions' },
  { id: 'procurement-po', module: 'Procurement & Purchase', pageName: 'Purchase Order (PO)', route: '/procurement/po', permissionCode: 'PROCUREMENT_PO', approvalSupported: true, description: 'Local and bond purchase orders for raw materials & items' },
  { id: 'procurement-mrr', module: 'Procurement & Purchase', pageName: 'Material Receipt (MRR / GRN)', route: '/procurement/mrr', permissionCode: 'PROCUREMENT_MRR', approvalSupported: true, description: 'Material receipt inspection, GRN verification and store inward' },
  { id: 'procurement-suppliers', module: 'Procurement & Purchase', pageName: 'Supplier Master Directory', route: '/procurement/suppliers', permissionCode: 'PROCUREMENT_SUPPLIERS', approvalSupported: false, description: 'Supplier & vendor profiles, contact details and bank info' },

  // 3. Sales & Marketing
  { id: 'sales-order-entry', module: 'Sales & Marketing', pageName: 'Sales Order Entry', route: '/sales/order-entry', permissionCode: 'SALES_ORDER_ENTRY', approvalSupported: true, description: 'Create and submit customer sales orders and contract terms' },
  { id: 'sales-create-order', module: 'Sales & Marketing', pageName: 'Create Sales Order', route: '/sales/create-order', permissionCode: 'SALES_CREATE_ORDER', approvalSupported: true, description: 'Fast sales order drafting and item specifications' },
  { id: 'sales-order-list', module: 'Sales & Marketing', pageName: 'Sales Order List & Tracking', route: '/sales/order-list', permissionCode: 'SALES_ORDER_LIST', approvalSupported: false, description: 'View, filter, track delivery status and export order registers' },
  { id: 'sales-rectify-requests', module: 'Sales & Marketing', pageName: 'Rectify & Unlock Requests', route: '/sales/rectify-requests', permissionCode: 'SALES_RECTIFY_REQUESTS', approvalSupported: true, description: 'Review, approve, reject and unlock submitted sales orders for modifications' },
  { id: 'sales-mrr-receipt', module: 'Sales & Marketing', pageName: 'Sales Delivery / MRR Receipt', route: '/sales/mrr-receipt', permissionCode: 'SALES_MRR_RECEIPT', approvalSupported: true, description: 'Customer delivery acknowledgments and buyer MRR receipts' },
  { id: 'sales-booking-report', module: 'Sales & Marketing', pageName: 'Sales Booking Report', route: '/sales/booking-report', permissionCode: 'SALES_BOOKING_REPORT', approvalSupported: false, description: 'Sales order booking statistics, buyer volume analysis and forecasts' },
  { id: 'sales-sales-report', module: 'Sales & Marketing', pageName: 'Sales Performance Report', route: '/sales/sales-report', permissionCode: 'SALES_SALES_REPORT', approvalSupported: false, description: 'Completed sales invoices, customer sales summaries and trends' },

  // 4. Master Setup
  { id: 'sales-company-master', module: 'Master Setup', pageName: 'Company Master (Exporter / Mill Profile)', route: '/master/company-master', permissionCode: 'MASTER_COMPANY_MASTER', approvalSupported: false, description: 'Manage corporate exporter identity, legal addresses, BIN, TIN, ERC, IRC and signatories' },
  { id: 'sales-customer-master', module: 'Master Setup', pageName: 'Customer Master Directory', route: '/master/customer-master', permissionCode: 'MASTER_CUSTOMER_MASTER', approvalSupported: false, description: 'Direct customer & factory accounts master' },
  { id: 'sales-buyer-master', module: 'Master Setup', pageName: 'Buyer Master Directory', route: '/master/buyer-master', permissionCode: 'MASTER_BUYER_MASTER', approvalSupported: false, description: 'International & local buyer directory and merchandising contacts' },
  { id: 'sales-bank-master', module: 'Master Setup', pageName: 'Commercial Bank & Account Master', route: '/master/bank-master', permissionCode: 'MASTER_BANK_MASTER', approvalSupported: false, description: 'Manage export bank accounts, SWIFT codes, branch details and associated company profiles' },
  { id: 'sales-currency-master', module: 'Master Setup', pageName: 'Currency & Exchange Rate Master', route: '/master/currency-master', permissionCode: 'MASTER_CURRENCY_MASTER', approvalSupported: false, description: 'Manage global currencies and customer-specific conversion rates to BDT' },
  { id: 'sales-price-master', module: 'Master Setup', pageName: 'Sales Price Master (Customer Price Master)', route: '/master/price-master', permissionCode: 'MASTER_PRICE_MASTER', approvalSupported: true, description: 'Item pricing rules, customer discounts, currency, and unit rate approval workflow' },
  { id: 'sales-fg-master', module: 'Master Setup', pageName: 'Finished Goods (FG) Master', route: '/master/fg-master', permissionCode: 'MASTER_FG_MASTER', approvalSupported: false, description: 'Finished goods products, item codes and specifications' },
  { id: 'sales-category-master', module: 'Master Setup', pageName: 'Product Category Master', route: '/master/category-master', permissionCode: 'MASTER_CATEGORY_MASTER', approvalSupported: false, description: 'Finished goods categories and grouping setup' },
  { id: 'sales-subcategory-master', module: 'Master Setup', pageName: 'Product Sub-Category Master', route: '/master/subcategory-master', permissionCode: 'MASTER_SUBCATEGORY_MASTER', approvalSupported: false, description: 'Detailed sub-categories for finished goods' },
  { id: 'sales-section-master', module: 'Master Setup', pageName: 'Factory Section Master', route: '/master/section-master', permissionCode: 'MASTER_SECTION_MASTER', approvalSupported: false, description: 'Production sections, floor units and lines' },
  { id: 'sales-process-master', module: 'Master Setup', pageName: 'Production Process Master', route: '/master/process-master', permissionCode: 'MASTER_PROCESS_MASTER', approvalSupported: false, description: 'Manufacturing process stages, cycle times and routing setup' },

  // 5. Product Development
  { id: 'pd-product-master', module: 'Product Development', pageName: 'PD Product Master & Specs', route: '/pd/product-master', permissionCode: 'PD_PRODUCT_MASTER', approvalSupported: false, description: 'R&D product designs, style tech packs and sample specs' },
  { id: 'pd-ups-calculation', module: 'Product Development', pageName: 'UPS & Yield Calculation', route: '/pd/ups-calc', permissionCode: 'PD_UPS_CALC', approvalSupported: false, description: 'Units per sheet (UPS), consumption formulas and yield calculators' },
  { id: 'pd-costing', module: 'Product Development', pageName: 'Pre-Costing Estimation Sheet', route: '/pd/costing', permissionCode: 'PD_COSTING', approvalSupported: true, description: 'Material, overhead, margin breakdown and buyer quotation costing' },
  { id: 'pd-history', module: 'Product Development', pageName: 'Development History & Log', route: '/pd/history', permissionCode: 'PD_HISTORY', approvalSupported: false, description: 'Product development iterations, revisions and audit trails' },

  // 6. Sub-Contract Management
  { id: 'subcontract-dashboard', module: 'Sub-Contract Management', pageName: 'Sub-Contract Overview', route: '/subcontract/dashboard', permissionCode: 'SUBCONTRACT_DASHBOARD', approvalSupported: false, description: 'Summary of active sub-contract job orders and vendor capacities' },
  { id: 'subcontract-dyeing', module: 'Sub-Contract Management', pageName: 'Sub-Contract Dyeing Orders', route: '/subcontract/dyeing', permissionCode: 'SUBCONTRACT_DYEING', approvalSupported: true, description: 'Yarn & fabric dyeing process orders and batch tracking' },
  { id: 'subcontract-woven', module: 'Sub-Contract Management', pageName: 'Sub-Contract Woven Orders', route: '/subcontract/woven', permissionCode: 'SUBCONTRACT_WOVEN', approvalSupported: true, description: 'Woven label and fabric weaving sub-contracting orders' },
  { id: 'subcontract-embroidery', module: 'Sub-Contract Management', pageName: 'Sub-Contract Embroidery Orders', route: '/subcontract/embroidery', permissionCode: 'SUBCONTRACT_EMBROIDERY', approvalSupported: true, description: 'External embroidery and printing job orders' },
  { id: 'subcontract-item-master', module: 'Sub-Contract Management', pageName: 'Sub-Contract Item Master', route: '/subcontract/item-master', permissionCode: 'SUBCONTRACT_ITEM_MASTER', approvalSupported: false, description: 'Sub-contract specific items, processes and materials' },
  { id: 'subcontract-category-master', module: 'Sub-Contract Management', pageName: 'Sub-Contract Category Master', route: '/subcontract/category-master', permissionCode: 'SUBCONTRACT_CAT_MASTER', approvalSupported: false, description: 'Categorization for outsourced manufacturing operations' },
  { id: 'subcontract-subcategory-master', module: 'Sub-Contract Management', pageName: 'Sub-Contract Sub-Category Master', route: '/subcontract/subcategory-master', permissionCode: 'SUBCONTRACT_SUBCAT_MASTER', approvalSupported: false, description: 'Detailed sub-categories and specifications for outsourced production' },
  { id: 'subcontract-price-master', module: 'Sub-Contract Management', pageName: 'Sub-Contract Price Master (Supplier Price Matrix)', route: '/subcontract/price-master', permissionCode: 'SUBCONTRACT_PRICE_MASTER', approvalSupported: true, description: 'Vendor service rates, dyeing & finishing rates, unit price approval workflow and matrix' },
  { id: 'subcontract-po', module: 'Sub-Contract Management', pageName: 'Sub-Contract Work Order / PO', route: '/subcontract/po', permissionCode: 'SUBCONTRACT_PO', approvalSupported: true, description: 'Official work orders issued to external sub-contractors' },
  { id: 'subcontract-issue', module: 'Sub-Contract Management', pageName: 'Sub-Contract Material Issue', route: '/subcontract/issue', permissionCode: 'SUBCONTRACT_ISSUE', approvalSupported: true, description: 'Material delivery challan dispatched to sub-contractors' },
  { id: 'subcontract-receive', module: 'Sub-Contract Management', pageName: 'Sub-Contract Goods Receive', route: '/subcontract/receive', permissionCode: 'SUBCONTRACT_RECEIVE', approvalSupported: true, description: 'Received processed goods inspection and stock entry' },
  { id: 'subcontract-reports', module: 'Sub-Contract Management', pageName: 'Sub-Contract Reports & Analytics', route: '/subcontract/reports', permissionCode: 'SUBCONTRACT_REPORTS', approvalSupported: false, description: 'Vendor delivery performance, yield and cost analysis' },

  // 7. Store & Inventory
  { id: 'inventory', module: 'Store & Inventory', pageName: 'Stock & Item Catalog Master', route: '/store/items', permissionCode: 'STORE_ITEM_CATALOG', approvalSupported: false, description: 'Raw materials, trims, packaging and chemical stock levels' },
  { id: 'inventory-requisition', module: 'Store & Inventory', pageName: 'Store Requisition', route: '/store/requisition', permissionCode: 'STORE_REQUISITION', approvalSupported: true, description: 'Create and submit material store requisitions from store and production' },
  { id: 'inventory-sr-issue', module: 'Store & Inventory', pageName: 'Issue from Store Requisition', route: '/store/sr-issue', permissionCode: 'STORE_SR_ISSUE', approvalSupported: true, description: 'Fulfill, issue and dispatch raw materials and items requested by production work orders' },
  { id: 'inventory-direct-sr', module: 'Store & Inventory', pageName: 'Direct Store Requisition', route: '/store/direct-sr', permissionCode: 'STORE_DIRECT_SR', approvalSupported: true, description: 'Direct departmental material issue requisition and approval without sales order linkage' },
  { id: 'transactions', module: 'Store & Inventory', pageName: 'Stock Movement & Transaction Log', route: '/store/transactions', permissionCode: 'STORE_TRANSACTIONS', approvalSupported: false, description: 'Real-time stock inward, outward, balance and audit logs' },
  { id: 'ledger', module: 'Store & Inventory', pageName: 'Item Ledger (Stock Ledger)', route: '/store/ledger', permissionCode: 'STORE_ITEM_LEDGER', approvalSupported: false, description: 'Detailed item-wise historical stock transaction ledger and batch records' },
  { id: 'ledger-summary', module: 'Store & Inventory', pageName: 'Item Ledger Details (Stock Summary)', route: '/store/ledger-details', permissionCode: 'STORE_ITEM_LEDGER_DETAILS', approvalSupported: false, description: 'Consolidated category balances, opening, inward, outward, closing and valuation' },
  { id: 'issue-analysis', module: 'Store & Inventory', pageName: 'Material Issue & Consumption Analysis', route: '/store/issue-analysis', permissionCode: 'STORE_ISSUE_ANALYSIS', approvalSupported: false, description: 'Department-wise material usage, wastage and consumption charts' },
  { id: 'reports', module: 'Store & Inventory', pageName: 'Store Inventory Reports & Valuation', route: '/store/reports', permissionCode: 'STORE_REPORTS', approvalSupported: false, description: 'Periodic inventory valuation, stock audits and store summaries' },
  { id: 'calculators', module: 'Store & Inventory', pageName: 'Cost Calculators & Estimators', route: '/store/calculators', permissionCode: 'STORE_CALCULATORS', approvalSupported: false, description: 'Custom formula calculations, weight conversions and batch costing' },
  { id: 'dyeing', module: 'Store & Inventory', pageName: 'Dyeing Processing Unit', route: '/store/dyeing', permissionCode: 'STORE_DYEING', approvalSupported: true, description: 'Internal dyeing floor processing and material consumption' },

  // 8. Production Management
  { id: 'production-dashboard', module: 'Production Management', pageName: 'Production Floor Dashboard', route: '/production/dashboard', permissionCode: 'PRODUCTION_DASHBOARD', approvalSupported: false, description: 'Floor output KPIs, machine statuses and line throughput' },
  { id: 'production-update', module: 'Production Management', pageName: 'Daily Production Floor Update', route: '/production/update', permissionCode: 'PRODUCTION_UPDATE', approvalSupported: true, description: 'Daily line-wise manufacturing completion and scrap entry' },
  { id: 'production-bom', module: 'Production Management', pageName: 'Bill of Materials (BOM) Master', route: '/production/bom', permissionCode: 'PRODUCTION_BOM', approvalSupported: false, description: 'Standard recipe formulas and raw material consumption BOMs' },
  { id: 'production-status', module: 'Production Management', pageName: 'Production Status Tracker', route: '/production/status', permissionCode: 'PRODUCTION_STATUS', approvalSupported: false, description: 'Order progress tracking and stage-wise completion monitor' },
  { id: 'production-requisition', module: 'Production Management', pageName: 'Production Store Requisition', route: '/production/requisition', permissionCode: 'PRODUCTION_REQUISITION', approvalSupported: true, description: 'Material requisitions from floor to central warehouse' },
  { id: 'production-details', module: 'Production Management', pageName: 'Production Details & History Log', route: '/production/details', permissionCode: 'PRODUCTION_DETAILS', approvalSupported: false, description: 'Historical production records, shift logs and batch histories' },
  { id: 'production-process-master', module: 'Production Management', pageName: 'Production Process Master', route: '/production/process-master', permissionCode: 'PRODUCTION_PROCESS_MASTER', approvalSupported: false, description: 'Configure factory line stages, manufacturing sequence and routing processes' },

  // 9. Despatch & Delivery
  { id: 'despatch-challan', module: 'Despatch & Delivery', pageName: 'Delivery Challan', route: '/despatch/challan', permissionCode: 'DESPATCH_CHALLAN', approvalSupported: true, description: 'Create and generate official factory delivery challans' },
  { id: 'despatch-report', module: 'Despatch & Delivery', pageName: 'Challan Register & Summary', route: '/despatch/reports', permissionCode: 'DESPATCH_REPORT', approvalSupported: false, description: 'Monthly shipment registers, customer dispatch totals and trends' },
  { id: 'despatch-gatepass', module: 'Despatch & Delivery', pageName: 'Security Gate Pass', route: '/despatch/gatepass', permissionCode: 'DESPATCH_GATEPASS', approvalSupported: true, description: 'Security gate passes for goods leaving factory premises' },
  { id: 'despatch-mrr-receipt', module: 'Despatch & Delivery', pageName: 'Customer MRR Receipt Log', route: '/despatch/mrr-receipt', permissionCode: 'DESPATCH_MRR_RECEIPT', approvalSupported: false, description: 'Log of buyer received MRR vouchers and proof of delivery' },
  { id: 'despatch-received', module: 'Despatch & Delivery', pageName: 'Challan Received Acknowledgment', route: '/despatch/received', permissionCode: 'DESPATCH_RECEIVED', approvalSupported: true, description: 'Buyer signed copy verification and delivery acknowledgment' },

  // 10. Commercial
  { id: 'commercial-pi', module: 'Commercial', pageName: 'Proforma Invoice (PI) Management', route: '/commercial/pi', permissionCode: 'COMMERCIAL_PI', approvalSupported: true, description: 'Commercial Proforma Invoice (PI) creation, LC tracking and export contract validation' },
  { id: 'commercial-pi-bill', module: 'Commercial', pageName: 'Proforma Invoice From Commercial Bill', route: '/commercial/pi-bill', permissionCode: 'COMMERCIAL_PI_BILL', approvalSupported: true, description: 'Generate formal export Proforma Invoice from confirmed commercial sales bills' },
  { id: 'commercial-pi-wo', module: 'Commercial', pageName: 'Proforma Invoice From Work Order', route: '/commercial/pi-wo', permissionCode: 'COMMERCIAL_PI_WO', approvalSupported: true, description: 'Generate Proforma Invoice directly from customer sales order / work order booking' },
  { id: 'commercial-documents', module: 'Commercial', pageName: 'Commercial Documents & LC', route: '/commercial/documents', permissionCode: 'COMMERCIAL_DOCUMENTS', approvalSupported: true, description: 'Letter of Credit (LC), Bill of Lading, Packing Lists and export documentation' },
  { id: 'commercial-pi-list', module: 'Commercial', pageName: 'PI Register & Tracking', route: '/commercial/pi-list', permissionCode: 'COMMERCIAL_PI_LIST', approvalSupported: false, description: 'View, filter, search, print and track issued Proforma Invoices' },
  { id: 'commercial-pi-approvals', module: 'Commercial', pageName: 'Pending PI Approvals', route: '/commercial/pi-approvals', permissionCode: 'COMMERCIAL_PI_APPROVALS', approvalSupported: true, description: 'Multi-stage approval workflow portal for pending Proforma Invoices' },
  { id: 'commercial-bank-master', module: 'Commercial', pageName: 'Commercial Bank Master Setup', route: '/commercial/bank-master', permissionCode: 'COMMERCIAL_BANK_MASTER', approvalSupported: false, description: 'Configure export bank accounts, SWIFT codes, branch details and PI signatories' },

  // 11. Accounts & Finance
  { id: 'accounts-dashboard', module: 'Accounts & Finance', pageName: 'Accounts Dashboard & Financial KPIs', route: '/accounts/dashboard', permissionCode: 'ACCOUNTS_DASHBOARD', approvalSupported: false, description: 'Executive financial summary, cash & bank positions, receivables, payables, and P&L KPIs' },
  { id: 'accounts-coa', module: 'Accounts & Finance', pageName: 'Chart of Accounts (COA Master)', route: '/accounts/coa', permissionCode: 'ACCOUNTS_COA', approvalSupported: true, description: 'Hierarchical 4-tier Chart of Accounts (Group -> Category -> Sub Category -> Ledger Account)' },
  { id: 'accounts-journal', module: 'Accounts & Finance', pageName: 'Journal Entry & Vouchers', route: '/accounts/journal', permissionCode: 'ACCOUNTS_JOURNAL', approvalSupported: true, description: 'Balanced double-entry journal vouchers with real-time Dr=Cr check and audit trails' },
  { id: 'accounts-cash-bank', module: 'Accounts & Finance', pageName: 'Cash & Bank Management', route: '/accounts/cash-bank', permissionCode: 'ACCOUNTS_CASH_BANK', approvalSupported: true, description: 'Cash receipts, cash payments, bank receipts, payments, contra transfers and bank reconciliation' },
  { id: 'accounts-receivable', module: 'Accounts & Finance', pageName: 'Customer Receivable & Collections', route: '/accounts/receivable', permissionCode: 'ACCOUNTS_RECEIVABLE', approvalSupported: true, description: 'Customer invoices, receivable ledger, aging analysis (0-120+ days) and collection receipts' },
  { id: 'accounts-payable', module: 'Accounts & Finance', pageName: 'Supplier Payable & Disbursements', route: '/accounts/payable', permissionCode: 'ACCOUNTS_PAYABLE', approvalSupported: true, description: 'Supplier bills, payable ledger, vendor aging breakdown and payment disbursements' },
  { id: 'accounts-sales', module: 'Accounts & Finance', pageName: 'Sales Accounts & Invoicing', route: '/accounts/sales', permissionCode: 'ACCOUNTS_SALES', approvalSupported: true, description: 'Sales register, commercial invoice integration, VAT & discount tracking and revenue GL posting' },
  { id: 'accounts-fixed-assets', module: 'Accounts & Finance', pageName: 'Fixed Assets & Depreciation', route: '/accounts/fixed-assets', permissionCode: 'ACCOUNTS_FIXED_ASSETS', approvalSupported: true, description: 'Fixed asset register, straight-line/reducing balance depreciation schedules and disposal logs' },
  { id: 'accounts-reports', module: 'Accounts & Finance', pageName: 'Financial Reports & Statements', route: '/accounts/reports', permissionCode: 'ACCOUNTS_REPORTS', approvalSupported: false, description: 'Trial Balance, General Ledger, Profit & Loss (P&L), Balance Sheet, and Cash Flow statements' },
  { id: 'accounts-auto-posting', module: 'Accounts & Finance', pageName: 'Auto Journal Mapping & Event Rules', route: '/accounts/auto-posting', permissionCode: 'ACCOUNTS_AUTO_POSTING', approvalSupported: true, description: 'Automated ERP-to-GL double-entry journal mapping matrix, rules simulator, and real-time ledger triggers' },
  { id: 'finance-billing', module: 'Accounts & Finance', pageName: 'Commercial Billing & Invoices (Create Bill)', route: '/accounts/billing', permissionCode: 'FINANCE_BILLING', approvalSupported: true, description: 'Create commercial sales bills, export invoices and debit notes' },
  { id: 'finance-bill-list', module: 'Accounts & Finance', pageName: 'Commercial Bill Register & Aging', route: '/accounts/bill-list', permissionCode: 'FINANCE_BILL_LIST', approvalSupported: false, description: 'Track unpaid bills, customer receivables and aging analysis' },
  { id: 'finance-mrr-tracker', module: 'Accounts & Finance', pageName: 'MRR Billing Tracker', route: '/accounts/mrr-tracker', permissionCode: 'FINANCE_MRR_TRACKER', approvalSupported: false, description: 'Match customer MRRs against generated commercial bills' },
  { id: 'supplier-ledger', module: 'Accounts & Finance', pageName: 'Supplier / Vendor Ledger', route: '/accounts/supplier-ledger', permissionCode: 'FINANCE_SUPPLIER_LEDGER', approvalSupported: false, description: 'Detailed vendor accounts, credit purchases and ledger balances' },
  { id: 'supplier-payment', module: 'Accounts & Finance', pageName: 'Supplier Payment Vouchers', route: '/accounts/supplier-payment', permissionCode: 'FINANCE_SUPPLIER_PAYMENT', approvalSupported: true, description: 'Vendor payment vouchers, cheques and fund transfers' },
  { id: 'supplier-report', module: 'Accounts & Finance', pageName: 'Purchase & Accounts Financials', route: '/accounts/supplier-report', permissionCode: 'FINANCE_SUPPLIER_REPORT', approvalSupported: false, description: 'Accounts payable summary and vendor payment analytics' },

  // 12. Bank Loan & Finance
  { id: 'bank-loans', module: 'Bank Loan & Finance', pageName: 'Bank Loan Dashboard & Facilities', route: '/accounts/bank-loans', permissionCode: 'FINANCE_BANK_LOANS', approvalSupported: true, description: 'Bank facilities, UPAS, LTR, Term loans, LC purchase, OD & overdue charge calculation' },
  { id: 'loan-sanctions', module: 'Bank Loan & Finance', pageName: 'Bank Facility & Sanction Master', route: '/accounts/loan-sanctions', permissionCode: 'FINANCE_LOAN_SANCTIONS', approvalSupported: false, description: 'Bank limits, margins, interest rates, and overdue delayed payment charge rule setup' },
  { id: 'loan-records', module: 'Bank Loan & Finance', pageName: 'Bank Loan Creation & Records', route: '/accounts/loan-records', permissionCode: 'FINANCE_LOAN_RECORDS', approvalSupported: true, description: 'UPAS, LTR, Term loan records, disbursement, and interest rates' },
  { id: 'loan-repayment', module: 'Bank Loan & Finance', pageName: 'Loan Repayments & Settlement', route: '/accounts/loan-repayment', permissionCode: 'FINANCE_LOAN_REPAYMENT', approvalSupported: true, description: 'Loan repayment entries, priority allocations, overdue charges and settlement' },
  { id: 'loan-vouchers', module: 'Bank Loan & Finance', pageName: 'Bank Loan Accounting GL Vouchers', route: '/accounts/loan-vouchers', permissionCode: 'FINANCE_LOAN_VOUCHERS', approvalSupported: true, description: 'Automated double-entry general ledger journal vouchers for bank loans' },

  // 13. Approvals
  { id: 'approvals', module: 'Approvals', pageName: 'Document Approval Portal', route: '/approvals', permissionCode: 'APPROVALS_PORTAL', approvalSupported: false, description: 'Central hub for approving purchase orders, requisitions and vouchers' },

  // 14. Admin Panel
  { id: 'admin-dashboard', module: 'Admin Panel', pageName: 'Admin Control Dashboard', route: '/admin/dashboard', permissionCode: 'ADMIN_DASHBOARD', approvalSupported: false, description: 'System health, active user count and security overview' },
  { id: 'admin-users', module: 'Admin Panel', pageName: 'User Management', route: '/admin/users', permissionCode: 'ADMIN_USERS', approvalSupported: false, description: 'Create and manage user login credentials, employees and statuses' },
  { id: 'admin-roles', module: 'Admin Panel', pageName: 'Role Management', route: '/admin/roles', permissionCode: 'ADMIN_ROLES', approvalSupported: false, description: 'Define company roles, access tiers and permission templates' },
  { id: 'admin-permissions', module: 'Admin Panel', pageName: 'Permission Matrix Management', route: '/admin/permissions', permissionCode: 'ADMIN_PERMISSIONS', approvalSupported: false, description: 'Granular view, create, edit, delete, print & export matrix' },
  { id: 'admin-approvals', module: 'Admin Panel', pageName: 'Approval Setup & Workflows', route: '/admin/approvals', permissionCode: 'ADMIN_APPROVALS', approvalSupported: false, description: 'Configure multi-level approval workflows, roles and thresholds' },
  { id: 'admin-employees', module: 'Admin Panel', pageName: 'Employee Master Directory', route: '/admin/employees', permissionCode: 'ADMIN_EMPLOYEES', approvalSupported: false, description: 'Employee master profiles, contacts and employment details' },
  { id: 'admin-departments', module: 'Admin Panel', pageName: 'Department Management', route: '/admin/departments', permissionCode: 'ADMIN_DEPARTMENTS', approvalSupported: false, description: 'Company departments and organizational units' },
  { id: 'admin-designations', module: 'Admin Panel', pageName: 'Designation Management', route: '/admin/designations', permissionCode: 'ADMIN_DESIGNATIONS', approvalSupported: false, description: 'Job titles, hierarchy and designation grades' },
  { id: 'admin-audit-log', module: 'Admin Panel', pageName: 'System Audit Log', route: '/admin/audit-log', permissionCode: 'ADMIN_AUDIT_LOG', approvalSupported: false, description: 'Security audit tracking, login timestamps and data mutations' },
  { id: 'admin-settings', module: 'Admin Panel', pageName: 'System & Company Settings', route: '/admin/settings', permissionCode: 'ADMIN_SETTINGS', approvalSupported: false, description: 'Company branding, currency, density and password policies' },
  { id: 'data-migration', module: 'Admin Panel', pageName: 'Data & Cloud SQL Migration', route: '/admin/migration', permissionCode: 'ADMIN_DATA_MIGRATION', approvalSupported: false, description: 'Database migration manager, Cloud SQL synchronization and backup tools' },
];

export const ERP_MODULE_CATEGORIES = [
  'Dashboard',
  'Procurement & Purchase',
  'Sales & Marketing',
  'Master Setup',
  'Product Development',
  'Sub-Contract Management',
  'Store & Inventory',
  'Production Management',
  'Despatch & Delivery',
  'Commercial',
  'Accounts & Finance',
  'Bank Loan & Finance',
  'Approvals',
  'Admin Panel'
] as const;


