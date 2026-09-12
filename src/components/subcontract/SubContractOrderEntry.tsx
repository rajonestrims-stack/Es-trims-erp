import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  Printer, 
  Download, 
  RefreshCw, 
  Filter, 
  Layers, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Palette, 
  Scissors, 
  Sparkles,
  FileText,
  DollarSign,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { 
  SubContractCategory, 
  SubContractItem, 
  SubContractOrder, 
  SubContractOrderItem, 
  SubContractOrderStatus, 
  SubContractPrice, 
  Supplier, 
  UserProfile 
} from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface SubContractOrderEntryProps {
  orderType: 'dyeing' | 'woven' | 'embroidery' | 'all';
  orders: SubContractOrder[];
  categories: SubContractCategory[];
  items: SubContractItem[];
  prices: SubContractPrice[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSaveOrder: (order: Partial<SubContractOrder>) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onNavigateToPO?: (order: SubContractOrder) => void;
  onNavigateToIssue?: (order: SubContractOrder) => void;
  onNavigateToReceive?: (order: SubContractOrder) => void;
  isEditor: boolean;
}

const EMBROIDERY_TYPES = [
  '3D Embroidery',
  'Flat Embroidery',
  'Applique Embroidery',
  'Sequins Embroidery',
  'Multi-Head Embroidery',
  'Chenille Embroidery',
  'Cording Embroidery',
  'Badge / Patch Embroidery'
];

export const SubContractOrderEntry: React.FC<SubContractOrderEntryProps> = ({
  orderType,
  orders,
  categories,
  items,
  prices,
  suppliers,
  userProfile,
  showToast,
  onSaveOrder,
  onDeleteOrder,
  onNavigateToPO,
  onNavigateToIssue,
  onNavigateToReceive,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubContractOrderStatus>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>(orderType);

  useEffect(() => {
    setSelectedTypeFilter(orderType);
  }, [orderType]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<SubContractOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOrderType, setFormOrderType] = useState<'dyeing' | 'woven' | 'embroidery' | 'other'>(
    orderType === 'all' ? 'dyeing' : orderType
  );
  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [subContractRef, setSubContractRef] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [style, setStyle] = useState('');
  const [color, setColor] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [embroideryType, setEmbroideryType] = useState('3D Embroidery');
  const [fabricDetails, setFabricDetails] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [requiredDate, setRequiredDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<SubContractOrderStatus>('draft');

  // Dynamic Line Items
  const [lineItems, setLineItems] = useState<SubContractOrderItem[]>([
    {
      id: '1',
      itemId: '',
      itemCode: '',
      itemName: '',
      categoryId: '',
      categoryName: '',
      quantity: 1,
      unit: 'KG',
      rate: 0,
      amount: 0,
      color: '',
      colorCode: '',
      style: '',
      embroideryType: '',
      remarks: ''
    }
  ]);

  const [priceWarning, setPriceWarning] = useState<string | null>(null);

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesType = selectedTypeFilter === 'all' || o.orderType === selectedTypeFilter;
    const matchesSupplier = supplierFilter === 'all' || o.supplierId === supplierFilter;
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch = 
      o.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.buyerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.style || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.subContractRef || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items.some(it => it.itemName.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesType && matchesSupplier && matchesStatus && matchesSearch;
  });

  const getAutoOrderNo = (type: string) => {
    const prefix = type === 'dyeing' ? 'SC-DYE' : type === 'woven' ? 'SC-WOV' : type === 'embroidery' ? 'SC-EMB' : 'SC-ORD';
    const year = new Date().getFullYear();
    const count = orders.filter(o => o.orderType === type).length + 1;
    return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
  };

  const handleOpenAdd = (typeOverride?: 'dyeing' | 'woven' | 'embroidery' | 'other') => {
    const effectiveType = typeOverride || (selectedTypeFilter === 'all' ? 'dyeing' : (selectedTypeFilter as any));
    setEditingId(null);
    setFormOrderType(effectiveType);
    setOrderNo(getAutoOrderNo(effectiveType));
    setOrderDate(new Date().toISOString().split('T')[0]);
    const firstSup = suppliers[0]?.id || '';
    setSupplierId(firstSup);
    setSubContractRef('');
    setBuyerName('');
    setCustomerName('');
    setStyle('');
    setColor('');
    setColorCode('');
    setEmbroideryType('3D Embroidery');
    setFabricDetails('');
    setCurrency('BDT');
    setRequiredDate('');
    setDeliveryDate('');
    setRemarks('');
    setStatus('draft');
    setPriceWarning(null);

    // Filter items matching this order type category
    const matchedCategory = categories.find(c => c.categoryName.toLowerCase().includes(effectiveType.toLowerCase()));
    const relevantItems = items.filter(i => !matchedCategory || i.categoryId === matchedCategory.id);
    const initialItem = relevantItems[0] || items[0];

    if (initialItem && firstSup) {
      const foundPrice = prices.find(
        p => p.supplierId === firstSup && p.itemId === initialItem.id && p.status === 'active'
      );
      setLineItems([
        {
          id: '1',
          itemId: initialItem.id,
          itemCode: initialItem.itemCode,
          itemName: initialItem.itemName,
          categoryId: initialItem.categoryId,
          categoryName: initialItem.categoryName,
          quantity: 100,
          unit: initialItem.unit,
          rate: foundPrice ? foundPrice.contractPrice : 0,
          amount: (foundPrice ? foundPrice.contractPrice : 0) * 100,
          remarks: ''
        }
      ]);
      if (!foundPrice) {
        setPriceWarning(`Notice: No contract price found for supplier with item "${initialItem.itemName}". You can specify rate manually.`);
      }
    } else {
      setLineItems([]);
    }

    setIsModalOpen(true);
  };

  const handleOpenEdit = (order: SubContractOrder) => {
    setEditingId(order.id);
    setFormOrderType(order.orderType);
    setOrderNo(order.orderNo);
    setOrderDate(order.orderDate);
    setSupplierId(order.supplierId);
    setSubContractRef(order.subContractRef || '');
    setBuyerName(order.buyerName || '');
    setCustomerName(order.customerName || '');
    setStyle(order.style || '');
    setColor(order.color || '');
    setColorCode(order.colorCode || '');
    setEmbroideryType(order.embroideryType || '3D Embroidery');
    setFabricDetails(order.fabricDetails || '');
    setCurrency(order.currency || 'BDT');
    setRequiredDate(order.requiredDate || '');
    setDeliveryDate(order.deliveryDate || '');
    setRemarks(order.remarks || '');
    setStatus(order.status);
    setLineItems(order.items.map(it => ({ ...it })));
    setPriceWarning(null);
    setIsModalOpen(true);
  };

  // When supplier changes, update rates for all line items based on Supplier Price Master
  const handleSupplierChange = (newSupId: string) => {
    setSupplierId(newSupId);
    let missingCount = 0;
    const updated = lineItems.map(li => {
      if (!li.itemId) return li;
      const foundPrice = prices.find(
        p => p.supplierId === newSupId && p.itemId === li.itemId && p.status === 'active'
      );
      if (foundPrice) {
        return {
          ...li,
          rate: foundPrice.contractPrice,
          unit: foundPrice.unit || li.unit,
          amount: foundPrice.contractPrice * (li.quantity || 0)
        };
      } else {
        missingCount++;
        return li;
      }
    });
    setLineItems(updated);
    if (missingCount > 0) {
      setPriceWarning(`Warning: ${missingCount} item(s) do not have an active contract price for this supplier in Supplier Price Master.`);
    } else {
      setPriceWarning(null);
    }
  };

  // Update line item
  const handleLineItemChange = (idx: number, field: keyof SubContractOrderItem, value: any) => {
    const updated = [...lineItems];
    const current = { ...updated[idx], [field]: value };

    if (field === 'itemId') {
      const selItem = items.find(i => i.id === value);
      if (selItem) {
        current.itemCode = selItem.itemCode;
        current.itemName = selItem.itemName;
        current.categoryId = selItem.categoryId;
        current.categoryName = selItem.categoryName;
        current.unit = selItem.unit;

        // Auto Price Lookup
        const foundPrice = prices.find(
          p => p.supplierId === supplierId && p.itemId === selItem.id && p.status === 'active'
        );
        if (foundPrice) {
          current.rate = foundPrice.contractPrice;
          current.unit = foundPrice.unit || selItem.unit;
          setPriceWarning(null);
        } else {
          setPriceWarning(`No active contract price found for "${selItem.itemName}" from this supplier. Please verify or input manually.`);
        }
      }
    }

    if (field === 'quantity' || field === 'rate' || field === 'itemId') {
      const q = Number(current.quantity) || 0;
      const r = Number(current.rate) || 0;
      current.amount = q * r;
    }

    updated[idx] = current;
    setLineItems(updated);
  };

  const handleAddLineItem = () => {
    const matchedCategory = categories.find(c => c.categoryName.toLowerCase().includes(formOrderType.toLowerCase()));
    const relevantItems = items.filter(i => !matchedCategory || i.categoryId === matchedCategory.id);
    const itemToUse = relevantItems[0] || items[0];

    const foundPrice = itemToUse && supplierId ? prices.find(
      p => p.supplierId === supplierId && p.itemId === itemToUse.id && p.status === 'active'
    ) : null;

    setLineItems([
      ...lineItems,
      {
        id: String(Date.now()),
        itemId: itemToUse?.id || '',
        itemCode: itemToUse?.itemCode || '',
        itemName: itemToUse?.itemName || '',
        categoryId: itemToUse?.categoryId || '',
        categoryName: itemToUse?.categoryName || '',
        quantity: 100,
        unit: itemToUse?.unit || 'KG',
        rate: foundPrice ? foundPrice.contractPrice : 0,
        amount: (foundPrice ? foundPrice.contractPrice : 0) * 100,
        remarks: ''
      }
    ]);
  };

  const handleRemoveLineItem = (idx: number) => {
    if (lineItems.length <= 1) {
      showToast('Order must contain at least one item', 'error');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const totalQuantity = lineItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalAmount = lineItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNo.trim()) {
      showToast('Order Number is required', 'error');
      return;
    }
    if (!supplierId) {
      showToast('Supplier is required', 'error');
      return;
    }
    if (lineItems.length === 0 || !lineItems.some(i => i.itemId)) {
      showToast('Please add at least one valid item to the order', 'error');
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const existingOrder = editingId ? orders.find(o => o.id === editingId) : null;

    try {
      setIsSaving(true);
      await onSaveOrder({
        id: editingId || undefined,
        orderNo: orderNo.trim().toUpperCase(),
        orderType: formOrderType,
        orderDate,
        supplierId,
        supplierName: selectedSupplier?.name || 'Unknown Supplier',
        subContractRef: subContractRef.trim() || undefined,
        buyerName: buyerName.trim() || undefined,
        customerName: customerName.trim() || undefined,
        style: style.trim() || undefined,
        color: color.trim() || undefined,
        colorCode: colorCode.trim() || undefined,
        embroideryType: formOrderType === 'embroidery' ? embroideryType : undefined,
        fabricDetails: fabricDetails.trim() || undefined,
        items: lineItems,
        totalQuantity,
        totalAmount,
        currency,
        requiredDate: requiredDate || undefined,
        deliveryDate: deliveryDate || undefined,
        issuedQuantity: existingOrder?.issuedQuantity || 0,
        receivedQuantity: existingOrder?.receivedQuantity || 0,
        balanceQuantity: totalQuantity - (existingOrder?.receivedQuantity || 0),
        status,
        remarks: remarks.trim() || undefined
      });
      setIsModalOpen(false);
      showToast(editingId ? 'Order updated successfully' : 'Sub Contract Order created successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save subcontract order', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, no: string) => {
    if (!window.confirm(`Are you sure you want to delete order "${no}"?`)) return;
    try {
      setIsDeleting(id);
      await onDeleteOrder(id);
      showToast(`Order "${no}" deleted`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete order', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const getStatusBadge = (st: SubContractOrderStatus) => {
    switch (st) {
      case 'draft':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">Draft</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Confirmed</span>;
      case 'issued':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Issued</span>;
      case 'partially_received':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Partially Rcvd</span>;
      case 'fully_received':
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600">{st}</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'dyeing':
        return <Palette className="w-4 h-4 text-pink-600" />;
      case 'woven':
        return <Scissors className="w-4 h-4 text-indigo-600" />;
      case 'embroidery':
        return <Sparkles className="w-4 h-4 text-amber-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  const exportToCSV = () => {
    if (!filteredOrders.length) {
      showToast('No orders to export', 'error');
      return;
    }
    const headers = ['Order No', 'Type', 'Date', 'Supplier', 'Buyer', 'Style', 'Total Qty', 'Total Amount', 'Currency', 'Issued Qty', 'Received Qty', 'Balance Qty', 'Status'];
    const rows = filteredOrders.map(o => [
      `"${o.orderNo}"`,
      `"${o.orderType}"`,
      `"${o.orderDate}"`,
      `"${o.supplierName}"`,
      `"${o.buyerName || ''}"`,
      `"${o.style || ''}"`,
      o.totalQuantity,
      o.totalAmount,
      `"${o.currency}"`,
      o.issuedQuantity || 0,
      o.receivedQuantity || 0,
      o.balanceQuantity || 0,
      `"${o.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subcontract_orders_${selectedTypeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              {getTypeIcon(selectedTypeFilter)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 capitalize">
                {selectedTypeFilter === 'all' ? 'All Sub Contract Orders' : `${selectedTypeFilter} Orders`}
              </h2>
              <p className="text-xs text-neutral-500">
                Outsourced production service orders with automated contract rate lookup and receiving tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCSV}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>

          {isEditor && (
            <div className="flex items-center gap-1.5">
              {selectedTypeFilter === 'all' ? (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => handleOpenAdd('dyeing')}
                    className="h-9 gap-1 text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Dyeing
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleOpenAdd('woven')}
                    className="h-9 gap-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Woven
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleOpenAdd('embroidery')}
                    className="h-9 gap-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Embroidery
                  </Button>
                </>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => handleOpenAdd(selectedTypeFilter as any)}
                  className="h-9 gap-1.5 text-xs font-bold bg-neutral-900 hover:bg-black text-white shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New {selectedTypeFilter.charAt(0).toUpperCase() + selectedTypeFilter.slice(1)} Order
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total Orders</span>
            <FileText className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">{filteredOrders.length}</p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase">Total Ordered Qty</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-blue-700 mt-1">
            {filteredOrders.reduce((s, o) => s + (o.totalQuantity || 0), 0).toLocaleString()}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase">Total Received Qty</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {filteredOrders.reduce((s, o) => s + (o.receivedQuantity || 0), 0).toLocaleString()}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase">Balance Pending Qty</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {filteredOrders.reduce((s, o) => s + (o.balanceQuantity !== undefined ? o.balanceQuantity : (o.totalQuantity - (o.receivedQuantity || 0))), 0).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-neutral-200">
        <div className="relative col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search Order No, Supplier, Buyer, Style..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-neutral-50 border-neutral-200"
          />
        </div>

        {orderType === 'all' && (
          <div>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Order Types</option>
              <option value="dyeing">Dyeing Orders</option>
              <option value="woven">Woven Orders</option>
              <option value="embroidery">Embroidery Orders</option>
              <option value="other">Other Orders</option>
            </select>
          </div>
        )}

        <div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Subcontract Suppliers</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>{sup.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="issued">Issued</option>
            <option value="partially_received">Partially Received</option>
            <option value="completed">Completed / Fully Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <Card className="overflow-hidden border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Order No & Type</th>
                <th className="py-3.5 px-4">Order Date</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4">Buyer & Style</th>
                <th className="py-3.5 px-4 text-right">Ordered Qty</th>
                <th className="py-3.5 px-4 text-right">Received Qty</th>
                <th className="py-3.5 px-4 text-right">Balance</th>
                <th className="py-3.5 px-4 text-right">Total Amount</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-neutral-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    No subcontract orders found matching your search.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const rcv = order.receivedQuantity || 0;
                  const bal = order.balanceQuantity !== undefined ? order.balanceQuantity : Math.max(0, order.totalQuantity - rcv);
                  const progressPct = order.totalQuantity > 0 ? Math.min(100, Math.round((rcv / order.totalQuantity) * 100)) : 0;

                  return (
                    <tr key={order.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-neutral-400 font-mono">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {getTypeIcon(order.orderType)}
                          <span className="font-mono font-bold text-neutral-900">
                            {order.orderNo}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 pl-5">
                          {order.orderType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600 text-[11px]">
                        {order.orderDate}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-neutral-900">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-neutral-400" />
                          <span>{order.supplierName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-neutral-900">{order.buyerName || '-'}</div>
                        {order.style && (
                          <div className="text-[10px] text-neutral-400">Style: {order.style}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900">
                        {order.totalQuantity.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        {rcv.toLocaleString()}
                        <div className="w-16 bg-neutral-100 rounded-full h-1 mt-1 ml-auto overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1 rounded-full" 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700">
                        {bal.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900">
                        {order.currency} {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedOrderForView(order);
                              setIsViewModalOpen(true);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isEditor && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(order)}
                                className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Order"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(order.id, order.orderNo)}
                                disabled={isDeleting === order.id}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Order"
                              >
                                {isDeleting === order.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Subcontract Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? `Edit Sub Contract Order (${orderNo})` : `Create New ${formOrderType.toUpperCase()} Order`}
        className="max-w-4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {priceWarning && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{priceWarning}</span>
            </div>
          )}

          {/* Section 1: Order Basics */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
            <h4 className="font-bold text-neutral-800 uppercase text-[11px] tracking-wide">1. Header & Supplier Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Order Type</label>
                <select
                  value={formOrderType}
                  onChange={(e) => {
                    const newType = e.target.value as any;
                    setFormOrderType(newType);
                    if (!editingId) setOrderNo(getAutoOrderNo(newType));
                  }}
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize"
                >
                  <option value="dyeing">Dyeing Order</option>
                  <option value="woven">Woven Order</option>
                  <option value="embroidery">Embroidery Order</option>
                  <option value="other">Other Subcontract</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Order No <span className="text-rose-500">*</span></label>
                <Input
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
                  required
                  className="font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Order Date <span className="text-rose-500">*</span></label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Supplier <span className="text-rose-500">*</span></label>
                <select
                  value={supplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  required
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="" disabled>Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Subcontract / WO Ref</label>
                <Input
                  placeholder="e.g. WO-2026-0042"
                  value={subContractRef}
                  onChange={(e) => setSubContractRef(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Buyer Name</label>
                <Input
                  placeholder="e.g. H&M, Zara, Target"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Style / Article No</label>
                <Input
                  placeholder="e.g. ST-9920 Polo"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 uppercase">Order Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="draft">Draft</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="issued">Issued</option>
                  <option value="partially_received">Partially Received</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Type Specific Fields */}
            {formOrderType === 'dyeing' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-200">
                <div className="space-y-1">
                  <label className="font-bold text-pink-700 uppercase">Color Name</label>
                  <Input
                    placeholder="e.g. Navy Blue, Olive Green"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-pink-700 uppercase">Color / Pantone Code</label>
                  <Input
                    placeholder="e.g. TCX 19-4024"
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-pink-700 uppercase">Fabric / Yarn Specs</label>
                  <Input
                    placeholder="e.g. 100% Cotton Single Jersey 180 GSM"
                    value={fabricDetails}
                    onChange={(e) => setFabricDetails(e.target.value)}
                  />
                </div>
              </div>
            )}

            {formOrderType === 'embroidery' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-200">
                <div className="space-y-1">
                  <label className="font-bold text-amber-700 uppercase">Embroidery Type</label>
                  <select
                    value={embroideryType}
                    onChange={(e) => setEmbroideryType(e.target.value)}
                    className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {EMBROIDERY_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-amber-700 uppercase">Placement / Stitch Details</label>
                  <Input
                    placeholder="e.g. Chest Logo 8500 Stitches, 4 Colors"
                    value={fabricDetails}
                    onChange={(e) => setFabricDetails(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Order Detail Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-neutral-800 uppercase text-[11px] tracking-wide">
                2. Sub Contract Items & Automatic Pricing
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLineItem}
                className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                <Plus className="w-3 h-3" />
                Add Item Row
              </Button>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3">Subcontract Item</th>
                    <th className="py-2.5 px-2 text-right w-24">Quantity</th>
                    <th className="py-2.5 px-2 text-center w-16">Unit</th>
                    <th className="py-2.5 px-2 text-right w-28">Contract Rate</th>
                    <th className="py-2.5 px-3 text-right w-28">Amount</th>
                    <th className="py-2.5 px-3">Row Note</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {lineItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-2 px-3">
                        <select
                          value={item.itemId}
                          onChange={(e) => handleLineItemChange(idx, 'itemId', e.target.value)}
                          required
                          className="w-full h-8 px-2 border border-neutral-200 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="" disabled>Select Item</option>
                          {items.map(it => (
                            <option key={it.id} value={it.id}>
                              [{it.itemCode}] {it.itemName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                          className="h-8 text-right font-mono font-bold"
                          required
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Input
                          value={item.unit}
                          onChange={(e) => handleLineItemChange(idx, 'unit', e.target.value)}
                          className="h-8 text-center uppercase"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={item.rate}
                          onChange={(e) => handleLineItemChange(idx, 'rate', e.target.value)}
                          className="h-8 text-right font-mono font-bold text-emerald-700"
                          required
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                        {(item.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          value={item.remarks || ''}
                          onChange={(e) => handleLineItemChange(idx, 'remarks', e.target.value)}
                          placeholder="e.g. Special wash"
                          className="h-8 text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                          title="Remove Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-neutral-50 font-bold border-t border-neutral-200">
                  <tr>
                    <td className="py-2.5 px-3 uppercase text-neutral-600">Total Calculation:</td>
                    <td className="py-2.5 px-2 text-right font-mono text-neutral-900">
                      {totalQuantity.toLocaleString()}
                    </td>
                    <td colSpan={2} className="py-2.5 px-2 text-right uppercase text-neutral-600">
                      Grand Total ({currency}):
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm">
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 3: Delivery Dates & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Target Required Date</label>
              <Input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Expected Delivery Date</label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 uppercase">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="BDT">BDT (৳)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="RMB">RMB (¥)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-700 uppercase">Order Instructions / Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Delivery terms, packing instructions, quality standards, or transport requirements..."
              rows={2}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-800"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <div className="text-neutral-500 text-[11px]">
              Total items: <strong className="text-neutral-900">{lineItems.length}</strong> | Total Value: <strong className="text-emerald-700">{currency} {totalAmount.toFixed(2)}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {isSaving ? 'Saving...' : editingId ? 'Update Order' : 'Create Order'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* View Subcontract Order Detail Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={selectedOrderForView ? `Sub Contract Order: ${selectedOrderForView.orderNo}` : 'Order Detail'}
        className="max-w-3xl"
      >
        {selectedOrderForView && (
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Order Type</span>
                <p className="font-bold text-neutral-900 capitalize flex items-center gap-1 mt-0.5">
                  {getTypeIcon(selectedOrderForView.orderType)}
                  {selectedOrderForView.orderType}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Order Date</span>
                <p className="font-bold text-neutral-900 mt-0.5">{selectedOrderForView.orderDate}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Supplier</span>
                <p className="font-bold text-neutral-900 mt-0.5">{selectedOrderForView.supplierName}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Status</span>
                <div className="mt-0.5">{getStatusBadge(selectedOrderForView.status)}</div>
              </div>

              {selectedOrderForView.buyerName && (
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Buyer</span>
                  <p className="font-bold text-neutral-900 mt-0.5">{selectedOrderForView.buyerName}</p>
                </div>
              )}
              {selectedOrderForView.style && (
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Style</span>
                  <p className="font-bold text-neutral-900 mt-0.5">{selectedOrderForView.style}</p>
                </div>
              )}
              {selectedOrderForView.subContractRef && (
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Ref / WO</span>
                  <p className="font-bold text-neutral-900 mt-0.5">{selectedOrderForView.subContractRef}</p>
                </div>
              )}
              {selectedOrderForView.deliveryDate && (
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Delivery Date</span>
                  <p className="font-bold text-neutral-900 mt-0.5">{selectedOrderForView.deliveryDate}</p>
                </div>
              )}
            </div>

            {/* Progress status bar */}
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-900">Outsourced Production Fulfillment</span>
                <span className="font-mono font-bold text-indigo-700">
                  {selectedOrderForView.receivedQuantity || 0} / {selectedOrderForView.totalQuantity} (
                  {selectedOrderForView.totalQuantity > 0 
                    ? Math.round(((selectedOrderForView.receivedQuantity || 0) / selectedOrderForView.totalQuantity) * 100)
                    : 0}%)
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${selectedOrderForView.totalQuantity > 0 
                      ? Math.min(100, Math.round(((selectedOrderForView.receivedQuantity || 0) / selectedOrderForView.totalQuantity) * 100))
                      : 0}%`
                  }}
                />
              </div>
              <div className="grid grid-cols-3 text-center text-[11px] pt-1">
                <div>
                  <span className="text-neutral-500">Ordered:</span>{' '}
                  <strong className="text-neutral-900 font-mono">{selectedOrderForView.totalQuantity}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Issued:</span>{' '}
                  <strong className="text-amber-700 font-mono">{selectedOrderForView.issuedQuantity || 0}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Received:</span>{' '}
                  <strong className="text-emerald-700 font-mono">{selectedOrderForView.receivedQuantity || 0}</strong>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3">Item Code & Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {selectedOrderForView.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-blue-600 mr-1">{item.itemCode}</span>
                        <span className="font-bold text-neutral-900">{item.itemName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">{item.categoryName}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                        {selectedOrderForView.currency} {item.rate.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                        {selectedOrderForView.currency} {item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-neutral-50 font-bold border-t border-neutral-200">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 uppercase text-neutral-600">Total</td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-900">{selectedOrderForView.totalQuantity}</td>
                    <td className="py-2.5 px-3 text-right uppercase text-neutral-600">Grand Total:</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm">
                      {selectedOrderForView.currency} {selectedOrderForView.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedOrderForView.remarks && (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <span className="font-bold text-neutral-700 uppercase text-[10px]">Remarks:</span>
                <p className="text-neutral-600 mt-0.5">{selectedOrderForView.remarks}</p>
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                {onNavigateToPO && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsViewModalOpen(false);
                      onNavigateToPO(selectedOrderForView);
                    }}
                    className="h-8 text-xs gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Generate Subcontract PO
                  </Button>
                )}
                {onNavigateToIssue && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsViewModalOpen(false);
                      onNavigateToIssue(selectedOrderForView);
                    }}
                    className="h-8 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    Issue Material
                  </Button>
                )}
                {onNavigateToReceive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsViewModalOpen(false);
                      onNavigateToReceive(selectedOrderForView);
                    }}
                    className="h-8 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Receive Goods
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsViewModalOpen(false)}
                className="h-8 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
