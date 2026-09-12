import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Search, 
  Save, 
  Edit2, 
  Layers, 
  UserCheck, 
  ShieldCheck, 
  DollarSign, 
  XCircle, 
  ArrowDown, 
  ArrowUp,
  X,
  Sliders,
  Filter,
  Check,
  ShieldAlert
} from 'lucide-react';
import { ApprovalRuleModel, ApprovalLevelConfig, UserAccountModel, RoleModel } from './adminTypes';
import { ERP_PAGE_REGISTRY, ERP_MODULE_CATEGORIES } from './pageRegistry';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, setDoc, doc, Timestamp } from 'firebase/firestore';

interface ApprovalSetupProps {
  approvalRules: ApprovalRuleModel[];
  users: UserAccountModel[];
  roles: RoleModel[];
  businessId: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

export const ApprovalSetup: React.FC<ApprovalSetupProps> = ({
  approvalRules,
  users,
  roles,
  businessId,
  showToast,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('ALL');
  const [editingRule, setEditingRule] = useState<ApprovalRuleModel | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal Configuration State
  const [selectedPageId, setSelectedPageId] = useState('');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [levels, setLevels] = useState<ApprovalLevelConfig[]>([
    { level: 1, approverType: 'role', approverId: 'admin', approverName: 'Admin', amountLimit: 100000 }
  ]);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get list of pages that can have approvals (Work process pages only, exclude reports/dashboards/setup)
  const allWorkflowPages = useMemo(() => ERP_PAGE_REGISTRY.filter(p => p.approvalSupported), []);

  const availableWorkflowModules = useMemo(() => {
    const mods = new Set<string>();
    allWorkflowPages.forEach(p => mods.add(p.module));
    return Array.from(mods);
  }, [allWorkflowPages]);

  const openConfigModal = (pageId: string) => {
    const existing = approvalRules.find(r => r.pageId === pageId);
    const pageMeta = ERP_PAGE_REGISTRY.find(p => p.id === pageId);

    setSelectedPageId(pageId);

    if (existing) {
      setEditingRule(existing);
      setApprovalRequired(existing.approvalRequired !== false);
      setStatus(existing.status || 'active');
      setLevels(existing.levels && existing.levels.length > 0 ? existing.levels : [
        { 
          level: 1, 
          approverType: existing.approvalType || 'role', 
          approverId: existing.approverId || (roles[0]?.id || 'admin'), 
          approverUid: existing.approverUid || '',
          approverEmail: existing.approverEmail || '',
          approverRole: existing.approverRole || '',
          approverName: existing.approverName || (roles[0]?.roleName || 'Admin'), 
          amountLimit: 100000 
        }
      ]);
    } else {
      setEditingRule(null);
      setApprovalRequired(true);
      setStatus('active');
      setLevels([
        { 
          level: 1, 
          approverType: 'role', 
          approverId: roles[0]?.id || 'admin', 
          approverRole: roles[0]?.id || 'admin',
          approverUid: '',
          approverEmail: '',
          approverName: roles[0]?.roleName || 'Admin', 
          amountLimit: 100000 
        }
      ]);
    }

    setIsModalOpen(true);
  };

  const handleToggleApprovalDirectly = async (pageId: string, currentRequired: boolean) => {
    const existing = approvalRules.find(r => r.pageId === pageId);
    const pageMeta = ERP_PAGE_REGISTRY.find(p => p.id === pageId);
    const newRequired = !currentRequired;

    try {
      if (existing) {
        await updateDoc(doc(db, 'approval_rules', existing.id), {
          approvalRequired: newRequired,
          status: newRequired ? 'active' : 'inactive',
          updatedAt: Timestamp.now()
        });
      } else {
        const defaultRole = roles[0]?.id || 'admin';
        const defaultRoleName = roles[0]?.roleName || 'Admin';

        await addDoc(collection(db, 'approval_rules'), {
          pageId: pageId,
          pageName: pageMeta?.pageName || pageId,
          module: pageMeta?.module || 'General',
          approvalRequired: newRequired,
          approvalType: 'role',
          approverId: defaultRole,
          approverName: defaultRoleName,
          status: newRequired ? 'active' : 'inactive',
          levels: [
            { level: 1, approverType: 'role', approverId: defaultRole, approverName: defaultRoleName, amountLimit: 100000 }
          ],
          businessId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      showToast(
        newRequired 
          ? `Approval requirement enabled for ${pageMeta?.pageName || pageId}.`
          : `Approval requirement disabled for ${pageMeta?.pageName || pageId} (Direct Posting).`,
        'info'
      );
      onRefresh();
    } catch (err: any) {
      console.error(err);
      showToast('Failed to toggle approval requirement.', 'error');
    }
  };

  const handleAddLevel = () => {
    const nextLevelNum = levels.length + 1;
    const defaultRoleId = roles[0]?.id || 'admin';
    const defaultRoleName = roles[0]?.roleName || 'Admin';

    setLevels(prev => [
      ...prev,
      {
        level: nextLevelNum,
        approverType: 'role',
        approverId: defaultRoleId,
        approverName: defaultRoleName,
        amountLimit: 500000
      }
    ]);
  };

  const handleRemoveLevel = (index: number) => {
    if (levels.length <= 1) {
      showToast('At least one approval level is required.', 'error');
      return;
    }
    const updated = levels.filter((_, i) => i !== index).map((lvl, idx) => ({ ...lvl, level: idx + 1 }));
    setLevels(updated);
  };

  const handleLevelChange = (index: number, key: keyof ApprovalLevelConfig, value: any) => {
    setLevels(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };

      // Update approverName and default IDs if Type or ID changed
      if (key === 'approverType') {
        if (value === 'role') {
          const defaultRole = roles[0]?.id || 'admin';
          const defaultRoleName = roles[0]?.roleName || 'Admin';
          copy[index].approverId = defaultRole;
          copy[index].approverRole = defaultRole;
          copy[index].approverUid = '';
          copy[index].approverEmail = '';
          copy[index].approverName = defaultRoleName;
        } else {
          const firstUser = users[0];
          const uid = firstUser?.uid || firstUser?.id || '';
          copy[index].approverId = uid;
          copy[index].approverUid = uid;
          copy[index].approverEmail = firstUser?.email || '';
          copy[index].approverRole = '';
          copy[index].approverName = firstUser?.employeeName ? `${firstUser.employeeName} (${firstUser.email})` : (firstUser?.displayName || firstUser?.email || 'User');
        }
      } else if (key === 'approverId') {
        const type = copy[index].approverType;
        const id = value;
        if (type === 'role') {
          const r = roles.find(role => role.id === id);
          copy[index].approverId = id;
          copy[index].approverRole = id;
          copy[index].approverUid = '';
          copy[index].approverEmail = '';
          copy[index].approverName = r?.roleName || id;
        } else {
          const u = users.find(user => user.id === id || user.uid === id || user.email === id);
          const uid = u?.uid || u?.id || id;
          copy[index].approverId = uid;
          copy[index].approverUid = uid;
          copy[index].approverEmail = u?.email || '';
          copy[index].approverRole = '';
          copy[index].approverName = u?.employeeName ? `${u.employeeName} (${u.email})` : (u?.displayName || u?.email || id);
        }
      }

      return copy;
    });
  };

  const handleSaveApprovalRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPageId) return;

    setIsSubmitting(true);
    try {
      const pageMeta = ERP_PAGE_REGISTRY.find(p => p.id === selectedPageId);
      const existing = editingRule || approvalRules.find(r => r.pageId === selectedPageId);

      // Thoroughly enrich all configured levels with exact UID, email, role and name
      const enrichedLevels: ApprovalLevelConfig[] = levels.map((lvl, index) => {
        if (lvl.approverType === 'user') {
          const matchedUser = users.find(u => u.id === lvl.approverId || u.uid === lvl.approverId || u.email === lvl.approverId);
          const uid = matchedUser?.uid || matchedUser?.id || lvl.approverId;
          const email = matchedUser?.email || '';
          const name = matchedUser?.employeeName 
            ? `${matchedUser.employeeName} (${matchedUser.email})` 
            : (matchedUser?.displayName || matchedUser?.email || lvl.approverName || 'User');
          return {
            ...lvl,
            level: index + 1,
            approverType: 'user',
            approverId: uid,
            approverUid: uid,
            approverEmail: email,
            approverRole: matchedUser?.roleName || matchedUser?.role || '',
            approverName: name,
            amountLimit: lvl.amountLimit || 500000
          };
        } else {
          const matchedRole = roles.find(r => r.id === lvl.approverId || r.roleName === lvl.approverId);
          const roleId = matchedRole?.id || lvl.approverId;
          const roleName = matchedRole?.roleName || lvl.approverName || roleId;
          return {
            ...lvl,
            level: index + 1,
            approverType: 'role',
            approverId: roleId,
            approverRole: roleId,
            approverUid: '',
            approverEmail: '',
            approverName: roleName,
            amountLimit: lvl.amountLimit || 500000
          };
        }
      });

      const firstLevel: ApprovalLevelConfig = enrichedLevels[0] || {
        level: 1,
        approverType: 'role',
        approverId: roles[0]?.id || 'admin',
        approverRole: roles[0]?.id || 'admin',
        approverName: roles[0]?.roleName || 'Admin',
        amountLimit: 100000
      };

      const payload: any = {
        pageId: selectedPageId,
        pageName: pageMeta?.pageName || selectedPageId,
        module: pageMeta?.module || 'General',
        approvalRequired,
        approvalType: firstLevel.approverType,
        approverId: firstLevel.approverId,
        approverUid: firstLevel.approverUid || '',
        approverEmail: firstLevel.approverEmail || '',
        approverRole: firstLevel.approverRole || '',
        approverName: firstLevel.approverName,
        status: approvalRequired ? status : 'inactive',
        levels: enrichedLevels,
        businessId: businessId || 'default',
        updatedAt: Timestamp.now()
      };

      if (existing) {
        await setDoc(doc(db, 'approval_rules', existing.id), payload, { merge: true });
        showToast(`Approval setup saved for ${pageMeta?.pageName || selectedPageId}.`, 'success');
      } else {
        await addDoc(collection(db, 'approval_rules'), {
          ...payload,
          createdAt: Timestamp.now()
        });
        showToast(`Approval setup created for ${pageMeta?.pageName || selectedPageId}.`, 'success');
      }

      setIsModalOpen(false);
      setEditingRule(null);
      setSelectedPageId('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      showToast('Failed to save approval setup: ' + (err?.message || 'Database error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPages = allWorkflowPages.filter(p => {
    const matchModule = selectedModuleFilter === 'ALL' || p.module === selectedModuleFilter;
    const matchSearch = p.pageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchModule && matchSearch;
  });

  const selectedPageMeta = ERP_PAGE_REGISTRY.find(p => p.id === selectedPageId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" /> Approval Workflow Setup
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Select which ERP document pages require approval before posting, and configure designated approvers (User or Role).
          </p>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <input
            type="text"
            placeholder="Search document or ERP page..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Module Filter Pills */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-neutral-600 flex items-center gap-1 mr-2">
          <Filter className="w-3.5 h-3.5 text-neutral-400" /> Filter Module:
        </span>
        <button
          onClick={() => setSelectedModuleFilter('ALL')}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
            selectedModuleFilter === 'ALL' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          All Process Workflows ({allWorkflowPages.length})
        </button>
        {availableWorkflowModules.map(mod => (
          <button
            key={mod}
            onClick={() => setSelectedModuleFilter(mod)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              selectedModuleFilter === mod ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {mod}
          </button>
        ))}
      </div>

      {/* Supported Documents Grid */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Module</th>
                <th className="p-3">ERP Document / Page</th>
                <th className="p-3">Approval Requirement</th>
                <th className="p-3">Levels Configured</th>
                <th className="p-3">Designated Approver</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredPages.map(page => {
                const rule = approvalRules.find(r => r.pageId === page.id);
                const isRequired = !!(rule?.approvalRequired && rule?.status === 'active');

                return (
                  <tr key={page.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3 font-semibold text-neutral-500">
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[10px] font-bold">
                        {page.module}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-neutral-900">
                      {page.pageName}
                      <p className="text-[11px] text-neutral-400 font-normal">{page.description}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleApprovalDirectly(page.id, isRequired)}
                          className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isRequired ? 'bg-emerald-600' : 'bg-neutral-200'
                          }`}
                          title="Toggle Approval requirement"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isRequired ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className={`text-[11px] font-bold ${isRequired ? 'text-emerald-700' : 'text-neutral-500'}`}>
                          {isRequired ? 'Approval Required' : 'Direct Posting'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-bold text-neutral-700">
                      {isRequired && rule?.levels && rule.levels.length > 0 ? (
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded font-extrabold text-[11px]">
                          {rule.levels.length} Level{rule.levels.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">None (Direct)</span>
                      )}
                    </td>
                    <td className="p-3 text-neutral-800 font-medium">
                      {isRequired && rule?.approverName ? (
                        <span className="font-bold text-indigo-950 flex items-center gap-1">
                          {rule.approvalType === 'user' ? '👤 User: ' : '🛡️ Role: '}
                          {rule.approverName}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openConfigModal(page.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 ml-auto transition-all"
                        title="Configure workflow and select approvers"
                      >
                        <Sliders className="w-3.5 h-3.5" /> Configure Approver
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredPages.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                    No documents found matching query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Setup Approval Workflow */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 text-base">
                    Configure Approval Workflow
                  </h3>
                  <p className="text-xs text-neutral-500 font-bold text-emerald-700">
                    {selectedPageMeta?.pageName} ({selectedPageMeta?.module})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveApprovalRule} className="space-y-6 text-xs">
              {/* Approval Required Toggle */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between">
                <div>
                  <label className="font-bold text-neutral-800 text-xs">Is Approval Required for this Page?</label>
                  <p className="text-[11px] text-neutral-500">
                    When enabled, documents submitted on this page will require authorized sign-off before final posting.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setApprovalRequired(true)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                      approvalRequired ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border text-neutral-600'
                    }`}
                  >
                    Yes (Approval Required)
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalRequired(false)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                      !approvalRequired ? 'bg-rose-600 text-white shadow-sm' : 'bg-white border text-neutral-600'
                    }`}
                  >
                    No (Direct Posting)
                  </button>
                </div>
              </div>

              {approvalRequired && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-neutral-800">Multi-Level Approvers & Limit Thresholds</h4>
                      <p className="text-[11px] text-neutral-500">Configure who approves at each sequential tier (Role or Specific User Account).</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLevel}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Level
                    </button>
                  </div>

                  <div className="space-y-3">
                    {levels.map((lvl, index) => (
                      <div key={index} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                        <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                          <span className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                              {lvl.level}
                            </span>
                            Approval Tier Level {lvl.level}
                          </span>
                          {levels.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLevel(index)}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="font-bold text-neutral-600 uppercase text-[10px]">Approver Type</label>
                            <select
                              value={lvl.approverType}
                              onChange={(e) => handleLevelChange(index, 'approverType', e.target.value)}
                              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="role">By Role (e.g. Purchase Manager)</option>
                              <option value="user">By Specific User Account</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-neutral-600 uppercase text-[10px]">
                              {lvl.approverType === 'role' ? 'Select Approving Role' : 'Select Approving User'}
                            </label>
                            {lvl.approverType === 'role' ? (
                              <select
                                value={lvl.approverRole || lvl.approverId}
                                onChange={(e) => handleLevelChange(index, 'approverId', e.target.value)}
                                className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-bold text-xs text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="super-admin">Super Admin</option>
                                <option value="admin">Admin</option>
                                <option value="purchase-manager">Purchase Manager</option>
                                <option value="store-manager">Store Manager</option>
                                <option value="sales-manager">Sales Manager</option>
                                <option value="accounts-manager">Accounts Manager</option>
                                <option value="production-manager">Production Manager</option>
                                <option value="md">Managing Director (MD)</option>
                                <option value="gm">General Manager (GM)</option>
                                {roles.map(r => (
                                  <option key={r.id} value={r.id}>{r.roleName}</option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={lvl.approverUid || lvl.approverId}
                                onChange={(e) => handleLevelChange(index, 'approverId', e.target.value)}
                                className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-bold text-xs text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                {users.length === 0 && <option value="">No registered users available</option>}
                                {users.map(u => {
                                  const uKey = u.uid || u.id;
                                  return (
                                    <option key={uKey} value={uKey}>
                                      {u.employeeName ? `${u.employeeName} (${u.email})` : (u.displayName ? `${u.displayName} (${u.email})` : u.email)}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-neutral-600 uppercase text-[10px]">Approval Threshold Limit (BDT)</label>
                            <input
                              type="number"
                              placeholder="e.g. 500000"
                              value={lvl.amountLimit || ''}
                              onChange={(e) => handleLevelChange(index, 'amountLimit', parseFloat(e.target.value) || 0)}
                              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20"
                >
                  {isSubmitting ? 'Saving...' : 'Save Workflow Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
