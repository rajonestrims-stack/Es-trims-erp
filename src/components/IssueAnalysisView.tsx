import React, { useState, useMemo } from 'react';
import { printElement } from '../utils/printHelper';
import { Item, Transaction, Category } from '../types';
import { Card } from './ui/Card';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  FileSpreadsheet, 
  Search
} from 'lucide-react';
import { Button } from './ui/Button';

interface IssueAnalysisViewProps {
  transactions: Transaction[];
  items: Item[];
  categories: Category[];
  onBack?: () => void;
}

export function IssueAnalysisView({ transactions, items, categories, onBack }: IssueAnalysisViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'month' | 'custom'>('30days');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'item' | 'department' | 'category'>('item');

  // Filter issue (type === 'OUT' or 'PRODUCTION' or 'EXTRA_REQUISITION') transactions
  const issueTransactions = useMemo(() => {
    return transactions.filter(t => 
      (t.type === 'OUT' || t.type === 'PRODUCTION' || t.type === 'EXTRA_REQUISITION') && 
      t.status !== 'pending_delete'
    );
  }, [transactions]);

  // Date filtering
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startLimit: Date | null = null;

    if (dateRange === 'today') {
      startLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === '7days') {
      startLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30days') {
      startLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'month') {
      startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === 'custom' && startDate) {
      startLimit = new Date(startDate);
    }

    let endLimit: Date | null = null;
    if (dateRange === 'custom' && endDate) {
      endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
    }

    return issueTransactions.filter(t => {
      let tDate: Date;
      if ((t.date as any)?.toDate) {
        tDate = (t.date as any).toDate();
      } else if (t.date) {
        tDate = new Date(t.date as any);
      } else {
        tDate = new Date();
      }

      if (startLimit && tDate < startLimit) return false;
      if (endLimit && tDate > endLimit) return false;

      const item = items.find(i => i.id === t.itemId);
      if (selectedCategory !== 'all') {
        const catId = item?.categoryId;
        if (catId !== selectedCategory) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const itemName = item?.name?.toLowerCase() || '';
        const ref = (t.reference || t.srNo || t.jobNo || '').toLowerCase();
        const notes = (t.notes || t.purpose || '').toLowerCase();
        const dept = (t.department || '').toLowerCase();
        if (!itemName.includes(term) && !ref.includes(term) && !notes.includes(term) && !dept.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [issueTransactions, dateRange, startDate, endDate, selectedCategory, searchTerm, items]);

  // Aggregations
  const totalIssueQty = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  }, [filteredTransactions]);

  const totalIssueValue = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const item = items.find(i => i.id === t.itemId);
      const price = Number(t.price) || Number(item?.avgCost) || Number(item?.averagePrice) || 0;
      return acc + (Number(t.quantity) || 0) * price;
    }, 0);
  }, [filteredTransactions, items]);

  // Grouped Analysis Data
  const groupedAnalysis = useMemo(() => {
    const map: Record<string, { name: string; category: string; quantity: number; value: number; count: number; unit: string }> = {};

    filteredTransactions.forEach(t => {
      const item = items.find(i => i.id === t.itemId);
      let key = '';
      let groupName = '';
      let catName = '';

      if (groupBy === 'item') {
        key = t.itemId || 'unknown';
        groupName = item?.name || 'Unknown Item';
        const catObj = categories.find(c => c.id === item?.categoryId);
        catName = catObj?.name || 'General';
      } else if (groupBy === 'department') {
        key = t.department || 'General Store';
        groupName = key;
        catName = 'Department';
      } else {
        const catObj = categories.find(c => c.id === item?.categoryId);
        key = catObj?.id || 'uncategorized';
        groupName = catObj?.name || 'Uncategorized';
        catName = 'Category';
      }

      if (!map[key]) {
        map[key] = {
          name: groupName,
          category: catName,
          quantity: 0,
          value: 0,
          count: 0,
          unit: item?.unit || 'Pcs'
        };
      }

      const price = Number(t.price) || Number(item?.avgCost) || Number(item?.averagePrice) || 0;
      map[key].quantity += Number(t.quantity) || 0;
      map[key].value += (Number(t.quantity) || 0) * price;
      map[key].count += 1;
    });

    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredTransactions, items, categories, groupBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900">Material Issue & Consumption Analysis</h2>
            <p className="text-sm text-neutral-500">Track store outflows, department usage, and consumption trends</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => printElement('printable-issue-analysis', { title: 'Material_Issue_Analysis_Report', pageOrientation: 'landscape' })} 
            className="text-xs font-bold gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Print / Export
          </Button>
        </div>
      </div>

      <div id="printable-issue-analysis" className="printable-doc space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-l-4 border-l-blue-600 bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase">Total Items Issued</p>
              <h3 className="text-2xl font-black text-neutral-900 mt-1">
                {totalIssueQty.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-2">Across {filteredTransactions.length} issue vouchers</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-emerald-600 bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase">Total Consumption Value</p>
              <h3 className="text-2xl font-black text-neutral-900 mt-1">
                Tk {totalIssueValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-2">Estimated based on standard item cost</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-purple-600 bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase">Active Groups / Units</p>
              <h3 className="text-2xl font-black text-neutral-900 mt-1">
                {groupedAnalysis.length}
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-2">Grouped by {groupBy.toUpperCase()}</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search item, department, ref..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>

          {/* Date range selection */}
          <div>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Group By */}
          <div>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as any)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-black/5 font-semibold text-neutral-800"
            >
              <option value="item">Group by Item</option>
              <option value="department">Group by Department</option>
              <option value="category">Group by Category</option>
            </select>
          </div>
        </div>

        {/* Custom date range inputs */}
        {dateRange === 'custom' && (
          <div className="flex gap-3 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-8 px-2 rounded-lg border border-neutral-200 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-8 px-2 rounded-lg border border-neutral-200 text-xs"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Analysis Table */}
      <Card className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-neutral-900">
            Consumption Breakdown ({groupedAnalysis.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-100">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">{groupBy === 'item' ? 'Item Name' : groupBy === 'department' ? 'Department / Section' : 'Category Name'}</th>
                {groupBy === 'item' && <th className="px-4 py-3">Category</th>}
                <th className="px-4 py-3 text-right">Transactions</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Total Value (Tk)</th>
                <th className="px-4 py-3 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {groupedAnalysis.map((row, idx) => {
                const pct = totalIssueValue > 0 ? ((row.value / totalIssueValue) * 100).toFixed(1) : '0';
                return (
                  <tr key={idx} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3 text-xs text-neutral-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-neutral-900">{row.name}</td>
                    {groupBy === 'item' && <td className="px-4 py-3 text-neutral-500">{row.category}</td>}
                    <td className="px-4 py-3 text-right text-neutral-600">{row.count}</td>
                    <td className="px-4 py-3 text-right font-bold text-neutral-800">
                      {row.quantity.toLocaleString()} {groupBy === 'item' ? row.unit : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-neutral-900">
                      {row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-800">{pct}%</span>
                    </td>
                  </tr>
                );
              })}
              {groupedAnalysis.length === 0 && (
                <tr>
                  <td colSpan={groupBy === 'item' ? 7 : 6} className="px-4 py-12 text-center text-neutral-400 italic">
                    No material issue records found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
            {groupedAnalysis.length > 0 && (
              <tfoot className="bg-neutral-50 font-bold border-t border-neutral-200">
                <tr>
                  <td colSpan={groupBy === 'item' ? 3 : 2} className="px-4 py-3 text-right uppercase text-xs text-neutral-700">Total</td>
                  <td className="px-4 py-3 text-right text-neutral-900">{filteredTransactions.length}</td>
                  <td className="px-4 py-3 text-right text-neutral-900">{totalIssueQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-neutral-900">Tk {totalIssueValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-neutral-900">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      </div>
    </div>
  );
}
