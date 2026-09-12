import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Save, 
  RotateCcw, 
  CheckSquare, 
  Square, 
  Users, 
  KeyRound, 
  Layers, 
  Filter,
  Info,
  Shield,
  ShieldAlert,
  Check,
  X,
  LayoutDashboard,
  ShoppingBag,
  Factory,
  Package,
  Coins,
  Sparkles
} from 'lucide-react';
import { UserAccountModel, RoleModel, PermissionMatrix, PageActionPermission } from './adminTypes';
import { ERP_PAGE_REGISTRY, ERP_MODULE_CATEGORIES } from './pageRegistry';
import { buildFullPermissionMatrix, getDefaultPermission } from './adminUtils';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

interface PermissionManagementProps {
  users: UserAccountModel[];
  roles: RoleModel[];
  selectedRoleFromNav?: RoleModel | null;
  selectedUserFromNav?: UserAccountModel | null;
  currentUserEmail?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

const SUPER_ADMINS = ['rajonpaul300@gmail.com', 'estore@gmail.com', 'esstore@gmail.com', 'rajon.estrims@gmail.com'];

export const PermissionManagement: React.FC<PermissionManagementProps> = ({
  users,
  roles,
  selectedRoleFromNav,
  selectedUserFromNav,
  currentUserEmail = '',
  showToast,
  onRefresh
}) => {
  const [targetType, setTargetType] = useState<'role' | 'user'>('role');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('ALL');

  // Permission Matrix State
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [originalMatrix, setOriginalMatrix] = useState<PermissionMatrix>({});
  const [isSaving, setIsSaving] = useState(false);

  // Switch target handler
  const handleSwitchTargetType = (type: 'role' | 'user') => {
    setTargetType(type);
    if (type === 'user') {
      if (!selectedUserId && users.length > 0) {
        setSelectedUserId(users[0].id || users[0].uid || '');
      }
    } else {
      if (!selectedRoleId && roles.length > 0) {
        setSelectedRoleId(roles[0].id);
      }
    }
  };

  // Initialize selection
  useEffect(() => {
    if (selectedUserFromNav) {
      setTargetType('user');
      setSelectedUserId(selectedUserFromNav.id || selectedUserFromNav.uid || '');
    } else if (selectedRoleFromNav) {
      setTargetType('role');
      setSelectedRoleId(selectedRoleFromNav.id);
    }
  }, [selectedRoleFromNav, selectedUserFromNav]);

  // Keep selected ID synchronized when lists load or change
  useEffect(() => {
    if (targetType === 'user') {
      if ((!selectedUserId || !users.some(u => (u.id || u.uid) === selectedUserId)) && users.length > 0) {
        setSelectedUserId(users[0].id || users[0].uid || '');
      }
    } else {
      if ((!selectedRoleId || !roles.some(r => r.id === selectedRoleId)) && roles.length > 0) {
        setSelectedRoleId(roles[0].id);
      }
    }
  }, [targetType, users, roles, selectedUserId, selectedRoleId]);

  // Load Matrix when target changes
  useEffect(() => {
    let loaded: PermissionMatrix = {};

    if (targetType === 'role' && selectedRoleId) {
      const roleObj = roles.find(r => r.id === selectedRoleId);
      if (roleObj) {
        loaded = roleObj.permissions || {};
      }
    } else if (targetType === 'user' && selectedUserId) {
      const userObj = users.find(u => u.id === selectedUserId || u.uid === selectedUserId);
      if (userObj) {
        if (userObj.customPermissions && Object.keys(userObj.customPermissions).length > 0) {
          loaded = userObj.customPermissions;
        } else {
          // Inherit role matrix as starting base if configured
          const roleObj = roles.find(r => r.id === userObj.roleId || r.roleName === userObj.roleName);
          loaded = roleObj?.permissions || {};
        }
      }
    }

    const selectedUserObj = users.find(u => u.id === selectedUserId || u.uid === selectedUserId);
    const selectedUserEmail = (selectedUserObj?.email || '').toLowerCase().replace(/\s+/g, '');
    const isSuperUser = SUPER_ADMINS.includes(selectedUserEmail);
    const isSuperRole = targetType === 'role' && (roles.find(r => r.id === selectedRoleId)?.roleName === 'Super Admin' || selectedRoleId === 'super-admin');

    const isSuper = isSuperUser || isSuperRole;

    // Ensure all pages exist in matrix
    const fullMatrix: PermissionMatrix = {};
    ERP_PAGE_REGISTRY.forEach(p => {
      fullMatrix[p.id] = loaded[p.id] ? { ...loaded[p.id] } : getDefaultPermission(isSuper);
    });

    setMatrix(fullMatrix);
    setOriginalMatrix(JSON.parse(JSON.stringify(fullMatrix)));
  }, [targetType, selectedRoleId, selectedUserId, roles, users]);

  // Toggle single action checkbox
  const handleToggleAction = (pageId: string, action: keyof PageActionPermission) => {
    setMatrix(prev => ({
      ...prev,
      [pageId]: {
        ...prev[pageId],
        [action]: !prev[pageId]?.[action]
      }
    }));
  };

  // Select All for entire system
  const handleSelectAllSystem = () => {
    const updated: PermissionMatrix = {};
    ERP_PAGE_REGISTRY.forEach(p => {
      updated[p.id] = { view: true, create: true, edit: true, delete: true, print: true, export: true };
    });
    setMatrix(updated);
  };

  // Clear All for entire system (Revoke all permissions)
  const handleClearAllSystem = () => {
    const updated: PermissionMatrix = {};
    ERP_PAGE_REGISTRY.forEach(p => {
      updated[p.id] = { view: false, create: false, edit: false, delete: false, print: false, export: false };
    });
    setMatrix(updated);
  };

  // Module level Select All / Clear All
  const handleSelectModule = (modName: string, enable: boolean) => {
    setMatrix(prev => {
      const copy = { ...prev };
      ERP_PAGE_REGISTRY.filter(p => p.module === modName).forEach(p => {
        copy[p.id] = {
          view: enable,
          create: enable,
          edit: enable,
          delete: enable,
          print: enable,
          export: enable
        };
      });
      return copy;
    });
  };

  // Toggle column action for entire visible/filtered list
  const handleToggleColumn = (action: keyof PageActionPermission) => {
    const s = searchTerm.trim().toLowerCase();
    const filteredPages = ERP_PAGE_REGISTRY.filter(p => {
      const matchModule = selectedModuleFilter === 'ALL' || p.module === selectedModuleFilter;
      const matchSearch = !s ||
        p.pageName.toLowerCase().includes(s) ||
        p.module.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.route.toLowerCase().includes(s) ||
        (p.description || '').toLowerCase().includes(s);
      return matchModule && matchSearch;
    });

    const allChecked = filteredPages.every(p => matrix[p.id]?.[action]);
    const targetValue = !allChecked;

    setMatrix(prev => {
      const copy = { ...prev };
      filteredPages.forEach(p => {
        copy[p.id] = {
          ...copy[p.id],
          [action]: targetValue
        };
      });
      return copy;
    });
  };

  const handleResetChanges = () => {
    setMatrix(JSON.parse(JSON.stringify(originalMatrix)));
    showToast('Permission matrix reverted to previous state.', 'info');
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      const allowedPagesList = Object.keys(matrix).filter(pId => matrix[pId]?.view);

      if (targetType === 'role') {
        const effectiveRoleId = selectedRoleId || (roles.length > 0 ? roles[0].id : '');
        if (!effectiveRoleId) {
          showToast('Please select a role to save permissions.', 'error');
          setIsSaving(false);
          return;
        }
        const matchedRole = roles.find(r => r.id === effectiveRoleId);
        const roleDocId = matchedRole?.id || effectiveRoleId;
        const roleRef = doc(db, 'roles', roleDocId);

        await setDoc(roleRef, {
          roleName: matchedRole?.roleName || effectiveRoleId,
          roleCode: matchedRole?.roleCode || (matchedRole?.roleName || effectiveRoleId).toUpperCase().replace(/[^A-Z0-9]/g, '_'),
          description: matchedRole?.description || '',
          status: matchedRole?.status || 'active',
          permissions: matrix,
          allowedPages: allowedPagesList,
          updatedAt: Timestamp.now()
        }, { merge: true });

        showToast(`Permissions updated for role "${matchedRole?.roleName || effectiveRoleId}" (${allowedPagesList.length} pages enabled).`, 'success');
      } else {
        const effectiveUserId = selectedUserId || (users.length > 0 ? (users[0].id || users[0].uid) : '');
        if (!effectiveUserId) {
          showToast('Please select a user to save permissions.', 'error');
          setIsSaving(false);
          return;
        }
        const matchedUser = users.find(u => u.id === effectiveUserId || u.uid === effectiveUserId || u.email === effectiveUserId);
        const userDocId = matchedUser?.id || matchedUser?.uid || effectiveUserId;
        const userRef = doc(db, 'users', userDocId);

        await setDoc(userRef, {
          customPermissions: matrix,
          allowedPages: allowedPagesList,
          updatedAt: Timestamp.now()
        }, { merge: true });

        showToast(`Custom permissions saved for user "${matchedUser?.employeeName || matchedUser?.displayName || matchedUser?.email || 'Selected User'}" (${allowedPagesList.length} pages enabled).`, 'success');
      }

      setOriginalMatrix(JSON.parse(JSON.stringify(matrix)));
      onRefresh();
    } catch (err: any) {
      console.error('Failed to save permissions:', err);
      showToast('Failed to save permissions: ' + (err?.message || 'Database error'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPages = ERP_PAGE_REGISTRY.filter(p => {
    const matchModule = selectedModuleFilter === 'ALL' || p.module === selectedModuleFilter;
    const s = searchTerm.trim().toLowerCase();
    const matchSearch = !s ||
      p.pageName.toLowerCase().includes(s) ||
      p.module.toLowerCase().includes(s) ||
      p.id.toLowerCase().includes(s) ||
      p.route.toLowerCase().includes(s) ||
      (p.description || '').toLowerCase().includes(s);
    return matchModule && matchSearch;
  });

  const selectedUserObj = users.find(u => u.id === selectedUserId || u.uid === selectedUserId || u.email === selectedUserId);
  const selectedUserEmail = (selectedUserObj?.email || '').toLowerCase().replace(/\s+/g, '');
  const isSuperUser = SUPER_ADMINS.includes(selectedUserEmail);
  const selectedRoleObj = roles.find(r => r.id === selectedRoleId);

  const activeAllowedPagesCount = Object.keys(matrix).filter(pId => matrix[pId]?.view).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" /> Permission Management Matrix
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Dynamically assign View, Entry/Create, Edit, Delete, Print and Export capabilities across all ERP pages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetChanges}
              className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Changes
            </button>
            <button
              onClick={handleSavePermissions}
              disabled={isSaving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving Matrix...' : `Save Permissions (${activeAllowedPagesCount} Pages Allowed)`}
            </button>
          </div>
        </div>

        {/* Target Selection Top Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
          <div className="space-y-1">
            <label className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Target Level</label>
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-indigo-200">
              <button
                type="button"
                onClick={() => handleSwitchTargetType('role')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  targetType === 'role' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Role Permissions
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTargetType('user')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  targetType === 'user' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> User-Specific Permissions
              </button>
            </div>
          </div>

          {targetType === 'role' ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Select Role</label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-indigo-200 bg-white font-bold text-xs text-neutral-900 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.roleName} ({r.description || 'Custom Role'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Select Specific User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-indigo-200 bg-white font-bold text-xs text-neutral-900 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {users.map(u => {
                  const uVal = u.id || u.uid;
                  return (
                    <option key={uVal} value={uVal}>
                      {u.employeeName || u.displayName || u.username || u.email?.split('@')[0]} — {u.email} ({u.roleName || u.role || 'User'})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Quick Stats Box */}
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100">
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Currently Configured</p>
              <p className="text-xs font-black text-indigo-950 truncate">
                {targetType === 'role' ? selectedRoleObj?.roleName || 'Role' : selectedUserObj?.email || 'User'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Pages Enabled</p>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 font-extrabold text-xs rounded-full">
                {activeAllowedPagesCount} / {ERP_PAGE_REGISTRY.length}
              </span>
            </div>
          </div>
        </div>

        {/* Super Admin Notice if super user selected */}
        {targetType === 'user' && isSuperUser && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-900">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Super Admin Account:</strong> <code className="font-mono font-bold">{selectedUserObj?.email}</code> is a protected system owner account with full access.
            </span>
          </div>
        )}

        {/* Dashboard View Assignment Section (User Request: Permission matrix theke dashboard select) */}
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/60 p-4 md:p-5 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                <h3 className="text-sm font-black text-indigo-950 flex items-center gap-1.5">
                  <LayoutDashboard className="w-4 h-4 text-indigo-600" /> Dashboard View Permissions / ড্যাশবোর্ড এক্সেস নির্ধারণ
                </h3>
              </div>
              <p className="text-[11px] text-indigo-900/70 mt-0.5">
                Select which specific dashboard(s) this {targetType === 'role' ? 'role' : 'user'} can view. If only one dashboard is selected, the user will directly see that dashboard upon opening.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 self-start sm:self-auto">
              Selected: {[
                matrix['dashboard']?.view && 'Executive',
                matrix['dashboard-sales']?.view && 'Sales',
                matrix['dashboard-production']?.view && 'Production',
                matrix['dashboard-inventory']?.view && 'Inventory',
                matrix['dashboard-accounts']?.view && 'Accounts'
              ].filter(Boolean).join(', ') || 'None (No Dashboard)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {[
              { id: 'dashboard', label: 'Executive Overview', desc: 'All modules KPI overview', icon: LayoutDashboard, color: 'text-indigo-600', activeBorder: 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20' },
              { id: 'dashboard-sales', label: 'Sales & Orders', desc: 'Orders, targets & buyers', icon: ShoppingBag, color: 'text-blue-600', activeBorder: 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20' },
              { id: 'dashboard-production', label: 'Production Floor', desc: 'Line output & scrap rate', icon: Factory, color: 'text-purple-600', activeBorder: 'border-purple-500 bg-purple-50/70 ring-2 ring-purple-500/20' },
              { id: 'dashboard-inventory', label: 'Inventory & Store', desc: 'Stock valuation & alerts', icon: Package, color: 'text-emerald-600', activeBorder: 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20' },
              { id: 'dashboard-accounts', label: 'Accounts & Finance', desc: 'Cash/bank & payables', icon: Coins, color: 'text-amber-600', activeBorder: 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20' },
            ].map(dash => {
              const Icon = dash.icon;
              const isEnabled = !!matrix[dash.id]?.view;
              return (
                <div
                  key={dash.id}
                  onClick={() => handleToggleAction(dash.id, 'view')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    isEnabled
                      ? dash.activeBorder
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-white shadow-xs' : 'bg-neutral-100'} ${dash.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}>
                      {isEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-900 leading-tight">{dash.label}</h4>
                    <p className="text-[10px] text-neutral-500 leading-tight mt-0.5">{dash.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Controls & Bulk Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-neutral-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-neutral-400" /> Module:
            </span>
            <button
              onClick={() => setSelectedModuleFilter('ALL')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedModuleFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              All Modules ({ERP_PAGE_REGISTRY.length})
            </button>
            {ERP_MODULE_CATEGORIES.map(mod => {
              const count = ERP_PAGE_REGISTRY.filter(p => p.module === mod).length;
              return (
                <button
                  key={mod}
                  onClick={() => setSelectedModuleFilter(mod)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    selectedModuleFilter === mod ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {mod} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter pages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleSelectAllSystem}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl flex items-center gap-1"
              title="Grant all permissions across all modules"
            >
              <Check className="w-3.5 h-3.5" /> Select All
            </button>
            <button
              onClick={handleClearAllSystem}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1"
              title="Revoke all permissions"
            >
              <X className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Permission Matrix Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-700 uppercase text-[10px] tracking-wider sticky top-0 z-10">
              <tr>
                <th className="p-3 w-1/4">Module & ERP Page</th>
                <th className="p-3 w-1/4">Description & Route</th>
                <th className="p-3 text-center">
                  <button 
                    onClick={() => handleToggleColumn('view')}
                    className="font-bold hover:text-indigo-600 flex items-center justify-center gap-1 w-full"
                    title="Toggle View permission for all filtered rows"
                  >
                    View / Access
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button 
                    onClick={() => handleToggleColumn('create')}
                    className="font-bold hover:text-indigo-600 flex items-center justify-center gap-1 w-full"
                    title="Toggle Create/Entry permission for all filtered rows"
                  >
                    Create / Entry
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button 
                    onClick={() => handleToggleColumn('edit')}
                    className="font-bold hover:text-indigo-600 flex items-center justify-center gap-1 w-full"
                    title="Toggle Edit permission for all filtered rows"
                  >
                    Edit / Modify
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button 
                    onClick={() => handleToggleColumn('delete')}
                    className="font-bold hover:text-rose-600 flex items-center justify-center gap-1 w-full"
                    title="Toggle Delete permission for all filtered rows"
                  >
                    Delete
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button 
                    onClick={() => handleToggleColumn('print')}
                    className="font-bold hover:text-indigo-600 flex items-center justify-center gap-1 w-full"
                    title="Toggle Print/Slip permission for all filtered rows"
                  >
                    Print
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button 
                    onClick={() => handleToggleColumn('export')}
                    className="font-bold hover:text-indigo-600 flex items-center justify-center gap-1 w-full"
                    title="Toggle CSV/Excel Export for all filtered rows"
                  >
                    Export
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredPages.map((page, idx) => {
                const isViewEnabled = !!matrix[page.id]?.view;

                return (
                  <tr 
                    key={page.id} 
                    className={`transition-colors ${
                      isViewEnabled ? 'hover:bg-neutral-50/80 bg-white' : 'bg-neutral-50/40 text-neutral-400 hover:bg-neutral-100/50'
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[9px] font-bold">
                          {page.module}
                        </span>
                        <span className={`font-bold ${isViewEnabled ? 'text-neutral-900' : 'text-neutral-500'}`}>
                          {page.pageName}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="text-[11px] text-neutral-500 line-clamp-1">{page.description}</p>
                      <code className="text-[9px] text-neutral-400 font-mono">{page.route}</code>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[page.id]?.view}
                        onChange={() => handleToggleAction(page.id, 'view')}
                        className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[page.id]?.create}
                        disabled={!isViewEnabled}
                        onChange={() => handleToggleAction(page.id, 'create')}
                        className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[page.id]?.edit}
                        disabled={!isViewEnabled}
                        onChange={() => handleToggleAction(page.id, 'edit')}
                        className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[page.id]?.delete}
                        disabled={!isViewEnabled}
                        onChange={() => handleToggleAction(page.id, 'delete')}
                        className="w-4 h-4 text-rose-600 rounded border-neutral-300 focus:ring-rose-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[page.id]?.print}
                        disabled={!isViewEnabled}
                        onChange={() => handleToggleAction(page.id, 'print')}
                        className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!matrix[page.id]?.export}
                        disabled={!isViewEnabled}
                        onChange={() => handleToggleAction(page.id, 'export')}
                        className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                );
              })}
              {filteredPages.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400 italic">
                    No ERP pages found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
