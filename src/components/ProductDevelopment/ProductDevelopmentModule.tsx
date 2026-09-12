import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Calculator, 
  Scissors, 
  History, 
  ChevronRight, 
  Layers, 
  Sparkles 
} from 'lucide-react';
import { ProductUPSCalculator } from './ProductUPSCalculator';
import { ProductCostingCalculator } from './ProductCostingCalculator';
import { DevelopmentHistory } from './DevelopmentHistory';
import { Item, PurchaseOrder, Transaction, UserProfile } from '../../types';

interface ProductDevelopmentModuleProps {
  items: Item[];
  purchaseOrders?: PurchaseOrder[];
  transactions?: Transaction[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialSubTab?: 'pd-product-master' | 'pd-ups-calculation' | 'pd-costing' | 'pd-history';
  onSubTabChange?: (subTab: string) => void;
  allowedPagesSet?: Set<string>;
  roles?: any[];
}

export const ProductDevelopmentModule: React.FC<ProductDevelopmentModuleProps> = ({
  items,
  purchaseOrders = [],
  transactions = [],
  userProfile,
  showToast,
  initialSubTab = 'pd-ups-calculation',
  onSubTabChange,
  allowedPagesSet,
  roles = []
}) => {
  const isSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com';

  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  // Submenu items
  const allSubMenuItems = [
    { id: 'pd-product-master', label: 'Product Master', icon: Package, checkIds: ['product-imposition', 'pd-product-master', 'product-development'] },
    { id: 'pd-ups-calculation', label: 'Product UPS Calculation', icon: Calculator, checkIds: ['product-ups', 'pd-ups-calculation', 'product-development'] },
    { id: 'pd-costing', label: 'Product Development / Costing', icon: Scissors, checkIds: ['product-costing', 'pd-costing', 'product-development'] },
    { id: 'pd-history', label: 'Development History', icon: History, checkIds: ['product-development-history', 'pd-history', 'product-development'] },
  ];

  const subMenuItems = allSubMenuItems.filter(item => item.checkIds.some(cid => isPagePermitted(cid)));

  const [activeSubTab, setActiveSubTab] = useState<string>(() => {
    if (subMenuItems.length > 0 && !subMenuItems.some(item => item.id === initialSubTab)) {
      return subMenuItems[0].id;
    }
    return initialSubTab;
  });

  const [editingCalcData, setEditingCalcData] = useState<any | null>(null);

  useEffect(() => {
    if (subMenuItems.length > 0 && !subMenuItems.some(item => item.id === initialSubTab)) {
      setActiveSubTab(subMenuItems[0].id);
    } else if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, subMenuItems.length]);

  const handleSubTabClick = (tabId: string) => {
    setActiveSubTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const handleLoadForEdit = (calcData: any) => {
    setEditingCalcData(calcData);
    handleSubTabClick('pd-ups-calculation');
    showToast(`Loaded calculation ${calcData.calculationNo} into UPS Calculator`, 'info');
  };

  // Breadcrumb Title mapping
  const subMenuTitles: Record<string, string> = {
    'pd-product-master': 'Product Master',
    'pd-ups-calculation': 'Product UPS Calculation',
    'pd-costing': 'Product Development / Costing',
    'pd-history': 'Development History',
  };

  return (
    <div className="space-y-6">
      {/* ERP Breadcrumb Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 px-5 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
          <span className="text-neutral-900 font-bold flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            Product Development
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
          <span className="text-indigo-600 font-bold">
            {subMenuTitles[activeSubTab] || 'Product UPS Calculation'}
          </span>
        </div>

        {/* Submenu Pills Navigation */}
        <div className="hidden sm:flex items-center gap-1 bg-neutral-100/80 p-1 rounded-xl">
          {subMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSubTabClick(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Submenu Tabs */}
      <div className="sm:hidden flex overflow-x-auto gap-2 pb-1 scrollbar-none">
        {subMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSubTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSubTabClick(item.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-neutral-700 border border-neutral-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* View Content Area - Opens only the active sub-page */}
      {activeSubTab === 'pd-ups-calculation' && (
        <ProductUPSCalculator
          items={items}
          purchaseOrders={purchaseOrders}
          transactions={transactions}
          userProfile={userProfile}
          showToast={showToast}
          initialData={editingCalcData}
          onSavedSuccess={() => setEditingCalcData(null)}
        />
      )}

      {activeSubTab === 'pd-history' && (
        <DevelopmentHistory
          userProfile={userProfile}
          showToast={showToast}
          onLoadCalculationForEdit={handleLoadForEdit}
        />
      )}

      {activeSubTab === 'pd-product-master' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-neutral-900">Product Master Catalog</h2>
            </div>
            <span className="text-xs text-neutral-500 font-medium">Total Products: {items.length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                <div className="font-bold text-neutral-900">{item.name}</div>
                <div className="text-xs text-neutral-500">Code/SKU: {item.sku}</div>
                <div className="text-xs text-neutral-500">Stock: {item.currentStock} {item.unit}</div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCalcData({
                      productId: item.id,
                      productName: item.name,
                      productCode: item.sku,
                      category: item.unit
                    });
                    handleSubTabClick('pd-ups-calculation');
                  }}
                  className="mt-2 w-full py-1.5 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Calculate UPS
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'pd-costing' && (
        <ProductCostingCalculator
          items={items}
          purchaseOrders={purchaseOrders}
          transactions={transactions}
          userProfile={userProfile}
          showToast={showToast}
          onSaveCosting={(savedRecord) => {
            showToast(`Saved Costing ${savedRecord.costingId}`, 'success');
          }}
        />
      )}
    </div>
  );
};
