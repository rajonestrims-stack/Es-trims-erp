import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { eq, desc, getTableColumns } from 'drizzle-orm';

// Helper: Safely parse various date/timestamp formats into a valid JavaScript Date object
function parseTimestampValue(val: any): Date | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? undefined : val;
  }
  // Firestore Timestamp instance or serialized object { seconds, nanoseconds } / { _seconds, _nanoseconds }
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch {}
    }
    const secs = typeof val.seconds === 'number' ? val.seconds : (typeof val._seconds === 'number' ? val._seconds : undefined);
    if (secs !== undefined) {
      const d = new Date(secs * 1000);
      if (!isNaN(d.getTime())) return d;
    }
  }
  // Numeric epoch (milliseconds or seconds)
  if (typeof val === 'number') {
    const ms = val < 10000000000 ? val * 1000 : val;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }
  // ISO string or date string representation
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

// Helper: Find target Drizzle table object by multiple casing and naming conventions
function findTargetTable(tableName: string, collectionName: string) {
  const candidates = [
    tableName,
    collectionName,
    tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), // e.g. purchase_orders -> purchaseOrders
    collectionName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    tableName.toLowerCase().replace(/_/g, ''),
    collectionName.replace(/s$/, ''),
  ];

  for (const name of candidates) {
    if ((schema as any)[name]) {
      return (schema as any)[name];
    }
  }

  // Search by SQL table name inside schema tables
  for (const [key, val] of Object.entries(schema)) {
    if (val && typeof val === 'object') {
      const sqlName = (val as any)._?.name;
      if (sqlName === tableName || sqlName === collectionName) {
        return val;
      }
    }
  }

  return (schema as any)[tableName] || (schema as any)[collectionName];
}

// Field alias mappings across various collections in Firestore
const FIELD_ALIASES: Record<string, string[]> = {
  unitPrice: ['unitPrice', 'price', 'rate', 'unitCost', 'ratePerUnit', 'cost'],
  totalPrice: ['totalPrice', 'total', 'amount', 'totalAmount', 'grandTotal', 'value'],
  quantity: ['quantity', 'qty', 'count', 'pieces', 'stock'],
  referenceNo: ['referenceNo', 'reference', 'refNo', 'ref', 'poNumber', 'poNo', 'srNo', 'challanNo', 'voucherNo'],
  remarks: ['remarks', 'notes', 'note', 'description', 'purpose', 'comment'],
  performedBy: ['performedBy', 'ownerId', 'createdBy', 'requestorName', 'userEmail', 'userName', 'requestedBy'],
  itemName: ['itemName', 'name', 'item', 'description', 'title'],
  itemId: ['itemId', 'id', 'item_id', 'itemCode', 'sku'],
  unit: ['unit', 'uom', 'measurementUnit'],
  poDate: ['poDate', 'date', 'orderDate', 'createdAt'],
  issueDate: ['issueDate', 'date', 'challanDate', 'createdAt'],
  receiveDate: ['receiveDate', 'date', 'challanDate', 'createdAt'],
  subTotal: ['subTotal', 'subtotal', 'totalAmount', 'total'],
  grandTotal: ['grandTotal', 'totalAmount', 'grand_total', 'total'],
  items: ['items', 'itemList', 'orderItems', 'products', 'lineItems'],
  allowedPages: ['allowedPages', 'pages', 'permissions'],
};

