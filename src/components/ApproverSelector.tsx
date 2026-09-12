import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldCheck, User, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { fetchEligibleApproverUsers, ApproverUserOption } from '../services/approvalService';

export type { ApproverUserOption };

interface ApproverSelectorProps {
  businessId?: string;
  selectedUid?: string;
  selectedEmail?: string;
  selectedName?: string;
  isApprovalRequired?: boolean;
  pageName?: string;
  onSelectApprover: (approver: ApproverUserOption | null) => void;
  className?: string;
}

export const ApproverSelector: React.FC<ApproverSelectorProps> = ({
  businessId,
  selectedUid,
  selectedEmail,
  selectedName,
  isApprovalRequired = false,
  pageName = 'this document',
  onSelectApprover,
  className = ''
}) => {
  const [users, setUsers] = useState<ApproverUserOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchEligibleApproverUsers(businessId)
      .then(list => {
        if (isMounted) {
          setUsers(list);
          setLoading(false);
          // If no approver selected yet but approval is required, auto-select first admin or matching user
          if (!selectedUid && !selectedEmail && list.length > 0) {
            const adminUser = list.find(u => u.role.toLowerCase().includes('admin') || u.email.includes('admin')) || list[0];
            if (adminUser) {
              onSelectApprover(adminUser);
            }
          }
        }
      })
      .catch(err => {
        console.warn('Approver users load error:', err);
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [businessId]);

  const currentSelectedUser = users.find(u => 
    (selectedUid && (u.uid === selectedUid)) || 
    (selectedEmail && u.email.toLowerCase() === selectedEmail.toLowerCase())
  );

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isApprovalRequired 
        ? 'bg-amber-50/70 border-amber-200/80 shadow-sm' 
        : 'bg-neutral-50/80 border-neutral-200/80'
    } ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isApprovalRequired ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
          }`}>
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
              <span>Designated Approver Routing</span>
              {isApprovalRequired ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900">
                  Required by Policy
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 text-neutral-700">
                  Optional / Direct Routing
                </span>
              )}
            </h4>
            <p className="text-[11px] text-neutral-500">
              Select the exact user who will receive this document in their approval queue.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-neutral-700">
          Route Approval To Specific User:
        </label>
        <div className="relative">
          <select
            value={currentSelectedUser?.uid || selectedUid || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                onSelectApprover(null);
              } else {
                const found = users.find(u => u.uid === val);
                if (found) onSelectApprover(found);
              }
            }}
            disabled={loading}
            className="w-full bg-white text-xs font-semibold rounded-xl border border-neutral-300 py-2.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-800 transition-all shadow-sm"
          >
            {loading ? (
              <option value="">Loading users...</option>
            ) : (
              <>
                <option value="">-- Choose Assigned Approver --</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.name} — {u.role} {u.department ? `(${u.department})` : ''} [{u.email}]
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {currentSelectedUser && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-neutral-200 text-xs text-neutral-700 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-[11px]">
              Assigned to: <strong className="text-neutral-900">{currentSelectedUser.name}</strong> ({currentSelectedUser.email}) • <span className="text-neutral-500">{currentSelectedUser.role}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
