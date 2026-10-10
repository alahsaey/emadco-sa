/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Purchase, PurchaseItem } from '../../types';
import { getPurchaseWithItems, approveAndReceivePurchase } from '../../services/purchases';
import { formatSAR } from '../../utils/formatters';
import {
  Package,
  X,
  Printer,
  Calendar,
  Truck,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface PurchaseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseId: string | null;
  onPurchaseUpdated: () => void;
}

export const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({
  isOpen,
  onClose,
  purchaseId,
  onPurchaseUpdated,
}) => {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && purchaseId) {
      loadData(purchaseId);
    }
  }, [isOpen, purchaseId]);

  const loadData = async (id: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getPurchaseWithItems(id);
      setPurchase(data.purchase);
      setItems(data.items);
    } catch (err) {
      console.error('خطأ في تحميل تفاصيل فاتورة الشراء:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!purchase) return;
    if (!window.confirm(`هل أنت متأكد من اعتماد واستلام البضاعة لفاتورة الشراء "${purchase.orderNumber}"؟ سيتم إضافة الكميات فورياً إلى المخزون.`)) {
      return;
    }

    try {
      setIsApproving(true);
      await approveAndReceivePurchase(purchase.id, 'مدير المشتريات والمستودعات');
      await loadData(purchase.id);
      onPurchaseUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء اعتماد واستلام الفاتورة.');
    } finally {
      setIsApproving(false);
    }
  };

  if (!isOpen || !purchaseId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>تفاصيل فاتورة الشراء والتوريد</span>
                {purchase && (
                  <span className="text-xs font-mono font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded-md">
                    {purchase.orderNumber}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">بيانات التوريد، بنود المواد، وحالة تحديث المخزون</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>جاري تحميل بيانات الفاتورة...</span>
            </div>
          ) : purchase ? (
            <>
              {/* Purchase Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">المورد</span>
                  <span className="font-bold text-slate-900 text-sm">{purchase.supplierName || purchase.supplierId}</span>
                  {purchase.supplierInvoiceNumber && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      فاتورة المورد: {purchase.supplierInvoiceNumber}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">المستودع المستلم</span>
                  <span className="font-bold text-slate-800">{purchase.warehouseName || purchase.warehouseId}</span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    بواسطة: {purchase.createdBy}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">حالة التوريد والمخزون</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      purchase.status === 'received'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {purchase.status === 'received' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        معتمدة ومستلمة بالمخزن
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        مسودة قيد المراجعة
                      </>
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">حالة السداد للمورد</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      purchase.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : purchase.paymentStatus === 'partially_paid'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {purchase.paymentStatus === 'paid'
                      ? 'مسددة بالكامل'
                      : purchase.paymentStatus === 'partially_paid'
                      ? 'مسددة جزئياً'
                      : 'آجل على الحساب'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">اسم الصنف</th>
                      <th className="p-3">رمز SKU</th>
                      <th className="p-3">الكمية المستلمة</th>
                      <th className="p-3">سعر الشراء (التكلفة)</th>
                      <th className="p-3">ضريبة 15%</th>
                      <th className="p-3">الإجمالي الشامل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {items.map((it, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{it.productName || it.productId}</td>
                        <td className="p-3 font-mono text-slate-600">{it.sku || '-'}</td>
                        <td className="p-3 font-mono font-bold text-blue-600">{it.quantity}</td>
                        <td className="p-3 font-mono">{formatSAR(it.unitPrice)}</td>
                        <td className="p-3 font-mono">{formatSAR(it.taxAmount)}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">{formatSAR(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-xs text-slate-500">
                  {purchase.notes && (
                    <div><span className="font-bold text-slate-700">ملاحظات:</span> {purchase.notes}</div>
                  )}
                  <div className="mt-1 font-mono text-[11px]">
                    تاريخ الطلب: {new Date(purchase.orderDate).toLocaleString('ar-SA')}
                  </div>
                </div>

                <div className="w-full sm:w-64 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>المجموع قبل الضريبة:</span>
                    <span className="font-mono font-bold">{formatSAR(purchase.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span className="font-mono font-bold">{formatSAR(purchase.taxTotal)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-300 flex justify-between text-sm font-black text-slate-900">
                    <span>الإجمالي الشامل:</span>
                    <span className="font-mono text-amber-600">{formatSAR(purchase.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>المبلغ المسدد:</span>
                    <span className="font-mono">{formatSAR(purchase.paidAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Draft Alert & Approval Action */}
              {purchase.status !== 'received' && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>هذه الفاتورة محفوظة كـ "مسودة" ولم تُضف أصنافها إلى رصيد المخزون الفعلي بعد.</span>
                  </div>
                  <button
                    type="button"
                    disabled={isApproving}
                    onClick={handleApprove}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isApproving ? 'جاري الاعتماد وتحديث الأرصدة...' : 'اعتماد واستلام وتحديث المخزون الآن'}</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              لم يتم العثور على الفاتورة المطلوبة.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
