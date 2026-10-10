/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Quotation, QuotationStatus } from '../../types';
import { getQuotations, updateQuotationStatus, deleteQuotation } from '../../services/quotations';
import { NewQuotationModal } from './NewQuotationModal';
import { QuotationDocumentModal } from './QuotationDocumentModal';
import { ConvertToSaleModal } from './ConvertToSaleModal';
import { InvoiceReceiptModal } from '../pos/InvoiceReceiptModal';
import { CompletedSaleResult } from '../../services/pos';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { formatSAR } from '../../utils/formatters';
import {
  FileSpreadsheet,
  Search,
  Plus,
  Filter,
  Calendar,
  Clock,
  Printer,
  ArrowRightCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Trash2,
  Building,
  User,
} from 'lucide-react';

export const QuotationsScreen: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // نوافذ منبثقة
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [selectedQuotationForDoc, setSelectedQuotationForDoc] = useState<Quotation | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [selectedQuotationForConversion, setSelectedQuotationForConversion] = useState<Quotation | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState<boolean>(false);

  // إيصال الفاتورة بعد التحويل الناجح
  const [completedSaleResult, setCompletedSaleResult] = useState<CompletedSaleResult | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // حالة حذف عرض السعر
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [isDeletingQuotation, setIsDeletingQuotation] = useState<boolean>(false);

  const fetchQuotationsData = async () => {
    try {
      setIsLoading(true);
      const data = await getQuotations();
      setQuotations(data);
    } catch (err) {
      console.error('خطأ في جلب عروض الأسعار:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotationsData();
  }, []);

  // إحصائيات
  const stats = useMemo(() => {
    const totalCount = quotations.length;
    const pendingCount = quotations.filter((q) => q.status === 'Draft' || q.status === 'Sent').length;
    const acceptedCount = quotations.filter((q) => q.status === 'Accepted').length;
    const convertedCount = quotations.filter((q) => q.status === 'Converted').length;
    const totalValue = quotations.reduce((acc, q) => acc + (q.grandTotal || 0), 0);
    const convertedValue = quotations
      .filter((q) => q.status === 'Converted')
      .reduce((acc, q) => acc + (q.grandTotal || 0), 0);

    return {
      totalCount,
      pendingCount,
      acceptedCount,
      convertedCount,
      totalValue,
      convertedValue,
    };
  }, [quotations]);

  // تصفية
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        q.quotationNumber.toLowerCase().includes(query) ||
        q.customerName.toLowerCase().includes(query) ||
        (q.projectName && q.projectName.toLowerCase().includes(query)) ||
        (q.customerPhone && q.customerPhone.includes(query));

      const matchStatus = statusFilter === 'all' || q.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [quotations, searchQuery, statusFilter]);

  // تحديث حالة عرض السعر
  const handleStatusChange = async (quotationId: string, newStatus: QuotationStatus) => {
    try {
      await updateQuotationStatus(quotationId, newStatus);
      fetchQuotationsData();
    } catch (err) {
      console.error('فشل تغيير حالة عرض السعر:', err);
    }
  };

  // تأكيد حذف مسودة عرض السعر
  const handleConfirmDeleteQuotation = async () => {
    if (!quotationToDelete) return;
    try {
      setIsDeletingQuotation(true);
      await deleteQuotation(quotationToDelete.id, 'المدير');
      setQuotationToDelete(null);
      await fetchQuotationsData();
    } catch (err: any) {
      console.error('فشل حذف عرض السعر:', err);
    } finally {
      setIsDeletingQuotation(false);
    }
  };

  // فتح نافذة التحويل لفاتورة
  const handleOpenConversion = (quotation: Quotation) => {
    setSelectedQuotationForConversion(quotation);
    setIsConvertModalOpen(true);
  };

  // بعد نجاح التحويل إلى فاتورة بيع
  const handleConversionSuccess = (saleResult: CompletedSaleResult) => {
    setIsConvertModalOpen(false);
    fetchQuotationsData();
    setCompletedSaleResult(saleResult);
    setIsReceiptModalOpen(true);
  };

  const statusBadgeStyle: Record<QuotationStatus, { bg: string; text: string; label: string }> = {
    Draft: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', label: 'مسودة' },
    Sent: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'مرسل' },
    Accepted: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800', label: 'مقبول' },
    Rejected: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'مرفوض' },
    Expired: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'منتهي' },
    Converted: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', label: 'تم التحويل لفاتورة' },
  };

  return (
    <div className="space-y-6">
      
      {/* رأس الصفحة والإجراءات */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">إدارة عروض الأسعار (Quotations)</h1>
              <p className="text-xs text-slate-500">
                إصدار عروض تسعير المواد، متابعة حالات العرض، وتحويلها إلى فواتير مبيعات بنقرة واحدة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchQuotationsData}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إنشاء عرض سعر جديد</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات الأربعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">إجمالي عروض الأسعار</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">{stats.totalCount}</span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">عرض</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">عروض مقبولة جاهزة للتحويل</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700 font-mono">{stats.acceptedCount}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              جاهز للفوترة
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">عروض قيد الانتظار</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-700 font-mono">{stats.pendingCount}</span>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-bold">
              مسودة / مرسل
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">مبيعات محولة من عروض أسعار</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-700 font-mono">
              {stats.convertedValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-400 font-medium">ر.س</span>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلاتر بحسب الحالات */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم العرض، العميل، المشروع، الجوال..."
            className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-hidden"
          />
        </div>

        {/* فلاتر الحالات الست المطلوبة */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'Draft', label: 'مسودة (Draft)' },
            { id: 'Sent', label: 'مرسل (Sent)' },
            { id: 'Accepted', label: 'مقبول (Accepted)' },
            { id: 'Rejected', label: 'مرفوض (Rejected)' },
            { id: 'Expired', label: 'منتهي (Expired)' },
            { id: 'Converted', label: 'تم التحويل (Converted)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* جدول عروض الأسعار */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
            <span>جارٍ تحميل عروض الأسعار...</span>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
            <p className="font-bold text-slate-700 text-sm">لا توجد عروض أسعار مطابقة</p>
            <p className="text-slate-400 mt-1">
              {searchQuery ? 'لم نجد أي نتائج مطابقة لبحثك.' : 'اضغط على "+ إنشاء عرض سعر جديد" لبدء تقديم تسعيرة للعميل.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">رقم العرض</th>
                  <th className="py-3 px-4 font-bold">العميل والمشروع</th>
                  <th className="py-3 px-4 font-bold">تاريخ الإصدار</th>
                  <th className="py-3 px-4 font-bold">الصلاحية</th>
                  <th className="py-3 px-4 font-bold text-center">الحالة</th>
                  <th className="py-3 px-4 font-bold text-left">المبلغ الإجمالي</th>
                  <th className="py-3 px-4 font-bold text-center">إجراءات التحويل والطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((quo) => {
                  const st = statusBadgeStyle[quo.status] || statusBadgeStyle.Draft;
                  const isAccepted = quo.status === 'Accepted';
                  const isConverted = quo.status === 'Converted';

                  return (
                    <tr key={quo.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {quo.quotationNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{quo.customerName}</div>
                        {quo.projectName && (
                          <div className="text-[11px] text-slate-500">{quo.projectName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {quo.issueDate}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <span className={quo.status === 'Expired' ? 'text-amber-700 font-bold' : ''}>
                          {quo.validUntil}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-emerald-800 text-sm">
                        {formatSAR(quo.grandTotal)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          
                          {/* زر التحويل إلى فاتورة (المطلوب في مواصفات المستخدم بدقة) */}
                          {!isConverted ? (
                            <button
                              type="button"
                              onClick={() => handleOpenConversion(quo)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                isAccepted
                                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white ring-2 ring-emerald-500/20'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                              title="تحويل عرض السعر إلى فاتورة مبيعات معتمدة"
                            >
                              <ArrowRightCircle className="w-3.5 h-3.5" />
                              <span>تحويل إلى فاتورة</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded-md font-mono font-bold border border-purple-200">
                              {quo.convertedInvoiceNumber || 'فاتورة معتمدة'}
                            </span>
                          )}

                          {/* زر عرض وطباعة مستند العرض */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuotationForDoc(quo);
                              setIsDocModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="طباعة وعرض المستند"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* تغيير سريع للحالة */}
                          {!isConverted && (
                            <select
                              value={quo.status}
                              onChange={(e) => handleStatusChange(quo.id, e.target.value as QuotationStatus)}
                              className="text-[10px] p-1 border border-slate-200 rounded-lg bg-white text-slate-600 outline-hidden cursor-pointer"
                              title="تغيير حالة العرض"
                            >
                              <option value="Draft">مسودة</option>
                              <option value="Sent">تم الإرسال</option>
                              <option value="Accepted">مقبول</option>
                              <option value="Rejected">مرفوض</option>
                              <option value="Expired">منتهي</option>
                            </select>
                          )}

                          {/* حذف إذا كان مسودة أو مرفوض */}
                          {!isConverted && (
                            <button
                              type="button"
                              onClick={() => setQuotationToDelete(quo)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-sm cursor-pointer transition-colors"
                              title="حذف عرض السعر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة إنشاء عرض سعر جديد */}
      <NewQuotationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={(created) => {
          setIsNewModalOpen(false);
          fetchQuotationsData();
          setSelectedQuotationForDoc(created);
          setIsDocModalOpen(true);
        }}
      />

      {/* نافذة عرض وطباعة مستند عرض السعر */}
      <QuotationDocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        quotation={selectedQuotationForDoc}
        onConvertToSale={(quo) => handleOpenConversion(quo)}
      />

      {/* نافذة تحويل عرض السعر إلى فاتورة مبيعات */}
      <ConvertToSaleModal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        quotation={selectedQuotationForConversion}
        onConversionSuccess={handleConversionSuccess}
      />

      {/* نافذة الإيصال والفاتورة الضريبية الصادرة */}
      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleResult={completedSaleResult}
        onNewSale={() => setIsReceiptModalOpen(false)}
      />

      {/* نافذة تأكيد حذف عرض السعر */}
      <ConfirmDeleteModal
        isOpen={!!quotationToDelete}
        onClose={() => {
          if (!isDeletingQuotation) setQuotationToDelete(null);
        }}
        onConfirm={handleConfirmDeleteQuotation}
        title="تأكيد حذف عرض السعر"
        itemTypeLabel="إدارة عروض الأسعار"
        itemName={quotationToDelete ? `${quotationToDelete.quotationNumber} - ${quotationToDelete.customerName}` : undefined}
        message={`هل أنت متأكد من رغبتك في حذف عرض السعر رقم "${quotationToDelete?.quotationNumber}" للعميل "${quotationToDelete?.customerName}"؟`}
        warningNote="سيتم حذف مستند عرض السعر وبنوده بالكامل من النظام."
        isProcessing={isDeletingQuotation}
        confirmButtonText="نعم، حذف عرض السعر"
      />

    </div>
  );
};
