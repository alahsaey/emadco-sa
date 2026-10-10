/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import { formatSAR, formatNumber, formatInteger } from '../../utils/formatters';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Package,
  Layers,
  ShoppingBag,
  RotateCcw,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  Unlock,
  ChevronRight,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Eye,
  Store,
  Plus,
  Truck,
  Users,
  FileCheck2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { Product } from '../../types';
import { LowStockAlertsModal } from '../inventory/LowStockAlertsModal';
import {
  loadReportsAndDashboardData,
  computeDashboardMetrics,
  computeChartDataSets,
  DashboardMetrics,
  ChartDataSets,
} from '../../services/reports';

interface DashboardScreenProps {
  onOpenReports: (tabName?: string) => void;
  onOpenPos: () => void;
  onOpenInventory: () => void;
  onOpenInvoicesLookup?: () => void;
  onOpenQuotations?: () => void;
  onOpenPayments?: () => void;
  onOpenPurchases?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onOpenReports,
  onOpenPos,
  onOpenInventory,
  onOpenInvoicesLookup,
  onOpenQuotations,
  onOpenPayments,
  onOpenPurchases,
}) => {
  const { currentUser, currentRole, hasPermission } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<ChartDataSets | null>(null);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  // إمكانية الكاشير للاطلاع على الأرباح والتقارير الحساسة
  // الكاشير مقيد افتراضياً ما لم يمنح صلاحية أو يقوم المالك بفتحها
  const [cashierProfitOverride, setCashierProfitOverride] = useState(false);

  // التحقق من صلاحية الأرباح
  const isOwnerOrManager =
    currentUser?.roleKey === 'system_owner' || currentUser?.roleKey === 'manager';
  const hasFinancialPermission =
    hasPermission('reports:financial_profits') || cashierProfitOverride;
  const canViewProfits = isOwnerOrManager || hasFinancialPermission;

  const loadData = async () => {
    try {
      setIsLoading(true);
      const rawData = await loadReportsAndDashboardData();
      const computedMetrics = computeDashboardMetrics(rawData);
      const computedCharts = computeChartDataSets(rawData, computedMetrics);
      setProductsList(rawData.products || []);
      setMetrics(computedMetrics);
      setChartData(computedCharts);
    } catch (err) {
      console.error('فشل تحميل مؤشرات لوحة القيادة:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading || !metrics || !chartData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mb-3" />
        <p className="text-slate-700 font-bold text-base">جاري تحميل لوحة القيادة والمؤشرات اللحظية...</p>
        <p className="text-slate-400 text-xs mt-1">تجميع بيانات المبيعات ونقاط البيع والأرباح والمخزون</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* شريط رأس الداشبورد وأدوات التحكم */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                لوحة القيادة والمؤشرات الاستراتيجية
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  مباشر ومحدث
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                نظرة شاملة على مبيعات اليوم، تدفقات النقد والشبكة، الأرباح، وحركة المخزون اللحظية
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* تحكم الصلاحيات للكاشير */}
          {currentUser?.roleKey === 'cashier' && (
            <button
              type="button"
              onClick={() => setCashierProfitOverride(!cashierProfitOverride)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                cashierProfitOverride
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title="تجاوز تجريبي لصلاحية الكاشير لفحص القيود والأرباح"
            >
              {cashierProfitOverride ? <Unlock className="w-3.5 h-3.5 text-amber-700" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
              <span>{cashierProfitOverride ? 'صلاحية الأرباح مفعلة للكاشير' : 'حساب كاشير (مقيد)'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsLowStockModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              metrics.lowStockProducts.length > 0
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${metrics.lowStockProducts.length > 0 ? 'text-rose-600' : 'text-amber-500'}`} />
            <span>تنبيهات المخزون ({metrics.lowStockProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
            <span>تحديث المؤشرات</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenReports()}
            className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>التقارير التحليلية الـ 11</span>
          </button>
        </div>
      </div>

      {/* بنر تحذيري مرئي وسريع لأصناف المخزون المنخفض (Low Stock Visual Alert) */}
      {metrics.lowStockProducts.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-rose-950 flex items-center gap-2">
                <span>تنبيه نقص المخزون: يوجد {metrics.lowStockProducts.length} صنف وصل أو قارب على حد الطلب الحرج</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-bold">عاجل</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                يرجى مراجعة الأصناف وجدولة أوامر التوريد للموردين لتفادي نفاد المواد الأساسية ونقاط البيع.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsLowStockModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>عرض شاشة التنبيهات</span>
            </button>
            <button
              type="button"
              onClick={onOpenInventory}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>المستودعات</span>
            </button>
          </div>
        </div>
      )}

      {/* شريط الإجراءات والعمليات السريعة لمحاسبة مواد البناء وإصدار الفواتير */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-md border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <h2 className="text-sm font-black text-white">العمليات اليومية السريعة (محاسبة مواد البناء والفواتير)</h2>
          </div>
          <span className="text-[11px] text-slate-300 font-mono">اختصارات فورية بنقرة واحدة</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={onOpenPos}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-sm cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div className="text-right min-w-0">
              <div className="text-xs font-black truncate">كاشير POS جديد</div>
              <div className="text-[10px] text-emerald-100 font-normal truncate">إصدار فاتورة ضريبية</div>
            </div>
          </button>

          {onOpenInvoicesLookup && (
            <button
              type="button"
              onClick={onOpenInvoicesLookup}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="text-right min-w-0">
                <div className="text-xs font-black truncate">استعلام الفواتير</div>
                <div className="text-[10px] text-slate-400 font-normal truncate">إعادة طباعة حراري/A4</div>
              </div>
            </button>
          )}

          {onOpenQuotations && (
            <button
              type="button"
              onClick={onOpenQuotations}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="text-right min-w-0">
                <div className="text-xs font-black truncate">عرض سعر مقاول</div>
                <div className="text-[10px] text-slate-400 font-normal truncate">تسعير مواد البناء</div>
              </div>
            </button>
          )}

          {onOpenPayments && (
            <button
              type="button"
              onClick={onOpenPayments}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <SaudiRiyalSymbol className="w-4 h-4" />
              </div>
              <div className="text-right min-w-0">
                <div className="text-xs font-black truncate">سند قبض / صرف</div>
                <div className="text-[10px] text-slate-400 font-normal truncate">سداد مديونيات ودفعات</div>
              </div>
            </button>
          )}

          {onOpenPurchases && (
            <button
              type="button"
              onClick={onOpenPurchases}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
              <div className="text-right min-w-0">
                <div className="text-xs font-black truncate">فاتورة مشتريات</div>
                <div className="text-[10px] text-slate-400 font-normal truncate">توريد بضاعة من مصنع</div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenInventory}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
            <div className="text-right min-w-0">
              <div className="text-xs font-black truncate">المخزون والجرد</div>
              <div className="text-[10px] text-slate-400 font-normal truncate">الأرصدة والمستودعات</div>
            </div>
          </button>
        </div>
      </div>

      {/* المؤشرات الإحصائية الرئيسية الـ 8 (Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* 1. مبيعات اليوم */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-700">مبيعات اليوم</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatNumber(metrics.salesTodayTotal)} <span className="text-xs font-bold text-slate-500">ر.س</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <span>{formatInteger(metrics.salesTodayCount)} فواتير اليوم</span>
          </div>
        </div>

        {/* 2. مبيعات الشهر */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-700">مبيعات الشهر الحالي</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatNumber(metrics.salesMonthTotal)} <span className="text-xs font-bold text-slate-500">ر.س</span>
          </div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1">
            <span>{formatInteger(metrics.salesMonthCount)} عملية بيع مسجلة</span>
          </div>
        </div>

        {/* 3. عدد الفواتير */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-700">إجمالي الفواتير</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatInteger(metrics.totalInvoicesCount)}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            فواتير ضريبية مبسطة ومعتمدة
          </div>
        </div>

        {/* 4. متوسط قيمة الفاتورة */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-700">متوسط قيمة الفاتورة</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <SaudiRiyalSymbol className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatNumber(metrics.averageInvoiceValue)} <span className="text-xs font-bold text-slate-500">ر.س</span>
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-1">
            معدل السلة لكل زبون ومقاول
          </div>
        </div>

        {/* 5. المدفوع نقداً */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-700">المدفوع نقداً (كاش)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatNumber(metrics.paidCashTotal)} <span className="text-xs font-bold text-slate-500">ر.س</span>
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">
            تحصيلات نقدية في صناديق الكاشير
          </div>
        </div>

        {/* 6. المدفوع POS / شبكة */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-700">المدفوع عبر الشبكة (POS)</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatNumber(metrics.paidPosTotal)} <span className="text-xs font-bold text-slate-500">ر.س</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            مدى، فيزا، ماستركارد، Apple Pay
          </div>
        </div>

        {/* 7. المبيعات الآجلة */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-700">المبيعات الآجلة (مقاولين)</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatNumber(metrics.creditSalesTotal)} <span className="text-xs font-bold text-slate-500">ر.س</span>
          </div>
          <div className="text-[11px] text-rose-700 font-semibold mt-1">
            فواتير مستحقة على حسابات المقاولين
          </div>
        </div>

        {/* 8. الأرباح (مع الصلاحيات الصارمة) */}
        <div
          className={`p-4 rounded-xl border shadow-2xs transition-colors ${
            canViewProfits
              ? 'bg-gradient-to-br from-slate-900 to-slate-950 text-white border-slate-800'
              : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-bold ${canViewProfits ? 'text-amber-400' : 'text-slate-500'}`}>
              الأرباح الإجمالية (Gross Profit)
            </span>
            <div className={`p-1.5 rounded-lg ${canViewProfits ? 'bg-amber-400/20 text-amber-400' : 'bg-slate-200 text-slate-500'}`}>
              {canViewProfits ? <TrendingUp className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
          </div>

          {canViewProfits ? (
            <>
              <div className="text-2xl font-black font-mono text-white">
                {formatNumber(metrics.totalProfit)} <span className="text-xs font-bold text-amber-300">ر.س</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                هامش ربح تقديري: {metrics.profitMarginPercent}% بعد خصم التكلفة
              </div>
            </>
          ) : (
            <div className="py-1">
              <div className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-400" />
                <span>صلاحية مقيدة</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                لا يحق لموظف الكاشير الاطلاع على بيانات الأرباح وهوامش التكلفة.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* الرسوم البيانية الخمسة المطلوبة */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. المبيعات اليومية */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>المبيعات اليومية (آخر 7 أيام)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">تطور حجم المبيعات والفواتير اليومية</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenReports('sales')}
              className="text-xs text-slate-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>تقرير المبيعات</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.dailySales} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [formatSAR(val), 'المبيعات']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="sales" name="المبيعات (ر.س)" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. المبيعات الشهرية */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>المبيعات الشهرية والمشتريات</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">مقارنة أداء الشهور للعام الحالي</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenReports('purchases')}
              className="text-xs text-slate-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>تقرير المشتريات</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.monthlySales} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [formatSAR(val)]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="sales" name="المبيعات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="المشتريات" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. المبيعات حسب التصنيف */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-amber-500" />
                <span>المبيعات حسب التصنيف</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">توزيع الإيراد على تصنيفات مواد البناء والعدد</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenReports('inventory')}
              className="text-xs text-slate-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>المخزون والتصنيفات</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
          {chartData.salesByCategory && chartData.salesByCategory.length > 0 ? (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.salesByCategory}
                    dataKey="value"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {chartData.salesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatSAR(val)]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <PieIcon className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">لا توجد مبيعات مسجلة للتصنيفات</p>
              <p className="text-[11px] text-slate-400 mt-0.5">ستظهر نسب مبيعات الأقسام عند إصدار الفواتير</p>
            </div>
          )}
        </div>

        {/* 4. طرق الدفع والتحصيل (مظهر عصري أنيق ومزامن لحظياً) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>طرق الدفع والتحصيل</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">نسب الدفع بالشبكة مدى، النقدي، والآجل</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenReports('pos')}
              className="text-xs text-slate-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>تقرير POS والمدفوعات</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {chartData.paymentMethods && chartData.paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {/* رسم بياني حلقي أنيق Donut بدون تشويش النصوص */}
              <div className="h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.paymentMethods}
                      dataKey="value"
                      nameKey="methodName"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {chartData.paymentMethods.map((entry, index) => (
                        <Cell key={`cell-pm-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [formatSAR(val), name]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* قائمة الطرق بنسب واضحة وأنيقة (Clean Legend Card List) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                {chartData.paymentMethods.map((pm) => (
                  <div
                    key={pm.methodId}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 border border-slate-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: pm.color }}
                      />
                      <span className="text-xs font-bold text-slate-700 truncate">
                        {pm.methodName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-900">
                        {formatSAR(pm.value)}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-black"
                        style={{
                          backgroundColor: `${pm.color}15`,
                          color: pm.color,
                        }}
                      >
                        %{pm.percentage}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2 border border-indigo-100">
                <CreditCard className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-800">لا توجد عمليات دفع مسجلة حالياً</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                ستظهر نسب وتفاصيل التحصيل تلقائياً فور تسجيل فواتير جديدة بنقاط البيع.
              </p>
              <button
                type="button"
                onClick={onOpenPos}
                className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                فتح نقطة البيع POS
              </button>
            </div>
          )}
        </div>

        {/* 5. أفضل المنتجات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>أفضل 5 منتجات مبيعاً من حيث الإيراد</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">الأصناف الأكثر طلباً من المقاولين والورش</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenReports('sales')}
              className="text-xs text-slate-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>كل المنتجات</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
          {chartData.topProducts && chartData.topProducts.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData.topProducts}
                  margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#334155' }} width={120} />
                  <Tooltip
                    formatter={(val: any) => [formatSAR(val), 'الإيراد']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="revenue" name="الإيراد (ر.س)" fill="#059669" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">لا توجد مبيعات أصناف مسجلة</p>
              <p className="text-[11px] text-slate-400 mt-0.5">سيتم إدراج المنتجات الأعلى طلباً وتحقيقاً للإيراد هنا فور بدء البيع</p>
            </div>
          )}
        </div>
      </div>

      {/* الجداول التكميلية في الداشبورد */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* المنتجات الأكثر مبيعاً */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>المنتجات الأكثر مبيعاً</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400">الكمية والإيراد</span>
          </div>

          <div className="space-y-3">
            {metrics.topSellingProducts.map((p, idx) => (
              <div
                key={p.productId}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">{p.productName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {p.sku} | {p.categoryName}
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-black font-mono text-emerald-700">
                    {formatSAR(p.totalRevenue)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">{formatInteger(p.quantitySold)} قطعة</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* المنتجات منخفضة المخزون */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>تنبيهات نقص المخزون</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsLowStockModalOpen(true)}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1"
            >
              <span>فتح التنبيهات ({metrics.lowStockProducts.length})</span>
            </button>
          </div>

          <div className="space-y-3">
            {metrics.lowStockProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                المخزون ممتاز، لا توجد أصناف تحت حد الطلب حالياً.
              </div>
            ) : (
              metrics.lowStockProducts.map((p) => (
                <div
                  key={p.productId}
                  onClick={() => setIsLowStockModalOpen(true)}
                  className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-100 hover:bg-rose-100/60 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="text-xs font-bold text-rose-950 line-clamp-1">{p.productName}</div>
                    <div className="text-[10px] text-rose-700 font-mono">
                      {p.sku} | {p.categoryName}
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-800">
                      متبقي {p.currentStock}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">حد الطلب: {p.minStockLevel}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* آخر العمليات المسجلة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>آخر العمليات والحركات</span>
            </h3>
            <button
              type="button"
              onClick={onOpenPos}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              شاشة POS
            </button>
          </div>

          <div className="space-y-2.5">
            {metrics.recentOperations.map((op) => (
              <div
                key={op.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                      op.type === 'sale'
                        ? 'bg-emerald-100 text-emerald-800'
                        : op.type === 'return'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {op.type === 'sale' ? <Receipt className="w-3.5 h-3.5" /> : op.type === 'return' ? <RotateCcw className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{op.referenceNumber}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{op.customerOrSupplier}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-black font-mono text-slate-900">
                    {formatSAR(op.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400">{new Date(op.date).toLocaleDateString('ar-SA')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* شاشة ونوافذ تنبيهات المخزون المنخفض */}
      <LowStockAlertsModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        products={productsList}
        onCreatePurchaseOrder={() => {
          setIsLowStockModalOpen(false);
          onOpenReports('purchases');
        }}
        onOpenInventoryAdjustment={() => {
          setIsLowStockModalOpen(false);
          onOpenInventory();
        }}
      />
    </div>
  );
};
