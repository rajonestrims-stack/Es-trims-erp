import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Edit, Trash2, CheckCircle2, ShieldCheck, 
  Settings2, CreditCard, DollarSign, Search, X, Check, Building
} from 'lucide-react';
import { BankMaster, BankAccountMaster, PISetupConfig, BankAccountType, CurrencyCode, CompanyMaster, UserProfile } from '../../types';
import { addDoc, collection, doc, updateDoc, deleteDoc, onSnapshot, query, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface BankMasterViewProps {
  banks?: BankMaster[];
  bankAccounts?: BankAccountMaster[];
  piSetup?: PISetupConfig | null;
  businessId?: string;
  userEmail?: string;
  userProfile?: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

export const BankMasterView: React.FC<BankMasterViewProps> = ({
  banks: propBanks,
  bankAccounts: propBankAccounts,
  piSetup: propPiSetup,
  businessId = 'default',
  userEmail,
  userProfile,
  showToast,
  isAdmin = true
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'banks' | 'pi-setup'>('accounts');
  
  // Independent data states for Master Setup standalone usage
  const [internalBanks, setInternalBanks] = useState<BankMaster[]>([]);
  const [internalBankAccounts, setInternalBankAccounts] = useState<BankAccountMaster[]>([]);
  const [internalPiSetup, setInternalPiSetup] = useState<PISetupConfig | null>(null);
  const [companies, setCompanies] = useState<CompanyMaster[]>([]);
  
  // Subscribe to Company Masters
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'company_masters'), (snapshot) => {
      const list: CompanyMaster[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CompanyMaster[];
      setCompanies(list);
    }, (err) => {
      console.warn('BankMaster company_masters listener note:', err);
    });
    return () => unsub();
  }, []);

  // Subscribe to Bank Masters if not provided via props
  useEffect(() => {
    if (propBanks && propBanks.length > 0) return;
    const unsub = onSnapshot(collection(db, 'bank_masters'), (snapshot) => {
      const list: BankMaster[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BankMaster[];
      setInternalBanks(list);
    }, (err) => {
      console.warn('BankMaster bank_masters listener note:', err);
    });
    return () => unsub();
  }, [propBanks]);

  // Subscribe to Bank Accounts if not provided via props
  useEffect(() => {
    if (propBankAccounts && propBankAccounts.length > 0) return;
    const unsub = onSnapshot(collection(db, 'bank_accounts'), (snapshot) => {
      const list: BankAccountMaster[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BankAccountMaster[];
      setInternalBankAccounts(list);
    }, (err) => {
      console.warn('BankMaster bank_accounts listener note:', err);
    });
    return () => unsub();
  }, [propBankAccounts]);

  // Subscribe to PI Setup if not provided via props
  useEffect(() => {
    if (propPiSetup) return;
    const unsub = onSnapshot(collection(db, 'pi_setup_configs'), (snapshot) => {
      if (!snapshot.empty) {
        setInternalPiSetup({
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        } as PISetupConfig);
      }
    }, (err) => {
      console.warn('BankMaster pi_setup_configs listener note:', err);
    });
    return () => unsub();
  }, [propPiSetup]);

  const banks = propBanks && propBanks.length > 0 ? propBanks : internalBanks;
  const bankAccounts = propBankAccounts && propBankAccounts.length > 0 ? propBankAccounts : internalBankAccounts;
  const piSetup = propPiSetup || internalPiSetup;

  // Search & Filters
  const [accountSearch, setAccountSearch] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  
  // Bank Modal State
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankMaster | null>(null);
  const [bankFormData, setBankFormData] = useState<Partial<BankMaster>>({
    bankName: '',
    bankCode: '',
    branchName: '',
    branchAddress: '',
    swiftCode: '',
    routingNumber: '',
    country: 'Bangladesh',
    status: 'active'
  });

  // Account Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccountMaster | null>(null);
  const [accountFormData, setAccountFormData] = useState<Partial<BankAccountMaster>>({
    bankId: '',
    bankName: '',
    branch: '',
    companyId: '',
    companyName: 'ES TRIMS LIMITED',
    accountName: 'ES TRIMS LIMITED',
    accountNumber: '',
    accountType: 'Export',
    currency: 'USD',
    swiftCode: '',
    routingNumber: '',
    iban: '',
    beneficiaryName: 'ES TRIMS LIMITED',
    accountAddress: 'Adamjee EPZ, Narayanganj, Bangladesh',
    isDefault: false,
    isActive: true
  });

  // PI Setup Form State
  const [setupData, setSetupData] = useState<Partial<PISetupConfig>>(() => ({
    prefix: piSetup?.prefix || 'PI-',
    startingNumber: piSetup?.startingNumber || 1,
    numberFormat: piSetup?.numberFormat || 'financial_year',
    isBillBasedEnabled: piSetup?.isBillBasedEnabled ?? true,
    isBookingBasedEnabled: piSetup?.isBookingBasedEnabled ?? true,
    isBillValueMatchingMandatory: piSetup?.isBillValueMatchingMandatory ?? true,
    isWoValueMatchingMandatory: piSetup?.isWoValueMatchingMandatory ?? true,
    valueTolerance: piSetup?.valueTolerance ?? 0.00,
    isApprovalRequired: piSetup?.isApprovalRequired ?? true,
    approverRole: piSetup?.approverRole || 'Commercial Manager / Admin'
  }));

  // Update setupData when piSetup changes
  useEffect(() => {
    if (piSetup) {
      setSetupData({
        prefix: piSetup.prefix || 'PI-',
        startingNumber: piSetup.startingNumber || 1,
        numberFormat: piSetup.numberFormat || 'financial_year',
        isBillBasedEnabled: piSetup.isBillBasedEnabled ?? true,
        isBookingBasedEnabled: piSetup.isBookingBasedEnabled ?? true,
        isBillValueMatchingMandatory: piSetup.isBillValueMatchingMandatory ?? true,
        isWoValueMatchingMandatory: piSetup.isWoValueMatchingMandatory ?? true,
        valueTolerance: piSetup.valueTolerance ?? 0.00,
        isApprovalRequired: piSetup.isApprovalRequired ?? true,
        approverRole: piSetup.approverRole || 'Commercial Manager / Admin'
      });
    }
  }, [piSetup]);

  // Handle Company Selection helper
  const handleSelectCompany = (companyId: string) => {
    const selectedCompany = companies.find(c => c.id === companyId);
    if (selectedCompany) {
      setAccountFormData(prev => ({
        ...prev,
        companyId: selectedCompany.id,
        companyName: selectedCompany.companyName,
        accountName: selectedCompany.companyName,
        beneficiaryName: selectedCompany.companyName,
        accountAddress: selectedCompany.registeredAddress || selectedCompany.factoryAddress || prev.accountAddress
      }));
    } else {
      setAccountFormData(prev => ({
        ...prev,
        companyId: '',
        companyName: ''
      }));
    }
  };

  // Handle Save Bank
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankFormData.bankName?.trim()) {
      showToast('Bank Name is required', 'error');
      return;
    }

    try {
      if (editingBank) {
        await updateDoc(doc(db, 'bank_masters', editingBank.id), {
          ...bankFormData,
          bankName: bankFormData.bankName.trim(),
          updatedAt: new Date().toISOString()
        });
        showToast(`Bank '${bankFormData.bankName}' updated successfully`, 'success');
      } else {
        await addDoc(collection(db, 'bank_masters'), {
          ...bankFormData,
          bankName: bankFormData.bankName.trim(),
          businessId,
          createdBy: userEmail || 'Admin',
          createdAt: new Date().toISOString()
        });
        showToast(`Bank '${bankFormData.bankName}' created successfully`, 'success');
      }
      setIsBankModalOpen(false);
      setEditingBank(null);
    } catch (err: any) {
      console.error('Error saving bank:', err);
      showToast('Failed to save bank: ' + err.message, 'error');
    }
  };

  // Handle Save Bank Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormData.bankName?.trim()) {
      showToast('Please select or enter a Bank Name', 'error');
      return;
    }
    if (!accountFormData.accountNumber?.trim()) {
      showToast('Account Number is required', 'error');
      return;
    }

    try {
      const payload: Partial<BankAccountMaster> = {
        ...accountFormData,
        bankName: accountFormData.bankName.trim(),
        accountNumber: accountFormData.accountNumber.trim(),
        accountName: accountFormData.accountName?.trim() || 'ES TRIMS LIMITED',
        beneficiaryName: accountFormData.beneficiaryName?.trim() || 'ES TRIMS LIMITED',
        businessId,
        updatedAt: new Date().toISOString() as any
      };

      if (editingAccount) {
        await updateDoc(doc(db, 'bank_accounts', editingAccount.id), payload);
        showToast(`Account '${accountFormData.accountNumber}' updated successfully`, 'success');
      } else {
        await addDoc(collection(db, 'bank_accounts'), {
          ...payload,
          createdBy: userEmail || 'Admin',
          createdAt: new Date().toISOString()
        });
        showToast(`Account '${accountFormData.accountNumber}' added successfully`, 'success');
      }
      setIsAccountModalOpen(false);
      setEditingAccount(null);
    } catch (err: any) {
      console.error('Error saving account:', err);
      showToast('Failed to save bank account: ' + err.message, 'error');
    }
  };

  // Handle Save PI Setup
  const handleSavePISetup = async () => {
    try {
      if (piSetup?.id) {
        await updateDoc(doc(db, 'pi_setup_configs', piSetup.id), {
          ...setupData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'pi_setup_configs'), {
          ...setupData,
          businessId,
          updatedAt: new Date().toISOString()
        });
      }
      showToast('PI Setup & Validation Rules saved successfully!', 'success');
    } catch (err: any) {
      console.error('Error saving PI setup:', err);
      showToast('Failed to save setup: ' + err.message, 'error');
    }
  };

  // Filtered lists
  const filteredAccounts = bankAccounts.filter(acc => 
    acc.bankName.toLowerCase().includes(accountSearch.toLowerCase()) ||
    acc.accountNumber.toLowerCase().includes(accountSearch.toLowerCase()) ||
    acc.branch.toLowerCase().includes(accountSearch.toLowerCase()) ||
    acc.currency.toLowerCase().includes(accountSearch.toLowerCase())
  );

  const filteredBanks = banks.filter(b =>
    b.bankName.toLowerCase().includes(bankSearch.toLowerCase()) ||
    (b.swiftCode && b.swiftCode.toLowerCase().includes(bankSearch.toLowerCase())) ||
    (b.branchName && b.branchName.toLowerCase().includes(bankSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'accounts'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Bank Accounts Master ({bankAccounts.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('banks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'banks'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Bank Directory ({banks.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pi-setup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'pi-setup'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>PI Rules & Master Setup</span>
          </button>
        </div>

        {/* Create Buttons */}
        <div>
          {activeSubTab === 'accounts' && (
            <button
              onClick={() => {
                setEditingAccount(null);
                setAccountFormData({
                  bankId: banks[0]?.id || '',
                  bankName: banks[0]?.bankName || 'Eastern Bank PLC',
                  branch: banks[0]?.branchName || 'Principal Branch, Dhaka',
                  accountName: 'ES TRIMS LIMITED',
                  accountNumber: '',
                  accountType: 'Export',
                  currency: 'USD',
                  swiftCode: banks[0]?.swiftCode || 'EBLDBDDHA',
                  routingNumber: banks[0]?.routingNumber || '090270000',
                  iban: '',
                  beneficiaryName: 'ES TRIMS LIMITED',
                  accountAddress: 'Plot # 122-124, Adamjee EPZ, Siddhirganj, Narayanganj, Bangladesh',
                  isDefault: bankAccounts.length === 0,
                  isActive: true
                });
                setIsAccountModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bank Account</span>
            </button>
          )}

          {activeSubTab === 'banks' && (
            <button
              onClick={() => {
                setEditingBank(null);
                setBankFormData({
                  bankName: '',
                  bankCode: '',
                  branchName: '',
                  branchAddress: '',
                  swiftCode: '',
                  routingNumber: '',
                  country: 'Bangladesh',
                  status: 'active'
                });
                setIsBankModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bank</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content 1: Bank Accounts Master */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bank accounts by bank, account no, currency..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <span className="text-xs text-neutral-500 font-medium">
              Showing {filteredAccounts.length} of {bankAccounts.length} Accounts
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((acc) => (
              <div 
                key={acc.id} 
                className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 leading-tight">{acc.bankName}</h4>
                        <p className="text-[11px] text-neutral-500">{acc.branch || 'Head Office'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {acc.currency}
                      </span>
                      {acc.isDefault && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          Default
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-2.5 space-y-1.5 text-xs border border-neutral-100 mt-2">
                    {acc.companyName && (
                      <div className="flex justify-between items-center text-[11px] bg-indigo-50/80 px-2 py-1 rounded-md border border-indigo-100 mb-1">
                        <span className="text-indigo-700 font-semibold flex items-center gap-1">
                          <Building className="w-3 h-3 text-indigo-500" />
                          Company:
                        </span>
                        <span className="font-bold text-indigo-900 truncate max-w-[170px]">{acc.companyName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-neutral-500">A/C Number:</span>
                      <span className="font-mono font-bold text-indigo-950">{acc.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Account Type:</span>
                      <span className="font-medium text-neutral-800">{acc.accountType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Beneficiary:</span>
                      <span className="font-medium text-neutral-800 truncate max-w-[150px]">{acc.beneficiaryName}</span>
                    </div>
                    {acc.swiftCode && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">SWIFT:</span>
                        <span className="font-mono font-semibold text-neutral-800">{acc.swiftCode}</span>
                      </div>
                    )}
                    {acc.routingNumber && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Routing:</span>
                        <span className="font-mono font-semibold text-neutral-800">{acc.routingNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 mt-3">
                  <button
                    onClick={() => {
                      setEditingAccount(acc);
                      setAccountFormData({ ...acc });
                      setIsAccountModalOpen(true);
                    }}
                    className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm(`Delete bank account ${acc.accountNumber}?`)) return;
                      try {
                        await deleteDoc(doc(db, 'bank_accounts', acc.id));
                        showToast('Bank account deleted', 'success');
                      } catch (err: any) {
                        showToast('Failed to delete account: ' + err.message, 'error');
                      }
                    }}
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {filteredAccounts.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-neutral-300">
                <CreditCard className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-700">No bank accounts found</p>
                <p className="text-xs text-neutral-400 mt-0.5">Add export/foreign currency bank accounts to show in Proforma Invoices.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2: Bank Directory Master */}
      {activeSubTab === 'banks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search banks by name, SWIFT, branch..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <span className="text-xs text-neutral-500 font-medium">
              Showing {filteredBanks.length} of {banks.length} Banks
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-700 uppercase font-bold text-[10px] border-b border-neutral-200">
                <tr>
                  <th className="p-3.5">Bank Name & Branch</th>
                  <th className="p-3.5">SWIFT Code</th>
                  <th className="p-3.5">Routing Number</th>
                  <th className="p-3.5">Country</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredBanks.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50/70">
                    <td className="p-3.5 font-bold text-neutral-900">
                      <div>{b.bankName}</div>
                      {b.branchName && <div className="text-[11px] font-normal text-neutral-500">{b.branchName}</div>}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-indigo-900">{b.swiftCode || '—'}</td>
                    <td className="p-3.5 font-mono text-neutral-700">{b.routingNumber || '—'}</td>
                    <td className="p-3.5 text-neutral-700">{b.country || 'Bangladesh'}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingBank(b);
                            setBankFormData({ ...b });
                            setIsBankModalOpen(true);
                          }}
                          className="p-1 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 rounded"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete bank '${b.bankName}'?`)) return;
                            try {
                              await deleteDoc(doc(db, 'bank_masters', b.id));
                              showToast('Bank deleted', 'success');
                            } catch (err: any) {
                              showToast('Failed to delete bank: ' + err.message, 'error');
                            }
                          }}
                          className="p-1 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredBanks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-neutral-400">
                      No banks found. Click "Add Bank" to register a new bank.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 3: PI Rules & Master Setup */}
      {activeSubTab === 'pi-setup' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs max-w-4xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Proforma Invoice (PI) Master Setup & Rules</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Configure numbering sequences, source validations, value matching rules, and approval workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-neutral-200">
            {/* Numbering Config */}
            <div className="space-y-4 bg-neutral-50/70 p-4 rounded-xl border border-neutral-200">
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-indigo-600" />
                PI Numbering Sequence
              </h4>
              
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">PI Number Prefix</label>
                <input
                  type="text"
                  value={setupData.prefix || 'PI-'}
                  onChange={(e) => setSetupData({ ...setupData, prefix: e.target.value })}
                  placeholder="e.g. PI-, EST-PI-"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Starting Sequence Number</label>
                <input
                  type="number"
                  min="1"
                  value={setupData.startingNumber || 1}
                  onChange={(e) => setSetupData({ ...setupData, startingNumber: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Number Generation Style</label>
                <select
                  value={setupData.numberFormat || 'financial_year'}
                  onChange={(e) => setSetupData({ ...setupData, numberFormat: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="financial_year">Year Wise (e.g. PI-2026-000001)</option>
                  <option value="continuous">Continuous (e.g. PI-000001)</option>
                </select>
              </div>
            </div>

            {/* Validation & Matching Rules */}
            <div className="space-y-4 bg-neutral-50/70 p-4 rounded-xl border border-neutral-200">
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Value Validation & Matching Controls
              </h4>

              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setupData.isBillValueMatchingMandatory ?? true}
                    onChange={(e) => setSetupData({ ...setupData, isBillValueMatchingMandatory: e.target.checked })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-neutral-900 block">Bill Based Value Matching Mandatory</span>
                    <span className="text-[11px] text-neutral-500">
                      Enforces PI Total Value = Bill Total Value. Confirm/Approve is blocked on mismatch.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setupData.isWoValueMatchingMandatory ?? true}
                    onChange={(e) => setSetupData({ ...setupData, isWoValueMatchingMandatory: e.target.checked })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-neutral-900 block">Work Order / Booking Matching Mandatory</span>
                    <span className="text-[11px] text-neutral-500">
                      Enforces PI Total Value = Master Work Order Value.
                    </span>
                  </div>
                </label>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                    Value Tolerance Limit (Default 0.00)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={setupData.valueTolerance ?? 0.00}
                    onChange={(e) => setSetupData({ ...setupData, valueTolerance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Allowable difference between Master Value and PI Items Total. Default is 0.00 (Zero Tolerance).
                  </p>
                </div>
              </div>
            </div>

            {/* Approval Workflow Config */}
            <div className="md:col-span-2 space-y-4 bg-indigo-50/40 p-4 rounded-xl border border-indigo-200">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                Commercial Approval Workflow
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setupData.isApprovalRequired ?? true}
                    onChange={(e) => setSetupData({ ...setupData, isApprovalRequired: e.target.checked })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-neutral-900 block">Enable Approval Workflow Stage</span>
                    <span className="text-[11px] text-neutral-500">
                      PI moves from Draft → Pending Approval → Approved → Confirmed.
                    </span>
                  </div>
                </label>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Authorized Approver Role</label>
                  <input
                    type="text"
                    value={setupData.approverRole || 'Commercial Manager / Admin'}
                    onChange={(e) => setSetupData({ ...setupData, approverRole: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-200 flex justify-end">
            <button
              onClick={handleSavePISetup}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save PI Setup & Rules</span>
            </button>
          </div>
        </div>
      )}

      {/* Bank Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-neutral-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-sm text-neutral-900">
                {editingBank ? 'Edit Bank' : 'Add Bank to Directory'}
              </h3>
              <button onClick={() => setIsBankModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eastern Bank PLC, HSBC Bank, Standard Chartered"
                  value={bankFormData.bankName || ''}
                  onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Principal Branch, Dhaka"
                    value={bankFormData.branchName || ''}
                    onChange={(e) => setBankFormData({ ...bankFormData, branchName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">SWIFT Code</label>
                  <input
                    type="text"
                    placeholder="e.g. EBLDBDDHA"
                    value={bankFormData.swiftCode || ''}
                    onChange={(e) => setBankFormData({ ...bankFormData, swiftCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Routing Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 090270000"
                    value={bankFormData.routingNumber || ''}
                    onChange={(e) => setBankFormData({ ...bankFormData, routingNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Country</label>
                  <input
                    type="text"
                    value={bankFormData.country || 'Bangladesh'}
                    onChange={(e) => setBankFormData({ ...bankFormData, country: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {editingBank ? 'Update Bank' : 'Save Bank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 border border-neutral-200 animate-in fade-in zoom-in duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-sm text-neutral-900">
                {editingAccount ? 'Edit Bank Account' : 'Register New Bank Account'}
              </h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3.5">
              {/* Linked Company Master */}
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <label className="text-[11px] font-bold text-indigo-900 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-600" />
                    Company Master (Exporter / Beneficiary Profile)
                  </span>
                  <span className="text-[10px] text-indigo-500 font-normal">Auto-fills Beneficiary & Address</span>
                </label>
                <select
                  value={accountFormData.companyId || ''}
                  onChange={(e) => handleSelectCompany(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-indigo-200 bg-white rounded-lg font-bold text-neutral-800 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Select Company (or Default: ES TRIMS LIMITED) --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} {c.binNumber ? `(BIN: ${c.binNumber})` : ''} {c.isDefault ? '★ Default' : ''}
                    </option>
                  ))}
                </select>
                {accountFormData.companyName && (
                  <div className="text-[10px] text-indigo-700 mt-1 font-medium">
                    Linked to: <span className="font-bold">{accountFormData.companyName}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    list="bank-names-list"
                    placeholder="Select or enter bank"
                    value={accountFormData.bankName || ''}
                    onChange={(e) => {
                      const bName = e.target.value;
                      const matched = banks.find(b => b.bankName.toLowerCase() === bName.toLowerCase());
                      setAccountFormData({
                        ...accountFormData,
                        bankName: bName,
                        bankId: matched?.id || '',
                        branch: matched?.branchName || accountFormData.branch,
                        swiftCode: matched?.swiftCode || accountFormData.swiftCode,
                        routingNumber: matched?.routingNumber || accountFormData.routingNumber
                      });
                    }}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                  <datalist id="bank-names-list">
                    {banks.map(b => (
                      <option key={b.id} value={b.bankName} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Principal Branch, Dhaka"
                    value={accountFormData.branch || ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, branch: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1041060000000"
                    value={accountFormData.accountNumber || ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono font-bold focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Currency</label>
                  <select
                    value={accountFormData.currency || 'USD'}
                    onChange={(e) => setAccountFormData({ ...accountFormData, currency: e.target.value as CurrencyCode })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-bold focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="BDT">BDT (৳)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Account Type</label>
                  <select
                    value={accountFormData.accountType || 'Export'}
                    onChange={(e) => setAccountFormData({ ...accountFormData, accountType: e.target.value as BankAccountType })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Export">Export Account</option>
                    <option value="Foreign Currency">Foreign Currency (FC)</option>
                    <option value="Current">Current Account (CD)</option>
                    <option value="Savings">Savings Account (SB)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Beneficiary Name *</label>
                  <input
                    type="text"
                    required
                    value={accountFormData.beneficiaryName || 'ES TRIMS LIMITED'}
                    onChange={(e) => setAccountFormData({ ...accountFormData, beneficiaryName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">SWIFT Code</label>
                  <input
                    type="text"
                    placeholder="e.g. EBLDBDDHA"
                    value={accountFormData.swiftCode || ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, swiftCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">Routing Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 090270000"
                    value={accountFormData.routingNumber || ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, routingNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">IBAN (if applicable)</label>
                <input
                  type="text"
                  placeholder="Optional IBAN number"
                  value={accountFormData.iban || ''}
                  onChange={(e) => setAccountFormData({ ...accountFormData, iban: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Beneficiary Address</label>
                <input
                  type="text"
                  value={accountFormData.accountAddress || 'Plot # 122-124, Adamjee EPZ, Siddhirganj, Narayanganj, Bangladesh'}
                  onChange={(e) => setAccountFormData({ ...accountFormData, accountAddress: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accountFormData.isDefault || false}
                    onChange={(e) => setAccountFormData({ ...accountFormData, isDefault: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-neutral-800">Set as Default Account</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accountFormData.isActive ?? true}
                    onChange={(e) => setAccountFormData({ ...accountFormData, isActive: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-neutral-800">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {editingAccount ? 'Update Account' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
