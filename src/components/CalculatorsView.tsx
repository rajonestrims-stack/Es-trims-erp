import React, { useState, useMemo } from 'react';
import { Item, ProductionFormula, UserProfile } from '../types';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Calculator, Plus, Edit2, Trash2, CheckCircle2, Sparkles, X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CalculatorsViewProps {
  items: Item[];
  formulas: ProductionFormula[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function CalculatorsView({ items, formulas, userProfile, showToast }: CalculatorsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'formulas'>('calculator');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [targetQty, setTargetQty] = useState('');
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ProductionFormula | null>(null);

  const [formulaFormData, setFormulaFormData] = useState({
    itemId: '',
    piecesPerSheet: '',
    extraPercent: '0'
  });

  const selectedFormula = useMemo(() => 
    formulas.find(f => f.itemId === selectedItemId),
  [formulas, selectedItemId]);

  const calculationResult = useMemo(() => {
    if (!selectedFormula || !targetQty || isNaN(Number(targetQty))) return null;
    
    const qty = Number(targetQty);
    const perSheet = selectedFormula.piecesPerSheet;
    const extra = selectedFormula.extraPercent;
    
    const baseSheets = qty / perSheet;
    const withExtra = baseSheets * (1 + extra / 100);
    const finalSheets = Math.ceil(withExtra);
    
    return {
      baseSheets,
      withExtra,
      finalSheets
    };
  }, [selectedFormula, targetQty]);

  const handleSaveFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaFormData.itemId || !formulaFormData.piecesPerSheet) return;

    try {
      const data = {
        itemId: formulaFormData.itemId,
        piecesPerSheet: Number(formulaFormData.piecesPerSheet),
        extraPercent: Number(formulaFormData.extraPercent) || 0,
        businessId: userProfile?.businessId || 'default',
        ownerId: userProfile?.uid || 'user'
      };

      if (editingFormula) {
        await updateDoc(doc(db, 'formulas', editingFormula.id), data);
        showToast('Formula updated successfully', 'success');
      } else {
        await addDoc(collection(db, 'formulas'), data);
        showToast('Formula added successfully', 'success');
      }
      setShowFormulaModal(false);
      setEditingFormula(null);
      setFormulaFormData({ itemId: '', piecesPerSheet: '', extraPercent: '0' });
    } catch (err: any) {
      console.error('Error saving formula:', err);
      showToast(err.message || 'Failed to save formula', 'error');
    }
  };

  const handleDeleteFormula = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this formula?')) return;
    try {
      await deleteDoc(doc(db, 'formulas', id));
      showToast('Formula deleted successfully', 'success');
    } catch (err: any) {
      console.error('Error deleting formula:', err);
      showToast(err.message || 'Failed to delete formula', 'error');
    }
  };

  const openEditModal = (formula: ProductionFormula) => {
    setEditingFormula(formula);
    setFormulaFormData({
      itemId: formula.itemId,
      piecesPerSheet: String(formula.piecesPerSheet),
      extraPercent: String(formula.extraPercent || 0)
    });
    setShowFormulaModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-neutral-100 pb-1">
        <button 
          onClick={() => setActiveSubTab('calculator')}
          className={cn(
            "pb-3 text-sm font-bold transition-all border-b-2",
            activeSubTab === 'calculator' ? "border-black text-black" : "border-transparent text-neutral-400 hover:text-neutral-600"
          )}
        >
          Calculator
        </button>
        <button 
          onClick={() => setActiveSubTab('formulas')}
          className={cn(
            "pb-3 text-sm font-bold transition-all border-b-2",
            activeSubTab === 'formulas' ? "border-black text-black" : "border-transparent text-neutral-400 hover:text-neutral-600"
          )}
        >
          Production Formulas
        </button>
      </div>

      {activeSubTab === 'calculator' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-6 space-y-6">
            <h3 className="text-lg font-bold text-neutral-900">Production Calculator</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Select Item</label>
                <select 
                  className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-black/5 transition-all"
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                >
                  <option value="">Choose an item...</option>
                  {items.filter(i => formulas.some(f => f.itemId === i.id)).map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                {!selectedFormula && selectedItemId && (
                  <p className="text-[10px] text-red-500 font-medium">No formula found for this item. Add one in the Formulas tab.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Target Quantity (Pcs)</label>
                <Input 
                  type="number" 
                  placeholder="How many pieces to produce?" 
                  value={targetQty}
                  onChange={e => setTargetQty(e.target.value)}
                />
              </div>
            </div>

            {selectedFormula && (
              <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500 font-medium">Formula:</span>
                  <span className="text-neutral-900 font-bold">{selectedFormula.piecesPerSheet} pcs / sheet</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500 font-medium">Extra / Wastage:</span>
                  <span className="text-neutral-900 font-bold">+{selectedFormula.extraPercent}%</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6 flex flex-col justify-center items-center text-center space-y-4">
            {calculationResult ? (
              <div className="w-full space-y-6">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Required Sheets</span>
                  <div className="text-5xl font-black text-neutral-900 tracking-tight">
                    {calculationResult.finalSheets} <span className="text-base font-normal text-neutral-400">Sheets</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-neutral-100 text-left">
                  <div className="p-3 bg-neutral-50 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-neutral-400">Raw Calculation</p>
                    <p className="text-sm font-bold text-neutral-800">{calculationResult.baseSheets.toFixed(2)} sheets</p>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-neutral-400">With Extra Margin</p>
                    <p className="text-sm font-bold text-neutral-800">{calculationResult.withExtra.toFixed(2)} sheets</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-8 text-neutral-400">
                <Calculator className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm font-medium">Select an item and enter quantity to compute sheets required.</p>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Configured Formulas</h3>
              <p className="text-sm text-neutral-500">Manage pieces per sheet and buffer percentages for production items.</p>
            </div>
            <Button
              onClick={() => {
                setEditingFormula(null);
                setFormulaFormData({ itemId: '', piecesPerSheet: '', extraPercent: '0' });
                setShowFormulaModal(true);
              }}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9"
            >
              <Plus className="w-4 h-4" /> Add Formula
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-100">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Pieces Per Sheet</th>
                  <th className="px-4 py-3">Extra Margin (%)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {formulas.map(formula => {
                  const item = items.find(i => i.id === formula.itemId);
                  return (
                    <tr key={formula.id} className="hover:bg-neutral-50/50">
                      <td className="px-4 py-3 font-semibold text-neutral-900">{item?.name || formula.itemId}</td>
                      <td className="px-4 py-3 font-bold">{formula.piecesPerSheet} pcs</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">+{formula.extraPercent}%</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openEditModal(formula)} className="h-8 text-xs">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteFormula(formula.id)} className="h-8 text-xs text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {formulas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-neutral-400 text-sm">
                      No production formulas configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Formula Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900">{editingFormula ? 'Edit Formula' : 'Add Formula'}</h3>
              <button onClick={() => setShowFormulaModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveFormula} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 uppercase">Item</label>
                <select 
                  className="w-full h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/5"
                  value={formulaFormData.itemId}
                  onChange={e => setFormulaFormData(prev => ({ ...prev, itemId: e.target.value }))}
                  required
                >
                  <option value="">Select an item...</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 uppercase">Pieces Per Sheet</label>
                <Input
                  type="number"
                  placeholder="e.g. 24"
                  value={formulaFormData.piecesPerSheet}
                  onChange={e => setFormulaFormData(prev => ({ ...prev, piecesPerSheet: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 uppercase">Extra Wastage (%)</label>
                <Input
                  type="number"
                  placeholder="e.g. 5"
                  value={formulaFormData.extraPercent}
                  onChange={e => setFormulaFormData(prev => ({ ...prev, extraPercent: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
                <Button type="button" variant="outline" onClick={() => setShowFormulaModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  {editingFormula ? 'Update Formula' : 'Save Formula'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
