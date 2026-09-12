import React, { useState, useMemo } from 'react';
import { printElement } from '../utils/printHelper';
import { 
  Palette, 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  Building2, 
  DollarSign, 
  Package, 
  Trash2, 
  Edit3, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  X,
  ChevronDown,
  ArrowDownCircle,
  Sparkles,
  RefreshCw,
  Send,
  History,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Supplier, PurchaseOrder, Item } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DyeingManagementProps {
  userProfile: UserProfile;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  items: Item[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
  recalculateItemStock: (itemId: string, businessId: string) => Promise<void>;
  fetchFullHistory?: (silent?: boolean) => Promise<void>;
  syncAllData?: (silent?: boolean) => Promise<void>;
  isEditor: boolean;
}

const toSafeDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export function DyeingManagement({
  userProfile,
  suppliers,
  purchaseOrders,
  items,
  showToast,
  recalculateItemStock,
  fetchFullHistory,
  syncAllData,
  isEditor
}: DyeingManagementProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'ledger'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDyeingModalOpen, setIsDyeingModalOpen] = useState(false);
  const [viewingDyeingPO, setViewingDyeingPO] = useState<PurchaseOrder | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);

  // Supplier Dyeing Ledger State
  const [selectedLedgerSupplierId, setSelectedLedgerSupplierId] = useState<string>('');

  // Form State for Dyeing Order
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dyeingStatus, setDyeingStatus] = useState<'Pending' | 'In Process' | 'Completed' | 'Received'>('Pending');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<Array<{
    itemId: string;
    itemName: string;
    sku?: string;
    unit?: string;
    quantity: number;
    price: number;
    total: number;
    specification?: string; // Dyeing Shade / Color name
  }>>([]);

  // Filter Dyeing Mills / Suppliers
  const dyeingSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes('dyeing') || 
      s.name.toLowerCase().includes('mill') || 
      s.name.toLowerCase().includes('factory') ||
      s.name.toLowerCase().includes('textile') ||
      s.name.toLowerCase().includes('print')
    );
  }, [suppliers]);

  // Set default selected ledger supplier
  useMemo(() => {
    if (!selectedLedgerSupplierId && suppliers.length > 0) {
      const defaultSup = dyeingSuppliers[0] || suppliers[0];
      if (defaultSup) setSelectedLedgerSupplierId(defaultSup.id);
    }
  }, [suppliers, dyeingSuppliers, selectedLedgerSupplierId]);

  // Filter Purchase Orders that are Dyeing Orders
  const dyeingOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const isDyeingPO = po.poNumber.toUpperCase().includes('DYE') || 
                         (po.notes && po.notes.toLowerCase().includes('dyeing')) ||
                         (po.purchaseType as string) === 'Dyeing' ||
                         po.items.some(i => i.itemName.toLowerCase().includes('dyeing') || (i.specification && i.specification.toLowerCase().includes('shade')));
      
      if (!isDyeingPO) return false;
      if (po.status === 'pending_delete') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = po.poNumber.toLowerCase().includes(q);
        const matchesSup = po.supplierName.toLowerCase().includes(q);
        const matchesNotes = (po.notes || '').toLowerCase().includes(q);
        const matchesItem = po.items.some(i => i.itemName.toLowerCase().includes(q) || (i.specification || '').toLowerCase().includes(q));
        if (!matchesNo && !matchesSup && !matchesNotes && !matchesItem) return false;
      }

      return true;
    });
  }, [purchaseOrders, searchQuery]);

  // Dyeing Stats
  const stats = useMemo(() => {
    let totalQtyKg = 0;
    let totalCost = 0;
    let pendingCount = 0;
    let completedCount = 0;

    dyeingOrders.forEach(po => {
      totalCost += Number(po.totalAmount) || 0;
      po.items.forEach(i => {
        totalQtyKg += Number(i.quantity) || 0;
      });
      if (po.notes?.includes('Completed') || po.notes?.includes('Received')) {
        completedCount++;
      } else {
        pendingCount++;
      }
    });

    return {
      totalOrders: dyeingOrders.length,
      totalQtyKg,
      totalCost,
      pendingCount,
      completedCount,
      millCount: dyeingSuppliers.length
    };
  }, [dyeingOrders, dyeingSuppliers]);

  // Supplier Specific Dyeing Process Ledger
  const selectedSupplierObj = useMemo(() => {
    return suppliers.find(s => s.id === selectedLedgerSupplierId) || suppliers[0];
  }, [suppliers, selectedLedgerSupplierId]);

  const supplierDyeingLedger = useMemo(() => {
    if (!selectedLedgerSupplierId) return { entries: [], totalQty: 0, totalBill: 0, avgRate: 0 };

    const filteredPOs = dyeingOrders.filter(po => po.supplierId === selectedLedgerSupplierId);
    
    // Sort chronologically
    filteredPOs.sort((a, b) => toSafeDate(a.date).getTime() - toSafeDate(b.date).getTime());

    let runningQty = 0;
    let runningAmount = 0;

    const entries = filteredPOs.map(po => {
      const orderQty = po.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      const orderAmount = Number(po.totalAmount) || 0;
      runningQty += orderQty;
      runningAmount += orderAmount;

      return {
        id: po.id,
        poNumber: po.poNumber,
        date: toSafeDate(po.date),
        itemsSummary: po.items.map(i => `${i.itemName} ${i.specification ? `(${i.specification})` : ''}`).join(', '),
        quantityKg: orderQty,
        rate: orderQty > 0 ? (orderAmount / orderQty) : 0,
        amount: orderAmount,
        runningQty,
        runningAmount,
        notes: po.notes || '',
        rawPO: po
      };
    });

    const totalQty = runningQty;
    const totalBill = runningAmount;
    const avgRate = totalQty > 0 ? totalBill / totalQty : 0;

    return { entries, totalQty, totalBill, avgRate };
  }, [dyeingOrders, selectedLedgerSupplierId]);

  // Generate Dyeing PO Number
  const generateDyeingPONumber = () => {
    const dateStr = format(new Date(), 'yyyyMMdd');
    const random = Math.floor(100 + Math.random() * 900);
    return `PO-DYE-${dateStr}-${random}`;
  };

  // Open New Dyeing Modal
  const handleOpenNewDyeingModal = () => {
    setEditingPO(null);
    let selectedSup = dyeingSuppliers[0]?.id || suppliers[0]?.id || '';
    setPoSupplierId(selectedSup);
    setPoNumber(generateDyeingPONumber());
    setPoDate(format(new Date(), 'yyyy-MM-dd'));
    setDeliveryDate(format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    setDyeingStatus('Pending');
    setPoNotes('100% Cotton Fabric / Yarn Dyeing Process Order');

    const kgItem = items.find(i => i.unit?.toLowerCase() === 'kg' || i.name.toLowerCase().includes('fabric') || i.name.toLowerCase().includes('yarn'));

    setPoItems([
      {
        itemId: kgItem?.id || items[0]?.id || '',
        itemName: kgItem?.name || 'Cotton Single Jersey Fabric Dyeing',
        sku: kgItem?.sku || 'DYE-FAB-1',
        unit: 'Kg',
        quantity: 500,
        price: 85,
        total: 42500,
        specification: 'Navy Blue (Shade #402) - Reactive Dyeing'
      }
    ]);
    setIsDyeingModalOpen(true);
  };

  // Preset Loaders
  const loadPreset = (presetType: 'cotton' | 'polyester' | 'yarn') => {
    if (presetType === 'cotton') {
      setPoNotes('100% Cotton Single Jersey Fabric Dyeing Order - Softener & Reactive Finish');
      setPoItems([
        {
          itemId: items[0]?.id || '',
          itemName: '100% Cotton Single Jersey Fabric Dyeing',
          sku: 'DYE-COTTON-500',
          unit: 'Kg',
          quantity: 500,
          price: 85,
          total: 42500,
          specification: 'Navy Blue (Shade #402) - Fast Color'
        }
      ]);
    } else if (presetType === 'polyester') {
      setPoNotes('Polyester Rib / Interlock Fabric Dyeing Order - Disperse Dyeing Process');
      setPoItems([
        {
          itemId: items[0]?.id || '',
          itemName: 'Polyester Interlock Fabric Dyeing',
          sku: 'DYE-POLY-1000',
          unit: 'Kg',
          quantity: 1000,
          price: 75,
          total: 75000,
          specification: 'Jet Black (Shade #901)'
        }
      ]);
    } else if (presetType === 'yarn') {
      setPoNotes('30s Cotton Yarn Dyeing Process Order - High Fastness');
      setPoItems([
        {
          itemId: items[0]?.id || '',
          itemName: '30s/1 Combed Cotton Yarn Dyeing',
          sku: 'DYE-YARN-300',
          unit: 'Kg',
          quantity: 300,
          price: 120,
          total: 36000,
          specification: 'Melange Grey & White'
        }
      ]);
    }
    showToast(`${presetType.toUpperCase()} Dyeing preset loaded!`);
  };

  // Edit Existing PO
  const handleEditPO = (po: PurchaseOrder) => {
    setEditingPO(po);
    setPoSupplierId(po.supplierId);
    setPoNumber(po.poNumber);
    setPoDate(format(toSafeDate(po.date), 'yyyy-MM-dd'));
    setPoNotes(po.notes || '');
    setPoItems(po.items.map(item => ({ ...item })));
    setIsDyeingModalOpen(true);
  };

  // Delete PO
  const handleDeletePO = async (po: PurchaseOrder) => {
    if (!confirm(`Are you sure you want to delete Dyeing Order ${po.poNumber}?`)) return;

    try {
      await deleteDoc(doc(db, 'purchaseOrders', po.id));

      const txsQuery = query(
        collection(db, 'transactions'),
        where('businessId', '==', userProfile.businessId),
        where('poId', '==', po.id)
      );
      const txSnap = await getDocs(txsQuery);
      for (const txDoc of txSnap.docs) {
        await deleteDoc(doc(db, 'transactions', txDoc.id));
      }

      for (const item of po.items) {
        await recalculateItemStock(item.itemId, userProfile.businessId);
      }

      if (fetchFullHistory) await fetchFullHistory(true);
      if (syncAllData) await syncAllData(true);

      showToast(`Dyeing Order ${po.poNumber} deleted!`);
    } catch (err: any) {
      showToast('Failed to delete dyeing order', 'error');
    }
  };

  // Add Item Row
  const handleAddPORow = () => {
    const firstItem = items[0];
    setPoItems(prev => [
      ...prev,
      {
        itemId: firstItem?.id || '',
        itemName: firstItem?.name || '',
        sku: firstItem?.sku || '',
        unit: 'Kg',
        quantity: 100,
        price: 85,
        total: 8500,
        specification: 'Standard Shade'
      }
    ]);
  };

  // Remove Row
  const handleRemovePORow = (index: number) => {
    if (poItems.length === 1) {
      showToast('At least one item is required in the dyeing order', 'error');
      return;
    }
    setPoItems(prev => prev.filter((_, i) => i !== index));
  };

  // Item Field Change
  const handlePORowFieldChange = (index: number, field: string, val: any) => {
    setPoItems(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: val };
      if (field === 'itemId') {
        const found = items.find(item => item.id === val);
        if (found) {
          updated.itemName = found.name;
          updated.sku = found.sku;
          updated.unit = found.unit || 'Kg';
        }
      }
      if (field === 'quantity' || field === 'price') {
        const q = Number(field === 'quantity' ? val : updated.quantity) || 0;
        const p = Number(field === 'price' ? val : updated.price) || 0;
        updated.total = q * p;
      }
      return updated;
    }));
  };

  const poTotalAmount = useMemo(() => {
    return poItems.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
  }, [poItems]);

  // Save Dyeing Order
  const handleSaveDyeingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) {
      showToast('Please select a Dyeing Mill / Supplier', 'error');
      return;
    }
    const supplier = suppliers.find(s => s.id === poSupplierId);
    if (!supplier) {
      showToast('Supplier not found', 'error');
      return;
    }

    const validItems = poItems.filter(r => r.quantity > 0);
    if (validItems.length === 0) {
      showToast('Please add at least one item with valid quantity', 'error');
      return;
    }

    try {
      const timestamp = Timestamp.fromDate(new Date(poDate));
      const fullNotes = `[Dyeing Order] Delivery Date: ${deliveryDate} | Status: ${dyeingStatus} | ${poNotes.trim()}`.trim();

      if (editingPO) {
        await updateDoc(doc(db, 'purchaseOrders', editingPO.id), {
          poNumber: poNumber.trim() || editingPO.poNumber,
          date: timestamp,
          supplierId: supplier.id,
          supplierName: supplier.name,
          purchaseType: 'Dyeing',
          notes: fullNotes,
          items: validItems,
          totalAmount: poTotalAmount,
          status: 'active'
        });

        // Delete old transactions
        const txsQuery = query(
          collection(db, 'transactions'),
          where('businessId', '==', userProfile.businessId),
          where('poId', '==', editingPO.id)
        );
        const txSnap = await getDocs(txsQuery);
        for (const txDoc of txSnap.docs) {
          await deleteDoc(doc(db, 'transactions', txDoc.id));
        }

        // Re-add transactions
        const txPromises = validItems.map(row => {
          return addDoc(collection(db, 'transactions'), {
            itemId: row.itemId || items[0]?.id || 'DYE-GENERIC',
            type: 'IN',
            quantity: Number(row.quantity),
            price: Number(row.price),
            date: timestamp,
            reference: poNumber.trim() || editingPO.poNumber,
            purchaseType: 'Dyeing',
            notes: `Dyeing Process Order from ${supplier.name}. Color/Shade: ${row.specification || ''}. ${poNotes.trim()}`.trim(),
            supplierId: supplier.id,
            supplierName: supplier.name,
            poNumber: poNumber.trim() || editingPO.poNumber,
            poId: editingPO.id,
            ownerId: userProfile.uid,
            businessId: userProfile.businessId,
            status: 'active'
          });
        });
        await Promise.all(txPromises);

        for (const item of validItems) {
          if (item.itemId) await recalculateItemStock(item.itemId, userProfile.businessId);
        }

        showToast(`Dyeing Order ${poNumber} updated successfully!`);
      } else {
        const poRef = await addDoc(collection(db, 'purchaseOrders'), {
          poNumber: poNumber.trim() || generateDyeingPONumber(),
          date: timestamp,
          supplierId: supplier.id,
          supplierName: supplier.name,
          purchaseType: 'Dyeing',
          notes: fullNotes,
          items: validItems,
          totalAmount: poTotalAmount,
          businessId: userProfile.businessId,
          ownerId: userProfile.uid,
          status: 'active',
          createdAt: Timestamp.now()
        });

        const txPromises = validItems.map(row => {
          return addDoc(collection(db, 'transactions'), {
            itemId: row.itemId || items[0]?.id || 'DYE-GENERIC',
            type: 'IN',
            quantity: Number(row.quantity),
            price: Number(row.price),
            date: timestamp,
            reference: poNumber.trim() || generateDyeingPONumber(),
            purchaseType: 'Dyeing',
            notes: `Dyeing Process Order from ${supplier.name}. Shade: ${row.specification || ''}. ${poNotes.trim()}`.trim(),
            supplierId: supplier.id,
            supplierName: supplier.name,
            poNumber: poNumber.trim(),
            poId: poRef.id,
            ownerId: userProfile.uid,
            businessId: userProfile.businessId,
            status: 'active'
          });
        });
        await Promise.all(txPromises);

        for (const item of validItems) {
          if (item.itemId) await recalculateItemStock(item.itemId, userProfile.businessId);
        }

        showToast(`Dyeing Order ${poNumber} created successfully!`);
      }

      if (fetchFullHistory) await fetchFullHistory(true);
      if (syncAllData) await syncAllData(true);

      setIsDyeingModalOpen(false);
      setEditingPO(null);
    } catch (err: any) {
      console.error(err);
      showToast('Error saving dyeing order', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-purple-500/30 border border-purple-400/30 rounded-full text-xs font-bold text-purple-200 tracking-wide uppercase flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                Dyeing Process & Factory Head
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Dyeing Order Management
            </h1>
            <p className="text-purple-200/80 text-sm mt-1 max-w-2xl">
              Create, track, and manage fabric & yarn dyeing process orders in Kg, color shades, dyeing factory rates, delivery schedules, and work order challans.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenNewDyeingModal}
              className="px-5 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-900/40 transition-all flex items-center gap-2 transform active:scale-95"
            >
              <Plus className="w-5 h-5" />
              New Dyeing Order
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-neutral-100 shadow-sm">
        <button
          onClick={() => setActiveTab('orders')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
            activeTab === 'orders' 
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20" 
              : "text-neutral-600 hover:bg-neutral-50"
          )}
        >
          <Layers className="w-4 h-4" />
          Dyeing Purchase Orders ({dyeingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
            activeTab === 'ledger' 
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20" 
              : "text-neutral-600 hover:bg-neutral-50"
          )}
        >
          <History className="w-4 h-4" />
          Dyeing Factory Process Ledger
        </button>
      </div>

      {activeTab === 'orders' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <Palette className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Total Dyeing Orders</p>
                <h3 className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.totalOrders}</h3>
                <p className="text-[11px] text-neutral-400 mt-1">{stats.millCount} Dyeing Mills</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Total Dyeing Quantity</p>
                <h3 className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.totalQtyKg.toLocaleString()} <span className="text-sm font-semibold text-neutral-500">Kg</span></h3>
                <p className="text-[11px] text-blue-600 font-semibold mt-1">Fabric & Yarn Volume</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Total Dyeing Bill/Cost</p>
                <h3 className="text-2xl font-bold text-neutral-900 mt-0.5">৳ {stats.totalCost.toLocaleString()}</h3>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">Total Process Cost</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Active / Pending Dyeing</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingCount}</h3>
                <p className="text-[11px] text-neutral-400 mt-1">{stats.completedCount} Completed Orders</p>
              </div>
            </div>
          </div>

          {/* Filter & Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by PO#, Dyeing Mill, Fabric or Color Shade..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => loadPreset('cotton')}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 border border-purple-200"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Cotton Fabric (500 Kg @ 85 Tk)
              </button>
              <button
                onClick={() => loadPreset('polyester')}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 border border-indigo-200"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Polyester (1000 Kg @ 75 Tk)
              </button>
              <button
                onClick={() => loadPreset('yarn')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 border border-amber-200"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Yarn Dyeing (300 Kg @ 120 Tk)
              </button>
            </div>
          </div>

          {/* Dyeing Orders List */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-neutral-900 text-sm">Dyeing Purchase Orders List ({dyeingOrders.length})</h3>
              </div>
            </div>

            {dyeingOrders.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Palette className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-neutral-800">No Dyeing Orders Found</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 mb-6">
                  Create your first dedicated Dyeing Order for cotton, polyester fabric, or yarn with specs in Kg and color shades.
                </p>
                <button
                  onClick={handleOpenNewDyeingModal}
                  className="px-4 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl shadow hover:bg-purple-700 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Dyeing Order
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold uppercase tracking-wider border-b border-neutral-100">
                    <tr>
                      <th className="p-3">Order # & Date</th>
                      <th className="p-3">Dyeing Mill / Supplier</th>
                      <th className="p-3">Item / Fabric Details</th>
                      <th className="p-3 text-right">Quantity (Kg)</th>
                      <th className="p-3 text-right">Rate (Tk/Kg)</th>
                      <th className="p-3 text-right">Total Amount</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {dyeingOrders.map(po => {
                      const totalKg = po.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                      const avgRate = totalKg > 0 ? (po.totalAmount / totalKg) : 0;

                      return (
                        <tr key={po.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-purple-900 block">{po.poNumber}</span>
                            <span className="text-[10px] text-neutral-400">{format(toSafeDate(po.date), 'dd MMM yyyy')}</span>
                          </td>
                          <td className="p-3 font-semibold text-neutral-800">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span>{po.supplierName}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            {po.items.map((it, idx) => (
                              <div key={idx} className="mb-0.5">
                                <span className="font-semibold text-neutral-900">{it.itemName}</span>
                                {it.specification && (
                                  <span className="ml-1 text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                    {it.specification}
                                  </span>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className="p-3 text-right font-bold text-neutral-900">
                            {totalKg.toLocaleString()} Kg
                          </td>
                          <td className="p-3 text-right text-neutral-600">
                            ৳ {avgRate.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-bold text-purple-900">
                            ৳ {po.totalAmount.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              <Palette className="w-3 h-3 text-purple-600" />
                              Dyeing Active
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setViewingDyeingPO(po)}
                                className="p-1.5 text-neutral-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                title="Print Dyeing Work Order / Challan"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditPO(po)}
                                className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Edit Order"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePO(po)}
                                className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete Order"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* DYEING FACTORY PROCESS LEDGER (SUPPLIER-WISE) */
        <div className="space-y-6">
          {/* Supplier Selector Header */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Select Dyeing Mill / Factory
              </label>
              <div className="relative min-w-[280px]">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
                <select
                  value={selectedLedgerSupplierId}
                  onChange={e => setSelectedLedgerSupplierId(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.contactPerson ? `(${s.contactPerson})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => printElement('printable-dyeing-ledger', { title: 'Dyeing_Ledger', pageOrientation: 'landscape' })}
                className="px-4 py-2 bg-neutral-800 hover:bg-black text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Dyeing Ledger
              </button>
            </div>
          </div>

          {/* Ledger Summary Cards for Selected Factory */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
              <span className="text-[11px] font-semibold text-neutral-500">Selected Factory</span>
              <h4 className="text-base font-bold text-neutral-900 mt-1 truncate">{selectedSupplierObj?.name || 'N/A'}</h4>
              <p className="text-[10px] text-neutral-400 mt-0.5">{selectedSupplierObj?.phone || 'No Contact'}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
              <span className="text-[11px] font-semibold text-neutral-500">Total Orders Processed</span>
              <h4 className="text-xl font-bold text-purple-900 mt-1">{supplierDyeingLedger.entries.length}</h4>
              <p className="text-[10px] text-purple-600 font-semibold mt-0.5">Dyeing Work Orders</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
              <span className="text-[11px] font-semibold text-neutral-500">Total Volume Processed</span>
              <h4 className="text-xl font-bold text-blue-900 mt-1">{supplierDyeingLedger.totalQty.toLocaleString()} <span className="text-xs text-neutral-500 font-normal">Kg</span></h4>
              <p className="text-[10px] text-blue-600 font-semibold mt-0.5">Cumulative Fabric/Yarn</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
              <span className="text-[11px] font-semibold text-neutral-500">Total Dyeing Process Bill</span>
              <h4 className="text-xl font-bold text-emerald-900 mt-1">৳ {supplierDyeingLedger.totalBill.toLocaleString()}</h4>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Avg ৳ {supplierDyeingLedger.avgRate.toFixed(2)} / Kg</p>
            </div>
          </div>

          {/* Supplier Dyeing Process Ledger Table */}
          <div id="printable-dyeing-ledger" className="printable-doc bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden p-4 print:border-none print:shadow-none print:p-0 print:m-0">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 print:hidden">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-neutral-900 text-sm">
                  Dyeing Process History & Ledger — {selectedSupplierObj?.name}
                </h3>
              </div>
            </div>

            {supplierDyeingLedger.entries.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-500">
                No Dyeing process orders recorded yet for {selectedSupplierObj?.name}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">PO Number</th>
                      <th className="p-3">Fabric & Color Shade Specifications</th>
                      <th className="p-3 text-right">Order Qty (Kg)</th>
                      <th className="p-3 text-right">Rate (Tk/Kg)</th>
                      <th className="p-3 text-right">Order Total (Tk)</th>
                      <th className="p-3 text-right">Cumul. Vol (Kg)</th>
                      <th className="p-3 text-right">Cumul. Bill (Tk)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {supplierDyeingLedger.entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/20 transition-colors">
                        <td className="p-3 text-neutral-500">{format(entry.date, 'dd MMM yyyy')}</td>
                        <td className="p-3 font-bold text-purple-900">{entry.poNumber}</td>
                        <td className="p-3 text-neutral-800">{entry.itemsSummary}</td>
                        <td className="p-3 text-right font-bold text-neutral-900">{entry.quantityKg.toLocaleString()} Kg</td>
                        <td className="p-3 text-right text-neutral-600">৳ {entry.rate.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-purple-900">৳ {entry.amount.toLocaleString()}</td>
                        <td className="p-3 text-right font-semibold text-blue-900">{entry.runningQty.toLocaleString()} Kg</td>
                        <td className="p-3 text-right font-bold text-emerald-900">৳ {entry.runningAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-purple-50 font-bold text-purple-950 border-t border-purple-200">
                    <tr>
                      <td colSpan={3} className="p-3 text-right">Dyeing Factory Process Totals:</td>
                      <td className="p-3 text-right">{supplierDyeingLedger.totalQty.toLocaleString()} Kg</td>
                      <td className="p-3 text-right">Avg ৳ {supplierDyeingLedger.avgRate.toFixed(2)}</td>
                      <td className="p-3 text-right">৳ {supplierDyeingLedger.totalBill.toLocaleString()}</td>
                      <td className="p-3 text-right">{supplierDyeingLedger.totalQty.toLocaleString()} Kg</td>
                      <td className="p-3 text-right">৳ {supplierDyeingLedger.totalBill.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW / EDIT DYEING ORDER MODAL */}
      {isDyeingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-400/30">
                  <Palette className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingPO ? `Edit Dyeing Order ${editingPO.poNumber}` : 'New Dyeing Process Order'}
                  </h3>
                  <p className="text-xs text-purple-200/80">Configure dyeing mill, quantity in Kg, color shades & rates</p>
                </div>
              </div>
              <button
                onClick={() => setIsDyeingModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-purple-200 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDyeingOrder} className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Presets */}
              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200/80 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="font-bold text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Quick Presets:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadPreset('cotton')}
                    className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-800 font-bold border border-purple-200 rounded-lg text-[11px]"
                  >
                    500 Kg Cotton @ 85 Tk
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('polyester')}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-800 font-bold border border-indigo-200 rounded-lg text-[11px]"
                  >
                    1000 Kg Polyester @ 75 Tk
                  </button>
                </div>
              </div>

              {/* Order Headers */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div className="sm:col-span-2">
                  <label className="font-bold text-neutral-700 block mb-1">Dyeing Mill / Supplier *</label>
                  <select
                    value={poSupplierId}
                    onChange={e => setPoSupplierId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-bold text-neutral-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    <option value="">Select Dyeing Mill / Factory</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} {sup.phone ? `(${sup.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Dyeing PO #</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-mono font-bold text-neutral-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Order Date</label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={e => setPoDate(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-bold text-neutral-900"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-purple-600" />
                    Dyeing Items & Color Shade Specifications
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddPORow}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100 text-neutral-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 w-1/3">Fabric / Item Name</th>
                        <th className="p-2.5">Color / Shade Spec</th>
                        <th className="p-2.5 w-20 text-center">Unit</th>
                        <th className="p-2.5 w-24 text-right">Qty (Kg)</th>
                        <th className="p-2.5 w-28 text-right">Rate (Tk/Kg)</th>
                        <th className="p-2.5 w-28 text-right">Total (Tk)</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {poItems.map((row, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.itemName}
                              onChange={e => handlePORowFieldChange(idx, 'itemName', e.target.value)}
                              placeholder="Fabric/Yarn Item Name"
                              className="w-full p-2 border border-neutral-300 rounded-lg font-bold text-neutral-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.specification || ''}
                              onChange={e => handlePORowFieldChange(idx, 'specification', e.target.value)}
                              placeholder="e.g. Navy Blue #402, Reactive"
                              className="w-full p-2 border border-neutral-300 rounded-lg font-medium text-neutral-800"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.unit || 'Kg'}
                              onChange={e => handlePORowFieldChange(idx, 'unit', e.target.value)}
                              className="w-full p-2 border border-neutral-300 rounded-lg text-center font-bold text-neutral-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={row.quantity}
                              onChange={e => handlePORowFieldChange(idx, 'quantity', e.target.value)}
                              className="w-full p-2 border border-neutral-300 rounded-lg text-right font-bold text-neutral-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={row.price}
                              onChange={e => handlePORowFieldChange(idx, 'price', e.target.value)}
                              className="w-full p-2 border border-neutral-300 rounded-lg text-right font-bold text-neutral-900"
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-purple-900">
                            ৳ {(Number(row.total) || 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePORow(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total & Instructions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Special Dyeing Instructions / Notes</label>
                  <textarea
                    rows={3}
                    value={poNotes}
                    onChange={e => setPoNotes(e.target.value)}
                    placeholder="e.g. Shrinkage test required, Softener finish, Fast color guarantee..."
                    className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-sm font-bold text-purple-950">
                    <span>Total Dyeing Order Cost:</span>
                    <span className="text-xl text-purple-900">৳ {poTotalAmount.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-purple-700 mt-2">
                    Saving will record IN inventory transactions for the dyeing materials and update supplier process history.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsDyeingModalOpen(false)}
                  className="px-5 py-2.5 border border-neutral-300 rounded-xl font-bold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Save Dyeing Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRINTABLE DYEING WORK ORDER / CHALLAN */}
      {viewingDyeingPO && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div id="printable-dyeing-order" className="printable-doc bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 print:p-0 print:m-0 print:shadow-none print:max-w-none">
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <span className="font-bold text-purple-900 text-sm flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-600" /> Dyeing Work Order Challan
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printElement('printable-dyeing-order', { title: 'Dyeing_Work_Order' })}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print / PDF
                </button>
                <button
                  onClick={() => setViewingDyeingPO(null)}
                  className="p-2 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-neutral-200 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-neutral-900">{userProfile.businessName || 'ES TRIMS LIMITED'}</h2>
                  <p className="text-xs text-neutral-500">Fabric & Yarn Dyeing Work Order</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-purple-100 text-purple-900 font-bold text-xs rounded-lg uppercase">
                    DYEING WORK ORDER
                  </span>
                  <p className="text-xs font-mono font-bold text-neutral-800 mt-2">{viewingDyeingPO.poNumber}</p>
                  <p className="text-[11px] text-neutral-500">Date: {format(toSafeDate(viewingDyeingPO.date), 'dd MMMM yyyy')}</p>
                </div>
              </div>

              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-xs grid grid-cols-2 gap-4">
                <div>
                  <p className="text-neutral-400 font-semibold uppercase text-[10px]">Dyeing Mill / Factory:</p>
                  <p className="font-bold text-neutral-900 text-sm mt-0.5">{viewingDyeingPO.supplierName}</p>
                </div>
                <div>
                  <p className="text-neutral-400 font-semibold uppercase text-[10px]">Special Instructions:</p>
                  <p className="font-medium text-neutral-800 mt-0.5">{viewingDyeingPO.notes || 'N/A'}</p>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-neutral-200 rounded-lg overflow-hidden">
                <thead className="bg-neutral-100 font-bold text-neutral-700">
                  <tr>
                    <th className="p-3 border-b">#</th>
                    <th className="p-3 border-b">Fabric / Yarn Item</th>
                    <th className="p-3 border-b">Color / Shade Spec</th>
                    <th className="p-3 border-b text-right">Quantity (Kg)</th>
                    <th className="p-3 border-b text-right">Rate (Tk)</th>
                    <th className="p-3 border-b text-right">Total (Tk)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {viewingDyeingPO.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium text-neutral-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-neutral-900">{it.itemName}</td>
                      <td className="p-3 text-purple-800 font-medium">{it.specification || '-'}</td>
                      <td className="p-3 text-right font-bold">{it.quantity} {it.unit || 'Kg'}</td>
                      <td className="p-3 text-right">৳ {it.price}</td>
                      <td className="p-3 text-right font-bold text-neutral-900">৳ {it.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-purple-50 font-bold text-purple-950">
                  <tr>
                    <td colSpan={5} className="p-3 text-right">Total Dyeing Process Bill:</td>
                    <td className="p-3 text-right text-sm">৳ {viewingDyeingPO.totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs text-neutral-500">
                <div className="border-t border-neutral-300 pt-2 font-semibold">
                  Authorized Store Signature
                </div>
                <div className="border-t border-neutral-300 pt-2 font-semibold">
                  Dyeing Mill Receiver Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
