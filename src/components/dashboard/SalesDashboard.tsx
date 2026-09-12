import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  ChevronRight, 
  FileText, 
  ArrowUpRight, 
  DollarSign,
  Package,
  Layers,
  ExternalLink,
  Truck,
  Building2
} from 'lucide-react';
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
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { UserProfile } from '../../types';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { cn } from '../../lib/utils';

interface SalesDashboardProps {
  userProfile: UserProfile;
  onNavigate?: (tab: string) => void;
  allowedPagesSet?: Set<string>;
  compact?: boolean;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({
  userProfile,
  onNavigate,
  allowedPagesSet,
  compact = false
}) => {
  const isAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com' || userProfile.email === 'rajon.estrims@gmail.com';
  const hasPageAccess = (pageId: string) => {
    if (isAdmin) return true;
    if (!allowedPagesSet) return true;
    if (pageId === 'sales-create-order') {
      return allowedPagesSet.has('sales-create-order') || allowedPagesSet.has('sales-order-entry') || allowedPagesSet.has('sales');
    }
    if (pageId === 'sales-order-list') {
      return allowedPagesSet.has('sales-order-list') || allowedPagesSet.has('sales');
    }
    return allowedPagesSet.has(pageId);
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const businessId = userProfile?.businessId || 'default-business';

  useEffect(() => {
    if (!businessId) return;

    const qOrders = query(collection(db, 'work_orders'), where('businessId', '==', businessId));
    const qCustomers = query(collection(db, 'customers'), where('businessId', '==', businessId));
    const qBuyers = query(collection(db, 'buyers'), where('businessId', '==', businessId));
    const qCurrencies = query(collection(db, 'currencies'), where('businessId', '==', businessId));
    const qChallans = query(collection(db, 'delivery_challans'), where('businessId', '==', businessId));
    const qGatePasses = query(collection(db, 'gate_passes'), where('businessId', '==', businessId));

    const unsubOrders = onSnapshot(
      qOrders, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(data);
        setLoading(false);
      }, 
      (error) => {
        console.warn('Orders snapshot listener notice:', error.message);
        setLoading(false);
      }
    );

    const unsubCust = onSnapshot(
      qCustomers, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomers(data);
      },
      (error) => {
        console.warn('Customers snapshot listener notice:', error.message);
      }
    );

    const unsubBuyers = onSnapshot(
      qBuyers, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBuyers(data);
      },
      (error) => {
        console.warn('Buyers snapshot listener notice:', error.message);
      }
    );

    const unsubCurrencies = onSnapshot(
      qCurrencies,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCurrencies(data);
      },
      (error) => {
        console.warn('Currencies snapshot listener notice:', error.message);
      }
    );

