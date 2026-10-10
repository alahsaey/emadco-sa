/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Return, ReturnReason } from '../../types';
import { getReturns } from '../../services/returns';
import { NewReturnModal } from './NewReturnModal';
import { ReturnDocumentModal } from './ReturnDocumentModal';
import { formatSAR } from '../../utils/formatters';
import {
  RotateCcw,
  Search,
  Plus,
  Filter,
  FileCheck2,
  Calendar,
  AlertTriangle,
  FileText,
  Printer,
  ChevronLeft,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';

export const ReturnsScreen: React.FC = () => {
  const [returns, setReturns] = useState<Return[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string>('all');

  // نوافذ منبثقة
  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState<boolean>(false);
  const [selectedReturnDoc, setSelectedReturnDoc] = useState<Return | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);

  // تحميل المرتجعات
  const fetchReturnsData = async () => {
    try {
      setIsLoading(true);
      const data = await getReturns();
      setReturns(data);
    } catch (err) {
      console.error('خطأ في تحميل سجل المرتجعات:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnsData();
  }, []);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    const totalCount = returns.length;
    const totalAmount = returns.reduce((acc, r) => acc + (r.refundAmount || 0), 0);
    const defectCount = returns.filter((r) => r.reason === 'عيب').length;
    const wrongSizeCount = returns.filter((r) => r.reason === 'مقاس غير مناسب').length;
    const orderErrorCount = returns.filter((r) => r.reason === 'خطأ في الطلب').length;
    const otherCount = returns.filter((r) => r.reason === 'سبب آخر').length;

    return {
      totalCount,
      totalAmount,
      defectCount,
      wrongSizeCount,
      orderErrorCount,
      otherCount,
    };
  }, [returns]);

  // تصفية المرتجعات
  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.returnNumber.toLowerCase().includes(q) ||
        r.originalInvoiceNumber.toLowerCase().includes(q) ||
        (r.customerName && r.customerName.toLowerCase().includes(q)) ||
        (r.reasonDetails && r.reasonDetails.toLowerCase().includes(q));

      const matchReason = selectedReasonFilter === 'all' || r.reason === selectedReasonFilter;

      return matchSearch && matchReason;
    });
  }, [returns, searchQuery, selectedReasonFilter]);

  const handleReturnCreated = (createdReturn: Return) => {
    setIsNewReturnModalOpen(false);
    fetchReturnsData();
    // فتح مستند المرتجع مباشرة للطباعة
    setSelectedReturnDoc(createdReturn);
    setIsDocModalOpen(true);
  };

  const refundMethodLabels: Record<string, string> = {
    customer_balance: 'رصيد العميل',
    cash: 'نقدي (خزينة)',
    card: 'شبكة / بطاقة',
    bank_transfer: 'تحويل بنكي',
  };

  return (
    <div className="space-y-6">
      
      {/* رأس الصفحة والإجراءات */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">إدارة المرتجعات وإشعارات الدائن</h1>
              <p className="text-xs text-slate-500">
                استرجاع فواتير المبيعات، إعادة المواد للمخزن آلياً، وتحديث أرصدة العملاء
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchReturnsData}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsNewReturnModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مرتجع جديد (إرجاع فاتورة)</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات الأربعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">إجمالي العمليات المرتجعة</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">{stats.totalCount}</span>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">عملية</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">إجمالي المبالغ المستردة</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700 font-mono">
              {stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 font-medium">ر.س</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">المرتجع بسبب العيوب</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700 font-mono">{stats.defectCount}</span>
            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold">
              عيب مصنعي
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">أخطاء الطلب والمقاس</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-700 font-mono">
              {stats.orderErrorCount + stats.wrongSizeCount}
            </span>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-bold">
              تجهيز / مقاس
            </span>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الإشعار، الفاتورة الأصلية، أو العميل..."
            className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-hidden"
          />
        </div>

        {/* فلاتر الأسباب */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'جميع الأسباب' },
            { id: 'عيب', label: 'عيب' },
            { id: 'مقاس غير مناسب', label: 'مقاس غير مناسب' },
            { id: 'خطأ في الطلب', label: 'خطأ في الطلب' },
            { id: 'سبب آخر', label: 'سبب آخر' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedReasonFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedReasonFilter === tab.id
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* جدول المرتجعات */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
            <span>جارٍ تحميل سجل المرتجعات...</span>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RotateCcw className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
            <p className="font-bold text-slate-700 text-sm">لا توجد عمليات مرتجعة مسجلة</p>
            <p className="text-slate-400 mt-1">
              {searchQuery ? 'لم نجد أي نتائج مطابقة لبحثك.' : 'اضغط على "تسجيل مرتجع جديد" لإرجاع فاتورة سابقة.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">رقم إشعار المرتجع</th>
                  <th className="py-3 px-4 font-bold">الفاتورة الأصلية</th>
                  <th className="py-3 px-4 font-bold">العميل</th>
                  <th className="py-3 px-4 font-bold">تاريخ الإرجاع</th>
                  <th className="py-3 px-4 font-bold">سبب الإرجاع</th>
                  <th className="py-3 px-4 font-bold">طريقة الاسترداد</th>
                  <th className="py-3 px-4 font-bold text-left">المبلغ المسترد</th>
                  <th className="py-3 px-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {ret.returnNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-rose-700 font-medium">
                      {ret.originalInvoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {ret.customerName}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {new Date(ret.createdAt).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {ret.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {refundMethodLabels[ret.refundMethod] || ret.refundMethod}
                    </td>
                    <td className="py-3 px-4 text-left font-mono font-bold text-rose-700 text-sm">
                      {formatSAR(ret.refundAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReturnDoc(ret);
                          setIsDocModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>عرض المستند</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة تسجيل مرتجع جديد */}
      <NewReturnModal
        isOpen={isNewReturnModalOpen}
        onClose={() => setIsNewReturnModalOpen(false)}
        onSuccess={handleReturnCreated}
      />

      {/* نافذة مستند الإشعار الدائن للطباعة */}
      <ReturnDocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        returnDoc={selectedReturnDoc}
      />

    </div>
  );
};
