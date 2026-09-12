import React from 'react';
import { 
  Users, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  Building2, 
  Briefcase, 
  UserCheck, 
  Activity, 
  Settings, 
  ArrowRight,
  TrendingUp,
  Clock,
  Shield
} from 'lucide-react';
import { UserAccountModel, RoleModel, ApprovalRuleModel, EmployeeModel, AuditLogModel } from './adminTypes';

interface AdminDashboardProps {
  users: UserAccountModel[];
  roles: RoleModel[];
  approvalRules: ApprovalRuleModel[];
  employees: EmployeeModel[];
  auditLogs: AuditLogModel[];
  onNavigate: (tab: string) => void;
  isPagePermitted?: (pageId: string) => boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  roles,
  approvalRules,
  employees,
  auditLogs,
  onNavigate,
  isPagePermitted
}) => {
  const canAccess = (target: string) => {
    if (!isPagePermitted) return true;
    const checkMap: Record<string, string[]> = {
      'users': ['admin-users', 'admin'],
      'roles': ['admin-roles', 'admin'],
      'approval-setup': ['admin-approvals', 'admin'],
      'employees': ['admin-employees', 'admin'],
      'permissions': ['admin-permissions', 'admin'],
      'audit-log': ['admin-audit-log', 'admin'],
      'settings': ['admin-settings', 'admin']
    };
    const ids = checkMap[target] || ['admin-' + target, target, 'admin'];
    return ids.some(id => isPagePermitted(id));
  };

  const activeUsersCount = users.filter(u => u.status === 'active').length;
  const activeRolesCount = roles.filter(r => r.status === 'active').length;
  const activeApprovalRules = approvalRules.filter(a => a.approvalRequired && a.status === 'active').length;
  const activeEmployeesCount = employees.filter(e => e.status === 'active').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" /> Enterprise Control Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">System Administration & Access Control</h1>
          <p className="text-neutral-300 text-xs sm:text-sm">
            Centralized management for ERP users, granular module permissions, multi-level approval workflows, employee hierarchy, and security audit logs.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate('users')} 
          className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">System Users</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-neutral-900">{users.length}</p>
            <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> {activeUsersCount} Active Accounts
            </p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('roles')} 
          className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Access Roles</span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
              <KeyRound className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-neutral-900">{roles.length}</p>
            <p className="text-xs text-purple-600 font-bold mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> {activeRolesCount} Configured Roles
            </p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('approval-setup')} 
          className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Workflows</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-neutral-900">{approvalRules.length}</p>
            <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> {activeApprovalRules} Active Rules
            </p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('employees')} 
          className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Employee Master</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-neutral-900">{employees.length}</p>
            <p className="text-xs text-amber-600 font-bold mt-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> {activeEmployeesCount} Active Staff
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      {(canAccess('users') || canAccess('permissions') || canAccess('approval-setup')) && (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-600" /> Administration Quick Shortcuts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {canAccess('users') && (
              <button
                onClick={() => onNavigate('users')}
                className="flex items-center justify-between p-4 bg-neutral-50 hover:bg-indigo-50/60 border border-neutral-200/80 rounded-xl text-left transition-all group"
              >
                <div>
                  <p className="text-xs font-extrabold text-neutral-900 group-hover:text-indigo-900">Manage Users</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Create, edit, reset passwords & link employees</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </button>
            )}

            {canAccess('permissions') && (
              <button
                onClick={() => onNavigate('permissions')}
                className="flex items-center justify-between p-4 bg-neutral-50 hover:bg-purple-50/60 border border-neutral-200/80 rounded-xl text-left transition-all group"
              >
                <div>
                  <p className="text-xs font-extrabold text-neutral-900 group-hover:text-purple-900">Permission Matrix</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Configure View, Entry, Edit, Delete per module</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </button>
            )}

            {canAccess('approval-setup') && (
              <button
                onClick={() => onNavigate('approval-setup')}
                className="flex items-center justify-between p-4 bg-neutral-50 hover:bg-emerald-50/60 border border-neutral-200/80 rounded-xl text-left transition-all group"
              >
                <div>
                  <p className="text-xs font-extrabold text-neutral-900 group-hover:text-emerald-900">Approval Workflows</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Multi-level approval levels & amount limits</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Audit Log Recent Highlights */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Recent System Audit Trail</h3>
          </div>
          {canAccess('audit-log') && (
            <button
              onClick={() => onNavigate('audit-log')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              View Full Audit Log &rarr;
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Module / Page</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {auditLogs.slice(0, 5).map(log => (
                <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="p-3 font-bold text-neutral-900">{log.userName || log.userEmail || 'System User'}</td>
                  <td className="p-3 text-neutral-700">{log.module} / <span className="font-semibold">{log.page}</span></td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 rounded font-bold text-[10px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-neutral-500 font-mono text-[11px]">{log.recordId || log.newValue || 'Standard Operation'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-neutral-400 italic">
                    No recent audit entries logged yet.
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
