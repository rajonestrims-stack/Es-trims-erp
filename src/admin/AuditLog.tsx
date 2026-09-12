import React, { useState } from 'react';
import { 
  Clock, 
  Search, 
  Download, 
  Filter, 
  RefreshCw, 
  ShieldAlert, 
  User, 
  Layers 
} from 'lucide-react';
import { AuditLogModel } from './adminTypes';

interface AuditLogProps {
  auditLogs: AuditLogModel[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AuditLog: React.FC<AuditLogProps> = ({
  auditLogs,
  onRefresh,
  showToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter(log => {
    const matchSearch = (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (log.page || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (log.module || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (log.recordId || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchAction = selectedAction === 'ALL' || log.action === selectedAction;
    const matchModule = selectedModule === 'ALL' || log.module === selectedModule;

    return matchSearch && matchAction && matchModule;
  });

  const exportToCsv = () => {
    if (filteredLogs.length === 0) {
      showToast('No audit logs available to export.', 'info');
      return;
    }

    const headers = ['Timestamp', 'User Name', 'User Email', 'Module', 'Page', 'Action', 'Record ID', 'Old Value', 'New Value', 'IP Address'];
    const rows = filteredLogs.map(l => [
      l.timestamp ? new Date((l.timestamp as any).seconds ? (l.timestamp as any).seconds * 1000 : l.timestamp as any).toLocaleString() : '',
      `"${l.userName || ''}"`,
      `"${l.userEmail || ''}"`,
      `"${l.module || ''}"`,
      `"${l.page || ''}"`,
      `"${l.action || ''}"`,
      `"${l.recordId || ''}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ERP_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Audit log exported to CSV.', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" /> System Audit Trail & Security Log
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Immutable log of all user activities, data modifications, login attempts, permission changes and approval decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-700 transition-all"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={exportToCsv}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" /> Export CSV Log
          </button>
        </div>
      </div>

      {/* Filter Controls & Log Table */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search user, page, record ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="py-2 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="Login">Login / Logout</option>
              <option value="Create">Create</option>
              <option value="Edit">Edit</option>
              <option value="Delete">Delete</option>
              <option value="Approve">Approve</option>
              <option value="Reject">Reject</option>
              <option value="Permission Change">Permission Change</option>
            </select>

            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="py-2 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Modules</option>
              <option value="Sales">Sales</option>
              <option value="Purchase">Purchase</option>
              <option value="Store">Store</option>
              <option value="Production">Production</option>
              <option value="Accounts">Accounts</option>
              <option value="HR">HR</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">User</th>
                <th className="p-3">Module / Page</th>
                <th className="p-3">Action</th>
                <th className="p-3">Record ID & Values</th>
                <th className="p-3">Device / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredLogs.map(log => {
                const timeFormatted = log.timestamp ? new Date((log.timestamp as any).seconds ? (log.timestamp as any).seconds * 1000 : log.timestamp as any).toLocaleString() : 'Just now';

                return (
                  <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                      {timeFormatted}
                    </td>
                    <td className="p-3 font-bold text-neutral-900 whitespace-nowrap">
                      {log.userName || log.userEmail || 'System User'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-bold text-indigo-900">{log.module}</span> / <span className="text-neutral-700">{log.page}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] uppercase ${
                        log.action === 'Delete' ? 'bg-rose-100 text-rose-800' :
                        log.action === 'Create' ? 'bg-emerald-100 text-emerald-800' :
                        log.action === 'Approve' ? 'bg-emerald-100 text-emerald-800' :
                        log.action === 'Permission Change' ? 'bg-purple-100 text-purple-800' :
                        'bg-neutral-100 text-neutral-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-neutral-600 max-w-xs truncate">
                      {log.recordId && <span className="font-bold text-neutral-900">[{log.recordId}] </span>}
                      {log.newValue || log.oldValue || '—'}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                    No audit records match the selected filter.
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
