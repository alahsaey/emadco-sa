/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Return, ReturnReason } from '../../types';
import {
  SaleWithReturnability,
  getSaleForReturn,
  executeReturnTransaction,
  ReturnItemInput,
} from '../../services/returns';
import { formatSAR } from '../../utils/formatters';
import {
  Search,
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Square,
  Package,
  Calendar,
  User,
  Building,
  Loader2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface NewReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdReturn: Return) => void;
  initialInvoiceQuery?: string;
}

export const NewReturnModal: React.FC<NewReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialInvoiceQuery = '',
}) => {
  const [searchKey, setSearchKey] = useState<string>(initialInvoiceQuery);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saleData, setSaleData] = useState<SaleWithReturnability | null>(null);

  // حالة الاختيار والكميات
  // productId -> { selected: boolean, quantity: number, condition: string }
  const [itemSelections, setItemSelections] = useState<
    Record<string, { selected: boolean; quantity: number; condition: 'good_as_new' | 'damaged' | 'defective' }>
  >({});

  // سبب الإرجاع الرئيسي
  const [reason, setReason] = useState<ReturnReason>('عيب');
  const [reasonDetails, setReasonDetails] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'customer_balance' | 'bank_transfer'>('customer_balance');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  // تنفيذ البحث عن الفاتورة
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchKey.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSaleData(null);
    setItemSelections({});

    try {
      const result = await getSaleForReturn(searchKey);
      if (!result) {
        setSearchError('لم يتم العثور على أي فاتورة مبيعات مطابقة لهذا الرقم أو المعرف.');
      } else {
        setSaleData(result);
        // الافتراضي لطريقة السداد: إذا كان العميل مسجلاً ولديه حساب، نفضّل رصيد العميل، وإلا نقدي
        if (result.customer) {
          setRefundMethod('customer_balance');
        } else {
          setRefundMethod('cash');
        }

        // تهيئة قائمة الاختيارات
        const initialSelections: Record<
          string,
          { selected: boolean; quantity: number; condition: 'good_as_new' | 'damaged' | 'defective' }
        > = {};
        result.items.forEach((it) => {
          initialSelections[it.saleItem.productId] = {
            selected: false,
            quantity: it.maxReturnableQuantity > 0 ? 1 : 0,
            condition: 'good_as_new',
          };
        });
        setItemSelections(initialSelections);
      }
    } catch (err: any) {
      setSearchError(err.message || 'حدث خطأ أثناء استرجاع بيانات الفاتورة.');
    } finally {
      setIsSearching(false);
    }
  };

  // إرجاع الفاتورة كاملة (Select All with Max Returnable Quantities)
  const handleSelectFullInvoice = () => {
    if (!saleData) return;
    const updated: Record<
      string,
      { selected: boolean; quantity: number; condition: 'good_as_new' | 'damaged' | 'defective' }
    > = {};

    saleData.items.forEach((it) => {
      if (it.maxReturnableQuantity > 0) {
        updated[it.saleItem.productId] = {
          selected: true,
          quantity: it.maxReturnableQuantity,
          condition: 'good_as_new',
        };
      } else {
        updated[it.saleItem.productId] = {
          selected: false,
          quantity: 0,
          condition: 'good_as_new',
        };
      }
    });

    setItemSelections(updated);
  };

  // إلغاء تحديد الكل
  const handleDeselectAll = () => {
    if (!saleData) return;
    const updated: Record<
      string,
      { selected: boolean; quantity: number; condition: 'good_as_new' | 'damaged' | 'defective' }
    > = {};

    saleData.items.forEach((it) => {
      updated[it.saleItem.productId] = {
        selected: false,
        quantity: Math.min(1, it.maxReturnableQuantity),
        condition: 'good_as_new',
      };
    });

    setItemSelections(updated);
  };

  // تعديل اختيار بند محدد
  const handleToggleItem = (productId: string, maxReturnable: number) => {
    if (maxReturnable <= 0) return;
    setItemSelections((prev) => {
      const current = prev[productId] || { selected: false, quantity: 1, condition: 'good_as_new' };
      return {
        ...prev,
        [productId]: {
          ...current,
          selected: !current.selected,
          quantity: !current.selected && current.quantity === 0 ? 1 : current.quantity,
        },
      };
    });
  };

  // تعديل كمية بند محدد
  const handleQuantityChange = (productId: string, qty: number, maxReturnable: number) => {
    const validQty = Math.max(0, Math.min(maxReturnable, qty));
    setItemSelections((prev) => {
      const current = prev[productId] || { selected: false, quantity: 1, condition: 'good_as_new' };
      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: validQty,
          selected: validQty > 0,
        },
      };
    });
  };

  // احتساب الحصيلة المالية للمرتجع الحالي
  const calculatedSummary = (() => {
    if (!saleData) return { count: 0, subtotal: 0, taxTotal: 0, grandTotal: 0 };

    let subtotal = 0;
    let taxTotal = 0;
    let count = 0;

    saleData.items.forEach((it) => {
      const sel = itemSelections[it.saleItem.productId];
      if (sel && sel.selected && sel.quantity > 0) {
        count += sel.quantity;
        const lineSubtotal = it.unitPrice * sel.quantity;
        const lineTax = Math.round(lineSubtotal * (it.taxRate / 100) * 100) / 100;
        subtotal += lineSubtotal;
        taxTotal += lineTax;
      }
    });

    return {
      count,
      subtotal,
      taxTotal,
      grandTotal: Math.round((subtotal + taxTotal) * 100) / 100,
    };
  })();

  // إرسال وتنفيذ عملية المرتجع
  const handleSubmitReturn = async () => {
    if (!saleData) return;
    if (calculatedSummary.count === 0) {
      setSubmitError('يرجى تحديد صنف واحد على الأقل بكمية صالحة لإرجاعه.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const returnItemsPayload: ReturnItemInput[] = [];

      saleData.items.forEach((it) => {
        const sel = itemSelections[it.saleItem.productId];
        if (sel && sel.selected && sel.quantity > 0) {
          returnItemsPayload.push({
            productId: it.saleItem.productId,
            productName: it.saleItem.productName,
            quantity: sel.quantity,
            unitPrice: it.unitPrice,
            taxRate: it.taxRate,
            reason,
            returnCondition: sel.condition,
          });
        }
      });

      const result = await executeReturnTransaction({
        originalSaleId: saleData.sale.id,
        originalInvoiceNumber: saleData.invoice?.invoiceNumber || saleData.sale.saleNumber,
        customerId: saleData.sale.customerId,
        customerName: saleData.customer?.name || saleData.invoice?.customerName || 'عميل نقدي',
        warehouseId: saleData.sale.warehouseId,
        warehouseName: 'المستودع الرئيسي',
        reason,
        reasonDetails,
        refundMethod,
        processedBy: 'موظف المبيعات',
        items: returnItemsPayload,
      });

      onSuccess(result);
    } catch (err: any) {
      console.error('فشل إتمام المرتجع:', err);
      setSubmitError(err.message || 'حدث خطأ غير متوقع أثناء معالجة المرتجع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* رأس النافذة */}
        <div className="p-4 bg-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">تسجيل مرتجع مبيعات جديد (Return)</h3>
              <p className="text-[11px] text-rose-100">
                فتح فاتورة سابقة، إرجاع كامل أو جزئي، تحديث المخزون وحساب العميل
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

        {/* جسم النافذة */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-800">
          
          {/* الخطوة 1: البحث عن الفاتورة السابقة */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ابحث عن الفاتورة السابقة برقم الفاتورة (INV-...) أو رقم البيع (POS-...):
            </label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  placeholder="مثال: INV-2026-123456 أو POS-2026-123456"
                  className="w-full pr-9 pl-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchKey.trim()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>بحث وجلب الفاتورة</span>
              </button>
            </form>

            {searchError && (
              <div className="mt-2 text-xs text-rose-600 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* الخطوة 2: عرض تفاصيل الفاتورة وقائمة البنود للإرجاع */}
          {saleData && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* بطاقة معلومات الفاتورة المرجعية */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">رقم الفاتورة:</span>
                  <span className="font-mono font-bold text-rose-900">
                    {saleData.invoice?.invoiceNumber || saleData.sale.saleNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">العميل:</span>
                  <span className="font-bold text-slate-900">
                    {saleData.customer?.name || saleData.invoice?.customerName || 'عميل نقدي'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">تاريخ الشراء:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(saleData.sale.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">إجمالي الفاتورة:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {formatSAR(saleData.sale.grandTotal)}
                  </span>
                </div>
              </div>

              {/* أزرار الإرجاع السريعة */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-rose-600" />
                  <span>حدد البنود والكميات المراد إرجاعها:</span>
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectFullInvoice}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>إرجاع الفاتورة كاملة</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              {/* جدول بنود الفاتورة مع التحديد والكميات */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">اختيار</th>
                      <th className="py-2.5 px-3">المنتج</th>
                      <th className="py-2.5 px-2 text-center">الكمية المباعة</th>
                      <th className="py-2.5 px-2 text-center">مرتجع سابقاً</th>
                      <th className="py-2.5 px-2 text-center">المتاح للإرجاع</th>
                      <th className="py-2.5 px-3 text-center w-28">الكمية المرتجعة</th>
                      <th className="py-2.5 px-3 text-left">سعر الوحدة</th>
                      <th className="py-2.5 px-3 text-left">الإجمالي المسترد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {saleData.items.map((it) => {
                      const sel = itemSelections[it.saleItem.productId] || {
                        selected: false,
                        quantity: 0,
                        condition: 'good_as_new',
                      };
                      const isReturnable = it.maxReturnableQuantity > 0;
                      const lineRefund = sel.selected && sel.quantity > 0
                        ? (it.unitPrice * sel.quantity) * (1 + it.taxRate / 100)
                        : 0;

                      return (
                        <tr
                          key={it.saleItem.id}
                          className={`${
                            sel.selected ? 'bg-rose-50/40' : !isReturnable ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50'
                          } transition-colors`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              disabled={!isReturnable}
                              onClick={() => handleToggleItem(it.saleItem.productId, it.maxReturnableQuantity)}
                              className="cursor-pointer disabled:cursor-not-allowed"
                            >
                              {sel.selected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{it.saleItem.productName}</div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                            {it.purchasedQuantity}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-amber-700">
                            {it.alreadyReturnedQuantity > 0 ? it.alreadyReturnedQuantity : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-700">
                            {it.maxReturnableQuantity}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={it.maxReturnableQuantity}
                              step="any"
                              disabled={!isReturnable}
                              value={sel.quantity}
                              onChange={(e) =>
                                handleQuantityChange(
                                  it.saleItem.productId,
                                  Number(e.target.value),
                                  it.maxReturnableQuantity
                                )
                              }
                              className="w-20 text-center py-1 px-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-rose-500 outline-hidden disabled:bg-slate-100"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono">
                            {formatSAR(it.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-700">
                            {formatSAR(lineRefund)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* تحديد أسباب الإرجاع وطريقة الاسترداد */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    سبب الإرجاع:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['عيب', 'مقاس غير مناسب', 'خطأ في الطلب', 'سبب آخر'] as ReturnReason[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                          reason === r
                            ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-rose-400'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      placeholder="تفاصيل إضافية عن السبب (اختياري)..."
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    طريقة استرداد المبلغ:
                  </label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'customer_balance', label: 'قيد على حساب العميل (تخفيض المديونية / رصيد دائن)' },
                      { id: 'cash', label: 'استرداد نقدي من الصندوق (سند صرف)' },
                      { id: 'card', label: 'إعادة إلى البطاقة / شبكة مدى' },
                      { id: 'bank_transfer', label: 'تحويل بنكي' },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          refundMethod === opt.id
                            ? 'bg-rose-50/70 border-rose-400 font-bold text-rose-950'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                        }`}
                      >
                        <input
                          type="radio"
                          name="refundMethod"
                          value={opt.id}
                          checked={refundMethod === opt.id}
                          onChange={() => setRefundMethod(opt.id as any)}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ملخص المبالغ النهائي */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 block">إجمالي المنتجات المرتجعة:</span>
                  <span className="text-base font-bold text-rose-400">
                    {calculatedSummary.count} قطعة
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">المبلغ قبل الضريبة:</span>
                  <span className="text-sm font-mono text-slate-200">
                    {formatSAR(calculatedSummary.subtotal)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">الضريبة المستردة (15%):</span>
                  <span className="text-sm font-mono text-slate-200">
                    {formatSAR(calculatedSummary.taxTotal)}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-xs text-slate-400 block">صافي المبلغ المسترد:</span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {formatSAR(calculatedSummary.grandTotal)}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* أزرار الإجراء في الأسفل */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmitReturn}
            disabled={isSubmitting || !saleData || calculatedSummary.count === 0}
            className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ اعتماد المرتجع وتحديث المخزون...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>اعتماد المرتجع وإصدار إشعار دائن</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
