import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  CoaGroupMaster, 
  CoaCategoryMaster, 
  CoaSubCategoryMaster, 
  CoaLedgerAccount, 
  JournalEntry, 
  CashBankTransaction, 
  FixedAsset 
} from '../types/accounts';
import { 
  DEFAULT_COA_GROUPS, 
  DEFAULT_COA_CATEGORIES, 
  DEFAULT_COA_SUBCATEGORIES, 
  DEFAULT_COA_LEDGERS 
} from '../data/defaultCoaData';

// Helper to sanitize business ID
const getSafeBusinessId = (businessId?: string) => businessId || 'default';

// ==========================================
// 1. Chart of Accounts Master Services
// ==========================================

export async function fetchCoaGroups(businessId: string): Promise<CoaGroupMaster[]> {
  try {
    const q = query(collection(db, 'coa_groups'), where('businessId', '==', getSafeBusinessId(businessId)));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoaGroupMaster));
    return items.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  } catch (error) {
    console.error('Error fetching COA groups:', error);
    return [];
  }
}

export async function fetchCoaCategories(businessId: string): Promise<CoaCategoryMaster[]> {
  try {
    const q = query(collection(db, 'coa_categories'), where('businessId', '==', getSafeBusinessId(businessId)));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoaCategoryMaster));
    return items.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  } catch (error) {
    console.error('Error fetching COA categories:', error);
    return [];
  }
}

export async function fetchCoaSubCategories(businessId: string): Promise<CoaSubCategoryMaster[]> {
  try {
    const q = query(collection(db, 'coa_subcategories'), where('businessId', '==', getSafeBusinessId(businessId)));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoaSubCategoryMaster));
    return items.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  } catch (error) {
    console.error('Error fetching COA subcategories:', error);
    return [];
  }
}

export async function fetchCoaLedgers(businessId: string): Promise<CoaLedgerAccount[]> {
  try {
    const q = query(collection(db, 'coa_ledgers'), where('businessId', '==', getSafeBusinessId(businessId)));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoaLedgerAccount));
    return items.sort((a, b) => a.code.localeCompare(b.code));
  } catch (error) {
    console.error('Error fetching COA ledgers:', error);
    return [];
  }
}

export async function initializeDefaultCoa(businessId: string, authorUid: string): Promise<void> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const now = new Date().toISOString();

  const allItems: Array<{ collection: string; id: string; data: any }> = [];

  // Groups
  for (const group of DEFAULT_COA_GROUPS) {
    allItems.push({
      collection: 'coa_groups',
      id: `${safeBusinessId}_${group.id}`,
      data: {
        ...group,
        businessId: safeBusinessId,
        createdAt: now,
        updatedAt: now
      }
    });
  }

  // Categories
  for (const cat of DEFAULT_COA_CATEGORIES) {
    allItems.push({
      collection: 'coa_categories',
      id: `${safeBusinessId}_${cat.id}`,
      data: {
        ...cat,
        businessId: safeBusinessId,
        createdAt: now,
        updatedAt: now
      }
    });
  }

  // Sub Categories
  for (const sub of DEFAULT_COA_SUBCATEGORIES) {
    allItems.push({
      collection: 'coa_subcategories',
      id: `${safeBusinessId}_${sub.id}`,
      data: {
        ...sub,
        businessId: safeBusinessId,
        createdAt: now,
        updatedAt: now
      }
    });
  }

  // Ledgers
  for (const ledger of DEFAULT_COA_LEDGERS) {
    allItems.push({
      collection: 'coa_ledgers',
      id: `${safeBusinessId}_${ledger.id}`,
      data: {
        ...ledger,
        businessId: safeBusinessId,
        createdBy: authorUid,
        createdAt: now,
        updatedAt: now
      }
    });
  }

  // Firestore allows up to 500 operations per batch - chunk in batches of 200
  const chunkSize = 200;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const chunk = allItems.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const ref = doc(db, item.collection, item.id);
      batch.set(ref, item.data, { merge: true });
    }
    await batch.commit();
  }
}

