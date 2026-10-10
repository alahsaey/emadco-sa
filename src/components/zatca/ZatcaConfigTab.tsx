/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ZatcaCompanyProfile } from '../../types';
import {
  Building2,
  ShieldCheck,
  Key,
  Lock,
  Hash,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  Server,
  Eye,
  EyeOff,
  HelpCircle,
} from 'lucide-react';

interface ZatcaConfigTabProps {
  profile: ZatcaCompanyProfile;
  onSaveProfile: (updated: Partial<ZatcaCompanyProfile>) => Promise<void>;
  isSaving: boolean;
}

export const ZatcaConfigTab: React.FC<ZatcaConfigTabProps> = ({
  profile,
  onSaveProfile,
  isSaving,
}) => {
  const [formData, setFormData] = useState<ZatcaCompanyProfile>({ ...profile });
  const [showSecret, setShowSecret] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [vatValidationError, setVatValidationError] = useState<string | null>(null);

  const handleVatChange = (value: string) => {
    setFormData((prev) => ({ ...prev, vatNumber: value }));
    const vatRegex = /^3\d{13}3$/;
    if (value && !vatRegex.test(value)) {
      setVatValidationError('الرقم الضريبي يجب أن يتكون من 15 رقماً ويبدأ وينتهي بالرقم 3.');
    } else {
      setVatValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vatValidationError) return;

    // تحديد ما إذا كانت المنشأة مهيأة بالكامل
    const isConfigured = Boolean(
      formData.vatNumber &&
      formData.companyName &&
      (formData.csidToken || formData.environment === 'simulation')
    );

    try {
      await onSaveProfile({
        ...formData,
        isConfigured,
      });
      setSaveSuccessMsg('تم حفظ وتحديث بيانات المنشأة وإعدادات ZATCA بنجاح.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('خطأ في حفظ الإعدادات:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* إشعار النجاح */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* 1. بيانات المنشأة الأساسية والعنوان الوطني */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">بيانات المنشأة والعنوان الوطني المعتمد</h3>
            <p className="text-xs text-slate-500">
              المعلومات الأساسية المعتمدة التي ستظهر على الفاتورة وتُضمن في وسوم UBL وQR
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">اسم المنشأة / المورد *</label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="مثال: مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>الرقم الضريبي (VAT Number) *</span>
              <span className="text-[10px] text-slate-400 font-mono">15 رقم (3...3)</span>
            </label>
            <input
              type="text"
              required
              maxLength={15}
              value={formData.vatNumber}
              onChange={(e) => handleVatChange(e.target.value)}
              className={`w-full p-2.5 rounded-xl border text-xs font-mono font-bold bg-slate-50 focus:bg-white focus:outline-hidden ${
                vatValidationError ? 'border-rose-400 text-rose-700' : 'border-slate-200 text-slate-900 focus:border-emerald-500'
              }`}
              placeholder="310948572100003"
            />
            {vatValidationError && (
              <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{vatValidationError}</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">رقم السجل التجاري (CR Number)</label>
            <input
              type="text"
              value={formData.crNumber || ''}
              onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="1010894523"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">اسم الشارع *</label>
            <input
              type="text"
              required
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="طريق الملك فهد"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">رقم المبنى</label>
            <input
              type="text"
              value={formData.buildingNumber || ''}
              onChange={(e) => setFormData({ ...formData, buildingNumber: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="4120"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">الرقم الإضافي</label>
            <input
              type="text"
              value={formData.additionalNumber || ''}
              onChange={(e) => setFormData({ ...formData, additionalNumber: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="7890"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">الحي / المنطقة</label>
            <input
              type="text"
              value={formData.district || ''}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="حي العارض"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">المدينة *</label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="الرياض"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">الرمز البريدي (Postal Zone) *</label>
            <input
              type="text"
              required
              maxLength={5}
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="13344"
            />
          </div>
        </div>
      </div>

      {/* 2. بيئة التكامل التقني مع ZATCA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Server className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">بيئة التكامل التقني والحل المعتمد</h3>
            <p className="text-xs text-slate-500">
              تحديد البيئة التقنية المستهدفة ونوع الفواتير الافتراضي
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">بيئة التكامل (Environment)</label>
            <select
              value={formData.environment}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  environment: e.target.value as 'sandbox' | 'simulation' | 'production',
                })
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="sandbox">بيئة المطورين والتجربة (Developer Sandbox)</option>
              <option value="simulation">بيئة المحاكاة الرسمية لهيئة الزكاة (Simulation Platform)</option>
              <option value="production">بيئة الإنتاج المباشرة (Live Production Environment)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">نوع الفاتورة الافتراضي</label>
            <select
              value={formData.defaultInvoiceType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultInvoiceType: e.target.value as 'simplified' | 'standard',
                })
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="simplified">فاتورة ضريبية مبسطة (0200000 - B2C للأفراد ونقاط البيع)</option>
              <option value="standard">فاتورة ضريبية قياسية (0100000 - B2B للشركات والمقاولين)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">معرّف وحدة الحل التقني (EGS Unit Serial)</label>
            <input
              type="text"
              value={formData.egsSerialNumber}
              onChange={(e) => setFormData({ ...formData, egsSerialNumber: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="BUNYAN-POS-01"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>رابط الواجهة الرسمي المخصص (Custom API Gateway / Proxy)</span>
              <span className="text-[10px] text-slate-400">اختياري - يترك فارغاً لاستخدام بوابة الهيئة المباشرة</span>
            </label>
            <input
              type="url"
              value={formData.customApiEndpoint || ''}
              onChange={(e) => setFormData({ ...formData, customApiEndpoint: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="https://gw-fatoora.zatca.sa/e-invoicing/simulation"
            />
          </div>
        </div>
      </div>

      {/* 3. بيانات الاعتماد المشفرة والشهادات الرقمية (Credentials) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Key className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">بيانات الاعتماد والشهادة الرقمية (ZATCA Credentials)</h3>
            <p className="text-xs text-slate-500">
              يتم حفظ هذه البيانات بأمان واستخدامها لتوثيق الاتصال عند إرسال الفواتير
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>رمز الأمان الثنائي للشهادة (CSID Binary Security Token)</span>
              <span className="text-[10px] text-slate-400 font-mono">Base64 X.509</span>
            </label>
            <textarea
              rows={2}
              value={formData.csidToken || ''}
              onChange={(e) => setFormData({ ...formData, csidToken: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="MIIDXTCCAkWgAwIBAgIU..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>كلمة السر / المفتاح السري (Secret / Password)</span>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showSecret ? 'إخفاء' : 'إظهار'}</span>
              </button>
            </label>
            <input
              type={showSecret ? 'text' : 'password'}
              value={formData.csidSecret || ''}
              onChange={(e) => setFormData({ ...formData, csidSecret: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="••••••••••••••••••••••••••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>المفتاح الخاص (Private Key - ECC Secp256k1)</span>
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                {showPrivateKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPrivateKey ? 'إخفاء' : 'إظهار'}</span>
              </button>
            </label>
            <textarea
              rows={2}
              value={formData.privateKeyPem || ''}
              onChange={(e) => setFormData({ ...formData, privateKeyPem: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="-----BEGIN EC PRIVATE KEY-----"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>رمز التحقق لمرة واحدة (Onboarding OTP)</span>
              <span className="text-[10px] text-slate-400">من منصة فاتورة (Fatoora Portal)</span>
            </label>
            <input
              type="text"
              maxLength={6}
              value={formData.onboardingOtp || ''}
              onChange={(e) => setFormData({ ...formData, onboardingOtp: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono tracking-widest text-center bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              placeholder="123456"
            />
          </div>
        </div>
      </div>

      {/* زر الحفظ الأساسي */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>التكامل مستقل تماماً عن شاشة البيع، والتغييرات تطبق فورياً على الفواتير التالية</span>
        </div>

        <button
          type="submit"
          disabled={isSaving || Boolean(vatValidationError)}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'جاري حفظ الإعدادات...' : 'حفظ بيانات المنشأة والتكامل'}</span>
        </button>
      </div>

    </form>
  );
};
