with open('src/components/commercial/ProformaInvoiceManagement.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if 'ConfirmModal' not in content:
    content = content.replace("import { Modal } from '../ui/Modal';", "import { Modal } from '../ui/Modal';\nimport { ConfirmModal, ConfirmVariant } from '../ui/ConfirmModal';")

# 2. Add confirm modal state
target = "  const handleApprovePI = async (pi: ProformaInvoice) => {"
replacement = """  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmText?: string;
    variant: ConfirmVariant;
    showReasonInput?: boolean;
    onConfirm: (reason?: string) => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'approve',
    onConfirm: () => {},
  });

  const triggerApprovePI = (pi: ProformaInvoice) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Proforma Invoice',
      message: 'Are you sure you want to approve Proforma Invoice #' + pi.piNumber + '?',
      subMessage: 'Buyer: ' + pi.buyerName + ' • Total Value: $' + pi.totalAmount.toLocaleString(),
      variant: 'approve',
      confirmText: 'Yes, Approve PI',
      onConfirm: () => handleApprovePI(pi)
    });
  };

  const triggerConfirmPI = (pi: ProformaInvoice) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Export Document PI',
      message: 'Are you sure you want to officially confirm Proforma Invoice #' + pi.piNumber + '?',
      subMessage: 'Buyer: ' + pi.buyerName + ' • Amount: $' + pi.totalAmount.toLocaleString(),
      variant: 'approve',
      confirmText: 'Yes, Confirm PI',
      onConfirm: () => handleConfirmPI(pi)
    });
  };

  const handleApprovePI = async (pi: ProformaInvoice) => {"

content = content.replace(target, replacement)

# 3. Replace call sites
content = content.replace("onClick={() => handleApprovePI(pi)}", "onClick={() => triggerApprovePI(pi)}")

# 4. Insert ConfirmModal JSX
end_tag = "    </div>\n  );\n};"
if end_tag in content:
    replacement_end = """      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        subMessage={confirmModal.subMessage}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        showReasonInput={confirmModal.showReasonInput}
      />
    </div>
  );
};"""
    content = content.replace(end_tag, replacement_end)

with open('src/components/commercial/ProformaInvoiceManagement.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ProformaInvoiceManagement updated successfully.")
