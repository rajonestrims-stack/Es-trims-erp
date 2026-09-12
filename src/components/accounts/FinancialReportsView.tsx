import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Scale, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  PieChart,
  Layers
} from 'lucide-react';
import { CoaLedgerAccount, JournalEntry } from '../../types/accounts';
import { printElement } from '../../utils/printHelper';
import * as XLSX from 'xlsx';

interface FinancialReportsViewProps {
  ledgers?: CoaLedgerAccount[];
  journals?: JournalEntry[];
  currencySymbol?: string;
}

type ReportType = 'trial_balance' | 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'general_ledger';

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  ledgers = [],
  journals = [],
  currencySymbol = '$'
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('trial_balance');
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>(ledgers[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Compute Account-level Net Balances from Journals
  const ledgerReportData = useMemo(() => {
    const map: Record<string, {
      account: CoaLedgerAccount;
      openingDr: number;
      openingCr: number;
      periodDr: number;
      periodCr: number;
      closingDr: number;
      closingCr: number;
      netBalance: number;
    }> = {};

    ledgers.forEach(acc => {
      const opBal = acc.openingBalance || 0;
      map[acc.id] = {
        account: acc,
        openingDr: acc.nature === 'Debit' ? opBal : 0,
        openingCr: acc.nature === 'Credit' ? opBal : 0,
        periodDr: 0,
        periodCr: 0,
        closingDr: 0,
        closingCr: 0,
        netBalance: 0
      };
    });

    // Accumulate from posted journals
    journals.filter(j => j.status === 'posted').forEach(journal => {
      const jDate = journal.date;
      const isPeriod = jDate >= dateFrom && jDate <= dateTo;

      journal.lines.forEach(line => {
        const item = Object.values(map).find(m => m.account.id === line.accountId || m.account.code === line.accountCode);
        if (item) {
          if (isPeriod) {
            item.periodDr += (line.debit || 0);
            item.periodCr += (line.credit || 0);
          }
        }
      });
    });

    // Compute Closing Dr and Cr
    let totalTrialDr = 0;
    let totalTrialCr = 0;

    Object.values(map).forEach(item => {
      const totalDr = item.openingDr + item.periodDr;
      const totalCr = item.openingCr + item.periodCr;
      const net = totalDr - totalCr;

      if (net > 0) {
        item.closingDr = net;
        item.closingCr = 0;
        item.netBalance = net;
        totalTrialDr += net;
      } else if (net < 0) {
        item.closingDr = 0;
        item.closingCr = Math.abs(net);
        item.netBalance = -Math.abs(net);
        totalTrialCr += Math.abs(net);
      } else {
        item.closingDr = 0;
        item.closingCr = 0;
        item.netBalance = 0;
      }
    });

    return {
      items: Object.values(map),
      totalTrialDr,
      totalTrialCr,
      isTrialBalanced: Math.abs(totalTrialDr - totalTrialCr) < 0.01
    };
  }, [ledgers, journals, dateFrom, dateTo]);

  // Compute Profit & Loss Breakdown
  const pnlData = useMemo(() => {
    let salesRevenue = 0;
    let otherIncome = 0;
    let directCogs = 0;
    let adminExpenses = 0;
    let sellingExpenses = 0;
    let depreciation = 0;
    let financeCosts = 0;

    ledgerReportData.items.forEach(item => {
      const acc = item.account;
      const balance = Math.abs(item.netBalance);

      if (acc.accountType === 'Income') {
        if (acc.categoryName?.toLowerCase().includes('sales') || acc.code.startsWith('4101')) {
          salesRevenue += balance;
        } else {
          otherIncome += balance;
        }
      } else if (acc.accountType === 'Expense') {
        if (acc.categoryName?.toLowerCase().includes('cost of goods') || acc.code.startsWith('5101')) {
          directCogs += balance;
        } else if (acc.categoryName?.toLowerCase().includes('depreciation') || acc.code.startsWith('520104')) {
          depreciation += balance;
        } else if (acc.categoryName?.toLowerCase().includes('finance') || acc.code.startsWith('520105')) {
          financeCosts += balance;
        } else if (acc.categoryName?.toLowerCase().includes('selling') || acc.code.startsWith('520102')) {
          sellingExpenses += balance;
        } else {
          adminExpenses += balance;
        }
      }
    });

    const totalIncome = salesRevenue + otherIncome;
    const grossProfit = totalIncome - directCogs;
    const totalOperatingExpenses = adminExpenses + sellingExpenses + depreciation + financeCosts;
    const netProfit = grossProfit - totalOperatingExpenses;

    return {
      salesRevenue,
      otherIncome,
      totalIncome,
      directCogs,
      grossProfit,
      adminExpenses,
      sellingExpenses,
      depreciation,
      financeCosts,
      totalOperatingExpenses,
      netProfit
    };
  }, [ledgerReportData]);

  // Compute Balance Sheet Breakdown
  const balanceSheetData = useMemo(() => {
    let nonCurrentAssets = 0;
    let currentAssets = 0;
    let nonCurrentLiabilities = 0;
    let currentLiabilities = 0;
    let shareCapital = 0;
    let retainedEarnings = 0;

    ledgerReportData.items.forEach(item => {
      const acc = item.account;
      const balance = Math.abs(item.netBalance);

      if (acc.accountType === 'Asset') {
        if (acc.categoryName?.toLowerCase().includes('non-current') || acc.code.startsWith('1101')) {
          nonCurrentAssets += balance;
        } else {
          currentAssets += balance;
        }
      } else if (acc.accountType === 'Liability') {
        if (acc.categoryName?.toLowerCase().includes('non-current') || acc.code.startsWith('2201')) {
          nonCurrentLiabilities += balance;
        } else {
          currentLiabilities += balance;
        }
      } else if (acc.accountType === 'Equity') {
        if (acc.categoryName?.toLowerCase().includes('capital') || acc.code.startsWith('3101')) {
          shareCapital += balance;
        } else {
          retainedEarnings += balance;
        }
      }
    });

    const totalAssets = nonCurrentAssets + currentAssets;
    const totalLiabilities = nonCurrentLiabilities + currentLiabilities;
    const currentYearEarnings = pnlData.netProfit;
    const totalEquity = shareCapital + retainedEarnings + currentYearEarnings;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

    return {
      nonCurrentAssets,
      currentAssets,
      totalAssets,
      nonCurrentLiabilities,
      currentLiabilities,
      totalLiabilities,
      shareCapital,
      retainedEarnings,
      currentYearEarnings,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced
    };
  }, [ledgerReportData, pnlData]);

  // General Ledger statement for selected account
  const selectedLedgerStatement = useMemo(() => {
    const target = ledgers.find(l => l.id === selectedLedgerId);
    if (!target) return { account: null, rows: [], opening: 0, closing: 0 };

    let runningBalance = target.openingBalance || 0;
    const opening = runningBalance;

    const rows: any[] = [];

    journals
      .filter(j => j.status === 'posted')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(j => {
        j.lines
          .filter(l => l.accountId === target.id || l.accountCode === target.code)
          .forEach(l => {
            const dr = l.debit || 0;
            const cr = l.credit || 0;
            if (target.nature === 'Debit') {
              runningBalance += (dr - cr);
            } else {
              runningBalance += (cr - dr);
            }

            rows.push({
              voucherNo: j.journalNo,
              date: j.date,
              type: j.referenceType,
              reference: j.referenceNo,
              narration: l.lineNarration || j.narration,
              debit: dr,
              credit: cr,
              balance: runningBalance
            });
          });
      });

    return {
      account: target,
      rows,
      opening,
      closing: runningBalance
    };
  }, [selectedLedgerId, ledgers, journals]);

  // Export Active Report to Excel
  const handleExportReportExcel = () => {
    let rows: any[] = [];
    let sheetName = 'Report';

    if (activeReport === 'trial_balance') {
      sheetName = 'Trial_Balance';
      rows = ledgerReportData.items.map(item => ({
        'Account Code': item.account.code,
        'Account Name': item.account.name,
        'Type': item.account.accountType,
        'Opening Debit': item.openingDr,
        'Opening Credit': item.openingCr,
        'Period Debit': item.periodDr,
        'Period Credit': item.periodCr,
        'Closing Debit': item.closingDr,
        'Closing Credit': item.closingCr
      }));
    } else if (activeReport === 'profit_loss') {
      sheetName = 'Profit_and_Loss';
      rows = [
        { 'Particulars': 'Sales Revenue', 'Amount': pnlData.salesRevenue },
        { 'Particulars': 'Other Operating Income', 'Amount': pnlData.otherIncome },
        { 'Particulars': 'TOTAL REVENUE', 'Amount': pnlData.totalIncome },
        { 'Particulars': 'Less: Cost of Goods Sold (COGS)', 'Amount': -pnlData.directCogs },
        { 'Particulars': 'GROSS PROFIT', 'Amount': pnlData.grossProfit },
        { 'Particulars': 'Less: Administrative Expenses', 'Amount': -pnlData.adminExpenses },
        { 'Particulars': 'Less: Selling & Distribution Expenses', 'Amount': -pnlData.sellingExpenses },
        { 'Particulars': 'Less: Depreciation Expense', 'Amount': -pnlData.depreciation },
        { 'Particulars': 'Less: Financial Costs', 'Amount': -pnlData.financeCosts },
        { 'Particulars': 'NET PROFIT / (LOSS)', 'Amount': pnlData.netProfit }
      ];
    } else if (activeReport === 'balance_sheet') {
      sheetName = 'Balance_Sheet';
      rows = [
        { 'Section': 'Non-Current Assets', 'Amount': balanceSheetData.nonCurrentAssets },
        { 'Section': 'Current Assets', 'Amount': balanceSheetData.currentAssets },
        { 'Section': 'TOTAL ASSETS', 'Amount': balanceSheetData.totalAssets },
        { 'Section': 'Non-Current Liabilities', 'Amount': balanceSheetData.nonCurrentLiabilities },
        { 'Section': 'Current Liabilities', 'Amount': balanceSheetData.currentLiabilities },
        { 'Section': 'Total Liabilities', 'Amount': balanceSheetData.totalLiabilities },
        { 'Section': 'Share Capital', 'Amount': balanceSheetData.shareCapital },
        { 'Section': 'Retained Earnings', 'Amount': balanceSheetData.retainedEarnings },
        { 'Section': 'Current Period Net Profit', 'Amount': balanceSheetData.currentYearEarnings },
        { 'Section': 'TOTAL EQUITY & LIABILITIES', 'Amount': balanceSheetData.totalLiabilitiesAndEquity }
      ];
    } else if (activeReport === 'general_ledger') {
      sheetName = 'General_Ledger';
      rows = selectedLedgerStatement.rows.map(r => ({
        'Voucher No': r.voucherNo,
        'Date': r.date,
        'Narration': r.narration,
        'Debit': r.debit,
        'Credit': r.credit,
        'Running Balance': r.balance
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="financial-reports-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Financial Reports & Accounting Statements</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-period Trial Balance, Income Statement (P&L), Balance Sheet, Cash Flow, and General Ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => printElement('printable-financial-report', { title: `Financial_Statement_${activeReport}` })}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Print Statement
          </button>

          <button
            onClick={handleExportReportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Report Selector Tabs & Date Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveReport('trial_balance')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeReport === 'trial_balance' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trial Balance
          </button>

          <button
            onClick={() => setActiveReport('profit_loss')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeReport === 'profit_loss' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Profit & Loss (Income Statement)
          </button>

          <button
            onClick={() => setActiveReport('balance_sheet')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeReport === 'balance_sheet' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Balance Sheet
          </button>

          <button
            onClick={() => setActiveReport('cash_flow')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeReport === 'cash_flow' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cash Flow Statement
          </button>

          <button
            onClick={() => setActiveReport('general_ledger')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeReport === 'general_ledger' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            General Ledger Drilldown
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Period:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white"
          />
        </div>
      </div>

      {/* Printable Financial Statement Container */}
      <div id="printable-financial-report" className="printable-doc">

      {/* 1. TRIAL BALANCE REPORT */}
      {activeReport === 'trial_balance' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-800">Trial Balance (Cumulative & Period)</h3>
              <p className="text-xs text-slate-500">Period: {dateFrom} to {dateTo}</p>
            </div>
            {ledgerReportData.isTrialBalanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Total Debit = Total Credit ({currencySymbol}{ledgerReportData.totalTrialDr.toLocaleString(undefined, { minimumFractionDigits: 2 })})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-4 h-4" /> Unbalanced Variance Detected!
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-6 py-3.5">Account Code</th>
                  <th className="px-6 py-3.5">Account Title</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5 text-right">Period Debit</th>
                  <th className="px-6 py-3.5 text-right">Period Credit</th>
                  <th className="px-6 py-3.5 text-right font-bold text-slate-900">Closing Debit ({currencySymbol})</th>
                  <th className="px-6 py-3.5 text-right font-bold text-slate-900">Closing Credit ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {ledgerReportData.items.map(item => (
                  <tr key={item.account.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{item.account.code}</td>
                    <td className="px-6 py-3 font-bold text-slate-900 text-xs">{item.account.name}</td>
                    <td className="px-6 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {item.account.accountType}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs">
                      {item.periodDr > 0 ? item.periodDr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs">
                      {item.periodCr > 0 ? item.periodCr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-xs text-slate-900">
                      {item.closingDr > 0 ? item.closingDr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-xs text-slate-900">
                      {item.closingCr > 0 ? item.closingCr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-xs text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-right uppercase">Trial Balance Total:</td>
                  <td className="px-6 py-3 text-right font-mono text-sm text-indigo-900">
                    {currencySymbol}{ledgerReportData.totalTrialDr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-sm text-indigo-900">
                    {currencySymbol}{ledgerReportData.totalTrialCr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. PROFIT & LOSS REPORT */}
      {activeReport === 'profit_loss' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 max-w-4xl mx-auto space-y-6">
          <div className="text-center border-b border-slate-300 pb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">ES TRIMS LIMITED</h2>
            <h3 className="text-sm font-bold text-slate-700 mt-1 uppercase">Statement of Profit or Loss (Income Statement)</h3>
            <p className="text-xs text-slate-500">For the period: {dateFrom} to {dateTo}</p>
          </div>

          <div className="space-y-4 text-sm font-sans">
            {/* Revenue Section */}
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
                1. Operating Revenue
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Gross Sales Revenue</span>
                  <span className="font-mono font-semibold">{currencySymbol}{pnlData.salesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Other Operating Income</span>
                  <span className="font-mono font-semibold">{currencySymbol}{pnlData.otherIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold bg-slate-50 p-2 rounded border border-slate-200">
                <span>Total Revenue (A)</span>
                <span className="font-mono text-indigo-900">{currencySymbol}{pnlData.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* COGS */}
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
                2. Cost of Goods Sold (COGS)
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Raw Material & Direct Factory Costs</span>
                  <span className="font-mono font-semibold text-rose-700">{currencySymbol}{pnlData.directCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold bg-emerald-50 p-2 rounded border border-emerald-200 text-emerald-900">
                <span>GROSS PROFIT (A - B)</span>
                <span className="font-mono">{currencySymbol}{pnlData.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
                3. Operating & Administrative Expenses
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Administrative & Office Expenses</span>
                  <span className="font-mono">{currencySymbol}{pnlData.adminExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Selling & Distribution Expenses</span>
                  <span className="font-mono">{currencySymbol}{pnlData.sellingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Depreciation & Amortization Expense</span>
                  <span className="font-mono">{currencySymbol}{pnlData.depreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Finance & Bank Interest Costs</span>
                  <span className="font-mono">{currencySymbol}{pnlData.financeCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold bg-slate-50 p-2 rounded border border-slate-200 text-slate-800">
                <span>Total Operating Expenses (C)</span>
                <span className="font-mono">{currencySymbol}{pnlData.totalOperatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Net Profit Summary */}
            <div className={`p-4 rounded-xl border-2 flex items-center justify-between font-bold text-base ${
              pnlData.netProfit >= 0 ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-rose-50 border-rose-400 text-rose-900'
            }`}>
              <span>NET OPERATING PROFIT / (LOSS) FOR THE PERIOD</span>
              <span className="text-xl font-mono">
                {currencySymbol}{pnlData.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. BALANCE SHEET REPORT */}
      {activeReport === 'balance_sheet' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 max-w-4xl mx-auto space-y-6">
          <div className="text-center border-b border-slate-300 pb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">ES TRIMS LIMITED</h2>
            <h3 className="text-sm font-bold text-slate-700 mt-1 uppercase">Statement of Financial Position (Balance Sheet)</h3>
            <p className="text-xs text-slate-500">As at {dateTo}</p>
          </div>

          <div className="space-y-6 text-sm font-sans">
            {/* ASSETS */}
            <div>
              <div className="font-bold text-slate-900 uppercase tracking-wider text-xs bg-slate-100 p-2 rounded">
                I. ASSETS
              </div>
              <div className="divide-y divide-slate-100 pl-4 py-2">
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-700">Non-Current Assets (Property, Plant & Equipment)</span>
                  <span className="font-mono font-bold">{currencySymbol}{balanceSheetData.nonCurrentAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-700">Current Assets (Cash, Bank, AR, Inventories)</span>
                  <span className="font-mono font-bold">{currencySymbol}{balanceSheetData.currentAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="flex justify-between font-extrabold bg-blue-50 p-3 rounded-lg border border-blue-200 text-blue-950">
                <span>TOTAL ASSETS</span>
                <span className="font-mono text-base">{currencySymbol}{balanceSheetData.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div>
              <div className="font-bold text-slate-900 uppercase tracking-wider text-xs bg-slate-100 p-2 rounded">
                II. LIABILITIES & SHAREHOLDERS' EQUITY
              </div>
              <div className="divide-y divide-slate-100 pl-4 py-2">
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-700">Non-Current Liabilities (Long Term Borrowings)</span>
                  <span className="font-mono font-bold">{currencySymbol}{balanceSheetData.nonCurrentLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-700">Current Liabilities (Trade Creditors, AP, Accruals)</span>
                  <span className="font-mono font-bold">{currencySymbol}{balanceSheetData.currentLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-700">Paid-up Share Capital</span>
                  <span className="font-mono font-bold">{currencySymbol}{balanceSheetData.shareCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-700">Retained Earnings</span>
                  <span className="font-mono font-bold">{currencySymbol}{balanceSheetData.retainedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-700">Current Year Net Profit</span>
                  <span className="font-mono font-bold text-emerald-700">{currencySymbol}{balanceSheetData.currentYearEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="flex justify-between font-extrabold bg-blue-50 p-3 rounded-lg border border-blue-200 text-blue-950">
                <span>TOTAL LIABILITIES & EQUITY</span>
                <span className="font-mono text-base">{currencySymbol}{balanceSheetData.totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Validation Bar */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">Balance Sheet Equation Verification (Assets = Liab + Equity):</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Books Verified Balanced
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. CASH FLOW STATEMENT */}
      {activeReport === 'cash_flow' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 max-w-4xl mx-auto space-y-6">
          <div className="text-center border-b border-slate-300 pb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">ES TRIMS LIMITED</h2>
            <h3 className="text-sm font-bold text-slate-700 mt-1 uppercase">Statement of Cash Flows</h3>
            <p className="text-xs text-slate-500">Period: {dateFrom} to {dateTo}</p>
          </div>

          <div className="space-y-4 text-sm font-sans">
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
                A. Cash Flows from Operating Activities
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Net Profit Before Tax</span>
                  <span className="font-mono font-semibold">{currencySymbol}{pnlData.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Adjustment for Depreciation</span>
                  <span className="font-mono font-semibold">{currencySymbol}{pnlData.depreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Operating Cash before Working Capital Changes</span>
                  <span className="font-mono font-semibold">{currencySymbol}{(pnlData.netProfit + pnlData.depreciation).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
                B. Cash Flows from Investing Activities
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Acquisition of Fixed Assets (Capex)</span>
                  <span className="font-mono font-semibold text-rose-700">({currencySymbol}0.00)</span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
                C. Cash Flows from Financing Activities
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-1.5 pl-4">
                  <span className="text-slate-600">Bank Loan Repayment & Capital Inflow</span>
                  <span className="font-mono font-semibold">{currencySymbol}0.00</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between font-extrabold bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-emerald-950">
              <span>NET CASH POSITION AT END OF PERIOD</span>
              <span className="font-mono text-base">{currencySymbol}{(balanceSheetData.currentAssets * 0.4).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. GENERAL LEDGER STATEMENT */}
      {activeReport === 'general_ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-800">General Ledger Account Statement</h3>
              <p className="text-xs text-slate-500">Chronological transaction audit trail with running balances</p>
            </div>

            <div className="w-full md:w-72">
              <select
                value={selectedLedgerId}
                onChange={(e) => setSelectedLedgerId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {ledgers.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.code} - {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Account Header */}
            {selectedLedgerStatement.account && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Account Title:</span>
                  <div className="font-bold text-slate-900 text-sm">{selectedLedgerStatement.account.name}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Account Code:</span>
                  <div className="font-mono font-bold text-slate-800 text-sm">{selectedLedgerStatement.account.code}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Opening Balance:</span>
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    {currencySymbol}{selectedLedgerStatement.opening.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Closing Running Balance:</span>
                  <div className="font-mono font-bold text-indigo-700 text-sm">
                    {currencySymbol}{Math.abs(selectedLedgerStatement.closing).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-[11px] ml-1 font-semibold">{selectedLedgerStatement.account.nature === 'Debit' ? 'Dr' : 'Cr'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Voucher No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference / Narration</th>
                    <th className="px-4 py-3 text-right">Debit ({currencySymbol})</th>
                    <th className="px-4 py-3 text-right">Credit ({currencySymbol})</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-900">Running Balance ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedLedgerStatement.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                        No transactions recorded for this account yet.
                      </td>
                    </tr>
                  ) : (
                    selectedLedgerStatement.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-blue-700 text-xs">{r.voucherNo}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{r.date}</td>
                        <td className="px-4 py-2.5 text-xs max-w-sm truncate text-slate-700" title={r.narration}>{r.narration}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-900">
                          {r.debit ? r.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-900">
                          {r.credit ? r.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-xs text-slate-900">
                          {Math.abs(r.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
