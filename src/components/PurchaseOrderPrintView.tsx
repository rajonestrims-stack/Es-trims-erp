import React, { useState, useEffect } from 'react';
import { printElement } from '../utils/printHelper';
import { Building2, Calendar, FileText, Mail, MapPin, Phone, Printer, ShoppingCart, X, Globe } from 'lucide-react';
import { format } from 'date-fns';

export interface POPrintItem {
  sl?: number;
  itemCode?: string;
  itemName: string;
  specification?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface POPrintData {
  documentType?: 'purchase-order' | 'subcontract-order';
  title?: string;
  status?: string;
  poNumber: string;
  poDate: string | Date;
  deliveryDate?: string | Date;
  deliveryTo?: string;
  currency?: string;
  companyLogoUrl?: string;
  
  // Supplier Information
  supplierName: string;
  supplierAddress?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierTinBin?: string;
  
  // Subcontract / Reference metadata
  orderRef?: string;
  serviceCategory?: string;

  // Items
  items: POPrintItem[];

  // Totals
  subTotal?: number;
  vatPercent?: number;
  vatAmount?: number;
  aitPercent?: number;
  aitAmount?: number;
  discount?: number;
  additionalCharges?: number;
  grandTotal: number;

  // Terms & Instructions
  termsAndConditions?: string[] | string;
  notes?: string;

  // Signatures
  preparedByName?: string;
  preparedByDesignation?: string;
  preparedByDate?: string;

  checkedByName?: string;
  checkedByDesignation?: string;
  checkedByDate?: string;

  approvedByName?: string;
  approvedByDesignation?: string;
  approvedByDate?: string;

  acceptedByName?: string;
  acceptedByCompany?: string;
}

interface PurchaseOrderPrintViewProps {
  data: POPrintData;
  onClose?: () => void;
}

// Convert numbers to words (BDT / Currency)
export function numberToWords(num: number, currency: string = 'BDT'): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero Taka Only';

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return inWords(Math.floor(n / 100)) + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  const decimalPart = Math.round((Math.abs(num) - n) * 100);
  let result = inWords(n).trim();

  if (currency === 'BDT') {
    result = `${result} Taka`;
    if (decimalPart > 0) {
      result += ` and ${inWords(decimalPart).trim()} Paisa`;
    }
    result += ' Only';
  } else if (currency === 'USD') {
    result = `${result} US Dollars`;
    if (decimalPart > 0) {
      result += ` and ${inWords(decimalPart).trim()} Cents`;
    }
    result += ' Only';
  } else {
    result = `${currency} ${result} Only`;
  }

