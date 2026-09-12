import React, { useState } from 'react';
import { 
  Briefcase, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  X, 
  Building2, 
  Mail, 
  Phone,
  UserCheck
} from 'lucide-react';
import { EmployeeModel, DepartmentModel, DesignationModel } from './adminTypes';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';

interface EmployeeManagementProps {
  employees: EmployeeModel[];
  departments: DepartmentModel[];
  designations: DesignationModel[];
  businessId: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
  employees,
  departments,
  designations,
  businessId,
  showToast,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeModel | null>(null);

  // Form State
  const [employeeIdCode, setEmployeeIdCode] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [departmentName, setDepartmentName] = useState('Store');
  const [designationName, setDesignationName] = useState('Officer');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [employmentType, setEmploymentType] = useState<'Full-time' | 'Part-time' | 'Contract' | 'Intern'>('Full-time');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingEmp(null);
    setEmployeeIdCode(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setEmployeeName('');
    setDepartmentName('Store');
    setDesignationName('Officer');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setEmploymentType('Full-time');
    setMobile('');
    setEmail('');
    setAddress('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: EmployeeModel) => {
    setEditingEmp(emp);
    setEmployeeIdCode(emp.employeeIdCode || '');
    setEmployeeName(emp.employeeName || '');
    setDepartmentName(emp.departmentName || 'Store');
    setDesignationName(emp.designationName || 'Officer');
    setJoiningDate(emp.joiningDate || new Date().toISOString().split('T')[0]);
    setEmploymentType(emp.employmentType || 'Full-time');
    setMobile(emp.mobile || '');
    setEmail(emp.email || '');
    setAddress(emp.address || '');
    setStatus(emp.status || 'active');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName) {
      showToast('Please enter Employee Name.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!editingEmp) {
        await addDoc(collection(db, 'employees'), {
          employeeIdCode: employeeIdCode.trim(),
          employeeName: employeeName.trim(),
          departmentName: departmentName.trim(),
          designationName: designationName.trim(),
          joiningDate,
          employmentType,
          mobile: mobile.trim(),
          email: email.trim(),
          address: address.trim(),
          status,
          businessId,
          createdAt: Timestamp.now()
        });
        showToast(`Employee "${employeeName}" registered successfully!`, 'success');
      } else {
        await updateDoc(doc(db, 'employees', editingEmp.id), {
          employeeIdCode: employeeIdCode.trim(),
          employeeName: employeeName.trim(),
          departmentName: departmentName.trim(),
          designationName: designationName.trim(),
          joiningDate,
          employmentType,
          mobile: mobile.trim(),
          email: email.trim(),
          address: address.trim(),
          status,
          updatedAt: Timestamp.now()
        });
        showToast(`Employee record updated.`, 'success');
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast('Failed to save employee profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (emp: EmployeeModel) => {
    if (!window.confirm(`Are you sure you want to delete employee record ${emp.employeeName}?`)) return;
    try {
      await deleteDoc(doc(db, 'employees', emp.id));
      showToast(`Employee ${emp.employeeName} deleted.`, 'success');
      onRefresh();
    } catch (err) {
      showToast('Failed to delete employee.', 'error');
    }
  };

  const filteredEmployees = employees.filter(e => 
    (e.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.employeeIdCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.departmentName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-amber-600" /> Employee Master
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage complete employee personnel records, department assignments, designations and contact profiles.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Employee Record
        </button>
      </div>

      {/* Search & Filter Table */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by code, name or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <span className="text-xs font-bold text-neutral-500">Total Staff: {filteredEmployees.length}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">ID Code & Name</th>
                <th className="p-3">Department & Designation</th>
                <th className="p-3">Contact Details</th>
                <th className="p-3">Type & Joining</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="p-3">
                    <p className="font-extrabold text-neutral-900">{emp.employeeName}</p>
                    <p className="text-[11px] font-mono text-amber-700">{emp.employeeIdCode}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-bold text-neutral-800">{emp.departmentName || 'General'}</p>
                    <p className="text-[11px] text-neutral-400">{emp.designationName || 'Staff'}</p>
                  </td>
                  <td className="p-3 text-neutral-600 space-y-0.5">
                    {emp.email && <p className="flex items-center gap-1 font-mono text-[11px]"><Mail className="w-3 h-3 text-neutral-400" /> {emp.email}</p>}
                    {emp.mobile && <p className="flex items-center gap-1 text-[11px]"><Phone className="w-3 h-3 text-neutral-400" /> {emp.mobile}</p>}
                  </td>
                  <td className="p-3 font-semibold text-neutral-700">
                    <p>{emp.employmentType}</p>
                    <p className="text-[11px] text-neutral-400">{emp.joiningDate}</p>
                  </td>
                  <td className="p-3">
                    {emp.status === 'active' ? (
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
                      <button
                        onClick={() => openEditModal(emp)}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 transition-colors"
                        title="Edit Employee"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(emp)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                        title="Delete Employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-neutral-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 text-base">
                    {editingEmp ? 'Edit Employee Profile' : 'Register New Employee'}
                  </h3>
                  <p className="text-xs text-neutral-500">Personnel information & job classification</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Employee ID Code</label>
                  <input
                    type="text"
                    value={employeeIdCode}
                    onChange={(e) => setEmployeeIdCode(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-mono text-amber-800 outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Md. Rahim Uddin"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Department</label>
                  <select
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-medium outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Store">Store & Inventory</option>
                    <option value="Sales">Sales & Marketing</option>
                    <option value="Purchase">Purchase & Procurement</option>
                    <option value="Accounts">Accounts & Finance</option>
                    <option value="Production">Production & Dyeing</option>
                    <option value="Commercial">Commercial & LC</option>
                    <option value="HR & Admin">HR & Admin</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.departmentName}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Store Manager"
                    value={designationName}
                    onChange={(e) => setDesignationName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Joining Date</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Employment Type</label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-medium outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
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
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-700 uppercase">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. employee@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Residential Address</label>
                <textarea
                  rows={2}
                  placeholder="e.g. House 12, Road 4, Sector 7, Uttara, Dhaka"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-amber-500"
                />
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
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20"
                >
                  {isSubmitting ? 'Saving...' : editingEmp ? 'Update Employee' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
