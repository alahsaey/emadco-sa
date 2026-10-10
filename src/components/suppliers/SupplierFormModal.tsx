/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Supplier } from '../../types';
import { SaudiRiyalSymbol } from '../common/SaudiRiyalSymbol';
import { Truck, Phone, Mail, MapPin, FileText, X, Save, AlertCircle, User } from 'lucide-react';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplierData: any) => Promise<void>;
  supplier?: Supplier | null;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  supplier,
}) => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    taxNumber: '',
    address: '',
    initialBalance: 0,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (supplier) {
      setFormData({
        companyName: supplier.companyName || '',
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        taxNumber: supplier.taxNumber || '',
        address: supplier.address || '',
        initialBalance: supplier.balance || 0,
        notes: supplier.notes || '',
      });
    } else {
      setFormData({
        companyName: '',
        contactPerson: '',
        phone: '',
        email: '',
        taxNumber: '',
        address: '',
        initialBalance: 0,
        notes: '',
      });
    }
    setErrorMessage(null);
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.companyName.trim()) {
      setErrorMessage('يرجى إدخال اسم شركة أو مصنع المورد.');
      return;
    }
    if (!formData.contactPerson.trim()) {
      setErrorMessage('يرجى إدخال اسم الشخص المسؤول أو مندوب المبيعات.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('يرجى إدخال رقم هاتف المورد.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ بيانات المورد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold">
              {supplier ? 'تعديل بيانات المورد' : 'إضافة مورد / مصنع جديد'}
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
            
            {/* اسم الشركة / المصنع */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم شركة أو مصنع المورد <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="مثال: مصنع الأهرام للأقفال أو شركة التوريدات الصناعية"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-semibold"
                />
              </div>
            </div>

            {/* الشخص المسؤول */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المسؤول / المندوب <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="م. أحمد شكري"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-semibold"
                />
              </div>
            </div>

            {/* الهاتف */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف / الجوال <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="011XXXXXXX أو 05XXXXXXXX"
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
                  placeholder="orders@supplier.com"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs font-mono text-right"
                />
              </div>
            </div>

            {/* الرقم الضريبي */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الرقم الضريبي للمورد
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

            {/* الرصيد الافتتاحي المستحق للمورد (في حالة الإضافة الجديدة فقط) */}
            {!supplier && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الرصيد الافتتاحي (مستحقات سابقة للمورد)
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
                عنوان المقر أو المستودع
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="المدينة الصناعية، الحي، الشارع"
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-xs"
                />
              </div>
            </div>

            {/* ملاحظات */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات أو شروط التوريد
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="مدة التوريد، شروط الدفع، نسبة الخصم الإضافي..."
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
              <span>{isSubmitting ? 'جاري الحفظ...' : supplier ? 'حفظ التعديلات' : 'إضافة المورد'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
