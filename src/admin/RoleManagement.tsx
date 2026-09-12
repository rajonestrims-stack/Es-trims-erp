import React, { useState } from 'react';
import { 
  KeyRound, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  X, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { RoleModel } from './adminTypes';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { buildFullPermissionMatrix, getDefaultPermission } from './adminUtils';

interface RoleManagementProps {
  roles: RoleModel[];
  businessId: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
  onAssignPermissions: (role: RoleModel) => void;
}

export const RoleManagement: React.FC<RoleManagementProps> = ({
  roles,
  businessId,
  showToast,
  onRefresh,
  onAssignPermissions
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleModel | null>(null);

  // Form State
  const [roleName, setRoleName] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleCode('');
    setDescription('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (role: RoleModel) => {
    setEditingRole(role);
    setRoleName(role.roleName);
    setRoleCode(role.roleCode);
    setDescription(role.description || '');
    setStatus(role.status);
    setIsModalOpen(true);
  };

  const handleRoleNameChange = (val: string) => {
    setRoleName(val);
    if (!editingRole && !roleCode) {
      setRoleCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) {
      showToast('Please enter Role Name.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!editingRole) {
        const isSuper = roleName.toLowerCase() === 'super admin';
        const initialPerms = buildFullPermissionMatrix(isSuper);

        await addDoc(collection(db, 'roles'), {
          roleName: roleName.trim(),
          roleCode: (roleCode || roleName).toUpperCase().replace(/[^A-Z0-9]/g, '_'),
          description: description.trim(),
          status: status,
          permissions: initialPerms,
          businessId: businessId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        showToast(`Role "${roleName}" created successfully!`, 'success');
      } else {
        await updateDoc(doc(db, 'roles', editingRole.id), {
          roleName: roleName.trim(),
          roleCode: (roleCode || roleName).toUpperCase().replace(/[^A-Z0-9]/g, '_'),
          description: description.trim(),
          status: status,
          updatedAt: Timestamp.now()
        });

        showToast(`Role "${roleName}" updated successfully!`, 'success');
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      showToast('Failed to save role.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (role: RoleModel) => {
    if (role.roleName === 'Super Admin') {
      showToast('Super Admin role cannot be deactivated.', 'error');
      return;
    }
    const newStatus = role.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'roles', role.id), { status: newStatus });
      showToast(`Role "${role.roleName}" is now ${newStatus}.`, 'info');
      onRefresh();
    } catch (err) {
      showToast('Failed to toggle role status.', 'error');
    }
  };

  const handleDeleteRole = async (role: RoleModel) => {
    if (role.roleName === 'Super Admin' || role.roleCode === 'SUPER_ADMIN') {
      showToast('Super Admin role cannot be deleted.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete role "${role.roleName}"?`)) return;

    try {
      await deleteDoc(doc(db, 'roles', role.id));
      showToast(`Role "${role.roleName}" deleted successfully.`, 'success');
      onRefresh();
    } catch (err) {
      showToast('Failed to delete role.', 'error');
    }
  };

  const filteredRoles = roles.filter(r => 
    (r.roleName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.roleCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-purple-600" /> Role Management
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Define organizational roles, descriptions, statuses, and assign custom module permission sets.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Create New Role
        </button>
      </div>

      {/* Role Grid & Filter */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search roles by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <span className="text-xs font-bold text-neutral-500">Total Roles: {filteredRoles.length}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Role Name & Code</th>
                <th className="p-3">Description</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRoles.map(role => (
                <tr key={role.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-neutral-900 text-sm">{role.roleName}</p>
                      {role.roleName === 'Super Admin' && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black rounded-full">
                          Permanent
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-purple-700">{role.roleCode}</p>
                  </td>
                  <td className="p-3 text-neutral-600 max-w-xs truncate">
                    {role.description || 'Standard enterprise role permissions'}
                  </td>
                  <td className="p-3">
                    {role.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full">
                        <XCircle className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onAssignPermissions(role)}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Permissions
                      </button>

                      <button
                        onClick={() => openEditModal(role)}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 transition-colors"
                        title="Edit Role"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {role.roleName !== 'Super Admin' && (
                        <>
                          <button
                            onClick={() => handleToggleStatus(role)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 transition-colors"
                            title={role.status === 'active' ? 'Deactivate Role' : 'Activate Role'}
                          >
                            {role.status === 'active' ? <XCircle className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          </button>

                          <button
                            onClick={() => handleDeleteRole(role)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                            title="Delete Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRoles.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-neutral-400 italic">
                    No roles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit Role */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 text-base">
                    {editingRole ? 'Edit Access Role' : 'Create New Access Role'}
                  </h3>
                  <p className="text-xs text-neutral-500">Define role identity & operational status</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Role Name</label>
                <input
                  type="text"
                  placeholder="e.g. Purchase Manager, Store Executive"
                  value={roleName}
                  onChange={(e) => handleRoleNameChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Role Code</label>
                <input
                  type="text"
                  placeholder="e.g. PURCHASE_MANAGER"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-mono text-purple-800 outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Description</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Full access to purchase orders, supplier ledgers, and GRN entry"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-bold outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

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
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md shadow-purple-600/20"
                >
                  {isSubmitting ? 'Saving Role...' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
