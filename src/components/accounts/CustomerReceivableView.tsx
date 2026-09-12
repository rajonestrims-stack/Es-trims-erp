import React, { useState, useMemo } from 'react';
import { 
  ArrowDownRight, 
  Search, 
  Download, 
  Printer, 
  DollarSign, 
  Calendar, 
  UserCheck, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Plus, 
  ShieldAlert, 
  X,
  AlertTriangle 
} from 'lucide-react';
import { CustomerBill, Customer } from '../../types';
import { CoaLedgerAccount, JournalEntry, CashBankTransaction } from '../../types/accounts';
import { saveJournalEntry, saveCashBankTransaction } from '../../services/accountsService';
import * as XLSX from 'xlsx';

interface CustomerReceivableViewProps {
  customerBills?: CustomerBill[];
  customers?: Customer[];
  ledgers?: CoaLedgerAccount[];
  journals?: JournalEntry[];
  businessId: string;
  userDisplayName: string;
  onRefresh: () => void;
  currencySymbol?: string;
}

export const CustomerReceivableView: React.FC<CustomerReceivableViewProps> = ({
  customerBills = [],
  customers = [],
  ledgers = [],
  journals = [],
  businessId,
  userDisplayName,
  onRefresh,
  currencySymbol = '$'
}) => {
  const [activeTab, setActiveTab] = useState<'aging' | 'customers' | 'invoices'>('aging');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('All');

  // Payment Collection Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptBill, setReceiptBill] = useState<CustomerBill | null>(null);
  const [receiptAmount, setReceiptAmount] = useState<number>(0);
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptMode, setPaymentMode] = useState<'cash' | 'cheque' | 'beftn' | 'rtgs'>('beftn');
  const [receiptBankAccountId, setReceiptBankAccountId] = useState<string>('');
  const [receiptRef, setReceiptRef] = useState<string>('');
  const [receiptNarration, setReceiptNarration] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Cash & Bank accounts for payment deposit
  const depositAccounts = useMemo(() => {
    return ledgers.filter(l => 
      l.status === 'active' && 
      (l.subCategoryId === 'sub-cash-equiv' || l.code.startsWith('1201'))
    );
  }, [ledgers]);

  // Accounts Receivable Ledger
  const arLedger = useMemo(() => {
    return ledgers.find(l => l.code === '120201000001' || l.name.toLowerCase().includes('receivable')) || ledgers[0];
  }, [ledgers]);

  // Aggregate Customer Balances and Aging
  const customerAgingReport = useMemo(() => {
    const today = new Date();
    const map: Record<string, {
      customerId: string;
      customerName: string;
      totalInvoiced: number;
      totalPaid: number;
      balanceDue: number;
      current: number;    // 0-30 days
      days31to60: number; // 31-60 days
      days61to90: number; // 61-90 days
      over90: number;     // >90 days
      bills: CustomerBill[];
    }> = {};

    customerBills.forEach(bill => {
      const cId = bill.customerId || bill.clientName || 'General';
      const cName = bill.clientName || bill.customerName || 'Standard Client';

      if (!map[cId]) {
        map[cId] = {
          customerId: cId,
          customerName: cName,
          totalInvoiced: 0,
          totalPaid: 0,
          balanceDue: 0,
          current: 0,
          days31to60: 0,
          days61to90: 0,
          over90: 0,
          bills: []
        };
      }

      const invoiceAmount = Number(bill.totalAmount || bill.grandTotal || bill.amount || 0);
      const paidAmount = Number(bill.paidAmount || 0);
      const dueAmount = invoiceAmount - paidAmount;

      map[cId].totalInvoiced += invoiceAmount;
      map[cId].totalPaid += paidAmount;
      map[cId].balanceDue += Math.max(0, dueAmount);
      map[cId].bills.push(bill);

      if (dueAmount > 0) {
        const billDate = new Date(bill.billDate || bill.createdAt || today);
        const diffDays = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 3600 * 24));

        if (diffDays <= 30) {
          map[cId].current += dueAmount;
        } else if (diffDays <= 60) {
          map[cId].days31to60 += dueAmount;
        } else if (diffDays <= 90) {
          map[cId].days61to90 += dueAmount;
        } else {
          map[cId].over90 += dueAmount;
        }
      }
    });

    return Object.values(map);
  }, [customerBills]);

  // Totals
  const overallTotals = useMemo(() => {
    return customerAgingReport.reduce((acc, c) => ({
      invoiced: acc.invoiced + c.totalInvoiced,
      paid: acc.paid + c.totalPaid,
      due: acc.due + c.balanceDue,
      current: acc.current + c.current,
      days31to60: acc.days31to60 + c.days31to60,
      days61to90: acc.days61to90 + c.days61to90,
      over90: acc.over90 + c.over90,
    }), { invoiced: 0, paid: 0, due: 0, current: 0, days31to60: 0, days61to90: 0, over90: 0 });
  }, [customerAgingReport]);

  // Open Payment Modal
  const handleOpenReceiptModal = (bill: CustomerBill) => {
    const total = bill.grandTotalUSD || bill.totalAmountUSD || 0;
    const due = total;
    setReceiptBill(bill);
    setReceiptAmount(due > 0 ? due : 0);
    if (depositAccounts.length > 0) {
      setReceiptBankAccountId(depositAccounts[0].id);
    }
    setReceiptNarration(`Payment received against Bill #${bill.billNo || bill.id} from ${bill.customerName || 'Customer'}`);
    setReceiptRef(bill.billNo || '');
    setIsReceiptModalOpen(true);
    setReceiptError('');
  };

  // Submit Receipt & Post Balanced JV
  const handleSaveCustomerReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptBill || receiptAmount <= 0 || !receiptBankAccountId) {
      setReceiptError('Please provide valid amount and select deposit account.');
      return;
    }

    setIsSubmitting(true);
    setReceiptError('');

    try {
      const depositAcc = ledgers.find(l => l.id === receiptBankAccountId);
      if (!depositAcc || !arLedger) {
        throw new Error('Ledger mapping missing for Accounts Receivable or Deposit Account.');
      }

      const receiptVoucherNo = `MR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
      const jvNo = `JV-REC-${Date.now().toString().slice(-4)}`;

      // 1. Double Entry: Dr Cash/Bank, Cr Accounts Receivable
      const newJournal: JournalEntry = {
        id: `jv_${Date.now()}`,
        journalNo: jvNo,
        date: receiptDate,
        referenceNo: receiptBill.billNumber || receiptRef,
        referenceType: 'customer_payment',
        narration: receiptNarration,
        lines: [
          {
            id: '1',
            accountId: depositAcc.id,
            accountCode: depositAcc.code,
            accountName: depositAcc.name,
            debit: receiptAmount,
            credit: 0,
            lineNarration: `Deposit to ${depositAcc.name}`
          },
          {
            id: '2',
            accountId: arLedger.id,
            accountCode: arLedger.code,
            accountName: `${arLedger.name} - ${receiptBill.clientName || 'Customer'}`,
            debit: 0,
            credit: receiptAmount,
            lineNarration: `Reduction of Receivable for Bill #${receiptBill.billNumber}`
          }
        ],
        totalDebit: receiptAmount,
        totalCredit: receiptAmount,
        costCenter: 'Sales & Commercial',
        preparedBy: userDisplayName || 'Accounts Officer',
        postedBy: userDisplayName || 'Accounts Officer',
        postedDate: receiptDate,
        status: 'posted',
        isSystemGenerated: true,
        businessId
      };

      await saveJournalEntry(newJournal, businessId);

      // 2. Record Cash/Bank transaction
      const newTx: CashBankTransaction = {
        id: `cb_${Date.now()}`,
        voucherNo: receiptVoucherNo,
        voucherType: depositAcc.name.toLowerCase().includes('bank') ? 'bank_receipt' : 'cash_receipt',
        date: receiptDate,
        accountId: depositAcc.id,
        accountCode: depositAcc.code,
        accountName: depositAcc.name,
        contraAccountId: arLedger.id,
        contraAccountCode: arLedger.code,
        contraAccountName: arLedger.name,
        amount: receiptAmount,
        paymentMode: receiptMode,
        partyType: 'customer',
        partyName: receiptBill.clientName || 'Customer',
        referenceNo: receiptBill.billNumber || receiptRef,
        narration: receiptNarration,
        status: 'posted',
        isReconciled: !depositAcc.name.toLowerCase().includes('bank'),
        journalId: newJournal.id,
        businessId,
        createdBy: userDisplayName || 'Accountant'
      };

      await saveCashBankTransaction(newTx, businessId);

      setIsReceiptModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setReceiptError(err.message || 'Failed to post customer receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const rows = customerAgingReport.map(c => ({
      'Customer Name': c.customerName,
      'Total Invoiced': c.totalInvoiced,
      'Total Received': c.totalPaid,
      'Balance Due': c.balanceDue,
      'Current (0-30 Days)': c.current,
      '31-60 Days': c.days31to60,
      '61-90 Days': c.days61to90,
      'Over 90 Days': c.over90
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer_Receivables_Aging');
    XLSX.writeFile(wb, `Customer_Receivables_Aging_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="customer-receivable-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ArrowDownRight className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Customer Receivables & Aging Ledger</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time customer billing statements, collection tracking, and 30-60-90+ days aging analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('aging')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'aging' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aging Analysis
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'invoices' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Invoices & Bills ({customerBills.length})
            </button>
          </div>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Billed Revenue</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">
            {currencySymbol}{overallTotals.invoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-slate-400 mt-1 block">Accumulated gross customer invoices</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Collected</span>
          <h3 className="text-2xl font-bold text-emerald-700 mt-1">
            {currencySymbol}{overallTotals.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-emerald-600/80 mt-1 block">Cleared cash & bank deposits</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Total Outstanding Receivables</span>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">
            {currencySymbol}{overallTotals.due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-rose-500 mt-1 block">Active credit exposure across all buyers</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Overdue (60+ Days)</span>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">
            {currencySymbol}{(overallTotals.days61to90 + overallTotals.over90).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-amber-600/80 mt-1 block">High risk aging bracket</span>
        </div>
      </div>

      {activeTab === 'aging' ? (
        /* AGING TABLE */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-800">Customer Wise Aging Breakdown</h3>
              <p className="text-xs text-slate-500">Categorization of receivables based on invoice maturity</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-6 py-3.5">Customer Name</th>
                  <th className="px-6 py-3.5 text-right">Invoiced</th>
                  <th className="px-6 py-3.5 text-right">Collected</th>
                  <th className="px-6 py-3.5 text-right font-bold text-slate-900">Balance Due</th>
                  <th className="px-6 py-3.5 text-right text-emerald-700">0 - 30 Days</th>
                  <th className="px-6 py-3.5 text-right text-blue-700">31 - 60 Days</th>
                  <th className="px-6 py-3.5 text-right text-amber-700">61 - 90 Days</th>
                  <th className="px-6 py-3.5 text-right text-rose-700">90+ Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerAgingReport.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400 text-sm">
                      No customer billing records available. Create bills in Sales Accounts or Bill Management.
                    </td>
                  </tr>
                ) : (
                  customerAgingReport.map(c => (
                    <tr key={c.customerId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{c.customerName}</td>
                      <td className="px-6 py-4 text-right font-mono">{currencySymbol}{c.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600">{currencySymbol}{c.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{currencySymbol}{c.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-700">{currencySymbol}{c.current.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono text-blue-700">{currencySymbol}{c.days31to60.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono text-amber-700">{currencySymbol}{c.days61to90.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">{currencySymbol}{c.over90.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-xs text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td className="px-6 py-3 uppercase">Total Portfolio:</td>
                  <td className="px-6 py-3 text-right font-mono">{currencySymbol}{overallTotals.invoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-3 text-right font-mono text-emerald-700">{currencySymbol}{overallTotals.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-3 text-right font-mono text-slate-900">{currencySymbol}{overallTotals.due.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-3 text-right font-mono text-emerald-800">{currencySymbol}{overallTotals.current.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-3 text-right font-mono text-blue-800">{currencySymbol}{overallTotals.days31to60.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-3 text-right font-mono text-amber-800">{currencySymbol}{overallTotals.days61to90.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-3 text-right font-mono text-rose-700">{currencySymbol}{overallTotals.over90.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* INVOICES & COLLECTIONS TABLE */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-6 py-3.5">Bill / Invoice No</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Customer Name</th>
                  <th className="px-6 py-3.5 text-right">Invoice Total</th>
                  <th className="px-6 py-3.5 text-right">Paid</th>
                  <th className="px-6 py-3.5 text-right">Due Balance</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerBills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400 text-sm">
                      No customer bills found.
                    </td>
                  </tr>
                ) : (
                  customerBills.map(bill => {
                    const total = Number(bill.totalAmount || bill.grandTotal || bill.amount || 0);
                    const paid = Number(bill.paidAmount || 0);
                    const due = total - paid;
                    const isPaid = due <= 0;

                    return (
                      <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {bill.billNumber || bill.id}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {bill.billDate || bill.createdAt?.slice(0, 10) || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-slate-800 font-medium">
                          {bill.clientName || bill.customerName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                          {currencySymbol}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-600">
                          {currencySymbol}{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">
                          {currencySymbol}{Math.max(0, due).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : paid > 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {isPaid ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DUE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {!isPaid && (
                            <button
                              onClick={() => handleOpenReceiptModal(bill)}
                              className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                            >
                              Receive Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECEIVE PAYMENT MODAL */}
      {isReceiptModalOpen && receiptBill && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Receive Customer Payment</h3>
                <p className="text-xs text-slate-500">Bill #{receiptBill.billNumber} • {receiptBill.clientName}</p>
              </div>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {receiptError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {receiptError}
              </div>
            )}

            <form onSubmit={handleSaveCustomerReceipt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={receiptAmount || ''}
                  onChange={(e) => setReceiptAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deposit To (Cash / Bank Account)</label>
                <select
                  value={receiptBankAccountId}
                  onChange={(e) => setReceiptBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                  required
                >
                  <option value="">-- Choose Account --</option>
                  {depositAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Channel</label>
                  <select
                    value={receiptMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="beftn">BEFTN</option>
                    <option value="cheque">Cheque</option>
                    <option value="rtgs">RTGS</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Narration / Remarks</label>
                <input
                  type="text"
                  value={receiptNarration}
                  onChange={(e) => setReceiptNarration(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Confirm & Post to GL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
