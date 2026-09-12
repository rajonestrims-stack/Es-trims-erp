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
  Factory, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  AlertOctagon, 
  Clock, 
  Calendar, 
  ChevronRight, 
  FileText, 
  Activity,
  ArrowUpRight,
  TrendingUp,
  Scissors,
  ExternalLink
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
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '../../lib/utils';

interface ProductionDashboardProps {
  userProfile: UserProfile;
  onNavigate?: (tab: string) => void;
  allowedPagesSet?: Set<string>;
  compact?: boolean;
}

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({
  userProfile,
  onNavigate,
  allowedPagesSet,
  compact = false
}) => {
  const isAdmin = userProfile.role === 'admin' || userProfile.role === 'super-admin' || userProfile.email === 'rajonpaul300@gmail.com' || userProfile.email === 'rajon.estrims@gmail.com';
  const hasPageAccess = (pageId: string) => {
    if (isAdmin) return true;
    if (!allowedPagesSet) return true;
    if (pageId === 'production-update') {
      return allowedPagesSet.has('production-update') || allowedPagesSet.has('production') || allowedPagesSet.has('production-management');
    }
    if (pageId === 'production-status') {
      return allowedPagesSet.has('production-status') || allowedPagesSet.has('production') || allowedPagesSet.has('production-management');
    }
    if (pageId === 'production-details') {
      return allowedPagesSet.has('production-details') || allowedPagesSet.has('production') || allowedPagesSet.has('production-management');
    }
    return allowedPagesSet.has(pageId);
  };

  const [executions, setExecutions] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const businessId = userProfile?.businessId || 'default-business';

  useEffect(() => {
    if (!businessId) return;

    const qExec = query(collection(db, 'production_executions'), where('businessId', '==', businessId));
    const qWo = query(collection(db, 'work_orders'), where('businessId', '==', businessId));
    const qSec = query(collection(db, 'sections'), where('businessId', '==', businessId));

    const unsubExec = onSnapshot(
      qExec, 
      (snap) => {
        setExecutions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, 
      (error) => {
        console.warn('Executions snapshot listener notice:', error.message);
        setLoading(false);
      }
    );

    const unsubWo = onSnapshot(
      qWo, 
      (snap) => {
        setWorkOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.warn('Work orders snapshot listener notice:', error.message);
      }
    );

    const unsubSec = onSnapshot(
      qSec, 
      (snap) => {
        setSections(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.warn('Sections snapshot listener notice:', error.message);
      }
    );

    return () => {
      unsubExec();
      unsubWo();
      unsubSec();
    };
  }, [businessId]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    let todayOutput = 0;
    let todayScrap = 0;
    let monthOutput = 0;
    let monthScrap = 0;
    let totalOutputAllTime = 0;

    const sectionOutputMap: Record<string, { sectionName: string; outputQty: number; rejectQty: number }> = {};
    const processOutputMap: Record<string, { name: string; value: number }> = {};

    executions.forEach(exec => {
      const outQty = Number(exec.outputQty) || Number(exec.quantity) || 0;
      const rejQty = Number(exec.rejectQty) || Number(exec.scrapQty) || 0;
      totalOutputAllTime += outQty;

      let execDate = new Date();
      if (exec.date instanceof Timestamp) execDate = exec.date.toDate();
      else if (exec.createdAt instanceof Timestamp) execDate = exec.createdAt.toDate();
      else if (exec.date) execDate = new Date(exec.date);

      if (isWithinInterval(execDate, { start: todayStart, end: todayEnd })) {
        todayOutput += outQty;
        todayScrap += rejQty;
      }

      if (isWithinInterval(execDate, { start: currentMonthStart, end: currentMonthEnd })) {
        monthOutput += outQty;
        monthScrap += rejQty;

        const secName = exec.sectionName || exec.section || 'General Line';
        if (!sectionOutputMap[secName]) {
          sectionOutputMap[secName] = { sectionName: secName, outputQty: 0, rejectQty: 0 };
        }
        sectionOutputMap[secName].outputQty += outQty;
        sectionOutputMap[secName].rejectQty += rejQty;

        const procName = exec.processName || exec.process || 'Floor Production';
        if (!processOutputMap[procName]) {
          processOutputMap[procName] = { name: procName, value: 0 };
        }
        processOutputMap[procName].value += outQty;
      }
    });

    const activeWorkOrders = workOrders.filter(wo => {
      const s = (wo.status || 'pending').toLowerCase();
      return s.includes('prod') || s === 'in_progress' || s === 'active';
    }).length;

    const pendingWorkOrders = workOrders.filter(wo => {
      const s = (wo.status || 'pending').toLowerCase();
      return s.includes('pend') || s === 'draft';
    }).length;

    const completedWorkOrders = workOrders.filter(wo => {
      const s = (wo.status || 'pending').toLowerCase();
      return s.includes('comp') || s.includes('deliv');
    }).length;

    const sectionChartData = Object.values(sectionOutputMap);
    const processPieData = Object.values(processOutputMap);

    const scrapRate = monthOutput > 0 ? ((monthScrap / (monthOutput + monthScrap)) * 100).toFixed(1) : '0.0';

    const recentExecutions = [...executions]
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      })
      .slice(0, 5);

    return {
      todayOutput,
      todayScrap,
      monthOutput,
      monthScrap,
      totalOutputAllTime,
      activeWorkOrders,
      pendingWorkOrders,
      completedWorkOrders,
      scrapRate,
      sectionChartData,
      processPieData,
      recentExecutions
    };
  }, [executions, workOrders]);

  const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-5">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Production & Floor Management</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Floor Tracker
              </span>
            </div>
            <p className="text-xs text-slate-500">Live manufacturing line updates, section output, yield efficiency & job orders</p>
          </div>
        </div>

        {onNavigate && (hasPageAccess('production-update') || hasPageAccess('production-status')) && (
          <div className="flex items-center gap-2">
            {hasPageAccess('production-update') && (
              <button
                onClick={() => onNavigate('production-update')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <span>Floor Update</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPageAccess('production-status') && (
              <button
                onClick={() => onNavigate('production-status')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Production Status</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 Core Production KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Job Orders</span>
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-slate-900 tracking-tight">{stats.activeWorkOrders} in Production</h4>
          <p className="text-[11px] text-indigo-600 mt-0.5 font-medium">
            {stats.pendingWorkOrders} queued in line
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today's Output</span>
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-emerald-950 tracking-tight">
            {stats.todayOutput.toLocaleString()} Pcs / Units
          </h4>
          <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
            {stats.todayScrap > 0 ? `${stats.todayScrap} rejects today` : 'Zero defect recorded today'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Month Output</span>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-blue-950 tracking-tight">
            {stats.monthOutput.toLocaleString()} Pcs
          </h4>
          <p className="text-[11px] text-blue-600 mt-0.5 font-medium">
            Total for {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Floor Scrap / Defect Rate</span>
            <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-xl font-black text-rose-950 tracking-tight">{stats.scrapRate}%</h4>
          <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
            {stats.monthScrap.toLocaleString()} total rejected units
          </p>
        </div>
      </div>

      {/* Charts Section: Section-wise Output & Process Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Section-wise Floor Output ({format(new Date(), 'MMMM')})</h4>
              <p className="text-xs text-slate-500">Manufactured units vs scrap by factory section</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span>
                <span className="text-slate-600">Good Output</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                <span className="text-slate-600">Scrap</span>
              </div>
            </div>
          </div>

          <div className="h-56 w-full">
            {stats.sectionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.sectionChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="sectionName" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: any) => [`${Number(value).toLocaleString()} units`, '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="outputQty" fill="#6366f1" name="Good Output" radius={[4, 4, 0, 0]} maxBarSize={45} />
                  <Bar dataKey="rejectQty" fill="#f43f5e" name="Scrap" radius={[4, 4, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                No floor output recorded for this month yet.
              </div>
            )}
          </div>
        </div>

        {/* Process Share Pie */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Process Breakdown</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Monthly
              </span>
            </div>

            <div className="h-44 w-full flex items-center justify-center">
              {stats.processPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.processPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {stats.processPieData.map((_, index) => (
                        <Cell key={`proc-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} units`, '']} />
                    <Legend 
                      wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                      formatter={(name) => <span className="text-[11px] font-medium text-slate-600 truncate max-w-[85px] inline-block">{name}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  No process output logged.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Completed Work Orders</span>
            <span className="font-bold text-emerald-700">{stats.completedWorkOrders} Orders</span>
          </div>
        </div>
      </div>

      {/* Recent Floor Execution Logs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Recent Floor Output Logs</h4>
            <p className="text-xs text-slate-500">Live operator and machine execution records</p>
          </div>
          {onNavigate && hasPageAccess('production-details') && (
            <button 
              onClick={() => onNavigate('production-details')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Production History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Work Order</th>
                <th className="py-2.5 px-3">Section / Process</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Scrap</th>
                <th className="py-2.5 px-3 text-right">Output Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentExecutions.map(exec => {
                let eDate = '-';
                if (exec.date instanceof Timestamp) eDate = format(exec.date.toDate(), 'dd MMM, hh:mm a');
                else if (exec.date) eDate = format(new Date(exec.date), 'dd MMM, hh:mm a');

                const outQty = Number(exec.outputQty) || Number(exec.quantity) || 0;
                const rejQty = Number(exec.rejectQty) || Number(exec.scrapQty) || 0;

                return (
                  <tr key={exec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {exec.workOrderNo || 'WO-#'}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-800">{exec.sectionName || 'Floor'}</p>
                      <p className="text-[10px] text-slate-400">{exec.processName || 'Operation'}</p>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-medium">{eDate}</td>
                    <td className="py-2.5 px-3">
                      {rejQty > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {rejQty} pcs
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-indigo-700">
                      {outQty.toLocaleString()} units
                    </td>
                  </tr>
                );
              })}
              {stats.recentExecutions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400 italic">
                    No production execution records logged yet.
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
