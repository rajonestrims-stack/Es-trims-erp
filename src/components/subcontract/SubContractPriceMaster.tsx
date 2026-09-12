import React, { useState } from 'react';
import { 
  DollarSign, 
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
  History,
  Calendar,
  AlertCircle,
  TrendingUp,
  Tag,
  FolderTree,
  Scale
} from 'lucide-react';
import { 
  SubContractCategory, 
  SubContractSubCategory, 
  SubContractItem, 
  SubContractPrice, 
  Supplier, 
  UserProfile 
} from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface SubContractPriceMasterProps {
  prices: SubContractPrice[];
  categories: SubContractCategory[];
  subCategories: SubContractSubCategory[];
  items: SubContractItem[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSavePrice: (price: Partial<SubContractPrice>) => Promise<void>;
  onDeletePrice: (id: string) => Promise<void>;
  isEditor: boolean;
}

const SUPPORTED_CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'RMB'];

export const SubContractPriceMaster: React.FC<SubContractPriceMasterProps> = ({
  prices,
  categories,
  subCategories,
  items,
  suppliers,
  userProfile,
  showToast,
  onSavePrice,
  onDeletePrice,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subCategoryFilter, setSubCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedPriceForHistory, setSelectedPriceForHistory] = useState<SubContractPrice | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [itemId, setItemId] = useState('');
  const [contractPrice, setContractPrice] = useState<number | string>('');
  const [currency, setCurrency] = useState('BDT');
  const [unit, setUnit] = useState('KG');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const filteredPrices = prices.filter(p => {
    const matchesSearch = 
      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.subCategoryName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.categoryName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSupplier = supplierFilter === 'all' || p.supplierId === supplierFilter;
    const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
    const matchesSubCategory = subCategoryFilter === 'all' || p.subCategoryId === subCategoryFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesSupplier && matchesCategory && matchesSubCategory && matchesStatus;
  });

  const availableSubCategories = subCategories.filter(
    sc => !categoryId || sc.categoryId === categoryId
  );

  const availableItems = items.filter(
    i => !categoryId || i.categoryId === categoryId
  );

  const handleOpenAdd = () => {
    setEditingId(null);
    const firstSupplier = suppliers[0]?.id || '';
    const firstCategory = categories[0]?.id || '';
    setSupplierId(firstSupplier);
    setCategoryId(firstCategory);
    
    const matchedSubCats = subCategories.filter(sc => !firstCategory || sc.categoryId === firstCategory);
    const firstSubCat = matchedSubCats[0];
    setSubCategoryId(firstSubCat?.id || '');
    setUnit(firstSubCat?.defaultUnit || 'KG');

    const matchedItems = items.filter(i => !firstCategory || i.categoryId === firstCategory);
    setItemId(matchedItems[0]?.id || '');
    setContractPrice('');
    setCurrency('BDT');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
    setRemarks('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (price: SubContractPrice) => {
    setEditingId(price.id);
    setSupplierId(price.supplierId);
    setCategoryId(price.categoryId);
    setSubCategoryId(price.subCategoryId || '');
    setItemId(price.itemId || '');
    setContractPrice(price.contractPrice);
    setCurrency(price.currency || 'BDT');
    setUnit(price.unit);
    setEffectiveFrom(price.effectiveFrom);
    setEffectiveTo(price.effectiveTo || '');
    setRemarks(price.remarks || '');
    setStatus(price.status);
    setIsModalOpen(true);
  };

  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    const matchedSubCats = subCategories.filter(sc => !catId || sc.categoryId === catId);
    const firstSubCat = matchedSubCats[0];
    setSubCategoryId(firstSubCat?.id || '');
    if (firstSubCat) {
      setUnit(firstSubCat.defaultUnit || 'KG');
    }
  };

  const handleSubCategoryChange = (subCatId: string) => {
    setSubCategoryId(subCatId);
    const sc = subCategories.find(s => s.id === subCatId);
    if (sc) {
      setUnit(sc.defaultUnit || 'KG');
      if (sc.categoryId && sc.categoryId !== categoryId) {
        setCategoryId(sc.categoryId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      showToast('Supplier is required', 'error');
      return;
    }
    if (!categoryId) {
      showToast('Category is required', 'error');
      return;
    }
    if (!subCategoryId && !itemId) {
      showToast('Sub-Category or Item is required', 'error');
      return;
    }
    if (contractPrice === '' || Number(contractPrice) < 0) {
      showToast('Valid Contract Price is required', 'error');
      return;
    }

    const sup = suppliers.find(s => s.id === supplierId);
    const cat = categories.find(c => c.id === categoryId);
    const subCat = subCategories.find(sc => sc.id === subCategoryId);
    const it = items.find(i => i.id === itemId);

    setIsSaving(true);
    try {
      const priceVal = Number(contractPrice);
      const existing = editingId ? prices.find(p => p.id === editingId) : null;
      let priceHistory = existing?.priceHistory || [];

      if (existing && existing.contractPrice !== priceVal) {
        priceHistory = [
          ...priceHistory,
          {
            oldPrice: existing.contractPrice,
            newPrice: priceVal,
            changedDate: new Date().toISOString(),
            changedBy: userProfile.displayName || userProfile.email || 'User',
            remarks: remarks || 'Price updated in master'
          }
        ];
      }

      await onSavePrice({
        id: editingId || undefined,
        supplierId,
        supplierName: sup?.name || 'Unknown Supplier',
        categoryId,
        categoryName: cat?.categoryName || 'General',
        subCategoryId: subCategoryId || undefined,
        subCategoryName: subCat?.subCategoryName || undefined,
        itemId: itemId || undefined,
        itemCode: it?.itemCode || undefined,
        itemName: it?.itemName || subCat?.subCategoryName || 'Subcontract Service',
        unit,
        contractPrice: priceVal,
        currency,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        remarks: remarks || undefined,
        status,
        previousPrice: existing ? existing.contractPrice : undefined,
        priceHistory
      });

      showToast(editingId ? 'Price updated successfully' : 'Price established successfully', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save price', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeletePrice(id);
      showToast('Price record deleted', 'success');
      setIsDeleting(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete price', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Supplier & Sub-Category Price Master
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Define contract unit prices per Supplier and Sub-Category. When creating Sub Contract POs, selecting the supplier and sub-category auto-fills the price.
          </p>
        </div>

        {isEditor && (
          <Button
            onClick={handleOpenAdd}
            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Supplier Price
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search supplier, sub-category, item..."
            className="pl-9 text-xs rounded-xl bg-white border-neutral-200"
          />
        </div>

        <div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.categoryName}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="all">All Status</option>
            <option value="active">Active Rates</option>
            <option value="inactive">Inactive Rates</option>
          </select>
        </div>
      </div>

      {/* Price Table Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 font-bold uppercase text-[10px]">
                <th className="p-3.5">Supplier</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Sub-Category / Process</th>
                <th className="p-3.5 text-center">Unit</th>
                <th className="p-3.5 text-right">Contract Rate</th>
                <th className="p-3.5">Effective Date</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredPrices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-neutral-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-neutral-300" />
                    <p className="font-bold text-neutral-700">No Prices Defined</p>
                    <p className="text-xs mt-1">Set rates for suppliers and sub-categories to enable instant pricing on purchase orders.</p>
                  </td>
                </tr>
              ) : (
                filteredPrices.map((price) => (
                  <tr key={price.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                        {price.supplierName}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-semibold text-[11px] rounded-lg">
                        {price.categoryName}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <FolderTree className="w-3.5 h-3.5 text-indigo-500" />
                        {price.subCategoryName || price.itemName || '—'}
                      </div>
                      {price.remarks && (
                        <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">{price.remarks}</p>
                      )}
                    </td>

                    <td className="p-3.5 text-center font-bold text-neutral-600">
                      {price.unit}
                    </td>

                    <td className="p-3.5 text-right">
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {price.contractPrice.toLocaleString()} {price.currency}
                      </span>
                      {price.previousPrice && (
                        <span className="block text-[10px] text-neutral-400 line-through">
                          Prev: {price.previousPrice} {price.currency}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-neutral-600">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {price.effectiveFrom}
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                        price.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {price.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {price.priceHistory && price.priceHistory.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedPriceForHistory(price);
                              setIsHistoryModalOpen(true);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Price Revision History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isEditor && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(price)}
                              className="p-1.5 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Edit Price"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setIsDeleting(price.id)}
                              className="p-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Price"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add/Edit Price */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Supplier Contract Rate' : 'Establish Supplier & Sub-Category Rate'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Supplier / Subcontractor *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                required
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.categoryName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Sub-Category / Process *</label>
              <select
                value={subCategoryId}
                onChange={(e) => handleSubCategoryChange(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="">Select Sub-Category</option>
                {availableSubCategories.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.subCategoryName} ({sc.subCategoryCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Specific Item (Optional)</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="">All items under sub-category</option>
                {availableItems.map(i => (
                  <option key={i.id} value={i.id}>{i.itemName} ({i.itemCode})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Contract Price / Rate *</label>
              <Input
                type="number"
                step="0.0001"
                value={contractPrice}
                onChange={(e) => setContractPrice(e.target.value)}
                required
                placeholder="0.00"
                className="text-xs rounded-xl font-bold font-mono text-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              >
                {SUPPORTED_CURRENCIES.map(curr => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Unit of Measure *</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
                <option value="YDS">YDS</option>
                <option value="DZN">DZN</option>
                <option value="MTR">MTR</option>
                <option value="GROSS">GROSS</option>
                <option value="CONE">CONE</option>
                <option value="BAG">BAG</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Effective From *</label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
                className="text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Effective To</label>
              <Input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="active">Active Rate</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Remarks / Quality Clause</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="e.g. Rate includes dyeing & enzyme washing, vat included..."
              className="w-full p-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
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
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Rate' : 'Save Contract Rate'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: History */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Price Revision History"
      >
        <div className="space-y-4">
          {selectedPriceForHistory && (
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs">
              <span className="font-bold text-neutral-900">{selectedPriceForHistory.supplierName}</span>
              <p className="text-neutral-600">
                {selectedPriceForHistory.categoryName} • {selectedPriceForHistory.subCategoryName || selectedPriceForHistory.itemName}
              </p>
            </div>
          )}

          <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
            {selectedPriceForHistory?.priceHistory?.map((h, i) => (
              <div key={i} className="py-2.5 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-neutral-500 line-through">{h.oldPrice}</span>
                  <span className="text-emerald-700">{h.newPrice} BDT</span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-1 flex justify-between">
                  <span>By: {h.changedBy}</span>
                  <span>{new Date(h.changedDate).toLocaleDateString()}</span>
                </div>
                {h.remarks && <p className="text-[11px] text-neutral-600 mt-0.5">{h.remarks}</p>}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        isOpen={!!isDeleting}
        onClose={() => setIsDeleting(null)}
        title="Confirm Delete Price Record"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-600">
            Are you sure you want to delete this price record? Subcontract PO auto-pricing will no longer find this rate.
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
