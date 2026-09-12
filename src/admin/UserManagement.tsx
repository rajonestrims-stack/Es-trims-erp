import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  KeyRound, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  UserCheck, 
  RefreshCw,
  X,
  Lock,
  Shield,
  ShieldAlert
} from 'lucide-react';
import { UserAccountModel, RoleModel, EmployeeModel, DepartmentModel, DesignationModel } from './adminTypes';
import { createNewUserAccount, db } from '../firebase';
import { doc, updateDoc, deleteDoc, setDoc, Timestamp } from 'firebase/firestore';

interface UserManagementProps {
  users: UserAccountModel[];
  roles: RoleModel[];
  employees: EmployeeModel[];
  departments: DepartmentModel[];
  designations: DesignationModel[];
  businessId: string;
  currentUserEmail?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
  onNavigateToPermissions?: (user: UserAccountModel) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  roles,
  employees,
  departments,
  designations,
  businessId,
  currentUserEmail = '',
  showToast,
  onRefresh,
  onNavigateToPermissions
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccountModel | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [departmentName, setDepartmentName] = useState('Store');
  const [designationName, setDesignationName] = useState('Executive');
  const [roleId, setRoleId] = useState('store-manager');
  const [roleName, setRoleName] = useState('Store Manager');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Super Admin Check
  const normalizedCurrentEmail = currentUserEmail.toLowerCase().replace(/\s+/g, '');
  const SUPER_ADMINS = ['rajonpaul300@gmail.com', 'estore@gmail.com', 'esstore@gmail.com', 'rajon.estrims@gmail.com'];
  const isSuperAdmin = SUPER_ADMINS.includes(normalizedCurrentEmail);

