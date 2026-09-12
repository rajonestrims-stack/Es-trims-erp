import React from 'react';
import { SubContractPurchaseOrder, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { ArrowLeft } from 'lucide-react';
import { PurchaseOrderPrintView, POPrintData } from '../PurchaseOrderPrintView';

interface SubContractPrintPOProps {
  po: SubContractPurchaseOrder;
  userProfile: UserProfile;
  onBack: () => void;
}

export const SubContractPrintPO: React.FC<SubContractPrintPOProps> = ({
  po,
  userProfile,
  onBack
}) => {
  const vatPercent = po.taxVatPercent !== undefined ? po.taxVatPercent : 0;
  const vatAmount = po.taxVatAmount !== undefined ? po.taxVatAmount : ((po.subtotal * vatPercent) / 100);
  const aitPercent = po.taxAitPercent !== undefined ? po.taxAitPercent : 0;
  const aitAmount = po.taxAitAmount !== undefined ? po.taxAitAmount : ((po.subtotal * aitPercent) / 100);

  const poPrintData: POPrintData = {
    documentType: 'subcontract-order',
    title: 'Sub Contract Order',
    status: (po.status || 'CONFIRMED').toUpperCase(),
    poNumber: po.poNumber,
    poDate: po.poDate || new Date().toISOString(),
    deliveryDate: po.deliveryDate || po.poDate || new Date().toISOString(),
    deliveryTo: po.deliveryTo || 'ES Trims Limited, C-15, Panchaboti, Industrial Park, Hariharpara, Enayetnagar, Fatullah, Narayanganj 1400',
    currency: po.currency || 'BDT',
    orderRef: po.subContractOrderNo,
    serviceCategory: po.orderType ? `${po.orderType.toUpperCase()} Job` : undefined,

    // Supplier Info
    supplierName: po.supplierName,
    supplierAddress: po.supplierAddress || '',
    supplierContact: po.supplierContact || '',
    supplierPhone: po.supplierPhone || '',
    supplierEmail: po.supplierEmail || '',
    supplierTinBin: '',

    // Items
    items: po.items.map((item, idx) => ({
      sl: idx + 1,
      itemCode: item.itemCode || `SC-${idx + 101}`,
      itemName: item.itemName,
      specification: item.remarks || (item.categoryName ? `Process Category: ${item.categoryName}` : 'Subcontract Processing & Finishing'),
      unit: item.unit || 'PCS',
      quantity: item.quantity,
      unitPrice: item.rate,
      amount: item.amount || (item.quantity * item.rate)
    })),

    // Financials
    subTotal: po.subtotal,
    vatPercent,
    vatAmount,
    aitPercent,
    aitAmount,
    discount: po.discount || 0,
    additionalCharges: po.additionalCharges || 0,
    grandTotal: po.grandTotal || (po.subtotal + vatAmount + aitAmount - (po.discount || 0) + (po.additionalCharges || 0)),

    // Terms & Conditions
    termsAndConditions: po.termsConditions,
    notes: po.remarks,

    // Signatures: Prepared By shows creator name. Checked By & Approved By are BLANK for physical verification.
    preparedByName: po.preparedBy || userProfile.displayName || userProfile.email || 'Admin',
    preparedByDesignation: (userProfile as any).designation || 'Purchase / Subcontract Executive',
    preparedByDate: po.poDate,
    checkedByName: undefined,
    approvedByName: undefined,
    acceptedByName: po.supplierContact || '',
    acceptedByCompany: po.supplierName
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Back button row */}
      <div className="print:hidden flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Subcontract Purchase Orders
        </Button>
      </div>

      {/* Styled Printable Component */}
      <PurchaseOrderPrintView data={poPrintData} />
    </div>
  );
};
