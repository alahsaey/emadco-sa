/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Quotation, Product, Warehouse, PaymentMethod, Inventory } from '../../types';
import { executePosSaleTransaction, CompletedSaleResult, PosCartItem } from '../../services/pos';
import { updateQuotationStatus } from '../../services/quotations';
import { formatSAR } from '../../utils/formatters';
import { getWarehouses, getProducts, quickReplenishProductStock, getProductInventory } from '../../services/db';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  FileCheck,
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  Package,
  Calendar,
  User,
  Building,
  Loader2,
  CreditCard,
  Plus,
  Trash2,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { SaudiRiyalSymbol } from '../common/SaudiRiyalSymbol';

interface ConvertToSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  onConversionSuccess: (saleResult: CompletedSaleResult, quotation: Quotation) => void;
}

export const ConvertToSaleModal: React.FC<ConvertToSaleModalProps> = ({
  isOpen,
  onClose,
  quotation,
  onConversionSuccess,
}) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('wh_main');
  const [paymentMethodCode, setPaymentMethodCode] = useState<string>('CASH');

  // خريطة المخزون المتوفر في المستودع المختار لكل صنف
  const [warehouseStockMap, setWarehouseStockMap] = useState<Record<string, number>>({});
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(true);
  const [replenishingProductId, setReplenishingProductId] = useState<string | null>(null);

  // بنود قابلة للتعديل قبل إصدار الفاتورة (مع المحافظة على بيانات عرض السعر كقيمة أولية)
  const [editableItems, setEditableItems] = useState<PosCartItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // جلب المخزون الفعلي في المستودع المحدد
  const refreshWarehouseStock = useCallback(async (warehouseId: string) => {
    try {
      const q = query(collection(db, 'inventory'), where('warehouseId', '==', warehouseId));
      const snap = await getDocs(q);
      const stockMap: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const inv = d.data() as Inventory;
        if (inv.productId) {
          stockMap[inv.productId] = inv.availableQuantity !== undefined ? inv.availableQuantity : (inv.quantityOnHand || 0);
        }
      });
      setWarehouseStockMap(stockMap);
    } catch (err) {
      console.warn('تعذر جلب تفاصيل المخزون للمستودع:', err);
    }
  }, []);

  // تهيئة البيانات عند فتح النافذة
  useEffect(() => {
    if (!isOpen || !quotation) return;

    async function loadResources() {
      setIsLoadingWarehouses(true);
      try {
        const [whList, pList] = await Promise.all([getWarehouses(), getProducts()]);
        setWarehouses(whList);
        setProducts(pList);
        const activeWhId = whList.length > 0 ? whList[0].id : 'wh_main';
        setSelectedWarehouseId(activeWhId);
        await refreshWarehouseStock(activeWhId);

        // تحويل بنود عرض السعر إلى بنود سلة بيع PosCartItem مع المحافظة على الأسعار والكميات والخصومات
        const cartItems: PosCartItem[] = (quotation.items || []).map((qi) => {
          const originalProd = pList.find((p) => p.id === qi.productId);
          return {
            productId: qi.productId,
            productName: qi.productName,
            sku: qi.sku || originalProd?.sku || qi.productId,
            barcode: originalProd?.barcode || '',
            quantity: qi.quantity,
            unitPrice: qi.unitPrice, // السعر المتفق عليه بالعرض
            retailPrice: originalProd?.retailPrice || qi.unitPrice,
            wholesalePrice: originalProd?.wholesalePrice || qi.unitPrice,
            contractorPrice: originalProd?.contractorPrice || qi.unitPrice,
            taxRate: qi.taxRate || 15,
            discount: qi.discount || 0, // الخصم المحفوظ بالعرض
            unitSymbol: qi.unitSymbol || originalProd?.baseUnitId || 'حبة',
            availableStock: 999,
          };
        });

        setEditableItems(cartItems);
        setOverallDiscount(quotation.discountTotal || 0);
        setNotes(`تحويل آلي من عرض السعر رقم ${quotation.quotationNumber}${quotation.projectName ? ` - مشروع: ${quotation.projectName}` : ''}`);

        // إذا كان العميل لديه حساب مسجل، نتيح خيار الآجل كخيار متاح
        if (quotation.customerId) {
          setPaymentMethodCode('CREDIT');
        } else {
          setPaymentMethodCode('CASH');
        }
      } catch (err) {
        console.error('خطأ في تحميل الموارد للتحويل:', err);
      } finally {
        setIsLoadingWarehouses(false);
      }
    }

    loadResources();
  }, [isOpen, quotation, refreshWarehouseStock]);

  // تحديث المخزون عند تغيير المستودع المختار
  useEffect(() => {
    if (selectedWarehouseId) {
      refreshWarehouseStock(selectedWarehouseId);
    }
  }, [selectedWarehouseId, refreshWarehouseStock]);

  if (!isOpen || !quotation) return null;

  // توريد سريع لرصيد صنف ناقص
  const handleQuickReplenish = async (productId: string, productName: string, neededQty: number) => {
    try {
      setReplenishingProductId(productId);
      const qtyToAdd = Math.max(10, neededQty);
      await quickReplenishProductStock(productId, productName, selectedWarehouseId, qtyToAdd);
      await refreshWarehouseStock(selectedWarehouseId);
      setSubmitError(null);
    } catch (e: any) {
      alert(`فشل التوريد السريع: ${e.message}`);
    } finally {
      setReplenishingProductId(null);
    }
  };

  // تعديل كمية بند
  const handleQuantityChange = (idx: number, qty: number) => {
    const updated = [...editableItems];
    updated[idx].quantity = Math.max(1, qty);
    setEditableItems(updated);
  };

  // تعديل سعر بند
  const handlePriceChange = (idx: number, price: number) => {
    const updated = [...editableItems];
    updated[idx].unitPrice = Math.max(0, price);
    setEditableItems(updated);
  };

  // تعديل خصم بند
  const handleDiscountChange = (idx: number, disc: number) => {
    const updated = [...editableItems];
    updated[idx].discount = Math.max(0, disc);
    setEditableItems(updated);
  };

  // حذف بند
  const handleRemoveItem = (idx: number) => {
    setEditableItems(editableItems.filter((_, i) => i !== idx));
  };

  // إضافة صنف إضافي
  const handleAddExtraProduct = (productId: string) => {
    if (!productId) return;
    const p = products.find((prod) => prod.id === productId);
    if (!p) return;

    const newItem: PosCartItem = {
      productId: p.id,
      productName: p.nameAr,
      sku: p.sku,
      barcode: p.barcode,
      quantity: 1,
      unitPrice: p.retailPrice || 0,
      retailPrice: p.retailPrice || 0,
      wholesalePrice: p.wholesalePrice || 0,
      contractorPrice: p.contractorPrice || 0,
      taxRate: 15,
      discount: 0,
      unitSymbol: p.baseUnitId || 'حبة',
      availableStock: 999,
    };
    setEditableItems([...editableItems, newItem]);
  };

  // احتساب الإجماليات
  const financialTotals = (() => {
    let subtotal = 0;
    let itemDiscountsTotal = 0;

    editableItems.forEach((it) => {
      const raw = it.unitPrice * it.quantity;
      const d = it.discount || 0;
      subtotal += Math.max(0, raw - d);
      itemDiscountsTotal += d;
    });

    const extraDisc = Math.max(0, overallDiscount);
    const taxableBase = Math.max(0, subtotal - extraDisc);
    const taxTotal = Math.round(taxableBase * 0.15 * 100) / 100;
    const grandTotal = Math.round((taxableBase + taxTotal) * 100) / 100;

    return {
      subtotal,
      itemDiscountsTotal,
      extraDiscount: extraDisc,
      taxableBase,
      taxTotal,
      grandTotal,
    };
  })();

  // التحقق مما إذا كانت هناك أصناف فيها نقص بالمخزون
  const outOfStockItems = editableItems.filter((it) => {
    const currentStock = warehouseStockMap[it.productId] ?? 0;
    return currentStock < it.quantity;
  });

  // تنفيذ عملية التحويل إلى فاتورة بيع معتمدة
  const handleExecuteConversion = async (forceAllowNegative = false) => {
    if (editableItems.length === 0) {
      setSubmitError('يجب أن تحتوي الفاتورة على صنف واحد على الأقل.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const paymentMethodNames: Record<string, string> = {
        CASH: 'نقدي (كاش)',
        MADA: 'بطاقة مدى / شبكة',
        TRANSFER: 'تحويل بنكي',
        CREDIT: 'آجل على الحساب (ائتماني)',
      };

      // تنفيذ المعاملة الذرية
      const saleResult = await executePosSaleTransaction({
        items: editableItems,
        customerId: quotation.customerId || null,
        customerName: quotation.customerName,
        customerTaxNumber: quotation.customerTaxNumber,
        customerPhone: quotation.customerPhone,
        branchId: 'branch_main',
        warehouseId: selectedWarehouseId,
        cashierId: 'usr_active',
        cashierName: 'موظف المبيعات',
        paymentMethodCode,
        paymentMethodName: paymentMethodNames[paymentMethodCode] || paymentMethodCode,
        paidAmount: financialTotals.grandTotal,
        overallDiscount: financialTotals.extraDiscount,
        notes,
        allowNegativeStock: forceAllowNegative || allowNegativeStock,
        bypassStockCheck: forceAllowNegative || allowNegativeStock,
      });

      // تحديث حالة عرض السعر إلى "Converted" مع حفظ رقم الفاتورة والبيع
      await updateQuotationStatus(quotation.id, 'Converted', 'مسؤول المبيعات', {
        saleId: saleResult.sale.id,
        invoiceNumber: saleResult.invoice.invoiceNumber,
      });

      onConversionSuccess(saleResult, quotation);
    } catch (err: any) {
      console.error('فشل تحويل عرض السعر إلى فاتورة بيع:', err);
      setSubmitError(err.message || 'حدث خطأ أثناء اعتماد الفاتورة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* رأس النافذة */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">تحويل عرض السعر إلى فاتورة بيع معتمدة</h3>
              <p className="text-[11px] text-emerald-100 font-mono">
                عرض السعر: {quotation.quotationNumber} • للعميل: {quotation.customerName}
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
        <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-xs">
          
          {/* شريط الإشعار والتأكيد */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                تم استيراد كافة المنتجات والكميات والأسعار المتفق عليها والخصومات من عرض السعر تلقائياً.
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                يمكنك مراجعة البنود والتحقق من رصيد المستودع وتوريد أي كميات ناقصة أو اعتماد الصرف المباشر بضغطة زر.
              </p>
            </div>
          </div>

          {/* تنبيه حالة المخزون إن وُجد نقص */}
          {outOfStockItems.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>تنبيه المخزون: بعض أصناف عرض السعر رصيدها الحالي غير كافٍ في المستودع المحدد</span>
              </div>
              <p className="text-[11px] text-amber-700">
                الأصناف التالية رصيدها أقل من الكمية المطلوبة:{' '}
                <span className="font-bold">
                  {outOfStockItems.map((it) => `${it.productName} (المتوفر: ${warehouseStockMap[it.productId] ?? 0}، المطلوب: ${it.quantity})`).join(' ، ')}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-300 font-bold text-slate-800 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={allowNegativeStock}
                    onChange={(e) => setAllowNegativeStock(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span>السماح بإصدار الفاتورة وتحديث المخزون (صرف مباشر / بيع بالسالب)</span>
                </label>
              </div>
            </div>
          )}

          {/* خيارات المستودع وطريقة الدفع */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">المستودع المصروف منه المواد:</label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nameAr} - {w.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">طريقة السداد / الدفع:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { code: 'CASH', label: 'نقدي (كاش)', icon: SaudiRiyalSymbol },
                  { code: 'MADA', label: 'شبكة مدى / بطاقة', icon: CreditCard },
                  { code: 'CREDIT', label: 'آجل على الحساب', icon: User },
                  { code: 'TRANSFER', label: 'تحويل بنكي', icon: Building },
                ].map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.code}
                      type="button"
                      onClick={() => setPaymentMethodCode(pm.code)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethodCode === pm.code
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* جدول البنود للمراجعة والتعديل قبل الاعتماد */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-700" />
                <span>بنود الفاتورة وحالة توفر المخزون:</span>
              </h4>

              {/* إضافة صنف إضافي إن رغب العميل */}
              <div className="flex gap-2 w-full sm:w-72">
                <select
                  onChange={(e) => {
                    handleAddExtraProduct(e.target.value);
                    e.target.value = '';
                  }}
                  className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">+ إضافة صنف إضافي للفاتورة...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr} ({formatSAR(p.retailPrice || 0)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">المنتج وحالة المخزون</th>
                    <th className="py-2.5 px-2 text-center w-24">الكمية</th>
                    <th className="py-2.5 px-2 text-center w-28">السعر المتفق عليه</th>
                    <th className="py-2.5 px-2 text-center w-24">خصم البند</th>
                    <th className="py-2.5 px-3 text-left">الضريبة (15%)</th>
                    <th className="py-2.5 px-3 text-left">الإجمالي النهائي</th>
                    <th className="py-2.5 px-2 text-center w-10">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editableItems.map((it, idx) => {
                    const lineBase = Math.max(0, it.unitPrice * it.quantity - (it.discount || 0));
                    const lineTax = Math.round(lineBase * 0.15 * 100) / 100;
                    const lineTotal = lineBase + lineTax;
                    const currentStock = warehouseStockMap[it.productId] ?? 0;
                    const isDeficit = currentStock < it.quantity;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{it.productName}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {it.sku && <span className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</span>}
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${
                                isDeficit
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              المتوفر: {currentStock} {it.unitSymbol || 'حبة'}
                            </span>
                            {isDeficit && (
                              <button
                                type="button"
                                disabled={replenishingProductId === it.productId}
                                onClick={() => handleQuickReplenish(it.productId, it.productName, it.quantity - currentStock)}
                                className="text-[10px] px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-bold cursor-pointer transition-colors"
                              >
                                {replenishingProductId === it.productId ? 'جارٍ التوريد...' : `+ توريد ${Math.max(10, it.quantity - currentStock)} فوري`}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={it.quantity}
                            onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                            className="w-18 text-center p-1 border border-slate-300 rounded-md font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={it.unitPrice}
                            onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                            className="w-22 text-center p-1 border border-slate-300 rounded-md font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={it.discount}
                            onChange={(e) => handleDiscountChange(idx, Number(e.target.value))}
                            className="w-18 text-center p-1 border border-slate-300 rounded-md font-mono text-amber-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-slate-500">
                          {formatSAR(lineTax)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                          {formatSAR(lineTotal)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-sm cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ملخص المبالغ والضريبة */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-400 block">إجمالي الأصناف:</span>
              <span className="text-base font-bold text-emerald-400">
                {editableItems.reduce((acc, it) => acc + it.quantity, 0)} قطعة
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">المجموع الخاضع للضريبة:</span>
              <span className="text-sm font-mono text-slate-200">
                {formatSAR(financialTotals.taxableBase)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">ضريبة القيمة المضافة (15%):</span>
              <span className="text-sm font-mono text-slate-200">
                {formatSAR(financialTotals.taxTotal)}
              </span>
            </div>
            <div className="text-left">
              <span className="text-xs text-slate-400 block">المبلغ الإجمالي للفاتورة:</span>
              <span className="text-xl font-black font-mono text-emerald-400">
                {formatSAR(financialTotals.grandTotal)}
              </span>
            </div>
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2 font-medium">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{submitError}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleExecuteConversion(true)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>اعتماد الفاتورة وتجاوز فحص المخزون فوراً (صرف مباشر)</span>
                </button>
              </div>
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
            onClick={() => handleExecuteConversion(false)}
            disabled={isSubmitting || editableItems.length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ خصم المخزون وإصدار الفاتورة المعتمدة...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>اعتماد البيع وإصدار الفاتورة</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