  // Handle Employee Link Selection
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      if (!username) setUsername(emp.employeeIdCode || emp.employeeName.toLowerCase().replace(/\s+/g, ''));
      if (!email && emp.email) setEmail(emp.email);
      if (!mobile && emp.mobile) setMobile(emp.mobile);
      if (emp.departmentName) setDepartmentName(emp.departmentName);
      if (emp.designationName) setDesignationName(emp.designationName);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setSelectedEmployeeId('');
    setUsername('');
    setEmail('');
    setMobile('');
    setPassword('');
    setConfirmPassword('');
    setDepartmentName('Store');
    setDesignationName('Executive');
    setRoleId(roles[0]?.id || 'store-manager');
    setRoleName(roles[0]?.roleName || 'Store Manager');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserAccountModel) => {
    setEditingUser(user);
    setSelectedEmployeeId(user.employeeId || '');
    setUsername(user.username || '');
    setEmail(user.email || '');
    setMobile(user.mobile || '');
    setPassword('');
    setConfirmPassword('');
    setDepartmentName(user.departmentName || 'Store');
    setDesignationName(user.designationName || 'Executive');
    setRoleId(user.roleId || 'store-manager');
    setRoleName(user.roleName || 'Store Manager');
    setStatus(user.status || 'active');
    setIsModalOpen(true);
  };

  const handleRoleSelectChange = (rId: string) => {
    setRoleId(rId);
    const matchedRole = roles.find(r => r.id === rId);
    if (matchedRole) {
      setRoleName(matchedRole.roleName);
    } else {
      const defaultRoleLabels: Record<string, string> = {
        'super-admin': 'Super Admin',
        'admin': 'Admin',
        'accounts-manager': 'Accounts Manager',
        'purchase-manager': 'Purchase Manager',
        'sales-manager': 'Sales Manager',
        'store-manager': 'Store Manager',
        'production-manager': 'Production Manager',
        'hr-manager': 'HR Manager',
        'executive': 'Executive',
        'operator': 'Operator',
        'viewer': 'Viewer'
      };
      setRoleName(defaultRoleLabels[rId] || rId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      showToast('Please enter a valid user email address.', 'error');
      return;
    }

    if (!editingUser) {
      if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        showToast('Password and Confirm Password do not match.', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
      const finalDisplayName = selectedEmp?.employeeName || username.trim() || cleanEmail.split('@')[0];

      if (!editingUser) {
        let authUid = '';
        try {
          const authResult = await createNewUserAccount(cleanEmail, password);
          authUid = authResult?.uid || '';
        } catch (authErr: any) {
          console.warn('Secondary auth notice:', authErr);
          // If auth already exists or in demo mode, use existing user doc or generate id
          const existingUser = users.find(u => u.email?.toLowerCase() === cleanEmail);
          authUid = existingUser ? existingUser.id : ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
        }

        const newDocId = authUid || ('usr_' + Date.now());
        const userRef = doc(db, 'users', newDocId);

        await setDoc(userRef, {
          id: newDocId,
          uid: newDocId,
          employeeId: selectedEmployeeId || '',
          employeeName: selectedEmp?.employeeName || finalDisplayName,
          username: username.trim() || cleanEmail.split('@')[0],
          email: cleanEmail,
          mobile: mobile.trim(),
          departmentName: departmentName,
          designationName: designationName,
          roleId: roleId,
          roleName: roleName,
          role: roleName,
          businessId: businessId || 'es_trims_store',
          status: status,
          displayName: finalDisplayName,
          department: departmentName,
          designation: designationName,
          allowedPages: [], // Default to no pages until admin explicitly grants them
          customPermissions: {},
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }, { merge: true });

        showToast(`User account for ${cleanEmail} created & saved successfully!`, 'success');
      } else {
        // Update existing user doc
        const userRef = doc(db, 'users', editingUser.id);
        await updateDoc(userRef, {
          employeeId: selectedEmployeeId || '',
          employeeName: selectedEmp?.employeeName || editingUser.employeeName || finalDisplayName,
          username: username.trim(),
          email: cleanEmail,
          mobile: mobile.trim(),
          departmentName: departmentName,
          designationName: designationName,
          roleId: roleId,
          roleName: roleName,
          role: roleName,
          status: status,
          displayName: finalDisplayName,
          department: departmentName,
          designation: designationName,
          updatedAt: Timestamp.now()
        });

        showToast(`User account for ${cleanEmail} updated successfully.`, 'success');
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to save user account.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserAccountModel) => {
    const isProtected = SUPER_ADMINS.includes((user.email || '').toLowerCase().replace(/\s+/g, ''));
    if (isProtected) {
      showToast('Super Admin accounts cannot be deactivated.', 'error');
      return;
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { status: newStatus, updatedAt: Timestamp.now() });
      showToast(`User ${user.email} marked as ${newStatus}.`, 'info');
      onRefresh();
    } catch (err: any) {
      showToast('Failed to change user status.', 'error');
    }
  };

  const handleDeleteUser = async (user: UserAccountModel) => {
    const isProtected = SUPER_ADMINS.includes((user.email || '').toLowerCase().replace(/\s+/g, ''));
    if (isProtected) {
      showToast('Permanent Super Admin accounts cannot be deleted.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user account ${user.email}?`)) return;

    try {
      await deleteDoc(doc(db, 'users', user.id));
      showToast(`User ${user.email} deleted successfully.`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast('Failed to delete user account.', 'error');
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.roleName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.departmentName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" /> User Management
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Create, manage and configure user access credentials linked with Employee records and company permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-700 transition-all"
            title="Refresh User List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Create New User
          </button>
        </div>
      </div>

      {/* Info Notice about Access Control */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-bold">Strict Permission Control Active</p>
          <p className="text-amber-800 leading-relaxed">
            Super Admins (<code className="font-bold text-amber-950">rajonpaul300@gmail.com</code>, <code className="font-bold text-amber-950">estore@gmail.com</code>) have unrestricted access. All newly created or unassigned user accounts start with zero module permissions until granted via the <strong>Permission Matrix</strong>.
          </p>
        </div>
      </div>

      {/* Filter & Table */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, email, role or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs font-bold text-neutral-500">Total Users: {filteredUsers.length}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">User & Email</th>
                <th className="p-3">Linked Employee</th>
                <th className="p-3">Department & Designation</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredUsers.map(u => {
                const userEmailNorm = (u.email || '').toLowerCase().replace(/\s+/g, '');
                const isSuper = SUPER_ADMINS.includes(userEmailNorm);

                return (
                  <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                            {u.username || u.email.split('@')[0]}
                            {isSuper && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-extrabold rounded-full flex items-center gap-0.5">
                                <Shield className="w-2.5 h-2.5" /> Super Admin
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-neutral-500 font-mono">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-neutral-800">
                      {u.employeeName ? (
                        <span>{u.employeeName}</span>
                      ) : (
                        <span className="text-neutral-400 italic">Not Linked</span>
                      )}
                    </td>
                    <td className="p-3 text-neutral-700">
                      <p className="font-bold">{u.departmentName || u.department || 'General'}</p>
                      <p className="text-[11px] text-neutral-400">{u.designationName || u.designation || 'Officer'}</p>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-[11px] rounded-lg">
                        {u.roleName || u.roleId || 'Standard User'}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.status === 'active' ? (
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
                      <div className="flex items-center justify-end gap-1.5">
                        {onNavigateToPermissions && (
                          <button
                            onClick={() => onNavigateToPermissions(u)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1"
                            title="Assign Custom Page Permissions"
                          >
                            <KeyRound className="w-3 h-3" /> Permissions
                          </button>
                        )}

                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 transition-colors"
                          title="Edit User Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {!isSuper && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 transition-colors"
                              title={u.status === 'active' ? 'Deactivate User' : 'Activate User'}
                            >
                              {u.status === 'active' ? <XCircle className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                              title="Delete User Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                    No users found matching query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create or Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-neutral-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 text-base">
                    {editingUser ? 'Edit User Account' : 'Create New User Account'}
                  </h3>
                  <p className="text-xs text-neutral-500">Configure credentials, role, department & link employee profile</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Employee Link Selection */}
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Link Employee Record (Optional)</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- No Employee Linked --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeName} ({emp.employeeIdCode}) - {emp.departmentName || 'No Dept'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Username / User ID</label>
                  <input
                    type="text"
                    placeholder="e.g. rahim"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Email Address (Login ID)</label>
                  <input
                    type="email"
                    placeholder="e.g. rahim@es-trims.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!editingUser}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +8801700000000"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Password Fields only when creating */}
              {!editingUser && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
                  <div className="space-y-1 relative">
                    <label className="font-bold text-neutral-700 uppercase">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-10 pl-3 pr-10 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 uppercase">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Department & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Department</label>
                  <select
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Store">Store & Inventory</option>
                    <option value="Sales">Sales & Marketing</option>
                    <option value="Purchase">Purchase & Procurement</option>
                    <option value="Accounts">Accounts & Finance</option>
                    <option value="Production">Production & Dyeing</option>
                    <option value="Sub-Contract">Sub-Contract Management</option>
                    <option value="Commercial">Commercial & LC</option>
                    <option value="HR & Admin">HR & Admin</option>
                    <option value="Executive">Executive Management</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.departmentName}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Purchase Executive"
                    value={designationName}
                    onChange={(e) => setDesignationName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Role Select */}
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Assign Role ▼</label>
                <select
                  value={roleId}
                  onChange={(e) => handleRoleSelectChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-indigo-300 bg-indigo-50/50 text-xs font-bold text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="viewer">Viewer (Restricted)</option>
                  <option value="store-manager">Store Manager</option>
                  <option value="purchase-manager">Purchase Manager</option>
                  <option value="sales-manager">Sales Manager</option>
                  <option value="production-manager">Production Manager</option>
                  <option value="accounts-manager">Accounts Manager</option>
                  <option value="executive">Executive</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      Custom Role: {r.roleName}
                    </option>
                  ))}
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20"
                >
                  {isSubmitting ? 'Saving User...' : editingUser ? 'Update User Account' : 'Create & Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