// Generate Next Ledger Account Code
export function generateNextLedgerCode(
  subCategoryCode: string,
  existingLedgers: CoaLedgerAccount[]
): string {
  // 12-digit format: e.g. Subcategory = 110100000000 -> Ledger prefix: 110101, 110102 etc.
  const prefix = subCategoryCode.slice(0, 4); // First 4 digits e.g. "1101"
  const matching = existingLedgers
    .filter(l => l.code.startsWith(prefix))
    .map(l => parseInt(l.code.slice(4), 10))
    .filter(n => !isNaN(n));
  
  const maxSuffix = matching.length > 0 ? Math.max(...matching) : 0;
  const nextSuffix = String(maxSuffix + 1).padStart(8, '0');
  return `${prefix}${nextSuffix}`;
}

// Save or Update Ledger
export async function saveCoaLedger(ledger: CoaLedgerAccount, businessId: string): Promise<void> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = ledger.id || `led_${Date.now()}`;
  const ref = doc(db, 'coa_ledgers', docId);
  await setDoc(ref, {
    ...ledger,
    id: docId,
    businessId: safeBusinessId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// Save or Update SubCategory
export async function saveCoaSubCategory(sub: CoaSubCategoryMaster, businessId: string): Promise<void> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = sub.id || `sub_${Date.now()}`;
  const ref = doc(db, 'coa_subcategories', docId);
  await setDoc(ref, {
    ...sub,
    id: docId,
    businessId: safeBusinessId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// Save or Update Category
export async function saveCoaCategory(cat: CoaCategoryMaster, businessId: string): Promise<void> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = cat.id || `cat_${Date.now()}`;
  const ref = doc(db, 'coa_categories', docId);
  await setDoc(ref, {
    ...cat,
    id: docId,
    businessId: safeBusinessId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// Save or Update Group
export async function saveCoaGroup(group: CoaGroupMaster, businessId: string): Promise<void> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = group.id || `grp_${Date.now()}`;
  const ref = doc(db, 'coa_groups', docId);
  await setDoc(ref, {
    ...group,
    id: docId,
    businessId: safeBusinessId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// Delete COA Node (with safety checks)
export async function deleteCoaNode(collectionName: 'coa_ledgers' | 'coa_subcategories' | 'coa_categories' | 'coa_groups', docId: string): Promise<void> {
  const ref = doc(db, collectionName, docId);
  await deleteDoc(ref);
}

// ==========================================
// 2. Journal Entry Services
// ==========================================

export async function fetchJournalEntries(businessId: string): Promise<JournalEntry[]> {
  try {
    const q = query(collection(db, 'journal_entries'), where('businessId', '==', getSafeBusinessId(businessId)));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return [];
  }
}

export async function saveJournalEntry(journal: JournalEntry, businessId: string): Promise<string> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = journal.id || `jv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ref = doc(db, 'journal_entries', docId);
  const now = new Date().toISOString();

  await setDoc(ref, {
    ...journal,
    id: docId,
    businessId: safeBusinessId,
    updatedAt: now,
    createdAt: journal.createdAt || now
  }, { merge: true });

  return docId;
}

export async function reverseJournalEntry(
  originalJournal: JournalEntry,
  reversalReason: string,
  userDisplayName: string,
  businessId: string
): Promise<string> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // 1. Create reversing journal with swapped Debit and Credit lines
  const reversedLines = originalJournal.lines.map((line, idx) => ({
    id: `rev_line_${idx + 1}`,
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    accountNature: line.accountNature,
    debit: line.credit, // SWAP
    credit: line.debit, // SWAP
    costCenter: line.costCenter,
    lineNarration: `Reversal of ${originalJournal.journalNo}: ${line.lineNarration || ''}`
  }));

  const reversalNo = `REV-${originalJournal.journalNo}`;
  const reversalDocId = `rev_${originalJournal.id}_${Date.now()}`;

  const reversalJournal: JournalEntry = {
    id: reversalDocId,
    journalNo: reversalNo,
    date: today,
    referenceNo: originalJournal.journalNo,
    referenceType: 'reversal',
    narration: `Reversal entry for Journal ${originalJournal.journalNo}. Reason: ${reversalReason}`,
    lines: reversedLines,
    totalDebit: originalJournal.totalCredit,
    totalCredit: originalJournal.totalDebit,
    costCenter: originalJournal.costCenter,
    preparedBy: userDisplayName,
    postedBy: userDisplayName,
    postedDate: today,
    status: 'posted',
    isSystemGenerated: true,
    reversedJournalId: originalJournal.id,
    reversalReason: reversalReason,
    businessId: safeBusinessId,
    createdAt: now,
    updatedAt: now,
    postedAt: now,
    auditTrail: [
      {
        action: 'CREATED_REVERSAL',
        performedBy: userDisplayName,
        timestamp: now,
        details: `Reversed original voucher ${originalJournal.journalNo}. Reason: ${reversalReason}`
      }
    ]
  };

  // 2. Mark original journal as 'reversed'
  const origRef = doc(db, 'journal_entries', originalJournal.id);
  const origAudit = originalJournal.auditTrail || [];
  origAudit.push({
    action: 'REVERSED',
    performedBy: userDisplayName,
    timestamp: now,
    details: `Reversed by voucher ${reversalNo}. Reason: ${reversalReason}`
  });

  await updateDoc(origRef, {
    status: 'reversed',
    reversedJournalId: reversalDocId,
    reversalReason: reversalReason,
    updatedAt: now,
    auditTrail: origAudit
  });

  // 3. Save the new reversal journal
  await setDoc(doc(db, 'journal_entries', reversalDocId), reversalJournal);

  return reversalDocId;
}

// ==========================================
// 3. Cash & Bank Services
// ==========================================

export async function fetchCashBankTransactions(businessId: string): Promise<CashBankTransaction[]> {
  try {
    const q = query(collection(db, 'cash_bank_transactions'), where('businessId', '==', getSafeBusinessId(businessId)));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CashBankTransaction));
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  } catch (error) {
    console.error('Error fetching cash/bank transactions:', error);
    return [];
  }
}

export async function saveCashBankTransaction(tx: CashBankTransaction, businessId: string): Promise<string> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = tx.id || `cb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ref = doc(db, 'cash_bank_transactions', docId);
  const now = new Date().toISOString();

  await setDoc(ref, {
    ...tx,
    id: docId,
    businessId: safeBusinessId,
    updatedAt: now,
    createdAt: tx.createdAt || now
  }, { merge: true });

  return docId;
}

// ==========================================
// 4. Fixed Assets Services
// ==========================================

export async function fetchFixedAssets(businessId: string): Promise<FixedAsset[]> {
  try {
    const q = query(collection(db, 'fixed_assets'), where('businessId', '==', getSafeBusinessId(businessId)));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FixedAsset));
    return items.sort((a, b) => (a.assetCode || '').localeCompare(b.assetCode || ''));
  } catch (error) {
    console.error('Error fetching fixed assets:', error);
    return [];
  }
}

export async function saveFixedAsset(asset: FixedAsset, businessId: string): Promise<string> {
  const safeBusinessId = getSafeBusinessId(businessId);
  const docId = asset.id || `fa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ref = doc(db, 'fixed_assets', docId);
  const now = new Date().toISOString();

  await setDoc(ref, {
    ...asset,
    id: docId,
    businessId: safeBusinessId,
    updatedAt: now,
    createdAt: asset.createdAt || now
  }, { merge: true });

  return docId;
}

// ==========================================
// 5. Hierarchy & Aggregate Service Helpers
// ==========================================

export async function getCoaHierarchy(businessId: string): Promise<{
  groups: CoaGroupMaster[];
  categories: CoaCategoryMaster[];
  subCategories: CoaSubCategoryMaster[];
  ledgers: CoaLedgerAccount[];
}> {
  const [groups, categories, subCategories, ledgers] = await Promise.all([
    fetchCoaGroups(businessId),
    fetchCoaCategories(businessId),
    fetchCoaSubCategories(businessId),
    fetchCoaLedgers(businessId)
  ]);
  return { groups, categories, subCategories, ledgers };
}

export const getJournalEntries = fetchJournalEntries;
export const getCashBankTransactions = fetchCashBankTransactions;
export const getFixedAssets = fetchFixedAssets;
export const initializeChartOfAccounts = (businessId: string, uid: string = 'system') => initializeDefaultCoa(businessId, uid);

