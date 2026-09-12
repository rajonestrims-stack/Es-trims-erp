import React, { useState, useEffect, useMemo } from 'react';
import { 
  Workflow, 
  GitFork, 
  CheckCircle2, 
  Sliders, 
  Search, 
  ArrowRight, 
  Sparkles, 
  RefreshCw, 
  Edit3, 
  Save, 
  X, 
  RotateCcw, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Play, 
  Layers, 
  Building2, 
  Receipt, 
  CreditCard, 
  Package, 
  Truck, 
  Landmark, 
  Check, 
  FileText,
  HelpCircle,
  FolderTree,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  BookOpen,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  AutoPostingRule, 
  PostingModuleType, 
  PostingEventCode, 
  PostingSimulationPayload, 
  PostingSimulationResult 
} from '../../types/postingRules';
import { 
  CoaLedgerAccount 
} from '../../types/accounts';
import { 
  UserProfile 
} from '../../types';
import { 
  fetchPostingRules, 
  savePostingRule, 
  deletePostingRule,
  resetPostingRulesToDefaults, 
  simulatePostingJournal,
  executeAutoPostForEvent 
} from '../../services/postingRulesService';
import { cn } from '../../lib/utils';

interface AutoPostingMappingViewProps {
  businessId: string;
  userProfile: UserProfile;
  coaLedgers: CoaLedgerAccount[];
  currencySymbol?: string;
  onRefreshData?: () => void;
  onNavigateToJournal?: () => void;
}

// Searchable Account Select Component
interface AccountSelectProps {
  label: string;
  labelColorClass?: string;
  selectedCode: string;
  selectedName: string;
  coaLedgers: CoaLedgerAccount[];
  onSelect: (account: { code: string; name: string; accountType: any }) => void;
  optional?: boolean;
  onClear?: () => void;
}

