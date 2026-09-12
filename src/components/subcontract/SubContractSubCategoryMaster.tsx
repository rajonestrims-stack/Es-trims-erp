import React, { useState } from 'react';
import { 
  FolderTree, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Tag, 
  Layers, 
  CheckCircle2, 
  XCircle,
  Download,
  Filter,
  Sparkles,
  Palette,
  Scissors,
  Printer
} from 'lucide-react';
import { SubContractCategory, SubContractSubCategory } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface SubContractSubCategoryMasterProps {
  categories: SubContractCategory[];
  subCategories: SubContractSubCategory[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSaveSubCategory: (subCat: Partial<SubContractSubCategory>) => Promise<void>;
  onDeleteSubCategory: (id: string) => Promise<void>;
  isEditor: boolean;
}

export const SubContractSubCategoryMaster: React.FC<SubContractSubCategoryMasterProps> = ({
  categories,
  subCategories,
  showToast,
  onSaveSubCategory,
  onDeleteSubCategory,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryCode, setSubCategoryCode] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [orderType, setOrderType] = useState<string>('dyeing');
  const [defaultUnit, setDefaultUnit] = useState('KG');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const filteredSubCategories = subCategories.filter(sc => {
    const matchesSearch = 
      sc.subCategoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sc.subCategoryCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sc.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || sc.categoryId === categoryFilter;
    const matchesOrderType = orderTypeFilter === 'all' || sc.orderType === orderTypeFilter;

    return matchesSearch && matchesCategory && matchesOrderType;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setCategoryId('');
    setSubCategoryCode(`SUB-${String(subCategories.length + 1).padStart(3, '0')}`);
    setSubCategoryName('');
    setOrderType('other');
    setDefaultUnit('KG');
    setDescription('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sc: SubContractSubCategory) => {
    setEditingId(sc.id);
    setCategoryId(sc.categoryId);
    setSubCategoryCode(sc.subCategoryCode);
    setSubCategoryName(sc.subCategoryName);
    setOrderType(sc.orderType || 'dyeing');
    setDefaultUnit(sc.defaultUnit || 'KG');
    setDescription(sc.description || '');
    setStatus(sc.status);
    setIsModalOpen(true);
  };

  const handleCategoryChange = (selectedCatId: string) => {
    setCategoryId(selectedCatId);
    const cat = categories.find(c => c.id === selectedCatId);
    if (cat) {
      const name = cat.categoryName.toLowerCase();
      if (name.includes('dye') || name.includes('wash')) {
        setOrderType('dyeing');
        setDefaultUnit('KG');
      } else if (name.includes('wov') || name.includes('tape') || name.includes('fabric')) {
        setOrderType('woven');
        setDefaultUnit('PCS');
      } else if (name.includes('embroid') || name.includes('stitch')) {
        setOrderType('embroidery');
        setDefaultUnit('PCS');
      } else if (name.includes('print')) {
        setOrderType('printing');
        setDefaultUnit('PCS');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCategoryName.trim()) {
      showToast('Sub-Category Name is required', 'error');
      return;
    }
    if (!categoryId) {
      showToast('Parent Category is required', 'error');
      return;
    }

    const cat = categories.find(c => c.id === categoryId);

    setIsSaving(true);
    try {
      await onSaveSubCategory({
        id: editingId || undefined,
        categoryId,
        categoryName: cat?.categoryName || 'General',
        subCategoryCode: subCategoryCode.trim().toUpperCase(),
        subCategoryName: subCategoryName.trim(),
        orderType: orderType as any,
        defaultUnit,
        description: description.trim(),
        status
      });
      showToast(editingId ? 'Sub-Category updated successfully' : 'Sub-Category created successfully', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save sub-category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeleteSubCategory(id);
      showToast('Sub-Category deleted successfully', 'success');
      setIsDeleting(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete sub-category', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-indigo-600" />
            Sub Contract Sub-Category Master
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage subcontract sub-categories and process categories. Rates in Price Master and PO line items link directly to these sub-categories.
          </p>
        </div>

        {isEditor && (
          <Button
            onClick={handleOpenAdd}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Sub-Category
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by sub-category name or code..."
            className="pl-9 text-xs rounded-xl bg-white border-neutral-200"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="all">All Parent Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.categoryName}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="all">All Order Types</option>
            <option value="dyeing">Dyeing & Washing</option>
            <option value="woven">Woven & Narrow Fabric</option>
            <option value="embroidery">Embroidery</option>
            <option value="printing">Screen & Digital Printing</option>
            <option value="finishing">Finishing / Other</option>
          </select>
        </div>
      </div>

      {/* Sub-Category List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubCategories.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-neutral-200">
            <FolderTree className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-neutral-700">No Sub-Categories Found</p>
            <p className="text-xs text-neutral-400 mt-1">Create sub-categories to set prices and create Sub Contract POs smoothly.</p>
            {isEditor && (
              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="mt-4 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Sub-Category
              </Button>
            )}
          </div>
        ) : (
          filteredSubCategories.map((sc) => (
            <Card key={sc.id} className="p-4 rounded-2xl border border-neutral-200/80 hover:shadow-md transition-shadow bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-[10px] font-bold rounded-lg">
                      {sc.subCategoryCode}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                      sc.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {sc.status.toUpperCase()}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-700 uppercase tracking-wider">
                    {sc.orderType || 'General'}
                  </span>
                </div>

                <h3 className="font-bold text-neutral-900 text-sm">{sc.subCategoryName}</h3>
                <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                  <span className="font-semibold text-neutral-700">{sc.categoryName}</span>
                  <span>•</span>
                  <span>Default Unit: <strong>{sc.defaultUnit}</strong></span>
                </p>

                {sc.description && (
                  <p className="text-xs text-neutral-600 mt-2 bg-neutral-50 p-2 rounded-xl border border-neutral-100 line-clamp-2">
                    {sc.description}
                  </p>
                )}
              </div>

              <div className="pt-4 mt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-neutral-400">ID: {sc.id.slice(0, 8)}...</span>
                
                {isEditor && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(sc)}
                      className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Edit Sub-Category"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsDeleting(sc.id)}
                      className="p-1.5 text-neutral-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Sub-Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal: Add/Edit Sub-Category */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Sub Contract Sub-Category' : 'Create Sub Contract Sub-Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Parent Category *</label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                required
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.categoryName} ({c.categoryCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Sub-Category Code *</label>
              <Input
                value={subCategoryCode}
                onChange={(e) => setSubCategoryCode(e.target.value)}
                required
                placeholder="e.g. SUB-DYE-01"
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Sub-Category / Process Name *</label>
            <Input
              value={subCategoryName}
              onChange={(e) => setSubCategoryName(e.target.value)}
              required
              placeholder="e.g. Reactive Dyeing, Jacquard Woven, 3D Puff Embroidery"
              className="text-xs rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Order Type *</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="dyeing">Dyeing & Washing</option>
                <option value="woven">Woven & Narrow Fabric</option>
                <option value="embroidery">Embroidery</option>
                <option value="printing">Screen & Digital Printing</option>
                <option value="washing">Washing & Treatment</option>
                <option value="finishing">Finishing / Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Default Unit *</label>
              <select
                value={defaultUnit}
                onChange={(e) => setDefaultUnit(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
                <option value="YDS">YDS</option>
                <option value="DZN">DZN (Dozen)</option>
                <option value="MTR">MTR</option>
                <option value="GROSS">GROSS</option>
                <option value="CONE">CONE</option>
                <option value="BAG">BAG</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Description / Technical Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. Standard temperature, chemical wash specifications, stitch density requirements..."
              className="w-full p-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Sub-Category' : 'Create Sub-Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal: Delete */}
      <Modal
        isOpen={!!isDeleting}
        onClose={() => setIsDeleting(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-600">
            Are you sure you want to delete this sub-category? Linked Price Master and PO line items may be affected.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleting(null)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => isDeleting && handleDelete(isDeleting)}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
