import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  ShieldCheck, 
  Server, 
  Check, 
  Download, 
  UploadCloud, 
  Play, 
  HardDrive,
  Copy,
  Terminal,
  FileCheck
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';

interface DataMigrationManagerProps {
  userProfile?: UserProfile;
}

interface MigrationTableStatus {
  name: string;
  firestoreCol: string;
  sqlTable: string;
  firestoreCount: number;
  migratedCount: number;
  status: 'idle' | 'scanning' | 'migrating' | 'completed' | 'error';
  errorMsg?: string;
}

interface CollectionConfigItem {
  name: string;
  col: string;
  sql: string;
  aliases?: string[];
}

const COLLECTIONS_CONFIG: CollectionConfigItem[] = [
  { name: 'Item Master / Inventory', col: 'items', sql: 'items' },
  { name: 'Stock Transactions', col: 'transactions', sql: 'transactions' },
  { name: 'Categories & Types', col: 'categories', sql: 'categories', aliases: ['salesCategories', 'sales_categories'] },
  { name: 'Suppliers Directory', col: 'suppliers', sql: 'suppliers' },
  { name: 'Purchase Orders', col: 'purchaseOrders', sql: 'purchase_orders', aliases: ['purchase_orders'] },
  { name: 'Supplier Payments', col: 'supplierPayments', sql: 'supplier_payments', aliases: ['supplier_payments'] },
  { name: 'Sales / Customer Orders', col: 'customer_orders', sql: 'sales_orders', aliases: ['salesOrders', 'sales_orders'] },
  { name: 'Buyers Master', col: 'buyers', sql: 'buyers' },
  { name: 'Customers Master', col: 'customers', sql: 'customers' },
  { name: 'Subcontract POs', col: 'subcontract_pos', sql: 'subcontract_pos', aliases: ['subcontractPOs', 'subcontract_orders'] },
  { name: 'Subcontract Items', col: 'subcontract_items', sql: 'subcontract_items', aliases: ['subcontractItems'] },
  { name: 'Bank Loan Sanctions', col: 'bank_facility_sanctions', sql: 'loan_sanctions', aliases: ['loanSanctions', 'loan_sanctions'] },
  { name: 'Bank Loans Records', col: 'bank_loans', sql: 'bank_loans', aliases: ['bankLoans'] },
  { name: 'User Profiles & Accounts', col: 'users', sql: 'users' },
  { name: 'System Roles & Permissions', col: 'roles', sql: 'user_roles', aliases: ['userRoles', 'user_roles'] },
  { name: 'Employees Directory', col: 'employees', sql: 'employees' },
  { name: 'Departments & Designations', col: 'departments', sql: 'departments' },
  { name: 'Approval Requests', col: 'approvalRequests', sql: 'approval_requests', aliases: ['approval_requests'] },
  { name: 'System Audit Logs', col: 'audit_logs', sql: 'audit_logs', aliases: ['auditLogs'] }
];

