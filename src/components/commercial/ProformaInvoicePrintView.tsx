import React, { useState } from 'react';
import { ProformaInvoice } from '../../types';
import { printElement } from '../../utils/printHelper';
import { 
  Printer, X, Building2, CheckCircle2, ShieldCheck, 
  FileText, Layers, Truck, FileCheck, Landmark, Edit3, Save, ChevronDown,
  Plus, Trash2, ArrowUp, ArrowDown, RotateCcw, Sparkles, SlidersHorizontal
} from 'lucide-react';

export interface PITermItem {
  id: string;
  label: string;
  text: string;
}

export const DEFAULT_PI_TERMS: PITermItem[] = [
  {
    id: 'term-1',
    label: '01. Payment :',
    text: '100% Irrevocable Letter Of Credit Ninety (90) Days at sight without recourse for the full Amount which must be paid in US Dollar . The L/C must bearthe clause interest shall be paid at LIBOR on the value of the bill for the usance period.'
  },
  {
    id: 'term-2',
    label: '02. Delivery :',
    text: '30/45 Days from the receiver of L/C & Partial delivery allowed.'
  },
  {
    id: 'term-3',
    label: '03. Shipment :',
    text: 'Within 30 Days after receipt of L/C.'
  },
  {
    id: 'term-4',
    label: '04. Negotiation :',
    text: '15 Days after receipt of L/C.'
  },
  {
    id: 'term-5',
    label: '05. Others :',
    text: 'Delivery Chalan of the seller which received goods confirmation on it by the Buyer will be treated as Shipping /Transport Document which to be mentioned in the L/c.'
  },
  {
    id: 'term-6',
    label: '06. Bank Charges :',
    text: 'All banking charge are on account of buyer(s).'
  },
  {
    id: 'term-7',
    label: '07. H.S Code :',
    text: '6217.10.00'
  },
  {
    id: 'term-8',
    label: '08. Offer validity :',
    text: '15 days from the date of issuance this Proforma Invoice.'
  }
];

export const PRESET_PI_CLAUSES = [
  {
    name: 'Tolerance (+/- 5%)',
    label: 'Tolerance :',
    text: '+/- 5% in quantity and amount is acceptable.'
  },
  {
    name: 'Transshipment & Partial',
    label: 'Transshipment :',
    text: 'Transshipment not allowed. Partial shipment is allowed.'
  },
  {
    name: 'Country of Origin',
    label: 'Origin :',
    text: 'Country of Origin: Bangladesh.'
  },
  {
    name: 'Port of Loading',
    label: 'Port of Loading :',
    text: 'Dhaka / Chattogram, Bangladesh.'
  },
  {
    name: 'Inspection Clause',
    label: 'Inspection :',
    text: 'Final inspection will be carried out at seller factory before shipment.'
  },
  {
    name: 'Discrepancy Fee',
    label: 'Discrepancy :',
    text: 'All discrepancy charges (USD 50-100 or equivalent) will be on account of applicant/buyer.'
  }
];

export function parsePITerms(rawTerms?: any): PITermItem[] {
  if (!rawTerms || !Array.isArray(rawTerms) || rawTerms.length === 0) {
    return DEFAULT_PI_TERMS.map(t => ({ ...t }));
  }
  return rawTerms.map((t, idx) => {
    if (typeof t === 'string') {
      const match = t.match(/^(\d+\.?\s*[^:]+:?)\s*(.*)$/);
      if (match) {
        return {
          id: `term-${idx + 1}-${idx}`,
          label: match[1].trim(),
          text: match[2].trim()
        };
      }
      return {
        id: `term-${idx + 1}-${idx}`,
        label: `${String(idx + 1).padStart(2, '0')}.`,
        text: t
      };
    }
    if (typeof t === 'object' && t !== null) {
      return {
        id: t.id || `term-${idx + 1}`,
        label: t.label !== undefined ? t.label : `${String(idx + 1).padStart(2, '0')}.`,
        text: t.text || t.content || ''
      };
    }
    return {
      id: `term-${idx + 1}`,
      label: `${String(idx + 1).padStart(2, '0')}.`,
      text: String(t)
    };
  });
}

interface ProformaInvoicePrintViewProps {
  pi: ProformaInvoice;
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    web?: string;
    factoryAddress?: string;
    binNumber?: string;
    tinNumber?: string;
    ercNumber?: string;
    ircNumber?: string;
    authorizedSignatoryName?: string;
    authorizedSignatoryDesignation?: string;
  };
  onClose: () => void;
  onUpdatePiDetails?: (updated: Partial<ProformaInvoice>) => void;
}

export function numberToWordsUSD(num: number): string {
  if (!num || isNaN(num)) return 'ZERO ONLY';
  const a = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' AND ' + inWords(n % 100) : '');
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + ' MILLION' + (n % 1000000 ? ' ' + inWords(n % 1000000) : '');
    return inWords(Math.floor(n / 1000000000)) + ' BILLION' + (n % 1000000000 ? ' ' + inWords(n % 1000000000) : '');
  }

  const dollars = Math.floor(Math.abs(num));
  const cents = Math.round((Math.abs(num) - dollars) * 100);

  let res = 'SAY US DOLLER ' + inWords(dollars);
  if (cents > 0) {
    res += ' AND ' + inWords(cents) + ' CENTS';
  }
  return res + ' ONLY.';
}

