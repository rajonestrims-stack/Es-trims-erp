import React, { useState } from 'react';
import { 
  FolderPlus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Download, 
  RefreshCw, 
  Layers, 
  Tag, 
  Filter,
  Plus
} from 'lucide-react';
import { SubContractCategory, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface SubContractCategoryMasterProps {
  categories: SubContractCategory[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSaveCategory: (cat: Partial<SubContractCategory>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  isEditor: boolean;
}

export const SubContractCategoryMaster: React.FC<SubContractCategoryMasterProps> = ({
  categories,
  showToast,
  onSaveCategory,
  onDeleteCategory,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = 
      cat.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.categoryCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || cat.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setCategoryCode(`CAT-${String(categories.length + 1).padStart(3, '0')}`);
    setCategoryName('');
    setDescription('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: SubContractCategory) => {
    setEditingId(cat.id);
    setCategoryCode(cat.categoryCode);
    setCategoryName(cat.categoryName);
    setDescription(cat.description || '');
    setStatus(cat.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      showToast('Category name is required', 'error');
      return;
    }
    if (!categoryCode.trim()) {
      showToast('Category code is required', 'error');
      return;
    }

    // Check duplicate code if adding
    const duplicate = categories.find(
      c => c.categoryCode.toLowerCase() === categoryCode.trim().toLowerCase() && c.id !== editingId
    );
    if (duplicate) {
      showToast('Category code already exists. Please choose a unique code.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await onSaveCategory({
        id: editingId || undefined,
        categoryCode: categoryCode.trim().toUpperCase(),
        categoryName: categoryName.trim(),
        description: description.trim(),
        status
      });
      setIsModalOpen(false);
      showToast(editingId ? 'Category updated successfully' : 'Category created successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      setIsDeleting(id);
      await onDeleteCategory(id);
      showToast(`Category "${name}" deleted`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete category', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const exportToCSV = () => {
    if (!categories.length) {
      showToast('No data to export', 'error');
      return;
    }
    const headers = ['Category Code', 'Category Name', 'Description', 'Status'];
    const rows = categories.map(c => [
      `"${c.categoryCode}"`,
      `"${c.categoryName}"`,
      `"${c.description || ''}"`,
      `"${c.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subcontract_categories_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Sub Contract Category Master</h2>
              <p className="text-xs text-neutral-500">Define outsourced service categories (Dyeing, Woven, Embroidery, Washing, Finishing, etc.)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCSV}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          {isEditor && (
            <Button 
              size="sm" 
              onClick={handleOpenAdd}
              className="h-9 gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Category
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total Categories</span>
            <Layers className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">{categories.length}</p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase">Active Categories</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {categories.filter(c => c.status === 'active').length}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase">Inactive Categories</span>
            <XCircle className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-600 mt-1">
            {categories.filter(c => c.status === 'inactive').length}
          </p>
        </Card>

        <Card className="p-4 bg-indigo-50/50 border border-indigo-100 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-900">Auto-Linked Service Rules</span>
          </div>
          <p className="text-[11px] text-indigo-700 mt-1 font-medium">Used across Item Master, Price Master & Sub Contract Orders</p>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-neutral-200">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search category name, code, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-neutral-50 border-neutral-200"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Categories Table */}
      <Card className="overflow-hidden border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Category Code</th>
                <th className="py-3.5 px-4">Category Name</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                {isEditor && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={isEditor ? 6 : 5} className="py-12 text-center text-neutral-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    No categories found matching your query.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, idx) => (
                  <tr key={cat.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-neutral-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {cat.categoryCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      {cat.categoryName}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-500 max-w-xs truncate">
                      {cat.description || <span className="text-neutral-300 italic">No description</span>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cat.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                      }`}>
                        {cat.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isEditor && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Category"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id, cat.categoryName)}
                            disabled={isDeleting === cat.id}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Category"
                          >
                            {isDeleting === cat.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Sub Contract Category' : 'Add New Sub Contract Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">
              Category Code <span className="text-rose-500">*</span>
            </label>
            <Input
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value.toUpperCase())}
              placeholder="e.g. CAT-DYE, CAT-WOV, CAT-EMB"
              required
              className="font-mono"
            />
            <p className="text-[10px] text-neutral-400">Unique alphanumeric category identifier.</p>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Dyeing, Woven, Embroidery, Printing"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context or notes about this subcontract service category..."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-800"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Status</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="catStatus"
                  value="active"
                  checked={status === 'active'}
                  onChange={() => setStatus('active')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-neutral-700">Active</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="catStatus"
                  value="inactive"
                  checked={status === 'inactive'}
                  onChange={() => setStatus('inactive')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-neutral-700">Inactive</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
