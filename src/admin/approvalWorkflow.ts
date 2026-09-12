import { collection, addDoc, Timestamp, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ApprovalRuleModel, ApprovalLevelConfig, UserAccountModel, RoleModel } from './adminTypes';
import { ApprovalRequest, UserProfile } from '../types';
import { isUserSuperAdmin } from './adminUtils';

export interface ApprovalCheckResult {
  required: boolean;
  rule?: ApprovalRuleModel;
  approverUid?: string;
  approverName?: string;
  approverRole?: string;
}

/**
 * Checks if an approval workflow rule is active for a given ERP page.
 * Returns required=false if the user is Super Admin or if no active rule exists.
 */
export function checkApprovalRequirement(
  pageId: string,
  approvalRules: ApprovalRuleModel[] = [],
  user?: any,
  amount?: number
): ApprovalCheckResult {
  if (isUserSuperAdmin(user)) {
    return { required: false };
  }

  // Find rule matching pageId or common aliases
  const matchedRule = approvalRules.find(r => 
    (r.pageId === pageId || 
     (pageId === 'purchases' && r.pageId === 'procurement-po') ||
     (pageId === 'procurement-po' && r.pageId === 'purchases') ||
     (pageId === 'sales-create-order' && r.pageId === 'sales-order-entry') ||
     (pageId === 'finance-create-bill' && r.pageId === 'finance-billing') ||
     (pageId === 'loan-repayment' && r.pageId === 'loan-repayments')
    ) && r.status === 'active' && r.approvalRequired !== false
  );

  if (!matchedRule) {
    return { required: false };
  }

  // If level configuration exists, find the highest applicable level or primary level
  const primaryLevel: ApprovalLevelConfig | undefined = matchedRule.levels && matchedRule.levels.length > 0
    ? matchedRule.levels[0]
    : undefined;

  const approverType = primaryLevel?.approverType || matchedRule.approvalType || 'role';
  const approverId = primaryLevel?.approverId || matchedRule.approverId || 'admin';
  const approverName = primaryLevel?.approverName || matchedRule.approverName || 'Administrator';

  return {
    required: true,
    rule: matchedRule,
    approverUid: approverType === 'user' ? approverId : '',
    approverRole: approverType === 'role' ? approverId : '',
    approverName: approverName
  };
}

/**
 * Creates an Approval Request in Firestore collection `approvalRequests`.
 */
export async function createApprovalRequest(
  businessId: string,
  pageId: string,
  moduleName: string,
  actionType: string,
  targetCollection: string,
  targetId: string,
  summary: string,
  userProfile: UserProfile,
  checkResult: ApprovalCheckResult,
  amount?: number
): Promise<string> {
  const reqData: any = {
    businessId: businessId || 'default',
    pageId: pageId,
    module: pageId,
    moduleName: moduleName || pageId,
    actionType: actionType || 'Create',
    targetCollection: targetCollection,
    targetId: targetId,
    summary: summary,
    amount: amount || 0,
    requestedByUid: userProfile.uid,
    requestedByName: userProfile.displayName || userProfile.email || 'User',
    approverUid: checkResult.approverUid || '',
    approverRole: checkResult.approverRole || '',
    approverName: checkResult.approverName || 'Approver',
    status: 'pending',
    createdAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, 'approvalRequests'), reqData);
  return docRef.id;
}
