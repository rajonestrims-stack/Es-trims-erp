import React, { useState, useMemo } from 'react';
import { printElement } from '../../utils/printHelper';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Download, 
  Printer, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Info, 
  ArrowRight,
  Database,
  Building,
  ShieldAlert,
  X
} from 'lucide-react';
import { 
  CoaGroupMaster, 
  CoaCategoryMaster, 
  CoaSubCategoryMaster, 
  CoaLedgerAccount,
  CoaAccountNature,
  CoaAccountType,
  JournalEntry 
} from '../../types/accounts';
import { 
  saveCoaGroup, 
  saveCoaCategory, 
  saveCoaSubCategory, 
  saveCoaLedger, 
  deleteCoaNode,
  generateNextLedgerCode,
  initializeDefaultCoa 
} from '../../services/accountsService';
import * as XLSX from 'xlsx';

interface ChartOfAccountsViewProps {
  groups: CoaGroupMaster[];
  categories: CoaCategoryMaster[];
  subCategories: CoaSubCategoryMaster[];
  ledgers: CoaLedgerAccount[];
  journals: JournalEntry[];
  businessId: string;
  userUid: string;
  userDisplayName: string;
  isSuperAdmin: boolean;
  onRefresh: () => void;
  currencySymbol?: string;
}

type ModalType = 'none' | 'add_group' | 'add_category' | 'add_subcategory' | 'add_ledger' | 'edit_ledger' | 'view_ledger';

