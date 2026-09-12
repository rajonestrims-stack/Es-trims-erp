import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Printer, 
  Edit3, 
  Trash2, 
  Download, 
  RefreshCw, 
  Building2, 
  Calendar, 
  DollarSign, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Truck,
  PackageCheck,
  FolderTree,
  Sparkles,
  Scissors,
  Palette,
  ArrowDownToLine,
  Clock,
  Check
} from 'lucide-react';
import { 
  SubContractCategory, 
  SubContractSubCategory,
  SubContractItem, 
  SubContractOrder, 
  SubContractPrice, 
  SubContractPurchaseOrder, 
  SubContractPurchaseOrderItem,
  SubContractReceive,
  Supplier, 
  UserProfile 
} from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { ConfirmModal, ConfirmVariant } from '../ui/ConfirmModal';
import { PurchaseOrderPrintView, POPrintData } from '../PurchaseOrderPrintView';
import { format } from 'date-fns';

interface SubContractPurchaseOrderViewProps {
  purchaseOrders: SubContractPurchaseOrder[];
  orders: SubContractOrder[];
  categories: SubContractCategory[];
  subCategories: SubContractSubCategory[];
  items: SubContractItem[];
  prices: SubContractPrice[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSavePO: (po: Partial<SubContractPurchaseOrder>) => Promise<void>;
  onDeletePO: (id: string) => Promise<void>;
  onSaveReceive?: (receive: Partial<SubContractReceive>) => Promise<void>;
  isEditor: boolean;
}

export const SubContractPurchaseOrderView: React.FC<SubContractPurchaseOrderViewProps> = ({
  purchaseOrders,
  orders,
  categories,
  subCategories,
  items,
  prices,
  suppliers,
  userProfile,
  showToast,
  onSavePO,
  onDeletePO,
  onSaveReceive,
  isEditor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPOForPrint, setSelectedPOForPrint] = useState<SubContractPurchaseOrder | null>(null);
  const [selectedPOForReceive, setSelectedPOForReceive] = useState<SubContractPurchaseOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State for PO
  const [editingId, setEditingId] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [subContractOrderId, setSubContractOrderId] = useState('');
  const [orderType, setOrderType] = useState<'dyeing' | 'woven' | 'embroidery' | 'printing' | 'washing' | 'finishing' | 'other'>('dyeing');
  const [currency, setCurrency] = useState('BDT');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTo, setDeliveryTo] = useState('ES Trims Limited, C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400');
  const [discount, setDiscount] = useState<number | string>(0);
  const [taxVatPercent, setTaxVatPercent] = useState<number | string>(0);
  const [taxAitPercent, setTaxAitPercent] = useState<number | string>(0);
  const [additionalCharges, setAdditionalCharges] = useState<number | string>(0);
  const [termsConditions, setTermsConditions] = useState(
    '1. Material specifications, shade & count must strictly match approved master sample.\n' +
    '2. Delivery must be on or before agreed delivery date.\n' +
    '3. Mention this PO Number on all delivery challans and invoices.\n' +
    '4. Rejected or defective goods will be replaced / reworked at vendor cost.\n' +
    '5. Bill payment upon QC inspection & verification as per company terms.'
  );
  const [remarks, setRemarks] = useState('');

  const [poItems, setPoItems] = useState<SubContractPurchaseOrderItem[]>([]);

