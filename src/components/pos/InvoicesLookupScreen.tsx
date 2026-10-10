/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Printer,
  MessageSquare,
  FileText,
  RefreshCw,
  Calendar,
  CreditCard,
  User,
  Phone,
  Filter,
  FileCheck2,
  CheckCircle2,
  Download,
  Eye,
  AlertCircle,
  Loader2,
  Sparkles,
  Send,
  Building2,
  ChevronLeft,
  Clock,
  Check,
  Share2,
} from 'lucide-react';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import {
  fetchRecentInvoices,
  searchInvoices,
  getCompletedSaleResultForInvoice,
  updateInvoiceStatus,
  InvoiceLookupItem,
} from '../../services/invoicesLookup';
import { CompletedSaleResult } from '../../services/pos';
import { InvoiceReceiptModal } from './InvoiceReceiptModal';
import { WhatsAppShareModal } from '../common/WhatsAppShareModal';
import { buildInvoiceWhatsAppMessage } from '../../utils/whatsapp';
import { formatSAR, formatInteger } from '../../utils/formatters';

interface InvoicesLookupScreenProps {
  onBackToPos?: () => void;
}

export const InvoicesLookupScreen: React.FC<InvoicesLookupScreenProps> = ({ onBackToPos }) => {
  const [invoices, setInvoices] = useState<InvoiceLookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [autoUpdateStatusOnWhatsApp, setAutoUpdateStatusOnWhatsApp] = useState<boolean>(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  
  // التحكم في النوافذ المنبثقة
  const [activeSaleResult, setActiveSaleResult] = useState<CompletedSaleResult | null>(null);
  const [activeInvoiceItem, setActiveInvoiceItem] = useState<InvoiceLookupItem | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isPreparingReceipt, setIsPreparingReceipt] = useState(false);

  // التحكم في نافذة الواتساب
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [whatsappData, setWhatsappData] = useState<{
    docNumber: string;
    customerName: string;
    customerPhone: string;
    messageText: string;
    grandTotal: number;
  } | null>(null);

  // تحميل الفواتير
  const loadInvoicesData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecentInvoices(120);
      setInvoices(data);
    } catch (err) {
      console.error('فشل تحميل الفواتير:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoicesData();
  }, [loadInvoicesData]);

  // تصفية الفواتير محلياً
  const filteredInvoices = useMemo(() => {
    return invoices.filter((item) => {
      const inv = item.invoice;
      const q = searchQuery.trim().toLowerCase();

      // البحث النصي
      if (q) {
        const matchNum = (inv.invoiceNumber || '').toLowerCase().includes(q);
        const matchCust = (inv.customerName || '').toLowerCase().includes(q);
        const matchPhone = (inv.customerPhone || '').toLowerCase().includes(q);
        const matchCashier = (item.cashierName || '').toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchPhone && !matchCashier) {
          return false;
        }
      }

      // فلتر تاريخ
      if (selectedDateFilter !== 'all') {
        const invDate = new Date(inv.issueDate);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        if (selectedDateFilter === 'today') {
          if (invDate.getTime() < todayStart) return false;
        } else if (selectedDateFilter === 'yesterday') {
          const yesterdayStart = todayStart - 86400000;
          if (invDate.getTime() < yesterdayStart || invDate.getTime() >= todayStart) return false;
        } else if (selectedDateFilter === 'week') {
          const weekAgo = todayStart - 7 * 86400000;
          if (invDate.getTime() < weekAgo) return false;
        }
      }

      // فلتر طريقة الدفع
      if (selectedPaymentMethod !== 'all') {
        const code = item.sale?.paymentMethodCode || 'CASH';
        if (code.toUpperCase() !== selectedPaymentMethod.toUpperCase()) {
          return false;
        }
      }

      // فلتر حالة الإرسال عبر الواتساب
      if (selectedStatusFilter !== 'all') {
        const isSent = inv.status === 'Sent via WhatsApp' || inv.whatsappStatus === 'sent';
        if (selectedStatusFilter === 'sent_whatsapp' && !isSent) return false;
        if (selectedStatusFilter === 'pending' && isSent) return false;
      }

      return true;
    });
  }, [invoices, searchQuery, selectedDateFilter, selectedPaymentMethod, selectedStatusFilter]);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    const totalCount = filteredInvoices.length;
    const totalAmount = filteredInvoices.reduce(
      (sum, item) => sum + (item.invoice.totalIncludingTax || item.invoice.totalAmount || 0),
      0
    );
    const todayCount = filteredInvoices.filter((item) => {
      const invDate = new Date(item.invoice.issueDate);
      const now = new Date();
      return (
        invDate.getDate() === now.getDate() &&
        invDate.getMonth() === now.getMonth() &&
        invDate.getFullYear() === now.getFullYear()
      );
    }).length;
    const sentViaWhatsAppCount = filteredInvoices.filter(
      (item) => item.invoice.status === 'Sent via WhatsApp' || item.invoice.whatsappStatus === 'sent'
    ).length;

    return { totalCount, totalAmount, todayCount, sentViaWhatsAppCount };
  }, [filteredInvoices]);

  // تحديث حالة الفاتورة إلى 'Sent via WhatsApp' في Firestore
  const handleWhatsAppShareInitiated = useCallback(async () => {
    const inv = activeInvoiceItem?.invoice || activeSaleResult?.invoice;
    if (!inv) return;
    const invId = inv.id;

    try {
      setUpdatingStatusId(invId);
      const res = await updateInvoiceStatus(invId, 'Sent via WhatsApp', {
        whatsappSentAt: new Date().toISOString(),
        updatedBy: 'مستخدم النظام',
      });

      // تحديث القائمة المعروضة محلياً فوراً
      setInvoices((prev) =>
        prev.map((item) => {
          if (item.invoice.id === invId || item.invoice.invoiceNumber === inv.invoiceNumber) {
            return {
              ...item,
              invoice: {
                ...item.invoice,
                status: 'Sent via WhatsApp',
                whatsappStatus: 'sent',
                whatsappSentAt: res.sentAt || new Date().toISOString(),
              },
            };
          }
          return item;
        })
      );

      // تحديث نتيجة البيع المفتوحة إن وجدت
      setActiveSaleResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          invoice: {
            ...prev.invoice,
            status: 'Sent via WhatsApp',
            whatsappStatus: 'sent',
            whatsappSentAt: res.sentAt || new Date().toISOString(),
          },
        };
      });

      setToastNotification({
        type: 'success',
        message: `تم تحديث حالة الفاتورة (#${inv.invoiceNumber}) إلى "Sent via WhatsApp" وحفظها في قاعدة البيانات السحابية (Firestore) بنجاح!`,
      });
      setTimeout(() => setToastNotification(null), 5000);
    } catch (err: any) {
      console.error('فشل تحديث حالة الفاتورة:', err);
      setToastNotification({
        type: 'error',
        message: `تعذر تحديث حالة الفاتورة في Firestore: ${err?.message || ''}`,
      });
      setTimeout(() => setToastNotification(null), 6000);
    } finally {
      setUpdatingStatusId(null);
    }
  }, [activeInvoiceItem, activeSaleResult]);

  // تغيير حالة الفاتورة يدوياً في Firestore من الجدول
  const handleChangeInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      setUpdatingStatusId(invoiceId);
      const res = await updateInvoiceStatus(invoiceId, newStatus, {
        whatsappSentAt: newStatus === 'Sent via WhatsApp' ? new Date().toISOString() : undefined,
        updatedBy: 'مستخدم النظام',
      });

      setInvoices((prev) =>
        prev.map((item) => {
          if (item.invoice.id === invoiceId || item.invoice.invoiceNumber === invoiceId) {
            return {
              ...item,
              invoice: {
                ...item.invoice,
                status: newStatus,
                whatsappStatus: newStatus === 'Sent via WhatsApp' ? 'sent' : 'not_sent',
                whatsappSentAt: newStatus === 'Sent via WhatsApp' ? res.sentAt : undefined,
              },
            };
          }
          return item;
        })
      );

      setToastNotification({
        type: 'success',
        message: `تم تغيير حالة الفاتورة في Firestore بنجاح إلى "${newStatus}".`,
      });
      setTimeout(() => setToastNotification(null), 4000);
    } catch (err: any) {
      console.error('فشل تغيير حالة الفاتورة:', err);
      setToastNotification({
        type: 'error',
        message: `حدث خطأ أثناء تعديل الحالة: ${err?.message || ''}`,
      });
      setTimeout(() => setToastNotification(null), 5000);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // فتح نافذة طباعة / معاينة الفاتورة
  const handleOpenReceiptModal = async (invoiceId: string) => {
    setIsPreparingReceipt(true);
    try {
      const saleRes = await getCompletedSaleResultForInvoice(invoiceId);
      if (saleRes) {
        setActiveSaleResult(saleRes);
        setIsReceiptModalOpen(true);
      } else {
        alert('تعذر العثور على تفاصيل الفاتورة المطلوبة.');
      }
    } catch (err) {
      console.error('خطأ في فتح طباعة الفاتورة:', err);
      alert('حدث خطأ أثناء تحميل بيانات الفاتورة.');
    } finally {
      setIsPreparingReceipt(false);
    }
  };

  // فتح نافذة الواتساب فورياً
  const handleOpenWhatsapp = async (item: InvoiceLookupItem) => {
    setActiveInvoiceItem(item);
    setIsPreparingReceipt(true);
    try {
      const saleRes = await getCompletedSaleResultForInvoice(item.invoice.id);
      if (saleRes) {
        const msg = buildInvoiceWhatsAppMessage({
          invoice: saleRes.invoice,
          sale: saleRes.sale,
          saleItems: saleRes.saleItems,
          payment: saleRes.payment,
        });

        setWhatsappData({
          docNumber: saleRes.invoice.invoiceNumber,
          customerName: saleRes.invoice.customerName || 'عميل نقدي',
          customerPhone: saleRes.invoice.customerPhone || '',
          messageText: msg,
          grandTotal: saleRes.grandTotal,
        });

        setActiveSaleResult(saleRes);
        setIsWhatsappModalOpen(true);
      } else {
        alert('تعذر تجهيز الفاتورة لإرسالها بالواتساب.');
      }
    } catch (err) {
      console.error('خطأ في إعداد الواتساب:', err);
    } finally {
      setIsPreparingReceipt(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Navigation Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">استعلام وإعادة طباعة الفواتير المفقودة</h1>
              <p className="text-sm text-slate-580 font-medium">
                ابحث عن أي فاتورة سابقة باسم العميل أو رقم الجوال أو رقم الفاتورة وأعد طباعتها أو شاركها فورياً عبر الواتساب مع تحديث حالتها تلقائياً
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onBackToPos && (
            <button
              onClick={onBackToPos}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>العودة لنقطة البيع (POS)</span>
            </button>
          )}
          <button
            onClick={loadInvoicesData}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>
      </div>

      {/* تنبيه نجاح / فشل تحديث حالة الفاتورة */}
      {toastNotification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition-all ${
            toastNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span className="text-xs font-bold leading-relaxed">{toastNotification.message}</span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Quick Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 block">إجمالي الفواتير المعروضة</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {formatInteger(stats.totalCount)}
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 block">إجمالي قيمة الفواتير</span>
            <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
              {formatSAR(stats.totalAmount)}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <SaudiRiyalSymbol className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-800 block">مرسلة عبر الواتساب</span>
            <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
              {formatInteger(stats.sentViaWhatsAppCount)}
            </span>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 block">فواتير اليوم</span>
            <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">
              {formatInteger(stats.todayCount)}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* حقل البحث الرئيسي */}
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة (مثال: 659549) أو اسم العميل أو رقم الجوال..."
              className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-md font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* فلتر النطاق الزمني */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setSelectedDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedDateFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setSelectedDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedDateFilter === 'today'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setSelectedDateFilter('yesterday')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedDateFilter === 'yesterday'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الأمس
            </button>
            <button
              onClick={() => setSelectedDateFilter('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedDateFilter === 'week'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              آخر 7 أيام
            </button>
          </div>

          {/* فلتر طريقة الدفع */}
          <select
            value={selectedPaymentMethod}
            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
            className="w-full md:w-auto py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">جميع طرق الدفع</option>
            <option value="CASH">نقداً (كاش)</option>
            <option value="MADA">شبكة (مدى)</option>
            <option value="CREDIT">آجل (ذمم)</option>
            <option value="TRANSFER">تحويل بنكي</option>
          </select>

          {/* فلتر حالة الإرسال */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full md:w-auto py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">جميع حالات الفواتير</option>
            <option value="sent_whatsapp">مرسلة عبر الواتساب (Sent via WhatsApp)</option>
            <option value="pending">غير مرسلة عبر الواتساب</option>
          </select>
        </div>

        {/* شريط الإعدادات السريعة لحالة الواتساب */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={autoUpdateStatusOnWhatsApp}
              onChange={(e) => setAutoUpdateStatusOnWhatsApp(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span>
              تحديث حالة الفاتورة تلقائياً إلى <strong className="text-emerald-700 font-bold">"Sent via WhatsApp"</strong> في قاعدة البيانات (Firestore) فور نجاح تسليم الفاتورة للعميل
            </span>
          </label>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>يتم التحديث المباشر والمتزامن في خوادم Firestore السحابية</span>
          </div>
        </div>
      </div>

      {/* 4. Invoices Table & Cards List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-slate-600 text-sm font-medium">جاري البحث وجلب سجل الفواتير...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="p-4 bg-slate-100 text-slate-400 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <Receipt className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">لم يتم العثور على فواتير مطابقة</h3>
              <p className="text-sm text-slate-580 mt-1">
                تأكد من كتابة رقم الفاتورة بشكل صحيح أو قم بتعديل خيارات التصفية والتاريخ.
              </p>
            </div>
            {(searchQuery || selectedStatusFilter !== 'all' || selectedDateFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDateFilter('all');
                  setSelectedPaymentMethod('all');
                  setSelectedStatusFilter('all');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                إعادة ضبط البحث
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">رقم الفاتورة</th>
                  <th className="p-3.5">تاريخ ووقت الإصدار</th>
                  <th className="p-3.5">اسم العميل / الجوال</th>
                  <th className="p-3.5">طريقة الدفع</th>
                  <th className="p-3.5 text-left">المبلغ الإجمالي</th>
                  <th className="p-3.5 text-center">حالة الفاتورة (Status)</th>
                  <th className="p-3.5 text-center">إجراءات وإعادة الطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredInvoices.map((item) => {
                  const inv = item.invoice;
                  const total = inv.totalIncludingTax || inv.totalAmount || 0;
                  const dateFormatted = new Date(inv.issueDate).toLocaleString('ar-SA', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });
                  const methodCode = item.sale?.paymentMethodCode || 'CASH';
                  const isSentViaWhatsApp =
                    inv.status === 'Sent via WhatsApp' || inv.whatsappStatus === 'sent';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* رقم الفاتورة */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                            {inv.invoiceNumber}
                          </span>
                        </div>
                      </td>

                      {/* التاريخ */}
                      <td className="p-3.5 text-slate-600 dir-ltr text-right font-sans">
                        {dateFormatted}
                      </td>

                      {/* العميل */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{inv.customerName || 'عميل نقدي'}</div>
                        {inv.customerPhone && (
                          <div className="text-[11px] text-slate-600 font-mono dir-ltr text-right">
                            {inv.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* طريقة الدفع */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            methodCode === 'CASH'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : methodCode === 'MADA' || methodCode === 'CARD'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : methodCode === 'CREDIT'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                          }`}
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>{item.paymentMethodName || methodCode}</span>
                        </span>
                      </td>

                      {/* المبلغ */}
                      <td className="p-3.5 text-left font-mono font-black text-slate-900 text-sm">
                        {formatSAR(total)}
                      </td>

                      {/* حالة الفاتورة في Firestore */}
                      <td className="p-3.5 text-center">
                        {isSentViaWhatsApp ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Sent via WhatsApp</span>
                            </span>
                            {inv.whatsappSentAt && (
                              <span className="text-[10px] text-slate-500 font-sans dir-ltr">
                                {new Date(inv.whatsappSentAt).toLocaleTimeString('ar-SA', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{inv.status || 'غير مرسلة'}</span>
                            </span>
                            <button
                              onClick={() => handleChangeInvoiceStatus(inv.id, 'Sent via WhatsApp')}
                              disabled={updatingStatusId === inv.id}
                              className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline transition-colors flex items-center gap-1"
                              title="تغيير الحالة إلى Sent via WhatsApp وحفظها في Firestore"
                            >
                              {updatingStatusId === inv.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                              ) : (
                                <Check className="w-3 h-3 text-emerald-600" />
                              )}
                              <span>تعيين كـ Sent via WhatsApp</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* الأزرار والإجراءات */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          {/* زر إعادة الطباعة والفتح */}
                          <button
                            onClick={() => handleOpenReceiptModal(inv.id)}
                            disabled={isPreparingReceipt}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 border border-slate-200"
                            title="إعادة طباعة الفاتورة ومعاينتها"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>إعادة طباعة</span>
                          </button>

                          {/* زر الواتساب والمشاركة */}
                          <button
                            onClick={() => handleOpenWhatsapp(item)}
                            disabled={isPreparingReceipt}
                            className={`px-3 py-1.5 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm ${
                              isSentViaWhatsApp
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                            title="مشاركة الفاتورة عبر الواتساب وتحديث الحالة تلقائياً"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>مشاركة واتساب</span>
                          </button>
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

      {/* Modal 1: نافذة معاينة وإعادة الطباعة والتنزيل (A4 وحراري) */}
      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleResult={activeSaleResult}
        onNewSale={() => setIsReceiptModalOpen(false)}
      />

      {/* Modal 2: نافذة إرسال الواتساب للمستند والـ PDF */}
      {whatsappData && (
        <WhatsAppShareModal
          isOpen={isWhatsappModalOpen}
          onClose={() => setIsWhatsappModalOpen(false)}
          documentTitle="الفاتورة الضريبية الرسمية"
          documentNumber={whatsappData.docNumber}
          recipientName={whatsappData.customerName}
          initialPhone={whatsappData.customerPhone}
          messageText={whatsappData.messageText}
          grandTotal={whatsappData.grandTotal}
          saleResult={activeSaleResult}
          onShareInitiated={() => {
            if (autoUpdateStatusOnWhatsApp) {
              handleWhatsAppShareInitiated();
            }
          }}
        />
      )}
    </div>
  );
};
