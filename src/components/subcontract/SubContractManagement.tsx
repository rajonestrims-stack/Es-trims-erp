import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { 
  SubContractCategory, 
  SubContractSubCategory,
  SubContractItem, 
  SubContractPrice, 
  SubContractOrder, 
  SubContractPurchaseOrder, 
  SubContractIssue, 
  SubContractReceive, 
  Supplier, 
  UserProfile,
  RoleDefinition 
} from '../../types';

import { SubContractDashboard } from './SubContractDashboard';
import { SubContractCategoryMaster } from './SubContractCategoryMaster';
import { SubContractSubCategoryMaster } from './SubContractSubCategoryMaster';
import { SubContractItemMaster } from './SubContractItemMaster';
import { SubContractPriceMaster } from './SubContractPriceMaster';
import { SubContractPurchaseOrderView } from './SubContractPurchaseOrderView';
import { SubContractIssueDelivery } from './SubContractIssueDelivery';
import { SubContractReceiveComponent } from './SubContractReceive';
import { SubContractReports } from './SubContractReports';

import { 
  Layers, 
  FileText, 
  Tag, 
  FolderTree, 
  DollarSign, 
  ShoppingCart, 
  Truck, 
  CheckCircle2, 
  BarChart3,
  RefreshCw,
  FolderSync
} from 'lucide-react';

interface SubContractManagementProps {
  userProfile: UserProfile;
  suppliers: Supplier[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
  isEditor: boolean;
  initialSubTab?: string;
  allowedPagesSet?: Set<string>;
  roles?: RoleDefinition[];
}

export const SubContractManagement: React.FC<SubContractManagementProps> = ({
  userProfile,
  suppliers,
  showToast,
  isEditor,
  initialSubTab = 'dashboard',
  allowedPagesSet,
  roles = []
}) => {
  const isSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com';

  const isPagePermitted = (pageId: string) => {
    if (isSuperAdmin) return true;
    if (!allowedPagesSet) return true;
    return allowedPagesSet.has(pageId);
  };

  // Subcontract Nav Tabs configuration with permission check keys
  const ALL_SUB_TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers, checkIds: ['subcontract-dashboard', 'subcontract'] },
    { id: 'purchase_order', label: 'Sub Contract PO', icon: ShoppingCart, badgeColor: 'text-indigo-600', checkIds: ['subcontract-po', 'subcontract-dyeing', 'subcontract-woven', 'subcontract-embroidery', 'subcontract'] },
    { id: 'subcategory_master', label: 'Sub-Category Master', icon: FolderTree, badgeColor: 'text-purple-600', checkIds: ['subcontract-subcategory-master', 'subcontract-item-master', 'master-setup', 'subcontract'] },
    { id: 'category_master', label: 'Category Master', icon: FolderSync, checkIds: ['subcontract-category-master', 'master-setup', 'subcontract'] },
    { id: 'item_master', label: 'Item Master', icon: Tag, checkIds: ['subcontract-item-master', 'master-setup', 'subcontract'] },
    { id: 'price_master', label: 'Supplier Price Master', icon: DollarSign, badgeColor: 'text-emerald-600', checkIds: ['subcontract-price-master', 'master-setup', 'subcontract'] },
    { id: 'receive', label: 'Sub Contract Receive', icon: CheckCircle2, badgeColor: 'text-emerald-600', checkIds: ['subcontract-receive', 'subcontract'] },
    { id: 'issue_delivery', label: 'Issue / Delivery', icon: Truck, checkIds: ['subcontract-issue', 'subcontract'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, checkIds: ['subcontract-reports', 'reports', 'subcontract'] }
  ];

  const permittedTabs = ALL_SUB_TABS.filter(tab => tab.checkIds.some(cid => isPagePermitted(cid)));

  // Normalize legacy tab IDs to unified structure
  const normalizeTabId = (tab: string) => {
    if (
      tab === 'dyeing_order' || 
      tab === 'woven_order' || 
      tab === 'embroidery_order' || 
      tab === 'subcontract_order' || 
      tab === 'subcontract_purchase_order' ||
      tab === 'subcontract-po'
    ) {
      return 'purchase_order';
    }
    if (tab === 'subcontract-item-master' || tab === 'item_master') {
      return 'subcategory_master';
    }
    if (tab === 'subcontract-subcategory-master') {
      return 'subcategory_master';
    }
    if (tab === 'subcontract-price-master') {
      return 'price_master';
    }
    if (tab === 'subcontract-receive') {
      return 'receive';
    }
    if (tab === 'subcontract-reports') {
      return 'reports';
    }
    return tab;
  };

