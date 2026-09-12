import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Download, 
  RefreshCw, 
  Plus, 
  Filter, 
  Layers, 
  Building2,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { SubContractCategory, SubContractItem, Supplier, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface SubContractItemMasterProps {
  items: SubContractItem[];
  categories: SubContractCategory[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSaveItem: (item: Partial<SubContractItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  isEditor: boolean;
}

const COMMON_UNITS = ['KG', 'Pcs', 'Yds', 'Mtr', 'Dozen', 'Lbs', 'Roll', 'Cone', 'Gross'];

export const SubContractItemMaster: React.FC<SubContractItemMasterProps> = ({
  items,
  categories,
  suppliers,
  showToast,
  onSaveItem,
  onDeleteItem,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('KG');
  const [customUnit, setCustomUnit] = useState('');
  const [description, setDescription] = useState('');
  const [specification, setSpecification] = useState('');
  const [defaultSupplierId, setDefaultSupplierId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.specification || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.categoryName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.categoryId === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSupplier = supplierFilter === 'all' || item.defaultSupplierId === supplierFilter;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesSupplier;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    const defaultCat = categories.find(c => c.status === 'active') || categories[0];
    const catPrefix = defaultCat?.categoryCode?.replace('CAT-', '') || 'SC';
    setItemCode(`${catPrefix}-${String(items.length + 1).padStart(3, '0')}`);
    setItemName('');
    setCategoryId(defaultCat?.id || '');
    setUnit('KG');
    setCustomUnit('');
    setDescription('');
    setSpecification('');
    setDefaultSupplierId('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SubContractItem) => {
    setEditingId(item.id);
    setItemCode(item.itemCode);
    setItemName(item.itemName);
    setCategoryId(item.categoryId);
    if (COMMON_UNITS.includes(item.unit)) {
      setUnit(item.unit);
      setCustomUnit('');
    } else {
      setUnit('custom');
      setCustomUnit(item.unit);
    }
    setDescription(item.description || '');
    setSpecification(item.specification || '');
    setDefaultSupplierId(item.defaultSupplierId || '');
    setStatus(item.status);
    setIsModalOpen(true);
  };

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    if (!editingId) {
      const selectedCat = categories.find(c => c.id === newCatId);
      if (selectedCat) {
        const prefix = selectedCat.categoryCode.replace('CAT-', '').trim() || 'SC';
        const countInCat = items.filter(i => i.categoryId === newCatId).length + 1;
        setItemCode(`${prefix}-${String(countInCat).padStart(3, '0')}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim()) {
      showToast('Item code is required', 'error');
      return;
    }
    if (!itemName.trim()) {
      showToast('Item name is required', 'error');
      return;
    }
    if (!categoryId) {
      showToast('Category is required', 'error');
      return;
    }

    // Check duplicate code
    const duplicate = items.find(
      i => i.itemCode.toLowerCase() === itemCode.trim().toLowerCase() && i.id !== editingId
    );
    if (duplicate) {
      showToast('Item code already exists. Please specify a unique code.', 'error');
      return;
    }

    const selectedCategory = categories.find(c => c.id === categoryId);
    const selectedSupplier = suppliers.find(s => s.id === defaultSupplierId);
    const finalUnit = unit === 'custom' ? (customUnit.trim() || 'Pcs') : unit;

    try {
      setIsSaving(true);
      await onSaveItem({
        id: editingId || undefined,
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim(),
        categoryId,
        categoryName: selectedCategory?.categoryName || 'General',
        unit: finalUnit,
        description: description.trim(),
        specification: specification.trim(),
        defaultSupplierId: defaultSupplierId || undefined,
        defaultSupplierName: selectedSupplier?.name || undefined,
        status
      });
      setIsModalOpen(false);
      showToast(editingId ? 'Item updated successfully' : 'Item created successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete item "${name}"?`)) return;
    try {
      setIsDeleting(id);
      await onDeleteItem(id);
      showToast(`Item "${name}" deleted`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete item', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const exportToCSV = () => {
    if (!items.length) {
      showToast('No items to export', 'error');
      return;
    }
    const headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Specification', 'Default Supplier', 'Status'];
    const rows = items.map(i => [
      `"${i.itemCode}"`,
      `"${i.itemName}"`,
      `"${i.categoryName}"`,
      `"${i.unit}"`,
      `"${i.specification || ''}"`,
      `"${i.defaultSupplierName || ''}"`,
      `"${i.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subcontract_items_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Sub Contract Item Master</h2>
              <p className="text-xs text-neutral-500">Manage all outsourced service items (Fabric Dyeing, Yarn Woven, 3D Embroidery, etc.)</p>
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
              className="h-9 gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Item
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total Subcontract Items</span>
            <Package className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">{items.length}</p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase">Active Items</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {items.filter(i => i.status === 'active').length}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 uppercase">Categories Represented</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-700 mt-1">
            {new Set(items.map(i => i.categoryId)).size}
          </p>
        </Card>

        <Card className="p-4 bg-blue-50/50 border border-blue-100 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-blue-900">Price Auto-Linking</span>
          </div>
          <p className="text-[11px] text-blue-700 mt-1 font-medium">Link with Supplier & Category in Price Master for instant order pricing.</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-neutral-200">
        <div className="relative col-span-1 sm:col-span-2 md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search code, name, specs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-neutral-50 border-neutral-200"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.categoryName}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Default Suppliers</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>{sup.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Items Table */}
      <Card className="overflow-hidden border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Item Code</th>
                <th className="py-3.5 px-4">Item Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Unit</th>
                <th className="py-3.5 px-4">Specification</th>
                <th className="py-3.5 px-4">Default Supplier</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                {isEditor && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={isEditor ? 9 : 8} className="py-12 text-center text-neutral-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    No subcontract items found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-neutral-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {item.itemCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      {item.itemName}
                      {item.description && (
                        <p className="text-[10px] text-neutral-400 font-normal truncate max-w-xs">{item.description}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                        <Layers className="w-3 h-3 text-neutral-400" />
                        {item.categoryName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-neutral-700">
                      {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 max-w-xs truncate">
                      {item.specification || <span className="text-neutral-300 italic">N/A</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.defaultSupplierName ? (
                        <span className="inline-flex items-center gap-1 text-neutral-800 font-medium">
                          <Building2 className="w-3 h-3 text-neutral-400" />
                          {item.defaultSupplierName}
                        </span>
                      ) : (
                        <span className="text-neutral-300 italic">Any / Not set</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                      }`}>
                        {item.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isEditor && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Item"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.itemName)}
                            disabled={isDeleting === item.id}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Item"
                          >
                            {isDeleting === item.id ? (
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

      {/* Add/Edit Item Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Sub Contract Item' : 'Add New Sub Contract Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">
                Item Code <span className="text-rose-500">*</span>
              </label>
              <Input
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                placeholder="e.g. DYE-001, WOV-001, EMB-001"
                required
                className="font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">
                Service Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                required
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="" disabled>Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.categoryName} ({cat.categoryCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">
              Item / Service Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. 100% Cotton Reactive Fabric Dyeing, Twill Tape Weaving, 3D Front Panel Embroidery"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Unit of Measurement</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                {COMMON_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
                <option value="custom">Other (Custom Unit)</option>
              </select>
              {unit === 'custom' && (
                <Input
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Enter custom unit (e.g. Set, Bag, Pack)"
                  className="mt-1"
                  required
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Default Preferred Supplier</label>
              <select
                value={defaultSupplierId}
                onChange={(e) => setDefaultSupplierId(e.target.value)}
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="">None / Open to Any Supplier</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Technical Specifications / Quality Standards</label>
            <Input
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              placeholder="e.g. 180-220 GSM, Color Fastness Grade 4+, 12000 Stitches"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Description / Internal Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional operational instructions or handling notes..."
              rows={2}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-800"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Status</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="itemStatus"
                  value="active"
                  checked={status === 'active'}
                  onChange={() => setStatus('active')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-neutral-700">Active</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="itemStatus"
                  value="inactive"
                  checked={status === 'inactive'}
                  onChange={() => setStatus('inactive')}
                  className="text-blue-600 focus:ring-blue-500"
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
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
