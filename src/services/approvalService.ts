import { collection, doc, addDoc, updateDoc, setDoc, getDocs, getDoc, deleteField, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ApprovalRequest, UserProfile } from '../types';
import { ApprovalRuleModel, ApprovalLevelConfig } from '../admin/adminTypes';
import { isUserSuperAdmin } from '../admin/adminUtils';

export interface ApprovalCheckResult {
  required: boolean;
  isSuperAdmin?: boolean;
  rule?: ApprovalRuleModel;
  approverType?: 'user' | 'role';
  approverUid?: string;
  approverEmail?: string;
  approverName?: string;
  approverRole?: string;
  level?: number;
}

export interface ApproverUserOption {
  uid: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  department?: string;
}

/**
 * Fetches all active users from the system who can be designated as approval recipients.
 */
export async function fetchEligibleApproverUsers(businessId?: string): Promise<ApproverUserOption[]> {
  try {
    const qUsers = collection(db, 'users');
    const snap = await getDocs(qUsers);
    const options: ApproverUserOption[] = [];
    snap.forEach(d => {
      const data = d.data() as any;
      const uid = data.uid || d.id;
      const email = (data.email || '').trim().toLowerCase();
      const name = data.employeeName || data.displayName || data.name || data.username || email || 'User';
      const role = data.roleName || data.role || 'Member';
      if (email || uid) {
        options.push({
          uid,
          name,
          email,
          role,
          designation: data.designationName || data.designation || '',
          department: data.departmentName || data.department || ''
        });
      }
    });
    return options;
  } catch (err) {
    console.warn('Failed to fetch approver users:', err);
    return [];
  }
}

function normalizeKey(str: string): string {
  return (str || '').toLowerCase().trim().replace(/[-_ ]/g, '');
}

/**
 * Checks whether an ERP page requires approval before taking effect or posting to the General Ledger.
 */
