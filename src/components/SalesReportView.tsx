import React, { useState, useMemo } from 'react';
import { printElement } from '../utils/printHelper';
import { 
  DollarSign, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  RotateCcw, 
  Building2, 
  Layers, 
  User, 
  Calendar, 
  Truck, 
  CheckCircle2, 
  FileText, 
  ShieldCheck, 
  TrendingUp, 
  Eye, 
  X,
  ArrowUpDown,
  Tag,
  PackageCheck
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { 
  UserProfile, 
  Customer, 
  Buyer, 
  SectionMaster, 
  WorkOrder, 
  DeliveryChallanRecord,
  GatePassRecord,
  FinishedGoods,
  PriceMaster
} from '../types';

interface SalesReportViewProps {
  userProfile: UserProfile;
  challans: DeliveryChallanRecord[];
  gatePasses: GatePassRecord[];
  workOrders: WorkOrder[];
  customers: Customer[];
  buyers: Buyer[];
  sections: SectionMaster[];
  finishedGoods: FinishedGoods[];
  priceMasters?: PriceMaster[];
}

export function SalesReportView({
  userProfile,
  challans,
  gatePasses,
  workOrders,
  customers,
  buyers,
  sections,
  finishedGoods,
  priceMasters = []
}: SalesReportViewProps) {
  // --- Filter States ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('all');
  const [gatePassFilter, setGatePassFilter] = useState<'passed_only' | 'all' | 'exited_only'>('passed_only');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<'challanDate' | 'challanNo' | 'customerName' | 'currentDeliveryQty' | 'totalSalesValue'>('challanDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Quick Modal for Viewing Challan
  const [viewingChallan, setViewingChallan] = useState<any | null>(null);

  // Map Gate Passes by Challan ID and Challan No for instant lookup
  const gatePassesMap = useMemo(() => {
    const map = new Map<string, GatePassRecord>();
    gatePasses.forEach(gp => {
      if (gp.status === 'cancelled') return;
      if (gp.challanId) map.set(gp.challanId, gp);
      if (gp.challanNo) map.set(gp.challanNo, gp);
    });
    return map;
  }, [gatePasses]);

  // Map Work Orders by WO ID and WO Number for rate & section resolution
  const workOrdersMap = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    workOrders.forEach(wo => {
      if (wo.id) map.set(wo.id, wo);
      if (wo.woNumber) map.set(wo.woNumber, wo);
    });
    return map;
  }, [workOrders]);

  // Process and enrich Delivery Challans with Gate Pass & Sales Value
  const enrichedChallans = useMemo(() => {
    return challans
      .filter(ch => ch.status !== 'cancelled')
      .map(ch => {
        const linkedGp = gatePassesMap.get(ch.id) || gatePassesMap.get(ch.challanNo);
        const hasGatePass = !!linkedGp;
        const gpStatus = linkedGp ? linkedGp.status : 'no_gate_pass';
        const gatePassNo = linkedGp ? linkedGp.gatePassNo : ((ch as any).gatePassNo || '');
        const gatePassDate = linkedGp ? linkedGp.gatePassDate : '';

        // Match work order to determine unit rate and section
        const linkedWo = (ch.woId ? workOrdersMap.get(ch.woId) : null) || (ch.woNumber ? workOrdersMap.get(ch.woNumber) : null);
        
        let unitRate = 0;
        if (linkedWo && typeof linkedWo.rate === 'number' && linkedWo.rate > 0) {
          unitRate = linkedWo.rate;
        } else if (linkedWo && linkedWo.breakdownRows && linkedWo.breakdownRows.length > 0) {
          unitRate = linkedWo.breakdownRows[0].rate || 0;
        } else if (linkedWo && linkedWo.totalQuantity > 0 && linkedWo.totalAmount > 0) {
          unitRate = linkedWo.totalAmount / linkedWo.totalQuantity;
        }

        // Check if challan items have specific individual totals
        let totalSalesValue = 0;
        const challanQty = Number(ch.currentDeliveryQty) || 0;

        if (ch.items && ch.items.length > 0) {
          // If items breakdown exists
          totalSalesValue = challanQty * unitRate;
        } else {
          totalSalesValue = challanQty * unitRate;
        }

        const sectionName = (linkedWo && linkedWo.sectionName) ? linkedWo.sectionName : ((ch as any).sectionName || 'General');
        const sectionId = linkedWo ? linkedWo.sectionId : '';

        return {
          ...ch,
          linkedGp,
          hasGatePass,
          gatePassNo,
          gatePassDate,
          gpStatus,
          unitRate,
          totalSalesValue,
          sectionName,
          sectionId,
          linkedWo
        };
      });
  }, [challans, gatePassesMap, workOrdersMap]);

  // Filter Challans according to user criteria
  const filteredChallans = useMemo(() => {
    return enrichedChallans.filter(row => {
      // Gate Pass Filter
      if (gatePassFilter === 'passed_only') {
        if (!row.hasGatePass && !row.gatePassNo) return false;
      } else if (gatePassFilter === 'exited_only') {
        if (row.gpStatus !== 'exited') return false;
      }

      // Customer Filter
      if (selectedCustomerId !== 'all' && row.customerId !== selectedCustomerId) {
        return false;
      }

      // Section Filter
      if (selectedSectionId !== 'all') {
        if (row.sectionId !== selectedSectionId && row.sectionName !== selectedSectionId) {
          return false;
        }
      }

      // Buyer Filter
      if (selectedBuyerId !== 'all' && row.buyerName !== selectedBuyerId) {
        return false;
      }

      // Date Range Filter (by Challan Date or Gate Pass Date)
      if (dateFrom || dateTo) {
        const dateStr = row.gatePassDate || row.challanDate;
        if (!dateStr) return false;
        try {
          let parsedDate: Date | null = null;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              parsedDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
          } else {
            parsedDate = parseISO(dateStr);
          }

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            if (dateFrom && dateTo) {
              const start = startOfDay(parseISO(dateFrom));
              const end = endOfDay(parseISO(dateTo));
              if (!isWithinInterval(parsedDate, { start, end })) return false;
            } else if (dateFrom) {
              if (parsedDate < startOfDay(parseISO(dateFrom))) return false;
            } else if (dateTo) {
              if (parsedDate > endOfDay(parseISO(dateTo))) return false;
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      // Live Search Term
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matches = 
          (row.challanNo || '').toLowerCase().includes(q) ||
          (row.gatePassNo || '').toLowerCase().includes(q) ||
          (row.woNumber || '').toLowerCase().includes(q) ||
          (row.customerName || '').toLowerCase().includes(q) ||
          (row.buyerName || '').toLowerCase().includes(q) ||
          (row.productName || '').toLowerCase().includes(q) ||
          (row.style || '').toLowerCase().includes(q) ||
          (row.vehicleNo || '').toLowerCase().includes(q) ||
          (row.driverName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'challanDate') {
        valA = a.challanDate ? new Date(a.challanDate).getTime() : 0;
        valB = b.challanDate ? new Date(b.challanDate).getTime() : 0;
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [enrichedChallans, gatePassFilter, selectedCustomerId, selectedSectionId, selectedBuyerId, dateFrom, dateTo, searchTerm, sortField, sortAsc]);

  // KPI Metrics Calculation
  const summaryMetrics = useMemo(() => {
    const totalSalesChallans = filteredChallans.length;
    const totalSalesQty = filteredChallans.reduce((sum, ch) => sum + (Number(ch.currentDeliveryQty) || 0), 0);
    const totalSalesValue = filteredChallans.reduce((sum, ch) => sum + (Number(ch.totalSalesValue) || 0), 0);
    const totalGatePassesIssued = filteredChallans.filter(ch => ch.hasGatePass).length;
    
    // Unique Customers
    const customerSet = new Set(filteredChallans.map(ch => ch.customerName).filter(Boolean));
    const uniqueCustomersCount = customerSet.size;

    const avgSalesPerChallan = totalSalesChallans > 0 ? totalSalesValue / totalSalesChallans : 0;

    return {
      totalSalesChallans,
      totalSalesQty,
      totalSalesValue,
      totalGatePassesIssued,
      uniqueCustomersCount,
      avgSalesPerChallan
    };
  }, [filteredChallans]);

  const handleResetFilters = () => {
    setSelectedCustomerId('all');
    setSelectedSectionId('all');
    setSelectedBuyerId('all');
    setGatePassFilter('passed_only');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
  };

  const handleExportExcel = () => {
    const dataToExport = filteredChallans.map((r, idx) => ({
      'SL': idx + 1,
      'Challan No': r.challanNo || '',
      'Challan Date': r.challanDate || '',
      'Gate Pass No': r.gatePassNo || 'N/A',
      'Gate Pass Date': r.gatePassDate || '',
      'WO / Order No': r.woNumber || '',
      'Customer Name': r.customerName || '',
      'Buyer Name': r.buyerName || '',
      'Section': r.sectionName || '',
      'Product Name': r.productName || '',
      'Style': r.style || '',
      'Vehicle No': r.vehicleNo || '',
      'Driver Name': r.driverName || '',
      'Sales / Delivery Qty': r.currentDeliveryQty || 0,
      'Unit': r.unit || 'PCS',
      'Unit Rate (Tk)': r.unitRate || 0,
      'Total Sales Value (Tk)': r.totalSalesValue || 0,
      'Gate Pass Status': r.hasGatePass ? (r.gpStatus === 'exited' ? 'Exited Factory' : 'Gate Pass Active') : 'Pending Gate Pass',
      'Prepared By': r.preparedBy || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales_Report');
    XLSX.writeFile(wb, `GatePass_Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handlePrint = () => {
    printElement('printable-sales-report', { title: 'GatePass_Sales_Report', pageOrientation: 'landscape' });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div id="printable-sales-report" className="printable-doc space-y-6">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm print:shadow-none print:border-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-neutral-900">Sales & Gate Pass Challan Report</h2>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                  Dispatched Sales
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Real-time sales tracking based on Delivery Challans verified with Gate Pass exit permits, displaying total delivered quantity and net sales value.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 print:hidden">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl border border-neutral-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* 5 Summary KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Sales Value</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-950 mt-1">
              ৳ {summaryMetrics.totalSalesValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Net dispatched revenue
            </p>
          </div>

          <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Sold Qty</span>
              <PackageCheck className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-black text-blue-950 mt-1">
              {summaryMetrics.totalSalesQty.toLocaleString()} <span className="text-xs font-normal text-blue-600">PCS</span>
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Verified goods passed
            </p>
          </div>

          <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Gate Passed Challans</span>
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-xl font-black text-indigo-950 mt-1">
              {summaryMetrics.totalSalesChallans} <span className="text-xs font-normal text-indigo-600">Challans</span>
            </p>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              Passes: <span className="font-bold">{summaryMetrics.totalGatePassesIssued}</span> issued
            </p>
          </div>

          <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Clients Served</span>
              <Building2 className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xl font-black text-purple-950 mt-1">
              {summaryMetrics.uniqueCustomersCount} <span className="text-xs font-normal text-purple-600">Customers</span>
            </p>
            <p className="text-[11px] text-purple-700 mt-0.5">
              Across active shipments
            </p>
          </div>

          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Avg Value / Challan</span>
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xl font-black text-amber-950 mt-1">
              ৳ {Math.round(summaryMetrics.avgSalesPerChallan).toLocaleString()}
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Average shipment ticket
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4 print:hidden">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-neutral-800">Filter Sales & Challans</h3>
          </div>
          {(selectedCustomerId !== 'all' || selectedSectionId !== 'all' || selectedBuyerId !== 'all' || gatePassFilter !== 'passed_only' || dateFrom || dateTo || searchTerm) && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Customer Filter */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-600 uppercase flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" /> Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">All Customers ({customers.length})</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-600 uppercase flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-neutral-400" /> Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">All Sections ({sections.length})</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Buyer Filter */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-600 uppercase flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-neutral-400" /> Buyer
            </label>
            <select
              value={selectedBuyerId}
              onChange={(e) => setSelectedBuyerId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">All Buyers ({buyers.length})</option>
              {buyers.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Gate Pass Filter */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-600 uppercase flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" /> Gate Pass Status
            </label>
            <select
              value={gatePassFilter}
              onChange={(e) => setGatePassFilter(e.target.value as any)}
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="passed_only">Gate Passed Only (Verified Sales)</option>
              <option value="exited_only">Exited Factory Gate Only</option>
              <option value="all">All Delivery Challans</option>
            </select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-600 uppercase flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" /> Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-600 uppercase flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" /> Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by Challan No, Gate Pass No, WO No, Customer, Product, Vehicle No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-neutral-200 text-xs text-neutral-900 bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-neutral-700">Displaying Sales Challans:</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-xs font-black rounded-md">
              {filteredChallans.length}
            </span>
          </div>

          <div className="text-xs text-neutral-500 hidden sm:block">
            Gate Pass passed deliveries represent finalized dispatch sales.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/70 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3 cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('challanNo')}>
                  <div className="flex items-center gap-1">
                    <span>Challan No</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('challanDate')}>
                  <div className="flex items-center gap-1">
                    <span>Challan Date</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3">Gate Pass No & Status</th>
                <th className="p-3">WO / Order No</th>
                <th className="p-3 cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('customerName')}>
                  <div className="flex items-center gap-1">
                    <span>Customer & Section</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3">Product / Style</th>
                <th className="p-3">Vehicle & Driver</th>
                <th className="p-3 text-right cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('currentDeliveryQty')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Sales Qty</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 text-right">Unit Rate (Tk)</th>
                <th className="p-3 text-right cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('totalSalesValue')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Sales Value (Tk)</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {filteredChallans.map((row) => (
                <tr 
                  key={row.id} 
                  className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                  onClick={() => setViewingChallan(row)}
                >
                  <td className="p-3 font-mono font-bold text-neutral-900">
                    {row.challanNo}
                  </td>

                  <td className="p-3 whitespace-nowrap text-neutral-600">
                    {row.challanDate}
                  </td>

                  <td className="p-3">
                    {row.gatePassNo ? (
                      <div>
                        <div className="font-mono font-bold text-emerald-800 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {row.gatePassNo}
                        </div>
                        <span className={`inline-block px-1.5 py-0.2 text-[9px] font-bold rounded mt-0.5 ${
                          row.gpStatus === 'exited' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {row.gpStatus === 'exited' ? 'Gate Exited' : 'Gate Passed'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-400 italic">No Gate Pass</span>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="font-mono font-bold text-indigo-700">{row.woNumber}</div>
                    {row.poNo && (
                      <div className="text-[10px] text-neutral-400">PO: {row.poNo}</div>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="font-bold text-neutral-900">{row.customerName || 'Unknown Customer'}</div>
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-0.5">
                      {row.sectionName || 'General Section'}
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-neutral-900">{row.productName || 'Finished Goods'}</div>
                    {row.style && (
                      <div className="text-[10px] text-purple-700 font-bold">Style: {row.style}</div>
                    )}
                  </td>

                  <td className="p-3 text-neutral-600">
                    <div>{row.vehicleNo || 'N/A'}</div>
                    {row.driverName && (
                      <div className="text-[10px] text-neutral-400">{row.driverName}</div>
                    )}
                  </td>

                  <td className="p-3 text-right font-black text-neutral-900">
                    {(Number(row.currentDeliveryQty) || 0).toLocaleString()}
                    <span className="text-[10px] font-normal text-neutral-400 ml-1">{row.unit || 'PCS'}</span>
                  </td>

                  <td className="p-3 text-right text-neutral-700 font-medium">
                    ৳ {(Number(row.unitRate) || 0).toLocaleString()}
                  </td>

                  <td className="p-3 text-right font-black text-emerald-700">
                    ৳ {(Number(row.totalSalesValue) || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </td>

                  <td className="p-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setViewingChallan(row)}
                      className="p-1.5 text-neutral-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="View Challan Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredChallans.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-neutral-400 italic">
                    No sales records found matching the applied filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Challan & Sales Detail Modal */}
      {viewingChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <DollarSign className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Sales Challan: {viewingChallan.challanNo}</h3>
                  <p className="text-xs text-emerald-200">
                    Customer: {viewingChallan.customerName} • Date: {viewingChallan.challanDate}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingChallan(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Key Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Gate Pass No</span>
                  <span className="font-bold text-emerald-800 font-mono text-sm">{viewingChallan.gatePassNo || 'None'}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Work Order No</span>
                  <span className="font-bold text-neutral-900 font-mono text-sm">{viewingChallan.woNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Vehicle & Driver</span>
                  <span className="font-bold text-neutral-900">{viewingChallan.vehicleNo} ({viewingChallan.driverName})</span>
                </div>
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Delivery Address</span>
                  <span className="font-medium text-neutral-700">{viewingChallan.deliveryAddress || 'Factory Gate'}</span>
                </div>
              </div>

              {/* Financial Calculation Box */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Sales Revenue Calculation</span>
                  <span className="text-sm font-semibold text-emerald-950">
                    {viewingChallan.currentDeliveryQty} {viewingChallan.unit || 'PCS'} × ৳{viewingChallan.unitRate || 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Total Sales Value</span>
                  <span className="text-2xl font-black text-emerald-900">
                    ৳ {viewingChallan.totalSalesValue?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                </div>
              </div>

              {/* Items Breakdown Table if available */}
              {viewingChallan.items && viewingChallan.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-neutral-800 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    Challan Items Breakdown
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-neutral-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                        <tr>
                          <th className="p-2.5">Style</th>
                          <th className="p-2.5">Color</th>
                          <th className="p-2.5">Size</th>
                          <th className="p-2.5 text-right">Order Qty</th>
                          <th className="p-2.5 text-right">Delivered Qty</th>
                          <th className="p-2.5 text-right">Balance Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {viewingChallan.items.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-neutral-50">
                            <td className="p-2.5 font-bold text-neutral-900">{it.style || '-'}</td>
                            <td className="p-2.5 text-neutral-700">{it.color || '-'}</td>
                            <td className="p-2.5 font-mono font-bold text-indigo-700">{it.size || '-'}</td>
                            <td className="p-2.5 text-right font-medium">{it.orderQty || 0}</td>
                            <td className="p-2.5 text-right font-black text-emerald-700">{it.challanQty || 0}</td>
                            <td className="p-2.5 text-right font-bold text-amber-700">{it.balanceQty || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end">
              <button
                onClick={() => setViewingChallan(null)}
                className="px-5 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold rounded-xl text-xs transition-colors"
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
