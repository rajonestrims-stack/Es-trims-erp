import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

// 1. Users & Authentication profile
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Firebase Auth UID or user ID
  uid: text('uid').notNull(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  name: text('name'),
  role: text('role').default('Data Entry Operator'),
  businessId: text('business_id').notNull().default('default-business'),
  businessName: text('business_name'),
  department: text('department'),
  designation: text('designation'),
  customModulePermissions: jsonb('custom_module_permissions'),
  specialPermissions: jsonb('special_permissions'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 2. User Roles & Permissions
export const userRoles = pgTable('user_roles', {
  id: text('id').primaryKey(), // role id or UUID
  name: text('name').notNull(),
  businessId: text('business_id').notNull(),
  allowedPages: jsonb('allowed_pages').notNull(),
  menuPermissions: jsonb('menu_permissions'),
  modulePermissions: jsonb('module_permissions'),
  canView: boolean('can_view').default(true),
  canCreate: boolean('can_create').default(false),
  canEdit: boolean('can_edit').default(false),
  canDelete: boolean('can_delete').default(false),
  canApprove: boolean('can_approve').default(false),
  canPrint: boolean('can_print').default(true),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Item Master / Inventory Catalog
export const items = pgTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  categoryId: text('category_id'),
  categoryName: text('category_name'),
  unit: text('unit').notNull(),
  minStock: numeric('min_stock', { precision: 12, scale: 2 }).default('0'),
  currentStock: numeric('current_stock', { precision: 12, scale: 2 }).default('0'),
  avgCost: numeric('avg_cost', { precision: 12, scale: 2 }).default('0'),
  totalValue: numeric('total_value', { precision: 14, scale: 2 }).default('0'),
  batches: jsonb('batches'),
  ownerId: text('owner_id'),
  businessId: text('business_id').notNull(),
  description: text('description'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 4. Stock Transactions (IN / OUT / Transfer / Adjustment)
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  itemName: text('item_name').default('Item'),
  type: text('type').default('IN'), // 'IN' | 'OUT' | 'PRODUCTION' etc.
  quantity: numeric('quantity', { precision: 12, scale: 2 }).default('0'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).default('0'),
  totalPrice: numeric('total_price', { precision: 14, scale: 2 }).default('0'),
  source: text('source'), // 'Direct Add', 'PO GRN', 'Store Requisition', 'Dyeing Receive'
  referenceNo: text('reference_no'),
  remarks: text('remarks'),
  performedBy: text('performed_by'),
  businessId: text('business_id').notNull(),
  date: timestamp('date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Suppliers Directory
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  category: text('category'),
  openingBalance: numeric('opening_balance', { precision: 14, scale: 2 }).default('0'),
  currentBalance: numeric('current_balance', { precision: 14, scale: 2 }).default('0'),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Purchase Orders (PO)
export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').primaryKey(),
  poNumber: text('po_number').notNull(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  type: text('type').default('local'), // 'local' | 'foreign' / 'bond'
  poDate: text('po_date').notNull(),
  deliveryDate: text('delivery_date'),
  items: jsonb('items').notNull(),
  subTotal: numeric('sub_total', { precision: 14, scale: 2 }).default('0'),
  vatTaxAmount: numeric('vat_tax_amount', { precision: 14, scale: 2 }).default('0'),
  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).default('0'),
  status: text('status').default('draft'), // 'draft' | 'approved' | 'received' | 'closed'
  receivedStatus: text('received_status').default('pending'),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Store Requisitions
export const storeRequisitions = pgTable('store_requisitions', {
  id: text('id').primaryKey(),
  requisitionNo: text('requisition_no').notNull(),
  department: text('department').notNull(),
  requestedBy: text('requested_by').notNull(),
  items: jsonb('items').notNull(),
  status: text('status').default('pending'),
  approvedBy: text('approved_by'),
  issuedBy: text('issued_by'),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Sub Contract Categories & Sub Categories
export const subcontractCategories = pgTable('subcontract_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subcontractSubCategories = pgTable('subcontract_subcategories', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull(),
  categoryName: text('category_name'),
  subCategoryCode: text('sub_category_code').notNull(),
  subCategoryName: text('sub_category_name').notNull(),
  orderType: text('order_type'),
  defaultUnit: text('default_unit'),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Sub Contract Price Master
export const subcontractPrices = pgTable('subcontract_prices', {
  id: text('id').primaryKey(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  categoryId: text('category_id').notNull(),
  subCategoryId: text('sub_category_id'),
  contractPrice: numeric('contract_price', { precision: 12, scale: 2 }).notNull(),
  unit: text('unit').notNull(),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Sub Contract Purchase Orders
export const subcontractPurchaseOrders = pgTable('subcontract_pos', {
  id: text('id').primaryKey(),
  poNumber: text('po_number').notNull(),
  poDate: text('po_date').notNull(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  orderType: text('order_type').notNull(),
  items: jsonb('items').notNull(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).default('0'),
  status: text('status').default('draft'),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. Sub Contract Delivery Issues & GRN Receives
export const subcontractIssues = pgTable('subcontract_issues', {
  id: text('id').primaryKey(),
  issueChallanNo: text('issue_challan_no').notNull(),
  poNumber: text('po_number'),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  items: jsonb('items').notNull(),
  issueDate: text('issue_date').notNull(),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subcontractReceives = pgTable('subcontract_receives', {
  id: text('id').primaryKey(),
  receiveChallanNo: text('receive_challan_no').notNull(),
  poNumber: text('po_number'),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  items: jsonb('items').notNull(),
  receiveDate: text('receive_date').notNull(),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 12. Accounts & Finance / General Ledger Vouchers
export const accountsTransactions = pgTable('accounts_transactions', {
  id: text('id').primaryKey(),
  voucherNo: text('voucher_no').notNull(),
  voucherType: text('voucher_type').notNull(), // 'Payment', 'Receipt', 'Journal', 'Contra'
  date: text('date').notNull(),
  accountHead: text('account_head').notNull(),
  accountCategory: text('account_category'),
  debit: numeric('debit', { precision: 14, scale: 2 }).default('0'),
  credit: numeric('credit', { precision: 14, scale: 2 }).default('0'),
  referenceNo: text('reference_no'),
  narration: text('narration'),
  businessId: text('business_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