export async function checkPageApprovalRule(
  pageId: string,
  businessId: string,
  userProfile?: UserProfile | any,
  amount?: number
): Promise<ApprovalCheckResult> {
  const isSuper = isUserSuperAdmin(userProfile);

  try {
    const q = query(
      collection(db, 'approval_rules')
    );
    const snap = await getDocs(q);
    const rules: ApprovalRuleModel[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRuleModel));

    const normPage = normalizeKey(pageId);

    // Matching against exact pageId, normalized id, or known ERP aliases
    const matchedRule = rules.find(r => {
      if (r.approvalRequired === false || r.status === 'inactive') return false;
      const rNorm = normalizeKey(r.pageId);
      
      if (r.pageId === pageId || rNorm === normPage) return true;

      // Price Master aliases
      if (['salespricemaster', 'pricemaster', 'customerpricemaster', 'subcontractpricemaster', 'supplierpricemaster'].includes(normPage) && ['salespricemaster', 'pricemaster', 'customerpricemaster', 'subcontractpricemaster', 'supplierpricemaster'].includes(rNorm)) return true;

      // Journal & Accounts aliases
      if (['accountsjournal', 'journal', 'journalentry'].includes(normPage) && ['accountsjournal', 'journal', 'journalentry'].includes(rNorm)) return true;
      if (['accountscashbank', 'cashbank', 'cashbook', 'bankbook'].includes(normPage) && ['accountscashbank', 'cashbank', 'cashbook', 'bankbook'].includes(rNorm)) return true;
      if (['accountsreceivable', 'receivable'].includes(normPage) && ['accountsreceivable', 'receivable'].includes(rNorm)) return true;
      if (['accountspayable', 'payable'].includes(normPage) && ['accountspayable', 'payable'].includes(rNorm)) return true;
      if (['accountssales', 'salesinvoicing'].includes(normPage) && ['accountssales', 'salesinvoicing'].includes(rNorm)) return true;
      if (['accountsfixedassets', 'fixedassets'].includes(normPage) && ['accountsfixedassets', 'fixedassets'].includes(rNorm)) return true;
      if (['bankloans', 'loansanctions', 'loanrepayment', 'loanvouchers'].includes(normPage) && ['bankloans', 'loansanctions', 'loanrepayment', 'loanvouchers'].includes(rNorm)) return true;
      
      // Procurement & Inventory aliases
      if (['purchases', 'procurementpo', 'purchaseorders', 'purchaseorder', 'po'].includes(normPage) && ['purchases', 'procurementpo', 'purchaseorders', 'purchaseorder', 'po'].includes(rNorm)) return true;
      if (['supplierpayment', 'supplierpayments', 'supplierledger'].includes(normPage) && ['supplierpayment', 'supplierpayments', 'supplierledger'].includes(rNorm)) return true;
      if (['procurementrequisition', 'inventoryrequisition', 'purchaserequisition', 'requisition', 'purchaserequisitions', 'requisitions', 'purchasereq'].includes(normPage) && ['procurementrequisition', 'inventoryrequisition', 'purchaserequisition', 'requisition', 'purchaserequisitions', 'requisitions', 'purchasereq'].includes(rNorm)) return true;

      // Sales & Commercial aliases
      if (['salesorderentry', 'salescreateorder', 'salesorder', 'salesorders', 'salesorderlist'].includes(normPage) && ['salesorderentry', 'salescreateorder', 'salesorder', 'salesorders', 'salesorderlist'].includes(rNorm)) return true;
      if (['proformainvoice', 'commercialpi', 'commercialpicreate', 'commercialpilist'].includes(normPage) && ['proformainvoice', 'commercialpi', 'commercialpicreate', 'commercialpilist'].includes(rNorm)) return true;
      if (['financebilling', 'billing'].includes(normPage) && ['financebilling', 'billing'].includes(rNorm)) return true;

      // Subcontract & Despatch aliases
      if (['subcontractpo', 'subcontractissue', 'subcontractreceive'].includes(normPage) && ['subcontractpo', 'subcontractissue', 'subcontractreceive'].includes(rNorm)) return true;
      if (['despatchchallan', 'despatchgatepass', 'despatchcorrection'].includes(normPage) && ['despatchchallan', 'despatchgatepass', 'despatchcorrection'].includes(rNorm)) return true;

      return false;
    });

    if (!matchedRule || matchedRule.approvalRequired === false || matchedRule.status === 'inactive') {
      return { required: false, isSuperAdmin: isSuper };
    }

    const firstLevel: ApprovalLevelConfig | undefined = matchedRule.levels && matchedRule.levels.length > 0 
      ? matchedRule.levels[0] 
      : undefined;

    const approverType = firstLevel?.approverType || matchedRule.approvalType || (matchedRule.approverUid ? 'user' : 'role');
    const approverId = firstLevel?.approverId || matchedRule.approverId || (approverType === 'user' ? matchedRule.approverUid : matchedRule.approverRole) || 'admin';
    let approverUid = firstLevel?.approverUid || matchedRule.approverUid || (approverType === 'user' ? approverId : '');
    let approverEmail = firstLevel?.approverEmail || matchedRule.approverEmail || '';
    const approverRole = firstLevel?.approverRole || matchedRule.approverRole || (approverType === 'role' ? approverId : '');
    let approverName = firstLevel?.approverName || matchedRule.approverName || (approverType === 'user' ? 'Designated User' : 'Role Approver');

    // If approverType is user but email/name is missing, attempt quick resolution
    if (approverType === 'user' && (!approverEmail || !approverName || approverName === 'Designated User')) {
      try {
        if (approverUid) {
          const uDoc = await getDoc(doc(db, 'users', approverUid));
          if (uDoc.exists()) {
            const ud = uDoc.data() as any;
            approverEmail = ud.email || approverEmail;
            approverName = ud.employeeName ? `${ud.employeeName} (${ud.email})` : (ud.displayName || ud.email || approverName);
          }
        }
      } catch (err) {
        console.warn('Approver user resolution notice:', err);
      }
    }

    return {
      required: true,
      isSuperAdmin: isSuper,
      rule: matchedRule,
      approverType: approverType,
      approverUid: approverUid,
      approverEmail: approverEmail,
      approverRole: approverRole,
      approverName: approverName,
      level: 1
    };
  } catch (err) {
    console.error('Error checking approval rule for page:', pageId, err);
    return { required: false, isSuperAdmin: isSuper };
  }
}

