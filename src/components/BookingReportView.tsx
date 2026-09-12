import React, { useState, useMemo } from 'react';
import { printElement } from '../utils/printHelper';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  RotateCcw, 
  Building2, 
  Layers, 
  User, 
  Calendar, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  Eye, 
  X,
  ChevronDown,
  ArrowUpDown,
  Tag
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
  FinishedGoods
} from '../types';

interface BookingReportViewProps {
  userProfile: UserProfile;
  workOrders: WorkOrder[];
  customers: Customer[];
  buyers: Buyer[];
  sections: SectionMaster[];
  finishedGoods: FinishedGoods[];
  challans: DeliveryChallanRecord[];
  onViewWorkOrder?: (wo: WorkOrder) => void;
}

export function BookingReportView({
  userProfile,
  workOrders,
  customers,
  buyers,
  sections,
  finishedGoods,
  challans,
  onViewWorkOrder
}: BookingReportViewProps) {
  // --- Filter States ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // all, confirmed, in_production, pending, completed
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all'); // all, pending, partial, fully
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Sorting state
  const [sortField, setSortField] = useState<'date' | 'woNumber' | 'customerName' | 'totalQuantity' | 'totalAmount' | 'deliveredQty' | 'balanceQty'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Selected WO for Quick Modal Details
  const [modalWo, setModalWo] = useState<WorkOrder | null>(null);

  // Map Delivery Challans by Work Order ID / WO Number for high-speed lookup
  const challansByWoMap = useMemo(() => {
    const map = new Map<string, DeliveryChallanRecord[]>();
    challans.forEach(ch => {
      if (ch.status === 'cancelled') return;
      
      // index by woId
      if (ch.woId) {
        const list = map.get(ch.woId) || [];
        list.push(ch);
        map.set(ch.woId, list);
      }
      // also index by woNumber
      if (ch.woNumber) {
        const list = map.get(ch.woNumber) || [];
        list.push(ch);
        map.set(ch.woNumber, list);
      }
    });
    return map;
  }, [challans]);

  // Process and enrich Work Order rows with delivered quantity & balance
  const enrichedRows = useMemo(() => {
    return workOrders.map(wo => {
      // Find linked challans
      const woChallans = challansByWoMap.get(wo.id) || challansByWoMap.get(wo.woNumber) || [];
      
      // Calculate total delivered qty
      const deliveredQty = woChallans.reduce((sum, ch) => {
        const qty = Number(ch.currentDeliveryQty) || 0;
        return sum + qty;
      }, 0);

      const orderQty = Number(wo.totalQuantity) || 0;
      const balanceQty = Math.max(0, orderQty - deliveredQty);

      let deliveryStatusText: 'Pending Delivery' | 'Partially Delivered' | 'Fully Delivered' = 'Pending Delivery';
      if (deliveredQty >= orderQty && orderQty > 0) {
        deliveryStatusText = 'Fully Delivered';
      } else if (deliveredQty > 0) {
        deliveryStatusText = 'Partially Delivered';
      }

      const deliveryPercentage = orderQty > 0 ? Math.min(100, Math.round((deliveredQty / orderQty) * 100)) : 0;

      return {
        ...wo,
        deliveredQty,
        balanceQty,
        deliveryStatusText,
        deliveryPercentage,
        linkedChallansCount: woChallans.length
      };
    });
  }, [workOrders, challansByWoMap]);

  // Apply User Filters
  const filteredRows = useMemo(() => {
    return enrichedRows.filter(row => {
      // Exclude cancelled / rejected if viewing active booking, or filter specifically
      if (selectedStatus === 'all') {
        // default show all non-cancelled
        if (row.status === 'cancelled') return false;
      } else if (selectedStatus === 'confirmed_only') {
        if (row.status !== 'confirmed' && row.status !== 'approved' && row.status !== 'in_production') return false;
      } else if (row.status !== selectedStatus) {
        return false;
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
      if (selectedBuyerId !== 'all' && row.buyerId !== selectedBuyerId && row.buyerName !== selectedBuyerId) {
        return false;
      }

      // Delivery Status Filter
      if (deliveryFilter === 'pending' && row.deliveryStatusText !== 'Pending Delivery') return false;
      if (deliveryFilter === 'partial' && row.deliveryStatusText !== 'Partially Delivered') return false;
      if (deliveryFilter === 'fully' && row.deliveryStatusText !== 'Fully Delivered') return false;

      // Date Range Filter
      if (dateFrom || dateTo) {
        if (!row.date) return false;
        try {
          const rowDate = parseISO(row.date);
          if (dateFrom && dateTo) {
            const start = startOfDay(parseISO(dateFrom));
            const end = endOfDay(parseISO(dateTo));
            if (!isWithinInterval(rowDate, { start, end })) return false;
          } else if (dateFrom) {
            if (rowDate < startOfDay(parseISO(dateFrom))) return false;
          } else if (dateTo) {
            if (rowDate > endOfDay(parseISO(dateTo))) return false;
          }
        } catch {
          // ignore unparseable date
        }
      }

      // Search Term
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matches = 
          (row.woNumber || '').toLowerCase().includes(q) ||
          (row.orderNo || '').toLowerCase().includes(q) ||
          (row.poNo || '').toLowerCase().includes(q) ||
          (row.customerName || '').toLowerCase().includes(q) ||
          (row.buyerName || '').toLowerCase().includes(q) ||
          (row.style || '').toLowerCase().includes(q) ||
          (row.finishedGoodsName || '').toLowerCase().includes(q) ||
          (row.sectionName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'date') {
        valA = a.date ? new Date(a.date).getTime() : 0;
        valB = b.date ? new Date(b.date).getTime() : 0;
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [enrichedRows, selectedStatus, selectedCustomerId, selectedSectionId, selectedBuyerId, deliveryFilter, dateFrom, dateTo, searchTerm, sortField, sortAsc]);

  // Aggregate Metrics
  const summaryMetrics = useMemo(() => {
    const totalOrders = filteredRows.length;
    const totalOrderQty = filteredRows.reduce((sum, r) => sum + (Number(r.totalQuantity) || 0), 0);
    const totalBookingValue = filteredRows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
    const totalDeliveredQty = filteredRows.reduce((sum, r) => sum + r.deliveredQty, 0);
    const totalBalanceQty = filteredRows.reduce((sum, r) => sum + r.balanceQty, 0);
    const confirmedOrdersCount = filteredRows.filter(r => ['confirmed', 'approved', 'in_production', 'completed'].includes(r.status)).length;
    const overallDeliveryRate = totalOrderQty > 0 ? Math.round((totalDeliveredQty / totalOrderQty) * 100) : 0;

    return {
      totalOrders,
      totalOrderQty,
      totalBookingValue,
      totalDeliveredQty,
      totalBalanceQty,
      confirmedOrdersCount,
      overallDeliveryRate
    };
  }, [filteredRows]);

  const handleResetFilters = () => {
    setSelectedCustomerId('all');
    setSelectedSectionId('all');
    setSelectedBuyerId('all');
    setSelectedStatus('all');
    setDeliveryFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
  };

  const handleExportExcel = () => {
    const dataToExport = filteredRows.map((r, idx) => ({
      'SL': idx + 1,
      'WO Number': r.woNumber || '',
      'Order Date': r.date || '',
      'Delivery Date': r.deliveryDate || '',
      'Customer Name': r.customerName || '',
      'Section': r.sectionName || '',
      'Buyer Name': r.buyerName || '',
      'Style': r.style || '',
      'Product / Item': r.finishedGoodsName || '',
      'PO Number': r.poNo || '',
      'Order Qty': r.totalQuantity || 0,
      'Currency': r.currencyCode || 'BDT',
      'Rate': r.rate || 0,
      'Booking Amount': r.totalAmount || 0,
      'Delivered Qty': r.deliveredQty,
      'Remaining Balance': r.balanceQty,
      'Delivery %': `${r.deliveryPercentage}%`,
      'Delivery Status': r.deliveryStatusText,
      'Order Status': r.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Booking_Report');
    XLSX.writeFile(wb, `Order_Booking_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handlePrint = () => {
    printElement('printable-booking-report', { title: 'Order_Booking_Report', pageOrientation: 'landscape' });
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
    <div id="printable-booking-report" className="printable-doc space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm print:shadow-none print:border-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-neutral-900">Order Booking & Delivery Status Report</h2>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] font-bold rounded-full">
                  Live Analytics
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Track total received orders, confirmed work orders, and real-time delivery completion balances filtered by customer and section.
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
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Received Orders</span>
              <FileText className="w-4 h-4 text-neutral-400" />
            </div>
            <p className="text-xl font-black text-neutral-900 mt-1">
              {summaryMetrics.totalOrders} <span className="text-xs font-normal text-neutral-500">Orders</span>
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Confirmed: <span className="font-bold text-indigo-600">{summaryMetrics.confirmedOrdersCount}</span>
            </p>
          </div>

          <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Booking Order Qty</span>
              <ShoppingBag className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-xl font-black text-indigo-950 mt-1">
              {summaryMetrics.totalOrderQty.toLocaleString()} <span className="text-xs font-normal text-indigo-600">PCS</span>
            </p>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              Across all filtered orders
            </p>
          </div>

          <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Total Booking Value</span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xl font-black text-purple-950 mt-1">
              ৳ {summaryMetrics.totalBookingValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </p>
            <p className="text-[11px] text-purple-700 mt-0.5">
              Cumulative order value
            </p>
          </div>

          <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Delivered Qty</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-black text-emerald-950 mt-1">
              {summaryMetrics.totalDeliveredQty.toLocaleString()} <span className="text-xs font-normal text-emerald-600">PCS</span>
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Progress: <span className="font-bold">{summaryMetrics.overallDeliveryRate}%</span> completed
            </p>
          </div>

          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-100 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Remaining Balance</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xl font-black text-amber-950 mt-1">
              {summaryMetrics.totalBalanceQty.toLocaleString()} <span className="text-xs font-normal text-amber-700">PCS</span>
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Pending shipment to client
            </p>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4 print:hidden">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-neutral-800">Filter Order Bookings</h3>
          </div>
          {(selectedCustomerId !== 'all' || selectedSectionId !== 'all' || selectedBuyerId !== 'all' || selectedStatus !== 'all' || deliveryFilter !== 'all' || dateFrom || dateTo || searchTerm) && (
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
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
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
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
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
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Buyers ({buyers.length})</option>
              {buyers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Delivery Status */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-600 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" /> Delivery Status
            </label>
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Deliveries</option>
              <option value="pending">Pending Delivery (0%)</option>
              <option value="partial">Partially Delivered (&gt;0%)</option>
              <option value="fully">Fully Delivered (100%)</option>
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
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
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
              className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by WO No, Order No, PO No, Style, Product Name, Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-neutral-200 text-xs text-neutral-900 bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Main Data Table Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-neutral-700">Displaying Orders:</span>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 text-xs font-black rounded-md">
              {filteredRows.length} of {workOrders.length}
            </span>
          </div>

          <div className="text-xs text-neutral-500 hidden sm:block">
            Click on any row to view breakdown and delivery details.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/70 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3 cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('woNumber')}>
                  <div className="flex items-center gap-1">
                    <span>WO / Job No</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">
                    <span>Order Date</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('customerName')}>
                  <div className="flex items-center gap-1">
                    <span>Customer & Section</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3">Buyer & PO No</th>
                <th className="p-3">Product / Style</th>
                <th className="p-3 text-right cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('totalQuantity')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Booking Qty</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 text-right cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('totalAmount')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Value (Tk)</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 text-right cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('deliveredQty')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Delivered</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 text-right cursor-pointer hover:bg-neutral-200/60 transition-colors" onClick={() => handleSort('balanceQty')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Balance Qty</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="p-3 text-center">Delivery Progress</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {filteredRows.map((row) => (
                <tr 
                  key={row.id} 
                  className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  onClick={() => setModalWo(row)}
                >
                  <td className="p-3">
                    <div className="font-mono font-bold text-neutral-900">{row.woNumber}</div>
                    {row.orderNo && (
                      <div className="text-[10px] text-neutral-400 font-mono">SO: {row.orderNo}</div>
                    )}
                  </td>

                  <td className="p-3 whitespace-nowrap text-neutral-600">
                    <div>{row.date || 'N/A'}</div>
                    {row.deliveryDate && (
                      <div className="text-[10px] text-amber-700 font-semibold">
                        Exp: {row.deliveryDate}
                      </div>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="font-bold text-neutral-900">{row.customerName || 'Unknown Customer'}</div>
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded mt-0.5">
                      {row.sectionName || 'General Section'}
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="font-medium text-neutral-800">{row.buyerName || '-'}</div>
                    {row.poNo && (
                      <div className="text-[10px] text-neutral-500 font-mono">PO: {row.poNo}</div>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-neutral-900">{row.finishedGoodsName || 'Custom Product'}</div>
                    {row.style && (
                      <div className="text-[10px] text-purple-700 font-bold">Style: {row.style}</div>
                    )}
                  </td>

                  <td className="p-3 text-right font-black text-neutral-900">
                    {(Number(row.totalQuantity) || 0).toLocaleString()}
                    <span className="text-[10px] font-normal text-neutral-400 ml-1">{row.finishedGoodsUnit || 'PCS'}</span>
                  </td>

                  <td className="p-3 text-right font-bold text-neutral-900">
                    ৳ {(Number(row.totalAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </td>

                  <td className="p-3 text-right font-black text-emerald-700">
                    {row.deliveredQty.toLocaleString()}
                  </td>

                  <td className="p-3 text-right font-black text-amber-700">
                    {row.balanceQty.toLocaleString()}
                  </td>

                  <td className="p-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        row.deliveryStatusText === 'Fully Delivered'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : row.deliveryStatusText === 'Partially Delivered'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                      }`}>
                        {row.deliveryStatusText}
                      </span>
                      
                      <div className="w-20 bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full ${
                            row.deliveryPercentage >= 100 ? 'bg-emerald-500' : row.deliveryPercentage > 0 ? 'bg-blue-500' : 'bg-neutral-300'
                          }`}
                          style={{ width: `${row.deliveryPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="p-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setModalWo(row)}
                      className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-neutral-400 italic">
                    No booking records found matching the applied filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WO Detail & Delivery Challan History Modal */}
      {modalWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <ShoppingBag className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Work Order: {modalWo.woNumber}</h3>
                  <p className="text-xs text-indigo-200">
                    Customer: {modalWo.customerName} • Section: {modalWo.sectionName || 'General'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalWo(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Order Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Sales Order / Job</span>
                  <span className="font-bold text-neutral-900 font-mono text-sm">{modalWo.orderNo || modalWo.woNumber}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Customer PO No</span>
                  <span className="font-bold text-neutral-900 font-mono text-sm">{modalWo.poNo || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Order Date</span>
                  <span className="font-bold text-neutral-900">{modalWo.date}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block uppercase font-bold text-[10px]">Expected Delivery</span>
                  <span className="font-bold text-amber-700">{modalWo.deliveryDate || 'N/A'}</span>
                </div>
              </div>

              {/* Breakdown Rows Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-neutral-800 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  Item Breakdown & Size/Color Matrix
                </h4>

                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                      <tr>
                        <th className="p-2.5">Style</th>
                        <th className="p-2.5">Color</th>
                        <th className="p-2.5">Size</th>
                        <th className="p-2.5 text-right">Order Qty</th>
                        <th className="p-2.5 text-right">Unit Rate</th>
                        <th className="p-2.5 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {(modalWo.breakdownRows || []).map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="p-2.5 font-bold text-neutral-900">{row.style || modalWo.style || '-'}</td>
                          <td className="p-2.5 text-neutral-700">{row.color || '-'}</td>
                          <td className="p-2.5 font-mono font-bold text-indigo-700">{row.size || '-'}</td>
                          <td className="p-2.5 text-right font-bold text-neutral-900">{row.quantity.toLocaleString()} {row.unit}</td>
                          <td className="p-2.5 text-right text-neutral-700">৳ {row.rate}</td>
                          <td className="p-2.5 text-right font-black text-neutral-900">৳ {row.total.toLocaleString()}</td>
                        </tr>
                      ))}
                      {(!modalWo.breakdownRows || modalWo.breakdownRows.length === 0) && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-neutral-400 italic">
                            Total Order Quantity: {modalWo.totalQuantity} {modalWo.finishedGoodsUnit || 'PCS'} @ ৳{modalWo.rate || 0}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Delivery Challans */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-neutral-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Delivery History & Issued Challans
                </h4>

                {(() => {
                  const woChallans = challansByWoMap.get(modalWo.id) || challansByWoMap.get(modalWo.woNumber) || [];
                  if (woChallans.length === 0) {
                    return (
                      <div className="p-6 bg-neutral-50 rounded-xl border border-neutral-200 text-center text-neutral-400 italic">
                        No delivery challans have been issued yet for this work order.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                          <tr>
                            <th className="p-2.5">Challan No</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Vehicle / Driver</th>
                            <th className="p-2.5 text-right">Challan Qty</th>
                            <th className="p-2.5">Receipt Status</th>
                            <th className="p-2.5">Prepared By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {woChallans.map((ch) => (
                            <tr key={ch.id} className="hover:bg-neutral-50">
                              <td className="p-2.5 font-bold font-mono text-indigo-700">{ch.challanNo}</td>
                              <td className="p-2.5 text-neutral-700">{ch.challanDate}</td>
                              <td className="p-2.5 text-neutral-700">{ch.vehicleNo} ({ch.driverName})</td>
                              <td className="p-2.5 text-right font-black text-emerald-700">
                                {ch.currentDeliveryQty} {ch.unit || 'PCS'}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  ch.receivedStatus === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
                                }`}>
                                  {ch.receivedStatus || 'Pending Acknowledgment'}
                                </span>
                              </td>
                              <td className="p-2.5 text-neutral-500">{ch.preparedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
              <div className="text-xs font-bold text-neutral-600">
                Order Value: <span className="text-indigo-600 font-black">৳ {modalWo.totalAmount?.toLocaleString()}</span>
              </div>

              <div className="flex items-center gap-2">
                {onViewWorkOrder && (
                  <button
                    onClick={() => {
                      onViewWorkOrder(modalWo);
                      setModalWo(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors"
                  >
                    Open in Entry Form
                  </button>
                )}
                <button
                  onClick={() => setModalWo(null)}
                  className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
