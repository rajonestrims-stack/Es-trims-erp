import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  DollarSign, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  FileText, 
  Edit2, 
  Trash2, 
  Eye, 
  Percent, 
  Download, 
  Filter, 
  TrendingUp, 
  Layers, 
  Sliders, 
  Calculator, 
  BookOpen, 
  Printer, 
  X, 
  Check, 
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  Hash,
  ShoppingBag,
  Factory,
  ChevronRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  UserProfile, 
  RoleDefinition,
  BankFacilitySanction, 
  BankLoanRecord, 
  LoanRepaymentRecord, 
  LoanGlVoucher, 
  LoanInstallmentScheduleItem,
  LoanType,
  BankFacilityType
} from '../types';
import { checkActionPermission, isUserSuperAdmin, canUserAccessPage } from '../admin/adminUtils';

interface BankLoanManagementProps {
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  roles?: RoleDefinition[];
  initialSubTab?: 'dashboard' | 'sanctions' | 'loans' | 'repayments' | 'gl_vouchers';
  onSubTabChange?: (tab: string) => void;
  allowedPagesSet?: Set<string>;
}

// Calculate days between two date strings (YYYY-MM-DD)
function getDaysDifference(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Format Currency
function formatMoney(amount: number | undefined | null, currency: string = 'BDT'): string {
  const val = Number(amount) || 0;
  return `${currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BankLoanManagement({
  userProfile,
  showToast,
  roles = [],
  initialSubTab = 'dashboard',
  onSubTabChange,
  allowedPagesSet
}: BankLoanManagementProps) {
  const businessId = userProfile.businessId || 'default';
  const isSuper = isUserSuperAdmin(userProfile);

  const isPagePermitted = (pageId: string) => {
    if (isSuper) return true;
    if (allowedPagesSet) return allowedPagesSet.has(pageId);
    return canUserAccessPage(userProfile, pageId, roles);
  };

  // --- Granular Permissions ---
  const canAccessDashboard = isSuper || isPagePermitted('bank-loan-dashboard') || isPagePermitted('bank-loans');
  const canAccessSanctions = isSuper || isPagePermitted('loan-sanctions');
  const canAccessLoans = isSuper || isPagePermitted('loan-records');
  const canAccessRepayments = isSuper || isPagePermitted('loan-repayments') || isPagePermitted('loan-repayment');
  const canAccessGlVouchers = isSuper || isPagePermitted('loan-vouchers');

  const canCreateSanction = isSuper || checkActionPermission(userProfile, 'loan-sanctions', 'create', roles);
  const canEditSanction = isSuper || checkActionPermission(userProfile, 'loan-sanctions', 'edit', roles);
  const canDeleteSanction = isSuper || checkActionPermission(userProfile, 'loan-sanctions', 'delete', roles);

  const canCreateLoan = isSuper || checkActionPermission(userProfile, 'loan-records', 'create', roles);
  const canEditLoan = isSuper || checkActionPermission(userProfile, 'loan-records', 'edit', roles);
  const canDeleteLoan = isSuper || checkActionPermission(userProfile, 'loan-records', 'delete', roles);

  const canCreateRepayment = isSuper || checkActionPermission(userProfile, 'loan-repayments', 'create', roles) || checkActionPermission(userProfile, 'loan-repayment', 'create', roles);
  const canDeleteRepayment = isSuper || checkActionPermission(userProfile, 'loan-repayments', 'delete', roles) || checkActionPermission(userProfile, 'loan-repayment', 'delete', roles);

  const availableTabs = useMemo(() => {
    const tabs: ('dashboard' | 'sanctions' | 'loans' | 'repayments' | 'gl_vouchers')[] = [];
    if (canAccessDashboard) tabs.push('dashboard');
    if (canAccessSanctions) tabs.push('sanctions');
    if (canAccessLoans) tabs.push('loans');
    if (canAccessRepayments) tabs.push('repayments');
    if (canAccessGlVouchers) tabs.push('gl_vouchers');
    return tabs;
  }, [canAccessDashboard, canAccessSanctions, canAccessLoans, canAccessRepayments, canAccessGlVouchers]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'sanctions' | 'loans' | 'repayments' | 'gl_vouchers'>(() => {
    if (initialSubTab && (
      (initialSubTab === 'dashboard' && canAccessDashboard) ||
      (initialSubTab === 'sanctions' && canAccessSanctions) ||
      (initialSubTab === 'loans' && canAccessLoans) ||
      (initialSubTab === 'repayments' && canAccessRepayments) ||
      (initialSubTab === 'gl_vouchers' && canAccessGlVouchers)
    )) {
      return initialSubTab;
    }
    return availableTabs[0] || 'dashboard';
  });

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  useEffect(() => {
    if (initialSubTab && availableTabs.includes(initialSubTab)) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab, availableTabs]);

  const handleTabChange = (t: 'dashboard' | 'sanctions' | 'loans' | 'repayments' | 'gl_vouchers') => {
    setActiveTab(t);
    if (onSubTabChange) onSubTabChange(t);
  };

  // --- Live Data States ---
  const [facilities, setFacilities] = useState<BankFacilitySanction[]>([]);
  const [loans, setLoans] = useState<BankLoanRecord[]>([]);
  const [repayments, setRepayments] = useState<LoanRepaymentRecord[]>([]);
  const [glVouchers, setGlVouchers] = useState<LoanGlVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore Listeners
  useEffect(() => {
    if (!businessId) return;
    setIsLoading(true);

    // 1. Sanctions
    const qSanctions = query(collection(db, 'bank_facility_sanctions'), where('businessId', '==', businessId));
    const unsubSanctions = onSnapshot(
      qSanctions,
      (snap) => {
        const list: BankFacilitySanction[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as BankFacilitySanction));
        list.sort((a, b) => (b.sanctionDate || '').localeCompare(a.sanctionDate || ''));
        setFacilities(list);
      },
      (error) => {
        console.error('Error fetching bank facility sanctions:', error);
      }
    );

    // 2. Loans
    const qLoans = query(collection(db, 'bank_loans'), where('businessId', '==', businessId));
    const unsubLoans = onSnapshot(
      qLoans,
      (snap) => {
        const list: BankLoanRecord[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as BankLoanRecord));
        list.sort((a, b) => (b.interestStartDate || '').localeCompare(a.interestStartDate || ''));
        setLoans(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching bank loans:', error);
        setIsLoading(false);
      }
    );

    // 3. Repayments
    const qRepayments = query(collection(db, 'bank_loan_repayments'), where('businessId', '==', businessId));
    const unsubRepayments = onSnapshot(
      qRepayments,
      (snap) => {
        const list: LoanRepaymentRecord[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as LoanRepaymentRecord));
        list.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
        setRepayments(list);
      },
      (error) => {
        console.error('Error fetching bank loan repayments:', error);
      }
    );

    // 4. GL Vouchers
    const qVouchers = query(collection(db, 'bank_loan_gl_vouchers'), where('businessId', '==', businessId));
    const unsubVouchers = onSnapshot(
      qVouchers,
      (snap) => {
        const list: LoanGlVoucher[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as LoanGlVoucher));
        list.sort((a, b) => (b.postingDate || '').localeCompare(a.postingDate || ''));
        setGlVouchers(list);
      },
      (error) => {
        console.error('Error fetching loan GL vouchers:', error);
      }
    );

    return () => {
      unsubSanctions();
      unsubLoans();
      unsubRepayments();
      unsubVouchers();
    };
  }, [businessId]);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // --- Dynamic Loan Status & Overdue Evaluation ---
  // Evaluates every active loan against current date and sanction terms
  const processedLoans = useMemo(() => {
    return loans.map(loan => {
      const facility = facilities.find(f => f.id === loan.facilityId);
      const overdueRate = loan.overdueChargeRate || facility?.overdueRate || 1.50;
      const graceDays = facility?.graceDays || 0;

      let status = loan.status;
      let overdueDays = 0;
      let overdueAmount = 0;
      let calculatedOverdueCharge = 0;

      const maturityDate = loan.maturityDate;
      const netOutstanding = (loan.financedAmount || 0) + (loan.calculatedInterest || 0) + (loan.otherCharges || 0) - (loan.totalPaidAmount || 0);

      if (netOutstanding <= 0 && loan.status !== 'draft') {
        status = 'fully_paid';
      } else if (maturityDate) {
        const today = new Date(todayStr);
        const matDate = new Date(maturityDate);
        const diffDays = Math.ceil((today.getTime() - matDate.getTime()) / (1000 * 3600 * 24));

        if (diffDays <= 0) {
          if (diffDays === 0) status = 'due_today';
          else if (diffDays >= -7) status = 'due';
          else status = 'upcoming';
        } else {
          // It is past maturity date
          if (diffDays > graceDays) {
            status = 'overdue';
            overdueDays = diffDays;
            overdueAmount = Math.max(0, netOutstanding);
            // Default 1.50% overdue charge on overdue amount
            calculatedOverdueCharge = (overdueAmount * (overdueRate / 100));
          } else {
            status = 'due';
          }
        }
      }

      const totalPayableWithOverdue = netOutstanding + calculatedOverdueCharge;

      return {
        ...loan,
        status: loan.status === 'closed' || loan.status === 'fully_paid' ? loan.status : status,
        overdueDays,
        overdueAmount,
        overdueChargeRate: overdueRate,
        calculatedOverdueCharge,
        netOutstanding: Math.max(0, netOutstanding),
        totalPayableWithOverdue: Math.max(0, totalPayableWithOverdue)
      };
    });
  }, [loans, facilities, todayStr]);

  // --- Summary Metrics for Dashboard ---
  const dashboardStats = useMemo(() => {
    const totalSanctioned = facilities.reduce((sum, f) => sum + (f.sanctionedLimit || 0), 0);
    const totalUtilized = processedLoans.reduce((sum, l) => l.status !== 'closed' && l.status !== 'fully_paid' ? sum + (l.financedAmount || 0) : sum, 0);
    const totalOutstanding = processedLoans.reduce((sum, l) => l.status !== 'closed' && l.status !== 'fully_paid' ? sum + (l.netOutstanding || 0) : sum, 0);
    const availableLimit = Math.max(0, totalSanctioned - totalUtilized);

    // By Loan Type Outstanding
    const upasOutstanding = processedLoans.filter(l => l.loanType === 'upas' && l.status !== 'closed' && l.status !== 'fully_paid').reduce((s, l) => s + l.netOutstanding, 0);
    const ltrOutstanding = processedLoans.filter(l => l.loanType === 'ltr' && l.status !== 'closed' && l.status !== 'fully_paid').reduce((s, l) => s + l.netOutstanding, 0);
    const importOutstanding = upasOutstanding + ltrOutstanding;
    const termOutstanding = processedLoans.filter(l => l.loanType === 'term_loan' && l.status !== 'closed' && l.status !== 'fully_paid').reduce((s, l) => s + l.netOutstanding, 0);
    const lcPurchaseOutstanding = processedLoans.filter(l => l.loanType === 'lc_purchase' && l.status !== 'closed' && l.status !== 'fully_paid').reduce((s, l) => s + l.netOutstanding, 0);
    const odOutstanding = processedLoans.filter(l => l.loanType === 'bank_od' && l.status !== 'closed' && l.status !== 'fully_paid').reduce((s, l) => s + l.netOutstanding, 0);

    const totalInterestPayable = processedLoans.reduce((sum, l) => sum + Math.max(0, (l.calculatedInterest || 0) - (l.paidInterest || 0)), 0);
    const totalOverdueAmount = processedLoans.filter(l => l.status === 'overdue').reduce((sum, l) => sum + l.overdueAmount, 0);
    const totalAdditionalOverdueCharges = processedLoans.reduce((sum, l) => sum + l.calculatedOverdueCharge, 0);

    // Due Date Alerts
    const today = new Date(todayStr);
    const dueWithin7Days = processedLoans.filter(l => {
      if (l.status === 'closed' || l.status === 'fully_paid' || !l.maturityDate) return false;
      const m = new Date(l.maturityDate);
      const diff = Math.ceil((m.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diff >= 0 && diff <= 7;
    });

    const dueWithin30Days = processedLoans.filter(l => {
      if (l.status === 'closed' || l.status === 'fully_paid' || !l.maturityDate) return false;
      const m = new Date(l.maturityDate);
      const diff = Math.ceil((m.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diff >= 0 && diff <= 30;
    });

    const overdueLoansList = processedLoans.filter(l => l.status === 'overdue');
    const overdueChargeApplicableList = processedLoans.filter(l => l.calculatedOverdueCharge > 0);

    return {
      totalSanctioned,
      totalUtilized,
      totalOutstanding,
      availableLimit,
      importOutstanding,
      upasOutstanding,
      ltrOutstanding,
      termOutstanding,
      lcPurchaseOutstanding,
      odOutstanding,
      totalInterestPayable,
      totalOverdueAmount,
      totalAdditionalOverdueCharges,
      dueWithin7Days,
      dueWithin30Days,
      overdueLoansList,
      overdueChargeApplicableList
    };
  }, [facilities, processedLoans, todayStr]);

  // --- Modals State ---
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [editingSanction, setEditingSanction] = useState<BankFacilitySanction | null>(null);

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<BankLoanRecord | null>(null);
  const [loanModalType, setLoanModalType] = useState<LoanType>('upas');

  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState<any | null>(null);

  const [viewingLoanDetails, setViewingLoanDetails] = useState<any | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>('all');
  const [loanStatusFilter, setLoanStatusFilter] = useState<string>('all');
  const [facilityFilter, setFacilityFilter] = useState<string>('all');

  // Form State: Sanction Master
  const [sanctBankName, setSanctBankName] = useState('');
  const [sanctFacilityNo, setSanctFacilityNo] = useState('');
  const [sanctBranchName, setSanctBranchName] = useState('');
  const [sanctDate, setSanctDate] = useState(todayStr);
  const [sanctType, setSanctType] = useState<BankFacilityType>('composite');
  const [sanctLimit, setSanctLimit] = useState<number>(0);
  const [sanctCurrency, setSanctCurrency] = useState('BDT');
  const [sanctValidFrom, setSanctValidFrom] = useState(todayStr);
  const [sanctValidTo, setSanctValidTo] = useState('');
  const [sanctInterestRate, setSanctInterestRate] = useState<number>(9.0);
  const [sanctMarginPercent, setSanctMarginPercent] = useState<number>(20.0);
  const [sanctRepaymentTerms, setSanctRepaymentTerms] = useState('');
  const [sanctTenorDays, setSanctTenorDays] = useState<number>(180);
  const [sanctGracePeriodDays, setSanctGracePeriodDays] = useState<number>(0);
  const [sanctSecurity, setSanctSecurity] = useState('');
  const [sanctProcessingCharges, setSanctProcessingCharges] = useState<number>(0);
  const [sanctOverdueRate, setSanctOverdueRate] = useState<number>(1.50); // Default 1.50%
  const [sanctOverdueBasis, setSanctOverdueBasis] = useState<'overdue_principal' | 'overdue_interest' | 'overdue_installment' | 'total_overdue'>('total_overdue');
  const [sanctOverdueFrequency, setSanctOverdueFrequency] = useState<'one_time' | 'per_month' | 'per_annum' | 'per_overdue_period'>('one_time');
  const [sanctGraceDays, setSanctGraceDays] = useState<number>(0);
  const [sanctStatus, setSanctStatus] = useState<'active' | 'expired' | 'suspended'>('active');

  // Open Create Sanction Modal
  const handleOpenNewSanction = () => {
    setEditingSanction(null);
    setSanctBankName('');
    setSanctFacilityNo(`SANCT-${new Date().getFullYear()}-${String(facilities.length + 1).padStart(3, '0')}`);
    setSanctBranchName('');
    setSanctDate(todayStr);
    setSanctType('composite');
    setSanctLimit(10000000);
    setSanctCurrency('BDT');
    setSanctValidFrom(todayStr);
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    setSanctValidTo(oneYearLater.toISOString().split('T')[0]);
    setSanctInterestRate(9.0);
    setSanctMarginPercent(20.0);
    setSanctRepaymentTerms('On maturity date with interest');
    setSanctTenorDays(180);
    setSanctGracePeriodDays(0);
    setSanctSecurity('Factory Land, Building & Machinery Mortgage');
    setSanctProcessingCharges(0);
    setSanctOverdueRate(1.50); // Configurable 1.50%
    setSanctOverdueBasis('total_overdue');
    setSanctOverdueFrequency('one_time');
    setSanctGraceDays(0);
    setSanctStatus('active');
    setIsSanctionModalOpen(true);
  };

  const handleEditSanction = (s: BankFacilitySanction) => {
    setEditingSanction(s);
    setSanctBankName(s.bankName);
    setSanctFacilityNo(s.facilityNo);
    setSanctBranchName(s.branchName || '');
    setSanctDate(s.sanctionDate || todayStr);
    setSanctType(s.facilityType || 'composite');
    setSanctLimit(s.sanctionedLimit || 0);
    setSanctCurrency(s.currency || 'BDT');
    setSanctValidFrom(s.validFrom || todayStr);
    setSanctValidTo(s.validTo || '');
    setSanctInterestRate(s.interestRate || 9.0);
    setSanctMarginPercent(s.marginPercent || 20.0);
    setSanctRepaymentTerms(s.repaymentTerms || '');
    setSanctTenorDays(s.tenorDays || 180);
    setSanctGracePeriodDays(s.gracePeriodDays || 0);
    setSanctSecurity(s.securityCollateral || '');
    setSanctProcessingCharges(s.processingCharges || 0);
    setSanctOverdueRate(s.overdueRate ?? 1.50);
    setSanctOverdueBasis(s.overdueBasis || 'total_overdue');
    setSanctOverdueFrequency(s.overdueFrequency || 'one_time');
    setSanctGraceDays(s.graceDays || 0);
    setSanctStatus(s.status || 'active');
    setIsSanctionModalOpen(true);
  };

  const handleSaveSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanctBankName.trim() || !sanctFacilityNo.trim() || sanctLimit <= 0) {
      showToast('Please provide Bank Name, Facility No and Sanctioned Limit', 'error');
      return;
    }

    try {
      const payload: Partial<BankFacilitySanction> = {
        bankName: sanctBankName.trim(),
        facilityNo: sanctFacilityNo.trim(),
        branchName: sanctBranchName.trim(),
        sanctionDate: sanctDate,
        facilityType: sanctType,
        sanctionedLimit: Number(sanctLimit),
        currency: sanctCurrency,
        validFrom: sanctValidFrom,
        validTo: sanctValidTo,
        interestRate: Number(sanctInterestRate),
        marginPercent: Number(sanctMarginPercent),
        repaymentTerms: sanctRepaymentTerms.trim(),
        tenorDays: Number(sanctTenorDays),
        gracePeriodDays: Number(sanctGracePeriodDays),
        securityCollateral: sanctSecurity.trim(),
        processingCharges: Number(sanctProcessingCharges),
        overdueRate: Number(sanctOverdueRate),
        overdueBasis: sanctOverdueBasis,
        overdueFrequency: sanctOverdueFrequency,
        graceDays: Number(sanctGraceDays),
        status: sanctStatus,
        businessId,
        updatedAt: Timestamp.now()
      };

      if (editingSanction) {
        await updateDoc(doc(db, 'bank_facility_sanctions', editingSanction.id), payload);
        showToast('Bank Facility Sanction updated successfully', 'success');
      } else {
        payload.createdBy = userProfile.email;
        payload.createdAt = Timestamp.now();
        await addDoc(collection(db, 'bank_facility_sanctions'), payload);
        showToast('Bank Facility Sanction created successfully', 'success');
      }
      setIsSanctionModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to save sanction', 'error');
    }
  };

  const handleDeleteSanction = async (id: string, name: string) => {
    if (!canDeleteSanction) {
      showToast('You do not have permission to delete bank facilities', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete sanction "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'bank_facility_sanctions', id));
      showToast('Bank Facility Sanction deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete sanction', 'error');
    }
  };

  // --- Loan Creation State ---
  const [loanFacilityId, setLoanFacilityId] = useState('');
  const [loanNo, setLoanNo] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState<number>(0);
  const [loanMarginPercent, setLoanMarginPercent] = useState<number>(20);
  const [loanInterestRate, setLoanInterestRate] = useState<number>(9.0);
  const [loanStartDate, setLoanStartDate] = useState(todayStr);
  const [loanMaturityDate, setLoanMaturityDate] = useState('');
  const [loanTenorDays, setLoanTenorDays] = useState<number>(180);
  const [loanCurrency, setLoanCurrency] = useState('BDT');
  const [loanOtherCharges, setLoanOtherCharges] = useState<number>(0);
  const [loanRemarks, setLoanRemarks] = useState('');

  // UPAS / LC fields
  const [loanLcNo, setLoanLcNo] = useState('');
  const [loanLcDate, setLoanLcDate] = useState('');
  const [loanSupplierName, setLoanSupplierName] = useState('');

  // LTR fields
  const [loanImportBillNo, setLoanImportBillNo] = useState('');
  const [loanCustomsDocNo, setLoanCustomsDocNo] = useState('');

  // Term Loan fields
  const [loanMachineryName, setLoanMachineryName] = useState('');
  const [loanMachinerySupplier, setLoanMachinerySupplier] = useState('');
  const [loanDownPayment, setLoanDownPayment] = useState<number>(0);
  const [loanInstallmentCount, setLoanInstallmentCount] = useState<number>(12);
  const [loanInstallmentFrequency, setLoanInstallmentFrequency] = useState<'monthly' | 'quarterly' | 'custom'>('monthly');
  const [loanCalculationType, setLoanCalculationType] = useState<'emi' | 'equal_principal' | 'custom'>('equal_principal');

  // Computed Financed Amount & Margin Amount
  const computedMarginAmount = useMemo(() => {
    if (loanModalType === 'term_loan') {
      return Number(loanDownPayment) || 0;
    }
    return (Number(loanPrincipal) || 0) * ((Number(loanMarginPercent) || 0) / 100);
  }, [loanPrincipal, loanMarginPercent, loanModalType, loanDownPayment]);

  const computedFinancedAmount = useMemo(() => {
    return Math.max(0, (Number(loanPrincipal) || 0) - computedMarginAmount);
  }, [loanPrincipal, computedMarginAmount]);

  // Computed Interest Amount (Financed Amount × Rate × Days / 365)
  // Margin amount is EXCLUDED from interest calculation as per requirements!
  const computedInterestAmount = useMemo(() => {
    const days = Number(loanTenorDays) || getDaysDifference(loanStartDate, loanMaturityDate) || 0;
    const rate = Number(loanInterestRate) || 0;
    const financed = computedFinancedAmount;
    if (financed <= 0 || rate <= 0 || days <= 0) return 0;
    return (financed * (rate / 100) * days) / 365;
  }, [computedFinancedAmount, loanInterestRate, loanTenorDays, loanStartDate, loanMaturityDate]);

  // Auto-set maturity date when tenor changes
  const handleTenorChange = (days: number) => {
    setLoanTenorDays(days);
    if (loanStartDate) {
      const d = new Date(loanStartDate);
      d.setDate(d.getDate() + Number(days));
      setLoanMaturityDate(d.toISOString().split('T')[0]);
    }
  };

  const handleStartDateChange = (dateStr: string) => {
    setLoanStartDate(dateStr);
    if (loanTenorDays > 0) {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + Number(loanTenorDays));
      setLoanMaturityDate(d.toISOString().split('T')[0]);
    }
  };

  // Open Create Loan Modal
  const handleOpenCreateLoan = (type: LoanType = 'upas') => {
    setLoanModalType(type);
    setEditingLoan(null);
    const prefix = type.toUpperCase();
    setLoanNo(`LN-${prefix}-${new Date().getFullYear()}-${String(loans.length + 1).padStart(4, '0')}`);
    
    // Pick first matching facility if available
    const defaultFac = facilities.find(f => f.status === 'active') || facilities[0];
    if (defaultFac) {
      setLoanFacilityId(defaultFac.id);
      setLoanInterestRate(defaultFac.interestRate || 9.0);
      setLoanMarginPercent(defaultFac.marginPercent || 20.0);
      setLoanCurrency(defaultFac.currency || 'BDT');
      setLoanTenorDays(defaultFac.tenorDays || 180);
      const d = new Date(todayStr);
      d.setDate(d.getDate() + (defaultFac.tenorDays || 180));
      setLoanMaturityDate(d.toISOString().split('T')[0]);
    } else {
      setLoanFacilityId('');
      setLoanInterestRate(9.0);
      setLoanMarginPercent(20.0);
      setLoanCurrency('BDT');
      setLoanTenorDays(180);
      const d = new Date(todayStr);
      d.setDate(d.getDate() + 180);
      setLoanMaturityDate(d.toISOString().split('T')[0]);
    }

    setLoanPrincipal(1000000);
    setLoanStartDate(todayStr);
    setLoanOtherCharges(0);
    setLoanRemarks('');
    setLoanLcNo('');
    setLoanLcDate(todayStr);
    setLoanSupplierName('');
    setLoanImportBillNo('');
    setLoanCustomsDocNo('');
    setLoanMachineryName('');
    setLoanMachinerySupplier('');
    setLoanDownPayment(200000);
    setLoanInstallmentCount(12);
    setLoanInstallmentFrequency('monthly');
    setLoanCalculationType('equal_principal');

    setIsLoanModalOpen(true);
  };

  // Auto-generate Term Loan Repayment Schedule
  const generateTermLoanSchedule = (
    financedAmount: number,
    rate: number,
    installments: number,
    firstDateStr: string,
    calcType: 'emi' | 'equal_principal' | 'custom'
  ): LoanInstallmentScheduleItem[] => {
    const schedule: LoanInstallmentScheduleItem[] = [];
    let currentBalance = financedAmount;
    const monthlyRate = (rate / 100) / 12;

    let fixedEmi = 0;
    if (calcType === 'emi' && monthlyRate > 0) {
      fixedEmi = (financedAmount * monthlyRate * Math.pow(1 + monthlyRate, installments)) / (Math.pow(1 + monthlyRate, installments) - 1);
    }

    const principalPerInst = financedAmount / installments;

    for (let i = 1; i <= installments; i++) {
      const d = new Date(firstDateStr || todayStr);
      d.setMonth(d.getMonth() + (i - 1));
      const dueDateStr = d.toISOString().split('T')[0];

      let instPrincipal = 0;
      let instInterest = 0;

      if (calcType === 'emi') {
        instInterest = currentBalance * monthlyRate;
        instPrincipal = fixedEmi - instInterest;
      } else {
        instPrincipal = principalPerInst;
        instInterest = currentBalance * monthlyRate;
      }

      const totalInstAmount = instPrincipal + instInterest;
      currentBalance = Math.max(0, currentBalance - instPrincipal);

      schedule.push({
        installmentNo: i,
        dueDate: dueDateStr,
        principalAmount: Math.round(instPrincipal),
        interestAmount: Math.round(instInterest),
        totalAmount: Math.round(totalInstAmount),
        paidAmount: 0,
        balanceAmount: Math.round(totalInstAmount),
        status: 'upcoming',
        overdueDays: 0,
        overdueCharge: 0
      });
    }

    return schedule;
  };

  // Save Loan Record
  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanNo.trim() || loanPrincipal <= 0) {
      showToast('Please enter Loan ID and valid Amount', 'error');
      return;
    }

    const selectedFacility = facilities.find(f => f.id === loanFacilityId);
    if (!selectedFacility) {
      showToast('Please select a Bank Facility / Sanction', 'error');
      return;
    }

    try {
      const marginAmt = computedMarginAmount;
      const financedAmt = computedFinancedAmount;
      const interestAmt = computedInterestAmount;
      const totalPayable = financedAmt + interestAmt + Number(loanOtherCharges);

      let repaymentSchedule: LoanInstallmentScheduleItem[] | undefined = undefined;
      if (loanModalType === 'term_loan') {
        repaymentSchedule = generateTermLoanSchedule(
          financedAmt,
          Number(loanInterestRate),
          Number(loanInstallmentCount),
          loanStartDate,
          loanCalculationType
        );
      }

      const payload: Partial<BankLoanRecord> = {
        loanNo: loanNo.trim(),
        facilityId: selectedFacility.id,
        facilityNo: selectedFacility.facilityNo,
        bankName: selectedFacility.bankName,
        loanType: loanModalType,
        currency: loanCurrency,
        principalAmount: Number(loanPrincipal),
        marginPercent: Number(loanMarginPercent),
        marginAmount: marginAmt,
        financedAmount: financedAmt,
        interestRate: Number(loanInterestRate),
        interestStartDate: loanStartDate,
        maturityDate: loanMaturityDate,
        tenorDays: Number(loanTenorDays),
        calculatedInterest: interestAmt,
        otherCharges: Number(loanOtherCharges),
        totalPayable: totalPayable,
        
        paidPrincipal: 0,
        paidInterest: 0,
        paidOtherCharges: 0,
        paidOverdueCharges: 0,
        totalPaidAmount: 0,
        
        outstandingPrincipal: financedAmt,
        outstandingInterest: interestAmt,
        outstandingOverdueCharge: 0,
        netOutstanding: totalPayable,
        
        status: 'upcoming',
        overdueDays: 0,
        overdueAmount: 0,
        overdueChargeRate: selectedFacility.overdueRate || 1.50,
        calculatedOverdueCharge: 0,
        
        // Specific fields
        lcNumber: loanLcNo.trim() || undefined,
        lcDate: loanLcDate || undefined,
        supplierName: loanSupplierName.trim() || undefined,
        importBillNo: loanImportBillNo.trim() || undefined,
        customsDocNo: loanCustomsDocNo.trim() || undefined,
        machineryName: loanMachineryName.trim() || undefined,
        machinerySupplier: loanMachinerySupplier.trim() || undefined,
        downPayment: Number(loanDownPayment) || undefined,
        installmentCount: Number(loanInstallmentCount) || undefined,
        installmentFrequency: loanInstallmentFrequency,
        installmentCalculationType: loanCalculationType,
        repaymentSchedule,
        
        remarks: loanRemarks.trim() || undefined,
        businessId,
        updatedAt: Timestamp.now()
      };

      if (editingLoan) {
        await updateDoc(doc(db, 'bank_loans', editingLoan.id), payload);
        showToast('Bank Loan updated successfully', 'success');
      } else {
        payload.createdBy = userProfile.email;
        payload.createdAt = Timestamp.now();
        const docRef = await addDoc(collection(db, 'bank_loans'), payload);

        // Automatic Accounting GL Posting for Loan Disbursement
        const voucherNo = `JV-LOAN-${new Date().getFullYear()}-${String(glVouchers.length + 1).padStart(4, '0')}`;
        await addDoc(collection(db, 'bank_loan_gl_vouchers'), {
          voucherNo,
          postingDate: loanStartDate,
          voucherType: 'loan_disbursement',
          loanId: docRef.id,
          loanNo: loanNo.trim(),
          debitAccount: `Bank Account (${selectedFacility.bankName})`,
          debitAccountCode: '1010-BANK',
          creditAccount: `Bank Loan Liability (${selectedFacility.bankName} - ${loanModalType.toUpperCase()})`,
          creditAccountCode: '2010-LOAN-LIAB',
          amount: financedAmt,
          currency: loanCurrency,
          reference: loanLcNo || loanNo.trim(),
          narration: `Bank finance disbursement for ${loanModalType.toUpperCase()} under ${selectedFacility.facilityNo}`,
          businessId,
          createdBy: userProfile.email,
          createdAt: Timestamp.now()
        });

        showToast('Bank Loan created & GL Voucher posted successfully', 'success');
      }

      setIsLoanModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to save loan', 'error');
    }
  };

  const handleDeleteLoan = async (id: string, lNo: string) => {
    if (!canDeleteLoan) {
      showToast('You do not have permission to delete loans', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete loan "${lNo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'bank_loans', id));
      showToast('Bank Loan deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete loan', 'error');
    }
  };

  // --- Repayment Modal State ---
  const [repPaymentDate, setRepPaymentDate] = useState(todayStr);
  const [repAmount, setRepAmount] = useState<number>(0);
  const [repPaymentMethod, setRepPaymentMethod] = useState('bank_transfer');
  const [repBankName, setRepBankName] = useState('');
  const [repReference, setRepReference] = useState('');
  const [repRemarks, setRepRemarks] = useState('');
  const [repPriority, setRepPriority] = useState<'standard' | 'principal_first'>('standard');

  const handleOpenRepayment = (loan: any) => {
    setSelectedLoanForRepayment(loan);
    setRepPaymentDate(todayStr);
    setRepAmount(loan.totalPayableWithOverdue || loan.netOutstanding || 0);
    setRepPaymentMethod('bank_transfer');
    setRepBankName(loan.bankName || 'Eastern Bank PLC');
    setRepReference(`PAY-REF-${Date.now().toString().slice(-6)}`);
    setRepRemarks(`Loan settlement for ${loan.loanNo}`);
    setRepPriority('standard');
    setIsRepaymentModalOpen(true);
  };

  // Automated Payment Priority Allocation
  // Standard Priority: Overdue Charge → Other Charges → Interest → Principal
  const computedAllocation = useMemo(() => {
    if (!selectedLoanForRepayment) return { overdue: 0, other: 0, interest: 0, principal: 0, remaining: 0 };
    const paid = Number(repAmount) || 0;
    const overdueChargeDue = selectedLoanForRepayment.calculatedOverdueCharge || 0;
    const otherChargesDue = (selectedLoanForRepayment.otherCharges || 0) - (selectedLoanForRepayment.paidOtherCharges || 0);
    const interestDue = (selectedLoanForRepayment.calculatedInterest || 0) - (selectedLoanForRepayment.paidInterest || 0);
    const principalDue = (selectedLoanForRepayment.financedAmount || 0) - (selectedLoanForRepayment.paidPrincipal || 0);

    let remainingPay = paid;
    let allocOverdue = 0;
    let allocOther = 0;
    let allocInterest = 0;
    let allocPrincipal = 0;

    if (repPriority === 'standard') {
      // 1. Overdue charge first
      allocOverdue = Math.min(remainingPay, overdueChargeDue);
      remainingPay -= allocOverdue;

      // 2. Other charges
      allocOther = Math.min(remainingPay, Math.max(0, otherChargesDue));
      remainingPay -= allocOther;

      // 3. Interest
      allocInterest = Math.min(remainingPay, Math.max(0, interestDue));
      remainingPay -= allocInterest;

      // 4. Principal
      allocPrincipal = Math.min(remainingPay, Math.max(0, principalDue));
      remainingPay -= allocPrincipal;
    } else {
      // Principal first
      allocPrincipal = Math.min(remainingPay, Math.max(0, principalDue));
      remainingPay -= allocPrincipal;

      allocInterest = Math.min(remainingPay, Math.max(0, interestDue));
      remainingPay -= allocInterest;

      allocOther = Math.min(remainingPay, Math.max(0, otherChargesDue));
      remainingPay -= allocOther;

      allocOverdue = Math.min(remainingPay, overdueChargeDue);
      remainingPay -= allocOverdue;
    }

    const totalDueBefore = overdueChargeDue + Math.max(0, otherChargesDue) + Math.max(0, interestDue) + Math.max(0, principalDue);
    const remainingOutstanding = Math.max(0, totalDueBefore - paid);

    return {
      overdue: allocOverdue,
      other: allocOther,
      interest: allocInterest,
      principal: allocPrincipal,
      remaining: remainingOutstanding
    };
  }, [selectedLoanForRepayment, repAmount, repPriority]);

  const handleSaveRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForRepayment || repAmount <= 0) {
      showToast('Please enter a valid repayment amount', 'error');
      return;
    }

    try {
      const repNo = `REP-${new Date().getFullYear()}-${String(repayments.length + 1).padStart(4, '0')}`;
      const voucherNo = `JV-PAY-${new Date().getFullYear()}-${String(glVouchers.length + 1).padStart(4, '0')}`;

      const repaymentPayload: Partial<LoanRepaymentRecord> = {
        repaymentNo: repNo,
        loanId: selectedLoanForRepayment.id,
        loanNo: selectedLoanForRepayment.loanNo,
        loanType: selectedLoanForRepayment.loanType,
        bankName: selectedLoanForRepayment.bankName,
        facilityId: selectedLoanForRepayment.facilityId,
        paymentDate: repPaymentDate,
        originalDueAmount: selectedLoanForRepayment.netOutstanding || 0,
        overdueDays: selectedLoanForRepayment.overdueDays || 0,
        overdueAmount: selectedLoanForRepayment.overdueAmount || 0,
        overdueChargeRate: selectedLoanForRepayment.overdueChargeRate || 1.50,
        additionalOverdueCharge: selectedLoanForRepayment.calculatedOverdueCharge || 0,
        totalPayable: selectedLoanForRepayment.totalPayableWithOverdue || selectedLoanForRepayment.netOutstanding || 0,
        amountPaid: Number(repAmount),
        allocatedOverdueCharge: computedAllocation.overdue,
        allocatedOtherCharges: computedAllocation.other,
        allocatedInterest: computedAllocation.interest,
        allocatedPrincipal: computedAllocation.principal,
        remainingOutstanding: computedAllocation.remaining,
        paymentMethod: repPaymentMethod,
        bankAccountName: repBankName,
        paymentReference: repReference.trim(),
        voucherNo,
        glPosted: true,
        remarks: repRemarks.trim(),
        businessId,
        createdBy: userProfile.email,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'bank_loan_repayments'), repaymentPayload);

      // Update Loan Outstanding & Status
      const newPaidPrincipal = (selectedLoanForRepayment.paidPrincipal || 0) + computedAllocation.principal;
      const newPaidInterest = (selectedLoanForRepayment.paidInterest || 0) + computedAllocation.interest;
      const newPaidOther = (selectedLoanForRepayment.paidOtherCharges || 0) + computedAllocation.other;
      const newPaidOverdue = (selectedLoanForRepayment.paidOverdueCharges || 0) + computedAllocation.overdue;
      const newTotalPaid = (selectedLoanForRepayment.totalPaidAmount || 0) + Number(repAmount);

      const remainingPrincipal = Math.max(0, (selectedLoanForRepayment.financedAmount || 0) - newPaidPrincipal);
      const remainingInterest = Math.max(0, (selectedLoanForRepayment.calculatedInterest || 0) - newPaidInterest);
      const newNetOutstanding = remainingPrincipal + remainingInterest;

      let newStatus = selectedLoanForRepayment.status;
      if (newNetOutstanding <= 0) {
        newStatus = 'fully_paid';
      } else {
        newStatus = 'partially_paid';
      }

      await updateDoc(doc(db, 'bank_loans', selectedLoanForRepayment.id), {
        paidPrincipal: newPaidPrincipal,
        paidInterest: newPaidInterest,
        paidOtherCharges: newPaidOther,
        paidOverdueCharges: newPaidOverdue,
        totalPaidAmount: newTotalPaid,
        outstandingPrincipal: remainingPrincipal,
        outstandingInterest: remainingInterest,
        netOutstanding: newNetOutstanding,
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      // Post GL Journal Voucher
      await addDoc(collection(db, 'bank_loan_gl_vouchers'), {
        voucherNo,
        postingDate: repPaymentDate,
        voucherType: 'loan_repayment',
        loanId: selectedLoanForRepayment.id,
        loanNo: selectedLoanForRepayment.loanNo,
        debitAccount: `Bank Loan Liability / Interest / Charges (${selectedLoanForRepayment.bankName})`,
        debitAccountCode: '2010-LOAN-SETTLE',
        creditAccount: `Bank Account (${repBankName || selectedLoanForRepayment.bankName})`,
        creditAccountCode: '1010-BANK',
        amount: Number(repAmount),
        currency: selectedLoanForRepayment.currency || 'BDT',
        reference: repReference || repNo,
        narration: `Repayment for ${selectedLoanForRepayment.loanNo}: Principal=${computedAllocation.principal}, Interest=${computedAllocation.interest}, Overdue Charge=${computedAllocation.overdue}`,
        businessId,
        createdBy: userProfile.email,
        createdAt: Timestamp.now()
      });

      showToast(`Repayment of ${formatMoney(repAmount, selectedLoanForRepayment.currency)} recorded successfully`, 'success');
      setIsRepaymentModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to record repayment', 'error');
    }
  };

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return processedLoans.filter(l => {
      if (loanTypeFilter !== 'all' && l.loanType !== loanTypeFilter) return false;
      if (loanStatusFilter !== 'all' && l.status !== loanStatusFilter) return false;
      if (facilityFilter !== 'all' && l.facilityId !== facilityFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const str = `${l.loanNo} ${l.bankName} ${l.facilityNo} ${l.lcNumber || ''} ${l.machineryName || ''} ${l.supplierName || ''}`.toLowerCase();
        return str.includes(q);
      }
      return true;
    });
  }, [processedLoans, loanTypeFilter, loanStatusFilter, facilityFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-900 text-white rounded-2xl p-6 shadow-xl border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Bank Loan & Finance Management
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  ERP Finance
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Bank Sanction Limits, UPAS, LTR, Term Loans, LC Purchase, OD & Dynamic Overdue Calculations
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canCreateSanction && canAccessSanctions && (
            <button
              type="button"
              onClick={handleOpenNewSanction}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl border border-neutral-700 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>New Sanction Master</span>
            </button>
          )}

          {canCreateLoan && canAccessLoans && (
            <button
              type="button"
              onClick={() => handleOpenCreateLoan('upas')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create Bank Loan</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto pb-1">
        {canAccessDashboard && (
          <button
            type="button"
            onClick={() => handleTabChange('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Loan Dashboard & Alerts</span>
            {dashboardStats.overdueLoansList.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ml-1">
                {dashboardStats.overdueLoansList.length} Overdue
              </span>
            )}
          </button>
        )}

        {canAccessSanctions && (
          <button
            type="button"
            onClick={() => handleTabChange('sanctions')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'sanctions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Sanction Master ({facilities.length})</span>
          </button>
        )}

        {canAccessLoans && (
          <button
            type="button"
            onClick={() => handleTabChange('loans')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'loans'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Active Loans & Facilities ({loans.length})</span>
          </button>
        )}

        {canAccessRepayments && (
          <button
            type="button"
            onClick={() => handleTabChange('repayments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'repayments'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Repayment Register ({repayments.length})</span>
          </button>
        )}

        {canAccessGlVouchers && (
          <button
            type="button"
            onClick={() => handleTabChange('gl_vouchers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'gl_vouchers'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Accounting GL Vouchers ({glVouchers.length})</span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. DASHBOARD VIEW & MONITORING ALERTS */}
      {/* ======================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Sanctioned Limit</span>
              <div className="text-xl font-black text-neutral-900 mt-1">
                {formatMoney(dashboardStats.totalSanctioned, 'BDT')}
              </div>
              <div className="mt-2 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <span>Available Limit: {formatMoney(dashboardStats.availableLimit, 'BDT')}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Net Outstanding</span>
              <div className="text-xl font-black text-indigo-600 mt-1">
                {formatMoney(dashboardStats.totalOutstanding, 'BDT')}
              </div>
              <div className="mt-2 text-[11px] text-neutral-500 font-medium">
                Utilized: {formatMoney(dashboardStats.totalUtilized, 'BDT')}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Overdue Principal/Int</span>
              <div className="text-xl font-black text-red-600 mt-1">
                {formatMoney(dashboardStats.totalOverdueAmount, 'BDT')}
              </div>
              <div className="mt-2 text-[11px] text-red-700 font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{dashboardStats.overdueLoansList.length} Overdue Loans</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Additional Overdue Charges (1.5%)</span>
              <div className="text-xl font-black text-amber-900 mt-1">
                {formatMoney(dashboardStats.totalAdditionalOverdueCharges, 'BDT')}
              </div>
              <div className="mt-2 text-[11px] text-amber-700 font-semibold">
                Auto-calculated delayed payment charges
              </div>
            </div>
          </div>

          {/* Breakdown By Loan Facility Type */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-neutral-200 text-center">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">UPAS (Import)</p>
              <p className="text-sm font-black text-neutral-900 mt-0.5">{formatMoney(dashboardStats.upasOutstanding, 'BDT')}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-neutral-200 text-center">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">LTR (Import)</p>
              <p className="text-sm font-black text-neutral-900 mt-0.5">{formatMoney(dashboardStats.ltrOutstanding, 'BDT')}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-neutral-200 text-center">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Term Loan (Machinery)</p>
              <p className="text-sm font-black text-neutral-900 mt-0.5">{formatMoney(dashboardStats.termOutstanding, 'BDT')}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-neutral-200 text-center">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">LC Purchase Loan</p>
              <p className="text-sm font-black text-neutral-900 mt-0.5">{formatMoney(dashboardStats.lcPurchaseOutstanding, 'BDT')}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-neutral-200 text-center">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Bank OD</p>
              <p className="text-sm font-black text-neutral-900 mt-0.5">{formatMoney(dashboardStats.odOutstanding, 'BDT')}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-neutral-200 text-center">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Interest Payable</p>
              <p className="text-sm font-black text-indigo-600 mt-0.5">{formatMoney(dashboardStats.totalInterestPayable, 'BDT')}</p>
            </div>
          </div>

          {/* Daily Due Date Monitoring Alert Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Due within 7 Days */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Due Within 7 Days
                </span>
                <span className="text-xs font-black px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">
                  {dashboardStats.dueWithin7Days.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {dashboardStats.dueWithin7Days.length === 0 ? (
                  <p className="text-[11px] text-amber-700 italic">No loans due within 7 days.</p>
                ) : (
                  dashboardStats.dueWithin7Days.map(l => (
                    <div key={l.id} className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-neutral-900">{l.loanNo}</p>
                        <p className="text-[10px] text-neutral-500">{l.bankName} • Due: {l.maturityDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-900">{formatMoney(l.netOutstanding, l.currency)}</p>
                        <button
                          type="button"
                          onClick={() => handleOpenRepayment(l)}
                          className="text-[10px] text-indigo-600 font-bold hover:underline"
                        >
                          Pay Now
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Due within 30 Days */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Due Within 30 Days
                </span>
                <span className="text-xs font-black px-2 py-0.5 bg-blue-200 text-blue-900 rounded-full">
                  {dashboardStats.dueWithin30Days.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {dashboardStats.dueWithin30Days.length === 0 ? (
                  <p className="text-[11px] text-blue-700 italic">No loans due within 30 days.</p>
                ) : (
                  dashboardStats.dueWithin30Days.map(l => (
                    <div key={l.id} className="bg-white p-2.5 rounded-xl border border-blue-200 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-neutral-900">{l.loanNo}</p>
                        <p className="text-[10px] text-neutral-500">{l.bankName} • Due: {l.maturityDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-900">{formatMoney(l.netOutstanding, l.currency)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Overdue Loans */}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Overdue Loans
                </span>
                <span className="text-xs font-black px-2 py-0.5 bg-red-200 text-red-900 rounded-full">
                  {dashboardStats.overdueLoansList.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {dashboardStats.overdueLoansList.length === 0 ? (
                  <p className="text-[11px] text-red-700 italic">No overdue loans! All payments up to date.</p>
                ) : (
                  dashboardStats.overdueLoansList.map(l => (
                    <div key={l.id} className="bg-white p-2.5 rounded-xl border border-red-200 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-red-900">{l.loanNo}</p>
                        <p className="text-[10px] text-red-600">{l.overdueDays} Days Late</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-900">{formatMoney(l.netOutstanding, l.currency)}</p>
                        <button
                          type="button"
                          onClick={() => handleOpenRepayment(l)}
                          className="text-[10px] text-indigo-600 font-bold hover:underline"
                        >
                          Settle Now
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Overdue Charge Applicable */}
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-purple-600" />
                  Overdue Charge Applied
                </span>
                <span className="text-xs font-black px-2 py-0.5 bg-purple-200 text-purple-900 rounded-full">
                  {dashboardStats.overdueChargeApplicableList.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {dashboardStats.overdueChargeApplicableList.length === 0 ? (
                  <p className="text-[11px] text-purple-700 italic">No additional overdue charges active.</p>
                ) : (
                  dashboardStats.overdueChargeApplicableList.map(l => (
                    <div key={l.id} className="bg-white p-2.5 rounded-xl border border-purple-200 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-neutral-900">{l.loanNo}</p>
                        <p className="text-[10px] text-purple-700">+{l.overdueChargeRate}% on {formatMoney(l.overdueAmount, l.currency)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-900">+{formatMoney(l.calculatedOverdueCharge, l.currency)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SANCTION MASTER VIEW */}
      {/* ======================================================== */}
      {activeTab === 'sanctions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Bank Facility / Sanction Master</h2>
              <p className="text-xs text-neutral-500">Configure bank limits, interest rates, and configurable overdue penalty rules</p>
            </div>
            {canCreateSanction && (
              <button
                type="button"
                onClick={handleOpenNewSanction}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bank Sanction</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilities.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-neutral-900 text-base">{s.bankName}</h3>
                    <p className="text-xs font-bold text-indigo-600">{s.facilityNo}</p>
                    {s.branchName && <p className="text-[11px] text-neutral-400">{s.branchName}</p>}
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {s.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-neutral-100">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold">Sanction Limit</span>
                    <p className="font-black text-neutral-900">{formatMoney(s.sanctionedLimit, s.currency)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold">Interest Rate</span>
                    <p className="font-bold text-neutral-800">{s.interestRate}% p.a.</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold">Margin Required</span>
                    <p className="font-bold text-neutral-800">{s.marginPercent}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold">Validity</span>
                    <p className="font-medium text-neutral-700">{s.validTo || 'N/A'}</p>
                  </div>
                </div>

                {/* Overdue Rules Box */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-xs">
                  <div className="flex items-center justify-between text-amber-900 font-bold text-[11px]">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-amber-700" />
                      Overdue Additional Charge:
                    </span>
                    <span className="bg-amber-200 px-1.5 py-0.5 rounded font-black">{s.overdueRate ?? 1.50}%</span>
                  </div>
                  <p className="text-[10px] text-amber-700 mt-1">
                    Basis: {s.overdueBasis?.replace(/_/g, ' ')} • Frequency: {s.overdueFrequency?.replace(/_/g, ' ')}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                  {canEditSanction && (
                    <button
                      type="button"
                      onClick={() => handleEditSanction(s)}
                      className="p-1.5 text-neutral-500 hover:text-indigo-600 rounded-lg hover:bg-neutral-100 text-xs flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                  {canDeleteSanction && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSanction(s.id, s.facilityNo)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ACTIVE LOANS VIEW & REPAYMENT */}
      {/* ======================================================== */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by Loan ID, LC No, Bank, Supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <select
                value={loanTypeFilter}
                onChange={(e) => setLoanTypeFilter(e.target.value)}
                className="px-3 py-2 border border-neutral-200 rounded-xl text-xs bg-white text-neutral-700 font-bold"
              >
                <option value="all">All Loan Types</option>
                <option value="upas">UPAS (Import)</option>
                <option value="ltr">LTR (Import)</option>
                <option value="term_loan">Term Loan</option>
                <option value="lc_purchase">LC Purchase</option>
                <option value="bank_od">Bank OD</option>
              </select>

              <select
                value={loanStatusFilter}
                onChange={(e) => setLoanStatusFilter(e.target.value)}
                className="px-3 py-2 border border-neutral-200 rounded-xl text-xs bg-white text-neutral-700 font-bold"
              >
                <option value="all">All Statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="due">Due</option>
                <option value="overdue">Overdue</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="fully_paid">Fully Paid</option>
              </select>

              {canCreateLoan && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateLoan('upas')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Loan</span>
                </button>
              )}
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Loan ID & Bank</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Principal / LC</th>
                    <th className="p-3 text-right">Financed Amt</th>
                    <th className="p-3 text-right">Interest</th>
                    <th className="p-3">Maturity Date</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Overdue Charge</th>
                    <th className="p-3 text-right">Net Outstanding</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-neutral-400 italic">
                        No bank loan records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map(l => (
                      <tr key={l.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-neutral-900">{l.loanNo}</p>
                          <p className="text-[11px] text-neutral-500">{l.bankName}</p>
                          {l.lcNumber && <p className="text-[10px] text-indigo-600">LC: {l.lcNumber}</p>}
                        </td>
                        <td className="p-3">
                          <span className="font-bold uppercase text-[10px] px-2 py-0.5 bg-neutral-100 rounded-md">
                            {l.loanType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatMoney(l.principalAmount, l.currency)}
                          <p className="text-[10px] text-neutral-400">Margin: {l.marginPercent}%</p>
                        </td>
                        <td className="p-3 text-right font-bold text-neutral-900">
                          {formatMoney(l.financedAmount, l.currency)}
                        </td>
                        <td className="p-3 text-right font-medium text-neutral-700">
                          {formatMoney(l.calculatedInterest, l.currency)}
                          <p className="text-[10px] text-neutral-400">{l.interestRate}%</p>
                        </td>
                        <td className="p-3 font-medium">
                          {l.maturityDate}
                          {l.overdueDays > 0 && (
                            <p className="text-[10px] text-red-600 font-bold">{l.overdueDays} days overdue</p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            l.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            l.status === 'due' || l.status === 'due_today' ? 'bg-amber-100 text-amber-800' :
                            l.status === 'fully_paid' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {l.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-red-600">
                          {l.calculatedOverdueCharge > 0 ? (
                            <>
                              +{formatMoney(l.calculatedOverdueCharge, l.currency)}
                              <p className="text-[9px] text-neutral-400">Rate: {l.overdueChargeRate}%</p>
                            </>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-neutral-900">
                          {formatMoney(l.netOutstanding, l.currency)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canCreateRepayment && l.status !== 'fully_paid' && (
                              <button
                                type="button"
                                onClick={() => handleOpenRepayment(l)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm"
                              >
                                Repay
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewingLoanDetails(l)}
                              className="p-1.5 text-neutral-500 hover:text-indigo-600 rounded-lg hover:bg-neutral-100"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canDeleteLoan && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLoan(l.id, l.loanNo)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. REPAYMENT REGISTER VIEW */}
      {/* ======================================================== */}
      {activeTab === 'repayments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900">Loan Repayments & Settlement History</h2>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Voucher / Rep No</th>
                    <th className="p-3">Payment Date</th>
                    <th className="p-3">Loan ID</th>
                    <th className="p-3">Bank</th>
                    <th className="p-3 text-right">Amount Paid</th>
                    <th className="p-3 text-right">Principal</th>
                    <th className="p-3 text-right">Interest</th>
                    <th className="p-3 text-right">Overdue Charge</th>
                    <th className="p-3 text-right">Remaining Bal</th>
                    <th className="p-3">Method & Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {repayments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-neutral-400 italic">
                        No loan repayment records posted yet.
                      </td>
                    </tr>
                  ) : (
                    repayments.map(r => (
                      <tr key={r.id} className="hover:bg-neutral-50/80">
                        <td className="p-3">
                          <p className="font-bold text-indigo-600">{r.repaymentNo}</p>
                          <p className="text-[10px] text-neutral-400">{r.voucherNo}</p>
                        </td>
                        <td className="p-3 font-medium text-neutral-800">{r.paymentDate}</td>
                        <td className="p-3 font-bold text-neutral-900">{r.loanNo}</td>
                        <td className="p-3 text-neutral-700">{r.bankName}</td>
                        <td className="p-3 text-right font-black text-emerald-600">{formatMoney(r.amountPaid)}</td>
                        <td className="p-3 text-right font-medium">{formatMoney(r.allocatedPrincipal)}</td>
                        <td className="p-3 text-right font-medium">{formatMoney(r.allocatedInterest)}</td>
                        <td className="p-3 text-right font-medium text-amber-700">
                          {r.allocatedOverdueCharge > 0 ? formatMoney(r.allocatedOverdueCharge) : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-neutral-900">{formatMoney(r.remainingOutstanding)}</td>
                        <td className="p-3 text-[11px] text-neutral-500">
                          {r.paymentMethod} • {r.paymentReference}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ACCOUNTING GL VOUCHERS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'gl_vouchers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900">General Ledger Journal Vouchers (Automated Loan Posting)</h2>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Voucher No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Debit Account</th>
                    <th className="p-3">Credit Account</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Reference & Narration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {glVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-400 italic">
                        No accounting GL vouchers found.
                      </td>
                    </tr>
                  ) : (
                    glVouchers.map(v => (
                      <tr key={v.id} className="hover:bg-neutral-50/80">
                        <td className="p-3 font-bold text-indigo-600">{v.voucherNo}</td>
                        <td className="p-3 font-medium text-neutral-800">{v.postingDate}</td>
                        <td className="p-3">
                          <span className="font-bold text-[10px] uppercase px-2 py-0.5 bg-neutral-100 rounded">
                            {v.voucherType?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-neutral-900">{v.debitAccount}</td>
                        <td className="p-3 font-medium text-neutral-900">{v.creditAccount}</td>
                        <td className="p-3 text-right font-black text-neutral-900">{formatMoney(v.amount, v.currency)}</td>
                        <td className="p-3 text-[11px] text-neutral-600">
                          <span className="font-semibold text-neutral-800">Ref: {v.reference}</span>
                          <p className="text-[10px] text-neutral-500">{v.narration}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT SANCTION MASTER */}
      {/* ======================================================== */}
      {isSanctionModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-black text-neutral-900 text-base">
                {editingSanction ? 'Edit Bank Facility Sanction' : 'New Bank Facility / Sanction Master'}
              </h3>
              <button onClick={() => setIsSanctionModalOpen(false)} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSanction} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Bank Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Eastern Bank PLC, Dutch-Bangla Bank"
                    value={sanctBankName}
                    onChange={(e) => setSanctBankName(e.target.value)}
                    className="w-full mt-1 p-2.5 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Facility / Sanction No *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SANCT-EBL-2026-001"
                    value={sanctFacilityNo}
                    onChange={(e) => setSanctFacilityNo(e.target.value)}
                    className="w-full mt-1 p-2.5 border border-neutral-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Sanction Date</label>
                  <input
                    type="date"
                    value={sanctDate}
                    onChange={(e) => setSanctDate(e.target.value)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Facility Type</label>
                  <select
                    value={sanctType}
                    onChange={(e) => setSanctType(e.target.value as any)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl bg-white font-bold"
                  >
                    <option value="composite">Composite Facility</option>
                    <option value="import_loan">Import Loan</option>
                    <option value="upas">UPAS</option>
                    <option value="ltr">LTR</option>
                    <option value="term_loan">Term Loan (Machinery)</option>
                    <option value="lc_purchase">LC Purchase Loan</option>
                    <option value="bank_od">Bank Overdraft (OD)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Sanctioned Limit *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={sanctLimit}
                    onChange={(e) => setSanctLimit(Number(e.target.value))}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl font-black text-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sanctInterestRate}
                    onChange={(e) => setSanctInterestRate(Number(e.target.value))}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Margin %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sanctMarginPercent}
                    onChange={(e) => setSanctMarginPercent(Number(e.target.value))}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Currency</label>
                  <select
                    value={sanctCurrency}
                    onChange={(e) => setSanctCurrency(e.target.value)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl bg-white font-bold"
                  >
                    <option value="BDT">BDT (৳)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Valid From</label>
                  <input
                    type="date"
                    value={sanctValidFrom}
                    onChange={(e) => setSanctValidFrom(e.target.value)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Valid To / Expiry Date</label>
                  <input
                    type="date"
                    value={sanctValidTo}
                    onChange={(e) => setSanctValidTo(e.target.value)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl"
                  />
                </div>
              </div>

              {/* OVERDUE RULE CONFIGURATION (Requirement: 1.50% default configurable) */}
              <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-300 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <Percent className="w-4 h-4 text-amber-700" />
                  <span>Overdue / Delayed Payment Rule Configuration</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Configure additional overdue charges applicable if loan payment is delayed past maturity date.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-amber-900 uppercase text-[10px]">Additional Overdue Rate (%) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={sanctOverdueRate}
                      onChange={(e) => setSanctOverdueRate(Number(e.target.value))}
                      className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl font-black text-amber-900"
                    />
                    <span className="text-[9px] text-amber-700">Default 1.50% (Configurable)</span>
                  </div>

                  <div>
                    <label className="font-bold text-amber-900 uppercase text-[10px]">Charge Applicable On</label>
                    <select
                      value={sanctOverdueBasis}
                      onChange={(e) => setSanctOverdueBasis(e.target.value as any)}
                      className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl font-bold text-neutral-800"
                    >
                      <option value="total_overdue">Total Overdue Amount</option>
                      <option value="overdue_principal">Overdue Principal</option>
                      <option value="overdue_interest">Overdue Interest</option>
                      <option value="overdue_installment">Overdue Installment</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-amber-900 uppercase text-[10px]">Charge Frequency / Type</label>
                    <select
                      value={sanctOverdueFrequency}
                      onChange={(e) => setSanctOverdueFrequency(e.target.value as any)}
                      className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl font-bold text-neutral-800"
                    >
                      <option value="one_time">One Time</option>
                      <option value="per_month">Per Month</option>
                      <option value="per_annum">Per Annum</option>
                      <option value="per_overdue_period">Per Overdue Period</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-amber-900 uppercase text-[10px]">Grace Days</label>
                    <input
                      type="number"
                      min="0"
                      value={sanctGraceDays}
                      onChange={(e) => setSanctGraceDays(Number(e.target.value))}
                      className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-amber-900 uppercase text-[10px]">Status</label>
                    <select
                      value={sanctStatus}
                      onChange={(e) => setSanctStatus(e.target.value as any)}
                      className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl font-bold"
                    >
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsSanctionModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-xl text-neutral-700 font-bold hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Save Sanction Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE BANK LOAN (UPAS / LTR / TERM LOAN / LC PURCHASE / OD) */}
      {/* ======================================================== */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-neutral-200 text-xs space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="font-black text-neutral-900 text-base">
                  Create Bank Loan / Finance Entry
                </h3>
                <p className="text-neutral-500 text-[11px]">Select facility, enter loan details and calculate financing</p>
              </div>
              <button onClick={() => setIsLoanModalOpen(false)} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loan Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['upas', 'ltr', 'term_loan', 'lc_purchase', 'bank_od'] as LoanType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setLoanModalType(type);
                    setLoanNo(`LN-${type.toUpperCase()}-${new Date().getFullYear()}-${String(loans.length + 1).padStart(4, '0')}`);
                  }}
                  className={`p-2.5 rounded-xl font-bold uppercase text-[11px] border transition-all text-center ${
                    loanModalType === type
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  {type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveLoan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Bank Facility / Sanction *</label>
                  <select
                    required
                    value={loanFacilityId}
                    onChange={(e) => {
                      setLoanFacilityId(e.target.value);
                      const f = facilities.find(fac => fac.id === e.target.value);
                      if (f) {
                        setLoanInterestRate(f.interestRate || 9.0);
                        setLoanMarginPercent(f.marginPercent || 20.0);
                        setLoanCurrency(f.currency || 'BDT');
                        setLoanTenorDays(f.tenorDays || 180);
                        handleTenorChange(f.tenorDays || 180);
                      }
                    }}
                    className="w-full mt-1 p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-neutral-800"
                  >
                    <option value="">-- Choose Bank Facility --</option>
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.bankName} - {f.facilityNo} (Limit: {formatMoney(f.sanctionedLimit, f.currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Loan ID / Ref No *</label>
                  <input
                    type="text"
                    required
                    value={loanNo}
                    onChange={(e) => setLoanNo(e.target.value)}
                    className="w-full mt-1 p-2.5 border border-neutral-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* Conditional Fields: UPAS & LC Purchase */}
              {(loanModalType === 'upas' || loanModalType === 'lc_purchase') && (
                <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-indigo-900 uppercase text-[10px]">LC Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LC-2026-000892"
                      value={loanLcNo}
                      onChange={(e) => setLoanLcNo(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-indigo-900 uppercase text-[10px]">LC Date</label>
                    <input
                      type="date"
                      value={loanLcDate}
                      onChange={(e) => setLoanLcDate(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-indigo-900 uppercase text-[10px]">Supplier Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Global Yarn Mills Ltd"
                      value={loanSupplierName}
                      onChange={(e) => setLoanSupplierName(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Fields: LTR */}
              {loanModalType === 'ltr' && (
                <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-indigo-900 uppercase text-[10px]">Import Bill No</label>
                    <input
                      type="text"
                      placeholder="e.g. IMP-BILL-2026-042"
                      value={loanImportBillNo}
                      onChange={(e) => setLoanImportBillNo(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-indigo-900 uppercase text-[10px]">Customs / BE Doc No</label>
                    <input
                      type="text"
                      placeholder="e.g. BE-CTG-2026-9938"
                      value={loanCustomsDocNo}
                      onChange={(e) => setLoanCustomsDocNo(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Fields: Term Loan (Machinery) */}
              {loanModalType === 'term_loan' && (
                <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-indigo-900 uppercase text-[10px]">Machinery Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 8-Color Rotary Screen Printing Machine"
                        value={loanMachineryName}
                        onChange={(e) => setLoanMachineryName(e.target.value)}
                        className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-indigo-900 uppercase text-[10px]">Machinery Supplier</label>
                      <input
                        type="text"
                        placeholder="e.g. Heidelberg / Stork Machinery"
                        value={loanMachinerySupplier}
                        onChange={(e) => setLoanMachinerySupplier(e.target.value)}
                        className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-indigo-900 uppercase text-[10px]">Down Payment Amount</label>
                      <input
                        type="number"
                        min="0"
                        value={loanDownPayment}
                        onChange={(e) => setLoanDownPayment(Number(e.target.value))}
                        className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-indigo-900 uppercase text-[10px]">No. of Installments</label>
                      <input
                        type="number"
                        min="1"
                        value={loanInstallmentCount}
                        onChange={(e) => setLoanInstallmentCount(Number(e.target.value))}
                        className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-indigo-900 uppercase text-[10px]">Calculation Method</label>
                      <select
                        value={loanCalculationType}
                        onChange={(e) => setLoanCalculationType(e.target.value as any)}
                        className="w-full mt-1 p-2 bg-white border border-indigo-300 rounded-xl font-bold"
                      >
                        <option value="equal_principal">Equal Principal Installment</option>
                        <option value="emi">Equal Monthly Installment (EMI)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Amount, Margin, Financed Calculation Section */}
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-neutral-700 uppercase text-[10px]">
                      {loanModalType === 'upas' || loanModalType === 'lc_purchase' ? 'LC Value / Amount *' :
                       loanModalType === 'ltr' ? 'Import Invoice Value *' :
                       loanModalType === 'term_loan' ? 'Total Machinery Cost *' :
                       'Loan Amount *'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={loanPrincipal}
                      onChange={(e) => setLoanPrincipal(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 bg-white border border-neutral-300 rounded-xl font-black text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 uppercase text-[10px]">Margin %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={loanMarginPercent}
                      onChange={(e) => setLoanMarginPercent(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 bg-white border border-neutral-300 rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 uppercase text-[10px]">Interest Rate (% p.a.)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={loanInterestRate}
                      onChange={(e) => setLoanInterestRate(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 bg-white border border-neutral-300 rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-200">
                  <div>
                    <label className="font-bold text-neutral-700 uppercase text-[10px]">Interest Start Date</label>
                    <input
                      type="date"
                      value={loanStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-neutral-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 uppercase text-[10px]">Tenor (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={loanTenorDays}
                      onChange={(e) => handleTenorChange(Number(e.target.value))}
                      className="w-full mt-1 p-2 bg-white border border-neutral-300 rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 uppercase text-[10px]">Maturity / Due Date</label>
                    <input
                      type="date"
                      value={loanMaturityDate}
                      onChange={(e) => setLoanMaturityDate(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-neutral-300 rounded-xl font-bold"
                    />
                  </div>
                </div>

                {/* Live Real-time Calculation Summary Card */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">Margin Deducted</span>
                    <p className="font-bold text-neutral-800">{formatMoney(computedMarginAmount, loanCurrency)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase">Bank Financed Amount</span>
                    <p className="font-black text-indigo-600">{formatMoney(computedFinancedAmount, loanCurrency)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">Estimated Interest</span>
                    <p className="font-bold text-neutral-800">{formatMoney(computedInterestAmount, loanCurrency)}</p>
                    <span className="text-[9px] text-neutral-400">({loanTenorDays} Days)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Total Payable on Due</span>
                    <p className="font-black text-emerald-600">{formatMoney(computedFinancedAmount + computedInterestAmount + Number(loanOtherCharges), loanCurrency)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-xl text-neutral-700 font-bold hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm & Create Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REPAYMENT ENTRY & OVERDUE SETTLEMENT */}
      {/* ======================================================== */}
      {isRepaymentModalOpen && selectedLoanForRepayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 text-xs space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="font-black text-neutral-900 text-base">
                  Loan Repayment & Overdue Settlement Entry
                </h3>
                <p className="text-neutral-500 text-[11px]">{selectedLoanForRepayment.loanNo} • {selectedLoanForRepayment.bankName}</p>
              </div>
              <button onClick={() => setIsRepaymentModalOpen(false)} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overdue Calculation Details Box */}
            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Original Due</span>
                  <p className="font-bold text-neutral-900">{formatMoney(selectedLoanForRepayment.netOutstanding, selectedLoanForRepayment.currency)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Overdue Days</span>
                  <p className={`font-black ${selectedLoanForRepayment.overdueDays > 0 ? 'text-red-600' : 'text-neutral-700'}`}>
                    {selectedLoanForRepayment.overdueDays > 0 ? `${selectedLoanForRepayment.overdueDays} Days Late` : 'On Time'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-amber-700 font-bold uppercase">Additional Charge ({selectedLoanForRepayment.overdueChargeRate}%)</span>
                  <p className="font-black text-amber-800">
                    +{formatMoney(selectedLoanForRepayment.calculatedOverdueCharge, selectedLoanForRepayment.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase">Total Payable Now</span>
                  <p className="font-black text-indigo-600">
                    {formatMoney(selectedLoanForRepayment.totalPayableWithOverdue, selectedLoanForRepayment.currency)}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveRepayment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={repPaymentDate}
                    onChange={(e) => setRepPaymentDate(e.target.value)}
                    className="w-full mt-1 p-2.5 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Repayment Amount Paid *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={repAmount}
                    onChange={(e) => setRepAmount(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 border border-neutral-300 rounded-xl font-black text-emerald-600 text-sm"
                  />
                </div>
              </div>

              {/* Automatic Priority Allocation Summary */}
              <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between text-indigo-900 font-bold text-xs">
                  <span>Automated Priority Allocation:</span>
                  <span className="text-[10px] text-indigo-600 font-normal">Overdue Charge → Interest → Principal</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2 rounded-xl border border-indigo-100">
                    <span className="text-[9px] text-neutral-400 font-bold">To Overdue Charge</span>
                    <p className="font-bold text-amber-700">{formatMoney(computedAllocation.overdue, selectedLoanForRepayment.currency)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-indigo-100">
                    <span className="text-[9px] text-neutral-400 font-bold">To Interest</span>
                    <p className="font-bold text-neutral-800">{formatMoney(computedAllocation.interest, selectedLoanForRepayment.currency)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-indigo-100">
                    <span className="text-[9px] text-neutral-400 font-bold">To Principal</span>
                    <p className="font-bold text-neutral-800">{formatMoney(computedAllocation.principal, selectedLoanForRepayment.currency)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-indigo-100">
                    <span className="text-[9px] text-neutral-400 font-bold">Remaining Balance</span>
                    <p className="font-black text-indigo-600">{formatMoney(computedAllocation.remaining, selectedLoanForRepayment.currency)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Payment Method</label>
                  <select
                    value={repPaymentMethod}
                    onChange={(e) => setRepPaymentMethod(e.target.value)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl bg-white font-bold"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="rtgs">RTGS / EFT</option>
                    <option value="cheque">Cheque</option>
                    <option value="pay_order">Pay Order</option>
                    <option value="cash">Cash Deposit</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Source Bank Account</label>
                  <input
                    type="text"
                    value={repBankName}
                    onChange={(e) => setRepBankName(e.target.value)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 uppercase text-[10px]">Payment Reference</label>
                  <input
                    type="text"
                    value={repReference}
                    onChange={(e) => setRepReference(e.target.value)}
                    className="w-full mt-1 p-2 border border-neutral-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsRepaymentModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-xl text-neutral-700 font-bold hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md"
                >
                  Post Repayment & GL Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VIEW LOAN DETAILS & REPAYMENT SCHEDULE */}
      {/* ======================================================== */}
      {viewingLoanDetails && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-neutral-200 text-xs space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="font-black text-neutral-900 text-base">{viewingLoanDetails.loanNo}</h3>
                <p className="text-neutral-500 text-[11px]">
                  {viewingLoanDetails.bankName} • {viewingLoanDetails.loanType.toUpperCase()} Facility
                </p>
              </div>
              <button onClick={() => setViewingLoanDetails(null)} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold">Principal Amount</span>
                <p className="font-black text-neutral-900">{formatMoney(viewingLoanDetails.principalAmount, viewingLoanDetails.currency)}</p>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold">Financed Amount</span>
                <p className="font-black text-indigo-600">{formatMoney(viewingLoanDetails.financedAmount, viewingLoanDetails.currency)}</p>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold">Total Paid</span>
                <p className="font-black text-emerald-600">{formatMoney(viewingLoanDetails.totalPaidAmount, viewingLoanDetails.currency)}</p>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold">Net Outstanding</span>
                <p className="font-black text-neutral-900">{formatMoney(viewingLoanDetails.netOutstanding, viewingLoanDetails.currency)}</p>
              </div>
            </div>

            {/* Repayment Schedule Table for Term Loans */}
            {viewingLoanDetails.repaymentSchedule && viewingLoanDetails.repaymentSchedule.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-neutral-900 text-xs">Repayment Schedule Table</h4>
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                      <tr>
                        <th className="p-2.5">Inst #</th>
                        <th className="p-2.5">Due Date</th>
                        <th className="p-2.5 text-right">Principal</th>
                        <th className="p-2.5 text-right">Interest</th>
                        <th className="p-2.5 text-right">Total Due</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {viewingLoanDetails.repaymentSchedule.map((item: any) => (
                        <tr key={item.installmentNo} className="hover:bg-neutral-50">
                          <td className="p-2.5 font-bold">#{item.installmentNo}</td>
                          <td className="p-2.5">{item.dueDate}</td>
                          <td className="p-2.5 text-right">{formatMoney(item.principalAmount, viewingLoanDetails.currency)}</td>
                          <td className="p-2.5 text-right">{formatMoney(item.interestAmount, viewingLoanDetails.currency)}</td>
                          <td className="p-2.5 text-right font-bold">{formatMoney(item.totalAmount, viewingLoanDetails.currency)}</td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 uppercase">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setViewingLoanDetails(null)}
                className="px-4 py-2 bg-neutral-800 text-white font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