export const ProformaInvoicePrintView: React.FC<ProformaInvoicePrintViewProps> = ({
  pi,
  companyInfo,
  onClose,
  onUpdatePiDetails
}) => {
  // Document Tabs: 'all' | '1-pi' | '2-boe' | '3-challan' | '4-invoice' | '5-packing' | '6-truck' | '7-coo' | '8-bank'
  const [activeDocTab, setActiveDocTab] = useState<string>('all');
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [drawerSubTab, setDrawerSubTab] = useState<'params' | 'terms'>('params');

  // Dynamic Terms & Conditions state
  const [termsList, setTermsList] = useState<PITermItem[]>(() => parsePITerms(pi.termsAndConditions));

  // Editable Document & Negotiation parameters
  const [docParams, setDocParams] = useState({
    piNumber: pi.piNumber || 'FAL/2026/08 A ES',
    piDate: pi.piDate || '11-August-2026',
    lcNumber: pi.lcNumber || '2167260400592',
    lcDate: pi.lcDate || '12-August-2026',
    exportLcNo: pi.exportLcNo || 'FAL-AW26-01',
    exportLcDate: pi.exportLcDate || '22-June-2026',
    commercialInvoiceNo: pi.commercialInvoiceNo || pi.billNo || '282',
    commercialInvoiceDate: pi.commercialInvoiceDate || '16-August-2026',
    deliveryChallanNo: pi.deliveryChallanNo || '282',
    deliveryChallanDate: pi.deliveryChallanDate || '16-August-2026',
    truckNo: pi.truckNo || 'Dhaka Metro MA-11-5740',
    tenorDays: pi.tenorDays || '90 days',
    hsCode: pi.hsCode || '6217.10.00',
    commodity: pi.commodity || 'GARMENTS ACCESSORIES',
    portOfLoading: pi.portOfLoading || 'Suppliers Factory.',
    finalDestination: pi.finalDestination || 'Buyer Factory.',
    carrier: pi.carrier || 'By Truck',
    sailingDate: pi.sailingDate || '16-August-2026',
    netWeightKg: pi.netWeightKg || (pi.items?.reduce((s, i) => s + (i.netWeightKg || (i.quantity * 0.0965)), 0) || 12070.66),
    grossWeightKg: pi.grossWeightKg || (pi.items?.reduce((s, i) => s + (i.grossWeightKg || (i.quantity * 0.0985)), 0) || 12312.07),
    
    // Advising Bank
    advisingBankName: pi.bankName || 'SHAHJALAL ISLAMI BANK PLC.',
    advisingBankBranch: pi.bankBranch || 'NARAYANGONJ BRANCH, TANBAZAR, NARAYANGONJ, BANGLADESH.',
    advisingBankSwift: pi.bankSwiftCode || 'SJBLBDDHNGJ',
    advisingBankAccount: pi.bankAccountNumber || '4011-11100009111',
    advisingBankTin: pi.bankTinNo || '725628937411',
    advisingBankVat: pi.bankVatNo || '002041137-0204',

    // Issuing Bank
    issuingBankName: pi.issuingBankName || 'THE PREMIER BANK PLC',
    issuingBankBranch: pi.issuingBankBranch || 'CENTRAL TRADE OPERATION',
    issuingBankCity: pi.issuingBankCity || 'DHAKA BD',
    issuingBankBin: '000000548-0002',

    // Buyer Info
    buyerName: pi.customerName || 'M/S FAKIR APPARELS LTD.',
    buyerAddress: pi.customerAddress || 'PLOT A 127-131,135-138,142-145 AND B 501-503 BSCIC HOSIERY I/A,SHASHONGAON, FATULLAH, NARAYANGONJ, BANGLADESH.',
    buyerIrc: pi.buyerIrc || '260326120010019',
    buyerErc: pi.buyerErc || '260326210044019',
    buyerBin: pi.buyerBin || '000154448-0204',
    buyerTin: pi.buyerTin || '848559133820',
    buyerBankBin: pi.buyerBankBin || '000000548-0002'
  });

  const handlePrint = () => {
    printElement('printable-pi-document', { title: `${activeDocTab.toUpperCase()}_${docParams.piNumber}` });
  };

  const handleAddTerm = () => {
    const nextIdx = termsList.length + 1;
    setTermsList(prev => [
      ...prev,
      {
        id: `term-${Date.now()}`,
        label: `${String(nextIdx).padStart(2, '0')}. Clause :`,
        text: ''
      }
    ]);
  };

  const handleUpdateTerm = (idx: number, field: 'label' | 'text', val: string) => {
    setTermsList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveTerm = (idx: number) => {
    setTermsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMoveTerm = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= termsList.length) return;
    setTermsList(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleResetTerms = () => {
    setTermsList(DEFAULT_PI_TERMS.map(t => ({ ...t })));
  };

  const handleAddPreset = (preset: { name: string; label: string; text: string }) => {
    const nextIdx = termsList.length + 1;
    setTermsList(prev => [
      ...prev,
      {
        id: `term-${Date.now()}`,
        label: `${String(nextIdx).padStart(2, '0')}. ${preset.label}`,
        text: preset.text
      }
    ]);
  };

  const handleSaveDocParams = () => {
    if (onUpdatePiDetails) {
      onUpdatePiDetails({
        lcNumber: docParams.lcNumber,
        lcDate: docParams.lcDate,
        exportLcNo: docParams.exportLcNo,
        exportLcDate: docParams.exportLcDate,
        commercialInvoiceNo: docParams.commercialInvoiceNo,
        commercialInvoiceDate: docParams.commercialInvoiceDate,
        deliveryChallanNo: docParams.deliveryChallanNo,
        deliveryChallanDate: docParams.deliveryChallanDate,
        truckNo: docParams.truckNo,
        tenorDays: docParams.tenorDays,
        hsCode: docParams.hsCode,
        commodity: docParams.commodity,
        portOfLoading: docParams.portOfLoading,
        finalDestination: docParams.finalDestination,
        carrier: docParams.carrier,
        sailingDate: docParams.sailingDate,
        netWeightKg: Number(docParams.netWeightKg) || 0,
        grossWeightKg: Number(docParams.grossWeightKg) || 0,
        bankName: docParams.advisingBankName,
        bankBranch: docParams.advisingBankBranch,
        bankSwiftCode: docParams.advisingBankSwift,
        bankAccountNumber: docParams.advisingBankAccount,
        bankTinNo: docParams.advisingBankTin,
        bankVatNo: docParams.advisingBankVat,
        issuingBankName: docParams.issuingBankName,
        issuingBankBranch: docParams.issuingBankBranch,
        issuingBankCity: docParams.issuingBankCity,
        buyerIrc: docParams.buyerIrc,
        buyerErc: docParams.buyerErc,
        buyerBin: docParams.buyerBin,
        buyerTin: docParams.buyerTin,
        buyerBankBin: docParams.buyerBankBin,
        termsAndConditions: termsList
      });
    }
    setShowEditDrawer(false);
  };

  // Calculations
  const formattedAmountWords = numberToWordsUSD(pi.piTotalValue);
  const totalQty = pi.items?.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || 0;
  const totalAmountUSD = pi.piTotalValue || 0;

  // Selected bills breakdown list
  const billsBreakdown = pi.selectedBills && pi.selectedBills.length > 0 
    ? pi.selectedBills 
    : (pi.billNo ? [{ billId: pi.billId || 'b-1', billNo: pi.billNo, billDate: pi.billDate || pi.piDate, amountUSD: pi.piTotalValue }] : [
      { billId: '1', billNo: '2144', billDate: '9-Aug-26', amountUSD: 23600.68 },
      { billId: '2', billNo: '2115', billDate: '9-Aug-26', amountUSD: 10510.00 }
    ]);

  // Selected work orders breakdown list
  const woBreakdown = pi.selectedWorkOrders && pi.selectedWorkOrders.length > 0
    ? pi.selectedWorkOrders
    : (pi.woNumber ? [{ woId: pi.woId || 'w-1', woNumber: pi.woNumber, date: pi.piDate, amountUSD: pi.piTotalValue }] : []);

  // eS Trims Official Header
  const effectiveCompanyName = 'ES Trims Limited';
  const effectiveAddress = 'C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah,\nNarayanganj 1400, Bangladesh.';
  const effectiveTel = '+88-02997746196';
  const effectiveEmail = 'info@estrims.com';

  // Render eS Trims Brand Emblem
  const renderLogo = () => (
    <div className="flex items-center gap-3">
      <img
        src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE"
        alt="ES Trims Limited"
        className="h-10 w-10 object-contain shrink-0"
        referrerPolicy="no-referrer"
        onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
      />
      <div>
        <h2 className="text-sm font-black tracking-wider text-neutral-900 leading-tight uppercase font-sans">
          ES Trims Limited
        </h2>
        <p className="text-[9px] text-neutral-600 font-mono tracking-widest leading-none mt-0.5">
          E S &nbsp; T R I M S &nbsp; L I M I T E D
        </p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-1 sm:p-3 overflow-y-auto font-sans">
      <div className="bg-neutral-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[98vh] flex flex-col overflow-hidden border border-neutral-700 animate-in fade-in zoom-in duration-200">
        
        {/* Top Action Bar */}
        <div className="bg-neutral-950 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
              DOC
            </div>
            <div>
              <h3 className="font-bold text-sm leading-none flex items-center gap-2">
                Export Negotiation Document Set
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  PI #{docParams.piNumber}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                8-Page Commercial Negotiation Pack (PI, BOE 1 & 2, Delivery Challan, Commercial Invoice, Packing List, Truck Challan, COO, Bank Letter)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditDrawer(!showEditDrawer)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>{showEditDrawer ? 'Hide Parameters' : 'Edit Export Details'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print {activeDocTab === 'all' ? 'All (8 Pages)' : 'Selected Doc'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Switcher Tabs */}
        <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 overflow-x-auto flex items-center gap-1.5 no-print shrink-0 scrollbar-thin">
          {[
            { id: 'all', label: '📄 All 8 Documents (Complete Set)' },
            { id: '1-pi', label: '1. Proforma Invoice (PI)' },
            { id: '2-boe', label: '2. Bill of Exchange (1 & 2)' },
            { id: '3-challan', label: '3. Delivery Challan' },
            { id: '4-invoice', label: '4. Commercial Invoice' },
            { id: '5-packing', label: '5. Packing List' },
            { id: '6-truck', label: '6. Truck Challan' },
            { id: '7-coo', label: '7. Certificate of Origin' },
            { id: '8-bank', label: '8. Bank Forwarding Letter' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveDocTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                activeDocTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer: Quick Edit Parameters */}
        {showEditDrawer && (
          <div className="bg-neutral-850 p-4 border-b border-neutral-700 no-print text-xs text-neutral-200 max-h-80 overflow-y-auto space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-700 pb-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  PI & Commercial Negotiation Editor
                </span>

                {/* Sub-tab switcher */}
                <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-700">
                  <button
                    type="button"
                    onClick={() => setDrawerSubTab('params')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                      drawerSubTab === 'params' 
                        ? 'bg-emerald-600 text-white' 
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Export & Bank Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerSubTab('terms')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                      drawerSubTab === 'terms' 
                        ? 'bg-emerald-600 text-white' 
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>Terms & Conditions</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-[10px] font-mono">
                      {termsList.length}
                    </span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveDocParams}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Apply & Save All
              </button>
            </div>
            
            {drawerSubTab === 'params' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-[10px] text-neutral-400 block">PI Number</label>
                  <input
                    type="text"
                    value={docParams.piNumber}
                    onChange={e => setDocParams({ ...docParams, piNumber: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">PI Date</label>
                  <input
                    type="text"
                    value={docParams.piDate}
                    onChange={e => setDocParams({ ...docParams, piDate: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">L/C Number</label>
                  <input
                    type="text"
                    value={docParams.lcNumber}
                    onChange={e => setDocParams({ ...docParams, lcNumber: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">L/C Date</label>
                  <input
                    type="text"
                    value={docParams.lcDate}
                    onChange={e => setDocParams({ ...docParams, lcDate: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">Export L/C No</label>
                  <input
                    type="text"
                    value={docParams.exportLcNo}
                    onChange={e => setDocParams({ ...docParams, exportLcNo: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">Commercial Invoice No</label>
                  <input
                    type="text"
                    value={docParams.commercialInvoiceNo}
                    onChange={e => setDocParams({ ...docParams, commercialInvoiceNo: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">Delivery Challan No</label>
                  <input
                    type="text"
                    value={docParams.deliveryChallanNo}
                    onChange={e => setDocParams({ ...docParams, deliveryChallanNo: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">Truck Number</label>
                  <input
                    type="text"
                    value={docParams.truckNo}
                    onChange={e => setDocParams({ ...docParams, truckNo: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">Net Weight (KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={docParams.netWeightKg}
                    onChange={e => setDocParams({ ...docParams, netWeightKg: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">Gross Weight (KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={docParams.grossWeightKg}
                    onChange={e => setDocParams({ ...docParams, grossWeightKg: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">Tenor Days</label>
                  <input
                    type="text"
                    value={docParams.tenorDays}
                    onChange={e => setDocParams({ ...docParams, tenorDays: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block">H.S. Code</label>
                  <input
                    type="text"
                    value={docParams.hsCode}
                    onChange={e => setDocParams({ ...docParams, hsCode: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-white text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Actions and Preset bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-750">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 mr-1">
                      <Sparkles className="w-3.5 h-3.5" /> Quick Presets:
                    </span>
                    {PRESET_PI_CLAUSES.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleAddPreset(preset)}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 rounded text-[10px] font-medium transition-colors"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleResetTerms}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold rounded flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3 text-neutral-400" /> Reset Default
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTerm}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Clause
                    </button>
                  </div>
                </div>

                {/* Terms rows list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {termsList.map((term, idx) => (
                    <div
                      key={term.id || idx}
                      className="flex items-center gap-2 p-2 bg-neutral-900/90 rounded-lg border border-neutral-750 hover:border-neutral-600 transition-colors"
                    >
                      <span className="w-5 h-5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>

                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveTerm(idx, -1)}
                          className="text-neutral-500 hover:text-emerald-400 disabled:opacity-20"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === termsList.length - 1}
                          onClick={() => handleMoveTerm(idx, 1)}
                          className="text-neutral-500 hover:text-emerald-400 disabled:opacity-20"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <div className="w-36 sm:w-44 shrink-0">
                        <input
                          type="text"
                          value={term.label}
                          onChange={e => handleUpdateTerm(idx, 'label', e.target.value)}
                          placeholder="01. Payment :"
                          className="w-full bg-neutral-950 border border-neutral-700 px-2 py-1 rounded text-white text-[11px] font-bold"
                        />
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={term.text}
                          onChange={e => handleUpdateTerm(idx, 'text', e.target.value)}
                          placeholder="Clause details..."
                          className="w-full bg-neutral-950 border border-neutral-700 px-2 py-1 rounded text-neutral-200 text-[11px]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveTerm(idx)}
                        className="p-1 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                        title="Delete Clause"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Document Body (Printable Container) */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-neutral-200 flex-1 flex justify-center">
          <div 
            id="printable-pi-document"
            className="printable-doc max-w-[850px] w-full space-y-12"
          >
            
            {/* ============================================================ */}
            {/* DOCUMENT 1: PROFORMA INVOICE (PI) */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '1-pi') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-10 rounded shadow-md border border-neutral-300 font-sans text-[11px] leading-snug print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px]">
                
                {/* Header Title */}
                <div className="text-center font-bold text-base uppercase tracking-wider mb-2 underline underline-offset-4">
                  PROFORMA INVOICE
                </div>

                {/* Exporter & PI Number Grid */}
                <div className="border border-neutral-950 grid grid-cols-12 mb-3">
                  <div className="col-span-7 p-2 border-r border-neutral-950">
                    <span className="font-bold block">Exporter :</span>
                    <span className="font-bold text-xs">{effectiveCompanyName}</span>
                    <p className="text-[10px] leading-tight text-neutral-800 whitespace-pre-line mt-0.5">
                      {effectiveAddress}
                    </p>
                    <p className="text-[10px] mt-0.5">
                      <span className="font-semibold">TEL :</span> {effectiveTel}
                    </p>
                    <p className="text-[10px]">
                      <span className="font-semibold">E-mail :</span> {effectiveEmail}
                    </p>
                  </div>
                  
                  <div className="col-span-5 p-2 bg-yellow-100/70 border-b-0">
                    <div className="space-y-1">
                      <div className="flex">
                        <span className="font-bold w-36">Proforma Invoice No.</span>
                        <span className="font-bold">: &nbsp;{docParams.piNumber}</span>
                      </div>
                      <div className="flex">
                        <span className="font-bold w-36">Proforma Invoice Date</span>
                        <span className="font-bold">: &nbsp;{docParams.piDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Consignee & Advising Bank Grid */}
                <div className="border border-neutral-950 grid grid-cols-12 mb-3 bg-yellow-50/30">
                  <div className="col-span-7 p-2 border-r border-neutral-950 bg-yellow-100/40">
                    <span className="font-bold block text-[10.5px]">Consignee & Notify:</span>
                    <p className="font-bold text-xs text-neutral-900 mt-0.5">{docParams.buyerName}</p>
                    <p className="text-[10px] leading-tight text-neutral-800 mt-0.5">
                      {docParams.buyerAddress}
                    </p>
                  </div>

                  <div className="col-span-5 p-2 bg-yellow-100/40 text-[10px] space-y-0.5">
                    <span className="font-bold block text-[10.5px]">L/C Advising Bank :</span>
                    <p className="font-bold text-neutral-900">{docParams.advisingBankName}</p>
                    <p className="leading-tight text-neutral-800">{docParams.advisingBankBranch}</p>
                    <p><span className="font-semibold">SWIFT CODE :</span> {docParams.advisingBankSwift}</p>
                    <p><span className="font-semibold">A/C No :</span> {docParams.advisingBankAccount}</p>
                    <p><span className="font-semibold">TIN No :</span> {docParams.advisingBankTin}</p>
                    <p><span className="font-semibold">VAT No :</span> {docParams.advisingBankVat}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-2">
                  <table className="w-full border-collapse border border-neutral-950 text-[10.5px]">
                    <thead>
                      <tr className="bg-yellow-100/60 font-bold text-center border-b border-neutral-950">
                        <th className="border border-neutral-950 py-1.5 px-1 w-10">Serial No.</th>
                        <th className="border border-neutral-950 py-1.5 px-2 text-center">Description of Goods</th>
                        <th className="border border-neutral-950 py-1.5 px-2 w-28 text-center">Net Weight in KGS.</th>
                        <th className="border border-neutral-950 py-1.5 px-2 w-24 text-center">Quantity</th>
                        <th className="border border-neutral-950 py-1.5 px-2 w-28 text-center">Unit Price in US DOLLAR</th>
                        <th className="border border-neutral-950 py-1.5 px-2 w-32 text-center">Total Amount in US DOLLAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pi.items.map((item, idx) => {
                        const netWt = item.netWeightKg || (idx === 0 ? docParams.netWeightKg : 0);
                        const isDzn = (item.unit || '').toUpperCase().includes('DZ') || (item.unit || '').toUpperCase().includes('DZN');
                        const qtyStr = isDzn ? `${item.quantity} Dzn` : `${item.quantity.toLocaleString()} ${item.unit || 'Pcs'}`;
                        const unitRateStr = `$ ${item.rate.toFixed(7)} /${item.unit || 'Dz'}`;

                        return (
                          <tr key={item.id || idx} className="border-b border-neutral-950">
                            <td className="border border-neutral-950 py-1 px-1 text-center font-mono font-bold">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="border border-neutral-950 py-1 px-2 font-bold bg-yellow-100/40">
                              {item.itemName}
                              {item.description && item.description !== item.itemName && (
                                <span className="block text-[9.5px] font-normal text-neutral-700">{item.description}</span>
                              )}
                            </td>
                            <td className="border border-neutral-950 py-1 px-2 text-center font-mono font-bold">
                              {netWt ? netWt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="border border-neutral-950 py-1 px-2 text-center font-bold">
                              {qtyStr}
                            </td>
                            <td className="border border-neutral-950 py-1 px-2 text-right font-mono font-bold">
                              {unitRateStr}
                            </td>
                            <td className="border border-neutral-950 py-1 px-2 text-right font-mono font-bold">
                              $ &nbsp;{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total Row */}
                      <tr className="border-t-2 border-neutral-950 font-bold bg-yellow-50">
                        <td colSpan={2} className="border border-neutral-950 py-1.5 px-2 text-right uppercase">
                          TOTAL :
                        </td>
                        <td className="border border-neutral-950 py-1.5 px-2 text-center font-mono">
                          {docParams.netWeightKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-neutral-950 py-1.5 px-2 text-center">
                          {totalQty.toLocaleString()} {pi.items?.[0]?.unit || 'Dzn'}
                        </td>
                        <td className="border border-neutral-950 py-1.5 px-2 text-center uppercase">
                          TOTAL :
                        </td>
                        <td className="border border-neutral-950 py-1.5 px-2 text-right font-mono text-xs">
                          $ &nbsp;{totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Sub Total Pieces note if Dzn */}
                <div className="text-right text-[10px] font-bold text-neutral-800 pr-28 mb-1">
                  {(totalQty * 12).toLocaleString()} Pcs
                </div>

                {/* Amount in words banner */}
                <div className="bg-yellow-300 border border-neutral-950 p-1.5 font-black text-center text-[10.5px] uppercase tracking-wide mb-3">
                  THE SUM OF : {formattedAmountWords}
                </div>

                {/* Multi-Bill / Multi-WO Breakdown Table (Above Terms) */}
                <div className="mb-4">
                  <div className="max-w-md">
                    <table className="w-full border-collapse border border-neutral-950 text-[10px]">
                      <thead>
                        <tr className="bg-yellow-100/70 text-center font-bold">
                          <th className="border border-neutral-950 py-1 px-2">
                            {pi.piSource === 'bill_based' ? 'Bill No' : 'Work Order No'}
                          </th>
                          <th className="border border-neutral-950 py-1 px-2">Date</th>
                          <th className="border border-neutral-950 py-1 px-2 text-right">Amount In USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pi.piSource === 'bill_based' ? (
                          billsBreakdown.map((b, idx) => (
                            <tr key={idx} className="text-center font-medium">
                              <td className="border border-neutral-950 py-0.5 px-2 font-mono">{b.billNo}</td>
                              <td className="border border-neutral-950 py-0.5 px-2">{b.billDate}</td>
                              <td className="border border-neutral-950 py-0.5 px-2 text-right font-mono">
                                $ &nbsp;{b.amountUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          woBreakdown.map((w, idx) => (
                            <tr key={idx} className="text-center font-medium">
                              <td className="border border-neutral-950 py-0.5 px-2 font-mono">{w.woNumber}</td>
                              <td className="border border-neutral-950 py-0.5 px-2">{w.date || docParams.piDate}</td>
                              <td className="border border-neutral-950 py-0.5 px-2 text-right font-mono">
                                $ &nbsp;{w.amountUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                        <tr className="bg-neutral-100 font-bold">
                          <td colSpan={2} className="border border-neutral-950 py-1 px-2 text-center uppercase">
                            TOTAL
                          </td>
                          <td className="border border-neutral-950 py-1 px-2 text-right font-mono text-[10.5px]">
                            $ &nbsp;{totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Terms and Conditions (Placed at the bottom of the invoice) */}
                <div className="text-[10px] space-y-1 mb-5 border-t border-neutral-300 pt-3">
                  <div className="flex items-center justify-between pb-1">
                    <p className="font-bold underline uppercase tracking-wider text-neutral-950 text-[10.5px]">
                      TERMS & CONDITIONS:
                    </p>
                    <div className="no-print flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditDrawer(true);
                          setDrawerSubTab('terms');
                        }}
                        className="text-[9.5px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        title="Edit terms in drawer"
                      >
                        <Edit3 className="w-2.5 h-2.5" /> Customize Terms ({termsList.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTerm}
                        className="text-[9.5px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        title="Add new clause"
                      >
                        <Plus className="w-2.5 h-2.5" /> + Add Clause
                      </button>
                    </div>
                  </div>

                  {/* Interactive Quick Add Presets Bar (Screen only) */}
                  <div className="no-print bg-slate-50 border border-slate-200 rounded-lg p-1.5 my-1.5 flex flex-wrap items-center gap-1.5 text-[9.5px]">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" /> Presets:
                    </span>
                    {PRESET_PI_CLAUSES.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleAddPreset(preset)}
                        className="px-1.5 py-0.5 bg-white hover:bg-indigo-50 text-neutral-700 hover:text-indigo-700 border border-neutral-200 hover:border-indigo-300 rounded font-medium transition-all cursor-pointer shadow-2xs"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    {termsList.map((term, idx) => (
                      <div key={term.id || idx} className="group relative flex items-start justify-between gap-2 text-neutral-900 leading-snug">
                        <p className="flex-1">
                          <span className="font-bold">{term.label}</span>{' '}
                          {term.label.toLowerCase().includes('h.s') && !term.text ? docParams.hsCode : term.text}
                        </p>
                        <div className="no-print opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveTerm(idx, -1)}
                            className="p-0.5 text-neutral-400 hover:text-neutral-800 disabled:opacity-20"
                            title="Move Up"
                          >
                            <ArrowUp className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === termsList.length - 1}
                            onClick={() => handleMoveTerm(idx, 1)}
                            className="p-0.5 text-neutral-400 hover:text-neutral-800 disabled:opacity-20"
                            title="Move Down"
                          >
                            <ArrowDown className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTerm(idx)}
                            className="p-0.5 text-rose-500 hover:text-rose-700"
                            title="Delete clause"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Section: Signatures */}
                <div className="grid grid-cols-12 gap-4 items-end pt-4 border-t border-neutral-200">
                  {/* Buyer sign */}
                  <div className="col-span-5 text-left">
                    <p className="text-[10px] italic font-semibold mb-12">Acepted by the Buyer</p>
                    <div className="border-t border-neutral-900 pt-1 text-[10px] font-bold">
                      Authorised signature
                    </div>
                  </div>

                  <div className="col-span-2"></div>

                  {/* Exporter sign */}
                  <div className="col-span-5 text-right">
                    <p className="text-[10px] italic font-semibold mb-4">For eS Trims Limited.</p>
                    <div className="inline-block text-center">
                      <div className="font-serif italic text-base font-bold text-neutral-800 mb-1">
                        S. Paul
                      </div>
                      <div className="border-t border-neutral-900 pt-1 text-[10px] font-bold text-center">
                        Authorised signature
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* DOCUMENT 2: BILL OF EXCHANGE (FIRST & SECOND OF EXCHANGE) */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '2-boe') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-10 rounded shadow-md border border-neutral-300 font-sans text-[10.5px] leading-snug print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px] space-y-6">
                
                {/* ---------------- 1ST OF EXCHANGE ---------------- */}
                <div className="border-2 border-neutral-900 p-5 rounded-xs relative">
                  <div className="absolute right-6 top-3 text-7xl font-black text-blue-600/30 select-none pointer-events-none">
                    1
                  </div>

                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    {renderLogo()}
                    <h3 className="text-sm font-black italic tracking-wide text-neutral-900 uppercase">
                      Bill Of Exchange
                    </h3>
                  </div>
                  <p className="text-[9.5px] text-neutral-700 mb-2 leading-tight">
                    {effectiveAddress}
                  </p>

                  <div className="flex justify-between items-center text-[10px] border-b border-neutral-400 pb-1 mb-2">
                    <div>
                      <span className="font-bold">Invoice No. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                      <span className="font-mono font-bold">{docParams.commercialInvoiceNo}</span>
                    </div>
                    <div>
                      <span className="font-bold">Date : &nbsp;</span>
                      <span className="font-bold">{docParams.commercialInvoiceDate}</span>
                    </div>
                  </div>

                  <p className="font-bold text-[10.5px] mb-2">
                    <span className="font-black text-xs">{docParams.tenorDays}</span> sight of this <span className="underline">FIRST</span> of Exchange ( Second of the same tenor and date being unpaid )
                  </p>

                  {/* Pay to the order of & Exchange Box */}
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <div className="space-y-0.5 flex-1">
                      <span className="font-bold block">Pay to the order of :</span>
                      <p className="font-bold text-neutral-900">{docParams.advisingBankName}</p>
                      <p className="text-[9.5px] text-neutral-800">{docParams.advisingBankBranch}</p>
                    </div>

                    <div className="border-2 border-neutral-900 p-2 bg-neutral-50 text-center min-w-[200px] shrink-0">
                      <span className="font-bold text-[11px] block">
                        Exchange for : &nbsp; <span className="font-mono font-black text-xs">${totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                  </div>

                  {/* Say Sum of Bar */}
                  <div className="border-y-2 border-neutral-950 py-1 px-2 font-bold text-[9.5px] uppercase tracking-tight mb-2">
                    THE SUM OF : {formattedAmountWords}
                  </div>

                  {/* Shipment details & To Issuing Bank */}
                  <div className="text-[9.5px] space-y-0.5">
                    <p className="italic">value received and charged for the Shipment Acessories Drawn under -</p>
                    <div className="grid grid-cols-2">
                      <p><span className="font-bold">L/C No.</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {docParams.lcNumber}</p>
                      <p><span className="font-bold">DATE:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {docParams.lcDate}</p>
                    </div>
                    <div className="grid grid-cols-2">
                      <p><span className="font-bold">EXPORT L/C NO:</span> &nbsp;&nbsp;&nbsp; {docParams.exportLcNo}</p>
                      <p><span className="font-bold">Date :</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {docParams.exportLcDate}</p>
                    </div>
                    
                    <div className="grid grid-cols-12 gap-2 pt-1">
                      <div className="col-span-7">
                        <p><span className="font-bold">Account of :</span> &nbsp;&nbsp;&nbsp;&nbsp; {docParams.buyerName}</p>
                        <p className="pl-20 text-[9px] text-neutral-700">IRC NO : {docParams.buyerIrc},</p>
                        <p className="pl-20 text-[9px] text-neutral-700">ERC NO.{docParams.buyerErc},</p>
                        <p className="pl-20 text-[9px] text-neutral-700">BIN NO : {docParams.buyerBin}</p>
                        <p className="pl-20 text-[9px] text-neutral-700">TIN NO : {docParams.buyerTin}</p>
                        <p className="pl-20 text-[9px] text-neutral-700">Bank Bin No : {docParams.buyerBankBin},</p>
                        <p className="font-bold mt-1">To :</p>
                        <p className="font-bold text-neutral-900">{docParams.issuingBankName}</p>
                        <p>{docParams.issuingBankBranch}</p>
                        <p>{docParams.issuingBankCity}</p>
                      </div>

                      <div className="col-span-5 flex flex-col justify-end items-end text-right">
                        <div className="font-serif italic text-sm font-bold text-neutral-800 mb-1">
                          S. Paul
                        </div>
                        <div className="border-t border-neutral-900 pt-0.5 text-[9px] font-bold tracking-wider uppercase">
                          FOR ESTRIMS LIMITED
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------------- 2ND OF EXCHANGE ---------------- */}
                <div className="border-2 border-neutral-900 p-5 rounded-xs relative">
                  <div className="absolute right-6 top-3 text-7xl font-black text-blue-600/30 select-none pointer-events-none">
                    2
                  </div>

                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    {renderLogo()}
                    <h3 className="text-sm font-black italic tracking-wide text-neutral-900 uppercase">
                      Bill Of Exchange
                    </h3>
                  </div>
                  <p className="text-[9.5px] text-neutral-700 mb-2 leading-tight">
                    {effectiveAddress}
                  </p>

                  <div className="flex justify-between items-center text-[10px] border-b border-neutral-400 pb-1 mb-2">
                    <div>
                      <span className="font-bold">Invoice No. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                      <span className="font-mono font-bold">{docParams.commercialInvoiceNo}</span>
                    </div>
                    <div>
                      <span className="font-bold">Date : &nbsp;</span>
                      <span className="font-bold">{docParams.commercialInvoiceDate}</span>
                    </div>
                  </div>

                  <p className="font-bold text-[10.5px] mb-2">
                    <span className="font-black text-xs">{docParams.tenorDays}</span> sight of this <span className="underline">SECOND</span> of Exchange ( First of the same tenor and date being unpaid )
                  </p>

                  {/* Pay to the order of & Exchange Box */}
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <div className="space-y-0.5 flex-1">
                      <span className="font-bold block">Pay to the order of :</span>
                      <p className="font-bold text-neutral-900">{docParams.advisingBankName}</p>
                      <p className="text-[9.5px] text-neutral-800">{docParams.advisingBankBranch}</p>
                    </div>

                    <div className="border-2 border-neutral-900 p-2 bg-neutral-50 text-center min-w-[200px] shrink-0">
                      <span className="font-bold text-[11px] block">
                        Exchange for : &nbsp; <span className="font-mono font-black text-xs">${totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                  </div>

                  {/* Say Sum of Bar */}
                  <div className="border-y-2 border-neutral-950 py-1 px-2 font-bold text-[9.5px] uppercase tracking-tight mb-2">
                    THE SUM OF : {formattedAmountWords}
                  </div>

                  {/* Shipment details & To Issuing Bank */}
                  <div className="text-[9.5px] space-y-0.5">
                    <p className="italic">value received and charged for the Shipment Acessories Drawn under -</p>
                    <div className="grid grid-cols-2">
                      <p><span className="font-bold">L/C No.</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {docParams.lcNumber}</p>
                      <p><span className="font-bold">DATE:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {docParams.lcDate}</p>
                    </div>
                    <div className="grid grid-cols-2">
                      <p><span className="font-bold">& EXPORT L/C NO:</span> &nbsp; {docParams.exportLcNo}</p>
                      <p><span className="font-bold">Date :</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {docParams.exportLcDate}</p>
                    </div>
                    
                    <div className="grid grid-cols-12 gap-2 pt-1">
                      <div className="col-span-7">
                        <p><span className="font-bold">Account of :</span> &nbsp;&nbsp;&nbsp;&nbsp; {docParams.buyerName}</p>
                        <p className="pl-20 text-[9px] text-neutral-700">IRC NO : {docParams.buyerIrc},</p>
                        <p className="pl-20 text-[9px] text-neutral-700">ERC NO.{docParams.buyerErc},</p>
                        <p className="pl-20 text-[9px] text-neutral-700">BIN NO : {docParams.buyerBin}</p>
                        <p className="pl-20 text-[9px] text-neutral-700">TIN NO : {docParams.buyerTin}</p>
                        <p className="pl-20 text-[9px] text-neutral-700">Bank Bin No : {docParams.buyerBankBin},</p>
                        <p className="font-bold mt-1">To :</p>
                        <p className="font-bold text-neutral-900">{docParams.issuingBankName}</p>
                        <p>{docParams.issuingBankBranch}</p>
                        <p>{docParams.issuingBankCity}</p>
                      </div>

                      <div className="col-span-5 flex flex-col justify-end items-end text-right">
                        <div className="font-serif italic text-sm font-bold text-neutral-800 mb-1">
                          S. Paul
                        </div>
                        <div className="border-t border-neutral-900 pt-0.5 text-[9px] font-bold tracking-wider uppercase">
                          FOR ESTRIMS LIMITED
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* DOCUMENT 3: DELIVERY CHALLAN */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '3-challan') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-10 rounded shadow-md border border-neutral-300 font-sans text-[10.5px] leading-snug print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px]">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-1">
                  {renderLogo()}
                  <div className="text-right text-[9.5px] text-neutral-600">
                    <p>{effectiveAddress.split('\n')[0]}</p>
                    <p>{effectiveAddress.split('\n')[1]}</p>
                    <p>Tel: 02-7671196</p>
                  </div>
                </div>

                <h2 className="text-center font-bold text-sm tracking-wider uppercase underline underline-offset-4 my-2">
                  DELIVERY CHALLAN
                </h2>

                <div className="flex justify-between items-center font-bold text-[11px] mb-2 px-1">
                  <span>Challan no. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {docParams.deliveryChallanNo}</span>
                  <span>Date : &nbsp;&nbsp; {docParams.deliveryChallanDate}</span>
                </div>

                {/* Metadata Grid */}
                <div className="border border-neutral-950 grid grid-cols-12 mb-4 text-[10px]">
                  <div className="col-span-6 p-2 border-r border-neutral-950 space-y-2">
                    <div>
                      <span className="font-bold block">Exporter :</span>
                      <p className="font-bold">{effectiveCompanyName}</p>
                      <p className="text-[9.5px] text-neutral-700">{effectiveAddress}</p>
                      <p className="text-[9.5px]">TEL : {effectiveTel}</p>
                      <p className="text-[9.5px]">E-mail : {effectiveEmail}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">Consignee & Notify:</span>
                      <p className="font-bold text-neutral-900">{docParams.buyerName}</p>
                      <p className="text-[9.5px] text-neutral-700">{docParams.buyerAddress}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">L/C Issing Bank & Second Notify:</span>
                      <p className="font-bold">{docParams.issuingBankName}</p>
                      <p>{docParams.issuingBankBranch}</p>
                      <p>{docParams.issuingBankCity}</p>
                    </div>
                  </div>

                  <div className="col-span-6 p-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold">Invoice No.</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Invoice Date</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">L/C No.</span>
                      <span className="font-bold">: &nbsp;{docParams.lcNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">L/C Date</span>
                      <span className="font-bold">: &nbsp;{docParams.lcDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">P/I No.</span>
                      <span className="font-bold">: &nbsp;{docParams.piNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">P/I Date</span>
                      <span className="font-bold">: &nbsp;{docParams.piDate}</span>
                    </div>
                    <div className="pt-1 border-t border-neutral-200 text-[9.5px]">
                      <p><span className="font-bold">Export L/C No. & Dt.:</span> &nbsp;{docParams.exportLcNo}</p>
                      <p className="pl-32">{docParams.exportLcDate}</p>
                      <p>IRC NO : {docParams.buyerIrc},</p>
                      <p>ERC NO.{docParams.buyerErc},</p>
                      <p>BIN NO : {docParams.buyerBin}</p>
                      <p>TIN NO : {docParams.buyerTin}</p>
                      <p>Bank Bin No : {docParams.buyerBankBin},</p>
                    </div>
                    <div className="pt-1 border-t border-neutral-200 text-[9.5px] space-y-0.5">
                      <p><span className="font-bold">Port Of Loading :</span> &nbsp;{docParams.portOfLoading}</p>
                      <p><span className="font-bold">Final Destination :</span> &nbsp;{docParams.finalDestination}</p>
                      <p><span className="font-bold">Carrier :</span> &nbsp;: {docParams.carrier}</p>
                      <p><span className="font-bold">Sailing on or About :</span> &nbsp;: {docParams.sailingDate}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-neutral-950 text-[10.5px] mb-4">
                  <thead>
                    <tr className="border-b border-neutral-950 bg-neutral-50 font-bold text-center">
                      <th className="border border-neutral-950 py-1 px-1 w-12">Serial No.</th>
                      <th className="border border-neutral-950 py-1 px-2 text-center">Description of Goods</th>
                      <th className="border border-neutral-950 py-1 px-2 w-36 text-center">Quantity</th>
                      <th className="border border-neutral-950 py-1 px-2 w-32 text-center">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pi.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-950">
                        <td className="border border-neutral-950 py-1 px-1 text-center font-bold">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 font-bold">
                          {item.itemName}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center font-bold">
                          {item.quantity.toLocaleString()} {item.unit || 'DZN'}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center text-[9.5px]">
                          {item.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Certification Statement */}
                <p className="text-[10px] text-neutral-800 leading-relaxed mb-16">
                  We certify that quantity , quality , rate , packing , marking and all other details of the goods are accordance as per Proforma Invoice for our valued customer as well as also certify that consignment are free from manufacturing defect.
                  <br />
                  <span className="font-bold">H.S Code : {docParams.hsCode}</span>
                </p>

                {/* Signatures */}
                <div className="flex justify-between items-end pt-8 text-[10px]">
                  <div className="border-t border-neutral-950 pt-1 font-bold text-neutral-900 w-56 text-center">
                    Authorised Signature of Consignee with seal
                  </div>
                  <div className="border-t border-neutral-950 pt-1 font-bold text-neutral-900 w-56 text-center">
                    Authorised signature For Es Trims Limited
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* DOCUMENT 4: COMMERCIAL INVOICE */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '4-invoice') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-10 rounded shadow-md border border-neutral-300 font-sans text-[10.5px] leading-snug print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px]">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-1">
                  {renderLogo()}
                  <div className="text-right text-[9.5px] text-neutral-600">
                    <p>{effectiveAddress.split('\n')[0]}</p>
                    <p>{effectiveAddress.split('\n')[1]}</p>
                    <p>Tel: 02-7671196</p>
                  </div>
                </div>

                <h2 className="text-center font-bold text-sm tracking-wider uppercase underline underline-offset-4 my-2">
                  COMMERCIAL INVOICE
                </h2>

                {/* Metadata Grid */}
                <div className="border border-neutral-950 grid grid-cols-12 mb-3 text-[10px]">
                  <div className="col-span-7 p-2 border-r border-neutral-950 space-y-1.5">
                    <div>
                      <span className="font-bold block">Exporter :</span>
                      <p className="font-bold">{effectiveCompanyName}</p>
                      <p className="text-[9.5px] text-neutral-700">{effectiveAddress}</p>
                      <p className="text-[9.5px]">TEL : {effectiveTel}</p>
                      <p className="text-[9.5px]">E-mail : {effectiveEmail}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">Consignee & Notify:</span>
                      <p className="font-bold text-neutral-900">{docParams.buyerName}</p>
                      <p className="text-[9.5px] text-neutral-700">{docParams.buyerAddress}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">Advising Bank :</span>
                      <p className="font-bold">{docParams.advisingBankName}</p>
                      <p>{docParams.advisingBankBranch}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1 bg-yellow-200/80 p-1.5 rounded-xs">
                      <span className="font-bold block text-neutral-900">L/C Issing Bank & Second Notify:</span>
                      <p className="font-bold text-neutral-900">{docParams.issuingBankName}</p>
                      <p className="text-neutral-800">{docParams.issuingBankBranch}</p>
                      <p className="text-neutral-800">{docParams.issuingBankCity}</p>
                    </div>
                  </div>

                  <div className="col-span-5 p-2 space-y-1">
                    <div className="flex justify-between bg-yellow-200/80 p-1 rounded-xs">
                      <span className="font-bold">Invoice No.</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceNo}</span>
                    </div>
                    <div className="flex justify-between bg-yellow-200/80 p-1 rounded-xs">
                      <span className="font-bold">Invoice Date</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">L/C No.</span>
                      <span className="font-bold">: &nbsp;{docParams.lcNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Date</span>
                      <span className="font-bold">: &nbsp;{docParams.lcDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">P/I No.</span>
                      <span className="font-bold">: &nbsp;{docParams.piNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">P/I Date</span>
                      <span className="font-bold">: &nbsp;{docParams.piDate}</span>
                    </div>
                    <div className="pt-1 border-t border-neutral-200 text-[9.5px]">
                      <p className="font-bold">Export L/C No. & Dt. :</p>
                      <p className="pl-6 font-bold">{docParams.exportLcNo}</p>
                      <p className="pl-6">{docParams.exportLcDate}</p>
                      <p>IRC NO : {docParams.buyerIrc},</p>
                      <p>ERC NO.{docParams.buyerErc},</p>
                      <p>BIN NO : {docParams.buyerBin}</p>
                      <p>TIN NO : {docParams.buyerTin}</p>
                      <p>Bank Bin No : {docParams.buyerBankBin},</p>
                      <p><span className="font-bold">H.S Code :</span> {docParams.hsCode}</p>
                    </div>
                    <div className="pt-1 border-t border-neutral-200 text-[9.5px] space-y-0.5">
                      <p><span className="font-bold">Port Of Loading :</span> &nbsp;{docParams.portOfLoading}</p>
                      <p><span className="font-bold">Final Destination :</span> &nbsp;{docParams.finalDestination}</p>
                      <p><span className="font-bold">Carrier :</span> &nbsp;: {docParams.carrier}</p>
                      <p><span className="font-bold">Sailing on or About :</span> &nbsp;: {docParams.sailingDate}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-neutral-950 text-[10.5px] mb-2">
                  <thead>
                    <tr className="border-b border-neutral-950 bg-neutral-50 font-bold text-center">
                      <th className="border border-neutral-950 py-1.5 px-1 w-12">Serial No.</th>
                      <th className="border border-neutral-950 py-1.5 px-2 text-center">Description of Goods</th>
                      <th className="border border-neutral-950 py-1.5 px-2 w-32 text-center">Quantity</th>
                      <th className="border border-neutral-950 py-1.5 px-2 w-32 text-center">Unit Price in USD</th>
                      <th className="border border-neutral-950 py-1.5 px-2 w-36 text-center">Total Amount in US DOLLAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pi.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-950">
                        <td className="border border-neutral-950 py-1 px-1 text-center font-bold">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 font-bold">
                          {item.itemName}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center font-bold">
                          {item.quantity.toLocaleString()} {item.unit || 'DZN'}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-right font-mono font-bold">
                          $ &nbsp;{item.rate.toFixed(4)} /{item.unit || 'Dz'}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-right font-mono font-bold">
                          $ &nbsp;{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Total Row */}
                    <tr className="border-t-2 border-neutral-950 font-bold bg-neutral-50">
                      <td colSpan={2} className="border border-neutral-950 py-1 px-2 text-right uppercase">
                        TOTAL :
                      </td>
                      <td className="border border-neutral-950 py-1 px-2 text-center">
                        {totalQty.toLocaleString()} {pi.items?.[0]?.unit || 'Dzn'}
                      </td>
                      <td className="border border-neutral-950 py-1 px-2 text-center uppercase">
                        TOTAL :
                      </td>
                      <td className="border border-neutral-950 py-1 px-2 text-right font-mono">
                        $ &nbsp;{totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Amount in words */}
                <div className="border-y-2 border-neutral-950 py-1 px-2 font-bold text-center text-[10px] uppercase mb-4">
                  THE SUM OF : {formattedAmountWords}
                </div>

                {/* Statement */}
                <p className="text-[10px] text-neutral-800 leading-relaxed mb-20">
                  We certify that quantity , quality , rate , packing , marking and all other details of the goods are accordance as per Proforma Invoice for our valued customer as well as also certify that the goods country of origin are Bangladesh.
                </p>

                {/* Signature */}
                <div className="flex justify-end text-[10px]">
                  <div className="border-t border-neutral-950 pt-1 font-bold text-neutral-900 w-56 text-center">
                    Authorised signature For eS Trims Ltd..
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* DOCUMENT 5: PACKING LIST */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '5-packing') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-10 rounded shadow-md border border-neutral-300 font-sans text-[10.5px] leading-snug print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px]">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-1">
                  {renderLogo()}
                  <div className="text-right text-[9.5px] text-neutral-600">
                    <p>{effectiveAddress.split('\n')[0]}</p>
                    <p>{effectiveAddress.split('\n')[1]}</p>
                    <p>Tel: 02-7671196</p>
                  </div>
                </div>

                <h2 className="text-center font-bold text-sm tracking-wider uppercase underline underline-offset-4 my-2">
                  PACKING LIST
                </h2>

                {/* Metadata Grid */}
                <div className="border border-neutral-950 grid grid-cols-12 mb-3 text-[10px]">
                  <div className="col-span-7 p-2 border-r border-neutral-950 space-y-1.5">
                    <div>
                      <span className="font-bold block">Exporter :</span>
                      <p className="font-bold">{effectiveCompanyName}</p>
                      <p className="text-[9.5px] text-neutral-700">{effectiveAddress}</p>
                      <p className="text-[9.5px]">TEL : {effectiveTel}</p>
                      <p className="text-[9.5px]">E-mail : {effectiveEmail}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">Consignee & Notify:</span>
                      <p className="font-bold text-neutral-900">{docParams.buyerName}</p>
                      <p className="text-[9.5px] text-neutral-700">{docParams.buyerAddress}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">L/C Issing Bank & Second Notify:</span>
                      <p className="font-bold">{docParams.issuingBankName}</p>
                      <p>{docParams.issuingBankBranch}</p>
                      <p>{docParams.issuingBankCity}</p>
                    </div>
                  </div>

                  <div className="col-span-5 p-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold">Invoice No.</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Invoice Date</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">L/C No.</span>
                      <span className="font-bold">: &nbsp;{docParams.lcNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Date</span>
                      <span className="font-bold">: &nbsp;{docParams.lcDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">P/I No.</span>
                      <span className="font-bold">: &nbsp;{docParams.piNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">P/I Date</span>
                      <span className="font-bold">: &nbsp;{docParams.piDate}</span>
                    </div>
                    <div className="pt-1 border-t border-neutral-200 text-[9.5px]">
                      <p className="font-bold">Export L/C No. & Dt.:</p>
                      <p className="pl-6 font-bold">{docParams.exportLcNo}</p>
                      <p className="pl-6">{docParams.exportLcDate}</p>
                      <p>IRC NO : {docParams.buyerIrc},</p>
                      <p>ERC NO.{docParams.buyerErc},</p>
                      <p>BIN NO : {docParams.buyerBin}</p>
                      <p>TIN NO : {docParams.buyerTin}</p>
                      <p>Bank Bin No : {docParams.buyerBankBin},</p>
                    </div>
                    <div className="pt-1 border-t border-neutral-200 text-[9.5px] space-y-0.5">
                      <p><span className="font-bold">Port Of Loading :</span> &nbsp;{docParams.portOfLoading}</p>
                      <p><span className="font-bold">Final Destination :</span> &nbsp;{docParams.finalDestination}</p>
                      <p><span className="font-bold">Carrier :</span> &nbsp;: {docParams.carrier}</p>
                      <p><span className="font-bold">Sailing on or About :</span> &nbsp;: {docParams.sailingDate}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table with Weights */}
                <table className="w-full border-collapse border border-neutral-950 text-[10.5px] mb-3">
                  <thead>
                    <tr className="border-b border-neutral-950 bg-neutral-50 font-bold text-center">
                      <th className="border border-neutral-950 py-1.5 px-1 w-12">Serial No.</th>
                      <th className="border border-neutral-950 py-1.5 px-2 text-center">Description of Goods</th>
                      <th className="border border-neutral-950 py-1.5 px-2 w-32 text-center">Quantity</th>
                      <th className="border border-neutral-950 py-1.5 px-2 w-32 text-center">Net Weight in KGS.</th>
                      <th className="border border-neutral-950 py-1.5 px-2 w-32 text-center">Gross Weight in KGS.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pi.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-950">
                        <td className="border border-neutral-950 py-1 px-1 text-center font-bold">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 font-bold">
                          {item.itemName}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center font-bold">
                          {item.quantity.toLocaleString()} {item.unit || 'DZN'}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center font-mono font-bold bg-yellow-100/60">
                          {docParams.netWeightKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center font-mono font-bold">
                          {docParams.grossWeightKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}

                    {/* Total Row */}
                    <tr className="border-t-2 border-neutral-950 font-bold bg-neutral-50">
                      <td colSpan={3} className="border border-neutral-950 py-1 px-2 text-right uppercase">
                        TOTAL :
                      </td>
                      <td className="border border-neutral-950 py-1 px-2 text-center font-mono">
                        {docParams.netWeightKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="border border-neutral-950 py-1 px-2 text-center font-mono">
                        {docParams.grossWeightKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Statement */}
                <p className="text-[10px] text-neutral-800 leading-relaxed mb-24">
                  We certify that quantity , quality , rate , packing , marking and all other details of the goods are accordance as per Proforma Invoice for our valued customer as well as also certify that consignment are free from manufacturing defect.
                  <br />
                  <span className="font-bold">H.S Code : {docParams.hsCode}</span>
                </p>

                {/* Signature */}
                <div className="flex justify-end text-[10px]">
                  <div className="border-t border-neutral-950 pt-1 font-bold text-neutral-900 w-56 text-center">
                    Authorised signature For Es Trims Limited
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* DOCUMENT 6: TRUCK CHALLAN */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '6-truck') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-10 rounded shadow-md border border-neutral-300 font-sans text-[10.5px] leading-snug print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px]">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-1">
                  {renderLogo()}
                  <div className="text-right text-[9.5px] text-neutral-600">
                    <p>{effectiveAddress.split('\n')[0]}</p>
                    <p>{effectiveAddress.split('\n')[1]}</p>
                    <p>Tel: 02-7671196</p>
                  </div>
                </div>

                <h2 className="text-center font-bold text-sm tracking-wider uppercase underline underline-offset-4 my-2">
                  TRUCK CHALLAN
                </h2>

                {/* Freight Prepaid & Truck info bar */}
                <div className="border border-neutral-950 grid grid-cols-12 mb-3">
                  <div className="col-span-6 p-2 border-r border-neutral-950 flex items-center justify-center font-black text-xs uppercase bg-neutral-50">
                    Freight Prepaid
                  </div>
                  <div className="col-span-6 p-2 space-y-1 text-[10.5px]">
                    <div className="flex">
                      <span className="font-bold w-24">Date :</span>
                      <span className="font-bold">{docParams.commercialInvoiceDate}</span>
                    </div>
                    <div className="flex">
                      <span className="font-bold w-24">Truck No. -</span>
                      <span className="font-bold">{docParams.truckNo}</span>
                    </div>
                  </div>
                </div>

                {/* Order Details Grid */}
                <div className="border border-neutral-950 grid grid-cols-12 mb-4 text-[10px]">
                  <div className="col-span-7 p-2 border-r border-neutral-950 space-y-2">
                    <div>
                      <span className="font-bold block">To The Order Of</span>
                      <p className="font-bold">{docParams.advisingBankName}</p>
                      <p>{docParams.advisingBankBranch}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">From :</span>
                      <p className="font-bold">{effectiveCompanyName}</p>
                      <p className="text-[9.5px] text-neutral-700">{effectiveAddress}</p>
                      <p className="text-[9.5px]">TEL : {effectiveTel}</p>
                    </div>

                    <div className="border-t border-neutral-300 pt-1">
                      <span className="font-bold block">To :</span>
                      <p className="font-bold text-neutral-900">{docParams.buyerName}</p>
                      <p className="text-[9.5px] text-neutral-700">{docParams.buyerAddress}</p>
                    </div>
                  </div>

                  <div className="col-span-5 p-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold">Invoice No.</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Invoice Date</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">L/C No.</span>
                      <span className="font-bold">: &nbsp;{docParams.lcNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Date</span>
                      <span className="font-bold">: &nbsp;{docParams.lcDate}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="font-bold">P/I No.</span>
                      <span className="font-bold">: &nbsp;{docParams.piNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">P/I Date</span>
                      <span className="font-bold">: &nbsp;{docParams.piDate}</span>
                    </div>
                    <div className="pt-1 border-t border-neutral-200 text-[9.5px]">
                      <p className="font-bold">Export L/C No. :</p>
                      <p className="pl-6 font-bold">{docParams.exportLcNo}</p>
                      <p className="pl-6">{docParams.exportLcDate}</p>
                      <p>IRC NO : {docParams.buyerIrc},</p>
                      <p>ERC NO.{docParams.buyerErc},</p>
                      <p>BIN NO : {docParams.buyerBin}</p>
                      <p>TIN NO : {docParams.buyerTin}</p>
                      <p>Bank Bin No : {docParams.buyerBankBin},</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-neutral-950 text-[10.5px] mb-4">
                  <thead>
                    <tr className="border-b border-neutral-950 bg-neutral-50 font-bold text-center">
                      <th className="border border-neutral-950 py-1 px-1 w-12">Serial No.</th>
                      <th className="border border-neutral-950 py-1 px-2 text-center">Description of Goods</th>
                      <th className="border border-neutral-950 py-1 px-2 w-36 text-center">Quantity</th>
                      <th className="border border-neutral-950 py-1 px-2 w-32 text-center">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pi.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-950">
                        <td className="border border-neutral-950 py-1 px-1 text-center font-bold">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 font-bold">
                          {item.itemName}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center font-bold">
                          {item.quantity.toLocaleString()} {item.unit || 'DZN'}
                        </td>
                        <td className="border border-neutral-950 py-1 px-2 text-center text-[9.5px]">
                          -
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Own Transport Banner */}
                <div className="font-bold text-[11px] mb-1">
                  DELIVERY IS DONE BY OUR OWN TRANSPORT
                </div>
                <div className="font-bold text-[10px] mb-24">
                  H.S Code : {docParams.hsCode}
                </div>

                {/* Signature */}
                <div className="flex justify-end text-[10px]">
                  <div className="border-t border-neutral-950 pt-1 font-bold text-neutral-900 w-56 text-center">
                    Authorised signature For Es Trims Limited
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* DOCUMENT 7: CERTIFICATE OF ORIGIN */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '7-coo') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-10 rounded shadow-md border border-neutral-300 font-sans text-[11px] leading-relaxed print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px]">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-2">
                  {renderLogo()}
                  <div className="text-right text-[9.5px] text-neutral-600">
                    <p>{effectiveAddress.split('\n')[0]}</p>
                    <p>{effectiveAddress.split('\n')[1]}</p>
                    <p>Tel: 02-7671196</p>
                  </div>
                </div>

                {/* Title Banner */}
                <div className="bg-neutral-300 py-1.5 px-4 text-center font-black text-sm tracking-widest uppercase my-4 border border-neutral-400">
                  CERTIFICATE OF ORIGIN
                </div>

                {/* Data Fields */}
                <div className="space-y-2 text-xs mb-8 px-4">
                  <div className="flex">
                    <span className="font-bold w-52">Buyer</span>
                    <span className="font-bold">: &nbsp;{docParams.buyerName}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <div className="flex">
                      <span className="font-bold w-52">Invoice No.</span>
                      <span className="font-bold">: &nbsp;{docParams.commercialInvoiceNo}</span>
                    </div>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52">Invoice Date</span>
                    <span className="font-bold">: &nbsp;{docParams.commercialInvoiceDate}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <div className="flex">
                      <span className="font-bold w-52">L/C No.</span>
                      <span className="font-bold">: &nbsp;{docParams.lcNumber}</span>
                    </div>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52">Date</span>
                    <span className="font-bold">: &nbsp;{docParams.lcDate}</span>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52">L/C Value</span>
                    <span className="font-bold font-mono">: &nbsp;${totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <div className="flex">
                      <span className="font-bold w-52">P/I No.</span>
                      <span className="font-bold">: &nbsp;{docParams.piNumber}</span>
                    </div>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52">P/I Date</span>
                    <span className="font-bold">: &nbsp;{docParams.piDate}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <div className="flex">
                      <span className="font-bold w-52">Export L/C No. & DT.</span>
                      <span className="font-bold">: &nbsp;{docParams.exportLcNo}</span>
                    </div>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52"></span>
                    <span className="font-bold">: &nbsp;{docParams.exportLcDate}</span>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 space-y-1 text-neutral-800">
                    <div className="flex">
                      <span className="font-bold w-52">IRC NO</span>
                      <span>: &nbsp;{docParams.buyerIrc}</span>
                    </div>
                    <div className="flex">
                      <span className="font-bold w-52">ERC NO</span>
                      <span>: &nbsp;{docParams.buyerErc}</span>
                    </div>
                    <div className="flex">
                      <span className="font-bold w-52">BIN NO</span>
                      <span>: &nbsp;{docParams.buyerBin}</span>
                    </div>
                    <div className="flex">
                      <span className="font-bold w-52">TIN NO</span>
                      <span>: &nbsp;{docParams.buyerTin}</span>
                    </div>
                    <div className="flex">
                      <span className="font-bold w-52">Bank Bin No</span>
                      <span>: &nbsp;{docParams.buyerBankBin}</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <div className="flex">
                      <span className="font-bold w-52">DELIVERY CHALLAN NO.</span>
                      <span className="font-bold">: &nbsp;{docParams.deliveryChallanNo}</span>
                    </div>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52">DELIVERY CHALLAN DT.</span>
                    <span className="font-bold">: &nbsp;{docParams.deliveryChallanDate}</span>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52">H.s Code</span>
                    <span className="font-bold">: &nbsp;{docParams.hsCode}</span>
                  </div>

                  <div className="flex">
                    <span className="font-bold w-52">Comodity</span>
                    <span className="font-bold">: &nbsp;{docParams.commodity}</span>
                  </div>
                </div>

                {/* Certification Banner */}
                <div className="bg-neutral-300 py-1.5 px-4 text-center font-bold text-xs uppercase tracking-wide my-8 border border-neutral-400">
                  We do hereby certify that the above specified goods are of Bangladesh Origin.
                </div>

                {/* Signature */}
                <div className="flex justify-end pt-12 text-[10px]">
                  <div className="border-t border-neutral-950 pt-1 font-bold text-neutral-900 w-56 text-center">
                    Authorised signature For Es Trims Limited
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* DOCUMENT 8: BANK SUBMISSION / FORWARDING LETTER */}
            {/* ============================================================ */}
            {(activeDocTab === 'all' || activeDocTab === '8-bank') && (
              <div className="page-doc bg-white text-neutral-950 p-8 sm:p-12 rounded shadow-md border border-neutral-300 font-sans text-xs leading-relaxed print:p-0 print:border-none print:shadow-none print:break-after-page min-h-[1050px]">
                
                {/* Date & Address */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="font-bold">To</p>
                    <p className="font-bold">The Manager</p>
                    <p className="font-bold text-neutral-900">{docParams.advisingBankName}</p>
                    <p>{docParams.advisingBankBranch.split(',')[0]}</p>
                    <p>56/1 S.M Maleh Road, Narayanganj.</p>
                  </div>
                  <div className="font-bold text-neutral-900">
                    Date: {docParams.commercialInvoiceDate}
                  </div>
                </div>

                {/* Subject Bar */}
                <div className="font-bold text-xs border-y-2 border-neutral-950 py-2 my-6">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <span>
                      Sub : Submission of Export bill documents for USD &nbsp;
                      <span className="font-mono font-black">$ {totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </span>
                    <span>
                      Under L/C No. &nbsp;&nbsp;{docParams.lcNumber}
                    </span>
                  </div>
                  <div className="text-right text-[11px] font-semibold mt-1">
                    DATE : &nbsp;&nbsp;{docParams.lcDate}
                  </div>
                </div>

                {/* Salutation */}
                <p className="mb-2 font-bold">Dear Sir,</p>
                <p className="mb-4">
                  We hereby submit the above noted export bills for negotiation at your end.
                </p>

                <p className="font-bold mb-3">The documents are follows :-</p>

                {/* Documents Table Checklist */}
                <div className="pl-6 space-y-2 mb-8 text-xs font-medium">
                  <div className="grid grid-cols-12 max-w-lg">
                    <span className="col-span-5">1. &nbsp;Bill of Exchange</span>
                    <span className="col-span-4">01 Original</span>
                    <span className="col-span-3">& 0 Photo Copy</span>
                  </div>
                  <div className="grid grid-cols-12 max-w-lg">
                    <span className="col-span-5">2. &nbsp;Delivery challan</span>
                    <span className="col-span-4">01 Original</span>
                    <span className="col-span-3">& 03 Photo Copy</span>
                  </div>
                  <div className="grid grid-cols-12 max-w-lg">
                    <span className="col-span-5">3. &nbsp;Commercial Invoice.</span>
                    <span className="col-span-4">01 Original</span>
                    <span className="col-span-3">& 08 Photo Copy</span>
                  </div>
                  <div className="grid grid-cols-12 max-w-lg">
                    <span className="col-span-5">4. &nbsp;Packing List.</span>
                    <span className="col-span-4">01 Original</span>
                    <span className="col-span-3">& 03 Photo Copy</span>
                  </div>
                  <div className="grid grid-cols-12 max-w-lg">
                    <span className="col-span-5">5. &nbsp;Truck receipt</span>
                    <span className="col-span-4">01 Original</span>
                    <span className="col-span-3">& 04 Photo Copy</span>
                  </div>
                  <div className="grid grid-cols-12 max-w-lg">
                    <span className="col-span-5">6. &nbsp;Certificate of Origin</span>
                    <span className="col-span-4">01 Original</span>
                    <span className="col-span-3">& 02 Photo Copy</span>
                  </div>
                </div>

                <p className="mb-16">
                  Thanking you in advance for your co-opertion .
                </p>

                {/* Signature */}
                <div className="mb-16">
                  <div className="font-serif italic text-base font-bold text-neutral-800 mb-1">
                    S. Paul
                  </div>
                  <div className="border-t border-neutral-900 pt-1 text-[10px] font-bold w-52">
                    Authorised signature For Es Trims Limited
                  </div>
                </div>

                {/* NB */}
                <p className="text-[11px] font-semibold text-neutral-700 italic">
                  N.B. Also one set of photocopy document for bank .
                </p>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
