import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Plus, Edit, Trash2, CheckCircle2, ShieldCheck, 
  Search, X, Check, MapPin, Phone, Mail, Globe, FileText, 
  CreditCard, Award, Star, Eye, Printer, Download, Sparkles, Sliders,
  Building
} from 'lucide-react';
import { CompanyMaster, BankAccountMaster, UserProfile } from '../../types';
import { addDoc, collection, doc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';

interface CompanyMasterViewProps {
  companies?: CompanyMaster[];
  bankAccounts?: BankAccountMaster[];
  businessId?: string;
  userEmail?: string;
  userProfile?: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

export const CompanyMasterView: React.FC<CompanyMasterViewProps> = ({
  companies: propCompanies,
  bankAccounts: propBankAccounts,
  businessId = 'default',
  userEmail,
  userProfile,
  showToast,
  isAdmin = true
}) => {
  const [internalCompanies, setInternalCompanies] = useState<CompanyMaster[]>([]);
  const [internalBankAccounts, setInternalBankAccounts] = useState<BankAccountMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Firestore snapshot listener for company masters
  useEffect(() => {
    if (propCompanies && propCompanies.length > 0) {
      setIsLoading(false);
      return;
    }
    const unsub = onSnapshot(collection(db, 'company_masters'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyMaster));
      setInternalCompanies(list);
      setIsLoading(false);
    }, (err) => {
      console.warn('company_masters listener notice:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [propCompanies, businessId]);

  // Firestore snapshot listener for bank accounts
  useEffect(() => {
    if (propBankAccounts && propBankAccounts.length > 0) return;
    const unsub = onSnapshot(collection(db, 'bank_accounts'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccountMaster));
      setInternalBankAccounts(list);
    });
    return () => unsub();
  }, [propBankAccounts]);

  const companies = (propCompanies && propCompanies.length > 0) ? propCompanies : internalCompanies;
  const bankAccounts = (propBankAccounts && propBankAccounts.length > 0) ? propBankAccounts : internalBankAccounts;
  const effectiveUserEmail = userEmail || userProfile?.email || 'system';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyMaster | null>(null);
  const [previewCompany, setPreviewCompany] = useState<CompanyMaster | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<CompanyMaster>>({
    companyName: '',
    companyCode: '',
    legalType: '100% Export Oriented Garment Trims Unit',
    address: '',
    factoryAddress: '',
    phone: '',
    mobile: '',
    email: '',
    website: '',
    binNumber: '',
    tinNumber: '',
    tradeLicenseNo: '',
    ircNumber: '',
    ercNumber: '',
    epzRegNo: '',
    authorizedSignatoryName: '',
    authorizedSignatoryDesignation: 'Authorized Signatory',
    defaultBankAccountId: '',
    tagline: 'A Quality Manufacturer of Garments Accessories & Packaging',
    isDefault: false,
    status: 'active'
  });

  // Filtered companies
  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.companyCode || '').toLowerCase().includes(q) ||
      (c.binNumber || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.factoryAddress || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingCompany(null);
    setFormData({
      companyName: '',
      companyCode: '',
      legalType: '100% Export Oriented Garment Trims Unit',
      address: '',
      factoryAddress: '',
      phone: '',
      mobile: '',
      email: '',
      website: '',
      binNumber: '',
      tinNumber: '',
      tradeLicenseNo: '',
      ircNumber: '',
      ercNumber: '',
      epzRegNo: '',
      authorizedSignatoryName: '',
      authorizedSignatoryDesignation: 'Authorized Signatory',
      defaultBankAccountId: bankAccounts.find(a => a.isDefault)?.id || '',
      tagline: 'A Quality Manufacturer of Garments Accessories & Packaging',
      isDefault: companies.length === 0,
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (comp: CompanyMaster) => {
    setEditingCompany(comp);
    setFormData({
      companyName: comp.companyName || '',
      companyCode: comp.companyCode || '',
      legalType: comp.legalType || '100% Export Oriented Garment Trims Unit',
      address: comp.address || '',
      factoryAddress: comp.factoryAddress || '',
      phone: comp.phone || '',
      mobile: comp.mobile || '',
      email: comp.email || '',
      website: comp.website || '',
      binNumber: comp.binNumber || '',
      tinNumber: comp.tinNumber || '',
      tradeLicenseNo: comp.tradeLicenseNo || '',
      ircNumber: comp.ircNumber || '',
      ercNumber: comp.ercNumber || '',
      epzRegNo: comp.epzRegNo || '',
      authorizedSignatoryName: comp.authorizedSignatoryName || '',
      authorizedSignatoryDesignation: comp.authorizedSignatoryDesignation || 'Authorized Signatory',
      defaultBankAccountId: comp.defaultBankAccountId || '',
      tagline: comp.tagline || '',
      isDefault: !!comp.isDefault,
      status: comp.status || 'active'
    });
    setIsModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName?.trim()) {
      showToast('Company Name is required', 'error');
      return;
    }
    if (!formData.address?.trim()) {
      showToast('Registered / Head Office Address is required', 'error');
      return;
    }

    try {
      // If setting as default, unset existing defaults first
      if (formData.isDefault) {
        for (const c of companies) {
          if (c.isDefault && c.id !== editingCompany?.id) {
            await updateDoc(doc(db, 'company_masters', c.id), { isDefault: false });
          }
        }
      }

      if (editingCompany) {
        await updateDoc(doc(db, 'company_masters', editingCompany.id), {
          ...formData,
          companyName: formData.companyName.trim(),
          updatedAt: new Date().toISOString(),
          updatedBy: effectiveUserEmail
        });
        showToast(`Company '${formData.companyName}' updated successfully`, 'success');
      } else {
        await addDoc(collection(db, 'company_masters'), {
          ...formData,
          companyName: formData.companyName.trim(),
          businessId,
          createdAt: new Date().toISOString(),
          createdBy: effectiveUserEmail,
          updatedAt: new Date().toISOString(),
          updatedBy: effectiveUserEmail
        });
        showToast(`Company '${formData.companyName}' created successfully`, 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving company:', err);
      handleFirestoreError(err, OperationType.WRITE, 'company_masters');
      showToast('Failed to save company profile', 'error');
    }
  };

  const handleSetDefault = async (company: CompanyMaster) => {
    try {
      for (const c of companies) {
        if (c.id === company.id) {
          await updateDoc(doc(db, 'company_masters', c.id), { isDefault: true });
        } else if (c.isDefault) {
          await updateDoc(doc(db, 'company_masters', c.id), { isDefault: false });
        }
      }
      showToast(`'${company.companyName}' set as default company`, 'success');
    } catch (err) {
      console.error('Error setting default company:', err);
      showToast('Failed to set default company', 'error');
    }
  };

  const handleDelete = async (comp: CompanyMaster) => {
    if (companies.length <= 1) {
      showToast('Cannot delete the primary company profile', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete company profile '${comp.companyName}'?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'company_masters', comp.id));
      showToast(`Company '${comp.companyName}' deleted`, 'info');
    } catch (err) {
      console.error('Error deleting company:', err);
      showToast('Failed to delete company profile', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Overview Banner */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-600/10 text-purple-700 flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
              Company Master & Profiles
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 border border-purple-200">
                {companies.length} Registered
              </span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Create and manage corporate entities, factory locations, BIN/TIN, and Proforma Invoice (PI) letterhead identities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Company</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, BIN, code, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'all' ? 'bg-white text-neutral-900 font-bold shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All ({companies.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'active' ? 'bg-white text-emerald-700 font-bold shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Active ({companies.filter(c => c.status === 'active').length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'inactive' ? 'bg-white text-neutral-700 font-bold shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Inactive ({companies.filter(c => c.status === 'inactive').length})
            </button>
          </div>
        </div>
      </div>

      {/* Companies Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-neutral-900">No company profiles found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery ? 'No company matched your search query.' : 'Create your company master profile to use across Proforma Invoices and export documents.'}
          </p>
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Company Profile</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCompanies.map((company) => {
            const linkedBank = bankAccounts.find(b => b.id === company.defaultBankAccountId);

            return (
              <div 
                key={company.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  company.isDefault 
                    ? 'border-purple-300 ring-2 ring-purple-500/10 shadow-xs' 
                    : 'border-neutral-200'
                }`}
              >
                {/* Header Banner */}
                <div className="p-5 pb-4 border-b border-neutral-100 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      company.isDefault ? 'bg-purple-600 text-white shadow-xs' : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                    }`}>
                      {company.companyCode || company.companyName?.substring(0, 3).toUpperCase() || 'EST'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-neutral-900 text-sm">{company.companyName}</h3>
                        {company.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                            <Star className="w-3 h-3 fill-purple-700" /> Default PI Entity
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          company.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {company.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-700 font-semibold mt-0.5">{company.legalType || 'Export Oriented Unit'}</p>
                      {company.tagline && (
                        <p className="text-[11px] text-neutral-500 italic mt-0.5">"{company.tagline}"</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setPreviewCompany(company)}
                      title="Preview Document Letterhead"
                      className="p-1.5 text-neutral-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(company)}
                          title="Edit Company Profile"
                          className="p-1.5 text-neutral-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(company)}
                          title="Delete Company"
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 space-y-3.5 text-xs flex-1">
                  {/* Addresses */}
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2 text-neutral-700">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-neutral-900">Head / Reg Office: </span>
                        <span>{company.address}</span>
                      </div>
                    </div>
                    {company.factoryAddress && (
                      <div className="flex items-start gap-2 text-neutral-600 text-[11px] pl-5.5">
                        <span className="font-semibold text-neutral-800">Factory / Works: </span>
                        <span>{company.factoryAddress}</span>
                      </div>
                    )}
                  </div>

                  {/* Contacts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-100 text-neutral-600">
                    {company.phone && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{company.phone}</span>
                      </div>
                    )}
                    {company.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{company.email}</span>
                      </div>
                    )}
                    {company.website && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{company.website}</span>
                      </div>
                    )}
                    {company.authorizedSignatoryName && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Award className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="truncate font-medium text-neutral-800">{company.authorizedSignatoryName}</span>
                      </div>
                    )}
                  </div>

                  {/* Registrations & Tax Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100">
                    {company.binNumber && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-mono text-[10px] border border-neutral-200">
                        <strong className="text-neutral-500 font-sans">BIN: </strong>{company.binNumber}
                      </span>
                    )}
                    {company.tinNumber && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-mono text-[10px] border border-neutral-200">
                        <strong className="text-neutral-500 font-sans">TIN: </strong>{company.tinNumber}
                      </span>
                    )}
                    {company.ercNumber && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-mono text-[10px] border border-blue-200">
                        <strong className="text-blue-500 font-sans">ERC: </strong>{company.ercNumber}
                      </span>
                    )}
                    {company.ircNumber && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-mono text-[10px] border border-neutral-200">
                        <strong className="text-neutral-500 font-sans">IRC: </strong>{company.ircNumber}
                      </span>
                    )}
                    {company.epzRegNo && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-mono text-[10px] border border-purple-200">
                        <strong className="text-purple-500 font-sans">EPZ / Bond: </strong>{company.epzRegNo}
                      </span>
                    )}
                  </div>

                  {/* Default Linked Bank */}
                  {linkedBank && (
                    <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-purple-700" />
                        <div>
                          <span className="font-semibold text-neutral-900">{linkedBank.bankName}</span>
                          <span className="text-[10px] text-neutral-500 ml-1.5">({linkedBank.branch})</span>
                        </div>
                      </div>
                      <span className="font-mono text-purple-900 font-bold text-[11px]">{linkedBank.accountNumber}</span>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    {!company.isDefault && isAdmin && (
                      <button
                        onClick={() => handleSetDefault(company)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 px-2 py-1 rounded-md hover:bg-purple-100 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Set as Default for PI</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setPreviewCompany(company)}
                    className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1"
                  >
                    <span>View Letterhead</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-900">
                    {editingCompany ? 'Edit Company Profile' : 'Create Company Profile'}
                  </h3>
                  <p className="text-xs text-neutral-500">Configure company corporate and export documentation header</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCompany} className="overflow-y-auto p-6 space-y-5 flex-1 text-xs">
              {/* Section 1: Basic Identity */}
              <div>
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-purple-700">
                  <Building2 className="w-4 h-4" /> 1. Company Name & Legal Identity
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-neutral-700 font-semibold mb-1">Company Full Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ES TRIMS LIMITED"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Short Code</label>
                    <input
                      type="text"
                      placeholder="e.g. EST"
                      value={formData.companyCode}
                      onChange={(e) => setFormData({ ...formData, companyCode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 uppercase"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-neutral-700 font-semibold mb-1">Legal / Industry Category</label>
                    <input
                      type="text"
                      placeholder="e.g. 100% Export Oriented Garments Accessories & Packaging Manufacturer"
                      value={formData.legalType}
                      onChange={(e) => setFormData({ ...formData, legalType: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-neutral-700 font-semibold mb-1">Company Slogan / Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. Total Packaging & Trims Solutions"
                      value={formData.tagline}
                      onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Addresses & Location */}
              <div className="pt-3 border-t border-neutral-200">
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-purple-700">
                  <MapPin className="w-4 h-4" /> 2. Official Addresses
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Head Office / Registered Address <span className="text-rose-500">*</span></label>
                    <textarea
                      required
                      rows={2}
                      placeholder="e.g. Plot # 122-124, Adamjee EPZ, Siddhirganj, Narayanganj, Bangladesh"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Factory / Works Location</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Adamjee EPZ, Narayanganj, Bangladesh"
                      value={formData.factoryAddress}
                      onChange={(e) => setFormData({ ...formData, factoryAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Contact Channels */}
              <div className="pt-3 border-t border-neutral-200">
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-purple-700">
                  <Phone className="w-4 h-4" /> 3. Contact & Communication
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Phone / Telephone</label>
                    <input
                      type="text"
                      placeholder="e.g. +880-2-7691234"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Mobile / Hotline</label>
                    <input
                      type="text"
                      placeholder="e.g. +880-1711-000000"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Official Email</label>
                    <input
                      type="email"
                      placeholder="e.g. info@estrims.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Website URL</label>
                    <input
                      type="text"
                      placeholder="e.g. www.estrims.com"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Legal, Tax & Export Registrations */}
              <div className="pt-3 border-t border-neutral-200">
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-purple-700">
                  <FileText className="w-4 h-4" /> 4. Tax, Customs & Export Registrations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">BIN / VAT Registration (13-Digit)</label>
                    <input
                      type="text"
                      placeholder="e.g. 000123456-0203"
                      value={formData.binNumber}
                      onChange={(e) => setFormData({ ...formData, binNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">e-TIN Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 123456789012"
                      value={formData.tinNumber}
                      onChange={(e) => setFormData({ ...formData, tinNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Trade License No</label>
                    <input
                      type="text"
                      placeholder="e.g. TRAD/DNCC/12345/2026"
                      value={formData.tradeLicenseNo}
                      onChange={(e) => setFormData({ ...formData, tradeLicenseNo: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Export Reg. Certificate (ERC)</label>
                    <input
                      type="text"
                      placeholder="e.g. ERC-26001234"
                      value={formData.ercNumber}
                      onChange={(e) => setFormData({ ...formData, ercNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Import Reg. Certificate (IRC)</label>
                    <input
                      type="text"
                      placeholder="e.g. IRC-26005678"
                      value={formData.ircNumber}
                      onChange={(e) => setFormData({ ...formData, ircNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">EPZ / Bond Permission No</label>
                    <input
                      type="text"
                      placeholder="e.g. BEPZA/AD/2024/099"
                      value={formData.epzRegNo}
                      onChange={(e) => setFormData({ ...formData, epzRegNo: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Default Bank & Signatory */}
              <div className="pt-3 border-t border-neutral-200">
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-purple-700">
                  <Award className="w-4 h-4" /> 5. Signatory & Default Bank Linkage
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Authorized Signatory Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Md. Rajon Paul"
                      value={formData.authorizedSignatoryName}
                      onChange={(e) => setFormData({ ...formData, authorizedSignatoryName: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Signatory Title / Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Managing Director / Authorized Signatory"
                      value={formData.authorizedSignatoryDesignation}
                      onChange={(e) => setFormData({ ...formData, authorizedSignatoryDesignation: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Default Bank Account for PI</label>
                    <select
                      value={formData.defaultBankAccountId}
                      onChange={(e) => setFormData({ ...formData, defaultBankAccountId: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bankName} - {acc.accountNumber} ({acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Set as Default Checkbox */}
              <div className="pt-3 border-t border-neutral-200">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-neutral-300"
                  />
                  <div>
                    <span className="font-bold text-neutral-900 text-xs">Set as Primary / Default Company</span>
                    <p className="text-[11px] text-neutral-500">Automatically pre-select this company profile when creating new Proforma Invoices (PI).</p>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors"
                >
                  {editingCompany ? 'Save Changes' : 'Create Company Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LETTERHEAD PREVIEW MODAL */}
      {previewCompany && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-neutral-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm">Document Letterhead Preview</h3>
              </div>
              <button
                onClick={() => setPreviewCompany(null)}
                className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 bg-neutral-100 flex justify-center">
              <div className="bg-white p-8 rounded-xl shadow-md border border-neutral-300 w-full max-w-[550px] text-xs">
                {/* Header Mockup */}
                <div className="border-b-2 border-neutral-900 pb-4 mb-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-neutral-900 uppercase">
                      {previewCompany.companyName}
                    </h1>
                    {previewCompany.tagline && (
                      <p className="text-[10px] text-purple-800 font-semibold italic">{previewCompany.tagline}</p>
                    )}
                    <p className="text-[11px] text-neutral-700 font-medium mt-1">{previewCompany.address}</p>
                    {previewCompany.factoryAddress && (
                      <p className="text-[10px] text-neutral-500">Factory: {previewCompany.factoryAddress}</p>
                    )}
                    <p className="text-[10px] text-neutral-600 mt-1">
                      Tel: {previewCompany.phone || previewCompany.mobile || '+880-XXX-XXXXXX'} | Email: {previewCompany.email || 'info@estrims.com'}
                    </p>
                    {previewCompany.website && (
                      <p className="text-[10px] text-neutral-600">Web: {previewCompany.website}</p>
                    )}
                  </div>
                  <div className="sm:text-right shrink-0">
                    <div className="inline-block bg-neutral-900 text-white font-black px-3 py-1 rounded text-xs uppercase tracking-wider mb-1">
                      PROFORMA INVOICE
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">PI-2026-000001</div>
                  </div>
                </div>

                {/* Tax & Registration Footer Block */}
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 grid grid-cols-2 gap-2 text-[10px] text-neutral-700">
                  <div><strong>BIN (VAT): </strong>{previewCompany.binNumber || '000123456-0203'}</div>
                  <div><strong>e-TIN: </strong>{previewCompany.tinNumber || '123456789012'}</div>
                  <div><strong>ERC No: </strong>{previewCompany.ercNumber || 'ERC-2026001'}</div>
                  <div><strong>IRC No: </strong>{previewCompany.ircNumber || 'IRC-2026002'}</div>
                </div>

                <div className="mt-8 pt-4 border-t border-dashed border-neutral-300 flex justify-between items-end text-[10px] text-neutral-600">
                  <div>
                    <p className="font-semibold text-neutral-900">Beneficiary / Exporter</p>
                    <p>{previewCompany.companyName}</p>
                  </div>
                  <div className="text-right">
                    <div className="h-8 border-b border-neutral-400 w-32 mb-1"></div>
                    <p className="font-bold text-neutral-900">{previewCompany.authorizedSignatoryName || 'Authorized Signatory'}</p>
                    <p className="text-neutral-500">{previewCompany.authorizedSignatoryDesignation || 'Managing Director'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setPreviewCompany(null)}
                className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-neutral-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