    const unsubChallans = onSnapshot(
      qChallans,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChallans(data);
      },
      (error) => {
        console.warn('Challans snapshot listener notice:', error.message);
      }
    );

    const unsubGatePasses = onSnapshot(
      qGatePasses,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGatePasses(data);
      },
      (error) => {
        console.warn('Gate passes snapshot listener notice:', error.message);
      }
    );

    return () => {
      unsubOrders();
      unsubCust();
      unsubBuyers();
      unsubCurrencies();
      unsubChallans();
      unsubGatePasses();
    };
  }, [businessId]);

  // Maps for rapid lookup
  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers.forEach(c => {
      if (c.id) map[c.id] = c;
      if (c.name) map[c.name.toLowerCase().trim()] = c;
      if (c.customerCode) map[c.customerCode.toLowerCase().trim()] = c;
    });
    return map;
  }, [customers]);

  const currencyMap = useMemo(() => {
    const map: Record<string, any> = {};
    currencies.forEach(c => {
      const code = (c.code || (c as any).currencyCode || '').toUpperCase().trim();
      if (code) map[code] = c;
      if (c.id) map[c.id] = c;
    });
    return map;
  }, [currencies]);

  // Helper to determine order conversion rate & BDT value
  const getOrderConversionDetails = useMemo(() => {
    return (order: any) => {
      const originalAmt = Number(order.totalAmount) || 0;
      const currency = (order.currencyCode || order.currency || 'BDT').toUpperCase().trim();

      if (currency === 'BDT') {
        return {
          rate: 1,
          rateSource: 'BDT Local Currency',
          bdtValue: originalAmt,
          currency,
          originalAmt
        };
      }

      // 1. Direct order conversion rate if set
      if (order.conversionRate && Number(order.conversionRate) > 0) {
        const rate = Number(order.conversionRate);
        return {
          rate,
          rateSource: 'Order Specified Rate',
          bdtValue: originalAmt * rate,
          currency,
          originalAmt
        };
      }

      // 2. Customer specific rate
      const cust = 
        (order.customerId && customerMap[order.customerId]) ||
        (order.customerName && customerMap[order.customerName.toLowerCase().trim()]);

      if (cust) {
        if (cust.conversionRate && Number(cust.conversionRate) > 0) {
          const rate = Number(cust.conversionRate);
          return {
            rate,
            rateSource: `Customer Custom Rate (${cust.name})`,
            bdtValue: originalAmt * rate,
            currency,
            originalAmt
          };
        }
        if (cust.conversionRateBDT && Number(cust.conversionRateBDT) > 0) {
          const rate = Number(cust.conversionRateBDT);
          return {
            rate,
            rateSource: `Customer Custom Rate (${cust.name})`,
            bdtValue: originalAmt * rate,
            currency,
            originalAmt
          };
        }
        if (cust.currencyRates && cust.currencyRates[currency] && Number(cust.currencyRates[currency]) > 0) {
          const rate = Number(cust.currencyRates[currency]);
          return {
            rate,
            rateSource: `Customer Custom Rate (${cust.name})`,
            bdtValue: originalAmt * rate,
            currency,
            originalAmt
          };
        }
      }

      // 3. Global Currency Master rate
      const curMaster = currencyMap[currency];
      if (curMaster && curMaster.rateToBDT && Number(curMaster.rateToBDT) > 0) {
        const rate = Number(curMaster.rateToBDT);
        return {
          rate,
          rateSource: 'Currency Master Global Rate',
          bdtValue: originalAmt * rate,
          currency,
          originalAmt
        };
      }

      // 4. Standard Fallbacks
      let fallbackRate = 1;
      if (currency === 'USD') fallbackRate = 120;
      else if (currency === 'EUR') fallbackRate = 130;
      else if (currency === 'GBP') fallbackRate = 155;
      else if (currency === 'INR') fallbackRate = 1.45;
      else if (currency === 'CNY') fallbackRate = 17;

      return {
        rate: fallbackRate,
        rateSource: 'Default Baseline Rate',
        bdtValue: originalAmt * fallbackRate,
        currency,
        originalAmt
      };
    };
  }, [customerMap, currencyMap]);

  const stats = useMemo(() => {
    const totalOrdersCount = orders.length;
    let totalBookingValueBDT = 0;
    let totalBookingValueUSD = 0;
    let totalBookingValueEUR = 0;
    let totalBookingValueLocalBDT = 0;
    let customCustomerRateOrderCount = 0;
    let pendingCount = 0;
    let inProductionCount = 0;
    let completedCount = 0;
    let deliveredCount = 0;

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    let currentMonthBookingValueBDT = 0;
    let currentMonthOrderCount = 0;

    const customerSalesMap: Record<string, { name: string; value: number; count: number; customerId: string }> = {};
    const buyerVolumeMap: Record<string, { name: string; value: number; count: number }> = {};
    const monthlyTrendMap: Record<string, { month: string; orderDate: Date; value: number; count: number }> = {};

    // Initialize last 6 months for clean trend
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, 'MMM yyyy');
      monthlyTrendMap[key] = { month: key, orderDate: d, value: 0, count: 0 };
    }

    orders.forEach(order => {
      const status = (order.status || 'pending').toLowerCase();
      if (status.includes('pend') || status === 'draft') pendingCount++;
      else if (status.includes('prod') || status === 'in_progress') inProductionCount++;
      else if (status.includes('comp')) completedCount++;
      else if (status.includes('deliv') || status.includes('dispatch')) deliveredCount++;
      else pendingCount++;

      const { bdtValue, currency, originalAmt, rateSource } = getOrderConversionDetails(order);

      totalBookingValueBDT += bdtValue;
      if (currency === 'USD') totalBookingValueUSD += originalAmt;
      else if (currency === 'EUR') totalBookingValueEUR += originalAmt;
      else if (currency === 'BDT') totalBookingValueLocalBDT += originalAmt;

      if (rateSource.includes('Customer')) {
        customCustomerRateOrderCount++;
      }

      // Customer-wise sales distribution
      const custName = (order.customerName || 'Direct / Other').trim();
      const custId = order.customerId || custName;
      if (!customerSalesMap[custId]) {
        customerSalesMap[custId] = { name: custName, value: 0, count: 0, customerId: custId };
      }
      customerSalesMap[custId].value += bdtValue;
      customerSalesMap[custId].count += 1;

      // Parse order date
      let oDate = new Date();
      if (order.orderDate instanceof Timestamp) oDate = order.orderDate.toDate();
      else if (order.createdAt instanceof Timestamp) oDate = order.createdAt.toDate();
      else if (order.orderDate) oDate = new Date(order.orderDate);

      // Current month check
      if (isWithinInterval(oDate, { start: currentMonthStart, end: currentMonthEnd })) {
        currentMonthBookingValueBDT += bdtValue;
        currentMonthOrderCount++;
      }

      // Monthly Trend (plots converted BDT value)
      const monthKey = format(oDate, 'MMM yyyy');
      if (monthlyTrendMap[monthKey]) {
        monthlyTrendMap[monthKey].value += bdtValue;
        monthlyTrendMap[monthKey].count += 1;
      }

      // Buyer map (accumulates in BDT value for true comparison)
      const buyerName = order.buyerName || 'General / Direct';
      if (!buyerVolumeMap[buyerName]) {
        buyerVolumeMap[buyerName] = { name: buyerName, value: 0, count: 0 };
      }
      buyerVolumeMap[buyerName].value += bdtValue;
      buyerVolumeMap[buyerName].count += 1;
    });

    const monthlyTrendData = Object.values(monthlyTrendMap);

    // Customer-wise sales list sorted by sales value descending
    const customerSalesData = Object.values(customerSalesMap)
      .sort((a, b) => b.value - a.value);

    const totalSalesForCustomers = customerSalesData.reduce((sum, c) => sum + c.value, 0);
    const topCustomersShareData = customerSalesData.map(c => ({
      ...c,
      percentage: totalSalesForCustomers > 0 ? (c.value / totalSalesForCustomers) * 100 : 0
    }));

    // --- Delivery Calculations (Challans where Gate Pass is Confirmed/Approved) ---
    const approvedGatePassChallanIds = new Set<string>();
    const approvedGatePassChallanNos = new Set<string>();
    gatePasses.forEach(gp => {
      const isConfirmed = gp.approvalStatus === 'approved' || gp.status === 'exited' || !!gp.approvedAt || !!gp.confirmedAt;
      if (isConfirmed) {
        if (gp.challanId) approvedGatePassChallanIds.add(gp.challanId);
        if (gp.challanNo) approvedGatePassChallanNos.add(gp.challanNo.trim().toUpperCase());
      }
    });

    // Helper to safely parse dates from Delivery Challans
    const parseChallanDate = (dateVal: any, fallbackTimestamp: any): Date => {
      if (dateVal instanceof Timestamp) return dateVal.toDate();
      if (dateVal?.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
      if (typeof dateVal === 'string' && dateVal.trim()) {
        const s = dateVal.trim();
        if (s.includes('/')) {
          const parts = s.split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              return new Date(y, m, d);
            }
          }
        }
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return parsed;
      }
      if (fallbackTimestamp instanceof Timestamp) return fallbackTimestamp.toDate();
      if (fallbackTimestamp?.toDate) return fallbackTimestamp.toDate();
      return new Date();
    };

    let thisMonthDeliveryValueBDT = 0;
    let thisMonthDeliveryQty = 0;
    let thisMonthDeliveryCount = 0;
    let totalDeliveryValueBDT = 0;
    let totalDeliveryQty = 0;
    let totalDeliveryCount = 0;

    challans.forEach(c => {
      if (c.status === 'cancelled') return;

      const isGpConfirmed = 
        c.gatePassStatus === 'approved' || 
        c.isLocked === true || 
        approvedGatePassChallanIds.has(c.id) || 
        (c.challanNo && approvedGatePassChallanNos.has(c.challanNo.trim().toUpperCase()));

      if (!isGpConfirmed) return;

      // Find matching work order to resolve unit price & currency rate
      const matchedOrder = orders.find(o => 
        (c.woId && o.id === c.woId) || 
        (c.woNumber && (o.woNumber === c.woNumber || o.orderNo === c.woNumber || o.workOrderNo === c.woNumber))
      );

      let unitPrice = 0;
      let convRate = 1;
      if (matchedOrder) {
        const orderQty = Number(matchedOrder.totalQuantity) || Number(matchedOrder.orderQty) || 0;
        const orderAmt = Number(matchedOrder.totalAmount) || 0;
        if (typeof matchedOrder.rate === 'number' && matchedOrder.rate > 0) {
          unitPrice = matchedOrder.rate;
        } else if (orderQty > 0 && orderAmt > 0) {
          unitPrice = orderAmt / orderQty;
        } else if (matchedOrder.breakdownRows && matchedOrder.breakdownRows.length > 0) {
          const rowWithRate = matchedOrder.breakdownRows.find((r: any) => typeof r.rate === 'number' && r.rate > 0);
          if (rowWithRate) unitPrice = rowWithRate.rate;
        }
        const details = getOrderConversionDetails(matchedOrder);
        convRate = details.rate;
      } else if (typeof c.rate === 'number' && c.rate > 0) {
        unitPrice = c.rate;
      } else if (typeof c.pricePerPcs === 'number' && c.pricePerPcs > 0) {
        unitPrice = c.pricePerPcs;
      }

      const deliveryQty = Number(c.currentDeliveryQty) || Number(c.orderQty) || 0;
      let deliveryValueBDT = 0;
      if (typeof c.deliveryAmount === 'number' && c.deliveryAmount > 0) {
        deliveryValueBDT = c.deliveryAmount * convRate;
      } else {
        deliveryValueBDT = deliveryQty * unitPrice * convRate;
      }

      totalDeliveryValueBDT += deliveryValueBDT;
      totalDeliveryQty += deliveryQty;
      totalDeliveryCount += 1;

      const delivDate = parseChallanDate(c.challanDate, c.createdAt);
      if (isWithinInterval(delivDate, { start: currentMonthStart, end: currentMonthEnd })) {
        thisMonthDeliveryValueBDT += deliveryValueBDT;
        thisMonthDeliveryQty += deliveryQty;
        thisMonthDeliveryCount += 1;
      }
    });

    const recentOrders = [...orders]
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.orderDate ? new Date(a.orderDate).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.orderDate ? new Date(b.orderDate).getTime() : 0);
        return timeB - timeA;
      })
      .slice(0, 5);

    return {
      totalOrdersCount,
      totalBookingValueBDT,
      totalBookingValueUSD,
      totalBookingValueEUR,
      totalBookingValueLocalBDT,
      customCustomerRateOrderCount,
      pendingCount,
      inProductionCount,
      completedCount,
      deliveredCount,
      currentMonthBookingValueBDT,
      currentMonthOrderCount,
      monthlyTrendData,
      customerSalesData,
      topCustomersShareData,
      thisMonthDeliveryValueBDT,
      thisMonthDeliveryQty,
      thisMonthDeliveryCount,
      totalDeliveryValueBDT,
      totalDeliveryQty,
      totalDeliveryCount,
      recentOrders
    };
  }, [orders, challans, gatePasses, getOrderConversionDetails]);

  const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-5">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Sales & Marketing Operations</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Live Orders
              </span>
            </div>
            <p className="text-xs text-slate-500">Customer sales orders, booking value analytics, buyer pipeline & delivery tracking</p>
          </div>
        </div>

        {onNavigate && (hasPageAccess('sales-create-order') || hasPageAccess('sales-order-list')) && (
          <div className="flex items-center gap-2">
            {hasPageAccess('sales-create-order') && (
              <button
                onClick={() => onNavigate('sales-create-order')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <span>Create Order</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPageAccess('sales-order-list') && (
              <button
                onClick={() => onNavigate('sales-order-list')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Order Tracking List</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 Core Sales KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Month Delivery (BDT)</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-tight">
                GP Confirmed
              </span>
            </div>
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-slate-900 tracking-tight">
            ৳ {stats.thisMonthDeliveryValueBDT.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
            <span className="font-bold text-slate-700">
              {stats.thisMonthDeliveryQty.toLocaleString()} units
            </span>
            <span>•</span>
            <span>{stats.thisMonthDeliveryCount} Gate Pass challans</span>
            {stats.totalDeliveryValueBDT > 0 && stats.totalDeliveryValueBDT !== stats.thisMonthDeliveryValueBDT && (
              <span className="text-[10px] text-slate-400 block w-full mt-0.5 font-mono">
                Total Delivered: ৳ {stats.totalDeliveryValueBDT.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Month Booking (BDT)</span>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-slate-900 tracking-tight">
            ৳ {stats.currentMonthBookingValueBDT.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h4>
          <p className="text-[11px] text-blue-600 mt-0.5 font-medium">
            +{stats.currentMonthOrderCount} new orders in {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Production Pipeline</span>
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-amber-950 tracking-tight">{stats.inProductionCount} Active</h4>
          <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
            {stats.pendingCount} pending approval / queue
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed & Dispatched</span>
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-purple-950 tracking-tight">
            {stats.deliveredCount + stats.completedCount} Orders
          </h4>
          <p className="text-[11px] text-purple-700 mt-0.5 font-medium">
            Successfully manufactured & delivered
          </p>
        </div>
      </div>

      {/* Charts Section: Booking Trend (Compact) & Customer-wise Sales Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Sales Booking Velocity (Compact Height) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Monthly Sales Booking Velocity</h4>
              <p className="text-[11px] text-slate-500">Order booking value trend over the last 6 months</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                Value (BDT)
              </span>
            </div>
          </div>

          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyTrendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(val) => `Tk ${(val / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  formatter={(value: any) => [`BDT ${Number(value).toLocaleString()}`, 'Booking Value']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer-wise Sales Share */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Customer Sales Share</h4>
                <p className="text-[11px] text-slate-500">Sales value distribution by customer</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {stats.customerSalesData.length} Customers
              </span>
            </div>

            <div className="h-32 w-full flex items-center justify-center">
              {stats.topCustomersShareData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.topCustomersShareData.slice(0, 5)}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={48}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stats.topCustomersShareData.slice(0, 5).map((_, index) => (
                        <Cell key={`cust-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [`BDT ${Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Sales Value']} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  No sales bookings recorded yet.
                </div>
              )}
            </div>

            {/* Customer ranking list */}
            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 divide-y divide-slate-100">
              {stats.topCustomersShareData.slice(0, 5).map((c, idx) => (
                <div key={c.customerId || idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <span 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }} 
                    />
                    <span className="font-semibold text-slate-800 truncate text-[11px]" title={c.name}>
                      {c.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                      ({c.count} {c.count === 1 ? 'order' : 'orders'})
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 font-mono text-[11px] block">
                      ৳ {c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {c.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Registered Customers</span>
            <span className="font-bold text-slate-800">{customers.length} Accounts</span>
          </div>
        </div>
      </div>

      {/* Recent Sales Orders Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Recent Customer Sales Orders</h4>
            <p className="text-xs text-slate-500">Live order booking pipeline</p>
          </div>
          {onNavigate && hasPageAccess('sales-order-list') && (
            <button 
              onClick={() => onNavigate('sales-order-list')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Order / WO No</th>
                <th className="py-2.5 px-3">Buyer & Customer</th>
                <th className="py-2.5 px-3">Order Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Order Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentOrders.map(order => {
                let oDate = '-';
                if (order.orderDate instanceof Timestamp) oDate = format(order.orderDate.toDate(), 'dd MMM yyyy');
                else if (order.orderDate) oDate = format(new Date(order.orderDate), 'dd MMM yyyy');

                const status = (order.status || 'pending').toLowerCase();
                let statusBadge = (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Pending
                  </span>
                );
                if (status.includes('prod') || status === 'in_progress') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      In Production
                    </span>
                  );
                } else if (status.includes('comp')) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Completed
                    </span>
                  );
                } else if (status.includes('deliv')) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Delivered
                    </span>
                  );
                }

                const { bdtValue, currency, originalAmt, rate, rateSource } = getOrderConversionDetails(order);

                return (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800 font-mono">
                      {order.workOrderNo || order.orderNo || 'WO-#'}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-800">{order.buyerName || 'Buyer'}</p>
                      <p className="text-[10px] text-slate-400">{order.customerName || 'Customer'}</p>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-medium">{oDate}</td>
                    <td className="py-2.5 px-3">{statusBadge}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-bold text-slate-900 block font-mono text-xs">
                        {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '৳'} {originalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {currency !== 'BDT' && (
                        <span 
                          className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-mono inline-block mt-0.5"
                          title={`Converted via ${rateSource}: 1 ${currency} = ৳${rate}`}
                        >
                          ≈ ৳{bdtValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} (@ ৳{rate})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400 italic">
                    No sales orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
