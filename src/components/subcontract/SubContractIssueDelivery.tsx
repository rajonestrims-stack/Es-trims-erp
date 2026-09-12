import React, { useState, useMemo } from 'react';
import { printElement } from '../../utils/printHelper';
import { 
  Truck, 
  Search, 
  Plus, 
  Printer, 
  Trash2, 
  Download, 
  RefreshCw, 
  Building2, 
  Calendar, 
  Layers, 
  FileText,
  CheckCircle2,
  ArrowLeft,
  MapPin,
  Phone
} from 'lucide-react';
import { 
  SubContractCategory, 
  SubContractIssue, 
  SubContractItem, 
  SubContractOrder, 
  Supplier, 
  UserProfile 
} from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface SubContractIssueDeliveryProps {
  issues: SubContractIssue[];
  orders: SubContractOrder[];
  items: SubContractItem[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSaveIssue: (issue: Partial<SubContractIssue>) => Promise<void>;
  onDeleteIssue: (id: string) => Promise<void>;
  isEditor: boolean;
}

export const SubContractIssueDelivery: React.FC<SubContractIssueDeliveryProps> = ({
  issues,
  orders,
  items,
  suppliers,
  userProfile,
  showToast,
  onSaveIssue,
  onDeleteIssue,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIssueForPrint, setSelectedIssueForPrint] = useState<SubContractIssue | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [challanNo, setChallanNo] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [subContractOrderId, setSubContractOrderId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [remarks, setRemarks] = useState('');

  const [issueItems, setIssueItems] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    rollCount?: number;
    lotNo?: string;
    remarks?: string;
  }[]>([]);

  const filteredIssues = issues.filter(i => {
    const matchesSearch = 
      i.challanNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.subContractOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.vehicleNo || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSupplier = supplierFilter === 'all' || i.supplierId === supplierFilter;
    return matchesSearch && matchesSupplier;
  });

  const getAutoChallanNo = () => {
    const year = new Date().getFullYear();
    const count = issues.length + 1;
    return `SC-ISS-${year}-${String(count).padStart(4, '0')}`;
  };

  const handleOpenAdd = () => {
    setChallanNo(getAutoChallanNo());
    setIssueDate(new Date().toISOString().split('T')[0]);
    const firstSup = suppliers[0]?.id || '';
    setSupplierId(firstSup);
    setSubContractOrderId('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setRemarks('');

    const firstItem = items[0];
    if (firstItem) {
      setIssueItems([
        {
          itemId: firstItem.id,
          itemCode: firstItem.itemCode,
          itemName: firstItem.itemName,
          quantity: 100,
          unit: firstItem.unit,
          rollCount: 1,
          lotNo: 'LOT-01',
          remarks: ''
        }
      ]);
    } else {
      setIssueItems([]);
    }

    setIsModalOpen(true);
  };

  const handleSelectOrder = (orderId: string) => {
    setSubContractOrderId(orderId);
    const foundOrder = orders.find(o => o.id === orderId);
    if (foundOrder) {
      setSupplierId(foundOrder.supplierId);
      setIssueItems(
        foundOrder.items.map(it => ({
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          quantity: it.quantity,
          unit: it.unit,
          rollCount: 1,
          lotNo: '',
          remarks: it.remarks || ''
        }))
      );
    }
  };

  const handleLineItemChange = (idx: number, field: string, value: any) => {
    const updated = [...issueItems];
    const cur = { ...updated[idx], [field]: value };
    if (field === 'itemId') {
      const selItem = items.find(i => i.id === value);
      if (selItem) {
        cur.itemCode = selItem.itemCode;
        cur.itemName = selItem.itemName;
        cur.unit = selItem.unit;
      }
    }
    updated[idx] = cur;
    setIssueItems(updated);
  };

  const handleAddRow = () => {
    const firstItem = items[0];
    setIssueItems([
      ...issueItems,
      {
        itemId: firstItem?.id || '',
        itemCode: firstItem?.itemCode || '',
        itemName: firstItem?.itemName || '',
        quantity: 50,
        unit: firstItem?.unit || 'KG',
        rollCount: 1,
        lotNo: '',
        remarks: ''
      }
    ]);
  };

  const handleRemoveRow = (idx: number) => {
    if (issueItems.length <= 1) {
      showToast('At least one item required', 'error');
      return;
    }
    setIssueItems(issueItems.filter((_, i) => i !== idx));
  };

  const totalQuantity = issueItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  const hasAnyOverStock = useMemo(() => {
    return issueItems.some(item => {
      if (!item.itemId) return false;
      const invItem = items.find(i => i.id === item.itemId);
      const currentStock = invItem ? (Number(invItem.currentStock) || 0) : 0;
      return (Number(item.quantity) || 0) > (currentStock + 0.0001);
    });
  }, [issueItems, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanNo.trim()) {
      showToast('Challan Number is required', 'error');
      return;
    }
    if (!supplierId) {
      showToast('Supplier is required', 'error');
      return;
    }
    if (issueItems.length === 0 || !issueItems.some(i => i.itemId)) {
      showToast('Please add at least one item', 'error');
      return;
    }

    // Validate available stock for each issue item
    for (const item of issueItems) {
      if (!item.itemId) continue;
      const invItem = items.find(i => i.id === item.itemId);
      const currentStock = invItem ? (Number(invItem.currentStock) || 0) : 0;
      const qty = Number(item.quantity) || 0;
      if (qty > currentStock + 0.0001) {
        showToast(
          `Insufficient stock for "${item.itemName || invItem?.itemName || 'Item'}"! Current Stock: ${currentStock.toFixed(2)} ${item.unit || invItem?.unit || ''}, Requested: ${qty.toFixed(2)}`,
          'error'
        );
        return;
      }
    }

    const selSupplier = suppliers.find(s => s.id === supplierId);
    const selOrder = orders.find(o => o.id === subContractOrderId);

    try {
      setIsSaving(true);
      await onSaveIssue({
        challanNo: challanNo.trim().toUpperCase(),
        issueDate,
        subContractOrderId: subContractOrderId || undefined,
        subContractOrderNo: selOrder?.orderNo || undefined,
        supplierId,
        supplierName: selSupplier?.name || 'Unknown Supplier',
        items: issueItems,
        totalQuantity,
        vehicleNo: vehicleNo.trim() || undefined,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        issuedBy: userProfile.displayName || userProfile.email || 'Admin',
        remarks: remarks.trim() || undefined
      });
      setIsModalOpen(false);
      showToast('Issue Challan created successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save issue challan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, no: string) => {
    if (!window.confirm(`Are you sure you want to delete issue challan "${no}"?`)) return;
    try {
      setIsDeleting(id);
      await onDeleteIssue(id);
      showToast(`Challan "${no}" deleted`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete issue challan', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  if (selectedIssueForPrint) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIssueForPrint(null)}
            className="gap-1.5 text-xs font-semibold text-neutral-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Delivery Challans
          </Button>

          <Button
            size="sm"
            onClick={() => printElement('printable-subcontract-challan', { title: 'SubContract_Delivery_Challan' })}
            className="gap-1.5 text-xs font-bold bg-neutral-900 hover:bg-black text-white shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Delivery Challan
          </Button>
        </div>

        {/* Printable Delivery Challan Sheet */}
        <div 
          id="printable-subcontract-challan" 
          className="printable-doc bg-white p-8 md:p-12 rounded-2xl border border-neutral-200 shadow-lg print:shadow-none print:border-none print:p-0 print:m-0 print:w-full text-neutral-900 font-sans"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-neutral-200 p-1">
                  <img 
                    src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
                    className="w-full h-full object-contain" 
                    alt="ES TRIMS LIMITED"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-neutral-900">ES TRIMS LIMITED</h1>
                  <p className="text-xs text-neutral-500 font-medium">Subcontract Delivery Challan & Gate Pass</p>
                </div>
              </div>
              <p className="text-[11px] text-neutral-600 pt-2 leading-relaxed">
                C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400, Bangladesh
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block bg-amber-600 text-white font-black px-3 py-1 text-xs uppercase tracking-widest rounded">
                DELIVERY / ISSUE CHALLAN
              </div>
              <div className="pt-2 text-xs">
                <p className="font-bold text-neutral-900">Challan No: <span className="font-mono">{selectedIssueForPrint.challanNo}</span></p>
                <p className="text-neutral-500">Issue Date: <strong className="text-neutral-800">{selectedIssueForPrint.issueDate}</strong></p>
                {selectedIssueForPrint.subContractOrderNo && (
                  <p className="text-neutral-500">Order No: <span className="font-mono font-bold text-indigo-700">{selectedIssueForPrint.subContractOrderNo}</span></p>
                )}
              </div>
            </div>
          </div>

          {/* Supplier and Transport Info */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-bold uppercase text-[10px] text-neutral-500">Issued To Subcontractor</span>
              <p className="font-bold text-sm text-neutral-900">{selectedIssueForPrint.supplierName}</p>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-bold uppercase text-[10px] text-neutral-500">Transport & Dispatch Info</span>
              <p className="text-neutral-700 text-xs">
                Vehicle No: <strong>{selectedIssueForPrint.vehicleNo || 'N/A'}</strong><br />
                Driver Name: <strong>{selectedIssueForPrint.driverName || 'N/A'}</strong> {selectedIssueForPrint.driverPhone && `(${selectedIssueForPrint.driverPhone})`}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-neutral-300 rounded-lg overflow-hidden my-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 text-neutral-800 font-bold uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">SL</th>
                  <th className="py-2.5 px-3">Item Code</th>
                  <th className="py-2.5 px-4">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Lot / Roll No</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {selectedIssueForPrint.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-3 text-center text-neutral-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-neutral-800">{item.itemCode}</td>
                    <td className="py-3 px-4 font-bold text-neutral-900">{item.itemName}</td>
                    <td className="py-3 px-3 text-center font-mono text-neutral-600">{item.lotNo || item.rollCount ? `${item.rollCount || 1} Rolls` : '-'}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-neutral-900">{item.quantity.toLocaleString()}</td>
                    <td className="py-3 px-3 text-center uppercase font-bold text-neutral-600">{item.unit}</td>
                    <td className="py-3 px-4 text-neutral-500 text-[11px]">{item.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-50 font-bold border-t border-neutral-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-4 uppercase text-neutral-700">Total Dispatched Quantity:</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-800 text-sm">
                    {selectedIssueForPrint.totalQuantity.toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {selectedIssueForPrint.remarks && (
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs my-4">
              <span className="font-bold text-neutral-500 uppercase text-[10px]">Remarks:</span>
              <p className="text-neutral-700 mt-0.5">{selectedIssueForPrint.remarks}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-4 gap-4 pt-16 text-center text-xs">
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">{selectedIssueForPrint.issuedBy || 'Store In-Charge'}</p>
              <p className="text-[10px] text-neutral-400 uppercase">Prepared By</p>
            </div>
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">Security Gate</p>
              <p className="text-[10px] text-neutral-400 uppercase">Security Check / Pass</p>
            </div>
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">{selectedIssueForPrint.driverName || 'Driver / Carrier'}</p>
              <p className="text-[10px] text-neutral-400 uppercase">Carrier Signature</p>
            </div>
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">{selectedIssueForPrint.supplierName}</p>
              <p className="text-[10px] text-neutral-400 uppercase">Receiver Signature</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Sub Contract Issue / Delivery</h2>
              <p className="text-xs text-neutral-500">Dispatch raw fabrics, yarns, or cut panels to subcontractors with tracking challans & gate passes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditor && (
            <Button 
              size="sm" 
              onClick={handleOpenAdd}
              className="h-9 gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Delivery Challan
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total Delivery Challans</span>
            <FileText className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">{filteredIssues.length}</p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase">Total Dispatched Qty</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {filteredIssues.reduce((s, i) => s + (i.totalQuantity || 0), 0).toLocaleString()}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Active Subcontractors</span>
            <Building2 className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">
            {new Set(filteredIssues.map(i => i.supplierId)).size}
          </p>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-neutral-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search Challan No, Supplier, Order No, Vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-neutral-50 border-neutral-200"
          />
        </div>

        <div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Subcontractors</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Issues Table */}
      <Card className="overflow-hidden border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Challan No</th>
                <th className="py-3.5 px-4">Issue Date</th>
                <th className="py-3.5 px-4">Subcontractor</th>
                <th className="py-3.5 px-4">Order Link</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4 text-right">Total Dispatched Qty</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    No delivery challans found.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue, idx) => (
                  <tr key={issue.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-neutral-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                        {issue.challanNo}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 text-[11px]">
                      {issue.issueDate}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-neutral-400" />
                        <span>{issue.supplierName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                      {issue.subContractOrderNo || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 text-[11px]">
                      {issue.vehicleNo && <div>Vehicle: <strong>{issue.vehicleNo}</strong></div>}
                      {issue.driverName && <div className="text-neutral-500">Driver: {issue.driverName}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700 text-sm">
                      {issue.totalQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedIssueForPrint(issue)}
                          className="p-1.5 text-neutral-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Print Delivery Challan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {isEditor && (
                          <button
                            onClick={() => handleDelete(issue.id, issue.challanNo)}
                            disabled={isDeleting === issue.id}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Challan"
                          >
                            {isDeleting === issue.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Issue Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Sub Contract Delivery Challan / Issue"
        className="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Challan No <span className="text-rose-500">*</span></label>
                <Input
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value.toUpperCase())}
                  required
                  className="font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Issue Date <span className="text-rose-500">*</span></label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Link Subcontract Order</label>
                <select
                  value={subContractOrderId}
                  onChange={(e) => handleSelectOrder(e.target.value)}
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Direct Issue</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.orderNo} ({o.supplierName} - {o.orderType})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Subcontractor <span className="text-rose-500">*</span></label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="" disabled>Select Subcontractor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Vehicle / Transport No</label>
                <Input
                  placeholder="e.g. DM-TA-11-2049"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Driver Name & Phone</label>
                <Input
                  placeholder="e.g. Rafiq (01711-xxxxxx)"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-neutral-800 uppercase text-[11px]">Issued Items & Roll Details</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="h-7 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </Button>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-2 text-right w-24">Quantity</th>
                    <th className="py-2.5 px-2 text-center w-16">Unit</th>
                    <th className="py-2.5 px-2 w-28">Lot / Roll No</th>
                    <th className="py-2.5 px-3">Row Note</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {issueItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <select
                          value={item.itemId}
                          onChange={(e) => handleLineItemChange(idx, 'itemId', e.target.value)}
                          required
                          className="w-full h-8 px-2 border border-neutral-200 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="" disabled>Select Item</option>
                          {items.map(it => (
                            <option key={it.id} value={it.id}>
                              [{it.itemCode}] {it.itemName} ({it.unit})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                          className="h-8 text-right font-mono font-bold"
                          required
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Input
                          value={item.unit}
                          onChange={(e) => handleLineItemChange(idx, 'unit', e.target.value)}
                          className="h-8 text-center uppercase"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          value={item.lotNo || ''}
                          onChange={(e) => handleLineItemChange(idx, 'lotNo', e.target.value)}
                          placeholder="e.g. Lot #12 / 4 Rolls"
                          className="h-8 text-xs font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          value={item.remarks || ''}
                          onChange={(e) => handleLineItemChange(idx, 'remarks', e.target.value)}
                          placeholder="Special instructions"
                          className="h-8 text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-neutral-50 font-bold border-t border-neutral-200">
                  <tr>
                    <td className="py-2.5 px-3 uppercase text-neutral-600">Total Issue Qty:</td>
                    <td className="py-2.5 px-2 text-right font-mono text-amber-800 text-sm">
                      {totalQuantity.toLocaleString()}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Remarks / Gate Instructions</label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Delivery condition, packing state, or special notes..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || hasAnyOverStock}
              className={`h-9 font-bold text-xs ${
                hasAnyOverStock 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white opacity-60 cursor-not-allowed' 
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {isSaving ? 'Saving...' : hasAnyOverStock ? '⚠️ Insufficient Stock (Cannot Issue)' : 'Save & Issue Challan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
