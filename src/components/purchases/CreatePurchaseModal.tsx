/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Supplier, Product, Warehouse } from '../../types';
import { getSuppliers } from '../../services/suppliers';
import { getCollectionDocs, getWarehouses, sortWarehouses } from '../../services/db';
import { createPurchaseInvoice, CreatePurchaseItemInput } from '../../services/purchases';
import { formatSAR } from '../../utils/formatters';
import {
  Package,
  Plus,
  Trash2,
  Truck,
  Building,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  Search,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseCreated: () => void;
  initialSupplier?: Supplier | null;
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchaseCreated,
  initialSupplier,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  // Form Fields
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('wh_main');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [paymentMethodCode, setPaymentMethodCode] = useState<'CASH' | 'TRANSFER' | 'MADA' | 'CREDIT'>('CREDIT');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Items
  const [items, setItems] = useState<
    Array<CreatePurchaseItemInput & { tempId: string; subtotal: number; lineTotal: number }>
  >([]);

  // Product Selection helper
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(10);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMetadata();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialSupplier) {
      setSelectedSupplierId(initialSupplier.id);
    }
  }, [initialSupplier]);

  const loadMetadata = async () => {
    setIsLoadingMetadata(true);
    try {
      const [supps, whs, prods] = await Promise.all([
        getSuppliers(),
        getWarehouses(),
        getCollectionDocs<Product>('products', 200),
      ]);
      const sortedWhs = sortWarehouses(whs);
      setSuppliers(supps);
      setWarehouses(sortedWhs);
      setProducts(prods);

      if (supps.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(initialSupplier?.id || supps[0].id);
      }
      if (sortedWhs.length > 0) {
        const primary = sortedWhs.find((w) => w.isPrimary) || sortedWhs[0];
        setSelectedWarehouseId(primary.id);
      }
      if (prods.length > 0) {
        setSelectedProductId(prods[0].id);
        setItemUnitPrice(prods[0].costPrice || 0);
      }
    } catch (err) {
      console.error('خطأ في تحميل بيانات المشتريات:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  useEffect(() => {
    const handleWarehousesChanged = (e: any) => {
      const updated = e.detail;
      if (Array.isArray(updated) && updated.length > 0) {
        const sortedWhs = sortWarehouses(updated);
        setWarehouses(sortedWhs);
      } else {
        getWarehouses().then((fresh) => setWarehouses(sortWarehouses(fresh)));
      }
    };
    window.addEventListener('warehouses-changed', handleWarehousesChanged);
    return () => window.removeEventListener('warehouses-changed', handleWarehousesChanged);
  }, []);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setItemUnitPrice(prod.costPrice || 0);
    }
  };

  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (itemQuantity <= 0) {
      setErrorMessage('الكمية يجب أن تكون أكبر من 0.');
      return;
    }
    if (itemUnitPrice < 0) {
      setErrorMessage('سعر التكلفة لا يمكن أن يكون سالباً.');
      return;
    }

    const sub = Math.round(itemQuantity * itemUnitPrice * 100) / 100;
    const tax = Math.round(sub * 0.15 * 100) / 100;
    const lineTotal = sub + tax;

    setItems((prev) => [
      ...prev,
      {
        tempId: `item_${Date.now()}_${Math.random()}`,
        productId: prod.id,
        productName: prod.nameAr,
        sku: prod.sku,
        quantity: itemQuantity,
        unitPrice: itemUnitPrice,
        taxRate: 15,
        subtotal: sub,
        lineTotal,
      },
    ]);

    setErrorMessage(null);
  };

  const handleRemoveItem = (tempId: string) => {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
  const taxTotal = Math.round(subtotal * 0.15 * 100) / 100;
  const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

  const currentSupplier = suppliers.find((s) => s.id === selectedSupplierId);
  const currentWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  const handleSave = async (status: 'received' | 'draft') => {
    setErrorMessage(null);

    if (!selectedSupplierId) {
      setErrorMessage('يرجى اختيار المورد.');
      return;
    }
    if (!selectedWarehouseId) {
      setErrorMessage('يرجى اختيار المستودع المستلم.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('يرجى إضافة صنف واحد على الأقل لفاتورة الشراء.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createPurchaseInvoice({
        supplierId: selectedSupplierId,
        supplierName: currentSupplier?.companyName || 'مورد غير محدد',
        warehouseId: selectedWarehouseId,
        warehouseName: currentWarehouse?.nameAr || 'المستودع الرئيسي',
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: 15,
        })),
        status, // 'received' will directly update inventory & warehouse balances!
        paymentMethodCode,
        paidAmount: paymentMethodCode === 'CREDIT' ? 0 : paidAmount,
        notes: notes.trim() || undefined,
        actorName: 'مدير المشتريات',
      });

      onPurchaseCreated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ فاتورة الشراء.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold">إنشاء فاتورة شراء / أمر توريد جديد</h3>
              <p className="text-[11px] text-slate-400">شراء مواد وبضائع من الموردين وتحديث المخزون والذمم الدائنة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-xs">
          
          {/* Section 1: Supplier & Warehouse Selection */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* المورد */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                المورد / المصنع <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-semibold"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName} (رصيد مستحق: {formatSAR(s.balance || 0)})
                  </option>
                ))}
              </select>
              {currentSupplier && (
                <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                  <span>المسؤول: {currentSupplier.contactPerson}</span>
                  <span className="font-mono text-rose-600 font-bold">
                    المستحق له: {formatSAR(currentSupplier.balance || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* المستودع المستلم */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                المستودع المستلم <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-semibold"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nameAr} ({w.code}) {w.isPrimary ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* رقم فاتورة المورد الخارجية */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                رقم فاتورة المورد الخارجية (اختياري)
              </label>
              <input
                type="text"
                dir="ltr"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="INV-SUPP-9821"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-mono font-bold text-right"
              />
            </div>
          </div>

          {/* Section 2: Product Addition Row */}
          <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-200 space-y-2">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-600" />
              <span>إضافة أصناف ومواد بناء إلى فاتورة الشراء</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              {/* اختيار الصنف */}
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الصنف</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-semibold"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr} [{p.sku}] - (سعر التكلفة: {p.costPrice} ر.س)
                    </option>
                  ))}
                </select>
              </div>

              {/* الكمية */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الكمية</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-mono font-bold"
                />
              </div>

              {/* سعر الشراء / التكلفة للوحدة */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر الشراء (ر.س)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-mono font-bold"
                />
              </div>

              {/* زر الإضافة */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة للصنف</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Items Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">اسم الصنف</th>
                  <th className="p-3">رمز SKU</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">سعر الشراء</th>
                  <th className="p-3">الإجمالي قبل الضريبة</th>
                  <th className="p-3">ضريبة 15%</th>
                  <th className="p-3">الإجمالي الشامل</th>
                  <th className="p-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400">
                      لم يتم إضافة أي أصناف بعد. اختر الصنف والكمية واضغط "إضافة للصنف".
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={it.tempId} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{it.productName}</td>
                      <td className="p-3 font-mono text-slate-600">{it.sku}</td>
                      <td className="p-3 font-mono font-bold text-blue-600">{it.quantity}</td>
                      <td className="p-3 font-mono">{formatSAR(it.unitPrice)}</td>
                      <td className="p-3 font-mono">{formatSAR(it.subtotal)}</td>
                      <td className="p-3 font-mono">{formatSAR(it.subtotal * 0.15)}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{formatSAR(it.lineTotal)}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.tempId)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Section 4: Payment Terms & Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            {/* طريقة الدفع والمسدد */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">طريقة السداد للمورد</label>
                <select
                  value={paymentMethodCode}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setPaymentMethodCode(val);
                    if (val === 'CREDIT') {
                      setPaidAmount(0);
                    } else if (paidAmount === 0) {
                      setPaidAmount(grandTotal);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="CREDIT">آجل على حساب المورد (ذمم دائنة)</option>
                  <option value="CASH">نقداً من الخزينة (سداد فوري)</option>
                  <option value="TRANSFER">تحويل بنكي</option>
                  <option value="MADA">شبكة مدى</option>
                </select>
              </div>

              {paymentMethodCode !== 'CREDIT' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ المسدد للمورد حالياً (ر.س)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      step="any"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setPaidAmount(grandTotal)}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold whitespace-nowrap cursor-pointer"
                    >
                      كامل الفاتورة
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات الفاتورة</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات التسليم، الشحن، الفحص الفني..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* الحسابات والملخص المالي */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
              <div className="space-y-1.5 text-xs text-slate-600 font-semibold">
                <div className="flex justify-between">
                  <span>المبلغ الخاضع للضريبة:</span>
                  <span className="font-mono font-bold text-slate-900">{formatSAR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ضريبة القيمة المضافة (15%):</span>
                  <span className="font-mono font-bold text-slate-900">{formatSAR(taxTotal)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-black text-slate-900">
                  <span>الإجمالي النهائي الشامل:</span>
                  <span className="font-mono text-amber-600">{formatSAR(grandTotal)}</span>
                </div>
                {paymentMethodCode !== 'CREDIT' && (
                  <div className="flex justify-between text-xs text-rose-600 font-bold">
                    <span>المتبقي في ذمة المنشأة (آجل):</span>
                    <span className="font-mono">{formatSAR(Math.max(0, grandTotal - paidAmount))}</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>عند اختيار "اعتماد وتحديث المخزون"، يتم تحديث كميات الأصناف ومتوسط التكلفة فورياً.</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2">
            {/* حفظ كأمر شراء / مسودة */}
            <button
              type="button"
              disabled={isSubmitting || items.length === 0}
              onClick={() => handleSave('draft')}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Clock className="w-4 h-4" />
              <span>حفظ كمسودة / أمر توريد</span>
            </button>

            {/* اعتماد وتحديث المخزون فوراً */}
            <button
              type="button"
              disabled={isSubmitting || items.length === 0}
              onClick={() => handleSave('received')}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الاعتماد وتحديث المخزون...' : 'اعتماد واستلام وتحديث المخزون'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
