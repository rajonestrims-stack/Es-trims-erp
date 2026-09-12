import React, { useState, useRef } from 'react';
import { printElement } from '../utils/printHelper';
import { 
  Building2, 
  Calendar, 
  CreditCard, 
  FileText, 
  Mail, 
  MapPin, 
  Phone, 
  Printer, 
  X, 
  CheckCircle2, 
  Hash, 
  User, 
  Clock, 
  Copy,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { numberToWords } from './PurchaseOrderPrintView';
import { Supplier, PurchaseOrder, SupplierPayment } from '../types';

export interface PaymentVoucherData {
  voucherNo: string;
  paymentDate: string | Date;
  amount: number;
  paymentMethod: string;
  reference?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string | Date;
  notes?: string;
  status?: string;

  // Supplier / Payee Info
  supplierId?: string;
  supplierName: string;
  supplierAddress?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierBalance?: number;

  // Allocations against POs / Bills
  allocations?: {
    poId?: string;
    poNumber: string;
    billDate?: string | Date;
    billAmount?: number;
    allocatedAmount: number;
    remainingDue?: number;
  }[];

  // User / Audit
  preparedByName?: string;
  approvedByName?: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  companyLogoUrl?: string;
}

interface SupplierPaymentVoucherPrintViewProps {
  voucherData: PaymentVoucherData;
  onClose: () => void;
}

function formatDateSafe(d?: string | Date): string {
  if (!d) return '—';
  try {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return String(d);
    return format(dateObj, 'dd MMM yyyy');
  } catch {
    return String(d);
  }
}

export const SupplierPaymentVoucherPrintView: React.FC<SupplierPaymentVoucherPrintViewProps> = ({
  voucherData,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [printCopyType, setPrintCopyType] = useState<'both' | 'office' | 'supplier'>('both');

  // Company logo resolution
  const [logoSrc, setLogoSrc] = useState<string>(() => {
    if (voucherData.companyLogoUrl) return voucherData.companyLogoUrl;
    try {
      const cfg = localStorage.getItem('theme_config');
      if (cfg) {
        const parsed = JSON.parse(cfg);
        if (parsed.logoUrl) return parsed.logoUrl;
      }
    } catch (e) {}
    return 'https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE';
  });
  const [logoFailed, setLogoFailed] = useState(false);

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current, {
        title: `Payment_Voucher_${voucherData.voucherNo || 'Doc'}`,
        pageOrientation: 'portrait'
      });
    }
  };

  const amount = Number(voucherData.amount) || 0;
  const inWords = numberToWords(amount, 'BDT');

  const totalAllocated = (voucherData.allocations || []).reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0);
  const unallocatedAdvance = Math.max(0, amount - totalAllocated);

  const isBank = ['bank transfer', 'beftn', 'cheque', 'rtgs'].includes((voucherData.paymentMethod || '').toLowerCase());
  const voucherTypeLabel = isBank ? 'Bank Payment Voucher (BPV)' : 'Cash Payment Voucher (CPV)';

  // Helper renderer for a single voucher slip
  const renderVoucherSlip = (copyLabel: string, showDottedBorder = false) => {
    return (
      <div className={`bg-white text-slate-900 ${showDottedBorder ? 'border-t-2 border-dashed border-slate-300 pt-6 mt-6' : ''}`}>
        {/* Header with Letterhead */}
        <div className="flex items-start justify-between pb-3 border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            {!logoFailed && logoSrc ? (
              <img
                src={logoSrc}
                alt="Company Logo"
                className="h-14 w-auto object-contain max-w-[130px]"
                crossOrigin="anonymous"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-xs">
                ES
              </div>
            )}
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase leading-none">
                {voucherData.businessName || 'ES TRIMS LIMITED'}
              </h1>
              <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                A Sister Concern of Energy Switchgear Group
              </p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                {voucherData.businessAddress || 'C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400'}
              </p>
              <p className="text-[9px] text-slate-500">
                Phone: +880 1711-000000 | Email: accounts@estrims.com | Web: www.estrims.com
              </p>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white rounded-xs">
              {copyLabel}
            </span>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold rounded-xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{voucherData.status === 'pending_approval' ? 'PENDING APPROVAL' : 'PAYMENT COMPLETED'}</span>
            </div>
          </div>
        </div>

        {/* Voucher Title Ribbon */}
        <div className="my-2.5 flex items-center justify-between bg-slate-100 px-3 py-1.5 border-y border-slate-300">
          <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-700" />
            <span>PAYMENT VOUCHER</span>
            <span className="text-[10px] font-bold text-slate-600 font-mono">({voucherTypeLabel})</span>
          </div>
          <div className="text-xs font-mono font-black text-slate-900">
            VOUCHER NO: <span className="text-indigo-800">{voucherData.voucherNo}</span>
          </div>
        </div>

        {/* Meta Grid: Beneficiary vs Voucher Details */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          {/* Payee / Supplier Information */}
          <div className="p-2.5 border border-slate-300 rounded-xs bg-slate-50/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-0.5 mb-1 flex items-center justify-between">
              <span>Paid To (Beneficiary / Supplier)</span>
              {voucherData.supplierId && <span className="font-mono text-[9px] text-slate-400">ID: {voucherData.supplierId.slice(-6).toUpperCase()}</span>}
            </div>
            <div className="font-black text-slate-900 text-sm">{voucherData.supplierName}</div>
            {voucherData.supplierContact && (
              <div className="text-[11px] text-slate-700 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Attn: <strong className="text-slate-800">{voucherData.supplierContact}</strong></span>
              </div>
            )}
            {voucherData.supplierPhone && (
              <div className="text-[11px] text-slate-700 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Phone: {voucherData.supplierPhone}</span>
              </div>
            )}
            {voucherData.supplierAddress && (
              <div className="text-[10px] text-slate-600 flex items-start gap-1 leading-tight">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                <span>{voucherData.supplierAddress}</span>
              </div>
            )}
          </div>

          {/* Payment & Transaction Particulars */}
          <div className="p-2.5 border border-slate-300 rounded-xs bg-slate-50/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-0.5 mb-1">
              Payment & Account Particulars
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Payment Date:</span>
                <strong className="text-slate-900 font-mono">{formatDateSafe(voucherData.paymentDate)}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Payment Mode:</span>
                <strong className="text-slate-900 uppercase font-bold">{voucherData.paymentMethod || 'Cash'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Cheque / Txn Ref #:</span>
                <strong className="text-slate-900 font-mono font-bold">{voucherData.reference || voucherData.chequeNo || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Debit Account:</span>
                <strong className="text-slate-800">Accounts Payable</strong>
              </div>
              {voucherData.bankName && (
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[10px]">Bank / Branch:</span>
                  <strong className="text-slate-800">{voucherData.bankName}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bill Settlement / Allocation Breakdown Table */}
        <div className="border border-slate-300 rounded-xs overflow-hidden mb-3">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 uppercase text-[10px]">
                <th className="p-1.5 w-8 text-center border-r border-slate-300">SL</th>
                <th className="p-1.5 border-r border-slate-300">Particulars / Bill Description</th>
                <th className="p-1.5 w-24 border-r border-slate-300">Bill Date</th>
                <th className="p-1.5 w-24 text-right border-r border-slate-300">Bill Amount (Tk)</th>
                <th className="p-1.5 w-28 text-right font-black">Settled Amount (Tk)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {voucherData.allocations && voucherData.allocations.length > 0 ? (
                <>
                  {voucherData.allocations.map((alloc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-1.5 text-center font-mono text-slate-500 border-r border-slate-200">{idx + 1}</td>
                      <td className="p-1.5 font-medium text-slate-900 border-r border-slate-200">
                        Payment settled against Purchase Order / Bill # <span className="font-mono font-bold text-indigo-900">{alloc.poNumber}</span>
                      </td>
                      <td className="p-1.5 text-slate-600 font-mono border-r border-slate-200">
                        {formatDateSafe(alloc.billDate)}
                      </td>
                      <td className="p-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {alloc.billAmount ? Number(alloc.billAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="p-1.5 text-right font-mono font-bold text-slate-900">
                        {Number(alloc.allocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {unallocatedAdvance > 0 && (
                    <tr className="bg-amber-50/40">
                      <td className="p-1.5 text-center font-mono text-slate-500 border-r border-slate-200">{voucherData.allocations.length + 1}</td>
                      <td className="p-1.5 font-medium text-amber-900 border-r border-slate-200" colSpan={3}>
                        Advance on Account / Remaining Unallocated Credit Balance
                      </td>
                      <td className="p-1.5 text-right font-mono font-bold text-amber-900">
                        {unallocatedAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200">1</td>
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-200" colSpan={3}>
                    Payment made on-account to supplier towards raw materials procurement settlement
                    {voucherData.reference ? ` (Ref: ${voucherData.reference})` : ''}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-slate-900">
                    {amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-950">
                <td colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-wider border-r border-slate-300">
                  Total Amount Paid:
                </td>
                <td className="p-2 text-right font-mono text-xs text-slate-950 bg-slate-200/70 border-b-2 border-slate-900">
                  Tk {amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Words Box */}
        <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xs mb-3 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-slate-700 uppercase text-[10px] shrink-0">Amount in Words (কথায়):</span>
            <span className="font-black text-slate-900 italic tracking-wide">
              {inWords}
            </span>
          </div>
        </div>

        {/* Narration / Remarks */}
        {voucherData.notes && (
          <div className="p-2 border border-slate-200 rounded-xs mb-3 text-[11px] bg-white">
            <span className="font-bold text-slate-600 text-[10px] uppercase mr-1.5">Narration / Remarks:</span>
            <span className="text-slate-800">{voucherData.notes}</span>
          </div>
        )}

        {/* Acknowledgement Statement */}
        <div className="text-[10px] text-slate-600 italic mb-6 px-1">
          Acknowledgement: Received with thanks from <strong>{voucherData.businessName || 'ES TRIMS LIMITED'}</strong> the sum of <strong>Tk {amount.toLocaleString()}</strong> ({voucherData.paymentMethod || 'Cash'}{voucherData.reference ? `, Ref: ${voucherData.reference}` : ''}) as full/partial settlement as detailed above.
        </div>

        {/* Corporate Signatures Block */}
        <div className="grid grid-cols-5 gap-2 pt-8 text-center text-[10px] border-t border-slate-200">
          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              {voucherData.preparedByName || 'Prepared By'}
            </div>
            <div className="text-[9px] text-slate-500">Initiator / Accounts</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Checked By
            </div>
            <div className="text-[9px] text-slate-500">Accounts Executive</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Manager (Accounts)
            </div>
            <div className="text-[9px] text-slate-500">Finance & Accounts</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Managing Director
            </div>
            <div className="text-[9px] text-slate-500">Authorized Signatory</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Payee's Signature & Date
            </div>
            <div className="text-[9px] text-slate-500">Receiver's Stamp</div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="mt-4 pt-2 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400">
          <span>System Generated Voucher | Generated on: {format(new Date(), 'dd/MM/yyyy hh:mm a')}</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:overflow-visible">
      {/* Top Modal Controls (Hidden in Print) */}
      <div className="w-full max-w-4xl bg-slate-900 text-white px-4 py-2.5 rounded-t-xl flex flex-wrap items-center justify-between gap-3 shadow-xl no-print border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-sm tracking-wide">Supplier Payment Voucher Print Preview</span>
          <span className="text-xs text-slate-400 font-mono">({voucherData.voucherNo})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Selector */}
          <div className="inline-flex bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPrintCopyType('both')}
              className={`px-2 py-1 rounded-md transition-colors ${printCopyType === 'both' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Dual Copy (Both)
            </button>
            <button
              type="button"
              onClick={() => setPrintCopyType('office')}
              className={`px-2 py-1 rounded-md transition-colors ${printCopyType === 'office' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Office Copy
            </button>
            <button
              type="button"
              onClick={() => setPrintCopyType('supplier')}
              className={`px-2 py-1 rounded-md transition-colors ${printCopyType === 'supplier' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Supplier Copy
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Voucher</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Voucher Paper Container */}
      <div 
        ref={printRef}
        id="supplier-payment-voucher-printable"
        className="w-full max-w-4xl bg-white p-6 sm:p-8 rounded-b-xl shadow-2xl border-x border-b border-slate-200 text-slate-900 print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full"
      >
        {printCopyType === 'both' ? (
          <div className="space-y-6">
            {renderVoucherSlip('OFFICE COPY')}
            {renderVoucherSlip('SUPPLIER / RECEIVER COPY', true)}
          </div>
        ) : printCopyType === 'office' ? (
          renderVoucherSlip('OFFICE COPY')
        ) : (
          renderVoucherSlip('SUPPLIER / RECEIVER COPY')
        )}
      </div>
    </div>
  );
};
