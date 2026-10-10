/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Customer, Supplier } from '../../types';
import { getCustomers } from '../../services/customers';
import { getSuppliers } from '../../services/suppliers';
import { recordPaymentTransaction } from '../../services/payments';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import { formatSAR } from '../../utils/formatters';
import {
  X,
  User,
  Truck,
  Calendar,
  CreditCard,
  FileText,
  Save,
  AlertCircle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded: () => void;
  initialPartyType?: 'customer' | 'supplier';
  initialParty?: Customer | Supplier | null;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentRecorded,
  initialPartyType = 'customer',
  initialParty = null,
}) => {
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>(initialPartyType);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [amount, setAmount] = useState<string | number>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('TRANSFER');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadParties();
      if (initialPartyType) {
        setPartyType(initialPartyType);
      }
      if (initialParty) {
        setSelectedPartyId(initialParty.id);
        const bal = initialPartyType === 'customer'
          ? (initialParty as Customer).currentBalance || 0
          : (initialParty as Supplier).balance || 0;
        if (bal > 0) {
          setAmount(bal.toString());
        }
      }
    }
  }, [isOpen, initialPartyType, initialParty]);

  const loadParties = async () => {
    setIsLoadingParties(true);
    try {
      const [cList, sList] = await Promise.all([getCustomers(), getSuppliers()]);
      setCustomers(cList);
      setSuppliers(sList);

      if (!initialParty) {
        if (partyType === 'customer' && cList.length > 0) {
          setSelectedPartyId(cList[0].id);
          setAmount(cList[0].currentBalance > 0 ? cList[0].currentBalance.toString() : '');
        } else if (partyType === 'supplier' && sList.length > 0) {
          setSelectedPartyId(sList[0].id);
          setAmount(sList[0].balance > 0 ? sList[0].balance.toString() : '');
        }
      }
    } catch (err) {
      console.error('خطأ في جلب بيانات العملاء والموردين:', err);
    } finally {
      setIsLoadingParties(false);
    }
  };

  const currentCustomer = customers.find((c) => c.id === selectedPartyId);
  const currentSupplier = suppliers.find((s) => s.id === selectedPartyId);

  const currentBalance = partyType === 'customer'
    ? currentCustomer?.currentBalance || 0
    : currentSupplier?.balance || 0;

  const handlePartyTypeChange = (type: 'customer' | 'supplier') => {
    setPartyType(type);
    if (type === 'customer') {
      if (customers.length > 0) {
        setSelectedPartyId(customers[0].id);
        setAmount(customers[0].currentBalance > 0 ? customers[0].currentBalance.toString() : '');
      }
    } else {
      if (suppliers.length > 0) {
        setSelectedPartyId(suppliers[0].id);
        setAmount(suppliers[0].balance > 0 ? suppliers[0].balance.toString() : '');
      }
    }
  };

  const handlePartySelection = (pId: string) => {
    setSelectedPartyId(pId);
    if (partyType === 'customer') {
      const c = customers.find((x) => x.id === pId);
      if (c && c.currentBalance > 0) {
        setAmount(c.currentBalance.toString());
      } else {
        setAmount('');
      }
    } else {
      const s = suppliers.find((x) => x.id === pId);
      if (s && s.balance > 0) {
        setAmount(s.balance.toString());
      } else {
        setAmount('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);

    if (!selectedPartyId) {
      setErrorMessage(partyType === 'customer' ? 'يرجى اختيار العميل.' : 'يرجى اختيار المورد.');
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('المبلغ يجب أن يكون أكبر من الصفر.');
      return;
    }

    const partyName = partyType === 'customer'
      ? currentCustomer?.name || 'عميل غير معروف'
      : currentSupplier?.companyName || 'مورد غير معروف';

    try {
      setIsSubmitting(true);
      await recordPaymentTransaction({
        paymentType: partyType === 'customer' ? 'receipt' : 'disbursement',
        partyType,
        partyId: selectedPartyId,
        partyName,
        amount: numericAmount,
        paymentMethodId,
        reference: reference.trim() || undefined,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        notes: notes.trim() || undefined,
        actorName: 'أمين الصندوق',
      });

      onPaymentRecorded();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تسجيل الدفعة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className={`p-4 text-white flex items-center justify-between ${
          partyType === 'customer' ? 'bg-amber-600' : 'bg-blue-600'
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <SaudiRiyalSymbol className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {partyType === 'customer' ? 'سند قبض دفعة من عميل' : 'سند صرف دفعة لمورد'}
              </h3>
              <p className="text-[11px] text-white/80">
                تسجيل السداد وتحديث كشف الحساب والأرصدة المستحقة تلقائياً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          
          {/* Party Type Toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1 font-bold">
            <button
              type="button"
              onClick={() => handlePartyTypeChange('customer')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                partyType === 'customer'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>قبض من عميل (سداد مديونية)</span>
            </button>
            <button
              type="button"
              onClick={() => handlePartyTypeChange('supplier')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                partyType === 'supplier'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>صرف لمورد (سداد مستحقات)</span>
            </button>
          </div>

          {/* Party Selection & Current Balance Preview */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {partyType === 'customer' ? 'العميل' : 'المورد / الشركة'} <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedPartyId}
              onChange={(e) => handlePartySelection(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 text-xs font-semibold"
            >
              {partyType === 'customer'
                ? customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - (رصيد مستحق: {formatSAR(c.currentBalance || 0)})
                    </option>
                  ))
                : suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName} - (مستحق له: {formatSAR(s.balance || 0)})
                    </option>
                  ))}
            </select>

            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <span className="text-slate-600">
                {partyType === 'customer' ? 'الرصيد القائم في ذمة العميل:' : 'المستحق الحالي للمورد:'}
              </span>
              <span className={`font-mono font-black text-sm ${currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatSAR(currentBalance)}
              </span>
            </div>
          </div>

          {/* Amount & Quick Full Balance */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                المبلغ المسدد (ر.س) <span className="text-rose-500">*</span>
              </label>
              {currentBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(currentBalance.toString())}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  سداد كامل الرصيد المستحق ({formatSAR(currentBalance)})
                </button>
              )}
            </div>
            <div className="relative">
              <SaudiRiyalSymbol className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 text-sm font-mono font-black text-slate-900"
              />
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">طريقة الدفع</label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 font-semibold"
              >
                <option value="TRANSFER">تحويل بنكي / إيداع</option>
                <option value="CASH">نقداً من الخزينة</option>
                <option value="MADA">شبكة مدى / بطاقة</option>
                <option value="CHECK">شيك مصرفي</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ العملية</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Reference / Transaction ID */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              المرجع البنكي / رقم الإيصال أو الشيك
            </label>
            <input
              type="text"
              dir="ltr"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="مثال: REF-BANK-89412 أو رقم الشيك 4512"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 font-mono font-bold text-right"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">ملاحظات وبيان السند</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="دفعة تحت الحساب، سداد فاتورة توريد رقم..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* New Balance Preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-slate-600">الرصيد المتبقي بعد السداد:</span>
            <span className="font-mono font-bold text-slate-800">
              {formatSAR(Math.max(0, currentBalance - (typeof amount === 'number' ? amount : parseFloat(amount) || 0)))}
            </span>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className={`px-5 py-2 font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                partyType === 'customer'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جاري حفظ السند وتحديث الحساب...'
                  : partyType === 'customer'
                  ? 'تسجيل سند القبض'
                  : 'تسجيل سند الصرف'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
