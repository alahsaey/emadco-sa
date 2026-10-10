/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Customer, Product, Quotation, QuotationStatus } from '../../types';
import { getCustomers } from '../../services/customers';
import { getProducts } from '../../services/db';
import { createQuotation, QuotationItemInput } from '../../services/quotations';
import { formatSAR } from '../../utils/formatters';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
  Search,
  Calendar,
  User,
  Building,
  Percent,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface NewQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdQuotation: Quotation) => void;
  initialCustomerId?: string;
}

export const NewQuotationModal: React.FC<NewQuotationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCustomerId,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);

  // بيانات العميل
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerTaxNumber, setCustomerTaxNumber] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');

  // تواريخ الصلاحية
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultValidDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [issueDate, setIssueDate] = useState<string>(todayStr);
  const [validUntil, setValidUntil] = useState<string>(defaultValidDate);

  // بنود عرض السعر
  const [items, setItems] = useState<QuotationItemInput[]>([]);

  // بحث واختيار المنتجات لإضافتها
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // الخصم والشروط
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountPercentVal, setDiscountPercentVal] = useState<number>(0);
  const [status, setStatus] = useState<QuotationStatus>('Draft');
  const [notes, setNotes] = useState<string>('عرض السعر صالح للمدة المحددة. التوريد حسب توفر الكميات في المستودع.');
  const [terms, setTerms] = useState<string>('الدفع نقدياً أو دفعة مقدمة 50% والباقي عند التسليم. الأسعار تشمل ضريبة القيمة المضافة 15%.');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // تحميل قائمة العملاء والمنتجات
  useEffect(() => {
    if (!isOpen) return;
    async function loadData() {
      setIsLoadingInitial(true);
      try {
        const [cList, pList] = await Promise.all([getCustomers(), getProducts()]);
        setCustomers(cList);
        setProducts(pList);

        if (initialCustomerId) {
          const found = cList.find((c) => c.id === initialCustomerId);
          if (found) {
            setSelectedCustomerId(found.id);
            setCustomerName(found.name);
            setCustomerPhone(found.phone || '');
            setCustomerEmail(found.email || '');
            setCustomerTaxNumber(found.taxNumber || '');
            setCustomerAddress(found.address || '');
          }
        }
      } catch (err) {
        console.error('خطأ في تحميل بيانات العرض:', err);
      } finally {
        setIsLoadingInitial(false);
      }
    }
    loadData();
  }, [isOpen, initialCustomerId]);

  // عند اختيار عميل من القائمة
  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    if (!custId) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerTaxNumber('');
      setCustomerAddress('');
      return;
    }
    const c = customers.find((cust) => cust.id === custId);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || '');
      setCustomerEmail(c.email || '');
      setCustomerTaxNumber(c.taxNumber || '');
      setCustomerAddress(c.address || '');
    }
  };

  // إضافة منتج إلى قائمة البنود
  const handleAddProduct = (productId: string) => {
    if (!productId) return;
    const p = products.find((prod) => prod.id === productId);
    if (!p) return;

    // فحص ما إذا كان مضافاً مسبقاً
    const existingIndex = items.findIndex((it) => it.productId === productId);
    if (existingIndex >= 0) {
      // زيادة الكمية
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      const newItem: QuotationItemInput = {
        productId: p.id,
        productName: p.nameAr,
        sku: p.sku,
        unitSymbol: p.unitId || 'حبة',
        quantity: 1,
        unitPrice: p.retailPrice || 0,
        originalRetailPrice: p.retailPrice || 0,
        discount: 0,
        taxRate: 15,
      };
      setItems([...items, newItem]);
    }
    setSelectedProductId('');
    setProductSearchQuery('');
  };

  // تعديل كمية بند
  const handleItemQuantityChange = (idx: number, qty: number) => {
    const updated = [...items];
    updated[idx].quantity = Math.max(1, qty);
    setItems(updated);
  };

  // تعديل سعر بند (حرية كاملة لتسعير العرض)
  const handleItemPriceChange = (idx: number, price: number) => {
    const updated = [...items];
    updated[idx].unitPrice = Math.max(0, price);
    setItems(updated);
  };

  // تعديل خصم بند
  const handleItemDiscountChange = (idx: number, disc: number) => {
    const updated = [...items];
    updated[idx].discount = Math.max(0, disc);
    setItems(updated);
  };

  // حذف بند
  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // أزرار سريعة لصلاحية العرض
  const handleSetValidityDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setValidUntil(date.toISOString().split('T')[0]);
  };

  // الحسابات المالية للعرض
  const financialTotals = (() => {
    let subtotalRaw = 0;
    let itemsDiscountTotal = 0;

    items.forEach((it) => {
      const lineRaw = it.unitPrice * it.quantity;
      const lineDisc = it.discount || 0;
      subtotalRaw += Math.max(0, lineRaw - lineDisc);
      itemsDiscountTotal += lineDisc;
    });

    let extraDiscount = 0;
    if (discountType === 'percent') {
      extraDiscount = Math.round(subtotalRaw * (discountPercentVal / 100) * 100) / 100;
    } else {
      extraDiscount = Math.max(0, discountTotal);
    }

    const taxableBase = Math.max(0, subtotalRaw - extraDiscount);
    const taxTotal = Math.round(taxableBase * 0.15 * 100) / 100;
    const grandTotal = Math.round((taxableBase + taxTotal) * 100) / 100;

    return {
      subtotalRaw,
      itemsDiscountTotal,
      extraDiscount,
      totalDiscounts: itemsDiscountTotal + extraDiscount,
      taxableBase,
      taxTotal,
      grandTotal,
    };
  })();

  // حفظ وإنشاء عرض السعر
  const handleSubmit = async () => {
    if (!customerName.trim()) {
      setFormError('يرجى تحديد أو إدخال اسم العميل.');
      return;
    }
    if (items.length === 0) {
      setFormError('يرجى إضافة صنف واحد على الأقل في عرض السعر.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await createQuotation({
        customerId: selectedCustomerId || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        customerTaxNumber: customerTaxNumber.trim(),
        customerAddress: customerAddress.trim(),
        projectName: projectName.trim(),
        issueDate,
        validUntil,
        discountTotal: financialTotals.extraDiscount,
        discountType,
        discountPercentValue: discountPercentVal,
        notes,
        terms,
        status,
        createdBy: 'مسؤول المبيعات',
        items,
      });

      onSuccess(created);
    } catch (err: any) {
      console.error('فشل إنشاء عرض السعر:', err);
      setFormError(err.message || 'حدث خطأ أثناء حفظ عرض السعر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* رأس النافذة */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">إنشاء عرض سعر جديد (Quotation)</h3>
              <p className="text-[11px] text-emerald-100">
                إضافة بنود مواد البناء، تسعير خاص، تحديد الصلاحية والشروط، وتحويله لاحقاً لفاتورة بيع
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

        {/* جسم النافذة الممتد */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-xs">
          
          {/* قسم بيانات العميل والمشروع */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-xs text-slate-900 mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-700" />
              <span>بيانات العميل والمشروع</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* اختيار عميل موجود أو جديد */}
              <div>
                <label className="block text-slate-600 mb-1 font-medium">اختر عميل مسجل:</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  <option value="">-- عميل جديد / غير مسجل --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'بدون جوال'})
                    </option>
                  ))}
                </select>
              </div>

              {/* اسم العميل */}
              <div>
                <label className="block text-slate-600 mb-1 font-medium">اسم العميل / المنشأة *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: صالح الياسين"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                />
              </div>

              {/* رقم الجوال */}
              <div>
                <label className="block text-slate-600 mb-1 font-medium">رقم الجوال</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0500680180"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
                />
              </div>

              {/* الرقم الضريبي */}
              <div>
                <label className="block text-slate-600 mb-1 font-medium">الرقم الضريبي (إن وجد)</label>
                <input
                  type="text"
                  value={customerTaxNumber}
                  onChange={(e) => setCustomerTaxNumber(e.target.value)}
                  placeholder="300000000000003"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
                />
              </div>

              {/* اسم المشروع / الموقع */}
              <div>
                <label className="block text-slate-600 mb-1 font-medium">اسم المشروع / الموقع (اختياري)</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="مثال: عمارة النرجس - مرحلة العظم"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              {/* عنوان العميل */}
              <div>
                <label className="block text-slate-600 mb-1 font-medium">العنوان / المدينة</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="الرياض - حي الملز"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* قسم التواريخ والصلاحية والحالة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-600 mb-1 font-medium">تاريخ إصدار العرض:</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 font-medium">صلاحية العرض حتى:</label>
                <div className="flex gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSetValidityDays(7)}
                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 rounded-sm cursor-pointer"
                  >
                    +7 أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetValidityDays(15)}
                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 rounded-sm cursor-pointer"
                  >
                    +15 يوم
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetValidityDays(30)}
                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 rounded-sm cursor-pointer"
                  >
                    +شهر
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-medium">حالة العرض المبدئية:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuotationStatus)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold"
              >
                <option value="Draft">مسودة (Draft)</option>
                <option value="Sent">تم الإرسال للعميل (Sent)</option>
                <option value="Accepted">مقبول من العميل (Accepted)</option>
              </select>
            </div>
          </div>

          {/* إضافة المنتجات إلى جدول العرض */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>منتجات ومواد العرض (الأسعار والكميات قابلة للتعديل):</span>
              </h4>

              {/* اختيار منتج للإضافة */}
              <div className="flex gap-2 w-full sm:w-80">
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    handleAddProduct(e.target.value);
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  <option value="">-- اختر صنفاً لإضافته للعرض --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr} - {formatSAR(p.retailPrice || 0)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* جدول البنود */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">المنتج / المادة</th>
                    <th className="py-2.5 px-2 text-center w-24">الكمية</th>
                    <th className="py-2.5 px-2 text-center w-28">سعر الوحدة (ر.س)</th>
                    <th className="py-2.5 px-2 text-center w-24">خصم (ر.س)</th>
                    <th className="py-2.5 px-3 text-left">الضريبة (15%)</th>
                    <th className="py-2.5 px-3 text-left">الإجمالي</th>
                    <th className="py-2.5 px-2 text-center w-10">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        لم تتم إضافة أي أصناف حتى الآن. اختر صنفاً من القائمة أعلاه لإضافته للعرض.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const lineBase = Math.max(0, it.unitPrice * it.quantity - (it.discount || 0));
                      const lineTax = Math.round(lineBase * 0.15 * 100) / 100;
                      const lineTotal = lineBase + lineTax;

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{it.productName}</div>
                            {it.sku && <span className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</span>}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={it.quantity}
                              onChange={(e) => handleItemQuantityChange(idx, Number(e.target.value))}
                              className="w-18 text-center p-1 border border-slate-300 rounded-md font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.unitPrice}
                              onChange={(e) => handleItemPriceChange(idx, Number(e.target.value))}
                              className="w-22 text-center p-1 border border-slate-300 rounded-md font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.discount}
                              onChange={(e) => handleItemDiscountChange(idx, Number(e.target.value))}
                              className="w-18 text-center p-1 border border-slate-300 rounded-md font-mono text-amber-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-slate-500">
                            {formatSAR(lineTax)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                            {formatSAR(lineTotal)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* الخصم الإضافي والملاحظات والشروط */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">ملاحظات العرض:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  placeholder="أي ملاحظات خاصة للعميل..."
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">شروط الدفع والتسليم:</label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  placeholder="شروط التوريد والدفع..."
                />
              </div>
            </div>

            {/* الحسابات الإجمالية */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>المجموع الأساسي للبنود:</span>
                <span className="font-mono font-bold">{formatSAR(financialTotals.subtotalRaw)}</span>
              </div>

              {/* خصم إضافي على مستوى العرض */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                <span className="text-slate-600">خصم إضافي على العرض:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountType === 'percent' ? discountPercentVal : discountTotal}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (discountType === 'percent') setDiscountPercentVal(val);
                      else setDiscountTotal(val);
                    }}
                    className="w-20 p-1 border border-slate-300 rounded-md font-mono text-center"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="p-1 border border-slate-300 rounded-md bg-white text-[11px]"
                  >
                    <option value="amount">ر.س</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>ضريبة القيمة المضافة (15%):</span>
                <span className="font-mono font-bold">{formatSAR(financialTotals.taxTotal)}</span>
              </div>

              <div className="flex items-center justify-between text-sm font-black text-emerald-800 pt-2 border-t-2 border-slate-300">
                <span>المجموع الكلي للعرض:</span>
                <span className="font-mono text-base">{formatSAR(financialTotals.grandTotal)}</span>
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
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
            onClick={handleSubmit}
            disabled={isSubmitting || items.length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ حفظ عرض السعر...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ وإنشاء عرض السعر</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