  return result;
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

export const PurchaseOrderPrintView: React.FC<PurchaseOrderPrintViewProps> = ({
  data,
  onClose
}) => {
  const isSubcontract = data.documentType === 'subcontract-order';
  const docTitle = data.title || (isSubcontract ? 'Sub Contract Order' : 'Purchase Order');
  const currency = data.currency || 'BDT';

  // Retrieve logo from theme_config, custom prop, or fallback
  const [logoSrc, setLogoSrc] = useState<string>(() => {
    if (data.companyLogoUrl) return data.companyLogoUrl;
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

  // Subtotal Calculation
  const subTotal = data.subTotal !== undefined 
    ? Number(data.subTotal) 
    : data.items.reduce((acc, it) => acc + (it.amount || (it.quantity * it.unitPrice)), 0);

  // VAT & AIT Calculation (Always visible and accurate)
  const vatPercent = data.vatPercent !== undefined ? Number(data.vatPercent) : 0;
  const vatAmount = data.vatAmount !== undefined 
    ? Number(data.vatAmount) 
    : ((subTotal * vatPercent) / 100);

  const aitPercent = data.aitPercent !== undefined ? Number(data.aitPercent) : 0;
  const aitAmount = data.aitAmount !== undefined 
    ? Number(data.aitAmount) 
    : ((subTotal * aitPercent) / 100);

  const discount = data.discount ? Number(data.discount) : 0;
  const additionalCharges = data.additionalCharges ? Number(data.additionalCharges) : 0;

  const grandTotal = data.grandTotal !== undefined 
    ? Number(data.grandTotal) 
    : (subTotal + vatAmount + aitAmount - discount + additionalCharges);

  // Parse terms and conditions
  const defaultTerms = isSubcontract ? [
    'Delivery must strictly match the agreed quality standards, fabric specifications, and stitch count.',
    'Quality and quantity must be strictly maintained as per approved master sample.',
    `All subcontract delivery challans must clearly mention this Order Number (${data.poNumber}).`,
    'Rejected, shaded, or under-quality materials will be replaced / reworked at vendor cost.',
    'Payment will be released as per company policy after inspection, QC verification & bill submission.',
    'Delivery at the designated factory address within the scheduled deadline date.'
  ] : [
    'All materials must be supplied as per approved specification.',
    'Quality and quantity must be strictly maintained.',
    `Mention Purchase Order number (${data.poNumber}) on invoice and delivery challan.`,
    'Rejected / under quality materials will be replaced by supplier.',
    'Payment will be made as per company policy after inspection & bill submission.',
    'Delivery at above mentioned address within scheduled date.'
  ];

  let terms: string[] = [];
  if (Array.isArray(data.termsAndConditions) && data.termsAndConditions.length > 0) {
    terms = data.termsAndConditions;
  } else if (typeof data.termsAndConditions === 'string' && data.termsAndConditions.trim().length > 0) {
    terms = data.termsAndConditions.split('\n').map(t => t.trim()).filter(Boolean);
  } else if (data.notes && data.notes.trim().length > 0) {
    terms = data.notes.split('\n').map(t => t.trim()).filter(Boolean);
  } else {
    terms = defaultTerms;
  }

  const handlePrint = () => {
    printElement('printable-purchase-order', { title: `PO-${data.poNumber || 'Document'}` });
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex items-center justify-between bg-neutral-900 text-white p-3.5 rounded-2xl shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider">{docTitle} — A4 Print Preview</h3>
            <p className="text-[11px] text-neutral-400 font-mono">PO #: {data.poNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF (A4)
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* A4 Centered Sheet Preview Container */}
      <div className="w-full flex justify-center overflow-x-auto pb-8 print:p-0 print:m-0 print:overflow-visible">
        <div 
          id="printable-purchase-order" 
          className="printable-doc w-[210mm] max-w-full bg-white rounded-sm border border-neutral-300 shadow-2xl print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0 print:w-full overflow-hidden font-sans text-neutral-900 box-border p-6 sm:p-8 md:p-10 space-y-4 print:space-y-2.5"
        >
          
          {/* ===================== HEADER SECTION ===================== */}
          <div className="avoid-break flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b-2 border-[#003b68]">
            {/* Left: Company Logo and Details */}
            <div className="flex items-center gap-3">
              {/* Logo Rendering */}
              {!logoFailed && logoSrc ? (
                <div className="h-14 w-16 flex items-center justify-center shrink-0">
                  <img
                    src={logoSrc}
                    alt="Company Logo"
                    className="max-h-14 max-w-16 w-auto h-auto object-contain"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      if (logoSrc !== '/logo.svg') {
                        setLogoSrc('/logo.svg');
                      } else {
                        setLogoFailed(true);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="relative flex items-center justify-center w-14 h-12 shrink-0">
                  <svg viewBox="0 0 100 80" className="w-full h-full drop-shadow-xs">
                    <path
                      d="M 5 15 Q 40 10 50 40 Q 60 70 95 65"
                      fill="none"
                      stroke="#00a2e8"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 15 65 Q 45 65 55 40 Q 65 15 85 15"
                      fill="none"
                      stroke="#004b87"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                    <text x="18" y="55" fill="#ffffff" fontWeight="900" fontSize="32" fontFamily="sans-serif">ES</text>
                  </svg>
                </div>
              )}
              
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#003b68] leading-none">
                  ES TRIMS LIMITED
                </h1>
                <p className="text-[11px] font-bold text-orange-600 tracking-wider uppercase mt-0.5">
                  Garments Accessories Manufacturer
                </p>
                <div className="text-[10px] text-neutral-600 leading-tight mt-1 space-y-0.5">
                  <p>C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400</p>
                  <p className="font-medium">Tel: +880-2-47671196 &nbsp;|&nbsp; info@estrims.com &nbsp;|&nbsp; www.estrims.com</p>
                </div>
              </div>
            </div>

            {/* Right: Modern PO Title Badge */}
            <div className="shrink-0 self-stretch sm:self-auto flex items-center justify-end">
              <div 
                className="bg-gradient-to-r from-[#004278] to-[#00284d] text-white px-6 py-2.5 rounded-lg sm:rounded-l-2xl sm:rounded-r-md shadow-sm flex items-center gap-3 border-r-4 border-cyan-400"
              >
                <div className="w-8 h-8 rounded-full bg-white text-[#003b68] flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-wide text-white leading-tight uppercase">
                    {docTitle}
                  </h2>
                  <p className="text-[10px] text-cyan-200 font-mono">
                    #{data.poNumber}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== SUPPLIER & PO INFO BOXES ===================== */}
          <div className="avoid-break grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            
            {/* Left Card: Supplier Information */}
            <div className="rounded-lg border border-blue-200 overflow-hidden bg-white">
              <div className="bg-[#e9f3fc] px-3 py-1 border-b border-blue-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#004b87]" />
                <h3 className="text-[11px] font-black text-[#003b68] uppercase tracking-wide">
                  Supplier Information
                </h3>
              </div>
              <div className="p-2.5 text-[10.5px] space-y-1 text-neutral-800">
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Supplier Name</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 font-black text-neutral-900">{data.supplierName || ''}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Address</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 text-neutral-800 leading-snug">
                    {data.supplierAddress || ''}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Contact Person</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 font-bold text-neutral-900">{data.supplierContact || ''}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Phone / Mobile</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 font-mono font-bold text-neutral-900">{data.supplierPhone || ''}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Email</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 text-neutral-800">{data.supplierEmail || ''}</span>
                </div>
              </div>
            </div>

            {/* Right Card: PO Details */}
            <div className="rounded-lg border border-blue-200 overflow-hidden bg-white">
              <div className="bg-[#e9f3fc] px-3 py-1 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#004b87]" />
                  <h3 className="text-[11px] font-black text-[#003b68] uppercase tracking-wide">
                    Order Details
                  </h3>
                </div>
                <div className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                  {data.status || 'CONFIRMED'}
                </div>
              </div>

              <div className="p-2.5 text-[10.5px] space-y-1 text-neutral-800">
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">PO Number</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 font-mono font-black text-[#003b68]">
                    {data.poNumber}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">PO Date</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 font-bold text-neutral-900">
                    {formatDateSafe(data.poDate)}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Delivery Date</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 font-bold text-neutral-900">
                    {formatDateSafe(data.deliveryDate || data.poDate)}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Delivery To</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 text-neutral-800 leading-snug">
                    {data.deliveryTo || 'ES Trims Limited, C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400'}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1 items-baseline">
                  <span className="col-span-4 font-semibold text-neutral-600">Currency</span>
                  <span className="col-span-1 text-center font-bold">:</span>
                  <span className="col-span-7 font-bold text-neutral-900">
                    {currency} ({currency === 'BDT' ? 'Bangladeshi Taka' : currency})
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* ===================== ITEMS TABLE ===================== */}
          <div className="rounded-lg border border-neutral-300 overflow-hidden">
            <table className="w-full text-left text-[10.5px] border-collapse">
              <thead>
                <tr className="bg-[#0b3c68] text-white font-bold uppercase tracking-wider text-[9.5px]">
                  <th className="py-2 px-2 text-center border-r border-blue-900 w-8">SL</th>
                  <th className="py-2 px-2.5 border-r border-blue-900 w-24">Item Code</th>
                  <th className="py-2 px-3 border-r border-blue-900">Item Description</th>
                  <th className="py-2 px-3 border-r border-blue-900">Specification / Details</th>
                  <th className="py-2 px-2 text-center border-r border-blue-900 w-14">Unit</th>
                  <th className="py-2 px-2.5 text-right border-r border-blue-900 w-20">Quantity</th>
                  <th className="py-2 px-2.5 text-right border-r border-blue-900 w-20">Rate ({currency})</th>
                  <th className="py-2 px-3 text-right w-24">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {data.items.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className={idx % 2 === 1 ? 'bg-neutral-50/70' : 'bg-white'}
                  >
                    <td className="py-2 px-2 text-center font-bold text-neutral-600 border-r border-neutral-200">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2.5 font-mono font-bold text-[#004b87] border-r border-neutral-200">
                      {item.itemCode || `ITM-${idx + 101}`}
                    </td>
                    <td className="py-2 px-3 font-bold text-neutral-900 border-r border-neutral-200">
                      {item.itemName}
                    </td>
                    <td className="py-2 px-3 text-neutral-700 text-[10px] border-r border-neutral-200 leading-snug">
                      {item.specification || 'Standard Factory Grade'}
                    </td>
                    <td className="py-2 px-2 text-center uppercase font-bold text-neutral-700 border-r border-neutral-200">
                      {item.unit || 'PCS'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold text-neutral-900 border-r border-neutral-200">
                      {Number(item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-medium text-neutral-800 border-r border-neutral-200">
                      {Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-neutral-950">
                      {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ===================== TERMS & CONDITIONS & TOTALS ===================== */}
          <div className="avoid-break grid grid-cols-1 sm:grid-cols-12 gap-3 items-start pt-1">
            
            {/* Left: Terms & Conditions Box (col-span-7) */}
            <div className="sm:col-span-7 rounded-lg border border-blue-200 bg-[#f8fbff] p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#003b68] font-black text-[11px] uppercase tracking-wide border-b border-blue-200 pb-1">
                <FileText className="w-3.5 h-3.5 text-[#004b87]" />
                <span>Terms & Conditions</span>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-neutral-700 leading-relaxed pl-0.5 font-medium">
                {terms.map((t, index) => (
                  <li key={index} className="pl-0.5">
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              {/* Amount in words pill */}
              <div className="pt-1.5 border-t border-blue-200 text-[10px]">
                <span className="font-bold text-[#003b68]">In Words: </span>
                <span className="font-bold italic text-neutral-800">
                  {numberToWords(grandTotal, currency)}
                </span>
              </div>
            </div>

            {/* Right: Summary / Totals Breakdown (col-span-5) */}
            <div className="sm:col-span-5 rounded-lg border border-neutral-300 overflow-hidden bg-white">
              <div className="divide-y divide-neutral-200 text-[11px]">
                <div className="flex justify-between items-center py-1.5 px-3 bg-neutral-50 font-bold text-neutral-800">
                  <span>Sub Total</span>
                  <span className="font-mono text-neutral-900 font-bold">
                    {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                {/* VAT Row (Always present and calculated) */}
                <div className="flex justify-between items-center py-1 px-3 text-neutral-700">
                  <span>VAT ({vatPercent}%)</span>
                  <span className="font-mono font-medium">
                    {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* AIT Row (Always present and calculated) */}
                <div className="flex justify-between items-center py-1 px-3 text-neutral-700">
                  <span>AIT ({aitPercent}%)</span>
                  <span className="font-mono font-medium">
                    {aitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between items-center py-1 px-3 text-rose-700 font-medium">
                    <span>Discount</span>
                    <span className="font-mono">
                      -{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {additionalCharges > 0 && (
                  <div className="flex justify-between items-center py-1 px-3 text-neutral-700 font-medium">
                    <span>Other Charges</span>
                    <span className="font-mono">
                      +{additionalCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Grand Total Navy Banner */}
                <div className="flex justify-between items-center py-2 px-3 bg-[#0b3c68] text-white font-black text-xs">
                  <span className="uppercase tracking-wider">Grand Total ({currency})</span>
                  <span className="font-mono text-sm font-black">
                    {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* ===================== SIGNATURES BLOCK ===================== */}
          {/* Rule: Prepared By shows creator name. Checked By & Approved By are BLANK for physical signature only */}
          <div className="avoid-break rounded-lg border border-blue-200 overflow-hidden bg-white mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-blue-200 text-center">
              
              {/* 1. Prepared By (Name of the user who created it) */}
              <div className="p-2.5 bg-[#f8fbff] flex flex-col justify-between min-h-[95px]">
                <div className="bg-[#e9f3fc] text-[#003b68] text-[9.5px] font-black uppercase py-0.5 rounded tracking-wider">
                  Prepared By
                </div>
                <div className="py-1">
                  <p className="font-black text-xs text-neutral-900">{data.preparedByName || 'Admin'}</p>
                  <p className="text-[10px] text-neutral-600">{data.preparedByDesignation || 'Purchase / Procurement'}</p>
                  <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Date: {data.preparedByDate || formatDateSafe(data.poDate)}</p>
                </div>
                <div className="border-t border-neutral-400 w-4/5 mx-auto pt-0.5 text-[8.5px] text-neutral-500">
                  (Creator Signature)
                </div>
              </div>

              {/* 2. Checked By (BLANK for physical verification) */}
              <div className="p-2.5 bg-[#f8fbff] flex flex-col justify-between min-h-[95px]">
                <div className="bg-[#e9f3fc] text-[#003b68] text-[9.5px] font-black uppercase py-0.5 rounded tracking-wider">
                  Checked By
                </div>
                <div className="py-4">
                  <div className="h-6" /> {/* Blank space for physical signature */}
                </div>
                <div className="border-t border-neutral-400 w-4/5 mx-auto pt-0.5 text-[8.5px] text-neutral-500">
                  (Signature & Date)
                </div>
              </div>

              {/* 3. Approved By (BLANK for authorized manager) */}
              <div className="p-2.5 bg-[#f8fbff] flex flex-col justify-between min-h-[95px]">
                <div className="bg-[#e9f3fc] text-[#003b68] text-[9.5px] font-black uppercase py-0.5 rounded tracking-wider">
                  Approved By
                </div>
                <div className="py-4">
                  <div className="h-6" /> {/* Blank space for physical signature */}
                </div>
                <div className="border-t border-neutral-400 w-4/5 mx-auto pt-0.5 text-[8.5px] text-neutral-500">
                  (Authorized Signature)
                </div>
              </div>

              {/* 4. Accepted By Supplier (BLANK for supplier sign/seal) */}
              <div className="p-2.5 bg-[#f8fbff] flex flex-col justify-between min-h-[95px]">
                <div className="bg-[#e9f3fc] text-[#003b68] text-[9.5px] font-black uppercase py-0.5 rounded tracking-wider">
                  Accepted By (Supplier)
                </div>
                <div className="py-4">
                  <div className="h-6" /> {/* Blank space for physical seal & signature */}
                </div>
                <div className="border-t border-neutral-400 w-4/5 mx-auto pt-0.5 text-[8.5px] text-neutral-500">
                  (Authorized Seal & Sign)
                </div>
              </div>

            </div>
          </div>

          {/* ===================== FOOTER BANNER ===================== */}
          <div className="avoid-break relative bg-gradient-to-r from-[#003b68] via-[#004f8c] to-[#002d50] text-white py-1.5 px-4 rounded-md flex items-center justify-between overflow-hidden">
            <p className="text-[9.5px] text-cyan-200 font-mono">
              System Generated Document — ES Trims ERP
            </p>
            <p className="text-[10px] font-semibold italic text-center text-cyan-100 tracking-wide">
              Quality & Trust in Every Trim
            </p>
            {/* Decorative cyan diagonal bars */}
            <div className="flex items-center gap-1">
              <div className="w-1 h-3.5 bg-[#00a2e8] skew-x-[-25deg]" />
              <div className="w-1 h-3.5 bg-[#00a2e8] skew-x-[-25deg]" />
              <div className="w-1 h-3.5 bg-white skew-x-[-25deg]" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
