import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  TrendingUp, 
  Search, 
  Download, 
  Printer, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Plus, 
  FileText, 
  ShieldAlert, 
  Truck, 
  Receipt, 
  DollarSign, 
  X 
} from 'lucide-react';
import { CoaLedgerAccount, JournalEntry } from '../../types/accounts';
import { CustomerBill } from '../../types';
import { saveJournalEntry } from '../../services/accountsService';
import * as XLSX from 'xlsx';

interface SalesAccountsViewProps {
  customerBills?: CustomerBill[];
  ledgers?: CoaLedgerAccount[];
  journals?: JournalEntry[];
  businessId: string;
  userDisplayName: string;
  onRefresh: () => void;
  currencySymbol?: string;
}

export const SalesAccountsView: React.FC<SalesAccountsViewProps> = ({
  customerBills = [],
  ledgers = [],
  journals = [],
  businessId = 'default',
  userDisplayName = 'User',
  onRefresh,
  currencySymbol = '$'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Manual Sales Billing Form State
  const [invoiceNo, setInvoiceNo] = useState(`INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [salesAccountId, setSalesAccountId] = useState('');
  const [receivableAccountId, setReceivableAccountId] = useState('');
  const [salesAmount, setSalesAmount] = useState<number>(0);
  const [vatAmount, setVatAmount] = useState<number>(0);
  const [narration, setNarration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // COA Sales Accounts
  const salesRevenueAccounts = useMemo(() => {
    return ledgers.filter(l => 
      l.status === 'active' && 
      (l.accountType === 'Income' || l.code.startsWith('4101'))
    );
  }, [ledgers]);

  // COA Receivable Accounts
  const receivableAccounts = useMemo(() => {
    return ledgers.filter(l => 
      l.status === 'active' && 
      (l.subCategoryId === 'sub-acc-receivable' || l.code.startsWith('1202'))
    );
  }, [ledgers]);

  // Compute Total Sales Metrics
  const totalSalesRevenue = useMemo(() => {
    return customerBills.reduce((sum, b) => sum + Number(b.totalAmount || b.grandTotal || b.amount || 0), 0);
  }, [customerBills]);

  const totalCollected = useMemo(() => {
    return customerBills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0);
  }, [customerBills]);

  const totalPendingReceivable = totalSalesRevenue - totalCollected;

  // Post Direct Sales Invoice to Accounting Ledger
  const handleCreateSalesInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || salesAmount <= 0 || !salesAccountId || !receivableAccountId) {
      setFormError('Please select both Sales and Receivable accounts, and enter valid amount.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const salesAcc = ledgers.find(l => l.id === salesAccountId);
      const recAcc = ledgers.find(l => l.id === receivableAccountId);

      if (!salesAcc || !recAcc) {
        throw new Error('Selected accounts are invalid.');
      }

      const grossReceivable = salesAmount + vatAmount;
      const jvNo = `JV-SALES-${Date.now().toString().slice(-4)}`;

      // Double-entry lines:
      // Dr Customer Receivable (Gross = Sales + VAT)
      // Cr Sales Revenue (Net Sales)
      // Cr VAT Output Payable (if VAT > 0)
      const lines = [
        {
          id: '1',
          accountId: recAcc.id,
          accountCode: recAcc.code,
          accountName: `${recAcc.name} - ${customerName}`,
          debit: grossReceivable,
          credit: 0,
          lineNarration: `Invoice #${invoiceNo} billed to ${customerName}`
        },
        {
          id: '2',
          accountId: salesAcc.id,
          accountCode: salesAcc.code,
          accountName: salesAcc.name,
          debit: 0,
          credit: salesAmount,
          lineNarration: `Revenue recognition for Invoice #${invoiceNo}`
        }
      ];

      if (vatAmount > 0) {
        const vatAcc = ledgers.find(l => l.code === '210201000001') || salesAcc;
        lines.push({
          id: '3',
          accountId: vatAcc.id,
          accountCode: vatAcc.code,
          accountName: 'VAT & Tax Output Payable',
          debit: 0,
          credit: vatAmount,
          lineNarration: `VAT on Invoice #${invoiceNo}`
        });
      }

      const newJournal: JournalEntry = {
        id: `jv_sales_${Date.now()}`,
        journalNo: jvNo,
        date: invoiceDate,
        referenceNo: invoiceNo,
        referenceType: 'sales',
        narration: narration || `Sales Invoice #${invoiceNo} to ${customerName} (Challan: ${challanNo || 'N/A'})`,
        lines,
        totalDebit: grossReceivable,
        totalCredit: grossReceivable,
        costCenter: 'Sales Revenue Unit',
        preparedBy: userDisplayName || 'Sales Accountant',
        postedBy: userDisplayName || 'Sales Accountant',
        postedDate: invoiceDate,
        status: 'posted',
        isSystemGenerated: true,
        businessId
      };

      await saveJournalEntry(newJournal, businessId);

      setIsInvoiceModalOpen(false);
      setCustomerName('');
      setSalesAmount(0);
      setVatAmount(0);
      setOrderNo('');
      setChallanNo('');
      setNarration('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to post sales invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const rows = customerBills.map(b => ({
      'Bill / Invoice No': b.billNumber || b.id,
      'Date': b.billDate || b.createdAt || '',
      'Customer': b.clientName || b.customerName || '',
      'Total Amount': b.totalAmount || b.grandTotal || b.amount || 0,
      'Paid': b.paidAmount || 0,
      'Due': (b.totalAmount || b.grandTotal || b.amount || 0) - (b.paidAmount || 0),
      'Status': b.status || 'Active'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales_Accounts_Summary');
    XLSX.writeFile(wb, `Sales_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="sales-accounts-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Sales Accounts & Revenue Integration</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            End-to-end accounting pipeline: <strong>Order</strong> → <strong>Work Order</strong> → <strong>Delivery Challan</strong> → <strong>Customer Bill</strong> → <strong>Accounts Receivable</strong> → <strong>GL Journal</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (salesRevenueAccounts.length > 0) setSalesAccountId(salesRevenueAccounts[0].id);
              if (receivableAccounts.length > 0) setReceivableAccountId(receivableAccounts[0].id);
              setIsInvoiceModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Post Sales Invoice to GL
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

      {/* Lifecycle Flow Visual Diagram */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">ERP Sales-To-Cash Lifecycle Mapping</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 block">1. Customer Order</span>
            <span className="text-xs font-semibold text-slate-800">PO Logged</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 block">2. Work Order</span>
            <span className="text-xs font-semibold text-slate-800">Factory Job Card</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 block">3. Delivery Challan</span>
            <span className="text-xs font-semibold text-slate-800">Goods Dispatched</span>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-center">
            <span className="text-[11px] font-bold text-blue-600 block">4. Sales Billing</span>
            <span className="text-xs font-bold text-blue-900">Dr AR / Cr Sales</span>
          </div>

          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center">
            <span className="text-[11px] font-bold text-emerald-600 block">5. Bank Receipt</span>
            <span className="text-xs font-bold text-emerald-900">Dr Bank / Cr AR</span>
          </div>

          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 text-center">
            <span className="text-[11px] font-bold text-indigo-600 block">6. Profit & Loss</span>
            <span className="text-xs font-bold text-indigo-900">Financial Reports</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gross Invoiced Revenue</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">
            {currencySymbol}{totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-slate-400 mt-1 block">Accumulated total sales across all orders</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Collected Cash & Bank</span>
          <h3 className="text-2xl font-bold text-emerald-700 mt-1">
            {currencySymbol}{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-emerald-600/80 mt-1 block">Deposited into corporate bank accounts</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Pending Customer Receivable</span>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">
            {currencySymbol}{Math.max(0, totalPendingReceivable).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-rose-500 mt-1 block">Outstanding invoices awaiting buyer clearance</span>
        </div>
      </div>

      {/* Sales Invoices Register */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Sales Invoices & Accounting Registry</h3>
            <p className="text-xs text-slate-500">Integrated sales invoices synchronized with commercial deliveries</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Invoice / Bill No</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Buyer / Client</th>
                <th className="px-6 py-3.5 text-right">Invoice Amount</th>
                <th className="px-6 py-3.5 text-right">Settled Amount</th>
                <th className="px-6 py-3.5 text-right font-bold text-slate-900">Due Receivable</th>
                <th className="px-6 py-3.5 text-center">GL Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No sales invoices found. Click "+ Post Sales Invoice to GL" to record an invoice.
                  </td>
                </tr>
              ) : (
                customerBills.map(bill => {
                  const total = Number(bill.totalAmount || bill.grandTotal || bill.amount || 0);
                  const paid = Number(bill.paidAmount || 0);
                  const due = total - paid;

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{bill.billNumber || bill.id}</td>
                      <td className="px-6 py-4 text-xs text-slate-600">{bill.billDate || bill.createdAt?.slice(0, 10) || 'N/A'}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{bill.clientName || bill.customerName || 'N/A'}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{currencySymbol}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600">{currencySymbol}{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">{currencySymbol}{Math.max(0, due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> POSTED
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POST SALES INVOICE MODAL */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Post Sales Invoice to GL</h3>
                <p className="text-xs text-slate-500">Creates balanced double-entry: Dr Accounts Receivable, Cr Sales Revenue</p>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSalesInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Invoice No <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Buyer Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. H&M / Inditex / Local Buyer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Order / PO Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. ORD-1029"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Challan No</label>
                  <input
                    type="text"
                    placeholder="e.g. DC-9988"
                    value={challanNo}
                    onChange={(e) => setChallanNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Accounts Receivable Ledger</label>
                  <select
                    value={receivableAccountId}
                    onChange={(e) => setReceivableAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    <option value="">-- Choose Receivable --</option>
                    {receivableAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sales Revenue Ledger</label>
                  <select
                    value={salesAccountId}
                    onChange={(e) => setSalesAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    <option value="">-- Choose Revenue Account --</option>
                    {salesRevenueAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Net Sales Amount ({currencySymbol}) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={salesAmount || ''}
                    onChange={(e) => setSalesAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">VAT / Tax Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={vatAmount || ''}
                    onChange={(e) => setVatAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Narration / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Sales of printed labels and woven elastic against PO #ORD-1029"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post Sales Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
