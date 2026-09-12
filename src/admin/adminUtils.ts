import { PageActionPermission, PermissionMatrix, RoleModel, UserAccountModel } from './adminTypes';
import { ERP_PAGE_REGISTRY } from './pageRegistry';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export function getDefaultPermission(isFull: boolean = false): PageActionPermission {
  return {
    view: isFull,
    create: isFull,
    edit: isFull,
    delete: isFull,
    print: isFull,
    export: isFull
  };
}

export function buildFullPermissionMatrix(isSuperAdmin: boolean = false): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  ERP_PAGE_REGISTRY.forEach(p => {
    matrix[p.id] = getDefaultPermission(isSuperAdmin);
  });
  return matrix;
}

export function resolveUserPermissions(
  user: UserAccountModel | null | undefined,
  role: RoleModel | null | undefined,
  userEmail?: string
): PermissionMatrix {
  // Super Admin / System Owner Check
  const email = (userEmail || user?.email || '').toLowerCase();
  const isSuper = email === 'rajonpaul300@gmail.com' ||
                  email === 'esstore@gmail.com' ||
                  email === 'rajon.estrims@gmail.com' ||
                  user?.roleName?.toLowerCase() === 'super admin' ||
                  role?.roleName?.toLowerCase() === 'super admin' ||
                  user?.roleId === 'super-admin';

  if (isSuper) {
    return buildFullPermissionMatrix(true);
  }

  const baseMatrix = role?.permissions || {};
  const customMatrix = user?.customPermissions || {};

  const finalMatrix: PermissionMatrix = {};

  ERP_PAGE_REGISTRY.forEach(p => {
    const rolePerm = baseMatrix[p.id] || getDefaultPermission(false);
    const customPerm = customMatrix[p.id];

    if (customPerm) {
      finalMatrix[p.id] = { ...customPerm };
    } else {
      finalMatrix[p.id] = { ...rolePerm };
    }
  });

  return finalMatrix;
}

export function isUserSuperAdmin(userOrEmail?: any): boolean {
  if (!userOrEmail) return false;
  const email = (typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email || '').toLowerCase().replace(/\s+/g, '');
  const superEmails = ['rajonpaul300@gmail.com', 'estore@gmail.com', 'esstore@gmail.com', 'rajon.estrims@gmail.com'];
  if (superEmails.includes(email)) return true;
  const role = (typeof userOrEmail === 'object' ? (userOrEmail?.role || userOrEmail?.roleName || userOrEmail?.roleId || '') : '').toLowerCase().replace(/[-_ ]/g, '');
  return role === 'superadmin' || role === 'systemowner';
}

export function canUserAccessPage(
  user: any,
  pageId: string,
  roles?: any[]
): boolean {
  if (isUserSuperAdmin(user)) return true;
  if (!user) return false;
  return checkActionPermission(user, pageId, 'view', roles);
}

