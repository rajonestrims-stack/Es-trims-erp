import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  Layers, 
  FileText, 
  Truck, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  Palette, 
  Scissors, 
  Sparkles, 
  AlertTriangle, 
  Building2, 
  ArrowRight,
  Plus,
  TrendingDown,
  FolderTree,
  ArrowDownToLine,
  Check
} from 'lucide-react';
import { 
  SubContractCategory, 
  SubContractSubCategory,
  SubContractIssue, 
  SubContractItem, 
  SubContractOrder, 
  SubContractPrice, 
  SubContractPurchaseOrder, 
  SubContractReceive, 
  Supplier 
} from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SubContractDashboardProps {
  orders: SubContractOrder[];
  purchaseOrders: SubContractPurchaseOrder[];
  issues: SubContractIssue[];
  receives: SubContractReceive[];
  categories: SubContractCategory[];
  subCategories?: SubContractSubCategory[];
  items: SubContractItem[];
  prices: SubContractPrice[];
  suppliers: Supplier[];
  onNavigateTab: (tab: string) => void;
  isEditor: boolean;
  isTabPermitted?: (tab: string) => boolean;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export const SubContractDashboard: React.FC<SubContractDashboardProps> = ({
  orders,
  purchaseOrders,
  issues,
  receives,
  categories,
  subCategories = [],
  items,
  prices,
  suppliers,
  onNavigateTab,
  isEditor,
  isTabPermitted
}) => {
  const canAccessTab = (tab: string) => {
    if (!isTabPermitted) return true;
    return isTabPermitted(tab);
  };
  // Aggregate Metrics from Sub Contract POs + Orders
  const allPOs = purchaseOrders || [];
  const totalPOsCount = allPOs.length + orders.length;

  // Calculate Total Ordered Quantity across all POs & Orders
  const totalPOOrderedQty = allPOs.reduce((s, p) => {
    const itSum = p.items?.reduce((is, it) => is + (Number(it.quantity) || 0), 0) || 0;
    return s + (p.totalQuantity || itSum);
  }, 0);
  const totalOrderOrderedQty = orders.reduce((s, o) => s + (Number(o.totalQuantity) || 0), 0);
  const totalOrderedQty = totalPOOrderedQty + totalOrderOrderedQty;

  // Calculate Total Received Quantity across all POs, Orders & Receives
  const totalPORcvQty = allPOs.reduce((s, p) => {
    const itSum = p.items?.reduce((is, it) => is + (Number(it.receivedQuantity) || 0), 0) || 0;
    return s + (p.receivedQuantity || itSum);
  }, 0);
  const totalOrderRcvQty = orders.reduce((s, o) => s + (Number(o.receivedQuantity) || 0), 0);
  const totalReceiveCollectionQty = receives.reduce((s, r) => s + (Number(r.receivedQuantity) || 0), 0);
  const totalReceivedQty = Math.max(totalPORcvQty + totalOrderRcvQty, totalReceiveCollectionQty);

  const balancePendingQty = Math.max(0, totalOrderedQty - totalReceivedQty);
  const fulfillmentRate = totalOrderedQty > 0 ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100)) : 0;

  // Financial Values
  const totalPOValue = allPOs.reduce((s, p) => s + (Number(p.grandTotal) || 0), 0);
  const totalOrderValue = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalSubcontractValue = totalPOValue + totalOrderValue;

  // Process Type Breakdown
  const dyeingQty = allPOs.filter(p => p.orderType === 'dyeing').reduce((s, p) => s + (p.items?.reduce((is, it) => is + (Number(it.quantity) || 0), 0) || p.totalQuantity || 0), 0)
    + orders.filter(o => o.orderType === 'dyeing').reduce((s, o) => s + (Number(o.totalQuantity) || 0), 0);

  const wovenQty = allPOs.filter(p => p.orderType === 'woven').reduce((s, p) => s + (p.items?.reduce((is, it) => is + (Number(it.quantity) || 0), 0) || p.totalQuantity || 0), 0)
    + orders.filter(o => o.orderType === 'woven').reduce((s, o) => s + (Number(o.totalQuantity) || 0), 0);

  const embroideryQty = allPOs.filter(p => p.orderType === 'embroidery').reduce((s, p) => s + (p.items?.reduce((is, it) => is + (Number(it.quantity) || 0), 0) || p.totalQuantity || 0), 0)
    + orders.filter(o => o.orderType === 'embroidery').reduce((s, o) => s + (Number(o.totalQuantity) || 0), 0);

  const printingQty = allPOs.filter(p => p.orderType === 'printing' || p.orderType === 'washing' || p.orderType === 'finishing' || p.orderType === 'other').reduce((s, p) => s + (p.items?.reduce((is, it) => is + (Number(it.quantity) || 0), 0) || p.totalQuantity || 0), 0)
    + orders.filter(o => o.orderType === 'printing' || o.orderType === 'other').reduce((s, o) => s + (Number(o.totalQuantity) || 0), 0);

  const processPieData = [
    { name: 'Dyeing & Washing', value: dyeingQty, color: '#ec4899' },
    { name: 'Woven & Narrow Fabric', value: wovenQty, color: '#6366f1' },
    { name: 'Embroidery', value: embroideryQty, color: '#f59e0b' },
    { name: 'Printing & Other', value: printingQty, color: '#10b981' }
  ].filter(d => d.value > 0);

  // Supplier Breakdown for Ordered vs Received
  const supplierVolumeMap: { [supName: string]: { ordered: number; received: number; balance: number; poCount: number } } = {};

  suppliers.forEach(s => {
    supplierVolumeMap[s.name] = { ordered: 0, received: 0, balance: 0, poCount: 0 };
  });

  allPOs.forEach(po => {
    const sName = po.supplierName || 'Unknown';
    if (!supplierVolumeMap[sName]) {
      supplierVolumeMap[sName] = { ordered: 0, received: 0, balance: 0, poCount: 0 };
    }
    const ord = po.items?.reduce((is, it) => is + (Number(it.quantity) || 0), 0) || (po.totalQuantity || 0);
    const rcv = po.items?.reduce((is, it) => is + (Number(it.receivedQuantity) || 0), 0) || (po.receivedQuantity || 0);
    supplierVolumeMap[sName].ordered += ord;
    supplierVolumeMap[sName].received += rcv;
    supplierVolumeMap[sName].balance += Math.max(0, ord - rcv);
    supplierVolumeMap[sName].poCount += 1;
  });

  orders.forEach(o => {
    const sName = o.supplierName || 'Unknown';
    if (!supplierVolumeMap[sName]) {
      supplierVolumeMap[sName] = { ordered: 0, received: 0, balance: 0, poCount: 0 };
    }
    const ord = Number(o.totalQuantity) || 0;
    const rcv = Number(o.receivedQuantity) || 0;
    supplierVolumeMap[sName].ordered += ord;
    supplierVolumeMap[sName].received += rcv;
    supplierVolumeMap[sName].balance += Math.max(0, ord - rcv);
    supplierVolumeMap[sName].poCount += 1;
  });

  const supplierChartData = Object.entries(supplierVolumeMap)
    .filter(([_, data]) => data.ordered > 0)
    .map(([name, data]) => ({
      supplierName: name,
      ordered: data.ordered,
      received: data.received,
      balance: data.balance,
      poCount: data.poCount
    }))
    .sort((a, b) => b.ordered - a.ordered)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-indigo-950 p-6 rounded-2xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold tracking-wide uppercase border border-indigo-500/30">
            <Layers className="w-3.5 h-3.5" />
            Unified Subcontract Management
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">Sub Contract Dashboard</h2>
          <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
            Monitor total ordered volume vs received goods across Dyeing, Woven, Embroidery, and Printing purchase orders. Track subcontractor fulfillment rates and contract pricing in real-time.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {canAccessTab('purchase_order') && (
            <Button
              size="sm"
              onClick={() => onNavigateTab('subcontract_purchase_order')}
              className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-sm gap-1.5"
            >
              <FileText className="w-4 h-4" />
              Sub Contract POs
            </Button>
          )}

          {canAccessTab('subcategory_master') && (
            <Button
              size="sm"
              onClick={() => onNavigateTab('subcategory_master')}
              className="h-9 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-xl gap-1.5"
            >
              <FolderTree className="w-4 h-4 text-indigo-400" />
              Sub-Category Master
            </Button>
          )}

          {canAccessTab('price_master') && (
            <Button
              size="sm"
              onClick={() => onNavigateTab('price_master')}
              className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl gap-1.5"
            >
              <DollarSign className="w-4 h-4" />
              Price Master
            </Button>
          )}
        </div>
      </div>

      {/* Primary KPI Grid: Ordered vs Received */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ordered Volume */}
        <Card className="p-4 bg-white border border-neutral-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total Ordered Volume</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-black text-indigo-700">{totalOrderedQty.toLocaleString()}</p>
            <span className="text-xs font-bold text-neutral-500">Units / KG</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>POs: <strong className="text-neutral-800">{totalPOsCount}</strong></span>
            <span>Total Value: <strong className="text-emerald-700">৳{totalSubcontractValue.toLocaleString()}</strong></span>
          </div>
        </Card>

        {/* Total Received Volume */}
        <Card className="p-4 bg-white border border-neutral-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total Received (MRR)</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-black text-emerald-700">{totalReceivedQty.toLocaleString()}</p>
            <span className="text-xs font-black text-emerald-600">{fulfillmentRate}% Fulfilled</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${fulfillmentRate}%` }}
            />
          </div>
        </Card>

        {/* Balance Pending Quantity */}
        <Card className="p-4 bg-white border border-neutral-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Pending Receive Balance</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-black text-amber-700">{balancePendingQty.toLocaleString()}</p>
            <span className="text-xs font-bold text-amber-600">Pending</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500">
            <span className="text-neutral-500">Pending vendor delivery to factory</span>
          </div>
        </Card>

        {/* Price Master Coverage */}
        <Card className="p-4 bg-white border border-neutral-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Contract Prices & Sub-Cats</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-black text-purple-700">{prices.length}</p>
            <span className="text-xs font-bold text-neutral-400">Rates Defined</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Sub-Cats: <strong className="text-neutral-800">{subCategories.length}</strong></span>
            <span>Vendors: <strong className="text-neutral-800">{suppliers.length}</strong></span>
          </div>
        </Card>
      </div>

      {/* Visual Charts: Ordered vs Received by Vendor & Process Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Process Types Distribution */}
        <Card className="p-5 bg-white border border-neutral-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Volume by Order Type</h3>
              <p className="text-[11px] text-neutral-500">Ordered quantities distribution</p>
            </div>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            {processPieData.length === 0 ? (
              <p className="text-xs text-neutral-400">No volume data available</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={processPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {processPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [`${Number(val).toLocaleString()} Units`, 'Ordered Qty']}
                    contentStyle={{ borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Legend 
                    formatter={(val) => <span className="text-xs text-neutral-700 font-medium">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Subcontractor Ordered vs Received Bar Chart */}
        <Card className="lg:col-span-2 p-5 bg-white border border-neutral-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Vendor Volume: Ordered vs. Received</h3>
              <p className="text-[11px] text-neutral-500">Track how much order was placed vs received per subcontractor</p>
            </div>
            {canAccessTab('purchase_order') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab('subcontract_purchase_order')}
                className="h-8 text-xs text-neutral-600 gap-1 rounded-xl"
              >
                View All POs
                <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>

          <div className="h-64 w-full">
            {supplierChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                No vendor order activities recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="supplierName" 
                    tick={{ fontSize: 10, fill: '#737373' }} 
                    angle={-15} 
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#737373' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val: any) => [Number(val).toLocaleString(), '']}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    wrapperStyle={{ paddingBottom: '10px' }}
                    formatter={(val) => <span className="text-xs text-neutral-600 font-medium">{val}</span>}
                  />
                  <Bar dataKey="ordered" name="Ordered Qty" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="received" name="Received Qty" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="balance" name="Balance Due" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Sub Contract POs Pipeline */}
      <Card className="p-5 bg-white border border-neutral-200 shadow-sm rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Sub Contract Purchase Orders Pipeline</h3>
            <p className="text-[11px] text-neutral-500">Live fulfillment status, ordered quantity, and goods received</p>
          </div>
          {canAccessTab('purchase_order') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('subcontract_purchase_order')}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              Manage Purchase Orders
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-3">PO Number & Type</th>
                <th className="py-2.5 px-3">Subcontractor</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                <th className="py-2.5 px-3 text-right">Received Qty</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3 text-center">Fulfillment</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {allPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    No subcontract purchase orders recorded yet.
                  </td>
                </tr>
              ) : (
                allPOs.slice(0, 6).map((po) => {
                  const ordQty = po.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || po.totalQuantity || 0;
                  const rcvQty = po.items?.reduce((s, it) => s + (Number(it.receivedQuantity) || 0), 0) || po.receivedQuantity || 0;
                  const bal = Math.max(0, ordQty - rcvQty);
                  const pct = ordQty > 0 ? Math.min(100, Math.round((rcvQty / ordQty) * 100)) : 0;

                  return (
                    <tr key={po.id} className="hover:bg-neutral-50/70">
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-neutral-900">{po.poNumber}</div>
                        <span className="text-[10px] uppercase font-bold text-indigo-600">{po.orderType}</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-neutral-900">
                        {po.supplierName}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">
                        {po.poDate}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                        {ordQty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {rcvQty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                        {bal.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-20 bg-neutral-100 rounded-full h-1.5 mx-auto overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500">{pct}%</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pct >= 100
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : pct > 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {pct >= 100 ? 'Fully Received' : pct > 0 ? 'Partial Received' : 'Confirmed'}
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
    </div>
  );
};
