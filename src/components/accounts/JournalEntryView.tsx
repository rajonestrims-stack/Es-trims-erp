import React, { useState, useMemo } from 'react';
import { printElement } from '../../utils/printHelper';
import { 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Printer, 
  Download, 
  Search, 
  Filter, 
  RotateCcw, 
  FileText, 
  Paperclip, 
  Calendar, 
  ShieldAlert, 
  Eye, 
  X,
  Lock,
  ArrowRightLeft,
  Clock,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { 
  JournalEntry, 
  JournalEntryLine, 
  CoaLedgerAccount, 
  JournalReferenceType 
} from '../../types/accounts';
import { 
  saveJournalEntry, 
  reverseJournalEntry 
} from '../../services/accountsService';
import { 
  checkPageApprovalRule, 
  submitDocumentForApproval 
} from '../../services/approvalService';
import { db } from '../../firebase';
import { doc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { ConfirmModal, ConfirmVariant } from '../ui/ConfirmModal';

interface JournalEntryViewProps {
  journals: JournalEntry[];
  ledgers: CoaLedgerAccount[];
  businessId: string;
  userUid: string;
  userDisplayName: string;
  isSuperAdmin: boolean;
  onRefresh: () => void;
  currencySymbol?: string;
}

export const JournalEntryView: React.FC<JournalEntryViewProps> = ({
  journals = [],
  ledgers = [],
  businessId = 'default',
  userUid = '',
  userDisplayName = 'User',
  isSuperAdmin = false,
  onRefresh,
  currencySymbol = '$'
}) => {
  const [activeTab, setActiveTab] = useState<'register' | 'create'>('register');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'posted' | 'draft' | 'pending_approval' | 'rejected' | 'reversed'>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);

  // Form State for Creating Journal Voucher
  const [journalNo, setJournalNo] = useState<string>(`JV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(journals.length + 1).padStart(4, '0')}`);
  const [journalDate, setJournalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [referenceType, setReferenceType] = useState<JournalReferenceType>('manual');
  const [costCenter, setCostCenter] = useState<string>('Factory Head Office');
  const [narration, setNarration] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');

  // Multi-line entries
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { id: '1', accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0, costCenter: '', lineNarration: '' },
    { id: '2', accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0, costCenter: '', lineNarration: '' }
  ]);

  const [isPosting, setIsPosting] = useState(false);
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
  const [formError, setFormError] = useState('');

  // Reversal Modal
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [journalToReverse, setJournalToReverse] = useState<JournalEntry | null>(null);

  // Only direct entry allowed accounts
  const directLedgers = useMemo(() => {
    return ledgers.filter(l => l.status === 'active' && l.directEntryAllowed !== false);
  }, [ledgers]);

  // Live totals calculation
  const totalDebit = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  }, [lines]);

  const totalCredit = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  }, [lines]);

  const difference = useMemo(() => {
    return Math.abs(totalDebit - totalCredit);
  }, [totalDebit, totalCredit]);

  const isBalanced = difference < 0.01 && totalDebit > 0;

  // Add Line
  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        accountId: '',
        accountCode: '',
        accountName: '',
        debit: 0,
        credit: 0,
        costCenter: '',
        lineNarration: ''
      }
    ]);
  };

  // Remove Line
  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  // Update Line
  const handleLineChange = (index: number, field: keyof JournalEntryLine, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };

      if (field === 'accountId') {
        const selectedLedger = directLedgers.find(l => l.id === value);
        if (selectedLedger) {
          line.accountCode = selectedLedger.code;
          line.accountName = selectedLedger.name;
          line.accountNature = selectedLedger.nature;
        }
      }

      // If user inputs debit, auto clear credit on that line (unless partial)
      if (field === 'debit' && Number(value) > 0) {
        line.credit = 0;
      }
      if (field === 'credit' && Number(value) > 0) {
        line.debit = 0;
      }

      updated[index] = line;
      return updated;
    });
  };

  // Auto Balance Helper (fills the last line with difference)
  const handleAutoBalance = () => {
    if (lines.length < 2) return;
    const lastIdx = lines.length - 1;
    const currentDr = lines.slice(0, lastIdx).reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const currentCr = lines.slice(0, lastIdx).reduce((s, l) => s + (Number(l.credit) || 0), 0);

    const diff = currentDr - currentCr;
    if (diff > 0) {
      handleLineChange(lastIdx, 'credit', diff);
      handleLineChange(lastIdx, 'debit', 0);
    } else if (diff < 0) {
      handleLineChange(lastIdx, 'debit', Math.abs(diff));
      handleLineChange(lastIdx, 'credit', 0);
    }
  };

  // Post or Draft Journal Voucher with Approval Check
  const handleSaveJournal = async (status: 'posted' | 'draft') => {
    if (!narration.trim()) {
      setFormError('Please enter a voucher narration explaining the transaction.');
      return;
    }

    // Check all lines have valid accounts
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.accountId) {
        setFormError(`Line #${i + 1} has no Ledger Account selected.`);
        return;
      }
      if ((l.debit || 0) === 0 && (l.credit || 0) === 0) {
        setFormError(`Line #${i + 1} has zero debit and zero credit.`);
        return;
      }
    }

    if (status === 'posted' && !isBalanced) {
      setFormError(`Cannot post unbalanced voucher! Debit (${currencySymbol}${totalDebit.toFixed(2)}) must equal Credit (${currencySymbol}${totalCredit.toFixed(2)}).`);
      return;
    }

    setIsPosting(true);
    setFormError('');
    try {
      let finalStatus: 'posted' | 'draft' | 'pending_approval' = status;
      let approvalNotice = '';
      let approvalResult: any = null;

      if (status === 'posted') {
        approvalResult = await checkPageApprovalRule(
          'accounts-journal',
          businessId,
          { uid: userUid, displayName: userDisplayName, role: isSuperAdmin ? 'Admin' : 'User' },
          totalDebit
        );

        if (approvalResult.required) {
          finalStatus = 'pending_approval';
          approvalNotice = `Voucher #${journalNo} submitted for approval to ${approvalResult.approverName || 'Authorized Approver'}. It will be posted to the General Ledger once approved.`;
        }
      }

      const docId = `jv_${Date.now()}`;
      const newJournal: JournalEntry = {
        id: docId,
        journalNo,
        date: journalDate,
        referenceNo,
        referenceType,
        narration,
        lines: lines.map(l => ({
          ...l,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0
        })),
        totalDebit,
        totalCredit,
        costCenter,
        attachmentName,
        preparedBy: userDisplayName || 'Accountant',
        postedBy: finalStatus === 'posted' ? (userDisplayName || 'Accountant') : '',
        postedDate: finalStatus === 'posted' ? journalDate : '',
        status: finalStatus,
        isSystemGenerated: false,
        businessId,
        auditTrail: [
          {
            action: finalStatus === 'posted' ? 'POSTED_VOUCHER' : finalStatus === 'pending_approval' ? 'SUBMITTED_FOR_APPROVAL' : 'SAVED_DRAFT',
            performedBy: userDisplayName || 'User',
            timestamp: new Date().toISOString(),
            details: `Voucher ${journalNo} recorded with ${lines.length} lines. Status: ${finalStatus.toUpperCase()}`
          }
        ]
      };

      await saveJournalEntry(newJournal, businessId);

      if (finalStatus === 'pending_approval' && approvalResult) {
        await submitDocumentForApproval(
          businessId,
          'accounts-journal',
          'Accounts & Finance',
          'Create Journal Voucher',
          'journal_entries',
          docId,
          `Journal Voucher ${journalNo} (${currencySymbol}${totalDebit.toLocaleString()}) - ${narration}`,
          { uid: userUid, displayName: userDisplayName, email: userDisplayName } as any,
          approvalResult,
          totalDebit
        );
        alert(approvalNotice);
      } else if (finalStatus === 'posted') {
        alert(`Journal Voucher #${journalNo} posted successfully to General Ledger.`);
      }

      onRefresh();

      // Reset Form & Switch to Register
      setActiveTab('register');
      setJournalNo(`JV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(journals.length + 2).padStart(4, '0')}`);
      setNarration('');
      setReferenceNo('');
      setLines([
        { id: '1', accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0, costCenter: '', lineNarration: '' },
        { id: '2', accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0, costCenter: '', lineNarration: '' }
      ]);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to save Journal Voucher.');
    } finally {
      setIsPosting(false);
    }
  };

  // Trigger Approval with Confirmation Modal
  const triggerApproveJournal = (journal: JournalEntry) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Journal Voucher & Post',
      message: `Are you sure you want to approve Journal Voucher #${journal.journalNo}?`,
      subMessage: `Total Amount: ${currencySymbol}${journal.totalDebit.toLocaleString()} • Lines: ${journal.lines?.length || 0} • Reference: ${journal.referenceNo || 'Manual'}`,
      variant: 'approve',
      confirmText: 'Yes, Approve & Post',
      onConfirm: async () => {
        setIsPosting(true);
        try {
          const now = new Date().toISOString();
          const today = now.split('T')[0];

          await updateDoc(doc(db, 'journal_entries', journal.id), {
            status: 'posted',
            approvedBy: userDisplayName || 'Approver',
            approvedDate: today,
            postedBy: userDisplayName || 'Approver',
            postedDate: today,
            postedAt: now,
            updatedAt: now
          });

          // Mark linked approval request as approved if exists
          try {
            const q = query(
              collection(db, 'approvalRequests'),
              where('targetId', '==', journal.id),
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

          if (selectedJournal && selectedJournal.id === journal.id) {
            setSelectedJournal(prev => prev ? { ...prev, status: 'posted', postedBy: userDisplayName, postedDate: today } : null);
          }

          onRefresh();
        } catch (err: any) {
          console.error(err);
          setFormError('Failed to approve journal: ' + err.message);
        } finally {
          setIsPosting(false);
        }
      }
    });
  };

  // Trigger Rejection with Confirmation Modal
  const triggerRejectJournal = (journal: JournalEntry) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Journal Voucher Confirmation',
      message: `Are you sure you want to reject Journal Voucher #${journal.journalNo}?`,
      subMessage: `Amount: ${currencySymbol}${journal.totalDebit.toLocaleString()} • Reference: ${journal.referenceNo || 'N/A'}`,
      variant: 'reject',
      confirmText: 'Yes, Reject Voucher',
      showReasonInput: true,
      onConfirm: async (reason) => {
        setIsPosting(true);
        try {
          const now = new Date().toISOString();
          const finalReason = reason || 'Rejected by approver';

          await updateDoc(doc(db, 'journal_entries', journal.id), {
            status: 'rejected',
            rejectionReason: finalReason,
            updatedAt: now
          });

          try {
            const q = query(
              collection(db, 'approvalRequests'),
              where('targetId', '==', journal.id),
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

          if (selectedJournal && selectedJournal.id === journal.id) {
            setSelectedJournal(prev => prev ? { ...prev, status: 'rejected', rejectionReason: finalReason } : null);
          }

          onRefresh();
        } catch (err: any) {
          console.error(err);
          setFormError('Failed to reject journal: ' + err.message);
        } finally {
          setIsPosting(false);
        }
      }
    });
  };

  // Direct Approval for Pending Vouchers
  const handleApproveJournal = async (journal: JournalEntry) => {
    if (!confirm(`Approve Journal Voucher #${journal.journalNo} and post ${currencySymbol}${journal.totalDebit.toLocaleString()} to General Ledger?`)) return;

    setIsPosting(true);
    try {
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      await updateDoc(doc(db, 'journal_entries', journal.id), {
        status: 'posted',
        approvedBy: userDisplayName || 'Approver',
        approvedDate: today,
        postedBy: userDisplayName || 'Approver',
        postedDate: today,
        postedAt: now,
        updatedAt: now
      });

      // Mark linked approval request as approved if exists
      try {
        const q = query(
          collection(db, 'approvalRequests'),
          where('targetId', '==', journal.id),
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

      if (selectedJournal && selectedJournal.id === journal.id) {
        setSelectedJournal(prev => prev ? { ...prev, status: 'posted', postedBy: userDisplayName, postedDate: today } : null);
      }

      onRefresh();
      alert(`Journal Voucher #${journal.journalNo} approved and successfully posted to General Ledger.`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to approve journal: ' + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  // Direct Rejection for Pending Vouchers
  const handleRejectJournal = async (journal: JournalEntry) => {
    const reason = prompt(`Enter rejection reason for Voucher #${journal.journalNo}:`);
    if (reason === null) return;

    setIsPosting(true);
    try {
      const now = new Date().toISOString();

      await updateDoc(doc(db, 'journal_entries', journal.id), {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: now
      });

      try {
        const q = query(
          collection(db, 'approvalRequests'),
          where('targetId', '==', journal.id),
          where('status', '==', 'pending')
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'approvalRequests', d.id), {
            status: 'rejected',
            rejectedAt: Timestamp.now(),
            rejectedBy: userDisplayName,
            rejectionReason: reason
          });
        }
      } catch (e) {
        console.warn('Could not update approval request', e);
      }

      if (selectedJournal && selectedJournal.id === journal.id) {
        setSelectedJournal(prev => prev ? { ...prev, status: 'rejected' } : null);
      }

      onRefresh();
      alert(`Journal Voucher #${journal.journalNo} has been rejected.`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to reject journal: ' + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  // Perform Reversal
  const handleExecuteReversal = async () => {
    if (!journalToReverse || !reversalReason.trim()) return;

    setIsPosting(true);
    try {
      await reverseJournalEntry(
        journalToReverse,
        reversalReason,
        userDisplayName || 'Accountant',
        businessId
      );
      setReversalModalOpen(false);
      setJournalToReverse(null);
      setReversalReason('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert('Failed to reverse journal: ' + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  // Filter Journals
  const filteredJournals = useMemo(() => {
    return journals.filter(j => {
      const matchSearch = !searchQuery ||
        j.journalNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (j.referenceNo && j.referenceNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        j.lines.some(l => l.accountName.toLowerCase().includes(searchQuery.toLowerCase()) || l.accountCode.includes(searchQuery));

      const matchStatus = selectedStatus === 'All' || j.status === selectedStatus;
      const matchType = selectedType === 'All' || j.referenceType === selectedType;

      return matchSearch && matchStatus && matchType;
    });
  }, [journals, searchQuery, selectedStatus, selectedType]);

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredJournals.flatMap(j => 
      j.lines.map(l => ({
        'Voucher No': j.journalNo,
        'Date': j.date,
        'Type': j.referenceType,
        'Reference': j.referenceNo || '',
        'General Narration': j.narration,
        'Account Code': l.accountCode,
        'Account Name': l.accountName,
        'Debit': l.debit || 0,
        'Credit': l.credit || 0,
        'Line Narration': l.lineNarration || '',
        'Prepared By': j.preparedBy,
        'Status': j.status
      }))
    );

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Journal_Register');
    XLSX.writeFile(wb, `Journal_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="journal-entry-view" className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Journal Entries & General Vouchers</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Standard double-entry accounting vouchers with strict Debit = Credit validation and audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('register')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'register' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Voucher Register ({journals.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'create' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Create Voucher
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

      {activeTab === 'create' ? (
        /* CREATE JOURNAL VOUCHER FORM */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">New Double-Entry Journal Voucher</h3>
              <p className="text-xs text-slate-500">Every debit leg must equal credit leg for financial ledger integrity.</p>
            </div>

            {/* Real-time Balance Status Bar */}
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 ${
              isBalanced 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold uppercase">Balanced & Valid</div>
                    <div className="text-xs">{currencySymbol}{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} Dr = Cr</div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <div>
                    <div className="text-xs font-bold uppercase">Unbalanced Difference</div>
                    <div className="text-xs font-mono">
                      Diff: {currencySymbol}{difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    className="ml-2 px-2.5 py-1 text-xs font-bold bg-white border border-rose-300 text-rose-700 rounded-md hover:bg-rose-100 transition-colors"
                  >
                    Auto-Balance
                  </button>
                </>
              )}
            </div>
          </div>

          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              {formError}
            </div>
          )}

          {/* Voucher Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Voucher No</label>
              <input
                type="text"
                value={journalNo}
                onChange={(e) => setJournalNo(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Posting Date</label>
              <input
                type="date"
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference Type</label>
              <select
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual Journal Voucher (JV)</option>
                <option value="sales">Sales Invoice Journal</option>
                <option value="customer_payment">Customer Receipt Journal</option>
                <option value="purchase">Purchase Invoice Journal</option>
                <option value="supplier_payment">Supplier Payment Journal</option>
                <option value="cash_bank">Cash / Bank Transfer (Contra)</option>
                <option value="loan_disbursement">Bank Loan Disbursement</option>
                <option value="loan_repayment">Bank Loan Repayment</option>
                <option value="depreciation">Fixed Asset Depreciation</option>
                <option value="adjustment">Audit & Closing Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Bill / PO No</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-0042, PO-1029"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                General Narration <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Detailed reason for journal entry (e.g. Being payment made to yarn vendor for PO #8892)"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cost Center / Branch</label>
              <input
                type="text"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Multi-line Debit / Credit Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Accounting Distribution Lines</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Entry Line
              </button>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 w-12 text-center">#</th>
                  <th className="px-4 py-2.5 w-72">Ledger Account</th>
                  <th className="px-4 py-2.5 w-36">Account Code</th>
                  <th className="px-4 py-2.5 w-36 text-right">Debit ({currencySymbol})</th>
                  <th className="px-4 py-2.5 w-36 text-right">Credit ({currencySymbol})</th>
                  <th className="px-4 py-2.5">Line Narration</th>
                  <th className="px-4 py-2.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-center text-xs font-medium text-slate-400">{idx + 1}</td>
                    
                    <td className="px-4 py-2.5">
                      <select
                        value={line.accountId}
                        onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                      >
                        <option value="">-- Select Account --</option>
                        {directLedgers.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.code} – {l.name} ({l.accountType})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {line.accountCode || '-'}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit || ''}
                        placeholder="0.00"
                        onChange={(e) => handleLineChange(idx, 'debit', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit || ''}
                        placeholder="0.00"
                        onChange={(e) => handleLineChange(idx, 'credit', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        placeholder="Optional remarks for this line"
                        value={line.lineNarration || ''}
                        onChange={(e) => handleLineChange(idx, 'lineNarration', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        disabled={lines.length <= 2}
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                        title="Remove Line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/90 font-bold text-xs text-slate-800 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider">
                    Total Voucher Sum:
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-blue-900">
                    {currencySymbol}{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-blue-900">
                    {currencySymbol}{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="px-4 py-3">
                    {isBalanced ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Balanced
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Diff: {currencySymbol}{difference.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isPosting}
                onClick={() => handleSaveJournal('draft')}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isPosting || !isBalanced}
                onClick={() => handleSaveJournal('posted')}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isPosting ? 'Posting...' : 'Post & Update Ledgers'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* VOUCHER REGISTER TABLE */
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Voucher No, Narration, Reference or Account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="posted">Posted (In Ledger)</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="draft">Draft</option>
                <option value="rejected">Rejected</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Reference Types</option>
                <option value="manual">Manual (JV)</option>
                <option value="sales">Sales Accounts</option>
                <option value="customer_payment">Customer Receipt</option>
                <option value="purchase">Purchase Bill</option>
                <option value="supplier_payment">Supplier Payment</option>
                <option value="cash_bank">Cash/Bank Transfer</option>
                <option value="loan_disbursement">Loan</option>
                <option value="depreciation">Depreciation</option>
                <option value="reversal">Reversal Entry</option>
              </select>
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Voucher No</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Type & Ref</th>
                    <th className="px-6 py-3.5">Narration / Accounts Summary</th>
                    <th className="px-6 py-3.5 text-right">Debit ({currencySymbol})</th>
                    <th className="px-6 py-3.5 text-right">Credit ({currencySymbol})</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredJournals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No journal entries found matching criteria. Click "+ Create Voucher" to record a new journal entry.
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map(journal => (
                      <tr key={journal.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{journal.journalNo}</div>
                          <div className="text-[11px] text-slate-400">By: {journal.preparedBy}</div>
                        </td>

                        <td className="px-6 py-4 text-xs font-medium text-slate-600">
                          {journal.date}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 capitalize">
                            {journal.referenceType}
                          </span>
                          {journal.referenceNo && (
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">{journal.referenceNo}</div>
                          )}
                        </td>

                        <td className="px-6 py-4 max-w-sm">
                          <div className="text-xs font-medium text-slate-800 line-clamp-1" title={journal.narration}>
                            {journal.narration}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {journal.lines.map(l => `${l.accountName} (${l.debit ? `Dr ${l.debit}` : `Cr ${l.credit}`})`).join(' | ')}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                          {journal.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                          {journal.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            journal.status === 'posted'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : journal.status === 'pending_approval'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse'
                              : journal.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : journal.status === 'reversed'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {journal.status === 'pending_approval' && <Clock className="w-3 h-3 text-amber-600" />}
                            {journal.status === 'pending_approval' ? 'PENDING APPROVAL' : journal.status.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedJournal(journal)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View & Print Voucher"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {journal.status === 'pending_approval' && (
                              <>
                                <button
                                  onClick={() => triggerApproveJournal(journal)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors"
                                  title="Approve & Post to General Ledger"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => triggerRejectJournal(journal)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                                  title="Reject Voucher"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {journal.status === 'posted' && !journal.reversedJournalId && (
                              <button
                                onClick={() => {
                                  setJournalToReverse(journal);
                                  setReversalReason('');
                                  setReversalModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Create Reversal Entry"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
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
          </div>
        </div>
      )}

      {/* MODAL: Voucher Print / Drilldown View */}
      {selectedJournal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Journal Voucher #{selectedJournal.journalNo}</span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                  selectedJournal.status === 'posted' ? 'bg-emerald-100 text-emerald-800' : selectedJournal.status === 'pending_approval' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-800'
                }`}>
                  {selectedJournal.status === 'pending_approval' ? 'PENDING APPROVAL' : selectedJournal.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedJournal.status === 'pending_approval' && (
                  <>
                    <button
                      onClick={() => selectedJournal && triggerApproveJournal(selectedJournal)}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Approve & Post
                    </button>
                    <button
                      onClick={() => selectedJournal && triggerRejectJournal(selectedJournal)}
                      className="px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center gap-1.5 shadow-xs"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => printElement('printable-journal-voucher', { title: `Voucher_${selectedJournal.journalNo}` })}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Voucher
                </button>
                <button onClick={() => setSelectedJournal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Format */}
            <div id="printable-journal-voucher" className="printable-doc p-8 space-y-6">
              {/* Company Banner */}
              <div className="text-center border-b border-slate-300 pb-4">
                <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">ES TRIMS LIMITED</h2>
                <p className="text-xs text-slate-600">Plot 120, Industrial Area, Gazipur, Bangladesh • Phone: +880 2 99882233</p>
                <div className="inline-block mt-2 px-4 py-1 bg-slate-100 text-slate-800 text-xs font-bold uppercase rounded border border-slate-300">
                  JOURNAL VOUCHER
                </div>
              </div>

              {/* Meta Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div><span className="text-slate-500 font-medium">Voucher No:</span> <strong className="font-mono text-slate-900">{selectedJournal.journalNo}</strong></div>
                  <div><span className="text-slate-500 font-medium">Date:</span> <strong>{selectedJournal.date}</strong></div>
                  <div><span className="text-slate-500 font-medium">Voucher Type:</span> <span className="capitalize">{selectedJournal.referenceType}</span></div>
                </div>
                <div className="text-right">
                  <div><span className="text-slate-500 font-medium">Reference:</span> <strong>{selectedJournal.referenceNo || 'N/A'}</strong></div>
                  <div><span className="text-slate-500 font-medium">Cost Center:</span> <strong>{selectedJournal.costCenter || 'Factory Main'}</strong></div>
                  <div><span className="text-slate-500 font-medium">Prepared By:</span> <strong>{selectedJournal.preparedBy}</strong></div>
                </div>
              </div>

              {/* Lines Table */}
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2 border-r border-slate-300 w-10 text-center">#</th>
                    <th className="p-2 border-r border-slate-300">Account Particulars</th>
                    <th className="p-2 border-r border-slate-300 w-32">Account Code</th>
                    <th className="p-2 border-r border-slate-300 w-28 text-right">Debit ({currencySymbol})</th>
                    <th className="p-2 w-28 text-right">Credit ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedJournal.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400">{i + 1}</td>
                      <td className="p-2 border-r border-slate-200">
                        <div className="font-bold text-slate-800">{l.accountName}</div>
                        {l.lineNarration && <div className="text-[11px] text-slate-500 italic">{l.lineNarration}</div>}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono text-slate-600">{l.accountCode}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                        {l.debit ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">
                        {l.credit ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="p-2 text-right uppercase">Total:</td>
                    <td className="p-2 text-right font-mono">{currencySymbol}{selectedJournal.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-mono">{currencySymbol}{selectedJournal.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>

              {/* General Narration */}
              <div className="text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <span className="font-bold text-slate-700">Narration / Purpose:</span> {selectedJournal.narration}
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-8 pt-12 text-center text-xs">
                <div className="border-t border-slate-400 pt-2 font-medium text-slate-700">
                  Prepared By ({selectedJournal.preparedBy})
                </div>
                <div className="border-t border-slate-400 pt-2 font-medium text-slate-700">
                  Verified / Accounts Officer
                </div>
                <div className="border-t border-slate-400 pt-2 font-medium text-slate-700">
                  Approved By / CFO
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reversal Reason */}
      {reversalModalOpen && journalToReverse && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-800">Reverse Journal Voucher</h3>
            </div>
            <p className="text-xs text-slate-600">
              This will create an automatic compensating reversal voucher for <strong>{journalToReverse.journalNo}</strong> with swapped debits & credits.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Reversal <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Wrong account debited, duplicate billing entry, or audit adjustment"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReversalModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!reversalReason.trim() || isPosting}
                onClick={handleExecuteReversal}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {isPosting ? 'Reversing...' : 'Confirm Reversal'}
              </button>
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
