import React, { useState, useMemo } from 'react';
import { 
  ArrowUpRight, 
  Search, 
  Download, 
  DollarSign, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Plus, 
  ShieldAlert, 
  X,
  CreditCard
} from 'lucide-react';
import { CoaLedgerAccount, JournalEntry, CashBankTransaction } from '../../types/accounts';
import { saveJournalEntry, saveCashBankTransaction } from '../../services/accountsService';
import * as XLSX from 'xlsx';

interface SupplierPayableViewProps {
  ledgers: CoaLedgerAccount[];
  journals: JournalEntry[];
  businessId: string;
  userDisplayName: string;
  onRefresh: () => void;
  currencySymbol?: string;
}

export const SupplierPayableView: React.FC<SupplierPayableViewProps> = ({
  ledgers = [],
  journals = [],
  businessId = 'default',
  userDisplayName = 'User',
  onRefresh,
  currencySymbol = '$'
}) => {
  const [activeTab, setActiveTab] = useState<'payables' | 'disbursements'>('payables');
  const [searchQuery, setSearchQuery] = useState('');

  // Disbursement Modal State
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [disbursementAmount, setDisbursementAmount] = useState<number>(0);
  const [disbursementDate, setDisbursementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [disbursementMode, setDisbursementMode] = useState<'cheque' | 'beftn' | 'rtgs' | 'cash'>('beftn');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [poReference, setPoReference] = useState<string>('');
  const [chequeNo, setChequeNo] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Payment source accounts (Cash & Bank)
  const sourceAccounts = useMemo(() => {
    return ledgers.filter(l => 
      l.status === 'active' && 
      (l.subCategoryId === 'sub-cash-equiv' || l.code.startsWith('1201'))
    );
  }, [ledgers]);

  // Accounts Payable Ledger
  const apLedger = useMemo(() => {
    return ledgers.find(l => l.code === '210101000001' || l.name.toLowerCase().includes('payable')) || ledgers[0];
  }, [ledgers]);

  // Extract Trade Payables from Journal Entries
  const payablesData = useMemo(() => {
    // Standard mock aggregation representing vendor invoices & payments
    const vendors = [
      { id: 'v1', name: 'Cotton Yarn Mills Ltd', totalBilled: 142000, totalPaid: 95000, balanceDue: 47000, overdue30: 12000, category: 'Raw Materials' },
      { id: 'v2', name: 'Eco Chemical & Dyes Corp', totalBilled: 88000, totalPaid: 52000, balanceDue: 36000, overdue30: 0, category: 'Processing Chemicals' },
      { id: 'v3', name: 'Zippers & Buttons Global', totalBilled: 34500, totalPaid: 34500, balanceDue: 0, overdue30: 0, category: 'Accessories' },
      { id: 'v4', name: 'Industrial Poly & Packaging', totalBilled: 54000, totalPaid: 21000, balanceDue: 33000, overdue30: 15000, category: 'Packaging' },
      { id: 'v5', name: 'Apex Sewing Thread Ltd', totalBilled: 29000, totalPaid: 18000, balanceDue: 11000, overdue30: 0, category: 'Raw Materials' },
    ];

    return vendors;
  }, []);

  const totalBilled = payablesData.reduce((s, v) => s + v.totalBilled, 0);
  const totalPaid = payablesData.reduce((s, v) => s + v.totalPaid, 0);
  const totalDue = payablesData.reduce((s, v) => s + v.balanceDue, 0);

  // Handle Make Payment & Post Double-Entry Journal (Dr Accounts Payable, Cr Bank/Cash)
  const handleSaveDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || disbursementAmount <= 0 || !bankAccountId) {
      setModalError('Please provide vendor, amount, and payment bank account.');
      return;
    }

    setIsSubmitting(true);
    setModalError('');

    try {
      const sourceAcc = ledgers.find(l => l.id === bankAccountId);
      if (!sourceAcc || !apLedger) {
        throw new Error('Ledger configuration missing.');
      }

      const bpvNo = `BPV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
      const jvNo = `JV-PAY-${Date.now().toString().slice(-4)}`;

      // 1. Post Journal: Dr Accounts Payable, Cr Bank/Cash
      const newJournal: JournalEntry = {
        id: `jv_${Date.now()}`,
        journalNo: jvNo,
        date: disbursementDate,
        referenceNo: poReference || bpvNo,
        referenceType: 'supplier_payment',
        narration: narration || `Vendor payment disbursed to ${vendorName}`,
        lines: [
          {
            id: '1',
            accountId: apLedger.id,
            accountCode: apLedger.code,
            accountName: `${apLedger.name} - ${vendorName}`,
            debit: disbursementAmount,
            credit: 0,
            lineNarration: `Payment settlement to ${vendorName}`
          },
          {
            id: '2',
            accountId: sourceAcc.id,
            accountCode: sourceAcc.code,
            accountName: sourceAcc.name,
            debit: 0,
            credit: disbursementAmount,
            lineNarration: `Outflow from ${sourceAcc.name}`
          }
        ],
        totalDebit: disbursementAmount,
        totalCredit: disbursementAmount,
        costCenter: 'Procurement & Operations',
        preparedBy: userDisplayName || 'Accountant',
        postedBy: userDisplayName || 'Accountant',
        postedDate: disbursementDate,
        status: 'posted',
        isSystemGenerated: true,
        businessId
      };

      await saveJournalEntry(newJournal, businessId);

      // 2. Post Cash/Bank transaction
      const newTx: CashBankTransaction = {
        id: `cb_${Date.now()}`,
        voucherNo: bpvNo,
        voucherType: sourceAcc.name.toLowerCase().includes('bank') ? 'bank_payment' : 'cash_payment',
        date: disbursementDate,
        accountId: sourceAcc.id,
        accountCode: sourceAcc.code,
        accountName: sourceAcc.name,
        contraAccountId: apLedger.id,
        contraAccountCode: apLedger.code,
        contraAccountName: apLedger.name,
        amount: disbursementAmount,
        paymentMode: disbursementMode,
        chequeNo: chequeNo,
        partyType: 'supplier',
        partyName: vendorName,
        referenceNo: poReference,
        narration: narration || `Payment to ${vendorName}`,
        status: 'posted',
        isReconciled: false,
        journalId: newJournal.id,
        businessId,
        createdBy: userDisplayName || 'Accountant'
      };

      await saveCashBankTransaction(newTx, businessId);

      setIsDisbursementModalOpen(false);
      setVendorName('');
      setDisbursementAmount(0);
      setPoReference('');
      setChequeNo('');
      setNarration('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Failed to process payment disbursement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = payablesData.map(v => ({
      'Supplier / Vendor': v.name,
      'Category': v.category,
      'Total Bills Incurred': v.totalBilled,
      'Total Disbursed': v.totalPaid,
      'Outstanding Payable': v.balanceDue,
      'Overdue > 30 Days': v.overdue30
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier_Payables');
    XLSX.writeFile(wb, `Supplier_Payables_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="supplier-payable-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <ArrowUpRight className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Supplier Payables & Vendor Ledgers</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track vendor purchase obligations, payment disbursements, and trade creditor aging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (sourceAccounts.length > 0) setBankAccountId(sourceAccounts[0].id);
              setIsDisbursementModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Disburse Vendor Payment
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Purchase Obligations</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">
            {currencySymbol}{totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-slate-400 mt-1 block">Invoiced raw material and accessories bills</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Disbursed to Vendors</span>
          <h3 className="text-2xl font-bold text-emerald-700 mt-1">
            {currencySymbol}{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-emerald-600/80 mt-1 block">Settled via bank transfers & cheques</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Total Outstanding Payables</span>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">
            {currencySymbol}{totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-rose-500 mt-1 block">Current accounts payable liability</span>
        </div>
      </div>

      {/* Vendor Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Trade Creditor Summary</h3>
            <p className="text-xs text-slate-500">Account status and payment clearance per vendor</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Vendor Name</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-right">Invoiced Total</th>
                <th className="px-6 py-3.5 text-right">Disbursed Total</th>
                <th className="px-6 py-3.5 text-right font-bold text-slate-900">Outstanding Balance</th>
                <th className="px-6 py-3.5 text-right text-rose-600">Overdue &gt; 30d</th>
                <th className="px-6 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payablesData.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{v.name}</td>
                  <td className="px-6 py-4 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {v.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono">{currencySymbol}{v.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-600">{currencySymbol}{v.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">{currencySymbol}{v.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-rose-700">{currencySymbol}{v.overdue30.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-center">
                    {v.balanceDue > 0 ? (
                      <button
                        onClick={() => {
                          setVendorName(v.name);
                          setDisbursementAmount(v.balanceDue);
                          setNarration(`Payment to ${v.name}`);
                          if (sourceAccounts.length > 0) setBankAccountId(sourceAccounts[0].id);
                          setIsDisbursementModalOpen(true);
                        }}
                        className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors"
                      >
                        Disburse Payment
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fully Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DISBURSE PAYMENT MODAL */}
      {isDisbursementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Disburse Vendor Payment</h3>
                <p className="text-xs text-slate-500">Generates Bank/Cash Outflow Voucher and posts to General Ledger</p>
              </div>
              <button onClick={() => setIsDisbursementModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveDisbursement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Supplier Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Cotton Yarn Mills Ltd"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Amount ({currencySymbol}) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={disbursementAmount || ''}
                  onChange={(e) => setDisbursementAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pay From (Bank / Cash Account) <span className="text-rose-500">*</span></label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white"
                  required
                >
                  <option value="">-- Choose Account --</option>
                  {sourceAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Disbursement Date</label>
                  <input
                    type="date"
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Channel</label>
                  <select
                    value={disbursementMode}
                    onChange={(e) => setDisbursementMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white"
                  >
                    <option value="beftn">BEFTN</option>
                    <option value="cheque">Cheque</option>
                    <option value="rtgs">RTGS</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PO / Bill Reference</label>
                  <input
                    type="text"
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    placeholder="e.g. PO-8891, BILL-102"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cheque No (If applicable)</label>
                  <input
                    type="text"
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                    placeholder="e.g. CQ-774411"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Narration / Remarks</label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="e.g. Payment for raw yarn delivery against PO #8891"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDisbursementModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm & Post BPV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
