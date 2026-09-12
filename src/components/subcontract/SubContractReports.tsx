import React, { useState } from 'react';
import { printElement } from '../../utils/printHelper';
import { 
  BarChart3, 
  Search, 
  Download, 
  Printer, 
  Filter, 
  Calendar, 
  Building2, 
  Layers, 
  CheckCircle2, 
  Clock, 
  TrendingDown, 
  DollarSign, 
  FileText,
  Scale
} from 'lucide-react';
import { 
  SubContractCategory, 
  SubContractIssue, 
  SubContractItem, 
  SubContractOrder, 
  SubContractPrice, 
  SubContractPurchaseOrder, 
  SubContractReceive, 
  Supplier, 
  UserProfile 
} from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface SubContractReportsProps {
  orders: SubContractOrder[];
  purchaseOrders: SubContractPurchaseOrder[];
  issues: SubContractIssue[];
  receives: SubContractReceive[];
  categories: SubContractCategory[];
  items: SubContractItem[];
  prices: SubContractPrice[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type ReportType = 'supplier_summary' | 'order_pending' | 'qc_rejections' | 'price_comparison';

export const SubContractReports: React.FC<SubContractReportsProps> = ({
  orders,
  purchaseOrders,
  issues,
  receives,
  categories,
  items,
  prices,
  suppliers,
  userProfile,
  showToast
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('supplier_summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 1. Supplier-wise Summary
  const supplierSummaryData = suppliers.map(sup => {
    let supOrders = orders.filter(o => o.supplierId === sup.id);
    if (typeFilter !== 'all') supOrders = supOrders.filter(o => o.orderType === typeFilter);
    if (fromDate) supOrders = supOrders.filter(o => o.orderDate >= fromDate);
    if (toDate) supOrders = supOrders.filter(o => o.orderDate <= toDate);

    const orderCount = supOrders.length;
    const orderedQty = supOrders.reduce((s, o) => s + (o.totalQuantity || 0), 0);
    const receivedQty = supOrders.reduce((s, o) => s + (o.receivedQuantity || 0), 0);
    const balanceQty = Math.max(0, orderedQty - receivedQty);
    const totalAmount = supOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const fulfillmentPct = orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : 0;

    return {
      supplierId: sup.id,
      supplierName: sup.name,
      orderCount,
      orderedQty,
      receivedQty,
      balanceQty,
      totalAmount,
      fulfillmentPct
    };
  }).filter(s => s.orderCount > 0 && (supplierFilter === 'all' || s.supplierId === supplierFilter));

  // 2. Order-wise Pending
  const orderPendingData = orders.filter(o => {
    const matchesSupplier = supplierFilter === 'all' || o.supplierId === supplierFilter;
    const matchesType = typeFilter === 'all' || o.orderType === typeFilter;
    const matchesFrom = !fromDate || o.orderDate >= fromDate;
    const matchesTo = !toDate || o.orderDate <= toDate;
    const matchesSearch = 
      o.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.buyerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.style || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSupplier && matchesType && matchesFrom && matchesTo && matchesSearch;
  });

  // 3. QC & Process Loss
  const qcRejectionData = receives.filter(r => {
    const matchesSupplier = supplierFilter === 'all' || r.supplierId === supplierFilter;
    const matchesFrom = !fromDate || r.receiveDate >= fromDate;
    const matchesTo = !toDate || r.receiveDate <= toDate;
    const matchesSearch = 
      r.receiveChallanNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.subContractOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSupplier && matchesFrom && matchesTo && matchesSearch;
  });

  // 4. Price Comparison Matrix
  const priceComparisonData = items.map(item => {
    const activePrices = prices.filter(p => p.itemId === item.id && p.status === 'active');
    const sorted = [...activePrices].sort((a, b) => a.contractPrice - b.contractPrice);
    const minPrice = sorted[0];
    const maxPrice = sorted[sorted.length - 1];

    return {
      item,
      activePrices,
      lowestPrice: minPrice ? minPrice.contractPrice : null,
      lowestSupplier: minPrice ? minPrice.supplierName : 'N/A',
      highestPrice: maxPrice ? maxPrice.contractPrice : null,
      highestSupplier: maxPrice ? maxPrice.supplierName : 'N/A',
      supplierCount: activePrices.length
    };
  }).filter(p => p.supplierCount > 0 && (
    p.item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.item.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const dateStr = new Date().toISOString().split('T')[0];

    if (activeReport === 'supplier_summary') {
      headers = ['Supplier Name', 'Total Orders', 'Ordered Qty', 'Received Qty', 'Balance Qty', 'Fulfillment %', 'Total Amount (BDT)'];
      rows = supplierSummaryData.map(s => [
        `"${s.supplierName}"`,
        s.orderCount,
        s.orderedQty,
        s.receivedQty,
        s.balanceQty,
        `${s.fulfillmentPct}%`,
        s.totalAmount
      ]);
    } else if (activeReport === 'order_pending') {
      headers = ['Order No', 'Type', 'Date', 'Supplier', 'Buyer', 'Style', 'Ordered Qty', 'Received Qty', 'Balance Qty', 'Amount', 'Status'];
      rows = orderPendingData.map(o => [
        `"${o.orderNo}"`,
        `"${o.orderType}"`,
        `"${o.orderDate}"`,
        `"${o.supplierName}"`,
        `"${o.buyerName || ''}"`,
        `"${o.style || ''}"`,
        o.totalQuantity,
        o.receivedQuantity || 0,
        o.balanceQuantity !== undefined ? o.balanceQuantity : (o.totalQuantity - (o.receivedQuantity || 0)),
        o.totalAmount,
        `"${o.status}"`
      ]);
    } else if (activeReport === 'qc_rejections') {
      headers = ['Receive Challan', 'Date', 'Supplier', 'Order Ref', 'Received Qty', 'Accepted Qty', 'Rejected Qty', 'Loss %', 'QC Status', 'Payable Amount'];
      rows = qcRejectionData.map(r => [
        `"${r.receiveChallanNo}"`,
        `"${r.receiveDate}"`,
        `"${r.supplierName}"`,
        `"${r.subContractOrderNo || ''}"`,
        r.totalReceivedQuantity,
        r.totalAcceptedQuantity,
        r.totalRejectedQuantity,
        `${r.processLossPercent || 0}%`,
        `"${r.qcStatus}"`,
        r.totalAmount
      ]);
    } else if (activeReport === 'price_comparison') {
      headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Contracted Suppliers', 'Lowest Rate', 'Lowest Rate Supplier', 'Highest Rate', 'Highest Rate Supplier'];
      rows = priceComparisonData.map(p => [
        `"${p.item.itemCode}"`,
        `"${p.item.itemName}"`,
        `"${p.item.categoryName}"`,
        `"${p.item.unit}"`,
        p.supplierCount,
        p.lowestPrice || 0,
        `"${p.lowestSupplier}"`,
        p.highestPrice || 0,
        `"${p.highestSupplier}"`
      ]);
    }

    if (rows.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subcontract_report_${activeReport}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    printElement('printable-subcontract-report', { title: `SubContract_${activeReport}_Report`, pageOrientation: 'landscape' });
  };

  return (
    <div id="printable-subcontract-report" className="printable-doc space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Sub Contract Reporting & Analytics</h2>
              <p className="text-xs text-neutral-500">Comprehensive audit summaries, subcontractor balances, quality rejection rates, and price comparison matrix</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs font-bold bg-neutral-900 hover:bg-black text-white shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3 print:hidden">
        <button
          onClick={() => setActiveReport('supplier_summary')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'supplier_summary'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Supplier-wise Summary
        </button>

        <button
          onClick={() => setActiveReport('order_pending')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'order_pending'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Order Fulfillment & Balance
        </button>

        <button
          onClick={() => setActiveReport('qc_rejections')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'qc_rejections'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          QC & Rejection Analysis
        </button>

        <button
          onClick={() => setActiveReport('price_comparison')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'price_comparison'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          Price Comparison Matrix
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-neutral-200 print:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search report..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-neutral-50 border-neutral-200"
          />
        </div>

        <div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Subcontractors</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Process Types</option>
            <option value="dyeing">Dyeing</option>
            <option value="woven">Woven</option>
            <option value="embroidery">Embroidery</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            placeholder="From"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 text-xs bg-neutral-50"
          />
          <span className="text-neutral-400 text-xs">to</span>
          <Input
            type="date"
            placeholder="To"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 text-xs bg-neutral-50"
          />
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block mb-6 border-b-2 border-neutral-900 pb-4">
        <h1 className="text-2xl font-black">ES TRIMS LIMITED</h1>
        <p className="text-xs text-neutral-600">Sub Contract Management Division — Report: {activeReport.toUpperCase().replace('_', ' ')}</p>
        <p className="text-[11px] text-neutral-500 mt-1">Generated on {new Date().toLocaleString()} by {userProfile.displayName || 'Admin'}</p>
      </div>

      {/* Report Table 1: Supplier Summary */}
      {activeReport === 'supplier_summary' && (
        <Card className="overflow-hidden border border-neutral-200 bg-white">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Subcontractor Total Performance Matrix</h3>
              <p className="text-[11px] text-neutral-500">Aggregated order volume, delivered quantities, and pending balances</p>
            </div>
            <span className="text-xs font-bold text-neutral-500">
              {supplierSummaryData.length} Subcontractors Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Subcontractor Name</th>
                  <th className="py-3 px-4 text-center">Orders Count</th>
                  <th className="py-3 px-4 text-right">Total Ordered</th>
                  <th className="py-3 px-4 text-right">Total Received</th>
                  <th className="py-3 px-4 text-right">Pending Balance</th>
                  <th className="py-3 px-4 text-center">Fulfillment %</th>
                  <th className="py-3 px-4 text-right">Total Payable (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {supplierSummaryData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-400">No subcontractor summary data found.</td>
                  </tr>
                ) : (
                  supplierSummaryData.map((sup, idx) => (
                    <tr key={sup.supplierId} className="hover:bg-neutral-50/70">
                      <td className="py-3 px-4 text-neutral-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">{sup.supplierName}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-700">{sup.orderCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">{sup.orderedQty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{sup.receivedQty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">{sup.balanceQty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          sup.fulfillmentPct >= 90 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {sup.fulfillmentPct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                        ৳{sup.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-neutral-50 font-bold border-t border-neutral-200">
                <tr>
                  <td colSpan={2} className="py-3 px-4 uppercase text-neutral-700">Grand Total:</td>
                  <td className="py-3 px-4 text-center font-mono">{supplierSummaryData.reduce((s, i) => s + i.orderCount, 0)}</td>
                  <td className="py-3 px-4 text-right font-mono">{supplierSummaryData.reduce((s, i) => s + i.orderedQty, 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">{supplierSummaryData.reduce((s, i) => s + i.receivedQty, 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono text-amber-700">{supplierSummaryData.reduce((s, i) => s + i.balanceQty, 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-center font-mono">-</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-800">
                    ৳{supplierSummaryData.reduce((s, i) => s + i.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Report Table 2: Order Fulfillment & Pending */}
      {activeReport === 'order_pending' && (
        <Card className="overflow-hidden border border-neutral-200 bg-white">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Order-wise Fulfillment & Pending Balance Report</h3>
              <p className="text-[11px] text-neutral-500">Individual subcontract work order tracking with receipt status</p>
            </div>
            <span className="text-xs font-bold text-neutral-500">
              {orderPendingData.length} Orders Listed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Order No</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subcontractor</th>
                  <th className="py-3 px-4">Buyer & Style</th>
                  <th className="py-3 px-4 text-right">Ordered</th>
                  <th className="py-3 px-4 text-right">Received</th>
                  <th className="py-3 px-4 text-right">Balance Pending</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {orderPendingData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-400">No matching orders found.</td>
                  </tr>
                ) : (
                  orderPendingData.map((order) => {
                    const rcv = order.receivedQuantity || 0;
                    const bal = order.balanceQuantity !== undefined ? order.balanceQuantity : Math.max(0, order.totalQuantity - rcv);
                    return (
                      <tr key={order.id} className="hover:bg-neutral-50/70">
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">{order.orderNo}</td>
                        <td className="py-3 px-4 uppercase text-[10px] font-bold text-neutral-500">{order.orderType}</td>
                        <td className="py-3 px-4 text-neutral-600">{order.orderDate}</td>
                        <td className="py-3 px-4 font-bold text-neutral-900">{order.supplierName}</td>
                        <td className="py-3 px-4 text-neutral-700">
                          <div>{order.buyerName || '-'}</div>
                          {order.style && <div className="text-[10px] text-neutral-400">St: {order.style}</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">{order.totalQuantity.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{rcv.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">{bal.toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Report Table 3: QC & Rejection Analysis */}
      {activeReport === 'qc_rejections' && (
        <Card className="overflow-hidden border border-neutral-200 bg-white">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Quality Inspection & Process Loss Audit</h3>
              <p className="text-[11px] text-neutral-500">Quality inspection logs with defect rejection quantities and process loss percentages</p>
            </div>
            <span className="text-xs font-bold text-neutral-500">
              {qcRejectionData.length} Inspections
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Receive Challan</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subcontractor</th>
                  <th className="py-3 px-4">Order Link</th>
                  <th className="py-3 px-4 text-right">Rcvd Qty</th>
                  <th className="py-3 px-4 text-right">Accepted Qty</th>
                  <th className="py-3 px-4 text-right">Rejected Qty</th>
                  <th className="py-3 px-4 text-center">Loss %</th>
                  <th className="py-3 px-4 text-center">QC Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {qcRejectionData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-400">No QC records logged.</td>
                  </tr>
                ) : (
                  qcRejectionData.map((rec) => (
                    <tr key={rec.id} className="hover:bg-neutral-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900">{rec.receiveChallanNo}</td>
                      <td className="py-3 px-4 text-neutral-600">{rec.receiveDate}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">{rec.supplierName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{rec.subContractOrderNo || '-'}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{rec.totalReceivedQuantity.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{rec.totalAcceptedQuantity.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">{rec.totalRejectedQuantity > 0 ? rec.totalRejectedQuantity.toLocaleString() : '0'}</td>
                      <td className="py-3 px-4 text-center font-mono">{rec.processLossPercent || 0}%</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rec.qcStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {rec.qcStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Report Table 4: Price Comparison Matrix */}
      {activeReport === 'price_comparison' && (
        <Card className="overflow-hidden border border-neutral-200 bg-white">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Sub Contract Price Comparison Matrix</h3>
              <p className="text-[11px] text-neutral-500">Benchmark contract rates across suppliers for identical outsourced items</p>
            </div>
            <span className="text-xs font-bold text-neutral-500">
              {priceComparisonData.length} Items Priced
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Item Code & Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-center">Vendors Contracted</th>
                  <th className="py-3 px-4 text-right">Lowest Rate (BDT)</th>
                  <th className="py-3 px-4">Best Vendor</th>
                  <th className="py-3 px-4 text-right">Highest Rate (BDT)</th>
                  <th className="py-3 px-4">Highest Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {priceComparisonData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-400">No priced subcontract items found.</td>
                  </tr>
                ) : (
                  priceComparisonData.map((p, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/70">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-600 mr-1.5">{p.item.itemCode}</span>
                        <span className="font-bold text-neutral-900">{p.item.itemName}</span>
                      </td>
                      <td className="py-3 px-4 text-neutral-600">{p.item.categoryName}</td>
                      <td className="py-3 px-4 text-center uppercase font-bold text-neutral-500">{p.item.unit}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-700">{p.supplierCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                        ৳{p.lowestPrice ? p.lowestPrice.toFixed(2) : '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-900">{p.lowestSupplier}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-500">
                        ৳{p.highestPrice ? p.highestPrice.toFixed(2) : '-'}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">{p.highestSupplier}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
