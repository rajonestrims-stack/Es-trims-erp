import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { AutoPostingRule, PostingEventCode, PostingSimulationPayload, PostingSimulationResult } from '../types/postingRules';
import { DEFAULT_POSTING_RULES } from '../data/defaultPostingRules';
import { CoaLedgerAccount, JournalEntry, JournalEntryLine } from '../types/accounts';
import { saveJournalEntry, getJournalEntries } from './accountsService';

const getSafeBusinessId = (businessId?: string) => businessId || 'default-business';

// 1. Fetch all configured posting rules
export async function fetchPostingRules(businessId: string): Promise<AutoPostingRule[]> {
  try {
    const safeBusinessId = getSafeBusinessId(businessId);
    const q = query(collection(db, 'posting_rules'), where('businessId', '==', safeBusinessId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Return defaults with businessId
      return DEFAULT_POSTING_RULES.map(r => ({ ...r, businessId: safeBusinessId }));
    }

    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoPostingRule));
    
    // Merge any missing default rules
    const existingCodes = new Set(items.map(i => i.eventCode));
    const missingRules = DEFAULT_POSTING_RULES.filter(r => !existingCodes.has(r.eventCode)).map(r => ({ ...r, businessId: safeBusinessId }));
    
    return [...items, ...missingRules];
  } catch (error) {
    console.error('Error fetching posting rules:', error);
    return DEFAULT_POSTING_RULES.map(r => ({ ...r, businessId: getSafeBusinessId(businessId) }));
  }
}

// Helper to sanitize undefined values for Firestore
function cleanUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

// 2. Save or update a posting rule
export async function savePostingRule(rule: AutoPostingRule, businessId: string): Promise<void> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = `${safeBusinessId}_${rule.id}`;
  const ref = doc(db, 'posting_rules', docId);

  const cleanedRule = cleanUndefined({
    ...rule,
    businessId: safeBusinessId,
    updatedAt: new Date().toISOString()
  });

  await setDoc(ref, cleanedRule, { merge: true });
}

// 2b. Delete a posting rule
export async function deletePostingRule(ruleId: string, businessId: string): Promise<void> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = `${safeBusinessId}_${ruleId}`;
  const ref = doc(db, 'posting_rules', docId);
  await deleteDoc(ref);
}

// 3. Reset rules to system defaults
export async function resetPostingRulesToDefaults(businessId: string): Promise<AutoPostingRule[]> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const batch = writeBatch(db);

  const updatedRules: AutoPostingRule[] = [];

  for (const rule of DEFAULT_POSTING_RULES) {
    const docId = `${safeBusinessId}_${rule.id}`;
    const ref = doc(db, 'posting_rules', docId);
    const ruleData: AutoPostingRule = {
      ...rule,
      businessId: safeBusinessId,
      updatedAt: new Date().toISOString()
    };
    batch.set(ref, ruleData);
    updatedRules.push(ruleData);
  }

  await batch.commit();
  return updatedRules;
}

// 4. Simulate a Journal Post with detailed COA hierarchy tracing
export function simulatePostingJournal(
  payload: PostingSimulationPayload,
  rules: AutoPostingRule[],
  ledgers: CoaLedgerAccount[]
): PostingSimulationResult | null {
  const rule = rules.find(r => r.eventCode === payload.eventCode);
  if (!rule) return null;

  const now = payload.date || new Date().toISOString().split('T')[0];
  const dateStr = now.replace(/-/g, '').slice(0, 6);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNo = `${rule.voucherPrefix}-${dateStr}-${randomSuffix}`;
  const amount = Number(payload.amount) || 0;
  const secondaryAmount = Number(payload.secondaryAmount) || 0;

  // Helper to find COA node path
  const findPath = (code: string, fallbackName: string) => {
    const match = ledgers.find(l => l.code === code);
    if (!match) return `COA > ${fallbackName} (${code})`;
    return `${match.groupName} > ${match.categoryName} > ${match.subCategoryName} > [${match.code}] ${match.name}`;
  };

  const lines: PostingSimulationResult['lines'] = [];

  // 1. Primary Debit
  lines.push({
    accountCode: rule.debitLedgerCode,
    accountName: rule.debitLedgerName,
    accountType: rule.debitAccountType,
    nature: 'Debit',
    debit: amount,
    credit: 0,
    coaPath: findPath(rule.debitLedgerCode, rule.debitLedgerName)
  });

  // 2. Secondary Debit (if applicable, e.g. Loan Interest)
  if (rule.secondaryDebitLedgerCode && secondaryAmount > 0) {
    lines.push({
      accountCode: rule.secondaryDebitLedgerCode,
      accountName: rule.secondaryDebitLedgerName || 'Secondary Expense / Fee',
      accountType: 'Expense',
      nature: 'Debit',
      debit: secondaryAmount,
      credit: 0,
      coaPath: findPath(rule.secondaryDebitLedgerCode, rule.secondaryDebitLedgerName || '')
    });
  }

  // 3. Primary Credit (Credit total = primary amount + secondary amount if single credit)
  const totalCreditAmount = rule.secondaryDebitLedgerCode && secondaryAmount > 0 ? (amount + secondaryAmount) : amount;
  lines.push({
    accountCode: rule.creditLedgerCode,
    accountName: rule.creditLedgerName,
    accountType: rule.creditAccountType,
    nature: 'Credit',
    debit: 0,
    credit: totalCreditAmount,
    coaPath: findPath(rule.creditLedgerCode, rule.creditLedgerName)
  });

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const narration = `${rule.eventNameBn} [${rule.eventName}]: ${payload.partyName ? `Party: ${payload.partyName}, ` : ''}Ref: ${payload.referenceNo || 'AUTO-POST'}. ${payload.notes || ''}`.trim();

  return {
    rule,
    voucherNo,
    date: now,
    referenceNo: payload.referenceNo || `REF-${Date.now().toString().slice(-6)}`,
    narration,
    lines,
    totalDebit,
    totalCredit,
    isBalanced,
    statementImpactExplanation: `হিসাব সমীকরণ ও আর্থিক বিবরণী প্রভাব: ${rule.financialStatementImpact}. ডেবিট মোট: ${totalDebit.toLocaleString()} এবং ক্রেডিট মোট: ${totalCredit.toLocaleString()}`
  };
}

