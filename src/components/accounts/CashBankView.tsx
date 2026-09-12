import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  Building2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft, 
  Plus, 
  Search, 
  Download, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  ShieldAlert, 
  X,
  CreditCard,
  FileCheck,
  Clock,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { 
  CashBankTransaction, 
  CashBankVoucherType, 
  CoaLedgerAccount, 
  JournalEntry 
} from '../../types/accounts';
import { 
  saveCashBankTransaction, 
  saveJournalEntry 
} from '../../services/accountsService';
import { 
  checkPageApprovalRule, 
  submitDocumentForApproval 
} from '../../services/approvalService';
import { doc, updateDoc, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import * as XLSX from 'xlsx';
import { ConfirmModal, ConfirmVariant } from '../ui/ConfirmModal';

interface CashBankViewProps {
  transactions: CashBankTransaction[];
  ledgers: CoaLedgerAccount[];
  businessId: string;
  userUid: string;
  userDisplayName: string;
  isSuperAdmin?: boolean;
  onRefresh: () => void;
  currencySymbol?: string;
}

export const CashBankView: React.FC<CashBankViewProps> = ({
  transactions = [],
  ledgers = [],
  businessId = 'default',
  userUid = '',
  userDisplayName = 'User',
  isSuperAdmin = false,
  onRefresh,
  currencySymbol = '$'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cash_book' | 'bank_book' | 'reconciliation' | 'new_transaction'>('cash_book');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('All');

  // New Transaction Form State
  const [voucherType, setVoucherType] = useState<CashBankVoucherType>('cash_receipt');
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedContraAccountId, setSelectedContraAccountId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'cheque' | 'beftn' | 'rtgs' | 'swift' | 'transfer'>('cash');
  const [chequeNo, setChequeNo] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>('');
  const [bankBranch, setBankBranch] = useState<string>('');
  const [partyType, setPartyType] = useState<'customer' | 'supplier' | 'employee' | 'other'>('customer');
  const [partyName, setPartyName] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmText?: string;
    variant: ConfirmVariant;
    showReasonInput?: boolean;
    onConfirm: (reason?: string) => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'approve',
    onConfirm: () => {},
  });

  // Segregate Cash and Bank COA Accounts
  const cashAccounts = useMemo(() => {
    return ledgers.filter(l => 
      l.status === 'active' && 
      (l.subCategoryId === 'sub-cash-equiv' || l.code.startsWith('1201')) &&
      !l.name.toLowerCase().includes('bank') &&
      !l.code.startsWith('120102')
    );
  }, [ledgers]);

  const bankAccounts = useMemo(() => {
    return ledgers.filter(l => 
      l.status === 'active' && 
      (l.subCategoryId === 'sub-cash-equiv' || l.code.startsWith('1201')) &&
      (l.name.toLowerCase().includes('bank') || l.code.startsWith('120102'))
    );
  }, [ledgers]);

  const allCashAndBankAccounts = useMemo(() => {
    return [...cashAccounts, ...bankAccounts];
  }, [cashAccounts, bankAccounts]);

  const otherLedgers = useMemo(() => {
    return ledgers.filter(l => l.status === 'active');
  }, [ledgers]);

  // Compute Balances
  const cashTotal = useMemo(() => {
    return cashAccounts.reduce((sum, acc) => {
      const txs = transactions.filter(t => t.accountId === acc.id || t.contraAccountId === acc.id);
      let bal = acc.openingBalance || 0;
      txs.forEach(t => {
        if (t.accountId === acc.id) {
          if (t.voucherType === 'cash_receipt' || t.voucherType === 'bank_receipt') bal += t.amount;
          else if (t.voucherType === 'cash_payment' || t.voucherType === 'bank_payment') bal -= t.amount;
        } else if (t.contraAccountId === acc.id) {
          if (t.voucherType === 'cash_transfer' || t.voucherType === 'bank_transfer') bal += t.amount;
        }
      });
      return sum + bal;
    }, 0);
  }, [cashAccounts, transactions]);

  const bankTotal = useMemo(() => {
    return bankAccounts.reduce((sum, acc) => {
      const txs = transactions.filter(t => t.accountId === acc.id || t.contraAccountId === acc.id);
      let bal = acc.openingBalance || 0;
      txs.forEach(t => {
        if (t.accountId === acc.id) {
          if (t.voucherType === 'cash_receipt' || t.voucherType === 'bank_receipt') bal += t.amount;
          else if (t.voucherType === 'cash_payment' || t.voucherType === 'bank_payment') bal -= t.amount;
        } else if (t.contraAccountId === acc.id) {
          if (t.voucherType === 'cash_transfer' || t.voucherType === 'bank_transfer') bal += t.amount;
        }
      });
      return sum + bal;
    }, 0);
  }, [bankAccounts, transactions]);

  // Handle Save Transaction & Auto-generate Journal
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !selectedContraAccountId || amount <= 0 || !narration.trim()) {
      setErrorMessage('Please fill in all required fields (Accounts, positive Amount, and Narration).');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const primaryAcc = ledgers.find(l => l.id === selectedAccountId);
      const contraAcc = ledgers.find(l => l.id === selectedContraAccountId);

      if (!primaryAcc || !contraAcc) {
        throw new Error('Selected accounts are invalid.');
      }

      const prefix = voucherType.startsWith('cash') ? 'CRV' : 'BPV';
      const voucherNo = `${prefix}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(transactions.length + 1).padStart(4, '0')}`;
      const now = new Date().toISOString();

      // 1. Determine Debit and Credit for the Journal Entry
      let debitAccountId = '';
      let debitAccountCode = '';
      let debitAccountName = '';
      let creditAccountId = '';
      let creditAccountCode = '';
      let creditAccountName = '';

      if (voucherType === 'cash_receipt' || voucherType === 'bank_receipt') {
        // Dr Cash/Bank, Cr Income/Receivable/Party
        debitAccountId = primaryAcc.id;
        debitAccountCode = primaryAcc.code;
        debitAccountName = primaryAcc.name;
        creditAccountId = contraAcc.id;
        creditAccountCode = contraAcc.code;
        creditAccountName = contraAcc.name;
      } else if (voucherType === 'cash_payment' || voucherType === 'bank_payment') {
        // Dr Expense/Payable/Party, Cr Cash/Bank
        debitAccountId = contraAcc.id;
        debitAccountCode = contraAcc.code;
        debitAccountName = contraAcc.name;
        creditAccountId = primaryAcc.id;
        creditAccountCode = primaryAcc.code;
        creditAccountName = primaryAcc.name;
      } else {
        // Contra Transfer: e.g. Dr Target Contra, Cr Source Primary
        debitAccountId = contraAcc.id;
        debitAccountCode = contraAcc.code;
        debitAccountName = contraAcc.name;
        creditAccountId = primaryAcc.id;
        creditAccountCode = primaryAcc.code;
        creditAccountName = primaryAcc.name;
      }

      // Check for approval rules on Cash / Bank transactions
      let finalStatus: 'posted' | 'pending_approval' = 'posted';
      let approvalNotice = '';
      let approvalResult: any = null;

      approvalResult = await checkPageApprovalRule(
        'accounts-cash-bank',
        businessId,
        { uid: userUid, displayName: userDisplayName, role: isSuperAdmin ? 'Admin' : 'User' },
        amount
      );

      if (approvalResult.required) {
        finalStatus = 'pending_approval';
        approvalNotice = `Voucher #${voucherNo} submitted for approval to ${approvalResult.approverName || 'Authorized Approver'}. Ledgers and Cash/Bank books will update upon approval.`;
      }

      // 2. Create and Save Journal Voucher
      const jvId = `jv_cb_${Date.now()}`;
      const cbDocId = `cb_${Date.now()}`;

      const newJournal: JournalEntry = {
        id: jvId,
        journalNo: `JV-${voucherNo}`,
        date: voucherDate,
        referenceNo: voucherNo,
        referenceType: 'cash_bank',
        narration: `[${voucherType.toUpperCase()}] ${narration} (Party: ${partyName || 'N/A'})`,
        lines: [
          {
            id: '1',
            accountId: debitAccountId,
            accountCode: debitAccountCode,
            accountName: debitAccountName,
            debit: amount,
            credit: 0,
            lineNarration: narration
          },
          {
            id: '2',
            accountId: creditAccountId,
            accountCode: creditAccountCode,
            accountName: creditAccountName,
            debit: 0,
            credit: amount,
            lineNarration: narration
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        costCenter: 'Head Office Accounts',
        preparedBy: userDisplayName || 'Accountant',
        postedBy: finalStatus === 'posted' ? (userDisplayName || 'Accountant') : '',
        postedDate: finalStatus === 'posted' ? voucherDate : '',
        status: finalStatus,
        isSystemGenerated: true,
        businessId
      };

      await saveJournalEntry(newJournal, businessId);

      // 3. Save Cash/Bank Transaction Record
      const newTx: CashBankTransaction = {
        id: cbDocId,
        voucherNo,
        voucherType,
        date: voucherDate,
        accountId: primaryAcc.id,
        accountCode: primaryAcc.code,
        accountName: primaryAcc.name,
        contraAccountId: contraAcc.id,
        contraAccountCode: contraAcc.code,
        contraAccountName: contraAcc.name,
        amount,
        paymentMode,
        chequeNo,
        chequeDate,
        bankBranch,
        partyType,
        partyName,
        referenceNo,
        narration,
        status: finalStatus,
        isReconciled: finalStatus === 'posted' && voucherType.startsWith('cash'), // Cash is immediately cleared when posted
        journalId: jvId,
        businessId,
        createdBy: userDisplayName || 'Accountant'
      };

      await saveCashBankTransaction(newTx, businessId);

      if (finalStatus === 'pending_approval' && approvalResult) {
        await submitDocumentForApproval(
          businessId,
          'accounts-cash-bank',
          'Accounts & Finance',
          'Cash / Bank Voucher',
          'cash_bank_transactions',
          cbDocId,
          `[${voucherType.toUpperCase()}] Voucher ${voucherNo} (${currencySymbol}${amount.toLocaleString()}) - ${partyName || narration}`,
          { uid: userUid, displayName: userDisplayName, email: userDisplayName } as any,
          approvalResult,
          amount
        );
        alert(approvalNotice);
      } else {
        alert(`Voucher #${voucherNo} posted successfully!`);
      }

      onRefresh();

      // Switch to register
      setActiveSubTab(voucherType.startsWith('cash') ? 'cash_book' : 'bank_book');
      setAmount(0);
      setNarration('');
      setPartyName('');
      setChequeNo('');
      setReferenceNo('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to save transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Approval with Confirmation Modal
  const triggerApproveTransaction = (tx: CashBankTransaction) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Voucher & Post to Ledger',
      message: `Are you sure you want to approve Voucher #${tx.voucherNo}?`,
      subMessage: `Amount: ${currencySymbol}${tx.amount.toLocaleString()} • Type: ${tx.voucherType.toUpperCase()} • Narration: ${tx.narration || 'N/A'}`,
      variant: 'approve',
      confirmText: 'Yes, Approve & Post',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          const now = new Date().toISOString();
          const today = now.split('T')[0];

          await updateDoc(doc(db, 'cash_bank_transactions', tx.id), {
            status: 'posted',
            approvedBy: userDisplayName || 'Approver',
            approvedDate: today,
            isReconciled: tx.voucherType.startsWith('cash'),
            updatedAt: now
          });

          if (tx.journalId) {
            try {
              await updateDoc(doc(db, 'journal_entries', tx.journalId), {
                status: 'posted',
                postedBy: userDisplayName || 'Approver',
                postedDate: today,
                postedAt: now,
                updatedAt: now
              });
            } catch (je) {
              console.warn('Could not update linked journal', je);
            }
          }

          // Mark linked approval request as approved if exists
          try {
            const q = query(
              collection(db, 'approvalRequests'),
              where('targetId', '==', tx.id),
              where('status', '==', 'pending')
            );
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await updateDoc(doc(db, 'approvalRequests', d.id), {
                status: 'approved',
                approvedAt: Timestamp.now(),
                approvedBy: userDisplayName
              });
            }
          } catch (e) {
            console.warn('Could not update approval request', e);
          }

          onRefresh();
        } catch (err: any) {
          console.error(err);
          setErrorMessage('Failed to approve transaction: ' + err.message);
        } finally {
          setIsSaving(false);
        }
      }
    });
  };

  // Trigger Rejection with Confirmation Modal
  const triggerRejectTransaction = (tx: CashBankTransaction) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Voucher Confirmation',
      message: `Are you sure you want to reject Voucher #${tx.voucherNo}?`,
      subMessage: `Amount: ${currencySymbol}${tx.amount.toLocaleString()} • Type: ${tx.voucherType.toUpperCase()}`,
      variant: 'reject',
      confirmText: 'Yes, Reject Voucher',
      showReasonInput: true,
      onConfirm: async (reason) => {
        setIsSaving(true);
        try {
          const now = new Date().toISOString();
          const finalReason = reason || 'Rejected by approver';

          await updateDoc(doc(db, 'cash_bank_transactions', tx.id), {
            status: 'rejected',
            rejectionReason: finalReason,
            updatedAt: now
          });

          if (tx.journalId) {
            try {
              await updateDoc(doc(db, 'journal_entries', tx.journalId), {
                status: 'rejected',
                rejectionReason: finalReason,
                updatedAt: now
              });
            } catch (je) {
              console.warn('Could not update linked journal', je);
            }
          }

          try {
            const q = query(
              collection(db, 'approvalRequests'),
              where('targetId', '==', tx.id),
              where('status', '==', 'pending')
            );
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await updateDoc(doc(db, 'approvalRequests', d.id), {
                status: 'rejected',
                rejectedAt: Timestamp.now(),
                rejectedBy: userDisplayName,
                rejectionReason: finalReason
              });
            }
          } catch (e) {
            console.warn('Could not update approval request', e);
          }

          onRefresh();
        } catch (err: any) {
          console.error(err);
          setErrorMessage('Failed to reject transaction: ' + err.message);
        } finally {
          setIsSaving(false);
        }
      }
    });
  };

  // Filter transactions
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      const isCash = t.voucherType.startsWith('cash');
      const isBank = t.voucherType.startsWith('bank') || t.voucherType === 'reconciliation';

      if (activeSubTab === 'cash_book' && !isCash) return false;
      if (activeSubTab === 'bank_book' && !isBank) return false;
      if (activeSubTab === 'reconciliation' && !isBank) return false;

      const matchSearch = !searchQuery ||
        t.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.partyName && t.partyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.chequeNo && t.chequeNo.includes(searchQuery));

      const matchAccount = selectedAccountFilter === 'All' || t.accountId === selectedAccountFilter || t.contraAccountId === selectedAccountFilter;

      return matchSearch && matchAccount;
    });
  }, [transactions, activeSubTab, searchQuery, selectedAccountFilter]);

  // Export Excel
  const handleExportExcel = () => {
    const rows = filteredTxs.map(t => ({
      'Voucher No': t.voucherNo,
      'Date': t.date,
      'Type': t.voucherType,
      'Account': t.accountName,
      'Contra Account': t.contraAccountName || '',
      'Amount': t.amount,
      'Payment Mode': t.paymentMode,
      'Party': t.partyName || '',
      'Cheque No': t.chequeNo || '',
      'Narration': t.narration,
      'Status': t.status,
      'Reconciled': t.isReconciled ? 'Yes' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash_Bank_Register');
    XLSX.writeFile(wb, `Cash_Bank_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="cash-bank-view" className="space-y-6">
      {/* Header & Quick Summary Cards */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cash & Bank Management</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Cash Book, Bank Book, Contra Transfers, and Bank Reconciliation with automated Double-Entry GL Posting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setVoucherType('cash_receipt');
              if (cashAccounts.length > 0) setSelectedAccountId(cashAccounts[0].id);
              setActiveSubTab('new_transaction');
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cash / Bank Voucher
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

      {/* 2 Big Position Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-100 text-xs font-semibold uppercase tracking-wider">
              <Wallet className="w-4 h-4" /> Total Cash in Hand
            </div>
            <div className="text-3xl font-extrabold mt-2 tracking-tight">
              {currencySymbol}{cashTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-blue-100 mt-2">
              {cashAccounts.length} Cash Ledger Accounts (Main & Petty Cash)
            </div>
          </div>
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs">
            <Wallet className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold uppercase tracking-wider">
              <Building2 className="w-4 h-4" /> Total Bank Balance
            </div>
            <div className="text-3xl font-extrabold mt-2 tracking-tight">
              {currencySymbol}{bankTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-100 mt-2">
              {bankAccounts.length} Active Corporate Bank Accounts
            </div>
          </div>
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs">
            <Building2 className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveSubTab('cash_book')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'cash_book' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Cash Book Register
        </button>

        <button
          onClick={() => setActiveSubTab('bank_book')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'bank_book' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Bank Book Register
        </button>

        <button
          onClick={() => setActiveSubTab('reconciliation')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'reconciliation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Bank Reconciliation
        </button>

        <button
          onClick={() => setActiveSubTab('new_transaction')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'new_transaction' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          New Transaction
        </button>
      </div>

      {activeSubTab === 'new_transaction' ? (
        /* CREATE CASH / BANK TRANSACTION FORM */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800">Record Cash / Bank Voucher</h3>
            <p className="text-xs text-slate-500">
              Receipts, payments, and contra transfers automatically generate balanced Journal Entries in the General Ledger.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSaveTransaction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Voucher Type</label>
                <select
                  value={voucherType}
                  onChange={(e) => setVoucherType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="cash_receipt">Cash Receipt (CRV) - Cash In</option>
                  <option value="cash_payment">Cash Payment (CPV) - Cash Out</option>
                  <option value="cash_transfer">Cash Transfer (Contra to Cash/Bank)</option>
                  <option value="bank_receipt">Bank Receipt (BRV) - Deposit / Inflow</option>
                  <option value="bank_payment">Bank Payment (BPV) - Cheque / Outflow</option>
                  <option value="bank_transfer">Bank Transfer (Inter-bank Contra)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Posting Date</label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="beftn">BEFTN</option>
                  <option value="rtgs">RTGS</option>
                  <option value="swift">SWIFT / Wire</option>
                  <option value="transfer">Internal Transfer</option>
                </select>
              </div>

              {/* Primary Account */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {voucherType.startsWith('cash') ? 'Cash Ledger Account' : 'Bank Ledger Account'} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="">-- Choose Account --</option>
                  {(voucherType.startsWith('cash') ? cashAccounts : bankAccounts).map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contra / Offset Account */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contra / Offset Account <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedContraAccountId}
                  onChange={(e) => setSelectedContraAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="">-- Select Offset Account --</option>
                  {otherLedgers.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} ({acc.accountType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount ({currencySymbol}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Cheque Details if Applicable */}
              {paymentMode === 'cheque' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cheque Number</label>
                    <input
                      type="text"
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      placeholder="e.g. CQ-998811"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cheque Date</label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Bank Branch</label>
                    <input
                      type="text"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      placeholder="e.g. Principal Branch, Dhaka"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Party Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Party Type</label>
                <select
                  value={partyType}
                  onChange={(e) => setPartyType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="employee">Employee / Staff</option>
                  <option value="other">Other Third Party</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Party Name</label>
                <input
                  type="text"
                  placeholder="e.g. H&M Buyer, Cotton Yarn Mill"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Bill / Money Receipt No</label>
                <input
                  type="text"
                  placeholder="e.g. MR-00129, INV-881"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Narration / Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Detailed description of transaction purpose"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveSubTab('cash_book')}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Processing...' : 'Post Voucher & Update Books'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* REGISTER TABLE (Cash / Bank / Reconciliation) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions by voucher no, narration, party or cheque..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <select
                value={selectedAccountFilter}
                onChange={(e) => setSelectedAccountFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Cash & Bank Accounts</option>
                {allCashAndBankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Voucher No</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Type & Account</th>
                    <th className="px-6 py-3.5">Party / Reference</th>
                    <th className="px-6 py-3.5">Narration</th>
                    <th className="px-6 py-3.5 text-right">Inflow ({currencySymbol})</th>
                    <th className="px-6 py-3.5 text-right">Outflow ({currencySymbol})</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTxs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No transactions recorded for this register. Click "+ Cash / Bank Voucher" to add an entry.
                      </td>
                    </tr>
                  ) : (
                    filteredTxs.map(tx => {
                      const isInflow = tx.voucherType === 'cash_receipt' || tx.voucherType === 'bank_receipt';
                      const isOutflow = tx.voucherType === 'cash_payment' || tx.voucherType === 'bank_payment';
                      const isPending = tx.status === 'pending_approval';

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{tx.voucherNo}</div>
                            <div className="text-[11px] text-slate-400">{tx.paymentMode.toUpperCase()}</div>
                          </td>

                          <td className="px-6 py-4 text-xs font-medium text-slate-600">
                            {tx.date}
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-xs font-bold text-slate-800">{tx.accountName}</div>
                            <div className="text-[11px] text-slate-500">Contra: {tx.contraAccountName}</div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-xs font-semibold text-slate-800">{tx.partyName || 'N/A'}</div>
                            {tx.chequeNo && (
                              <div className="text-[11px] text-blue-600 font-mono">CQ: {tx.chequeNo}</div>
                            )}
                          </td>

                          <td className="px-6 py-4 text-xs max-w-xs truncate text-slate-600" title={tx.narration}>
                            {tx.narration}
                          </td>

                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-700">
                            {isInflow ? tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>

                          <td className="px-6 py-4 text-right font-mono font-bold text-rose-700">
                            {isOutflow ? tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>

                          <td className="px-6 py-4 text-center">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Approval
                              </span>
                            ) : tx.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            ) : tx.isReconciled ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <FileCheck className="w-3.5 h-3.5" /> Posted
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-center">
                            {isPending ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => triggerApproveTransaction(tx)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors"
                                  title="Approve Voucher & Post to Ledger"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => triggerRejectTransaction(tx)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                                  title="Reject Voucher"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
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
        </div>
      )}
      {/* Approval Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        subMessage={confirmModal.subMessage}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        showReasonInput={confirmModal.showReasonInput}
      />
    </div>
  );
};
