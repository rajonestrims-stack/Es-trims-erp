import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Button } from './Button';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ConfirmVariant = 'approve' | 'reject' | 'delete' | 'warning' | 'info';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  message: string;
  subMessage?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  showReasonInput?: boolean;
  reasonPlaceholder?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  subMessage,
  confirmText,
  cancelText = 'Cancel',
  variant = 'approve',
  isLoading = false,
  showReasonInput = false,
  reasonPlaceholder = 'Enter reason or remarks (optional)...',
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm(reason);
      setReason('');
      onClose();
    } catch (err) {
      console.error('Error during confirmation action:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = isLoading || submitting;

  const getVariantStyles = () => {
    switch (variant) {
      case 'approve':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold',
          defaultConfirmText: 'Yes, Approve',
        };
      case 'reject':
        return {
          icon: <XCircle className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-50 text-red-600 border border-red-200',
          confirmBtn: 'bg-red-600 hover:bg-red-700 text-white font-bold',
          defaultConfirmText: 'Yes, Reject',
        };
      case 'delete':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-50 text-red-600 border border-red-200',
          confirmBtn: 'bg-red-600 hover:bg-red-700 text-white font-bold',
          defaultConfirmText: 'Yes, Delete',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-50 text-amber-600 border border-amber-200',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white font-bold',
          defaultConfirmText: 'Confirm',
        };
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-50 text-blue-600 border border-blue-200',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white font-bold',
          defaultConfirmText: 'Confirm',
        };
    }
  };

  const style = getVariantStyles();
  const finalConfirmText = confirmText || style.defaultConfirmText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden transform transition-all p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={cn('p-3 rounded-xl shrink-0', style.iconBg)}>
            {style.icon}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-neutral-900 leading-snug">{title}</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">{message}</p>
            {subMessage && (
              <p className="text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 mt-2 font-medium">
                {subMessage}
              </p>
            )}
          </div>
        </div>

        {showReasonInput && (
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
              {variant === 'reject' ? 'Reason for Rejection' : 'Remarks / Note'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={2}
              className="w-full text-xs p-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-black/5 resize-none bg-neutral-50/50"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="text-xs font-semibold px-4 h-9"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className={cn('text-xs px-4 h-9 shadow-sm transition-all', style.confirmBtn)}
          >
            {isPending ? 'Processing...' : finalConfirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
