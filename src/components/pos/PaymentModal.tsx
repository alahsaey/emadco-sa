/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Customer, PaymentMethod, TerminalPaymentResponse } from '../../types';
import { PosCartItem } from '../../services/pos';
import {
  Banknote,
  CreditCard,
  Building,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Radio,
  Wifi,
  Sparkles,
  User,
  Phone,
  FileText,
} from 'lucide-react';
import { PaymentTerminalModal } from './PaymentTerminalModal';
import { getCustomers, createCustomer } from '../../services/customers';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import { formatSAR, formatNumber } from '../../utils/formatters';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  selectedCustomer: Customer | null;
  paymentMethods: PaymentMethod[];
  onConfirmSale: (paymentData: {
    paymentMethodCode: string;
    paymentMethodName: string;
    paymentReference?: string;
    paidAmount: number;
    notes?: string;
    customerId?: string;
    customerName?: string;
    customerTaxNumber?: string;
    customerPhone?: string;
    terminalTransactionId?: string;
    terminalAuthCode?: string;
    terminalRrn?: string;
    terminalId?: string;
    cardScheme?: string;
    cardLast4?: string;
    idempotencyKey?: string;
  }) => Promise<void>;
  isProcessing: boolean;
  onSelectCustomer?: (customer: Customer | null) => void;
  cartItems?: PosCartItem[];
  defaultBuyerName?: string;
  defaultBuyerPhone?: string;
  defaultBuyerTaxNumber?: string;
  onUpdateBuyerInfo?: (info: { buyerName: string; buyerPhone: string; buyerTaxNumber: string }) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  subtotal,
  taxTotal,
  discountTotal,
  selectedCustomer: initialCustomer,
  paymentMethods,
  onConfirmSale,
  isProcessing,
  onSelectCustomer,
  cartItems = [],
  defaultBuyerName = '',
  defaultBuyerPhone = '',
  defaultBuyerTaxNumber = '',
  onUpdateBuyerInfo,
}) => {
  const [selectedMethodCode, setSelectedMethodCode] = useState<string>('MADA');
  const [cashTendered, setCashTendered] = useState<number>(grandTotal);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // إدارة بيانات المشتري والفاتورة
  const [buyerName, setBuyerName] = useState<string>(defaultBuyerName);
  const [buyerPhone, setBuyerPhone] = useState<string>(defaultBuyerPhone);
  const [buyerTaxNumber, setBuyerTaxNumber] = useState<string>(defaultBuyerTaxNumber);
  const [saveAsCustomer, setSaveAsCustomer] = useState<boolean>(false);

  // هل السلة تتضمن أصناف كالون سلندر أو أصناف تستلزم تسجيل اسم المشتري
  const cartRequiresBuyerName = Boolean(
    cartItems?.some(
      (it) =>
        it.requiresBuyerName ||
        it.productName?.includes('سلندر') ||
        it.productName?.includes('كالون') ||
        it.productName?.includes('قفل')
    )
  );

  const specialItemNames = (cartItems || [])
    .filter(
      (it) =>
        it.requiresBuyerName ||
        it.productName?.includes('سلندر') ||
        it.productName?.includes('كالون') ||
        it.productName?.includes('قفل')
    )
    .map((it) => it.productName);

  // إدارة العميل للبيع الآجل
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(initialCustomer);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCreditLimit, setNewCustCreditLimit] = useState('5000');
  const [isSavingNewCust, setIsSavingNewCust] = useState(false);

  // حالة تكامل جهاز نقاط البيع
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState<boolean>(false);
  const [terminalData, setTerminalData] = useState<TerminalPaymentResponse | null>(null);
  const [showManualMadaReference, setShowManualMadaReference] = useState<boolean>(false);

  useEffect(() => {
    setActiveCustomer(initialCustomer);
  }, [initialCustomer]);

  useEffect(() => {
    if (isOpen) {
      setCashTendered(grandTotal);
      setReferenceNumber('');
      setNotes('');
      setValidationError(null);
      setTerminalData(null);
      setIsTerminalModalOpen(false);
      setIsAddingNewCustomer(false);
      setBuyerName(
        defaultBuyerName ||
        (initialCustomer && initialCustomer.id !== 'cust_walk_in' ? initialCustomer.name : '')
      );
      setBuyerPhone(defaultBuyerPhone || initialCustomer?.phone || '');
      setBuyerTaxNumber(defaultBuyerTaxNumber || initialCustomer?.taxNumber || '');
      setSaveAsCustomer(false);
      getCustomers().then(setAvailableCustomers).catch(() => {});
    }
  }, [isOpen, grandTotal, defaultBuyerName, defaultBuyerPhone, defaultBuyerTaxNumber, initialCustomer]);

  if (!isOpen) return null;

  // طرق الدفع الافتراضية
  const defaultMethods = [
    { code: 'CASH', nameAr: 'نقدي (كاش)', icon: SaudiRiyalSymbol, color: 'emerald' },
    { code: 'MADA', nameAr: 'شبكة مدى / نقاط بيع', icon: CreditCard, color: 'blue' },
    { code: 'TRANSFER', nameAr: 'تحويل بنكي', icon: Building, color: 'indigo' },
    { code: 'CREDIT', nameAr: 'حساب آجل (ذمم)', icon: Clock, color: 'amber' },
  ];

  const currentMethod = defaultMethods.find((m) => m.code === selectedMethodCode) || defaultMethods[0];

  const changeAmount = selectedMethodCode === 'CASH' && cashTendered > grandTotal
    ? Math.round((cashTendered - grandTotal) * 100) / 100
    : 0;

  const isCashInsufficient = selectedMethodCode === 'CASH' && cashTendered < grandTotal;

  // فحص السقف الائتماني للعميل
  const isCreditExceeded =
    selectedMethodCode === 'CREDIT' &&
    activeCustomer &&
    activeCustomer.creditLimit > 0 &&
    (activeCustomer.currentBalance || 0) + grandTotal > activeCustomer.creditLimit;

  const handleCashShortcut = (amount: number) => {
    setCashTendered(amount);
  };

  const handleExactCash = () => {
    setCashTendered(grandTotal);
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      setValidationError('يرجى إدخال اسم ورقم جوال العميل لحفظ حسابه.');
      return;
    }
    setIsSavingNewCust(true);
    setValidationError(null);
    try {
      const created = await createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        customerType: 'contractor',
        priceTier: 'contractor',
        creditLimit: parseFloat(newCustCreditLimit) || 5000,
        initialBalance: 0,
      });
      setAvailableCustomers((prev) => [...prev, created]);
      setActiveCustomer(created);
      if (onSelectCustomer) onSelectCustomer(created);
      setIsAddingNewCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
    } catch (err: any) {
      setValidationError(err?.message || 'تعذر إنشاء حساب العميل.');
    } finally {
      setIsSavingNewCust(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);

    const trimmedBuyerName = buyerName.trim();
    if (cartRequiresBuyerName && !trimmedBuyerName) {
      setValidationError('⚠️ تنبيه إلزامي: تحتوي السلة على أصناف (مثل كالون سلندر / كوالين وضمانات) تتطلب تسجيل اسم المشتري لإتمام الفاتورة وتوثيق الضمان.');
      return;
    }

    if (selectedMethodCode === 'CASH') {
      if (cashTendered < grandTotal) {
        setValidationError(`المبلغ المدفوع (${cashTendered} ر.س) أقل من إجمالي الفاتورة (${grandTotal} ر.س).`);
        return;
      }
    }

    let customerToUse = activeCustomer;

    // حفظ كعميل دائم إذا تم تحديد الخيار
    if (saveAsCustomer && trimmedBuyerName && trimmedBuyerName !== 'عميل نقدي' && (!customerToUse || customerToUse.id === 'cust_walk_in')) {
      try {
        const created = await createCustomer({
          name: trimmedBuyerName,
          phone: buyerPhone.trim() || '0500000000',
          customerType: 'individual',
          priceTier: 'retail',
          creditLimit: 0,
          initialBalance: 0,
          taxNumber: buyerTaxNumber.trim() || undefined,
        });
        customerToUse = created;
        setActiveCustomer(created);
        if (onSelectCustomer) onSelectCustomer(created);
      } catch (e) {
        console.warn('Could not auto-save customer:', e);
      }
    }

    if (selectedMethodCode === 'CREDIT') {
      // إذا قام الكاشير بكتابة اسم العميل في حقل الإضافة السريع
      if (!customerToUse && newCustName.trim()) {
        try {
          const created = await createCustomer({
            name: newCustName.trim(),
            phone: newCustPhone.trim() || '0500000000',
            customerType: 'contractor',
            priceTier: 'contractor',
            creditLimit: parseFloat(newCustCreditLimit) || 100000,
            initialBalance: 0,
          });
          customerToUse = created;
          setActiveCustomer(created);
          if (onSelectCustomer) onSelectCustomer(created);
        } catch {
          // fallback to general
        }
      }

      // إذا لم يكن هناك عميل محدد، نختار من القائمة أو ننشئ حساب ذمم افتراضي فوراً
      if (!customerToUse) {
        if (availableCustomers.length > 0) {
          customerToUse = availableCustomers[0];
          setActiveCustomer(customerToUse);
        } else {
          try {
            const created = await createCustomer({
              name: 'حساب آجل عام (ذمم ومقاولين)',
              phone: '0500000000',
              customerType: 'contractor',
              priceTier: 'contractor',
              creditLimit: 100000,
              initialBalance: 0,
            });
            customerToUse = created;
            setActiveCustomer(created);
            if (onSelectCustomer) onSelectCustomer(created);
          } catch {
            // fallback handled by backend pos.ts
          }
        }
      }

      if (customerToUse && customerToUse.creditLimit > 0) {
        const potentialBalance = (customerToUse.currentBalance || 0) + grandTotal;
        if (potentialBalance > customerToUse.creditLimit) {
          setValidationError(`تنبيه: إجمالي الرصيد (${potentialBalance} ر.س) يتجاوز السقف الائتماني المسموح به للعميل (${customerToUse.creditLimit} ر.س).`);
          return;
        }
      }
    }

    if ((selectedMethodCode === 'MADA' || selectedMethodCode === 'TRANSFER') && !referenceNumber.trim()) {
      // مرجع اختياري محبذ أو مطلوب
    }

    // إذا تم اختيار نقاط البيع ولم يتم الإرسال لجهاز الدفع بعد ولم يختر الكاشير الإدخال اليدوي
    if (selectedMethodCode === 'MADA' && !terminalData && !showManualMadaReference) {
      setIsTerminalModalOpen(true);
      return;
    }

    const effectiveName =
      trimmedBuyerName ||
      (customerToUse && customerToUse.id !== 'cust_walk_in' ? customerToUse.name : '') ||
      (selectedMethodCode === 'CREDIT' ? 'حساب آجل (ذمم)' : 'عميل نقدي');

    if (onUpdateBuyerInfo) {
      onUpdateBuyerInfo({
        buyerName: trimmedBuyerName,
        buyerPhone: buyerPhone.trim(),
        buyerTaxNumber: buyerTaxNumber.trim(),
      });
    }

    try {
      await onConfirmSale({
        paymentMethodCode: selectedMethodCode,
        paymentMethodName: currentMethod.nameAr,
        paymentReference: referenceNumber.trim() || undefined,
        paidAmount: selectedMethodCode === 'CASH' ? cashTendered : selectedMethodCode === 'CREDIT' ? 0 : grandTotal,
        notes: notes.trim() || undefined,
        customerId: customerToUse?.id && customerToUse.id !== 'cust_walk_in' ? customerToUse.id : undefined,
        customerName: effectiveName,
        customerTaxNumber: buyerTaxNumber.trim() || customerToUse?.taxNumber,
        customerPhone: buyerPhone.trim() || customerToUse?.phone,
        terminalTransactionId: terminalData?.transactionId,
        terminalAuthCode: terminalData?.authCode,
        terminalRrn: terminalData?.rrn,
        terminalId: terminalData?.terminalId,
        cardScheme: terminalData?.cardScheme,
        cardLast4: terminalData?.cardLast4,
        idempotencyKey: terminalData?.idempotencyKey,
      });
    } catch (err: any) {
      setValidationError(err?.message || 'حدث خطأ أثناء اعتماد عملية البيع');
    }
  };

  // معالجة استجابة جهاز الدفع المعتمدة
  const handleTerminalSuccess = async (response: TerminalPaymentResponse) => {
    setTerminalData(response);
    setReferenceNumber(response.rrn || response.transactionId);
    setIsTerminalModalOpen(false);

    const trimmedBuyerName = buyerName.trim();
    const effectiveName =
      trimmedBuyerName ||
      (activeCustomer && activeCustomer.id !== 'cust_walk_in' ? activeCustomer.name : '') ||
      'عميل نقدي';

    if (onUpdateBuyerInfo) {
      onUpdateBuyerInfo({
        buyerName: trimmedBuyerName,
        buyerPhone: buyerPhone.trim(),
        buyerTaxNumber: buyerTaxNumber.trim(),
      });
    }

    try {
      await onConfirmSale({
        paymentMethodCode: 'MADA',
        paymentMethodName: 'شبكة مدى / نقاط بيع',
        paymentReference: response.rrn || response.transactionId,
        paidAmount: grandTotal,
        notes: notes.trim() || undefined,
        customerId: activeCustomer?.id && activeCustomer.id !== 'cust_walk_in' ? activeCustomer.id : undefined,
        customerName: effectiveName,
        customerTaxNumber: buyerTaxNumber.trim() || activeCustomer?.taxNumber,
        customerPhone: buyerPhone.trim() || activeCustomer?.phone,
        terminalTransactionId: response.transactionId,
        terminalAuthCode: response.authCode,
        terminalRrn: response.rrn,
        terminalId: response.terminalId,
        cardScheme: response.cardScheme,
        cardLast4: response.cardLast4,
        idempotencyKey: response.idempotencyKey,
      });
    } catch (err: any) {
      setValidationError(err?.message || 'حدث خطأ أثناء اعتماد عملية البيع وتحديث السجلات.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold">طريقة الدفع وإتمام الفاتورة</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* عرض المبلغ الإجمالي بوضوح فائق */}
        <div className="p-5 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 text-white text-center border-b border-slate-700">
          <div className="text-xs text-slate-300 font-medium mb-1">المبلغ الإجمالي المطلوب سداده</div>
          <div className="text-4xl font-black font-mono tracking-tight text-amber-400 inline-flex items-center justify-center gap-2">
            <span>{formatNumber(grandTotal || 0)}</span>
            <SaudiRiyalSymbol className="w-8 h-8 text-amber-400 inline-block" />
          </div>

          <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-slate-400 font-mono">
            <span>المجموع: {formatNumber(subtotal || 0)}</span>
            {discountTotal > 0 && <span className="text-rose-400">خصم: -{formatNumber(discountTotal || 0)}</span>}
            <span>الضريبة (15%): {formatNumber(taxTotal || 0)}</span>
          </div>

          {activeCustomer && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>العميل: <strong>{activeCustomer.name}</strong></span>
              {activeCustomer.customerType === 'contractor' && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">مقاول</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* رسائل الخطأ والتنبيه */}
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-medium">{validationError}</span>
            </div>
          )}

          {/* قسم بيانات المشتري والفاتورة الضريبية */}
          <div className={`p-3.5 rounded-2xl border transition-all ${
            cartRequiresBuyerName
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-slate-50/80 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  cartRequiresBuyerName ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-blue-600 text-white'
                }`}>
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">
                      اسم وبيانات المشتري (تُطبع في الفاتورة والإيصال)
                    </span>
                    {cartRequiresBuyerName && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                        إلزامي لهذا الصنف
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {cartRequiresBuyerName
                      ? `⚠️ تحتوي السلة على (${specialItemNames.slice(0, 2).join('، ')}${specialItemNames.length > 2 ? '...' : ''}) - يلزم تدوين اسم المشتري لتوثيق الضمان.`
                      : 'سجل اسم المشتري ليظهر بالفاتورة بدلاً من (عميل نقدي)، أو اتركه فارغاً للعميل النقدي.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  اسم المشتري:
                  {cartRequiresBuyerName && <span className="text-rose-600 font-black mr-1">*</span>}
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => {
                      setBuyerName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="مثال: صالح الياسين"
                    className={`w-full text-xs font-bold py-2 pr-9 pl-3 rounded-xl border bg-white focus:outline-hidden focus:ring-2 transition-all ${
                      cartRequiresBuyerName && !buyerName.trim()
                        ? 'border-amber-400 focus:ring-amber-500 text-slate-900 ring-1 ring-amber-300 placeholder:text-amber-700/60'
                        : 'border-slate-300 focus:ring-blue-500 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  رقم الجوال (اختياري / للواتساب):
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="0500680180"
                    className="w-full text-xs font-mono font-bold py-2 pr-9 pl-3 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* خيارات إضافية وتأكيد الاسم المطبوع */}
            <div className="mt-2 pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={saveAsCustomer}
                  onChange={(e) => setSaveAsCustomer(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-[11px] font-medium text-slate-600">حفظ كعميل دائم في سجل العملاء</span>
              </label>

              <div className="text-[11px] text-slate-600">
                الاسم في الفاتورة:{' '}
                <strong className={buyerName.trim() ? 'text-blue-700 font-bold' : 'text-slate-800 font-bold'}>
                  {buyerName.trim() || (activeCustomer && activeCustomer.id !== 'cust_walk_in' ? activeCustomer.name : 'عميل نقدي')}
                </strong>
              </div>
            </div>
          </div>

          {/* تبويبات طرق الدفع الرئيسية */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">اختر طريقة السداد:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {defaultMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedMethodCode === method.code;
                return (
                  <button
                    key={method.code}
                    type="button"
                    onClick={() => {
                      setSelectedMethodCode(method.code);
                      setValidationError(null);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold whitespace-nowrap">{method.nameAr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* خيارات وتفاصيل الطريقة المحددة */}
          {selectedMethodCode === 'CASH' && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <SaudiRiyalSymbol className="w-4 h-4 text-emerald-700" />
                  <span>المبلغ المستلم من الزبون:</span>
                </label>
                <button
                  type="button"
                  onClick={handleExactCash}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  المبلغ الدقيق ({formatSAR(grandTotal || 0)})
                </button>
              </div>

              <div className="relative">
                <SaudiRiyalSymbol className="w-5 h-5 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                  className="w-full text-2xl font-black font-mono text-center p-2.5 pr-10 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* اختصارات فئات النقد الشائعة */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[50, 100, 200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleCashShortcut(amt)}
                    className="flex-1 py-1.5 px-2 bg-white border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold font-mono text-emerald-800 transition-colors cursor-pointer"
                  >
                    {formatSAR(amt)}
                  </button>
                ))}
              </div>

              {/* حساب الباقي التلقائي */}
              <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900">المبلغ المتبقي للعميل (الباقي):</span>
                <span
                  className={`text-base font-black font-mono ${
                    isCashInsufficient ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {isCashInsufficient
                    ? `متبقي على العميل: ${formatSAR((grandTotal || 0) - (cashTendered || 0))}`
                    : formatSAR(changeAmount || 0)}
                </span>
              </div>
            </div>
          )}

          {/* نقاط بيع مدى / جهاز الدفع الآلي */}
          {selectedMethodCode === 'MADA' && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-slate-50 border-2 border-blue-200 rounded-2xl space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">تكامل جهاز نقاط البيع المعتمد (POS Integration)</h4>
                    <p className="text-[10px] text-slate-500">إرسال المبلغ آلياً دون الحاجة للكتابة اليدوية</p>
                  </div>
                </div>

                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                  ربط شبكة مدى
                </span>
              </div>

              {/* إذا تمت الموافقة من الجهاز */}
              {terminalData ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تمت الموافقة من جهاز الدفع بنجاح (Approved)</span>
                    </span>
                    <span className="font-mono text-[11px]">{formatSAR(grandTotal || 0)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono flex items-center gap-3">
                    <span>RRN: {terminalData.rrn}</span>
                    <span>AUTH: {terminalData.authCode}</span>
                    <span>{terminalData.cardScheme?.toUpperCase()}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 bg-white border border-blue-200/80 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">المبلغ المحدد للإرسال لشاشة الجهاز:</span>
                      <span className="text-xl font-black font-mono text-blue-700">
                        {formatSAR(grandTotal || 0)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsTerminalModalOpen(true)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span>إرسال المبلغ لجهاز الدفع ({formatSAR(grandTotal || 0)})</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setShowManualMadaReference(!showManualMadaReference)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {showManualMadaReference
                        ? 'إخفاء الإدخال اليدوي'
                        : 'أو إدخال رقم العملية يدوياً في حال استخدام جهاز خارجي غير متصل'}
                    </button>
                  </div>

                  {showManualMadaReference && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in">
                      <label className="block text-xs font-bold text-slate-700">
                        رقم العملية / المرجع من الإيصال الورقي (RRN):
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="مثال: RRN-99882341"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* تحويل بنكي */}
          {selectedMethodCode === 'TRANSFER' && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-indigo-900">
                رقم الحوالة البنكية / اسم المحول:
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="مثال: تحويل الراجحي - 55449900"
                className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          )}

          {/* بيع آجل للمقاولين والذمم */}
          {selectedMethodCode === 'CREDIT' && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>تحديد حساب العميل أو المقاول (ذمة مدينة):</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCustomer(!isAddingNewCustomer)}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 underline cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAddingNewCustomer ? 'إلغاء' : '➕ إضافة عميل/مقاول جديد'}</span>
                </button>
              </div>

              {/* إضافة عميل سريع */}
              {isAddingNewCustomer && (
                <div className="p-3 bg-white border border-amber-300 rounded-xl space-y-2 animate-in fade-in shadow-xs">
                  <div className="text-[11px] font-bold text-slate-800">إضافة عميل جديد فوراً لربط الفاتورة بذمته:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="اسم العميل (مثال: صالح الياسين) *"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="p-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="رقم الجوال (مثال: 0500680180) *"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="p-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">سقف الائتمان:</span>
                      <input
                        type="number"
                        value={newCustCreditLimit}
                        onChange={(e) => setNewCustCreditLimit(e.target.value)}
                        className="w-24 p-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickAddCustomer}
                      disabled={isSavingNewCust}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer transition-all"
                    >
                      {isSavingNewCust ? 'جاري الحفظ...' : 'حفظ واختيار العميل'}
                    </button>
                  </div>
                </div>
              )}

              {/* اختيار عميل من القائمة أو عرض العميل المحدد */}
              {!activeCustomer ? (
                <div className="space-y-2">
                  <div className="text-xs text-amber-900 font-bold">اختر العميل من القائمة:</div>
                  <select
                    value=""
                    onChange={(e) => {
                      const found = availableCustomers.find((c) => c.id === e.target.value);
                      if (found) {
                        setActiveCustomer(found);
                        if (onSelectCustomer) onSelectCustomer(found);
                      }
                    }}
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- اضغط لاختيار عميل مسجل --</option>
                    {availableCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.phone} (الرصيد: {formatSAR(c.currentBalance || 0)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs space-y-2 text-amber-950 bg-white/70 p-3 rounded-xl border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-600">حساب العميل المقيد عليه:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{activeCustomer.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCustomer(null);
                          if (onSelectCustomer) onSelectCustomer(null);
                        }}
                        className="text-[10px] text-amber-700 hover:underline cursor-pointer"
                      >
                        (تغيير)
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>الرصيد المستحق الحالي (الذمة الحالية):</span>
                    <span className="font-mono font-bold text-amber-900">
                      {formatSAR(activeCustomer.currentBalance || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>الحد الائتماني الأقصى:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {Number(activeCustomer.creditLimit || 0) > 0
                        ? formatSAR(activeCustomer.creditLimit || 0)
                        : 'غير محدد'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-amber-200">
                    <span className="font-bold">الرصيد المطلوب بعد هذه الفاتورة:</span>
                    <span
                      className={`font-mono font-black ${
                        isCreditExceeded ? 'text-rose-600 text-sm' : 'text-slate-900 text-sm'
                      }`}
                    >
                      {formatSAR((activeCustomer.currentBalance || 0) + (grandTotal || 0))}
                    </span>
                  </div>

                  {isCreditExceeded && (
                    <div className="p-2 bg-rose-100 text-rose-800 rounded-lg text-[11px] font-bold">
                      تحذير: الفاتورة ستتجاوز السقف الائتماني المسموح به للمقاول!
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ملاحظات الفاتورة */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">ملاحظات على الفاتورة (اختياري):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: توصيل لمشروع فيلا الياسمين..."
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* زر الاعتماد والتنفيذ الكبير والأصيل */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isProcessing || isCashInsufficient || isCreditExceeded}
              className={`w-full py-3.5 px-6 rounded-xl text-base font-bold flex items-center justify-center gap-3 shadow-lg transition-all cursor-pointer ${
                isProcessing || isCashInsufficient || isCreditExceeded
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-600/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري تسجيل المعاملة وخصم المخزون...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تأكيد الدفع وإصدار الفاتورة ({formatSAR(grandTotal || 0)})</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>

      {/* نافذة معالجة جهاز نقاط البيع المباشرة */}
      <PaymentTerminalModal
        isOpen={isTerminalModalOpen}
        onClose={() => setIsTerminalModalOpen(false)}
        grandTotal={grandTotal}
        cashierName="كاشير المحل"
        onPaymentSuccess={handleTerminalSuccess}
      />
    </div>
  );
};