const SearchableAccountSelect: React.FC<AccountSelectProps> = ({
  label,
  labelColorClass = 'text-emerald-400',
  selectedCode,
  selectedName,
  coaLedgers,
  onSelect,
  optional = false,
  onClear
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm) return coaLedgers;
    const q = searchTerm.toLowerCase();
    return coaLedgers.filter(
      l => l.code.toLowerCase().includes(q) || 
           l.name.toLowerCase().includes(q) || 
           l.accountType.toLowerCase().includes(q) ||
           (l.groupName && l.groupName.toLowerCase().includes(q))
    );
  }, [coaLedgers, searchTerm]);

  // Group accounts by Account Type for organized display
  const grouped = useMemo(() => {
    const groups: { [key: string]: CoaLedgerAccount[] } = {};
    filtered.forEach(acc => {
      const type = acc.accountType || 'Other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(acc);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between">
        <label className={cn("block text-xs font-semibold", labelColorClass)}>
          {label} {optional && <span className="text-slate-400 font-normal">(Optional)</span>}
        </label>
        {optional && selectedCode && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
          >
            Clear
          </button>
        )}
      </div>

      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-white flex items-center justify-between cursor-pointer transition-all"
      >
        {selectedCode ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-[11px] font-bold">
              {selectedCode}
            </span>
            <span className="truncate font-semibold">{selectedName}</span>
          </div>
        ) : (
          <span className="text-slate-500">-- Select Ledger Account --</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 max-h-64 overflow-y-auto space-y-2">
          <div className="relative sticky top-0 bg-slate-900 pb-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ledger code or name..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-3 text-xs text-slate-500">No ledger accounts found</div>
          ) : (
            (Object.entries(grouped) as [string, CoaLedgerAccount[]][]).map(([groupName, items]) => (
              <div key={groupName} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-1">
                  {groupName} ({items.length})
                </div>
                {items.map(acc => (
                  <button
                    type="button"
                    key={acc.code}
                    onClick={() => {
                      onSelect({ code: acc.code, name: acc.name, accountType: acc.accountType });
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors",
                      selectedCode === acc.code 
                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold" 
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[11px] text-slate-400">{acc.code}</span>
                      <span className="truncate">{acc.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 ml-2 font-mono">{acc.groupName || acc.accountType}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const AutoPostingMappingView: React.FC<AutoPostingMappingViewProps> = ({
  businessId,
  userProfile,
  coaLedgers = [],
  currencySymbol = '$',
  onRefreshData,
  onNavigateToJournal
}) => {
  const [rules, setRules] = useState<AutoPostingRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'matrix' | 'simulator' | 'guide'>('matrix');

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Editing / Creating Rule State
  const [editingRule, setEditingRule] = useState<AutoPostingRule | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);

  // Simulator State
  const [simEventCode, setSimEventCode] = useState<PostingEventCode>('SALES_BILL_CONFIRMED');
  const [simAmount, setSimAmount] = useState<number>(50000);
  const [simSecondaryAmount, setSimSecondaryAmount] = useState<number>(4500);
  const [simPartyName, setSimPartyName] = useState<string>('Apex Garments & Textiles Ltd.');
  const [simReferenceNo, setSimReferenceNo] = useState<string>('INV-2026-0891');
  const [simNotes, setSimNotes] = useState<string>('Export Sales Delivery Challan Batch #102');
  const [isExecutingRealPost, setIsExecutingRealPost] = useState<boolean>(false);

  // Load Rules
  const loadRules = async () => {
    try {
      setIsLoading(true);
      const data = await fetchPostingRules(businessId);
      setRules(data);
    } catch (err) {
      console.error('Error fetching posting rules:', err);
      showToast('Error loading posting rules', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [businessId]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchModule = selectedModuleFilter === 'all' || r.moduleKey === selectedModuleFilter;
      const matchQuery = 
        (r.eventName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.eventNameBn || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.debitLedgerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.creditLedgerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.triggerDescriptionBn || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.eventCode || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchModule && matchQuery;
    });
  }, [rules, selectedModuleFilter, searchQuery]);

  // Simulation Result Computation
  const simulationResult = useMemo<PostingSimulationResult | null>(() => {
    const payload: PostingSimulationPayload = {
      eventCode: simEventCode,
      amount: simAmount,
      secondaryAmount: simSecondaryAmount,
      partyName: simPartyName,
      referenceNo: simReferenceNo,
      notes: simNotes
    };
    return simulatePostingJournal(payload, rules, coaLedgers);
  }, [simEventCode, simAmount, simSecondaryAmount, simPartyName, simReferenceNo, simNotes, rules, coaLedgers]);

  // Toggle Auto-post Status
  const handleToggleAutoPost = async (rule: AutoPostingRule) => {
    const updated = { ...rule, isAutoPostActive: !rule.isAutoPostActive };
    try {
      await savePostingRule(updated, businessId);
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
      showToast(`Rule "${rule.eventName}" is now ${updated.isAutoPostActive ? 'ACTIVE (Auto-Posting Enabled)' : 'PAUSED (Manual)'}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to update rule status', 'error');
    }
  };

  // Open "Create New Rule" Modal
  const handleOpenCreateModal = () => {
    const defaultDebit = coaLedgers[0] || { code: '110100000001', name: 'Cash in Hand', accountType: 'Asset' };
    const defaultCredit = coaLedgers[1] || { code: '410100000001', name: 'Sales Revenue', accountType: 'Revenue' };
    
    const newRule: AutoPostingRule = {
      id: `custom_rule_${Date.now()}`,
      businessId,
      moduleKey: 'sales_billing',
      moduleName: 'Custom Module',
      moduleNameBn: 'Custom Module',
      eventCode: `CUSTOM_EVENT_${Date.now().toString().slice(-4)}` as any,
      eventName: 'New Custom Mapping Rule',
      eventNameBn: 'New Custom Mapping Rule',
      triggerDescription: 'Trigger condition for custom automatic journal posting',
      triggerDescriptionBn: 'When this business event occurs, automatically create a balanced double-entry GL journal.',
      debitLedgerCode: defaultDebit.code,
      debitLedgerName: defaultDebit.name,
      debitAccountType: (defaultDebit.accountType as any) || 'Asset',
      creditLedgerCode: defaultCredit.code,
      creditLedgerName: defaultCredit.name,
      creditAccountType: (defaultCredit.accountType as any) || 'Revenue',
      voucherPrefix: 'JV-CUST',
      isAutoPostActive: true,
      requiresApproval: false,
      financialStatementImpact: 'Increases Asset (Dr) and increases Revenue/Liability (Cr)'
    };

    setEditingRule(newRule);
    setIsCreatingNew(true);
  };

  // Duplicate an existing rule to make a variant
  const handleDuplicateRule = (rule: AutoPostingRule) => {
    const duplicated: AutoPostingRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      eventCode: `${rule.eventCode}_CUSTOM` as any,
      eventName: `${rule.eventName} (Copy)`,
      eventNameBn: `${rule.eventName} (Copy)`,
      isAutoPostActive: true
    };
    setEditingRule(duplicated);
    setIsCreatingNew(true);
    showToast(`Rule "${rule.eventName}" duplicated for editing.`, 'info');
  };

  // Delete Rule
  const handleDeleteRule = async (rule: AutoPostingRule) => {
    if (!window.confirm(`Are you sure you want to delete the mapping rule "${rule.eventName}"?`)) {
      return;
    }
    try {
      await deletePostingRule(rule.id, businessId);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      showToast(`Mapping rule "${rule.eventName}" deleted successfully.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete rule', 'error');
    }
  };

  // Save Modal Changes (Create or Update)
  const handleSaveEditedRule = async () => {
    if (!editingRule) return;
    if (!editingRule.eventName || !editingRule.debitLedgerCode || !editingRule.creditLedgerCode) {
      showToast('Please provide rule name, debit ledger, and credit ledger', 'error');
      return;
    }

    try {
      setIsSavingRule(true);
      await savePostingRule(editingRule, businessId);
      
      if (isCreatingNew) {
        setRules(prev => [editingRule, ...prev.filter(r => r.id !== editingRule.id)]);
        showToast(`New mapping rule "${editingRule.eventName}" created successfully!`, 'success');
      } else {
        setRules(prev => prev.map(r => r.id === editingRule.id ? editingRule : r));
        showToast(`Mapping rule "${editingRule.eventName}" updated successfully!`, 'success');
      }
      
      setEditingRule(null);
      setIsCreatingNew(false);
    } catch (err) {
      console.error(err);
      showToast('Error saving mapping rule', 'error');
    } finally {
      setIsSavingRule(false);
    }
  };

  // Reset to System Defaults
  const handleResetDefaults = async () => {
    if (!window.confirm('Are you sure you want to reset to factory default mapping rules? (All standard system rules will be restored)')) {
      return;
    }
    try {
      setIsLoading(true);
      const resetList = await resetPostingRulesToDefaults(businessId);
      setRules(resetList);
      showToast('All journal posting rules have been reset to factory defaults!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to reset rules', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Execute Real Post from Simulator
  const handleExecuteRealPost = async () => {
    if (!simulationResult) return;
    try {
      setIsExecutingRealPost(true);
      const authorUid = userProfile?.uid || 'system_accountant';
      const authorName = userProfile?.displayName || userProfile?.email || 'Accountant';
      
      const res = await executeAutoPostForEvent(
        simEventCode,
        {
          amount: simAmount,
          secondaryAmount: simSecondaryAmount,
          partyName: simPartyName,
          referenceNo: simReferenceNo,
          referenceType: 'manual',
          narration: simulationResult.narration
        },
        businessId,
        authorUid,
        authorName
      );

      if (res) {
        showToast(`Journal voucher ${res.journalNo} successfully posted to General Ledger (GL)!`, 'success');
        if (onRefreshData) onRefreshData();
      } else {
        showToast('Auto-posting was skipped because this rule is currently paused/inactive.', 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to post journal voucher', 'error');
    } finally {
      setIsExecutingRealPost(false);
    }
  };

  const moduleCategories: { key: string; label: string; icon: any }[] = [
    { key: 'all', label: 'All Modules', icon: Layers },
    { key: 'sales_billing', label: 'Sales & Commercial Billing', icon: Receipt },
    { key: 'customer_receipts', label: 'Customer Receipts & Collections', icon: ArrowRight },
    { key: 'procurement_mrr', label: 'Procurement & Store MRR', icon: Package },
    { key: 'production_manufacturing', label: 'Production Floor / WIP', icon: Building2 },
    { key: 'subcontracting', label: 'Subcontracting Operations', icon: Truck },
    { key: 'supplier_payments', label: 'Supplier Payments & AP', icon: CreditCard },
    { key: 'bank_loans_finance', label: 'Bank Loans & Financing', icon: Landmark },
    { key: 'fixed_assets', label: 'Fixed Assets & Depreciation', icon: Building2 },
    { key: 'factory_admin_expenses', label: 'Factory & Admin Expenses', icon: Sliders }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={cn(
          "fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border animate-in fade-in slide-in-from-top-3",
          toastMessage.type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/50' :
          toastMessage.type === 'error' ? 'bg-rose-950/90 text-rose-200 border-rose-700/50' :
          'bg-blue-950/90 text-blue-200 border-blue-700/50'
        )}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {toastMessage.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Workflow className="w-3.5 h-3.5" />
              <span>Full Custom Mapping & Automation Matrix</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              Auto Journal Mapping & Accounting Control
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Configure automated double-entry general ledger rules across all ERP modules. Customize debit and credit ledger mappings, enable or pause live postings, and test with the real-time simulator.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* ADD NEW RULE BUTTON */}
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 border border-emerald-500/40"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Mapping Rule</span>
            </button>

            <button
              onClick={loadRules}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow-sm"
              title="Refresh Rules"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading ? "animate-spin" : "")} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 text-xs font-semibold transition-all shadow-sm"
              title="Reset to factory default rules"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            {onNavigateToJournal && (
              <button
                onClick={onNavigateToJournal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-900/40"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Journal View</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Total Mapping Rules</div>
              <div className="text-xl font-bold text-white">{rules.length} Events</div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Auto-Post Active</div>
              <div className="text-xl font-bold text-emerald-300">
                {rules.filter(r => r.isAutoPostActive).length} Active
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Connected Modules</div>
              <div className="text-xl font-bold text-blue-300">{new Set(rules.map(r => r.moduleKey)).size} Modules</div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Balancing Guarantee</div>
              <div className="text-xl font-bold text-amber-300">100% Dr = Cr</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Mode Selector Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 flex-wrap">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'matrix' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <GitFork className="w-4 h-4" />
            <span>1. Posting Rules Matrix ({filteredRules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'simulator' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span>2. Live Journal Simulator & Test</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'guide' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <HelpCircle className="w-4 h-4" />
            <span>3. Accounting Flow Guide</span>
          </button>
        </div>

        {/* Global Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules, ledgers or event codes..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MAPPING RULES MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Module Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
            {moduleCategories.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedModuleFilter === cat.key;
              const count = cat.key === 'all' 
                ? rules.length 
                : rules.filter(r => r.moduleKey === cat.key).length;

              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedModuleFilter(cat.key)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                      : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    isSelected ? "bg-indigo-800 text-white" : "bg-slate-800 text-slate-400"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Rules Cards / Table */}
          {filteredRules.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Workflow className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-base font-bold text-white">No mapping rules found</div>
              <p className="text-xs text-slate-400">Try changing the module filter or create a new mapping rule</p>
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Mapping Rule</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRules.map((rule) => {
                return (
                  <div 
                    key={rule.id}
                    className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-5 shadow-lg transition-all space-y-4"
                  >
                    {/* Top Bar: Event Name, Actions & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-mono font-bold">
                            {rule.eventCode}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium">
                            {rule.moduleName || rule.moduleKey}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-mono">
                            Prefix: <strong className="text-slate-200">{rule.voucherPrefix}</strong>
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <span>{rule.eventName}</span>
                        </h3>
                        <p className="text-xs text-slate-300">
                          {rule.triggerDescription}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Auto-Post Status Toggle Button */}
                        <button
                          onClick={() => handleToggleAutoPost(rule)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                            rule.isAutoPostActive
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60"
                              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                          )}
                          title="Click to toggle auto-post active/paused"
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            rule.isAutoPostActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                          )} />
                          <span>{rule.isAutoPostActive ? 'Active (Auto-Post)' : 'Paused (Manual)'}</span>
                        </button>

                        {/* Edit Mapping Button */}
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setIsCreatingNew(false);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 text-xs font-semibold transition-colors"
                          title="Edit Mapping Rule"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Duplicate Rule Button */}
                        <button
                          onClick={() => handleDuplicateRule(rule)}
                          className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                          title="Duplicate Rule"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Rule Button */}
                        <button
                          onClick={() => handleDeleteRule(rule)}
                          className="p-1.5 rounded-xl bg-slate-800 text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/50 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Double-Entry Account Matrix (Debit vs Credit) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Debit Card */}
                      <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>DEBIT ACCOUNT (Dr.)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-mono">
                            {rule.debitAccountType}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/40 text-xs">
                              {rule.debitLedgerCode}
                            </span>
                            <span className="truncate">{rule.debitLedgerName}</span>
                          </div>
                          {rule.secondaryDebitLedgerCode && (
                            <div className="mt-2 pt-2 border-t border-emerald-800/30 text-xs text-emerald-300/90 flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700/40 font-mono">
                                +2nd Dr: {rule.secondaryDebitLedgerCode}
                              </span>
                              <span className="truncate">{rule.secondaryDebitLedgerName}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Credit Card */}
                      <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                            <TrendingDown className="w-3.5 h-3.5" />
                            <span>CREDIT ACCOUNT (Cr.)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-mono">
                            {rule.creditAccountType}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="font-mono text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-700/40 text-xs">
                              {rule.creditLedgerCode}
                            </span>
                            <span className="truncate">{rule.creditLedgerName}</span>
                          </div>
                          {rule.secondaryCreditLedgerCode && (
                            <div className="mt-2 pt-2 border-t border-blue-800/30 text-xs text-blue-300/90 flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-blue-950 px-1.5 py-0.5 rounded border border-blue-700/40 font-mono">
                                +2nd Cr: {rule.secondaryCreditLedgerCode}
                              </span>
                              <span className="truncate">{rule.secondaryCreditLedgerName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Impact Footer */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-300">Financial Impact:</span>
                        <span className="text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/30 font-medium">
                          {rule.financialStatementImpact}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setSimEventCode(rule.eventCode);
                          setActiveTab('simulator');
                        }}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold hover:underline"
                      >
                        <span>Test in Simulator</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LIVE JOURNAL SIMULATOR */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulator Input Controls (Left Column) */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Posting Test & Preview Controls</h2>
                <p className="text-[11px] text-slate-400">Select module and event to inspect real-time journal voucher generation</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select ERP Event
                </label>
                <select
                  value={simEventCode}
                  onChange={(e) => setSimEventCode(e.target.value as PostingEventCode)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {rules.map(r => (
                    <option key={r.eventCode} value={r.eventCode}>
                      {r.eventName} [{r.eventCode}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Primary Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={simAmount}
                    onChange={(e) => setSimAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                {simulationResult?.rule.secondaryDebitLedgerCode ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Interest / Tax / 2nd Dr ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      value={simSecondaryAmount}
                      onChange={(e) => setSimSecondaryAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Reference / Invoice No
                    </label>
                    <input
                      type="text"
                      value={simReferenceNo}
                      onChange={(e) => setSimReferenceNo(e.target.value)}
                      placeholder="e.g. INV-1092"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Party / Customer / Supplier Name
                </label>
                <input
                  type="text"
                  value={simPartyName}
                  onChange={(e) => setSimPartyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Narration / Notes
                </label>
                <input
                  type="text"
                  value={simNotes}
                  onChange={(e) => setSimNotes(e.target.value)}
                  placeholder="Optional custom narration notes"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExecuteRealPost}
                  disabled={isExecutingRealPost || !simulationResult}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-900/40 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isExecutingRealPost ? 'Executing Posting...' : 'Execute Test Posting (Post to GL)'}</span>
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  * This will instantly post a balanced double-entry journal voucher into the General Ledger (Accounts GL).
                </p>
              </div>
            </div>
          </div>

          {/* Simulator Live Preview (Right Column) */}
          <div className="lg:col-span-7 space-y-4">
            {simulationResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Live Journal Voucher Preview</h3>
                      <div className="text-xs text-slate-400 font-mono">
                        Voucher No: <strong className="text-indigo-300">{simulationResult.voucherNo}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[11px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>100% Balanced</span>
                    </span>
                  </div>
                </div>

                {/* Journal Lines Table */}
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                        <th className="p-3">Ledger Code & Account (COA Account)</th>
                        <th className="p-3">Hierarchy Path (Category)</th>
                        <th className="p-3 text-right text-emerald-400">Debit ({currencySymbol})</th>
                        <th className="p-3 text-right text-blue-400">Credit ({currencySymbol})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {simulationResult.lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 text-slate-300">
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                                {line.accountCode}
                              </span>
                              <span className="font-bold text-white">{line.accountName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Type: {line.accountType} | Nature: {line.nature}
                            </div>
                          </td>
                          <td className="p-3 text-[11px] text-slate-400 max-w-xs truncate" title={line.coaPath}>
                            {line.coaPath}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-300">
                            {line.debit > 0 ? line.debit.toLocaleString() : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-blue-300">
                            {line.credit > 0 ? line.credit.toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-950/80 font-bold border-t border-slate-800 text-xs">
                        <td colSpan={2} className="p-3 text-right text-slate-300">
                          Total Balanced:
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400">
                          {currencySymbol}{simulationResult.totalDebit.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-blue-400">
                          {currencySymbol}{simulationResult.totalCredit.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Narration Preview */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <div className="text-[11px] font-bold text-slate-400">Generated Narration:</div>
                  <div className="text-xs text-indigo-200 font-mono">{simulationResult.narration}</div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
                No active rules loaded
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WORKFLOW & ACCOUNTING FLOW GUIDE */}
      {/* ========================================================================= */}
      {activeTab === 'guide' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Workflow className="w-5 h-5 text-indigo-400" />
              <span>ERP to Accounts Journal Flow Chart & Accounting Policies</span>
            </h2>
            <p className="text-xs text-slate-300">
              Complete reference of how each factory department and operational module hits general ledger accounts:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sales Flow */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Receipt className="w-4 h-4" />
                <span>1. Sales & Commercial Billing</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-white">Invoice Created:</strong> Dr. Accounts Receivable (1101...) | Cr. Sales Revenue (4101...)</li>
                <li><strong className="text-white">Payment Received:</strong> Dr. Bank / Cash (1104...) | Cr. Accounts Receivable (1101...)</li>
                <li><strong className="text-white">Impact:</strong> Increases Cash/Bank on Balance Sheet and reduces Receivables.</li>
              </ul>
            </div>

            {/* Procurement Flow */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Package className="w-4 h-4" />
                <span>2. Procurement & Store Material Receipt (MRR)</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-white">Material Receipt (MRR):</strong> Dr. Raw Material Inventory (1105...) | Cr. Accounts Payable (2101...)</li>
                <li><strong className="text-white">Supplier Payment:</strong> Dr. Accounts Payable (2101...) | Cr. Bank / Cash (1104...)</li>
                <li><strong className="text-white">Impact:</strong> Increases inventory assets and settles supplier AP liabilities.</li>
              </ul>
            </div>

            {/* Production Flow */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>3. Factory Production Floor (WIP to Finished Goods)</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-white">Store Issue to Floor:</strong> Dr. Work-in-Progress / WIP (110500000002) | Cr. Raw Material Stock (110500000001)</li>
                <li><strong className="text-white">Production Finished:</strong> Dr. Finished Goods / FG (110500000003) | Cr. WIP Inventory (110500000002)</li>
                <li><strong className="text-white">Impact:</strong> Internal asset conversion from raw materials into saleable finished garments.</li>
              </ul>
            </div>

            {/* Bank Loans & Financing */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <Landmark className="w-4 h-4" />
                <span>4. Bank Loans & Financing</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-white">Loan Disbursement:</strong> Dr. Bank Current Account (1104...) | Cr. Bank Loan Liability (2202...)</li>
                <li><strong className="text-white">EMI / Installment:</strong> Dr. Bank Loan Liability (Principal) & Dr. Loan Interest Expense (Interest) | Cr. Bank Account</li>
                <li><strong className="text-white">Impact:</strong> Reduces loan principal liability and books finance cost on Income Statement (P&L).</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT POSTING RULE */}
      {/* ========================================================================= */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-400" />
                  <span>{isCreatingNew ? 'Create New Mapping Rule' : `Edit Mapping Rule: ${editingRule.eventName}`}</span>
                </h2>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Event Code: {editingRule.eventCode}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setIsCreatingNew(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Event Name & Event Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rule Name (রুলের নাম) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingRule.eventName}
                    onChange={(e) => setEditingRule({ ...editingRule, eventName: e.target.value, eventNameBn: e.target.value })}
                    placeholder="e.g. Customer Sales Invoice"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Human-readable name of the business operation (যে কাজের জন্য এই পোস্টিং রুল)।
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Event Code (ইভেন্ট কোড) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingRule.eventCode}
                    onChange={(e) => setEditingRule({ ...editingRule, eventCode: e.target.value.toUpperCase().replace(/\s+/g, '_') as any })}
                    placeholder="e.g. SALES_INV_CONFIRMED"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-indigo-300 font-mono uppercase focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Unique ERP trigger code used by the system to post journals automatically.
                  </p>
                </div>
              </div>

              {/* Module Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Module Category
                </label>
                <select
                  value={editingRule.moduleKey}
                  onChange={(e) => setEditingRule({ 
                    ...editingRule, 
                    moduleKey: e.target.value as any,
                    moduleName: moduleCategories.find(c => c.key === e.target.value)?.label || e.target.value,
                    moduleNameBn: moduleCategories.find(c => c.key === e.target.value)?.label || e.target.value
                  })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {moduleCategories.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Debit Account Picker (Searchable COA) */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-3">
                <SearchableAccountSelect
                  label="1. PRIMARY DEBIT LEDGER (Dr. Account) *"
                  labelColorClass="text-emerald-400 font-bold"
                  selectedCode={editingRule.debitLedgerCode}
                  selectedName={editingRule.debitLedgerName}
                  coaLedgers={coaLedgers}
                  onSelect={(acc) => {
                    setEditingRule({
                      ...editingRule,
                      debitLedgerCode: acc.code,
                      debitLedgerName: acc.name,
                      debitAccountType: acc.accountType
                    });
                  }}
                />

                {/* Secondary Debit (Optional) */}
                <SearchableAccountSelect
                  label="2. SECONDARY DEBIT LEDGER (Optional - Tax / Interest / Fees)"
                  labelColorClass="text-emerald-300 font-semibold"
                  selectedCode={editingRule.secondaryDebitLedgerCode || ''}
                  selectedName={editingRule.secondaryDebitLedgerName || ''}
                  coaLedgers={coaLedgers}
                  optional
                  onClear={() => {
                    setEditingRule({
                      ...editingRule,
                      secondaryDebitLedgerCode: undefined,
                      secondaryDebitLedgerName: undefined
                    });
                  }}
                  onSelect={(acc) => {
                    setEditingRule({
                      ...editingRule,
                      secondaryDebitLedgerCode: acc.code,
                      secondaryDebitLedgerName: acc.name
                    });
                  }}
                />
              </div>

              {/* Credit Account Picker (Searchable COA) */}
              <div className="p-3 bg-blue-950/20 border border-blue-800/40 rounded-xl space-y-3">
                <SearchableAccountSelect
                  label="1. PRIMARY CREDIT LEDGER (Cr. Account) *"
                  labelColorClass="text-blue-400 font-bold"
                  selectedCode={editingRule.creditLedgerCode}
                  selectedName={editingRule.creditLedgerName}
                  coaLedgers={coaLedgers}
                  onSelect={(acc) => {
                    setEditingRule({
                      ...editingRule,
                      creditLedgerCode: acc.code,
                      creditLedgerName: acc.name,
                      creditAccountType: acc.accountType
                    });
                  }}
                />

                {/* Secondary Credit (Optional) */}
                <SearchableAccountSelect
                  label="2. SECONDARY CREDIT LEDGER (Optional - TDS / Discounts)"
                  labelColorClass="text-blue-300 font-semibold"
                  selectedCode={editingRule.secondaryCreditLedgerCode || ''}
                  selectedName={editingRule.secondaryCreditLedgerName || ''}
                  coaLedgers={coaLedgers}
                  optional
                  onClear={() => {
                    setEditingRule({
                      ...editingRule,
                      secondaryCreditLedgerCode: undefined,
                      secondaryCreditLedgerName: undefined
                    });
                  }}
                  onSelect={(acc) => {
                    setEditingRule({
                      ...editingRule,
                      secondaryCreditLedgerCode: acc.code,
                      secondaryCreditLedgerName: acc.name
                    });
                  }}
                />
              </div>

              {/* Voucher Prefix & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Voucher Prefix
                  </label>
                  <input
                    type="text"
                    value={editingRule.voucherPrefix}
                    onChange={(e) => setEditingRule({ ...editingRule, voucherPrefix: e.target.value.toUpperCase() })}
                    placeholder="e.g. JV, SV, PV"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Auto-Post Status
                  </label>
                  <select
                    value={editingRule.isAutoPostActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditingRule({ ...editingRule, isAutoPostActive: e.target.value === 'active' })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active (Automatic GL Posting)</option>
                    <option value="inactive">Paused (Manual Posting Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Requires Approval
                  </label>
                  <select
                    value={editingRule.requiresApproval ? 'yes' : 'no'}
                    onChange={(e) => setEditingRule({ ...editingRule, requiresApproval: e.target.value === 'yes' })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="no">No (Direct GL Post)</option>
                    <option value="yes">Yes (Creates Draft Journal)</option>
                  </select>
                </div>
              </div>

              {/* Trigger Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Trigger Condition Description
                </label>
                <textarea
                  rows={2}
                  value={editingRule.triggerDescription}
                  onChange={(e) => setEditingRule({ ...editingRule, triggerDescription: e.target.value, triggerDescriptionBn: e.target.value })}
                  placeholder="e.g. Triggered when a sales invoice is finalized and confirmed..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Financial Impact Statement */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Financial Statement Impact
                </label>
                <input
                  type="text"
                  value={editingRule.financialStatementImpact || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, financialStatementImpact: e.target.value })}
                  placeholder="e.g. Increases Current Assets (Dr) and credits Sales Revenue (Cr)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditingRule(null);
                  setIsCreatingNew(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedRule}
                disabled={isSavingRule}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-900/40 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingRule ? 'Saving Rule...' : isCreatingNew ? 'Create Mapping Rule' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
