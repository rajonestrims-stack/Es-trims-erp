import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  Timestamp, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileText, 
  Package, 
  Layers, 
  Sparkles,
  ArrowRight,
  Send,
  Building2,
  Calendar,
  User,
  Hash,
  RefreshCw
} from 'lucide-react';
import { db } from '../firebase';
import { 
  Item, 
  Transaction, 
  UserProfile, 
  StoreRequisitionData, 
  StoreRequisitionItem 
} from '../types';

export interface DirectStoreRequisitionRow {
  itemId: string;
  quantity: number | string;
  specification: string;
  remarks: string;
}

export interface DirectStoreRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  initialItemId?: string;
  transactions?: Transaction[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onRequisitionCreated: (reqData: StoreRequisitionData) => void;
  recalculateItemStock: (itemId: string, businessId: string) => Promise<void>;
}

export function DirectStoreRequisitionModal({
  isOpen,
  onClose,
  items,
  initialItemId,
  transactions = [],
  userProfile,
  showToast,
  onRequisitionCreated,
  recalculateItemStock
}: DirectStoreRequisitionModalProps) {
  const isViewer = userProfile.role === 'viewer';
  const bId = userProfile.businessId;

  // Auto sequential SR No calculation
  const calculateNextSrNo = () => {
    let maxNum = 0;

    transactions.forEach(tx => {
      const refs = [tx.srNo, tx.reference].filter(Boolean);
      refs.forEach(ref => {
        if (typeof ref === 'string' && /^SR/i.test(ref)) {
          const matches = ref.match(/\d+/g);
          if (matches && matches.length > 0) {
            const lastDigitStr = matches[matches.length - 1];
            const num = parseInt(lastDigitStr, 10);
            if (!isNaN(num) && num < 100000 && num > maxNum) {
              maxNum = num;
            }
          }
        }
      });
    });

    try {
      const savedLastSr = localStorage.getItem('es_trims_last_sr_no');
      if (savedLastSr) {
        const matches = savedLastSr.match(/\d+/g);
        if (matches && matches.length > 0) {
          const lastDigitStr = matches[matches.length - 1];
          const num = parseInt(lastDigitStr, 10);
          if (!isNaN(num) && num < 100000 && num > maxNum) {
            maxNum = num;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading es_trims_last_sr_no from localStorage', e);
    }

    const nextNum = maxNum + 1;
    return `SR-${String(nextNum).padStart(4, '0')}`;
  };

  const [srNo, setSrNo] = useState('SR-0001');
  const [srDate, setSrDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [requiredDate, setRequiredDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [department, setDepartment] = useState('Cutting');
  const [location, setLocation] = useState('Main Store');
  const [requestorName, setRequestorName] = useState(userProfile.displayName || userProfile.name || '');
  const [designation, setDesignation] = useState('');
  const [purpose, setPurpose] = useState('Direct store requisition for department consumption');
  const [jobNo, setJobNo] = useState('');
  const [style, setStyle] = useState('');
  const [generalRemarks, setGeneralRemarks] = useState('');

  const [rows, setRows] = useState<DirectStoreRequisitionRow[]>([
    { itemId: '', quantity: 1, specification: '', remarks: '' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSrNo(calculateNextSrNo());
      setSrDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setRequiredDate(format(new Date(), 'yyyy-MM-dd'));
      setRequestorName(userProfile.displayName || userProfile.name || '');
      if (initialItemId) {
        setRows([{ itemId: initialItemId, quantity: 1, specification: '', remarks: '' }]);
      } else {
        setRows([{ itemId: '', quantity: 1, specification: '', remarks: '' }]);
      }
    }
  }, [isOpen, transactions, initialItemId, userProfile]);

  const handleAddRow = () => {
    setRows([
      ...rows,
      { itemId: '', quantity: 1, specification: '', remarks: '' }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      showToast('At least one item row is required.', 'error');
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof DirectStoreRequisitionRow, value: any) => {
    const updated = [...rows];
    const currentRow = { ...updated[index], [field]: value };

    // Auto-fill specification from item description if item changed
    if (field === 'itemId') {
      const selectedItem = items.find(i => i.id === value);
      if (selectedItem && !currentRow.specification) {
        currentRow.specification = selectedItem.description || selectedItem.name;
      }
    }

    updated[index] = currentRow;
    setRows(updated);
  };

  // Check cumulative quantities and stock availability
  const stockValidation = useMemo(() => {
    const itemQtyMap: Record<string, number> = {};
    rows.forEach(r => {
      if (r.itemId && Number(r.quantity) > 0) {
        itemQtyMap[r.itemId] = (itemQtyMap[r.itemId] || 0) + Number(r.quantity);
      }
    });

    const shortages: { item: Item; requested: number; available: number }[] = [];

    Object.entries(itemQtyMap).forEach(([itemId, reqQty]) => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        const available = Number(item.currentStock) || 0;
        if (available + 0.0001 < reqQty) {
          shortages.push({ item, requested: reqQty, available });
        }
      }
    });

    return {
      isValid: shortages.length === 0,
      shortages,
      itemQtyMap
    };
  }, [rows, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isViewer) {
      showToast('Viewer role cannot create store requisitions.', 'error');
      return;
    }

    if (!srNo.trim()) {
      showToast('Store Requisition (SR) No. is required.', 'error');
      return;
    }

    const validRows = rows.filter(r => r.itemId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      showToast('Please select at least one item with quantity greater than 0.', 'error');
      return;
    }

    if (!stockValidation.isValid) {
      const shortageDetails = stockValidation.shortages
        .map(s => `• ${s.item.name}: In Stock ${s.available.toFixed(2)} ${s.item.unit}, Requested ${s.requested.toFixed(2)} ${s.item.unit}`)
        .join('\n');
      showToast(`Cannot issue! Insufficient stock in Store:\n${shortageDetails}`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const createdItemsSummary: StoreRequisitionItem[] = [];
      const affectedItemIds = new Set<string>();

      for (const row of validRows) {
        const item = items.find(i => i.id === row.itemId)!;
        const qty = Number(row.quantity);
        const avgCost = Number(item.avgCost) || 0;

        // 1. Record stock transaction
        await addDoc(collection(db, 'transactions'), {
          itemId: item.id,
          type: 'PRODUCTION',
          quantity: qty,
          price: avgCost,
          date: Timestamp.fromDate(new Date(srDate)),
          reference: srNo.trim(),
          srNo: srNo.trim(),
          department: department.trim(),
          location: location.trim(),
          requestorName: requestorName.trim(),
          designation: designation.trim(),
          purpose: purpose.trim(),
          jobNo: jobNo.trim(),
          style: style.trim(),
          requiredDate,
          itemSpecification: row.specification.trim(),
          itemRemarks: row.remarks.trim(),
          notes: generalRemarks.trim() || `Direct Store Requisition ${srNo.trim()}`,
          ownerId: userProfile.uid,
          businessId: bId,
          status: 'active'
        });

        affectedItemIds.add(item.id);

        // 2. Optimistically deduct stock in items collection
        const newStock = Math.max(0, (Number(item.currentStock) || 0) - qty);
        await updateDoc(doc(db, 'items', item.id), {
          currentStock: Number(newStock.toFixed(4)),
          updatedAt: Timestamp.now()
        }).catch(err => console.warn('Item stock update failed:', err));

        createdItemsSummary.push({
          itemId: item.id,
          itemCode: item.sku,
          itemName: item.name,
          specification: row.specification.trim(),
          unit: item.unit,
          quantity: qty,
          notes: row.remarks.trim(),
          remarks: row.remarks.trim()
        });
      }

      // 3. Save to store_requisitions document
      const requisitionDocData = {
        srNo: srNo.trim(),
        srDate: format(new Date(srDate), 'yyyy-MM-dd HH:mm'),
        requiredDate: requiredDate || '',
        department: department.trim(),
        location: location.trim(),
        requestorName: requestorName.trim(),
        designation: designation.trim(),
        purpose: purpose.trim(),
        jobNo: jobNo.trim(),
        style: style.trim(),
        type: 'PRODUCTION',
        mode: 'DIRECT_STORE_REQUISITION',
        remarks: generalRemarks.trim(),
        notes: generalRemarks.trim(),
        status: 'issued',
        items: createdItemsSummary,
        businessId: bId,
        ownerId: userProfile.uid,
        createdAt: Timestamp.now(),
        issuedAt: Timestamp.now(),
        issuedBy: requestorName.trim()
      };

      await addDoc(collection(db, 'store_requisitions'), requisitionDocData).catch(err =>
        console.warn('Store requisition collection insert warning:', err)
      );

      // 4. Trigger stock recalculations in background
      setTimeout(() => {
        affectedItemIds.forEach(id => {
          recalculateItemStock(id, bId).catch(console.error);
        });
      }, 300);

      try {
        localStorage.setItem('es_trims_last_sr_no', srNo.trim());
      } catch (e) {
        console.warn('Failed to save last SR No to localStorage:', e);
      }

      showToast(`Direct Store Requisition ${srNo} confirmed & issued successfully! Stock deducted.`, 'success');

      // 5. Open printable slip
      const printData: StoreRequisitionData = {
        srNo: srNo.trim(),
        srDate: format(new Date(srDate), 'yyyy-MM-dd HH:mm'),
        department: department.trim(),
        location: location.trim(),
        requestorName: requestorName.trim(),
        purpose: purpose.trim(),
        jobNo: jobNo.trim(),
        style: style.trim(),
        type: 'PRODUCTION',
        remarks: generalRemarks.trim(),
        items: createdItemsSummary,
        businessId: bId,
        ownerId: userProfile.uid
      };

      onRequisitionCreated(printData);
      onClose();
    } catch (err: any) {
      console.error('Failed to create direct store requisition:', err);
      showToast('Error issuing store requisition: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-4 border border-neutral-200 flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">Direct Store Requisition</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Direct Material Issue (No BOM Required)
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Directly requisition raw materials from store inventory with immediate stock deduction
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* SR Header Details Panel */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* SR No */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center justify-between">
                  <span>SR No. *</span>
                  <button
                    type="button"
                    onClick={() => setSrNo(calculateNextSrNo())}
                    className="text-[10px] text-indigo-600 font-semibold hover:underline"
                  >
                    Auto SR #
                  </button>
                </label>
                <input
                  type="text"
                  required
                  value={srNo}
                  onChange={(e) => setSrNo(e.target.value)}
                  placeholder="e.g. SR-0001"
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* SR Date */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Requisition Date *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={srDate}
                  onChange={(e) => setSrDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Department *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Cutting">Cutting</option>
                  <option value="Printing">Printing</option>
                  <option value="Sewing">Sewing</option>
                  <option value="Finishing">Finishing</option>
                  <option value="Production">Production</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Packing">Packing</option>
                  <option value="Office">Office / Admin</option>
                  <option value="General Store">General Store</option>
                </select>
              </div>

              {/* Requestor Name */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Requested By *
                </label>
                <input
                  type="text"
                  required
                  value={requestorName}
                  onChange={(e) => setRequestorName(e.target.value)}
                  placeholder="Full Name / Store Requestor"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Purpose */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Purpose / Consumption Reason
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Floor issue, sample making"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Job No / Order */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Job / WO No. (Optional)
                </label>
                <input
                  type="text"
                  value={jobNo}
                  onChange={(e) => setJobNo(e.target.value)}
                  placeholder="e.g. WO-2026-001"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Style / Article */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Style / Article (Optional)
                </label>
                <input
                  type="text"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  placeholder="e.g. Woven Tag, Satin Ribbon"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Stock Shortage Alert if any */}
          {!stockValidation.isValid && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Insufficient Stock in Inventory</span>
                <p className="text-amber-800 mt-0.5">
                  The requested quantity exceeds current available stock:
                </p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside font-medium text-amber-950">
                  {stockValidation.shortages.map((sh, idx) => (
                    <li key={idx}>
                      {sh.item.name}: Available {sh.available.toFixed(2)} {sh.item.unit}, Requested {sh.requested.toFixed(2)} {sh.item.unit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Requisition Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-600" />
                Raw Materials to Issue ({rows.length})
              </h3>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </button>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-600 font-bold border-b border-neutral-200">
                    <th className="px-3 py-2.5 w-7/20">Select Item *</th>
                    <th className="px-3 py-2.5 w-3/20 text-center">In Store Stock</th>
                    <th className="px-3 py-2.5 w-3/20">Quantity *</th>
                    <th className="px-3 py-2.5 w-5/20">Item Specification / Remarks</th>
                    <th className="px-3 py-2.5 w-2/20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((row, idx) => {
                    const selectedItem = items.find(i => i.id === row.itemId);
                    const stock = selectedItem ? Number(selectedItem.currentStock) || 0 : 0;
                    const qtyNum = Number(row.quantity) || 0;
                    const isShort = selectedItem && stock < qtyNum;

                    return (
                      <tr key={idx} className="hover:bg-neutral-50/70 transition-colors">
                        {/* Select Item */}
                        <td className="px-3 py-2">
                          <select
                            required
                            value={row.itemId}
                            onChange={(e) => handleRowChange(idx, 'itemId', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-neutral-900"
                          >
                            <option value="">-- Choose Raw Material / Item --</option>
                            {items.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.sku || 'No SKU'}) • Stock: {Number(item.currentStock || 0).toFixed(1)} {item.unit}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* In Store Stock */}
                        <td className="px-3 py-2 text-center">
                          {selectedItem ? (
                            <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              isShort ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-800'
                            }`}>
                              {stock.toFixed(2)} {selectedItem.unit}
                            </span>
                          ) : (
                            <span className="text-neutral-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              required
                              step="any"
                              min="0.001"
                              value={row.quantity}
                              onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                              placeholder="Qty"
                              className={`w-full px-2.5 py-1.5 text-xs font-bold bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                                isShort ? 'border-rose-400 focus:ring-rose-500 text-rose-700' : 'border-neutral-300 focus:ring-indigo-500 text-neutral-900'
                              }`}
                            />
                            <span className="text-neutral-500 text-[11px] font-semibold shrink-0">
                              {selectedItem?.unit || 'Pcs'}
                            </span>
                          </div>
                        </td>

                        {/* Remarks / Spec */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                            placeholder="Specification or notes"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* General Remarks */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              General Remarks / Notes
            </label>
            <textarea
              rows={2}
              value={generalRemarks}
              onChange={(e) => setGeneralRemarks(e.target.value)}
              placeholder="Any additional instructions or comments for store records..."
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer Action Bar */}
          <div className="pt-3 border-t border-neutral-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isViewer || isSubmitting || !stockValidation.isValid}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Deducting Stock & Confirming...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Issue from Store</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
