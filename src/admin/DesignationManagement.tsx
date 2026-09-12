import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  X 
} from 'lucide-react';
import { DesignationModel, DepartmentModel } from './adminTypes';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';

interface DesignationManagementProps {
  designations: DesignationModel[];
  departments: DepartmentModel[];
  businessId: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

export const DesignationManagement: React.FC<DesignationManagementProps> = ({
  designations,
  departments,
  businessId,
  showToast,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDes, setEditingDes] = useState<DesignationModel | null>(null);

  const [designationCode, setDesignationCode] = useState('');
  const [designationName, setDesignationName] = useState('');
  const [departmentName, setDepartmentName] = useState('Store');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingDes(null);
    setDesignationCode('');
    setDesignationName('');
    setDepartmentName('Store');
    setDescription('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (des: DesignationModel) => {
    setEditingDes(des);
    setDesignationCode(des.designationCode || '');
    setDesignationName(des.designationName || '');
    setDepartmentName(des.departmentName || 'Store');
    setDescription(des.description || '');
    setStatus(des.status || 'active');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designationName) {
      showToast('Please enter designation name.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const code = (designationCode || designationName).toUpperCase().replace(/[^A-Z0-9]/g, '_');
      if (!editingDes) {
        await addDoc(collection(db, 'designations'), {
          designationCode: code,
          designationName: designationName.trim(),
          departmentName: departmentName.trim(),
          description: description.trim(),
          status,
          businessId,
          createdAt: Timestamp.now()
        });
        showToast(`Designation "${designationName}" created!`, 'success');
      } else {
        await updateDoc(doc(db, 'designations', editingDes.id), {
          designationCode: code,
          designationName: designationName.trim(),
          departmentName: departmentName.trim(),
          description: description.trim(),
          status,
          updatedAt: Timestamp.now()
        });
        showToast(`Designation updated.`, 'success');
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      showToast('Failed to save designation.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (des: DesignationModel) => {
    if (!window.confirm(`Delete designation ${des.designationName}?`)) return;
    try {
      await deleteDoc(doc(db, 'designations', des.id));
      showToast(`Designation deleted.`, 'success');
      onRefresh();
    } catch (err) {
      showToast('Failed to delete designation.', 'error');
    }
  };

  const filtered = designations.filter(d => 
    (d.designationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.designationCode || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-sky-600" /> Designation Management
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">Define corporate positions, job grades and department hierarchy.</p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Designation
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search designations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <span className="text-xs font-bold text-neutral-500">Total Designations: {filtered.length}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Designation Name & Code</th>
                <th className="p-3">Department</th>
                <th className="p-3">Description</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(des => (
                <tr key={des.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="p-3">
                    <p className="font-extrabold text-neutral-900">{des.designationName}</p>
                    <p className="text-[11px] font-mono text-sky-700">{des.designationCode}</p>
                  </td>
                  <td className="p-3 font-bold text-neutral-800">{des.departmentName || 'General'}</td>
                  <td className="p-3 text-neutral-600">{des.description || '—'}</td>
                  <td className="p-3">
                    {des.status === 'active' ? (
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
                      <button onClick={() => openEditModal(des)} className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(des)} className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400 italic">No designations recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-neutral-900 text-base">{editingDes ? 'Edit Designation' : 'Add Designation'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="font-bold text-neutral-700 uppercase">Designation Name</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Store Executive"
                  value={designationName}
                  onChange={(e) => setDesignationName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-neutral-700 uppercase">Code</label>
                <input
                  type="text"
                  value={designationCode}
                  onChange={(e) => setDesignationCode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-mono text-sky-800 uppercase outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-neutral-700 uppercase">Department</label>
                <select
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-medium outline-none"
                >
                  <option value="Store">Store & Inventory</option>
                  <option value="Sales">Sales & Marketing</option>
                  <option value="Purchase">Purchase & Procurement</option>
                  <option value="Accounts">Accounts & Finance</option>
                  <option value="Production">Production & Dyeing</option>
                  <option value="HR & Admin">HR & Admin</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.departmentName}>{d.departmentName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-neutral-700 uppercase">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-neutral-100 font-bold rounded-xl">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-sky-600 text-white font-bold rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