export function checkActionPermission(
  user: any,
  pageId: string,
  action: 'view' | 'create' | 'edit' | 'delete' | 'print' | 'export',
  roles?: any[]
): boolean {
  if (isUserSuperAdmin(user)) return true;
  if (!user) return false;

  // 1. Check user-level custom permissions
  const customPerms = user.customPermissions || {};
  if (customPerms[pageId] && typeof customPerms[pageId][action] === 'boolean') {
    return customPerms[pageId][action];
  }

  // Check exact synonyms/alternative key aliases
  const aliasMap: Record<string, string[]> = {
    'dashboard-sales': ['sales-dashboard'],
    'sales-dashboard': ['dashboard-sales'],
    'dashboard-production': ['production-dashboard'],
    'production-dashboard': ['dashboard-production'],
    'dashboard-inventory': ['inventory-dashboard'],
    'inventory-dashboard': ['dashboard-inventory'],
    'dashboard-accounts': ['accounts-dashboard'],
    'accounts-dashboard': ['dashboard-accounts'],
    'dashboard-executive': ['dashboard'],
    'dashboard': ['dashboard-executive'],
    'purchases': ['procurement-po'],
    'procurement-po': ['purchases'],
    'procurement-requisition': ['requisition'],
    'requisition': ['procurement-requisition'],
    'suppliers': ['procurement-suppliers'],
    'procurement-suppliers': ['suppliers'],
    'procurement-mrr': ['mrr'],
    'mrr': ['procurement-mrr'],
    'sales-create-order': ['sales-order-entry'],
    'sales-order-entry': ['sales-create-order'],
    'sales-price-master': ['price-master', 'customer-price-master', 'sales-price', 'master-setup'],
    'price-master': ['sales-price-master', 'customer-price-master'],
    'customer-price-master': ['sales-price-master', 'price-master'],
    'subcontract-price-master': ['supplier-price-master', 'subcontract-price', 'subcontract'],
    'supplier-price-master': ['subcontract-price-master', 'subcontract'],
    'sales-company-master': ['company-master'],
    'company-master': ['sales-company-master'],
    'sales-bank-master': ['commercial-bank-master', 'bank-master'],
    'commercial-bank-master': ['sales-bank-master', 'bank-master'],
    'bank-master': ['sales-bank-master', 'commercial-bank-master'],
    'commercial-pi': ['commercial-pi-list', 'commercial-pi-create', 'commercial-pi-bill', 'commercial-pi-wo', 'commercial-documents', 'commercial-pi-approvals', 'commercial'],
    'commercial-pi-list': ['commercial-pi', 'commercial'],
    'commercial-pi-create': ['commercial-pi', 'commercial-pi-bill', 'commercial'],
    'commercial-pi-bill': ['commercial-pi', 'commercial-pi-create', 'commercial'],
    'commercial-pi-wo': ['commercial-pi', 'commercial'],
    'commercial-documents': ['commercial-pi', 'commercial'],
    'commercial-pi-approvals': ['commercial-pi', 'commercial'],
    'commercial': ['commercial-pi', 'commercial-pi-bill', 'commercial-pi-wo', 'commercial-documents', 'commercial-pi-list', 'commercial-pi-approvals'],
    'inventory-direct-sr': ['inventory-requisition', 'inventory'],
    'inventory-requisition': ['inventory-direct-sr', 'inventory'],
    'inventory-sr-issue': ['inventory'],
    'sales-rectify-requests': ['sales', 'sales-order-entry'],
    'sales-process-master': ['production-process-master', 'master-setup'],
    'production-process-master': ['sales-process-master', 'production', 'production-management'],
    'subcontract-subcategory-master': ['subcontract-category-master', 'subcontract-item-master', 'subcontract'],
    'accounts': ['accounts-finance', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'accounts-financial-reports', 'accounts-auto-posting'],
    'accounts-finance': ['accounts', 'accounts-coa', 'accounts-journal', 'accounts-cash-bank', 'accounts-receivable', 'accounts-payable', 'accounts-sales', 'accounts-fixed-assets', 'accounts-reports', 'accounts-financial-reports', 'accounts-auto-posting'],
    'accounts-auto-posting': ['accounts', 'accounts-finance'],
    'accounts-coa': ['accounts', 'accounts-finance'],
    'accounts-journal': ['accounts', 'accounts-finance'],
    'accounts-cash-bank': ['accounts', 'accounts-finance'],
    'accounts-receivable': ['accounts', 'accounts-finance'],
    'accounts-payable': ['accounts', 'accounts-finance'],
    'accounts-sales': ['accounts', 'accounts-finance'],
    'accounts-fixed-assets': ['accounts', 'accounts-finance'],
    'accounts-reports': ['accounts-financial-reports', 'accounts', 'accounts-finance'],
    'accounts-financial-reports': ['accounts-reports', 'accounts', 'accounts-finance'],
    'data-migration': ['sql-migration', 'admin-sql-migration'],
    'sql-migration': ['data-migration'],
    'finance-create-bill': ['finance-billing'],
    'finance-billing': ['finance-create-bill'],
    'supplier-ledger': ['finance-supplier-ledger'],
    'finance-supplier-ledger': ['supplier-ledger'],
    'supplier-payment': ['finance-supplier-payment'],
    'finance-supplier-payment': ['supplier-payment'],
    'supplier-report': ['finance-supplier-report'],
    'finance-supplier-report': ['supplier-report'],
    'bank-loans': ['finance-bank-loans'],
    'finance-bank-loans': ['bank-loans'],
    'loan-sanctions': ['finance-loan-sanctions'],
    'finance-loan-sanctions': ['loan-sanctions'],
    'loan-repayment': ['loan-repayments', 'finance-loan-repayment'],
    'loan-repayments': ['loan-repayment', 'finance-loan-repayment'],
    'finance-loan-repayment': ['loan-repayment', 'loan-repayments'],
    'production': ['production-management'],
    'production-management': ['production'],
    'despatch': ['despatch-management'],
    'despatch-management': ['despatch'],
  };

  const aliases = aliasMap[pageId] || [];
  for (const alias of aliases) {
    if (customPerms[alias] && typeof customPerms[alias][action] === 'boolean') {
      return customPerms[alias][action];
    }
  }

  // 2. Check Role permissions
  const userRoleKey = (user.role || user.roleId || user.roleName || '').toLowerCase();
  const matchedRole = roles?.find(r => 
    (r.id && r.id.toLowerCase() === userRoleKey) || 
    (r.name && r.name.toLowerCase() === userRoleKey) ||
    (r.roleName && r.roleName.toLowerCase() === userRoleKey)
  );

  if (matchedRole?.permissions) {
    if (matchedRole.permissions[pageId] && typeof matchedRole.permissions[pageId][action] === 'boolean') {
      return matchedRole.permissions[pageId][action];
    }
    for (const alias of aliases) {
      if (matchedRole.permissions[alias] && typeof matchedRole.permissions[alias][action] === 'boolean') {
        return matchedRole.permissions[alias][action];
      }
    }
  }

  const isSuperAdmin = isUserSuperAdmin(user);

  // 3. Fallback checks for legacy properties
  if (action === 'delete') {
    return isSuperAdmin;
  }
  if (action === 'edit') {
    return !!(user.canEdit ?? matchedRole?.canEdit ?? (userRoleKey === 'editor' || userRoleKey === 'admin'));
  }
  if (action === 'create') {
    return !!(user.canCreate ?? matchedRole?.canCreate ?? (userRoleKey === 'editor' || userRoleKey === 'admin'));
  }
  if (action === 'view') {
    const allowed = user.allowedPages || matchedRole?.allowedPages;
    if (Array.isArray(allowed) && allowed.length > 0) {
      return allowed.includes(pageId) || aliases.some(a => allowed.includes(a));
    }
    if (matchedRole?.permissions && Object.keys(matchedRole.permissions).length > 0) {
      return false;
    }
    if (user.customPermissions && Object.keys(user.customPermissions).length > 0) {
      return false;
    }
    return isSuperAdmin || userRoleKey === 'admin' || userRoleKey === 'super admin' || userRoleKey === 'superadmin';
  }

  return false;
}

export async function logAuditEvent(params: {
  businessId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  module: string;
  page: string;
  action: 'Login' | 'Logout' | 'Create' | 'Edit' | 'Delete' | 'Approve' | 'Reject' | 'Permission Change' | 'Role Change';
  recordId?: string;
  oldValue?: string;
  newValue?: string;
}): Promise<void> {
  try {
    const payload = {
      ...params,
      timestamp: Timestamp.now(),
      ipAddress: '127.0.0.1 (Web)',
      device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser'
    };
    await addDoc(collection(db, 'audit_logs'), payload);
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}