// 5. Generate and execute automatic Journal Entry into Firestore `journal_entries`
export async function executeAutoPostForEvent(
  eventCode: PostingEventCode,
  payload: {
    amount: number;
    secondaryAmount?: number;
    partyName?: string;
    referenceNo: string;
    referenceType: 'sales' | 'customer_payment' | 'purchase' | 'supplier_payment' | 'loan_disbursement' | 'loan_repayment' | 'manual';
    narration?: string;
    date?: string;
    costCenter?: string;
  },
  businessId: string,
  authorUid: string,
  authorName: string
): Promise<JournalEntry | null> {
  try {
    const rules = await fetchPostingRules(businessId);
    const rule = rules.find(r => r.eventCode === eventCode);
    if (!rule || !rule.isAutoPostActive) {
      console.log(`Auto-posting skipped: Rule not found or inactive for ${eventCode}`);
      return null;
    }

    const now = payload.date || new Date().toISOString().split('T')[0];
    const dateStr = now.replace(/-/g, '').slice(0, 6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const journalNo = `${rule.voucherPrefix}-${dateStr}-${randomSuffix}`;
    const amount = Number(payload.amount) || 0;
    const secondaryAmount = Number(payload.secondaryAmount) || 0;

    const lines: JournalEntryLine[] = [
      {
        id: `line-1-${Date.now()}`,
        accountId: `acc-${rule.debitLedgerCode}`,
        accountCode: rule.debitLedgerCode,
        accountName: rule.debitLedgerName,
        accountNature: 'Debit',
        debit: amount,
        credit: 0,
        costCenter: payload.costCenter,
        lineNarration: `Auto-Post Dr: ${rule.eventName}`
      }
    ];

    if (rule.secondaryDebitLedgerCode && secondaryAmount > 0) {
      lines.push({
        id: `line-sec-${Date.now()}`,
        accountId: `acc-${rule.secondaryDebitLedgerCode}`,
        accountCode: rule.secondaryDebitLedgerCode,
        accountName: rule.secondaryDebitLedgerName || 'Finance Charge',
        accountNature: 'Debit',
        debit: secondaryAmount,
        credit: 0,
        costCenter: payload.costCenter,
        lineNarration: `Auto-Post Secondary Dr: ${rule.secondaryDebitLedgerName}`
      });
    }

    const creditAmount = (rule.secondaryDebitLedgerCode && secondaryAmount > 0) ? (amount + secondaryAmount) : amount;
    lines.push({
      id: `line-2-${Date.now()}`,
      accountId: `acc-${rule.creditLedgerCode}`,
      accountCode: rule.creditLedgerCode,
      accountName: rule.creditLedgerName,
      accountNature: 'Credit',
      debit: 0,
      credit: creditAmount,
      costCenter: payload.costCenter,
      lineNarration: `Auto-Post Cr: ${rule.eventName}`
    });

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    const fullNarration = payload.narration || `${rule.eventNameBn} [${rule.eventName}]: ${payload.partyName ? `${payload.partyName} - ` : ''}Ref: ${payload.referenceNo}`.trim();

    const journalEntry: JournalEntry = {
      id: `jv-${Date.now()}-${randomSuffix}`,
      journalNo,
      date: now,
      referenceNo: payload.referenceNo,
      referenceType: payload.referenceType,
      narration: fullNarration,
      lines,
      totalDebit,
      totalCredit,
      costCenter: payload.costCenter || 'Factory Main',
      preparedBy: authorName || 'Auto-Posting Engine',
      postedBy: rule.requiresApproval ? undefined : (authorName || 'System GL Poster'),
      postedDate: rule.requiresApproval ? undefined : now,
      status: rule.requiresApproval ? 'pending_approval' : 'posted',
      isSystemGenerated: true,
      businessId: getSafeBusinessId(businessId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveJournalEntry(journalEntry, businessId);
    return journalEntry;
  } catch (error) {
    console.error('Error executing auto post for event:', error);
    return null;
  }
}