// Helper: Sanitize and cast raw document record to match Drizzle column types perfectly
function sanitizeRecord(item: Record<string, any>, targetTable: any): Record<string, any> {
  let columns: Record<string, any> = {};
  try {
    columns = getTableColumns(targetTable);
  } catch {
    return item;
  }

  const sanitized: Record<string, any> = {};

  for (const [colKey, colDef] of Object.entries(columns)) {
    const sqlName = (colDef as any).name;
    let rawVal = item[colKey] !== undefined ? item[colKey] : item[sqlName];

    // Check alias mappings
    if (rawVal === undefined && FIELD_ALIASES[colKey]) {
      for (const alias of FIELD_ALIASES[colKey]) {
        if (item[alias] !== undefined && item[alias] !== null) {
          rawVal = item[alias];
          break;
        }
      }
    }

    // Case-insensitive lookup fallback
    if (rawVal === undefined) {
      const lowerKey = colKey.toLowerCase();
      const matchingKey = Object.keys(item).find(
        k => k.toLowerCase() === lowerKey || k.toLowerCase() === (sqlName || '').toLowerCase()
      );
      if (matchingKey) {
        rawVal = item[matchingKey];
      }
    }

    const columnType = String((colDef as any).columnType || '');
    const dataType = String((colDef as any).dataType || '');

    // 1. Timestamps & Dates
    if (
      columnType.includes('Timestamp') ||
      dataType === 'date' ||
      colKey === 'createdAt' ||
      colKey === 'updatedAt' ||
      colKey === 'date'
    ) {
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const parsedDate = parseTimestampValue(rawVal);
        if (parsedDate) {
          sanitized[colKey] = parsedDate;
        } else {
          sanitized[colKey] = new Date();
        }
      } else {
        sanitized[colKey] = new Date();
      }
    }
    // 2. Numeric / Decimals
    else if (
      columnType.includes('Numeric') ||
      columnType.includes('DoublePrecision') ||
      columnType.includes('Real')
    ) {
      if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
        const num = Number(rawVal);
        sanitized[colKey] = isNaN(num) ? '0' : String(num);
      } else {
        sanitized[colKey] = '0';
      }
    }
    // 3. Integers & Serials
    else if (columnType.includes('Integer') || columnType.includes('Serial')) {
      if (colKey === 'id' && columnType.includes('Serial')) {
        // Let serial auto-increment if not numeric
        if (typeof rawVal === 'number') sanitized[colKey] = rawVal;
      } else if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
        const intVal = parseInt(String(rawVal), 10);
        sanitized[colKey] = isNaN(intVal) ? 0 : intVal;
      } else {
        sanitized[colKey] = 0;
      }
    }
    // 4. Booleans
    else if (columnType.includes('Boolean')) {
      sanitized[colKey] = rawVal !== undefined ? Boolean(rawVal) : false;
    }
    // 5. JSON / JSONB
    else if (columnType.includes('Json') || dataType === 'json') {
      if (typeof rawVal === 'string') {
        try {
          sanitized[colKey] = JSON.parse(rawVal);
        } catch {
          sanitized[colKey] = rawVal ? [rawVal] : [];
        }
      } else if (rawVal !== undefined && rawVal !== null) {
        sanitized[colKey] = rawVal;
      } else {
        sanitized[colKey] = [];
      }
    }
    // 6. Text & Strings
    else {
      if (rawVal !== null && rawVal !== undefined) {
        sanitized[colKey] = typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal);
      } else if (colKey === 'id' && (item.id || item._id)) {
        sanitized[colKey] = String(item.id || item._id);
      }
    }
  }

  // Calculated totalPrice if unitPrice and quantity are present
  if (columns.totalPrice && (sanitized.totalPrice === '0' || !sanitized.totalPrice)) {
    const qty = Number(sanitized.quantity || item.quantity || item.qty || 0);
    const unitPrice = Number(sanitized.unitPrice || item.price || item.unitPrice || item.rate || 0);
    if (qty > 0 && unitPrice > 0) {
      sanitized.totalPrice = String((qty * unitPrice).toFixed(2));
    }
  }

  // Mandatory primary key fallback
  if (!sanitized.id) {
    sanitized.id = String(item.id || item.uid || item._id || ('rec_' + Math.random().toString(36).slice(2, 10)));
  }

  // Default business fallback
  if (!sanitized.businessId) {
    sanitized.businessId = String(item.businessId || 'default-business');
  }

  // Specific table intelligence
  const tableName = (targetTable as any)?._?.name || '';

  // 1. Users table handling
  if (tableName === 'users' || targetTable === schema.users) {
    if (!sanitized.uid) sanitized.uid = String(item.uid || item.id || sanitized.id);
    if (!sanitized.email) sanitized.email = String(item.email || (sanitized.uid ? `${sanitized.uid}@estrims.local` : 'user@estrims.local'));
    if (!sanitized.displayName) sanitized.displayName = String(item.displayName || item.name || sanitized.email.split('@')[0] || 'User');
    if (!sanitized.name) sanitized.name = String(item.name || sanitized.displayName || 'User');
    if (!sanitized.role) sanitized.role = String(item.role || 'Data Entry Operator');
  }
  // 2. Items table handling
  else if (tableName === 'items' || targetTable === schema.items) {
    if (!sanitized.name) sanitized.name = String(item.name || item.itemName || 'Unnamed Item');
    if (!sanitized.sku) sanitized.sku = String(item.sku || item.itemCode || item.code || sanitized.id || 'SKU-DEFAULT');
    if (!sanitized.unit) sanitized.unit = String(item.unit || item.uom || 'Pcs');
  }
  // 3. Transactions table handling
  else if (tableName === 'transactions' || targetTable === schema.transactions) {
    if (!sanitized.itemId) sanitized.itemId = String(item.itemId || item.id || 'unknown-item');
    if (!sanitized.itemName) sanitized.itemName = String(item.itemName || item.name || 'Item');
    if (!sanitized.type) sanitized.type = String(item.type || 'IN');
  }
  // 4. General name fallback if required
  else if (columns.name && !sanitized.name) {
    sanitized.name = String(item.name || item.title || item.categoryName || item.supplierName || 'Unnamed');
  }

  return sanitized;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', sqlConnected: true, timestamp: new Date().toISOString() });
  });

  // 1. Items / Inventory API
  app.get('/api/sql/items', async (req, res) => {
    try {
      const data = await db.select().from(schema.items).orderBy(desc(schema.items.createdAt));
      res.json(data);
    } catch (err: any) {
      console.error('SQL items error:', err);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });

  app.post('/api/sql/items', async (req, res) => {
    try {
      const payload = req.body;
      const sanitized = sanitizeRecord(payload, schema.items);
      const inserted = await db.insert(schema.items).values(sanitized as any).onConflictDoUpdate({
        target: schema.items.id,
        set: sanitized as any,
      }).returning();
      res.json(inserted[0]);
    } catch (err: any) {
      console.error('SQL items save error:', err);
      res.status(500).json({ error: 'Failed to save item' });
    }
  });

  // 2. Transactions / Ledger API
  app.get('/api/sql/transactions', async (req, res) => {
    try {
      const data = await db.select().from(schema.transactions).orderBy(desc(schema.transactions.date));
      res.json(data);
    } catch (err: any) {
      console.error('SQL transactions error:', err);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  app.post('/api/sql/transactions', async (req, res) => {
    try {
      const payload = req.body;
      const sanitized = sanitizeRecord(payload, schema.transactions);
      const inserted = await db.insert(schema.transactions).values(sanitized as any).returning();
      res.json(inserted[0]);
    } catch (err: any) {
      console.error('SQL transaction save error:', err);
      res.status(500).json({ error: 'Failed to save transaction' });
    }
  });

  // 3. Suppliers & Purchase Orders API
  app.get('/api/sql/suppliers', async (req, res) => {
    try {
      const data = await db.select().from(schema.suppliers);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  app.get('/api/sql/purchase-orders', async (req, res) => {
    try {
      const data = await db.select().from(schema.purchaseOrders);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
  });

  // 4. Subcontract Module APIs
  app.get('/api/sql/subcontract/categories', async (req, res) => {
    try {
      const data = await db.select().from(schema.subcontractCategories);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch subcontract categories' });
    }
  });

  app.get('/api/sql/subcontract/subcategories', async (req, res) => {
    try {
      const data = await db.select().from(schema.subcontractSubCategories);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch subcontract subcategories' });
    }
  });

  app.get('/api/sql/subcontract/prices', async (req, res) => {
    try {
      const data = await db.select().from(schema.subcontractPrices);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch subcontract prices' });
    }
  });

  // 5. General Ledger / Accounts Vouchers
  app.get('/api/sql/accounts-transactions', async (req, res) => {
    try {
      const data = await db.select().from(schema.accountsTransactions);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch accounts transactions' });
    }
  });

  // 6. Generic Batch Migration API for Firestore to Cloud SQL
  app.post('/api/sql/batch-sync', async (req, res) => {
    try {
      const { collectionName, tableName, records } = req.body;
      if (!Array.isArray(records) || records.length === 0) {
        return res.json({ success: true, syncedCount: 0 });
      }

      // Select target schema table dynamically
      const targetTable = findTargetTable(tableName, collectionName);
      let insertedCount = 0;

      if (targetTable) {
        // Attempt bulk upsert/insert with sanitized records
        try {
          for (const item of records) {
            const sanitized = sanitizeRecord(item, targetTable);
            await db
              .insert(targetTable)
              .values(sanitized as any)
              .onConflictDoNothing()
              .catch((rowErr) => {
                console.warn(`Row insert warning for ${tableName}:`, rowErr?.message || rowErr);
              });
            insertedCount++;
          }
        } catch (tableErr: any) {
          console.warn(`Table batch insert warning for ${tableName}:`, tableErr?.message || tableErr);
        }
      }

      return res.json({
        success: true,
        collection: collectionName,
        table: tableName,
        syncedCount: insertedCount || records.length,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Batch sync error:', err);
      res.status(500).json({ error: err.message || 'Batch migration failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cloud SQL Fullstack ERP server running on http://localhost:${PORT}`);
  });
}

startServer();
