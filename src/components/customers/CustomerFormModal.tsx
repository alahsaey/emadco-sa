/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Customer, CustomerType } from '../../types';
import { SaudiRiyalSymbol } from '../common/SaudiRiyalSymbol';
import { User, Phone, Mail, MapPin, FileText, X, Save, AlertCircle } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: any) => Promise<void>;
  customer?: Customer | null;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customer,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    commercialRegister: '',
    customerType: 'individual' as CustomerType,
    priceTier: 'retail' as 'retail' | 'wholesale' | 'contractor',
    creditLimit: 0,
    initialBalance: 0,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        taxNumber: customer.taxNumber || '',
        commercialRegister: customer.commercialRegister || '',
        customerType: customer.customerType || 'individual',
        priceTier: customer.priceTier || 'retail',
        creditLimit: customer.creditLimit || 0,
        initialBalance: customer.currentBalance || 0,
        notes: customer.notes || '',
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        taxNumber: '',
        commercialRegister: '',
        customerType: 'individual',
        priceTier: 'retail',
        creditLimit: 0,
        initialBalance: 0,
        notes: '',
      });
    }
    setErrorMessage(null);
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage('يرجى إدخال اسم العميل.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('يرجى إدخال رقم هاتف / جوال العميل.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ بيانات العميل.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold">
              {customer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
            </h3>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-slate-800 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* الاسم */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم العميل / المؤسسة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: صالح الياسين"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-semibold"
                />
              </div>
            </div>

            {/* الجوال */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الجوال <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0500680180"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-mono font-bold text-right"
                />
              </div>
            </div>

            {/* البريد الإلكتروني */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  dir="ltr"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="alahsaey@gmail.com"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-mono text-right"
                />
              </div>
            </div>

            {/* نوع العميل */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نوع العميل
              </label>
              <select
                value={formData.customerType}
                onChange={(e) => setFormData({ ...formData, customerType: e.target.value as CustomerType })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-semibold"
              >
                <option value="individual">عميل أفراد / نقدي</option>
                <option value="contractor">مقاول / مهني / ورشة</option>
                <option value="company">شركة / مؤسسة</option>
                <option value="wholesale">تاجر جملة / موزع</option>
              </select>
            </div>

            {/* فئة التسعير التلقائي */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                فئة التسعير في الفاتورة
              </label>
              <select
                value={formData.priceTier}
                onChange={(e) => setFormData({ ...formData, priceTier: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-semibold"
              >
                <option value="retail">سعر التجزئة (العادي)</option>
                <option value="contractor">سعر المقاولين (خصم خاص)</option>
                <option value="wholesale">سعر الجملة (الحد الأدنى)</option>
              </select>
            </div>

            {/* الرقم الضريبي */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الرقم الضريبي (15 رقماً)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  dir="ltr"
                  maxLength={15}
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  placeholder="3XXXXXXXXXXXX03"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-mono font-bold text-right"
                />
              </div>
            </div>

            {/* السجل التجاري */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم السجل التجاري
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.commercialRegister}
                onChange={(e) => setFormData({ ...formData, commercialRegister: e.target.value })}
                placeholder="1010XXXXXX"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-mono text-right"
              />
            </div>

            {/* سقف الائتمان */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سقف الائتمان المسموح به (ر.س)
              </label>
              <div className="relative">
                <SaudiRiyalSymbol className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-mono font-bold"
                />
              </div>
              <span className="text-[10px] text-slate-500">ضع 0 إذا كان العميل نقدي فقط ولا يسمح له بالآجل</span>
            </div>

            {/* الرصيد الافتتاحي (في حالة الإضافة الجديدة فقط) */}
            {!customer && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الرصيد الافتتاحي المستحق (مديونية سابقة)
                </label>
                <div className="relative">
                  <SaudiRiyalSymbol className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {/* العنوان */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العنوان الوطني / موقع المنشأة
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="المدينة، الحي، الشارع، رقم المبنى"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs"
                />
              </div>
            </div>

            {/* ملاحظات */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات إضافية
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="شروط دفع خاصة، اسم المندوب المفوض، شروط التسليم..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : customer ? 'حفظ التعديلات' : 'إضافة العميل'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
