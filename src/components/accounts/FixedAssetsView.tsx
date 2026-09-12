import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Download, 
  Printer, 
  Calculator, 
  CheckCircle2, 
  ShieldAlert, 
  RotateCcw, 
  TrendingDown, 
  DollarSign, 
  X,
  Layers
} from 'lucide-react';
import { FixedAsset, CoaLedgerAccount, JournalEntry } from '../../types/accounts';
import { saveFixedAsset, saveJournalEntry } from '../../services/accountsService';
import * as XLSX from 'xlsx';

interface FixedAssetsViewProps {
  fixedAssets?: FixedAsset[];
  ledgers?: CoaLedgerAccount[];
  journals?: JournalEntry[];
  businessId: string;
  userDisplayName: string;
  onRefresh: () => void;
  currencySymbol?: string;
}

export const FixedAssetsView: React.FC<FixedAssetsViewProps> = ({
  fixedAssets = [],
  ledgers = [],
  journals = [],
  businessId = 'default',
  userDisplayName = 'User',
  onRefresh,
  currencySymbol = '$'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isDepreciationModalOpen, setIsDepreciationModalOpen] = useState(false);

  // Asset Form State
  const [assetCode, setAssetCode] = useState(`FA-${String(fixedAssets.length + 1).padStart(4, '0')}`);
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState<'Plant & Machinery' | 'Land & Buildings' | 'Office Equipment' | 'Vehicles' | 'Furniture & Fixtures'>('Plant & Machinery');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [salvageValue, setSalvageValue] = useState<number>(0);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number>(10);
  const [depreciationMethod, setDepreciationMethod] = useState<'Straight Line' | 'Reducing Balance'>('Straight Line');
  const [depreciationRate, setDepreciationRate] = useState<number>(10);
  const [location, setLocation] = useState('Factory Shed 1');
  const [serialNo, setSerialNo] = useState('');
  const [assetLedgerId, setAssetLedgerId] = useState('');
  const [depreciationExpenseLedgerId, setDepreciationExpenseLedgerId] = useState('');
  const [accumulatedDepLedgerId, setAccumulatedDepLedgerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fixed Asset COA Ledgers
  const faLedgers = useMemo(() => {
    return ledgers.filter(l => l.status === 'active' && (l.subCategoryId === 'sub-ppe' || l.code.startsWith('1101')));
  }, [ledgers]);

  // Depreciation Expense COA Ledgers
  const depExpenseLedgers = useMemo(() => {
    return ledgers.filter(l => l.status === 'active' && (l.accountType === 'Expense' || l.code.startsWith('5201')));
  }, [ledgers]);

  // Accumulated Depreciation Contra-Asset Ledgers
  const accumDepLedgers = useMemo(() => {
    return ledgers.filter(l => l.status === 'active' && (l.code.startsWith('110103') || l.nature === 'Credit'));
  }, [ledgers]);

  // Asset Statistics
  const totalCost = fixedAssets.reduce((s, a) => s + (a.purchaseCost || 0), 0);
  const totalAccumulatedDep = fixedAssets.reduce((s, a) => s + (a.accumulatedDepreciation || 0), 0);
  const totalNetBookValue = fixedAssets.reduce((s, a) => s + (a.netBookValue || (a.purchaseCost - (a.accumulatedDepreciation || 0))), 0);
  const totalAnnualDepreciation = fixedAssets.reduce((s, a) => {
    const cost = a.purchaseCost || 0;
    const salvage = a.salvageValue || 0;
    const years = a.usefulLifeYears || 10;
    return s + (cost - salvage) / Math.max(1, years);
  }, 0);

  // Save New Fixed Asset
  const handleSaveFixedAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName || purchaseCost <= 0) {
      setFormError('Please enter valid asset name and purchase cost.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const selectedFaLedger = ledgers.find(l => l.id === assetLedgerId) || faLedgers[0];
      const annualDep = (purchaseCost - salvageValue) / Math.max(1, usefulLifeYears);

      const newAsset: FixedAsset = {
        id: `fa_${Date.now()}`,
        assetCode,
        assetName,
        category: assetCategory,
        purchaseDate,
        purchaseCost,
        salvageValue,
        usefulLifeYears,
        depreciationMethod,
        depreciationRate: depreciationRate || (100 / usefulLifeYears),
        accumulatedDepreciation: 0,
        netBookValue: purchaseCost,
        location,
        serialNo,
        assetLedgerId: selectedFaLedger?.id || '',
        assetLedgerCode: selectedFaLedger?.code || '',
        assetLedgerName: selectedFaLedger?.name || '',
        depreciationExpenseLedgerId,
        accumulatedDepLedgerId,
        status: 'active',
        businessId
      };

      await saveFixedAsset(newAsset, businessId);
      setIsAssetModalOpen(false);
      setAssetName('');
      setPurchaseCost(0);
      setSalvageValue(0);
      setSerialNo('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to save fixed asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run Monthly Depreciation Entry to GL
  const handleRunMonthlyDepreciation = async () => {
    setIsSubmitting(true);
    try {
      const monthlyDepAmount = totalAnnualDepreciation / 12;
      if (monthlyDepAmount <= 0) {
        alert('No active depreciable assets found.');
        return;
      }

      const depExpAcc = depExpenseLedgers[0] || ledgers.find(l => l.accountType === 'Expense');
      const accumAcc = accumDepLedgers[0] || ledgers.find(l => l.code.startsWith('1101'));

      if (!depExpAcc || !accumAcc) {
        throw new Error('Ledger mappings for Depreciation Expense or Accumulated Depreciation are missing.');
      }

      const today = new Date().toISOString().split('T')[0];
      const jvNo = `JV-DEP-${today.replace(/-/g, '')}`;

      const newJournal: JournalEntry = {
        id: `jv_dep_${Date.now()}`,
        journalNo: jvNo,
        date: today,
        referenceNo: 'MONTHLY-DEP-CYCLE',
        referenceType: 'depreciation',
        narration: `Monthly Depreciation amortization for ${fixedAssets.length} fixed assets`,
        lines: [
          {
            id: '1',
            accountId: depExpAcc.id,
            accountCode: depExpAcc.code,
            accountName: depExpAcc.name,
            debit: monthlyDepAmount,
            credit: 0,
            lineNarration: 'Monthly Fixed Asset Depreciation Expense'
          },
          {
            id: '2',
            accountId: accumAcc.id,
            accountCode: accumAcc.code,
            accountName: accumAcc.name,
            debit: 0,
            credit: monthlyDepAmount,
            lineNarration: 'Accumulated Depreciation contra-asset provision'
          }
        ],
        totalDebit: monthlyDepAmount,
        totalCredit: monthlyDepAmount,
        costCenter: 'Factory Operations',
        preparedBy: userDisplayName || 'Asset Accountant',
        postedBy: userDisplayName || 'Asset Accountant',
        postedDate: today,
        status: 'posted',
        isSystemGenerated: true,
        businessId
      };

      await saveJournalEntry(newJournal, businessId);

      // Update asset accumulated values
      for (const a of fixedAssets) {
        const assetAnnual = (a.purchaseCost - (a.salvageValue || 0)) / Math.max(1, a.usefulLifeYears);
        const assetMonthly = assetAnnual / 12;
        const newAccum = (a.accumulatedDepreciation || 0) + assetMonthly;
        const newNBV = Math.max(0, a.purchaseCost - newAccum);
        await saveFixedAsset({
          ...a,
          accumulatedDepreciation: newAccum,
          netBookValue: newNBV
        }, businessId);
      }

      setIsDepreciationModalOpen(false);
      onRefresh();
      alert(`Depreciation Journal Voucher ${jvNo} posted successfully for ${currencySymbol}${monthlyDepAmount.toFixed(2)}.`);
    } catch (err: any) {
      console.error(err);
      alert('Error running depreciation: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = fixedAssets.map(a => ({
      'Asset Code': a.assetCode,
      'Asset Name': a.assetName,
      'Category': a.category,
      'Purchase Date': a.purchaseDate,
      'Cost': a.purchaseCost,
      'Salvage Value': a.salvageValue || 0,
      'Useful Life (Yrs)': a.usefulLifeYears,
      'Accumulated Depreciation': a.accumulatedDepreciation || 0,
      'Net Book Value (NBV)': a.netBookValue || (a.purchaseCost - (a.accumulatedDepreciation || 0)),
      'Location': a.location || 'Factory Shed 1',
      'Status': a.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fixed_Assets_Register');
    XLSX.writeFile(wb, `Fixed_Assets_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="fixed-assets-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Fixed Assets & Depreciation Management</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Plant & Machinery, Land & Buildings, Office Equipment, and automated straight-line / reducing-balance depreciation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDepreciationModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Calculator className="w-4 h-4 text-slate-600" />
            Run Monthly Depreciation
          </button>

          <button
            onClick={() => {
              if (faLedgers.length > 0) setAssetLedgerId(faLedgers[0].id);
              if (depExpenseLedgers.length > 0) setDepreciationExpenseLedgerId(depExpenseLedgers[0].id);
              if (accumDepLedgers.length > 0) setAccumulatedDepLedgerId(accumDepLedgers[0].id);
              setIsAssetModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Fixed Asset
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gross Fixed Assets Cost</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">
            {currencySymbol}{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-slate-400 mt-1 block">Total acquisition value (Historical cost)</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Accumulated Depreciation</span>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">
            {currencySymbol}{totalAccumulatedDep.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-amber-600/80 mt-1 block">Total amortization to date</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600">Net Book Value (NBV)</span>
          <h3 className="text-2xl font-bold text-cyan-700 mt-1">
            {currencySymbol}{totalNetBookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-cyan-600/80 mt-1 block">Current balance sheet asset value</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Monthly Dep. Provision</span>
          <h3 className="text-2xl font-bold text-purple-700 mt-1">
            {currencySymbol}{(totalAnnualDepreciation / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-xs text-purple-600/80 mt-1 block">Annual: {currencySymbol}{totalAnnualDepreciation.toLocaleString()}</span>
        </div>
      </div>

      {/* Asset Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Fixed Assets Schedule & Register</h3>
            <p className="text-xs text-slate-500">Property, Plant and Equipment (PPE) detailed register</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Asset Code & Name</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Purchase Date</th>
                <th className="px-6 py-3.5 text-right">Cost ({currencySymbol})</th>
                <th className="px-6 py-3.5 text-right">Life / Method</th>
                <th className="px-6 py-3.5 text-right text-amber-700">Accum. Dep ({currencySymbol})</th>
                <th className="px-6 py-3.5 text-right font-bold text-cyan-800">Net Book Value ({currencySymbol})</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fixedAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No fixed assets registered yet. Click "Register Fixed Asset" to add factory machinery or equipment.
                  </td>
                </tr>
              ) : (
                fixedAssets.map(asset => {
                  const nbv = asset.netBookValue ?? (asset.purchaseCost - (asset.accumulatedDepreciation || 0));
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{asset.assetName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{asset.assetCode} • {asset.location}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">
                        {asset.category}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {asset.purchaseDate}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                        {asset.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-xs">
                        <div>{asset.usefulLifeYears} Yrs</div>
                        <div className="text-[10px] text-slate-400">{asset.depreciationMethod}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-amber-600">
                        {(asset.accumulatedDepreciation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-cyan-800">
                        {nbv.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> ACTIVE
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER ASSET MODAL */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Register New Fixed Asset (PPE)</h3>
                <p className="text-xs text-slate-500">Record capital expenditure with depreciation amortization schedules</p>
              </div>
              <button onClick={() => setIsAssetModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveFixedAsset} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Asset Code</label>
                  <input
                    type="text"
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white"
                  >
                    <option value="Plant & Machinery">Plant & Machinery</option>
                    <option value="Land & Buildings">Land & Buildings</option>
                    <option value="Office Equipment">Office Equipment</option>
                    <option value="Vehicles">Vehicles</option>
                    <option value="Furniture & Fixtures">Furniture & Fixtures</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Asset Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 8-Color Rotary Label Printing Machine"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Historical Cost ({currencySymbol}) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={purchaseCost || ''}
                    onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Salvage / Scrap Value ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salvageValue || ''}
                    onChange={(e) => setSalvageValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Useful Life (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={usefulLifeYears}
                    onChange={(e) => setUsefulLifeYears(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Depreciation Method</label>
                  <select
                    value={depreciationMethod}
                    onChange={(e) => setDepreciationMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white"
                  >
                    <option value="Straight Line">Straight Line Method (SLM)</option>
                    <option value="Reducing Balance">Reducing Balance Method (WDV)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Location / Department</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RUN DEPRECIATION MODAL */}
      {isDepreciationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-cyan-700">
              <Calculator className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-800">Post Monthly Depreciation</h3>
            </div>
            <p className="text-xs text-slate-600">
              This will automatically post a balanced Journal Voucher into the General Ledger:
            </p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 font-mono">
              <div className="text-slate-800"><strong>Dr:</strong> Depreciation Expense ({currencySymbol}{(totalAnnualDepreciation / 12).toFixed(2)})</div>
              <div className="text-slate-800"><strong>Cr:</strong> Accumulated Depreciation ({currencySymbol}{(totalAnnualDepreciation / 12).toFixed(2)})</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDepreciationModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleRunMonthlyDepreciation}
                className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Posting...' : 'Confirm & Post JV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