export const DataMigrationManager: React.FC<DataMigrationManagerProps> = ({ userProfile }) => {
  const [tables, setTables] = useState<MigrationTableStatus[]>(() => 
    COLLECTIONS_CONFIG.map(c => ({
      name: c.name,
      firestoreCol: c.col,
      sqlTable: c.sql,
      firestoreCount: 0,
      migratedCount: 0,
      status: 'idle'
    }))
  );

  const [isScanning, setIsScanning] = useState(false);
  const [isMigratingAll, setIsMigratingAll] = useState(false);
  const [activeLog, setActiveLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [sqlConnected, setSqlConnected] = useState<boolean | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActiveLog(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 100)]);
  };

  // Helper to fetch and merge docs from primary and alias collections
  const fetchAllDocsForConfig = async (config: CollectionConfigItem) => {
    const targetCols = [config.col, ...(config.aliases || [])];
    const docMap = new Map<string, any>();

    for (const colName of targetCols) {
      try {
        const snap = await getDocs(collection(db, colName));
        snap.forEach(d => {
          if (!docMap.has(d.id)) {
            docMap.set(d.id, { id: d.id, ...d.data() });
          }
        });
      } catch (err: any) {
        console.warn(`Scan note for ${colName}:`, err?.message || err);
      }
    }

    return Array.from(docMap.values());
  };

  // Check health on mount
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setSqlConnected(data.status === 'ok');
        addLog('Connected to Cloud SQL / Backend API Service.');
      })
      .catch(() => {
        setSqlConnected(false);
        addLog('Unable to connect to backend server /api/health');
      });
  }, []);

  // 1. Scan Firestore collections count
  const handleScanCounts = async () => {
    setIsScanning(true);
    addLog('Starting full scan of Firestore collections...');
    
    try {
      const updated = await Promise.all(
        COLLECTIONS_CONFIG.map(async (cfg, idx) => {
          const t = tables[idx] || {
            name: cfg.name,
            firestoreCol: cfg.col,
            sqlTable: cfg.sql,
            firestoreCount: 0,
            migratedCount: 0,
            status: 'idle'
          };
          try {
            const records = await fetchAllDocsForConfig(cfg);
            return {
              ...t,
              firestoreCount: records.length,
              status: records.length > 0 ? ('idle' as const) : ('completed' as const),
              errorMsg: undefined
            };
          } catch (err: any) {
            console.error(`Error scanning ${cfg.col}:`, err);
            return { ...t, firestoreCount: 0, errorMsg: err.message };
          }
        })
      );
      setTables(updated);
      const totalDocs = updated.reduce((acc, curr) => acc + curr.firestoreCount, 0);
      addLog(`Scan completed: Found ${totalDocs} records across ${updated.length} collections in Firestore.`);
    } catch (err: any) {
      addLog(`Scan error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 2. Export / Transfer single collection
  const migrateCollection = async (index: number) => {
    const cfg = COLLECTIONS_CONFIG[index];
    const table = tables[index];
    if (!cfg || !table) return;

    setTables(prev => prev.map((t, idx) => idx === index ? { ...t, status: 'migrating', errorMsg: undefined } : t));
    addLog(`Extracting data from Firestore: ${cfg.col}...`);

    try {
      const records = await fetchAllDocsForConfig(cfg);

      if (records.length === 0) {
        setTables(prev => prev.map((t, idx) => idx === index ? { ...t, status: 'completed', migratedCount: 0 } : t));
        addLog(`No records to transfer for ${cfg.col}.`);
        return;
      }

      addLog(`Sending ${records.length} records of ${cfg.col} to Cloud SQL (${cfg.sql})...`);

      const res = await fetch('/api/sql/batch-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: cfg.col,
          tableName: cfg.sql,
          records
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }

      const result = await res.json();
      setTables(prev => prev.map((t, idx) => idx === index ? {
        ...t,
        status: 'completed',
        migratedCount: result.syncedCount || records.length
      } : t));

      addLog(`Successfully synced ${result.syncedCount || records.length} records into table "${cfg.sql}".`);
    } catch (err: any) {
      console.error(`Migration error for ${cfg.col}:`, err);
      setTables(prev => prev.map((t, idx) => idx === index ? {
        ...t,
        status: 'error',
        errorMsg: err.message
      } : t));
      addLog(`Failed to migrate ${cfg.col}: ${err.message}`);
    }
  };

  // 3. Migrate All Collections
  const handleMigrateAll = async () => {
    setIsMigratingAll(true);
    addLog('Starting batch migration of all Firestore data to Cloud SQL...');
    
    for (let i = 0; i < tables.length; i++) {
      await migrateCollection(i);
    }
    
    setIsMigratingAll(false);
    addLog('All collection transfers finished.');
  };

  const totalFirestoreDocs = tables.reduce((acc, t) => acc + t.firestoreCount, 0);
  const totalMigratedDocs = tables.reduce((acc, t) => acc + t.migratedCount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <Database className="w-3.5 h-3.5" />
              <span>Google Cloud SQL & Firestore Migration Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Cloud SQL Data Migration & Sync Engine
            </h1>
            <p className="text-blue-200/90 text-sm leading-relaxed">
              Scan all collections from Firebase Firestore and automatically stream them into your PostgreSQL database schema with schema-mapping, type-casting, and zero downtime.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleScanCounts}
              disabled={isScanning || isMigratingAll}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Firestore'}</span>
            </button>

            <button
              onClick={handleMigrateAll}
              disabled={isScanning || isMigratingAll}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-black shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isMigratingAll ? 'Migrating All Data...' : 'Migrate All Collections'}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div>
            <span className="text-xs font-medium text-blue-300">Backend API Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${sqlConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="font-bold text-sm text-white">{sqlConnected ? 'Active & Ready' : 'Connecting...'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-blue-300">Total Scanned Records</span>
            <p className="text-lg font-black text-white mt-0.5">{totalFirestoreDocs.toLocaleString()}</p>
          </div>

          <div>
            <span className="text-xs font-medium text-blue-300">Transferred to SQL</span>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{totalMigratedDocs.toLocaleString()}</p>
          </div>

          <div>
            <span className="text-xs font-medium text-blue-300">Collections Managed</span>
            <p className="text-lg font-black text-white mt-0.5">{tables.length} Modules</p>
          </div>
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Firestore Collections & Cloud SQL Tables</span>
            </h3>
            <span className="text-xs text-neutral-500 font-medium">Click "Migrate" on any module</span>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs divide-y divide-neutral-100 overflow-hidden">
            {tables.map((table, index) => (
              <div key={table.firestoreCol} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/80 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900">{table.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600">
                      {table.firestoreCol} &rarr; {table.sqlTable}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>Firestore: <strong>{table.firestoreCount}</strong> docs</span>
                    <span>&bull;</span>
                    <span>Transferred: <strong className="text-emerald-600">{table.migratedCount}</strong></span>
                    {table.errorMsg && (
                      <span className="text-rose-600 font-medium truncate max-w-xs">&bull; {table.errorMsg}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {table.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready</span>
                    </span>
                  )}
                  {table.status === 'migrating' && (
                    <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing...</span>
                    </span>
                  )}
                  {table.status === 'error' && (
                    <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Failed</span>
                    </span>
                  )}

                  <button
                    onClick={() => migrateCollection(index)}
                    disabled={table.status === 'migrating' || isMigratingAll}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Migrate</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Migration Terminal Log */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-neutral-700" />
              <span>Migration Console Logs</span>
            </h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeLog.join('\n'));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="bg-neutral-950 text-neutral-300 font-mono text-xs p-4 rounded-2xl border border-neutral-800 h-[500px] overflow-y-auto space-y-2 shadow-inner">
            <div className="text-neutral-500 text-[11px] pb-2 border-b border-neutral-800">
              # Real-time Cloud SQL Migration Output Logs
            </div>
            {activeLog.length === 0 ? (
              <div className="text-neutral-600 italic py-4">No events logged yet. Click "Scan Firestore" or "Migrate" to begin.</div>
            ) : (
              activeLog.map((log, i) => (
                <div key={i} className="leading-relaxed break-all">
                  <span className="text-blue-400">&gt;</span> {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