/**
 * Submits a document / voucher for approval.
 */
export async function submitDocumentForApproval(
  businessId: string,
  pageId: string,
  moduleName: string,
  actionType: string,
  targetCollection: string,
  targetId: string,
  summary: string,
  userProfile: UserProfile,
  checkResult: ApprovalCheckResult,
  amount?: number,
  currency?: string,
  designatedApprover?: { uid?: string; email?: string; displayName?: string; name?: string; role?: string } | null
): Promise<string> {
  const defaultFallbackCurr = (pageId === 'sales-order-entry' || targetCollection === 'work_orders') ? 'USD' : 'BDT';
  const currCode = currency || (summary.includes('USD') || summary.includes('$') ? 'USD' : (summary.includes('EUR') || summary.includes('€') ? 'EUR' : defaultFallbackCurr));
  const currSym = currCode === 'USD' ? '$' : currCode === 'EUR' ? '€' : currCode === 'GBP' ? '£' : currCode === 'INR' ? '₹' : '৳';

  const resolvedApproverUid = (designatedApprover?.uid || checkResult.approverUid || '').trim();
  const resolvedApproverEmail = (designatedApprover?.email || checkResult.approverEmail || '').trim().toLowerCase();
  const resolvedApproverName = designatedApprover?.displayName || designatedApprover?.name || checkResult.approverName || (resolvedApproverUid ? 'Designated User' : 'Role Approver');
  const resolvedApproverType = (resolvedApproverUid || resolvedApproverEmail) ? 'user' : (checkResult.approverType || 'role');
  const resolvedApproverRole = designatedApprover?.role || checkResult.approverRole || '';

  const reqData: any = {
    businessId: businessId || userProfile?.businessId || 'default',
    pageId: pageId,
    module: pageId,
    moduleName: moduleName || pageId,
    actionType: actionType || 'Create',
    targetCollection: targetCollection,
    targetId: targetId,
    summary: summary,
    amount: Number(amount) || 0,
    currency: currCode,
    currencyCode: currCode,
    currencySymbol: currSym,
    requestedByUid: userProfile?.uid || 'user',
    requestedByName: userProfile?.displayName || userProfile?.name || userProfile?.employeeName || userProfile?.email || 'User',
    requestedByEmail: (userProfile?.email || '').trim().toLowerCase(),
    approverType: resolvedApproverType,
    approverUid: resolvedApproverUid,
    approverEmail: resolvedApproverEmail,
    approverRole: resolvedApproverRole,
    approverName: resolvedApproverName,
    status: 'pending',
    createdAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, 'approvalRequests'), reqData);
  return docRef.id;
}

/**
 * Extracts and formats the accurate currency symbol and ISO code for any approval request.
 */
export function getApprovalRequestCurrency(req: ApprovalRequest | any): { code: string; symbol: string } {
  if (!req) return { code: 'BDT', symbol: '৳' };

  // 1. Direct explicit currency field
  const rawCode = (req.currency || req.currencyCode || '').toString().trim().toUpperCase();
  if (rawCode === 'USD' || rawCode === '$') return { code: 'USD', symbol: '$' };
  if (rawCode === 'EUR' || rawCode === '€') return { code: 'EUR', symbol: '€' };
  if (rawCode === 'GBP' || rawCode === '£') return { code: 'GBP', symbol: '£' };
  if (rawCode === 'INR' || rawCode === '₹') return { code: 'INR', symbol: '₹' };
  if (rawCode === 'BDT' || rawCode === 'TK' || rawCode === '৳') return { code: 'BDT', symbol: '৳' };
  if (rawCode) return { code: rawCode, symbol: rawCode };

  // 2. Direct currencySymbol field
  if (req.currencySymbol) {
    const sym = req.currencySymbol.toString().trim();
    if (sym === '$') return { code: 'USD', symbol: '$' };
    if (sym === '€') return { code: 'EUR', symbol: '€' };
    if (sym === '£') return { code: 'GBP', symbol: '£' };
    if (sym === '₹') return { code: 'INR', symbol: '₹' };
    if (sym === '৳') return { code: 'BDT', symbol: '৳' };
    return { code: sym, symbol: sym };
  }

  // 3. Inspect summary text for explicit symbols / currency indicators
  const summary = (req.summary || '').toString();
  if (summary.includes('$') || /\bUSD\b/i.test(summary)) {
    return { code: 'USD', symbol: '$' };
  }
  if (summary.includes('€') || /\bEUR\b/i.test(summary)) {
    return { code: 'EUR', symbol: '€' };
  }
  if (summary.includes('£') || /\bGBP\b/i.test(summary)) {
    return { code: 'GBP', symbol: '£' };
  }
  if (summary.includes('₹') || /\bINR\b/i.test(summary)) {
    return { code: 'INR', symbol: '₹' };
  }
  if (summary.includes('৳') || /\bBDT\b/i.test(summary) || /\bTK\b/i.test(summary)) {
    return { code: 'BDT', symbol: '৳' };
  }

  // 4. Default fallback: If target is Work Orders and no currency given, check if it's export/USD
  if (req.targetCollection === 'work_orders' || req.module === 'sales_order') {
    return { code: 'USD', symbol: '$' };
  }

  return { code: 'BDT', symbol: '৳' };
}

