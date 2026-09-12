import React, { useState, useMemo } from 'react';
import { Item, Transaction, PurchaseOrder, Supplier, UserProfile, ApprovalRequest } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ConfirmModal, ConfirmVariant } from './ui/ConfirmModal';
import { canUserApprove, executeApprovalAction, executeRejectAction, getApprovalRequestCurrency, isUserDesignatedApprover } from '../services/approvalService';
import { isUserSuperAdmin } from '../admin/adminUtils';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  UserCheck, 
  Clock, 
  Search, 
  Send, 
  ListFilter,
  Check,
  User,
  ShieldAlert
} from 'lucide-react';

interface ApprovalsViewProps {
  items: Item[];
  transactions: Transaction[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  recalculateItemStock?: (itemId: string) => Promise<number>;
  fetchFullHistory?: () => Promise<void>;
  syncAllData?: () => Promise<void>;
  approvalRequests: ApprovalRequest[];
}

export function ApprovalsView({
  items,
  transactions,
  purchaseOrders,
  suppliers,
  userProfile,
  showToast,
  recalculateItemStock,
  fetchFullHistory,
  syncAllData,
  approvalRequests
}: ApprovalsViewProps) {
  const [activeTab, setActiveTab] = useState<'assigned' | 'submitted' | 'all' | 'history'>('assigned');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('ALL');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    variant: ConfirmVariant;
    confirmText?: string;
    showReasonInput?: boolean;
    onConfirm: (reason?: string) => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'approve',
    onConfirm: async () => {}
  });

  const isSuper = isUserSuperAdmin(userProfile);
  const userRole = (userProfile.role || '').toLowerCase();
  const isAdmin = isSuper || userRole.includes('admin');
  const currentUid = (userProfile.uid || (userProfile as any).id || '').trim();
  const currentEmail = (userProfile.email || '').toLowerCase().trim();

  // 1. Assigned to Current User (Pending)
  const assignedToMe = useMemo(() => {
    return approvalRequests.filter(r => {
      if (r.status !== 'pending') return false;
      return canUserApprove(r, userProfile);
    });
  }, [approvalRequests, userProfile]);

  // 2. Submitted by Current User
  const submittedByMe = useMemo(() => {
    return approvalRequests.filter(r => {
      const reqUid = (r.requestedByUid || '').trim();
      const reqEmail = (r.requestedByEmail || '').toLowerCase().trim();
      return (reqUid && reqUid === currentUid) || (reqEmail && reqEmail === currentEmail);
    });
  }, [approvalRequests, currentUid, currentEmail]);

  // 3. All Pending Requests (for Admins)
  const allPendingRequests = useMemo(() => {
    return approvalRequests.filter(r => r.status === 'pending');
  }, [approvalRequests]);

  // 4. Completed / Historical Requests
  const historyRequests = useMemo(() => {
    return approvalRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
  }, [approvalRequests]);

  // Transactions pending deletion
  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => (t.status as string) === 'pending_delete');
  }, [transactions]);

  // Modules present in approval requests for filtering
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    approvalRequests.forEach(r => {
      if (r.moduleName || r.module) set.add(r.moduleName || r.module);
    });
    return Array.from(set);
  }, [approvalRequests]);

  // Current list based on active tab
  const displayedRequests = useMemo(() => {
    let list: ApprovalRequest[] = [];
    if (activeTab === 'assigned') list = assignedToMe;
    else if (activeTab === 'submitted') list = submittedByMe;
    else if (activeTab === 'all') list = allPendingRequests;
    else if (activeTab === 'history') list = historyRequests;

    return list.filter(r => {
      const matchSearch = !searchTerm || 
        (r.summary && r.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.moduleName && r.moduleName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.requestedByName && r.requestedByName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.approverName && r.approverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.targetId && r.targetId.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchModule = selectedModuleFilter === 'ALL' || (r.moduleName || r.module) === selectedModuleFilter;

      return matchSearch && matchModule;
    });
  }, [activeTab, assignedToMe, submittedByMe, allPendingRequests, historyRequests, searchTerm, selectedModuleFilter]);

  const handleApproveModuleRequest = (req: ApprovalRequest) => {
    const isRectify = req.actionType === 'RECTIFY_ORDER_REQUEST';
    const isPriceMaster = req.actionType === 'PRICE_MASTER_UPDATE' || req.actionType === 'PRICE_MASTER_CREATE' || req.targetCollection === 'price_masters' || req.targetCollection === 'subcontract_prices';
    
    setConfirmModal({
      isOpen: true,
      title: isRectify 
        ? 'Approve Rectification & Unlock Work Order' 
        : isPriceMaster 
        ? `Approve Price Master Update` 
        : `Approve ${req.moduleName || req.module}`,
      message: isRectify 
        ? 'Approving this request will UNLOCK the Work Order and reset it to Draft so the requester can edit quantities, breakdowns, and prices.' 
        : isPriceMaster
        ? 'Approving this price rule will activate the new rate across the system for all orders and invoicing.'
        : `Are you sure you want to approve this request? It will be immediately posted and activated.`,
      subMessage: req.summary,
      variant: 'approve',
      confirmText: isRectify ? 'Approve & Unlock' : 'Confirm & Post',
      showReasonInput: true,
      onConfirm: async (comment?: string) => {
        try {
          await executeApprovalAction(req, userProfile, comment);
          showToast(isRectify ? 'Work Order unlocked for rectification' : `${req.moduleName || req.module} approved and posted successfully`, 'success');
          if (syncAllData) await syncAllData();
        } catch (err: any) {
          console.error('Error approving request:', err);
          showToast(err.message || 'Failed to approve request', 'error');
        }
      }
    });
  };

  const handleRejectModuleRequest = (req: ApprovalRequest) => {
    setConfirmModal({
      isOpen: true,
      title: `Reject ${req.moduleName || req.module}`,
      message: `Are you sure you want to reject this request? The record will be marked as rejected.`,
      subMessage: req.summary,
      variant: 'reject',
      confirmText: 'Yes, Reject',
      showReasonInput: true,
      onConfirm: async (reason?: string) => {
        try {
          await executeRejectAction(req, userProfile, reason);
          showToast(`${req.moduleName || req.module} rejected`, 'success');
          if (syncAllData) await syncAllData();
        } catch (err: any) {
          console.error('Error rejecting request:', err);
          showToast(err.message || 'Failed to reject request', 'error');
        }
      }
    });
  };

  const handleApproveTransactionDelete = (tx: Transaction, itemName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Transaction Deletion',
      message: `Are you sure you want to permanently delete this ${tx.type} transaction of ${tx.quantity} pcs for "${itemName}"?`,
      subMessage: 'This action cannot be undone and stock balance will be adjusted accordingly.',
      variant: 'delete',
      confirmText: 'Delete Transaction',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'transactions', tx.id));
          if (recalculateItemStock && tx.itemId) {
            await recalculateItemStock(tx.itemId);
          }
          if (syncAllData) await syncAllData();
          showToast('Transaction permanently deleted', 'success');
        } catch (err: any) {
          console.error('Error deleting transaction:', err);
          showToast('Failed to delete transaction', 'error');
        }
      }
    });
  };

  const handleRejectTransactionDelete = async (txId: string) => {
    try {
      await updateDoc(doc(db, 'transactions', txId), {
        status: 'active'
      });
      if (syncAllData) await syncAllData();
      showToast('Transaction deletion rejected and restored to active', 'success');
    } catch (err: any) {
      console.error('Error rejecting transaction deletion:', err);
      showToast('Failed to reject transaction deletion', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            <span>Approval & Workflow Center</span>
          </h2>
          <p className="text-sm text-neutral-500">
            Real-time multi-tier authorization queue with direct designated user and role routing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-indigo-50 border border-indigo-200/70 rounded-xl text-xs font-bold text-indigo-900">
            Awaiting Your Action: <span className="text-indigo-600 font-extrabold text-sm ml-1">{assignedToMe.length}</span>
          </div>
          {syncAllData && (
            <Button variant="outline" size="sm" onClick={() => syncAllData()} className="h-9 gap-1.5 text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('assigned')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'assigned'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Assigned to Me</span>
          {assignedToMe.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'assigned' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {assignedToMe.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('submitted')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'submitted'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Submitted by Me</span>
          {submittedByMe.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'submitted' ? 'bg-white text-indigo-700' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {submittedByMe.length}
            </span>
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>All Organization Pending</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'all' ? 'bg-white text-indigo-700' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {allPendingRequests.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Approval History</span>
          {historyRequests.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'history' ? 'bg-white text-indigo-700' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {historyRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by summary, requester, approver, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-neutral-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ListFilter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <select
            value={selectedModuleFilter}
            onChange={(e) => setSelectedModuleFilter(e.target.value)}
            className="w-full sm:w-auto text-xs font-semibold rounded-xl border border-neutral-200 py-1.5 px-3 bg-neutral-50/50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Modules ({displayedRequests.length})</option>
            {availableModules.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            {activeTab === 'assigned' && <UserCheck className="w-4 h-4 text-indigo-600" />}
            {activeTab === 'submitted' && <Send className="w-4 h-4 text-blue-600" />}
            {activeTab === 'all' && <ShieldAlert className="w-4 h-4 text-amber-600" />}
            {activeTab === 'history' && <Clock className="w-4 h-4 text-neutral-600" />}
            <span>
              {activeTab === 'assigned' && `Requests Assigned to You (${displayedRequests.length})`}
              {activeTab === 'submitted' && `Requests You Submitted (${displayedRequests.length})`}
              {activeTab === 'all' && `All Pending Organization Requests (${displayedRequests.length})`}
              {activeTab === 'history' && `Completed Approval History (${displayedRequests.length})`}
            </span>
          </h3>
        </div>

        {displayedRequests.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-sm flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-neutral-300" />
            <p className="font-semibold text-neutral-600">No requests in this view</p>
            <p className="text-xs text-neutral-400 max-w-sm">
              {activeTab === 'assigned' 
                ? 'You have zero pending approvals awaiting your review. Great job!' 
                : activeTab === 'submitted'
                ? 'You have not submitted any approval requests yet.'
                : 'No approval requests found matching your filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50/80 text-[11px] font-bold text-neutral-500 uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Module & Document</th>
                  <th className="px-4 py-3">Details / Summary</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Assigned Approver</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {displayedRequests.map(req => {
                  const curr = getApprovalRequestCurrency(req);
                  const isAssignedDirectlyToMe = isUserDesignatedApprover(req, userProfile);
                  const canIApproveThis = canUserApprove(req, userProfile);

                  return (
                    <tr key={req.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Module */}
                      <td className="px-4 py-3 font-semibold text-neutral-900 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-xs text-neutral-900">{req.moduleName || req.module}</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {req.actionType === 'RECTIFY_ORDER_REQUEST' && (
                              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                                Rectify & Unlock
                              </span>
                            )}
                            {(req.actionType === 'PRICE_MASTER_UPDATE' || req.actionType === 'PRICE_MASTER_CREATE' || req.targetCollection === 'price_masters' || req.targetCollection === 'subcontract_prices') && (
                              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Price Master
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="px-4 py-3 text-neutral-700 text-xs max-w-xs align-middle">
                        <div className="font-medium line-clamp-2">{req.summary}</div>
                        {req.approvalComments && (
                          <div className="text-[11px] text-neutral-500 italic mt-1 bg-neutral-100/70 p-1.5 rounded-lg">
                            Note: {req.approvalComments}
                          </div>
                        )}
                      </td>

                      {/* Requested By */}
                      <td className="px-4 py-3 text-xs text-neutral-600 align-middle">
                        <div className="font-semibold text-neutral-900">{req.requestedByName || 'User'}</div>
                        <div className="text-[11px] text-neutral-400">{req.requestedByEmail || ''}</div>
                      </td>

                      {/* Assigned Approver */}
                      <td className="px-4 py-3 text-xs align-middle">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-neutral-900">{req.approverName || 'Designated Approver'}</span>
                            {isAssignedDirectlyToMe && (
                              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {req.approverEmail ? req.approverEmail : (req.approverRole ? `Role: ${req.approverRole}` : 'Direct User Assignment')}
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 font-bold text-xs text-neutral-900 align-middle whitespace-nowrap">
                        {req.amount ? `${curr.symbol} ${Number(req.amount).toLocaleString()}` : "-"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-[11px] text-neutral-400 align-middle whitespace-nowrap">
                        {req.createdAt ? (req.createdAt as any).toDate?.().toLocaleDateString() || '' : ''}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right space-x-2 align-middle whitespace-nowrap">
                        {req.status === 'pending' && canIApproveThis ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApproveModuleRequest(req)}
                              className={req.actionType === 'RECTIFY_ORDER_REQUEST' 
                                ? "bg-purple-600 hover:bg-purple-700 text-white font-bold h-8 px-3 text-xs shadow-sm" 
                                : "bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 text-xs shadow-sm"}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              {req.actionType === 'RECTIFY_ORDER_REQUEST' ? 'Approve & Unlock' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectModuleRequest(req)}
                              className="text-red-600 hover:bg-red-50 border-red-200 font-bold h-8 px-3 text-xs"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Reject
                            </Button>
                          </>
                        ) : req.status === 'pending' ? (
                          <span className="text-[11px] font-semibold text-neutral-400 italic">
                            Waiting for {req.approverName || 'Approver'}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-neutral-400">
                            Closed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending Transaction Deletions */}
      {pendingTransactions.length > 0 && (isAdmin || assignedToMe.length > 0) && (
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Pending Transaction Deletions ({pendingTransactions.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-100">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pendingTransactions.map(tx => {
                  const it = items.find(i => i.id === tx.itemId);
                  const itemName = it?.name || tx.itemId;
                  return (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{itemName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">{tx.quantity}</td>
                      <td className="px-4 py-3 text-neutral-500">{tx.reference || '-'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button size="sm" onClick={() => handleApproveTransactionDelete(tx, itemName)} className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs font-bold">
                          Confirm Delete
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRejectTransactionDelete(tx.id)} className="h-8 text-xs font-bold">
                          Reject
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirmation Modal */}
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
}
