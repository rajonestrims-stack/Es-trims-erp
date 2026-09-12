import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  Briefcase, 
  Building2, 
  Clock, 
  Settings, 
  ChevronRight, 
  Menu, 
  X,
  AlertCircle,
  Check,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Database
} from 'lucide-react';
import { 
  UserAccountModel, 
  RoleModel, 
  ApprovalRuleModel, 
  EmployeeModel, 
  DesignationModel, 
  DepartmentModel, 
  AuditLogModel, 
  SystemSettingsModel 
} from './adminTypes';
import { AdminDashboard } from './AdminDashboard';
import { UserManagement } from './UserManagement';
import { RoleManagement } from './RoleManagement';
import { PermissionManagement } from './PermissionManagement';
import { ApprovalSetup } from './ApprovalSetup';
import { EmployeeManagement } from './EmployeeManagement';
import { DesignationManagement } from './DesignationManagement';
import { DepartmentManagement } from './DepartmentManagement';
import { AuditLog } from './AuditLog';
import { SystemSettings } from './SystemSettings';
import { DataMigrationManager } from '../components/DataMigrationManager';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';

interface AdminLayoutProps {
  currentUserEmail?: string;
  currentUserName?: string;
  businessId: string;
  onReturnToErp?: () => void;
  activeTabOverride?: string;
  embedMode?: boolean;
  onTabChange?: (tab: string) => void;
  allowedPagesSet?: Set<string>;
  roles?: any[];
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentUserEmail,
  currentUserName,
  businessId = 'default',
  onReturnToErp,
  activeTabOverride,
  embedMode = false,
  onTabChange,
  allowedPagesSet,
  roles: _propRoles = []
}) => {
  const getTabFromOverride = (tabOverride?: string) => {
    if (!tabOverride) return null;
    if (tabOverride === 'admin' || tabOverride === 'admin-dashboard' || tabOverride === 'dashboard') return 'dashboard';
    if (tabOverride === 'admin-users' || tabOverride === 'users') return 'users';
    if (tabOverride === 'admin-roles' || tabOverride === 'roles') return 'roles';
    if (tabOverride === 'admin-permissions' || tabOverride === 'permissions' || tabOverride === 'admin-permission') return 'permissions';
    if (
      tabOverride === 'admin-approvals' || 
      tabOverride === 'admin-approval-setup' || 
      tabOverride === 'admin-approval' || 
      tabOverride === 'approval-setup' || 
      tabOverride === 'approvals' || 
      tabOverride === 'approval' ||
      tabOverride === 'approval-mapping' ||
      tabOverride === 'admin-approval-mapping'
    ) return 'approval-setup';
    if (tabOverride === 'admin-employees' || tabOverride === 'employees') return 'employees';
    if (tabOverride === 'admin-designations' || tabOverride === 'designations') return 'designations';
    if (tabOverride === 'admin-departments' || tabOverride === 'departments') return 'departments';
    if (tabOverride === 'admin-audit-log' || tabOverride === 'admin-logs' || tabOverride === 'audit-log' || tabOverride === 'logs') return 'audit-log';
    if (tabOverride === 'admin-settings' || tabOverride === 'settings') return 'settings';
    if (tabOverride === 'sql-migration' || tabOverride === 'admin-sql-migration' || tabOverride === 'data-migration') return 'sql-migration';
    return tabOverride.replace(/^admin-?/, '') || 'dashboard';
  };

  const [internalActiveTab, setInternalActiveTab] = useState<string>('dashboard');
  const activeTab = getTabFromOverride(activeTabOverride) || internalActiveTab;

  const handleTabChange = (tab: string) => {
    setInternalActiveTab(tab);
    if (onTabChange) {
      onTabChange('admin-' + tab);
    }
  };

  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<RoleModel | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Firestore Real-time Collections State
  const [users, setUsers] = useState<UserAccountModel[]>([]);
  const [roles, setRoles] = useState<RoleModel[]>([]);
  const [approvalRules, setApprovalRules] = useState<ApprovalRuleModel[]>([]);
  const [employees, setEmployees] = useState<EmployeeModel[]>([]);
  const [designations, setDesignations] = useState<DesignationModel[]>([]);
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogModel[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettingsModel | null>(null);

  // Toast Notification State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Subscribe to Users
  useEffect(() => {
    const q = collection(db, 'users');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: UserAccountModel[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as UserAccountModel);
      });
      setUsers(list);
    }, (err) => console.error('Users sub err:', err));
    return () => unsub();
  }, []);

  // Subscribe to Roles
  useEffect(() => {
    const q = collection(db, 'roles');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: RoleModel[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as RoleModel);
      });
      setRoles(list);
    }, (err) => console.error('Roles sub err:', err));
    return () => unsub();
  }, []);

  // Subscribe to Approval Rules
  useEffect(() => {
    const q = collection(db, 'approval_rules');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: ApprovalRuleModel[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as ApprovalRuleModel);
      });
      setApprovalRules(list);
    }, (err) => console.error('Approval rules sub err:', err));
    return () => unsub();
  }, []);

  // Subscribe to Employees
  useEffect(() => {
    const q = collection(db, 'employees');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: EmployeeModel[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as EmployeeModel);
      });
      setEmployees(list);
    }, (err) => console.error('Employees sub err:', err));
    return () => unsub();
  }, []);

  // Subscribe to Designations
  useEffect(() => {
    const q = collection(db, 'designations');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DesignationModel[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as DesignationModel);
      });
      setDesignations(list);
    }, (err) => console.error('Designations sub err:', err));
    return () => unsub();
  }, []);

  // Subscribe to Departments
  useEffect(() => {
    const q = collection(db, 'departments');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DepartmentModel[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as DepartmentModel);
      });
      setDepartments(list);
    }, (err) => console.error('Departments sub err:', err));
    return () => unsub();
  }, []);

  // Subscribe to Audit Logs
  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: AuditLogModel[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as AuditLogModel);
      });
      setAuditLogs(list);
    }, (err) => console.error('Audit logs sub err:', err));
    return () => unsub();
  }, []);

  // Subscribe to System Settings
  useEffect(() => {
    const q = collection(db, 'system_settings');
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.forEach(doc => {
        setSystemSettings({ id: doc.id, ...doc.data() } as SystemSettingsModel);
      });
    }, (err) => console.error('Settings sub err:', err));
    return () => unsub();
  }, []);

  const [selectedUserForPerms, setSelectedUserForPerms] = useState<UserAccountModel | null>(null);

  const handleAssignRolePermissions = (role: RoleModel) => {
    setSelectedRoleForPerms(role);
    setSelectedUserForPerms(null);
    handleTabChange('permissions');
  };

  const handleAssignUserPermissions = (user: UserAccountModel) => {
    setSelectedUserForPerms(user);
    setSelectedRoleForPerms(null);
    handleTabChange('permissions');
  };

  const superAdminEmails = ['rajonpaul300@gmail.com', 'estore@gmail.com', 'esstore@gmail.com', 'rajon.estrims@gmail.com'];
  const userEmailLower = (currentUserEmail || '').toLowerCase().replace(/\s+/g, '');
  const isSuperAdmin = superAdminEmails.includes(userEmailLower);

  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  const allNavItems = [
    { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, checkIds: ['admin-dashboard', 'admin'] },
    { id: 'users', label: 'User Management', icon: Users, badge: users.length, checkIds: ['admin-users', 'admin'] },
    { id: 'roles', label: 'Role Management', icon: KeyRound, badge: roles.length, checkIds: ['admin-roles', 'admin'] },
    { id: 'permissions', label: 'Permission Matrix', icon: ShieldCheck, checkIds: ['admin-permissions', 'admin'] },
    { id: 'approval-setup', label: 'Approval Workflows', icon: CheckCircle2, badge: approvalRules.length, checkIds: ['admin-approvals', 'admin'] },
    { id: 'employees', label: 'Employee Master', icon: Briefcase, badge: employees.length, checkIds: ['admin-employees', 'admin'] },
    { id: 'designations', label: 'Designations', icon: Building2, checkIds: ['admin-designations', 'admin'] },
    { id: 'departments', label: 'Departments', icon: Building2, checkIds: ['admin-departments', 'admin'] },
    { id: 'audit-log', label: 'System Audit Log', icon: Clock, checkIds: ['admin-audit-log', 'admin'] },
    { id: 'settings', label: 'System Settings', icon: Settings, checkIds: ['admin-settings', 'admin'] },
    ...(isSuperAdmin ? [{ id: 'sql-migration', label: 'Cloud SQL Migration Hub', icon: Database, badge: 'Cloud SQL', checkIds: ['sql-migration', 'admin'] }] : [])
  ];

  const navItems = allNavItems.filter(item => item.checkIds.some(cid => isPagePermitted(cid)));

  const currentNav = navItems.find(n => n.id === activeTab);

  if (embedMode) {
    return (
      <div className="space-y-6">
        {/* Toast Alert Floating Top */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-3 duration-200">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${
              toast.type === 'success' ? 'bg-emerald-950 text-emerald-100 border-emerald-800' :
              toast.type === 'error' ? 'bg-rose-950 text-rose-100 border-rose-800' :
              'bg-slate-900 text-slate-100 border-slate-700'
            }`}>
              {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{toast.msg}</span>
            </div>
          </div>
        )}

        {/* Module Breadcrumb & Navigation Header inside ERP */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-t-2xl">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-xl shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[11px] text-indigo-300 font-bold uppercase tracking-wider">
                  <span className="hover:text-white cursor-pointer transition-colors" onClick={() => handleTabChange('dashboard')}>
                    Enterprise Admin Panel
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-white font-extrabold">{currentNav?.label || 'Dashboard'}</span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  {currentNav?.label || 'Admin Control Panel'}
                </h2>
              </div>
            </div>

            {/* Quick KPI Pills in Header */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-300 font-medium">Users:</span>
                <span className="text-white font-bold">{users.length}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs">
                <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-300 font-medium">Roles:</span>
                <span className="text-white font-bold">{roles.length}</span>
              </div>
              <div 
                onClick={() => handleTabChange('approval-setup')}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 rounded-xl text-xs cursor-pointer hover:bg-emerald-900/60 transition-colors"
                title="Click to manage Approval Workflows & Mapping"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold">Approval Rules:</span>
                <span className="bg-emerald-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">{approvalRules.length}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation Pill Bar */}
          <div className="p-2.5 bg-slate-50/80 border-t border-neutral-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isApprovalTab = item.id === 'approval-setup';

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : isApprovalTab
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-white hover:shadow-xs'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isApprovalTab ? 'text-emerald-600' : 'text-neutral-500'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isActive 
                        ? 'bg-indigo-700 text-white' 
                        : isApprovalTab 
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active View Renderer */}
        {activeTab === 'dashboard' && (
          <AdminDashboard
            users={users}
            roles={roles}
            approvalRules={approvalRules}
            employees={employees}
            auditLogs={auditLogs}
            onNavigate={(tab) => handleTabChange(tab)}
            isPagePermitted={isPagePermitted}
          />
        )}

        {activeTab === 'users' && (
          <UserManagement
            users={users}
            roles={roles}
            employees={employees}
            departments={departments}
            designations={designations}
            businessId={businessId}
            currentUserEmail={currentUserEmail}
            showToast={showToast}
            onRefresh={() => {}}
            onNavigateToPermissions={handleAssignUserPermissions}
          />
        )}

        {activeTab === 'roles' && (
          <RoleManagement
            roles={roles}
            businessId={businessId}
            showToast={showToast}
            onRefresh={() => {}}
            onAssignPermissions={handleAssignRolePermissions}
          />
        )}

        {activeTab === 'permissions' && (
          <PermissionManagement
            users={users}
            roles={roles}
            selectedRoleFromNav={selectedRoleForPerms}
            selectedUserFromNav={selectedUserForPerms}
            currentUserEmail={currentUserEmail}
            showToast={showToast}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'approval-setup' && (
          <ApprovalSetup
            approvalRules={approvalRules}
            users={users}
            roles={roles}
            businessId={businessId}
            showToast={showToast}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeeManagement
            employees={employees}
            departments={departments}
            designations={designations}
            businessId={businessId}
            showToast={showToast}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'designations' && (
          <DesignationManagement
            designations={designations}
            departments={departments}
            businessId={businessId}
            showToast={showToast}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'departments' && (
          <DepartmentManagement
            departments={departments}
            employees={employees}
            businessId={businessId}
            showToast={showToast}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'audit-log' && (
          <AuditLog
            auditLogs={auditLogs}
            onRefresh={() => {}}
            showToast={showToast}
          />
        )}

        {activeTab === 'settings' && (
          <SystemSettings
            settings={systemSettings}
            roles={roles}
            businessId={businessId}
            showToast={showToast}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'sql-migration' && isSuperAdmin && (
          <DataMigrationManager />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col font-sans text-neutral-900 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Toast Alert Floating Top */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-3 duration-200">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${
            toast.type === 'success' ? 'bg-emerald-950 text-emerald-100 border-emerald-800' :
            toast.type === 'error' ? 'bg-rose-950 text-rose-100 border-rose-800' :
            'bg-slate-900 text-slate-100 border-slate-700'
          }`}>
            {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-xl lg:hidden text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/30">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-black text-sm sm:text-base tracking-tight leading-tight">
                  ENTERPRISE ADMIN PANEL
                </h1>
                <p className="text-[10px] text-indigo-300 font-semibold tracking-wider uppercase">
                  Access Control & System Security
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onReturnToErp}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Return to Main ERP</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-950 text-slate-300 border-r border-slate-900 flex flex-col justify-between transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4 space-y-2 overflow-y-auto">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Admin Control Modules
            </div>

            <nav className="space-y-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleTabChange(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left group
                      ${isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                        : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-slate-900 bg-slate-950/80">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Logged Admin</p>
              <p className="text-xs font-bold text-slate-200 truncate">{currentUserName || (currentUserEmail ? currentUserEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Admin')}</p>
              <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                ● Super Admin Access
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
            <span className="hover:text-neutral-800 cursor-pointer" onClick={() => handleTabChange('dashboard')}>
              Admin Panel
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-extrabold text-indigo-900 uppercase tracking-wide">
              {currentNav?.label || 'Dashboard'}
            </span>
          </div>

          {/* Active View Renderer */}
          {activeTab === 'dashboard' && (
            <AdminDashboard
              users={users}
              roles={roles}
              approvalRules={approvalRules}
              employees={employees}
              auditLogs={auditLogs}
              onNavigate={(tab) => handleTabChange(tab)}
            />
          )}

          {activeTab === 'users' && (
            <UserManagement
              users={users}
              roles={roles}
              employees={employees}
              departments={departments}
              designations={designations}
              businessId={businessId}
              currentUserEmail={currentUserEmail}
              showToast={showToast}
              onRefresh={() => {}}
              onNavigateToPermissions={handleAssignUserPermissions}
            />
          )}

          {activeTab === 'roles' && (
            <RoleManagement
              roles={roles}
              businessId={businessId}
              showToast={showToast}
              onRefresh={() => {}}
              onAssignPermissions={handleAssignRolePermissions}
            />
          )}

          {activeTab === 'permissions' && (
            <PermissionManagement
              users={users}
              roles={roles}
              selectedRoleFromNav={selectedRoleForPerms}
              selectedUserFromNav={selectedUserForPerms}
              currentUserEmail={currentUserEmail}
              showToast={showToast}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'approval-setup' && (
            <ApprovalSetup
              approvalRules={approvalRules}
              users={users}
              roles={roles}
              businessId={businessId}
              showToast={showToast}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeeManagement
              employees={employees}
              departments={departments}
              designations={designations}
              businessId={businessId}
              showToast={showToast}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'designations' && (
            <DesignationManagement
              designations={designations}
              departments={departments}
              businessId={businessId}
              showToast={showToast}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'departments' && (
            <DepartmentManagement
              departments={departments}
              employees={employees}
              businessId={businessId}
              showToast={showToast}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'audit-log' && (
            <AuditLog
              auditLogs={auditLogs}
              onRefresh={() => {}}
              showToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <SystemSettings
              settings={systemSettings}
              roles={roles}
              businessId={businessId}
              showToast={showToast}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'sql-migration' && isSuperAdmin && (
            <DataMigrationManager />
          )}
        </main>
      </div>
    </div>
  );
};