/**
 * Determines whether the current user is authorized to approve a given request.
 */
export function canUserApprove(req: ApprovalRequest, userProfile?: UserProfile | any): boolean {
  if (!userProfile) return false;
  if (isUserSuperAdmin(userProfile)) return true;

  const userUid = (userProfile.uid || userProfile.id || '').trim();
  const userEmail = (userProfile.email || '').toLowerCase().trim();
  const userName = (userProfile.displayName || userProfile.name || userProfile.employeeName || userProfile.username || '').toLowerCase().trim();
  const userRole = (userProfile.role || userProfile.roleName || '').toLowerCase().trim();
  const userRoleId = (userProfile.roleId || '').toLowerCase().trim();
  const userDesignation = (userProfile.designation || userProfile.designationName || '').toLowerCase().trim();
  const userDept = (userProfile.department || userProfile.departmentName || '').toLowerCase().trim();

  const targetUid = (req.approverUid || (req as any).approverId || '').trim();
  const targetEmail = ((req as any).approverEmail || '').toLowerCase().trim();
  const targetRole = (req.approverRole || '').toLowerCase().trim();
  const isTargetUserType = req.approverType === 'user' || (!!targetUid && targetUid !== 'SYSTEM_ADMIN' && targetUid !== 'admin' && targetUid !== 'super-admin' && !targetRole);

  // 1. If assigned to a Specific User Account: ONLY that designated user can approve!
  if (isTargetUserType) {
    if (targetUid && (targetUid === userUid || targetUid === (userProfile.id || ''))) {
      return true;
    }
    if (targetEmail && userEmail && (targetEmail === userEmail || targetEmail.includes(userEmail) || userEmail.includes(targetEmail))) {
      return true;
    }
    if (targetUid && targetUid.toLowerCase() === userEmail && userEmail) {
      return true;
    }
    if (req.approverName) {
      const targetName = req.approverName.toLowerCase().trim();
      if (userName && (targetName === userName || (userName.length > 3 && targetName.includes(userName)))) {
        return true;
      }
    }
    // Assigned to a specific user and this user does not match
    return false;
  }

  // 2. If assigned to a Specific Role: ONLY users holding that role can approve!
  if (targetRole) {
    const cleanTargetRole = targetRole.replace(/[^a-z0-9]/g, '');
    const cleanUserRole = userRole.replace(/[^a-z0-9]/g, '');
    const cleanRoleId = userRoleId.replace(/[^a-z0-9]/g, '');
    const cleanDesignation = userDesignation.replace(/[^a-z0-9]/g, '');
    const cleanDept = userDept.replace(/[^a-z0-9]/g, '');
    const cleanRoleName = (userProfile.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (
      cleanTargetRole === cleanUserRole ||
      cleanTargetRole === cleanRoleId ||
      cleanTargetRole === cleanDesignation ||
      cleanTargetRole === cleanRoleName
    ) {
      return true;
    }

    if (cleanTargetRole.includes('admin') && (cleanUserRole.includes('admin') || cleanRoleName.includes('admin') || userProfile.role === 'Admin')) {
      return true;
    }
    if (cleanTargetRole.includes('purchase') && (cleanUserRole.includes('purchase') || cleanDesignation.includes('purchase') || cleanDept.includes('procure') || cleanDept.includes('purchase'))) {
      return true;
    }
    if (cleanTargetRole.includes('account') && (cleanUserRole.includes('account') || cleanDesignation.includes('account') || cleanUserRole.includes('finance') || cleanDept.includes('account') || cleanDept.includes('finance'))) {
      return true;
    }
    if (cleanTargetRole.includes('sales') && (cleanUserRole.includes('sales') || cleanDesignation.includes('sales') || cleanUserRole.includes('commercial') || cleanDept.includes('sales') || cleanDept.includes('commercial'))) {
      return true;
    }
    if (cleanTargetRole.includes('store') && (cleanUserRole.includes('store') || cleanDesignation.includes('store') || cleanUserRole.includes('inventory') || cleanDept.includes('store') || cleanDept.includes('inventory'))) {
      return true;
    }
    if (cleanTargetRole.includes('production') && (cleanUserRole.includes('production') || cleanDesignation.includes('production') || cleanDept.includes('production'))) {
      return true;
    }
    if (cleanTargetRole.includes('manager') && (cleanUserRole.includes('manager') || cleanDesignation.includes('manager'))) {
      return true;
    }

    // Role does not match
    return false;
  }

  // 3. Fallback for unassigned / generic legacy requests: System Administrator
  if (userRole === 'admin' || userRole === 'super admin' || userProfile.role === 'Admin' || userProfile.roleName === 'Admin') {
    return true;
  }

  return false;
}

/**
 * Checks if the current user is specifically the directly assigned individual approver for a request.
 */
export function isUserDesignatedApprover(req: ApprovalRequest, userProfile?: UserProfile | any): boolean {
  if (!userProfile || !req) return false;
  const userUid = (userProfile.uid || userProfile.id || '').trim();
  const userEmail = (userProfile.email || '').toLowerCase().trim();
  const targetUid = (req.approverUid || (req as any).approverId || '').trim();
  const targetEmail = ((req as any).approverEmail || '').toLowerCase().trim();

  if (targetUid && userUid && (targetUid === userUid || targetUid === (userProfile.id || ''))) return true;
  if (targetEmail && userEmail && (targetEmail === userEmail || targetEmail.includes(userEmail))) return true;
  return false;
}

/**
 * Approves an approval request, updates the target document status,
 * and automatically posts all financial journals and transactions to the General Ledger and Stock.
 */
export async function executeApprovalAction(
  req: ApprovalRequest,
  userProfile: UserProfile | any,
  comment?: string
): Promise<void> {
  const approverDisplayName = userProfile?.displayName || userProfile?.email || 'Approver';
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // 1. Mark Approval Request as Approved
  await updateDoc(doc(db, 'approvalRequests', req.id), {
    status: 'approved',
    approvedAt: Timestamp.now(),
    approvedBy: approverDisplayName,
    approvalComment: comment || 'Approved and posted'
  });

  // 2. Post & Activate Target Document
  const targetColl = req.targetCollection;
  const targetId = req.targetId;

  if (!targetColl || !targetId) return;

  if (targetColl === 'journal_entries' || targetColl === 'journalEntries') {
    // Post Journal Voucher directly to General Ledger
    await updateDoc(doc(db, targetColl, targetId), {
      status: 'posted',
      postedBy: approverDisplayName,
      postedDate: today,
      postedAt: now,
      approvedBy: approverDisplayName,
      approvedDate: today,
      updatedAt: now
    });
  } else if (targetColl === 'cash_bank_transactions' || targetColl === 'cashBankBook') {
    // Post Cash & Bank transaction and its linked Journal
    await updateDoc(doc(db, targetColl, targetId), {
      status: 'posted',
      approvedBy: approverDisplayName,
      approvedDate: today,
      updatedAt: now
    });

    // Also find and post linked Journal Entry if any
    try {
      const q = query(
        collection(db, 'journal_entries'),
        where('referenceNo', '==', targetId)
      );
      const snap = await getDocs(q);
      for (const jDoc of snap.docs) {
        await updateDoc(doc(db, 'journal_entries', jDoc.id), {
          status: 'posted',
          postedBy: approverDisplayName,
          postedDate: today,
          postedAt: now,
          updatedAt: now
        });
      }
    } catch (e) {
      console.warn('Could not update linked journal for cash_bank_transactions', e);
    }
  } else if (targetColl === 'customer_receivables' || targetColl === 'supplier_payables' || targetColl === 'supplierPayments') {
    await updateDoc(doc(db, targetColl, targetId), {
      status: 'active',
      approvedBy: approverDisplayName,
      approvedDate: today,
      updatedAt: now
    });
  } else if (targetColl === 'fixed_assets' || targetColl === 'bank_loans' || targetColl === 'loanSanctions') {
    await updateDoc(doc(db, targetColl, targetId), {
      status: 'active',
      approvedBy: approverDisplayName,
      approvedDate: today,
      updatedAt: now
    });
  } else if (targetColl === 'proforma_invoices' || targetColl === 'proformaInvoices') {
    await updateDoc(doc(db, targetColl, targetId), {
      status: 'approved',
      approvedBy: approverDisplayName,
      approvedDate: today,
      updatedAt: now
    });
  } else if (targetColl === 'sales_orders' || targetColl === 'salesOrders' || targetColl === 'work_orders' || targetColl === 'workOrders') {
    if (req.actionType === 'RECTIFY_ORDER_REQUEST') {
      // Approving a Rectify Request unlocks the work order for user revision
      await updateDoc(doc(db, targetColl, targetId), {
        status: 'draft',
        isLocked: false,
        rectifyRequested: false,
        rectifyApproved: true,
        rectifyApprovedBy: approverDisplayName,
        rectifyApprovedAt: now,
        updatedAt: now
      });
    } else {
      // Standard order approval locks the work order for production
      await updateDoc(doc(db, targetColl, targetId), {
        status: 'approved',
        isLocked: true,
        approvedBy: approverDisplayName,
        approvedAt: now,
        approvedDate: today,
        updatedAt: now
      });
    }
  } else if (targetColl === 'purchase_requisitions' || targetColl === 'purchaseRequisitions') {
    await updateDoc(doc(db, 'purchase_requisitions', targetId), {
      status: 'approved',
      approvedBy: approverDisplayName,
      approvedAt: Timestamp.now(),
      approvedDate: today,
      updatedAt: now
    });
  } else if (targetColl === 'purchaseOrders') {
    await updateDoc(doc(db, 'purchaseOrders', targetId), {
      status: 'active',
      approvedBy: approverDisplayName,
      approvedDate: today,
      updatedAt: now
    });

    // Activate linked stock transactions
    try {
      const txsQuery = query(
        collection(db, 'transactions'),
        where('poId', '==', targetId)
      );
      const txSnap = await getDocs(txsQuery);
      for (const txDoc of txSnap.docs) {
        await updateDoc(doc(db, 'transactions', txDoc.id), { status: 'active' });
      }
    } catch (e) {
      console.warn('Could not update stock transactions for PO', e);
    }
  } else if (targetColl === 'price_masters' || targetColl === 'priceMasters') {
    const priceDocSnap = await getDoc(doc(db, 'price_masters', targetId));
    if (priceDocSnap.exists()) {
      const data = priceDocSnap.data();
      const newRate = data.pendingRate !== undefined ? data.pendingRate : data.rate;
      const newStyle = data.pendingStyle !== undefined ? data.pendingStyle : (data.style || '');
      const newCurrCode = data.pendingCurrencyCode !== undefined ? data.pendingCurrencyCode : (data.currencyCode || 'BDT');
      const newCurrId = data.pendingCurrencyId !== undefined ? data.pendingCurrencyId : (data.currencyId || '');
      const newUnit = data.pendingUnit !== undefined ? data.pendingUnit : (data.unit || 'PCS');
      const newEffDate = data.pendingEffectiveDate || data.effectiveDate;

      await updateDoc(doc(db, 'price_masters', targetId), {
        rate: Number(newRate),
        style: newStyle,
        currencyCode: newCurrCode,
        currencyId: newCurrId,
        unit: newUnit,
        effectiveDate: newEffDate,
        status: 'active',
        approvedBy: approverDisplayName,
        approvedAt: Timestamp.now(),
        pendingRate: deleteField(),
        pendingStyle: deleteField(),
        pendingCurrencyCode: deleteField(),
        pendingCurrencyId: deleteField(),
        pendingUnit: deleteField(),
        pendingEffectiveDate: deleteField(),
        updatedAt: Timestamp.now()
      });
    }
  } else if (targetColl === 'subcontract_prices' || targetColl === 'subcontractPrices') {
    await updateDoc(doc(db, 'subcontract_prices', targetId), {
      status: 'active',
      approvedBy: approverDisplayName,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } else if (targetColl === 'transactions') {
    await updateDoc(doc(db, 'transactions', targetId), {
      status: 'active',
      approvedBy: approverDisplayName,
      approvedDate: today
    });
  } else {
    // Default fallback
    await updateDoc(doc(db, targetColl, targetId), {
      status: 'active',
      approvedBy: approverDisplayName,
      approvedDate: today,
      updatedAt: now
    });
  }
}

/**
 * Rejects an approval request with a reason.
 */
export async function executeRejectAction(
  req: ApprovalRequest,
  userProfile: UserProfile | any,
  reason?: string
): Promise<void> {
  const approverDisplayName = userProfile?.displayName || userProfile?.email || 'Approver';
  const now = new Date().toISOString();

  // 1. Mark Approval Request as Rejected
  await updateDoc(doc(db, 'approvalRequests', req.id), {
    status: 'rejected',
    rejectedAt: Timestamp.now(),
    rejectedBy: approverDisplayName,
    rejectionReason: reason || 'Rejected by approver'
  });

  // 2. Mark Target Document as Rejected
  if (req.targetCollection && req.targetId) {
    if (req.actionType === 'RECTIFY_ORDER_REQUEST') {
      // Rejection of a rectify request simply clears the request while keeping the order locked/approved
      await updateDoc(doc(db, req.targetCollection, req.targetId), {
        rectifyRequested: false,
        rectifyRejectedReason: reason || 'Rectification request rejected by approver',
        updatedAt: now
      });
    } else if (req.targetCollection === 'price_masters' || req.targetCollection === 'priceMasters') {
      try {
        const priceDocSnap = await getDoc(doc(db, 'price_masters', req.targetId));
        if (priceDocSnap.exists()) {
          const pData = priceDocSnap.data();
          if (req.actionType === 'PRICE_MASTER_CREATE' || pData.pendingRate === undefined) {
            await updateDoc(doc(db, 'price_masters', req.targetId), {
              status: 'rejected',
              rejectionReason: reason || 'Price rule creation rejected by approver',
              updatedAt: Timestamp.now()
            });
          } else {
            await updateDoc(doc(db, 'price_masters', req.targetId), {
              status: 'active',
              pendingRate: deleteField(),
              pendingStyle: deleteField(),
              pendingCurrencyCode: deleteField(),
              pendingCurrencyId: deleteField(),
              pendingUnit: deleteField(),
              pendingEffectiveDate: deleteField(),
              rejectionReason: reason || 'Price change rejected by approver',
              updatedAt: Timestamp.now()
            });
          }
        }
      } catch (err) {
        console.error('Error handling price_masters rejection:', err);
      }
    } else if (req.targetCollection === 'subcontract_prices' || req.targetCollection === 'subcontractPrices') {
      await updateDoc(doc(db, 'subcontract_prices', req.targetId), {
        status: 'rejected',
        rejectionReason: reason || 'Price change rejected by approver',
        updatedAt: Timestamp.now()
      });
    } else {
      await updateDoc(doc(db, req.targetCollection, req.targetId), {
        status: 'rejected',
        isLocked: false,
        rejectionReason: reason || 'Rejected by approver',
        approvalRemarks: reason || 'Rejected by approver',
        approvedBy: approverDisplayName,
        approvedAt: Timestamp.now(),
        updatedAt: now
      });
    }
  }
}