  const initialNormalized = normalizeTabId(initialSubTab);
  const [activeSubTab, setActiveSubTab] = useState<string>(() => {
    if (permittedTabs.length > 0 && !permittedTabs.some(t => t.id === initialNormalized)) {
      return permittedTabs[0].id;
    }
    return initialNormalized;
  });

  // Firestore Data Collections
  const [categories, setCategories] = useState<SubContractCategory[]>([]);
  const [subCategories, setSubCategories] = useState<SubContractSubCategory[]>([]);
  const [items, setItems] = useState<SubContractItem[]>([]);
  const [prices, setPrices] = useState<SubContractPrice[]>([]);
  const [orders, setOrders] = useState<SubContractOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<SubContractPurchaseOrder[]>([]);
  const [issues, setIssues] = useState<SubContractIssue[]>([]);
  const [receives, setReceives] = useState<SubContractReceive[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync initialSubTab when parent changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(normalizeTabId(initialSubTab));
    }
  }, [initialSubTab]);

  // Firestore Subscriptions
  useEffect(() => {
    try {
      const unsubCategories = onSnapshot(
        collection(db, 'subcontract_categories'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractCategory));
          setCategories(data.sort((a, b) => a.categoryName.localeCompare(b.categoryName)));
        },
        (err) => console.warn('Categories subscription warning:', err)
      );

      const unsubSubCategories = onSnapshot(
        collection(db, 'subcontract_subcategories'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractSubCategory));
          setSubCategories(data.sort((a, b) => a.subCategoryName.localeCompare(b.subCategoryName)));
        },
        (err) => console.warn('SubCategories subscription warning:', err)
      );

      const unsubItems = onSnapshot(
        collection(db, 'subcontract_items'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractItem));
          setItems(data.sort((a, b) => a.itemName.localeCompare(b.itemName)));
        },
        (err) => console.warn('Items subscription warning:', err)
      );

      const unsubPrices = onSnapshot(
        collection(db, 'subcontract_prices'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractPrice));
          setPrices(data);
        },
        (err) => console.warn('Prices subscription warning:', err)
      );

      const unsubOrders = onSnapshot(
        collection(db, 'subcontract_orders'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractOrder));
          setOrders(data.sort((a, b) => b.orderDate.localeCompare(a.orderDate)));
        },
        (err) => console.warn('Orders subscription warning:', err)
      );

      const unsubPOs = onSnapshot(
        collection(db, 'subcontract_pos'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractPurchaseOrder));
          setPurchaseOrders(data.sort((a, b) => b.poDate.localeCompare(a.poDate)));
        },
        (err) => console.warn('POs subscription warning:', err)
      );

      const unsubIssues = onSnapshot(
        collection(db, 'subcontract_issues'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractIssue));
          setIssues(data.sort((a, b) => b.issueDate.localeCompare(a.issueDate)));
        },
        (err) => console.warn('Issues subscription warning:', err)
      );

      const unsubReceives = onSnapshot(
        collection(db, 'subcontract_receives'),
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubContractReceive));
          setReceives(data.sort((a, b) => b.receiveDate.localeCompare(a.receiveDate)));
          setLoading(false);
        },
        (err) => {
          console.warn('Receives subscription warning:', err);
          setLoading(false);
        }
      );

      return () => {
        unsubCategories();
        unsubSubCategories();
        unsubItems();
        unsubPrices();
        unsubOrders();
        unsubPOs();
        unsubIssues();
        unsubReceives();
      };
    } catch (e) {
      console.error('Error setting up subscriptions:', e);
      setLoading(false);
    }
  }, []);

  // Subcontract categories and subcategories are managed explicitly by user input; no auto-seeding


  // Helper to remove undefined fields and redundant id before writing to Firestore
  const cleanPayload = (obj: any): Record<string, any> => {
    const cleaned: Record<string, any> = {};
    if (!obj || typeof obj !== 'object') return cleaned;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'id') continue;
      if (value !== undefined) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          cleaned[key] = cleanPayload(value);
        } else if (Array.isArray(value)) {
          cleaned[key] = value.map(item => (item !== null && typeof item === 'object') ? cleanPayload(item) : item);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  };

  // --- CRUD HANDLERS ---

  // 1. Categories
  const handleSaveCategory = async (catData: Partial<SubContractCategory>) => {
    try {
      const payload = cleanPayload(catData);
      if (catData.id) {
        const ref = doc(db, 'subcontract_categories', catData.id);
        await updateDoc(ref, {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'subcontract_categories'), {
          ...payload,
          businessId: userProfile?.businessId || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Error saving subcontract category:', err);
      handleFirestoreError(err, catData.id ? OperationType.UPDATE : OperationType.CREATE, 'subcontract_categories');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subcontract_categories', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `subcontract_categories/${id}`);
    }
  };

  // 2. Sub-Categories
  const handleSaveSubCategory = async (subCatData: Partial<SubContractSubCategory>) => {
    try {
      const payload = cleanPayload(subCatData);
      if (subCatData.id) {
        const ref = doc(db, 'subcontract_subcategories', subCatData.id);
        await updateDoc(ref, {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'subcontract_subcategories'), {
          ...payload,
          businessId: userProfile?.businessId || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Error saving subcontract subcategory:', err);
      handleFirestoreError(err, subCatData.id ? OperationType.UPDATE : OperationType.CREATE, 'subcontract_subcategories');
    }
  };

  const handleDeleteSubCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subcontract_subcategories', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `subcontract_subcategories/${id}`);
    }
  };

  // 3. Items
  const handleSaveItem = async (itemData: Partial<SubContractItem>) => {
    try {
      const payload = cleanPayload(itemData);
      if (itemData.id) {
        const ref = doc(db, 'subcontract_items', itemData.id);
        await updateDoc(ref, {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'subcontract_items'), {
          ...payload,
          businessId: userProfile?.businessId || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Error saving subcontract item:', err);
      handleFirestoreError(err, itemData.id ? OperationType.UPDATE : OperationType.CREATE, 'subcontract_items');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subcontract_items', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `subcontract_items/${id}`);
    }
  };

  // 4. Prices (Supplier + Sub-Category rates)
  const handleSavePrice = async (priceData: Partial<SubContractPrice>) => {
    try {
      const payload = cleanPayload(priceData);
      if (priceData.id) {
        const ref = doc(db, 'subcontract_prices', priceData.id);
        await updateDoc(ref, {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'subcontract_prices'), {
          ...payload,
          businessId: userProfile?.businessId || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Error saving subcontract price:', err);
      handleFirestoreError(err, priceData.id ? OperationType.UPDATE : OperationType.CREATE, 'subcontract_prices');
    }
  };

  const handleDeletePrice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subcontract_prices', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `subcontract_prices/${id}`);
    }
  };

  // 5. Purchase Orders
  const handleSavePO = async (poData: Partial<SubContractPurchaseOrder>) => {
    try {
      const payload = cleanPayload(poData);
      if (poData.id) {
        const ref = doc(db, 'subcontract_pos', poData.id);
        await updateDoc(ref, {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'subcontract_pos'), {
          ...payload,
          businessId: userProfile?.businessId || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Error saving subcontract PO:', err);
      handleFirestoreError(err, poData.id ? OperationType.UPDATE : OperationType.CREATE, 'subcontract_pos');
    }
  };

  const handleDeletePO = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subcontract_pos', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `subcontract_pos/${id}`);
    }
  };

  // 6. Issues / Delivery
  const handleSaveIssue = async (issueData: Partial<SubContractIssue>) => {
    try {
      const payload = cleanPayload(issueData);
      await addDoc(collection(db, 'subcontract_issues'), {
        ...payload,
        businessId: userProfile?.businessId || '',
        createdAt: new Date().toISOString()
      });

      if (issueData.orderId) {
        const targetOrder = orders.find(o => o.id === issueData.orderId);
        if (targetOrder) {
          const newIssued = (targetOrder.issuedQuantity || 0) + (issueData.issueQuantity || 0);
          const ref = doc(db, 'subcontract_orders', targetOrder.id);
          await updateDoc(ref, {
            issuedQuantity: newIssued,
            status: targetOrder.status === 'draft' || targetOrder.status === 'confirmed' ? 'issued' : targetOrder.status
          });
        }
      }
    } catch (err: any) {
      console.error('Error saving subcontract issue:', err);
      handleFirestoreError(err, OperationType.CREATE, 'subcontract_issues');
    }
  };

  const handleDeleteIssue = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subcontract_issues', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `subcontract_issues/${id}`);
    }
  };

  // 7. Receives (GRN)
  const handleSaveReceive = async (receiveData: Partial<SubContractReceive>) => {
    try {
      const payload = cleanPayload(receiveData);
      await addDoc(collection(db, 'subcontract_receives'), {
        ...payload,
        businessId: userProfile?.businessId || '',
        createdAt: new Date().toISOString()
      });

      // If linked to an order, update order receivedQuantity & balance
      if (receiveData.orderId) {
        const targetOrder = orders.find(o => o.id === receiveData.orderId);
        if (targetOrder) {
          const newReceived = (targetOrder.receivedQuantity || 0) + (receiveData.receivedQuantity || 0);
          const newBalance = Math.max(0, targetOrder.totalQuantity - newReceived);
          const isCompleted = newReceived >= targetOrder.totalQuantity;

          const ref = doc(db, 'subcontract_orders', targetOrder.id);
          await updateDoc(ref, {
            receivedQuantity: newReceived,
            balanceQuantity: newBalance,
            status: isCompleted ? 'completed' : 'partially_received'
          });
        }
      }
    } catch (err: any) {
      console.error('Error saving subcontract receive:', err);
      handleFirestoreError(err, OperationType.CREATE, 'subcontract_receives');
    }
  };

  const handleDeleteReceive = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subcontract_receives', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `subcontract_receives/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subcontract Horizontal Sub-Navigation */}
      <div className="bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm overflow-x-auto print:hidden">
        <div className="flex items-center gap-1.5 min-w-max">
          {permittedTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.badgeColor || 'text-neutral-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Sub Tab Views */}
      {activeSubTab === 'dashboard' && (
        <SubContractDashboard
          orders={orders}
          purchaseOrders={purchaseOrders}
          issues={issues}
          receives={receives}
          categories={categories}
          subCategories={subCategories}
          items={items}
          prices={prices}
          suppliers={suppliers}
          onNavigateTab={(tab) => setActiveSubTab(normalizeTabId(tab))}
          isEditor={isEditor}
          isTabPermitted={(tabId) => permittedTabs.some(t => t.id === normalizeTabId(tabId))}
        />
      )}

      {activeSubTab === 'purchase_order' && (
        <SubContractPurchaseOrderView
          purchaseOrders={purchaseOrders}
          orders={orders}
          categories={categories}
          subCategories={subCategories}
          items={items}
          prices={prices}
          suppliers={suppliers}
          userProfile={userProfile}
          showToast={showToast}
          onSavePO={handleSavePO}
          onDeletePO={handleDeletePO}
          onSaveReceive={handleSaveReceive}
          isEditor={isEditor}
        />
      )}

      {activeSubTab === 'subcategory_master' && (
        <SubContractSubCategoryMaster
          categories={categories}
          subCategories={subCategories}
          showToast={showToast}
          onSaveSubCategory={handleSaveSubCategory}
          onDeleteSubCategory={handleDeleteSubCategory}
          isEditor={isEditor}
        />
      )}

      {activeSubTab === 'category_master' && (
        <SubContractCategoryMaster
          categories={categories}
          itemsCount={items.reduce((acc, it) => {
            acc[it.categoryId] = (acc[it.categoryId] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)}
          showToast={showToast}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
          isEditor={isEditor}
        />
      )}

      {activeSubTab === 'item_master' && (
        <SubContractItemMaster
          items={items}
          categories={categories}
          suppliers={suppliers}
          showToast={showToast}
          onSaveItem={handleSaveItem}
          onDeleteItem={handleDeleteItem}
          isEditor={isEditor}
        />
      )}

      {activeSubTab === 'price_master' && (
        <SubContractPriceMaster
          prices={prices}
          categories={categories}
          subCategories={subCategories}
          items={items}
          suppliers={suppliers}
          userProfile={userProfile}
          showToast={showToast}
          onSavePrice={handleSavePrice}
          onDeletePrice={handleDeletePrice}
          isEditor={isEditor}
        />
      )}

      {activeSubTab === 'receive' && (
        <SubContractReceiveComponent
          receives={receives}
          orders={orders}
          items={items}
          prices={prices}
          suppliers={suppliers}
          userProfile={userProfile}
          showToast={showToast}
          onSaveReceive={handleSaveReceive}
          onDeleteReceive={handleDeleteReceive}
          isEditor={isEditor}
        />
      )}

      {activeSubTab === 'issue_delivery' && (
        <SubContractIssueDelivery
          issues={issues}
          orders={orders}
          items={items}
          suppliers={suppliers}
          userProfile={userProfile}
          showToast={showToast}
          onSaveIssue={handleSaveIssue}
          onDeleteIssue={handleDeleteIssue}
          isEditor={isEditor}
        />
      )}

      {activeSubTab === 'reports' && (
        <SubContractReports
          orders={orders}
          purchaseOrders={purchaseOrders}
          issues={issues}
          receives={receives}
          categories={categories}
          items={items}
          prices={prices}
          suppliers={suppliers}
          userProfile={userProfile}
          showToast={showToast}
        />
      )}
    </div>
  );
};