export const ChartOfAccountsView: React.FC<ChartOfAccountsViewProps> = ({
  groups = [],
  categories = [],
  subCategories = [],
  ledgers = [],
  journals = [],
  businessId = 'default',
  userUid = '',
  userDisplayName = 'User',
  isSuperAdmin = false,
  onRefresh,
  currencySymbol = '$'
}) => {
  // Tree expansion state: set of expanded node IDs
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const s = new Set<string>();
    groups.forEach(g => s.add(g.id));
    categories.forEach(c => s.add(c.id));
    subCategories.forEach(sub => s.add(sub.id));
    return s;
  });

  // Auto-expand when groups/categories first load
  const hasAutoExpandedRef = React.useRef(false);
  React.useEffect(() => {
    if (groups.length > 0 && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true;
      setExpandedNodes(prev => {
        const next = new Set(prev);
        groups.forEach(g => next.add(g.id));
        categories.forEach(c => next.add(c.id));
        subCategories.forEach(s => next.add(s.id));
        return next;
      });
    }
  }, [groups.length, categories.length, subCategories.length]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNatureFilter, setSelectedNatureFilter] = useState<'All' | 'Debit' | 'Credit'>('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'All' | CoaAccountType>('All');
  const [selectedNode, setSelectedNode] = useState<{
    type: 'group' | 'category' | 'subcategory' | 'ledger';
    id: string;
    data: any;
  } | null>(null);

  // Modals state
  const [modalType, setModalType] = useState<ModalType>('none');
  const [activeFormData, setActiveFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    groups.forEach(g => all.add(g.id));
    categories.forEach(c => all.add(c.id));
    subCategories.forEach(s => all.add(s.id));
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Build hierarchical Tree Data
  const hierarchicalTree = useMemo(() => {
    return groups.map(group => {
      const groupCategories = categories.filter(c => c.groupId === group.id || c.groupCode === group.code);
      
      const categoryNodes = groupCategories.map(cat => {
        const catSubCategories = subCategories.filter(s => s.categoryId === cat.id || s.categoryCode === cat.code);
        
        const subCategoryNodes = catSubCategories.map(sub => {
          const subLedgers = ledgers.filter(l => l.subCategoryId === sub.id || l.code.startsWith(sub.code.slice(0, 4)));
          
          return {
            ...sub,
            ledgers: subLedgers
          };
        });

        return {
          ...cat,
          subCategories: subCategoryNodes
        };
      });

      return {
        ...group,
        categories: categoryNodes
      };
    });
  }, [groups, categories, subCategories, ledgers]);

  // Compute calculated balances from journals for each ledger
  const ledgerBalancesMap = useMemo(() => {
    const map: Record<string, { debit: number; credit: number; netBalance: number }> = {};
    
    // Initialize with opening balances
    ledgers.forEach(l => {
      map[l.id] = {
        debit: l.nature === 'Debit' ? (l.openingBalance || 0) : 0,
        credit: l.nature === 'Credit' ? (l.openingBalance || 0) : 0,
        netBalance: l.nature === 'Debit' ? (l.openingBalance || 0) : -(l.openingBalance || 0)
      };
    });

    // Sum from posted journal entries
    journals.filter(j => j.status === 'posted').forEach(journal => {
      journal.lines.forEach(line => {
        const ledger = ledgers.find(l => l.id === line.accountId || l.code === line.accountCode);
        if (ledger) {
          if (!map[ledger.id]) {
            map[ledger.id] = { debit: 0, credit: 0, netBalance: 0 };
          }
          map[ledger.id].debit += (line.debit || 0);
          map[ledger.id].credit += (line.credit || 0);
          if (ledger.nature === 'Debit') {
            map[ledger.id].netBalance += ((line.debit || 0) - (line.credit || 0));
          } else {
            map[ledger.id].netBalance += ((line.credit || 0) - (line.debit || 0));
          }
        }
      });
    });

    return map;
  }, [ledgers, journals]);

  // Filtered ledgers for search or flat view
  const filteredLedgers = useMemo(() => {
    return ledgers.filter(l => {
      const matchSearch = !searchQuery || 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.code.includes(searchQuery) ||
        l.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchNature = selectedNatureFilter === 'All' || l.nature === selectedNatureFilter;
      const matchType = selectedTypeFilter === 'All' || l.accountType === selectedTypeFilter;

      return matchSearch && matchNature && matchType;
    });
  }, [ledgers, searchQuery, selectedNatureFilter, selectedTypeFilter]);

  // Handle open add ledger modal with smart code prefill
  const handleOpenAddLedger = (presetSubCat?: CoaSubCategoryMaster) => {
    const subCat = presetSubCat || subCategories[0];
    const cat = categories.find(c => c.id === subCat?.categoryId);
    const grp = groups.find(g => g.id === (subCat?.groupId || cat?.groupId));

    const nextCode = subCat ? generateNextLedgerCode(subCat.code, ledgers) : '100000000001';

    setActiveFormData({
      code: nextCode,
      name: '',
      groupId: grp?.id || '',
      categoryId: cat?.id || '',
      subCategoryId: subCat?.id || '',
      groupName: grp?.name || '',
      categoryName: cat?.name || '',
      subCategoryName: subCat?.name || '',
      accountType: (grp?.name as CoaAccountType) || 'Asset',
      nature: grp?.nature || 'Debit',
      openingBalance: 0,
      openingBalanceDate: new Date().toISOString().split('T')[0],
      currency: 'USD',
      directEntryAllowed: true,
      controlAccount: false,
      systemAccount: false,
      status: 'active',
      description: ''
    });
    setModalType('add_ledger');
    setErrorMessage('');
  };

  // Handle SubCategory change in ledger modal to auto-update group, category, nature & code
  const handleSubCategorySelect = (subCatId: string) => {
    const subCat = subCategories.find(s => s.id === subCatId);
    if (!subCat) return;

    const cat = categories.find(c => c.id === subCat.categoryId);
    const grp = groups.find(g => g.id === (subCat.groupId || cat?.groupId));
    const nextCode = generateNextLedgerCode(subCat.code, ledgers);

    setActiveFormData((prev: any) => ({
      ...prev,
      subCategoryId: subCat.id,
      subCategoryName: subCat.name,
      categoryId: cat?.id || prev.categoryId,
      categoryName: cat?.name || prev.categoryName,
      groupId: grp?.id || prev.groupId,
      groupName: grp?.name || prev.groupName,
      accountType: grp?.name || 'Asset',
      nature: subCat.nature || cat?.nature || grp?.nature || 'Debit',
      code: nextCode
    }));
  };

  // Save Ledger
  const handleSaveLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFormData.code || !activeFormData.name || !activeFormData.subCategoryId) {
      setErrorMessage('Please fill in required fields: Code, Name, and Sub Category.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await saveCoaLedger({
        ...activeFormData,
        businessId
      }, businessId);

      setModalType('none');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to save Ledger account.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportRows = ledgers.map(l => {
      const balanceInfo = ledgerBalancesMap[l.id] || { debit: 0, credit: 0, netBalance: l.openingBalance || 0 };
      return {
        'Account Code': l.code,
        'Account Name': l.name,
        'Group': l.groupName,
        'Category': l.categoryName,
        'Sub Category': l.subCategoryName,
        'Type': l.accountType,
        'Nature': l.nature,
        'Opening Balance': l.openingBalance || 0,
        'Total Debit': balanceInfo.debit,
        'Total Credit': balanceInfo.credit,
        'Current Balance': balanceInfo.netBalance,
        'Direct Entry Allowed': l.directEntryAllowed ? 'Yes' : 'No',
        'Status': l.status
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chart_of_Accounts');
    XLSX.writeFile(workbook, `COA_Chart_of_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="chart-of-accounts-view" className="space-y-6">
      {/* Header & Action Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Chart of Accounts (COA Master)</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            4-Tier Hierarchical Structure: <strong>Account Group</strong> → <strong>Category</strong> → <strong>Sub Category</strong> → <strong>Ledger Account</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              if (window.confirm('Do you want to load or update the complete standard Chart of Accounts hierarchy (Assets, Liabilities, Equity, Revenue, and Operating/Admin/Financial/Distribution Expenses)?')) {
                setIsSaving(true);
                try {
                  await initializeDefaultCoa(businessId, userUid);
                  onRefresh();
                } catch (err: any) {
                  console.error('Error seeding COA:', err);
                  setErrorMessage(err.message || 'Failed to seed COA');
                } finally {
                  setIsSaving(false);
                }
              }
            }}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
            title="Load full standard Chart of Accounts hierarchy from template"
          >
            <Database className="w-4 h-4 text-emerald-600" />
            {isSaving ? 'Syncing Standard COA...' : 'Sync Standard COA Master'}
          </button>

          <button
            onClick={() => handleOpenAddLedger()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Ledger Account
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Export Excel
          </button>

          <button
            onClick={() => printElement('printable-coa-tree', { title: 'Chart_of_Accounts_Report' })}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Print
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search account by code, name, group or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="All">All Account Types</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Equity">Equity</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </div>

        <div>
          <select
            value={selectedNatureFilter}
            onChange={(e) => setSelectedNatureFilter(e.target.value as any)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="All">All Natures (Dr/Cr)</option>
            <option value="Debit">Debit (Dr)</option>
            <option value="Credit">Credit (Cr)</option>
          </select>
        </div>
      </div>

      {/* Split Pane: Left Tree View / Right Details & Transaction Summary */}
      <div id="printable-coa-tree" className="printable-doc grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Tree Explorer (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">Hierarchical Tree Structure</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                {ledgers.length} Ledgers
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button 
                onClick={expandAll}
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                Expand All
              </button>
              <span className="text-slate-300">•</span>
              <button 
                onClick={collapseAll}
                className="text-slate-600 hover:text-slate-700 font-medium hover:underline"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="p-4 max-h-[640px] overflow-y-auto space-y-1.5 font-sans">
            {hierarchicalTree.map(group => {
              const isGroupOpen = expandedNodes.has(group.id);
              const groupBalance = group.categories.reduce((acc, cat) => {
                return acc + cat.subCategories.reduce((sAcc, sub) => {
                  return sAcc + sub.ledgers.reduce((lAcc, l) => {
                    const info = ledgerBalancesMap[l.id];
                    return lAcc + (info ? info.netBalance : 0);
                  }, 0);
                }, 0);
              }, 0);

              return (
                <div key={group.id} className="border border-slate-200/70 rounded-lg overflow-hidden bg-slate-50/30">
                  {/* Tier 1: Group Header */}
                  <div 
                    onClick={() => {
                      toggleNode(group.id);
                      setSelectedNode({ type: 'group', id: group.id, data: group });
                    }}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-100/80 hover:bg-slate-200/70 cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">
                        {isGroupOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {group.code}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                        group.nature === 'Debit' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {group.nature}
                      </span>
                      <span className="text-xs font-bold text-slate-700 min-w-[80px] text-right">
                        {currencySymbol}{Math.abs(groupBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Tier 2: Categories */}
                  {isGroupOpen && (
                    <div className="pl-4 pr-2 py-1 space-y-1 bg-white border-t border-slate-200">
                      {group.categories.map(cat => {
                        const isCatOpen = expandedNodes.has(cat.id);
                        const catBalance = cat.subCategories.reduce((sAcc, sub) => {
                          return sAcc + sub.ledgers.reduce((lAcc, l) => {
                            const info = ledgerBalancesMap[l.id];
                            return lAcc + (info ? info.netBalance : 0);
                          }, 0);
                        }, 0);

                        return (
                          <div key={cat.id} className="border-l-2 border-slate-300 pl-2 py-1">
                            <div 
                              onClick={() => {
                                toggleNode(cat.id);
                                setSelectedNode({ type: 'category', id: cat.id, data: cat });
                              }}
                              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">
                                  {isCatOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </span>
                                <Folder className="w-4 h-4 text-amber-500 fill-amber-100" />
                                <span className="font-mono text-xs text-slate-500">{cat.code}</span>
                                <span className="text-xs font-semibold text-slate-700">{cat.name}</span>
                              </div>

                              <span className="text-xs font-medium text-slate-600 min-w-[70px] text-right">
                                {currencySymbol}{Math.abs(catBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* Tier 3: Sub Categories */}
                            {isCatOpen && (
                              <div className="pl-4 pr-1 py-1 space-y-1">
                                {cat.subCategories.map(sub => {
                                  const isSubOpen = expandedNodes.has(sub.id);
                                  const subBalance = sub.ledgers.reduce((lAcc, l) => {
                                    const info = ledgerBalancesMap[l.id];
                                    return lAcc + (info ? info.netBalance : 0);
                                  }, 0);

                                  return (
                                    <div key={sub.id} className="border-l-2 border-blue-200 pl-2 py-0.5">
                                      <div 
                                        onClick={() => {
                                          toggleNode(sub.id);
                                          setSelectedNode({ type: 'subcategory', id: sub.id, data: sub });
                                        }}
                                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-blue-50/50 cursor-pointer select-none group"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-slate-400">
                                            {isSubOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                          </span>
                                          <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                                          <span className="font-mono text-xs text-blue-800 font-medium">{sub.code}</span>
                                          <span className="text-xs font-medium text-slate-800">{sub.name}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenAddLedger(sub);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-100 rounded transition-opacity"
                                            title="Add ledger under this sub-category"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                          <span className="text-xs font-semibold text-slate-700 min-w-[65px] text-right">
                                            {currencySymbol}{Math.abs(subBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Tier 4: Ledger Accounts (Leaf Nodes) */}
                                      {isSubOpen && (
                                        <div className="pl-4 pr-1 py-1 space-y-1">
                                          {sub.ledgers.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic py-1 pl-2">
                                              No ledger accounts yet. Click + to add.
                                            </div>
                                          ) : (
                                            sub.ledgers.map(ledger => {
                                              const info = ledgerBalancesMap[ledger.id] || { debit: 0, credit: 0, netBalance: ledger.openingBalance || 0 };
                                              const isSelected = selectedNode?.id === ledger.id;

                                              return (
                                                <div 
                                                  key={ledger.id}
                                                  onClick={() => setSelectedNode({ type: 'ledger', id: ledger.id, data: ledger })}
                                                  className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                                    isSelected 
                                                      ? 'bg-blue-50 border-blue-300 font-semibold text-blue-900 shadow-xs' 
                                                      : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-700'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 truncate pr-2">
                                                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="font-mono text-slate-500 font-medium shrink-0">{ledger.code}</span>
                                                    <span className="truncate text-slate-800">{ledger.name}</span>
                                                    {ledger.directEntryAllowed && (
                                                      <span className="shrink-0 px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Direct
                                                      </span>
                                                    )}
                                                  </div>

                                                  <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-mono font-bold text-slate-900">
                                                      {currencySymbol}{Math.abs(info.netBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                                                      ledger.nature === 'Debit' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                      {ledger.nature === 'Debit' ? 'Dr' : 'Cr'}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Details & Mini-Ledger Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {selectedNode?.type === 'ledger' ? (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Ledger Account Detail</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedNode.data.name}</h3>
                  <p className="font-mono text-xs text-slate-500 font-medium">{selectedNode.data.code}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setActiveFormData(selectedNode.data);
                      setModalType('edit_ledger');
                    }}
                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Ledger Account"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {isSuperAdmin && !selectedNode.data.systemAccount && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete ledger account "${selectedNode.data.name}"?`)) {
                          await deleteCoaNode('coa_ledgers', selectedNode.id);
                          setSelectedNode(null);
                          onRefresh();
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Ledger Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Balances Card */}
              {(() => {
                const info = ledgerBalancesMap[selectedNode.data.id] || { debit: 0, credit: 0, netBalance: selectedNode.data.openingBalance || 0 };
                return (
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-xs text-slate-500 font-medium">Opening Balance</span>
                      <div className="text-sm font-bold text-slate-800">
                        {currencySymbol}{(selectedNode.data.openingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-slate-400">{selectedNode.data.openingBalanceDate || 'N/A'}</span>
                    </div>

                    <div>
                      <span className="text-xs text-slate-500 font-medium">Current Balance</span>
                      <div className="text-base font-extrabold text-blue-700">
                        {currencySymbol}{Math.abs(info.netBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-xs ml-1 font-semibold">{selectedNode.data.nature === 'Debit' ? 'Dr' : 'Cr'}</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium">Active Status</span>
                    </div>

                    <div className="border-t border-slate-200/60 pt-2">
                      <span className="text-xs text-slate-500 font-medium">Total Debits</span>
                      <div className="text-xs font-semibold text-slate-700">
                        {currencySymbol}{info.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="border-t border-slate-200/60 pt-2">
                      <span className="text-xs text-slate-500 font-medium">Total Credits</span>
                      <div className="text-xs font-semibold text-slate-700">
                        {currencySymbol}{info.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Hierarchy Path */}
              <div className="space-y-2 text-xs">
                <div className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">Hierarchy Chain</div>
                <div className="space-y-1 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Group:</span>
                    <span className="font-semibold text-slate-800">{selectedNode.data.groupName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-semibold text-slate-800">{selectedNode.data.categoryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sub Category:</span>
                    <span className="font-semibold text-slate-800">{selectedNode.data.subCategoryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Type:</span>
                    <span className="font-semibold text-slate-800">{selectedNode.data.accountType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Direct Entry Allowed:</span>
                    <span className={`font-semibold ${selectedNode.data.directEntryAllowed ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {selectedNode.data.directEntryAllowed ? 'Yes (Permitted for JV)' : 'No (Control Only)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mini Transaction Statement for selected ledger */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Journal Postings</h4>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="p-2">Voucher</th>
                        <th className="p-2">Date</th>
                        <th className="p-2 text-right">Debit</th>
                        <th className="p-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {journals
                        .flatMap(j => j.lines.filter(l => l.accountId === selectedNode.data.id || l.accountCode === selectedNode.data.code).map(line => ({ ...line, jDate: j.date, jNo: j.journalNo })))
                        .slice(0, 8)
                        .map((entry, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-blue-700">{entry.jNo}</td>
                            <td className="p-2 text-slate-500">{entry.jDate}</td>
                            <td className="p-2 text-right font-mono">{entry.debit ? entry.debit.toLocaleString() : '-'}</td>
                            <td className="p-2 text-right font-mono">{entry.credit ? entry.credit.toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center text-slate-500 min-h-[300px]">
              <Info className="w-10 h-10 text-slate-300 mb-3" />
              <h4 className="text-base font-semibold text-slate-700">No Account Selected</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Click on any Ledger Account in the hierarchy tree on the left to view its detailed master configurations, balance sheets, and real-time transaction ledger.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add or Edit Ledger Account */}
      {(modalType === 'add_ledger' || modalType === 'edit_ledger') && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                {modalType === 'add_ledger' ? 'Create New Ledger Account' : 'Edit Ledger Account'}
              </h3>
              <button onClick={() => setModalType('none')} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLedger} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Sub Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={activeFormData.subCategoryId || ''}
                    onChange={(e) => handleSubCategorySelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    <option value="">-- Choose Sub Category --</option>
                    {subCategories.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name} ({sub.nature})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Code (12 Digits) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={activeFormData.code || ''}
                    onChange={(e) => setActiveFormData({ ...activeFormData, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 110101000001"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Auto-generated prefix based on sub-category</span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={activeFormData.name || ''}
                    onChange={(e) => setActiveFormData({ ...activeFormData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Cash in Hand - Main Vault"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Nature</label>
                  <select
                    value={activeFormData.nature || 'Debit'}
                    onChange={(e) => setActiveFormData({ ...activeFormData, nature: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Debit">Debit (Dr)</option>
                    <option value="Credit">Credit (Cr)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Type</label>
                  <input
                    type="text"
                    value={activeFormData.accountType || 'Asset'}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-100 text-slate-600 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opening Balance ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={activeFormData.openingBalance ?? 0}
                    onChange={(e) => setActiveFormData({ ...activeFormData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opening Balance Date</label>
                  <input
                    type="date"
                    value={activeFormData.openingBalanceDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setActiveFormData({ ...activeFormData, openingBalanceDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="chk-direct-entry"
                    checked={activeFormData.directEntryAllowed ?? true}
                    onChange={(e) => setActiveFormData({ ...activeFormData, directEntryAllowed: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <label htmlFor="chk-direct-entry" className="text-xs font-semibold text-slate-700">
                    Allow Direct Journal Entries
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="chk-control-acc"
                    checked={activeFormData.controlAccount ?? false}
                    onChange={(e) => setActiveFormData({ ...activeFormData, controlAccount: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <label htmlFor="chk-control-acc" className="text-xs font-semibold text-slate-700">
                    Control Account (Aggregator)
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Description / Notes</label>
                  <textarea
                    rows={2}
                    value={activeFormData.description || ''}
                    onChange={(e) => setActiveFormData({ ...activeFormData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter operational rules or ledger purposes..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : modalType === 'add_ledger' ? 'Create Account' : 'Update Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
