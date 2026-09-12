import React, { useState } from 'react';
import { printElement } from '../../utils/printHelper';
import { 
  CheckCircle2, 
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
  AlertCircle,
  TrendingDown,
  ArrowLeft,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { 
  SubContractCategory, 
  SubContractItem, 
  SubContractOrder, 
  SubContractPrice, 
  SubContractReceive, 
  Supplier, 
  UserProfile 
} from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface SubContractReceiveProps {
  receives: SubContractReceive[];
  orders: SubContractOrder[];
  items: SubContractItem[];
  prices: SubContractPrice[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSaveReceive: (receive: Partial<SubContractReceive>) => Promise<void>;
  onDeleteReceive: (id: string) => Promise<void>;
  isEditor: boolean;
}

export const SubContractReceiveComponent: React.FC<SubContractReceiveProps> = ({
  receives,
  orders,
  items,
  prices,
  suppliers,
  userProfile,
  showToast,
  onSaveReceive,
  onDeleteReceive,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceiveForPrint, setSelectedReceiveForPrint] = useState<SubContractReceive | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [receiveChallanNo, setReceiveChallanNo] = useState('');
  const [supplierChallanNo, setSupplierChallanNo] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [subContractOrderId, setSubContractOrderId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [processLossPercent, setProcessLossPercent] = useState<number | string>(0);
  const [qcStatus, setQcStatus] = useState<'approved' | 'rejected' | 'partially_approved'>('approved');
  const [remarks, setRemarks] = useState('');

  const [receiveItems, setReceiveItems] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    unit: string;
    rate: number;
    amount: number;
    defectRemarks?: string;
  }[]>([]);

  const filteredReceives = receives.filter(r => {
    const matchesSearch = 
      r.receiveChallanNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.supplierChallanNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.subContractOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSupplier = supplierFilter === 'all' || r.supplierId === supplierFilter;
    return matchesSearch && matchesSupplier;
  });

  const getAutoReceiveNo = () => {
    const year = new Date().getFullYear();
    const count = receives.length + 1;
    return `SC-RCV-${year}-${String(count).padStart(4, '0')}`;
  };

  const handleOpenAdd = () => {
    setReceiveChallanNo(getAutoReceiveNo());
    setSupplierChallanNo('');
    setReceiveDate(new Date().toISOString().split('T')[0]);
    const firstSup = suppliers[0]?.id || '';
    setSupplierId(firstSup);
    setSubContractOrderId('');
    setProcessLossPercent(0);
    setQcStatus('approved');
    setRemarks('');

    const firstItem = items[0];
    if (firstItem && firstSup) {
      const foundPrice = prices.find(p => p.supplierId === firstSup && p.itemId === firstItem.id && p.status === 'active');
      const rate = foundPrice ? foundPrice.contractPrice : 0;
      setReceiveItems([
        {
          itemId: firstItem.id,
          itemCode: firstItem.itemCode,
          itemName: firstItem.itemName,
          receivedQuantity: 100,
          acceptedQuantity: 100,
          rejectedQuantity: 0,
          unit: firstItem.unit,
          rate,
          amount: rate * 100,
          defectRemarks: ''
        }
      ]);
    } else {
      setReceiveItems([]);
    }

    setIsModalOpen(true);
  };

  const handleSelectOrder = (orderId: string) => {
    setSubContractOrderId(orderId);
    const foundOrder = orders.find(o => o.id === orderId);
    if (foundOrder) {
      setSupplierId(foundOrder.supplierId);
      setReceiveItems(
        foundOrder.items.map(it => ({
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          receivedQuantity: it.quantity,
          acceptedQuantity: it.quantity,
          rejectedQuantity: 0,
          unit: it.unit,
          rate: it.rate,
          amount: it.rate * it.quantity,
          defectRemarks: ''
        }))
      );
    }
  };

  const handleLineItemChange = (idx: number, field: string, value: any) => {
    const updated = [...receiveItems];
    const cur = { ...updated[idx], [field]: value };

    if (field === 'itemId') {
      const selItem = items.find(i => i.id === value);
      if (selItem) {
        cur.itemCode = selItem.itemCode;
        cur.itemName = selItem.itemName;
        cur.unit = selItem.unit;
        const foundPrice = prices.find(p => p.supplierId === supplierId && p.itemId === selItem.id && p.status === 'active');
        if (foundPrice) {
          cur.rate = foundPrice.contractPrice;
          cur.unit = foundPrice.unit || selItem.unit;
        }
      }
    }

    if (field === 'receivedQuantity' || field === 'rejectedQuantity') {
      const rcv = Number(cur.receivedQuantity) || 0;
      const rej = Number(cur.rejectedQuantity) || 0;
      cur.acceptedQuantity = Math.max(0, rcv - rej);
    }

    if (field === 'receivedQuantity' || field === 'acceptedQuantity' || field === 'rejectedQuantity' || field === 'rate' || field === 'itemId') {
      const acc = Number(cur.acceptedQuantity) || 0;
      const r = Number(cur.rate) || 0;
      cur.amount = acc * r;
    }

    updated[idx] = cur;
    setReceiveItems(updated);
  };

  const handleAddRow = () => {
    const firstItem = items[0];
    const foundPrice = firstItem && supplierId ? prices.find(p => p.supplierId === supplierId && p.itemId === firstItem.id && p.status === 'active') : null;
    const rate = foundPrice ? foundPrice.contractPrice : 0;
    setReceiveItems([
      ...receiveItems,
      {
        itemId: firstItem?.id || '',
        itemCode: firstItem?.itemCode || '',
        itemName: firstItem?.itemName || '',
        receivedQuantity: 50,
        acceptedQuantity: 50,
        rejectedQuantity: 0,
        unit: firstItem?.unit || 'KG',
        rate,
        amount: rate * 50,
        defectRemarks: ''
      }
    ]);
  };

  const handleRemoveRow = (idx: number) => {
    if (receiveItems.length <= 1) {
      showToast('At least one item is required', 'error');
      return;
    }
    setReceiveItems(receiveItems.filter((_, i) => i !== idx));
  };

  const totalReceivedQty = receiveItems.reduce((s, it) => s + (Number(it.receivedQuantity) || 0), 0);
  const totalAcceptedQty = receiveItems.reduce((s, it) => s + (Number(it.acceptedQuantity) || 0), 0);
  const totalRejectedQty = receiveItems.reduce((s, it) => s + (Number(it.rejectedQuantity) || 0), 0);
  const totalAmount = receiveItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const selectedOrder = orders.find(o => o.id === subContractOrderId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveChallanNo.trim()) {
      showToast('Receive Challan No is required', 'error');
      return;
    }
    if (!supplierId) {
      showToast('Supplier is required', 'error');
      return;
    }
    if (receiveItems.length === 0 || !receiveItems.some(i => i.itemId)) {
      showToast('Please add at least one received item', 'error');
      return;
    }

    const selSupplier = suppliers.find(s => s.id === supplierId);
    const selOrder = orders.find(o => o.id === subContractOrderId);

    try {
      setIsSaving(true);
      await onSaveReceive({
        receiveChallanNo: receiveChallanNo.trim().toUpperCase(),
        supplierChallanNo: supplierChallanNo.trim() || undefined,
        receiveDate,
        subContractOrderId: subContractOrderId || undefined,
        subContractOrderNo: selOrder?.orderNo || undefined,
        supplierId,
        supplierName: selSupplier?.name || 'Unknown Supplier',
        items: receiveItems,
        totalReceivedQuantity: totalReceivedQty,
        totalAcceptedQuantity: totalAcceptedQty,
        totalRejectedQuantity: totalRejectedQty,
        totalAmount,
        currency: selOrder?.currency || 'BDT',
        processLossPercent: Number(processLossPercent) || 0,
        qcStatus,
        receivedBy: userProfile.displayName || userProfile.email || 'Admin',
        remarks: remarks.trim() || undefined
      });
      setIsModalOpen(false);
      showToast('Receive Goods Challan registered successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save receive transaction', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, no: string) => {
    if (!window.confirm(`Are you sure you want to delete receive record "${no}"?`)) return;
    try {
      setIsDeleting(id);
      await onDeleteReceive(id);
      showToast(`Receive record "${no}" deleted`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete receive record', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  if (selectedReceiveForPrint) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedReceiveForPrint(null)}
            className="gap-1.5 text-xs font-semibold text-neutral-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Receive List
          </Button>

          <Button
            size="sm"
            onClick={() => printElement('printable-receive-grn', { title: 'SubContract_GRN' })}
            className="gap-1.5 text-xs font-bold bg-neutral-900 hover:bg-black text-white shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print GRN / QC Challan
          </Button>
        </div>

        {/* Printable Receive GRN Sheet */}
        <div 
          id="printable-receive-grn" 
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
                  <p className="text-xs text-neutral-500 font-medium">Subcontract Goods Receive & Quality Inspection Report (GRN)</p>
                </div>
              </div>
              <p className="text-[11px] text-neutral-600 pt-2 leading-relaxed">
                C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400, Bangladesh
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block bg-emerald-700 text-white font-black px-3 py-1 text-xs uppercase tracking-widest rounded">
                GOODS RECEIVE NOTE (GRN)
              </div>
              <div className="pt-2 text-xs">
                <p className="font-bold text-neutral-900">Receive GRN No: <span className="font-mono">{selectedReceiveForPrint.receiveChallanNo}</span></p>
                <p className="text-neutral-500">Date: <strong className="text-neutral-800">{selectedReceiveForPrint.receiveDate}</strong></p>
                {selectedReceiveForPrint.supplierChallanNo && (
                  <p className="text-neutral-500">Vendor Challan: <strong className="text-neutral-800 font-mono">{selectedReceiveForPrint.supplierChallanNo}</strong></p>
                )}
                {selectedReceiveForPrint.subContractOrderNo && (
                  <p className="text-neutral-500">Order Ref: <span className="font-mono font-bold text-indigo-700">{selectedReceiveForPrint.subContractOrderNo}</span></p>
                )}
              </div>
            </div>
          </div>

          {/* Supplier Info & QC Status */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-bold uppercase text-[10px] text-neutral-500">Subcontractor / Processor</span>
              <p className="font-bold text-sm text-neutral-900">{selectedReceiveForPrint.supplierName}</p>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-bold uppercase text-[10px] text-neutral-500">Quality Inspection Result</span>
              <div className="flex items-center gap-2 pt-1">
                <span className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full uppercase ${
                  selectedReceiveForPrint.qcStatus === 'approved' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : selectedReceiveForPrint.qcStatus === 'rejected'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {selectedReceiveForPrint.qcStatus}
                </span>
                {selectedReceiveForPrint.processLossPercent > 0 && (
                  <span className="text-[11px] text-neutral-500">
                    Process Loss: <strong>{selectedReceiveForPrint.processLossPercent}%</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Itemized Received Table */}
          <div className="border border-neutral-300 rounded-lg overflow-hidden my-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 text-neutral-800 font-bold uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">SL</th>
                  <th className="py-2.5 px-3">Item Code & Name</th>
                  <th className="py-2.5 px-3 text-right">Rcvd Qty</th>
                  <th className="py-2.5 px-3 text-right">Accepted</th>
                  <th className="py-2.5 px-3 text-right">Rejected</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-4 text-right">Bill Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {selectedReceiveForPrint.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-3 text-center text-neutral-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-neutral-900">
                      <span className="font-mono text-neutral-500 mr-1.5">{item.itemCode}</span>
                      {item.itemName}
                      {item.defectRemarks && (
                        <p className="text-[10px] text-rose-600 font-normal italic mt-0.5">QC Note: {item.defectRemarks}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-neutral-800">{item.receivedQuantity.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{item.acceptedQuantity.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">{item.rejectedQuantity ? item.rejectedQuantity.toLocaleString() : '0'}</td>
                    <td className="py-3 px-3 text-center uppercase font-bold text-neutral-600">{item.unit}</td>
                    <td className="py-3 px-3 text-right font-mono">{item.rate.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-50 font-bold border-t border-neutral-300">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 uppercase text-neutral-700">Total Verification:</td>
                  <td className="py-2.5 px-3 text-right font-mono text-neutral-800">{selectedReceiveForPrint.totalReceivedQuantity.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{selectedReceiveForPrint.totalAcceptedQuantity.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-600">{selectedReceiveForPrint.totalRejectedQuantity.toLocaleString()}</td>
                  <td colSpan={2} className="py-2.5 px-3 text-right uppercase text-neutral-700">Net Payable:</td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-800 text-sm">
                    {selectedReceiveForPrint.currency || 'BDT'} {selectedReceiveForPrint.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {selectedReceiveForPrint.remarks && (
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs my-4">
              <span className="font-bold text-neutral-500 uppercase text-[10px]">Remarks:</span>
              <p className="text-neutral-700 mt-0.5">{selectedReceiveForPrint.remarks}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-4 gap-4 pt-16 text-center text-xs">
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">{selectedReceiveForPrint.receivedBy || 'Store In-Charge'}</p>
              <p className="text-[10px] text-neutral-400 uppercase">Received By</p>
            </div>
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">QC Inspector</p>
              <p className="text-[10px] text-neutral-400 uppercase">Quality Verified By</p>
            </div>
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">Accounts Department</p>
              <p className="text-[10px] text-neutral-400 uppercase">Passed for Payment</p>
            </div>
            <div className="border-t border-neutral-400 pt-1.5">
              <p className="font-bold text-neutral-900">Factory Manager</p>
              <p className="text-[10px] text-neutral-400 uppercase">Authorized Signature</p>
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
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Sub Contract Receive & Quality Verification</h2>
              <p className="text-xs text-neutral-500">Log incoming goods (single or partial receipts), QC inspections, defect rejections, and auto-update order balances</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditor && (
            <Button 
              size="sm" 
              onClick={handleOpenAdd}
              className="h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Receive Subcontract Goods
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total Receive Challans</span>
            <FileText className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">{filteredReceives.length}</p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase">Accepted Good Qty</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {filteredReceives.reduce((s, r) => s + (r.totalAcceptedQuantity || 0), 0).toLocaleString()}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase">Rejected Defect Qty</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-700 mt-1">
            {filteredReceives.reduce((s, r) => s + (r.totalRejectedQuantity || 0), 0).toLocaleString()}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase">Total Bill Verified</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-700 mt-1">
            ৳{filteredReceives.reduce((s, r) => s + (r.totalAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-neutral-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search Receive Challan, Vendor Challan, Supplier, Order No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-neutral-50 border-neutral-200"
          />
        </div>

        <div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Subcontractors</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Receives Table */}
      <Card className="overflow-hidden border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Receive Challan</th>
                <th className="py-3.5 px-4">Receive Date</th>
                <th className="py-3.5 px-4">Subcontractor</th>
                <th className="py-3.5 px-4">Order Link</th>
                <th className="py-3.5 px-4 text-right">Rcvd Qty</th>
                <th className="py-3.5 px-4 text-right">Accepted Qty</th>
                <th className="py-3.5 px-4 text-right">Rejected Qty</th>
                <th className="py-3.5 px-4 text-center">QC Status</th>
                <th className="py-3.5 px-4 text-right">Payable Value</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
              {filteredReceives.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-neutral-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    No goods receive records found.
                  </td>
                </tr>
              ) : (
                filteredReceives.map((rec, idx) => (
                  <tr key={rec.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-neutral-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {rec.receiveChallanNo}
                      </span>
                      {rec.supplierChallanNo && (
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          Ven: {rec.supplierChallanNo}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 text-[11px]">
                      {rec.receiveDate}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-neutral-400" />
                        <span>{rec.supplierName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                      {rec.subContractOrderNo || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-800">
                      {rec.totalReceivedQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                      {rec.totalAcceptedQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                      {rec.totalRejectedQuantity > 0 ? rec.totalRejectedQuantity.toLocaleString() : '0'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        rec.qcStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : rec.qcStatus === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {rec.qcStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900">
                      {rec.currency || 'BDT'} {rec.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedReceiveForPrint(rec)}
                          className="p-1.5 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Print GRN Challan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {isEditor && (
                          <button
                            onClick={() => handleDelete(rec.id, rec.receiveChallanNo)}
                            disabled={isDeleting === rec.id}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Receive Record"
                          >
                            {isDeleting === rec.id ? (
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

      {/* Add Receive Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Receive Subcontract Goods (Partial / Full GRN)"
        className="max-w-4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Receive Challan No <span className="text-rose-500">*</span></label>
                <Input
                  value={receiveChallanNo}
                  onChange={(e) => setReceiveChallanNo(e.target.value.toUpperCase())}
                  required
                  className="font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Vendor Challan / Ref No</label>
                <Input
                  placeholder="e.g. VC-8821"
                  value={supplierChallanNo}
                  onChange={(e) => setSupplierChallanNo(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Receive Date <span className="text-rose-500">*</span></label>
                <Input
                  type="date"
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Link Subcontract Order <span className="text-rose-500">*</span></label>
                <select
                  value={subContractOrderId}
                  onChange={(e) => handleSelectOrder(e.target.value)}
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select Order</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.orderNo} ({o.supplierName} - {o.orderType} - Bal: {o.balanceQuantity !== undefined ? o.balanceQuantity : (o.totalQuantity - (o.receivedQuantity || 0))})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedOrder && (
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-900">Order: {selectedOrder.orderNo} ({selectedOrder.orderType.toUpperCase()})</span>
                  <p className="text-[11px] text-emerald-700">Subcontractor: {selectedOrder.supplierName}</p>
                </div>
                <div className="flex gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase">Total Ordered</span>
                    <p className="font-mono font-bold text-neutral-900">{selectedOrder.totalQuantity}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase">Already Received</span>
                    <p className="font-mono font-bold text-blue-700">{selectedOrder.receivedQuantity || 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase">Remaining Pending</span>
                    <p className="font-mono font-bold text-amber-700">
                      {selectedOrder.balanceQuantity !== undefined ? selectedOrder.balanceQuantity : Math.max(0, selectedOrder.totalQuantity - (selectedOrder.receivedQuantity || 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Subcontractor <span className="text-rose-500">*</span></label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="" disabled>Select Subcontractor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Quality / QC Status</label>
                <select
                  value={qcStatus}
                  onChange={(e) => setQcStatus(e.target.value as any)}
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                >
                  <option value="approved">Approved (Pass)</option>
                  <option value="partially_approved">Partially Approved</option>
                  <option value="rejected">Rejected (Rework Required)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Process Loss / Shrinkage (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={processLossPercent}
                  onChange={(e) => setProcessLossPercent(e.target.value)}
                  className="font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Received Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-neutral-800 uppercase text-[11px]">Received Items & Quality Verification</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              >
                <Plus className="w-3 h-3" />
                Add Row
              </Button>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3">Subcontract Item</th>
                    <th className="py-2.5 px-2 text-right w-24">Rcvd Qty</th>
                    <th className="py-2.5 px-2 text-right w-24">Rejected</th>
                    <th className="py-2.5 px-2 text-right w-24">Accepted</th>
                    <th className="py-2.5 px-2 text-center w-16">Unit</th>
                    <th className="py-2.5 px-2 text-right w-24">Rate</th>
                    <th className="py-2.5 px-3 text-right w-28">Payable</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {receiveItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <select
                          value={item.itemId}
                          onChange={(e) => handleLineItemChange(idx, 'itemId', e.target.value)}
                          required
                          className="w-full h-8 px-2 border border-neutral-200 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                          value={item.receivedQuantity}
                          onChange={(e) => handleLineItemChange(idx, 'receivedQuantity', e.target.value)}
                          className="h-8 text-right font-mono font-bold"
                          required
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={item.rejectedQuantity}
                          onChange={(e) => handleLineItemChange(idx, 'rejectedQuantity', e.target.value)}
                          className="h-8 text-right font-mono font-bold text-rose-600"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={item.acceptedQuantity}
                          onChange={(e) => handleLineItemChange(idx, 'acceptedQuantity', e.target.value)}
                          className="h-8 text-right font-mono font-bold text-emerald-700"
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
                          type="number"
                          step="0.0001"
                          min="0"
                          value={item.rate}
                          onChange={(e) => handleLineItemChange(idx, 'rate', e.target.value)}
                          className="h-8 text-right font-mono font-bold text-neutral-900"
                          required
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                        {(item.amount || 0).toFixed(2)}
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
                    <td className="py-2.5 px-3 uppercase text-neutral-600">Total Verification:</td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-800">{totalReceivedQty.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-rose-600">{totalRejectedQty.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-700">{totalAcceptedQty.toLocaleString()}</td>
                    <td colSpan={2} className="py-2.5 px-2 text-right uppercase text-neutral-600">Total Amount:</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm">
                      ৳{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">QC Inspection Notes / Remarks</label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Shade matching, hand feel, defect observations, or storage lot details..."
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
              disabled={isSaving}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              {isSaving ? 'Saving...' : 'Confirm Goods Receipt & Update Order'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
