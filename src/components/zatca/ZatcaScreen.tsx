/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ElectronicInvoice,
  ZatcaCompanyProfile,
  ZatcaSubmissionStatus,
} from '../../types';
import {
  fetchElectronicInvoices,
  getZatcaCompanyProfile,
  saveZatcaCompanyProfile,
  retryZatcaSubmission,
} from '../../services/zatcaIntegration';
import { formatSAR, formatNumber } from '../../utils/formatters';
import { ZatcaInvoiceDetailsModal } from './ZatcaInvoiceDetailsModal';
import { ZatcaConfigTab } from './ZatcaConfigTab';
import {
  ShieldCheck,
  FileCheck2,
  FileX2,
  Clock,
  RotateCw,
  Search,
  Filter,
  Eye,
  Settings,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  QrCode,
  Code,
  FileText,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

export const ZatcaScreen: React.FC = () => {
  const [invoices, setInvoices] = useState<ElectronicInvoice[]>([]);
  const [profile, setProfile] = useState<ZatcaCompanyProfile | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'invoices' | 'config' | 'diagnostics'>('invoices');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<ElectronicInvoice | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // فلاتر البحث والجدول
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invList, prof] = await Promise.all([
        fetchElectronicInvoices(),
        getZatcaCompanyProfile(),
      ]);
      setInvoices(invList);
      setProfile(prof);
    } catch (err) {
      console.error('خطأ في جلب بيانات الفوترة الإلكترونية:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // حفظ الإعدادات
  const handleSaveProfile = async (updated: Partial<ZatcaCompanyProfile>) => {
    setIsSavingConfig(true);
    try {
      const saved = await saveZatcaCompanyProfile(updated);
      setProfile(saved);
      setActionNotice({ type: 'success', message: 'تم حفظ بيانات المنشأة وتحديث إعدادات ZATCA بنجاح.' });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err?.message || 'فشل حفظ الإعدادات' });
      setTimeout(() => setActionNotice(null), 4000);
      throw err;
    } finally {
      setIsSavingConfig(false);
    }
  };

  // إعادة محاولة إرسال فاتورة
  const handleRetryInvoice = async (invoiceId: string) => {
    setRetryingId(invoiceId);
    try {
      const result = await retryZatcaSubmission(invoiceId);
      if (result.success) {
        setActionNotice({ type: 'success', message: result.message });
      } else {
        setActionNotice({ type: 'error', message: result.message });
      }
      // تحديث القائمة محلياً
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? result.invoice : inv))
      );
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice(result.invoice);
      }
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err?.message || 'فشلت إعادة الإرسال' });
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setRetryingId(null);
    }
  };

  // الإحصائيات العامة
  const statistics = useMemo(() => {
    const totalCount = invoices.length;
    const acceptedCount = invoices.filter((i) => i.submissionStatus === 'Accepted').length;
    const pendingCount = invoices.filter((i) => i.submissionStatus === 'Pending' || i.submissionStatus === 'Submitted').length;
    const failedOrRejectedCount = invoices.filter((i) => i.submissionStatus === 'Failed' || i.submissionStatus === 'Rejected').length;
    const totalVat = invoices.reduce((acc, i) => acc + (i.vat || 0), 0);
    const totalSales = invoices.reduce((acc, i) => acc + (i.total || 0), 0);

    return {
      totalCount,
      acceptedCount,
      pendingCount,
      failedOrRejectedCount,
      totalVat,
      totalSales,
    };
  }, [invoices]);

  // تصفية الفواتير
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // بحث نصي
      const matchesSearch =
        !searchTerm.trim() ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.uuid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.errorMessage && inv.errorMessage.toLowerCase().includes(searchTerm.toLowerCase()));

      // تصفية بالحالة
      const matchesStatus =
        selectedStatus === 'all' || inv.submissionStatus === selectedStatus;

      // تصفية بالنوع
      const matchesType =
        selectedType === 'all' || inv.invoiceType === selectedType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [invoices, searchTerm, selectedStatus, selectedType]);

  const handleOpenDetails = (inv: ElectronicInvoice) => {
    setSelectedInvoice(inv);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. رأس شاشة الفوترة الإلكترونية والتبويبات العلوية */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">
                  الفوترة الإلكترونية وتكامل ZATCA (المملكة العربية السعودية)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                  المرحلة 1 و 2
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                طبقة تكامل مستقلة وقابلة للتهيئة لربط مبيعات مواد البناء بهيئة الزكاة والضريبة والجمارك مع ضمان استمرار نقاط البيع
              </p>
            </div>
          </div>

          {/* أزرار الإجراءات في الرأس */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAllData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث البيانات</span>
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">
                البيئة: {profile?.environment === 'production' ? 'الإنتاج المباشر' : profile?.environment === 'simulation' ? 'محاكاة الهيئة' : 'Sandbox تجريبي'}
              </span>
            </div>
          </div>
        </div>

        {/* إشعار الإجراء السريع */}
        {actionNotice && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
        )}

        {/* كروت الإحصائيات السريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500">إجمالي الفواتير الإلكترونية</div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {statistics.totalCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">مسجلة في قاعدة البيانات</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>المقبولة والمعتمدة (Accepted)</span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
              {statistics.acceptedCount}
            </div>
            <div className="text-[10px] text-emerald-600/80 mt-0.5">موثقة ومطابقة للهيئة</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>المعلقة (Pending / Submitted)</span>
            </div>
            <div className="text-2xl font-black font-mono text-amber-700 mt-1">
              {statistics.pendingCount}
            </div>
            <div className="text-[10px] text-amber-600/80 mt-0.5">بانتظار الاعتماد أو الربط</div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100">
            <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>الفاشلة والمرفوضة</span>
            </div>
            <div className="text-2xl font-black font-mono text-rose-700 mt-1">
              {statistics.failedOrRejectedCount}
            </div>
            <div className="text-[10px] text-rose-600/80 mt-0.5">تحتاج مراجعة أو إعادة إرسال</div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-slate-900 text-white">
            <div className="text-[11px] font-bold text-slate-300">ضريبة القيمة المضافة 15%</div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-1">
              {formatNumber(statistics.totalVat)}{' '}
              <span className="text-xs font-sans font-normal text-slate-400">ر.س</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">المحصلة في فواتير ZATCA</div>
          </div>
        </div>

        {/* أشرطة التبويبات الداخلية */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setActiveMainTab('invoices')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeMainTab === 'invoices'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>سجل الفواتير وحالة الإرسال ({invoices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('config')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeMainTab === 'config'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>بيانات المنشأة وبيئة ZATCA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('diagnostics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeMainTab === 'diagnostics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>فحص الجاهزية وقواعد المطابقة</span>
          </button>
        </div>

      </div>

      {/* 2. تبويب سجل الفواتير وحالة الإرسال */}
      {activeMainTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          
          {/* شريط الفلاتر والبحث */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم الفاتورة، UUID، أو سبب الخطأ..."
                className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* أزرار الفلترة بالحالة */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedStatus === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل ({invoices.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('Accepted')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedStatus === 'Accepted'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                المقبولة ({statistics.acceptedCount})
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('Pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedStatus === 'Pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                المعلقة ({statistics.pendingCount})
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('Failed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedStatus === 'Failed'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                الفاشلة / المرفوضة ({statistics.failedOrRejectedCount})
              </button>
            </div>
          </div>

          {/* جدول الفواتير الإلكترونية */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">تاريخ ووقت الإصدار</th>
                  <th className="p-3">المبلغ قبل الضريبة</th>
                  <th className="p-3">ضريبة 15%</th>
                  <th className="p-3">الإجمالي النهائي</th>
                  <th className="p-3 text-center">حالة الإرسال (Status)</th>
                  <th className="p-3 text-center">المطابقة (Validation)</th>
                  <th className="p-3">سبب الخطأ / الملاحظة</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      لا توجد فواتير تطابق شروط البحث أو الفلاتر المحددة.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isAccepted = inv.submissionStatus === 'Accepted';
                    const isPending = inv.submissionStatus === 'Pending' || inv.submissionStatus === 'Submitted';
                    const isFailed = inv.submissionStatus === 'Failed' || inv.submissionStatus === 'Rejected';

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                            {inv.uuid}
                          </div>
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              inv.invoiceType === 'simplified'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {inv.invoiceType === 'simplified' ? 'مبسطة (0200000)' : 'قياسية (0100000)'}
                          </span>
                        </td>

                        <td className="p-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {new Date(inv.issueDate).toLocaleString('ar-SA')}
                        </td>

                        <td className="p-3 font-mono text-slate-700">
                          {formatSAR(inv.subtotal)}
                        </td>

                        <td className="p-3 font-mono font-bold text-slate-800">
                          {formatSAR(inv.vat)}
                        </td>

                        <td className="p-3 font-mono font-black text-emerald-600">
                          {formatSAR(inv.total)}
                        </td>

                        {/* حالة الإرسال */}
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isAccepted
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : isFailed
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isAccepted && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                            {isFailed && <XCircle className="w-3 h-3 text-rose-600" />}
                            <span>{inv.submissionStatus}</span>
                          </span>
                        </td>

                        {/* حالة التحقق */}
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              inv.validationStatus === 'Valid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : inv.validationStatus === 'Warnings'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {inv.validationStatus}
                          </span>
                        </td>

                        {/* سبب الخطأ / الملاحظات */}
                        <td className="p-3 max-w-[200px]">
                          {inv.errorMessage ? (
                            <div className="text-[11px] text-rose-700 font-medium truncate flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span title={inv.errorMessage}>{inv.errorMessage}</span>
                            </div>
                          ) : isAccepted ? (
                            <span className="text-[11px] text-emerald-600">تم التوثيق والاعتماد بنجاح</span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>

                        {/* الإجراءات */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* زر إعادة المحاولة */}
                            {!isAccepted && (
                              <button
                                type="button"
                                disabled={retryingId === inv.id}
                                onClick={() => handleRetryInvoice(inv.id)}
                                title="إعادة إرسال الفاتورة إلى ZATCA"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <RotateCw className={`w-3.5 h-3.5 ${retryingId === inv.id ? 'animate-spin' : ''}`} />
                              </button>
                            )}

                            {/* زر معاينة التفاصيل */}
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(inv)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>التفاصيل وQR</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* 3. تبويب إعدادات المنشأة وبيئة ZATCA */}
      {activeMainTab === 'config' && profile && (
        <ZatcaConfigTab
          profile={profile}
          onSaveProfile={handleSaveProfile}
          isSaving={isSavingConfig}
        />
      )}

      {/* 4. تبويب فحص الجاهزية وقواعد المطابقة */}
      {activeMainTab === 'diagnostics' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>فحص جاهزية النظام وقواعد أعمال هيئة الزكاة والضريبة (ZATCA Rules Compliance)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              مراجعة تلقائية لاشتراطات الربط والتكامل المعتمدة في المملكة العربية السعودية
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>متطلبات المرحلة الأولى والثانية (BR-KSA Standard)</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>توليد تشفير Base64 TLV لحقول رمز QR Code الخمسة الأساسية والمتقدمة.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>دعم معايير الفواتير الضريبية المبسطة (0200000) والفواتير القياسية (0100000).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>بناء هيكل XML / UBL 2.1 المعتمد مع مساحات الأسماء المحددة (cac, cbc, ext).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>توليد معرف فريد عالمي UUID v4 لكل فاتورة وفق معيار RFC 4122.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>سلسلة التجزئة والتشفير (Hash Chaining) بربط كل فاتورة بالـ Hash للفاتورة السابقة (PIH).</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>الحصانة المعمارية لنقاط البيع (Resilience Guarantee)</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>طبقة الفوترة الإلكترونية مستقلة كلياً وغير مسببة لإلغاء المبيعات عند انقطاع الاتصال.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>حفظ فوري لسجل الفاتورة الإلكترونية مع حالة مفصلة (Draft, Pending, Submitted, Accepted, Rejected, Failed).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>إمكانية إعادة إرسال أي فاتورة فاشلة أو معلقة بنقرة زر واحدة بعد التحقق من بيانات الاعتماد.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>توافق كامل مع طابعات الإيصالات الحرارية (80mm) ونماذج الفواتير الضريبية.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 5. نافذة تفاصيل الفاتورة المنبثقة */}
      <ZatcaInvoiceDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        invoice={selectedInvoice}
        onRetry={handleRetryInvoice}
        isRetrying={retryingId === selectedInvoice?.id}
      />

    </div>
  );
};
