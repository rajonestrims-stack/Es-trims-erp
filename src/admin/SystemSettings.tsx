import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Building2, 
  ShieldCheck, 
  Lock, 
  Save, 
  RefreshCw 
} from 'lucide-react';
import { SystemSettingsModel, RoleModel } from './adminTypes';
import { db } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

interface SystemSettingsProps {
  settings: SystemSettingsModel | null;
  roles: RoleModel[];
  businessId: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  settings,
  roles,
  businessId,
  showToast,
  onRefresh
}) => {
  const [companyName, setCompanyName] = useState('Dynamic Textile & Apparel ERP');
  const [companyAddress, setCompanyAddress] = useState('Plot 45, Industrial Zone, Gazipur, Dhaka');
  const [companyPhone, setCompanyPhone] = useState('+880 2 9880011');
  const [companyEmail, setCompanyEmail] = useState('info@apparel-erp.com');
  const [taxId, setTaxId] = useState('BIN-001928374-01');
  const [currencySymbol, setCurrencySymbol] = useState('৳');
  const [requirePasswordComplexity, setRequirePasswordComplexity] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60);
  const [defaultRoleId, setDefaultRoleId] = useState('viewer');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || 'Dynamic Textile & Apparel ERP');
      setCompanyAddress(settings.companyAddress || '');
      setCompanyPhone(settings.companyPhone || '');
      setCompanyEmail(settings.companyEmail || '');
      setTaxId(settings.taxId || '');
      setCurrencySymbol(settings.currencySymbol || '৳');
      setRequirePasswordComplexity(!!settings.requirePasswordComplexity);
      setSessionTimeoutMinutes(settings.sessionTimeoutMinutes || 60);
      setDefaultRoleId(settings.defaultRoleId || 'viewer');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, 'system_settings', businessId || 'default');
      await setDoc(docRef, {
        businessId: businessId || 'default',
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        companyPhone: companyPhone.trim(),
        companyEmail: companyEmail.trim(),
        taxId: taxId.trim(),
        currencySymbol: currencySymbol.trim(),
        requirePasswordComplexity,
        sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 60,
        defaultRoleId,
        updatedAt: Timestamp.now()
      }, { merge: true });

      showToast('System settings saved successfully.', 'success');
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast('Failed to save system settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-neutral-800" /> Enterprise System Settings
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure company branding, local tax BIN, default currency and security policies.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving Settings...' : 'Save Settings'}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Company Identity */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <h3 className="font-black text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" /> Company Identity & Localization
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Tax BIN / VAT ID</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-mono text-neutral-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Contact Phone</label>
              <input
                type="text"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Contact Email</label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Base Currency Symbol</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-bold text-center text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Company Address</label>
            <textarea
              rows={2}
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full p-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Security Policies */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <h3 className="font-black text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-600" /> Security & Session Policies
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Inactivity Session Timeout (Minutes)</label>
              <input
                type="number"
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 font-bold outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Default Registration Role</label>
              <select
                value={defaultRoleId}
                onChange={(e) => setDefaultRoleId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-bold outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="executive">Executive</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.roleName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <div>
              <p className="font-extrabold text-neutral-900">Enforce Password Complexity</p>
              <p className="text-xs text-neutral-500">Require minimum 6 chars, numbers & special characters for all users</p>
            </div>
            <input
              type="checkbox"
              checked={requirePasswordComplexity}
              onChange={(e) => setRequirePasswordComplexity(e.target.checked)}
              className="w-5 h-5 rounded text-purple-600 cursor-pointer"
            />
          </div>
        </div>
      </form>
    </div>
  );
};