  // Receive Modal State
  const [receiveChallanNo, setReceiveChallanNo] = useState('');
  const [supplierChallanNo, setSupplierChallanNo] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverDetails, setDriverDetails] = useState('');
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [qualityStatus, setQualityStatus] = useState<'passed' | 'rejected' | 'rework' | 'accepted_with_deviation'>('passed');
  const [receiveItemInputs, setReceiveItemInputs] = useState<{ [itemIdx: number]: number }>({});
  const [isReceiving, setIsReceiving] = useState(false);

  const filteredPOs = purchaseOrders.filter(p => {
    const matchesSearch = 
      p.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.subContractOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.items.some(it => it.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || (it.subCategoryName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSupplier = supplierFilter === 'all' || p.supplierId === supplierFilter;
    const matchesOrderType = orderTypeFilter === 'all' || p.orderType === orderTypeFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesSupplier && matchesOrderType && matchesStatus;
  });

  const getAutoPONo = () => {
    const year = new Date().getFullYear();
    const count = purchaseOrders.length + 1;
    return `SC-PO-${year}-${String(count).padStart(4, '0')}`;
  };

  // Helper to look up price from Master for Supplier + Sub-Category
  const findPriceForSubCategory = (supId: string, subCatId?: string, itId?: string) => {
    if (!supId) return 0;
    // 1. Try exact supplier + subCategoryId
    if (subCatId) {
      const p = prices.find(pr => pr.supplierId === supId && pr.subCategoryId === subCatId && pr.status === 'active');
      if (p) return p.contractPrice;
    }
    // 2. Try supplier + itemId
    if (itId) {
      const p = prices.find(pr => pr.supplierId === supId && pr.itemId === itId && pr.status === 'active');
      if (p) return p.contractPrice;
    }
    // 3. Try subCategory default
    if (subCatId) {
      const p = prices.find(pr => pr.subCategoryId === subCatId && pr.status === 'active');
      if (p) return p.contractPrice;
    }
    return 0;
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmText?: string;
    variant: ConfirmVariant;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'approve',
    onConfirm: () => {},
  });

  const triggerApprovePO = (po: SubContractPurchaseOrder) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Subcontract Purchase Order',
      message: `Are you sure you want to approve Purchase Order #${po.poNumber}?`,
      subMessage: `Supplier: ${po.supplierName} • Order Type: ${po.orderType.toUpperCase()} • Total: ${po.currency} ${po.grandTotal.toLocaleString()}`,
      variant: 'approve',
      confirmText: 'Yes, Approve PO',
      onConfirm: () => handleApprovePO(po)
    });
  };

  // Approval Handler
  const handleApprovePO = async (po: SubContractPurchaseOrder) => {
    try {
      const approverName = userProfile.displayName || userProfile.email || 'Admin';
      await onSavePO({
        ...po,
        status: 'approved',
        approvedBy: approverName,
        approvedAt: new Date().toISOString()
      });
      showToast(`Purchase Order ${po.poNumber} Approved successfully by ${approverName}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to approve PO', 'error');
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setPoNumber(getAutoPONo());
    setPoDate(new Date().toISOString().split('T')[0]);
    const firstSup = suppliers[0]?.id || '';
    setSupplierId(firstSup);
    setSubContractOrderId('');
    setOrderType('dyeing');
    setCurrency('BDT');
    setDeliveryDate('');
    setDeliveryTo('ES Trims Limited, C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400');
    setDiscount(0);
    setTaxVatPercent(0);
    setTaxAitPercent(0);
    setAdditionalCharges(0);
    setTermsConditions(
      '1. Material specifications, shade & count must strictly match approved master sample.\n' +
      '2. Delivery must be on or before agreed delivery date.\n' +
      '3. Mention this PO Number on all delivery challans and invoices.\n' +
      '4. Rejected or defective goods will be replaced / reworked at vendor cost.\n' +
      '5. Bill payment upon QC inspection & verification as per company terms.'
    );
    setRemarks('');

    // Default first item with first subcategory
    const firstSubCat = subCategories[0];
    const initialRate = findPriceForSubCategory(firstSup, firstSubCat?.id);

    setPoItems([
      {
        itemName: firstSubCat ? `${firstSubCat.subCategoryName} Process` : 'Subcontract Processing',
        categoryId: firstSubCat?.categoryId || '',
        categoryName: firstSubCat?.categoryName || 'General',
        subCategoryId: firstSubCat?.id || '',
        subCategoryName: firstSubCat?.subCategoryName || '',
        specification: 'Standard Factory Grade',
        quantity: 100,
        receivedQuantity: 0,
        balanceQuantity: 100,
        unit: firstSubCat?.defaultUnit || 'KG',
        rate: initialRate,
        amount: initialRate * 100
      }
    ]);

    setIsModalOpen(true);
  };

  // When supplier changes in PO form, re-check rates for line items
  const handleSupplierChange = (newSupId: string) => {
    setSupplierId(newSupId);
    setPoItems(prev => prev.map(item => {
      const foundRate = findPriceForSubCategory(newSupId, item.subCategoryId, item.itemId);
      const newRate = foundRate > 0 ? foundRate : item.rate;
      return {
        ...item,
        rate: newRate,
        amount: (Number(item.quantity) || 0) * newRate
      };
    }));
  };

  // When order type changes, adapt preset terms & items
  const handleOrderTypeChange = (newType: any) => {
    setOrderType(newType);
    const matchedSubCats = subCategories.filter(sc => sc.orderType === newType || !sc.orderType);
    const firstSubCat = matchedSubCats[0] || subCategories[0];
    const rate = findPriceForSubCategory(supplierId, firstSubCat?.id);

    if (poItems.length === 1 && !poItems[0].itemName.trim()) {
      setPoItems([
        {
          itemName: firstSubCat ? `${firstSubCat.subCategoryName} Service` : `${newType.toUpperCase()} Job`,
          categoryId: firstSubCat?.categoryId || '',
          categoryName: firstSubCat?.categoryName || 'General',
          subCategoryId: firstSubCat?.id || '',
          subCategoryName: firstSubCat?.subCategoryName || '',
          specification: 'As per approved standard',
          quantity: 100,
          receivedQuantity: 0,
          balanceQuantity: 100,
          unit: firstSubCat?.defaultUnit || (newType === 'dyeing' ? 'KG' : 'PCS'),
          rate,
          amount: rate * 100
        }
      ]);
    }
  };

  const handleOpenEdit = (po: SubContractPurchaseOrder) => {
    setEditingId(po.id);
    setPoNumber(po.poNumber);
    setPoDate(po.poDate);
    setSupplierId(po.supplierId);
    setSubContractOrderId(po.subContractOrderId || '');
    setOrderType(po.orderType || 'dyeing');
    setCurrency(po.currency || 'BDT');
    setDeliveryDate(po.deliveryDate || '');
    setDeliveryTo(po.deliveryTo || 'ES Trims Limited, C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400');
    setDiscount(po.discount || 0);
    setTaxVatPercent(po.taxVatPercent !== undefined ? po.taxVatPercent : 0);
    setTaxAitPercent(po.taxAitPercent !== undefined ? po.taxAitPercent : 0);
    setAdditionalCharges(po.additionalCharges || 0);
    setTermsConditions(po.termsConditions || '');
    setRemarks(po.remarks || '');
    setPoItems(po.items.map(i => ({ 
      ...i, 
      receivedQuantity: i.receivedQuantity || 0,
      balanceQuantity: i.balanceQuantity ?? (i.quantity - (i.receivedQuantity || 0))
    })));
    setIsModalOpen(true);
  };

  // Line item manipulation
  const handleAddItem = () => {
    const matchedSubCats = subCategories.filter(sc => sc.orderType === orderType || !sc.orderType);
    const subCat = matchedSubCats[0] || subCategories[0];
    const rate = findPriceForSubCategory(supplierId, subCat?.id);

    setPoItems(prev => [
      ...prev,
      {
        itemName: subCat ? `${subCat.subCategoryName}` : 'Subcontract Processing',
        categoryId: subCat?.categoryId || '',
        categoryName: subCat?.categoryName || 'General',
        subCategoryId: subCat?.id || '',
        subCategoryName: subCat?.subCategoryName || '',
        specification: 'Standard Specification',
        quantity: 50,
        receivedQuantity: 0,
        balanceQuantity: 50,
        unit: subCat?.defaultUnit || (orderType === 'dyeing' ? 'KG' : 'PCS'),
        rate,
        amount: rate * 50
      }
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setPoItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubCategorySelectOnItem = (idx: number, subCatId: string) => {
    const sc = subCategories.find(s => s.id === subCatId);
    const autoRate = findPriceForSubCategory(supplierId, subCatId);

    setPoItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const qty = Number(item.quantity) || 0;
      const rate = autoRate > 0 ? autoRate : item.rate;
      return {
        ...item,
        subCategoryId: subCatId,
        subCategoryName: sc?.subCategoryName || '',
        categoryId: sc?.categoryId || item.categoryId,
        categoryName: sc?.categoryName || item.categoryName,
        unit: sc?.defaultUnit || item.unit,
        rate,
        amount: qty * rate
      };
    }));
  };

  const handleLineItemChange = (idx: number, field: keyof SubContractPurchaseOrderItem, value: any) => {
    setPoItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        const qty = Number(field === 'quantity' ? value : updated.quantity) || 0;
        const r = Number(field === 'rate' ? value : updated.rate) || 0;
        updated.amount = qty * r;
        updated.balanceQuantity = Math.max(0, qty - (updated.receivedQuantity || 0));
      }
      return updated;
    }));
  };

  // Calculations
  const calculatedSubtotal = poItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const calculatedTotalQty = poItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const calculatedVatAmount = (calculatedSubtotal * (Number(taxVatPercent) || 0)) / 100;
  const calculatedAitAmount = (calculatedSubtotal * (Number(taxAitPercent) || 0)) / 100;
  const calculatedGrandTotal = calculatedSubtotal - (Number(discount) || 0) + calculatedVatAmount + calculatedAitAmount + (Number(additionalCharges) || 0);

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      showToast('Supplier is required', 'error');
      return;
    }
    if (poItems.length === 0) {
      showToast('At least one item is required in the PO', 'error');
      return;
    }

    const sup = suppliers.find(s => s.id === supplierId);
    setIsSaving(true);

    try {
      const existingPO = editingId ? purchaseOrders.find(p => p.id === editingId) : null;
      const totalRec = poItems.reduce((sum, it) => sum + (it.receivedQuantity || 0), 0);
      const totalQty = calculatedTotalQty;
      const totalBal = Math.max(0, totalQty - totalRec);

      // Determine automatic status based on received quantities
      let autoStatus = existingPO?.status || 'confirmed';
      if (autoStatus !== 'draft' && autoStatus !== 'cancelled') {
        if (totalRec === 0) {
          autoStatus = 'confirmed';
        } else if (totalRec >= totalQty) {
          autoStatus = 'fully_received';
        } else {
          autoStatus = 'partially_received';
        }
      }

      await onSavePO({
        id: editingId || undefined,
        poNumber: poNumber.trim().toUpperCase(),
        poDate,
        supplierId,
        supplierName: sup?.name || 'Supplier',
        supplierAddress: sup?.address || [sup?.addressLine1, sup?.city, sup?.country].filter(Boolean).join(', '),
        supplierContact: sup?.contactPerson || '',
        supplierEmail: sup?.email || '',
        subContractOrderId: subContractOrderId || undefined,
        orderType,
        items: poItems,
        totalQuantity: totalQty,
        receivedQuantity: totalRec,
        balanceQuantity: totalBal,
        subtotal: calculatedSubtotal,
        discount: Number(discount) || 0,
        taxVatPercent: Number(taxVatPercent) || 0,
        taxVatAmount: calculatedVatAmount,
        taxAitPercent: Number(taxAitPercent) || 0,
        taxAitAmount: calculatedAitAmount,
        additionalCharges: Number(additionalCharges) || 0,
        grandTotal: calculatedGrandTotal,
        currency,
        deliveryDate: deliveryDate || undefined,
        deliveryTo: deliveryTo || undefined,
        termsConditions: termsConditions || undefined,
        remarks: remarks || undefined,
        status: autoStatus as any,
        preparedBy: userProfile.displayName || userProfile.email || 'Admin',
        businessId: userProfile.businessId || ''
      });

      showToast(editingId ? 'Purchase Order updated' : 'Purchase Order created successfully', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save PO', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Receive / MRR Dialog Handler
  const handleOpenReceive = (po: SubContractPurchaseOrder) => {
    setSelectedPOForReceive(po);
    setReceiveChallanNo(`MRR-SC-${Date.now().toString().slice(-4)}`);
    setSupplierChallanNo('');
    setReceiveDate(new Date().toISOString().split('T')[0]);
    setVehicleNo('');
    setDriverDetails('');
    setReceiveRemarks('');
    setQualityStatus('passed');

    // Default receiving inputs to the remaining balance of each item
    const initialInputs: { [idx: number]: number } = {};
    po.items.forEach((it, idx) => {
      const balance = it.balanceQuantity ?? (it.quantity - (it.receivedQuantity || 0));
      initialInputs[idx] = balance > 0 ? balance : 0;
    });
    setReceiveItemInputs(initialInputs);
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOForReceive) return;

    // Check if at least one item has > 0 quantity
    const totalReceivingNow: number = Object.values(receiveItemInputs).reduce<number>((sum, q) => sum + (Number(q) || 0), 0);
    if (totalReceivingNow <= 0) {
      showToast('Please enter a receive quantity greater than 0', 'error');
      return;
    }

    setIsReceiving(true);
    try {
      // 1. Build line-by-line receive updates
      const updatedItems = selectedPOForReceive.items.map((it, idx) => {
        const qtyNow = Number(receiveItemInputs[idx]) || 0;
        const prevRec = it.receivedQuantity || 0;
        const newRec = prevRec + qtyNow;
        const newBal = Math.max(0, it.quantity - newRec);

        return {
          ...it,
          receivedQuantity: newRec,
          balanceQuantity: newBal
        };
      });

      const totalOrdered = updatedItems.reduce((sum, it) => sum + it.quantity, 0);
      const totalReceived = updatedItems.reduce((sum, it) => sum + (it.receivedQuantity || 0), 0);
      const totalBalance = Math.max(0, totalOrdered - totalReceived);

      const newStatus = totalReceived >= totalOrdered ? 'fully_received' : 'partially_received';

      // 2. Save receiving records to subcontract_receives if handler provided
      if (onSaveReceive) {
        for (let idx = 0; idx < selectedPOForReceive.items.length; idx++) {
          const it = selectedPOForReceive.items[idx];
          const qtyNow = Number(receiveItemInputs[idx]) || 0;
          if (qtyNow > 0) {
            await onSaveReceive({
              receiveNo: `SC-RCV-${Date.now().toString().slice(-6)}`,
              poId: selectedPOForReceive.id,
              poNumber: selectedPOForReceive.poNumber,
              orderId: selectedPOForReceive.subContractOrderId,
              supplierId: selectedPOForReceive.supplierId,
              supplierName: selectedPOForReceive.supplierName,
              orderType: selectedPOForReceive.orderType,
              itemId: it.itemId,
              itemName: it.itemName,
              categoryName: it.categoryName,
              subCategoryName: it.subCategoryName,
              receivedQuantity: qtyNow,
              unit: it.unit,
              receiveDate,
              challanNo: receiveChallanNo || `RCV-${Date.now()}`,
              supplierChallanNo,
              qualityStatus,
              vehicleNo,
              driverDetails,
              remarks: receiveRemarks,
              createdBy: userProfile.displayName || userProfile.email || 'Admin',
              businessId: userProfile.businessId || ''
            });
          }
        }
      }

      // 3. Update PO with newly received quantities and status
      await onSavePO({
        id: selectedPOForReceive.id,
        items: updatedItems,
        receivedQuantity: totalReceived,
        balanceQuantity: totalBalance,
        status: newStatus as any
      });

      showToast(`Received ${totalReceivingNow} units successfully against ${selectedPOForReceive.poNumber}`, 'success');
      setSelectedPOForReceive(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to process receive', 'error');
    } finally {
      setIsReceiving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeletePO(id);
      showToast('Purchase order deleted', 'success');
      setIsDeleting(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete PO', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Sub Contract Purchase Orders
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Create and track subcontract POs for Dyeing, Woven, Embroidery, and Printing. Auto-populates rates from Sub-Category Price Master.
          </p>
        </div>

        {isEditor && (
          <Button
            onClick={handleOpenAdd}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Sub Contract PO
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search PO #, supplier, items..."
            className="pl-9 text-xs rounded-xl bg-white border-neutral-200"
          />
        </div>

        <div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="all">All Process Types</option>
            <option value="dyeing">Dyeing & Washing</option>
            <option value="woven">Woven & Narrow Fabric</option>
            <option value="embroidery">Embroidery</option>
            <option value="printing">Screen & Digital Printing</option>
            <option value="washing">Washing</option>
            <option value="finishing">Finishing / Other</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed (Pending Rcv)</option>
            <option value="partially_received">Partially Received</option>
            <option value="fully_received">Fully Received / Complete</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* PO List Cards / Table */}
      <div className="space-y-4">
        {filteredPOs.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-neutral-200 shadow-sm">
            <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-neutral-700">No Sub Contract Purchase Orders Found</p>
            <p className="text-xs text-neutral-400 mt-1">Create a purchase order to initiate subcontract jobs and track receiving.</p>
            {isEditor && (
              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="mt-4 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First PO
              </Button>
            )}
          </div>
        ) : (
          filteredPOs.map((po) => {
            const totalQty = po.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            const totalRec = po.items.reduce((s, it) => s + (Number(it.receivedQuantity) || 0), 0);
            const balance = Math.max(0, totalQty - totalRec);
            const percent = totalQty > 0 ? Math.min(100, Math.round((totalRec / totalQty) * 100)) : 0;

            const isFullyReceived = totalRec >= totalQty && totalQty > 0;
            const isPartiallyReceived = totalRec > 0 && totalRec < totalQty;

            return (
              <Card key={po.id} className="p-5 rounded-2xl border border-neutral-200/90 hover:shadow-md transition-shadow bg-white">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-neutral-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-black text-indigo-700 text-sm bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                        {po.poNumber}
                      </span>

                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-bold text-[10px] rounded-lg uppercase tracking-wide">
                        {po.orderType || 'General'}
                      </span>

                      {po.status === 'approved' ? (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          APPROVED
                        </span>
                      ) : po.status === 'draft' ? (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200">
                          DRAFT
                        </span>
                      ) : po.status === 'pending_approval' ? (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-lg bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-700" />
                          PENDING APPROVAL
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                          CONFIRMED
                        </span>
                      )}

                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg ${
                        isFullyReceived 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : isPartiallyReceived 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                      }`}>
                        {isFullyReceived ? 'FULLY RECEIVED' : isPartiallyReceived ? `PARTIALLY RECEIVED (${percent}%)` : 'PENDING RECEIVE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-600 pt-1 flex-wrap">
                      <span className="font-bold text-neutral-900 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                        {po.supplierName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-neutral-500">
                        <Calendar className="w-3.5 h-3.5" />
                        Date: {po.poDate}
                      </span>
                      {po.deliveryDate && (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 font-medium">Delivery: {po.deliveryDate}</span>
                        </>
                      )}
                      {po.approvedBy && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Approved by: {po.approvedBy}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
                    {/* Approve PO Button if not yet approved */}
                    {isEditor && po.status !== 'approved' && (
                      <Button
                        onClick={() => triggerApprovePO(po)}
                        size="sm"
                        className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-sm"
                        title="Approve and Authorize this PO"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve PO
                      </Button>
                    )}

                    {/* Receive / MRR Button */}
                    <Button
                      onClick={() => handleOpenReceive(po)}
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      Goods Received (MRR)
                    </Button>

                    {/* Print Preview Button */}
                    <Button
                      onClick={() => setSelectedPOForPrint(po)}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs font-semibold rounded-xl border-neutral-200 hover:bg-neutral-50"
                    >
                      <Printer className="w-3.5 h-3.5 text-neutral-600" />
                      Print PO Slip
                    </Button>

                    {isEditor && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(po)}
                          className="p-2 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-neutral-200"
                          title="Edit PO"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setIsDeleting(po.id)}
                          className="p-2 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-neutral-200"
                          title="Delete PO"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress & Items Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 text-xs">
                  {/* Progress Bar Card */}
                  <div className="md:col-span-1 bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Receipt Fulfillment</span>
                      <div className="flex justify-between items-baseline font-black text-neutral-900">
                        <span className="text-base text-emerald-700">{totalRec.toLocaleString()}</span>
                        <span className="text-xs text-neutral-500">/ {totalQty.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden mt-2">
                        <div 
                          className={`h-full transition-all rounded-full ${
                            percent >= 100 ? 'bg-emerald-600' : percent > 0 ? 'bg-amber-500' : 'bg-neutral-300'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-neutral-200/60 flex justify-between text-[11px]">
                      <span className="text-neutral-500">Due / Balance:</span>
                      <span className="font-bold text-rose-700">{balance.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Line Items List */}
                  <div className="md:col-span-3 space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase">
                            <th className="pb-1.5">Item Description</th>
                            <th className="pb-1.5">Sub-Category</th>
                            <th className="pb-1.5 text-right">Order Qty</th>
                            <th className="pb-1.5 text-right">Received</th>
                            <th className="pb-1.5 text-right">Rate</th>
                            <th className="pb-1.5 text-right">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {po.items.map((it, idx) => (
                            <tr key={idx} className="text-neutral-700">
                              <td className="py-1.5 font-bold text-neutral-900">
                                {it.itemName}
                                {it.specification && (
                                  <span className="block text-[10px] text-neutral-400 font-normal">{it.specification}</span>
                                )}
                              </td>
                              <td className="py-1.5">
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-medium text-[10px] rounded">
                                  {it.subCategoryName || it.categoryName || '—'}
                                </span>
                              </td>
                              <td className="py-1.5 text-right font-bold">
                                {it.quantity} {it.unit}
                              </td>
                              <td className="py-1.5 text-right font-bold text-emerald-700">
                                {it.receivedQuantity || 0} {it.unit}
                              </td>
                              <td className="py-1.5 text-right font-mono text-neutral-600">
                                {it.rate.toLocaleString()} Tk
                              </td>
                              <td className="py-1.5 text-right font-mono font-black text-neutral-900">
                                {it.amount.toLocaleString()} Tk
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold text-neutral-900 border-t border-neutral-200">
                            <td colSpan={5} className="pt-2 text-right uppercase text-[10px] text-neutral-500">Grand Total:</td>
                            <td className="pt-2 text-right font-mono font-black text-indigo-900">
                              {po.grandTotal.toLocaleString()} {po.currency || 'BDT'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal 1: Create / Edit Purchase Order */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Sub Contract Purchase Order' : 'Create Sub Contract Purchase Order'}
      >
        <form onSubmit={handleSubmitPO} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Header Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">PO Number *</label>
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                required
                className="text-xs rounded-xl font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">PO Date *</label>
              <Input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                required
                className="text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Process / Order Type *</label>
              <select
                value={orderType}
                onChange={(e) => handleOrderTypeChange(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-indigo-700"
              >
                <option value="dyeing">Dyeing & Washing</option>
                <option value="woven">Woven & Narrow Fabric</option>
                <option value="embroidery">Embroidery Work</option>
                <option value="printing">Screen & Digital Printing</option>
                <option value="washing">Washing & Treatment</option>
                <option value="finishing">Finishing / General</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Supplier / Subcontractor *</label>
              <select
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                required
                className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {s.contactPerson || s.phone || ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Expected Delivery Date</label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Order Items & Sub-Categories
                </h4>
                <p className="text-[11px] text-neutral-400">Select Sub-Category to auto-fill unit rate from Price Master</p>
              </div>

              <Button
                type="button"
                onClick={handleAddItem}
                size="sm"
                variant="outline"
                className="gap-1 text-xs rounded-xl font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </Button>
            </div>

            <div className="space-y-3">
              {poItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-neutral-700">Item #{idx + 1}</span>
                    {poItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-600 hover:text-rose-700 text-xs font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-bold text-neutral-600 mb-0.5">Sub-Category (Rates Link) *</label>
                      <select
                        value={item.subCategoryId || ''}
                        onChange={(e) => handleSubCategorySelectOnItem(idx, e.target.value)}
                        required
                        className="w-full h-8 px-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-indigo-500 font-bold text-indigo-800"
                      >
                        <option value="">Select Sub-Category</option>
                        {subCategories.map(sc => (
                          <option key={sc.id} value={sc.id}>{sc.subCategoryName} ({sc.defaultUnit})</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-neutral-600 mb-0.5">Item Description / Name *</label>
                      <Input
                        value={item.itemName}
                        onChange={(e) => handleLineItemChange(idx, 'itemName', e.target.value)}
                        required
                        placeholder="e.g. Cotton Yarn Reactive Dyeing, 3D Front Panel Embroidery"
                        className="h-8 text-xs rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-0.5">Quantity *</label>
                      <Input
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(idx, 'quantity', Number(e.target.value))}
                        required
                        placeholder="Qty"
                        className="h-8 text-xs rounded-lg font-bold bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-0.5">Unit *</label>
                      <select
                        value={item.unit}
                        onChange={(e) => handleLineItemChange(idx, 'unit', e.target.value)}
                        className="w-full h-8 px-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none font-medium"
                      >
                        <option value="KG">KG</option>
                        <option value="PCS">PCS</option>
                        <option value="YDS">YDS</option>
                        <option value="DZN">DZN</option>
                        <option value="MTR">MTR</option>
                        <option value="GROSS">GROSS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-0.5">Unit Rate (Tk) *</label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={item.rate}
                        onChange={(e) => handleLineItemChange(idx, 'rate', Number(e.target.value))}
                        required
                        placeholder="Rate"
                        className="h-8 text-xs rounded-lg font-bold font-mono text-emerald-700 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-0.5">Total Amount (Tk)</label>
                      <div className="h-8 px-2 flex items-center justify-end font-mono font-black text-neutral-900 bg-neutral-200/70 rounded-lg text-xs">
                        {item.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Input
                      value={item.specification || ''}
                      onChange={(e) => handleLineItemChange(idx, 'specification', e.target.value)}
                      placeholder="Specifications / Color / Stitch details / Remarks..."
                      className="h-7 text-[11px] rounded-lg bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700">Delivery Address / Destination</label>
              <Input
                value={deliveryTo}
                onChange={(e) => setDeliveryTo(e.target.value)}
                className="text-xs rounded-xl"
              />

              <label className="block text-xs font-bold text-neutral-700 mt-2">Terms & Conditions</label>
              <textarea
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                rows={3}
                className="w-full p-2 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none font-medium"
              />
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-neutral-700">
                <span>Subtotal ({calculatedTotalQty} units):</span>
                <span className="font-mono font-bold">{calculatedSubtotal.toLocaleString()} Tk</span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-neutral-700">VAT (%):</span>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={taxVatPercent}
                    onChange={(e) => setTaxVatPercent(e.target.value)}
                    placeholder="0"
                    className="h-7 text-xs text-right rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-neutral-700">AIT (%):</span>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={taxAitPercent}
                    onChange={(e) => setTaxAitPercent(e.target.value)}
                    placeholder="0"
                    className="h-7 text-xs text-right rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-neutral-700">Discount (Tk):</span>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="h-7 text-xs text-right rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 flex justify-between items-center font-black text-sm text-neutral-900">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700">{calculatedGrandTotal.toLocaleString()} {currency}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-neutral-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Purchase Order' : 'Confirm Purchase Order'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Receive Goods / MRR Slip Dialog */}
      <Modal
        isOpen={!!selectedPOForReceive}
        onClose={() => setSelectedPOForReceive(null)}
        title={`Receive Subcontract Goods (MRR) - ${selectedPOForReceive?.poNumber || ''}`}
      >
        {selectedPOForReceive && (
          <form onSubmit={handleConfirmReceive} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            {/* Summary Banner */}
            <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-100 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-neutral-900">Supplier: {selectedPOForReceive.supplierName}</span>
                <span className="font-mono font-bold text-indigo-700">{selectedPOForReceive.orderType.toUpperCase()} JOB</span>
              </div>
              <p className="text-neutral-600">PO Date: {selectedPOForReceive.poDate}</p>
            </div>

            {/* Challan & Receipt Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">MRR / Receive No *</label>
                <Input
                  value={receiveChallanNo}
                  onChange={(e) => setReceiveChallanNo(e.target.value)}
                  required
                  className="text-xs rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Supplier Challan No</label>
                <Input
                  value={supplierChallanNo}
                  onChange={(e) => setSupplierChallanNo(e.target.value)}
                  placeholder="e.g. CH-9812"
                  className="text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Receive Date *</label>
                <Input
                  type="date"
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  required
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Line Items Receiving Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-neutral-700">Line Items to Receive</h4>
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-200 text-[10px] font-bold text-neutral-600 uppercase">
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-right">Order Qty</th>
                      <th className="p-2.5 text-right">Prev Rcv</th>
                      <th className="p-2.5 text-right">Balance</th>
                      <th className="p-2.5 text-right w-28">Receiving Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {selectedPOForReceive.items.map((it, idx) => {
                      const prevRcv = it.receivedQuantity || 0;
                      const bal = it.balanceQuantity ?? Math.max(0, it.quantity - prevRcv);

                      return (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="p-2.5">
                            <span className="font-bold text-neutral-900">{it.itemName}</span>
                            <span className="block text-[10px] text-neutral-400">{it.subCategoryName || it.categoryName}</span>
                          </td>
                          <td className="p-2.5 text-right font-medium">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-700">
                            {prevRcv} {it.unit}
                          </td>
                          <td className="p-2.5 text-right font-bold text-rose-700">
                            {bal} {it.unit}
                          </td>
                          <td className="p-2.5 text-right">
                            <Input
                              type="number"
                              step="any"
                              value={receiveItemInputs[idx] ?? 0}
                              onChange={(e) => setReceiveItemInputs(prev => ({
                                ...prev,
                                [idx]: Number(e.target.value)
                              }))}
                              max={bal > 0 ? bal : undefined}
                              className="h-8 text-xs font-bold font-mono text-right text-emerald-800 rounded-lg bg-white border-emerald-300 focus:border-emerald-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quality and Vehicle Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">QC / Inspection Status</label>
                <select
                  value={qualityStatus}
                  onChange={(e) => setQualityStatus(e.target.value as any)}
                  className="w-full h-10 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="passed">Passed QC Inspection</option>
                  <option value="accepted_with_deviation">Accepted with Deviation</option>
                  <option value="rework">Hold / Rework Needed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Vehicle / Transport No</label>
                <Input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="e.g. Dhaka Metro-Ta-11-2233"
                  className="text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Driver Details</label>
                <Input
                  value={driverDetails}
                  onChange={(e) => setDriverDetails(e.target.value)}
                  placeholder="Name & Contact"
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Receive Notes / Remarks</label>
              <textarea
                value={receiveRemarks}
                onChange={(e) => setReceiveRemarks(e.target.value)}
                rows={2}
                placeholder="e.g. Checked roll count, 10 rolls received in good condition..."
                className="w-full p-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none font-medium"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-neutral-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedPOForReceive(null)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isReceiving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl gap-1.5"
              >
                <Check className="w-4 h-4" />
                {isReceiving ? 'Processing Receive...' : 'Confirm Goods Received'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 3: Print PO Slip */}
      {selectedPOForPrint && (() => {
        const sup = suppliers.find(s => s.id === selectedPOForPrint.supplierId);
        const poPrintData: POPrintData = {
          documentType: 'subcontract-order',
          title: 'Sub Contract Order',
          status: selectedPOForPrint.status === 'fully_received' ? 'COMPLETED' : 'CONFIRMED',
          poNumber: selectedPOForPrint.poNumber,
          poDate: selectedPOForPrint.poDate,
          deliveryDate: selectedPOForPrint.deliveryDate || selectedPOForPrint.poDate,
          deliveryTo: selectedPOForPrint.deliveryTo || 'ES Trims Limited, C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400',
          currency: selectedPOForPrint.currency || 'BDT',
          serviceCategory: selectedPOForPrint.orderType ? `${selectedPOForPrint.orderType.toUpperCase()} Job` : undefined,

          supplierName: selectedPOForPrint.supplierName || sup?.name || '—',
          supplierAddress: selectedPOForPrint.supplierAddress || sup?.address || '',
          supplierContact: selectedPOForPrint.supplierContact || sup?.contactPerson || '',
          supplierPhone: sup?.phone || sup?.mobile || '',
          supplierEmail: selectedPOForPrint.supplierEmail || sup?.email || '',
          supplierTinBin: '',

          items: selectedPOForPrint.items.map((it, idx) => ({
            sl: idx + 1,
            itemCode: it.itemCode || `SC-${101 + idx}`,
            itemName: it.itemName,
            specification: it.specification || it.subCategoryName || 'Standard Subcontract Specification',
            unit: it.unit || 'PCS',
            quantity: it.quantity,
            unitPrice: it.rate,
            amount: it.amount || (it.quantity * it.rate)
          })),

          subTotal: selectedPOForPrint.subtotal,
          vatPercent: selectedPOForPrint.taxVatPercent !== undefined ? selectedPOForPrint.taxVatPercent : 0,
          vatAmount: selectedPOForPrint.taxVatAmount !== undefined ? selectedPOForPrint.taxVatAmount : (selectedPOForPrint.subtotal * (selectedPOForPrint.taxVatPercent || 0) / 100),
          aitPercent: selectedPOForPrint.taxAitPercent !== undefined ? selectedPOForPrint.taxAitPercent : 0,
          aitAmount: selectedPOForPrint.taxAitAmount !== undefined ? selectedPOForPrint.taxAitAmount : (selectedPOForPrint.subtotal * (selectedPOForPrint.taxAitPercent || 0) / 100),
          discount: selectedPOForPrint.discount || 0,
          additionalCharges: selectedPOForPrint.additionalCharges || 0,
          grandTotal: selectedPOForPrint.grandTotal,

          notes: selectedPOForPrint.termsConditions || selectedPOForPrint.remarks,
          termsAndConditions: selectedPOForPrint.termsConditions,
          preparedByName: selectedPOForPrint.preparedBy || userProfile.displayName || userProfile.email || 'Admin',
          preparedByDesignation: (userProfile as any).designation || 'Purchase Executive',
          preparedByDate: selectedPOForPrint.poDate,
          checkedByName: undefined, // Blank for physical signature
          approvedByName: undefined, // Blank for physical signature
          acceptedByName: selectedPOForPrint.supplierContact || '',
          acceptedByCompany: selectedPOForPrint.supplierName
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print-bg">
            <div className="bg-transparent w-full max-w-5xl my-8">
              <PurchaseOrderPrintView 
                data={poPrintData}
                onClose={() => setSelectedPOForPrint(null)}
              />
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal: Delete */}
      <Modal
        isOpen={!!isDeleting}
        onClose={() => setIsDeleting(null)}
        title="Confirm Delete Purchase Order"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-600">
            Are you sure you want to delete this subcontract purchase order? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleting(null)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => isDeleting && handleDelete(isDeleting)}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        subMessage={confirmModal.subMessage}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
};
